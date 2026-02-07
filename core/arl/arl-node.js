import * as HTTP from './http.js'
import * as Path from './path.js'
import fs from 'fs/promises';
import path from 'path';

// domain path resource are the shorthands as they appear in the workspace file 
function xxuserPathString(userPath) {
    if (typeof userPath === 'string') return userPath;
    if (userPath && typeof userPath === 'object') {
        if (typeof userPath.fsPath === 'string') return userPath.fsPath;
        if (typeof userPath.path === 'string') return userPath.path;
        if (typeof userPath.url === 'string') return userPath.url;
    }
    return null;
}

export function ARL(userPath) {

    const stringPath = Path.stringCheck(userPath);
    const normalizedPath = Path.normalizeSeparators(stringPath ?? '');

    // the reference to the ARL as entered by the user
    this.userPath = normalizedPath;

    // the resolved url
    this.url = stringPath ? Path.normalizeSeparators(path.resolve(stringPath)) : null;
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - sets the user path as ./last
// typically used as new ARL().absolute(url)
absolute(url) {

    this.url = path.resolve(this.userPath)
},

toJSON() {
    return this.userPath
},

equals(arl) {

    return (this.url && arl.url)&&(this.url == arl.url)
},

// returns true if both files are in the same directory
sameDir(arl) {

    if (!this.url || !arl.url) return false

    const slash1 = this.url.href.lastIndexOf('/')
    const slash2 = arl.url.href.lastIndexOf('/')

    return this.url.slice(0,slash1) === arl.url.slice(0, slash2)
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
    
    // othrewise just use the userpath
    return this.userPath
},

// The full pathname - no host and no queries
getFullPath() {
    return this.url ? this.url : this.userPath
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(userPath) {

    const stringPath = Path.stringCheck(userPath);
    if (!stringPath) return null;

    const normalizedPath = Path.normalizeSeparators(stringPath);

    // make an arl
    const arl = new ARL(normalizedPath)

    // check if absolute already
    if (path.isAbsolute(stringPath)) return arl

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${userPath} - missing reference`)
        return null
    }

    // remove the last file name
    const slash = Math.max(this.url.lastIndexOf('/'), this.url.lastIndexOf("\\"))
    const ref = (slash != -1) ? this.url.slice(0, slash) : this.url

    // resolve
    arl.url = Path.normalizeSeparators(path.resolve(ref, normalizedPath));

    // done
    return arl
},

resolve_dbg(userPath) {

    const arl = this.resolve(userPath)
    console.log(`%cresolved: ${userPath} using ${this.userPath} to ${arl.userPath}`, 'background: #ff0; color: #00f')
    return arl
},

// make a new user path relative to this new reference - the actual url does not change
makeRelative( ref ) {

    // if the user path contains a colon, it is an absolute path - nothing to change
    //const colon = this.userPath.indexOf(':')
    //if (colon > 0) return

    // check if the new path and the old path have a part incommon
    let oldFullPath = this.getFullPath()
    let refFullPath = ref.getFullPath()

    // express the old full path as a reference to the new ref full path
    this.userPath = Path.relative(oldFullPath, refFullPath)
},

copy() {
    const arl = new ARL(this.userPath)
    arl.url = this.url
    return arl
},

validURL() {
    if (!this.url) {
        console.error(`missing url ${this.path}`)
        return false
    } 
    return true
},

async get(as='text') {

    // check
    if (!this.validURL()) return null

    // get the file - return the promise
    return fs.readFile(this.url, 'utf8')
    .then( async data => {

        if (as=='json') return JSON.parse(data)
        return data
    })
},

async save(body) {

    // check
    if (!this.validURL()) return null

    // add a query
    let query = `?action=save`

    // post the content
    return fs.writeFile(this.url, body)
},

// async getFolder() {

//     // check
//     if (!this.validURL()) return null

//     // wet have to add the api and service 
//     let href = this.url.origin + '/api/folder' + this.url.pathname

//     const url = new URL(href)

//     // request the file - return the body
//     return await HTTP.get(url)
//     .then( async response => {

//         // the size of the body could be 0 - that is ok
//         if (response.headers.get('Content-Length') == '0') return null
        
//         // convert
//         return await response.json()
//     })
// },

// javascript source files can be imported
async jsImport() {

    // check
    if (!this.validURL()) return null

    return import(this.url)
},

// async getFolderContent(){

//     const content = {
//         files: [],
//         folders: []
//     }

//     // get the folder - return the promise
//     return this.getFolder()
//     .then( raw => {
        
//         // convert to arls...
//         content.files = raw.files.map(name => this.resolve(this.userPath + '/' + name)),
//         content.folders = raw.folders.map(name => this.resolve(this.userPath + '/' + name))
        
//         // return result - that resolves the promise
//         return content
//     })
//     .catch (error => {

//         // debug
//         console.error(error)

//         // if the path was not found, fail silently else throw
//         if (error.options?.status != '404') throw error

//         // return result
//         return content
//     })
// }
}
