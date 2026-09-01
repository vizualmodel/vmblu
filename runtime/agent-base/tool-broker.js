import {HIX_HANDLER} from '../shared/target.js'
import {BrokerRequestTypes, BrokerResultTypes, ToolResultStatus, brokerError} from './broker-protocol.js'
import {CapabilityRegistry} from './capability-registry.js'
import {AgentPolicy} from './agent-policy.js'
import {validateJsonSchema} from './json-schema.js'
import {TraceRecorder} from './trace-recorder.js'

export class ToolBroker {
    constructor({runtime, capabilities, registry, traceRecorder, approvalTtlMs = 300000} = {}) {
        this.runtime = null
        this.registry = registry ?? new CapabilityRegistry(capabilities)
        this.trace = traceRecorder ?? new TraceRecorder()
        this.probeReaders = new Map()
        this.events = []
        this.agents = new Map()
        this.approvalRequests = new Map()
        this.listeners = new Map()
        this.nextCallId = 1
        this.nextApprovalId = 1
        this.approvalTtlMs = approvalTtlMs
        this.source = null
        this.actor = null

        if (runtime) this.attachRuntime(runtime)
    }

    attachRuntime(runtime) {
        if (!runtime) throw new Error('ToolBroker requires a runtime')
        this.runtime = runtime
        this.actor = this.makeRuntimeActor()
        this.source = this.actor
        return this
    }

    makeRuntimeActor() {
        const broker = this
        const actor = {
            name: 'ToolBroker',
            uid: '__vmblu_tool_broker__',
            msg: null,
            txMap: new Map(),
            rxSink: [
                {
                    pin: 'event',
                    channel: false,
                    handler(param) {
                        return broker.recordRuntimeEvent(actor.msg, param)
                    }
                }
            ],
            cell: null,
            makeCell() {
                this.cell = {event: this.rxSink[0].handler}
            },
            resolveUIDs() {},
        }
        actor.cell = {event: actor.rxSink[0].handler}
        return actor
    }

    registerAgent(agent) {
        if (!agent?.id) throw new Error('Agent must have an id')
        agent.policy = AgentPolicy.fromAgent(agent)
        this.agents.set(agent.id, agent)
        if (typeof agent.attachBroker === 'function') agent.attachBroker(this)
        this.trace.record({type: 'agent.registered', agentId: agent.id, status: 'ok', details: {policy: agent.policy.traceDetails()}})
        return this
    }

    unregisterAgent(agentOrId) {
        const agentId = typeof agentOrId === 'string' ? agentOrId : agentOrId?.id
        if (!agentId) return false
        const removed = this.agents.delete(agentId)
        if (removed) this.trace.record({type: 'agent.unregistered', agentId, status: 'ok'})
        return removed
    }

    cancelPendingApprovals(reason = 'runtime_stopped') {
        const resolvedAt = new Date().toISOString()
        for (const approval of this.approvalRequests.values()) {
            if (approval.status !== 'requested') continue
            approval.status = 'cancelled'
            approval.resolvedAt = resolvedAt
            approval.resolvedBy = reason
        }
    }

    subscribe(agentId, listener) {
        if (typeof listener !== 'function') throw new Error('Broker listener must be a function')
        const identity = this.identityDecision(agentId)
        if (!identity.allowed) throw new Error(`Broker subscription denied: ${identity.reason}`)
        if (!this.listeners.has(agentId)) this.listeners.set(agentId, new Set())
        this.listeners.get(agentId).add(listener)
        return () => this.listeners.get(agentId)?.delete(listener)
    }

    publish(message) {
        if (!message) return message
        if (!message.agentId) return message
        for (const listener of this.listeners.get(message.agentId) ?? []) listener(message)
        return message
    }

    agentTraceView(agentId) {
        const visible = record => this.canViewTrace(agentId, record)
        return {
            all: () => this.trace.all().filter(visible),
            subscribe: listener => this.trace.subscribe(record => {
                if (visible(record)) listener(record)
            }),
        }
    }

