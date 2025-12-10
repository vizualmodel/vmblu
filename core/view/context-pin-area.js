import {editor} from '../editor/index.js'

// click on the node
export const pinAreaCxMenu = {

	choices: [
		{text:"copy",                     icon:"content_copy",state:"enabled", action:selectionToClipboard},
		{text:"disconnect",				  icon:"power_off",state:"enabled", action:disconnectPinArea},
		{text:"delete",					  icon:"delete",state:"enabled", action:deletePinArea},
		{text:"all pins swap left right", icon:"swap_horiz",state:"enabled", action:pinsSwap},
		{text:"all pins left",			  icon:"arrow_back",state:"enabled", action:pinsLeft},
		{text:"all pins right",			  icon:"arrow_forward",state:"enabled", action:pinsRight},
		{text:"in/out switch",	  	  	  icon:"cached",state:"disabled", action:inOutSwitch},

	],

	view: null,
	node: null,
	widgets: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view) {

		this.view = view
		this.node = view.state.node
		this.widgets = view.selection.widgets
		this.xyLocal = view.hit.xyLocal
		this.xyScreen = view.hit.xyScreen
	},
}
function selectionToClipboard() {
    editor.doEdit('selectionToClipboard',{view: pinAreaCxMenu.view})
}
function disconnectPinArea() {
	editor.doEdit('disconnectPinArea', {view: pinAreaCxMenu.view, node: pinAreaCxMenu.node, widgets: pinAreaCxMenu.widgets})
}
function deletePinArea() {
	editor.doEdit('deletePinArea',{view: pinAreaCxMenu.view, node: pinAreaCxMenu.node, widgets: pinAreaCxMenu.widgets})
}
function pinsSwap()  {
	editor.doEdit('swapPinArea',{view: pinAreaCxMenu.view, left:true, right:true})
}
function pinsLeft()  {
	editor.doEdit('swapPinArea',{view: pinAreaCxMenu.view, left:true, right:false})
}
function pinsRight() {
	editor.doEdit('swapPinArea',{view: pinAreaCxMenu.view, left:false, right:true})
}
function inOutSwitch() {
	editor.doEdit('ioSwitchPinArea', {view})
}