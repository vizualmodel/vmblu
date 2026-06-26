import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {ARL} from '../types/arl/arl-node.js'
import {ModelBlueprint, ModelCompiler, UIDGenerator} from '../types/model/index.js'

test('model blueprint loads blu/viz and can be split and loaded again', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-core-model-'))

    try {
        const bluArl = new ARL(path.join(dir, 'sample.mod.blu'))
        const vizArl = bluArl.resolve('./sample.mod.viz')

        const bluRaw = {
            header: {
                version: '0.9.7',
                created: '2026-05-07T00:00:00.000Z',
                saved: '2026-05-07T00:00:00.000Z',
                utc: '2026-05-07T00:00:00.000Z',
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
                version: '0.9.7',
                utc: '2026-05-07T00:00:00.000Z',
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
        assert.deepEqual(raw.header.teams, {
            default: {
                color: '#0066ff'
            }
        })
        assert.equal(raw.root.name, 'Root')
        assert.deepEqual(split.blu.header.teams, {
            default: {
                color: '#0066ff'
            }
        })
        assert.deepEqual(split.blu.root.nodes ?? [], [])
        assert.deepEqual(split.viz.root.nodes ?? [], [])

        const nextBluArl = new ARL(path.join(dir, 'roundtrip.mod.blu'))
        const nextVizArl = nextBluArl.resolve('./roundtrip.mod.viz')
        await nextBluArl.save(JSON.stringify(split.blu, null, 2))
        await nextVizArl.save(JSON.stringify(split.viz, null, 2))

        const roundtrip = new ModelBlueprint(nextBluArl)
        const roundtripRaw = await roundtrip.getRaw()

        assert.equal(roundtripRaw.header.version, '0.9.7')
        assert.equal(roundtripRaw.header.style, 'rgb(32, 32, 32)')
        assert.deepEqual(roundtripRaw.header.teams, {
            default: {
                color: '#0066ff'
            }
        })
        assert.equal(roundtripRaw.root.kind, 'group')
        assert.equal(roundtripRaw.root.name, 'Root')
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})

test('model blueprint preserves teams and node team assignments', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-core-teams-'))

    try {
        const bluArl = new ARL(path.join(dir, 'teams.mod.blu'))
        const vizArl = bluArl.resolve('./teams.mod.viz')

        const bluRaw = {
            header: {
                version: '0.9.7',
                created: '2026-05-07T00:00:00.000Z',
                saved: '2026-05-07T00:00:00.000Z',
                utc: '2026-05-07T00:00:00.000Z',
                teams: {
                    default: {color: '#0066ff'},
                    ui: {color: '#facc15', description: 'User interface'}
                },
                runtime: '@vizualmodel/vmblu-runtime/rt-base'
            },
            root: {
                kind: 'group',
                name: 'Root',
                team: 'ui',
                nodes: [
                    {
                        kind: 'source',
                        name: 'Patient Form',
                        team: 'ui',
                        factory: {
                            path: './index.js',
                            function: 'PatientForm'
                        }
                    },
                    {
                        kind: 'source',
                        name: 'Session Store',
                        factory: {
                            path: './index.js',
                            function: 'SessionStore'
                        }
                    }
                ]
            }
        }

        const vizRaw = {
            header: {
                version: '0.9.7',
                utc: '2026-05-07T00:00:00.000Z',
                style: '#334455'
            },
            root: {
                kind: 'group',
                name: 'Root',
                rect: '0 0 640 480',
                nodes: [
                    {
                        kind: 'source',
                        name: 'Patient Form',
                        rect: '10 10 150 41'
                    },
                    {
                        kind: 'source',
                        name: 'Session Store',
                        rect: '200 10 150 41'
                    }
                ]
            }
        }

        await bluArl.save(JSON.stringify(bluRaw, null, 2))
        await vizArl.save(JSON.stringify(vizRaw, null, 2))

        const model = new ModelBlueprint(bluArl)
        const raw = await model.getRaw()
        model.preCook()

        assert.equal(raw.header.teams.ui.color, '#facc15')
        assert.equal(raw.header.teams.ui.description, 'User interface')
        assert.equal(raw.root.team, 'ui')
        assert.equal(raw.root.nodes[0].team, 'ui')
        assert.equal(raw.root.nodes[1].team, undefined)

        const compiler = new ModelCompiler(new UIDGenerator())
        const root = compiler.compileRawNode(model, raw.root)
        assert.equal(root.team, 'ui')
        assert.equal(root.nodes[0].team, 'ui')
        assert.equal(root.nodes[1].team, null)
        assert.equal(root.resolveTeamStyle().rgb, '#facc15')
        assert.equal(root.nodes[0].resolveTeamStyle().rgb, '#facc15')
        assert.equal(root.nodes[1].resolveTeamStyle().rgb, '#0066ff')

        const split = model.splitRaw(raw)
        assert.deepEqual(split.blu.header.teams, bluRaw.header.teams)
        assert.equal(split.blu.root.team, 'ui')
        assert.equal(split.blu.root.nodes[0].team, 'ui')
        assert.equal(split.blu.root.nodes[1].team, undefined)
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})
