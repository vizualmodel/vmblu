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
        this.cookCommon(raw, modcom)

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
}
