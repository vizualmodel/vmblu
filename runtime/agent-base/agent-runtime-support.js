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
        runtime.agentProfiles = []
        runtime.agentInterfaces = []

        const configuration = normalizeAgentConfiguration(agent)
        if (configuration) {
            runtime.agentProfiles = configuration.profiles
            runtime.agentInterfaces = configuration.interfaces
            for (const profile of configuration.profiles) {
                runtime.toolBroker.registerAgent({id: profile.id, config: profile})
            }
        }

        const selectedAgent = selectEmbeddedAgent(configuration)
        if (selectedAgent) {
            runtime.agent = new AgentRuntime({
                id: selectedAgent.profile.id,
                broker: runtime.toolBroker,
                config: {
                    ...selectedAgent.profile,
                    instructions: selectedAgent.interface.instructions,
                    llm: selectedAgent.interface.llm,
                    ui: selectedAgent.interface.ui,
                    interfaceId: selectedAgent.interface.id,
                },
            })
        }
        return runtime
    }

    stop() {
        this.runtime.toolBroker?.cancelPendingApprovals?.()
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

function normalizeAgentConfiguration(agent) {
    if (!agent || agent.enabled === false) return null

    if (Array.isArray(agent?.profiles)) {
        return {
            defaultInterface: agent.defaultInterface ?? '',
            profiles: agent.profiles.map(normalizeProfile),
            interfaces: Array.isArray(agent.interfaces) ? agent.interfaces.map(normalizeInterface) : [],
        }
    }

    const legacyAgents = Array.isArray(agent?.agents) ? agent.agents : [agent]
    const profiles = legacyAgents.map(normalizeProfile)
    const defaultProfile = profiles.find(profile => profile.id === agent.defaultAgent) ?? profiles[0]
    const interfaces = legacyAgents.map(item => ({
        id: `${item.id ?? 'agent'}-embedded`,
        kind: 'embedded',
        profile: item.id,
        enabled: item.enabled !== false,
        instructions: item.instructions,
        llm: item.llm,
        ui: item.ui,
    }))
    return {
        defaultInterface: interfaces.find(item => item.profile === defaultProfile?.id)?.id ?? '',
        profiles,
        interfaces,
    }
}

function normalizeProfile(profile = {}) {
    return {
        ...profile,
        id: String(profile.id ?? '').trim(),
        enabled: profile.enabled !== false,
        permissions: profile.permissions ?? {},
    }
}

function normalizeInterface(value = {}) {
    return {
        ...value,
        id: String(value.id ?? '').trim(),
        profile: String(value.profile ?? '').trim(),
        enabled: value.enabled !== false,
    }
}

function selectEmbeddedAgent(configuration) {
    if (!configuration) return null
    const ids = new Set()
    for (const profile of configuration.profiles) {
        if (!profile.id) throw new Error('Agent profile id is required')
        if (ids.has(profile.id)) throw new Error(`Duplicate agent profile id: ${profile.id}`)
        ids.add(profile.id)
    }

    const embedded = configuration.interfaces.filter(item => item.kind === 'embedded' && item.enabled !== false)
    if (!embedded.length) return null

    if (!configuration.defaultInterface) {
        if (embedded.length) {
            throw new Error('defaultInterface is required when an embedded agent interface is enabled')
        }
        return null
    }

    const selected = configuration.interfaces.find(item => item.id === configuration.defaultInterface)
    if (!selected) throw new Error(`Unknown default agent interface: ${configuration.defaultInterface}`)
    if (selected.kind !== 'embedded') throw new Error(`Default agent interface must be embedded: ${selected.id}`)
    if (selected.enabled === false) throw new Error(`Default agent interface is disabled: ${selected.id}`)

    const profile = configuration.profiles.find(item => item.id === selected.profile)
    if (!profile) throw new Error(`Agent interface ${selected.id} references unknown profile: ${selected.profile}`)
    if (profile.enabled === false) throw new Error(`Agent interface ${selected.id} references disabled profile: ${selected.profile}`)

    return {interface: selected, profile}
}
