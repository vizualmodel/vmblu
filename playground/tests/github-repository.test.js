import test from 'node:test'
import assert from 'node:assert/strict'

import {GitHubRepositoryProvider, playgroundGitHubRepository} from '../nodes/workspace/github-repository.js'

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
    assert.equal(entrypoint.getPath(), '/vmblu-tutorials/solar-system/solar-system.blu')
    assert.equal(entrypoint.url.href, 'https://raw.githubusercontent.com/vizualmodel/vmblu-tutorials/main/solar-system/solar-system.blu')
})

test('Playground mounts only its folder while retaining repository-relative URLs', async () => {
    const storage = memoryStorage()
    const fetch = async () => ({ok: true, json: async () => ({tree: [
        {path: 'playground/playground.blu', type: 'blob'},
        {path: 'playground/model/playground.mod.blu', type: 'blob'},
        {path: 'core/core.blu', type: 'blob'},
        {path: 'playground-other/unrelated.blu', type: 'blob'}
    ]})})
    const provider = new GitHubRepositoryProvider(playgroundGitHubRepository, {fetch, storage})
    const folder = await provider.getTree()
    assert.equal(folder.name, 'playground')
    assert.equal(folder.path, 'playground')
    assert.deepEqual(folder.folders.map(child => child.name), ['model'])
    assert.deepEqual(folder.files.map(file => file.name), ['playground.blu'])
    const entrypoint = provider.createArl(folder.files[0].path)
    assert.equal(entrypoint.getPath(), '/vmblu/playground/playground.blu')
    assert.equal(entrypoint.url.href, 'https://raw.githubusercontent.com/vizualmodel/vmblu/main/playground/playground.blu')
    assert.equal(entrypoint.resolve('../core/core.blu').url.href, 'https://raw.githubusercontent.com/vizualmodel/vmblu/main/core/core.blu')
    assert.equal(entrypoint.resolve('../core/core.blu').canWrite(), false)
    const missing = new GitHubRepositoryProvider({...playgroundGitHubRepository, path: 'missing'}, {fetch, storage})
    await assert.rejects(missing.getTree(), /folder not found/)
    const tutorials = new GitHubRepositoryProvider({}, {fetch, storage})
    assert.notEqual(provider.cacheKey, tutorials.cacheKey)
})
