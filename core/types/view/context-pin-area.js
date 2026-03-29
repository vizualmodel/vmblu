const cm = {

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
	tx: null,
	node: null,
	widgets: null,
	xyLocal: null,
	xyScreen: null,

	// a specific function to turn on/off the options of the right click menu
	prepare(view, tx) {

		this.view = view
		this.tx = tx
		this.node = view.state.node
		this.widgets = view.selection.widgets
		this.xyLocal = view.hit.xyLocal
		this.xyScreen = view.hit.xyScreen
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}

export const pinAreaCxMenu = cm;


function selectionToClipboard() {
	
	cm.view.selectionToClipboard(cm.tx)
}
function disconnectPinArea() {
	cm.doEdit('disconnectPinArea', {view: cm.view, node: cm.node, widgets: cm.widgets})
}
function deletePinArea() {
	cm.doEdit('deletePinArea',{view: cm.view, node: cm.node, widgets: cm.widgets})
}
function pinsSwap()  {
	cm.doEdit('swapPinArea',{view: cm.view, left:true, right:true})
}
function pinsLeft()  {
	cm.doEdit('swapPinArea',{view: cm.view, left:true, right:false})
}
function pinsRight() {
	cm.doEdit('swapPinArea',{view: cm.view, left:false, right:true})
}
function inOutSwitch() {
	cm.doEdit('ioSwitchPinArea', {view: cm.view})
}
