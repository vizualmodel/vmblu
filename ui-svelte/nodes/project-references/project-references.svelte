<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'

export let tx
const kinds = ['prompt', 'documentation', 'model', 'source', 'build', 'deployment', 'test', 'operations', 'other']
let box = {div: null, title: 'Project references'}
let references = []
let error = ''
let request = null
onMount(() => tx.send('modal div', box.div))

function add() {
    references = [...references, {label: '', kind: 'documentation', target: ''}]
}

function save() {
    const clean = references.map(reference => ({...reference,
        label: (reference.label ?? '').trim(), target: (reference.target ?? '').trim(),
    }))
    if (clean.some(reference => !reference.target || !kinds.includes(reference.kind))) {
        error = 'Every reference needs a kind and path.'
        return false
    }
    request.ok?.(clean)
    return true
}

function accept() {
    if (save()) box.hide()
}

function cancel() {
    box.hide()
    request.cancel?.()
}

export const handlers = {
    onProjectReferences(payload) {
        request = payload
        references = structuredClone(payload.references ?? [])
        error = ''
        box.title = 'Project references'
        box.largeTitle = true
        box.ok = save
        box.cancel = payload.cancel
        box.add = add
        box.show(payload.pos)
    },
}
</script>

<PopupBox {box}>
    <div class="references">
        <p>Paths are relative to the active .sys.blu file. Web URLs are also supported.</p>
        <div class="rows">
            {#if references.length === 0}<p>No project references yet. Use + to add a reference.</p>{/if}
            {#each references as reference, index}
                <div class="row">
                    <button type="button" title="Open reference" aria-label="Open reference" disabled={!reference.target?.trim()} on:click={() => request.open?.(reference)}>
                        <span class="material-icons-outlined" aria-hidden="true">file_open</span>
                    </button>
                    <input aria-label="Reference label" placeholder="Label" bind:value={reference.label} />
                    <select aria-label="Reference kind" bind:value={reference.kind}>
                        {#each kinds as kind}<option value={kind}>{kind}</option>{/each}
                    </select>
                    <input class="path" aria-label="Relative path or URL" placeholder="../docs/document.md" spellcheck="false" bind:value={reference.target} />
                    <button class="remove" type="button" title="Remove reference (keeps the file)" aria-label="Remove reference" on:click={() => references = references.filter((_, i) => i !== index)}>
                        <span class="material-icons-outlined" aria-hidden="true">delete</span>
                    </button>
                </div>
            {/each}
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <div class="actions"><button type="button" on:click={cancel}>Cancel</button><button type="button" on:click={accept}>Save</button></div>
    </div>
</PopupBox>

<style>
.references { width: min(64rem, calc(100vw - 8rem)); color: #ccc; }
p { font-size: 0.8rem; }
.rows { max-height: 60vh; overflow: auto; }
.row { display: grid; grid-template-columns: 2rem minmax(7rem, 1fr) 9rem minmax(12rem, 2fr) 2rem; gap: 0.5rem; align-items: center; margin: 0.5rem 0; }
input, select { box-sizing: border-box; min-width: 0; width: 100%; background: #171717; color: #ddd; border: 1px solid #555; padding: 0.4rem; }
.path { font-family: monospace; }
button { background: transparent; color: #e2c64e; border: 1px solid #555; border-radius: 0.2rem; padding: 0.25rem; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: default; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #0fb2e4; }
.material-icons-outlined { font-size: 1.2rem; }
.remove, .error { color: #ff6868; }
.actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.8rem; }
.actions button { padding: 0.4rem 1rem; }
</style>
