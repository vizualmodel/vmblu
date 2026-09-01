<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import Button from '../../fragments/button.svelte'

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
let settings = makeSettings()
let inputSchema = {type: 'object'}
let outputSchema = null
let available = {events: [], probes: []}
let verificationOpen = false
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
    onShow({pos, pin: shownPin, capability = {}, capabilities = {}, ok: okFn, cancel}) {
        if (pin && pin === shownPin) return closeBox()

        pin = shownPin
        ok = okFn
        settings = makeSettings(pin, capability.suggestedId)
        inputSchema = capability.inputSchema ?? {type: 'object'}
        outputSchema = capability.hasOutput ? (capability.outputSchema ?? {type: 'object'}) : null
        available = {
            events: Array.isArray(capabilities?.events) ? capabilities.events : [],
            probes: Array.isArray(capabilities?.probes) ? capabilities.probes : [],
        }
        verificationOpen = settings.verification.events.length > 0
            || settings.verification.probes.length > 0
            || !!settings.verification.description
        migrationWarning = legacyWarning(pin?.tool)
        error = ''

        box.title = `Tool settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`
        box.pos = {...pos}
        box.ok = submit
        box.cancel = () => cancel?.()
        box.show(box.pos)
    },
}

$: verificationSummary = [
    settings.verification.events.length ? `${settings.verification.events.length} event(s)` : '',
    settings.verification.probes.length ? `${settings.verification.probes.length} probe(s)` : '',
].filter(Boolean).join(', ') || 'No verification evidence'

function makeSettings(value = null, suggestedId = '') {
    const current = value?.tool ?? {}
    const effects = Array.isArray(current.effects) ? current.effects : []
    const events = new Set()
    const probes = new Set()
    let timeoutMs = ''

    for (const effect of effects) {
        for (const id of effect?.verifyWith?.events ?? []) if (id) events.add(id)
        for (const value of effect?.verifyWith?.probes ?? []) {
            const id = typeof value === 'string' ? value : value?.id
            if (id) probes.add(id)
        }
        if (Number.isInteger(effect?.timeoutMs)) timeoutMs = Math.max(Number(timeoutMs) || 0, effect.timeoutMs)
    }

    return {
        enabled: current.enabled ?? false,
        id: current.id ?? suggestedId ?? makeFallbackId(value),
        risk: current.risk ?? 'low',
        approval: current.approval === 'always' ? 'always' : 'never',
        verification: {
            description: effects[0]?.description ?? '',
            events: [...events],
            probes: [...probes],
            timeoutMs,
        },
    }
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

    const next = {
        enabled: !!settings.enabled,
        ...(id ? {id} : {}),
        risk: settings.risk,
        approval: settings.approval,
    }

    const effect = collectEffect(id)
    if (error) {
        box.show(box.pos)
        return
    }
    if (effect) next.effects = [effect]
    ok?.(next)
}

function collectEffect(toolId) {
    const verification = settings.verification
    const timeoutText = String(verification.timeoutMs ?? '').trim()
    let timeoutMs = null

    if (timeoutText) {
        timeoutMs = Number(timeoutText)
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
            error = 'verification timeout must be a positive integer'
            return null
        }
    }

    if (!verification.description.trim() && !verification.events.length && !verification.probes.length) return null

    const effect = {
        id: `${toolId || 'tool'}.effect`,
        description: verification.description.trim(),
        verifyWith: {
            events: [...verification.events],
            probes: [...verification.probes],
        },
    }
    if (timeoutMs != null) effect.timeoutMs = timeoutMs
    return effect
}

function toggleEvidence(kind, id, checked) {
    const selected = new Set(settings.verification[kind])
    if (checked) selected.add(id)
    else selected.delete(id)
    settings.verification[kind] = [...selected]
    settings = {...settings}
}

function hasEvidence(kind, id) {
    return settings.verification[kind].includes(id)
}

function makeFallbackId(value) {
    return [value?.node?.name, value?.name]
        .map(part => String(part ?? '').trim().replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^[._-]+|[._-]+$/g, ''))
        .filter(Boolean)
        .join('.') || 'tool'
}

