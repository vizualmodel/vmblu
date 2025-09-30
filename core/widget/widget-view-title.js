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

    startEdit() {
        return 'text'
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
        //shape.roundedHeader(ctx, rc.x,rc.y,rc.w, st.hHeader,st.rCorner, style.header.wLine, null, background)

        // draw the text
        shape.centerText(ctx, this.node.name,style.view.fHeader, cTitle, rc.x, rc.y, rc.w, rc.h)

        // if edited, we have to add a cursor
        if (this.textEdit) {

            let pCursor = shape.centerTextCursor(ctx, rc,this.node.name,this.textEdit.cursor)
            shape.cursor(ctx, pCursor.x, pCursor.y, 2, rc.h, cTitle )
        }
    }
}