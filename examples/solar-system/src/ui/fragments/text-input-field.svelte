<script>
import {onMount, tick} from 'svelte'

// field : {value, check}
export let field

let input

// color to indicate good/bad input
let savedColor = null
const badInputColor = "#ff0000"

onMount(() => {

    // save the good color
    savedColor = input.style.color
})

async function onInput(e) {

    // the very first time on input is called with input null
    if (!input) return

    // make sure the browser has painted
    await tick()

    // reinitialize the width
    input.style.width = '0px';

    // Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
    input.style.width = input.scrollWidth > 20 ? (input.scrollWidth + 2) + 'px' : '20px'

    // Do we need to check 
    if ( field.check ) {

        // show disapproval when input is nok
        input.style.color = field.check(input.value) ? savedColor : badInputColor
    }
}

$: field && onInput(null)

</script>
<style>
input.grow {

    --bgFocus:#000;

	background: #00000000;
	color: var(--cInput, #ffffff);
    font-family:var(--fFixed);
	font-size: var(--fNormal);
	cursor: text;
    outline:none;
    border:none;
    box-sizing: content-box;
}
input:focus {
    color: var(--cInput, #ffffff);
    background: var(--bgFocus);
}
</style>
<input class="grow" type="text" spellcheck="false" bind:value={field.value} bind:this={input} on:input={onInput}>