import {shape, style, inside} from '../util/index.js'
import {zap} from '../view/index.js'
import {padRouteFunctions} from './pad-routes.js'

export function Pad(rect, proxy, uid=null) {

    // unique id
    this.uid = uid

    // constructor chaining
    this.rect = {...rect} 

    // set h if necessary - we will set w when the pad is rendered
    // this.rect.h = rect.h > 0 ? rect.h : style.pad.hPad

    this.is = {
        pad: true,
        selected: false,
        highLighted: false,
        leftText: proxy.is.left,
        hoverOk: false,
        hoverNok: false,
        beingEdited: false,
        placed: false
    }

    // set the text
    this.text = proxy.name

    // the widget on the look
    this.proxy = proxy

    // the routes to the pad (inside the group!)
    this.routes = []
}
Pad.prototype = {

    copy() {
        return new Pad(this.rect, this.proxy, this.uid)
    },

    render(ctx, look) {
        
        // notation
        let st = style.pad
        const rc = this.rect
        const proxy = this.proxy

        // use a different color for selected pads
        const cPad =  this.is.hoverNok ? st.cBad : st.cBackground

        // the text and arrow color change when connected
        let cText =     this.is.highLighted ? st.cHighLighted
                        : this.is.selected || this.is.hoverOk ? st.cSelected
                        : this.routes?.length > 0 ? st.cConnected 
                        : st.cText

        // color of the arrow
        const cArrow = cText
        
        // the y position of the arrow
        let yArrow = rc.y+(st.hPad - st.wArrow)/2

        // when being edited we recalculate the width of the rectangle
        if (this.is.beingEdited) {
            rc.w = style.pad.wExtra + ctx.measureText(this.text).width
            this.place()
        }

        // render the pin  - note that x and y give the center of the triangle
        if (this.is.leftText) {

            // the x-position of the arrow
            const xArrow =  rc.x + rc.w - st.rBullet/2 - st.hArrow 

            // draw a rectangle and a circle
            shape.rectBullet(ctx,rc.x, rc.y, rc.w, rc.h, cPad, st.rBullet)

            if (proxy.is.channel) {
                // draw a triangle
                proxy.is.input  ? shape.ballTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
                                : shape.triangleBall( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
            }
            else {
                // draw a triangle
                proxy.is.input  ? shape.rightTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
                                : shape.leftTriangle(  ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
            }

            // write the text in the rectangle
            shape.leftText(ctx,this.text,cText,rc.x + style.pad.wMargin,rc.y, rc.w,rc.h)
        }
        else {
            // The x-position of the arrow
            const xArrow = rc.x + st.rBullet/2

            // draw the rectangle and the bullet
            shape.bulletRect(ctx,rc.x, rc.y, rc.w, rc.h, cPad, st.rBullet)

            if (proxy.is.channel) {
                // draw a triangle
                proxy.is.input  ? shape.triangleBall( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
                                : shape.ballTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
            }
            else {
                // draw a triangle
                proxy.is.input  ? shape.leftTriangle(  ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow) 
                                : shape.rightTriangle( ctx, xArrow, yArrow, st.hArrow, st.wArrow,cArrow)
            }

            // write the text in the rectangle
            shape.rightText(ctx,this.text,cText,rc.x,rc.y,rc.w,rc.h)
        }
    },

    cursorPos(ctx, i) {
        const rc = this.rect
        const xText = this.is.leftText
            ? rc.x + style.pad.wMargin
            : rc.x + rc.w - ctx.measureText(this.text).width
        return { x: xText + ctx.measureText(this.text.slice(0, i)).width, y: rc.y }
    },

    // returns the center of the pad bullet
    center() {
        const rc = this.rect
        return this.is.leftText     ? {x: rc.x + rc.w ,  y: rc.y + rc.h/2} 
                                    : {x: rc.x ,         y: rc.y + rc.h/2}
    },

    // place the widget so that the center is on pos
    place() {
        // take the first route
        const route = this.routes[0]

        // check
        if ( ! route?.wire.length ) return

        // get the first or last point of the route
        const [pa, pb] = route.from == this ?  [route.wire[0], route.wire[1]] : [route.wire.at(-1), route.wire.at(-2)]

        // check
        this.is.leftText = (pa.x < pb.x)

        // notation
        const rc = this.rect

        // y position is independent of left/right
        rc.y = pa.y - rc.h/2

        //x depends on left right
        rc.x = this.is.leftText ? pa.x - rc.w : pa.x 
    },

    // the edit functions
    startEdit(ctx, click = null) {

        this.is.beingEdited = true

        const xText = this.is.leftText
            ? this.rect.x + style.pad.wMargin
            : this.rect.x + this.rect.w - ctx.measureText(this.text).width
        const index = click ? shape.cursorIndex(ctx, this.text, xText, click.x) : this.text.length
        return { prop: 'text', index }
    },

    getWidth() {
        const proxy = this.proxy
        return style.pad.wExtra + proxy.node.look.getTextWidth(this.text)
    },

    endEdit(saved) {

        // notation
        const proxy = this.proxy

        // no more editing
        this.is.beingEdited = false

        // if the name has not zero length...
        if (this.text.length > 0) {

            // set the name of the proxy
            proxy.name = this.text

            // check the name and reset if not ok
            if ( ! proxy.checkNewName()) {
                proxy.name = this.text = saved
                return
            }

            // the name might have been normalized
            this.text = proxy.name

            // check for route usage
            this.checkRouteUsage()

            // recalculate the width of the pad
            this.rect.w = this.getWidth()
            //this.place()

            // done
            return
        }

        // zero length : The pin can only be removed if there are no routes
        if (proxy.routes.length == 0) {

            // remove the proxy
            proxy.node.look.removePin(proxy)

            // and remove the pad
            proxy.node.removePad(this)

            // done
            return
        }

        // restore the old name
        this.text = saved
    },

    // the name of the proxy has changed - length of the pad must also change
    nameChange( newName ) {
        // change
        this.text = newName

        // force a recalculation of the rectangle
        this.rect.w = this.getWidth()
    },

    overlap(rect) {
        const rc = this.rect

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    makeRaw() {
        const raw = {
            wid: this.proxy.wid,
            text: this.text,
            left: this.is.leftText,
            rect: this.rect
        }

        if (this.is.placed) raw.placed = true

        return raw
    },

    // unzip() {

    //     return {
    //         blu: null,
    //         viz: convert.padToString(this)
    //     }
    // },

    moveTo(x,y) {

        this.rect.x = x
        this.rect.y = y

        this.adjustRoutes()
    },

    move(delta) {

        this.rect.x += delta.x
        this.rect.y += delta.y

        //this.adjustRoutes()
    },

    // checks if the widget and the pad are logically connected
    areConnected(widget) {
        return true
    },

    makeConxList(list) {

        for(const route of this.routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from

            // check if connected
            if ( ! this.areConnected(other)) continue

            // if the actual is also a proxy, take it to the next level, else save in list
            if (other.is.pin) {
                other.is.proxy ?  other.pad?.makeConxList(list) : list.push( other )
            }
            // get all the connections to the bus that can reach the pad
            else if (other.is.tack) {

                // continue to complete the list
                other.makeConxList(list)
            }
        }
    },

    highLight() {
        this.is.highLighted = true
    },

    unHighLight() {
        this.is.highLighted = false
    },

    hitTest(pos) {

        // check if we have hit the rectangle
        if (! inside(pos, this.rect))  return [zap.nothing, null]

        // we have hit the pad - check if we have hit the arrow (left or right)
        if (this.is.leftText) {
            return (pos.x > this.rect.x + this.rect.w - 2*style.pad.rBullet) ? [zap.padArrow, this] : [zap.pad, this]
        }
        else {
            return (pos.x < this.rect.x + 2*style.pad.rBullet) ? [zap.padArrow, this] : [zap.pad, this]
        }
    },

    hitRoute(pos) {

        let segment = 0

        // go through all the routes..
        for (const route of this.routes) {

            // only routes from this pad
            if ((route.from == this)&&(segment = route.hitSegment(pos))) return [zap.route, route, segment]
        }
        // nothing
        return [zap.nothing, null, 0]
    }

}
Object.assign(  Pad.prototype, padRouteFunctions)
