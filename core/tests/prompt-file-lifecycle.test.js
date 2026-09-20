import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint} from '../types/model/blueprint.js'
import {GroupNode} from '../types/node/index.js'
import {ensureNodePromptFile} from '../types/node/prompt-file.js'
import {isEmptyPromptDocument, serializePromptMarkdown} from '../types/model/blueprint-prompt.js'
import {getPromptRepoRuntimeState} from '../types/node/prompt-repo.js'
import {applyNodePromptDocument} from '../types/node/node-prompt-document.js'

async function fixture(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vmblu-prompt-'))
    t.after(() => fs.rm(dir, {recursive: true, force: true}))
    const model = new ModelBlueprint(new ARL(path.join(dir, 'app.mod.blu')))
    const root = new GroupNode(null, 'My app', 'root')
    model.root = root
    root.model = model
    const raw = () => {
        model.raw = {root: {kind: 'group', name: root.name, nodes: []}}
        root.prompts.writeRaw(model.raw.root, model.getArl())
        return model.raw.root
    }
    return {dir, model, root, raw}
}

test('open creates a missing prompt with the current draft and preserves an existing file', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, 'Unsaved popup text')
    assert.equal(await arl.get(), 'Unsaved popup text')
    assert.match(arl.getFullPath(), /prompts\/My-app.md$/)
    assert.equal(f.root.prompts.prompt, 'Unsaved popup text')
    await ensureNodePromptFile(f.root, 'Do not overwrite')
    assert.equal(await arl.get(), 'Unsaved popup text')
    assert.equal(f.raw().promptRepo.arl, './prompts/My-app.md')
})

test('existing unreferenced prompt content is adopted without overwriting it', async t => {
    const f = await fixture(t)
    const arl = f.model.getArl().resolve('./prompts/My-app.md')
    await arl.createPromptFile('Existing notes')
    await ensureNodePromptFile(f.root, '')
    f.raw()
    await f.model.savePromptRepos()
    assert.equal(await arl.get(), 'Existing notes')
    assert.equal(f.root.prompts.prompt, 'Existing notes')
})

test('nested node prompt uses the same relative naming convention as normal save', async t => {
    const f = await fixture(t)
    const group = new GroupNode(null, 'Some group', 'group')
    const child = new GroupNode(null, 'Child', 'child')
    f.root.nodes = [group]
    group.nodes = [child]
    child.model = f.model
    const {arl} = await ensureNodePromptFile(child, '')
    assert.match(arl.getFullPath(), /prompts\/Some-group\/Child.md$/)
})

test('creation failure leaves the model reference untouched', async t => {
    const f = await fixture(t)
    f.model.getArl = () => ({resolve: () => ({createPromptFile: async () => {throw new Error('Denied')}})})
    await assert.rejects(ensureNodePromptFile(f.root, 'Keep this draft'), /Denied/)
    assert.equal(f.root.prompts.repository, null)
})

test('a model without a location gives an actionable error', async () => {
    await assert.rejects(ensureNodePromptFile(new GroupNode(null, 'Root', 'root'), ''), /Save the model/)
})

test('explicit save removes an unused empty file and both raw and live references', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, '')
    const raw = f.raw()
    await f.model.savePromptRepos()
    assert.equal((await arl.readPromptFile()).exists, false)
    assert.equal(raw.promptRepo, undefined)
    assert.equal(f.root.prompts.repository, null)
    const reopened = await ensureNodePromptFile(f.root, 'New draft')
    assert.equal(await reopened.arl.get(), 'New draft')
})

test('empty scaffolding is disposable but actual headings and pin content are not', () => {
    const node = {name: 'Root', interfaces: [{pins: [{name: 'input'}]}]}
    assert.equal(isEmptyPromptDocument(' \n\t', node), true)
    assert.equal(isEmptyPromptDocument(serializePromptMarkdown(node), node), true)
    for (const text of ['# Notes', '<!-- keep -->', serializePromptMarkdown(node) + '\nActual content']) {
        assert.equal(isEmptyPromptDocument(text, node), false)
    }
    node.interfaces[0].pins[0].prompt = 'Pin guidance'
    assert.equal(isEmptyPromptDocument(serializePromptMarkdown(node), node), false)
})

test('saved model JSON omits cleaned references and subsequent saves do not recreate them', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, '')
    f.raw()
    f.model.raw.header = {version: '1.12.2'}
    await f.model.saveRaw()
    const saved = await f.model.getArl().get('json')
    assert.equal(saved.root.promptRepo, undefined)
    assert.equal((await arl.readPromptFile()).exists, false)
    f.raw()
    f.model.raw.header = {version: '1.12.2'}
    await f.model.saveRaw()
    assert.equal((await arl.readPromptFile()).exists, false)
})

test('an empty disk file does not discard nonempty in-memory prompt content', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, 'Keep these notes')
    await arl.save('')
    f.raw()
    await f.model.savePromptRepos()
    assert.equal((await arl.readPromptFile()).exists, true)
    assert.equal(f.root.prompts.prompt, 'Keep these notes')
    assert.ok(f.root.prompts.repository)
})

test('popup drafts and backup saves protect an empty file', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, '')
    f.root.prompts.readDraft = () => 'Typing in popup'
    f.raw()
    await f.model.savePromptRepos()
    assert.equal((await arl.readPromptFile()).exists, true)
    f.root.prompts.readDraft = null
    await f.model.savePromptRepos(undefined, {cleanupPrompts: false})
    assert.equal((await arl.readPromptFile()).exists, true)
})

test('disk edits and unsaved full-editor edits protect files during cleanup', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, '')
    await arl.save('External notes')
    f.raw()
    await f.model.savePromptRepos()
    assert.equal(await arl.get(), 'External notes')
    await arl.save('')
    const resolve = f.model.getArl().resolve.bind(f.model.getArl())
    f.model.getArl().resolve = value => {
        const target = resolve(value)
        const read = target.readPromptFile.bind(target)
        target.readPromptFile = async () => ({...await read(), dirty: true})
        return target
    }
    await f.model.savePromptRepos()
    assert.equal((await arl.readPromptFile()).exists, true)
})

test('clearing a prompt removes the file only if its disk version is unchanged', async t => {
    const f = await fixture(t)
    const {arl} = await ensureNodePromptFile(f.root, 'Old notes')
    applyNodePromptDocument(f.root, '')
    f.raw()
    await f.model.savePromptRepos()
    assert.equal((await arl.readPromptFile()).exists, false)
    await ensureNodePromptFile(f.root, 'More notes')
    applyNodePromptDocument(f.root, '')
    f.raw()
    await arl.save('External update')
    await assert.rejects(f.model.savePromptRepos(), /changed outside vmblu/)
    assert.equal(await arl.get(), 'External update')
    assert.equal(getPromptRepoRuntimeState(f.root.prompts.repository).dirty, true)
})
