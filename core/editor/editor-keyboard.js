//const cursor = "\u2595"
//const cursor = "|"
export const keyboardHandling = {
    // keyboard press
    onKeydown(e) {
        // if the key is processed
        if (this.doc?.focus?.onKeydown(e)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();

            console.log('hello baby');
        }
    },

    onKeyup(e) {
        // if the key is processed
        if (this.doc?.focus?.onKeyup(e)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();
        }
    },
};
