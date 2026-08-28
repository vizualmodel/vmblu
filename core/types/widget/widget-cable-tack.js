import {canonicalOrthogonalWire, shape, convert, style, closestPointOnCurve} from '../util/index.js'

const endpointZones = new Set(['N', 'E', 'S', 'W'])

function zoneVector(zone) {
    if (zone === 'N') return {x: 0, y: -1}
    if (zone === 'S') return {x: 0, y: 1}
    if (zone === 'W') return {x: -1, y: 0}
    return {x: 1, y: 0}
}

function movementZone(delta) {
    if (Math.abs(delta.x) >= Math.abs(delta.y)) return delta.x < 0 ? 'W' : 'E'
    return delta.y < 0 ? 'N' : 'S'
}

export function CableTack(cable, wid = null) {

    this.rect = {x:0, y:0, w: 0, h: 0}

    this.is = {
        tack: true,
        selected: false,
        highLighted: false,
        bridge: false,
        selective: false,
        inflow: false           // true if to the cable
    }

    // Owner trunk.
    this.cable = cable
    Object.defineProperty(this, 'bus', {
        get: () => this.cable,
        set: value => { this.cable = value }
    })

    this.wid = wid ?? cable.generateWid?.() ?? null
    this.attachment = {kind: 'interior', segment: 0, point: null}
    Object.defineProperty(this, 'segment', {
        enumerable: true,
        get: () => this.isEndpoint('start') ? 1
                 : this.isEndpoint('end') ? Math.max(1, this.cable.wire.length - 1)
                 : this.attachment.segment,
        set: value => {
            if (!this.isEndpoint()) this.attachment.segment = value
        }
    })
    Object.defineProperty(this.is, 'endpoint', {
        enumerable: true,
        get: () => this.isEndpoint()
    })
    this.zone = 'E'
    this.alias = null
    this.rcAlias = null
    this.route = null
}

