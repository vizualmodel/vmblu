<script>
import {onMount} from 'svelte'

export let tx//, sx

onMount(() => {
    tx.send("div", ribbon.div)
})

// The tabs
let ribbon = {
    div: null,
    selected: -1,
    tabs: [],
}

function tabId(tab) {
    return typeof tab === 'string' ? tab : tab?.id
}

function tabLabel(tab) {
    if (typeof tab !== 'string' && tab?.label) return tab.label
    const id = tabId(tab) ?? ''
    try {
        const url = new URL(id)
        return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? id)
    } catch {
        return id.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? id
    }
}

export const handlers =  {

onTabNew(tab) {

    const descriptor = typeof tab === 'string'
        ? {id: tab, label: tabLabel(tab), readOnly: false}
        : {id: tab?.id, label: tabLabel(tab), readOnly: tab?.readOnly === true}
    ribbon.selected = ribbon.tabs.push(descriptor) - 1
    ribbon = ribbon
},

onTabRemove(name) {

    // notation
    const tabs = ribbon.tabs

    // remove the tab with the name
    const L = tabs.length
    for (let i=0; i<L; i++) {
        if (tabId(tabs[i]) == name) {
            if (L > 1) for (let j=i; j<L-1; j++ )  tabs[j] = tabs[j+1]
            tabs.pop()
            break
        }
    }

    ribbon = ribbon
},

onTabRename({oldName, newName}) {

    // notation
    const tabs = ribbon.tabs

    const index = tabs.findIndex( tab => tabId(tab) == oldName)
    if (index >=0 ) tabs[index] = {id: newName, label: tabLabel(newName)}
    ribbon = ribbon
},

onTabSelect(name) {

    // notation
    const tabs = ribbon.tabs

    const index = tabs.findIndex( tab => tabId(tab) == name)
    if (index >= 0) ribbon.selected = index
    ribbon = ribbon
},

}

// Event Functions 
function onClick(e) {
    // get the uid of the tab clicked
    const index = Number(e.currentTarget.getAttribute("data-index"))

    if (index < 0 || index >= ribbon.tabs.length) return
    tx.send("tab.request to select", tabId(ribbon.tabs[index]))
}

function onClose(e) {
    // no propagation
    e.stopPropagation()

    // get the uid of the tab clicked
    const index = Number(e.currentTarget.parentNode.getAttribute("data-index"))

    if (index < 0 || index >= ribbon.tabs.length) return
    tx.send("tab.request to close", tabId(ribbon.tabs[index]))
}

function onKeydown(e) {
}

</script>
<style>
.tab-ribbon{

    /* font */
	--fontBase: arial, helvetica, sans-serif;
	--fontFixed: "courier new";
    --sFontTab: 0.8rem;
    --sFontFullName: 0.7rem;

    /* colors */
    --bgTabRibbon:#aaa;
	--bgTab:#333;
	--bgTabHover:#000;
	--bgTabSelect:#000;
	--cFontTab:#aaa;
	--cFontTabSelect:#fff;
    --cCloseTab:#777;
    --cCloseTabHover:#ff1111;
    --bgFullName:rgb(30, 29, 100);
    --cFullName:rgb(132, 197, 250);

	display:block;
	background: inherit;
    height:100%;
}
.tab {
	display: inline-block;
    position: relative;
    align-items: center;
    height:100%;
    font-size: var(--sFontTab);
    font-family:var(--fontBase);
	font-weight: normal;  
	cursor: pointer;
	background: var(--bgTab);
	color: var(--cFontTab);
    margin-top: 0.1rem;
	padding: 0.2rem 0.3rem 0rem 1rem;
	border-radius: 0.5rem 0.5rem 0 0;
}
.tab:hover {
    background: var(--bgTabHover);
}
.selected {
    background-color: var(--bgTabSelect);
	color: var(--cFontTabSelect); 
}
.button{
    display: inline-block;
    padding: 0;
    line-height: 0;
    border: none;
    background-color: var(--cCloseTab);
    height: 0.5rem;
    width: 0.5rem;
    border-radius: 50%;
    margin-left: 0.5rem;
    cursor: pointer;
}
.button:hover{
    background-color:var(--cCloseTabHover);
    cursor:default;
}
.full-name {
    visibility: hidden;
    font-family: var(--fontBase);
    font-size:var(--sFontFullName);
    width: max-content;
    min-width: 10rem;
    max-width: 30rem;
    background-color: var(--bgFullName);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 1px;
    border: 1px solid var(--cFullName);
    padding: 0rem 0.1rem 0.1rem 0rem;
    
    /* Position the tooltip */
    position: absolute;
    z-index: 1;
    top: 100%;
    left: 0;
    overflow-wrap: anywhere;
}
.tab:hover .full-name {
    visibility: visible;
}
.read-only {
    margin-left: 0.4rem;
    color: #999;
    font-size: 0.75rem;
    vertical-align: -0.1rem;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="tab-ribbon" bind:this={ribbon.div}>
    {#each ribbon.tabs as tab, index}
        {#if index == ribbon.selected}
            <div class="tab selected" data-index={index} on:click={onClick} on:keydown={onKeydown}>
                {tab.label}
                {#if tab.readOnly}<span class="material-icons-outlined read-only" title="Read-only" aria-label="Read-only">lock</span>{/if}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
                <div class="full-name">{tab.id}</div>
            </div>
        {:else}
            <div class="tab" data-index={index} on:click={onClick} on:keydown={onKeydown}>
                {tab.label}
                {#if tab.readOnly}<span class="material-icons-outlined read-only" title="Read-only" aria-label="Read-only">lock</span>{/if}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
                <div class="full-name">{tab.id}</div>
            </div>
        {/if}
    {/each}
</div>
