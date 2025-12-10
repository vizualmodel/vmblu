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

    toJSON() {

        // get the key for the link
        const path = (this.model && !this.model.is.main) ? this.model.arl.userPath : './'

        return { path, node: this.lName}
    }
}