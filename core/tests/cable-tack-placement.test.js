import test from 'node:test'
import assert from 'node:assert/strict'

import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'

function tackRoute(cableWire, routeWire, tackIsFrom = true) {
    const cable = new Cable(cableWire[0])
    cable.wire = cableWire.map(point => ({...point}))

    const tack = cable.newTack()
    const pin = {is: {pin: true, input: true}}
    const route = tackIsFrom ? new Route(tack, pin) : new Route(pin, tack)
    route.wire = routeWire.map(point => ({...point}))
    tack.setRoute(route)

    return {cable, route, tack}
}

for (const {fromZone, toZone, adjacentY, dragY} of [
    {fromZone: 'S', toZone: 'N', adjacentY: 40, dragY: 80},
    {fromZone: 'N', toZone: 'S', adjacentY: -40, dragY: -80}
]) {
    test(`dragging a cable refreshes the tack zone from ${fromZone} to ${toZone}`, () => {
        const {cable, tack} = tackRoute(
            [{x: -100, y: 0}, {x: 100, y: 0}],
            [{x: 0, y: 0}, {x: 0, y: adjacentY}, {x: 100, y: adjacentY}]
        )

        assert.equal(tack.zone, fromZone)

        cable.drag({x: 0, y: dragY})

        assert.equal(tack.zone, toZone)
        assert.deepEqual(tack.center(), {x: 0, y: dragY})
    })
}

for (const tackIsFrom of [true, false]) {
    for (const {fromZone, toZone, adjacentX, dragX} of [
        {fromZone: 'E', toZone: 'W', adjacentX: 50, dragX: -100},
        {fromZone: 'W', toZone: 'E', adjacentX: -50, dragX: 100}
    ]) {
        test(`dragging a route segment refreshes the ${tackIsFrom ? 'from' : 'to'} tack from ${fromZone} to ${toZone}`, () => {
            const routeWire = tackIsFrom
                ? [{x: 0, y: 0}, {x: adjacentX, y: 0}, {x: adjacentX, y: 50}, {x: 100, y: 50}]
                : [{x: 100, y: 50}, {x: adjacentX, y: 50}, {x: adjacentX, y: 0}, {x: 0, y: 0}]
            const {route, tack} = tackRoute(
                [{x: -100, y: 0}, {x: 100, y: 0}],
                routeWire,
                tackIsFrom
            )

            assert.equal(tack.zone, fromZone)

            route.moveSegment(2, {x: dragX, y: 0})

            assert.equal(tack.zone, toZone)
            assert.deepEqual(tack.center(), {x: 0, y: 0})
        })
    }
}

test('placing a tack invalidates its cached alias rectangle', () => {
    const {tack} = tackRoute(
        [{x: -100, y: 0}, {x: 100, y: 0}],
        [{x: 0, y: 0}, {x: 50, y: 0}]
    )
    tack.rcAlias = {x: 1, y: 2, w: 3, h: 4}

    tack.placeOnSegment({x: 10, y: 0}, 1)

    assert.equal(tack.rcAlias, null)
})
