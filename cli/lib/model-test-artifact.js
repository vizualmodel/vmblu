import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

import {ARL} from '@vizualmodel/vmblu-core/types/arl/arl-node'
import {normalizeSeparators} from '@vizualmodel/vmblu-core/types/arl/path'
import {ModelBlueprint, ModelCompiler, sourceHash, UIDGenerator} from '@vizualmodel/vmblu-core/types/model'

import {resolveEntrypoint} from './resolve-entrypoint.js'
import {assertCompatibleVersion} from './version-policy.js'
import {SCHEMA_VERSION} from './release-version.js'

export const MODEL_TEST_SCHEMA = `https://vmblu.dev/context/${SCHEMA_VERSION}/model-test.schema.json`
export const TEST_REPORT_SCHEMA = `https://vmblu.dev/context/${SCHEMA_VERSION}/test-report.schema.json`

export async function loadNodeTestContext(modelFile, nodePath) {
    return loadTargetTestContext(modelFile, 'node', nodePath)
}

export async function loadGroupTestContext(modelFile, groupPath) {
    return loadTargetTestContext(modelFile, 'group', groupPath)
}

export async function loadAppTestContext(modelFile) {
    return loadTargetTestContext(modelFile, 'model', null)
}

async function loadTargetTestContext(modelFile, scope, targetPath) {
    const resolved = resolveEntrypoint(modelFile)
    const modelPath = normalizeSeparators(resolved.modelPath)
    const model = new ModelBlueprint(new ARL(modelPath))

    const compiler = new ModelCompiler(new UIDGenerator())
    await compiler.refreshRaw(model)
    assertCompatibleVersion(model.raw?.header?.version, 'model schema')

    const root = model.raw?.root ? compiler.compileRawNode(model, model.raw.root) : null
    if (!root) throw new Error('Failed to compile model root')

    const parts = scope === 'model' ? [] : normalizeNodePath(targetPath, root.name)
    const rawNode = scope === 'model' ? model.raw.root : findNodeByPath(model.raw.root, parts)
    const node = scope === 'model' ? root : findNodeByPath(root, parts)
    if (!rawNode || !node) throw new Error(`Node '${parts.join('/')}' was not found in the model`)
    if (scope === 'node' && !node.is?.source) throw new Error(`Target '${parts.join('/')}' is a group; use 'make-test group'`)
    if ((scope === 'group' || scope === 'model') && !node.is?.group) throw new Error(`Target '${parts.join('/')}' is not a group`)

    const projectRoot = findProjectRoot(resolved)
    const relativeModel = normalizeSeparators(path.relative(projectRoot, resolved.modelPath))
    const resolvedSpecFile = node.testRepo?.arl?.getFullPath?.() ?? null
    const specFile = resolvedSpecFile ? path.normalize(resolvedSpecFile) : null
    let testsText = null
    if (specFile) {
        try {
            testsText = fs.readFileSync(specFile, 'utf8')
        }
        catch (error) {
            if (error?.code !== 'ENOENT') throw error
            throw new Error(`Test specification not found: ${specFile}`)
        }
    }
    const specPath = specFile ? normalizeSeparators(path.relative(projectRoot, specFile)) : null

    return {
        resolved,
        projectRoot,
        model,
        root,
        rawNode,
        node,
        scope,
        parts,
        relativeModel,
        specFile,
        specPath,
        testRepoReadOnly: !!node.testRepo?.readOnly,
        testsText: normalizeTestSpecification(testsText),
        specHash: sourceHash(normalizeTestSpecification(testsText) ?? ''),
        contractHash: sourceHash(modelContract(rawNode)),
    }
}

export function createNodeTestArtifact(context) {
    if (!context?.testsText?.trim()) return null
    if (!context.node?.is?.source) throw new Error(`Target '${context.parts.join('/')}' is not a source node`)
    return createModelTestArtifact(context)
}

export function createGroupTestArtifact(context) {
    if (!context?.testsText?.trim()) return null
    if (!context.node?.is?.group) throw new Error(`Target '${context.parts.join('/')}' is not a group`)
    return createModelTestArtifact(context)
}

export function createAppTestArtifact(context) {
    if (!context?.testsText?.trim()) return null
    if (context.scope !== 'model') throw new Error('Application tests require the model root context')
    return createModelTestArtifact(context)
}

function createModelTestArtifact(context) {
    const scenarios = parseTestScenarios(context.testsText, context.parts.join('/'))
    validateScenarioPins(scenarios, context)
    return {
        $schema: MODEL_TEST_SCHEMA,
        kind: 'vmblu.model-test',
        version: 1,
        schemaVersion: SCHEMA_VERSION,
        source: {
            model: context.relativeModel,
            spec: context.specPath,
            specHash: context.specHash,
            contractHash: context.contractHash,
        },
        target: {
            scope: context.scope,
            name: context.parts.at(-1) ?? context.root.name,
            path: context.parts,
        },
        host: inferHost(scenarios),
        scenarios,
    }
}

