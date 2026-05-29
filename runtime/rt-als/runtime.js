export {Runtime}

import {Runtime as SharedRuntime} from '../shared/runtime.js'
import {HIX_HANDLER, HIX_REPLY, HIX_TYPE_MASK} from '../shared/target.js'
import {runAsNode} from './node-context.js'
import {runtimeSettings} from './runtime-settings.js'
import {safety} from './safety.js'

class Runtime extends SharedRuntime {
    configure(options = {}) {
        safety.setPolicyClassifier(safety.makePolicyClassifier({
            runtime: this,
            runtimeSettings: options.runtimeSettings,
        }))
    }

    handleReceiveQueue() {

        for (const msg of this.qIn) {

            const dest = msg.dest

            switch(msg.hix & HIX_TYPE_MASK) {

                case HIX_HANDLER : {

                    dest.msg = msg

                    if (dest.logsMessages?.()) this.logMessage(msg)

                    runAsNode(dest.name, () => dest.rxSink[msg.hix].handler.call(dest.cell, msg.param))
                }
                break

                case HIX_REPLY : {

                    if (dest.logsMessages?.()) this.logReqReply(msg, 'incoming reply')

                    this.qResolve.trigger(msg.rxRef, msg.param)
                }
                break
            }
        }
    }
}

Runtime.prototype.settings = runtimeSettings
