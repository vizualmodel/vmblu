import {style} from '../util/index.js'
import {GroupNode, Look, Route} from '../node/index.js'

export const alignHandling = {

    // calculates the rectangle for a nice row: position, size and space between the nodes
    calcRow(slct) {
        // sort the array for increasing x
        slct.sort( (a,b) => a.look.rect.x - b.look.rect.x)

        // constant for minimal seperatiion
        const minSpace = style.selection.xPadding

        // set the initial position
        let {x,y} = {...slct[0].look.rect}

        // we can also calculate the new total width
        let last = slct.length - 1
        let w = slct[last].look.rect.x + slct[last].look.rect.w - slct[0].look.rect.x
        let h = 0
        let wNodes = 0

        // Find the tallest look and the total width of the looks
        slct.forEach( node =>  {
            h = Math.max(h, node.look.rect.h)
            wNodes += node.look.rect.w
        })

        // calculate the space between the looks
        let space = (w - wNodes)/last

        // adjust if not ok
        if (space < minSpace) {
            space = minSpace
            w = wNodes + last * minSpace
        }

        // return the results
        return {x,y,w,h,space}
    },

    // calculate the rectangle for a nice column: position, size and space between nodes
    calcColumn(slct) {
        // sort for increasing y
        slct.sort( (a,b) => a.look.rect.y - b.look.rect.y)

        // constant for minimal seperation
        const minSpace = style.selection.yPadding

        // set the initial position
        let {x,y} = {...slct[0].look.rect}

        // we can also calculate the new total height
        let last = slct.length - 1
        let w = 0
        let h = slct[last].look.rect.y + slct[last].look.rect.h - slct[0].look.rect.y
        let hNodes = 0

        // get the size of the widest look and also add up all the heights 
        slct.forEach( node =>  {
            w = Math.max(w, node.look.rect.w)
            hNodes += node.look.rect.h
        })

        // calculate the space between the nodes
        let space = (h - hNodes)/last

       // adjust if not ok
       if (space < minSpace) {
            space = minSpace
            h = hNodes + last * minSpace
        }

        // return the results
        return {x,y,w,h,space}
    },

    // calculates the rectangle for a list of nodes
    calcRect(node) {

        const firstRect =  node.nodes.length > 0 ? node.nodes[0].look.rect : node.pads[0].rect

        // initialize
        const min = {x:firstRect.x, y:firstRect.y}
        const max = {x:firstRect.x + firstRect.w, y:firstRect.y + firstRect.h}
        let rc = null
        
        // go through the list of nodes 
        node.nodes.forEach( node => {

            //notation
            rc = node.look.rect

            // find min x and y
            min.x = Math.min(min.x, rc.x)
            min.y = Math.min(min.y, rc.y)

            // find max x and y
            max.x = Math.max(max.x, rc.x + rc.w)
            max.y = Math.max(max.y, rc.y + rc.h)
        })

       // go through the list of pads
       node.pads.forEach( pad => {

            //notation
            rc = pad.rect

            // find min x and y
            min.x = Math.min(min.x, rc.x)
            min.y = Math.min(min.y, rc.y)

            // find max x and y
            max.x = Math.max(max.x, rc.x + rc.w)
            max.y = Math.max(max.y, rc.y + rc.h)
        })

        // return the rectangle
        return {x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y}
    },    

    // Nodes Align Horizontal Deltas - calculate the x deltas to allign each node in the selection
    nodesAlignHD(nodes, left=true) {

        // the deltas
        const deltas = []

        // calculate the column parameters
        const col = this.calcColumn(nodes)

        // calculate the deltas for each node
        for (const node of nodes) {

            // notation
            const rc = node.look.rect

            // left or right ?
            const dx = left ? (col.x - rc.x) : (col.x + col.w - rc.x - rc.w)

            // keep track of the deltas
            deltas.push({x:dx, y:0})
        }

        //done 
        return deltas
    },

    // calculate the y deltas to allign each node in the selection
    nodesAlignVD(nodes) {

        // the deltas
        const deltas = []

        // calculate the parameters for the row (x,y,w,h,space)
        const row = this.calcRow(nodes)

        // calculate the deltas for each node
        for (const node of nodes) {

            // keep track of the deltas
            deltas.push({x:0, y: row.y - node.look.rect.y})
        }

        //done 
        return deltas
    },

    // the vertical deltas for spacing the nodes evenly
    nodesSpaceVD(nodes) {

        // the deltas
        const deltas = []

        // calculate the column parameters
        const col = this.calcColumn(nodes)

        // The first node starts here
        let nextY = col.y

        for (const node of nodes) {

            // notation
            const rc = node.look.rect

            // save the delta
            deltas.push({x:0, y: nextY - rc.y})

            // calculate the next y 
            nextY = nextY + rc.h + col.space
        }

        // done
        return deltas
    },

    // the vertical deltas for spacing the nodes evenly
    nodesSpaceHD(nodes) {

        // the deltas
        const deltas = []

        // calculate the column parameters
        const row = this.calcRow(nodes)

        // The first node starts here
        let nextX = row.x

        for (const node of nodes) {

            // notation
            const rc = node.look.rect

            // save the delta
            deltas.push({x: nextX - rc.x, y: 0})

            // calculate the next x
            nextX = nextX + rc.w + row.space
        }

        // done
        return deltas
    },

    padsAlignHD(pads, left=true) {

        // save all the deltas
        const deltas = []
    
        // sort the pads according to y-value
        pads.sort( (a,b) => a.rect.y - b.rect.y)
    
        // the first pad is the reference pad
        const rcRef = pads[0].rect
    
        // adjust the other pads to the ref pad
        for (const pad of pads) {

            // notation
            const rc = pad.rect
    
            // calculate the delta
            const dx = left ? (rcRef.x - rc.x) :  (rcRef.x + rcRef.w - rc.x - rc.w)
    
            // save the delta 
            deltas.push({x:dx, y:0})
        }

        // done
        return deltas
    },

    padsSpaceVD(pads) {

        // the deltas
        const deltas = []

        // sort the pads according to y-value
        pads.sort( (a,b) => a.rect.y - b.rect.y)

        // the first pad is the reference pad
        const yStart = pads[0].rect.y

        // we also space the pads equally 
        let dy = (pads.at(-1).rect.y - pads[0].rect.y)/(pads.length-1)

        // The deltas wrt the ref pad
        let i = 0
        for (const pad of pads)  deltas.push({x:0, y: yStart + (i++)*dy - pad.rect.y})
        
        // done
        return deltas
    },

    // for each node there is a delta - used in undo/redo operations
    moveNodesAndRoutes(nodes, deltas, back=false) {

        // do the nodes..
        const N = nodes.length
        let dx = 0
        let dy = 0
        for (let i=0; i<N; i++) {

            // for the undo operation back = true
            dx = back ? -deltas[i].x : deltas[i].x
            dy = back ? -deltas[i].y : deltas[i].y            

            nodes[i].look.moveDelta(dx, dy)
            nodes[i].look.moveRoutes(dx, dy)
        }
        // we adjust the routes only when all nodes have been moved
        for (let i=0; i<N; i++)  nodes[i].look.adjustRoutes()
    },

    movePadsAndRoutes(pads, deltas, back=false) {

        // adjust the other pads to the ref pad
        const P = pads.length
        let dx = 0
        let dy = 0
        for (let i=0; i<P; i++) {

            // for the undo operation back = true
            dx = back ? -deltas[i].x : deltas[i].x
            dy = back ? -deltas[i].y : deltas[i].y

            // adjust position
            pads[i].rect.x += dx
            pads[i].rect.y += dy

            // also set the y position
            pads[i].adjustRoutes()
        }        
    }
}