import {shape, convert, style, closestPointOnCurve} from '../util/index.js'

export function CableTack(cable, wid = null) {

    this.rect = {x:0, y:0, w: 0, h: 0}

    this.is = {
        tack: true,
        selected: false,
        highLighted: false,
        bridge: false,
        endpoint: false,
        selective: false,
    }

    // Owner trunk.
    this.cable = cable
    Object.defineProperty(this, 'bus', {
        get: () => this.cable,
        set: value => { this.cable = value }
    })

    this.wid = wid ?? cable.generateWid?.() ?? null
    this.segment = 0
    this.alias = null
    this.rcAlias = null
    this.route = null
}

CableTack.prototype = {

    render(ctx) {

        if (this.is.endpoint) return

        const color =  this.is.selected ? style.cable.cSelected
                     : this.is.highLighted ? style.cable.cHighLighted
                     : style.cable.cNormal

        const center = this.visualCenter()
        if (!center) return;

        this.is.bridge 
            ? shape.bridge(ctx, center.x, center.y, style.cable.rTack, color)
            : this.isSelective()
                ? shape.selectiveTack(ctx, center.x, center.y, style.cable.rTack, color)
                : shape.tack(ctx, center.x, center.y, style.cable.rTack, color);

        if (this.alias && this.route) {
            if (!this.rcAlias) {
                this.rcAlias = shape.rcAlias(ctx, this.alias, this.aliasZone(), this.rect.x, this.rect.y, style.cable.fAlias)
            }

            shape.drawAlias(ctx, this.alias, this.rcAlias, color, style.cable.fAlias)
        }
    },

    aliasZone() {
        if (!this.route) return
        const wire = this.route.wire
        if (!wire || wire.length < 2) return 'E'
        let [a,b] = (this.route.from == this) ? [wire[0], wire[1]] : [wire.at(-1), wire.at(-2)]
        if (!a || !b) return 'E'
        return (a.x === b.x) ? (a.y < b.y ? 'S' : 'N') : (a.x < b.x ? 'E' : 'W')
    },

    setRoute(route) {
        this.route = route

        if (!route.to) route.to = this
        else if (!route.from) route.from = this

        const other = this.getOther()

        if (other.is.tack) {
            this.is.bridge = true
            other.is.bridge = true            
        }

        other?.is?.tack ? this.bridgeRect(other) : this.tackRect(other)
    },

    // where does the route intersect the bus
    intersection() {
        const wire = this.route.wire
        const [a,b] = this.route.to == this ? [ wire.at(-1), wire.at(-2) ] : [wire[0], wire[1]];

        // a hits the bus
        let segment = this.cable.hitSegment(a)

        // if no hit find the closest
        if (segment == 0) {
            const closest = closestPointOnCurve(this.cable.wire, a)
            segment = closest?.segment ?? 1
            if (closest?.point) {
                a.x = closest.point.x
                a.y = closest.point.y
            }
        }

        // get the endpoints of the segment
        const A = this.cable.wire[segment-1]
        const B = this.cable.wire[segment]

        // place the point exactly on the segment
        const point = (A.x == B.x) ? {x: A.x, y: a.y} : {x: a.x, y: A.y}
        a.x = point.x
        a.y = point.y

        // done
        return {segment, point}
    },

    bridgeRect() {

        const inter = this.intersection()

        this.segment = inter.segment

        this.rect.w = 2 * style.cable.rTack
        this.rect.h = 2 * style.cable.rTack
        this.rect.x = inter.point.x - this.rect.w/2
        this.rect.y = inter.point.y - this.rect.h/2
    },

    zoneDelta() {
        const r = style.cable.rTack
        const zone = this.aliasZone()
        return zone == 'N' ? {x: r, y: 2*r} : zone == 'S' ? {x: r, y: 0}: zone == 'E' ? {x: 0, y: r}: {x: 2*r, y: r}
    },

    tackRect() {

        const inter = this.intersection()

        this.segment = inter.segment

        const r = style.cable.rTack
        const rc = this.rect
        const delta =  this.zoneDelta()

        rc.w = 2 * r
        rc.h = 2 * r
        rc.x = inter.point.x - delta.x
        rc.y = inter.point.y - delta.y
    },

    placeOnSegment(point, segment) {

        this.segment = segment
        this.rect.w = 2 * style.cable.rTack
        this.rect.h = 2 * style.cable.rTack

        // place the bridge on the crossing 
        if (this.is.bridge) {
            this.rect.x = point.x - this.rect.w/2
            this.rect.y = point.y - this.rect.h/2
        }
        // place the tack in the right zone
        else {
            const delta =  this.zoneDelta()
            this.rect.x = point.x - delta.x
            this.rect.y = point.y - delta.y
        }
    },

    horizontal() {
        const s = this.segment
        const w = this.cable.wire
        return Math.floor(w[s-1].y) === Math.floor(w[s].y)
    },

    center() {
        const rc = this.rect

        if (this.is.bridge)  return {x: rc.x + rc.w/2, y: rc.y + rc.h/2}

        const delta =  this.zoneDelta()
        return   {x: rc.x + delta.x, y: rc.y + delta.y}
    },

    visualCenter() {
        const rc = this.rect
        return {x: rc.x + rc.w/2, y: rc.y + rc.h/2}
    },

    toJSON() {
        return convert.routeToRaw(this.route)
    },

    overlap(rect) {
        const rc = this.rect
        return !((rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h < rect.y))
    },

    remove() {
        this.route.remove()
    },

    removeRoute(route) {
        this.cable.removeTack(this)
    },

    moveX(dx) {
        this.rect.x += dx

        if (this.is.bridge) {
            this.route.autoRoute()
            return
        }

        const p = this.getContactPoint()
        p.x += dx
        this.placeOnSegment(p, this.segment)
    },

    moveY(dy) {
        this.rect.y += dy

        if (this.is.bridge) {
            this.route.autoRoute()
            return
        }

        const p = this.getContactPoint()
        p.y += dy
        this.placeOnSegment(p, this.segment)
    },

    moveXY(dx,dy) {
        this.rect.x += dx
        this.rect.y += dy

        if (this.is.bridge) {
            this.route.autoRoute()
            return
        }

        if (this.route.wire.length == 2) this.route.fourPointRoute()

        const a = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
        const b = this.route.from == this ? this.route.wire[1] : this.route.wire.at(-2)
        const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y)

        if (vertical) {
            a.x += dx
            b.x += dx
            a.y += dy
        }
        else {
            a.y += dy
            b.y += dy
            a.x += dx
        }

        this.placeOnSegment(a, this.segment)
    },

    moveWithCable(dx, dy) {
        this.rect.x += dx
        this.rect.y += dy

        if (this.is.bridge) {
            this.route.autoRoute()
            return
        }

        this.alignRouteEndpoint()
    },

    ensureSegment() {
        const wire = this.cable?.wire
        if (wire?.[this.segment - 1] && wire?.[this.segment]) return true
        if (!this.route) return false

        const inter = this.intersection()
        if (!inter?.segment) return false

        this.placeOnSegment(inter.point, inter.segment)
        return !!(wire?.[this.segment - 1] && wire?.[this.segment])
    },

    slide(delta) {
        if (!this.ensureSegment()) return

        const [a,b] = [this.cable.wire[this.segment -1], this.cable.wire[this.segment]]
        const rc = this.rect
        const wTrunk = this.cable.is.floating ? style.cable.wBus : style.cable.wCable

        if (a.y == b.y) {
            let xMax = Math.max(a.x, b.x) - rc.w - wTrunk/2
            let xMin = Math.min(a.x, b.x) + wTrunk/2

            rc.x += delta.x
            rc.x = rc.x > xMax ? xMax : rc.x < xMin ? xMin : rc.x
        }
        else {
            let yMax = Math.max(a.y, b.y) - rc.h - wTrunk/2
            let yMin = Math.min(a.y, b.y) + wTrunk/2

            rc.y += delta.y
            rc.y = rc.y > yMax ? yMax : rc.y < yMin ? yMin : rc.y
        }

        this.alignRouteEndpoint()
    },

    alignRouteEndpoint() {
        if (!this.ensureSegment()) return

        const route = this.route
        const p = route.wire

        const center = this.center()
        const trunk = this.cable.wire
        const [a,b] = [trunk[this.segment - 1], trunk[this.segment]]
        const horizontal = a.y === b.y

        if (p.length < 3) {
            horizontal ? route.threePointRoute(this === route.to) : route.fourPointRoute()
        }

        if (route.from === this) {
            p[0].x = center.x
            p[0].y = center.y

            horizontal ? p[1].x = center.x : p[1].y = center.y
        }
        else {
            const last = p.length - 1

            p[last].x = center.x
            p[last].y = center.y

            horizontal ? p[last - 1].x = center.x : p[last - 1].y = center.y
        }
    },

    fuseEndSegment() {
        if (this.route.wire.length < 4) return

        const route = this.route
        const p = route.wire
        const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false]

        if ((a.y == b.y) && (Math.abs(c.y - b.y) < style.route.tooClose)) {
            a.y = c.y
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)
            this.placeOnSegment(a, this.segment)
        }
        else if ((a.x == b.x)&&(Math.abs(b.x - c.x) < style.route.tooClose)) {
            a.x = c.x
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)
            this.placeOnSegment(a, this.segment)
        }
    },

    restore(route) {
        this.route = route
        if (!this.cable.tacks.includes(this)) this.cable.tacks.push(this)
        this.setRoute(route)
    },

    startEdit(ctx, click = null) {
        if (!this.alias) this.alias = ''

        const rc = shape.rcAlias(ctx, this.alias, this.aliasZone(), this.rect.x, this.rect.y, style.cable.fAlias)
        const index = click ? shape.cursorIndex(ctx, this.alias, rc.x, click.x) : this.alias.length
        return { prop: 'alias', index }
    },

    cursorPos(ctx, i) {
        const rc = shape.rcAlias(ctx, this.alias ?? '', this.aliasZone(), this.rect.x, this.rect.y, style.cable.fAlias)
        return { x: rc.x + ctx.measureText((this.alias ?? '').slice(0, i)).width, y: rc.y }
    },

    endEdit(saved) {
        this.alias = convert.cleanInput(this.alias)
        if (!this.alias?.length) this.alias = null
        this.rcAlias = null
    },

    getOther() {
        return this.route.from == this ? this.route.to : this.route.from
    },

    getOtherPin() {
        const other = this.getOther()
        return other.is.pin ? other : (other.is.pad ? other.proxy : null)
    },

    getContactPoint() {
        return this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
    },

    actualEndpoint() {
        const other = this.getOther()
        if (other?.is?.pin) return other
        if (other?.is?.pad) return other.proxy
        return null
    },

    endpointIsInput(widget = this.getOther()) {
        if (widget?.is?.pin) return widget.is.input
        if (widget?.is?.pad) return !widget.proxy.is.input
        return null
    },

    setSelective(selective) {
        this.is.selective = !!selective
    },

    incoming() {
        const input = this.endpointIsInput()
        return input === null ? false : !input
    },

    key() {
        const actual = this.actualEndpoint()
        return this.alias ?? actual?.name ?? null
    },

    canBeSelective() {
        return this.endpointIsInput() === true
    },

    isSelective() {
        return !!this.is.selective
    },

    acceptsFrom(tack) {
        if (!this.isSelective()) return true
        return this.key() === tack.key()
    },

    areConnected(tack) {
        const A = this.getOther()
        const B = tack.getOther()

        if (!A || !B) return false
        if (A.is.tack || B.is.tack) return false

        const inputA = this.endpointIsInput(A)
        const inputB = tack.endpointIsInput(B)

        if (inputA === null || inputB === null) return false
        if (inputA === inputB) return false
        if (A.is.pin && B.is.pin && A.node === B.node) return false

        const inputTack = inputA ? this : tack
        const outputTack = inputA ? tack : this

        return inputTack.acceptsFrom(outputTack)
    },

    makeConxList(list, visited = new Set(), blockedRoute = null, origin = this) {
        if (visited.has(this)) return
        visited.add(this)

        for(const tack of this.cable.tacks) {
            if (tack === this) continue
            if (!tack.route?.from || !tack.route?.to) continue
            if (tack.route === blockedRoute) continue

            const other = tack.getOther()

            if (other.is.tack) {
                other.makeConxList?.(list, visited, blockedRoute, origin)
            }
            else if (!origin.areConnected(tack)) {
                continue
            }
            else if (other.is.pin) {
                other.is.proxy ? other.pad.makeConxList(list) : list.push(other)
            }
            else if (other.is.pad) {
                other.proxy.makeConxList(list)
            }
        }
    },

    highLightRoutes(visited = new Set(), origin = this) {
        if (visited.has(this)) return
        visited.add(this)

        this.cable.is.highLighted = true
        this.route.highLight()

        for(const tack of this.cable.tacks) {
            if (tack === this) continue
            if (!tack.route?.from || !tack.route?.to) continue

            const other = tack.getOther()

            if (other?.is?.tack) {
                tack.route.highLight()
                other.highLightRoutes(visited, origin)
            }
            else if (origin.areConnected(tack)) {
                tack.route.highLight()
            }
        }
    },

    unHighLightRoutes(visited = new Set(), origin = this) {
        if (visited.has(this)) return
        visited.add(this)

        this.cable.is.highLighted = false
        this.route.unHighLight()

        for(const tack of this.cable.tacks) {
            if (tack === this) continue
            if (!tack.route?.from || !tack.route?.to) continue

            const other = tack.getOther()

            if (other?.is?.tack) {
                tack.route.unHighLight()
                other.unHighLightRoutes(visited, origin)
            }
            else if (origin.areConnected(tack)) {
                tack.route.unHighLight()
            }
        }
    },

    rank() {
        return {up:1, down:1}
    }
}
