import {Factory} from '../../types/node/index.js'

export const redoxBus = {

busHighlight: {
    
    doit({bus}) {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
        this.saveEdit('busHighLight', {bus})
    },
    undo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
    },
    redo({bus})    {
        bus.is.highLighted ? bus.unHighLight() : bus.highLight()
    }
},

busCreate: {

    doit({view, pos}) {
        view.state.bus = view.root.addBus("", pos)
        this.saveEdit('busCreate',{view, bus: view.state.bus})
    },
    undo({view, bus}) {
        view.root.removeBus(bus)
    },
    redo({view, bus}) {
        view.root.restoreBus(bus)
    }
},

busChangeName: {

    doit({view, bus, label}){

        if (!view) return

        // save the bus in the state
        view.state.bus = bus

        // set the bus as selected
        bus.selected = true

        // if no label selected, take the start label
        if (!label) label = bus.startLabel

        // start editing the field
        view.beginTextEdit(label)

        // save the edit
        this.saveEdit('busChangeName',{label, oldName: label.text, newName:null})
    },
    undo({label, oldName, newName}){
        this.saveEdit().newName = label.text
        label.setText(oldName)
    },
    redo({label, oldName, newName}){
        label.setText(newName)
    },

},

busStraightConnections: {

    doit({bus}) {

        const wireArray = []

        // save the wires of the bus tacks
        for(const tack of bus.tacks) wireArray.push({   tack, 
                                                        oldPos:{x: tack.rect.x, y: tack.rect.y}, 
                                                        wire: tack.route.copyWire()});

        // save
        this.saveEdit('busStraightConnections',{bus, wireArray})

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
        this.saveEdit('busDisconnect', {bus, tacks: bus.tacks.slice()})

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

    doit({view, bus}) {
        if (!view?.root) return
        // save the edit
        this.saveEdit('busDelete', {node: view.root, bus, tacks:bus.tacks.slice()})

        // delete the bus
        view.root.deleteBus(bus)
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

    doit({bus, oldWire, newWire}) {
        // save the edit for undo/redo
        this.saveEdit('busDraw',{bus, oldWire, newWire})
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

    doit({bus,oldWire, newWire, oldTackWires, newTackWires }) {

        // save the edit for undo/redo
        this.saveEdit('busSegmentDrag',{bus,oldWire, newWire, oldTackWires, newTackWires})
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

    doit({bus,oldWire, newWire, oldTackWires, newTackWires}) {

        this.saveEdit('busSegmentDrag',{bus,oldWire, newWire, oldTackWires, newTackWires})
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
        this.saveEdit('tackDrag',{tack,oldWire: tack.route.copyWire(), newWire: null})       
    },
    undo({tack, oldWire, newWire}) {
        tack.route.restoreWire(oldWire)
        tack.setRoute(tack.route)
    },
    redo({tack, oldWire, newWire}) {
        tack.route.restoreWire(newWire)
        tack.setRoute(tack.route)
    }
},
}
