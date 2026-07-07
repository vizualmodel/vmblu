import {makeDiagnostic} from './layout-types.js'

function clonePoint(point) {
    return {
        x: Math.round(Number(point.x) || 0),
        y: Math.round(Number(point.y) || 0)
    }
}

function portLeft(node, port) {
    const x = Number(port?.x) || 0
    return x < (Number(node?.width) || 0) / 2
}

function lookPosition(node, geometry) {
    return {
        x: Math.round((Number(node?.x) || 0) - (Number(geometry?.offsetX) || 0)),
        y: Math.round((Number(node?.y) || 0) - (Number(geometry?.offsetY) || 0))
    }
}

function preservedPinY(lookY, pin) {
    const oldNodeY = Number(pin?.node?.look?.rect?.y) || 0
    const oldPinY = Number(pin?.rect?.y) || 0
    return Math.round(lookY + oldPinY - oldNodeY)
}

function sectionPoints(section) {
    const points = []
    if (section?.startPoint) points.push(clonePoint(section.startPoint))
    for (const bend of section?.bendPoints ?? []) points.push(clonePoint(bend))
    if (section?.endPoint) points.push(clonePoint(section.endPoint))
    return points
}

function routeWire(edgeRecord, wire) {
    return edgeRecord.route.from === edgeRecord.src ? wire : wire.slice().reverse()
}

export function fromElkResult(result, context) {
    const diagnostics = []
    const nodes = []
    const pins = []
    const routes = []

    for (const child of result?.children ?? []) {
        const node = context.nodeById.get(child.id)
        if (!node) {
            diagnostics.push(makeDiagnostic('unknown-node', `ELK returned an unknown node '${child.id}'.`))
            continue
        }

        const geometry = context.nodeGeometryById.get(child.id)
        const pos = lookPosition(child, geometry)

        nodes.push({
            node,
            uid: child.id,
            x: pos.x,
            y: pos.y
        })

        for (const port of child.ports ?? []) {
            const pin = context.portToPin.get(port.id)
            if (!pin) {
                diagnostics.push(makeDiagnostic('unknown-port', `ELK returned an unknown port '${port.id}'.`))
                continue
            }

            pins.push({
                pin,
                portId: port.id,
                left: portLeft(child, port),
                y: preservedPinY(pos.y, pin)
            })
        }
    }

    for (const edge of result?.edges ?? []) {
        const edgeRecord = context.routeByEdgeId.get(edge.id)
        if (!edgeRecord) {
            diagnostics.push(makeDiagnostic('unknown-route', `ELK returned an unknown edge '${edge.id}'.`))
            continue
        }

        const section = edge.sections?.[0]
        const wire = sectionPoints(section)
        if (wire.length < 2) {
            diagnostics.push(makeDiagnostic('missing-route-section', `ELK edge '${edge.id}' did not contain usable route geometry.`))
            continue
        }

        routes.push({route: edgeRecord.route, connectionId: edge.id, wire: routeWire(edgeRecord, wire)})
    }

    return {
        nodes,
        pins,
        routes,
        meta: {
            algorithm: 'elk-layered',
            direction: 'RIGHT',
            edgeRouting: 'ORTHOGONAL'
        },
        diagnostics
    }
}
