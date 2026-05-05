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
let effectsText = '[]'
let examplesText = ''
let usageGuidanceText = ''
let error = ''

onMount(() => {
    tx.send('modal div', box.div)
})

export const handlers = {
    onShow({pos, pin: shownPin, ok: okFn, cancel}) {
        pin = shownPin
        ok = okFn
        settings = makeSettings(pin)
        schemaText = jsonText(settings.schema, '{}')
        effectsText = jsonText(settings.effects, '[]')
        examplesText = jsonText(settings.examples, '')
        usageGuidanceText = jsonText(settings.usageGuidance, '')
        error = ''

        box.title = `Tool settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`
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
    const current = pin?.tool ?? {}
    return {
        enabled: current.enabled ?? false,
        id: current.id ?? defaultId(pin),
        title: current.title ?? titleFromName(pin?.name),
        description: current.description ?? pin?.prompt ?? '',
        risk: current.risk ?? 'low',
        approval: current.approval ?? 'never',
        timeoutMs: current.timeoutMs ?? '',
        effects: current.effects ?? [],
        examples: current.examples,
        usageGuidance: current.usageGuidance,
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
        risk: settings.risk,
        approval: settings.approval,
    }

    if (!next.enabled) return {enabled: false}

    if (!next.id) {
        error = 'id is required'
        return null
    }

    const schema = parseOptionalJson(schemaText, 'schema')
    if (schema === undefined) return null
    if (schema !== null) next.schema = schema

    const effects = parseOptionalJson(effectsText, 'effects')
    if (effects === undefined) return null
    next.effects = Array.isArray(effects) ? effects : []

    if (settings.timeoutMs !== '') {
        const timeoutMs = Number(settings.timeoutMs)
        if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
            error = 'timeoutMs must be a positive integer'
            return null
        }
        next.timeoutMs = timeoutMs
    }

    const examples = parseOptionalJson(examplesText, 'examples')
    if (examples === undefined) return null
    if (examples !== null) next.examples = examples

    const usageGuidance = parseOptionalJson(usageGuidanceText, 'usageGuidance')
    if (usageGuidance === undefined) return null
    if (usageGuidance !== null) next.usageGuidance = usageGuidance

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
select,
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

.row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
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
            expose input pin as agent tool
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

        <div class="row">
            <label>
                risk
                <select bind:value={settings.risk}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                </select>
            </label>

            <label>
                approval
                <select bind:value={settings.approval}>
                    <option value="never">never</option>
                    <option value="on-request">on-request</option>
                    <option value="always">always</option>
                </select>
            </label>
        </div>

        <label>
            timeoutMs
            <input spellcheck="false" bind:value={settings.timeoutMs} />
        </label>

        <label>
            schema JSON
            <textarea spellcheck="false" bind:value={schemaText}></textarea>
        </label>

        <label>
            effects JSON
            <textarea spellcheck="false" bind:value={effectsText}></textarea>
        </label>

        <label>
            examples JSON
            <textarea spellcheck="false" bind:value={examplesText}></textarea>
        </label>

        <label>
            usageGuidance JSON
            <textarea spellcheck="false" bind:value={usageGuidanceText}></textarea>
        </label>

        {#if error}
            <div class="error">{error}</div>
        {/if}
    </div>
</PopupBox>
