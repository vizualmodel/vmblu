<script>
export let label
export let value
export let options = []
export let style = 'width: 9rem;'

let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

function optionValue(option) {
    return typeof option === 'object' ? option.value : option
}

function optionLabel(option) {
    return typeof option === 'object' ? option.label : option
}
</script>

<style>
.select-field {
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

select {
    height: 1.4rem;
    margin-left: 1rem;
    background: #111;
    color: #ccc;
    border: 1px solid #555;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    outline: none;
}

select:focus {
    border-color: #888;
}
</style>

<div class="select-field">
    <label for={fid} style={style}>{label}</label>
    <select id={fid} bind:value>
        {#each options as option}
            <option value={optionValue(option)}>{optionLabel(option)}</option>
        {/each}
    </select>
</div>
