import {reportValue} from './deep-equal.js'

export class SourceNodeTestAdapter {
    constructor({factory, sx=null, inputPins=[], outputPins=[], host=null}={}) {
        if (typeof factory !== 'function') throw new TypeError('SourceNodeTestAdapter requires a node factory')
        this.factory = factory
        this.sx = sx
        this.inputPins = new Set(inputPins.map(pinName))
        this.outputPins = new Set(outputPins.map(pinName))
        this.host = host
        this.cell = null
        this.handlers = new Map()
        this.observations = []
        this.started = 0
        this.activePin = null
        this.mountReply = null
    }

    async start() {
        this.started = Date.now()
        this.observations = []
        this.mountReply = null
        const tx = this.createTx()
        this.cell = makeCell(this.factory, tx, this.sx)
        this.handlers = collectHandlers(this.cell, this.inputPins)
    }

    async execute(action) {
        if (action.kind === 'wait') {
            if (this.host) await this.host.execute(action)
            else await delay(action.ms)
            return
        }

        if (action.kind === 'send' || action.kind === 'request' || action.kind === 'mount') {
            if (!this.inputPins.has(action.pin)) throw new Error(`Target has no input pin '${action.pin}'`)
            const handler = this.handlers.get(action.pin)
            if (!handler) throw new Error(`Target has no handler for input pin '${action.pin}'`)

            this.activePin = action.pin
            this.mountReply = action.kind === 'mount' ? undefined : null
            try {
                await handler.call(this.cell, action.message)
            }
            finally {
                this.activePin = null
            }

            if (action.kind === 'mount') {
                if (!this.host) throw new Error('The mount action requires a browser test host')
                if (this.mountReply === undefined) throw new Error(`Input pin '${action.pin}' did not reply with a view`)
                await this.host.mount(this.mountReply)
            }
            return
        }

        if (!this.host) throw new Error(`Action '${action.kind}' requires a browser test host`)
        await this.host.execute(action)
    }

    async assert(expectation) {
        if (expectation.kind !== 'view') return null
        if (!this.host) return {message: 'A view expectation requires a browser test host'}
        return this.host.assert(expectation)
    }

    getObservations() {
        return this.observations
    }

    async stop() {
        await this.host?.stop?.()
        await this.cell?.stop?.()
        await this.cell?.destroy?.()
        this.cell = null
    }

    createTx() {
        const adapter = this
        const observe = (kind, pin, message) => {
            this.observations.push({kind, pin, message: reportValue(message), atMs: Date.now() - this.started})
            return 1
        }

        return {
            get pin() { return adapter.activePin },
            send: (pin, message) => {
                if (!this.outputPins.has(pin)) throw new Error(`Target sent on undeclared output pin '${pin}'`)
                return observe('send', pin, message)
            },
            request() { throw new Error('Outbound test requests require a configured collaborator') },
            reply: message => {
                if (this.mountReply === undefined) {
                    this.mountReply = message
                    return 1
                }
                return observe('reply', this.activePin, message)
            },
            next() { throw new Error('Chained test replies are not supported') },
            reschedule() { throw new Error('Test rescheduling is not supported') },
            to() { throw new Error('Selective test sends are not supported by an isolated source node') },
            select() { throw new Error('Selective test sends are not supported by an isolated source node') },
        }
    }
}

function delay(ms=0) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function pinName(pin) {
    return typeof pin === 'string' ? pin : pin?.name
}

function makeCell(factory, tx, sx) {
    if (shouldUseNew(factory)) return new factory(tx, sx)
    try {
        return factory(tx, sx)
    }
    catch (error) {
        if (error instanceof TypeError && /class constructor/i.test(error.message)) return new factory(tx, sx)
        throw error
    }
}

function shouldUseNew(factory) {
    if (typeof factory !== 'function' || !factory.prototype) return false
    const names = Object.getOwnPropertyNames(factory.prototype)
    return names.length !== 1 || names[0] !== 'constructor' || factory.prototype.constructor !== factory
}

function collectHandlers(cell, inputPins) {
    const handlers = new Map()
    if (!cell) return handlers

    const entries = Object.entries(cell)
    let prototype = Object.getPrototypeOf(cell)
    while (prototype && prototype !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(prototype)) {
            if (name !== 'constructor' && typeof prototype[name] === 'function') entries.push([name, prototype[name]])
        }
        prototype = Object.getPrototypeOf(prototype)
    }

    for (const pin of inputPins) {
        const handlerNames = [`-> ${pin}`, `=> ${pin}`, pinToHandler(pin)]
        const entry = entries.find(([name, value]) => handlerNames.includes(name) && typeof value === 'function')
        if (entry) handlers.set(pin, entry[1])
    }
    return handlers
}

function pinToHandler(pin) {
    const words = String(pin).split(/[ .-]+/).map(word => word.replace(/[^a-zA-Z0-9_]/g, '')).filter(Boolean)
    return `on${words.map(word => word[0].toUpperCase() + word.slice(1)).join('')}`
}
