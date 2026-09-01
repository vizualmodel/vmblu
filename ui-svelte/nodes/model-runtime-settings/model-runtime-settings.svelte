<script>
import SecurityDetailPopup from './security-detail-popup.svelte'

export let tx

let fsPopup
let netPopup
let processPopup

export const handlers = {"-> show": show}

function show({category, security, pos, ok, cancel}) {
    const common = {
        pos: {...(pos ?? {x: 40, y: 40})},
        cancel,
    }

    if (category === 'fs') {
        fsPopup.show({
            ...common,
            title: 'File System Security',
            operations: security.fs,
            labels: {read: 'Read', write: 'Write', delete: 'Delete'},
            targetKey: 'roots',
            targetLabel: 'locations',
            ok: operations => ok?.({...security, fs: operations}),
        })
        return
    }

    if (category === 'net') {
        netPopup.show({
            ...common,
            title: 'Network Security',
            operations: security.net,
            labels: {egress: 'Egress'},
            targetKey: 'hosts',
            targetLabel: 'hosts',
            ok: operations => ok?.({...security, net: operations}),
        })
        return
    }

    if (category === 'process') {
        processPopup.show({
            ...common,
            title: 'Process Security',
            operations: security.process,
            labels: {exec: 'Execute'},
            targetKey: 'commands',
            targetLabel: 'commands',
            ok: operations => ok?.({...security, process: operations}),
        })
    }
}
</script>

<SecurityDetailPopup bind:this={fsPopup} {tx} />
<SecurityDetailPopup bind:this={netPopup} {tx} />
<SecurityDetailPopup bind:this={processPopup} {tx} />
