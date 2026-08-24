import test from 'node:test'
import assert from 'node:assert/strict'

import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'
import {diagonalWireSegments, style} from '../types/util/index.js'
import {redoxCable} from '../nodes/model-manager/redox-cable.js'

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

function assertCableAttachmentInvariants(cable) {
    assert.deepEqual(diagonalWireSegments(cable.wire), [])
    for (const tack of cable.tacks) {
        if (!tack.route?.from || !tack.route?.to) continue
        assert.deepEqual(tack.getContactPoint(), tack.center())
        assert.deepEqual(diagonalWireSegments(tack.route.wire), [])
    }
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

test('bending an endpoint realigns every route sharing that endpoint', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 100, y: 0}]
    const makeRoute = (pinCenter, wire) => {
        const pin = {is: {pin: true, input: true}, center: () => ({...pinCenter}), routes: []}
        const tack = cable.newTack()
        const route = new Route(tack, pin)
        route.wire = wire.map(point => ({...point}))
        tack.setRoute(route)
        tack.attachEndpoint('start', 'N')
        return {pin, tack, route}
    }
    const movingCenter = {x: 0, y: 0}
    const moving = makeRoute(movingCenter, [{x: 0, y: 0}, {x: 0, y: 0}])
    makeRoute({x: -40, y: -80}, [{x: 0, y: 0}, {x: 0, y: -80}, {x: -40, y: -80}])

    movingCenter.x = 20
    movingCenter.y = 50
    moving.route.adjust()

    assertCableAttachmentInvariants(cable)
})

test('connecting a widget at an occupied endpoint realigns its existing routes', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 100, y: 0}]
    const existingPin = {is: {pin: true, input: false}, center: () => ({x: 60, y: -80}), routes: []}
    const existingTack = cable.newTack()
    const existingRoute = new Route(existingTack, existingPin)
    existingRoute.wire = [{x: 100, y: 0}, {x: 100, y: -80}, existingPin.center()]
    existingTack.setRoute(existingRoute)
    existingTack.attachEndpoint('end', 'N')

    const newPin = {is: {pin: true, input: true}, center: () => ({x: 130, y: 30}), routes: []}
    assert.ok(cable.connectEndpoint(newPin))

    assertCableAttachmentInvariants(cable)
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

test('an inward drag slides a collinear horizontal endpoint route onto the cable', () => {
    const cable = new Cable({x: 20, y: 0})
    cable.wire = [{x: 20, y: 0}, {x: 80, y: 0}]
    const pin = {is: {pin: true, input: false}, center: () => ({x: 0, y: 0}), routes: []}
    const tack = cable.newTack()
    const route = new Route(pin, tack)
    route.wire = [pin.center(), {...cable.wire[0]}]
    pin.routes.push(route)
    tack.setRoute(route)
    tack.attachEndpoint('start')
    tack.slide({x: 20, y: 0})

    assert.equal(tack.isEndpoint(), false)
    assert.deepEqual(tack.center(), {x: 40, y: 0})
    assert.deepEqual(diagonalWireSegments(route.wire), [])
})

