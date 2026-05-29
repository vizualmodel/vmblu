<script>
export let label
export let text
export let style = 'width: 9rem;'

let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
</script>

<style>
.textarea-field {
    display: flex;
    align-items: flex-start;
    margin: 0rem 0rem 0.3rem 0rem;
    background: transparent;
}

label {
    font-family: var(--fFamily);
    color: #ccc;
    font-size: var(--fSmall);
    background: transparent;
    user-select: none;
    padding-top: 0.25rem;
}

textarea {
    flex: 1;
    width: auto;
    min-width: 0;
    height: 4.5rem;
    margin-left: 1rem;
    background: #111;
    color: #ccc;
    border: 1px solid #555;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    outline: none;
    resize: vertical;
}

textarea:focus {
    border-color: #888;
}
</style>

<div class="textarea-field">
    <label for={fid} style={style}>{label}</label>
    <textarea id={fid} bind:value={text} spellcheck="false" on:keydown|stopPropagation></textarea>
</div>
