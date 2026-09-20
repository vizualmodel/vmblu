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

        widgets = widgets.slice().sort((a, b) => a.rect.y - b.rect.y)

        // save an array of pins and routes
        const allRoutes = node.getAllRoutes(widgets)

        // save the edit
        this.saveEdit('deletePinArea',{view, node, widgets: widgets.slice(), allRoutes})

        // disconnect
        node.disconnectPinArea(widgets)

        // Remove bottom-up so shifting the remaining rows cannot overwrite
        // the original positions of widgets still waiting to be removed.
        node.look.deletePinArea(widgets.slice().reverse())
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
        node.look.deletePinArea(widgets.slice().reverse())
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

    doit({view, raw, target}){

        // check that the clipboard contains a pin area selection
        if (!raw || (raw.what != selex.pinArea && raw.what != selex.ifArea)) return
        if (!raw.widgets?.length) return

        // get the single node and widget where we will add the copy
        const where = view.selection.whereToAdd(raw, target)

        // check
        if (!where.node) return
        if (where.node.cannotBeModified()) return view.blinkToWarn(where.node)

        // we will rebuild the clipboard model
        const content = {raw, root:null, imports:null}

        // get the widgets from the clipboard
        view.clipboardToSelection(null, where, content)

        // save the edit
        const widgets = view.selection.widgets.slice()
        if (widgets.some(widget => widget.prompt)) where.node.prompts.markDirty()
        this.saveEdit('pasteWidgetsFromClipboard', {view, node: where.node, widgets, pos: where.pos,
            wids: widgets.map(widget => widget.wid), pads: widgets.filter(widget => widget.is.proxy).map(widget => widget.pad),
            what: view.selection.what})
    },
    undo({view,node, widgets, pos}) {

        // delete the transferred widgets again...
        if (widgets) node.look.deletePinArea(widgets.slice().reverse())
        node.look.checkDuplicatePins()
        if (widgets.some(widget => widget.prompt)) node.prompts.markDirty()

        // reset the selection
        view.selection.reset()
    },
    redo({view, node, widgets, pos, wids, pads, what}) {

        // bring the widgets back
        node.look.restoreWidgetsToPinArea(widgets, pos)
        widgets.forEach((widget, index) => { widget.wid = wids[index] })

        // add the pads or the adjust the rx/tx tables
        if (node.is.source) node.rxtxAddPinArea(widgets)
        else for (const pad of pads) node.restorePad(pad)

        // set as selected
        view.selection.reset()
        view.selection.pinAreaSelect(widgets)
        view.selection.what = what
        node.look.checkDuplicatePins()
        if (widgets.some(widget => widget.prompt)) node.prompts.markDirty()
    }
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
