import {style} from '../util/index.js'

export const busDrawing = {
    
    // draw freely with x/y segments - do not pass beyond arrows that are attached to the bus
    drawXY(next) {

        const L = this.wire.length

        // notation
        const r1 = this.wire[L - 2]
        const r2 = this.wire[L - 1]
        const wBus = this.is.cable ? style.bus.wCable : style.bus.wBusbar
        const hLabel = this.endLabel.rect.h
        let limit = null

        const vertical = r2.x == r1.x
        const horizontal = r2.y == r1.y

        // the first segment x==y
        if (vertical && horizontal) {

            // the first two points of the wire are the same, so seperate them...
            (Math.abs(next.x - r1.x) < Math.abs(next.y - r1.y)) ? r2.y = next.y : r2.x = next.x
        }
        // Horizontal - moving in x direction
        else if (horizontal) {

            // change to vertical ?
            if (Math.abs(next.y - r2.y) > style.bus.split) {

                // create a new segment
                this.wire.push({x:r2.x, y:next.y})
            }
            else {

                // if there are widgets we have to do an additional check - we do not move beyond widgets
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.x < r2.x)&&(next.x < limit.r + wBus/2)) next.x = limit.r + wBus/2
                    if ((r1.x > r2.x)&&(next.x > limit.l - wBus/2)) next.x = limit.l - wBus/2
                }

                // set the next x value
                r2.x = next.x

                // remove the segment if too small 
                if ((L > 2) && (Math.abs(r2.x - r1.x) < style.bus.tooClose)) this.wire.pop()
            }
        }
        // Vertical - moving in the y-direction
        else if (vertical) {

            // change to horizontal ?
            if (Math.abs(next.x - r2.x) > style.bus.split) {

                // new segment
                this.wire.push({x:next.x, y:r2.y})
            }
            else {
                // if there are widgets we have to do an additional check - we do not move beyond widgets
                if ((this.tacks.length)&&(limit = this.getLimit(L-1))) {
                    if ((r1.y < r2.y)&&(next.y < limit.b )) next.y = limit.b
                    if ((r1.y > r2.y)&&(next.y > limit.t - hLabel/2)) next.y = limit.t - hLabel/2
                }

                // set the next y value
                r2.y = next.y

                // check if points are getting too close
                if ((L > 2) && (Math.abs(r2.y - r1.y) < style.bus.tooClose)) this.wire.pop()
            }
        }

        // reposition the labels of the bus
        this.startLabel.place()
        this.endLabel.place()
    },

    resumeDrawXY(label,pos,delta) {
        // switch the direction of the bus if the startlabel is moved
        if (label == this.startLabel) this.reverse()

        // notation
        const p = this.wire
        const pa = p[p.length-2]
        const pb = p[p.length-1]

        // check is we need to switch horizontal/vertical
        let x = (pa.x == pb.x)&&(Math.abs(pos.x - pa.x) > style.bus.split) ? pos.x : pb.x + delta.x
        let y = (pa.y == pb.y)&&(Math.abs(pos.y - pa.y) > style.bus.split) ? pos.y : pb.y + delta.y

        // draw the bus
        this.drawXY({x,y})
    },

    // reverses the path of the bus - switches end and start label
    reverse() {
        [this.startLabel, this.endLabel] = [this.endLabel, this.startLabel]

        const p = this.wire
        const L = p.length

        // reverse the points - if l is uneven the middle point stays, which is ok
        for (let i=0; i<L/2; i++) [p[i], p[L-i-1]] = [p[L-i-1], p[i]]

        // the segment number for the arrows has to be adapted as well
        this.tacks.forEach( tack => tack.segment = L - tack.segment)
    },

    // returns the zone where there are widgets on the segment
    getLimit(segment) {

        let limit=null

        this.tacks.forEach( tack => {
            if (tack.segment == segment) {
                const rc = tack.rect
                if (limit) {
                    if (rc.x < limit.l)         limit.l = rc.x
                    if (rc.x + rc.w > limit.r)  limit.r = rc.x + rc.w
                    if (rc.y < limit.t)         limit.t = rc.y
                    if (rc.y + rc.h > limit.b)  limit.b = rc.y + rc.h

                }
                else limit = {l: rc.x, r:rc.x + rc.w, t: rc.y, b:rc.y + rc.h}
            }
        })
        return limit
    },

    // move the bus and the tacks - but not the routes - used in selection move
    move(dx, dy) {

        // move all segments
        for(const point of this.wire) {
            point.x += dx
            point.y += dy
        }

        // move the labels
        this.startLabel.move(dx,dy)
        this.endLabel.move(dx,dy)

        // move the tacks
        for(const tack of this.tacks) {
            tack.rect.x += dx
            tack.rect.y += dy
        }
    },

    // 
    drag(delta) {

       // move all segments
       for(const point of this.wire) {
            point.x += delta.x
            point.y += delta.y
        }

        // move the labels
        this.startLabel.move(delta.x, delta.y)
        this.endLabel.move(delta.x, delta.y)

        // move the tacks and the route
        for(const tack of this.tacks) tack.moveXY(delta.x, delta.y)
    },

    // move the routes that originated from the bus
    moveRoutes(x,y) {
        this.tacks.forEach( (tack) => { 
            if (tack.is.tack && tack.route.from == tack) tack.route.moveAllPoints(x,y)
        })
    },

    // returns the widget zone of the two adjacent segments
    getCombinedLimit(s1,s2) {

        let limit1 = this.getLimit(s1)
        let limit2 = this.getLimit(s2)

        if (limit1 && limit2) {
            if (limit2.l < limit1.l) limit1.l = limit2.l
            if (limit2.r > limit1.r) limit1.r = limit2.r
            if (limit2.t < limit1.t) limit1.t = limit2.t
            if (limit2.b > limit1.b) limit1.b = limit2.b
        }
        return limit1 ? limit1 : limit2
    },

    // move the segment if possible
    moveSegment(segment, delta) {

        // notation
        let p = this.wire
        const dx = delta.x
        const dy = delta.y

        // get the forbidden zone in which the segment cannot move
        let limit = this.getCombinedLimit(segment-1, segment+1)

        // segment is defined by two points
        let a = p[segment-1]
        let b = p[segment]

        // horizontal segment
        if (a.y == b.y) {
            // if the new point is not in the forbidden zone, it can move
            if ((limit == null) || (a.y > limit.b)&&(a.y+dy > limit.b) || (a.y < limit.t)&&(a.y+dy < limit.t)) {
                a.y += dy
                b.y += dy

                for (const tack of this.tacks) if (tack.segment == segment) tack.moveY(dy)
            }
        }
        // vertical segment
        else if (a.x == b.x) {
           // if the new point is not in the forbidden zone, it can move
            if ((limit == null) || (a.x > limit.r)&&(a.x+dx > limit.r) || (a.x < limit.l)&&(a.x+dx < limit.l)) {
                a.x += dx
                b.x += dx

                for (const tack of this.tacks) if (tack.segment == segment) tack.moveX(dx)
            }
        }
        // labels have to be moved if the first or last segment has been moved
        if (segment == 1) this.startLabel.place() 
        if (segment == p.length - 1) this.endLabel.place() 
    },

    placeTacks(segment,dx,dy) {
        for (const tack of this.tacks) tack.orient()
    },

    removeTwoPoints(segment) {

        // remove  the segment from the bus
        const p = this.wire
        const L = p.length

        // we remove two points from the array
        for (let i = segment; i < L-2; i++) p[i] = p[i+2]

        // remove the two last points..
        p.pop()
        p.pop()

        // ..and reassign widgets to a different segment...
        this.tacks.forEach( w => { if (w.segment > segment) w.segment -= 2 })
    },

    // check if the segment has to be fused wit previous/next
    fuseSegment(s) {

        let p = this.wire  

        // check
        if (p.length < 3) return
        
        // notation
        const deltaMin = style.bus.tooClose

        // horizontal segment
        if (p[s-1].y == p[s].y) {

            // check next
            if ((s < p.length-2)&&(Math.abs(p[s+1].y - p[s].y) < deltaMin)) {
                p[s-1].y = p[s+1].y
                this.removeTwoPoints(s)
            }
            // or previous
            else if ((s > 1)&&(Math.abs(p[s-2].y - p[s-1].y) < deltaMin)) {
                p[s].y = p[s-2].y
                this.removeTwoPoints(s-2)
            }
        }
        // vertical segment
        else if (p[s-1].x == p[s].x) {

            // check next
            if ((s < p.length-2)&&(Math.abs(p[s+1].x - p[s].x) < deltaMin)) {
                p[s-1].x = p[s+1].x
                this.removeTwoPoints(s)
            }
            // or previous
            else if ((s > 1)&&(Math.abs(p[s-2].x - p[s-1].x) < deltaMin)) {
                p[s].x = p[s-2].x
                this.removeTwoPoints(s-2)
            }
        }
        // place the labels - not always necessary but saves time ...
        this.startLabel.place() 
        this.endLabel.place() 
    },

    // after a bus move 
    adjustRoutes() {

        for(const tack of this.tacks) {
            tack.route.adjust()
        }
    },

    // closest tack
    closestTack(widget) {
    },

    straightConnections() {

        for(const tack of this.tacks) {

            // take the route
            const route = tack.route

            // other end of the route
            const other = route.to == tack ? route.from : route.to

            // get the two points of the bus segment
            let a = this.wire[tack.segment-1]
            let b = this.wire[tack.segment]

            // only vertical segment
            if (a.x == b.x) {

                // arrange
                [a, b] = a.y > b.y ? [b, a] : [a, b]

                // check 
                if (other.rect.y > a.y && other.rect.y < b.y) {

                    // move the tack
                    tack.rect.y = other.rect.y + other.rect.h/2 - tack.rect.h/2

                    // straighten the route
                    for(const p of route.wire) p.y = other.rect.y + other.rect.h/2
                }
            }
        }
    }
    
}