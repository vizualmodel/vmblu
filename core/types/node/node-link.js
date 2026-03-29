import {Path} from '../arl/index.js'
import {Link} from './link.js'

export const linkHandling = {
    // note that model can be null !
    setLink(model, lName, pathKind = Path.Kind.Empty) {

        // change or create a link
        if (this.link) {

            // set the new values
            this.link.model = model
            this.link.lName = lName
            this.link.pathKind = pathKind

            // check the link icon
            this.link.model?.is.lib ? this.look.checkLinkIcon('lock') : this.look.checkLinkIcon('link')
        }
        else {

            // create the link
            this.link = new Link(model, lName, pathKind)

            // set the icon
            model?.is.lib ? this.look.addIcon('lock') : this.look.addIcon('link')
        }
    },

    // update unlinked nodes 
    linkUnlinked(model, pathKind, parentLName = this.link?.lName) {

        if (!this.nodes || !parentLName) return

        // Do this also for the nodes that do not have links yet
        for (const node of this.nodes) {

            const lName = `${node.name} @ ${parentLName}`

            if (!node.link) {

                // create the link
                node.link = new Link(model, lName, pathKind)

                // set the icon
                model?.is.lib ? node.look.addIcon('lock') : node.look.addIcon('link')
            }

            // Do the same 
            if (node.nodes) node.linkUnlinked(model, pathKind, lName)
        }
    },

    clearLink() {

        // also remove the link widget
        this.look.removeLinkIcon()

        // and we add a source or group icon for the node (addIcon removes icons that have the same place !)
        this.is.source ? this.look.addIcon('factory') : this.look.addIcon('group')

        // clear the link
        this.link = null
    },

    linkIsBad() {

        // the link is bad
        this.link.is.bad = true

        // show that the link is bad
        this.look.badLinkIcon()      
    },

    linkIsGood() {
        // the link is bad
        this.link.is.bad = false

        // show that the link is bad
        this.look.goodLinkIcon()
    },

    // Path strings are derived on demand from ref + arl, so compiled nodes do not need path mutation.
    adjustPaths( newRefArl ) {
        if (this.nodes) for( const node of this.nodes) node.adjustPaths( newRefArl )
    },

    copyLink() {

        return new Link(this.link.model, this.link.lName, this.link.pathKind)

    }


}
