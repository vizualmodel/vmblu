import {Node} from './node.js'
import {SourceNode, Look} from './index.js'
import {jsonHandling} from './node-group-json.js'
import {proxyHandling} from './node-group-proxy.js'
import {conxHandling} from './node-group-conx.js'
import {eject, jsonDeepCopy, convert} from '../util/index.js'

// default name
export const defaultGroupNodeName = "group"

// A node that groups other nodes
export function GroupNode (look=null, name=defaultGroupNodeName, uid=null) {

    // constructor chaining
    Node.call(this,look,name,uid)

    // state
    this.is.group = true
    
    // the nodes that are part of this group
    this.nodes = []

    // the buses that are part of this group
    this.buses = []

    // inside a group node there is a pad for every outside connection
    this.pads = []

    // we save the view for the group after closing here
    this.savedView = null

    // add the title and the icons..
    if (look) look.decorate(this)
}

// implementations for group nodes
const groupFunctions = {

    // // set these functions to the actual render function required
    // render(ctx){
    //     this.look?.render(ctx) 
    // },

    addNode(newNode) {
        this.nodes.push(newNode)
    },

    // removes a node (not recursive) - we don not touch the connections here - so disconnect first if neccessary !
    removeNode(nodeToRemove) {

        eject(this.nodes, nodeToRemove)
    },

    // restore node is the same as addNode (for now ?)
    restoreNode(node) {
        this.nodes.push(node)
    },

    findNode(lName) {

        // split and reverse
        const parts = convert.splitLink(lName); // name @ group1 @ group2 => now: ['group2', 'group1', 'name']

        // if there is just one name (no group names)
        if (parts.length == 1) return this.findRecursive(lName)  
            
        // we use the group names
        let search = this;

        for (const name of parts) {
            search = search.nodes?.find(n => name === n.name) || null;
            if (!search) return null;
        }

        return search;        
    },

    // find a node of a given name recursively
    findRecursive(search) {

        // search based on the name or the uid
        for (const node of this.nodes) if (node.name == search) return node

        // for the node to search
        let found = null

        // now look in the subnodes for each node
        for (const node of this.nodes) {

            // check if the node is a group node
            if ((node.is.group) && (found = node.findRecursive(search))) return found
        }

        // nope
        return null
    },

    hasDuplicate(nodeToCheck) {

        for (const node of this.nodes) {
            if (node == nodeToCheck) continue
            if (node.name === nodeToCheck.name) return true
        }
        return false
    },

    checkDuplicates(nodeToCheck) {

        nodeToCheck.is.duplicate = false;

        for (const node of this.nodes) {

            // skip the node itself
            if (node == nodeToCheck) continue

            // if the node was a duplicate, check it again
            if (node.is.duplicate) node.is.duplicate = this.hasDuplicate(node)

            // new duplicate
            if (node.name === nodeToCheck.name) nodeToCheck.is.duplicate = node.is.duplicate = true;
        }
    },

    // replaces a node with another node - just replace nothing else (connections, position etc etc)
    // also not recursive - only the nodes array is searched 
    swap(original, replacement) {

        // search
        for (let i=0; i<this.nodes.length; i++) {

            if (this.nodes[i] == original) {

                // found
                this.nodes[i] = replacement 

                // done
                return true
            }
        }

        // now look in the subnodes for each node
        for (const node of this.nodes) {

            // check if the node is a group node
            if ((node.is.group) && (node.swap(original, replacement))) return true
        }
        return false
    },

    // make a copy of a group node
    copy() {

        // make a new node - without the look !
        const newNode = new GroupNode(null, this.name, this.uid)

        // if the node has a link copy that too
        newNode.link = this.link ? this.link.copy() : null

        // now create an empty look
        newNode.look = new Look(this.look.rect)

        // copy the look from this node to the newNode
        this.look.copy(newNode)

        // copy the comment
        newNode.prompt = this.prompt ? this.prompt.slice() : null;

        // copy the settings
        newNode.sx = this.sx ? jsonDeepCopy(this.sx) : null;

        // copy the nodes that are part of this node
        this.nodes?.forEach( node => {

            // make a copy of the node - also copies the widgets
            const copy = node.copy()

            // also copy the routes now from the look, but only to the inputs
            copy.look.copyPinPinRoutes(node.look)

            // and add the copy to the node list
            newNode.addNode( copy )
        })

        // now that we have copied all nodes and the routes between them, we can correct the widgets in the routes between the nodes
        newNode.nodes?.forEach( node => {

            // correct the routes to the inputs and also store them at the relevant outputs
            node.look.correctPinPinRoutes(newNode)
        })

        // copy the pads
        this.pads?.forEach( pad => {

            // copy the pad
            const newPad = pad.copy()

            // copy and correct the pad-pin routes
            newPad.copyPadPinRoutes(pad, newNode)

            // find the corresponding proxy in the new node
            const proxy = newNode.look.widgets.find( w => (w.is.proxy)&&(w.name == pad.proxy.name)&&(w.is.input == pad.proxy.is.input) )

            // set the proxy in the pad
            newPad.proxy = proxy

            // ..and set the pad in the proxy
            proxy.pad = newPad

            // and save the new pad
            newNode.pads.push(newPad)
        })

        // copy the buses
        this.buses?.forEach( bus => {

            // make a clone of the bus
            const newBus = bus.copy()

            // copy the arrows and the routes - set from and to in the copies !
            bus.copyTacks(newBus, newNode)

            // save in the new node..
            newNode.buses.push(newBus)
        })

        // the txrx tables for the copy must be filled in
        newNode.rxtxBuildTxTable()

        // and return the node
        return newNode
    },

    // makes a copy of a node as a source node
    copyAsSourceNode(newName=null) {

        // create the source - without the look
        let source = new SourceNode(null,newName ?? this.name,this.uid)

        source.look = new Look(this.look.rect)

        // copy the look, but convert proxies to pins
        this.look.copyConvert(source)

        // make the rx/tx tables
        source.rxtxPrepareTables()

        // done
        return source
    },

}
Object.assign(GroupNode.prototype,  Node.prototype, groupFunctions, proxyHandling,jsonHandling, conxHandling)
