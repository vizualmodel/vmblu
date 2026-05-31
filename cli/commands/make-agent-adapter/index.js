// vmblu make-agent-adapter <model-file> --target <target> [--agent <id>] [--out <file>]
import fs from 'fs'
import path from 'path'

import {agentAdapterRegistry, normalizeTarget} from '@vizualmodel/vmblu-runtime/agent-adapters'

import {ModelBlueprint, ModelCompiler, UIDGenerator} from '../../../core/types/model/index.js'
import {ARL} from '../../../core/types/arl/arl-node.js'
import {normalizeSeparators} from '../../../core/types/arl/path.js'
import {resolveEntrypoint} from '../../lib/resolve-entrypoint.js'

export const command = 'make-agent-adapter <model-file>'
export const describe = 'Generate a target-specific agent adapter projection from vmblu capabilities'

export const builder = [
    {flag: '--target <target>', desc: 'adapter target: vmblu, openai, or http'},
    {flag: '--agent <id>', desc: 'agent/interface id to project'},
    {flag: '--capabilities <file>', desc: 'capability manifest to read instead of generating from the model'},
    {flag: '--out <file>', desc: 'output file path'},
]

export const handler = async argv => {
    const args = parseCliArgs(argv)

    if (!args.modelFile || !args.target) {
        console.error('Usage: vmblu make-agent-adapter <model-file> --target <target> [--agent <id>] [--out <file>]')
        process.exit(1)
    }

    let resolved
    try {
        resolved = resolveEntrypoint(args.modelFile)
    }
    catch (err) {
        console.error(err.message)
        process.exit(1)
    }

    const absoluteModelPath = resolved.modelPath
    const model = await loadModel(absoluteModelPath)
    const capabilities = args.capabilitiesFile
        ? readJson(path.resolve(args.capabilitiesFile))
        : model.makeCapabilityObject()
    const agentRoot = loadAgentConfig(model.raw?.header?.agent, absoluteModelPath)
    const agent = selectAgent(agentRoot, args.agentId)
    const target = normalizeTarget(args.target)
    const projection = agentAdapterRegistry.project({target, capabilities, agent})
    const output = makeSerializableProjection(projection)
    const outPath = args.outFile
        ? path.resolve(args.outFile)
        : defaultOutputPath(absoluteModelPath, target, agent?.id)

    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    console.log(`Agent adapter written to ${outPath}`)
}

async function loadModel(modelPath) {
    const arl = new ARL(normalizeSeparators(modelPath))
    const model = new ModelBlueprint(arl)
    const compiler = new ModelCompiler(new UIDGenerator())
    await compiler.refreshRaw(model)

    if (!model.raw?.root) {
        throw new Error('Failed to load model root.')
    }

    model.preCook()
    return model
}

function loadAgentConfig(agentHeader, modelPath) {
    if (!agentHeader) return null

    const sidecarPath = typeof agentHeader === 'string'
        ? agentHeader
        : (typeof agentHeader?.path === 'string' ? agentHeader.path : null)

    if (sidecarPath) {
        const resolvedPath = path.resolve(path.dirname(modelPath), sidecarPath)
        const config = readJson(resolvedPath)
        if (agentHeader?.defaultAgent && !config.defaultAgent) config.defaultAgent = agentHeader.defaultAgent
        return config
    }

    return agentHeader
}

function selectAgent(agentRoot, requestedId = null) {
    if (!agentRoot) return null
    if (!Array.isArray(agentRoot?.agents)) return normalizeAgent(agentRoot)

    const selected = requestedId
        ? agentRoot.agents.find(agent => agent?.id === requestedId)
        : agentRoot.agents.find(agent => agent?.id === agentRoot.defaultAgent)
            ?? agentRoot.agents.find(agent => agent?.enabled !== false)
            ?? agentRoot.agents[0]

    if (requestedId && !selected) {
        throw new Error(`Agent interface not found: ${requestedId}`)
    }

    return normalizeAgent(selected)
}

function normalizeAgent(agent) {
    if (!agent) return null
    return {
        ...agent,
        type: agent.type ?? inferAgentType(agent),
    }
}

function inferAgentType(agent) {
    if (agent?.transport?.mode) return 'mcp'
    if (agent?.server) return 'http'
    return 'overlay'
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function makeSerializableProjection(projection) {
    const {map, ...serializable} = projection ?? {}
    return serializable
}

function defaultOutputPath(modelPath, target, agentId = null) {
    const {dir, name, ext} = path.parse(modelPath)
    const baseName = ext === '.blu' && name.endsWith('.mod')
        ? name.slice(0, -'.mod'.length)
        : name
    const agentPart = agentId ? `.${sanitizeFilePart(agentId)}` : ''
    return path.join(dir, `${baseName}.agent${agentPart}.${target}.json`)
}

function sanitizeFilePart(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'agent'
}

function parseCliArgs(argvInput) {
    const argv = Array.isArray(argvInput) ? argvInput : []
    const result = {
        modelFile: null,
        target: null,
        agentId: null,
        capabilitiesFile: null,
        outFile: null,
    }

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i]

        if (token === '--target') {
            const value = readOptionValue(argv, i + 1, '--target')
            if (value) {
                result.target = value
                i += 1
            }
            continue
        }
        if (token === '--agent') {
            const value = readOptionValue(argv, i + 1, '--agent')
            if (value) {
                result.agentId = value
                i += 1
            }
            continue
        }
        if (token === '--capabilities') {
            const value = readOptionValue(argv, i + 1, '--capabilities')
            if (value) {
                result.capabilitiesFile = value
                i += 1
            }
            continue
        }
        if (token === '--out') {
            const value = readOptionValue(argv, i + 1, '--out')
            if (value) {
                result.outFile = value
                i += 1
            }
            continue
        }

        if (token?.startsWith('--')) {
            console.warn(`Warning: unknown option "${token}" ignored.`)
            continue
        }

        if (!result.modelFile) {
            result.modelFile = token
        }
        else {
            console.warn(`Warning: extra positional argument "${token}" ignored.`)
        }
    }

    return result
}

function readOptionValue(argv, index, flag) {
    const value = argv[index]
    if (!value || value.startsWith('--')) {
        console.warn(`Warning: ${flag} requires a value; ignoring.`)
        return null
    }
    return value
}
