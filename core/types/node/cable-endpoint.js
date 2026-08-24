import {Route} from './route.js'
import {canonicalOrthogonalWire, diagonalWireSegments, inside, style, shape} from '../util/index.js'

function appendPoint(wire, point) {
    const previous = wire.at(-1)
    if (!previous || previous.x !== point.x || previous.y !== point.y) wire.push({...point})
}

function routeFromWidgetToTack(tack) {
    const wire = tack.route.copyWire()
    return tack.route.from === tack ? wire.reverse() : wire
}

function cablePosition(cable, tack) {
    let distance = 0
    for (let segment = 1; segment < tack.segment; segment++) {
        const a = cable.wire[segment - 1]
        const b = cable.wire[segment]
        distance += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    }

    const start = cable.wire[tack.segment - 1]
    const point = tack.center()
    distance += Math.abs(point.x - start.x) + Math.abs(point.y - start.y)
    return {distance, point}
}

function cableWireBetween(cable, fromTack, toTack) {
    const from = cablePosition(cable, fromTack)
    const to = cablePosition(cable, toTack)
    if (from.distance > to.distance) return cableWireBetween(cable, toTack, fromTack).reverse()

    const wire = [{...from.point}]
    for (let index = fromTack.segment; index < toTack.segment; index++) {
        appendPoint(wire, cable.wire[index])
    }
    appendPoint(wire, to.point)
    return wire
}

function routeEndpointZone(route, atStart) {
    const contact = atStart ? route.wire[0] : route.wire.at(-1)
    if (!contact) return null
    const candidates = atStart ? route.wire.slice(1) : route.wire.slice(0, -1).reverse()
    const neighbour = candidates.find(point => point.x !== contact.x || point.y !== contact.y)
    if (!neighbour) return null
    if (contact.x === neighbour.x) return contact.y < neighbour.y ? 'S' : 'N'
    if (contact.y === neighbour.y) return contact.x < neighbour.x ? 'E' : 'W'
    return null
}

