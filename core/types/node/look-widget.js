import {style,convert} from '../util/index.js'
import {Widget} from '../widget/index.js'

export const widgetHandling = {

    addWidget( widget ) {

        // push the widget on the list
        this.widgets.push(widget)

        // set the new height for the look
        this.rect.h += widget.rect.h

        // if there is a box widget
        const box = this.widgets.find( w => w.is.box)

        // .. also adjust the height of the box
        if (box) box.increaseHeight(widget.rect.h)

        // if the widget has a wid, add the wid
        if (widget.wid != undefined) widget.wid = this.generateWid()
    },

    generateWid() {
        return ++this.widGenerator
    },

    addBox() {
        const box = new Widget.Box(this.rect, this.node)
        this.widgets.push(box)
    },

    findLabel() {
        for(const widget of this.widgets) {
            if (widget.is.label) return widget
        }
        return null
    },

    // names for input output pins/proxies cannot be duplicates
    setDuplicatePin(pin) {

        // reset
        pin.is.duplicate = false

        const wasDuplicate = []

        // check all widgets
        for(const widget of this.widgets) {

            // only pins and exclude the one we are testing
            if (!widget.is.pin || widget == pin) continue

            // save the widget if it was a duplicate before
            if (widget.is.duplicate) wasDuplicate.push(widget)
                
            // check for a nameclash...
            if (pin.nameClash(widget) || pin.hasFullNameMatch(widget)) pin.is.duplicate = widget.is.duplicate = true;
        }

        // check
        if (wasDuplicate.length == 0) return

        // check if the widgets that were duplicates are still duplicates
        for (const widget of wasDuplicate) widget.is.duplicate = false

        // check again
        for (let i=0; i<wasDuplicate.length; i++) {

            // if already set continue
            if (wasDuplicate[i].is.duplicate) continue

            // check with the rest of the widgets
            for (let j=i+1; j<wasDuplicate.length; j++) {

                // if the widgets are not duplicates anymore, change
                if (wasDuplicate[i].nameClash(wasDuplicate[j]) || wasDuplicate[i].hasFullNameMatch(wasDuplicate[j])) 
                    wasDuplicate[i].is.duplicate = wasDuplicate[j].is.duplicate = true
            }
        }
    },

    // used for pins and interfaceNames
    // move the widgets down that are below pos.y - used to insert a new widget
    // ** does not change the size of the rectangle or the box ! **
    // note that pos.y can be negative !
    makePlace(pos, height) {

        // yFree starts at the bottom
        let yFree = this.rect.y + this.rect.h - style.look.hBottom //- height

        // if there is no position given then yFree is ok
        if (!pos) return yFree

        // for each pin and ifName
        for (const widget of this.widgets) {

            // if the pin is below pos.y (i.e. y + h/2 value is bigger), shift the pin down
            if ((widget.is.pin || widget.is.ifName)&&(widget.rect.y + widget.rect.h/2 > pos.y)) {
                
                // get the y-coordinate of the new free space
                if (widget.rect.y < yFree) yFree = widget.rect.y

                // shift the widget and adjust the connections
                widget.rect.y += height

                // if there are routes - reconnect
                if (widget.routes) widget.adjustRoutes()
            }
        }

        // if there are no widgets, the ifName is the first one 
        return yFree
    },

    // calculate the rectangle for a pin
    pinRectangle(displayName, y, left, multi=false) {

        // notation
        const st = style.pin
        let rc = this.rect

        // total width of the widget
        const width = st.wMargin + this.getTextWidth(displayName, multi)

        // check the width of the look (can change the ractangle of the look !)
        if (width > rc.w) this.wider(width - rc.w)

        // get the y position of the rectangle
        const yNew = this.makePlace({x:0, y}, style.pin.hPin)

        // the rectangle for the pin 
        const rect = left   ? {x: rc.x - st.wOutside,                   y: yNew, w: width, h: st.hPin}
                            : {x: rc.x + rc.w - width + st.wOutside,    y: yNew, w: width, h: st.hPin}

        // done
        return rect
    },    

    // when adding pins or proxies sequentially, this calculates the next position in the rectangle
    nextPinPosition(left) {

        // notation
        const rc = this.rect

        // adjust x for left or right - add y at the end
        return {x: left ? rc.x : rc.x + rc.w, 
                y: rc.y + rc.h - style.look.hBottom}
    },

    // every widget below y is moved up by dy
    shiftUp(y, dy) {

        // check all other widgets
        for (const widget of this.widgets) {

            // if its a box, make it shorter
            if (widget.is.box) widget.rect.h -= dy

            // if below the widget that was removed..
            else if (widget.rect.y > y) {

                // shift upwards
                widget.rect.y -= dy

                // now do the routes...
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget)
                // widget.routes?.forEach( route => route.clampToWidget(widget))
            }
        }
        // the look rectangle is shorter now
        this.rect.h -= dy
    },

    movePin(pin, pos) {

        const yGap = pin.rect.y
        const gap = pin.rect.h

        pin.rect.y = this.makePlace(pos, pin.rect.h)
        for(const route of pin.routes) route.clampToWidget(pin)

        // shift the widgets up
        for (const widget of this.widgets) {

            // if below the widget that was removed..
            if (widget.rect.y > yGap) {

                // shift upwards
                widget.rect.y -= gap

                // now do the routes...
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget)
            }
        }
    },

    // when after editing the ifName text has changed, we might have to change the look 
    ifNameChanged(ifName, savedName) {

        // change the pin names that belong to this ifName
        this.interfaceChangePrefix(ifName)

        // a new name was entered
        if (ifName.text.length > 0) {

            // calculate the new width
            let newWidth = this.getTextWidth(ifName.text)

            // check width of the look and adapt the width of the look if neecssary
            if (newWidth > this.rect.w) this.wider(newWidth - this.rect.w)

        }
        // the new name is empty: remove the ifName
	    else {
            ifName.node.look.removeInterfaceName(ifName)
        }

    },

    // names for pins need to be unique !
    NEW_findPin( name, input=true ) {

        for(const widget of this.widgets) {
            if (widget.is.pin && (widget.name == name)) return widget
        }
        return null
    },

    findPin( name, input=true ) {

        for(const widget of this.widgets) {
            if (widget.is.pin && (widget.name == name) && (widget.is.input == input)) return widget
        }
        return null
    },

    findInterfaceName(text) {
        for(const widget of this.widgets) {
            if (widget.is.ifName && widget.text == text) return widget
        }
        return null
    },
}