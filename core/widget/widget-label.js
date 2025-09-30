import {shape, convert, style} from '../util/index.js'

export function Label(rect, text, node) {

    // mixin the widget
    this.rect = {...rect}

    // the node
    this.node = node

    // binary state 
    this.is = {
        label: true
    }

    // copy the text
    this.text = text
}
// the specific title functions
Label.prototype = {

    // called when editing starts
    startEdit() {
        return 'text'
    },

    endEdit(saved) {
        //this.node.look.labelChanged(this, saved)
    },

    drawCursor(ctx, pChar, on) {
        const rc = this.rect
        const pCursor = shape.labelCursor(ctx, this.text, rc.x,rc.y,rc.w,rc.h,pChar)
        const color = on ? style.std.cBlinkOn : style.std.cBlinkOff
        //const color = on ? style.label.cNormal : style.std.cBackground
        shape.cursor(ctx, pCursor.x, pCursor.y, style.std.wCursor, rc.h, color)
    },

    render(ctx, look) {

        // notation
        const {x,y,w,h} = this.rect

        // change the font
        //ctx.font = style.label.font

        // draw the text
        shape.labelText(ctx, this.text, style.label.font, style.label.cNormal, x, y, w, h)

        // set the font back
        //ctx.font = style.std.font
    },

    toJSON() {
        return this.text

        // return {
        //     label: this.text,
        //     //rect: convert.relativeRect(this.rect, this.node.look.rect)
        // }
    },
}