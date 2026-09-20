import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {Selection, selex} from '../types/view/selection.js'
import {selectionHandling} from '../types/view/view-select.js'
import {redoxPinArea} from '../nodes/model-manager/redox-pin-area.js'
import {Clipboard} from '../nodes/clipboard/clipboard.js'
import {ctrlKeyTable} from '../types/view/view-keytable.js'
import {pinCxMenu} from '../types/view/context-pin.js'
import {ifCxMenu} from '../types/view/context-interface.js'
import {pinAreaCxMenu} from '../types/view/context-pin-area.js'
import {zap} from '../types/view/mouse.js'

const model = {fullPath: () => 'paste.mod.blu', getArl: () => null, header: {copyWithoutStyle: () => ({})}}
const pin = name => ({name, kind: 'input', left: true})
const operation = redoxPinArea.pasteWidgetsFromClipboard

function fixture(kind = 'source', interfaces = [
    {interface: '', pins: [pin('loose')]},
    {interface: 'target', pins: [pin('target.first'), pin('target.last')]},
    {interface: 'next', pins: [pin('next.run')]},
]) {
    const raw = {kind, name: 'Destination', rect: {x: 0, y: 0, w: 180, h: 0}, interfaces}
    if (kind === 'source') raw.factory = {path: './node.js', function: 'Destination'}
    else raw.nodes = []
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
    const view = {...selectionHandling, selection: new Selection(), blinkToWarn() { throw Error('read only') }}
    view.selection.singleNode(node)
    const manager = {saveEdit(verb, data) { this.record = data }}
    return {node, view, manager}
}

function widgets(node) {
    return node.look.widgets.filter(w => w.is.pin || w.is.ifName).sort((a,b) => a.rect.y - b.rect.y)
}
function labels(node) { return widgets(node).map(w => w.is.pin ? w.name : '[' + w.text + ']') }
function target(node, label) { return widgets(node).find(w => w.name === label || w.text === label) }
function paste(f, raw, label) {
    operation.doit.call(f.manager, {view: f.view, raw, target: {node: f.node, widget: target(f.node, label)}})
    return f.manager.record
}
const whole = {what: selex.ifArea, widgets: [{interface: 'source'}, {...pin('source.add'), pxlen: 6}, {...pin('source.remove'), pxlen: 6}]}
const partial = {what: selex.pinArea, widgets: [{...pin('source.add'), pxlen: 6}]}

test('whole interfaces paste after the clicked interface or containing interface', () => {
    for (const clicked of ['target', 'target.first', 'target.last']) {
        const f = fixture()
        paste(f, structuredClone(whole), clicked)
        assert.deepEqual(labels(f.node), ['loose', '[target]', 'target.first', 'target.last', '[source]', 'source.add', 'source.remove', '[next]', 'next.run'])
        assert.equal(f.view.selection.what, selex.ifArea)
        assert.equal(f.view.selection.widgets.length, 3)
        assert.ok(f.view.selection.widgets.every(w => w.is.selected))
        assert.ok(f.view.selection.rect.h >= f.view.selection.widgets.reduce((sum,w) => sum + w.rect.h, 0))
    }
})

test('whole interfaces follow unnamed pins before the next heading or at the end', () => {
    const f = fixture()
    paste(f, structuredClone(whole), 'loose')
    assert.deepEqual(labels(f.node).slice(0, 5), ['loose', '[source]', 'source.add', 'source.remove', '[target]'])
    const unnamed = fixture('source', [{interface: '', pins: [pin('one'), pin('two')]}])
    paste(unnamed, structuredClone(whole), 'one')
    assert.deepEqual(labels(unnamed.node), ['one', 'two', '[source]', 'source.add', 'source.remove'])
})

test('partial pins paste at the interface end or directly after the clicked pin', () => {
    for (const clicked of ['target', 'target.first']) {
        const f = fixture()
        paste(f, structuredClone(partial), clicked)
        assert.deepEqual(labels(f.node), clicked === 'target'
            ? ['loose', '[target]', 'target.first', 'target.last', 'target.add', '[next]', 'next.run']
            : ['loose', '[target]', 'target.first', 'target.add', 'target.last', '[next]', 'next.run'])
        assert.equal(f.view.selection.widgets[0].pxlen, 6)
        assert.equal(f.view.selection.widgets[0].displayName(false), 'add')
    }
})

