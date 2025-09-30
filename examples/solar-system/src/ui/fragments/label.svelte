<script>
    export let text
    export let style
</script>
<style>
label {
    font-family: var(--fFamily);
    color: var(--cLabel, #ffffff);
    font-size: var(--fSmall);
    background: transparent;
    user-select:none;
}
</style>
<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="label" style={style ? style : ''}>{text}</label>