import {installSafetyHooks} from './safety-hooks.js'
import {setSafetyEmitter} from './safety-events.js'

export function enableSafety({mode = 'off'} = {}, tx = null) {
    if (mode === 'off') {
        setSafetyEmitter(null)
        return {uninstall() {}}
    }

    setSafetyEmitter((event) => {
        tx?.send?.('security.event', event)
    })

    const uninstallHooks = installSafetyHooks({mode})

    return {
        uninstall() {
            uninstallHooks()
            setSafetyEmitter(null)
        }
    }
}
