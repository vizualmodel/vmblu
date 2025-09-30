import {Widget} from '../widget/index.js'
import {style, eject} from '../util/index.js'
import {Pad} from './pad.js'

export const widgetLifecycle = {

addHeader() {

    // the space taken by the icons
    const iconSpace = 2*(style.icon.xPadding + 2*style.icon.wIcon + style.icon.xSpacing)

    // the required width for the look..
    const W = this.getTextWidth(this.node.name) + iconSpace;

    // notation
    const rc = this.rect 

    // check the width of the look (can change this.rect)
    if (W > rc.w) this.wider(W - rc.w)

    // the width of the title widget is the same as the width of the look
    const wRect = { x: rc.x , y: rc.y, w: rc.w, h: style.header.hTitle}

    // create the title
    const widget = new Widget.Header(wRect, this.node) 

    // add the widget - the space for the title has alraedy been reserved in hTop (see above)
    this.widgets.push(widget)

    // done
    return widget
},

// adaptposition is set to false whe reading from json file
addLabel(text) {

    // notation
    const rc = this.rect

    // check the size of the label
    const W = this.getTextWidth(text)

    // the width of the label widget is the same as the width of the look
    const wRect = { x: rc.x , 
                    y: rc.y - style.label.hLabel, 
                    w: rc.w, 
                    h: style.label.hLabel}

    // create the label
    const widget = new Widget.Label(wRect, text, this.node)

    // add the widget - the label comes just above the box - 
    this.widgets.push(widget)

    // increase the size and position of the look
    rc.y -= style.label.hLabel
    rc.h += style.label.hLabel

    // done
    return widget
},

removeLabel() {

    const label = this.findLabel()

    if (!label) return

    // remove the label from the array (changes the array !)
    eject(this.widgets, label)
    
    // decrease the size and position of the look
    this.rect.y += style.label.hLabel
    this.rect.h -= style.label.hLabel
},

restoreLabel(label) {
    // add the label to the list
    this.widgets.push(label)

    // increase the size and position of the look
    this.rect.y -= style.label.hLabel
    this.rect.h += style.label.hLabel
},

// is = {channel, input, request, proxy, left } - left can be absent 
addPin(name, pos, is) {

    // left or right
    const left = is.left ?? pos.x < this.rect.x + this.rect.w/2;

    //check if the name has a prefix or postfix
    const displayName = this.displayName(name,pos.y)

    // the rectangle for the pin
    const rect = this.pinRectangle(displayName, pos.y, left, is.multi)

    // create the pin
    const pin = is.proxy ? new Widget.Proxy(rect, this.node, name, is)  : new Widget.Pin(rect, this.node, name, is) 

    // save left
    pin.is.left = left

    // add the widget
    this.addWidget( pin )

    // done
    return pin
},

// removes a pin - disconnect first 
removePin( pin ) {

    // remove the widget from the array + shift the other widgets up 
    if (pin.is.pin && eject(this.widgets,pin)) this.shiftUp(pin.rect.y, pin.rect.h)
},

// restores a pin that has been deleted - only used in an undo !
restorePin(pin) {

    const rc = pin.rect

    this.makePlace({x:rc.x, y:rc.y}, rc.h)
    this.addWidget(pin)
},

// pos can be null !
addIfName(text, pos) {

    // shift the widgets that are below pos.y to make place for the new ifName
    const yFree = this.makePlace(pos, style.ifName.hSep)

    // the rectangle for the widget
    const rect = {x: this.rect.x, y: yFree, w:this.rect.w, h:style.ifName.hSep}

    // create a new ifName
    const ifName = new Widget.InterfaceName(rect, text, this.node)

    // add the widget to the look
    this.addWidget(ifName)
    
    // done
    return ifName
},

removeInterfaceName( ifName ) {

    // remove the ifName from the array
    if (ifName.is.ifName && eject(this.widgets,ifName)) this.shiftUp(ifName.rect.y, ifName.rect.h)
},

restoreInterfaceName( ifName) {

    const rc = ifName.rect

    this.makePlace({x:rc.x, y:rc.y}, rc.h)
    this.addWidget(ifName)
},

copyPinArea(widgets, pos) {

    // check
    if (!widgets || widgets.length == 0) return null

    // sort the array according to y-value
    widgets.sort( (a,b) => a.rect.y - b.rect.y)

    // copy the intial y-position
    const where = {...pos}

    // the array of the copies
    const copies = []

    // go through all the widgets
    for(const widget of widgets) {

        if (widget.is.pin) {

            // if the pin exists already, we do not copy
            if (this.findPin(widget.name, widget.is.input)) continue;

            // add the pin at the requested position
            const pin = this.addPin(widget.name,where, widget.is)

            // add a pad or add to the rxtx tables
            // if (pin.is.proxy) this.addPad(pin) //: this.node.rxtxAddPin(pin)

            // copy and check the prefix length
            if (widget.pxlen) {
                pin.pxlen = widget.pxlen
                pin.checkPrefix()
            }

            // the next position
            where.y = pin.rect.y + pin.rect.h

            // save
            copies.push(pin)
        }
        else if (widget.is.ifName) {

            // check if it exists
            if (this.findInterfaceName(widget.text)) continue

            // add the ifName
            const ifName = this.addIfName(widget.text, where)

            // the next position
            where.y = ifName.rect.y + ifName.rect.h

            // save
            copies.push(ifName)
        }
    }
    return copies
},

deletePinArea(widgets) {

    // check
    if (!widgets || widgets.length == 0) return

    // go through all the widgets
    for(const widget of widgets) {

        if (widget.is.pin) {

            // disconnect
            widget.disconnect()

            // delete the pin in the node
            this.removePin(widget)

            // remove from the rxtx table
            if (widget.is.proxy) {

                widget.pad.disconnect()

                widget.node.removePad(widget.pad) 
            }
            else widget.node.rxtxRemovePin(widget)
        }
        else if (widget.is.ifName) {

            this.removeInterfaceName(widget)
        }
    }
},



}