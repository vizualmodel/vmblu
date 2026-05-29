export {Runtime}

import {Runtime as BaseRuntime} from '../rt-base/runtime.js'
import {AgentRuntimeSupport} from '../rt-agent/agent-runtime-support.js'
import {runtimeSettings} from './runtime-settings.js'

class Runtime extends BaseRuntime {
    get settings() {
        return runtimeSettings
    }

    get agentSupport() {
        return this._agentSupport ??= new AgentRuntimeSupport(this)
    }

    configure(options = {}) {
        super.configure(options)
        this.configureAgentRuntime(options)
    }

    configureAgentRuntime(options = {}) {
        return this.agentSupport.configure(options)
    }

    stop() {
        this.agentSupport.stop()
        return super.stop()
    }

    registerNodeProbes() {
        return this.agentSupport.registerNodeProbes()
    }

    attachToolBrokerActor() {
        return this.agentSupport.attachToolBrokerActor()
    }

    wireToolBrokerEvents() {
        return this.agentSupport.wireToolBrokerEvents()
    }
}