function legacyWarning(current = {}) {
    const legacy = ['title', 'description', 'schema', 'examples', 'usageGuidance', 'timeoutMs']
        .filter(key => current?.[key] != null)
    if ((current?.effects?.length ?? 0) > 1) legacy.push('multiple effects')
    return legacy.length
        ? `Legacy ${legacy.join(', ')} metadata will be replaced by canonical derived or structured values when you save.`
        : ''
}
</script>

<style>
.form {
    display: grid;
    gap: 0.55rem;
    min-width: 30rem;
    max-width: 46rem;
    max-height: 76vh;
    overflow: auto;
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

.row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.55rem;
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
    min-height: 3.2rem;
    resize: vertical;
}

details,
.verification {
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
    max-height: 15rem;
    overflow: auto;
    margin: 0.45rem 0 0;
    color: #ccc;
    font-family: var(--fFixed);
    font-size: 0.72rem;
    white-space: pre-wrap;
}

.verification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.verification-title {
    color: #e2c64e;
}

.hint,
.capability-id {
    color: #aaa;
    font-size: 0.72rem;
}

.evidence-list {
    display: grid;
    gap: 0.2rem;
    max-height: 9rem;
    overflow: auto;
    margin: 0.25rem 0 0.5rem;
}

.evidence-item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.45rem;
    align-items: start;
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
            expose input pin as agent tool
        </label>

        <label>
            ID
            <input spellcheck="false" bind:value={settings.id} />
        </label>

        <div class="row">
            <label>
                Risk
                <select bind:value={settings.risk}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                </select>
            </label>

            <label>
                Approval
                <select bind:value={settings.approval}>
                    <option value="never">never</option>
                    <option value="always">always</option>
                </select>
            </label>
        </div>

        <details open>
            <summary>Input schema</summary>
            <pre>{JSON.stringify(inputSchema, null, 2)}</pre>
        </details>

        {#if outputSchema}
            <details>
                <summary>Output schema</summary>
                <pre>{JSON.stringify(outputSchema, null, 2)}</pre>
            </details>
        {/if}

        <div class="verification">
            <div class="verification-header">
                <div>
                    <div class="verification-title">Verification</div>
                    <div class="hint">{verificationSummary}</div>
                </div>
                <Button label={verificationOpen ? 'Hide details' : 'Set verification'} click={() => verificationOpen = !verificationOpen} />
            </div>

            {#if verificationOpen}
                <label>
                    Expected effect
                    <textarea spellcheck="false" bind:value={settings.verification.description}></textarea>
                </label>

                <div class="row">
                    <div>
                        <div class="verification-title">Events</div>
                        <div class="evidence-list">
                            {#each available.events as item}
                                <label class="evidence-item">
                                    <input type="checkbox" checked={hasEvidence('events', item.id)} on:change={(event) => toggleEvidence('events', item.id, event.currentTarget.checked)} />
                                    <span>{item.title || item.id}<span class="capability-id"> {item.id}</span></span>
                                </label>
                            {/each}
                            {#if !available.events.length}<div class="hint">No exposed events</div>{/if}
                        </div>
                    </div>
                    <div>
                        <div class="verification-title">Probes</div>
                        <div class="evidence-list">
                            {#each available.probes as item}
                                <label class="evidence-item">
                                    <input type="checkbox" checked={hasEvidence('probes', item.id)} on:change={(event) => toggleEvidence('probes', item.id, event.currentTarget.checked)} />
                                    <span>{item.title || item.id}<span class="capability-id"> {item.id}</span></span>
                                </label>
                            {/each}
                            {#if !available.probes.length}<div class="hint">No exposed probes</div>{/if}
                        </div>
                    </div>
                </div>

                <label>
                    Verification timeout (ms)
                    <input spellcheck="false" bind:value={settings.verification.timeoutMs} />
                </label>
            {/if}
        </div>

        {#if migrationWarning}
            <div class="warning">{migrationWarning}</div>
        {/if}
        {#if error}
            <div class="error">{error}</div>
        {/if}
    </div>
</PopupBox>
