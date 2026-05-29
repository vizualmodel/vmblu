<script>
export let label
export let style = ''
</script>

<style>
.button-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.25rem 0;
}

.button-row label {
    width: 6rem;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    background: transparent;
    user-select: none;
}
</style>

<div class="button-row">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label style={style}>{label}</label>
    <slot/>
</div>
