import * as Path from './path.js'

// domain path resource uses a canonical path plus optional local file handle
export function LARL(path, handle=null) {

    this._locator = Path.normalizeSeparators(path)

    // the handle for local files or folders
    this.handle = handle

    // This allows to find the file in the file system
    this.fullPath = null
    this.fileTree = null
}
LARL.prototype =  {  // makes a url based on the components

// The url is a full url - sets the user path as ./last
// typically used as new ARL().absolute(url)
absolute() {
},

toJSON() {
    return this._locator
},

equals(arl) {

    if (!arl) return false

    if (this.handle && arl.handle) return this.handle === arl.handle
    if (this.fullPath && arl.fullPath) return this.fullPath === arl.fullPath
    return this._locator === arl._locator
},

// returns true if both files are in the same directory
sameDir(arl) {
    return false
},

getPath() {
    return this._locator
},

getExt() {
    // get the position of the last period
    let n = this._locator.lastIndexOf('.')

    // get the extension of the file - if any
    return n < 0 ? '' : this._locator.slice(n+1)
},

getName() {
    // for repo:/dir1/dir2 we use dir2
    const slash = this._locator.lastIndexOf('/')
    if (slash > 0) return this._locator.slice(slash+1)

    // for repo: we use repo
    const colon = this._locator.indexOf(':') 
    if (colon > 0) return this._locator.slice(0, colon) 
    
    // otherwise just use the path
    return this._locator
},

setFileSystem(fileTree, fullPath){
    this.fileTree = fileTree
    this.fullPath = fullPath
},

// The full pathname - no host and no queries
getFullPath() {
    return this.fullPath
},

resolve(path){

    const normalizedPath = Path.normalizeSeparators(path)

    // The reference can be a directory or a file - .absolute always assumes a file, so add /x to make it a file...
    const ref = (this.handle?.kind != 'directory') ? this.fullPath : (this.fullPath.at(-1) == '/' ? this.fullPath + 'x' : this.fullPath + '/x') 

    // resolve the path
    const fullPath = Path.absolute(normalizedPath, ref)

    // create a new local arl
    const alr = new LARL(fullPath)

    // set the file tree
    alr.setFileSystem(this.fileTree, fullPath)

    // done
    return alr
},

relativeTo(ref) {
    return Path.relative(this.getFullPath(), ref.getFullPath())
},

makeRelative(ref) {
    return this.relativeTo(ref)
},

copy() {
    const arl = new LARL(this._locator, this.handle)

    arl.fullPath = this.fullPath
    arl.fileTree = this.fileTree

    return arl
},

async ensureHandle() {

    if (this.handle) return this.handle

    const rootHandle = this.fileTree?.arl?.handle
    const fullPath = this.fullPath

    if (rootHandle && fullPath?.startsWith('/')) {
        const parts = fullPath.split('/').filter(Boolean)

        if (parts.length > 0) {
            let dirHandle = rootHandle

            for (let i = 0; i < parts.length - 1; i++) {
                dirHandle = await dirHandle.getDirectoryHandle(parts[i])
            }

            this.handle = await dirHandle.getFileHandle(parts.at(-1))
            return this.handle
        }
    }

    const wsFile = await this.fileTree?.findFile?.(fullPath)
    if (!wsFile?.arl?.handle) return null

    this.handle = wsFile.arl.handle
    return this.handle
},

async getMeta() {

    const handle = await this.ensureHandle()
    if (!handle) return null

    const file = await handle.getFile()
    return {modified: file.lastModified, size: file.size}
},

async getStamp() {

    const meta = await this.getMeta().catch(() => null)
    if (!meta) return null

    return `modified:${meta.modified ?? ''}|size:${meta.size ?? ''}`
},

validURL() {
    if (!this.handle) {
        console.error(`missing handle for ${this.fullPath}`)
        return false
    } 
    return true
},

async get(as = 'text') {

    const handle = await this.ensureHandle()
    if (!handle) throw(new Error(`get(${this.fullPath}) in local-arl.js : handle for the file not found)`))

    // Attempt to retrieve the file from the handle.
    const file = await handle.getFile();

    // If the file is empty, return null (mirroring the behavior for remote files)
    if (file.size === 0) return null;
    
    // Read the file content as text.
    const content = await file.text();
    
    // Return the content as JSON if requested, otherwise as raw text.
    return as === 'json' ? JSON.parse(content) : content;        
},

async xxxget(as = 'text') {

    let file;
    try {

        // if the handle for this file is null, we have to find it first
        if (!this.handle) {

            // find the file
            const wsFile = await this.fileTree.findFile(this.fullPath)

            // check
            if (!wsFile) {
                console.warn(`get(${this.fullPath}) in local-arl.js : handle for the file not found)`)
                return null
            }

            // set the handle
            this.handle = wsFile.arl.handle
        }

        // Attempt to retrieve the file from the handle.
        file = await this.handle.getFile();

    } catch (error) {

        // If an error occurs (e.g., file not found), log the error and return null.
        console.warn(`get(${this.fullPath}) in local-arl.js failed: ${error}`)
        return null;
    }
    
    // If the file is empty, return null (mirroring the behavior for remote files)
    if (file.size === 0) return null;
    
    // Read the file content as text.
    const content = await file.text();
    
    // Return the content as JSON if requested, otherwise as raw text.
    return as === 'json' ? JSON.parse(content) : content;        
},

async save(body) {

    // ---- small helpers ----
    const dirname = (p) => {
        // strip trailing slash (except root), then take everything before the last '/'
        if (!p) return '';
        const s = p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p;
        const i = s.lastIndexOf('/');
        return i <= 0 ? '/' : s.slice(0, i);
    };
    const basename = (p) => {
        if (!p) return '';
        const s = p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p;
        const i = s.lastIndexOf('/');
        return i < 0 ? s : s.slice(i + 1);
    };

    // Walk from a known root directory handle to the target directory, creating any missing segments.
    const ensureDirHandle = async (rootDirHandle, absDirPath) => {
        if (!rootDirHandle) throw new Error('Missing root directory handle');
        // Normalize and split: '/a/b/c' -> ['a','b','c']
        const parts = absDirPath
            .replace(/^\/*/, '/')            // ensure leading slash
            .split('/')
            .filter(Boolean);                // drop empty segments

        let dir = rootDirHandle;
        for (const part of parts) {
            dir = await dir.getDirectoryHandle(part, { create: true });
        }
        return dir;
    };

    const createFileHandle = async () =>  {
        // not found: create it. First get the filetree handle
        const rootDirHandle = this.fileTree.arl.handle;

        const dirPath = dirname(this.fullPath);     // e.g. '/projects/demo'
        const fileName = basename(this.fullPath);   // e.g. 'data.json'

        const parentDir = await ensureDirHandle(rootDirHandle, dirPath);
        const fileHandle =  await parentDir.getFileHandle(fileName, { create: true });

        return fileHandle
    }

    // ---- ensure we have a file handle (find or create) ----
    try {
        if (!this.handle) {
        
            // Try to find an existing file in your file tree abstraction
            const wsFile = await this.fileTree?.findFile?.(this.fullPath);

            // check
            if (wsFile?.arl?.handle) {

                // ok found
                this.handle = wsFile.arl.handle;

            } else {
                // Optional: let your file tree know this file now exists
                // (depends on your fileTree implementation)
                // await this.fileTree?.registerFile?.(this.fullPath, this.handle);

                this.handle = await createFileHandle()
            }
        }

        // Sanity check: if we have a handle but the underlying file was deleted,create it again.
        try {
            await this.handle.getFile();
        } 
        catch {
            this.handle = await createFileHandle()
        }
    } 
    catch (err) {
        console.error(`Unable to obtain/create handle for ${this.fullPath}:`, err);
        return null;
    }

    // ---- write the content ----
    try {
        const writable = await this.handle.createWritable();
        await writable.write(body);
        await writable.close();
        return true;
    } catch (error) {
        console.error('Error saving local file:', error);
        return null;
    }
},


// javascript source files can be imported
async jsImport() {
    return null
},

// async getFolderContent(){

//     // reset the files and folders arrays
//     const content = {
//         folders: [],
//         files: []
//     }

//     // Get the folders and files of the directory
//     for await (const entry of this.handle.values()) {

//         // resolve the arl wrt this directory
//         const arl = this.resolve(entry.name)
//         arl.handle = entry
//         entry.kind === 'directory' ? content.folders.push(arl) : 
//         entry.kind === 'file' ? content.files.push(arl) : null
//     }

//     return content
// },

}
