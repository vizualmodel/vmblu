import {makeDiagnostic} from './layout-types.js'
import {padColumns, padColumnGraph} from './pad-columns.js'

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
    if (!(src?.is?.pin || src?.is?.pad) || !(dst?.is?.pin || dst?.is?.pad)) return null
    return {src, dst}
}

export function toElkGraph(root, options = {}, constraints = {}) {
    const diagnostics = []
    const region = constraints.region
    const nodes = (root?.nodes ?? []).filter(node => node?.look?.rect && node?.uid)
    const nodeSet = new Set(nodes)
    const pinToPortId = new Map()
    const padToNodeId = new Map()
    const portToPin = new Map()
    const nodeById = new Map()
    const nodeGeometryById = new Map()

    const nodeChildren = nodes.filter(node => !region?.nodes.has(node)).map(node => {
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

    const pads = (root?.pads ?? []).filter(pad => pad?.rect && pad?.proxy)
    const padSet = new Set(pads)
    const columns = padColumns(root, pads.filter(pad => !region?.pads.has(pad)), padToNodeId)
    const children = [...nodeChildren, ...[...columns.values()].map(padColumnGraph)]
    let regionChild
    if (region) {
        regionChild = {
            id: region.id, width: region.width, height: region.height, ports: [],
            layoutOptions: {'org.eclipse.elk.portConstraints': 'FIXED_POS'}
        }
        children.push(regionChild)
    }
    const fixedEndpoints = new Map()
    const endpointId = endpoint => {
        if (!region?.contains(endpoint)) return endpoint.is.pin ? pinToPortId.get(endpoint) : padToNodeId.get(endpoint)
        if (fixedEndpoints.has(endpoint)) return fixedEndpoints.get(endpoint)
        const id = `${region.id}.port.${fixedEndpoints.size}`
        const left = endpoint.is.pin ? endpoint.is.left : !endpoint.is.leftText
        regionChild.ports.push({
            id, width: 0, height: 0,
            x: left ? 0 : region.width,
            y: endpoint.center().y - region.y,
            layoutOptions: {'org.eclipse.elk.port.side': left ? 'WEST' : 'EAST'}
        })
        fixedEndpoints.set(endpoint, id)
        return id
    }

    const routeByEdgeId = new Map()
    const edges = []
    const routes = root?.getConnectionRoutes?.() ?? root?.getInternalRoutes?.(nodes) ?? []

    routes.forEach((route, index) => {
        if (region?.routes.has(route)) return
        const endpoints = routeEndpoints(route)
        if (!endpoints) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Only node-pin and group-pad routes are supported in ELK auto-layout.'))
            return
        }

        const endpointIsInRoot = endpoint => endpoint.is.pin ? nodeSet.has(endpoint.node) : padSet.has(endpoint)
        if (!endpointIsInRoot(endpoints.src) || !endpointIsInRoot(endpoints.dst)) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Route endpoint node is outside the layout root.'))
            return
        }

        const source = endpointId(endpoints.src)
        const target = endpointId(endpoints.dst)
        if (!source || !target) {
            diagnostics.push(makeDiagnostic('route-skipped', 'Route endpoint could not be mapped into the ELK graph.'))
            return
        }

        const id = routeEdgeId(index)
        routeByEdgeId.set(id, {route, src: endpoints.src, dst: endpoints.dst,
            boundary: !!region && (region.contains(endpoints.src) || region.contains(endpoints.dst))})
        edges.push({id, sources: [source], targets: [target]})
    })

    return {
        graph: {
            id: root?.uid ?? root?.name ?? 'vmblu-root',
            layoutOptions: {...options},
            children,
            edges
        },
        context: {nodeById, columns, region, nodeGeometryById, portToPin, routeByEdgeId},
        diagnostics
    }
}
