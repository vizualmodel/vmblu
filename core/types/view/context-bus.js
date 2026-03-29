import {convert} from '../util/convert.js'

const cm = {

	choices: [
		{icon:"highlight",text:"",state:"enabled", action:busHighLight},
		{icon:"sell",text:"change name",state:"enabled", action:changeName},
		{icon:"timeline",text:"straight connections",state:"enabled", action:straightConnections},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deleteBus}
	],

	view: null,
	tx: null,
	bus:null,
	label:null,
	xyLocal:null,

	prepare(view,tx) {

		this.view = view
		this.tx = tx
		this.bus = view.hit.bus
		this.label = view.hit.busLabel
		this.xyLocal = view.hit.xyScreen

		let choice = this.choices.find( choice => choice.action == busHighLight)
		choice.text = this.bus.is.highLighted ? "remove highlight" : "highlight routes"
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}

export const busCxMenu = cm;


function busHighLight() {
	cm.doEdit('busHighlight',{bus: cm.bus})
}

function changeName() {
	cm.doEdit('busChangeName', {view: cm.view, bus: cm.bus, label: cm.label})
}

function straightConnections() {
	cm.doEdit('busStraightConnections', {bus: cm.bus})
}

function disconnect() {
	cm.doEdit('busDisconnect',{bus: cm.bus})
}

function deleteBus() {
	cm.doEdit('busDelete',{view: cm.view, bus: cm.bus})	
}