test('absolute pins stay literal, suffixes requalify, metadata survives and outside names remain full', () => {
    const raw = {what: selex.pinArea, widgets: [
        {...pin('absolute'), pxlen: 0},
        {...pin('add/source'), pxlen: -6, prompt: 'Handle add', contract: {role: 'owner', payload: {request: 'string', reply: 'number'}}, tool: {enabled: true}},
    ]}
    const f = fixture()
    paste(f, raw, 'target')
    const [absolute, qualified] = f.view.selection.widgets
    assert.equal(absolute.name, 'absolute')
    assert.equal(absolute.pxlen, 0)
    assert.equal(qualified.name, 'target.add')
    assert.equal(qualified.prompt, 'Handle add')
    assert.deepEqual(qualified.contract.payload, raw.widgets[1].contract.payload)
    assert.notEqual(qualified.contract.payload, raw.widgets[1].contract.payload)
    assert.equal(qualified.is.capability, true)
    assert.equal(raw.widgets[1].name, 'add/source')
    const outside = fixture()
    paste(outside, structuredClone(partial), 'loose')
    assert.equal(outside.view.selection.widgets[0].name, 'source.add')
    assert.equal(outside.view.selection.widgets[0].pxlen, 0)
})

test('duplicates are inserted and flagged, including handler collisions; undo/redo restores layout and IDs', () => {
    const f = fixture()
    const before = widgets(f.node).map(w => ({widget: w, y: w.rect.y}))
    const height = f.node.look.rect.h
    const raw = {what: selex.pinArea, widgets: [{...pin('source.first'), pxlen: 6}, {...pin('target-first'), pxlen: 0}]}
    const record = paste(f, raw, 'target')
    assert.equal(record.widgets.length, 2)
    assert.ok(record.widgets.every(w => w.is.duplicate))
    assert.equal(target(f.node, 'target.first').is.duplicate, true)
    const after = widgets(f.node).map(w => ({widget: w, y: w.rect.y, wid: w.wid}))
    assert.equal(new Set(widgets(f.node).map(w => w.wid)).size, widgets(f.node).length)
    for (let i = 0; i < 2; i++) {
        operation.undo.call(f.manager, record)
        assert.equal(f.node.look.rect.h, height)
        assert.deepEqual(widgets(f.node).map(w => ({widget:w,y:w.rect.y})), before)
        assert.equal(target(f.node, 'target.first').is.duplicate, false)
        operation.redo.call(f.manager, record)
        assert.deepEqual(widgets(f.node).map(w => ({widget:w,y:w.rect.y,wid:w.wid})), after)
        assert.ok(record.widgets.every(w => w.is.duplicate))
    }
})

test('whole-interface repeated paste retains headings and group pads across undo/redo', () => {
    const f = fixture('group')
    paste(f, structuredClone(whole), 'target')
    const record = paste(f, structuredClone(whole), 'source')
    assert.equal(widgets(f.node).filter(w => w.is.ifName && w.text === 'source').length, 2)
    assert.ok(record.widgets.filter(w => w.is.pin).every(w => w.is.duplicate))
    const pads = f.node.pads.slice()
    const positions = widgets(f.node).map(w => w.rect.y)
    for (let i=0; i<2; i++) {
        operation.undo.call(f.manager, record)
        operation.redo.call(f.manager, record)
        assert.deepEqual(f.node.pads, pads)
        assert.deepEqual(widgets(f.node).map(w => w.rect.y), positions)
        assert.equal(f.view.selection.what, selex.ifArea)
    }
})

test('copying a single pin snapshots qualification without copying the node', () => {
    const f = fixture()
    const original = target(f.node, 'target.first')
    f.view.selection.singleNodeAndWidget(f.node, original)
    const clipboard = new Clipboard({send() {}}, {})
    clipboard.onSet({model, selection: f.view.selection})
    original.name = 'changed'
    const raw = JSON.parse(clipboard.json)
    assert.equal(raw.what, selex.pinArea)
    assert.equal(raw.root, null)
    assert.equal(raw.widgets[0].name, 'target.first')
    assert.equal(raw.widgets[0].pxlen, 6)
})

