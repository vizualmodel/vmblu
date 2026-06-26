<script>
export let label
export let click
export let active = false
export let disabled = false
</script>

<style>
button {
    background: #222;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 0.2rem;
    padding: 0.2rem 0.2rem;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    cursor: pointer;
}

button:hover {
    background: #333;
    color: #fff;
}

button.active {
    background: #3a3a3a;
    color: #fff;
    border-color: #888;
}

button:disabled {
    opacity: 0.45;
    cursor: default;
}
</style>

<button type="button" class:active disabled={disabled} on:click={() => click?.()}>
    {label}
</button>
