import test from 'node:test'
import assert from 'node:assert/strict'

import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint} from '../types/model/index.js'
import {jsonHandling as groupJsonHandling} from '../types/node/node-group-json.js'
import {jsonHandling as sourceJsonHandling} from '../types/node/node-source-json.js'
import {PromptRepo, getPromptRepoRuntimeState} from '../types/node/prompt-repo.js'
import {NodePrompts} from '../types/node/node-prompts.js'
import {redoxNode} from '../nodes/model-manager/redox-node.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'

test('NodePrompts keeps markdown opaque', () => {
    const markdown = `# External Communications

Organize this document in whichever way is useful.

## Current thinking

- Keep transport handling separate from access control.
`

    assert.equal(new NodePrompts({prompt: markdown}).prompt, markdown)
})

test('NodePrompts owns only the prompt and repository', () => {
    const repository = {
        makeRaw() { return {arl: './prompts/Node.md', pathKind: 2} },
        clone() { return {...this} },
    }
    const prompts = new NodePrompts({prompt: 'Before', repository})
    const edit = prompts.apply('After')

    assert.equal(edit.changed, true)
    assert.equal(edit.before, 'Before')
    assert.deepEqual(Object.keys(prompts).sort(), ['prompt', 'repository'])
    assert.equal(getPromptRepoRuntimeState(repository).dirty, true)

    assert.deepEqual(prompts.writeRaw({kind: 'source', name: 'Node'}, null), {
        kind: 'source',
        name: 'Node',
        promptRepo: {arl: './prompts/Node.md', pathKind: 2},
        prompt: 'After',
    })

    const clone = prompts.clone()
    assert.equal(clone.prompt, 'After')
    assert.notEqual(clone.repository, repository)
})

