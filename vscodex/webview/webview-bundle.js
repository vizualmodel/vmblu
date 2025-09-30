// Deferred wrapper around a Promise
function Deferred() {

    // create a promise and set _resolve and _reject
    this.promise = new Promise((resolve, reject) => {
        this._resolve = resolve;
        this._reject = reject;
    });
}
Deferred.prototype = {
  
    // when deferred is resolved/rejected call the actual resolve
    resolve(value) {
        this._resolve(value);
    },
  
    reject(error) {
        this._reject(error);
    }
};

// Handler that wraps one or more Deferreds in a thenable ifPins
function PromiseHandler(defs) {
    
    // Only store the Deferred instances
    this.defs = defs;
}
PromiseHandler.prototype = {
  
    then(onFulfilled, onRejected) {
        const newDefs = this.defs.map(d => {
            const next = new Deferred();
            d.promise
            .then(onFulfilled, onRejected)
            .then(next.resolve.bind(next), next.reject.bind(next));
            return next;
        });
        return new PromiseHandler(newDefs);
    },
  
    catch(onRejected) {
        const newDefs = this.defs.map(d => {
            const next = new Deferred();
            d.promise
            .catch(onRejected)
            .then(next.resolve.bind(next), next.reject.bind(next));
            return next;
        });
        return new PromiseHandler(newDefs);
    },
  
    // Dynamically resize the handler to hold `count` deferreds
    replace(count) {
        if (count > this.defs.length) {
            for (let i = this.defs.length; i < count; i++) {
                this.defs.push(new Deferred());
            }
        } else if (count < this.defs.length) {
            this.defs.splice(count).forEach(d => {
                // allow dropped promises to be GC'd by not resolving/rejecting
            });
        }
    }
};
  
// Queue that manages PromiseHandlers for message replies
function ResolveQueue() {

    // The min timeout is set to 1 sec
    this.minTimeout = 1000;

    // The queue is a map - txRef is teh key
    this.queue = new Map();  // txRef -> { handler: PromiseHandler, time: {start, duration} }
}
ResolveQueue.prototype = {
  
    /**
     * Always returns a PromiseHandler (even for a single reply)
     * @param {string} txRef - transaction reference
     * @param {number} timeout - desired timeout in ms
     * @param {number} count - number of expected replies (default 1)
     */
    addPromiseHandler(txRef, timeout, count = 1) {

        // Check if need to apply the min duration
        const duration = Math.max(timeout, this.minTimeout);

        // Add a deffered 
        const defs = Array.from({ length: count }, () => new Deferred());
        const handler = new PromiseHandler(defs);

        this.queue.set(txRef, { handler, time: { start: Date.now(), duration } });
        return handler;
    },
  
    /**
     * Replace the existing handler's deferred count
     * @param {string} txRef
     * @param {number} count
     */
    changePromiseHandler(txRef, count) {

        const entry = this.queue.get(txRef);
        if (!entry) return;
        entry.handler.replace(count);
    },
  
    /**
     * Trigger the next deferred in line when a reply arrives
     * @param {string} rxRef
     * @param {*} value
     */
    trigger(rxRef, value) {

        const entry = this.queue.get(rxRef);
        if (!entry) return console.log(rxRef, 'NOT FOUND');
        const d = entry.handler.defs.shift();
        d.resolve(value);
        if (entry.handler.defs.length === 0) {
            this.queue.delete(rxRef);
        }
    },
  
    /**
     * Periodically call this to reject any timed‑out handlers
     * @param {number} [now=Date.now()]
     */
    checkTimeouts(now = Date.now()) {

        for (const [txRef, entry] of this.queue.entries()) {
            const { start, duration } = entry.time;
            if (start + duration <= now) {

                // create an error
                const err = new Error(`Reply timeout for ${txRef} after ${duration}ms`);

                // reject the promise
                entry.handler.defs.forEach(d => d.reject(err));

                // remove the entry from the queue
                this.queue.delete(txRef);
            }
        }
    }
};

// The first four bits of the hix are used for the type of the target
const HIX_HANDLER =   0x00000000;
const HIX_REPLY =     0x10000000;
const HIX_ROUTER =    0x20000000;
const HIX_TYPE_MASK = 0xF0000000;  // top 4 bits
const HIX_MASK =      0x0FFFFFFF;  // lower 28 bits

function Target(uid, pin, channel = false) {

    this.uid = uid;                  // The uid of the actor
    this.actor = null;               // The actor
    this.pin = pin;                  // the name of the input pin
    this.channel = channel;          // true if the input has a channel
    this.hix = HIX_HANDLER;          // the index of the input in the rx table of the actor (where the handler is)
}

// arrows used for targets
const arrow = '->';
const channelArrow = '=>';

const convert$1 = {

    // just remove the arrow at the front and trim
    stringToInput(str) {

        const pure = str.trim();

        const symbol = pure.slice(0,2);

        const pin = pure.slice(2).trim();

        return {
            pin,
            channel: (symbol === arrow) ? false : true
        }
    },

    // make an output record for a single output string
    stringToOutput(str) {

        // helper function
        function singleTarget(str) {
            return str[0] == '[' && str.at(-1) == ']' ? false : true
        }

        // check if channel or not
        let channel = false;

        let symbolIndex = str.indexOf(arrow);
        if (symbolIndex < 0) {
            symbolIndex = str.indexOf(channelArrow);
            channel = true;
        }
        if (symbolIndex < 0) return null

        const output = str.slice(0,symbolIndex).trim();
        const targetString = str.slice(symbolIndex+2).trim();

        // check
        if (output.length == 0 || targetString.length == 0) return null

        // check if one or many
        if (singleTarget(targetString))   {

            const rawTarget = convert$1.stringToTarget(targetString);

            return rawTarget ? {output, channel, targets: [rawTarget]} : {output, channel, targets: []} 
        }
        else {

            // get all the targets between " "
            const regex = /"(?:\\.|[^"\\])*"/g;
            let matches = targetString.match(regex);
            
            // split in target strings
            const targetStringArray = matches ? matches.map(str => str.slice(1, -1).replace(/\\"/g, '"')) : [];

            // The array to collect the targets
            const rawTargets = [];

            // do all the target strings
            for (const  target of targetStringArray) {
                const rawTarget = convert$1.stringToTarget(target);
                if (rawTarget) rawTargets.push(rawTarget);
            }

            // done 
            return {output, channel, targets: rawTargets}
        }
    },

    // This function is used for the routertable
    stringToScope(str) {

        // selector and scope are seperated by a colon
        let colon = str.indexOf(':');
        if (colon < 0) return null

        const selector = str.slice(0,colon).trim();
        const scope = str.slice(colon+1).trim();

        // check
        if (selector.length == 0 || scope.length == 0) return null

        // get all the targets between " "
        const regex = /"(?:\\.|[^"\\])*"/g;
        let matches = scope.match(regex);
        
        // split in target strings
        const targetStringArray = matches ? matches.map(str => str.slice(1, -1).replace(/\\"/g, '"')) : [];

        // The array to collect the targets
        const rawTargets = [];

        // do all the target strings
        for (const  target of targetStringArray) {
            const rawTarget = convert$1.stringToTarget(target);
            if (rawTarget) rawTargets.push(rawTarget);
        }

        // done 
        return {selector, scope: rawTargets}
    },

    // format: pin name @ node name (uid)
    stringToTarget(str) {

        // get the uid at the end
        const uidStart = str.lastIndexOf('(');
        if (uidStart < 0) return null

        const uidEnd = str.lastIndexOf(')');
        if (uidEnd < 0) return null

        // check if there is anything
        if (uidEnd - uidStart < 2) return null

        const uid = str.slice(uidStart+1, uidEnd);

        const atIndex = str.indexOf('@');

        if (atIndex < 0) return null

        const pinName = str.slice(0,atIndex).trim();
        const nodeName = str.slice(atIndex+1,uidStart).trim();

        if (pinName.length == 0 || nodeName.length == 0) return null

        return {pinName, nodeName, uid}
    },

    // transforms a name to a valid javascript identifier
    pinToHandler(pinName) {

        const words = pinName
            // and split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-zA-Z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        return 'on' + cleaned.map(word  => word[0].toUpperCase() + word.slice(1)).join('');
    },
};

// The flags for the runtime 
const rtFlags = {
    LOGMSG: 0x1
};
// shorten the flags
const LOGMSG = rtFlags.LOGMSG;

// the runtime defintion
function Runtime() {

    //the actors in this runtime (nodes and filters)
    this.actors = [];

    // scheduling
    this.timer = 0;                          // the timer returned by setTimeout
    this.minDelay = 0;                       // delay when running fast
    this.maxDelay = 100;                     // delay when running slow
    this.scheduleDelay = this.minDelay;      // delay between receive scheduling
    this.idleCount = 0;                      // the nr of idle loops - reset to 0 when a message arrives
    this.idleTreshold = 100;                 // switch to slow regime after x consecutive idle loops
    this.slow = false;                       // regime

    // msg count and time run
    this.msgCount = 0;                       // total messages handles
    this.startTime = null;                   // starting time of the runtime

    // the message queues act like swinging buffers
    this.qOut = [];
    this.qIn = [];

    // The queue with promises waiting to be resolved / rejected
    this.qResolve = new ResolveQueue();
}
Runtime.prototype = {

    // start the runtime
    start() {

        // stop the timer - if there is one running...
        clearTimeout(this.timer);

        // clear the send/rcv queue
        this.qOut = [];
        this.qIn = [];

        // reset the counter
        this.msgCount = 0;

        // create the cells for each actor (node or bus)
        for (const actor of this.actors) actor.makeCell();

        // note the time
        this.startTime = Date.now();

        // schedule the runtime message handler
        this.timer = setTimeout(this.receive.bind(this),this.scheduleDelay);
    },

    // stop the timer, clear the queues and reset the cells
    stop() {
        // stop the receiver
        clearTimeout(this.timer);

        // reset the counter
        this.msgCount = 0;

        // clear all cells (necessary ?) - maybe something else needs to be done ?
        this.actors.forEach( actor => actor.cell = null);

        // clear the send/rcv queue
        this.qOut = [];
        this.qIn = [];
    },

    halt() {
        // stop the receiver
        clearTimeout(this.timer);
    },

    continue() {
        // restart the receiving process...
        this.timer = setTimeout(this.receive.bind(this),this.scheduleDelay);
    },

    switch() {
        // switch the queues
        const temp = this.qIn;
        this.qIn = this.qOut;
        this.qOut = temp;

        // and set the new send queue to 0
        this.qOut.length = 0;

        // switch back to fast if going slow
        if (this.slow) this.goFast();
    },

    idle() {
        // increment the idleCount
        this.idleCount++;

        // get the time
        const now = Date.now();

        // check the resolve queue for timeouts
        this.qResolve.checkTimeouts(now);

        // **** dbg only
        if (this.idleCount % 600 == 0) {
            const min = (now - this.startTime)/60000;
            console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`);
        }
        
        // check if we need to throttle
        if (( ! this.slow)&&(this.idleCount > this.idleTreshold)) this.goSlow();
    },

    goFast() {
        this.scheduleDelay = this.minDelay;
        this.idleCount = 0;
        this.slow = false;
    },

    goSlow() {
        this.scheduleDelay = this.maxDelay;
        this.slow = true;
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
        if (source.flags & LOGMSG) console.log(`${source.name} -> ${pin}`);
            
        // keep the count
        ++this.msgCount;

        for (const target of targets)
            this.qOut.push({ from: source.uid,  txRef: 0, 
                             dest: target.actor, rxRef: 0,  
                             hix: target.hix, pin, param});

        // return the number of messages sent
        return targets.length
    },

    // requests data from the target(s) - returns a thenable - either a promise or a promisehandler !
    requestFrom(targets, source, pin, param, timeout) {

        // dbg
        //if (source.flags & LOGMSG) console.log(`request "${pin} @ ${source.name}"`)
        if (source.flags & LOGMSG) console.log(`${source.name} => ${pin}`);

        // increment the message counter and use as local ref
        const txRef = ++this.msgCount;

        // count the number actual targets that have a channel
        let channelCount=0;

        // Push the messages on the outgoing message queue. Also send txref ! It will allow to resolve the promise
        for (const target of targets) {

            this.qOut.push({    from:source.uid, txRef, 
                                dest:target.actor, rxRef:0, 
                                hix:target.hix, pin, param});

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
        if (source.flags & LOGMSG) console.log(`reply to ${source.msg.pin} @ ${source.name}`);

        // keep the count
        ++this.msgCount;

        // hix = -1 indicates that this is a reply - no txRef needed, because reply is final...
        this.qOut.push({    from: source.uid, txRef:0, 
                            dest: source.msg.from, rxRef: source.msg.txRef, 
                            hix: HIX_REPLY, pin: source.msg.pin, param});

        // return the number of messages sent
        return 1
    },

    next(source, param, timeout) {

       // there must have been a request
       if (! source.msg?.txRef) return this.reject('No target')
       
        // increment the message counter and use as local ref
        const txRef = ++this.msgCount;

        // Push the messages on the outgoing message queue. Also store txref ! It will allow to resolve the promise
        this.qOut.push({    from:source.uid, txRef, 
                            dest:target.actor, rxRef: source.msg.txRef, 
                            hix: HIX_REPLY, pin: source.msg.pin, param});

        // add a promise to the resolve queue
        return this.qResolve.addPromiseHandler(txRef, timeout)
    },

    receive() {

        // if nothing to do 
        if (!this.qOut.length) {

            // do some idle bookkeeping - also check for promises that have timed out
            this.idle();
        }
        else {

            // There are messages to handle ...switch input/output queue
            this.switch();

            // and handle the received messages
            this.handleReceiveQueue();
        }

        // and re-schedule the message handler
        this.timer = setTimeout( this.receive.bind(this),this.scheduleDelay);
    },

    // handle the messages on the receive queue
    handleReceiveQueue() {

        // handle the messages in the in queue
        for (const msg of this.qIn) {

            // notation 
            const dest = msg.dest;

            switch(msg.hix & HIX_TYPE_MASK) {

                // Normal messages have a positive handler index
                case HIX_HANDLER : {

                    // and set the current message in the destination
                    dest.msg = msg;

                    // dbg
                    //if (dest.flags & LOGMSG) console.log(`received "${msg.pin} @ ${dest.name}" run "${dest.rxTable[msg.hix].handler.name}"`)
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (run ${dest.rxTable[msg.hix].handler.name})`);

                    // call the handler and set the cell as this
                    dest.rxTable[msg.hix].handler.call(dest.cell, msg.param);
                }
                break

                // replies 
                case HIX_REPLY : {

                    // dbg
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <= ${msg.pin} (reply)`);

                    // find the promise on the resolve queue and trigger it...
                    this.qResolve.trigger(msg.rxRef, msg.param);
                }
                break

                // messages that have to pass through a router filter first also have a special hix
                case HIX_ROUTER : {

                    // dbg
                    if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (filter via router)`);

                    // get the scope of the message
                    const scope = msg.dest.scopeTable[msg.hix & HIX_MASK];

                    // select the scope
                    const nameList = dest.cell.filter?.(scope.targets.keys(), msg.pin,  msg.param) ?? [...scope.targets.keys()];

                    // if there are many targets
                    if (Array.isArray(nameList) && nameList.length > 0) {

                        // ..call forwardAll
                        this.forwardToAll(msg, nameList, scope.targets);
                    }
                    else {
                        // there is only one target, call forward
                        const actual = scope.targets.get(nameList);

                        if (actual) this.forward(msg, actual);
                    }   
                }
                break
            }
        }
    },

    // forward a message to the actual targets of the message
    forwardToAll(msg, nameList, targets) {

        // keep track of the number of requests
        let channelCount = 0;

        // call the handler for each actual target
        for (const name of nameList) {

            // get the actual target
            const actual = targets.get(name);

            // check
            if (actual) {

                // forward
                this.forward(msg, actual);

                // if the message was a request, increase the channel count
                if ((msg.txRef > 0) && actual.channel) channelCount++;
            }
        }

        // change to the actual number of replies expected
        if (channelCount > 1) this.qResolve.changePromiseHandler(msg.txRef, channelCount); 
    },

    forward(msg, actual) {

        // for nodes call the handler for the pin
        if ((actual.hix & HIX_TYPE_MASK) == HIX_HANDLER) {
            
            // set the current message
            actual.actor.msg = msg;

            // call the handler
            actual.actor.rxTable[actual.hix].handler.call(actual.actor.cell, msg.param);
        }
        // for routers, put the message on the outgoing queue
        else if ((actual.hix & HIX_TYPE_MASK) == HIX_ROUTER) {

            // put these on the outgoing queue
            this.qOut.push({    
                from:msg.from, txRef: msg.txRef, 
                dest:actual.actor, rxRef:0, 
                hix:actual.hix, pin: actual.pin, param: msg.param});
        }
    },

    reschedule(msg) {
        this.qOut.push(msg);
    }
};

function RX(pin, channel=false) {

    this.pin = pin;
    this.channel = channel;
    this.handler = null;
}

function TX(pin, channel=false) {

    this.pin = pin;
    this.channel = channel;
    this.targets = [];
}


// the this is the cell for this function
function missingHandler(param) {

    const names = Object.getOwnPropertyNames(this);

    console.warn(`Missing handler for cell: ${names} - parameters: ${param}`);
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
function RuntimeNode({name, uid, factory, inputs, outputs, sx, dx}) {

    // name and uid of the node
    this.name = name;
    this.uid = uid;

    // the node factory
    this.factory = factory;

    // the factory can be called with new if it is a function and if the constructor does **not** point back to the function itself
    this.useNew = shouldUseNew(factory); //factory.prototype?.constructor === factory ? false : true

    // the receive and transmit table
    this.rxTable = [];
    this.txTable = [];

    // the parameters for the node
    this.sx = sx ?? null;

    // the runtime settings
    this.dx = dx ?? null;

    // set the flags
    this.flags = 0x0; 

    // the client data structure with the handlers - created by the factory 
    this.cell = null;

    // set when a message is received
    this.msg = null;

    // now set the flags for the node
    this.setFlags();

    // initialise the rx and tx tables
    this.initRxTxTables( {inputs, outputs});
}
RuntimeNode.prototype = {

    setFlags() {

        if (! this.dx?.flags) return

        if (this.dx.flags.includes('LOGMSG')) this.flags |= rtFlags.LOGMSG;
    },

    initRxTxTables({inputs,outputs} ) {

        // handle the inputs
        for ( const inputString of inputs) {

            // convert the string to an input
            const input = convert$1.stringToInput(inputString);
            if (input) this.rxTable.push(new RX(input.pin, input.channel));
        }

        // handle the outputs
        for (const outputString of outputs) {

            // first get the output 
            const raw = convert$1.stringToOutput(outputString);

            // check
            if (!raw) continue

            // a new transmit entry
            const tx = new TX(raw.output, raw.channel);

            // save
            this.txTable.push(tx);

            // add the targets
            for (const rawTarget of raw.targets) {

                // add the output pin
                tx.targets.push(new Target(rawTarget.uid, rawTarget.pinName, raw.channel));
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
                this.useNew = true;

                // do it again, but with new this time !
                this.cell = new this.factory(this.getTx(), this.sx);
            }
            else throw err;
        }

        // set the handlers in the rx Table
        this.addHandlersForCell();
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
        const proto = Object.getPrototypeOf(this.cell); 

        // get the prop names of the prototype
        const protoNames = Object.getOwnPropertyNames( proto) ?? [];

        // check the prototype names
        for (const protoName of protoNames) {

            // save to entries 
            if (typeof proto[protoName] === 'function') entries.push([protoName, proto[protoName]]);
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
            const handlerName = functionName.slice(3);

            // find the entry in the table and set the handler
            return this.rxTable.find( rx => rx.pin == handlerName)
        }

        // try the new camelcased name
        return this.rxTable.find( rx => convert$1.pinToHandler(rx.pin) == functionName)
    },

    resolveUIDs(actors) {

        // for every output pin
        this.txTable.forEach( tx => {

            // for every pin connected to that output pin
            tx.targets.forEach( target => {

                // find the node
                target.actor = actors.find( actor => actor.uid == target.uid);

                // check - should not happen 
                if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                // find the index of the handler for a node - note that target.channel has already been set
                target.hix = target.actor.factory   ? HIX_HANDLER | target.actor.rxTable.findIndex( rx => rx.pin == target.pin) 
                                                    : HIX_ROUTER | target.actor.scopeTable.findIndex( scope => scope.selector == target.pin);
            });
        });
    },

    // when sending a message find the targets for the message
    findTargets(pin) {

        //check
        if (!pin) return []

        // find the pin
        const tx = this.txTable.find( tx => tx.pin == pin);

        // check - targets is always an array, but it can be empty
        if (tx) return tx.targets

        // not found - give a warning
        console.warn(`** NO OUTPUT PIN ** Node "${this.name}" pin: "${pin}"`, this.txTable);  
        
        //..and return null
        return [] 
    },

    // return an object with the functions for the cell - done like this to avoid direct access to source !
    getTx() {

        const source = this;

        return {
            // get the output pin from the message
            get pin() {return source.msg?.pin},

            // returns the local reference of the message
            send(pin, param) {

                // check
                if (!pin) return 0

                // get the targets for this pin
                const targets = source.findTargets(pin);

                // send
                return runtime$1.sendTo(targets, source, pin, param)
            },

            // sends a request and returns a promise or an array of promises
            request(pin, param, timeout = 0) {

                // check
                if (!pin) return null

                // get the targets for this pin
                const tx = source.txTable.find( tx => tx.pin == pin);

                // check
                if (tx?.targets.length) return runtime$1.requestFrom(tx.targets, source, pin, param, timeout)

                // not found - give a warning
                console.warn(`** NO OUTPUT PIN ** Node "${this.name}" pin: "${pin}"`, this.txTable);  

                // and abort the request
                return runtime$1.reject('Not connected')
            },

            // Returns a message to the sender over the backchannel
            reply(param) {

                // a reply to a request
                return runtime$1.reply(source, param)
            },

            // sends a reply and returns a promise
            next(param, timeout = 0) {

                return runtime$1.next(source, param, timeout)
            },

            // if a message cannot be handled yet, it can be rescheduled
            reschedule() {
                if (source.msg) runtime$1.reschedule(source.msg);
            },

            // you can select a destination here - message will only be sent if there is a connection to that node
            wireless(nodeName) {

                // find the node in the runtime - use the lowercase name to find a node !
                const node = runtime$1.actors.find( actor => actor.name.toLowerCase() == nodeName.toLowerCase());

                // check
                if (!node) {
                    console.warn(`** WIRELESS SEND TO UNKNOWN NODE ** ${nodeName}`);
                    return {
                        send(pin, param) {return 0},
                        request(pin, param, timeout = 1000) { return new Promise((resolve, reject) => {reject(new Error('no node'));});}   
                    }
                }

                // A helper function - we know that node exists
                function makeTarget(pin) {
                    const L = node.rxTable.length;
                    for(let i = 0; i < L; i++) {
                        if (node.rxTable[i].pin == pin) {

                            // return a target
                            return {
                                uid: node.uid,         
                                actor: node,
                                pin,           
                                channel: node.rxTable[i].channel,  
                                hix: i,      
                            }
                        }
                    }
                    return null
                }

                return {

                    // sends a message over a pin
                    send(pin, param) {

                        // find the receiving pin in the node
                        const target = makeTarget(pin);

                        // check
                        if (!target) {
                            console.warn(`** WIRELESS SEND TO UNKNOWN PIN ** ${nodeName} pin: ${pin}`);
                            return 0
                        }

                        // send
                        return runtime$1.sendTo([target], source, pin, param)
                    },

                    // sends a request and returns a promise or an array of promises
                    request(pin, param, timeout = 0) {

                        // find the receiving pin in the node
                        const target = makeTarget(pin);

                        if (!target) {
                            console.warn(`** WIRELESS REQUEST TO UNKNOWN PIN ** ${nodeName} pin: ${pin}`);
                            return new Promise((resolve, reject) => {reject(new Error('no pin'));});  
                        }

                        // send out the request
                        return runtime$1.requestFrom([target], source, pin, param, timeout)
                    },
                }
            }

        }
    },


};

function Scope(selector) {

    // The selector for this scope
    this.selector = selector;

    // For a filter we save the targets in a map
    this.targets = new Map();
}

function RuntimeFilter({name, uid, filter, table}) {

    // name an uid
    this.name = name;
    this.uid = uid;

	// the function to create a filter 
	this.filter = filter;

    // the factory can be called with new if it is a function and if  the constructor does **not** point back to the function itself
    this.useNew = filter.prototype?.constructor === filter ? false : true;

    // The routing table - for each incoming message there is a scope - the list of possible targets
    this.scopeTable = [];

	// The instance of the filter
	this.cell = null;

	// the message that was received
	this.msg = null;

	// build the routing map for the filter
    this.buildScopeTable(table);
}
RuntimeFilter.prototype = {

    buildScopeTable(rawTable) {

        for (const routeString of rawTable) {

            // for every entry
			const rawRoute = convert$1.stringToScope(routeString);

            // and make the scope
            const scope = new Scope(rawRoute.selector);

            // for each raw target
            for (const rawTarget of rawRoute.scope) {

                // create a target object
                const target = new Target(rawTarget.uid, rawTarget.pinName);

                // add it to the scope
                //scope.targets.push(target)
                scope.targets.set(rawTarget.nodeName, target);
            }

            // save the scope - use the selector as the key
            this.scopeTable.push(scope);
        }
    },

    resolveUIDs(actors) {

        // for each entry in the map
        for (const scope of this.scopeTable) {

            // for each entry in the scope table
            for (const target of scope.targets.values()) {

                // find the target actor
                target.actor = actors.find(actor => actor.uid == target.uid); 

                // check - should not happen 
                if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                // For a node find the index of the handler 
                if (target.actor.factory) {

                    // find the index in the rx table (the table with the handlers)
                    target.actor.rxTable.find( (rx, index) => {
                        if (rx.pin != target.pin) return false
                        target.hix = HIX_HANDLER | index;
                        target.channel = rx.channel;
                        return true
                    });
                }
                else if (target.actor.filter) {

                    // find the index in the routing table 
                    target.actor.scopeTable.find( (scope, index) => {
                        if (scope.selector != target.pin) return false
                        target.hix = HIX_ROUTER | index;
                        return true
                    });
                }
            }
        }
    },

    // create a cell for the node - pass a client runtime to that cell
    makeCell() {

        // create the cell
        this.cell = this.useNew ? new this.filter() : this.filter(); 
    },

};

let runtime$1 = null;

// this function gets the name of the file to load from the initial page and starts the runtime
function scaffold(nodeList, filterList = []) {

    // create a new runtime structure
    runtime$1 = new Runtime();

    // create the run time nodes
    for (const rawNode of nodeList) {

        // create the node
        const actor = new RuntimeNode( rawNode );

        // save the node in the runtime
        runtime$1.actors.push( actor );
    }

    // create the routers
    for(const rawFilter of filterList) {

        // create the runtime router
        const actor = new RuntimeFilter( rawFilter );

        // save in the actors list
        runtime$1.actors.push( actor );
    }

    // resolve the uids in the target
    runtime$1.actors.forEach(actor => actor.resolveUIDs(runtime$1.actors));

    // done 
    return runtime$1
}

// Server error
function ServerError(message, status, cause) {
    this.message = 'HTTP code: ' + status + ': ' + message;
    this.cause = cause;
}

// time-out before operation gets aborted
const msAbort=8000;

// The Promise returned from fetch() won't reject on HTTP error status even if the response is an HTTP 404 or 500. 
// Instead, as soon as the server responds with headers, the Promise will resolve normally 
// (with the ok property of the response set to false if the response isn't in the range 200–299), 
// and it will only reject on network failure or if anything prevented the request from completing
async function get(resource,options={}) {

    // get an abort controller - not reusable !
    const controller = new AbortController();

    // add the signal to the options
    options.signal = controller.signal;

    // launch a timeout with the abort controller - when controller.abort is called - it generates a DOMException AbortError
    const id = setTimeout(() => controller.abort(), msAbort);

    // launch and wait for fetch
    return fetch(resource, options)
    .then( response => {
            // stop the timer
            clearTimeout(id);

            // check (200 - 299 range)
            if (response.ok) return response

            // throw the error
            throw new ServerError("GET failed", response.status, "")
    })
    .catch( error =>  {

        // stop the timer
        clearTimeout(id);

        // there was a network error - rethrow
        throw error
    })
}

// save with timeout
async function post(resource,body,mime='text/plain') {

    // get an abort controller - not reusable !
    const controller = new AbortController();

    // launch a timeout with the abort controller
    const id = setTimeout(() => controller.abort(), msAbort);

    let options = {
        method: 'POST',                     // *GET, POST, PUT, DELETE, etc.
        mode: 'cors',                       // no-cors, *cors, same-origin
        cache: 'no-cache',                  // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',         // include, *same-origin, omit
        headers: {
          'Content-Type': mime
        },
        redirect: 'follow',                 // manual, *follow, error
        referrerPolicy: 'no-referrer',      // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body,                               // body data type must match "Content-Type" header

        signal: controller.signal
    };
    // launch and wait for fetch
    const response = await fetch(resource, options)
    .catch(error => {
        // log
        console.log("Network failure", error);

        // rethrow
        throw error       
    });
    // stop the timer 
    clearTimeout(id);

    // check what we got in return
    if (response.ok) return response

    // throw the error
    let srvError = await response.json();
    throw new ServerError("POST failed", response.status, srvError)
}

// regular expression for a file name and path
// The file extension is handled separately when required

const MAX_EXT_LENGTH = 6;

function hasExt(path) {

    // get the position of the last period
    let n = path.lastIndexOf('.');

    // check
    return (n>0 && ((path.length - n) <= MAX_EXT_LENGTH))
}

// extension period not included
function getExt(path) {
    // get the position of the last period
    let n = path.lastIndexOf('.');

    // get the extension of the file - if any
    return n < 0 ? '' : path.slice(n+1)
}

function changeExt(path, newExt) {
    // get the position of the last period
    let n = path.lastIndexOf('.');

    // change the extension (the period is part of path)
    return n > 0 ? path.slice(0,n+1) + newExt : path + '.' + newExt
}

function removeExt(path) {

    // get the position of the last period
    let n = path.lastIndexOf('.');

    return n > 0 ? path.slice(0,n) : path
}

function fileName(path) {

    const slash = path.lastIndexOf('/');
    return slash < 0 ? path : path.slice(slash+1)
}

function nameOnly(path) {
    // get the last slash or 0
    let slash = path.lastIndexOf('/');

    // find the extension if any
    let period = path.lastIndexOf('.');

    // return the relevant part of the path
    return (period > slash) ? path.slice(slash+1, period) : path.slice(slash+1)
}

// Examples
// console.log(isAbsolutePath('/users/docs'));  // Returns true
// console.log(isAbsolutePath('users/newfile.txt'));  // Returns false
// console.log(isAbsolutePath('https://example.com'));  // Returns true
// console.log(isAbsolutePath('C:\\Users\\docs'));  // Returns true
// console.log(isAbsolutePath('file:///C:/Users/docs'));  // Returns true

function isAbsolutePath(path) {
    // Checks if the path starts with '/', 'http://', 'https://', 'file://', or a Windows drive letter
    return /^(\/|https?:\/\/|file:\/\/\/|[a-zA-Z]:\\)/.test(path);
}

// returns the last i where the strings are the same
function commonPart(a,b) { 
    const max = a.length < b.length ? a.length : b.length;
    for (let i=0;i<max;i++) { if (a[i] != b[i]) return i } 
}

// make a path relative to the reference
// relativePath  /A/B/C/filea , /A/B/fileb => ./C/filea
// relativePath  /A/B/C/filea , /A/B/G/fileb => ../C/filea
// relativePath  /A/B/C/filea , /A/B/G/F/fileb => ../../C/filea
function relative(path, ref) {

    // find it - but change to lowercase first
    const common = commonPart( path,ref );

    // find the last / going backward
    let slash = path.lastIndexOf('/',common);

    // if nothing in common
    if (slash < 1) return path

    // get rid of the common part
    let newPath = path.slice(slash+1);
    let newRef = ref.slice(slash+1);

    // we will make a prefix
    let prefix ='./';

    // if the ref is in a subdirectory we first have to come out of that sub
    slash = newRef.indexOf('/');
    if ( slash > 0) {

        // go up the directory chain
        prefix = '../';
        while ((slash = newRef.indexOf('/',slash+1)) > -1) {

            // add a new step up
            prefix += '../';

            // keep it reasonable - do not get stuck in the loop
            if (prefix.length > 100) break
        }
    }

//console.log('PATH ',path, ref, '==>', prefix, '+', newPath)

    return prefix + newPath
}

// if path starts with ./ or ../ or just name, make it into an absolute path based on the ref path.
// the ref path is always considered to be a file 
// The rules are as follows
//                      /a/b/c + /d = /d
//                      /a/b/c + ./d = /a/b/d
//                      /a/b/c + ../d = /a/d
//                      /a/b/c + d = /a/b/d
function absolute(path, ref) {

    let slash = 0;
    let folder = null;

    // check
    if (!ref  || ref.length == 0)  return path
    if (!path || path.length == 0) return ref

    // check that path and ref are valid path names - use the regex ..(TO DO)

    // if the path is already absolute, just return path
    if (path.startsWith('/')) {
        return path
    }
    // the path is relative to the ref
    else if (path.startsWith('./')) {

        slash = ref.lastIndexOf('/');
        folder = slash < 0 ? '' : ref.slice(0, slash);

        return folder + '/' + path.slice(2)
    }
    // the path starts with ../../ etc
    else if (path.startsWith('../')) {

        slash = ref.lastIndexOf('/');
        folder = slash < 0 ? '' : ref.slice(0, slash);

        while (path.startsWith('../')) {

            // remove one folder from folder
            slash = folder.lastIndexOf('/');
            folder = slash < 0 ? '' : folder.slice(0, slash);

            // take of the leading ../
            path = path.slice(3);
        }

        return folder + '/' + path
    }
    // the path starts with a character == same as ./ case
    else {
        slash = ref.lastIndexOf('/');

        folder = slash < 0 ? '' : ref.slice(0, slash);

        return folder + '/' + path
    }
}

// domain path resource are the shorthands as they appear in the workspace file 
function ARL(userPath) {

    // the reference to the ARL as entered by the user
    this.userPath = userPath;

    // the resolved url
    this.url = null;
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - sets the user path as ./last
// typically used as new ARL().absolute(url)
absolute(url) {

    // find the last slash
    const slash = url.lastIndexOf('/');

    // set the user path
    this.userPath = slash >= 0 ? '.' + url.slice(slash) : url;

    // generate the url
    this.url = new URL(url);

    // return the arl
    return this
},

toJSON() {
    return this.userPath
},

equals(arl) {

    return (this.url && arl.url)&&(this.url.href == arl.url.href)
},

// returns true if both files are in the same directory
sameDir(arl) {

    if (!this.url || !arl.url) return false

    const slash1 = this.url.href.lastIndexOf('/');
    const slash2 = arl.url.href.lastIndexOf('/');

    return this.url.href.slice(0,slash1) === arl.url.href.slice(0, slash2)
},

getPath() {
    return this.userPath
},

getExt() {
    // get the position of the last period
    let n = this.userPath.lastIndexOf('.');

    // get the extension of the file - if any
    return n < 0 ? '' : this.userPath.slice(n+1)
},

getName() {
    // for repo:/dir1/dir2 we use dir2
    const slash = this.userPath.lastIndexOf('/');
    if (slash > 0) return this.userPath.slice(slash+1)

    // for repo: we use repo
    const colon = this.userPath.indexOf(':'); 
    if (colon > 0) return this.userPath.slice(0, colon) 
    
    // othrewise just use the userpath
    return this.userPath
},

// The full pathname - no host and no queries
getFullPath() {
    return this.url ? this.url.pathname : this.userPath
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(userPath) {

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${userPath} - missing reference`);
        return null
    }

    // make an arl
    const arl = new ARL(userPath);

    // and make a url that is relative to this
    arl.url = new URL(userPath, this.url);

    // done
    return arl
},

resolve_dbg(userPath) {

    const arl = this.resolve(userPath);
    console.log(`%cresolved: ${userPath} using ${this.userPath} to ${arl.userPath}`, 'background: #ff0; color: #00f');
    return arl
},

// make a new user path relative to this new reference - the actual url does not change
makeRelative( ref ) {

    // if the user path contains a colon, it is an absolute path - nothing to change
    //const colon = this.userPath.indexOf(':')
    //if (colon > 0) return

    // check if the new path and the old path have a part incommon
    let oldFullPath = this.getFullPath();
    let refFullPath = ref.getFullPath();

    // express the old full path as a reference to the new ref full path
    this.userPath = relative(oldFullPath, refFullPath);
},

copy() {
    const arl = new ARL(this.userPath);
    arl.url = this.url ? new URL(this.url) : null;
    return arl
},

validURL() {
    if (!this.url) {
        console.error(`missing url ${this.path}`);
        return false
    } 
    return true
},

async get(as='text') {

    // check
    if (!this.validURL()) return null

    // get the file - return the promise
    return get(this.url)
    .then( async response => {

        // the size of the body could be 0 - that is ok
        if (response.headers.get('Content-Length') == '0') return null

        // wait for the content and return it 
        return (as=='json') ? await response.json() : await response.text()
    })
},

async save(body) {

    // check
    if (!this.validURL()) return null

    // add a query
    let query = `?action=save`;

    // post the content
    return post(this.url+query, body)
},

async getFolder() {

    // check
    if (!this.validURL()) return null

    // wet have to add the api and service 
    let href = this.url.origin + '/api/folder' + this.url.pathname;

    const url = new URL(href);

    // request the file - return the body
    return await get(url)
    .then( async response => {

        // the size of the body could be 0 - that is ok
        if (response.headers.get('Content-Length') == '0') return null
        
        // convert
        return await response.json()
    })
},

// javascript source files can be imported
async jsImport() {

    // check
    if (!this.validURL()) return null

    return import(this.url)
},

async getFolderContent(){

    const content = {
        files: [],
        folders: []
    };

    // get the folder - return the promise
    return this.getFolder()
    .then( raw => {
        
        // convert to arls...
        content.files = raw.files.map(name => this.resolve(this.userPath + '/' + name)),
        content.folders = raw.folders.map(name => this.resolve(this.userPath + '/' + name));
        
        // return result - that resolves the promise
        return content
    })
    .catch (error => {

        // debug
        console.error(error);

        // if the path was not found, fail silently else throw
        if (error.options?.status != '404') throw error

        // return result
        return content
    })
}

// async post(body, mime='application/json', query=null) {

//     // post the content
//     return query ? HTTP.post(this.url+query, body, mime) :  HTTP.post(url, body, mime)
// },

// // create the folder
// async createFolder() {
// },

// // remove the file
// async remove() {

//     // remove the folder on the server
//     return HTTP.del(this.url)
//     .catch( error => {

//         // if the path was not found, fail silently 
//         if (error.options.status != '404') throw error
//     })
// },

// // rename the file 
// rename(newName){

//     // construct the url 
//     // const url = this.makeUrl()

//     // prepare the query
//     let query = `?action=rename&new-name=${newName}`

//     // request the name change - return the promise 
//     return HTTP.post(this.url+query)
//     .then( response => {

//         // change the name
//         this.xxxchangeFileName(newName)

//         // succesful
//         return response
//     })
// },
};

/* eslint-disable no-undef */
// import arl to change some of the functions

// *************************************************************************************
// In the case of vscode extension, the url is the string path for the arl !! 
// It is **not** a uri structure 
// the string is converted from and to uri by using vscode.parse(uri) / uri.toString()
// *************************************************************************************

const vscode = acquireVsCodeApi();
let rqKey = 1;

// the callback map
const promiseMap = new Map();

// The function called to change some of the methods of ARL
function adaptARL() {
	
	// change some of the ARL methods
	Object.assign(ARL.prototype, vscodeARLmethods);
}

// The list of methods that need to be changed...
const vscodeARLmethods = {

	// set the user path as ./last
	absolute(url) {

		// find the last slash
		const slash = url.lastIndexOf('/');

		// make the userpath
		this.userPath = slash >= 0 ? '.' + url.slice(slash) : url;

		// set the url
		this.url = url;

		// return the arl
		return this;
	},

	// resolves a userpath wrt this arl - returns a new arl
	resolve(userPath) {

		// if the filepath has backslashes it is a native windows format that has to be adapted
		if (userPath.indexOf('\\') > -1) return this.nativeWindows(userPath);

		// make a new arl
		const arl = new ARL(userPath);

		// make the url from this url and the user path
		arl.url = absolute(userPath, this.url);


		// done
		return arl;
	},

	// absolute native windows format (mainly from the documentation)
	nativeWindows(windowsPath) {

		// change backslashes to forward slashes
		windowsPath = windowsPath.replace(/\\/g, '/');

		// change the ':' to '%3A'
		if (windowsPath.indexOf(':') > -1) windowsPath = windowsPath.replace(/:/g,'%3A');

		// find the last slash
		const slash = windowsPath.lastIndexOf('/');

		// make the userpath
		const userPath = slash >= 0 ? '.' + windowsPath.slice(slash) : url;

		// create a url
		const arl = new ARL(userPath);

		// and set the url
		arl.url = 'file:///' + windowsPath;

		return arl;
	},

	// two arl are equal if the url are equal
	equals(arl) {
		return this.url && arl.url ? (this.url == arl.url) : false;
	},

	// returns true if both files are in the same directory
	sameDir(arl) {

		if (!this.url || !arl.url) return false;

		const slash1 = this.url.lastIndexOf('/');
		const slash2 = arl.url.lastIndexOf('/');

		return this.url.slice(0,slash1) === arl.url.slice(0, slash2);
	},

	// returns a copy of this arl
	copy() {
		const arl = new ARL(this.userPath);
		arl.url = this.url.slice();
		return arl;
	},

	// returns the full path of the vscode uri
	getFullPath() {
		return this.url;
	},

	// for get we use the access to the filesystem that we have at the vscode-side - therefore we send a message
	async get( as = 'text') {

		// create a promise - save the resolve id in the resolve map
		const promise = new Promise( resolve => promiseMap.set(rqKey, resolve));

		// send a message to the message handler for the document
		vscode.postMessage({verb:'HTTP-GET', arl:this, format: as, rqKey});

		// increment the key value only now !
		rqKey++;

		// return the promise for this request
		return promise;
	},

	async jsImport() {
	},


	async save(body) {

		// create a promise - save the resolve id in the resolve map
		const promise = new Promise( resolve => promiseMap.set(rqKey, resolve));

		// encode the string as a Utf8Array
		const encoder = new TextEncoder();
		const bodyAsBytes = encoder.encode(body);

		// send a message to the message handler for the document
		vscode.postMessage({verb:'HTTP-POST', arl:this, bytes: bodyAsBytes, rqKey});

		// increment the key value only now !
		rqKey++;

		// return the promise for this request
		return promise;
	}
};

/* eslint-disable no-undef */

// This function catches the console.log output in the webview part
// save the original console function
const consoleLog = console.log;

// and adapt it now
function adaptConsole() {

	// Overriding console.log to capture logs and send them to the extension
	console.log = function(...args) {

		// keeps the default behavior
		consoleLog.apply(console, args);

        // sanitize data is a recursive function - max depth avoids endless loops
        const maxDepth = 2;
        const visited = new WeakSet(); // Use a single WeakSet for all arguments

		// Sanitize each argument
		const sanitizedArgs = args.map(arg => sanitizeData(arg, maxDepth, visited));

		// Convert each argument to a string in a readable form
		const stringifiedArgs = sanitizedArgs.map(arg => {
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2); // Pretty print objects
				} catch (e) {
					return '[Unable to stringify]';
				}
			}
			return arg; // Non-objects are returned as is
		});
		
		// send the resulting string
		vscode.postMessage({ verb: 'console log', string: stringifiedArgs.join(' ')}); 
	};
}

// sanitize the data
function sanitizeData(data, depth, visited) {

    if (depth == 0) return '[Max depth]';

    if (data === null || data === undefined) return data; // Null or undefined can be cloned

    // Check if data is an object or an array, and prepare to iterate
    if (typeof data === 'object' || Array.isArray(data)) {

        // Detect circular references
        if (visited.has(data)) {
            return '[Circular]';
        }
        visited.add(data);

        // Initialize as array or object
        const newData = Array.isArray(data) ? [] : {}; 

        // Go through the data
        for (const key in data) {

            // Ensure the property belongs to the object and not its prototype
            if (Object.prototype.hasOwnProperty.call(data, key)) {

                if (typeof data[key] === 'function') {

                    // Functions can't be cloned => replacing with a descriptive string
                    newData[key] = `Function: ${data[key].name}`;

                } else {

                    // Recursively sanitize nested objects or arrays
                    newData[key] = sanitizeData(data[key], depth - 1, visited);
                }
            }
        }
        visited.delete(data); // Remove from visited to handle other branches correctly
        return newData;
    }

    // Directly return non-object, non-array types
    return data;
}

// use path variables later ?
// const RR = new Path2D()
const shape = {

// xy position, w width, h height, r radius at the corner
 _roundedRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.arcTo(x + w, y, x + w - r, y, r);
    ctx.arcTo(x, y, x, y + r, r);
},

// a router symbol
// _router(ctx, x, y, r) {
//     let cx = x-2
//     let cy = y-2
//     ctx.moveTo(cx-r-4,cy)
//     ctx.arc(cx, cy,r+4,Math.PI,-Math.PI/2)
//     ctx.moveTo(cx-r,cy)
//     ctx.arc(cx, cy,r,Math.PI,-Math.PI/2)
//     ctx.moveTo(cx-r+4,cy)
//     ctx.arc(cx, cy,r-4,Math.PI,-Math.PI/2)
// },

// the rectangle for the overlay
rectRect(ctx,x,y,w,h,cLine,cFill) {

    if (cFill) {
        ctx.fillStyle = cFill;
        ctx.fillRect(x,y,w,h);
    }
    if (cLine) {
        ctx.strokeStyle = cLine;
        ctx.strokeRect(x,y,w,h);
    }
},

diamond(ctx,x,y,w,h,cFill) {
    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.moveTo(x+w/2,y);
    ctx.lineTo(x+w,y+h/2);
    ctx.lineTo(x+w/2,y+h);
    ctx.lineTo(x,y+h/2);
    ctx.lineTo(x+w/2,y);
    ctx.fill();
},

viewTitle(ctx, x, y, h, titleClr, title) {
    ctx.fillStyle = titleClr;
    ctx.fillText(title, x + h * 0.5, y + h * 0.75);
},

// a rectangle with rounded corners
viewRect(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI;

    ctx.beginPath();
    ctx.lineWidth = wLine;
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2);
    ctx.lineTo(x+w-r, y);
    ctx.arc(x+w-r,y+r,r,-pi/2,0);
    ctx.lineTo(x+w, y+h-r);
    ctx.arc(x+w-r, y+h-r,r,0,pi/2);
    ctx.lineTo(x+r, y+h);
    ctx.arc(x+r,y+h-r,r,pi/2,pi);
    ctx.lineTo(x,y+r);

    // make a resize symbol in the bottom right corner
    ctx.moveTo(x+w, y+h-r);
    ctx.lineTo(x+w-r, y+h);

    if (cFill) {
        ctx.fillStyle = cFill;
        ctx.fill();
    }
    if (cLine) {
        ctx.strokeStyle = cLine;
        ctx.stroke();
    }
},

// a rectangle with rounded corners
roundedRect(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI;

    ctx.beginPath();
    ctx.lineWidth = wLine;
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2);
    ctx.lineTo(x+w-r, y);
    ctx.arc(x+w-r,y+r,r,-pi/2,0);
    ctx.lineTo(x+w, y+h-r);
    ctx.arc(x+w-r, y+h-r,r,0,pi/2);
    ctx.lineTo(x+r, y+h);
    ctx.arc(x+r,y+h-r,r,pi/2,pi);
    ctx.lineTo(x,y+r);
    if (cFill) {
        ctx.fillStyle = cFill;
        ctx.fill();
    }
    if (cLine) {
        ctx.strokeStyle = cLine;
        ctx.stroke();
    }
},

roundedHeader(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI;

    ctx.beginPath();
    ctx.lineWidth = wLine;
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2);
    ctx.lineTo(x+w-r, y);
    ctx.arc(x+w-r,y+r,r,-pi/2,0);
    ctx.lineTo(x+w, y+h);
    ctx.lineTo(x, y+h);
    ctx.lineTo(x,y+r);
    if (cFill) {
        ctx.fillStyle = cFill;
        ctx.fill();
    }
    if (cLine) {
        ctx.strokeStyle = cLine;
        ctx.stroke();
    }
},

grid(ctx, x, y, w, h, dx, dy, cLine, cAxis) {

    ctx.beginPath();

    ctx.lineWidth = 1;
    ctx.strokeStyle = cLine;

    const maxy = y + h;
    for (let sy = y-y%dy; sy < maxy; sy += dy) {
        ctx.moveTo(x, sy);
        ctx.lineTo(x+w, sy);
    }
    const maxx = x + w;
    for (let sx = x-x%dx; sx < maxx; sx += dx) {
        ctx.moveTo(sx, y);
        ctx.lineTo(sx, y+h);
    }
    ctx.stroke();

    // The x and y axis
    ctx.beginPath();
    ctx.strokeStyle = cAxis;
    ctx.moveTo(x,0);
    ctx.lineTo(x+w, 0);
    ctx.moveTo(0, y);
    ctx.lineTo(0, y+h);
    ctx.stroke();
},

bullet(ctx,x,y,R,cLine,cFill) {
    ctx.beginPath();
    ctx.arc(x,y,R,0,2*Math.PI);
    if (cFill) {
        ctx.fillStyle = cFill;
        ctx.fill();
    }
    if (cLine) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = cLine;
        ctx.stroke();
    }
},

textWidth(ctx,text) {
    return ctx.measureText(text).width
},

// Fit a string to a given pixel width using the current ctx.font.
// Returns the possibly truncated string, optionally ending with an ellipsis.
fitText(ctx, text, maxWidth) {

    // Early accept
    const fullWidth = ctx.measureText(text).width;
    if (fullWidth <= maxWidth) return text;

    const ellipsis = '…';
    const ellW = ctx.measureText(ellipsis).width;

    // Binary search for the largest prefix that fits (including ellipsis width)
    let low = 0, high = text.length;
    let best = 0;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const substr = text.slice(0, mid);
        const w = ctx.measureText(substr).width + ellW;
        if (w <= maxWidth) {
            best = mid;
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    const clipped = text.slice(0, best);
    return clipped + ellipsis;
},

labelText(ctx, text, font, cText,x,y,w,h) {

    // change the font
    const saveFont = ctx.font;
    ctx.font = font;

    ctx.fillStyle = cText;
    ctx.fillText(text,x,y + 0.5*h);

    // set the font back
    ctx.font = saveFont;
},
labelCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width;
    return {x: x + cx + 1, y: y-0.25*h}
},


leftText(ctx, text, cText,x,y,w,h) {
    ctx.fillStyle = cText;
    ctx.fillText(text,x,y + 0.75*h);
},

rightText(ctx, text,cText,x,y,w,h) {
    ctx.fillStyle = cText;
    let tw = ctx.measureText(text).width;
    ctx.fillText(text, x + w - tw, y+0.75*h);
},

rightTextMulti(ctx, text, fMulti, cText,x,y,w,h) {

    // set the color
    ctx.fillStyle = cText;

    // set the actual y-position
    y += 0.75*h;

    // cut the text in three parts 
    const opbr = text.indexOf('[');
    const clbr = text.indexOf(']');
    const pre = text.slice(0, opbr+1);
    const multi = text.slice(opbr+1,clbr);
    const post = text.slice(clbr);

    // save the font
    const savedFont = ctx.font;

    // total width 
    const wPre = ctx.measureText(pre).width; 
    const wPost = ctx.measureText(post).width;
    ctx.font = fMulti;
    const wMulti = ctx.measureText(multi).width;

    // write the text
    ctx.font = savedFont;
    x = x + w - wPre - wMulti - wPost;
    ctx.fillText(pre,x,y);

    ctx.font = fMulti;
    x += wPre;
    ctx.fillText(multi,x, y);

    ctx.font = savedFont;
    x += wMulti;
    ctx.fillText(post,x,y);
},

leftTextMulti(ctx, text, fMulti, cText,x,y,w,h) {

    ctx.fillStyle = cText;
 
    // set the color
    ctx.fillStyle = cText;

    // set the actual y-position
    y += 0.75*h;

    // cut the text in three parts 
    const opbr = text.indexOf('[');
    const clbr = text.indexOf(']');
    const pre = text.slice(0, opbr+1);
    const multi = text.slice(opbr+1,clbr);
    const post = text.slice(clbr);

    // save the font
    const savedFont = ctx.font;

    // sizes
    const wPre = ctx.measureText(pre).width; 
    ctx.font = fMulti;
    const wMulti = ctx.measureText(multi).width;

    // write the text
    ctx.font = savedFont;
    ctx.fillText(pre,x,y);

    ctx.font = fMulti;
    x += wPre;
    ctx.fillText(multi,x, y);

    ctx.font = savedFont;
    x += wMulti;
    ctx.fillText(post,x,y);
},

centerText(ctx, text,font, cText,x,y,w,h) {

    const saveFont = ctx.font;
    ctx.font = font;
    ctx.fillStyle = cText;
    let tm = ctx.measureText(text);
    ctx.fillText(text, x + (w - tm.width)/2, y+0.75*h);
    ctx.font = saveFont;
},

centerLineText(ctx, text,cText,cLine,x,y,w,h) {

    ctx.beginPath();
    ctx.fillStyle = cText;
    ctx.strokeStyle = cLine;
    const tm = ctx.measureText(text);
    const guard = 5;

    ctx.moveTo(x,y+h/2);
    ctx.lineTo(x + (w - tm.width)/2 - guard, y+h/2);
    ctx.moveTo(x + (w + tm.width)/2 + guard, y+h/2);
    ctx.lineTo(x+w,y+h/2);
    ctx.stroke();

    ctx.fillText(text, x + (w - tm.width)/2, y+0.75*h);
},

interfaceText(ctx, text, font, cText, cLine,x,y,w,h) {
    
    ctx.beginPath();

    // change the font
    const saveFont = ctx.font;
    ctx.font = font;

    ctx.strokeStyle = cLine;
    const tm = ctx.measureText(text);
    const guard = 5;

    ctx.moveTo(x,y+h/2);
    ctx.lineTo(x + (w - tm.width)/2 - guard, y+h/2);
    ctx.moveTo(x + (w + tm.width)/2 + guard, y+h/2);
    ctx.lineTo(x+w,y+h/2);
    ctx.stroke();

    ctx.fillStyle = cText;
    ctx.fillText(text, x + (w - tm.width)/2, y+0.75*h);

    ctx.font = saveFont;
},

centerTextCursor(ctx,rc,text,pChar) {
    let x = rc.x + rc.w/2 - ctx.measureText(text).width/2;
    let cx = ctx.measureText(text.slice(0,pChar)).width;
    return {x: x + cx + 1, y: rc.y}
},

leftTextCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width;
    return {x: x + cx + 1, y:y}
},

// get  the cursor position for a pin - cursor at position p is infront of character p
rightTextCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width;
    return {x: x + w - ctx.measureText(text).width + cx, y: y}
},

// draw a cursor
cursor(ctx,x,y,w,h,cCursor) {

    ctx.fillStyle = cCursor;
    ctx.fillRect(x,y,w,h);
},

// to draw pads
bulletRect(ctx,x,y,w,h,cRect, rBullet) {

    ctx.beginPath();
    ctx.fillStyle = cRect;
    ctx.fillRect(x + rBullet, y, w, h);
    ctx.arc(x + rBullet,y+h/2,rBullet,Math.PI/2,-Math.PI/2);
    //ctx.arc(x + rBullet,y+h/2,rBullet,0,2*Math.PI)
    ctx.fill();
},

rectBullet(ctx,x,y,w,h, cRect, rBullet) {

    ctx.beginPath();
    ctx.fillStyle = cRect;
    ctx.fillRect(x, y, w - rBullet, h);
    ctx.arc(x + w - rBullet,y+h/2,rBullet,-Math.PI/2,Math.PI/2);
    //ctx.arc(x + w - rBullet,y+h/2,rBullet,0,2*Math.PI)
    ctx.fill();
},

corner(ctx,top,left, x,y,w,h, cFill) {

    ctx.beginPath();
    ctx.fillStyle = cFill;
    if (left){
        ctx.moveTo(x, y);
        ctx.lineTo(x+w,y+h);
        ctx.arc(x+w/2, y+h/2,w/2,Math.PI/2,Math.PI);
        ctx.lineTo(x,y);
    }
    else {
        ctx.moveTo(x, y+h);
        ctx.lineTo(x+w,y);
        ctx.arc(x+w/2, y+h/2,w/2,0,Math.PI/2);
        ctx.lineTo(x,y+h);
    }
    ctx.fill();
},

leftTriangle(ctx, x,y,w,h,cFill) {
    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.moveTo(x,y+h/2);
    ctx.lineTo(x+w,y+h);
    ctx.lineTo(x+w,y);
    ctx.lineTo(x,y+h/2);
    ctx.fill();
},

rightTriangle(ctx, x,y,w,h,cFill) {
    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.moveTo(x,y);
    ctx.lineTo(x,y+h);
    ctx.lineTo(x+w,y+h/2);
    ctx.lineTo(x,y);
    ctx.fill();
},

triangleBall(ctx, x,y,w,h,cFill) {

    const r = 3;
    const h2 = h/2;

    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.moveTo(x,y+h2);
    ctx.lineTo(x+w,y+h);
    ctx.lineTo(x+w,y);
    ctx.lineTo(x,y+h2);

    ctx.arc(x+w+r,y+h2,r,0,2*Math.PI);

    ctx.fill();
},

ballTriangle(ctx, x,y,w,h,cFill) {

    const r = 3;
    const h2 = h/2;

    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.moveTo(x,y);
    ctx.lineTo(x,y+h);
    ctx.lineTo(x+w,y+h2);
    ctx.lineTo(x,y);

    ctx.arc(x-r,y+h2,r,0,2*Math.PI);

    ctx.fill();
},

triangle(ctx, x,y,w,h,type,cFill) {

    ctx.beginPath();
    ctx.fillStyle = cFill;
    switch (type) {

    case "up":
        ctx.moveTo(x, y+h);
        ctx.lineTo(x+w,y+h);
        ctx.lineTo(x+w/2,y);
        ctx.lineTo(x,y+h);
        break

    case "down" :
        ctx.moveTo(x,y);
        ctx.lineTo(x+w/2,y+h);
        ctx.lineTo(x+w,y);
        ctx.lineTo(x,y);
        break

    case "left" :
        ctx.moveTo(x,y+h/2);
        ctx.lineTo(x+w,y+h);
        ctx.lineTo(x+w,y);
        ctx.lineTo(x,y+h/2);
        break

    case "right" :
        ctx.moveTo(x,y);
        ctx.lineTo(x,y+h);
        ctx.lineTo(x+w,y+h/2);
        ctx.lineTo(x,y);
        break
    }
    ctx.fill();
},


// t is the width of the top segment
tack(ctx, type, channel, top, rc,t,cFill) {

    ctx.beginPath();
    ctx.fillStyle = cFill;

    let {x,y,w,h} = rc;

    const r = 3;
    let cx = x + w/2;
    let cy = y + h/2;

    switch (type) {

    case "up":
        ctx.moveTo(x, y+h);
        ctx.lineTo(x+w,y+h);
        ctx.lineTo(x+(w+t)/2,y);
        ctx.lineTo(x+(w-t)/2,y);
        ctx.lineTo(x,y+h);
        if (channel) cy = top ? y - r : y + h + r;
        break

    case "down" :
        ctx.moveTo(x,y);
        ctx.lineTo(x+(w-t)/2,y+h);
        ctx.lineTo(x+(w+t)/2,y+h);
        ctx.lineTo(x+w,y);
        ctx.lineTo(x,y);
        if (channel) cy = top ? y + h + r : y - r;
        break

    case "left" :
        ctx.moveTo(x,y+(h-t)/2);
        ctx.lineTo(x,y+(h+t)/2);
        ctx.lineTo(x+w,y+h);
        ctx.lineTo(x+w,y);
        ctx.lineTo(x,y+(h-t)/2);
        if (channel) cx = top ? x - r : x + w + r;
        break

    case "right" :
        ctx.moveTo(x,y);
        ctx.lineTo(x,y+h);
        ctx.lineTo(x+w,y+(h+t)/2);
        ctx.lineTo(x+w,y+(h-t)/2);
        ctx.lineTo(x,y);
        if (channel) cx = top ? x + w + r : x - r;
        break
    }
    if (channel) ctx.arc(cx,cy,r,0,2*Math.PI);
    ctx.fill();
},

filterSign(ctx,point, width, color){

    let cx = point.x - width/2;
    let cy = point.y - width/2;

    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, width, width);
    ctx.fillStyle = "#000000";
    ctx.fillRect(cx + 2, cy + 2, width-4, width-4);
},

// the text is centered in the label 
hBusbarLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    ctx.beginPath();
    ctx.fillStyle = cRect;
    shape._roundedRect(ctx,x,y,w,h,r);
    ctx.fill();

    // center the text
    ctx.fillStyle = cText;
    ctx.fillText(text,x + w/2 - ctx.measureText(text).width/2, y + 0.75*h);  
},

// the text is centered in the label 
vBusbarLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    ctx.beginPath();
    ctx.fillStyle = cRect;
    shape._roundedRect(ctx,x,y,w,h,r);
    ctx.fill();

    ctx.save();                 // Save the current state
    ctx.translate(x,y);         // the rectangle is at the origin
    ctx.rotate(-Math.PI / 2);   // Rotate the canvas 90 degrees counterclockwise
    ctx.fillStyle = cText;
    ctx.fillText(text, -h/2 - ctx.measureText(text).width/2  , 0.75*w);  // center the text
    ctx.restore();              // Restore the state
},

// draws three arches
wirelessSymbol(ctx, x, y,r,color) {

    // router symbol
    ctx.beginPath();
    ctx.strokeStyle = color;
    //shape._router(ctx,x,y,r)

    let cx = x-2;
    let cy = y-2;
    ctx.moveTo(cx-r-4,cy);
    ctx.arc(cx, cy,r+4,Math.PI,-Math.PI/2);
    ctx.moveTo(cx-r,cy);
    ctx.arc(cx, cy,r,Math.PI,-Math.PI/2);
    ctx.moveTo(cx-r+4,cy);
    ctx.arc(cx, cy,r-4,Math.PI,-Math.PI/2);

    ctx.stroke();
},

// draws a funnel symbol - s is the size of the square
filterSymbol(ctx, x, y, s, color) {

    // router symbol
    ctx.beginPath();
    ctx.strokeStyle = color;

    const dx = s/3;
    const dy = s/2;

    ctx.moveTo(x,y);
    ctx.lineTo(x+s,y);
    ctx.lineTo(x+s-dx,y+dy);
    ctx.lineTo(x+s-dx,y+s);
    ctx.lineTo(x+dx,y+s);
    ctx.lineTo(x+dx,y+dy);
    ctx.lineTo(x,y);

    ctx.stroke();
},

// the text is centered in the label 
hCableLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    // big filled oval
    ctx.beginPath();
    ctx.fillStyle = cRect;
    //shape._roundedRect(ctx, x-3, y-3, w+6, h+6, r+3)
    shape._roundedRect(ctx, x-2, y-2, w+4, h+4, r+2);
    ctx.fill();

    // black line inside
    ctx.beginPath();
    ctx.strokeStyle = cText;
    shape._roundedRect(ctx,x,y,w,h,r);
    ctx.stroke();    

    // text
    ctx.fillStyle = cText;
    ctx.fillText(text,x + w/2 - ctx.measureText(text).width/2, y + 0.75*h);  
},

// the text is centered in the label 
vCableLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    // big filled oval
    ctx.beginPath();
    ctx.fillStyle = cRect;
    //shape._roundedRect(ctx, x-3, y-3, w+6, h+6, r+3)
    shape._roundedRect(ctx, x-2, y-2, w+4, h+4, r+2);
    ctx.fill();

    // black line inside
    ctx.beginPath();
    ctx.strokeStyle = cText;
    shape._roundedRect(ctx,x,y,w,h,r);
    ctx.stroke();    

    ctx.save();                 // Save the current state
    ctx.translate(x,y);         // the rectangle is at the origin
    ctx.rotate(-Math.PI / 2);   // Rotate the canvas 90 degrees counterclockwise
    ctx.fillStyle = cText;
    ctx.fillText(text, -h/2 - ctx.measureText(text).width/2  , 0.75*w);  // center the text
    ctx.restore();              // Restore the state
},

// draw straigth 
drawBusbar(ctx, p, cLine, wLine) {

    const wSave = ctx.lineWidth;

    if (p.len < 2) return
    ctx.beginPath();
    ctx.lineWidth = wLine;
    ctx.strokeStyle = cLine;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();

    ctx.lineWidth = wSave;
},

drawCable(ctx, p, cLine, wLine) {

    if (p.len < 2) return

    const wSave = ctx.lineWidth;

    ctx.beginPath();
    ctx.lineWidth = wLine; 
    ctx.strokeStyle = cLine;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();

    ctx.lineWidth = wLine - 4;
    ctx.strokeStyle = '#000000';
    ctx.moveTo(p[0].x, p[0].y);
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();

    ctx.lineWidth = wLine - 6;
    ctx.strokeStyle = cLine;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();

    ctx.lineWidth = wSave;
},

drawPoints(ctx,points) {

    // check
    let l = points.length;
    if (l < 2) return

    const arcRadius = 7.5;
    const arcSpace = 15;

    // ..move to the first point
    ctx.moveTo(points[0].x, points[0].y);

    // draw the segments ..
    for (let i=0; i < l-1; i++) {

        const a = points[i];
        const b = points[i+1];

        // ..if there is enough space..
        if (( Math.abs(a.y - b.y)  >= arcSpace ) || (  Math.abs(a.x - b.x)  >= arcSpace )) 

            // ..draw a line with an arc..
            ctx.arcTo(a.x, a.y, b.x, b.y, arcRadius);
        
        else {
            // ..otherwise draw a right angle
            ctx.lineTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        }
    }

    // ..but the last segment is straight.
    ctx.lineTo(points[l-1].x, points[l-1].y);
    ctx.stroke();
},

drawWire(ctx, color, width, points) {

    ctx.beginPath();

    ctx.lineWidth = width;
    ctx.strokeStyle = color;

    this.drawPoints(ctx, points);
},

// draw twisted segments with an arc
twistedPair(ctx, color, width, points) {

    // we have segments to draw..
    ctx.beginPath();

    // set the linewidth
    ctx.strokeStyle = color;
    ctx.lineWidth = 2*width;

    // the dash pattern
    //ctx.setLineDash([3,3])
    //ctx.setLineDash([24,4,3,4])

    this.drawPoints(ctx, points);

    // reset the dash pattern to nothing
    //ctx.setLineDash([])
},

};

// use path variables later ?
// const RR = new Path2D()
const shapeIcon = {

// The view icons
close(ctx,x,y,w,h,cLine) {

    // a cross
    ctx.beginPath();
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 2;

    const r = w/2;
    ctx.arc(x+r,y+r,r,0,2*Math.PI);

    const d = 2;
    ctx.moveTo(x+d,   y+d);
    ctx.lineTo(x+w-d, y+w-d);
    ctx.moveTo(x+w-d, y+d);
    ctx.lineTo(x+d,   y+w-d);

    ctx.stroke();
},
// bigView(ctx,x,y,w,h,cLine) {

//     // a square
//     ctx.beginPath()
//     ctx.fillStyle = cLine
//     //ctx.strokeStyle = cLine
//     //ctx.lineWidth = 1
//     //ctx.strokeRect(x,y,w,w)
//     ctx.fillRect(x,y,w,w)
// },
// group icon 
bigView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    ctx.rect(x, y, w, h);

    ctx.stroke();
},

smallView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    ctx.fillStyle = cIcon;

    ctx.rect(x+2, y+2, w-4, h-4);

    ctx.fill();
},

// group icon 
xbigView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    const h1 = h/2;
    const w1 = w/2;

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    ctx.rect(x, y, w1-1, h1);
    ctx.rect(x+w1+1, y+h1, w1-1, h1);

    ctx.stroke();
},
// restore(ctx,x,y,w,h,cLine) {

//     ctx.beginPath()
//     const w2 = w/2
//     ctx.fillStyle = cLine
//     //ctx.strokeStyle = cLine
//     //ctx.lineWidth = 1
//     //ctx.strokeRect(x,y+w2,w,w2)
//     ctx.fillRect(x,y+w2,w,w2)
// },
calibrate(ctx,x,y,w,h,cLine) {

    ctx.beginPath();
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 2;
    const r = w/2;
    const d = 1;

    ctx.arc(x+r,y+r,r-1,0,2*Math.PI);

    ctx.moveTo(x-d, y+r);
    ctx.lineTo(x+w+d, y+r);
    ctx.moveTo(x+r, y-d);
    ctx.lineTo(x+r, y+w+d);

    ctx.stroke();
},
grid(ctx,x,y,w,h,cLine) {

    ctx.beginPath();
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 2;

    const d = w/3;

    ctx.moveTo(x+d, y);
    ctx.lineTo(x+d, y+w);

    ctx.moveTo(x+d+d, y);
    ctx.lineTo(x+d+d, y+w);

    ctx.moveTo(x, y+d);
    ctx.lineTo(x+w, y+d);

    ctx.moveTo(x, y+d+d);
    ctx.lineTo(x+w, y+d+d);

    ctx.stroke();
},

// The node icons
link(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;
    const pi = Math.PI;

    const r = w/3;
    const w1 = w/2;

    ctx.moveTo(x+w1+r, y+r);
    ctx.arc(   x+w1,   y+r,  r, 0,   pi, true);
    //ctx.lineTo(x+w1-r, y+h-r)
    ctx.moveTo(x+w1-r, y+h-r);
    ctx.arc(   x+w1,   y+h-r,r, pi, 2*pi,true);

    ctx.moveTo(x+w1,   y+h-r);
    ctx.lineTo(x+w1, y+r);

    ctx.stroke();
},

lock(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;
    const pi = Math.PI;

    const r = w/3;
    const w1 = w/2;

    ctx.moveTo(x+w1+r, y+r);
    ctx.arc(x+w1,y+r,r, 0,   pi, true);
    ctx.rect(x+1, y+r+1, w-2, h-r-1);

    ctx.stroke();
},

cog(ctx,x,y,w,h,cIcon,cFill) {

    ctx.beginPath();

    const w1 = w/2;
    const h1 = h/2;
    const r = w/3;
    const pi = Math.PI;

    // fiddling with diagonal length..
    const d1 = 1;
    const d2 = 2;

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    // vertical
    ctx.moveTo(x+w1,    y+d1);
    ctx.lineTo(x+w1,    y+h-d1);

    // horizontal
    ctx.moveTo(x,       y+h1);
    ctx.lineTo(x+w,     y+h1);

    //diagonal 
    ctx.moveTo(x+d1,    y+d2);
    ctx.lineTo(x+w-d1,  y+h-d2);

    // diagonal
    ctx.moveTo(x+w-d1,  y+d2);
    ctx.lineTo(x+d1,    y+h-d2);

    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = cFill;
    ctx.arc(x+w1, y+h1, r, 0, 2*pi);
    ctx.stroke();
    ctx.fill();
},

// factory icon 
factory(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    const h1 = h/4;
    const h2 = h/2;
    const w1 = w/2;

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    ctx.moveTo(x+w,y);
    ctx.lineTo(x+w,y+h);
    ctx.lineTo(x,y+h);
    ctx.lineTo(x,y+h1);
    ctx.lineTo(x+w1,y+h2);
    ctx.lineTo(x+w1,y+h1);
    ctx.lineTo(x+w,y+h2);
    ctx.stroke();
},

// group icon 
group(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    const h1 = h/2;
    const w1 = w/2;

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    ctx.rect(x, y+2, w1-1, h1);
    ctx.rect(x+w1+1, y+h1, w1-1, h1);

    ctx.stroke();
},

// pulse icon
pulse(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    const m = y + h/2 + 1;
    ctx.moveTo(x,m);
    ctx.lineTo(x+2,m);
    ctx.lineTo(x+4,y);
    ctx.lineTo(x+5,y+h);
    ctx.lineTo(x+6,m);
    ctx.lineTo(x+w,m);
    ctx.stroke();
},

// comment icon 
comment(ctx,x,y,w,h,cIcon) {

    ctx.beginPath();

    const h1 = h/6;
    const h2 = h/2;
    const h3 = 5*h1;
    const w1 = w/4;

    ctx.strokeStyle = cIcon;
    ctx.lineWidth = 2;

    ctx.moveTo(x+w1,  y+h1);
    ctx.lineTo(x+3*w1,y+h1);

    ctx.moveTo(x+w1,  y+h2);
    ctx.lineTo(x+2*w1,y+h2);

    ctx.moveTo(x+w1,  y+h3);
    ctx.lineTo(x+4*w1,y+h3);

    ctx.stroke();
},

};

// The ifName for most compact representations is '|'
const I = '|';

const convert = {

    rectToString : rc => `x ${Math.round(rc.x)} y ${Math.round(rc.y)} w ${Math.round(rc.w)} h ${Math.round(rc.h)}`,

    stringToRect : str => {

        let a = str.indexOf("x");
        let b = str.indexOf("y");
        let c = str.indexOf("w");
        let d = str.indexOf("h");
        return {
            x: parseFloat(str.slice(a+1,b)),
            y: parseFloat(str.slice(b+1,c)),
            w: parseFloat(str.slice(c+1,d)),
            h: parseFloat(str.slice(d+1))
        }
    },

    // returns the rectangle string relative to the big rectangle
    relativeRect : (r,R) =>  `x ${Math.round(r.x - R.x)} y ${Math.round(r.y - R.y)} w ${Math.round(r.w)} h ${Math.round(r.h)}`,

    transformToString : tf => `sx ${tf.sx.toFixed(3)} sy ${tf.sy.toFixed(3)} dx ${tf.dx.toFixed(3)} dy ${tf.dy.toFixed(3)}`,

    stringToTransform : str => {
        let a = str.indexOf("sx");
        let b = str.indexOf("sy");
        let c = str.indexOf("dx");
        let d = str.indexOf("dy");

        if (a<0 || b<0 || c<0 || d<0) return {sx: 1.0, sy: 1.0, dx: 0, dy:0}
        
        return {
            sx: parseFloat(str.slice(a+2,b)),
            sy: parseFloat(str.slice(b+2,c)),
            dx: parseFloat(str.slice(c+2,d)),
            dy: parseFloat(str.slice(d+2))
        }
    },

    stringToPosition: str => {

        const comma = str.indexOf(',');
        if (comma < 0) return {rect:{x:0, y:0, w:0, h:0}, left:false}
        const rect = convert.stringToRect(str.slice(0,comma));
        const left = str.slice(comma+1).trim() === 'left';
        return {rect, left}
    },

    stringToUidWid(str) {
        const period = str.indexOf('.');
        if (period < 0) return [str, 0]
        return [str.slice(0,period), +str.slice(period+1)]
    },

    stringToWid(str) {
        const period = str.indexOf('.');
        if (period < 0) return 0
        return +str.slice(period+1)
    },

    stringToId(str) {
        const a = str.indexOf(I);

        return {
            uid: str.slice(0,a),
            name: str.slice(a+1)
        }
    },

    pointToString(point) {
        return `x ${point.x} y ${point.y}`;
    },
    
    stringToPoint(str) {
        const match = str.match(/x\s*(-?\d+\.?\d*)\s*y\s*(-?\d+\.?\d*)/);
        if (match) {
            return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
        return null
    },

    // returns the segment lengths in x and y direction
    wireToString: wire => {

        if (wire.length < 2) return ""

        const parts = [];

        // save the segments
        for (let i = 1; i < wire.length; i++) {

            // get the step in x and y direction
            const dx = (wire[i].x - wire[i-1].x);
            const dy = (wire[i].y - wire[i-1].y);

            // save either in x or y direction
            Math.abs(dx) > Math.abs(dy) ? parts.push('x '+ dx.toFixed(1)) : parts.push('y '+ dy.toFixed(1));
        }
        return parts.join(' ')
    },

    stringToWire(start, end, wireString) {

        if (!wireString || wireString.length < 1) return []

        // build from the start
        if (start) {

            // build from the start
            let {x,y} = {...start};

            // set the first point
            let wire = [{x,y}];

            // split the string in parts
            const parts = wireString.split(" ");

            for (let i = 0; i < parts.length; i += 2) {

                const direction = parts[i];
                const length = parseFloat(parts[i + 1]);
                direction === "x" ? x += length : y += length;
                wire.push({x,y});
            }
        
            return wire;           
        }
        
        // build from the end
        if (end) {

            // if we have no starting point, build the wire from the end
            let {x,y} = {...end};

            // set the first point
            let wire = [{x,y}];

            // split the string in parts
            const parts = wireString.split(" ").reverse();

            for (let i = 0; i < parts.length; i += 2) {

                const direction = parts[i+1];
                const length = parseFloat(parts[i]); 
                direction === "x" ? x -= length : y -= length;
                wire.push({x,y});
            }
        
            return wire.reverse();          
        }
        else return []
    },

    routeToString(route) {

        // used below
        let from = route.from;
        let to  = route.to;

        //const pinString = (pin) =>  '(pin) ' + pin.name + ' @ ' + pin.node.name
        const pinString = (pin) =>  `(pin ${pin.wid}) ${pin.name} @ ${pin.node.name}`;
        const busString = (tack) => '(bus) ' + tack.bus.name;
        //const padString = (pad) =>  '(pad) ' + pad.proxy.name
        const padString = (pad) =>  `(pad ${pad.proxy.wid}) ${pad.proxy.name}`;

        // check if the route is drawn from input to output or the other way around
        const fromTo = () => {
            if (to.is.pin) return to.is.input
            if (from.is.pin) return ! from.is.input
            if (to.is.pad) return to.proxy.is.input
            if (from.is.pad) return ! from.proxy.is.input
        };

        const strRoute = {};

        // arrange so that flow is from -> to
        if (fromTo()) {

            from.is.pin ? strRoute.from = pinString(from) :
            from.is.pad ? strRoute.from = padString(from) : 
            from.is.tack ? strRoute.from = busString(from) : null;

            to.is.pin ? strRoute.to = pinString(to) :
            to.is.pad ? strRoute.to = padString(to) : 
            to.is.tack ? strRoute.to = busString(to) : null;

            strRoute.wire = convert.wireToString(route.wire);
        }
        else {

            to.is.pin ? strRoute.from = pinString(to) :
            to.is.pad ? strRoute.from = padString(to) : 
            to.is.tack ? strRoute.from = busString(to) : null;

            from.is.pin ? strRoute.to = pinString(from) :
            from.is.pad ? strRoute.to = padString(from) : 
            from.is.tack ? strRoute.to = busString(from) : null;

            strRoute.wire = convert.wireToString(route.wire.slice().reverse());
        }

        return strRoute
    },

    // and endpoint starts with (pin) (pad) (bus) or (itf)
    rawToEndPoint(raw) {

        const kind = raw.trim().slice(1,4);
        let clbr=0, wid=0, at=0;

        switch(kind) {

            case 'pin': 
                clbr = raw.indexOf(')');
                wid = raw.slice(4,clbr).trim();
                at = raw.indexOf('@');
                return {
                    pin: raw.slice(clbr+1,at).trim(),
                    wid: wid.length > 0 ? +wid : 0,
                    node: raw.slice(at+1).trim()  
                }

            case 'pad': 
                clbr = raw.indexOf(')');
                wid = raw.slice(4,clbr).trim();            
                return {
                    pad: raw.slice(clbr+1).trim(),
                    wid: wid.length > 0 ? +wid : 0
                }

            case 'bus': return {bus: raw.slice(5).trim()}

            case 'itf': return {itf: raw.slice(5).trim()}
        }
    },

    cleanInput(userInput) {
        return userInput
            .trim()                            // remove leading/trailing whitespace
            .replace(/\s+/g, ' ')              // collapse multiple spaces into one
            .replace(/@|->|=>/g, '')           // remove all '@' and '->' and '=>'
    },

    cleanLink(lName) {
        return lName
            .split('@')                            // split into name and group parts
            .map(part => convert.cleanInput(part).trim()) // clean each part
            .filter(part => part.length > 0)       // drop empty parts
            .join(' @ ');                          // reassemble with consistent spacing
    },

    // return an array with the parts of the link in an array
    splitLink(str) {
        return str
            .split('@')                      // split on '@'
            .map(part => part.trim())        // clean each part
            .filter(part => part.length > 0) // remove empty parts
            .reverse();                      // reverse: outermost to innermost
    },



    // check if a pin has a multi structure
    isMulti: str => {

        // now get the brackets
        const opbr = str.indexOf('[');
        const clbr = str.lastIndexOf(']');

        return ((opbr > -1) && (clbr > -1) && (clbr > opbr))
    },

    // extract the names between square brackets:  'any text [selector a, selector b, ...] any text'
    extractMultis: str => {

        const [pre, middle, post] = convert.getPreMiddlePost(str);

        // split, trim an filter
        return middle.split(',')
    },

    // makes a list of all full message names - if there are no multis, just returns the message in an array
    expandMultis: str => {

        const [pre, middle, post] = convert.getPreMiddlePost(str);

        // split, trim an filter
        const multis = middle.split(',');

        // re-assemble
        return multis.map(name => pre + name + post)
    },

    cleanMulti(str) {

        //get the parts before and after the multi part
        const [pre, middle, post] = convert.getPreMiddlePost(str);

        // reassemble the name
        return pre + '[' + middle + ']' + post
    },

    // get the part before and after a multi message
    getPreMiddlePost(str) {
        // now get the brackets
        const opbr = str.indexOf('[');
        const clbr = str.lastIndexOf(']');

        // get the parts before and after the multi part
        let pre = str.slice(0,opbr).trim();
        let middle = str.slice(opbr+1, clbr).split(',').map(n=>n.trim()).filter(Boolean).join(',');
        let post = str.slice(clbr+1).trim();

        // if there is no point or hyphen, we add a space
        const last = pre.at(-1);
        if ((pre.length > 0)&&(last != '.') && (last != '-') && (last != '_')) pre = pre + ' ';
        const first = post[0];
        if ((post.length > 0)&&(first != '.') && (first != '-') && (first != '_')) post = ' ' + post;

        return [pre, middle, post]
    },

    // a pin name that has been edited can start or end with a '+
    //hasPlus: str => str[0] == '+' || str.at(-1) == '+' ,

    needsPrefix: str => {
        const first = str[0];
        return (first == '+' || first == '.' || first == '-' || first == '_')
    },

    needsPostfix: str => {
        const last = str.at(-1);
        return (last == '+' || last == '.' || last == '-' || last == '_')
    },

    // add the prefix / postfix to a message
    combineWithPrefix(prefix, name) {

        // Default is just the name
        let complete = name;

        const first = name[0];

        // Prefix
        if (first == '.' || first == '-' || first == '_') {
            const clean = name.slice(1).trim();
            complete = prefix + first + clean;
        }
        else if (first == '+') {
            const clean = name.slice(1).trim();
            complete = prefix + ' ' + clean;
        }
        
        // done
        return complete
    },

    // add the prefix / postfix to a message
    combineWithPostfix(postFix, name) {

        // Default is just the name
        let complete = name;
        const last = name.at(-1);

        if (last == '.' || last == '-' || last == '_') {
            const clean = name.slice(0,-1).trim();
            complete = clean + last + postFix;
        }
        else if (last == '+') {
            const clean = name.slice(0,-1).trim();
            complete = clean + ' ' + postFix;
        }
        
        // done
        return complete
    },

    prefixMatch(prefix, name) {

        if (name.startsWith(prefix)) {

            const first = name[prefix.length];
            return ((first == '.') || (first == '-') || (first == ' ') || (first == '_'))
        }
    },

    postfixMatch(postfix, name) {

        if (name.endsWith(postfix)) {

            const last = name.at(-postfix.length-1);
            return ((last == '.') || (last == '-') || (last == ' ') || (last == "_"))
        }
    },

    // add the prefix / postfix to a message
    xxcombineWithPrefix(prefix, name) {

        // Default is just the name
        let complete = name;

        // Prefix
        if (name[0] == '+') {

            const clean = name.slice(1).trim();

            // if there is some sort of a seperation character keep it
            if ((clean[0] == '.') || (clean[0] == '-') || (prefix.at(-1) == '.') || (prefix.at(-1) == '-')) 
                complete = prefix + clean;
            else 
                // otherwise use a space
                complete = prefix + ' ' + clean;
        }
        // Postfix
        else if (name.at(-1) == '+') {

            const clean = name.slice(0,-1).trim();

            if ((clean.at(-1) == '.') || (clean.at(-1) == '-') || (prefix[0] == '.') || (prefix[0] == '-')) 
                complete = clean + prefix;
            else 
                complete = clean + ' ' + prefix;
        }
        
        // done
        return complete
    },

    // change a string abcdef to abcdef(1) and a string abcdef(3) to abcdef(n)
    addNumber: (str, n) => {

        // Find the position of the last '(' in the string
        const opbr = str.lastIndexOf('(');
        const clbr = str.lastIndexOf(')');
    
        // Check if the last '(' is followed by a ')' and contains only digits between them
        if (opbr !== -1 && clbr === str.length - 1) {

            // get the number part
            const numberPart = str.slice(opbr + 1, clbr);

            // check if a number
            if (!isNaN(numberPart) && numberPart !== '') {

                // Replace the number with the newNumber
                return str.slice(0, opbr + 1) + n.toString() + ')'
            }
        }
        return str + '(' + n.toString() + ')'
    },

    viewToJSON: (view) => {

        let state, rect, transform;

        // view can still be in its 'raw' format { state, rect, transform }
        if (view.viewState) {
            state = view.viewState.visible ? (view.viewState.big ? 'big':'open' ) : 'closed';
            rect = view.viewState.big ? convert.rectToString(view.viewState.rect): convert.rectToString(view.rect);
            transform = convert.transformToString(view.tf);
        }
        else {
            state = view.status;
            rect = convert.rectToString( view.rect);
            transform = convert.transformToString(view.tf);
        }

        // done
        return {
            state, rect, transform
        }
    },

    stringToView: (rawView) => {

        // the view itself will be restored 
        return {   
            raw:    true,
            state:  rawView.state,
            rect:   convert.stringToRect( rawView.rect), 
            tf:     convert.stringToTransform(rawView.transform)
        }
    },

    // // The clean pin name is used to check if pins are connected
    // cleanPinName: (pinName) => {
    //     return pinName
    //         .toLowerCase()
    //         .replace(/\s+/g, ' ')             // collapse multiple spaces
    //         .trim();                          // remove leading/trailing spaces
    // },
   
    // transforms a name to a valid javascript camel-cased identifier
    pinToHandler(pinName) {
        const words = pinName
            // split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-zA-Z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        return 'on' + cleaned.map( word => word[0].toUpperCase() + word.slice(1)).join('');
    },

    // transforms a name to a valid javascript camel-cased identifier, starting with an upper case letter
    nodeToFactory: (nodeName) => {

       const words = nodeName
            // Convert to lowercase 
            .toLowerCase()
            // and split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        let factory = cleaned
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join('');

        // If it starts with a digit, prefix with underscore
        if (/^[0-9]/.test(factory))  factory = '_' + factory;

        return factory;
    },

    // skip the first part of the path name
    skipPrefix: (path) => {
        // find the second slash (path starts with a slash)
        let slash = path.indexOf('/', 1);

        // check
        return slash < 0 ? path : path.slice(slash)
    },

    // convert specific characters to dashes
    spaceToDash: name => {
        // check if there are spaces
        if (!name.includes(' ')) return name

        // replace spaces with dashes
        let newName = '';
        for(let i=0;i<name.length;i++) newName += name[i] == ' ' ? '-' : name[i];
        return newName
    },

    // extracts the base name from a given name
    toBaseName: name => {
        const pos = name.indexOf('-model');
        return pos > 0 ? name.slice(0, pos) : name
    },

    // convert to the name for the source code outline
    nameToSource: name => convert.spaceToDash(name) + '.js',

    // convert the name of a node to a file name for the model
    nameToModel: name => convert.spaceToDash(name) + '.json',

    // convert a name to a lib build file name
    nameToBuild: name => convert.spaceToDash(name) + '.js',

    // convert a name to a app file name
    nameToApp: name => convert.spaceToDash(name) + '.js',

    // convert a name to a html start page
    nameToPage: name => convert.spaceToDash(name) + '.html',

    // converts an object to a javascript literal
    objectToJsLiteral(obj, indent = 4) {
        return JSON.stringify(obj, (key, value) => {
            // Convert undefined to a placeholder string
            if (value === undefined) return '__undefined__';
            return value;
        }, indent)
        .replace(/"__undefined__"/g, 'undefined')
        .replace(/"([^"]+)":/g, '$1:') // remove quotes around keys
        .replace(/"([^"]*)"/g, (_, str) => `'${str.replace(/'/g, "\\'")}'`); // single-quote strings
    },


    djb2: (str) => {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
        }
        const h = Math.abs(hash & ((2**32)-1)).toString(16).padStart(8,'0');

        // split into two times two bytes
        // return h.slice(0,4) + '-' + h.slice(4)
        return h
    },

    hexToHsl(rgb) {
        // Extract the RGB values from the hex string
        let r = parseInt(rgb.slice(1, 3), 16) / 255;
        let g = parseInt(rgb.slice(3, 5), 16) / 255;
        let b = parseInt(rgb.slice(5, 7), 16) / 255;
        let a = 1;

        // do I have an alpha
        if (rgb.length > 7) {
            a = parseInt(rgb.slice(7, 9), 16) / 255;
        }
        
        // Find the maximum and minimum values among R, G, and B
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            // Achromatic
            h = s = 0; 
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
        
            h /= 6;
        }
        
        // Convert to percentages
        s *= 100;
        l *= 100;
        h *= 360; // Convert hue to degrees
        
        return a == 1   ? `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`
                        : `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a})`
    },
      
    // hsl = hsl(h,s%,l%, t)
    hslToHex(hsl) {

        let sep = hsl.indexOf(",") > -1 ? "," : " ";
        let parts = hsl.substring(4, hsl.lastIndexOf(")")).split(sep);

        let h = parseFloat(parts[0]),
            s = parseFloat(parts[1]) / 100, // Remove the '%' and convert to fraction
            l = parseFloat(parts[2]) / 100, // Remove the '%' and convert to fraction
            t = parseFloat(parts[3]);
        
        let c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = l - c/2,
            r = 0, g = 0,b = 0, a = 'ff';
        
        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;  
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
            r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255).toString(16);
        g = Math.round((g + m) * 255).toString(16);
        b = Math.round((b + m) * 255).toString(16);
        a = t==1 ? 'ff' : Math.round(t * 255).toString(16);
        
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        if (a.length < 2) b = "0" + a;

        return a == 'ff' ? "#" + r + g + b : "#" + r + g + b + a
    }
      
};

// The styling parameters for the editor

// Checks if a color is a valid hex color
function isValidHexColor(hex) {
    const regex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    return regex.test(hex);
}

const color = {

    // The base colors for the nodes etc
    shade1: '#fff',
    shade2: '#fff',
    shade3: '#fff',
    shade4: '#fff',
    shade5: '#fff',

    // view colors
    view1:  '#222',
    view2:  '#444',
    vIcon1: '#fd4d0c',
    vIcon2: '#3399ff',
    vIcon3: '#33cc33',
    vIcon4: '#e9bb16',

    // grey 
    grey3: '#333',
    grey6: '#666',
    greyC: '#ccc',

    // absolute colors
    black:  '#000',
    white:  '#fff',
    orange: '#ff8000',
    orangeT:'#ff800022',
    green:  '#7fff00',
    red:    '#FE2712', 
    yellow: '#fefe33',
    pink:   '#f9d5e5',
    purple: '#ff80ff',
    blue:   '#0000ff',

    // set the shades for this color object
    setShades(rgb) {

        // transform the hex color to hsl
        const hsl = convert.hexToHsl(rgb);

        // take the hue
        const comma1 = hsl.indexOf(',',4);
        const comma2 = hsl.indexOf(',',comma1+1);
        const hue = hsl.substring(4, comma1);
        const sat = hsl.substring(comma1+1, comma2);

        // change the shades
        this.shade1 = convert.hslToHex(`hsl(${hue},${sat},40%,1)`);          // box, seperator line, pin unconnected, title background
        this.shade2 = convert.hslToHex(`hsl(${hue},${sat},30%,0.50)`);       // box bg, pad bg - 0.5 transparency
        this.shade3 = convert.hslToHex(`hsl(${hue}, 100%, 75%, 1)`);         // icon, title
        this.shade4 = convert.hslToHex(`hsl(${hue},${sat},60%,1)`);          // route, bus, pin connected
        this.shade5 = convert.hslToHex(`hsl(${hue}, 50%, 75%, 1)`);         // ifPins


        // change the shades - dark theme...
        // this.shade1 = convert.hslToHex(`hsl(${hue},0%,40%,1)`)          // box, seperator line, pin unconnected, title background
        // this.shade2 = convert.hslToHex(`hsl(${hue},0%,20%,0.50)`)       // box bg, pad bg - 0.5 transparency
        // this.shade3 = convert.hslToHex(`hsl(${hue},100%, 50%, 1)`)      // icon, title
        // this.shade4 = convert.hslToHex(`hsl(${hue},0%,75%,1)`)          // route, bus, seperator text, pin connected
    }
};

// get a style object - it uses the colors above
// ** check adapt() below for the allocation of the shades ***
function StyleFactory() {

    // save the new rgb
    this.rgb = "#fff";

    this.std = {
        font: "normal 12px tahoma", lineCap: "round",  lineJoin: "round", lineWidth: 1.0, 
        cBackground: color.black, cLine: color.white, cFill: color.blue,
        wCursor: 2, blinkRate: 500, cBlinkOn: color.white, cBlinkOff: color.black
    }; 
    this.look = {
        wBox:150, hTop:20, hBottom:6, wExtra:50, wMax:300, dxCopy: 20, dyCopy:20,  smallMove: 5,
    }; 
    this.box = {
        rCorner:7.5,  wLine:2, cLine: color.shade1, cBackground:color.shade2, 
        cContainer: color.yellow, cSelected: color.orangeT, dxSel:10, dySel:10, wLineSel: 1
    };
    this.header = {
        font: "normal 13px tahoma", hHeader:15, hTitle:15, wLine:1, wChar:6, rCorner:7.5,
        cTitle: color.shade3, cBackground: color.shade1, cBad: color.red, cHighLighted: color.purple
    };
    this.icon = {
        wIcon:8, hIcon:10, blinkRate: 200, nBlinks: 4,
        cSrc:color.shade3, cLink: color.shade3, cBadLink: color.red, cHighLighted: color.purple,
        cGroup:color.shade3, cCog: color.shade3, cPulse: color.shade3, cComment: color.shade3,
        xPadding:6, yPadding:2, xSpacing:3,
    };
    this.label = {
        font: "italic 12px tahoma", hLabel: 15, cNormal: color.greyC,
    };
    this.ifName = {
        font: "normal 12px tahoma", hSep: 15, cNormal: color.shade5, cBackground: color.shade1, cAdded: color.green, cBad: color.red, 
        cSelected: color.orange, cHighLighted: color.purple
    };
    this.pin = {
        hPin: 15,  wOutside:10, wMargin:21, hArrow:10, wArrow:10, wChar:6,
        cNormal: color.shade1, cSelected: color.orange, cHighLighted: color.purple, 
        cConnected: color.shade4, cAdded: color.green,  cBad: color.red, cText: color.shade1,  cCursor: color.black,
        fMulti: "italic 11px tahoma"
    }; 
    this.pad = {
        hPad: 15,hSpace: 15, rBullet: 7.5, wArrow:10, hArrow:10, wExtra: 30, wMargin:4,  wViewLeft: 10,  wViewRight: 100, 
        cBackground: color.shade2, cSelected: color.orange, cHighLighted: color.purple, cConnected: color.shade4, 
        cBad: color.red, cText: color.shade1, cArrow:color.shade1, 
    }; 
    this.route = {
        wSelected: 2, wNormal: 2, split: 30, tooClose: 15, 
        cNormal: color.shade4, cSelected: color.purple, cHighLighted: color.purple , cNotUsed: color.grey3, 
        cAdded: color.green, cDeleted: color.red
    }; 
    this.bus = {
        wNormal: 6, wBusbar: 6, wCable: 8, wSelected: 6, split: 50, tooClose: 25, wArrow : 10, hArrow : 10, sChar: 5, hLabel: 15, radius: 7.5, wFilter: 15,
        cNormal: color.shade4, cSelected: color.purple, cHighLighted: color.purple, cBad: color.red, cText: color.black, 
    }; 
    this.selection = {
        xPadding: 20, yPadding: 20, 
        cRect: color.orangeT, cPinGroup: color.orangeT, wLine: 0, rCorner: 7.5,
    }; 
    this.view = {
        wDefault: 800, hDefault: 500, wLine: 4, rCorner: 15, wExtra:200, hExtra: 20,
        cBackground: color.black, cLine:color.view1, cHighLight: color.view2,

        // The header
        fHeader: "normal 15px arial", hHeader: 20, cTitle: color.grey6, cTitleHighLight: color.shade3,

        // The grid
        grid: {dx: 30, dy: 30, cLine: color.grey3, cAxis: color.grey6},

        // The icons
        wIcon:10, hIcon:10, xPadding:10, xSpacing:8, cDim: color.grey6,
        cClose: color.vIcon1, cFullscreen: color.vIcon2, cCalibrate: color.vIcon3, cGrid: color.vIcon4
    };
    this.placement = {
        marginTop: 30, marginLeft: 30, marginLeftPads: 210, nodesPerRow: 5, rowStep: 360, colStep: 270
    };
}
StyleFactory.prototype = {

    // changes to a new style and returns the previous style
    switch( newStyle ) {
        if (!newStyle) return style$1
        const previous = style$1;
        style$1 = newStyle;
        return previous
    },

    // create a new style
    create: (rgb) => isValidHexColor(rgb) ? new StyleFactory().adapt(rgb) : new StyleFactory().adapt("#00aaff"),

    // change the shades of the variable items
    adapt(rgb) {

        // save
        this.rgb = rgb;

        // change the specific color
        color.setShades(rgb);

        // shade1
        this.box.cLine = 
        this.header.cBackground = 
        this.ifName.cBackground = 
        this.pin.cNormal = 
        this.pin.cText = color.shade1;

        // shade2
        this.box.cBackground = 
        this.pad.cBackground = color.shade2;

        // shade3
        this.header.cTitle = 
        this.icon.cSrc =
        this.icon.cGroup =
        this.icon.cCog =
        this.icon.cLink = 
        this.icon.cPulse = 
        this.icon.cComment = 
        this.view.cTitleHighLight = color.shade3;

        // shade4
        this.pin.cConnected = 
        this.pad.cConnected = 
        this.route.cNormal = 
        this.bus.cNormal = color.shade4;

        // shade5
        this.ifName.cNormal = color.shade5;

        // return this for chaining
        return this
    }
};

// The style that is active at a given moment. Set to a default style.
let style$1 = new StyleFactory().adapt("#00aaff");

function TextEdit() {

    // the cursor can have position 0 to l (l+1 values) if the field has length l 
    // 0 is in front of character 0
    // l-1 is in front of character l-1
    // l is at the very end

    this.cursor = 0;             // place the cursor at the end
    this.saved = null;           // save the current value
    this.obj= null;              // the object where there is an editable prop
    this.prop= null;             // the prop that needs editing
    this.keyPressed = null;      // the last key pressed - for clients use
}

TextEdit.prototype = {

    // new edit
    newEdit(obj, prop, cursor=-1) {
        this.cursor = cursor < 0 ? obj[prop].length : 0;  // place the cursor at the end
        this.saved = obj[prop];          // save the current value
        this.obj = obj;                  // the object where there is an editable prop
        this.prop= prop;                 // the prop that needs editing
        this.keyPressed = null;          // for clients use
    },

    clear() {
        this.obj[this.prop] = '';
        this.cursor = 0;
    },

    // return true to stop editing
    handleKey(e) {

        // for clients
        this.keyPressed = e.key;

        // notation
        let cursor = this.cursor;
        const obj = this.obj;
        const prop = this.prop;

        // split the field in two parts - slice(a,b) does not include b
        let before = cursor > 0 ? obj[prop].slice(0,cursor) : '';
        let after = cursor < obj[prop].length-1 ? obj[prop].slice(cursor) : '';
        
        //reassemble the new value..
        obj[prop] = before + e.key + after;

        // shift the cursor one place
        this.cursor++;

        return false
    },

    // return true to stop editing
    handleSpecialKey(e) {

        // for clients...
        this.keyPressed = e.key;

        switch(e.key) {

            case "Shift":
                return false
                
            case "Backspace":
                // notation
                let cursor = this.cursor;
                let name = this.obj[this.prop];

                // split the field in two parts - remove the last character of the first part
                let before = cursor > 0 ? name.slice(0,cursor-1) : '';
                let after = cursor < name.length ? name.slice(cursor) : '';

                //reassemble the new value..
                this.obj[this.prop] = before + after;

                // shift the cursor one place, but not beyond 0
                cursor > 0 ? this.cursor-- : 0;

                // done
                return false

            case "Enter":
                 return true
            
            case "ArrowLeft":
                if (this.cursor > 0) this.cursor--; 
                return false
            
            case "ArrowRight":
                if (this.cursor < this.obj[this.prop].length) this.cursor++; 
                return false

            case "Home":
                this.cursor = 0;
                return false

            case "End" : 
                this.cursor = this.obj[this.prop].length;
                return false

            case "Delete":
                this.obj[this.prop] = '';
                this.cursor = 0;
                return false

            case "Escape":
                this.obj[this.prop] = this.saved;
                return true

            case "Alt":
                return false

            case "AltGraph":
                return false

            case "Control":
                return false

            default: 
                return true
        }
    },
};

// the undo stack is actually a ring buffer of a given size
// The size of the buffer is MAX + 1
function RingStack(size) {

    // if next == bottom there is no data on the ring stack
    this.bottom = 0;
    this.top = 0;
    this.next = 0;
    this.max = size > 0 ? size-1 : 1;
    this.ring = new Array(this.max+1);
    this.ring.fill(null);
}
RingStack.prototype = {

    reset() {
        this.bottom = 0;
        this.top = 0;
        this.next = 0;
        this.ring.fill(null);        
    },

    push( item ) {

        // the top of the stack changes
        this.top = this.next;

        // top points to the first available slot - store the item
        this.ring[ this.top ] = item;

        // change next
        this.next = (this.next == this.max) ? 0 : this.next + 1;
        
        // bottom might also have to shift..
        if (this.next == this.bottom) {
            this.bottom = (this.bottom == this.max) ? 0 : this.bottom + 1;
        }
    },

    last(){
        return this.ring[this.top]
    },

    back() {

        // if at the bottom return null
        if (this.next == this.bottom) return null

        this.next = (this.next == 0) ? this.max : this.next - 1;

        return this.ring[this.next]
    },

    forward() {

        // if past the top return null
        if (this.next == this.top + 1) return null

        const item = this.ring[this.next];

        this.next = this.next == this.max ? 0 : this.next + 1;

        return item
    }
};

// a function to check if a point is inside or outside a rectangle
const inside =  (p,R) => ((p.x >= R.x) && (p.x <= R.x + R.w) && (p.y >= R.y) && (p.y <= R.y + R.h)); 

// makes a random string from a given characterset
const sAlfa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lAlfa = sAlfa.length; 
function rndAlfa(n) {
    let str = '';
    for (let i = 0; i < n; i++) {
        let p = Math.floor(Math.random() * lAlfa);
        str += p < lAlfa ? sAlfa[p] : sAlfa[lAlfa-1];
    }
    return str
}

// BETTER EJECT
function eject(arr, el) {
    // remove an element from an array
    const i = arr.indexOf(el);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0
}

// returns the segments that cut the rectangle
function segmentsInside(p, r) {

    if (p.length < 2) return null

    const segments = [];
    let a =0, b=0;
    for (let i=0; i<p.length-1;i++) {
        a = p[i];
        b = p[i+1];

        // x direction 
        if ( ( (a.y > r.y) && (a.y < r.y + r.h)) && ((b.y > r.y) && (b.y < r.y + r.h) )) {

            if ( ((a.x < r.x + r.w) && (b.x > r.x)) || ((b.x < r.x + r.w)&&( a.x > r.x))) segments.push(i+1);
        }
        // y-direction
        else if ( ( (a.x > r.x) && (a.x < r.x + r.w)) && ((b.x > r.x) && (b.x < r.x + r.w) )) {

            if (((a.y < r.y + r.h) && (b.y > r.y))||((b.y < r.y + r.h) && (a.y > r.y))) segments.push(i+1);
        }
    }
    return segments
}

// The correct and elaborate version of the function above
// returns true if the line segment p1 p2 cuts the rectangle
// The cases where the points are exactly on the edge do not count as cuts
function cutsRectangle(p1, p2, rc) {

    // Define rectangle boundaries (rc.x, rc.y is bottom-left, width and height are positive)
    const left   = rc.x;
    const right  = rc.x + rc.w;
    const bottom = rc.y;
    const top    = rc.y + rc.h;
  
    // Trivial rejection: if both points are strictly on one side of the rectangle.
    if ((p1.x <= left && p2.x <= left) || (p1.x >= right && p2.x >= right) ||
        (p1.y <= bottom && p2.y <= bottom) || (p1.y >= top && p2.y >= top)) {
        return false;
    }
  
    // If either endpoint is strictly inside the rectangle, we consider that as a cut.
    if (p1.x > left && p1.x < right && p1.y > bottom && p1.y < top) return true;
    if (p2.x > left && p2.x < right && p2.y > bottom && p2.y < top) return true;
  
    // Helper function: checks intersection with a vertical line (x = k)
    // Returns true if the intersection y coordinate lies within the rectangle's vertical bounds.
    const checkVertical = (k) => {
        // Avoid division by zero if p2.x equals p1.x (vertical line)
        if (p2.x === p1.x) return false;
        const t = (k - p1.x) / (p2.x - p1.x);
        if (t > 0 && t < 1) {
            const y = p1.y + t * (p2.y - p1.y);
            return y > bottom && y < top;
        }
        return false;
    };
  
    // Helper function: checks intersection with a horizontal line (y = k)
    // Returns true if the intersection x coordinate lies within the rectangle's horizontal bounds.
    const checkHorizontal = (k) => {
        // Avoid division by zero if p2.y equals p1.y (horizontal line)
        if (p2.y === p1.y) return false;
        const t = (k - p1.y) / (p2.y - p1.y);
        if (t > 0 && t < 1) {
            const x = p1.x + t * (p2.x - p1.x);
            return x > left && x < right;
        }
        return false;
    };
  
    // Check intersection with the left and right vertical edges.
    if (checkVertical(left)) return true;
    if (checkVertical(right)) return true;
  
    // Check intersection with the bottom and top horizontal edges.
    if (checkHorizontal(bottom)) return true;
    if (checkHorizontal(top)) return true;
  
    return false;
  }

function blockDistance(p1, p2) {
    return Math.abs(p2.x - p1.x)  + Math.abs(p2.y - p1.y)
}

// returns a point and the segment on which the point lies 
function closestPointOnCurve(curve, q) {

    let minDistance = Infinity;
    let point = null;
    let segment = 0;
    let endPoint = false;   // true if the closest point is and endpoint of the segment

    for (let i = 0; i < curve.length - 1; i++) {
        let { x: x1, y: y1 } = curve[i];
        let { x: x2, y: y2 } = curve[i + 1];

        if (x1 === x2) { // Vertical segment
            if (Math.min(y1, y2) <= q.y && q.y <= Math.max(y1, y2)) {

                let distance = Math.abs(q.x - x1);

                if (distance < minDistance) {
                    minDistance = distance;
                    point = { x: x1, y: q.y };
                    segment = i+1;
                    endPoint = false;
                }
            } else {

                let distanceToY1 = (q.x - x1) ** 2 + (q.y - y1) ** 2;
                let distanceToY2 = (q.x - x2) ** 2 + (q.y - y2) ** 2;

                let [distance, candidatePoint, candidateSegment] = distanceToY1 < distanceToY2
                    ? [distanceToY1, { x: x1, y: y1 }, i+1]
                    : [distanceToY2, { x: x1, y: y2 }, i+1];

                if (distance < minDistance) {
                    minDistance = distance;
                    point = candidatePoint;
                    segment = candidateSegment;
                    endPoint = true;
                }
            }
        } else if (y1 === y2) { // Horizontal segment
            if (Math.min(x1, x2) <= q.x && q.x <= Math.max(x1, x2)) {

                let distance = Math.abs(q.y - y1);

                if (distance < minDistance) {
                    minDistance = distance;
                    point = { x: q.x, y: y1 };
                    segment = i+1;
                    endPoint = false;
                }
            } else {

                let distanceToX1 = (q.x - x1) ** 2 + (q.y - y1) ** 2;
                let distanceToX2 = (q.x - x2) ** 2 + (q.y - y2) ** 2;

                let [distance, candidatePoint, candidateSegment] = distanceToX1 < distanceToX2
                    ? [distanceToX1, { x: x1, y: y1 }, i+1]
                    : [distanceToX2, { x: x2, y: y2 }, i+1];

                if (distance < minDistance) {
                    minDistance = distance;
                    point = candidatePoint;
                    segment = candidateSegment;
                    endPoint = true;
                }
            }
        }
    }

    return { point, segment, endPoint };
}

// interpollate close to p on the segment
function interpolateSegment(point, segment, curve) {

    let newX = point.x;
    let newY = point.y;
    let fr = 0.1*(1+Math.random());

    // get the endpoints of the segment
    let a = curve[segment-1]; 
    let b = curve[segment];

    // a should be the first
    if (b.x < a.x || b.y < a.y) [a,b] = [b,a];

    // vertical
    if (a.x == b.x) {
        // closer to a or b ?
        newY = (Math.abs(a.y - p.y) < Math(b.y - p.y)) ? a.y + fr*(b.y-a.y) : b.y - fr*(b.y - a.y);
    }
    // horizontal
    else {
        // closer to a or b ?
        newX = (Math.abs(a.x - p.x) < Math(b.x - p.x)) ? a.x + fr*(b.x-a.x) : b.x - fr*(b.x - a.x);
    }

    return {x:newX, y:newY}
}

function jsonDeepCopy(toCopy) {

    return toCopy ? JSON.parse(JSON.stringify(toCopy)) : null;
}

function updateDerivedSettings(original, derived) {

    // If the original is null, return the derived as is
    if (original === null) {
        return derived;
    }

    // If the derived is null, make a copy of the original
    if (derived === null) {
        return JSON.parse(JSON.stringify(original));
    }

    // Iterate over the keys in the original settings
    for (let key in original) {
        if (original.hasOwnProperty(key)) {
            if (typeof original[key] === 'object' && !Array.isArray(original[key]) && original[key] !== null) {
                // Recursively update if both original and derived have this key as an object
                derived[key] = updateDerivedSettings(original[key], derived[key] || {});
            } else {
                // If the key exists in original, ensure it's in derived
                if (!derived.hasOwnProperty(key)) {
                    derived[key] = original[key];
                }
            }
        }
    }

    // Iterate over the keys in the derived settings
    for (let key in derived) {
        if (derived.hasOwnProperty(key)) {
            // If the key doesn't exist in original, delete it from derived
            if (!original.hasOwnProperty(key)) {
                delete derived[key];
            }
        }
    }

    return derived;
}

// pin is the receiving pin
function RxPin(pin) {

    this.pin = pin;
}

// targets is the list of pins this pin is connected to
function TxPin(pin) {

    this.pin = pin;
    this.targets = [];
}
TxPin.prototype = {

    dropTarget(dst) {

        // notation
        const targets = this.targets;

        // go through the targets until the destination is found
        for (let i=0; i<targets.length; i++) {

            // if the destination is found
            if ((dst.node == targets[i].node )&&(dst.name == targets[i].name)) {
            
                // shift the routes below one position up
                for (let j = i; j < targets.length-1; j++) targets[j] = targets[j+1];
    
                // the array is one position shorter
                targets.pop();

                // no need to look further in the list - take the next dst
                return
            }
        }
    }
};

// For an incoming tack we save all the tacks with the same selector...
function RxTack(tack) {
    //this.selector = tack.getOtherPin().name
    this.tack = tack;
}


// for an outgoing tack, we save the outgoing connections 
function TxTack(tack) {
    //this.selector = tack.getOtherPin().name
    this.tack = tack;
    this.fanout = [];
}
TxTack.prototype = {

    // checks if an incoming message name is passed via this tx
    connectsTo(messageName) {

        const pin = this.tack.getOtherPin();

        // it must either be a literal match or the pin variant must include the message
        return pin.is.multi ? (pin.getMatch(messageName) == messageName) : (pin.name == messageName)
    },

    dropTarget(dst) {

        // notation
        const fanout = this.fanout;

        // go through the targets until the destination is found
        for (let i=0; i<fanout.length; i++) {

            // if the destination is found
            if ((dst.node == fanout[i].node )&&(dst.name == fanout[i].name)) {
            
                // shift the routes below one position up
                for (let j = i; j < fanout.length-1; j++) fanout[j] = fanout[j+1];

                // the array is one position shorter
                fanout.pop();

                // no need to look further in the list - take the next dst
                return
            }
        }
    }

};

const rxtxHandling$1 = {

rxtxPrepareTables() {

    if (this.is.group) return

    // add an entry in the tx or rx table for each output input pin
    for (const widget of this.look.widgets) {

        // we only look at pins
        if ( !widget.is.pin) continue

        // inputs in the rx table, outputs in the txTable
        this.rxtxAddPin(widget);
    }
},

rxtxResetTables() {

    if (this.is.group) return

    this.txTable = [];
    this.rxTable = [];
},

rxtxAddPin(pin) {

    if (this.is.group) return

    if (pin.is.input) 
        this.rxTable.push( new RxPin(pin) ); 
    else 
        this.txTable.push( new TxPin(pin) );
},

rxtxPopPin(pin) {

    if (this.is.group) return

    if (pin.is.input)
        this.rxTable.pop(); 
    else 
        this.txTable.pop();
},

// remove a pin from a table
rxtxRemovePin(pin) {

    if (this.is.group) return

    if (pin.is.input) {
        const rx = this.rxTable.find( rx => rx.pin == pin);
        eject(this.rxTable, rx);
    } else {
        const tx = this.txTable.find( tx => tx.pin == pin);
        eject(this.txTable, tx);
    }
},

// add a group of pins to the rx/tx tables
rxtxAddPinArea(widgets) {

    if (this.is.group) return

    for(const widget of widgets) if (widget.is.pin) this.rxtxAddPin(widget);
},

// follow the routes to build the tx tables - recursive function
rxtxBuildTxTable() {

    // for group nodes just continue to look for source nodes
    // and buses with routers
    if (this.is.group) {

        // do the buses that have a filter first
        for(const bus of this.buses) if (bus.hasFilter()) bus.rxtxBuildRxTxTable();

        // then the nodes
        for (const node of this.nodes) node.rxtxBuildTxTable();

        // done  
        return
    }

    // build the connection table for all source nodes
    // search all possible destinations for a pin that can send a message
    for (const widget of this.look.widgets) {

        // we only look at pins that have routes and can have outgoing message
        if ( !widget.is.pin || widget.is.input || (widget.routes.length == 0)) continue

        // find the transmit record for this pin
        const txRecord = this.txTable.find( tx => tx.pin.name == widget.name);

        // check - but is actually not possible
        if (!txRecord) {
            console.error(`${this.name} NO TX TABLE RECORD FOR ${widget.name}`);
            continue
        }

        // reset the targets
        txRecord.targets = [];

        // gather all destinations for this pin in a list
        const dstList = [];

        // look at every route for that pin
        for (const route of widget.routes) {

            // discard pathological routes
            if (!route.from || !route.to) continue

            // set the dstination
            const dst = route.from == widget ? route.to : route.from;

            if (dst.is.pin) {
                dst.is.proxy ? dst.pad?.makeConxList(dstList) : dstList.push(dst);
            }
            // if a bus has a filter propagation stops 
            else if (dst.is.tack) {
                dst.bus.hasFilter() ?  dstList.push(dst) : dst.bus.makeConxList(widget, dstList);
            }
            else if (dst.is.pad) {
                dst.proxy.makeConxList(dstList);
            }
        }

        // now we put the results in the tx list
        for (const dst of dstList) txRecord.targets.push(dst);
    }
},

// removes a connection from the conx table tx and rx are widgets
rxtxRemoveFromTxTable(txWidget, rxWidget) {

    // find the destination targets that corresponds with the transmitter
    const targets = this.txTable.find( tx => tx.pin.name == txWidget.name)?.targets;

    // check
    const L = targets?.length ?? 0;

    // go through all destinations for this output pin
    for (let i=0; i<L; i++) {

        // find the destination
        if ((rxWidget.node == targets[i].node)&&(rxWidget.name == targets[i].name)) {

            // shift the routes below one position up
            for (let j=i; j<L-1; j++) targets[j] = targets[j+1];

            // the array is one position shorter
            targets.pop();

            // no need to look any further
            return
        }
    }
},


};

const mouseHandling$1 = {

    prepare(e) {

        this.canvas.focus();
        // no default action
        e.preventDefault();

        // notation
        const doc = this.doc; 

        //check
        if (!doc) return [null, null, null]

        // transform the mouse coord to local coord
        const xyLocal = doc.view.localCoord({x:e.offsetX, y:e.offsetY});

        // find if we are in a view
        return doc.view.whichView(xyLocal)
    },

    // show the rightclick menu
    onContextMenu(e) {
        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // check if we have hit a view widget
        if (widget) return // this.viewContextMenu(view,widget, e)

        // execute the actions for the view
        view.onContextMenu(xyView, e);

        //and redraw
        this.redraw();
    },

    onMouseDown(e) {

        // for mouse down we only accept the left button
        if (e.button != 0) return

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // if the view is not the activeview - switch
        if (view != this.doc?.focus) this.switchView(view);

        // if we have hit a view widget we have to handle that, otherwise pass to the view
        widget ? this.viewMouseDown(view, widget) : view.onMouseDown(xyView, e);

        //and redraw
        this.redraw();
    },

    onMouseMove(e) {    

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // check if something needs to be done about the view first
        if (this.viewMouseMove(view, widget,{x:e.movementX, y:e.movementY})) return

        // execute - only redraw if action returns true
        if (view.onMouseMove(xyView,e)) this.redraw();
    },
 
    onMouseUp(e) {

        // if we are doing something with a view, just cancel that
        if (this.state.action) return this.viewMouseUp()

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // execute
        view.onMouseUp(xyView,e);

        // redraw
        this.redraw();
    },

    onWheel(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // execute
        //view.onWheel({x:e.offsetX, y:e.offsetY},e)
        view.onWheel(xyView,e);

        // redraw
        this.redraw();
    },

    onDblClick(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // execute
        view.onDblClick(xyView,e);
    },

    // a single click in the edit window
    onClick(e) {
        return
    },

    onDragOver(e) {
        e.preventDefault();
    },

    onDrop(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e);

        // check
        if (!view) return

        // drop the data - do the redraw in onDrop - async function
        view.onDrop(xyView, e);
    },

    // viewContextMenu(view, widget, e) {
    //     if (widget.is.viewTitle) {
    //         viewHeaderCxMenu.prepare(view)
    //         this.tx.send("show context menu", {menu:viewHeaderCxMenu.choices, event:e})
    //     }
    // },

    viewMouseDown(view, widget) {

        if (widget.is.icon) {

            view.iconClick(widget, this);
        }
        else if (widget.is.border) {

            this.state.view = view;
            this.state.widget = widget;
            this.state.action = editorDoing.viewResize;
        }
        else if (widget.is.viewTitle) {
    
            // if we have hit the title bar - drag the view
            this.state.view = view;
            this.state.widget = widget;
            this.state.action = editorDoing.viewDrag;
        }
    },

    viewWidgetHover(view, widget) {
        if (widget.is.border) {
            this.state.action = editorDoing.hoverBorder;
            view.highLight();
        }
    },

    viewMouseMove(view, widget, delta) {

        switch( this.state.action ) {

            case editorDoing.nothing:

                if (! widget?.is.border) return false

                // check the type of cursor to show
                if ((widget.name == "top")||(widget.name == "bottom")) this.canvas.style.cursor = "ns-resize";
                else if ((widget.name == "left")||(widget.name == "right")) this.canvas.style.cursor = "ew-resize";
                else if (widget.name == "corner") this.canvas.style.cursor = "nw-resize";
                else return true

                this.state.action = editorDoing.hoverBorder;
                this.state.view = view;
                break

            case editorDoing.viewDrag:
                this.state.view.move(delta);
                break

            case editorDoing.viewResize:
                this.state.view.resize(this.state.widget, delta);
                break

            case editorDoing.hoverBorder:

                // for the current view we keep the cursor as is - otherwise set it to pointer again
                if ( (view != this.state.view) || (! widget?.is.border)) {

                    this.canvas.style.cursor = "default";
                    this.state.action = editorDoing.nothing;
                }
                break

            default: return false
        }

        this.redraw();
        return true
    },

    viewMouseUp() {
        // reset the state
        // if (editorDoing.hoverBorder) this.state.view.unHighLight()
        this.state.view = this.state.widget = null;
        this.state.action = editorDoing.nothing;
    }
};

//const cursor = "\u2595"
//const cursor = "|"
const keyboardHandling$1 = {
    // keyboard press
    onKeydown(e) {
        // if the key is processed
        if (this.doc?.focus?.onKeydown(e)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();

            console.log('hello baby');
        }
    },

    onKeyup(e) {
        // if the key is processed
        if (this.doc?.focus?.onKeyup(e)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();
        }
    },
};

function ModelHeader() {

    const today = new Date();

    this.version = '0.0.1';
    this.created = today.toLocaleString();
    this.saved = today.toLocaleString();
    this.utc = today.toJSON();
    this.style = style$1;
    this.runtime = '@vizualmodel/vmblu';
}
ModelHeader.prototype = {

    toJSON() {

        const today = new Date();

        const header = {
            version: this.version,
            created: this.created,
            saved: today.toLocaleString(),
            utc: today.toJSON(),
            style: this.style.rgb,
            runtime: this.runtime,
        };

        return header
    },

    // get the header data from the raw file
    cook(arl, raw) {

        const today = new Date();

        // date and version
        this.created = raw.created?.slice() ?? today.toLocaleString(),
        this.saved = raw.saved?.slice() ?? today.toLocaleString(),
        this.utc = raw.utc?.slice() ?? today.toJSON();
        this.version = raw.version?.slice() ?? 'no version';

        // Create a style for the model
        this.style = style$1.create(raw.style);

        // get the runtime
        this.runtime = raw.runtime?.slice() ?? '@vizualmodel/vmblu';
    },
};

const sourceMapHandling = {

// reads the source doc file and parses it into documentation
async handleSourceDoc() {

    // read the source doc file
    const rawSourceDoc = await this.readSourceDoc();

    // check
    if (! rawSourceDoc) return;

    // parse to extract the juicy bits
    this.sourceMap = this.parseSourceDoc(rawSourceDoc);        

    // ok
    // console.log('** SourceDoc **', this.sourceMap)
},

// Reads the sourceMap of the model
async readSourceDoc() {

    // get the full path
    const fullPath = this.arl?.getFullPath();

    // check
    if (!fullPath) return null

    // make an arl 
    const sourceMapArl = this.arl.resolve(removeExt(fullPath) + '-doc.json');

    // get the file
    return await sourceMapArl.get('json')
},

/**
 * Parses the documentation entries produced by extractHandlersFromFile.
 * Organizes them per node with pin-to-handler mappings.
 *
 * @param {Array<{node: string, handlers: Array}>} docEntries
 * @returns {Map<string, Map<string, object>>} Map of nodeName -> Map of pinName -> handler metadata
 */
parseSourceDoc(raw) {

    // check
    if (!raw.entries) return null;

    const nodeMap = new Map();

    // for all nodes in the file
    for (const nodeEntry of raw.entries) {

        // get the handlers and the transmissions in that node
        const { node, handles, transmits } = nodeEntry;

        // Check if there is already an entry in the map for that node
        if (!nodeMap.has(node)) {
            nodeMap.set(node, {handles: new Map(), transmits: new Map()});
        }

        // get the list of pins
        const pinMap = nodeMap.get(node);

        // set the handlers for the pin - note that we will index the pin data using the *handler* name !
        for (const handlerData of handles) {

            const { handler, ...meta } = handlerData;
            pinMap.handles.set(handler, {handler,...meta});
        }

        // set the transmissions on the pin - here we use the *pin name* to index !!!
        for (const transmission of transmits) {

            // deconstruct
            const { pin, ...meta } = transmission;

            // get the entry (if any)
            const entry = pinMap.transmits.get(pin);

            // check if we have an entry already
            if (entry) 
                Array.isArray(entry) ? entry.push({pin,...meta}) : pinMap.transmits.set(pin, [entry, {pin,...meta}]);
            else 
                pinMap.transmits.set(pin, {pin, ...meta});
        }
    }

    return nodeMap;
},

/**
 * Optional helper to flatten the nested map into a plain array (useful for UI).
 */
flattenSourceDoc(nodeMap) {
    const flatList = [];
    for (const [node, pins] of nodeMap.entries()) {
        for (const [pin, meta] of pins.entries()) {
        flatList.push({ node, pin, ...meta });
        }
    }
    return flatList;
},

// get the information for a given pin
getInputPinProfile(pin) {

    // Get the info about the handlers of the node
    const handles = this.sourceMap?.get(pin.node.name)?.handles;

    // check
    if (!handles) return null

    // us the handler name to index the map
    const handlerName = convert.pinToHandler(pin.name);

    // if the pin is not a multi just return the single record
    if (!pin.is.multi) return handles.get(handlerName) ?? null

    // multi case: expand the multi in an array of all names
    const multi = pin.expandMultis();

    // collect the info in an array
    const multiProfile = [];
    for (const name of multi) {

        // search on handlername
        const handlerName = convert.pinToHandler(name);

        // get the info for the name
        const info = handles.get(handlerName) ?? null;

        // check
        if (info) multiProfile.push(info);
    }

    // done
    return multiProfile
},

// get the information for a given pin
getOutputPinProfile(pin) {

    // Get the info about the node
    const transmits = this.sourceMap?.get(pin.node.name)?.transmits;

    //check
    if (!transmits) return null

    // if the pin is not a multi just return the single record
    if (!pin.is.multi) return transmits.get(pin.name) ?? null

    // multi case: expand the multi in an array of all names
    const multi = pin.expandMultis();

    // collect the info in an array
    const multiProfile = [];
    for (const name of multi) {

        // get the info for the name
        const info = transmits.get(name) ?? null;

        // check
        Array.isArray(info) ? multiProfile.push(...info) : multiProfile.push(info);
    }

    // done
    return multiProfile
},

makeMcpToolString(root) {

    // first get the tools
    const mcpTools = this.generateToolSpecs();

    // check
    if (mcpTools.length == 0) return null

    // make a header
    const today = new Date();
    const sHeader =    '// ------------------------------------------------------------------'
                    +`\n// MCP tool file for model: ${root.name}`
                    +`\n// Creation date ${today.toLocaleString()}`
                    +'\n// ------------------------------------------------------------------\n'
                    +'\nexport const mcpTools = ';

    // stringify the tools array to a js literal
    const sMcpTools = convert.objectToJsLiteral(mcpTools);

    // append
    return sHeader + sMcpTools
},

/**
 * Generate MCP-compatible tool specs in an LLM-neutral format.
 * Only handlers with `mcp: true` will be included.
 *
 * @param {Map<string, Map<string, object>>} nodeMap - Output from parseSourceDoc
 * @returns {Array<object>} - Abstract tool specs
 */
generateToolSpecs() {
  const tools = [];

  // check
  if (!this.sourceMap) return [];

  for (const [node, pins] of this.sourceMap.entries()) {
    for (const [pin, meta] of pins.entries()) {
      if (!meta.mcp) continue;

      const paramMap = new Map();

      for (const param of meta.params || []) {
        if (!param.name || typeof param.name !== 'string') continue;

        // handle nested destructured names that were not flattened properly
        if (param.name.startsWith('{') && param.name.endsWith('}')) {
          const raw = param.name.slice(1, -1).split(',').map(p => p.trim());
          for (const sub of raw) {
            paramMap.set(sub, {
              name: sub,
              type: 'string', // fallback type if not known
              description: ''
            });
          }
          continue;
        }

        const nameParts = param.name.split('.');
        if (nameParts.length === 1) {
          // top-level parameter
          if (!paramMap.has(param.name)) paramMap.set(param.name, { ...param });
        } else {
          const [parent, child] = nameParts;
          let container = paramMap.get(parent);
          if (!container) {
            container = {
              name: parent,
              type: 'object',
              description: '',
              properties: [],
              required: []
            };
            paramMap.set(parent, container);
          }
          container.properties.push({
            name: child,
            type: param.type,
            description: param.description || ''
          });
          if (!container.required.includes(child)) {
            container.required.push(child);
          }
        }
      }

      const tool = {
        name: meta.mcpName || `${node}_${pin}`,
        description: meta.mcpDescription || meta.summary || `Trigger ${pin} on ${node}`,
        parameters: Array.from(paramMap.values()),
        returns: meta.returns || '',
        node,
        pin,
        handler: meta.handler,
        file: meta.file,
        line: meta.line
      };

      tools.push(tool);
    }
  }

  return tools;
},

/**
 * Convert an abstract MCP toolspec to OpenAI-compatible format.
 *
 * @param {Array<object>} tools - Output from generateToolSpecs()
 * @returns {Array<object>} - OpenAI tool spec array
 */
convertToOpenAITools(tools) {
  return tools.map(tool => {
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };

    for (const param of tool.parameters) {
      const { name, type, description, properties, required } = param;

      if (!name || !type) continue;

      const propSchema = { type, description: description || '' };

      if (type === 'object' && properties) {
        propSchema.properties = {};
        propSchema.required = required || [];

        for (const sub of properties) {
          propSchema.properties[sub.name] = {
            type: sub.type,
            description: sub.description || ''
          };
        }
      }

      schema.properties[name] = propSchema;
      schema.required.push(name);
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: schema
      }
    };
  });
}





};

function ModelBlueprint(arl) {
    
    // get the extension of the path
    const ext = getExt(arl.userPath);

    // check if model or library...
    this.is = {
        // the model can be in a blueprint..
        blu : (ext =='vmblu' || ext == 'json') ? true : false,

        //..or in a compiled library
        lib : (ext == 'js'  || ext == 'mjs')  ? true : false,

        // will be set if this model is visible in the select node popup
        selectable: false,

        // set to true if the model has changed and the file still needs to be synced
        dirty: false,

        // set to true for the main model
        main: false,

        // true if raw has just been updated
        fresh: false,
    };

    // where the resource is
    this.arl = arl;

    // the key is used to access the model map
    this.key = null;

    // The header of the model
    this.header = new ModelHeader();

    // The libraries that the model can use
    this.libraries = new ModelStore();

    // the model in the resource - json, but must still be cooked
    this.raw = null;

    // the map of the source code for the model, organised per node and pin (it is a map of maps)
    this.sourceMap = null;
}
ModelBlueprint.prototype = {

    toJSON() {

        return this.arl.userPath
    },

    makeKey() {
        this.key = convert.djb2(this.arl.getFullPath());
    },

    checkType() {
        const ext = getExt(this.arl.userPath);

        this.is = {
            blu : (ext == 'vmblu' || ext == 'json') ? true : false,
            lib : (ext == 'js'    || ext == 'mjs') ? true : false,
        };
    },

    copy() {

        const newModel = new ModelBlueprint(this.arl);

        newModel.key = this.key ? this.key.slice() : null;
        newModel.header = {...this.header};
        newModel.raw = this.raw;

        return newModel
    },

    findRawNode(lName) {

        const root = this.raw?.root;
        if (!root) return null;

        // split and reverse
        const parts = convert.splitLink(lName); // name @ group1 @ group2 => now: ['group2', 'group1', 'name']

        // if there is just one name (no group names) look in all groups...
        if (parts.length == 1) {
            if (lName == root.name) return root
            return root.nodes ? this.findRawRecursive(root.nodes, lName) : null;
        }

        // we use the group names
        let search = root;

        // walk through the parts of the name...
        for (const name of parts) {

            search = search.nodes?.find(n => name === n.name);
            if (!search) return null;
        }

        return search;
    },

    // find a node recursively in the raw nodes - we do a breadth first search!
    findRawRecursive(nodes, name) {

        // first search in the list of nodes
        for (const rawNode of nodes) {
            // get the name
            if (name == rawNode.name) return rawNode
        }

        // now look in the subnodes for each node
        for (const rawNode of nodes) {

            // check if the node is a group node
            if (rawNode.kind == 'group' && rawNode.nodes.length > 0) {

                // if there are sub-nodes, maybe the node is there ?
                const found = this.findRawRecursive(rawNode.nodes, name);
                if (found) return found
            }
        }
        return null
    },

    setSelectable() {
        this.is.selectable = true;
    },

    // gets the raw content of a model - not recursive !
    async fetch() {

        // if the linked file is a .js file - it is a library
        let raw = null;
        if (this.is.lib) {

            const rawCode = await this.arl.get('text')
            .catch( error => {
                console.error(`${this.arl.userPath} is not a valid library file`, error);
            });

            //check
            if (!rawCode) return null

            // transform the text into json
            raw = this.analyzeJSLib(rawCode);

            // error if failed
            if (! raw) console.error(`Model not found in library file: ${this.arl.userPath}`);

            // we are done 
            return raw
        }

        // if the extension is json it is another node file
        if (this.is.blu) {

            // read the file - returns the body or throws an error
            raw = await this.arl.get('json')
            .catch( error => {
                console.error(`${this.arl.getFullPath()} is not a valid model file}`, error);
            });

            // done
            return raw
        }
        
        // it's one or the other !
        console.error(`${this.arl.userPath} is not a model nor a library file`);

        return null
    },

    // get the source and cook the header
    async getRaw() {

        // fetch
        this.raw = await this.fetch();

        // check
        if ( this.raw?.header ) this.header.cook(this.arl, this.raw.header);

        // raw is fresh
        this.is.fresh = true;

        // return the raw
        return this.raw
    },

    addRawLibraries(arlRef, rawLibs) {

        // get the models for the libraries
        const newModels = this.libraries.newModels(arlRef, rawLibs);

        // add the model to the modellist - the model is not fetched yet 
        // this happens at the end when the model is loaded (see library.load)
        for(const model of newModels) this.libraries.add(model);
    },

    // Finds the model text in the library file...
    analyzeJSLib(rawCode) {

        // find the libname in the code
        let start = rawCode.indexOf('"{\\n');
        let end = rawCode.indexOf('\\n}";', start);

        // check
        if (start < 0 || end < 0) return null

        // get the part between starting and ending bracket
        let rawText = rawCode.slice(start+1,end+3);

        // allocate an array for the resulting text
        const cleanArray = new Array(rawText.length);
        let iClean = 0;
        let iRaw = 0;

        // remove all the scape sequences
        while (iRaw < rawText.length) {

            // get the first character
            const char1 = rawText.charAt(iRaw++);

            // if not a backslash, just copy
            if (char1 != '\\') {
                cleanArray[iClean++] = char1;
            }
            else {

                // get the character that has been escaped 
                const char2 = rawText.charAt(iRaw++);

                // handle the different escape sequences
                if (char2 == 'n') 
                    cleanArray[iClean++] = '\n';
                else if (char2 == '"') 
                    cleanArray[iClean++] = '"';
            }
        }

        // combine all characters into a new string
        const cleanText = cleanArray.join('');

        // and parse
        return JSON.parse(cleanText)
    }
};

Object.assign(ModelBlueprint.prototype, sourceMapHandling);

// The model file uses a model map
function ModelStore() {

    // the key to the map is the full path - the value is a model or an array of models...
    this.map = new Map();
}
ModelStore.prototype = {

    reset() {
        this.map.clear();
    },

    size() {
        return this.map.size
    },

    // New models are returned in an array but not added to the map
    newModels(ref, rawModels) {

        // a list of models that are new, i.e. not yet in the ModelStore
        const modelList=[];

        // check
        if (rawModels.length < 1) return modelList

        // for each model in the array
        for (const rawModel of rawModels) {

            // now we have to resolve the user path to an absolute path
            const arl = ref.resolve(rawModel);

            // check if we have already handled this file...
            if ( this.contains(arl) ) continue

            // create the new model - there is no uid !
            const newModel = new ModelBlueprint(arl);

            // also add it to the new model list
            modelList.push(newModel);
        }

        // return the list of models that are not yet in the map
        return modelList
    }, 
    
    add(model) {

        const fullPath = model.arl.getFullPath();

        // check if the key is already in the map
        const storedLink = this.map.get(fullPath);

        // if the stored model is for a different arl, we have a key-clash and we have to add an array of links for the key
        if ( storedLink ) return this

        // just add the model to the map
        this.map.set(fullPath, model);
        
        // return the linkmap
        return this
    },

    contains(arl) {

        // check
        return this.map.has(arl.getFullPath())
    },

    get(key) {
        return this.map.get(key)
    },

    valuesArray() {

        return Array.from(this.map.values())

    },

    // find the model if you only have the arl
    findArl(arl) {

        // check 
        if (!arl) return null

        for(const model of this.map.values()) {
            if (model.arl?.equals(arl)) return model
        }
        return null
    },

    toJSON(){
        // return the list of links
        return [...this.map.values()]
    },

    // (re)loads all the model in the map
    async load() {

        // a promise array
        const pList = [];

        // build the library for the modcom in the node library....
        for (const model of this.map.values()) {

            // set it as selectable
            model.is.selectable = true;

            // get the content of the file
            pList.push( model.getRaw() );
        }

        // wait for all...
        await Promise.all(pList);
    },



    // // check all models if they have changed
    // async checkForChanges() {

    //     // a promiss array
    //     const pList = []

    //     // build the library for the modcom in the node library....
    //     for (const model of this.map.values()) {

    //         // check if it has changed
    //         pList.push( model.hasChanged() )
    //     }

    //     // wait for all...
    //     await Promise.all(pList)
    // },
};

// The model file uses a factory map
function FactoryMap() {

    // the key to the map is the full factory path
    this.map = new Map();
}
FactoryMap.prototype = {

    reset() {
        this.map.clear();
    },

    size() {
        return this.map.size
    },

    // get the factories from the strings in the file
    addRawFactories(model) {

        for (const rawFactory of model.raw.factories) {

            // check that we have a path
            // if (!rawFactory.path) continue

            // the factories have to be resolved wrt the file that contains them
            const arl = model.arl.resolve( rawFactory );

            // get the full path of the factory
            const fullPath = arl.getFullPath();

            // check if we have already handled this file...
            if ( this.map.has( fullPath)) continue

            // create the factory - we just need the arl here, so no factory name required
            const factory = new Factory();

            // save the arl
            factory.arl = arl;

            // and add the factory
            this.map.set(fullPath, factory);
        }
    }, 

    // only adds new factory files
    add(factory) {

        const fullPath = factory.arl.getFullPath();

        // check if the key is already in the map
        const storedFactory = this.map.get(fullPath);

        // check
        if ( storedFactory ) return 

        // just add the key/value pair to the map
        this.map.set(fullPath, factory);
        
        // return the factoryMap
        return this
    },

    toJSON(){
        // return the list of links
        const list = [];

        // save the factory path
        for (const factory of this.map.values()) list.push(factory.arl.userPath);

        return list
    },

};

const compileFunctions = {

// gets the root node of main
async getRoot(model) {

    // load the model and its dependencies
    await this.getFactoriesAndModels(model);

    // build the model
    const root = this.compileNode(model, null);

    // done
    return root
},

// encodes a node 
encode(node, model) {
    
    if (!node) return null

    // get the factories
    node.collectFactories(this.factories);

    // get the imports
    node.collectModels(this.models);

    // the object to encode
    const target = {
        header: model.header,
    };

    // add the libraries if any
    if (this.models?.size() > 0) target.imports = this.models;
    if (this.factories?.size() > 0) target.factories = this.factories;
    if (model.libraries?.size() > 0) target.libraries = model.libraries;

    // set the root
    target.root = node;

    // stringify the target
    const text =  JSON.stringify(target,null,4);

    // return the result
    return text
},

// returns a node - or null - based on the name and the model
// the models have been loaded already
compileNode(model, lName) {

    if (!model) {
        console.log(`No model for node '${lName}' `);
        return null
    }
    
    // find the node in the model
    const rawNode =  lName ? model.findRawNode(lName) : model.raw?.root;

    // check 
    if (!rawNode) {
        console.log(`Node '${lName}' not found in model ${model.arl.userPath}`);
        return null
    }

    // check for an infinite loop
    if (!this.pushCurrentNode(model, rawNode)) {
        console.log(`infinite loop for  '${lName}' in model ${model.arl.userPath} `);
        return null
    }

    // cook the raw node - link here is the raw version !
    const node = rawNode.kind == "dock" ? this.linkedNode(rawNode) : this.localNode(rawNode);

    // pop from the stack
    this.popCurrentNode();

    // done
    return node
},

// cook a local node - it can be a group node or a source node
localNode(raw) {

    // create the node
    const newNode = raw.kind == "source" ? new SourceNode( null, raw.name) : new GroupNode(  null, raw.name);

    // and cook the node - note that cook can call localNode / linkedNode again
    newNode.cook(raw, this);

    // generate UIDS
    newNode.setUIDS(this.UID);

    // done
    return newNode
},

// get and cook a linked node
linkedNode(raw) {

    // get the key and the name of the linked node
    const [path, lName] = [raw.link.path, raw.link.node];

    // get the fullpath of the node
    const currentModel = this.getCurrentModel();

    // if there is no file key, it means that the linked node comes from the current file !
    const model = (path == null || path === './') ? currentModel : this.models.get(currentModel.arl.resolve(path).getFullPath());

    // get the node from the link
    const linkedNode = this.compileNode(model, lName);

    // check if ok
    const newNode = linkedNode ? this.goodLink(raw, lName, model, linkedNode) : this.badLink(raw, lName, model);

    // generate UIDS
    newNode.setUIDS(this.UID);

    // done
    return newNode
},

goodLink(raw, lName, model, linkedNode) {

    // create the new node - make it the same type as the linked node
    const dock = linkedNode.is.source ? new SourceNode( null, raw.name) : new GroupNode( null, raw.name);

    // cook the new node using the pins and routes in the file
    dock.cook(raw, this);

    // set the link (after cooking!)
    dock.setLink(model, lName);

    // and now fuse the two nodes to highlight the differences 
    dock.fuse(linkedNode);

    // done
    return dock
},

// if we did not find the model, create the node as it was stored - show that the link is bad
badLink(raw, lName, model) {

    // create the node as a source node
    const dock = new SourceNode( null, raw.name);

    // and cook the node...
    dock.cook(raw, this);

    // set the link - even if it is bad (after cooking!)
    dock.setLink(model, lName);

    // set the link as bad
    dock.linkIsBad();

    // done
    return dock
},

// update all the nodes that have a link
updateNode(node) {

    //console.log(`${node.name} => ${node.link ? (node.link.model.is.fresh ? 'update' : 'no update') : 'no link'}`)

    // check the link
    if (node.link && node.link.is.bad) return

    // if raw has been updated (i.e. is fresh), recompile the node
    if (node.link && node.link.model.is.fresh) {

        // get the node
        const newNode = this.compileNode(node.link.model, node.link.lName);

        // check
        if (!newNode) {
            node.linkIsBad();
            return
        }

        // maybe we have to change the type of node..
        // node = node.compatible(newNode) ? node : this.switchNodeType(node)   
        
        // maybe we have to change the type of node..
        if (!node.compatible(newNode)) {

            // change the node into a group or source + transfer all the routes
            const otherType = node.switchNodeType();

            // replace the node by the other type node
            this.view.root.swap(node, otherType);

            // change
            node = otherType;
        }
        
        // and fuse with the new node
        node.fuse(newNode);

        // build the the rx/tx tables for the imported nodes.
        node.rxtxBuildTxTable();

        // if the node was updated we are done
        return
    }

    // for group nodes check the subnodes...
    if (node.nodes) for(const subNode of node.nodes) this.updateNode(subNode);
},


};

function ModelCompiler( UID ) {

    // The models used in the main model
    this.models = new ModelStore();

    // the list of factory files used 
    this.factories = new FactoryMap();

    // the model stack is used when reading files - it prevents circular references
    this.stack = [];

    // set the uid generator (if any)
    this.UID = UID;
}
ModelCompiler.prototype = {

    // reset the compiler - keep the UID
    reset() {

        // reset the factory map
        this.factories.reset();

        // reset
        this.models.reset();

        // reset the stack
        this.stack.length = 0;
    },

    resetFresh() {
        for (const model of this.models.map.values()) model.is.fresh = false;
    },

    // some functions that manipulate the stack - returns false if the node is already on the stack !
    pushCurrentNode(model, rawNode) {

        // get the name
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock;
    
        // if the uid is already on the stack, this means that there is a risk of an inifinte loop in the construction of the node
        const L = this.stack.length;

        // check if the uid is already on the stack
        if (L > 1) for (let i=0; i<L-1; i++) {
                if ( this.stack[i].nodeName === nodeName && this.stack[i].model === model) {

                console.log(nodeName, model.arl.userPath);

                return false
            }
        }
    
        // push the model and the uid on the stack
        this.stack.push({model, nodeName});
    
        // return true if ok
        return true
    },

    popCurrentNode() {
        this.stack.pop();
    },
    
    // returns the current model on the stack 
    getCurrentModel() {
        return this.stack.at(-1).model
    },

    getMainModel() {
        return this.stack[0].model
    },

    // recursive function to load a model and all dependencies of a model - only loads a model file if it is not yet loaded
    async getFactoriesAndModels(model) {

        // check if the model is in the model map
        if (this.models.contains(model.arl)) return

        // add the model to the model map
        this.models.add(model);

        // load the model only if not loaded yet 
        if ( ! model.raw && ! await model.getRaw()) return
 
        // if the model is a model, load the models referenced in the file
        if (model.is.blu) {

            // get the factories of the model
            if (model.raw.factories?.length > 0) this.factories.addRawFactories( model );

            // add the libraries but only for the main model
            if (model.is.main && model.raw.libraries)  model.addRawLibraries(model.arl, model.raw.libraries);

            // check if there are external models referenced
            if (! (model.raw.imports?.length > 0)) return

            // get the new models in this file - returns an array of new models (ie. not yet in the model map - size can be 0)
            const newModels = this.models.newModels( model.arl, model.raw.imports);

            // check
            if (newModels.length > 0) {

                // use an array of promise
                const pList = [];

                // and now get the content for each of the models used in the file
                for (const newModel of newModels) pList.push( this.getFactoriesAndModels(newModel) );

                // wait for all...
                await Promise.all(pList);
            }
        }
    },

    // finds or adds a model based on the arl
    async findOrAddModel(arl) {
        
        // check if we have the model already
        let model = this.models.findArl(arl);

        // check
        if (model) return model

        // it is a new model
        model = new ModelBlueprint(arl);

        // make a key for the model (it is a new model !)
        model.makeKey();

        // load the model and its dependencies
        await this.getFactoriesAndModels(model);

        // done
        return model
    },

    // update the model and factory maps
    async updateFactoriesAndModels() {

        // make a copy of the current model map
        const oldModels = this.models.valuesArray(); 

        // reset the map
        this.models.reset();

        // The list with promises
        const pList = [];

        // load the dependencies for the models that have changed
        for (const model of oldModels) {

            //the main model is always ok
            if (model.is.main) continue

            // if the model is in the model map, it is for sure the most recent one !
            if (this.models.contains(model.arl)) continue

            // save the old utc before reloading the file
            const utcBefore = model.header.utc;

            // load the model
            await model.getRaw();   

            // check
            if (!model.raw) continue

            // check if there was a time change
            if (utcBefore !== model.header.utc) {

console.log(`-SYNC- newer version of '${model.arl.userPath}'`);

                // sync the model
                pList.push( this.getFactoriesAndModels(model));
            }
            else {
                // add the model
                this.models.add(model); 
                
                // change the freshness
                model.is.fresh = false;
            }
        }

        // wait for all...
        await Promise.all(pList);
    },
};

Object.assign(ModelCompiler.prototype, compileFunctions);

function LibraryManager(tx, sx) {

    // save tx
    this.tx = tx;

    // the ref arl
    this.ref = null;

    // The library is a model store
    this.libraries = null;
}
LibraryManager.prototype = {

    // the library can be empty, but not null
    onSwitchLibrary({ref,libraries}) {

        // check
        if (!libraries || !ref) return

        // set the reference
        this.ref = ref;

        // set the library
        this.libraries = libraries;
        
        // the nodes to display have to be updated
        this.tx.send("build table", this.libraries.map);
    },

    async onAddFile(userPath){

        // check
        if (!this.ref) return

        // make an arl
        const arl = this.ref.resolve(userPath);

        // check
        if (! arl) return console.log(`Could not resolve "${userPath}" to arl`)

        // check if we have already this file...
        let model = this.libraries.findArl( arl );

        // If we do not have the model, load it and add it
        if ( ! model) {

            // create the model
            model = new ModelBlueprint(arl);

            // get the file
            await model.getRaw();

            // make the key for the model
            // model.makeKey()

            // add to the map
            this.libraries.add(model);
        }

        // simply set the link as selectable 
        model.setSelectable();

        // the nodes to display have to be updated
        this.tx.send("build table", this.libraries.map);
    },

    onRemoveFile({model}){

        // check
        if (!model) return

        // just set the link non-selectable
        model.is.selectable = false;

        // and rebuild the node table..
        this.tx.send("build table", this.libraries.map);
    }
};

const zap = {
    nothing:0,
    node:1,
    pin:2,
    ifName:3,
    icon:4,
    header:5,
    label:6,
    pad:7,
    padArrow:8,
    route:9,
    busSegment:10,
    busLabel:11,
    tack:12,
    selection:13
};

// make a binary bit pattern for the keys that were pressed
const NONE = 0;
const SHIFT = 1;
const CTRL = 2;
const ALT = 4;

// // a bit pattern for the keys that are pushed
// export function keyMask(e) {

//     let mask = NONE

//     mask |= e.shiftKey ? SHIFT : 0
//     mask |= e.ctrlKey ? CTRL : 0
//     mask |= e.altKey ? ALT : 0

//     return mask;
// }

const mouseHandling = {

    // a bit pattern for the keys that are pushed
    keyMask(e) {

        let mask = NONE;

        mask |= e.shiftKey ? SHIFT : 0;
        mask |= e.ctrlKey ? CTRL : 0;
        mask |= e.altKey ? ALT : 0;

        return mask;
    },

    // checks what we have hit inside a client area of a view
    mouseHit(xyLocal) {
        // notation
        const hit = this.hit;

        // if there is an active selection we check if it was hit
        if ( this.selection.what != selex.nothing && this.selection.what != selex.singleNode) {
            [hit.what, hit.selection, hit.node] = this.selection.hitTest(xyLocal);
            if (hit.what != zap.nothing) return 
        }

        // if there is no content we can stop here
        if(!this.root) return 

        // search the nodes (in reverse - most recent nodes first)
        const nodes = this.root.nodes;
        for(let i=nodes.length-1; i >= 0; i--) {
            [hit.what, hit.node, hit.lookWidget] = nodes[i].hitTest(xyLocal);
            if (hit.what != zap.nothing) return            
        }

        // search the pads
        for (const pad of this.root.pads) {
            [hit.what, hit.pad] = pad.hitTest(xyLocal);
            if (hit.what != zap.nothing) return
        }
        
        // search the buses
        for(const bus of this.root.buses) {
            [hit.what, hit.bus, hit.busLabel, hit.tack, hit.busSegment] = bus.hitTest(xyLocal);
            if (hit.what != zap.nothing) return
        }

        // check if we have hit a route
        this.mouseHitRoutes(xyLocal);
    },

    mouseHitRoutes(xyLocal) {

        const hit = this.hit;

        // search the routes of the nodes 
        for (const node of this.root.nodes) {
            [hit.what, hit.route, hit.routeSegment] = node.hitRoute(xyLocal);
            if (hit.what != zap.nothing) return
        }
 
        // search the pads
        for (const pad of this.root.pads) {
            [hit.what, hit.route, hit.routeSegment] = pad.hitRoute(xyLocal);
            if (hit.what != zap.nothing) return
        }
        
        // search the buses
        for(const bus of this.root.buses) {
            [hit.what, hit.route, hit.routeSegment] = bus.hitRoute(xyLocal);
            if (hit.what != zap.nothing) return
        }
    },

    onDblClick(xyLocal,e) {

        // hit was updated at the first click !
        const hit = this.hit;

        // check what was hit
        switch (hit.what) {

            case zap.pin:
            case zap.ifName:

                // check
                if (!hit.node || hit.node.cannotBeModified()) return

                // ok
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget});
                break;

            case zap.header: 
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget});
                break;

            case zap.label:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget});
                break;

            case zap.busLabel:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.busLabel});
                break;

            case zap.pad:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.pad});
                break;
        }
    },
 

    onWheel(xy,e) {

        // notation
        const tf = this.tf;

        // we change scale parameter 
        let k = e.deltaY > 0 ? 0.9 : 1.1;

        /*  xy is the position of the cursor. It should remain the same in the old and in the new transform

            So if xy' is the position of the cursor in the parent window then:
            xy = tf(xy') = tf"(xy')  or xy' = inverse tf(xy) = inverse tf"(xy)

               xy*s + dx = xy*s*k + d'x  
            => d'x = dx + xy*s - xy*s*k

            note that the inverse tf here is the same as the direct tf for the canvas !
            The canvas transforms are from xy-window to xy-screen, whereas this transform is from 
            xy-window to the next xy-window on the stack.
        */

        // calculate the new tf dx and dy
        tf.dx = tf.dx + xy.x*tf.sx*(1-k);
        tf.dy = tf.dy + xy.y*tf.sy*(1-k);

        // *** this was wrong ***
        //tf.dx = xy.x*(1-k) + k*tf.dx
        //tf.dy = xy.y*(1-k) + k*tf.dy

        // also adjust the scale factors
        tf.sx *= k;
        tf.sy *= k;
    },
};

const pinAreaHandling = {

    // pins and interfaceNames can be selected !
    pinAreaStart(node, pos) {

        // reset
        this.reset();

        // notation
        const rect = node.look.rect;

        // save the y position
        this.yWidget = pos.y;

        // type of selection
        this.what = selex.pinArea;

        // start a pin selection - make the rectangle as wide as the look
        this.activate(rect.x - style$1.pin.wOutside, pos.y, rect.w + 2*style$1.pin.wOutside, 0, style$1.selection.cRect);
    },

    pinAreaResize(node, pos) {

        const lRect = node.look.rect;

        if (pos.y > lRect.y && pos.y < lRect.y + lRect.h) {

            // notation
            const y = this.yWidget;

            // define the selection rectangle (x and w do not change)
            if (pos.y > y) {
                this.rect.y = y;
                this.rect.h = pos.y - y;
            }
            else {
                this.rect.y = pos.y;
                this.rect.h = y - pos.y;
            }

            // highlight the pins that are selected
            this.widgets = [];
            const dy = style$1.pin.hPin/2;
            for(const widget of node.look.widgets) {

                if (widget.is.pin || widget.is.ifName) {

                    if (widget.rect.y + dy > this.rect.y && widget.rect.y + dy < this.rect.y + this.rect.h) {
                        this.widgets.push(widget);
                        widget.is.selected = true;
                    }
                    else {
                        widget.is.selected = false;
                    }
                }
            }
        }
    },

    // select the pins that are in the widgets array
    pinAreaSelect(widgets) {

        if (widgets.length == 0) return

        // reset (not necessary ?)
        this.widgets.length = 0;

        // set each widget as selected
        for (const widget of widgets) {
            if (widget.is.pin || widget.is.ifName) {
                this.widgets.push(widget);
                widget.is.selected = true;
            }
        }

        // set a rectangle around the widgets
        this.pinAreaRectangle();
    },

    // the pins have been sorted in the y position
    // note that the first 'pin' is actually a ifName !
    pinAreaRectangle() {

        // check
        if (this.widgets.length == 0) return;

        // sort the array
        this.widgets.sort( (a,b) => a.rect.y - b.rect.y);

        // get the first and last element from the array
        const look = this.widgets[0].node.look;
        const first = this.widgets[0].rect;
        const last = this.widgets.at(-1).rect;

        // draw a rectangle - make the rectangle as wide as the look
        this.activate(  look.rect.x - style$1.pin.wOutside, first.y, 
                        look.rect.w + 2*style$1.pin.wOutside, last.y + last.h - first.y, 
                        style$1.selection.cRect);
        
        // this is a widget selection
        this.what = selex.pinArea;
    },

    pinAreaDrag(delta) {

        // check
        if (this.widgets.length == 0) return

        // the node
        const node = this.widgets[0].node;

        // move the selection rectangle only in the y-direction, but stay in the node !
        if (this.rect.y + delta.y < node.look.rect.y + style$1.header.hHeader ) return
        if (this.rect.y + delta.y > node.look.rect.y + node.look.rect.h) return

        // move as required
        this.rect.y += delta.y;
    },
};

// a constant for indicating the selection type
const selex = {
    nothing: 0,
    freeRect: 1,
    pinArea: 2,
    singleNode: 4,
    multiNode: 5
};

// nodes etc. selectd in the editor
function Selection(view=null)  {

    // the rectangle
    this.rect= {x:0, y:0, w:0, h:0};

    // when selecting widgets inside a node this is where the selection started
    this.yWidget = 0;

    // The color of the selection - can change
    this.color = style$1.selection.cRect;

    // the selection type
    this.what = selex.nothing;

    // the view path
    this.viewPath = view ? view.getNamePath() : '';

    // the selected elements
    this.nodes= [];
    this.pads= [];
    this.buses= [];
    this.tacks= [];
    this.widgets= [];
}
Selection.prototype = {

    render(ctx) {

        // we only use width as a check 
        if (this.what === selex.freeRect || this.what === selex.pinArea) {

            // notation
            const rc = this.rect;

            // draw the rectangle
            shape.roundedRect(ctx, rc.x, rc.y, rc.w, rc.h, style$1.selection.rCorner, 1, this.color.slice(0,7), this.color );
        }
    },

    // keep viewpath and color
    reset() {

        // not active
        this.what = selex.nothing;

        // reset yWidget 
        this.yWidget = 0;

        // unselect the pins if any
        for (const pin of this.widgets) pin.unSelect();

        // unselect the nodes if any
        for(const node of this.nodes) node.unSelect();

        // clear the selected objects
        this.nodes.length = 0;
        this.pads.length = 0;
        this.buses.length = 0;
        this.widgets.length = 0;
        this.tacks.length = 0;
    },

    shallowCopy() {

        const selection = new Selection();

        selection.rect = {...this.rect};
        selection.yWidget = this.yWidget;
        selection.color= this.color;
        selection.what = this.what;
        selection.viewPath = this.viewPath;
        selection.nodes = this.nodes?.slice();
        selection.pads = this.pads?.slice();
        selection.buses = this.buses?.slice();
        selection.tacks = this.tacks?.slice();
        selection.widgets = this.widgets?.slice();

        return selection
    },

    canCancel(hit) {

        // if we have hit a selection we cannot cancel it
        // if we have not hit it we can cancel the rectangle selections 
        // The single node selection is not cancelled normally

        return (hit.what == zap.selection) ? false : (this.what === selex.freeRect || this.what === selex.pinArea) 
    },

    setRect(x,y,w,h) {

        const rc = this.rect;

        rc.x = x;
        rc.y = y;
        rc.w = w;
        rc.h = h;
    },

    activate(x,y,w,h, color) {

        this.setRect(x,y,w,h);
        if (color) this.color = color;
    },

    // start a free rectangle selection
    freeStart(where) {

        // reset the current selection
        this.reset();

        // free rectangle selection
        this.what = selex.freeRect;
 
        // set the x and y value for the selection rectangle
        this.setRect(where.x, where.y, 0, 0);
    },

    singleNode(node) {

        // unselect other - if any
        this.reset();

        // select a single node
        this.nodes = [node];

        // set the selection type
        this.what = selex.singleNode;

        // set the rectangle
        node.doSelect();
    },

    singleNodeAndWidget(node, pin) {

        // unselect
        this.reset();

        // reselect
        this.singleNode(node);
        this.widgets = [pin];
        pin.doSelect();
    },

   // extend an existing selection
    extend(node) {

        // if there are no nodes this is the first selection
        if (this.nodes.length <1) {
            this.singleNode(node);
            return
        }

        // if the node is selected - unselect
        if (this.nodes.includes(node)) {

            // remove the node from the array
            eject(this.nodes, node);

            // unselect the node
            node.unSelect();

            // done
            return
        }

        // save the node
        this.nodes.push(node);

        // and set as selected
        node.doSelect();

        // multinode selection
        this.what = selex.multiNode;
    },

    // get the single selected node
    getSingleNode() {
        return this.what == selex.singleNode ? this.nodes[0] : null
    },

    getSelectedWidget() {
        return this.what == selex.singleNode ? this.widgets[0] : null
    },

    getPinAreaNode() {
        return ((this.what == selex.pinArea) && this.widgets[0]) ? this.widgets[0].node : null 
    },

    // switch the selected widget
    switchWidget(pin) {

        if (pin) {
            this.widgets[0]?.unSelect();
            pin.doSelect();
            this.widgets[0] = pin;
            return
        }
    
        // if no pin is given try below
        const below = this.widgetBelow();
        if (below) return this.switchWidget(below)

        // try above ...
        const above = this.widgetAbove();
        if (above) return this.switchWidget(above)
    },

    widgetBelow() {

        // get node and widget
        const [node, current] = (this.what != selex.singleNode) ? [null, null] : [this.nodes[0], this.widgets[0]];

        // check
        if (!current || !node) return null

        let below = null;
        for(const widget of node.look.widgets) {

            if ((widget.is.pin || widget.is.ifName) && 
                (widget.rect.y > current.rect.y) &&
                (!below || (widget.rect.y < below.rect.y))) below = widget;
        }

        // done
        return below
    },

    widgetAbove() {

        // get node and widget
        const [node, current] = (this.what != selex.singleNode) ? [null, null] : [this.nodes[0], this.widgets[0]];

        // check
        if (!current || !node) return null

        let above = null;
        for(const widget of node.look.widgets) {

            if ((widget.is.pin || widget.is.ifName) && 
                (widget.rect.y < current.rect.y) &&
                (!above || (widget.rect.y > above.rect.y))) above = widget;
        }

        // done
        return above
    },

    // check if we have hit the selection
    hitTest(xyLocal) {

        // If there is a rectangle, we have a simple criterion
        if ((this.what == selex.freeRect || this.what == selex.pinArea) && inside(xyLocal, this.rect)) return [zap.selection, this, null]

        // multi-node or single node
        // search the nodes (in reverse - visible node on top of another will be found first)
        for (let i = this.nodes.length-1; i>=0; i--) {
            if (inside(xyLocal, this.nodes[i].look.rect)) return [zap.selection, this, this.nodes[i]]
        }

         // nothing
         return [zap.nothing, null, null]
    },

    setColor(color) {
        this.color = color;
    },

    resize(dw, dh) {
        this.rect.w += dw;
        this.rect.h += dh;
    },

    move(delta) {
        // move the selection rectangle
        this.rect.x += delta.x;
        this.rect.y += delta.y;
    },

    drag(delta) {

        // *1* move 

        // move the nodes in the selection 
        for( const node of this.nodes) node.look.moveDelta(delta.x, delta.y);

        // also move the pads
        for (const pad of this.pads) pad.move(delta);

        // move the buses if there are nodes in the selection
        if (this.nodes.length > 0)
            for (const bus of this.buses) bus.move(delta.x, delta.y);

        // or otherwise just the bus tacks 
        else 
            for (const tack of this.tacks) tack.slide(delta);

        // move the routes that have start end end points in the selection
        

        // *2* Route adjustments

        // now we adjust the end points of the routes again
        for( const node of this.nodes) node.look.adjustRoutes();

        // adjust the routes for the pads
        for(const pad of this.pads) pad.adjustRoutes();

        // also for the buses
        for (const bus of this.buses) bus.adjustRoutes();      

        // *3* move the selection rectangle

        this.rect.x += delta.x;
        this.rect.y += delta.y;
    },

    // shallowCopy() {

    //     const slct = new Selection()

    //     // make a shallow copy of the nodes etc
    //     for (const node of this.nodes) slct.nodes.push(node)
    //     for (const bus of this.buses) slct.buses.push(bus)
    //     for (const pad of this.pads) slct.pads.push(pad)
    //     for (const pin of this.widgets) slct.widgets.push(pin)
    //     for (const tack of this.tacks) slct.tacks.push(tack)

    //     // make a real copy of the rect
    //     slct.rect = {...this.rect}

    //     // copy the color
    //     slct.color = this.color

    //     return slct
    // },

    // return the top left node in the selection
    topLeftNode() {

        if (this.nodes.length == 0) return null

        let topleft = this.nodes[0];

        for(const node of this.nodes) {

            if ((node.look.rect.y < topleft.look.rect.y) && (node.look.rect.x < topleft.look.rect.x)) topleft = node;
        }

        return topleft
    },

    // make the view wider then the selection because of the added pads
    makeViewRect() {

        const rc = this.rect;

        return {x: rc.x - style$1.view.wExtra, 
                y: rc.y - style$1.view.hExtra, 
                w: rc.w + 2*style$1.view.wExtra, 
                h: rc.h + 2*style$1.view.hExtra}
    },

    // position the new group look as close as possible to the top left node 
    makeLookRect() {

        const topleft = this.topLeftNode();
        const rcSel = this.rect;

        const x = topleft ? topleft.look.rect.x : rcSel.x;
        const y = topleft ? topleft.look.rect.y : rcSel.y;

        // leave w and h at 0
        return {x,y,w:0,h:0}
    },

    adjustPaths(ref) {

        if (!this.nodes) return

        for (const node of this.nodes) node.adjustPaths(ref);
    },


};
Object.assign(Selection.prototype, pinAreaHandling);

// ------------------------------------------------------------------
// Source node: Clipboard
// Creation date 4/22/2024, 5:20:28 PM
// ------------------------------------------------------------------


//Constructor for clipboard manager
function Clipboard(tx, sx) {

    // save the transmitter
    this.tx = tx;

    // If not local, the clipboard must be requested from other editors - always start with false
    this.local = false;

    // The source of the clipboard
    this.origin = null;

    // the selection for the clipboard
    this.selection = null;
    
    // keeps track of the nr of copies when pasting to make sure copies do not overlap
    this.copyCount = 0;
}

Clipboard.prototype = {

    // resets the content of the clipboard
    resetContent() {
        this.local = false;
        this.origin = null;
        this.selection = null;
        this.copyCount = 0;
    },

	// Output pins of the node
	sends: [
		'switch',
		'remote',
		'local'
	],

 	// Sets the clipboard to a local selection
	onSet({model, selection}) {

        // check
        if (!model || !selection) return

        // reset the clipboard
        this.resetContent();

        // set local
        this.local = true;

        // set the origin of the clipboard
        this.origin = model.copy();

        // copy the selection
        this.selection = selection.shallowCopy();

        // notify other possible editors
        this.tx.send('switch');
    },

    onGet(doc) {

        // if the clipboard is the local one ...
        if ( this.local ) {

            // ...just return the local clipboard
            this.tx.reply(this);
            return
        }

        // otherwise request the remote clipboard
        this.tx.request('remote')
        .then( async ({json}) => {

            // parse the json 
            const raw = JSON.parse(json);

            // check
            if (!raw) return
            
            //cook the clipboard - reuse the save compiler
            await this.cook(raw, doc.savecom);

            // send the clipboard to the editor
            this.tx.reply(this);
        });
        //.catch(error => console.log(`Error in clipboard manager "-> get" ${error}`))
    },

    onSwitched() {

        // indicate that the clipboard is remote now
        this.local = false;
    },

    // request to get the local clipboard of this editor as a json structure
    onLocal(doc) {

        // strange request if the clipboard is not local...
        if (! this.local ) {
            console.log('Warning: clipboard is not local !');
            return
        }

        // the object to convert and save - for the origin we save the full path 
        const target = {
            origin: this.origin.arl.getFullPath(),
            header: this.origin.header,
            what: this.selection.what,
            rect: this.selection.rect ? convert.rectToString(this.selection.rect) : null,
            viewPath: this.selection.viewPath,
            imports: null,
            factories: null,
            root: null,
            widgets: null
        };

        switch(this.what) {

            case selex.pinArea:{
                target.widgets = this.selection.widgets;
            }
            break

            case selex.freeRect:
            case selex.multiNode:
            case selex.singleNode: {

                // get the compiler
                const modcom = doc.savecom;

                // reset the model compiler
                modcom.reset();

                // set the root 
                target.root = new GroupNode(null, 'clipboard', null),

                // set the target
                target.root.nodes = this.selection.nodes.slice();
                target.root.buses = this.selection.buses.slice();
                target.root.pads = this.selection.pads.slice();

                // assemble the models and the factories
                target.root.collectFactories(modcom.factories);
                target.factories = modcom.factories;

                target.root.collectModels(modcom.models);
                target.imports = modcom.models;
            }
            break
        }

        // stringify the target
        const json =  JSON.stringify(target,null,4);
        
        // and send a reply
        this.tx.reply({json});
    },

    // For a remote clipboard, we cook the raw (json) clipboard 
    async cook(raw, modcom) {

        // we have to have at least the document the clipboard is coming from
        if ( ! raw.origin) return false

        // reset the clipboard
        this.resetContent();

        // now we have to resolve the user path to an absolute path
        const arl = new ARL().absolute(raw.origin);

        // create the model
        this.origin = new ModelBlueprint(arl);

        // set the raw field - this is what will be cooked
        this.origin.raw = raw;

        // also cook the header
        if (raw.header) this.origin.header.cook(arl, raw.header);

        // get a selection
        this.selection = new Selection();

        // set the viewPath
        this.selection.viewPath = raw.viewPath;

        // also get the rectangle if any
        if (raw.rect) this.selection.rect = convert.stringToRect(raw.rect);

        // the type of content in the selection
        this.selection.what = +raw.what;

        switch(this.selection.what) {

            case selex.freeRect:
            case selex.multiNode:
            case selex.singleNode: {

                // reset the model compiler
                modcom.reset();

                // cook the clipboard
                const root = await modcom.getRoot(this.origin);

                // check
                if (!root) return false

                // copy
                this.selection.nodes = root.nodes?.slice();
                this.selection.pads = root.pads?.slice();
                this.selection.buses = root.buses?.slice();
            }
            return true

            case selex.pinArea: {

                // we need a look and a node to convert the widgets
                const look = new Look({x:0, y:0, w:0, h:0});
                const node = new GroupNode(look);

                // convert all the widgets
                for(const strWidget of raw.widgets) {

                    // convert
                    const widget = look.cookWidget(node,strWidget);

                    // check and save
                    if (widget) this.selection.widgets.push(widget);
                }
            }
            return true

            default: 
            return false;
        }
    },

}; // clipboard manager.prototype

const messageHandling = {
    /**
     * @node editor
     */

    onSetDocument(doc) {
        // the document can be null
        if (!doc) {
            this.doc = null;
            this.redraw();
            return;
        }

        // for a new active doucment, screen size has not yet been set
        if (doc.view.noRect())
            doc.view.setRect(0, 0, this.canvas.width, this.canvas.height);

        // set the document as the active document
        this.doc = doc;

        // switch the node library (it can be empty but not null)
        this.tx.send('change library', {
            ref: doc.model.arl,
            libraries: doc.model.libraries,
        });

        // set the style for the document
        this.setStyle();

        // ..and redraw
        this.redraw();
    },

    // reply on the get request
    onGetDocument() {
        // reply the active document
        this.tx.send('reply document', this.doc);
    },

    onShowSettings() {
        this.canvas.getBoundingClientRect();

        const header = this.doc.model.header;
        const redraw = () => this.redraw();

        // save the current version of the rgb
        const oldRgb = header.style.rgb;

        // send the settings to the popup
        this.tx.send('document settings', {
            title: 'Document Settings',
            path: this.doc.model.arl?.getFullPath() ?? '- unspecified -',
            settings: header,
            pos: { x: 25, y: 25 },
            onColor(rgb) {
                header.style.adapt(rgb);
                redraw();
            },
            ok(runtime) {
                // save the value of the runtime
                header.runtime = runtime;
            },
            cancel() {
                header.style.adapt(oldRgb);
                redraw();
            },
        });
    },

    onSyncModel() {
        this.doc?.update().then(() => {
            // and redraw
            this.redraw();
        });
    },

    onRecalibrate() {
        // reset the transform data
        this.doc?.view.toggleTransform();

        // and redraw
        this.redraw();
    },

    onGridOnOff() {
        // check
        const state = this.doc?.view?.state;

        // toggle
        if (state) state.grid = !state.grid;

        // redraw
        this.redraw();
    },

    onAcceptChanges() {
        // check
        if (!this.doc) return;

        // loop through the nodes of the document
        this.doc.view.root.acceptChanges();

        // redraw
        this.redraw();
    },

    onSizeChange(rect) {
        // check if the size is given
        if (!rect) return;

        // adjust
        this.canvas.width = rect.w;
        this.canvas.height = rect.h;

        // don't forget to adjust the style
        this.canvas.style.width = rect.w + 'px';
        this.canvas.style.height = rect.h + 'px';

        // Initialize the 2D context
        this.ctx = this.canvas.getContext('2d');

        // we have to reinit the canvas context
        this.setStyle();

        // if there is a document,
        if (this.doc) {
            // change the size of the main view
            this.doc.view?.setRect(0, 0, rect.w, rect.h);

            // and recalculate the screen filling windows
            this.doc.view?.redoBigRecursive();
        }

        // and redraw
        this.redraw();
    },

    onMakeLib(e) {
        // notation
        const doc = this.doc;

        // check
        if (!doc?.view?.root) return;

        // the position of the popup
        const pos = { x: e.screenX, y: e.screenY };

        // propose a path for the lib
        const libPath =
            doc.target.library?.userPath ??
            removeExt(doc.model.arl.userPath) + '-lib.js';

        // request the path for the save as operation
        this.tx.send('show lib path', {
            title: 'Make library build file...',
            entry: libPath,
            pos: pos,
            ok: (libPath) => doc.toJavascriptLib(libPath),
            cancel: () => {},
        });
    },

    onMakeApp(e) {
        //notation
        const doc = this.doc;

        // check that we have a model
        if (!doc?.view?.root) return;

        // CHECK ALSO FOR doc.model.arl + message !

        // the position of the popup
        const pos = { x: e.screenX, y: e.screenY };

        // convert to a workspace path
        //const appPath = doc.target.application?.userPath ?? Path.changeExt(doc.model.arl.userPath, 'js')
        const appPath =
            doc.target.library?.userPath ??
            removeExt(doc.model.arl.userPath) + '-app.js';

        // request the path for the save as operation
        this.tx.send('show app path', {
            title: 'Make application...',
            path: appPath,
            pos: pos,
            ok: (appPath) => doc.toJavascriptApp(appPath),
            cancel: () => {},
        });
    },

    onRunApp() {
        // make the src and the html to run the page
        const runable = this.doc.toJavascriptApp(null);

        // request to run this
        this.tx.send('run', {
            mode: 'page',
            js: runable.srcArl,
            html: runable.htmlArl,
        });
    },

    onRunAppInIframe() {
        const runable = this.doc.toJavascriptApp(null);

        // send out the run message
        this.tx.send('run', {
            mode: 'iframe',
            js: runable.srcArl,
            html: runable.htmlArl,
        });

        // check that we have an iframe
        if (!this.iframe) {
            this.iframe = document.createElement('iframe');
            this.tx.send('iframe', this.iframe);
        }

        // set the url of the iframe
        this.iframe.src = runable.htmlArl.url;
    },

    onPinProfile({}) {},

    // group and node are just the names of the nodes
    async onSelectedNode({ model, nodePath, xyLocal }) {
        // find the model in the
        const node = await this.doc.nodeFromLibrary(model, nodePath);

        // check
        if (!node) return;

        // move the node to the xyLocal
        node.look.moveTo(xyLocal.x, xyLocal.y);

        // simply add the node to the active view
        this.doEdit('nodeFromNodeLib', { view: this.doc.focus, node });
    },

    onSavePointSet({}) {
        // make this accessible..
        const doc = this.doc;

        //title,message, pos,ok, cancel}
        this.tx.send('save point.confirm', {
            title: 'Confirm to set a new save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: () => {
                // check
                if (!doc?.model) return;

                // Get the actual node to save (mostly the root...)
                const toSave = doc.getNodeToSave();

                // check
                if (!toSave) return;

                // get a model compiler for collecting factories and models
                const modcom = new ModelCompiler(doc.UID);

                // encode the root node as a string, but convert it back to json !
                doc.model.raw = JSON.parse(modcom.encode(toSave, doc.model));
            },
            cancel: () => {},
        });
    },

    onSavePointBack({}) {
        // make this accessible..
        const editor = this;
        const doc = this.doc;

        //title,message, pos,ok, cancel}
        this.tx.send('save point confirm', {
            title: 'Confirm to go back to the previous save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: async () => {
                // just load the model again ...
                // await doc.load()
                doc.reCompile();

                // reset the undo stack
                doc.undoStack.reset();

                // and redraw
                editor.redraw();

                // save it - it is the new reference
                try {
                    // save this version
                    const text = JSON.stringify(doc.model.raw, null, 4);

                    // check and save
                    if (text) doc.model.arl.save(text);
                } catch (err) {
                    console.log(
                        `JSON stringify error: ${err}\nin 'on save point.back'`
                    );
                }
            },
            cancel: () => {},
        });
    },
};

const undoRedoHandling = {

    // Execute a requested edit
    doEdit(verb, param) {

        // execute doit
        redox[verb].doit(param);

        // refresh the editor
        this.redraw();
    },

    // save the edit for later undo/redo
    saveEdit(verb, param) {

        // push the edit on the undo-stack
        this.doc.undoStack.push({verb, param});

        // signal that a new edit has been done
        this.tx.send("new edit",{verb});

        // the model is out of sync with the file and with the raw json
        this.doc.model.is.dirty = true;
    },

    // just signal the edit to force a save 
    signalEdit(verb) {
        this.tx.send("new edit",{verb});
    },

    // send a message without saving
    send(msg, param) {

        this.tx.send(msg,param);
    },

    // get the parameters of the edit
    getParam() {
        return this.doc.undoStack.last()?.param ?? {}
    },

    // get the verb of the edit
    getVerb() {
        return this.doc.undoStack.last()?.verb
    },

    // undo the last edit
    undoLastEdit() {

        // pop the action from the stack
        const action = this.doc.undoStack.back();

        console.log('undo ',action ? action.verb : '-nothing-');

        // check
        if (!action) return

        // execute
        redox[action.verb].undo(action.param);
    },

    // redo the last edit
    redoLastEdit() {

        // get the current action
        const action = this.doc.undoStack.forward();

        console.log('redo ',action ? action.verb : '-nothing-');

        //check
        if (!action) return

        // execute
        redox[action.verb].redo(action.param);
    },

    dropLastEdit() {
        this.doc.undoStack.back();
    },



};

let editor;
function EditorFactory(tx, sx) {

    // create a new editor
    editor = new Editor();

    // save tx and sx
    editor.tx = tx;
    editor.sx = sx;

    // set up the editor
    editor.setup();

    // send the canvas to the page layout
    tx.send("canvas", editor.canvas);

    // return the editor
    return editor
}

// state for the editor
const editorDoing = {
    nothing: 0,
    viewResize: 1,
    viewDrag: 2,
    hoverBorder: 3
};

// The Editor function
function Editor() {

    // The canvas and context
    this.canvas = null;
    this.ctx = null;

    // the active document
    this.doc = null;

    // The state of the editor (see possible actions above)     *** Not to be confused with the state of the view ! ***
    this.state = {
        view:null,
        widget: null,
        action: editorDoing.nothing,
    };

    // the transmit function and sender
    this.tx = null;

    // the settings
    this.sx = null;

    // true if we have already launched requestAnimationFrame
    this.waitingForFrame = false;
}
Editor.prototype = {

    setup() {
        // create the canvas
        this.canvas = document.createElement("canvas");

        // make the canvas focusable
        this.canvas.setAttribute('tabindex', '0');

        // but avoid the focus outline around it
        this.canvas.style.outline = 'none';

        // create a context
        this.ctx = this.canvas.getContext('2d');

        // set some values that will rarely change
        this.setStyle();
        
        // add the event handlers
        this.addEventHandlers();

        // set the background
        this.clear();
    },

    getCanvasContext() {
        return this.ctx
    },

    addEventHandlers() {

        // add the keyboard handlers to the document
        document.addEventListener('keydown', (e)=> this.onKeydown(e) );
        document.addEventListener('keyup', (e) => this.onKeyup(e) );

        // add mouse related event listeners to the canvas
        this.canvas.addEventListener('mousedown',(e)=>this.onMouseDown(e));
        this.canvas.addEventListener('mouseup',(e)=>this.onMouseUp(e));
        this.canvas.addEventListener('mousemove',(e)=>this.onMouseMove(e));
        this.canvas.addEventListener('mousewheel',(e)=>this.onWheel(e));
        this.canvas.addEventListener('contextmenu',(e)=>this.onContextMenu(e));
        this.canvas.addEventListener('click',(e)=>this.onClick(e));
        this.canvas.addEventListener('dblclick',(e)=>this.onDblClick(e));
        this.canvas.addEventListener('dragover',(e)=>this.onDragOver(e));
        this.canvas.addEventListener('drop',(e)=>this.onDrop(e));

        // not reliable
        //this.canvas.addEventListener('keydown', (e)=> this.onKeydown(e) )
        //this.canvas.addEventListener('keyup', (e) => this.onKeyup(e) )

        // just for testing
        // this.canvas.addEventListener('focus', () => console.log('Canvas is focused'));
        // this.canvas.addEventListener('blur', () => console.log('Canvas lost focus'));
    },

    // clear the screen
    clear() { 
        this.ctx.fillStyle = style$1.std.cBackground;
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    },

    switchView(view) {

        if (!view) return
 
        // notation
        const doc = this.doc;

        // only switch if view is different
        if (view == doc.focus) return;

        // change the apperance
        doc.focus.unHighLight();

        // set the view in focus
        doc.focus = view;

        // change the apperance
        doc.focus.highLight();

        // and bring the view to the front in the parent view
        doc.focus.parent?.viewToFront(doc.focus);
    },

    // set some style values that will rarely change
    setStyle() {

        // if we have doc we set the style specified in the doc
        if (this.doc) style$1.switch(this.doc.model.header?.style);

        // also set the standard ctx values 
        const ctx = this.ctx;
        const std = style$1.std;

        ctx.font = std.font;
        ctx.strokeStyle = std.cLine;
        ctx.fillStyle = std.cFill;
        ctx.lineCap = std.lineCap;
        ctx.lineJoin = std.lineJoin;
        ctx.lineWidth = std.lineWidth;
    },

    redraw() {

        // if we are already waiting for a frame, nothing to do
        if (this.waitingForFrame) return;

        // change to waiting status
        this.waitingForFrame = true;

        // launch request
        window.requestAnimationFrame( ()=> {

            // clear and redraw
            this.clear();

            // render the document
            this.doc?.view.render(this.ctx); 
            
            // ready for new redraw requests
            this.waitingForFrame = false;
        });
    },

    changeCursor(cursor) {
        editor.canvas.style.cursor = cursor;
    },

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    xxdeltaForPaste(pos, cb) {

        const slct = cb.selection;

        // get the reference to calculate the delta
        const ref = slct.rect ? slct.rect : 
                    slct.nodes?.length > 0 ? slct.nodes[0].look.rect : 
                    slct.pads?.length > 0  ? slct.pads[0].rect : 
                    {x:0, y:0};

        // increment the copy count
        cb.copyCount++;
        
        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        if ((ref.x == pos.x) && (ref.y == pos.y)) 

            return {    x: cb.copyCount * style$1.look.dxCopy, 
                        y: cb.copyCount * style$1.look.dyCopy}
        else 
            return {    x: pos.x - ref.x + (cb.copyCount-1) * style$1.look.dxCopy, 
                        y: pos.y - ref.y + (cb.copyCount-1) * style$1.look.dyCopy }
    },

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    xxxdeltaForPaste(pos, cb) {

        // get the reference to calculate the delta
        const ref = cb.rect ? cb.rect : 
                    cb.root.nodes.length > 0 ? cb.root.nodes[0].look.rect : 
                    cb.root.pads.length > 0  ? cb.root.pads[0].rect : 
                    {x:0, y:0};

        // increment the copy count
        cb.copyCount++;
        
        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        if ((ref.x == pos.x) && (ref.y == pos.y)) 

            return {    x: cb.copyCount * style$1.look.dxCopy, 
                        y: cb.copyCount * style$1.look.dyCopy}
        else 
            return {    x: pos.x - ref.x + (cb.copyCount-1) * style$1.look.dxCopy, 
                        y: pos.y - ref.y + (cb.copyCount-1) * style$1.look.dyCopy }
    },

    // this is to copy to the external windows clipboard
    textToExternalClipboard(text) {

        const blob = new Blob([text], { type: "text/plain" });
        const data = [new ClipboardItem({ ["text/plain"]: blob })];
        navigator.clipboard.write(data);
    },
};
Object.assign(Editor.prototype, mouseHandling$1, keyboardHandling$1, messageHandling, undoRedoHandling);

function placePopup(pos) {
    return {x: pos.x - 15, y:pos.y + 10}
}

const nodeClickHandling = {

    showExportForm(pos) {

        const node = this;
        editor.tx;

        // send the show link path
        editor.tx.send("show link",{   
            title:  'Export to link' ,
            name: node.name,
            path:  '', 
            pos:    pos,
            ok: (newName, userPath) => editor.doEdit('saveToLink',{node, newName, userPath}),
            cancel:()=>{}
        });
    },

    showLinkForm(pos) {

        const node = this;
        const tx = editor.tx;

        // check what path to show - show no path if from the main model
        const linkPath = (node.link && (node.link.model != editor.doc?.model)) ? node.link.model?.arl.userPath : '';

        // name to show
        const linkName = node.link ? node.link.lName : node.name;

        // send the show link path
        editor.tx.send("show link",{   

            title: 'Set link' ,
            name: linkName,
            path: linkPath,
            pos: pos,
            ok: (newName,newPath)=> {

                // if changed 
                if ((newName != linkName) || (newPath != linkPath))
                    editor.doEdit('changeLink',{node, lName: newName, userPath: newPath});
            },
            open: (newName, newPath) => {

                // check for changes
                if ((newName != linkName) || (newPath != linkPath))
                    editor.doEdit('changeLink',{node, lName: newName, userPath: newPath});

                // open the file if the link is to an outside file !
                if (node.link.model?.arl && (node.link.model != editor.doc?.model)) tx.send('open document',node.link.model.arl);
            },
            cancel:()=>{}
        });
    },

    iconClick(view, icon, pos) {

        const node = this;
        const tx = editor.tx;

        // move the popup a bit away from the icon
        const newPos = placePopup(pos);

        switch (icon.type) {
    
            case 'link':
            case 'lock':

                this.showLinkForm(newPos);
                break

            case 'factory':

                // set the factory name and path if not available
                const factoryName = node.factory.fName.length < 1 ? convert.nodeToFactory(node.name) : node.factory.fName;
                const factoryPath = node.factory.arl ? node.factory.arl.userPath : '';

                // show the factory
                tx.send("show factory",{ title: 'Factory for ' + node.name, 
                                        name: factoryName,
                                        path: factoryPath,
                                        pos: newPos,
                                        ok: (newName,newPath) => {

                                            // do the edit
                                            editor.doEdit('changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()});
                                        },
                                        open: async (newName, newPath) => {

                                            // change the factory if anything was changed
                                            if ((newName != factoryName )||(newPath != factoryPath))
                                                editor.doEdit('changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()});

                                            // get the current reference
                                            const arl = node.factory.arl ?? editor.doc.resolve('./index.js');

                                            // open the file
                                            tx.send('open source file',{arl});
                                        },
                                        cancel:()=>{}
                });
                break;

            case 'group':
                
                // the next view to show
                let nextView = null;

                // if we have a saved view
                if (node.savedView) {

                    // ..that is visible, close it and show the parent note that the savedview could still be 'raw' 
                    if (node.savedView.viewState?.visible) {

                        nextView = node.savedView.parent;
                        if (nextView) node.savedView.closeView();
                    }
                    // otherwise restore the view (and cook it if necessary)
                    else {
                        view.restoreView(node);
                        nextView = node.savedView;
                    }                    
                }
                else  {
                    // create a brand new subview
                    nextView = view.newSubView(node);
                }

                // switch the focus window to next
                if (nextView) editor.switchView(nextView);
                break

            case 'cog':

                tx.send("settings",{    title:'Settings for ' + node.name, 
                                        pos: newPos,
                                        json: node.sx,
                                        ok: (sx) => editor.doEdit("changeNodeSettings",{node, sx})
                                    });                  
                break     

            case 'pulse':

                tx.send("runtime settings",{    title:'Runtime settings for ' + node.name, 
                                                pos: newPos,
                                                dx: node.dx,
                                                ok: (dx) => editor.doEdit("changeNodeDynamics",{node, dx})
                                            });
                break 

            case 'comment':

                // save the node hit
                tx.send("node comment", {   header: 'Comment for ' + node.name, 
                                            pos: newPos, 
                                            uid: node.uid, 
                                            text: node.prompt ?? '', 
                                            ok: (comment)=> editor.doEdit("changeNodeComment",{node, comment})
                                        });
                break        
        }
    
    },

    iconCtrlClick(view,icon, pos) {

        const node = this;
        const tx = editor.tx;

        switch (icon.type) {
    
            case 'link': 
            case 'lock': {

                // open the file if it points to an external model
                if (node.link?.model?.arl && (node.link.model != editor.doc?.model)) tx.send('open document',node.link.model.arl);
            }
            break

            case 'factory': {

                // check - should not be necessary
                if ( ! node.is.source) return

                // get the current reference
                const arl = node.factory.arl ?? editor.doc.resolve('./index.js');

                // request to open the file
                if (arl) tx.send("open source file", {arl});
            }
            break
    
            case 'group':
                // if the node has a saved view, we show that otherwise create a new
                node.savedView ?  view.restoreView(node) : view.newSubView(node);

                // make it full screen
                node.savedView?.big();
                break
        }
    
    },

};

const collectHandling = {

// make the list of factories used by this node
    collectFactories(factories) {

        // if the node has a link, the factory file is not local, so we do not save the factory file
        if (this.link) return

        // get the factory
        if (this.is.source && this.factory.arl != null) {

            // only adds new factories
            factories.add(this.factory);
        }
        
        // get the factories of the other nodes
        if (this.is.group) for (const node of this.nodes) node.collectFactories(factories);
    },

    // make the list of models this file uses as link
    // only do this at the first level - when a model has been found we do not continue for the nodes of this model !
    collectModels(models) {

        // if the node has a link
        if (this.link) {

            // ...add the link to the linklist if required 
            if (this.link.model && !this.link.model.is.main) {

                // and add it to the model list
                models.add(this.link.model);
            }
        }
        else {

            // ...continue for all nodes
            this.nodes?.forEach( node => node.collectModels(models) );
        }
    },

    // if we save the model in a lib we only keep the links to other libs - all the rest is put in the file
    collectModelsForLib(models, main) {

        // if the node is linked to a lib that is different from the lib we are saving to, add it
        if (this.link) {

            // get the model
            const model = this.link.model;
        
            // add the model if it is not the main file (it is only added if not yet in the list)
            if ( model &&  !model.arl.equals(main.arl))  models.add(model);
        }
        else {
            // ...continue for all nodes
            this.nodes?.forEach( node => node.collectModelsForLib(models, main) );
        }
    },

    // get the list of source files that need to be imported
    collectImports(srcImports, lib=null) {

        // for group nodes - loop through all nodes..
        if (this.is.group) {

            // if the node comes from a library then a priori the sources will also come from that library
            if (this.link?.model?.is.lib) lib = this.link.model;

            // continue for the nodes..
            for(const node of this.nodes) node.collectImports(srcImports,lib);

            // also collect the routers (if any)
            for (const bus of this.buses) if (bus.hasFilter()) bus.getFilter(srcImports, lib, this.link);

            // done
            return
        }

        // for a source node find the arl to be used for the source - or take the ./index.js file in the directory of the model
        const srcArl = this.getSourceArl(lib) ?? srcImports[0].arl;

        // check if the factoryname is already in use somewhere and use an alias if necessary - else just use the name
        const factorySpec = this.factory.duplicate(srcImports, srcArl) ? `${this.factory.fName} as ${this.factory.alias}` : this.factory.fName;

        // see if the arl is already in the list
        const found = srcImports.find( srcImport => srcImport.arl.equals(srcArl));

        // if we have the file, add the item there if..
        if (found) {

            // ..it is not already in the list..
            const item = found.items.find( item => item == factorySpec);

            // ..if not add it to the list
            if (!item) found.items.push(factorySpec);
        }
        else {
            // add the file and put the first item on the list
            srcImports.push({arl:srcArl, items:[factorySpec]});
        }
    },

    // build an array of source nodes ** Recursive **
    makeSourceLists(nodeList, filterList) {

        if (this.is.source) {
            nodeList.push(this);
        }
        else {
            // output a warning for bad links
            if (this.link?.is.bad) {
                console.warn(`Group node "${this.name}" is missing. ModelBlueprint "${this.link.model.arl.userPath}" not found`);
            }
            // output a warning for empty group nodes
            else if (!this.nodes) {
                console.warn(`Group node "${this.name}" is empty`);
            }
            else {

                // add the buses with a router to the array !
                for(const bus of this.buses) {
                    if (bus.is.cable && bus.is.filter) filterList.push(bus);
                }

                // and the nodes !
                for(const node of this.nodes) node.makeSourceLists(nodeList, filterList);
            }
        }
    },

    // checks if a factory with the same name does already exist and sets the alias if so
    // Note that we only search once ! so if factory and _factory exist we are screwed
    xxxduplicateFactory(srcImports, ownArl) {

        // check for duplicates (same name in different file !)
        const duplicate = srcImports.find( srcImport => {

            // ignore the ownArl of course
            if (srcImport.arl.equals(ownArl)) return false

            // search for 
            return srcImport.items.find( item => item == this.factory.fName)
        });        

        // if the node exist already in a different file...
        if (duplicate) {

            // give a warning
            console.warn(`Duplicate factory name: ${this.factory.fName} is already defined in ${duplicate.arl.userPath}`);

            // make an alias
            this.factory.alias = '_' + this.factory.fName;

            // we have a duplicate
            return true
        }
        else {
            // set the alias to null
            this.factory.alias = null;

            //no duplicate found...
            return false
        }
    },
};

function Link(model, lName) {

    this.model = model;

    //The format of lName is node @ group1 @ group2 ...
    this.lName = lName;
    //this.uid = null
    this.is = {
        bad: false
    };
}
Link.prototype = {

    copy() {
        const newLink = new Link(this.model, this.lName);
        //newLink.uid = this.uid
        return newLink
    },

    toJSON() {

        // get the key for the link
        const path = (this.model && !this.model.is.main) ? this.model.arl.userPath : './';

        return {
            path,
            node: this.lName
        }
    }
};

const linkHandling = {
    // note that model can be null !
    setLink(model, lName) {

        // change or create a link
        if (this.link) {

            // set the new values
            this.link.model = model;
            this.link.lName = lName;

            // check the link icon
            this.link.model?.is.lib ? this.look.checkLinkIcon('lock') : this.look.checkLinkIcon('link');
        }
        else {

            // create the link
            this.link = new Link(model, lName);

            // set the icon
            model?.is.lib ? this.look.addIcon('lock') : this.look.addIcon('link');
        }
    },

    clearLink() {

        // also remove the link widget
        this.look.removeLinkIcon();

        // and we add a source or group icon for the node (addIcon removes icons that have the same place !)
        this.is.source ? this.look.addIcon('factory') : this.look.addIcon('group');

        // clear the link
        this.link = null;
    },

    linkIsBad() {

        // the link is bad
        this.link.is.bad = true;

        // show that the link is bad
        this.look.badLinkIcon();      
    },

    linkIsGood() {
        // the link is bad
        this.link.is.bad = false;

        // show that the link is bad
        this.look.goodLinkIcon();
    },

    // change the filenames to filenames relative to the filename of the view (document)
    adjustPaths( newRefArl ) {

        // if the node has a link ...change the link - we do not change the subnodes ! 
        if (this.link) {

            this.link.model.arl.makeRelative( newRefArl );
        }

        // if the node is a source node, change the factory arl if any
        else if (this.factory?.arl) {
            this.factory.arl.makeRelative( newRefArl );
        }

        // there is no link - look at the subnodes
        else if (this.nodes) for( const node of this.nodes) node.adjustPaths( newRefArl );
    },
};

const routeHandling = {

// for the undo operation of a disconnect we have to save all the routes to and from this node
getRoutes() {

    const allRoutes = [];

    // save the routes to all the pins
    for (const pin of this.look.widgets) {

        // check
        if (!pin.is.pin) continue

        // make a copy of the routes
        for (const route of pin.routes) allRoutes.push(route);
    }

    // done
    return allRoutes
},

// for the undo operation of a disconnect we have to save all the routes to and from this node
getAllRoutes(widgets) {

    const allRoutes = [];

    // save the routes to all the pins
    for (const pin of widgets) {

        // check
        if (!pin.is.pin) continue

        // make a copy of the routes
        for (const route of pin.routes) allRoutes.push(route);
    }

    // done
    return allRoutes
},

connect() {},

disconnect() {
    for (const widget of this.look.widgets) if (widget.is.pin) widget.disconnect();
},

disconnectPinArea(widgets) {
    for (const widget of widgets) if (widget.is.pin) widget.disconnect();
},

isConnected() {

    for (const widget of this.look.widgets) if (widget.is.pin && widget.routes.length > 0) return true
    return false
},

// highlight all the routes
highLight() {
    // clear the highlight state first
    this.is.highLighted = true;

    // unhighlight the routes if the look at the other side is not highlighted
    for(const widget of this.look.widgets) {

        // only check pins that have routes
        if (!widget.is.pin || widget.routes.length == 0) continue

        for(const route of widget.routes) {

            const other = route.from === widget ? route.to : route.from;

            route.highLight();

            if (other.is.tack) other.bus.highLightRoutes(widget);
        }
    }
},

// un-highlight all the routes
unHighLight() {

    // clear the highlight state first
    this.is.highLighted = false;

    // unhighlight the routes if the look at the other side is not highlighted
    for(const widget of this.look.widgets) {

        // only check pins that have routes
        if (!widget.is.pin || widget.routes.length == 0) continue

        for(const route of widget.routes) {

            const other = route.from === widget ? route.to : route.from;

            route.unHighLight();

            if (other.is.tack) other.bus.unHighLightRoutes(widget);
        }
    }
},

};

const compareHandling = {

    // remove zombie pins and accept new or added pins
    acceptChanges() {

        // accept all the changes for this look
        if (this.look) this.look.acceptChanges();

        // .. and for all the subnodes 
        this.nodes?.forEach( node => node.acceptChanges());
    },

    // compares the settings of the nodes
    // new values are added, removed values are removed
    // for existing entries the value is copied
    sxUpdate(linkNode) {

        // If there are no settings, just return
        if (!linkNode.sx) return

        // update the derived settings
        this.sx = updateDerivedSettings(linkNode.sx, this.sx);
    },

    sameRelativePosition(dockLook, linkLook, lw){

        // Calculate the same relative position in the dockLook look as in the linkLook look
        return {    x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                    y: dockLook.rect.y + (lw.rect.y - linkLook.rect.y)}
    },

    // find the position for a new pin with a prefix: we have to make sure it is added to the correct ifName group
    prefixPinPosition(dockLook, lw){

        // get the prefix
        const prefix = lw.getPrefix();

        // find the ifName
        const ifName = dockLook.findInterfaceName(prefix);

        // find the ifName group
        const ifPins = ifName ? dockLook.getInterface(ifName) : null;

        // check
        if (! ifPins) {
            // this should not happen - even a new prefix will have been added (see below)
            console.log('*** InterfaceName not found ***' + prefix + '  ' + lw.name);

            // add at the end ...
            return {
                x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                y: dockLook.rect.y + dockLook.rect.h
            }
        }

        // take the last element of the array
        const last = ifPins.at(-1);

        // add the item behind the last 
        return {    x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                    y: last.rect.y + last.rect.h}
    },

    // The position is the default position in the dockLook node
    // we put a new ifName just in front of the next ifName or at the end
    newInterfaceNamePosition(dockLook, lw) {

        // if we find no ifName add to the end
        const newPos = {x: dockLook.rect.x, y: dockLook.rect.y + dockLook.rect.h};

        // search for the first ifName below pos.y
        for(const sep of dockLook.widgets) {

            // check only interfaceNames
            if (! sep.is.ifName) continue

            // keep the order of adding stuff
            if (sep.is.added) continue

            // adapt y if the ifName is below but closer
            if (sep.rect.y > lw.rect.y && sep.rect.y < newPos.y) newPos.y = sep.rect.y;
        }

        // done
        return newPos
    },

    // check the pin/proxy for zombies or added pins/proxies with the linked node
    // Note that for 'addPin' the rxtx tables or the pads will be adjusted later
    widgetCompare( linkNode ) {

        // notation
        const dockLook = this.look;
        const linkLook = linkNode.look;

        // reset the dockLook pins - by default set all pins and interfaceNames to zombie
        for (const dw of dockLook.widgets) {

            // only pins and seperators have a wid - set to zombie so we can reset for pins that have been handled.
            if (dw.wid) {
                dw.is.added = false;
                dw.is.zombie = true;
            }
        }

        // we make a sorted list of proxies - sort according y-value
        // In that way new widgets will be added at the same position as in the linkLook node.
        const linkedSorted = linkLook.widgets.slice().sort( (a,b) => a.rect.y - b.rect.y);

        // we first handle the interfaceNames
        for(const lw of linkedSorted)  {

            // only interfaceNames
            if ( ! lw.is.ifName) continue

            // find the corresponding widget in the dock
            let dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.ifName && lw.is.ifName && (dw.text == lw.text)));
            if (dw) {
                dw.is.zombie = false;
                dw.wid = lw.wid;
                continue
            }

            // let's check for a name change -> find the corresponding widget in the dock
            dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.ifName && lw.is.ifName && (dw.wid == lw.wid)));
            if (dw) {
                this.dockInterfaceNameChange(dw, lw);
                dw.is.zombie = false;
                continue
            }

            // There is a new ifName
            this.dockNewInterfaceName(lw);
        }

         // now we handle the pins
        for(const lw of linkedSorted) {

            if ( ! lw.is.pin ) continue

            // exactly the same
            let dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.pin && (dw.name == lw.name) && (dw.is.input == lw.is.input) && (dw.is.channel == lw.is.channel)) );
            if (dw) {
                dw.is.zombie = false;
                dw.wid = lw.wid;
                continue
            }

            // probably a name change - select only unprocessed pins !
            dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.pin &&  (dw.wid == lw.wid) && (dw.is.input == lw.is.input)) );
            if (dw) {

                this.dockPinChange(dw, lw);
                dw.is.zombie = false;
                continue
            }

            // we consider the pin a new pin
            this.dockNewPin(lw, linkNode);
        }
    },

    dockNewPin(lw, linkNode) {

        // if the pin has a prefix it has to be added to the right prefix group !
        // by default we put a new pin at the same relative position as in the linked node
        const pos = (lw.pxlen != 0) ? this.prefixPinPosition(this.look, lw) : this.sameRelativePosition(this.look, linkNode.look, lw); 

        // add the pin
        const newPin = this.look.addPin(lw.name, pos, lw.is);

        // copy profile and prefix length
        newPin.profile = lw.profile;
        newPin.pxlen = lw.pxlen;

        // it is a new widget 
        newPin.is.added = true;
    },

    dockNewInterfaceName(lw) {

        // find the new position for a ifName (behind another ifName group !)
        const pos = this.newInterfaceNamePosition(this.look, lw);

        // add the ifName
        const newInterfaceName = this.look.addIfName(lw.text, pos);
        
        // it is a new widget 
        newInterfaceName.is.added = true;
    },

    // The widget is a pin but has changed (input to output is not considered a change, but a new pin !)
    dockPinChange(dw,lw) {

        // a channel was added or removed
        if (lw.is.channel != dw.is.channel)  dw.is.channel = lw.is.channel;

        // a name change - if the prefix has changed it must move to the appropriate seperator group
        if ((lw.name != dw.name)||(lw.pxlen != dw.pxlen)) {

            // if the widget has a prefix that is different from the current one
            if ((lw.pxlen != 0)&&(lw.getPrefix() != dw.getPrefix())) {

                // or the ifName text has changed or it is in the wrong ifName group
                const pos = this.prefixPinPosition(this.look, lw);

                // move the pin to a different location
                this.look.movePin(dw, pos);
            }

            // copy 
            dw.name = lw.name;
            dw.pxlen = lw.pxlen;
            dw.is.multi = lw.is.multi;
        }

        // profile change (silent)
        if (lw.is.input && lw.profile != dw.profile) dw.profile = lw.profile;     
        
        // signal the change
        dw.is.added = true;
    },

    dockInterfaceNameChange(dw, lw, linkNode) {

        // change the text
        if (lw.text == dw.text) return 

        // change the text
        dw.text = lw.text;
        dw.is.added = true;

        // change the prefixes of the pins
        this.look.interfaceChangePrefix(dw); 
    },

};

function Box(rect, node) {

    this.rect = {...rect};

    this.node = node;

    // binary state 
    this.is = {
        box: true,
        selected: false,
    };

}
// the specific box functions
Box.prototype = {

    render(ctx) {

        // notation
        const {x,y,w,h} = this.rect;
        const st = style$1.box;

        // draw the selection rectangle first if needed !
        if (this.is.selected) {

            // check for a label
            const label = this.node.look.findLabel();
            const hLabel = label && (label.text.length > 0) ? label.rect.h : 0;
            const dx = st.dxSel;
            const dy = st.dySel;
            shape.roundedRect(ctx,x-dx, y-dy-hLabel, w+2*dx, h+2*dy+hLabel, st.rCorner, st.wLineSel, st.cSelected.slice(0,7), st.cSelected);
        }

        // draw a rounded filled rectangle
        shape.roundedRect(ctx,x, y, w, h, st.rCorner, st.wLine, st.cLine, st.cBackground);
    },

    increaseHeight( delta) {
        this.rect.h += delta;
    },

    increaseWidth( delta) {
        this.rect.w += delta;
    },

    toJSON() {
        return {
            box: convert.relativeRect(this.rect, this.node.look.rect)
        }
    },
};

function Header(rect, node) {

    // the rectangle
    this.rect = {...rect};

    // binary state 
    this.is = {
        header: true,
        highLighted: false
    };
    // the title is the name of the node
    this.title = node.name;

    // and set the node
    this.node = node;
}
// the specific title functions
Header.prototype = {

    // called when editing starts
    startEdit() {
         return 'title'
    },

    endEdit(saved) {

        // trim whitespace from the text that was entered
        this.title = convert.cleanInput(this.title);

        // check for consequences...
        this.node.look.headerChanged(this, saved);
    },

    // draw a blinking cursor
    drawCursor(ctx, pChar, on) {

        // calculate the cursor coord based on the character position
        const cursor = shape.centerTextCursor(ctx, this.rect, this.title,pChar);    

        // select color - on or off
        // const color = on ? style.header.cTitle : style.header.cBackground 
        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;

        // draw the cursor
        shape.cursor(ctx, cursor.x, cursor.y, style$1.std.wCursor, this.rect.h, color );
    },

    render(ctx) {

        // notation
        let st = style$1.header;
        let {x,y,w,h} = this.rect;

        // render the top of the look with rounded corners..
        shape.roundedHeader(ctx, x, y, w, h, st.rCorner, st.wLine, st.cBackground, st.cBackground);

        // select a color
        const color = this.node.is.duplicate ? st.cBad : (this.is.highLighted ? st.cHighLighted : st.cTitle);

        // draw the text
        shape.centerText(ctx, this.title, st.font, color, x, y, w, h);
    },

    // true if the title area was hit (the y-hit is already established !)
    hitTitle(pos) {

        const icon = style$1.icon;
        const rc = this.rect;

        // the space for the icons left and right
        const xLeft = rc.x + icon.xPadding + 2*(icon.wIcon + icon.xSpacing);
        const xRight = rc.x + rc.w - icon.xPadding - 2*(icon.wIcon + icon.xSpacing);

        // check if outside the icon area
        return ((pos.x > xLeft) && (pos.x < xRight))
    },

    toJSON() {
        return {
            header: this.title,
            // rect: convert.relativeRect(this.rect, this.node.look.rect)
        }
    },
};

const pinNameHandling = {

    startEdit() {

        // before editing we remove the post or prefix from the name
        if (this.pxlen) {
            this.name = this.withoutPrefix();
            this.pxlen = 0;
        }

        // also reset the multi bit
        this.is.multi = false;

        // return the field that will be edited
        return "name"
    },

    endEdit(saved) {
        this.checkNewName() ? this.nameChanged(saved) : this.restoreSavedName(saved);      
    },

    // a function to get the displayname
    displayName() {
        return this.pxlen == 0 ? this.name : this.withoutPrefix()
    },

    // check for a name clash
    nameClash(other) {

        // both should be input or output
        if (this.is.input != other.is.input) return false

        // Check for lowercase identity
        if (this.lowerCase() == other.lowerCase()) return true

        // for inputs also check the handler name
        return (this.is.input) ? (convert.pinToHandler(this.name) == convert.pinToHandler(other.name)) : false
    },

    lowerCase() {
        return this.name.toLowerCase()
    },


    // when after editing the pin.name has changed, we might have to add a prefix and/or change the look 
    // return true when the name change can be accepted, otherwise false
    checkNewName() {

        // clean the user input
        this.name = convert.cleanInput(this.name);

        // the new name is empty - allowed only if no routes
        if (this.name.length == 0) return (this.routes?.length == 0)

        // if the newName starts with + or ends with + we have prefix naming
        if (convert.needsPrefix(this.name) || convert.needsPostfix(this.name)) {

            // the name should be longer than just the one character
            if (this.name.length == 1) return false

            // add the prefix/postfix to the name
            this.addIfName();
        }
        // no prefix naming - reset the prefix/postfix length
        else this.pxlen = 0;

        // reformat a multi message pin
        this.is.multi = convert.isMulti(this.name);
        if (this.is.multi) this.name = convert.cleanMulti(this.name);

        // check the route usage
        this.checkRouteUsage();

        // adjust the size of the widget and the look as needed
        this.node.look?.adjustPinWidth(this);

        // check the name for duplicates
        this.node.look.setDuplicatePin(this);

        // done
        return true
    },

    // After changing the name, we have to adapt the rx tx table 
    nameChanged(previousName) {

        // find the 'unchanged' name in the tx / rx table
        const rxtx = this.is.input  ? this.node.rxTable.find( rx => rx.pin == this) 
                                    : this.node.txTable.find( tx => tx.pin == this);

        // if the name has zero length, remove the pin
        if (this.name.length == 0) {

            // remove entry in rx or tx table 
            this.is.input ? eject(this.node.rxTable, rxtx) : eject(this.node.txTable, rxtx);

            // remove the widget from the look
            this.node.look.removePin(this); 

            // done
            return
        }
    },

    // restore the saved name 
    restoreSavedName(savedName) {

        // restore the name
        this.name = savedName;

        // if the saved name has a +, handle it
        if (convert.needsPrefix(savedName) || convert.needsPostfix(savedName)) this.addIfName();
    },

    // there is a prefix or a postfix that is not displayed
    withoutPrefix() {

        const plus = '+'; 
        //const x = '\u271A '

        if (this.pxlen == 0) return this.name

        else if (this.pxlen > 0) {

            let noPrefix = this.name.slice(this.pxlen);
            return noPrefix[0] != ' ' ? noPrefix : plus + noPrefix.trim()
        }
        else if (this.pxlen < 0) {

            let noPostfix = this.name.slice(0,this.pxlen-1);
            return noPostfix.at(-1) != ' ' ? noPostfix : plus + noPostfix.trim()
        }
    },

    // get the prefix or postfix for this pin
    getPrefix() {
        return    (this.pxlen > 0) ? this.name.slice(0,this.pxlen) 
                : (this.pxlen < 0) ? this.name.slice(this.pxlen)
                : null
    },


    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    ifNamePrefixCheck() {

        // reset pxlen
        this.pxlen = 0;

        // find the relevant ifName
        const text = this.node.look.findIfNameAbove(this.rect.y)?.text.toLowerCase();

        // check
        if (!text) return

        // Get the lowercase name
        const lowerCase = this.lowerCase();

        // check if the name of the ifName is a prefix to the pin
        if (convert.prefixMatch(text, lowerCase))
            this.pxlen = text.length;
        else if (convert.postfixMatch(text, lowerCase))
            this.pxlen = -text.length;
    },

    // after typing the name with a + at the beginning or the end, we have to set the prefixlength
    // the name has a prefix - find the prefix (ifName) and add it to the name - the name has been trimmed
    
    addIfName() {

        // find the ifName above
        const ifName = this.node.look.findIfNameAbove(this.rect.y);

        // check
        if (convert.needsPrefix(this.name)) {

            if (ifName) {

                this.name = convert.combineWithPrefix(ifName.text, this.name);
                this.pxlen = ifName.text.length;
            }
            else {
                this.name = this.name.slice(1).trimStart();
                this.pxlen = 0;
            }
        }
        else if (convert.needsPostfix(this.name)) {

            if (ifName) {
                this.name = convert.combineWithPostfix(ifName.text, this.name);
                this.pxlen = -ifName.text.length;
            }
            else {
                this.name = this.name.slice(0,-1).trimEnd();
                this.pxlen = 0;
            }
        }
    },

    // when we copy a node from another node it could be that we have not copied the ifName
    // so we have to check if pxlen has to be set to zero or not
    checkPrefix() {

        // check
        if (this.pxlen == 0) return;

        // get the prefix
        const prefix = this.getPrefix();

        // find the ifName above
        const ifName = this.node.look.findIfNameAbove(this.rect.y);

        // if the prefix and the ifName correspond all is well
        if (ifName && prefix == ifName.text) return;

        // cancel the prefix
        this.pxlen = 0;
    },

    // change the prefix or postfix of the pin
    // Note that the pin is supposed to have a prefix
    changePrefix(newPrefix) {

        // if there is no prefix nothing to do
        if (this.pxlen == 0) return;

        // if the new prefix has length 0 we simply set pxlen to 0
        if (newPrefix.length == 0) {
            this.pxlen = 0;
            return;
        }

        // strip away the old prefix and add the plus to make combine work !
        const baseName = this.pxlen > 0 ?  '+' + this.name.slice(this.pxlen+1) : this.name.slice(0, this.pxlen-1) + '+';

        // recombine with the new prefix
        this.name = convert.combineWithPrefix(newPrefix, baseName);

        // and reset pxlen
        this.pxlen = this.pxlen > 0 ? newPrefix.length : -newPrefix.length;
    },

    checkRouteUsage() {

        // reset all the routes to used
        for(const route of this.routes) route.is.notUsed = false;

        // check the routes
        for(const route of this.routes) {

            // get the other side of the route
            const other = route.from == this ? route.to : route.from;

            // check the twisted pair (thick line)
            route.is.twistedPair = other.is.multi || this.is.multi;

            // multi messages can only connect to multimessages
            if (other.is.pin) {
                if ((other.is.multi || this.is.multi) && !this.hasMultiOverlap(other)) route.is.notUsed = true;
            }
            else if (other.is.pad){
                if ((this.is.multi || other.proxy.is.multi) && !this.hasMultiOverlap(other.proxy)) route.is.notUsed = true;
            } 
            else if (other.is.tack) {

                // check all the bus routes
                let found = false;
                for(const tack of other.bus.tacks) {

                    // skip 
                    if (tack == other) continue

                    // get the pin or pad at the other end 
                    const busWidget = tack.route.to == tack ? tack.route.from : tack.route.to;

                    // it could be that the route was not used
                    if (other.bus.areConnected(this, busWidget)) {
                        tack.route.is.notUsed = false;
                        found = true;
                    }
                }
                // if we have not found one connection..
                if (!found) route.is.notUsed = true;
            }
        }
    },

    // extract the names between [] as an array
    extractMultis() {
        return convert.extractMultis(this.name)
    },

    // expand the multis - returns an array - if no multis, it contains the original name
    expandMultis() {
        return convert.expandMultis(this.name)
    },

    // is used to check if two pins are logically connected via a cable
    hasFullNameMatch(pin) {

        // The messages between the pins must overlap
        const allPinMsgs = pin.is.multi ? convert.expandMultis(pin.lowerCase()) : [pin.lowerCase()];
        const allThisMsgs = this.is.multi ? convert.expandMultis(this.lowerCase()) : [this.lowerCase()];

        // at the first common message we return
        for(const pinMsg of allPinMsgs) {
            if ( allThisMsgs.includes(pinMsg)) return true
        }

        // no overlap
        return false
    },

    // The names should partially match 
    hasMultiOverlap(pin) {
        
        if (pin.is.multi) {
            if (this.is.multi) 
                return this.checkMultiPartOnly(pin)
            else
                return pin.checkPartial(this.lowerCase())
        }
        else if (this.is.multi) {
            return this.checkPartial(pin.lowerCase())
        }
        return false
    },

    // both are multis !
    checkMultiPartOnly(pin) {

        // get the list of messages between brackets
        const pinMulti = convert.extractMultis(pin.lowerCase());
        const thisMulti = convert.extractMultis(this.lowerCase());

        // check - at the first match return
        for(const variant of pinMulti) {
            if (thisMulti.includes(variant)) return true
        }

        // no matches
        return false
    },

    // check if the othername contains at least one of the multis
    checkPartial(otherName) {

        // get the multis
        const thisMulti = convert.extractMultis(this.lowerCase());

        // check - at the first match return
        for(const variant of thisMulti) {
            if (otherName.indexOf(variant) >= 0) return true
        }

        // no matches
        return false
    },

    getMatch(mName) {

        if (this.is.multi) {

            const multiParts = convert.extractMultis(this.lowerCase());
            const multis = convert.expandMultis(this.lowerCase());

            // if a part is found in mName, return the corresponding full multi name
            for (let i=0; i < multiParts.length; i++) {

                if (mName.includes(multiParts[i])) return (multis[i])
            }
        }
        return null
    }
};

function Pin(rect,node,name,is){
    
    // copy the rectangle
    this.rect = {...rect}; 

    // the node for which this is a pin
    this.node = node;

    // the name
    this.name = name;

    // pxlen = postfix or prefix length - a negative pxlen is a postfix
    this.pxlen = 0;

    // the widget identifier
    this.wid = 0;

    // state
    this.is = {
        pin: true,
        proxy: false,
        channel: is.channel ?? false,               
        input: is.input ?? false,
        left: is.left ?? false,      // default set inputs right
        multi: is.multi ?? false,    // the pin can send / receive several messages
        selected: false,             // when the pin is selected
        highLighted: false,
        hoverOk:false,               // to give feedback when hovering over the pin
        hoverNok: false,
        zombie: is.zombie ?? false,  // for pins that are invalid
        added: false,                // for pins that have been added (or name change)
        duplicate: false
    };

    // the parameter profile 
    this.profile = '';

    // The prompt for the input handler or a description of when the output is sent
    this.prompt = '';

    // the routes for this pin
    this.routes = [];
}

// The pin prototype
Pin.prototype = {


    // pChar is where the cursor has to come
    drawCursor(ctx, pChar,on) {

        // notation
        const rc = this.rect;
        const m = style$1.pin.wMargin;

        // relative x position of the cursor
        const cx = ctx.measureText(this.name.slice(0,pChar)).width;

        // absolute position of the cursor...
        const xCursor = this.is.left ? rc.x + m + cx : rc.x + rc.w - m - ctx.measureText(this.name).width + cx;

        // the color for the blink effect
        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;
        //const color = on ? style.pin.cConnected : style.box.cBackground

        // and draw the cursor
        shape.cursor(ctx, xCursor, rc.y, style$1.std.wCursor, rc.h, color); 
    },

    // arrows in and out
    render(ctx) {

        // notation
        const st = style$1.pin;
        const rc = this.rect;

        // the name to display
        const displayName = this.pxlen == 0 ?  this.name : this.withoutPrefix();

        // select the color for the widget
        const {cArrow, cText} = this.setColor();

        // the y position of the arrow
        const yArrow = rc.y+(st.hPin-st.wArrow)/2;

        // we shift the arrow a little bit...
        const dx = style$1.box.wLine/2;

        // The shape for a channel is different
        const pointLeft = this.is.channel ? shape.triangleBall : shape.leftTriangle;
        const pointRight = this.is.channel ? shape.ballTriangle : shape.rightTriangle;

// debug : draws a green rectangle around the pin
// shape.rectRect(ctx,rc.x, rc.y, rc.w, rc.h,"#00FF00", null)

        // render the text and arrow : 4 cases : left in >-- out <-- right in --< out -->
        if (this.is.left) {
            const xArrow = rc.x + st.wOutside;
            this.is.multi   ? shape.leftTextMulti(ctx,displayName,st.fMulti,cText, rc.x + style$1.pin.wMargin,rc.y, rc.w, rc.h)
                            : shape.leftText(ctx,displayName,cText, rc.x + style$1.pin.wMargin,rc.y, rc.w, rc.h);
            this.is.input   ? pointRight(ctx,xArrow-dx, yArrow,st.hArrow, st.wArrow,cArrow)
                            : pointLeft(ctx,xArrow - st.hArrow + dx,yArrow,st.hArrow, st.wArrow,cArrow);
        }
        else {
            const xArrow = rc.x + rc.w - st.wOutside;
            this.is.multi   ? shape.rightTextMulti(ctx, displayName, st.fMulti, cText,rc.x, rc.y,rc.w - style$1.pin.wMargin, rc.h)
                            : shape.rightText(ctx, displayName, cText,rc.x, rc.y,rc.w - style$1.pin.wMargin, rc.h);
            this.is.input   ? pointLeft(ctx,xArrow - st.hArrow + dx,yArrow,st.hArrow, st.wArrow,cArrow)
                            : pointRight(ctx,xArrow -dx ,yArrow,st.hArrow, st.wArrow,cArrow);        
        }

        // show name clashes
        if (this.is.duplicate) {
            shape.rectRect(ctx,rc.x, rc.y, rc.w, rc.h,st.cBad, null);
        }
    },

    setColor() {

        // color of the arrow ( unconnected connected selected)
        const cArrow =    this.is.hoverNok          ? style$1.pin.cBad
                        : this.is.hoverOk           ? style$1.pin.cSelected
                        : this.is.highLighted       ? style$1.pin.cHighLighted
                        : this.is.selected          ? style$1.pin.cSelected 
                        : this.routes.length > 0    ? style$1.pin.cConnected 
                        : style$1.pin.cNormal;

        // color of the text
        const cText =     this.is.hoverNok          ? style$1.pin.cBad
                        : this.is.hoverOk           ? style$1.pin.cSelected
                        : this.is.added             ? style$1.pin.cAdded 
                        : this.is.zombie            ? style$1.pin.cBad 
                        : this.is.highLighted       ? style$1.pin.cHighLighted
                        : this.is.selected          ? style$1.pin.cSelected 
                        : this.routes.length > 0    ? style$1.pin.cConnected
                        : style$1.pin.cText;
                
        return {cArrow, cText}
    },

    // returns the center of the pin (h of the arrow is along x-axis here !)
    center() {

        const wOut = style$1.pin.wOutside;
        const rc = this.rect;
        return this.is.left ? {x: rc.x + wOut, y: rc.y + rc.h/2} : {x: rc.x + rc.w - wOut, y: rc.y + rc.h/2}
    },

    // checks if a pin can connect to another pin
    canConnect(pin) {

        // from and to are the same 
        if (this == pin) return false

        // both cannot be outputs or inputs
        if (this.is.input === pin.is.input) return false

        // multi messages can only be connected if there is a (partial) overlap
        if ((this.is.multi || pin.is.multi) && !this.hasMultiOverlap(pin)) return false

        // check if we have already a connection between the pins
        if (this.haveRoute(pin)) return false

        // its ok
        return true
    },

    // There is a route to the widget, but check if messages can flow 
    areConnected(widget) {

        if (widget.is.pin) {

            // should not happen
            if (widget.is.input == this.is.input) return false

            // multis
            if ((widget.is.multi || this.is.multi ) && !this.hasMultiOverlap(widget)) return false
        }
        else if (widget.is.pad) {

            // should not happen
            if (widget.proxy.is.input != this.is.input) return false

            // multis
            if (widget.proxy.is.multi && !this.hasMultiOverlap(widget.proxy)) return false
        }
        return true
    },  

    toJSON() {

        this.is.input ? (this.is.channel ? 'reply' : 'input') : (this.is.channel ? 'request' : 'output');

        // seperate data into editor and 
        const json = {
            name: this.name,
            kind: this.is.input ? (this.is.channel ? 'reply' : 'input') : (this.is.channel ? 'request' : 'output'),
            editor: {
                id: this.wid,
                align: (this.is.left ? 'left' : 'right')
            }
        };

        // if the pin is a proxy, we add the pad-related stuff
        if (this.is.proxy) {

            json.editor.pad = {
                rect: convert.rectToString(this.pad.rect),
                align: this.pad.is.leftText ? 'left' : 'right'
            };
        }

        return json
    },   

    // remove a route from the routes array
    removeRoute(route) {

        eject(this.routes, route);
    },


    adjustRoutes() {
        for(const route of this.routes) route.adjust();
    },

    // changes the position from left to right
    leftRightSwap() {

        // notation
        const rc = this.node.look.rect;

        // change the x coordinate
        this.rect.x = this.is.left  ? rc.x + rc.w - this.rect.w + style$1.pin.wOutside 
                                    : rc.x - style$1.pin.wOutside;
        // change
        this.is.left = !this.is.left;

        // reconnect the routes
        this.adjustRoutes();
    },

    drag(pos) {

        // notation
        const rc = this.node.look.rect;

        // notation
        const center = rc.x + rc.w/2;

        // switch left right ?
        if ((this.is.left && (pos.x > center)) || ( !this.is.left && (pos.x < center))) this.leftRightSwap();

        // find pin or ifName to swap with
        const next = this.node.look.findNextWidget(this, pos, next => next.is.pin || next.is.ifName);

        // if no next - done
        if (!next) return;

        // swap the y-positions
        [this.rect.y, next.rect.y] = [next.rect.y, this.rect.y];

        // if we move in or out a prefix, check if we can reset the pxlen
        if (next.is.ifName) this.ifNamePrefixCheck();

        // reconnect the routes to the widgets that changed place
        this.adjustRoutes();
        if (next.is.pin) next.adjustRoutes();
    },

    moveTo(left, y) {

        // check if the pin needs to swap from left to right
        if (left != this.is.left) this.leftRightSwap();

        // notation
        const prc = this.rect;

        // a widget between the new and the old place has to be moved up or down
        for (const widget of this.node.look.widgets) {

            // notation
            const wrc = widget.rect;

            // up or down
            if ((prc.y > y) && (wrc.y >= y) && (wrc.y < prc.y)) {
                wrc.y += prc.h;
                if (widget.is.pin) widget.adjustRoutes();
            }
            if ((prc.y < y) && (wrc.y <= y) && (wrc.y > prc.y)) {
                wrc.y -= prc.h;
                if (widget.is.pin) widget.adjustRoutes();
            }
        }
        // place the pin at y
        prc.y = y;

        // and adjust the route endpoints
        this.adjustRoutes();
    },

    disconnect() {

        // make a copy of the routes - the pin.routes array will be modified during this proc
        const routes = this.routes.slice();
    
        // for all widgets that have routes..
        for (const route of routes) {
    
            // get the other widget
            const other = route.from == this ? route.to : route.from;
    
            // disconnect
              other.is.pin ? route.rxtxPinPinDisconnect()
            : other.is.pad ? route.rxtxPinPadDisconnect()
            : other.is.tack ? route.rxtxPinBusDisconnect()
            : null;
    
            // remove the route at both ends
            route.remove();
        }
    },
    
    // this function is used in the undo action (see redox)
    reconnect(routes) {
    
        // just restore the routes of the pin
        this.routes = routes;
    
        // and also put the routes back in all destinations
        for (const route of routes) {
    
            // get the other widget
            const other = route.from == this ? route.to : route.from;
    
            if (other.is.pin) {
                other.routes.push(route);
                route.rxtxPinPin();
            }
            else if (other.is.pad) {
                other.routes.push(route);
                route.rxtxPinPad();
            }
            else if (other.is.tack) {
                other.bus.tacks.push(other);
                route.rxtxPinBus();
            }
        }
    },

    // checks if there is already a route
    haveRoute(other) {

        for(const route of this.routes)  if (route.from == other || route.to == other) return true
        return false
    },

    ioSwap() {

        // check
        if (this.routes.length > 0) return false
        if (this.is.proxy && (this.pad.routes.length > 0)) return false
        
        // change the type of pin
        this.is.input = !this.is.input;

        // succesful
        return true
    },

    channelOnOff() {

        // toggle the channel bit
        this.is.channel = !this.is.channel;

        // If  the pin is connected to a bus, the bus tack has to be updated
        for(const route of this.routes) {
            const other = route.from == this ? route.to : route.from;
            if (other.is.tack) other.is.channel = this.is.channel;
        }
        return true
    },

    doSelect() {
        this.is.selected = true;
    },

    unSelect() {
        this.is.selected = false;
    },

    highLight() {
        this.is.highLighted = true;
    },

    unHighLight() {
        this.is.highLighted = false;
    },

    /** TO CHANGE : 
        A proxy works as a filter:
        [a,b,c,d] -> pad - proxy [a,b,c] -> pin [b,c,d]  only messages b,c get through.
    */
    highLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from;

            // check
            if (!other) continue

            // pin
            if (other.is.pin) {
                if (!this.areConnected(other)) continue
                route.highLight();
                continue
            }

            // pad
            if (other.is.pad) {
                if (!this.areConnected(other)) continue
                route.highLight();
                continue
            }

            // bus
            if (other.is.tack) {
                route.highLight();
                other.bus.highLightRoutes(this);
            }
        }
    },

    unHighLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            // unhighlight
            route.unHighLight();

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from;

            // check
            if (!other) continue

            // pin
            if (other.is.pin) {
                if (!this.areConnected(other)) continue
                if (other.is.proxy) other.pad.unHighLightRoutes();
                continue
            }

            // pad
            if (other.is.pad) {
                if (!this.areConnected(other)) continue
                other.proxy.unHighLightRoutes();
                continue
            }

            // bus
            if (other.is.tack) {
                other.bus.unHighLightRoutes(this);
            }
        }
    },

    makePadRect(pos) {

        // The width of the pad
        const width = style$1.pad.wExtra + this.node.look.getTextWidth(this.name, this.is.multi);

        // determine the rectangle for the pad widget
        return this.is.left ? {x: pos.x, y: pos.y-style$1.pad.hPad/2, w: width, h:style$1.pad.hPad} 
                            : {x: pos.x, y: pos.y-style$1.pad.hPad/2, w: width, h:style$1.pad.hPad}
    },


};
Object.assign(Pin.prototype, pinNameHandling);

// a proxy is like a pin but is actually a stand-in for one or more pins of objects that are part of the group
function Proxy(rect,node,name,is) {

    // constructor chaining
    Pin.call(this,rect,node,name,is);

    // change the proxy setting
    this.is.proxy = true;

    // every proxy can have a corresponding pad
    this.pad = null;
}

// specific functions for a proxy
const ProxyFunctions = {

    // find all source node pins that can bring their input to this pin
    makeConxList(list) {
        
        for(const route of this.routes) {

            // the destination, i.e. the other widget
            const other = route.from == this ? route.to : route.from;

            // check
            if (! this.areConnected(other)) continue

            // pin a proxy, take it to the next level, else save in list
            if (other.is.pin) {
                other.is.proxy ? other.pad?.makeConxList(list) : list.push(other);
            }
            // the destination is a pad
            else if (other.is.pad) {

                // just continue to build the list
                other.proxy.makeConxList(list);
            }
            // bus link
            else if (other.is.tack) {

                // check if the bus is actually a router
                other.bus.hasFilter() ?  list.push(other) : other.bus.makeConxList(this, list);
            }
        }
    },

    // when after editing the proxy name has changed, we might have to change the look 
    nameChanged(savedName) {

        // each proxy has a pad ...
        const pad = this.node.pads.find( pad => pad.proxy == this);

        // if the pin has no pad, this is pathological
        if (!pad) {
            // log it
            console.log(`** No pad was found for this pin "${this.name}" - pin was removed`);

            // remove the proxy
            this.node.look.removePin(this);
            return
        }

        // if the name has not zero length...
        if (this.name.length > 0) {

            // ...also change the name of the pad
            pad.nameChange(this.name);

            // done
            return
        }

        // The pin and the pad can only be removed if there are no routes
        if (pad.routes?.length > 0) {

            // restore the old name
            this.restoreSavedName(savedName);
        }
        else {
            // remove the proxy
            this.node.look.removePin(this);

            // and remove the pad
            this.node.removePad(pad);
        }
    },
};
// overwrite some specific pin functions
Object.assign(Proxy.prototype, Pin.prototype, ProxyFunctions);

// an in out symbol is a triangle 
function BusTack(bus, wid = null) {

    // the rectangle will be filled in by orient
    this.rect = {x:0, y:0, w: 0, h: 0};

    // set the type
    this.is = {
        tack: true,
        selected: false,
        highLighted: false,
        channel: false,
        top: false                  // ball on top for tacks going to inputs / at the bottom for tacks coming from outputs
    };

    // save the bus this tack is connected to
    this.bus = bus;

    // the wid of this tack - currently not used !
    this.wid = wid ?? bus.generateWid();

    // the segment of the bus on which the tack sits 
    this.segment = 0;

    // direction of the tack 'up 'down' 'right' 'left'
    this.dir = '';

    // the route
    this.route = null;
}

BusTack.prototype = {

    render(ctx) {
        // the color
        const color =  this.is.selected ? style$1.bus.cSelected 
                     : this.is.highLighted ? style$1.bus.cHighLighted
                     : style$1.bus.cNormal;

        // put a small rectangle for a tack for router
        if (this.bus.is.filter) shape.filterSign(ctx, this.getContactPoint(),style$1.bus.wCable, color);

        // draw the tack
        shape.tack(ctx, this.dir, this.is.channel, this.is.top, this.rect, style$1.route.wNormal, color);
    },

    // sets the route for a tack and places the tack on that route
    setRoute(route) {

        // the route to this tack
        this.route = route;

        // if one of the end points is still null, set the tack
        if (!route.to) route.to = this; 
        else if (!route.from) route.from = this;

        // get the other endpoint of the route 
        const other = route.from == this ? route.to : route.from;

        // check if the tack is channel
        this.is.channel  = other.is.pad ? other.proxy.is.channel  : other.is.channel;
        this.is.top = other.is.pad ? !other.proxy.is.input : other.is.input;

        // and place the tack
        this.orient();
    },

    // sets the arrow in the correct position (up down left right) - does not change the route
    orient() {

        // helper function - the tack direction to a pad is the opposite of the tack direction to a pin
        // inflow - flow to the bus - is true in thes cases:  output pin >---->||  input pad >----->||  
        const inflow = (widget) => widget.is.pin ? widget.is.input : !widget.proxy.is.input;

        // notation
        const rWire = this.route.wire;
        const bWire = this.bus.wire;
        const other = this.route.to == this ? this.route.from : this.route.to;

        // the points of the route on the bus (crossing segment) - a is the point on the bus
        const a = this.route.to == this ? rWire.at(-1) : rWire[0];
        const b = this.route.to == this ? rWire.at(-2) : rWire[1];

        // determine the segment of the bus
        this.segment = this.bus.hitSegment(a); 

        // SHOULD NOT HAPPEN
        if (this.segment == 0) {
            console.error('*** SEGMENT ON BUS NOT FOUND ***', other, this.bus);
            this.segment = 1;
        }

        // the bus segment can be horizontal or vertical
        const horizontal = Math.floor(bWire[this.segment-1].y) === Math.floor(bWire[this.segment].y);

        //notation
        const rc = this.rect;
        const sp = bWire[this.segment];

        // to place the arrow we take the width of the bus into account - the -1 is to avoid a very small gap
        const shift = style$1.bus.wNormal/2 - 1;

        // set the rectangle values
        if (horizontal) {
            rc.w = style$1.bus.wArrow;
            rc.h = style$1.bus.hArrow;
            rc.x = a.x - rc.w/2;
            if (b.y > a.y) {
                rc.y = sp.y + shift;
                this.dir = inflow(other) ? 'down' : 'up';
            }
            else {
                rc.y = sp.y - rc.h - shift;
                this.dir = inflow(other) ? 'up' : 'down';
            }
            // allign the route endpoint perfectly with the bus (could stick out a little bit)
            a.y = sp.y;
        }
        else {
            rc.w = style$1.bus.hArrow;
            rc.h = style$1.bus.wArrow;
            rc.y = a.y - rc.h/2;
            if (b.x > a.x) {
                rc.x = sp.x + shift;
                this.dir = inflow(other) ? 'right' : 'left';
            }
            else {
                rc.x = sp.x - rc.w - shift;
                this.dir = inflow(other) ?  'left' : 'right';
            }
            // allign the route endpoint perfectly with the bus (could stick out a little bit)
            a.x = sp.x;
        }
    },

    // point p is guaranteed to be on the bus - the arrow will be oriented correctly later...
    placeOnSegment(point, segment) {

        // save the segment
        this.segment = segment;

        // check the segment
        const a = this.bus.wire[segment-1];
        const b = this.bus.wire[segment];

        // vertical
        if (a.x == b.x) {
            this.dir = 'left';
            this.rect.x = a.x;
            this.rect.y = point.y; 
        } else {
            this.dir = 'up';
            this.rect.x = point.x; 
            this.rect.y = a.y;
        }

    },

    // returns true if the tack is horizontal (the segment is vertical in that case !)
    horizontal() {
        return ((this.dir == 'left') || (this.dir == 'right'))
    },

    // center is where a route connects !
    center() {

        const rc = this.rect;

        // check the segment
        if (this.segment == 0) return null

        const p = this.bus.wire[this.segment];
        return (this.dir == 'left' || this.dir == 'right') ? {x:p.x, y:rc.y + rc.h/2} : {x: rc.x + rc.w/2, y: p.y}
    },


    toJSON() {
        return convert.routeToString(this.route)
    },

    overlap(rect) {
        const rc = this.rect;

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    remove() {
        // remove the route at both ends - this will also call removeRoute below !
        this.route.remove();
    },

    removeRoute(route) {
        // and remove the tack - the route is also gone then...
        this.bus.removeTack(this);
    },


    moveX(dx) {

        // move the rect
        this.rect.x += dx;

        // move the endpoint of the route as well..
        const p = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1);

        p.x += dx;

        // place the link..
        this.orient();
    },

    moveY(dy) {

        // move the rect
        this.rect.y += dy;

        // move the endpoint of the route as well..
        const p = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1);

        p.y += dy;

        // place the link..
        this.orient();
    },

    // just move the link and adjust the route
    moveXY(dx,dy) {

        // move the rect
        this.rect.x += dx;
        this.rect.y += dy;

        // check that we have enough segments
        if (this.route.wire.length == 2) this.route.addTwoSegments(this.route.wire[0], this.route.wire[1]);

        // move the endpoint of the route as well..
        const a = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1);
        const b = this.route.from == this ? this.route.wire[1] : this.route.wire.at(-2);

        // check
        const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);

        // vertical
        if (vertical) {
            a.x += dx;
            b.x += dx;
            a.y += dy;
        }
        // horizontal
        else {
            a.y += dy;
            b.y += dy;
            a.x += dx;
        }

        // place the link..
        this.orient();
    },

    // check that the link stays on the segment
    slide(delta) {

        // notation
        let pa = this.bus.wire[this.segment -1];
        let pb = this.bus.wire[this.segment];
        const rc = this.rect;
        const wBus = style$1.bus.wNormal;

        // horizontal segment
        if (pa.y == pb.y) {
            // the max and min position on the segment
            let xMax = Math.max(pa.x, pb.x) - rc.w - wBus/2;
            let xMin = Math.min(pa.x, pb.x) + wBus/2;

            // increment 
            rc.x += delta.x;

            // clamp to max or min
            rc.x = rc.x > xMax ? xMax : rc.x < xMin ? xMin : rc.x;
        }
        else {
            // the max and min position on the segment
            let yMax = Math.max(pa.y, pb.y) - rc.h - wBus/2;
            let yMin = Math.min(pa.y, pb.y) + wBus/2;

            // increment check and adjust
            rc.y += delta.y;

            // clamp to min / max
            rc.y = rc.y > yMax ? yMax : rc.y < yMin ? yMin : rc.y;
        }
        // re-establish the connection with the end points
        this.route.adjust();
    },

    // sliding endpoints on a bus can cause segments to combine
    // s is 1 or the last segment
    fuseEndSegment() {

        // at least three segments 
        if (this.route.wire.length < 4) return 

        // notation - a is where the link is connected
        const route = this.route;
        const p = route.wire;
        const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false]; 

        // horizontal segment
        if ((a.y == b.y) && (Math.abs(c.y - b.y) < style$1.route.tooClose)) {

            // move the endpoint
            a.y = c.y;

            // remove the segment from the route
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p);

            // and place the link again
            this.orient();
        }
        // vertical segment
        else if ((a.x == b.x)&&(Math.abs(b.x - c.x) < style$1.route.tooClose)) {

            // move the endpoint
            a.x = c.x;

            // remove the segment
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p);

            // and place the link again
            this.orient();
        }
        return
    },

    restore(route) {
    
        // set the route
        this.route = route;

        // add to the bus widgets
        this.bus.tacks.push(this);

        // place the arrow 
        this.orient();
    },

    // return the widget at the other end
    getOther() {
        return this.route.from == this ? this.route.to : this.route.from
    },

    // return the pin or the proxy if the other is a pad
    getOtherPin() {
        const other = this.route.from == this ? this.route.to : this.route.from;
        return other.is.pin ? other : (other.is.pad ? other.proxy : null)
    },

    getContactPoint() {
        return this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
    },

    // getOtherName() {
    //     const other = this.route.from == this ? this.route.to : this.route.from

    //     if (other.is.pin) return other.name
    //     if (other.is.pad) return other.proxy.name
    //     return null
    // },

    incoming() {
        const other = this.route.from == this ? this.route.to : this.route.from;

        if (other.is.pin) return !other.is.input
        if (other.is.pad) return other.proxy.is.input
        return false
    },

    // does nothing but makes the widget ifPins more uniform
    highLightRoutes() {},
    unHighLightRoutes() {}
};

// an in out symbol is a triangle 
function BusLabel(rect, bus) {

    this.rect = {...rect};
    this.is = {
        busLabel: true,
        beingEdited: false,
        highLighted: false,   
        horizontal: true
    };

    // the label text
    this.text = bus.name;

    // save the bus
    this.bus = bus;
}

// specific bullet functions
const BusLabelFunctions = {

    makeRect(a, b, w, h) {

        const rc = this.rect;

        // horizontal or vertical label
        this.is.horizontal = Math.abs(a.x - b.x) > 0;

        // horizontal
        if (this.is.horizontal) {
            rc.x = (a.x < b.x) ? a.x - w : a.x;
            rc.y = a.y - h/2;
            rc.h = h;
            rc.w = w;
        }
        // vertical
        else {
            rc.x = a.x - h/2;
            rc.y = (a.y < b.y) ? a.y - w : a.y;
            rc.h = w;
            rc.w = h;

            // exception
            if ((a.y == b.y) && (this == this.bus.startLabel)) rc.y = a.y - w;  
        }
    },

    place() {
        //notation
        const st = style$1.bus;
        const wire = this.bus.wire;

        // set the size of the label
        const sText = this.text.length * st.sChar + 2*st.hLabel;

        // vertical or horizontal
        (this == this.bus.startLabel) ? this.makeRect(wire[0], wire[1], sText, st.hLabel) : this.makeRect(wire.at(-1), wire.at(-2), sText, st.hLabel); 
    },

    // called when the editing starts
    startEdit() {

        // set the flag
        this.is.beingEdited = true;

        // return the field
        return 'text'
    },

    endEdit(saved) {

        // set the name and the text of the second label
        this.setText(this.text);
        
        // editing is done
        this.is.beingEdited = false;
    },

    setText(newText) {
        // set the name and the text of the second label
        const other = (this == this.bus.startLabel) ? this.bus.endLabel : this.bus.startLabel;

        // change the text/name
        this.bus.name = newText;
        this.text = newText;
        other.text = newText;

        // place the labels
        this.place();
        other.place();
    },

    drawCursor(ctx, pChar, on) {
        const pCursor = shape.centerTextCursor(ctx, this.rect,this.text,pChar);

        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;

        this.is.horizontal ?
              shape.cursor(ctx, pCursor.x, pCursor.y, style$1.std.wCursor, this.rect.h,  color)
            : shape.cursor(ctx, this.rect.x, pCursor.y + 0.75 * this.rect.w, this.rect.w, style$1.std.wCursor, color);
    },

    render(ctx, look) {

        // if being edited render differently
        if (this.is.beingEdited)  {

            // copy the text to the other label
            const other = this == this.bus.startLabel ? this.bus.endLabel : this.bus.startLabel;
            other.text = this.text;

            // the width and thus the position of the label have changed
            this.place();
            other.place();
        }
        // notation
        const st = style$1.bus;
        const rc = this.rect;
        const state = this.bus.is;

        // use a different color when selected
        const cLabel =    state.hoverNok ? st.cBad 
                        : state.selected || state.hoverOk ? st.cSelected 
                        : state.highLighted ? st.cHighLighted
                        : st.cNormal;

        // draw a filter symbol next to the label if required
        if (this.bus.is.filter) shape.filterSymbol(ctx, rc.x - st.wFilter, rc.y - st.wFilter, st.wFilter, cLabel);

        // draw the label
        if (this.bus.is.cable) {
            this.is.horizontal  ? shape.hCableLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
                                : shape.vCableLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText);
        }
        else {
            this.is.horizontal  ? shape.hBusbarLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
                                : shape.vBusbarLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText);
        }
    },

    setSize(ctx) {
        this.rect.w = ctx.measureText(this.text).width + 2*style$1.bus.hLabel;
        this.rect.h = style$1.bus.hLabel;
        return this
    },

    move(dx, dy) {
        this.rect.x += dx;
        this.rect.y += dy;
    },

    highLight() {
        this.is.highLighted = true;
    },

    unHighLight() {
        this.is.highLighted = false;
    },

    // checks if a label is inside a rectangle
    inside(rect) {
        return inside({x:this.rect.x, y:this.rect.y}, rect)
    }
};
Object.assign(BusLabel.prototype, BusLabelFunctions);

function InterfaceName(rect, text, node) {

    // mixin the widget
    this.rect = {...rect};

    // the node
    this.node = node;

    // binary state 
    this.is = {
        ifName: true,
        added: false ,              // has been added 
        zombie: false,              // ifName has been deleted (not used -> interfaceNames are free form ...)
        selected: false,
        highLighted: false
    };
    // the text in the ifName
    this.text = text ?? '';

    // the widget id
    this.wid = 0;
}
// the specific title functions
InterfaceName.prototype = {

    // called when editing starts
    startEdit() {
        return 'text'
    },

    endEdit(saved) {

        // clean the user input
        this.text = convert.cleanInput(this.text);

        // make modifications as required (pins that use the ifName name)
        this.node.look.ifNameChanged(this, saved);
    },

    drawCursor(ctx, pChar, on) {

        // where to put the cursor
        const pos = shape.centerTextCursor(ctx,this.rect,this.text, pChar);

        // select color - on or off
        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;
        //const color = on ? style.header.cTitle : style.header.cBackground 

        // draw it
        shape.cursor(ctx, pos.x , pos.y, style$1.std.wCursor, this.rect.h, color );
    },

    render(ctx, look) {
        // notation
        const {x,y,w,h} = this.rect;
        const st = style$1.ifName;

        const color =   this.is.added ? st.cAdded : 
                        this.is.zombie ? st.cBad : 
                        this.is.highLighted ? st.cHighLighted :
                        this.is.selected ? st.cSelected : 
                        st.cNormal;

        shape.interfaceText(ctx, this.text, st.font, color, st.cBackground, x,y,w,h);
    },

    toJSON() {
        return {
            ifPins: this.text,
            id: this.wid
        }
    },

    drag(pos) {

        // notation
        this.node.look.rect;

        // find pin or ifName to swap with
        const next = this.node.look.findNextWidget(this, pos, next => next.is.pin || next.is.ifName);

        // if no next - done
        if (!next) return;

        // swap
        [this.rect.y, next.rect.y] =[next.rect.y, this.rect.y];

        // if the next is a pin check what to do with the prefix (add it or remove it)
        if (next.is.pin) next.ifNamePrefixCheck(); 

        // reconnect the routes to the widgets that changed place
        if (next.is.pin) next.adjustRoutes();
    },

    moveTo(y) {

        // notation - ifName rectangle
        const src = this.rect;

        // a widget between the new and the old place has to be moved up or down
        for (const widget of this.node.look.widgets) {

            // notation
            const wrc = widget.rect;

            // up or down
            if ((src.y > y) && (wrc.y >= y) && (wrc.y < src.y)) {
                wrc.y += src.h;
                if (widget.is.pin) widget.adjustRoutes();
            }
            if ((src.y < y) && (wrc.y <= y) && (wrc.y > src.y)) {
                wrc.y -= src.h;
                if (widget.is.pin) widget.adjustRoutes();
            }
        }
        // place the pin at y
        src.y = y;
    },

    highLight() {
        this.is.highLighted = true;
    },

    unHighLight() {
        this.is.highLighted = false;
    },

    doSelect() {
        this.is.selected = true;
    },

    unSelect() {
        this.is.selected = false;
    },
};

function Label$1(rect, text, node) {

    // mixin the widget
    this.rect = {...rect};

    // the node
    this.node = node;

    // binary state 
    this.is = {
        label: true
    };

    // copy the text
    this.text = text;
}
// the specific title functions
Label$1.prototype = {

    // called when editing starts
    startEdit() {
        return 'text'
    },

    endEdit(saved) {
        //this.node.look.labelChanged(this, saved)
    },

    drawCursor(ctx, pChar, on) {
        const rc = this.rect;
        const pCursor = shape.labelCursor(ctx, this.text, rc.x,rc.y,rc.w,rc.h,pChar);
        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;
        //const color = on ? style.label.cNormal : style.std.cBackground
        shape.cursor(ctx, pCursor.x, pCursor.y, style$1.std.wCursor, rc.h, color);
    },

    render(ctx, look) {

        // notation
        const {x,y,w,h} = this.rect;

        // change the font
        //ctx.font = style.label.font

        // draw the text
        shape.labelText(ctx, this.text, style$1.label.font, style$1.label.cNormal, x, y, w, h);

        // set the font back
        //ctx.font = style.std.font
    },

    toJSON() {
        return this.text

        // return {
        //     label: this.text,
        //     //rect: convert.relativeRect(this.rect, this.node.look.rect)
        // }
    },
};

// Icons are used on views and nodes
function Icon(rect, iconType) {

    this.rect = {...rect};
    this.is = {
        icon: true,
        bad: false,
        highLighted: false
    };
    this.type = iconType;

    // to be initialised with a render function
    this.render = ()=>{console.warn("Missing render function for icon ",this.type);};
}
Icon.prototype = {

    setRender() {

        this.render = this.renderFunctions[this.type] || this.renderFunctions["dummy"];
    },

    switchType(newType) {

        this.type = newType;
        this.setRender();
    },

    renderFunctions: {

        // the node icons
        "link"(ctx) {
            const {x,y,w,h} = {...this.rect};

            const color =     this.is.highLighted ? style$1.icon.cHighLighted
                            : this.is.bad ? style$1.icon.cBadLink 
                            : style$1.icon.cLink;

            shapeIcon.link(ctx, x,y,w,h, color); 
        },

        "lock"(ctx) {
            const {x,y,w,h} = {...this.rect};

            const color =     this.is.highLighted ? style$1.icon.cHighLighted
                            : this.is.bad ? style$1.icon.cBadLink 
                            : style$1.icon.cLink;

            shapeIcon.lock(ctx, x,y,w,h, color);
        },

        "factory"(ctx) {
            const {x,y,w,h} = {...this.rect};
            shapeIcon.factory(ctx, x,y,w,h,  style$1.icon.cSrc);
        },

        "group"(ctx) {
            const {x,y,w,h} = {...this.rect};
            shapeIcon.group(ctx, x,y,w,h,  style$1.icon.cGroup);
        },

        "cog"(ctx) {
            const {x,y,w,h} = {...this.rect};
            shapeIcon.cog(ctx, x,y,w,h,  style$1.icon.cCog, style$1.header.cBackground);
        },

        "pulse"(ctx) {
            const {x,y,w,h} = {...this.rect};
            shapeIcon.pulse(ctx, x,y,w,h,  style$1.icon.cPulse, style$1.header.cBackground);
        },

        "comment"(ctx) {
            const {x,y,w,h} = {...this.rect};
            shapeIcon.comment(ctx, x,y,w,h,  style$1.icon.cComment);
        },

        // The view icons
        "close"(ctx) {
            const {x,y,w,h} = {...this.rect};
            const cIcon = this.is.highLighted ? style$1.view.cClose : style$1.view.cDim;
            shapeIcon.close(ctx, x,y,w,h, cIcon);
        },

        "big"(ctx) {
            const {x,y,w,h} = {...this.rect};
            const cIcon = this.is.highLighted ? style$1.view.cFullscreen : style$1.view.cDim;
            shapeIcon.bigView(ctx, x,y,w,h, cIcon);
        },

        "small"(ctx) {
            const {x,y,w,h} = {...this.rect};
            const cIcon = this.is.highLighted ? style$1.view.cFullscreen : style$1.view.cDim;
            shapeIcon.smallView(ctx, x,y,w,h, cIcon);
        },

        "calibrate"(ctx) {
            const {x,y,w,h} = {...this.rect};
            const cIcon = this.is.highLighted ? style$1.view.cCalibrate : style$1.view.cDim;
            shapeIcon.calibrate(ctx, x,y,w,h, cIcon);
        },

        "grid"(ctx) {
            const {x,y,w,h} = {...this.rect};
            const cIcon = this.is.highLighted ? style$1.view.cGrid : style$1.view.cDim;
            shapeIcon.grid(ctx, x,y,w,h, cIcon);
        },

        "dummy"(ctx) {
            console.warn('Cannot render unknown icon type:', this);
        }

    },

    toJSON() {
        //return undefined
        //return {icon: convert.iconToString(this.rect, this.type)}
    }
};

function ViewTitle(rect, node) {

    this.rect = {...rect}; 
    this.is={
        viewTitle: true,
        highLighted: false
    };
    this.node = node;
    this.text = node.name;
}
// the specific title functions
ViewTitle.prototype = {

    startEdit() {
        return 'text'
    },

    endEdit(saved) {
        node.name = this.text;
    },

    render(ctx) {

        // notation
        const rc = this.rect;
        const st = style$1.view;

        // background color (uses the box color !)
        const background = this.is.highLighted ? st.cHighLight : st.cLine;

        // text color
        const cTitle = this.is.highLighted ? st.cTitleHighLight : st.cTitle;

        // the header rectangle
        shape.roundedHeader(ctx, rc.x,rc.y,rc.w, st.hHeader,st.rCorner, st.wLine, null, background);
        //shape.roundedHeader(ctx, rc.x,rc.y,rc.w, st.hHeader,st.rCorner, style.header.wLine, null, background)

        // draw the text
        shape.centerText(ctx, this.node.name,style$1.view.fHeader, cTitle, rc.x, rc.y, rc.w, rc.h);

        // if edited, we have to add a cursor
        if (this.textEdit) {

            let pCursor = shape.centerTextCursor(ctx, rc,this.node.name,this.textEdit.cursor);
            shape.cursor(ctx, pCursor.x, pCursor.y, 2, rc.h, cTitle );
        }
    }
};

function ViewBox(rect) {

    this.rect = {...rect};

    // binary state 
    this.is = {
        viewBox: true,
        highLighted: false,
    };

}
// the specific box functions
ViewBox.prototype = {

    render(ctx) {

        // notation
        const rc = this.rect;
        const st = style$1.view;

        // select the color
        const color = this.is.highLighted ? st.cHighLight : st.cLine;

        // draw the rectangle 
        shape.viewRect(ctx, rc.x,rc.y,rc.w, rc.h, st.rCorner, st.wLine, color, st.cBackground);
    },
};

const widgetHandling = {

    addWidget( widget ) {

        // push the widget on the list
        this.widgets.push(widget);

        // set the new height for the look
        this.rect.h += widget.rect.h;

        // if there is a box widget
        const box = this.widgets.find( w => w.is.box);

        // .. also adjust the height of the box
        if (box) box.increaseHeight(widget.rect.h);

        // if the widget has a wid, add the wid
        if (widget.wid != undefined) widget.wid = this.generateWid();
    },

    generateWid() {
        return ++this.widGenerator
    },

    addBox() {
        const box = new Box(this.rect, this.node);
        this.widgets.push(box);
    },

    findLabel() {
        for(const widget of this.widgets) {
            if (widget.is.label) return widget
        }
        return null
    },

    // names for input output pins/proxies cannot be duplicates
    setDuplicatePin(pin) {

        // reset
        pin.is.duplicate = false;

        const wasDuplicate = [];

        // check all widgets
        for(const widget of this.widgets) {

            // only pins and exclude the one we are testing
            if (!widget.is.pin || widget == pin) continue

            // save the widget if it was a duplicate before
            if (widget.is.duplicate) wasDuplicate.push(widget);
                
            // check for a nameclash...
            if (pin.nameClash(widget) || pin.hasFullNameMatch(widget)) pin.is.duplicate = widget.is.duplicate = true;
        }

        // check
        if (wasDuplicate.length == 0) return

        // check if the widgets that were duplicates are still duplicates
        for (const widget of wasDuplicate) widget.is.duplicate = false;

        // check again
        for (let i=0; i<wasDuplicate.length; i++) {

            // if already set continue
            if (wasDuplicate[i].is.duplicate) continue

            // check with the rest of the widgets
            for (let j=i+1; j<wasDuplicate.length; j++) {

                // if the widgets are not duplicates anymore, change
                if (wasDuplicate[i].nameClash(wasDuplicate[j]) || wasDuplicate[i].hasFullNameMatch(wasDuplicate[j])) 
                    wasDuplicate[i].is.duplicate = wasDuplicate[j].is.duplicate = true;
            }
        }
    },

    // used for pins and interfaceNames
    // move the widgets down that are below pos.y - used to insert a new widget
    // ** does not change the size of the rectangle or the box ! **
    // note that pos.y can be negative !
    makePlace(pos, height) {

        // yFree starts at the bottom
        let yFree = this.rect.y + this.rect.h - style$1.look.hBottom; //- height

        // if there is no position given then yFree is ok
        if (!pos) return yFree

        // for each pin and ifName
        for (const widget of this.widgets) {

            // if the pin is below pos.y (i.e. y + h/2 value is bigger), shift the pin down
            if ((widget.is.pin || widget.is.ifName)&&(widget.rect.y + widget.rect.h/2 > pos.y)) {
                
                // get the y-coordinate of the new free space
                if (widget.rect.y < yFree) yFree = widget.rect.y;

                // shift the widget and adjust the connections
                widget.rect.y += height;

                // if there are routes - reconnect
                if (widget.routes) widget.adjustRoutes();
            }
        }

        // if there are no widgets, the ifName is the first one 
        return yFree
    },

    // calculate the rectangle for a pin
    pinRectangle(displayName, y, left, multi=false) {

        // notation
        const st = style$1.pin;
        let rc = this.rect;

        // total width of the widget
        const width = st.wMargin + this.getTextWidth(displayName, multi);

        // check the width of the look (can change the ractangle of the look !)
        if (width > rc.w) this.wider(width - rc.w);

        // get the y position of the rectangle
        const yNew = this.makePlace({x:0, y}, style$1.pin.hPin);

        // the rectangle for the pin 
        const rect = left   ? {x: rc.x - st.wOutside,                   y: yNew, w: width, h: st.hPin}
                            : {x: rc.x + rc.w - width + st.wOutside,    y: yNew, w: width, h: st.hPin};

        // done
        return rect
    },    

    // when adding pins or proxies sequentially, this calculates the next position in the rectangle
    nextPinPosition(left) {

        // notation
        const rc = this.rect;

        // adjust x for left or right - add y at the end
        return {x: left ? rc.x : rc.x + rc.w, 
                y: rc.y + rc.h - style$1.look.hBottom}
    },

    // every widget below y is moved up by dy
    shiftUp(y, dy) {

        // check all other widgets
        for (const widget of this.widgets) {

            // if its a box, make it shorter
            if (widget.is.box) widget.rect.h -= dy;

            // if below the widget that was removed..
            else if (widget.rect.y > y) {

                // shift upwards
                widget.rect.y -= dy;

                // now do the routes...
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget);
                // widget.routes?.forEach( route => route.clampToWidget(widget))
            }
        }
        // the look rectangle is shorter now
        this.rect.h -= dy;
    },

    movePin(pin, pos) {

        const yGap = pin.rect.y;
        const gap = pin.rect.h;

        pin.rect.y = this.makePlace(pos, pin.rect.h);
        for(const route of pin.routes) route.clampToWidget(pin);

        // shift the widgets up
        for (const widget of this.widgets) {

            // if below the widget that was removed..
            if (widget.rect.y > yGap) {

                // shift upwards
                widget.rect.y -= gap;

                // now do the routes...
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget);
            }
        }
    },

    // when after editing the ifName text has changed, we might have to change the look 
    ifNameChanged(ifName, savedName) {

        // change the pin names that belong to this ifName
        this.interfaceChangePrefix(ifName);

        // a new name was entered
        if (ifName.text.length > 0) {

            // calculate the new width
            let newWidth = this.getTextWidth(ifName.text);

            // check width of the look and adapt the width of the look if neecssary
            if (newWidth > this.rect.w) this.wider(newWidth - this.rect.w);

        }
        // the new name is empty: remove the ifName
	    else {
            ifName.node.look.removeInterfaceName(ifName);
        }

    },

    // names for pins need to be unique !
    NEW_findPin( name, input=true ) {

        for(const widget of this.widgets) {
            if (widget.is.pin && (widget.name == name)) return widget
        }
        return null
    },

    findPin( name, input=true ) {

        for(const widget of this.widgets) {
            if (widget.is.pin && (widget.name == name) && (widget.is.input == input)) return widget
        }
        return null
    },

    findInterfaceName(text) {
        for(const widget of this.widgets) {
            if (widget.is.ifName && widget.text == text) return widget
        }
        return null
    },
};

const padRouteFunctions = {

    adjustRoutes() {
        for(const route of this.routes) route.adjust();
    },

    routeToPin(pin) {

        // create a route between the pin and this pad
        let route = new Route(pin, this);

        // make a simple route between the two pins
        route.fourPointRoute();

        // save the route
        this.routes.push(route);

        // also in the pin
        pin.routes.push(route);
    },

    shortConnection(actual) {

        // create a route between the actual widget and this pad
        let route = new Route(actual, this);

        // make a simple route between the two pins
        route.twoPointRoute();

        // save the route
        this.routes.push(route);

        // also in the actual
        actual.routes.push(route);
    },    

    canConnect(widget) {

        // inputs connect to inputs and outputs to outputs !
        if (widget.is.pin) {

            // the proxy and the widget mùust both be inputs or outputs
            if (this.proxy.is.input != widget.is.input) return false

            // if the widget is a channel, then the proxy must be a channel also
            if (widget.is.channel && !this.proxy.is.channel) return false

            // if the widget is a multi
            if ((widget.is.multi || this.proxy.is.multi) && (!widget.hasMultiOverlap(this.proxy))) return false
        }

        // no duplicates
        if (this.routes.find( route => (route.from == widget)||(route.to == widget))) return false

        return true
    },

    // disconnect all routes to and from a pad
    disconnect() {

        // make a copy of the routes - the pad.routes array will be modified during this proc
        const routes = this.routes.slice();    

        // go through all the routes
        for (const route of routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from;

            // a pad can be connected to a pin or bus
            other.is.pin ? route.rxtxPinPadDisconnect() : route.rxtxPadBusDisconnect();

            // remove the route at both ends
            route.remove();
        }
    },

    reconnect(routes) {

        this.routes = routes;

        for(const route of routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from;

            // a pad can be attached to a pin or a bus
            if (other.is.pin) other.routes.push(route);
            else other.bus.push(other);
        }
    },

    // before dragging the pad we want to make sure the pad is the to widget
    checkRoutesDirection() {
        this.routes.forEach( route => { if (route.from == this) route.reverse(); });
    },

    drag(next, delta) {

        // if there are routes ...
        if (this.routes.length > 0) {

            // get the last two points of the first route
            const wire = this.routes[0].wire;

            // get the first or last points of the route
            const [a, b] = this.routes[0].from == this ?  [wire[0], wire[1]] : [wire.at(-1), wire.at(-2)];

            // calculate the next position
            const realNext = a.y == b.y ? {x: a.x + delta.x, y: next.y} : {x: next.x, y: a.y + delta.y};

            // add a new point to the routes
            for (const route of this.routes) route.drawXY( realNext ); 

            // check if we have to switch the left/right text position
            if (a.y == b.y) this.is.leftText = (a.x < b.x);

            // notation
            const rc = this.rect;

            // y position is independent of left/right
            rc.y = a.y - rc.h/2;

            //x depends on left right
            rc.x = this.is.leftText ? a.x - rc.w : a.x; 
        }
        else {
            // just move the pad
            this.rect.x += delta.x;
            this.rect.y += delta.y;           
        }
    },

    xdrag(next, delta) {

        // if there are routes ...
        if (this.routes.length > 0) {

            // get the last two points of the first route
            const wire = this.routes[0].wire;

            // get the last two points of the wire
            if (wire.length > 0) {
                const last = wire.at(-1);
                const prev = wire.at(-2);

                // use the direction to calculate a new value for the next point
                next = prev.y == last.y ? {x: last.x + delta.x, y: next.y} : {x: next.x, y: last.y + delta.y};
            }

            // add a new point to the routes
            for (const route of this.routes) route.drawXY( next ); 

            // place the pad again
            this.place();
        }
        else {
            // just move the pad
            this.rect.x += delta.x;
            this.rect.y += delta.y;           
        }
    },

    endDrag() {
        //if (this.routes.length == 1) this.routes[0].endpoint(this)
        this.routes.forEach( route => route.endpoint(this));
    },

    slide(delta) {

        // all the routes are attached horizontally
        this.routes.forEach( route => {

            // notation
            const p = route.wire;

            // to slide a route it must have at least three segments
            // make a copy of teh wire ! Points in the point array are overwritten !
            if (p.length == 2) {
                //const p0 = {...p[0]}
                //const p1 = {...p[1]}
                route.addTwoSegments({...p[0]},{...p[1]});
            }

            // notation
            const [a,b] = this == route.from ? [p[0],p[1]] : [p.at(-1),p.at(-2)]; 

            // move the segment
            a.y += delta.y;
            b.y += delta.y;
        });
        // finally move the pad
        this.rect.y += delta.y;
    },

    fuseEndSegment() {

        // only one route can fuse
        let fusedRoute = null;
        let dy = 0;

        // all the routes are attached horizontally
        for (const route of this.routes) {
        // this.routes.forEach( route => {

            // at least three segments required
            if (route.wire.length < 4) continue

            // notation
            const p = route.wire;
            const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false]; 

            // check if we can fuse segments 
            if (Math.abs(c.y - b.y) < style$1.route.tooClose) {
                dy = c.y - a.y;
                a.y = c.y;
                front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p);
                fusedRoute = route;
                break
            }
        }

        // if we have fused we will move all the routes and pad 
        if (fusedRoute) {
            for (const route of this.routes) {
            //this.routes.forEach( route => {

                // the fused route is already ok
                if (route == fusedRoute) continue

                // notation
                const p = route.wire;
                const [a,b] = this == route.from ? [p[0],p[1]] : [p.at(-1),p.at(-2)]; 

                // move the segment
                a.y += dy;
                b.y += dy;
            }
            // finally move the pad
            this.rect.y += dy;
        }
    },

    // when we copy the pad-pin routes, we already have copied all the nodes so we can set both ends of the route correctly
    // we use the uid that was also copied as the search element - the final uid is set after calling this routine
    copyPadPinRoutes(pad, root) {

        // copy the routes
        for(const route of pad.routes) {

            // get the other widget
            const other = route.from == pad ? route.to : route.from;

            // only routes to/from pins are considered
            if (!other.is.pin) continue

            // clone the route
            const clone = route.clone();

            // the pad - part of the route can be set
            clone.to == pad ?  clone.to = this : clone.from = this;

            // and save the cloned route
            this.routes.push(clone);

            // now find the node for the 'other'
            const node = root.nodes.find( node => node.uid == other.node.uid);

            // find the pin in that node
            const pin = node.look.findPin(other.name, other.is.input);

            // set the other part of the route
            clone.from == this ? clone.to = pin : clone.from = pin;

            // also save the new route in the pin
            pin.routes.push(clone);
        }
    },

    // remove a route from the routes array
    removeRoute(route) {

        eject(this.routes, route);
    },

    // copy the routes for the undo operation (see redox)
    copyWires() {

        const wires = [];
        for (const route of this.routes) wires.push(route.copyWire());
        return wires
    },

    restoreWires(wires) {

        const L = this.routes.length;
        for(let i = 0; i < L; i++) this.routes[i].restoreWire(wires[i]);
    },

    highLightRoutes() {

        // highlight the connections of the pqd
        for (const route of this.routes) {

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from;

            //check
            if (!other) continue

            // filter multis
            if (other.is.pin) {

                // filter unconnected multis
                if (!this.areConnected(other)) continue
                    
                // ok - highlight the route
                route.highLight();
            }

            // if the other is a bustack also highlight the routes that go via the bus
            if (other.is.tack) {

                route.highLight();

                other.bus.highLightRoutes(this);
            }
        }
    },

    unHighLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            //unhighlight the route
            route.unHighLight();

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from;

            // check
            if (!other) continue

            // check the 
            //if (other.is.proxy) other.pad.unHighLightRoutes()

            // if the other is a bustack also highlight the routes that go via the bus
            if (other?.is.tack) other.bus.unHighLightRoutes(this);
        }
    },

    checkRouteUsage() {

        // reset all the routes to used
        for(const route of this.routes) route.is.notUsed = false;

        // get the proxy for this pad
        const proxy = this.proxy;

        // check the routes
        for(const route of this.routes) {

            // get the other side of the route
            const other = route.from == this ? route.to : route.from;

            // multi messages can only connect to multimessages
            if (other.is.pin) {
                if ((other.is.multi || proxy.is.multi) && !proxy.hasMultiOverlap(other)) route.is.notUsed = true;
            }
            // else if (other.is.pad){
            //     if ((proxy.is.multi || other.proxy.is.multi) && !proxy.hasMultiOverlap(other.proxy)) route.is.notUsed = true;
            // } 
            else if (other.is.tack) {

                // check all the bus routes
                let found = false;
                for(const tack of other.bus.tacks) {

                    // skip 
                    if (tack == other) continue

                    // get the pin or pad at the other end 
                    const busWidget = tack.route.to == tack ? tack.route.from : tack.route.to;

                    // it could be that the route was not used
                    if (other.bus.areConnected(this, busWidget)) {
                        tack.route.is.notUsed = false;
                        found = true;
                    }
                }
                // if we have not found one connection..
                if (!found) route.is.notUsed = true;
            }
        }
    },

};

function Pad(rect, proxy, uid=null) {

    // unique id
    this.uid = uid;

    // constructor chaining
    this.rect = {...rect}; 

    // set h if necessary - we will set w when the pad is rendered
    // this.rect.h = rect.h > 0 ? rect.h : style.pad.hPad

    this.is = {
        pad: true,
        selected: false,
        highLighted: false,
        leftText: proxy.is.left,
        hoverOk: false,
        hoverNok: false,
        beingEdited: false
    };

    // set the text
    this.text = proxy.name;

    // the widget on the look
    this.proxy = proxy;

    // the routes to the pad (inside the group!)
    this.routes = [];
}
Pad.prototype = {

    copy() {
        return new Pad(this.rect, this.proxy, this.uid)
    },

    render(ctx, look) {
        
        // notation
        let st = style$1.pad;
        const rc = this.rect;
        const proxy = this.proxy;

        // use a different color for selected pads
        const cPad =  this.is.hoverNok ? st.cBad : st.cBackground;

        // the text and arrow color change when connected
        let cText =     this.is.highLighted ? st.cHighLighted
                        : this.is.selected || this.is.hoverOk ? st.cSelected
                        : this.routes?.length > 0 ? st.cConnected 
                        : st.cText;

        // color of the arrow
        const cArrow = cText;
        
        // the y position of the arrow
        let yArrow = rc.y+(st.hPad - st.wArrow)/2;

        // when being edited we recalculate the width of the rectangle
        if (this.is.beingEdited) {
            rc.w = style$1.pad.wExtra + ctx.measureText(this.text).width;
            this.place();
        }

        // render the pin  - note that x and y give the center of the triangle
        if (this.is.leftText) {

            // the x-position of the arrow
            const xArrow =  rc.x + rc.w - st.rBullet/2 - st.hArrow; 

            // draw a rectangle and a circle
            shape.rectBullet(ctx,rc.x, rc.y, rc.w, rc.h, cPad, st.rBullet);

            if (proxy.is.channel) {
                // draw a triangle
                proxy.is.input  ? shape.ballTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
                                : shape.triangleBall( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow); 
            }
            else {
                // draw a triangle
                proxy.is.input  ? shape.rightTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
                                : shape.leftTriangle(  ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow);
            }

            // write the text in the rectangle
            proxy.is.multi  ? shape.leftTextMulti(ctx,this.text,style$1.pin.fMulti,cText,rc.x + style$1.pad.wMargin,rc.y, rc.w,rc.h)
                            : shape.leftText(ctx,this.text,cText,rc.x + style$1.pad.wMargin,rc.y, rc.w,rc.h);
        }
        else {
            // The x-position of the arrow
            const xArrow = rc.x + st.rBullet/2;

            // draw the rectangle and the bullet
            shape.bulletRect(ctx,rc.x, rc.y, rc.w, rc.h, cPad, st.rBullet);

            if (proxy.is.channel) {
                // draw a triangle
                proxy.is.input  ? shape.triangleBall( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
                                : shape.ballTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow); 
            }
            else {
                // draw a triangle
                proxy.is.input  ? shape.leftTriangle(  ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
                                : shape.rightTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow);
            }

            // write the text in the rectangle
            proxy.is.multi  ? shape.rightTextMulti(ctx,this.text,style$1.pin.fMulti,cText,rc.x,rc.y,rc.w,rc.h)
                            : shape.rightText(ctx,this.text,cText,rc.x,rc.y,rc.w,rc.h);
        }
    },

    drawCursor(ctx, pChar,on) {
        // notation
        const rc = this.rect;

        // relative x position of the cursor
        const cx = ctx.measureText(this.text.slice(0,pChar)).width;

        // absolute position of the cursor...
        const xCursor = this.is.leftText ? rc.x + cx + style$1.pad.wMargin: rc.x + rc.w - ctx.measureText(this.text).width + cx;

        // the color for the blink effect
        //const color = on ? style.pad.cText : style.pad.cBackground
        const color = on ? style$1.std.cBlinkOn : style$1.std.cBlinkOff;

        // and draw the cursor
        shape.cursor(ctx, xCursor, rc.y, style$1.std.wCursor, rc.h, color); 
    },

    // returns the center of the pad bullet
    center() {
        const rc = this.rect;
        return this.is.leftText     ? {x: rc.x + rc.w ,  y: rc.y + rc.h/2} 
                                    : {x: rc.x ,         y: rc.y + rc.h/2}
    },

    // place the widget so that the center is on pos
    place() {
        // take the first route
        const route = this.routes[0];

        // check
        if ( ! route?.wire.length ) return

        // get the first or last point of the route
        const [pa, pb] = route.from == this ?  [route.wire[0], route.wire[1]] : [route.wire.at(-1), route.wire.at(-2)];

        // check
        this.is.leftText = (pa.x < pb.x);

        // notation
        const rc = this.rect;

        // y position is independent of left/right
        rc.y = pa.y - rc.h/2;

        //x depends on left right
        rc.x = this.is.leftText ? pa.x - rc.w : pa.x; 
    },

    // the edit functions
    startEdit() {
        this.is.beingEdited = true;
        return 'text'
    },

    getWidth() {
        const proxy = this.proxy;
        return style$1.pad.wExtra + proxy.node.look.getTextWidth(this.text, proxy.is.multi)
    },

    endEdit(saved) {

        // notation
        const proxy = this.proxy;

        // no more editing
        this.is.beingEdited = false;

        // if the name has not zero length...
        if (this.text.length > 0) {

            // set the name of the proxy
            proxy.name = this.text;

            // check the name and reset if not ok
            if ( ! proxy.checkNewName()) {
                proxy.name = this.text = saved;
                return
            }

            // the name might have changed (multi)
            this.text = proxy.name;

            // check for route usage
            this.checkRouteUsage();

            // recalculate the width of the pad
            this.rect.w = this.getWidth();
            //this.place()

            // done
            return
        }

        // zero length : The pin can only be removed if there are no routes
        if (proxy.routes.length == 0) {

            // remove the proxy
            proxy.node.look.removePin(proxy);

            // and remove the pad
            proxy.node.removePad(this);

            // done
            return
        }

        // restore the old name
        this.text = saved;
    },

    // the name of the proxy has changed - length of the pad must also change
    nameChange( newName ) {
        // change
        this.text = newName;

        // force a recalculation of the rectangle
        this.rect.w = this.getWidth();
    },

    overlap(rect) {
        const rc = this.rect;

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    moveTo(x,y) {

        this.rect.x = x;
        this.rect.y = y;

        this.adjustRoutes();
    },

    move(delta) {

        this.rect.x += delta.x;
        this.rect.y += delta.y;

        //this.adjustRoutes()
    },

    // checks if the widget and the pad are logically connected
    // we only have to filter unconnected multis
    areConnected(widget) {

        if (widget.is.pin) {
            // only when the proxy is a multi, it functions as a filter
            if (this.proxy.is.multi && !widget.hasMultiOverlap(this.proxy)) return false
        }

        return true
    },

    makeConxList(list) {

        for(const route of this.routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from;

            // check if connected
            if ( ! this.areConnected(other)) continue

            // if the actual is also a proxy, take it to the next level, else save in list
            if (other.is.pin) {
                other.is.proxy ?  other.pad?.makeConxList(list) : list.push( other );
            }
            // get all the connections to the bus that can reach the pad
            else if (other.is.tack) {

                // If the bus has a router, just add the tack to the list
                if (other.bus.hasFilter()) list.push(other);

                // otherwise continue to complete the list
                else other.bus.makeConxList(this, list);
            }
        }
    },

    highLight() {
        this.is.highLighted = true;
    },

    unHighLight() {
        this.is.highLighted = false;
    },

    hitTest(pos) {

        // check if we have hit the rectangle
        if (! inside(pos, this.rect))  return [zap.nothing, null]

        // we have hit the pad - check if we have hit the arrow (left or right)
        if (this.is.leftText) {
            return (pos.x > this.rect.x + this.rect.w - 2*style$1.pad.rBullet) ? [zap.padArrow, this] : [zap.pad, this]
        }
        else {
            return (pos.x < this.rect.x + 2*style$1.pad.rBullet) ? [zap.padArrow, this] : [zap.pad, this]
        }
    },

    hitRoute(pos) {

        let segment = 0;

        // go through all the routes..
        for (const route of this.routes) {

            // only routes from this pad
            if ((route.from == this)&&(segment = route.hitSegment(pos))) return [zap.route, route, segment]
        }
        // nothing
        return [zap.nothing, null, 0]
    }

};
Object.assign(  Pad.prototype, padRouteFunctions);

const widgetLifecycle = {

addHeader() {

    // the space taken by the icons
    const iconSpace = 2*(style$1.icon.xPadding + 2*style$1.icon.wIcon + style$1.icon.xSpacing);

    // the required width for the look..
    const W = this.getTextWidth(this.node.name) + iconSpace;

    // notation
    const rc = this.rect; 

    // check the width of the look (can change this.rect)
    if (W > rc.w) this.wider(W - rc.w);

    // the width of the title widget is the same as the width of the look
    const wRect = { x: rc.x , y: rc.y, w: rc.w, h: style$1.header.hTitle};

    // create the title
    const widget = new Header(wRect, this.node); 

    // add the widget - the space for the title has alraedy been reserved in hTop (see above)
    this.widgets.push(widget);

    // done
    return widget
},

// adaptposition is set to false whe reading from json file
addLabel(text) {

    // notation
    const rc = this.rect;

    // check the size of the label
    this.getTextWidth(text);

    // the width of the label widget is the same as the width of the look
    const wRect = { x: rc.x , 
                    y: rc.y - style$1.label.hLabel, 
                    w: rc.w, 
                    h: style$1.label.hLabel};

    // create the label
    const widget = new Label$1(wRect, text, this.node);

    // add the widget - the label comes just above the box - 
    this.widgets.push(widget);

    // increase the size and position of the look
    rc.y -= style$1.label.hLabel;
    rc.h += style$1.label.hLabel;

    // done
    return widget
},

removeLabel() {

    const label = this.findLabel();

    if (!label) return

    // remove the label from the array (changes the array !)
    eject(this.widgets, label);
    
    // decrease the size and position of the look
    this.rect.y += style$1.label.hLabel;
    this.rect.h -= style$1.label.hLabel;
},

restoreLabel(label) {
    // add the label to the list
    this.widgets.push(label);

    // increase the size and position of the look
    this.rect.y -= style$1.label.hLabel;
    this.rect.h += style$1.label.hLabel;
},

// is = {channel, input, request, proxy, left } - left can be absent 
addPin(name, pos, is) {

    // left or right
    const left = is.left ?? pos.x < this.rect.x + this.rect.w/2;

    //check if the name has a prefix or postfix
    const displayName = this.displayName(name,pos.y);

    // the rectangle for the pin
    const rect = this.pinRectangle(displayName, pos.y, left, is.multi);

    // create the pin
    const pin = is.proxy ? new Proxy(rect, this.node, name, is)  : new Pin(rect, this.node, name, is); 

    // save left
    pin.is.left = left;

    // add the widget
    this.addWidget( pin );

    // done
    return pin
},

// removes a pin - disconnect first 
removePin( pin ) {

    // remove the widget from the array + shift the other widgets up 
    if (pin.is.pin && eject(this.widgets,pin)) this.shiftUp(pin.rect.y, pin.rect.h);
},

// restores a pin that has been deleted - only used in an undo !
restorePin(pin) {

    const rc = pin.rect;

    this.makePlace({x:rc.x, y:rc.y}, rc.h);
    this.addWidget(pin);
},

// pos can be null !
addIfName(text, pos) {

    // shift the widgets that are below pos.y to make place for the new ifName
    const yFree = this.makePlace(pos, style$1.ifName.hSep);

    // the rectangle for the widget
    const rect = {x: this.rect.x, y: yFree, w:this.rect.w, h:style$1.ifName.hSep};

    // create a new ifName
    const ifName = new InterfaceName(rect, text, this.node);

    // add the widget to the look
    this.addWidget(ifName);
    
    // done
    return ifName
},

removeInterfaceName( ifName ) {

    // remove the ifName from the array
    if (ifName.is.ifName && eject(this.widgets,ifName)) this.shiftUp(ifName.rect.y, ifName.rect.h);
},

restoreInterfaceName( ifName) {

    const rc = ifName.rect;

    this.makePlace({x:rc.x, y:rc.y}, rc.h);
    this.addWidget(ifName);
},

copyPinArea(widgets, pos) {

    // check
    if (!widgets || widgets.length == 0) return null

    // sort the array according to y-value
    widgets.sort( (a,b) => a.rect.y - b.rect.y);

    // copy the intial y-position
    const where = {...pos};

    // the array of the copies
    const copies = [];

    // go through all the widgets
    for(const widget of widgets) {

        if (widget.is.pin) {

            // if the pin exists already, we do not copy
            if (this.findPin(widget.name, widget.is.input)) continue;

            // add the pin at the requested position
            const pin = this.addPin(widget.name,where, widget.is);

            // add a pad or add to the rxtx tables
            // if (pin.is.proxy) this.addPad(pin) //: this.node.rxtxAddPin(pin)

            // copy and check the prefix length
            if (widget.pxlen) {
                pin.pxlen = widget.pxlen;
                pin.checkPrefix();
            }

            // the next position
            where.y = pin.rect.y + pin.rect.h;

            // save
            copies.push(pin);
        }
        else if (widget.is.ifName) {

            // check if it exists
            if (this.findInterfaceName(widget.text)) continue

            // add the ifName
            const ifName = this.addIfName(widget.text, where);

            // the next position
            where.y = ifName.rect.y + ifName.rect.h;

            // save
            copies.push(ifName);
        }
    }
    return copies
},

deletePinArea(widgets) {

    // check
    if (!widgets || widgets.length == 0) return

    // go through all the widgets
    for(const widget of widgets) {

        if (widget.is.pin) {

            // disconnect
            widget.disconnect();

            // delete the pin in the node
            this.removePin(widget);

            // remove from the rxtx table
            if (widget.is.proxy) {

                widget.pad.disconnect();

                widget.node.removePad(widget.pad); 
            }
            else widget.node.rxtxRemovePin(widget);
        }
        else if (widget.is.ifName) {

            this.removeInterfaceName(widget);
        }
    }
},



};

const interfaceHandling = {

    // find the array of pins that are part of the ifName 
    // The first element of the array is the ifName itself
    getInterface(ifName) {

        // collect the pins in an array
        const pinArray = [];

        // push the ifName on the array
        pinArray.push(ifName);

        // find the max y, i.e. the ifName below or the end of the node
        let yMax = this.rect.y + this.rect.h;
        for (const sep of this.widgets) {
            if (!sep.is.ifName) continue
            if ((sep.rect.y > ifName.rect.y) && (sep.rect.y < yMax)) yMax = sep.rect.y;
        }

        // find all the pins between the two y values
        for ( const pin of this.widgets ) {
            if (!pin.is.pin) continue
            if ((pin.rect.y >= ifName.rect.y) && (pin.rect.y < yMax)) pinArray.push(pin);
        }

        // sort the array
        pinArray.sort( (a,b) => a.rect.y - b.rect.y);

        // done
        return pinArray
    },

    // shift widgets below a certain y value and adapt the size of the box - reconnect routes also
    shiftWidgetsBelow(yFrom, yDelta) {

        // shift all the pins below the interface down
        for (const widget of this.widgets) {

            // change the size of the box
            if (widget.is.box) {
                widget.rect.h += yDelta;
                this.rect.h += yDelta;
                continue
            }

            // move the widgets below
            if (widget.rect.y > yFrom) {
                widget.rect.y += yDelta;
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget);
            }
        }
    },

    // move the widget up and down in the list with the mouse
    // the moving ifName (= first element of the pin array) will change place with the ifName above or below (the swap)
    swapInterface(pos, group) {

        // find the ifName to nextInterface with (moving up or down)
        const nextInterface = this.findNextWidget(group[0],pos, widget => widget.is.ifName);

        // check if we have found the next ifName up or down
        if (!nextInterface) return

        // we only move if we are inside the closest ifName rectangle
        if ((pos.y < nextInterface.rect.y) || (pos.y >  nextInterface.rect.y + nextInterface.rect.h)) return;

        // moving up or down ?
        const down = pos.y > group[0].rect.y;

        // find the pins that belong to nextInterface
        const nextGroup = this.getInterface(nextInterface);

        // find the delta that the *other* group has to move
        const gFirst = group[0];
        const gLast = group.at(-1);
        let gDelta = gLast.rect.y  - gFirst.rect.y  + gLast.rect.h; 
        if (down) gDelta = -gDelta;

        // find the delta that the group has to move
        const nFirst = nextGroup[0];
        const nLast = nextGroup.at(-1);
        let nDelta = nLast.rect.y - nFirst.rect.y  + nLast.rect.h; 
        if (!down) nDelta = -nDelta;

        // move the other group
        for(const pin of nextGroup) {
            pin.rect.y += gDelta;
            if (pin.is.pin) pin.adjustRoutes();
        }

        // move the group
        for (const pin of group) {
            pin.rect.y += nDelta;
            if (pin.is.pin) pin.adjustRoutes();
        }
    },

    interfaceChangePrefix(ifName) {

        // get the pins that belong to the ifName
        const ifPins = this.getInterface(ifName);

        // change the names of the pins that have a prefix (the first element is the ifName)
        for (const pin of ifPins) {
                
            // check that the pin has a prefix
            if (pin.is.pin && pin.pxlen != 0) {

                // seve the old name
                const oldName = pin.name;

                // change the prefix
                pin.changePrefix(ifName.text);

                // make other necessary changes
                pin.nameChanged(oldName);
            }
        }
    },

    // when we have to undo an operation, we need this
    showPrefixes(ifName) {

        // show the full names of the nodes below
        const group = ifName.node.look.getInterface(ifName);

        // the pins of the group that have a prefix
        const pxlenArray = [];

        // check
        for (const pin of group) {
            if (pin.is.pin && pin.pxlen != 0) {
                pxlenArray.push(pin.pxlen);
                pin.pxlen = 0;
            }
        }

        // done
        return pxlenArray
    },

    hidePrefixes(ifName, pxlenArray) {
        // show the full names of the nodes below
        const group = ifName.node.look.getInterface(ifName);

        // the pins start at 1
        for (let i=1; i<pxlenArray.length; i++) group[i].pxlen = pxlenArray[i];
    },

    highLightInterface(ifName) {

        // get the pins that are below this ifName
        const ifPins = this.getInterface(ifName);

        // set a selection rectangle around the selected pins
        for(const widget of ifPins) {
            // highlight the pin itself
            widget.highLight();

            // and highlight the routes
            if (widget.is.pin) widget.highLightRoutes();
        }

        // return the group
        return ifPins
    },

    unhighLightInterface(ifPins) {

        if (!ifPins) return 

        for(const widget of ifPins) {
            widget.unHighLight();
            if (widget.is.pin) widget.unHighLightRoutes();
        }
    },

    // finds the ifName just above the widget
    findIfNameAbove(y) {
        let ifName = null;
        for (const widget of this.widgets) {

            // find the  interface name that is closest to the widget
            if ((widget.is.ifName) && (widget.rect.y < y) && ( ifName == null || ifName.rect.y < widget.rect.y)) ifName = widget;
        }
        // return what has been found
        return ifName
    },

    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    getPrefixLength(fullName, y) {

        // find the relevant ifName
        const ifName = this.findIfNameAbove(y);

        // check
        if (!ifName) return 0

        // check if the name of the ifName is a postfix or prefix to the pin
        const prefix = fullName.indexOf('.');
        if ((prefix > 0) && (fullName.slice(0,prefix) === ifName.text)) return ifName.text.length

        // check if the name of the ifName is a postfix or prefix to the pin
        const postfix = fullName.lastIndexOf('.');
        if ((postfix > 0) && (fullName.slice(postfix+1) === ifName.text)) return  - ifName.text.length

        return 0
    },

    // there is a prefix or a postfix that is not displayed
    displayName(fullName, y) {

        const pxlen = this.getPrefixLength(fullName, y);

        return (pxlen > 0) ? '+ ' + fullName.slice(this.pxlen+1) : fullName.slice(0, this.pxlen-1) + ' +'
    },

    // area is the rectangle of the pin area
    dragPinArea(widgets,area) {

        const first = widgets[0];

        // Moving up
        if (area.y < first.rect.y) {

            // find the pin or interface above
            const above = this.findNextWidget(first,{x:0, y:area.y}, w => (w.is.pin || w.is.ifName));
            if (!above) return;

            // If we are over halfway the next pin..
            if (area.y < above.rect.y + above.rect.h/2) {

                // move
                this.groupMove(widgets, above.rect.y - first.rect.y);

                 // do a interface check
                 this.interfaceCheck();
            }
            return;
        }

        const last = widgets.at(-1);

        // moving down
        if (area.y + area.h > last.rect.y + last.rect.h) {

            // find the pin just below
            const below = this.findNextWidget(last,{x:0, y: area.y + area.h}, w => (w.is.pin || w.is.ifName));
            if (!below) return

            // if we are over halfway the next pin, we move
            if ((area.y + area.h) > (below.rect.y + below.rect.h + below.rect.h/2)) {
                
                // move ...
                this.groupMove(widgets, below.rect.y - last.rect.y);

                // interfaceCheck
                this.interfaceCheck();
            }

            return;
        }

    },

    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    interfaceCheck() {

        // reset the pxlen
        for (const pin of this.widgets) if (pin.is.pin) pin.pxlen = 0;

        for (const ifName of this.widgets) {

            if (!ifName.is.ifName) continue

            const ifPins = this.getInterface(ifName);

            for (const pin of ifPins) {

                // the first one is the interface name
                if (!pin.is.pin) continue

                // find the relevant ifName
                const text = ifName.text.toLowerCase();

                // Get the lowercase name
                const lowerCase = pin.lowerCase();

                // check if the name of the ifName is a prefix to the pin
                if (lowerCase.startsWith(text)) pin.pxlen = text.length;
                else if (lowerCase.endsWith(text)) pin.pxlen = -text.length;
            }
        }
    },

};

const iconHandling = {

    // The title is the name of the node ... 
    // the white space has been trimmed of the text
    headerChanged(header, saved) {

        // a zero sized name is not accepted
        if (header.title.length == 0) {
            header.title = header.node.name;
            return
        }
        // the space taken by the icons
        const iconSpace = 2*(style$1.icon.xPadding + 2*(style$1.icon.wIcon + style$1.icon.xSpacing));

        // calculate the new width for the header
        let newWidth = this.getTextWidth(header.title) + iconSpace;

        // check width of the look and adapt the width of the look if neecssary
        if (newWidth > this.rect.w) this.wider(newWidth - this.rect.w);

        // change the name of the node
        header.node.name = header.title;

        // if the name of the factory is empty, change it
        if (header.node.is.source && header.node.factory.fName.length < 1) 
            header.node.factory.fName = convert.nodeToFactory(header.node.name);

        // check if the node name is unique 
        editor.doc.focus.root.checkDuplicates(header.node);
    },

    // return the rectangle for the icon. Pos L = left, R = right          L1 L2 L3 .......... R3 R2 R1
    iconRect(rc, pos) {

        let xIcon = rc.x;
        const st = style$1.icon;

        switch(pos) {
            case 'L1':  xIcon = rc.x + st.xPadding;
                        break
            case 'L2':  xIcon = rc.x + st.xPadding + st.wIcon + st.xSpacing;
                        break
            case 'R1':  xIcon = rc.x + rc.w - st.xPadding - st.wIcon;
                        break
            case 'R2':  xIcon = rc.x + rc.w - st.xPadding - st.wIcon - st.xSpacing - st.wIcon;
                        break
        }

        return { x:xIcon, y:rc.y + st.yPadding, w:st.wIcon,h:st.hIcon}
    },

    addIcon(type) {

        // the icon comes in the header
        const header = this.widgets.find( w => w.is.header);

        // no title no icon
        if (!header) return

        const place = {
            'group':'L1',
            'factory':'L1',
            'link':'L1',
            'lock':'L1',
            'cog':'L2',
            'comment':'R1',
            'pulse':'R2'
        };

        // get the rectangle for the icon
        const rcIcon = this.iconRect(header.rect, place[type]);

        // if there is already an icon at that place...
        const double = this.widgets.find( w => w.is.icon && w.rect.x == rcIcon.x);

        // ...remove it
        if (double) eject(this.widgets,double);

        // create the new icon
        const icon = new Icon( rcIcon, type);

        // set the render function
        icon.setRender();

        // add the icon to the widget list
        this.widgets.push(icon);
    },

    // set the link as being bad - will change the color of the link icon
    badLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'));
        if (icon) icon.is.bad = true;
    },

    // set the link as being bad - will change the color of the link icon
    goodLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'));
        if (icon) icon.is.bad = false;
    },

    // check if we have to change the link icon
    checkLinkIcon(type) {

        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'));

        if (icon?.type == type) return

        this.addIcon(type);
    },

    removeLinkIcon() {
        const icon = this.widgets.find(w => w.is.icon && w.type == 'link');
        if (icon) eject(this.widgets,icon);
    },

    blinkToWarn() {

        // time is in ms
        const blinkFunction = (time) => {

            // check the time
            if (time - lastTime >= blinkRate) {

                // change the color
                icon.is.highLighted = !icon.is.highLighted;
                header.is.highLighted = !header.is.highLighted;

                // redraw
                editor.redraw();

                // save the time
                lastTime = time;

                // increment count
                count++;
            }
    
            // Continue fro the number of blinks requested
            if (count < maxBlinks) {
                requestAnimationFrame(blinkFunction);
            }
            else {
                icon.is.highLighted = false;
                header.is.highLighted = false;
                editor.redraw();
            }
        };

        const icon = this.widgets.find(w => w.is.icon && (w.type == 'link' || w.type == 'lock'));
        const header = this.widgets.find( w => w.is.header);

        if (!icon || !header) return

        const maxBlinks = style$1.icon.nBlinks * 2;
        const blinkRate = style$1.icon.blinkRate;

        let count = 0;
        let lastTime = 0;
    
        // schedule the first blink function
        requestAnimationFrame(blinkFunction);
    },
};

const moveHandling = {

    moveDelta(x,y) {

        // adjust the position
        this.rect.x += x;
        this.rect.y += y;

        // adjust the widgets
        this.widgets.forEach( (widget) => { 

            // change the widget position
            widget.rect.x += x;
            widget.rect.y += y;
        });
    },

    // move to absolute position
    moveTo(x,y) {

        // calculate the delta
        this.moveDelta(x - this.rect.x, y - this.rect.y);
    },

    // x and y are actually delta's ! 
    // a group of nodes has been moved - move the routes also
    // change the position of the routes -- only from ! -- we only want to move the segments once !
    // moveRoutes(x,y) {
    //     this.widgets.forEach( (widget) => { 
    //         widget.routes?.forEach( route => route.from == widget ? route.moveAllPoints(x,y) : null )
    //     })
    // },

    // adjust all the routes for widgets with routes
    adjustRoutes() {  
        for (const widget of this.widgets) {
            if (widget.routes)  widget.adjustRoutes();
        }
    },

    // move all the points of the routes over the delta
    moveRoutes(dx,dy) {
        for (const widget of this.widgets) {
            if (widget.routes) {
                for (const route of widget.routes) if (route.from == widget) route.moveAllPoints(dx, dy);
            }
        }
    },

    // // move or adjust the routes
    // moveOrAdjustRoutes() {
    //     for (const widget of this.widgets) {
    //         if (widget.routes) {
    //             for (const route of widget.routes) route.adjust()            
    //         }
    //     }
    // },

    // this is used to move a group of widgets up or down in a node - used in undo operation
    groupMove(group, dy) {

        // helper function
        const yMove = (widget,delta) => {
            widget.rect.y += delta;
            if (widget.is.pin) widget.adjustRoutes();
        };

        // the y position and size of the group to move
        const a = group[0].rect.y;
        const b = group.at(-1).rect.y; 
        const size = b - a + group.at(-1).rect.h;

        // dy is positive for moving down and negative for moving up
        for (const widget of this.widgets) {

            //notation
            const wy = widget.rect.y;

            // move the widgets of the group up or down
            if ((wy <= b) && (wy >= a)) yMove(widget, dy); 
            
            // if down, move the widget 'dy' below, up
            else if ( (dy > 0) && (wy  > b) && (wy <= b + dy)) yMove(widget, -size); 

            // if up move the widget 'dy' above, down
            else if ( (dy < 0) && (wy  < a) && (wy >= a + dy)) yMove(widget, size); 
        }
    },

   // find the next widget up or down that passes the check
   findNextWidget(current,pos,check) {

        // the widget that will change position with the selected widget
        let cry = current.rect.y;

        // if on the widget return null
        if ((pos.y >= cry) && (pos.y <= cry + current.rect.h)) return null

        // now we check if we have to move one position up or down
        let next = null;

        // if above the current widget
        if (pos.y < cry) {
            // find the widget just above ...
            for (const widget of this.widgets) {
                if ( !check(widget) || widget == current) continue
                if ((widget.rect.y < cry)&&( next == null || (next.rect.y < widget.rect.y))) next = widget;
            }
        }
        // if below the current widget
        else if (pos.y > cry + current.rect.h) {
            // find the widget just below...
            for (const widget of this.widgets) {
                if (!check(widget) || widget == current) continue
                if ((widget.rect.y > cry)&&( next == null || (next.rect.y > widget.rect.y))) next = widget;
            }         
        }

        return next
    },

    // findPinAtY(y) {
    //     for (const widget of this.widgets) {
    //         if (!widget.is.pin) continue;
    //         if (widget.rect.y < y && (widget.rect.y + widget.rect.h) > y) return widget
    //     }
    //     return null;
    // },

    // moves the node to make routes perfectly alligned.
    // it takes the first route that is not alligned and moves the node to make it aligned.
    snapRoutes() {

        for( const pin of this.widgets) {

            // only pins have routes
            if (!pin.is.pin) continue

            // check all the short routes
            for (const route of pin.routes) {

                // notation
                const p = route.wire;

                // routes should have at least three points
                if (p.length < 3) continue

                // notation
                const [a,c] = (pin == route.from) ? [p[0], p[2]] : [p.at(-1), p.at(-3)]; 

                // check if we have to move the node in the y direction a bit...
                const delta = c.y - a.y;
                if (Math.abs(delta) < style$1.route.tooClose) {

                    // move the node
                    this.moveDelta(0, delta);

                    // adjust the endpoins of all the routes
                    this.adjustRoutes();

                    // we only do this once, so return now !
                    return
                }
            }
        }
    }
};

const copyHandling = {

    // copy the look of a node for another node. Note that the routes of pins/proxies are handled later.
    copy(newNode) {

        // copy the look - set the height to 0
        // const newLook = new Look(this.rect)

        // copy the wid generator 
        newNode.look.widGenerator = this.widGenerator;

        // copy all the widgets 
        this.widgets.forEach( w => {

            let nw = null;

            if (w.is.pin) {
                nw = w.is.proxy ? new Proxy(w.rect, newNode, w.name, w.is) : new Pin(w.rect, newNode, w.name, w.is); 
                nw.profile = w.profile;
                nw.pxlen = w.pxlen;
            }
            else if (w.is.ifName) {        
                nw = new InterfaceName(w.rect,w.text,newNode);      
            }            
            else if (w.is.header) {      
                nw = new Header(w.rect,newNode);        
            }            
            else if (w.is.icon) {       
                nw = new Icon(w.rect, w.type);   
                nw.setRender();    
            }            
            else if (w.is.box) {     
                nw = new Box(w.rect, newNode);      
            }            
            else if (w.is.label) {     
                nw = new Label$1(w.rect,w.text, newNode); 
            }

            // if the widget has a wid, copy that also
            if (w.wid) nw.wid = w.wid;

            // add the widget to the new look
            if (nw) newNode.look.widgets.push(nw);
        });
    },    

    // copy the look from a source node to a group node look and vice versa
    // the routes are not copied
    copyConvert(newNode) {

        // copy the wid generator 
        newNode.look.widGenerator = this.widGenerator;

        // copy all the widgets 
        this.widgets.forEach( w => {

            // const nlw = newLook.widgets
            let nw = null;

            if (w.is.pin) {
                // remark the *inversion* proxy -> pin !
                nw = w.is.proxy ? new Pin(w.rect, newNode, w.name, w.is) : new Proxy(w.rect, newNode, w.name, w.is); 
                nw.profile = w.profile;
                nw.pxlen = w.pxlen;
            }
            else if (w.is.ifName) {
                nw = new InterfaceName(w.rect,w.text,newNode);
            }
            else if (w.is.header) {
                // copy the title
                nw = new Header(w.rect,newNode);
            }
            else if (w.is.icon) {

                // source nodes do not have a group icon and vice versa
                const icon = w.type == 'group' ? 'factory' : w.type == 'factory' ? 'group' : w.type;

                // add the icon
                newNode.look.addIcon(icon);
            }
            else if (w.is.box) {
                nw = new Box(w.rect, newNode);
            }
            else if (w.is.label) {
                // copy the label for the node
                nw = new Label$1(w.rect, w.text, newNode);
            }

            // if the widget has a wid, copy that also
            if (w.wid) nw.wid = w.wid;

            // add the widget to the new look
            if (nw) newNode.look.widgets.push(nw);
        });
    },    

    // the look to copy from has the same widgets in the same order !
    copyPinPinRoutes(look) {

        const L = look.widgets.length;
        let original = null;
        let copy = null;

        for (let i = 0; i<L; i++) {

            // get the corresponding widgets
            original = look.widgets[i];
            copy = this.widgets[i];

            // clone the routes for all inputs
            if (original.is.pin && original.is.input) {

                // check all the routes for the widgets -
                for(const route of original.routes) {

                    // only pin-pin routes - other routes are handled elsewhere
                    if (!route.to.is.pin || !route.from.is.pin) continue

                    // make a copy of the route
                    const newRoute = route.clone();

                    // change one of the widgets
                    newRoute.from == original ?  newRoute.from = copy : newRoute.to = copy;

                    // save the route
                    copy.routes.push(newRoute);
                }
            }
        }
    },

    // the widgets in the routes - correct the second widget (from or to) in the route
    correctPinPinRoutes(root) {

        for(const widget of this.widgets) {

            // only if the widget is an input widget we have to correct the other widget
            if (!widget.is.input) continue

            // check all the routes
            for (const route of widget.routes)  {

                // get the other widget
                const other = route.from == widget ? route.to : route.from;

                // we only correct pin pin routes here
                if (!other.is.pin) continue

                // the nodes still have the same uid !
                const node = root.nodes.find( node => node.uid == other.node.uid);

                // find the pin in the new node
                const pin = node.look.findPin(other.name, false);

                // change the pin in the route
                route.from == widget ? route.to = pin : route.from = pin;

                // and save the route in the pin
                pin.routes.push(route);
            }
        }
    },
 
    // transfer all the routes from this node to the look (parameter) of the new node
    // both nodes have the same nr of widgets
    // typically we do this when a source node is changed in a group node
    transferRoutes(look) {

        // use a for loop - there are two arrays to index
        for (let i = 0; i < look.widgets.length; i++) {

            // get the corresponding widgets
            const original = this.widgets[i];
            const copy = look.widgets[i];

            // clone the routes for all inputs
            if (original.routes?.length > 0) {

                // check all the routes for the widgets -
                for (const route of original.routes) {

                    // change the end or starting point from the route
                    if (route.from == original) route.from = copy;
                    if (route.to == original) route.to = copy;

                    copy.routes.push(route);
                }
            }
        }
    },


};

const jsonHandling$2 = {

// collect the elements of the look that need to be saved in the vmblu file
getItemsToSave() {

    const widgets = [];
    //const interfaces = []

    const toSave = {
        rect: {...this.rect},
        label: null,
        interfaces: []
    };

    // get the rectangle
    //const rect = {...this.rect}
    //let label = null

    // Check the widgets
    for( const w of this.widgets) {

        // don't save the icons the box or the header
        if (w.is.icon || w.is.box || w.is.header) continue

        // for a label do not include it in the rectangle size
        if (w.is.label) {
            toSave.rect.y += w.rect.h;
            toSave.rect.h -= w.rect.h;        
            toSave.label = w;
            continue
        }

        // save interface names
        if (w.is.ifName) widgets.push(w);

        // save pins, but expand multis into seperate messages
        else if (w.is.pin) {

            widgets.push(w);

            // save multis as single messages
            // if (w.is.multi) {
            //     const mArray = w.expandMultis()
            //     for (const mName of mArray) {

            //         // create a new pin record
            //         const mPin = new Widget.Pin(w.rect, w.node, mName, w.is)

            //         // multis have the same wid
            //         mPin.wid = w.wid
            //         pins.push(mPin)
            //     }
            // }
            // else pins.push(w)
        }
    }

    // if there are no widgets there are no interfaces
    if (widgets.length == 0) return toSave

    // sort the widgets array
    widgets.sort( (a,b) => a.rect.y - b.rect.y);

    // fill in all the interfaces now
    let ifnr = -1;
    let ifPins = null;

    // If the first widget is a pin we have an unnamed ifPins (always the first)
    if (widgets[0].is.pin) {
        ifnr++;
        toSave.interfaces[ifnr] = { name: '',pins:[], editor: {id: 0}};
        ifPins = toSave.interfaces[ifnr].pins;
    }

    // go through all the widgets
    for (const w of widgets) {

        // ad a pin to the current interface
        if (w.is.pin) ifPins.push(w);

        // an interface name starts a new ifPins
        else if (w.is.ifName) {
            ifnr++;
            toSave.interfaces[ifnr] = {name: w.text, pins: [], editor: {id: w.wid}};
            ifPins = toSave.interfaces[ifnr].pins;
        }
    }

    // done
    return  toSave
},

acceptChanges() {

    // save the widgets to remove
    const zombies = [];

    for(const widget of this.widgets) {

        // remove the routes to and from the zombie
        if (widget.is.pin) {

            // make a copy of the routes for the loop - the widget.routes will be modified !!
            const routes = widget.routes?.slice();

            if (widget.is.zombie) {

                // disconnect the routes
                for(const route of routes) route.disconnect();

                // save the zombie
                zombies.push(widget);
            }
            // remove routes for which no connection exists anymore and accept new routes
            else {
                for (const route of routes) {
                    if (route.is.newConx) route.is.newConx = false;
                    else if (route.is.noConx) route.disconnect();
                }
            }
        }

        if (widget.is.ifName && widget.is.zombie) {

            // show the full names of the ifName group
            widget.node.look.showPrefixes(widget);
            zombies.push(widget);
        }
        
        if (widget.is.added) widget.is.added = false;
    }

    // now remove the zombie widgets from the look
    for(const zombie of zombies) {
        zombie.is.pin   ? zombie.node.look.removePin(zombie)
                        : zombie.is.ifName ? zombie.node.look.removeInterfaceName(zombie) 
                        : null;
    }
},

cook( raw ) {

    // check for a label
    if (raw.label) this.addLabel(raw.label);

    // check
    if (!raw.interfaces) return

    // go through all the interfaces
    for (const rawInterface of raw.interfaces) {

        // create the interface first
        this.cookInterface(rawInterface);

        // cook the pins
        for (const rawPin of rawInterface.pins) {
            
            // cook the pin
            const newPin = this.cookPin(rawPin);

            // if the new pin is a proxy (the node is a group), we have to cook or add a pad to the group
            if (this.node.is.group) {
                rawPin.editor?.pad ? this.node.cookPad(newPin, rawPin.editor.pad ) : this.node.addPad(newPin);
            }
        }
    }

    // get the highest wid value
    for (const widget of this.widgets) if (widget.wid && (widget.wid > this.widGenerator)) this.widGenerator = widget.wid;

    // if there are widgets with a wid of zero, correct this
    for (const widget of this.widgets) if (widget.wid && (widget.wid == 0)) widget.wid = this.generateWid();
},

cookPin(raw) {

    // if there is no editor field, add it
    if (!raw.editor) raw.editor = {id:0, align: 'left'};

    // the state of the pin
    const is = {
        input: false,
        left: false,
        channel: false,
        multi: false,
        zombie: false
    };

    // set the state bits
    is.input = ((raw.kind == "input") || (raw.kind == "reply")) ? true : false;
    is.left = raw.editor.align == "left" ? true : false;
    is.channel = ((raw.kind == "request") || (raw.kind == "reply")) ? true : false;

    // a comma seperated list between [] is a multi message
    is.multi = convert.isMulti(raw.name);

    // proxy or pure pin
    is.proxy = this.node.is.group;

    // set the y-position to zero - widget will be placed correctly
    const newPin = this.addPin(raw.name, 0, is);

    // recover the wid
    newPin.wid = raw.editor.id;

    // check for an interface name prefix
    newPin.ifNamePrefixCheck();

    // check the width ...
    this.adjustPinWidth(newPin);

    // done
    return newPin
},

cookInterface(raw) {

    // If the interface has no name ther is no interface widget
    if (raw.name.length == 0) return null

    // add the interface name
    const newInterface = this.addIfName(raw.name, null);

    // set the wid
    newInterface.wid = raw.editor?.id || 0;

    // done
    return newInterface
},

};

//import {Route} from './index.js'

// the look node determines how a node looks... 
function Look (rect) {

    this.rect = {...rect};
    this.rect.w = rect.w > 0 ? rect.w : style$1.look.wBox;
    this.rect.h = rect.h > 0 ? rect.h : style$1.look.hTop + style$1.look.hBottom;

    // the node for which this look is created
    this.node = null;

    // note that a widget id is never 0 !
    this.widGenerator = 0;

    // the list of node widgets
    this.widgets = [];
}

// the functions for the action node prototype
Look.prototype = {

    render(ctx) {

        // draw the widgets
        this.widgets?.forEach( widget => widget.render(ctx, this) );
    },

    remove(){},

    // get the min width required for the widgets (= max width widgets !)
    getMinWidth() {

        let minWidth = style$1.look.wBox;
        for(const widget of this.widgets) {
            if ( widget.is.pin  && (widget.rect.w > minWidth)) minWidth = widget.rect.w;
        }
        return minWidth
    },

    // change the width of the look and reposition the widgets as required - delta can be pos or neg
    changeWidth(delta) {

        // set the new rect width
        this.rect.w += delta;

        // now we have to adjust the position of the widgets
        this.widgets.forEach( widget => {
            // only the pins at the right move
            if ((widget.is.pin)&&(!widget.is.left)) {

                // move the x position
                widget.rect.x += delta;

                // also adjust the routes
                widget.adjustRoutes();
            }
            else if (widget.is.header || widget.is.ifName || widget.is.box) 
                widget.rect.w += delta;
            else if (widget.is.icon) 
                // shift the icons that are on the right
                if (widget.rect.x > this.rect.x + (this.rect.w - delta)/2) widget.rect.x += delta;
        });
    },

    // if the name of the widget has changed see if it fits and adjust widget and look if necessary
    adjustPinWidth(widget) {

        // Get the new width
        const newWidth = style$1.pin.wMargin + this.getTextWidth(widget.withoutPrefix(), widget.is.multi);

        // move the x of the widgets if at the right
        if ( ! widget.is.left) widget.rect.x += (widget.rect.w - newWidth);

        // adjust the with
        widget.rect.w = newWidth;

        // check width of the look
        if (widget.rect.w > this.rect.w) this.wider(widget.rect.w - this.rect.w);
    },

    getTextWidth(str, multi=false) {

        // get the canvas context
        const ctx = editor.getCanvasContext();

        if (!multi) return ctx.measureText(str).width
        
        // cut the text in three parts 
        const [pre, middle, post] = convert.getPreMiddlePost(str);

        // measure pre and post
        let width = ctx.measureText(pre + '[').width + ctx.measureText(']'+ post).width;

        // change font
        const savedFont = ctx.font;
        ctx.font = style$1.pin.fMulti;

        // measure the multi text
        width += ctx.measureText(middle).width;

        // restore the font
        ctx.font = savedFont;

        // done
        return width
    },

    wider(delta=0) {

        // not wider than the max value
        if (this.rect.w >= style$1.look.wMax) return

        // multiples of style.look.wExtra
        delta = delta > 0 ? Math.ceil( delta / style$1.look.wExtra)*style$1.look.wExtra : style$1.look.wExtra;

        // not wider then max width
        if (this.rect.w + delta > style$1.look.wMax) delta = style$1.look.wMax - this.rect.w;

        // adjust
        this.changeWidth( delta );   
    },

    smaller(delta=0) {

        const minWidth = this.getMinWidth();

        // not smaller then the min width
        if (this.rect.w <= minWidth) return

        // multiples of style.look.wExtra
        delta = delta > 0 ? (1 + Math.floor( delta / style$1.look.wExtra))*style$1.look.wExtra : style$1.look.wExtra;

        // not smaller then the min width
        if (this.rect.w - delta < minWidth) delta = this.rect.w - minWidth;
        
        // adjust
        this.changeWidth( -delta );
    },

    // add the basic widgets to a look
    decorate(node) {

        // the node for which this look is created (do this first)
        this.node = node;

        // add a box
        this.addBox();

        // and a title
        this.addHeader();

        // add icons
        this.addIcon('cog');
        node.is.source ? this.addIcon('factory') : this.addIcon('group');
        this.addIcon('pulse');
        this.addIcon('comment');        
    }
};
Object.assign(  Look.prototype, 
                widgetHandling, 
                widgetLifecycle,
                interfaceHandling, 
                iconHandling, 
                moveHandling, 
                copyHandling,
                jsonHandling$2);

// The node in a nodegraph
function Node (look=null, name=null, uid=null) {

    // unique identifier for the node
    this.uid = uid;

    // name of the node - can be changed - not unique
    this.name = name;

    // state
    this.is = {
        group: false,
        source: false,
        highLighted: false,
        placed: true,
        duplicate: false
    };

    // if the node is linked to another node
    this.link = null;

    // the graphical representation of the node
    this.look = look;

    // a node can have settings - settings are passed as is to the new node
    this.sx = null;

    // a node can have dynamics - dynamics are passed to the runtime - (to be changed to some fixed format probably)
    this.dx = null;

    // comment is an optional text field for the node
    this.prompt = null;
}
// common functions
Node.prototype = {

    // render the look of the node
    render(ctx){
        
        // switch to the link style - will return the current style
        const savedStyle = this.link?.model ? style$1.switch(this.link.model.header.style) : null;

        // render the node
        this.look?.render(ctx);

        // reset the style
        if (savedStyle) style$1.switch(savedStyle);
    },

    // recursively find a node with a given uid
    findByName(name) {

        if (this.name == name) return this
        if (this.nodes) {
            let found = null;
            for (const node of this.nodes) if (found = node.findByName(name)) return found
        }
        return null
    },

    // recursively find a node with a given uid
    findByName(name) {

        if (this.name == name) return this
        if (this.nodes) {
            let found = null;
            for (const node of this.nodes) if (found = node.findByName(name)) return found
        }
        return null
    },

    // // recursively find a node with a given uid
    // findByUID(uid) {

    //     if (this.uid == uid) return this
    //     if (this.nodes) {
    //         let found = null
    //         for (const node of this.nodes) if (found = node.findByUID(uid)) return found
    //     }
    //     return null
    // },

    // find the parent of a node starting from this node
    findParent(nodeToFind) {
        let parent = this;
        if (this.nodes) {
            
            // check if the node is in the nodes list
            for (const node of this.nodes) if (node == nodeToFind) return parent

            // no ... check the nodes
            for (const node of this.nodes) {
                if (node.is.group && (parent = node.findParent(nodeToFind))) return parent
            }
        }
        return null       
    },

    // The name here has not been changed by the user ! (see header for that)
    updateName(newName) {

        // check
        if (!newName || (newName === this.name)) return

        // change the name of the node
        this.name = newName;

        // and change the header
        for( const widget of this.look.widgets) {

            if (widget.is.header) {
                widget.title = newName;
                break
            }
        }
    },

    // returns node, widget, route, segment
    hitTest(pos) {

        // notation
        const {x,y,w,h} = this.look.rect;
        const dx = style$1.pin.wOutside;

        // check if we have hit the look
        if ((( pos.x < x - dx)||(pos.x > x + w + dx)||(pos.y < y )||(pos.y > y+h))) return [zap.nothing,null, null]

        // we check all widgets and return the most precise match - 
        for(const widget of this.look.widgets) {

            // notation
            const rc = widget.rect;

            // skip the box
            if (widget.is.box) continue

            // check if in the rectangle
            if (( pos.y < rc.y )||( pos.y > rc.y + rc.h )||( pos.x < rc.x )||( pos.x > rc.x + rc.w )) continue

            // if we have hit the header, but not the title, continue
            if (widget.is.header && ! widget.hitTitle(pos)) continue

            // determine what has been hit 
            const what =    widget == null ? zap.node :
                            widget.is.pin ? zap.pin :
                            widget.is.ifName ? zap.ifName :
                            widget.is.icon ? zap.icon :
                            widget.is.header ? zap.header :
                            widget.is.label ? zap.label :
                            zap.node;

            //we have hit something
            return [ what, this, widget]
        }

        // done
        return [zap.node,this, null]
    },

    hitRoute(pos) {

        // check if we have hit a route
        let segment = 0;
        for(const widget of this.look.widgets) {

            // only pins with routes !
            if (widget.is.pin && widget.routes.length > 0) {

                // go through all the routes..
                for (const route of widget.routes) {

                    // only routes starting from the widget 
                    if ((route.from == widget)&&(segment = route.hitSegment(pos))) return [zap.route, route, segment]
                }
            }
        }

        // nope
        return [zap.nothing, null, 0]
    },

    overlap(rect) {
        const rc = this.look.rect;

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    // returns true if the node is a container node (has no outside connections)
    isContainer() {
        return this.is.group && (this.pads.length == 0)
    },

    // checks if the node is compatible with this node
    compatible( node ) {

        // check that the nodes are compatible, ie are both group nodes or source nodes
        return ( (node.is.group && this.is.group) || (node.is.source && this.is.source) ) 
    },

    // cooks the elements that are common to group and source nodes
    cookCommon(raw) {

        // If there is no editor part, add the skeleton
        if (!raw.editor) raw.editor = {rect: null};

        // the rectangle as specified in the file - if any
        const rc = raw.editor.rect ? convert.stringToRect(raw.editor.rect) : {x:0, y:0, w:0, h:0};

        // set the place bit
        this.is.placed = raw.editor.rect ? true : false;

        // create a new look
        this.look = new Look(rc);
        
        // set the minimum height of the look
        this.look.rect.h = style$1.look.hTop + style$1.look.hBottom;

        // add the basic decoration
        this.look.decorate(this);

        // and cook the saved widgets of the look
        this.look.cook(raw);

        // check the width again - reset the width if it was not zero to start with..
        if (rc.w > 0 && this.look.rect.w > rc.w) this.look.smaller(this.look.rect.w - rc.w);
    
        // check if the node has a comment
        if (raw.prompt) this.prompt = raw.prompt;

        // check if the node has settings
        if (raw.sx) this.sx = raw.sx;

        // check if the node has dynamics
        if (raw.dx) this.dx = raw.dx;
    },

    // used for nodes that have been copied
    uidChangeAll(UID) {

        // make a new uid
        UID.generate(this);

        // for a source node we're done
        if (this.is.source) return

        for(const pad of this.pads) UID.generate(pad);
        for(const bus of this.buses) UID.generate(bus);
        for(const node of this.nodes) node.uidChangeAll(UID);
    },

    // used for nodes that have been imported
    // A group node that is linked must get new UIDS for the objects that were imported
    // The linked nodes inside will have been given new UIDS already - so we skip these !
    uidChangeImported(UID) {

        // change the UIDS in the linked node
        for(const pad of this.pads) UID.generate(pad);
        for(const bus of this.buses) UID.generate(bus);

        // change also for nodes that are not links
        for(const node of this.nodes) if (!node.link) {
            UID.generate(node);
            if (node.is.group) node.uidChangeImported(UID);
        }
    },

    // generates new uids for all nodes, pads and busses
    setUIDS(UID) {

        UID.generate(this);

        if (this.is.source) return

        // generate the UIDS for buses and pads
        for(const pad of this.pads) UID.generate(pad);
        for(const bus of this.buses) UID.generate(bus);
    },


    // get all the source nodes that use a particular factory
    usesFactory(fName, fNodes) {

        this.is.group   ? this.nodes.forEach( node => node.usesFactory(fName, fNodes))
                        : (this.factory?.name == fName) ? fNodes.push(this) 
                        : null;
    },

    // move the node over dxy
    move(delta) {

        this.look.moveDelta(delta.x, delta.y);
        this.look.adjustRoutes();
    },

    doSelect() {

        for (const widget of this.look.widgets) {
            if (widget.is.box) {
                widget.is.selected = true;
                return
            }
        }
    },

    unSelect() {

        for (const widget of this.look.widgets) {
            if (widget.is.box) {
                widget.is.selected = false;
                return
            }
        }
    },

    // avoid that a new node is copied on top of the original
    samePosition(newNode) {

        return ((this.look.rect.x == newNode.look.rect.x) && (this.look.rect.y == newNode.look.rect.y)) 
    },

    // will highlight the link symbol for about a second if the node has a link and cannot be modified
    cannotBeModified() {

        // if the node has no link it can be modified
        if (this.link == null) return false

        // show a blinking link icon
        this.look.blinkToWarn();

        // cannot be modified !
        return true
    },

    // changes the type of node from group to source or vice-versa
    // also transfers the routes from the one to the other
    switchNodeType() {

        // make a new node of a different type
        const newNode = this.is.group ? this.copyAsSourceNode() : this.copyAsGroupNode();

        // swap the nodes and transfer the routes
        this.look.transferRoutes(newNode.look);

        // return the new node
        return newNode
    },

};

Object.assign(  Node.prototype, 
                collectHandling, 
                linkHandling,
                routeHandling, 
                compareHandling,
                rxtxHandling$1, 
                nodeClickHandling);

const jsonHandling$1 = {

    toJSON() {

        // separate function for links
        if (this.link) return this.dockToJSON()

        // get the items to save
        const {rect, label, interfaces} = this.look ? this.look.getItemsToSave() : {rect: null, label: null, interfaces: []};

        // The json structure to save
        const json = { kind: "group", name: this.name}; 

        // add if present
        if (label) json.label = label;
        if (interfaces.length) json.interfaces = interfaces;
        if (this.sx) json.sx = this.sx;    
        if (this.dx) json.dx = this.dx;
        if (this.prompt) json.prompt = this.prompt;
        if (this.nodes.length) json.nodes = this.nodes;

        // get the routes inside this group node
        const [routes, conx] = this.getRoutesAndConnections();

        // set the connections 
        if (conx.length) json.connections = conx;

        // add the editor specific fields: rect, view, buses, routes
        json.editor = {rect: convert.rectToString(rect)};

        // add the view
        if (this.savedView) json.editor.view = convert.viewToJSON(this.savedView);

        // the buses
        if (this.buses.length) json.editor.buses = this.buses;

        // save the routes
        if (routes.length) json.editor.routes = routes;
    
        // done
        return json
    },

    dockToJSON() {

        // get the elements to save
        const {rect, label, interfaces} = this.look ? this.look.getItemsToSave() : {rect: null, label: null, interfaces: []};

        const json = { kind: "dock", name: this.name, link: this.link }; 

        // add if present
        if (label) json.label = label;
        if (this.prompt) json.prompt = this.prompt;
        if (interfaces.length) json.interfaces = interfaces;
        if (this.sx) json.sx = this.sx;    
        if (this.dx) json.dx = this.dx;

        // add the editor specific fields
        json.editor = { rect: convert.rectToString(rect) };

        // done
        return json
    },

    // cook the content of the node (nodes, buses, pads and routes)
    cook(raw, modcom) {

        // cook the common parts
        this.cookCommon(raw);

        // if there is a view - make a simple view for the node only rect and tf - the view is restored later 
        if (raw.editor.view) this.savedView = convert.stringToView(raw.editor.view);

        // handle the subnodes
        if (raw.nodes) for(const rawNode of raw.nodes) {

            // get the node : it can be a link or a local node
            const node = rawNode.link ? modcom.linkedNode(rawNode) : modcom.localNode(rawNode);

            // save if successful
            if (node) this.nodes.push(node);

            // if the node has not been properly placed, do it now
            if (!node.is.placed) this.placeNode(node);
        }

        // cook the connections inside this group node - retuns an array of {from, to, status} - from/to are pins or pads
        const conx = raw.connections ? this.cookConx(raw.connections) : [];
     
        // get the buses
        if (raw.editor.buses) for(const rawBus of raw.editor.buses) {

            // the name is also used for the bus labels !
            const bus = new Bus(rawBus.name, {x:0, y:0});

            // cook it 
            bus.cook(rawBus, modcom);

            // save it
            this.buses.push(bus);
        }

        // temp storage for the routes
        const routes = [];

        // now cook the routes...
        if (raw.editor.routes) for(const rawRoute of raw.editor.routes) {

            // cook the route
            const route = this.cookRoute(rawRoute);
            if (route) routes.push(route);
        }

        // The routes that were not found in the connections have been marked - we have to add routes for new connections now
        if (conx) {

            // and check the route against the connections - the status of the conx and route is adapted
            for (const route of routes) this.findRouteInConx(route, conx);

            // create the routes for the connections that were not foudn
            this.createRoutes(conx);
        }
    },

    // Place the node as the root node in a view
    placeRoot() {
        // The root is not a container - make some extra margins
        const place = style$1.placement;

        // move the node to its location
        this.look.moveTo( place.marginLeft , place.marginTop);

        // set the flag
        this.is.placed = true;
    },

    // places a node according to a grid
    // ideally we take into account the placement of the other nodes !
    placeNode(node) {

        const place = style$1.placement;
        const index = this.nodes.length - 1;

        // find row and column 
        const col = index % place.nodesPerRow;
        const row = Math.floor(index / place.nodesPerRow);

        // check if we need extra space for the pads
        const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft;

        // move the node to its location
        node.look.moveTo( marginLeft + col * place.colStep, place.marginTop  + row * place.rowStep);

        // set the flag
        node.is.placed = true;
    },

    // rawPad exists, but might be incomplete
    cookPad(proxy, rawPad) {

        // get the rect
        let rect = rawPad.rect ? convert.stringToRect(rawPad.rect) : {x:10,y:10,w:0,h:0};

        // if no width is given, calculate
        if (rect.w == 0) rect = proxy.makePadRect({x: rect.x, y:rect.y});

        // create a new pad
        const newPad = new Pad(rect, proxy, null);

        // set the direction of the text
        newPad.is.leftText = rawPad.align == "left" ? true : false;

        // save the pad in the proxy
        proxy.pad = newPad;

        // and push the pad on the pads array
        this.pads.push(newPad);
    },

    cookRoute(rawRoute) {

        const source = convert.rawToEndPoint(rawRoute.from);
        const target = convert.rawToEndPoint(rawRoute.to);

        // check
        if (!source || !target) return null;
        
        // find the actual widgets at both ends of the route (pin pad or bus)
        let [from, to] = this.getEndPoints(source, target);

        //check for errors - It can be that from/to are not found if the pin name for a linked node has changed
        if (!from || !to) {
            if (!from) console.error(`invalid route *FROM* ${rawRoute.from} to ${rawRoute.to}`);
            if (!to) console.error(`invalid route from ${rawRoute.from} *TO* ${rawRoute.to}`);
            return null;
        }

        // if the endpoint is a bus, make a tack
        if (from.is.bus) from = from.newTack();
        if (to.is.bus) to = to.newTack();

        // create the route
        const route = new Route(from, to);

        // get the wire (for bustacks the center will be null, but that is not a problem)
        route.wire = convert.stringToWire(from.center(), to.center(), rawRoute.wire);

        // check if we have a route - otherwise make a route
        if (route.wire.length < 2) route.autoRoute(this.nodes);

        // save the routes for pins and pads
        from.is.tack ? from.setRoute(route) : from.routes.push(route);
        to.is.tack ? to.setRoute(route) : to.routes.push(route);

        // set the route as twisted pair if required (multi wire)
        route.checkTwistedPair();

        // this is required if a linked node has changed (eg more pins or pins have moved...)
        route.adjust();

        // done
        return route
    },

    // get the widget for the endpoint
    getEndPoints(source, target) {

        // -------- helpers
        const findPin = (endPoint, input) => {
            for(const node of this.nodes) {

                // check the node name first
                if (node.name != endPoint.node) continue

                // try to find by name or by wid (name could have changed !)
                let pin = node.look.widgets.find( widget => widget.is.pin && (widget.is.input == input) && (widget.name === endPoint.pin) );
                if (!pin) node.look.widgets.find( widget => widget.is.pin && (widget.is.input == input) && (widget.wid === endPoint.wid) );

                // done
                return pin
            }             
        };

        const findPad = (endPoint, input) => {

            // find by name or wid
            let pad = this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.name === endPoint.pad) );
            if (!pad) this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.wid === endPoint.wid) );

            // done
            return pad
        };

        const findBus = (raw) => this.buses.find( bus => bus.name === raw.bus);
        // ---------

        let from = null, to = null;

        if (source.pin) {

            from = findPin(source, false);
            to = target.pin ? findPin(target, true) : target.pad ? findPad(target,false) : target.bus ? findBus(target) : null;
        }
        else if (source.pad) {

            from = target.pin ? findPad(source,true) : target.bus ? findPad(source,false) : null;
            to =   target.pin ? findPin(target, true)  : target.bus ? findBus(target) : null;
        }
        else if (source.bus) {

            from = findBus(source);
            to = target.pin ? findPin(target,true) : target.pad ? findPad(target, true) : null;
        }

        return [from, to]
    },

    // the node is fused with a another group node - note that the other node is already a copy !
    fuse( otherNode ) {

        // check for added /deleted widgets
        this.widgetCompare( otherNode );

        // fuse the settings
        this.sxUpdate(otherNode);

        // take the nodes from the linked node
        this.nodes = otherNode.nodes;

        // take the buses
        this.buses = otherNode.buses;

        // take the pads
        this.pads = otherNode.pads;

        // the pads must correspond to the proxies of this node
        this.reConnectPads();
    },

    // for an imported groupnode the pads have to be reconnected to the proxies of the look in the importing file
    reConnectPads() {

        // for all the pads
        this.pads.forEach( pad => {

            // find the input or output pin for this node...
            const proxy = this.look.findPin(pad.proxy.name, pad.proxy.is.input);

            // should absolutely not happen
            if (!proxy) return console.log(`*** ERROR *** node ${this.name} has no proxy for pad  ${pad.proxy.name}`)

            // set the proxy
            pad.proxy = proxy;

            // and also set the pad in the proxy
            proxy.pad = pad;
        });
    },

    // // check that each pin has a pad - no more no less
    // checkPadProxyPairs() {

    //     for (const pin of this.look.widgets) {

    //         // only check proxies
    //         if (!pin.is.proxy) continue

    //         // find the corresponding pad
    //         const pad = this.pads.find( pad => pad.proxy == pin)

    //         // ok - continue
    //         if (pad) continue

    //         // create a new pad
    //         this.addPad(pin)
    //     }
    // }
};

const proxyHandling = {

    // build the proxy widget array based on the current (outside) connections and proxy indicators
    // Note that the selection nodes have already been added to the group node 
    addProxies(selection) {

        const outside = [];

        // for each node in the list ...
        selection.nodes?.forEach( node => {

            // ..for each widget
            node.look.widgets?.forEach( widget => {

                // if there are no connections stop
                if ( ! widget.routes?.length > 0) return

                // connections to the outside of the widget
                const destinations = [];

                // make a copy of the routes - because we are deleting in the original array below !
                const routesCopy = widget.routes.slice();

                // .. check all the routes
                routesCopy.forEach( route => {

                    // is the widget external could be external to the group
                    const other = route.from == widget ? route.to : route.from;

                    // check if it the route goes to an external node - if not return
                    if ( other.is.pin && ( selection.nodes.includes(other.node))) return 

                    // check if the external goes to an external bus
                    if ((other.is.tack) && ( selection.tacks.includes(other))) return

                    // add the new proxy
                    destinations.push(other);

                    // also remove the route at both endpoints - The route to the proxy widget is added below
                    route.from.removeRoute(route);
                    route.to.removeRoute(route);
                });

                //check
                if (destinations.length > 0) outside.push({widget, destinations});
            });
        });

        // sort the array in y -order to position the proxies in the same order as the originals
        outside.sort( (a,b) => {
            return    a.widget.rect.y > b.widget.rect.y ? 1 
                    : a.widget.rect.y < b.widget.rect.y ? -1
                    : 0
        });

        // and now add a proxy widget for each proxy/pin with and external connection
        outside.forEach( outsider => {

            // notation
            const orig = outsider.widget;

            // copy the 'outsider' as a proxy
            const newProxy = this.copyPinAsProxy(orig);

            // create the pad
            this.addPad(newProxy);

            // make a straight line - move to the the y-coordinate of the pin
            newProxy.pad.moveTo(newProxy.pad.rect.x, orig.rect.y);

            // make a route to the pin
            newProxy.pad.routeToPin(orig);

            // also add a route to the destinations in the view that contains the group
            let route = null;
            outsider.destinations.forEach( destination => {

                // create a new route
                route = new Route(newProxy, destination);

                // make a smart connection between the two destinations
                route.builder();

                // and save the route in the new proxy...
                newProxy.routes.push(route);

                // and in the destination widget
                if (destination.is.pin)  
                        destination.routes.push(route);

                // reset the route in the tack and re-attach to the bus
                else if (destination.is.tack) 
                    destination.restore(route);
            });
        });
    },    


    // used when making a group from a selected nr of nodes
    // copy a pin as a proxy for a new node - also make a ifName if required
    // is = {channel, input, request, proxy}
    copyPinAsProxy(pin) {

        const look = this.look;
        let pos = null;

        // for a node with a prefix
        if (pin.pxlen != 0) {

            // get the prefix
            const prefix = pin.getPrefix();

            // find the ifName
            let ifName = look.findInterfaceName(prefix);

            // add the ifName if not present
            if(!ifName) ifName = this.look.addIfName(prefix, look.nextPinPosition(false));

            // get the rectangle of the last pin in the ifName group
            const last = look.getInterface(ifName).at(-1).rect;

            // when we add we want to add below last item - set x according to left / right
            pos = { x: pin.is.left ? last.x : last.x + last.w, 
                    y: last.y + last.h};
        }
        else {
            pos = look.nextPinPosition(pin.is.left);
        }

        // get the rectangle for the pin
        const rc = look.pinRectangle(pin.displayName(), pos.y, pin.is.left);

        // create the pin
        const widget = new Proxy(rc, this, pin.name.slice(), pin.is);

        // copy the pxlen
        widget.pxlen = pin.pxlen;

        // add the widget
        look.addWidget( widget );

        // done
        return widget
    },

    addPad(proxy) {

        // the y position of the pad
        const yOffset = style$1.placement.marginTop + this.pads.length * (style$1.pad.hPad + style$1.pad.hSpace);
 
        // get the width of the view or use a default value..
        const width = this.savedView ? this.savedView.rect.w : style$1.view.wDefault;

        // take the position of the view into account
        const dx = this.savedView ? this.savedView.rect.x : 0;

        // get the pad rectangle
        const rect = proxy.is.left  ? proxy.makePadRect({x: style$1.pad.wViewLeft + dx, y: yOffset})
                                    : proxy.makePadRect({x: width - style$1.pad.wViewRight + dx, y: yOffset});
 
        // create the pad
        const pad = new Pad(rect, proxy);

        // add a new UID to the pad (when loading a file the doc has not been set yet !)
        editor.doc?.UID.generate(pad);
 
        // save
        this.pads.push(pad);     
 
        // save also in the proxy
        proxy.pad = pad;
    },

    // removes a pad from the pad array
    removePad(pad) {
        eject(this.pads, pad);    
    },

    restorePad(pad) {
        //this.look.restorePin(pad.proxy)
        this.pads.push(pad);
    },

    // add pads for a list of widgets
    addPads(widgets) {
        for(const widget of widgets) if (widget.is.proxy) this.addPad(widget);
    },

    addBus(name, pos, uid=null) {

        //we create a bus
        const bus = new Bus(name ?? '',pos, uid);

        // save it
        this.buses.push(bus);

        // done
        return bus
    },

    deleteBus(bus) {

        // first disconnect every connection to the bus
        bus.disconnect();

        // remove the bus
        this.removeBus(bus);
    },

    // removes a bus from the bus array
    removeBus(bus) {

        eject(this.buses, bus);		        
    },

    // restores a bus
    restoreBus(bus) {

        // a bus can be in the list already
        if (this.buses.find( bp => bp.uid == bus.uid)) return

        // put in the list again
        this.buses.push(bus);
    }
};

const conxHandling = {

    // message flow is src dst
    addConnection(src, dst, conx) {

        // helper function
        const makeAddress = (A) => A.is.pin ? {pin: A.name, node: A.node.name} : A.is.pad ? {pin: A.proxy.name} : {pin: '?', node: '?'};

        // simple case - no a tack (pin or pad)
        if ( ! dst.is.tack) {
            // save 
            conx.push({src: makeAddress(src), dst: makeAddress(dst)});  

            // done
            return
        }

        // If the destination is a bus we have to find the actual connected pins and pads
        const bus = dst.bus;
        const fanout = [];

        // check the connections to the bus
        for(const tack of bus.tacks) {

            // skip the to tack
            if (tack == dst) continue

            // Take the widget at the other end of the route
            const other = tack.route.from == tack ? tack.route.to : tack.route.from;

            // check if the two are connected (i/o, name)
            if (bus.areConnected(src, other)) fanout.push(other);
        }           

        // save all the destinations from the bus that were found
        for(const busDst of fanout) {

            // save 
            conx.push({src: makeAddress(src), dst: makeAddress(busDst)});
        }
    },

    getRoutesAndConnections() {

        const routes = [];
        const conx = [];

        // get all the routes from the output pins of all the nodes
        for(const node of this.nodes) {

            // sav all the routes of output pins
            for(const pin of node.look.widgets) {

                // only output pins
                if (! pin.is.pin || pin.is.input) continue

                // look at all routes
                for(const route of pin.routes) {

                    // store the route for that pin
                    routes.push(convert.routeToString(route));

                    // get the destination (it can be null for half-routes !)
                    const other = route.from == pin ? route.to : route.from;

                    // add the connection also
                    this.addConnection(pin, other, conx);
                }
            }
        }

        // get all the routes from the incoming pads to input pins or buses
        for(const pad of this.pads) {

            // outgoing pads have been covered in pins and busses...
            if ( ! pad.proxy.is.input) continue
                
            // convert each route.. 
            for(const route of pad.routes) {

                // push the route string
                routes.push(convert.routeToString(route));

                // get the destination (it can be null for half-routes !)
                const other = route.from == pad ? route.to : route.from;

                // add the connection
                this.addConnection(pad,other, conx);
            }
        }        

        // What remains are the routes from the bus to incoming pins and from the bus to the outgoing pads
        // Note that routes from a bus are **not** added to the connections array !!
        for(const bus of this.buses) {

            // convert each tack
            for(const tack of bus.tacks) {

                const other = tack.getOther();
                if (other.is.pin && other.is.input) routes.push(convert.routeToString(tack.route));
                if (other.is.pad && !other.proxy.is.input) routes.push(convert.routeToString(tack.route));
            }
        }

        return [routes, conx]
    },

    // when we are getting the connections the pins and the pads have been added to the group node, but not the buses and the routes
    cookConx(rawConx) {

        //-------- helpers -----------
        const resolvePin = (raw) => {
            for(const node of this.nodes) {
                if (node.name != raw.node) continue
                return node.look.widgets.find( widget => widget.is.pin && (widget.name === raw.pin) )
            }            
        };

        const resolvePad = (raw) => this.pads.find( pad => (pad.proxy.name === raw.pin) );

        const showError = (error, raw) => {

                const sFrom = `${raw.from?.pin} ${raw.from?.node ? ' @ ' + raw.from?.node : '(pad)'}`;
                const sTo = `${raw.to?.pin} ${raw.to?.node ? ' @ ' + raw.to?.node : '(pad)'}`;
                console.error(error + sFrom + ' -> ' + sTo);
        };

        const ioMismatch = (from, to) => {

            // for pins i/o should be different
            return  (from.is.pin && to.is.pin) ? (from.is.input == to.is.input) : 
                    (from.is.pin && to.is.pad) ? ( from.is.input != to.proxy.is.input) :
                    (from.is.pad && to.is.pin) ? ( from.proxy.is.input != to.is.input) :
                    (from.is.pad && to.is.pad) ? true : true;
        };

        // An input pin with a channel (reply) can only be connected to an output pin with a channel (request)
        const rqrpMismatch = (from, to) => {

            const A = from.is.pin ? from : from.proxy;
            const B = to.is.pin ? to : to.proxy;

            if (A.is.input && A.is.channel ) {
                return (A.is.channel != B.is.channel)
            }
            if (B.is.input && B.is.channel ) {
                return (A.is.channel != B.is.channel)
            }
        };
        //------------------------------

        const conx = [];

        let src = null, dst = null;
        for (const raw of rawConx) {

            // *** CHANGE THIS TO ONLY SRC DST *** //
            const rawsrc = raw.from ?? raw.src;
            const rawdst = raw.to ?? raw.dst;

            if (!rawsrc || !rawdst) continue

            // find from and to and give an error message if not found
            src = rawsrc.node ? resolvePin(rawsrc) : resolvePad(rawsrc);
            if (!src) showError('Connection <from> not found: ', raw);

            dst = rawdst.node ? resolvePin(rawdst) : resolvePad(rawdst);
            if (!dst) showError('Connection <to> not found: ', raw);

            // check
            if (!src || !dst) continue;

            // check i/o mismatch
            if (ioMismatch(src, dst)) {
                showError('Input/output mismatch: ', raw);
                continue;
            }

            // check rq/rp mismatch
            if (rqrpMismatch(src, dst)) {
                showError('request/reply mismatch: ', raw);
                continue;
            }

            // add to the array
            conx.push({src, dst, is: {new:true}});
        }
        return conx
    },

    // a route should have a counterpart in the connections - otherwise it is set to be removed
    findRouteInConx(route, conx) {

        // helper functions -----------------------------------
        const findConx = (A, B) => conx.find( cx => ((A == cx.src) && (B == cx.dst)) || ((A == cx.dst) && (B == cx.src)) );
        //const findConx = (A, B) => conx.find( cx => ((A == cx.src) && (B == cx.dst)) )

        const checkBus = (bus, src, via) => {

            // check for the connections to the bus..
            for(const tack of bus.tacks) {

                // skip this tack of the route...
                if (tack == via) continue

                // get the other side of the route
                const dst = tack.getOther();

                // check if logically conneceted via this bus (i/o and name must match...)
                if (bus.areConnected(src, dst)) {

                    // check if we find this connection in conx
                    const cx = findConx(src, dst);

                    // if the connection is found set the connection status, if not set the route status
                    if (cx) 
                        cx.is.new = false;
                    else 
                        tack.route.is.noConx = true;
                }
            }
        };
        // ---------------------------------------------------

        const [src, dst] = route.messageFlow();

        // if there are no connections the route is new
        if ( conx.length == 0) {

            // we always accept routes to buses 
            route.is.noConx = dst.is.tack ? false : true;
            return
        }

             
        // check the routes 
        if (src.is.tack){

            // we accept routes that come from a bus...
            route.is.noConx = false;
        }
        // pin or pad
        else {
            // other end goes to a bus
            if (dst.is.tack) {

                // The bus that the tack is connected to
                checkBus(dst.bus, src, dst);
            }
            // pin or pad
            else {

                // find the connection in the conx array - the order can be different
                const cx = findConx(src, dst);

                // if the connection is found set the connection status, if not set the route status
                cx ? (cx.is.new = false) : (route.is.noConx = true);
            }
        }
    },

    createRoutes(conx) {

        // check
        if (! conx?.length) return

        // add a routes for each new connection
        for(const cx of conx) {

            if (!cx.is.new) continue

            // create a new route
            const route = new Route(cx.src, cx.dst);
            
            // make a smart connection between the two destinations
            route.autoRoute(this.nodes);

            // The route is for a new connection
            route.is.newConx = true;
            
            // and save the route in the endpoints
            route.from.routes.push(route);
            route.to.routes.push(route);
        }
    }
};

// default name
const defaultGroupNodeName = "group";

// A node that groups other nodes
function GroupNode (look=null, name=defaultGroupNodeName, uid=null) {

    // constructor chaining
    Node.call(this,look,name,uid);

    // state
    this.is.group = true;
    
    // the nodes that are part of this group
    this.nodes = [];

    // the buses that are part of this group
    this.buses = [];

    // inside a group node there is a pad for every outside connection
    this.pads = [];

    // we save the view for the group after closing here
    this.savedView = null;

    // add the title and the icons..
    if (look) look.decorate(this);
}

// implementations for group nodes
const groupFunctions = {

    // // set these functions to the actual render function required
    // render(ctx){
    //     this.look?.render(ctx) 
    // },

    addNode(newNode) {
        this.nodes.push(newNode);
    },

    // removes a node (not recursive) - we don not touch the connections here - so disconnect first if neccessary !
    removeNode(nodeToRemove) {

        eject(this.nodes, nodeToRemove);
    },

    // restore node is the same as addNode (for now ?)
    restoreNode(node) {
        this.nodes.push(node);
    },

    findNode(lName) {

        // split and reverse
        const parts = convert.splitLink(lName); // name @ group1 @ group2 => now: ['group2', 'group1', 'name']

        // if there is just one name (no group names)
        if (parts.length == 1) return this.findRecursive(lName)  
            
        // we use the group names
        let search = this;

        for (const name of parts) {
            search = search.nodes?.find(n => name === n.name) || null;
            if (!search) return null;
        }

        return search;        
    },

    // find a node of a given name recursively
    findRecursive(search) {

        // search based on the name or the uid
        for (const node of this.nodes) if (node.name == search) return node

        // for the node to search
        let found = null;

        // now look in the subnodes for each node
        for (const node of this.nodes) {

            // check if the node is a group node
            if ((node.is.group) && (found = node.findRecursive(search))) return found
        }

        // nope
        return null
    },

    hasDuplicate(nodeToCheck) {

        for (const node of this.nodes) {
            if (node == nodeToCheck) continue
            if (node.name === nodeToCheck.name) return true
        }
        return false
    },

    checkDuplicates(nodeToCheck) {

        nodeToCheck.is.duplicate = false;

        for (const node of this.nodes) {

            // skip the node itself
            if (node == nodeToCheck) continue

            // if the node was a duplicate, check it again
            if (node.is.duplicate) node.is.duplicate = this.hasDuplicate(node);

            // new duplicate
            if (node.name === nodeToCheck.name) nodeToCheck.is.duplicate = node.is.duplicate = true;
        }
    },

    // replaces a node with another node - just replace nothing else (connections, position etc etc)
    // also not recursive - only the nodes array is searched 
    swap(original, replacement) {

        // search
        for (let i=0; i<this.nodes.length; i++) {

            if (this.nodes[i] == original) {

                // found
                this.nodes[i] = replacement; 

                // done
                return true
            }
        }

        // now look in the subnodes for each node
        for (const node of this.nodes) {

            // check if the node is a group node
            if ((node.is.group) && (node.swap(original, replacement))) return true
        }
        return false
    },

    // make a copy of a group node
    copy() {

        // make a new node - without the look !
        const newNode = new GroupNode(null, this.name, this.uid);

        // if the node has a link copy that too
        newNode.link = this.link ? this.link.copy() : null;

        // now create an empty look
        newNode.look = new Look(this.look.rect);

        // copy the look from this node to the newNode
        this.look.copy(newNode);

        // copy the comment
        newNode.prompt = this.prompt ? this.prompt.slice() : null;

        // copy the settings
        newNode.sx = this.sx ? jsonDeepCopy(this.sx) : null;

        // copy the nodes that are part of this node
        this.nodes?.forEach( node => {

            // make a copy of the node - also copies the widgets
            const copy = node.copy();

            // also copy the routes now from the look, but only to the inputs
            copy.look.copyPinPinRoutes(node.look);

            // and add the copy to the node list
            newNode.addNode( copy );
        });

        // now that we have copied all nodes and the routes between them, we can correct the widgets in the routes between the nodes
        newNode.nodes?.forEach( node => {

            // correct the routes to the inputs and also store them at the relevant outputs
            node.look.correctPinPinRoutes(newNode);
        });

        // copy the pads
        this.pads?.forEach( pad => {

            // copy the pad
            const newPad = pad.copy();

            // copy and correct the pad-pin routes
            newPad.copyPadPinRoutes(pad, newNode);

            // find the corresponding proxy in the new node
            const proxy = newNode.look.widgets.find( w => (w.is.proxy)&&(w.name == pad.proxy.name)&&(w.is.input == pad.proxy.is.input) );

            // set the proxy in the pad
            newPad.proxy = proxy;

            // ..and set the pad in the proxy
            proxy.pad = newPad;

            // and save the new pad
            newNode.pads.push(newPad);
        });

        // copy the buses
        this.buses?.forEach( bus => {

            // make a clone of the bus
            const newBus = bus.copy();

            // copy the arrows and the routes - set from and to in the copies !
            bus.copyTacks(newBus, newNode);

            // save in the new node..
            newNode.buses.push(newBus);
        });

        // the txrx tables for the copy must be filled in
        newNode.rxtxBuildTxTable();

        // and return the node
        return newNode
    },

    // makes a copy of a node as a source node
    copyAsSourceNode(newName=null) {

        // create the source - without the look
        let source = new SourceNode(null,newName ?? this.name,this.uid);

        source.look = new Look(this.look.rect);

        // copy the look, but convert proxies to pins
        this.look.copyConvert(source);

        // make the rx/tx tables
        source.rxtxPrepareTables();

        // done
        return source
    },

};
Object.assign(GroupNode.prototype,  Node.prototype, groupFunctions, proxyHandling,jsonHandling$1, conxHandling);

const jsonHandling = {

    toJSON() {
        // get the pins 
        const {rect, label, interfaces} = this.look.getItemsToSave();
    
        // save as dock or source
        const json = this.link ? { kind: "dock", name: this.name, link: this.link } : { kind: "source", name: this.name, factory: this.factory };

        // add if present
        if (label) json.label = label;
        if (this.prompt) json.prompt = this.prompt;
        if (interfaces.length) json.interfaces = interfaces;
        if (this.sx) json.sx = this.sx;
        if (this.dx) json.dx = this.dx;

        // add the editor specific fields
        json.editor = {
            rect: convert.rectToString(rect),
        };

        // done
        return json
    },

    // the node is fused with a node linked from another file
    fuse( linkedNode ) {

        // check for added/deleted/changed widgets
        this.widgetCompare(linkedNode);

        // copy the factory
        this.factory.fName = linkedNode.factory.fName;
        this.factory.arl = linkedNode.factory.arl ? linkedNode.factory.arl.copy() : null;

        // fuse the settings
        this.sxUpdate(linkedNode);

        // because we have cooked the node we have already a rx, tx tables -> reset
        this.rxtxResetTables();

        // and set up the rx tx tables
        this.rxtxPrepareTables();
    },

    // cook specific content for a node that is not a link
    cook(raw, modcom) {

        // cook the common parts
        this.cookCommon(raw);

        // add the factory
        if (raw.factory) {

            // get the main and the current model
            const main = modcom.getMainModel();
            const current = modcom.getCurrentModel();

            // transform the factory file relative to the main model file
            if (raw.factory.path) {
                this.factory.arl = current.arl.resolve( raw.factory.path );
                if (main != current) this.factory.arl.makeRelative(main.arl);
            }

            // set or overwrite the name
            this.factory.fName = raw.factory.function;
        }

        // and set up the rx tx tables
        this.rxtxPrepareTables();
    },

    // Not really json related, but ok...
    // The factory module can contain one or many factories
    analyzeFactory(fModule) {

        // the entries in the module
        let entries = Object.entries(fModule);

        // find the factory entry in the list
        const entry = entries.find( entry => entry[0] == this.factory.fName );

        // not found 
        if (!entry) return

        // a dummy tx.send function
        const tx = {
            out() {}
        };

        // the factory function
        const factory = entry[1];

        // call the factory to get the actual runtime cell
        let cell = factory.prototype?.constructor === factory ? factory(tx, null) : new factory(tx, null);

        // cycle through the props ....
        for( const prop in cell) {

            if (prop.startsWith("-> ") && typeof cell[prop] == "function") {

                // get the name of the pin (without on)
                const handler = prop.slice(3);

                // get the source of the handler
                const source = cell[prop].toString();

                // find the parameters
                const opbr = source.indexOf('(');
                const clbr = source.indexOf(')');

                // get the profile - without the brackets
                const profile = source.slice(opbr+1, clbr);
                //console.log('<', handler,'>',profile)

                // add the profile to the appropriate widget
                for( const widget of this.look.widgets) {
                    if (widget.is.pin && widget.name == handler) {
                        widget.profile = profile;
                    }
                }
            }
        }
    }
};

// A node that implements source code
//export function SourceNode (factory, look, name=null, uid=null) {
function SourceNode (look=null, name=null, uid=null) {

    name = name ?? 'new';

    // constructor chaining
    Node.call(this, look, name, uid);

    // the type of group
    this.is.source = true,

    // the object to the javascript resource for this node
    this.factory = new Factory(name ? convert.nodeToFactory(name) : '');

    // receiving messages - incoming connections
    this.rxTable = [];

    //sending messages - outgoing connections
    this.txTable = [];

    // add some stuff to the look if present.
    if (look) look.decorate(this);
}

// implementations for source nodes
const sourceFunctions = {

    // makes a copy of a source node...
    copy(model) {

        // create the new node - without the look !
        const newNode = new SourceNode(null, this.name, this.uid);

        // copy the factory arl
        newNode.factory.copy(this.factory);

        // now create the look
        newNode.look = new Look(this.look.rect);

        // copy the look of this node to the new node
        this.look.copy(newNode);

        // copy the comment
        newNode.prompt = this.prompt ? this.prompt.slice() : null;

        // copy the settings
        newNode.sx = this.sx ? jsonDeepCopy(this.sx) : null;

        // if the node has a link copy that too
        newNode.link = this.link ? this.link.copy() : null;

        // build the tx rx table
        newNode.rxtxPrepareTables();

        // done - all the pins have been addedd - routes are added elsewhere 
        return newNode
    },

   // returns the arl to be used to get to the source for the node
   getSourceArl(jslib) {

        // if there is a link and the link is a library - take that
        if ( this.link?.model?.is.lib ) return this.link.model.arl

        // if there is a current lib (ie a lib where a group was defined) use that
        if (jslib) return jslib.arl

        // if the factory arl has been set explicitely, use that
        if (this.factory.arl) return this.factory.arl

        // if the link is a json file, the source can be found via the index file in the directory of that model
        if (this.link?.model) return this.link.model.arl.resolve('index.js')
            
        // else we assume the source can be locacted by using the index.js file in the model directory
        return null
    },

    // copy the node as a group node..
    copyAsGroupNode(newName = null) {

        // create a new group node
        const newNode = new GroupNode(null, newName ?? this.name, this.uid);

        // create the new look
        newNode.look = new Look(this.look.rect);

        // copy the look from this node to the new node
        this.look.copyConvert(newNode);

        // add a pad for each pin
        for (const pin of newNode.look.widgets) {

            // only proxies..
            if (!pin.is.proxy) continue

            // add it
            newNode.addPad(pin);
        }

        // done
        return newNode
    },

    // saves the node as a source file
    makeSourceBody() {

        // helper functions
        function formatInterfaceName(name) {
            const underscores = '___________________________________________________________________';
            const textLen = name.length;
            return '\n\t//'+ underscores.slice(0, -textLen) + name.toUpperCase()
        }

        // make sure the name of the node has a js compliant name
        const jsName = convert.nodeToFactory(this.name);

        // The header
        const today = new Date();
        let sHeader =      '// ------------------------------------------------------------------'
                        +`\n// Source node: ${jsName}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------';

        // The prompt for the node
        let sPrompt = this.prompt?.length > 0 ? '\n\n/*\n' + this.prompt + "\n*/": "";

        // The constructor
        let sConstructor =    `\n\n//Constructor for ${this.name}`
                            + `\nexport function ${jsName}(tx, sx) {`
                            + '\n}';

        // we make a sorted list of pins - sort according y-value
        this.look.widgets.sort( (a,b) => a.rect.y - b.rect.y);

        // the list of messages that the node can send 
        let sendList = '[';

        for (const widget of this.look.widgets) {

            // we also print the interfaceNames
            if (widget.is.ifName) sendList += formatInterfaceName(widget.text);

            // only output proxies need to be handled
            if (( ! widget.is.pin )||( widget.is.input )) continue

            // if the pin has a profile, add it here
            if (widget.profile?.length > 0) sendList += '\n\n\t// ' + widget.profile; 

            // make it clear if the pin has a return-channel
            const symbol = (widget.is.channel) ? '=>' : '->';

            // could be a multi-message
            if (widget.is.multi) {
                const multis = convert.expandMultis(widget.name);
                for(const multi of multis) sendList += `\n\t"${multi} ${symbol}",`;
            }
            else sendList += `\n\t"${widget.name} ${symbol}",`;
        }
        // close the brackets
        sendList += '\n\t],';

        // the prototype
        let sPrototype =     `\n\n${jsName}.prototype = {`
                            +'\n\n\t// Output pins of the node'
                            +`\n\n\tsends: ${sendList}`
                            +'\n\n\t// Input pins of the node'
                            +'\n\t// For each input pin "a_message" there is a handler "-> a_message" or "=> a_message" (with channel)'; 

        // the handlers
        this.look.widgets.forEach( widget => {

            // we also print the interfaceNames
            if (widget.is.ifName) sPrototype += formatInterfaceName(widget.text);

            if ((!widget.is.pin)||(!widget.is.input)) return

            // if the pin has a profile, add it here
            sPrototype += (widget.profile?.length > 0) ? '\n\t// ' + widget.profile : '\n';

            // make it clear if the pin has a return-channel
            const symbol = (widget.is.channel) ? '=>' : '->';

            // could be a multi-message
            if (widget.is.multi) {
                const multis = convert.expandMultis(widget.name);
                for(const multi of multis) sPrototype += `\n\t"${symbol} ${multi}"({}) {\n\t},`;
            }
            else sPrototype += `\n\t"${symbol} ${widget.name}"({}) {\n\t},`;
        });
        // the closing bracket
        sPrototype += `\n\n} // ${this.name}.prototype`;

        // return the result
        return sHeader + sPrompt + sConstructor + sPrototype
    },

};
Object.assign(SourceNode.prototype, Node.prototype, sourceFunctions, jsonHandling);

// name is the name of the javascript generator function
function Factory (name = null) {

    // the name of the factory
    this.fName = name ?? '';

    // optionally - the file where the factory can be found
    this.arl = null;

    // sometimes we will need an alias for the factory name to avoid name clashes
    this.alias = null;
}
Factory.prototype = {

    toJSON() {
        return  {   
                    path: this.arl?.userPath ?? "./index.js", 
                    function: this.fName
                }
    },

    copy(from) {
        this.fName = from.fName;
        this.alias = from.alias;
        this.arl = from.arl ? from.arl.copy() : null;
        //this.key = from.key
    },

    clone() {
        const clone = new Factory();
        clone.copy(this);
        return clone
    },

    resolve(newName, userPath, refArl, fallBack=null) {

        // check the name - if no name use the node name
        if (!newName || newName.length == 0) {
            if (!fallBack || fallBack.length == 0) return
            newName = fallBack;
        }

        // change the name if required
        if (newName !== this.fName) this.fName = newName;

        // check if the path changed
        if ((this.arl == null) && (!userPath || userPath.length == 0)) return
        if (this.arl?.userPath === userPath) return

        // check
        if (!userPath || userPath.length == 0 ) {
            this.arl = null;
            return
        }
        
        // check for completions 
        if (userPath.at(-1) === '/') {
            userPath = userPath + 'index.js';
        }
        else if (userPath.lastIndexOf('.js') < 0) {
            userPath = userPath + '.js';
        }
        
        // resolve 
        this.arl = refArl.resolve(userPath);
    },

    // checks if a factory with the same name does already exist and sets the alias if so
    // Note that we only search once ! so if factory and _factory exist we are screwed
    duplicate(srcImports, ownArl) {

        // check for duplicates (same name in different file !)
        const duplicate = srcImports.find( srcImport => {

            // ignore the ownArl of course
            if (srcImport.arl.equals(ownArl)) return false

            // search for 
            return srcImport.items.find( item => item == this.fName)
        });        

        // if the node exist already in a different file...
        if (duplicate) {

            // give a warning
            console.warn(`Duplicate factory name: ${this.fName} is already defined in ${duplicate.arl.userPath}`);

            // make an alias
            this.alias = '_' + this.fName;

            // we have a duplicate
            return true
        }
        else {
            // set the alias to null
            this.alias = null;

            //no duplicate found...
            return false
        }
    },
};

// the route used for a connection between an output and an input

const routeDrawing = {

    // draw freely with x/y segments
    // we always assume that the route is extended at the last point (i.e. the to widget !)
    drawXY(next) {

        // notation
        const wire = this.wire;
        let L = wire.length;

        // if there is no line segment push two points - start in the x -direction !
        if (L == 0) {
            let c = this.from.center();
            wire.push({x: c.x, y: c.y});
            wire.push({x: next.x, y: c.y});
            return
        }

        // take the two last points b a 
        let b = wire[L - 2];
        let a = wire[L - 1];

        // moving in x direction
        if (a.y == b.y) {

            // need to split ?
            if (Math.abs(next.y - a.y) > style$1.route.split) {

                // create a new segment
                wire.push({x:a.x, y:next.y});
            }
            else {
                // just adapt the x value
                a.x = next.x;

                // check if points are getting too close, if so drop 
                if ((L>2) && (Math.abs(a.x - b.x) < style$1.route.tooClose)) wire.pop();
            }
        }
        // moving in the y-direction
        else {

            // need to split ?
            if (Math.abs(next.x - a.x) > style$1.route.split) {

                // create a new segment
                wire.push({x:next.x, y:a.y});
            }
            else {
                // just adapt the y value
                a.y = next.y;

                // check if points are getting too close
                if ((L>2) && (Math.abs(a.y - b.y) < style$1.route.tooClose)) wire.pop();
            }
        }
    },

    // make a route between from and to
    builder() {

        const conx = this.typeString();

        switch (conx) {

            case 'PIN-PIN':
                this.fourPointRoute();
                break

            case 'PIN-PAD':
                this.fourPointRoute();
                break

            case 'PAD-PIN':
                this.fourPointRoute();
                break

            case 'PIN-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'BUS-PIN':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'PAD-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'BUS-PAD':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break
        }
    },

    sixPointRoute() {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0;

        // create a simple route between the two widgets
        const wire = this.wire;
        const from = this.from;
        const to = this.to;
        const f = from.center();
        const t = to.center();

        let x1=0, x2=0, y1=0;

        // if both pins 
        if (from.is.pin && to.is.pin) {

            // reasonable delta with some variation in it
            const delta = style$1.look.dxCopy * (2 - Math.random());

            x1 = from.is.left ? f.x - delta : f.x + delta;
            x2 = to.is.left ? t.x - delta : t.x + delta;

            const frc = from.node.look.rect;
            const trc = to.node.look.rect;

            y1 = f.y + (frc.h/4 + trc.h/4)*(2 - Math.random());
        }
        
        wire.push(f);
        wire.push({x:x1, y:f.y});
        wire.push({x:x1, y:y1});
        wire.push({x:x2, y:y1});
        wire.push({x:x2, y:t.y});
        wire.push(t);
    },

    fourPointRoute() {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0;

        // create a simple route between the two widgets
        const wire = this.wire;
        const from = this.from;
        const to = this.to;
        const f = from.center();
        const t = to.center();

        let xNew = 0;

        // if both pins are at the same side of the node
        if ((from.is.pin && to.is.pin)&&(from.is.left == to.is.left)) {

            // reasonable delta with some variation in it
            const delta = style$1.look.dxCopy * (2 - Math.random());

            if (from.is.left) 
                xNew = from.rect.x < to.rect.x ? from.rect.x - delta : to.rect.x - delta;
            else 
                xNew = from.rect.x + from.rect.w > to.rect.x + to.rect.w ? from.rect.x + from.rect.w + delta : to.rect.x + to.rect.w + delta;
        }
        else {

            //set an extra point somewhere between the two...
            const delta = Math.abs(f.x-t.x) * 0.5 * Math.random();

            // xNew is somewhere between the two centers
            xNew = f.x < t.x    ? f.x + (t.x-f.x)*0.25 + delta 
                                : f.x - (f.x-t.x)*0.25 - delta;

        }
        
        wire.push(f);
        wire.push({ x: xNew, y: f.y});
        wire.push({ x: xNew, y: t.y});
        wire.push(t);
    },

    threePointRoute(horizontal) {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0;

        const p = this.wire;
        const f = this.from.center();
        const t = this.to.center();

        p.push(f);
        horizontal ? p.push({x:t.x, y:f.y}) : p.push({x:f.x, y:t.y});
        p.push(t);
    },

    twoPointRoute() {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0;

       // create a simple route between the two widgets
       const p = this.wire;
       const f = this.from.center();
       const t = this.to.center();
       
       p.push(f);
       p.push({x:t.x, y:f.y});
    },
   
    // x,y is the endpoint - adjust some segment coordinates as required
    endpoint(widget) {

        let p = this.wire;
        let L = p.length;

        // there are at least two points...
        if (L<2) return

        // get the point to connect to on the widget
        let {x,y} = widget.center();

        // only two points...
        if (L == 2) {
            // if the two points are not at the same y..
            if (p[0].y != y) {

                //..we adjust point 1 and add two extra points 
                p[1].x = (p[0].x + x)/2;      //1
                p[1].y = p[0].y;
                p.push({x:p[1].x, y:y});      //2
                p.push({x,y});                //3
            }
            else
                // we just adjust the x to the endpoint
                p[1].x = x;

            // done
            return
        }

        // L > 2
        if (p[L-1].x== p[L-2].x) {

            // adjust the last y to the y of the widget
            p[L-1].y = y;

            // and push the endpoint on the route
            p.push({x,y});
        }
        else {
            //save the coordinates of the last line segment
            p[L-1].x = x;
            p[L-1].y = y;

            // if the segment before is vertical 
            p[L-2].x == p[L-3].x    ? p[L-2].y = p[L-1].y 
                                    : p[L-2].x = p[L-1].x;
        }
    },

    resumeDrawing(segment,xyLocal) {

        // get the center points of the widgets
        let xyFrom = this.from.center();
        let xyTo = this.to.center();

        const distanceFrom = Math.hypot( xyFrom.x - xyLocal.x, xyFrom.y - xyLocal.y );
        const distanceTo = Math.hypot( xyTo.x - xyLocal.x, xyTo.y - xyLocal.y);

        // choose where to disconnect based on the distance to the from/to pin
        if (distanceFrom < distanceTo) {
            
            // reverse if we are closer to 'from'
            this.reverse();
            segment = this.wire.length - segment;
        }

        // we have to take a few segments away - if only one point left set length to 0 !
        this.wire.length = segment > 1 ? segment : 0;

        // now we can store the route again in the from widget
        if (this.from.is.pin || this.from.is.pad) {
            this.from.routes.push(this);
        }
        else if (this.from.is.tack) {
            this.from.route = this; 
            this.from.bus.tacks.push(this.from);
        }

        // we also set the 'to' to null for good measure
        this.to = null;

        // and draw the next point using the xy
        this.drawXY(xyLocal);
    },

    // checks if there is an unobstructed path from p1 to p2
    lineOfSight(nodes) {
        
        const cFrom = this.from.center();
        const cTo = this.to.center();

        for (const node of nodes) {
            if (cutsRectangle(cFrom, cTo, node.look.rect)) return false
        }
        return true
    },



    autoRoute(nodes) {
        
        // get the type of connection
        const conx = this.typeString();

        switch (conx) {

            case 'PIN-PIN':

                // if there is no route yet we can swap left/right to have a better fit
                this.checkLeftRight();

                // check for line of sight
                this.lineOfSight(nodes) ? this.fourPointRoute() : this.sixPointRoute();

                break

            case 'PIN-PAD':
                this.fourPointRoute();
                break

            case 'PAD-PIN':
                this.fourPointRoute();
                break

            case 'PIN-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'BUS-PIN':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'PAD-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break

            case 'BUS-PAD':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true);
                break
        }
    },

    checkLeftRight() {

        const cFrom = this.from.center();
        const cTo = this.to.center();

        if (this.from.routes.length == 0) {

            if ((this.from.is.left && (cFrom.x < cTo.x)) || (!this.from.is.left && (cFrom.x > cTo.x)) ) this.from.leftRightSwap();
        }
        if (this.to.routes.length == 0) {

            if ((this.to.is.left && (cTo.x < cFrom.x)) || (!this.to.is.left && (cTo.x > cFrom.x)) ) this.to.leftRightSwap();
        }

    },

    // sometimes a route can be pathological - this is a fix for that
    healWire(){

        if (this.wire.length == 3) {

            this.wire[3] = this.wire[2];
            this.wire[2] = this.wire[1];
            this.wire[2].y = this.wire[3].y;
            this.wire[1].y = this.wire[0].y;
        }

    }
    
};

// the route used for a connection between an output and an input

const routeMoving = {

    // moves a segment horizontally or vertically
    moveSegment(s,delta) {

        const from = this.from;
        const to = this.to;

        let p1 = this.wire[s-1];
        let p2 = this.wire[s];

        // if there is only one segment and one of the endpoints is a bus, add two segments
        if (this.wire.length == 2) {
            if (from.is.tack || to.is.tack || from.is.pad || to.is.pad) this.makeThreeSegments(p1, p2);
        }

        // first segment...
        if (s == 1) {
            // if one of the end points is a tack or pad - it can slide
            return (from.is.tack || from.is.pad) ? from.slide(delta) : null
        }

        // last segment...
        if (s == this.wire.length-1) {
            return (to.is.tack || to.is.pad) ? to.slide(delta) : null
        }

        // otherwise just move the segment
        if (p1.x == p2.x) {
            p1.x += delta.x;
            p2.x += delta.x;
        }
        else {
            p1.y += delta.y;
            p2.y += delta.y;
        }
    },

    moveAllPoints(dx,dy) {
        this.wire.forEach( p => {
            p.x += dx;
            p.y += dy;
        });
    },

    removeOnePoint(n,p) {
        let last = p.length-1;
        for (let i = n; i<last; i++)  p[i] = p[i+1];
        p.length = last;      
    },

    removeTwoPoints(n,p) {
        let last = p.length-2;
        for (let i = n; i<last; i++)  p[i] = p[i+2];
        p.length = last;      
    },

    endDrag(s) {

        // the last point is 
        const L = this.wire.length;

        // segments 1 and 2 and L-1 and L-2 are special...
        if (s==1) {
            if (this.from.is.tack || this.from.is.pad) this.from.fuseEndSegment();
        }
        else if (s==2) {
            if (this.from.is.pin) this.fuseSegmentAfter(s);
            else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s);
        }
        else if (s == L-1) {
            if (this.to.is.tack || this.to.is.pad) this.to.fuseEndSegment();
        }
        else if (s == L-2) {
            if (this.to.is.pin) this.fuseSegmentBefore(s);
            else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s);
        }
        else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s);
    },

    // check if the segment has to be fused wit previous
    fuseSegmentBefore(s) {

        // notation - a and b are the points on the segment
        const p = this.wire;  

        // check
        if (s-2 < 0) return false

        const [before, a, b] = [p[s-2], p[s-1], p[s]];
        const min = style$1.route.tooClose;

        // horizontal segment
        if (a.y == b.y) {
            // check the point before the segment
            if (Math.abs(before.y - a.y) < min) {
                b.y = before.y;
                this.removeTwoPoints(s-2,p);
                return true
            }
        }
        // vertical segment
        else if (a.x == b.x) {
            // check the point before
            if (Math.abs(before.x - a.x) < min) {
                b.x = before.x;
                this.removeTwoPoints(s-2,p);
                return true
            }
        }
        return false
    },

    // check if the segment has to be fused with next 
    fuseSegmentAfter(s) {

        // notation - a and b are the points on the segment
        const p = this.wire;  

        // check
        if (s+1 > p.length-1) return false

        // notation
        const [a, b, after] = [p[s-1], p[s], p[s+1]];
        const min = style$1.route.tooClose;

        // horizontal segment
        if (a.y == b.y) {

            // check the point after the segment
            if (Math.abs(after.y - b.y) < min) {
                a.y = after.y;
                this.removeTwoPoints(s,p);
                return true
            }
        }
        // vertical segment
        else if (a.x == b.x) {

            // check the point after
            if (Math.abs(after.x - b.x) < min) {
                a.x = after.x;
                this.removeTwoPoints(s,p);
                return true
            }
        }
        return false
    },

    // moves an endpoint of a route to a new widget position
    clampToWidget( widget ) {

        const p = this.wire;
        const L = this.wire.length;
        const center = widget.center();

        // if the segment is too short, change it to a four point route
        if (L < 3) return this.fourPointRoute()

        // clamp 'from' or 'to' to the center
        if (this.from == widget) {
            p[0].x = center.x;
            p[0].y = center.y;
            p[1].y = center.y;
        }
        else if (this.to == widget) {
            p[L-1].x = center.x;
            p[L-1].y = center.y;
            p[L-2].y = center.y;
        }
    },

    // The endpoint(s) of the route have changed - make a better route
    adjust() {

        // notation
        const from = this.from;
        const to = this.to;

        // check that there are two valid endpoints
        if ( ! to?.center || !from?.center) return

        // from new - to new
        const fn = from.center();
        const tn = to.center();

        // from previous - to previous
        const fp = this.wire[0];
        const tp = this.wire.at(-1);

// TEMPORARY SOMETIMES THE WIRE IS GONE ?
if (!fp || !tp || !tn || !fn) {
    console.error('*** MISSING ENDPOINTS FOR ROUTE ***', this);
    return
}

        // the deltas
        const df = {x: fn.x - fp.x, y: fn.y - fp.y};
        const dt = {x: tn.x - tp.x, y: tn.y - tp.y};

        // check if both endpoints moved over the same distance - just move the route
        if ((df.x == dt.x) && (df.y == dt.y)) return this.moveAllPoints(df.x, df.y)

        // adjust the routes - there are 3 topologies
        if (to.is.tack) {
            ( to.dir == "up"   || to.dir == "down")   ? this.adjustHV(fn,tn) : this.adjustHH(fn,tn);
        }
        else if (from.is.tack) {
            ( from.dir == "up" || from.dir == "down") ? this.adjustVH(fn,tn) : this.adjustHH(fn,tn);
        }
        else {
            this.adjustHH(fn,tn);      
        }  
    },

    // Starts and ends horizontally
    // Only one of the end points moves
    // a and be are the next position of the end points of the wire
    adjustHH(a, b) {

        // notation
        let p = this.wire;

        // For HH there have to be at least three segments
        if (p.length < 4) return this.makeThreeSegments(a,b)

        // notation
        let last = p.length - 1;
        const sMax = p.length-1;
        const xMin = style$1.route.tooClose + 5;

        // if we move the start of the route
        if (p[0].x != a.x || p[0].y != a.y) {

            // adjust the starting point
            p[0].x = a.x;
            p[0].y = a.y;
            p[1].y = a.y;

            // check the horizontal = uneven segments, starting from the front
            for(let s = 1; s < sMax; s += 2) {
                const dx = p[s].x - p[s-1].x;

                // if the segment is too short
                if (Math.abs(dx) < xMin ) {

                    // s-1 <S> s <S+1> s+1   make the segment <S> minimal length
                    p[s].x = dx > 0 ? p[s-1].x + xMin : p[s-1].x - xMin;

                    // and collapse segment <S+1>
                    p[s+1].x = p[s].x;
                }
            }
        }

        // move the route at the end
        if (p[last].x != b.x || p[last].y != b.y) {

            // adjust the end point
            p[last].x = b.x;
            p[last].y = b.y;
            p[last-1].y = b.y;

            // check the horizontal = uneven segments, starting from the back
            for(let s = sMax; s > 1; s -= 2) {
                const dx = p[s].x - p[s-1].x;
                if (Math.abs(dx) < xMin) {
                    p[s-1].x = dx > 0 ? p[s].x - xMin : p[s].x + xMin;
                    p[s-2].x = p[s-1].x;
                }
            }
        }
    },

    // horizontal / vertical
    adjustHV(a, b) {
        // maybe create an extra segment
        if (this.wire.length == 2) return this.makeTwoSegments(a, b)

        const p = this.wire;
        const last = p.length-1;

        p[0].x = a.x;
        p[0].y = a.y;
        p[1].y = a.y;
        p[last].x = b.x;
        p[last].y = b.y;
        p[last-1].x = b.x;
        p[last-1].y = p[last-2].y;
    },

    // horizontal / vertical
    adjustVH(a, b) {
        // maybe create an extra segment
        if (this.wire.length == 2) return this.makeTwoSegments(a, b)

        const p = this.wire;
        const last = p.length-1;

        p[0].x = a.x;
        p[0].y = a.y;
        p[1].x = a.x;
        p[last].x = b.x;
        p[last].y = b.y;
        p[last-1].x = p[last-2].x;
        p[last-1].y = b.y;
    },

    adjustFourPointRoute(a,b) {

        // notation
        const tooClose = style$1.route.tooClose;
        const [p0, p1, p2, p3] = this.wire;

        // the new middle is the old middle by default
        let mx = p1.x;

        // we keep the form of the curve - a z curve remains a z curve, a c curve remains a c curve

        // The vertical is to the right
        if (p1.x > p0.x && p1.x > p3.x) {

            if (p1.x - a.x < tooClose) mx = a.x + tooClose;
            else if (p1.x - b.x < tooClose) mx = b.x + tooClose;
        }
        // The vertical is to the left
        else if (p1.x < p0.x && p1.x < p3.x) {
            if (a.x - p1.x  < tooClose) mx = a.x - tooClose;
            else if (b.x - p1.x < tooClose) mx = b.x - tooClose;
        }
        // the vertical is between a and b
        else {
            // the previous length and the new length
            const pL = p3.x - p0.x;
            const nL = b.x - a.x;

            // calculate the middle x
            mx =   nL == 0 ? a.x 
                 : pL == 0 ? (a.x + b.x)/2
                 : a.x + (p1.x - p0.x) * nL / pL;            
        }

        // adjust the points
        p0.x = a.x;
        p0.y = a.y;
        p1.y = a.y;
        p1.x = mx;
        p2.x = mx;
        p2.y = b.y;
        p3.x = b.x;
        p3.y = b.y;
    },

    makeTwoSegments(a, b) {

        // notation
        const w = this.wire;

        // reset the wire
        w.length = 0;

        // set 3 points
        w.push({x: a.x, y: a.y});
        w.push({x: b.x, y: a.y});
        w.push({x: b.x, y: b.y});
    },

    makeThreeSegments(a, b) {

        // notation
        const w = this.wire;

        // reset the wire
        w.length = 0;

        // set four points
        w.push({x: a.x, y: a.y});
        w.push({x: (a.x+b.x)/2, y: a.y});
        w.push({x: (a.x+b.x)/2, y: b.y});
        w.push({x: b.x, y: b.y});
    },

};

const connectHandling = {

// if no parameter is given, take to
conxString(from, to) {
    // set the type of connection that needs to be made

    let conxStr =     from.is.pin  ? 'PIN'
                    : from.is.tack || from.is.bus ? 'BUS'
                    : from.is.pad ? 'PAD'
                    : '';

    //if (!conxTo) conxTo = this.to
    if (!to) return conxStr

    conxStr +=        to.is.pin  ? '-PIN'
                    : to.is.tack || to.is.bus ? '-BUS'
                    : to.is.pad ? '-PAD'
                    : '';

    return conxStr
},

// checks if a connection is possible - used for hover-feedback
checkConxType(from, to) {

    // set the type of connection that needs to be made
    const conxStr = this.conxString(from, to);

    switch (conxStr) {

        case 'PIN-PIN':

            // from and to are the same - but avoid bad 'hover' feedback at the start of the route
            if (from === to) return (this.wire.length < 3) ? true : false
            
            // else check
            return from.canConnect(to)  

        case 'PIN-BUS':
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'BUS-PIN':
            // multiple connections are refused !
            return from.bus.findTack(to) ? false : true

        case 'PIN-PAD':
            // only accept new connections of the right type
            return to.canConnect(from)

        case 'PAD-PIN':
            // only accept new connections
            return from.canConnect(to)

        case 'BUS-PAD': 
            return false

        case 'PAD-BUS': 
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'BUS-BUS': return false
        case 'PAD-PAD': return false

        default : return false
    }
},

// make the actual connection
connect(conxTo) {

    // we do the check here
    if (! this.checkConxType(this.from, conxTo)) return false

    // set the type of connection that needs to be made
    const conxStr = this.conxString(this.from, conxTo);
    
    switch (conxStr) {

        case 'PIN-PIN':
            this.to = conxTo;
            conxTo.routes.push(this);
            this.rxtxPinPin();
            return true

        case 'PIN-PAD':
            this.to = conxTo;
            conxTo.routes.push(this);
            this.rxtxPinPad();
            return true

        case 'PAD-PIN':
            this.to = conxTo;
            conxTo.routes.push(this);   
            this.rxtxPinPad();           
            return true

        case 'PIN-BUS':
            conxTo.addTack(this);
            this.rxtxPinBus(); 
            return true

        case 'BUS-PIN':
            this.to = conxTo;
            conxTo.routes.push(this);            
            this.rxtxPinBus(); 
            return true

        case 'BUS-PAD': 
            this.to = conxTo;
            conxTo.routes.push(this);
            this.rxtxPadBus();
            return true    

        case 'PAD-BUS': 
            conxTo.addTack(this);
            this.rxtxPadBus(); 
            return true        

        case 'PAD-PAD': 
            return false

        case 'BUS-BUS': 
            return false

        default : return false
    }
},

// disconnects a route at both ends 
disconnect() {

    // set the type of connection that needs to be made
    let conx = this.conxString(this.from, this.to);

    switch (conx) {

        case 'PIN-PIN':
            this.rxtxPinPinDisconnect();
            break

        case 'PIN-PAD':
        case 'PAD-PIN':
            this.rxtxPinPadDisconnect();
            break        

        case 'PIN-BUS':
        case 'BUS-PIN':
            this.rxtxPinBusDisconnect();
            break        

        case 'PAD-BUS':
        case 'BUS-PAD':
            this.rxtxPadBusDisconnect();
            break

        default: 
            console.error('Impossible combination in route.disconnect:',conx);
            break     
    }

    // remove the route
    this.remove();
},

// used in undo operations - the route has been removed in the to and from widgets 
// and has to be reconnected there. It is possible that a route appears twice in the list
// so we always check if we have already handled the route or not
// Reconnecting is a two stage process: first connect the route in the from widget (we do this here)
// and then connect in the to-widget by calling the connect function
reconnect() {

    // check if we have already handled the route. Could be a pin..
    if (this.from.is.pin) {

        // check if already handled
        if (this.from.routes.includes(this)) return

        // save the route in from
        this.from.routes.push(this);
    }

    // ..or a pad
    else if (this.from.is.pad) {

        // check if already handled
        if (this.from.routes.includes(this)) return

        // no, save the route
        this.from.routes.push(this);
    }

    // ..or could be a bus tack
    else if (this.from.is.tack) { 

        // check if already handled
        if (this.from.bus.tacks.includes(this.from)) return

        // add it to the bus tacks again
        this.from.bus.tacks.push(this.from);
    }

    // for buses we need to use the bus to connect to
    const conxTo = this.to.is.tack ? this.to.bus : this.to;

    // set to in the route to null
    this.to = null;
    
    // and connect again
    this.connect(conxTo);
},

// also used in undo/redo - copies the content of a temp copy into this route
connectFromClone(clone) {
    
    // save the old route details in the route
    this.wire = clone.wire;
    this.from = clone.from;
    this.from.routes.push(this);

    // and reconnect
    const other = clone.to.is.tack ? clone.to.bus : clone.to;
    this.connect(other);   
},

};

const rxtxHandling = {

// return how messages can arrow between two widgets
// There are actually ony two cases to consider: pin pin | pin pad | pin bus | pad bus
// right = A->B, left = A<-B
arrow(A, B) {

    // pin pin
    if (B.is.pin) return {right: B.is.input, left: !B.is.input}

    // pin pad
    if (B.is.pad) return {right: !B.proxy.is.input, left: B.proxy.is.input}

    // pin bus | pad bus
    if (B.is.bus) return A.is.pin   ? {right: !A.is.input, left: A.is.input} 
                                    : {right: A.proxy.is.input, left: !A.proxy.is.input}
},

// A and B are two pin widgets (actual or proxy)
rxtxPinPin() {

    // messages are flowing from the src list to the dst list
    const srcList = [];
    const dstList = [];

    // get the arrow
    const arrow = this.arrow(this.from, this.to);

    // get source and destination
    const src = arrow.right ? this.from : this.to;
    const dst = arrow.right ? this.to : this.from;

    // proxies require possibly many connections
    if (dst.is.proxy || src.is.proxy) {

        // find all the pins that can generate input via src - incoming to src
        src.is.proxy ? src.pad?.makeConxList( srcList ) : srcList.push( src );

        // Find all the pins that can receive input via dst - outgoing from dst
        dst.is.proxy ? dst.pad?.makeConxList( dstList ) : dstList.push( dst );

        // do a full connection...
        this.fullConnect(srcList, dstList);
    }
    // if the two are pins, we have to add one destination in one table
    else this.singleConnect(src, dst);

},

rxtxPinPad() {

    // messages are flowing from the inlist to the outlist (list = list of source node widgets)
    const srcList = [];
    const dstList = [];

    // get the pin and the pad
    const [pin, pad] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from];

    // if the pin that we connect has a channel, the proxy also allows channels
    if (pin.is.channel) pad.proxy.is.channel = true;

    // determine the arrow over the route: left or right
    const arrow = this.arrow(pin, pad);

    // from pin to pad
    if (arrow.right) {

        // get all the incoming connections to the pin (that can be a proxy)
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin);

        // get all the outgoing connections on the proxy of the pad
        pad.proxy.makeConxList(dstList);    
        
        // fully connect
        this.fullConnect(srcList, dstList);
    }

    // from pad to pin
    if (arrow.left) {

        // get all the incoming connections on the proxy of the pad
        pad.proxy.makeConxList(srcList);   

        // get all the outgoing connections of the pin
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin);
        
        // and fully connect
        this.fullConnect(srcList, dstList);
    }
},

// connect to the bus
rxtxPinBus() {

    // we will build an output/input list with of actual widgets
    const dstList = [];
    const srcList = [];

    // get the pin and the tack
    const [pin, tack] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from];

    // get the arrow
    const arrow = this.arrow(pin, tack.bus);

    // arrow is from pin to bus
    if (arrow.right) {

        // now make the source list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin); 

        // if the bus has a router save the pins this tack is connected to, and set the connections to the tack
        if (tack.bus.hasFilter()) {

            // add the incoming to the table for the bus
            tack.bus.rxtxAddRxTack(tack);

            // and do a full connect to the bus
            this.fullConnect(srcList,[tack]);
        }

        // and do a full connect between source and destination list
        else {

            // make the list of destinations connected to this bus for this pin
            tack.bus.makeConxList(pin, dstList);
            
            // and do a full connect
            this.fullConnect(srcList, dstList);
        }
    }

    // left 
    if (arrow.left) {

        // now make the inlist
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin);

        if (tack.bus.hasFilter()) {

            // add the destination for this tack
            tack.bus.rxtxAddTxTack(tack, dstList);
        }
        else {

            // make the list of outputs of connected to this bus
            tack.bus.makeConxList(pin, srcList);

            // and do a full connect between source and destination list
            this.fullConnect(srcList, dstList);
        }
    }
},

// connect to the bus
rxtxPadBus() {

    // we will build an output/input list with of actual widgets
    const dstList = [];
    const srcList = [];

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from];

    const arrow = this.arrow(pad, tack.bus);

    // from pad to bus
    if (arrow.right) {

        pad.proxy.makeConxList(srcList);

        if (tack.bus.hasFilter()) {

            // add the tack to the table
            tack.bus.rxtxAddRxTack(tack);

            // and do a full connect to the bus tack only
            this.fullConnect(srcList,[tack]);            
        }
        else {

            // find the connections from the tack
            tack.bus.makeConxList(pad, dstList);

            // and do a full connect
            this.fullConnect(srcList, dstList);
        }
    }
    // from bus to pad
    if (arrow.left) {

        pad.proxy.makeConxList(dstList);

        if (tack.bus.hasFilter()) {

            // save the destinations for this tack
            tack.bus.rxtxAddTxTack(tack, dstList);
        }
        else {
            // find the incoming connections on the bus that lead to the pad 
            tack.bus.makeConxList(pad, srcList);

            // and do a full connect
            this.fullConnect(srcList, dstList);
        }
    }
},

// disconnect a pin
rxtxPinPinDisconnect() {

    const srcList = [];
    const dstList = [];

    const arrow = this.arrow(this.from, this.to);

    const src = arrow.right ? this.from : this.to;
    const dst = arrow.right ? this.to : this.from;

    // if one of the two is a proxy, we have to remove many destinations
    if (src.is.proxy || dst.is.proxy) {

        // make the list of actual in and out widgets
        src.is.proxy ? src.pad?.makeConxList( srcList)  : srcList.push( src );
        dst.is.proxy ? dst.pad?.makeConxList( dstList ) : dstList.push( dst );
 
        // and now do a full disconnection of the pins
        this.fullDisconnect(srcList, dstList);
     }
    // if the two are actual pins we have to remove one destination from one table
    else {
        // remove the destination from the specified output-pin of the node
        src.node.rxtxRemoveFromTxTable(src, dst);
    }
},

// disconnect a pin from a pad
rxtxPinPadDisconnect() {

    // messages are flowing from the inlist to the outlist (list = list of source node widgets)
    const srcList = [];
    const dstList = [];

    // get the pin and the pad
    const [pin, pad] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from];

    // check if we still need to keep the channel
    if (pad.proxy.is.channel) {

        // find the first other route that also has a channel
        const route = pad.routes.find( route => {
                                if (route != this) {
                                    const other = route.from == pad ? route.to : route.from;
                                    if (other.is.pin && other.is.channel) return true
                                    if (other.is.pad && other.proxy.is.channel) return true
                                }
                            });
        
        pad.proxy.is.channel = route ? true : false;
    }

    // determine the arrow over the route
    const arrow = this.arrow(pin, pad);

    // from pin to pad
    if (arrow.right) {
        // get all the incoming connections to the pin (that can be a proxy)
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin);

        // get all the outgoing connections on the proxy of the pad
        pad.proxy.makeConxList(dstList);    
        
        // fully disconnect
        this.fullDisconnect(srcList, dstList);
    }

    // from pad to pin
    if (arrow.left) {
        // get all the incoming connections on the proxy of the pad
        pad.proxy.makeConxList(srcList); 

        // get all the outgoing connections of the pin
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin);
        
        // and fully disconnect
        this.fullDisconnect(srcList, dstList);
    }
},

// disconnect from the bus
rxtxPinBusDisconnect() {

     // we will build an output/input list with of actual widgets
    const dstList = [];
    const srcList = [];

    // get the pin and the bus
    const [pin, tack] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from];

    // get the arrow
    const arrow = this.arrow(pin, tack.bus);

    // right
    if (arrow.right) {
        // now make the output list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin);   

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveRxTack(tack);

            this.fullDisconnect(srcList, [tack]);
        }
        else {

            // make the list of inputs connected to this bus of the same name
            tack.bus.makeConxList(pin, dstList);

            // and do a full disconnect 
            this.fullDisconnect(srcList, dstList);
        }
    }

    // left 
    if (arrow.left) {

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveTxTack(tack);

        } else {

            // make the list of outputs of the same name connected to this bus
            tack.bus.makeConxList(pin, srcList);

            // now make the inlist
            pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin);

            // and do a full disconnect 
            this.fullDisconnect(srcList, dstList);
        }
    }
},

rxtxPadBusDisconnect() {

    // we will build an output/input list with of actual widgets
    const dstList = [];
    const srcList = [];

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from];

    // get the arrow
    const arrow = this.arrow(pad, tack.bus);

    if (arrow.right) {

        pad.proxy.makeConxList(srcList);

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveRxTack(tack);

            this.fullDisconnect(srcList, [tack]);
        }
        // and do a full disconnect 
        else {

            bus.makeConxList(pad, dstList);

            this.fullDisconnect(srcList, dstList);
        }
    }
    if (arrow.left) {

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveTxTack(tack);
        }
        else {

            tack.bus.makeConxList(pad, srcList);
            pad.proxy.makeConxList(dstList);
            this.fullDisconnect(srcList, dstList);
        }
    }
},

// just need to make a single connection
singleConnect(src, dst){

    // find the entry in the txTable 
    let tx = src.node.txTable.find( tx => tx.pin.name == src.name);

    // check
    if (!tx) return;

    // if one of the pins is a multi, there must be a partial overlap
    if ((src.is.multi || dst.is.multi) &&  !dst.hasMultiOverlap(src)) return;

    // and add it to the array of destinations
    tx.targets.push(dst);        
},

// for each resolved rx and tx pair, add an entry to the table
fullConnect(srcList, dstList) {

    // we have a list of out and ins that we have to connect 
    for(const src of srcList) {

        if (src.is.pin) {

            // find the entry in the conx table that corresponds to the pin 
            const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name );

            /** debug should not happen */
            if (!txRecord) {
                console.warn('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullConnect', src.name, src.node.name);
                continue
            }

            // for each entry in the dstlist, add a destination
            for(const dst of dstList) {
                
                // if one of the pins is a multi, there must be a partial overlap
                if ( !(src.is.multi || dst.is.multi) || dst.hasMultiOverlap(src)) txRecord.targets.push(dst);
            }
        }
        // a tack here means that there is filter function on the bus
        else if (src.is.tack) {

            // find the entry in the conx table that corresponds to the tack
            const txTack = src.bus.txTable.find( txTack => txTack.tack == src );    

            /** debug should not happen */
            if (!txTack) {
                console.warn('*** SHOULD NOT HAPPEN *** Could not find txTack in fullConnect', src.bus.name);
                continue
            }            

            // for each entry in the dstlist, add a destination
            for(const dst of dstList) {
                txTack.fanout.push(dst);
            }
        }
    }
},

// for each resolved rx and tx pair, remove the entry in the table
fullDisconnect(srcList, dstList) {

    for(const src of srcList) {

        // The source can be a tack or a pin
        if (src.is.pin) {

            // find the entry in the conx table that corresponds to the pin 
            const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name );

            /** debug should not happen */
            if (!txRecord) {
                console.warning('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullDisconnect', src.name, src.node.name);
                continue
            }

            // remove all the targets that are in the list of destinations
            for(const dst of dstList) txRecord.dropTarget(dst);
    
        }
        else if (src.is.tack) {

            // find the entry in the conx table that corresponds to the tack
            const txTack = src.bus.txTable.find( txTack => txTack.tack == src );    

            /** debug should not happen */
            if (!txTack) {
                console.warning('*** SHOULD NOT HAPPEN *** Could not find txTack in fullDisconnect', src.bus.name);
                continue
            }            

            // remove all the dst in the fanout that are in the list of destinations
            for(const dst of dstList) txTack.dropTarget(dst);
        }
    }
},

};

// the route used for a connection between an output and an input

function Route(from, to) {

    this.from = from;                    // ref to widget - from is just the draw direction, it can be input or output
    this.to = to;                        // ref to widget
    this.is = {
        selected: false,
        highLighted: false,
        twistedPair: false,
        notUsed: false,
        newConx: false,                 // the route is there because of a new conx
        noConx: false                   // there is no corresponding connection anymore
    };
    // The wire between the two widgets
    this.wire = [];                    
}
Route.prototype = {

    render(ctx) {

        // check
        if (this.wire.length < 2) return 

        // color
        const color = this.is.selected      ? style$1.route.cSelected 
                    : this.is.highLighted   ? style$1.route.cHighLighted
                    : this.is.newConx       ? style$1.route.cAdded
                    : this.is.noConx        ? style$1.route.cDeleted
                    : this.is.notUsed       ? style$1.route.cNotUsed
                    : style$1.route.cNormal;

        //linewidth
        const width = this.is.selected ? style$1.route.wSelected : style$1.route.wNormal;

        // draw the line segments
        this.is.twistedPair ? shape.twistedPair(ctx, color, width, this.wire) : shape.drawWire(ctx,color, width, this.wire);
    },

    // change the route direction
    reverse() {
        // reverse the from to pair
        [this.from, this.to] = [this.to, this.from];

        let p = this.wire;
        let l = p.length;

        // reverse the points - if l is uneven the middle point stays, which is ok
        for (let i=0; i<l/2; i++) [p[i], p[l-i-1]] = [p[l-i-1], p[i]];
    },

    select() {
        this.is.selected = true;
        if (this.from) this.from.is.selected = true;
        if (this.to) this.to.is.selected = true;
    },

    unSelect() {
        this.is.selected = false;
        if (this.from) this.from.is.selected = false;
        if (this.to) this.to.is.selected = false;
    },

    // highlight is simple
    highLight() {
        this.is.highLighted = true;
        if (this.from) this.from.is.highLighted = true;
        if (this.to) this.to.is.highLighted = true;
    },

    // unhighlight is a bit more complicated
    unHighLight(){

        // if the other look is still highlighted and it belongs to a different node, do not turn off
        if ( (this.from?.node?.is.highLighted || this.to?.node?.is.highLighted) && this.from.node != this.to.node) return

        // turn off
        this.is.highLighted = false;
        if (this.from) this.from.is.highLighted = false;
        if (this.to) this.to.is.highLighted = false;
    },

    setTwistedPair() {
        this.is.twistedPair = true;
    },

    checkTwistedPair() {

        const A = this.from.is.input ? this.to : this.from;

        if (!A) return

        if (A.is.pin && A.is.multi) this.is.twistedPair = true;
        else if (A.is.pad && A.proxy?.is.multi) this.is.twistedPair = true;
    },

    // generates the type string for a route
    typeString() {

        const from = this.from.is;
        const to = this.to.is;

        let str =     from.pin ? 'PIN' 
                    : from.tack ? 'BUS' 
                    : from.pad ? 'PAD' : '';
        str +=        to.pin ? '-PIN' 
                    : to.tack ? '-BUS' 
                    : to.pad ? '-PAD' : '';

        return str
    },

    // returns the segment 1, 2 etc - 0 means failure
    hitSegment(pos) {

        // notation
        const last = this.wire.length-1;
        const x = pos.x, y = pos.y;

        // the precision in pixels
        const delta = 5;

        // check if the point lies on the route
        for (let i=0; i<last; i++) {

            const a = this.wire[i];
            const b = this.wire[i+1];
            
            // horizontal segment
            if (a.y == b.y) {
                if ((y < a.y + delta) && (y > a.y - delta) && ((a.x-x)*(b.x-x) <= 0)) return i+1
            }
            // vertical segment
            else {
                if ((x < a.x + delta) && (x > a.x - delta) && ((a.y-y)*(b.y-y) <= 0)) return i+1
            }         
        }
        // no hit
        return 0
    },

    remove() {
        this.from.removeRoute(this);
        this.to.removeRoute(this);
    },

    popFromRoute() {
        this.from.is.tack ? this.from.bus.tacks.pop() : this.from.routes.pop(); 
    },

    clone() {
        // make a new route
        let newRoute = new Route(this.from, this.to);

        // copy the points array
        for (const point of this.wire) newRoute.wire.push({...point});

        // done
        return newRoute
    },

    restore() {

    },

    // used for undo/redo
    copyWire() {
        const copy = [];
        for (const point of this.wire) copy.push({...point});
        return copy
    },

    restoreWire(copy) {
        this.wire = [];
        for (const point of copy) this.wire.push({...point});
    },

    // returns A, B where the message flow is from A to B
    messageFlow() {

        const from = this.from;
        const to = this.to;

        if (from.is.pin) return from.is.input ?  [to, from] : [from, to]
        if (to.is.pin) return to.is.input ? [from, to] : [to, from]
        if (from.is.pad) return from.proxy.is.input ? [from, to] : [to, from]
        if (to.is.pad) return to.proxy.is.input ? [to, from] : [from, to]
        return [to, from]
    }

};
Object.assign(Route.prototype, routeDrawing, routeMoving, connectHandling, rxtxHandling);

// a bus groups a number of connections

const busConnect = {


    pinNameCheck(A,B) {

        if (this.is.cable) {

            // there has to be a full name match
            if (A.is.multi || B.is.multi) {
                if (!A.hasFullNameMatch(B)) return false
            }
            else {
                if (A.name != B.name) return false
            }
        }
        else {
            if (A.is.multi || B.is.multi) {
                if ( !A.hasMultiOverlap(B)) return false
            }
        }

        return true
    },

    // check if two widgets connected to the bus are logically connected
    // if two pins are connected to a bus, the bus is external and a and b can belong to the same node
    // when there is a pad, the proxy and the pin are always from a differnt node 
    // two pads can be connected by a bus

    areConnected(A,B) {

        if (A.is.pin) {
            if (B.is.pin) {

                // input / output have to match
                if (A.is.input == B.is.input) return false

                // you cannot connect to your own node via a bus
                if (A.node == B.node) return false

                // check the names of the connecting pins
                return this.pinNameCheck(A, B)
            }
            else if (B.is.pad) {

                // input / output have to be different
                if (A.is.input != B.proxy.is.input) return false

                // check the names
                return this.pinNameCheck(A, B.proxy)
            }
        }
        else if (A.is.pad) {
            if (B.is.pin) {

                // input / output have to match
                if (A.proxy.is.input != B.is.input) return false

                // check the names
                return this.pinNameCheck(A.proxy, B)
            }
            else if (B.is.pad) {

                // input / output have to be different
                if (A.proxy.is.input == B.proxy.is.input) return false

                // check the names
                return this.pinNameCheck(A.proxy, B.proxy)
            }
        }
        console.log(A,B);
        return false
    },

    // disconnect all routes to and from a bus
    disconnect() {

        // make a copy - the original array will be modified
        const tacks = this.tacks.slice();

        // remove the tacks
        for (const tack of tacks) {

            // what is the tack connected to..
            const other = tack.route.from == tack ? tack.route.to : tack.route.from;

            // disconnect
            other.is.pin ? tack.route.rxtxPinBusDisconnect() : tack.route.rxtxPadBusDisconnect();
            
            // remove the route at the pin also
            tack.route.remove();
        }
    },

    // undo a disconnect action
    reconnect(tacks) {

        for (const tack of tacks) {

            // add the tack to the bus again
            this.tacks.push(tack);

            // place it (probably not necessary)
            tack.orient();

            // the tack is connected to...
            const other = tack.route.to == tack ? tack.route.from : tack.route.to;

            // add the route to the pin
            other.routes.push(tack.route);

            // change the rxtx tables...
            other.is.pin ? tack.route.rxtxPinBus() : tack.route.rxtxPadBus();
        }
    },

    // make the list of pins/pads connected to the widget via the bus
    makeConxList(widget, list) {

        for(const tack of this.tacks) {

            // TEMP
            if (! tack.route?.from || ! tack.route?.to) continue

            // Take the widget at the other end of the route
            const other = tack.route.from == tack ? tack.route.to : tack.route.from;

            // check if the two are connected
            if (! this.areConnected(widget, other)) continue

            // search further if required
            if (other.is.pin) {
                
                other.is.proxy ? other.pad.makeConxList(list) : list.push(other);
            }
            else if (other.is.pad) {

                other.proxy.makeConxList(list);
            }
        }
    },

    // every connection of the old bus that starts from a node in the selection is transferred to the new bus
    splitTacks(newBus, newGroup) {

        this.tacks.forEach( (tack,index) => {

            // if the arrow comes from a node in the new group
            if (tack.route.from.is.pin && newGroup.nodes.includes(tack.route.from.node)) {

                // push the arrow on the new bus
                newBus.tacks.push(tack);

                // take it from this bus
                this.tacks[index] = null;

                // adjust the bus
                tack.bus = newBus;
            }
        });

        // close the holes..
        this.tacks = this.tacks.filter( w => w != null);
    },

    // transfer the tacks from this buses (inside a group) to the same bus outside - used in undo group
    transferTacks(outsiders) {

        // for all tacks
        for(const tack of this.tacks) {

            // find the corresponding bus
            for(const outside of outsiders) {

                if (this.uid == outside.uid) {
                    tack.bus = outside;
                    break
                }
            }
        }
    },

    // make a route from the widget to the bus - the widget is a pin or a pad
    makeRoute(widget) {

        // select a point on the bus wire closest = {point, segment nr, endPoint}
        const closest = closestPointOnCurve(this.wire, widget.center());

        // if the closest point is an endpoint, we interpollate close to that point
        const point = closest.endPoint ? interpolateSegment(closest.point, closest.segment, this.wire) : closest.point;

        // create a tack
        const tack = new BusTack(this);

        // place the tack at a the selected position on the bus
        tack.placeOnSegment(point, closest.segment);

        // a new route between the widget and the tack
        const route = new Route(widget, tack);

        // make a smart connection between the two destinations
        route.builder();

        // and save the route in the new proxy...
        widget.routes.push(route);

        // set the route in the tack, the tack in the bus and orient the tack
        tack.restore(route);
    },

    rxtxPrepareTables() {
    },
    
    rxtxResetTables() {
    
        this.txTable = [];
        this.rxTable = [];
    },

    // follow the routes to build the tx tables - recursive function
    rxtxBuildRxTxTable() {
    
        // for all the incoming tacks
        for (const tack of this.tacks) {

            if (tack.incoming()) {

                this.rxtxAddRxTack(tack);
            }
            else {

                const outgoing = [];

                const other = tack.getOther();

                other.is.proxy ? other.pad.makeConxList(outgoing) : (other.is.pad ? other.proxy.makeConxList(outgoing) : outgoing.push(other));

                this.rxtxAddTxTack(tack, outgoing);
            }
        }
    },
    
    // For an outgoing tack, we save the incoming connections
    rxtxAddTxTack(tack, outgoing) {
    
        // make a record for the tack
        const txTack = new TxTack(tack);
    
        // now add the list to the tx record (make a copy !)
        txTack.fanout = outgoing.slice();
    
        // push the target to the txTable
        this.txTable.push(txTack);
    },
    
    // removes a connection
    rxtxRemoveTxTack(tack) {
        
        // find the destination targets that corresponds with the transmitter and remove the enrty
        const index = this.txTable.findIndex( tx => tx.tack == tack);
        if (index > -1) this.txTable.splice(index, 1);
    },

    // For an incoming tack, we save the outgoing connections
    rxtxAddRxTack(tack) {

        this.rxTable.push(new RxTack(tack));
    },

    // removes a connection
    rxtxRemoveRxTack(tack) {

        // find the destination targets that corresponds with the transmitter and remove the enrty
        const index = this.rxTable.findIndex( tx => tx.tack == tack);
        if (index > -1) this.rxTable.splice(index, 1);
    },


};

const busJsonHandling = {

toJSON() {
    // cable or busbar
    const json = this.is.cable    ? {   kind: 'cable', name: this.name } : { kind: 'busbar', name:  this.name};

    // save the filter if applicable
    if (this.is.filter && this.filter) json.filter = this.filter;

    // the wire
    json.start = convert.pointToString(this.wire[0]);
    json.wire = convert.wireToString(this.wire);

    // done
    return json
},
    
cook(raw, modcom) {
    
    // set the type of bus
    this.is.cable = (raw.kind == 'cable') ? true : false;

    // set the name
    this.name = raw.name;

    // check for a filter
    if (raw.filter) {

        // get the main and the current model
        const main = modcom.getMainModel();
        const current = modcom.getCurrentModel();

        // create the filter
        this.filter = new Factory(raw.filter.function);
        this.is.filter = true;

        // transform the factory file relative to the main model file
        if (raw.filter.path) {
            this.filter.arl = current.arl.resolve( raw.filter.path );
            if (main != current) this.filter.arl.makeRelative(main.arl);
        }
    }

    // save the path and labels for this bus
    this.wire = convert.stringToWire(convert.stringToPoint(raw.start), null, raw.wire);

    // ** pathological ** should not happen
    if (this.wire.length == 1) this.wire.push(this.wire[0]);

    // place the labels..
    this.startLabel.place();
    this.endLabel.place();
},


};

const busDrawing = {
    
    // draw freely with x/y segments - do not pass beyond arrows that are attached to the bus
    drawXY(next) {

        const L = this.wire.length;

        // notation
        const r1 = this.wire[L - 2];
        const r2 = this.wire[L - 1];
        const wBus = this.is.cable ? style$1.bus.wCable : style$1.bus.wBusbar;
        const hLabel = this.endLabel.rect.h;
        let limit = null;

        const vertical = r2.x == r1.x;
        const horizontal = r2.y == r1.y;

        // the first segment x==y
        if (vertical && horizontal) {

            // the first two points of the wire are the same, so seperate them...
            (Math.abs(next.x - r1.x) < Math.abs(next.y - r1.y)) ? r2.y = next.y : r2.x = next.x;
        }
        // Horizontal - moving in x direction
        else if (horizontal) {

            // change to vertical ?
            if (Math.abs(next.y - r2.y) > style$1.bus.split) {

                // create a new segment
                this.wire.push({x:r2.x, y:next.y});
            }
            else {

                // if there are widgets we have to do an additional check - we do not move beyond widgets
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.x < r2.x)&&(next.x < limit.r + wBus/2)) next.x = limit.r + wBus/2;
                    if ((r1.x > r2.x)&&(next.x > limit.l - wBus/2)) next.x = limit.l - wBus/2;
                }

                // set the next x value
                r2.x = next.x;

                // remove the segment if too small 
                if ((L > 2) && (Math.abs(r2.x - r1.x) < style$1.bus.tooClose)) this.wire.pop();
            }
        }
        // Vertical - moving in the y-direction
        else if (vertical) {

            // change to horizontal ?
            if (Math.abs(next.x - r2.x) > style$1.bus.split) {

                // new segment
                this.wire.push({x:next.x, y:r2.y});
            }
            else {
                // if there are widgets we have to do an additional check - we do not move beyond widgets
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.y < r2.y)&&(next.y < limit.b )) next.y = limit.b;
                    if ((r1.y > r2.y)&&(next.y > limit.t - hLabel/2)) next.y = limit.t - hLabel/2;
                }

                // set the next y value
                r2.y = next.y;

                // check if points are getting too close
                if ((L > 2) && (Math.abs(r2.y - r1.y) < style$1.bus.tooClose)) this.wire.pop();
            }
        }

        // reposition the labels of the bus
        this.startLabel.place();
        this.endLabel.place();
    },

    resumeDrawXY(label,pos,delta) {
        // switch the direction of the bus if the startlabel is moved
        if (label == this.startLabel) this.reverse();

        // notation
        const p = this.wire;
        const pa = p[p.length-2];
        const pb = p[p.length-1];

        // check is we need to switch horizontal/vertical
        let x = (pa.x == pb.x)&&(Math.abs(pos.x - pa.x) > style$1.bus.split) ? pos.x : pb.x + delta.x;
        let y = (pa.y == pb.y)&&(Math.abs(pos.y - pa.y) > style$1.bus.split) ? pos.y : pb.y + delta.y;

        // draw the bus
        this.drawXY({x,y});
    },

    // reverses the path of the bus - switches end and start label
    reverse() {
        [this.startLabel, this.endLabel] = [this.endLabel, this.startLabel];

        const p = this.wire;
        const L = p.length;

        // reverse the points - if l is uneven the middle point stays, which is ok
        for (let i=0; i<L/2; i++) [p[i], p[L-i-1]] = [p[L-i-1], p[i]];

        // the segment number for the arrows has to be adapted as well
        this.tacks.forEach( tack => tack.segment = L - tack.segment);
    },

    // returns the zone where there are widgets on the segment
    getLimit(segment) {

        let limit=null;

        this.tacks.forEach( tack => {
            if (tack.segment == segment) {
                const rc = tack.rect;
                if (limit) {
                    if (rc.x < limit.l)         limit.l = rc.x;
                    if (rc.x + rc.w > limit.r)  limit.r = rc.x + rc.w;
                    if (rc.y < limit.t)         limit.t = rc.y;
                    if (rc.y + rc.h > limit.b)  limit.b = rc.y + rc.h;

                }
                else limit = {l: rc.x, r:rc.x + rc.w, t: rc.y, b:rc.y + rc.h};
            }
        });
        return limit
    },

    // move the bus and the tacks - but not the routes - used in selection move
    move(dx, dy) {

        // move all segments
        for(const point of this.wire) {
            point.x += dx;
            point.y += dy;
        }

        // move the labels
        this.startLabel.move(dx,dy);
        this.endLabel.move(dx,dy);

        // move the tacks
        for(const tack of this.tacks) {
            tack.rect.x += dx;
            tack.rect.y += dy;
        }
    },

    // 
    drag(delta) {

       // move all segments
       for(const point of this.wire) {
            point.x += delta.x;
            point.y += delta.y;
        }

        // move the labels
        this.startLabel.move(delta.x, delta.y);
        this.endLabel.move(delta.x, delta.y);

        // move the tacks and the route
        for(const tack of this.tacks) tack.moveXY(delta.x, delta.y);
    },

    // move the routes that originated from the bus
    moveRoutes(x,y) {
        this.tacks.forEach( (tack) => { 
            if (tack.is.tack && tack.route.from == tack) tack.route.moveAllPoints(x,y);
        });
    },

    // returns the widget zone of the two adjacent segments
    getCombinedLimit(s1,s2) {

        let limit1 = this.getLimit(s1);
        let limit2 = this.getLimit(s2);

        if (limit1 && limit2) {
            if (limit2.l < limit1.l) limit1.l = limit2.l;
            if (limit2.r > limit1.r) limit1.r = limit2.r;
            if (limit2.t < limit1.t) limit1.t = limit2.t;
            if (limit2.b > limit1.b) limit1.b = limit2.b;
        }
        return limit1 ? limit1 : limit2
    },

    // move the segment if possible
    moveSegment(segment, delta) {

        // notation
        let p = this.wire;
        const dx = delta.x;
        const dy = delta.y;

        // get the forbidden zone in which the segment cannot move
        let limit = this.getCombinedLimit(segment-1, segment+1);

        // segment is defined by two points
        let a = p[segment-1];
        let b = p[segment];

        // horizontal segment
        if (a.y == b.y) {
            // if the new point is not in the forbidden zone, it can move
            if ((limit == null) || (a.y > limit.b)&&(a.y+dy > limit.b) || (a.y < limit.t)&&(a.y+dy < limit.t)) {
                a.y += dy;
                b.y += dy;

                for (const tack of this.tacks) if (tack.segment == segment) tack.moveY(dy);
            }
        }
        // vertical segment
        else if (a.x == b.x) {
           // if the new point is not in the forbidden zone, it can move
            if ((limit == null) || (a.x > limit.r)&&(a.x+dx > limit.r) || (a.x < limit.l)&&(a.x+dx < limit.l)) {
                a.x += dx;
                b.x += dx;

                for (const tack of this.tacks) if (tack.segment == segment) tack.moveX(dx);
            }
        }
        // labels have to be moved if the first or last segment has been moved
        if (segment == 1) this.startLabel.place(); 
        if (segment == p.length - 1) this.endLabel.place(); 
    },

    placeTacks(segment,dx,dy) {
        for (const tack of this.tacks) tack.orient();
    },

    removeTwoPoints(segment) {

        // remove  the segment from the bus
        const p = this.wire;
        const L = p.length;

        // we remove two points from the array
        for (let i = segment; i < L-2; i++) p[i] = p[i+2];

        // remove the two last points..
        p.pop();
        p.pop();

        // ..and reassign widgets to a different segment...
        this.tacks.forEach( w => { if (w.segment > segment) w.segment -= 2; });
    },

    // check if the segment has to be fused wit previous/next
    fuseSegment(s) {

        let p = this.wire;  

        // check
        if (p.length < 3) return
        
        // notation
        const deltaMin = style$1.bus.tooClose;

        // horizontal segment
        if (p[s-1].y == p[s].y) {

            // check next
            if ((s < p.length-2)&&(Math.abs(p[s+1].y - p[s].y) < deltaMin)) {
                p[s-1].y = p[s+1].y;
                this.removeTwoPoints(s);
            }
            // or previous
            else if ((s > 1)&&(Math.abs(p[s-2].y - p[s-1].y) < deltaMin)) {
                p[s].y = p[s-2].y;
                this.removeTwoPoints(s-2);
            }
        }
        // vertical segment
        else if (p[s-1].x == p[s].x) {

            // check next
            if ((s < p.length-2)&&(Math.abs(p[s+1].x - p[s].x) < deltaMin)) {
                p[s-1].x = p[s+1].x;
                this.removeTwoPoints(s);
            }
            // or previous
            else if ((s > 1)&&(Math.abs(p[s-2].x - p[s-1].x) < deltaMin)) {
                p[s].x = p[s-2].x;
                this.removeTwoPoints(s-2);
            }
        }
        // place the labels - not always necessary but saves time ...
        this.startLabel.place(); 
        this.endLabel.place(); 
    },

    // after a bus move 
    adjustRoutes() {

        for(const tack of this.tacks) {
            tack.route.adjust();
        }
    },

    // closest tack
    closestTack(widget) {
    },

    straightConnections() {

        for(const tack of this.tacks) {

            // take the route
            const route = tack.route;

            // other end of the route
            const other = route.to == tack ? route.from : route.to;

            // get the two points of the bus segment
            let a = this.wire[tack.segment-1];
            let b = this.wire[tack.segment];

            // only vertical segment
            if (a.x == b.x) {

                // arrange
                [a, b] = a.y > b.y ? [b, a] : [a, b];

                // check 
                if (other.rect.y > a.y && other.rect.y < b.y) {

                    // move the tack
                    tack.rect.y = other.rect.y + other.rect.h/2 - tack.rect.h/2;

                    // straighten the route
                    for(const p of route.wire) p.y = other.rect.y + other.rect.h/2;
                }
            }
        }
    }
    
};

// a bus groups a number of connections

function Bus(name, from, uid = null) {

    // unique identifier for the bus
    this.uid = uid;

    // save the name
    this.name = name ?? '';

    // note that a widget id is never 0 ! currently not used
    this.widGenerator = 0;

    // state
    this.is = {
        bus: true,
        selected: false,
        hoverOk: false,
        hoverNok : false,
        highLighted: false,
        cable: false,
        filter: false
    };

    // the filter is a factory.
    this.filter = null;

    // incoming connections
    this.rxTable = [];

    // outgoing connections
    this.txTable = [];

    // set the start and endpoint of the bus before defining the labels
    this.wire = [];
    this.wire.push({x:from.x, y:from.y});
    this.wire.push({x:from.x, y:from.y});

    // w and h for the labels - w is set by place()
    const h = style$1.bus.hLabel;
    const w = 0;

    // now set the labels
    this.startLabel  = new BusLabel({x:0, y:0, w,h}, this);
    this.endLabel = new BusLabel({x:0, y:0, w,h}, this);

    // place the two labels
    this.startLabel.place();
    this.endLabel.place();

    // the contacts on the bus
    this.tacks = [];
}
Bus.prototype = {

    render(ctx) {

        if (this.wire.length < 2) return

        const st = style$1.bus;

        const cLine =     this.is.hoverNok ? st.cBad 
                        : this.is.selected || this.is.hoverOk ? st.cSelected
                        : this.is.highLighted ? st.cHighLighted
                        : st.cNormal;

        // Draw a bus or a cable...
        this.is.cable ? shape.drawCable(ctx,this.wire, cLine, st.wCable) : shape.drawBusbar(ctx,this.wire, cLine, st.wBusbar); 

        // render the two labels
        this.startLabel.render(ctx);
        this.endLabel.render(ctx);

        // also render the tacks
        this.tacks.forEach( tack => tack.render(ctx) );
    },

    generateWid() {
        return ++this.widGenerator
    },

    highLight() {

        // the bus itself
        this.is.highLighted = true;

        // the labels
        this.startLabel.highLight();
        this.endLabel.highLight();

        // the tacks and routes
        for (const tack of this.tacks) tack.route.highLight();
    },

    unHighLight() {
        
        this.is.highLighted = false;

        this.startLabel.unHighLight();
        this.endLabel.unHighLight();

        for (const tack of this.tacks) tack.route.unHighLight();
    },

    // highlight the routes that are connected via the incoming route
    highLightRoutes(other) {

        // highlight the bus
        this.is.highLighted = true;

        // check for the connections to the bus..
        for(const tack of this.tacks) {

            // get the other side of the route
            const widget = tack.route.from == tack ? tack.route.to : tack.route.from;

            // skip the other
            if (widget === other) continue

            // check if connecetd
            if (this.areConnected(other, widget)) {

                // highlight the route
                tack.route.highLight();
            }
        }
    },

    // unhighlight the routes that the tack of this route is connected to
    unHighLightRoutes(other) {

        // unhighlight the bus
        this.is.highLighted = false;

        // check for the connections to the bus..
        for(const tack of this.tacks) {

            // get the other side of the route
            const widget = tack.route.from == tack ? tack.route.to : tack.route.from;

            // skip
            if (widget === other) continue

            // check if connecetd
            if (this.areConnected(other, widget)) {

                // unhighlight
                tack.route.unHighLight();
            }
        }
    },

    // returns zap, bus, label, tack, segment
    hitTest(pos) {

        // check the label
        let label =   inside(pos, this.startLabel.rect) ? this.startLabel 
                    : inside(pos, this.endLabel.rect) ? this.endLabel 
                    : null;
                    
        if (label) return [zap.busLabel, this, label, null, 0]

        // check the segments
        let segment = this.hitSegment(pos);
        if (segment) return [zap.busSegment, this, null, null, segment]

        // check the tacks
        for (const tack of this.tacks) {

            // check if inside the rectangle
            if (inside(pos, tack.rect)) return [zap.tack, this, null, tack, 0]
        }

        // nothing
        return [zap.nothing, null, null, null, 0]
    },

    // returns the segment that was hit
    hitSegment(pos) {

        // notation
        const L = this.wire.length;
        const x = pos.x;
        const y = pos.y;

        // check if the point lies on the route
        for (let i=0; i<L-1; i++) {

            const a = this.wire[i];
            const b = this.wire[i+1];

            // the precision in pixels
            const d = 5;

            // horizontal
            if (a.y == b.y) {
                if ((y > a.y - d) && (y < a.y + d))
                    if (((x >= a.x) && (x <= b.x)) || ((x >= b.x) && (x <= a.x))) return i+1
            }
            // vertical
            else {
                if ((x > a.x - d) && (x < a.x + d))
                    if (((y >= a.y) && (y <= b.y)) || ((y >= b.y) && (y <= a.y))) return i+1
            }
        }

        // no hit
        return 0
    },

    singleSegment() {
        return (this.wire.length === 2)
    },

    hitRoute(pos) {

        let segment = 0;
        for (const tack of this.tacks) {
            if ((tack.route.from == tack)&&(segment = tack.route.hitSegment(pos)))  return [zap.route, tack.route, segment]
        }
        return [zap.nothing, null, 0]
    },

    // check if (part of) the bus is inside the rectangle
    overlap(rect) {
        return segmentsInside(this.wire, rect)?.length > 0 ? true : false
    },

    findTack(from) {
        return this.tacks.find( tack => (tack.route.from == from) || (tack.route.to == from))
    },

    removeTack(tack) {

        eject(this.tacks, tack);
    },

    // make a connection netween a route and the bus segment 
    // the route is conected at the route.to, i.e. route.to is null
    addTack(route) {

        // the other terminal of the route
        const other = route.to == null ? route.from : route.to;

        // we only accept one connection to the bus from the same pin/pad
        if (this.findTack(other)) return null

        // create the widget
        const newTack = new BusTack(this);

        // set the route for this tack
        newTack.setRoute(route);

        // save the tack on this bus
        this.tacks.push(newTack);

        // return the widget
        return newTack
    },

    newTack() {
        // make a tack
        const tack = new BusTack(this);

        // set the tack
        this.tacks.push(tack);

        // done
        return tack
    },

    // copies labels and points - after cloning both buses are still conncted to the same tacks !
    copy() {
        // create a new bus
        const newBus = new Bus( this.name, this.wire[0], this.uid);

        // cable or busbar
        newBus.is.cable = this.is.cable;

        // copy the wire 
        newBus.wire = this.copyWire();

        // place the labels again
        newBus.startLabel.place();
        newBus.endLabel.place();

        // done
        return newBus
    },

    copyTacks(newBus, newRoot) {

        // copy the tacks
        for (const tack of this.tacks) {

            // clone the route - the from and to widgets are still the old ones
            const newRoute = tack.route.clone();

            // make a new tack
            const newTack = new BusTack(newBus);

            // replace the old tack with the new
            newRoute.to.is.tack ?  newRoute.to = newTack : newRoute.from = newTack;

            // set the route
            newTack.setRoute(newRoute);

            // now find the copied node where the route starts - first shorten the notation
            const other = newRoute.to.is.tack ? newRoute.from : newRoute.to;

            // the other end can be a pin or a pad
            if (other.is.pin) {

                // find the other node in the new root 
                const node = newRoot.nodes.find( node => node.uid == other.node.uid);

                // find the other widget
                const pin = node.look.findPin(other.name, other.is.input);

                // and save the newly found other again in the route itself
                newRoute.to.is.tack ? newRoute.from = pin : newRoute.to = pin;

                // save the route also in the other
                pin.routes.push( newRoute );
            }
            else if (other.is.pad) {

                // find the corresponding pad in the newRoot
                const pad = newRoot.pads.find( pd => pd.proxy.name == other.proxy.name);

                // and save the newly found other again in the route itself
                newRoute.to.is.tack ? newRoute.from = pad : newRoute.to = pad;

                // save the route also
                pad.routes.push(newRoute);
            }

            // save the widget in the new bus
            newBus.tacks.push(newTack);
        }
    },

    // used for undo/redo
    copyWire() {
        const copy = [];
        for (const point of this.wire) copy.push({...point});
        return copy
    },

    restoreWire(copy) {
        this.wire = [];
        for (const point of copy) this.wire.push({...point});
    },

    // make a copy of the segment and the route points of the links on the bus
    copyTackWires() {

        const copy = [];
        for (const tack of this.tacks) {
            const track = tack.route.copyWire();
            copy.push({segment: tack.segment, track});
        }
        return copy
    },

    restoreTackWires(copy) {

        // the links and the copy array have the same size !!
        const tacks = this.tacks;
        const L = tacks.length;
        for(let i = 0; i < L; i++) {

            tacks[i].segment = copy[i].segment;
            tacks[i].route.restoreWire(copy[i].track);
        }
    },

    hasFilter(){
        return this.is.filter
        //return (this.is.cable && this.is.filter)
    },

    // returns the arl to be used to get to the source for the filter
    getFilterArl(jslib, link, localIndex) {

        // if there is a link and the link is a library - take that
        if ( link?.model?.is.lib ) return link.model.arl

        // if there is a current lib (ie a lib where a group was defined) use that
        if (jslib) return jslib.arl

        // if the factory arl has been set explicitely, use that
        if (this.filter.arl) return this.filter.arl

        // if the link is a json file, the source can be found via the index file in the directory of that model
        if (link?.model) return link.model.arl.resolve('index.js')
            
        // else we assume the source can be locacted by using the index.js file in the model directory
        return localIndex
    },

    getFilter(srcImports, lib, link) {

       // for a source node find the arl to be used for the source - or take the ./index.js file in the directory of the model
       const filterArl = this.getFilterArl(lib, link, srcImports[0].arl);

       // check if the factoryname is already in use somewhere and use an alias if necessary - else just use the name
       const filterSpec = this.filter.duplicate(srcImports, filterArl) ? `${this.filter.fName} as ${this.filter.alias}` : this.filter.fName;

       // see if the arl is already in the list
       const found = srcImports.find( srcImport => srcImport.arl.equals(filterArl));

       // if we have the file, add the item there if..
       if (found) {

           // ..it is not already in the list..
           const item = found.items.find( item => item == filterSpec);

           // ..if not add it to the list
           if (!item) found.items.push(filterSpec);
       }
       else {
           // add the file and put the first item on the list
           srcImports.push({arl:filterArl, items:[filterSpec]});
       }        
    }
};
Object.assign(Bus.prototype, busConnect, busJsonHandling, busDrawing);

const mouseMoveHandling = {

    // onMouseMove returns true or false to signal if a redraw is required or not...
    onMouseMove(xyLocal,e) {  

        // also this is needed
        let dxdyLocal = {x: e.movementX/this.tf.sx, y: e.movementY/this.tf.sy}; 

        // notation
        const state = this.state;

        // do what we need to do
        switch(state.action) {

            case doing.nothing:
                this.idleMove(xyLocal);
                return false

            case doing.panning:
                this.tf.dx += e.movementX;
                this.tf.dy += e.movementY;
                return true

            case doing.nodeDrag:
                state.node.move(dxdyLocal);
                return true

            case doing.routeDraw:
                this.drawRoute(state.route, xyLocal);
                return true

            case doing.routeDrag:
                // move the route segment - the drag object is the route
                state.route.moveSegment(state.routeSegment,dxdyLocal);
                return true

            case doing.selection:
                // make the rectangle bigger/smaller
                this.selection.resize(dxdyLocal.x, dxdyLocal.y);
                return true

            case doing.selectionDrag:
                this.selection.drag(dxdyLocal);
                return true

            case doing.pinAreaSelect:
                this.selection.pinAreaResize(state.node, xyLocal);
                return true

            case doing.padDrag:
                state.pad.drag(xyLocal, dxdyLocal);
                return true

            case doing.busDraw:
                state.bus.drawXY(xyLocal);
                return true

            case doing.busRedraw:
                state.bus.resumeDrawXY(state.busLabel,xyLocal,dxdyLocal);
                return true

            case doing.busSegmentDrag:
                state.bus.moveSegment(state.busSegment,dxdyLocal);
                return true

            case doing.busDrag:
                state.bus.drag(dxdyLocal);
                return true

            case doing.tackDrag:
                state.tack.slide(dxdyLocal);
                return true

            case doing.pinDrag:
                state.lookWidget.drag(xyLocal);
                return true

            case doing.pinAreaDrag:
                // move the rectangle
                this.selection.pinAreaDrag(dxdyLocal);

                // move the pins
                this.selection.getPinAreaNode().look.dragPinArea(this.selection.widgets, this.selection.rect);
                return true

            case doing.interfaceNameDrag:
                state.lookWidget.drag(xyLocal);
                return true

            case doing.interfaceDrag:

                // move the rectangle
                this.selection.pinAreaDrag(dxdyLocal);

                // swap the widgets if necessary
                this.selection.widgets[0].node.look.swapInterface(xyLocal, this.selection.widgets);
                return true

            case doing.pinClicked:

            // for a simple pin selection we check the keys that were pressed again
            switch(this.keyMask(e)) {

                case NONE: {

                    // if still inside the node - nothing to do
                    if (inside(xyLocal, state.lookWidget.node.look.rect)) return false

                    // draw a route - set the action
                    this.stateSwitch(doing.routeDraw);

                    // create a new route - only the from widget is known
                    state.route = new Route(state.lookWidget, null);

                    // this is the route we are drawing
                    state.route.select();

                    // if the pin we are starting from is a multi message pin, set the route as a twisted pair
                    if (state.lookWidget.is.multi) state.route.setTwistedPair();

                    // add the route to the widget
                    state.lookWidget.routes.push(state.route);  
                    
                    // done 
                    return true
                }

                case SHIFT:{

                    // un highlight the routes
                    state.lookWidget.unHighLightRoutes();

                    // first switch the state - might end the previous selection !
                    this.stateSwitch(doing.pinAreaSelect);

                    // ..and only then start a new selection
                    this.selection.pinAreaStart(state.node,xyLocal);

                    // done 
                    return true
                }

                case CTRL:{

                    // notation
                    const pin = state.lookWidget;

                    // set the widget as selected
                    pin.is.selected = true;

                    // set state to drag the pin/proxy up and down
                    this.stateSwitch(doing.pinDrag); 

                    // save the edit
                    editor.doEdit('pinDrag',{pin});

                    // done
                    return true
                }

                // if ctrl-shift is pushed we extrude a pad
                case CTRL|SHIFT: {

                    // if still inside the node - nothing to do
                    if (inside(xyLocal, state.lookWidget.node.look.rect)) return false

                    // un highlight the routes
                    state.lookWidget.unHighLightRoutes();

                    // do the edit
                    editor.doEdit('extrudePad',{view: this, pos: xyLocal});

                    // only switch state if the extrusion was successfull
                    if (this.state.pad) {

                        // state switch
                        this.stateSwitch(doing.padDrag);

                        // highlight the pad 
                        for (const route of this.state.pad.routes) route.highLight();
                    }
                    // done
                    return true
                }
            }
            return false

            case doing.interfaceNameClicked:

                // if not moving do nothing
                if ( inside(xyLocal, this.selection.widgets[0].rect)) return false;

                // moving: unselect the node
                this.selection.nodes[0].unSelect();

                // // set a selection rectangle around the selected pins
                // this.selection.pinAreaRectangle()

                // // switch to dragging the ifName
                // this.stateSwitch(doing.interfaceDrag) 

                // // notation
                // const pins = this.selection.widgets

                // // do the edit
                // editor.doEdit('interfaceDrag',{ group: pins.slice(), oldY: pins[0].rect.y, newY: pins[0].rect.y})
                return true;

            case doing.padArrowClicked:
                // if we move away from the current pin, we start drawing the route
                if ( !inside(xyLocal, state.pad.rect)) {

                    // set the action
                    this.stateSwitch(doing.routeDraw);

                    // create a new route - only the from widget is known
                    state.route = new Route(state.pad, null);

                    // if the pad we are starting from is a multi message pin, set the route as a twisted pair
                    if (state.pad.proxy.is.multi) state.route.setTwistedPair();

                    // this is the route we are drawing
                    state.route.select();

                    // add the route to the widget
                    state.pad.routes.push(state.route);          
                }
                return true

            default:
                return false
        }
    },

    idleMove(xyLocal) {

        // if the timer is running return
        if (this.hitTimer) return false

        // launch a timer
        // this.hitTimer = setTimeout(()=> {
        //     this.hitTimer = 0
        //     this.mouseHit(xyLocal)
        // } ,100)

        return false
    },

    drawRoute(route, xyLocal) {

        // check if we have hit something with our route ...
        this.mouseHit(xyLocal);

        // the following objects have a hover-state
        const hit = this.hit;
        const conx =  hit.what == zap.pin ? hit.lookWidget 
                    : hit.what == zap.pad ? hit.pad 
                    : hit.what == zap.busSegment ? hit.bus
                    : null;

        // give visual feedback if we hover over a connectable object
        this.hover( conx, conx ? route.checkConxType(route.from, conx) : false );

        // draw the route
        if (conx && (conx.is.pin || conx.is.pad))
            route.endpoint(conx);
        else 
            route.drawXY(xyLocal);
    },

    // clear or set the hover object and set the hover state to ok or nok
    hover(hoverOver, ok) {

        this.hit;
        const state = this.state;

        // most frequent case
        if (state.hoverOver == hoverOver) return

        // check if we were hovering
        if (hoverOver) {

            hoverOver.is.hoverOk = ok;
            hoverOver.is.hoverNok = !ok;

            // keep or reset previous
            if (state.hoverOver) {
                this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false;
            }

            // set new
            state.hoverOver = hoverOver;
        } 
        else {
            // reset previous
            if (state.hoverOver) {
                this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false;
                this.state.hoverOver = null;
            }
        }
    },

    stopHover() {
        if (this.state.hoverOver) {
            this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false;
            this.state.hoverOver = null;
        }
    }

};

const mouseDownHandling = {

    saveHitSpot(xyLocal, e) {

        const hit = this.hit;

        // save the hit coordinates
        hit.xyLocal.x = xyLocal.x;
        hit.xyLocal.y = xyLocal.y;
        hit.xyScreen.x = e.x;
        hit.xyScreen.y = e.y;
    },

    onMouseDown(xyLocal, e) {

        // notation
        const state = this.state;
        const hit = this.hit;

        // save the hitspot
        this.saveHitSpot(xyLocal, e);

        // get the binary keys mask
        const keys = this.keyMask(e);

        // check what was hit inside the window - with ctrl-alt we just look for the routes !
        keys === (CTRL|ALT) ?  this.mouseHitRoutes(xyLocal) : this.mouseHit(xyLocal);

        // check if we need to cancel the selection
        if (this.selection.canCancel(hit)) this.selection.reset();

        // check what we have to do
        switch(hit.what){

            case zap.pin: {

                switch(keys) {

                    case NONE:
                    case CTRL|SHIFT: {

                        // save the widget & node
                        state.lookWidget = hit.lookWidget;
                        state.node = hit.node;

                        // and highlight the routes
                        hit.lookWidget.highLightRoutes();

                        // new state
                        this.stateSwitch(doing.pinClicked);

                        // set the node and pin as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget);
                    }
                    break

                    case SHIFT:{

                        // save the node
                        state.node = hit.node;

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.pinAreaSelect);

                        // ..and only then start a new selection
                        this.selection.pinAreaStart(hit.node,xyLocal);
                    }
                    break

                    case CTRL:{

                        // notation
                        const pin = hit.lookWidget;

                        // save the pin/proxy to drag..
                        state.lookWidget = pin;

                        // set the node and pin as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget);

                        // set state to drag the pin/proxy up and down
                        this.stateSwitch(doing.pinDrag); 

                        // save the edit
                        editor.doEdit('pinDrag',{pin});
                    }
                    break
                }
            }
            break

            case zap.ifName : {

                switch(keys) {

                    case NONE:{

                        // set the node as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget);

                        // highlight the ifName group
                        this.selection.widgets = hit.node.look.highLightInterface(hit.lookWidget);

                        // state switch
                        this.stateSwitch(doing.interfaceNameClicked); 
                    }
                    break

                    case SHIFT:{
                       // save the node
                       state.node = hit.node;

                       // first switch the state - might end the previous selection !
                       this.stateSwitch(doing.pinAreaSelect);

                       // ..and only then start a new selection
                       this.selection.pinAreaStart(hit.node,xyLocal);
                    }
                    break

                    case CTRL:{

                        // set the node as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget);

                        // highlight the ifName group
                        this.selection.widgets = hit.node.look.highLightInterface(hit.lookWidget);

                        // set a selection rectangle around the selected pins
                        this.selection.pinAreaRectangle();

                        // notation
                        const pins = this.selection.widgets;

                        // do the edit
                        editor.doEdit('interfaceDrag',{ group: pins.slice(), oldY: pins[0].rect.y, newY: pins[0].rect.y});

                        // switch to dragging the ifName
                        this.stateSwitch(doing.interfaceDrag); 
                    }
                    break

                    case CTRL|SHIFT:{
                        // Save the edit
                        editor.doEdit('interfaceNameDrag',{ifName: hit.lookWidget});

                        // save the widget
                        this.state.lookWidget = hit.lookWidget;

                        // set the node as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget);

                        // switch to dragging the ifName
                        this.stateSwitch(doing.interfaceNameDrag);
                    }
                    break
                }
            }
            break

            case zap.icon: {

                switch(keys) {

                    case NONE:
                    case SHIFT: {
                        // set the node as selected
                        this.selection.singleNode(hit.node);

                        // exceute the iconclick action
                        hit.node.iconClick(this, hit.lookWidget, {x:e.clientX, y:e.clientY});
                    }
                    break

                    case CTRL:{

                        // set the node as selected
                        this.selection.singleNode(hit.node);

                        hit.node.iconCtrlClick(this, hit.lookWidget, {x:e.clientX, y:e.clientY}, editor);
                    }
                    break
                }
            }
            break

            case zap.header: {

                switch(keys) {

                    case NONE:
                    case SHIFT: {
                        // set the node as selected
                        this.selection.singleNode(hit.node);

                        // start dragging the node
                        this.stateSwitch(doing.nodeDrag);
                        state.node = hit.node;

                        // do the edit (saves the position)
                        editor.doEdit('nodeDrag',{view:this, node: hit.node});
                    }
                    break

                    case CTRL:{

                        // extend the current selection - set the node as selected
                        this.selection.extend(hit.node);

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag);

                        // drag the node
                        editor.doEdit('selectionDrag',{view: this});
                    }
                    break
                }
            }
            break

            case zap.node: {

                switch(keys) {

                    case NONE:{

                        // set the node as selected
                        this.selection.singleNode(hit.node);

                        // start dragging the node
                        this.stateSwitch(doing.nodeDrag);
                        state.node = hit.node;

                        // do the edit (saves the position)
                        editor.doEdit('nodeDrag',{view:this, node: hit.node});
                    }
                    break

                    case SHIFT: {

                        // save the node
                        state.node = hit.node;

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.pinAreaSelect);

                        // ..and only then start a new selection
                        this.selection.pinAreaStart(hit.node,xyLocal);
                    }
                    break

                    case CTRL:{

                        // extend the current selection - set the node as selected
                        this.selection.extend(hit.node);

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag);

                        // drag the node
                        editor.doEdit('selectionDrag',{view: this});
                    }
                    break
                }
            }
            break

            case zap.route: {

                switch(keys) {

                    case NONE:
                    case CTRL|ALT:{

                        // the edit will save the current track
                        editor.doEdit('routeDrag', {route: hit.route});

                        // select the route
                        hit.route.select();

                        // save & change the state
                        this.stateSwitch(doing.routeDrag);
                        state.route = hit.route;
                        state.routeSegment = hit.routeSegment;
                    }
                    break

                    case SHIFT:{

                        //The old route is saved if it would need to be restored
                        editor.doEdit('deleteRoute',{route: hit.route});
                    
                        // and start rerouting
                        hit.route.resumeDrawing(hit.routeSegment, xyLocal);

                        // and now select the route
                        hit.route.select();

                        // stateswitch
                        this.stateSwitch(doing.routeDraw);
                        state.route = hit.route;
                    }
                    break
                }
            }
            break

            case zap.pad: {

                switch(keys) {

                    case NONE:{
                        // save the pad
                        state.pad = hit.pad;

                        // if we drag the pad, make sure it is the to-widget in the routes
                        hit.pad.checkRoutesDirection();

                        // highlight the pad routes
                        hit.pad.highLightRoutes();

                        // new state
                        this.stateSwitch(doing.padDrag);

                        // the edit
                        editor.doEdit('padDrag', {pad: hit.pad});
                    }
                    break
                }
            }
            break

            case zap.padArrow: {

                switch(keys) {

                    case NONE:{

                        // save the pad
                        state.pad = hit.pad;

                        // highlight the pad routes
                        for (const route of hit.pad.routes) route.highLight();

                        // change the state
                        this.stateSwitch(doing.padArrowClicked);
                    }
                    break
                }
            }
            break

            case zap.selection: {
                switch(keys) {

                    case NONE:{
                        if (this.selection.what == selex.freeRect){  
                            
                            // drag the whole selection
                            editor.doEdit('selectionDrag', {view: this});
                            this.stateSwitch(doing.selectionDrag);
                        }
                    }
                    break

                    // on shift we restart the selection
                    case SHIFT:{

                        if (hit.node) {
                            // save the node
                            state.node = hit.node;
    
                            // ..and only then start a new selection
                            this.selection.pinAreaStart(hit.node, xyLocal);

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.pinAreaSelect);
                        }
                        else if (this.selection.what == selex.pinArea) {
    
                            // ..and only then start a new selection
                            this.selection.pinAreaStart(this.selection.getPinAreaNode(), xyLocal);

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.pinAreaSelect);
                        }
                        else {
                            // ..and only then start a new selection
                            this.selection.freeStart(xyLocal);

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.selection);
                        }
                    }
                    break

                    case CTRL:{

                        switch(this.selection.what) {

                            case selex.singleNode:
                            case selex.multiNode: 

                                if (hit.node) this.selection.extend(hit.node);

                            break;

                            case selex.pinArea:

                                // set state to drag the pin/proxy up and down
                                this.stateSwitch(doing.pinAreaDrag); 

                                // save the edit - the view contains the selection
                                editor.doEdit('pinAreaDrag', this);

                            break;
                        }

                    }
                    break
                }
            }
            break

            case zap.busLabel: {
                switch(keys) {

                    case NONE:{
                        // change state
                        this.stateSwitch(doing.busRedraw);
                        state.bus = hit.bus;
                        state.busLabel = hit.busLabel;
                        state.bus.is.selected = true;

                        // highlight the bus and its connections
                        state.bus.highLight();

                        // start the busdraw
                        editor.doEdit('busDraw',{bus:hit.bus});
                    }
                    break
                }


            }
            break

            case zap.busSegment: {
                
                switch(keys) {

                    case NONE:{

                        // save state
                        state.bus = hit.bus;
                        state.busSegment = hit.busSegment;
                        state.bus.is.selected = true;

                        // highlight the bus and its connections
                        hit.bus.highLight();

                        // allow free movement for a single segment...
                        if (hit.bus.singleSegment()) {
                            this.stateSwitch(doing.busDrag); 
                            editor.doEdit('busDrag', {bus: hit.bus}); 
                        }
                        else {
                            this.stateSwitch(doing.busSegmentDrag);
                            editor.doEdit('busSegmentDrag', {bus: hit.bus});
                        }
                    }
                    break

                    case SHIFT:                    break

                    case CTRL:{

                        // also save the bus
                        state.bus = hit.bus;
                        state.bus.is.selected = true;

                        // change state
                        this.stateSwitch(doing.busDrag);

                        // start the drag
                        editor.doEdit('busDrag', {bus: hit.bus});
                    }
                    break
                }


            }
            break

            case zap.tack: {
                switch(keys) {

                    case NONE:{

                        // change state
                        this.stateSwitch(doing.tackDrag);
                        state.tack = hit.tack;
                        state.tack.route.select();

                        // start the tackdrag
                        editor.doEdit('tackDrag', {tack: hit.tack});
                    }
                    break

                    case SHIFT:{

                        // notation
                        const route = hit.tack.route;

                        // stateswitch
                        this.stateSwitch(doing.routeDraw);
                        state.route = route;

                        //save the old route
                        editor.doEdit('deleteRoute',{route});

                        // and start rerouting from the last segment
                        route.resumeDrawing(route.wire.length-1, xyLocal);      

                        // select the route
                        route.select();
                    }
                    break
                }


            }
            break

            case zap.nothing: {

                switch(keys) {

                    case NONE:{

                        // switch state
                        this.stateSwitch(doing.panning);

                        // save the current position
                        editor.doEdit('panning', {view:this});
                    }
                    break

                    case SHIFT:{

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.selection);

                        // ..and only then start a new selection
                        this.selection.freeStart(xyLocal);
                    }
                    break
                }
            }
            break
        }
    },    

};

const mouseUpHandling = {

    onMouseUp(xyLocal,e) {

        // see what we have hit...
        this.mouseHit(xyLocal);

        // if we need to adjust the undo parameters...
        let undo = null;

        // check the state state
        switch (this.state.action) {

            case doing.routeDraw: 
                // notation
                const route = this.state.route;

                // deselect the route
                route.unSelect();

                // keep the pin highlighted, but un highlight the other routes
                route.from.unHighLightRoutes();

                // no more hovering
                this.stopHover();

                // what did we hit..
                const conx = this.hit.lookWidget ?? this.hit.bus ?? this.hit.pad ?? null;

                // complete the route or cancel it...
                route.connect(conx) ? editor.doEdit('routeDraw',{route}) : route.popFromRoute();

                break

            case doing.routeDrag:
                // check if we should combine two segments
                this.state.route.endDrag(this.state.routeSegment);
                this.state.route.unSelect();

                // save the new situation
                editor.getParam().newWire = this.state.route.copyWire();
                break

            case doing.selection:
                if (this.selection.rect) this.getSelected(this.selection.rect);
                break

            case doing.selectionDrag:
                // adjust the parameters for the undo operation
                editor.getParam().newPos = {x: this.selection.rect.x, y: this.selection.rect.y};
                break

            case doing.pinAreaSelect:
                break

            case doing.nodeDrag: 
                // get the node being dragged
                const node = this.state.node;

                // remove 'kinks' in the routes
                node.look.snapRoutes();

                // get the parameters
                const param = editor.getParam();

                // adjust the parameters for the undo operation
                param.newPos = {x: node.look.rect.x, y: node.look.rect.y};

                // do a node drag check - if too small remove from redox stack
                if (blockDistance(param.oldPos, param.newPos) < style$1.look.smallMove) {

                    // move the node back, but keep the y value to keep the 'snap' intact (?)
                    node.move({x: param.oldPos.x - param.newPos.x, y:0});

                    // don't save the edit
                    editor.dropLastEdit();
                }
                break

            case doing.busDraw:
            case doing.busRedraw:
                this.state.bus.is.selected = false;

                // remove highlight
                this.state.bus.unHighLight();

                // adjust the parameters for the undo operation
                editor.getParam().newWire = this.state.bus.copyWire();
                break

            case doing.busSegmentDrag:
                this.state.bus.fuseSegment(this.state.busSegment);
                this.state.bus.is.selected = false;

                // remove highlight
                this.state.bus.unHighLight();

                // adjust the parameters for the undo operation
                undo = editor.getParam();
                undo.newWire = this.state.bus.copyWire();
                undo.newTackWires = this.state.bus.copyTackWires();
                break

            case doing.busDrag:
                //this.state.bus.fuseSegment(this.state.busSegment)
                this.state.bus.is.selected = false;

                // adjust the parameters for the undo operation
                undo = editor.getParam();
                undo.newWire = this.state.bus.copyWire();
                undo.newTackWires = this.state.bus.copyTackWires();
                break

            case doing.padDrag: 
                // notation
                const pad = this.state.pad;

                // stop dragging
                pad.endDrag();

                // remove the highlights
                pad.unHighLightRoutes();
                //for (const route of pad.routes)  route.unHighLight()

                // the undo verb could be an extrudePad
                if (editor.getVerb() == 'extrudePad') break

                // no, adjust the parameters
                undo = editor.getParam();
                undo.newPos = {x:pad.rect.x, y:pad.rect.y};
                undo.newWires = pad.copyWires();
                break

            case doing.tackDrag:
                // notation
                const tack = this.state.tack;
                tack.fuseEndSegment();
                tack.route.unSelect();

                // adjust the parameters for the undo operation
                editor.getParam().newWire = tack.route.copyWire();
                break

            case doing.pinDrag:

                // notation
                const pin = this.state.lookWidget;

                // un highlight the routes
                this.state.lookWidget.unHighLightRoutes();

                // save the new position
                editor.getParam().newPos = {left: pin.is.left, y: pin.rect.y};
                break

            case doing.pinAreaDrag:
                editor.getParam().newY = this.selection.widgets[0].rect.y;
                break

            case doing.interfaceNameDrag: {

                // notation
                const ifName = this.state.lookWidget;

                // save the new position
                editor.getParam().newY = ifName.rect.y;
            }
            break

            case doing.interfaceDrag: {

                // notation
                const ifName = this.selection.widgets[0];

                // remove the highlights when moving away from the ifName
                ifName?.node.look.unhighLightInterface(this.selection.widgets);

                // adjust the undo parameter
                editor.getParam().newY = ifName.rect.y;

                // done - set the widget and node as selected
                this.selection.singleNodeAndWidget(ifName.node, ifName);
            }
            break;

            case doing.interfaceNameClicked: {

                // notation
                const ifName = this.selection.widgets[0];

                // remove the highlights when moving away from the ifName
                ifName?.node.look.unhighLightInterface(this.selection.widgets);
            }
            break;

            case doing.pinClicked:

                // un highlight the pin
                this.state.lookWidget.unHighLight();

                // unhighlight the routes
                this.state.lookWidget.unHighLightRoutes();
                break

            case doing.padArrowClicked:
                this.state.pad.unHighLight();
                for (const route of this.state.pad.routes) route.unHighLight();
                break
        }
        // reset the state
        this.stateSwitch(doing.nothing);
    },

};

const bgCxMenu = {

	choices:[
		{text:'new group node',	icon:'account_tree',char:'ctrl g',	state:"enabled",	action:newGroupNode},
		{text:'new source node',icon:'factory',		char:'ctrl s', 	state:"enabled",	action:newSourceNode},
		{text:'new busbar',		icon:'swap_horiz',  char:'ctrl b',	state:"enabled",	action:newBusbar},
		{text:'new cable',		icon:'cable',  		char:'ctrl k',	state:"enabled",	action:newCable},
		{text:'new input pad',	icon:'new_label',	char:'ctrl i', 	state:"enabled",	action:newInputPad},
		{text:'new output pad',	icon:'new_label',	char:'ctrl o', 	state:"enabled",	action:newOutputPad},
		{text:'select node',	icon:'play_arrow',	char:'ctrl n', 	state:"enabled",	action:selectNode},
		{text:"paste as link",	icon:"link",		char:'ctrl l',	state:"enabled", 	action:linkFromClipboard},
		{text:"paste",			icon:"content_copy",char:'ctrl v',	state:"enabled", 	action:pasteFromClipboard},
	],

	view:null,
	xyLocal:null,
	xyScreen:null,

	// prepare the menu list before showing it
	prepare(view) {

		this.view = view;
		this.xyLocal = view.hit.xyLocal;
		this.xyScreen = view.hit.xyScreen;
	}
};

function newGroupNode() { 				   
	editor.doEdit('newGroupNode',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal});
}

function newSourceNode() {
	editor.doEdit('newSourceNode',{view: bgCxMenu.view,pos: bgCxMenu.xyLocal});
}

function newBusbar() {
	editor.doEdit('busCreate',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, cable:false});
}

function newCable() {
	editor.doEdit('busCreate',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, cable:true});
}

function newInputPad() {
	editor.doEdit('padCreate', {view: bgCxMenu.view,pos: bgCxMenu.xyLocal, input:true});
}

function newOutputPad() {
	editor.doEdit('padCreate', {view: bgCxMenu.view,pos: bgCxMenu.xyLocal, input: false});
}

function selectNode() {
	editor.tx.send("select node", {xyScreen: bgCxMenu.xyScreen, xyLocal:bgCxMenu.xyLocal});
}

function linkFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		// check
		if ((clipboard.selection.what == selex.nothing) || (clipboard.selection.what == selex.pinArea)) return

		// do the edit
		editor.doEdit('linkFromClipboard',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, clipboard});
	});
	//.catch( error => console.log('link from context menu: clipboard get error -> ' + error))
}

function pasteFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		// check
		if (clipboard.selection.what == selex.nothing || clipboard.selection.what == selex.pinArea) return

		// do the edit
		editor.doEdit('pasteFromClipboard',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, clipboard});
	});
	//.catch( error => console.log('paste from context menu: clipboard get error -> ' + error))
}

// click on the node
const nodeCxMenu = {

	choices: [
		{text:"",			char:'h',	state:"enabled", action:nodeHighLight,	icon:"highlight"},
		{text:"add label",	char:'a',	state:"enabled",action:addLabel,		icon:"sell"},
		{text:"wider", 		char:'ctrl +',	state:"enabled", action:wider,			icon:"open_in_full"},
		{text:"smaller",	char:'ctrl -', 	state:"enabled", action:smaller,		icon:"close_fullscreen"},
		{text:"copy",		char:'ctrl c',state:"enabled", action:nodeToClipboard,icon:"content_copy"},
		{text:"source to clipboard",	state:"enabled", action:sourceToClipboard,icon:"content_paste"},
		{text:"make a test node",		state:"enabled", action:makeTestNode,icon:"done_all"},
		{text:"",						state:"enabled", action:convertNode,	icon:"sync"},
		{text:"cut link",				state:"enabled", action:cutLink,		icon:"link_off"},
		{text:"get from link",			state:"enabled", action:getFromLink,	icon:"link"},
		{text:"save to link",			state:"enabled", action:saveToLink,		icon:"add_link"},
		{text:"ungroup",				state:"enabled", action:unGroup, 		icon:"schema",},
		{text:"disconnect", char:'clear',state:"enabled", action:disconnectNode,icon:"power_off"},
		{text:"delete", 	char:'del',	state:"enabled", action:deleteNode,		icon:"delete"},
	],

	view:null,
	node:null,
	xyLocal: null,

	// prepres the menu list before showing it
	prepare(view) {

		this.view = view;
		this.xyLocal = view.hit.xyLocal;
		this.node = view.hit.node;

		// some choices will be enable or changed
		let choice = this.choices.find( choice => choice.action == sourceToClipboard);
		choice.state = this.node.is.source ? "enabled" : "disabled";

		choice = this.choices.find( choice => choice.action == convertNode);
		choice.state = this.node.link ? "disabled" : "enabled";
		choice.text = this.node.is.group ? "convert to source node" : "convert to group node";

		choice = this.choices.find( choice => choice.action == nodeHighLight);
		choice.text = this.node.is.highLighted ? "remove highlight" : "highlight routes";

		choice = this.choices.find( choice => choice.action == cutLink);
		choice.state = this.node.link ? "enabled" : "disabled";

		choice = this.choices.find( choice => choice.action == saveToLink);
		choice.state = this.node.link ? "disabled" : "enabled";

		choice = this.choices.find( choice => choice.action == getFromLink);
		choice.state = this.node.link ? "disabled" : "enabled";

		choice = this.choices.find( choice => choice.action == unGroup);
		choice.state = this.node.is.group ? "enabled" : "disabled";
	},
};

// the actions 
function addLabel() {
	editor.doEdit('addLabel',{node: nodeCxMenu.node});
}

function wider() {
	editor.doEdit('wider', {node: nodeCxMenu.node});
}

function smaller() {
	editor.doEdit('smaller', {node: nodeCxMenu.node});
}

function nodeHighLight() {
	editor.doEdit('nodeHighLight', {node:nodeCxMenu.node});
}

function nodeToClipboard() {
	editor.doEdit('nodeToClipboard', {view:nodeCxMenu.view, node:nodeCxMenu.node});
}

function convertNode() {
	editor.doEdit('convertNode',{node:nodeCxMenu.node});
}

function makeTestNode() {
}

function sourceToClipboard() {
	editor.doEdit('sourceToClipboard',{node:nodeCxMenu.node});
}

function disconnectNode() {
	editor.doEdit('disconnectNode',{node:nodeCxMenu.node});
}

function deleteNode() {
	editor.doEdit('deleteNode',{node:nodeCxMenu.node});
}

// make the node local, ie break the link....
function cutLink() {
	editor.doEdit('cutLink',{node:nodeCxMenu.node});
}

// type in the name of a model and try to find the requested node in that model
function getFromLink() {
	nodeCxMenu.node.showLinkForm(nodeCxMenu.xyLocal);
}

// save the node to a file, ie change it into a link
function saveToLink() {
	nodeCxMenu.node.showExportForm(nodeCxMenu.xyLocal);
}          		

function unGroup() {
	editor.doEdit('unGroup', {view: nodeCxMenu.view, node: nodeCxMenu.node});
}

const noLink = [

	{text:"new output",		char:'o', icon:"logout",state:"enabled", action:newOutput},
	{text:"new input",		char:'i', icon:"login",state:"enabled", action:newInput},
	{text:"new ifName",  char:'p', icon:"drag_handle",state:"enabled", action:newInterfaceName},
	{text:"new request",	char:'q', icon:"switch_left",state:"enabled", action:newRequest},
	{text:"new reply",		char:'r', icon:"switch_right",state:"enabled", action:newReply},
	{text:"change to output",	  	  icon:"cached",state:"disabled", action:inOutSwap},
	{text:"add channel",	  	  	  icon:"adjust",state:"disabled", action:channelOnOff},
	{text:"paste pins",		char:'ctrl v',icon:"content_copy",state:"enabled", 	action:pasteWidgetsFromClipboard},
	{text:"profile",				  icon:"info",state:"disabled", action:showProfile},
	{text:"all pins swap left right", icon:"swap_horiz",state:"enabled", action:pinsSwap$1},
	{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:pinsLeft$1},
	{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:pinsRight$1},
	{text:"disconnect",				  icon:"power_off",state:"disabled", action:disconnectPin},
	{text:"delete",					  icon:"delete",state:"enabled", action:deletePin},

];

const withLink = [

	{text:"profile",				  icon:"info",state:"disabled", action:showProfile},
	{text:"all pins swap left right", icon:"swap_horiz",state:"enabled", action:pinsSwap$1},
	{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:pinsLeft$1},
	{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:pinsRight$1},
	{text:"disconnect",				  icon:"power_off",state:"disabled", action:disconnectPin},

];

// click on the node
const pinAreaCxMenu = {

	choices: null,

	view: null,
	node: null,
	widget: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view) {

		this.view = view;
		this.node = view.hit.node;
		this.widget = view.hit.lookWidget;
		this.xyLocal = view.hit.xyLocal;
		this.xyScreen = view.hit.xyScreen;

		// linked nodes hve much less options
		if (this.node.link) {

			// The number of options is reduced
			this.choices = withLink;

			// only pins can be disconnected
			let entry = this.choices.find( c => c.action == disconnectPin);
			entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

			// profiles are only available for pins
			entry = this.choices.find( c => c.action == showProfile);
			entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

			return
		}
		
		this.choices = noLink;

		// only pins can be disconnected
		let entry = this.choices.find( c => c.action == disconnectPin);
		entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

		// swap input to output
		entry = this.choices.find(c => c.action == inOutSwap);
		let enable = this.widget?.is.pin && this.widget.routes.length == 0;
		entry.state = enable ? "enabled" : "disabled";
		entry.text = (enable && this.widget.is.input ) ? "change to output" : "change to input";

		// switch channel on or off
		entry = this.choices.find(c => c.action == channelOnOff);
		enable = this.widget?.is.pin; // && ! this.widget.is.proxy
		entry.state = enable ? "enabled" : "disabled";
		entry.text = (enable && this.widget.is.channel ) ? "remove channel" : "add channel";

		// profiles are only available for pins
		entry = this.choices.find( c => c.action == showProfile);
		entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

		// switch the delete action 
		entry = this.choices.find( c => c.text == "delete");
		entry.action = this.widget?.is.pin ? deletePin : this.widget?.is.ifName ? deleteInterfaceName : ()=>{};

		// check if there are pins to paste
		entry = this.choices.find( c => c.text == "paste pins");
	},
};

// is = {channel, input, request, proxy}
function newInput() {

	pinAreaCxMenu.node?.cannotBeModified();

	// set the flags
	const is = {	channel: false, 
					input: true, 
					proxy: pinAreaCxMenu.node.is.group
				};
	editor.doEdit('newPin',{view: pinAreaCxMenu.view, node:pinAreaCxMenu.node, pos:pinAreaCxMenu.xyLocal, is});
}
function newOutput() {
	// set the flags
	const is = {	channel: false, 
					input: false, 
					proxy: pinAreaCxMenu.node.is.group
				};
	editor.doEdit('newPin',{view: pinAreaCxMenu.view, node:pinAreaCxMenu.node, pos:pinAreaCxMenu.xyLocal, is});
}
function newRequest() {
	// set the flags
	const is = {	channel: true, 
					input: false, 
					proxy: pinAreaCxMenu.node.is.group
				};
	editor.doEdit('newPin',{view: pinAreaCxMenu.view, node:pinAreaCxMenu.node, pos:pinAreaCxMenu.xyLocal, is});
}
function newReply() {
	// set the flags
	const is = {	channel: true, 
					input: true, 
					proxy: pinAreaCxMenu.node.is.group
				};
	editor.doEdit('newPin',{view: pinAreaCxMenu.view, node:pinAreaCxMenu.node, pos:pinAreaCxMenu.xyLocal, is});
}
function inOutSwap() {
	editor.doEdit('ioSwap',{pin: pinAreaCxMenu.widget});
}
function channelOnOff() {
	editor.doEdit('channelOnOff',{pin: pinAreaCxMenu.widget});
}
function disconnectPin() {
	editor.doEdit('disconnectPin', {pin: pinAreaCxMenu.widget});
}
function deletePin() {
	editor.doEdit('deletePin',{view: pinAreaCxMenu.view,pin: pinAreaCxMenu.widget});
}
function newInterfaceName() {
	editor.doEdit('newInterfaceName', {view: pinAreaCxMenu.view, node:pinAreaCxMenu.node, pos: pinAreaCxMenu.xyLocal});
}
function deleteInterfaceName() {
	editor.doEdit('deleteInterfaceName',{view: pinAreaCxMenu.view,ifName: pinAreaCxMenu.widget});
}
function showProfile(e) {
	editor.doEdit('showProfile',{pin: pinAreaCxMenu.widget, pos: {x:pinAreaCxMenu.xyScreen.x, y:pinAreaCxMenu.xyScreen.y + 10}});
}

function pinsSwap$1()  {
	editor.doEdit('swapPins',{node:pinAreaCxMenu.node,left:true, right:true});
}

function pinsLeft$1()  {
	editor.doEdit('swapPins',{node:pinAreaCxMenu.node,left:true, right:false});
}
function pinsRight$1() {
	editor.doEdit('swapPins',{node:pinAreaCxMenu.node,left:false, right:true});
}
function pasteWidgetsFromClipboard()  {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		editor.doEdit('pasteWidgetsFromClipboard',{	view: pinAreaCxMenu.view, clipboard});
	});
	//.catch( error => console.log('paste: clipboard get error -> ' + error))
}

const selectFreeCxMenu = {

	choices: [
        {text:"align left",icon:"align_horizontal_left",state:"enabled",action: () => alignVertical(true)},
        {text:"align right",icon:"align_horizontal_right",state:"enabled",action: () => alignVertical(false)},
        {text:"align top",icon:"align_vertical_top",state:"enabled",action:() => alignHorizontal(true)},
        {text:"distribute vertically",icon:"vertical_distribute",state:"enabled",action:spaceVertical},
        {text:"distribute horizontally",icon:"horizontal_distribute",state:"enabled",action:spaceHorizontal},
		{text:"copy",icon:"content_copy",state:"enabled", action:selectionToClipboard$1},
        {text:"group",icon:"developer_board",state:"enabled", action:group},
        {text:"disconnect",icon:"power_off",state:"enabled", action:disconnect$2},
        {text:"delete",icon:"delete",state:"enabled", action:deleteSelection},
    ],

    view: null,
	xyLocal:null,

    prepare(view) {

        this.view = view;
        this.xyLocal = view.hit.local;
    }
};
// align vertical we do for nodes and pads
function alignVertical(left) {
    editor.doEdit('alignVertical',{view: selectFreeCxMenu.view, left});
}
// align top we only do for nodes 
function alignHorizontal(top) {
    editor.doEdit('alignHorizontal',{view: selectFreeCxMenu.view, top});
}
function spaceVertical() {
    editor.doEdit('spaceVertical',{view: selectFreeCxMenu.view});
}
function spaceHorizontal() {
    editor.doEdit('spaceHorizontal', {view: selectFreeCxMenu.view});
}
function disconnect$2() {
    editor.doEdit('disconnectSelection',{selection: selectFreeCxMenu.view.selection});
}
function deleteSelection() {
    editor.doEdit('deleteSelection',{view: selectFreeCxMenu.view});
}
function selectionToClipboard$1() {
    editor.doEdit('selectionToClipboard',{view: selectFreeCxMenu.view});
}
function group() {
    editor.doEdit('selectionToGroup',{view: selectFreeCxMenu.view});
}

// click on the node
const selectWidgetsCxMenu = {

	choices: [
		{text:"copy",                     icon:"content_copy",state:"enabled", action:selectionToClipboard},
		{text:"disconnect",				  icon:"power_off",state:"enabled", action:disconnectPinArea},
		{text:"delete",					  icon:"delete",state:"enabled", action:deletePinArea},
		{text:"all pins swap left right", icon:"swap_horiz",state:"enabled", action:pinsSwap},
		{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:pinsLeft},
		{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:pinsRight},
	],

	view: null,
	node: null,
	widgets: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view) {

		this.view = view;
		this.node = view.state.node;
		this.widgets = view.selection.widgets;
		this.xyLocal = view.hit.xyLocal;
		this.xyScreen = view.hit.xyScreen;
	},
};
function selectionToClipboard() {
    editor.doEdit('selectionToClipboard',{view: selectWidgetsCxMenu.view});
}
function disconnectPinArea() {
	editor.doEdit('disconnectPinArea', {view: selectWidgetsCxMenu.view, node: selectWidgetsCxMenu.node, widgets: selectWidgetsCxMenu.widgets});
}
function deletePinArea() {
	editor.doEdit('deletePinArea',{view: selectWidgetsCxMenu.view, node: selectWidgetsCxMenu.node, widgets: selectWidgetsCxMenu.widgets});
}
function pinsSwap()  {
	editor.doEdit('swapPinArea',{view: selectWidgetsCxMenu.view, left:true, right:true});
}
function pinsLeft()  {
	editor.doEdit('swapPinArea',{view: selectWidgetsCxMenu.view, left:true, right:false});
}
function pinsRight() {
	editor.doEdit('swapPinArea',{view: selectWidgetsCxMenu.view, left:false, right:true});
}

const busCxMenu = {

	choices: [
		{icon:"highlight",text:"",state:"enabled", action:busHighLight},
		{icon:"sell",text:"change name",state:"enabled", action:changeName$1},
		{icon:"sell",text:"",state:"enabled", action:changeType},
		{icon:"rss_feed",text:"",state:"enabled", action:changeFilter},
		{icon:"timeline",text:"straight connections",state:"enabled", action:straightConnections},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect$1},
		{icon:"delete",text:"delete",state:"enabled", action:deleteBus}
	],

	view: null,
	bus:null,
	label:null,
	xyLocal:null,

	prepare(view) {

		this.view = view;
		this.bus = view.hit.bus;
		this.label = view.hit.busLabel;
		this.xyLocal = view.hit.xyScreen;

		let choice = this.choices.find( choice => choice.action == busHighLight);
		choice.text = this.bus.is.highLighted ? "remove highlight" : "highlight routes";

		choice = this.choices.find( choice => choice.action == changeType);
		choice.text = this.bus.is.cable ? "change to busbar" : "change to cable";

		choice = this.choices.find( choice => choice.action == changeFilter);
		choice.state = this.bus.is.cable ? "enabled" : "disabled";
		choice.text = (this.bus.is.cable && this.bus.is.filter) ? "change filter" : "add filter";
	}
};

function busHighLight() {
	editor.doEdit('busHighlight',{bus: busCxMenu.bus});
}

function changeName$1() {
	editor.doEdit('busChangeName', {bus: busCxMenu.bus, label: busCxMenu.busLabel});
}

function changeType() {
	editor.doEdit('busChangeType', {bus: busCxMenu.bus});
}

// function deleteFilter() {
// 	editor.doEdit('busDeleteFilter', {bus: busCxMenu.bus})
// }

function changeFilter() {

	// notation
	const bus = busCxMenu.bus;

	// set the filter name and path if not available
	const filterName = (!bus.filter || bus.filter.fName.length < 1) ? convert.nodeToFactory(bus.name) : bus.filter.fName;
	const filterPath = bus.filter?.arl ? bus.filter.arl.userPath : '';

	// show the factory
	editor.tx.send("show filter",{ 

		title: 'Filter for ' + bus.name, 
		name: filterName,
		path: filterPath,
		pos: busCxMenu.xyLocal,
		ok: (newName,newPath) => {

			// do the edit
			editor.doEdit('busChangeFilter',{bus, newName : newName.trim(), userPath: newPath.trim()});
		},
		open: async (newName, newPath) => {

			// change if anything was changed
			if ((newName != filterName )||(newPath != filterPath))
				editor.doEdit('busChangeFilter',{bus, newName : newName.trim(),userPath: newPath.trim()});

			// check
			if (newName.length < 1) return

			// get the current reference
			const arl = bus.filter.arl ?? editor.doc.resolve('./index.js');

			// open the file
			tx.send('open source file',{arl});
		},
		trash: () => {
			editor.doEdit('busDeleteFilter',{bus});
		},
		cancel:()=>{}
	});

}

function straightConnections() {
	editor.doEdit('busStraightConnections', {bus: busCxMenu.bus});
}

function disconnect$1() {
	editor.doEdit('busDisconnect',{bus: busCxMenu.bus});
}

function deleteBus() {
	editor.doEdit('busDelete',{bus: busCxMenu.bus});	
}

const padCxMenu = {

	choices: [
		{icon:"sell",text:"change name",state:"enabled", action:changeName},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deletePad}
	],

	// to set the position where the context menu has to appear
	view:null,
	pad:null,

	prepare(view) {
		this.view = view;
		this.pad = view.hit.pad;
	}
};

function changeName() {
	editor.doEdit('changeNamePad',{view: padCxMenu.view, pad: padCxMenu.pad});
}

function disconnect() {
	editor.doEdit('disconnectPad',{pad: padCxMenu.pad});
}

function deletePad() {
	editor.doEdit('deletePad',{pad: padCxMenu.pad});
}

const contextHandling = {

    // show the rightclick menu
    onContextMenu(xyLocal, e) {

        // save the location
        this.saveHitSpot(xyLocal, e);

        // check what was hit inside the window !
        this.mouseHit(xyLocal);

        switch(this.hit.what) {

            case zap.header:
            case zap.icon: {
                nodeCxMenu.prepare(this);
                editor.tx.send("show context menu", {menu:nodeCxMenu.choices, event:e});
            }
            break

            case zap.node:
            case zap.pin:
            case zap.ifName:{
                pinAreaCxMenu.prepare(this);
                editor.tx.send("show context menu", {menu: pinAreaCxMenu.choices, event:e});
            }
            break

            case zap.busSegment:
            case zap.busLabel: {
                busCxMenu.prepare(this);
                editor.tx.send("show context menu", {menu:busCxMenu.choices, event:e});
            }
            break

            case zap.pad:
            case zap.padArrow: {
                padCxMenu.prepare(this);
                editor.tx.send("show context menu", {menu:padCxMenu.choices, event:e});
            }
            break

            case zap.selection: {

                switch(this.selection.what) {

                    case selex.freeRect: 
                    case selex.multiNode: {
                        selectFreeCxMenu.prepare(this);
                        editor.tx.send("show context menu", {menu:selectFreeCxMenu.choices, event:e});
                    }
                    break

                    case selex.pinArea: {
                        selectWidgetsCxMenu.prepare(this);
                        editor.tx.send("show context menu", {menu:selectWidgetsCxMenu.choices, event:e});
                    }
                    break
                }
            }
            break

            case zap.nothing: {
                bgCxMenu.prepare(this);
                editor.tx.send("show context menu", {menu:bgCxMenu.choices, event:e});                
            }
            break
        }
    },
};

const nodeHandling = {

    // setting a new root for a view
    syncRoot(newRoot) {

        // construct the rx tx tables
        newRoot.rxtxBuildTxTable();

        // if the root is not placed, place it
        if (!newRoot.is.placed) newRoot.placeRoot();

        // set the root for the view (is always a group node !)
        this.root = this.getContainer(newRoot);

        // If the root has a view, it is the top level view - set the saved transform for it
        if (this.root.savedView?.tf) this.setTransform(this.root.savedView.tf);

        // and now also restore the saved views if any 
        this.restoreSubViews();
    },

    // add a 'container' group
    getContainer(root) {

        // if the root is a container set this as the root for the view - change the name if required
        if (root.isContainer()) return root
 
        // the root is not a container -> create a container group node
        const container = this.initRoot('');

        // save the model root in the container
        container.nodes.push(root);

        // return the root
        return container
     },

    // this is for when we create a new node in the editor
    newEmptyNode(pos, source) {

        // create the look for the node
        const look = new Look( {x:pos.x,y:pos.y,w:0,h:0} );

        // create the node
        const node = source ? new SourceNode(look, '') : new GroupNode(look, '');

        // get the node a UID
        editor.doc.UID.generate(node);

        // add the node to the node graph
        this.root.addNode(node);

        // set the node as selected
        this.selection.singleNode(node);

        // find the header
        const header = node.look.widgets.find( widget => widget.is.header );

        // start the name edit
        this.beginTextEdit(header);

        // we also set the hit position to the start
        this.hit.xyLocal.y = pos.y + header.rect.h;

        // done
        return node
    },

};

const selectionHandling = {

    // finds nodes or routes in the selection rectangle
    getSelected(rect) {

        // notation
        const slct = this.selection;

        // check the nodes
        for( const node of this.root.nodes) if (node.overlap(rect)) slct.nodes.push(node);

        // check all pads
        for( const pad of this.root.pads) if (pad.overlap(rect)) slct.pads.push(pad);

        // check the buses and the individual tacks
        for( const bus of this.root.buses) if (bus.overlap(rect)) {

            // ..if so select the bus
            slct.buses.push(bus);

            // ...and select the tacks in the selection
            for( const tack of bus.tacks) if (tack.overlap(rect)) slct.tacks.push(tack);
        }
    },

    // an external widget has a connection with a node outside the selection
    externalWidgets(nodeList) {

        let widgetList = [];

        // go through all the widgets of the selected nodes
        nodeList.forEach( node => {
            node.look.widgets.forEach( widget => {
                widget.routes?.forEach( route => {  
                    if ( !nodeList.includes(route.to.node) || !nodeList.includes(route.from.node)) widgetList.push(widget);
                });
            });
        });
        return widgetList
    },

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    deltaForPaste(pos, cb) {

        // increment the copy count
        cb.copyCount++;

        const slct = cb.selection;

        const ref = (slct.what == selex.freeRect) 
                        ? slct.rect 
                        : (slct.what == selex.multiNode) 
                            ? slct.nodes[0].look.rect 
                            : {x:0, y:0};

        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        return ((ref.x == pos.x) && (ref.y == pos.y)) 
                    ? {x: cb.copyCount * style$1.look.dxCopy,y: cb.copyCount * style$1.look.dyCopy}
                    : {x: pos.x - ref.x + (cb.copyCount-1) * style$1.look.dxCopy, y: pos.y - ref.y + (cb.copyCount-1) * style$1.look.dyCopy }
    },

    // save the selection to the clipboard (no copies are made !)
    selectionToClipboard() {

        // send the selection to the clipboard manager
        editor.tx.send('clipboard set',{model: editor.doc.model, selection: this.selection});
    },
        
    // copy the clipboard to the selection - everything is copied !
    clipboardToSelection(pos, clipboard) {

        // calculate where the selection has to be pasted
        const delta = this.deltaForPaste(pos, clipboard);
        //const pasteHere = this.pastePosition(pos, clipboard)

        // if we have selected a node and a position inside the node, get it here (before we reset)
        const [node, inside] = this.selectedNodeAndPosition();

        // initialise the selection
        this.selection.reset();

        // the selection in the clipboard
        const cbslct = clipboard.selection;

        // set the type of selection
        this.selection.what = cbslct.what;

        // copy as required
        switch(cbslct.what) {

            case selex.freeRect:
            case selex.multiNode:

                // copy the nodes in the clipboard
                for (const node of cbslct.nodes) {

                    // make a copy
                    let newNode = node.copy();

                    // move the new node to the new spot
                    newNode.look.moveDelta(delta.x, delta.y);

                    // add the node to the active view
                    this.root.addNode(newNode);

                    // add the node to the selection
                    this.selection.nodes.push(newNode);
                }

                // we want new UIDs for the copied nodes
                this.root.uidChangeAll(editor.doc.UID);

                // for multiNode, we're done
                if (cbslct.what == selex.multiNode) return

                // copy the buses in the clipboard
                for (const bus of cbslct.buses) {

                    // make a copy
                    let newBus = bus.copy();

                    // change the uid - there are no routes to copy so this is ok 
                    // editor.doc.UID.generate(newBus)

                    // move the new node to the new spot
                    newBus?.move(delta.x, delta.y);

                    // add to the selection
                    this.selection.buses.push(newBus);
                }

                // copy the pads - i don't think so....
                for (const pad of cbslct.pads) {
                }

                // we could copy the routes that go bteween the nodes/busses in the copy ...

                // check if we need to set the rectangle again...
                if (cbslct.rect) {

                    // notation
                    const rc = cbslct.rect;

                    // set the rectangle
                    this.selection.activate(rc.x + delta.x, rc.y + delta.y, rc.w, rc.h, style$1.selection.cRect);
                }

                // done
                break

            case selex.singleNode: {

                // make a copy
                let newNode = cbslct.nodes[0]?.copy();

                // we want new UIDs for the copied node(s)
                newNode.uidChangeAll(editor.doc.UID);
                
                // move the new node to the new spot
                newNode.look.moveTo(delta.x, delta.y);

                // add the node to the active view
                this.root.addNode(newNode);

                // add the node to the selection
                this.selection.nodes.push(newNode);

                // select
                newNode.doSelect();
            }
            break

            case selex.pinArea: {

                // check
                if (!node || !inside) return

                // paste the widgets 
                const copies = node.look.copyPinArea(cbslct.widgets, inside);

                // add the pads or the adjust the rx/tx tables
                node.is.source ? node.rxtxAddPinArea(copies) : node.addPads(copies);

                // the selection becomes the widgets that were copied
                this.selection.pinAreaSelect(copies);
            }
            break
        }
    },

    // The clipboard has been copied already, now we set the links
    linkToClipboardNodes(model, viewPath) {
        
        // the nodes in the clipboard and the selection are copies - we set them as links
        for (const linkedNode of this.selection.nodes) linkedNode.setLink(model, linkedNode.name + viewPath);
    },

    // The selection which has been pasted might have duplicate names...
    checkPastedNames(n) {

        // check all the nodes in the selection
        for (const pasted of this.selection.nodes) {

            // start at the number given
            let counter = n;

            // check if there is a duplicate (999 is just there to avoid endless loops)
            while( this.root.hasDuplicate(pasted) && counter < 999) {

                // put a number after the name
                const newName = convert.addNumber(pasted.name, counter++);

                // change the name
                pasted.updateName(newName);
            }
        }
    },

    // The clipboard has been copied already, now we set the links
    xxlinkToClipboardNodes(clipboard, model) {

        // the nodes in the clipboard and the selection are copies - we set them as links
        const L = clipboard.selection.nodes.length;

        // check - should match ...
        if (L != this.selection.nodes.length) return

        for(let i=0; i<L; i++) {
            this.selection.nodes[i].setLink(model, clipboard.selection.nodes[i].name );
        }
    },

    // note that the selection is a stored previous selection, not the current one !
    removeSelection(selection) {

        // reset the current selection
        this.selection.reset();

        // remove all the nodes etc.
        for (const node of selection.nodes) this.root.removeNode(node);
        for (const bus of selection.buses) this.root.removeBus(bus);
        for (const pad of selection.pads) this.root.removePad(pad);
    },

    // note that the selection is a stored previous selection, not the current one !
    restoreSelection(selection) {

        // restore all the nodes etc.
        for (const node of selection.nodes) this.root.restoreNode(node);
        for (const bus of selection.buses) this.root.restoreBus(bus);
        for (const pad of selection.pads) this.root.restorePad(pad);

        // reset the current selection
        const sel = this.selection;
        sel.reset();

        // and put the restored nodes in the selection again
        for (const node of selection.nodes) sel.nodes.push(node);
        for (const bus of selection.buses) sel.buses.push(bus);
        for (const pad of selection.pads) sel.pads.push(pad);        

        const rc = selection.rect;
        sel.activate(rc.x, rc.y, rc.w, rc.h, selection.color);
    },



    // get the node and the position where a pin must be added
    selectedNodeAndPosition() {

        // get the selected node (only one !)
        const node = this.selection.getSingleNode();
        if (! node ) return [null, null]

        // get the selected widget
        const widget = this.selection.getSelectedWidget();

        // determine the position for the widget
        const pos = widget  ? {x: widget.is.left ? widget.rect.x : widget.rect.x + widget.rect.w, y: widget.rect.y + widget.rect.h} 
                            : this.hit.xyLocal;

        return [node, pos]
    }

};

const groupHandling = {

   // if the selection contains just one source node, the conversion to a group is straightforward...
singleSourceToGroup() {
},

// transform a selection to a new group node
selectionToGroup(UID) {

    // create a new look for the new group node
    const look = new Look(this.selection.makeLookRect());

    // create a new group type
    const newGroup = new GroupNode(look,"new group", null);

    // give it a unique UID
    UID.generate(newGroup);

    // and add the new group node 
    this.root.addNode( newGroup );

    // make a new view for the node
    const view = newGroup.savedView = this.newSubView(newGroup, this.selection.makeViewRect());

    // reposition the conten of the view to 'cover' the current position
    view.translate(-view.rect.x, -view.rect.y);

    // for each of the selected nodes..
    for(const node of this.selection.nodes) {
        // ..add the node to the new group type 
        newGroup.addNode(node);

        //..and remove it from the root in this view
        this.root.removeNode(node);
    }
    // now we add the buses and keep track of the buses that were transferred
    const transfers = this.busTransfer(newGroup);

    // create the proxies for this group type and make the interconnections inside + outside of the group
    newGroup.addProxies(this.selection);

    // for the buses that were *partially* transferred, we need to set up pads and routes to connect the two buses
    for(const transfer of transfers) {
        this.busInterconnect(transfer.outside, newGroup, transfer.inside);
    }

    // and return the new group
    return newGroup
},

// some buses might have to be copied or moved completely to the group
busTransfer(newGroup) {

    const transfers=[];

    for(const bus of this.selection.buses) {

        // notation
        const selNodes = this.selection.nodes;

        // for connections outside of the selection
        const outside = [];

        // find the connections that go out of the selection
        for(const tack of bus.tacks) {

            // find to what the tack is connected
            const other = tack.route.from == tack ? tack.route.to : tack.route.from;

            // if the node is not part of the selection
            if (other.is.pin && !selNodes.includes(other.node)) outside.push(tack);
        }

        // if all connections to/from the bus are inside the selection -> just move the bus to the new node
        if (outside.length == 0) {

            // add the bus to the new group
            newGroup.buses.push(bus);

            // remove it from this group
            this.root.removeBus(bus);
        }
        // otherwise duplicate the bus in the new group and remove the unnecessary connections on each bus
        else {
            // make an exact copy
            const newBus = bus.copy();

            // and store the *new* bus
            newGroup.buses.push(newBus);

            // distribute the tacks over both buses
            bus.splitTacks(newBus, newGroup);

            // save in the transfer list
            transfers.push({outside: bus, inside: newBus});
        }
    }

    return transfers
},

// The new bus inside the new group has to be connected to the bus outside
// we filter the connections to avoid duplicates
busInterconnect(outside, newGroup, inside) {

    // a helper function to get a pin
    function getPin(tack) {
        const widget = tack.route.to == tack ? tack.route.from : tack.route.to;
        return widget.is.pad ? widget.proxy : widget
    }

    // a helper function to check that two tacks are logically connected via the busses
    function haveConnection(tack1, tack2) {

        // get the actual pins
        const pin1 = getPin(tack1);
        const pin2 = getPin(tack2);

        // compare the names
        if (pin1.name != pin2.name) return false

        // check the i/o combination
        return (pin1.is.proxy == pin2.is.proxy) ? (pin1.is.input != pin2.is.input) : (pin1.is.input == pin2.is.input)
    }

    // Use reduce to create an object where each key is a unique tack name
    // and the value is the first tack object found with that name
    const uniqueTacks = inside.tacks.reduce((accumulator, currentTack) => {

        // check if this connection also exists on this bus
        const externalTack = outside.tacks.find(externalTack => {

            return haveConnection(currentTack, externalTack)
        });

        // if there exists a connection
        if (externalTack) {

            // get the corresponding pin (see above)
            const pin = getPin(externalTack);

            // make a unique name to distinguish between input/output
            const specialName = pin.name + (pin.is.input ? '>' : '<');

            // save if not yet in the list
            if (!accumulator[specialName]) accumulator[specialName] = currentTack;
        }

        // Return the accumulator for the next iteration
        return accumulator;
    }, {});

    // add a pad for each element in unique tacks
    for(const tack of Object.values(uniqueTacks)) {

        // get the corresponding pin
        const pin = getPin(tack);

        // copy the pin as a proxy
        const newProxy = newGroup.copyPinAsProxy(pin);

        // and create the pad for the proxy
        newGroup.addPad(newProxy);

        // add a route from the proxy to the outside busbar
        outside.makeRoute(newProxy);

        // add a route from the pad to the busbar
        inside.makeRoute(newProxy.pad);
    }
},

// undo the previous operation
undoSelectionToGroup(selection, newGroup, shift, allRoutes) {

    // disconnect the new group
    newGroup.disconnect();

    // shift to the right spot
    //newGroup.savedView.shiftContent(shift.dx, shift.dy)

    // close the view of the 
    newGroup.savedView.closeView();

    // remove the new group
    this.root.removeNode(newGroup);

    // put the selection back
    this.restoreSelection(selection);

    // for every busbar inside the newGroup we have to transfer the tacks to the corresponding 'outside' bus !
    for(const inside of newGroup.buses) inside.transferTacks(selection.buses);

    // disconnect all the nodes
    for (const node of selection.nodes)  node.disconnect();

    // reconnect all the routes again > note that tacks op de verkeerde bus terechtkomen ???
    for (const routes of allRoutes) 
        for (const route of routes) route.reconnect();

},

// converts a group node to a collection of nodes/busses in a selection
// Note thta this different from undoing a group operation (see above)
// group to selection only works when there are no connections to the groupnode
transferToSelection(group, shift) {

    // we will put the nodes in a selection in the view
    this.selection.reset();

    // calculate a rectangle for the selection
    const selRect = this.calcRect(group);

    // the nodes will have to move to a new position
    const dx = shift.dx;
    const dy = shift.dy;

    // now we can adjust the settings for the selection rectangle
    this.selection.activate(selRect.x + dx, selRect.y + dy, selRect.w, selRect.h);

    // remove all the routes that lead to pads - pads will not be copied
    for (const pad of group.pads) pad.disconnect();

    // add all the nodes to the parent node
    for(const node of group.nodes) {

        // move the look
        node.look.moveDelta( dx, dy);

        // move the routes
        node.look.moveRoutes(dx, dy);

        // move the nodes to the parent node
        this.root.nodes.push(node);

        // also add to the selection
        this.selection.nodes.push(node);
    }

    // move the buses to the parent node as well
    for(const bus of group.buses) {

        // move the bus
        bus.move(dx, dy);

        // move the routes
        bus.moveRoutes(dx, dy);

        // save the buses at the parent node
        this.root.buses.push(bus);

        // also add to the selection
        this.selection.buses.push(bus);
    }

    // and remove the node from this root
    this.root.removeNode(group);
},

undoTransferToSelection(group, shift, padRoutes) {

    // the nodes will have to move back
    const dx = -shift.dx;
    const dy = -shift.dy;

    for (const node of group.nodes) {

        // move the look
        node.look.moveDelta( dx, dy);

        // move the routes
        node.look.moveRoutes(dx, dy);

        // take them out of the nodes array
        view.root.removeNode(node);
    }

    // move the buses to the parent node as well
    for(const bus of group.buses) {

        // move the bus
        bus.move(dx, dy);

        // move the routes
        bus.moveRoutes(dx, dy);

        // remove the bcakplane
        group.removeBus(bus);
    }

    // reconnect all the pad routes
    for(const route of padRoutes) route.reconnect();

    // put the node back in the view
    view.root.restoreNode(group);
}


};

const alignHandling = {

    // calculates the rectangle for a nice row: position, size and space between the nodes
    calcRow(slct) {
        // sort the array for increasing x
        slct.sort( (a,b) => a.look.rect.x - b.look.rect.x);

        // constant for minimal seperatiion
        const minSpace = style$1.selection.xPadding;

        // set the initial position
        let {x,y} = {...slct[0].look.rect};

        // we can also calculate the new total width
        let last = slct.length - 1;
        let w = slct[last].look.rect.x + slct[last].look.rect.w - slct[0].look.rect.x;
        let h = 0;
        let wNodes = 0;

        // Find the tallest look and the total width of the looks
        slct.forEach( node =>  {
            h = Math.max(h, node.look.rect.h);
            wNodes += node.look.rect.w;
        });

        // calculate the space between the looks
        let space = (w - wNodes)/last;

        // adjust if not ok
        if (space < minSpace) {
            space = minSpace;
            w = wNodes + last * minSpace;
        }

        // return the results
        return {x,y,w,h,space}
    },

    // calculate the rectangle for a nice column: position, size and space between nodes
    calcColumn(slct) {
        // sort for increasing y
        slct.sort( (a,b) => a.look.rect.y - b.look.rect.y);

        // constant for minimal seperation
        const minSpace = style$1.selection.yPadding;

        // set the initial position
        let {x,y} = {...slct[0].look.rect};

        // we can also calculate the new total height
        let last = slct.length - 1;
        let w = 0;
        let h = slct[last].look.rect.y + slct[last].look.rect.h - slct[0].look.rect.y;
        let hNodes = 0;

        // get the size of the widest look and also add up all the heights 
        slct.forEach( node =>  {
            w = Math.max(w, node.look.rect.w);
            hNodes += node.look.rect.h;
        });

        // calculate the space between the nodes
        let space = (h - hNodes)/last;

       // adjust if not ok
       if (space < minSpace) {
            space = minSpace;
            h = hNodes + last * minSpace;
        }

        // return the results
        return {x,y,w,h,space}
    },

    // calculates the rectangle for a list of nodes
    calcRect(node) {

        const firstRect =  node.nodes.length > 0 ? node.nodes[0].look.rect : node.pads[0].rect;

        // initialize
        const min = {x:firstRect.x, y:firstRect.y};
        const max = {x:firstRect.x + firstRect.w, y:firstRect.y + firstRect.h};
        let rc = null;
        
        // go through the list of nodes 
        node.nodes.forEach( node => {

            //notation
            rc = node.look.rect;

            // find min x and y
            min.x = Math.min(min.x, rc.x);
            min.y = Math.min(min.y, rc.y);

            // find max x and y
            max.x = Math.max(max.x, rc.x + rc.w);
            max.y = Math.max(max.y, rc.y + rc.h);
        });

       // go through the list of pads
       node.pads.forEach( pad => {

            //notation
            rc = pad.rect;

            // find min x and y
            min.x = Math.min(min.x, rc.x);
            min.y = Math.min(min.y, rc.y);

            // find max x and y
            max.x = Math.max(max.x, rc.x + rc.w);
            max.y = Math.max(max.y, rc.y + rc.h);
        });

        // return the rectangle
        return {x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y}
    },    

    // Nodes Align Horizontal Deltas - calculate the x deltas to allign each node in the selection
    nodesAlignHD(nodes, left=true) {

        // the deltas
        const deltas = [];

        // calculate the column parameters
        const col = this.calcColumn(nodes);

        // calculate the deltas for each node
        for (const node of nodes) {

            // notation
            const rc = node.look.rect;

            // left or right ?
            const dx = left ? (col.x - rc.x) : (col.x + col.w - rc.x - rc.w);

            // keep track of the deltas
            deltas.push({x:dx, y:0});
        }

        //done 
        return deltas
    },

    // calculate the y deltas to allign each node in the selection
    nodesAlignVD(nodes) {

        // the deltas
        const deltas = [];

        // calculate the parameters for the row (x,y,w,h,space)
        const row = this.calcRow(nodes);

        // calculate the deltas for each node
        for (const node of nodes) {

            // keep track of the deltas
            deltas.push({x:0, y: row.y - node.look.rect.y});
        }

        //done 
        return deltas
    },

    // the vertical deltas for spacing the nodes evenly
    nodesSpaceVD(nodes) {

        // the deltas
        const deltas = [];

        // calculate the column parameters
        const col = this.calcColumn(nodes);

        // The first node starts here
        let nextY = col.y;

        for (const node of nodes) {

            // notation
            const rc = node.look.rect;

            // save the delta
            deltas.push({x:0, y: nextY - rc.y});

            // calculate the next y 
            nextY = nextY + rc.h + col.space;
        }

        // done
        return deltas
    },

    // the vertical deltas for spacing the nodes evenly
    nodesSpaceHD(nodes) {

        // the deltas
        const deltas = [];

        // calculate the column parameters
        const row = this.calcRow(nodes);

        // The first node starts here
        let nextX = row.x;

        for (const node of nodes) {

            // notation
            const rc = node.look.rect;

            // save the delta
            deltas.push({x: nextX - rc.x, y: 0});

            // calculate the next x
            nextX = nextX + rc.w + row.space;
        }

        // done
        return deltas
    },

    padsAlignHD(pads, left=true) {

        // save all the deltas
        const deltas = [];
    
        // sort the pads according to y-value
        pads.sort( (a,b) => a.rect.y - b.rect.y);
    
        // the first pad is the reference pad
        const rcRef = pads[0].rect;
    
        // adjust the other pads to the ref pad
        for (const pad of pads) {

            // notation
            const rc = pad.rect;
    
            // calculate the delta
            const dx = left ? (rcRef.x - rc.x) :  (rcRef.x + rcRef.w - rc.x - rc.w);
    
            // save the delta 
            deltas.push({x:dx, y:0});
        }

        // done
        return deltas
    },

    padsSpaceVD(pads) {

        // the deltas
        const deltas = [];

        // sort the pads according to y-value
        pads.sort( (a,b) => a.rect.y - b.rect.y);

        // the first pad is the reference pad
        const yStart = pads[0].rect.y;

        // we also space the pads equally 
        let dy = (pads.at(-1).rect.y - pads[0].rect.y)/(pads.length-1);

        // The deltas wrt the ref pad
        let i = 0;
        for (const pad of pads)  deltas.push({x:0, y: yStart + (i++)*dy - pad.rect.y});
        
        // done
        return deltas
    },

    // for each node there is a delta - used in undo/redo operations
    moveNodesAndRoutes(nodes, deltas, back=false) {

        // do the nodes..
        const N = nodes.length;
        let dx = 0;
        let dy = 0;
        for (let i=0; i<N; i++) {

            // for the undo operation back = true
            dx = back ? -deltas[i].x : deltas[i].x;
            dy = back ? -deltas[i].y : deltas[i].y;            

            nodes[i].look.moveDelta(dx, dy);
            nodes[i].look.moveRoutes(dx, dy);
        }
        // we adjust the routes only when all nodes have been moved
        for (let i=0; i<N; i++)  nodes[i].look.adjustRoutes();
    },

    movePadsAndRoutes(pads, deltas, back=false) {

        // adjust the other pads to the ref pad
        const P = pads.length;
        let dx = 0;
        let dy = 0;
        for (let i=0; i<P; i++) {

            // for the undo operation back = true
            dx = back ? -deltas[i].x : deltas[i].x;
            dy = back ? -deltas[i].y : deltas[i].y;

            // adjust position
            pads[i].rect.x += dx;
            pads[i].rect.y += dy;

            // also set the y position
            pads[i].adjustRoutes();
        }        
    }
};

// a helper function
function canProceed(view) {

    // get the node and the position where to add
    const [node, pos] = view.selectedNodeAndPosition();

    // check
    if (!node || !pos) return [false, null, null]

    // check if we can modify the node
    if (node.cannotBeModified()) return [false, null, null]

    // ok
    return [true, node, pos]
}

// The table with the <ctrl> + key combinations
const justKeyTable = {

    // add input
    i: (view) => {

        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return

        // type of pin
        const is = {	
            channel: false, 
            input: true, 
            proxy: node.is.group 
        };

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is});
    },

    // add output
    o: (view) => {

        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return

        const is = {	
            channel: false, 
            input: false, 
            proxy: node.is.group
        };

        // add an input pin where the click happened
        editor.doEdit('newPin',{view, node, pos, is});
    },

    // add request
    q: (view) => {

        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return

        // type of pin
        const is = {	
            channel: true, 
            input: false, 
            proxy: node.is.group
        };

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is});
    },

    // add reply
    r: (view) => {

        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return

        // type of pin
        const is = {	
            channel: true, 
            input: true, 
            proxy: node.is.group
        };

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is});
    },

    // add ifName
    p: (view) => {

        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return

        // add an input pin where the click happened
        editor.doEdit('newInterfaceName',{view, node, pos});
    },

    // add a label
	a: (view) => {

        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (! node ) return

        // check if already a lable
        const label = node.look.findLabel();
        if (label) 
            editor.doEdit('widgetTextEdit',{view, widget: label});
        else 
            editor.doEdit('addLabel',{node});
    },

    // highlight/unhighlight
    h: (view) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (! node ) return

        // highlight/unhighlight
	    editor.doEdit('nodeHighLight', {node});
    },

    '+': (view) => {

        const widget = view.selection.getSelectedWidget();

        // check
        if (!widget || !widget.node || widget.node.cannotBeModified()) return;

        // ok
        editor.doEdit('widgetTextEdit',{view, widget, cursor:-1});
    },

    '-': (view) => {

        const widget = view.selection.getSelectedWidget();

        // check
        if (!widget || !widget.node || widget.node.cannotBeModified()) return;

        // start 
        editor.doEdit('widgetTextEdit',{view, widget, cursor:0, clear:true});
    },

    // delete the selection or the single node
    'Clear': (view) => {

        // get the selected node only if nothing else is selected
        const node = view.selection.what == selex.singleNode ? view.selection.getSingleNode() : null;

        if (node) 
            editor.doEdit('disconnectNode',{node});
        else
            editor.doEdit('disconnectSelection', {view});
    },

    // delete the selection or the single node
    'Delete': (view) => {

        switch(view.selection.what) {

            case selex.nothing:
                break

            case selex.freeRect:
                editor.doEdit('deleteSelection', {view});
                break

            case selex.pinArea:

                //check if ok
                const [ok, node, pos] = canProceed(view);
                if (!ok) return

                editor.doEdit('deletePinArea',{ view,
                                                node: view.selection.getSingleNode(), 
                                                widgets: view.selection.widgets});
                break

            case selex.singleNode:
                
                // maybe there is a widget selected
                const widget = view.selection.getSelectedWidget();

                // check
                if (!widget) {

                    // get the node, delete and done
                    const node = view.selection.getSingleNode();
                    if (node) editor.doEdit('deleteNode',{node});
                    return
                }

                // check
                if (widget.node.cannotBeModified()) return

                // which pin
                if (widget.is.pin) 
                    editor.doEdit('deletePin',{view, pin: widget});
                else if (widget.is.ifName) 
                    editor.doEdit('deleteInterfaceName',{view, ifName: widget});
                break

            case selex.multiNode:
                editor.doEdit('deleteSelection', {view});
                break

        }
    },

    'Enter': (view) => {

        // if there is a pin selected, we start editing the pin
        const editable = view.selection.getSelectedWidget();
        if (editable) {

            // check
            if (editable.node.cannotBeModified()) return

            // start editing
            editor.doEdit('widgetTextEdit',{view, widget: editable});
        }
    },

    'ArrowDown': (view) => {
       const below = view.selection.widgetBelow();
       if (below) view.selection.switchWidget(below);
    },

    'ArrowUp': (view) => {
       const above = view.selection.widgetAbove();
       if (above) view.selection.switchWidget(above);
    },

    // undo
    'Undo': (view) => editor.undoLastEdit(),

    // redo
    'Redo': (view) => editor.redoLastEdit(),

    // escape 
    'Escape' : (view) => { view.selection.reset();}
};

// The table with the <ctrl> + key combinations
const ctrlKeyTable = {

    // a new source node
    s: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        editor.doEdit('newSourceNode',{view, pos: view.hit.xyLocal});
    },

    // a new group node
    g: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        editor.doEdit('newGroupNode',{view, pos: view.hit.xyLocal});
    },

    // a new bus
    b: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new busbar
        editor.doEdit('busCreate',{view, pos: view.hit.xyLocal, cable:false});
    },

    // a new bus
    k: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new cable
        editor.doEdit('busCreate',{view, pos: view.hit.xyLocal, cable:true});
    },

    // copy
    c: (view) => {
        editor.doEdit('selectionToClipboard', {view});
    },

    // a new input pad
    i: (view) => {
        editor.doEdit('padCreate', {view,pos: view.hit.xyLocal, input:true});
    },

    // add a new output pad
    o: (view) => {
        editor.doEdit('padCreate', {view,pos: view.hit.xyLocal, input:false});
    },

    // paste as link
    l: (view) => {

       // request the clipboard - also set the target, the clipboard can come from another file
       editor.tx.request('clipboard get',editor.doc).then( clipboard => {

            // get the type of selection
            const what = clipboard.selection.what;

            // if there is nothing , done
            if (what == selex.nothing) return

            // link pin area paste operation is not defined 
            if (what == selex.pinArea) return

            // other cases do the standard link operation
            editor.doEdit('linkFromClipboard',{view, pos: view.hit.xyLocal, clipboard});
        })
        .catch( error => console.log('ctrl-l : clipboard get error -> ' + error));
    },

    // paste
    v: (view) => {

        // request the clipboard - also set the target, the clipboard can come from another file
        editor.tx.request('clipboard get',editor.doc).then( clipboard => {

            // get the type of selection
            const what = clipboard.selection.what;

            // if there is nothing , done
            if (what == selex.nothing) return

            // The pin area paste operation is defined elsewhere..
            if (what == selex.pinArea) {
                editor.doEdit('pasteWidgetsFromClipboard', {view, clipboard});
                return
            }

            // other cases do the standard paste operation
            editor.doEdit('pasteFromClipboard',{view, pos: view.hit.xyLocal, clipboard});
        })
        .catch( error => console.log('ctrl-v : clipboard get error -> ' + error));
    },

    // undo
    z: (view) => editor.undoLastEdit(),

    // redo
    Z: (view) => editor.redoLastEdit(),

    // wider
    '+': (view) => {

        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (! node ) return

        // make wider
        editor.doEdit('wider', {node});
    },

    // thinner
    '-': (view) => {
        
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (! node ) return

        // make wider
        editor.doEdit('smaller', {node});
    },
};

const keyboardHandling = {

    // helper function
    _logKey(e) {
        let keyStr = 'Key = ';
        if (e.ctrlKey)  keyStr += 'ctrl '; 
        if (e.shiftKey) keyStr += 'shift ';
        keyStr += '<'+e.key+'>';
        console.log(keyStr);
    },

    // keyboard press - return true if key is handled
    onKeydown(e) {
        
        // select the required key-handling function
        if (this.state.action == doing.nothing) {

            // get the action
            const action = e.ctrlKey ? ctrlKeyTable[e.key] : justKeyTable[e.key];

            // check
            if (!action) return false

            // do it
            action(this);

            // done
            return true
        }
        // we are doing text editing...
        else if (this.state.action == doing.editTextField) {

            // select the handler function
            const done = ( e.key.length > 1 || e.ctrlKey) ? this.textField.handleSpecialKey?.(e) : this.textField.handleKey?.(e);
    
            // continue editing ?
            if (done) this.stateSwitch(doing.nothing);

            return true
        }

        else return false
    },

    onKeyup(e) {
        return false
    },

    beginTextEdit( object, cursor=-1, clear=false) {

        // check if field is editable - must return the prop that will be edited
        const prop = object.startEdit?.();

        // check
        if (!prop) return

        // start a new edit for the prop of the object
        this.textField.newEdit(object, prop, cursor);

        // if clear, clear the field first
        if (clear) this.textField.clear();

        // set the status of the editor
        this.stateSwitch(doing.editTextField);

        // change the active view
        editor.switchView(this);

        // show a blinking cursor
        this.startBlinking();
    },

    // end text edit is called from switch state !
    endTextEdit() {

        // notation
        const state = this.state;
        const text = this.textField;

        // stop the blinking cursor
        clearInterval( state.cursorInterval );

        // check
        if (!text) return

        // notify the object of the end of the edit
        text.obj.endEdit?.(text.saved);
    },

    // editText(e) {

    //     let done = false

    //     // of the special keys
    //     if ( e.key.length > 1 || e.ctrlKey)
    //         done = this.textField.handleSpecialKey?.(e)
    //     else
    //         done = this.textField.handleKey?.(e)

    //     // continue editing ?
    //     if (done) this.stateSwitch(doing.nothing)
    // },

    startBlinking() {

        let lastTime = 0;
        let on = true;
        let keepBlinking = true;
    
        // time is in ms
        const blinkFunction = (time) => {

            // check the time
            if (time - lastTime >= style$1.std.blinkRate) {

                // execute the recursive blink function from the top !
                keepBlinking = editor.doc.view.recursiveBlink(editor.ctx, on);

                // Toggle cursor visibility
                on = !on;
                lastTime = time;
            }
    
            // Continue the loop if we're still editing
            if (keepBlinking) requestAnimationFrame(blinkFunction);
        };
    
        // schedule the first blink function
        requestAnimationFrame(blinkFunction);
    },

    recursiveBlink(ctx, on) {

        // save the current status
        ctx.save();

        // notation
        const tf = this.tf;

        // adjust the transform for this view
        ctx.transform(tf.sx, 0.0, 0.0, tf.sy, tf.dx, tf.dy);

        // keep track of the cursor
        let keepBlinking = false;

        // draw the cursor if there is a field doing a text edit
        if (this.state.action == doing.editTextField) {
            keepBlinking = true;
            const txt = this.textField;
            txt.obj.drawCursor(ctx, txt.cursor, on);
        }

        // check all the subviews
        for (const view of this.views) keepBlinking = view.recursiveBlink(ctx, on) || keepBlinking;

        // restore the ctx state
        ctx.restore();

        return keepBlinking
    },
    
};

// view functions that are independant of the content of the view
const viewWidgetHandling = {

// note that this is the *inverse* coord transformation that is used by the canvas
// The canvas transformation goes fom window coordinates down to screen coordinates
// With this function we transform cursor coordinates up to the window coordinates !
localCoord(a) {  
    const tf = this.tf;
    return {x:(a.x - tf.dx)/tf.sx, y:(a.y - tf.dy)/tf.sy}
},

// The inverse of the above 
inverse(a) {  
    const tf = this.tf;
    return {x: a.x*tf.sx + tf.dx, y: a.y*tf.sy + tf.dy}
},

// create a new view
newSubView(node, rc=null, tf=null) {

    // do we need to calculate the rectangle ?
    rc = rc ?? this.makeViewRect(node);

    // make a view
    let view = new View(rc, node, this);

    // if a transform is given, set it
    if (tf) view.setTransform(tf);

    // add the title bar etc.
    view.addViewWidgets();

    // and place the widgets
    view.placeWidgets();

    // add the view to the views
    this.views.push(view);

    // set the parent view
    // view.parent = this
    
    // save the view in the (root) node 
    node.savedView = view;

    // return the new view
    return view
},

// puts a saved view in the view list again - if not yet cooked (no root !) - cook the view first
restoreView(node) {

    // if the view is still in a raw state 
    if (node.savedView.raw) {

        // create the subview
        node.savedView = this.newSubView(node, node.savedView.rect, node.savedView.tf);
    }

    // the view should not be in the current view
    if (this.views.find( v => v == node.savedView)) {
        console.error("View already in views in restore view !");

        // or should we bring it to the foreground ?
        return
    }

    // push on the view stack
    if (this == node.savedView) {
        console.error("Circular reference in views");
        return
    }

    // set state to visible
    node.savedView.viewState.visible = true;

    // push the view on the views stack and set the parent
    this.views.push(node.savedView);
    node.savedView.parent = this;
},

closeView() {
    // The top level view cannot be closed
    if (!this.parent) return
    this.viewState.visible = false;
    if (this.parent.views) eject(this.parent.views, this);
},

// after loading a file we have to cook the views that are visible from the start
restoreSubViews() {

    // reset the views
    this.views.length = 0;

    // there should be a root with nodes
    if ( ! this.root?.nodes) return

    // check all nodes
    for (let node of this.root.nodes) {

        // check
        if (!node.savedView || node.savedView.state == 'closed') continue

        // restore it
        node.savedView = this.newSubView(node, node.savedView.rect, node.savedView.tf);

        // if a node has a visible view we have to check its nodes as well
        node.savedView.restoreSubViews();
    }
},

move(delta) {
    // also adapt the tf matrix
    this.tf.dx += delta.x;
    this.tf.dy += delta.y;

    // move the rectangle
    this.rect.x += delta.x;
    this.rect.y += delta.y;

    // also move the widgets 
    this.widgets?.forEach( widget => {
        widget.rect.x += delta.x;
        widget.rect.y += delta.y;
    });
},

resize(border,delta) {

    // notation
    const rc = this.rect;

    switch (border.name) {

        case 'corner': 
            if (rc.h + delta.y > style$1.view.hHeader) rc.h += delta.y;
            if (rc.w + delta.x > style$1.look.wBox) rc.w += delta.x;
            break

        case 'top':
            if (rc.h - delta.y < style$1.view.hHeader) return
            rc.y += delta.y;
            rc.h -= delta.y;
            break

        case 'bottom':
            if (rc.h + delta.y < style$1.view.hHeader) return
            rc.h += delta.y;
            break

        case 'right':
            if (rc.w + delta.x < style$1.look.wBox) return 
            rc.w += delta.x;
            break

        case 'left':
            if (rc.w - delta.x < style$1.look.wBox) return
            rc.x += delta.x;
            rc.w -= delta.x;
            break
    }

    // reposition the widgets
    this.placeWidgets();
},

// check the views in reverse order - p is the position in local coordinates
// returns the view, the widget and the local coordinate in that view
// ** RECURSIVE **
whichView(p) {

    const hdr = style$1.view.hHeader;
    const lwi = style$1.view.wLine;

    // check the views in reverse order - the last one is on top !
    for (let i = this.views.length-1; i>=0; i--) {

        // notation
        const view = this.views[i];
        const rc = view.rect;

        // first check if p is inside the client area of the view
        if (((p.x >= rc.x + lwi) && (p.x <= rc.x + rc.w - lwi) && (p.y >= rc.y + hdr) && (p.y <= rc.y + rc.h - lwi))) {

            // transform p to a coordinate inside this view
            p = view.localCoord(p);

            // check if the coordinate is inside a view in this view
            return view.whichView(p)
        }

        // maybe we have hit the header or the border - we know already that we are not in the client area
        const eps = 4;   // some epsilon - extra space around the border
        if ((p.x < rc.x - eps) || (p.x > rc.x + rc.w + eps) || (p.y < rc.y - eps) || (p.y > rc.y + rc.h + eps)) continue

        // when we arrive here it means we are in the the header or on the borders of the view
        // check *ALL* the widgets, but skip the viewBox
        let match = null;
        for (const widget of view.widgets) if (inside(p,widget.rect) && !widget.is.viewBox) match = widget;

        // found the *closest* match
        if (match) return [view, match, p]

        // now check if we are on the borders of the view - we return a pseudo widget !
        if (p.x < rc.x + lwi) return [view, {is:{border:true}, name:'left'},p]

        if (p.x > rc.x + rc.w - lwi)  {

            return (p.y > rc.y + rc.h - 20) ? [view, {is:{border:true}, name:'corner'},p]
                                            : [view, {is:{border:true}, name:'right'},p]
        }
        if (p.y < rc.y + lwi) return [view, {is:{border:true}, name:'top'},p]

        if (p.y > rc.y + rc.h - lwi)  {

            return (p.x > rc.x + rc.w - 20) ? [view, {is:{border:true}, name:'corner'},p]
                                            : [view, {is:{border:true}, name:'bottom'},p]
        }

    }
    return [this, null, p]
},

// // This function calculates the visible rectangle of the canvas
// getVisibleCanvasRect(canvas) {
    
//     const viewportWidth = window.visualViewport.width; // Visible width of the webview
//     const viewportHeight = window.visualViewport.height; // Visible height of the webview

//     // Get canvas position and dimensions
//     const rect = canvas.getBoundingClientRect();

//     // Calculate the visible area within the viewport
//     const visibleX = Math.max(0, rect.left);
//     const visibleY = Math.max(0, rect.top);
//     const visibleWidth = Math.min(rect.width, viewportWidth - visibleX);
//     const visibleHeight = Math.min(rect.height, viewportHeight - visibleY);

//     // Ensure values are positive
//     return {
//         x: visibleX,
//         y: visibleY,
//         width: Math.max(0, visibleWidth),
//         height: Math.max(0, visibleHeight),
//     };
// },

iconClick(icon, editor) {

    // check the type of action for the widget
    switch(icon.type) {

        // close the view
        case 'close': {

            // for a view that is closed, we will not save the parameters to file
            this.viewState.visible = false;

            // reset the previous view parameters if coming from fullscreen
            if (this.viewState.big) this.small();

            // change focus
            editor.switchView(this.parent);

            // close the view
            this.closeView();
        }
        break

        // fullscreen acts as a toggle
        case 'big': {
            // get all the parent views
            const parents = this.parentViewsReverse();

            // switch all the parents to big
            for(const parent of parents)  parent.big();

            // and finally do the same for this view
            this.big();
        }
        break
        
        case 'small': {

            // switch to normal window size
            this.small();

            // big views inside this view are also restored
            for(const view of this.views) if (view.viewState.big) view.small();
        }
        break

        case 'calibrate' : {
            this.toggleTransform();
        }
        break

        case 'grid': {
            this.state.grid = !this.state.grid;
        }
        break
    }
},



viewToFront(frontView) {

    // the new view is part of the views of the doc
    const views = this.views;
    const L = views.length;

    // bring the view to the end of the array - so it is drawn on top
    let index = views.indexOf(frontView);
    let found = views[index];
    
    // shift the views below it one place
    for (let i = index; i < L-1; i++) views[i] = views[i+1];
    views[L-1] = found;
},

cloneForTab() {
    // create a new view
    let view = new View({x:0,y:0,w:0,h:0}, this.root, this.parent);

    // position the tab content at the same place as the window was
    view.tf.dx = this.tf.dx;
    view.tf.dy = this.tf.dy;
    view.tf.sx = this.tf.sx;
    view.tf.sy = this.tf.sy;

    // copy some additional content
    view.views = this.views;

    // copy the parent
    // view.parent = this.parent

    // done
    return view
},

// note that we place the widgets in placeWidgets !
addViewWidgets() {

    // notation
    const rc = this.rect;
    const st = style$1.view;

    // add the box - re-use the view rectangle...
    this.widgets.push(new ViewBox(this.rect));

    // add the title
    if (this.root) this.widgets.push(new ViewTitle({ x:0,y: 0, w: rc.w, h: style$1.view.hHeader}, this.root));

    // add the view icons
    for( const iconName of ['close', 'big', 'calibrate', 'grid']) {

        // create the icon
        const icon = new Icon( { x:0, y:0, w: st.wIcon, h: st.hIcon}, iconName);

        // and set its render function
        icon.setRender();

        // icons are highlighted by default, so set as non-highlighted
        icon.is.highLighted = false;

        // and save
        this.widgets.push(icon);
    } 
},

// place widgets is called when the view changes size or place
placeWidgets() {

    // notation
    const rc = this.rect;
    const st = style$1.view;

    // The position of the first Icon
    let xIcon = rc.x + st.xPadding;

    for(const widget of this.widgets) {
        if (widget.is.icon) {
            // center on y
            widget.rect.y = rc.y + (style$1.view.hHeader - st.hIcon)/2;

            // set the x
            widget.rect.x = xIcon;

            // adjust x
            xIcon += (st.wIcon + st.xSpacing);

            // after the last view icon we add some extra space
            // if (widget.type == 'grid') xIcon += st.xSpacing
        }
        else if (widget.is.viewBox) {
            widget.rect.x = rc.x;
            widget.rect.y = rc.y;
            widget.rect.w = rc.w;
            widget.rect.h = rc.h;
        }
        else if (widget.is.viewTitle) {
            widget.rect.x = rc.x;
            widget.rect.y = rc.y;
            widget.rect.w = rc.w;
        }
    }
},

// toggle the transform for a single view
toggleTransform() {

    const tf = this.tf;
    const vstf = this.viewState.tf;

    // if the current transform is not the unit transform
    if (tf.sx != 1.0) {

        // save the current transform
        this.saveTransform(this.tf);

        // and switch to the unit transform
        this.setTransform({sx:1.0, sy:1.0, dx: tf.dx, dy: tf.dy});

        // recalculate all the windows that are big
        this.redoBigRecursive(); 
    }
    // else we have a saved transform (i.e. it is not the unit transform)
    else if (vstf.sx != 1.0) {

        // switch to the saved transform
        this.setTransform(vstf);

        // recalculate all the windows that are big
        this.redoBigRecursive(); 
    }
},

// parent views - the toplevel parent will be the first entry
parentViewsReverse() {

    // put the view and the views above it in an array
    const parents = [];

    // search all parent views
    let view = this;
    while (view.parent) {
        parents.push(view.parent);
        view = view.parent;
    }

    // reverse the order of the array
    return parents.reverse()
},

toggleBig() {

    if (this.viewState.big) {

        // switch to normal window size
        this.small();

        // big views inside this view are also restored
        for(const view of this.views) if (view.viewState.big) view.toggleBig();
    }
    else {

        // get all the parent views
        const parents = this.parentViewsReverse();

        // switch all the parents to big
        for(const parent of parents)  parent.big();

        // and finally do the same for this view
        this.big();
    }
},

small() {

    // ok copy 
    Object.assign( this.rect , this.viewState.rect);

    // change the icon
    this.widgets.find( icon => icon.type == 'small')?.switchType('big');

    // reposition the widgets
    this.placeWidgets();

    // toggle the flag
    this.viewState.big = false;
},

// We do not want to save the rectangle when we *redo* big (see below)
// because we have already saved it then
big(save=true) {

    // check that the view has a parent and is not big already
    if ( !this.parent) return

    // notation
    const prc = this.parent.rect;
    const ptf = this.parent.tf;
    const st = style$1.view;

    // save the current rect
    if (save) Object.assign(this.viewState.rect, this.rect);

    // If the parent has no parent there is no header
    const yShift = this.parent.parent ? st.hHeader : 0;

    // convert the parent top left coordinates to local coordinates so that they will result 
    // in the correct position *after* the parent tarnsform is applied !
    this.rect.x = (prc.x - ptf.dx)/ptf.sx; 
    this.rect.y = (prc.y + yShift - ptf.dy)/ptf.sy;
    this.rect.w = prc.w / ptf.sx; 
    this.rect.h = (prc.h - yShift) / ptf.sy;

    // change the icon
    this.widgets.find( icon => icon.type == 'big')?.switchType('small');
    
    // reposition the widgets
    this.placeWidgets();

    // set the fullscreen flag
    this.viewState.big = true;
},

redoBigRecursive() {
    if (this.viewState.big) this.big(false);
    for (const view of this.views) view.redoBigRecursive();
},

/// NOT USED BELOW HERE

// // recalibrate all the views
// toggleTransformRecursive() {
//     (this.tf.sx != 1.0) ? this.unitTransformRecursive() : this.restoreTransformRecursive();
// },

// unitTransformRecursive() {

//     // save the current transform
//     this.saveTransform(this.tf)

//     // and switch to the unit transform
//     this.setTransform({sx:1.0, sy:1.0, dx: this.tf.dx, dy: this.tf.dy})

//     if (this.viewState.big) this.big()

//     // repeat for all views
//     for (const view of this.views) view.unitTransformRecursive()
// },

// restoreTransformRecursive() {

//     // restore the saved transform
//     if (this.viewState.tf.sx != 1.0) this.setTransform(this.viewState.tf);

//     if (this.viewState.big) this.big()

//     // repeat for all views
//     for (const view of this.views) view.restoreTransformRecursive()
// },

// toggleViewState() {

//     if (this.viewState.big) {

//         // go back to the previous rectangle
//         this.restoreViewState()

//         // also restore views inside the view to their previous size
//         for(const view of this.views) view.restoreViewState()
//     }
//     else {

//         // get all the parent views
//         const parents = this.parentViewsReverse()

//         // switch all the parents to fullscreen
//         for(const parent of parents) {
//             parent.saveViewState()
//             parent.big()
//         }

//         // and finally do the same for this view
//         this.saveViewState()
//         this.big()
//     }
// },

// // note that we only save and restore the rectangle - not the transform - is more intuitive behaviuour
// saveViewState() {
//     // just assign the current settings
//     Object.assign(this.viewState.rect, this.rect)
//     Object.assign(this.viewState.tf, this.tf)

//     // and validate the copy
//     this.viewState.saved = true
// },

// restoreViewState() {

//     // check that we have a valid previous
//     if (!this.viewState.saved) return

//     // we are not fullscreen anymore
//     this.viewState.big = false

//     // ok copy 
//     Object.assign( this.rect , this.viewState.rect)
//     Object.assign( this.tf,    this.viewState.tf)

//     // we have restored the view, so we have to reposition the widgets
//     this.placeWidgets()
// },

};

const drawerFile = 'drawer/file';

const dropHandling = {

    async onDrop(xyParent, e) {

        // no default action...
        e.preventDefault();

        // transform the parent coordinates to local ones
        let xyLocal = this.localCoord(xyParent);
        
        // check what was hit
        this.mouseHit(xyLocal);
        //this.mouseHit(xyParent, xyLocal) // This is wrong !!!

        // transfer to the view that was hit..
        if (this.hit.view) return this.hit.view.onDrop(xyLocal, e)

        // analyse the dropped data
        const drop = this.analyseDrop(e);

        // check
        if (!drop) return

        // if it can be converted to an arl...
        const arl = new ARL(drop.path);

// RESOLVE 

        // make a model for the dropped arl
        const model = new ModelBlueprint(arl);
        
        // make a compiler
        const modcom = new ModelCompiler( editor.doc.UID );

        // get the file in the drop arl
        const newNode = await modcom.getRoot(model);

        // check
        if ( ! newNode) return null

        // if the node is a container - create a new view for that
        if (newNode.is.group && newNode.isContainer()) {

            // make a reasonable rectangle for the node
            const rect = this.makeViewRect(newNode);
            rect.x = xyLocal.x;
            rect.y = xyLocal.y;

            // create a new view for the container
            this.newSubView(newNode, rect);
        }

        // position the node at the drop location
        newNode.look.moveTo(xyLocal.x, xyLocal.y);

        // change the uids as required
        newNode.uidChangeAll(editor.doc.UID);

        // set the link
        newNode.link = new Link(model, this.name);

        // save on the nodes list
        this.root.nodes.push(newNode);

        // do a redraw (we do it here - async function)
        editor.redraw();

        // done
        return newNode
    },

    analyseDrop(e) {

        // convert
        e.dataTransfer.items ? [...e.dataTransfer.items] : null;
        const files =  e.dataTransfer.files ? [...e.dataTransfer.files] : null;
        const types =  e.dataTransfer.types ? [...e.dataTransfer.types] : null;

        //    //ITEMS
        //    if (items?.length > 0) {
        //         // items ifPins
        //         items.forEach((item, i) => {
        //             console.log('ITEM', item.kind, item)
        //         })          
        //     }

        // FILES 
        if (files?.length > 0) {
            files.forEach((file, i) => {
                // console.log('FILE:', file);
            });
        }

        // TYPES
        if (types?.length > 0) {

            if (types.includes(drawerFile)) {

                // get value and path object
                let drop = JSON.parse(e.dataTransfer.getData(drawerFile));

                // find the path
                return drop
            }
        }

        return null
    },

};

// the ongoing action of a view
const doing = {
    nothing:0,
    nodeDrag:1,
    routeDrag:2,
    panning:3,
    routeDraw:4,
    editTextField:5,
    selection:6,
    selectionDrag:7,
    pinAreaSelect:8,
    pinAreaDrag:9,
    padDrag:10,
    padArrowClicked: 11,
    busDraw:12,
    busRedraw:13,
    busSegmentDrag:14,
    busDrag:15,
    tackDrag:16,
    pinClicked:17,
    pinDrag:18,
    interfaceDrag: 19,
    interfaceNameDrag: 20,
    interfaceNameClicked: 21
};

function View(rect, node=null, parent=null) {

    // the transform parameters - shift the content below the header of the view window !
    //this.tf = {sx:1.0, sy: 1.0, dx:rect.x, dy:rect.y}
    this.tf = {sx:1.0, sy: 1.0, dx:rect.x, dy:rect.y + style$1.view.hHeader};

    // the rectangle of the view
    this.rect = rect;

    // the widgets of the view itself
    this.widgets = [];

    // the (group) root node for which this is the view
    this.root = node;

    // the parent view
    this.parent = parent;

    // a view can contain other views - the children
    this.views = [];

    // on idle we check if we have hit something every x msec
    this.hitTimer = 0;

    // the editor state inside the view - action is one of the doing values above
    this.state = {
        action: 0,      
        pad: null,
        node: null,      
        route: null,
        routeSegment: 0,
        cursorInterval: null,
        bus: null,
        busSegment: 0,
        busLabel: null,
        tack: null,
        lookWidget: null,
        hoverOver: null,
        highLighted: false,
        grid: false,
    };

    // the text object that is being edited
    this.textField = new TextEdit();

    // the element on the screen that was hit - 'what' is a constant of type zap defined in mouse.js
    this.hit = {
        what: 0,
        selection : null,
        xyLocal: {x:0, y:0},
        xyScreen: {x:0, y:0},
        pad: null,
        padArrow: false,
        node: null,
        lookWidget: null,
        route: null,
        routeSegment: 0,
        bus:null,
        busSegment: 0,
        busLabel:null,
        tack:null
    };

    // when selecting we keep track of the selection here
    this.selection = new Selection(this);

    // The state of the view - used to set and restore views
    this.viewState = {
        visible: true,
        big: false,
        tf:{sx:1.0, sy:1.0, dx:rect.x, dy:rect.y},
        rect:{...rect}
    };
}
View.prototype = {

    toJSON() {
    },

    stateSwitch(newAction) {

        // check if we need to do something...
        if (this.state.action == doing.editTextField) this.endTextEdit();

        // switch to the new state
        this.state.action = newAction;
    },

     // resets the view to a known state
    reset() {
        // reset the state
        const state = this.state;
        state.action = doing.nothing;
        state.node = null;
        state.view = null;
        state.route = null;

        // reset the selection
        this.selection.reset();

        // reset all the views contained in this view
        this.views.forEach( view => view.reset());
    },

    // make a reasonable rectangle that contains the nodes and is positioned at the group node
    makeViewRect(node) {

        // if there are no nodes, use default values
        let rc = {x:0,y:0,w:0,h:0};

        // make the view rectangle a little bit bigger
        const µ = 0.1;

        // if there are nodes...
        if ((node.nodes.length > 0) || (node.pads.length > 0) ) {

            // make a rect that contains all nodes and pads
            rc = this.calcRect(node);

            // create some extra width
            rc.w = rc.w + Math.floor(µ*rc.w);

            // create some extra height
            rc.h = rc.h + Math.floor(µ*rc.h);
        }

        // check
        if (rc.w < style$1.view.wDefault) rc.w = style$1.view.wDefault;
        if (rc.h < style$1.view.hDefault) rc.h = style$1.view.hDefault;

        // position the view 
        rc.x = node.look.rect.x;
        rc.y = node.look.rect.y + style$1.view.hHeader + style$1.header.hHeader;

        // done
        return rc
    },

    noRect() {
        return (this.rect.w == 0) || (this.rect.h == 0)
    },

    setRect(x,y,w,h) {
        this.rect.x = x;
        this.rect.y = y;
        this.rect.w = w;
        this.rect.h = h;
    },

    // when putting nodes in a new view, shift the nodes wrt the new origin to 'stay in place'
    shiftContent(dx, dy) {

        // the nodes
        this.root.nodes.forEach( node => {

            // move the look and the widgets
            node.look.moveDelta(dx,dy);

            // move the routes (only the routes that start at this node)
            node.look.moveRoutes(dx,dy);
        });

        // the buses
        this.root.buses.forEach( bus => bus.move(dx, dy));

        // the pads ???
    },

    translate(dx, dy) {
        this.tf.dx += dx;
        this.tf.dy += dy;
    },

    resetTransform() {
        this.tf.dx = this.rect.x;
        this.tf.dy = this.rect.y;
        this.tf.sx = 1.0;
        this.tf.sy = 1.0;
    },

    setTransform(tf) {
        this.tf.dx = tf.dx;
        this.tf.dy = tf.dy;
        this.tf.sx = tf.sx;
        this.tf.sy = tf.sy;
    },

    saveTransform(tf) {
        Object.assign(this.viewState.tf, tf);
    },

    // returns the coordinates of where the middle of the view is in local coordinates
    middle() {

        const tf = this.tf;
        const rc = this.rect;

        // the middle of the view in local coordinates 
        return {
            x: (rc.x + rc.w/2 - tf.dx)/tf.sx,
            y: (rc.y + rc.h/2 - tf.dy)/tf.sy
        }

    },

    initRoot(name) {
        // create the look for the root
        const look = new Look({x:this.rect.x + this.rect.w/2, y:this.rect.y, w:0, h:0});

        // create a groupnode
        this.root = new GroupNode(look,name);

        // return the root
        return this.root
    },

    // render the view    
    render(ctx) {

        // switch to the style of the file where the node comes from
        const savedStyle = style$1.switch(this.root?.link?.model?.header?.style);

        // save the current context settings
        ctx.save();

        // notation
        const rc = this.rect;
        const st = style$1.view;

        // views with a parent have widgets and a clip rectangle
        if (this.parent) {
        
            // draw the widgets
            for (const widget of this.widgets) widget.render(ctx);
        
            // add a clip rect - but exclude the header
            ctx.rect( rc.x + st.wLine/2 , rc.y + st.hHeader, rc.w - st.wLine, rc.h - st.hHeader);
        
            // set it as a clipping region
            ctx.clip();
        }

        // set the *additional* transform for this window
        const tf = this.tf;
        ctx.transform(tf.sx, 0.0, 0.0, tf.sy, tf.dx, tf.dy);

        // draw the grid if necessary
        if (this.state.grid) this.drawGrid(ctx);

        // render the content of the view
        if (this.root) this.renderContent(ctx);

        // if there are other views render them now
        for(const view of this.views) view.render(ctx);
    
        // restore the previous settings
        ctx.restore();

        // restore the style
        style$1.switch(savedStyle);
    },

    renderContent(ctx) {

        // notation
        const root = this.root;

        // if there is a selection, we first render that
        this.selection.render(ctx);    

        // first draw all the routes that originate from the widget (avoids drawing routes twice)
        for(const node of root.nodes) {
            for(const widget of node.look.widgets) {
                if (!widget.routes) continue
                for(const route of widget.routes) {
                    if (route.from == widget) route.render(ctx);
                }
            }
        }

        // draw all the pad routes
        for(const pad of root.pads) {
            for(const route of pad.routes) {
                if (route.from == pad) route.render(ctx);
            }
        }

        // draw all the bus routes
        for(const bus of root.buses) {
            for(const tack of bus.tacks) {
                if(tack.route?.from == tack) tack.route.render(ctx);
            }
        }

        // now render the nodes, pads and buses
        for(const node of root.nodes) node.render(ctx);
        for(const pad of root.pads) pad.render(ctx);
        for(const bus of root.buses) bus.render(ctx);
    },



    highLight() {
        this.state.highLighted = true;
        for (const widget of this.widgets) {
            if (widget.is.viewTitle || widget.is.viewBox || widget.is.icon) {
                widget.is.highLighted = true;
            }
        }
    },

    unHighLight() {
        this.state.highLighted = false;
        for (const widget of this.widgets) {
            if (widget.is.viewTitle || widget.is.viewBox || widget.is.icon) {
                widget.is.highLighted = false;
            }
        }
    },

    // get the toplevel view in the stack
    topView() {

        let top = this;
        while (top.parent) top = parent;
        return top
    },

    drawGrid(ctx) {

        const rc = this.rect;
        const tf = this.tf;
        const grid = style$1.view.grid;
        
        // the top-left and bottom right coordinates of the view
        const area = {  x:(rc.x - tf.dx)/tf.sx, 
                        y:(rc.y - tf.dy)/tf.sy,
                        w: rc.w/tf.sx,
                        h: rc.h/tf.sy
                    };
        // the grid
        shape.grid(ctx, area.x, area.y, area.w, area.h , grid.dx, grid.dy, grid.cLine, grid.cAxis);
    },

    getNamePath() {

        if (!this.parent) return ''

        let view = this;
        let namePath = '';

        while (view.parent) {
            namePath += ' @ ' + view.root.name; 
            view = view.parent;
        }

        return namePath
    }
};

Object.assign(View.prototype, 
    mouseHandling, 
    mouseDownHandling, 
    mouseMoveHandling,
    mouseUpHandling,
    nodeHandling,
    contextHandling,
    selectionHandling, 
    groupHandling,
    alignHandling,
    keyboardHandling,
    viewWidgetHandling,
    dropHandling);

const redoxNode = {

newGroupNode: {

    doit({view, pos}) {

        // create a new node at pos. False = group node
        const node = view.newEmptyNode(pos, false);

        // undo/redo
        editor.saveEdit('newGroupNode',{view, node});
    },
    undo({view, node})    {

        view.root.removeNode(node);

        // ** Note that (currently) we do not remove the node from the uidmap ! **

    },
    redo({view, node})    {

        view.root.addNode(node);
    }
},

newSourceNode: {

    doit({view, pos}) {

        // create a new node at pos. False = group node
        const node = view.newEmptyNode(pos, true);

        // undo/redo
        editor.saveEdit('newSourceNode',{view, node});
    },
    undo({view, node})    {

        view.root.removeNode(node);

        // ** Note that (currently) we do not remove the node from the uidmap ! **
    },
    redo({view, node})    {

        // add the node again
        view.root.addNode(node);
    }
},

wider: {
    doit({node}) {
        node.look.wider();
        editor.saveEdit('wider', {node});
    },
    undo({node})    {
        node.look.smaller();
    },
    redo({node})    {
        node.look.wider();
    }
},

smaller: {
    doit({node}) {
        node.look.smaller();
        editor.saveEdit('smaller', {node});
    },
    undo({node})    {
        node.look.wider();
    },
    redo({node})    {
        node.look.smaller();
    }
},

nodeHighLight: {
    doit({node}) {
        node.is.highLighted ? node.unHighLight() : node.highLight();
        //editor.saveEdit('nodeHighLight', {node})
    },
    undo({node})    {
        //node.is.highLighted ? node.unHighLight() : node.highLight()
    },
    redo({node})    {
        //node.is.highLighted ? node.unHighLight() : node.highLight()
    }
},

convertNode: {

    doit({node}) {

        // notation
        const view = editor.doc.focus;

        // a linked node cannot be changed
        if (node.link) return

        // change the type of node
        const convertedNode = node.switchNodeType( );

        // swap the two nodes in the node tree
        view.root.swap(node, convertedNode);

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable();

        // signal the edit
        editor.saveEdit('convertNode',{view, node, convertedNode});
    },
    undo({view, node, convertedNode}) {

        // set the original node back
        if (view.root.swap(convertedNode, node)) convertedNode.look.transferRoutes(node.look);

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable();
    },
    redo({view, node, convertedNode}) {

        // set the converted node back
        if (view.root.swap(node, convertedNode)) node.look.transferRoutes(convertedNode.look);

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable();
    }
},

nodeToClipboard: {

    doit({view, node}) {

        // select the new node
        view.selection.singleNode(node);  

        // send the clipboard to the clipboard manager
        editor.tx.send('clipboard set',{model: editor.doc.model, selection: view.selection});
    },
    undo(){
    },
    redo(){
    }
},

sourceToClipboard: {

    doit({node}) {
        // check
        if (! node.is.source) return

        // make the body of the source
        const body = node.makeSourceBody();

        // copy the body to the clipboard
        editor.textToExternalClipboard(body);
    },
    undo(){
    },
    redo(){
    }
},

swapPins: {
    
    doit({node, left, right}) {
        // save the pins that will be swapped
        const swapped = [];

        // find the pins that need to be swapped
        for (let widget of node.look.widgets) {
            if ( widget.is.pin && left  && ! widget.is.left) swapped.push(widget);
            if ( widget.is.pin && right &&   widget.is.left) swapped.push(widget);
        }

        // do the actual swapping
        for(const pin of swapped) pin.leftRightSwap();

        // signal the edit
        editor.saveEdit('swapPins', {swapped});
    },
    undo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap();
    },
    redo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap();
    }
},

disconnectNode: {
    doit({node}) {
        // save an array ofpins and routes
        const allRoutes = node.getRoutes();

        // disconnect the node
        node.disconnect();

        // save the edit
        editor.saveEdit('disconnectNode',{node, allRoutes});
    },
    undo({node, allRoutes}) {

        // reconnect the routes to the pins - make a copy of the routes array, redo empties the array again !
        for (const route of allRoutes) route.reconnect();
    },
    redo({node, allRoutes}) {

        // redo the disconnect
        node.disconnect();
    }
},

deleteNode: {
    doit({node}) {
        // save an array ofpins and routes
        const allRoutes = node.getRoutes();

        // disconnect
        node.disconnect();

        // remove the node
        editor.doc.focus.root.removeNode(node);

        // if the node has a view, remove it from the list
        if (node.saveView) node.savedView.closeView();

        // save the edit
        editor.saveEdit('deleteNode',{view: editor.doc.focus, node, allRoutes});
    },
    undo({view, node, allRoutes}) {

        // add the node to the view again
        view.root.addNode(node);

        // reconnect the routes to the pins - make a copy of the routes array
        for (const route of allRoutes) route.reconnect();
    },
    redo({view, node, allRoutes}) {

        node.disconnect();

        view.root.removeNode(node);
    }
},

// for a node that was selected in the library we do not have to make a copy - it was created from raw
nodeFromNodeLib: {
    
    doit({view, node}) {
        // and add it to the root
        view.root.addNode(node);

        // the new node is the selected one !
        view.state.node = node;

        // select the new node
        view.selection.singleNode(node);   

        // save the edit
        editor.saveEdit('nodeFromNodeLib',{view, node});
    },
    undo({view, node}){
        view.root.removeNode(node);
    },
    redo({view, node}){
        view.root.addNode(node);
    },
},

nodeDrag: {
    doit({view, node}) {

        // save the starting position for the undo-operation
        editor.saveEdit('nodeDrag',{node,view,oldPos:{x:node.look.rect.x, y: node.look.rect.y}, newPos:null});
    },
    undo({node, view, oldPos, newPos}) {

        const delta = {x: oldPos.x - newPos.x, y: oldPos.y - newPos.y};
        node.move(delta);
        view.selection.move(delta);
    },
    redo({node, view, oldPos, newPos}) {

        const delta = {x: newPos.x - oldPos.x, y: newPos.y - oldPos.y};
        node.move(delta);
        view.selection.move(delta);
    }
},

// I THINK THIS IS OBSOLETE !!!!
updateProfiles: {
    doit({node}) {

        // profiles can only be updated for source nodes
        if (node.is.group) return

        // there must be a factory
        if (!node.factory.arl) return
    
        // import and analyze
        node.factory.arl.jsImport()
        .then ( (module) => {
            node.analyzeFactory(module);
        });    
    },
    undo({}) {

    },
    redo({}){
        
    }
},

changeNodeSettings: {
    doit({node, sx}) {

        if (JSON.stringify(sx) !== JSON.stringify(node.sx)) node.sx = sx;

        editor.signalEdit('changeNodeSettings');
    },
    undo({}) {
    },
    redo({}){
    }
},

changeNodeDynamics: {
    doit({node, dx}) {

        // if the node.dx is null and the values are default - don't save
        if (!node.dx) ;

        if (JSON.stringify(dx) !== JSON.stringify(node.dx)) node.dx = dx;

        editor.signalEdit('changeNodeDynamics');

    },
    undo({}) {
    },
    redo({}){
    }
},

changeNodeComment: {
    doit({node,comment}) {

        if ( !comment || comment.length == 0) {
            node.prompt = null;
        }
        else if (comment !== node.prompt) {
            node.prompt = comment;
        }

        editor.signalEdit('changeNodeComment');

    },
    undo({}) {
    },
    redo({}){
    }
}


};

const redoxLink = {

cutLink: {

    doit({node}) {

        // check
        if (!node.link) return

        // save the current link
        editor.saveEdit('cutLink',{node, lName: node.link.lName, userPath: node.link.model.arl.userPath});

        // and we simply set the link status
        node.clearLink();

        // now we have to adjust the user paths of the sub-nodes
        node.adjustUserPaths(editor.doc.model.arl);
    },
    undo({node, lName, userPath}) {

       // check
       if (!lName.length)
            node.clearLink();
        else if (userPath.length)
            editor.doc.importFromModel(node, lName, userPath);
        else 
            editor.doc.makeLocalLink(node, lName);
    },
    redo({node, lName, userPath}) {

        // and we add a source or group icon for the node (addIcon removes icons that have the same place !)
        node.clearLink();

        // change references where necessary
        // if (node.nodes) for (const sub of node.nodes) sub.adjustUserPaths( editor.doc.model.arl  )
    }
},

changeLink: {

    async doit({node, lName, userPath}) {

        // trim userPath
        userPath = userPath.trim();

        // trim lName and remove multiple spaces
        lName = convert.cleanLink(lName);

        // make a copy of the original node
        const previous = node.copy();

        // save the current link
        editor.saveEdit('changeLink', {node, previous, lName, userPath});

        // check
        if (!lName.length) {
            node.clearLink();
        }
        else if (userPath.length > 0) {
            await editor.doc.importFromModel(node, lName, userPath);   
            editor.redraw();
        }
        else {
            editor.doc.makeLocalLink(node, lName);
        }
    },
    undo({node, previous, lName, userPath}) {

        // check the icon
        if (!previous.link) previous.is.source ? node.look.addIcon('factory') : node.look.addIcon('group');

        // fuse the node with the previous one
        node.fuse(previous);
    },
    redo({node, previous, lName, userPath}){
        
        // get the node and fuse with the selected node..
        if (!lName.length)
            node.clearLink();
        else if (userPath.length)
            editor.doc.importFromModel(node, lName, userPath);   
        else 
            editor.doc.makeLocalLink(node, lName);
    }
},

saveToLink: {

    doit({node, newName, userPath}) {

        // we need a path to save this node to
        if (! userPath.length > 0) return

        // export the node
        editor.doc.exportToModel(node, newName, new ModelBlueprint( editor.doc.model.arl.resolve(userPath)));
    },
    undo({}) {
    },
    redo({}){  
    }
},

changeFactory: {

    doit({node, newName, userPath}) {

        // copy the old factory
        const oldFactory = node.factory.clone();

        // resolve the input to a new factory arl 
        node.factory?.resolve(newName, userPath, editor.doc.model.arl, node.name);

        // keep the old factory
        editor.saveEdit('changeFactory',{node, oldFactory, newFactory: node.factory});
    },
    undo({node, oldFactory, newFactory}) {

        node.factory = oldFactory;
    },
    redo({node, oldFactory, newFactory}){  

        node.factory = newFactory;
    }
},

};

const redoxWidget = {

newPin: {

    doit({view, node, pos, is}){
        // create the pin
        const pin = node.look.addPin('', pos, is);

        // add a pad or the pin to the rx / tx table
        pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin); 

        // switch the selected pin
        view.selection.switchWidget(pin);

        // edit the name field
        view.beginTextEdit(pin);

        // store and report the new edit - here the rxtx or the pad is added !
        editor.saveEdit('newPin', {view,pin});
    },
    undo({view,pin}) {

        // if the pin was not created (no valid name) just return
        if (!pin || !pin.node.look.widgets.includes(pin)) return

        // the node
        const node = pin.node;

        // switch selection
        view.selection.switchWidget();

        // remove the pin
        node.look.removePin(pin);

        // it is the last entry in the rx/tx table
        pin.is.proxy ? node.pads.pop() : node.rxtxPopPin(pin);
    },
    redo({view,pin}) {

        // if the pin was not created (no valid name) just return
        if (!pin || !pin.node.look.widgets.includes(pin)) return

        // the node
        const node = pin.node;

        // restore the pin to its previous place in the look
        node.look.restorePin(pin);

        // add the pin to the rx / tx table
        pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin); 

        // switch the selected pin
        view.selection.switchWidget(pin);
    }
},

disconnectPin: {

    doit({pin}) {
        // save the routes before disconnecting ...
        const savedRoutes = pin.routes.slice();
        
        // disconnect
        pin.disconnect();

        // store and report the new edit
        editor.saveEdit('disconnectPin',{pin,routes:savedRoutes});
    },
    undo({pin, routes}) { 
        pin.reconnect(routes);
    },
    redo({pin, routes}) { 
        pin.disconnect();
    }
},

deletePin: {

    doit({view, pin}) {
        // save the routes 
        const pinRoutes = pin.routes.slice();

        // also for the pad if applicable
        const padRoutes = pin.is.proxy ? pin.pad.routes.slice() : null;

        // save the edit *before* the delete !
        editor.saveEdit('deletePin',{view, pin, pinRoutes, padRoutes});

        // switch the selection
        view.selection.switchWidget();

        // disconnect
        pin.disconnect();

        // delete the pin in the node
        pin.node.look.removePin(pin);

        // if proxy remove pad
        if (pin.is.proxy) {

            pin.pad.disconnect();

            pin.node.removePad(pin.pad);
        }
        // if not remove from rx table
        else pin.node.rxtxRemovePin(pin);
    },
    undo({view, pin, pinRoutes, padRoutes}) {

        // copy the routes (redo destroys the array - we want to keep it on the undo stack !)
        const copyRoutes = pinRoutes.slice();

        // put the pin back
        pin.node.look.restorePin(pin);

        // switch the selection
        view.selection.switchWidget(pin);

        // reconnect the routes to the pin
        pin.reconnect(copyRoutes);

        // reconnect the routes to the pad
        if (pin.is.proxy) {

            // first add the pad again ?

            // reconnect the routes
            pin.pad.reconnect(padRoutes);
        }
    },

    redo({view, pin, pinRoutes, padRoutes}) {

        // first disconnect
        pin.disconnect();

        // switch the selection
        view.selection.switchWidget();

        // remove the pin
        pin.node.look.removePin(pin);
    }
},

// change the pin from an input type to an output type
ioSwap: {

    doit({pin}) {

        if (pin.ioSwap()) editor.saveEdit('ioSwap',pin);
    },
    undo({pin}) {
        pin.ioSwap();
    },
    redo({pin}) {
        pin.ioSwap();
    }
},

// change the pin from an input type to an output type
channelOnOff: {

    doit({pin}) {

        if (pin.channelOnOff()) editor.saveEdit('channelOnOff',pin);
    },
    undo({pin}) {
        pin.channelOnOff();
    },
    redo({pin}) {
        pin.channelOnOff();
    }
},

pinDrag: {

    doit({pin}) {
        editor.saveEdit('pinDrag', {pin, oldPos: {left: pin.is.left, y: pin.rect.y}, newPos: null});
    },
    undo({pin, oldPos, newPos}) {
        pin.moveTo(oldPos.left, oldPos.y);
    },
    redo({pin, oldPos, newPos}) {
        pin.moveTo(newPos.left, newPos.y);
    }
},

pinAreaDrag: {

    doit(view) {

        // The widgets that are being dragged
        const widgets = view.selection.widgets;

        // get the current y-position of the selected widgets
        editor.saveEdit('pinAreaDrag', {widgets, oldY:widgets[0].rect.y, newY:widgets[0].rect.y});
    },
    undo({widgets, oldY, newY}) {
    },
    redo({widgets, oldY, newY}) {
    }
},

showProfile: {

    doit({pin, pos}) {

        // check that we have a model
        if ( ! (editor.doc?.model) ) return 

        // get the pin profile (can be a single profile or an array !)
        const profile = pin.is.input ? editor.doc.model.getInputPinProfile(pin) : editor.doc.model.getOutputPinProfile(pin);

        // check
        if (!profile) return

        // show the profile
        editor.tx.send('pin profile',{pos, pin, profile,
            
            // The function that is called when clicking the handler name
            open(loc){
                
                //const arl = new ARL(loc.file)

                // resolve the file name with the model name
                const arl = editor.doc.model.arl.resolve(loc.file);

                // request to open the source file
                editor.tx.send('open source file',{arl, line:loc.line});
            }
        });
    },

    undo() {},
    redo(){}
},


newInterfaceName: {

    doit({view, node, pos}) {
        // make a new ifName and put it in edit mode
        let ifName = node.look.addIfName('',pos);

        // set the field in edit mode
        view.beginTextEdit(ifName);

        // switch the selected pin
        view.selection.switchWidget(ifName);

        // store and report the new edit
        editor.saveEdit( 'newInterfaceName', {ifName});
    },
    undo({ifName}) {
        ifName.node.look.removeInterfaceName(ifName);
    },
    redo({ifName}) {
        ifName.node.look.restoreInterfaceName(ifName);
    }
},

deleteInterfaceName: {

    doit({view,ifName}) {

        // switch the selection
        view.selection.switchWidget();

        // show the full names of the ifName group
        const pxlenArray = ifName.node.look.showPrefixes(ifName);

        // remove the pin
        ifName.node.look.removeInterfaceName(ifName);

        // store and report the new edit
        editor.saveEdit('deleteInterfaceName',{view,ifName, pxlenArray});
    },
    undo({view,ifName, pxlenArray}) {
        // restore the ifName
        ifName.node.look.restoreInterfaceName(ifName);

        // restore the prefixes
        ifName.node.look.hidePrefixes(ifName, pxlenArray);

        // switch the selection
        view.selection.switchWidget(ifName);
    },
    redo({view,ifName, pxlenArray}) {

        // switch the selection
        view.selection.switchWidget();

        // show the full names of the ifName group
        ifName.node.look.showPrefixes(ifName);

        // remove the ifName
        ifName.node.look.removeInterfaceName(ifName);
    }
},

interfaceDrag: {

    doit({group, oldY, newY}) {

        // just save the parameters...
        editor.saveEdit('interfaceDrag',{group, oldY, newY});
    },
    undo({group, oldY, newY}) {

        const dy = oldY - newY;
        const node = group[0].node;
        node.look.groupMove(group, dy);
    },

    redo({group, oldY, newY}) {

        const dy = newY - oldY;
        const node = group[0].node;
        node.look.groupMove(group, dy);
    }
},

interfaceNameDrag: {

    doit({ifName}) {
        editor.saveEdit('interfaceNameDrag', {ifName, oldY: ifName.rect.y, newY:ifName.rect.y});
    },
    undo({ifName, oldY, newY}) {
        ifName.moveTo(oldY);
    },
    redo({ifName, oldY, newY}) {
        ifName.moveTo(newY);
    }
},

addLabel: {
    doit({node}) {

        // find the label of the look or add an empty one
        let label = node.look.widgets.find( widget => widget.is.label ) ?? node.look.addLabel('');

        // start editing the field - parameters = object - must have the edit ifPins !
        editor.doc?.focus?.beginTextEdit(label);

        // signal the edit
        editor.saveEdit('addLabel',{node, label});
    },
    undo({node, label}) {

        node.look.removeLabel();
    },
    redo({node, label}) {

        node.look.restoreLabel(label);
    }
},

widgetTextEdit: {

    doit({view, widget, cursor, clear}) {

        // check if field is editable - must return the prop that will be edited
        const prop = widget.startEdit?.();

        // check
        if (!prop) return

        // save the old value
        editor.saveEdit('widgetTextEdit',{widget, prop, oldText: widget[prop], newText:''});

        // keyboard handling etc is done here
        view.beginTextEdit(widget, cursor, clear ?? false);
    },
    undo({widget, prop, oldText, newText}) {

        /*
        better is to call simply undoTextEdit
        ======================================

        widget.undoTextEdit(oldText)
        */

        // save the new text now also !
        newText = widget[prop];
        editor.getParam().newText = newText;
        widget[prop] = oldText;

        // signal the widget that the value has changed
        widget.endEdit(newText);

    },
    redo({widget, prop, oldText, newText}) {

        widget[prop] = newText;

        widget.endEdit(oldText);
    }
}


};

const redoxRoute = {

routeDrag: {

    doit({route}) {
        // save the edit
        editor.saveEdit('routeDrag', {  route, oldWire: route.copyWire(), newWire: null} );
    },
    undo({route, oldWire, newWire}) {
        route.restoreWire(oldWire);
    },
    redo({route, oldWire, newWire}) {
        route.restoreWire(newWire);
    }
},

routeDraw: {

    // the edit is called when the route is completed 
    doit({route}) {
        editor.saveEdit('routeDraw',{route, newRoute:route.clone()});

        // check if the route has to be displayed as a twisted pair
        route.checkTwistedPair();

        // check if the route can be used or not
    },

    // The old route is actually a copy but with the original from/to and points
    undo({route, newRoute}) {

        // disconnect the route
        route.disconnect();
    },

    redo({route, newRoute}) {

        // check if there is a new route
        if (newRoute) route.connectFromClone(newRoute);
    }
},

deleteRoute: {

    // The edit is called at the start of the redraw - newRoute is added when the route is completed
    doit({route}) {

        editor.saveEdit('deleteRoute',{route, oldRoute:route.clone()});

        // disconnect the route
        route.disconnect();

        // remove the route at both endpoints
        route.remove();
    },

    // The old route is actually a clone with the original from/to and points
    undo({route, oldRoute}) {

        // check if there was an old route
        if (oldRoute) route.connectFromClone(oldRoute);
    },

    redo({route, oldRoute}) {

        // disconnect the old route
        route.disconnect();

        // check if there is a new route
        route.remove();
    }
},

};

const redoxBus = {

busHighlight: {
    doit({bus}) {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight();
        editor.saveEdit('busHighLight', {bus});
    },
    undo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight();
    },
    redo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight();
    }
},

busCreate: {

    doit({view, pos, cable}) {
        view.state.bus = view.root.addBus("", pos);
        editor.saveEdit('busCreate',{node:view.root, bus: view.state.bus});

        if (cable) view.state.bus.is.cable = true;
    },
    undo({node, bus}) {
        node.removeBus(bus);
    },
    redo({node, bus}) {
        node.restoreBus(bus);
    }
},

busChangeName: {

    doit({bus, label}){

        // save the bus in the state
        editor.doc.focus.state.bus = bus;

        // set the bus as selected
        bus.selected = true;

        // if no label selected, take the start label
        if (!label) label = bus.startLabel;

        // start editing the field
        editor.doc.focus.beginTextEdit(label);

        // save the edit
        editor.saveEdit('busChangeName',{label, oldName: label.text, newName:null});
    },
    undo({label, oldName, newName}){
        editor.getParam().newName = label.text;
        label.setText(oldName);
    },
    redo({label, oldName, newName}){
        label.setText(newName);
    },

},

busChangeType: {

    doit({bus}) {

        // make a copy of the tacks
        const oldTacks = bus.tacks.slice();

        // save the edit
        editor.saveEdit('busChangeType', {bus, tacks: oldTacks});

        // disconnect
        bus.disconnect();

        // change the type of bus
        bus.is.cable = !bus.is.cable;

        // ..and reconnect
        bus.reconnect(oldTacks);
    },
    undo({bus, tacks}) {
        const oldTacks = tacks.slice();
        bus.disconnect();
        bus.is.cable = !bus.is.cable;
        bus.reconnect(oldTacks);
    },
    redo({bus, tacks}) {
        const oldTacks = tacks.slice();
        bus.disconnect();
        bus.is.cable = !bus.is.cable;
        bus.reconnect(oldTacks);
    }    
},

busDeleteRouter: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDeleteRouter', {bus});

        // disconnect the bus from the filter
        bus.is.filter = false;
    },
    undo({bus}) {
        bus.is.filter = true;
    },
    redo({bus}) {
        bus.is.filter = false;
    }    
},

busChangeRouter: {

    doit({bus, newName, userPath}) {

        // copy the old factory
        const oldRouter = bus.filter ? bus.filter.clone() : null;

        // resolve the input to a new factory arl 
        if (!bus.filter) bus.filter = new Factory();
        bus.filter.resolve(newName, userPath, editor.doc.model.arl, bus.name);

        // set the filter bit
        bus.is.filter = true;

        // keep the old factory
        editor.saveEdit('busChangeRouter',{bus, oldRouter, newRouter: bus.filter});

    },
    undo({bus, oldRouter, newRouter}) {
        bus.filter = oldRouter;
    },
    redo({bus, oldRouter, newRouter}) {
        bus.filter = newRouter;
    }    
},

busStraightConnections: {

    doit({bus}) {

        const wireArray = [];

        // save the wires of the bus tacks
        for(const tack of bus.tacks) wireArray.push({   tack, 
                                                        oldPos:{x: tack.rect.x, y: tack.rect.y}, 
                                                        wire: tack.route.copyWire()});

        // save
        editor.saveEdit('busStraightConnections',{bus, wireArray});

        bus.straightConnections();
    },
    undo({bus, wireArray}) {

        for (const entry of wireArray) {

            const tack = entry.tack;

            tack.pos.x = entry.oldPos.x;
            tack.pos.y = entry.oldPos.y;
            tack.route.restoreWire(entry.wire);
        }

    },
    redo({bus, wireArray}) {
        bus.straightConnections();
    }
},

busDisconnect: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDisconnect', {bus, tacks: bus.tacks.slice()});

        // disconnect all the routes to the bus
        bus.disconnect();
    },
    undo({bus, tacks}) {
        bus.reconnect(tacks.slice());
    },
    redo({bus, tacks}) {
        bus.disconnect();
    }    
},

busDelete: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDelete', {node: editor.doc.focus.root, bus, tacks:bus.tacks.slice()});

        // delete the bus
        editor.doc.focus.root.deleteBus(bus);
    },

    undo({node, bus, tacks}) {
        node.restoreBus(bus);
        bus.reconnect(tacks.slice());
    },
    redo({node, bus, tacks}) {
        bus.disconnect();
        node.removeBus(bus);
    }    
},

busDraw: {

    doit({bus}) {
        // save the edit for undo/redo
        editor.saveEdit('busDraw',{bus,oldWire: bus.copyWire(),newWire: null});
    },
    undo({bus, oldWire, newWire}) {
        bus.restoreWire(oldWire);
        bus.startLabel.place();
        bus.endLabel.place();
    },
    redo({bus, oldWire, newWire}) {
        bus.restoreWire(newWire);
        bus.startLabel.place();
        bus.endLabel.place();
    }
},

busSegmentDrag: {

    doit({bus}) {

        // save the edit for undo/redo
        editor.saveEdit('busSegmentDrag',{  bus,
            oldWire: bus.copyWire(),
            newWire: null,
            oldTackWires: bus.copyTackWires(),
            newTackWires: null
        });
    },

    undo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(oldWire);
        bus.restoreTackWires(oldTackWires);
        bus.startLabel.place();
        bus.endLabel.place();
        bus.placeTacks();
    },
    redo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(newWire);
        bus.restoreTackWires(newTackWires);
        bus.startLabel.place();
        bus.endLabel.place();
        bus.placeTacks();
    }
},

busDrag: {

    doit({bus}) {

        // save the edit for undo/redo
        editor.saveEdit('busDrag',{  bus,
            oldWire: bus.copyWire(),
            newWire: null,
            oldTackWires: bus.copyTackWires(),
            newTackWires: null
        });
    },
    undo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(oldWire);
        bus.restoreTackWires(oldTackWires);
        bus.startLabel.place();
        bus.endLabel.place();
        bus.placeTacks();
    },
    redo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(newWire);
        bus.restoreTackWires(newTackWires);
        bus.startLabel.place();
        bus.endLabel.place();
        bus.placeTacks();
    }
},

tackDrag: {

    doit({tack}) {
        // save the edit for undo/redo
        editor.saveEdit('tackDrag',{tack,oldWire: tack.route.copyWire(), newWire: null});       
    },
    undo({tack, oldWire, newWire}) {
        tack.route.restoreWire(oldWire);
        tack.orient();
    },
    redo({tack, oldWire, newWire}) {
        tack.route.restoreWire(newWire);
        tack.orient();
    }
},
};

const redoxPad = {

padCreate: {

    doit({view, pos, input}) {

        // check
        if (!view.root) return

        // set the status
        const is = {
            input,
            left : pos.x < view.middle().x
        };

        // add a pin to the node
        let proxy = view.root.look.addPin('', pos, is);

        // determine the rectangle for the pad widget
        const rect = proxy.makePadRect({x:pos.x, y:pos.y-style.pad.hPad/2});

        // create the pad
        const pad = new Pad(rect, proxy);

        // !! if left we shift over the calculated width !!
        if (is.left) pad.rect.x -= pad.rect.w;

        // and save the pad
        view.root.pads.push(pad); 

        // give the pad a UID
        editor.doc.UID.generate(pad);

        // start editing the pad name
        view.beginTextEdit(pad);

        // save the editor action
        editor.saveEdit('padCreate', {view, pad});
    },

    undo({view, pad}) {

        // it could be that the pad has not been created because the name was not ok
        if (! view.root.pads.includes(pad)) return

        pad.disconnect();

        view.root.removePad(pad); 

        pad.proxy.disconnect();

        view.root.look.removePin(pad.proxy);
    },

    redo({view, pad}) {

        // it could be that the pad has not been created because the name was not ok
        if (! view.root.pads.includes(pad)) return

        view.root.restorePad(pad);
        view.root.look.restorePin(pad.proxy);
    }

},

changeNamePad: {

    doit({view, pad}) {
        // check
        if (!pad?.proxy) return

        //save the edit
        editor.saveEdit('changeNamePad',{pad, oldName: pad.text, newName: null});

        // start editing the field
        view.beginTextEdit(pad);
    },
    undo({pad, oldName, newName}) {
        // save the new name
        editor.getParam().newName = pad.text;

        // notation
        const node = pad.proxy.node;

        // if the newname is '', then the pad has been removed > restore pad and pin !
        if (pad.text.length == 0) {
            node.restorePad(pad);
            node.look.restorePin(pad.proxy);
        }
        // reset the old name
        pad.proxy.name = oldName;
        pad.nameChange(oldName);
    },
    redo({pad, oldName, newName}) {

        // notation
        const node = pad.proxy.node;

        if (!newName || newName.length == 0) {
            // remove the pad
            node.removePad(pad);

            // remove the proxy - there should be no more routes connected to the widget !!!
            node.look.removePin(pad.proxy);

            // done
            return
        }
        // set the new name again
        pad.proxy.name = newName;
        pad.nameChange(newName);
    }
},

disconnectPad: {

    doit({pad}) {
        // save the edit *before* disconnecting
        editor.saveEdit('disconnectPad',{pad, routes: pad.routes.slice()});

        // disconnect all the routes to the pad
        pad.disconnect();
    },
    undo({pad, routes}) {
        pad.reconnect(routes.slice());
    },
    redo({pad, routes}) {
        pad.disconnect();
    }
},

deletePad: {

    doit({pad}) {
        // save the edit *before* disconnecting
        editor.saveEdit('deletePad',{pad, routes: pad.routes.slice()});

        // notation
        const node = editor.doc.focus.root;

        pad.disconnect();

        node.removePad(pad);

        pad.proxy.disconnect();

        node.look.removePin(pad.proxy);
    },
    undo({pad, routes}) {

        const node = pad.proxy.node;
        node.restorePad(pad);
        node.look.restorePin(pad.proxy);
        pad.reconnect(routes.slice());
    },
    redo({pad, routes}) {

        pad.disconnect();
        pad.proxy.node.removePad(pad);
        pad.proxy.disconnect();
        pad.proxy.node.look.removePin(pad.proxy);
    }
},

extrudePad: {

    doit({view, pos}) {

        // the pin that we want to extrude
        const pin = view.hit.lookWidget;
        
        // if we have hit a pin and the pin is not yet a proxy in the root 
        if (!pin.is.pin) return

        // we create a new proxy in the parent (i.e. the root node)
        const is = {...pin.is};

        // but it is a proxy
        is.proxy = true;

        // create the proxy
        const proxy = view.root.look.addPin(pin.name, pos, is);

        // get the rect for the pad
        const rect = pin.makePadRect(pos);

        // create the pad
        const pad = new Pad(rect, proxy);

        // give the pad a uid
        editor.doc.UID.generate(pad);

        // place the pad
        pad.place();

        // create a short connection to the actual widget
        pad.shortConnection(pin);

        // ..save the edit
        editor.saveEdit('extrudePad',{pad, routes: pad.routes.slice()});

        // and save the pad
        view.root.pads.push(pad); 

        // and update the state
        view.state.pad = pad;
    },
    undo({pad, routes}) {
        pad.disconnect();
        pad.proxy.node.removePad(pad);
    },
    redo({pad, routes}) {
        const node = pad.proxy.node;
        node.restorePad(pad);
        node.look.restorePin(pad.proxy);    
        pad.reconnect(routes.slice());    
    }
},

padDrag: {

    doit({pad}) {
        // save the route points for the undo-operation
        editor.saveEdit('padDrag',{ pad,
                                    oldPos:{x:pad.rect.x, y:pad.rect.y}, 
                                    oldWires: pad.copyWires(), 
                                    newPos:null,
                                    newWires:null});
    },

    undo({pad, oldPos, oldWires, newPos, newWires}) {

        const delta = {x: oldPos.x - newPos.x, y: oldPos.y - newPos.y};
        pad.move(delta);
        pad.restoreWires(oldWires);
    },
    redo({pad, oldPos, oldWires, newPos, newWires}) {

        const delta = {x: newPos.x - oldPos.x, y: newPos.y - oldPos.y};
        pad.move(delta);
        pad.restoreWires(newWires);
    }
}

};

const redoxSelect = {

alignVertical: {

    doit({view, left}) {

        // notation
        const nodes = view.selection.nodes;
        const pads = view.selection.pads;
        let deltaNodes = [];
        let deltaPads = [];

        // more then one node selected ?
        if (nodes.length > 1) {

            // calculate the horizontal (x) displacements
            deltaNodes = view.nodesAlignHD(nodes, left);

            // now move the nodes and the routes
            view.moveNodesAndRoutes(nodes, deltaNodes);
        }

        // more then one pad selected ?
        if (pads.length > 1) {

            // calculate the delta for every pad
            deltaPads = view.padsAlignHD(pads, left);

            // move the pad
            view.movePadsAndRoutes(pads, deltaPads);
        }

        // save the edit
        editor.saveEdit('alignVertical', {view, nodes, deltaNodes, pads, deltaPads});        
    },
    undo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = true
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true);
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, true);
    },
    redo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = false
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false);
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, false);
    }  
},

spaceVertical: {

    doit({view}) {

        // notation
        const nodes = view.selection.nodes;
        const pads = view.selection.pads;
        let deltaNodes = [];
        let deltaPads = [];

        // more then one node selected ?
        if (nodes.length > 1) {

            // calculate the horizontal (x) displacements
            deltaNodes = view.nodesSpaceVD(nodes);

            // now move the nodes and the routes
            view.moveNodesAndRoutes(nodes, deltaNodes);
        }

        // more then one pad selected ?
        if (pads.length > 1) {

            // calculate the delta for every pad
            deltaPads = view.padsSpaceVD(pads);

            // move the pad
            view.movePadsAndRoutes(pads, deltaPads);
        }

        // save the edit
        editor.saveEdit('spaceVertical', {view, nodes, deltaNodes, pads, deltaPads});        
    },
    undo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = true
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true);
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, true);
    },
    redo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = false
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false);
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, false);
    }  
},

alignHorizontal: {

    doit({view,top}) {
        // notation
        const nodes = view.selection.nodes;

        // check
        if (nodes.length < 2) return
    
        // calculate the dy displacements
        const deltaNodes = view.nodesAlignVD(nodes);
    
        // and move nodes and routes
        view.moveNodesAndRoutes(nodes, deltaNodes);
    
        // save the edit
        editor.saveEdit('alignHorizontal', {view, nodes, deltaNodes});
    },
    undo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true);
    },
    redo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false);
    }  
},

spaceHorizontal: {

    doit({view}) {
        const nodes = view.selection.nodes;

        if (nodes.length < 2) return
    
        // calculate the horizontal (x) displacements
        const deltaNodes = view.nodesSpaceHD(nodes, left);
    
        // now move the nodes and the routes
        view.moveNodesAndRoutes(nodes, deltaNodes);
    
        // save the edit
        editor.saveEdit('spaceHorizontal', {view, nodes, deltaNodes});
    },
    undo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true);
    },
    redo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false);
    }  
},

selectionDrag: {

    doit({view}){
        // make a shallow copy
        const selection = view.selection.shallowCopy();
        const oldPos = {x:selection.rect.x, y: selection.rect.y};

        // save the selection
        editor.saveEdit('selectionDrag', {  view, selection, oldPos: oldPos,newPos: null });
    },
    undo({view, selection, oldPos, newPos}) {

        // drag the selection (remember: it is a copy !)
        selection.drag({x: oldPos.x-newPos.x, y: oldPos.y - newPos.y});

        // also set the *original* rectangle to the initial position
        view.selection.setRect(oldPos.x, oldPos.y, selection.rect.w, selection.rect.h);
    },
    redo({view, selection, oldPos, newPos}) {

        // drag the selection again (remember it is a copy)
        selection.drag({x: newPos.x-oldPos.x, y: newPos.y - oldPos.y});

        // set the *original* rectangle to the new position
        view.selection.setRect(newPos.x, newPos.y, selection.rect.w, selection.rect.h);
    }

},

disconnectSelection: {

    doit({selection}) {
        // an array of arrays to save the routes of each node
        const allRoutes = [];
        
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // save the routes first !
            allRoutes.push(node.getRoutes());

            // disconnect
            node.disconnect();
        }

        // save the edit
        editor.saveEdit('disconnectSelection', {selection: selection.shallowCopy(), allRoutes });
    },
    // nota that allRoutes is an array of arrays - one for each node !
    undo({selection, allRoutes}) {

        for (const routes of allRoutes) {
            for (const route of routes) {
                route.reconnect();
            }
        }
    },
    redo({selection, allRoutes}) {
        for (const node of selection.nodes) node.disconnect();
    }
},

deleteSelection: {

    doit({view}) {

        // an array of arrays to save the routes of each node
        const allRoutes = [];

        // notation
        const selection = view.selection;
            
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // save the routes
            allRoutes.push(node.getRoutes());

            // disconnect
            node.disconnect();

            // disconnect and remove
            view.root.removeNode(node);
        }

        // remove the pads
        for (const pad of selection.pads) {

            // disconnect pad
            pad.disconnect();

            // remove pad
            view.root.removePad(pad);

            // disconnect pin
            pad.proxy.disconnect();

            // remove pin
            view.root.look.removePin(pad.proxy);
        }

        // remove the buses in the selection, but only the ones that have no connections anymore
        for (const bus of selection.buses) {

            // check
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.removeBus(bus);
        }

        // save the edit
        editor.saveEdit('deleteSelection', {view, selection: selection.shallowCopy(),allRoutes });

        // clean up the selection
        selection.reset();

        // change the state
        view.stateSwitch(doing.nothing);
    },

    // nota that allRoutes is an array of arrays - one for each node !
    undo({view, selection, allRoutes}) {

        // add all the nodes again
        for (const node of selection.nodes) view.root.addNode(node);

        // add all the pads again
        for (const pad of selection.pads) {

            const node = pad.proxy.node;
            node.restorePad(pad);
            node.look.restorePin(pad.proxy);
        }

        // add the buses again
        for (const bus of selection.buses) {

            // only the buses without connections were removed
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.restoreBus(bus);
        }

        // add all the routes again
        for (const routes of allRoutes) {
            for (const route of routes) {
                route.reconnect();
            }
        }
    },

    redo({view, selection, allRoutes}) {
        
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // disconnect
            node.disconnect();

            // disconnect and remove
            view.root.removeNode(node);
        }

        // remove the pads
        for (const pad of selection.pads) {

            // disconnect
            pad.disconnect();

            // remove
            view.root.removePad(pad);

            // disconnect pin
            pad.proxy.disconnect();

            // remove pin
            view.root.look.removePin(pad.proxy);
        }

        // remove the buses in the selection, but only the ones that have no connections anymore
        for (const bus of selection.buses) {

            // check
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.removeBus(bus);
        }
    }
},

selectionToClipboard: {

    doit({view}){

        // copy the selection to the clipboard of the editor
        view.selectionToClipboard();
    },
    undo(){},
    redo(){}
},

pasteFromClipboard: {

    doit({view, pos, clipboard}){

        // copy the clipboard to the view and to the selection at the position
        view.clipboardToSelection(pos, clipboard);

        // Change the factory and link paths if the selection is copied from a different directory
        if ( ! editor.doc.model.arl.sameDir(clipboard.origin.arl) ) clipboard.selection.adjustPaths( editor.doc.model.arl );

        // change the names of the copied nodes if duplicates
        view.checkPastedNames(clipboard.copyCount);

        // save the edit
        editor.saveEdit('pasteFromClipboard', {view, selection: view.selection.shallowCopy()});
    },
    undo({view, selection}){
        view.removeSelection(selection);
    },
    redo({view, selection}){
        view.restoreSelection(selection);
    },
},

linkFromClipboard: {

    doit({view, pos, clipboard}){

        // also set the relative path for the model
        clipboard.origin.arl.makeRelative(editor.doc.model.arl);

        // copy the clipboard to the view and to the selection
        view.clipboardToSelection(pos, clipboard);

        // the nodes are links
        view.linkToClipboardNodes(clipboard.origin, clipboard.selection.viewPath);

        // change the names of the copied nodes if duplicates
        view.checkPastedNames(clipboard.copyCount);

        // save the edit
        editor.saveEdit('linkFromClipboard', {view, selection: view.selection.shallowCopy()});
    },
    undo({view, selection}){
        view.removeSelection(selection);
    },
    redo({view, selection}){
        view.restoreSelection(selection);
    },
},

selectionToGroup: {

    doit({view}){

        // notation
        const selection = view.selection;

        // if there are no nodes there is nothing to group
        if (selection.nodes.length == 0) return

        // an array of arrays to save the routes of each node
        const allRoutes = [];

        // save all the routes of the nodes that will be transferred
        for (const node of selection.nodes)  allRoutes.push(node.getRoutes());
        
        // make a new group with the selection
        const newGroup = view.selectionToGroup(editor.doc.UID);

        // save the shift that was done
        const shift = {dx: newGroup.savedView.rect.x, dy: newGroup.savedView.rect.y};

        // save the edit
        editor.saveEdit('selectionToGroup', {view, selection: selection.shallowCopy(), newGroup, shift, allRoutes});

        // remove the selection (also changes the state)
        selection.reset();

        // change the state
        view.stateSwitch(doing.nothing);

        // rebuild the tx table ?
    },
    undo({view, selection, newGroup, shift, allRoutes}){

        view.undoSelectionToGroup(selection, newGroup, shift, allRoutes);
    },
    redo({view, selection, newGroup, allRoutes}){

        // // make a new group with the selection
        // const newGroup = view.selectionToGroup()

        // // remove the selection (also changes the state)
        // view.selection.reset()

        // // change the state
        // view.stateSwitch(doing.nothing)
    }
},

// ungroup only works if the node that has to be ungrouped has no external connections
unGroup: {

    doit({view, node}){

        // check
        if (!node.is.group || node.isConnected()) return

        // routes to pads will be removed, so we save those
        const padRoutes = [];
        for(const pad of node.pads) for(const route of pad.routes) padRoutes.push(route);

        // the nodes and busses have to be moved to the equivalent position in this view
        const shift = {dx: view.rect.x, dy:view.rect.y};

        // save the undo parameters
        editor.saveEdit('unGroup',{view, node, shift, padRoutes});

        // move the nodes and busses to the view
        view.transferToSelection(node, shift);
    },
    undo({view, node, shift, padRoutes}){

        view.undoTransferToSelection(node, shift, padRoutes);
    },
    redo({view, node, shift, padRoutes}){

    }
},

};

const redoxSelectWidgets = {

disconnectPinArea: {

    doit({view,node, widgets}) {
        // save an array of pins and routes
        const allRoutes = node.getAllRoutes(widgets);

        // disconnect the node
        node.disconnectPinArea(widgets);

        // save the edit
        editor.saveEdit('disconnectPinArea',{node, widgets: widgets.slice(), allRoutes});
    },
    undo({node, widgets, allRoutes}) {

        // reconnect the routes to the pins - make a copy of the routes array, redo empties the array again !
        for (const route of allRoutes) route.reconnect();
    },
    redo({node, widgets, allRoutes}) {

        // redo the disconnect
        node.disconnectPinArea(widgets);
    }
},

deletePinArea: {

    doit({view,node, widgets}) {

        // save an array of pins and routes
        const allRoutes = node.getAllRoutes(widgets);

        // save the edit
        editor.saveEdit('deletePinArea',{view, node, widgets: widgets.slice(), allRoutes});

        // disconnect
        node.disconnectPinArea(widgets);

        // remove the widgets
        node.look.deletePinArea(widgets);
    },
    undo({view, node, widgets, allRoutes}) {

        // the position
        const first = widgets[0];
        const pos = {x: first.rect.x, y: first.rect.y};

        // add the widgets back
        node.look.copyPinArea(widgets, pos);

        // add the pads or the adjust the rx/tx tables
        node.is.source ? node.rxtxAddPinArea(widgets) : node.addPads(widgets);

        // reconnect the routes to the pins - make a copy of the routes array
        for (const route of allRoutes) route.reconnect();
    },
    redo({view, node, widgets, allRoutes}) {

        node.disconnectPinArea(widgets);
        node.look.deletePinArea(widgets);
    }
},

swapPinArea: {

    doit({view, left, right}){
        // save the pins that will be swapped
        const swapped = [];

        // find the pins that need to be swapped
        for (let widget of view.selection.widgets) {
            if ( widget.is.pin && left  && ! widget.is.left) swapped.push(widget);
            if ( widget.is.pin && right &&   widget.is.left) swapped.push(widget);
        }

        // do the actual swapping
        for(const pin of swapped) pin.leftRightSwap();

        // signal the edit
        editor.saveEdit('swapPinArea', {swapped});
    },
    undo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap();
    },
    redo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap();
    }
},

pasteWidgetsFromClipboard: {

    doit({view, clipboard}){

        // check that the clipboard contains a pin area selection
        if (clipboard.selection.what != selex.pinArea) return

        // get the single node and widget
        const [node, pos] = view.selectedNodeAndPosition();

        // check
        if (node.cannotBeModified()) return

        // get the widgets from the clipboard
        view.clipboardToSelection(pos,clipboard);

        // save the edit
        editor.saveEdit('pasteWidgetsFromClipboard', {view, node, widgets: view.selection.widgets.slice(), pos});
    },
    undo({view,node, widgets, pos}) {

        // delete the transferred widgets again...
        if (widgets) node.look.deletePinArea(widgets);

        // reset the selection
        view.selection.reset();
    },
    redo({view, node, widgets, pos}) {

        // bring the widgets back
        const copies = node.look.copyPinArea(widgets, pos);

        // add the pads or the adjust the rx/tx tables
        node.is.source ? node.rxtxAddPinArea(widgets) : node.addPads(widgets);

        // set as selected
        view.selection.pinAreaSelect(copies);

        // change the widgets
        widgets.splice(0, widgets.length, ...copies);
    }
},

pinAreaToMulti: {

    doit({view,widgets}) {
        editor.saveEdit('pinAreaToMulti',{view, widgets});
    },
    undo({view, widgets}) {
    },
    redo() {}
},

multiToPinArea: {

    doit({view,pin}) {
        editor.saveEdit('multiToPinArea',{view, pin});
    },
    undo({view, pin}) {
    },
    redo() {}
},

};

const redoxView = {

panning: {

    doit({view}){
    },
    undo({}) {
    },
    redo({}) {
    }
},

xxpanning: {

    doit({view}){

        editor.saveEdit('panning', {view, oldTf: {...view.tf}, newTf: {...view.tf}});
    },
    undo({view, oldTf, newTf}) {

        // save the current values
        newTf.dx = view.tf.dx;
        newTf.dy = view.tf.dy;

        // restore the old values
        view.tf.dx = oldTf.dx;
        view.tf.dy = oldTf.dy;
    },
    redo({view, oldTf, newTf}) {

        // set the new values
        view.tf.dx = newTf.dx;
        view.tf.dy = newTf.dy;
    }
},

zooming: {

    doit({view}){
    },
    undo({}) {
    },
    redo({}) {
    }
}


};

// we call this redox - oxydation / reduction 
const redox = {};
Object.assign(redox, redoxNode, redoxLink, redoxWidget, redoxRoute, redoxBus, redoxPad, redoxSelect, redoxSelectWidgets, redoxView);

// we have to expand multi sources into single names, eg AA.[x,y] => AA.x, AA.y
// for each variant 
function ActualSource(name, pin) {
    this.variant = name,
    this.pin = pin;
    this.actualTargets = [];
}
ActualSource.prototype = {
};

// This object is used to split multi-messages in a single targets
function ActualTarget(name, target) {

    this.variant = name;
    this.target = target;
}
ActualTarget.prototype = {

    toString() {
        if (this.target.is.pin) {
            return `${this.variant} @ ${this.target.node.name} (${this.target.node.uid})` 
        }
        else if (this.target.is.pad) {
            return `${this.variant} @ ${this.target.proxy.node.name} (${this.target.proxy.node.uid})` 
        }
        else if (this.target.is.tack) {
            return `${this.variant} @ ${this.target.bus.name} (${this.target.bus.uid})`
        }
        return '- unknown -'
    }
};

const JSAppHandling = {

    toJavascriptApp(appPath) {

        // check if we have a path name
        if (!appPath) return 

        // save the app path in the document
        if (this.target.application?.userPath !== appPath) {

            // make the app arl
            this.target.application = this.resolve(appPath);
        }

        // notation
        const srcArl = this.target.application;
    
        // the index file to find sources that do not have an explicit factory arl
        const indexArl = this.resolve('index.js');
    
        // the runtime to use for this model
        const runtime = this.model.header.runtime ?? '@vizualmodel/vmblu';
    
        // and save the app 
        const jsSource = this.makeJSApp(this.view.root, srcArl, indexArl, runtime);

        // and save the source
        srcArl.save(jsSource);

        // check if there are mcp compliant tools...
        const mcpToolString = this.model.makeMcpToolString(this.view.root);

        // save the tools
        if (mcpToolString) {

            // get the arl for the mcp spec
            const mcpArl = srcArl.resolve(removeExt(this.model.arl.userPath) + '-mcp.js');

            // save the mcp file
            mcpArl.save(mcpToolString);
        }
    
        // return the src arl and the html arl so that the app can be started (if wanted)
        const htmlArl = this.resolve(changeExt(appPath,'html'));
        // modcom.saveHtmlPage(doc.root, srcArl, htmlArl)
    
        // return the src and html arl
        return {srcArl, htmlArl}
    },

    makeJSApp(node, srcArl, indexArl, runtime) {

        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        const imports = [];

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]});

        // the files and nodes used in this model
        node.collectImports(imports);

        // The header
        const today = new Date();
        let sHeader =      '// ------------------------------------------------------------------'
                        +`\n// Model: ${node.name}`
                        +`\n// Path: ${srcArl.url?.pathname || srcArl.userPath}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------\n';

        // set the imported source/libs
        let sImports = '\n//Imports' + this.JSImportExportString(imports,'\nimport ', srcArl);

        // make the list of source nodes and filters - a recursive function
        const nodeList = [];
        const filterList = [];
        node.makeSourceLists(nodeList, filterList);

        // an array of nodes
        let sNodeList = '//The runtime nodes\nconst nodeList = [';

        // make the init code for the run time nodes & filters
        for(const item of nodeList) sNodeList += this.JSSourceNode(item);

        // close the nodeList
        sNodeList += '\n]';

        // the filter list
        let sFilterList = '//The filters\nconst filterList = [';

        // stringify the filters
        for(const item of filterList) sFilterList += this.JSFilter(item);

        // close
        sFilterList += '\n]';

        // combine all..
        const jsSource = 
`
// import the runtime code
import * as VMBLU from "${runtime}"

${sImports}

${sNodeList}

${sFilterList}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
`;
        return sHeader + jsSource
    },

    // make a string with all imported or exported object factories - line prefix = 'import' or 'export'
    // the imports are made relative to a refpath
    JSImportExportString(imports, linePrefix, refArl) {

        // import all source types & looks that are not part of the libraries
        let importString = '';

        // the string after each import
        const after = ',\n\t\t ';

        // add each imported file
        imports.forEach( imported => {

            // if there are no items skip
            if (imported.items.length < 1) return

            // add a line for every file from which we import
            importString += linePrefix + `{ `;

            // if there are items
            if (imported.items.length > 0) {
                
                // list of comma seperated imported items
                imported.items.forEach( item => { importString += item + after; });

                // remove the last after
                importString = importString.slice(0,-after.length);
            }

            // add the closing curly bracket - resolve the path with respect to the ref arl path
            importString += ` } from '${relative(imported.arl.getFullPath(), refArl.getFullPath())}'`;
        });

        // done
        return importString
    },

    // make a string with all the run time nodes
    JSSourceNode(node) {

        // helper function to print a pin-string
        const pinString = (pin) => {
            const prefix = '\n\t\t';
            const symbol = pin.is.input ? (pin.is.channel ? "=>" : "->") : (pin.is.channel ? "<=" : "<-");
            if (pin.is.multi) {
                let str = '';
                for(const variant of pin.expandMultis()) str += prefix + `"${symbol} ${variant}",`;
                return str
            }
            else return prefix + `"${symbol} ${pin.name}",`;           
        };

        // helper function to print a json string
        const readableJson = (obj,what) => {
            const json =  JSON.stringify(obj,null,4);
            return (json?.length > 0) ? ',\n\t' + what + ':\t' + json.replaceAll('\n','\n\t\t') : ''
        };

        const underscores = '\n\t//____________________________________________________________';

        // a separator between the nodes
        const separator = underscores.slice(0, -node.name.length) + node.name.toUpperCase();

        // every node has name, uid and code - use the alias if present
        let sSource = `${separator}\n\t{\n\tname: "${node.name}", \n\tuid: "${node.uid}", \n\tfactory: ${node.factory.alias ?? node.factory.fName},`;

        // Add the list of input pins
        sSource += '\n\tinputs: [';

        // to assemble the inputs
        let sInputs = '';

        // add all inputs
        for(const rx of node.rxTable) sInputs += pinString(rx.pin);

        // remove the last comma
        if (sInputs.length > 0) sInputs = sInputs.slice(0, -1);

        // add the inputs
        sSource += sInputs.length > 0 ? sInputs + '\n\t\t],' : '],';

        // now handle the output pins
        sSource += '\n\toutputs: [';

        // string for the outputs
        let sOutputs = '';

        // add all the targets for each output of the node
        for(const tx of node.txTable) {

            // make the actual output table for each output - it expands the multi-messages
            const outputTable = this.makeOutputTable(tx);

            // then stringify the output table
            sOutputs += this.stringifyOutputTable(outputTable);
        }

        // remove the last comma
        if (sOutputs.length > 0) sOutputs = sOutputs.slice(0,-1);

        // Add the outputs to the source string
        sSource += sOutputs.length > 0 ? sOutputs + "\n\t\t]" : ']';

        // if there are settings, add the settings to the node
        if (node.sx) sSource += readableJson(node.sx, 'sx');
        if (node.dx) sSource += readableJson(node.dx, 'dx');

        // close and return
        return sSource + '\n\t},'
    },

    makeOutputTable(tx) {

        // The expanded tx table or output table
        const outputTable = [];

        // create an array with all possible source names
        const sourceNames = tx.pin.is.multi ? convert.expandMultis(tx.pin.name) : [tx.pin.name];

        // get for each single source the corresponding targets
        for (const sourceName of sourceNames) {

            // We store the result in an ActualSource record
            const actualSource = new ActualSource(sourceName, tx.pin);

            // for each target 
            for (const target of tx.targets){

                // get the actual target for this source variant
                const actualTarget = this.getActualTarget(tx.pin, sourceName, target);

                // The actual target for a given source variant can be null
                if (actualTarget) actualSource.actualTargets.push(actualTarget);
            }

            // add it to the output table if there is anything in the target table
            outputTable.push(actualSource);
        }

        return outputTable
    },

    stringifyOutputTable(table) {

        // The stringified output table
        let sTable = '';

        for(const actualSource of table) {

            // the prefix for each line
            const prefix = '\n\t\t';

            // the message sending symbol
            const symbol = actualSource.pin.is.channel ? '=>' : '->';

            // no destinations (actually an error....)
            if (actualSource.actualTargets.length == 0) sTable += prefix + `"${actualSource.variant} ${symbol} ()",`;

            // if the dest array has only one element
            else if (actualSource.actualTargets.length == 1) sTable +=  prefix + `"${actualSource.variant} ${symbol} ${actualSource.actualTargets[0].toString()}",` ;

            // multiple destinations - make an array
            else {
                let sTargets = prefix + `\`${actualSource.variant} ${symbol} [ `;

                // add all destinations
                for (const actualTarget of actualSource.actualTargets) sTargets += prefix + '\t' + `"${actualTarget.toString()}",`; 

                //remove the last comma and close the bracket
                sTargets = sTargets.slice(0, -1) + ' ]`,';

                // add to the string
                sTable += sTargets;
            }
        }

        return sTable
    },

    // make a string with all the run time nodes
    JSFilter(bus) {

        const underscores = '\n\t//_____________________________________________________';

        // a separator between the nodes
        const separator = underscores.slice(0, -bus.name.length) + bus.name.toUpperCase() + ' FILTER';

        // every node has name, uid and code - use the alias if present
        let sSource = `${separator}\n\t{\n\tname: "${bus.name}", \n\tuid: "${bus.uid}", \n\tfilter: ${bus.filter.alias ?? bus.filter.fName},`;

        sSource += '\n\ttable: [';

        // make the filtertable
        const filterTable = this.makeFilterTable(bus);

        // print it
        const wSpace = '\n\t\t';
        for(const actualSource of filterTable) {
            sSource += '\n\t\t`' + actualSource.variant + ' : [';

            // write the rest to scope
            let sScope = '';
            for (const target of actualSource.actualTargets) sScope += wSpace + '\t"' + target.toString() + '",';

            // remove last comma
            sSource += sScope.slice(0,-1) + ' ]`,'; 
        }

        // close and return
        return sSource + ']\n\t},'
    },

    // make the filter table
    makeFilterTable(bus) {

        const filterTable = [];

        // first make the tack/tack connection table
        for(const rx of bus.rxTable) {

            // get the pin
            const pin = rx.tack.getOtherPin();

            // for each actual source
            const rxNames = pin.is.multi ? convert.expandMultis(pin.name) : [pin.name];

            // for each name
            for (const rxName of rxNames) {

                // maybe we have an entry for the rx name already - if so we do not have to handle it again (gives same result !)
                if (filterTable.find( actualSource => actualSource.variant == rxName)) continue

                // get a new source entry
                const actualSource = new ActualSource(rxName, null);

                // get the tx tacks that are connected to this tack
                for(const tx of bus.txTable) {

                    // check for a match between rx and tx 
                    if (!tx.connectsTo(rxName)) continue

                    // go through every message in the fanout
                    for (const target of tx.fanout) {

                        // get the actual target for this source variant
                        const actualTarget = this.getActualTarget(pin, rxName, target);

                        // The actual target for a given source variant can be null
                        if (actualTarget) actualSource.actualTargets.push(actualTarget);                        
                    }
                }

                // add it to the filtertable
                if (actualSource.actualTargets.length > 0) filterTable.push(actualSource);
            }
        }
        // done
        return filterTable
    },

    // make a table with the actual targets for this source message
    // If the target is a multi-message we have to decide which one is the actual target
    getActualTarget(source, sourceName, target) {

        if (target.is.pin) {

            if (target.is.multi) {

                // get the target variant that corresponds with the source name
                const targetName = target.getMatch(sourceName);

                // check
                return targetName ? new ActualTarget(targetName, target) : null
            }
            else if (source.is.multi) {

                // get the source variant that corresponds with the target name
                const sourceVariant = source.getMatch(target.name);

                // check - it should be the same as the sourceName
                return (sourceVariant == sourceName) ? new ActualTarget(target.name, target) : null
            }
            else {
                // simple connection - names do not matter
                return new ActualTarget(target.name, target)
            }
        }
        else if (target.is.tack) {

            // get the corresponding pin or proxy
            const pin = target.getOtherPin();

            // check if multi
            if (pin.is.multi) {

                // check if there is a match with the source
                const targetName = pin.getMatch(sourceName);
                return targetName ? new ActualTarget(targetName, target) : null
            }
            else if (source.is.multi) {

                // get the source variant that corresponds with the target name
                const sourceVariant = source.getMatch(pin.name);

                // check - it should be the same as the sourceName
                return (sourceVariant == sourceName) ? new ActualTarget(pin.name, target) : null
            }
            else {
                // simple connection - names do not matter (or have been checked before eg on a cable bus)
                return new ActualTarget(pin.name, target)
            }
        }
    },

    // save the html page that can be loaded as an application
    saveHtmlPage(node, srcArl, htmlArl) {

        // set the app path
        const appPath = srcArl.url.pathname;

        // we also make a css path
        const cssPath = changeExt(appPath, 'css');

        // the page content
        const htmlPage = 

`<!doctype html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width'>
    <title>${node.name}</title>
    <link rel='icon' type='image/png' href='/page/shared/favicon.ico'>
    <link rel='stylesheet' href='${cssPath}'> 
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <script type='module' src='${appPath}'></script>
</head>
<body style="overflow:hidden;"></body>
</html>`;

        // save the html page
        htmlArl.save(htmlPage);
    },

    // **************************** DOES NOT WORK !! cross scripting !!
    NOT_OK_makeAppScript(root, indexArl) {
        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        let imports = [];

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]});

        // the files and nodes used in this model
        root.collectImports(imports);

        // make the app launch page also
        return this.makeAppPage(root, imports)
    }
};

const JSLibHandling = {

    toJavascriptLib(libPath) {

        // check if we have a path name
        if (!libPath) return 
        
        // save the app path in the document
        if (this.target.library?.userPath !== libPath) {

            // make the app arl
            this.target.library = this.resolve(libPath);
        }

        // notation
        const libArl = this.target.library;

        // the index file to find sources that do not have an explicit factory arl
        const indexArl = this.resolve('index.js');
        
        // save the build lib file
        const lib = this.makeJSLib(this.view.root, this.model.arl, libArl, indexArl);

        // save the lib
        libArl.save(lib);
    },

    // save the file that can be used to build the lib
    makeJSLib(node, modelArl, libArl, indexArl) {

        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        let imports = [];

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]});

        // the files and nodes used in this model
        node.collectImports(imports);

        // make a javascript compliant name
        const jsRootName = convert.nodeToFactory(nameOnly(libArl.userPath));

        // The header
        const today = new Date();
        const sHeader =    '// ------------------------------------------------------------------'
                        +`\n// Lib: ${jsRootName}`
                        +`\n// Model File: ${modelArl.userPath}`
                        +`\n// Lib   File: ${libArl.userPath}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------';

        // export the imported source types & looks that are not part of the libraries
        const sImports = '\n\n//Export' + this.JSImportExportString(imports,'\nexport ', libArl); 

        // derive the name for finding the 
        const modelFile = './' + fileName(modelArl.userPath);

        // import/export the model that was saved - MAIN PATH IS WRONG
        const sModel =   `\n\n// The model\nimport ${jsRootName} from '${modelFile}'`+`\nexport {${jsRootName}}`;

        // combine all parts
        return sHeader + sImports + sModel
    },
};

const importExportHandling = {

// the link for a node has changed
async importFromModel(node, lName, userPath) {

    // If no name is given jus give up
    if ((lName.length == 0)||(userPath.length == 0)) return

    // make an arl
    const arl = this.model.arl.resolve(userPath);

    // find or add the model
    const model = await this.modcom.findOrAddModel(arl);

    // good or bad - set the changed name/path
    node.setLink(model, lName);

    // check
    if (!model) {

        // error message
        console.log(`importFromModel failed. Model not found - check the file (${userPath}) of the node to link to`);

        // done
        return
    }

    // find and build the node
    const newNode = this.modcom.compileNode(model, lName);

    // check
    if (!newNode) {

        // error message
        console.log(`importFromModel failed. Could not compile '${lName}' from file '${userPath}' (check if there is such a node in the model)`);

        // set the link as bad
        node.linkIsBad();
        
        // done
        return
    }
    // explicitely reset the link as good
    else node.linkIsGood();

    // maybe we have to change the type of node..
    if (!node.compatible(newNode)) {

        // change the node into a group or source + transfer all the routes
        const otherType = node.switchNodeType();
        
        // replace the node by the other type node
        this.view.root.swap(node, otherType);

        // change
        node = otherType;
    }

    // fuse the existing node with the new one - showing new and zombie pins...
    node.fuse(newNode);
},

// encodes a node 
encode(node, model) {
    
    if (!node) return null

    // get the factories
    node.collectFactories(this.factories);

    // get the imports
    node.collectModels(this.models);

    // the object to encode
    const target = {
        header: model.header,
    };

    // add the libraries if any
    if (this.models?.size() > 0) target.imports = this.models;
    if (this.factories?.size() > 0) target.factories = this.factories;
    if (model.libraries?.size() > 0) target.libraries = model.libraries;

    // set the root
    target.root = node;

    // stringify the target
    const text =  JSON.stringify(target,null,4);

    // return the result
    return text
},


// export a node to a model and set the link in the node
async exportToModel(node, lName, model) {

	// if the node is a link nothing to do 
	if (node.link) return

	// get a model compiler
	const modcom = new ModelCompiler( this.UID );

	// make a copy of the node - keep the uids
	const newNode = node.copy();

	// change the name of the node
	newNode.name = lName;

	// change references where necessary
	if (newNode.nodes) for (const sub of newNode.nodes) sub.adjustUserPaths( model.arl  );

	// assemble the models and the factories
    newNode.collectFactories(modcom.factories);
    newNode.collectModels(modcom.models);

	// the object to convert and save
	const target = {
		header: model.header,
//		models: modcom.models,
//		factories: modcom.factories,
//		root: newNode
	};

    // add the libraries if any
    if (modcom.models?.size() > 0) target.imports = modcom.models;
    if (modcom.factories?.size() > 0) target.factories = modcom.factories;
//    if (model.libraries?.size() > 0) target.libraries = model.libraries

    // add the root
    target.root = newNode;

	// stringify the target
	const json =  JSON.stringify(target,null,4);

	// save the json
	await this.model.arl.save( json );

	// set the link
	node.setLink(model, lName);

	// if the node has a view, close it
	if (node.is.group && node.savedView) node.savedView.closeView();
},

// nodes from a library are added as links - nodepath = group | group | node 
async nodeFromLibrary(libModel, lName) {

    // If no name is given jus give up
    if ((lName.length == 0)||(!libModel)) return null

    // find or add the model in the compiler
    const model = await this.modcom.findOrAddModel(libModel.arl);

    // check
    if (!model) return null

    // find and build the node
    const newNode = this.modcom.compileNode(model, lName);

    // check
    if (!newNode) return null

    // good or bad - set the changed name/path
    newNode.setLink(model, lName);

    //done
    return newNode
},

makeLocalLink(node, lName) {

    // If no name is given
    if (lName.length == 0) return

    // find the local node
    const local = this.view.root.findNode(lName);

    // check
    if (!local) {

        // set the changed name/path
        node.setLink(null, lName);

        // error message
        console.log(`Local link failed. Check the name (${lName}) of the node to link to`);

        // set the link as bad
        node.linkIsBad();
        
        // done
        return
    }

    // make a copy of the local node
    const newNode = local.copy();

    // give the new node a new UID
    newNode.uidChangeAll(this.UID);

    // set the link
    node.setLink(this.model, lName);

    // mark the link as ok
    node.linkIsGood();
    
    // maybe we have to change the type of node..
    if (!node.compatible(newNode)) {

        // change the node into a group or source + transfer all the routes
        const otherType = node.switchNodeType();

        // replace the node by the other type node
        this.view.root.swap(node, otherType);

        // change
        node = otherType;
    }

    // fuse the existing node with the new one - showing new and zombie pins...
    node.fuse(newNode);
},


};

function UIDGenerator() {

    // the uid map 
    this.uidmap = new Map();

    // the initial length for the uid
    this.uidLength = 4;
}
UIDGenerator.prototype = {

    reset() {

        this.uidmap.clear();
    },

    // get a fresh uid
    _freshUID() {

        let count = 0;

        // try at most 5 times with 4 chars
        while(count < 10) {

            //make a uid of 4 characters
            let uid = rndAlfa(this.uidLength);
            if (! this.uidmap.has(uid)) return uid

            // duplicate in the map
            count++;
            console.log('*** THERE WAS A DUPLICATE *** (can happen, nothing to worry about)');

            // after 5 times we increase the length of the uid
            if (count > 4) this.uidLength++;
        }
        console.eror('*** FAILED TO MAKE A UNIQUE UID ***');

        // return some value
        return '????'
    },

    // // set the uid of the object + add the uid and the object to the uidmap
    // UID(what) {

    //     // if there is no uid or the uid is already in the map - get a new uid
    //     what.uid = this._freshUID()
        
    //     // add the object and uid to the map
    //     this.uidmap.set(what.uid, what)
    // },
    
    // set the uid of the object + add the uid and the object to the uidmap
    generate(what) {

        // if there is no uid or the uid is already in the map - get a new uid
        what.uid = this._freshUID();
        
        // add the object and uid to the map
        this.uidmap.set(what.uid, what);
    },
};

// The document is the main item handled by the editor

function Document(arl=null) {

    // The outer view for this document (contains all the views)
    this.view = new View({x:0,y:0,h:0,w:0});

    // The active view (is one of the views in the view or the view itself)
    this.focus = this.view;

    // The model
    this.model = arl ? new ModelBlueprint(arl) : null;

    // this is main model
    this.model.is.main = true;

    // The UID generator
    this.UID = new UIDGenerator();

    // we will need a modelcompiler - also pass the UID generator to the compiler
    this.modcom = new ModelCompiler( this.UID );

    // we use a different compiler for saving the model - it gets reset every time...
    this.savecom = new ModelCompiler( this.UID );

    // The arls set by the user for library/application
    this.target = {
        application: null,
        library: null
    };

    // the undo stack of size ..31 is just a nr !
    this.undoStack = new RingStack(31);
}
Document.prototype = {

    resolve(path) {
        return this.model?.arl?.resolve(path)
    },

    // loads a document 
    async load() {

        //check
        if (! this.model ) return 
        
        // reset the model compiler
        this.modcom.reset();

        // reset the uid generator
        this.UID.reset();
        
        // get the root node in the file - if 'raw' for the model exists, it is used !
        const newRoot = await this.modcom.getRoot(this.model);

        // check
        if (newRoot) {
            // set as root in the main view
            this.view.syncRoot(newRoot);            
        }
        else {
            this.view.initRoot(nameOnly(this.model.arl.userPath));
            console.warn(`Empty root for ${this.model.arl.userPath} -  ok for empty file`);
        }

        // load the library files for the document - but don't wait for it....
        this.model.libraries?.load();
    },

    // reparse the raw model (no loading required) -> used in getSavePoint
    reCompile() {

        this.UID.reset();

        const newRoot = this.modcom.compileNode(this.model,null);

        // check
        if (newRoot) {
            // set as root in the main view
            this.view.syncRoot(newRoot);            
        }
        else {
            this.view.initRoot(nameOnly(this.model.arl.userPath));
            console.warn(`Empty root for ${this.model.arl.userPath} -  ok for empty file`);
        }
    },

    async save() {

        // check
        if (! this.model) return null

        // reset the save compiler
        this.savecom.reset();

        // Get the actual node to save (mostly the root...)
        const toSave = this.getNodeToSave();

        // check
        if (!toSave) return

        // encode the root node as a text string
        const text = this.savecom.encode(toSave, this.model);

        // also make the raw json structure up to date
        this.model.raw = JSON.parse(text);

        // reset the dirty flag
        this.model.is.dirty = false;
        
        // save the stringified text
        return this.model.arl.save( text )
    },

    async saveAs(path) {

        // if there is no extension, add  it
        if (!hasExt(path)) path += '.vmblu';

        if (isAbsolutePath(path)) {

            const userPath = relative(path, this.model.arl.url);
            
            console.log(`${userPath} ${path} ${this.model.arl.url}`);

            // save to the new location
            this.model.arl.url = path;
            this.model.arl.userPath = userPath;
        }
        else {
            // get a new arl
            const newArl = this.model.arl.resolve(path);

            //check
            if (!newArl) {
                console.log(`Invalid path: "${path}" in Document.saveAs`);
                return null
            }

            // set the new arl
            this.model.arl = newArl;
        }

        return this.save()
    },

    // for each node that is a link, update the node
    async update() {

        // check
        if (! this.model || ! this.view?.root) return

        // check if the main model needs to be synced
        if (this.model.is.dirty) {

            // sync the model
            this.model.raw = JSON.parse(this.modcom.encode(this.view.root, this.model));
            
            // also set the fresh flag
            this.model.is.fresh = true;
        }

        // check for any changes in the models
        await this.modcom.updateFactoriesAndModels();

        // update the nodes in the model for which the model has changed
        this.modcom.updateNode(this.view.root);

        // reset the fresh flag
        this.modcom.resetFresh();
    },

    // get the node that needs to be saved
    getNodeToSave() {

        // notation
        const root = this.view.root;

        // check
        if ( !root || root.is.source) return null

        // if there is only one real node we save that node
        const toSave = ( root.isContainer() && (root.nodes.length == 1)) ? root.nodes[0] : root;

        // save the view - but at the toplevel only the tf is used
        if (toSave == root) toSave.savedView = this.view;

        // done
        return toSave
    }
};
Object.assign(Document.prototype, JSAppHandling, JSLibHandling, importExportHandling);

/* eslint-disable no-undef */
/* eslint-disable semi */


// defined in document-model.js
const LOGVSCODE = 0x1;		// log messages to/from vscode

const messageBrokerVscode = {

	/** @node message broker */
	
    async onMessage(event) {

		// The json data that the extension sent
		const message = event.data; 

		// Log the message sent by vscode
		if (this.documentFlags & LOGVSCODE) console.log(`    vscodex ~~~> [broker]    [${message.verb}]`);

		switch (message.verb) {	

			// a document has been opened by the user: the 'new' document can be an existing document or still have to be created
			case 'open main': {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri);

				// create the new document
				this.activeDoc = new Document(arl);

				// check if the document has to be created
				this.activeDoc.load()
				.then( () => {

					// set as the active document
					this.tx.send('set document', this.activeDoc);

					// write to the output file (= same name as model file but with -doc added before extension)
					const outFilename = nameOnly(arl.userPath) + '-doc.json';

					// Make the output file name
					const outFile = arl.resolve(outFilename);

					// also request to run run documentation.js on the factory files...
					vscode.postMessage({verb:'watch source doc', model: arl, outFile});
				})
				.catch( error => {

					// show a popup message
					console.error(`*** Could not open main document ${message.uri} ${error}`);            
				});

				// done
				return;
			}

			// a document has been opened by the user: the 'new' document can be an existing document or still have to be created
			case 'xxxopen main': {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri);

				// create the new document
				this.activeDoc = new Document(arl);

				// check if the document has to be created
				this.activeDoc.load()
				.then( () => {

					// set as the active document
					this.tx.send('set document', this.activeDoc);

					// get the factories of the model into an array
					const factories = [];
					for (const factory of this.activeDoc.modcom.factories.map.values()) factories.push(factory.arl);

					// write to the output file (= same name as model file but with -doc added before extension)
					const outFilename = nameOnly(arl.userPath) + '-doc.json';

					// Make the output file name
					const outFile = arl.resolve(outFilename);

					// also request to run run documentation.js on the factory files...
					vscode.postMessage({verb:'watch source doc', factories, outFile});
				})
				.catch( error => {

					// show a popup message
					console.error(`*** Could not open main document ${message.uri} ${error}`);            
				});

				// done
				return;
			}


			case 'new main' : {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri);

				// create the new document
				this.activeDoc = new Document(arl);

				// init the root for this new document
				this.activeDoc.view.initRoot(nameOnly(arl.userPath));		
				
				// save the new document
				this.activeDoc.save()
				.then( () => {

					// set as the active document
					this.tx.send('set document', this.activeDoc);
				})
				.catch( error => {
					// show a popup message
					console.error(`*** Could not create main document ${message.uri} ${error}`);            
				});

				return;
			}

			// a file needs to be saved - if no uri is given, the current file is used
			case 'save request' : {

				// The uri that is passed is a complete uri
				if (message.uri) {
					// save the document under a different name
					await this.activeDoc.saveAs(message.uri);
				}
				else {
					// save the active document
					await this.activeDoc.save();
				}

				// vscode could be waiting for the save !
				vscode.postMessage({verb:'file saved'});

				// done
				return
			}

			// the document became visible - do a sync
			case 'visible' : {

				this.tx.send('sync model');
				return
			}

			case 'source doc' : {
				this.activeDoc.model.sourceMap = this.activeDoc.model.parseSourceDoc(message.rawSourceDoc); 
				return
			}

			// vscode informs all editors about a clipboard switch
			case 'clipboard switched' : {

				// send a message to the editor to inform the editor
				this.tx.send('clipboard switched');
				return
			}

			// vscode requests the clipboard from the editor connected to this message broker
			case 'clipboard local' : {

				// request the internal clipboard
				this.tx.request('clipboard local', this.activeDoc)
				.then(({json}) => {

					// and transfer the json to vscode
					vscode.postMessage({verb:'clipboard local', json});
				})
				.catch( error => console.log('message broker timeout on clipboard.local'));
				return;
			}

			// vscode returns the clipboard content in json to the editor that requested it
			case 'clipboard remote' : {

				this.tx.reply({json: message.json});
				return
			}

			// succesful execution of a fake HTTP request....
			case '200' : {
				// find the resolve in the promiseMap
				const resolve = promiseMap.get(message.rqKey);

				// check
				if (!resolve) return;

				// and call the resolve code
				resolve(message.content);

				// remove the resolve from the map
				promiseMap.delete(message.rqKey);

				// done
				return
			}

			// execution of a fake HTTP request failed....
			case '404' : {

				// TO CORRECT
				// find the reject  in the promiseMap  -- *** we have to make a reject map as well *** !!!
				// const reject = promiseMap.get(message.rqKey)

				// find the resolve in the promiseMap
				const resolve = promiseMap.get(message.rqKey);

				// check
				if (!resolve) return;

				// and call the resolve code
				resolve(message.content);

				// remove the resolve from the map
				promiseMap.delete(message.rqKey);

				// done
				return
			}

			case 'documentFlags' : {

				// the debug settings frm the document
				this.documentFlags = message.flags;
				return
			}

			default: 

				// show an error message
				console.log(`Message broker: "${message.verb}" is an unknown message`);
				break
		}
    }
};

/* eslint-disable no-undef */
/* eslint-disable semi */


const messageBrokerWebview = {

	/** @node message broker */

	// request vscode to open a new nodemesh document
	"-> open document"(arl) {

		// send a message to the vscode side
		vscode.postMessage({verb:'open document', arl});
	},

    // the canvas div that has to be added 
    "-> canvas"(canvas) {

		// set the theme
		document.documentElement.className = "dark" + " common";

        // note that the context of a canvas gets reset when the size changes !
		canvas.width = window.visualViewport.width;
		canvas.height = window.visualViewport.height;

        // add the canvas to the main window
        document.body.append(canvas);

		// and focus the canvas
		canvas.focus();

		// Listen for the 'resize' event and send a resize request when that happens
		let resizeTimeout;
		window.visualViewport.addEventListener('resize', () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.tx.send("canvas resize", {x:0, y:0, w:window.visualViewport.width, h:window.visualViewport.height});
			}, 100);
			//this.tx.send("canvas resize", {x:0, y:0, w:window.visualViewport.width, h:window.visualViewport.height})
		});
    },

	"-> modal div"(modalDiv) {

		// add the div to the document body
		document.body.append(modalDiv);
	},

	"-> floating menu"(menuDiv) {

		// add the floating menu to the document body
		document.body.append(menuDiv);
	},

	// the editor signals that it is now the owner of the active clipboard
	"-> clipboard switch"() {
	
		// intercept the clipboard message
		vscode.postMessage({verb: 'clipboard switch'});
	},

	// the editor has sends the content of its clipboard
	"-> clipboard local"({json}) {
		// request the vscod extension to forward the internal clipboard
		vscode.postMessage({verb: 'clipboard local', json});
	},

	// The editor requests the content of the external clipboard
	"-> clipboard remote"() {

		// request the external clipboard
		vscode.postMessage({verb: 'clipboard remote'});
	},

	"-> new edit"(edit) {

		// signal vscode about the edit
		vscode.postMessage({verb: 'report edit', edit: edit?.verb ?? 'unspecified'});
	},

	"-> open js file"({arl, line}) {

		console.log('OPEN SOURCE ', arl);

		vscode.postMessage({verb:'open source', arl, line});
	},
};

/* eslint-disable no-undef */
/* eslint-disable semi */
// ------------------------------------------------------------------
// Source node: MessageBroker
// Creation date 9/23/2023, 10:16:36 AM
// ------------------------------------------------------------------



//Constructor for message broker
function MessageBroker(tx, sx) {

    // save the transmitter and the settings
    this.tx = tx;
    this.sx = sx;

	// There can only be one active doc per editor !
	this.activeDoc = null;

	// the document flags set by the vscode document
	this.documentFlags = 0x0;

	// adapt the console.log function !
	adaptConsole();

	// change the behaviour of arl/HTTP to get files from the local machine
	adaptARL();

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => this.onMessage(event));

	// make sure to intercept dangerous keys from the webview
	window.addEventListener('keydown', event => this.interceptKeys(event));

	// send a message to the webview that the application is ready
	vscode.postMessage({verb:'ready'});
}
MessageBroker.prototype = {

	// This is to avoid propagating unwanted keys to vscode
	interceptKeys(event) {

		// These are the potentially dangerous keys...
		if (['Delete', 'Enter', 'Escape'].includes(event.key)) {
			event.preventDefault();  // Stop default browser behavior
			event.stopPropagation(); // Stop bubbling this event up to VSCode
		}
	},

	// resolves a uri string to an arl
	makeArl(uri) {
		
		// get the filename from the uri
		let lastSlash = uri.lastIndexOf('/');

		// make a userPath from the uri - take the last name
		const userPath = (lastSlash < 0) ? uri : uri.slice(lastSlash+1);

		// make an arl
		const arl = new ARL(userPath);

		// set the url for the document
		arl.url = uri;

		// done
		return arl
	},
};
Object.assign(  MessageBroker.prototype, messageBrokerWebview, messageBrokerVscode);

/** @returns {void} */
function noop() {}

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return /** @type {T & S} */ (tar);
}

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
	fns.forEach(run);
}

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
	return typeof thing === 'function';
}

/** @returns {boolean} */
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}

/** @returns {boolean} */
function is_empty(obj) {
	return Object.keys(obj).length === 0;
}

function subscribe(store, ...callbacks) {
	if (store == null) {
		for (const callback of callbacks) {
			callback(undefined);
		}
		return noop;
	}
	const unsub = store.subscribe(...callbacks);
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

/** @returns {void} */
function component_subscribe(component, store, callback) {
	component.$$.on_destroy.push(subscribe(store, callback));
}

function create_slot(definition, ctx, $$scope, fn) {
	if (definition) {
		const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
		return definition[0](slot_ctx);
	}
}

function get_slot_context(definition, ctx, $$scope, fn) {
	return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
}

function get_slot_changes(definition, $$scope, dirty, fn) {
	if (definition[2] && fn) {
		const lets = definition[2](fn(dirty));
		if ($$scope.dirty === undefined) {
			return lets;
		}
		if (typeof lets === 'object') {
			const merged = [];
			const len = Math.max($$scope.dirty.length, lets.length);
			for (let i = 0; i < len; i += 1) {
				merged[i] = $$scope.dirty[i] | lets[i];
			}
			return merged;
		}
		return $$scope.dirty | lets;
	}
	return $$scope.dirty;
}

/** @returns {void} */
function update_slot_base(
	slot,
	slot_definition,
	ctx,
	$$scope,
	slot_changes,
	get_slot_context_fn
) {
	if (slot_changes) {
		const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
		slot.p(slot_context, slot_changes);
	}
}

/** @returns {any[] | -1} */
function get_all_dirty_from_scope($$scope) {
	if ($$scope.ctx.length > 32) {
		const dirty = [];
		const length = $$scope.ctx.length / 32;
		for (let i = 0; i < length; i++) {
			dirty[i] = -1;
		}
		return dirty;
	}
	return -1;
}

function null_to_empty(value) {
	return value == null ? '' : value;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @returns {void}
 */
function append(target, node) {
	target.appendChild(node);
}

/**
 * @param {Node} target
 * @param {Node} node
 * @param {Node} [anchor]
 * @returns {void}
 */
function insert(target, node, anchor) {
	target.insertBefore(node, anchor || null);
}

/**
 * @param {Node} node
 * @returns {void}
 */
function detach(node) {
	if (node.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/**
 * @returns {void} */
function destroy_each(iterations, detaching) {
	for (let i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detaching);
	}
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} name
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(name) {
	return document.createElement(name);
}

/**
 * @param {string} data
 * @returns {Text}
 */
function text(data) {
	return document.createTextNode(data);
}

/**
 * @returns {Text} */
function space() {
	return text(' ');
}

/**
 * @returns {Text} */
function empty() {
	return text('');
}

/**
 * @param {EventTarget} node
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @returns {() => void}
 */
function listen(node, event, handler, options) {
	node.addEventListener(event, handler, options);
	return () => node.removeEventListener(event, handler, options);
}

/**
 * @param {Element} node
 * @param {string} attribute
 * @param {string} [value]
 * @returns {void}
 */
function attr(node, attribute, value) {
	if (value == null) node.removeAttribute(attribute);
	else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
	return Array.from(element.childNodes);
}

/**
 * @param {Text} text
 * @param {unknown} data
 * @returns {void}
 */
function set_data(text, data) {
	data = '' + data;
	if (text.data === data) return;
	text.data = /** @type {string} */ (data);
}

/**
 * @returns {void} */
function set_input_value(input, value) {
	input.value = value == null ? '' : value;
}

/**
 * @returns {void} */
function set_style(node, key, value, important) {
	if (value == null) {
		node.style.removeProperty(key);
	} else {
		node.style.setProperty(key, value, '');
	}
}

/**
 * @typedef {Node & {
 * 	claim_order?: number;
 * 	hydrate_init?: true;
 * 	actual_end_child?: NodeEx;
 * 	childNodes: NodeListOf<NodeEx>;
 * }} NodeEx
 */

/** @typedef {ChildNode & NodeEx} ChildNodeEx */

/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

/**
 * @typedef {ChildNodeEx[] & {
 * 	claim_info?: {
 * 		last_index: number;
 * 		total_claimed: number;
 * 	};
 * }} ChildNodeArray
 */

let current_component;

/** @returns {void} */
function set_current_component(component) {
	current_component = component;
}

function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs/svelte#onmount
 * @template T
 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];

let render_callbacks = [];

const flush_callbacks = [];

const resolved_promise = /* @__PURE__ */ Promise.resolve();

let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

/** @returns {void} */
function add_render_callback(fn) {
	render_callbacks.push(fn);
}

/** @returns {void} */
function add_flush_callback(fn) {
	flush_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();

let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	const saved_component = current_component;
	do {
		// first, call beforeUpdate functions
		// and update components
		try {
			while (flushidx < dirty_components.length) {
				const component = dirty_components[flushidx];
				flushidx++;
				set_current_component(component);
				update(component.$$);
			}
		} catch (e) {
			// reset dirty state to not end up in a deadlocked state and then rethrow
			dirty_components.length = 0;
			flushidx = 0;
			throw e;
		}
		set_current_component(null);
		dirty_components.length = 0;
		flushidx = 0;
		while (binding_callbacks.length) binding_callbacks.pop()();
		// then, once components are updated, call
		// afterUpdate functions. This may cause
		// subsequent updates...
		for (let i = 0; i < render_callbacks.length; i += 1) {
			const callback = render_callbacks[i];
			if (!seen_callbacks.has(callback)) {
				// ...so guard against infinite loops
				seen_callbacks.add(callback);
				callback();
			}
		}
		render_callbacks.length = 0;
	} while (dirty_components.length);
	while (flush_callbacks.length) {
		flush_callbacks.pop()();
	}
	update_scheduled = false;
	seen_callbacks.clear();
	set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
	if ($$.fragment !== null) {
		$$.update();
		run_all($$.before_update);
		const dirty = $$.dirty;
		$$.dirty = [-1];
		$$.fragment && $$.fragment.p($$.ctx, dirty);
		$$.after_update.forEach(add_render_callback);
	}
}

/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 * @param {Function[]} fns
 * @returns {void}
 */
function flush_render_callbacks(fns) {
	const filtered = [];
	const targets = [];
	render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
	targets.forEach((c) => c());
	render_callbacks = filtered;
}

const outroing = new Set();

/**
 * @type {Outro}
 */
let outros;

/**
 * @returns {void} */
function group_outros() {
	outros = {
		r: 0,
		c: [],
		p: outros // parent group
	};
}

/**
 * @returns {void} */
function check_outros() {
	if (!outros.r) {
		run_all(outros.c);
	}
	outros = outros.p;
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} [local]
 * @returns {void}
 */
function transition_in(block, local) {
	if (block && block.i) {
		outroing.delete(block);
		block.i(local);
	}
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} local
 * @param {0 | 1} [detach]
 * @param {() => void} [callback]
 * @returns {void}
 */
function transition_out(block, local, detach, callback) {
	if (block && block.o) {
		if (outroing.has(block)) return;
		outroing.add(block);
		outros.c.push(() => {
			outroing.delete(block);
			if (callback) {
				if (detach) block.d(1);
				callback();
			}
		});
		block.o(local);
	} else if (callback) {
		callback();
	}
}

/** @typedef {1} INTRO */
/** @typedef {0} OUTRO */
/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

/**
 * @typedef {Object} Outro
 * @property {number} r
 * @property {Function[]} c
 * @property {Object} p
 */

/**
 * @typedef {Object} PendingProgram
 * @property {number} start
 * @property {INTRO|OUTRO} b
 * @property {Outro} [group]
 */

/**
 * @typedef {Object} Program
 * @property {number} a
 * @property {INTRO|OUTRO} b
 * @property {1|-1} d
 * @property {number} duration
 * @property {number} start
 * @property {number} end
 * @property {Outro} [group]
 */

// general each functions:

function ensure_array_like(array_like_or_iterator) {
	return array_like_or_iterator?.length !== undefined
		? array_like_or_iterator
		: Array.from(array_like_or_iterator);
}

/** @returns {void} */
function bind(component, name, callback) {
	const index = component.$$.props[name];
	if (index !== undefined) {
		component.$$.bound[index] = callback;
		callback(component.$$.ctx[index]);
	}
}

/** @returns {void} */
function create_component(block) {
	block && block.c();
}

/** @returns {void} */
function mount_component(component, target, anchor) {
	const { fragment, after_update } = component.$$;
	fragment && fragment.m(target, anchor);
	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
		// if the component was destroyed immediately
		// it will update the `$$.on_destroy` reference to `null`.
		// the destructured on_destroy may still reference to the old array
		if (component.$$.on_destroy) {
			component.$$.on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});
	after_update.forEach(add_render_callback);
}

/** @returns {void} */
function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		flush_render_callbacks($$.after_update);
		run_all($$.on_destroy);
		$$.fragment && $$.fragment.d(detaching);
		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

/** @returns {void} */
function make_dirty(component, i) {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
}

// TODO: Document the other params
/**
 * @param {SvelteComponent} component
 * @param {import('./public.js').ComponentConstructorOptions} options
 *
 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
 * This will be the `add_css` function from the compiled component.
 *
 * @returns {void}
 */
function init(
	component,
	options,
	instance,
	create_fragment,
	not_equal,
	props,
	append_styles = null,
	dirty = [-1]
) {
	const parent_component = current_component;
	set_current_component(component);
	/** @type {import('./private.js').T$$} */
	const $$ = (component.$$ = {
		fragment: null,
		ctx: [],
		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),
		// lifecycle
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false,
		root: options.target || parent_component.$$.root
	});
	append_styles && append_styles($$.root);
	let ready = false;
	$$.ctx = instance
		? instance(component, options.props || {}, (i, ret, ...rest) => {
				const value = rest.length ? rest[0] : ret;
				if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
					if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
					if (ready) make_dirty(component, i);
				}
				return ret;
		  })
		: [];
	$$.update();
	ready = true;
	run_all($$.before_update);
	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
	if (options.target) {
		if (options.hydrate) {
			// TODO: what is the correct type here?
			// @ts-expect-error
			const nodes = children(options.target);
			$$.fragment && $$.fragment.l(nodes);
			nodes.forEach(detach);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment.c();
		}
		if (options.intro) transition_in(component.$$.fragment);
		mount_component(component, options.target, options.anchor);
		flush();
	}
	set_current_component(parent_component);
}

/**
 * Base class for Svelte components. Used when dev=false.
 *
 * @template {Record<string, any>} [Props=any]
 * @template {Record<string, any>} [Events=any]
 */
class SvelteComponent {
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$ = undefined;
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$set = undefined;

	/** @returns {void} */
	$destroy() {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	/**
	 * @template {Extract<keyof Events, string>} K
	 * @param {K} type
	 * @param {((e: Events[K]) => void) | null | undefined} callback
	 * @returns {() => void}
	 */
	$on(type, callback) {
		if (!is_function(callback)) {
			return noop;
		}
		const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
		callbacks.push(callback);
		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	/**
	 * @param {Partial<Props>} props
	 * @returns {void}
	 */
	$set(props) {
		if (this.$$set && !is_empty(props)) {
			this.$$.skip_bound = true;
			this.$$set(props);
			this.$$.skip_bound = false;
		}
	}
}

/**
 * @typedef {Object} CustomElementPropDefinition
 * @property {string} [attribute]
 * @property {boolean} [reflect]
 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
 */

// generated during release, do not modify

const PUBLIC_VERSION = '4';

if (typeof window !== 'undefined')
	// @ts-ignore
	(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

/* menus-tabs-widgets\vscode-side-menu.svelte generated by Svelte v4.2.19 */

function get_each_context$4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	child_ctx[9] = i;
	return child_ctx;
}

// (90:4) {#each symbols as symbol, index}
function create_each_block$4(ctx) {
	let div1;
	let i;
	let t0_value = /*symbol*/ ctx[7].icon + "";
	let t0;
	let t1;
	let div0;
	let t2_value = /*symbol*/ ctx[7].help + "";
	let t2;
	let t3;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			t2 = text(t2_value);
			t3 = space();
			attr(i, "class", "material-icons-outlined icon svelte-13h6ctb");
			set_style(i, "color", /*symbol*/ ctx[7].color);
			attr(i, "data-index", /*index*/ ctx[9]);
			attr(div0, "class", "tooltip svelte-13h6ctb");
			set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			attr(div1, "class", "menu-item svelte-13h6ctb");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, i);
			append(i, t0);
			append(div1, t1);
			append(div1, div0);
			append(div0, t2);
			append(div1, t3);

			if (!mounted) {
				dispose = [listen(i, "click", /*menuClick*/ ctx[2]), listen(i, "keydown", keydown)];
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*symbols*/ 2 && t0_value !== (t0_value = /*symbol*/ ctx[7].icon + "")) set_data(t0, t0_value);

			if (dirty & /*symbols*/ 2) {
				set_style(i, "color", /*symbol*/ ctx[7].color);
			}

			if (dirty & /*symbols*/ 2 && t2_value !== (t2_value = /*symbol*/ ctx[7].help + "")) set_data(t2, t2_value);

			if (dirty & /*symbols*/ 2) {
				set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$n(ctx) {
	let div;
	let each_value = ensure_array_like(/*symbols*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "menu svelte-13h6ctb");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			/*div_binding*/ ctx[6](div);
		},
		p(ctx, [dirty]) {
			if (dirty & /*symbols, menuClick, keydown*/ 6) {
				each_value = ensure_array_like(/*symbols*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$4(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function keydown(e) {
	
}

function instance$n($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// this.menu
	let floatingDiv;

	let symbols = sx;

	onMount(() => {
		// send the div
		tx.send("div", floatingDiv);
	});

	const handlers = {
		"-> set menu"(newSymbols) {
			$$invalidate(1, symbols = newSymbols);
		}
	};

	function menuClick(e) {
		const index = e.target.getAttribute("data-index");
		if (symbols[index].message?.length > 0) tx.send(symbols[index].message, e);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			floatingDiv = $$value;
			$$invalidate(0, floatingDiv);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(4, sx = $$props.sx);
	};

	return [floatingDiv, symbols, menuClick, tx, sx, handlers, div_binding];
}

class Vscode_side_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$n, create_fragment$n, safe_not_equal, { tx: 3, sx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

const subscriber_queue = [];

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * https://svelte.dev/docs/svelte-store#writable
 * @template T
 * @param {T} [value] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Writable<T>}
 */
function writable(value, start = noop) {
	/** @type {import('./public.js').Unsubscriber} */
	let stop;
	/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
	const subscribers = new Set();
	/** @param {T} new_value
	 * @returns {void}
	 */
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				// store is ready
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}

	/**
	 * @param {import('./public.js').Updater<T>} fn
	 * @returns {void}
	 */
	function update(fn) {
		set(fn(value));
	}

	/**
	 * @param {import('./public.js').Subscriber<T>} run
	 * @param {import('./private.js').Invalidator<T>} [invalidate]
	 * @returns {import('./public.js').Unsubscriber}
	 */
	function subscribe(run, invalidate = noop) {
		/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set, update) || noop;
		}
		run(value);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe };
}

// The themes supported are 'dark' and 'light'

// Initialize the theme based on user's previous choices stored in localStorage
function getInitialTheme() {
    return localStorage.getItem('vmblu-theme') || 'dark'; // Default to 'light' if nothing in localStorage
}

// the global theme variable
const theme = writable(getInitialTheme());

// save it when it changes
theme.subscribe(value => {
    localStorage.setItem('vmblu-theme', value);  // Update localStorage whenever the theme changes
});

/* fragments\popup-box.svelte generated by Svelte v4.2.19 */

function create_if_block_2$2(ctx) {
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "description";
			attr(i, "class", "material-icons-outlined open svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, i, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onOpen*/ ctx[5]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(i);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (208:3) {#if box.add}
function create_if_block_1$2(ctx) {
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "add_circle";
			attr(i, "class", "material-icons-outlined open svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, i, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onAdd*/ ctx[6]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(i);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (217:2) {#if box.trash}
function create_if_block$4(ctx) {
	let div;
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			i = element("i");
			i.textContent = "delete";
			attr(i, "class", "material-icons-outlined trash svelte-e6df58");
			attr(div, "class", "right-icons svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, i);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onTrash*/ ctx[7]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$m(ctx) {
	let div2;
	let div1;
	let div0;
	let i0;
	let t1;
	let i1;
	let t3;
	let t4;
	let t5;
	let h1;
	let t6_value = /*box*/ ctx[0].title + "";
	let t6;
	let t7;
	let t8;
	let div2_class_value;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*box*/ ctx[0].open && create_if_block_2$2(ctx);
	let if_block1 = /*box*/ ctx[0].add && create_if_block_1$2(ctx);
	let if_block2 = /*box*/ ctx[0].trash && create_if_block$4(ctx);
	const default_slot_template = /*#slots*/ ctx[10].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			i0 = element("i");
			i0.textContent = "cancel";
			t1 = space();
			i1 = element("i");
			i1.textContent = "check_circle";
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			h1 = element("h1");
			t6 = text(t6_value);
			t7 = space();
			if (if_block2) if_block2.c();
			t8 = space();
			if (default_slot) default_slot.c();
			attr(i0, "class", "material-icons-outlined cancel svelte-e6df58");
			attr(i1, "class", "material-icons-outlined check svelte-e6df58");
			attr(div0, "class", "left-icons svelte-e6df58");
			attr(h1, "class", "svelte-e6df58");
			attr(div1, "class", "hdr svelte-e6df58");
			attr(div2, "class", div2_class_value = "main " + /*$theme*/ ctx[1] + " svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, div0);
			append(div0, i0);
			append(div0, t1);
			append(div0, i1);
			append(div0, t3);
			if (if_block0) if_block0.m(div0, null);
			append(div0, t4);
			if (if_block1) if_block1.m(div0, null);
			append(div1, t5);
			append(div1, h1);
			append(h1, t6);
			append(div1, t7);
			if (if_block2) if_block2.m(div1, null);
			append(div2, t8);

			if (default_slot) {
				default_slot.m(div2, null);
			}

			/*div2_binding*/ ctx[11](div2);
			current = true;

			if (!mounted) {
				dispose = [
					listen(i0, "click", /*onCancel*/ ctx[3]),
					listen(i0, "keydown", /*onKeydown*/ ctx[8]),
					listen(i1, "click", /*onOk*/ ctx[4]),
					listen(i1, "keydown", /*onKeydown*/ ctx[8]),
					listen(div1, "mousedown", /*onMouseDown*/ ctx[2]),
					listen(div2, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*box*/ ctx[0].open) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_2$2(ctx);
					if_block0.c();
					if_block0.m(div0, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*box*/ ctx[0].add) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_1$2(ctx);
					if_block1.c();
					if_block1.m(div0, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if ((!current || dirty & /*box*/ 1) && t6_value !== (t6_value = /*box*/ ctx[0].title + "")) set_data(t6, t6_value);

			if (/*box*/ ctx[0].trash) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block$4(ctx);
					if_block2.c();
					if_block2.m(div1, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 512)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[9],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*$theme*/ 2 && div2_class_value !== (div2_class_value = "main " + /*$theme*/ ctx[1] + " svelte-e6df58")) {
				attr(div2, "class", div2_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div2);
			}

			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (default_slot) default_slot.d(detaching);
			/*div2_binding*/ ctx[11](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$m($$self, $$props, $$invalidate) {
	let $theme;
	component_subscribe($$self, theme, $$value => $$invalidate(1, $theme = $$value));
	let { $$slots: slots = {}, $$scope } = $$props;
	let { box } = $$props;

	// dragging behaviour
	let startX, startY, initialLeft, initialTop;

	let dragging = false;

	onMount(() => {
		// set the show, hide and update functions
		$$invalidate(0, box.show = show, box);

		$$invalidate(0, box.hide = hide, box);
		$$invalidate(0, box.update = () => $$invalidate(0, box), box);
	});

	function onMouseDown(e) {
		startX = e.clientX;
		startY = e.clientY;
		initialLeft = box.div.offsetLeft;
		initialTop = box.div.offsetTop;
		dragging = true;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e) {
		if (dragging) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			$$invalidate(0, box.div.style.left = `${initialLeft + dx}px`, box);
			$$invalidate(0, box.div.style.top = `${initialTop + dy}px`, box);
		}
	}

	function onMouseUp(e) {
		dragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	function show(pos) {
		if (!pos) pos = box.pos;

		if (pos) {
			$$invalidate(0, box.div.style.left = `${pos.x}px`, box);
			$$invalidate(0, box.div.style.top = `${pos.y}px`, box);
		}

		$$invalidate(0, box.div.style.display = 'block', box);
		$$invalidate(0, box);
	}

	function hide() {
		$$invalidate(0, box.div.style.display = 'none', box);
	}

	function onCancel(e) {
		hide();
		box.cancel?.(e);
	}

	function onOk(e) {
		hide();
		box.ok?.(e);
	}

	function onOpen(e) {
		box.open?.(e);
	}

	function onAdd(e) {
		box.add?.(e);
	}

	function onTrash(e) {
		hide();
		box.trash?.(e);
	}

	function onKeydown(e) {
		// prevent the keydown from having effects on the editor !
		e.stopPropagation();

		// check the key
		return e.key == "Enter"
		? onOk(e)
		: e.key == "Escape" || e.key == "Esc" ? onCancel(e) : null;
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			box.div = $$value;
			$$invalidate(0, box);
		});
	}

	$$self.$$set = $$props => {
		if ('box' in $$props) $$invalidate(0, box = $$props.box);
		if ('$$scope' in $$props) $$invalidate(9, $$scope = $$props.$$scope);
	};

	return [
		box,
		$theme,
		onMouseDown,
		onCancel,
		onOk,
		onOpen,
		onAdd,
		onTrash,
		onKeydown,
		$$scope,
		slots,
		div2_binding
	];
}

class Popup_box extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$m, create_fragment$m, safe_not_equal, { box: 0 });
	}
}

/* fragments\same-line.svelte generated by Svelte v4.2.19 */

function create_fragment$l(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr(div, "class", "same-line svelte-nv80og");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[0],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
						null
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$l($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Same_line extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$l, create_fragment$l, safe_not_equal, {});
	}
}

/* fragments\label.svelte generated by Svelte v4.2.19 */

function create_fragment$k(ctx) {
	let label;
	let t;
	let label_style_value;

	return {
		c() {
			label = element("label");
			t = text(/*text*/ ctx[0]);
			attr(label, "class", "label svelte-1w9b525");
			attr(label, "style", label_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*text*/ 1) set_data(t, /*text*/ ctx[0]);

			if (dirty & /*style*/ 2 && label_style_value !== (label_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(label, "style", label_style_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(label);
			}
		}
	};
}

function instance$k($$self, $$props, $$invalidate) {
	let { text } = $$props;
	let { style } = $$props;

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
	};

	return [text, style];
}

class Label extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$k, create_fragment$k, safe_not_equal, { text: 0, style: 1 });
	}
}

/* fragments\text-field.svelte generated by Svelte v4.2.19 */

function create_fragment$j(ctx) {
	let input_1;
	let input_1_style_value;
	let mounted;
	let dispose;

	return {
		c() {
			input_1 = element("input");
			attr(input_1, "class", "grow svelte-w2c0k9");
			attr(input_1, "style", input_1_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
			attr(input_1, "type", "text");
			attr(input_1, "spellcheck", "false");
		},
		m(target, anchor) {
			insert(target, input_1, anchor);
			set_input_value(input_1, /*text*/ ctx[0]);
			/*input_1_binding*/ ctx[6](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[5]),
					listen(input_1, "input", /*onInput*/ ctx[3])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*style*/ 2 && input_1_style_value !== (input_1_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(input_1, "style", input_1_style_value);
			}

			if (dirty & /*text*/ 1 && input_1.value !== /*text*/ ctx[0]) {
				set_input_value(input_1, /*text*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(input_1);
			}

			/*input_1_binding*/ ctx[6](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

const badInputColor$1 = "#ff0000";

function instance$j($$self, $$props, $$invalidate) {
	let { text, check, style } = $$props;
	let input;

	// color to indicate good/bad input
	let savedColor = null;

	onMount(() => {
		// save the good color
		savedColor = input.style.color;
	});

	function onInput(e) {
		// reinitialize the width
		$$invalidate(2, input.style.width = '0px', input);

		// Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
		$$invalidate(
			2,
			input.style.width = input.scrollWidth > 100
			? input.scrollWidth + 2 + 'px'
			: '100px',
			input
		);

		// Do we need to check 
		if (check) {
			// show disapproval when input is nok
			$$invalidate(2, input.style.color = check(input.value) ? savedColor : badInputColor$1, input);
		}
	}

	function input_1_input_handler() {
		text = this.value;
		$$invalidate(0, text);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			input = $$value;
			$$invalidate(2, input);
		});
	}

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('check' in $$props) $$invalidate(4, check = $$props.check);
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
	};

	return [text, style, input, onInput, check, input_1_input_handler, input_1_binding];
}

class Text_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$j, create_fragment$j, safe_not_equal, { text: 0, check: 4, style: 1 });
	}
}

/* fragments\checkbox.svelte generated by Svelte v4.2.19 */

function create_fragment$i(ctx) {
	let input;
	let input_style_value;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "style", input_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
			attr(input, "type", "checkbox");
			attr(input, "class", "svelte-z24rrd");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			input.checked = /*on*/ ctx[0];

			if (!mounted) {
				dispose = [
					listen(input, "change", /*input_change_handler*/ ctx[4]),
					listen(input, "input", /*onInput*/ ctx[2])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*style*/ 2 && input_style_value !== (input_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(input, "style", input_style_value);
			}

			if (dirty & /*on*/ 1) {
				input.checked = /*on*/ ctx[0];
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(input);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$i($$self, $$props, $$invalidate) {
	let { style } = $$props;
	let { on } = $$props;
	let { onToggle } = $$props;

	onMount(() => {
		
	});

	// call the on color function if requested
	function onInput(e) {
		onToggle?.(on);
	}

	function input_change_handler() {
		on = this.checked;
		$$invalidate(0, on);
	}

	$$self.$$set = $$props => {
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
		if ('on' in $$props) $$invalidate(0, on = $$props.on);
		if ('onToggle' in $$props) $$invalidate(3, onToggle = $$props.onToggle);
	};

	return [on, style, onInput, onToggle, input_change_handler];
}

class Checkbox extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$i, create_fragment$i, safe_not_equal, { style: 1, on: 0, onToggle: 3 });
	}
}

/* popups\runtime-settings.svelte generated by Svelte v4.2.19 */

function create_default_slot_2(ctx) {
	let checkbox;
	let t;
	let label;
	let current;

	checkbox = new Checkbox({
			props: {
				on: /*localRx*/ ctx[1].logMessages,
				onToggle
			}
		});

	label = new Label({ props: { text: "log messages" } });

	return {
		c() {
			create_component(checkbox.$$.fragment);
			t = space();
			create_component(label.$$.fragment);
		},
		m(target, anchor) {
			mount_component(checkbox, target, anchor);
			insert(target, t, anchor);
			mount_component(label, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const checkbox_changes = {};
			if (dirty & /*localRx*/ 2) checkbox_changes.on = /*localRx*/ ctx[1].logMessages;
			checkbox.$set(checkbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(checkbox.$$.fragment, local);
			transition_in(label.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(checkbox.$$.fragment, local);
			transition_out(label.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(checkbox, detaching);
			destroy_component(label, detaching);
		}
	};
}

// (79:4) <SameLine>
function create_default_slot_1(ctx) {
	let checkbox;
	let t0;
	let label;
	let t1;
	let textfield;
	let current;

	checkbox = new Checkbox({
			props: { field: /*localRx*/ ctx[1].worker.on }
		});

	label = new Label({
			props: {
				text: "use worker script:",
				style: "margin-right: 0.5rem;"
			}
		});

	textfield = new Text_field({
			props: { field: /*localRx*/ ctx[1].worker.path }
		});

	return {
		c() {
			create_component(checkbox.$$.fragment);
			t0 = space();
			create_component(label.$$.fragment);
			t1 = space();
			create_component(textfield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(checkbox, target, anchor);
			insert(target, t0, anchor);
			mount_component(label, target, anchor);
			insert(target, t1, anchor);
			mount_component(textfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const checkbox_changes = {};
			if (dirty & /*localRx*/ 2) checkbox_changes.field = /*localRx*/ ctx[1].worker.on;
			checkbox.$set(checkbox_changes);
			const textfield_changes = {};
			if (dirty & /*localRx*/ 2) textfield_changes.field = /*localRx*/ ctx[1].worker.path;
			textfield.$set(textfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(checkbox.$$.fragment, local);
			transition_in(label.$$.fragment, local);
			transition_in(textfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(checkbox.$$.fragment, local);
			transition_out(label.$$.fragment, local);
			transition_out(textfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			destroy_component(checkbox, detaching);
			destroy_component(label, detaching);
			destroy_component(textfield, detaching);
		}
	};
}

// (74:0) <PopupBox box={box}>
function create_default_slot$9(ctx) {
	let sameline0;
	let t;
	let sameline1;
	let current;

	sameline0 = new Same_line({
			props: {
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	sameline1 = new Same_line({
			props: {
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(sameline0.$$.fragment);
			t = space();
			create_component(sameline1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(sameline0, target, anchor);
			insert(target, t, anchor);
			mount_component(sameline1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const sameline0_changes = {};

			if (dirty & /*$$scope, localRx*/ 34) {
				sameline0_changes.$$scope = { dirty, ctx };
			}

			sameline0.$set(sameline0_changes);
			const sameline1_changes = {};

			if (dirty & /*$$scope, localRx*/ 34) {
				sameline1_changes.$$scope = { dirty, ctx };
			}

			sameline1.$set(sameline1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(sameline0.$$.fragment, local);
			transition_in(sameline1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(sameline0.$$.fragment, local);
			transition_out(sameline1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(sameline0, detaching);
			destroy_component(sameline1, detaching);
		}
	};
}

function create_fragment$h(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$9] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, localRx*/ 34) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function onToggle(e) {
	
}

function instance$h($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	onMount(() => {
		// send out the div
		tx.send("modal div", box.div);
	});

	// the popup box data
	const box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// set the defauult value 
	const localRx = {
		logMessages: false,
		worker: { on: false, path: '' }
	};

	const handlers = {
		// Settings is the link header of the document
		"-> show"({ title, pos, rx, ok, cancel }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			// if there is a callback, call it
			$$invalidate(
				0,
				box.ok = e => {
					if (!ok) return;

					// call ok with the local rx
					ok(localRx);
				},
				box
			);

			$$invalidate(
				0,
				box.cancel = () => {
					cancel?.();
				},
				box
			);

			// Copy the settings if any
			if (rx) {
				$$invalidate(1, localRx.logMessages = rx.logMessages, localRx);
				$$invalidate(1, localRx.worker.on = rx.worker.on, localRx);
				$$invalidate(1, localRx.worker.path = rx.worker.path, localRx);
			}

			// and show
			box.show(box.pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(3, sx = $$props.sx);
	};

	return [box, localRx, tx, sx, handlers];
}

class Runtime_settings extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$h, create_fragment$h, safe_not_equal, { tx: 2, sx: 3, handlers: 4 });
	}

	get handlers() {
		return this.$$.ctx[4];
	}
}

/* popups\confirm-box.svelte generated by Svelte v4.2.19 */

function create_fragment$g(ctx) {
	let popupbox;
	let current;
	popupbox = new Popup_box({ props: { box: /*box*/ ctx[0] } });

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];
			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$g($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	onMount(async () => {
		// send the box div
		tx.send('modal div', box.div);
	});

	// the popup box data
	const box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	const handlers = {
		"-> show"({ title, message, pos, ok, cancel }) {
			// set the box parameters
			$$invalidate(0, box.title = title, box);

			$$invalidate(0, box.ok = ok, box);
			$$invalidate(0, box.cancel = cancel, box);

			// show
			box.show(pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(1, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(2, sx = $$props.sx);
	};

	return [box, tx, sx, handlers];
}

class Confirm_box extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$g, create_fragment$g, safe_not_equal, { tx: 1, sx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* popups\context-menu.svelte generated by Svelte v4.2.19 */

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[10] = list[i];
	child_ctx[12] = i;
	return child_ctx;
}

// (177:2) {#each context.menu as choice, index}
function create_each_block$3(ctx) {
	let li;
	let i;
	let t0_value = /*choice*/ ctx[10].icon + "";
	let t0;
	let i_class_value;
	let t1;
	let span0;
	let t2_value = /*choice*/ ctx[10].text + "";
	let t2;
	let t3;
	let span1;
	let t4_value = (/*choice*/ ctx[10].char ?? ' ') + "";
	let t4;
	let t5;
	let li_class_value;
	let mounted;
	let dispose;

	return {
		c() {
			li = element("li");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			t4 = text(t4_value);
			t5 = space();
			attr(i, "class", i_class_value = "material-icons-outlined choice-icon " + /*choice*/ ctx[10].state + " svelte-1wos05d");
			attr(span0, "class", "choice-text svelte-1wos05d");
			attr(span1, "class", "choice-char svelte-1wos05d");
			attr(li, "data-index", /*index*/ ctx[12]);
			attr(li, "class", li_class_value = "" + (null_to_empty(/*choice*/ ctx[10].state) + " svelte-1wos05d"));
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, i);
			append(i, t0);
			append(li, t1);
			append(li, span0);
			append(span0, t2);
			append(li, t3);
			append(li, span1);
			append(span1, t4);
			append(li, t5);

			if (!mounted) {
				dispose = [
					listen(li, "click", /*onClickLI*/ ctx[3]),
					listen(li, "keydown", onKeydown$4)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*context*/ 1 && t0_value !== (t0_value = /*choice*/ ctx[10].icon + "")) set_data(t0, t0_value);

			if (dirty & /*context*/ 1 && i_class_value !== (i_class_value = "material-icons-outlined choice-icon " + /*choice*/ ctx[10].state + " svelte-1wos05d")) {
				attr(i, "class", i_class_value);
			}

			if (dirty & /*context*/ 1 && t2_value !== (t2_value = /*choice*/ ctx[10].text + "")) set_data(t2, t2_value);
			if (dirty & /*context*/ 1 && t4_value !== (t4_value = (/*choice*/ ctx[10].char ?? ' ') + "")) set_data(t4, t4_value);

			if (dirty & /*context*/ 1 && li_class_value !== (li_class_value = "" + (null_to_empty(/*choice*/ ctx[10].state) + " svelte-1wos05d"))) {
				attr(li, "class", li_class_value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(li);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$f(ctx) {
	let div;
	let ul;
	let mounted;
	let dispose;
	let each_value = ensure_array_like(/*context*/ ctx[0].menu);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(ul, "class", "svelte-1wos05d");
			attr(div, "class", "svelte-1wos05d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			/*div_binding*/ ctx[7](div);

			if (!mounted) {
				dispose = [
					listen(ul, "mouseleave", /*hide*/ ctx[1]),
					listen(div, "click", /*hide*/ ctx[1]),
					listen(div, "contextmenu", /*goAway*/ ctx[2]),
					listen(div, "keydown", onKeydown$4)
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*context, onClickLI, onKeydown*/ 9) {
				each_value = ensure_array_like(/*context*/ ctx[0].menu);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$3(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[7](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function onKeydown$4(e) {
	
}

function instance$f($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	let context = {
		div: null,
		menu: [],
		show: () => {
			
		}
	};

	onMount(() => {
		$$invalidate(0, context.show = show, context);

		// send the box div
		tx.send('modal div', context.div);
	});

	const handlers = {
		// pos = x,y = e.clientX e.clientY
		"-> context menu"({ menu, event }) {
			// set the menu
			$$invalidate(0, context.menu = menu, context);

			// show the menu at the requested position
			context.show(event);
		}
	};

	// show the list - typically on a right click "oncontextmenu"
	function show(e) {
		// check
		if (context.menu.length <= 0) return;

		// calculate the width of the list
		setWidth();

		// the div has the display 'absolute' attribute - so we use client coordinates !
		$$invalidate(0, context.div.style.display = "block", context);

		// + or -10 is to make sure the cursor is in the selection list
		$$invalidate(0, context.div.style.left = `${e.clientX - 10}px`, context);

		$$invalidate(0, context.div.style.top = `${e.clientY - 20}px`, context);

		// force an update
		$$invalidate(0, context);
	}

	// calculate the width of the list
	function setWidth() {
		// determine the width of the clicklist
		let max = 0;

		context.menu.forEach(choice => {
			const len = choice.text.length + (choice.char ? choice.char.length + 5 : 0);
			if (len > max) max = len;
		});

		// set the width of the UL
		context.div.querySelector("ul").style.width = (0.5 * max + 1.5).toString() + "rem";
	}

	// when getting out of the ul area
	function hide(e) {
		$$invalidate(0, context.div.style.display = "none", context);
	}

	function goAway(e) {
		e.preventDefault();
		$$invalidate(0, context.div.style.display = "none", context);
	}

	// when selecting in the ul
	function onClickLI(e) {
		// hide the list
		$$invalidate(0, context.div.style.display = "none", context);

		// get the index
		let index = e.target.dataset.index ?? e.target.parentNode.dataset.index;

		// check if enabled
		if (context.menu[index]) {
			if (context.menu[index].state == "enabled") context.menu[index].action(e);
		}
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			context.div = $$value;
			$$invalidate(0, context);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(5, sx = $$props.sx);
	};

	return [context, hide, goAway, onClickLI, tx, sx, handlers, div_binding];
}

class Context_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$f, create_fragment$f, safe_not_equal, { tx: 4, sx: 5, handlers: 6 });
	}

	get handlers() {
		return this.$$.ctx[6];
	}
}

/* fragments\text-area-input.svelte generated by Svelte v4.2.19 */

function create_fragment$e(ctx) {
	let textarea;
	let mounted;
	let dispose;

	return {
		c() {
			textarea = element("textarea");
			attr(textarea, "name", "txt-name");
			attr(textarea, "spellcheck", "false");
			attr(textarea, "rows", /*rows*/ ctx[2]);
			attr(textarea, "cols", /*cols*/ ctx[1]);
			attr(textarea, "class", "svelte-1xkqtu5");
		},
		m(target, anchor) {
			insert(target, textarea, anchor);
			set_input_value(textarea, /*text*/ ctx[0]);

			if (!mounted) {
				dispose = [
					listen(textarea, "input", /*textarea_input_handler*/ ctx[3]),
					listen(textarea, "keydown", onKeydown$3)
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*rows*/ 4) {
				attr(textarea, "rows", /*rows*/ ctx[2]);
			}

			if (dirty & /*cols*/ 2) {
				attr(textarea, "cols", /*cols*/ ctx[1]);
			}

			if (dirty & /*text*/ 1) {
				set_input_value(textarea, /*text*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(textarea);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function onKeydown$3(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$e($$self, $$props, $$invalidate) {
	let { text, cols, rows } = $$props;

	onMount(() => {
		
	});

	function textarea_input_handler() {
		text = this.value;
		$$invalidate(0, text);
	}

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('cols' in $$props) $$invalidate(1, cols = $$props.cols);
		if ('rows' in $$props) $$invalidate(2, rows = $$props.rows);
	};

	return [text, cols, rows, textarea_input_handler];
}

let Text_area_input$1 = class Text_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$e, create_fragment$e, safe_not_equal, { text: 0, cols: 1, rows: 2 });
	}
};

/* popups\json-area-input.svelte generated by Svelte v4.2.19 */

function create_default_slot$8(ctx) {
	let textareainput;
	let updating_text;
	let current;

	function textareainput_text_binding(value) {
		/*textareainput_text_binding*/ ctx[5](value);
	}

	let textareainput_props = { cols: "50", rows: "25" };

	if (/*text*/ ctx[1] !== undefined) {
		textareainput_props.text = /*text*/ ctx[1];
	}

	textareainput = new Text_area_input$1({ props: textareainput_props });
	binding_callbacks.push(() => bind(textareainput, 'text', textareainput_text_binding));

	return {
		c() {
			create_component(textareainput.$$.fragment);
		},
		m(target, anchor) {
			mount_component(textareainput, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const textareainput_changes = {};

			if (!updating_text && dirty & /*text*/ 2) {
				updating_text = true;
				textareainput_changes.text = /*text*/ ctx[1];
				add_flush_callback(() => updating_text = false);
			}

			textareainput.$set(textareainput_changes);
		},
		i(local) {
			if (current) return;
			transition_in(textareainput.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(textareainput.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(textareainput, detaching);
		}
	};
}

function create_fragment$d(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$8] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, text*/ 130) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	onMount(async () => {
		tx.send("modal div", box.div);
	});

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// the text
	let text = '';

	const handlers = {
		"-> json"({ title, pos, json, ok }) {
			// set the box parameters
			$$invalidate(0, box.title = title, box);

			$$invalidate(0, box.pos = { ...pos }, box);

			// The ok function for the box
			$$invalidate(
				0,
				box.ok = () => {
					// check
					const newJson = checkJSON();

					// check for empty 
					if (newJson?.length == 0) return ok ? ok('') : null;

					// save or restart
					newJson ? ok?.(newJson) : box.show(pos);
				},
				box
			);

			// transform json to text
			$$invalidate(1, text = json ? JSON.stringify(json, null, '  ') : '');

			box.show(pos);
		}
	};

	function checkJSON() {
		// check for a SyntaxError
		let syntax = text.indexOf("SyntaxError");

		// remove the syntax error if any
		if (syntax != -1) $$invalidate(1, text = syntax > 1 ? text.slice(0, syntax - 2) : '');

		// it could be that the content is just empty
		if (text.length == 0) return '';

		// convert the json to an object
		try {
			// parse the content of the field
			return JSON.parse(text);
		} catch(error) {
			// show the content followed by the error
			$$invalidate(1, text = text + '\n\n' + error);

			// no valid json
			return null;
		}
	}

	function textareainput_text_binding(value) {
		text = value;
		$$invalidate(1, text);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(3, sx = $$props.sx);
	};

	return [box, text, tx, sx, handlers, textareainput_text_binding];
}

class Json_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$d, safe_not_equal, { tx: 2, sx: 3, handlers: 4 });
	}

	get handlers() {
		return this.$$.ctx[4];
	}
}

/* popups\text-area-input.svelte generated by Svelte v4.2.19 */

function create_default_slot$7(ctx) {
	let textareainput;
	let updating_text;
	let current;

	function textareainput_text_binding(value) {
		/*textareainput_text_binding*/ ctx[5](value);
	}

	let textareainput_props = { cols: "50", rows: "25" };

	if (/*newText*/ ctx[1] !== undefined) {
		textareainput_props.text = /*newText*/ ctx[1];
	}

	textareainput = new Text_area_input$1({ props: textareainput_props });
	binding_callbacks.push(() => bind(textareainput, 'text', textareainput_text_binding));

	return {
		c() {
			create_component(textareainput.$$.fragment);
		},
		m(target, anchor) {
			mount_component(textareainput, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const textareainput_changes = {};

			if (!updating_text && dirty & /*newText*/ 2) {
				updating_text = true;
				textareainput_changes.text = /*newText*/ ctx[1];
				add_flush_callback(() => updating_text = false);
			}

			textareainput.$set(textareainput_changes);
		},
		i(local) {
			if (current) return;
			transition_in(textareainput.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(textareainput.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(textareainput, detaching);
		}
	};
}

function create_fragment$c(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$7] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, newText*/ 66) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$c($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	onMount(() => {
		tx.send("modal div", box.div);
	});

	// the text
	let newText = '';

	const handlers = {
		"-> text"({ header, pos, text, ok = null, cancel = null }) {
			// set the box parameters
			$$invalidate(0, box.title = header, box);

			$$invalidate(
				0,
				box.ok = () => {
					ok?.(newText);
				},
				box
			);

			// set the text field
			$$invalidate(1, newText = text);

			// show
			box.show(pos);
		}
	};

	function textareainput_text_binding(value) {
		newText = value;
		$$invalidate(1, newText);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(3, sx = $$props.sx);
	};

	return [box, newText, tx, sx, handlers, textareainput_text_binding];
}

class Text_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$c, create_fragment$c, safe_not_equal, { tx: 2, sx: 3, handlers: 4 });
	}

	get handlers() {
		return this.$$.ctx[4];
	}
}

/* fragments\profile-input-pin.svelte generated by Svelte v4.2.19 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i].type;
	child_ctx[4] = list[i].name;
	child_ctx[5] = list[i].description;
	return child_ctx;
}

// (92:2) {#if profile != null}
function create_if_block$3(ctx) {
	let div0;
	let p;
	let span;
	let t0_value = /*profile*/ ctx[0].handler + "";
	let t0;
	let t1;
	let t2_value = ' ' + "";
	let t2;
	let t3;
	let t4_value = /*profile*/ ctx[0].file + "";
	let t4;
	let t5;
	let t6_value = /*profile*/ ctx[0].line + "";
	let t6;
	let t7;
	let t8;
	let div1;
	let t9;
	let div2;
	let pre;
	let t10_value = /*profile*/ ctx[0].summary + "";
	let t10;
	let mounted;
	let dispose;
	let each_value = ensure_array_like(/*profile*/ ctx[0].params);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	return {
		c() {
			div0 = element("div");
			p = element("p");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			t2 = text(t2_value);
			t3 = text("in ");
			t4 = text(t4_value);
			t5 = text(" (");
			t6 = text(t6_value);
			t7 = text(")");
			t8 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t9 = space();
			div2 = element("div");
			pre = element("pre");
			t10 = text(t10_value);
			attr(span, "class", "clickable svelte-12ljufx");
			attr(p, "class", "svelte-12ljufx");
			attr(div0, "class", "handler svelte-12ljufx");
			attr(div1, "class", "params svelte-12ljufx");
			attr(pre, "class", "svelte-12ljufx");
			attr(div2, "class", "prompt svelte-12ljufx");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, p);
			append(p, span);
			append(span, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
			append(p, t5);
			append(p, t6);
			append(p, t7);
			insert(target, t8, anchor);
			insert(target, div1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div1, null);
				}
			}

			insert(target, t9, anchor);
			insert(target, div2, anchor);
			append(div2, pre);
			append(pre, t10);

			if (!mounted) {
				dispose = [
					listen(span, "click", /*click_handler*/ ctx[2]),
					listen(span, "keydown", onKeydown$2)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*profile*/ ctx[0].handler + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*profile*/ ctx[0].file + "")) set_data(t4, t4_value);
			if (dirty & /*profile*/ 1 && t6_value !== (t6_value = /*profile*/ ctx[0].line + "")) set_data(t6, t6_value);

			if (dirty & /*profile*/ 1) {
				each_value = ensure_array_like(/*profile*/ ctx[0].params);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty & /*profile*/ 1 && t10_value !== (t10_value = /*profile*/ ctx[0].summary + "")) set_data(t10, t10_value);
		},
		d(detaching) {
			if (detaching) {
				detach(div0);
				detach(t8);
				detach(div1);
				detach(t9);
				detach(div2);
			}

			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (103:6) {#each profile.params as { type, name, description }}
function create_each_block$2(ctx) {
	let p;
	let t0_value = /*name*/ ctx[4] + "";
	let t0;
	let t1;
	let t2_value = /*type*/ ctx[3] + "";
	let t2;
	let t3;
	let t4_value = /*description*/ ctx[5] + "";
	let t4;

	return {
		c() {
			p = element("p");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(") ");
			t4 = text(t4_value);
			attr(p, "class", "svelte-12ljufx");
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*name*/ ctx[4] + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t2_value !== (t2_value = /*type*/ ctx[3] + "")) set_data(t2, t2_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*description*/ ctx[5] + "")) set_data(t4, t4_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}
		}
	};
}

function create_fragment$b(ctx) {
	let div;
	let if_block = /*profile*/ ctx[0] != null && create_if_block$3(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "class", "profile svelte-12ljufx");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (/*profile*/ ctx[0] != null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$3(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (if_block) if_block.d();
		}
	};
}

function onKeydown$2(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$b($$self, $$props, $$invalidate) {
	let { profile, open } = $$props;
	const click_handler = () => open?.({ file: profile.file, line: profile.line });

	$$self.$$set = $$props => {
		if ('profile' in $$props) $$invalidate(0, profile = $$props.profile);
		if ('open' in $$props) $$invalidate(1, open = $$props.open);
	};

	return [profile, open, click_handler];
}

class Profile_input_pin extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$b, create_fragment$b, safe_not_equal, { profile: 0, open: 1 });
	}
}

/* fragments\profile-output-pin.svelte generated by Svelte v4.2.19 */

function create_if_block$2(ctx) {
	let div;
	let p;
	let span;
	let t0_value = /*profile*/ ctx[0].pin + "";
	let t0;
	let t1;
	let t2_value = /*profile*/ ctx[0].file + "";
	let t2;
	let t3;
	let t4_value = /*profile*/ ctx[0].line + "";
	let t4;
	let t5;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			p = element("p");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			t2 = text(t2_value);
			t3 = text(" (");
			t4 = text(t4_value);
			t5 = text(")");
			attr(span, "class", "clickable svelte-1s2gtx8");
			attr(p, "class", "svelte-1s2gtx8");
			attr(div, "class", "transmit svelte-1s2gtx8");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, p);
			append(p, span);
			append(span, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
			append(p, t5);

			if (!mounted) {
				dispose = [
					listen(span, "click", /*click_handler*/ ctx[2]),
					listen(span, "keydown", onKeydown$1)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*profile*/ ctx[0].pin + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t2_value !== (t2_value = /*profile*/ ctx[0].file + "")) set_data(t2, t2_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*profile*/ ctx[0].line + "")) set_data(t4, t4_value);
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$a(ctx) {
	let div;
	let if_block = /*profile*/ ctx[0] != null && create_if_block$2(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "class", "profile svelte-1s2gtx8");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (/*profile*/ ctx[0] != null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$2(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (if_block) if_block.d();
		}
	};
}

function onKeydown$1(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$a($$self, $$props, $$invalidate) {
	let { profile, open } = $$props;
	const click_handler = () => open?.({ file: profile.file, line: profile.line });

	$$self.$$set = $$props => {
		if ('profile' in $$props) $$invalidate(0, profile = $$props.profile);
		if ('open' in $$props) $$invalidate(1, open = $$props.open);
	};

	return [profile, open, click_handler];
}

class Profile_output_pin extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$a, safe_not_equal, { profile: 0, open: 1 });
	}
}

/* popups\pin-profile.svelte generated by Svelte v4.2.19 */

function get_each_context_1$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	return child_ctx;
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	return child_ctx;
}

// (67:0) {:else}
function create_else_block_1$1(ctx) {
	let div;
	let t1;
	let show_if;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_2$1, create_else_block_2];
	const if_blocks = [];

	function select_block_type_2(ctx, dirty) {
		if (dirty & /*_profile*/ 2) show_if = null;
		if (show_if == null) show_if = !!Array.isArray(/*_profile*/ ctx[1]);
		if (show_if) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_2(ctx, -1);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1b1iahk">Send locactions</p>`;
			t1 = space();
			if_block.c();
			if_block_anchor = empty();
			attr(div, "class", "pin svelte-1b1iahk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_2(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
				detach(if_block_anchor);
			}

			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

// (52:0) {#if _pin?.is.input}
function create_if_block$1(ctx) {
	let show_if;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_1$1, create_else_block$1];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (dirty & /*_profile*/ 2) show_if = null;
		if (show_if == null) show_if = !!Array.isArray(/*_profile*/ ctx[1]);
		if (show_if) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_1(ctx, -1);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

// (75:4) {:else}
function create_else_block_2(ctx) {
	let outputprofile;
	let current;

	outputprofile = new Profile_output_pin({
			props: {
				profile: /*_profile*/ ctx[1],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(outputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(outputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const outputprofile_changes = {};
			if (dirty & /*_profile*/ 2) outputprofile_changes.profile = /*_profile*/ ctx[1];
			if (dirty & /*_open*/ 8) outputprofile_changes.open = /*_open*/ ctx[3];
			outputprofile.$set(outputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(outputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(outputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(outputprofile, detaching);
		}
	};
}

// (71:4) {#if Array.isArray(_profile)}
function create_if_block_2$1(ctx) {
	let each_1_anchor;
	let current;
	let each_value_1 = ensure_array_like(/*_profile*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*_profile, _open*/ 10) {
				each_value_1 = ensure_array_like(/*_profile*/ ctx[1]);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (72:8) {#each _profile as singleProfile}
function create_each_block_1$1(ctx) {
	let outputprofile;
	let current;

	outputprofile = new Profile_output_pin({
			props: {
				profile: /*singleProfile*/ ctx[7],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(outputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(outputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const outputprofile_changes = {};
			if (dirty & /*_profile*/ 2) outputprofile_changes.profile = /*singleProfile*/ ctx[7];
			if (dirty & /*_open*/ 8) outputprofile_changes.open = /*_open*/ ctx[3];
			outputprofile.$set(outputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(outputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(outputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(outputprofile, detaching);
		}
	};
}

// (61:4) {:else}
function create_else_block$1(ctx) {
	let div;
	let t1;
	let inputprofile;
	let current;

	inputprofile = new Profile_input_pin({
			props: {
				profile: /*_profile*/ ctx[1],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1b1iahk">Handler and parameters:</p>`;
			t1 = space();
			create_component(inputprofile.$$.fragment);
			attr(div, "class", "pin svelte-1b1iahk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);
			mount_component(inputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const inputprofile_changes = {};
			if (dirty & /*_profile*/ 2) inputprofile_changes.profile = /*_profile*/ ctx[1];
			if (dirty & /*_open*/ 8) inputprofile_changes.open = /*_open*/ ctx[3];
			inputprofile.$set(inputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(inputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(inputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
			}

			destroy_component(inputprofile, detaching);
		}
	};
}

// (54:4) {#if Array.isArray(_profile)}
function create_if_block_1$1(ctx) {
	let div;
	let t1;
	let each_1_anchor;
	let current;
	let each_value = ensure_array_like(/*_profile*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1b1iahk">Handlers and parameters</p>`;
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
			attr(div, "class", "pin svelte-1b1iahk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*_profile, _open*/ 10) {
				each_value = ensure_array_like(/*_profile*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (58:8) {#each _profile as singleProfile}
function create_each_block$1(ctx) {
	let inputprofile;
	let current;

	inputprofile = new Profile_input_pin({
			props: {
				profile: /*singleProfile*/ ctx[7],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(inputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(inputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const inputprofile_changes = {};
			if (dirty & /*_profile*/ 2) inputprofile_changes.profile = /*singleProfile*/ ctx[7];
			if (dirty & /*_open*/ 8) inputprofile_changes.open = /*_open*/ ctx[3];
			inputprofile.$set(inputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(inputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(inputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(inputprofile, detaching);
		}
	};
}

// (50:0) <PopupBox box={box}>
function create_default_slot$6(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block_1$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*_pin*/ ctx[2]?.is.input) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

function create_fragment$9(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$6] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _profile, _open, _pin*/ 4110) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$9($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	onMount(() => {
		tx.send("modal div", box.div);
	});

	// save local data
	let _profile = null;

	let _pin = null;
	let _open = null;

	const handlers = {
		"-> show"({ pos, pin, profile, open = null }) {
			$$invalidate(
				0,
				box.title = pin.is.left
				? (pin.is.input ? ' \u25B6 ' : ' \u25C0 ') + pin.name
				: pin.name + (pin.is.input ? ' \u25C0 ' : ' \u25B6 '),
				box
			);

			$$invalidate(2, _pin = pin);
			$$invalidate(1, _profile = profile);
			$$invalidate(3, _open = open);
			box.show(pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(5, sx = $$props.sx);
	};

	return [box, _profile, _pin, _open, tx, sx, handlers];
}

class Pin_profile extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { tx: 4, sx: 5, handlers: 6 });
	}

	get handlers() {
		return this.$$.ctx[6];
	}
}

/* fragments\label-input-field.svelte generated by Svelte v4.2.19 */

function create_fragment$7(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input_1;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input_1 = element("input");
			attr(label_1, "for", /*fid*/ ctx[4]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-dgsivs");
			attr(input_1, "id", /*fid*/ ctx[4]);
			attr(input_1, "type", "text");
			attr(input_1, "spellcheck", "false");
			attr(input_1, "class", "svelte-dgsivs");
			attr(div, "class", "input-field svelte-dgsivs");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input_1);
			set_input_value(input_1, /*input*/ ctx[0]);
			/*input_1_binding*/ ctx[8](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[7]),
					listen(input_1, "input", /*onInput*/ ctx[5]),
					listen(input_1, "click", /*onInput*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*input*/ 1 && input_1.value !== /*input*/ ctx[0]) {
				set_input_value(input_1, /*input*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			/*input_1_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

const badInputColor = "#ff0000";

function instance$7($$self, $$props, $$invalidate) {
	let { label, input, style, check } = $$props;
	let field;
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	const setFieldWidth = () => {
		$$invalidate(3, field.style.width = '0px', field);
		$$invalidate(3, field.style.width = field.scrollWidth + 2 + 'px', field);
	};

	// color to indicate good/bad input
	let savedColor = null;

	onMount(() => {
		// save the good color
		savedColor = field.style.color;

		// Set input width based on its scrollWidth (for initial value)
		setFieldWidth();
	});

	function onInput(e) {
		// reinitialize the width
		setFieldWidth();

		// Do we need to check 
		if (!check) return;

		// show disapproval when input is nok
		$$invalidate(3, field.style.color = check(e.target.value) ? savedColor : badInputColor, field);
	}

	function input_1_input_handler() {
		input = this.value;
		$$invalidate(0, input);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			field = $$value;
			$$invalidate(3, field);
		});
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('input' in $$props) $$invalidate(0, input = $$props.input);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
		if ('check' in $$props) $$invalidate(6, check = $$props.check);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*field*/ 8) {
			// Reactive: update width whenever input changes and field is available
			if (field) setFieldWidth();
		}
	};

	return [
		input,
		label,
		style,
		field,
		fid,
		onInput,
		check,
		input_1_input_handler,
		input_1_binding
	];
}

class Label_input_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, { label: 1, input: 0, style: 2, check: 6 });
	}
}

/* popups\name-path.svelte generated by Svelte v4.2.19 */

function create_default_slot$4(ctx) {
	let labelinputfield0;
	let updating_input;
	let t;
	let labelinputfield1;
	let updating_input_1;
	let current;

	function labelinputfield0_input_binding(value) {
		/*labelinputfield0_input_binding*/ ctx[7](value);
	}

	let labelinputfield0_props = {
		label: "Name",
		style: "width: 3rem;",
		check: null
	};

	if (/*_name*/ ctx[1] !== undefined) {
		labelinputfield0_props.input = /*_name*/ ctx[1];
	}

	labelinputfield0 = new Label_input_field({ props: labelinputfield0_props });
	binding_callbacks.push(() => bind(labelinputfield0, 'input', labelinputfield0_input_binding));

	function labelinputfield1_input_binding(value) {
		/*labelinputfield1_input_binding*/ ctx[8](value);
	}

	let labelinputfield1_props = {
		label: "Path",
		style: "width: 3rem;",
		check: /*checkPath*/ ctx[3]
	};

	if (/*_path*/ ctx[2] !== undefined) {
		labelinputfield1_props.input = /*_path*/ ctx[2];
	}

	labelinputfield1 = new Label_input_field({ props: labelinputfield1_props });
	binding_callbacks.push(() => bind(labelinputfield1, 'input', labelinputfield1_input_binding));

	return {
		c() {
			create_component(labelinputfield0.$$.fragment);
			t = space();
			create_component(labelinputfield1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinputfield0, target, anchor);
			insert(target, t, anchor);
			mount_component(labelinputfield1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinputfield0_changes = {};

			if (!updating_input && dirty & /*_name*/ 2) {
				updating_input = true;
				labelinputfield0_changes.input = /*_name*/ ctx[1];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield0.$set(labelinputfield0_changes);
			const labelinputfield1_changes = {};

			if (!updating_input_1 && dirty & /*_path*/ 4) {
				updating_input_1 = true;
				labelinputfield1_changes.input = /*_path*/ ctx[2];
				add_flush_callback(() => updating_input_1 = false);
			}

			labelinputfield1.$set(labelinputfield1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinputfield0.$$.fragment, local);
			transition_in(labelinputfield1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinputfield0.$$.fragment, local);
			transition_out(labelinputfield1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(labelinputfield0, detaching);
			destroy_component(labelinputfield1, detaching);
		}
	};
}

function create_fragment$6(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$4] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _path, _name*/ 1030) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// local copies of the 
	let _name = '';

	let _path = '';
	let _regex = '';

	function checkPath(str) {
		// if we need to test the input..
		if (!_regex) return true;

		// test the input against the regex
		return _regex.test?.(str);
	}

	onMount(() => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		onNameAndPath({ title, pos, name, path, regex, ok, cancel, open, trash }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(
				0,
				box.ok = () => {
					ok?.(_name, _path);
				},
				box
			);

			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			$$invalidate(
				0,
				box.open = e => {
					open?.(_name, _path);
					box.hide();
				},
				box
			);

			$$invalidate(0, box.trash = trash ? () => trash() : null, box);

			// the name field
			$$invalidate(1, _name = name);

			$$invalidate(2, _path = path);
			_regex = regex;

			// show the popup
			box.show(pos);
		}
	};

	function labelinputfield0_input_binding(value) {
		_name = value;
		$$invalidate(1, _name);
	}

	function labelinputfield1_input_binding(value) {
		_path = value;
		$$invalidate(2, _path);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(5, sx = $$props.sx);
	};

	return [
		box,
		_name,
		_path,
		checkPath,
		tx,
		sx,
		handlers,
		labelinputfield0_input_binding,
		labelinputfield1_input_binding
	];
}

class Name_path extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { tx: 4, sx: 5, handlers: 6 });
	}

	get handlers() {
		return this.$$.ctx[6];
	}
}

/* popups\path.svelte generated by Svelte v4.2.19 */

function create_default_slot$3(ctx) {
	let labelinputfield;
	let updating_input;
	let current;

	function labelinputfield_input_binding(value) {
		/*labelinputfield_input_binding*/ ctx[6](value);
	}

	let labelinputfield_props = {
		label: "Path :",
		style: "width: 2rem;",
		check: /*checkPath*/ ctx[2]
	};

	if (/*_path*/ ctx[1] !== undefined) {
		labelinputfield_props.input = /*_path*/ ctx[1];
	}

	labelinputfield = new Label_input_field({ props: labelinputfield_props });
	binding_callbacks.push(() => bind(labelinputfield, 'input', labelinputfield_input_binding));

	return {
		c() {
			create_component(labelinputfield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinputfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinputfield_changes = {};

			if (!updating_input && dirty & /*_path*/ 2) {
				updating_input = true;
				labelinputfield_changes.input = /*_path*/ ctx[1];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield.$set(labelinputfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinputfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinputfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(labelinputfield, detaching);
		}
	};
}

function create_fragment$5(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$3] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _path*/ 258) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// local copies of the 
	let _path;

	function checkPath(str) {
		// if we need to test the input..
		return true;
	}

	onMount(() => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		// The uid is the uid of the node for which the popup is opened
		"-> path"({ title, path, pos, ok, cancel }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(0, box.ok = ok ? () => ok(_path) : null, box);
			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			// the path field
			$$invalidate(1, _path = path);

			// show the popup
			box.show();
		}
	};

	function labelinputfield_input_binding(value) {
		_path = value;
		$$invalidate(1, _path);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(4, sx = $$props.sx);
	};

	return [box, _path, checkPath, tx, sx, handlers, labelinputfield_input_binding];
}

class Path extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, { tx: 3, sx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* fragments\label-info-field.svelte generated by Svelte v4.2.19 */

function create_fragment$3(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input = element("input");
			attr(label_1, "for", /*fid*/ ctx[3]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-1tr5m2d");
			attr(input, "id", /*fid*/ ctx[3]);
			attr(input, "type", "text");
			attr(input, "spellcheck", "false");
			input.readOnly = true;
			attr(input, "class", "svelte-1tr5m2d");
			attr(div, "class", "input-field svelte-1tr5m2d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input);
			set_input_value(input, /*info*/ ctx[0]);

			if (!mounted) {
				dispose = listen(input, "input", /*input_input_handler*/ ctx[4]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*info*/ 1 && input.value !== /*info*/ ctx[0]) {
				set_input_value(input, /*info*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			dispose();
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { label, info, style } = $$props;
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {
		
	});

	function input_input_handler() {
		info = this.value;
		$$invalidate(0, info);
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('info' in $$props) $$invalidate(0, info = $$props.info);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
	};

	return [info, label, style, fid, input_input_handler];
}

class Label_info_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { label: 1, info: 0, style: 2 });
	}
}

/* fragments\color-picker.svelte generated by Svelte v4.2.19 */

function create_fragment$2(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input_1;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input_1 = element("input");
			attr(label_1, "for", /*fid*/ ctx[4]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-2bjr9q");
			attr(input_1, "id", /*fid*/ ctx[4]);
			attr(input_1, "type", "color");
			attr(input_1, "class", "svelte-2bjr9q");
			attr(div, "class", "color-field svelte-2bjr9q");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input_1);
			set_input_value(input_1, /*color*/ ctx[0]);
			/*input_1_binding*/ ctx[8](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[7]),
					listen(input_1, "input", /*onInput*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*color*/ 1) {
				set_input_value(input_1, /*color*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			/*input_1_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { label } = $$props;
	let { style } = $$props;
	let { color } = $$props;
	let { onColor } = $$props;
	let input;

	// random field id
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {
		
	});

	// call the on color function if requested
	function onInput(e) {
		onColor?.(color);
	}

	function input_1_input_handler() {
		color = this.value;
		$$invalidate(0, color);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			input = $$value;
			$$invalidate(3, input);
		});
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
		if ('color' in $$props) $$invalidate(0, color = $$props.color);
		if ('onColor' in $$props) $$invalidate(6, onColor = $$props.onColor);
	};

	return [
		color,
		label,
		style,
		input,
		fid,
		onInput,
		onColor,
		input_1_input_handler,
		input_1_binding
	];
}

class Color_picker extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { label: 1, style: 2, color: 0, onColor: 6 });
	}
}

/* popups\document-settings.svelte generated by Svelte v4.2.19 */

function create_default_slot$1(ctx) {
	let labelinfofield0;
	let t0;
	let labelinfofield1;
	let t1;
	let labelinfofield2;
	let t2;
	let labelinfofield3;
	let t3;
	let labelinputfield;
	let updating_input;
	let t4;
	let colorpicker;
	let current;

	labelinfofield0 = new Label_info_field({
			props: {
				label: "File:",
				style: "width: 6rem;",
				info: /*_path*/ ctx[1]
			}
		});

	labelinfofield1 = new Label_info_field({
			props: {
				label: "Vmblu Version:",
				style: "width: 6rem;",
				info: /*_version*/ ctx[3]
			}
		});

	labelinfofield2 = new Label_info_field({
			props: {
				label: "Creation Date:",
				style: "width: 6rem;",
				info: /*_created*/ ctx[2]
			}
		});

	labelinfofield3 = new Label_info_field({
			props: {
				label: "Last Saved:",
				style: "width: 6rem;",
				info: /*_saved*/ ctx[4]
			}
		});

	function labelinputfield_input_binding(value) {
		/*labelinputfield_input_binding*/ ctx[11](value);
	}

	let labelinputfield_props = {
		label: "Runtime",
		style: "width: 6rem;",
		check: null
	};

	if (/*_runtime*/ ctx[6] !== undefined) {
		labelinputfield_props.input = /*_runtime*/ ctx[6];
	}

	labelinputfield = new Label_input_field({ props: labelinputfield_props });
	binding_callbacks.push(() => bind(labelinputfield, 'input', labelinputfield_input_binding));

	colorpicker = new Color_picker({
			props: {
				label: "Node Color:",
				style: "width: 6rem;",
				color: /*_color*/ ctx[5],
				onColor: /*_onColor*/ ctx[7]
			}
		});

	return {
		c() {
			create_component(labelinfofield0.$$.fragment);
			t0 = space();
			create_component(labelinfofield1.$$.fragment);
			t1 = space();
			create_component(labelinfofield2.$$.fragment);
			t2 = space();
			create_component(labelinfofield3.$$.fragment);
			t3 = space();
			create_component(labelinputfield.$$.fragment);
			t4 = space();
			create_component(colorpicker.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinfofield0, target, anchor);
			insert(target, t0, anchor);
			mount_component(labelinfofield1, target, anchor);
			insert(target, t1, anchor);
			mount_component(labelinfofield2, target, anchor);
			insert(target, t2, anchor);
			mount_component(labelinfofield3, target, anchor);
			insert(target, t3, anchor);
			mount_component(labelinputfield, target, anchor);
			insert(target, t4, anchor);
			mount_component(colorpicker, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinfofield0_changes = {};
			if (dirty & /*_path*/ 2) labelinfofield0_changes.info = /*_path*/ ctx[1];
			labelinfofield0.$set(labelinfofield0_changes);
			const labelinfofield1_changes = {};
			if (dirty & /*_version*/ 8) labelinfofield1_changes.info = /*_version*/ ctx[3];
			labelinfofield1.$set(labelinfofield1_changes);
			const labelinfofield2_changes = {};
			if (dirty & /*_created*/ 4) labelinfofield2_changes.info = /*_created*/ ctx[2];
			labelinfofield2.$set(labelinfofield2_changes);
			const labelinfofield3_changes = {};
			if (dirty & /*_saved*/ 16) labelinfofield3_changes.info = /*_saved*/ ctx[4];
			labelinfofield3.$set(labelinfofield3_changes);
			const labelinputfield_changes = {};

			if (!updating_input && dirty & /*_runtime*/ 64) {
				updating_input = true;
				labelinputfield_changes.input = /*_runtime*/ ctx[6];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield.$set(labelinputfield_changes);
			const colorpicker_changes = {};
			if (dirty & /*_color*/ 32) colorpicker_changes.color = /*_color*/ ctx[5];
			if (dirty & /*_onColor*/ 128) colorpicker_changes.onColor = /*_onColor*/ ctx[7];
			colorpicker.$set(colorpicker_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinfofield0.$$.fragment, local);
			transition_in(labelinfofield1.$$.fragment, local);
			transition_in(labelinfofield2.$$.fragment, local);
			transition_in(labelinfofield3.$$.fragment, local);
			transition_in(labelinputfield.$$.fragment, local);
			transition_in(colorpicker.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinfofield0.$$.fragment, local);
			transition_out(labelinfofield1.$$.fragment, local);
			transition_out(labelinfofield2.$$.fragment, local);
			transition_out(labelinfofield3.$$.fragment, local);
			transition_out(labelinputfield.$$.fragment, local);
			transition_out(colorpicker.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
				detach(t3);
				detach(t4);
			}

			destroy_component(labelinfofield0, detaching);
			destroy_component(labelinfofield1, detaching);
			destroy_component(labelinfofield2, detaching);
			destroy_component(labelinfofield3, detaching);
			destroy_component(labelinputfield, detaching);
			destroy_component(colorpicker, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _color, _onColor, _runtime, _saved, _created, _version, _path*/ 4350) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// the popup box
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// The local data
	let _path, _created, _version, _saved, _color, _runtime, _onColor;

	onMount(() => {
		// send the box div
		tx.send('modal div', box.div);
	});

	const handlers = {
		// Settings is the link header of the document
		"-> show"({ title, path, settings, pos, ok, cancel, onColor }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(0, box.ok = ok ? () => ok(_runtime) : null, box);
			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			// The field settings
			$$invalidate(1, _path = path);

			$$invalidate(3, _version = settings.version);
			$$invalidate(2, _created = settings.created);
			$$invalidate(4, _saved = settings.saved);
			$$invalidate(6, _runtime = settings.runtime);
			$$invalidate(5, _color = settings.style.rgb);
			$$invalidate(7, _onColor = onColor);

			// and show
			box.show(pos);
		}
	};

	function labelinputfield_input_binding(value) {
		_runtime = value;
		$$invalidate(6, _runtime);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(8, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(9, sx = $$props.sx);
	};

	return [
		box,
		_path,
		_created,
		_version,
		_saved,
		_color,
		_runtime,
		_onColor,
		tx,
		sx,
		handlers,
		labelinputfield_input_binding
	];
}

class Document_settings extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { tx: 8, sx: 9, handlers: 10 });
	}

	get handlers() {
		return this.$$.ctx[10];
	}
}

const maxColSize = 20;

function alfa(str) {
return str
}

function NodeList(tx) {

    this.tx = tx;

    // cols is an array of arrays
    this.cols = [];
    this.xyLocal = {x:0, y:0};

}
NodeList.prototype = {

    // a function to init the cols array - just counts the number of columns that are required
    init(libMap) {

        // reset 
        this.cols = [];

        // the nr of cols we have so far
        let colNr = 0;

        // the size remaining in a col
        let colRemaining = maxColSize;

        // all the first level nodes in the links
        for(const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

            // if we have enough place for the entire linkmap, we add it to the current column
            const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;
        }

        // set the nr of cols
        colNr++;
        while (colNr-- > 0) this.cols.push([]);
    },

    fill(libMap) {

        // notation
        const cols = this.cols;

        // The col nr 
        let colNr = 0;

        // The remaining size in the col
        let colRemaining = maxColSize;

        // make the cols to display
        for (const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

           // if we have enough place for the entire linkmap, we add it to the current column
           const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;

            // The name of the library comes first
            cols[colNr].push({nextModel:true, model, expanded:true});

            // The nodes in the library
            if (model.raw.root.nodes) 
                for (const node of model.raw.root.nodes) cols[colNr].push({model, node, expanded:false});
            else 
                cols[colNr].push({model, node: model.raw.root, expanded:false});
        }
    },

    onRemoveLib(e) {

        // get the index of the node clicked
        const iCol  = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;

        // get the model in the table
        const entry = this.cols[iCol]?.[iNode];
    
        // check
        if ( ! entry?.nextModel ) return

        // message with file to remove
        this.tx.send('remove file', {model: entry.model});
    },
    
    addLib(e) {
    
        const pos = {x:e.screenX, y:e.screenY};
        this.tx.send('get path',  { title:'add file to node library', 
                                    path:null, 
                                    pos,
                                    ok:(userPath) => {
                                        this.tx.send('add file',userPath);
                                    },
                                    cancel:null
                                });
    },

    onSelect(e, box){

        // hide the modal box
        box.hide();
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
        const iSub = e.target.parentNode.dataset?.sub;
    
        // get the model
        const model = this.cols[iCol][iNode].model;

        // by default the groupName is empty
        let groupName = '';
    
        // get the node in the col
        let rawNode = this.cols[iCol][iNode].node;
    
        // if a subnode was selected, get it and save the groupNode
        if (iSub) {
            groupName = rawNode.group;
            rawNode = rawNode.nodes.find( (sub,i) => i==iSub);
        }
    
        // check
        if (!rawNode) return

        // the name of the selected node
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock;

        // make the full node name
        const nodePath = groupName.length == 0 ? nodeName : groupName + '|' + nodeName;
    
        // return the selected node to the 
        this.tx.send("selected node",{model, nodePath, xyLocal:this.xyLocal});
    },
    
    onArrowClick(e) {
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
    
        // toggle the expanded boolean...
        this.cols[iCol][iNode].expanded = !this.cols[iCol][iNode].expanded;
    }

};

/* popups\node-selector.svelte generated by Svelte v4.2.19 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[8] = list[i];
	child_ctx[10] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	child_ctx[13] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[14] = list[i];
	child_ctx[16] = i;
	return child_ctx;
}

// (215:41) 
function create_if_block_2(ctx) {
	let if_block_anchor;

	function select_block_type_2(ctx, dirty) {
		if (/*entry*/ ctx[11].node.source) return create_if_block_3;
		if (/*entry*/ ctx[11].node.dock) return create_if_block_4;
		if (/*entry*/ ctx[11].node.group) return create_if_block_5;
	}

	let current_block_type = select_block_type_2(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (205:20) {#if entry.nextModel}
function create_if_block(ctx) {
	let div;
	let show_if;

	function select_block_type_1(ctx, dirty) {
		if (dirty & /*nodeList*/ 1) show_if = null;
		if (show_if == null) show_if = !!(/*entry*/ ctx[11].model.arl?.getExt() === 'js');
		if (show_if) return create_if_block_1;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx, -1);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div = element("div");
			if_block.c();
			attr(div, "class", "arl svelte-kfxdt6");
			attr(div, "data-col", /*iCol*/ ctx[10]);
			attr(div, "data-node", /*iNode*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if_block.m(div, null);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_1(ctx, dirty)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div, null);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if_block.d();
		}
	};
}

// (226:51) 
function create_if_block_5(ctx) {
	let if_block_anchor;

	function select_block_type_3(ctx, dirty) {
		if (/*entry*/ ctx[11].expanded) return create_if_block_6;
		return create_else_block_1;
	}

	let current_block_type = select_block_type_3(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_block.d(detaching);
		}
	};
}

// (221:50) 
function create_if_block_4(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*entry*/ ctx[11].node.dock) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[11].node.dock) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (216:24) {#if entry.node.source}
function create_if_block_3(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*entry*/ ctx[11].node.source) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[11].node.source) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (251:28) {:else}
function create_else_block_1(ctx) {
	let p;
	let i;
	let t1;
	let span0;
	let t2_value = alfa(/*entry*/ ctx[11].node.group) + "";
	let t2;
	let t3;
	let span1;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span0, "class", "node-name svelte-kfxdt6");
			attr(span1, "class", "arrow svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span0);
			append(span0, t2);
			append(p, t3);
			append(p, span1);
			span1.innerHTML = arrowRight;

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span0, "click", /*onArrowClick*/ ctx[4]),
					listen(span0, "keydown", onKeydown),
					listen(span1, "click", /*onArrowClick*/ ctx[4]),
					listen(span1, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[11].node.group) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (227:28) {#if entry.expanded}
function create_if_block_6(ctx) {
	let p;
	let i;
	let t1;
	let span0;
	let t2_value = alfa(/*entry*/ ctx[11].node.group) + "";
	let t2;
	let t3;
	let span1;
	let t4;
	let each_1_anchor;
	let mounted;
	let dispose;
	let each_value_2 = ensure_array_like(/*entry*/ ctx[11].node.nodes);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			t4 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span0, "class", "node-name svelte-kfxdt6");
			attr(span1, "class", "arrow svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span0);
			append(span0, t2);
			append(p, t3);
			append(p, span1);
			span1.innerHTML = arrowDown;
			insert(target, t4, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span0, "click", /*onArrowClick*/ ctx[4]),
					listen(span0, "keydown", onKeydown),
					listen(span1, "click", /*onArrowClick*/ ctx[4]),
					listen(span1, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[11].node.group) + "")) set_data(t2, t2_value);

			if (dirty & /*onSelect, onKeydown, nodeList*/ 9) {
				each_value_2 = ensure_array_like(/*entry*/ ctx[11].node.nodes);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(p);
				detach(t4);
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (244:55) 
function create_if_block_9(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[14].dock) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
			attr(p, "data-sub", /*iSub*/ ctx[16]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[14].dock) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (239:56) 
function create_if_block_8(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[14].group) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
			attr(p, "data-sub", /*iSub*/ ctx[16]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[14].group) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (234:36) {#if sub.source}
function create_if_block_7(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[14].source) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[10]);
			attr(p, "data-node", /*iNode*/ ctx[13]);
			attr(p, "data-sub", /*iSub*/ ctx[16]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[14].source) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (233:32) {#each entry.node.nodes as sub, iSub}
function create_each_block_2(ctx) {
	let if_block_anchor;

	function select_block_type_4(ctx, dirty) {
		if (/*sub*/ ctx[14].source) return create_if_block_7;
		if (/*sub*/ ctx[14].group) return create_if_block_8;
		if (/*sub*/ ctx[14].dock) return create_if_block_9;
	}

	let current_block_type = select_block_type_4(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_4(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (210:24) {:else}
function create_else_block(ctx) {
	let i;
	let t1;
	let p;
	let t2_value = /*entry*/ ctx[11].model.arl.getName() + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "cancel";
			t1 = space();
			p = element("p");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined lib lib-json svelte-kfxdt6");
			attr(p, "class", "lib lib-json svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, i, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onRemoveLib*/ ctx[2]),
					listen(i, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = /*entry*/ ctx[11].model.arl.getName() + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(i);
				detach(t1);
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (207:24) {#if entry.model.arl?.getExt() === 'js'}
function create_if_block_1(ctx) {
	let i;
	let t1;
	let p;
	let t2_value = /*entry*/ ctx[11].model.arl.getName() + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "cancel";
			t1 = space();
			p = element("p");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined lib lib-js svelte-kfxdt6");
			attr(p, "class", "lib lib-js svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, i, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onRemoveLib*/ ctx[2]),
					listen(i, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = /*entry*/ ctx[11].model.arl.getName() + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(i);
				detach(t1);
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (204:16) {#each col as entry, iNode}
function create_each_block_1(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*entry*/ ctx[11].nextModel) return create_if_block;
		if (/*entry*/ ctx[11].node) return create_if_block_2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (202:8) {#each nodeList.cols as col, iCol}
function create_each_block(ctx) {
	let div;
	let t;
	let each_value_1 = ensure_array_like(/*col*/ ctx[8]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			attr(div, "class", "column svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList, onRemoveLib, onKeydown, onSelect, onArrowClick, arrowDown, arrowRight*/ 29) {
				each_value_1 = ensure_array_like(/*col*/ ctx[8]);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, t);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (200:0) <PopupBox box = {box}>
function create_default_slot(ctx) {
	let div;
	let each_value = ensure_array_like(/*nodeList*/ ctx[0].cols);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "content svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList, onRemoveLib, onKeydown, onSelect, onArrowClick, arrowDown, arrowRight*/ 29) {
				each_value = ensure_array_like(/*nodeList*/ ctx[0].cols);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[1],
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};

			if (dirty & /*$$scope, nodeList*/ 131073) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

const arrowRight = "&#9656;";
const arrowDown = "&#9662;";

function onKeydown(e) {
	
}

function instance($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;
	let nodeList = new NodeList(tx);

	let box = {
		div: null,
		title: 'Select Node',
		pos: null,
		ok: null,
		cancel: null,
		add: e => nodeList.addLib(e)
	};

	onMount(async () => {
		// send the box div
		tx.send('modal div', box.div);
	});

	const handlers = {
		onBuildTable(libMap) {
			nodeList.init(libMap);
			nodeList.fill(libMap);

			// if visible, refresh
			if (box.div?.style.display == 'block') $$invalidate(0, nodeList);
		},
		onShow({ xyScreen, xyLocal }) {
			// save the coord where the node will be created 
			$$invalidate(0, nodeList.xyLocal.x = xyLocal.x, nodeList);

			$$invalidate(0, nodeList.xyLocal.y = xyLocal.y, nodeList);

			//show the box at the right coordinates
			box.show({ x: xyScreen.x + 10, y: xyScreen.y + 10 });
		}
	};

	function onRemoveLib(e) {
		nodeList.onRemoveLib(e);
		$$invalidate(0, nodeList);
	}

	function onSelect(e) {
		nodeList.onSelect(e, box);
		$$invalidate(0, nodeList);
	}

	function onArrowClick(e) {
		nodeList.onArrowClick(e);
		$$invalidate(0, nodeList);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(5, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(6, sx = $$props.sx);
	};

	return [nodeList, box, onRemoveLib, onSelect, onArrowClick, tx, sx, handlers];
}

class Node_selector extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { tx: 5, sx: 6, handlers: 7 });
	}

	get handlers() {
		return this.$$.ctx[7];
	}
}

// Returns a factory function for the svelte component
function getFactory( svelteDef, htmlTarget=null) {
	return function (tx, sx) {

		const component = new svelteDef({
			target: htmlTarget ?? document.createElement('div'),
			props: {
				tx, sx, handlers:null
			}
		});
		return component.handlers
	}
}
const VscodeSideMenuFactory = getFactory(Vscode_side_menu);
const RuntimeSettingsFactory = getFactory(Runtime_settings);
const ConfirmBox = getFactory(Confirm_box);
const ContextMenuFactory = getFactory(Context_menu);
const JsonInputFactory = getFactory(Json_area_input);
const TextBlockFactory = getFactory(Text_area_input);
const PinProfileFactory = getFactory(Pin_profile);
const NameAndPathFactory = getFactory(Name_path);
const PathRequestFactory = getFactory(Path);
const DocumentSettingsFactory = getFactory(Document_settings);
const NodeSelectorFactory = getFactory(Node_selector);

// ------------------------------------------------------------------
// Model: webview
// Path: webview.js
// Creation date 9/9/2025, 10:01:18 AM
// ------------------------------------------------------------------


//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "tcTH", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"-> floating menu",
		"-> canvas",
		"-> modal div",
		"=> clipboard remote",
		"-> clipboard switch"
		],
	outputs: [
		"set document -> set document @ editor (QCIF)",
		"get document -> ()",
		"sync model -> sync model @ editor (QCIF)",
		"canvas resize -> size change @ editor (QCIF)",
		"clipboard local => local @ clipboard (ziWn)",
		"clipboard switched -> switched @ clipboard (ziWn)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "LfSD", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "VUTh", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "AykR", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (tcTH)",
		"accept changes -> accept changes @ editor (QCIF)",
		"recalibrate -> recalibrate @ editor (QCIF)",
		"sync -> sync model @ editor (QCIF)",
		"grid on-off -> grid on-off @ editor (QCIF)",
		"show settings -> show settings @ editor (QCIF)",
		"set save point -> save point set @ editor (QCIF)",
		"back to save point -> save point back @ editor (QCIF)",
		"make lib -> make lib @ editor (QCIF)",
		"make app -> make app @ editor (QCIF)"
		],
	sx:	[
		    {
		        "icon": "flare",
		        "color": "#0fb2e4",
		        "message": "recalibrate",
		        "help": "Recalibrate"
		    },
		    {
		        "icon": "grid_view",
		        "color": "#0fb2e4",
		        "message": "grid on-off",
		        "help": "Grid on/off"
		    },
		    {
		        "icon": "check_box",
		        "color": "#0fb2e4",
		        "message": "accept changes",
		        "help": "Accept changes"
		    },
		    {
		        "icon": "bolt",
		        "color": "#0fb2e4",
		        "message": "sync",
		        "help": "sync model"
		    },
		    {
		        "icon": "push_pin",
		        "color": "#0fb2e4",
		        "message": "set save point",
		        "help": "set save point"
		    },
		    {
		        "icon": "reply",
		        "color": "#0fb2e4",
		        "message": "back to save point",
		        "help": "back to save point"
		    },
		    {
		        "icon": "build",
		        "color": "#0fb2e4",
		        "message": "make lib",
		        "help": "Make lib"
		    },
		    {
		        "icon": "handyman",
		        "color": "#0fb2e4",
		        "message": "make app",
		        "help": "Make app"
		    },
		    {
		        "icon": "settings",
		        "color": "#0fb2e4",
		        "message": "show settings",
		        "help": "Settings"
		    }
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "RxHm", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "vGtR", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "sWeZ", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//____________________________________________PROFILE SETTINGS
	{
	name: "profile settings", 
	uid: "MCNa", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "NKtq", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (QCIF)",
		"remove file -> remove file @ library manager (MBWr)",
		"add file -> add file @ library manager (MBWr)",
		"get path -> path @ path request (CtPY)",
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "MBWr", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (NKtq)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "CtPY", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "oNKd", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "ziWn", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> clipboard switch @ message broker (tcTH)",
		"remote => clipboard remote @ message broker (tcTH)"
		]
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "QCIF", 
	factory: EditorFactory,
	inputs: [
		"-> accept changes",
		"-> recalibrate",
		"-> sync model",
		"-> grid on-off",
		"-> show settings",
		"-> set document",
		"-> save point set",
		"-> save point back",
		"-> make lib",
		"-> make app",
		"-> run app",
		"-> run app in iframe",
		"-> selected node",
		"-> size change"
		],
	outputs: [
		"open document -> open document @ message broker (tcTH)",
		"document settings -> show @ doc settings (oNKd)",
		"save point confirm -> show @ confirm box (fUdS)",
		"new edit -> new edit @ message broker (tcTH)",
		"show lib path -> path @ path request (VUTh)",
		"show app path -> path @ path request (VUTh)",
		"run -> ()",
		"open source file -> open js file @ message broker (tcTH)",
		"show context menu -> context menu @ context menu (LfSD)",
		"runtime settings -> show @ runtime settings (nFTC)",
		"settings -> json @ node settings (vGtR)",
		"show link -> name and path @ name and path (sWeZ)",
		"show router -> name and path @ name and path (sWeZ)",
		"show factory -> name and path @ name and path (sWeZ)",
		"node comment -> text @ text block (RxHm)",
		"pin profile -> show @ profile settings (MCNa)",
		"clipboard get => get @ clipboard (ziWn)",
		"clipboard set -> set @ clipboard (ziWn)",
		"select node -> show @ node selector (NKtq)",
		"change library -> switch library @ library manager (MBWr)",
		"add lib file -> ()",
		"canvas -> canvas @ message broker (tcTH)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "fUdS", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "nFTC", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
];

//The routers
const filterList = [
];

// prepare the runtime
const runtime = scaffold(nodeList, filterList);

// and start the app
runtime.start();
//# sourceMappingURL=webview-bundle.js.map
