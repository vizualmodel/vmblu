import {Route} from './route.js'
import {Widget} from '../widget/index.js'
import {convert, closestPointOnCurve, interpolateSegment, style, shape, inside, segmentsInside, eject} from '../util/index.js'
import {zap} from '../view/index.js'

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

        shape.drawWire(ctx,cLine, this.is.floating ? st.wBus : st.wCable, this.wire)

        if (this.is.floating) {
            this.renderEndpoint(ctx, this.wire[0], cLine)
            this.renderEndpoint(ctx, this.wire.at(-1), cLine)
        }

        // also render the tacks
        this.tacks.forEach( tack => tack.render(ctx) )
    },

    defaultTackSelectivity(widget) {
        const input = widget?.is?.pin ? widget.is.input
                    : widget?.is?.pad ? !widget.proxy.is.input
                    : false
        return this.is.floating ? !!input : false
    },

    renderEndpoint(ctx, point, color) {
        shape.emptyLabel(ctx, point.x, point.y, style.cable.radius, color)
    },

    endpointRect(point) {
        const r = style.cable.radius
        return {x: point.x - r, y: point.y - r, w: 2 * r, h: 2 * r}
    },

    generateWid() {
        return ++this.widGenerator
    },

    isKeyed() {
        return false
    },

    makeRaw() {
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
        if (this.wire.length == 1) this.wire.push(this.wire[0])
    },

    highLight() {
        this.is.highLighted = true
        for (const tack of this.tacks) tack.route.highLight()
    },

    unHighLight() {
        this.is.highLighted = false
        for (const tack of this.tacks) tack.route.unHighLight()
    },

    hitTest(pos) {
        if (this.is.floating) {
            const endpoint =   inside(pos, this.endpointRect(this.wire[0])) ? 'start'
                             : inside(pos, this.endpointRect(this.wire.at(-1))) ? 'end'
                             : null
            if (endpoint) return [zap.busLabel, this, endpoint, null, 0]
        }

        for (const tack of this.tacks) {
            if (inside(pos, tack.rect)) return [zap.tack, this, null, tack, 0]
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

        const newTack = new Widget.CableTack(this)
        newTack.setSelective(this.defaultTackSelectivity(other))
        newTack.setRoute(route)
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
        tack.is.endpoint = true
        tack.placeOnSegment(point, segment)

        const route = new Route(widget, tack)
        route.wire = [{...center}, {...tack.center()}]
        widget.routes.push(route)
        tack.restore(route)

        widget.is.pin ? route.rxtxPinBus() : route.rxtxPadBus()
        return tack
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
            newTack.is.endpoint = tack.is.endpoint
            newTack.is.bridge = tack.is.bridge
            newTack.is.selective = tack.is.selective
            newTack.alias = tack.alias

            newRoute.to.is.tack ? newRoute.to = newTack : newRoute.from = newTack
            newTack.setRoute(newRoute)

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
            copy.push({segment: tack.segment, track})
        }
        return copy
    },

    restoreTackWires(copy) {
        const tacks = this.tacks
        const L = tacks.length
        for(let i = 0; i < L; i++) {
            tacks[i].segment = copy[i].segment
            tacks[i].route.restoreWire(copy[i].track)
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
                tacks[i].segment = tackWires[i].segment
                tacks[i].route.restoreWire(tackWires[i].track)
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

    drawXY(next) {
        const L = this.wire.length
        const r1 = this.wire[L - 2]
        const r2 = this.wire[L - 1]
        const wCable = style.cable.wCable
        let limit = null

        const vertical = r2.x == r1.x
        const horizontal = r2.y == r1.y

        if (vertical && horizontal) {
            (Math.abs(next.x - r1.x) < Math.abs(next.y - r1.y)) ? r2.y = next.y : r2.x = next.x
        }
        else if (horizontal) {
            if (Math.abs(next.y - r2.y) > style.cable.split) {
                this.wire.push({x:r2.x, y:next.y})
            }
            else {
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.x < r2.x)&&(next.x < limit.r + wCable/2)) next.x = limit.r + wCable/2
                    if ((r1.x > r2.x)&&(next.x > limit.l - wCable/2)) next.x = limit.l - wCable/2
                }

                r2.x = next.x
                if ((L > 2) && (Math.abs(r2.x - r1.x) < style.cable.tooClose)) this.wire.pop()
            }
        }
        else if (vertical) {
            if (Math.abs(next.x - r2.x) > style.cable.split) {
                this.wire.push({x:next.x, y:r2.y})
            }
            else {
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.y < r2.y)&&(next.y < limit.b)) next.y = limit.b
                    if ((r1.y > r2.y)&&(next.y > limit.t)) next.y = limit.t
                }

                r2.y = next.y
                if ((L > 2) && (Math.abs(r2.y - r1.y) < style.cable.tooClose)) this.wire.pop()
            }
        }
    },

    resumeDrawXY(label, pos, delta) {
        const p = this.wire
        const pa = p[p.length-2]
        const pb = p[p.length-1]

        let x = (pa.x == pb.x)&&(Math.abs(pos.x - pa.x) > style.cable.split) ? pos.x : pb.x + delta.x
        let y = (pa.y == pb.y)&&(Math.abs(pos.y - pa.y) > style.cable.split) ? pos.y : pb.y + delta.y

        this.drawXY({x,y})
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
        this.tacks.forEach(tack => tack.segment = L - tack.segment)
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
            tack.rect.x += dx
            tack.rect.y += dy
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

    bendEndpoint(tack, point) {
        if (!tack?.is?.endpoint || !this.singleSegment()) return false

        const oldStart = {...this.wire[0]}
        const oldEnd = {...this.wire[1]}
        const horizontal = oldStart.y === oldEnd.y
        const vertical = oldStart.x === oldEnd.x
        if (!horizontal && !vertical) return false

        if (horizontal && point.y === oldStart.y) return false
        if (vertical && point.x === oldStart.x) return false

        const tackPoint = tack.center()
        const startDistance = Math.hypot(tackPoint.x - oldStart.x, tackPoint.y - oldStart.y)
        const endDistance = Math.hypot(tackPoint.x - oldEnd.x, tackPoint.y - oldEnd.y)
        const moveStart = startDistance <= endDistance

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
            else if (moveStart && otherTack.segment === 1) {
                otherTack.segment = trunkSegment
            }

            otherTack.refreshPlacement?.()
        }

        return true
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
        if (!this.is.floating && this.tacks.some(tack => tack.is.endpoint && tack.segment == segment)) return

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
    },

    removeTwoPoints(segment) {
        const p = this.wire
        const L = p.length

        for (let i = segment; i < L-2; i++) p[i] = p[i+2]

        p.pop()
        p.pop()

        this.tacks.forEach(w => { if (w.segment > segment) w.segment -= 2 })
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
                    tack.rect.y = other.rect.y + other.rect.h/2 - tack.rect.h/2
                    for(const p of route.wire) p.y = other.rect.y + other.rect.h/2
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

    canCollapseToRoute() {
        return !this.is.floating
            && this.tacks.length === 2
            && this.tacks.every(tack => tack.is.endpoint && tack.route?.from && tack.route?.to)
    },

    collapseIfOnlyEndpointTacks(node) {
        if (!this.canCollapseToRoute()) return null
        if (!node) return null

        const wire = this.copyWire()
        const start = wire[0]

        const [startTack, endTack] =
            Math.hypot(this.tacks[0].center().x - start.x, this.tacks[0].center().y - start.y) <=
            Math.hypot(this.tacks[1].center().x - start.x, this.tacks[1].center().y - start.y)
                ? [this.tacks[0], this.tacks[1]]
                : [this.tacks[1], this.tacks[0]]

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