test('preparing a model save externalizes node and pin prompts', () => {
    const model = new ModelBlueprint(new ARL('C:/temporary/simple-prompt.mod.blu'))
    model.raw = {
        root: {
            kind: 'group',
            name: 'Root',
            prompt: '# Root\n\nRoot responsibility.\n',
            interfaces: [{pins: [{name: 'input', prompt: 'Pin guidance remains inline.'}]}],
            nodes: [],
        },
    }

    const files = model.preparePromptReposForSave()

    assert.equal(files.length, 1)
    assert.match(files[0].text, /## Node\n\n# Root\n\nRoot responsibility\./)
    assert.match(files[0].text, /## Pins\n\n### input\n\nPin guidance remains inline\./)
    assert.equal(model.raw.root.prompt, undefined)
    assert.equal(model.raw.root.interfaces[0].pins[0].prompt, undefined)
    assert.deepEqual(model.raw.root.promptRepo, {
        arl: './prompts/Root.md',
        pathKind: 2,
    })
})

test('node raw conversion retains prompt text alongside promptRepo until externalization', () => {
    const promptRepo = {
        makeRaw() { return {arl: './prompts/Node.md', pathKind: 2} },
    }
    const look = {
        makeRaw() { return {label: null, rect: null, interfaces: []} },
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
        getRoutesAndConnections() { return [[], []] },
    })
    const sourceRaw = sourceJsonHandling.makeRaw.call({
        link: null,
        name: 'Source',
        look,
        team: null,
        factory: {makeRaw: () => ({path: './source.js', function: 'Source'})},
        prompts: sourcePrompts,
        sx: null,
        dx: null,
    })

    assert.equal(groupRaw.prompt, 'Group responsibility.')
    assert.deepEqual(groupRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
    assert.equal(sourceRaw.prompt, 'Source responsibility.')
    assert.deepEqual(sourceRaw.promptRepo, {arl: './prompts/Node.md', pathKind: 2})
})

test('hydration restores node and pin prompts and unrelated saves do not rewrite them', async () => {
    const text = `# Root

## Node

Original external text.

## Pins

### input

Original pin text.
`
    const fixture = makePromptModel({'./prompts/Root.md': text})
    fixture.model.raw = rawModel(rawGroup('Root', './prompts/Root.md'))
    fixture.model.raw.root.interfaces = [{pins: [{name: 'input'}]}]

    await fixture.model.hydratePromptRepos()
    assert.equal(fixture.model.raw.root.prompt, 'Original external text.')
    assert.equal(fixture.model.raw.root.interfaces[0].pins[0].prompt, 'Original pin text.')
    assert.equal(getPromptRepoRuntimeState(fixture.model.raw.root.promptRepo).dirty, false)

    fixture.files.get('./prompts/Root.md').text = 'Changed by another tool.'
    fixture.model.raw.root.label = 'Unrelated semantic edit'
    await fixture.model.saveRaw()

    assert.equal(fixture.files.get('./prompts/Root.md').writes.length, 0)
    assert.equal(fixture.files.get('./prompts/Root.md').text, 'Changed by another tool.')
})

test('a changed node prompt dirties and writes only its repository with undo and redo', async () => {
    const fixture = makePromptModel({
        './prompts/One.md': 'One',
        './prompts/Two.md': 'Two',
    })
    const one = liveNode(fixture, 'One', './prompts/One.md', 'One')
    const two = liveNode(fixture, 'Two', './prompts/Two.md', 'Two')
    let edit
    const redox = {saveEdit: (verb, param) => edit = param}

    redoxNode.changeNodePrompt.doit.call(redox, {node: one, document: 'Changed prompt'})

    assert.equal(one.prompts.prompt, 'Changed prompt')
    assert.equal(getPromptRepoRuntimeState(one.prompts.repository).dirty, true)
    assert.equal(getPromptRepoRuntimeState(two.prompts.repository).dirty, false)

    redoxNode.changeNodePrompt.undo(edit)
    assert.equal(one.prompts.prompt, 'One')
    redoxNode.changeNodePrompt.redo(edit)
    assert.equal(one.prompts.prompt, 'Changed prompt')

    fixture.model.setRaw(rawModel(rawGroup('Root', null, [encodeLiveNode(one), encodeLiveNode(two)])))
    await fixture.model.saveRaw()

    assert.deepEqual(fixture.files.get('./prompts/One.md').writes, ['Changed prompt'])
    assert.equal(fixture.files.get('./prompts/Two.md').writes.length, 0)
})

test('unchanged node and pin prompt submissions remain clean', () => {
    const fixture = makePromptModel({'./prompts/Node.md': 'Same'})
    const node = liveNode(fixture, 'Node', './prompts/Node.md', 'Same')
    const pin = {node, prompt: 'Pin prompt'}
    const edits = []
    const redox = {saveEdit: (...args) => edits.push(args)}
    const state = getPromptRepoRuntimeState(node.prompts.repository)
    state.hydratedText = 'Same'

    redoxNode.changeNodePrompt.doit.call(redox, {node, document: 'Same'})
    redoxWidget.changePinPrompt.doit.call(redox, {pin, prompt: 'Pin prompt'})

    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, false)
    assert.equal(edits.length, 0)
})

test('whole prompt documents are preserved verbatim and undo as one value', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': 'Before'})
    const node = liveNode(fixture, 'Node', './prompts/Node.md', 'Before')
    const prompt = `# My preferred title

Introductory context can stay where the author put it.

## Any organization

The entire document is the prompt.
`
    let edit
    const redox = {saveEdit: (verb, param) => edit = param}

    redoxNode.changeNodePrompt.doit.call(redox, {node, document: prompt})
    assert.equal(node.prompts.prompt, prompt)

    redoxNode.changeNodePrompt.undo(edit)
    assert.equal(node.prompts.prompt, 'Before')
    redoxNode.changeNodePrompt.redo(edit)
    assert.equal(node.prompts.prompt, prompt)

    fixture.model.setRaw(rawModel(encodeLiveNode(node)))
    await fixture.model.saveRaw()
    assert.deepEqual(fixture.files.get('./prompts/Node.md').writes, [prompt])
})

