import test from 'node:test'
import assert from 'node:assert/strict'

import {ARL, ReadOnlyResourceError} from '../types/arl/arl.js'

test('browser ARL preserves read-only access through resolve and copy', async () => {
    const entrypoint = new ARL('/vmblu-examples/solar-system/solar-system.blu')
        .absolute('https://raw.githubusercontent.com/vizualmodel/vmblu-examples/main/solar-system/solar-system.blu')
        .setReadOnly()

    const model = entrypoint.resolve('model/solar-system.mod.blu')
    const copy = model.copy()

    assert.equal(entrypoint.canWrite(), false)
    assert.equal(model.canWrite(), false)
    assert.equal(copy.canWrite(), false)
    assert.equal(model.url.href, 'https://raw.githubusercontent.com/vizualmodel/vmblu-examples/main/solar-system/model/solar-system.mod.blu')

    await assert.rejects(
        model.save('{}'),
        (error) => error instanceof ReadOnlyResourceError && error.code === 'ERR_ARL_READ_ONLY'
    )
})
