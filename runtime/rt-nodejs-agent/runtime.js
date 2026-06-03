export {Runtime}

import {Runtime as AlsRuntime} from '../rt-als/runtime.js'
import {AgentRuntimeSupport} from '../agent-base/index.js'
import {runtimeSettings} from '../rt-als/runtime-settings.js'

class Runtime extends AlsRuntime {
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
