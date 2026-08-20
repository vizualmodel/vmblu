import test from 'node:test'
import assert from 'node:assert/strict'

import {messageHandling} from '../nodes/view-manager/message.js'
import {GroupNode, Look} from '../types/node/index.js'
import {zap} from '../types/view/index.js'

test('application prompt opens the root prompt editor and submits an undoable edit', () => {
    const root = new GroupNode(null, 'Root', 'root-id')
    root.prompts.prompt = `# Application prompt

Overall application prompt.

The project is in progress.
`

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
    assert.match(sent[0].payload.text, /# Application prompt/)
    assert.match(sent[0].payload.text, /Overall application prompt\./)

    const prompt = sent[0].payload.text
        .replace('Overall application prompt.', 'Updated application prompt.')
    sent[0].payload.ok(prompt)

    assert.equal(sent[1].message, 'redox.doit')
    assert.equal(sent[1].payload.verb, 'changeNodePrompt')
    assert.equal(sent[1].payload.param.node, root)
    assert.equal(sent[1].payload.param.document, prompt)
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
    root.prompts.prompt = 'Application prompt'
    root.prompts.repository = {arl}
    const sent = []
    const tx = {send: (message, payload) => sent.push({message, payload})}

    root.showPrompt(tx, {x: 10, y: 20})
    sent[0].payload.open()

    assert.equal(sent[1].message, 'open source file')
    assert.equal(sent[1].payload.arl, arl)
})

test('an empty node prompt keeps a visible and interactive comment icon', () => {
    const node = new GroupNode(null, 'Node', 'node-id')
    node.look = new Look({x: 0, y: 0, w: 150, h: 20})
    node.look.decorate(node)
    const comment = node.look.widgets.find(widget => widget.is.icon && widget.type === 'comment')
    let commentRenders = 0
    for (const widget of node.look.widgets) widget.render = () => {
        if (widget === comment) commentRenders++
    }

    node.look.render({})
    assert.equal(commentRenders, 1)
    assert.equal(node.hitTest({x: comment.rect.x + 1, y: comment.rect.y + 1})[0], zap.icon)

    node.prompts.prompt = 'Visible prompt'
    node.look.render({})
    assert.equal(commentRenders, 2)
    assert.equal(node.hitTest({x: comment.rect.x + 1, y: comment.rect.y + 1})[0], zap.icon)
})

test('an empty node prompt opens an empty editor so a prompt can be added', () => {
    const node = new GroupNode(null, 'Node', 'node-id')
    const sent = []

    node.showPrompt({send: (message, payload) => sent.push({message, payload})}, {x: 10, y: 20})

    assert.equal(sent[0].message, 'node prompt')
    assert.equal(sent[0].payload.text, '')
})
