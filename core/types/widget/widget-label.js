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
    startEdit(ctx, click = null) {
        const xText = this.rect.x
        const index = click ? shape.cursorIndex(ctx, this.text, xText, click.x) : this.text.length
        return { prop: 'text', index }
    },

    cursorPos(ctx, i) {
        return {
            x: this.rect.x + ctx.measureText(this.text.slice(0, i)).width,
            y: this.rect.y - 0.25 * this.rect.h
        }
    },

    endEdit(saved) {
        //this.node.look.labelChanged(this, saved)
    },

    render(ctx, look) {

        // notation
        const {x,y,w,h} = this.rect

        // draw the text
        shape.labelText(ctx, this.text, style.label.font, style.label.cNormal, x, y, w, h)
    },

    toJSON() {
        return this.text
    },
}