test('pin prompt edits dirty and write the node prompt repository', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': 'Node prompt'})
    const node = liveNode(fixture, 'Node', './prompts/Node.md', 'Node prompt')
    const pin = {node, name: 'io.pin', prompt: 'Before'}
    node.interfaces = [{interface: 'io', pins: [pin]}]
    let edit
    const redox = {saveEdit: (verb, param) => edit = param}

    redoxWidget.changePinPrompt.doit.call(redox, {pin, prompt: 'After'})
    redoxWidget.changePinPrompt.undo(edit)
    assert.equal(pin.prompt, 'Before')
    getPromptRepoRuntimeState(node.prompts.repository).dirty = false
    redoxWidget.changePinPrompt.redo(edit)
    assert.equal(pin.prompt, 'After')
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, true)

    fixture.model.setRaw(rawModel(encodeLiveNode(node)))
    await fixture.model.saveRaw()
    assert.equal(fixture.files.get('./prompts/Node.md').writes.length, 1)
    assert.match(fixture.files.get('./prompts/Node.md').writes[0], /### io\.pin\n\nAfter/)
    assert.doesNotMatch(fixture.modelWrites.blu[0], /"prompt": "After"/)
})

test('a new inline prompt repository is written once and runtime state is not serialized', async () => {
    const fixture = makePromptModel({'./prompts/New-Node.md': ''})
    fixture.model.raw = rawModel(rawGroup('New Node'))
    fixture.model.raw.root.prompt = 'First-save prompt.'

    await fixture.model.saveRaw()

    assert.match(fixture.files.get('./prompts/New-Node.md').writes[0], /## Node\n\nFirst-save prompt\./)
    assert.doesNotMatch(fixture.modelWrites.blu[0], /dirty|hydrated|promptRepoRuntimeState/)
    await fixture.model.saveRaw()
    assert.equal(fixture.files.get('./prompts/New-Node.md').writes.length, 1)
})

test('failed prompt writes retain dirty state and can be retried', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': 'Before'})
    const node = liveNode(fixture, 'Node', './prompts/Node.md', 'After')
    node.prompts.markDirty()
    fixture.model.raw = rawModel(encodeLiveNode(node))
    fixture.files.get('./prompts/Node.md').fail = true

    const originalError = console.error
    console.error = () => {}
    try {
        await assert.rejects(fixture.model.saveRaw(), /prompt repositories failed to save/)
    }
    finally {
        console.error = originalError
    }
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, true)

    fixture.files.get('./prompts/Node.md').fail = false
    await fixture.model.saveRaw()
    assert.match(fixture.files.get('./prompts/Node.md').writes[0], /## Node\n\nAfter/)
    assert.equal(getPromptRepoRuntimeState(node.prompts.repository).dirty, false)
})

test('dirty prompt saves reject an external change and retain dirty state', async () => {
    const fixture = makePromptModel({'./prompts/Node.md': 'Before'})
    fixture.model.raw = rawModel(rawGroup('Node', './prompts/Node.md'))
    await fixture.model.hydratePromptRepos()

    const repository = fixture.model.raw.root.promptRepo
    fixture.model.raw.root.prompt = 'Edited in vmblu'
    getPromptRepoRuntimeState(repository).dirty = true
    fixture.files.get('./prompts/Node.md').text = 'Edited externally'

    const originalError = console.error
    console.error = () => {}
    try {
        await assert.rejects(fixture.model.saveRaw(), /Prompt repository changed outside vmblu/)
    }
    finally {
        console.error = originalError
    }

    assert.equal(fixture.files.get('./prompts/Node.md').writes.length, 0)
    assert.equal(getPromptRepoRuntimeState(repository).dirty, true)
    assert.equal(fixture.files.get('./prompts/Node.md').text, 'Edited externally')
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

function liveNode(fixture, name, path, prompt=null) {
    const promptRepo = new PromptRepo(fixture.files.get(path), 2)
    return {
        kind: 'group',
        name,
        prompts: new NodePrompts({prompt, repository: promptRepo}),
        interfaces: [],
        nodes: [],
    }
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
