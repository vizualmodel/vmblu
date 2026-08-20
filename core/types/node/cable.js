import {Route} from './route.js'
import {Widget} from '../widget/index.js'
import {canonicalOrthogonalWire, convert, closestPointOnCurve, diagonalWireSegments, interpolateSegment, style, shape, inside, segmentsInside, eject} from '../util/index.js'
import {zap} from '../view/index.js'
import {cableEndpointHandling} from './cable-endpoint.js'

export {collapseEndpointOnlyCables, redoCableCollapses, undoCableCollapses} from './cable-endpoint.js'

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

function individualRouteWire(cable, fromTack, toTack) {
    const wire = []
    for (const point of routeFromWidgetToTack(fromTack)) appendPoint(wire, point)
    for (const point of cableWireBetween(cable, fromTack, toTack)) appendPoint(wire, point)
    for (const point of routeFromWidgetToTack(toTack).reverse()) appendPoint(wire, point)
    return canonicalOrthogonalWire(wire)
}

function routeEndpointApproach(route, atStart) {
    const contact = atStart ? route.wire[0] : route.wire.at(-1)
    const neighbour = atStart ? route.wire[1] : route.wire.at(-2)
    if (!contact || !neighbour) return null
    if (contact.x === neighbour.x) return 'vertical'
    if (contact.y === neighbour.y) return 'horizontal'
    return null
}

function preserveRouteEndpointApproach(route, tack, approach) {
    if (!approach || route.wire.length < 2) return

    const atStart = route.from === tack
    const contact = atStart ? route.wire[0] : route.wire.at(-1)
    const neighbour = atStart ? route.wire[1] : route.wire.at(-2)

    if (route.wire.length === 2) {
        const elbow = approach === 'vertical'
            ? {x: contact.x, y: neighbour.y}
            : {x: neighbour.x, y: contact.y}
        route.wire.splice(1, 0, elbow)
    }
    else if (approach === 'vertical') neighbour.x = contact.x
    else neighbour.y = contact.y
}

