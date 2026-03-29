import * as HTTP from './http.js'
import * as Path from './path.js'
import fs from 'fs/promises';
import path from 'path';

export function ARL(filePath) {

    const stringPath = Path.stringCheck(filePath);
    const normalizedPath = Path.normalizeSeparators(stringPath ?? '');

    this._locator = normalizedPath;

    // the resolved url
    this.url = stringPath ? Path.normalizeSeparators(path.resolve(stringPath)) : null;
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - sets the user path as ./last
// typically used as new ARL().absolute(url)
absolute(url) {

    this.url = path.resolve(this._locator)
},

toJSON() {
    return this._locator
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
    
    // othrewise just use the userpath
    return this._locator
},

// The full pathname - no host and no queries
getFullPath() {
    return this.url ? this.url : this._locator
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(filePath) {

    const stringPath = Path.stringCheck(filePath);
    if (!stringPath) return null;

    const normalizedPath = Path.normalizeSeparators(stringPath);

    // make an arl
    const arl = new ARL(normalizedPath)

    // check if absolute already
    if (path.isAbsolute(stringPath)) return arl

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${filePath} - missing reference`)
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

resolve_dbg(filePath) {

    const arl = this.resolve(filePath)
    console.log(`%cresolved: ${filePath} using ${this._locator} to ${arl._locator}`, 'background: #ff0; color: #00f')
    return arl
},

relativeTo(ref) {
    return Path.relative(this.getFullPath(), ref.getFullPath())
},

makeRelative(ref) {
    return this.relativeTo(ref)
},

copy() {
    const arl = new ARL(this._locator)
    arl.url = this.url
    return arl
},

validURL() {
    if (!this.url) {
        console.error(`missing url ${this._locator}`)
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
