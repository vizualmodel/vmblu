import test from 'node:test'
import assert from 'node:assert/strict'
import {Selection, selex} from '../types/view/selection.js'
import {justKeyTable} from '../types/view/view-keytable.js'
import {interfaceHandling} from '../types/node/look-interface.js'
import {Pin} from '../types/widget/widget-pin.js'
import {InterfaceName} from '../types/widget/widget-interface-name.js'

test('arrow navigation selects whole interfaces and clears them when selecting a pin', () => {
    const node = {
        is: {selected: false},
        doSelect() { this.is.selected = true },
        unSelect() { this.is.selected = false },
    }
    node.look = {...interfaceHandling, rect: {x: 0, y: 0, w: 100, h: 150}, widgets: []}
    const rect = y => ({x: 0, y, w: 100, h: 20})
    const heading = new InterfaceName(rect(20), 'items', node)
    const first = new Pin(rect(40), node, 'items.add', {input: true})
    const second = new Pin(rect(60), node, 'items.remove', {input: true})
    const nextHeading = new InterfaceName(rect(80), 'commands', node)
    const last = new Pin(rect(100), node, 'commands.run', {input: true})
    const widgets = [heading, first, second, nextHeading, last]
    node.look.widgets = widgets
    const selection = new Selection()
    const view = {selection}
    selection.singleNodeAndWidget(node, first)

    function check(key, current, selected, type) {
        justKeyTable[key](view)
        assert.equal(selection.getSelectedWidget(), current)
        assert.equal(selection.what, type)
        assert.deepEqual(selection.widgets, selected)
        assert.deepEqual(widgets.filter(widget => widget.is.selected), selected)
        assert.equal(node.is.selected, type === selex.singleNode)
        assert.deepEqual(selection.nodes, type === selex.singleNode ? [node] : [])
    }

    check('ArrowUp', heading, [heading, first, second], selex.ifArea)
    assert.equal(selection.rect.y, heading.rect.y)
    assert.equal(selection.rect.h, second.rect.y + second.rect.h - heading.rect.y)
    check('ArrowUp', heading, [heading, first, second], selex.ifArea)
    check('ArrowDown', first, [first], selex.singleNode)
    check('ArrowDown', second, [second], selex.singleNode)
    check('ArrowDown', nextHeading, [nextHeading, last], selex.ifArea)
    check('ArrowDown', last, [last], selex.singleNode)
    check('ArrowDown', last, [last], selex.singleNode)
    check('ArrowUp', nextHeading, [nextHeading, last], selex.ifArea)
    check('ArrowUp', second, [second], selex.singleNode)

    selection.switchToWidget(undefined)
    assert.equal(selection.getSelectedWidget(), second)
    assert.deepEqual(selection.widgets, [second])
})
