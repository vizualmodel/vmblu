import * as Path from './path.js'

// domain path resource are the shorthands as they appear in the workspace file 
export function LARL(userPath, handle=null) {

    // the reference to the ARL as entered by the user
    this.userPath = userPath

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
    return this.userPath
},

equals(arl) {

    return  (this.handle && arl.handle) ? (this.handle == arl.handle) 
            : (this.fullPath && arl.fullPath) ? (this.fullPath === arl.fullPath) : null
},

// returns true if both files are in the same directory
sameDir(arl) {
    return false
},

getPath() {
    return this.userPath
},

getExt() {
    // get the position of the last period
    let n = this.userPath.lastIndexOf('.')

    // get the extension of the file - if any
    return n < 0 ? '' : this.userPath.slice(n+1)
},

getName() {
    // for repo:/dir1/dir2 we use dir2
    const slash = this.userPath.lastIndexOf('/')
    if (slash > 0) return this.userPath.slice(slash+1)

    // for repo: we use repo
    const colon = this.userPath.indexOf(':') 
    if (colon > 0) return this.userPath.slice(0, colon) 
    
    // otherwise just use the userpath
    return this.userPath
},

setFileSystem(fileTree, fullPath){
    this.fileTree = fileTree
    this.fullPath = fullPath
},

// The full pathname - no host and no queries
getFullPath() {
    return this.fullPath
},

resolve(userPath){

    // The reference can be a directory or a file - .absolute always assumes a file, so add /x to make it a file...
    const ref = (this.handle?.kind != 'directory') ? this.fullPath : (this.fullPath.at(-1) == '/' ? this.fullPath + 'x' : this.fullPath + '/x') 

    // resolve the path
    const fullPath = Path.absolute(userPath, ref)

    // create a new local arl
    const alr = new LARL(userPath)

    // set the file tree
    alr.setFileSystem(this.fileTree, fullPath)

    // done
    return alr
},

// make a new user path relative to this new reference
makeRelative( ref ) {

    // check if the new path and the old path have a part incommon
    let oldFullPath = this.getFullPath()
    let refFullPath = ref.getFullPath()

    // express the old full path as a reference to the new ref full path
    this.userPath = Path.relative(oldFullPath, refFullPath)
},

copy() {
    const arl = new LARL(this.userPath, this.handle)

    arl.fullPath = this.fullPath
    arl.fileTree = this.fileTree

    return arl
},

validURL() {
    if (!this.handle) {
        console.error(`missing handle for ${this.fullPath}`)
        return false
    } 
    return true
},

async get(as = 'text') {

    let file;
    try {

        // if the handle for this file is null, we have to find it first
        if (!this.handle) {

            // find the file
            const wsFile = await this.fileTree.findFile(this.fullPath)

            // check
            if (!wsFile) {
                console.warn(`LALR.get(${this.fullPath}: file not found)`)
                return null
            }

            // set the handle
            this.handle = wsFile.arl.handle
        }

        // Attempt to retrieve the file from the handle.
        file = await this.handle.getFile();

    } catch (error) {

        // If an error occurs (e.g., file not found), log the error and return null.
        console.error(`LALR.get(${this.fullPath}) failed: ${error}`)
        return null;
    }
    
    // If the file is empty, return null (mirroring the behavior for remote files)
    if (file.size === 0) return null;
    
    // Read the file content as text.
    const content = await file.text();
    
    // Return the content as JSON if requested, otherwise as raw text.
    return as === 'json' ? JSON.parse(content) : content;        
},

async xsave(body) {
    // First, ensure the file is still accessible
    try {

        // if the handle for this file is null, we have to find it first
        if (!this.handle) {

            // find the file
            const wsFile = await this.fileTree.findFile(this.fullPath)

            // check
            if (!wsFile) {
                console.warn(`LALR.get(${this.fullPath}: file not found)`)
                return null
            }

            // set the handle
            this.handle = wsFile.arl.handle
        }
        
        // This will throw an error if the file has been deleted or is otherwise inaccessible
        await this.handle.getFile();
    } catch (error) {
        console.error("Local file is no longer accessible:", error);
        return null;
    }
    
    // Now, proceed with writing the content to the file
    try {
        // Create a writable stream using the File System Access API
        const writable = await this.handle.createWritable();
        
        // Write the content (body) to the file. The 'body' may be a string or Blob as needed.
        await writable.write(body);
        
        // Closing the writable stream commits the changes to disk
        await writable.close();
        
        // Optionally, return a success indicator (e.g., true)
        return true;
    } catch (error) {
        console.error("Error saving local file:", error);
        return null;
    }
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
                // not found: create it. First get the root directory
                const rootDirHandle = this.fileTree.getRoot().handle;

                const dirPath = dirname(this.fullPath);     // e.g. '/projects/demo'
                const fileName = basename(this.fullPath);   // e.g. 'data.json'

                const parentDir = await ensureDirHandle(rootDirHandle, dirPath);
                this.handle = await parentDir.getFileHandle(fileName, { create: true });

                // Optional: let your file tree know this file now exists
                // (depends on your fileTree implementation)
                // await this.fileTree?.registerFile?.(this.fullPath, this.handle);
            }
        }

        // Sanity check: if we have a handle but the underlying file was deleted,create it again.
        try {
            await this.handle.getFile();
        } 
        catch {
            const rootDirHandle = this.fileTree.getRoot().handle;

            const dirPath = dirname(this.fullPath);
            const fileName = basename(this.fullPath);
            const parentDir = await ensureDirHandle(rootDirHandle, dirPath);
            this.handle = await parentDir.getFileHandle(fileName, { create: true });
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

async getFolderContent(){

    // reset the files and folders arrays
    const content = {
        folders: [],
        files: []
    }

    // Get the folders and files of the directory
    for await (const entry of this.handle.values()) {

        // resolve the arl wrt this directory
        const arl = this.resolve(entry.name)
        arl.handle = entry
        entry.kind === 'directory' ? content.folders.push(arl) : 
        entry.kind === 'file' ? content.files.push(arl) : null
    }

    return content
},

}


