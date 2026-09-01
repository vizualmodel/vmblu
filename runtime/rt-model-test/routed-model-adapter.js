import {Runtime as BaseRuntime} from '../rt-base/runtime.js'
import {reportValue} from './deep-equal.js'

export class RoutedModelTestAdapter {
    constructor({nodeList=[], boundary={inputs: [], outputs: []}, Runtime=BaseRuntime, runtimeOptions={}, host=null}={}) {
        this.nodeList = nodeList
        this.boundary = boundary
        this.Runtime = Runtime
        this.runtimeOptions = runtimeOptions
        this.host = host
        this.runtime = null
        this.observations = []
        this.started = 0
        this.replyObservation = null
        this.mountOnly = false
    }

    async start() {
        this.started = Date.now()
        this.observations = []
        this.runtime = new this.Runtime(this.nodeList, this.runtimeOptions)
        this.instrumentRuntime()
        this.runtime.start()
    }

    async execute(action) {
        if (action.kind === 'wait') {
            if (this.host) await this.host.execute(action)
            else await delay(action.ms)
            await this.drain()
            return
        }

        if (action.kind === 'send' || action.kind === 'request' || action.kind === 'mount') {
            const boundaryInput = this.boundary.inputs.find(input => input.pin === action.pin)
            if (!boundaryInput) throw new Error(`Target boundary has no input pin '${action.pin}'`)
            this.replyObservation = action.kind === 'request' || action.kind === 'mount' ? undefined : null
            this.mountOnly = action.kind === 'mount'

            for (const target of boundaryInput.targets) {
                await this.deliver(target, action.pin, action.message, action.kind !== 'send')
            }
            await this.drain()

            if (action.kind === 'mount') {
                if (!this.host) throw new Error('The mount action requires a browser test host')
                if (this.replyObservation === undefined) throw new Error(`Boundary pin '${action.pin}' did not reply with a view`)
                await this.host.mount(this.replyObservation)
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
        this.runtime?.stop?.()
        await this.host?.stop?.()
        this.runtime = null
    }

    instrumentRuntime() {
        const runtime = this.runtime
        const originalSendTo = runtime.sendTo.bind(runtime)
        const originalReply = runtime.reply.bind(runtime)

        runtime.sendTo = (source, pin, targets, message) => {
            for (const output of this.boundary.outputs) {
                if (output.sourceUid === source.uid && output.sourcePin === pin) {
                    this.observe('send', output.pin, message)
                }
            }
            return originalSendTo(source, pin, targets, message)
        }

        runtime.reply = (source, message) => {
            if (source.msg?.source?.isTestBoundary) {
                if (this.replyObservation === undefined) {
                    this.replyObservation = message
                    if (!this.mountOnly) this.observe('reply', source.msg.txPin, message)
                }
                else this.observe('reply', source.msg.txPin, message)
                return 1
            }
            return originalReply(source, message)
        }
    }

    async deliver(target, boundaryPin, message, expectsReply) {
        const actor = this.runtime.actors.find(candidate => candidate.uid === target.uid)
        if (!actor) throw new Error(`Boundary target node '${target.uid}' was not found`)
        const rxIndex = actor.rxSink.findIndex(rx => rx.pin === target.pin)
        if (rxIndex < 0) throw new Error(`Boundary target pin '${target.pin}' was not found on '${actor.name}'`)
        const rx = actor.rxSink[rxIndex]
        const boundarySource = {
            isTestBoundary: true,
            name: '<test boundary>',
            uid: '<test boundary>',
        }
        actor.msg = {
            source: boundarySource,
            dest: actor,
            param: message,
            txRef: expectsReply ? 1 : 0,
            txPin: boundaryPin,
            rxRef: 0,
            rxPin: target.pin,
        }
        await rx.handler.call(actor.cell, message)
    }

    async drain() {
        for (let pass = 0; pass < 100 && this.runtime.qOut.length; pass++) {
            this.runtime.clearReceiveTimer()
            this.runtime.receive()
            await Promise.resolve()
        }
        if (this.runtime.qOut.length) throw new Error('Routed model did not become idle after 100 message passes')
        await this.host?.settle?.()
    }

    observe(kind, pin, message) {
        this.observations.push({kind, pin, message: reportValue(message), atMs: Date.now() - this.started})
    }
}

function delay(ms=0) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
