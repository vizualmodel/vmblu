export const redoxCable = {

cableHighlight: {
    
    doit({cable}) {
        cable.is.highLighted ? cable.unHighLight() : cable.highLight()
        this.saveEdit('cableHighlight', {cable})
    },
    undo({cable})    {
        cable.is.highLighted ? cable.unHighLight() : cable.highLight()
    },
    redo({cable})    {
        cable.is.highLighted ? cable.unHighLight() : cable.highLight()
    }
},

cableCreate: {

    doit({view, pos, floating = false}) {
        view.state.cable = floating ? view.root.addBus(pos) : view.root.addCable(pos)
        this.saveEdit('cableCreate',{view, cable: view.state.cable})
    },
    undo({view, cable}) {
        view.root.removeCable(cable)
    },
    redo({view, cable}) {
        view.root.restoreCable(cable)
    }
},

cableDelete: {

    doit({view, cable}) {
        if (!view?.root) return
        this.saveEdit('cableDelete', {node: view.root, cable, tacks:cable.tacks.slice()})
        view.root.deleteCable(cable)
    },

    undo({node, cable, tacks}) {
        node.restoreCable(cable)
        cable.reconnect(tacks.slice())
    },
    redo({node, cable, tacks}) {
        cable.disconnect()
        node.removeCable(cable)
    }    
},

cableStraightConnections: {

    doit({cable}) {

        const wireArray = []

        for(const tack of cable.tacks) {
            wireArray.push({
                tack, 
                oldPos:{x: tack.rect.x, y: tack.rect.y}, 
                wire: tack.route.copyWire()
            })
        }

        this.saveEdit('cableStraightConnections',{cable, wireArray})

        cable.straightConnections()
    },
    undo({cable, wireArray}) {

        for (const entry of wireArray) {
            const tack = entry.tack
            tack.rect.x = entry.oldPos.x
            tack.rect.y = entry.oldPos.y
            tack.route.restoreWire(entry.wire)
        }
    },
    redo({cable}) {
        cable.straightConnections()
    }
},

cableDisconnect: {

    doit({cable}) {
        this.saveEdit('cableDisconnect', {cable, tacks: cable.tacks.slice()})
        cable.disconnect()
    },
    undo({cable, tacks}) {
        cable.reconnect(tacks.slice())
    },
    redo({cable}) {
        cable.disconnect()
    }    
},

cableDraw: {

    doit({view, cable, conx, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires}) {
        const node = view.root
        let deleted = false

        if (cable.is.floating) {
            this.saveEdit('cableDraw',{node, cable, oldWire, newWire, oldTackWires, newTackWires, floating: true})
            return
        }

        const connected = (conx?.is?.pin || conx?.is?.pad) ? cable.connectEndpoint(conx) : null

        if (connected) {
            newTacks = cable.tacks.slice()
            newTackWires = cable.copyTackWires()
        }
        else {
            cable.disconnectTacks()
            node.removeCable(cable)
            deleted = true
            newTacks = []
            newTackWires = []
        }

        this.saveEdit('cableDraw',{node, cable, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires, deleted})
    },

    undo({node, cable, oldWire, oldTacks, oldTackWires, floating}) {
        if (floating) {
            cable.restoreWireState(oldWire, oldTackWires)
            return
        }

        node.restoreCable(cable)
        cable.restoreDrawState(oldWire, oldTacks, oldTackWires)
    },

    redo({node, cable, newWire, newTacks, newTackWires, deleted, floating}) {
        if (floating) {
            cable.restoreWireState(newWire, newTackWires)
            return
        }

        if (deleted) {
            cable.disconnectTacks()
            node.removeCable(cable)
            return
        }

        node.restoreCable(cable)
        cable.restoreDrawState(newWire, newTacks, newTackWires)
    }
},

cableSegmentDrag: {

    doit({cable, oldWire, newWire, oldTackWires, newTackWires }) {
        this.saveEdit('cableSegmentDrag',{cable, oldWire, newWire, oldTackWires, newTackWires})
    },

    undo({cable, oldWire, oldTackWires }) {
        cable.restoreWireState(oldWire, oldTackWires)
    },
    redo({cable, newWire, newTackWires }) {
        cable.restoreWireState(newWire, newTackWires)
    }
},

cableDrag: {

    doit({cable, oldWire, newWire, oldTackWires, newTackWires}) {
        this.saveEdit('cableDrag',{cable, oldWire, newWire, oldTackWires, newTackWires})
    },
    undo({cable, oldWire, oldTackWires }) {
        cable.restoreWireState(oldWire, oldTackWires)
    },
    redo({cable, newWire, newTackWires }) {
        cable.restoreWireState(newWire, newTackWires)
    }
},

tackDrag: {

    doit({tack, oldWire, newWire}) {
        this.saveEdit('tackDrag',{tack, oldWire, newWire})       
    },
    undo({tack, oldWire}) {
        tack.route.restoreWire(oldWire)
        tack.setRoute(tack.route)
    },
    redo({tack, newWire}) {
        tack.route.restoreWire(newWire)
        tack.setRoute(tack.route)
    }
},

}
