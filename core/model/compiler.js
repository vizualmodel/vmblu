import {ModelMap} from './model-map.js'
import {ModelBlueprint} from './blueprint.js'
import {GroupNode, SourceNode} from '../node/index.js'
import {FactoryMap} from './factory-map.js'
import {CompilerWrite} from './compiler-write.js'
import {CompilerRead} from './compiler-read.js'


export function ModelCompiler( UID ) {

    // All the models referenced in the model files 
    this.models = new ModelMap()

    // All the factories referenced in the model files
    this.factories = new FactoryMap()

    // the model stack is used when reading files - it prevents circular references
    this.stack = []

    // set the uid generator (if any)
    this.UID = UID
}
ModelCompiler.prototype = {

// reset the compiler - keep the UID
reset() {

    // reset the factory map
    this.factories.reset()

    // reset
    this.models.reset()

    // reset the stack
    this.stack.length = 0
},

resetFresh() {
    for (const model of this.models.map.values()) model.is.fresh = false
},

// some functions that manipulate the stack - returns false if the node is already on the stack !
pushCurrentNode(model, rawNode) {

    // get the name
    const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock

    // if the uid is already on the stack, this means that there is a risk of an inifinte loop in the construction of the node
    const L = this.stack.length

    // check if the uid is already on the stack
    if (L > 1) for (let i=0; i<L-1; i++) {
        if ( this.stack[i].nodeName === nodeName && this.stack[i].model === model) {

            //console.log(nodeName, model.getArl().userPath)

            return false
        }
    }

    // push the model and the uid on the stack
    this.stack.push({model, nodeName})

    // return true if ok
    return true
},

popCurrentNode() {
    this.stack.pop()
},

// returns the current model on the stack 
getCurrentModel() {
    return this.stack.at(-1).model
},

getMainModel() {
    return this.stack[0].model
},

// finds or adds a model based on the arl
async findOrAddModel(arl) {
    
    // check if we have the model already
    let model = this.models.findArl(arl)

    // check
    if (model) return model

    // it is a new model
    model = new ModelBlueprint(arl)

    // make a key for the model (it is a new model !)
    // model.makeKey()

    // load the model and its dependencies
    await this.getFactoriesAndModels(model)

    // done
    return model
},

// gets the root node of main
async getRoot(model) {

    // load the model and its dependencies
    await this.getFactoriesAndModels(model)

    // build the model
    const root = this.compileNode(model, null)

    // done
    return root
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
        console.log(`Node '${lName}' not found in model ${model.fullPath()}`)
        return null
    }

    // check for an infinite loop
    if (!this.pushCurrentNode(model, rawNode)) {
        console.log(`infinite loop for  '${lName}' in model ${model.fullPath()} `)
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
    const model = (path == null || path === './') ? currentModel : this.models.get(currentModel.getArl().resolve(path).getFullPath())

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

Object.assign(ModelCompiler.prototype, CompilerRead, CompilerWrite)
