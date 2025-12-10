import {editor} from '../editor/index.js'
import {selex} from './selection.js'

const withLink = [

	{text:"left/right swap",          icon:"swap_horiz",state:"enabled", action:ifPinsSwap},
	{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:ifPinsLeft},
	{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:ifPinsRight},
	{text:"copy interface",	char:'ctrl c',icon:"content_copy",state:"enabled", 	action:ifToClipboard},
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

	{text:"copy interface",	char:'ctrl c',icon:"content_copy",state:"enabled", 	action:ifToClipboard},
	{text:"paste pins",		char:'ctrl v',icon:"content_copy",state:"enabled", 	action:pastePinsFromClipboard},
	{text:"disconnect",				  icon:"power_off",state:"enabled", action:ifDisconnect},
	{text:"delete",					  icon:"delete",state:"enabled", action:ifDelete},
]

// click on the node
export const ifCxMenu = {

	choices: null,

	view: null,
	node: null,
	ifWidget: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view) {

		this.view = view

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
			editor.tx.request('clipboard get',editor.doc)
			.then( clipboard => {
				entry.state = (clipboard.selection.what === selex.ifArea || clipboard.selection.what === selex.pinArea) ? "enabled" : "disabled";
			})
			.catch( error => {})
		}
	}
}

// is = {channel, input, request, proxy}
function newInput() {
	const is = {channel: false, input: true, proxy: ifCxMenu.node.is.group}
	editor.doEdit('newPin',{view: ifCxMenu.view, node:ifCxMenu.node, pos:ifCxMenu.xyLocal, is})
}
function newOutput() {
	const is = {channel: false, input: false, proxy: ifCxMenu.node.is.group}
	editor.doEdit('newPin',{view: ifCxMenu.view, node:ifCxMenu.node, pos:ifCxMenu.xyLocal, is})
}
function newRequest() {
	const is = {channel: true, input: false,proxy: ifCxMenu.node.is.group}
	editor.doEdit('newPin',{view: ifCxMenu.view, node:ifCxMenu.node, pos:ifCxMenu.xyLocal, is})
}
function newReply() {
	const is = {channel: true,input: true,proxy: ifCxMenu.node.is.group}
	editor.doEdit('newPin',{view: ifCxMenu.view, node:ifCxMenu.node, pos:ifCxMenu.xyLocal, is})
}
function newInterfaceName() {
	editor.doEdit('newInterfaceName', {view: ifCxMenu.view, node:ifCxMenu.node, pos: ifCxMenu.xyLocal})
}
function ioSwitch() {
	editor.doEdit('ioSwitchPinArea', {view: ifCxMenu.view})
}
function ifDisconnect() {
	editor.doEdit('disconnectPinArea', {})
}
function ifDelete() {
	editor.doEdit('deletePinArea',{view: ifCxMenu.view})
}

// pin swapping
function ifPinsSwap()  {
	editor.doEdit('swapPinArea',{view:ifCxMenu.view,left:true, right:true})
}
function ifPinsLeft()  {
	editor.doEdit('swapPinArea',{view:ifCxMenu.view,left:true, right:false})
}
function ifPinsRight() {
	editor.doEdit('swapPinArea',{view:ifCxMenu.view,left:false, right:true})
}

function ifToClipboard() {
		editor.doEdit('selectionToClipboard',{view: ifCxMenu.view})
}

// paste widgets
function pastePinsFromClipboard()  {

	// request the clipboard - also set the target, the clipboard can come from another file
	editor.tx.request('clipboard get',editor.doc).then( clipboard => {

		editor.doEdit('pasteWidgetsFromClipboard',{	view: ifCxMenu.view, clipboard})
	})
	.catch( error => console.log('paste: clipboard get error -> ' + error))
}