import {EditorState} from '@codemirror/state'
import {EditorView, keymap} from '@codemirror/view'
import {basicSetup} from 'codemirror'
import {javascript} from '@codemirror/lang-javascript'
import {json} from '@codemirror/lang-json'
import {markdown} from '@codemirror/lang-markdown'
import {css} from '@codemirror/lang-css'
import {html} from '@codemirror/lang-html'

const BINARY_EXTENSIONS = new Set([
    'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'pdf', 'png', 'webp',
    'mp3', 'mp4', 'ogg', 'wav', 'webm', 'woff', 'woff2', 'zip'
])

const editorTheme = EditorView.theme({
    '&': {height: '100%', backgroundColor: '#1e1e1e', color: '#ddd'},
    '.cm-scroller': {fontFamily: 'Consolas, "Courier New", monospace'},
    '.cm-content': {caretColor: '#fff'},
    '.cm-gutters': {backgroundColor: '#252526', color: '#858585', border: 'none'},
    '&.cm-focused .cm-cursor': {borderLeftColor: '#fff'},
    '&.cm-focused .cm-selectionBackground, ::selection': {backgroundColor: '#264f78'}
}, {dark: true})

function extensionOf(name = '') {
    const dot = name.lastIndexOf('.')
    return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

export function isTextFile(name = '') {
    return !BINARY_EXTENSIONS.has(extensionOf(name))
}

export function languageForFile(name = '') {
    const ext = extensionOf(name)

    if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return javascript({jsx: ext === 'jsx'})
    if (['ts', 'mts', 'cts', 'tsx'].includes(ext)) return javascript({typescript: true, jsx: ext === 'tsx'})
    if (ext === 'json' || name.endsWith('.mod.blu') || name.endsWith('.mod.viz') || name.endsWith('.src.prf')) return json()
    if (['md', 'markdown'].includes(ext)) return markdown()
    if (ext === 'css') return css()
    if (['html', 'htm', 'svelte'].includes(ext)) return html()

    return []
}

function arlKey(arl) {
    return arl?.url?.href ?? arl?.getFullPath?.() ?? arl?.getPath?.() ?? String(arl)
}

function documentArl(doc) {
    return doc?.getArl?.() ?? doc?.arl ?? null
}

class TextEditorController {
    constructor(tx) {
        this.tx = tx
        this.sessions = new Map()
        this.active = null
        this.loadSequence = 0

        this.root = document.createElement('section')
        this.root.className = 'vmblu-text-editor'

        this.host = document.createElement('div')
        this.host.className = 'vmblu-text-editor-host'
        this.root.append(this.host)

        this.installStyles()
        this.view = new EditorView({
            state: this.makeState({name: '', arl: null, text: '', readOnly: true}),
            parent: this.host
        })
    }

    installStyles() {
        if (document.getElementById('vmblu-text-editor-style')) return

        const style = document.createElement('style')
        style.id = 'vmblu-text-editor-style'
        style.textContent = `
            .vmblu-text-editor { display:flex; flex-direction:column; width:100%; height:100%; background:#1e1e1e; }
            .vmblu-text-editor-host { flex:1; min-height:0; overflow:hidden; }
            .vmblu-text-editor-host .cm-editor { height:100%; }
            .vmblu-text-editor-message { margin:1rem; color:#bbb; font:0.9rem Arial, sans-serif; }
        `
        document.head.append(style)
    }

    makeState(session) {
        return EditorState.create({
            doc: session.text ?? '',
            extensions: [
                basicSetup,
                editorTheme,
                languageForFile(session.name),
                EditorState.readOnly.of(session.readOnly),
                EditorView.editable.of(!session.readOnly),
                EditorView.updateListener.of((update) => {
                    session.state = update.state
                    if (update.docChanged) {
                        session.dirty = true
                    }
                }),
                keymap.of([{
                    key: 'Mod-s',
                    preventDefault: true,
                    run: () => {
                        this.saveActive()
                        return true
                    }
                }])
            ]
        })
    }

    makeSession(arl, text) {
        const session = {
            arl,
            name: arl?.getName?.() ?? 'text',
            text: text ?? '',
            readOnly: arl?.canWrite?.() === false,
            dirty: false,
            state: null
        }
        session.state = this.makeState(session)
        return session
    }

    showMessage(message) {
        this.host.replaceChildren()
        const element = document.createElement('p')
        element.className = 'vmblu-text-editor-message'
        element.textContent = message
        this.host.append(element)
    }

    restoreEditor() {
        if (!this.host.contains(this.view.dom)) this.host.replaceChildren(this.view.dom)
    }

    revealLine(line) {
        if (!Number.isInteger(line) || line < 1 || !this.view.state.doc.lines) return
        const target = this.view.state.doc.line(Math.min(line, this.view.state.doc.lines))
        this.view.dispatch({
            selection: {anchor: target.from},
            effects: EditorView.scrollIntoView(target.from, {y: 'center'})
        })
        this.view.focus()
    }

    async onTextSetActive(doc) {
        const sequence = ++this.loadSequence
        this.active = null
        if (!doc) return

        const arl = documentArl(doc)
        const name = arl?.getName?.() ?? ''

        if (!arl || !isTextFile(name)) {
            this.showMessage('This file is not a supported text document.')
            this.tx.send('content div', this.root)
            if (arl) this.tx.send('text.failed', arl)
            return
        }

        const key = arlKey(arl)
        let session = this.sessions.get(key)

        try {
            if (!session) {
                const text = await arl.get('text')
                session = this.makeSession(arl, text ?? '')
                this.sessions.set(key, session)
            }

            if (sequence !== this.loadSequence) return

            this.active = session
            this.restoreEditor()
            this.view.setState(session.state)
            this.tx.send('content div', this.root)
            this.revealLine(doc.line)
            this.tx.send('text.loaded', arl)
        }
        catch (error) {
            if (sequence !== this.loadSequence) return
            console.error(`Could not open text file ${name}:`, error)
            this.showMessage(error?.message ?? 'The text file could not be loaded.')
            this.tx.send('content div', this.root)
            this.tx.send('text.failed', arl)
        }
    }

    async saveActive() {
        const session = this.active
        if (!session) return

        if (session.readOnly) {
            return
        }

        try {
            await session.arl.save(session.state.doc.toString())
            session.dirty = false
        }
        catch (error) {
            console.error(`Could not save text file ${session.name}:`, error)
        }
    }
}

/**
 * @node text editor
 */
export function TextEditor(tx, sx) {
    const controller = new TextEditorController(tx)

    return {
        onTextSetActive: (doc) => controller.onTextSetActive(doc),
        onTextSave: () => controller.saveActive()
    }
}
