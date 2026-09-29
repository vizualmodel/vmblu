import test from 'node:test'
import assert from 'node:assert/strict'
import {Cable} from '../types/node/cable.js'
import {Route} from '../types/node/route.js'
import {moveHandling} from '../types/node/look-move.js'
import {Selection} from '../types/view/selection.js'
import {diagonalWireSegments} from '../types/util/index.js'

function fixture(horizontal, endpoint, tackIsFrom) {
    const cable = new Cable()
    cable.wire = horizontal
        ? [{x: -100, y: 0}, {x: 0, y: 0}, {x: 100, y: 0}]
        : [{x: 0, y: -100}, {x: 0, y: 0}, {x: 0, y: 100}]
    const contact = endpoint ? {...cable.wire.at(-1)} : {x: 0, y: 0}
    const pin = {
        is: {pin: true, input: true},
        rect: {x: 250, y: 180},
        center() { return {x: this.rect.x, y: this.rect.y} },
        adjustRoutes() { for (const route of this.routes) route.adjust() }
    }
    const tack = cable.newTack()
    const route = tackIsFrom ? new Route(tack, pin) : new Route(pin, tack)
    route.wire = horizontal
        ? [contact, {x: contact.x, y: 60}, {x: 150, y: 60}, {x: 150, y: 180}, pin.center()]
        : [contact, {x: 100, y: contact.y}, {x: 100, y: 180}, pin.center()]
    if (!tackIsFrom) route.wire.reverse()
    pin.routes = [route]
    tack.setRoute(route)
    if (endpoint) tack.attachEndpoint('end', horizontal ? 'S' : 'E')
    const node = {look: {...moveHandling, rect: {x: 200, y: 150}, widgets: [pin]}}
    return {cable, tack, pin, route, node}
}

for (const horizontal of [false, true]) {
    for (const endpoint of [false, true]) {
        for (const tackIsFrom of [false, true]) {
            const label = `${horizontal ? 'horizontal' : 'vertical'} cable, ${endpoint ? 'endpoint' : 'interior'} tack, tack at ${tackIsFrom ? 'from' : 'to'}`
            for (const mode of ['both', 'node only', 'cable only', 'cable with unrelated node']) {
                test(`selection drag: ${mode}, ${label}`, () => {
                    const {cable, tack, pin, route, node} = fixture(horizontal, endpoint, tackIsFrom)
                    const selection = new Selection()
                    if (mode === 'both' || mode === 'node only') selection.nodes = [node]
                    if (mode === 'cable with unrelated node') {
                        selection.nodes = [{look: {...moveHandling, rect: {x: 500, y: 500}, widgets: []}}]
                    }
                    if (mode === 'both' || mode === 'cable with unrelated node') selection.cables = [cable]
                    let expected = route.wire.map(point => ({...point}))
                    for (const delta of [{x: 20, y: 30}, {x: -45, y: -15}, {x: 0, y: 25}]) {
                        if (mode === 'cable only') cable.drag(delta)
                        else selection.drag(delta)
                        if (mode === 'both') {
                            expected = expected.map(point => ({x: point.x + delta.x, y: point.y + delta.y}))
                            assert.deepEqual(route.wire, expected, 'every bend must translate by the shared delta')
                        }
                        assert.deepEqual(diagonalWireSegments(route.wire), [])
                        assert.deepEqual(tack.getContactPoint(), tack.center())
                        assert.deepEqual(tackIsFrom ? route.wire.at(-1) : route.wire[0], pin.center())
                    }
                })
            }
        }
    }
}
