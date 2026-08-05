import {Cable} from './cable.js'

// Compatibility wrapper for older code/tests that still construct Bus.
// It creates a Cable carrying the legacy is.floating serialization marker.
export function Bus(from = {x:0, y:0}, uid = null) {
    if (typeof from === 'string') {
        uid = arguments[2] ?? null
        from = arguments[1]
    }
    return new Cable(from, uid, true)
}
