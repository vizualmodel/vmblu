import {runtime} from './scaffold.js'
import {rtFlags} from './runtime.js'
import {Target, convert, HIX_HANDLER, HIX_ROUTER} from './target.js'

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

    // the receive and transmit table
    this.rxTable = []
    this.txTable = []

    // the parameters for the node
    this.sx = sx ?? null;

    // the runtime settings
    this.dx = dx ?? null;

    // set the flags
    this.flags = 0x0; 

    // the client data structure with the handlers - created by the factory 
    this.cell = null

    // set when a message is received
    this.msg = null

    // now set the flags for the node
    this.setFlags()

    // initialise the rx and tx tables
    this.initRxTxTables( {inputs, outputs})
}
RuntimeNode.prototype = {

    setFlags() {

        if (! this.dx?.flags) return

        if (this.dx.flags.includes('LOGMSG')) this.flags |= rtFlags.LOGMSG
    },

    initRxTxTables({inputs,outputs} ) {

        // handle the inputs
        for ( const inputString of inputs) {

            // convert the string to an input
            const input = convert.stringToInput(inputString)
            if (input) this.rxTable.push(new RX(input.pin, input.channel));
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
            this.txTable.push(tx)

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

        // set the handlers in the rx Table
        this.addHandlersForCell()
    },

    addHandlersForCell() {

        // if there is no cell 
        if (!this.cell) {
            if (this.rxTable?.length > 0) console.warn(`** NO HANDLERS ** Node ${this.name} has input pins but no implementation.`);
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
        this.rxTable.forEach(rx => {

            // if no handler
            if (!rx.handler) {

                // issue a warning
                console.warn(`** NO HANDLER ** Node "${this.name}" has input pin "${rx.pin}" but no handler for it.`);

                // and use a default handler
                rx.handler = missingHandler;
            }
        });
    },

    // given a function name, check if it corresponds to a pin in the rx table
    getRx(functionName) {

        // first try the old names...
        if ((functionName.startsWith("-> ")) || (functionName.startsWith("=> "))) {

            // get the name without the prefix
            const handlerName = functionName.slice(3)

            // find the entry in the table and set the handler
            return this.rxTable.find( rx => rx.pin == handlerName)
        }

        // try the new camelcased name
        return this.rxTable.find( rx => convert.pinToHandler(rx.pin) == functionName)
    },

    resolveUIDs(actors) {

        // for every output pin
        this.txTable.forEach( tx => {

            // for every pin connected to that output pin
            tx.targets.forEach( target => {

                // find the node
                target.actor = actors.find( actor => actor.uid == target.uid)

                // check - should not happen 
                if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                // find the index of the handler for a node - note that target.channel has already been set
                target.hix = target.actor.factory   ? HIX_HANDLER | target.actor.rxTable.findIndex( rx => rx.pin == target.pin) 
                                                    : HIX_ROUTER | target.actor.scopeTable.findIndex( scope => scope.selector == target.pin)
            })
        })
    },

    // when sending a message find the targets for the message
    findTargets(pin) {

        //check
        if (!pin) return []

        // find the pin
        const tx = this.txTable.find( tx => tx.pin == pin)

        // check - targets is always an array, but it can be empty
        if (tx) return tx.targets

        // not found - give a warning
        console.warn(`** NO OUTPUT PIN ** Node "${this.name}" pin: "${pin}"`, this.txTable)  
        
        //..and return null
        return [] 
    },

    // return an object with the functions for the cell - done like this to avoid direct access to source !
    getTx() {

        const source = this

        return {
            // get the output pin from the message
            get pin() {return source.msg?.pin},

            // returns the local reference of the message
            send(pin, param) {

                // check
                if (!pin) return 0

                // get the targets for this pin
                const targets = source.findTargets(pin)

                // send
                return runtime.sendTo(targets, source, pin, param)
            },

            // sends a request and returns a promise or an array of promises
            request(pin, param, timeout = 0) {

                // check
                if (!pin) return null

                // get the targets for this pin
                const tx = source.txTable.find( tx => tx.pin == pin)

                // check
                if (tx?.targets.length) return runtime.requestFrom(tx.targets, source, pin, param, timeout)

                // give an error message
                if (tx) {
                    console.warn(`** PIN IS NOT CONNECTED ** Node "${source.name}" pin: "${pin}"`, source.txTable)  
                    return runtime.reject('Not connected')
                }
                else {
                    console.warn(`** NO SUCH OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txTable)  
                    return runtime.reject('No such output pin')
                }
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
                        if (!pin) return 0

                        // get the targets for this pin
                        const targets = source.findTargets(pin)

                        // select the target with the right name
                        const actualTarget = targets.find( target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                        // send
                        return actualTarget ? runtime.sendTo([actualTarget], source, pin, param) : 0
                    },

                    // sends a request and returns a promise or an array of promises
                    request(pin, param, timeout = 0) {

                        // check
                        if (!pin) return null

                        // get the targets for this pin
                        const tx = source.txTable.find( tx => tx.pin == pin)

                        // check
                        if (tx?.targets.length) {

                            const actualTarget = tx.targets.find( target => target.actor.name.toLowerCase() == _nodeName.toLowerCase())

                            if (actualTarget) return runtime.requestFrom([actualTarget], source, pin, param, timeout)
                        }

                        // give an error message
                        if (tx) {
                            console.warn(`** PIN IS NOT CONNECTED ** Node "${source.name}" pin: "${pin}"`, source.txTable)  
                            return runtime.reject('Not connected')
                        }
                        else {
                            console.warn(`** NO SUCH OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txTable)  
                            return runtime.reject('No such output pin')
                        }
                    },
                }
            }
        }
    },


}
