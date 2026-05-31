import {BrokerRequestTypes} from './broker-protocol.js'
import {AgentOverlay} from './agent-overlay.js'
import {OpenAIChatProvider} from './openai-chat-provider.js'
import {OpenAIAgentAdapter} from '../agent-adapters/openai-adapter.js'

const DEFAULT_MAX_TOOL_ROUNDS = 4

export class AgentRuntime {
    constructor({id, broker = null, provider = null, config = {}} = {}) {
        this.id = id ?? config?.id ?? 'mainAssistant'
        this.config = this.normalizeConfig(config)
        this.llm = this.config.llm ?? {}
        this.provider = provider ?? this.createProvider()
        this.broker = null
        this.messages = []
        this.transcript = []
        this.recentEvents = []
        this.turnQueue = Promise.resolve()
        this.listeners = new Set()
        this.nextRequestId = 1
        this.overlay = null

        this.tools = {
            call: (toolId, args = {}, options = {}) => this.callTool(toolId, args, options),
        }
        this.probes = {
            read: (probeId, args = {}, options = {}) => this.readProbe(probeId, args, options),
        }
        this.events = {
            waitFor: (eventId, options = {}) => this.waitForEvent(eventId, options),
            query: (options = {}) => this.queryEvents(options),
        }
        this.approvals = {
            approve: (approvalId, options = {}) => this.resolveApproval(approvalId, true, options),
            deny: (approvalId, options = {}) => this.resolveApproval(approvalId, false, options),
        }

        if (broker) broker.registerAgent(this)
        this.mountConfiguredOverlay()
    }

    normalizeConfig(config = {}) {
        const normalized = {...(config ?? {})}
        if (!normalized.llm && (normalized.provider || normalized.model || normalized.endpoint)) {
            normalized.llm = {
                provider: normalized.provider,
                model: normalized.model,
                endpoint: normalized.endpoint,
            }
            delete normalized.provider
            delete normalized.model
            delete normalized.endpoint
        }
        return normalized
    }

    createProvider() {
        if (this.llm?.provider === 'openai' || this.llm?.endpoint) {
            return new OpenAIChatProvider({llm: this.llm})
        }
        return null
    }

    attachBroker(broker) {
        if (this.unsubscribeBroker) this.unsubscribeBroker()
        this.broker = broker
        this.unsubscribeBroker = broker.subscribe(this.id, message => this.receive(message))
        this.mountConfiguredOverlay()
        return this
    }

    mountConfiguredOverlay() {
        if (this.overlay || this.config?.ui?.mode !== 'overlay') return this.overlay
        if (typeof document === 'undefined') return null

        this.overlay = new AgentOverlay({
            agent: this,
            broker: this.broker,
            traceRecorder: this.broker?.trace,
            config: this.config,
        })
        this.overlay.mount()
        return this.overlay
    }

    unmountOverlay() {
        this.overlay?.unmount()
        this.overlay = null
    }

    receive(message) {
        this.messages.push(message)
        if (message?.kind === 'event.observed') this.recordAppEvent(message)
        for (const listener of this.listeners) listener(message)
        return message
    }

    publish(message) {
        this.messages.push(message)
        if (message?.kind === 'event.observed') this.recordAppEvent(message)
        for (const listener of this.listeners) listener(message)
        return message
    }

    recordAppEvent(message) {
        this.recentEvents.push({
            eventId: message.eventId,
            callId: message.callId,
            payload: makeJsonSafe(message.payload),
            timestamp: message.timestamp ?? new Date().toISOString(),
        })
        this.recentEvents = this.recentEvents.slice(-20)
    }

