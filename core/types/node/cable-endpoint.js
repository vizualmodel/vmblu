import {Route} from './route.js'
import {inside, style, shape} from '../util/index.js'

export const cableEndpointHandling = {

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
        const endpointTacks = this.endpointTacks(label)

        let x = (pa.x == pb.x)&&(Math.abs(pos.x - pa.x) > style.cable.split) ? pos.x : pb.x + delta.x
        let y = (pa.y == pb.y)&&(Math.abs(pos.y - pa.y) > style.cable.split) ? pos.y : pb.y + delta.y

        this.drawXY({x,y})

        for (const tack of endpointTacks) {
            tack.setEndpointAttachment(label)
            tack.route.adjust({moveCableEndpoint: false})
        }
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
        const point = label === 'start' ? this.wire[0] : this.wire.at(-1)
        const segment = label === 'start' ? 1 : this.wire.length - 1
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
        const movedSegment = moveStart ? 1 : this.wire.length - 1
        const trunkSegment = moveStart ? this.wire.length - 1 : 1

        for (const otherTack of this.tacks) {
            if (otherTack === tack) {
                otherTack.placeOnSegment(point, movedSegment)
                continue
            }
            else if (!otherTack.isEndpoint() && moveStart && otherTack.segment === 1) {
                otherTack.segment = trunkSegment
            }

            otherTack.refreshPlacement?.()
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

        const wire = this.copyWire()
        const startTack = this.tacks.find(tack => tack.isEndpoint('start'))
        const endTack = this.tacks.find(tack => tack.isEndpoint('end'))

        const startWidget = startTack.getOther()
        const endWidget = endTack.getOther()
        if (!startWidget || !endWidget || startWidget.is.tack || endWidget.is.tack) return null

        const connectDirect = (from, to, routeWire) => {
            const route = new Route(from, null)
            route.wire = routeWire.map(point => ({...point}))
            from.routes.push(route)

            if (route.connect(to)) return route

            from.routes.pop()
            return null
        }

        const endpointTacks = this.tacks.slice()
        for (const tack of endpointTacks) tack.route.disconnect()
        node.removeCable(this)

        const route = connectDirect(startWidget, endWidget, wire) ?? connectDirect(endWidget, startWidget, wire.slice().reverse())
        return route ? {route} : null
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
