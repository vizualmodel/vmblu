import {editor} from '../editor/index.js'
import {Pad} from '../node/index.js'
import {style} from '../util/index.js'

export const redoxPad = {

padCreate: {

    doit({view, pos, input}) {

        // check
        if (!view.root) return

        // set the status
        const is = {
            input,
            left : pos.x < view.middle().x
        }

        // add a pin to the node
        let proxy = view.root.look.addPin('', pos, is)

        // determine the rectangle for the pad widget
        const rect = proxy.makePadRect({x:pos.x, y:pos.y- style.pad.hPad/2})

        // create the pad
        const pad = new Pad(rect, proxy)

        // !! if left we shift over the calculated width !!
        if (is.left) pad.rect.x -= pad.rect.w

        // and save the pad
        view.root.pads.push(pad) 

        // give the pad a UID
        editor.doc.UID.generate(pad)

        // start editing the pad name
        view.beginTextEdit(pad)

        // save the editor action
        editor.saveEdit('padCreate', {view, pad})
    },

    undo({view, pad}) {

        // it could be that the pad has not been created because the name was not ok
        if (! view.root.pads.includes(pad)) return

        pad.disconnect()

        view.root.removePad(pad) 

        pad.proxy.disconnect()

        view.root.look.removePin(pad.proxy)
    },

    redo({view, pad}) {

        // it could be that the pad has not been created because the name was not ok
        if (! view.root.pads.includes(pad)) return

        view.root.restorePad(pad)
        view.root.look.restorePin(pad.proxy)
    }

},

changeNamePad: {

    doit({view, pad}) {
        // check
        if (!pad?.proxy) return

        //save the edit
        editor.saveEdit('changeNamePad',{pad, oldName: pad.text, newName: null})

        // start editing the field
        view.beginTextEdit(pad)
    },
    undo({pad, oldName, newName}) {
        // save the new name
        editor.getParam().newName = pad.text

        // notation
        const node = pad.proxy.node

        // if the newname is '', then the pad has been removed > restore pad and pin !
        if (pad.text.length == 0) {
            node.restorePad(pad)
            node.look.restorePin(pad.proxy)
        }
        // reset the old name
        pad.proxy.name = oldName
        pad.nameChange(oldName)
    },
    redo({pad, oldName, newName}) {

        // notation
        const node = pad.proxy.node

        if (!newName || newName.length == 0) {
            // remove the pad
            node.removePad(pad)

            // remove the proxy - there should be no more routes connected to the widget !!!
            node.look.removePin(pad.proxy)

            // done
            return
        }
        // set the new name again
        pad.proxy.name = newName
        pad.nameChange(newName)
    }
},

disconnectPad: {

    doit({pad}) {
        // save the edit *before* disconnecting
        editor.saveEdit('disconnectPad',{pad, routes: pad.routes.slice()})

        // disconnect all the routes to the pad
        pad.disconnect()
    },
    undo({pad, routes}) {
        pad.reconnect(routes.slice())
    },
    redo({pad, routes}) {
        pad.disconnect()
    }
},

deletePad: {

    doit({pad}) {
        // save the edit *before* disconnecting
        editor.saveEdit('deletePad',{pad, routes: pad.routes.slice()})

        // notation
        const node = editor.doc.focus.root

        pad.disconnect()

        node.removePad(pad)

        pad.proxy.disconnect()

        node.look.removePin(pad.proxy)
    },
    undo({pad, routes}) {

        const node = pad.proxy.node
        node.restorePad(pad)
        node.look.restorePin(pad.proxy)
        pad.reconnect(routes.slice())
    },
    redo({pad, routes}) {

        pad.disconnect()
        pad.proxy.node.removePad(pad)
        pad.proxy.disconnect()
        pad.proxy.node.look.removePin(pad.proxy)
    }
},

extrudePad: {

    doit({view, pos}) {

        // the pin that we want to extrude
        const pin = view.hit.lookWidget
        
        // if we have hit a pin and the pin is not yet a proxy in the root 
        if (!pin.is.pin) return

        // we create a new proxy in the parent (i.e. the root node)
        const is = {...pin.is}

        // but it is a proxy
        is.proxy = true

        // create the proxy
        const proxy = view.root.look.addPin(pin.name, pos, is)

        // get the rect for the pad
        const rect = pin.makePadRect(pos)

        // create the pad
        const pad = new Pad(rect, proxy)

        // give the pad a uid
        editor.doc.UID.generate(pad)

        // place the pad
        pad.place()

        // create a short connection to the actual widget
        pad.shortConnection(pin)

        // ..save the edit
        editor.saveEdit('extrudePad',{pad, routes: pad.routes.slice()})

        // and save the pad
        view.root.pads.push(pad) 

        // and update the state
        view.state.pad = pad
    },
    undo({pad, routes}) {
        pad.disconnect()
        pad.proxy.node.removePad(pad)
    },
    redo({pad, routes}) {
        const node = pad.proxy.node
        node.restorePad(pad)
        node.look.restorePin(pad.proxy)    
        pad.reconnect(routes.slice())    
    }
},

padDrag: {

    doit({pad}) {
        // save the route points for the undo-operation
        editor.saveEdit('padDrag',{ pad,
                                    oldPos:{x:pad.rect.x, y:pad.rect.y}, 
                                    oldWires: pad.copyWires(), 
                                    newPos:null,
                                    newWires:null})
    },

    undo({pad, oldPos, oldWires, newPos, newWires}) {

        const delta = {x: oldPos.x - newPos.x, y: oldPos.y - newPos.y}
        pad.move(delta)
        pad.restoreWires(oldWires)
    },
    redo({pad, oldPos, oldWires, newPos, newWires}) {

        const delta = {x: newPos.x - oldPos.x, y: newPos.y - oldPos.y}
        pad.move(delta)
        pad.restoreWires(newWires)
    }
}

}
