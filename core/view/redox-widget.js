import {editor} from '../editor/index.js'
import {ARL} from '../arl/index.js'

/**
 * @node editor editor
 */
export const redoxWidget = {

newPin: {

    doit({view, node, pos, is}){
        // create the pin
        const pin = node.look.addPin('', pos, is)

        // add a pad or the pin to the rx / tx table
        pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin) 

        // switch the selected pin
        view.selection.switchWidget(pin)

        // edit the name field
        view.beginTextEdit(pin)

        // store and report the new edit - here the rxtx or the pad is added !
        editor.saveEdit('newPin', {view,pin})
    },
    undo({view,pin}) {

        // if the pin was not created (no valid name) just return
        if (!pin || !pin.node.look.widgets.includes(pin)) return

        // the node
        const node = pin.node

        // switch selection
        view.selection.switchWidget()

        // remove the pin
        node.look.removePin(pin)

        // it is the last entry in the rx/tx table
        pin.is.proxy ? node.pads.pop() : node.rxtxPopPin(pin)
    },
    redo({view,pin}) {

        // if the pin was not created (no valid name) just return
        if (!pin || !pin.node.look.widgets.includes(pin)) return

        // the node
        const node = pin.node

        // restore the pin to its previous place in the look
        node.look.restorePin(pin)

        // add the pin to the rx / tx table
        pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin) 

        // switch the selected pin
        view.selection.switchWidget(pin)
    }
},

disconnectPin: {

    doit({pin}) {
        // save the routes before disconnecting ...
        const savedRoutes = pin.routes.slice()
        
        // disconnect
        pin.disconnect()

        // store and report the new edit
        editor.saveEdit('disconnectPin',{pin,routes:savedRoutes})
    },
    undo({pin, routes}) { 
        pin.reconnect(routes)
    },
    redo({pin, routes}) { 
        pin.disconnect()
    }
},

deletePin: {

    doit({view, pin}) {
        // save the routes 
        const pinRoutes = pin.routes.slice()

        // also for the pad if applicable
        const padRoutes = pin.is.proxy ? pin.pad.routes.slice() : null

        // save the edit *before* the delete !
        editor.saveEdit('deletePin',{view, pin, pinRoutes, padRoutes})

        // switch the selection
        view.selection.switchWidget()

        // disconnect
        pin.disconnect()

        // delete the pin in the node
        pin.node.look.removePin(pin)

        // if proxy remove pad
        if (pin.is.proxy) {

            pin.pad.disconnect()

            pin.node.removePad(pin.pad)
        }
        // if not remove from rx table
        else pin.node.rxtxRemovePin(pin)
    },
    undo({view, pin, pinRoutes, padRoutes}) {

        // copy the routes (redo destroys the array - we want to keep it on the undo stack !)
        const copyRoutes = pinRoutes.slice()

        // put the pin back
        pin.node.look.restorePin(pin)

        // switch the selection
        view.selection.switchWidget(pin)

        // reconnect the routes to the pin
        pin.reconnect(copyRoutes)

        // reconnect the routes to the pad
        if (pin.is.proxy) {

            // first add the pad again ?

            // reconnect the routes
            pin.pad.reconnect(padRoutes)
        }
    },

    redo({view, pin, pinRoutes, padRoutes}) {

        // first disconnect
        pin.disconnect()

        // switch the selection
        view.selection.switchWidget()

        // remove the pin
        pin.node.look.removePin(pin)
    }
},

// change the pin from an input type to an output type
ioSwap: {

    doit({pin}) {

        if (pin.ioSwap()) editor.saveEdit('ioSwap',pin)
    },
    undo({pin}) {
        pin.ioSwap()
    },
    redo({pin}) {
        pin.ioSwap()
    }
},

// change the pin from an input type to an output type
channelOnOff: {

    doit({pin}) {

        if (pin.channelOnOff()) editor.saveEdit('channelOnOff',pin)
    },
    undo({pin}) {
        pin.channelOnOff()
    },
    redo({pin}) {
        pin.channelOnOff()
    }
},

pinDrag: {

    doit({pin}) {
        editor.saveEdit('pinDrag', {pin, oldPos: {left: pin.is.left, y: pin.rect.y}, newPos: null})
    },
    undo({pin, oldPos, newPos}) {
        pin.moveTo(oldPos.left, oldPos.y)
    },
    redo({pin, oldPos, newPos}) {
        pin.moveTo(newPos.left, newPos.y)
    }
},

pinAreaDrag: {

    doit(view) {

        // The widgets that are being dragged
        const widgets = view.selection.widgets

        // get the current y-position of the selected widgets
        editor.saveEdit('pinAreaDrag', {widgets, oldY:widgets[0].rect.y, newY:widgets[0].rect.y})
    },
    undo({widgets, oldY, newY}) {
    },
    redo({widgets, oldY, newY}) {
    }
},

