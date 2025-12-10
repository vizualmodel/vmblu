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

        if (!widgets?.length) return

        // reset (not necessary ?)
        this.widgets.length = 0

        // set each widget as selected
        for (const widget of widgets) {
            if (widget.is.pin || widget.is.ifName) {
                this.widgets.push(widget)
                widget.doSelect()
            }
        }

        // set a rectangle around the widgets
        this.pinAreaRectangle()

        // this is a widget selection
        this.what = selex.pinArea
    },

    // the pins have been sorted in the y position
    // note that the first 'pin' is actually a ifName !
    pinAreaRectangle() {

        // check
        if (!this.widgets.length) return;

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
    },

    widgetsDrag(delta) {

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

    interfaceSelect(node, ifName) {

        // reset the selection
        this.reset()

        // find the widgets that belong to the interface
        const ifPins = node.look.getInterface(ifName)

        // select the pins
        this.pinAreaSelect(ifPins)

        // set the selection type
        this.what = selex.ifArea;
    },

    extend(widget) {

        if (this.what != selex.ifArea || widget.node != this.widgets[0].node) return
        
        this.widgets.push(widget)

        this.pinAreaRectangle()
    },

    // adjust the selction when a widget is added
    adjustForNewWidget(widget) {

        switch(this.what) {

            case selex.singleNode:

                // just switch to the new widget
                this.switchToWidget(widget)
                break;

            case selex.ifArea:

                if (widget.node != this.widgets[0].node) return

                if (widget.is.pin) {
                    widget.doSelect()
                    this.widgets.push(widget)
                    this.pinAreaRectangle()
                }
                else if (widget.is.ifName) {

                    // unddo the previous selection
                    this.reset()

                    // select the new interface
                    widget.doSelect()
                    this.widgets = [widget]
                    this.pinAreaRectangle()                    
                }
                break
        }
    },

    // adjust the selction when a widget is removed
    adjustForRemovedWidget(widget) {

        switch(this.what) {

            case selex.singleNode:

                // try above ...
                const above = this.widgetAbove(widget);
                if (above) return this.switchToWidget(above);

                // if no pin is given try below
                const below = this.widgetBelow(widget);
                if (below) return this.switchToWidget(below);
                break;

            case selex.ifArea:

                if (widget.node != this.widgets[0].node) return

                if (widget.is.pin) {

                    // kick the widget out
                    const index = this.widgets.findIndex( w => w === widget)
                    if (index != -1) this.widgets.splice(index, 1)

                    // make a new selection
                    this.pinAreaRectangle()
                }
                break
        }
    },

    behind() {

        // check
        if (this.what !== selex.singleNode && this.what !== selex.ifArea) return null;

        // we add new pins at the end
        const last = this.widgets.at(-1)

        // check 
        if (last) return  {x: last.rect.x, y: last.rect.y + last.rect.h};

        // it could be that the node has no pins yet !
        return this.nodes[0] ? {x: 0, y: this.nodes[0].look.makePlace(null, 0)} : null;
    },

    whereToAdd() {

        switch(this.what) {

            case selex.singleNode: {

                // get the selected node (only one !)
                const node = this.getSingleNode()

                // get the selected widget
                const widget = this.getSelectedWidget()

                // determine the position for the widget
                const pos = widget  ?   {x: widget.is.left ? widget.rect.x : widget.rect.x + widget.rect.w, y: widget.rect.y + widget.rect.h} :
                                        {x: 0, y: node.look.makePlace(null, 0)}

                // done
                return [node, pos]
            }

            case selex.ifArea: {

                const node = this.getSelectedWidget()?.node
                const pos = this.behind()
                return [node, pos]
            }
        }
    },

}