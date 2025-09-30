<script>
import {onMount} from 'svelte'

export let label, info, style

let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

onMount(() => {})

</script>
<style>
/* @import '../color-scheme.css'; */

.input-field {

	--fontBase: arial, helvetica, sans-serif;
	--fontFixed: "courier new";
    --sLabel:0.7rem;
    --sInput:0.85rem;
    --cLabel:#eee;
    --bgField:#000;
    --bgFieldFocus:#222;
    --cField:#cebf6d;

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
	background: var(--bgField);
	color: var(--cField);
    font-family:var(--fontFixed);
	font-size: var(--sInput);
    width: auto;
    min-width: 20rem;
    max-width: 100%;
	margin-left: 1rem;
	cursor: text;
    outline:none;
    border:none;
}
input:focus {
    background: var(--bgFieldFocus);
}
</style>
<div class="input-field">
    <label for={fid} style={style}>{label}</label>
    <input id={fid} type="text" spellcheck="false" bind:value={info} readonly>
</div>