<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelInputField from '../../fragments/label-input-field.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import PathInputField from '../../fragments/path-input-field.svelte'

export let tx

const roles = ['client', 'server', 'peer']
const labelStyle = 'width: 7rem;'

let box = {div: null, pos: null, title: '', ok: null, cancel: null}
let original = {}
let existingIds = []
let name = ''
let protocol = ''
let role = 'client'
let remarks = ''
let error = ''
let openProtocol = null

onMount(() => tx.send('modal div', box.div))

function slug(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'endpoint'
}

function uniqueId(value) {
    if (original.id) return original.id
    const base = slug(value)
    let id = base
    let suffix = 2
    while (existingIds.includes(id)) id = `${base}-${suffix++}`
    return id
}

function submit(ok) {
    const cleanName = name.trim()
    const cleanProtocol = protocol.trim()
    if (!cleanName) error = 'The endpoint name is required.'
    else {
        const endpoint = {
            ...original,
            id: uniqueId(cleanName),
            name: cleanName,
            role,
        }
        if (cleanProtocol) endpoint.protocol = cleanProtocol
        else delete endpoint.protocol
        delete endpoint.references
        const cleanRemarks = remarks.trim()
        if (cleanRemarks) endpoint.remarks = cleanRemarks
        else delete endpoint.remarks
        delete endpoint.description
        delete endpoint.direction
        delete endpoint.transport

        error = ''
        ok?.(endpoint)
        return true
    }
    return false
}

export const handlers = {
    onEndpointSettings({pos, endpoint, endpointIds = [], open, ok, cancel, trash}) {
        original = structuredClone(endpoint ?? {})
        existingIds = [...endpointIds]
        name = original.name ?? ''
        protocol = original.protocol ?? ''
        role = original.role ?? 'client'
        remarks = original.remarks ?? ''
        error = ''
        openProtocol = typeof open === 'function' ? open : null
        box.title = 'Endpoint'
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
.error { margin: 0.45rem 0 0; color: #ff6868; font: 0.75rem arial, helvetica, sans-serif; }
</style>

<PopupBox box={box}>
    <div class="inspector">
        <LabelInputField label="Name" style={labelStyle} bind:input={name} check={value => Boolean(value.trim())} />
        <PathInputField label="Protocol" style={labelStyle} bind:input={protocol} check={null} openFile={openProtocol} showOpenFile={true} />
        <LabelSelect label="Role" style={labelStyle} bind:value={role} options={roles} />
        <LabelTextarea label="Remarks" style={labelStyle} bind:text={remarks} />

        {#if error}<p class="error">{error}</p>{/if}
    </div>
</PopupBox>
