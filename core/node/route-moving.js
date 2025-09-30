// the route used for a connection between an output and an input
import {style} from '../util/index.js'

export const routeMoving = {

    // moves a segment horizontally or vertically
    moveSegment(s,delta) {

        const from = this.from
        const to = this.to

        let p1 = this.wire[s-1]
        let p2 = this.wire[s]

        // if there is only one segment and one of the endpoints is a bus, add two segments
        if (this.wire.length == 2) {
            if (from.is.tack || to.is.tack || from.is.pad || to.is.pad) this.makeThreeSegments(p1, p2)
        }

        // first segment...
        if (s == 1) {
            // if one of the end points is a tack or pad - it can slide
            return (from.is.tack || from.is.pad) ? from.slide(delta) : null
        }

        // last segment...
        if (s == this.wire.length-1) {
            return (to.is.tack || to.is.pad) ? to.slide(delta) : null
        }

        // otherwise just move the segment
        if (p1.x == p2.x) {
            p1.x += delta.x
            p2.x += delta.x
        }
        else {
            p1.y += delta.y
            p2.y += delta.y
        }
    },

    moveAllPoints(dx,dy) {
        this.wire.forEach( p => {
            p.x += dx
            p.y += dy
        })
    },

    removeOnePoint(n,p) {
        let last = p.length-1
        for (let i = n; i<last; i++)  p[i] = p[i+1]
        p.length = last      
    },

    removeTwoPoints(n,p) {
        let last = p.length-2
        for (let i = n; i<last; i++)  p[i] = p[i+2]
        p.length = last      
    },

    endDrag(s) {

        // the last point is 
        const L = this.wire.length

        // segments 1 and 2 and L-1 and L-2 are special...
        if (s==1) {
            if (this.from.is.tack || this.from.is.pad) this.from.fuseEndSegment()
        }
        else if (s==2) {
            if (this.from.is.pin) this.fuseSegmentAfter(s)
            else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s)
        }
        else if (s == L-1) {
            if (this.to.is.tack || this.to.is.pad) this.to.fuseEndSegment()
        }
        else if (s == L-2) {
            if (this.to.is.pin) this.fuseSegmentBefore(s)
            else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s)
        }
        else this.fuseSegmentBefore(s) || this.fuseSegmentAfter(s)
    },

    // check if the segment has to be fused wit previous
    fuseSegmentBefore(s) {

        // notation - a and b are the points on the segment
        const p = this.wire  

        // check
        if (s-2 < 0) return false

        const [before, a, b] = [p[s-2], p[s-1], p[s]]
        const min = style.route.tooClose

        // horizontal segment
        if (a.y == b.y) {
            // check the point before the segment
            if (Math.abs(before.y - a.y) < min) {
                b.y = before.y
                this.removeTwoPoints(s-2,p)
                return true
            }
        }
        // vertical segment
        else if (a.x == b.x) {
            // check the point before
            if (Math.abs(before.x - a.x) < min) {
                b.x = before.x
                this.removeTwoPoints(s-2,p)
                return true
            }
        }
        return false
    },

    // check if the segment has to be fused with next 
    fuseSegmentAfter(s) {

        // notation - a and b are the points on the segment
        const p = this.wire  

        // check
        if (s+1 > p.length-1) return false

        // notation
        const [a, b, after] = [p[s-1], p[s], p[s+1]]
        const min = style.route.tooClose

        // horizontal segment
        if (a.y == b.y) {

            // check the point after the segment
            if (Math.abs(after.y - b.y) < min) {
                a.y = after.y
                this.removeTwoPoints(s,p)
                return true
            }
        }
        // vertical segment
        else if (a.x == b.x) {

            // check the point after
            if (Math.abs(after.x - b.x) < min) {
                a.x = after.x
                this.removeTwoPoints(s,p)
                return true
            }
        }
        return false
    },

    // moves an endpoint of a route to a new widget position
    clampToWidget( widget ) {

        const p = this.wire
        const L = this.wire.length
        const center = widget.center()

        // if the segment is too short, change it to a four point route
        if (L < 3) return this.fourPointRoute()

        // clamp 'from' or 'to' to the center
        if (this.from == widget) {
            p[0].x = center.x
            p[0].y = center.y
            p[1].y = center.y
        }
        else if (this.to == widget) {
            p[L-1].x = center.x
            p[L-1].y = center.y
            p[L-2].y = center.y
        }
    },

    // The endpoint(s) of the route have changed - make a better route
    adjust() {

        // notation
        const from = this.from
        const to = this.to

        // check that there are two valid endpoints
        if ( ! to?.center || !from?.center) return

        // from new - to new
        const fn = from.center()
        const tn = to.center()

        // from previous - to previous
        const fp = this.wire[0]
        const tp = this.wire.at(-1)

// TEMPORARY SOMETIMES THE WIRE IS GONE ?
if (!fp || !tp || !tn || !fn) {
    console.error('*** MISSING ENDPOINTS FOR ROUTE ***', this)
    return
}

        // the deltas
        const df = {x: fn.x - fp.x, y: fn.y - fp.y}
        const dt = {x: tn.x - tp.x, y: tn.y - tp.y}

        // check if both endpoints moved over the same distance - just move the route
        if ((df.x == dt.x) && (df.y == dt.y)) return this.moveAllPoints(df.x, df.y)

        // adjust the routes - there are 3 topologies
        if (to.is.tack) {
            ( to.dir == "up"   || to.dir == "down")   ? this.adjustHV(fn,tn) : this.adjustHH(fn,tn)
        }
        else if (from.is.tack) {
            ( from.dir == "up" || from.dir == "down") ? this.adjustVH(fn,tn) : this.adjustHH(fn,tn)
        }
        else {
            this.adjustHH(fn,tn)      
        }  
    },

    // Starts and ends horizontally
    // Only one of the end points moves
    // a and be are the next position of the end points of the wire
    adjustHH(a, b) {

        // notation
        let p = this.wire

        // For HH there have to be at least three segments
        if (p.length < 4) return this.makeThreeSegments(a,b)

        // notation
        let last = p.length - 1
        const sMax = p.length-1
        const xMin = style.route.tooClose + 5

        // if we move the start of the route
        if (p[0].x != a.x || p[0].y != a.y) {

            // adjust the starting point
            p[0].x = a.x
            p[0].y = a.y
            p[1].y = a.y

            // check the horizontal = uneven segments, starting from the front
            for(let s = 1; s < sMax; s += 2) {
                const dx = p[s].x - p[s-1].x

                // if the segment is too short
                if (Math.abs(dx) < xMin ) {

                    // s-1 <S> s <S+1> s+1   make the segment <S> minimal length
                    p[s].x = dx > 0 ? p[s-1].x + xMin : p[s-1].x - xMin

                    // and collapse segment <S+1>
                    p[s+1].x = p[s].x
                }
            }
        }

        // move the route at the end
        if (p[last].x != b.x || p[last].y != b.y) {

            // adjust the end point
            p[last].x = b.x
            p[last].y = b.y
            p[last-1].y = b.y

            // check the horizontal = uneven segments, starting from the back
            for(let s = sMax; s > 1; s -= 2) {
                const dx = p[s].x - p[s-1].x
                if (Math.abs(dx) < xMin) {
                    p[s-1].x = dx > 0 ? p[s].x - xMin : p[s].x + xMin
                    p[s-2].x = p[s-1].x
                }
            }
        }
    },

    // horizontal / vertical
    adjustHV(a, b) {
        // maybe create an extra segment
        if (this.wire.length == 2) return this.makeTwoSegments(a, b)

        const p = this.wire
        const last = p.length-1

        p[0].x = a.x
        p[0].y = a.y
        p[1].y = a.y
        p[last].x = b.x
        p[last].y = b.y
        p[last-1].x = b.x
        p[last-1].y = p[last-2].y
    },

    // horizontal / vertical
    adjustVH(a, b) {
        // maybe create an extra segment
        if (this.wire.length == 2) return this.makeTwoSegments(a, b)

        const p = this.wire
        const last = p.length-1

        p[0].x = a.x
        p[0].y = a.y
        p[1].x = a.x
        p[last].x = b.x
        p[last].y = b.y
        p[last-1].x = p[last-2].x
        p[last-1].y = b.y
    },

    adjustFourPointRoute(a,b) {

        // notation
        const tooClose = style.route.tooClose
        const [p0, p1, p2, p3] = this.wire

        // the new middle is the old middle by default
        let mx = p1.x

        // we keep the form of the curve - a z curve remains a z curve, a c curve remains a c curve

        // The vertical is to the right
        if (p1.x > p0.x && p1.x > p3.x) {

            if (p1.x - a.x < tooClose) mx = a.x + tooClose
            else if (p1.x - b.x < tooClose) mx = b.x + tooClose
        }
        // The vertical is to the left
        else if (p1.x < p0.x && p1.x < p3.x) {
            if (a.x - p1.x  < tooClose) mx = a.x - tooClose
            else if (b.x - p1.x < tooClose) mx = b.x - tooClose
        }
        // the vertical is between a and b
        else {
            // the previous length and the new length
            const pL = p3.x - p0.x
            const nL = b.x - a.x

            // calculate the middle x
            mx =   nL == 0 ? a.x 
                 : pL == 0 ? (a.x + b.x)/2
                 : a.x + (p1.x - p0.x) * nL / pL            
        }

        // adjust the points
        p0.x = a.x
        p0.y = a.y
        p1.y = a.y
        p1.x = mx
        p2.x = mx
        p2.y = b.y
        p3.x = b.x
        p3.y = b.y
    },

    makeTwoSegments(a, b) {

        // notation
        const w = this.wire

        // reset the wire
        w.length = 0

        // set 3 points
        w.push({x: a.x, y: a.y})
        w.push({x: b.x, y: a.y})
        w.push({x: b.x, y: b.y})
    },

    makeThreeSegments(a, b) {

        // notation
        const w = this.wire

        // reset the wire
        w.length = 0

        // set four points
        w.push({x: a.x, y: a.y})
        w.push({x: (a.x+b.x)/2, y: a.y})
        w.push({x: (a.x+b.x)/2, y: b.y})
        w.push({x: b.x, y: b.y})
    },

}

