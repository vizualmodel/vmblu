const cm = {

	choices:[
		{icon:"open_with", text:"recalibrate", state:"enabled", action:recalibrate},
		{icon:"dataset",text:"ungroup",state:"enabled", action:unGroupKeepOld},
		{icon:"schema",text:"ungroup and reconnect",state:"enabled", action:unGroupAndReconnect},
		{icon:"save_as",text:"export...",state:"enabled", action:exportToLink},
	],

	view: null,
	tx: null,
	prepare(view, tx) {
		this.view = view
		this.tx = tx
	}
}

export const viewHeaderCxMenu = cm;

function exportToLink() {
}

function recalibrate() {

	const view = cm.view

	view.setTransform({sx:1.0, sy:1.0, dx: view.rect.x, dy: view.rect.y})
	cm.tx?.send('redox.done', {verb:'recalibrate'})
}

function unGroupKeepOld() {
	cm.view.unGroupKeepOld()
	cm.tx?.send('redox.done', {verb:'unGroupKeepOld'})
}

function unGroupAndReconnect() {
	cm.view.unGroupAndReconnect()
	cm.tx?.send('redox.done', {verb:'unGroupAndReconnect'})
}
