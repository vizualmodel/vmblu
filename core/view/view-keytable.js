import {editor} from '../editor/index.js'
import {selex} from './selection.js'

// a helper function
function canProceed(view) {

    // get the node and the position where to add
    const [node, pos] = view.selectedNodeAndPosition()

    // check
    if (!node || !pos) return [false, null, null]

    // check if we can modify the node
    if (node.cannotBeModified()) return [false, null, null]

    // ok
    return [true, node, pos]
}

// The table with the <ctrl> + key combinations
export const justKeyTable = {

    // add input
    i: (view) => {

        //check
        const [ok, node, pos] = canProceed(view)
        if (!ok) return

        // type of pin
        const is = {	
            channel: false, 
            input: true, 
            proxy: node.is.group 
        }

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is})
    },

    // add output
    o: (view) => {

        //check
        const [ok, node, pos] = canProceed(view)
        if (!ok) return

        const is = {	
            channel: false, 
            input: false, 
            proxy: node.is.group
        }

        // add an input pin where the click happened
        editor.doEdit('newPin',{view, node, pos, is})
    },

    // add request
    q: (view) => {

        //check
        const [ok, node, pos] = canProceed(view)
        if (!ok) return

        // type of pin
        const is = {	
            channel: true, 
            input: false, 
            proxy: node.is.group
        }

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is})
    },

    // add reply
    r: (view) => {

        //check
        const [ok, node, pos] = canProceed(view)
        if (!ok) return

        // type of pin
        const is = {	
            channel: true, 
            input: true, 
            proxy: node.is.group
        }

        // add the pin
        editor.doEdit('newPin',{view, node, pos, is})
    },

    // add ifName
    p: (view) => {

        //check
        const [ok, node, pos] = canProceed(view)
        if (!ok) return

        // add an input pin where the click happened
        editor.doEdit('newInterfaceName',{view, node, pos})
    },

    // add a label
	a: (view) => {

        // get the selected node (only one !)
        const node = view.selection.getSingleNode()
        if (! node ) return

        // check if already a lable
        const label = node.look.findLabel()
        if (label) 
            editor.doEdit('widgetTextEdit',{view, widget: label})
        else 
            editor.doEdit('addLabel',{node})
    },

    // highlight/unhighlight
    h: (view) => {
        // get the selected node (only one !)
        const node = view.selection.getSingleNode()
        if (! node ) return

        // highlight/unhighlight
	    editor.doEdit('nodeHighLight', {node})
    },

    '+': (view) => {

        const widget = view.selection.getSelectedWidget()

        // check
        if (!widget || !widget.node || widget.node.cannotBeModified()) return;

        // ok
        editor.doEdit('widgetTextEdit',{view, widget, cursor:-1})
    },

    '-': (view) => {

        const widget = view.selection.getSelectedWidget()

        // check
        if (!widget || !widget.node || widget.node.cannotBeModified()) return;

        // start 
        editor.doEdit('widgetTextEdit',{view, widget, cursor:0, clear:true})
    },

    // delete the selection or the single node
    'Clear': (view) => {

        // get the selected node only if nothing else is selected
        const node = view.selection.what == selex.singleNode ? view.selection.getSingleNode() : null

        if (node) 
            editor.doEdit('disconnectNode',{node})
        else
            editor.doEdit('disconnectSelection', {view})
    },

    // delete the selection or the single node
    'Delete': (view) => {

        switch(view.selection.what) {

            case selex.nothing:
                break

            case selex.freeRect:
                editor.doEdit('deleteSelection', {view})
                break

            case selex.pinArea:

                //check if ok
                const [ok, node, pos] = canProceed(view)
                if (!ok) return

                editor.doEdit('deletePinArea',{ view,
                                                node: view.selection.getSingleNode(), 
                                                widgets: view.selection.widgets})
                break

            case selex.singleNode:
                
                // maybe there is a widget selected
                const widget = view.selection.getSelectedWidget()

                // check
                if (!widget) {

                    // get the node, delete and done
                    const node = view.selection.getSingleNode()
                    if (node) editor.doEdit('deleteNode',{node});
                    return
                }

                // check
                if (widget.node.cannotBeModified()) return

                // which pin
                if (widget.is.pin) 
                    editor.doEdit('deletePin',{view, pin: widget})
                else if (widget.is.ifName) 
                    editor.doEdit('deleteInterfaceName',{view, ifName: widget})
                break

            case selex.multiNode:
                editor.doEdit('deleteSelection', {view})
                break

        }
    },

    'Enter': (view) => {

        // if there is a pin selected, we start editing the pin
        const editable = view.selection.getSelectedWidget()
        if (editable) {

            // check
            if (editable.node.cannotBeModified()) return

            // start editing
            editor.doEdit('widgetTextEdit',{view, widget: editable})
        }
    },

    'ArrowDown': (view) => {
       const below = view.selection.widgetBelow()
       if (below) view.selection.switchWidget(below)
    },

    'ArrowUp': (view) => {
       const above = view.selection.widgetAbove()
       if (above) view.selection.switchWidget(above)
    },

    // undo
    'Undo': (view) => editor.undoLastEdit(),

    // redo
    'Redo': (view) => editor.redoLastEdit(),

    // escape 
    'Escape' : (view) => { view.selection.reset()}
}

