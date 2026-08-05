import {getPromptRepoRuntimeState, resolvePromptRepo} from './prompt-repo.js'

const sectionNames = ['prompt', 'status', 'decisions', 'open', 'references']

export function NodePrompts({prompt=null, status=null, decisions=null, open=null, references=null, repository=null}={}) {
    this.prompt = normalizeSection(prompt)
    this.status = normalizeSection(status)
    this.decisions = normalizeSection(decisions)
    this.open = normalizeSection(open)
    this.references = normalizeSection(references)
    this.repository = repository
}

NodePrompts.prototype = {

    apply(sections) {
        const before = this.snapshot()
        const after = normalizeSections(sections, before)
        const changed = sectionNames.some(section => before[section] !== after[section])
        if (!changed) return {changed: false, before, after}

        this.assign(after)
        this.markDirty()
        return {changed: true, before, after}
    },

    restore(sections) {
        this.assign(normalizeSections(sections))
        this.markDirty()
    },

    hydrate(sections) {
        this.assign(normalizeSections(sections))
        this.clearDirty()
    },

    cook(raw, refArl) {
        this.assign({
            prompt: raw.prompt,
            status: raw.promptStatus,
            decisions: raw.promptDecisions,
            open: raw.promptOpen,
            references: raw.promptReferences,
        })
        this.repository = raw.promptRepo && raw.kind !== 'dock'
            ? resolvePromptRepo(raw.promptRepo, refArl)
            : null
        return this
    },

    writeRaw(raw, refArl) {
        if (this.repository) raw.promptRepo = this.repository.makeRaw(refArl)
        if (this.prompt) raw.prompt = this.prompt
        if (this.status) raw.promptStatus = this.status
        if (this.decisions) raw.promptDecisions = this.decisions
        if (this.open) raw.promptOpen = this.open
        if (this.references) raw.promptReferences = this.references
        return raw
    },

    snapshot(empty=null) {
        return {
            prompt: this.prompt ?? empty,
            status: this.status ?? empty,
            decisions: this.decisions ?? empty,
            open: this.open ?? empty,
            references: this.references ?? empty,
        }
    },

    hasContent() {
        return sectionNames.some(section => this[section]?.length)
    },

    markDirty() {
        const state = getPromptRepoRuntimeState(this.repository)
        if (!state) return false
        state.dirty = true
        state.pendingText = null
        return true
    },

    clearDirty() {
        const state = getPromptRepoRuntimeState(this.repository)
        if (!state) return false
        state.dirty = false
        state.pendingText = null
        return true
    },

    clone() {
        return new NodePrompts({
            ...this.snapshot(),
            repository: this.repository?.clone?.() ?? null,
        })
    },

    assign(sections) {
        for (const section of sectionNames) this[section] = normalizeSection(sections?.[section])
    },
}

function normalizeSections(sections, fallback={}) {
    return Object.fromEntries(sectionNames.map(section => [
        section,
        Object.hasOwn(sections ?? {}, section)
            ? normalizeSection(sections[section])
            : normalizeSection(fallback[section]),
    ]))
}

function normalizeSection(value) {
    return value?.length ? value : null
}
