import test from 'node:test'
import assert from 'node:assert/strict'
import {Runtime} from '../rt-agent/runtime.js'
import {Runtime as BrowserAgentRuntime} from '../rt-browser-agent/runtime.js'

function waitFor(predicate, timeoutMs = 1000) {
    const start = Date.now()

    return new Promise((resolve, reject) => {
        const tick = () => {
            const value = predicate()
            if (value) return resolve(value)
            if ((Date.now() - start) > timeoutMs) return reject(new Error('Timed out waiting for condition'))
            setTimeout(tick, 10)
        }

        tick()
    })
}

test('rt-agent wires broker, agent shell, tool dispatch, and event capture', async () => {
    let received = null

    function SourceFactory(tx) {
        return {
            emit() {
                tx.send('tick', {value: 7})
            }
        }
    }

    function SinkFactory() {
        return {
            onSet(param) {
                received = param
            }
        }
    }

    const capabilities = {
        schema: 'https://vmblu.dev/schemas/capabilities.v1.json',
        version: 1,
        application: {id: 'test', title: 'Test'},
        tools: [
            {
                id: 'set @ Sink',
                input: {node: 'Sink', pin: 'set', ref: 'set@Sink', schema: {type: 'object'}},
                risk: 'low',
                approval: 'never',
            }
        ],
        probes: [],
        events: [
            {
                id: 'tick @ Source',
                source: {node: 'Source', pin: 'tick', ref: 'tick@Source'},
                schema: {type: 'object'},
            }
        ],
    }

    const runtime = new Runtime([
        {
            name: 'Source',
            uid: 'source',
            factory: SourceFactory,
            inputs: [],
            outputs: ['tick -> ()'],
        },
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set'],
            outputs: [],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        assert.ok(runtime.toolBroker)
        assert.ok(runtime.agent)
        assert.equal(runtime.agent.broker, runtime.toolBroker)

        const result = await runtime.agent.tools.call('set @ Sink', {value: 3})
        assert.equal(result.status, 'accepted')

        await waitFor(() => received)
        assert.deepEqual(received, {value: 3})

        runtime.actors.find(actor => actor.name === 'Source').cell.emit()

        const event = await waitFor(() => runtime.toolBroker.events.find(item => item.eventId === 'tick @ Source'))
        assert.deepEqual(event.payload, {value: 7})

        const agentEvent = await waitFor(() => runtime.agent.recentEvents.find(item => item.eventId === 'tick @ Source'))
        assert.deepEqual(agentEvent.payload, {value: 7})
    } finally {
        runtime.stop()
    }
})

test('recent app events are included in the next provider turn', async () => {
    const requests = []

    function SourceFactory(tx) {
        return {
            emit() {
                tx.send('changed', {cameraId: 'follow-saturn'})
            }
        }
    }

    const provider = {
        async complete(request) {
            requests.push({
                ...request,
                messages: request.messages.map(message => ({...message})),
            })
            return {
                choices: [
                    {
                        message: {role: 'assistant', content: 'I saw the recent camera event.'},
                        finish_reason: 'stop',
                    }
                ],
            }
        },
    }

    const capabilities = {
        tools: [],
        probes: [],
        events: [
            {
                id: 'camera.active',
                source: {node: 'Source', pin: 'changed', ref: 'changed@Source'},
                schema: {type: 'object'},
            }
        ],
    }

    const runtime = new Runtime([
        {
            name: 'Source',
            uid: 'source',
            factory: SourceFactory,
            inputs: [],
            outputs: ['changed -> ()'],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        runtime.agent.provider = provider
        runtime.actors.find(actor => actor.name === 'Source').cell.emit()
        await waitFor(() => runtime.agent.recentEvents.length)

        const reply = await runtime.agent.submitUserMessage('What changed?')
        assert.equal(reply.content, 'I saw the recent camera event.')

        const system = requests[0].messages.find(message => message.role === 'system')?.content ?? ''
        assert.match(system, /Recent app events/)
        assert.match(system, /camera\.active/)
        assert.match(system, /follow-saturn/)
    } finally {
        runtime.stop()
    }
})

test('agent chat turn calls provider and routes tool calls through broker', async () => {
    let received = null
    const requests = []

    function SinkFactory() {
        return {
            onSet(param) {
                received = param
            }
        }
    }

    const capabilities = {
        tools: [
            {
                id: 'set @ Sink',
                description: 'Set the sink value.',
                input: {node: 'Sink', pin: 'set', ref: 'set@Sink', schema: {type: 'object'}},
                risk: 'low',
                approval: 'never',
            }
        ],
        probes: [],
        events: [],
    }

    const provider = {
        async complete(request) {
            requests.push({
                ...request,
                messages: request.messages.map(message => ({...message})),
            })
            if (requests.length === 1) {
                return {
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: '',
                                tool_calls: [
                                    {
                                        id: 'tool_call_1',
                                        type: 'function',
                                        function: {
                                            name: 'tool_set_Sink_1',
                                            arguments: JSON.stringify({value: 11}),
                                        },
                                    }
                                ],
                            },
                            finish_reason: 'tool_calls',
                        }
                    ],
                }
            }
            return {
                choices: [
                    {
                        message: {role: 'assistant', content: 'The sink value was updated.'},
                        finish_reason: 'stop',
                    }
                ],
            }
        },
    }

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set'],
            outputs: [],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        runtime.agent.provider = provider
        const reply = await runtime.agent.submitUserMessage('Set it to eleven')

        assert.equal(reply.content, 'The sink value was updated.')
        assert.equal(requests.length, 2)
        assert.equal(requests[0].tools[0].function.name, 'tool_set_Sink_1')
        assert.equal(requests[1].messages.at(-1).role, 'tool')

        await waitFor(() => received)
        assert.deepEqual(received, {value: 11})
    } finally {
        runtime.stop()
    }
})