function validateScenarioPins(scenarios, context) {
    const {inputs, outputs} = targetPins(context.node)
    for (const scenario of scenarios) {
        for (const action of scenario.actions) {
            if (['send', 'request', 'mount'].includes(action.kind) && !inputs.has(action.pin)) {
                throw new Error(`Scenario '${scenario.title}' refers to unknown input pin '${action.pin}'`)
            }
        }
        for (const expectation of scenario.expect) {
            if (expectation.kind === 'send' && !outputs.has(expectation.pin)) {
                throw new Error(`Scenario '${scenario.title}' refers to unknown output pin '${expectation.pin}'`)
            }
            if (expectation.kind === 'reply' && !inputs.has(expectation.pin)) {
                throw new Error(`Scenario '${scenario.title}' refers to unknown request/reply pin '${expectation.pin}'`)
            }
        }
    }
}

export function parseTestScenarios(markdown, target='<node>') {
    const sections = splitScenarioSections(markdown)
    if (!sections.length) {
        throw new Error(`Test specification for '${target}' has no ## scenario headings`)
    }

    return sections.map(({title, lines}) => {
        const purpose = field(lines, 'Purpose') ?? title
        const timeout = field(lines, 'Timeout')
        const actions = []
        const expect = []

        for (const line of lines) {
            const explicitSend = line.match(/^\s*-\s*Send:\s*`([^`]+)`\s*=\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitSend) {
                actions.push({kind: 'send', pin: explicitSend[1], message: parseInlineValue(explicitSend[2])})
                continue
            }

            const explicitExpect = line.match(/^\s*-\s*Expect send:\s*`([^`]+)`\s*=\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitExpect) {
                expect.push({kind: 'send', pin: explicitExpect[1], message: parseInlineValue(explicitExpect[2])})
                continue
            }

            const explicitRequest = line.match(/^\s*-\s*Request:\s*`([^`]+)`\s*=\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitRequest) {
                actions.push({kind: 'request', pin: explicitRequest[1], message: parseInlineValue(explicitRequest[2])})
                continue
            }

            const explicitMount = line.match(/^\s*-\s*Mount:\s*`([^`]+)`(?:\s*=\s*`([^`]*)`)?\s*\.?\s*$/i)
            if (explicitMount) {
                const action = {kind: 'mount', pin: explicitMount[1]}
                if (explicitMount[2] !== undefined) action.message = parseInlineValue(explicitMount[2])
                actions.push(action)
                continue
            }

            const explicitClick = line.match(/^\s*-\s*Click:\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitClick) {
                actions.push({kind: 'click', locator: parseLocator(explicitClick[1], title)})
                continue
            }

            const explicitFill = line.match(/^\s*-\s*Fill:\s*`([^`]*)`\s*=\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitFill) {
                actions.push({kind: 'fill', locator: parseLocator(explicitFill[1], title), value: explicitFill[2]})
                continue
            }

            const explicitWait = line.match(/^\s*-\s*Wait:\s*`?(\d+)`?\s*(?:ms)?\s*\.?\s*$/i)
            if (explicitWait) {
                actions.push({kind: 'wait', ms: Number(explicitWait[1])})
                continue
            }

            const explicitReply = line.match(/^\s*-\s*Expect reply:\s*`([^`]+)`\s*=\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitReply) {
                expect.push({kind: 'reply', pin: explicitReply[1], message: parseInlineValue(explicitReply[2])})
                continue
            }

            const explicitView = line.match(/^\s*-\s*Expect view:\s*`([^`]*)`\s*\.?\s*$/i)
            if (explicitView) {
                expect.push(parseViewExpectation(explicitView[1], title))
                continue
            }

            const when = line.match(/^\s*-\s*When:\s*(.+?)\s+(?:is|are)\s+sent\s+to\s+`([^`]+)`\s*\.?\s*$/i)
            if (when) {
                const values = [...when[1].matchAll(/`([^`]*)`/g)].map(match => parseInlineValue(match[1]))
                for (const message of values) actions.push({kind: 'send', pin: when[2], message})
                continue
            }

            const then = line.match(/^\s*-\s*Then:\s*(?:the node\s+)?sends\s+`([^`]*)`\s+on\s+`([^`]+)`\s*\.?\s*$/i)
            if (then) expect.push({kind: 'send', pin: then[2], message: parseInlineValue(then[1])})
        }

        if (!actions.length || !expect.length) {
            throw new Error(
                `Scenario '${title}' in '${target}' needs at least one executable action and expectation. ` +
                'Use "- Send: `input pin` = `<JSON>`" and "- Expect send: `output pin` = `<JSON>`".',
            )
        }

        const scenario = {
            id: scenarioId(title),
            title,
            purpose,
            actions,
            expect,
        }
        if (timeout !== null && timeout !== undefined) scenario.timeoutMs = parseTimeout(timeout, title)
        return scenario
    })
}

