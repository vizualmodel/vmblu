// Bundled at build time; published runtimes do not depend on the core package.
import {compatibilityFamily, versionsAreCompatible} from '../../core/types/model/version-policy.js'
import {RUNTIME_VERSION} from './release-version.js'

export function runtimeCompatibilityFamily(version = RUNTIME_VERSION) {
    return compatibilityFamily(version)
}

export function assertRuntimeCompatibility(expectedFamily) {
    const actualFamily = runtimeCompatibilityFamily()
    if (!expectedFamily) return actualFamily
    if (!versionsAreCompatible(RUNTIME_VERSION, expectedFamily + '.0')) {
        throw new Error(`Incompatible vmblu runtime ${RUNTIME_VERSION}; generated application requires compatibility family ${expectedFamily}`)
    }
    return actualFamily
}
