import {HIX_HANDLER} from '../shared/target.js'
import {AgentRuntime} from './agent-runtime.js'
import {ToolBroker} from './tool-broker.js'
import {TraceRecorder} from './trace-recorder.js'

export class AgentRuntimeSupport {
    constructor(runtime) {
        this.runtime = runtime
    }

    configure({capabilities = null, traceRecorder = null, agent = null} = {}) {
        const runtime = this.runtime
        runtime.traceRecorder = traceRecorder ?? runtime.traceRecorder ?? new TraceRecorder()
        runtime.toolBroker = new ToolBroker({capabilities, traceRecorder: runtime.traceRecorder})
        runtime.toolBroker.attachRuntime(runtime)
        this.attachToolBrokerActor()
        this.wireToolBrokerEvents()
        this.registerNodeProbes()
        runtime.agent = null
        const selectedAgent = selectAgentConfig(agent)
        if (selectedAgent && selectedAgent.enabled !== false) {
            runtime.agent = new AgentRuntime({
                id: selectedAgent?.id,
                broker: runtime.toolBroker,
                config: selectedAgent ?? {},
            })
        }
        return runtime
    }

    stop() {
        this.runtime.agent?.unmountOverlay?.()
    }

    registerNodeProbes() {
        const runtime = this.runtime
        if (!runtime.toolBroker?.registry) return 0

        let count = 0
        for (const probe of runtime.toolBroker.registry.list().probes) {
            const binding = probe?.binding ?? {}
            const nodeName = binding.node
            if (!nodeName) continue

            const actor = runtime.actors.find(candidate => candidate.name === nodeName)
            if (!actor) continue

            runtime.toolBroker.registerProbe(probe.id, async (args, currentProbe) => {
                const probeFn = actor.cell?.probe
                if (typeof probeFn !== 'function') {
                    throw new Error(`Node ${nodeName} does not implement probe(name, args)`)
                }
                const probeName = currentProbe?.name || currentProbe?.id
                return probeFn.call(actor.cell, probeName, args ?? {})
            })
            count++
        }

        return count
    }

    attachToolBrokerActor() {
        const runtime = this.runtime
        if (!runtime.toolBroker?.actor) return null
        if (!runtime.actors.includes(runtime.toolBroker.actor)) runtime.actors.push(runtime.toolBroker.actor)
        return runtime.toolBroker.actor
    }

    wireToolBrokerEvents() {
        const runtime = this.runtime
        const brokerActor = runtime.toolBroker?.actor
        if (!brokerActor) return 0

        let count = 0
        for (const event of runtime.toolBroker.registry.list().events) {
            const source = event?.source
            if (!source?.node || !source?.pin) continue

            const actor = runtime.actors.find(candidate => candidate !== brokerActor && candidate.name === source.node)
            const tx = actor?.findTx?.(source.pin)
            if (!tx) continue

            const alreadyWired = tx.targets.some(target => target.actor === brokerActor && target.pin === 'event')
            if (alreadyWired) continue

            tx.targets.push({
                actor: brokerActor,
                hix: HIX_HANDLER | 0,
                pin: 'event',
                channel: false,
            })
            count++
        }

        return count
    }
}

function selectAgentConfig(agent) {
    if (!agent) return null
    if (Array.isArray(agent?.agents)) {
        return agent.agents.find(candidate => candidate?.id === agent.defaultAgent)
            ?? agent.agents.find(candidate => candidate?.enabled !== false)
            ?? agent.agents[0]
            ?? null
    }
    return agent
}
