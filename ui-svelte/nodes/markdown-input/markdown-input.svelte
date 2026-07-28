<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import MarkdownInput from '../../fragments/markdown-input.svelte'

export let tx // sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
    add: null,
}

onMount(() => {
    tx.send("modal div", box.div)
})

// the text
let newText = ''
let sectionTabs = []
let activeSection = null
let showPreview = false

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key != "Escape" && e.key != "Esc" ) e.stopPropagation()
}

export const handlers = {

    onMarkdown({header, pos, text='', mode=null, sections=null, ok=null, cancel=null}) {

        // set the box parameters
        box.title = header

        const sectioned = mode === 'node-sections' || sections !== null
        const nodeSections = sections ?? {prompt: text}
        sectionTabs = sectioned ? [
            {key: 'prompt', label: 'Prompt', text: nodeSections.prompt ?? ''},
            {key: 'status', label: 'Status', text: nodeSections.status ?? ''},
            {key: 'decisions', label: 'Decisions', text: nodeSections.decisions ?? ''},
            {key: 'open', label: 'Open', text: nodeSections.open ?? ''},
        ] : []
        activeSection = sectionTabs[0]?.key ?? null

        // set the ok function
        box.ok = ()=> {
            if (sectionTabs.length) {
                ok?.(Object.fromEntries(sectionTabs.map(tab => [tab.key, tab.text])))
            }
            else {
                ok?.(newText)
            }
        }

        // set the add function: when the add icon is pressed, the markdown is previewed
        box.add = () => {
            showPreview = !showPreview
        }

        // set the text field
        newText = text
        showPreview = false

        // show
        box.show(pos)
    },
}

</script>
<style>
.tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.35rem;
    border-bottom: 1px solid #333;
}

.tab {
    padding: 0.4rem 0.7rem;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--md-fg, #fff);
    cursor: pointer;
}

.tab:hover,
.tab:focus-visible {
    background: rgba(127, 199, 255, 0.08);
    outline: 1px solid #7fc7ff;
    outline-offset: -1px;
}

.tab.active {
    border-bottom-color: #7fc7ff;
    color: #7fc7ff;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    {#if sectionTabs.length}
        <div class="tabs" role="tablist" aria-label="Node prompt sections">
            {#each sectionTabs as tab}
                <button
                    type="button"
                    class:active={activeSection === tab.key}
                    class="tab"
                    role="tab"
                    aria-selected={activeSection === tab.key}
                    on:click={() => activeSection = tab.key}
                    on:keydown={onKeydown}
                >
                    {tab.label}
                </button>
            {/each}
        </div>
        {#each sectionTabs as tab}
            {#if activeSection === tab.key}
                <MarkdownInput bind:text={tab.text} bind:showPreview cols=50 rows=25/>
            {/if}
        {/each}
    {:else}
        <MarkdownInput bind:text={newText} bind:showPreview cols=50 rows=25/>
    {/if}
</PopupBox>
