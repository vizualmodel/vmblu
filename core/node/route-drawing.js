// the route used for a connection between an output and an input
import {style, cutsRectangle} from '../util/index.js'

export const routeDrawing = {

    // draw freely with x/y segments
    // we always assume that the route is extended at the last point (i.e. the to widget !)
    drawXY(next) {

        // notation
        const wire = this.wire
        let L = wire.length

        // if there is no line segment push two points - start in the x -direction !
        if (L == 0) {
            let c = this.from.center()
            wire.push({x: c.x, y: c.y})
            wire.push({x: next.x, y: c.y})
            return
        }

        // take the two last points b a 
        let b = wire[L - 2]
        let a = wire[L - 1]

        // moving in x direction
        if (a.y == b.y) {

            // need to split ?
            if (Math.abs(next.y - a.y) > style.route.split) {

                // create a new segment
                wire.push({x:a.x, y:next.y})
            }
            else {
                // just adapt the x value
                a.x = next.x

                // check if points are getting too close, if so drop 
                if ((L>2) && (Math.abs(a.x - b.x) < style.route.tooClose)) wire.pop()
            }
        }
        // moving in the y-direction
        else {

            // need to split ?
            if (Math.abs(next.x - a.x) > style.route.split) {

                // create a new segment
                wire.push({x:next.x, y:a.y})
            }
            else {
                // just adapt the y value
                a.y = next.y

                // check if points are getting too close
                if ((L>2) && (Math.abs(a.y - b.y) < style.route.tooClose)) wire.pop()
            }
        }
    },

    // make a route between from and to
    builder() {

        const conx = this.typeString()

        switch (conx) {

            case 'PIN-PIN':
                this.fourPointRoute()
                break

            case 'PIN-PAD':
                this.fourPointRoute()
                break

            case 'PAD-PIN':
                this.fourPointRoute()
                break

            case 'PIN-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
                break

            case 'BUS-PIN':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
                break

            case 'PAD-BUS':
                this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
                break

            case 'BUS-PAD':
                this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
                break
        }
    },

    sixPointRoute(nodes=[]) {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0

        // create a simple route between the two widgets
        const wire = this.wire
        const from = this.from
        const to = this.to
        const f = from.center()
        const t = to.center()

        // deterministic offsets away from node bodies
        const margin = style.look.dxCopy

        let x1 = from.is.left ? f.x - margin : f.x + margin
        let x2 = to.is.left ? t.x - margin : t.x + margin

        const frc = from.node.look.rect
        const trc = to.node.look.rect
        let y1 = f.y + (frc.h/4 + trc.h/4)

        const blockers = nodes.filter(n => n && n.look?.rect && n !== from.node && n !== to.node)
        const segmentCuts = (p1, p2, rect) => cutsRectangle(p1, p2, rect)
        const expandY = Math.max(style.route.split, 10)

        const buildWire = (yMid) => {
            wire.length = 0
            wire.push(f)
            wire.push({x:x1, y:f.y})
            wire.push({x:x1, y:yMid})
            wire.push({x:x2, y:yMid})
            wire.push({x:x2, y:t.y})
            wire.push(t)
        }

        const collides = () => {
            for (let i=0; i<wire.length-1; i++) {
                const a = wire[i], b = wire[i+1]
                if (blockers.some(n => segmentCuts(a, b, n.look.rect))) return true
            }
            return false
        }

        let guard = 0
        buildWire(y1)
        while (collides() && guard < 30) {
            y1 += expandY
            buildWire(y1)
            guard++
        }

        return true
    },

    fourPointRoute(nodes=[]) {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0

        // create a simple route between the two widgets
        const wire = this.wire
        const from = this.from
        const to = this.to
        const f = from.center()
        const t = to.center()

        let xNew = 0
        const margin = style.look.dxCopy
        const blockers = nodes.filter(n => n && n.look?.rect && n !== from.node && n !== to.node)
        const segmentCuts = (p1, p2, rect) => cutsRectangle(p1, p2, rect)

        // if both pins are at the same side of the node
        if ((from.is.pin && to.is.pin)&&(from.is.left == to.is.left)) {

            const left = from.is.left
            if (left) 
                xNew = from.rect.x < to.rect.x ? from.rect.x - margin : to.rect.x - margin
            else 
                xNew = from.rect.x + from.rect.w > to.rect.x + to.rect.w ? from.rect.x + from.rect.w + margin : to.rect.x + to.rect.w + margin
        }
        else {

            // place the bend between the two centers with a fixed offset
            const delta = Math.abs(f.x - t.x) * 0.25
            xNew = f.x < t.x ? f.x + delta : f.x - delta
        }

        // make the position of the bend also dependant on the relative position of the pin in the node
        const yFraction = 0.02
        const dyPin = from.rect.y - from.node.look.rect.y 
        xNew = from.is.left ? xNew - dyPin * yFraction : xNew + dyPin * yFraction

        // nudge xNew left/right if the vertical legs would cut through other nodes
        const tryClearX = (xCandidate) => {
            const pA = {x:xCandidate, y:f.y}
            const pB = {x:xCandidate, y:t.y}
            return blockers.some(n => segmentCuts(pA, pB, n.look.rect))
        }
        if (tryClearX(xNew)) {
            const shifts = [margin, -margin, margin*2, -margin*2]
            const base = xNew
            for (const dx of shifts) {
                if (!tryClearX(base + dx)) { xNew = base + dx; break }
            }
        }
        
        wire.push(f)
        wire.push({ x: xNew, y: f.y})
        wire.push({ x: xNew, y: t.y})
        wire.push(t)

        // check for collisions with other nodes; if any, signal failure
        for (let i=0; i<wire.length-1; i++) {
            const a = wire[i], b = wire[i+1]
            if (blockers.some(n => segmentCuts(a, b, n.look.rect))) return false
        }
        return true
    },

    threePointRoute(horizontal) {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0

        const p = this.wire
        const f = this.from.center()
        const t = this.to.center()

        p.push(f)
        horizontal ? p.push({x:t.x, y:f.y}) : p.push({x:f.x, y:t.y})
        p.push(t)
    },

    twoPointRoute() {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0

       // create a simple route between the two widgets
       const p = this.wire
       const f = this.from.center()
       const t = this.to.center()
       
       p.push(f)
       p.push({x:t.x, y:f.y})
    },
   
    // x,y is the endpoint - adjust some segment coordinates as required
    endpoint(widget) {

        let p = this.wire
        let L = p.length

        // there are at least two points...
        if (L<2) return

        // get the point to connect to on the widget
        let {x,y} = widget.center()

        // only two points...
        if (L == 2) {
            // if the two points are not at the same y..
            if (p[0].y != y) {

                //..we adjust point 1 and add two extra points 
                p[1].x = (p[0].x + x)/2      //1
                p[1].y = p[0].y
                p.push({x:p[1].x, y:y})      //2
                p.push({x,y})                //3
            }
            else
                // we just adjust the x to the endpoint
                p[1].x = x

            // done
            return
        }

        // L > 2
        if (p[L-1].x== p[L-2].x) {

            // adjust the last y to the y of the widget
            p[L-1].y = y

            // and push the endpoint on the route
            p.push({x,y})
        }
        else {
            //save the coordinates of the last line segment
            p[L-1].x = x
            p[L-1].y = y

            // if the segment before is vertical 
            p[L-2].x == p[L-3].x    ? p[L-2].y = p[L-1].y 
                                    : p[L-2].x = p[L-1].x
        }
    },

    resumeDrawing(segment,xyLocal) {

        // get the center points of the widgets
        let xyFrom = this.from.center()
        let xyTo = this.to.center()

        const distanceFrom = Math.hypot( xyFrom.x - xyLocal.x, xyFrom.y - xyLocal.y )
        const distanceTo = Math.hypot( xyTo.x - xyLocal.x, xyTo.y - xyLocal.y)

        // choose where to disconnect based on the distance to the from/to pin
        if (distanceFrom < distanceTo) {
            
            // reverse if we are closer to 'from'
            this.reverse()
            segment = this.wire.length - segment
        }

        // we have to take a few segments away - if only one point left set length to 0 !
        this.wire.length = segment > 1 ? segment : 0

        // now we can store the route again in the from widget
        if (this.from.is.pin || this.from.is.pad) {
            this.from.routes.push(this)
        }
        else if (this.from.is.tack) {
            this.from.route = this 
            this.from.bus.tacks.push(this.from)
        }

        // we also set the 'to' to null for good measure
        this.to = null

        // and draw the next point using the xy
        this.drawXY(xyLocal)
    },

    // checks if there is an unobstructed path from p1 to p2
    lineOfSight(nodes) {
        
        const cFrom = this.from.center();
        const cTo = this.to.center();

        for (const node of nodes) {
            // ignore the nodes that own the endpoints
            if ((node == this.from.node) || (node == this.to.node)) continue
            if (cutsRectangle(cFrom, cTo, node.look.rect)) return false
        }
        return true
    },

    autoRoute(nodes) {
        
        // get the type of connection
        const conx = this.typeString()

        switch (conx) {

            case 'PIN-PIN':

                // if there is no route yet we can swap left/right to have a better fit
                this.checkLeftRight()

                // try a 4-point route first; fall back to 6-point if it intersects nodes
                this.fourPointRoute(nodes) || this.sixPointRoute(nodes)

                break

            case 'PIN-PAD':
                this.fourPointRoute(nodes)
                break

            case 'PAD-PIN':
                this.fourPointRoute(nodes)
                break

            case 'PIN-BUS':
                this.to.horizontal() ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(true)
                break

            case 'BUS-PIN':
                this.from.horizontal() ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(true)
                break

            case 'PAD-BUS':
                this.to.horizontal() ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(true)
                break

            case 'BUS-PAD':
                this.from.horizontal() ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(true)
                break
        }
    },

    checkLeftRight() {

        const cFrom = this.from.center();
        const cTo = this.to.center();

        if (this.from.routes.length == 0) {

            if ((this.from.is.left && (cFrom.x < cTo.x)) || (!this.from.is.left && (cFrom.x > cTo.x)) ) this.from.leftRightSwap();
        }
        if (this.to.routes.length == 0) {

            if ((this.to.is.left && (cTo.x < cFrom.x)) || (!this.to.is.left && (cTo.x > cFrom.x)) ) this.to.leftRightSwap();
        }

    },

    // sometimes a route can be pathological - this is a fix for that
    healWire(){

        if (this.wire.length == 3) {

            const p0 = this.wire[0]
            const p1 = this.wire[1]
            const p2 = this.wire[2]

            // rebuild as a clean orthogonal path
            this.wire.length = 0
            this.wire.push(
                {x:p0.x, y:p0.y},
                {x:p1.x, y:p0.y},
                {x:p1.x, y:p2.y},
                {x:p2.x, y:p2.y},
            )
        }

    }
    
}