test('broker wraps calls for ToolInvocation target pins', async () => {
    let invocation = null

    function RouterFactory() {
        return {
            onCmdTool(param) {
                invocation = param
            }
        }
    }

    const capabilities = {
        tools: [
            {
                id: 'camera_control',
                input: {
                    node: 'Router',
                    pin: 'cmd.tool',
                    ref: 'cmd.tool@Router',
                    payload: 'ToolInvocation',
                    schema: {type: 'object'},
                },
                risk: 'low',
                approval: 'never',
            }
        ],
        probes: [],
        events: [],
    }

    const runtime = new Runtime([
        {
            name: 'Router',
            uid: 'router',
            factory: RouterFactory,
            inputs: ['-> cmd.tool'],
            outputs: [],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        const result = await runtime.agent.tools.call('camera_control', {action: 'follow-body', bodyId: 'saturn'})
        assert.equal(result.status, 'accepted')

        await waitFor(() => invocation)
        assert.equal(invocation.tool, 'camera_control')
        assert.deepEqual(invocation.arguments, {action: 'follow-body', bodyId: 'saturn'})
        assert.ok(invocation.callId)
    } finally {
        runtime.stop()
    }
})

test('rt-agent auto-registers published node probes', async () => {
    function StateFactory() {
        return {
            probe(name, args) {
                if (name !== 'state.current') return null
                return {
                    name,
                    filter: args?.filter ?? null,
                    nested: {ok: true},
                }
            }
        }
    }

    const capabilities = {
        tools: [],
        probes: [
            {
                id: 'state.current',
                name: 'state.current',
                title: 'Current state',
                description: 'Returns current state.',
                kind: 'state',
                schema: {type: 'object'},
                binding: {kind: 'node', node: 'State'},
            }
        ],
        events: [],
    }

    const runtime = new Runtime([
        {
            name: 'State',
            uid: 'state',
            factory: StateFactory,
            inputs: [],
            outputs: [],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        const result = await runtime.agent.probes.read('state.current', {filter: 'small'})

        assert.equal(result.status, 'ok')
        assert.deepEqual(result.value, {
            name: 'state.current',
            filter: 'small',
            nested: {ok: true},
        })
        assert.equal(typeof result.text, 'string')
        assert.match(result.text, /state\.current/)
    } finally {
        runtime.stop()
    }
})

test('agent chat can route provider probe calls through broker', async () => {
    const requests = []

    function StateFactory() {
        return {
            probe(name) {
                if (name === 'state.current') return {ready: true}
                return null
            }
        }
    }

    const capabilities = {
        tools: [],
        probes: [
            {
                id: 'state.current',
                name: 'state.current',
                title: 'Current state',
                description: 'Returns current state.',
                kind: 'state',
                schema: {type: 'object'},
                binding: {kind: 'node', node: 'State'},
            }
        ],
        events: [],
    }

    const provider = {
        async complete(request) {
            requests.push({
                ...request,
                messages: request.messages.map(message => ({...message})),
            })
            if (requests.length === 1) {
                return {
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: '',
                                tool_calls: [
                                    {
                                        id: 'probe_call_1',
                                        type: 'function',
                                        function: {
                                            name: 'probe_state_current_1',
                                            arguments: '{}',
                                        },
                                    }
                                ],
                            },
                            finish_reason: 'tool_calls',
                        }
                    ],
                }
            }
            return {
                choices: [
                    {
                        message: {role: 'assistant', content: 'The app is ready.'},
                        finish_reason: 'stop',
                    }
                ],
            }
        },
    }

    const runtime = new Runtime([
        {
            name: 'State',
            uid: 'state',
            factory: StateFactory,
            inputs: [],
            outputs: [],
        },
    ], {
        capabilities,
        agent: {id: 'mainAssistant', enabled: true},
    })

    runtime.start()

    try {
        runtime.agent.provider = provider
        const reply = await runtime.agent.submitUserMessage('Check readiness')

        assert.equal(reply.content, 'The app is ready.')
        assert.equal(requests[0].tools[0].function.name, 'probe_state_current_1')
        const toolMessage = requests[1].messages.find(message => message.role === 'tool')
        assert.ok(toolMessage)
        assert.match(toolMessage.content, /state\.current/)
        assert.match(toolMessage.content, /ready/)
    } finally {
        runtime.stop()
    }
})

test('rt-browser-agent wires broker and dispatches tools without ALS runtime', async () => {
    let received = null

    function SinkFactory() {
        return {
            onSet(param) {
                received = param
            }
        }
    }

    const runtime = new BrowserAgentRuntime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set'],
            outputs: [],
        },
    ], {
        capabilities: {
            tools: [
                {
                    id: 'set @ Sink',
                    input: {node: 'Sink', pin: 'set', ref: 'set@Sink', schema: {type: 'object'}},
                    risk: 'low',
                    approval: 'never',
                }
            ],
            probes: [],
            events: [],
        },
        agent: {id: 'browserAssistant', enabled: true},
    })

    runtime.start()

    try {
        assert.ok(runtime.toolBroker)
        assert.ok(runtime.agent)
        assert.equal(runtime.agent.broker, runtime.toolBroker)

        const result = await runtime.agent.tools.call('set @ Sink', {value: 23})
        assert.equal(result.status, 'accepted')

        await waitFor(() => received)
        assert.deepEqual(received, {value: 23})
    } finally {
        runtime.stop()
    }
})

