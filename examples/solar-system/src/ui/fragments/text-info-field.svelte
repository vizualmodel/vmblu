<script>
    export let text
</script>
<style>
.info {
    background: transparent;
    color: var(--cInput, #ffffff);
    font-family:var(--fFixed);
    font-size: var(--fSmall);
    height:0.7rem;
    cursor: none;
    outline:none;
    border:none;
}
</style>
<span class="info">{text}</span>