export const cableEndpointHandling = {

    routeEndpointZone(route, atStart) {
        return routeEndpointZone(route, atStart)
    },

    endpointGeometry(label) {
        if (label !== 'start' && label !== 'end') return null
        return label === 'start'
            ? {point: this.wire[0], adjacent: this.wire[1], segment: 1}
            : {point: this.wire.at(-1), adjacent: this.wire.at(-2), segment: this.wire.length - 1}
    },

    realignEndpointTacks(label, {include = [], skipRouteFor = null} = {}) {
        const tacks = [...new Set([...this.endpointTacks(label), ...include])]
        for (const tack of tacks) {
            tack.setEndpointAttachment(label)
            if (tack !== skipRouteFor) tack.route.adjust({moveCableEndpoint: false})
        }
        return tacks
    },

    attachRouteEndpointTack(route, tack, atStart, zone = routeEndpointZone(route, atStart)) {
        const endpoint = this.endpointAt(tack.center()) ?? this.endpointHitAt(tack.center())
        if (!endpoint) return false

        tack.attachEndpoint(endpoint, zone)
        if (zone) tack.setEndpointApproach(zone)
        tack.refreshPlacement()
        return true
    },

    individualRouteWire(fromTack, toTack) {
        const wire = []
        for (const point of routeFromWidgetToTack(fromTack)) appendPoint(wire, point)
        for (const point of cableWireBetween(this, fromTack, toTack)) appendPoint(wire, point)
        for (const point of routeFromWidgetToTack(toTack).reverse()) appendPoint(wire, point)
        return canonicalOrthogonalWire(wire)
    },

    renderEndpoint(ctx, point, color) {
        shape.emptyLabel(ctx, point.x, point.y, style.cable.radius, color)
    },

    shouldRenderEndpoint() {
        return true
    },

    endpointRect(point) {
        const r = style.cable.radius
        return {x: point.x - r, y: point.y - r, w: 2 * r, h: 2 * r}
    },

    endpointAt(point) {
        if (!point) return null
        if (point.x === this.wire[0]?.x && point.y === this.wire[0]?.y) return 'start'
        if (point.x === this.wire.at(-1)?.x && point.y === this.wire.at(-1)?.y) return 'end'
        return null
    },

    endpointHitAt(point) {
        if (!point) return null
        if (this.wire[0] && inside(point, this.endpointRect(this.wire[0]))) return 'start'
        if (this.wire.at(-1) && inside(point, this.endpointRect(this.wire.at(-1)))) return 'end'
        return null
    },

    connectEndpoint(widget) {
        if (!widget?.center) return null
        if (this.findTack(widget)) return null

        const center = widget.center()
        const point = this.wire.at(-1)
        const segment = this.wire.length - 1
        const previous = this.wire.at(-2)

        if (previous) {
            previous.y === point.y ? previous.y = center.y : previous.x = center.x
        }

        point.x = center.x
        point.y = center.y
        this.realignEndpointTacks('end')

        const tack = this.newTack()
        tack.placeOnSegment(point, segment)

        const route = new Route(widget, tack)
        route.wire = [{...center}, {...tack.center()}]
        widget.routes.push(route)
        tack.restore(route)
        tack.attachEndpoint('end')

        widget.is.pin ? route.rxtxPinBus() : route.rxtxPadBus()
        this.validateOrthogonalWire('endpoint connection')
        return tack
    },

    drawXY(next) {
        const L = this.wire.length
        const r1 = this.wire[L - 2]
        const r2 = this.wire[L - 1]
        let limit = null

        const vertical = r2.x == r1.x
        const horizontal = r2.y == r1.y

        const gap = style.cable.gap

        if (vertical && horizontal) {
            (Math.abs(next.x - r1.x) < Math.abs(next.y - r1.y)) ? r2.y = next.y : r2.x = next.x
        }
        else if (horizontal) {
            if (Math.abs(next.y - r2.y) > style.cable.split) {
                this.wire.push({x:r2.x, y:next.y})
            }
            else {
                if ((this.tacks.length)&&(limit = this.getInteriorTackLimit(L-1))) {
                    if ((r1.x < r2.x)&&(next.x < limit.maxX + gap)) next.x = limit.maxX + gap
                    if ((r1.x > r2.x)&&(next.x > limit.minX - gap)) next.x = limit.minX - gap
                }

                r2.x = next.x
                if (!limit && (L > 2) && (Math.abs(r2.x - r1.x) < style.cable.tooClose)) this.wire.pop()
            }
        }
        else if (vertical) {
            if (Math.abs(next.x - r2.x) > style.cable.split) {
                this.wire.push({x:next.x, y:r2.y})
            }
            else {
                if ((this.tacks.length)&&(limit = this.getInteriorTackLimit(L-1))) {
                    if ((r1.y < r2.y)&&(next.y < limit.maxY + gap)) next.y = limit.maxY + gap
                    if ((r1.y > r2.y)&&(next.y > limit.minY - gap)) next.y = limit.minY - gap
                }

                r2.y = next.y
                if (!limit && (L > 2) && (Math.abs(r2.y - r1.y) < style.cable.tooClose)) this.wire.pop()
            }
        }
    },

    resumeDrawXY(label, pos, delta) {
        const p = this.wire
        const pa = p[p.length-2]
        const pb = p[p.length-1]

        let x = (pa.x == pb.x)&&(Math.abs(pos.x - pa.x) > style.cable.split) ? pos.x : pb.x + delta.x
        let y = (pa.y == pb.y)&&(Math.abs(pos.y - pa.y) > style.cable.split) ? pos.y : pb.y + delta.y
        const capture = this.endpointTackCapture(label, {x,y})

        this.drawXY({x,y})
        const captured = capture && this.moveEndpoint(label, capture.point, {capture: capture.tacks})

        if (!captured) this.realignEndpointTacks(label)
    },

    endpointTackCapture(label, next) {
        const geometry = this.endpointGeometry(label)
        if (!geometry?.point || !geometry.adjacent) return null
        const {point: endpoint, adjacent, segment} = geometry

        const horizontal = endpoint.y === adjacent.y
        const axis = horizontal ? 'x' : 'y'
        if ((horizontal && next.y !== endpoint.y) || (!horizontal && next.x !== endpoint.x)) return null

        const direction = Math.sign(endpoint[axis] - adjacent[axis])
        if (!direction || (next[axis] - endpoint[axis]) * direction >= 0) return null

        const candidates = this.tacks
            .filter(tack => tack.segment === segment && !tack.isEndpoint())
            .map(tack => ({tack, point: tack.center()}))
            .filter(({point}) => (endpoint[axis] - point[axis]) * direction > 0)
            .sort((a,b) => Math.abs(endpoint[axis] - a.point[axis]) - Math.abs(endpoint[axis] - b.point[axis]))
        if (!candidates.length) return null

        const coordinate = candidates[0].point[axis]
        const boundary = coordinate + direction * style.cable.gap
        if ((next[axis] - boundary) * direction > 0) return null

        return {
            point: {...candidates[0].point},
            tacks: candidates.filter(({point}) => point[axis] === coordinate).map(({tack}) => tack)
        }
    },

    moveEndpoint(label, point, {capture = [], skipRouteFor = null} = {}) {
        const geometry = this.endpointGeometry(label)
        if (!geometry?.point || !geometry.adjacent) return false
        const {point: endpoint, adjacent, segment} = geometry

        const horizontal = endpoint.y === adjacent.y
        const axis = horizontal ? 'x' : 'y'
        if ((horizontal && point.y !== endpoint.y) || (!horizontal && point.x !== endpoint.x)) return false

        const direction = Math.sign(endpoint[axis] - adjacent[axis])
        if (!direction || (point[axis] - adjacent[axis]) * direction <= 0) return false
        if (!capture.length && this.wire.length > 2 && Math.abs(point[axis] - adjacent[axis]) < style.cable.tooClose) return false

        const captured = new Set(capture)
        const remaining = this.tacks
            .filter(tack => tack.segment === segment && !tack.isEndpoint() && !captured.has(tack))
            .map(tack => tack.center())
            .filter(center => (endpoint[axis] - center[axis]) * direction > 0)
            .sort((a,b) => Math.abs(endpoint[axis] - a[axis]) - Math.abs(endpoint[axis] - b[axis]))

        if ((point[axis] - endpoint[axis]) * direction < 0 && remaining.length) {
            const boundary = remaining[0][axis] + direction * style.cable.gap
            if ((point[axis] - boundary) * direction < 0) return false
        }

        endpoint.x = point.x
        endpoint.y = point.y
        this.realignEndpointTacks(label, {include: capture, skipRouteFor})

        this.validateOrthogonalWire('endpoint move')
        return true
    },

    getInteriorTackLimit(segment) {
        const centers = this.tacks
            .filter(tack => tack.segment == segment && !tack.isEndpoint())
            .map(tack => tack.center())
        if (!centers.length) return null

        return {
            minX: Math.min(...centers.map(point => point.x)),
            maxX: Math.max(...centers.map(point => point.x)),
            minY: Math.min(...centers.map(point => point.y)),
            maxY: Math.max(...centers.map(point => point.y))
        }
    },

    endpointTacks(label) {
        return this.tacks.filter(tack => tack.isEndpoint(label))
    },

    releaseEndpointTacks(label) {
        const tacks = this.endpointTacks(label)
        const {point, segment} = this.endpointGeometry(label)
        for (const tack of tacks) tack.attachInterior(point, segment)
        return tacks
    },

    bendEndpoint(tack, point) {
        if (!tack?.isEndpoint() || !this.singleSegment()) return false

        const oldStart = {...this.wire[0]}
        const oldEnd = {...this.wire[1]}
        const horizontal = oldStart.y === oldEnd.y
        const vertical = oldStart.x === oldEnd.x
        if (!horizontal && !vertical) return false

        if (horizontal && point.y === oldStart.y) return false
        if (vertical && point.x === oldStart.x) return false

        const moveStart = tack.isEndpoint('start')

        const elbow = horizontal
            ? (moveStart ? {x: oldStart.x, y: point.y} : {x: oldEnd.x, y: point.y})
            : (moveStart ? {x: point.x, y: oldStart.y} : {x: point.x, y: oldEnd.y})

        const addPoint = (wire, next) => {
            const previous = wire.at(-1)
            if (previous && previous.x === next.x && previous.y === next.y) return
            wire.push({...next})
        }

        const nextWire = []
        const rawWire = moveStart
            ? [{...point}, elbow, oldStart, oldEnd]
            : [oldStart, oldEnd, elbow, {...point}]
        for (const next of rawWire) addPoint(nextWire, next)
        if (nextWire.length < 2) return false

        this.wire = nextWire
        const trunkSegment = moveStart ? this.wire.length - 1 : 1

        for (const otherTack of this.tacks) {
            if (!otherTack.isEndpoint() && moveStart && otherTack.segment === 1) {
                otherTack.segment = trunkSegment
            }
        }

        this.realignEndpointTacks(moveStart ? 'start' : 'end', {skipRouteFor: tack})
        for (const otherTack of this.tacks) {
            if (!otherTack.isEndpoint(moveStart ? 'start' : 'end')) otherTack.refreshPlacement?.()
        }

        this.validateOrthogonalWire('endpoint bend')
        return true
    },

    canCollapseToRoute() {
        return this.tacks.length === 2
            && this.tacks.some(tack => tack.isEndpoint('start'))
            && this.tacks.some(tack => tack.isEndpoint('end'))
            && this.tacks.every(tack => tack.route?.from && tack.route?.to)
    },

    collapseIfOnlyEndpointTacks(node) {
        if (!this.canCollapseToRoute()) return null
        if (!node) return null

        const startTack = this.tacks.find(tack => tack.isEndpoint('start'))
        const endTack = this.tacks.find(tack => tack.isEndpoint('end'))

        const startWidget = startTack.getOther()
        const endWidget = endTack.getOther()
        if (!startWidget || !endWidget || startWidget.is.tack || endWidget.is.tack) return null

        const wire = this.individualRouteWire(startTack, endTack)
        if (wire.length < 2 || diagonalWireSegments(wire).length) return null
        const candidates = [
            {from: startWidget, to: endWidget, wire},
            {from: endWidget, to: startWidget, wire: wire.slice().reverse()}
        ]
        const plan = candidates.find(candidate => {
            const route = new Route(candidate.from, null)
            return route.checkConxType(candidate.from, candidate.to)
        })
        if (!plan) return null

        const endpointTacks = this.tacks.slice()
        for (const tack of endpointTacks) tack.route.disconnect()
        node.removeCable(this)

        const route = new Route(plan.from, null)
        route.wire = plan.wire.map(point => ({...point}))
        plan.from.routes.push(route)
        if (route.connect(plan.to)) return {route}

        plan.from.routes.pop()
        node.restoreCable(this)
        this.reconnect(endpointTacks.slice())
        return null
    },

    collapseToRoute(node) {
        if (!this.canCollapseToRoute()) return null

        const collapse = {
            node: this.node ?? node,
            cable: this,
            tacks: this.tacks.slice(),
            route: null,
        }

        if (!collapse.node) return null

        const collapsed = this.collapseIfOnlyEndpointTacks(collapse.node)
        if (!collapsed) return null

        collapse.route = collapsed.route
        return collapse
    },

    undoCollapse(collapse) {
        if (!collapse?.route) return

        collapse.route.disconnect()
        collapse.node.restoreCable(this)
        this.reconnect(collapse.tacks.slice())
    },

    redoCollapse(collapse) {
        if (!collapse) return

        collapse.route = this.collapseIfOnlyEndpointTacks(collapse.node)?.route
    },
}

export function collapseEndpointOnlyCables(cables = [], fallbackNode = null) {
    const collapses = []
    const checked = []

    for (const cable of cables) {
        if (!cable || checked.includes(cable)) continue
        checked.push(cable)

        const collapse = cable.collapseToRoute(fallbackNode)
        if (collapse) collapses.push(collapse)
    }

    return collapses
}

export function undoCableCollapses(collapses = []) {
    for (const collapse of collapses.slice().reverse()) {
        collapse?.cable?.undoCollapse(collapse)
    }
}

export function redoCableCollapses(collapses = []) {
    for (const collapse of collapses) {
        collapse?.cable?.redoCollapse(collapse)
    }
}
