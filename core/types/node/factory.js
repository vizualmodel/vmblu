import {Path} from '../arl/index.js'

export function normalizeFactoryPath(path) {

    if (!path || path.length == 0) return {pathKind: Path.Kind.Empty, path: './index.js'}

    let normalized = path.trim()
    if (normalized.at(-1) === '/') normalized += 'index.js'
    else if (normalized.lastIndexOf('.js') < 0) normalized += '.js'

    const pathKind = Path.getKind(normalized)
    return {pathKind, path: normalized}
}

// name is the name of the javascript generator function
export function Factory (name = null) {

    // the name of the factory
    this.fName = name ?? ''

    // sometimes we will need an alias for the factory name to avoid name clashes
    this.alias = null

    // optionally - the file where the factory can be found
    this.arl = null

    // How this factory path should be written when saved
    this.pathKind = Path.Kind.Empty
}
Factory.prototype = {

    getPath(refArl) {

        if (!this.arl || this.pathKind === Path.Kind.Empty) return './index.js'
        if (!refArl) return this.arl.getPath()

        return this.pathKind === Path.Kind.Absolute ? this.arl.getPath() : Path.relative(this.arl.getFullPath(), refArl.getFullPath())
    },

    makeRaw(refArl) {
        return  {   
            path: this.getPath(refArl), 
            function: this.fName
        }
    },

    copy(from) {
        this.fName = from.fName
        this.alias = from.alias
        this.pathKind = from.pathKind
        this.arl = from.arl ? from.arl.copy() : null
        //this.key = from.key
    },

    clone() {
        const clone = new Factory()
        clone.copy(this)
        return clone
    },

    resolve(newName, path, refArl, fallBack=null) {

        // check the name - if no name use the node name
        if (!newName || newName.length == 0) {
            if (!fallBack || fallBack.length == 0) return
            newName = fallBack
        }

        // change the name if required
        if (newName !== this.fName) this.fName = newName

        const normalized = normalizeFactoryPath(path)
        this.pathKind = normalized.pathKind
        this.arl = refArl.resolve(normalized.path)
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
            console.warn(`Duplicate factory name: ${this.fName} is already defined in ${duplicate.arl.getPath()}`)

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
