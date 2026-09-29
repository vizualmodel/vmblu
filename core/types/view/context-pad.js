const cm = {

	choices: [
		{icon:"sell",text:"change name",state:"enabled", action:changeName},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deletePad},
		{icon:"sync_alt",text:"switch direction",state:"enabled", action:switchDirection}
	],

	// to set the position where the context menu has to appear
	view:null,
	tx: null,
	pad:null,

	prepare(view, tx) {
		this.view = view
		this.tx = tx
		this.pad = view.hit.pad
	},

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
	}
}
export const padCxMenu = cm;

function changeName() {
	cm.doEdit('changeNamePad',{view: cm.view, pad: cm.pad})
}

function disconnect() {
	cm.doEdit('disconnectPad',{pad: cm.pad})
}

function deletePad() {
	cm.doEdit('deletePad',{view: cm.view, pad: cm.pad})
}

function switchDirection() {
	cm.doEdit('switchPadDirection',{pad: cm.pad})
}