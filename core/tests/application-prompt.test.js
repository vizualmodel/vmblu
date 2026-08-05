import test from 'node:test'
import assert from 'node:assert/strict'

import {messageHandling} from '../nodes/view-manager/message.js'
import {GroupNode} from '../types/node/index.js'

test('application prompt opens the root prompt editor and submits an undoable edit', () => {
    const root = new GroupNode(null, 'Root', 'root-id')
    root.prompts.hydrate({
        prompt: 'Overall application prompt.',
        status: 'In progress.',
        decisions: '',
        open: '',
        references: '- [Project brief](../../../docs/brief.md)',
    })

    const sent = []
    const manager = {
        top: {root},
        tx: {
            send(message, payload) {
                sent.push({message, payload})
            },
        },
    }

    messageHandling.onApplicationPrompt.call(manager, {clientX: 100, clientY: 200})

    assert.equal(sent[0].message, 'node prompt')
    assert.equal(sent[0].payload.header, 'Application prompt for Root')
    assert.deepEqual(sent[0].payload.pos, {x: 85, y: 210})
    assert.equal(sent[0].payload.uid, 'root-id')
    assert.equal(sent[0].payload.mode, 'node-sections')
    assert.deepEqual(sent[0].payload.sections, {
        prompt: 'Overall application prompt.',
        status: 'In progress.',
        decisions: '',
        open: '',
        references: '- [Project brief](../../../docs/brief.md)',
    })

    const sections = {
        prompt: 'Updated application prompt.',
        status: 'Ready.',
        decisions: 'Keep the view menu focused on view management.',
        open: '',
        references: '- [Project brief](../../../docs/brief.md)',
    }
    sent[0].payload.ok(sections)

    assert.equal(sent[1].message, 'redox.doit')
    assert.equal(sent[1].payload.verb, 'changeNodePrompt')
    assert.equal(sent[1].payload.param.node, root)
    assert.equal(sent[1].payload.param.sections, sections)
})

test('application prompt is ignored when no document is open', () => {
    const sent = []
    const manager = {
        top: null,
        tx: {send: (...args) => sent.push(args)},
    }

    messageHandling.onApplicationPrompt.call(manager, {clientX: 100, clientY: 200})

    assert.deepEqual(sent, [])
})

test('prompt editor can request its repository file in a full editor', () => {
    const root = new GroupNode(null, 'Root', 'root-id')
    const arl = {getPath: () => 'C:/project/model/prompts/Root.md'}
    root.prompts.repository = {arl}
    const sent = []
    const tx = {send: (message, payload) => sent.push({message, payload})}

    root.showPrompt(tx, {x: 10, y: 20})
    sent[0].payload.open()

    assert.equal(sent[1].message, 'open source file')
    assert.equal(sent[1].payload.arl, arl)
})
