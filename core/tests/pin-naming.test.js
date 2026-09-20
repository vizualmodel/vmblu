import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {Pin} from '../types/widget/widget-pin.js'
import {interfaceHandling} from '../types/node/look-interface.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'
import {Pad} from '../types/node/pad.js'
import {InterfaceName} from '../types/widget/widget-interface-name.js'
import {redoxInterface} from '../nodes/model-manager/redox-interface.js'
import {View, doing} from '../types/view/view-base.js'

function fixture(name = '', iface = 'items') {
    const heading = {text: iface, rect: {y: 0}, is: {ifName: true}}
    const look = {
        ...interfaceHandling,
        rect: {y: 0, h: 100},
        widgets: iface ? [heading] : [],
        adjustPinWidth() {}, setDuplicatePin() {},
    }
    const pin = new Pin({x: 0, y: 20, w: 100, h: 20}, {look, rxTable: [], txTable: []}, name, {input: true})
    heading.node = pin.node
    look.widgets.push(pin)
    pin.ifNamePrefixCheck()
    return {pin, look, heading}
}

function edit(pin, text) {
    pin.startEdit(null)
    const saved = pin.name
    if (text !== undefined) pin.name = text
    pin.endEdit(saved)
}

test('plain typed names qualify by default; apostrophes escape qualification', () => {
    for (const [typed, expected, pxlen] of [
        ['add', 'items.add', 5], ['a', 'items.a', 5],
        ["'add", 'add', 0], ["'add'", 'add', 0],
        ["'legacy.add'", 'legacy.add', 0], ["'add.'", 'add.', 0],
    ]) {
        const {pin} = fixture()
        edit(pin, typed)
        assert.equal(pin.name, expected)
        assert.equal(pin.pxlen, pxlen)
        assert.equal(pin.makeRaw().name, expected)
    }
})

test('all explicit prefix and suffix separators survive editing and interface renames', () => {
    for (const separator of ['.', '/', '-', '_', '+', '₊']) {
        const actual = separator === '+' || separator === '₊' ? ' ' : separator
        for (const suffix of [false, true]) {
            const {pin} = fixture()
            edit(pin, suffix ? 'add' + separator : separator + 'add')
            const expected = suffix ? 'add' + actual + 'items' : 'items' + actual + 'add'
            assert.equal(pin.name, expected)
            edit(pin)
            assert.equal(pin.name, expected)
            pin.changePrefix('commands')
            assert.equal(pin.name, suffix ? 'add' + actual + 'commands' : 'commands' + actual + 'add')
        }
    }
})

test('absolute names display a quote only inside named interfaces and survive no-op edits', () => {
    for (const iface of ['items', '']) {
        const {pin} = fixture('add', iface)
        assert.equal(pin.displayName(false), iface ? "'add" : 'add')
        edit(pin)
        assert.equal(pin.name, 'add')
        assert.equal(pin.pxlen, 0)
    }
    const {pin} = fixture('', '')
    edit(pin, 'add')
    assert.equal(pin.name, 'add')
})

test('render labels, edit labels and layout labels agree without double quotes', () => {
    for (const name of ['items.add', 'add', 'items/add', 'add.items', 'items add']) {
        const {pin, look} = fixture(name)
        const label = pin.displayName(false)
        assert.equal(look.displayName(name, pin.rect.y), label)
        pin.startEdit(null)
        assert.equal(pin.displayName(false), label)
        pin.endEdit(label)
        assert.equal(pin.name, name)
    }
})

test('invalid edits restore canonical names and prefix state', () => {
    for (const name of ['items.add', 'add', 'add.items']) {
        for (const invalid of ["'", "''", '.', '+']) {
            const {pin} = fixture(name)
            const oldPrefix = pin.pxlen
            edit(pin, invalid)
            assert.equal(pin.name, name)
            assert.equal(pin.pxlen, oldPrefix)
        }
    }
})

test('interface recognition requires a separator and never rewrites stored names', () => {
    for (const name of ['itemsAdded', 'myitems', 'items', 'items.add', 'add.items', 'items/add']) {
        const {pin, look} = fixture(name)
        const prefix = pin.pxlen
        look.interfaceCheck()
        assert.equal(pin.pxlen, prefix)
        assert.equal(pin.name, name)
        if (['itemsAdded', 'myitems', 'items'].includes(name)) assert.equal(prefix, 0)
    }
})

test('pin name undo and redo restore canonical state without re-qualification', () => {
    for (const name of ['add', 'items.add', 'add.items']) {
        const {pin} = fixture(name)
        let record
        const manager = {saveEdit(verb, data) { if (data) record = data; return record }}
        const view = {beginTextEdit(widget) {
            widget.startEdit(null)
            this.textField = {prop: 'name', saved: widget.name}
        }}
        redoxWidget.widgetTextEdit.doit.call(manager, {view, widget: pin})
        pin.name = 'remove'
        pin.endEdit(view.textField.saved)
        for (let i = 0; i < 2; i++) {
            redoxWidget.widgetTextEdit.undo.call(manager, record)
            assert.equal(pin.name, name)
            redoxWidget.widgetTextEdit.redo.call(manager, record)
            assert.equal(pin.name, 'items.remove')
            assert.equal(pin.pxlen, 5)
        }
    }
})

test('full-name pad edits do not double-prefix the corresponding proxy', () => {
    for (const name of ['items.add', 'add']) {
        const {pin} = fixture(name)
        const pad = {
            proxy: pin, text: name, is: {}, rect: {},
            checkRouteUsage() {}, getWidth() { return 100 },
        }
        Pad.prototype.endEdit.call(pad, name)
        assert.equal(pin.name, name)
        assert.equal(pad.text, name)
    }
})

