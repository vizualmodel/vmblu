const STORAGE_PREFIX = 'vmblu.rt-agent.overlay.'

export class AgentOverlay {
    constructor({agent, broker = null, traceRecorder = null, config = {}} = {}) {
        this.agent = agent
        this.broker = broker ?? agent?.broker ?? null
        this.traceRecorder = traceRecorder ?? this.broker?.trace ?? null
        this.config = config ?? {}
        this.agentId = agent?.id ?? this.config?.id ?? 'agent'
        this.storageKey = `${STORAGE_PREFIX}${this.agentId}`
        this.messages = []
        this.traceRecords = []
        this.activeTab = 'chat'
        this.theme = this.loadTheme()
        this.dragState = null
        this.resizeObserver = null
        this.unsubscribers = []
        this.elements = {}
    }

    mount() {
        if (typeof document === 'undefined') return this
        if (this.root) return this

        this.injectStyles()
        this.root = document.createElement('div')
        this.root.className = 'vmblu-agent-overlay'
        this.root.innerHTML = this.template()
        document.body.appendChild(this.root)

        this.collectElements()
        this.restoreBounds()
        this.bindEvents()
        this.subscribe()
        this.observeBounds()
        this.renderHeader()
        this.renderChat()
        this.renderTrace()
        this.showLauncher()

        return this
    }

    unmount() {
        for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe()
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        this.stopDrag()
        this.root?.remove()
        this.root = null
        this.elements = {}
    }

    template() {
        return `
            <button class="vmblu-agent-launcher" type="button" title="Open agent">AI</button>
            <section class="vmblu-agent-window" hidden>
                <header class="vmblu-agent-header">
                    <div class="vmblu-agent-title">
                        <strong></strong>
                        <span></span>
                    </div>
                    <div class="vmblu-agent-actions">
                        <button class="vmblu-agent-theme" type="button" title="Switch theme">Dark</button>
                        <button class="vmblu-agent-maximize" type="button" title="Maximize">[]</button>
                        <button class="vmblu-agent-close" type="button" title="Close">x</button>
                    </div>
                </header>
                <nav class="vmblu-agent-tabs" aria-label="Agent views">
                    <button class="vmblu-agent-tab is-active" type="button" data-tab="chat">Chat</button>
                    <button class="vmblu-agent-tab" type="button" data-tab="trace">Trace</button>
                </nav>
                <main class="vmblu-agent-body">
                    <section class="vmblu-agent-panel is-active" data-panel="chat">
                        <div class="vmblu-agent-chat-log"></div>
                        <form class="vmblu-agent-chat-form">
                            <textarea rows="2" placeholder="Ask the agent"></textarea>
                            <button type="submit">Send</button>
                        </form>
                    </section>
                    <section class="vmblu-agent-panel" data-panel="trace">
                        <div class="vmblu-agent-trace-toolbar">
                            <button class="vmblu-agent-trace-clear" type="button">Clear</button>
                        </div>
                        <div class="vmblu-agent-trace-log"></div>
                    </section>
                </main>
            </section>
        `
    }

    collectElements() {
        this.elements.launcher = this.root.querySelector('.vmblu-agent-launcher')
        this.elements.window = this.root.querySelector('.vmblu-agent-window')
        this.elements.header = this.root.querySelector('.vmblu-agent-header')
        this.elements.title = this.root.querySelector('.vmblu-agent-title strong')
        this.elements.subtitle = this.root.querySelector('.vmblu-agent-title span')
        this.elements.close = this.root.querySelector('.vmblu-agent-close')
        this.elements.theme = this.root.querySelector('.vmblu-agent-theme')
        this.elements.maximize = this.root.querySelector('.vmblu-agent-maximize')
        this.elements.tabs = [...this.root.querySelectorAll('.vmblu-agent-tab')]
        this.elements.panels = [...this.root.querySelectorAll('.vmblu-agent-panel')]
        this.elements.chatLog = this.root.querySelector('.vmblu-agent-chat-log')
        this.elements.chatForm = this.root.querySelector('.vmblu-agent-chat-form')
        this.elements.chatInput = this.root.querySelector('.vmblu-agent-chat-form textarea')
        this.elements.chatSubmit = this.root.querySelector('.vmblu-agent-chat-form button')
        this.elements.traceLog = this.root.querySelector('.vmblu-agent-trace-log')
        this.elements.traceClear = this.root.querySelector('.vmblu-agent-trace-clear')
    }

