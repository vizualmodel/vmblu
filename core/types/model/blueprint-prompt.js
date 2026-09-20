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
                if (repoArl) {
                    const text = state.pendingText ?? (!state.dirty && state.hydratedText !== null
                        ? state.hydratedText : serializePromptMarkdown(node))
                    if (state.dirty) state.pendingText = text
                    promptFiles.push({
                        arl: repoArl,
                        text,
                        state,
                        node,
                        write: state.dirty,
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

    async savePromptRepos(promptFiles = this.preparePromptReposForSave(), {cleanupPrompts = true} = {}) {
        const counts = new Map()
        for (const file of promptFiles) {
            file.key = file.arl.getFullPath?.() ?? file.arl.getPath()
            counts.set(file.key, (counts.get(file.key) ?? 0) + 1)
        }
        const saves = promptFiles.map(async file => {
            try {
                const liveNodes = []
                const visit = node => {
                    if (!node) return
                    if (getPromptRepoRuntimeState(node.prompts?.repository) === file.state) liveNodes.push(node)
                    for (const child of node.nodes ?? []) visit(child)
                }
                visit(this.root)
                const hasDraft = () => liveNodes.some(node => {
                    const draft = node.prompts.readDraft?.()
                    return draft != null && !isEmptyPromptDocument(draft, file.node)
                })
                const current = file.arl.readPromptFile ? await file.arl.readPromptFile() : null
                if (file.write && current?.dirty) throw new PromptRepositoryConflictError(file.key)
                if (cleanupPrompts && current && !current.dirty && !hasDraft() &&
                    file.arl.removePromptFile && counts.get(file.key) === 1 &&
                    file.arl.canWrite?.() !== false &&
                    isEmptyPromptDocument(file.text, file.node) &&
                    isEmptyPromptDocument(file.write ? file.text : current.text, file.node)) {
                    if (file.write && file.state.hydrated && current.text !== file.state.hydratedText) {
                        throw new PromptRepositoryConflictError(file.key)
                    }
                    if (await file.arl.removePromptFile(current.text)) {
                        delete file.node.promptRepo
                        for (const node of liveNodes) {
                            node.prompts.repository = null
                            node.prompts.prompt = null
                            for (const iface of node.interfaces ?? []) for (const pin of iface.pins ?? []) pin.prompt = null
                        }
                        file.state.dirty = false
                        file.state.pendingText = null
                        file.state.hydrated = false
                        file.state.hydratedText = null
                        return
                    }
                    // A full editor changed while cleanup was pending.
                    if (file.write) throw new PromptRepositoryConflictError(file.key)
                }
                if (file.write === false) return
                if (file.state.hydrated) {
                    const currentText = current ? current.text : await file.arl.get('text').catch(() => null)
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

// Only whitespace or the exact generated scaffold is disposable. Arbitrary
// headings, comments, and text outside the reserved sections remain content.
export function isEmptyPromptDocument(text, node) {
    if (typeof text !== 'string') return false
    const normalize = value => value.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean).join('\n')
    if (!text.trim()) return true
    const scaffold = serializePromptMarkdown({
        name: node.name,
        prompt: '',
        interfaces: (node.interfaces ?? []).map(iface => ({pins: (iface.pins ?? []).map(pin => ({name: pin.name}))})),
    })
    return normalize(text) === normalize(scaffold)
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

export function makeDefaultPromptRepo(node, path = []) {
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
