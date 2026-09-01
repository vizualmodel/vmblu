import {ARL, Path} from '../arl/index.js'

export function TestRepo(arl=null, pathKind=Path.Kind.Empty, readOnly=false) {
    this.arl = arl
    this.pathKind = pathKind
    this.readOnly = readOnly
}

TestRepo.prototype = {

    getPath(refArl) {
        if (!this.arl || this.pathKind === Path.Kind.Empty) return ''
        if (!refArl) return this.arl.getPath()
        return this.pathKind === Path.Kind.Absolute
            ? this.arl.getPath()
            : Path.relative(this.arl.getFullPath(), refArl.getFullPath())
    },

    makeRaw(refArl) {
        return {
            arl: this.getPath(refArl),
            pathKind: this.pathKind,
        }
    },

    resolve(raw, refArl, {readOnly=false}={}) {
        if (!raw?.arl || !refArl) return null
        const normalized = Path.normalizeSeparators(raw.arl)
        this.pathKind = raw.pathKind ?? Path.getKind(normalized)
        this.arl = this.pathKind === Path.Kind.Absolute ? new ARL(normalized) : refArl.resolve(normalized)
        this.readOnly = readOnly
        return this
    },

    clone({readOnly=this.readOnly}={}) {
        return new TestRepo(this.arl?.copy?.() ?? this.arl, this.pathKind, readOnly)
    },
}

export function resolveTestRepo(raw, refArl, options) {
    return new TestRepo().resolve(raw, refArl, options)
}