test('rt-agent selects default agent from multi-agent config', async () => {
    const runtime = new Runtime([], {
        capabilities: {
            tools: [
                {id: 'operator_tool', input: {node: 'None', pin: 'none', schema: {type: 'object'}}, approval: 'never'},
                {id: 'observer_tool', input: {node: 'None', pin: 'none', schema: {type: 'object'}}, approval: 'never'},
            ],
            probes: [],
            events: [],
        },
        agent: {
            version: 1,
            defaultAgent: 'observer',
            agents: [
                {
                    id: 'operator',
                    enabled: true,
                    permissions: {
                        tools: {allow: ['operator_tool'], deny: []},
                        probes: {allow: [], deny: []},
                        events: {allow: [], deny: []},
                    },
                },
                {
                    id: 'observer',
                    enabled: true,
                    permissions: {
                        tools: {allow: ['observer_tool'], deny: []},
                        probes: {allow: [], deny: []},
                        events: {allow: [], deny: []},
                    },
                },
            ],
        },
    })

    runtime.start()

    try {
        assert.equal(runtime.agent.id, 'observer')
        const capabilities = await runtime.agent.listCapabilities()
        assert.deepEqual(capabilities.capabilities.tools.map(tool => tool.id), ['observer_tool'])
    } finally {
        runtime.stop()
    }
})

