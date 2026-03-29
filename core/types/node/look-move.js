import {style} from '../util/index.js'

export const moveHandling = {

    moveDelta(x,y) {

        // adjust the position
        this.rect.x += x
        this.rect.y += y

        // adjust the widgets
        this.widgets.forEach( (widget) => { 

            // change the widget position
            widget.rect.x += x
            widget.rect.y += y
        })
    },

    // move to absolute position
    moveTo(x,y) {

        // calculate the delta and move over the delta...
        this.moveDelta(x - this.rect.x, y - this.rect.y)
    },

    // x and y are actually delta's ! 
    // a group of nodes has been moved - move the routes also
    // change the position of the routes -- only from ! -- we only want to move the segments once !
    // moveRoutes(x,y) {
    //     this.widgets.forEach( (widget) => { 
    //         widget.routes?.forEach( route => route.from == widget ? route.moveAllPoints(x,y) : null )
    //     })
    // },

    // adjust all the routes for widgets with routes
    adjustRoutes() {  
        for (const widget of this.widgets) {
            if (widget.routes)  widget.adjustRoutes()
        }
    },

    // move all the points of the routes over the delta
    moveRoutes(dx,dy) {
        for (const widget of this.widgets) {
            if (widget.routes) {
                for (const route of widget.routes) if (route.from == widget) route.moveAllPoints(dx, dy)
            }
        }
    },

    // // move or adjust the routes
    // moveOrAdjustRoutes() {
    //     for (const widget of this.widgets) {
    //         if (widget.routes) {
    //             for (const route of widget.routes) route.adjust()            
    //         }
    //     }
    // },

    // this is used to move a group of widgets up or down in a node - used in undo operation
    groupMove(group, dy) {

        // helper function
        const yMove = (widget,delta) => {
            widget.rect.y += delta
            if (widget.is.pin) widget.adjustRoutes()
        }

        // the y position and size of the group to move
        const a = group[0].rect.y
        const b = group.at(-1).rect.y 
        const size = b - a + group.at(-1).rect.h

        // dy is positive for moving down and negative for moving up
        for (const widget of this.widgets) {

            //notation
            const wy = widget.rect.y

            // move the widgets of the group up or down
            if ((wy <= b) && (wy >= a)) yMove(widget, dy) 
            
            // if down, move the widget 'dy' below, up
            else if ( (dy > 0) && (wy  > b) && (wy <= b + dy)) yMove(widget, -size) 

            // if up move the widget 'dy' above, down
            else if ( (dy < 0) && (wy  < a) && (wy >= a + dy)) yMove(widget, size) 
        }
    },

   // find the next widget up or down that passes the check
   findNextWidget(current,pos,check) {

        // the widget that will change position with the selected widget
        let cry = current.rect.y

        // if on the widget return null
        if ((pos.y >= cry) && (pos.y <= cry + current.rect.h)) return null

        // now we check if we have to move one position up or down
        let next = null

        // if above the current widget
        if (pos.y < cry) {
            // find the widget just above ...
            for (const widget of this.widgets) {
                if ( !check(widget) || widget == current) continue
                if ((widget.rect.y < cry)&&( next == null || (next.rect.y < widget.rect.y))) next = widget
            }
        }
        // if below the current widget
        else if (pos.y > cry + current.rect.h) {
            // find the widget just below...
            for (const widget of this.widgets) {
                if (!check(widget) || widget == current) continue
                if ((widget.rect.y > cry)&&( next == null || (next.rect.y > widget.rect.y))) next = widget
            }         
        }

        return next
    },

    // findPinAtY(y) {
    //     for (const widget of this.widgets) {
    //         if (!widget.is.pin) continue;
    //         if (widget.rect.y < y && (widget.rect.y + widget.rect.h) > y) return widget
    //     }
    //     return null;
    // },

    // moves the node to make routes perfectly alligned.
    // it takes the first route that is not alligned and moves the node to make it aligned.
    snapRoutes() {

        for( const pin of this.widgets) {

            // only pins have routes
            if (!pin.is.pin) continue

            // check all the short routes
            for (const route of pin.routes) {

                // notation
                const p = route.wire

                // routes should have at least three points
                if (p.length < 3) continue

                // notation
                const [a,c] = (pin == route.from) ? [p[0], p[2]] : [p.at(-1), p.at(-3)] 

                // check if we have to move the node in the y direction a bit...
                const delta = c.y - a.y
                if (Math.abs(delta) < style.route.tooClose) {

                    // move the node
                    this.moveDelta(0, delta)

                    // adjust the endpoins of all the routes
                    this.adjustRoutes()

                    // we only do this once, so return now !
                    return
                }
            }
        }
    }
}