export function Cable(from = {x:0, y:0}, uid = null, floating = false) {

    if (uid && typeof uid === 'object') {
        floating = !!uid.floating
        uid = uid.uid ?? null
    }

    // unique identifier for the cable
    this.uid = uid

    this.widGenerator = 0

    // state
    this.is = {
        cable: true,
        floating,
        selected: false,
        hoverOk: false,
        hoverNok : false,
        highLighted: false
    }

    // the cable trunk
    this.wire = [
        {x:from.x, y:from.y},
        {x:from.x, y:from.y}
    ]

    // the contacts on the cable
    this.tacks = []
}
Cable.prototype = {

    render(ctx) {

        if (this.wire.length < 2) return

        const st = style.cable

        const cLine =     this.is.hoverNok ? st.cBad 
                        : this.is.selected || this.is.hoverOk ? st.cSelected
                        : this.is.highLighted ? st.cHighLighted
                        : st.cNormal

        shape.drawWire(ctx,cLine, st.wCable, this.wire)

        if (this.shouldRenderEndpoint(this.wire[0])) this.renderEndpoint(ctx, this.wire[0], cLine)
        if (this.shouldRenderEndpoint(this.wire.at(-1))) this.renderEndpoint(ctx, this.wire.at(-1), cLine)

        // also render the tacks
        this.tacks.forEach( tack => tack.render(ctx) )
    },

    defaultTackSelectivity() {
        return false
    },

    legacyTackSelectivity(widget) {
        const input = widget?.is?.pin ? widget.is.input
                    : widget?.is?.pad ? !widget.proxy.is.input
                    : false
        return this.is.floating ? !!input : false
    },

    generateWid() {
        return ++this.widGenerator
    },

    isKeyed() {
        return false
    },

    makeRaw() {
        this.canonicalizeOrthogonalWire('save')
        this.validateOrthogonalWire('save')
        const raw = {
            start: convert.pointToString(this.wire[0]),
            wire: convert.wireToString(this.wire)
        }
        if (this.is.floating) raw.floating = true
        return raw
    },

    cook(raw) {
        this.is.floating = raw.floating === undefined ? this.is.floating : !!raw.floating
        this.wire = convert.stringToWire(convert.stringToPoint(raw.start), null, raw.wire)
        const start = convert.stringToPoint(raw.start) ?? {x: 0, y: 0}
        if (this.wire.length == 0) this.wire = [{...start}, {...start}]
        else if (this.wire.length == 1) this.wire.push({...this.wire[0]})
        this.canonicalizeOrthogonalWire('load')
        this.validateOrthogonalWire('load')
    },

    canonicalizeOrthogonalWire(operation = 'unknown') {
        if (diagonalWireSegments(this.wire).length) return false

        const canonical = canonicalOrthogonalWire(this.wire)
        if (canonical.length === 1) canonical.push({...canonical[0]})
        if (canonical.length < 2) return false

        const changed = canonical.length !== this.wire.length ||
            canonical.some((point, index) =>
                point.x !== this.wire[index]?.x || point.y !== this.wire[index]?.y
            )
        if (!changed) return true

        this.wire = canonical
        for (const tack of this.tacks) tack.refreshPlacement?.()
        this.validateOrthogonalWire(operation)
        return true
    },

    validateOrthogonalWire(operation = 'unknown') {
        const diagonals = diagonalWireSegments(this.wire)
        if (!diagonals.length) {
            this._diagonalWarning = null
            return true
        }

        const signature = JSON.stringify(diagonals)
        if (this._diagonalWarning !== signature) {
            this._diagonalWarning = signature
            console.warn(`Cable wire became non-orthogonal during ${operation}.`, {
                cable: this,
                diagonals
            })
        }
        return false
    },

    highLight() {
        this.is.highLighted = true
        for (const tack of this.tacks) tack.route.highLight()
    },

    unHighLight() {
        this.is.highLighted = false
        for (const tack of this.tacks) tack.route.unHighLight()
    },

    setSelectivityForAll(on) {
        for (const tack of this.tacks) {
            if (tack.canBeSelective()) tack.is.selective = on
        }
    },

    hitTest(pos) {
        const endpoint =   this.shouldRenderEndpoint(this.wire[0]) && inside(pos, this.endpointRect(this.wire[0])) ? 'start'
                         : this.shouldRenderEndpoint(this.wire.at(-1)) && inside(pos, this.endpointRect(this.wire.at(-1))) ? 'end'
                         : null
        if (endpoint) return [zap.busLabel, this, endpoint, null, 0]

        for (const tack of this.tacks) {
            if (inside(pos, tack.drawingRect())) return [zap.tack, this, null, tack, 0]
            if (tack.alias && inside(pos, tack.rcAlias)) return [zap.tack, this, null, tack, 0]
        }

        const segment = this.hitSegment(pos)
        if (segment) return [zap.busSegment, this, null, null, segment]

        return [zap.nothing, null, null, null, 0]
    },

    hitSegment(pos) {
        const L = this.wire.length
        const x = pos.x
        const y = pos.y

        for (let i=0; i<L-1; i++) {
            const a = this.wire[i]
            const b = this.wire[i+1]
            const d = 5

            if (a.y == b.y) {
                if ((y > a.y - d) && (y < a.y + d))
                    if (((x >= a.x) && (x <= b.x)) || ((x >= b.x) && (x <= a.x))) return i+1
            }
            else {
                if ((x > a.x - d) && (x < a.x + d))
                    if (((y >= a.y) && (y <= b.y)) || ((y >= b.y) && (y <= a.y))) return i+1
            }
        }
        return 0
    },

    singleSegment() {
        return (this.wire.length === 2)
    },

    hitRoute(pos, ignoredRoute = null) {
        let segment = 0
        for (const tack of this.tacks) {
            if (tack.route === ignoredRoute) continue
            if ((tack.route.from == tack)&&(segment = tack.route.hitSegment(pos)))  return [zap.route, tack.route, segment]
        }
        return [zap.nothing, null, 0]
    },

    overlap(rect) {
        return segmentsInside(this.wire, rect)?.length > 0 ? true : false
    },

    findTack(from) {
        return this.tacks.find(tack => (tack.route.from == from) || (tack.route.to == from))
    },

    removeTack(tack) {
        eject(this.tacks, tack)
    },

    addTack(route) {

        const other = route.to == null ? route.from : route.to
        if (this.findTack(other)) return null

        const approach = routeEndpointApproach(route, route.from == null)
        const newTack = new Widget.CableTack(this)
        newTack.setSelective(this.defaultTackSelectivity(other))
        newTack.setRoute(route)
        const endpoint = this.endpointAt(newTack.center()) ?? this.endpointHitAt(newTack.center())
        if (endpoint) {
            newTack.attachEndpoint(endpoint)
            preserveRouteEndpointApproach(route, newTack, approach)
            newTack.refreshPlacement()
        }
        this.tacks.push(newTack)
        return newTack
    },

    newTack(alias = null, selective = false) {
        const tack = new Widget.CableTack(this)
        if (alias) tack.alias = alias
        tack.setSelective(selective)
        this.tacks.push(tack)
        return tack
    },

    makeRoute(widget) {

        const closest = closestPointOnCurve(this.wire, widget.center())
        const point = closest.endPoint ? interpolateSegment(closest.point, closest.segment, this.wire) : closest.point
        const tack = new Widget.CableTack(this)

        tack.placeOnSegment(point, closest.segment)

        const route = new Route(widget, tack)
        route.autoRoute()
        widget.routes.push(route)
        tack.restore(route)
    },

    copy() {
        const newCable = new Cable(this.wire[0], this.uid, this.is.floating)
        newCable.wire = this.copyWire()
        return newCable
    },

    copyTacks(newCable, newRoot) {

        for (const tack of this.tacks) {

            const newRoute = tack.route.clone()
            const newTack = new Widget.CableTack(newCable)
            newTack.is.bridge = tack.is.bridge
            newTack.is.selective = tack.is.selective
            newTack.alias = tack.alias

            newRoute.to.is.tack ? newRoute.to = newTack : newRoute.from = newTack
            newTack.setRoute(newRoute)
            newTack.restoreAttachment(tack.copyAttachment())

            const other = newRoute.to.is.tack ? newRoute.from : newRoute.to

            if (other.is.pin) {
                const node = newRoot.nodes.find(node => node.uid == other.node.uid)
                const pin = node.look.findPin(other.name, other.is.input)
                newRoute.to.is.tack ? newRoute.from = pin : newRoute.to = pin
                pin.routes.push(newRoute)
            }
            else if (other.is.pad) {
                const pad = newRoot.pads.find(pd => pd.proxy.name == other.proxy.name)
                newRoute.to.is.tack ? newRoute.from = pad : newRoute.to = pad
                pad.routes.push(newRoute)
            }

            newCable.tacks.push(newTack)
        }
    },

    copyWire() {
        const copy = []
        for (const point of this.wire) copy.push({...point})
        return copy
    },

    restoreWire(copy) {
        this.wire = []
        for (const point of copy) this.wire.push({...point})
    },

    copyTackWires() {
        const copy = []
        for (const tack of this.tacks) {
            const track = tack.route.copyWire()
            copy.push({attachment: tack.copyAttachment(), track})
        }
        return copy
    },

    restoreTackWires(copy) {
        const tacks = this.tacks
        const L = tacks.length
        for(let i = 0; i < L; i++) {
            tacks[i].route.restoreWire(copy[i].track)
            if (copy[i].attachment) tacks[i].restoreAttachment(copy[i].attachment)
            else tacks[i].restoreLegacyAttachment(copy[i].segment, copy[i].endpoint)
        }
    },

    disconnectTacks() {
        for (const tack of this.tacks.slice()) tack.route.disconnect()
        this.tacks.length = 0
    },

    restoreTackWireState(tackWires = []) {
        if (!tackWires?.length) return

        this.restoreTackWires(tackWires)
        for (const tack of this.tacks) tack.setRoute(tack.route)
    },

    restoreWireState(wire, tackWires) {
        this.restoreWire(wire)
        if (tackWires) this.restoreTackWireState(tackWires)
    },

    restoreDrawState(wire, tacks, tackWires) {
        this.disconnectTacks()
        this.restoreWire(wire)

        tacks ??= []
        tackWires ??= []
        for (let i = 0; i < tacks.length; i++) {
            if (tackWires[i]) {
                tacks[i].route.restoreWire(tackWires[i].track)
                if (tackWires[i].attachment) tacks[i].restoreAttachment(tackWires[i].attachment)
                else tacks[i].restoreLegacyAttachment(tackWires[i].segment, tackWires[i].endpoint)
            }
        }

        this.reconnect(tacks.slice())
    },

    disconnect() {
        const tacks = this.tacks.slice()

        for (const tack of tacks) {
            const other = tack.route.from == tack ? tack.route.to : tack.route.from
            other.is.tack ? tack.route.rxtxBusBusDisconnect()
            : other.is.pin ? tack.route.rxtxPinBusDisconnect()
            : tack.route.rxtxPadBusDisconnect()
            tack.route.remove()
        }
    },

    reconnect(tacks) {
        for (const tack of tacks) {
            this.tacks.push(tack)
            tack.setRoute(tack.route)

            const other = tack.route.to == tack ? tack.route.from : tack.route.to
            if (!other.is.tack) other.routes.push(tack.route)
            other.is.tack ? tack.route.rxtxBusBus()
            : other.is.pin ? tack.route.rxtxPinBus()
            : tack.route.rxtxPadBus()
        }
    },

    resumeDrawing(segment, point) {
        const p = this.wire
        if (p.length < 2) return

        const clampToSegment = (segment, point) => {
            const a = p[segment - 1]
            const b = p[segment]

            if (a.x === b.x) return {
                x: a.x,
                y: Math.min(Math.max(point.y, Math.min(a.y, b.y)), Math.max(a.y, b.y))
            }

            return {
                x: Math.min(Math.max(point.x, Math.min(a.x, b.x)), Math.max(a.x, b.x)),
                y: a.y
            }
        }

        const first = p[0]
        const last = p.at(-1)
        const distanceFirst = Math.hypot(first.x - point.x, first.y - point.y)
        const distanceLast = Math.hypot(last.x - point.x, last.y - point.y)

        if (distanceFirst < distanceLast) {
            this.reverse()
            segment = p.length - segment
        }

        const redrawPoint = clampToSegment(segment, point)
        const a = p[segment - 1]
        const b = p[segment]
        const horizontal = a.y === b.y

        const keepTack = tack => {
            if (tack.segment < segment) return true
            if (tack.segment > segment) return false

            const center = tack.center()
            if (horizontal) {
                return a.x <= redrawPoint.x
                    ? center.x <= redrawPoint.x
                    : center.x >= redrawPoint.x
            }

            return a.y <= redrawPoint.y
                ? center.y <= redrawPoint.y
                : center.y >= redrawPoint.y
        }

        for (const tack of this.tacks.slice()) {
            if (!keepTack(tack)) tack.route.disconnect()
        }

        p.length = segment
        p.push(redrawPoint)
    },

    reverse() {
        const p = this.wire
        const L = p.length

        for (let i=0; i<L/2; i++) [p[i], p[L-i-1]] = [p[L-i-1], p[i]]
        this.tacks.forEach(tack => tack.reverseAttachment(L))
    },

    getLimit(segment) {
        let limit=null

        this.tacks.forEach(tack => {
            if (tack.segment == segment) {
                const rc = tack.rect
                if (limit) {
                    if (rc.x < limit.l)         limit.l = rc.x
                    if (rc.x + rc.w > limit.r)  limit.r = rc.x + rc.w
                    if (rc.y < limit.t)         limit.t = rc.y
                    if (rc.y + rc.h > limit.b)  limit.b = rc.y + rc.h
                }
                else limit = {l: rc.x, r:rc.x + rc.w, t: rc.y, b:rc.y + rc.h}
            }
        })
        return limit
    },

    move(dx, dy) {
        for(const point of this.wire) {
            point.x += dx
            point.y += dy
        }

        for(const tack of this.tacks) {
            if (!tack.isEndpoint() && tack.attachment.point) {
                tack.attachment.point.x += dx
                tack.attachment.point.y += dy
            }
            tack.syncRouteContact()
            tack.placeAttachment()
        }
    },

    drag(delta) {
        for(const point of this.wire) {
            point.x += delta.x
            point.y += delta.y
        }

        for(const tack of this.tacks) tack.moveWithCable(delta.x, delta.y)
    },

    moveRoutes(x,y) {
        this.tacks.forEach(tack => { 
            if (tack.is.tack && tack.route.from == tack) tack.route.moveAllPoints(x,y)
        })
    },

    getCombinedLimit(s1,s2) {
        let limit1 = this.getLimit(s1)
        let limit2 = this.getLimit(s2)

        if (limit1 && limit2) {
            if (limit2.l < limit1.l) limit1.l = limit2.l
            if (limit2.r > limit1.r) limit1.r = limit2.r
            if (limit2.t < limit1.t) limit1.t = limit2.t
            if (limit2.b > limit1.b) limit1.b = limit2.b
        }
        return limit1 ? limit1 : limit2
    },

    moveSegment(segment, delta) {
        let p = this.wire
        const dx = delta.x
        const dy = delta.y

        const adjacentTacks = this.tacks.filter(tack => tack.segment == segment - 1 || tack.segment == segment + 1)

        const canMoveHorizontal = y => {
            const next = y + dy

            for (const tack of adjacentTacks) {
                const rc = tack.rect
                const center = rc.y + rc.h / 2

                if (center >= y) {
                    if (y >= rc.y && y <= rc.y + rc.h) {
                        if (next >= y) return false
                    }
                    else if (y < rc.y && next >= rc.y) return false
                }
                else {
                    if (y >= rc.y && y <= rc.y + rc.h) {
                        if (next <= y) return false
                    }
                    else if (y > rc.y + rc.h && next <= rc.y + rc.h) return false
                }
            }

            return true
        }

        const canMoveVertical = x => {
            const next = x + dx

            for (const tack of adjacentTacks) {
                const rc = tack.rect
                const center = rc.x + rc.w / 2

                if (center >= x) {
                    if (x >= rc.x && x <= rc.x + rc.w) {
                        if (next >= x) return false
                    }
                    else if (x < rc.x && next >= rc.x) return false
                }
                else {
                    if (x >= rc.x && x <= rc.x + rc.w) {
                        if (next <= x) return false
                    }
                    else if (x > rc.x + rc.w && next <= rc.x + rc.w) return false
                }
            }

            return true
        }

        let a = p[segment-1]
        let b = p[segment]

        if (a.y == b.y) {
            if (canMoveHorizontal(a.y)) {
                a.y += dy
                b.y += dy
                for (const tack of this.tacks) if (tack.segment == segment) tack.moveY(dy)
            }
        }
        else if (a.x == b.x) {
            if (canMoveVertical(a.x)) {
                a.x += dx
                b.x += dx
                for (const tack of this.tacks) if (tack.segment == segment) tack.moveX(dx)
            }
        }

        this.validateOrthogonalWire('segment move')
    },

    removeTwoPoints(segment) {
        const p = this.wire
        const L = p.length

        for (let i = segment; i < L-2; i++) p[i] = p[i+2]

        p.pop()
        p.pop()

        this.tacks.forEach(tack => {
            if (!tack.isEndpoint() && tack.segment > segment) tack.segment -= 2
        })
    },

    fuseSegment(s) {
        let p = this.wire
        if (p.length < 3) return

        const deltaMin = style.cable.tooClose

        if (p[s-1].y == p[s].y) {
            if ((s < p.length-2)&&(Math.abs(p[s+1].y - p[s].y) < deltaMin)) {
                p[s-1].y = p[s+1].y
                this.removeTwoPoints(s)
            }
            else if ((s > 1)&&(Math.abs(p[s-2].y - p[s-1].y) < deltaMin)) {
                p[s].y = p[s-2].y
                this.removeTwoPoints(s-2)
            }
        }
        else if (p[s-1].x == p[s].x) {
            if ((s < p.length-2)&&(Math.abs(p[s+1].x - p[s].x) < deltaMin)) {
                p[s-1].x = p[s+1].x
                this.removeTwoPoints(s)
            }
            else if ((s > 1)&&(Math.abs(p[s-2].x - p[s-1].x) < deltaMin)) {
                p[s].x = p[s-2].x
                this.removeTwoPoints(s-2)
            }
        }
    },

    adjustRoutes() {
        for(const tack of this.tacks) tack.route.adjust()
    },

    straightConnections() {
        for(const tack of this.tacks) {
            const route = tack.route
            const other = route.to == tack ? route.from : route.to

            let a = this.wire[tack.segment-1]
            let b = this.wire[tack.segment]

            if (a.x == b.x) {
                [a, b] = a.y > b.y ? [b, a] : [a, b]

                if (other.rect.y > a.y && other.rect.y < b.y) {
                    const y = other.rect.y + other.rect.h/2
                    tack.attachInterior({x: tack.center().x, y}, tack.segment)
                    for(const p of route.wire) p.y = y
                }
            }
        }
    },

    splitTacks(newCable, newGroup) {
        this.tacks.forEach((tack, index) => {
            if (tack.route.from.is.pin && newGroup.nodes.includes(tack.route.from.node)) {
                newCable.tacks.push(tack)
                this.tacks[index] = null
                tack.cable = newCable
            }
        })

        this.tacks = this.tacks.filter(tack => tack != null)
    },

    transferTacks(outsiders) {
        for(const tack of this.tacks) {
            for(const outside of outsiders) {
                if (this.uid == outside.uid) {
                    tack.cable = outside
                    break
                }
            }
        }
    },

    sources() {
        return this.tacks.filter(tack => tack.incoming())
    },

    targets() {
        return this.tacks.filter(tack => !tack.incoming())
    },

    topology() {
        const sources = this.sources().length
        const targets = this.targets().length

        if (sources === 1 && targets === 1) return 'one-to-one'
        if (sources === 1 && targets > 1) return 'one-to-many'
        if (sources > 1 && targets === 1) return 'many-to-one'
        if (sources > 1 && targets > 1) return 'many-to-many'
        return 'incomplete'
    },

    individualRoutePlans() {
        if (this.tacks.some(tack => tack.getOther()?.is?.tack)) return []

        const plans = []
        const sources = this.tacks.filter(tack => !tack.endpointIsInput())
        const targets = this.tacks.filter(tack => tack.endpointIsInput())

        for (const source of sources) {
            for (const target of targets) {
                if (!source.areConnected(target)) continue
                plans.push({
                    from: source.getOther(),
                    to: target.getOther(),
                    wire: individualRouteWire(this, source, target)
                })
            }
        }
        return plans
    },

    canConvertToRoutes() {
        return this.individualRoutePlans().length > 0
    },

    convertToRoutes(node) {
        node ??= this.node
        if (!node) return null

        const plans = this.individualRoutePlans()
        if (!plans.length) return null

        const conversion = {node, cable: this, tacks: this.tacks.slice(), routes: []}
        this.disconnect()
        node.removeCable(this)

        for (const plan of plans) {
            const route = new Route(plan.from, null)
            route.wire = plan.wire.map(point => ({...point}))
            plan.from.routes.push(route)
            if (!route.connect(plan.to)) {
                plan.from.routes.pop()
                for (const connected of conversion.routes.slice()) connected.disconnect()
                node.restoreCable(this)
                this.reconnect(conversion.tacks.slice())
                return null
            }
            conversion.routes.push(route)
        }

        return conversion
    },

}
Object.assign(Cable.prototype, cableEndpointHandling)
