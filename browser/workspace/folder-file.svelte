<script>
import {onMount} from 'svelte'
import FolderFileDiv from './folder-file.svelte'

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

// the contextmenus
const contextMenu = []
function folderContext(folder) {

    contextMenu.length = 0

    contextMenu.push({icon:"sell", text:"change name", state: "enabled",action:folder.nameDialog})

    contextMenu.push({
        icon:"note_add",text:"new file", state: "enabled", 
        action:(e) => tx.send(  "name request",{label:'new file', value:'', regex: Path.regex.file, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=>folder.newFile(newName),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"create_new_folder",text:"new folder",  state: "enabled", 
        action:(e) => tx.send(  "name request",{label:'new folder', value:'', regex: Path.regex.vizPath, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=>folder.newFolder(newName),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"folder_off",text:"remove folder", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm removal',message:`Remove ${folder.getPath()} from drawer ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => folder.remove(),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"delete",text:"delete folder", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm delete', message:`Delete ${folder.getPath()} ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => folder.remove(),
                                cancel:()=>{}})
        })

    return contextMenu
}

function fileContext(file) {

    contextMenu.length = 0

    contextMenu.push({
        icon:"sell", text:"change name", state: "enabled", 
        action: (e) => tx.send( 'name request',{label:"Name ", value:this.name, regex:/^[\w,-]+$/, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=> this.rename(newName),
                                cancel:()=> {}})
        })

    contextMenu.push({
        icon:"delete",text:"delete file", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm delete',message:`Delete ${this.getPath()} ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => this.remove(),
                                cancel:()=>{}})
    })

    return contextMenu
}

// action for rightclicking = the same as clicking on the menu icon 
function showFolderContext(e) {

    // block the deafult context menu
    e.preventDefault();

    // no propagation
    e.stopPropagation()

    // get the index of the subfolder on which the click occurred
    const fldrIndex = e.target.parentNode.dataset?.fldrindex

    // show the context menu fo the folder clicked on
    const clickedFolder = folder.folders[+fldrIndex]

    // check
    if (!clickedFolder) return

    // get the context menu
    const menu = folderContext(clickedFolder)

    // send it out...
    tx.send('context menu', {menu,event:e})
}

function showFileContext(e) {

    // block the deafult context menu
    e.preventDefault()

    // no propagation
    e.stopPropagation()

    // get the index of the file for which the click occurred
    const fileIndex = e.target.parentNode.dataset?.fileindex

    // get the file
    const file = folder.files[+fileIndex]

    //check
    if (!file) return

    // get the context menu
    const menu = file.getContextMenu()

    // send it out...
    tx.send('context menu', {menu,event:e})
}

// open and bring the file to the foreground
function openFile(e) {

    // get the index of the subfolder on which the click occurred
    const fileIndex = e.target.parentNode.dataset?.fileindex

    if (!fileIndex) return

    // get the arl of the file 
    const arl = folder.files[+fileIndex].arl

    // send the selected file
    tx.send('file selected', arl)
}

function onKeydown(e) {}

</script>
<style>
.file-dir-list {

    --cFolder:#9cdbff;
    --cJSONFile: #FB8604;
    --cJSFile: #3eb2ff;
    --cOtherFile:#1ed4cb;
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