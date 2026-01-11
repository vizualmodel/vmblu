import {editor} from '../editor/index.js'
import {selex} from './selection.js'

export const bgCxMenu = {

	choices:[
		{text:'new group node',	icon:'account_tree',char:'ctrl g',	state:"enabled",	action:newGroupNode},
		{text:'new source node',icon:'factory',		char:'ctrl s', 	state:"enabled",	action:newSourceNode},
		{text:'new bus',		icon:'cable',  		char:'ctrl k',	state:"enabled",	action:newBus},
		{text:'new input pad',	icon:'new_label',	char:'ctrl i', 	state:"enabled",	action:newInputPad},
		{text:'new output pad',	icon:'new_label',	char:'ctrl o', 	state:"enabled",	action:newOutputPad},
		{text:'select node',	icon:'play_arrow',	char:'ctrl n', 	state:"enabled",	action:selectNode},
		{text:"paste as link",	icon:"link",		char:'ctrl l',	state:"enabled", 	action:linkFromClipboard},
		{text:"paste",			icon:"content_copy",char:'ctrl v',	state:"enabled", 	action:pasteFromClipboard},
	],

	view:null,
	xyLocal:null,
	xyScreen:null,

	// prepare the menu list before showing it
	prepare(view) {

		this.view = view
		this.xyLocal = view.hit.xyLocal
		this.xyScreen = view.hit.xyScreen
	}
}

function newGroupNode() { 				   
	editor.doEdit('newGroupNode',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal})
}

function newSourceNode() {
	editor.doEdit('newSourceNode',{view: bgCxMenu.view,pos: bgCxMenu.xyLocal})
}

function newBus() {
	editor.doEdit('busCreate',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal})
}

function newInputPad() {
	editor.doEdit('padCreate', {view: bgCxMenu.view,pos: bgCxMenu.xyLocal, input:true})
}

function newOutputPad() {
	editor.doEdit('padCreate', {view: bgCxMenu.view,pos: bgCxMenu.xyLocal, input: false})
}

function selectNode() {
	editor.tx.send("select node", {xyScreen: bgCxMenu.xyScreen, xyLocal:bgCxMenu.xyLocal})
}

function linkFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		// check
		if ((clipboard.selection.what == selex.nothing) || (clipboard.selection.what == selex.pinArea)) return

		// do the edit
		editor.doEdit('linkFromClipboard',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, clipboard})
	})
	//.catch( error => console.log('link from context menu: clipboard get error -> ' + error))
}

function pasteFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		// check
		if (clipboard.selection.what == selex.nothing || clipboard.selection.what == selex.pinArea) return

		// do the edit
		editor.doEdit('pasteFromClipboard',{view: bgCxMenu.view, pos: bgCxMenu.xyLocal, clipboard})
	})
	//.catch( error => console.log('paste from context menu: clipboard get error -> ' + error))
}
