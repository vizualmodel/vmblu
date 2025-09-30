import {editor} from '../editor/index.js'
import {ModelBlueprint} from '../model/index.js'
import {convert} from '../util/index.js'

export const redoxLink = {

cutLink: {

    doit({node}) {

        // check
        if (!node.link) return

        // save the current link
        editor.saveEdit('cutLink',{node, lName: node.link.lName, userPath: node.link.model.arl.userPath})

        // and we simply set the link status
        node.clearLink()

        // now we have to adjust the user paths of the sub-nodes
        node.adjustUserPaths(editor.doc.model.arl)
    },
    undo({node, lName, userPath}) {

       // check
       if (!lName.length)
            node.clearLink()
        else if (userPath.length)
            editor.doc.importFromModel(node, lName, userPath)
        else 
            editor.doc.makeLocalLink(node, lName)
    },
    redo({node, lName, userPath}) {

        // and we add a source or group icon for the node (addIcon removes icons that have the same place !)
        node.clearLink()

        // change references where necessary
        // if (node.nodes) for (const sub of node.nodes) sub.adjustUserPaths( editor.doc.model.arl  )
    }
},

changeLink: {

    async doit({node, lName, userPath}) {

        // trim userPath
        userPath = userPath.trim()

        // trim lName and remove multiple spaces
        lName = convert.cleanLink(lName)

        // make a copy of the original node
        const previous = node.copy()

        // save the current link
        editor.saveEdit('changeLink', {node, previous, lName, userPath})

        // check
        if (!lName.length) {
            node.clearLink()
        }
        else if (userPath.length > 0) {
            await editor.doc.importFromModel(node, lName, userPath)   
            editor.redraw()
        }
        else {
            editor.doc.makeLocalLink(node, lName)
        }
    },
    undo({node, previous, lName, userPath}) {

        // check the icon
        if (!previous.link) previous.is.source ? node.look.addIcon('factory') : node.look.addIcon('group')

        // fuse the node with the previous one
        node.fuse(previous)
    },
    redo({node, previous, lName, userPath}){
        
        // get the node and fuse with the selected node..
        if (!lName.length)
            node.clearLink()
        else if (userPath.length)
            editor.doc.importFromModel(node, lName, userPath)   
        else 
            editor.doc.makeLocalLink(node, lName)
    }
},

saveToLink: {

    doit({node, newName, userPath}) {

        // we need a path to save this node to
        if (! userPath.length > 0) return

        // export the node
        editor.doc.exportToModel(node, newName, new ModelBlueprint( editor.doc.model.arl.resolve(userPath)))
    },
    undo({}) {
    },
    redo({}){  
    }
},

changeFactory: {

    doit({node, newName, userPath}) {

        // copy the old factory
        const oldFactory = node.factory.clone()

        // resolve the input to a new factory arl 
        node.factory?.resolve(newName, userPath, editor.doc.model.arl, node.name)

        // keep the old factory
        editor.saveEdit('changeFactory',{node, oldFactory, newFactory: node.factory})
    },
    undo({node, oldFactory, newFactory}) {

        node.factory = oldFactory
    },
    redo({node, oldFactory, newFactory}){  

        node.factory = newFactory
    }
},

}