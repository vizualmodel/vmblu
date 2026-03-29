<script>
import {onMount} from 'svelte'

export let label
export let style
export let color
export let onColor

let input

// random field id
let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

onMount(() => {
})

// call the on color function if requested
function onInput(e) { 
    onColor?.(color)
}

</script>
<style>

.color-field {

    --fontBase: arial, helvetica, sans-serif;
    --sLabel:0.7rem;
    --sInput:0.9rem;
    --cLabel:#eee;
    --bgFieldFocus:#222;

    display: flex;
    align-items: center;
    background:transparent;
}
label {
    font-family: var(--fontBase);
    color: var(--cLabel);
    font-size: var(--sLabel);
    background: transparent;
}
input {
    background: transparent;
	margin-left: 1rem;
}
input:focus {
    background: transparent;
}
</style>
<div class="color-field">
    <label for={fid} style={style}>{label}</label>
    <input id={fid} type="color" bind:value={color} bind:this={input} on:input={onInput}>
</div>