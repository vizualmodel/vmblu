const noLink = [
    {text: 'profile',           char: 'p',  icon: 'info', state: 'disabled', action: showProfile },    
    {text: '-',                 char: 't',  icon: 'build', state: 'disabled', action: showCapability },    
    {text: 'new output',        char: 'o',  icon: 'logout',state: 'enabled',action: newOutput,},
    {text: 'new input',         char: 'i',  icon: 'login',state: 'enabled',action: newInput,},
    {text: 'new interface',     char: 'f',  icon: 'drag_handle',state: 'enabled',action: newInterfaceName,},
    {text: 'new request',       char: 'q',  icon: 'switch_left',        state: 'enabled',        action: newRequest,    },
    {text: 'new reply',         char: 'r',  icon: 'switch_right',        state: 'enabled',        action: newReply,    },
    {text: 'in/out switch',                 icon: 'cached',        state: 'disabled',        action: inOutSwitch,    },
    {text: 'add channel',                   icon: 'adjust',        state: 'disabled',        action: channelOnOff,    },    
    {text: 'copy',         char: 'ctrl c',        icon: 'content_copy',        state: 'enabled',        action: selectionToClipboard,    },    
    {text: 'paste',        char: 'ctrl v',        icon: 'content_copy',        state: 'enabled',        action: pasteWidgetsFromClipboard,    },    
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
            this.choices = withLink.map(choice => ({...choice}));
            addBundleChoices(this);

            // only pins can be disconnected
            let entry = this.choices.find((c) => c.action == disconnectPin);
            entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

            // profiles are only available for pins
            entry = this.choices.find((c) => c.action == showProfile);
            entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

            return;
        }

        this.choices = noLink.map(choice => ({...choice}));
        addBundleChoices(this);

        // only pins can be disconnected
        let entry = this.choices.find((c) => c.action == disconnectPin);
        entry.state = this.widget?.is.pin ? 'enabled' : 'disabled';

        // swap input to output
        entry = this.choices.find((c) => c.action == inOutSwitch);
        let enable = this.widget?.is.pin && !this.widget.bundle && this.widget.routes.length == 0;
        entry.state = enable ? 'enabled' : 'disabled';
        entry.text =
            enable && this.widget.is.input
                ? 'change to output'
                : 'change to input';

        // switch channel on or off
        entry = this.choices.find((c) => c.action == channelOnOff);
        enable = this.widget?.is.pin && !this.widget.bundle;
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
        // entry = this.choices.find((c) => c.text == 'paste pins');

        // Tool settings
        entry = this.choices.find((c) => c.action == showCapability);
        entry.text = this.widget?.is.input ? 'tool settings' : 'event settings'
        entry.state = this.widget?.is.pin ? 'enabled' : 'disabled'
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
    selectBundleMember(cm, e, pin => cm.doEdit('showProfile', {
        pin,
        pos: { x: cm.xyScreen.x, y: cm.xyScreen.y + 10 },
    }));
}
function showCapability(e) {
    selectBundleMember(cm, e, pin => cm.doEdit('showCapability', {
        pin,
        pos: { x: cm.xyScreen.x, y: cm.xyScreen.y + 10 },
    }));
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
    const view = cm.view
    const tx = cm.tx
    const target = {node: cm.node, widget: cm.widget}
    // request the clipboard - also set the target, the clipboard can come from another file
    cm.tx.request('clipboard.get', cm.doc).then(({raw}) => {
        view.doEdit(tx, 'pasteWidgetsFromClipboard', {view, raw, target});
    });
    //.catch( error => console.log('paste: clipboard get error -> ' + error))
}
function selectionToClipboard() {
	if (cm.widget?.is.pin) cm.view.selection.switchToWidget(cm.widget)
	cm.view.selectionToClipboard(cm.tx)
}

function addBundleChoices(menu) {
    if (!menu.widget?.bundle) return
    menu.choices.unshift({text: 'Expand pins', icon: 'unfold_more', state: 'enabled', action: () => menu.doEdit('expandBundle', {view: menu.view, pin: menu.widget})})
    menu.choices.push({text: 'Rename member', icon: 'edit', state: menu.node.link ? 'disabled' : 'enabled', action: e => selectBundleMember(menu, e, member => { menu.doEdit('expandBundle', {view: menu.view, pin: member}); menu.doEdit('widgetTextEdit', {view: menu.view, widget: member}) })})
    menu.choices.push({text: 'Delete member', icon: 'delete', state: menu.node.link ? 'disabled' : 'enabled', action: e => selectBundleMember(menu, e, member => menu.doEdit('deletePin', {view: menu.view, pin: member, bundleMember: true}))})
    menu.choices.push({text: 'Delete underlying pins', icon: 'delete', state: menu.node.link ? 'disabled' : 'enabled', action: () => menu.doEdit('deletePinArea', {view: menu.view, node: menu.node, widgets: menu.widget.bundle.slice()})})
}

function selectBundleMember(menu, event, action) {
    if (!menu.widget.bundle) return action(menu.widget)
    menu.tx.send('context menu', {
        event: event ?? {clientX: menu.xyScreen.x, clientY: menu.xyScreen.y},
        menu: menu.widget.bundle.map(member => ({
            text: member.displayName(false), icon: 'arrow_right', state: 'enabled',
            action: () => action(member),
        })),
    })
}
