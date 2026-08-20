<script>
import {onMount} from 'svelte'
export let tx

let mainDiv
let contentDiv
let tabsDiv
let loadingName = ''
let loadingError = ''

onMount(async () => {
})

export const handlers = {

    onContentDiv(div) {
        // replace the content
        contentDiv.replaceChildren(div)

        // send out the div
        tx.send('div', mainDiv)
    },

    onContentLoading(arl) {
        loadingName = arl?.getName?.() ?? 'document'
        loadingError = ''
    },

    onContentLoaded() {
        loadingName = ''
        loadingError = ''
    },

    onContentFailed(arl) {
        const name = (arl?.getName?.() ?? loadingName) || 'document'
        loadingName = ''
        loadingError = `Could not load ${name}.`
    },

    onTabsDiv(div) {
        tabsDiv.replaceChildren(div)
    },

    onModalDiv(div) {
		mainDiv.append(div)
    },

    onSizeChange({id, rect}) {

        // and inform other nodes about the content size change
        const w = Math.floor(contentDiv.clientWidth)
        const h = Math.floor(contentDiv.clientHeight)

        tx.send("content.size change", {x:0, y:0, w, h})
    },

    onShow() {
        tx.send('div', mainDiv)
    }
}
</script>
<style>
/* Other custom styles */
:root {
    /* Fonts */
    --fFamily: Tahoma, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    --fFixed: 'Courier New', Courier, monospace;
    --fBig: 1.2rem;
    --fNormal: 0.9rem;
    --fSmall: 0.7rem;

    /* Colors */
    --cHeaders: #ff8800;
    --cSelected: yellow;
    --cNotSelected: rgba(255, 255, 0, 0.5);
    --cInput: yellow;
    --cLabel: white;
    --cGreyT: #20203088;
}
:root.dark {
	--bgMenu:#aaa;
}
:root.light {
	--bgMenu:#aaa;
}
/* webkit scrollbar */
::-webkit-scrollbar {
width: 10px;
height:10px;
}
::-webkit-scrollbar-track {
    background: red;
    border-radius: 5px;
}
::-webkit-scrollbar-thumb {
    background: green;
    border-radius: 5px;
    height: 10%;
}
/**/
.main {
    height:100%;
    width: 100%;
    overflow:hidden;
}
.tabs {
    height: 24px;
    width: 100%;
    background: inherit;
}
.content-shell {
    position: relative;
    height: calc(100% - 24px);
    width: 100%;
}
.content {
    height: 100%;
    width: 100%;
}
.content-status {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    color: #d8d8d8;
    background: rgba(24, 24, 28, 0.72);
    font-family: var(--fFamily);
    font-size: var(--fNormal);
    pointer-events: none;
}
.content-status.error {
    color: #ffb4ab;
}
.spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid #666;
    border-top-color: #0fb2e4;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 1.5s; }
}
</style>
<div class="main" bind:this={mainDiv}>
    <div class="tabs" bind:this={tabsDiv}> </div>
    <div class="content-shell">
        <div class="content" bind:this={contentDiv}></div>
        {#if loadingName}
            <div class="content-status" role="status" aria-live="polite">
                <span class="spinner" aria-hidden="true"></span>
                <span>Loading {loadingName}...</span>
            </div>
        {:else if loadingError}
            <div class="content-status error" role="alert">{loadingError}</div>
        {/if}
    </div>
</div>
