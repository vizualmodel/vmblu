import {convert, style} from '../util/index.js'
import {ModelHeader} from './header.js'
import {Path} from '../arl/index.js'
import {ModelMap} from './model-map.js'
import {RawHandling} from './blueprint-raw.js'
import {ProfileHandling} from './blueprint-prf.js'
import {CapabilityHandling} from './blueprint-cap.js'
import {AppHandling} from './blueprint-app.js'
import {TestHandling} from './blueprint-tst.js'
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

    this.entrypoint = {
        arl: null,
        raw: null
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

    // the model in the resource - raw json, but must still be cooked
    this.raw = null;

    // the compiled model
    this.root = null;

    // the save point - raw json
    this.savePoint = null;

    // A freshness stamp for the backing file(s)
    this.stamp = null;

    // profile data extracted from source files, organised per node and pin
    this.sourceProfile = null;
    this.sourceProfileOrigin = null;

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

        // split the name in name, kind and ext
        const split = Path.split(arl.getPath())

        // check the extension
        if (split.ext === '.blu') {
            this.blu.arl = arl
            this.viz.arl = arl.resolve(split.name + (split.kind ?? '') + '.viz')
        }
        else if ((split.ext === '.js') || (split.ext === '.mjs')) {
            this.bundle.arl = arl
        }
    },

    // save as operation
    changeArl(path) {

        let bluPath = ''
        let vizPath = ''

        if (! path?.length) return false;

        const split = Path.split(path)

        if (!split.kind) split.kind = '.mod'

        bluPath = split.name + split.kind + '.blu'
        vizPath = split.name + split.kind + '.viz'

        this.blu.arl = this.blu.arl.resolve(bluPath)
        this.viz.arl = this.viz.arl.resolve(vizPath)

        return true
    },

    makeKey() {
        //this.key = convert.djb2(this.vmblu.arl.getFullPath())
    },

    isFresh() {
        return this.blu.is.fresh || this.viz.is.fresh
    },

    copy() {

        // copy the main arl
        const arl = this.getArl().copy()

        // make a new model
        const newModel = new ModelBlueprint(arl)

        // copy header(full) and raw(ref)
        newModel.header = {...this.header}
        newModel.raw = this.raw
        newModel.stamp = this.stamp

        return newModel
    },

    setRaw(newRaw) {
        this.raw = newRaw
        this.stamp = null
        this.blu.is.dirty = false
        this.viz.is.dirty = false
    },

    reset() {
        this.raw = null
        this.stamp = null
        this.blu.is.dirty = false
        this.blu.is.fresh = false
        this.viz.is.dirty = false
        this.viz.is.fresh = false
        this.libraries.reset()
        this.vmbluTypes = null
        this.sourceProfile = null
        this.sourceProfileOrigin = null
    },

    findRawNode(lName) {

        const errorMessage = (str) => {
            console.log(str)
            return null
        }

        if (!lName) return null

        const rawRoot = this.raw?.root;
        if (! rawRoot) return errorMessage('Model has no root');

        // split and reverse
        const compound = lName.indexOf('@')

        // simple name or compound name
        const found = (compound < 0) ? this.findRawRecursive(rawRoot, lName) : this.findRawInHierarchy(rawRoot, lName)

        return found ? found : errorMessage(`Node '${lName}' not found in model ${this.fullPath()}`);
    },

    // find a node recursively in the raw nodes - we do a breadth first search!
    findRawRecursive(rawRoot, lName) {

        // check the rawRoot first
        if (rawRoot.name == lName) return rawRoot

        if (!rawRoot.nodes) return

        // first search in the list of nodes
        for (const rawNode of rawRoot.nodes) {
            // get the name
            if (lName == rawNode.name) return rawNode
        }

        // now look in the subnodes for each node
        for (const rawNode of rawRoot.nodes) {

            // check if the node is a group node
            if (rawNode.kind == 'group' && rawNode.nodes.length > 0) {

                // if there are sub-nodes, maybe the node is there ?
                const found = this.findRawRecursive(rawNode, lName)
                if (found) return found
            }
        }
        return null
    },

    // we use the compound name of the node
    findRawInHierarchy(root, lName) {

        // name @ group1 @ group2
        const parts = convert.splitLink(lName); // name @ group1 @ group2 => now: ['group2', 'group1', 'name']

        // start in the root and
        let search = root;

        // ..walk through the parts of the name...
        for (const name of parts) {
            search = search.nodes?.find(n => name === n.name);
            if (!search) return null;
        }

        // found
        return search;       
    },

    setSelectable() {
        this.is.selectable = true
    },

    // cook some parts of the model ...
    preCook() {
        if (!this.raw?.header) {
            throw new Error(`Cannot cook model before raw header is loaded: ${this.fullPath() ?? '<unknown model>'}`)
        }
        this.header.cook(this.getArl(), this.raw.header)
        const rawTypes = this.raw?.types
        this.vmbluTypes = typeof rawTypes === 'string' ? JSON.parse(rawTypes) : rawTypes ?? null
    },

    async readStamp() {

        if (this.bundle.arl) return this.bundle.arl.getStamp()

        const bluStamp = await this.blu.arl?.getStamp?.().catch(() => null)
        const vizStamp = await this.viz.arl?.getStamp?.().catch(() => null)

        return `blu:${bluStamp ?? '-'}|viz:${vizStamp ?? '-'}`
    },

    // cookLibraries(arlRef, rawLibs) {

    //     // get the models for the libraries
    //     const newModels = this.libraries.newModels(arlRef, rawLibs)

    //     // add the model to the modellist - the model is not fetched yet 
    //     // this happens at the end when the model is loaded (see library.load)
    //     for(const model of newModels) this.libraries.add(model)
    // },

}

Object.assign(ModelBlueprint.prototype, RawHandling, ProfileHandling, CapabilityHandling, AppHandling, TestHandling, LibHandling)