    bindEvents() {
        this.elements.launcher.addEventListener('click', () => this.open())
        this.elements.close.addEventListener('click', () => this.close())
        this.elements.theme.addEventListener('click', () => this.toggleTheme())
        this.elements.maximize.addEventListener('click', () => this.toggleMaximize())
        this.elements.header.addEventListener('pointerdown', event => this.startDrag(event))
        this.elements.chatForm.addEventListener('submit', event => this.submitChat(event))
        this.elements.traceClear.addEventListener('click', () => this.clearTrace())

        for (const tab of this.elements.tabs) {
            tab.addEventListener('click', () => this.selectTab(tab.dataset.tab))
        }
    }

    observeBounds() {
        if (typeof ResizeObserver === 'undefined') return
        this.resizeObserver = new ResizeObserver(() => {
            if (!this.elements.window?.hidden) this.saveBounds()
        })
        this.resizeObserver.observe(this.elements.window)
    }

    subscribe() {
        if (this.agent?.subscribe) {
            this.unsubscribers.push(this.agent.subscribe(message => {
                if (message?.kind === 'chat.assistant') this.addMessage('agent', message.content || '')
                else this.addMessage('broker', this.formatBrokerMessage(message))
            }))
        }

        if (this.traceRecorder?.subscribe) {
            this.traceRecords = this.traceRecorder.all?.() ?? []
            this.unsubscribers.push(this.traceRecorder.subscribe(record => {
                this.traceRecords.push(record)
                this.renderTrace()
            }))
        }
    }

    renderHeader() {
        const title = this.config?.title || this.agentId
        const llm = this.config?.llm ?? {}
        const provider = [llm.provider, llm.model].filter(Boolean).join(' / ')
        this.elements.title.textContent = title
        this.elements.subtitle.textContent = provider || 'No provider configured'
        this.applyTheme()
    }

    renderChat() {
        const log = this.elements.chatLog
        log.textContent = ''

        if (this.messages.length === 0) {
            this.addStaticMessage(log, 'system', 'Agent overlay ready. Chat is routed through the configured provider adapter; tools and trace are available.')
            this.renderCapabilitySummary(log)
            return
        }

        for (const message of this.messages.slice(-80)) {
            this.addStaticMessage(log, message.role, message.text)
        }
        log.scrollTop = log.scrollHeight
    }

    renderCapabilitySummary(log) {
        const tools = this.broker?.registry?.list?.().tools ?? []
        if (tools.length === 0) {
            this.addStaticMessage(log, 'system', 'No tools are published.')
            return
        }

        this.addStaticMessage(log, 'system', `Published tools: ${tools.map(tool => tool.id).join(', ')}`)
    }

    addStaticMessage(log, role, text) {
        const item = document.createElement('div')
        item.className = `vmblu-agent-message vmblu-agent-message-${role}`
        const label = document.createElement('span')
        label.textContent = role
        const body = document.createElement('p')
        body.textContent = text
        item.append(label, body)
        log.appendChild(item)
    }

    addMessage(role, text) {
        this.messages.push({role, text, timestamp: new Date().toISOString()})
        this.renderChat()
    }

    async submitChat(event) {
        event.preventDefault()
        const text = this.elements.chatInput.value.trim()
        if (!text) return

        this.elements.chatInput.value = ''
        this.addMessage('user', text)
        this.setChatBusy(true)

        try {
            if (!this.agent?.submitUserMessage) throw new Error('Agent runtime does not support chat submission')
            await this.agent.submitUserMessage(text)
        }
        finally {
            this.setChatBusy(false)
        }
    }

