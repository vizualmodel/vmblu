//const cursor = "\u2595"
//const cursor = "|"
export const keyboardHandling = {
    // keyboard press
    onKeydown(e) {
        // if the key is processed
        if (this.focus?.onKeydown(e, this.tx)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();
        }
    },

    onKeyup(e) {
        // if the key is processed
        if (this.focus?.onKeyup(e, this.tx)) {
            // stop it
            e.stopPropagation();
            e.preventDefault();

            // and redraw
            this.redraw();
        }
    },
};