export function normalizeTestSpecification(text) {
    if (typeof text !== 'string') return null
    const normalized = text.replace(/\r\n/g, '\n').trim()
    return normalized.length ? normalized : null
}

export function testArtifactPath(context) {
    return siblingTestFile(context, '.test.json')
}

export function testReportPath(context) {
    return siblingTestFile(context, '.result.json')
}

function siblingTestFile(context, suffix) {
    if (!context?.specFile) throw new Error(`Target '${context?.parts?.join('/') || context?.root?.name || '<unknown>'}' has no testRepo`)
    const extension = path.extname(context.specFile)
    const stem = extension ? context.specFile.slice(0, -extension.length) : context.specFile
    return `${stem}${suffix}`
}

export function collectTestableNodePaths(rawRoot) {
    const paths = []
    const visit = (node, parents=[]) => {
        const current = node === rawRoot ? parents : [...parents, node.name]
        if (node !== rawRoot && node.testRepo?.arl) paths.push(current)
        for (const child of node.nodes ?? []) visit(child, current)
    }
    visit(rawRoot)
    return paths
}

export function factoryDescriptor(context) {
    const factoryPath = context.node?.factory?.arl?.getFullPath?.()
    const functionName = context.node?.factory?.fName
    if (!factoryPath || !functionName) {
        throw new Error(`Node '${context.parts.join('/')}' does not resolve to a factory`)
    }
    return {
        path: factoryPath,
        functionName,
        sx: context.node.sx ?? null,
        inputPins: context.node.rxTable.map(record => record.pin.name),
        outputPins: context.node.txTable.map(record => record.pin.name),
    }
}

export function sourceTargetManifest(context) {
    const descriptor = factoryDescriptor(context)
    return {
        scope: 'node',
        factoryPath: descriptor.path,
        functionName: descriptor.functionName,
        sx: descriptor.sx,
        inputPins: descriptor.inputPins,
        outputPins: descriptor.outputPins,
    }
}

export function assertArtifactCurrent(artifact, context) {
    if (artifact.source.model !== context.relativeModel) throw new Error('Node test artifact refers to a different model')
    if (artifact.source.spec !== context.specPath) throw new Error('Model test artifact refers to a different test specification')
    if (artifact.source.specHash !== context.specHash) throw new Error('Model test artifact is stale: the test specification changed')
    if (artifact.source.contractHash !== context.contractHash) throw new Error('Node test artifact is stale: the node contract changed')
    if (artifact.target.path.join('/') !== context.parts.join('/')) throw new Error('Node test artifact target does not match the selected node')
    if ((artifact.target.scope ?? 'node') !== context.scope) throw new Error('Model test artifact scope does not match the selected target')
}

export async function routedTargetDescriptor(context) {
    const manifest = routedTargetManifest(context)
    const nodeList = []
    for (const source of manifest.nodeList) {
        const module = await import(pathToFileURL(source.factoryPath).href)
        const factory = module[source.functionName]
        if (typeof factory !== 'function') throw new Error(`Factory '${source.functionName}' is not exported by ${source.factoryPath}`)
        const {factoryPath, functionName, ...descriptor} = source
        nodeList.push({...descriptor, factory})
    }
    return {nodeList, boundary: manifest.boundary}
}

export function routedTargetManifest(context) {
    const target = context.node
    target.rxtxBuildTxTable()
    const sources = []
    target.makeSourceLists(sources)
    const sourceUids = new Set(sources.map(source => source.uid))
    const nodeList = []

    for (const source of sources) {
        const factoryPath = source.factory?.arl?.getFullPath?.()
        const functionName = source.factory?.fName
        if (!factoryPath || !functionName) throw new Error(`Node '${source.name}' does not resolve to a factory`)
        nodeList.push({
            name: source.name,
            uid: source.uid,
            factoryPath,
            functionName,
            inputs: source.rxTable.map(record => `${record.pin.is.channel ? '=>' : '->'} ${record.pin.name}`),
            outputs: source.txTable.map(record => outputString(record, sourceUids)),
            sx: source.sx ?? null,
            dx: source.dx ?? null,
        })
    }

    return {scope: context.scope, nodeList, boundary: groupBoundary(target, sourceUids)}
}

export function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function findProjectRoot(resolved) {
    if (resolved.entrypointPath) return path.dirname(resolved.entrypointPath)
    const modelDirectory = path.dirname(resolved.modelPath)
    return path.basename(modelDirectory).toLowerCase() === 'model' ? path.dirname(modelDirectory) : modelDirectory
}

