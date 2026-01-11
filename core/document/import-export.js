import {ModelCompiler} from '../model/index.js'

export const importExportHandling = {

// the link for a node has changed
async importFromModel(node, lName, userPath) {

    // If no name is given jus give up
    if ((lName.length == 0)||(userPath.length == 0)) return;

    // make an arl
    const arl = this.model.getArl().resolve(userPath)

    // find or add the model
    const model = await this.modcom.findOrAddModel(arl)

    // good or bad - set the changed name/path
    node.setLink(model, lName)

    // check
    if (!model) {

        // error message
        console.log(`importFromModel failed. Model not found - check the file (${userPath}) of the node to link to`)

        // done
        return
    }

    // find and build the node
    const newNode = this.modcom.compileNode(model, lName)

    // check
    if (!newNode) {

        // error message
        console.log(`importFromModel failed. Could not compile '${lName}' from file '${userPath}' (check if there is such a node in the model)`)

        // set the link as bad
        node.linkIsBad()
        
        // done
        return
    }
    // explicitely reset the link as good
    else node.linkIsGood()

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

	// get a model compiler
	const modcom = new ModelCompiler( this.UID )

	// make a copy of the node - keep the uids
	const newNode = node.copy()

	// change the name of the node
	newNode.name = lName

	// change references where necessary
	if (newNode.nodes) for (const sub of newNode.nodes) sub.adjustUserPaths( model.getArl()  )

	// assemble the models and the factories
    newNode.collectFactories(modcom.factories)
    newNode.collectModels(modcom.models)

	// the object to convert and save
	const target = {
		header: model.header,
	}

    // add the libraries if any
    if (modcom.models?.size() > 0) target.imports = modcom.models
    if (modcom.factories?.size() > 0) target.factories = modcom.factories

    // add the root
    target.root = newNode

	// stringify the target
	const json =  JSON.stringify(target,null,4)

	// save the json
	await this.model.getArl().save( json )

	// set the link
	node.setLink(model, lName)

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
    const newNode = this.modcom.compileNode(model, lName)

    // check
    if (!newNode) return null

    // good or bad - set the changed name/path
    newNode.setLink(model, lName)

    //done
    return newNode
},

makeLocalLink(node, lName) {

    // If no name is given
    if (lName.length == 0) return

    // find the local node
    const local = this.view.root.findNode(lName)

    // check
    if (!local) {

        // set the changed name/path
        node.setLink(null, lName)

        // error message
        console.log(`Local link failed. Check the name (${lName}) of the node to link to`)

        // set the link as bad
        node.linkIsBad()
        
        // done
        return
    }

    // make a copy of the local node
    const newNode = local.copy()

    // give the new node a new UID
    newNode.uidChangeAll(this.UID)

    // set the link
    node.setLink(this.model, lName)

    // mark the link as ok
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


}