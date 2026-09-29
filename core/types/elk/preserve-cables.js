// Reserve the manually arranged cable network as one obstacle. ELK may move
// this temporary obstacle; the result is translated back to its original origin.
export function cableLayoutRegion(root) {
    if (!root.cables?.length) return null
    const nodes = new Set()
    const pads = new Set()
    const routes = new Set()
    const points = []
    const addRect = rc => {
        if (rc) points.push({x: rc.x, y: rc.y}, {x: rc.x + rc.w, y: rc.y + rc.h})
    }
    for (const cable of root.cables) {
        points.push(...cable.wire)
        for (const tack of cable.tacks) {
            addRect(tack.drawingRect?.())
            addRect(tack.rcAlias)
            if (!tack.route) continue
            routes.add(tack.route)
            for (const endpoint of [tack.route.from, tack.route.to]) {
                if (endpoint?.is.pin) nodes.add(endpoint.node)
                if (endpoint?.is.pad) pads.add(endpoint)
            }
        }
    }
    const contains = endpoint => endpoint?.is.pin ? nodes.has(endpoint.node)
        : endpoint?.is.pad ? pads.has(endpoint) : !!endpoint?.is.tack
    for (const route of root.getConnectionRoutes()) {
        if (contains(route.from) && contains(route.to)) routes.add(route)
    }
    for (const node of nodes) {
        addRect(node.look.rect)
        for (const widget of node.look.widgets) addRect(widget.rect)
    }
    for (const pad of pads) addRect(pad.rect)
    for (const route of routes) points.push(...route.wire)
    if (!points.length) return null
    const x = Math.min(...points.map(p => p.x)) - 20
    const y = Math.min(...points.map(p => p.y)) - 20
    return {
        id: `${root.uid}.preserved-cables`, nodes, pads, routes, contains,
        x, y,
        width: Math.max(...points.map(p => p.x)) + 20 - x,
        height: Math.max(...points.map(p => p.y)) + 20 - y
    }
}
