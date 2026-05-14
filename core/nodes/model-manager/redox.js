import {RingStack} from '../../types/util/index.js'
import {redoxNode} from './redox-node.js'
import {redoxLink} from './redox-link.js'
import {redoxWidget} from './redox-widget.js'
import {redoxInterface} from './redox-interface.js'
import {redoxRoute} from './redox-route.js'
import {redoxBus} from './redox-bus.js'
import {redoxCable} from './redox-cable.js'
import {redoxPad} from './redox-pad.js'
import {redoxSelect} from './redox-select.js'
import {redoxPinArea} from './redox-pin-area.js'
import {redoxView} from './redox-view.js'

// we call this redox - oxydation / reduction 
export function Redox(myManager)  {

    // the model manager this Redox belongs to
    this.manager = myManager

    // the undo stack of size ..31 is just a nr !
    this.undoStack = new RingStack(31)
}
Redox.prototype = {

    getUndo() {
        return this.undoStack?.back?.() ?? null
    },

    getRedo() {
        return this.undoStack?.forward?.() ?? null
    },

    saveEdit(verb, param) {
        this.undoStack.push({verb, param})
    },
}
Object.assign(Redox.prototype, redoxNode, redoxLink, redoxWidget, redoxInterface, redoxRoute, redoxBus, redoxCable, redoxPad, redoxSelect, redoxPinArea, redoxView)
