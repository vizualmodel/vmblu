import {convert, style} from '../util/index.js'
import {rxtxHandling} from './node-rxtx-table.js'
import {nodeClickHandling} from './node-icon-click.js'
import {collectHandling} from './node-collect.js'
import {linkHandling} from './node-link.js'
import {routeHandling} from './node-routes.js'
import {compareHandling} from './node-compare.js'
//import {nodeWidgetFunctions} from './zzz-node-widget.js'
//import {Link} from './link.js'
import {Look} from './look.js'
import {zap} from '../view/index.js'

// The node in a nodegraph
export function Node (look=null, name=null, uid=null) {

    // unique identifier for the node
    this.uid = uid

    // name of the node - can be changed - not unique
    this.name = name

    // state
    this.is = {
        group: false,
        source: false,
        highLighted: false,
        placed: true,
        duplicate: false
    }

    // if the node is linked to another node
    this.link = null

    // the graphical representation of the node
    this.look = look

    // a node can have settings - settings are passed as is to the new node
    this.sx = null

    // a node can have dynamics - dynamics are passed to the runtime - (to be changed to some fixed format probably)
    this.dx = null

    // comment is an optional text field for the node
    this.prompt = null
}
// common functions
Node.prototype = {

    // render the look of the node
    render(ctx){
        
        // switch to the link style - will return the current style
        const savedStyle = this.link?.model ? style.switch(this.link.model.header.style) : null

        // render the node
        this.look?.render(ctx)

        // reset the style
        if (savedStyle) style.switch(savedStyle)
    },

    // recursively find a node with a given uid
    findByName(name) {

        if (this.name == name) return this
        if (this.nodes) {
            let found = null
            for (const node of this.nodes) if (found = node.findByName(name)) return found
        }
        return null
    },

    // recursively find a node with a given uid
    findByName(name) {

        if (this.name == name) return this
        if (this.nodes) {
            let found = null
            for (const node of this.nodes) if (found = node.findByName(name)) return found
        }
        return null
    },

    // // recursively find a node with a given uid
    // findByUID(uid) {

    //     if (this.uid == uid) return this
    //     if (this.nodes) {
    //         let found = null
    //         for (const node of this.nodes) if (found = node.findByUID(uid)) return found
    //     }
    //     return null
    // },

    // find the parent of a node starting from this node
    findParent(nodeToFind) {
        let parent = this
        if (this.nodes) {
            
            // check if the node is in the nodes list
            for (const node of this.nodes) if (node == nodeToFind) return parent

            // no ... check the nodes
            for (const node of this.nodes) {
                if (node.is.group && (parent = node.findParent(nodeToFind))) return parent
            }
        }
        return null       
    },

    // The name here has not been changed by the user ! (see header for that)
    updateName(newName) {

        // check
        if (!newName || (newName === this.name)) return

        // change the name of the node
        this.name = newName

        // and change the header
        for( const widget of this.look.widgets) {

            if (widget.is.header) {
                widget.title = newName
                break
            }
        }
    },

    // returns node, widget, route, segment
    hitTest(pos) {

        // notation
        const {x,y,w,h} = this.look.rect
        const dx = style.pin.wOutside

        // check if we have hit the look
        if ((( pos.x < x - dx)||(pos.x > x + w + dx)||(pos.y < y )||(pos.y > y+h))) return [zap.nothing,null, null]

        // we check all widgets and return the most precise match - 
        for(const widget of this.look.widgets) {

            // notation
            const rc = widget.rect

            // skip the box
            if (widget.is.box) continue

            // check if in the rectangle
            if (( pos.y < rc.y )||( pos.y > rc.y + rc.h )||( pos.x < rc.x )||( pos.x > rc.x + rc.w )) continue

            // if we have hit the header, but not the title, continue
            if (widget.is.header && ! widget.hitTitle(pos)) continue

            // determine what has been hit 
            const what =    widget == null ? zap.node :
                            widget.is.pin ? zap.pin :
                            widget.is.ifName ? zap.ifName :
                            widget.is.icon ? zap.icon :
                            widget.is.header ? zap.header :
                            widget.is.label ? zap.label :
                            zap.node

            //we have hit something
            return [ what, this, widget]
        }

        // done
        return [zap.node,this, null]
    },

    hitRoute(pos) {

        // check if we have hit a route
        let segment = 0
        for(const widget of this.look.widgets) {

            // only pins with routes !
            if (widget.is.pin && widget.routes.length > 0) {

                // go through all the routes..
                for (const route of widget.routes) {

                    // only routes starting from the widget 
                    if ((route.from == widget)&&(segment = route.hitSegment(pos))) return [zap.route, route, segment]
                }
            }
        }

        // nope
        return [zap.nothing, null, 0]
    },

    overlap(rect) {
        const rc = this.look.rect

        if (( rc.x > rect.x + rect.w) || (rc.x + rc.w < rect.x) || (rc.y > rect.y + rect.h) || (rc.y + rc.h  < rect.y)) return false
        return true
    },

    // returns true if the node is a container node (has no outside connections)
    isContainer() {
        return this.is.group && (this.pads.length == 0)
    },

    // checks if the node is compatible with this node
    compatible( node ) {

        // check that the nodes are compatible, ie are both group nodes or source nodes
        return ( (node.is.group && this.is.group) || (node.is.source && this.is.source) ) 
    },

    // cooks the elements that are common to group and source nodes
    cookCommon(raw) {

        // If there is no editor part, add the skeleton
        // if (!raw.editor) raw.editor = {rect: null}

        // the rectangle as specified in the file - if any
        const rc = raw.rect ? raw.rect : {x:0, y:0, w:0, h:0}

        // set the place bit
        this.is.placed = raw.rect ? true : false

        // create a new look
        this.look = new Look(rc)
        
        // set the minimum height of the look
        this.look.rect.h = style.look.hTop + style.look.hBottom

        // add the basic decoration
        this.look.decorate(this)

        // and cook the saved widgets of the look
        this.look.cook(raw)

        // check the width again - reset the width if it was not zero to start with..
        if (rc.w > 0 && this.look.rect.w > rc.w) this.look.smaller(this.look.rect.w - rc.w)
    
        // check if the node has a comment
        if (raw.prompt) this.prompt = raw.prompt

        // check if the node has settings
        if (raw.sx) this.sx = raw.sx

        // check if the node has dynamics
        if (raw.dx) this.dx = raw.dx
    },

    // used for nodes that have been copied
    uidChangeAll(UID) {

        // make a new uid
        UID.generate(this)

        // for a source node we're done
        if (this.is.source) return

        for(const pad of this.pads) UID.generate(pad)
        for(const bus of this.buses) UID.generate(bus)
        for(const node of this.nodes) node.uidChangeAll(UID)
    },

    // used for nodes that have been imported
    // A group node that is linked must get new UIDS for the objects that were imported
    // The linked nodes inside will have been given new UIDS already - so we skip these !
    uidChangeImported(UID) {

        // change the UIDS in the linked node
        for(const pad of this.pads) UID.generate(pad)
        for(const bus of this.buses) UID.generate(bus)

        // change also for nodes that are not links
        for(const node of this.nodes) if (!node.link) {
            UID.generate(node)
            if (node.is.group) node.uidChangeImported(UID)
        }
    },

    // generates new uids for all nodes, pads and busses
    setUIDS(UID) {

        UID.generate(this)

        if (this.is.source) return

        // generate the UIDS for buses and pads
        for(const pad of this.pads) UID.generate(pad)
        for(const bus of this.buses) UID.generate(bus)
    },


    // get all the source nodes that use a particular factory
    usesFactory(fName, fNodes) {

        this.is.group   ? this.nodes.forEach( node => node.usesFactory(fName, fNodes))
                        : (this.factory?.name == fName) ? fNodes.push(this) 
                        : null
    },

    // move the node over dxy
    move(delta) {

        this.look.moveDelta(delta.x, delta.y)
        this.look.adjustRoutes()
    },

    doSelect() {

        for (const widget of this.look.widgets) {
            if (widget.is.box) {
                widget.is.selected = true
                return
            }
        }
    },

    unSelect() {

        for (const widget of this.look.widgets) {
            if (widget.is.box) {
                widget.is.selected = false
                return
            }
        }
    },

    // avoid that a new node is copied on top of the original
    samePosition(newNode) {

        return ((this.look.rect.x == newNode.look.rect.x) && (this.look.rect.y == newNode.look.rect.y)) 
    },

    // will highlight the link symbol for about a second if the node has a link and cannot be modified
    cannotBeModified() {

        // if the node has no link it can be modified
        if (this.link == null) return false

        // show a blinking link icon
        this.look.blinkToWarn()

        // cannot be modified !
        return true
    },

    // changes the type of node from group to source or vice-versa
    // also transfers the routes from the one to the other
    switchNodeType() {

        // make a new node of a different type
        const newNode = this.is.group ? this.copyAsSourceNode() : this.copyAsGroupNode()

        // swap the nodes and transfer the routes
        this.look.transferRoutes(newNode.look)

        // return the new node
        return newNode
    },

}

Object.assign(  Node.prototype, 
                collectHandling, 
                linkHandling,
                routeHandling, 
                compareHandling,
                rxtxHandling, 
                nodeClickHandling)