import {style} from '../util/index.js'

function copyWire(wire = []) {
    return wire.map(point => ({x: point.x, y: point.y}))
}

function attachEndpoints(wire, route) {
    const from = route.from.center()
    const to = route.to.center()
    if (wire.length === 2) {
        if (from.y === to.y || from.x === to.x) return [from, to]
        const x = (from.x + to.x) / 2
        return [from, {x, y: from.y}, {x, y: to.y}, to]
    }
    const last = wire.length - 1
    // ELK rounds port coordinates; vmblu's 15-unit rows have half-unit
    // centres. Move the neighbouring bend too, retaining orthogonal legs.
    if (wire[0].y === wire[1].y) wire[1].y = from.y
    else wire[1].x = from.x
    if (wire[last].y === wire[last - 1].y) wire[last - 1].y = to.y
    else wire[last - 1].x = to.x
    wire[0] = from
    wire[last] = to
    return wire
}

function setPinGeometry(pin, left, y) {
    const rc = pin.node.look.rect
    pin.is.left = !!left
    pin.rect.x = pin.is.left
        ? rc.x - style.pin.wOutside
        : rc.x + rc.w - pin.rect.w + style.pin.wOutside
    pin.rect.y = y
}

export function captureLayoutState(patch) {
    return {
        nodes: patch.nodes.map(item => ({
            node: item.node,
            x: item.node.look.rect.x,
            y: item.node.look.rect.y
        })),
        pads: (patch.pads ?? []).map(item => ({
            pad: item.pad,
            x: item.pad.rect.x,
            y: item.pad.rect.y,
            leftText: item.pad.is.leftText
        })),
        pins: patch.pins.map(item => ({
            pin: item.pin,
            left: item.pin.is.left,
            y: item.pin.rect.y
        })),
        routes: patch.routes.map(item => ({
            route: item.route,
            wire: item.route.copyWire()
        }))
    }
}

export function applyLayoutPatch(patch) {
    for (const item of patch.nodes) item.node.look.moveTo(item.x, item.y)
    for (const item of patch.pads ?? []) {
        item.pad.rect.x = item.x
        item.pad.rect.y = item.y
        item.pad.is.leftText = item.leftText
    }
    for (const item of patch.pins) setPinGeometry(item.pin, item.left, item.y)
    for (const item of patch.routes) {
        const wire = copyWire(item.wire)
        item.route.restoreWire(wire.length >= 2 ? attachEndpoints(wire, item.route) : wire)
    }
}

export function restoreLayoutState(state) {
    for (const item of state.nodes) item.node.look.moveTo(item.x, item.y)
    for (const item of state.pads ?? []) {
        item.pad.rect.x = item.x
        item.pad.rect.y = item.y
        item.pad.is.leftText = item.leftText
    }
    for (const item of state.pins) setPinGeometry(item.pin, item.left, item.y)
    for (const item of state.routes) item.route.restoreWire(copyWire(item.wire))
}
