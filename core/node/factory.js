import {convert} from '../util/index.js'

// name is the name of the javascript generator function
export function Factory (name = null) {

    // the name of the factory
    this.fName = name ?? ''

    // optionally - the file where the factory can be found
    this.arl = null

    // sometimes we will need an alias for the factory name to avoid name clashes
    this.alias = null
}
Factory.prototype = {

    // toJSON() {
    //     return  {   
    //         path: this.arl?.userPath ?? "./index.js", 
    //         function: this.fName
    //     }
    // },

    // unzip() {
    //     return  { blu: {    path: this.arl?.userPath ?? "./index.js", 
    //                         function: this.fName },
    //               viz: null }        
    // },

    makeRaw() {
        return  {   
            path: this.arl?.userPath ?? "./index.js", 
            function: this.fName
        }
    },

    copy(from) {
        this.fName = from.fName
        this.alias = from.alias
        this.arl = from.arl ? from.arl.copy() : null
        //this.key = from.key
    },

    clone() {
        const clone = new Factory()
        clone.copy(this)
        return clone
    },

    resolve(newName, userPath, refArl, fallBack=null) {

        // check the name - if no name use the node name
        if (!newName || newName.length == 0) {
            if (!fallBack || fallBack.length == 0) return
            newName = fallBack
        }

        // change the name if required
        if (newName !== this.fName) this.fName = newName

        // check if the path changed
        if ((this.arl == null) && (!userPath || userPath.length == 0)) return
        if (this.arl?.userPath === userPath) return

        // check
        if (!userPath || userPath.length == 0 ) {
            this.arl = null
            return
        }
        
        // check for completions 
        if (userPath.at(-1) === '/') {
            userPath = userPath + 'index.js'
        }
        else if (userPath.lastIndexOf('.js') < 0) {
            userPath = userPath + '.js'
        }
        
        // resolve 
        this.arl = refArl.resolve(userPath)
    },

    // checks if a factory with the same name does already exist and sets the alias if so
    // Note that we only search once ! so if factory and _factory exist we are screwed
    duplicate(srcImports, ownArl) {

        // check for duplicates (same name in different file !)
        const duplicate = srcImports.find( srcImport => {

            // ignore the ownArl of course
            if (srcImport.arl.equals(ownArl)) return false

            // search for 
            return srcImport.items.find( item => item == this.fName)
        })        

        // if the node exist already in a different file...
        if (duplicate) {

            // give a warning
            console.warn(`Duplicate factory name: ${this.fName} is already defined in ${duplicate.arl.userPath}`)

            // make an alias
            this.alias = '_' + this.fName

            // we have a duplicate
            return true
        }
        else {
            // set the alias to null
            this.alias = null

            //no duplicate found...
            return false
        }
    },
}
