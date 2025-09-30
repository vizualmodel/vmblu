import {EditorView } from 'codemirror'
import {EditorState, Compartment} from "@codemirror/state"
import {language} from "@codemirror/language"
import {htmlLanguage, html} from "@codemirror/lang-html"
import { javascript } from '@codemirror/lang-javascript'


export const languageConf = new Compartment

export const autoLanguage = EditorState.transactionExtender.of( trans => {

    // nothing has changed
    if (!trans.docChanged) return null

    // a HTML document starts with <
    let docIsHTML = /^\s*</.test(trans.newDoc.sliceString(0, 100))

    // check if the state is HTML already
    let stateIsHTML = trans.startState.facet(language) == htmlLanguage

    // ..if so nothing to do
    if (docIsHTML == stateIsHTML) return null

    // reconfigure
    return {
        effects: languageConf.reconfigure(docIsHTML ? html() : javascript())
    }
})

export const fixedSizeEditor = EditorView.theme({
    "&": {  
        height: "100%",
        width:  "100%",
        fontFamily:"'Courier New', monospace",
        fontSize: "12pt",
        fontWeight: "normal"
    },
    ".cm-editor": { 
    },
    ".cm-scroller": {
        overflowY: "scroll",
        fontFamily: "inherit",
        lineHeight:"13pt"
    },
    ".cm-gutters": {
    },
    ".cm-content" : {
    },
    ".cm-line" :{
    },
},{dark:true})

export const minHeightEditor = EditorView.theme({
    ".cm-content, .cm-gutter": {minHeight: "20rem"}
})

  


















