import {bundleRect, bundleRepresentative, bundleMembers} from '../widget/pin-bundle.js'
import {style} from '../util/style.js'
import {routeMoving} from './route-moving.js'

function bundleEndpoint(widget) {
    if (!widget?.is.pin) return widget
    return bundleRepresentative(widget)
}

function bundleRouteKey(route) {
    return [route.from, route.to].map(widget => `${widget.node?.uid ?? ''}.${widget.wid ?? ''}:${widget.name ?? ''}`).sort().join('|')
}

function bundleCenter(widget) {
    if (!widget?.is.pin) return widget?.center?.()
    const rect = bundleRect(widget)
    return {x: widget.is.left ? rect.x + style.pin.wOutside : rect.x + rect.w - style.pin.wOutside, y: rect.y + rect.h / 2}
}

function bundleSegmentIsHorizontal(a, b) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y)
    // ELK rounds bends to whole pixels while pin centers can be half-pixels.
    // Prefer the dominant axis so short vertical segments stay vertical.
    return dy === 0 || (dy <= 1 && dx > dy)
}

export function projectBundleRouteWire(representative) {
    if (![representative.from, representative.to].some(widget => widget?.is.pin && widget.node.look.widgets.some(pin => pin.bundle))) return representative.wire
    const wire = representative.wire.map(point => ({...point}))
    if (wire.length < 2) return wire
    if (wire.length === 2) {
        const a = representative.from?.is.pin ? bundleCenter(representative.from) : wire[0]
        const b = representative.to?.is.pin ? bundleCenter(representative.to) : wire[1]
        if (a.x === b.x || a.y === b.y) return [a, b]
        const x = (a.x + b.x) / 2
        return [a, {x, y: a.y}, {x, y: b.y}, b]
    }
    for (const [widget, start] of [[representative.from, true], [representative.to, false]]) {
        if (!widget?.is.pin) continue
        const center = bundleCenter(widget)
        const index = start ? 0 : wire.length - 1
        const adjacent = start ? 1 : wire.length - 2
        const old = wire[index]
        if (bundleSegmentIsHorizontal(wire[adjacent], old)) wire[adjacent].y = center.y
        else wire[adjacent].x = center.x
        wire[index] = center
    }
    return wire
}

// Work on exactly the projected wire used by rendering and hit-testing. The
// logical wire is left intact until release, so a click alone never edits it.

export const routeBundle = {
    bundleRoutes() {
        if (!this.to || (!this.from?.bundle && !this.to?.bundle)) return [this]
        const from = bundleEndpoint(this.from), to = bundleEndpoint(this.to)
        const candidates = from.is.pin ? bundleMembers(from).flatMap(pin => pin.routes) : from.routes ?? [this]
        return [...new Set(candidates)].filter(other => other.to && (
            (bundleEndpoint(other.from) === from && bundleEndpoint(other.to) === to) ||
            (bundleEndpoint(other.from) === to && bundleEndpoint(other.to) === from)))
            .sort((a, b) => bundleRouteKey(a).localeCompare(bundleRouteKey(b)))
    },

    bundleRouteWire() {
        const representative = this.bundleRoutes()[0] ?? this
        if (representative.bundleDrag) return representative.bundleDrag.wire
        if (!representative.to && representative.bundlePreviewTarget)
            return projectBundleRouteWire({...representative, to: representative.bundlePreviewTarget})
        return projectBundleRouteWire(representative)
    },

    setBundlePreviewTarget(widget) {
        if (widget?.is.pin) this.bundlePreviewTarget = widget
        else delete this.bundlePreviewTarget
    },

    // Keep logical geometry intact until release; a click alone never edits it.
    beginBundleRouteDrag(segment) {
        if (![this.from, this.to].some(widget => widget?.is.pin && widget.node.look.widgets.some(pin => pin.bundle))) return false
        // Movable pads and tacks still use their ordinary slide handling.
        const wire = this.bundleRouteWire()
        if ((segment === 1 && !this.from.is.pin) ||
            (segment === wire.length - 1 && !this.to.is.pin)) return false
        this.bundleDrag = {
            wire: wire.map(point => ({...point})),
            segment,
            moved: false,
        }
        return true
    },

    moveBundleRouteDrag(delta) {
        const drag = this.bundleDrag
        if (!drag) return false
        const s = drag.segment
        const wire = drag.wire
        const a = wire[s - 1], b = wire[s]
        if (!a || !b) return true
        const horizontal = a.y === b.y
        const distance = horizontal ? delta.y : delta.x
        if (!distance) return true

        // Pin-anchored end segments stay fixed, just like ordinary routes.
        if (s === 1 || s === wire.length - 1) return true
        const axis = horizontal ? 'y' : 'x'
        wire[s - 1][axis] += distance
        wire[s][axis] += distance
        drag.moved = true
        return true
    },

    endBundleRouteDrag() {
        const drag = this.bundleDrag
        if (!drag) return false
        delete this.bundleDrag
        if (!drag.moved) return true
        // Fuse in displayed coordinates before restoring the logical endpoints.
        // Collapsed rows can put displayed segments close together even when
        // their expanded coordinates are far apart.
        routeMoving.endDrag.call({...routeMoving, wire: drag.wire, from: this.from, to: this.to}, drag.segment)
        this.restoreBundleRouteWire(drag.wire)
        return true
    },

    restoreBundleRouteWire(displayedWire) {
        const wire = displayedWire.map(point => ({...point}))
        // A visually straight pin-to-pad line may have different expanded
        // endpoint heights. Keep both anchors when restoring that geometry.
        if (wire.length === 2) {
            const from = this.from?.is.pin ? this.from.center() : wire[0]
            const to = this.to?.is.pin ? this.to.center() : wire[1]
            if (from.y !== to.y && wire[0].y === wire[1].y) {
                const x = (wire[0].x + wire[1].x) / 2
                wire.splice(1, 0, {x, y: wire[0].y}, {x, y: wire[1].y})
            }
        }
        // Undo the endpoint projection only. Interior bends stay where the user
        // placed them; expansion exposes this edit on the representative alone.
        for (const [widget, start] of [[this.from, true], [this.to, false]]) {
            if (!widget?.is.pin) continue
            const index = start ? 0 : wire.length - 1
            const adjacent = start ? 1 : wire.length - 2
            const center = widget.center()
            const horizontal = bundleSegmentIsHorizontal(wire[adjacent], wire[index])
            if (horizontal) wire[adjacent].y = center.y
            else wire[adjacent].x = center.x
            wire[index] = {...center}
        }
        this.restoreWire(wire)
    },

    bundleRouteDetails() {
        return this.bundleRoutes().map(member => `${member.from.name ?? member.from.text} → ${member.to.name ?? member.to.text}`).join('\n')
    },
}
