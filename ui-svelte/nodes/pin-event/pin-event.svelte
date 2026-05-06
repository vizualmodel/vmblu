<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'

export let tx

let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let pin = null
let ok = null
let settings = makeSettings(null)
let schemaText = '{}'
let error = ''

onMount(() => {
    tx.send('modal div', box.div)
})

// small helper
const closeBox = () => {
    pin = null
    box.hide()        
}

export const handlers = {
    onShow({pos, pin: shownPin, ok: okFn, cancel}) {

        // toggle behaviour for repeat key press
        if (pin && pin == shownPin) return closeBox();

        pin = shownPin
        ok = okFn
        settings = makeSettings(pin)
        schemaText = jsonText(settings.schema, '{}')
        error = ''

        box.title = `Event settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`
        box.pos = {...pos}
        box.ok = submit
        box.cancel = () => cancel?.()
        box.show(box.pos)
    },
}

function submit() {
    const next = collectSettings()
    if (!next) {
        box.show(box.pos)
        return
    }

    ok?.(next)
}

function makeSettings(pin) {
    const current = pin?.event ?? {}
    return {
        enabled: current.enabled ?? false,
        id: current.id ?? defaultId(pin),
        title: current.title ?? titleFromName(pin?.name),
        description: current.description ?? pin?.prompt ?? '',
        schema: current.schema,
    }
}

function collectSettings() {
    error = ''

    const next = {
        enabled: settings.enabled,
        id: settings.id.trim(),
        title: settings.title.trim(),
        description: settings.description.trim(),
    }

    if (!next.enabled) return {enabled: false}

    if (!next.id) {
        error = 'id is required'
        return null
    }

    const schema = parseOptionalJson(schemaText, 'schema')
    if (schema === undefined) return null
    if (schema !== null) next.schema = schema

    return next
}

function parseOptionalJson(text, label) {
    if (!text?.trim()) return null

    try {
        return JSON.parse(text)
    }
    catch (err) {
        error = `${label} is not valid JSON`
        return undefined
    }
}

function jsonText(value, fallback) {
    return value == null ? fallback : JSON.stringify(value, null, 2)
}

function defaultId(pin) {
    const pinName = String(pin?.name ?? '').trim()
    const nodeName = String(pin?.node?.name ?? '').trim()

    if (pinName && nodeName) return `${pinName} @ ${nodeName}`
    return pinName || nodeName
}

function titleFromName(name) {
    return String(name ?? '')
        .replace(/[-_.]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
}
</script>

<style>
.form {
    display: grid;
    gap: 0.45rem;
    min-width: 24rem;
    max-width: 34rem;
}

label {
    display: grid;
    gap: 0.15rem;
    color: #ddd;
    font-family: var(--fBase);
    font-size: 0.78rem;
}

.inline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

input,
textarea {
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

textarea {
    min-height: 3.8rem;
    resize: vertical;
}

.error {
    color: #ff7777;
    font-family: var(--fBase);
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
            id
            <input spellcheck="false" bind:value={settings.id} />
        </label>

        <label>
            title
            <input spellcheck="false" bind:value={settings.title} />
        </label>

        <label>
            description
            <textarea spellcheck="false" bind:value={settings.description}></textarea>
        </label>

        <label>
            schema JSON
            <textarea spellcheck="false" bind:value={schemaText}></textarea>
        </label>

        {#if error}
            <div class="error">{error}</div>
        {/if}
    </div>
</PopupBox>
