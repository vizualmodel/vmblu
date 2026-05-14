import {doing} from './view-base.js'
import {style, shape} from '../util/index.js'
import {justKeyTable, ctrlKeyTable} from './view-keytable.js'

export const keyboardHandling = {

    // helper function for debugging
    _logKey(e) {
        let keyStr = 'Key = '
        if (e.ctrlKey)  keyStr += 'ctrl ' 
        if (e.shiftKey) keyStr += 'shift '
        keyStr += '<'+e.key+'>'
        console.log(keyStr)
    },

    // keyboard press - return true if key is handled
    onKeydown(e,tx) {
        
        // select the required key-handling function
        if (this.state.action == doing.nothing) {

            // get the action
            const action = e.ctrlKey ? ctrlKeyTable[e.key] : justKeyTable[e.key]

            // check
            if (!action) return false

            // do it
            action(this,tx)

            // done
            return true
        }
        // we are doing text editing...
        else if (this.state.action == doing.editTextField) {

            // select the handler function
            const done = ( e.key.length > 1 || e.ctrlKey) ? this.textField.handleSpecialKey?.(e) : this.textField.handleKey?.(e)
    
            // continue editing ?
            if (done) this.stateSwitch(doing.nothing)

            return true
        }

        else return false
    },

    onKeyup(e,tx) {
        return false
    },

    beginTextEdit( object, xyLocal = null, clear=false) {

        const manager = this.getManager()
        const ctx = manager?.getCanvasContext()
        if (!ctx) return

        // check if field is editable - must return the prop that will be edited
        const {prop, index} = object.startEdit?.(ctx, xyLocal)

        // check
        if (!prop) return

        // start a new edit for the prop of the object
        this.textField.newEdit(object, prop, index)

        // if clear, clear the field first
        if (clear)  this.textField.clear()

        // set the status
        this.stateSwitch(doing.editTextField)

        // change the active view
        manager.switchFocus(this)

        // show a blinking cursor
        this.startBlinking(ctx)
    },

    // end text edit is called from switch state !
    endTextEdit() {

        // notation
        const state = this.state
        const text = this.textField

        // stop the blinking cursor
        clearInterval( state.cursorInterval )

        // check
        if (!text) return

        // notify the object of the end of the edit
        text.obj.endEdit?.(text.saved)
    },

    startBlinking(ctx) {

        let lastTime = 0;
        let on = true;
        let keepBlinking = true
    
        // time is in ms
        const blinkFunction = (time) => {

            // check the time
            if (time - lastTime >= style.std.blinkRate) {

                // execute the recursive blink function from the top !
                keepBlinking = this.blink(ctx, on)

                // Toggle cursor visibility
                on = !on;
                lastTime = time;
            }
    
            // Continue the loop if we're still editing
            if (keepBlinking) requestAnimationFrame(blinkFunction);
        };
    
        // schedule the first blink function
        requestAnimationFrame(blinkFunction);
    },

    blink(ctx, on) {

        // if the editing has stopped, we can stop blinking
        if (this.state.action !== doing.editTextField)  return false   
        
        // notation
        const field = this.textField

        // save the current status
        ctx.save()

        // use the same accumulated content transform as normal view rendering
        this.applyContentTransform(ctx)

        // get the cursor x position
        const cursor = field.obj.cursorPos?.(ctx, field.cursor) ?? {x:0, y:0}

        // get the color
        const color = on ? style.std.cBlinkOn : style.std.cBlinkOff

        // draw the cursor
        shape.cursorDraw(ctx, cursor.x, cursor.y, style.std.wCursor, style.std.hCursor, color )

        // restore the ctx state
        ctx.restore()

        // keep blinking
        return true
    },    
}
