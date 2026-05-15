import { selex } from './selection.js';

// a helper function
function canProceed(view) {

    // get the node and the position where to add
    let where = view.selection.whereToAdd();

    // check
    if (!where) return [false, null, null];

    // maybe we have a valid hit position
    if (!where.pos) pos = view.hit.xyLocal

    // check if we can modify the node
    if (where.node.cannotBeModified()) {
        this.blinkToWarn(where.node)
        return [false, null, null];
    }

    // ok
    return [true, where.node, where.pos];
}

// The table with the <ctrl> + key combinations
export const justKeyTable = {

    // add input
    i: (view,tx) => {
        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return;

        // type of pin
        const is = {
            channel: false,
            input: true,
            proxy: node.is.group};

        // add the pin
        view.doEdit(tx,'newPin', { view, node, pos, is });
    },

    // add output
    o: (view,tx) => {
        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return;

        const is = {
            channel: false,
            input: false,
            proxy: node.is.group
        };

        // add an input pin where the click happened
        view.doEdit(tx,'newPin', { view, node, pos, is });
    },

    // add request
    q: (view,tx) => {
        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return;

        // type of pin
        const is = {
            channel: true,
            input: false,
            proxy: node.is.group,
        };

        // add the pin
        view.doEdit(tx,'newPin', { view, node, pos, is });
    },

    // add reply
    r: (view,tx) => {
        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return;

        // type of pin
        const is = {
            channel: true,
            input: true,
            proxy: node.is.group,
        };

        // add the pin
        view.doEdit(tx,'newPin', { view, node, pos, is });
    },

    // add ifName
    f: (view,tx) => {
        //check
        const [ok, node, pos] = canProceed(view);
        if (!ok) return;

        // add an input pin where the click happened
        view.doEdit(tx,'newInterfaceName', { view, node, pos });
    },

    // show the profile
    p: (view,tx) => {
        const pin = view.selection.getSelectedWidget()
        if (!pin.is.pin) return
        view.doEdit(tx,'showProfile', {pin, pos: { x: pin.rect.x, y: pin.rect.y },});
    },

    // show the event
    e: (view,tx) => {
        const pin = view.selection.getSelectedWidget()
        if (!pin.is.pin ) return
        view.doEdit(tx,'showCapability', {pin, pos: { x: pin.rect.x, y: pin.rect.y },});
    },

    // show the tool
    t: (view,tx) => {
        const pin = view.selection.getSelectedWidget()
        if (!pin.is.pin ) return
        view.doEdit(tx,'showCapability', {pin, pos: { x: pin.rect.x, y: pin.rect.y },});
    },

    // add a label
    a: (view,tx) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (!node) return;

        // check if already a lable
        const label = node.look.findLabel();
        if (label) view.doEdit(tx,'widgetTextEdit', { view, widget: label });
        else view.doEdit(tx,'addLabel', { view, node });
    },

    // highlight/unhighlight
    h: (view,tx) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (!node) return;

        // highlight/unhighlight
        view.doEdit(tx,'nodeHighLight', { node });
    },

    '+': (view,tx) => {
        const widget = view.selection.getSelectedWidget();

        // check
        if (!widget || !widget.node ) return;
        if (widget.node.cannotBeModified()) return view.blinkToWarn(widget.node)

        // ok
        view.doEdit(tx,'widgetTextEdit', {view, widget});
    },

    '-': (view,tx) => {
        const widget = view.selection.getSelectedWidget();

        // check
        if (!widget || !widget.node ) return;
        if (widget.node.cannotBeModified()) return view.blinkToWarn(widget.node)

        // start
        view.doEdit(tx,'widgetTextEdit', {view,widget,clear: true});
    },

    // delete the selection or the single node
    Clear: (view,tx) => {
        // get the selected node only if nothing else is selected
        const node =
            view.selection.what == selex.singleNode
                ? view.selection.getSingleNode()
                : null;

        if (node) view.doEdit(tx,'disconnectNode', { node });
        else view.doEdit(tx,'disconnectSelection', { view });
    },

    // delete the selection or the single node
    Delete: (view,tx) => {
        switch (view.selection.what) {
            case selex.nothing:
                break;

            case selex.freeRect:
                view.doEdit(tx,'deleteSelection', { view });
                break;

            case selex.pinArea:
                //check if ok
                const [ok, node, pos] = canProceed(view);
                if (!ok) return;

                view.doEdit(tx,'deletePinArea', {
                    view,
                    node: view.selection.getSingleNode(),
                    widgets: view.selection.widgets,
                });
                break;

            case selex.singleNode:
                // maybe there is a widget selected
                const widget = view.selection.getSelectedWidget();

                // check
                if (!widget) {
                    // get the node, delete and done
                    const node = view.selection.getSingleNode();
                    if (node) view.doEdit(tx,'deleteNode', { view, node });
                    return;
                }

                // check
                if (widget.node.cannotBeModified()) return view.blinkToWarn(widget.node);

                // which pin
                if (widget.is.pin)
                    view.doEdit(tx,'deletePin', { view, pin: widget });
                else if (widget.is.ifName)
                    view.doEdit(tx,'deleteInterfaceName', {
                        view,
                        ifName: widget,
                    });
                break;

            case selex.multiNode:
                view.doEdit(tx,'deleteSelection', { view });
                break;
        }
    },

    Enter: (view,tx) => {
        // if there is a pin selected, we start editing the pin
        const editable = view.selection.getSelectedWidget();
        if (editable) {
            // check
            if (editable.node.cannotBeModified()) return view.blinkToWarn(editable.node)

            // start editing
            view.doEdit(tx,'widgetTextEdit', { view, widget: editable });
        }
    },

    ArrowDown: (view,tx) => {

        const current = view.selection.getSelectedWidget()
        if (!current) return
        const below = view.selection.widgetBelow(current);
        if (below) view.selection.switchToWidget(below);
    },

    ArrowUp: (view,tx) => {

        const current = view.selection.getSelectedWidget()
        if (!current) return
        const above = view.selection.widgetAbove(current);
        if (above) view.selection.switchToWidget(above);
    },

    // undo
    Undo: (view,tx) => tx.send('redox.undo'),

    // redo
    Redo: (view,tx) => tx.send('redox.redo'),

    // escape
    Escape: (view,tx) => {
        view.selection.reset();
    },
};

