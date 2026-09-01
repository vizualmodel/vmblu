export {Runtime}

import {Runtime as SharedRuntime} from '../shared/runtime.js'
import {HIX_HANDLER, HIX_REPLY, HIX_TYPE_MASK} from '../shared/target.js'
import {runAsNode} from '../security/node-context.js'
import {runtimeSettings} from './runtime-settings.js'
import {safety} from '../security/safety.js'

class Runtime extends SharedRuntime {
    configure(options = {}) {
        this.securitySettings = options.runtimeSettings ?? null
        this.securityBaseDir = options.securityBaseDir ?? null
    }

    start() {
        if (safety.isOwner(this)) safety.release(this)

        const validationErrors = this.settings.validateModel(this.securitySettings)
            .filter(error => error.code !== 'legacy_security')
        if (validationErrors.length) {
            throw new Error(`Invalid vmblu security settings: ${validationErrors.map(error => error.message).join('; ')}`)
        }

        const policy = this.settings.effectivePolicy(this.securitySettings)
        if (policy.active && hasRelativeRoots(policy.security) && !this.securityBaseDir) {
            throw new Error('vmblu security requires securityBaseDir when file roots are relative')
        }

        try {
            if (policy.active) {
                safety.claim(this, {
                    security: policy.security,
                    baseDir: this.securityBaseDir,
                })
            }
            return super.start()
        }
        catch (error) {
            safety.release(this)
            throw error
        }
    }

    stop() {
        try {
            return super.stop()
        }
        finally {
            safety.release(this)
        }
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

function hasRelativeRoots(security) {
    return ['read', 'write', 'delete'].some(action => {
        const operation = security?.fs?.[action]
        return operation?.roots?.some(root => !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(root))
    })
}

Runtime.prototype.settings = runtimeSettings