test('Ctrl+V dispatches pin content to the pin paste command', async () => {
    const calls = []
    const view = {doEdit(tx, verb, args) { calls.push({verb, args}) }}
    ctrlKeyTable.v(view, {request: async () => ({raw: partial})})
    await Promise.resolve()
    assert.equal(calls[0].verb, 'pasteWidgetsFromClipboard')
})

test('copying a complete interface retains its heading and every pin in order', () => {
    const f = fixture()
    f.view.selection.interfaceSelect(f.node, target(f.node, 'target'))
    const clipboard = new Clipboard({send() {}}, {})
    clipboard.onSet({model, selection: f.view.selection})
    const raw = JSON.parse(clipboard.json)
    assert.equal(raw.what, selex.ifArea)
    assert.deepEqual(raw.widgets.map(w => w.interface ?? w.name), ['target', 'target.first', 'target.last'])
    const destination = fixture()
    paste(destination, raw, 'next')
    assert.deepEqual(labels(destination.node).slice(-3), ['[target]', 'target.first', 'target.last'])
})

test('right-click paste uses the clicked pin even when a different pin is selected', async () => {
    const f = fixture()
    f.view.selection.singleNodeAndWidget(f.node, target(f.node, 'next.run'))
    const clicked = target(f.node, 'target.first')
    f.view.hit = {node: f.node, lookWidget: clicked, xyLocal: {x: 0, y: clicked.rect.y + 1}, xyScreen: {x:0,y:0}}
    f.view.doEdit = (tx, verb, args) => operation.doit.call(f.manager, args)
    pinCxMenu.prepare(f.view, {request: async () => ({raw: partial})})
    pinCxMenu.choices.find(choice => choice.text === 'paste').action()
    await Promise.resolve()
    assert.deepEqual(labels(f.node).slice(1, 5), ['[target]', 'target.first', 'target.add', 'target.last'])
})

test('right-click inside a selected interface resolves the actual clicked member', async () => {
    const f = fixture()
    const heading = target(f.node, 'target')
    const clicked = target(f.node, 'target.first')
    f.view.selection.interfaceSelect(f.node, heading)
    f.view.hit = {what: zap.selection, node: f.node, lookWidget: heading,
        xyLocal: {x: 0, y: clicked.rect.y + 1}, xyScreen: {x:0,y:0}}
    f.view.doEdit = (tx, verb, args) => operation.doit.call(f.manager, args)
    ifCxMenu.prepare(f.view, {request: async () => ({raw: partial})})
    ifCxMenu.choices.find(choice => choice.text === 'paste').action()
    await Promise.resolve()
    assert.deepEqual(labels(f.node).slice(1, 5), ['[target]', 'target.first', 'target.add', 'target.last'])
})

test('keyboard paste after a partial selection uses its last pin as the insertion point', () => {
    const f = fixture()
    f.view.selection.pinAreaSelect([target(f.node, 'target.first'), target(f.node, 'target.last')])
    operation.doit.call(f.manager, {view: f.view, raw: partial})
    assert.deepEqual(labels(f.node).slice(1, 6), ['[target]', 'target.first', 'target.last', 'target.add', '[next]'])
})

test('the pin-area menu can paste after the clicked member of a partial selection', async () => {
    const f = fixture()
    const clicked = target(f.node, 'target.first')
    f.view.selection.pinAreaSelect([clicked, target(f.node, 'target.last')])
    f.view.hit = {xyLocal: {x: 0, y: clicked.rect.y + 1}, xyScreen: {x:0,y:0}}
    f.view.doEdit = (tx, verb, args) => operation.doit.call(f.manager, args)
    pinAreaCxMenu.prepare(f.view, {request: async () => ({raw: partial})})
    pinAreaCxMenu.choices.find(choice => choice.text === 'paste').action()
    await Promise.resolve()
    assert.deepEqual(labels(f.node).slice(1, 5), ['[target]', 'target.first', 'target.add', 'target.last'])
})
