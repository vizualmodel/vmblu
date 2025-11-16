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

export const handlers =  {

onTabNew(name) {

    ribbon.selected = ribbon.tabs.push(name) - 1
    ribbon = ribbon
},

onTabRemove(name) {

    // notation
    const tabs = ribbon.tabs

    // remove the tab with the name
    const L = tabs.length
    for (let i=0; i<L; i++) {
        if (tabs[i] == name) {
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

    const index = tabs.findIndex( tab => tab == oldName)
    if (index >=0 ) tabs[index] = newName
    ribbon = ribbon
},

onTabSelect(name) {

    // notation
    const tabs = ribbon.tabs

    const index = tabs.findIndex( tab => tab == name)
    if (index >= 0) ribbon.selected = index
    ribbon = ribbon
},

}

// Event Functions 
function onClick(e) {
    // get the uid of the tab clicked
    const index = e.target.getAttribute("data-index") 

    if (index < 0 || index >= ribbon.tabs.length) return
    tx.send("tab request to select", ribbon.tabs[index])
}

function onClose(e) {
    // no propagation
    e.stopPropagation()

    // get the uid of the tab clicked
    const index = e.target.parentNode.getAttribute("data-index")  

    if (index < 0 || index >= ribbon.tabs.length) return
    tx.send("tab request to close", ribbon.tabs[index])
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
    width: 10rem;
    background-color: var(--bgFullName);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 1px;
    border: 1px solid var(--cFullName);
    padding: 0rem 0.1rem 0.1rem 0rem;
    
    /* Position the tooltip */
    position: relative;
    z-index: 1;
    top: 0.2rem;
}
.tab:hover .full-name {
    visibility: visible;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="tab-ribbon" bind:this={ribbon.div}>
    {#each ribbon.tabs as tab, index}
        {#if index == ribbon.selected}
            <div class="tab selected" data-index={index} on:click={onClick} on:keydown={onKeydown}>
                {tab}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
                <div class="full-name" style="width: {tab.length*0.5}rem;">{tab}</div>
            </div>
        {:else}
            <div class="tab" data-index={index} on:click={onClick} on:keydown={onKeydown}>
                {tab}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
                <div class="full-name" style="width: {tab.length*0.5}rem;">{tab}</div>
            </div>
        {/if}
    {/each}
</div>