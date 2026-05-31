import {safety} from './safety.js'

export function SecurityReporterFactory(tx, sx = null) {

    const mode = sx?.mode ?? 'warn'
    let currentTx = tx
    let safetyControl = safety.enable({mode}, {
        send(name, payload) {
            if (name !== 'security.event') return 0
            return currentTx.send('security.event', payload)
        }
    })

    return {
        configure(nextSettings = null) {

            const nextMode = nextSettings?.mode ?? mode

            safetyControl.uninstall()
            safetyControl = safety.enable({mode: nextMode}, {
                send(name, payload) {
                    if (name !== 'security.event') return 0
                    return currentTx.send('security.event', payload)
                }
            })
        },

        setTx(nextTx) {
            currentTx = nextTx ?? currentTx
        },
    }
}
