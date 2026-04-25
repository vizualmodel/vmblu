import {ResolveQueue} from './resolve-queue.js'
import {HIX_HANDLER, HIX_REPLY, HIX_TYPE_MASK} from './target.js'

export const rtFlags = {
    LOGMSG: 0x1
}

const LOGMSG = rtFlags.LOGMSG

function defaultInvokeHandler(dest, hix, param) {
    return dest.rxSink[hix].handler.call(dest.cell, param)
}

export function createRuntime({invokeHandler = defaultInvokeHandler} = {}) {

    function Runtime() {

        this.actors = []
        this.receiveTimer = 0
        this.idleTimer = 0
        this.receiveDelay = 0
        this.idleDelay = 100
        this.idleCount = 0
        this.msgCount = 0
        this.startTime = null
        this.qOut = []
        this.qIn = []
        this.qResolve = new ResolveQueue()
    }
    Runtime.prototype = {

        clearReceiveTimer() {
            clearTimeout(this.receiveTimer)
            this.receiveTimer = 0
        },

        clearIdleTimer() {
            clearTimeout(this.idleTimer)
            this.idleTimer = 0
        },

        scheduleReceive() {

            if (this.receiveTimer) return

            this.clearIdleTimer()

            this.receiveTimer = setTimeout(() => {
                this.receiveTimer = 0
                this.receive()
            }, this.receiveDelay)
        },

        scheduleIdleCheck() {

            if (this.idleTimer || this.receiveTimer || this.qOut.length) return

            this.idleTimer = setTimeout(() => {
                this.idleTimer = 0
                this.idle()
            }, this.idleDelay)
        },

        start() {

            this.clearReceiveTimer()
            this.clearIdleTimer()

            this.qOut = []
            this.qIn = []

            this.msgCount = 0
            this.idleCount = 0

            for (const actor of this.actors) actor.makeCell()

            this.startTime = Date.now()

            this.scheduleIdleCheck()
        },

        stop() {
            this.clearReceiveTimer()
            this.clearIdleTimer()

            this.msgCount = 0
            this.idleCount = 0

            this.actors.forEach(actor => actor.cell = null)

            this.qOut = []
            this.qIn = []
        },

        halt() {
            this.clearReceiveTimer()
            this.clearIdleTimer()
        },

        continue() {
            if (this.qOut.length) this.scheduleReceive()
            else this.scheduleIdleCheck()
        },

        switch() {
            const temp = this.qIn
            this.qIn = this.qOut
            this.qOut = temp
            this.qOut.length = 0
        },

        idle() {
            this.idleCount++

            const now = Date.now()

            this.qResolve.checkTimeouts(now)

            if (this.idleCount % 600 == 0) {
                const min = (now - this.startTime)/60000
                console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`)
            }

            this.scheduleIdleCheck()
        },

        reject(reason) {
            return new Promise((resolve, reject) => {
                reject(new Error(reason))
            })
        },

        logMessage(msg) {
            console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}]`)
        },

        logReqReply(msg, what) {
            console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}] (${what})`)
        },

        logNotConnected(nodeName, pinName) {
            console.log(`${nodeName}[${pinName}] : not connected.`)
        },

        sendTo(tx, source, param) {

            if (tx.targets.length < 1) {
                if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin)
                return 0
            }

            ++this.msgCount

            const log = source.flags & LOGMSG
            for (const target of tx.targets) {
                this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef: 0, txPin: tx.pin, rxRef: 0, rxPin: target.pin})
                if (log) this.logMessage(this.qOut.at(-1))
            }

            this.idleCount = 0
            if (!this.receiveTimer) this.scheduleReceive()

            return tx.targets.length
        },

        requestFrom(tx, source, param, timeout) {

            if (tx.targets.length < 1) {
                if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin)
                return this.reject('Not connected')
            }

            const txRef = ++this.msgCount
            let channelCount = 0

            const log = (source.flags & LOGMSG)
            for (const target of tx.targets) {

                this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef, txPin: tx.pin, rxRef: 0, rxPin: target.pin})

                if (log) this.logReqReply(this.qOut.at(-1), 'request')

                if (target.channel) channelCount++
            }

            this.idleCount = 0
            if (!this.receiveTimer) this.scheduleReceive()

            if (channelCount == 0) return this.reject('No channel')

            return this.qResolve.addPromiseHandler(txRef, timeout, channelCount)
        },

        reply(source, param) {

            if (!source.msg?.txRef) return 0

            ++this.msgCount

            this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef:0, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin})

            if (source.flags & LOGMSG) this.logReqReply(this.qOut.at(-1), 'reply')

            this.idleCount = 0
            if (!this.receiveTimer) this.scheduleReceive()

            return 1
        },

        next(source, param, timeout) {

            if (!source.msg?.txRef) return this.reject('No target')

            const txRef = ++this.msgCount

            this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin})

            this.idleCount = 0
            if (!this.receiveTimer) this.scheduleReceive()

            return this.qResolve.addPromiseHandler(txRef, timeout)
        },

        receive() {

            if (!this.qOut.length) return this.scheduleIdleCheck()

            this.switch()
            this.handleReceiveQueue()

            if (this.qOut.length && !this.receiveTimer) this.scheduleReceive()
            else this.scheduleIdleCheck()
        },

        handleReceiveQueue() {

            for (const msg of this.qIn) {

                const dest = msg.dest

                switch(msg.hix & HIX_TYPE_MASK) {

                    case HIX_HANDLER : {

                        dest.msg = msg

                        if (dest.flags & LOGMSG) this.logMessage(msg)

                        invokeHandler(dest, msg.hix, msg.param)
                    }
                    break

                    case HIX_REPLY : {

                        if (dest.flags & LOGMSG) this.logReqReply(msg, 'incoming reply')

                        this.qResolve.trigger(msg.rxRef, msg.param)
                    }
                    break
                }
            }
        },

        reschedule(msg) {
            this.qOut.push(msg)
            this.idleCount = 0
            if (!this.receiveTimer) this.scheduleReceive()
        }
    }

    return Runtime
}
