import {updateDerivedSettings} from '../util/index.js'

export const compareHandling = {

    // remove zombie pins and accept new or added pins
    acceptChanges() {

        // accept all the changes for this look
        if (this.look) this.look.acceptChanges()

        // .. and for all the subnodes 
        this.nodes?.forEach( node => node.acceptChanges())
    },

    // compares the settings of the nodes
    // new values are added, removed values are removed
    // for existing entries the value is copied
    sxUpdate(linkNode) {

        // If there are no settings, just return
        if (!linkNode.sx) return

        // update the derived settings
        this.sx = updateDerivedSettings(linkNode.sx, this.sx)
    },

    sameRelativePosition(dockLook, linkLook, lw){

        // Calculate the same relative position in the dockLook look as in the linkLook look
        return {    x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                    y: dockLook.rect.y + (lw.rect.y - linkLook.rect.y)}
    },

    // find the position for a new pin with a prefix: we have to make sure it is added to the correct ifName group
    prefixPinPosition(dockLook, lw){

        // get the prefix
        const prefix = lw.getPrefix()

        // find the ifName
        const ifName = dockLook.findInterfaceName(prefix)

        // find the ifName group
        const ifPins = ifName ? dockLook.getInterface(ifName) : null

        // check
        if (! ifPins) {
            // this should not happen - even a new prefix will have been added (see below)
            console.log('*** InterfaceName not found ***' + prefix + '  ' + lw.name)

            // add at the end ...
            return {
                x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                y: dockLook.rect.y + dockLook.rect.h
            }
        }

        // take the last element of the array
        const last = ifPins.at(-1)

        // add the item behind the last 
        return {    x: lw.is.left ? dockLook.rect.x : dockLook.rect.x + dockLook.rect.w, 
                    y: last.rect.y + last.rect.h}
    },

    // The position is the default position in the dockLook node
    // we put a new ifName just in front of the next ifName or at the end
    newInterfaceNamePosition(dockLook, lw) {

        // if we find no ifName add to the end
        const newPos = {x: dockLook.rect.x, y: dockLook.rect.y + dockLook.rect.h}

        // search for the first ifName below pos.y
        for(const sep of dockLook.widgets) {

            // check only interfaceNames
            if (! sep.is.ifName) continue

            // keep the order of adding stuff
            if (sep.is.added) continue

            // adapt y if the ifName is below but closer
            if (sep.rect.y > lw.rect.y && sep.rect.y < newPos.y) newPos.y = sep.rect.y
        }

        // done
        return newPos
    },

    // check the pin/proxy for zombies or added pins/proxies with the linked node
    // Note that for 'addPin' the rxtx tables or the pads will be adjusted later
    widgetCompare( linkNode ) {

        // notation
        const dockLook = this.look
        const linkLook = linkNode.look

        // reset the dockLook pins - by default set all pins and interfaceNames to zombie
        for (const dw of dockLook.widgets) {

            // set pins and interfaces to zombies - they will be un-zombied as we find them.
            if (dw.is.pin || dw.is.ifName) {
                dw.is.added = false
                dw.is.zombie = true
            }
        }

        // we make a sorted list of proxies - sort according y-value
        // In that way new widgets will be added at the same position as in the linkLook node.
        const linkedSorted = linkLook.widgets.slice().sort( (a,b) => a.rect.y - b.rect.y)

        // we first handle the interfaceNames
        for(const lw of linkedSorted)  {

            // only interfaceNames
            if ( ! lw.is.ifName) continue

            // find the corresponding widget in the dock
            let dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.ifName && lw.is.ifName && (dw.text == lw.text)))
            if (dw) {
                dw.is.zombie = false
                dw.wid = lw.wid
                continue
            }

            // let's check for a name change -> find the corresponding widget in the dock
            dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.ifName && lw.is.ifName && (dw.wid == lw.wid)))
            if (dw) {
                this.dockInterfaceNameChange(dw, lw)
                dw.is.zombie = false
                continue
            }

            // There is a new ifName
            this.dockNewInterfaceName(lw)
        }

         // now we handle the pins
        for(const lw of linkedSorted) {

            if ( ! lw.is.pin ) continue

            // exactly the same
            let dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.pin && (dw.name == lw.name) && (dw.is.input == lw.is.input) && (dw.is.channel == lw.is.channel)) )
            if (dw) {
                dw.is.zombie = false
                dw.wid = lw.wid
                continue
            }

            // probably a name change - select only unprocessed pins !
            dw = dockLook.widgets.find( dw => (dw.is.zombie && dw.is.pin &&  (dw.wid == lw.wid) && (dw.is.input == lw.is.input)) )
            if (dw) {

                this.dockPinChange(dw, lw)
                dw.is.zombie = false
                continue
            }

            // we consider the pin a new pin
            this.dockNewPin(lw, linkNode)
        }
    },

    dockNewPin(lw, linkNode) {

        // if the pin has a prefix it has to be added to the right prefix group !
        // by default we put a new pin at the same relative position as in the linked node
        const pos = (lw.pxlen != 0) ? this.prefixPinPosition(this.look, lw) : this.sameRelativePosition(this.look, linkNode.look, lw) 

        // add the pin
        const newPin = this.look.addPin(lw.name, pos, lw.is)

        // copy profile and prefix length
        //newPin.profile = lw.profile
        newPin.pxlen = lw.pxlen

        // it is a new widget 
        newPin.is.added = true
    },

    dockNewInterfaceName(lw) {

        // find the new position for a ifName (behind another ifName group !)
        const pos = this.newInterfaceNamePosition(this.look, lw)

        // add the ifName
        const newInterfaceName = this.look.addIfName(lw.text, pos)
        
        // it is a new widget 
        newInterfaceName.is.added = true
    },

    // The widget is a pin but has changed (input to output is not considered a change, but a new pin !)
    dockPinChange(dw,lw) {

        // a channel was added or removed
        if (lw.is.channel != dw.is.channel)  dw.is.channel = lw.is.channel

        // a name change - if the prefix has changed it must move to the appropriate seperator group
        if ((lw.name != dw.name)||(lw.pxlen != dw.pxlen)) {

            // if the widget has a prefix that is different from the current one
            if ((lw.pxlen != 0)&&(lw.getPrefix() != dw.getPrefix())) {

                // or the ifName text has changed or it is in the wrong ifName group
                const pos = this.prefixPinPosition(this.look, lw)

                // move the pin to a different location
                this.look.movePin(dw, pos)
            }

            // copy 
            dw.name = lw.name
            dw.pxlen = lw.pxlen
            dw.is.multi = lw.is.multi
        }

        // profile change (silent)
        //if (lw.is.input && lw.profile != dw.profile) dw.profile = lw.profile     
        
        // signal the change
        dw.is.added = true
    },

    dockInterfaceNameChange(dw, lw, linkNode) {

        // change the text
        if (lw.text == dw.text) return 

        // change the text
        dw.text = lw.text
        dw.is.added = true

        // change the prefixes of the pins
        this.look.interfaceChangePrefix(dw) 
    },

}