import {GroupNode, SourceNode, Look} from '../node/index.js'
import {editor} from '../editor/index.js'


export const nodeHandling = {

    // setting a new root for a view
    syncRoot(newRoot) {

        // construct the rx tx tables
        newRoot.rxtxBuildTxTable()

        // if the root is not placed, place it
        if (!newRoot.is.placed) newRoot.placeRoot();

        // set the root for the view (is always a group node !)
        this.root = this.getContainer(newRoot)

        // If the root has a view, it is the top level view - set the saved transform for it
        if (this.root.savedView?.tf) this.setTransform(this.root.savedView.tf)

        // and now also restore the saved views if any 
        this.restoreSubViews()
    },

    // add a 'container' group
    getContainer(root) {

        // if the root is a container set this as the root for the view - change the name if required
        if (root.isContainer()) return root
 
        // the root is not a container -> create a container group node
        const container = this.initRoot('')

        // save the model root in the container
        container.nodes.push(root)

        // return the root
        return container
     },

    // this is for when we create a new node in the editor
    newEmptyNode(pos, source) {

        // create the look for the node
        const look = new Look( {x:pos.x,y:pos.y,w:0,h:0} )

        // create the node
        const node = source ? new SourceNode(look, '') : new GroupNode(look, '')

        // get the node a UID
        editor.doc.UID.generate(node)

        // add the node to the node graph
        this.root.addNode(node)

        // set the node as selected
        this.selection.singleNode(node)

        // find the header
        const header = node.look.widgets.find( widget => widget.is.header )

        // start the name edit
        this.beginTextEdit(header)

        // we also set the hit position to the start
        this.hit.xyLocal.y = pos.y + header.rect.h

        // done
        return node
    },

}