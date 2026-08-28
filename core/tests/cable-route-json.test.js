import test from 'node:test'
import assert from 'node:assert/strict'

import {convert} from '../types/util/convert.js'
import {Bus} from '../types/node/bus.js'
import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'
import {jsonHandling} from '../types/node/node-group-json.js'
import {diagonalWireSegments} from '../types/util/wire-geometry.js'

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
    assert.equal(bus.shouldRenderEndpoint(bus.wire[0]), true)
    assert.equal(bus.defaultTackSelectivity({is: {pin: true, input: true}}), false)

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

test('cable cook merges consecutive collinear endpoint segments', () => {
    const cable = new Cable()

    cable.cook({
        start: 'x 186 y 195.5',
        wire: 'y 0.5 y 252.0 x 62.0'
    })

    assert.deepEqual(cable.wire, [
        {x: 186, y: 195.5},
        {x: 186, y: 448},
        {x: 248, y: 448}
    ])
})

test('cables can bridge other distinct cables regardless of legacy floating marker', () => {
    const first = new Cable({x: 0, y: 0})
    const second = new Cable({x: 100, y: 0})
    const legacy = new Cable({x: 200, y: 0}, null, true)
    const tack = first.newTack()
    const route = new Route(tack, null)

    assert.equal(route.checkConxType(tack, first), false)
    assert.equal(route.checkConxType(tack, second), true)
    assert.equal(route.checkConxType(tack, legacy), true)
})

for (const {name, pinCenter, cableWire, routeWire, endpoint, approach} of [
    {
        name: 'a rounded vertical terminal segment',
        pinCenter: {x: 964, y: 210.5},
        cableWire: [
            {x: 1029.2273218752528, y: 370.45308104037156},
            {x: 1029.2273218752528, y: 1288.4530810403717}
        ],
        routeWire: 'y -1.2 x 65.2 y 161.2',
        endpoint: 'start',
        approach: 'N'
    },
    {
        name: 'a stale horizontal terminal segment',
        pinCenter: {x: 1357, y: 1611.5},
        cableWire: [
            {x: 1389.8665749183394, y: 479.45366858830215},
            {x: 1389.8665749183394, y: 750.2536685883022}
        ],
        routeWire: 'x 137.0 y -891.2 x -103.1',
        endpoint: 'end',
        approach: 'E'
    }
]) {
    test(`loading ${name} preserves its approach and repairs the endpoint geometry`, () => {
        const cable = new Cable(cableWire[0])
        cable.wire = cableWire.map(point => ({...point}))
        const pin = {
            is: {pin: true, input: false},
            center: () => ({...pinCenter}),
            routes: []
        }
        const group = {
            nodes: [],
            getEndPoints: () => [pin, cable]
        }

        const route = jsonHandling.cookRoute.call(group, {
            from: '(pin 1) output @ source',
            to: '(cable 0 endpoint nonselective)',
            wire: routeWire
        })
        const tack = route.to

        assert.equal(tack.endpointApproach(), approach)
        assert.equal(tack.aliasZone(), approach)
        assert.equal(tack.endpointLabel(), endpoint)
        assert.deepEqual(tack.getContactPoint(), endpoint === 'start' ? cable.wire[0] : cable.wire.at(-1))
        assert.deepEqual(diagonalWireSegments(route.wire), [])
    })
}
