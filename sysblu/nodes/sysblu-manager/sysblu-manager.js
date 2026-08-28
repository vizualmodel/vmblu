import {Sysmod} from './sysmod.js'
import {
    arlFromActive,
    cloneSystemDocument,
    documentFromActive,
    validateSystemDocument,
} from './system-document.js'

/**
 * @node sysblu manager
 */
export function SysbluManager(tx, sx = {}) {
    this.tx = tx
    this.sx = sx
    this.document = null
    this.arl = null
    this.sysmod = new Sysmod(this, {limit: sx?.historyLimit ?? 31})
}

SysbluManager.prototype = {
    validate(document) {
        return validateSystemDocument(document)
    },

    /** @param {ActiveDocument} active */
    async onSysbluSet(active) {
        if (!active) {
            this.document = null
            this.arl = null
            this.sysmod.reset()
            this.publish()
            return
        }

        this.arl = arlFromActive(active)

        try {
            let document = documentFromActive(active)
            if (!document && this.arl?.get) document = await this.arl.get('json')

            const validation = validateSystemDocument(document)
            if (!validation.ok) throw new Error(validation.errors.join(' '))

            this.document = cloneSystemDocument(document)
            this.sysmod.reset()
            this.publish()
            this.tx.send('sysblu.diagnostics', {arl: this.arl, errors: []})
            this.tx.send('sysblu.loaded', this.arl)
        }
        catch (error) {
            this.document = null
            this.sysmod.reset()
            console.error(`Could not load sysblu document ${this.arl?.getPath?.() ?? ''}:`, error)
            this.tx.send('sysblu.diagnostics', {arl: this.arl, errors: [error.message]})
            this.tx.send('sysblu.failed', this.arl)
        }
    },

    async onSysbluSave() {
        if (!this.document || !this.arl?.save) return null
        if (this.arl.canWrite?.() === false) {
            this.tx.send('sysblu.failed', this.arl)
            return null
        }

        const timestamp = new Date().toISOString()
        this.sysmod.updateHeader({saved: timestamp, utc: timestamp})
        const text = JSON.stringify(this.document, null, 2)

        try {
            await this.arl.save(text)
            this.sysmod.markClean()
            this.publish()
            return text
        }
        catch (error) {
            console.error(`Could not save sysblu document ${this.arl?.getPath?.() ?? ''}:`, error)
            this.tx.send('sysblu.failed', this.arl)
            return null
        }
    },

    /** @param {SysmodDoit} command */
    onSysmodDoit(command = {}) {
        const {verb, param} = command
        if (!verb) return
        this.applySysmod(() => this.sysmod.doit(verb, param), verb)
    },

    onSysmodUndo() {
        this.applySysmod(() => this.sysmod.undo(), 'undo')
    },

    onSysmodRedo() {
        this.applySysmod(() => this.sysmod.redo(), 'redo')
    },

    applySysmod(operation, fallbackVerb) {
        try {
            const result = operation()
            if (result.changed) this.publish()
            this.tx.send('sysmod.done', {
                verb: result.verb || fallbackVerb,
                undo: result.undo,
                redo: result.redo,
                dirty: result.dirty,
            })
        }
        catch (error) {
            console.error(`Could not apply sysmod action ${fallbackVerb}:`, error)
            this.tx.send('sysmod.done', {
                ...this.sysmod.status(),
                verb: fallbackVerb,
                error: error.message,
            })
        }
    },

    publish() {
        this.tx.send('system.updated', {
            document: cloneSystemDocument(this.document),
            arl: this.arl,
            dirty: this.sysmod.isDirty(),
        })
    },
}
