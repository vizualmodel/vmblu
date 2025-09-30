import {redox} from '../view/index.js'
export const undoRedoHandling = {

    // Execute a requested edit
    doEdit(verb, param) {

        // execute doit
        redox[verb].doit(param)

        // refresh the editor
        this.redraw()
    },

    // save the edit for later undo/redo
    saveEdit(verb, param) {

        // push the edit on the undo-stack
        this.doc.undoStack.push({verb, param})

        // signal that a new edit has been done
        this.tx.send("new edit",{verb})

        // the model is out of sync with the file and with the raw json
        this.doc.model.is.dirty = true
    },

    // just signal the edit to force a save 
    signalEdit(verb) {
        this.tx.send("new edit",{verb})
    },

    // send a message without saving
    send(msg, param) {

        this.tx.send(msg,param)
    },

    // get the parameters of the edit
    getParam() {
        return this.doc.undoStack.last()?.param ?? {}
    },

    // get the verb of the edit
    getVerb() {
        return this.doc.undoStack.last()?.verb
    },

    // undo the last edit
    undoLastEdit() {

        // pop the action from the stack
        const action = this.doc.undoStack.back()

        console.log('undo ',action ? action.verb : '-nothing-')

        // check
        if (!action) return

        // execute
        redox[action.verb].undo(action.param)
    },

    // redo the last edit
    redoLastEdit() {

        // get the current action
        const action = this.doc.undoStack.forward()

        console.log('redo ',action ? action.verb : '-nothing-')

        //check
        if (!action) return

        // execute
        redox[action.verb].redo(action.param)
    },

    dropLastEdit() {
        this.doc.undoStack.back()
    },



}