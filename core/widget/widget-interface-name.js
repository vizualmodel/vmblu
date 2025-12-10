import {shape, convert, style} from '../util/index.js'

export function InterfaceName(rect, text, node) {

    // mixin the widget
    this.rect = {...rect}

    // the node
    this.node = node

    // binary state 
    this.is = {
        ifName: true,
        added: false ,              // has been added 
        zombie: false,              // interface name has been deleted (not used -> interfaceNames are free form ...)
        selected: false,
        highLighted: false
    }
    // the text in the ifName
    this.text = text ?? ''

    // the widget id
    this.wid = 0
}
// the specific title functions
InterfaceName.prototype = {

    // called when editing starts
    startEdit() {
        return 'text'
    },

    endEdit(saved) {

        // clean the user input
        this.text = convert.cleanInput(this.text)

        // make modifications as required (pins that use the ifName name)
        this.node.look.ifNameChanged(this, saved)
    },

    drawCursor(ctx, pChar, on) {

        // where to put the cursor
        const pos = shape.centerTextCursor(ctx,this.rect,this.text, pChar)

        // select color - on or off
        const color = on ? style.std.cBlinkOn : style.std.cBlinkOff
        //const color = on ? style.header.cTitle : style.header.cBackground 

        // draw it
        shape.cursor(ctx, pos.x , pos.y, style.std.wCursor, this.rect.h, color )
    },

    render(ctx, look) {
        // notation
        const st = style.ifName

        const color =   this.is.added ? st.cAdded : 
                        this.is.zombie ? st.cBad : 
                        this.is.highLighted ? st.cHighLighted :
                        this.is.selected ? st.cSelected : 
                        st.cNormal

        // draw
        shape.ifName(ctx, this.text, {line:st.cBackground, text:color},this.rect) 
    },

    toJSON() {
        return {
            ifPins: this.text,
            id: this.wid
        }
    },

    drag(pos) {

        // notation
        const rc = this.node.look.rect

        // find pin or ifName to swap with
        const next = this.node.look.findNextWidget(this, pos, next => next.is.pin || next.is.ifName)

        // if no next - done
        if (!next) return;

        // swap
        [this.rect.y, next.rect.y] =[next.rect.y, this.rect.y]

        // if the next is a pin check what to do with the prefix (add it or remove it)
        if (next.is.pin) next.ifNamePrefixCheck(); 

        // reconnect the routes to the widgets that changed place
        if (next.is.pin) next.adjustRoutes()
    },

    moveTo(y) {

        // notation - ifName rectangle
        const src = this.rect

        // a widget between the new and the old place has to be moved up or down
        for (const widget of this.node.look.widgets) {

            // notation
            const wrc = widget.rect

            // up or down
            if ((src.y > y) && (wrc.y >= y) && (wrc.y < src.y)) {
                wrc.y += src.h
                if (widget.is.pin) widget.adjustRoutes()
            }
            if ((src.y < y) && (wrc.y <= y) && (wrc.y > src.y)) {
                wrc.y -= src.h
                if (widget.is.pin) widget.adjustRoutes()
            }
        }
        // place the pin at y
        src.y = y
    },

    highLight() {
        this.is.highLighted = true
    },

    unHighLight() {
        this.is.highLighted = false
    },

    doSelect() {
        this.is.selected = true
    },

    unSelect() {
        this.is.selected = false
    },
}