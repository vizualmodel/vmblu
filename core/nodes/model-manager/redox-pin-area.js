import {selex} from '../../types/view/selection.js'

export const redoxPinArea = {

disconnectPinArea: {

    doit({view,node, widgets}) {
        // save an array of pins and routes
        const allRoutes = node.getAllRoutes(widgets)

        // disconnect the node
        node.disconnectPinArea(widgets)

        // save the edit
        this.saveEdit('disconnectPinArea',{node, widgets: widgets.slice(), allRoutes})
    },
    undo({node, widgets, allRoutes}) {

        // reconnect the routes to the pins - make a copy of the routes array, redo empties the array again !
        for (const route of allRoutes) route.reconnect()
    },
    redo({node, widgets, allRoutes}) {

        // redo the disconnect
        node.disconnectPinArea(widgets)
    }
},

deletePinArea: {

    doit({view,node, widgets}) {

        // save an array of pins and routes
        const allRoutes = node.getAllRoutes(widgets)

        // save the edit
        this.saveEdit('deletePinArea',{view, node, widgets: widgets.slice(), allRoutes})

        // disconnect
        node.disconnectPinArea(widgets)

        // remove the widgets
        node.look.deletePinArea(widgets)
    },
    undo({view, node, widgets, allRoutes}) {

        // the position
        const first = widgets[0]
        const pos = {x: first.rect.x, y: first.rect.y}

        // add the widgets back
        node.look.restoreWidgetsToPinArea(widgets, pos)

        // add the pads or the adjust the rx/tx tables
        node.is.source ? node.rxtxAddPinArea(widgets) : node.addPads(widgets)

        // reconnect the routes to the pins - make a copy of the routes array
        for (const route of allRoutes) route.reconnect()
    },
    redo({view, node, widgets, allRoutes}) {

        node.disconnectPinArea(widgets)
        node.look.deletePinArea(widgets)
    }
},

swapPinArea: {

    doit({view, left, right}){

        // check
        if (! view.selection.widgets?.length) return

        // save the pins that will be swapped
        const swapped = []

        // find the pins that need to be swapped
        for (let widget of view.selection.widgets) {
            if ( widget.is.pin && left  && ! widget.is.left) swapped.push(widget)
            if ( widget.is.pin && right &&   widget.is.left) swapped.push(widget)
        }

        // do the actual swapping
        for(const pin of swapped) pin.leftRightSwap()

        // signal the edit
        this.saveEdit('swapPinArea', {swapped})
    },
    undo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap()
    },
    redo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap()
    }
},

pasteWidgetsFromClipboard: {

    doit({view, raw}){

        // check that the clipboard contains a pin area selection
        if ( raw.what != selex.pinArea && raw.what != selex.ifArea) return
        if (! raw.widgets?.length > 0) return

        // get the single node and widget where we will add the copy
        const where = view.selection.whereToAdd()

        // check
        if (!where.node) return
        if (where.node.cannotBeModified()) return view.blinkToWarn(node)

        // we will rebuild the clipboard model
        const content = {raw, root:null, imports:null}

        // get the widgets from the clipboard
        view.clipboardToSelection(null, where, content)

        // save the edit
        this.saveEdit('pasteWidgetsFromClipboard', {view, node: where.node, widgets: view.selection.widgets.slice(), pos: where.pos})
    },
    undo({view,node, widgets, pos}) {

        // delete the transferred widgets again...
        if (widgets) node.look.deletePinArea(widgets)

        // reset the selection
        view.selection.reset()
    },
    redo({view, node, widgets, pos}) {

        // bring the widgets back
        node.look.restoreWidgetsToPinArea(widgets, pos)

        // add the pads or the adjust the rx/tx tables
        node.is.source ? node.rxtxAddPinArea(widgets) : node.addPads(widgets)

        // set as selected
        view.selection.pinAreaSelect(widgets)
    }
},

pinAreaToMulti: {

    doit({view,widgets}) {
        this.saveEdit('pinAreaToMulti',{view, widgets});
    },
    undo({view, widgets}) {
    },
    redo() {}
},

multiToPinArea: {

    doit({view,pin}) {
        this.saveEdit('multiToPinArea',{view, pin});
    },
    undo({view, pin}) {
    },
    redo() {}
},

ioSwitchPinArea: {

    doit({view}) {

        // check
        if (!view.selection.widgets.length) return

        // we switch all the selected widgets to
        const switched = []
        
        // note that a switch only happens when a pin is not connected !
        for (const pin of view.selection.widgets) {
            if (pin.is.pin && pin.ioSwitch()) switched.push(pin)
        }

        // check fro switches...
        if (switched.length) this.saveEdit('ioSwitchPinArea',{view, switched})
    },
    undo({view, switched}) {

        for (const pin of switched) pin.ioSwitch()
    },
    redo() {}
}

}
