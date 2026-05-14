import { zap } from './mouse.js';
import { selex } from './selection.js';
import { bgCxMenu } from './context-bg.js';
import { nodeCxMenu } from './context-node.js';
import { pinCxMenu } from './context-pin.js';
import { ifCxMenu } from './context-interface.js';
import { selectFreeCxMenu } from './context-select-free.js';
import { pinAreaCxMenu } from './context-pin-area.js';
import { busCxMenu } from './context-bus.js';
import { tackCxMenu } from './context-tack.js';
import { padCxMenu } from './context-pad.js';

export const contextHandling = {

    // show the rightclick cxMenu
    onContextMenu(xyLocal, e, tx=null) {

        // the context menu
        let cxMenu = null;

        // save the location
        this.saveHitSpot(xyLocal, e);

        // check what was hit inside the window !
        this.mouseHit(xyLocal);

        switch (this.hit.what) {
            
            case zap.header:
            case zap.icon:
                cxMenu = nodeCxMenu;
            break;

            case zap.node:
            case zap.pin:
                cxMenu = pinCxMenu;
            break;

            case zap.ifName: {
                // we select the entire interface here
                this.selection.interfaceSelect(
                    this.hit.node,
                    this.hit.lookWidget
                );

                // prepare the context cxMenu
                cxMenu = ifCxMenu
            }
            break;

            case zap.busSegment:
            case zap.busLabel:
                cxMenu = busCxMenu;
            break;

            case zap.tack:
                cxMenu = tackCxMenu;
            break;

            case zap.pad:
            case zap.padArrow:
                cxMenu = padCxMenu
            break;

            case zap.selection: {
                switch (this.selection.what) {
                    case selex.freeRect:
                    case selex.multiNode:
                        cxMenu = selectFreeCxMenu;
                    break;

                    case selex.ifArea:
                        cxMenu = ifCxMenu;
                    break;

                    case selex.pinArea:
                        cxMenu = pinAreaCxMenu
                    break;
                }
            }
            break;

            case zap.nothing:
                cxMenu = bgCxMenu;
            break;
        }

        // check
        if (!cxMenu) return

        // prepare the cxMenu
        cxMenu.prepare(this, tx)

        // and show it
        tx.send('context menu',{ menu: cxMenu.choices, event: e })
    },
};
