import {makeDefaultPromptRepo} from '../model/blueprint-prompt.js'
import {PromptRepo, getPromptRepoRuntimeState} from './prompt-repo.js'
import {applyNodePromptDocument} from './node-prompt-document.js'

export async function ensureNodePromptFile(node, document) {
    const existing = node.prompts.repository
    const model = node.model
    const ref = model?.getArl?.()
    if (!existing && !ref) throw new Error('Save the model before opening its prompt file.')

    const path = []
    function find(current) {
        if (current === node) return true
        for (const child of current?.nodes ?? []) {
            if (current !== model.root && current.name) path.push(current.name)
            if (find(child)) return true
            if (current !== model.root && current.name) path.pop()
        }
        return false
    }
    if (!existing) find(model.root)
    const raw = existing ? null : makeDefaultPromptRepo(node, path)
    const arl = existing?.arl ?? ref.resolve(raw.arl)
    if (!arl?.createPromptFile) throw new Error('This location does not support creating prompt files. Save the model in a writable workspace.')
    const result = await arl.createPromptFile(document)
    const repository = existing ?? new PromptRepo(arl, raw.pathKind)
    node.prompts.repository = repository
    const state = getPromptRepoRuntimeState(repository)
    if (result.created || !existing) {
        applyNodePromptDocument(node, result.text)
        state.dirty = false
        state.pendingText = null
        state.hydrated = true
        state.hydratedText = result.text
    }
    return {arl, changed: !existing || result.created}
}
