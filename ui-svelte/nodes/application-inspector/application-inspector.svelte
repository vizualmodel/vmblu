<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelInputField from '../../fragments/label-input-field.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'
import PathInputField from '../../fragments/path-input-field.svelte'

export let tx

const referenceKinds = ['documentation', 'model', 'source', 'build', 'deployment', 'test', 'operations', 'other']
const labelStyle = 'width: 5rem;'
const referenceLabelStyle = 'width: 7.5rem;'

let box = {div: null, pos: null, title: '', ok: null, cancel: null}
let name = ''
let role = ''
let vmblu = true
let references = []
let error = ''

onMount(() => tx.send('modal div', box.div))

function cloneReferences(value) {
    return (value ?? []).map(reference => ({...reference}))
}

function addReference() {
    references = [...references, {kind: 'documentation', label: '', target: ''}]
}

function removeReference(index) {
    references = references.filter((_, candidate) => candidate !== index)
}

function submit(ok) {
    const cleanName = name.trim()
    const cleanReferences = references.map(reference => {
        const command = reference.command?.trim()
        const workingDirectory = reference.workingDirectory?.trim()
        const clean = {
            ...reference,
            kind: reference.kind?.trim(),
            label: reference.label?.trim(),
            target: reference.target?.trim(),
        }
        if (command || workingDirectory) {
            clean.command = command
            clean.workingDirectory = workingDirectory
        }
        else {
            delete clean.command
            delete clean.workingDirectory
        }
        return clean
    })

    if (!cleanName) error = 'The application name is required.'
    else if (cleanReferences.some(reference => !reference.kind || !reference.target)) {
        error = 'Every reference needs a kind and path.'
    }
    else if (cleanReferences.some(reference => Boolean(reference.command) !== Boolean(reference.workingDirectory))) {
        error = 'A command reference needs both a command and working directory.'
    }
    else {
        error = ''
        ok?.({name: cleanName, role: role.trim(), vmblu, references: cleanReferences})
        return true
    }
    return false
}

export const handlers = {
    onApplicationSettings({pos, application, ok, cancel, trash}) {
        name = application?.name ?? ''
        role = application?.description ?? ''
        vmblu = application?.vmblu !== false
        references = cloneReferences(application?.references)
        error = ''
        box.title = 'Application'
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
.inspector {
    width: min(42rem, calc(100vw - 4rem));
}

.references-header,
.reference-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.references-header {
    justify-content: space-between;
    margin: 0.8rem 0 0.35rem;
    color: #ccc;
    font: 0.75rem arial, helvetica, sans-serif;
}

.reference-row {
    margin-bottom: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid #333;
}

.reference-fields {
    flex: 1;
    min-width: 0;
}

button {
    color: #c0c022;
    background: transparent;
    border: 0;
    cursor: pointer;
}

button.remove {
    color: #a52b2b;
}

.error {
    margin: 0.45rem 0 0;
    color: #ff6868;
    font: 0.75rem arial, helvetica, sans-serif;
}
</style>

<PopupBox box={box}>
    <div class="inspector">
        <LabelInputField label="Name" style={labelStyle} bind:input={name} check={value => Boolean(value.trim())} />
        <LabelTextarea label="Role" style={labelStyle} bind:text={role} />
        <LabelCheckbox label="vmblu application" style={labelStyle} bind:on={vmblu} />

        <div class="references-header">
            <span>Typed references</span>
            <button type="button" title="Add reference" on:click={addReference}>+ Add reference</button>
        </div>

        {#each references as reference, index}
            <div class="reference-row">
                <div class="reference-fields">
                    <LabelSelect label="Kind" style={referenceLabelStyle} bind:value={reference.kind} options={referenceKinds} />
                    <LabelInputField label="Label" style={referenceLabelStyle} bind:input={reference.label} check={null} />
                    <PathInputField label="Path or URL" style={referenceLabelStyle} bind:input={reference.target} check={value => Boolean(value.trim())} />
                    <LabelInputField label="Command" style={referenceLabelStyle} bind:input={reference.command} check={null} />
                    <PathInputField label="Working directory" style={referenceLabelStyle} bind:input={reference.workingDirectory} check={null} />
                </div>
                <button class="remove" type="button" title="Remove reference" on:click={() => removeReference(index)}>remove</button>
            </div>
        {/each}

        {#if error}<p class="error">{error}</p>{/if}
    </div>
</PopupBox>
