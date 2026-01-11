import {Node} from './node.js'
import {GroupNode,Factory, Look} from './index.js'
import {jsonHandling} from './node-source-json.js'
import {convert, jsonDeepCopy} from '../util/index.js'

// A node that implements source code
//export function SourceNode (factory, look, name=null, uid=null) {
export function SourceNode (look=null, name=null, uid=null) {

    name = name ?? 'new'

    // constructor chaining
    Node.call(this, look, name, uid)

    // the type of group
    this.is.source = true,

    // the object to the javascript resource for this node
    this.factory = new Factory(name ? convert.nodeToFactory(name) : '')

    // receiving messages - incoming connections
    this.rxTable = []

    //sending messages - outgoing connections
    this.txTable = []

    // add some stuff to the look if present.
    if (look) look.decorate(this)
}

// implementations for source nodes
const sourceFunctions = {

    // makes a copy of a source node...
    copy(model) {

        // create the new node - without the look !
        const newNode = new SourceNode(null, this.name, this.uid)

        // copy the factory arl
        newNode.factory.copy(this.factory)

        // now create the look
        newNode.look = new Look(this.look.rect)

        // copy the look of this node to the new node
        this.look.copy(newNode)

        // copy the comment
        newNode.prompt = this.prompt ? this.prompt.slice() : null

        // copy the settings
        newNode.sx = this.sx ? jsonDeepCopy(this.sx) : null;

        // if the node has a link copy that too
        newNode.link = this.link ? this.link.copy() : null

        // build the tx rx table
        newNode.rxtxPrepareTables()

        // done - all the pins have been addedd - routes are added elsewhere 
        return newNode
    },

   // returns the arl to be used to get to the source for the node
   getSourceArl(jslib) {

        // if there is a link and the link is a library - take that
        if ( this.link?.model?.is.lib ) return this.link.model.getArl()

        // if there is a current lib (ie a lib where a group was defined) use that
        if (jslib) return jslib.arl

        // if the factory arl has been set explicitely, use that
        if (this.factory.arl) return this.factory.arl

        // if the link is a json file, the source can be found via the index file in the directory of that model
        if (this.link?.model) return this.link.model.getArl().resolve('index.js')
            
        // else we assume the source can be locacted by using the index.js file in the model directory
        return null
    },

    // copy the node as a group node..
    copyAsGroupNode(newName = null) {

        // create a new group node
        const newNode = new GroupNode(null, newName ?? this.name, this.uid)

        // create the new look
        newNode.look = new Look(this.look.rect)

        // copy the look from this node to the new node
        this.look.copyConvert(newNode)

        // add a pad for each pin
        for (const pin of newNode.look.widgets) {

            // only proxies..
            if (!pin.is.proxy) continue

            // add it
            newNode.addPad(pin)
        }

        // done
        return newNode
    },

    // saves the node as a source file
    makeSourceBody() {

        // helper functions
        function formatInterfaceName(name) {
            const underscores = '___________________________________________________________________'
            const textLen = name.length
            return '\n\t//'+ underscores.slice(0, -textLen) + name.toUpperCase()
        }

        // make sure the name of the node has a js compliant name
        const jsName = convert.nodeToFactory(this.name)

        // The header
        const today = new Date()
        let sHeader =      '// ------------------------------------------------------------------'
                        +`\n// Source node: ${jsName}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------'

        // The prompt for the node
        let sPrompt = this.prompt?.length > 0 ? '\n\n/*\n' + this.prompt + "\n*/": ""

        // The constructor
        let sConstructor =    `\n\n//Constructor for ${this.name}`
                            + `\nexport function ${jsName}(tx, sx) {`
                            + '\n}'

        // we make a sorted list of pins - sort according y-value
        this.look.widgets.sort( (a,b) => a.rect.y - b.rect.y)

        // the list of messages that the node can send 
        let sendList = '['

        for (const widget of this.look.widgets) {

            // we also print the interfaceNames
            if (widget.is.ifName) sendList += formatInterfaceName(widget.text)

            // only output proxies need to be handled
            if (( ! widget.is.pin )||( widget.is.input )) continue

            // if the pin has a profile, add it here
            // if (widget.profile?.length > 0) sendList += '\n\n\t// ' + widget.profile 

            // make it clear if the pin has a return-channel
            const symbol = (widget.is.channel) ? '=>' : '->'

            // could be a multi-message
            if (widget.is.multi) {
                const multis = convert.expandMultis(widget.name)
                for(const multi of multis) sendList += `\n\t"${multi} ${symbol}",`
            }
            else sendList += `\n\t"${widget.name} ${symbol}",`
        }
        // close the brackets
        sendList += '\n\t],'

        // the prototype
        let sPrototype =     `\n\n${jsName}.prototype = {`
                            +'\n\n\t// Output pins of the node'
                            +`\n\n\tsends: ${sendList}`
                            +'\n\n\t// Input pins of the node'
                            +'\n\t// For each input pin "a_message" there is a handler "-> a_message" or "=> a_message" (with channel)' 

        // the handlers
        this.look.widgets.forEach( widget => {

            // we also print the interfaceNames
            if (widget.is.ifName) sPrototype += formatInterfaceName(widget.text)

            if ((!widget.is.pin)||(!widget.is.input)) return

            // if the pin has a profile, add it here
            // sPrototype += (widget.profile?.length > 0) ? '\n\t// ' + widget.profile : '\n'

            // make it clear if the pin has a return-channel
            const symbol = (widget.is.channel) ? '=>' : '->'

            // could be a multi-message
            if (widget.is.multi) {
                const multis = convert.expandMultis(widget.name)
                for(const multi of multis) sPrototype += `\n\t"${symbol} ${multi}"({}) {\n\t},`
            }
            else sPrototype += `\n\t"${symbol} ${widget.name}"({}) {\n\t},`
        })
        // the closing bracket
        sPrototype += `\n\n} // ${this.name}.prototype`

        // return the result
        return sHeader + sPrompt + sConstructor + sPrototype
    },

}
Object.assign(SourceNode.prototype, Node.prototype, sourceFunctions, jsonHandling)


