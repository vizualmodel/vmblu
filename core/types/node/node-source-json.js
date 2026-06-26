import {normalizeFactoryPath} from './factory.js'
import {Path} from '../arl/index.js'

export const jsonHandling = {

    makeRaw(refArl) {
        // get the pins 
        const {rect, label, interfaces} = this.look.makeRaw()
   
        // save as dock or source
        const raw = this.link   ? { kind: "dock", name: this.name, link: this.link.makeRaw(refArl), rect } 
                                : { kind: "source", name: this.name, factory: this.factory.makeRaw(refArl), rect }

        // add if present
        if (label) raw.label = label
        if (this.team) raw.team = this.team
        if (this.promptRepo) raw.promptRepo = this.promptRepo.makeRaw(refArl)
        else if (this.prompt) raw.prompt = this.prompt
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
        this.factory.copy(linkedNode.factory)

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
        const current = modcom.getCurrentModel()

        if (raw.factory) {

            // keep the reference style and resolve to a canonical arl
            const normalized = normalizeFactoryPath(raw.factory.path ?? './index.js')
            this.factory.pathKind = normalized.pathKind
            this.factory.arl = current.getArl()?.resolve(normalized.path)

            // set or overwrite the name
            this.factory.fName = raw.factory.function
        }
        else {
            this.factory.pathKind = Path.Kind.Empty
            this.factory.arl = current.getArl()?.resolve('./index.js')
        }

        // and set up the rx tx tables
        this.rxtxPrepareTables()
    },
}
