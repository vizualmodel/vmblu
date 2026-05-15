// the route used for a connection between an output and an input
import {style, cutsRectangle} from '../util/index.js'

export const routeDrawing = {

    // Returns true when the connector point is on the left side of the widget.
    // For pads, `leftText` means the text is on the left and the bullet/connector is on the right.
    connectorOnLeft(widget) {
        if (!widget?.is) return false
        if (widget.is.pad) return !widget.is.leftText
        if (typeof widget.is.left === 'boolean') return widget.is.left
        if (typeof widget.is.leftText === 'boolean') return widget.is.leftText
        return false
    },

    ownerNode(widget) {
        if (!widget) return null
        if (widget.node) return widget.node
        if (widget.proxy?.node) return widget.proxy.node
        if (widget.cable?.node) return widget.cable.node
        return null
    },

    // For autoroute collision on endpoint legs, pads belong to the enclosing group and
    // are allowed to route inside that group. Only real node-owned widgets (pins/tacks)
    // should reject routes that cut through their own node body.
    endpointBlockRect(widget) {
        if (!widget?.is) return null
        if (widget.is.pad) return null
        const node = this.ownerNode(widget)
        return node?.look?.rect ?? null
    },

    routeCutsEndpointBody(wire, rc, allowSegmentIndex) {
        if (!rc || !wire || wire.length < 2) return false
        for (let i = 0; i < wire.length - 1; i++) {
            if (i === allowSegmentIndex) continue
            if (cutsRectangle(wire[i], wire[i + 1], rc)) return true
        }
        return false
    },

    tackOnHorizontalTrunk(tack) {
        const trunk = tack?.cable
        const a = trunk?.wire?.[tack.segment - 1]
        const b = trunk?.wire?.[tack.segment]

        return !!(a && b && a.y === b.y)
    },

    // Collect orthogonal segments from already routed connections so autoroute can
    // prefer less crowded lanes. Routes are deduplicated because the same route can
    // be reachable from multiple widgets.
    collectRouteSegments(nodes=[]) {
        const routes = new Set()
        const segments = []

        for (const node of nodes ?? []) {
            const widgets = node?.look?.widgets ?? []
            for (const widget of widgets) {
                if (!widget?.routes?.length) continue
                for (const route of widget.routes) {
                    if (!route || route === this || routes.has(route) || route.wire.length < 2) continue
                    routes.add(route)

                    for (let i = 0; i < route.wire.length - 1; i++) {
                        const a = route.wire[i]
                        const b = route.wire[i + 1]
                        if (a.x === b.x) {
                            segments.push({dir:'v', x: a.x, y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y)})
                        }
                        else if (a.y === b.y) {
                            segments.push({dir:'h', y: a.y, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x)})
                        }
                    }
                }
            }
        }

        return segments
    },

    rangeOverlap(a1, a2, b1, b2) {
        return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))
    },

    quantizeLane(value, step = 1) {
        const s = Math.max(1, step || 1)
        return Math.round(value / s) * s
    },

    collectLaneUsage(segments, xStep = 5, yStep = 5) {
        const vertical = new Map()
        const horizontal = new Map()

        for (const seg of segments ?? []) {
            if (seg.dir === 'v') {
                const key = this.quantizeLane(seg.x, xStep)
                vertical.set(key, (vertical.get(key) ?? 0) + 1)
            }
            else if (seg.dir === 'h') {
                const key = this.quantizeLane(seg.y, yStep)
                horizontal.set(key, (horizontal.get(key) ?? 0) + 1)
            }
        }

        return {vertical, horizontal}
    },

    laneRegistryPenaltyVertical(x, laneUsage, laneStep = 5) {
        if (!laneUsage?.vertical) return 0
        const key = this.quantizeLane(x, laneStep)
        let penalty = (laneUsage.vertical.get(key) ?? 0) * 120

        const left = key - laneStep
        const right = key + laneStep
        penalty += (laneUsage.vertical.get(left) ?? 0) * 25
        penalty += (laneUsage.vertical.get(right) ?? 0) * 25

        return penalty
    },

    laneRegistryPenaltyHorizontal(y, laneUsage, laneStep = 5) {
        if (!laneUsage?.horizontal) return 0
        const key = this.quantizeLane(y, laneStep)
        let penalty = (laneUsage.horizontal.get(key) ?? 0) * 120

        const up = key - laneStep
        const down = key + laneStep
        penalty += (laneUsage.horizontal.get(up) ?? 0) * 25
        penalty += (laneUsage.horizontal.get(down) ?? 0) * 25

        return penalty
    },

    lanePenaltyVertical(x, y1, y2, segments, laneStep = 5) {
        let penalty = 0
        const yy1 = Math.min(y1, y2)
        const yy2 = Math.max(y1, y2)

        for (const seg of segments) {
            if (seg.dir !== 'v') continue
            const overlap = this.rangeOverlap(yy1, yy2, seg.y1, seg.y2)
            if (overlap <= 0) continue

            const dx = Math.abs(seg.x - x)
            if (dx < 1) penalty += 1000 + overlap
            else if (dx < laneStep) penalty += 200 + overlap
            else if (dx < laneStep * 2) penalty += 20
        }

        return penalty
    },

    lanePenaltyHorizontal(y, x1, x2, segments, laneStep = 5) {
        let penalty = 0
        const xx1 = Math.min(x1, x2)
        const xx2 = Math.max(x1, x2)

        for (const seg of segments) {
            if (seg.dir !== 'h') continue
            const overlap = this.rangeOverlap(xx1, xx2, seg.x1, seg.x2)
            if (overlap <= 0) continue

            const dy = Math.abs(seg.y - y)
            if (dy < 1) penalty += 1000 + overlap
            else if (dy < laneStep) penalty += 200 + overlap
            else if (dy < laneStep * 2) penalty += 20
        }

        return penalty
    },

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

    //         case 'PIN-CBL':
    //             this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'CBL-PIN':
    //             this.from.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'PAD-CBL':
    //             this.to.horizontal() ? this.fourPointRoute() : this.threePointRoute(true)
    //             break

    //         case 'CBL-PAD':
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

        const fromNode = this.ownerNode(from)
        const toNode = this.ownerNode(to)
        const frc = fromNode?.look?.rect
        const trc = toNode?.look?.rect
        if (!frc || !trc) return this.fourPointRoute(nodes)
        let yMid = f.y + (frc.h/4 + trc.h/4)

        const fromLeft = this.connectorOnLeft(from)
        const toLeft = this.connectorOnLeft(to)

        const fRank = from.rank()
        const fRankValue = yMid < f.y ? fRank.up : fRank.down
        const xBase1 = fromLeft ? f.x - mg - dpx * fRankValue : f.x + mg + dpx * fRankValue

        const tRank = to.rank()
        const tRankValue = yMid < t.y ? tRank.up : tRank.down
        const xBase2 = toLeft ? t.x - mg - dpx * tRankValue : t.x + mg + dpx * tRankValue

        let x1 = xBase1
        let x2 = xBase2

        const blockers = nodes.filter(n => n && n.look?.rect && n !== fromNode && n !== toNode)
        const segmentCuts = (p1, p2, rect) => cutsRectangle(p1, p2, rect)
        const expandY = style.autoroute.yDelta
        const routeSegments = this.collectRouteSegments(nodes)
        const laneUsage = this.collectLaneUsage(routeSegments, dpx, expandY)

        const buildWire = () => {
            wire.length = 0
        wire.push(f)
        wire.push({x:x1, y:f.y})
        wire.push({x:x1, y:yMid})
        wire.push({x:x2, y:yMid})
        wire.push({x:x2, y:t.y})
        wire.push(t)

        // Endpoint owner nodes are excluded from generic blockers, but the route may
        // still not cut through them with non-adjacent segments.
        const fromRc = this.endpointBlockRect(from)
        const toRc = this.endpointBlockRect(to)
        if (this.routeCutsEndpointBody(wire, fromRc, 0)) return false
        if (this.routeCutsEndpointBody(wire, toRc, wire.length - 2)) return false
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

        // If multiple y lanes are available, prefer the less crowded horizontal lane.
        if (!hit && routeSegments.length) {
            const yBase = yMid
            const yCandidates = [0, 1, -1, 2, -2, 3, -3].map(step => yBase + step * expandY)
            let bestY = yMid
            let bestScore = Infinity

            for (const candidateY of yCandidates) {
                const p1 = {x:x1, y:candidateY}
                const p2 = {x:x2, y:candidateY}
                if (blockers.some(node => segmentCuts(p1, p2, node.look.rect))) continue

                const score =
                    this.lanePenaltyVertical(x1, f.y, candidateY, routeSegments, dpx) +
                    this.lanePenaltyHorizontal(candidateY, x1, x2, routeSegments, expandY) +
                    this.lanePenaltyVertical(x2, candidateY, t.y, routeSegments, dpx) +
                    this.laneRegistryPenaltyHorizontal(candidateY, laneUsage, expandY) +
                    this.laneRegistryPenaltyVertical(x1, laneUsage, dpx) +
                    this.laneRegistryPenaltyVertical(x2, laneUsage, dpx)

                if (score < bestScore) {
                    bestScore = score
                    bestY = candidateY
                }
            }

            yMid = bestY
            buildWire()
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
        const routeSegments = this.collectRouteSegments(nodes)

        // choose the x for the vertical leg (xNew):
        // - prefer the middle when pins face each other with no node overlap in x
        // - otherwise, push the vertical leg away from the "from" side
        const dpx = style.autoroute.xDelta
        const mg = style.autoroute.xMargin
        const laneUsage = this.collectLaneUsage(routeSegments, dpx, style.autoroute.yDelta)
        const isBusRoute = from.is?.tack || to.is?.tack
        let fromLeft = this.connectorOnLeft(from)
        let toLeft = this.connectorOnLeft(to)
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

        // Prefer a less crowded vertical lane when several valid lanes exist.
        if (routeSegments.length) {
            const xBase = xNew
            const shifts = [0, dpx, -dpx, dpx*2, -dpx*2, margin, -margin]
            let bestX = xNew
            let bestScore = Infinity

            for (const dx of shifts) {
                const candidate = enforceShapeRule(xBase + dx)
                if (tryClearX(candidate)) continue

                const score =
                    this.lanePenaltyVertical(candidate, f.y, t.y, routeSegments, dpx) +
                    this.laneRegistryPenaltyVertical(candidate, laneUsage, dpx)
                if (score < bestScore) {
                    bestScore = score
                    bestX = candidate
                }
            }

            xNew = bestX
        }
        
        // build a 4-point orthogonal wire: horizontal, vertical, horizontal
        wire.push(f)
        wire.push({ x: xNew, y: f.y})
        wire.push({ x: xNew, y: t.y})
        wire.push(t)

        // Endpoint owner nodes are excluded from generic blockers, but the route may
        // still not cut through them with non-adjacent segments.
        const fromRc = this.endpointBlockRect(from)
        const toRc = this.endpointBlockRect(to)
        if (this.routeCutsEndpointBody(wire, fromRc, 0)) return false
        if (this.routeCutsEndpointBody(wire, toRc, wire.length - 2)) return false

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

        // Routes that start or end on a horizontal bus/cable trunk should stay as
        // a simple two-segment route, with the vertical segment at the tack. This
        // lets dragging that segment slide the tack along the trunk.
        if (this.from.is.tack && this.tackOnHorizontalTrunk(this.from)) {
            const f = this.from.center()

            p.length = 0
            p.push(f)
            p.push({x: f.x, y})
            p.push({x, y})
            return
        }

        if (this.to?.is?.tack && this.tackOnHorizontalTrunk(this.to)) {
            const t = this.to.center()

            p.length = 0
            p.push({x, y})
            p.push({x: t.x, y})
            p.push(t)
            return
        }

        // only two points...
        if (L == 2) {
            if (this.from.is.tack && this.tackOnHorizontalTrunk(this.from)) {
                this.threePointRoute(false)
                return
            }
            if (this.to?.is?.tack && this.tackOnHorizontalTrunk(this.to)) {
                this.threePointRoute(true)
                return
            }

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

        // Detach the existing connection before turning the same route into a
        // half-drawn route. Redox keeps the clone for undo; this mutates live state.
        this.disconnect()

        // we have to take a few segments away - if only one point left set length to 0 !
        this.wire.length = segment > 1 ? segment : 0

        // now we can store the route again in the from widget
        if (this.from.is.pin || this.from.is.pad) {
            this.from.routes.push(this)
        }
        else if (this.from.is.tack) {
            this.from.route = this 
            this.from.cable.tacks.push(this.from)
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
                
               // try a 4-point route first; fall back to 6-point if it intersects nodes
                this.fourPointRoute(nodes) || this.sixPointRoute(nodes)
                break

            case 'PIN-CBL':
            case 'PAD-CBL':
                this.autoBusRoute(this.to, nodes)
                break

            case 'CBL-PIN':
            case 'CBL-PAD':
                this.autoBusRoute(this.from, nodes)
                break

            case 'CBL-CBL':
                this.autoBridgeRoute(nodes)
                break
        }
    },

    autoBusRoute(tack, nodes) {
        const trunk = tack.cable
        const a = trunk?.wire?.[tack.segment - 1]
        const b = trunk?.wire?.[tack.segment]
        const verticalTrunk = a && b ? a.x === b.x : tack.horizontal()

        verticalTrunk ? this.fourPointRoute(nodes) || this.sixPointRoute(nodes) : this.threePointRoute(tack === this.to)
    },

    autoBridgeRoute(nodes) {
        const fromHorizontal = this.tackOnHorizontalTrunk(this.from)
        const toHorizontal = this.tackOnHorizontalTrunk(this.to)

        if (fromHorizontal) {
            this.threePointRoute(false)
            return
        }

        if (toHorizontal) {
            this.threePointRoute(true)
            return
        }

        this.fourPointRoute(nodes) || this.sixPointRoute(nodes)
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
