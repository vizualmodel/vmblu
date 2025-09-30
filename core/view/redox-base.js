import {redoxNode} from './redox-node.js'
import {redoxLink} from './redox-link.js'
import {redoxWidget} from './redox-widget.js'
import {redoxRoute} from './redox-route.js'
import {redoxBus} from './redox-bus.js'
import {redoxPad} from './redox-pad.js'
import {redoxSelect} from './redox-select.js'
import {redoxSelectWidgets} from './redox-select-widgets.js'
import {redoxView} from './redox-view.js'

// we call this redox - oxydation / reduction 
export const redox = {}
Object.assign(redox, redoxNode, redoxLink, redoxWidget, redoxRoute, redoxBus, redoxPad, redoxSelect, redoxSelectWidgets, redoxView)