for (const {description, cableWire, label, routeWire, zones} of [
    {
        description: 'horizontal cable start',
        cableWire: [{x: 0, y: 0}, {x: 100, y: 0}],
        label: 'start',
        routeWire: [{x: 0, y: 0}, {x: 30, y: 0}, {x: 30, y: 60}, {x: 100, y: 60}],
        zones: [{zone: 'N', delta: {x: 0, y: -20}}, {zone: 'W', delta: {x: -20, y: 0}}, {zone: 'S', delta: {x: 0, y: 20}}]
    },
    {
        description: 'vertical cable end',
        cableWire: [{x: 0, y: 0}, {x: 0, y: 100}],
        label: 'end',
        routeWire: [{x: 0, y: 100}, {x: 30, y: 100}, {x: 30, y: 160}, {x: 100, y: 160}],
        zones: [{zone: 'E', delta: {x: 20, y: 0}}, {zone: 'S', delta: {x: 0, y: 20}}, {zone: 'W', delta: {x: -20, y: 0}}]
    }
]) {
    for (const {zone, delta} of zones) {
        test(`directly dragging a ${description} tack into zone ${zone} changes its endpoint approach`, () => {
            const cable = new Cable(cableWire[0])
            cable.wire = cableWire.map(point => ({...point}))
            const pin = {is: {pin: true, input: true}, center: () => ({...routeWire.at(-1)}), routes: []}
            const tack = cable.newTack()
            const route = new Route(tack, pin)
            route.wire = routeWire.map(point => ({...point}))
            tack.setRoute(route)
            tack.attachEndpoint(label)
            const oldCableWire = cable.copyWire()

            tack.beginSlide()
            tack.slide(delta)

            assert.equal(tack.endSlide(), 'orientation')
            assert.equal(tack.isEndpoint(label), true)
            assert.equal(tack.endpointApproach(), zone)
            assert.equal(tack.aliasZone(), zone)
            assert.equal(tack.zone, zone)
            assert.deepEqual(cable.wire, oldCableWire)
            assert.deepEqual(diagonalWireSegments(route.wire), [])
            assert.equal(tack.copyAttachment().approach, zone)

            const orientedWire = route.copyWire()
            tack.refreshPlacement()
            tack.refreshPlacement()
            assert.deepEqual(route.wire, orientedWire)
        })
    }
}

test('a direct inward endpoint-tack drag selects sliding rather than orientation', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 100, y: 0}]
    const pin = {is: {pin: true, input: true}, center: () => ({x: -100, y: 0}), routes: []}
    const tack = cable.newTack()
    const route = new Route(tack, pin)
    route.wire = [{x: 0, y: 0}, pin.center()]
    tack.setRoute(route)
    tack.attachEndpoint('start')

    tack.beginSlide()
    tack.slide({x: 20, y: 0})

    assert.equal(tack.endSlide(), 'slide')
    assert.equal(tack.isEndpoint(), false)
    assert.deepEqual(tack.center(), {x: 20, y: 0})
    assert.deepEqual(diagonalWireSegments(route.wire), [])
})

test('endpoint approach changes survive attachment undo and redo', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 100, y: 0}]
    const pin = {is: {pin: true, input: true}, center: () => ({x: -100, y: 60}), routes: []}
    const tack = cable.newTack()
    const route = new Route(tack, pin)
    route.wire = [{x: 0, y: 0}, {x: -30, y: 0}, {x: -30, y: 60}, pin.center()]
    tack.setRoute(route)
    tack.attachEndpoint('start')
    const oldCableWire = cable.copyWire()
    const oldCableTackWires = cable.copyTackWires()

    tack.beginSlide()
    tack.slide({x: 0, y: -20})
    tack.endSlide()
    const newCableWire = cable.copyWire()
    const newCableTackWires = cable.copyTackWires()

    redoxCable.tackDrag.undo({tack, oldCableWire, oldCableTackWires})
    assert.equal(tack.endpointApproach(), 'W')
    assert.equal(tack.aliasZone(), 'W')

    redoxCable.tackDrag.redo({tack, newCableWire, newCableTackWires})
    assert.equal(tack.endpointApproach(), 'N')
    assert.equal(tack.aliasZone(), 'N')
    assert.deepEqual(diagonalWireSegments(route.wire), [])
})

test('a selected endpoint approach survives later cable-endpoint and pin movement', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]
    const pinCenter = {x: 100, y: 160}
    const pin = {is: {pin: true, input: true}, center: () => ({...pinCenter}), routes: []}
    const tack = cable.newTack()
    const route = new Route(tack, pin)
    route.wire = [{x: 0, y: 100}, {x: 30, y: 100}, {x: 30, y: 160}, pin.center()]
    tack.setRoute(route)
    tack.attachEndpoint('end')
    tack.beginSlide()
    tack.slide({x: -20, y: 0})
    tack.endSlide()

    cable.resumeDrawXY('end', {x: 0, y: 120}, {x: 0, y: 20})
    pinCenter.x += 30
    pinCenter.y += 20
    route.adjust({moveCableEndpoint: false})

    assert.equal(tack.endpointApproach(), 'W')
    assert.equal(tack.aliasZone(), 'W')
    assert.deepEqual(tack.center(), cable.wire.at(-1))
    assert.deepEqual(diagonalWireSegments(route.wire), [])
})

