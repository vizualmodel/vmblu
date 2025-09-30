import {ResolveQueue} from './resolve-queue.js'
import {HIX_HANDLER, HIX_ROUTER, HIX_REPLY, HIX_TYPE_MASK, HIX_MASK} from './target'

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
    this.timer = 0                          // the timer returned by setTimeout
    this.minDelay = 0                       // delay when running fast
    this.maxDelay = 100                     // delay when running slow
    this.scheduleDelay = this.minDelay      // delay between receive scheduling
    this.idleCount = 0                      // the nr of idle loops - reset to 0 when a message arrives
    this.idleTreshold = 100                 // switch to slow regime after x consecutive idle loops
    this.slow = false                       // regime

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

    // start the runtime
    start() {

        // stop the timer - if there is one running...
        clearTimeout(this.timer)

        // clear the send/rcv queue
        this.qOut = []
        this.qIn = []

        // reset the counter
        this.msgCount = 0

        // create the cells for each actor (node or bus)
        for (const actor of this.actors) actor.makeCell()

        // note the time
        this.startTime = Date.now()

        // schedule the runtime message handler
        this.timer = setTimeout(this.receive.bind(this),this.scheduleDelay)
    },

    // stop the timer, clear the queues and reset the cells
    stop() {
        // stop the receiver
        clearTimeout(this.timer)

        // reset the counter
        this.msgCount = 0

        // clear all cells (necessary ?) - maybe something else needs to be done ?
        this.actors.forEach( actor => actor.cell = null)

        // clear the send/rcv queue
        this.qOut = []
        this.qIn = []
    },

    halt() {
        // stop the receiver
        clearTimeout(this.timer)
    },

    continue() {
        // restart the receiving process...
        this.timer = setTimeout(this.receive.bind(this),this.scheduleDelay)
    },

    switch() {
        // switch the queues
        const temp = this.qIn
        this.qIn = this.qOut
        this.qOut = temp

        // and set the new send queue to 0
        this.qOut.length = 0

        // switch back to fast if going slow
        if (this.slow) this.goFast()
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
        
        // check if we need to throttle
        if (( ! this.slow)&&(this.idleCount > this.idleTreshold)) this.goSlow()
    },

    goFast() {
        this.scheduleDelay = this.minDelay
        this.idleCount = 0
        this.slow = false
    },

    goSlow() {
        this.scheduleDelay = this.maxDelay
        this.slow = true
    },

    // returns a promise that is immediately rejected
    reject(reason) {
        return new Promise((resolve, reject) => {
            reject(new Error(reason));
        });
    },

    // send the message to all the targets = schedule the execution of the handler
    sendTo(targets, source, pin, param) {

        // check
        if (targets.length < 1) return 0

        // dbg
        //if (source.flags & LOGMSG) console.log(`send "${pin} @ ${source.name}"`)
        if (source.flags & LOGMSG) console.log(`${source.name} -> ${pin}`)
            
        // keep the count
        ++this.msgCount

        for (const target of targets)
            this.qOut.push({ from: source.uid,  txRef: 0, 
                             dest: target.actor, rxRef: 0,  
                             hix: target.hix, pin, param})

        // return the number of messages sent
        return targets.length
    },

    // requests data from the target(s) - returns a thenable - either a promise or a promisehandler !
    requestFrom(targets, source, pin, param, timeout) {

        // dbg
        //if (source.flags & LOGMSG) console.log(`request "${pin} @ ${source.name}"`)
        if (source.flags & LOGMSG) console.log(`${source.name} => ${pin}`)

        // increment the message counter and use as local ref
        const txRef = ++this.msgCount

        // count the number actual targets that have a channel
        let channelCount=0

        // Push the messages on the outgoing message queue. Also send txref ! It will allow to resolve the promise
        for (const target of targets) {

            this.qOut.push({    from:source.uid, txRef, 
                                dest:target.actor, rxRef:0, 
                                hix:target.hix, pin, param})

            if (target.channel) channelCount++;
            // same as : if (target.actor.rxTable[target.hix].channel) channelCount++
        }

        // check - if no destination with a channel, return a promise, but reject it immediately
        if (channelCount == 0) return this.reject('No channel')
            
        // add a promise handler for the number of promises required
        return this.qResolve.addPromiseHandler(txRef, timeout, channelCount)
    },

    // hix: -1 indicates that it is a reply - rxRef allows the receiver to find the promise
    reply(source, param) {

        // there must have been a request
        if (! source.msg?.txRef) return 0

        // dbg
        if (source.flags & LOGMSG) console.log(`reply to ${source.msg.pin} @ ${source.name}`)

        // keep the count
        ++this.msgCount

        // hix = -1 indicates that this is a reply - no txRef needed, because reply is final...
        this.qOut.push({    from: source.uid, txRef:0, 
                            dest: source.msg.from, rxRef: source.msg.txRef, 
                            hix: HIX_REPLY, pin: source.msg.pin, param})

        // return the number of messages sent
        return 1
    },

    next(source, param, timeout) {

       // there must have been a request
       if (! source.msg?.txRef) return this.reject('No target')
       
        // increment the message counter and use as local ref
        const txRef = ++this.msgCount

        // Push the messages on the outgoing message queue. Also store txref ! It will allow to resolve the promise
        this.qOut.push({    from:source.uid, txRef, 
                            dest:target.actor, rxRef: source.msg.txRef, 
                            hix: HIX_REPLY, pin: source.msg.pin, param})

        // add a promise to the resolve queue
        return this.qResolve.addPromiseHandler(txRef, timeout)
    },

    receive() {

        // if nothing to do 
        if (!this.qOut.length) {

            // do some idle bookkeeping - also check for promises that have timed out
            this.idle()
        }
        else {

            // There are messages to handle ...switch input/output queue
            this.switch()

            // and handle the received messages
            this.handleReceiveQueue()
        }

        // and re-schedule the message handler
        this.timer = setTimeout( this.receive.bind(this),this.scheduleDelay)
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

                    // dbg
                    //if (dest.flags & LOGMSG) console.log(`received "${msg.pin} @ ${dest.name}" run "${dest.rxTable[msg.hix].handler.name}"`)
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (run ${dest.rxTable[msg.hix].handler.name})`)

                    // call the handler and set the cell as this
                    dest.rxTable[msg.hix].handler.call(dest.cell, msg.param)
                }
                break

                // replies 
                case HIX_REPLY : {

                    // dbg
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <= ${msg.pin} (reply)`)

                    // find the promise on the resolve queue and trigger it...
                    this.qResolve.trigger(msg.rxRef, msg.param)
                }
                break

                // messages that have to pass through a router filter first also have a special hix
                case HIX_ROUTER : {

                    // dbg
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (filter via router)`)

                    // get the scope of the message
                    const scope = msg.dest.scopeTable[msg.hix & HIX_MASK]

                    // select the scope
                    const nameList = dest.cell.filter?.(scope.targets.keys(), msg.pin,  msg.param) ?? [...scope.targets.keys()]

                    // if there are many targets
                    if (Array.isArray(nameList) && nameList.length > 0) {

                        // ..call forwardAll
                        this.forwardToAll(msg, nameList, scope.targets)
                    }
                    else {
                        // there is only one target, call forward
                        const actual = scope.targets.get(nameList)

                        if (actual) this.forward(msg, actual)
                    }   
                }
                break
            }
        }
    },

    // forward a message to the actual targets of the message
    forwardToAll(msg, nameList, targets) {

        // keep track of the number of requests
        let channelCount = 0

        // call the handler for each actual target
        for (const name of nameList) {

            // get the actual target
            const actual = targets.get(name)

            // check
            if (actual) {

                // forward
                this.forward(msg, actual)

                // if the message was a request, increase the channel count
                if ((msg.txRef > 0) && actual.channel) channelCount++
            }
        }

        // change to the actual number of replies expected
        if (channelCount > 1) this.qResolve.changePromiseHandler(msg.txRef, channelCount) 
    },

    forward(msg, actual) {

        // for nodes call the handler for the pin
        if ((actual.hix & HIX_TYPE_MASK) == HIX_HANDLER) {
            
            // set the current message
            actual.actor.msg = msg

            // call the handler
            actual.actor.rxTable[actual.hix].handler.call(actual.actor.cell, msg.param)
        }
        // for routers, put the message on the outgoing queue
        else if ((actual.hix & HIX_TYPE_MASK) == HIX_ROUTER) {

            // put these on the outgoing queue
            this.qOut.push({    
                from:msg.from, txRef: msg.txRef, 
                dest:actual.actor, rxRef:0, 
                hix:actual.hix, pin: actual.pin, param: msg.param})
        }
    },

    reschedule(msg) {
        this.qOut.push(msg)
    }
}