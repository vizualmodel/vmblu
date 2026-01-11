import {convert} from '../util/index.js'

export const jsonHandling = {

    makeRaw() {
        // get the pins 
        const {rect, label, interfaces} = this.look.makeRaw()
   
        // save as dock or source
        const raw = this.link   ? { kind: "dock", name: this.name, link: this.link.makeRaw(), rect } 
                                : { kind: "source", name: this.name, factory: this.factory.makeRaw(), rect }

        // add if present
        if (label) raw.label = label
        if (this.prompt) raw.prompt = this.prompt
        if (interfaces.length) raw.interfaces = interfaces
        if (this.sx) raw.sx = this.sx
        if (this.dx) raw.dx = this.dx

        // done
        return raw
    },

    // the node is fused with a node linked from another file
    fuse( linkedNode ) {

        // check for added/deleted/changed widgets
        this.widgetCompare(linkedNode)

        // copy the factory
        this.factory.fName = linkedNode.factory.fName
        this.factory.arl = linkedNode.factory.arl ? linkedNode.factory.arl.copy() : null

        // fuse the settings
        this.sxUpdate(linkedNode)

        // because we have cooked the node we have already a rx, tx tables -> reset
        this.rxtxResetTables()

        // and set up the rx tx tables
        this.rxtxPrepareTables()
    },

    // cook specific content for a node that is not a link
    cook(raw, modcom) {

        // cook the common parts
        this.cookCommon(raw)

        // add the factory
        if (raw.factory) {

            // get the main and the current model
            const main = modcom.getMainModel()
            const current = modcom.getCurrentModel()

            // transform the factory file relative to the main model file
            if (raw.factory.path) {
                this.factory.arl = current.getArl()?.resolve( raw.factory.path )
                if (main != current) this.factory.arl.makeRelative(main.getArl())
            }

            // set or overwrite the name
            this.factory.fName = raw.factory.function
        }

        // and set up the rx tx tables
        this.rxtxPrepareTables()
    },

    // Not really json related, but ok...
    // The factory module can contain one or many factories
    xxxanalyzeFactory(fModule) {

        // the entries in the module
        let entries = Object.entries(fModule)

        // find the factory entry in the list
        const entry = entries.find( entry => entry[0] == this.factory.fName )

        // not found 
        if (!entry) return

        // a dummy tx.send function
        const tx = {
            out() {}
        }

        // the factory function
        const factory = entry[1]

        // call the factory to get the actual runtime cell
        let cell = factory.prototype?.constructor === factory ? factory(tx, null) : new factory(tx, null)

        // cycle through the props ....
        for( const prop in cell) {

            if (prop.startsWith("-> ") && typeof cell[prop] == "function") {

                // get the name of the pin (without on)
                const handler = prop.slice(3)

                // get the source of the handler
                const source = cell[prop].toString()

                // find the parameters
                const opbr = source.indexOf('(')
                const clbr = source.indexOf(')')

                // get the profile - without the brackets
                const profile = source.slice(opbr+1, clbr)
                //console.log('<', handler,'>',profile)

                // add the profile to the appropriate widget
                for( const widget of this.look.widgets) {
                    if (widget.is.pin && widget.name == handler) {
                        widget.profile = profile
                    }
                }
            }
        }
    }
}