for (const tackIsFrom of [true, false]) {
    for (const approach of ['N', 'S']) {
        test(`repeated endpoint movement keeps a vertical ${approach} ${tackIsFrom ? 'from' : 'to'} route stable`, () => {
            const cable = new Cable({x: 0, y: 0})
            cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]
            const pinCenter = {x: 100, y: 180}
            const pin = {is: {pin: true, input: true}, center: () => ({...pinCenter}), routes: []}
            const tack = cable.newTack()
            const tackWire = [{x: 0, y: 100}, {x: 30, y: 100}, {x: 30, y: 180}, {...pinCenter}]
            const route = tackIsFrom ? new Route(tack, pin) : new Route(pin, tack)
            route.wire = tackIsFrom ? tackWire : tackWire.slice().reverse()
            tack.setRoute(route)
            tack.attachEndpoint('end')
            tack.setEndpointApproach(approach)
            const maximumPoints = route.wire.length

            for (let step = 1; step <= 8; step++) {
                cable.resumeDrawXY('end', {x: 0, y: 100 + step * 5}, {x: 0, y: 5})

                assert.equal(tack.aliasZone(), approach)
                assert.deepEqual(diagonalWireSegments(route.wire), [])
                assert.ok(route.wire.length <= maximumPoints)
            }
        })
    }
}

test('a short vertical endpoint route gains one stable dogleg when its endpoint crosses the bend', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]
    const pin = {is: {pin: true, input: true}, center: () => ({x: 100, y: 120}), routes: []}
    const tack = cable.newTack()
    const route = new Route(tack, pin)
    route.wire = [{x: 0, y: 100}, {x: 0, y: 120}, pin.center()]
    tack.setRoute(route)
    tack.attachEndpoint('end', 'S')

    for (let step = 1; step <= 8; step++) {
        cable.resumeDrawXY('end', {x: 0, y: 100 + step * 5}, {x: 0, y: 5})

        assert.equal(tack.aliasZone(), 'S')
        assert.deepEqual(diagonalWireSegments(route.wire), [])
        assert.ok(route.wire.length <= 5)
    }
})

test('a sequence of cable movements preserves every shared endpoint-route invariant', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]
    const attach = (pinCenter, approach) => {
        const pin = {is: {pin: true, input: true}, center: () => ({...pinCenter}), routes: []}
        const tack = cable.newTack()
        const route = new Route(tack, pin)
        route.wire = [{x: 0, y: 100}, {x: 30, y: 100}, {x: 30, y: pinCenter.y}, pin.center()]
        tack.setRoute(route)
        tack.attachEndpoint('end')
        tack.setEndpointApproach(approach)
        return route
    }
    const routes = [attach({x: 100, y: 180}, 'S'), attach({x: -100, y: 140}, 'W')]
    const maximumPoints = routes.map(route => route.wire.length)
    const check = () => {
        assertCableAttachmentInvariants(cable)
        routes.forEach((route, index) => assert.ok(route.wire.length <= maximumPoints[index]))
    }

    cable.moveSegment(1, {x: 20, y: 0})
    check()
    cable.resumeDrawXY('end', {x: 20, y: 120}, {x: 0, y: 20})
    check()
    cable.reverse()
    check()
    cable.drag({x: 15, y: 10})
    check()
})

