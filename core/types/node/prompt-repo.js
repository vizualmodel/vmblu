import {ARL, Path} from '../arl/index.js'

export function PromptRepo(arl = null, pathKind = Path.Kind.Empty) {
    this.arl = arl
    this.pathKind = pathKind
    this.is = {
        hydrated: false, // set to true if hydration was successful
    }
}

PromptRepo.prototype = {

    getPath(refArl) {
        if (!this.arl || this.pathKind === Path.Kind.Empty) return ''
        if (!refArl) return this.arl.getPath()
        return this.pathKind === Path.Kind.Absolute ? this.arl.getPath() : Path.relative(this.arl.getFullPath(), refArl.getFullPath())
    },

    makeRaw(refArl) {
        return {
            arl: this.getPath(refArl),
            pathKind: this.pathKind,
        }
    },

    resolve(raw, refArl) {
        if (!raw?.arl || !refArl) return null
        const normalized = Path.normalizeSeparators(raw.arl)
        this.pathKind = raw.pathKind ?? Path.getKind(normalized)
        this.arl = this.pathKind === Path.Kind.Absolute ? new ARL(normalized) : refArl.resolve(normalized)
        return this
    },

    clone() {
        const clone = new PromptRepo(this.arl?.copy?.() ?? this.arl, this.pathKind)
        clone.is = {...this.is}
        return clone
    },
}

export function resolvePromptRepo(raw, refArl) {
    return new PromptRepo().resolve(raw, refArl)
}
