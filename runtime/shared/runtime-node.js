import {Target, convert, HIX_HANDLER} from './target.js'

function RX(pin, channel=false) {

    this.pin = pin
    this.channel = channel
    this.handler = null
}

function TX(pin, channel=false) {

    this.pin = pin
    this.channel = channel
    this.targets = []
}

function missingHandler(param) {

    const names = Object.getOwnPropertyNames(this)

    console.warn(`Missing handler for cell: ${names} - parameters: ${param}`)
}

function shouldUseNew(factory) {

    if (typeof factory !== 'function' || !factory.prototype) return false

    const protoKeys = Object.getOwnPropertyNames(factory.prototype)

    return (protoKeys.length !== 1 || protoKeys[0] !== 'constructor' || factory.prototype.constructor !== factory)
}

export function RuntimeNode(runtime, {name, uid, factory, inputs, outputs, sx, dx}) {

    this.name = name
    this.uid = uid
    this.factory = factory
    this.useNew = shouldUseNew(factory)
    this.rxSink = []
    this.txMap = new Map()
    this.sx = sx ?? null
    this.dx = dx ? runtime.settings.normalize(dx) : null
    this.cell = null
    this.msg = null
    this.tx = createTx(runtime, this)

    this.initRxTx({inputs, outputs})
}

RuntimeNode.prototype = {

        logsMessages() {
            return !!(this.dx?.monitor?.logMessages || this.dx?.logMessages)
        },

        initRxTx({inputs, outputs}) {

            for (const inputString of inputs) {
                const input = convert.stringToInput(inputString)
                if (input) this.rxSink.push(new RX(input.pin, input.channel))
            }

            for (const outputString of outputs) {

                const raw = convert.stringToOutput(outputString)
                if (!raw) continue

                const tx = new TX(raw.output, raw.channel)
                this.txMap.set(tx.pin, tx)

                for (const rawTarget of raw.targets) {
                    tx.targets.push(new Target(rawTarget.uid, rawTarget.pinName, raw.channel))
                }
            }
        },

        makeCell() {

            try {
                if (this.useNew) {
                    this.cell = new this.factory(this.getTx(), this.sx)
                } else {
                    this.cell = this.factory(this.getTx(), this.sx)
                }
            } catch (err) {
                if (err instanceof TypeError && typeof this.factory === 'function' && /class constructor/i.test(err.message)) {

                    this.useNew = true
                    this.cell = new this.factory(this.getTx(), this.sx)
                }
                else throw err
            }

            this.addHandlersForCell()
        },

        addHandlersForCell() {

            if (!this.cell) {
                if (this.rxSink.length > 0) console.warn(`** NO HANDLERS ** Node ${this.name} has input pins but no implementation.`)
                return
            }

            const entries = Object.entries(this.cell)
            const proto = Object.getPrototypeOf(this.cell)
            const protoNames = Object.getOwnPropertyNames(proto) ?? []

            for (const protoName of protoNames) {
                if (typeof proto[protoName] === 'function') entries.push([protoName, proto[protoName]])
            }

            entries.forEach(([name, fn]) => {

                if (typeof fn === 'function') {

                    const rx = this.getRx(name)
                    if (rx) rx.handler = fn
                }
            })

            for (const rx of this.rxSink) {

                if (!rx.handler) {

                    console.warn(`** NO HANDLER ** Node "${this.name}" has input pin "${rx.pin}" but no handler for it.`)
                    rx.handler = missingHandler
                }
            }
        },

        getRx(functionName) {

            if ((functionName.startsWith('-> ')) || (functionName.startsWith('=> '))) {

                const handlerName = functionName.slice(3)

                return this.rxSink.find(rx => rx.pin == handlerName)
            }

            for (const rx of this.rxSink) {
                if (convert.pinToHandler(rx.pin) == functionName) return rx
            }
            return null
        },

        resolveUIDs(actors) {

            for (const tx of this.txMap.values()) {

                for (const target of tx.targets) {

                    target.actor = actors.find(actor => actor.uid == target.uid)

                    if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                    const hix = target.actor.rxSink.findIndex(rx => rx.pin == target.pin)
                    if (hix < 0) return console.error(`** ERROR ** target pin ${target.pin} in ${target.actor.name} not found`)
                    target.hix = HIX_HANDLER | hix
                }
            }
        },

        findTx(pin) {
            if (!pin) return null
            return this.txMap.get(pin) ?? null
        },

        getTx() {
            return this.tx
        },
}

function createTx(runtime, source) {

    return {
        get pin() {return source.msg?.txPin},

        send(pin, param) {

            if (pin) {

                const tx = source.findTx(pin)

                if (tx) return runtime.sendTo(tx, source, param)
            }

            console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? 'missing !!'}"`, source.txMap)
            return 0
        },

        request(pin, param, timeout = 0) {

            if (pin) {

                const tx = source.findTx(pin)

                if (tx) return runtime.requestFrom(tx, source, param, timeout)
            }

            console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap)
            return runtime.reject('No such output pin')
        },

        reply(param) {
            return runtime.reply(source, param)
        },

        next(param, timeout = 0) {
            return runtime.next(source, param, timeout)
        },

        reschedule() {
            if (source.msg) runtime.reschedule(source.msg)
        },

        select(nodeName) {

            const _nodeName = nodeName

            return {

                send(pin, param) {

                    if (pin) {

                        const tx = source.findTx(pin)

                        if (tx) {

                            const actualTarget = tx.targets.find(target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                            if (actualTarget) {

                                const txCopy = new TX(tx.pin, tx.channel)
                                txCopy.targets = [actualTarget]
                                return runtime.sendTo(txCopy, source, param)
                            }

                            console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`)
                            return 0
                        }
                    }

                    console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? 'missing !!'}"`, source.txMap)
                    return 0
                },

                request(pin, param, timeout = 0) {

                    if (pin) {

                        const tx = source.findTx(pin)

                        if (tx) {

                            const actualTarget = tx.targets.find(target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                            if (actualTarget) {

                                const txCopy = new TX(tx.pin, tx.channel)
                                txCopy.targets = [actualTarget]
                                return runtime.requestFrom(txCopy, source, param, timeout)
                            }

                            console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`)
                            return runtime.reject('selected node not connected')
                        }
                    }

                    console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap)
                    return runtime.reject('No such output pin')
                },
            }
        }
    }
}
