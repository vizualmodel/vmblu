// ------------------------------------------------------------------
// Source node: Clipboard
// Creation date 4/22/2024, 5:20:28 PM
// ------------------------------------------------------------------
import {convert} from '../util/index.js'
import {selex} from '../view/selection.js'
import {GroupNode} from '../node/index.js'
import {ClipboardRawCook} from './clipboard-raw-cook.js'

/**
 * @node clipboard
 */

//Constructor for clipboard manager
export function Clipboard(tx, sx) {

    // save the transmitter
    this.tx = tx

    // If not local, the clipboard must be requested from other editors - always start with false
    this.local = false

    // The source of the clipboard
    this.origin = null

    // the selection for the clipboard
    this.selection = null
    
    // keeps track of the nr of copies when pasting to make sure copies do not overlap
    this.copyCount = 0
}

Clipboard.prototype = {

    // resets the content of the clipboard
    resetContent() {
        this.local = false
        this.origin = null
        this.selection = null
        this.copyCount = 0
    },

	// Output pins of the node
	sends: [
		'switch',
		'remote',
		'local'
	],

 	// Sets the clipboard to a local selection
	onSet({model, selection}) {

        // check
        if (!model || !selection) return

        // reset the clipboard
        this.resetContent()

        // set local
        this.local = true

        // set the origin of the clipboard
        this.origin = model.copy()

        // copy the selection
        this.selection = selection.shallowCopy()

        // notify other possible editors
        this.tx.send('switch')
    },

    async onGet(doc) {

        // if the clipboard is the local one ...
        if ( this.local ) {

            // ...just return the local clipboard
            //this.tx.reply(this)

            const json = this.onLocal(doc)

            // parse the json 
            const raw = JSON.parse(json)

            // check
            if (!raw) return

            //cook the clipboard - reuse the save compiler
            await this.cook(raw, doc.savecom)

            // send the clipboard to the editor
            this.tx.reply(this)

            return
        }

        // otherwise request the remote clipboard
        this.tx.request('remote')
        .then( async ({json}) => {

            // parse the json 
            const raw = JSON.parse(json)

            // check
            if (!raw) return

            //cook the clipboard - reuse the save compiler
            await this.cook(raw, doc.savecom)

            // send the clipboard to the editor
            this.tx.reply(this)
        })
        .catch(error => console.log(`Clipboard manager -> remote : ${error}`))
    },

    xonGet(doc) {

        // if the clipboard is the local one ...
        if ( this.local ) {

            // ...just return the local clipboard
            this.tx.reply(this)
            return
        }

        // otherwise request the remote clipboard
        this.tx.request('remote')
        .then( async ({json}) => {

            // parse the json 
            const raw = JSON.parse(json)

            // check
            if (!raw) return

            //cook the clipboard - reuse the save compiler
            await this.cook(raw, doc.savecom)

            // send the clipboard to the editor
            this.tx.reply(this)
        })
        .catch(error => console.log(`Clipboard manager -> remote : ${error}`))
    },


    onSwitched() {

        // indicate that the clipboard is remote now
        this.local = false
    },

    // request to get the local clipboard of this editor as a json structure
    onLocal(doc) {

        // strange request if the clipboard is not local...
        if (! this.local ) {
            console.log('Warning: clipboard is not local !')
            return
        }

        // the object to convert and save - for the origin we save the full path 
        const target = {
            origin: this.origin.getArl()?.getFullPath(),
            header: this.origin.header,
            what: this.selection.what,
            rect: this.selection.rect ? convert.rectToString(this.selection.rect) : null,
            viewPath: this.selection.viewPath,
            imports: null,
            factories: null,
            root: null,
            widgets: null
        }

        switch(this.selection.what) {

            case selex.ifArea:
            case selex.pinArea:{
                target.widgets = this.selection.widgets
            }
            break

            case selex.freeRect:
            case selex.multiNode:
            case selex.singleNode: {

                // get the compiler
                const modcom = doc.savecom

                // reset the model compiler
                modcom.reset()

                // set the root 
                target.root = new GroupNode(null, 'clipboard', null),

                // set the target
                target.root.nodes = this.selection.nodes.slice()
                target.root.buses = this.selection.buses.slice()
                target.root.pads = this.selection.pads.slice()

                // assemble the models and the factories
                target.root.collectFactories(modcom.factories)
                target.factories = modcom.factories

                target.root.collectModels(modcom.models)
                target.imports = modcom.models
            }
            break

            default:
                console.log(`unrecognized ${this.selection.what} in clipboard.js`)
                break;
        }

        // make the raw version of the target 
        const raw = this.makeRaw(target)

        // stringify the target
        const json =  JSON.stringify(raw,null,4)
        
        // and send a reply
        // this.tx.reply({json})
        return json
    },



} // clipboard manager.prototype
Object.assign(Clipboard.prototype, ClipboardRawCook)
