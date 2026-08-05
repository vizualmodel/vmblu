const DEFAULT_EPSILON = 1e-9

function sameCoordinate(a, b, epsilon) {
    return Math.abs(a - b) <= epsilon
}

function samePoint(a, b, epsilon) {
    return sameCoordinate(a.x, b.x, epsilon) && sameCoordinate(a.y, b.y, epsilon)
}

export function diagonalWireSegments(wire = [], epsilon = DEFAULT_EPSILON) {
    const diagonals = []

    for (let index = 1; index < wire.length; index++) {
        const from = wire[index - 1]
        const to = wire[index]
        if (!from || !to) continue

        if (!sameCoordinate(from.x, to.x, epsilon) && !sameCoordinate(from.y, to.y, epsilon)) {
            diagonals.push({segment: index, from: {...from}, to: {...to}})
        }
    }

    return diagonals
}

export function canonicalOrthogonalWire(wire = [], epsilon = DEFAULT_EPSILON) {
    const canonical = []

    for (const point of wire) {
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue
        if (!canonical.length || !samePoint(canonical.at(-1), point, epsilon)) {
            canonical.push({x: point.x, y: point.y})
        }
    }

    let changed = true
    while (changed && canonical.length > 2) {
        changed = false

        for (let index = 1; index < canonical.length - 1; index++) {
            const previous = canonical[index - 1]
            const point = canonical[index]
            const next = canonical[index + 1]
            const sameX = sameCoordinate(previous.x, point.x, epsilon) &&
                          sameCoordinate(point.x, next.x, epsilon)
            const sameY = sameCoordinate(previous.y, point.y, epsilon) &&
                          sameCoordinate(point.y, next.y, epsilon)

            if (sameX || sameY) {
                canonical.splice(index, 1)
                changed = true
                break
            }
        }
    }

    return canonical
}
