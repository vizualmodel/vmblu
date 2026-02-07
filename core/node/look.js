import {style, convert} from '../util/index.js'
import {editor} from '../editor/index.js'

import {widgetHandling} from './look-widget.js'
import {widgetLifecycle} from './look-widget-lifecycle.js'
import {interfaceHandling} from './look-interface.js'
import {iconHandling} from './look-icon.js'
import {moveHandling} from './look-move.js'
import {copyHandling} from './look-copy.js'
import {jsonHandling} from './look-json.js'
//import {Route} from './index.js'

// the look node determines how a node looks... 
export function Look (rect) {

    this.rect = {...rect}
    this.rect.w = rect.w > 0 ? rect.w : style.look.wBox
    this.rect.h = rect.h > 0 ? rect.h : style.look.hTop + style.look.hBottom

    // the node for which this look is created
    this.node = null

    // note that a widget id is never 0 !
    this.widGenerator = 0

    // the list of node widgets
    this.widgets = []
}

// the functions for the action node prototype
Look.prototype = {

    render(ctx) {

        // draw the widgets
        this.widgets?.forEach( widget => widget.render(ctx, this) )
    },

    remove(){},

    // get the min width required for the widgets (= max width widgets !)
    getMinWidth() {

        let minWidth = style.look.wBox
        for(const widget of this.widgets) {
            if ( widget.is.pin  && (widget.rect.w > minWidth)) minWidth = widget.rect.w
        }
        return minWidth
    },

    // change the width of the look and reposition the widgets as required - delta can be pos or neg
    changeWidth(delta) {

        // set the new rect width
        this.rect.w += delta

        // now we have to adjust the position of the widgets
        this.widgets.forEach( widget => {
            // only the pins at the right move
            if ((widget.is.pin)&&(!widget.is.left)) {

                // move the x position
                widget.rect.x += delta

                // also adjust the routes
                widget.adjustRoutes()
            }
            else if (widget.is.header || widget.is.ifName || widget.is.box) 
                widget.rect.w += delta
            else if (widget.is.icon) 
                // shift the icons that are on the right
                if (widget.rect.x > this.rect.x + (this.rect.w - delta)/2) widget.rect.x += delta
        })
    },

    // if the name of the widget has changed see if it fits and adjust widget and look if necessary
    adjustPinWidth(widget) {

        // Get the new width
        const newWidth = style.pin.wMargin + this.getTextWidth(widget.withoutPrefix(), widget.is.multi)

        // move the x of the widgets if at the right
        if ( ! widget.is.left) widget.rect.x += (widget.rect.w - newWidth)

        // adjust the with
        widget.rect.w = newWidth

        // check width of the look
        if (widget.rect.w > this.rect.w) this.wider(widget.rect.w - this.rect.w)
    },

    getTextWidth(str, multi=false) {

        // get the canvas context
        const ctx = editor?.getCanvasContext?.()
        if (!ctx) {
            const text = str ?? ''
            const baseWidth = style.pin.wChar
            
            if (!multi) return text.length * baseWidth

            const [pre, middle, post] = convert.getPreMiddlePost(text)
            const normalWidth = (pre.length + post.length + 2) * baseWidth
            const multiWidth = middle.length * baseWidth
            return normalWidth + multiWidth
        }

        if (!multi) return ctx.measureText(str).width
        
        // cut the text in three parts 
        const [pre, middle, post] = convert.getPreMiddlePost(str)

        // measure pre and post
        let width = ctx.measureText(pre + '[').width + ctx.measureText(']'+ post).width

        // change font
        const savedFont = ctx.font
        ctx.font = style.pin.fMulti

        // measure the multi text
        width += ctx.measureText(middle).width

        // restore the font
        ctx.font = savedFont

        // done
        return width
    },

    wider(delta=0) {

        // not wider than the max value
        if (this.rect.w >= style.look.wMax) return

        // multiples of style.look.wExtra
        delta = delta > 0 ? Math.ceil( delta / style.look.wExtra)*style.look.wExtra : style.look.wExtra

        // not wider then max width
        if (this.rect.w + delta > style.look.wMax) delta = style.look.wMax - this.rect.w

        // adjust
        this.changeWidth( delta )   
    },

    smaller(delta=0) {

        const minWidth = this.getMinWidth()

        // not smaller then the min width
        if (this.rect.w <= minWidth) return

        // multiples of style.look.wExtra
        delta = delta > 0 ? (1 + Math.floor( delta / style.look.wExtra))*style.look.wExtra : style.look.wExtra

        // not smaller then the min width
        if (this.rect.w - delta < minWidth) delta = this.rect.w - minWidth
        
        // adjust
        this.changeWidth( -delta )
    },

    // add the basic widgets to a look
    decorate(node) {

        // the node for which this look is created (do this first)
        this.node = node

        // add a box
        this.addBox()

        // and a title
        this.addHeader()

        // add icons
        this.addIcon('cog')
        node.is.source ? this.addIcon('factory') : this.addIcon('group')
        this.addIcon('pulse')
        this.addIcon('comment')        
    }
}
Object.assign(  Look.prototype, 
                widgetHandling, 
                widgetLifecycle,
                interfaceHandling, 
                iconHandling, 
                moveHandling, 
                copyHandling,
                jsonHandling)
