import ELK from 'elkjs/lib/elk.bundled.js'

import {defaultElkOptions} from './elk-options.js'
import {toElkGraph} from './to-elk-graph.js'
import {fromElkResult} from './from-elk-result.js'
import {fail, ok} from './layout-types.js'

function portSide(node, port) {
    const x = Number(port?.x) || 0
    return x < (Number(node?.width) || 0) / 2 ? 'WEST' : 'EAST'
}

function portX(node, side) {
    const width = Number(node?.rect?.w) || 0
    const portWidth = 8
    return side === 'WEST' ? 0 : Math.max(0, width - portWidth)
}

function portY(pin, nodeGeometry) {
    const nodeY = Number(nodeGeometry?.rect?.y) || 0
    const pinY = Number(pin?.rect?.y) || 0
    const pinH = Number(pin?.rect?.h) || 0
    const portH = 8
    return Math.round(pinY - nodeY + pinH / 2 - portH / 2)
}

function fixedPortsFromResult(result, context) {
    const fixedPorts = new Map()

    for (const child of result?.children ?? []) {
        for (const port of child.ports ?? []) {
            const pin = context.portToPin.get(port.id)
            if (!pin) continue

            const side = portSide(child, port)
            const nodeGeometry = context.nodeGeometryById.get(pin.node.uid)
            fixedPorts.set(port.id, {
                side,
                x: portX(nodeGeometry, side),
                y: portY(pin, nodeGeometry)
            })
        }
    }

    return fixedPorts
}

export async function layoutElk(root, options = {}) {
    if (!root?.nodes) return fail('No model root is available for auto-layout.')

    const layoutOptions = {...defaultElkOptions, ...options}
    const {graph, context, diagnostics} = toElkGraph(root, layoutOptions)

    if (!graph.children?.length) return fail('No nodes are available for auto-layout.', diagnostics)

    try {
        const elk = new ELK()
        const initialResult = await elk.layout(graph)
        const fixedPorts = fixedPortsFromResult(initialResult, context)
        const fixedProjection = toElkGraph(root, layoutOptions, {fixedPorts})
        const result = await elk.layout(fixedProjection.graph)
        const patch = fromElkResult(result, fixedProjection.context)
        return ok(patch, [...diagnostics, ...patch.diagnostics])
    }
    catch (error) {
        diagnostics.push({
            code: 'elk-layout-failed',
            message: error?.message ?? String(error)
        })
        return fail('ELK auto-layout failed.', diagnostics)
    }
}
