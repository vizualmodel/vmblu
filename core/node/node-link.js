import {Link} from './link.js'

export const linkHandling = {
    // note that model can be null !
    setLink(model, lName) {

        // change or create a link
        if (this.link) {

            // set the new values
            this.link.model = model
            this.link.lName = lName

            // check the link icon
            this.link.model?.is.lib ? this.look.checkLinkIcon('lock') : this.look.checkLinkIcon('link')
        }
        else {

            // create the link
            this.link = new Link(model, lName)

            // set the icon
            model?.is.lib ? this.look.addIcon('lock') : this.look.addIcon('link')
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

    // change the filenames to filenames relative to the filename of the view (document)
    adjustPaths( newRefArl ) {

        // if the node has a link ...change the link - we do not change the subnodes ! 
        if (this.link) {

            this.link.model.arl.makeRelative( newRefArl )
        }

        // if the node is a source node, change the factory arl if any
        else if (this.factory?.arl) {
            this.factory.arl.makeRelative( newRefArl )
        }

        // there is no link - look at the subnodes
        else if (this.nodes) for( const node of this.nodes) node.adjustPaths( newRefArl )
    },
}