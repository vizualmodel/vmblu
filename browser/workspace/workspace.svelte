<script>
import {onMount} from 'svelte'
import {Drawer} from './drawer'
import {WSFolder, WSFileSystem} from './ws-folder'
import DrawerDiv from './drawer.svelte'
import {ARL, LARL} from '../../core/arl'
import {SimpleServer} from './simple-server'

// The props for the workspace
// tx is an object that allows the workspace to send messages to other components
// sx is an object that allows to pass specific settings to the component - for the moment we do not use this
export let tx, sx

//the main div
let mainDiv

// The div with the drawers
let drawerListDiv

let expanded = false

// This is for getting the workspace configuration from a server
const serverUrl = window.location.origin;
const workspaceCfg = '/admin/workspace-config.json'

let localFS = null;

// the drawers
let drawers = []

onMount(async () => {

    // send the div
    tx.send("dom workspace div", mainDiv)

    // maybe we have to do something when the visibility of this component changes
    setVisibilityHandler()
})

function setVisibilityHandler() {

    document.addEventListener("visibilitychange", (event) => {
        event.preventDefault()
    });
}

// The handlers for the messages
export const handlers = {

    /**
     * 
     * @node workspace
     */

    "-> dom add modal div"(modalDiv) {

        mainDiv.append(modalDiv)
    },

    "-> file savedAs"(arl) {
    },

    "-> file active"(arl) {
    },

    "-> file closed"(arl) {
    }
}

// The functions that can be called from the outside
const exposedFunctions = {

    remove(drawer) {
        drawers = drawers.filter( d => d !== drawer)
    }
}

// Create a new local drawer.
// This function uses the File System Access API to allow the user to pick a local directory.
async function newLocalDrawer(e) {

    try {

        // make a new local file system
        localFS = new WSFileSystem('local')


        // Open a directory picker so that the user can select a local directory
        const dirHandle = await window.showDirectoryPicker();
        const dirName = dirHandle.name

        // Check if a drawer with this name already exists.
        if (drawers.find(drawer => drawer.reference === dirName)) {
            console.error(`Drawer "${dirName}" already exists.`);
            return;
        }

        // The arl for the directory
        const arl = new LARL(dirName, dirHandle)

        // Create a new drawer
        const folder = new WSFolder(arl, localFS)

        localFS.root = folder

        // set the reference - it is top level, so this is easy
        arl.setFileSystem(folder, '/')

        // The new drawer
        drawers.push(new Drawer(dirName,folder))

        // set as expanded
        folder.expanded = true

        // get the content of the drawer
        await folder.update()

        // update the component
        drawers = drawers

    } catch (error) {
        // If the user cancels the selection or an error occurs, log it.
        console.error("Local drawer selection cancelled or failed:", error);
    }
}

// Get the folders/files from a simpleServer server
async function getRemoteDrawers(e) {

    // the initial default path to a configuartion file...
    const arl = new ARL(workspaceCfg)
    arl.url = new URL(workspaceCfg,serverUrl)

    // create the new simple server
    const simpleServer = new SimpleServer(arl)

    try {
        // get the drawers 
        const remoteDrawers = await simpleServer.getDrawers()

        for (const rd of remoteDrawers) drawers.push(rd)

        drawers = drawers

    }catch(error) {
        console.error('Could not get simpleServer workspace', error)
    }
}

function collapseAll(e) {

    expanded = !expanded

    drawers.forEach( d => d.root.is.expanded = expanded)

    drawers = drawers
}

</script>
<style>

::-webkit-scrollbar {
    width: 10px;
}
::-webkit-scrollbar-track {
    background: #333;
}
::-webkit-scrollbar-thumb {
    background: #555;
    border-radius:  10px;
    height: 10%;
}

.tree {

    /* workspace colors */
    --bg:#1b1b1b;
    --cHeader:#fff;
    --cIcon: #2085a3;
	--fontBase: arial, helvetica, sans-serif;
    --sFont: 1rem;
    --bgTooltip:rgb(30, 29, 100);
    --cTooltip:rgb(132, 197, 250);

    cursor:pointer;
    background:inherit;    

    width: 100%;
	padding: 0.1rem 0.0rem 0.0rem 1.0rem;
    user-select:none;
    background:var(--bg);
}
.heading {
    display: flex;
    margin-bottom: 0.2rem;
    background:inherit;
    color: var(--cHeader);
}
.drawer-list {
    overflow-x: hidden;
    overflow-y: scroll;
    height:100%;
    margin-top:1rem;
    background:inherit;
}
h1 {
	font-family: var(--fontBase);
    font-size: var(--sFont);
    margin: 0.1rem 1rem 0rem 0.2rem;
}
i {
    font-size: 24px;
    color: var(--cIcon);
    margin-bottom:-0.2rem;
}
i:hover {
    color:var(--cTooltip);
}
i:active {
    transform: translateY(2px);
}
p.no-selection {
    font-size: 24px;
    color: grey;
}

.menu-item {
    background:transparent;
    position: relative;
    margin-right:0.5rem;
}

.menu-item .tooltip {
    visibility: hidden;
    font-family: var(--fontBase);
    font-size: 0.9rem;
    background-color: var(--bgTooltip);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 10px;
    border: 2px solid var(--cTooltip);
    padding: 0rem 1rem 0.1rem 1rem;
        /* Prevent text wrapping */
        white-space: nowrap;
    position: absolute;
    z-index: 1;
    top: 120%;
}

.menu-item:hover .tooltip {
  visibility: visible;
}

</style>
<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events-->
<div class="tree" bind:this={mainDiv}>

    <div class="heading">
        <h1>Workspace</h1>

        <div class="menu-item">
            <i class="material-icons-outlined" on:click={newLocalDrawer} >folder</i>
            <div class="tooltip" >new local drawer</div>
        </div>

        <div class="menu-item">
            <i class="material-icons-outlined" on:click={getRemoteDrawers} >cloud_download</i>
            <div class="tooltip">new simpleServer drawer</div>
        </div>

        <div class="menu-item">
            <i class="material-icons-outlined" on:click={collapseAll} >{expanded ? "unfold_less" : "unfold_more"}</i>
            <div class="tooltip">{expanded ? "collapse all" : "expand all"}</div>
        </div>

    </div>

    <div class="drawer-list" bind:this={drawerListDiv}>
        {#if drawers.length > 0}
            {#each drawers as drawer}
                <DrawerDiv tx={tx} drawer={drawer} workspace={exposedFunctions}/>
            {/each}            
        {:else}
            <p class="no-selection">- nothing here yet -</p>
        {/if}
    </div>
</div>