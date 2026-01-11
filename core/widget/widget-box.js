import {shape, convert,style} from '../util/index.js'

export function Box(rect, node) {

    this.rect = {...rect}

    this.node = node

    // binary state 
    this.is = {
        box: true,
        selected: false,
        alarm: false
    }

}
// the specific box functions
Box.prototype = {

    render(ctx) {

        // notation
        const {x,y,w,h} = this.rect
        const st = style.box

        // draw the selection rectangle first if needed !
        if (this.is.alarm) {
            const dx = st.dxSel
            const dy = st.dySel
            shape.roundedRect(ctx,x-2*dx, y-2*dy, w+4*dx, 4*dy, st.rCorner, st.wLineSel, st.cAlarm.slice(0,7), st.cAlarm)
        }
        if (this.is.selected) {

            // check for a label
            const label = this.node.look.findLabel()
            const hLabel = label && (label.text.length > 0) ? label.rect.h : 0
            const dx = st.dxSel
            const dy = st.dySel
            shape.roundedRect(ctx,x-dx, y-dy-hLabel, w+2*dx, h+2*dy+hLabel, st.rCorner, st.wLineSel, st.cSelected.slice(0,7), st.cSelected)
        }

        // draw a rounded filled rectangle
        shape.roundedRect(ctx,x, y, w, h, st.rCorner, st.wLine, st.cLine, st.cBackground)
    },

    increaseHeight( delta) {
        this.rect.h += delta
    },

    increaseWidth( delta) {
        this.rect.w += delta
    },

    toJSON() {
        return {
            box: convert.relativeRect(this.rect, this.node.look.rect)
        }
    },
}