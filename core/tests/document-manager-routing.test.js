import test from 'node:test'
import assert from 'node:assert/strict'

import {DocumentManager} from '../nodes/document-manager/document-manager.js'
import {TextDocument} from '../nodes/document-manager/document.js'

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

test('document manager routes non-blueprint files to the text editor', () => {
    const {value, sent} = manager()
    const doc = value.makeDocument(arl('/repo/src/index.js'), 17)

    assert.ok(doc instanceof TextDocument)
    assert.equal(doc.kind, 'text')
    assert.equal(doc.line, 17)

    value.activateDocument(doc)
    assert.deepEqual(sent.map(({pin}) => pin), ['doc.set active', 'text.set active'])
    assert.equal(sent[0].payload, null)
    assert.equal(sent[1].payload, doc)
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

    await value.onDocSelected(textArl)
    assert.equal(sent[0].pin, 'file.loading')
    assert.equal(sent.at(-2).pin, 'doc.set active')
    assert.equal(sent.at(-1).pin, 'text.set active')

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
})
