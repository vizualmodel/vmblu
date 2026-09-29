import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {View, doing} from '../types/view/view-base.js'
import {TextEdit} from '../types/util/text-edit.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'
import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'

function fixture() {
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'edit.mod.blu', getArl: () => null},
        {kind: 'group', name: 'scene manager', nodes: [], interfaces: [{interface: 'mesh', pins: [
            {name: 'mesh.declare', kind: 'input'}, {name: 'legacy', kind: 'input'},
        ]}]})
    const pins = node.look.widgets.filter(widget => widget.is.pin)
    const ctx = {measureText: text => ({width: text.length * 7})}
    const view = Object.assign(Object.create(View.prototype), {
        state: {action: doing.nothing}, textField: new TextEdit(), startBlinking() {},
        getManager: () => ({getCanvasContext: () => ctx, switchFocus() {}}),
    })
    return {view, pins, ctx}
}

test('restarting a proxy-name edit preserves local text, cursor and canonical name', () => {
    const {view, pins: [pin], ctx} = fixture()
    for (let i = 0; i < 10; i++) {
        view.beginTextEdit(pin)
        assert.equal(pin.name, 'declare')
        assert.equal(pin.displayName(false), 'declare')
        assert.equal(pin.is.editingName, true)
        assert.equal(view.textField.cursor, 7)
        assert.equal(pin.cursorPos(ctx, 7).x - pin.cursorPos(ctx, 0).x, 49)
    }
    view.onKeydown({key: 'Enter'}, {send() {}})
    view.endTextEdit()
    view.stateSwitch(doing.nothing)
    assert.equal(pin.name, 'mesh.declare')
    assert.equal(pin.pad.text, 'mesh.declare')
    assert.equal(pin.pxlen, 4)
})

test('switching fields commits the old proxy and Escape restores the new absolute name', () => {
    const {view, pins: [first, second]} = fixture()
    view.beginTextEdit(first)
    first.name = 'updated'
    view.beginTextEdit(second)
    assert.equal(first.name, 'mesh.updated')
    assert.equal(first.pad.text, 'mesh.updated')
    assert.equal(first.is.editingName, false)
    assert.equal(second.name, "'legacy")
    second.name = 'changed'
    view.onKeydown({key: 'Escape'}, {send() {}})
    view.endTextEdit()
    assert.equal(second.name, 'legacy')
    assert.equal(second.pad.text, 'legacy')
    assert.equal(second.pxlen, 0)
})

test('renaming a cable-connected proxy completes and honors tack selectivity', () => {
    const {view, pins: [pin]} = fixture()
    const source = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'source.mod.blu', getArl: () => null},
        {kind: 'source', name: 'Sender', factory: {path: './node.js', function: 'Node'},
            interfaces: [{interface: '', pins: [{name: 'mesh.declare', kind: 'output'}]}]})
    const output = source.look.widgets.find(widget => widget.is.pin)
    const cable = new Cable({x: 350, y: 0})
    cable.wire = [{x: 350, y: 0}, {x: 350, y: 200}]
    for (const widget of [output, pin]) {
        const route = new Route(widget, null), point = widget.center()
        route.wire = [point, {x: 350, y: point.y}]
        widget.routes.push(route)
        assert.equal(route.connect(cable), true)
    }
    const tack = cable.findTack(pin)
    tack.setSelective(true)
    for (const [text, unused] of [['declare', false], ['updated', true], ['declare', false]]) {
        view.beginTextEdit(pin)
        pin.name = text
        view.onKeydown({key: 'Enter'}, {send() {}})
        assert.equal(pin.name, 'mesh.' + text)
        assert.equal(pin.pad.text, pin.name)
        assert.equal(pin.is.editingName, false)
        assert.equal(view.state.action, doing.nothing)
        assert.equal(tack.route.is.notUsed, unused)
    }
})

test('undo and redo after restarting an edit restore proxy and pad names', () => {
    const {view, pins: [pin]} = fixture()
    let record
    const redox = {saveEdit(verb, param) { if (param) record = param; return record }}
    view.beginTextEdit(pin)
    redoxWidget.widgetTextEdit.doit.call(redox, {view, widget: pin})
    pin.name = 'updated'
    view.onKeydown({key: 'Enter'}, {send() {}})
    for (let i = 0; i < 3; i++) {
        redoxWidget.widgetTextEdit.undo.call(redox, record)
        assert.equal(pin.name, 'mesh.declare')
        assert.equal(pin.pad.text, pin.name)
        redoxWidget.widgetTextEdit.redo.call(redox, record)
        assert.equal(pin.name, 'mesh.updated')
        assert.equal(pin.pad.text, pin.name)
    }
})
