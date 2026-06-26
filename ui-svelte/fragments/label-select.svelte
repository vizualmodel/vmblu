<script>
import { onMount } from 'svelte'

export let label
export let value
export let options = []
export let style = 'width: 9rem;'

let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
let labelId = fid + '-label'
let open = false

function optionValue(option) {
    return typeof option === 'object' ? option.value : option
}

function optionLabel(option) {
    return typeof option === 'object' ? option.label : option
}

$: selected = options.find(option => optionValue(option) === value)
$: selectedLabel = selected ? optionLabel(selected) : ''

onMount(() => {
    function onDocumentClick() {
        open = false
    }

    document.addEventListener('click', onDocumentClick)

    return () => {
        document.removeEventListener('click', onDocumentClick)
    }
})

function toggleOpen() {
    open = !open
}

function choose(option) {
    value = optionValue(option)
    open = false
}

function onKeydown(e) {
    if (e.key === 'Escape') {
        open = false
    }

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleOpen()
    }
}
</script>

<style>
.select-field {
    display: flex;
    align-items: center;
    /* margin: 0rem 0rem 0.3rem 0rem; */
    background: transparent;
}

label {
    font-family: var(--fFamily);
    color: #ccc;
    font-size: var(--fSmall);
    background: transparent;
    user-select: none;
}

.select-box {
    position: relative;
    margin-left: 1rem;
}

button {
    height: 1.35rem;
    padding: 0 0.35rem;
    background: #111;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 0.35rem;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    line-height: 1.1;
    outline: none;
    cursor: pointer;
    min-width: 5rem;
    text-align: left;
}

button:focus {
    border-color: #888;
}

.arrow {
    float: right;
    margin-left: 0.5rem;
    color: #999;
}

ul {
    position: absolute;
    top: calc(100% + 0.15rem);
    left: 0;
    min-width: 100%;
    margin: 0;
    padding: 0.15rem;
    background: #111;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 0.35rem;
    list-style: none;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    line-height: 1.1;
    z-index: 10;
    box-sizing: border-box;
}

li {
    padding: 0.12rem 0.3rem;
    border-radius: 0.2rem;
    cursor: pointer;
    white-space: nowrap;
}

li:hover,
li.selected {
    background: #333;
    color: #eee;
}

</style>

<div class="select-field">
    <label id={labelId} style={style}>{label}</label>
    <div class="select-box" on:click|stopPropagation>
        <button id={fid} type="button" aria-labelledby={labelId} aria-haspopup="listbox" aria-expanded={open} on:click={toggleOpen} on:keydown={onKeydown}>
            {selectedLabel}<span class="arrow">▾</span>
        </button>
        {#if open}
            <ul role="listbox" aria-labelledby={labelId}>
                {#each options as option}
                    <li
                        role="option"
                        aria-selected={optionValue(option) === value}
                        class:selected={optionValue(option) === value}
                        on:click={() => choose(option)}
                        on:keydown={onKeydown}
                    >{optionLabel(option)}</li>
                {/each}
            </ul>
        {/if}
    </div>
</div>
