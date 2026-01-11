import {convert} from '../util/index.js'
import {Selection,selex} from '../view/selection.js'
import {GroupNode, Look} from '../node/index.js'
import {ModelBlueprint} from './index.js'
import {ARL} from '../arl/index.js'

/**
 * @node clipboard
 */

export const ClipboardRawCook = {


    makeRaw(target) {

        // const target = {

        //     origin: this.origin.arl.getFullPath(),
        //     header: this.origin.header,
        //     what: this.selection.what,
        //     rect: this.selection.rect ? convert.rectToString(this.selection.rect) : null,
        //     viewPath: this.selection.viewPath,
        //
        //     root: null,
        //     imports: null,
        //     factories: null,
        //
        //     widgets: null
        // }

        // If there are only widgets selected...
        if (target.what == selex.ifArea || target.what == selex.pinArea) {
            target.widgets = target.widgets.map( widget => widget.makeRaw())
            return target
        }

        // convert the header style
        target.header.style = target.header.style.rgb

        // We have to encode the root
        target.root = target.root.makeRaw()

        // done
        return target
    },

    // For a remote clipboard, we cook the raw (json) clipboard 
    async cook(raw, modcom) {

        // we have to have at least the document the clipboard is coming from
        if ( ! raw.origin) return false

        // reset the clipboard
        this.resetContent()

        // now we have to resolve the user path to an absolute path
        const arl = new ARL().absolute(raw.origin)

        // create the model
        this.origin = new ModelBlueprint(arl)

        // set the raw field - this is what will be cooked
        this.origin.raw = raw

        // also cook the header
        if (raw.header) this.origin.header.cook(arl, raw.header)

        // get a selection
        this.selection = new Selection()

        // set the viewPath
        this.selection.viewPath = raw.viewPath

        // also get the rectangle if any
        if (raw.rect) this.selection.rect = convert.stringToRect(raw.rect)

        // the type of content in the selection
        this.selection.what = +raw.what

        switch(this.selection.what) {

            case selex.freeRect:
            case selex.multiNode:
            case selex.singleNode: {

                // reset the model compiler
                modcom.reset()

                // cook the clipboard
                const root = await modcom.getRoot(this.origin)

                // check
                if (!root) return false

                // copy
                this.selection.nodes = root.nodes?.slice()
                this.selection.pads = root.pads?.slice()
                this.selection.buses = root.buses?.slice()
            }
            return true

            case selex.ifArea:
            case selex.pinArea: {

                // we need a look and a node to convert the widgets
                const look = new Look({x:0, y:0, w:0, h:0})
                const node = new GroupNode(look)

                // // convert all the widgets
                // for(const strWidget of raw.widgets) {

                //     // convert
                //     const widget = look.cookWidget(node,strWidget)

                //     // check and save
                //     if (widget) this.selection.widgets.push(widget)
                // }

                // new version

                this.selection.widgets = raw.widgets.map( w => {
                    return w.interface ? look.cookInterface(w) : look.cookPin(w)
                })

            }
            return true

            default: 
            return false;
        }
    },
}