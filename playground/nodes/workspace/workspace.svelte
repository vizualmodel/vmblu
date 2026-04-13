<script>
import FolderFileDiv from './folder-file.svelte'
import {onMount} from 'svelte'
import {WSFolder, WSFileSystem} from './ws-folder'
import {WSFile} from './ws-file'
import {ARL, LARL, Path} from '../../../core/types/arl/index.js'

// The props for the workspace
// tx is an object that allows the workspace to send messages to other components
// sx is an object that allows to pass specific settings to the component - for the moment we do not use this
export let tx//, sx

//the main div
let mainDiv

// The div with the file systems
let remoteDiv
let localDiv

// This is for getting the simulated file system from a server
const serverUrl = window.location.origin;
const remoteFolder = '/examples/file-system.json'

let remoteFS = null
let localFS = null

// allow or forbid a local file system
const allowLocalFS = true

onMount(async () => {

    // send the div
    tx.send("dom.workspace div", mainDiv)

    // maybe we have to do something when the visibility of this component changes
    setVisibilityHandler()

    // get the remote file system
    getRemoteFS()

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

     onDomAddModalDiv(modalDiv) {

        mainDiv.append(modalDiv)
    },

    async onFolderGet({startFolder, path = ''}) {

        const content = await getFolderContent(startFolder, path)
        tx.reply(content)
    },

    onFileSavedAs(arl) {},

    onFileActive(arl) {},

    onFileClosed(arl) {}
}

// Create a new local drawer.
// This function uses the File System Access API to allow the user to pick a local directory.
async function newLocalFS(e) {

    try {
        // make a new local file system
        const newFS = new WSFileSystem('local')

        // Open a directory picker so that the user can select a local directory
        const dirHandle = await window.showDirectoryPicker();
        const dirName = dirHandle.name

        // The arl for the directory
        const arl = new LARL(dirName, dirHandle)

        // Create the fs
        newFS.root = new WSFolder(arl, newFS)

        // set the reference - it is top level, so this is easy
        arl.setFileSystem(newFS.root, '/')

        // set as expanded
        newFS.root.is.expanded = true

        // get the content of the drawer
        await newFS.root.update()

        // update
        localFS = newFS

    } catch (error) {
        // If the user cancels the selection or an error occurs, log it.
        console.error("Local file system selection cancelled or failed:", error);

        // for good measure
        localFS = null;
    }
}

// Get the folders/files from a simpleServer server
async function getRemoteFS() {

    // create the remote file system
    remoteFS = new WSFileSystem('fixed')

    // The path to the simulated folder...
    const arl = new ARL(remoteFolder)
    arl.url = new URL(remoteFolder,serverUrl)

    // get the simulated folder
    const rawFolder = await arl.get('json');

    // check
    if (!rawFolder) return

    // The server arl
    const serverArl = new ARL('')
    serverArl.url = new URL(serverUrl)

    // The arl of the remote file system
    const fsArl = serverArl.resolve('/' + rawFolder.name)

    // set the root of the file system
    remoteFS.root = new WSFolder(fsArl, remoteFS)
    //remoteFS.root.is.expanded = true;

    // now get the folder/file 
    expandRemoteFS(rawFolder, remoteFS.root)
}

function expandRemoteFS(rawFolder, owner) {

    // add the sub folders
    if (rawFolder.folders) {
        for( const raw of rawFolder.folders) {

            // make th arl for th enew folder
            const path = owner.arl.getPath() + '/' + raw.name
            const arl = owner.arl.resolve(path)

            // make and save the folder
            const folder = new WSFolder(arl, owner)
            owner.folders.push(folder)

            // expand the folder 
            expandRemoteFS(raw, folder)
        }
    }

    // and the files
    if (rawFolder.files) {
        for( const raw of rawFolder.files) {

            // get the arl of the file
            const arl = owner.arl.resolve(owner.arl.getPath() + '/' + raw)

            // make and save the file
            const file = new WSFile(arl, owner)
            owner.files.push(file)
        }
    }
}

function toggleRemoteFS() {

    if (!remoteFS) return;
    remoteFS.root.is.expanded ? remoteFS.collapse() : remoteFS.expand();

    remoteFS = remoteFS
}
function toggleLocalFS() {
    if (!localFS) return;
    localFS.root.is.expanded ? localFS.collapse() : localFS.expand();

    remoteFS = remoteFS
}

function getFolderPath(folder) {
    return Path.normalizeSeparators(folder?.arl?.fullPath ?? folder?.arl?.getPath?.() ?? '')
}

function getRootFolder(folder) {
    let current = folder ?? null
    while (current?.parent?.parent) current = current.parent
    return current
}

function getStartRoot(ref) {
    const fileTree = ref?.fileTree ?? ref?.arl?.fileTree ?? null
    if (fileTree) return getRootFolder(fileTree)

    if (ref?.handle || ref?.arl?.handle) return localFS?.root ?? null

    return null
}

function getStartFolderPath(ref) {
    if (!ref) return ''
    if (typeof ref.getFullPath === 'function') return Path.normalizeSeparators(ref.getFullPath())
    if (typeof ref.fullPath === 'string') return Path.normalizeSeparators(ref.fullPath)
    if (typeof ref.getPath === 'function') return Path.normalizeSeparators(ref.getPath())
    if (typeof ref.path === 'string') return Path.normalizeSeparators(ref.path)
    if (typeof ref.arl?.getFullPath === 'function') return Path.normalizeSeparators(ref.arl.getFullPath())
    if (typeof ref.arl?.fullPath === 'string') return Path.normalizeSeparators(ref.arl.fullPath)
    if (typeof ref.arl?.getPath === 'function') return Path.normalizeSeparators(ref.arl.getPath())
    return ''
}

function dirname(path) {
    const normalized = Path.normalizeSeparators(path ?? '')
    if (!normalized) return ''
    const slash = normalized.lastIndexOf('/')
    if (slash < 0) return ''
    if (slash === 0) return '/'
    return normalized.slice(0, slash)
}

function resolveRequestPath(startFolder, relativePath = '') {
    const startRoot = getStartRoot(startFolder)
    const startPath = getStartFolderPath(startFolder)
    let baseDir = dirname(startPath)

    if (!baseDir?.length && startPath?.length && startRoot) {
        baseDir = getFolderPath(startRoot) || '/'
    }

    if (!relativePath?.length) return baseDir

    if (!baseDir?.length) return Path.normalizeSeparators(relativePath)

    return Path.absolute(relativePath, `${baseDir}/x`)
}

function getWorkspaceRoots() {
    return [remoteFS?.root, localFS?.root].filter(Boolean)
}

function pickRoot(targetPath) {
    const normalized = Path.normalizeSeparators(targetPath ?? '')
    const roots = getWorkspaceRoots()

    return roots
        .sort((a, b) => getFolderPath(b).length - getFolderPath(a).length)
        .find((root) => {
            const rootPath = getFolderPath(root)
            return normalized === rootPath || normalized.startsWith(rootPath + '/') || rootPath === '/'
        }) ?? null
}

async function findFolder(root, targetPath) {

    if (!root) return null

    const rootPath = getFolderPath(root)
    const normalized = Path.normalizeSeparators(targetPath ?? '')
    const relative = rootPath === '/' ? normalized : normalized.slice(rootPath.length)
    const segments = relative.split('/').filter(Boolean)
    let folder = root

    for (const segment of segments) {
        if (folder.is?.stale) await folder.update()
        folder = folder.folders.find((entry) => entry.name === segment) ?? null
        if (!folder) return null
    }

    if (folder?.is?.stale) await folder.update()
    return folder
}

async function getFolderContent(startFolder, relativePath) {
    
    const targetPath = resolveRequestPath(startFolder, relativePath)
    if (!targetPath?.length) return {folders: [], files: []}

    const root = getStartRoot(startFolder) ?? pickRoot(targetPath)
    const folder = await findFolder(root, targetPath)

    return folder
        ? {folders: folder.folders.map((entry) => entry.name), files: folder.files.map((entry) => entry.name)}
        : {folders: [], files: []}
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

.workspace {
    /* workspace colors */
    --bg:#202020;
    --cHeader:#aaa;
    --cIcon: black;
	--fontBase: courier new,arial, helvetica, sans-serif;
    --bgTooltip:black;
    --cTooltip:white;

    cursor:pointer;
    background:inherit;    

    width: 100%;
	padding: 0.1rem 0.0rem 0.0rem 0rem;
    user-select:none;
}
.heading {
    display: flex;
    padding-top: 0.3rem;
    background:#9b9b9b;
    color: black;
}
.file-system {
    overflow-x: hidden;
    overflow-y: scroll;
    height:100%;
    margin:1rem 0rem 1rem 0rem;
    background:inherit;
}
h1 {
	font-family: var(--fontBase);
    font-size: 1rem;
    margin: 0.1rem 1rem 0rem 1rem;
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
	font-family: var(--fontBase);
    font-size: 0.9rem;
    margin-left: 1rem;
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
    border-radius: 3px;
    /* border: 2px solid var(--cTooltip); */
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
<div class="workspace" bind:this={mainDiv}>

    <div class="heading">
        <h1>Examples</h1>

        <div class="menu-item">
            <i class="material-icons-outlined" on:click={toggleRemoteFS} >{remoteFS?.root?.is.expanded ? "unfold_less" : "unfold_more"}</i>
            <div class="tooltip">{remoteFS?.root?.is.expanded ? "collapse all" : "expand all"}</div>
        </div>
    </div>

    <div class="file-system" bind:this={remoteDiv}>
        {#if remoteFS?.root}
            <FolderFileDiv folder={remoteFS.root} tx={tx}/>           
        {:else}
            <p class="no-selection">Examples could not be mounted.</p>
        {/if}
    </div>

    {#if allowLocalFS}
        <div class="heading">
            <h1>Local File System</h1>
            <div class="menu-item">
                <i class="material-icons-outlined" on:click={newLocalFS} >folder</i>
                <div class="tooltip" >Open folder</div>
            </div>
            {#if localFS}
                <div class="menu-item">
                    <i class="material-icons-outlined" on:click={toggleLocalFS} >{localFS.root?.is.expanded ? "unfold_less" : "unfold_more"}</i>
                    <div class="tooltip">{localFS.root?.is.expanded ? "collapse all" : "expand all"}</div>
                </div>
            {/if}
        </div>
        {#if localFS}
            <div class="file-system" bind:this={localDiv}>
                <FolderFileDiv folder={localFS.root} tx={tx}/>           
            </div> 
        {/if}
    {/if}
</div>
