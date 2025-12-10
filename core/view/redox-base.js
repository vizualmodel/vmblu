import {redoxNode} from './redox-node.js'
import {redoxLink} from './redox-link.js'
import {redoxWidget} from './redox-widget.js'
import {redoxInterface} from './redox-interface.js'
import {redoxRoute} from './redox-route.js'
import {redoxBus} from './redox-bus.js'
import {redoxPad} from './redox-pad.js'
import {redoxSelect} from './redox-select.js'
import {redoxPinArea} from './redox-pin-area.js'
import {redoxView} from './redox-view.js'

// we call this redox - oxydation / reduction 
export const redox = {}
Object.assign(redox, redoxNode, redoxLink, redoxWidget, redoxInterface, redoxRoute, redoxBus, redoxPad, redoxSelect, redoxPinArea, redoxView)