test('broker filters capabilities and denies tool, probe, and event access by agent policy', async () => {
    let received = null

    function SourceFactory(tx) {
        return {
            emit() {
                tx.send('visible', {ok: true})
                tx.send('hidden', {secret: true})
            }
        }
    }

    function SinkFactory() {
        return {
            onSet(param) {
                received = param
            },
            onReset() {},
            probe(name) {
                return {name}
            }
        }
    }

    const runtime = new Runtime([
        {
            name: 'Source',
            uid: 'source',
            factory: SourceFactory,
            inputs: [],
            outputs: ['visible -> ()', 'hidden -> ()'],
        },
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set', '-> reset'],
            outputs: [],
        },
    ], {
        capabilities: {
            tools: [
                {id: 'set', input: {node: 'Sink', pin: 'set', schema: {type: 'object'}}, approval: 'never'},
                {id: 'reset', input: {node: 'Sink', pin: 'reset', schema: {type: 'object'}}, approval: 'never'},
            ],
            probes: [
                {id: 'state.visible', name: 'state.visible', schema: {type: 'object'}, binding: {kind: 'node', node: 'Sink'}},
                {id: 'state.hidden', name: 'state.hidden', schema: {type: 'object'}, binding: {kind: 'node', node: 'Sink'}},
            ],
            events: [
                {id: 'visible.event', source: {node: 'Source', pin: 'visible'}, schema: {type: 'object'}},
                {id: 'hidden.event', source: {node: 'Source', pin: 'hidden'}, schema: {type: 'object'}},
            ],
        },
        agent: {
            id: 'operator',
            enabled: true,
            permissions: {
                tools: {allow: ['set'], deny: ['reset']},
                probes: {allow: ['state.visible']},
                events: {allow: ['visible.event']},
            },
        },
    })

    runtime.start()

    try {
        const capabilities = await runtime.agent.listCapabilities()
        assert.deepEqual(capabilities.capabilities.tools.map(tool => tool.id), ['set'])
        assert.deepEqual(capabilities.capabilities.probes.map(probe => probe.id), ['state.visible'])
        assert.deepEqual(capabilities.capabilities.events.map(event => event.id), ['visible.event'])

        const deniedTool = await runtime.agent.tools.call('reset', {})
        assert.equal(deniedTool.status, 'denied')
        assert.equal(deniedTool.error.code, 'denied')

        const deniedProbe = await runtime.agent.probes.read('state.hidden', {})
        assert.equal(deniedProbe.status, 'denied')

        const deniedEvent = await runtime.agent.events.waitFor('hidden.event', {timeoutMs: 10})
        assert.equal(deniedEvent.status, 'denied')

        const allowed = await runtime.agent.tools.call('set', {value: 41})
        assert.equal(allowed.status, 'accepted')
        await waitFor(() => received)
        assert.deepEqual(received, {value: 41})

        const policyTrace = runtime.traceRecorder.all().find(record => record.type === 'policy.decision' && record.toolId === 'reset')
        assert.equal(policyTrace.status, 'denied')
    } finally {
        runtime.stop()
    }
})

test('broker validates tool and probe arguments before dispatch', async () => {
    let received = null

    function SinkFactory() {
        return {
            onSet(param) {
                received = param
            },
            probe(name, args) {
                return {name, args}
            }
        }
    }

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set'],
            outputs: [],
        },
    ], {
        capabilities: {
            tools: [
                {
                    id: 'set',
                    input: {
                        node: 'Sink',
                        pin: 'set',
                        schema: {
                            type: 'object',
                            required: ['value'],
                            properties: {value: {type: 'number'}},
                            additionalProperties: false,
                        },
                    },
                    approval: 'never',
                },
            ],
            probes: [
                {
                    id: 'state.current',
                    name: 'state.current',
                    argsSchema: {
                        type: 'object',
                        properties: {filter: {enum: ['small', 'large']}},
                        additionalProperties: false,
                    },
                    binding: {kind: 'node', node: 'Sink'},
                },
            ],
            events: [],
        },
        agent: {id: 'operator', enabled: true},
    })

    runtime.start()

    try {
        const invalidTool = await runtime.agent.tools.call('set', {value: 'bad'})
        assert.equal(invalidTool.status, 'failed')
        assert.equal(invalidTool.error.code, 'invalid_args')
        assert.equal(received, null)

        const invalidProbe = await runtime.agent.probes.read('state.current', {filter: 'medium'})
        assert.equal(invalidProbe.status, 'failed')
        assert.equal(invalidProbe.error.code, 'invalid_args')

        const validProbe = await runtime.agent.probes.read('state.current', {filter: 'small'})
        assert.equal(validProbe.status, 'ok')
        assert.deepEqual(validProbe.value.args, {filter: 'small'})

        const validationTrace = runtime.traceRecorder.all().find(record => record.type === 'validation.decision' && record.toolId === 'set')
        assert.equal(validationTrace.status, 'failed')
    } finally {
        runtime.stop()
    }
})

