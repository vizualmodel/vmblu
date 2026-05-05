import test from 'node:test'
import assert from 'node:assert/strict'
import {scaffold} from '../rt-agent/scaffold.js'

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

    const runtime = scaffold([
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
    ], [], {
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

    const runtime = scaffold([
        {
            name: 'Source',
            uid: 'source',
            factory: SourceFactory,
            inputs: [],
            outputs: ['changed -> ()'],
        },
    ], [], {
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

    const runtime = scaffold([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> set'],
            outputs: [],
        },
    ], [], {
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

    const runtime = scaffold([
        {
            name: 'Router',
            uid: 'router',
            factory: RouterFactory,
            inputs: ['-> cmd.tool'],
            outputs: [],
        },
    ], [], {
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

    const runtime = scaffold([
        {
            name: 'State',
            uid: 'state',
            factory: StateFactory,
            inputs: [],
            outputs: [],
        },
    ], [], {
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

    const runtime = scaffold([
        {
            name: 'State',
            uid: 'state',
            factory: StateFactory,
            inputs: [],
            outputs: [],
        },
    ], [], {
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
