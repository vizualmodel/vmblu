export function TextEdit() {

    // the cursor can have position 0 to l (l+1 values) if the field has length l 
    // 0 is in front of character 0
    // l-1 is in front of character l-1
    // l is at the very end

    this.cursor = 0             // place the cursor at the end
    this.saved = null           // save the current value
    this.obj= null              // the object where there is an editable prop
    this.prop= null             // the prop that needs editing
    this.keyPressed = null      // the last key pressed - for clients use
}

TextEdit.prototype = {

    // new edit
    newEdit(obj, prop, cursor=-1) {
        this.cursor = cursor < 0 ? obj[prop].length : 0  // place the cursor at the end
        this.saved = obj[prop]          // save the current value
        this.obj = obj                  // the object where there is an editable prop
        this.prop= prop                 // the prop that needs editing
        this.keyPressed = null          // for clients use
    },

    clear() {
        this.obj[this.prop] = ''
        this.cursor = 0
    },

    // return true to stop editing
    handleKey(e) {

        // for clients
        this.keyPressed = e.key

        // notation
        let cursor = this.cursor
        const obj = this.obj
        const prop = this.prop

        // split the field in two parts - slice(a,b) does not include b
        let before = cursor > 0 ? obj[prop].slice(0,cursor) : ''
        let after = cursor < obj[prop].length-1 ? obj[prop].slice(cursor) : ''
        
        //reassemble the new value..
        obj[prop] = before + e.key + after

        // shift the cursor one place
        this.cursor++

        return false
    },

    // return true to stop editing
    handleSpecialKey(e) {

        // for clients...
        this.keyPressed = e.key

        switch(e.key) {

            case "Shift":
                return false
                
            case "Backspace":
                // notation
                let cursor = this.cursor
                let name = this.obj[this.prop]

                // split the field in two parts - remove the last character of the first part
                let before = cursor > 0 ? name.slice(0,cursor-1) : ''
                let after = cursor < name.length ? name.slice(cursor) : ''

                //reassemble the new value..
                this.obj[this.prop] = before + after

                // shift the cursor one place, but not beyond 0
                cursor > 0 ? this.cursor-- : 0

                // done
                return false

            case "Enter":
                 return true
            
            case "ArrowLeft":
                if (this.cursor > 0) this.cursor-- 
                return false
            
            case "ArrowRight":
                if (this.cursor < this.obj[this.prop].length) this.cursor++ 
                return false

            case "Home":
                this.cursor = 0
                return false

            case "End" : 
                this.cursor = this.obj[this.prop].length
                return false

            case "Delete":
                this.obj[this.prop] = ''
                this.cursor = 0
                return false

            case "Escape":
                this.obj[this.prop] = this.saved
                return true

            case "Alt":
                return false

            case "AltGraph":
                return false

            case "Control":
                return false

            default: 
                return true
        }
    },
}