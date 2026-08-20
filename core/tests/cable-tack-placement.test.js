import test from 'node:test'
import assert from 'node:assert/strict'

import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'
import {diagonalWireSegments, style} from '../types/util/index.js'

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

test('multiple routes can attach as endpoint tacks at the same cable endpoint', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 80, y: 0}]

    const attach = y => {
        const pin = {is: {pin: true, input: false}, center: () => ({x: 0, y}), routes: []}
        const route = new Route(pin, null)
        route.wire = [{x: 0, y}, {x: 20, y}, {x: 20, y: 0}]
        const tack = cable.addTack(route)
        pin.routes.push(route)
        return tack
    }

    const first = attach(-20)
    const second = attach(20)

    assert.equal(cable.tacks.length, 2)
    assert.equal(first.isEndpoint('start'), true)
    assert.equal(second.isEndpoint('start'), true)
    assert.deepEqual(first.center(), cable.wire[0])
    assert.deepEqual(second.center(), cable.wire[0])
    assert.equal(cable.canCollapseToRoute(), false)

    const endpointProperty = Object.getOwnPropertyDescriptor(first.is, 'endpoint')
    assert.equal(typeof endpointProperty.get, 'function')
    assert.equal(endpointProperty.set, undefined)
})

test('routes approaching a vertical cable endpoint from left, right and below all snap orthogonally', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 20, y: 80}]

    const attach = wire => {
        const pin = {is: {pin: true, input: false}, center: () => ({...wire[0]}), routes: []}
        const route = new Route(pin, null)
        route.wire = wire.map(point => ({...point}))
        const tack = cable.addTack(route)
        pin.routes.push(route)
        return {route, tack}
    }

    const connections = [
        attach([{x: -20, y: 80}, {x: 16, y: 80}]),
        attach([{x: 60, y: 80}, {x: 24, y: 80}]),
        attach([{x: 22, y: 120}, {x: 22, y: 76}])
    ]

    for (const {route, tack} of connections) {
        assert.equal(tack.isEndpoint('end'), true)
        assert.deepEqual(tack.center(), cable.wire.at(-1))
        for (let index = 1; index < route.wire.length; index++) {
            const a = route.wire[index - 1]
            const b = route.wire[index]
            assert.equal(a.x === b.x || a.y === b.y, true)
        }
    }

    assert.equal(connections[2].tack.zone, 'S')
})

test('an endpoint tack is drawn one cable gap away from its endpoint', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 80, y: 0}]
    const pin = {is: {pin: true, input: false}, center: () => ({x: 0, y: 0}), routes: []}
    const tack = cable.newTack()
    const route = new Route(pin, tack)
    route.wire = [{x: 0, y: 0}, {x: 20, y: 0}]
    pin.routes.push(route)
    tack.setRoute(route)
    tack.attachEndpoint('start')

    const drawingRect = tack.drawingRect()

    assert.equal(tack.zone, 'W')
    assert.equal(drawingRect.x, tack.rect.x - style.cable.gap)
    assert.equal(drawingRect.y, tack.rect.y)
    assert.deepEqual(tack.center(), cable.wire[0])
})

for (const tackIsFrom of [true, false]) {
    test(`a duplicate point beside a ${tackIsFrom ? 'from' : 'to'} endpoint tack does not change its horizontal arrow`, () => {
        const routeWire = tackIsFrom
            ? [{x: 20, y: 0}, {x: 20, y: 0}, {x: 0, y: 0}]
            : [{x: 0, y: 0}, {x: 20, y: 0}, {x: 20, y: 0}]
        const {tack} = tackRoute(
            [{x: 20, y: 0}, {x: 80, y: 0}],
            routeWire,
            tackIsFrom
        )

        assert.equal(tack.zone, 'W')
    })
}

