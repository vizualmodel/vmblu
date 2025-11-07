<script>
import {onMount} from 'svelte'
import FolderFileDiv from './folder-file.svelte'

export let tx, workspace, drawer

// the divs
let mainDiv
let headerDiv

let expanded = true

onMount( () => {})

async function expandDrawer(e) {

    //check
    if (!drawer.root) return

    // change the expanded state
    expanded = !expanded

    // get the content of the folder
    if (expanded && drawer.root.is.stale) await drawer.root.update()

    drawer = drawer
}

function removeDrawer(e) {

    //check
    if (!drawer.root) return

    // remove the drawer
    workspace.remove(drawer.reference)
}

function onKeydown(e) {}

</script>
<style>
.drawer {

    /* drawer colors*/
    --bgDrawer:#2f4253;
    --bgHover:#195568;
    --cDrawer:#53c8ff;
    --cIcon:#53c8ff;
    --fontBase: arial, helvetica, sans-serif;
    --sFont: 0.9rem;

    cursor:pointer;
    background:inherit;
}
.drawer-name {
    display: flex;
	font-family: var(--fontBase);
    font-size:var(--sFont);
    background:var(--bgDrawer);
    color: var(--cDrawer);
    font-weight:400;
    list-style:none;
    cursor:pointer;
    padding:0.2rem;
    margin:0.2rem;
    border-radius: 0.5rem;
}
.drawer-name:hover {
    background: var(--bgHover);
}
span.name {
    margin-left: 0.2rem;
    vertical-align: top;
}
i.drawer-icon {
    color:var(--cIcon);
    font-size:1.2rem;
    vertical-align: middle;
}
i.drawer-icon:active{
    transform: translateY(2px);
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events-->
<div class="drawer" bind:this={mainDiv}>
    <div class="drawer-name" bind:this={headerDiv} on:click={expandDrawer} >
        <i class="material-icons-outlined drawer-icon">inventory_2</i>
        <i class="material-icons-outlined drawer-icon">delete</i>
        <span class="name" >{drawer.reference}</span>
    </div>
    {#if expanded}
        <FolderFileDiv folder={drawer.root} tx={tx}/>
    {/if}
</div>