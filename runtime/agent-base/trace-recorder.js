export class TraceRecorder {
    constructor({clock = () => new Date()} = {}) {
        this.clock = clock
        this.records = []
        this.listeners = new Set()
        this.nextId = 1
    }

    record(entry) {
        const record = {
            traceId: entry?.traceId ?? `trace_${String(this.nextId++).padStart(6, '0')}`,
            timestamp: entry?.timestamp ?? this.clock().toISOString(),
            type: entry?.type ?? 'trace',
            ...entry,
        }
        this.records.push(record)
        this.emit(record)
        return record
    }

    all() {
        return this.records.slice()
    }

    clear() {
        this.records.length = 0
    }

    subscribe(listener) {
        if (typeof listener !== 'function') throw new Error('Trace listener must be a function')
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    emit(record) {
        for (const listener of this.listeners) listener(record)
    }
}
