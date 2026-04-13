<script>
import {onMount} from 'svelte'

export let label
export let input = ''
export let style
export let check
export let maxSuggestions = 12
export let fileExtensions = ''
export let getFolder = null

let field
let listOpen = false
let activeIndex = -1
let suggestions = []
let queryToken = 0
let listRect = null
let cachedFolderPath = null
let cachedFolder = {folders: [], files: []}

const fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

const badInputColor = '#ff0000'
let savedColor = null

const setFieldWidth = () => {
    if (!field) return
    field.style.width = '0px'
    field.style.width = (field.scrollWidth + 2) + 'px'
}

function updateListRect() {
    if (!field) return

    const rect = field.getBoundingClientRect()
    const gap = 4

    listRect = {
        left: rect.left,
        top: rect.bottom + gap,
        minWidth: Math.max(rect.width, 240)
    }
}

function normalizePath(value = '') {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function parseExtensionFilter(value = '') {
    if (typeof value !== 'string' || !value.trim()) return []

    return value
        .split(';')
        .map(ext => ext.trim().toLowerCase())
        .filter(Boolean)
        .map(ext => ext.startsWith('.') ? ext : '.' + ext)
}

function matchesExtension(name, allowedExtensions) {
    if (!allowedExtensions.length) return true

    const dot = name.lastIndexOf('.')
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
    return allowedExtensions.includes(ext)
}

function splitInput(value = '') {
    const normalized = normalizePath(value ?? '')
    if (!normalized) return {folderPath: '', partial: '', prefix: ''}

    if (normalized.endsWith('/')) {
        return {folderPath: normalized, partial: '', prefix: normalized}
    }

    const slash = normalized.lastIndexOf('/')
    if (slash < 0) return {folderPath: '', partial: normalized, prefix: ''}

    const folderPath = normalized.slice(0, slash + 1)
    return {
        folderPath,
        partial: normalized.slice(slash + 1),
        prefix: folderPath
    }
}

async function ensureFolderLoaded(folderPath, token) {
    if (cachedFolderPath === folderPath) return true

    if (typeof getFolder !== 'function') {
        cachedFolderPath = folderPath
        cachedFolder = {folders: [], files: []}
        return true
    }

    const nextFolder = await getFolder(folderPath)
    if (token !== queryToken) return false

    cachedFolderPath = folderPath
    cachedFolder = nextFolder ?? {folders: [], files: []}
    return true
}

async function updateSuggestions(value) {
    const token = ++queryToken
    const {folderPath, partial, prefix} = splitInput(value)
    const allowedExtensions = parseExtensionFilter(fileExtensions)

    try {
        const stillCurrent = await ensureFolderLoaded(folderPath, token)
        if (!stillCurrent || token !== queryToken) return

        const lowerPartial = partial.toLowerCase()
        const nextSuggestions = []

        for (const name of cachedFolder.folders ?? []) {
            if (partial && !name.toLowerCase().startsWith(lowerPartial)) continue
            nextSuggestions.push({name, kind: 'directory', value: prefix + name + '/'})
        }

        for (const name of cachedFolder.files ?? []) {
            if (partial && !name.toLowerCase().startsWith(lowerPartial)) continue
            if (!matchesExtension(name, allowedExtensions)) continue
            nextSuggestions.push({name, kind: 'file', value: prefix + name})
        }

        nextSuggestions.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
        })

        suggestions = nextSuggestions.slice(0, maxSuggestions)
        activeIndex = suggestions.length ? 0 : -1
        listOpen = suggestions.length > 0
        if (listOpen) updateListRect()
    }
    catch {
        if (token !== queryToken) return
        suggestions = []
        activeIndex = -1
        listOpen = false
    }
}

function updateInputState(value) {
    setFieldWidth()
    if (!check || !field) return
    field.style.color = check(value) ? savedColor : badInputColor
}

function onInput(e) {
    updateInputState(e.target.value)
    updateSuggestions(e.target.value)
}

