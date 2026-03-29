<script>
import {onMount} from 'svelte'

export let text, check, style

let input

// color to indicate good/bad input
let savedColor = null
const badInputColor = "#ff0000"

onMount(() => {

    // save the good color
    savedColor = input.style.color
})

function onInput(e) {

    // reinitialize the width
    input.style.width = '0px';

    // Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
    input.style.width = input.scrollWidth > 100 ? (input.scrollWidth + 2) + 'px' : '100px'

    // Do we need to check 
    if ( check ) {

        // show disapproval when input is nok
        input.style.color = check(input.value) ? savedColor : badInputColor
    }
}

</script>
<style>
input.grow {

    --bgFocus:#333;
    --cField:#aaa;

    background: #222;
    color: var(--cField);
    font-family:var(--fFixed);
    font-size: var(--fNormal);
    cursor: text;
    outline:none;
    border:none;
}
input:focus {
    color: #ccc;
    background: var(--bgFocus);
}
input:hover {
    background: var(--bgFocus);
}
</style>
<input class="grow" style={style ? style : ''} type="text" spellcheck="false" bind:value={text} bind:this={input} on:input={onInput}>