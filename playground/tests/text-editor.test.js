import test from 'node:test'
import assert from 'node:assert/strict'

import {isTextFile, languageForFile} from '../nodes/text-editor/text-editor.js'

test('text editor accepts source and documentation files but rejects binary assets', () => {
    assert.equal(isTextFile('src/index.js'), true)
    assert.equal(isTextFile('README'), true)
    assert.equal(isTextFile('assets/earth.png'), false)
    assert.equal(isTextFile('manual.pdf'), false)
})

test('text editor selects language support without requiring file content', () => {
    assert.notDeepEqual(languageForFile('app.ts'), [])
    assert.notDeepEqual(languageForFile('model.cap.json'), [])
    assert.deepEqual(languageForFile('LICENSE'), [])
})
