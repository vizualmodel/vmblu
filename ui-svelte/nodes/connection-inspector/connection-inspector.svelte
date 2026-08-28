<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import LabelSelect from '../../fragments/label-select.svelte'

export let tx

const transports = ['unspecified', 'http', 'https', 'websocket', 'tcp', 'udp', 'in-process', 'ipc', 'queue', 'file', 'shared-store', 'other']
const labelStyle = 'width: 7rem;'

let box = {div: null, pos: null, title: '', ok: null, cancel: null}
let original = {}
let transport = 'unspecified'
let remarks = ''

$: transportOptions = transports.includes(transport) ? transports : [transport, ...transports]

onMount(() => tx.send('modal div', box.div))

function submit(ok) {
    const connection = {...original, transport}
    const cleanRemarks = remarks.trim()
    if (cleanRemarks) connection.remarks = cleanRemarks
    else delete connection.remarks
    delete connection.name
    delete connection.description
    delete connection.flow
    delete connection.direction
    delete connection.protocol
    ok?.(connection)
    return true
}

export const handlers = {
    onConnectionSettings({pos, connection, ok, cancel, trash}) {
        original = structuredClone(connection ?? {})
        transport = original.transport ?? 'unspecified'
        remarks = original.remarks ?? ''
        box.title = 'Transport'
        box.largeTitle = true
        box.pos = {...pos}
        box.ok = () => submit(ok)
        box.cancel = cancel ? () => cancel() : null
        box.trash = trash ? () => trash() : null
        box.show(pos)
    },
}
</script>

<style>
.inspector { width: min(38rem, calc(100vw - 4rem)); }
</style>

<PopupBox box={box}>
    <div class="inspector">
        <LabelSelect label="Transport" style={labelStyle} bind:value={transport} options={transportOptions} />
        <LabelTextarea label="Remarks" style={labelStyle} bind:text={remarks} />
    </div>
</PopupBox>
