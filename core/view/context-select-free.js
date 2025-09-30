import {editor} from '../editor/index.js'

export const selectFreeCxMenu = {

	choices: [
        {text:"align left",icon:"align_horizontal_left",state:"enabled",action: () => alignVertical(true)},
        {text:"align right",icon:"align_horizontal_right",state:"enabled",action: () => alignVertical(false)},
        {text:"align top",icon:"align_vertical_top",state:"enabled",action:() => alignHorizontal(true)},
        {text:"distribute vertically",icon:"vertical_distribute",state:"enabled",action:spaceVertical},
        {text:"distribute horizontally",icon:"horizontal_distribute",state:"enabled",action:spaceHorizontal},
		{text:"copy",icon:"content_copy",state:"enabled", action:selectionToClipboard},
        {text:"group",icon:"developer_board",state:"enabled", action:group},
        {text:"disconnect",icon:"power_off",state:"enabled", action:disconnect},
        {text:"delete",icon:"delete",state:"enabled", action:deleteSelection},
    ],

    view: null,
	xyLocal:null,

    prepare(view) {

        this.view = view
        this.xyLocal = view.hit.local
    }
}
// align vertical we do for nodes and pads
function alignVertical(left) {
    editor.doEdit('alignVertical',{view: selectFreeCxMenu.view, left})
}
// align top we only do for nodes 
function alignHorizontal(top) {
    editor.doEdit('alignHorizontal',{view: selectFreeCxMenu.view, top})
}
function spaceVertical() {
    editor.doEdit('spaceVertical',{view: selectFreeCxMenu.view})
}
function spaceHorizontal() {
    editor.doEdit('spaceHorizontal', {view: selectFreeCxMenu.view})
}
function disconnect() {
    editor.doEdit('disconnectSelection',{selection: selectFreeCxMenu.view.selection})
}
function deleteSelection() {
    editor.doEdit('deleteSelection',{view: selectFreeCxMenu.view})
}
function selectionToClipboard() {
    editor.doEdit('selectionToClipboard',{view: selectFreeCxMenu.view})
}
function group() {
    editor.doEdit('selectionToGroup',{view: selectFreeCxMenu.view})
}