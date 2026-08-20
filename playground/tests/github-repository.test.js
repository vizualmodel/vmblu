import test from 'node:test'
import assert from 'node:assert/strict'

import {GitHubRepositoryProvider} from '../nodes/workspace/github-repository.js'

function memoryStorage() {
    const items = new Map()
    return {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => items.set(key, value)
    }
}

test('GitHub provider creates a cached folder tree and read-only raw ARLs', async () => {
    let requests = 0
    const payload = {
        sha: 'abc123',
        truncated: false,
        tree: [
            {path: 'solar-system', type: 'tree'},
            {path: 'solar-system/solar-system.blu', type: 'blob', size: 120},
            {path: 'solar-system/model', type: 'tree'},
            {path: 'solar-system/model/solar-system.mod.blu', type: 'blob', size: 500}
        ]
    }
    const storage = memoryStorage()
    const fetch = async () => {
        requests += 1
        return {ok: true, status: 200, json: async () => payload, headers: {get: () => null}}
    }
    const provider = new GitHubRepositoryProvider({}, {fetch, storage})

    const first = await provider.getTree()
    const second = await provider.getTree()
    const entrypoint = provider.createArl('solar-system/solar-system.blu')

    assert.equal(requests, 1)
    assert.deepEqual(first, second)
    assert.equal(first.folders[0].name, 'solar-system')
    assert.equal(first.folders[0].files[0].name, 'solar-system.blu')
    assert.equal(entrypoint.canWrite(), false)
    assert.equal(entrypoint.getPath(), '/vmblu-examples/solar-system/solar-system.blu')
    assert.equal(entrypoint.url.href, 'https://raw.githubusercontent.com/vizualmodel/vmblu-examples/main/solar-system/solar-system.blu')
})
