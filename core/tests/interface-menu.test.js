import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {Selection} from '../types/view/selection.js'
import {ifCxMenu} from '../types/view/context-interface.js'
import {redoxPinArea} from '../nodes/model-manager/redox-pin-area.js'

function fixture(kind) {
    const model = {fullPath: () => 'interface-menu.mod.blu', getArl: () => null}
    const raw = {kind, name: 'Node', rect: {x: 0, y: 0, w: 180, h: 0},
        interfaces: [
            {interface: 'items', pins: [{name: 'items.add', kind: 'input'}, {name: 'items.remove', kind: 'output'}]},
            {interface: 'other', pins: [{name: 'other.keep', kind: 'input'}]},
        ]}
    if (kind === 'source') raw.factory = {path: './node.js', function: 'Node'}
    else raw.nodes = []
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
    const heading = node.look.widgets.find(w => w.is.ifName && w.text === 'items')
    const selected = node.look.getInterface(heading)
    const view = {selection: new Selection(), hit: {node, lookWidget: heading, xyLocal: {}, xyScreen: {}}}
    view.selection.interfaceSelect(node, heading)
    let edit
    const history = {saveEdit(verb, data) { edit = {verb, ...data} }}
    const tx = {send(message, {verb, param}) {
        assert.equal(message, 'redox.doit')
        assert.equal(param.view, view)
        assert.equal(param.node, node)
        assert.deepEqual(param.widgets, selected)
        redoxPinArea[verb].doit.call(history, param)
    }}
    ifCxMenu.prepare(view, tx)
    return {node, selected, history, getEdit: () => edit}
}

for (const kind of ['source', 'group']) {
    test(`interface delete undo/redo preserves heading order and layout on a ${kind} node`, () => {
        const {node, selected, history, getEdit} = fixture(kind)
        const layout = () => node.look.widgets.filter(w => w.is.pin || w.is.ifName)
            .sort((a, b) => a.rect.y - b.rect.y)
            .map(w => ({name: w.is.ifName ? w.text : w.name, y: w.rect.y, h: w.rect.h, pxlen: w.pxlen}))
        const original = layout()
        const height = node.look.rect.h
        ifCxMenu.choices.find(choice => choice.text === 'delete').action()
        const deleted = layout()
        const deletedHeight = node.look.rect.h
        const edit = getEdit()
        for (let i = 0; i < 3; i++) {
            redoxPinArea.deletePinArea.undo.call(history, edit)
            assert.deepEqual(layout(), original)
            assert.equal(node.look.rect.h, height)
            assert.deepEqual(node.look.getInterface(selected[0]), selected)
            redoxPinArea.deletePinArea.redo.call(history, edit)
            assert.deepEqual(layout(), deleted)
            assert.equal(node.look.rect.h, deletedHeight)
        }
    })

    test(`interface delete menu supplies the ${kind} node and all interface widgets`, () => {
        const {node, selected, getEdit} = fixture(kind)
        ifCxMenu.choices.find(choice => choice.text === 'delete').action()
        assert.equal(getEdit().verb, 'deletePinArea')
        assert.ok(selected.every(widget => !node.look.widgets.includes(widget)))
        assert.ok(node.look.widgets.some(widget => widget.name === 'other.keep'))
        if (kind === 'group') assert.deepEqual(node.pads.map(pad => pad.proxy.name), ['other.keep'])
        else {
            assert.deepEqual(node.rxTable.map(record => record.pin.name), ['other.keep'])
            assert.equal(node.txTable.length, 0)
        }
    })
}

test('interface disconnect menu passes the complete interface and retains its widgets', () => {
    const {node, selected, getEdit} = fixture('source')
    const disconnected = []
    for (const pin of selected.filter(w => w.is.pin)) pin.disconnect = () => { disconnected.push(pin) }
    ifCxMenu.choices.find(choice => choice.text === 'disconnect').action()
    assert.equal(getEdit().verb, 'disconnectPinArea')
    assert.deepEqual(disconnected, selected.filter(w => w.is.pin))
    assert.ok(selected.every(widget => node.look.widgets.includes(widget)))
})
