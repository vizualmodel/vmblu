import {editor} from '../editor/index.js'
import {Factory} from '../node/index.js'

export const redoxBus = {

busHighlight: {
    doit({bus}) {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
        editor.saveEdit('busHighLight', {bus})
    },
    undo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
    },
    redo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
    }
},

busCreate: {

    doit({view, pos, cable}) {
        view.state.bus = view.root.addBus("", pos)
        editor.saveEdit('busCreate',{node:view.root, bus: view.state.bus})

        if (cable) view.state.bus.is.cable = true
    },
    undo({node, bus}) {
        node.removeBus(bus)
    },
    redo({node, bus}) {
        node.restoreBus(bus)
    }
},

busChangeName: {

    doit({bus, label}){

        // save the bus in the state
        editor.doc.focus.state.bus = bus

        // set the bus as selected
        bus.selected = true

        // if no label selected, take the start label
        if (!label) label = bus.startLabel

        // start editing the field
        editor.doc.focus.beginTextEdit(label)

        // save the edit
        editor.saveEdit('busChangeName',{label, oldName: label.text, newName:null})
    },
    undo({label, oldName, newName}){
        editor.getParam().newName = label.text
        label.setText(oldName)
    },
    redo({label, oldName, newName}){
        label.setText(newName)
    },

},

busChangeType: {

    doit({bus}) {

        // make a copy of the tacks
        const oldTacks = bus.tacks.slice()

        // save the edit
        editor.saveEdit('busChangeType', {bus, tacks: oldTacks})

        // disconnect
        bus.disconnect()

        // change the type of bus
        bus.is.cable = !bus.is.cable

        // ..and reconnect
        bus.reconnect(oldTacks)
    },
    undo({bus, tacks}) {
        const oldTacks = tacks.slice()
        bus.disconnect()
        bus.is.cable = !bus.is.cable
        bus.reconnect(oldTacks)
    },
    redo({bus, tacks}) {
        const oldTacks = tacks.slice()
        bus.disconnect()
        bus.is.cable = !bus.is.cable
        bus.reconnect(oldTacks)
    }    
},

busDeleteRouter: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDeleteRouter', {bus})

        // disconnect the bus from the filter
        bus.is.filter = false
    },
    undo({bus}) {
        bus.is.filter = true
    },
    redo({bus}) {
        bus.is.filter = false
    }    
},

busChangeRouter: {

    doit({bus, newName, userPath}) {

        // copy the old factory
        const oldRouter = bus.filter ? bus.filter.clone() : null

        // resolve the input to a new factory arl 
        if (!bus.filter) bus.filter = new Factory()
        bus.filter.resolve(newName, userPath, editor.doc.model.arl, bus.name)

        // set the filter bit
        bus.is.filter = true

        // keep the old factory
        editor.saveEdit('busChangeRouter',{bus, oldRouter, newRouter: bus.filter})

    },
    undo({bus, oldRouter, newRouter}) {
        bus.filter = oldRouter
    },
    redo({bus, oldRouter, newRouter}) {
        bus.filter = newRouter
    }    
},

busStraightConnections: {

    doit({bus}) {

        const wireArray = []

        // save the wires of the bus tacks
        for(const tack of bus.tacks) wireArray.push({   tack, 
                                                        oldPos:{x: tack.rect.x, y: tack.rect.y}, 
                                                        wire: tack.route.copyWire()});

        // save
        editor.saveEdit('busStraightConnections',{bus, wireArray})

        bus.straightConnections()
    },
    undo({bus, wireArray}) {

        for (const entry of wireArray) {

            const tack = entry.tack

            tack.pos.x = entry.oldPos.x
            tack.pos.y = entry.oldPos.y
            tack.route.restoreWire(entry.wire);
        }

    },
    redo({bus, wireArray}) {
        bus.straightConnections()
    }
},

busDisconnect: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDisconnect', {bus, tacks: bus.tacks.slice()})

        // disconnect all the routes to the bus
        bus.disconnect()
    },
    undo({bus, tacks}) {
        bus.reconnect(tacks.slice())
    },
    redo({bus, tacks}) {
        bus.disconnect()
    }    
},

busDelete: {

    doit({bus}) {
        // save the edit
        editor.saveEdit('busDelete', {node: editor.doc.focus.root, bus, tacks:bus.tacks.slice()})

        // delete the bus
        editor.doc.focus.root.deleteBus(bus)
    },

    undo({node, bus, tacks}) {
        node.restoreBus(bus)
        bus.reconnect(tacks.slice())
    },
    redo({node, bus, tacks}) {
        bus.disconnect()
        node.removeBus(bus)
    }    
},

busDraw: {

    doit({bus}) {
        // save the edit for undo/redo
        editor.saveEdit('busDraw',{bus,oldWire: bus.copyWire(),newWire: null})
    },
    undo({bus, oldWire, newWire}) {
        bus.restoreWire(oldWire)
        bus.startLabel.place()
        bus.endLabel.place()
    },
    redo({bus, oldWire, newWire}) {
        bus.restoreWire(newWire)
        bus.startLabel.place()
        bus.endLabel.place()
    }
},

busSegmentDrag: {

    doit({bus}) {

        // save the edit for undo/redo
        editor.saveEdit('busSegmentDrag',{  bus,
            oldWire: bus.copyWire(),
            newWire: null,
            oldTackWires: bus.copyTackWires(),
            newTackWires: null
        })
    },

    undo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(oldWire)
        bus.restoreTackWires(oldTackWires)
        bus.startLabel.place()
        bus.endLabel.place()
        bus.placeTacks()
    },
    redo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(newWire)
        bus.restoreTackWires(newTackWires)
        bus.startLabel.place()
        bus.endLabel.place()
        bus.placeTacks()
    }
},

busDrag: {

    doit({bus}) {

        // save the edit for undo/redo
        editor.saveEdit('busDrag',{  bus,
            oldWire: bus.copyWire(),
            newWire: null,
            oldTackWires: bus.copyTackWires(),
            newTackWires: null
        })
    },
    undo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(oldWire)
        bus.restoreTackWires(oldTackWires)
        bus.startLabel.place()
        bus.endLabel.place()
        bus.placeTacks()
    },
    redo({bus, oldWire, newWire, oldTackWires, newTackWires }) {

        bus.restoreWire(newWire)
        bus.restoreTackWires(newTackWires)
        bus.startLabel.place()
        bus.endLabel.place()
        bus.placeTacks()
    }
},

tackDrag: {

    doit({tack}) {
        // save the edit for undo/redo
        editor.saveEdit('tackDrag',{tack,oldWire: tack.route.copyWire(), newWire: null})       
    },
    undo({tack, oldWire, newWire}) {
        tack.route.restoreWire(oldWire)
        tack.orient()
    },
    redo({tack, oldWire, newWire}) {
        tack.route.restoreWire(newWire)
        tack.orient()
    }
},
}