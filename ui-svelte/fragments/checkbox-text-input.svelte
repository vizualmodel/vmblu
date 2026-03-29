<script>
import {onMount} from 'svelte'

export let label
export let field // checked + text
export let onCheck
export let onInput

// random field id
let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

onMount(() => {
    // set the update function
    field.update = () => field = field
})

// call the on color function if requested
function onCheckBox(e) { 
    onCheck?.(field.checked)
}

function onInputField(e) {
    onInput?.(field.value)
}

</script>
<style>

.checkbox-text-input-field {

    --fontBase: arial, helvetica, sans-serif;
    --sLabel:0.7rem;
    --sInput:0.9rem;
    --cLabel:#eee;
    --bgFieldFocus:#222;

    display: flex;
    align-items: center;
    background: transparent;
    padding-bottom: 0.2rem;
}
input.checkbox {
    background: transparent;
    margin-right: 0.5rem;
}
label {
    font-family: var(--fontBase);
    color: var(--cLabel);
    font-size: var(--sLabel);
    background: transparent;
    margin-right: 1rem;
}
input.text {
    background: transparent;
    width: 20rem;
}
input.text:focus {
    background: transparent;
}
</style>
<div class="checkbox-text-input-field">
    <input class='checkbox' type="checkbox" bind:value={field.checked} on:input={onCheckBox}>
    <label for={fid}>{label}</label>
    <input class='text' id={fid} type="text" spellcheck="false" bind:value={field.text} on:input={onInputField}>
</div>