import test from 'node:test'
import assert from 'node:assert/strict'
import {LARL} from '../types/arl/arl-local.js'
import {registerFileDraft} from '../types/arl/file-drafts.js'

function fixture() {
    const files = new Map()
    const missing = () => {throw new DOMException('Missing', 'NotFoundError')}
    const directory = prefix => ({
        kind: 'directory',
        async getDirectoryHandle(name) { return directory(prefix + name + '/') },
        async getFileHandle(name, {create = false} = {}) {
            const key = prefix + name
            if (!files.has(key)) {
                if (!create) missing()
                files.set(key, '')
            }
            return {
                async getFile() {
                    if (!files.has(key)) missing()
                    return {text: async () => files.get(key), size: files.get(key).length}
                },
                async createWritable() {
                    return {write: async text => files.set(key, text), close: async () => {}}
                },
            }
        },
        async removeEntry(name) { files.delete(prefix + name) },
    })
    const arl = new LARL('./prompts/Root.md')
    arl.setFileSystem({arl: {handle: directory('')}}, '/prompts/Root.md')
    return {arl, files}
}

test('browser file adapter creates, preserves and removes empty prompt files', async () => {
    const {arl, files} = fixture()
    assert.equal((await arl.createPromptFile('')).created, true)
    assert.equal((await arl.createPromptFile('Other')).created, false)
    assert.equal(files.get('prompts/Root.md'), '')
    assert.equal(await arl.removePromptFile(''), true)
    assert.equal(files.has('prompts/Root.md'), false)
    assert.equal((await arl.createPromptFile('Recreated')).created, true)
    assert.equal(files.get('prompts/Root.md'), 'Recreated')
})

test('browser cleanup checks live full-editor state, including resolved copies', async () => {
    const {arl, files} = fixture()
    await arl.createPromptFile('')
    let dirty = true
    const release = registerFileDraft(arl.copy(), () => dirty)
    try {
        assert.equal(await arl.removePromptFile(''), false)
        assert.equal(files.has('prompts/Root.md'), true)
        dirty = false
        assert.equal(await arl.removePromptFile(''), true)
    } finally { release() }
})

test('browser file creation reports failed writes', async () => {
    const {arl} = fixture()
    arl.save = async () => null
    await assert.rejects(arl.createPromptFile('Draft'), /could not be created/)
})
