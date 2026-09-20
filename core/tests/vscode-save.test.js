import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import {ModelBlueprint} from '../types/model/blueprint.js'
import {ModelManager} from '../nodes/model-manager/model-manager.js'

// Run the actual host and webview modules together, replacing only VS Code
// and the in-process transport. File writes use a real temporary directory.
async function load(relative, imports, globals = {}) {
    const source = await fs.readFile(new URL(relative, import.meta.url), 'utf8')
    const code = ts.transpileModule(source, {compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    }}).outputText
    const exports = {}
    vm.runInNewContext(code, {exports, require: name => imports[name] ?? {},
        console: {error() {}, log() {}}, TextEncoder, TextDecoder, URL, ...globals})
    return exports
}

async function fixture(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vmblu-save-'))
    t.after(() => fs.rm(dir, {recursive: true, force: true}))
    const uri = p => ({scheme: 'file', path: p, fsPath: p, toString: () => pathToFileURL(p).href})
    const messages = []
    const errors = []
    const control = {beforeWrite: async () => {}}
    const vscode = {
        Uri: {parse: s => uri(fileURLToPath(s)), joinPath: (u, ...parts) => uri(path.resolve(u.fsPath, ...parts))},
        EventEmitter: class {event() {} dispose() {} fire() {}},
        window: {showErrorMessage: error => errors.push(error)},
        workspace: {textDocuments: [], fs: {
            createDirectory: u => fs.mkdir(u.fsPath, {recursive: true}),
            readFile: u => fs.readFile(u.fsPath),
            delete: u => fs.unlink(u.fsPath),
            writeFile: async (u, bytes) => {await control.beforeWrite(u.fsPath); await fs.writeFile(u.fsPath, bytes)},
        }},
    }
    const hostModule = await load('../../vscodex/extension/document-model.ts', {vscode})
    await load('../../vscodex/extension/document-broker.ts', {
        vscode, 'fs/promises': fs, './document-model.js': hostModule,
    })
    const host = new hostModule.VmbluDocument(uri(path.join(dir, 'model.mod.blu')))
    const adapter = await load('../../vscodex/webview/arl-adapter.js', {}, {
        acquireVsCodeApi: () => ({postMessage: message => {void host.onMessage(message)}}),
    })
    const {messageBrokerVscode} = await load('../../vscodex/webview/message-broker-vscode.js', {
        './arl-adapter.js': adapter,
    })
    const model = new ModelBlueprint()
    const arl = p => ({
        url: pathToFileURL(p).href, getPath: () => p, getFullPath: () => p,
        resolve: relative => arl(path.resolve(path.dirname(p), relative)),
        get: () => fs.readFile(p, 'utf8'),
        save: body => adapter.requestVsCode('HTTP-POST', {arl: {url: pathToFileURL(p).href}, bytes: new TextEncoder().encode(body)}),
    })
    model.blu.arl = arl(path.join(dir, 'model.mod.blu'))
    model.viz.arl = arl(path.join(dir, 'model.mod.viz'))
    const raw = {header: {version: '1.12.2'}, root: {kind: 'group', name: 'Root', nodes: [], prompt: 'My complete application prompt.\nUnicode: ☀️'}}
    const manager = Object.create(ModelManager.prototype)
    Object.assign(manager, {model, modcom: {reset() {}, encode: () => raw}, getNodeToSave: () => ({})})
    const webview = {tx: {send: (_pin, payload) => {void manager.onModelSave(payload)}}}
    host.panel = {webview: {postMessage: message => {
        messages.push(message)
        void messageBrokerVscode.onMessage.call(webview, {data: message})
    }}}
    return {host, model, dir, raw, control, messages, errors, adapter, vscode}
}

test('save acknowledgement waits for disk writes; immediately reopening recovers the prompt', async t => {
    const f = await fixture(t)
    let release, started
    const gate = new Promise(resolve => {release = resolve})
    const entered = new Promise(resolve => {started = resolve})
    f.control.beforeWrite = async p => {if (p.endsWith('Root.md')) {started(); await gate}}
    let saved = false
    const saving = f.host.save({isCancellationRequested: false}).then(() => {saved = true})
    await entered
    assert.equal(saved, false)
    await assert.rejects(fs.stat(path.join(f.dir, 'model.mod.blu')), {code: 'ENOENT'})
    release()
    await saving
    const persisted = JSON.parse(await fs.readFile(path.join(f.dir, 'model.mod.blu'), 'utf8'))
    assert.equal(persisted.root.prompt, undefined)
    const reopened = new ModelBlueprint()
    reopened.blu.arl = f.model.blu.arl
    reopened.raw = persisted
    await reopened.hydratePromptRepos()
    assert.equal(reopened.raw.root.prompt, 'My complete application prompt.\nUnicode: ☀️')
    assert.equal(f.errors.length, 0)
    assert.equal(f.adapter.promiseMap.size, 0)
})

test('prompt write failure rejects host save, preserves text and supports retry', async t => {
    const f = await fixture(t)
    f.control.beforeWrite = async () => {throw new Error('Disk full')}
    await assert.rejects(f.host.save({}), /Disk full/)
    assert.match(f.errors[0], /Disk full/)
    await assert.rejects(fs.stat(path.join(f.dir, 'model.mod.blu')), {code: 'ENOENT'})
    f.control.beforeWrite = async () => {}
    await f.host.save({})
    assert.match(await fs.readFile(path.join(f.dir, 'prompts/Root.md'), 'utf8'), /My complete application prompt/)
    assert.equal(f.adapter.promiseMap.size, 0)
})

test('model write failure also rejects save after safely writing the prompt', async t => {
    const f = await fixture(t)
    f.control.beforeWrite = async p => {if (p.endsWith('.mod.blu')) throw new Error('Model write denied')}
    await assert.rejects(f.host.save({}), /Model write denied/)
    assert.match(await fs.readFile(path.join(f.dir, 'prompts/Root.md'), 'utf8'), /My complete application prompt/)
    f.control.beforeWrite = async () => {}
    await f.host.save({})
    assert.equal(f.adapter.promiseMap.size, 0)
})

test('prompt file requests create once and protect dirty VS Code editors during cleanup', async t => {
    const f = await fixture(t)
    const target = path.join(f.dir, 'prompts/New.md')
    const url = pathToFileURL(target).href
    const request = (action, extra = {}) => f.adapter.requestVsCode('prompt file', {arl: {url}, action, ...extra})
    assert.equal((await request('create', {text: ''})).created, true)
    assert.equal((await request('create', {text: 'Do not overwrite'})).created, false)
    assert.equal(await fs.readFile(target, 'utf8'), '')
    f.vscode.workspace.textDocuments.push({uri: {toString: () => url}, isDirty: true})
    assert.equal((await request('read')).dirty, true)
    assert.equal(await request('remove', {expected: ''}), false)
    f.vscode.workspace.textDocuments[0].isDirty = false
    await fs.writeFile(target, 'External notes')
    assert.equal(await request('remove', {expected: ''}), false)
    await fs.writeFile(target, '')
    assert.equal(await request('remove', {expected: ''}), true)
    await assert.rejects(fs.stat(target), {code: 'ENOENT'})
    assert.equal(f.adapter.promiseMap.size, 0)
})

test('prompt read failures are errors, never permission to overwrite', async t => {
    const f = await fixture(t)
    f.vscode.workspace.fs.readFile = async () => {throw new Error('Permission denied')}
    await assert.rejects(f.adapter.requestVsCode('prompt file', {
        arl: {url: pathToFileURL(path.join(f.dir, 'private.md')).href}, action: 'create', text: '',
    }), /Permission denied/)
})
