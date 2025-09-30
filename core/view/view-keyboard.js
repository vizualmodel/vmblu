import {doing} from './view-base.js'
import {editor} from '../editor/index.js'
import {style} from '../util/index.js'
import {justKeyTable, ctrlKeyTable} from './view-keytable.js'

export const keyboardHandling = {

    // helper function
    _logKey(e) {
        let keyStr = 'Key = '
        if (e.ctrlKey)  keyStr += 'ctrl ' 
        if (e.shiftKey) keyStr += 'shift '
        keyStr += '<'+e.key+'>'
        console.log(keyStr)
    },

    // keyboard press - return true if key is handled
    onKeydown(e) {
        
        // select the required key-handling function
        if (this.state.action == doing.nothing) {

            // get the action
            const action = e.ctrlKey ? ctrlKeyTable[e.key] : justKeyTable[e.key]

            // check
            if (!action) return false

            // do it
            action(this)

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

    onKeyup(e) {
        return false
    },

    beginTextEdit( object, cursor=-1, clear=false) {

        // check if field is editable - must return the prop that will be edited
        const prop = object.startEdit?.()

        // check
        if (!prop) return

        // start a new edit for the prop of the object
        this.textField.newEdit(object, prop, cursor)

        // if clear, clear the field first
        if (clear) this.textField.clear()

        // set the status of the editor
        this.stateSwitch(doing.editTextField)

        // change the active view
        editor.switchView(this)

        // show a blinking cursor
        this.startBlinking()
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

    // editText(e) {

    //     let done = false

    //     // of the special keys
    //     if ( e.key.length > 1 || e.ctrlKey)
    //         done = this.textField.handleSpecialKey?.(e)
    //     else
    //         done = this.textField.handleKey?.(e)

    //     // continue editing ?
    //     if (done) this.stateSwitch(doing.nothing)
    // },

    startBlinking() {

        let lastTime = 0;
        let on = true;
        let keepBlinking = true
    
        // time is in ms
        const blinkFunction = (time) => {

            // check the time
            if (time - lastTime >= style.std.blinkRate) {

                // execute the recursive blink function from the top !
                keepBlinking = editor.doc.view.recursiveBlink(editor.ctx, on)

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

    recursiveBlink(ctx, on) {

        // save the current status
        ctx.save()

        // notation
        const tf = this.tf

        // adjust the transform for this view
        ctx.transform(tf.sx, 0.0, 0.0, tf.sy, tf.dx, tf.dy)

        // keep track of the cursor
        let keepBlinking = false

        // draw the cursor if there is a field doing a text edit
        if (this.state.action == doing.editTextField) {
            keepBlinking = true
            const txt = this.textField
            txt.obj.drawCursor(ctx, txt.cursor, on)
        }

        // check all the subviews
        for (const view of this.views) keepBlinking = view.recursiveBlink(ctx, on) || keepBlinking

        // restore the ctx state
        ctx.restore()

        return keepBlinking
    },
    
}