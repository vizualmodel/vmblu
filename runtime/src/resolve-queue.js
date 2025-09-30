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
}

// Handler that wraps one or more Deferreds in a thenable ifPins
export function PromiseHandler(defs) {
    
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
}
  
// Queue that manages PromiseHandlers for message replies
export function ResolveQueue() {

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
}
  