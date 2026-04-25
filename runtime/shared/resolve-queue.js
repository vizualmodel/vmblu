// Deferred wrapper around a Promise
function Deferred() {

    this.promise = new Promise((resolve, reject) => {
        this._resolve = resolve
        this._reject = reject
    })
}
Deferred.prototype = {

    resolve(value) {
        this._resolve(value)
    },

    reject(error) {
        this._reject(error)
    }
}

export function PromiseHandler(defs) {
    this.defs = defs
}
PromiseHandler.prototype = {

    then(onFulfilled, onRejected) {
        const newDefs = this.defs.map(deferred => {
            const next = new Deferred()
            deferred.promise
                .then(onFulfilled, onRejected)
                .then(next.resolve.bind(next), next.reject.bind(next))
            return next
        })
        return new PromiseHandler(newDefs)
    },

    catch(onRejected) {
        const newDefs = this.defs.map(deferred => {
            const next = new Deferred()
            deferred.promise
                .catch(onRejected)
                .then(next.resolve.bind(next), next.reject.bind(next))
            return next
        })
        return new PromiseHandler(newDefs)
    },

    replace(count) {
        if (count > this.defs.length) {
            for (let i = this.defs.length; i < count; i++) {
                this.defs.push(new Deferred())
            }
        } else if (count < this.defs.length) {
            this.defs.splice(count)
        }
    }
}

export function ResolveQueue() {

    this.minTimeout = 1000
    this.queue = new Map()
}
ResolveQueue.prototype = {

    addPromiseHandler(txRef, timeout, count = 1) {

        const duration = Math.max(timeout, this.minTimeout)
        const defs = Array.from({ length: count }, () => new Deferred())
        const handler = new PromiseHandler(defs)

        this.queue.set(txRef, { handler, time: { start: Date.now(), duration } })
        return handler
    },

    changePromiseHandler(txRef, count) {

        const entry = this.queue.get(txRef)
        if (!entry) return
        entry.handler.replace(count)
    },

    trigger(rxRef, value) {

        const entry = this.queue.get(rxRef)
        if (!entry) return console.log(rxRef, 'NOT FOUND')
        const deferred = entry.handler.defs.shift()
        deferred.resolve(value)
        if (entry.handler.defs.length === 0) {
            this.queue.delete(rxRef)
        }
    },

    checkTimeouts(now = Date.now()) {

        for (const [txRef, entry] of this.queue.entries()) {
            const { start, duration } = entry.time
            if (start + duration <= now) {

                const err = new Error('Reply timeout',  {sender: txRef, msec: duration})

                entry.handler.defs.forEach(deferred => deferred.reject(err))
                this.queue.delete(txRef)
            }
        }
    }
}
