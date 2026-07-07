import test from 'node:test'
import assert from 'node:assert/strict'

import {convert} from '../types/util/convert.js'
import {Bus} from '../types/node/bus.js'
import {Cable} from '../types/node/cable.js'

test('unnamed cable route endpoint keeps cable property, index and flags after raw parsing', () => {
    const source = convert.rawToEndPoint('(cable 2 endpoint bridge)')
    const target = convert.rawToEndPoint('(pin 15) sim.tick @ Rendering')

    assert.deepEqual(source, {cable: true, index: 2, endpoint: true, bridge: true})
    assert.deepEqual(target, {pin: 'sim.tick', wid: 15, node: 'Rendering'})
    assert.equal(Object.hasOwn(source, 'cable'), true)
})

test('bus raw no longer writes name and legacy route names still parse', () => {
    const bus = new Bus({x: 10, y: 20})
    bus.wire[1] = {x: 40, y: 20}

    assert.deepEqual(bus.makeRaw(), {start: 'x 10 y 20', wire: 'x 30.0', floating: true})

    assert.deepEqual(
        convert.rawToEndPoint('(bus selective) clock @ legacy.cable'),
        {bus: 'legacy.cable', alias: 'clock', selective: true}
    )

    assert.deepEqual(
        convert.rawToEndPoint('(cable 2 nonselective) clock'),
        {cable: true, index: 2, endpoint: false, bridge: false, alias: 'clock', selective: false}
    )
})

test('cable cook keeps a segment when saved wire is empty', () => {
    const cable = new Cable()

    cable.cook({
        start: 'x 2180 y 284.5',
        wire: ''
    })

    assert.deepEqual(cable.wire, [
        {x: 2180, y: 284.5},
        {x: 2180, y: 284.5}
    ])
    assert.notEqual(cable.wire[0], cable.wire[1])
})
