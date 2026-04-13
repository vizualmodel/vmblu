import {ResolveQueue} from './resolve-queue.js'
import {HIX_HANDLER, HIX_REPLY, HIX_TYPE_MASK} from './target'

// The flags for the runtime 
export const rtFlags = {
    LOGMSG: 0x1
}
// shorten the flags
const LOGMSG = rtFlags.LOGMSG

// the runtime defintion
export function Runtime() {

    //the actors in this runtime (nodes and filters)
    this.actors = []

    // scheduling
    this.receiveTimer = 0                   // scheduled receive callback
    this.idleTimer = 0                      // scheduled idle callback
    this.receiveDelay = 0                   // delay before handling queued messages
    this.idleDelay = 100                    // delay between idle timeout checks
    this.idleCount = 0                      // the nr of idle loops - reset to 0 when a message arrives

    // msg count and time run
    this.msgCount = 0                       // total messages handles
    this.startTime = null                   // starting time of the runtime

    // the message queues act like swinging buffers
    this.qOut = []
    this.qIn = []

    // The queue with promises waiting to be resolved / rejected
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

        // if a receive is already scheduled, no need to do it again
        if (this.receiveTimer) return

        // active work takes precedence over idle timeout checking
        this.clearIdleTimer()

        this.receiveTimer = setTimeout(() => {
            this.receiveTimer = 0
            this.receive()
        }, this.receiveDelay)
    },

    scheduleIdleCheck() {

        // only schedule idle checks while there is no work waiting
        if (this.idleTimer || this.receiveTimer || this.qOut.length) return

        this.idleTimer = setTimeout(() => {
            this.idleTimer = 0
            this.idle()
        }, this.idleDelay)
    },

    // start the runtime
    start() {

        // stop the timers - if there are any running...
        this.clearReceiveTimer()
        this.clearIdleTimer()

        // clear the send/rcv queue
        this.qOut = []
        this.qIn = []

        // reset the counter
        this.msgCount = 0
        this.idleCount = 0

        // create the cells for each actor (node or bus)
        for (const actor of this.actors) actor.makeCell()

        // note the time
        this.startTime = Date.now()

        // start checking timeouts while idle
        this.scheduleIdleCheck()
    },

    // stop the timer, clear the queues and reset the cells
    stop() {
        // stop the receiver and idle checks
        this.clearReceiveTimer()
        this.clearIdleTimer()

        // reset the counter
        this.msgCount = 0
        this.idleCount = 0

        // clear all cells (necessary ?) - maybe something else needs to be done ?
        this.actors.forEach( actor => actor.cell = null)

        // clear the send/rcv queue
        this.qOut = []
        this.qIn = []
    },

    halt() {
        // stop the receiver and idle checks
        this.clearReceiveTimer()
        this.clearIdleTimer()
    },

    continue() {
        // restart either active receive handling or idle timeout checks
        if (this.qOut.length) this.scheduleReceive()
        else this.scheduleIdleCheck()
    },

    switch() {
        // switch the queues
        const temp = this.qIn
        this.qIn = this.qOut
        this.qOut = temp

        // and set the new send queue to 0
        this.qOut.length = 0
    },

    idle() {
        // increment the idleCount
        this.idleCount++

        // get the time
        const now = Date.now()

        // check the resolve queue for timeouts
        this.qResolve.checkTimeouts(now)

        // **** dbg only
        if (this.idleCount % 600 == 0) {
            const min = (now - this.startTime)/60000
            console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`)
        }

        // keep checking timeouts while the runtime is idle
        this.scheduleIdleCheck()
    },

    // returns a promise that is immediately rejected
    reject(reason) {
        return new Promise((resolve, reject) => {
            reject(new Error(reason));
        });
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

    // send the message to all the targets = schedule the execution of the handler
    sendTo(tx, source, param) {

        // check
        if (tx.targets.length < 1) {
            if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin)
            return 0
        }

        // keep the count
        ++this.msgCount

        const log = source.flags & LOGMSG
        for (const target of tx.targets) {
            this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef: 0, txPin: tx.pin, rxRef: 0, rxPin: target.pin})
            if (log) this.logMessage(this.qOut.at(-1))
        }

        this.idleCount = 0
        if (!this.receiveTimer) this.scheduleReceive()

        // return the number of messages sent
        return tx.targets.length
    },

    // requests data from the target(s) - returns a thenable - either a promise or a promisehandler !
    requestFrom(tx, source, param, timeout) {

        // check
        if (tx.targets.length < 1) {
            if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin)
            return this.reject('Not connected')
        }

        // increment the message counter and use as local ref
        const txRef = ++this.msgCount

        // count the number actual targets that have a channel
        let channelCount=0

        // Push the messages on the outgoing message queue. Also send txref ! It will allow to resolve the promise
        const log = (source.flags & LOGMSG)
        for (const target of tx.targets) {

            this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef, txPin: tx.pin, rxRef: 0, rxPin: target.pin})

            if (log) this.logReqReply(this.qOut.at(-1), 'request')

            if (target.channel) channelCount++;
        }

        this.idleCount = 0
        if (!this.receiveTimer) this.scheduleReceive()

        // check - if no destination with a channel, return a promise, but reject it immediately
        if (channelCount == 0) return this.reject('No channel')
            
        // add a promise handler for the number of promises required
        return this.qResolve.addPromiseHandler(txRef, timeout, channelCount)
    },

    // hix: -1 indicates that it is a reply - rxRef allows the receiver to find the promise
    reply(source, param) {

        // there must have been a request
        if (! source.msg?.txRef) return 0

        // keep the count
        ++this.msgCount

        // hix = -1 indicates that this is a reply - no txRef needed, because reply is final...
        this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef:0, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin})

        // dbg
        if (source.flags & LOGMSG) this.logReqReply(this.qOut.at(-1), 'reply') 

        this.idleCount = 0
        if (!this.receiveTimer) this.scheduleReceive()

        // return the number of messages sent
        return 1
    },

    next(source, param, timeout) {

       // there must have been a request
       if (! source.msg?.txRef) return this.reject('No target')
       
        // increment the message counter and use as local ref
        const txRef = ++this.msgCount

        // Push the messages on the outgoing message queue. Also store txref ! It will allow to resolve the promise
        this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin})

        this.idleCount = 0
        if (!this.receiveTimer) this.scheduleReceive()

        // add a promise to the resolve queue
        return this.qResolve.addPromiseHandler(txRef, timeout)
    },

    receive() {

        // if nothing to do, go back to idle timeout checking
        if (!this.qOut.length) return this.scheduleIdleCheck()

        // There are messages to handle ...switch input/output queue
        this.switch()

        // and handle the received messages
        this.handleReceiveQueue()

        // messages may have been enqueued while handling this batch
        if (this.qOut.length && !this.receiveTimer) this.scheduleReceive()
        else this.scheduleIdleCheck()
    },

    // handle the messages on the receive queue
    handleReceiveQueue() {

        // handle the messages in the in queue
        for (const msg of this.qIn) {

            // notation 
            const dest = msg.dest

            switch(msg.hix & HIX_TYPE_MASK) {

                // Normal messages have a positive handler index
                case HIX_HANDLER : {

                    // and set the current message in the destination
                    dest.msg = msg

                    // log if requested
                    if (dest.flags & LOGMSG) this.logMessage(msg)

                    //const rx = dest.rxSink[msg.hix]

                    // call the handler and set the cell as this
                    dest.rxSink[msg.hix].handler.call(dest.cell, msg.param)
                }
                break

                // replies 
                case HIX_REPLY : {

                    // log if requested
                    if (dest.flags & LOGMSG) this.logReqReply(msg, 'incoming reply') 

                    // find the promise on the resolve queue and trigger it...
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
