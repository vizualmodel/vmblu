import {style} from '../util/index.js'

export const NodePlacement = {

// Place the node as the root node in a view
placeRoot() {
    // The root is not a container - make some extra margins
    const place = style.placement

    // move the node to its location
    this.look.moveTo( place.marginLeft , place.marginTop)

    // set the flag
    this.is.placed = true
},

// places all unplaced nodes according to a grid
placeNodesRowFirst(rawConnections) {

    const unplaced = this.nodes.filter(node => node?.look && !node.is.placed)
    if (!unplaced.length) return

    const place = style.placement
    const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft
    const spacing = place.spacing
    const tolerance = place.tolerance

    const degree = new Map()
    for (const raw of rawConnections ?? []) {
        const src = raw.src ?? raw.from
        const dstList = Array.isArray(raw.dst) ? raw.dst : [raw.dst ?? raw.to]

        for (const dst of dstList) {
            if (!src?.node || !dst?.node) continue
            degree.set(src.node, (degree.get(src.node) ?? 0) + 1)
            degree.set(dst.node, (degree.get(dst.node) ?? 0) + 1)
        }
    }

    const placedNodes = this.nodes.filter(node => node?.look && node.is.placed)
    const expand = rect => ({x: rect.x - spacing, y: rect.y - spacing, w: rect.w + 2 * spacing, h: rect.h + 2 * spacing})
    const overlap = (a, b) => !((a.x + a.w <= b.x) || (a.x >= b.x + b.w) || (a.y + a.h <= b.y) || (a.y >= b.y + b.h))

    const order = unplaced.slice().sort((a, b) => {
        const da = degree.get(a.name) ?? 0
        const db = degree.get(b.name) ?? 0
        return db - da
    })

    for (let i = 0; i < order.length; i++) {
        const node = order[i]
        const col = i % place.nodesPerRow
        const columnX = marginLeft + col * place.colStep

        let y = place.marginTop
        for (const other of placedNodes) {
            const ox = other.look.rect.x
            if (Math.abs(ox - columnX) <= tolerance) {
                const bottom = other.look.rect.y + other.look.rect.h
                if (bottom + spacing > y) y = bottom + spacing
            }
        }

        let candidate = {x: columnX, y, w: node.look.rect.w, h: node.look.rect.h}
        while (placedNodes.some(other => overlap(expand(candidate), expand(other.look.rect)))) {
            candidate.y += spacing
        }

        node.look.moveTo(candidate.x, candidate.y)
        node.is.placed = true
        placedNodes.push(node)
    }
},

// places all unplaced nodes using a center-first column policy.
// Disconnected components are placed as separate vertical blocks.
// Degree-1 nodes may be placed one column farther out as leaf satellites.
placeNodesColumnFirst(rawConnections) {

    const unplaced = this.nodes.filter(node => node?.look && !node.is.placed)
    if (!unplaced.length) return

    const place = style.placement
    const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft
    const spacing = place.spacing
    const tolerance = place.tolerance

    const degree = new Map()
    const adjacency = new Map()
    const padAffinity = new Map()
    const addEdge = (a, b) => {
        degree.set(a, (degree.get(a) ?? 0) + 1)
        degree.set(b, (degree.get(b) ?? 0) + 1)

        if (!adjacency.has(a)) adjacency.set(a, new Map())
        if (!adjacency.has(b)) adjacency.set(b, new Map())

        const ab = adjacency.get(a)
        const ba = adjacency.get(b)
        ab.set(b, (ab.get(b) ?? 0) + 1)
        ba.set(a, (ba.get(a) ?? 0) + 1)
    }

    const addPadAffinity = (nodeName, leftSide) => {
        if (!nodeName) return
        const rec = padAffinity.get(nodeName) ?? {left: 0, right: 0}
        leftSide ? rec.left++ : rec.right++
        padAffinity.set(nodeName, rec)
    }

    const findPadSide = endPoint => {
        if (!endPoint?.pad) return null

        let pad = null
        if (endPoint.wid != null) pad = this.pads.find(p => p?.proxy?.wid === endPoint.wid)
        if (!pad) pad = this.pads.find(p => p?.proxy?.name === endPoint.pad)
        if (!pad) return null

        return !!pad.is.leftText
    }

    for (const raw of rawConnections ?? []) {
        const src = raw.src ?? raw.from
        const dstList = Array.isArray(raw.dst) ? raw.dst : [raw.dst ?? raw.to]

        for (const dst of dstList) {

            if (src?.node && dst?.node) {
                if (src.node === dst.node) continue
                addEdge(src.node, dst.node)
                continue
            }

            if (src?.node && dst?.pad) {
                const leftSide = findPadSide(dst)
                if (leftSide != null) addPadAffinity(src.node, leftSide)
                continue
            }

            if (src?.pad && dst?.node) {
                const leftSide = findPadSide(src)
                if (leftSide != null) addPadAffinity(dst.node, leftSide)
            }
        }
    }

    const byName = new Map(unplaced.map(node => [node.name, node]))
    const remaining = new Set(unplaced.map(node => node.name))
    const columnCount = 5
    const outerLeftCol = 0
    const leftCol = 1
    const centerCol = 2
    const rightCol = 3
    const outerRightCol = 4

    const compareByDegree = (a, b) => {
        const da = degree.get(a) ?? 0
        const db = degree.get(b) ?? 0
        if (db !== da) return db - da
        return a.localeCompare(b)
    }

    const compareNeighbor = (center, a, b) => {
        const wa = adjacency.get(center)?.get(a) ?? 0
        const wb = adjacency.get(center)?.get(b) ?? 0
        if (wb !== wa) return wb - wa
        return compareByDegree(a, b)
    }
    const padSideScore = (name, side) => {
        const rec = padAffinity.get(name)
        if (!rec) return 0
        return side === 'left' ? rec.left - rec.right : rec.right - rec.left
    }
    const neighborCount = name => adjacency.get(name)?.size ?? 0
    const isLeaf = name => neighborCount(name) === 1

    const takeBestFromSet = (set, compareFn) => {
        let best = null
        for (const name of set) {
            if (!best || compareFn(name, best) < 0) best = name
        }
        if (!best) return null
        set.delete(best)
        return best
    }

    const placedNodes = this.nodes.filter(node => node?.look && node.is.placed)
    const expand = rect => ({x: rect.x - spacing, y: rect.y - spacing, w: rect.w + 2 * spacing, h: rect.h + 2 * spacing})
    const overlap = (a, b) => !((a.x + a.w <= b.x) || (a.x >= b.x + b.w) || (a.y + a.h <= b.y) || (a.y >= b.y + b.h))
    const coreLeftX = marginLeft
    const xByColumn = [
        coreLeftX - place.colStep,
        coreLeftX,
        coreLeftX + place.colStep,
        coreLeftX + 2 * place.colStep,
        coreLeftX + 3 * place.colStep
    ]

    // Start below any already placed node occupying one of the target columns.
    let y = place.marginTop
    for (const other of placedNodes) {
        const ox = other.look.rect.x
        if (xByColumn.some(x => Math.abs(ox - x) <= tolerance)) {
            const bottom = other.look.rect.y + other.look.rect.h
            if (bottom + spacing > y) y = bottom + spacing
        }
    }

    const rows = []

    const takeBestCenter = () => {
        const nonLeaf = new Set([...remaining].filter(name => !isLeaf(name)))
        if (nonLeaf.size) return takeBestFromSet(nonLeaf, compareByDegree)
        return takeBestFromSet(remaining, compareByDegree)
    }

    const takeBestCoreNeighbor = center => {
        const candidates = new Set(
            [...remaining].filter(name => !isLeaf(name) && (adjacency.get(center)?.has(name)))
        )
        if (candidates.size) {
            const chosen = takeBestFromSet(candidates, (a, b) => compareNeighbor(center, a, b))
            remaining.delete(chosen)
            return chosen
        }

        const fallback = new Set(
            [...remaining].filter(name => adjacency.get(center)?.has(name))
        )
        if (fallback.size) {
            const chosen = takeBestFromSet(fallback, (a, b) => compareNeighbor(center, a, b))
            remaining.delete(chosen)
            return chosen
        }

        return null
    }

    const takeLeafForSlot = (anchors) => {
        let best = null
        for (const name of remaining) {
            if (!isLeaf(name)) continue
            const onlyNeighbor = adjacency.get(name)?.keys()?.next()?.value
            if (!anchors.includes(onlyNeighbor)) continue
            if (!best || compareByDegree(name, best) < 0) best = name
        }
        if (!best) return null
        remaining.delete(best)
        return best
    }

    const takeLeafForCenter = center => {
        let best = null
        for (const name of remaining) {
            if (!isLeaf(name)) continue
            const onlyNeighbor = adjacency.get(name)?.keys()?.next()?.value
            if (onlyNeighbor !== center) continue
            if (!best || compareByDegree(name, best) < 0) best = name
        }
        if (!best) return null
        remaining.delete(best)
        return best
    }

    while (remaining.size) {
        const satelliteRow = Array(columnCount).fill(null)
        let satelliteCenter = null
        for (let i = rows.length - 1; i >= 0; i--) {
            const priorCenter = rows[i][centerCol]
            if (!priorCenter) continue

            const leftLeaf = takeLeafForCenter(priorCenter)
            const rightLeaf = takeLeafForCenter(priorCenter)
            if (!leftLeaf && !rightLeaf) continue

            satelliteCenter = priorCenter
            satelliteRow[outerLeftCol] = leftLeaf
            satelliteRow[outerRightCol] = rightLeaf
            break
        }
        if (satelliteCenter) {
            rows.push(satelliteRow)
            continue
        }

        const center = takeBestCenter()
        if (!center) break
        remaining.delete(center)

        const row = Array(columnCount).fill(null)
        row[centerCol] = center

        row[leftCol] = takeBestCoreNeighbor(center)
        row[rightCol] = takeBestCoreNeighbor(center)

        // If we have two side candidates, assign them to left/right to better match pad-heavy sides.
        if (row[leftCol] && row[rightCol]) {
            const keepScore = padSideScore(row[leftCol], 'left') + padSideScore(row[rightCol], 'right')
            const swapScore = padSideScore(row[leftCol], 'right') + padSideScore(row[rightCol], 'left')
            if (swapScore > keepScore) [row[leftCol], row[rightCol]] = [row[rightCol], row[leftCol]]
        }

        // Prefer leaves attached to side nodes, otherwise center-attached leaves.
        row[outerLeftCol] = takeLeafForSlot([row[leftCol], center].filter(Boolean))
        row[outerRightCol] = takeLeafForSlot([row[rightCol], center].filter(Boolean))

        // Queue extra center-attached leaves by keeping them in `remaining`.
        // They will be emitted as satellite rows before the next new center is chosen.

        rows.push(row)
    }

    // Normalize sparse rows so "holes" prefer the center column.
    // This avoids visual patterns like [left + center] or [center only].
    const normalizedRows = []
    const pendingSingles = []

    for (const row of rows) {
        const hasOuter = !!row[outerLeftCol] || !!row[outerRightCol]
        const hasLeft = !!row[leftCol]
        const hasCenter = !!row[centerCol]
        const hasRight = !!row[rightCol]

        // Keep satellite rows and richer rows as-is.
        if (hasOuter) {
            normalizedRows.push(row)
            continue
        }

        // Convert [left + center] -> [left + right]
        if (hasLeft && hasCenter && !hasRight) {
            row[rightCol] = row[centerCol]
            row[centerCol] = null
            normalizedRows.push(row)
            continue
        }

        // Convert [center + right] -> [left + right]
        if (!hasLeft && hasCenter && hasRight) {
            row[leftCol] = row[centerCol]
            row[centerCol] = null
            normalizedRows.push(row)
            continue
        }

        // Queue [center only] rows and repack them as side-only rows.
        if (!hasLeft && hasCenter && !hasRight) {
            pendingSingles.push(row[centerCol])
            continue
        }

        normalizedRows.push(row)
    }

    const takePendingSingle = side => {
        if (!pendingSingles.length) return null
        let bestIndex = 0
        for (let i = 1; i < pendingSingles.length; i++) {
            const a = pendingSingles[i]
            const b = pendingSingles[bestIndex]
            const sa = padSideScore(a, side)
            const sb = padSideScore(b, side)
            if (sa !== sb) {
                if (sa > sb) bestIndex = i
                continue
            }
            if (compareByDegree(a, b) < 0) bestIndex = i
        }
        return pendingSingles.splice(bestIndex, 1)[0] ?? null
    }

    while (pendingSingles.length) {
        const row = Array(columnCount).fill(null)
        row[leftCol] = takePendingSingle('left')
        row[rightCol] = takePendingSingle('right')
        normalizedRows.push(row)
    }

    for (const row of normalizedRows) {
        const rowNodes = row
            .map((name, col) => name ? {node: byName.get(name), col} : null)
            .filter(item => item?.node)

        if (!rowNodes.length) continue

        let candidates = rowNodes.map(({node, col}) => ({
            node,
            x: xByColumn[col],
            y,
            w: node.look.rect.w,
            h: node.look.rect.h
        }))

        while (candidates.some(candidate => placedNodes.some(other => overlap(expand(candidate), expand(other.look.rect))))) {
            y += spacing
            candidates = rowNodes.map(({node, col}) => ({
                node,
                x: xByColumn[col],
                y,
                w: node.look.rect.w,
                h: node.look.rect.h
            }))
        }

        let rowBottom = y
        for (const candidate of candidates) {
            candidate.node.look.moveTo(candidate.x, candidate.y)
            candidate.node.is.placed = true
            placedNodes.push(candidate.node)

            const bottom = candidate.y + candidate.node.look.rect.h
            if (bottom > rowBottom) rowBottom = bottom
        }

        y = rowBottom + spacing
    }
},

// Pads are cooked before child nodes are auto-placed. After placement, pad rectangles
// can end up in the node field. Push non-fixed pads into left/right pad gutters
// outside the node area (x only), while respecting explicit pad placement.
checkPadOverlap() {

    if (!this.pads?.length || !this.nodes?.length) return

    const pads = this.pads.filter(pad => pad?.rect)
    const nodes = this.nodes.filter(node => node?.look?.rect)
    if (!pads.length || !nodes.length) return

    const gap = style.placement.padGutterGap ?? Math.max(style.pad.wMargin + 2, Math.floor(style.placement.spacing / 3))
    const overlap = (a, b) => !((a.x + a.w <= b.x) || (a.x >= b.x + b.w) || (a.y + a.h <= b.y) || (a.y >= b.y + b.h))
    const minNodeX = Math.min(...nodes.map(node => node.look.rect.x))
    const maxNodeX = Math.max(...nodes.map(node => node.look.rect.x + node.look.rect.w))
    const leftAnchor = minNodeX - gap
    const rightAnchor = maxNodeX + gap

    for (const pad of pads) {
        if (pad.is?.placed) continue

        // First push the pad into the side gutter (outside the node field).
        if (pad.is.leftText) {
            const targetX = leftAnchor - pad.rect.w
            if (pad.rect.x > targetX) pad.rect.x = targetX
        }
        else {
            const targetX = rightAnchor
            if (pad.rect.x < targetX) pad.rect.x = targetX
        }

        let guard = 0
        let moved = false

        while (guard++ < 20) {
            const hits = nodes.filter(node => overlap(pad.rect, node.look.rect))
            if (!hits.length) break

            if (pad.is.leftText) {
                let xNew = pad.rect.x
                for (const node of hits) {
                    const rc = node.look.rect
                    const candidate = rc.x - pad.rect.w - gap
                    if (candidate < xNew) xNew = candidate
                }
                if (xNew === pad.rect.x) break
                pad.rect.x = xNew
            }
            else {
                let xNew = pad.rect.x
                for (const node of hits) {
                    const rc = node.look.rect
                    const candidate = rc.x + rc.w + gap
                    if (candidate > xNew) xNew = candidate
                }
                if (xNew === pad.rect.x) break
                pad.rect.x = xNew
            }

            moved = true
        }

        // Routes are not cooked yet when this runs during cook(), but keep this safe
        // if the function is reused later.
        if (moved && pad.routes?.length) pad.adjustRoutes()
    }
},
}
