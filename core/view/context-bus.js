import {editor} from '../editor/index.js'
import {convert} from '../util/convert.js'

export const busCxMenu = {

	choices: [
		{icon:"highlight",text:"",state:"enabled", action:busHighLight},
		{icon:"sell",text:"change name",state:"enabled", action:changeName},
		{icon:"sell",text:"",state:"enabled", action:changeType},
		{icon:"rss_feed",text:"",state:"enabled", action:changeFilter},
		{icon:"timeline",text:"straight connections",state:"enabled", action:straightConnections},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deleteBus}
	],

	view: null,
	bus:null,
	label:null,
	xyLocal:null,

	prepare(view) {

		this.view = view
		this.bus = view.hit.bus
		this.label = view.hit.busLabel
		this.xyLocal = view.hit.xyScreen

		let choice = this.choices.find( choice => choice.action == busHighLight)
		choice.text = this.bus.is.highLighted ? "remove highlight" : "highlight routes"

		choice = this.choices.find( choice => choice.action == changeType)
		choice.text = this.bus.is.cable ? "change to busbar" : "change to cable"

		choice = this.choices.find( choice => choice.action == changeFilter)
		choice.state = this.bus.is.cable ? "enabled" : "disabled"
		choice.text = (this.bus.is.cable && this.bus.is.filter) ? "change filter" : "add filter"
	}
}

function busHighLight() {
	editor.doEdit('busHighlight',{bus: busCxMenu.bus})
}

function changeName() {
	editor.doEdit('busChangeName', {bus: busCxMenu.bus, label: busCxMenu.busLabel})
}

function changeType() {
	editor.doEdit('busChangeType', {bus: busCxMenu.bus})
}

// function deleteFilter() {
// 	editor.doEdit('busDeleteFilter', {bus: busCxMenu.bus})
// }

function changeFilter() {

	// notation
	const bus = busCxMenu.bus

	// set the filter name and path if not available
	const filterName = (!bus.filter || bus.filter.fName.length < 1) ? convert.nodeToFactory(bus.name) : bus.filter.fName
	const filterPath = bus.filter?.arl ? bus.filter.arl.userPath : ''

	// show the factory
	editor.tx.send("show filter",{ 

		title: 'Filter for ' + bus.name, 
		name: filterName,
		path: filterPath,
		pos: busCxMenu.xyLocal,
		ok: (newName,newPath) => {

			// do the edit
			editor.doEdit('busChangeFilter',{bus, newName : newName.trim(), userPath: newPath.trim()})
		},
		open: async (newName, newPath) => {

			// change if anything was changed
			if ((newName != filterName )||(newPath != filterPath))
				editor.doEdit('busChangeFilter',{bus, newName : newName.trim(),userPath: newPath.trim()})

			// check
			if (newName.length < 1) return

			// get the current reference
			const arl = bus.filter.arl ?? editor.doc.resolve('./index.js')

			// open the file
			tx.send('open source file',{arl})
		},
		trash: () => {
			editor.doEdit('busDeleteFilter',{bus})
		},
		cancel:()=>{}
	})

}

function straightConnections() {
	editor.doEdit('busStraightConnections', {bus: busCxMenu.bus})
}

function disconnect() {
	editor.doEdit('busDisconnect',{bus: busCxMenu.bus})
}

function deleteBus() {
	editor.doEdit('busDelete',{bus: busCxMenu.bus})	
}
