import {style} from '../util/index.js'

function copyWire(wire = []) {
    return wire.map(point => ({x: point.x, y: point.y}))
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
    for (const item of patch.pins) setPinGeometry(item.pin, item.left, item.y)
    for (const item of patch.routes) {
        const wire = copyWire(item.wire)
        if (wire.length >= 2) {
            wire[0] = item.route.from.center()
            wire[wire.length - 1] = item.route.to.center()
        }
        item.route.restoreWire(wire)
    }
}

export function restoreLayoutState(state) {
    for (const item of state.nodes) item.node.look.moveTo(item.x, item.y)
    for (const item of state.pins) setPinGeometry(item.pin, item.left, item.y)
    for (const item of state.routes) item.route.restoreWire(copyWire(item.wire))
}
