import {HIX_HANDLER} from '../shared/target.js'
import {BrokerRequestTypes, BrokerResultTypes, ToolResultStatus, brokerError} from './broker-protocol.js'
import {CapabilityRegistry} from './capability-registry.js'
import {TraceRecorder} from './trace-recorder.js'

export class ToolBroker {
    constructor({runtime, capabilities, registry, traceRecorder} = {}) {
        this.runtime = null
        this.registry = registry ?? new CapabilityRegistry(capabilities)
        this.trace = traceRecorder ?? new TraceRecorder()
        this.probeReaders = new Map()
        this.events = []
        this.agents = new Map()
        this.listeners = new Map()
        this.nextCallId = 1
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
            flags: 0,
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
        this.agents.set(agent.id, agent)
        if (typeof agent.attachBroker === 'function') agent.attachBroker(this)
        this.trace.record({type: 'agent.registered', agentId: agent.id, status: 'ok'})
        return this
    }

    unregisterAgent(agentOrId) {
        const agentId = typeof agentOrId === 'string' ? agentOrId : agentOrId?.id
        if (!agentId) return false
        const removed = this.agents.delete(agentId)
        if (removed) this.trace.record({type: 'agent.unregistered', agentId, status: 'ok'})
        return removed
    }

    subscribe(agentId, listener) {
        if (typeof listener !== 'function') throw new Error('Broker listener must be a function')
        const key = agentId || '*'
        if (!this.listeners.has(key)) this.listeners.set(key, new Set())
        this.listeners.get(key).add(listener)
        return () => this.listeners.get(key)?.delete(listener)
    }

    publish(message) {
        if (!message) return message
        const targets = new Set(this.listeners.get('*') ?? [])
        if (message.agentId) {
            for (const listener of this.listeners.get(message.agentId) ?? []) targets.add(listener)
        }
        else {
            for (const [key, listeners] of this.listeners.entries()) {
                if (key === '*') continue
                for (const listener of listeners) targets.add(listener)
            }
        }
        for (const listener of targets) listener(message)
        return message
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
        this.publish({
            kind: 'event.observed',
            eventId,
            callId,
            payload,
            timestamp: event.timestamp,
        })
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

        return this.recordEvent(event.id, payload)
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
            default:
                return this.emitResult(request, brokerError(request, 'unknown_request', `Unknown broker request type: ${request?.type}`))
        }
    }

    listCapabilities(request = {}) {
        this.trace.record({
            type: 'capabilities.list',
            agentId: request.agentId,
            requestId: request.requestId,
            status: 'ok',
        })

        return {
            type: BrokerResultTypes.CAPABILITIES_RESULT,
            requestId: request.requestId,
            capabilities: this.registry.list(),
        }
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

        if (!tool) return this.toolError(request, callId, 'unknown_tool', `Unknown tool: ${request?.toolId}`)
        if (!this.runtime) return this.toolError(request, callId, 'runtime_not_attached', 'ToolBroker is not attached to a runtime', tool.id)

        const policy = this.checkPolicy(tool)
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
                error: {code: 'denied', message: policy.reason},
            })
        }

        const target = this.resolveInputTarget(tool.input)
        if (!target) return this.toolError(request, callId, 'target_not_found', `No runtime target for ${tool.input?.ref}`)

        try {
            const wait = request.wait ?? 'accepted'
            const timeout = request.timeoutMs ?? tool.timeoutMs ?? 0
            const tx = this.makeRuntimeTx(tool.input.pin, target)
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

            if (wait === 'none' || wait === 'accepted' || !target.channel) {
                this.runtime.sendTo(tx, this.source, payload)
                return this.toolResult(request, callId, tool.id, ToolResultStatus.ACCEPTED)
            }

            const reply = await this.runtime.requestFrom(tx, this.source, payload, timeout)
            return this.toolResult(request, callId, tool.id, ToolResultStatus.COMPLETED, {result: reply})
        }
        catch (error) {
            return this.toolError(request, callId, 'dispatch_failed', error?.message || String(error), tool.id)
        }
    }

    async readProbe(request) {
        const probe = this.registry.getProbe(request?.probeId)
        if (!probe) {
            return this.emitResult(request, {
                type: BrokerResultTypes.PROBE_RESULT,
                requestId: request?.requestId,
                probeId: request?.probeId,
                status: 'failed',
                error: {code: 'unknown_probe', message: `Unknown probe: ${request?.probeId}`},
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
        const events = this.events.filter(event => {
            if (request.eventId && event.eventId !== request.eventId) return false
            if (request.callId && event.callId !== request.callId) return false
            return true
        })

        return {
            type: BrokerResultTypes.EVENTS_RESULT,
            requestId: request.requestId,
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

    checkPolicy(tool) {
        if (tool.approval === 'always') {
            return {allowed: false, reason: 'approval_required'}
        }
        return {allowed: true, risk: tool.risk ?? 'low', approval: tool.approval ?? 'never'}
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

    makeRuntimeTx(pin, target) {
        return {
            pin,
            channel: target.channel,
            targets: [target],
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

function stringifyProbeValue(value) {
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value, null, 2)
    }
    catch {
        return String(value)
    }
}
