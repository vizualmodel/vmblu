// the route used for a connection between an output and an input
import {shape} from '../util/index.js'
import {style} from '../util/index.js'
import {routeDrawing} from './route-drawing.js'
import {routeMoving} from './route-moving.js'
import {connectHandling} from './route-connect.js'
import {rxtxHandling} from './route-rxtx.js'

export function Route(from, to) {

    this.from = from                    // ref to widget - from is just the draw direction, it can be input or output
    this.to = to                        // ref to widget
    this.is = {
        selected: false,
        highLighted: false,
        twistedPair: false,
        notUsed: false,
        newConx: false,                 // the route is there because of a new conx
        noConx: false                   // there is no corresponding connection anymore
    }
    // The wire between the two widgets
    this.wire = []                    
}
Route.prototype = {

    render(ctx) {

        // check
        if (this.wire.length < 2) return 

        // color
        const color = this.is.selected      ? style.route.cSelected 
                    : this.is.highLighted   ? style.route.cHighLighted
                    : this.is.newConx       ? style.route.cAdded
                    : this.is.noConx        ? style.route.cDeleted
                    : this.is.notUsed       ? style.route.cNotUsed
                    : style.route.cNormal

        //linewidth
        const width = this.is.selected ? style.route.wSelected : style.route.wNormal

        // draw the line segments
        this.is.twistedPair ? shape.twistedPair(ctx, color, width, this.wire) : shape.drawWire(ctx,color, width, this.wire)
    },

    // change the route direction
    reverse() {
        // reverse the from to pair
        [this.from, this.to] = [this.to, this.from]

        let p = this.wire
        let l = p.length

        // reverse the points - if l is uneven the middle point stays, which is ok
        for (let i=0; i<l/2; i++) [p[i], p[l-i-1]] = [p[l-i-1], p[i]]
    },

    select() {
        this.is.selected = true
        if (this.from) this.from.is.selected = true
        if (this.to) this.to.is.selected = true
    },

    unSelect() {
        this.is.selected = false
        if (this.from) this.from.is.selected = false
        if (this.to) this.to.is.selected = false
    },

    // highlight is simple
    highLight() {
        this.is.highLighted = true
        if (this.from) this.from.is.highLighted = true
        if (this.to) this.to.is.highLighted = true
    },

    // unhighlight is a bit more complicated
    unHighLight(){

        // if the other look is still highlighted and it belongs to a different node, do not turn off
        if ( (this.from?.node?.is.highLighted || this.to?.node?.is.highLighted) && this.from.node != this.to.node) return

        // turn off
        this.is.highLighted = false
        if (this.from) this.from.is.highLighted = false
        if (this.to) this.to.is.highLighted = false
    },

    setTwistedPair() {
        this.is.twistedPair = true
    },

    checkTwistedPair() {

        const A = this.from.is.input ? this.to : this.from

        if (!A) return

        if (A.is.pin && A.is.multi) this.is.twistedPair = true
        else if (A.is.pad && A.proxy?.is.multi) this.is.twistedPair = true
    },

    // generates the type string for a route
    typeString() {

        const from = this.from.is
        const to = this.to.is

        let str =     from.pin ? 'PIN' 
                    : from.tack ? 'BUS' 
                    : from.pad ? 'PAD' : ''
        str +=        to.pin ? '-PIN' 
                    : to.tack ? '-BUS' 
                    : to.pad ? '-PAD' : ''

        return str
    },

    // returns the segment 1, 2 etc - 0 means failure
    hitSegment(pos) {

        // notation
        const last = this.wire.length-1
        const x = pos.x, y = pos.y

        // the precision in pixels
        const delta = 5

        // check if the point lies on the route
        for (let i=0; i<last; i++) {

            const a = this.wire[i]
            const b = this.wire[i+1]
            
            // horizontal segment
            if (a.y == b.y) {
                if ((y < a.y + delta) && (y > a.y - delta) && ((a.x-x)*(b.x-x) <= 0)) return i+1
            }
            // vertical segment
            else {
                if ((x < a.x + delta) && (x > a.x - delta) && ((a.y-y)*(b.y-y) <= 0)) return i+1
            }         
        }
        // no hit
        return 0
    },

    remove() {
        this.from.removeRoute(this)
        this.to.removeRoute(this)
    },

    popFromRoute() {
        this.from.is.tack ? this.from.bus.tacks.pop() : this.from.routes.pop() 
    },

    clone() {
        // make a new route
        let newRoute = new Route(this.from, this.to)

        // copy the points array
        for (const point of this.wire) newRoute.wire.push({...point})

        // done
        return newRoute
    },

    restore() {

    },

    // used for undo/redo
    copyWire() {
        const copy = []
        for (const point of this.wire) copy.push({...point})
        return copy
    },

    restoreWire(copy) {
        this.wire = []
        for (const point of copy) this.wire.push({...point})
    },

    // returns A, B where the message flow is from A to B
    messageFlow() {

        const from = this.from
        const to = this.to

        if (from.is.pin) return from.is.input ?  [to, from] : [from, to]
        if (to.is.pin) return to.is.input ? [from, to] : [to, from]
        if (from.is.pad) return from.proxy.is.input ? [from, to] : [to, from]
        if (to.is.pad) return to.proxy.is.input ? [to, from] : [from, to]
        return [to, from]
    }

}
Object.assign(Route.prototype, routeDrawing, routeMoving, connectHandling, rxtxHandling)

