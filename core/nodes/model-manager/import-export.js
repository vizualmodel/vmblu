import {FactoryMap, ModelMap} from '../../types/model/index.js'
import {Path} from '../../types/arl/index.js'

export const importExportHandling = {

// the link for a node has changed
async importFromModel(node, lName, userPath = null) {

    // If no name is given just give up
    if (lName.length == 0) return;

    // get the model = by default the model is the current model
    let model = this.model

    // make a normalised path
    const normalizedPath = userPath?.length ? Path.normalizeSeparators(userPath) : userPath

    // get the model specified by the path
    if (normalizedPath?.length) {
        // get the arl of the model
        const arl = this.model.getArl().resolve(normalizedPath)

        // find or add the model
        model = await this.modcom.findOrAddModel(arl)
    }

    // good or bad - set the changed name/path
    node.setLink(model, lName, Path.getKind(normalizedPath))

    // check
    if (!model) {
        console.log(`importFromModel failed. Model not found - check the file (${normalizedPath}) of the node to link to`)
        return
    }

    // find and build the node
    const newNode = this.modcom.compileNode(model, lName)

    // check
    if (!newNode) {
        console.log(`importFromModel failed. Could not compile '${lName}' from file '${normalizedPath}' (check if there is such a node in the model)`)
        node.linkIsBad()
        return
    }
    
    // explicitely reset the link as good
    node.linkIsGood()

    // maybe we have to change the type of node..
    if (!node.compatible(newNode)) {

        // change the node into a group or source + transfer all the routes
        const otherType = node.switchNodeType()
        
        // replace the node by the other type node
        this.view.root.swap(node, otherType)

        // change
        node = otherType
    }

    // fuse the existing node with the new one - showing new and zombie pins...
    node.fuse(newNode)
},

// export a node to a model and set the link in the node
async exportToModel(node, lName, model) {

	// if the node is a link nothing to do 
	if (node.link) return

	// make a copy of the node - keep the uids
	const newNode = node.copy()

	// change the name of the node
	newNode.name = lName

	// assemble the models and the factories
    const factories = new FactoryMap()
    const models = new ModelMap()
    newNode.collectFactories(factories)
    newNode.collectModels(models, model)

	// the object to convert and save
	const target = {
		header: model.header,
	}

    // add the libraries if any
    if (models.size() > 0) target.imports = models.all(linkedModel => Path.relative(linkedModel.blu.arl.getFullPath(), model.getArl().getFullPath()))
    if (factories.size() > 0) target.factories = factories.all(factory => factory.makeRaw(model.getArl()))

    // add the root
    target.root = newNode.makeRaw(model.getArl())

	// stringify the target
	const json =  JSON.stringify(target,null,4)

	// save the json
	await model.getArl().save( json )

	// set the link
	node.setLink(model, lName, Path.getKind(model.getArl().relativeTo(this.model.getArl())))

	// if the node has a view, close it
	if (node.is.group && node.savedView) node.savedView.closeView()
},

// nodes from a library are added as links - nodepath = group | group | node 
async nodeFromLibrary(libModel, lName) {

    // If no name is given jus give up
    if ((lName.length == 0)||(!libModel)) return null

    // find or add the model in the compiler
    const model = await this.modcom.findOrAddModel(libModel.arl)

    // check
    if (!model) return null

    // find and build the node
    const newNode = this.modcom.compileNode(model,lName)

    // check
    if (!newNode) return null

    // good or bad - set the changed name/path
    newNode.setLink(model, lName, Path.Kind.Relative)

    //done
    return newNode
},


}
