import {selex} from './selection.js'


// The context menu
const cm = {

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
	tx: null,
	xyLocal:null,
	xyScreen:null,

	// prepare the menu list before showing it
	prepare(view, tx) {

		this.view = view
		this.tx = tx
		this.xyLocal = view.hit.xyLocal
		this.xyScreen = view.hit.xyScreen
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}

export const bgCxMenu = cm;


function newGroupNode() { 				   
	cm.doEdit('newGroupNode',{view: cm.view, pos: cm.xyLocal})
}

function newSourceNode() {
	cm.doEdit('newSourceNode',{view: cm.view,pos: cm.xyLocal})
}

function newBus() {
	cm.doEdit('busCreate',{view: cm.view, pos: cm.xyLocal})
}

function newInputPad() {
	cm.doEdit('padCreate', {view: cm.view,pos: cm.xyLocal, input:true})
}

function newOutputPad() {
	cm.doEdit('padCreate', {view: cm.view,pos: cm.xyLocal, input: false})
}

function selectNode() {
	cm.tx.send("select node", {xyScreen: cm.xyScreen, xyLocal:cm.xyLocal})
}

function linkFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	cm.tx.request('clipboard.get').then( ({raw}) => {

		// do the edit
		cm.doEdit('pasteFromClipboard',{view: cm.view, pos: cm.xyLocal, raw, asLink: true})
	})
	//.catch( error => console.log('link from context menu: clipboard get error -> ' + error))
}

function pasteFromClipboard() {

	// request the clipboard - also set the target, the clipboard can come from another file
	cm.tx.request('clipboard.get').then( ({raw}) => {

		// do the edit
		cm.doEdit('pasteFromClipboard',{view: cm.view, pos: cm.xyLocal, raw, asLink: false})
	})
	//.catch( error => console.log('paste from context menu: clipboard get error -> ' + error))
}
