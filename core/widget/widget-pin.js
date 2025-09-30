import {shape,convert, style, eject} from '../util/index.js'
import {pinNameHandling} from './widget-pin-name.js'

export function Pin(rect,node,name,is){
    
    // copy the rectangle
    this.rect = {...rect} 

    // the node for which this is a pin
    this.node = node

    // the name
    this.name = name

    // pxlen = postfix or prefix length - a negative pxlen is a postfix
    this.pxlen = 0

    // the widget identifier
    this.wid = 0

    // state
    this.is = {
        pin: true,
        proxy: false,
        channel: is.channel ?? false,               
        input: is.input ?? false,
        left: is.left ?? false,      // default set inputs right
        multi: is.multi ?? false,    // the pin can send / receive several messages
        selected: false,             // when the pin is selected
        highLighted: false,
        hoverOk:false,               // to give feedback when hovering over the pin
        hoverNok: false,
        zombie: is.zombie ?? false,  // for pins that are invalid
        added: false,                // for pins that have been added (or name change)
        duplicate: false
    }

    // the parameter profile 
    this.profile = ''

    // The prompt for the input handler or a description of when the output is sent
    this.prompt = ''

    // the routes for this pin
    this.routes = []
}

// The pin prototype
Pin.prototype = {


    // pChar is where the cursor has to come
    drawCursor(ctx, pChar,on) {

        // notation
        const rc = this.rect
        const m = style.pin.wMargin

        // relative x position of the cursor
        const cx = ctx.measureText(this.name.slice(0,pChar)).width

        // absolute position of the cursor...
        const xCursor = this.is.left ? rc.x + m + cx : rc.x + rc.w - m - ctx.measureText(this.name).width + cx

        // the color for the blink effect
        const color = on ? style.std.cBlinkOn : style.std.cBlinkOff
        //const color = on ? style.pin.cConnected : style.box.cBackground

        // and draw the cursor
        shape.cursor(ctx, xCursor, rc.y, style.std.wCursor, rc.h, color) 
    },

    // arrows in and out
    render(ctx) {

        // notation
        const st = style.pin
        const rc = this.rect

        // the name to display
        const displayName = this.pxlen == 0 ?  this.name : this.withoutPrefix();

        // select the color for the widget
        const {cArrow, cText} = this.setColor()

        // the y position of the arrow
        const yArrow = rc.y+(st.hPin-st.wArrow)/2

        // we shift the arrow a little bit...
        const dx = style.box.wLine/2

        // The shape for a channel is different
        const pointLeft = this.is.channel ? shape.triangleBall : shape.leftTriangle
        const pointRight = this.is.channel ? shape.ballTriangle : shape.rightTriangle

// debug : draws a green rectangle around the pin
// shape.rectRect(ctx,rc.x, rc.y, rc.w, rc.h,"#00FF00", null)

        // render the text and arrow : 4 cases : left in >-- out <-- right in --< out -->
        if (this.is.left) {
            const xArrow = rc.x + st.wOutside
            this.is.multi   ? shape.leftTextMulti(ctx,displayName,st.fMulti,cText, rc.x + style.pin.wMargin,rc.y, rc.w, rc.h)
                            : shape.leftText(ctx,displayName,cText, rc.x + style.pin.wMargin,rc.y, rc.w, rc.h);
            this.is.input   ? pointRight(ctx,xArrow-dx, yArrow,st.hArrow, st.wArrow,cArrow)
                            : pointLeft(ctx,xArrow - st.hArrow + dx,yArrow,st.hArrow, st.wArrow,cArrow)
        }
        else {
            const xArrow = rc.x + rc.w - st.wOutside
            this.is.multi   ? shape.rightTextMulti(ctx, displayName, st.fMulti, cText,rc.x, rc.y,rc.w - style.pin.wMargin, rc.h)
                            : shape.rightText(ctx, displayName, cText,rc.x, rc.y,rc.w - style.pin.wMargin, rc.h);
            this.is.input   ? pointLeft(ctx,xArrow - st.hArrow + dx,yArrow,st.hArrow, st.wArrow,cArrow)
                            : pointRight(ctx,xArrow -dx ,yArrow,st.hArrow, st.wArrow,cArrow)        
        }

        // show name clashes
        if (this.is.duplicate) {
            shape.rectRect(ctx,rc.x, rc.y, rc.w, rc.h,st.cBad, null)
        }
    },

    setColor() {

        // color of the arrow ( unconnected connected selected)
        const cArrow =    this.is.hoverNok          ? style.pin.cBad
                        : this.is.hoverOk           ? style.pin.cSelected
                        : this.is.highLighted       ? style.pin.cHighLighted
                        : this.is.selected          ? style.pin.cSelected 
                        : this.routes.length > 0    ? style.pin.cConnected 
                        : style.pin.cNormal

        // color of the text
        const cText =     this.is.hoverNok          ? style.pin.cBad
                        : this.is.hoverOk           ? style.pin.cSelected
                        : this.is.added             ? style.pin.cAdded 
                        : this.is.zombie            ? style.pin.cBad 
                        : this.is.highLighted       ? style.pin.cHighLighted
                        : this.is.selected          ? style.pin.cSelected 
                        : this.routes.length > 0    ? style.pin.cConnected
                        : style.pin.cText
                
        return {cArrow, cText}
    },

    // returns the center of the pin (h of the arrow is along x-axis here !)
    center() {

        const wOut = style.pin.wOutside
        const rc = this.rect
        return this.is.left ? {x: rc.x + wOut, y: rc.y + rc.h/2} : {x: rc.x + rc.w - wOut, y: rc.y + rc.h/2}
    },

    // checks if a pin can connect to another pin
    canConnect(pin) {

        // from and to are the same 
        if (this == pin) return false

        // both cannot be outputs or inputs
        if (this.is.input === pin.is.input) return false

        // multi messages can only be connected if there is a (partial) overlap
        if ((this.is.multi || pin.is.multi) && !this.hasMultiOverlap(pin)) return false

        // check if we have already a connection between the pins
        if (this.haveRoute(pin)) return false

        // its ok
        return true
    },

    // There is a route to the widget, but check if messages can flow 
    areConnected(widget) {

        if (widget.is.pin) {

            // should not happen
            if (widget.is.input == this.is.input) return false

            // multis
            if ((widget.is.multi || this.is.multi ) && !this.hasMultiOverlap(widget)) return false
        }
        else if (widget.is.pad) {

            // should not happen
            if (widget.proxy.is.input != this.is.input) return false

            // multis
            if (widget.proxy.is.multi && !this.hasMultiOverlap(widget.proxy)) return false
        }
        return true
    },  

    toJSON() {

        const kind = this.is.input ? (this.is.channel ? 'reply' : 'input') : (this.is.channel ? 'request' : 'output')

        // seperate data into editor and 
        const json = {
            name: this.name,
            kind: this.is.input ? (this.is.channel ? 'reply' : 'input') : (this.is.channel ? 'request' : 'output'),
            editor: {
                id: this.wid,
                align: (this.is.left ? 'left' : 'right')
            }
        }

        // if the pin is a proxy, we add the pad-related stuff
        if (this.is.proxy) {

            json.editor.pad = {
                rect: convert.rectToString(this.pad.rect),
                align: this.pad.is.leftText ? 'left' : 'right'
            }
        }

        return json
    },   

    // remove a route from the routes array
    removeRoute(route) {

        eject(this.routes, route)
    },


    adjustRoutes() {
        for(const route of this.routes) route.adjust()
    },

    // changes the position from left to right
    leftRightSwap() {

        // notation
        const rc = this.node.look.rect

        // change the x coordinate
        this.rect.x = this.is.left  ? rc.x + rc.w - this.rect.w + style.pin.wOutside 
                                    : rc.x - style.pin.wOutside
        // change
        this.is.left = !this.is.left

        // reconnect the routes
        this.adjustRoutes()
    },

    drag(pos) {

        // notation
        const rc = this.node.look.rect

        // notation
        const center = rc.x + rc.w/2

        // switch left right ?
        if ((this.is.left && (pos.x > center)) || ( !this.is.left && (pos.x < center))) this.leftRightSwap()

        // find pin or ifName to swap with
        const next = this.node.look.findNextWidget(this, pos, next => next.is.pin || next.is.ifName)

        // if no next - done
        if (!next) return;

        // swap the y-positions
        [this.rect.y, next.rect.y] = [next.rect.y, this.rect.y]

        // if we move in or out a prefix, check if we can reset the pxlen
        if (next.is.ifName) this.ifNamePrefixCheck()

        // reconnect the routes to the widgets that changed place
        this.adjustRoutes()
        if (next.is.pin) next.adjustRoutes()
    },

    moveTo(left, y) {

        // check if the pin needs to swap from left to right
        if (left != this.is.left) this.leftRightSwap()

        // notation
        const prc = this.rect

        // a widget between the new and the old place has to be moved up or down
        for (const widget of this.node.look.widgets) {

            // notation
            const wrc = widget.rect

            // up or down
            if ((prc.y > y) && (wrc.y >= y) && (wrc.y < prc.y)) {
                wrc.y += prc.h
                if (widget.is.pin) widget.adjustRoutes()
            }
            if ((prc.y < y) && (wrc.y <= y) && (wrc.y > prc.y)) {
                wrc.y -= prc.h
                if (widget.is.pin) widget.adjustRoutes()
            }
        }
        // place the pin at y
        prc.y = y

        // and adjust the route endpoints
        this.adjustRoutes()
    },

    disconnect() {

        // make a copy of the routes - the pin.routes array will be modified during this proc
        const routes = this.routes.slice()
    
        // for all widgets that have routes..
        for (const route of routes) {
    
            // get the other widget
            const other = route.from == this ? route.to : route.from
    
            // disconnect
              other.is.pin ? route.rxtxPinPinDisconnect()
            : other.is.pad ? route.rxtxPinPadDisconnect()
            : other.is.tack ? route.rxtxPinBusDisconnect()
            : null
    
            // remove the route at both ends
            route.remove()
        }
    },
    
    // this function is used in the undo action (see redox)
    reconnect(routes) {
    
        // just restore the routes of the pin
        this.routes = routes
    
        // and also put the routes back in all destinations
        for (const route of routes) {
    
            // get the other widget
            const other = route.from == this ? route.to : route.from
    
            if (other.is.pin) {
                other.routes.push(route)
                route.rxtxPinPin()
            }
            else if (other.is.pad) {
                other.routes.push(route)
                route.rxtxPinPad()
            }
            else if (other.is.tack) {
                other.bus.tacks.push(other)
                route.rxtxPinBus()
            }
        }
    },

    // checks if there is already a route
    haveRoute(other) {

        for(const route of this.routes)  if (route.from == other || route.to == other) return true
        return false
    },

    ioSwap() {

        // check
        if (this.routes.length > 0) return false
        if (this.is.proxy && (this.pad.routes.length > 0)) return false
        
        // change the type of pin
        this.is.input = !this.is.input

        // succesful
        return true
    },

    channelOnOff() {

        // toggle the channel bit
        this.is.channel = !this.is.channel

        // If  the pin is connected to a bus, the bus tack has to be updated
        for(const route of this.routes) {
            const other = route.from == this ? route.to : route.from
            if (other.is.tack) other.is.channel = this.is.channel
        }
        return true
    },

    doSelect() {
        this.is.selected = true
    },

    unSelect() {
        this.is.selected = false
    },

    highLight() {
        this.is.highLighted = true
    },

    unHighLight() {
        this.is.highLighted = false
    },

    /** TO CHANGE : 
        A proxy works as a filter:
        [a,b,c,d] -> pad - proxy [a,b,c] -> pin [b,c,d]  only messages b,c get through.
    */
    highLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from

            // check
            if (!other) continue

            // pin
            if (other.is.pin) {
                if (!this.areConnected(other)) continue
                route.highLight()
                continue
            }

            // pad
            if (other.is.pad) {
                if (!this.areConnected(other)) continue
                route.highLight()
                continue
            }

            // bus
            if (other.is.tack) {
                route.highLight()
                other.bus.highLightRoutes(this)
            }
        }
    },

    unHighLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            // unhighlight
            route.unHighLight()

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from

            // check
            if (!other) continue

            // pin
            if (other.is.pin) {
                if (!this.areConnected(other)) continue
                if (other.is.proxy) other.pad.unHighLightRoutes()
                continue
            }

            // pad
            if (other.is.pad) {
                if (!this.areConnected(other)) continue
                other.proxy.unHighLightRoutes()
                continue
            }

            // bus
            if (other.is.tack) {
                other.bus.unHighLightRoutes(this)
            }
        }
    },

    makePadRect(pos) {

        // The width of the pad
        const width = style.pad.wExtra + this.node.look.getTextWidth(this.name, this.is.multi)

        // determine the rectangle for the pad widget
        return this.is.left ? {x: pos.x, y: pos.y-style.pad.hPad/2, w: width, h:style.pad.hPad} 
                            : {x: pos.x, y: pos.y-style.pad.hPad/2, w: width, h:style.pad.hPad}
    },


}
Object.assign(Pin.prototype, pinNameHandling)

