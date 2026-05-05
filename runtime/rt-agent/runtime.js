export {rtFlags} from '../shared/runtime.js'
export {Runtime}

import {createRuntime} from '../shared/runtime.js'
import {runAsNode} from './node-context.js'
import {HIX_HANDLER} from '../shared/target.js'
import {ToolBroker} from './tool-broker.js'
import {TraceRecorder} from './trace-recorder.js'
import {AgentRuntime} from './agent-runtime.js'

const Runtime = createRuntime({
    invokeHandler(dest, hix, param) {
        return runAsNode(dest.name, () => dest.rxSink[hix].handler.call(dest.cell, param))
    }
})

const baseStop = Runtime.prototype.stop

Runtime.prototype.configureAgentRuntime = function configureAgentRuntime({capabilities = null, traceRecorder = null, agent = null} = {}) {
    this.traceRecorder = traceRecorder ?? this.traceRecorder ?? new TraceRecorder()
    this.toolBroker = new ToolBroker({capabilities, traceRecorder: this.traceRecorder})
    this.toolBroker.attachRuntime(this)
    this.attachToolBrokerActor()
    this.wireToolBrokerEvents()
    this.registerNodeProbes()
    this.agent = null
    if (agent && agent.enabled !== false) {
        this.agent = new AgentRuntime({
            id: agent?.id,
            broker: this.toolBroker,
            config: agent ?? {},
        })
    }
    return this
}

Runtime.prototype.stop = function stop() {
    this.agent?.unmountOverlay?.()
    return baseStop.call(this)
}

Runtime.prototype.registerNodeProbes = function registerNodeProbes() {
    if (!this.toolBroker?.registry) return 0

    let count = 0
    for (const probe of this.toolBroker.registry.list().probes) {
        const binding = probe?.binding ?? {}
        const nodeName = binding.node
        if (!nodeName) continue

        const actor = this.actors.find(candidate => candidate.name === nodeName)
        if (!actor) continue

        this.toolBroker.registerProbe(probe.id, async (args, currentProbe) => {
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

Runtime.prototype.attachToolBrokerActor = function attachToolBrokerActor() {
    if (!this.toolBroker?.actor) return null
    if (!this.actors.includes(this.toolBroker.actor)) this.actors.push(this.toolBroker.actor)
    return this.toolBroker.actor
}

Runtime.prototype.wireToolBrokerEvents = function wireToolBrokerEvents() {
    const brokerActor = this.toolBroker?.actor
    if (!brokerActor) return 0

    let count = 0
    for (const event of this.toolBroker.registry.list().events) {
        const source = event?.source
        if (!source?.node || !source?.pin) continue

        const actor = this.actors.find(candidate => candidate !== brokerActor && candidate.name === source.node)
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
