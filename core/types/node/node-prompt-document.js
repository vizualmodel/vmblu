import {parsePromptMarkdown, serializePromptMarkdown} from '../model/blueprint-prompt.js'
import {getPromptRepoRuntimeState} from './prompt-repo.js'

export function getNodePromptDocument(node) {
    const state = getPromptRepoRuntimeState(node?.prompts?.repository)
    if (state?.pendingText !== null && state?.pendingText !== undefined) return state.pendingText
    if (state && !state.dirty && state.hydratedText !== null) return state.hydratedText

    const hasPinPrompts = node?.interfaces?.some(iface =>
        iface.pins?.some(pin => pin.prompt?.length)
    )
    if (!node?.prompts?.repository && !hasPinPrompts) return node?.prompts?.prompt ?? ''
    return serializePromptMarkdown(node)
}

export function applyNodePromptDocument(node, document) {
    const parsed = parsePromptMarkdown(document)
    if (!parsed) return false

    node.prompts.apply(parsed.prompt)
    for (const iface of node.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            pin.prompt = parsed.pins.get(pin.name) || null
        }
    }

    node.prompts.markDirty()
    const state = getPromptRepoRuntimeState(node.prompts.repository)
    if (state) state.pendingText = document
    return true
}
