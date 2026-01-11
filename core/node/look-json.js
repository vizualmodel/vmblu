import {convert} from '../util/index.js'
import {Widget} from '../widget/index.js'

export const jsonHandling = {

// collect the elements of the look that need to be saved in the vmblu file
makeRaw() {

    const widgets = []

    const raw = {
        rect: {...this.rect},
        label: null,
        interfaces: []
    }

    // Check the widgets
    for( const w of this.widgets) {

        // don't save the icons the box or the header
        if (w.is.icon || w.is.box || w.is.header) continue

        // for a label do not include it in the rectangle size
        if (w.is.label) {
            raw.rect.y += w.rect.h
            raw.rect.h -= w.rect.h        
            raw.label = w
            continue
        }

        // save interface names
        if (w.is.ifName) widgets.push(w)

        // save pins, but expand multis into seperate messages
        else if (w.is.pin) {
            widgets.push(w)
        }
    }

    // if there are no widgets there are no interfaces
    if (widgets.length == 0) return raw

    // sort the widgets array
    widgets.sort( (a,b) => a.rect.y - b.rect.y)

    // fill in all the interfaces now
    let ifnr = -1
    let ifPins = null

    // If the first widget is a pin we have an unnamed ifPins (always the first)
    if (widgets[0].is.pin) {
        ifnr++;
        raw.interfaces[ifnr] = {interface: '',pins:[], wid: 0}
        ifPins = raw.interfaces[ifnr].pins
    }

    // go through all the widgets
    for (const w of widgets) {

        // ad a pin to the current interface
        if (w.is.pin) { 
            ifPins.push(w.makeRaw())
        }
        else if (w.is.ifName) {

            // an interface name starts a new ifPins
            ifnr++;
            raw.interfaces[ifnr] = {interface: w.text, pins: [], wid: w.wid}
            ifPins = raw.interfaces[ifnr].pins
        }
    }

    // done
    return  raw
},



acceptChanges() {

    // save the widgets to remove
    const zombies = []

    for(const widget of this.widgets) {

        // remove the routes to and from the zombie
        if (widget.is.pin) {

            // make a copy of the routes for the loop - the widget.routes will be modified !!
            const routes = widget.routes?.slice()

            if (widget.is.zombie) {

                // disconnect the routes
                for(const route of routes) route.disconnect()

                // save the zombie
                zombies.push(widget)
            }
            // remove routes for which no connection exists anymore and accept new routes
            else {
                for (const route of routes) {
                    if (route.is.newConx) route.is.newConx = false
                    else if (route.is.noConx) route.disconnect()
                }
            }
        }

        if (widget.is.ifName && widget.is.zombie) {

            // show the full names of the ifName group
            widget.node.look.showPrefixes(widget)
            zombies.push(widget)
        }
        
        if (widget.is.added) widget.is.added = false
    }

    // now remove the zombie widgets from the look
    for(const zombie of zombies) {
        zombie.is.pin   ? zombie.node.look.removePin(zombie)
                        : zombie.is.ifName ? zombie.node.look.removeInterfaceName(zombie) 
                        : null
    }
},

cook( raw ) {

    // check for a label
    if (raw.label) this.addLabel(raw.label)

    // check
    if (!raw.interfaces) return

    // go through all the interfaces
    for (const rawInterface of raw.interfaces) {

        // create the interface first
        const newInterface = this.cookInterface(rawInterface)

        // cook the pins
        for (const rawPin of rawInterface.pins) this.cookPin(rawPin)
    }

    // add the pads for the pins of a group node
    if (this.node.is.group) for (const widget of this.widgets) {
        if (widget.is.pin) {
            const rawPad = raw.pads?.find( rawPad => rawPad.text === widget.name)
            rawPad ? this.node.cookPad(widget, rawPad ) : this.node.addPad(widget)
        }
    }

    // get the highest wid value
    for (const widget of this.widgets) if (widget.wid && (widget.wid > this.widGenerator)) this.widGenerator = widget.wid

    // if there are widgets with a wid of zero, correct this
    for (const widget of this.widgets) if (widget.wid == 0) widget.wid = this.generateWid()
},

cookPin(raw) {

    // the state of the pin
    const is = {
        input: false,
        left: false,
        channel: false,
        multi: false,
        zombie: false
    }

    // set the state bits
    is.input = ((raw.kind == "input") || (raw.kind == "reply")) ? true : false;
    is.left = raw.left
    is.channel = ((raw.kind == "request") || (raw.kind == "reply")) ? true : false;

    // a comma seperated list between [] is a multi message
    is.multi = convert.isMulti(raw.name)

    // proxy or pure pin
    is.proxy = this.node.is.group
    // set the y-position to zero - widget will be placed correctly
    const newPin = this.addPin(raw.name, 0, is)

    // set the contract
    if (raw.contract) {
        newPin.contract.owner =  (raw.contract.role == 'owner')
        newPin.contract.payload = newPin.contract.owner ? raw.contract.payload : null
    }

    // set the prompt
    if (raw.prompt) newPin.prompt = raw.prompt

    // recover the wid
    newPin.wid = raw.wid ?? 0

    // check for an interface name prefix
    newPin.ifNamePrefixCheck()

    // check the width ...
    this.adjustPinWidth(newPin)

    // done
    return newPin
},

cookInterface(raw) {

    // If the interface has no name there is no interface widget
    if (! raw.interface?.length) return null

    // add the interface name
    const newInterface = this.addIfName(raw.interface, null)

    // set the wid
    newInterface.wid = raw.wid ?? 0

    // done
    return newInterface
},

}