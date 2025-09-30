import {GroupNode, SourceNode} from '../node/index.js'
import {convert} from '../util/index.js'

export const compileFunctions = {

// gets the root node of main
async getRoot(model) {

    // load the model and its dependencies
    await this.getFactoriesAndModels(model)

    // build the model
    const root = this.compileNode(model, null)

    // done
    return root
},

// encodes a node 
encode(node, model) {
    
    if (!node) return null

    // get the factories
    node.collectFactories(this.factories)

    // get the imports
    node.collectModels(this.models)

    // the object to encode
    const target = {
        header: model.header,
    }

    // add the libraries if any
    if (this.models?.size() > 0) target.imports = this.models
    if (this.factories?.size() > 0) target.factories = this.factories
    if (model.libraries?.size() > 0) target.libraries = model.libraries

    // set the root
    target.root = node

    // stringify the target
    const text =  JSON.stringify(target,null,4)

    // return the result
    return text
},

// returns a node - or null - based on the name and the model
// the models have been loaded already
compileNode(model, lName) {

    if (!model) {
        console.log(`No model for node '${lName}' `)
        return null
    }
    
    // find the node in the model
    const rawNode =  lName ? model.findRawNode(lName) : model.raw?.root

    // check 
    if (!rawNode) {
        console.log(`Node '${lName}' not found in model ${model.arl.userPath}`)
        return null
    }

    // check for an infinite loop
    if (!this.pushCurrentNode(model, rawNode)) {
        console.log(`infinite loop for  '${lName}' in model ${model.arl.userPath} `)
        return null
    }

    // cook the raw node - link here is the raw version !
    const node = rawNode.kind == "dock" ? this.linkedNode(rawNode) : this.localNode(rawNode)

    // pop from the stack
    this.popCurrentNode()

    // done
    return node
},

// cook a local node - it can be a group node or a source node
localNode(raw) {

    // create the node
    const newNode = raw.kind == "source" ? new SourceNode( null, raw.name) : new GroupNode(  null, raw.name)

    // and cook the node - note that cook can call localNode / linkedNode again
    newNode.cook(raw, this)

    // generate UIDS
    newNode.setUIDS(this.UID)

    // done
    return newNode
},

// get and cook a linked node
linkedNode(raw) {

    // get the key and the name of the linked node
    const [path, lName] = [raw.link.path, raw.link.node]

    // get the fullpath of the node
    const currentModel = this.getCurrentModel()

    // if there is no file key, it means that the linked node comes from the current file !
    const model = (path == null || path === './') ? currentModel : this.models.get(currentModel.arl.resolve(path).getFullPath())

    // get the node from the link
    const linkedNode = this.compileNode(model, lName)

    // check if ok
    const newNode = linkedNode ? this.goodLink(raw, lName, model, linkedNode) : this.badLink(raw, lName, model)

    // generate UIDS
    newNode.setUIDS(this.UID)

    // done
    return newNode
},

goodLink(raw, lName, model, linkedNode) {

    // create the new node - make it the same type as the linked node
    const dock = linkedNode.is.source ? new SourceNode( null, raw.name) : new GroupNode( null, raw.name)

    // cook the new node using the pins and routes in the file
    dock.cook(raw, this)

    // set the link (after cooking!)
    dock.setLink(model, lName)

    // and now fuse the two nodes to highlight the differences 
    dock.fuse(linkedNode)

    // done
    return dock
},

// if we did not find the model, create the node as it was stored - show that the link is bad
badLink(raw, lName, model) {

    // create the node as a source node
    const dock = new SourceNode( null, raw.name)

    // and cook the node...
    dock.cook(raw, this)

    // set the link - even if it is bad (after cooking!)
    dock.setLink(model, lName)

    // set the link as bad
    dock.linkIsBad()

    // done
    return dock
},

// update all the nodes that have a link
updateNode(node) {

    //console.log(`${node.name} => ${node.link ? (node.link.model.is.fresh ? 'update' : 'no update') : 'no link'}`)

    // check the link
    if (node.link && node.link.is.bad) return

    // if raw has been updated (i.e. is fresh), recompile the node
    if (node.link && node.link.model.is.fresh) {

        // get the node
        const newNode = this.compileNode(node.link.model, node.link.lName)

        // check
        if (!newNode) {
            node.linkIsBad()
            return
        }

        // maybe we have to change the type of node..
        // node = node.compatible(newNode) ? node : this.switchNodeType(node)   
        
        // maybe we have to change the type of node..
        if (!node.compatible(newNode)) {

            // change the node into a group or source + transfer all the routes
            const otherType = node.switchNodeType()

            // replace the node by the other type node
            this.view.root.swap(node, otherType)

            // change
            node = otherType
        }
        
        // and fuse with the new node
        node.fuse(newNode)

        // build the the rx/tx tables for the imported nodes.
        node.rxtxBuildTxTable()

        // if the node was updated we are done
        return
    }

    // for group nodes check the subnodes...
    if (node.nodes) for(const subNode of node.nodes) this.updateNode(subNode);
},


}