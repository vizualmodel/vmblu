import test from 'node:test'
import assert from 'node:assert/strict'

import {DocumentManager} from '../nodes/document-manager/document-manager.js'
import {SystemDocument, TextDocument} from '../nodes/document-manager/document.js'

function arl(path, href = `https://example.test${path}`) {
    return {
        url: new URL(href),
        getPath: () => path,
        getFullPath: () => path,
        getName: () => path.split('/').at(-1),
        equals(other) { return this.url.href === other?.url?.href }
    }
}

function manager() {
    const sent = []
    const value = Object.create(DocumentManager.prototype)
    value.tx = {send: (pin, payload) => sent.push({pin, payload})}
    value.documents = []
    value.active = null
    value.loading = null
    value.loadingSequence = 0
    return {value, sent}
}

test('document manager opens explicit HTTP references outside the text editor', async () => {
    const {value, sent} = manager()
    const opened = []
    value.openExternal = (...args) => opened.push(args)

    await value.onFileOpen({externalUrl: 'https://developers.openai.com/api/reference/overview'})

    assert.deepEqual(opened, [['https://developers.openai.com/api/reference/overview', '_blank', 'noopener,noreferrer']])
    assert.equal(value.loading, null)
    assert.equal(sent.length, 0)
})

test('document manager routes non-blueprint files to the text editor', () => {
    const {value, sent} = manager()
    const doc = value.makeDocument(arl('/repo/src/index.js'), 17)

    assert.ok(doc instanceof TextDocument)
    assert.equal(doc.kind, 'text')
    assert.equal(doc.line, 17)

    value.activateDocument(doc)
    assert.deepEqual(sent.map(({pin}) => pin), ['model.set active', 'text.set active', 'sysblu.set active'])
    assert.equal(sent[0].payload, null)
    assert.equal(sent[1].payload, doc)
    assert.equal(sent[2].payload, null)
})

test('document manager resolves system entrypoints and classifies sysblu documents', async () => {
    const {value} = manager()
    const systemArl = arl('/repo/system/chat-application.sys.blu')
    const entrypointArl = arl('/repo/chat-application.sys')
    entrypointArl.get = async format => {
        assert.equal(format, 'json')
        return {
            kind: 'sysblu.entrypoint',
            version: 1,
            system: 'system/chat-application.sys.blu',
        }
    }
    entrypointArl.resolve = path => {
        assert.equal(path, 'system/chat-application.sys.blu')
        return systemArl
    }

    const resolved = await value.resolveDocumentArl(entrypointArl)
    const doc = value.makeDocument(resolved)

    assert.equal(resolved, systemArl)
    assert.ok(doc instanceof SystemDocument)
    assert.equal(doc.kind, 'sysblu')
    assert.equal(doc.getArl(), systemArl)
})

test('document manager activates only the sysblu editor for system documents', () => {
    const {value, sent} = manager()
    const doc = value.makeDocument(arl('/repo/system/chat-application.sys.blu'))

    value.activateDocument(doc)

    assert.deepEqual(sent.map(({pin}) => pin), ['model.set active', 'text.set active', 'sysblu.set active'])
    assert.equal(sent[0].payload, null)
    assert.equal(sent[1].payload, null)
    assert.equal(sent[2].payload, doc)
})

test('tab identity uses the full resource location', () => {
    const {value} = manager()
    const first = value.makeDocument(arl('/repo/a/index.js', 'https://example.test/repo/a/index.js'))
    const second = value.makeDocument(arl('/repo/b/index.js', 'https://example.test/repo/b/index.js'))

    assert.notEqual(first.getTabId(), second.getTabId())
    assert.equal(first.getName(), second.getName())
})

test('tab metadata keeps full identity separate from its short label', () => {
    const {value} = manager()
    const readOnly = arl('/repo/README.md')
    readOnly.canWrite = () => false
    const tab = value.makeDocument(readOnly).getTab()

    assert.equal(tab.id, 'https://example.test/repo/README.md')
    assert.equal(tab.label, 'README.md')
    assert.equal(tab.readOnly, true)
})

test('document manager owns loading lifecycle for text documents', async () => {
    const {value, sent} = manager()
    const textArl = arl('/repo/README.md')

    await value.onFileSelected(textArl)
    assert.equal(sent[0].pin, 'file.loading')
    assert.equal(sent.at(-3).pin, 'model.set active')
    assert.equal(sent.at(-2).pin, 'text.set active')
    assert.equal(sent.at(-1).pin, 'sysblu.set active')

    value.onTextLoaded(textArl)
    assert.equal(sent.at(-1).pin, 'file.loaded')
})

test('document loading failures are reported without completing a newer request', () => {
    const {value, sent} = manager()
    const first = arl('/repo/first.md')
    const second = arl('/repo/second.md')

    value.beginLoading(first)
    value.beginLoading(second)
    value.onTextFailed(first)
    assert.equal(value.loading, second)
    assert.equal(sent.filter(({pin}) => pin === 'file.failed').length, 0)

    value.onTextFailed(second)
    assert.equal(value.loading, null)
    assert.equal(sent.at(-1).pin, 'file.failed')
    assert.equal(sent.at(-1).payload, second)
})

test('save dispatch follows the active document kind', () => {
    const {value, sent} = manager()
    const text = value.makeDocument(arl('/repo/README.md'))

    value.active = text
    value.onFileSaveActive()
    assert.equal(sent.at(-1).pin, 'text.save')

    value.active = {kind: 'model'}
    value.onFileSaveActive()
    assert.equal(sent.filter(({pin}) => pin === 'text.save').length, 1)

    value.active = {kind: 'sysblu'}
    value.onFileSaveActive()
    assert.equal(sent.at(-1).pin, 'sysblu.save')
})

test('model Save As stays on the model interface after generic file handling', () => {
    const {value, sent} = manager()
    value.active = {
        kind: 'model',
        getTabId: () => 'old-model',
        model: {
            getArl: () => ({getPath: () => '/repo/model/example.mod.blu'}),
        },
    }

    value.onFileSaveAs({screenX: 20, screenY: 30})
    const request = sent.at(-1)
    assert.equal(request.pin, 'file.save as filename')

    request.payload.ok('/repo/model/example-copy.mod.blu')
    assert.deepEqual(sent.at(-2), {
        pin: 'model.save',
        payload: {path: '/repo/model/example-copy.mod.blu'},
    })
    assert.deepEqual(sent.at(-1), {
        pin: 'tab.rename',
        payload: {oldName: 'old-model', newName: '/repo/model/example-copy.mod.blu'},
    })
})

test('document manager completes the loading lifecycle from sysblu callbacks', () => {
    const {value, sent} = manager()
    const systemArl = arl('/repo/system/chat-application.sys.blu')

    value.beginLoading(systemArl)
    value.onSysbluLoaded(systemArl)
    assert.equal(value.loading, null)
    assert.equal(sent.at(-1).pin, 'file.loaded')

    value.beginLoading(systemArl)
    value.onSysbluFailed(systemArl)
    assert.equal(value.loading, null)
    assert.equal(sent.at(-1).pin, 'file.failed')
})
