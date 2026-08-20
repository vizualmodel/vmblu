import {getPromptRepoRuntimeState, resolvePromptRepo} from './prompt-repo.js'

export function NodePrompts({prompt=null, repository=null}={}) {
    this.prompt = normalizePrompt(prompt)
    this.repository = repository
}

NodePrompts.prototype = {

    apply(prompt) {
        const before = this.prompt
        const after = normalizePrompt(prompt)
        if (before === after) return {changed: false, before, after}

        this.prompt = after
        this.markDirty()
        return {changed: true, before, after}
    },

    restore(prompt) {
        this.prompt = normalizePrompt(prompt)
        this.markDirty()
    },

    cook(raw, refArl) {
        this.prompt = normalizePrompt(raw.prompt)
        this.repository = raw.promptRepo && raw.kind !== 'dock'
            ? resolvePromptRepo(raw.promptRepo, refArl)
            : null
        return this
    },

    writeRaw(raw, refArl) {
        if (this.repository) raw.promptRepo = this.repository.makeRaw(refArl)
        if (this.prompt) raw.prompt = this.prompt
        return raw
    },

    hasContent() {
        return Boolean(this.prompt?.trim().length)
    },

    markDirty() {
        const state = getPromptRepoRuntimeState(this.repository)
        if (!state) return false
        state.dirty = true
        state.pendingText = null
        return true
    },

    clone() {
        return new NodePrompts({
            prompt: this.prompt,
            repository: this.repository?.clone?.() ?? null,
        })
    },
}

function normalizePrompt(value) {
    return typeof value === 'string' && value.trim().length ? value : null
}