test('interface deletion undo restores prefixes for mixed absolute, prefix and suffix pins', () => {
    const {pin, look, heading} = fixture('items.add')
    const absolute = new Pin({y: 40}, pin.node, 'remove', {input: true})
    const suffix = new Pin({y: 60}, pin.node, 'new.items', {input: true})
    look.widgets.push(absolute, suffix)
    suffix.ifNamePrefixCheck()
    const saved = look.showPrefixes(heading)
    assert.deepEqual([pin.pxlen, absolute.pxlen, suffix.pxlen], [0, 0, 0])
    look.hidePrefixes(heading, saved)
    assert.deepEqual([pin.pxlen, absolute.pxlen, suffix.pxlen], [5, 0, -5])
})

test('moving a qualified pin between interfaces replaces its namespace', () => {
    const {pin, heading} = fixture('items.add')
    heading.text = 'other'
    pin.moveToInterface()
    assert.equal(pin.name, 'other.add')
    assert.equal(pin.displayName(false), 'add')
    edit(pin)
    assert.equal(pin.name, 'other.add')
})

test('moving legacy prefix and suffix names uses the destination dot prefix', () => {
    for (const name of ['items/add', 'add-items', 'items add', 'add_items']) {
        const {pin, heading} = fixture(name)
        heading.text = 'commands'
        pin.moveToInterface()
        assert.equal(pin.name, 'commands.add')
        assert.equal(pin.pxlen, 8)
    }
})

test('moving outside retains the full name; later moves preserve its absolute state', () => {
    const {pin, heading} = fixture('items.add')
    pin.rect.y = -20
    pin.moveToInterface()
    assert.equal(pin.name, 'items.add')
    assert.equal(pin.pxlen, 0)
    assert.equal(pin.displayName(false), 'items.add')
    pin.rect.y = 20
    heading.text = 'commands'
    pin.moveToInterface()
    assert.equal(pin.name, 'items.add')
    assert.equal(pin.displayName(false), "'items.add")
})

test('absolute and read-only linked pins keep their message names when moved', () => {
    for (const readonly of [false, true]) {
        const {pin, heading} = fixture(readonly ? 'items.add' : 'add')
        pin.node.cannotBeModified = () => readonly
        heading.text = 'commands'
        pin.moveToInterface()
        assert.equal(pin.name, readonly ? 'items.add' : 'add')
        assert.equal(pin.pxlen, 0)
    }
})

test('pin and heading drag undo/redo restore names, prefix state and positions', () => {
    for (const headingDrag of [false, true]) {
        const {pin, look} = fixture('items.add')
        const heading = new InterfaceName({y: 40, h: 20}, 'commands', pin.node)
        look.widgets.push(heading)
        look.findNextWidget = () => headingDrag ? pin : heading
        const oldState = look.capturePinMove()
        if (headingDrag) heading.drag({y: 10})
        else pin.drag({x: 0, y: 60})
        assert.equal(pin.name, 'commands.add')
        let record
        const manager = {saveEdit(verb, data) { record = data }}
        const operation = headingDrag ? redoxInterface.interfaceNameDrag : redoxWidget.pinDrag
        operation.doit.call(manager, {pin, ifName: heading, oldState})
        for (let i = 0; i < 2; i++) {
            operation.undo.call(manager, record)
            assert.equal(pin.name, 'items.add')
            assert.equal(pin.pxlen, 5)
            assert.equal(pin.rect.y, 20)
            assert.equal(heading.rect.y, 40)
            operation.redo.call(manager, record)
            assert.equal(pin.name, 'commands.add')
            assert.equal(pin.pxlen, 8)
        }
    }
})

test('starting a drag captures canonical names before the mouse moves', () => {
    const {pin} = fixture('items.add')
    const view = {state: {action: doing.nothing, lookWidget: pin, modo: {}}}
    View.prototype.stateSwitch.call(view, doing.pinDrag)
    const saved = view.state.modo.pinMove.find(state => state.widget === pin)
    assert.equal(saved.name, 'items.add')
    assert.equal(saved.pxlen, 5)
    assert.equal(view.state.modo.y, pin.rect.y)
    assert.equal(view.state.modo.left, pin.is.left)
    pin.name = 'commands.add'
    assert.equal(saved.name, 'items.add')
})

test('undo restores qualification after moving outside and updates proxy pad names', () => {
    const {pin, look} = fixture('items.add')
    const pad = {text: pin.name}
    pin.nameChanged = () => { pad.text = pin.name }
    const before = look.capturePinMove()
    pin.rect.y = -20
    pin.moveToInterface()
    look.restorePinMove(before)
    assert.equal(pin.pxlen, 5)
    look.widgets[0].text = 'commands'
    pin.moveToInterface()
    assert.equal(pad.text, 'commands.add')
    look.restorePinMove(before)
    assert.equal(pad.text, 'items.add')
})

for (const path of ['../../playground/model/playground.mod.blu', '../../vscodex/webview/model/webview.mod.blu']) {
    test(`${path}: existing pin names survive load/display/edit without source migration`, async () => {
        const raw = JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
        let count = 0
        function visit(value) {
            if (!value || typeof value !== 'object') return
            if (Array.isArray(value.interfaces)) {
                for (const iface of value.interfaces) {
                    for (const member of iface.pins ?? []) {
                        const {pin} = fixture(member.name, iface.interface ?? '')
                        const prefix = pin.pxlen
                        edit(pin)
                        assert.equal(pin.name, member.name, `${iface.interface}: ${member.name}`)
                        assert.equal(pin.pxlen, prefix)
                        count++
                    }
                }
            }
            for (const child of Object.values(value)) visit(child)
        }
        visit(raw.root)
        assert.ok(count > 0)
    })
}