for (const tackIsFrom of [true, false]) {
    test(`dragging a vertical endpoint tack reroutes a parallel ${tackIsFrom ? 'from' : 'to'} route orthogonally`, () => {
        const cable = new Cable({x: 0, y: 0})
        cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]
        const pin = {
            is: {pin: true, input: !tackIsFrom, left: false},
            routes: [],
            center: () => ({x: 100, y: 50}),
            rank: () => ({up: 1, down: 1})
        }
        const tack = cable.newTack()
        const route = tackIsFrom ? new Route(tack, pin) : new Route(pin, tack)
        route.wire = tackIsFrom
            ? [{x: 0, y: 0}, {x: 0, y: 50}, {x: 100, y: 50}]
            : [{x: 100, y: 50}, {x: 0, y: 50}, {x: 0, y: 0}]
        pin.routes.push(route)
        tack.setRoute(route)
        tack.attachEndpoint('start')

        tack.slide({x: 0, y: 30})

        assert.equal(tack.isEndpoint(), false)
        assert.deepEqual(tack.center(), {x: 0, y: 30})
        assert.deepEqual(diagonalWireSegments(route.wire), [])

        tack.slide({x: 0, y: -(30 - style.cable.radius)})

        assert.equal(tack.isEndpoint('start'), true)
        assert.deepEqual(tack.center(), cable.wire[0])
        assert.deepEqual(diagonalWireSegments(route.wire), [])
    })
}

test('reversing a cable preserves the physical endpoint attachment identity', () => {
    const {cable, tack} = tackRoute(
        [{x: 20, y: 0}, {x: 80, y: 0}],
        [{x: 0, y: 0}, {x: 20, y: 0}],
        false
    )
    tack.attachEndpoint('start')
    const point = tack.center()

    cable.reverse()

    assert.equal(tack.isEndpoint('end'), true)
    assert.deepEqual(tack.center(), point)
    assert.equal(tack.segment, cable.wire.length - 1)
})

test('an interior attachment owns its contact point independently of its drawing rectangle', () => {
    const {tack} = tackRoute(
        [{x: -100, y: 0}, {x: 100, y: 0}],
        [{x: 0, y: 0}, {x: 50, y: 0}]
    )
    const point = tack.center()

    tack.rect.x += 100
    tack.rect.y += 100

    assert.deepEqual(tack.center(), point)
    assert.deepEqual(tack.copyAttachment(), {kind: 'interior', segment: 1, point})
})

for (const {name, wire, label, inward, outward} of [
    {name: 'downward start', wire: [{x: 0, y: 0}, {x: 0, y: 100}], label: 'start', inward: 1, outward: -1},
    {name: 'downward end', wire: [{x: 0, y: 0}, {x: 0, y: 100}], label: 'end', inward: -1, outward: 1},
    {name: 'upward start', wire: [{x: 0, y: 100}, {x: 0, y: 0}], label: 'start', inward: -1, outward: 1},
    {name: 'upward end', wire: [{x: 0, y: 100}, {x: 0, y: 0}], label: 'end', inward: 1, outward: -1}
]) {
    test(`a small inward drag detaches a ${name} vertical endpoint tack and an outward drag cannot pass the endpoint`, () => {
        const endpointIndex = label === 'start' ? 0 : wire.length - 1
        const endpoint = wire[endpointIndex]
        const cable = new Cable(wire[0])
        cable.wire = wire.map(point => ({...point}))
        const pin = {
            is: {pin: true, input: false},
            center: () => ({x: 100, y: endpoint.y}),
            routes: []
        }
        const tack = cable.newTack()
        const route = new Route(pin, tack)
        route.wire = [pin.center(), {...endpoint}]
        pin.routes.push(route)
        tack.setRoute(route)
        tack.attachEndpoint(label)

        tack.slide({x: 0, y: inward})

        assert.equal(tack.isEndpoint(), false)
        assert.equal(Math.abs(tack.center().y - endpoint.y), style.cable.radius)
        assert.deepEqual(diagonalWireSegments(route.wire), [])

        route.wire = [pin.center(), {...endpoint}]
        tack.attachEndpoint(label)
        tack.slide({x: 0, y: outward})

        assert.equal(tack.isEndpoint(label), true)
        assert.deepEqual(tack.center(), endpoint)
        assert.deepEqual(diagonalWireSegments(route.wire), [])
    })
}

