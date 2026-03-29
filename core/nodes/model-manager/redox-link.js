import {ModelBlueprint} from '../../types/model/index.js'
import {convert} from '../../types/util/index.js'

export const redoxLink = {

cutLink: {

    doit({node}) {

        // check
        if (!node.link) return

        // save the current link
        this.saveEdit('cutLink',{node, lName: node.link.lName, userPath: node.link.getPath(this.manager.model?.getArl?.())})

        // and we simply set the link status
        node.clearLink()

        // now we have to adjust the user paths of the sub-nodes
        if (this.manager.model) node.adjustPaths(this.manager.model.getArl())
    },
    undo({node, lName, userPath}) {

        // check
        if (!lName.length)
            node.clearLink()
        else 
            this.manager.importFromModel(node, lName, userPath)
    },
    redo({node, lName, userPath}) {

        // and we add a source or group icon for the node (addIcon removes icons that have the same place !)
        node.clearLink()

        // change references where necessary
        // if (node.nodes) for (const sub of node.nodes) sub.adjustUserPaths( editor.doc.model.getArl()  )
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
        this.saveEdit('changeLink', {node, previous, lName, userPath})

        // check
        if (!lName.length) {
            node.clearLink()
        }
        else  {
            await this.manager.importFromModel(node, lName, userPath)
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
        else {
            this.manager.importFromModel(node, lName, userPath)
        }
    }
},

saveToLink: {

    doit({node, newName, userPath}) {

        // we need a path to save this node to
        if (! userPath.length > 0) return

        // export the node
        if (!this.manager.model) return
        this.manager.exportToModel(node, newName, new ModelBlueprint(this.manager.model.getArl().resolve(userPath)))
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
        if (!this.manager.model) return
        node.factory?.resolve(newName, userPath, this.manager.model.getArl(), node.name)

        // keep the old factory
        this.saveEdit('changeFactory',{node, oldFactory, newFactory: node.factory})
    },
    undo({node, oldFactory, newFactory}) {

        node.factory = oldFactory
    },
    redo({node, oldFactory, newFactory}){  

        node.factory = newFactory
    }
},

}
