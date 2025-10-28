import {convert} from '../util/index.js'
import {Widget} from '../widget/index.js'

export const jsonHandling = {

// collect the elements of the look that need to be saved in the vmblu file
getItemsToSave() {

    const widgets = []
    //const interfaces = []

    const toSave = {
        rect: {...this.rect},
        label: null,
        interfaces: []
    }

    // get the rectangle
    //const rect = {...this.rect}
    //let label = null

    // Check the widgets
    for( const w of this.widgets) {

        // don't save the icons the box or the header
        if (w.is.icon || w.is.box || w.is.header) continue

        // for a label do not include it in the rectangle size
        if (w.is.label) {
            toSave.rect.y += w.rect.h
            toSave.rect.h -= w.rect.h        
            toSave.label = w
            continue
        }

        // save interface names
        if (w.is.ifName) widgets.push(w)

        // save pins, but expand multis into seperate messages
        else if (w.is.pin) {

            widgets.push(w)

            // save multis as single messages
            // if (w.is.multi) {
            //     const mArray = w.expandMultis()
            //     for (const mName of mArray) {

            //         // create a new pin record
            //         const mPin = new Widget.Pin(w.rect, w.node, mName, w.is)

            //         // multis have the same wid
            //         mPin.wid = w.wid
            //         pins.push(mPin)
            //     }
            // }
            // else pins.push(w)
        }
    }

    // if there are no widgets there are no interfaces
    if (widgets.length == 0) return toSave

    // sort the widgets array
    widgets.sort( (a,b) => a.rect.y - b.rect.y)

    // fill in all the interfaces now
    let ifnr = -1
    let ifPins = null

    // If the first widget is a pin we have an unnamed ifPins (always the first)
    if (widgets[0].is.pin) {
        ifnr++;
        toSave.interfaces[ifnr] = { name: '',pins:[], editor: {id: 0}}
        ifPins = toSave.interfaces[ifnr].pins
    }

    // go through all the widgets
    for (const w of widgets) {

        // ad a pin to the current interface
        if (w.is.pin) ifPins.push(w)

        // an interface name starts a new ifPins
        else if (w.is.ifName) {
            ifnr++;
            toSave.interfaces[ifnr] = {name: w.text, pins: [], editor: {id: w.wid}}
            ifPins = toSave.interfaces[ifnr].pins
        }
    }

    // done
    return  toSave
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
        for (const rawPin of rawInterface.pins) {
            
            // cook the pin
            const newPin = this.cookPin(rawPin)

            // if the new pin is a proxy (the node is a group), we have to cook or add a pad to the group
            if (this.node.is.group) {
                rawPin.editor?.pad ? this.node.cookPad(newPin, rawPin.editor.pad ) : this.node.addPad(newPin)
            }
        }
    }

    // get the highest wid value
    for (const widget of this.widgets) if (widget.wid && (widget.wid > this.widGenerator)) this.widGenerator = widget.wid

    // if there are widgets with a wid of zero, correct this
    for (const widget of this.widgets) if (widget.wid == 0) widget.wid = this.generateWid()
},

cookPin(raw) {

    // if there is no editor field, add it
    if (!raw.editor) raw.editor = {id:0, align: 'left'}

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
    is.left = raw.editor.align == "left" ? true : false;
    is.channel = ((raw.kind == "request") || (raw.kind == "reply")) ? true : false;

    // a comma seperated list between [] is a multi message
    is.multi = convert.isMulti(raw.name)

    // proxy or pure pin
    is.proxy = this.node.is.group

    // set the y-position to zero - widget will be placed correctly
    const newPin = this.addPin(raw.name, 0, is)

    // recover the wid
    newPin.wid = raw.editor.id

    // check for an interface name prefix
    newPin.ifNamePrefixCheck()

    // check the width ...
    this.adjustPinWidth(newPin)

    // done
    return newPin
},

cookInterface(raw) {

    // If the interface has no name ther is no interface widget
    if (raw.name.length == 0) return null

    // add the interface name
    const newInterface = this.addIfName(raw.name, null)

    // set the wid
    newInterface.wid = raw.editor?.id || 0

    // done
    return newInterface
},

}