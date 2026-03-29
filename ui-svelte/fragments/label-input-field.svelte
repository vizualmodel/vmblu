<script>
import {onMount} from 'svelte'

export let label, input, style, check

let field
let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

const setFieldWidth = () => {
    field.style.width = '0px';
    field.style.width = (field.scrollWidth + 2) + 'px';   
}

// color to indicate good/bad input
let savedColor = null
const badInputColor = "#ff0000"

onMount(() => {
    // save the good color
    savedColor = field.style.color

    // Set input width based on its scrollWidth (for initial value)
    setFieldWidth()
})

function onInput(e) {

    // reinitialize the width
    setFieldWidth()

    // Do we need to check 
    if ( ! check ) return

    // show disapproval when input is nok
    field.style.color = check(e.target.value) ? savedColor : badInputColor
}

// Reactive: update width whenever input changes and field is available
$: if (field) setFieldWidth();

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
    --cField:#ccc;

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
input:hover {
    background:  var(--bgFieldFocus);
}
input:focus {
    background: var(--bgFieldFocus);
}
</style>
<div class="input-field">
    <label for={fid} style={style}>{label}</label>
    <input id={fid} type="text" spellcheck="false" bind:value={input} bind:this={field} on:input={onInput} on:click={onInput}>
</div>
