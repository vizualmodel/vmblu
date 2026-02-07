import { editor } from '../editor/index.js';
import { ARL } from '../arl/index.js';

/**
 * @node editor editor
 */
export const redoxWidget = {
    newPin: {
        doit({ view, node, pos, is }) {
            // we add new pins at the end of a selection if, or else we keep the pos value
            pos = view.selection.behind() ?? pos;

            // create the pin
            const pin = node.look.addPin('', pos, is);

            // add a pad or the pin to the rx / tx table
            pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin);

            // if there is a selection maybe it has to be adjusted
            view.selection.adjustForNewWidget(pin);

            // edit the name field
            view.beginTextEdit(pin);

            // store and report the new edit - here the rxtx or the pad is added !
            editor.saveEdit('newPin', { view, pin });
        },
        undo({ view, pin }) {
            // if the pin was not created (no valid name) just return
            if (!pin || !pin.node.look.widgets.includes(pin)) return;

            // the node
            const node = pin.node;

            // adjust selection before deleting the pin
            view.selection.adjustForRemovedWidget(pin);

            // remove the pin
            node.look.removePin(pin);

            // it is the last entry in the rx/tx table
            pin.is.proxy ? node.pads.pop() : node.rxtxPopPin(pin);
        },
        redo({ view, pin }) {
            // if the pin was not created (no valid name) just return
            if (!pin || !pin.node.look.widgets.includes(pin)) return;

            // the node
            const node = pin.node;

            // restore the pin to its previous place in the look
            node.look.restorePin(pin);

            // add the pin to the rx / tx table
            pin.is.proxy ? node.addPad(pin) : node.rxtxAddPin(pin);

            // switch the selected pin
            view.selection.adjustForNewWidget(pin);
        },
    },

    disconnectPin: {
        doit({ pin }) {
            // save the routes before disconnecting ...
            const savedRoutes = pin.routes.slice();

            // disconnect
            pin.disconnect();

            // store and report the new edit
            editor.saveEdit('disconnectPin', { pin, routes: savedRoutes });
        },
        undo({ pin, routes }) {
            pin.reconnect(routes);
        },
        redo({ pin, routes }) {
            pin.disconnect();
        },
    },

    deletePin: {
        doit({ view, pin }) {
            // save the routes
            const pinRoutes = pin.routes.slice();

            // also for the pad if applicable
            const padRoutes = pin.is.proxy ? pin.pad.routes.slice() : null;

            // save the edit *before* the delete !
            editor.saveEdit('deletePin', { view, pin, pinRoutes, padRoutes });

            // adjust selection before deleting the pin
            view.selection.adjustForRemovedWidget(pin);

            // disconnect
            pin.disconnect();

            // delete the pin in the node
            pin.node.look.removePin(pin);

            // if proxy remove pad
            if (pin.is.proxy) {
                pin.pad.disconnect();

                pin.node.removePad(pin.pad);
            }
            // if not remove from rx table
            else pin.node.rxtxRemovePin(pin);
        },
        undo({ view, pin, pinRoutes, padRoutes }) {
            // copy the routes (redo destroys the array - we want to keep it on the undo stack !)
            const copyRoutes = pinRoutes.slice();

            // put the pin back
            pin.node.look.restorePin(pin);

            // if there is a selection maybe it has to be adjusted
            view.selection.adjustForNewWidget(pin);

            // reconnect the routes to the pin
            pin.reconnect(copyRoutes);

            // reconnect the routes to the pad
            if (pin.is.proxy) {
                // first add the pad again ?

                // reconnect the routes
                pin.pad.reconnect(padRoutes);
            }
        },

        redo({ view, pin, pinRoutes, padRoutes }) {
            // first disconnect
            pin.disconnect();

            // adjust selection before deleting the pin
            view.selection.adjustForRemovedWidget(pin);

            // remove the pin
            pin.node.look.removePin(pin);
        },
    },

    // change the pin from an input type to an output type
    ioSwitch: {
        doit({ pin }) {
            if (pin.ioSwitch()) editor.saveEdit('ioSwitch', pin);
        },
        undo({ pin }) {
            pin.ioSwitch();
        },
        redo({ pin }) {
            pin.ioSwitch();
        },
    },

    // change the pin from an input type to an output type
    channelOnOff: {
        doit({ pin }) {
            if (pin.channelOnOff()) editor.saveEdit('channelOnOff', pin);
        },
        undo({ pin }) {
            pin.channelOnOff();
        },
        redo({ pin }) {
            pin.channelOnOff();
        },
    },

    pinDrag: {
        doit({ pin }) {
            // just save the current position
            editor.saveEdit('pinDrag', {
                pin,
                oldPos: { left: pin.is.left, y: pin.rect.y },
                newPos: null,
            });
        },
        undo({ pin, oldPos, newPos }) {
            pin.moveTo(oldPos.left, oldPos.y);
        },
        redo({ pin, oldPos, newPos }) {
            pin.moveTo(newPos.left, newPos.y);
        },
    },

    /*
pinAreaDrag: {

    doit(view) {

        // The widgets that are being dragged
        const widgets = view.selection.widgets

        // get the current y-position of the selected widgets
        editor.saveEdit('pinAreaDrag', {widgets, oldY:widgets[0].rect.y, newY:widgets[0].rect.y})
    },
    undo({widgets, oldY, newY}) {
    },
    redo({widgets, oldY, newY}) {
    }
},
*/
    showProfile: {
        doit({ pin, pos }) {
            // check that we have a model
            if (!editor.doc?.model) return;

            // get the contract for the pin
            const contract = editor.doc.model.getContract(pin)

            // get the pin profile (can be a single profile or an array !)
            const profile = pin.is.input
                ? editor.doc.model.getInputPinProfile(pin)
                : editor.doc.model.getOutputPinProfile(pin);

            // check
            // if (!profile) {
            //     console.log(`NO PROFILE ${pin.name}`);
            //     // return;
            // }

            // show the profile
            editor.tx.send('pin profile', {
                pos,
                pin,
                contract,
                profile,

                // The function that is called when clicking the handler name
                open(loc) {
                    //const arl = new ARL(loc.file)

                    // resolve the file name with the model name
                    const arl = editor.doc.model.getArl().resolve(loc.file);

                    // request to open the source file
                    editor.tx.send('open source file', { arl, line: loc.line });
                },
            });
        },

        undo() {},
        redo() {},
    },

    addLabel: {
        doit({ node }) {
            // find the label of the look or add an empty one
            let label =
                node.look.widgets.find((widget) => widget.is.label) ??
                node.look.addLabel('');

            // start editing the field - parameters = object - must have the edit ifPins !
            editor.doc?.focus?.beginTextEdit(label);

            // signal the edit
            editor.saveEdit('addLabel', { node, label });
        },
        undo({ node, label }) {
            node.look.removeLabel();
        },
        redo({ node, label }) {
            node.look.restoreLabel(label);
        },
    },

    widgetTextEdit: {
        doit({ view, widget, cursor, clear }) {
            // check if field is editable - must return the prop that will be edited
            const prop = widget.startEdit?.();

            // check
            if (!prop) return;

            // save the old value
            editor.saveEdit('widgetTextEdit', {
                widget,
                prop,
                oldText: widget[prop],
                newText: '',
            });

            // keyboard handling etc is done here
            view.beginTextEdit(widget, cursor, clear ?? false);
        },
        undo({ widget, prop, oldText, newText }) {
            /*
        better is to call simply undoTextEdit
        ======================================

        widget.undoTextEdit(oldText)
        */

            // save the new text now also !
            newText = widget[prop];
            editor.getParam().newText = newText;
            widget[prop] = oldText;

            // signal the widget that the value has changed
            widget.endEdit(newText);
        },
        redo({ widget, prop, oldText, newText }) {
            widget[prop] = newText;

            widget.endEdit(oldText);
        },
    },
};
