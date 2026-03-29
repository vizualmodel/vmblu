// ------------------------------------------------------------------
// Source node: Clipboard
// Creation date 4/22/2024, 5:20:28 PM
// ------------------------------------------------------------------
import {convert, rndAlfa} from '../../types/util/index.js'
import {selex} from '../../types/view/selection.js'
import {GroupNode} from '../../types/node/index.js'

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

    // the local selection
    this.selection = null

    // The canonical clipboard content is stored as JSON text
    this.json = null    

    // every clipboard has a unique id
    this.uid = ''
}

Clipboard.prototype = {

    // resets the content of the clipboard
    resetContent() {
        this.local = false
        this.json = null
    },

 	// Sets the clipboard to a local selection
	onSet({model,selection}) {

        // check
        if (!selection) return

        // reset the clipboard
        this.resetContent()

        // save the origin
        this.origin = model

        // set local
        this.local = true

        // copy the selection - we do not yet convert it to json
        this.selection = selection.shallowCopy()

        // set the id
        this.uid = rndAlfa(4)

        // notify other possible editors
        this.tx.send('switch')
    },

    async onGet() {

        // if the clipboard is the local one ...
        if ( this.local ) {

            // lazy conversion to canonical JSON text
            if (! this.json) this.json = this.selectionToJson()

            // parse into a fresh raw object for the requestor
            const raw = JSON.parse(this.json)

            // return the content
            this.tx.reply({raw})

            return
        }

        // otherwise request the remote clipboard
        this.tx.request('remote')
        .then( async ({json}) => {

            // parse the json 
            const raw = JSON.parse(json)

            // check
            if (!raw) return

            // send the clipboard to the editor
            this.tx.reply({raw})
        })
        .catch(error => console.log(`Clipboard manager -> remote : ${error}`))
    },

    onLocal() {

        // strange request if the clipboard is not local...
        if (! this.local ) {
            console.log('Warning: clipboard is not local !')
            return
        }

        // if we have not yet converted, convert to the canonical JSON text
        if (! this.json) this.json = this.selectionToJson()

        // send it back to the remote requestor
        this.tx.reply({json: this.json})
    },

    onSwitched() {

        // indicate that the clipboard is remote now
        this.local = false

        // change the uid
        this.uid = rndAlfa(4)
    },

    // convert the selection to canonical JSON text
    selectionToJson() {

        if (!this.origin) return null;

        // notation
        const what = this.selection.what

        // the object to convert and save - for the origin we save the full path 
        const target = {
            uid: this.uid,
            origin: this.origin.fullPath(),
            header: this.origin.header.copyWithoutStyle(),
            what: this.selection.what,
            rect: (what == selex.freeRect) ? this.selection.rect : (what == selex.multiNode || what == selex.singleNode) ? this.selection.nodes[0].look.rect  : {x:0, y:0, h:0, w:0},
            viewPath: this.selection.viewPath,
            root: null,
            widgets: null
        }

        switch(this.selection.what) {

            case selex.ifArea:
            case selex.pinArea:{
                target.widgets = this.selection.widgets.map( widget => widget.makeRaw())
            }
            break

            case selex.freeRect:
            case selex.multiNode:
            case selex.singleNode: {

                // set the root 
                const root = new GroupNode(null, 'clipboard selection', null)

                // set the target
                root.nodes = this.selection.nodes.slice()
                root.buses = this.selection.buses.slice()
                root.pads = this.selection.pads.slice()

                // We have to encode the root
                target.root = root.makeRaw(this.origin.getArl())

                // now we have the root with all the connections and the routes - we have to clean that now
                this.cleanRoutes(target.root)
            }
            break

            default:
                console.log(`unrecognized ${this.selection.what} in clipboard.js`)
                break;
        }

        // done
        return JSON.stringify(target, null, 4)
    },

    // we only keep connections and routes for nodes in the selection (PADS STILL TO DO)
    cleanRoutes(raw) {

        // Only check the top level !
        const findNode = (name) => {
            if (raw.nodes) for (const rawSubNode of raw.nodes) {
                if (rawSubNode.name === name) return rawSubNode
            }
            return null
        }

        const newConnections = []
        if (raw.connections) for (const cx of raw.connections) {
            if (findNode(cx.src.node) && findNode(cx.dst.node)) newConnections.push(cx)
        }

        const newRoutes = []
        if (raw.routes) for (const route of raw.routes) {
            const from = convert.rawToEndPoint(route.from)
            if (from.pin && findNode(from.node)) {

                const to = convert.rawToEndPoint(route.to)
                if (to.pin && findNode(to.node)) newRoutes.push(route)
            }
        }

        raw.connections = newConnections
        raw.routes = newRoutes
    }
} // clipboard manager.prototype
