import path from 'node:path'

import {
    createAppTestArtifact,
    createGroupTestArtifact,
    createNodeTestArtifact,
    loadAppTestContext,
    loadGroupTestContext,
    loadNodeTestContext,
    testArtifactPath,
    writeJson,
} from '../../lib/model-test-artifact.js'
import {SCHEMA_VERSION} from '../../lib/release-version.js'
import {validateWithSchema} from '../../lib/schema-validation.js'

export const command = 'make-test <node|group|app> <model-file>'
export const describe = 'Generate formal model-test artifacts from Markdown test specifications'

export const builder = [
    {flag: '--node <name-path>', desc: 'node name path; repeat to generate tests for several nodes'},
    {flag: '--group <name-path>', desc: 'group name path'},
]

export async function makeNodeTests(modelFile, nodePaths) {
    const schemaFile = modelTestSchema()
    const results = []

    for (const nodePath of nodePaths) {
        const context = await loadNodeTestContext(modelFile, nodePath)
        assertWritableTestRepo(context)
        const artifact = createNodeTestArtifact(context)
        if (!artifact) {
            results.push({node: context.parts.join('/'), status: 'skipped', reason: 'no tests specified'})
            continue
        }

        validateWithSchema(artifact, schemaFile, `node test for '${context.parts.join('/')}'`)
        const file = testArtifactPath(context)
        writeJson(file, artifact)
        results.push({node: context.parts.join('/'), status: 'written', file})
    }

    return results
}

export async function makeGroupTest(modelFile, groupPath) {
    const context = await loadGroupTestContext(modelFile, groupPath)
    assertWritableTestRepo(context)
    const artifact = createGroupTestArtifact(context)
    if (!artifact) return {target: context.parts.join('/'), status: 'skipped', reason: 'no tests specified'}
    validateWithSchema(artifact, modelTestSchema(), `group test for '${context.parts.join('/')}'`)
    const file = testArtifactPath(context)
    writeJson(file, artifact)
    return {target: context.parts.join('/'), status: 'written', file}
}

export async function makeAppTest(modelFile) {
    const context = await loadAppTestContext(modelFile)
    assertWritableTestRepo(context)
    const artifact = createAppTestArtifact(context)
    if (!artifact) return {target: context.root.name, status: 'skipped', reason: 'no tests specified'}
    validateWithSchema(artifact, modelTestSchema(), `application test for '${context.root.name}'`)
    const file = testArtifactPath(context)
    writeJson(file, artifact)
    return {target: context.root.name, status: 'written', file}
}

export const handler = async argv => {
    const args = parseArgs(argv)
    if (!args.modelFile) throw usageError()
    let results
    if (args.kind === 'node' && args.nodePaths.length && !args.groupPath) {
        results = await makeNodeTests(args.modelFile, args.nodePaths)
    }
    else if (args.kind === 'group' && args.groupPath && !args.nodePaths.length) {
        results = [await makeGroupTest(args.modelFile, args.groupPath)]
    }
    else if (args.kind === 'app' && !args.groupPath && !args.nodePaths.length) {
        results = [await makeAppTest(args.modelFile)]
    }
    else throw usageError()

    for (const result of results) {
        if (result.status === 'written') console.log(`Model test written to ${path.relative(process.cwd(), result.file)}`)
        else console.log(`No tests defined for ${result.node ?? result.target}; nothing written.`)
    }
    return results
}

function parseArgs(argv=[]) {
    const result = {kind: null, modelFile: null, nodePaths: [], groupPath: null}
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index]
        if (token === '--node') {
            const value = argv[++index]
            if (!value || value.startsWith('-')) throw new Error('--node requires a node name path')
            result.nodePaths.push(value)
        }
        else if (token === '--group') {
            const value = argv[++index]
            if (!value || value.startsWith('-')) throw new Error('--group requires a group name path')
            result.groupPath = value
        }
        else if (String(token).startsWith('-')) throw new Error(`Unknown make-test option: ${token}`)
        else if (!result.kind) result.kind = token
        else if (!result.modelFile) result.modelFile = token
        else throw new Error(`Unexpected make-test argument: ${token}`)
    }
    return result
}

function modelTestSchema() {
    return new URL(`../../context/${SCHEMA_VERSION}/model-test.schema.json`, import.meta.url)
}

function assertWritableTestRepo(context) {
    if (context.testRepoReadOnly) {
        throw new Error(`Test specification for '${context.parts.join('/') || context.root.name}' is owned by a linked model and is read-only`)
    }
}

function usageError() {
    return new Error(
        'Usage: vmblu make-test node <model-file> --node <name-path> [--node <name-path> ...]\n' +
        '       vmblu make-test group <model-file> --group <name-path>\n' +
        '       vmblu make-test app <model-file>',
    )
}