    subscribe(listener) {
        if (typeof listener !== 'function') throw new Error('Agent listener must be a function')
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    nextRequestIdValue() {
        return `req_${String(this.nextRequestId++).padStart(6, '0')}`
    }

    request(message) {
        if (!this.broker) throw new Error(`Agent ${this.id} is not attached to a broker`)
        return this.broker.handle({
            ...message,
            agentId: this.id,
            requestId: message?.requestId ?? this.nextRequestIdValue(),
        })
    }

    listCapabilities(options = {}) {
        return this.request({
            type: BrokerRequestTypes.CAPABILITIES_LIST,
            ...options,
        })
    }

    callTool(toolId, args = {}, options = {}) {
        return this.request({
            type: BrokerRequestTypes.TOOL_CALL,
            toolId,
            args,
            ...options,
        })
    }

    readProbe(probeId, args = {}, options = {}) {
        return this.request({
            type: BrokerRequestTypes.PROBE_READ,
            probeId,
            args,
            ...options,
        })
    }

    waitForEvent(eventId, options = {}) {
        return this.request({
            type: BrokerRequestTypes.EVENT_WAIT,
            eventId,
            ...options,
        })
    }

    queryEvents(options = {}) {
        return this.request({
            type: BrokerRequestTypes.EVENTS_QUERY,
            ...options,
        })
    }

    resolveApproval(approvalId, approved, options = {}) {
        return this.request({
            type: BrokerRequestTypes.APPROVAL_RESOLVE,
            approvalId,
            approved,
            ...options,
        })
    }

    submitUserMessage(text, options = {}) {
        const userText = String(text ?? '').trim()
        if (!userText) return Promise.resolve({role: 'assistant', content: ''})

        const turn = this.turnQueue
            .catch(() => null)
            .then(() => this.runTurn(userText, options))
        this.turnQueue = turn
        return turn
    }

    async runTurn(text) {
        this.trace({
            type: 'chat.user',
            status: 'received',
            details: {text},
        })

        if (!this.provider?.complete) {
            const content = 'No LLM provider adapter is configured for this agent.'
            this.addTranscriptMessage({role: 'user', content: text})
            this.addTranscriptMessage({role: 'assistant', content})
            this.publish({kind: 'chat.assistant', agentId: this.id, content, timestamp: new Date().toISOString()})
            return {role: 'assistant', content}
        }

        this.addTranscriptMessage({role: 'user', content: text})

        const tools = this.buildOpenAICapabilityTools()
        const messages = this.buildProviderMessages()
        const maxToolRounds = this.config?.limits?.maxToolCallsPerTurn ?? DEFAULT_MAX_TOOL_ROUNDS

        try {
            for (let round = 0; round <= maxToolRounds; round += 1) {
                this.trace({
                    type: 'llm.request',
                    status: 'sending',
                    details: {provider: this.llm?.provider, model: this.llm?.model, toolCount: tools.length, round},
                })

                const payload = await this.provider.complete({messages, tools})
                const choice = payload?.choices?.[0]
                const assistantMessage = choice?.message ?? {}
                const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : []

                this.trace({
                    type: 'llm.response',
                    status: 'received',
                    details: {finishReason: choice?.finish_reason, toolCallCount: toolCalls.length},
                })

                messages.push({
                    role: 'assistant',
                    content: assistantMessage.content ?? '',
                    ...(toolCalls.length ? {tool_calls: toolCalls} : {}),
                })

                if (!toolCalls.length) {
                    const content = assistantMessage.content || 'No text response.'
                    this.addTranscriptMessage({role: 'assistant', content})
                    this.publish({kind: 'chat.assistant', agentId: this.id, content, timestamp: new Date().toISOString()})
                    return {role: 'assistant', content, raw: payload}
                }

                if (round === maxToolRounds) {
                    const content = 'The model requested more tool calls than this agent turn allows.'
                    this.addTranscriptMessage({role: 'assistant', content})
                    this.publish({kind: 'chat.assistant', agentId: this.id, content, timestamp: new Date().toISOString()})
                    return {role: 'assistant', content, raw: payload}
                }

                for (const toolCall of toolCalls) {
                    const result = await this.executeOpenAIToolCall(toolCall)
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result),
                    })
                }
            }
        }
        catch (error) {
            const content = `LLM request failed: ${error?.message || String(error)}`
            this.trace({
                type: 'llm.error',
                status: 'failed',
                details: {message: error?.message || String(error)},
            })
            this.addTranscriptMessage({role: 'assistant', content})
            this.publish({kind: 'chat.assistant', agentId: this.id, content, timestamp: new Date().toISOString()})
            return {role: 'assistant', content, error}
        }
    }

    buildProviderMessages() {
        return [
            {role: 'system', content: this.buildSystemPrompt()},
            ...this.transcript.map(message => ({role: message.role, content: message.content})),
        ]
    }

    buildSystemPrompt() {
        const capabilities = this.broker?.capabilityView?.(this.id) ?? this.broker?.registry?.list?.()
        const usage = capabilities?.usageGuidance
        const guidance = Array.isArray(usage?.rules) ? usage.rules.join('\n') : ''
        return [
            this.config?.instructions || 'Help the user operate this vmblu application through the published tools.',
            'When an app action is needed, call a provided tool instead of inventing state changes.',
            this.formatRecentEventsForPrompt(),
            guidance,
        ].filter(Boolean).join('\n\n')
    }

    formatRecentEventsForPrompt() {
        if (!this.recentEvents.length) return ''
        const lines = this.recentEvents.slice(-8).map(event => {
            const payload = compactJson(event.payload, 700)
            return `- ${event.eventId}${event.callId ? ` (${event.callId})` : ''}: ${payload}`
        })
        return `Recent app events:\n${lines.join('\n')}`
    }

    addTranscriptMessage(message) {
        this.transcript.push(message)
        this.transcript = this.transcript.slice(-30)
    }

    buildOpenAICapabilityTools() {
        const capabilities = this.broker?.capabilityView?.(this.id) ?? this.broker?.registry?.list?.() ?? {}
        const projection = new OpenAIAgentAdapter({capabilities, agent: this.config}).project()
        this.openAICapabilityMap = projection.map
        return projection.tools
    }

    async executeOpenAIToolCall(toolCall) {
        const name = toolCall?.function?.name
        const mapped = this.openAICapabilityMap?.get(name)
        const args = parseToolArguments(toolCall?.function?.arguments)

        this.trace({
            type: 'llm.tool_call',
            status: 'requested',
            toolId: mapped?.capability?.id,
            callId: toolCall?.id,
            details: {name, args},
        })

        if (!mapped) {
            return {
                ok: false,
                error: {code: 'unknown_tool', message: `Unknown model tool call: ${name}`},
            }
        }

        if (mapped.kind === 'probe') {
            const result = await this.readProbe(mapped.capability.id, args)
            return {
                ok: !result?.error,
                probeId: mapped.capability.id,
                status: result?.status,
                result,
            }
        }

        const result = await this.callTool(mapped.capability.id, args)
        return {
            ok: !result?.error,
            toolId: mapped.capability.id,
            status: result?.status,
            result,
        }
    }

    trace(entry) {
        return this.broker?.trace?.record?.({
            agentId: this.id,
            ...entry,
        })
    }
}

function parseToolArguments(value) {
    if (!value) return {}
    if (typeof value === 'object') return value
    try {
        return JSON.parse(value)
    }
    catch {
        return {}
    }
}

function makeJsonSafe(value) {
    if (value == null) return value
    try {
        return JSON.parse(JSON.stringify(value))
    }
    catch {
        return String(value)
    }
}

function compactJson(value, limit = 700) {
    let text = ''
    try {
        text = typeof value === 'string' ? value : JSON.stringify(value)
    }
    catch {
        text = String(value)
    }
    return text.length > limit ? `${text.slice(0, limit)}...` : text
}
