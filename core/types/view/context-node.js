const cm = {

	choices: [
		{text:"",			char:'h',	state:"enabled", action:nodeHighLight,	icon:"highlight"},
		{text:"add label",	char:'a',	state:"enabled",action:addLabel,		icon:"sell"},
		{text:"wider", 		char:'ctrl +',	state:"enabled", action:wider,			icon:"open_in_full"},
		{text:"smaller",	char:'ctrl -', 	state:"enabled", action:smaller,		icon:"close_fullscreen"},
		{text:"copy",		char:'ctrl c',state:"enabled", action:nodeToClipboard,icon:"content_copy"},
    	{text:"paste pins",char: 'ctrl v',state: 'enabled', action: pasteWidgetsFromClipboard,  icon: 'content_copy'},    
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
	tx: null,
	node:null,
	xyLocal: null,

	// prepare the menu list before showing it
	prepare(view, tx) {

		this.view = view
		this.tx = tx
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

		choice = this.choices.find( choice => choice.action == pasteWidgetsFromClipboard)
		choice.state = this.node.link ? "disabled" : "enabled"

		choice = this.choices.find( choice => choice.action == unGroup)
		choice.state = this.node.is.group ? "enabled" : "disabled"
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}
export const nodeCxMenu = cm;


// the actions 
function addLabel() {
	cm.doEdit('addLabel',{view: cm.view, node: cm.node})
}

function wider() {
	cm.doEdit('wider', {node: cm.node})
}

function smaller() {
	cm.doEdit('smaller', {node: cm.node})
}

function nodeHighLight() {
	cm.doEdit('nodeHighLight', {node: cm.node})
}

function nodeToClipboard() {
	cm.doEdit('nodeToClipboard', {view: cm.view, node: cm.node})
}

function convertNode() {
	cm.doEdit('convertNode',{view: cm.view, node: cm.node})
}

function makeTestNode() {
}

function sourceToClipboard() {
	cm.doEdit('sourceToClipboard',{node: cm.node})
}

function disconnectNode() {
	cm.doEdit('disconnectNode',{node: cm.node})
}

function deleteNode() {
	cm.doEdit('deleteNode',{view: cm.view, node: cm.node})
}

// make the node local, ie break the link....
function cutLink() {
	cm.doEdit('cutLink',{node: cm.node})
}

// type in the name of a model and try to find the requested node in that model
function getFromLink() {
	cm.node.showLinkForm(cm.view, cm.xyLocal,cm.tx)
}

// save the node to a file, ie change it into a link
function saveToLink() {
	cm.node.showExportForm(cm.xyLocal,cm.tx)
}          		

function unGroup() {
	cm.doEdit('disconnectNode',{node: cm.node})
	cm.doEdit('unGroup', {view: cm.view, node: cm.node})
}

function pasteWidgetsFromClipboard() {
    // request the clipboard - also set the target, the clipboard can come from another file
    cm.tx.request('clipboard.get', cm.doc).then(({raw}) => {
        cm.doEdit('pasteWidgetsFromClipboard', {view: cm.view, raw});
    });
    //.catch( error => console.log('paste: clipboard get error -> ' + error))
}