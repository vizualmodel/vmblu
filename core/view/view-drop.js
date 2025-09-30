import {editor} from '../editor/index.js'
import {ARL} from '../arl/index.js'
import {ModelCompiler, ModelBlueprint} from '../model/index.js'
import {Link} from '../node/index.js'

const drawerFolder = 'drawer/folder'
const drawerFile = 'drawer/file'

export const dropHandling = {

    async onDrop(xyParent, e) {

        // no default action...
        e.preventDefault();

        // transform the parent coordinates to local ones
        let xyLocal = this.localCoord(xyParent)
        
        // check what was hit
        this.mouseHit(xyLocal)
        //this.mouseHit(xyParent, xyLocal) // This is wrong !!!

        // transfer to the view that was hit..
        if (this.hit.view) return this.hit.view.onDrop(xyLocal, e)

        // analyse the dropped data
        const drop = this.analyseDrop(e)

        // check
        if (!drop) return

        // if it can be converted to an arl...
        const arl = new ARL(drop.path)

// RESOLVE 

        // make a model for the dropped arl
        const model = new ModelBlueprint(arl)
        
        // make a compiler
        const modcom = new ModelCompiler( editor.doc.UID )

        // get the file in the drop arl
        const newNode = await modcom.getRoot(model)

        // check
        if ( ! newNode) return null

        // if the node is a container - create a new view for that
        if (newNode.is.group && newNode.isContainer()) {

            // make a reasonable rectangle for the node
            const rect = this.makeViewRect(newNode)
            rect.x = xyLocal.x
            rect.y = xyLocal.y

            // create a new view for the container
            const subView = this.newSubView(newNode, rect)
        }

        // position the node at the drop location
        newNode.look.moveTo(xyLocal.x, xyLocal.y)

        // change the uids as required
        newNode.uidChangeAll(editor.doc.UID)

        // set the link
        newNode.link = new Link(model, this.name)

        // save on the nodes list
        this.root.nodes.push(newNode)

        // do a redraw (we do it here - async function)
        editor.redraw()

        // done
        return newNode
    },

    analyseDrop(e) {

        // convert
        const items =  e.dataTransfer.items ? [...e.dataTransfer.items] : null
        const files =  e.dataTransfer.files ? [...e.dataTransfer.files] : null
        const types =  e.dataTransfer.types ? [...e.dataTransfer.types] : null

        //    //ITEMS
        //    if (items?.length > 0) {
        //         // items ifPins
        //         items.forEach((item, i) => {
        //             console.log('ITEM', item.kind, item)
        //         })          
        //     }

        // FILES 
        if (files?.length > 0) {
            files.forEach((file, i) => {
                // console.log('FILE:', file);
            });
        }

        // TYPES
        if (types?.length > 0) {

            if (types.includes(drawerFile)) {

                // get value and path object
                let drop = JSON.parse(e.dataTransfer.getData(drawerFile))

                // find the path
                return drop
            }
        }

        return null
    },

}