<script>
export let style
export let on
export let onToggle

// call the on color function if requested
function onInput() { 
    onToggle?.(on)
}

</script>
<style>
input {
    --checkbox-bg: #2b2b2b; 
    --checkbox-bg-hover: #1f4d8a; 
    --checkbox-border: #555; 
    --checkbox-checked-bg: #8ab4f8; 
    --checkbox-check: #111;

    appearance: none;
    -webkit-appearance: none;
    width: 0.8rem;
    height: 0.8rem;
    border: 1px solid var(--checkbox-border, #666);
    border-radius: 0.4rem;
    background: var(--checkbox-bg, #2a2a2a);
	margin-right: 0.5rem;
    cursor: pointer;
    position: relative;
}
input:hover,
input:focus {
    background: var(--checkbox-bg-hover, var(--checkbox-bg, #333));
    outline: none;
}
input:checked {
    background: var(--checkbox-checked-bg, #8ab4f8);
    border-color: var(--checkbox-checked-border, var(--checkbox-checked-bg, #8ab4f8));
}
input:checked::after {
    content: '';
    position: absolute;
    left: 0.2rem;
    top: 0rem;
    width: 0.2rem;
    height: 0.4rem;
    border: solid var(--checkbox-check, #111);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}
</style>
<input style={style ? style : ''} type="checkbox" bind:checked={on} on:change={onInput}>
