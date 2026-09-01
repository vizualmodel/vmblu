<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'

export let tx

const ID_PATTERN = /^[A-Za-z0-9_.-]+$/

let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let pin = null
let ok = null
let settings = {enabled: false, id: ''}
let payloadSchema = {type: 'object'}
let error = ''
let migrationWarning = ''

onMount(() => {
    tx.send('modal div', box.div)
})

const closeBox = () => {
    pin = null
    box.hide()
}

export const handlers = {
    onShow({pos, pin: shownPin, capability = {}, ok: okFn, cancel}) {
        if (pin && pin === shownPin) return closeBox()

        pin = shownPin
        ok = okFn
        const current = pin?.event ?? {}
        settings = {
            enabled: current.enabled ?? false,
            id: current.id ?? capability.suggestedId ?? makeFallbackId(pin),
        }
        payloadSchema = capability.payloadSchema ?? {type: 'object'}
        migrationWarning = legacyWarning(current)
        error = ''

        box.title = `Event settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`
        box.pos = {...pos}
        box.ok = submit
        box.cancel = () => cancel?.()
        box.show(box.pos)
    },
}

function submit() {
    error = ''
    const id = String(settings.id ?? '').trim()

    if (settings.enabled && !id) {
        error = 'id is required'
        box.show(box.pos)
        return
    }
    if (id && !ID_PATTERN.test(id)) {
        error = 'id may contain only letters, digits, dot, dash, and underscore'
        box.show(box.pos)
        return
    }

    ok?.({enabled: !!settings.enabled, ...(id ? {id} : {})})
}

function makeFallbackId(value) {
    return [value?.node?.name, value?.name]
        .map(part => String(part ?? '').trim().replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^[._-]+|[._-]+$/g, ''))
        .filter(Boolean)
        .join('.') || 'event'
}

function legacyWarning(current) {
    const legacy = ['title', 'description', 'schema'].filter(key => current?.[key] != null)
    return legacy.length
        ? `Legacy ${legacy.join(', ')} metadata will be replaced by values derived from the pin contract when you save.`
        : ''
}
</script>

<style>
.form {
    display: grid;
    gap: 0.55rem;
    min-width: 28rem;
    max-width: 42rem;
}

label {
    display: grid;
    gap: 0.2rem;
    color: #ddd;
    font-family: var(--fBase);
    font-size: 0.78rem;
}

.inline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

input {
    box-sizing: border-box;
    width: 100%;
    background: #1f1f1f;
    color: #ddd;
    border: 1px solid #555;
    border-radius: 0.15rem;
    padding: 0.25rem 0.35rem;
    font-family: var(--fFixed);
    font-size: 0.76rem;
}

input[type="checkbox"] {
    width: auto;
}

details {
    border: 1px solid #444;
    border-radius: 0.2rem;
    padding: 0.4rem;
}

summary {
    cursor: pointer;
    color: #e2c64e;
    font-family: var(--fBase);
}

pre {
    max-height: 17rem;
    overflow: auto;
    margin: 0.45rem 0 0;
    color: #ccc;
    font-family: var(--fFixed);
    font-size: 0.72rem;
    white-space: pre-wrap;
}

.warning {
    color: #e2c64e;
    font-size: 0.74rem;
}

.error {
    color: #ff7777;
    font-size: 0.76rem;
}
</style>

<PopupBox box={box}>
    <div class="form">
        <label class="inline">
            <input type="checkbox" bind:checked={settings.enabled} />
            expose output pin as agent event
        </label>

        <label>
            ID
            <input spellcheck="false" bind:value={settings.id} />
        </label>

        <details open>
            <summary>Payload schema</summary>
            <pre>{JSON.stringify(payloadSchema, null, 2)}</pre>
        </details>

        {#if migrationWarning}
            <div class="warning">{migrationWarning}</div>
        {/if}
        {#if error}
            <div class="error">{error}</div>
        {/if}
    </div>
</PopupBox>
