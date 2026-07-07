import test from 'node:test'
import assert from 'node:assert/strict'

const publicModules = [
    '../types/arl/index.js',
    '../types/model/index.js',
    '../types/elk/index.js',
    '../types/node/index.js',
    '../types/util/index.js',
    '../types/view/index.js',
    '../types/widget/index.js',
    '../nodes/model-manager/model-manager.js',
    '../nodes/document-manager/document-manager.js',
    '../nodes/library-manager/library-manager.js',
]

test('public core modules can be imported', async () => {
    for (const modulePath of publicModules) {
        const module = await import(modulePath)
        assert.ok(module, `expected ${modulePath} to import`)
    }
})
