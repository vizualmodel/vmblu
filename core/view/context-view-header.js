//import {editor} from '../model-editor/index.js'
import {editor} from '../editor/index.js'

export const viewHeaderCxMenu = {

	choices:[
		{icon:"open_with", text:"recalibrate", state:"enabled", action:recalibrate},
		{icon:"dataset",text:"ungroup",state:"enabled", action:unGroupKeepOld},
		{icon:"schema",text:"ungroup and reconnect",state:"enabled", action:unGroupAndReconnect},
		{icon:"save_as",text:"export...",state:"enabled", action:exportToLink},
	],

	view: null,
	prepare(view) {
		this.view = view
	}
}

function exportToLink() {
}

function recalibrate() {

	const view = viewHeaderCxMenu.view

	view.setTransform({sx:1.0, sy:1.0, dx: view.rect.x, dy: view.rect.y})
	editor.redraw()
}

function unGroupKeepOld() {
	viewHeaderCxMenu.view.unGroupKeepOld()
	editor.redraw()
}

function unGroupAndReconnect() {
	viewHeaderCxMenu.view.unGroupAndReconnect()
	editor.redraw()
}
