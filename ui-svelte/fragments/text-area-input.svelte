<script>
import {onMount} from 'svelte'

export let text, cols, rows

onMount(() => {
})

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key != "Escape" && e.key != "Esc" ) e.stopPropagation()
}

</script>
<style>
textarea {
    font-family: courier new;
    font-size: 0.9rem;
    padding: 0.5rem;
    background:black;
    color:white;
    outline: none;
} 
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<textarea bind:value={text} name="txt-name" spellcheck="false" rows={rows} cols={cols} on:keydown={onKeydown}></textarea>