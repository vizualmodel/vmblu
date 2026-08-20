import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {profile} from '../commands/profile/profile.bundle.js'
import {verifyProject} from '../commands/verify/index.js'

test('profile discovers source files from a canonical string factory index', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-profile-factories-'))

    try {
        const modelPath = path.join(dir, 'sample.mod.blu')
        const sourcePath = path.join(dir, 'nodes.js')
        const outputPath = path.join(dir, 'sample.src.prf')
        const raw = {
            header: {
                version: '1.10.0',
                created: '2026-08-05T00:00:00.000Z',
                saved: '2026-08-05T00:00:00.000Z',
                utc: '2026-08-05T00:00:00.000Z',
                runtime: '@vizualmodel/vmblu-runtime/rt-base'
            },
            factories: ['./nodes.js'],
            root: {kind: 'group', name: 'Root', nodes: []}
        }
        const source = `
/** @node Profile Node */
export function createProfileNode() {
    function onInput() {}
    return {onInput}
}
`
        await writeFile(modelPath, JSON.stringify(raw))
        await writeFile(modelPath.replace('.blu', '.viz'), JSON.stringify({
            header: {
                version: raw.header.version,
                created: raw.header.created,
                saved: raw.header.saved,
                utc: raw.header.utc,
                style: '#202020'
            },
            root: {kind: 'group', name: 'Root', nodes: []}
        }))
        await writeFile(sourcePath, source)

        await profile([modelPath, '--out', outputPath, '--full'])

        const output = JSON.parse(await readFile(outputPath, 'utf8'))
        assert.ok(output.entries.some(entry => entry.node === 'Profile Node'))
        assert.equal(output.generatedAt, undefined)
        assert.equal(output.provenance.compatibilityFamily, '1.10')
        assert.equal(output.provenance.artifact, 'source-profile')
        const verification = await verifyProject(modelPath)
        assert.equal(verification.ok, true, verification.failures.join('\n'))
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})
