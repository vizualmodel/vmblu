const noLink = [
    {text: 'profile',           char: 'p',  icon: 'info', state: 'disabled', action: showProfile },    
    {text: 'new output',        char: 'o',  icon: 'logout',state: 'enabled',action: newOutput,},
    {text: 'new input',         char: 'i',  icon: 'login',state: 'enabled',action: newInput,},
    {text: 'new interface',     char: 'f',  icon: 'drag_handle',state: 'enabled',action: newInterfaceName,},
    {text: 'new request',       char: 'q',  icon: 'switch_left',        state: 'enabled',        action: newRequest,    },
    {text: 'new reply',         char: 'r',  icon: 'switch_right',        state: 'enabled',        action: newReply,    },
    {text: 'in/out switch',                 icon: 'cached',        state: 'disabled',        action: inOutSwitch,    },
    {text: 'add channel',                   icon: 'adjust',        state: 'disabled',        action: channelOnOff,    },    
    {text: 'paste pins',        char: 'ctrl v',        icon: 'content_copy',        state: 'enabled',        action: pasteWidgetsFromClipboard,    },    
    {text: 'all pins swap left right',      icon: 'swap_horiz',        state: 'enabled',        action: pinsSwap,    },    
    {text: 'all pins left',                 icon: 'arrow_back',        state: 'enabled',        action: pinsLeft,    },    
    {text: 'all pins right',                icon: 'arrow_forward',        state: 'enabled',        action: pinsRight,    },    
    {text: 'disconnect',                    icon: 'power_off',        state: 'disabled',        action: disconnectPin,    },    
    {text: 'delete',                        icon: 'delete', state: 'enabled', action: deletePin },
];

const withLink = [
    {text: 'profile',                      icon: 'info', state: 'disabled', action: showProfile },    
    {text: 'all pins swap left right',      icon: 'swap_horiz',        state: 'enabled',        action: pinsSwap,    },    
    {text: 'all pins left',                 icon: 'arrow_back',        state: 'enabled',        action: pinsLeft,    },    
    {text: 'all pins right',                icon: 'arrow_forward',        state: 'enabled',        action: pinsRight,    },    
    {text: 'disconnect',                    icon: 'power_off',        state: 'disabled',        action: disconnectPin,    },
    ];

// click on the node
const cm = {
    choices: null,

    view: null,
    tx: null,
    node: null,
    widget: null,
    xyLocal: null,
    xyScreen: null,

    // a specific function to turn on/off the options of the right click menu
    prepare(view, tx) {
        this.view = view;
        this.tx = tx;
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

    doEdit(verb, param) {
        this.tx.send('redox.doit',{verb, param})
    },
};

export const pinCxMenu = cm;


// is = {channel, input, request, proxy}
function newInput() {
    // set the flags
    const is = { channel: false, input: true, proxy: cm.node.is.group };
    cm.doEdit('newPin', {
        view: cm.view,
        node: cm.node,
        pos: cm.xyLocal,
        is,
    });
}
function newOutput() {
    // set the flags
    const is = { channel: false, input: false, proxy: cm.node.is.group };
    cm.doEdit('newPin', {
        view: cm.view,
        node: cm.node,
        pos: cm.xyLocal,
        is,
    });
}
function newRequest() {
    // set the flags
    const is = { channel: true, input: false, proxy: cm.node.is.group };
    cm.doEdit('newPin', {
        view: cm.view,
        node: cm.node,
        pos: cm.xyLocal,
        is,
    });
}
function newReply() {
    // set the flags
    const is = { channel: true, input: true, proxy: cm.node.is.group };
    cm.doEdit('newPin', {
        view: cm.view,
        node: cm.node,
        pos: cm.xyLocal,
        is,
    });
}
function inOutSwitch() {
    cm.doEdit('ioSwitch', { pin: cm.widget });
}
function channelOnOff() {
    cm.doEdit('channelOnOff', { pin: cm.widget });
}
function disconnectPin() {
    cm.doEdit('disconnectPin', { pin: cm.widget });
}
function deletePin() {
    cm.doEdit('deletePin', { view: cm.view, pin: cm.widget });
}
function newInterfaceName() {
    cm.doEdit('newInterfaceName', {
        view: cm.view,
        node: cm.node,
        pos: cm.xyLocal,
    });
}
function deleteInterfaceName() {
    cm.doEdit('deleteInterfaceName', {
        view: cm.view,
        ifName: cm.widget,
    });
}
function showProfile(e) {
    cm.doEdit('showProfile', {
        pin: cm.widget,
        pos: { x: cm.xyScreen.x, y: cm.xyScreen.y + 10 },
    });
}

function pinsSwap() {
    cm.doEdit('swapPins', {
        node: cm.node,
        left: true,
        right: true,
    });
}

function pinsLeft() {
    cm.doEdit('swapPins', {
        node: cm.node,
        left: true,
        right: false,
    });
}
function pinsRight() {
    cm.doEdit('swapPins', {
        node: cm.node,
        left: false,
        right: true,
    });
}
function pasteWidgetsFromClipboard() {
    // request the clipboard - also set the target, the clipboard can come from another file
    cm.tx.request('clipboard.get', cm.doc).then(({raw}) => {
        cm.doEdit('pasteWidgetsFromClipboard', {view: cm.view, raw});
    });
    //.catch( error => console.log('paste: clipboard get error -> ' + error))
}
