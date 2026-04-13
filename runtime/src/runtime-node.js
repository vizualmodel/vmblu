import {runtime} from './scaffold.js'
import {rtFlags} from './runtime.js'
import {Target, convert, HIX_HANDLER} from './target.js'
import {normalizeRuntimeSettings} from './runtime-settings.js'

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

// the this is the cell for this function
function missingHandler(param) {

    const names = Object.getOwnPropertyNames(this)

    console.warn(`Missing handler for cell: ${names} - parameters: ${param}`)
}

function shouldUseNew(factory) {

    // trivial check
    if (typeof factory !== 'function' || !factory.prototype) return false;

    // get the keys of the object
    const protoKeys = Object.getOwnPropertyNames(factory.prototype);

    // If prototype has only 'constructor' pointing back to function → treat as factory, else call with 'new'
    return (protoKeys.length !== 1 || protoKeys[0] !== 'constructor' || factory.prototype.constructor !== factory)
}

// make this into a class and hide the props using #
export function RuntimeNode({name, uid, factory, inputs, outputs, sx, dx}) {

    // name and uid of the node
    this.name = name
    this.uid = uid

    // the node factory
    this.factory = factory

    // the factory can be called with new if it is a function and if the constructor does **not** point back to the function itself
    this.useNew = shouldUseNew(factory) //factory.prototype?.constructor === factory ? false : true

    // the receive sink and transmit map
    this.rxSink = []
    this.txMap = new Map()

    // the parameters for the node
    this.sx = sx ?? null;

    // the runtime settings
    this.dx = dx ? normalizeRuntimeSettings(dx) : null;

    // set the flags
    this.flags = 0x0; 

    // the client data structure with the handlers - created by the factory 
    this.cell = null

    // set when a message is received
    this.msg = null

    // now set the flags for the node
    this.setFlags()

    // initialise the rx sink and tx map
    this.initRxTx({inputs, outputs})
}
RuntimeNode.prototype = {

    setFlags() {

        if (!this.dx) return

        if (this.dx.logMessages) this.flags |= rtFlags.LOGMSG
    },

    initRxTx({inputs, outputs}) {

        // handle the inputs
        for ( const inputString of inputs) {

            // convert the string to an input
            const input = convert.stringToInput(inputString)
            if (input) this.rxSink.push(new RX(input.pin, input.channel))
        }

        // handle the outputs
        for (const outputString of outputs) {

            // first get the output 
            const raw = convert.stringToOutput(outputString);

            // check
            if (!raw) continue

            // a new transmit entry
            const tx = new TX(raw.output, raw.channel)

            // save
            this.txMap.set(tx.pin, tx)

            // add the targets
            for (const rawTarget of raw.targets) {

                // add the output pin
                tx.targets.push(new Target(rawTarget.uid, rawTarget.pinName, raw.channel))
            }
        }
    },

    makeCell() {

        // create the cell by using 'new' or a factory function
        try {
            if (this.useNew) {
                this.cell = new this.factory(this.getTx(), this.sx);
            } else {
                this.cell = this.factory(this.getTx(), this.sx);
            }
        } catch (err) {
            // Handle "Class constructor ... cannot be invoked without 'new'"
            if (err instanceof TypeError && typeof this.factory === 'function' && /class constructor/i.test(err.message)) {
            
                // change the flag
                this.useNew = true

                // do it again, but with new this time !
                this.cell = new this.factory(this.getTx(), this.sx);
            }
            else throw err;
        }

        // set the handlers in the rx sink
        this.addHandlersForCell()
    },

    addHandlersForCell() {

        // if there is no cell 
        if (!this.cell) {
            if (this.rxSink.length > 0) console.warn(`** NO HANDLERS ** Node ${this.name} has input pins but no implementation.`);
            return;
        }

        // get the props of the cell
        const entries = Object.entries(this.cell);

        // notation
        const proto = Object.getPrototypeOf(this.cell) 

        // get the prop names of the prototype
        const protoNames = Object.getOwnPropertyNames( proto) ?? []

        // check the prototype names
        for (const protoName of protoNames) {

            // save to entries 
            if (typeof proto[protoName] === 'function') entries.push([protoName, proto[protoName]])
        }

        // check the entries for handlers
        entries.forEach(([name, fn]) => {

            // only check the functions
            if (typeof fn === 'function') {

                // check if the function name matches a message..
                const rx = this.getRx(name);

                // if so set the function as the handler for the message
                if (rx) rx.handler = fn;
            }
        });

        // check that every message has a handler
        for (const rx of this.rxSink) {

            // if no handler
            if (!rx.handler) {

                // issue a warning
                console.warn(`** NO HANDLER ** Node "${this.name}" has input pin "${rx.pin}" but no handler for it.`);

                // and use a default handler
                rx.handler = missingHandler;
            }
        }
    },

    // given a function name, check if it corresponds to a pin in the rx sink
    getRx(functionName) {

        // first try the old names...
        if ((functionName.startsWith("-> ")) || (functionName.startsWith("=> "))) {

            // get the name without the prefix
            const handlerName = functionName.slice(3)

            // find the entry in the sink
            return this.rxSink.find(rx => rx.pin == handlerName)
        }

        // try the new camelcased name by scanning the known rx handlers once
        for (const rx of this.rxSink) {
            if (convert.pinToHandler(rx.pin) == functionName) return rx
        }
        return null
    },

    resolveUIDs(actors) {

        // for every output pin
        for (const tx of this.txMap.values()) {

            // for every pin connected to that output pin
            for (const target of tx.targets) {

                // find the node
                target.actor = actors.find( actor => actor.uid == target.uid)

                // check - should not happen 
                if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                // find the index of the handler for a node - note that target.channel has already been set
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

    // return an object with the functions for the cell - done like this to avoid direct access to source !
    getTx() {

        const source = this

        return {
            // get the output pin from the message
            get pin() {return source.msg?.txPin},

            // returns the local reference of the message
            send(pin, param) {

                // check
                if (pin) {

                    // get the tx entry for this pin
                    const tx = source.findTx(pin)

                    // send if output pin exists
                    if (tx) return runtime.sendTo(tx, source, param)
                }

                // no pin or no tx
                console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? 'missing !!'}"`, source.txMap)
                return 0
            },

            // sends a request and returns a promise or an array of promises
            request(pin, param, timeout = 0) {

                // check
                if (pin) {

                    // get the targets for this pin
                    const tx = source.findTx(pin)

                    // check
                    if (tx) return runtime.requestFrom(tx, source, param, timeout)
                }

                console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap)  
                return runtime.reject('No such output pin')
            },

            // Returns a message to the sender over the backchannel
            reply(param) {

                // a reply to a request
                return runtime.reply(source, param)
            },

            // sends a reply and returns a promise
            next(param, timeout = 0) {

                return runtime.next(source, param, timeout)
            },

            // if a message cannot be handled yet, it can be rescheduled
            reschedule() {
                if (source.msg) runtime.reschedule(source.msg)
            },

            // you can select a destination here - message will only be sent if there is a connection to that node
            select(nodeName) {

                const _nodeName = nodeName

                return {

                    // returns the local reference of the message
                    send(pin, param) {

                        // check
                        if (pin) {

                            // get the tx entry for this pin
                            const tx = source.findTx(pin)

                            // check
                            if (tx) {

                                // select the target with the right name
                                const actualTarget = tx.targets.find( target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                                if (actualTarget) {

                                    const txCopy = new TX(tx.pin, tx.channel)
                                    txCopy.targets = [actualTarget]
                                    return runtime.sendTo(txCopy, source, param)
                                }

                                console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`)
                                return 0
                            }
                        }

                        // missing / inexesting pin
                        console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? 'missing !!'}"`, source.txMap)
                        return 0
                    },

                    // sends a request and returns a promise or an array of promises
                    request(pin, param, timeout = 0) {

                        // check
                        if (pin) {

                            // get the targets for this pin
                            const tx = source.findTx(pin)

                            // check
                            if (tx) {

                                const actualTarget = tx.targets.find( target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                                if (actualTarget) {

                                    const txCopy = new TX(tx.pin, tx.channel)
                                    txCopy.targets = [actualTarget]
                                    return runtime.requestFrom(txCopy, source, param, timeout)
                                }

                                console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`)
                                return  runtime.reject('selected node not connected')
                            }
                        }

                        console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap)  
                        return runtime.reject('No such output pin')
                    },
                }
            }
        }
    },


}
