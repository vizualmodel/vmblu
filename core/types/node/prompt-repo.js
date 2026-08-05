import {ARL, Path} from '../arl/index.js'

const runtimeState = Symbol('promptRepoRuntimeState')

export function PromptRepo(arl = null, pathKind = Path.Kind.Empty) {
    this.arl = arl
    this.pathKind = pathKind
    this.is = attachRuntimeState(this, {
        hydrated: false, // set to true if hydration was successful
        dirty: false,
        pendingText: null,
        hydratedText: null,
    })
}

PromptRepo.prototype = {

    getPath(refArl) {
        if (!this.arl || this.pathKind === Path.Kind.Empty) return ''
        if (!refArl) return this.arl.getPath()
        return this.pathKind === Path.Kind.Absolute ? this.arl.getPath() : Path.relative(this.arl.getFullPath(), refArl.getFullPath())
    },

    makeRaw(refArl) {
        return carryPromptRepoRuntimeState({
            arl: this.getPath(refArl),
            pathKind: this.pathKind,
        }, this)
    },

    resolve(raw, refArl) {
        if (!raw?.arl || !refArl) return null
        const normalized = Path.normalizeSeparators(raw.arl)
        this.pathKind = raw.pathKind ?? Path.getKind(normalized)
        this.arl = this.pathKind === Path.Kind.Absolute ? new ARL(normalized) : refArl.resolve(normalized)
        this.is = attachRuntimeState(this, getPromptRepoRuntimeState(raw))
        return this
    },

    clone() {
        const clone = new PromptRepo(this.arl?.copy?.() ?? this.arl, this.pathKind)
        clone.is = attachRuntimeState(clone, {...getPromptRepoRuntimeState(this)})
        return clone
    },
}

export function resolvePromptRepo(raw, refArl) {
    return new PromptRepo().resolve(raw, refArl)
}

export function getPromptRepoRuntimeState(promptRepo) {
    if (!promptRepo) return null
    return promptRepo[runtimeState] ?? attachRuntimeState(promptRepo, {
        hydrated: false,
        dirty: false,
        pendingText: null,
        hydratedText: null,
    })
}

export function carryPromptRepoRuntimeState(raw, promptRepo) {
    attachRuntimeState(raw, getPromptRepoRuntimeState(promptRepo))
    return raw
}

function attachRuntimeState(promptRepo, state) {
    if (!promptRepo || !state) return state
    Object.defineProperty(promptRepo, runtimeState, {
        configurable: true,
        value: state,
    })
    return state
}