test('a collinear horizontal endpoint route remains attached instead of sliding behind the endpoint', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 80, y: 0}]
    const pin = {is: {pin: true, input: false}, center: () => ({x: 0, y: 0}), routes: []}
    const tack = cable.newTack()
    const route = new Route(pin, tack)
    route.wire = [pin.center(), {...cable.wire[0]}]
    pin.routes.push(route)
    tack.setRoute(route)
    tack.attachEndpoint('start')
    const oldWire = route.copyWire()

    tack.slide({x: 20, y: 0})

    assert.equal(tack.isEndpoint('start'), true)
    assert.deepEqual(tack.center(), cable.wire[0])
    assert.deepEqual(route.wire, oldWire)
})

test('a vertically approaching route can slide away from a horizontal cable endpoint', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 80, y: 0}]
    const pin = {is: {pin: true, input: false}, center: () => ({x: 0, y: -30}), routes: []}
    const tack = cable.newTack()
    const route = new Route(pin, tack)
    route.wire = [pin.center(), {x: 20, y: -30}, {...cable.wire[0]}]
    pin.routes.push(route)
    tack.setRoute(route)
    tack.attachEndpoint('start')

    tack.slide({x: 10, y: 0})

    assert.equal(tack.isEndpoint(), false)
    assert.deepEqual(tack.center(), {x: 30, y: 0})
    assert.deepEqual(diagonalWireSegments(route.wire), [])
})

for (const {name, wire, tackPoint, next, expectedEnd} of [
    {
        name: 'rightward horizontal',
        wire: [{x: 0, y: 0}, {x: 80, y: 0}, {x: 80, y: 50}, {x: 100, y: 50}],
        tackPoint: {x: 90, y: 50},
        next: {x: 85, y: 50},
        expectedEnd: {x: 90 + style.cable.gap, y: 50}
    },
    {
        name: 'leftward horizontal',
        wire: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 50}, {x: 80, y: 50}],
        tackPoint: {x: 90, y: 50},
        next: {x: 95, y: 50},
        expectedEnd: {x: 90 - style.cable.gap, y: 50}
    },
    {
        name: 'downward vertical',
        wire: [{x: 0, y: 0}, {x: 0, y: 80}, {x: 50, y: 80}, {x: 50, y: 100}],
        tackPoint: {x: 50, y: 90},
        next: {x: 50, y: 85},
        expectedEnd: {x: 50, y: 90 + style.cable.gap}
    },
    {
        name: 'upward vertical',
        wire: [{x: 0, y: 0}, {x: 0, y: 100}, {x: 50, y: 100}, {x: 50, y: 80}],
        tackPoint: {x: 50, y: 90},
        next: {x: 50, y: 95},
        expectedEnd: {x: 50, y: 90 - style.cable.gap}
    }
]) {
    test(`a ${name} cable endpoint cannot cross a tack on its terminal segment`, () => {
        const cable = new Cable(wire[0])
        cable.wire = wire.map(point => ({...point}))
        const pin = {
            is: {pin: true, input: true},
            center: () => ({x: tackPoint.x + 40, y: tackPoint.y + 40}),
            routes: []
        }
        const tack = cable.newTack()
        const route = new Route(tack, pin)
        route.wire = [{...tackPoint}, pin.center()]
        tack.setRoute(route)

        cable.drawXY({...next})

        assert.deepEqual(cable.wire.at(-1), expectedEnd)
        assert.equal(cable.wire.length, wire.length)
        assert.deepEqual(tack.center(), tackPoint)
    })
}
