//import {showMessage} from '../../page/editor/user-message.js'
import {WSFile} from './index.js'
import {LARL, Path} from '../../core/arl/index.js'

// place holder
function showMessage(title, message) {}

const contextMenu = []

export function WSFileSystem(kind) {

    // The type of file system: none, local, api, fixed
    this.kind = kind;

    // the root
    this.root = null;
}
WSFileSystem.prototype = {
    collapse() {
        for (const folder of this.root.folders ) folder.is.expanded = false;
        this.root.is.expanded = false;
    },

    expand() {
        for (const folder of this.root.folders ) folder.is.expanded = true;
        this.root.is.expanded = true;
    }
}

export function WSFolder(arl, parent) {

    this.name = arl?.getName()
    this.parent = parent
    this.arl = arl
    this.files = []
    this.folders = []

    this.is = {
        expanded: false,        // show sub folders & files
        stale: true             // true if the content of the folder needs to be fetched
    }
 }
WSFolder.prototype = {

    toJSON() {
        // subfolders are preceded by a blank. parent.parent = drawer for root files 
        if (this.parent.parent.parent) return ' ' + this.arl.userPath

        // root folders are either expanded or not..
        return this.is.expanded ? '+' + this.arl.userPath : '-' + this.arl.userPath
    },

    async findFile(path) {

        // find the name part
        let slash = path.lastIndexOf('/')

        // extract the filename (works even if slash = -1 !)
        let fileName = path.slice(slash+1)

        // get the directory part
        let dirPath = slash > 0 ? path.slice(0,slash) : path

        // find the folder starting from this folder
        let folder = this

        // walk down the tree - filter out empty names
        for (const folderName of dirPath.split('/').filter(Boolean)) {

            folder = folder.folders.find( f => folderName === f.name)

            if (!folder) return null

            if (folder.is.stale) await folder.update()
        }

        // no such folder
        if (!folder) return null

        // if the folder is stale, update it
        if (folder.is.stale) await folder.update()

        // finally find the file in the folder
        let wsFile = folder.files.find( file => fileName == file.name)

        // done
        return wsFile       
    },

    getRoot() {

        return this.parent ? this.parent.getRoot() : this.arl
    },

    // the icon to the left of the folder name
    getIcon() {
        return this.is.expanded ? 'folder_open' : 'folder'
    },

    getName() {
        return this.name
    },

    getFileSystem() {

        let parent = this.parent
        while (parent?.parent) parent = parent.parent

        // the top level parent is the file system
        return parent
    },

    checkName(name) {
        if (name.length < 1) {
            return false
        }
        else if ( ! Path.checkPath(name)) {
            showMessage('Invalid name', `${name} is not a valid name for a file or a folder.`)
            return false
        }
        else if ( this.folders.find( f => f.name === name)) {
            showMessage('Duplicate name', `${name} is not unique in this folder.`)
            return false
        }
        else if ( this.files.find( f => f.name === name)) {
            showMessage('Duplicate name', `${name} is not unique in this folder.`)
            return false
        }
        else return true
    },

    getFileTreeAndPath(){

        // get filetree root and the folder path
        let fileTree = this
        const folderNames = []
        while (fileTree.parent) {
            folderNames.push(fileTree.getName())
            fileTree = fileTree.parent
        }
        const path = '/' + folderNames.reverse().join('/') + '/'   

        return [fileTree, path]
    },

    async update() {

        // get the type of filesystem
        const fileSystem = this.getFileSystem()

        // update depends on the type of file system
        switch (fileSystem?.kind) {


            case 'local' : 

                // reset
                this.folders = [];
                this.files = [];

                console.log(this.arl)

                // Get the folders and files of the directory
                for await (const entry of this.arl.handle.values()) {

                    // resolve the arl wrt this directory
                    const arl = this.arl.resolve(entry.name)
                    arl.handle = entry

                    if (entry.kind == 'directory') {
                        const wsFolder = new WSFolder(arl, this)
                        wsFolder.fsType = this.fsType
                        this.folders.push(wsFolder)
                    }
                    else if (entry.kind == 'file') {
                        const wsFile = new WSFile(arl, this)
                        this.files.push(wsFile)
                    }
                }
                return;

            case 'api':
                return;

            case 'fixed':
                return;

            case 'none': 
                return;

        }
    },

    ejectFolder(folder) {
        this.folders = this.folders.filter( f => f != folder)
    },

    // remove a file from the workspace folder
    ejectFile(file) {
        this.files = this.files.filter( f => f != file)       
    },
}
