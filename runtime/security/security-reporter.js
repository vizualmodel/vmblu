import {safety} from './safety.js'

export function SecurityReporterFactory(tx) {
    let currentTx = tx
    let unsubscribe = safety.subscribe((event) => {
        currentTx?.send?.('security.event', event)
    })

    return {
        setTx(nextTx) {
            currentTx = nextTx ?? currentTx
        },

        stop() {
            unsubscribe()
            unsubscribe = () => {}
        },
    }
}
