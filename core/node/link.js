export function Link(model, lName) {

    this.model = model

    //The format of lName is node @ group1 @ group2 ...
    this.lName = lName

    this.is = {
        bad: false,
    }
}
Link.prototype = {

    copy() {

        const newLink = new Link(this.model, this.lName)
        return newLink
    },

    makeRaw() {

        // get the key for the link
        const path = (this.model && !this.model.is.main) ? this.model.getArl().userPath : './'
        return { path, node: this.lName}
    },

    // toJSON() {

    //     // get the key for the link
    //     const path = (this.model && !this.model.is.main) ? this.model.getArl().userPath : './'

    //     return { path, node: this.lName}
    // },

    // unzip() {

    //     // get the key for the link
    //     const path = (this.model && !this.model.is.main) ? this.model.getArl().userPath : './'

    //     return {
    //         blu: { path, node: this.lName},
    //         viz: null
    //     }

    // }
}