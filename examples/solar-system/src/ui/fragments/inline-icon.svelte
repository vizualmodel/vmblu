<script>
    export let name
    export let style
</script>
<style>
i {
    --cNormal : var(--cInput);
    --cHover: var(--cInput);

    font-size: var(--fNormal);
    color: var(--cNormal);
    transform: translateY(0.2rem);
}
i:hover {
    cursor: pointer;
    color: var(--cHover);
}
</style>
<!-- svelte-ignore a11y-label-has-associated-control a11y-no-static-element-interactions a11y-click-events-have-key-events-->
<i class="material-icons-outlined" style={style} on:click>{name}</i>
