import {systemStyle} from './system-style.js'
import {SystemRoute} from './system-route.js'
import {ApplicationWidget} from './widgets/application-widget.js'

function nullContext() {
    const noop = () => {}
    return new Proxy({measureText: text => ({width: String(text ?? '').length * systemStyle.text.measureCharacterWidth})}, {
        get(target, property) {
            return property in target ? target[property] : noop
        },
        set(target, property, value) {
            target[property] = value
            return true
        },
    })
}

function nullCanvas() {
    return {
        width: 0,
        height: 0,
        style: {},
        title: '',
        addEventListener() {},
        setAttribute() {},
        focus() {},
        getBoundingClientRect: () => ({left: 0, top: 0}),
        getContext: () => nullContext(),
    }
}

/**
 * @node sysblu view
 */
export function SysbluView(tx, sx = {}) {
    this.tx = tx
    this.sx = sx
    const documentRef = sx?.document ?? globalThis.document
    this.canvas = sx?.canvas ?? documentRef?.createElement?.('canvas') ?? nullCanvas()
    this.ctx = this.canvas.getContext?.('2d') ?? nullContext()
    this.document = null
    this.arl = null
    this.widgets = new Map()
    this.routes = []
    this.selection = null
    this.drag = null
    this.pan = null
    this.spacePressed = false
    this.connectionDrag = null
    this.pendingReference = null
    this.pendingSelection = null
    this.transform = {x: 0, y: 0, zoom: 1}
    this.size = {w: 0, h: 0, dpr: 1}
    this.waitingForFrame = false

    this.setupCanvas()
    this.addEventHandlers()
}

