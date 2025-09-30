import {editor} from '../editor/index.js'
import {zap} from './mouse.js'
import {selex} from './selection.js'
import {bgCxMenu} from './context-bg.js'
import {nodeCxMenu} from './context-node.js'
import {pinAreaCxMenu} from './context-pin-area.js'
import {selectFreeCxMenu} from './context-select-free.js'
import {selectWidgetsCxMenu} from './context-select-widgets.js'
import {busCxMenu} from './context-bus.js'
import {padCxMenu} from './context-pad.js'

export const contextHandling = {

    // show the rightclick menu
    onContextMenu(xyLocal, e) {

        // save the location
        this.saveHitSpot(xyLocal, e)

        // check what was hit inside the window !
        this.mouseHit(xyLocal)

        switch(this.hit.what) {

            case zap.header:
            case zap.icon: {
                nodeCxMenu.prepare(this)
                editor.tx.send("show context menu", {menu:nodeCxMenu.choices, event:e})
            }
            break

            case zap.node:
            case zap.pin:
            case zap.ifName:{
                pinAreaCxMenu.prepare(this)
                editor.tx.send("show context menu", {menu: pinAreaCxMenu.choices, event:e})
            }
            break

            case zap.busSegment:
            case zap.busLabel: {
                busCxMenu.prepare(this)
                editor.tx.send("show context menu", {menu:busCxMenu.choices, event:e})
            }
            break

            case zap.pad:
            case zap.padArrow: {
                padCxMenu.prepare(this)
                editor.tx.send("show context menu", {menu:padCxMenu.choices, event:e})
            }
            break

            case zap.selection: {

                switch(this.selection.what) {

                    case selex.freeRect: 
                    case selex.multiNode: {
                        selectFreeCxMenu.prepare(this)
                        editor.tx.send("show context menu", {menu:selectFreeCxMenu.choices, event:e})
                    }
                    break

                    case selex.pinArea: {
                        selectWidgetsCxMenu.prepare(this)
                        editor.tx.send("show context menu", {menu:selectWidgetsCxMenu.choices, event:e})
                    }
                    break
                }
            }
            break

            case zap.nothing: {
                bgCxMenu.prepare(this)
                editor.tx.send("show context menu", {menu:bgCxMenu.choices, event:e})                
            }
            break
        }
    },
}