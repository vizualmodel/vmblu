import {shape, convert, style} from '../util/index.js'

export function Header(rect, node) {

    // the rectangle
    this.rect = {...rect}

    // binary state 
    this.is = {
        header: true,
        highLighted: false,
        alert: false
    }
    // the title is the name of the node
    this.title = node.name

    // and set the node
    this.node = node
}
// the specific title functions
Header.prototype = {

    // called when editing starts
    startEdit(ctx, click = null) {

        const rc = this.rect
        const xText = rc.x + rc.w / 2 - ctx.measureText(this.title).width / 2
        const index = click ? shape.cursorIndex(ctx, this.title, xText, click.x) : this.title.length
        return { prop: 'title', index }
    },

    cursorPos(ctx, i) {
        const rc = this.rect
        const xText = rc.x + rc.w / 2 - ctx.measureText(this.title).width / 2
        return { x: xText + ctx.measureText(this.title.slice(0, i)).width, y: rc.y }
    },

    endEdit(saved) {

        // trim whitespace from the text that was entered
        this.title = convert.cleanInput(this.title)

        // check for consequences...
        this.node.look.headerChanged(this, saved)

        // check if the node name is unique 
        //editor.doc.focus.root.checkDuplicates(this.node)
    },

    render(ctx) {

        // notation
        let st = style.header
        let {x,y,w,h} = this.rect

        // render the top of the look with rounded corners..
        shape.roundedHeader(ctx, x, y, w, h, st.rCorner, st.wLine, st.cBackground, st.cBackground)

        // select a color
        const color = this.node.is.duplicate ? st.cBad : (this.is.highLighted ? st.cHighLighted : st.cTitle)

        // draw the text
        shape.centerText(ctx, this.title, st.font, color, x, y, w, h)

        if (this.is.alert) shape.circle(x,y,10,'#ff0000');
    },

    // true if the title area was hit (the y-hit is already established !)
    hitTitle(pos) {

        const icon = style.icon
        const rc = this.rect

        // the space for the icons left and right
        const xLeft = rc.x + icon.xPadding + 2*(icon.wIcon + icon.xSpacing)
        const xRight = rc.x + rc.w - icon.xPadding - 2*(icon.wIcon + icon.xSpacing)

        // check if outside the icon area
        return ((pos.x > xLeft) && (pos.x < xRight))
    },

    toJSON() {
        return {
            header: this.title,
            // rect: convert.relativeRect(this.rect, this.node.look.rect)
        }
    },
}
