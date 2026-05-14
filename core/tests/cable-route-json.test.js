import test from 'node:test'
import assert from 'node:assert/strict'

import {convert} from '../types/util/convert.js'

test('unnamed cable route endpoint keeps cable property, index and flags after raw parsing', () => {
    const source = convert.rawToEndPoint('(cable 2 endpoint bridge)')
    const target = convert.rawToEndPoint('(pin 15) sim.tick @ Rendering')

    assert.deepEqual(source, {cable: true, index: 2, endpoint: true, bridge: true})
    assert.deepEqual(target, {pin: 'sim.tick', wid: 15, node: 'Rendering'})
    assert.equal(Object.hasOwn(source, 'cable'), true)
})
