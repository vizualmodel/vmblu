import {editor} from '../editor/index.js'

export const redoxView = {

panning: {

    doit({view}){
    },
    undo({}) {
    },
    redo({}) {
    }
},

xxpanning: {

    doit({view}){

        editor.saveEdit('panning', {view, oldTf: {...view.tf}, newTf: {...view.tf}})
    },
    undo({view, oldTf, newTf}) {

        // save the current values
        newTf.dx = view.tf.dx
        newTf.dy = view.tf.dy

        // restore the old values
        view.tf.dx = oldTf.dx
        view.tf.dy = oldTf.dy
    },
    redo({view, oldTf, newTf}) {

        // set the new values
        view.tf.dx = newTf.dx
        view.tf.dy = newTf.dy
    }
},

zooming: {

    doit({view}){
    },
    undo({}) {
    },
    redo({}) {
    }
}


}