for (const tackIsFrom of [true, false]) {
    for (const {name, y, approach} of [
        {name: 'above', y: 50, approach: 'N'},
        {name: 'below', y: 150, approach: 'S'}
    ]) {
        test(`moving a cable segment extends a two-segment ${name} endpoint route with the tack ${tackIsFrom ? 'first' : 'last'}`, () => {
            const cable = new Cable({x: 100, y: 100})
            cable.wire = [{x: 100, y: 100}, {x: 100, y: 200}]
            const pin = {is: {pin: true, input: true}, center: () => ({x: 0, y}), routes: []}
            const tack = cable.newTack()
            const tackFirstWire = [{x: 100, y: 100}, {x: 100, y}, pin.center()]
            const route = tackIsFrom ? new Route(tack, pin) : new Route(pin, tack)
            route.wire = tackIsFrom ? tackFirstWire : tackFirstWire.slice().reverse()
            tack.setRoute(route)
            tack.attachEndpoint('start', approach)

            cable.moveSegment(1, {x: 20, y: 0})

            const contactIndex = tackIsFrom ? 0 : route.wire.length - 1
            const neighbourIndex = tackIsFrom ? 1 : route.wire.length - 2
            assert.equal(route.wire[contactIndex].x, 120)
            assert.equal(route.wire[neighbourIndex].x, 120)
            assert.equal(tack.aliasZone(), approach)
            assert.equal(route.wire.length, 3)
            assert.deepEqual(diagonalWireSegments(route.wire), [])
        })
    }
}

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

for (const {name, wire, tackPoint, next} of [
    {
        name: 'rightward horizontal',
        wire: [{x: 0, y: 0}, {x: 80, y: 0}, {x: 80, y: 50}, {x: 100, y: 50}],
        tackPoint: {x: 90, y: 50},
        next: {x: 85, y: 50}
    },
    {
        name: 'leftward horizontal',
        wire: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 50}, {x: 80, y: 50}],
        tackPoint: {x: 90, y: 50},
        next: {x: 95, y: 50}
    },
    {
        name: 'downward vertical',
        wire: [{x: 0, y: 0}, {x: 0, y: 80}, {x: 50, y: 80}, {x: 50, y: 100}],
        tackPoint: {x: 50, y: 90},
        next: {x: 50, y: 85}
    },
    {
        name: 'upward vertical',
        wire: [{x: 0, y: 0}, {x: 0, y: 100}, {x: 50, y: 100}, {x: 50, y: 80}],
        tackPoint: {x: 50, y: 90},
        next: {x: 50, y: 95}
    }
]) {
    test(`moving a ${name} cable endpoint into the first tack captures it`, () => {
        const cable = new Cable(wire[0])
        cable.wire = wire.map(point => ({...point}))
        const horizontal = wire.at(-1).y === wire.at(-2).y
        const pin = {
            is: {pin: true, input: true},
            center: () => horizontal
                ? {x: tackPoint.x, y: tackPoint.y + 40}
                : {x: tackPoint.x + 40, y: tackPoint.y},
            routes: []
        }
        const tack = cable.newTack()
        const route = new Route(tack, pin)
        route.wire = [{...tackPoint}, pin.center()]
        tack.setRoute(route)
        const oldEnd = {...cable.wire.at(-1)}

        cable.resumeDrawXY('end', next, {x: next.x - oldEnd.x, y: next.y - oldEnd.y})

        assert.deepEqual(cable.wire.at(-1), tackPoint)
        assert.equal(tack.isEndpoint('end'), true)
        assert.deepEqual(tack.center(), cable.wire.at(-1))
        assert.deepEqual(diagonalWireSegments(route.wire), [])
    })
}

