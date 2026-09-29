import {style} from '../util/index.js'

// Pads are boundary ports, not independent nodes. Fixed port positions keep
// pin-sized rows together while ELK routes around the complete label column.
export function padColumns(root, pads, endpointIds) {
    const columns = new Map()
    for (const input of [true, false]) {
        const ordered = pads.filter(pad => !!pad.proxy.is.input === input)
            .sort((a, b) => a.proxy.rect.y - b.proxy.rect.y)
        if (!ordered.length) continue
        const id = `${root.uid}.pads.${input ? 'input' : 'output'}`
        const width = Math.max(...ordered.map(pad => pad.rect.w), 1)
        let y = 0
        let previousInterface
        const rows = ordered.map((pad, index) => {
            const ifName = pad.proxy.node?.look?.findIfNameAbove?.(pad.proxy.rect.y)
            if (index && ifName !== previousInterface) y += style.pin.hPin
            previousInterface = ifName
            const row = {pad, id: `${id}.${index}`, x: input ? width - pad.rect.w : 0, y}
            endpointIds.set(pad, row.id)
            y += Math.max(style.pin.hPin, pad.rect.h)
            return row
        })
        columns.set(id, {id, width, height: y, rows, input})
    }
    return columns
}

export function padColumnGraph(column) {
    return {
        id: column.id, width: column.width, height: column.height,
        layoutOptions: {
            'org.eclipse.elk.portConstraints': 'FIXED_POS',
            'org.eclipse.elk.layered.layering.layerConstraint': column.input ? 'FIRST_SEPARATE' : 'LAST_SEPARATE'
        },
        ports: column.rows.map(row => ({
            id: row.id, width: 0, height: 0,
            x: column.input ? column.width : 0,
            y: row.y + row.pad.rect.h / 2,
            layoutOptions: {'org.eclipse.elk.port.side': column.input ? 'EAST' : 'WEST'}
        }))
    }
}
