<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'

export let tx

const modes = ['allow', 'warn', 'deny']
const box = {div: null, pos: null, title: '', ok: null, cancel: null}

let rows = []
let scopeKey = 'roots'
let scopeLabel = 'locations'
let error = ''

onMount(() => tx.send('modal div', box.div))

export function show({title, operations, labels, targetKey, targetLabel, pos, ok, cancel}) {
    scopeKey = targetKey
    scopeLabel = targetLabel
    rows = Object.entries(operations).map(([key, operation]) => ({
        key,
        label: labels[key] ?? key,
        mode: operation.mode,
        all: operation.all === true,
        targets: Array.isArray(operation[targetKey]) ? operation[targetKey].join('\n') : '',
    }))
    error = ''
    box.title = title
    box.pos = {...pos}
    box.ok = () => save(ok)
    box.cancel = () => cancel?.()
    box.show(box.pos)
}

function save(ok) {
    const operations = {}
    for (const row of rows) {
        if (row.mode === 'deny') {
            operations[row.key] = {mode: 'deny'}
            continue
        }
        if (row.all) {
            operations[row.key] = {mode: row.mode, all: true}
            continue
        }
        const targets = textToList(row.targets)
        if (!targets.length) {
            error = `${row.label} requires ${scopeLabel}, or select All ${scopeLabel}.`
            box.show(box.pos)
            return
        }
        const invalid = targets.find(target => !validTarget(target))
        if (invalid) {
            error = `${row.label} contains an invalid ${scopeKey} value: ${invalid}`
            box.show(box.pos)
            return
        }
        operations[row.key] = {mode: row.mode, [scopeKey]: targets}
    }
    error = ''
    ok?.(operations)
}

function validTarget(value) {
    if (!value || value.includes('\0')) return false
    if (scopeKey !== 'hosts') return true
    if (value.includes('/') || value.includes(':')) return false
    try {
        return !!new URL(`http://${value}`).hostname
    }
    catch {
        return false
    }
}

function textToList(text) {
    return [...new Set((text ?? '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean))]
}
</script>

<style>
.security-details {
    width: 34rem;
    max-width: 80vw;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.operation {
    border-top: 1px solid #444;
    margin-top: 0.6rem;
    padding-top: 0.6rem;
}

.operation:first-child {
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
}

.operation h4 {
    margin: 0 0 0.4rem;
    color: #eee;
    font-weight: normal;
}

.hint,
.error {
    margin: 0.35rem 0;
}

.hint { color: #999; }
.error { color: #ff8080; }
</style>

<PopupBox box={box}>
    <div class="security-details">
        {#each rows as row}
            <div class="operation">
                <h4>{row.label}</h4>
                <LabelSelect label="Mode" bind:value={row.mode} options={modes} />
                {#if row.mode === 'deny'}
                    <p class="hint">This operation has no permitted targets.</p>
                {:else}
                    <LabelCheckbox label={`All ${scopeLabel}`} bind:on={row.all} />
                    <LabelTextarea label={scopeLabel} bind:text={row.targets} disabled={row.all} />
                {/if}
            </div>
        {/each}
        {#if error}<p class="error">{error}</p>{/if}
    </div>
</PopupBox>
