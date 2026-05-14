const cm = {

    choices: [
        {icon:"filter_alt", text:"", state:"enabled", action:switchSelectivity},
        {icon:"sell", text:"add alias", state:"enabled", action:addAlias},
    ],

    view: null,
    tx: null,
    tack: null,
    xyLocal: null,

    prepare(view, tx) {
        this.view = view
        this.tx = tx
        this.tack = view.hit.tack
        this.xyLocal = view.hit.xyLocal

        const choice = this.choices.find(choice => choice.action == switchSelectivity)
        choice.text = this.tack?.is?.selective ? "make non-selective" : "make selective"

        const alias = this.choices.find(choice => choice.action == addAlias)
        alias.text = this.tack?.alias ? "change alias" : "add alias"
    },

    doEdit(verb, param) {
        this.tx.send('redox.doit', {verb, param})
    }
}

export const tackCxMenu = cm

function switchSelectivity() {
    cm.doEdit('tackSelectivitySwitch', {tack: cm.tack})
}

function addAlias() {
    cm.doEdit('widgetTextEdit', {view: cm.view, widget: cm.tack, click: cm.xyLocal})
}
