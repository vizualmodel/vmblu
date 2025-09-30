import {editor} from '../editor/index.js'
import {selex} from './selection.js'

export const zap = {
    nothing:0,
    node:1,
    pin:2,
    ifName:3,
    icon:4,
    header:5,
    label:6,
    pad:7,
    padArrow:8,
    route:9,
    busSegment:10,
    busLabel:11,
    tack:12,
    selection:13
}

// make a binary bit pattern for the keys that were pressed
export const NONE = 0
export const SHIFT = 1
export const CTRL = 2
export const ALT = 4

// // a bit pattern for the keys that are pushed
// export function keyMask(e) {

//     let mask = NONE

//     mask |= e.shiftKey ? SHIFT : 0
//     mask |= e.ctrlKey ? CTRL : 0
//     mask |= e.altKey ? ALT : 0

//     return mask;
// }

export const mouseHandling = {

    // a bit pattern for the keys that are pushed
    keyMask(e) {

        let mask = NONE

        mask |= e.shiftKey ? SHIFT : 0
        mask |= e.ctrlKey ? CTRL : 0
        mask |= e.altKey ? ALT : 0

        return mask;
    },

    // checks what we have hit inside a client area of a view
    mouseHit(xyLocal) {
        // notation
        const hit = this.hit;

        // if there is an active selection we check if it was hit
        if ( this.selection.what != selex.nothing && this.selection.what != selex.singleNode) {
            [hit.what, hit.selection, hit.node] = this.selection.hitTest(xyLocal)
            if (hit.what != zap.nothing) return 
        }

        // if there is no content we can stop here
        if(!this.root) return 

        // search the nodes (in reverse - most recent nodes first)
        const nodes = this.root.nodes
        for(let i=nodes.length-1; i >= 0; i--) {
            [hit.what, hit.node, hit.lookWidget] = nodes[i].hitTest(xyLocal)
            if (hit.what != zap.nothing) return            
        }

        // search the pads
        for (const pad of this.root.pads) {
            [hit.what, hit.pad] = pad.hitTest(xyLocal)
            if (hit.what != zap.nothing) return
        }
        
        // search the buses
        for(const bus of this.root.buses) {
            [hit.what, hit.bus, hit.busLabel, hit.tack, hit.busSegment] = bus.hitTest(xyLocal)
            if (hit.what != zap.nothing) return
        }

        // check if we have hit a route
        this.mouseHitRoutes(xyLocal)
    },

    mouseHitRoutes(xyLocal) {

        const hit = this.hit

        // search the routes of the nodes 
        for (const node of this.root.nodes) {
            [hit.what, hit.route, hit.routeSegment] = node.hitRoute(xyLocal)
            if (hit.what != zap.nothing) return
        }
 
        // search the pads
        for (const pad of this.root.pads) {
            [hit.what, hit.route, hit.routeSegment] = pad.hitRoute(xyLocal)
            if (hit.what != zap.nothing) return
        }
        
        // search the buses
        for(const bus of this.root.buses) {
            [hit.what, hit.route, hit.routeSegment] = bus.hitRoute(xyLocal)
            if (hit.what != zap.nothing) return
        }
    },

    onDblClick(xyLocal,e) {

        // hit was updated at the first click !
        const hit = this.hit

        // check what was hit
        switch (hit.what) {

            case zap.pin:
            case zap.ifName:

                // check
                if (!hit.node || hit.node.cannotBeModified()) return

                // ok
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget})
                break;

            case zap.header: 
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget})
                break;

            case zap.label:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.lookWidget})
                break;

            case zap.busLabel:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.busLabel})
                break;

            case zap.pad:
                editor.doEdit('widgetTextEdit',{view:this, widget: hit.pad})
                break;
        }
    },
 

    onWheel(xy,e) {

        // notation
        const tf = this.tf

        // we change scale parameter 
        let k = e.deltaY > 0 ? 0.9 : 1.1

        /*  xy is the position of the cursor. It should remain the same in the old and in the new transform

            So if xy' is the position of the cursor in the parent window then:
            xy = tf(xy') = tf"(xy')  or xy' = inverse tf(xy) = inverse tf"(xy)

               xy*s + dx = xy*s*k + d'x  
            => d'x = dx + xy*s - xy*s*k

            note that the inverse tf here is the same as the direct tf for the canvas !
            The canvas transforms are from xy-window to xy-screen, whereas this transform is from 
            xy-window to the next xy-window on the stack.
        */

        // calculate the new tf dx and dy
        tf.dx = tf.dx + xy.x*tf.sx*(1-k)
        tf.dy = tf.dy + xy.y*tf.sy*(1-k)

        // *** this was wrong ***
        //tf.dx = xy.x*(1-k) + k*tf.dx
        //tf.dy = xy.y*(1-k) + k*tf.dy

        // also adjust the scale factors
        tf.sx *= k
        tf.sy *= k
    },
}