function applySuggestion(suggestion) {
    input = suggestion.value
    updateInputState(input)
    updateSuggestions(input)
    field?.focus()
}

function onKeydown(e) {
    if (!listOpen || !suggestions.length) return

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault()
            e.stopPropagation()
            activeIndex = (activeIndex + 1) % suggestions.length
            break
        case 'ArrowUp':
            e.preventDefault()
            e.stopPropagation()
            activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length
            break
        case 'Enter':
        case 'Tab':
            if (activeIndex < 0) return
            e.preventDefault()
            e.stopPropagation()
            applySuggestion(suggestions[activeIndex])
            break
        case 'Escape':
            e.stopPropagation()
            listOpen = false
            activeIndex = -1
            break
    }
}

function onFocus() {
    if (input) updateSuggestions(input)
    updateListRect()
}

function onBlur() {
    setTimeout(() => {
        listOpen = false
        activeIndex = -1
    }, 120)
}

onMount(() => {
    savedColor = field.style.color
    setFieldWidth()
    updateInputState(input)

    const onViewportChange = () => {
        if (listOpen) updateListRect()
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
        window.removeEventListener('resize', onViewportChange)
        window.removeEventListener('scroll', onViewportChange, true)
    }
})

$: if (field) setFieldWidth()
$: if (field && listOpen) updateListRect()
</script>
<style>
.input-field {
    --fontBase: arial, helvetica, sans-serif;
    --fontFixed: "courier new";
    --sLabel: 0.7rem;
    --sInput: 0.85rem;
    --cLabel: #eee;
    --bgField: #000;
    --bgFieldFocus: #222;
    --cField: #ccc;
    display: flex;
    align-items: center;
    background: transparent;
}

label {
    font-family: var(--fontBase);
    color: var(--cLabel);
    font-size: var(--sLabel);
    background: transparent;
}

input {
    background: var(--bgField);
    color: var(--cField);
    font-family: var(--fontFixed);
    font-size: var(--sInput);
    width: auto;
    min-width: 20rem;
    max-width: 100%;
    margin-left: 1rem;
    cursor: text;
    outline: none;
    border: none;
}

input:hover {
    background: var(--bgFieldFocus);
}

input:focus {
    background: var(--bgFieldFocus);
}

.suggestions {
    position: fixed;
    max-height: 14rem;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0.2rem 0;
    background: rgba(20, 20, 20, 0.97);
    border: 1px solid #4a4a4a;
    border-radius: 0.35rem;
    z-index: 10;
}

.suggestions li {
    font-family: var(--fontFixed);
    font-size: 0.76rem;
    line-height: 1.15;
    color: #ccc;
    padding: 0.18rem 0.55rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

.suggestions li.active,
.suggestions li:hover {
    background: #222;
}

.kind {
    color: #e2c64e;
    font-size: 0.95rem;
    line-height: 1;
    flex: 0 0 auto;
}

.name {
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>

<div class="input-field">
    <label for={fid} style={style}>{label}</label>
    <input
        id={fid}
        type="text"
        spellcheck="false"
        bind:value={input}
        bind:this={field}
        on:input={onInput}
        on:click={onInput}
        on:keydown={onKeydown}
        on:focus={onFocus}
        on:blur={onBlur}
    >
</div>

{#if listOpen && suggestions.length && listRect}
    <ul
        class="suggestions"
        style={`left:${listRect.left}px; top:${listRect.top}px; min-width:${listRect.minWidth}px; max-width:min(36rem, calc(100vw - ${listRect.left + 16}px));`}
    >
        {#each suggestions as suggestion, index}
            <li
                class:active={index === activeIndex}
                on:mousedown|preventDefault={() => applySuggestion(suggestion)}
            >
                <span class="material-icons-outlined kind">{suggestion.kind === 'directory' ? 'folder' : 'file_open'}</span>
                <span class="name">{suggestion.value}</span>
            </li>
        {/each}
    </ul>
{/if}