test('broker can approve and execute a tool that requires approval', async () => {
    let received = null

    function SinkFactory() {
        return {
            onDelete(param) {
                received = param
            }
        }
    }

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> delete'],
            outputs: [],
        },
    ], {
        capabilities: {
            tools: [
                {
                    id: 'delete_document',
                    input: {
                        node: 'Sink',
                        pin: 'delete',
                        schema: {
                            type: 'object',
                            required: ['documentId'],
                            properties: {documentId: {type: 'string'}},
                            additionalProperties: false,
                        },
                    },
                    risk: 'high',
                    approval: 'always',
                },
            ],
            probes: [],
            events: [],
        },
        agent: {id: 'operator', enabled: true},
    })

    runtime.start()

    try {
        const result = await runtime.agent.tools.call('delete_document', {documentId: 'doc-1'})

        assert.equal(result.status, 'pending')
        assert.equal(received, null)
        assert.equal(runtime.toolBroker.approvalRequests.size, 1)

        const approval = [...runtime.toolBroker.approvalRequests.values()][0]
        assert.equal(approval.toolId, 'delete_document')
        assert.equal(approval.status, 'requested')

        const agentMessage = runtime.agent.messages.find(message => message.kind === 'approval.requested')
        assert.equal(agentMessage.approval.approvalId, approval.approvalId)

        const trace = runtime.traceRecorder.all().find(record => record.type === 'approval.requested')
        assert.equal(trace.status, 'requested')

        const approved = await runtime.agent.approvals.approve(approval.approvalId)
        assert.equal(approved.status, 'accepted')
        assert.equal(approval.status, 'approved')

        await waitFor(() => received)
        assert.deepEqual(received, {documentId: 'doc-1'})
    } finally {
        runtime.stop()
    }
})

test('broker verifies a tool call with event and probe evidence', async () => {
    let current = null

    function AppFactory(tx) {
        return {
            onUpdateTool(param) {
                current = param.arguments
                tx.send('changed', {callId: param.callId, value: current.value})
            },
            probe(name) {
                if (name === 'state.current') return current
                return null
            }
        }
    }

    const runtime = new Runtime([
        {
            name: 'App',
            uid: 'app',
            factory: AppFactory,
            inputs: ['-> update.tool'],
            outputs: ['changed -> ()'],
        },
    ], {
        capabilities: {
            tools: [
                {
                    id: 'update',
                    input: {
                        node: 'App',
                        pin: 'update.tool',
                        payload: 'ToolInvocation',
                        schema: {
                            type: 'object',
                            required: ['value'],
                            properties: {value: {type: 'number'}},
                        },
                    },
                    approval: 'never',
                    verifyWith: {
                        events: ['app.changed'],
                        probes: [{id: 'state.current'}],
                    },
                },
            ],
            probes: [
                {
                    id: 'state.current',
                    name: 'state.current',
                    binding: {kind: 'node', node: 'App'},
                    schema: {
                        type: 'object',
                        required: ['value'],
                        properties: {value: {type: 'number'}},
                    },
                },
            ],
            events: [
                {
                    id: 'app.changed',
                    source: {node: 'App', pin: 'changed'},
                    schema: {type: 'object'},
                },
            ],
        },
        agent: {id: 'operator', enabled: true},
    })

    runtime.start()

    try {
        const result = await runtime.agent.tools.call('update', {value: 9}, {wait: 'verified', timeoutMs: 500})

        assert.equal(result.status, 'verified')
        assert.equal(result.verification.status, 'verified')
        assert.deepEqual(result.verification.evidence.probes[0].value, {value: 9})
        assert.equal(result.verification.evidence.events[0].status, 'observed')

        const trace = runtime.traceRecorder.all().find(record => record.type === 'verification.decision')
        assert.equal(trace.status, 'verified')
    } finally {
        runtime.stop()
    }
})
