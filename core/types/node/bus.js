// a bus groups a number of connections
import {shape, inside, segmentsInside, style, eject, makeUID} from '../util/index.js'
import {Widget} from '../widget/index.js'
import {busConnect} from './bus-connect.js'
import {busJsonHandling} from './bus-json.js'
import {busDrawing} from './bus-draw.js'
import {zap} from '../view/index.js'

export function Bus(name, from, uid = null) {

    // unique identifier for the bus
    this.uid = uid

    // save the name
    this.name = name ?? ''

    // note that a widget id is never 0 ! currently not used
    this.widGenerator = 0

    // state
    this.is = {
        bus: true,
        selected: false,
        hoverOk: false,
        hoverNok : false,
        highLighted: false,
        cable: false,
        filter: false
    }

    // the filter is a factory.
    this.filter = null

    // incoming connections
    this.rxTable = []

    // outgoing connections
    this.txTable = []

    // set the start and endpoint of the bus before defining the labels
    this.wire = []
    this.wire.push({x:from.x, y:from.y})
    this.wire.push({x:from.x, y:from.y})

    // w and h for the labels - w is set by place()
    const h = style.bus.hLabel
    const w = 0

    // now set the labels
    this.startLabel  = new Widget.BusLabel({x:0, y:0, w,h}, this)
    this.endLabel = new Widget.BusLabel({x:0, y:0, w,h}, this)

    // place the two labels
    this.startLabel.place()
    this.endLabel.place()

    // the contacts on the bus
    this.tacks = []
}
Bus.prototype = {

    render(ctx) {

        if (this.wire.length < 2) return

        const st = style.bus

        const cLine =     this.is.hoverNok ? st.cBad 
                        : this.is.selected || this.is.hoverOk ? st.cSelected
                        : this.is.highLighted ? st.cHighLighted
                        : st.cNormal

        // Draw a bus or a cable...
        shape.drawBus(ctx,this.wire, cLine, st.wCable)

        // render the two labels
        this.startLabel.render(ctx)
        this.endLabel.render(ctx)

        // also render the tacks
        this.tacks.forEach( tack => tack.render(ctx) )
    },

    generateWid() {
        return ++this.widGenerator
    },

    highLight() {

        // the bus itself
        this.is.highLighted = true

        // the labels
        this.startLabel.highLight()
        this.endLabel.highLight()

        // the tacks and routes
        for (const tack of this.tacks) tack.route.highLight()
    },

    unHighLight() {
        
        this.is.highLighted = false

        this.startLabel.unHighLight()
        this.endLabel.unHighLight()

        for (const tack of this.tacks) tack.route.unHighLight()
    },

    // returns zap, bus, label, tack, segment
    hitTest(pos) {

        // check the label
        let label =   inside(pos, this.startLabel.rect) ? this.startLabel 
                    : inside(pos, this.endLabel.rect) ? this.endLabel 
                    : null;
                    
        if (label) return [zap.busLabel, this, label, null, 0]

        // check the segments
        let segment = this.hitSegment(pos)
        if (segment) return [zap.busSegment, this, null, null, segment]

        // check the tacks
        for (const tack of this.tacks) {

            // check if inside the rectangle
            if (inside(pos, tack.rect)) return [zap.tack, this, null, tack, 0]

            if (tack.alias && inside(pos, tack.rcAlias)) return [zap.tack, this, null, tack, 0]
        }

        // nothing
        return [zap.nothing, null, null, null, 0]
    },

    // returns the segment that was hit
    hitSegment(pos) {
        
        // notation
        const L = this.wire.length
        const x = pos.x
        const y = pos.y

        // check if the point lies on the route
        for (let i=0; i<L-1; i++) {

            const a = this.wire[i]
            const b = this.wire[i+1]

            // the precision in pixels
            const d = 5

            // horizontal
            if (a.y == b.y) {
                if ((y > a.y - d) && (y < a.y + d))
                    if (((x >= a.x) && (x <= b.x)) || ((x >= b.x) && (x <= a.x))) return i+1
            }
            // vertical
            else {
                if ((x > a.x - d) && (x < a.x + d))
                    if (((y >= a.y) && (y <= b.y)) || ((y >= b.y) && (y <= a.y))) return i+1
            }
        }

        // no hit
        return 0
    },

    singleSegment() {
        return (this.wire.length === 2)
    },

    hitRoute(pos) {

        let segment = 0
        for (const tack of this.tacks) {
            if ((tack.route.from == tack)&&(segment = tack.route.hitSegment(pos)))  return [zap.route, tack.route, segment]
        }
        return [zap.nothing, null, 0]
    },

    // check if (part of) the bus is inside the rectangle
    overlap(rect) {
        return segmentsInside(this.wire, rect)?.length > 0 ? true : false
    },

    findTack(from) {
        return this.tacks.find( tack => (tack.route.from == from) || (tack.route.to == from))
    },

    removeTack(tack) {

        eject(this.tacks, tack)
    },

    // make a connection netween a route and the bus segment 
    // the route is conected at the route.to, i.e. route.to is null
    addTack(route) {

        // the other terminal of the route
        const other = route.to == null ? route.from : route.to

        // we only accept one connection to the bus from the same pin/pad
        if (this.findTack(other)) return null

        // create the widget
        const newTack = new Widget.BusTack(this)

        // set the route for this tack
        newTack.setRoute(route)

        // save the tack on this bus
        this.tacks.push(newTack)

        // return the widget
        return newTack
    },

    newTack(alias = null) {
        // make a tack
        const tack = new Widget.BusTack(this)

        // set the alias if any
        if (alias) tack.alias = alias

        // set the tack
        this.tacks.push(tack)

        // done
        return tack
    },

    // copies labels and points - after cloning both buses are still conncted to the same tacks !
    copy() {
        // create a new bus
        const newBus = new Bus( this.name, this.wire[0], this.uid)

        // copy the wire 
        newBus.wire = this.copyWire()

        // place the labels again
        newBus.startLabel.place()
        newBus.endLabel.place()

        // done
        return newBus
    },

    copyTacks(newBus, newRoot) {

        // copy the tacks
        for (const tack of this.tacks) {

            // clone the route - the from and to widgets are still the old ones
            const newRoute = tack.route.clone()

            // make a new tack
            const newTack = new Widget.BusTack(newBus)

            // replace the old tack with the new
            newRoute.to.is.tack ?  newRoute.to = newTack : newRoute.from = newTack

            // set the route
            newTack.setRoute(newRoute)

            // now find the copied node where the route starts - first shorten the notation
            const other = newRoute.to.is.tack ? newRoute.from : newRoute.to

            // the other end can be a pin or a pad
            if (other.is.pin) {

                // find the other node in the new root 
                const node = newRoot.nodes.find( node => node.uid == other.node.uid)

                // find the other widget
                const pin = node.look.findPin(other.name, other.is.input)

                // and save the newly found other again in the route itself
                newRoute.to.is.tack ? newRoute.from = pin : newRoute.to = pin

                // save the route also in the other
                pin.routes.push( newRoute )
            }
            else if (other.is.pad) {

                // find the corresponding pad in the newRoot
                const pad = newRoot.pads.find( pd => pd.proxy.name == other.proxy.name)

                // and save the newly found other again in the route itself
                newRoute.to.is.tack ? newRoute.from = pad : newRoute.to = pad

                // save the route also
                pad.routes.push(newRoute)
            }

            // save the widget in the new bus
            newBus.tacks.push(newTack)
        }
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

    // make a copy of the segment and the route points of the links on the bus
    copyTackWires() {

        const copy = []
        for (const tack of this.tacks) {
            const track = tack.route.copyWire()
            copy.push({segment: tack.segment, track})
        }
        return copy
    },

    restoreTackWires(copy) {

        // the links and the copy array have the same size !!
        const tacks = this.tacks
        const L = tacks.length
        for(let i = 0; i < L; i++) {

            tacks[i].segment = copy[i].segment
            tacks[i].route.restoreWire(copy[i].track)
        }
    },

    hasFilter(){
        return this.is.filter
    },

    // returns the arl to be used to get to the source for the filter
    getFilterArl(jslib, link, localIndex) {

        // if there is a link and the link is a library - take that
        if ( link?.model?.is.lib ) return link.model.getArl()

        // if there is a current lib (ie a lib where a group was defined) use that
        if (jslib) return jslib.arl

        // if the factory arl has been set explicitely, use that
        if (this.filter.arl) return this.filter.arl

        // if the link is a json file, the source can be found via the index file in the directory of that model
        if (link?.model) return link.model.getArl().resolve('index.js')
            
        // else we assume the source can be locacted by using the index.js file in the model directory
        return localIndex
    },

    getFilter(srcImports, lib, link) {

       // for a source node find the arl to be used for the source - or take the ./index.js file in the directory of the model
       const filterArl = this.getFilterArl(lib, link, srcImports[0].arl)

       // check if the factoryname is already in use somewhere and use an alias if necessary - else just use the name
       const filterSpec = this.filter.duplicate(srcImports, filterArl) ? `${this.filter.fName} as ${this.filter.alias}` : this.filter.fName

       // see if the arl is already in the list
       const found = srcImports.find( srcImport => srcImport.arl.equals(filterArl))

       // if we have the file, add the item there if..
       if (found) {

           // ..it is not already in the list..
           const item = found.items.find( item => item == filterSpec)

           // ..if not add it to the list
           if (!item) found.items.push(filterSpec)
       }
       else {
           // add the file and put the first item on the list
           srcImports.push({arl:filterArl, items:[filterSpec]})
       }        
    }
}
Object.assign(Bus.prototype, busConnect, busJsonHandling, busDrawing)