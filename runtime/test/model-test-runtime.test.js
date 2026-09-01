import test from 'node:test'
import assert from 'node:assert/strict'

import {BrowserTestHost, runModelTests} from '../rt-model-test/index.js'

function modelArtifact(scope, scenarios) {
    return {
        schemaVersion: '1.12.0',
        target: {scope, name: scope === 'model' ? 'App' : 'Pipeline', path: scope === 'model' ? [] : ['Pipeline']},
        scenarios,
    }
}

test('group scope injects at the group boundary and observes routed boundary output', async () => {
    function Doubler(tx) {
        return {onIn(value) { tx.send('middle', value * 2) }}
    }
    function Formatter(tx) {
        return {onMiddle(value) { tx.send('out', {value}) }}
    }

    const artifact = modelArtifact('group', [{
        id: 'routes-through-group', title: 'Routes through group', purpose: 'Exercise the composed behaviour',
        actions: [{kind: 'send', pin: 'group.in', message: 3}],
        expect: [{kind: 'send', pin: 'group.out', message: {value: 6}}],
    }])
    const nodeList = [
        {
            name: 'Doubler', uid: 'doubler', factory: Doubler,
            inputs: ['-> in'], outputs: ['middle -> middle @ Formatter (formatter)'],
        },
        {
            name: 'Formatter', uid: 'formatter', factory: Formatter,
            inputs: ['-> middle'], outputs: ['out -> ()'],
        },
    ]
    const boundary = {
        inputs: [{pin: 'group.in', targets: [{uid: 'doubler', pin: 'in'}]}],
        outputs: [{pin: 'group.out', sourceUid: 'formatter', sourcePin: 'out'}],
    }

    const report = await runModelTests({artifact, nodeList, boundary})

    assert.equal(report.status, 'passed')
    assert.match(report.artifactHash, /^fnv1a64:[0-9a-f]{16}$/)
    assert.deepEqual(report.scenarios[0].observations.map(({kind, pin, message}) => ({kind, pin, message})), [
        {kind: 'send', pin: 'group.out', message: {value: 6}},
    ])
})

test('model scope uses the same routed adapter with a model boundary', async () => {
    function AppNode(tx) {
        return {onCommand(value) { tx.send('event', value.toUpperCase()) }}
    }
    const artifact = modelArtifact('model', [{
        id: 'model-boundary', title: 'Model boundary', purpose: 'Exercise the complete model boundary',
        actions: [{kind: 'send', pin: 'app.command', message: 'go'}],
        expect: [{kind: 'send', pin: 'app.event', message: 'GO'}],
    }])
    const report = await runModelTests({
        artifact,
        nodeList: [{name: 'App node', uid: 'app', factory: AppNode, inputs: ['-> command'], outputs: ['event -> ()']}],
        boundary: {
            inputs: [{pin: 'app.command', targets: [{uid: 'app', pin: 'command'}]}],
            outputs: [{pin: 'app.event', sourceUid: 'app', sourcePin: 'event'}],
        },
    })

    assert.equal(report.status, 'passed')
})

test('source scope supports request/reply observations', async () => {
    function ViewProvider(tx) {
        return {onUiGetView() { tx.reply({slot: 'main'}) }}
    }
    const artifact = modelArtifact('node', [{
        id: 'gets-view', title: 'Gets view', purpose: 'Check the reply contract',
        actions: [{kind: 'request', pin: 'ui.get-view', message: null}],
        expect: [{kind: 'reply', pin: 'ui.get-view', message: {slot: 'main'}}],
    }])
    const report = await runModelTests({
        artifact, factory: ViewProvider, inputPins: ['ui.get-view'], outputPins: [],
    })

    assert.equal(report.status, 'passed')
})

test('browser host performs framework-neutral role actions and view assertions', async () => {
    let clicked = 0
    const button = {
        textContent: 'Logout', value: '', className: 'logout', hidden: false,
        classList: {contains: name => name === 'logout'},
        getAttribute: name => name === 'role' ? null : null,
        click: () => { clicked++ },
        ownerDocument: {defaultView: {getComputedStyle: () => ({display: 'block', visibility: 'visible'})}},
    }
    const root = {
        querySelectorAll: selector => selector.includes('button') ? [button] : [],
        contains: () => true,
    }
    const document = {body: root, defaultView: {Event: class {}}}
    const host = new BrowserTestHost({document, root, settle: async () => {}})

    await host.execute({kind: 'click', locator: {role: 'button', name: 'Logout'}})
    const failure = await host.assert({kind: 'view', locator: {role: 'button', name: 'Logout'}, text: 'Logout', class: 'logout', visible: true})

    assert.equal(clicked, 1)
    assert.equal(failure, null)
})

test('wait is available to non-browser node tests', async () => {
    function Delayed(tx) {
        return {onStart() { setTimeout(() => tx.send('done', true), 5) }}
    }
    const artifact = modelArtifact('node', [{
        id: 'waits', title: 'Waits', purpose: 'Observe asynchronous work',
        actions: [{kind: 'send', pin: 'start', message: null}, {kind: 'wait', ms: 15}],
        expect: [{kind: 'send', pin: 'done', message: true}],
    }])

    const report = await runModelTests({artifact, factory: Delayed, inputPins: ['start'], outputPins: ['done']})
    assert.equal(report.status, 'passed')
})

test('cleanup failures are execution errors', async () => {
    function BrokenCleanup() {
        return {onStart() {}, stop() { throw new Error('cleanup broke') }}
    }
    const artifact = modelArtifact('node', [{
        id: 'cleanup', title: 'Cleanup', purpose: 'Expose cleanup failures',
        actions: [{kind: 'send', pin: 'start', message: null}], expect: [],
    }])

    const report = await runModelTests({artifact, factory: BrokenCleanup, inputPins: ['start'], outputPins: []})
    assert.equal(report.status, 'error')
    assert.match(report.scenarios[0].failures[0].message, /cleanup broke/)
})

test('view assertions do not pass vacuously when a locator matches nothing', async () => {
    const root = {querySelectorAll: () => [], contains: () => true}
    const document = {body: root, defaultView: {Event: class {}}}
    const host = new BrowserTestHost({document, root, settle: async () => {}})

    const failure = await host.assert({kind: 'view', locator: {css: '.missing'}, class: 'ready'})
    assert.match(failure.message, /matched no elements/)
})
