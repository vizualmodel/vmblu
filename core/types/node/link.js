import {Path} from '../arl/index.js'

export function Link(model, lName, pathKind = Path.Kind.Empty) {

    // The model 
    this.model = model

    //The format of lName is node @ group1 @ group2 ...
    this.lName = lName

    // How this link should be written when saved
    this.pathKind = pathKind

    this.is = {
        bad: false,
    }
}
Link.prototype = {

    copy() {

        const newLink = new Link(this.model, this.lName, this.pathKind)
        return newLink
    },

    getPath(refArl) {

        if (!this.model || this.pathKind === Path.Kind.Empty || this.model.is.main) return ''

        const arl = this.model.getArl()
        if (!arl) return ''
        if (!refArl) return arl.getPath()

        return this.pathKind === Path.Kind.Absolute ? arl.getPath() : Path.relative(arl.getFullPath(), refArl.getFullPath())
    },

    makeRaw(refArl) {

        // get the key for the link
        return { path: this.getPath(refArl), node: this.lName}
    },
}
