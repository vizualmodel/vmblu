import {shape, convert,style} from '../util/index.js'

export function ViewBox(rect) {

    this.rect = {...rect}

    // binary state 
    this.is = {
        viewBox: true,
        highLighted: false,
    }

}
// the specific box functions
ViewBox.prototype = {

    render(ctx) {

        // notation
        const rc = this.rect
        const st = style.view

        // select the color
        const color = this.is.highLighted ? st.cHighLight : st.cLine

        // draw the rectangle 
        shape.viewRect(ctx, rc.x,rc.y,rc.w, rc.h, st.rCorner, st.wLine, color, st.cBackground)
    },
}