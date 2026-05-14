import {shape, style, inside} from '../util/index.js'

// an in out symbol is a triangle 
export function BusLabel(rect, bus) {

    this.rect = {...rect}
    this.is = {
        busLabel: true,
        beingEdited: false,
        highLighted: false
//        horizontal: true
    }

    // the label text
    this.text = bus.name

    // the zone for the label
    this.zone = 'N' // N S E W

    // save the bus
    this.bus = bus
}

// specific bullet functions
const BusLabelFunctions = {

    makeRect(w, h) {

        const wire = this.bus.wire
        let [a,b] = (this == this.bus.startLabel) ? [wire[0], wire[1]] : [wire.at(-1), wire.at(-2)]
        const zone = this.zone = (a.x === b.x) ? (a.y < b.y ? 'N' : 'S') : (a.x < b.x ? 'W' : 'E')

        this.rect = zone == 'N' ? {x: a.x - h/2, y: a.y-w, h:w, w:h}
                :   zone == 'S' ? {x: a.x - h/2, y: a.y, h:w, w:h}
                :   zone == 'E' ? {x: a.x, y: a.y-h/2, h, w}
                :   zone == 'W' ? {x: a.x - w, y: a.y-h/2, h, w}
                :   {x:0,y:0,h, w}
    },

    xxmakeRect(a, b, w, h) {

        const rc = this.rect

        // horizontal or vertical label
        this.is.horizontal = Math.abs(a.x - b.x) > 0

        // horizontal
        if (this.is.horizontal) {
            rc.x = (a.x < b.x) ? a.x - w : a.x
            rc.y = a.y - h/2
            rc.h = h
            rc.w = w
        }
        // vertical
        else {
            rc.x = a.x - h/2
            rc.y = (a.y < b.y) ? a.y - w : a.y
            rc.h = w
            rc.w = h

            // exception
            if ((a.y == b.y) && (this == this.bus.startLabel)) rc.y = a.y - w  
        }
    },

    place() {
        //notation
        const st = style.bus

        // set the size of the label
        const sText = this.text.length > 0 ? this.text.length * st.sChar + 2*st.hLabel : st.hLabel

        // make the rectangle
        this.makeRect(sText, st.hLabel)
    },

    // called when the editing starts
    startEdit(ctx, click = null) {

        // set the flag
        this.is.beingEdited = true

        const xText = this.rect.x + this.rect.w / 2 - ctx.measureText(this.text).width / 2
        const index = click ? shape.cursorIndex(ctx, this.text, xText, click.x) : this.text.length
        return { prop: 'text', index }
    },

    cursorPos(ctx, i) {
        const xText = this.rect.x + this.rect.w / 2 - ctx.measureText(this.text).width / 2
        return { x: xText + ctx.measureText(this.text.slice(0, i)).width, y: this.rect.y }
    },

    endEdit(saved) {

        // set the name and the text of the second label
        this.setText(this.text)
        
        // editing is done
        this.is.beingEdited = false
    },

    setText(newText) {
        // set the name and the text of the second label
        const other = (this == this.bus.startLabel) ? this.bus.endLabel : this.bus.startLabel

        // change the text/name
        this.bus.name = newText
        this.text = newText
        other.text = newText

        // place the labels
        this.place()
        other.place()
    },

    render(ctx, look) {

        // if being edited render differently
        if (this.is.beingEdited)  {

            // copy the text to the other label
            const other = this == this.bus.startLabel ? this.bus.endLabel : this.bus.startLabel
            other.text = this.text

            // the width and thus the position of the label have changed
            this.place()
            other.place()
        }
        // notation
        const st = style.bus
        const rc = this.rect
        const state = this.bus.is

        // use a different color when selected
        const cLabel =    state.hoverNok ? st.cBad 
                        : state.selected || state.hoverOk ? st.cSelected 
                        : state.highLighted ? st.cHighLighted
                        : st.cNormal

        // If there is no name we draw a small circular label
        if (!this.text.length && !this.is.beingEdited) {

            const rc = this.rect
            shape.emptyLabel(ctx,rc.x + rc.w/2, rc.y + rc.h/2, st.radius,cLabel)
            return
        }

        // draw the label
        (this.zone == 'E' || this.zone == 'W')  ? shape.hBusLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
                                                : shape.vBusLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
    },

    setSize(ctx) {
        this.rect.w = ctx.measureText(this.text).width + 2*style.bus.hLabel
        this.rect.h = style.bus.hLabel
        return this
    },

    move(dx, dy) {
        this.rect.x += dx
        this.rect.y += dy
    },

    highLight() {
        this.is.highLighted = true
    },

    unHighLight() {
        this.is.highLighted = false
    },

    // checks if a label is inside a rectangle
    inside(rect) {
        return inside({x:this.rect.x, y:this.rect.y}, rect)
    }
}
Object.assign(BusLabel.prototype, BusLabelFunctions)