    setChatBusy(busy) {
        if (this.elements.chatInput) this.elements.chatInput.disabled = busy
        if (this.elements.chatSubmit) {
            this.elements.chatSubmit.disabled = busy
            this.elements.chatSubmit.textContent = busy ? '...' : 'Send'
        }
    }

    renderTrace() {
        const log = this.elements.traceLog
        if (!log) return
        log.textContent = ''

        const records = this.traceRecords.slice(-200)
        if (records.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'vmblu-agent-trace-empty'
            empty.textContent = 'No trace records yet.'
            log.appendChild(empty)
            return
        }

        for (const record of records) {
            const item = document.createElement('article')
            item.className = `vmblu-agent-trace-item vmblu-agent-trace-${record.status || 'info'}`

            const meta = document.createElement('div')
            meta.className = 'vmblu-agent-trace-meta'
            meta.textContent = [
                this.timeOnly(record.timestamp),
                record.type,
                record.status,
                record.agentId,
                record.requestId,
                record.callId,
            ].filter(Boolean).join(' | ')

            const details = document.createElement('pre')
            details.textContent = this.formatTraceDetails(record)

            item.append(meta, details)
            log.appendChild(item)
        }
        log.scrollTop = log.scrollHeight
    }

    clearTrace() {
        this.traceRecorder?.clear?.()
        this.traceRecords = []
        this.renderTrace()
    }

    formatTraceDetails(record) {
        const {traceId, timestamp, type, status, agentId, requestId, callId, ...rest} = record
        return Object.keys(rest).length ? JSON.stringify(rest, null, 2) : traceId
    }

    formatBrokerMessage(message) {
        if (message?.kind === 'broker.result') {
            const result = message.result ?? {}
            return `${result.type || 'result'} ${result.toolId || result.probeId || result.eventId || ''} ${result.status || ''}`.trim()
        }
        if (message?.kind === 'event.observed') return `Event observed: ${message.eventId}`
        return message?.kind || 'Broker message'
    }

    selectTab(name) {
        this.activeTab = name
        for (const tab of this.elements.tabs) tab.classList.toggle('is-active', tab.dataset.tab === name)
        for (const panel of this.elements.panels) panel.classList.toggle('is-active', panel.dataset.panel === name)
    }

    open() {
        this.elements.window.hidden = false
        this.elements.launcher.hidden = true
        this.elements.chatInput?.focus()
    }

    close() {
        this.elements.window.hidden = true
        this.elements.launcher.hidden = false
        this.saveBounds()
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark'
        this.applyTheme()
        this.saveTheme()
    }

    applyTheme() {
        if (!this.root) return
        this.root.dataset.theme = this.theme
        if (this.elements.theme) {
            this.elements.theme.textContent = this.theme === 'dark' ? 'Light' : 'Dark'
            this.elements.theme.title = this.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        }
    }

    toggleMaximize() {
        const win = this.elements.window
        if (win.classList.contains('is-maximized')) {
            win.classList.remove('is-maximized')
            this.restoreBounds()
            this.elements.maximize.title = 'Maximize'
            return
        }

        this.saveBounds()
        win.classList.add('is-maximized')
        win.style.left = '8px'
        win.style.top = '8px'
        win.style.right = '8px'
        win.style.bottom = '8px'
        win.style.width = 'auto'
        win.style.height = 'auto'
        this.elements.maximize.title = 'Restore'
    }

    showLauncher() {
        this.elements.launcher.hidden = false
        this.elements.window.hidden = true
    }

