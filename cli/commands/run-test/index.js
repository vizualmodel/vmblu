import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

import {
    assertArtifactCurrent,
    factoryDescriptor,
    loadAppTestContext,
    loadGroupTestContext,
    loadNodeTestContext,
    routedTargetDescriptor,
    testArtifactPath,
    testReportPath,
    writeJson,
} from '../../lib/model-test-artifact.js'
import {sourceHash} from '@vizualmodel/vmblu-core/types/model'
import {SCHEMA_VERSION} from '../../lib/release-version.js'
import {validateWithSchema} from '../../lib/schema-validation.js'
import {compatibilityFamily} from '../../lib/version-policy.js'
import {runBrowserModelTest} from '../../lib/browser-model-test.js'

export const command = 'run-test <node|group|app> <model-file>'
export const describe = 'Run a formal node, group, or application model test'

export const builder = [
    {flag: '--node <name-path>', desc: 'source-node name path'},
    {flag: '--group <name-path>', desc: 'group name path'},
    {flag: '--scenario <id>', desc: 'run only one scenario'},
]

export async function runNodeTest(modelFile, nodePath, options={}) {
    const context = await loadNodeTestContext(modelFile, nodePath)
    return runTargetTest(context, options)
}

export async function runGroupTest(modelFile, groupPath, options={}) {
    const context = await loadGroupTestContext(modelFile, groupPath)
    return runTargetTest(context, options)
}

export async function runAppTest(modelFile, options={}) {
    const context = await loadAppTestContext(modelFile)
    return runTargetTest(context, options)
}

async function runTargetTest(context, {scenarioId=null}={}) {
    if (context.testRepoReadOnly) {
        throw new Error(`Test specification for '${context.parts.join('/') || context.root.name}' is owned by a linked model and is read-only`)
    }
    const testFile = testArtifactPath(context)
    const reportFile = testReportPath(context)
    if (!fs.existsSync(testFile)) {
        const kind = context.scope === 'model' ? 'app' : context.scope
        throw new Error(`Model test artifact not found: ${testFile}. Run 'vmblu make-test ${kind}' first.`)
    }

    const artifact = JSON.parse(fs.readFileSync(testFile, 'utf8'))
    const artifactHash = sourceHash(artifact)
    const testSchema = new URL(`../../context/${SCHEMA_VERSION}/model-test.schema.json`, import.meta.url)
    validateWithSchema(artifact, testSchema, `model test '${testFile}'`)
    assertArtifactCurrent(artifact, context)

    if (scenarioId) {
        artifact.scenarios = artifact.scenarios.filter(scenario => scenario.id === scenarioId)
        if (!artifact.scenarios.length) throw new Error(`Scenario '${scenarioId}' was not found in ${testFile}`)
    }

    const relativeTestPath = path.relative(context.projectRoot, testFile).replaceAll('\\', '/')
    let report
    if (artifact.host === 'browser') {
        report = await runBrowserModelTest(context, artifact, {testPath: relativeTestPath})
    }
    else {
        const runtimeOptions = await targetRuntimeOptions(context)
        const {runModelTests} = await import('@vizualmodel/vmblu-runtime/rt-model-test')
        report = await runModelTests({artifact, testPath: relativeTestPath, ...runtimeOptions})
    }
    report.artifactHash = artifactHash

    const reportSchema = new URL(`../../context/${SCHEMA_VERSION}/test-report.schema.json`, import.meta.url)
    validateWithSchema(report, reportSchema, 'model test report')
    writeJson(reportFile, report)
    return {report, reportFile, testFile}
}

async function targetRuntimeOptions(context) {
    if (context.scope === 'node') {
        const descriptor = factoryDescriptor(context)
        const factoryModule = await import(pathToFileURL(descriptor.path).href)
        const factory = factoryModule[descriptor.functionName]
        if (typeof factory !== 'function') throw new Error(`Factory '${descriptor.functionName}' is not exported by ${descriptor.path}`)
        return {...descriptor, factory}
    }

    const descriptor = await routedTargetDescriptor(context)
    const runtimeSpecifier = context.model.raw.header.runtime ?? '@vizualmodel/vmblu-runtime/rt-base'
    const runtimeModule = await import(runtimeSpecifier)
    return {
        ...descriptor,
        Runtime: runtimeModule.Runtime,
        runtimeOptions: {
            vmblu: {compatibilityFamily: compatibilityFamily(context.model.raw.header.version)},
            runtimeSettings: context.model.raw.header.runtimeSettings ?? null,
        },
    }
}

export const handler = async argv => {
    const args = parseArgs(argv)
    if (!args.modelFile) throw usageError()

    let result
    if (args.kind === 'node' && args.nodePath && !args.groupPath) {
        result = await runNodeTest(args.modelFile, args.nodePath, {scenarioId: args.scenarioId})
    }
    else if (args.kind === 'group' && args.groupPath && !args.nodePath) {
        result = await runGroupTest(args.modelFile, args.groupPath, {scenarioId: args.scenarioId})
    }
    else if (args.kind === 'app' && !args.nodePath && !args.groupPath) {
        result = await runAppTest(args.modelFile, {scenarioId: args.scenarioId})
    }
    else throw usageError()

    const {summary} = result.report
    console.log(`Model tests: ${result.report.status} (${summary.passed}/${summary.total} passed)`)
    console.log(`Report written to ${path.relative(process.cwd(), result.reportFile)}`)
    if (result.report.status !== 'passed') process.exitCode = 1
    return result
}

function parseArgs(argv=[]) {
    const result = {kind: null, modelFile: null, nodePath: null, groupPath: null, scenarioId: null}
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index]
        if (token === '--node' || token === '--group' || token === '--scenario') {
            const value = argv[++index]
            if (!value || value.startsWith('-')) throw new Error(`${token} requires a value`)
            if (token === '--node') result.nodePath = value
            else if (token === '--group') result.groupPath = value
            else result.scenarioId = value
        }
        else if (String(token).startsWith('-')) throw new Error(`Unknown run-test option: ${token}`)
        else if (!result.kind) result.kind = token
        else if (!result.modelFile) result.modelFile = token
        else throw new Error(`Unexpected run-test argument: ${token}`)
    }
    return result
}

function usageError() {
    return new Error(
        'Usage: vmblu run-test node <model-file> --node <name-path> [--scenario <id>]\n' +
        '       vmblu run-test group <model-file> --group <name-path> [--scenario <id>]\n' +
        '       vmblu run-test app <model-file> [--scenario <id>]',
    )
}