    canViewTrace(agentId, record) {
        if (!this.identityDecision(agentId).allowed) return false
        if (record?.agentId && record.agentId !== agentId) return false
        const policy = this.getAgentPolicy(agentId)
        if (record?.toolId) return policy.canUse('tools', record.toolId).allowed
        if (record?.probeId) return policy.canUse('probes', record.probeId).allowed
        if (record?.eventId) return policy.canUse('events', record.eventId).allowed
        return record?.agentId === agentId
    }

    emitResult(request, result) {
        if (request?.agentId) {
            this.publish({
                kind: 'broker.result',
                agentId: request.agentId,
                requestId: request.requestId,
                callId: result?.callId,
                result,
                timestamp: new Date().toISOString(),
            })
        }
        return result
    }

    registerProbe(probeId, reader) {
        if (typeof reader !== 'function') throw new Error('Probe reader must be a function')
        this.probeReaders.set(probeId, reader)
        return this
    }

    recordEvent(eventId, payload, callId = undefined) {
        const event = {
            eventId,
            payload,
            callId,
            timestamp: new Date().toISOString(),
        }
        this.events.push(event)
        this.trace.record({type: 'event.observed', eventId, callId, details: {payload}})
        for (const [agentId, agent] of this.agents) {
            const policy = agent.policy = AgentPolicy.fromAgent(agent)
            if (!policy.canUse('events', eventId).allowed) continue
            this.publish({
                kind: 'event.observed',
                agentId,
                eventId,
                callId,
                payload,
                timestamp: event.timestamp,
            })
        }
        return event
    }

    recordRuntimeEvent(msg, payload) {
        const event = this.registry.list().events.find(candidate => {
            return candidate?.source?.node === msg?.source?.name && candidate?.source?.pin === msg?.txPin
        })

        if (!event) {
            this.trace.record({
                type: 'event.ignored',
                status: 'ignored',
                details: {node: msg?.source?.name, pin: msg?.txPin, payload},
            })
            return null
        }

        return this.recordEvent(event.id, payload, payload?.callId)
    }

    async handle(request) {
        switch (request?.type) {
            case BrokerRequestTypes.CAPABILITIES_LIST:
                return this.emitResult(request, this.listCapabilities(request))
            case BrokerRequestTypes.TOOL_CALL:
                return this.callTool(request)
            case BrokerRequestTypes.PROBE_READ:
                return this.readProbe(request)
            case BrokerRequestTypes.EVENT_WAIT:
                return this.waitForEvent(request)
            case BrokerRequestTypes.EVENTS_QUERY:
                return this.emitResult(request, this.queryEvents(request))
            case BrokerRequestTypes.APPROVAL_RESOLVE:
                return this.resolveApproval(request)
            default:
                return this.emitResult(request, brokerError(request, 'unknown_request', `Unknown broker request type: ${request?.type}`))
        }
    }

    listCapabilities(request = {}) {
        const policy = this.getAgentPolicy(request.agentId)
        const capabilities = policy.filterCapabilities(this.registry.list())
        const identity = this.identityDecision(request.agentId)

        this.trace.record({
            type: 'capabilities.list',
            agentId: request.agentId,
            requestId: request.requestId,
            status: identity.allowed ? 'ok' : 'denied',
            details: {
                policy: policy.traceDetails(),
                counts: {
                    tools: capabilities.tools.length,
                    probes: capabilities.probes.length,
                    events: capabilities.events.length,
                },
            },
        })

        return {
            type: BrokerResultTypes.CAPABILITIES_RESULT,
            requestId: request.requestId,
            status: identity.allowed ? 'ok' : 'denied',
            capabilities,
            ...(identity.allowed ? {} : {error: {code: 'denied', message: identity.reason}}),
        }
    }

    capabilityView(agentId) {
        return this.getAgentPolicy(agentId).filterCapabilities(this.registry.list())
    }

