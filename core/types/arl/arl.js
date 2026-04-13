import * as HTTP from './http.js'
import * as Path from './path.js'

// domain path resource uses a canonical path plus the resolved url
export function ARL(path) {

    const stringPath = Path.stringCheck(path);
    this._locator = Path.normalizeSeparators(stringPath ?? '')

    // the resolved url
    this.url = null
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - derive the canonical path from it
// typically used as new ARL().absolute(url)
absolute(url) {

    // generate the url
    this.url = new URL(url);
    this._locator = this.url.pathname

    // return the arl
    return this
},

toJSON() {
    return this._locator
},

equals(arl) {

    return (this.url && arl.url)&&(this.url.href == arl.url.href)
},

// returns true if both files are in the same directory
sameDir(arl) {

    if (!this.url || !arl.url) return false

    const slash1 = this.url.href.lastIndexOf('/')
    const slash2 = arl.url.href.lastIndexOf('/')

    return this.url.href.slice(0,slash1) === arl.url.href.slice(0, slash2)
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
    // for /dir1/dir2 and repo:/dir1/dir2 we use dir2
    const normalized = this._locator.endsWith('/') && this._locator.length > 1
        ? this._locator.slice(0, -1)
        : this._locator
    const slash = normalized.lastIndexOf('/')
    if (slash >= 0) return normalized.slice(slash + 1)

    // for repo: we use repo
    const colon = normalized.indexOf(':') 
    if (colon > 0) return normalized.slice(0, colon) 
    
    // otherwise just use the path
    return normalized
},

// The full pathname - no host and no queries
getFullPath() {
    return this.url ? this.url.pathname : this._locator
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(path) {

    const normalizedPath = Path.normalizeSeparators(path);

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${path} - missing reference`)
        return null
    }

    // and make a url that is relative to this
    const url = new URL(normalizedPath, this.url)
    const arl = new ARL(url.pathname)
    arl.url = url

    // done
    return arl
},

resolve_dbg(path) {

    const arl = this.resolve(path)
    console.log(`%cresolved: ${path} using ${this._locator} to ${arl._locator}`, 'background: #ff0; color: #00f')
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
    arl.url = this.url ? new URL(this.url) : null
    return arl
},

async getMeta() {

    // check
    if (!this.validURL()) return null

    const response = await HTTP.get(this.url, {method: 'HEAD'})
    const modified = response.headers.get('Last-Modified')
    const etag = response.headers.get('ETag')
    const contentLength = response.headers.get('Content-Length')
    const size = contentLength == null ? null : +contentLength

    return {modified, etag, size}
},

async getStamp() {

    const meta = await this.getMeta().catch(() => null)
    if (!meta) return null

    if (meta.etag) return `etag:${meta.etag}`

    const modified = meta.modified ?? ''
    const size = meta.size ?? ''
    return (modified || size !== '') ? `modified:${modified}|size:${size}` : null
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
    return HTTP.get(this.url)
    .then( async response => {

        // the size of the body could be 0 - that is ok
        if (response.headers.get('Content-Length') == '0') return null

        // wait for the content and return it 
        return (as=='json') ? await response.json() : await response.text()
    })
},

async save(body) {

    // check
    if (!this.validURL()) return null

    // add a query
    let query = `?action=save`

    // post the content
    return HTTP.post(this.url+query, body)
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
async jsImport() {},

}