SysbluView.prototype = {
    setupCanvas() {
        this.canvas.setAttribute?.('tabindex', '0')
        this.canvas.setAttribute?.('role', 'application')
        this.canvas.setAttribute?.('aria-label', 'System architecture diagram')
        this.canvas.style.outline = systemStyle.canvas.outline
        this.canvas.style.touchAction = systemStyle.canvas.touchAction
    },

    addEventHandlers() {
        this.canvas.addEventListener?.('pointerdown', event => this.pointerDown(event))
        this.canvas.addEventListener?.('pointermove', event => this.pointerMove(event))
        this.canvas.addEventListener?.('pointerup', event => this.pointerUp(event))
        this.canvas.addEventListener?.('pointercancel', () => this.cancelPointer())
        this.canvas.addEventListener?.('wheel', event => this.wheel(event), {passive: false})
        this.canvas.addEventListener?.('keydown', event => this.keydown(event))
        this.canvas.addEventListener?.('keyup', event => this.keyup(event))
    },

    /** @param {SystemSnapshot} snapshot */
    onSystemUpdated(snapshot) {
        const isSnapshot = snapshot && Object.hasOwn(snapshot, 'document')
        this.document = isSnapshot ? snapshot.document : snapshot ?? null
        this.arl = isSnapshot ? snapshot.arl ?? null : null
        this.transform = {
            x: this.document?.view?.offset?.x ?? this.transform.x,
            y: this.document?.view?.offset?.y ?? this.transform.y,
            zoom: this.document?.view?.zoom ?? this.transform.zoom,
        }
        this.rebuild()
        this.redraw()
        if (this.document) this.tx.send('canvas', this.canvas)
    },

    onSysmodDone(result) {
        if (result?.error) this.pendingSelection = null
        this.redraw()
    },

    /** @param {ViewSize} size */
    onSizeChange(size) {
        if (!size || !Number.isFinite(size.w) || !Number.isFinite(size.h)) return
        const dpr = size.dpr ?? globalThis.devicePixelRatio ?? 1
        this.size = {w: size.w, h: size.h, dpr}
        this.canvas.width = Math.round(size.w * dpr)
        this.canvas.height = Math.round(size.h * dpr)
        this.canvas.style.width = `${size.w}px`
        this.canvas.style.height = `${size.h}px`
        this.ctx = this.canvas.getContext?.('2d') ?? this.ctx
        this.redraw()
    },

    rebuild() {
        const selected = this.selection
        this.widgets = new Map((this.document?.nodes ?? []).map(node => [node.id, new ApplicationWidget(node)]))
        this.routes = (this.document?.connections ?? []).map(connection => new SystemRoute(connection, this.widgets))
        const pending = this.pendingSelection
        this.selection = pending && this.findSelectable(pending.kind, pending.id)
            ? pending
            : selected && this.findSelectable(selected.kind, selected.id)
                ? selected
                : null
        if (pending && this.selection === pending) this.pendingSelection = null
        this.applySelection()
    },

    rebuildRoutes() {
        for (const route of this.routes) route.layout()
    },

    findSelectable(kind, id) {
        return kind === 'node'
            ? this.widgets.get(id)
            : kind === 'connection'
                ? this.routes.find(route => route.connection.id === id)
                : null
    },

    select(kind, id) {
        this.selection = kind && id ? {kind, id} : null
        this.applySelection()
        this.redraw()
    },

    focusCanvasAfterInspector() {
        const schedule = globalThis.queueMicrotask ?? (callback => Promise.resolve().then(callback))
        schedule(() => this.canvas.focus?.())
    },

    popupPosition(event = {}) {
        const canvasRect = this.canvas.getBoundingClientRect?.() ?? {left: 0, top: 0}
        const point = this.eventPoint(event)
        return {
            x: Number.isFinite(event.clientX) ? event.clientX : canvasRect.left + point.x,
            y: Number.isFinite(event.clientY) ? event.clientY : canvasRect.top + point.y,
        }
    },

    openApplicationInspector(widget, event = {}) {
        if (widget?.node?.kind !== 'application') return
        const pos = this.popupPosition(event)
        const application = JSON.parse(JSON.stringify(widget.node))

        this.tx.send('application settings', {
            title: 'Application',
            pos,
            application,
            ok: changes => {
                this.tx.send('sysmod.doit', {
                    verb: 'editApplication',
                    param: {id: application.id, ...changes},
                })
                this.focusCanvasAfterInspector()
            },
            cancel: () => this.focusCanvasAfterInspector(),
            trash: () => {
                this.tx.send('sysmod.doit', {
                    verb: 'deleteApplication',
                    param: {id: application.id},
                })
                this.focusCanvasAfterInspector()
            },
        })
    },

    openEndpointInspector(widget, endpointWidget = null, event = {}) {
        if (!widget?.node) return
        const endpoint = endpointWidget ? JSON.parse(JSON.stringify(endpointWidget.endpoint)) : {}
        const existing = Boolean(endpoint.id)
        this.tx.send('endpoint settings', {
            title: 'Endpoint',
            pos: this.popupPosition(event),
            endpoint,
            endpointIds: widget.endpoints.map(candidate => candidate.endpoint.id),
            open: target => this.activateReference({target}),
            ok: changes => {
                this.tx.send('sysmod.doit', {
                    verb: existing ? 'editEndpoint' : 'addEndpoint',
                    param: existing
                        ? {nodeId: widget.node.id, id: endpoint.id, endpoint: changes}
                        : {nodeId: widget.node.id, endpoint: changes},
                })
                this.focusCanvasAfterInspector()
            },
            cancel: () => this.focusCanvasAfterInspector(),
            ...(existing ? {
                trash: () => {
                    this.tx.send('sysmod.doit', {
                        verb: 'deleteEndpoint',
                        param: {nodeId: widget.node.id, id: endpoint.id},
                    })
                    this.focusCanvasAfterInspector()
                },
            } : {}),
        })
    },

    endpointLabel(binding) {
        return `${binding.widget.node.name}: ${binding.endpoint.endpoint.name}`
    },

    uniqueConnectionId(connection) {
        const seed = [
            connection?.from?.node,
            connection?.from?.endpoint,
            connection?.to?.node,
            connection?.to?.endpoint,
            connection?.transport,
        ].filter(Boolean).join('-')
        const base = String(seed)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'connection'
        const ids = new Set((this.document?.connections ?? []).map(connection => connection.id))
        let id = base
        let suffix = 2
        while (ids.has(id)) id = `${base}-${suffix++}`
        return id
    },

    openConnectionInspector(connection, event = {}, bindings = {}) {
        const existing = Boolean(connection.id)
        const snapshot = JSON.parse(JSON.stringify(connection))
        this.tx.send('connection settings', {
            title: 'Transport',
            pos: this.popupPosition(event),
            connection: snapshot,
            fromLabel: bindings.fromLabel ?? this.connectionEndLabel(connection.from),
            toLabel: bindings.toLabel ?? this.connectionEndLabel(connection.to),
            ok: changes => {
                if (existing) {
                    this.tx.send('sysmod.doit', {
                        verb: 'editConnection',
                        param: {id: connection.id, ...changes},
                    })
                }
                else {
                    const id = this.uniqueConnectionId(changes)
                    this.pendingSelection = {kind: 'connection', id}
                    this.tx.send('sysmod.doit', {
                        verb: 'addConnection',
                        param: {connection: {id, ...changes}},
                    })
                }
                this.focusCanvasAfterInspector()
            },
            cancel: () => this.focusCanvasAfterInspector(),
            ...(existing ? {
                trash: () => {
                    this.tx.send('sysmod.doit', {
                        verb: 'deleteConnection',
                        param: {id: connection.id},
                    })
                    this.focusCanvasAfterInspector()
                },
            } : {}),
        })
    },

    connectionEndLabel(end) {
        const widget = this.widgets.get(end?.node)
        const endpoint = widget?.endpoint(end?.endpoint)
        return widget && endpoint ? this.endpointLabel({widget, endpoint}) : `${end?.node ?? '?'}: ${end?.endpoint ?? '?'}`
    },

    beginConnection(widget, endpoint, event) {
        const point = this.worldPoint(event)
        this.connectionDrag = {widget, endpoint, point}
        this.canvas.setPointerCapture?.(event.pointerId)
        this.redraw()
    },

    completeConnection(targetWidget, targetEndpoint, event) {
        const source = this.connectionDrag
        if (!source || !targetWidget || !targetEndpoint) return
        if (source.widget.node.id === targetWidget.node.id && source.endpoint.endpoint.id === targetEndpoint.endpoint.id) return

        const from = {node: source.widget.node.id, endpoint: source.endpoint.endpoint.id}
        const to = {node: targetWidget.node.id, endpoint: targetEndpoint.endpoint.id}
        const connection = {
            from,
            to,
            transport: 'unspecified',
        }
        this.openConnectionInspector(connection, event, {
            fromLabel: this.endpointLabel(source),
            toLabel: this.endpointLabel({widget: targetWidget, endpoint: targetEndpoint}),
        })
    },

    uniqueApplicationId(name) {
        const base = String(name ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'application'
        let id = base
        let suffix = 2
        while (this.widgets.has(id)) id = `${base}-${suffix++}`
        return id
    },

    newApplicationPosition() {
        const style = systemStyle.application
        const stagger = (this.document?.nodes?.length ?? 0) * 16
        return {
            x: ((this.size.w || 600) / 2 - this.transform.x) / this.transform.zoom - style.width / 2 + stagger,
            y: ((this.size.h || 400) / 2 - this.transform.y) / this.transform.zoom - style.headerHeight + stagger,
        }
    },

    onAddApplication(event = {}) {
        if (!this.document) return
        const pos = {
            x: Number.isFinite(event.clientX) ? event.clientX : 48,
            y: Number.isFinite(event.clientY) ? event.clientY : 48,
        }
        const position = this.newApplicationPosition()

        this.tx.send('application settings', {
            title: 'Application',
            pos,
            application: {name: '', description: '', vmblu: true, references: []},
            ok: changes => {
                const id = this.uniqueApplicationId(changes.name)
                this.pendingSelection = {kind: 'node', id}
                this.tx.send('sysmod.doit', {
                    verb: 'addApplication',
                    param: {
                        application: {
                            id,
                            kind: 'application',
                            name: changes.name,
                            vmblu: changes.vmblu,
                            ...(changes.role ? {description: changes.role} : {}),
                            position,
                            references: changes.references,
                            endpoints: [],
                        },
                    },
                })
                this.focusCanvasAfterInspector()
            },
            cancel: () => this.focusCanvasAfterInspector(),
        })
    },

    applySelection() {
        for (const widget of this.widgets.values()) widget.selected = this.selection?.kind === 'node' && this.selection.id === widget.node.id
        for (const route of this.routes) route.selected = this.selection?.kind === 'connection' && this.selection.id === route.connection.id
    },

    eventPoint(event) {
        if (Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) return {x: event.offsetX, y: event.offsetY}
        const rect = this.canvas.getBoundingClientRect?.() ?? {left: 0, top: 0}
        return {x: event.clientX - rect.left, y: event.clientY - rect.top}
    },

    worldPoint(event) {
        const point = this.eventPoint(event)
        return {
            x: (point.x - this.transform.x) / this.transform.zoom,
            y: (point.y - this.transform.y) / this.transform.zoom,
        }
    },

    widgetAt(point) {
        return [...this.widgets.values()].reverse().find(widget => widget.hit(point)) ?? null
    },

    routeAt(point) {
        return [...this.routes].reverse().find(route => route.hit(point, systemStyle.route.hitTolerance / this.transform.zoom)) ?? null
    },

    pointerDown(event) {
        const isLeftButton = event.button == null || event.button === 0
        const isMiddleButton = event.button === 1
        if (!isLeftButton && !isMiddleButton) return
        this.canvas.focus?.()
        event.preventDefault?.()

        if (isMiddleButton || this.spacePressed) {
            this.beginPan(event)
            return
        }

        const point = this.worldPoint(event)
        const widget = this.widgetAt(point)

        if (widget) {
            const reference = widget.referenceAt(point)
            if (reference) {
                this.pendingReference = reference
                return
            }

            this.select('node', widget.node.id)
            if (widget.hitSettings(point)) {
                this.openApplicationInspector(widget, event)
                return
            }
            if (widget.hitAddEndpoint(point)) {
                this.openEndpointInspector(widget, null, event)
                return
            }
            const endpoint = widget.endpointAt(point)
            if (endpoint?.hitConnector(point)) {
                this.beginConnection(widget, endpoint, event)
                return
            }
            if (endpoint) {
                this.openEndpointInspector(widget, endpoint, event)
                return
            }
            if (widget.hitHeader(point)) {
                this.drag = {
                    widget,
                    start: point,
                    origin: {...widget.node.position},
                    moved: false,
                }
                this.canvas.setPointerCapture?.(event.pointerId)
            }
            return
        }

        const route = this.routeAt(point)
        if (route) {
            this.select('connection', route.connection.id)
            this.openConnectionInspector(route.connection, event)
        }
        else {
            this.select(null, null)
            this.beginPan(event)
        }
    },

    pointerMove(event) {
        if (this.pan) {
            const point = this.eventPoint(event)
            this.transform.x = this.pan.origin.x + point.x - this.pan.start.x
            this.transform.y = this.pan.origin.y + point.y - this.pan.start.y
            this.redraw()
            return
        }

        const point = this.worldPoint(event)
        if (this.connectionDrag) {
            this.connectionDrag.point = point
            this.redraw()
            return
        }
        if (this.drag) {
            const position = {
                x: this.drag.origin.x + point.x - this.drag.start.x,
                y: this.drag.origin.y + point.y - this.drag.start.y,
            }
            this.drag.moved ||= position.x !== this.drag.origin.x || position.y !== this.drag.origin.y
            this.drag.widget.setPosition(position)
            this.rebuildRoutes()
            this.redraw()
            return
        }

        const widget = this.widgetAt(point)
        const reference = widget?.referenceAt(point)
        const settings = widget?.hitSettings(point)
        const addEndpoint = widget?.hitAddEndpoint(point)
        const endpoint = widget?.endpointAt(point)
        this.canvas.title = reference?.tooltip()
            || (settings ? systemStyle.application.settingsTooltip : '')
            || (addEndpoint ? systemStyle.application.addEndpointTooltip : '')
            || (endpoint?.hitConnector(point) ? systemStyle.endpoint.connectionTooltip : '')
            || (endpoint ? systemStyle.endpoint.settingsTooltip : '')
        this.canvas.style.cursor = reference || settings || addEndpoint || endpoint
            ? systemStyle.canvas.cursorReference
            : widget?.hitHeader(point)
                ? systemStyle.canvas.cursorMove
                : systemStyle.canvas.cursorDefault
    },

    pointerUp(event) {
        if (this.pan) {
            this.pan = null
            this.canvas.releasePointerCapture?.(event.pointerId)
            this.canvas.style.cursor = this.spacePressed
                ? systemStyle.canvas.cursorGrab
                : systemStyle.canvas.cursorDefault
            return
        }

        const point = this.worldPoint(event)
        if (this.pendingReference) {
            const reference = this.pendingReference
            this.pendingReference = null
            if (reference.hit(point)) this.activateReference(reference.reference, event)
        }

        if (this.connectionDrag) {
            const targetWidget = this.widgetAt(point)
            const targetEndpoint = targetWidget?.endpointAt(point)
            const source = this.connectionDrag
            this.connectionDrag = null
            this.canvas.releasePointerCapture?.(event.pointerId)
            if (targetEndpoint) {
                this.connectionDrag = source
                this.completeConnection(targetWidget, targetEndpoint, event)
                this.connectionDrag = null
            }
            this.redraw()
            return
        }

        if (!this.drag) return
        const drag = this.drag
        this.drag = null
        this.canvas.releasePointerCapture?.(event.pointerId)
        if (!drag.moved) return
        this.tx.send('sysmod.doit', {
            verb: 'moveNode',
            param: {
                id: drag.widget.node.id,
                position: {...drag.widget.node.position},
            },
        })
    },

    cancelPointer() {
        if (this.pan) {
            this.transform.x = this.pan.origin.x
            this.transform.y = this.pan.origin.y
        }
        if (this.drag) {
            this.drag.widget.setPosition(this.drag.origin)
            this.rebuildRoutes()
        }
        this.pan = null
        this.drag = null
        this.connectionDrag = null
        this.pendingReference = null
        this.canvas.style.cursor = this.spacePressed
            ? systemStyle.canvas.cursorGrab
            : systemStyle.canvas.cursorDefault
        this.redraw()
    },

    beginPan(event) {
        const point = this.eventPoint(event)
        this.pan = {
            start: point,
            origin: {x: this.transform.x, y: this.transform.y},
        }
        this.canvas.setPointerCapture?.(event.pointerId)
        this.canvas.style.cursor = systemStyle.canvas.cursorGrabbing
    },

    activateReference(reference, event = {}) {
        if ((event.ctrlKey || event.metaKey) && reference?.command && reference?.workingDirectory) {
            const workingDirectory = this.arl?.resolve?.(reference.workingDirectory) ?? reference.workingDirectory
            this.tx.send('execute command', {
                command: reference.command,
                workingDirectory,
            })
            return
        }
        if (!reference?.target) return
        if (/^https?:\/\//i.test(reference.target)) {
            this.tx.send('open reference', {externalUrl: reference.target})
            return
        }
        const target = this.arl?.resolve?.(reference.target) ?? reference.target
        this.tx.send('open reference', target)
    },

    onApplicationPrompt() {
        const reference = this.document?.references?.find(candidate => candidate.kind === 'prompt')
        this.activateReference(reference)
    },

    wheel(event) {
        event.preventDefault?.()
        const point = this.eventPoint(event)
        const world = {
            x: (point.x - this.transform.x) / this.transform.zoom,
            y: (point.y - this.transform.y) / this.transform.zoom,
        }
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
        const zoom = Math.max(0.25, Math.min(4, this.transform.zoom * factor))
        this.transform.x = point.x - world.x * zoom
        this.transform.y = point.y - world.y * zoom
        this.transform.zoom = zoom
        this.redraw()
    },

    keydown(event) {
        if (event.code === 'Space' || event.key === ' ') {
            this.spacePressed = true
            if (!this.pan) this.canvas.style.cursor = systemStyle.canvas.cursorGrab
            event.preventDefault?.()
            return
        }

        if (!(event.ctrlKey || event.metaKey)) return
        const key = event.key?.toLowerCase()
        if (key === 'z' && event.shiftKey) this.tx.send('sysmod.redo')
        else if (key === 'z') this.tx.send('sysmod.undo')
        else if (key === 'y') this.tx.send('sysmod.redo')
        else return
        event.preventDefault?.()
        event.stopPropagation?.()
    },

    keyup(event) {
        if (event.code !== 'Space' && event.key !== ' ') return
        this.spacePressed = false
        if (!this.pan) this.canvas.style.cursor = systemStyle.canvas.cursorDefault
        event.preventDefault?.()
    },

    redraw() {
        if (this.waitingForFrame) return
        this.waitingForFrame = true
        const requestFrame = globalThis.requestAnimationFrame ?? (callback => callback())
        requestFrame(() => {
            this.waitingForFrame = false
            this.render()
        })
    },

    render() {
        const ctx = this.ctx
        const {w, h, dpr} = this.size
        ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0)
        ctx.fillStyle = systemStyle.canvas.background
        ctx.fillRect(0, 0, w || this.canvas.width, h || this.canvas.height)
        ctx.translate(this.transform.x, this.transform.y)
        ctx.scale(this.transform.zoom, this.transform.zoom)

        for (const route of this.routes) route.render(ctx)
        if (this.connectionDrag) {
            const style = systemStyle.route
            const start = this.connectionDrag.endpoint.center()
            ctx.strokeStyle = style.draft
            ctx.lineWidth = style.draftWidth
            ctx.setLineDash(style.draftDash)
            ctx.beginPath()
            ctx.moveTo(start.x, start.y)
            ctx.lineTo(this.connectionDrag.point.x, this.connectionDrag.point.y)
            ctx.stroke()
            ctx.setLineDash([])
        }
        for (const widget of this.widgets.values()) widget.render(ctx)

        if (!this.document) {
            ctx.fillStyle = systemStyle.canvas.emptyText
            ctx.font = systemStyle.canvas.emptyFont
            ctx.textAlign = systemStyle.canvas.emptyTextAlign
            ctx.textBaseline = systemStyle.canvas.emptyTextBaseline
            ctx.fillText('Select a system file to begin', (w || 400) / 2, (h || 240) / 2)
        }
    },
}