    startDrag(event) {
        if (event.target.closest('button')) return
        if (this.elements.window.classList.contains('is-maximized')) return
        const win = this.elements.window
        const rect = win.getBoundingClientRect()
        this.dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: rect.left,
            top: rect.top,
        }
        this.elements.header.setPointerCapture(event.pointerId)
        this.elements.header.addEventListener('pointermove', this.onDrag)
        this.elements.header.addEventListener('pointerup', this.onDragEnd)
    }

    onDrag = (event) => {
        if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
        const left = this.dragState.left + event.clientX - this.dragState.startX
        const top = this.dragState.top + event.clientY - this.dragState.startY
        this.setWindowPosition(left, top)
    }

    onDragEnd = (event) => {
        if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
        this.stopDrag()
        this.saveBounds()
    }

    stopDrag() {
        if (!this.elements.header) return
        if (this.dragState?.pointerId && this.elements.header.hasPointerCapture?.(this.dragState.pointerId)) {
            this.elements.header.releasePointerCapture(this.dragState.pointerId)
        }
        this.elements.header.removeEventListener('pointermove', this.onDrag)
        this.elements.header.removeEventListener('pointerup', this.onDragEnd)
        this.dragState = null
    }

    setWindowPosition(left, top) {
        const win = this.elements.window
        const margin = 8
        const maxLeft = Math.max(margin, window.innerWidth - win.offsetWidth - margin)
        const maxTop = Math.max(margin, window.innerHeight - win.offsetHeight - margin)
        win.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`
        win.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`
        win.style.right = 'auto'
        win.style.bottom = 'auto'
    }

    saveBounds() {
        if (typeof localStorage === 'undefined' || !this.elements.window) return
        if (this.elements.window.classList.contains('is-maximized')) return
        const rect = this.elements.window.getBoundingClientRect()
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            }))
        }
        catch {
            // Storage can be unavailable in private or embedded browser contexts.
        }
    }

    loadTheme() {
        try {
            const value = typeof localStorage !== 'undefined' ? localStorage.getItem(`${this.storageKey}.theme`) : null
            return value === 'dark' ? 'dark' : 'light'
        }
        catch {
            return 'light'
        }
    }

    saveTheme() {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(`${this.storageKey}.theme`, this.theme)
        }
        catch {
            // Theme persistence is optional.
        }
    }

    restoreBounds() {
        const win = this.elements.window
        let bounds = null
        try {
            bounds = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(this.storageKey) || 'null') : null
        }
        catch {
            bounds = null
        }

        if (bounds) {
            win.style.width = `${bounds.width}px`
            win.style.height = `${bounds.height}px`
            win.style.left = `${bounds.left}px`
            win.style.top = `${bounds.top}px`
            win.style.right = 'auto'
            win.style.bottom = 'auto'
        }
    }

    timeOnly(timestamp) {
        if (!timestamp) return ''
        const date = new Date(timestamp)
        if (Number.isNaN(date.getTime())) return timestamp
        return date.toLocaleTimeString()
    }

    injectStyles() {
        if (document.getElementById('vmblu-agent-overlay-style')) return
        const style = document.createElement('style')
        style.id = 'vmblu-agent-overlay-style'
        style.textContent = `
.vmblu-agent-overlay{--agent-bg:#f8faf9;--agent-band:#eef2f3;--agent-header:#20313d;--agent-header-text:#fff;--agent-text:#17202a;--agent-muted:#667583;--agent-border:#b9c2ca;--agent-card:#fff;--agent-button:#fff;--agent-button-text:#1e2c36;--agent-primary:#17496d;--agent-primary-text:#fff;--agent-chat-user:#eef6fb;--agent-chat-agent:#f1f8ef;position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--agent-text)}
.vmblu-agent-overlay[data-theme="dark"]{--agent-bg:#14191d;--agent-band:#20282e;--agent-header:#0f171c;--agent-header-text:#eef5f7;--agent-text:#e6edf1;--agent-muted:#9eabb4;--agent-border:#3c4850;--agent-card:#1b2227;--agent-button:#263038;--agent-button-text:#e6edf1;--agent-primary:#66a3c7;--agent-primary-text:#0d1418;--agent-chat-user:#182b38;--agent-chat-agent:#1d3127}
.vmblu-agent-launcher{position:fixed;right:18px;bottom:18px;width:48px;height:48px;border:1px solid var(--agent-primary);border-radius:50%;background:var(--agent-primary);color:var(--agent-primary-text);font-weight:700;box-shadow:0 10px 30px rgba(15,27,43,.28);cursor:pointer;pointer-events:auto}
.vmblu-agent-window{position:fixed;right:18px;bottom:78px;width:min(520px,calc(100vw - 36px));height:min(640px,calc(100vh - 112px));min-width:320px;min-height:360px;resize:both;overflow:hidden;pointer-events:auto;background:var(--agent-bg);border:1px solid var(--agent-border);border-radius:8px;box-shadow:0 20px 60px rgba(15,27,43,.32);display:flex;flex-direction:column}
.vmblu-agent-launcher[hidden],.vmblu-agent-window[hidden]{display:none!important}
.vmblu-agent-window.is-maximized{resize:none;border-radius:6px}
.vmblu-agent-header{height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 10px 0 14px;background:var(--agent-header);color:var(--agent-header-text);cursor:move;user-select:none;touch-action:none}
.vmblu-agent-title{min-width:0;display:flex;flex-direction:column;gap:2px}
.vmblu-agent-title strong{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vmblu-agent-title span{font-size:12px;color:var(--agent-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vmblu-agent-actions{display:flex;gap:6px}
.vmblu-agent-actions button,.vmblu-agent-tabs button,.vmblu-agent-chat-form button,.vmblu-agent-trace-toolbar button{border:1px solid var(--agent-border);background:var(--agent-button);color:var(--agent-button-text);border-radius:6px;cursor:pointer}
.vmblu-agent-actions button{height:28px;min-width:28px;padding:0 8px;background:var(--agent-button);color:var(--agent-button-text);border-color:var(--agent-border)}
.vmblu-agent-tabs{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-tab{height:30px;padding:0 12px}
.vmblu-agent-tab.is-active{background:var(--agent-primary);color:var(--agent-primary-text);border-color:var(--agent-primary)}
.vmblu-agent-body{min-height:0;flex:1;display:flex}
.vmblu-agent-panel{display:none;min-width:0;min-height:0;flex:1}
.vmblu-agent-panel.is-active{display:flex;flex-direction:column}
.vmblu-agent-chat-log,.vmblu-agent-trace-log{flex:1;min-height:0;overflow:auto;padding:12px;background:var(--agent-bg)}
.vmblu-agent-message{margin:0 0 10px;padding:9px 10px;border:1px solid var(--agent-border);border-radius:8px;background:var(--agent-card)}
.vmblu-agent-message span{display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:var(--agent-muted)}
.vmblu-agent-message p{margin:0;font-size:13px;line-height:1.4;white-space:pre-wrap}
.vmblu-agent-message-user{background:var(--agent-chat-user)}
.vmblu-agent-message-agent{background:var(--agent-chat-agent)}
.vmblu-agent-chat-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-top:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-chat-form textarea{min-width:0;resize:none;border:1px solid var(--agent-border);border-radius:6px;padding:8px;font:inherit;font-size:13px;background:var(--agent-card);color:var(--agent-text)}
.vmblu-agent-chat-form button{width:72px}
.vmblu-agent-trace-toolbar{display:flex;justify-content:flex-end;padding:8px 10px;border-bottom:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-trace-toolbar button{height:28px;padding:0 10px}
.vmblu-agent-trace-item{margin:0 0 8px;border:1px solid var(--agent-border);border-radius:6px;background:var(--agent-card);overflow:hidden}
.vmblu-agent-trace-meta{padding:6px 8px;background:var(--agent-band);font-size:12px;color:var(--agent-text)}
.vmblu-agent-trace-item pre{margin:0;padding:8px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.35;color:var(--agent-text)}
.vmblu-agent-trace-failed .vmblu-agent-trace-meta,.vmblu-agent-trace-denied .vmblu-agent-trace-meta{background:#f7dfdf;color:#743232}
.vmblu-agent-overlay[data-theme="dark"] .vmblu-agent-trace-failed .vmblu-agent-trace-meta,.vmblu-agent-overlay[data-theme="dark"] .vmblu-agent-trace-denied .vmblu-agent-trace-meta{background:#4a2427;color:#ffc8c8}
.vmblu-agent-trace-empty{font-size:13px;color:var(--agent-muted)}
        `
        document.head.appendChild(style)
    }
}
