import {ARL, Path} from '../../core/types/arl/index.js'
import {adaptARL, vscode} from '../webview/arl-adapter.js'
import {adaptConsole} from '../webview/console-adapter.js'

const LOGVSCODE = 0x1

function emptySystem(name = 'System') {
    const now = new Date().toISOString()
    return {
        header: {
            version: '1.11.0',
            name,
            created: now,
            saved: now,
            utc: now,
        },
        nodes: [],
        connections: [],
        references: [],
        view: {offset: {x: 0, y: 0}, zoom: 1},
    }
}

/** @node system message broker */
export function SystemMessageBroker(tx) {
    this.tx = tx
    this.activeArl = null
    this.latestSnapshot = null
    this.lastDocument = null
    this.savePending = false
    this.historyPending = false
    this.resizing = 0
    this.documentFlags = 0

    adaptConsole()
    adaptARL()

    window.addEventListener('message', event => this.onMessage(event))
    window.addEventListener('keydown', event => this.interceptKeys(event), true)
    vscode.postMessage({verb: 'ready'})
}

SystemMessageBroker.prototype = {
    interceptKeys(event) {
        const modifier = event.ctrlKey || event.metaKey
        if (modifier && !event.altKey && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            event.stopImmediatePropagation()
            vscode.postMessage({verb: event.shiftKey ? 'redo document' : 'undo document'})
            return
        }
        if (modifier && !event.altKey && event.key.toLowerCase() === 'y') {
            event.preventDefault()
            event.stopImmediatePropagation()
            vscode.postMessage({verb: 'redo document'})
            return
        }

        if (['Delete', 'Enter', 'Escape'].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
        }
    },

    makeArl(uri) {
        try {
            const url = new URL(uri)
            const arl = new ARL(Path.normalizeSeparators(decodeURIComponent(url.pathname)))
            arl.url = uri
            return arl
        }
        catch {
            const normalized = Path.normalizeSeparators(uri)
            const arl = new ARL(normalized)
            arl.url = uri
            return arl
        }
    },

    documentName(arl) {
        const split = Path.getSplit(arl.getPath())
        return split.name.replace(/\.sys$/, '') || 'System'
    },

    setActiveDocument(arl, model) {
        this.activeArl = arl
        this.latestSnapshot = null
        this.lastDocument = null
        this.tx.send('sysblu.set', {kind: 'sysblu', arl, model})
    },

    async onMessage(event) {
        const message = event.data
        if (this.documentFlags & LOGVSCODE) console.log(`vscodex sysblu ~~~> [${message.verb}]`)

        switch (message.verb) {
            case 'open main': {
                const arl = this.makeArl(message.uri)
                this.setActiveDocument(arl)
                vscode.postMessage({verb: 'start system watcher', system: arl})
                return
            }

            case 'new main': {
                const arl = this.makeArl(message.uri)
                this.setActiveDocument(arl, emptySystem(this.documentName(arl)))
                return
            }

            case 'save request': {
                if (message.uri) {
                    const target = this.makeArl(message.uri)
                    const document = this.latestSnapshot?.document
                    if (!document) {
                        vscode.postMessage({verb: 'file save failed', error: 'There is no system document to save.'})
                        return
                    }

                    const body = JSON.stringify(document, null, 2)
                    try {
                        await target.save(body)
                        vscode.postMessage({verb: 'file saved'})
                    }
                    catch (error) {
                        vscode.postMessage({verb: 'file save failed', error: error?.message ?? String(error)})
                    }
                    return
                }

                this.savePending = true
                this.tx.send('sysblu.save')
                return
            }

            case 'visible':
                return

            case 'system changed':
                if (this.activeArl) this.setActiveDocument(this.activeArl)
                return

            case 'host undo':
                this.historyPending = true
                this.tx.send('sysblu.undo')
                return

            case 'host redo':
                this.historyPending = true
                this.tx.send('sysblu.redo')
                return

            case 'documentFlags':
                this.documentFlags = message.flags
                return

            case '200':
            case '404': {
                const {promiseMap} = await import('../webview/arl-adapter.js')
                const resolve = promiseMap.get(message.rqKey)
                if (!resolve) return
                resolve(message.content)
                promiseMap.delete(message.rqKey)
                return
            }

            default:
                console.log(`System message broker: "${message.verb}" is unknown`)
        }
    },

    onCanvas(canvas) {
        document.documentElement.className = 'dark common'
        canvas.style.width = '100vw'
        canvas.style.height = '100vh'
        document.body.append(canvas)
        canvas.focus()

        const resize = () => {
            if (this.resizing) return
            this.resizing = requestAnimationFrame(() => {
                this.resizing = 0
                this.tx.send('size change', {
                    w: Math.round(window.innerWidth),
                    h: Math.round(window.innerHeight),
                    dpr: window.devicePixelRatio || 1,
                })
            })
        }

        window.addEventListener('resize', resize, {passive: true})
        resize()
    },

    onFloatingMenu(menu) {
        document.body.append(menu)
    },

    onSave() {
        vscode.postMessage({verb: 'save document'})
    },

    onModalDiv(modal) {
        document.body.append(modal)
    },

    onSystemUpdated(snapshot) {
        const serialized = snapshot?.document ? JSON.stringify(snapshot.document) : null
        const changed = serialized !== null && this.lastDocument !== null && serialized !== this.lastDocument

        this.latestSnapshot = snapshot
        if (changed && snapshot.dirty && !this.historyPending) vscode.postMessage({verb: 'report edit', edit: 'Edit system'})
        this.historyPending = false
        this.lastDocument = serialized

        if (this.savePending && snapshot && !snapshot.dirty) {
            this.savePending = false
            vscode.postMessage({verb: 'file saved'})
        }
    },

    onSysbluLoaded() {},

    onSysbluDiagnostics(diagnostics) {
        vscode.postMessage({verb: 'system diagnostics', diagnostics})
    },

    onSysbluFailed() {
        if (this.savePending) {
            this.savePending = false
            vscode.postMessage({verb: 'file save failed', error: 'The system document could not be saved.'})
        }
    },

    onOpenReference(reference) {
        vscode.postMessage({verb: 'open reference', reference})
    },

    onExecuteCommand(request) {
        vscode.postMessage({verb: 'execute command', request})
    },
}
