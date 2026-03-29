const cm = {

	choices: [
        {text:"align left",icon:"align_horizontal_left",state:"enabled",action: () => alignVertical(true)},
        {text:"align right",icon:"align_horizontal_right",state:"enabled",action: () => alignVertical(false)},
        {text:"align top",icon:"align_vertical_top",state:"enabled",action:() => alignHorizontal(true)},
        {text:"distribute vertically",icon:"vertical_distribute",state:"enabled",action:spaceVertical},
        {text:"distribute horizontally",icon:"horizontal_distribute",state:"enabled",action:spaceHorizontal},
		{text:"copy",icon:"content_copy",state:"enabled", action:selectionToClipboard},
        {text:"group",icon:"developer_board",state:"enabled", action:group},
        {text:"disconnect",icon:"power_off",state:"enabled", action:disconnect},
        {text:"autoroute",icon:"timeline",state:"enabled", action:autoRoute},
        {text:"delete",icon:"delete",state:"enabled", action:deleteSelection},
    ],

    view: null,
	tx: null,
	xyLocal:null,

    prepare(view, tx) {

        this.view = view
        this.tx = tx
        this.xyLocal = view.hit.local
    },

	doEdit(verb, param) {
		this.tx.send('redox.doit',{verb, param})
    }
}

export const selectFreeCxMenu = cm;

// align vertical we do for nodes and pads
function alignVertical(left) {
    cm.doEdit('alignVertical',{view: cm.view, left})
}
// align top we only do for nodes 
function alignHorizontal(top) {
    cm.doEdit('alignHorizontal',{view: cm.view, top})
}
function spaceVertical() {
    cm.doEdit('spaceVertical',{view: cm.view})
}
function spaceHorizontal() {
    cm.doEdit('spaceHorizontal', {view: cm.view})
}
function disconnect() {
    cm.doEdit('disconnectSelection',{selection: cm.view.selection})
}
function deleteSelection() {
    cm.doEdit('deleteSelection',{view: cm.view})
}
function selectionToClipboard() {
    cm.view.selectionToClipboard(cm.tx)
}
function group() {
    cm.doEdit('selectionToGroup',{view: cm.view})
}
function autoRoute() {
    cm.doEdit('autoRouteSelection',{view: cm.view})
}