showProfile: {

    doit({pin, pos}) {

        // check that we have a model
        if ( ! (editor.doc?.model) ) return 

        // get the pin profile (can be a single profile or an array !)
        const profile = pin.is.input ? editor.doc.model.getInputPinProfile(pin) : editor.doc.model.getOutputPinProfile(pin)

        // check
        if (!profile) return

        // show the profile
        editor.tx.send('pin profile',{pos, pin, profile,
            
            // The function that is called when clicking the handler name
            open(loc){
                
                //const arl = new ARL(loc.file)

                // resolve the file name with the model name
                const arl = editor.doc.model.arl.resolve(loc.file)

                // request to open the source file
                editor.tx.send('open source file',{arl, line:loc.line})
            }
        })
    },

    undo() {},
    redo(){}
},


newInterfaceName: {

    doit({view, node, pos}) {
        // make a new ifName and put it in edit mode
        let ifName = node.look.addIfName('',pos)

        // set the field in edit mode
        view.beginTextEdit(ifName)

        // switch the selected pin
        view.selection.switchWidget(ifName)

        // store and report the new edit
        editor.saveEdit( 'newInterfaceName', {ifName})
    },
    undo({ifName}) {
        ifName.node.look.removeInterfaceName(ifName)
    },
    redo({ifName}) {
        ifName.node.look.restoreInterfaceName(ifName)
    }
},

deleteInterfaceName: {

    doit({view,ifName}) {

        // switch the selection
        view.selection.switchWidget()

        // show the full names of the ifName group
        const pxlenArray = ifName.node.look.showPrefixes(ifName)

        // remove the pin
        ifName.node.look.removeInterfaceName(ifName)

        // store and report the new edit
        editor.saveEdit('deleteInterfaceName',{view,ifName, pxlenArray})
    },
    undo({view,ifName, pxlenArray}) {
        // restore the ifName
        ifName.node.look.restoreInterfaceName(ifName)

        // restore the prefixes
        ifName.node.look.hidePrefixes(ifName, pxlenArray)

        // switch the selection
        view.selection.switchWidget(ifName)
    },
    redo({view,ifName, pxlenArray}) {

        // switch the selection
        view.selection.switchWidget()

        // show the full names of the ifName group
        ifName.node.look.showPrefixes(ifName)

        // remove the ifName
        ifName.node.look.removeInterfaceName(ifName)
    }
},

interfaceDrag: {

    doit({group, oldY, newY}) {

        // just save the parameters...
        editor.saveEdit('interfaceDrag',{group, oldY, newY})
    },
    undo({group, oldY, newY}) {

        const dy = oldY - newY
        const node = group[0].node
        node.look.groupMove(group, dy)
    },

    redo({group, oldY, newY}) {

        const dy = newY - oldY
        const node = group[0].node
        node.look.groupMove(group, dy)
    }
},

interfaceNameDrag: {

    doit({ifName}) {
        editor.saveEdit('interfaceNameDrag', {ifName, oldY: ifName.rect.y, newY:ifName.rect.y})
    },
    undo({ifName, oldY, newY}) {
        ifName.moveTo(oldY)
    },
    redo({ifName, oldY, newY}) {
        ifName.moveTo(newY)
    }
},

addLabel: {
    doit({node}) {

        // find the label of the look or add an empty one
        let label = node.look.widgets.find( widget => widget.is.label ) ?? node.look.addLabel('')

        // start editing the field - parameters = object - must have the edit ifPins !
        editor.doc?.focus?.beginTextEdit(label)

        // signal the edit
        editor.saveEdit('addLabel',{node, label})
    },
    undo({node, label}) {

        node.look.removeLabel()
    },
    redo({node, label}) {

        node.look.restoreLabel(label)
    }
},

widgetTextEdit: {

    doit({view, widget, cursor, clear}) {

        // check if field is editable - must return the prop that will be edited
        const prop = widget.startEdit?.()

        // check
        if (!prop) return

        // save the old value
        editor.saveEdit('widgetTextEdit',{widget, prop, oldText: widget[prop], newText:''})

        // keyboard handling etc is done here
        view.beginTextEdit(widget, cursor, clear ?? false)
    },
    undo({widget, prop, oldText, newText}) {

        /*
        better is to call simply undoTextEdit
        ======================================

        widget.undoTextEdit(oldText)
        */

        // save the new text now also !
        newText = widget[prop]
        editor.getParam().newText = newText
        widget[prop] = oldText

        // signal the widget that the value has changed
        widget.endEdit(newText)

    },
    redo({widget, prop, oldText, newText}) {

        widget[prop] = newText

        widget.endEdit(oldText)
    }
}


}
