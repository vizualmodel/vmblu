import {Widget} from '../widget/index.js'
import {style, eject, inside} from '../util/index.js'
import {View} from './view-base.js'


// view functions that are independant of the content of the view
export const viewWidgetHandling = {

// note that this is the *inverse* coord transformation that is used by the canvas
// The canvas transformation goes fom window coordinates down to screen coordinates
// With this function we transform cursor coordinates up to the window coordinates !
localCoord(a) {  
    const tf = this.tf
    return {x:(a.x - tf.dx)/tf.sx, y:(a.y - tf.dy)/tf.sy}
},

// The inverse of the above 
inverse(a) {  
    const tf = this.tf
    return {x: a.x*tf.sx + tf.dx, y: a.y*tf.sy + tf.dy}
},

// create a new view
newSubView(node, rc=null, tf=null) {

    // do we need to calculate the rectangle ?
    rc = rc ?? this.makeViewRect(node)

    // make a view
    let view = new View(rc, node, this)

    // if a transform is given, set it
    if (tf) view.setTransform(tf)

    // add the title bar etc.
    view.addViewWidgets()

    // and place the widgets
    view.placeWidgets()

    // add the view to the views
    this.views.push(view)

    // set the parent view
    // view.parent = this
    
    // save the view in the (root) node 
    node.savedView = view

    // return the new view
    return view
},

// puts a saved view in the view list again - if not yet cooked (no root !) - cook the view first
restoreView(node) {

    // if the view is still in a raw state 
    if (node.savedView.raw) {

        // create the subview
        node.savedView = this.newSubView(node, node.savedView.rect, node.savedView.tf)
    }

    // the view should not be in the current view
    if (this.views.find( v => v == node.savedView)) {
        console.error("View already in views in restore view !")

        // or should we bring it to the foreground ?
        return
    }

    // push on the view stack
    if (this == node.savedView) {
        console.error("Circular reference in views")
        return
    }

    // set state to visible
    node.savedView.viewState.visible = true

    // push the view on the views stack and set the parent
    this.views.push(node.savedView)
    node.savedView.parent = this
},

closeView() {
    // The top level view cannot be closed
    if (!this.parent) return
    this.viewState.visible = false
    if (this.parent.views) eject(this.parent.views, this)
},

// after loading a file we have to cook the views that are visible from the start
restoreSubViews() {

    // reset the views
    this.views.length = 0

    // there should be a root with nodes
    if ( ! this.root?.nodes) return

    // check all nodes
    for (let node of this.root.nodes) {

        // check
        if (!node.savedView || node.savedView.state == 'closed') continue

        // restore it
        node.savedView = this.newSubView(node, node.savedView.rect, node.savedView.tf)

        // if a node has a visible view we have to check its nodes as well
        node.savedView.restoreSubViews()
    }
},

move(delta) {
    // also adapt the tf matrix
    this.tf.dx += delta.x
    this.tf.dy += delta.y

    // move the rectangle
    this.rect.x += delta.x
    this.rect.y += delta.y

    // also move the widgets 
    this.widgets?.forEach( widget => {
        widget.rect.x += delta.x
        widget.rect.y += delta.y
    })
},

resize(border,delta) {

    // notation
    const rc = this.rect

    switch (border.name) {

        case 'corner': 
            if (rc.h + delta.y > style.view.hHeader) rc.h += delta.y
            if (rc.w + delta.x > style.look.wBox) rc.w += delta.x
            break

        case 'top':
            if (rc.h - delta.y < style.view.hHeader) return
            rc.y += delta.y
            rc.h -= delta.y
            break

        case 'bottom':
            if (rc.h + delta.y < style.view.hHeader) return
            rc.h += delta.y
            break

        case 'right':
            if (rc.w + delta.x < style.look.wBox) return 
            rc.w += delta.x
            break

        case 'left':
            if (rc.w - delta.x < style.look.wBox) return
            rc.x += delta.x
            rc.w -= delta.x
            break
    }

    // reposition the widgets
    this.placeWidgets()
},

// check the views in reverse order - p is the position in local coordinates
// returns the view, the widget and the local coordinate in that view
// ** RECURSIVE **
whichView(p) {

    const hdr = style.view.hHeader
    const lwi = style.view.wLine

    // check the views in reverse order - the last one is on top !
    for (let i = this.views.length-1; i>=0; i--) {

        // notation
        const view = this.views[i]
        const rc = view.rect

        // first check if p is inside the client area of the view
        if (((p.x >= rc.x + lwi) && (p.x <= rc.x + rc.w - lwi) && (p.y >= rc.y + hdr) && (p.y <= rc.y + rc.h - lwi))) {

            // transform p to a coordinate inside this view
            p = view.localCoord(p)

            // check if the coordinate is inside a view in this view
            return view.whichView(p)
        }

        // maybe we have hit the header or the border - we know already that we are not in the client area
        const eps = 4   // some epsilon - extra space around the border
        if ((p.x < rc.x - eps) || (p.x > rc.x + rc.w + eps) || (p.y < rc.y - eps) || (p.y > rc.y + rc.h + eps)) continue

        // when we arrive here it means we are in the the header or on the borders of the view
        // check *ALL* the widgets, but skip the viewBox
        let match = null
        for (const widget of view.widgets) if (inside(p,widget.rect) && !widget.is.viewBox) match = widget

        // found the *closest* match
        if (match) return [view, match, p]

        // now check if we are on the borders of the view - we return a pseudo widget !
        if (p.x < rc.x + lwi) return [view, {is:{border:true}, name:'left'},p]

        if (p.x > rc.x + rc.w - lwi)  {

            return (p.y > rc.y + rc.h - 20) ? [view, {is:{border:true}, name:'corner'},p]
                                            : [view, {is:{border:true}, name:'right'},p]
        }
        if (p.y < rc.y + lwi) return [view, {is:{border:true}, name:'top'},p]

        if (p.y > rc.y + rc.h - lwi)  {

            return (p.x > rc.x + rc.w - 20) ? [view, {is:{border:true}, name:'corner'},p]
                                            : [view, {is:{border:true}, name:'bottom'},p]
        }

    }
    return [this, null, p]
},

// // This function calculates the visible rectangle of the canvas
// getVisibleCanvasRect(canvas) {
    
//     const viewportWidth = window.visualViewport.width; // Visible width of the webview
//     const viewportHeight = window.visualViewport.height; // Visible height of the webview

//     // Get canvas position and dimensions
//     const rect = canvas.getBoundingClientRect();

//     // Calculate the visible area within the viewport
//     const visibleX = Math.max(0, rect.left);
//     const visibleY = Math.max(0, rect.top);
//     const visibleWidth = Math.min(rect.width, viewportWidth - visibleX);
//     const visibleHeight = Math.min(rect.height, viewportHeight - visibleY);

//     // Ensure values are positive
//     return {
//         x: visibleX,
//         y: visibleY,
//         width: Math.max(0, visibleWidth),
//         height: Math.max(0, visibleHeight),
//     };
// },

iconClick(icon, editor) {

    // check the type of action for the widget
    switch(icon.type) {

        // close the view
        case 'close': {

            // for a view that is closed, we will not save the parameters to file
            this.viewState.visible = false

            // reset the previous view parameters if coming from fullscreen
            if (this.viewState.big) this.small();

            // change focus
            editor.switchView(this.parent)

            // close the view
            this.closeView()
        }
        break

        // fullscreen acts as a toggle
        case 'big': {
            // get all the parent views
            const parents = this.parentViewsReverse()

            // switch all the parents to big
            for(const parent of parents)  parent.big()

            // and finally do the same for this view
            this.big()
        }
        break
        
        case 'small': {

            // switch to normal window size
            this.small()

            // big views inside this view are also restored
            for(const view of this.views) if (view.viewState.big) view.small()
        }
        break

        case 'calibrate' : {
            this.toggleTransform()
        }
        break

        case 'grid': {
            this.state.grid = !this.state.grid
        }
        break
    }
},



viewToFront(frontView) {

    // the new view is part of the views of the doc
    const views = this.views
    const L = views.length

    // bring the view to the end of the array - so it is drawn on top
    let index = views.indexOf(frontView)
    let found = views[index]
    
    // shift the views below it one place
    for (let i = index; i < L-1; i++) views[i] = views[i+1]
    views[L-1] = found
},

cloneForTab() {
    // create a new view
    let view = new View({x:0,y:0,w:0,h:0}, this.root, this.parent)

    // position the tab content at the same place as the window was
    view.tf.dx = this.tf.dx
    view.tf.dy = this.tf.dy
    view.tf.sx = this.tf.sx
    view.tf.sy = this.tf.sy

    // copy some additional content
    view.views = this.views

    // copy the parent
    // view.parent = this.parent

    // done
    return view
},

// note that we place the widgets in placeWidgets !
addViewWidgets() {

    // notation
    const rc = this.rect
    const st = style.view

    // add the box - re-use the view rectangle...
    this.widgets.push(new Widget.ViewBox(this.rect))

    // add the title
    if (this.root) this.widgets.push(new Widget.ViewTitle({ x:0,y: 0, w: rc.w, h: style.view.hHeader}, this.root))

    // add the view icons
    for( const iconName of ['close', 'big', 'calibrate', 'grid']) {

        // create the icon
        const icon = new Widget.Icon( { x:0, y:0, w: st.wIcon, h: st.hIcon}, iconName)

        // and set its render function
        icon.setRender()

        // icons are highlighted by default, so set as non-highlighted
        icon.is.highLighted = false

        // and save
        this.widgets.push(icon)
    } 
},

// place widgets is called when the view changes size or place
placeWidgets() {

    // notation
    const rc = this.rect
    const st = style.view

    // The position of the first Icon
    let xIcon = rc.x + st.xPadding

    for(const widget of this.widgets) {
        if (widget.is.icon) {
            // center on y
            widget.rect.y = rc.y + (style.view.hHeader - st.hIcon)/2

            // set the x
            widget.rect.x = xIcon

            // adjust x
            xIcon += (st.wIcon + st.xSpacing)

            // after the last view icon we add some extra space
            // if (widget.type == 'grid') xIcon += st.xSpacing
        }
        else if (widget.is.viewBox) {
            widget.rect.x = rc.x
            widget.rect.y = rc.y
            widget.rect.w = rc.w
            widget.rect.h = rc.h
        }
        else if (widget.is.viewTitle) {
            widget.rect.x = rc.x
            widget.rect.y = rc.y
            widget.rect.w = rc.w
        }
    }
},

// toggle the transform for a single view
toggleTransform() {

    const tf = this.tf
    const vstf = this.viewState.tf

    // if the current transform is not the unit transform
    if (tf.sx != 1.0) {

        // save the current transform
        this.saveTransform(this.tf)

        // and switch to the unit transform
        this.setTransform({sx:1.0, sy:1.0, dx: tf.dx, dy: tf.dy})

        // recalculate all the windows that are big
        this.redoBigRecursive() 
    }
    // else we have a saved transform (i.e. it is not the unit transform)
    else if (vstf.sx != 1.0) {

        // switch to the saved transform
        this.setTransform(vstf)

        // recalculate all the windows that are big
        this.redoBigRecursive() 
    }
},

// parent views - the toplevel parent will be the first entry
parentViewsReverse() {

    // put the view and the views above it in an array
    const parents = []

    // search all parent views
    let view = this
    while (view.parent) {
        parents.push(view.parent)
        view = view.parent
    }

    // reverse the order of the array
    return parents.reverse()
},

toggleBig() {

    if (this.viewState.big) {

        // switch to normal window size
        this.small()

        // big views inside this view are also restored
        for(const view of this.views) if (view.viewState.big) view.toggleBig()
    }
    else {

        // get all the parent views
        const parents = this.parentViewsReverse()

        // switch all the parents to big
        for(const parent of parents)  parent.big()

        // and finally do the same for this view
        this.big()
    }
},

small() {

    // ok copy 
    Object.assign( this.rect , this.viewState.rect)

    // change the icon
    this.widgets.find( icon => icon.type == 'small')?.switchType('big')

    // reposition the widgets
    this.placeWidgets()

    // toggle the flag
    this.viewState.big = false
},

// We do not want to save the rectangle when we *redo* big (see below)
// because we have already saved it then
big(save=true) {

    // check that the view has a parent and is not big already
    if ( !this.parent) return

    // notation
    const prc = this.parent.rect
    const ptf = this.parent.tf
    const st = style.view

    // save the current rect
    if (save) Object.assign(this.viewState.rect, this.rect)

    // If the parent has no parent there is no header
    const yShift = this.parent.parent ? st.hHeader : 0

    // convert the parent top left coordinates to local coordinates so that they will result 
    // in the correct position *after* the parent tarnsform is applied !
    this.rect.x = (prc.x - ptf.dx)/ptf.sx 
    this.rect.y = (prc.y + yShift - ptf.dy)/ptf.sy
    this.rect.w = prc.w / ptf.sx 
    this.rect.h = (prc.h - yShift) / ptf.sy

    // change the icon
    this.widgets.find( icon => icon.type == 'big')?.switchType('small')
    
    // reposition the widgets
    this.placeWidgets()

    // set the fullscreen flag
    this.viewState.big = true
},

redoBigRecursive() {
    if (this.viewState.big) this.big(false);
    for (const view of this.views) view.redoBigRecursive()
},

/// NOT USED BELOW HERE

// // recalibrate all the views
// toggleTransformRecursive() {
//     (this.tf.sx != 1.0) ? this.unitTransformRecursive() : this.restoreTransformRecursive();
// },

// unitTransformRecursive() {

//     // save the current transform
//     this.saveTransform(this.tf)

//     // and switch to the unit transform
//     this.setTransform({sx:1.0, sy:1.0, dx: this.tf.dx, dy: this.tf.dy})

//     if (this.viewState.big) this.big()

//     // repeat for all views
//     for (const view of this.views) view.unitTransformRecursive()
// },

// restoreTransformRecursive() {

//     // restore the saved transform
//     if (this.viewState.tf.sx != 1.0) this.setTransform(this.viewState.tf);

//     if (this.viewState.big) this.big()

//     // repeat for all views
//     for (const view of this.views) view.restoreTransformRecursive()
// },

// toggleViewState() {

//     if (this.viewState.big) {

//         // go back to the previous rectangle
//         this.restoreViewState()

//         // also restore views inside the view to their previous size
//         for(const view of this.views) view.restoreViewState()
//     }
//     else {

//         // get all the parent views
//         const parents = this.parentViewsReverse()

//         // switch all the parents to fullscreen
//         for(const parent of parents) {
//             parent.saveViewState()
//             parent.big()
//         }

//         // and finally do the same for this view
//         this.saveViewState()
//         this.big()
//     }
// },

// // note that we only save and restore the rectangle - not the transform - is more intuitive behaviuour
// saveViewState() {
//     // just assign the current settings
//     Object.assign(this.viewState.rect, this.rect)
//     Object.assign(this.viewState.tf, this.tf)

//     // and validate the copy
//     this.viewState.saved = true
// },

// restoreViewState() {

//     // check that we have a valid previous
//     if (!this.viewState.saved) return

//     // we are not fullscreen anymore
//     this.viewState.big = false

//     // ok copy 
//     Object.assign( this.rect , this.viewState.rect)
//     Object.assign( this.tf,    this.viewState.tf)

//     // we have restored the view, so we have to reposition the widgets
//     this.placeWidgets()
// },

}