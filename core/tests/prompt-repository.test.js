import test from 'node:test'
import assert from 'node:assert/strict'

import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint} from '../types/model/index.js'
import {parsePromptMarkdown, serializePromptMarkdown} from '../types/model/blueprint-prompt.js'
import {jsonHandling as groupJsonHandling} from '../types/node/node-group-json.js'
import {jsonHandling as sourceJsonHandling} from '../types/node/node-source-json.js'
import {PromptRepo, getPromptRepoRuntimeState} from '../types/node/prompt-repo.js'
import {NodePrompts} from '../types/node/node-prompts.js'
import {redoxNode} from '../nodes/model-manager/redox-node.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'

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
    assert.equal(parsed.node.references, '')
    assert.equal(parsed.pins.get('messages.received'), 'Handles a received message.')
})

test('structured node prompt markdown parses all node sections', () => {
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

### References

- [Transport guidance](https://example.com/transport) — External design guidance.

## Pins

### incoming.received

Emits a normalized incoming message.
`)

    assert.equal(parsed.node.prompt, 'Owns external communication.')
    assert.equal(parsed.node.status, 'Boundary accepted. Not ready for implementation.')
    assert.equal(parsed.node.decisions, '- Responses and live delivery remain distinct.')
    assert.equal(parsed.node.open, `- Define payload contracts.
- Decide the initial transport.`)
    assert.equal(parsed.node.references, '- [Transport guidance](https://example.com/transport) — External design guidance.')
    assert.equal(parsed.pins.get('incoming.received'), 'Emits a normalized incoming message.')
})

test('prompt repository serialization writes titled node sections and round-trips', () => {
    const node = {
        name: 'External Communications',
        prompt: 'Owns external communication.',
        promptStatus: 'Boundary accepted.',
        promptDecisions: '- Keep transport handling separate from access control.',
        promptOpen: '- Define payload contracts.',
        promptReferences: '- [Transport guidance](https://example.com/transport)',
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
    assert.match(markdown, /\n### References\n/)
    assert.match(markdown, /\n## Pins\n/)
    assert.equal(parsed.node.prompt, node.prompt)
    assert.equal(parsed.node.status, node.promptStatus)
    assert.equal(parsed.node.decisions, node.promptDecisions)
    assert.equal(parsed.node.open, node.promptOpen)
    assert.equal(parsed.node.references, node.promptReferences)
    assert.equal(parsed.pins.get('incoming.received'), node.interfaces[0].pins[0].prompt)
})

test('NodePrompts owns live sections while preserving the flat raw schema', () => {
    const repository = {
        makeRaw() { return {arl: './prompts/Node.md', pathKind: 2} },
        clone() { return {...this} },
    }
    const prompts = new NodePrompts({prompt: 'Before', repository})

    const edit = prompts.apply({
        prompt: 'After',
        status: 'Ready',
        decisions: '- Keep raw compatibility.',
        open: '',
        references: '- [Architecture](../docs/architecture.md)',
    })

    assert.equal(edit.changed, true)
    assert.deepEqual(edit.before, {prompt: 'Before', status: null, decisions: null, open: null, references: null})
    assert.equal(getPromptRepoRuntimeState(repository).dirty, true)

    const raw = prompts.writeRaw({kind: 'source', name: 'Node'}, null)
    assert.deepEqual(raw, {
        kind: 'source',
        name: 'Node',
        promptRepo: {arl: './prompts/Node.md', pathKind: 2},
        prompt: 'After',
        promptStatus: 'Ready',
        promptDecisions: '- Keep raw compatibility.',
        promptReferences: '- [Architecture](../docs/architecture.md)',
    })
    assert.equal(raw.prompts, undefined)

    prompts.hydrate({prompt: 'Hydrated'})
    assert.deepEqual(prompts.snapshot(), {prompt: 'Hydrated', status: null, decisions: null, open: null, references: null})
    assert.equal(getPromptRepoRuntimeState(repository).dirty, false)
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
            promptReferences: '- [Project brief](../../docs/brief.md)',
            nodes: [],
        },
    }

    const files = model.preparePromptReposForSave()

    assert.equal(files.length, 1)
    assert.match(files[0].text, /### Prompt\n\nRoot responsibility\./)
    assert.match(files[0].text, /### Status\n\nResponsibilities accepted\./)
    assert.match(files[0].text, /### Decisions\n\n- Keep the root architectural\./)
    assert.match(files[0].text, /### Open\n\n- Define child boundaries\./)
    assert.match(files[0].text, /### References\n\n- \[Project brief\]\(\.\.\/\.\.\/docs\/brief\.md\)/)
    assert.equal(model.raw.root.prompt, undefined)
    assert.equal(model.raw.root.promptStatus, undefined)
    assert.equal(model.raw.root.promptDecisions, undefined)
    assert.equal(model.raw.root.promptOpen, undefined)
    assert.equal(model.raw.root.promptReferences, undefined)
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
    const groupPrompts = new NodePrompts({prompt: 'Group responsibility.', repository: promptRepo})
    const sourcePrompts = new NodePrompts({prompt: 'Source responsibility.', repository: promptRepo})

    const groupRaw = groupJsonHandling.makeRaw.call({
        link: null,
        name: 'Group',
        look,
        team: null,
        prompts: groupPrompts,
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
        prompts: sourcePrompts,
        sx: null,
        dx: null,
    })

    assert.equal(groupRaw.prompt, 'Group responsibility.')
    assert.deepEqual(groupRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
    assert.equal(sourceRaw.prompt, 'Source responsibility.')
    assert.deepEqual(sourceRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
})

test('hydrated clean repositories survive unrelated model saves without prompt writes', async () => {
    const fixture = makePromptModel({'./prompts/Root.md': promptMarkdown('Original external text.')})
    fixture.model.raw = rawModel(rawGroup('Root', './prompts/Root.md'))

    await fixture.model.hydratePromptRepos()
    assert.equal(getPromptRepoRuntimeState(fixture.model.raw.root.promptRepo).dirty, false)

    fixture.files.get('./prompts/Root.md').text = promptMarkdown('Changed by another tool.')
    fixture.model.raw.root.label = 'Unrelated semantic edit'
    fixture.model.raw.root.rect = {x: 10, y: 20, w: 30, h: 40}
    await fixture.model.saveRaw()

    assert.equal(fixture.files.get('./prompts/Root.md').writes.length, 0)
    assert.match(fixture.files.get('./prompts/Root.md').text, /Changed by another tool\./)
})

test('each changed node prompt section dirties and writes only its repository', async () => {
    for (const section of ['prompt', 'status', 'decisions', 'open', 'references']) {
        const fixture = makePromptModel({
            './prompts/One.md': promptMarkdown('One'),
            './prompts/Two.md': promptMarkdown('Two'),
        })
        const one = liveNode(fixture, 'One', './prompts/One.md')
        const two = liveNode(fixture, 'Two', './prompts/Two.md')
        const edits = []
        const redox = {saveEdit: (...args) => edits.push(args)}

        redoxNode.changeNodePrompt.doit.call(redox, {
            node: one,
            sections: {...nodeSections(one), [section]: `Changed ${section}`},
        })

        assert.equal(one.prompts[section], `Changed ${section}`)
        assert.equal(getPromptRepoRuntimeState(one.prompts.repository).dirty, true)
        assert.equal(getPromptRepoRuntimeState(two.prompts.repository).dirty, false)
        assert.equal(edits.length, 1)

        getPromptRepoRuntimeState(one.prompts.repository).dirty = false
        redoxNode.changeNodePrompt.undo(edits[0][1])
        assert.equal(getPromptRepoRuntimeState(one.prompts.repository).dirty, true)
        getPromptRepoRuntimeState(one.prompts.repository).dirty = false
        redoxNode.changeNodePrompt.redo(edits[0][1])
        assert.equal(getPromptRepoRuntimeState(one.prompts.repository).dirty, true)

        fixture.model.setRaw(rawModel(rawGroup('Root', null, [encodeLiveNode(one), encodeLiveNode(two)])))
        await fixture.model.saveRaw()

        assert.equal(fixture.files.get('./prompts/One.md').writes.length, 1)
        assert.equal(fixture.files.get('./prompts/Two.md').writes.length, 0)
        assert.equal(getPromptRepoRuntimeState(one.prompts.repository).dirty, false)
    }
})

test('unchanged node and pin prompt submissions remain clean', () => {
    const fixture = makePromptModel({'./prompts/Node.md': promptMarkdown('Same')})
    const node = liveNode(fixture, 'Node', './prompts/Node.md')
    node.prompts.prompt = 'Same'
    const pin = {node, prompt: 'Pin prompt'}
    const edits = []
    const redox = {saveEdit: (...args) => edits.push(args)}

    redoxNode.changeNodePrompt.doit.call(redox, {node, sections: nodeSections(node)})
    redoxWidget.changePinPrompt.doit.call(redox, {pin, prompt: 'Pin prompt'})

    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, false)
    assert.equal(edits.length, 0)
})

test('pin edits write the owning repository and undo/redo keep it dirty', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': promptMarkdown('Node')})
    const node = liveNode(fixture, 'Node', './prompts/Node.md')
    const pin = {node, name: 'io.pin', prompt: 'Before'}
    node.interfaces = [{interface: 'io', pins: [pin]}]
    let edit
    const redox = {saveEdit: (verb, param) => edit = param}

    redoxWidget.changePinPrompt.doit.call(redox, {pin, prompt: 'After'})
    getPromptRepoRuntimeState(node.prompts.repository).dirty = false
    redoxWidget.changePinPrompt.undo(edit)
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, true)
    getPromptRepoRuntimeState(node.prompts.repository).dirty = false
    redoxWidget.changePinPrompt.redo(edit)
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, true)

    fixture.model.setRaw(rawModel(encodeLiveNode(node)))
    await fixture.model.saveRaw()
    assert.equal(fixture.files.get('./prompts/Node.md').writes.length, 1)
    assert.match(fixture.files.get('./prompts/Node.md').writes[0], /### io\.pin\n\nAfter/)
})

test('a new inline prompt repository is written once and runtime state is not serialized', async () => {
    const fixture = makePromptModel({'./prompts/New-Node.md': ''})
    fixture.model.raw = rawModel(rawGroup('New Node'))
    fixture.model.raw.root.prompt = 'First-save prompt.'

    await fixture.model.saveRaw()

    assert.equal(fixture.files.get('./prompts/New-Node.md').writes.length, 1)
    assert.doesNotMatch(fixture.modelWrites.blu[0], /dirty|hydrated|promptRepoRuntimeState/)
    await fixture.model.saveRaw()
    assert.equal(fixture.files.get('./prompts/New-Node.md').writes.length, 1)
})

test('failed prompt writes retain dirty state and can be retried', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': promptMarkdown('Before')})
    const node = liveNode(fixture, 'Node', './prompts/Node.md')
    node.prompts.prompt = 'After'
    node.prompts.markDirty()
    fixture.model.raw = rawModel(encodeLiveNode(node))
    fixture.files.get('./prompts/Node.md').fail = true

    const reported = []
    const originalError = console.error
    console.error = (...args) => reported.push(args)
    try {
        await assert.rejects(fixture.model.saveRaw(), /prompt repositories failed to save/)
    }
    finally {
        console.error = originalError
    }
    assert.equal(reported.length, 1)
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, true)

    fixture.files.get('./prompts/Node.md').fail = false
    await fixture.model.saveRaw()
    assert.equal(fixture.files.get('./prompts/Node.md').writes.length, 1)
    assert.match(fixture.files.get('./prompts/Node.md').writes[0], /### Prompt\n\nAfter/)
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, false)
})

test('dirty prompt saves reject an external change and retain dirty state', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': promptMarkdown('Before')})
    fixture.model.raw = rawModel(rawGroup('Node', './prompts/Node.md'))
    await fixture.model.hydratePromptRepos()

    const repository = fixture.model.raw.root.promptRepo
    fixture.model.raw.root.prompt = 'Edited in vmblu'
    getPromptRepoRuntimeState(repository).dirty = true
    fixture.files.get('./prompts/Node.md').text = promptMarkdown('Edited externally')

    const reported = []
    const originalError = console.error
    console.error = (...args) => reported.push(args)
    try {
        await assert.rejects(
            fixture.model.saveRaw(),
            /Prompt repository changed outside vmblu/
        )
    }
    finally {
        console.error = originalError
    }

    assert.equal(reported.length, 1)
    assert.equal(fixture.files.get('./prompts/Node.md').writes.length, 0)
    assert.equal(getPromptRepoRuntimeState(repository).dirty, true)
    assert.match(fixture.files.get('./prompts/Node.md').text, /Edited externally/)
})

function makePromptModel(initialFiles) {
    const files = new Map()
    for (const [path, text] of Object.entries(initialFiles)) {
        files.set(path, {
            path,
            text,
            writes: [],
            fail: false,
            getPath() { return this.path },
            getFullPath() { return `C:/project/${this.path.replace(/^\.\//, '')}` },
            async get() { return this.text },
            async save(next) {
                if (this.fail) throw new Error(`write failed: ${this.path}`)
                this.text = next
                this.writes.push(next)
                return true
            },
        })
    }
    const modelWrites = {blu: [], viz: []}
    const blu = {
        getPath: () => 'C:/project/model.mod.blu',
        getFullPath: () => 'C:/project/model.mod.blu',
        resolve: path => files.get(path),
        async save(text) { modelWrites.blu.push(text) },
    }
    const viz = {
        getPath: () => 'C:/project/model.mod.viz',
        async save(text) { modelWrites.viz.push(text) },
    }
    const model = new ModelBlueprint()
    model.blu.arl = blu
    model.viz.arl = viz
    return {model, files, modelWrites}
}

function rawModel(root) {
    return {
        header: {version: '0.9.8', style: '#123456'},
        root,
    }
}

function rawGroup(name, promptPath = null, nodes = []) {
    const node = {kind: 'group', name, rect: null, nodes}
    if (promptPath) node.promptRepo = {arl: promptPath, pathKind: 2}
    return node
}

function promptMarkdown(prompt) {
    return serializePromptMarkdown({name: 'Node', prompt, interfaces: []})
}

function liveNode(fixture, name, path) {
    const promptRepo = new PromptRepo(fixture.files.get(path), 2)
    return {
        kind: 'group',
        name,
        prompts: new NodePrompts({repository: promptRepo}),
        interfaces: [],
        nodes: [],
    }
}

function nodeSections(node) {
    return node.prompts.snapshot()
}

function encodeLiveNode(node) {
    const raw = {
        kind: 'group',
        name: node.name,
        rect: null,
        nodes: [],
        interfaces: node.interfaces,
    }
    return node.prompts.writeRaw(raw, {getFullPath: () => 'C:/project/model.mod.blu'})
}
