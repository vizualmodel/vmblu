import {ModelBlueprint} from './blueprint.js'

export function LibraryManager(tx, sx) {

    // save tx
    this.tx = tx

    // the ref arl
    this.ref = null

    // The library is a model store
    this.libraries = null
}
LibraryManager.prototype = {

    // the library can be empty, but not null
    onSwitchLibrary({ref,libraries}) {

        // check
        if (!libraries || !ref) return

        // set the reference
        this.ref = ref

        // set the library
        this.libraries = libraries
        
        // the nodes to display have to be updated
        this.tx.send("build table", this.libraries.map)
    },

    //*** WE NEED A COMPILER HERE */
    async onAddFile(userPath){

        // check
        if (!this.ref) return

        // make an arl
        const arl = this.ref.resolve(userPath)

        // check
        if (! arl) return console.log(`Could not resolve "${userPath}" to arl`)

        // check if we have already this file...
        let model = this.libraries.findArl( arl )

        // If we do not have the model, load it and add it
        if ( ! model) {

            // create the model
            model = new ModelBlueprint(arl)

            // get the file
            await model.getRaw()

            // add to the map
            this.libraries.add(model)
        }

        // simply set the link as selectable 
        model.setSelectable()

        // the nodes to display have to be updated
        this.tx.send("build table", this.libraries.map)
    },

    onRemoveFile({model}){

        // check
        if (!model) return

        // just set the link non-selectable
        model.is.selectable = false

        // and rebuild the node table..
        this.tx.send("build table", this.libraries.map)
    }
}
