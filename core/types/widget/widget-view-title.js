import {shape, style} from '../util/index.js'

export function ViewTitle(rect, node) {

    this.rect = {...rect} 
    this.is={
        viewTitle: true,
        highLighted: false
    }
    this.node = node
    this.text = node.name
}
// the specific title functions
ViewTitle.prototype = {

    startEdit(ctx, click = null) {
        const xText = this.rect.x + (this.rect.w - ctx.measureText(this.text).width) / 2
        const index = click ? shape.cursorIndex(ctx, this.text, xText, click.x) : this.text.length
        return { prop: 'text', index }
    },

    cursorPos(ctx, i) {
        const xText = this.rect.x + (this.rect.w - ctx.measureText(this.text).width) / 2
        return { x: xText + ctx.measureText(this.text.slice(0, i)).width, y: this.rect.y }
    },

    endEdit(saved) {
        node.name = this.text
    },

    render(ctx) {

        // notation
        const rc = this.rect
        const st = style.view

        // background color (uses the box color !)
        const background = this.is.highLighted ? st.cHighLight : st.cLine

        // text color
        const cTitle = this.is.highLighted ? st.cTitleHighLight : st.cTitle

        // the header rectangle
        shape.roundedHeader(ctx, rc.x,rc.y,rc.w, st.hHeader,st.rCorner, st.wLine, null, background)

        // draw the text
        shape.centerText(ctx, this.node.name,style.view.fHeader, cTitle, rc.x, rc.y, rc.w, rc.h)
    }
}
