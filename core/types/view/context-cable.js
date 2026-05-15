const cm = {

	choices: [
		{icon:"highlight",text:"",state:"enabled", action:cableHighLight},
		{icon:"timeline",text:"straight connections",state:"enabled", action:straightConnections},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deleteCable}
	],

	view: null,
	tx: null,
	cable:null,
	xyLocal:null,

	prepare(view,tx) {

		this.view = view
		this.tx = tx
		this.cable = view.hit.cable
		this.xyLocal = view.hit.xyScreen

		let choice = this.choices.find( choice => choice.action == cableHighLight)
		choice.text = this.cable.is.highLighted ? "remove highlight" : "highlight routes"
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}

export const cableCxMenu = cm;


function cableHighLight() {
	cm.doEdit('cableHighlight',{cable: cm.cable})
}

function straightConnections() {
	cm.doEdit('cableStraightConnections', {cable: cm.cable})
}

function disconnect() {
	cm.doEdit('cableDisconnect',{cable: cm.cable})
}

function deleteCable() {
	cm.doEdit('cableDelete',{view: cm.view, cable: cm.cable})
}
