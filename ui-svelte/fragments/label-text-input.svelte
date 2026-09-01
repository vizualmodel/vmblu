<script>
export let label
export let text
export let style = 'width: 9rem;'
export let onInput
export let disabled = false
export let openFile = null

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

input:disabled {
    opacity: 0.65;
}

input.after-file-icon {
    margin-left: 0.3rem;
}

.file-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 1rem;
    padding: 0;
    color: #e2c64e;
    background: transparent;
    border: 0;
    cursor: pointer;
}

.file-icon:hover,
.file-icon:focus-visible {
    color: #fff27a;
    outline: none;
}

.file-icon .material-icons-outlined {
    font-size: 1.2rem;
    line-height: 1;
}
</style>

<div class="text-input-field">
    <label for={fid} style={style}>{label}</label>
    {#if openFile}
        <button class="file-icon" type="button" title="Open test specification" aria-label="Open test specification" on:click={openFile}>
            <span class="material-icons-outlined">description</span>
        </button>
    {/if}
    <input id={fid} spellcheck="false" class:after-file-icon={openFile} bind:value={text} {disabled} on:input={() => onInput?.()} />
</div>
