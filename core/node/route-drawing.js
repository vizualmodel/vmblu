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

    // // make a route between from and to
    // builder() {

    //     const conx = this.typeString()

    //     switch (conx) {

    //         case 'PIN-PIN':
    //             this.fourPointRoute()
    //             break

    //         case 'PIN-PAD':
    //             this.fourPointRoute()
    //             break

    //         case 'PAD-PIN':
    //             this.fourPointRoute()
    //             break

    //         case 'PIN-BUS':
    //             this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'BUS-PIN':
    //             this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'PAD-BUS':
    //             this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'BUS-PAD':
    //             this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break
    //     }
    // },

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
        
        const dpx = style.autoroute.xDelta
        const mg = style.autoroute.xMargin

        const frc = from.node.look.rect
        const trc = to.node.look.rect
        let yMid = f.y + (frc.h/4 + trc.h/4)

        const fRank = from.rank()
        const fRankValue = yMid < f.y ? fRank.up : fRank.down
        const xBase1 = from.is.left ? f.x - mg - dpx * fRankValue : f.x + mg + dpx * fRankValue

        const tRank = to.rank()
        const tRankValue = yMid < t.y ? tRank.up : tRank.down
        const xBase2 = to.is.left ? t.x - mg - dpx * tRankValue : t.x + mg + dpx * tRankValue

        let x1 = xBase1
        let x2 = xBase2

        const blockers = nodes.filter(n => n && n.look?.rect && n !== from.node && n !== to.node)
        const segmentCuts = (p1, p2, rect) => cutsRectangle(p1, p2, rect)
        const expandY = style.autoroute.yDelta

        const buildWire = () => {
            wire.length = 0
            wire.push(f)
            wire.push({x:x1, y:f.y})
            wire.push({x:x1, y:yMid})
            wire.push({x:x2, y:yMid})
            wire.push({x:x2, y:t.y})
            wire.push(t)
        }

        const firstHorizontalCut = () => {
            const p1 = {x:x1, y:yMid}
            const p2 = {x:x2, y:yMid}
            for (const node of blockers) {
                if (segmentCuts(p1, p2, node.look.rect)) return node
            }
            return null
        }

        let guard = 0
        buildWire()
        let hit = firstHorizontalCut()
        while (hit && guard < 30) {
            const rc = hit.look.rect
            const distTop = yMid - rc.y
            const distBottom = (rc.y + rc.h) - yMid
            if (distTop < distBottom) yMid -= expandY
            else yMid += expandY
            buildWire()
            hit = firstHorizontalCut()
            guard++
        }

        return true
    },

    fourPointRoute(nodes=[]) {

        // reset points
        if (this.wire.length > 0) this.wire.length = 0

        // create a simple orthogonal route between the two widgets
        const wire = this.wire
        const from = this.from
        const to = this.to
        const f = from.center()
        const t = to.center()

        // helper data for collision checks and gentle nudges
        const margin = style.look.dxCopy
        const blockers = nodes.filter(n => n && n.look?.rect && n !== from.node && n !== to.node)
        const segmentCuts = (p1, p2, rect) => cutsRectangle(p1, p2, rect)

        // choose the x for the vertical leg (xNew):
        // - prefer the middle when pins face each other with no node overlap in x
        // - otherwise, push the vertical leg away from the "from" side
        const dpx = style.autoroute.xDelta
        const mg = style.autoroute.xMargin
        const isBusRoute = from.is?.tack || to.is?.tack
        let fromLeft = from.is?.left ?? from.is?.leftText ?? false
        let toLeft = to.is?.left ?? to.is?.leftText ?? false
        if (isBusRoute) {
            // For bus connections, infer "facing" by relative position to avoid routing past the bus.
            fromLeft = f.x > t.x
            toLeft = t.x > f.x
        }
        const rank = from.rank ? from.rank() : {up: 1, down: 1}
        const rankValue = t.y < f.y ? rank.up : rank.down
        let xNew = fromLeft ? f.x - mg - dpx * rankValue : f.x + mg + dpx * rankValue

        // if the nodes are clearly separated in x and the pins face each other,
        // keep the vertical leg between the pins for a clean, direct route
        const frc = from.node?.look?.rect
        const trc = to.node?.look?.rect
        const xOverlap = frc && trc ? !((frc.x + frc.w < trc.x) || (trc.x + trc.w < frc.x)) : true
        const pinsFaceEachOther = fromLeft !== toLeft
        if (!xOverlap && pinsFaceEachOther) {
            xNew = (f.x + t.x) / 2
        }

        // enforce the "shape" rule:
        // - opposite sides: keep the vertical leg between the two endpoints
        // - same side: push the vertical leg outside both endpoints (left or right)
        const minX = Math.min(f.x, t.x)
        const maxX = Math.max(f.x, t.x)
        const enforceShapeRule = (xCandidate) => {
            if (fromLeft !== toLeft) {
                if (xCandidate < minX) return minX
                if (xCandidate > maxX) return maxX
                return xCandidate
            }
            return fromLeft ? Math.min(xCandidate, minX - mg) : Math.max(xCandidate, maxX + mg)
        }
        xNew = enforceShapeRule(xNew)

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
                const candidate = enforceShapeRule(base + dx)
                if (!tryClearX(candidate)) { xNew = candidate; break }
            }
        }
        
        // build a 4-point orthogonal wire: horizontal, vertical, horizontal
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
            case 'PAD-PIN':
                this.fourPointRoute(nodes)
                break

            case 'PIN-BUS':
            case 'PAD-BUS':
                this.autoBusRoute(this.to, nodes)
                break

            case 'BUS-PIN':
            case 'BUS-PAD':
                this.autoBusRoute(this.from, nodes)
                break
        }
    },

    autoBusRoute(tack, nodes) {
        tack.horizontal() ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(true)      
    },

    checkLeftRight() {

        // from and to already contain the route ! so 1 is ok.
        if ( (this.from.routes.length > 1) && (this.to.routes.length > 1)) return;

        // sort according to x 
        const [near, far] = this.from.center().x < this.to.center().x ? [this.from, this.to] : [this.to, this.from];

        const nrc = near.node.look.rect
        const frc = far.node.look.rect

        // no x-overlap make right-left
        if ((nrc.x + nrc.w < frc.x) || (frc.x + frc.w < nrc.x)) {

            if ( near.is.left && near.routes.length < 2) near.leftRightSwap();
            if ( !far.is.left && far.routes.length < 2) far.leftRightSwap();
        }
        // x-overlap make left-left or right-right
        else {
            if (near.is.left != far.is.left) {

                if (near.routes.length < 2) near.leftRightSwap()
                else if (far.routes.length < 2) far.leftRightSwap()
            }
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
