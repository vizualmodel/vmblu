export const collectHandling = {

// make the list of factories used by this node
    collectFactories(factories) {

        // if the node has a link, the factory file is not local, so we do not save the factory file
        if (this.link) return

        // get the factory
        if (this.is.source && this.factory.arl != null) {

            // only adds new factories
            factories.add(this.factory)
        }
        
        // get the factories of the other nodes
        if (this.is.group) for (const node of this.nodes) node.collectFactories(factories)
    },

    // make the list of models this file uses as link
    // only do this at the first level - when a model has been found we do not continue for the nodes of this model !
    collectModels(models) {

        // if the node has a link
        if (this.link) {

            // ...add the link to the linklist if required 
            if (this.link.model && !this.link.model.is.main) {

                // and add it to the model list
                models.add(this.link.model)
            }
        }
        else {

            // ...continue for all nodes
            this.nodes?.forEach( node => node.collectModels(models) )
        }
    },

    // if we save the model in a lib we only keep the links to other libs - all the rest is put in the file
    collectModelsForLib(models, main) {

        // if the node is linked to a lib that is different from the lib we are saving to, add it
        if (this.link) {

            // get the model
            const model = this.link.model
        
            // add the model if it is not the main file (it is only added if not yet in the list)
            if ( model &&  !model.getArl().equals(main.arl))  models.add(model)
        }
        else {
            // ...continue for all nodes
            this.nodes?.forEach( node => node.collectModelsForLib(models, main) )
        }
    },

    // get the list of source files that need to be imported
    collectImports(srcImports, lib=null) {

        // for group nodes - loop through all nodes..
        if (this.is.group) {

            // if the node comes from a library then a priori the sources will also come from that library
            if (this.link?.model?.is.lib) lib = this.link.model

            // continue for the nodes..
            for(const node of this.nodes) node.collectImports(srcImports,lib)

            // also collect the routers (if any)
            for (const bus of this.buses) if (bus.hasFilter()) bus.getFilter(srcImports, lib, this.link);

            // done
            return
        }

        // for a source node find the arl to be used for the source - or take the ./index.js file in the directory of the model
        const srcArl = this.getSourceArl(lib) ?? srcImports[0].arl

        // check if the factoryname is already in use somewhere and use an alias if necessary - else just use the name
        const factorySpec = this.factory.duplicate(srcImports, srcArl) ? `${this.factory.fName} as ${this.factory.alias}` : this.factory.fName

        // see if the arl is already in the list
        const found = srcImports.find( srcImport => srcImport.arl.equals(srcArl))

        // if we have the file, add the item there if..
        if (found) {

            // ..it is not already in the list..
            const item = found.items.find( item => item == factorySpec)

            // ..if not add it to the list
            if (!item) found.items.push(factorySpec)
        }
        else {
            // add the file and put the first item on the list
            srcImports.push({arl:srcArl, items:[factorySpec]})
        }
    },

    // build an array of source nodes ** Recursive **
    makeSourceLists(nodeList, filterList) {

        if (this.is.source) {
            nodeList.push(this)
        }
        else {
            // output a warning for bad links
            if (this.link?.is.bad) {
                console.warn(`Group node "${this.name}" is missing. ModelBlueprint "${this.link.model.getArl().userPath}" not found`)
            }
            // output a warning for empty group nodes
            else if (!this.nodes) {
                console.warn(`Group node "${this.name}" is empty`)
            }
            else {

                // add the buses with a router to the array !
                for(const bus of this.buses) {
                    if (bus.is.filter) filterList.push(bus)
                }

                // and the nodes !
                for(const node of this.nodes) node.makeSourceLists(nodeList, filterList)
            }
        }
    },

    // checks if a factory with the same name does already exist and sets the alias if so
    // Note that we only search once ! so if factory and _factory exist we are screwed
    xxxduplicateFactory(srcImports, ownArl) {

        // check for duplicates (same name in different file !)
        const duplicate = srcImports.find( srcImport => {

            // ignore the ownArl of course
            if (srcImport.arl.equals(ownArl)) return false

            // search for 
            return srcImport.items.find( item => item == this.factory.fName)
        })        

        // if the node exist already in a different file...
        if (duplicate) {

            // give a warning
            console.warn(`Duplicate factory name: ${this.factory.fName} is already defined in ${duplicate.arl.userPath}`)

            // make an alias
            this.factory.alias = '_' + this.factory.fName

            // we have a duplicate
            return true
        }
        else {
            // set the alias to null
            this.factory.alias = null

            //no duplicate found...
            return false
        }
    },
}