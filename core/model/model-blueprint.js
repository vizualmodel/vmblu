import {convert} from '../util/index.js'
import {ModelHeader} from './header.js'
import {Path} from '../arl/index.js'
import {ModelStore} from './model-store.js'
import {sourceMapHandling} from './model-source-doc.js'

export function ModelBlueprint(arl) {
    
    // get the extension of the path
    const ext = Path.getExt(arl.userPath)

    // check if model or library...
    this.is = {
        // the model can be in a blueprint..
        blu : (ext =='vmblu' || ext == 'json') ? true : false,

        //..or in a compiled library
        lib : (ext == 'js'  || ext == 'mjs')  ? true : false,

        // will be set if this model is visible in the select node popup
        selectable: false,

        // set to true if the model has changed and the file still needs to be synced
        dirty: false,

        // set to true for the main model
        main: false,

        // true if raw has just been updated
        fresh: false,
    }

    // where the resource is
    this.arl = arl

    // the key is used to access the model map
    this.key = null

    // The header of the model
    this.header = new ModelHeader()

    // The libraries that the model can use
    this.libraries = new ModelStore()

    // the model in the resource - json, but must still be cooked
    this.raw = null

    // the map of the source code for the model, organised per node and pin (it is a map of maps)
    this.sourceMap = null
}
ModelBlueprint.prototype = {

    toJSON() {

        return this.arl.userPath
    },

    makeKey() {
        this.key = convert.djb2(this.arl.getFullPath())
    },

    checkType() {
        const ext = Path.getExt(this.arl.userPath)

        this.is = {
            blu : (ext == 'vmblu' || ext == 'json') ? true : false,
            lib : (ext == 'js'    || ext == 'mjs') ? true : false,
        }
    },

    copy() {

        const newModel = new ModelBlueprint(this.arl)

        newModel.key = this.key ? this.key.slice() : null
        newModel.header = {...this.header}
        newModel.raw = this.raw

        return newModel
    },

    findRawNode(lName) {

        const root = this.raw?.root;
        if (!root) return null;

        // split and reverse
        const parts = convert.splitLink(lName); // name @ group1 @ group2 => now: ['group2', 'group1', 'name']

        // if there is just one name (no group names) look in all groups...
        if (parts.length == 1) {
            if (lName == root.name) return root
            return root.nodes ? this.findRawRecursive(root.nodes, lName) : null;
        }

        // we use the group names
        let search = root;

        // walk through the parts of the name...
        for (const name of parts) {

            search = search.nodes?.find(n => name === n.name);
            if (!search) return null;
        }

        return search;
    },

    // find a node recursively in the raw nodes - we do a breadth first search!
    findRawRecursive(nodes, name) {

        // first search in the list of nodes
        for (const rawNode of nodes) {
            // get the name
            if (name == rawNode.name) return rawNode
        }

        // now look in the subnodes for each node
        for (const rawNode of nodes) {

            // check if the node is a group node
            if (rawNode.kind == 'group' && rawNode.nodes.length > 0) {

                // if there are sub-nodes, maybe the node is there ?
                const found = this.findRawRecursive(rawNode.nodes, name)
                if (found) return found
            }
        }
        return null
    },

    setSelectable() {
        this.is.selectable = true
    },

    // gets the raw content of a model - not recursive !
    async fetch() {

        // if the linked file is a .js file - it is a library
        let raw = null
        if (this.is.lib) {

            const rawCode = await this.arl.get('text')
            .catch( error => {
                console.error(`${this.arl.userPath} is not a valid library file`, error)
            })

            //check
            if (!rawCode) return null

            // transform the text into json
            raw = this.analyzeJSLib(rawCode)

            // error if failed
            if (! raw) console.error(`Model not found in library file: ${this.arl.userPath}`)

            // we are done 
            return raw
        }

        // if the extension is json it is another node file
        if (this.is.blu) {

            // read the file - returns the body or throws an error
            raw = await this.arl.get('json')
            .catch( error => {
                console.error(`${this.arl.getFullPath()} is not a valid model file}`, error)
            })

            // done
            return raw
        }
        
        // it's one or the other !
        console.error(`${this.arl.userPath} is not a model nor a library file`)

        return null
    },

    // get the source and cook the header
    async getRaw() {

        // fetch
        this.raw = await this.fetch()

        // check
        if ( this.raw?.header ) this.header.cook(this.arl, this.raw.header)

        // raw is fresh
        this.is.fresh = true

        // return the raw
        return this.raw
    },

    addRawLibraries(arlRef, rawLibs) {

        // get the models for the libraries
        const newModels = this.libraries.newModels(arlRef, rawLibs)

        // add the model to the modellist - the model is not fetched yet 
        // this happens at the end when the model is loaded (see library.load)
        for(const model of newModels) this.libraries.add(model)
    },

    // Finds the model text in the library file...
    analyzeJSLib(rawCode) {

        // find the libname in the code
        let start = rawCode.indexOf('"{\\n')
        let end = rawCode.indexOf('\\n}";', start)

        // check
        if (start < 0 || end < 0) return null

        // get the part between starting and ending bracket
        let rawText = rawCode.slice(start+1,end+3)

        // allocate an array for the resulting text
        const cleanArray = new Array(rawText.length)
        let iClean = 0
        let iRaw = 0

        // remove all the scape sequences
        while (iRaw < rawText.length) {

            // get the first character
            const char1 = rawText.charAt(iRaw++)

            // if not a backslash, just copy
            if (char1 != '\\') {
                cleanArray[iClean++] = char1
            }
            else {

                // get the character that has been escaped 
                const char2 = rawText.charAt(iRaw++)

                // handle the different escape sequences
                if (char2 == 'n') 
                    cleanArray[iClean++] = '\n'
                else if (char2 == '"') 
                    cleanArray[iClean++] = '"'
            }
        }

        // combine all characters into a new string
        const cleanText = cleanArray.join('')

        // and parse
        return JSON.parse(cleanText)
    }
}

Object.assign(ModelBlueprint.prototype, sourceMapHandling)