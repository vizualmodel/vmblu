<script>
    export let text;
    export let style;
    export let click;
</script>

<style>
    button {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--fFamily);
        font-size: var(--fSmall);
        background-color: #000;
        color: var(--cInput, 0x777777);
        border: 1px solid var(--cInput, 0x777777);
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    button:hover {
        border: 1px solid var(--cSelected);  
        color: var(--cSelected, 0xffffff);

    }
</style>

<button class="button" style={style ? style : ''} on:click={click}>{text}</button>
