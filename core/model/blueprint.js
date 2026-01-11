import {convert, style} from '../util/index.js'
import {ModelHeader} from './header.js'
import {Path} from '../arl/index.js'
import {ModelMap} from './model-map.js'
import {ProfileHandling} from './blueprint-prf.js'
import {McpHandling} from './blueprint-mcp.js'
import {AppHandling} from './blueprint-app.js'
import {LibHandling} from './blueprint-lib.js'

export function ModelBlueprint(arl) {
    
    // check if model or library...
    this.is = {
        selectable: false,  // will be set if this model is visible in the select node popup
        main: false,        // set to true for the main model
    }

    this.blu = {
        arl: null,
        is : {
            dirty: false,   // set to true if the model has changed and the file still needs to be synced
            fresh: false    // true if raw has just been updated from file
        }
    }
    this.viz = {
        arl: null,
        is : {
            dirty: false,
            fresh: false
        }       
    }

    this.bundle = {
        arl: null
    }

    this.target = {
        application: null,
        library:null
    }

    // The header of the model
    this.header = new ModelHeader()

    // The libraries that the model can use
    this.libraries = new ModelMap()

    // The types that are used in message contracts in this model
    this.vmbluTypes = null;

    // the model in the resource - json, but must still be cooked
    this.raw = null;

    // the map of the source code for the model, organised per node and pin (it is a map of maps)
    this.sourceMap = null;

    // now analyze the file type and set the arls
    this.analyzeArl(arl)
}
ModelBlueprint.prototype = {

    fullPath() {

        return this.blu.arl ? this.blu.arl.getFullPath() : this.bundle.arl ? this.bundle.arl.getFullPath() : null
    },

    getArl() {
        return this.blu.arl ? this.blu.arl : this.bundle.arl ? this.bundle.arl : null;
    },

    isBlueprint() {
        return this.blu.arl != null;
    },

    isBundle() {
        return this.bundle.arl != null;
    },

    analyzeArl(arl) {

        if(!arl) return

        // split the name in a name and a - possibly double -  extension
        const split = Path.getSplit(arl.userPath)

        // check the extension
        if (split.ext === '.blu.json') {
            this.blu.arl = arl
            this.viz.arl = arl.resolve(split.name + '.viz.json')
        }
        else if ((split.ext === '.js') || (split.ext === '.mjs')) {
            this.bundle.arl = arl
        }
    },

    makeKey() {
        //this.key = convert.djb2(this.vmblu.arl.getFullPath())
    },

    copy() {

        const newModel = new ModelBlueprint(this.arl)

        //newModel.key = this.key ? this.key.slice() : null
        newModel.header = {...this.header}
        newModel.raw = this.raw

        return newModel
    },

    setRaw(newRaw) {
        this.raw = newRaw
        this.blu.is.dirty = false
        this.viz.is.dirty = false
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

    // cook some parts of the model ...
    preCook() {
        this.header.cook(this.getArl(), this.raw.header)
        this.vmbluTypes = this.raw.types ? JSON.parse(this.raw.types) : null;
    },

    // cookLibraries(arlRef, rawLibs) {

    //     // get the models for the libraries
    //     const newModels = this.libraries.newModels(arlRef, rawLibs)

    //     // add the model to the modellist - the model is not fetched yet 
    //     // this happens at the end when the model is loaded (see library.load)
    //     for(const model of newModels) this.libraries.add(model)
    // },

}

Object.assign(ModelBlueprint.prototype, ProfileHandling, McpHandling, AppHandling, LibHandling)
