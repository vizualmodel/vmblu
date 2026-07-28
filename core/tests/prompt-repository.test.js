import test from 'node:test'
import assert from 'node:assert/strict'

import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint} from '../types/model/index.js'
import {parsePromptMarkdown, serializePromptMarkdown} from '../types/model/blueprint-prompt.js'
import {jsonHandling as groupJsonHandling} from '../types/node/node-group-json.js'
import {jsonHandling as sourceJsonHandling} from '../types/node/node-source-json.js'

test('legacy node prompt markdown remains readable', () => {
    const parsed = parsePromptMarkdown(`# Legacy Node

## Node

Legacy responsibility text.

### Existing detail

An old prompt may contain an unrelated level-three heading.

## Pins

### messages.received

Handles a received message.
`)

    assert.equal(parsed.node.prompt, `Legacy responsibility text.

### Existing detail

An old prompt may contain an unrelated level-three heading.`)
    assert.equal(parsed.node.status, '')
    assert.equal(parsed.node.decisions, '')
    assert.equal(parsed.node.open, '')
    assert.equal(parsed.pins.get('messages.received'), 'Handles a received message.')
})

test('structured node prompt markdown parses all four node sections', () => {
    const parsed = parsePromptMarkdown(`# External Communications

## Node

### Prompt

Owns external communication.

### Status

Boundary accepted. Not ready for implementation.

### Decisions

- Responses and live delivery remain distinct.

### Open

- Define payload contracts.
- Decide the initial transport.

## Pins

### incoming.received

Emits a normalized incoming message.
`)

    assert.equal(parsed.node.prompt, 'Owns external communication.')
    assert.equal(parsed.node.status, 'Boundary accepted. Not ready for implementation.')
    assert.equal(parsed.node.decisions, '- Responses and live delivery remain distinct.')
    assert.equal(parsed.node.open, `- Define payload contracts.
- Decide the initial transport.`)
    assert.equal(parsed.pins.get('incoming.received'), 'Emits a normalized incoming message.')
})

test('prompt repository serialization writes titled node sections and round-trips', () => {
    const node = {
        name: 'External Communications',
        prompt: 'Owns external communication.',
        promptStatus: 'Boundary accepted.',
        promptDecisions: '- Keep transport handling separate from access control.',
        promptOpen: '- Define payload contracts.',
        interfaces: [
            {
                interface: 'incoming',
                pins: [
                    {
                        name: 'incoming.received',
                        prompt: 'Emits a normalized incoming message.',
                    },
                ],
            },
        ],
    }

    const markdown = serializePromptMarkdown(node)
    const parsed = parsePromptMarkdown(markdown)

    assert.match(markdown, /## Node\n\n### Prompt\n/)
    assert.match(markdown, /\n### Status\n/)
    assert.match(markdown, /\n### Decisions\n/)
    assert.match(markdown, /\n### Open\n/)
    assert.match(markdown, /\n## Pins\n/)
    assert.equal(parsed.node.prompt, node.prompt)
    assert.equal(parsed.node.status, node.promptStatus)
    assert.equal(parsed.node.decisions, node.promptDecisions)
    assert.equal(parsed.node.open, node.promptOpen)
    assert.equal(parsed.pins.get('incoming.received'), node.interfaces[0].pins[0].prompt)
})

test('preparing a model save externalizes every node text section', () => {
    const model = new ModelBlueprint(new ARL('C:/temporary/structured-prompt.mod.blu'))
    model.raw = {
        root: {
            kind: 'group',
            name: 'Root',
            prompt: 'Root responsibility.',
            promptStatus: 'Responsibilities accepted.',
            promptDecisions: '- Keep the root architectural.',
            promptOpen: '- Define child boundaries.',
            nodes: [],
        },
    }

    const files = model.preparePromptReposForSave()

    assert.equal(files.length, 1)
    assert.match(files[0].text, /### Prompt\n\nRoot responsibility\./)
    assert.match(files[0].text, /### Status\n\nResponsibilities accepted\./)
    assert.match(files[0].text, /### Decisions\n\n- Keep the root architectural\./)
    assert.match(files[0].text, /### Open\n\n- Define child boundaries\./)
    assert.equal(model.raw.root.prompt, undefined)
    assert.equal(model.raw.root.promptStatus, undefined)
    assert.equal(model.raw.root.promptDecisions, undefined)
    assert.equal(model.raw.root.promptOpen, undefined)
    assert.deepEqual(model.raw.root.promptRepo, {
        arl: './prompts/Root.md',
        pathKind: 2,
    })
})

test('node raw conversion retains prompt text alongside promptRepo until externalization', () => {
    const promptRepo = {
        makeRaw() {
            return {arl: './prompts/Node.md', pathKind: 2}
        },
    }
    const look = {
        makeRaw() {
            return {label: null, rect: null, interfaces: []}
        },
    }

    const groupRaw = groupJsonHandling.makeRaw.call({
        link: null,
        name: 'Group',
        look,
        team: null,
        promptRepo,
        prompt: 'Group responsibility.',
        promptStatus: null,
        promptDecisions: null,
        promptOpen: null,
        savedView: null,
        sx: null,
        dx: null,
        nodes: null,
        cables: [],
        pads: [],
        getRoutesAndConnections() {
            return [[], []]
        },
    })

    const sourceRaw = sourceJsonHandling.makeRaw.call({
        link: null,
        name: 'Source',
        look,
        team: null,
        factory: {
            makeRaw() {
                return {path: './source.js', function: 'Source'}
            },
        },
        promptRepo,
        prompt: 'Source responsibility.',
        promptStatus: null,
        promptDecisions: null,
        promptOpen: null,
        sx: null,
        dx: null,
    })

    assert.equal(groupRaw.prompt, 'Group responsibility.')
    assert.deepEqual(groupRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
    assert.equal(sourceRaw.prompt, 'Source responsibility.')
    assert.deepEqual(sourceRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
})