    async callTool(request) {
        const tool = this.registry.getTool(request?.toolId)
        const callId = this.newCallId()

        this.trace.record({
            type: 'tool.call',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId: request?.toolId,
            status: 'requested',
            details: {args: request?.args},
        })

        if (!tool) {
            this.trace.record({
                type: 'policy.decision',
                agentId: request?.agentId,
                requestId: request?.requestId,
                callId,
                toolId: request?.toolId,
                status: 'denied',
                details: {reason: 'unknown_tool'},
            })
            return this.toolResult(request, callId, request?.toolId, ToolResultStatus.DENIED, {
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }
        if (!this.runtime) return this.toolError(request, callId, 'runtime_not_attached', 'ToolBroker is not attached to a runtime', tool.id)

        const policy = this.checkToolPolicy(request, tool)
        this.trace.record({
            type: 'policy.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId: tool.id,
            status: policy.allowed ? 'allowed' : 'denied',
            details: policy,
        })
        if (!policy.allowed) {
            return this.toolResult(request, callId, tool.id, ToolResultStatus.DENIED, {
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }

        const validation = this.validateArgs('tool', tool.id, tool.input?.schema, request?.args)
        this.trace.record({
            type: 'validation.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId: tool.id,
            status: validation.valid ? 'ok' : 'failed',
            details: validation,
        })
        if (!validation.valid) {
            return this.toolResult(request, callId, tool.id, ToolResultStatus.FAILED, {
                error: {code: 'invalid_args', message: validation.message, details: validation.errors},
            })
        }

        const approval = this.checkToolApproval(request, callId, tool)
        this.trace.record({
            type: 'approval.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId: tool.id,
            status: approval.required ? 'required' : 'not_required',
            details: approval,
        })
        if (approval.required) {
            const approvalRequest = this.createApprovalRequest(request, callId, tool, approval)
            return this.toolResult(request, callId, tool.id, ToolResultStatus.PENDING, {
                approval: approvalRequest,
            })
        }

        return this.executeTool(request, tool, callId)
    }

    async executeTool(request, tool, callId) {
        const target = this.resolveInputTarget(tool.input)
        if (!target) return this.toolError(request, callId, 'target_not_found', `No runtime target for ${tool.input?.ref}`)

        try {
            const wait = this.effectiveWaitMode(request.wait, tool, target)
            const timeout = request.timeoutMs ?? normalizeVerifyWith(tool).timeoutMs ?? tool.timeoutMs ?? 1000
            const payload = this.makeRuntimePayload(tool, request, callId)

            this.trace.record({
                type: 'message.dispatch',
                agentId: request?.agentId,
                requestId: request?.requestId,
                callId,
                toolId: tool.id,
                status: 'dispatching',
                details: {target: tool.input},
            })

            if (wait === 'none' || wait === 'accepted' || (wait !== 'verified' && !target.channel)) {
                this.runtime.sendTo(this.source, tool.input.pin, [target], payload)
                return this.toolResult(request, callId, tool.id, ToolResultStatus.ACCEPTED)
            }

            if (wait === 'verified') {
                let result
                if (target.channel) result = await this.runtime.requestFrom(this.source, tool.input.pin, [target], payload, timeout)
                else this.runtime.sendTo(this.source, tool.input.pin, [target], payload)
                return this.verifyToolResult(request, tool, callId, timeout, result)
            }

            const reply = await this.runtime.requestFrom(this.source, tool.input.pin, [target], payload, timeout)
            return this.toolResult(request, callId, tool.id, ToolResultStatus.COMPLETED, {result: reply})
        }
        catch (error) {
            return this.toolError(request, callId, 'dispatch_failed', error?.message || String(error), tool.id)
        }
    }

    async verifyToolResult(request, tool, callId, timeoutMs = 1000, result) {
        const verifyWith = normalizeVerifyWith(tool)
        const evidence = {
            events: [],
            probes: [],
        }

        if (!verifyWith.events.length && !verifyWith.probes.length) {
            return this.toolResult(request, callId, tool.id, ToolResultStatus.ACCEPTED, {
                verification: {status: 'not_requested', evidence},
            })
        }

        for (const eventId of verifyWith.events) {
            const event = await this.waitForEventEvidence(eventId, callId, timeoutMs)
            evidence.events.push(event)
        }

        for (const probeSpec of verifyWith.probes) {
            const probeId = typeof probeSpec === 'string' ? probeSpec : probeSpec?.id
            if (!probeId) continue
            const result = await this.readProbe({
                agentId: request?.agentId,
                requestId: request?.requestId,
                probeId,
                args: typeof probeSpec === 'object' ? probeSpec.args : undefined,
            })
            evidence.probes.push({
                probeId,
                status: result?.status,
                value: result?.value,
                error: result?.error,
            })
        }

        const verified = evidence.events.every(item => item.status === 'observed')
            && evidence.probes.every(item => item.status === 'ok')

        this.trace.record({
            type: 'verification.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId: tool.id,
            status: verified ? 'verified' : 'unverified',
            details: evidence,
        })

        return this.toolResult(request, callId, tool.id, verified ? ToolResultStatus.VERIFIED : ToolResultStatus.UNVERIFIED, {
            ...(result === undefined ? {} : {result}),
            verification: {
                status: verified ? 'verified' : 'unverified',
                evidence,
            },
        })
    }

    async waitForEventEvidence(eventId, callId, timeoutMs) {
        const started = Date.now()
        while (Date.now() - started <= timeoutMs) {
            const found = this.findEvent({eventId, callId})
            if (found) {
                return {
                    eventId,
                    status: 'observed',
                    callId: found.callId,
                    payload: found.payload,
                }
            }
            await new Promise(resolve => setTimeout(resolve, 10))
        }
        return {eventId, status: 'timeout', callId}
    }

    async resolveApproval(request = {}) {
        const approval = this.approvalRequests.get(request.approvalId)
        if (!approval) {
            return this.emitResult(request, brokerError(request, 'unknown_approval', `Unknown approval request: ${request.approvalId}`))
        }
        if (approval.status !== 'requested') {
            return this.emitResult(request, brokerError(request, 'approval_already_resolved', `Approval request is already ${approval.status}`))
        }

        if (Date.now() >= Date.parse(approval.expiresAt)) {
            approval.status = 'expired'
            approval.resolvedAt = new Date().toISOString()
            return this.emitResult(request, brokerError(request, 'approval_expired', 'Approval request has expired'))
        }

        if (request?.authority?.trusted !== true) {
            return this.emitResult(request, brokerError(request, 'untrusted_approval_authority', 'Approval requires a trusted human or external authority'))
        }

        if (request?.agentId && request.agentId !== approval.agentId) {
            return this.emitResult(request, brokerError(request, 'approval_identity_mismatch', 'Approval request belongs to another agent'))
        }

        const tool = this.registry.getTool(approval.toolId)
        if (!tool) return this.toolError(request, approval.callId, 'unknown_tool', `Unknown tool: ${approval.toolId}`, approval.toolId)

        const currentPolicy = this.checkToolPolicy(approval.request, tool)
        if (!currentPolicy.allowed) {
            approval.status = 'denied'
            return this.toolResult(request, approval.callId, approval.toolId, ToolResultStatus.DENIED, {
                approval,
                error: {code: 'denied', message: currentPolicy.reason},
            })
        }

        if ((tool.risk ?? 'low') !== approval.risk
            || JSON.stringify(tool.effects ?? []) !== JSON.stringify(approval.effects)) {
            approval.status = 'invalidated'
            approval.resolvedAt = new Date().toISOString()
            return this.emitResult(request, brokerError(request, 'approval_changed', 'Tool risk or effects changed; request a new approval'))
        }

        approval.status = request.approved === true ? 'approved' : 'denied'
        approval.resolvedAt = new Date().toISOString()
        approval.resolvedBy = request.authority.id ?? request.authority.kind ?? 'trusted-authority'

        this.trace.record({
            type: 'approval.resolved',
            agentId: approval.agentId,
            requestId: request.requestId,
            callId: approval.callId,
            toolId: approval.toolId,
            status: approval.status,
            details: approval,
        })
        this.publish({
            kind: 'approval.resolved',
            agentId: approval.agentId,
            approval,
            timestamp: approval.resolvedAt,
        })

        if (approval.status !== 'approved') {
            return this.toolResult(request, approval.callId, approval.toolId, ToolResultStatus.DENIED, {
                approval,
                error: {code: 'approval_denied', message: 'Approval was denied'},
            })
        }
        return this.executeTool(approval.request, tool, approval.callId)
    }

    async readProbe(request) {
        const probe = this.registry.getProbe(request?.probeId)
        if (!probe) {
            this.trace.record({
                type: 'policy.decision',
                agentId: request?.agentId,
                requestId: request?.requestId,
                probeId: request?.probeId,
                status: 'denied',
                details: {reason: 'unknown_probe'},
            })
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: request?.probeId,
                status: 'denied',
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }

        const policy = this.checkCapabilityPolicy(request, 'probes', probe.id)
        this.trace.record({
            type: 'policy.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            probeId: probe.id,
            status: policy.allowed ? 'allowed' : 'denied',
            details: policy,
        })
        if (!policy.allowed) {
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'denied',
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }

        const validation = this.validateArgs('probe', probe.id, probe.argsSchema ?? probe.arguments?.schema ?? probe.input?.schema, request?.args)
        this.trace.record({
            type: 'validation.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            probeId: probe.id,
            status: validation.valid ? 'ok' : 'failed',
            details: validation,
        })
        if (!validation.valid) {
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'failed',
                error: {code: 'invalid_args', message: validation.message, details: validation.errors},
            })
        }

        const reader = this.probeReaders.get(probe.id)
        if (!reader) {
            this.trace.record({
                type: 'probe.read',
                agentId: request?.agentId,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'failed',
                details: {reason: 'no_reader'},
            })
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'failed',
                error: {code: 'probe_not_registered', message: `No reader registered for probe: ${probe.id}`},
            })
        }

        try {
            const value = makeJsonSafe(await reader(request.args, probe))
            const text = stringifyProbeValue(value)
            this.trace.record({
                type: 'probe.read',
                agentId: request?.agentId,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'ok',
                details: {value, text},
            })
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'ok',
                value,
                text,
            })
        }
        catch (error) {
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: probe.id,
                status: 'failed',
                error: {code: 'probe_failed', message: error?.message || String(error)},
            })
        }
    }

    async waitForEvent(request) {
        const event = this.registry.getEvent(request?.eventId)
        if (!event) {
            this.trace.record({
                type: 'policy.decision',
                agentId: request?.agentId,
                requestId: request?.requestId,
                eventId: request?.eventId,
                status: 'denied',
                details: {reason: 'unknown_event'},
            })
            return this.emitResult(request, {
                type: BrokerResultTypes.EVENT_RESULT,
                requestId: request?.requestId,
                eventId: request?.eventId,
                status: 'denied',
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }

        const policy = this.checkCapabilityPolicy(request, 'events', event.id)
        this.trace.record({
            type: 'policy.decision',
            agentId: request?.agentId,
            requestId: request?.requestId,
            eventId: event.id,
            status: policy.allowed ? 'allowed' : 'denied',
            details: policy,
        })
        if (!policy.allowed) {
            return this.emitResult(request, {
                type: BrokerResultTypes.EVENT_RESULT,
                requestId: request?.requestId,
                eventId: event.id,
                status: 'denied',
                error: {code: 'denied', message: 'Capability unavailable'},
            })
        }

        const timeoutMs = request?.timeoutMs ?? 1000
        const started = Date.now()

        while (Date.now() - started <= timeoutMs) {
            const found = this.findEvent(request)
            if (found) {
                return this.emitResult(request, {
                    type: BrokerResultTypes.EVENT_RESULT,
                    requestId: request.requestId,
                    eventId: request.eventId,
                    status: 'observed',
                    callId: found.callId,
                    payload: found.payload,
                })
            }
            await new Promise(resolve => setTimeout(resolve, 10))
        }

        return this.emitResult(request, {
            type: BrokerResultTypes.EVENT_RESULT,
            requestId: request?.requestId,
            eventId: request?.eventId,
            status: 'timeout',
        })
    }

    queryEvents(request = {}) {
        const identity = this.identityDecision(request.agentId)
        if (!identity.allowed) {
            return {
                type: BrokerResultTypes.EVENTS_RESULT,
                requestId: request.requestId,
                status: 'denied',
                events: [],
                error: {code: 'denied', message: 'Capability unavailable'},
            }
        }
        const policy = this.getAgentPolicy(request.agentId)
        const events = this.events.filter(event => {
            if (request.eventId && event.eventId !== request.eventId) return false
            if (request.callId && event.callId !== request.callId) return false
            if (!policy.canUse('events', event.eventId).allowed) return false
            return true
        })

        return {
            type: BrokerResultTypes.EVENTS_RESULT,
            requestId: request.requestId,
            status: 'ok',
            events,
        }
    }

    findEvent(request) {
        return this.events.find(event => {
            if (event.eventId !== request.eventId) return false
            if (request.callId && event.callId !== request.callId) return false
            return true
        }) ?? null
    }

    checkToolPolicy(request, tool) {
        const permission = this.checkCapabilityPolicy(request, 'tools', tool.id)
        if (!permission.allowed) return permission
        return {allowed: true, risk: tool.risk ?? 'low', approval: tool.approval ?? 'never'}
    }

    checkToolApproval(request, callId, tool) {
        const policy = this.getAgentPolicy(request?.agentId)
        return {
            ...policy.approvalDecision(tool),
            agentId: request?.agentId ?? null,
            callId,
            toolId: tool.id,
        }
    }

    createApprovalRequest(request, callId, tool, decision) {
        const createdAt = new Date()
        const approval = {
            approvalId: this.newApprovalId(),
            agentId: request?.agentId ?? null,
            requestId: request?.requestId,
            callId,
            toolId: tool.id,
            status: 'requested',
            reason: decision.reason,
            rule: decision.rule,
            risk: tool.risk ?? 'low',
            effects: deepFreeze(makeJsonSafe(Array.isArray(tool.effects) ? tool.effects : [])),
            request: deepFreeze({
                agentId: request?.agentId,
                requestId: request?.requestId,
                toolId: tool.id,
                args: makeJsonSafe(request?.args),
                wait: request?.wait,
                timeoutMs: request?.timeoutMs,
            }),
            createdAt: createdAt.toISOString(),
            expiresAt: new Date(createdAt.getTime() + this.approvalTtlMs).toISOString(),
        }
        this.approvalRequests.set(approval.approvalId, approval)
        this.trace.record({
            type: 'approval.requested',
            agentId: approval.agentId,
            requestId: approval.requestId,
            callId,
            toolId: tool.id,
            status: 'requested',
            details: approval,
        })
        this.publish({
            kind: 'approval.requested',
            agentId: approval.agentId,
            approval,
            timestamp: approval.createdAt,
        })
        return approval
    }

    checkCapabilityPolicy(request, kind, id) {
        const policy = this.getAgentPolicy(request?.agentId)
        return {
            ...policy.canUse(kind, id),
            agentId: request?.agentId ?? null,
            kind,
            capabilityId: id,
        }
    }

    getAgentPolicy(agentId) {
        if (!agentId) return new AgentPolicy({id: null, enabled: false})
        const agent = this.agents.get(agentId)
        if (!agent) return new AgentPolicy({id: agentId, enabled: false})
        agent.policy = AgentPolicy.fromAgent(agent)
        return agent.policy
    }

    identityDecision(agentId) {
        if (!agentId) return {allowed: false, reason: 'missing_identity'}
        const agent = this.agents.get(agentId)
        if (!agent) return {allowed: false, reason: 'unknown_identity'}
        if (agent.enabled === false || agent.config?.enabled === false) return {allowed: false, reason: 'agent_disabled'}
        return {allowed: true, reason: 'known_identity'}
    }

    effectiveWaitMode(requested, tool, target) {
        const verification = normalizeVerifyWith(tool)
        if (verification.events.length || verification.probes.length) return 'verified'
        if (target?.channel) return requested === 'verified' ? 'verified' : 'completed'
        return requested === 'verified' ? 'verified' : 'accepted'
    }

    validateArgs(kind, capabilityId, schema, args) {
        if (!schema) return {valid: true, kind, capabilityId, reason: 'no_schema'}
        const value = args ?? {}
        const validation = validateJsonSchema(schema, value)
        return {
            kind,
            capabilityId,
            schemaPresent: true,
            valid: validation.valid,
            errors: validation.errors,
            message: validation.valid ? 'Arguments are valid' : `Invalid ${kind} arguments for ${capabilityId}`,
        }
    }

    resolveInputTarget(input) {
        const actor = this.runtime.actors.find(candidate => candidate.name === input?.node)
        if (!actor) return null

        const hix = actor.rxSink.findIndex(rx => rx.pin === input?.pin)
        if (hix < 0) return null

        const rx = actor.rxSink[hix]
        return {
            actor,
            hix: HIX_HANDLER | hix,
            pin: rx.pin,
            channel: rx.channel,
        }
    }

    makeRuntimePayload(tool, request, callId) {
        if (tool?.input?.payload === 'ToolInvocation') {
            return {
                callId,
                tool: tool.id,
                arguments: request?.args ?? {},
            }
        }
        return request?.args
    }

    toolResult(request, callId, toolId, status, extra = {}) {
        const result = {
            type: BrokerResultTypes.TOOL_RESULT,
            requestId: request?.requestId,
            callId,
            toolId,
            status,
            ...extra,
        }

        this.trace.record({
            type: 'tool.result',
            agentId: request?.agentId,
            requestId: request?.requestId,
            callId,
            toolId,
            status,
            details: extra,
        })

        return this.emitResult(request, result)
    }

    toolError(request, callId, code, message, toolId = request?.toolId) {
        return this.toolResult(request, callId, toolId, ToolResultStatus.FAILED, {
            error: {code, message},
        })
    }

    newCallId() {
        return `call_${String(this.nextCallId++).padStart(6, '0')}`
    }

    newApprovalId() {
        return `approval_${String(this.nextApprovalId++).padStart(6, '0')}`
    }
}

function makeJsonSafe(value) {
    if (value == null) return value
    try {
        return JSON.parse(JSON.stringify(value))
    }
    catch {
        throw new Error('Probe returned a value that cannot be serialized as JSON')
    }
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
    for (const child of Object.values(value)) deepFreeze(child)
    return Object.freeze(value)
}

function stringifyProbeValue(value) {
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value, null, 2)
    }
    catch {
        return String(value)
    }
}

function normalizeVerifyWith(tool = {}) {
    const specs = []
    if (tool.verifyWith) specs.push(tool.verifyWith)
    for (const effect of tool.effects ?? []) {
        if (effect?.verifyWith) specs.push(effect.verifyWith)
    }

    const events = []
    const probes = []
    let timeoutMs = null
    for (const spec of specs) {
        if (Array.isArray(spec?.events)) events.push(...spec.events)
        if (Array.isArray(spec?.probes)) probes.push(...spec.probes)
        if (Number.isInteger(spec?.timeoutMs)) timeoutMs = timeoutMs == null ? spec.timeoutMs : Math.max(timeoutMs, spec.timeoutMs)
    }

    for (const effect of tool.effects ?? []) {
        if (Number.isInteger(effect?.timeoutMs)) timeoutMs = timeoutMs == null ? effect.timeoutMs : Math.max(timeoutMs, effect.timeoutMs)
    }

    return {
        events: events.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean),
        probes,
        timeoutMs,
    }
}