function normalizeNodePath(nodePath, rootName) {
    const parts = String(nodePath ?? '').split(/[\\/]/).map(part => part.trim()).filter(Boolean)
    if (parts[0] === rootName) parts.shift()
    if (!parts.length) throw new Error('A node name path is required')
    return parts
}

function findNodeByPath(root, parts) {
    let node = root
    for (const part of parts) {
        node = node?.nodes?.find(child => child.name === part)
        if (!node) return null
    }
    return node
}

function modelContract(rawNode) {
    const contract = structuredClone(rawNode)
    stripPrompts(contract)
    return contract
}

function stripPrompts(node) {
    delete node.prompt
    delete node.promptRepo
    delete node.testRepo
    for (const child of node.nodes ?? []) stripPrompts(child)
}

function splitScenarioSections(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')
    const level = lines.some(line => /^###\s+/.test(line)) ? 3 : 2
    const expression = level === 3 ? /^###\s+(.+?)\s*$/ : /^##\s+(.+?)\s*$/
    const sections = []
    let current = null
    for (const line of lines) {
        const heading = line.match(expression)
        if (heading) {
            current = {title: heading[1], lines: []}
            sections.push(current)
        }
        else if (current) current.lines.push(line)
    }
    return sections
}

function field(lines, name) {
    const expression = new RegExp(`^\\s*-\\s*${name}:\\s*(.+?)\\s*$`, 'i')
    for (const line of lines) {
        const match = line.match(expression)
        if (match) return match[1]
    }
    return null
}

function parseInlineValue(text) {
    try {
        return JSON.parse(text)
    }
    catch {
        return text
    }
}

function parseLocator(text, title) {
    const locator = parseInlineValue(text)
    if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
        throw new Error(`Scenario '${title}' browser locator must be a JSON object`)
    }
    return locator
}

function parseViewExpectation(text, title) {
    const value = parseInlineValue(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Scenario '${title}' view expectation must be a JSON object`)
    }
    if (value.locator) return {kind: 'view', ...value}
    const {css, role, name, index, ...assertion} = value
    return {kind: 'view', locator: {css, role, name, index}, ...assertion}
}

function parseTimeout(text, title) {
    const match = String(text).match(/^(\d+)\s*(?:ms)?$/i)
    if (!match) throw new Error(`Scenario '${title}' has an invalid timeout '${text}'`)
    return Number(match[1])
}

function scenarioId(title) {
    const id = String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!id) throw new Error(`Cannot derive a scenario ID from '${title}'`)
    return id
}

function targetPins(node) {
    if (node.is?.source) {
        return {
            inputs: new Set(node.rxTable.map(record => record.pin.name)),
            outputs: new Set(node.txTable.map(record => record.pin.name)),
        }
    }
    const pins = node.look?.widgets?.filter(widget => widget.is?.pin && widget.is?.proxy) ?? []
    return {
        inputs: new Set(pins.filter(pin => pin.is.input).map(pin => pin.name)),
        outputs: new Set(pins.filter(pin => !pin.is.input).map(pin => pin.name)),
    }
}

function inferHost(scenarios) {
    const browserKinds = new Set(['mount', 'click', 'fill', 'view'])
    return scenarios.some(scenario =>
        scenario.actions.some(item => browserKinds.has(item.kind))
        || scenario.expect.some(item => browserKinds.has(item.kind))
    ) ? 'browser' : 'node'
}

function outputString(record, sourceUids) {
    const arrow = record.pin.is.channel ? '=>' : '->'
    const targets = record.targets
        .filter(target => sourceUids.has(target.node?.uid))
        .map(target => `${target.name} @ ${target.node.name} (${target.node.uid})`)
    if (!targets.length) return `${record.pin.name} ${arrow} ()`
    if (targets.length === 1) return `${record.pin.name} ${arrow} ${targets[0]}`
    return `${record.pin.name} ${arrow} [ ${targets.map(target => JSON.stringify(target)).join(', ')} ]`
}

function groupBoundary(group, sourceUids) {
    const boundary = {inputs: [], outputs: []}
    const proxies = group.look?.widgets?.filter(widget => widget.is?.pin && widget.is?.proxy) ?? []
    for (const proxy of proxies) {
        const connected = []
        proxy.pad?.makeConxList?.(connected)
        const internal = connected.filter(pin => sourceUids.has(pin.node?.uid))
        if (proxy.is.input) {
            boundary.inputs.push({
                pin: proxy.name,
                channel: !!proxy.is.channel,
                targets: internal.filter(pin => pin.is.input).map(pin => ({uid: pin.node.uid, pin: pin.name})),
            })
        }
        else {
            for (const pin of internal.filter(pin => !pin.is.input)) {
                boundary.outputs.push({pin: proxy.name, channel: !!proxy.is.channel, sourceUid: pin.node.uid, sourcePin: pin.name})
            }
        }
    }
    return boundary
}
