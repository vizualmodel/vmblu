import {selex} from './selection.js'

const withLink = [

	{text:"left/right swap",          icon:"swap_horiz",state:"enabled", action:ifPinsSwap},
	{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:ifPinsLeft},
	{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:ifPinsRight},
	{text:"copy pins",	char:'ctrl c',icon:"content_copy",state:"enabled", 	action:widgetsToClipboard},
	{text:"disconnect",				  icon:"power_off",state:"enabled", action:ifDisconnect},
]

const noLink = [

	{text:"new output",		char:'o', icon:"logout",state:"enabled", action:newOutput},
	{text:"new input",		char:'i', icon:"login",state:"enabled", action:newInput},
	{text:"new interface",  char:'p', icon:"drag_handle",state:"enabled", action:newInterfaceName},
	{text:"new request",	char:'q', icon:"switch_left",state:"enabled", action:newRequest},
	{text:"new reply",		char:'r', icon:"switch_right",state:"enabled", action:newReply},

	{text:"left/right swap",          icon:"swap_horiz",state:"enabled", action:ifPinsSwap},
	{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:ifPinsLeft},
	{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:ifPinsRight},
	{text:"i/o swicth",	  	          icon:"cached",state:"enabled", action:ioSwitch},

	{text:"copy pins",	char:'ctrl c',icon:"content_copy",state:"enabled", 	action:widgetsToClipboard},
	{text:"paste pins",	char:'ctrl v',icon:"content_copy",state:"enabled", 	action:pasteWidgetsFromClipboard},
	{text:"disconnect",				  icon:"power_off",state:"enabled", action:ifDisconnect},
	{text:"delete",					  icon:"delete",state:"enabled", action:ifDelete},
]

// click on the node
const cm = {

	choices: null,

	view: null,
	tx: null,
	node: null,
	ifWidget: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view, tx) {

		this.view = view
		this.tx = tx

		// Get the data from the selection !
		if (view.selection.what == selex.ifArea) {

			// check - should never fail
			const ifWidget = view.selection.widgets[0]
			if (!ifWidget?.is.ifName) return;

			this.node = ifWidget.node
			this.ifWidget = ifWidget
			this.xyLocal = view.hit.xyLocal
			this.xyScreen = view.hit.xyScreen
		}
		// get the data from the view hit
		else {
			this.node = view.hit.node
			this.ifWidget = view.hit.lookWidget
			this.xyLocal = view.hit.xyLocal
			this.xyScreen = view.hit.xyScreen
		}

		// set the options
		this.choices = this.node.link ? withLink : noLink

		// check if there are pins to paste
		const entry = this.choices.find( c => c.text == "paste pins")
		if (entry) {
			entry.state = "disabled"
			this.tx.request('clipboard.get', cm.doc)
			.then( clipboard => {
				entry.state = clipboard.selection.isPinSelection() ? "enabled" : "disabled";
			})
			.catch( error => {})
		}
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	},
}

export const ifCxMenu = cm;


// is = {channel, input, request, proxy}
function newInput() {
	const is = {channel: false, input: true, proxy: cm.node.is.group}
	cm.doEdit('newPin',{view: cm.view, node: cm.node, pos: cm.xyLocal, is})
}
function newOutput() {
	const is = {channel: false, input: false, proxy: cm.node.is.group}
	cm.doEdit('newPin',{view: cm.view, node: cm.node, pos: cm.xyLocal, is})
}
function newRequest() {
	const is = {channel: true, input: false, proxy: cm.node.is.group}
	cm.doEdit('newPin',{view: cm.view, node: cm.node, pos: cm.xyLocal, is})
}
function newReply() {
	const is = {channel: true, input: true, proxy: cm.node.is.group}
	cm.doEdit('newPin',{view: cm.view, node: cm.node, pos: cm.xyLocal, is})
}
function newInterfaceName() {
	cm.doEdit('newInterfaceName', {view: cm.view, node: cm.node, pos: cm.xyLocal})
}
function ioSwitch() {
	cm.doEdit('ioSwitchPinArea', {view: cm.view})
}
function ifDisconnect() {
	cm.doEdit('disconnectPinArea', {})
}
function ifDelete() {
	cm.doEdit('deletePinArea',{view: cm.view})
}

// pin swapping
function ifPinsSwap()  {
	cm.doEdit('swapPinArea',{view: cm.view, left:true, right:true})
}
function ifPinsLeft()  {
	cm.doEdit('swapPinArea',{view: cm.view, left:true, right:false})
}
function ifPinsRight() {
	cm.doEdit('swapPinArea',{view: cm.view, left:false, right:true})
}

function widgetsToClipboard() {

	// sends the selection to the local clipboard node
	cm.view.selectionToClipboard(cm.tx)
}

// paste widgets
function pasteWidgetsFromClipboard()  {

	// request the clipboard - also set the target, the clipboard can come from another file
	cm.tx.request('clipboard.get').then( ({raw}) => {

		cm.doEdit('pasteWidgetsFromClipboard',{view: cm.view, raw})
	})
	.catch( error => console.log('paste: clipboard get error -> ' + error))
}
