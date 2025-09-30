import {style} from '../util/index.js'
import {selex} from './selection.js'

export const pinAreaHandling = {

    // pins and interfaceNames can be selected !
    pinAreaStart(node, pos) {

        // reset
        this.reset()

        // notation
        const rect = node.look.rect

        // save the y position
        this.yWidget = pos.y

        // type of selection
        this.what = selex.pinArea

        // start a pin selection - make the rectangle as wide as the look
        this.activate(rect.x - style.pin.wOutside, pos.y, rect.w + 2*style.pin.wOutside, 0, style.selection.cRect)
    },

    pinAreaResize(node, pos) {

        const lRect = node.look.rect

        if (pos.y > lRect.y && pos.y < lRect.y + lRect.h) {

            // notation
            const y = this.yWidget

            // define the selection rectangle (x and w do not change)
            if (pos.y > y) {
                this.rect.y = y
                this.rect.h = pos.y - y
            }
            else {
                this.rect.y = pos.y
                this.rect.h = y - pos.y
            }

            // highlight the pins that are selected
            this.widgets = []
            const dy = style.pin.hPin/2
            for(const widget of node.look.widgets) {

                if (widget.is.pin || widget.is.ifName) {

                    if (widget.rect.y + dy > this.rect.y && widget.rect.y + dy < this.rect.y + this.rect.h) {
                        this.widgets.push(widget)
                        widget.is.selected = true
                    }
                    else {
                        widget.is.selected = false
                    }
                }
            }
        }
    },

    // select the pins that are in the widgets array
    pinAreaSelect(widgets) {

        if (widgets.length == 0) return

        // reset (not necessary ?)
        this.widgets.length = 0

        // set each widget as selected
        for (const widget of widgets) {
            if (widget.is.pin || widget.is.ifName) {
                this.widgets.push(widget)
                widget.is.selected = true
            }
        }

        // set a rectangle around the widgets
        this.pinAreaRectangle()
    },

    // the pins have been sorted in the y position
    // note that the first 'pin' is actually a ifName !
    pinAreaRectangle() {

        // check
        if (this.widgets.length == 0) return;

        // sort the array
        this.widgets.sort( (a,b) => a.rect.y - b.rect.y)

        // get the first and last element from the array
        const look = this.widgets[0].node.look
        const first = this.widgets[0].rect
        const last = this.widgets.at(-1).rect

        // draw a rectangle - make the rectangle as wide as the look
        this.activate(  look.rect.x - style.pin.wOutside, first.y, 
                        look.rect.w + 2*style.pin.wOutside, last.y + last.h - first.y, 
                        style.selection.cRect)
        
        // this is a widget selection
        this.what = selex.pinArea
    },

    pinAreaDrag(delta) {

        // check
        if (this.widgets.length == 0) return

        // the node
        const node = this.widgets[0].node

        // move the selection rectangle only in the y-direction, but stay in the node !
        if (this.rect.y + delta.y < node.look.rect.y + style.header.hHeader ) return
        if (this.rect.y + delta.y > node.look.rect.y + node.look.rect.h) return

        // move as required
        this.rect.y += delta.y
    },
}