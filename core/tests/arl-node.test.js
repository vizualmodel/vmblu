import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {ARL} from '../types/arl/arl-node.js'

test('node ARL reads, writes, resolves, and compares local files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-core-arl-'))

    try {
        const source = new ARL(path.join(dir, 'model.mod.blu'))
        const sibling = source.resolve('./model.mod.viz')

        assert.equal(source.getName(), 'model.mod.blu')
        assert.equal(sibling.getName(), 'model.mod.viz')
        assert.equal(source.sameDir(sibling), true)
        assert.equal(sibling.relativeTo(source), './model.mod.viz')

        const payload = {header: {version: 1}, root: {kind: 'group', name: 'Root'}}
        await source.save(JSON.stringify(payload))

        assert.deepEqual(await source.get('json'), payload)
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})
