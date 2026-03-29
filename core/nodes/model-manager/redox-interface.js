import { ARL } from '../../types/arl/index.js';
export const redoxInterface = {
    newInterfaceName: {
        doit({ view, node, pos }) {
            // get the position behind the selection, if any
            pos = view.selection.behind() ?? pos;

            // make a new ifName and put it in edit mode
            let ifName = node.look.addIfName('', pos);

            // set the field in edit mode
            view.beginTextEdit(ifName);

            // switch the selected pin
            view.selection.adjustForNewWidget(ifName);

            // store and report the new edit
            this.saveEdit('newInterfaceName', { ifName });
        },
        undo({ ifName }) {
            ifName.node.look.removeInterfaceName(ifName);
        },
        redo({ ifName }) {
            ifName.node.look.restoreInterfaceName(ifName);
        },
    },

    deleteInterfaceName: {
        doit({ view, ifName }) {
            // switch the selected pin
            view.selection.adjustForRemovedWidget(ifName);

            // show the full names of the ifName group
            const pxlenArray = ifName.node.look.showPrefixes(ifName);

            // remove the pin
            ifName.node.look.removeInterfaceName(ifName);

            // store and report the new edit
            this.saveEdit('deleteInterfaceName', {
                view,
                ifName,
                pxlenArray,
            });
        },
        undo({ view, ifName, pxlenArray }) {
            // restore the ifName
            ifName.node.look.restoreInterfaceName(ifName);

            // restore the prefixes
            ifName.node.look.hidePrefixes(ifName, pxlenArray);

            // switch the selection
            view.selection.switchToWidget(ifName);
        },
        redo({ view, ifName, pxlenArray }) {
            // switch the selection
            view.selection.switchToWidget();

            // show the full names of the ifName group
            ifName.node.look.showPrefixes(ifName);

            // remove the ifName
            ifName.node.look.removeInterfaceName(ifName);
        },
    },

    interfaceDrag: {
        doit({ group, oldY, newY }) {
            // just save the parameters...
            this.saveEdit('interfaceDrag', { group, oldY, newY });
        },
        undo({ group, oldY, newY }) {
            const dy = oldY - newY;
            const node = group[0].node;
            node.look.groupMove(group, dy);
        },

        redo({ group, oldY, newY }) {
            const dy = newY - oldY;
            const node = group[0].node;
            node.look.groupMove(group, dy);
        },
    },

    interfaceNameDrag: {
        doit({ ifName,oldY, newY }) {
            // just save the parameters
            this.saveEdit('interfaceNameDrag', {ifName,oldY,newY});
        },
        undo({ ifName, oldY, newY }) {
            ifName.moveTo(oldY);
        },
        redo({ ifName, oldY, newY }) {
            ifName.moveTo(newY);
        },
    },

    // deleteInterface: {
    //     doit({ ifName }) {
    //         this.saveEdit('deleteInterface');
    //     },
    //     undo({ ifName, oldY, newY }) {
    //         ifName.moveTo(oldY);
    //     },
    //     redo({ ifName, oldY, newY }) {
    //         ifName.moveTo(newY);
    //     },
    // },
};
