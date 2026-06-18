import {Path} from '../arl/index.js'

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
                    if (parsed.node) node.prompt = parsed.node
                    applyPinPrompts(node, parsed.pins)
                    node.promptRepo.is = {...node.promptRepo.is, hydrated: true}
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
                const repoArl = resolvePromptRepoArl(node.promptRepo, refArl)
                if (repoArl) {
                    promptFiles.push({
                        arl: repoArl,
                        text: serializePromptMarkdown(node),
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

    savePromptRepos(promptFiles = this.preparePromptReposForSave()) {
        for (const file of promptFiles) {
            file.arl?.save(file.text)?.catch?.(() => {})
        }
    },
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
    return {
        arl: `./prompts/${parts.join('/')}.md`,
        pathKind: Path.Kind.Relative,
    }
}

function safeName(name) {
    return String(name ?? 'node')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
}

function hasPrompts(node) {
    if (node.prompt?.length) return true
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            if (pin.prompt?.length) return true
        }
    }
    return false
}

function deleteInlinePrompts(node) {
    delete node.prompt
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            delete pin.prompt
        }
    }
}

function applyPinPrompts(node, prompts) {
    if (!prompts) return
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            const prompt = prompts.get(pin.name)
            if (prompt) pin.prompt = prompt
        }
    }
}

function parsePromptMarkdown(text) {
    if (typeof text !== 'string') return null

    try {
        const lines = text.replace(/\r\n/g, '\n').split('\n')
        let section = null
        let currentPin = null
        const nodeLines = []
        const pinMap = new Map()
        let buffer = []

        const flushPin = () => {
            if (!currentPin) return
            const prompt = buffer.join('\n').trim()
            if (prompt) pinMap.set(currentPin, prompt)
            buffer = []
        }

        for (const line of lines) {
            const h2 = line.match(/^##\s+(.+?)\s*$/)
            if (h2) {
                flushPin()
                section = h2[1].trim().toLowerCase()
                currentPin = null
                buffer = []
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
            node: nodeLines.join('\n').trim(),
            pins: pinMap,
        }
    }
    catch {
        return null
    }
}

function serializePromptMarkdown(node) {
    const out = [`# ${node.name}`, '', '## Node', '', node.prompt ?? '', '', '## Pins']
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            out.push('', `### ${pin.name}`, '', pin.prompt ?? '')
        }
    }
    out.push('')
    return out.join('\n')
}
