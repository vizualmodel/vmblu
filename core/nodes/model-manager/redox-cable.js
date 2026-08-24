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
        view.state.cable = view.root.addCable(pos)
        // Compatibility for callers that still create a "bus". The marker is
        // retained in saved data but no longer changes cable behavior.
        view.state.cable.is.floating = !!floating
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

cableToRoutes: {

    doit({view, cable}) {
        const conversion = cable.convertToRoutes(view?.root)
        if (conversion) this.saveEdit('cableToRoutes', conversion)
    },

    undo({node, cable, tacks, routes}) {
        for (const route of routes.slice()) route.disconnect()
        node.restoreCable(cable)
        cable.reconnect(tacks.slice())
    },

    redo({node, cable, routes}) {
        cable.disconnect()
        node.removeCable(cable)
        for (const route of routes) route.reconnect()
    }
},

cableStraightConnections: {

    doit({cable}) {

        const wireArray = []

        for(const tack of cable.tacks) {
            wireArray.push({
                tack,
                attachment: tack.copyAttachment(),
                wire: tack.route.copyWire()
            })
        }

        this.saveEdit('cableStraightConnections',{cable, wireArray})

        cable.straightConnections()
    },
    undo({cable, wireArray}) {

        for (const entry of wireArray) {
            const tack = entry.tack
            tack.route.restoreWire(entry.wire)
            tack.restoreAttachment(entry.attachment)
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

cableSelective: {

    doit({cable}) {
        this.saveEdit('cableSelective', {cable, tacks: cable.tacks.slice()})
        cable.setSelectivityForAll(true)
    },
    undo({cable, tacks}) {
        if (cable.tacks.length != tacks.length) return

        for(let i=0; i<tacks.length; i++) {
            cable.tacks[i].selective = tacks[i].selective
        }
    },
    redo({cable}) {
        cable.setSelectivityForAll(true)
    }    
},

cableUnselective: {

    doit({cable}) {
        this.saveEdit('cableUnselective', {cable, tacks: cable.tacks.slice()})
        cable.setSelectivityForAll(false)
    },
    undo({cable, tacks}) {
        if (cable.tacks.length != tacks.length) return

        for(let i=0; i<tacks.length; i++) {
            cable.tacks[i].selective = tacks[i].selective
        }
    },
    redo({cable}) {
        cable.setSelectivityForAll(false)
    }    
},

cableDraw: {

    doit({view, cable, conx, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires}) {
        const node = view.root

        const connected = (conx?.is?.pin || conx?.is?.pad) ? cable.connectEndpoint(conx) : null

        if (connected) {
            newTacks = cable.tacks.slice()
            newTackWires = cable.copyTackWires()
        }

        this.saveEdit('cableDraw',{node, cable, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires})
    },

    undo({node, cable, oldWire, oldTacks, oldTackWires}) {
        node.restoreCable(cable)
        cable.restoreDrawState(oldWire, oldTacks, oldTackWires)
    },

    redo({node, cable, newWire, newTacks, newTackWires}) {
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

    doit({tack, oldWire, newWire, oldAttachment, newAttachment, oldCableWire, newCableWire, oldCableTackWires, newCableTackWires}) {
        this.saveEdit('tackDrag',{tack, oldWire, newWire, oldAttachment, newAttachment, oldCableWire, newCableWire, oldCableTackWires, newCableTackWires})
    },
    undo({tack, oldWire, oldAttachment, oldCableWire, oldCableTackWires}) {
        if (oldCableWire) return tack.cable.restoreWireState(oldCableWire, oldCableTackWires)
        tack.route.restoreWire(oldWire)
        tack.restoreAttachment(oldAttachment)
    },
    redo({tack, newWire, newAttachment, newCableWire, newCableTackWires}) {
        if (newCableWire) return tack.cable.restoreWireState(newCableWire, newCableTackWires)
        tack.route.restoreWire(newWire)
        tack.restoreAttachment(newAttachment)
    }
},

}
