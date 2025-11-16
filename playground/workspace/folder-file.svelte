<script>
import {onMount} from 'svelte'
import FolderFileDiv from './folder-file.svelte'
import {folderContext, fileContext} from './context-handling'

export let folder
export let tx

// the div for the list
let mainDiv

onMount( () => {
    // if the folder is not at the root level, shift to the right
    if (folder.name !== '') {
        mainDiv.style.margin = "0rem 0rem 0rem 1.2rem"
    }
})

async function expandCollapse(e) {

    // get the index
    let fldrIndex = e.target.dataset.fldrindex ?? e.target.parentNode?.dataset?.fldrindex

    // check
    if (! fldrIndex) return

    // the selected folder
    let fldr = folder.folders[+fldrIndex]

    // change the expanded state
    fldr.is.expanded = ! fldr.is.expanded

    // maybe we still have to ge the content of the folder
    if (fldr.is.expanded && fldr.is.stale) {
        await fldr.update()
        fldr.is.stale = false
    }

    // force a re-evaluation
    folder = folder
}

// open and bring the file to the foreground
function openFile(e) {

    // get the index of the subfolder on which the click occurred
    const fileIndex = e.target.parentNode.dataset?.fileindex

    // get the file index of the file
    if (!fileIndex) return

    // get the arl of the file 
    const arl = folder.files[+fileIndex].arl

    // send the selected file
    tx.send('file selected', arl)
}

// action for rightclicking = the same as clicking on the menu icon 
function showFolderContext(e) {

    // block the deafult context menu & propagation
    e.preventDefault();
    e.stopPropagation()

    // get the subfolder on which the click occurred
    const fldrIndex = e.target.parentNode.dataset?.fldrindex
    const clickedFolder = folder.folders[+fldrIndex]

    // check
    if (!clickedFolder) return

    // get the context menu
    const menu = folderContext(clickedFolder)

    // send it out...
    tx.send('folder context menu', {menu,event:e})
}

function showFileContext(e) {

    // block the deafult context menu
    e.preventDefault()
    e.stopPropagation()

    // get the file for which the click occurred
    const fileIndex = e.target.parentNode.dataset?.fileindex
    const file = folder.files[+fileIndex]

    //check
    if (!file) return

    // get the context menu
    const menu = fileContext(file)

    // send it out...
    tx.send('file context menu', {menu,event:e})
}

function onKeydown(e) {}

</script>
<style>
.file-dir-list {

    --cFolder:#97a7bb;
    --cJSONFile: #d6a78b;
    --cJSFile: #bbbbbb;
    --cOtherFile:#bbbbbb;
	--fontBase: arial, helvetica, sans-serif;
    --sFont: 0.8rem;
    --sIcon: 16px;

	font-family: var(--fontBase);
    cursor:pointer;
    background:inherit;
}
li.dir {
    /* background:inherit; */
    font-weight:300;
    list-style:none;
    cursor:pointer;
    margin-bottom: -0.2rem;
    user-select:none;
}
li.file {
    font-weight:300;
    list-style:none;
    cursor:pointer;
    margin-bottom: -0.2rem;
    user-select:none;
}
i.folder-icon {
    color:var(--cFolder);
    font-size:var(--sIcon);
    vertical-align: middle;
    font-weight:300;
}
span.fldr-name {
    margin-left: 0.2rem;
    font-size:var(--sFont);
    color: var(--cFolder);
}
span.fldr-name:hover{
    font-weight: 600;
    /* background: black; */
    /* border: solid 1px white; */
}
span.file-name {
    margin-left: 0.2rem;
    font-size:var(--sFont);
}
span.vmblu-file {
    color:var(--cJSONFile);
}
span.js-file {
    color:var(--cJSFile);
}
span.other-file {
    color:var(--cOtherFile);
}
span.file-name:hover{
    font-weight: 600;
    /* border: solid 1px white; */
}
i.file-icon {
    font-size:var(--sIcon);
    vertical-align: middle;
    font-weight:100;
}
i.vmblu-file {
    color:var(--cJSONFile);
}
i.js-file {
    color:var(--cJSFile);
}
i.other-file {
    color:var(--cOtherFile);
}

</style>
<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events-->
<div class="file-dir-list" bind:this={mainDiv}>
    {#each folder.folders as fldr, fldrIndex}
        <li class="dir" data-fldrindex={fldrIndex} on:contextmenu={showFolderContext} >
            {#if fldr.parent === null} 
                <FolderFileDiv folder={fldr} tx={tx}/>
            {:else}
                <i class="material-icons-outlined folder-icon" on:click={expandCollapse} >{fldr.is.expanded ? 'folder_open' : 'folder'}</i>
                <span class="fldr-name"  draggable="true" on:click={expandCollapse} >{fldr.name}</span>
                {#if fldr.is.expanded}
                    <FolderFileDiv folder={fldr} tx={tx}/>
                {/if}
            {/if}
        </li>
    {/each}
    {#each folder.files as file, fileIndex}
        <li class="file" data-fileindex={fileIndex} on:contextmenu={showFileContext}>
            <i class={"material-icons-outlined file-icon " + file.getFileClass()} on:click={openFile} >{file.getIcon()}</i>
            <span class={"file-name " + file.getFileClass()} draggable="true" on:click={openFile} >{file.name}</span>
        </li>
    {/each}
</div>