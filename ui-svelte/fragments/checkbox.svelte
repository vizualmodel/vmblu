<script>
import {onMount} from 'svelte'

export let style
export let on
export let onToggle

onMount(() => {
})

// call the on color function if requested
function onInput(e) { 
    onToggle?.(on)
}

</script>
<style>
input {
    background: transparent;
	margin-right: 0.5rem;
}
input:focus {
    background: transparent;
}
</style>
<input style={style ? style : ''} type="checkbox" bind:checked={on} on:input={onInput}>