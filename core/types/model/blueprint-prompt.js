import {Path} from '../arl/index.js'
import {carryPromptRepoRuntimeState, getPromptRepoRuntimeState} from '../node/prompt-repo.js'

export const PromptHandling = {

    async hydratePromptRepos(raw = this.raw) {

        // check
        if (!raw?.root) return raw

        const refArl = this.blu.arl
        if (!refArl) return raw

        const hydrateNode = async (node) => {
            if (!node || node.kind === 'dock') return

            if (node.promptRepo?.arl) {
                const repoArl = resolvePromptRepoArl(node.promptRepo, refArl)
                const text = await repoArl?.get('text')?.catch(() => null)
                const parsed = parsePromptMarkdown(text)
                if (parsed) {
                    node.prompt = normalizePrompt(parsed.prompt)
                    applyPinPrompts(node, parsed.pins)
                    const state = getPromptRepoRuntimeState(node.promptRepo)
                    state.hydrated = true
                    state.dirty = false
                    state.pendingText = null
                    state.hydratedText = text
                }
            }

            if (node.kind === 'group' && node.nodes) {
                for (const child of node.nodes) await hydrateNode(child)
            }
        }

        await hydrateNode(raw.root)
        return raw
    },

    preparePromptReposForSave(raw = this.raw) {
        if (!raw?.root) return []

        const promptFiles = []
        const refArl = this.blu.arl
        if (!refArl) return promptFiles

        const prepareNode = (node, path = []) => {
            if (!node || node.kind === 'dock') return

            if (!node.promptRepo && hasPrompts(node)) {
                node.promptRepo = makeDefaultPromptRepo(node, path)
            }

            if (node.promptRepo?.arl) {
                const state = getPromptRepoRuntimeState(node.promptRepo)
                const repoArl = resolvePromptRepoArl(node.promptRepo, refArl)
                if (repoArl && state.dirty) {
                    const text = state.pendingText ?? serializePromptMarkdown(node)
                    state.pendingText = text
                    promptFiles.push({
                        arl: repoArl,
                        text,
                        state,
                    })
                }
                deleteInlinePrompts(node)
            }

            if (node.kind === 'group' && node.nodes) {
                const childPath = node === raw.root ? path : [...path, node.name]
                for (const child of node.nodes) prepareNode(child, childPath)
            }
        }

        prepareNode(raw.root)
        return promptFiles
    },

    async savePromptRepos(promptFiles = this.preparePromptReposForSave()) {
        const saves = promptFiles.map(async file => {
            try {
                if (file.state.hydrated) {
                    const currentText = await file.arl.get('text').catch(() => null)
                    if (currentText !== file.state.hydratedText) {
                        throw new PromptRepositoryConflictError(file.arl?.getPath?.() ?? '<unknown>')
                    }
                }
                const result = await file.arl.save(file.text)
                if (result === null || result === false) throw new Error('Prompt repository write returned failure')
                file.state.dirty = false
                file.state.pendingText = null
                file.state.hydrated = true
                file.state.hydratedText = file.text
            }
            catch (error) {
                console.error(`Failed to save prompt repository ${file.arl?.getPath?.() ?? '<unknown>'}:`, error)
                throw error
            }
        })
        const results = await Promise.allSettled(saves)
        const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
        if (failures.length) {
            const details = failures.map(error => error?.message ?? String(error)).join('; ')
            throw new AggregateError(failures, `One or more prompt repositories failed to save: ${details}`)
        }
    },
}

export class PromptRepositoryConflictError extends Error {
    constructor(path) {
        super(`Prompt repository changed outside vmblu: ${path}`)
        this.name = 'PromptRepositoryConflictError'
        this.path = path
    }
}

function resolvePromptRepoArl(promptRepo, refArl) {
    if (!promptRepo?.arl || !refArl) return null
    if (promptRepo.arl.get && promptRepo.arl.save) return promptRepo.arl
    const arl = Path.normalizeSeparators(promptRepo.arl)
    return (promptRepo.pathKind === Path.Kind.Absolute || Path.getKind(arl) === Path.Kind.Absolute)
        ? refArl.resolve(arl)
        : refArl.resolve(arl)
}

function makeDefaultPromptRepo(node, path) {
    const parts = [...path, node.name].filter(Boolean).map(safeName)
    const promptRepo = {
        arl: `./prompts/${parts.join('/')}.md`,
        pathKind: Path.Kind.Relative,
    }
    carryPromptRepoRuntimeState(promptRepo, promptRepo)
    getPromptRepoRuntimeState(promptRepo).dirty = true
    return promptRepo
}

function safeName(name) {
    return String(name ?? 'node')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
}

function hasPrompts(node) {
    if (node.prompt?.trim().length) return true
    return (node.interfaces ?? []).some(iface =>
        (iface.pins ?? []).some(pin => pin.prompt?.length)
    )
}

function deleteInlinePrompts(node) {
    delete node.prompt
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) delete pin.prompt
    }
}

function applyPinPrompts(node, prompts) {
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            const prompt = prompts.get(pin.name)
            if (prompt) pin.prompt = prompt
        }
    }
}

export function parsePromptMarkdown(text) {
    if (typeof text !== 'string') return null

    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const nodeLines = []
    const pins = new Map()
    let section = null
    let currentPin = null
    let buffer = []
    let hasReservedSections = false

    const flushPin = () => {
        if (!currentPin) return
        const prompt = buffer.join('\n').trim()
        if (prompt) pins.set(currentPin, prompt)
        buffer = []
    }

    for (const line of lines) {
        const h2 = line.match(/^##\s+(.+?)\s*$/)
        if (h2) {
            const heading = h2[1].trim().toLowerCase()
            if (heading === 'node' || heading === 'pins') {
                flushPin()
                section = heading
                hasReservedSections = true
                currentPin = null
                buffer = []
            }
            else if (section === 'node') nodeLines.push(line)
            else if (section === 'pins' && currentPin) buffer.push(line)
            continue
        }

        const h3 = line.match(/^###\s+(.+?)\s*$/)
        if (h3 && section === 'pins') {
            flushPin()
            currentPin = h3[1].trim()
            continue
        }

        if (section === 'node') nodeLines.push(line)
        else if (section === 'pins' && currentPin) buffer.push(line)
    }
    flushPin()

    return {
        prompt: hasReservedSections ? nodeLines.join('\n').trim() : text,
        pins,
    }
}

export function serializePromptMarkdown(node) {
    const out = [
        `# ${node.name}`,
        '',
        '## Node',
        '',
        node.prompts?.prompt ?? node.prompt ?? '',
        '',
        '## Pins',
    ]
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            out.push('', `### ${pin.name}`, '', pin.prompt ?? '')
        }
    }
    out.push('')
    return out.join('\n')
}

function normalizePrompt(value) {
    return typeof value === 'string' && value.trim().length ? value : null
}
