import {editor} from '../editor/index.js'
export const padCxMenu = {

	choices: [
		{icon:"sell",text:"change name",state:"enabled", action:changeName},
		{icon:"power_off",text:"disconnect",state:"enabled",action:disconnect},
		{icon:"delete",text:"delete",state:"enabled", action:deletePad}
	],

	// to set the position where the context menu has to appear
	view:null,
	pad:null,

	prepare(view) {
		this.view = view
		this.pad = view.hit.pad
	}
}

function changeName() {
	editor.doEdit('changeNamePad',{view: padCxMenu.view, pad: padCxMenu.pad})
}

function disconnect() {
	editor.doEdit('disconnectPad',{pad: padCxMenu.pad})
}

function deletePad() {
	editor.doEdit('deletePad',{pad: padCxMenu.pad})
}
