import {makeDiagnostic} from './layout-types.js'

function pinPortId(pin) {
    const uid = pin?.node?.uid ?? pin?.node?.name ?? 'node'
    const wid = pin?.wid || pin?.name || 'pin'
    const direction = pin?.is?.input ? 'in' : 'out'
    return `${uid}.${direction}.${wid}`
}

function routeEdgeId(index) {
    return `route.${index}`
}

function visiblePins(node) {
    return (node?.look?.widgets ?? [])
        .filter(widget => widget?.is?.pin && !widget.is.zombie)
        .sort((a, b) => a.rect.y - b.rect.y)
}

function nodeLayoutGeometry(node) {
    const lookRect = node?.look?.rect
    const boxRect = node?.look?.widgets?.find(widget => widget?.is?.box)?.rect
    const rect = boxRect ?? lookRect

    return {
        rect,
        lookRect,
        offsetX: Number(rect?.x) - Number(lookRect?.x),
        offsetY: Number(rect?.y) - Number(lookRect?.y)
    }
}

function fixedPortGeometry(pin, fixedPorts) {
    const fixed = fixedPorts?.get?.(pinPortId(pin))
    if (!fixed) return {}

    return {
        x: fixed.x,
        y: fixed.y,
        layoutOptions: {
            'org.eclipse.elk.port.side': fixed.side
        }
    }
}

function routeEndpoints(route) {
    const [src, dst] = route.messageFlow()
    if (!src?.is?.pin || !dst?.is?.pin) return null
    return {src, dst}
}

export function toElkGraph(root, options = {}, constraints = {}) {
    const diagnostics = []
    const nodes = (root?.nodes ?? []).filter(node => node?.look?.rect && node?.uid)
    const nodeSet = new Set(nodes)
    const pinToPortId = new Map()
    const portToPin = new Map()
    const nodeById = new Map()
    const nodeGeometryById = new Map()

    const children = nodes.map(node => {
        const geometry = nodeLayoutGeometry(node)
        const rect = geometry.rect
        const nodeLayoutOptions = constraints.fixedPorts ? {'org.eclipse.elk.portConstraints': 'FIXED_POS'} : undefined
        const ports = visiblePins(node).map(pin => {
            const id = pinPortId(pin)
            pinToPortId.set(pin, id)
            portToPin.set(id, pin)
            return {
                id,
                width: 8,
                height: 8,
                ...fixedPortGeometry(pin, constraints.fixedPorts)
            }
        })

        nodeById.set(node.uid, node)
        nodeGeometryById.set(node.uid, geometry)

        return {
            id: node.uid,
            width: Math.max(1, rect.w),
            height: Math.max(1, rect.h),
            ports,
            ...(nodeLayoutOptions ? {layoutOptions: nodeLayoutOptions} : {})
        }
    })

    const routeByEdgeId = new Map()
    const edges = []
    const routes = root?.getInternalRoutes?.(nodes) ?? []

    routes.forEach((route, index) => {
        const endpoints = routeEndpoints(route)
        if (!endpoints) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Only pin-to-pin routes are supported in ELK auto-layout.'))
            return
        }

        if (!nodeSet.has(endpoints.src.node) || !nodeSet.has(endpoints.dst.node)) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Route endpoint node is outside the layout root.'))
            return
        }

        const source = pinToPortId.get(endpoints.src)
        const target = pinToPortId.get(endpoints.dst)
        if (!source || !target) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Route endpoint pin could not be mapped to an ELK port.'))
            return
        }

        const id = routeEdgeId(index)
        routeByEdgeId.set(id, {route, src: endpoints.src, dst: endpoints.dst})
        edges.push({id, sources: [source], targets: [target]})
    })

    return {
        graph: {
            id: root?.uid ?? root?.name ?? 'vmblu-root',
            layoutOptions: {...options},
            children,
            edges
        },
        context: {nodeById, nodeGeometryById, portToPin, routeByEdgeId},
        diagnostics
    }
}
