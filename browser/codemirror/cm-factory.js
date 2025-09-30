import { basicSetup, EditorView } from 'codemirror'
// import {EditorState, Compartment} from "@codemirror/state"
// import {language} from "@codemirror/language"
// import {htmlLanguage, html} from "@codemirror/lang-html"
import { javascript } from '@codemirror/lang-javascript'
//import {darkTheme} from './theme-dark.js'
import {languageConf, autoLanguage, fixedSizeEditor} from './config.js'

const emptyDiv = document.createElement("div")

export function Document() {

    this.arl = null
    this.view = null
}

export function CodeMirrorEditor(tx, sx) {

    // document = {ref, arl, content, view}
    this.documents=[]

    // save the tx and sx
    this.tx = tx
    this.sx = sx

    // ref counter for files ..
    this.ref = 1

}
CodeMirrorEditor.prototype = {

    onFileEvent() {
        
    },

    onNewDoc({content, arl}={content:'', arl:null}) {

        // create the view for the editor
        const view = new EditorView({
            doc: content,
            extensions: [    
                basicSetup,     
                languageConf.of(javascript()),
                autoLanguage, 
//                darkTheme,
                fixedSizeEditor,
            ],
            parent: null
        })

        // send out the div to the containing window
        this.tx.send('div', view.dom)

        // make a unique ref string for the document
        const ref = '' + this.ref++

        // make a label for the tab
        const label = arl ? arl.getName() : 'new'

        // also set a new tab for the document
        this.tx.send('new tab',{label, ref})

        // save the doc
        this.documents.push({ref, arl, content, view})
    },

    onCloseDoc(ref) {     
        // remove the document from the list (show doc for another doc will follow...)
        this.removeDocument(ref)

        // ..but if there are no more documents clear the window
        if (this.documents.length == 0) this.tx.send('div', emptyDiv)
    },

    onShowDoc(ref) {
        // find the document to show
        const doc = this.documents.find( doc => doc.ref == ref)

        // check
        if (!doc) return

        // put the div in the editor window
        this.tx.send('div', doc.view.dom)
    },

    onSaveDoc(ref) {
        // find the document to show
        const doc = this.documents.find( doc => doc.ref == ref)

        // check
        if (!doc) return

        // if no arl - ask for a file name
        if (!doc.arl) return

        // get the content of the doc
        doc.content = doc.view.state.sliceDoc()

        // send the content 
        this.tx.send("save to file",{content: doc.content, arl:doc.arl})
    },

    onGetOpenFiles() {

        let files = []

        this.documents.forEach(doc => files.push(doc.arl))

        this.tx.send("file list", files)
    },

    removeDocument(ref) {

        const docs = this.documents
        // remove the tab with the name
        const L = docs.length
        for (let i=0; i<L; i++) {

            // we use th apath as ref
            if (docs[i].ref == ref) {

                // clear the view
                docs[i].view.destroy()

                // shift the tabs
                for (let j=i; j<L-1; j++ )  docs[j] = docs[j+1]

                // remove one element
                docs.pop()
                break
            }
        }
    }
}
