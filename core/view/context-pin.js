import { editor } from '../editor/index.js';

const noLink = [
    {
        text: 'new output',
        char: 'o',
        icon: 'logout',
        state: 'enabled',
        action: newOutput,
    },
    {
        text: 'new input',
        char: 'i',
        icon: 'login',
        state: 'enabled',
        action: newInput,
    },
    {
        text: 'new interface',
        char: 'p',
        icon: 'drag_handle',
        state: 'enabled',
        action: newInterfaceName,
    },
    {
        text: 'new request',
        char: 'q',
        icon: 'switch_left',
        state: 'enabled',
        action: newRequest,
    },
    {
        text: 'new reply',
        char: 'r',
        icon: 'switch_right',
        state: 'enabled',
        action: newReply,
    },
    {
        text: 'in/out switch',
        icon: 'cached',
        state: 'disabled',
        action: inOutSwitch,
    },
    {
        text: 'add channel',
        icon: 'adjust',
        state: 'disabled',
        action: channelOnOff,
    },
    {
        text: 'paste pins',
        char: 'ctrl v',
        icon: 'content_copy',
        state: 'enabled',
        action: pasteWidgetsFromClipboard,
    },
    { text: 'profile', icon: 'info', state: 'disabled', action: showProfile },
    {
        text: 'all pins swap left right',
        icon: 'swap_horiz',
        state: 'enabled',
        action: pinsSwap,
    },
    {
        text: 'all pins left',
        icon: 'arrow_back',
        state: 'enabled',
        action: pinsLeft,
    },
    {
        text: 'all pins right',
        icon: 'arrow_forward',
        state: 'enabled',
        action: pinsRight,
    },
    {
        text: 'disconnect',
        icon: 'power_off',
        state: 'disabled',
        action: disconnectPin,
    },
    { text: 'delete', icon: 'delete', state: 'enabled', action: deletePin },
];

const withLink = [
    { text: 'profile', icon: 'info', state: 'disabled', action: showProfile },
    {
        text: 'all pins swap left right',
        icon: 'swap_horiz',
        state: 'enabled',
        action: pinsSwap,
    },
    {
        text: 'all pins left',
        icon: 'arrow_back',
        state: 'enabled',
        action: pinsLeft,
    },
    {
        text: 'all pins right',
        icon: 'arrow_forward',
        state: 'enabled',
        action: pinsRight,
    },
    {
        text: 'disconnect',
        icon: 'power_off',
        state: 'disabled',
        action: disconnectPin,
    },
];

// click on the node
export const pinCxMenu = {
    choices: null,

    view: null,
    node: null,
    widget: null,
    xyLocal: null,
    xyScreen: null,

    // a specific function to turn on/off the options of the right click menu
    prepare(view) {
        this.view = view;
        this.node = view.hit.node;
        this.widget = view.hit.lookWidget;
        this.xyLocal = view.hit.xyLocal;
        this.xyScreen = view.hit.xyScreen;

        // linked nodes hve much less options
        if (this.node.link) {
            // The number of options is reduced
            this.choices = withLink;

            // only pins can be disconnected
            let entry = this.choices.find((c) => c.action == disconnectPin);
            entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

            // profiles are only available for pins
            entry = this.choices.find((c) => c.action == showProfile);
            entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

            return;
        }

        this.choices = noLink;

        // only pins can be disconnected
        let entry = this.choices.find((c) => c.action == disconnectPin);
        entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

        // swap input to output
        entry = this.choices.find((c) => c.action == inOutSwitch);
        let enable = this.widget?.is.pin && this.widget.routes.length == 0;
        entry.state = enable ? 'enabled' : 'disabled';
        entry.text =
            enable && this.widget.is.input
                ? 'change to output'
                : 'change to input';

        // switch channel on or off
        entry = this.choices.find((c) => c.action == channelOnOff);
        enable = this.widget?.is.pin; // && ! this.widget.is.proxy
        entry.state = enable ? 'enabled' : 'disabled';
        entry.text =
            enable && this.widget.is.channel ? 'remove channel' : 'add channel';

        // profiles are only available for pins
        entry = this.choices.find((c) => c.action == showProfile);
        entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

        // switch the delete action
        entry = this.choices.find((c) => c.text == 'delete');
        entry.action = this.widget?.is.pin
            ? deletePin
            : this.widget?.is.ifName
              ? deleteInterfaceName
              : () => {};

        // check if there are pins to paste
        entry = this.choices.find((c) => c.text == 'paste pins');
    },
};

// is = {channel, input, request, proxy}
function newInput() {
    // set the flags
    const is = { channel: false, input: true, proxy: pinCxMenu.node.is.group };
    editor.doEdit('newPin', {
        view: pinCxMenu.view,
        node: pinCxMenu.node,
        pos: pinCxMenu.xyLocal,
        is,
    });
}
function newOutput() {
    // set the flags
    const is = { channel: false, input: false, proxy: pinCxMenu.node.is.group };
    editor.doEdit('newPin', {
        view: pinCxMenu.view,
        node: pinCxMenu.node,
        pos: pinCxMenu.xyLocal,
        is,
    });
}
function newRequest() {
    // set the flags
    const is = { channel: true, input: false, proxy: pinCxMenu.node.is.group };
    editor.doEdit('newPin', {
        view: pinCxMenu.view,
        node: pinCxMenu.node,
        pos: pinCxMenu.xyLocal,
        is,
    });
}
function newReply() {
    // set the flags
    const is = { channel: true, input: true, proxy: pinCxMenu.node.is.group };
    editor.doEdit('newPin', {
        view: pinCxMenu.view,
        node: pinCxMenu.node,
        pos: pinCxMenu.xyLocal,
        is,
    });
}
function inOutSwitch() {
    editor.doEdit('ioSwitch', { pin: pinCxMenu.widget });
}
function channelOnOff() {
    editor.doEdit('channelOnOff', { pin: pinCxMenu.widget });
}
function disconnectPin() {
    editor.doEdit('disconnectPin', { pin: pinCxMenu.widget });
}
function deletePin() {
    editor.doEdit('deletePin', { view: pinCxMenu.view, pin: pinCxMenu.widget });
}
function newInterfaceName() {
    editor.doEdit('newInterfaceName', {
        view: pinCxMenu.view,
        node: pinCxMenu.node,
        pos: pinCxMenu.xyLocal,
    });
}
function deleteInterfaceName() {
    editor.doEdit('deleteInterfaceName', {
        view: pinCxMenu.view,
        ifName: pinCxMenu.widget,
    });
}
function showProfile(e) {
    editor.doEdit('showProfile', {
        pin: pinCxMenu.widget,
        pos: { x: pinCxMenu.xyScreen.x, y: pinCxMenu.xyScreen.y + 10 },
    });
}

function pinsSwap() {
    editor.doEdit('swapPins', {
        node: pinCxMenu.node,
        left: true,
        right: true,
    });
}

function pinsLeft() {
    editor.doEdit('swapPins', {
        node: pinCxMenu.node,
        left: true,
        right: false,
    });
}
function pinsRight() {
    editor.doEdit('swapPins', {
        node: pinCxMenu.node,
        left: false,
        right: true,
    });
}
function pasteWidgetsFromClipboard() {
    // request the clipboard - also set the target, the clipboard can come from another file
    editor.tx.request('clipboard get', editor.doc).then((clipboard) => {
        editor.doEdit('pasteWidgetsFromClipboard', {
            view: pinCxMenu.view,
            clipboard,
        });
    });
    //.catch( error => console.log('paste: clipboard get error -> ' + error))
}
