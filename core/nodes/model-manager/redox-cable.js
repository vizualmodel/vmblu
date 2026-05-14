function disconnectCableTacks(cable) {
    for (const tack of cable.tacks.slice()) tack.route.disconnect()
    cable.tacks.length = 0
}

function restoreCableDrawState(cable, wire, tacks, tackWires) {
    disconnectCableTacks(cable)
    cable.tacks.length = 0
    cable.restoreWire(wire)

    for (let i = 0; i < tacks.length; i++) {
        tacks[i].segment = tackWires[i].segment
        tacks[i].route.restoreWire(tackWires[i].track)
    }

    cable.reconnect(tacks.slice())
}

export const redoxCable = {

cableCreate: {

    doit({view, pos}) {
        view.state.bus = view.root.addCable(pos)
        this.saveEdit('cableCreate',{view, cable: view.state.bus})
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

cableDraw: {

    doit({view, cable, conx, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires}) {
        const node = view.root
        let deleted = false

        const connected = (conx?.is?.pin || conx?.is?.pad) ? cable.connectEndpoint(conx) : null

        if (connected) {
            newTacks = cable.tacks.slice()
            newTackWires = cable.copyTackWires()
        }
        else {
            disconnectCableTacks(cable)
            node.removeCable(cable)
            deleted = true
            newTacks = []
            newTackWires = []
        }

        this.saveEdit('cableDraw',{node, cable, oldWire, newWire, oldTacks, oldTackWires, newTacks, newTackWires, deleted})
    },

    undo({node, cable, oldWire, oldTacks, oldTackWires}) {
        node.restoreCable(cable)
        restoreCableDrawState(cable, oldWire, oldTacks, oldTackWires)
    },

    redo({node, cable, newWire, newTacks, newTackWires, deleted}) {
        if (deleted) {
            disconnectCableTacks(cable)
            node.removeCable(cable)
            return
        }

        node.restoreCable(cable)
        restoreCableDrawState(cable, newWire, newTacks, newTackWires)
    }
},

}
