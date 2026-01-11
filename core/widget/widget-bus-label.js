import {shape, style, inside} from '../util/index.js'

// an in out symbol is a triangle 
export function BusLabel(rect, bus) {

    this.rect = {...rect}
    this.is = {
        busLabel: true,
        beingEdited: false,
        highLighted: false,   
        horizontal: true
    }

    // the label text
    this.text = bus.name

    // save the bus
    this.bus = bus
}

// specific bullet functions
const BusLabelFunctions = {

    makeRect(a, b, w, h) {

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
        const wire = this.bus.wire

        // set the size of the label
        const sText = this.text.length * st.sChar + 2*st.hLabel;

        // vertical or horizontal
        (this == this.bus.startLabel) ? this.makeRect(wire[0], wire[1], sText, st.hLabel) : this.makeRect(wire.at(-1), wire.at(-2), sText, st.hLabel) 
    },

    // called when the editing starts
    startEdit() {

        // set the flag
        this.is.beingEdited = true

        // return the field
        return 'text'
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

    drawCursor(ctx, pChar, on) {
        const pCursor = shape.centerTextCursor(ctx, this.rect,this.text,pChar)

        const color = on ? style.std.cBlinkOn : style.std.cBlinkOff

        this.is.horizontal ?
              shape.cursor(ctx, pCursor.x, pCursor.y, style.std.wCursor, this.rect.h,  color)
            : shape.cursor(ctx, this.rect.x, pCursor.y + 0.75 * this.rect.w, this.rect.w, style.std.wCursor, color)
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

        // draw a filter symbol next to the label if required
        if (this.bus.is.filter) shape.filterSymbol(ctx, rc.x - st.wFilter, rc.y - st.wFilter, st.wFilter, cLabel)

        // draw the label
        this.is.horizontal  ? shape.hCableLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
                            : shape.vCableLabel(ctx, this.text, rc.x, rc.y, rc.w, rc.h, st.radius,cLabel,st.cText)
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
