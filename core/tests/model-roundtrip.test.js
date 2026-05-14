import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint} from '../types/model/index.js'

test('model blueprint loads blu/viz and can be split and loaded again', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-core-model-'))

    try {
        const bluArl = new ARL(path.join(dir, 'sample.mod.blu'))
        const vizArl = bluArl.resolve('./sample.mod.viz')

        const bluRaw = {
            header: {
                version: 1,
                created: '2026-05-07T00:00:00.000Z',
                saved: '2026-05-07T00:00:00.000Z',
                utc: true,
                runtime: '@vizualmodel/vmblu-runtime/rt-base'
            },
            root: {
                kind: 'group',
                name: 'Root',
                nodes: []
            }
        }

        const vizRaw = {
            header: {
                version: 1,
                utc: true,
                style: 'rgb(32, 32, 32)'
            },
            root: {
                kind: 'group',
                name: 'Root',
                rect: '0 0 640 480',
                view: {
                    state: 'normal',
                    rect: '0 0 640 480',
                    transform: '0 0 1'
                },
                nodes: [],
                pads: [],
                buses: [],
                routes: []
            }
        }

        await bluArl.save(JSON.stringify(bluRaw, null, 2))
        await vizArl.save(JSON.stringify(vizRaw, null, 2))

        const model = new ModelBlueprint(bluArl)
        const raw = await model.getRaw()
        const split = model.splitRaw(raw)

        assert.equal(raw.header.style, 'rgb(32, 32, 32)')
        assert.equal(raw.root.name, 'Root')
        assert.deepEqual(split.blu.root.nodes ?? [], [])
        assert.deepEqual(split.viz.root.nodes ?? [], [])

        const nextBluArl = new ARL(path.join(dir, 'roundtrip.mod.blu'))
        const nextVizArl = nextBluArl.resolve('./roundtrip.mod.viz')
        await nextBluArl.save(JSON.stringify(split.blu, null, 2))
        await nextVizArl.save(JSON.stringify(split.viz, null, 2))

        const roundtrip = new ModelBlueprint(nextBluArl)
        const roundtripRaw = await roundtrip.getRaw()

        assert.equal(roundtripRaw.header.version, 1)
        assert.equal(roundtripRaw.header.style, 'rgb(32, 32, 32)')
        assert.equal(roundtripRaw.root.kind, 'group')
        assert.equal(roundtripRaw.root.name, 'Root')
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})