CableTack.prototype = {

    isEndpoint(label = null) {
        if (this.attachment.kind !== 'endpoint') return false
        return label == null || this.attachment.endpoint === label
    },

    endpointLabel() {
        return this.isEndpoint() ? this.attachment.endpoint : null
    },

    endpointApproach() {
        if (!this.isEndpoint()) return null
        return endpointZones.has(this.attachment.approach) ? this.attachment.approach : this.aliasZone()
    },

    nearestEndpoint(point) {
        const start = this.cable.wire[0]
        const end = this.cable.wire.at(-1)
        if (!start) return 'start'
        if (!end) return 'end'

        const startDistance = Math.hypot(point.x - start.x, point.y - start.y)
        const endDistance = Math.hypot(point.x - end.x, point.y - end.y)
        return startDistance <= endDistance ? 'start' : 'end'
    },

    attachmentPoint() {
        if (this.isEndpoint()) {
            const point = this.endpointLabel() === 'start' ? this.cable.wire[0] : this.cable.wire.at(-1)
            return point ? {...point} : {x: 0, y: 0}
        }
        if (this.attachment.point) return {...this.attachment.point}

        const delta = this.zoneDelta()
        return {x: this.rect.x + delta.x, y: this.rect.y + delta.y}
    },

    copyAttachment() {
        return this.isEndpoint()
            ? {kind: 'endpoint', endpoint: this.endpointLabel(), approach: this.endpointApproach()}
            : {
                kind: 'interior',
                segment: this.attachment.segment,
                point: this.attachment.point ? {...this.attachment.point} : null
            }
    },

    restoreAttachment(attachment) {
        if (attachment?.kind === 'endpoint') this.attachEndpoint(attachment.endpoint, attachment.approach)
        else this.attachInterior(attachment?.point ?? this.center(), attachment?.segment ?? this.segment)
    },

    restoreLegacyAttachment(segment, endpoint = false) {
        const point = this.route ? this.getContactPoint() : this.center()
        if (endpoint) this.attachEndpoint(this.cable.endpointAt(point) ?? this.nearestEndpoint(point))
        else this.attachInterior(point, segment)
    },

    endpointAttachment(label, approach = null) {
        if (label !== 'start' && label !== 'end') return false
        const current = this.isEndpoint(label) ? this.attachment.approach : null
        const inferred = this.route ? this.aliasZone() : this.zone
        this.attachment = {
            kind: 'endpoint',
            endpoint: label,
            approach: endpointZones.has(approach) ? approach
                    : endpointZones.has(current) ? current
                    : endpointZones.has(inferred) ? inferred
                    : 'E'
        }
        return true
    },

    setEndpointAttachment(label, approach = null) {
        if (!this.endpointAttachment(label, approach)) return false
        this.placeAttachment()
        return true
    },

    attachEndpoint(label, approach = null) {
        if (!this.endpointAttachment(label, approach)) return false
        this.syncRouteContact()
        this.placeAttachment()
        return true
    },

    setInteriorAttachment(point, segment) {
        this.attachment = {kind: 'interior', segment, point: {...point}}
        this.placeAttachment()
        return true
    },

    attachInterior(point, segment) {
        this.attachment = {kind: 'interior', segment, point: {...point}}
        this.syncRouteContact()
        this.placeAttachment()
        return true
    },

    reverseAttachment(wireLength) {
        if (this.isEndpoint()) {
            this.attachment.endpoint = this.endpointLabel() === 'start' ? 'end' : 'start'
        }
        else {
            this.attachment.segment = wireLength - this.attachment.segment
        }
    },

    syncRouteContact() {
        if (!this.route) return

        const point = this.attachmentPoint()
        const contact = this.getContactPoint()
        contact.x = point.x
        contact.y = point.y
    },

    placeAttachment() {
        this.placeRect(this.attachmentPoint(), this.segment)
    },

    render(ctx) {

        const color =  this.is.selected ? style.cable.cSelected
                     : this.is.highLighted ? style.cable.cHighLighted
                     : style.cable.cTack

        const rc = this.drawingRect()

        const center = {x: rc.x + rc.w/2, y: rc.y + rc.h/2}

        this.is.bridge  ? shape.bridge(ctx, center.x, center.y, style.cable.rTack, color)
                        : shape.tack(ctx, rc.x,rc.y,rc.w,rc.h,this.zone,this.is.inflow,this.is.selective,color)

        if (this.alias && this.route) {
            if (!this.rcAlias) {
                this.rcAlias = shape.rcAlias(ctx, this.alias, this.zone, this.rect.x, this.rect.y, style.cable.fAlias)
            }

            shape.drawAlias(ctx, this.alias, this.rcAlias, color, style.cable.fAlias)
        }
    },

    inferRouteApproach(route = this.route) {
        if (!route) return
        const wire = route.wire
        if (!wire || wire.length < 2) return 'E'
        const atStart = route.from == this
        const a = atStart ? wire[0] : wire.at(-1)
        if (!a) return 'E'
        let b

        // Rerouting can leave a duplicate point next to the tack when the pin
        // and cable endpoint are collinear. Use the first real segment so a
        // zero-length segment cannot turn a horizontal arrow north or south.
        for (let i = atStart ? 1 : wire.length - 2;
             atStart ? i < wire.length : i >= 0;
             i += atStart ? 1 : -1) {
            if (wire[i].x !== a.x || wire[i].y !== a.y) {
                b = wire[i]
                break
            }
        }

        if (!b) return this.zone ?? 'E'
        if (a.x !== b.x && a.y !== b.y) return this.zone ?? 'E'
        return (a.x === b.x) ? (a.y < b.y ? 'S' : 'N') : (a.x < b.x ? 'E' : 'W')
    },

    aliasZone() {
        return this.inferRouteApproach()
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
        this.attachInterior(inter.point, inter.segment)
    },

    zoneDelta() {
        const r = style.cable.rTack

        switch(this.zone) {
            case 'N': return {x: r, y: 2*r};
            case 'S': return {x: r, y: 0};
            case 'E': return {x: 0, y: r};
            case 'W': return {x: 2*r, y: r};
            default: return {x: 0, y: r};
        }
    },

    drawingRect() {
        const rc = {...this.rect}
        if (!this.isEndpoint() || this.is.bridge) return rc

        const gap = style.cable.gap
        if (this.zone === 'N') rc.y -= gap
        else if (this.zone === 'S') rc.y += gap
        else if (this.zone === 'W') rc.x -= gap
        else if (this.zone === 'E') rc.x += gap
        return rc
    },

    tackRect() {

        if (this.isEndpoint()) {
            this.is.inflow = !this.endpointIsInput()
            this.attachEndpoint(this.endpointLabel())
            return
        }

        const inter = this.intersection()
        this.is.inflow = !this.endpointIsInput()
        this.attachInterior(inter.point, inter.segment)
    },

    placeOnSegment(point, segment) {

        const endpoint = this.isEndpoint() ? this.cable.endpointAt(point) : null
        return endpoint ? this.attachEndpoint(endpoint) : this.attachInterior(point, segment)
    },

    placeRect(point, segment) {

        this.rcAlias = null
        this.rect.w = 2 * style.cable.rTack
        this.rect.h = 2 * style.cable.rTack

        // place the bridge on the crossing 
        if (this.is.bridge) {
            this.rect.x = point.x - this.rect.w/2
            this.rect.y = point.y - this.rect.h/2
        }
        // place the tack in the right zone
        else {
            this.zone = this.isEndpoint() ? this.endpointApproach() : this.aliasZone()
            const delta =  this.zoneDelta()
            this.rect.x = point.x - delta.x
            this.rect.y = point.y - delta.y
        }
    },

    refreshPlacement() {

        if (!this.route?.from || !this.route?.to) return

        this.rcAlias = null
        this.is.bridge ? this.bridgeRect() : this.tackRect()
    },

    beginSlide() {
        this.slideGesture = {delta: {x: 0, y: 0}, mode: null}
    },

    endSlide() {
        const mode = this.slideGesture?.mode ?? null
        this.slideGesture = null
        return mode
    },

    horizontal() {
        const s = this.segment
        const w = this.cable.wire
        return Math.floor(w[s-1].y) === Math.floor(w[s].y)
    },

    center() {
        return this.attachmentPoint()
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
        if (this.is.bridge) {
            this.attachment.point.x += dx
            this.placeAttachment()
            this.route.autoRoute()
            return
        }

        const p = this.getContactPoint()
        p.x += dx
        this.placeOnSegment(p, this.segment)
        if (this.isEndpoint()) this.alignRouteEndpoint()
    },

    moveY(dy) {
        if (this.is.bridge) {
            this.attachment.point.y += dy
            this.placeAttachment()
            this.route.autoRoute()
            return
        }

        const p = this.getContactPoint()
        p.y += dy
        this.placeOnSegment(p, this.segment)
        if (this.isEndpoint()) this.alignRouteEndpoint()
    },

    moveXY(dx,dy) {
        if (this.is.bridge) {
            this.attachment.point.x += dx
            this.attachment.point.y += dy
            this.placeAttachment()
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
        if (!this.isEndpoint() && this.attachment.point) {
            this.attachment.point.x += dx
            this.attachment.point.y += dy
        }

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

    inwardEndpointZone() {
        if (!this.isEndpoint()) return null
        const endpoint = this.endpointLabel() === 'start' ? this.cable.wire[0] : this.cable.wire.at(-1)
        const adjacent = this.endpointLabel() === 'start' ? this.cable.wire[1] : this.cable.wire.at(-2)
        if (!endpoint || !adjacent) return null
        return movementZone({x: adjacent.x - endpoint.x, y: adjacent.y - endpoint.y})
    },

    setEndpointApproach(approach) {
        if (!this.isEndpoint() || !endpointZones.has(approach)) return false
        this.attachment.approach = approach
        this.applyEndpointApproach()
        this.placeAttachment()
        return true
    },

    applyEndpointApproach() {
        if (!this.isEndpoint() || !this.route?.from || !this.route?.to) return false

        const approach = this.endpointApproach()
        if (!endpointZones.has(approach)) return false

        const route = this.route
        if (route.wire.length < 2) return false
        this.syncRouteContact()
        const atStart = route.from === this
        const routeContact = atStart ? route.wire[0] : route.wire.at(-1)
        const routeNeighbour = atStart ? route.wire.slice(1).find(point => point.x !== routeContact.x || point.y !== routeContact.y)
                                       : route.wire.slice(0, -1).reverse().find(point => point.x !== routeContact.x || point.y !== routeContact.y)
        if (routeNeighbour
            && (routeContact.x === routeNeighbour.x || routeContact.y === routeNeighbour.y)
            && this.aliasZone() === approach) return true

        const forward = (route.from === this ? route.wire : route.wire.slice().reverse())
            .map(point => ({...point}))
        if (forward.length < 2) return false

        const contact = this.attachmentPoint()
        const anchorIndex = Math.min(2, forward.length - 1)
        const anchor = forward[anchorIndex]
        const tail = forward.slice(anchorIndex + 1)
        const vector = zoneVector(approach)
        const distance = style.route.tooClose
        const leg = {x: contact.x + vector.x * distance, y: contact.y + vector.y * distance}
        const horizontal = vector.x !== 0
        const sameApproach = horizontal
            ? anchor.y === contact.y && (anchor.x - contact.x) * vector.x > 0
            : anchor.x === contact.x && (anchor.y - contact.y) * vector.y > 0
        const oppositeApproach = horizontal
            ? anchor.y === contact.y && (anchor.x - contact.x) * vector.x <= 0
            : anchor.x === contact.x && (anchor.y - contact.y) * vector.y <= 0

        let head
        if (sameApproach) {
            head = [contact, anchor]
        }
        else if (oppositeApproach) {
            const oldNext = forward.find(point => point.x !== contact.x || point.y !== contact.y) ?? anchor
            const side = horizontal ? Math.sign(oldNext.y - contact.y) || 1 : Math.sign(oldNext.x - contact.x) || 1
            head = horizontal
                ? [contact, leg, {x: leg.x, y: contact.y + side * distance}, {x: anchor.x, y: contact.y + side * distance}, anchor]
                : [contact, leg, {x: contact.x + side * distance, y: leg.y}, {x: contact.x + side * distance, y: anchor.y}, anchor]
        }
        else {
            head = horizontal
                ? [contact, leg, {x: leg.x, y: anchor.y}, anchor]
                : [contact, leg, {x: anchor.x, y: leg.y}, anchor]
        }

        const nextWire = canonicalOrthogonalWire([...head, ...tail])
        route.wire = route.from === this ? nextWire : nextWire.reverse()
        return true
    },

    slideEndpointInward(delta, a, b) {
        const label = this.endpointLabel()
        const cableEndpoint = label === 'start' ? this.cable.wire[0] : this.cable.wire.at(-1)
        const other = cableEndpoint === a ? b : a
        const horizontal = a.y === b.y
        const axis = horizontal ? 'x' : 'y'
        const point = this.center()
        const direction = Math.sign(other[axis] - cableEndpoint[axis])
        const inwardDistance = delta[axis] * direction
        const segmentLength = Math.abs(other[axis] - cableEndpoint[axis])
        const maximumDistance = Math.max(0, segmentLength - style.cable.radius)

        if (inwardDistance <= 0 || maximumDistance === 0) {
            this.attachEndpoint(label)
            return
        }

        const distance = Math.min(Math.max(inwardDistance, style.cable.radius), maximumDistance)
        point[axis] = cableEndpoint[axis] + direction * distance

        this.setInteriorAttachment(point, this.segment)
        this.route.adjust({moveCableEndpoint: false})
    },

    slide(delta) {
        if (!this.ensureSegment()) return

        const [a,b] = [this.cable.wire[this.segment -1], this.cable.wire[this.segment]]
        const point = this.center()
        const radius = style.cable.radius
        const horizontal = a.y === b.y
        const axis = horizontal ? 'x' : 'y'
        let endpoint = null

        if (this.isEndpoint()) {
            if (this.slideGesture) {
                this.slideGesture.delta.x += delta.x
                this.slideGesture.delta.y += delta.y
                const movement = this.slideGesture.delta
                const zone = movementZone(movement)

                if (zone === this.inwardEndpointZone()) {
                    this.slideGesture.mode = 'slide'
                    this.slideEndpointInward(movement, a, b)
                }
                else if (Math.max(Math.abs(movement.x), Math.abs(movement.y)) >= style.cable.radius) {
                    this.slideGesture.mode = 'orientation'
                    this.setEndpointApproach(zone)
                }
                return
            }
            return this.slideEndpointInward(delta, a, b)
        }

        point[axis] += delta[axis]
        const first = a[axis] <= b[axis] ? a : b
        const last = first === a ? b : a
        const minimum = first[axis] + radius
        const maximum = last[axis] - radius
        const firstEndpoint = this.cable.endpointAt(first)
        const lastEndpoint = this.cable.endpointAt(last)

        if (point[axis] <= minimum) {
            if (firstEndpoint) endpoint = firstEndpoint
            else point[axis] = minimum
        }
        else if (point[axis] >= maximum) {
            if (lastEndpoint) endpoint = lastEndpoint
            else point[axis] = maximum
        }
        else point[axis] = Math.min(Math.max(point[axis], minimum), maximum)

        endpoint
            ? this.setEndpointAttachment(endpoint)
            : this.setInteriorAttachment(point, this.segment)
        this.route.adjust({moveCableEndpoint: false})
    },

    alignRouteEndpoint() {
        if (!this.ensureSegment()) return

        const route = this.route
        const p = route.wire

        const center = this.center()
        const trunk = this.cable.wire
        const [a,b] = [trunk[this.segment - 1], trunk[this.segment]]
        const horizontal = this.isEndpoint()
            ? ['E', 'W'].includes(this.endpointApproach())
            : a.x === b.x

        if (p.length < 3) {
            horizontal ? route.fourPointRoute() : route.threePointRoute(this === route.to)
        }

        if (route.from === this) {
            p[0].x = center.x
            p[0].y = center.y

            horizontal ? p[1].y = center.y : p[1].x = center.x
        }
        else {
            const last = p.length - 1

            p[last].x = center.x
            p[last].y = center.y

            horizontal ? p[last - 1].y = center.y : p[last - 1].x = center.x
        }

        route.keepEndpointApproach?.(this)
        this.refreshPlacement()
    },

    fuseEndSegment() {
        if (this.route.wire.length < 4) return

        const route = this.route
        const p = route.wire
        const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false]

        if ((a.y == b.y) && (Math.abs(c.y - b.y) < style.route.tooClose)) {
            const point = {x: a.x, y: c.y}
            if (this.isEndpoint() && !this.cable.moveEndpoint(this.endpointLabel(), point, {skipRouteFor: this})) return false
            a.y = c.y
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)
            this.placeOnSegment(a, this.segment)
            return true
        }
        else if ((a.x == b.x)&&(Math.abs(b.x - c.x) < style.route.tooClose)) {
            const point = {x: c.x, y: a.y}
            if (this.isEndpoint() && !this.cable.moveEndpoint(this.endpointLabel(), point, {skipRouteFor: this})) return false
            a.x = c.x
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)
            this.placeOnSegment(a, this.segment)
            return true
        }
        return false
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
        return false
    },

    setSelective(selective) {
        this.is.selective = !!selective
    },

    incoming() {
        const input = this.endpointIsInput()
        return input === null ? false : !input
    },

    actualName() {
        const actual = this.actualEndpoint()
        return this.alias ?? actual?.name ?? null
    },

    canBeSelective() {
        return this.endpointIsInput() === true
    },

    acceptsFrom(tack) {
        if (!this.is.selective) return true
        return this.actualName() === tack.actualName()
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