// The table with the <ctrl> + key combinations
export const ctrlKeyTable = {

    // a new source node
    s: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        editor.doEdit('newSourceNode',{view, pos: view.hit.xyLocal})
    },

    // a new group node
    g: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new source node
        editor.doEdit('newGroupNode',{view, pos: view.hit.xyLocal})
    },

    // a new bus
    b: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new busbar
        editor.doEdit('busCreate',{view, pos: view.hit.xyLocal, cable:false})
    },

    // a new bus
    k: (view) => {

        // only do this if there is no selection
        // if (view.selection.what != selex.nothing) return

        // create a new cable
        editor.doEdit('busCreate',{view, pos: view.hit.xyLocal, cable:true})
    },

    // copy
    c: (view) => {
        editor.doEdit('selectionToClipboard', {view})
    },

    // a new input pad
    i: (view) => {
        editor.doEdit('padCreate', {view,pos: view.hit.xyLocal, input:true})
    },

    // add a new output pad
    o: (view) => {
        editor.doEdit('padCreate', {view,pos: view.hit.xyLocal, input:false})
    },

    // paste as link
    l: (view) => {

       // request the clipboard - also set the target, the clipboard can come from another file
       editor.tx.request('clipboard get',editor.doc).then( clipboard => {

            // get the type of selection
            const what = clipboard.selection.what

            // if there is nothing , done
            if (what == selex.nothing) return

            // link pin area paste operation is not defined 
            if (what == selex.pinArea) return

            // other cases do the standard link operation
            editor.doEdit('linkFromClipboard',{view, pos: view.hit.xyLocal, clipboard})
        })
        .catch( error => console.log('ctrl-l : clipboard get error -> ' + error))
    },

    // paste
    v: (view) => {

        // request the clipboard - also set the target, the clipboard can come from another file
        editor.tx.request('clipboard get',editor.doc).then( clipboard => {

            // get the type of selection
            const what = clipboard.selection.what

            // if there is nothing , done
            if (what == selex.nothing) return

            // The pin area paste operation is defined elsewhere..
            if (what == selex.pinArea) {
                editor.doEdit('pasteWidgetsFromClipboard', {view, clipboard})
                return
            }

            // other cases do the standard paste operation
            editor.doEdit('pasteFromClipboard',{view, pos: view.hit.xyLocal, clipboard})
        })
        .catch( error => console.log('ctrl-v : clipboard get error -> ' + error))
    },

    // undo
    z: (view) => editor.undoLastEdit(),

    // redo
    Z: (view) => editor.redoLastEdit(),

    // wider
    '+': (view) => {

        // get the selected node (only one !)
        const node = view.selection.getSingleNode()
        if (! node ) return

        // make wider
        editor.doEdit('wider', {node})
    },

    // thinner
    '-': (view) => {
        
        // get the selected node (only one !)
        const node = view.selection.getSingleNode()
        if (! node ) return

        // make wider
        editor.doEdit('smaller', {node})
    },
}