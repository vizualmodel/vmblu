import {Route} from '../node/index.js'

function copyWire(wire = []) {
    return wire.map(point => ({x: point.x, y: point.y}))
}

function visiblePins(node) {
    return (node?.look?.widgets ?? []).filter(widget => widget?.is?.pin)
}

function collectRoutes(root) {
    const seen = new Set()
    const routes = []
    const addRoute = (route) => {
        if (!route?.is?.route || seen.has(route)) return
        seen.add(route)
        routes.push(route)
    }

    for (const node of root?.nodes ?? []) {
        for (const pin of visiblePins(node)) {
            for (const route of pin.routes ?? []) addRoute(route)
        }
    }

    for (const pad of root?.pads ?? []) {
        for (const route of pad.routes ?? []) addRoute(route)
    }

    for (const cable of root?.cables ?? []) {
        for (const tack of cable.tacks ?? []) addRoute(tack.route)
    }

    return routes
}

function disconnectAllRoutes(root) {
    for (const route of collectRoutes(root)) route.disconnect()
}

function removeAllCables(root) {
    for (const cable of root?.cables?.slice?.() ?? []) root.removeCable(cable)
}

function logicalConnections(root) {
    const [, rawConnections] = root.getRoutesAndConnections()
    return root.cookConx(rawConnections)
        .filter(cx => cx?.src?.is?.pin && cx?.dst?.is?.pin)
}

function createDirectRoute(root, src, dst) {
    const route = new Route(src, null)
    src.routes.push(route)

    if (!route.connect(dst)) {
        src.routes.pop()
        return null
    }

    route.autoRoute(root.nodes)
    return route
}

export function captureAutoLayoutState(root) {
    return {
        nodes: (root?.nodes ?? []).map(node => ({
            node,
            x: node.look.rect.x,
            y: node.look.rect.y
        })),
        pins: (root?.nodes ?? []).flatMap(node =>
            visiblePins(node).map(pin => ({
                pin,
                left: pin.is.left,
                x: pin.rect.x,
                y: pin.rect.y
            }))
        ),
        cables: (root?.cables ?? []).map(cable => ({
            cable,
            node: cable.node,
            wire: copyWire(cable.wire),
            tacks: cable.tacks.slice()
        })),
        routes: collectRoutes(root).map(route => ({
            route,
            from: route.from,
            to: route.to,
            wire: route.copyWire()
        }))
    }
}

export function restoreAutoLayoutState(root, state) {
    if (!root || !state) return

    disconnectAllRoutes(root)
    removeAllCables(root)

    for (const item of state.nodes ?? []) item.node.look.moveTo(item.x, item.y)
    for (const item of state.pins ?? []) {
        item.pin.is.left = item.left
        item.pin.rect.x = item.x
        item.pin.rect.y = item.y
    }

    for (const item of state.cables ?? []) {
        item.cable.node = item.node ?? root
        item.cable.wire = copyWire(item.wire)
        item.cable.tacks.length = 0
        root.restoreCable(item.cable)
    }

    for (const item of state.routes ?? []) {
        item.route.from = item.from
        item.route.to = item.to
        item.route.restoreWire(item.wire)
        item.route.reconnect()
    }
}

export function normalizeLayoutRoutes(root) {
    const connections = logicalConnections(root)

    disconnectAllRoutes(root)
    removeAllCables(root)

    const routes = []
    for (const cx of connections) {
        const route = createDirectRoute(root, cx.src, cx.dst)
        if (route) routes.push(route)
    }

    return routes
}
