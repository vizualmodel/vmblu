export const interfaceHandling = {

    // find the array of pins that are part of the ifName 
    // The first element of the array is the ifName itself
    getInterface(ifName) {

        // collect the pins in an array
        const pinArray = []

        // push the ifName on the array
        pinArray.push(ifName)

        // find the max y, i.e. the ifName below or the end of the node
        let yMax = this.rect.y + this.rect.h
        for (const sep of this.widgets) {
            if (!sep.is.ifName) continue
            if ((sep.rect.y > ifName.rect.y) && (sep.rect.y < yMax)) yMax = sep.rect.y
        }

        // find all the pins between the two y values
        for ( const pin of this.widgets ) {
            if (!pin.is.pin) continue
            if ((pin.rect.y >= ifName.rect.y) && (pin.rect.y < yMax)) pinArray.push(pin)
        }

        // sort the array
        pinArray.sort( (a,b) => a.rect.y - b.rect.y)

        // done
        return pinArray
    },

    // shift widgets below a certain y value and adapt the size of the box - reconnect routes also
    shiftWidgetsBelow(yFrom, yDelta) {

        // shift all the pins below the interface down
        for (const widget of this.widgets) {

            // change the size of the box
            if (widget.is.box) {
                widget.rect.h += yDelta
                this.rect.h += yDelta
                continue
            }

            // move the widgets below
            if (widget.rect.y > yFrom) {
                widget.rect.y += yDelta
                if (widget.routes) for (const route of widget.routes) route.clampToWidget(widget);
            }
        }
    },

    // move the widget up and down in the list with the mouse
    // the moving ifName (= first element of the pin array) will change place with the ifName above or below (the swap)
    swapInterface(pos, group) {

        // find the ifName to nextInterface with (moving up or down)
        const nextInterface = this.findNextWidget(group[0],pos, widget => widget.is.ifName)

        // check if we have found the next ifName up or down
        if (!nextInterface) return

        // we only move if we are inside the closest ifName rectangle
        if ((pos.y < nextInterface.rect.y) || (pos.y >  nextInterface.rect.y + nextInterface.rect.h)) return;

        // moving up or down ?
        const down = pos.y > group[0].rect.y

        // find the pins that belong to nextInterface
        const nextGroup = this.getInterface(nextInterface)

        // find the delta that the *other* group has to move
        const gFirst = group[0]
        const gLast = group.at(-1)
        let gDelta = gLast.rect.y  - gFirst.rect.y  + gLast.rect.h 
        if (down) gDelta = -gDelta

        // find the delta that the group has to move
        const nFirst = nextGroup[0]
        const nLast = nextGroup.at(-1)
        let nDelta = nLast.rect.y - nFirst.rect.y  + nLast.rect.h 
        if (!down) nDelta = -nDelta

        // move the other group
        for(const pin of nextGroup) {
            pin.rect.y += gDelta
            if (pin.is.pin) pin.adjustRoutes()
        }

        // move the group
        for (const pin of group) {
            pin.rect.y += nDelta
            if (pin.is.pin) pin.adjustRoutes()
        }
    },

    interfaceChangePrefix(ifName) {

        // get the pins that belong to the ifName
        const ifPins = this.getInterface(ifName)

        // change the names of the pins that have a prefix (the first element is the ifName)
        for (const pin of ifPins) {
                
            // check that the pin has a prefix
            if (pin.is.pin && pin.pxlen != 0) {

                // seve the old name
                const oldName = pin.name

                // change the prefix
                pin.changePrefix(ifName.text)

                // make other necessary changes
                pin.nameChanged(oldName)
            }
        }
    },

    // when we have to undo an operation, we need this
    showPrefixes(ifName) {

        // show the full names of the nodes below
        const group = ifName.node.look.getInterface(ifName)

        // the pins of the group that have a prefix
        const pxlenArray = []

        // check
        for (const pin of group) {
            if (pin.is.pin && pin.pxlen != 0) {
                pxlenArray.push(pin.pxlen)
                pin.pxlen = 0
            }
        }

        // done
        return pxlenArray
    },

    hidePrefixes(ifName, pxlenArray) {
        // show the full names of the nodes below
        const group = ifName.node.look.getInterface(ifName)

        // the pins start at 1
        for (let i=1; i<pxlenArray.length; i++) group[i].pxlen = pxlenArray[i]
    },

    highLightInterface(ifName) {

        // get the pins that are below this ifName
        const ifPins = this.getInterface(ifName)

        // set a selection rectangle around the selected pins
        for(const widget of ifPins) {
            // highlight the pin itself
            widget.highLight()

            // and highlight the routes
            if (widget.is.pin) widget.highLightRoutes()
        }

        // return the group
        return ifPins
    },

    unhighLightInterface(ifPins) {

        if (!ifPins) return 

        for(const widget of ifPins) {
            widget.unHighLight()
            if (widget.is.pin) widget.unHighLightRoutes()
        }
    },

    // finds the ifName just above the widget
    findIfNameAbove(y) {
        let ifName = null
        for (const widget of this.widgets) {

            // find the  interface name that is closest to the widget
            if ((widget.is.ifName) && (widget.rect.y < y) && ( ifName == null || ifName.rect.y < widget.rect.y)) ifName = widget
        }
        // return what has been found
        return ifName
    },

    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    getPrefixLength(fullName, y) {

        // find the relevant ifName
        const ifName = this.findIfNameAbove(y)

        // check
        if (!ifName) return 0

        // check if the name of the ifName is a postfix or prefix to the pin
        const prefix = fullName.indexOf('.')
        if ((prefix > 0) && (fullName.slice(0,prefix) === ifName.text)) return ifName.text.length

        // check if the name of the ifName is a postfix or prefix to the pin
        const postfix = fullName.lastIndexOf('.')
        if ((postfix > 0) && (fullName.slice(postfix+1) === ifName.text)) return  - ifName.text.length

        return 0
    },

    // there is a prefix or a postfix that is not displayed
    displayName(fullName, y) {

        const pxlen = this.getPrefixLength(fullName, y)

        return (pxlen > 0) ? '+ ' + fullName.slice(this.pxlen+1) : fullName.slice(0, this.pxlen-1) + ' +'
    },

    // area is the rectangle of the pin area
    dragPinArea(widgets,area) {

        const first = widgets[0]

        // Moving up
        if (area.y < first.rect.y) {

            // find the pin or interface above
            const above = this.findNextWidget(first,{x:0, y:area.y}, w => (w.is.pin || w.is.ifName))
            if (!above) return;

            // If we are over halfway the next pin..
            if (area.y < above.rect.y + above.rect.h/2) {

                // move
                this.groupMove(widgets, above.rect.y - first.rect.y);

                 // do a interface check
                 this.interfaceCheck()
            }
            return;
        }

        const last = widgets.at(-1)

        // moving down
        if (area.y + area.h > last.rect.y + last.rect.h) {

            // find the pin just below
            const below = this.findNextWidget(last,{x:0, y: area.y + area.h}, w => (w.is.pin || w.is.ifName))
            if (!below) return

            // if we are over halfway the next pin, we move
            if ((area.y + area.h) > (below.rect.y + below.rect.h + below.rect.h/2)) {
                
                // move ...
                this.groupMove(widgets, below.rect.y - last.rect.y);

                // interfaceCheck
                this.interfaceCheck()
            }

            return;
        }

    },

    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    interfaceCheck() {

        // reset the pxlen
        for (const pin of this.widgets) if (pin.is.pin) pin.pxlen = 0;

        for (const ifName of this.widgets) {

            if (!ifName.is.ifName) continue

            const ifPins = this.getInterface(ifName)

            for (const pin of ifPins) {

                // the first one is the interface name
                if (!pin.is.pin) continue

                // find the relevant ifName
                const text = ifName.text.toLowerCase()

                // Get the lowercase name
                const lowerCase = pin.lowerCase()

                // check if the name of the ifName is a prefix to the pin
                if (lowerCase.startsWith(text)) pin.pxlen = text.length
                else if (lowerCase.endsWith(text)) pin.pxlen = -text.length
            }
        }
    },

}