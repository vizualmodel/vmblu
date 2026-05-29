<script>
export let label
export let text
export let style = 'width: 9rem;'
export let onInput

let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
</script>

<style>
.text-input-field {
    display: flex;
    align-items: center;
    margin: 0rem 0rem 0.3rem 0rem;
    background: transparent;
}

label {
    font-family: var(--fFamily);
    color: #ccc;
    font-size: var(--fSmall);
    background: transparent;
    user-select: none;
}

input {
    box-sizing: border-box;
    flex: 1;
    width: auto;
    min-width: 0;
    margin-left: 1rem;
    background: #1f1f1f;
    color: #ddd;
    border: 1px solid #555;
    border-radius: 0.15rem;
    padding: 0.25rem 0.35rem;
    font-family: var(--fFixed);
    font-size: 0.76rem;
    outline: none;
}

input:focus {
    border-color: #888;
}
</style>

<div class="text-input-field">
    <label for={fid} style={style}>{label}</label>
    <input id={fid} spellcheck="false" bind:value={text} on:input={() => onInput?.()} />
</div>
