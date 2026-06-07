import {collapseEndpointOnlyCables, redoCableCollapses, undoCableCollapses} from '../../types/node/index.js'

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
            this.saveEdit('newPin', { view, pin });
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
            const affectedCables = pin.disconnect();

            const collapses = collapseEndpointOnlyCables(affectedCables);

            // store and report the new edit
            this.saveEdit('disconnectPin', { pin, routes: savedRoutes, collapses });
        },
        undo({ pin, routes, collapses }) {
            undoCableCollapses(collapses);
            pin.reconnect(routes);
        },
        redo({ pin, routes, collapses }) {
            pin.disconnect();
            redoCableCollapses(collapses);
        },
    },

    deletePin: {
        doit({ view, pin }) {
            // save the routes
            const pinRoutes = pin.routes.slice();

            // also for the pad if applicable
            const padRoutes = pin.is.proxy ? pin.pad.routes.slice() : null;

            // adjust selection before deleting the pin
            view.selection.adjustForRemovedWidget(pin);

            // disconnect
            const affectedCables = pin.disconnect();

            if (pin.is.proxy) {
                affectedCables.push(...pin.pad.disconnect());
            }

            const collapses = collapseEndpointOnlyCables(affectedCables, pin.node);

            // save the edit after disconnect/collapse state is known, before the pin is removed.
            this.saveEdit('deletePin', { view, pin, pinRoutes, padRoutes, collapses });

            // delete the pin in the node
            pin.node.look.removePin(pin);

            // if proxy remove pad
            if (pin.is.proxy) {
                pin.node.removePad(pin.pad);
            }
            // if not remove from rx table
            else pin.node.rxtxRemovePin(pin);
        },
        undo({ view, pin, pinRoutes, padRoutes, collapses }) {
            undoCableCollapses(collapses);

            // copy the routes (redo destroys the array - we want to keep it on the undo stack !)
            const copyRoutes = pinRoutes.slice();

            // put the pin back
            pin.node.look.restorePin(pin);

            if (pin.is.proxy) pin.node.restorePad(pin.pad);

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

        redo({ view, pin, pinRoutes, padRoutes, collapses }) {
            // first disconnect
            pin.disconnect();

            if (pin.is.proxy) pin.pad.disconnect();

            redoCableCollapses(collapses);

            // adjust selection before deleting the pin
            view.selection.adjustForRemovedWidget(pin);

            // remove the pin
            pin.node.look.removePin(pin);

            if (pin.is.proxy) pin.node.removePad(pin.pad);
            else pin.node.rxtxRemovePin(pin);
        },
    },

    // change the pin from an input type to an output type
    ioSwitch: {
        doit({ pin }) {
            if (pin.ioSwitch()) this.saveEdit('ioSwitch', pin);
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
            if (pin.channelOnOff()) this.saveEdit('channelOnOff', pin);
        },
        undo({ pin }) {
            pin.channelOnOff();
        },
        redo({ pin }) {
            pin.channelOnOff();
        },
    },

    tackSelectivitySwitch: {
        doit({ tack }) {
            if (!tack?.is?.tack) return

            // check that the tack can be selective
            if (! tack.canBeSelective()) return

            const oldSelective = tack.is.selective
            const newSelective = !oldSelective

            setTackSelectivity(tack, newSelective)
            this.saveEdit('tackSelectivitySwitch', {tack, oldSelective, newSelective})
        },
        undo({ tack, oldSelective }) {
            setTackSelectivity(tack, oldSelective)
        },
        redo({ tack, newSelective }) {
            setTackSelectivity(tack, newSelective)
        },
    },

    pinDrag: {
        doit({ pin, oldY, oldLeft}) {
            // just save the current position
            this.saveEdit('pinDrag', {
                pin,
                newPos: { left: pin.is.left, y: pin.rect.y },
                oldPos: { left: oldLeft, y: oldY },
            });
        },
        undo({ pin, oldPos, newPos }) {
            pin.moveTo(oldPos.left, oldPos.y);
        },
        redo({ pin, oldPos, newPos }) {
            pin.moveTo(newPos.left, newPos.y);
        },
    },

    showProfile: {
        doit({ pin, pos }) {
            // check that we have a model
            if (!this.manager.model) return;
            const manager = this.manager;

            // get the contract for the pin
            const contract = manager.model.getContract(pin)

            // get the pin profile (can be a single profile or an array !)
            const profile = pin.is.input
                ? manager.model.getInputPinProfile(pin)
                : manager.model.getOutputPinProfile(pin);

            // show the profile
            manager.tx.send('pin profile', {
                
                pos,
                pin,
                contract,
                profile,

                // The function that is called when clicking the handler name
                open: (loc) => {
                    // resolve the file name with the model name
                    const arl = manager.model.getArl().resolve(loc.file);

                    // request to open the source file
                    manager.tx.send('open source file', { arl, line: loc.line });
                },
            });
        },

        undo() {},
        redo() {},
    },

    showCapability: {
        
        doit({ pin, pos }) {

            // check that we have a model
            if (!this.manager.model) return;
            const manager = this.manager;
            const redox = this;

            if (pin.is.input) {
                manager.tx.send('tool settings', {pos,pin,

                    // The function that is called when clicking ok
                    ok: (settings) => {
                        redox.setToolSettings.doit.call(redox, {pin, settings});
                        manager.tx.send('redox.done', {verb: 'setToolSettings'});
                    },})
            }
            else  {
                manager.tx.send('event settings', {pos,pin,

                    // The function that is called when clicking ok
                    ok: (settings) => {
                        redox.setEventSettings.doit.call(redox, {pin, settings});
                        manager.tx.send('redox.done', {verb: 'setEventSettings'});
                    },});
            }
        },

        undo() {},
        redo() {},
    },

    setToolSettings: {
        doit({pin, settings}) {
            if (!pin) return;

            const oldTool = cloneSettings(pin.tool);
            const newTool = normalizeSettings(settings);
            pin.tool = newTool;
            pin.is.capability = isEnabledCapability(pin);

            this.saveEdit('setToolSettings', {pin, oldTool, newTool});
        },
        undo({pin, oldTool}) {
            pin.tool = cloneSettings(oldTool);
            pin.is.capability = isEnabledCapability(pin);
        },
        redo({pin, newTool}) {
            pin.tool = cloneSettings(newTool);
            pin.is.capability = isEnabledCapability(pin);
        },
    },

    setEventSettings: {
        doit({pin, settings}) {
            if (!pin) return;

            const oldEvent = cloneSettings(pin.event);
            const newEvent = normalizeSettings(settings);
            pin.event = newEvent;
            pin.is.capability = isEnabledCapability(pin);

            this.saveEdit('setEventSettings', {pin, oldEvent, newEvent});
        },
        undo({pin, oldEvent}) {
            pin.event = cloneSettings(oldEvent);
            pin.is.capability = isEnabledCapability(pin);
        },
        redo({pin, newEvent}) {
            pin.event = cloneSettings(newEvent);
            pin.is.capability = isEnabledCapability(pin);
        },
    },

    addLabel: {
        doit({ view, node }) {
            if (!view) return
            // find the label of the look or add an empty one
            let label =
                node.look.widgets.find((widget) => widget.is.label) ??
                node.look.addLabel('');

            // start editing the field - parameters = object - must have the edit ifPins !
            view.beginTextEdit(label);

            // signal the edit
            this.saveEdit('addLabel', { node, label });
        },
        undo({ node, label }) {
            node.look.removeLabel();
        },
        redo({ node, label }) {
            node.look.restoreLabel(label);
        },
    },

    widgetTextEdit: {
        doit({ view, widget, click, clear }) {

            // keyboard handling etc is done here
            view.beginTextEdit(widget, click, clear ?? false);

            // save the old value
            this.saveEdit('widgetTextEdit', {widget, prop: view.textField.prop, oldText: view.textField.saved ,newText: ''});
        },
        undo({ widget, prop, oldText, newText }) {

            // save the new text now also !
            newText = widget[prop];
            this.saveEdit().newText = newText;
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

function setTackSelectivity(tack, selective) {
    if (!tack?.route?.from || !tack.route?.to) {
        tack.setSelective(selective)
        return
    }

    disconnectTack(tack)
    tack.setSelective(selective)
    connectTack(tack)
}

function disconnectTack(tack) {
    const other = tack.getOther()

    other.is.tack ? tack.route.rxtxBusBusDisconnect()
    : other.is.pin ? tack.route.rxtxPinBusDisconnect()
    : tack.route.rxtxPadBusDisconnect()
}

function connectTack(tack) {
    const other = tack.getOther()

    other.is.tack ? tack.route.rxtxBusBus()
    : other.is.pin ? tack.route.rxtxPinBus()
    : tack.route.rxtxPadBus()
}

function cloneSettings(settings) {
    return settings == null ? null : structuredClone(settings);
}

function normalizeSettings(settings) {
    if (!settings?.enabled) return null;
    return cloneSettings(settings);
}

function isEnabledCapability(pin) {
    return pin?.tool?.enabled === true || pin?.event?.enabled === true;
}