// The table with the <ctrl> + key combinations
export const ctrlKeyTable = {
    // a new source node
    s: (view,tx) => {
        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        view.doEdit(tx,'newSourceNode', { view, pos: view.hit.xyLocal });
    },

    // a new group node
    g: (view,tx) => {
        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        view.doEdit(tx,'newGroupNode', { view, pos: view.hit.xyLocal });
    },

    // a new bus
    b: (view,tx) => {
        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new floating cable
        view.doEdit(tx,'cableCreate', {view, pos: view.hit.xyLocal, floating: true});
    },

    // copy
    c: (view,tx) => {
        view.selectionToClipboard(tx)
    },

    // a new input pad
    i: (view,tx) => {
        view.doEdit(tx,'padCreate', {view,pos: view.hit.xyLocal,input: true,
        });
    },

    // add a new output pad
    o: (view,tx) => {
        view.doEdit(tx,'padCreate', {view,pos: view.hit.xyLocal,input: false,});
    },

    // paste as link
    l: (view,tx) => {

        // request the clipboard - also set the target, the clipboard can come from another file
        tx.request('clipboard.get')
        .then(({raw}) => {
            // other cases do the standard link operation
            view.doEdit(tx,'pasteFromClipboard', { view,pos: view.hit.xyLocal,raw, asLink: true});
        })
        .catch((error) =>
            console.log('ctrl-l : clipboard get error -> ' + error)
        );
    },

    // paste
    v: (view,tx) => {
        // request the clipboard - also set the target, the clipboard can come from another file
        tx.request('clipboard.get')
        .then(({raw}) => {
            
            // other cases do the standard paste operation
            view.doEdit(tx,'pasteFromClipboard', {view,pos: view.hit.xyLocal, raw, asLink: false});
        })
        .catch((error) =>
            console.log('ctrl-v : clipboard get error -> ' + error)
        );
    },

    // undo
    z: (view,tx) => tx.send('redox.undo'),

    // redo
    Z: (view,tx) => tx.send('redox.redo'),

    // wider
    '+': (view,tx) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (!node) return;

        // make wider
        view.doEdit(tx,'wider', { node });
    },

    // thinner
    '-': (view,tx) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode();
        if (!node) return;

        // make wider
        view.doEdit(tx,'smaller', { node });
    },
};