test('straightening a small endpoint-route bend moves the endpoint and its existing tacks', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]

    const movingPin = {is: {pin: true, input: true}, center: () => ({x: 100, y: 90}), routes: []}
    const movingTack = cable.newTack()
    const movingRoute = new Route(movingTack, movingPin)
    movingRoute.wire = [{x: 0, y: 100}, {x: 20, y: 100}, {x: 20, y: 90}, movingPin.center()]
    movingTack.setRoute(movingRoute)
    movingTack.attachEndpoint('end')

    const otherPin = {is: {pin: true, input: false}, center: () => ({x: -100, y: 100}), routes: []}
    const otherTack = cable.newTack()
    const otherRoute = new Route(otherPin, otherTack)
    otherRoute.wire = [otherPin.center(), {x: 0, y: 100}]
    otherTack.setRoute(otherRoute)
    otherTack.attachEndpoint('end')
    const oldCableWire = cable.copyWire()
    const oldCableTackWires = cable.copyTackWires()

    assert.equal(movingTack.fuseEndSegment(), true)

    const newCableWire = cable.copyWire()
    const newCableTackWires = cable.copyTackWires()

    assert.deepEqual(cable.wire.at(-1), {x: 0, y: 90})
    assert.equal(movingTack.isEndpoint('end'), true)
    assert.equal(otherTack.isEndpoint('end'), true)
    assert.deepEqual(movingTack.center(), cable.wire.at(-1))
    assert.deepEqual(otherTack.center(), cable.wire.at(-1))
    assert.deepEqual(diagonalWireSegments(movingRoute.wire), [])
    assert.deepEqual(diagonalWireSegments(otherRoute.wire), [])

    redoxCable.tackDrag.undo({tack: movingTack, oldCableWire, oldCableTackWires})
    assert.deepEqual(cable.wire.at(-1), {x: 0, y: 100})
    assert.deepEqual(movingTack.center(), cable.wire.at(-1))
    assert.deepEqual(otherTack.center(), cable.wire.at(-1))

    redoxCable.tackDrag.redo({tack: movingTack, newCableWire, newCableTackWires})
    assert.deepEqual(cable.wire.at(-1), {x: 0, y: 90})
    assert.deepEqual(movingTack.center(), cable.wire.at(-1))
    assert.deepEqual(otherTack.center(), cable.wire.at(-1))
})

test('small-bend straightening keeps the bend when moving the endpoint would cross an interior tack', () => {
    const cable = new Cable({x: 0, y: 0})
    cable.wire = [{x: 0, y: 0}, {x: 0, y: 100}]

    const endpointPin = {is: {pin: true, input: true}, center: () => ({x: 100, y: 90}), routes: []}
    const endpointTack = cable.newTack()
    const endpointRoute = new Route(endpointTack, endpointPin)
    endpointRoute.wire = [{x: 0, y: 100}, {x: 20, y: 100}, {x: 20, y: 90}, endpointPin.center()]
    endpointTack.setRoute(endpointRoute)
    endpointTack.attachEndpoint('end')

    const blockerPin = {is: {pin: true, input: false}, center: () => ({x: -100, y: 95}), routes: []}
    const blocker = cable.newTack()
    const blockerRoute = new Route(blockerPin, blocker)
    blockerRoute.wire = [blockerPin.center(), {x: 0, y: 95}]
    blocker.setRoute(blockerRoute)

    assert.equal(endpointTack.fuseEndSegment(), false)

    assert.deepEqual(cable.wire.at(-1), {x: 0, y: 100})
    assert.equal(endpointTack.isEndpoint('end'), true)
    assert.equal(blocker.isEndpoint(), false)
    assert.equal(endpointRoute.wire.length, 4)
})

test('straightening cable connections removes redundant route points', () => {
    const cable = new Cable({x: 100, y: 0})
    cable.wire = [{x: 100, y: 0}, {x: 100, y: 100}]
    const pin = {
        is: {pin: true, input: false},
        rect: {x: 0, y: 40, w: 20, h: 20},
        center: () => ({x: 0, y: 50}),
        routes: []
    }
    const tack = cable.newTack()
    const route = new Route(pin, tack)
    route.wire = [
        pin.center(),
        {x: 20, y: 50},
        {x: 20, y: 40},
        {x: 60, y: 40},
        {x: 60, y: 50},
        {x: 100, y: 50}
    ]
    tack.setRoute(route)

    cable.straightConnections()

    assert.deepEqual(route.wire, [pin.center(), {x: 100, y: 50}])
    assertCableAttachmentInvariants(cable)
})
