import {shape,convert,style} from '../util/index.js'

// an in out symbol is a triangle 
export function BusTack(bus, wid = null) {

    // the rectangle will be filled in by orient
    this.rect = {x:0, y:0, w: 0, h: 0}

    // set the type
    this.is = {
        tack: true,
        selected: false,
        highLighted: false,
        channel: false,
        top: false                  // ball on top for tacks going to inputs / at the bottom for tacks coming from outputs
    }

    // save the bus this tack is connected to
    this.bus = bus

    // the wid of this tack - currently not used !
    this.wid = wid ?? bus.generateWid()

    // the segment of the bus on which the tack sits 
    this.segment = 0

    // direction of the tack 'up 'down' 'right' 'left'
    this.dir = ''

    // the route
    this.route = null
}

BusTack.prototype = {

    render(ctx) {
        // the color
        const color =  this.is.selected ? style.bus.cSelected 
                     : this.is.highLighted ? style.bus.cHighLighted
                     : style.bus.cNormal

        // put a small rectangle for a tack for router
        if (this.bus.is.filter) shape.filterSign(ctx, this.getContactPoint(),style.bus.wCable, color)

        // draw the tack
        shape.tack(ctx, this.dir, this.is.channel, this.is.top, this.rect, style.route.wNormal, color)
    },

    // sets the route for a tack and places the tack on that route
    setRoute(route) {

        // the route to this tack
        this.route = route

        // if one of the end points is still null, set the tack
        if (!route.to) route.to = this 
        else if (!route.from) route.from = this

        // get the other endpoint of the route 
        const other = route.from == this ? route.to : route.from

        // check if the tack is channel
        this.is.channel  = other.is.pad ? other.proxy.is.channel  : other.is.channel
        this.is.top = other.is.pad ? !other.proxy.is.input : other.is.input

        // and place the tack
        this.orient()
    },

    // sets the arrow in the correct position (up down left right) - does not change the route
    orient() {

        // helper function - the tack direction to a pad is the opposite of the tack direction to a pin
        // inflow - flow to the bus - is true in thes cases:  output pin >---->||  input pad >----->||  
        const inflow = (widget) => widget.is.pin ? widget.is.input : !widget.proxy.is.input

        // notation
        const rWire = this.route.wire
        const bWire = this.bus.wire
        const other = this.route.to == this ? this.route.from : this.route.to

        // the points of the route on the bus (crossing segment) - a is the point on the bus
        const a = this.route.to == this ? rWire.at(-1) : rWire[0]
        const b = this.route.to == this ? rWire.at(-2) : rWire[1]

        // determine the segment of the bus
        this.segment = this.bus.hitSegment(a) 

        // SHOULD NOT HAPPEN
        if (this.segment == 0) {
            console.error('*** SEGMENT ON BUS NOT FOUND ***', other, this.bus)
            this.segment = 1
        }

        // the bus segment can be horizontal or vertical
        const horizontal = Math.floor(bWire[this.segment-1].y) === Math.floor(bWire[this.segment].y)

        //notation
        const rc = this.rect
        const sp = bWire[this.segment]

        // to place the arrow we take the width of the bus into account - the -1 is to avoid a very small gap
        const shift = style.bus.wNormal/2 - 1

        // set the rectangle values
        if (horizontal) {
            rc.w = style.bus.wArrow
            rc.h = style.bus.hArrow
            rc.x = a.x - rc.w/2
            if (b.y > a.y) {
                rc.y = sp.y + shift
                this.dir = inflow(other) ? 'down' : 'up'
            }
            else {
                rc.y = sp.y - rc.h - shift
                this.dir = inflow(other) ? 'up' : 'down'
            }
            // allign the route endpoint perfectly with the bus (could stick out a little bit)
            a.y = sp.y
        }
        else {
            rc.w = style.bus.hArrow
            rc.h = style.bus.wArrow
            rc.y = a.y - rc.h/2
            if (b.x > a.x) {
                rc.x = sp.x + shift
                this.dir = inflow(other) ? 'right' : 'left'
            }
            else {
                rc.x = sp.x - rc.w - shift
                this.dir = inflow(other) ?  'left' : 'right'
            }
            // allign the route endpoint perfectly with the bus (could stick out a little bit)
            a.x = sp.x
        }
    },

    // point p is guaranteed to be on the bus - the arrow will be oriented correctly later...
    placeOnSegment(point, segment) {

        // save the segment
        this.segment = segment

        // check the segment
        const a = this.bus.wire[segment-1]
        const b = this.bus.wire[segment]

        // vertical
        if (a.x == b.x) {
            this.dir = 'left'
            this.rect.x = a.x
            this.rect.y = point.y 
        } else {
            this.dir = 'up'
            this.rect.x = point.x 
            this.rect.y = a.y
        }

    },

    // returns true if the tack is horizontal (the segment is vertical in that case !)
    horizontal() {
        return ((this.dir == 'left') || (this.dir == 'right'))
    },

    // center is where a route connects !
    center() {

        const rc = this.rect

        // check the segment
        if (this.segment == 0) return null

        const p = this.bus.wire[this.segment]
        return (this.dir == 'left' || this.dir == 'right') ? {x:p.x, y:rc.y + rc.h/2} : {x: rc.x + rc.w/2, y: p.y}
    },


    toJSON() {
        return convert.routeToString(this.route)
    },

    overlap(rect) {
        const rc = this.rect

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    remove() {
        // remove the route at both ends - this will also call removeRoute below !
        this.route.remove()
    },

    removeRoute(route) {
        // and remove the tack - the route is also gone then...
        this.bus.removeTack(this)
    },


    moveX(dx) {

        // move the rect
        this.rect.x += dx

        // move the endpoint of the route as well..
        const p = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)

        p.x += dx

        // place the link..
        this.orient()
    },

    moveY(dy) {

        // move the rect
        this.rect.y += dy

        // move the endpoint of the route as well..
        const p = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)

        p.y += dy

        // place the link..
        this.orient()
    },

    // just move the link and adjust the route
    moveXY(dx,dy) {

        // move the rect
        this.rect.x += dx
        this.rect.y += dy

        // check that we have enough segments
        if (this.route.wire.length == 2) this.route.addTwoSegments(this.route.wire[0], this.route.wire[1])

        // move the endpoint of the route as well..
        const a = this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
        const b = this.route.from == this ? this.route.wire[1] : this.route.wire.at(-2)

        // check
        const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y)

        // vertical
        if (vertical) {
            a.x += dx
            b.x += dx
            a.y += dy
        }
        // horizontal
        else {
            a.y += dy
            b.y += dy
            a.x += dx
        }

        // place the link..
        this.orient()
    },

    // check that the link stays on the segment
    slide(delta) {

        // notation
        let pa = this.bus.wire[this.segment -1]
        let pb = this.bus.wire[this.segment]
        const rc = this.rect
        const wBus = style.bus.wNormal

        // horizontal segment
        if (pa.y == pb.y) {
            // the max and min position on the segment
            let xMax = Math.max(pa.x, pb.x) - rc.w - wBus/2
            let xMin = Math.min(pa.x, pb.x) + wBus/2

            // increment 
            rc.x += delta.x

            // clamp to max or min
            rc.x = rc.x > xMax ? xMax : rc.x < xMin ? xMin : rc.x
        }
        else {
            // the max and min position on the segment
            let yMax = Math.max(pa.y, pb.y) - rc.h - wBus/2
            let yMin = Math.min(pa.y, pb.y) + wBus/2

            // increment check and adjust
            rc.y += delta.y

            // clamp to min / max
            rc.y = rc.y > yMax ? yMax : rc.y < yMin ? yMin : rc.y
        }
        // re-establish the connection with the end points
        this.route.adjust()
    },

    // sliding endpoints on a bus can cause segments to combine
    // s is 1 or the last segment
    fuseEndSegment() {

        // at least three segments 
        if (this.route.wire.length < 4) return 

        // notation - a is where the link is connected
        const route = this.route
        const p = route.wire
        const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false] 

        // horizontal segment
        if ((a.y == b.y) && (Math.abs(c.y - b.y) < style.route.tooClose)) {

            // move the endpoint
            a.y = c.y

            // remove the segment from the route
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)

            // and place the link again
            this.orient()
        }
        // vertical segment
        else if ((a.x == b.x)&&(Math.abs(b.x - c.x) < style.route.tooClose)) {

            // move the endpoint
            a.x = c.x

            // remove the segment
            front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)

            // and place the link again
            this.orient()
        }
        return
    },

    restore(route) {
    
        // set the route
        this.route = route

        // add to the bus widgets
        this.bus.tacks.push(this)

        // place the arrow 
        this.orient()
    },

    // return the widget at the other end
    getOther() {
        return this.route.from == this ? this.route.to : this.route.from
    },

    // return the pin or the proxy if the other is a pad
    getOtherPin() {
        const other = this.route.from == this ? this.route.to : this.route.from
        return other.is.pin ? other : (other.is.pad ? other.proxy : null)
    },

    getContactPoint() {
        return this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
    },

    // getOtherName() {
    //     const other = this.route.from == this ? this.route.to : this.route.from

    //     if (other.is.pin) return other.name
    //     if (other.is.pad) return other.proxy.name
    //     return null
    // },

    incoming() {
        const other = this.route.from == this ? this.route.to : this.route.from

        if (other.is.pin) return !other.is.input
        if (other.is.pad) return other.proxy.is.input
        return false
    },

    // does nothing but makes the widget ifPins more uniform
    highLightRoutes() {},
    unHighLightRoutes() {}
}