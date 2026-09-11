import {EditorState} from '@codemirror/state'
import {EditorView, keymap} from '@codemirror/view'
import {basicSetup} from 'codemirror'
import {javascript} from '@codemirror/lang-javascript'
import {json} from '@codemirror/lang-json'
import {markdown} from '@codemirror/lang-markdown'
import {css} from '@codemirror/lang-css'
import {html} from '@codemirror/lang-html'
import MarkdownIt from 'markdown-it'

const markdownRenderer = new MarkdownIt({html: false, linkify: true})

export function renderMarkdown(text) {
    return markdownRenderer.render(text)
}

export function isMarkdownFile(name = '') {
    return ['md', 'markdown'].includes(extensionOf(name))
}

const BINARY_EXTENSIONS = new Set([
    'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'pdf', 'png', 'webp',
    'mp3', 'mp4', 'ogg', 'wav', 'webm', 'woff', 'woff2', 'zip'
])

const editorTheme = EditorView.theme({
    '&': {height: '100%', backgroundColor: '#121212', color: '#ddd'},
    '.cm-scroller': {fontFamily: 'Consolas, "Courier New", monospace'},
    '.cm-content': {caretColor: '#fff'},
    '.cm-gutters': {backgroundColor: '#181818', color: '#858585', border: 'none'},
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

        this.toolbar = document.createElement('div')
        this.toolbar.className = 'vmblu-text-editor-toolbar'
        this.toolbar.hidden = true
        this.toggle = document.createElement('button')
        this.toggle.type = 'button'
        this.toggle.textContent = 'Preview'
        this.toggle.title = 'Toggle Markdown preview (Ctrl+Shift+V / Cmd+Shift+V)'
        this.toggle.setAttribute('aria-pressed', 'false')
        this.toggle.addEventListener('click', () => this.togglePreview())
        this.toolbar.append(this.toggle)
        this.root.append(this.toolbar)

        this.host = document.createElement('div')
        this.host.className = 'vmblu-text-editor-host'
        this.root.append(this.host)

        this.preview = document.createElement('article')
        this.preview.className = 'vmblu-markdown-preview'
        this.preview.tabIndex = 0
        this.preview.setAttribute('aria-label', 'Markdown preview')
        this.preview.hidden = true
        this.root.append(this.preview)
        this.previewing = false
        this.root.addEventListener('keydown', (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return
            if (event.shiftKey && event.key.toLowerCase() === 'v' && this.active && isMarkdownFile(this.active.name)) {
                event.preventDefault()
                event.stopPropagation()
                this.togglePreview()
            } else if (this.previewing && !event.shiftKey && event.key.toLowerCase() === 's') {
                event.preventDefault()
                event.stopPropagation()
                this.saveActive()
            }
        }, true)

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
            .vmblu-text-editor { display:flex; flex-direction:column; width:100%; height:100%; background:#121212; }
            .vmblu-text-editor-host { flex:1; min-height:0; overflow:hidden; }
            .vmblu-text-editor-host .cm-editor { height:100%; }
            .vmblu-text-editor-message { margin:1rem; color:#bbb; font:0.9rem Arial, sans-serif; }
            .vmblu-text-editor [hidden] { display:none !important; }
            .vmblu-text-editor-toolbar { display:flex; justify-content:flex-end; padding:6px 12px; border-bottom:1px solid #303030; }
            .vmblu-text-editor-toolbar button { color:#ddd; background:#252526; border:1px solid #555; border-radius:4px; padding:4px 12px; cursor:pointer; }
            .vmblu-text-editor-toolbar button:focus-visible, .vmblu-markdown-preview:focus-visible { outline:2px solid #75baff; outline-offset:-2px; }
            .vmblu-markdown-preview { flex:1; min-height:0; overflow:auto; padding:24px 32px; color:#ddd; font:16px/1.6 system-ui, sans-serif; overflow-wrap:anywhere; }
            .vmblu-markdown-preview > :first-child { margin-top:0; }
            .vmblu-markdown-preview h1, .vmblu-markdown-preview h2 { border-bottom:1px solid #333; padding-bottom:0.3em; }
            .vmblu-markdown-preview h1, .vmblu-markdown-preview h2, .vmblu-markdown-preview h3, .vmblu-markdown-preview h4, .vmblu-markdown-preview h5, .vmblu-markdown-preview h6 { color:#eee; font-weight:600; line-height:1.3; }
            .vmblu-markdown-preview h4 { font-size:1em; }
            .vmblu-markdown-preview a { color:#80bfff; }
            .vmblu-markdown-preview pre { overflow:auto; padding:16px; background:#1e1e1e; border-radius:5px; }
            .vmblu-markdown-preview code { font-family:Consolas, "Courier New", monospace; background:#252526; padding:0.15em 0.3em; border-radius:3px; }
            .vmblu-markdown-preview pre code { padding:0; background:none; }
            .vmblu-markdown-preview blockquote { margin-left:0; padding-left:16px; border-left:4px solid #555; color:#aaa; }
            .vmblu-markdown-preview table { border-collapse:collapse; display:block; overflow:auto; }
            .vmblu-markdown-preview th, .vmblu-markdown-preview td { border:1px solid #444; padding:6px 12px; }
            .vmblu-markdown-preview img { max-width:100%; }
            .vmblu-markdown-preview hr { border:0; border-top:1px solid #444; }
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
        this.closePreview()
        this.toolbar.hidden = true
        this.host.replaceChildren()
        const element = document.createElement('p')
        element.className = 'vmblu-text-editor-message'
        element.textContent = message
        this.host.append(element)
    }

    restoreEditor() {
        if (!this.host.contains(this.view.dom)) this.host.replaceChildren(this.view.dom)
    }

    closePreview() {
        this.previewing = false
        this.preview.hidden = true
        this.host.hidden = false
        this.toggle.textContent = 'Preview'
        this.toggle.setAttribute('aria-pressed', 'false')
    }

    togglePreview() {
        if (!this.active || !isMarkdownFile(this.active.name)) return
        if (this.previewing) {
            this.closePreview()
            this.view.requestMeasure()
            this.view.focus()
            this.view.scrollDOM.scrollTop = this.editorScroll.top
            this.view.scrollDOM.scrollLeft = this.editorScroll.left
            return
        }
        this.editorScroll = {top: this.view.scrollDOM.scrollTop, left: this.view.scrollDOM.scrollLeft}
        this.preview.innerHTML = renderMarkdown(this.view.state.doc.toString())
        for (const link of this.preview.querySelectorAll('a')) {
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
        }
        this.previewing = true
        this.host.hidden = true
        this.preview.hidden = false
        this.preview.scrollTop = 0
        this.toggle.textContent = 'Edit source'
        this.toggle.setAttribute('aria-pressed', 'true')
        this.preview.focus()
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
        this.closePreview()
        this.toolbar.hidden = true
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
            this.toolbar.hidden = !isMarkdownFile(session.name)
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
