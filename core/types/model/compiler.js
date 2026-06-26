import {ModelMap} from './model-map.js'
import {ModelBlueprint} from './blueprint.js'
import {GroupNode, SourceNode, Link} from '../node/index.js'
import {FactoryMap} from './factory-map.js'
import {CompilerMapHandling} from './compiler-maps.js'
import {Path} from '../arl/index.js'

export function ModelCompiler( UID, models ) {

    // Loaded models can be shared by a model manager
    this.models = models ?? new ModelMap()

    // the model stack is used when reading files - it prevents circular references
    this.stack = []

    // set the uid generator (if any)
    this.UID = UID

}
ModelCompiler.prototype = {

// reset the compiler - keep the UID
reset() {
    // reset the stack
    this.stack.length = 0
},

resetFresh() {
    for (const model of this.models.map.values()) {
        model.blu.is.fresh = false
        model.viz.is.fresh = false
    }
},

hasFresh() {
    for(const model of this.models.map.values()) if ( model.blu.is.fresh || model.viz.is.fresh ) return true;
    return false
},

// some functions that manipulate the stack - returns false if the node is already on the stack !
pushCurrentNode(model, rawNode) {

    // get the name
    const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock

    // if the uid is already on the stack, this means that there is a risk of an inifinte loop in the construction of the node
    const L = this.stack.length

    // check if the node to compile is already on the stack
    if (L > 1) for (let i=0; i<L-1; i++) {
        if ( this.stack[i].nodeName === nodeName && this.stack[i].model === model) {
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

    // load the model and its dependencies
    await this.refreshRaw(model)

    // done
    return model
},

// returns a node - or null - based on the name and the model
// the models have been loaded already
compileNode(model, lName) {

    if (!model) return null;

    // find the node in the model
    const rawNode =  model?.findRawNode(lName)

    if (!rawNode) return null;

    return this.compileRawNode(model, rawNode)
},

// returns a node - or null - based on the name and the model
// the models have been loaded already
compileRawNode(model, rawNode) {

    // check 
    if (!rawNode) return null

    // check for an infinite loop
    if (!this.pushCurrentNode(model, rawNode)) {
        console.log(`infinite loop for  '${rawNode.name}' in model ${model.fullPath()} `)
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
    const [path, lName] = [Path.normalizeSeparators(raw.link.path), raw.link.node]

    // get the fullpath of the node
    const currentModel = this.getCurrentModel()

    // check the type of path
    const pathKind = Path.getKind(path)

    // find the model where the link comes from
    let model = pathKind === Path.Kind.Empty ? currentModel : this.models.get(currentModel.getArl().resolve(path).getFullPath())

    // get the node from the link
    const linkedNode = this.compileNode(model, lName)

    // check if ok
    const newNode = linkedNode ? this.goodLink(raw, lName, model, linkedNode, pathKind) : this.badLink(raw, lName, model, pathKind)

    // generate UIDS
    newNode.setUIDS(this.UID)

    // done
    return newNode
},


goodLink(raw, lName, model, linkedNode, pathKind) {

    // create the new node - make it the same type as the linked node
    const dock = linkedNode.is.source ? new SourceNode( null, raw.name) : new GroupNode( null, raw.name)

    // cook the new node using the pins and routes in the file
    dock.cook(raw, this)

    // set the link (after cooking!)
    dock.setLink(model, lName, pathKind)

    // and give unlinked nodes in the subtree also a link
    dock.linkUnlinked(model, pathKind)

    // and now fuse the two nodes to highlight the differences 
    dock.fuse(linkedNode)
    dock.setModelRecursive(this.getCurrentModel())

    // done
    return dock
},

// if we did not find the model, create the node as it was stored - show that the link is bad
badLink(raw, lName, model, pathKind) {

    // create the node as a source node
    const dock = new SourceNode( null, raw.name)

    // and cook the node...
    dock.cook(raw, this)

    // set the link - even if it is bad (after cooking!)
    dock.setLink(model, lName, pathKind)

    // set the link as bad
    dock.linkIsBad()

    // done
    return dock
},

// update all the nodes that have a link
updateLinkedNode(root, node) {

    // check
    if (!node) return false

    const link = node.link
    const isFresh = !!(link?.model && (link.model.blu.is.fresh || link.model.viz.is.fresh))
    const mustRetry = !!(link?.is.bad || isFresh)

    // if raw has been updated (i.e. is fresh), recompile the node
    if (mustRetry) {

        // get the node
        const newNode = link?.model ? this.compileNode(link.model, link.lName) : null

        // check
        if (!newNode) {
            node.linkIsBad()

            // remove stale imported internals for broken linked groups
            if (node.is.group) {
                node.nodes = []
                node.buses = []
                node.pads = []
                node.rxtxBuildTxTable()
            }
            return true
        }

        // the link is valid again
        if (node.link?.is.bad) node.linkIsGood()
        
        // maybe we have to change the type of node..
        if (!node.compatible(newNode)) {

            // change the node into a group or source + transfer all the routes
            const otherType = node.switchNodeType()

            // replace the node by the other type node
            root.swap(node, otherType)

            // change
            node = otherType
        }
        
        // and fuse with the new node
        const ownerModel = node.model
        node.fuse(newNode)
        node.setModelRecursive(ownerModel)

        // build the the rx/tx tables for the imported nodes.
        node.rxtxBuildTxTable()

        // if the node was updated we are done
        return true
    }

    // for group nodes check the subnodes...
    let changed = false
    if (node.nodes) for (const subNode of node.nodes) changed = this.updateLinkedNode(root, subNode) || changed
    return changed
},

// serialize the node 
encode(node, model) {

   if (!node) return null

    const {models, factories} = this.collectDependencies(node, model)

    // the object to encode
    const raw = {
        header: model.header,
    }

    // add the models, factories and libraries
    if (models.size() > 0) raw.imports = models.all( linkedModel => Path.relative(linkedModel.blu.arl.getFullPath(), model.getArl().getFullPath()))
    if (factories.size() > 0) raw.factories = factories.all( factory => factory.makeRaw(model.getArl()))
    if (model.libraries?.size() > 0) raw.libraries = model.libraries.all( lib => Path.relative(lib.blu.arl.getFullPath(), model.getArl().getFullPath()))

    // add the types
    if (model.vmbluTypes) raw.types = model.vmbluTypes

    // set the root
    raw.root = node.makeRaw(model.getArl())

    return raw
},

collectDependencies(node, mainModel) {

    const models = new ModelMap()
    const factories = new FactoryMap()

    node.collectFactories(factories)
    node.collectModels(models, mainModel)

    return {models, factories}
},

}

Object.assign(ModelCompiler.prototype, CompilerMapHandling)
