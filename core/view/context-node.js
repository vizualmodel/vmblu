import {editor} from '../editor/index.js'

// click on the node
export const nodeCxMenu = {

	choices: [
		{text:"",			char:'h',	state:"enabled", action:nodeHighLight,	icon:"highlight"},
		{text:"add label",	char:'a',	state:"enabled",action:addLabel,		icon:"sell"},
		{text:"wider", 		char:'ctrl +',	state:"enabled", action:wider,			icon:"open_in_full"},
		{text:"smaller",	char:'ctrl -', 	state:"enabled", action:smaller,		icon:"close_fullscreen"},
		{text:"copy",		char:'ctrl c',state:"enabled", action:nodeToClipboard,icon:"content_copy"},
		{text:"source to clipboard",	state:"enabled", action:sourceToClipboard,icon:"content_paste"},
		{text:"make a test node",		state:"enabled", action:makeTestNode,icon:"done_all"},
		{text:"",						state:"enabled", action:convertNode,	icon:"sync"},
		{text:"cut link",				state:"enabled", action:cutLink,		icon:"link_off"},
		{text:"get from link",			state:"enabled", action:getFromLink,	icon:"link"},
		{text:"save to link",			state:"enabled", action:saveToLink,		icon:"add_link"},
		{text:"ungroup",				state:"enabled", action:unGroup, 		icon:"schema",},
		{text:"disconnect", char:'clear',state:"enabled", action:disconnectNode,icon:"power_off"},
		{text:"delete", 	char:'del',	state:"enabled", action:deleteNode,		icon:"delete"},
	],

	view:null,
	node:null,
	xyLocal: null,

	// prepres the menu list before showing it
	prepare(view) {

		this.view = view
		this.xyLocal = view.hit.xyLocal
		this.node = view.hit.node

		// some choices will be enable or changed
		let choice = this.choices.find( choice => choice.action == sourceToClipboard)
		choice.state = this.node.is.source ? "enabled" : "disabled"

		choice = this.choices.find( choice => choice.action == convertNode)
		choice.state = this.node.link ? "disabled" : "enabled"
		choice.text = this.node.is.group ? "convert to source node" : "convert to group node"

		choice = this.choices.find( choice => choice.action == nodeHighLight)
		choice.text = this.node.is.highLighted ? "remove highlight" : "highlight routes"

		choice = this.choices.find( choice => choice.action == cutLink)
		choice.state = this.node.link ? "enabled" : "disabled"

		choice = this.choices.find( choice => choice.action == saveToLink)
		choice.state = this.node.link ? "disabled" : "enabled"

		choice = this.choices.find( choice => choice.action == getFromLink)
		choice.state = this.node.link ? "disabled" : "enabled"

		choice = this.choices.find( choice => choice.action == unGroup)
		choice.state = this.node.is.group ? "enabled" : "disabled"
	},
}

// the actions 
function addLabel() {
	editor.doEdit('addLabel',{node: nodeCxMenu.node})
}

function wider() {
	editor.doEdit('wider', {node: nodeCxMenu.node})
}

function smaller() {
	editor.doEdit('smaller', {node: nodeCxMenu.node})
}

function nodeHighLight() {
	editor.doEdit('nodeHighLight', {node:nodeCxMenu.node})
}

function nodeToClipboard() {
	editor.doEdit('nodeToClipboard', {view:nodeCxMenu.view, node:nodeCxMenu.node})
}

function convertNode() {
	editor.doEdit('convertNode',{node:nodeCxMenu.node})
}

function makeTestNode() {
}

function sourceToClipboard() {
	editor.doEdit('sourceToClipboard',{node:nodeCxMenu.node})
}

function disconnectNode() {
	editor.doEdit('disconnectNode',{node:nodeCxMenu.node})
}

function deleteNode() {
	editor.doEdit('deleteNode',{node:nodeCxMenu.node})
}

// make the node local, ie break the link....
function cutLink() {
	editor.doEdit('cutLink',{node:nodeCxMenu.node})
}

// type in the name of a model and try to find the requested node in that model
function getFromLink() {
	nodeCxMenu.node.showLinkForm(nodeCxMenu.xyLocal)
}

// save the node to a file, ie change it into a link
function saveToLink() {
	nodeCxMenu.node.showExportForm(nodeCxMenu.xyLocal)
}          		

function unGroup() {
	editor.doEdit('unGroup', {view: nodeCxMenu.view, node: nodeCxMenu.node})
}