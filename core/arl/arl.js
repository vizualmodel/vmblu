import * as HTTP from './http.js'
import * as Path from './path.js'

// domain path resource are the shorthands as they appear in the workspace file 
export function ARL(userPath) {

    // the reference to the ARL as entered by the user
    this.userPath = userPath

    // the resolved url
    this.url = null
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - sets the user path as ./last
// typically used as new ARL().absolute(url)
absolute(url) {

    // find the last slash
    const slash = url.lastIndexOf('/');

    // set the user path
    this.userPath = slash >= 0 ? '.' + url.slice(slash) : url;

    // generate the url
    this.url = new URL(url);

    // return the arl
    return this
},

toJSON() {
    return this.userPath
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
    return this.url ? this.url.pathname : this.userPath
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(userPath) {

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${userPath} - missing reference`)
        return null
    }

    // make an arl
    const arl = new ARL(userPath)

    // and make a url that is relative to this
    arl.url = new URL(userPath, this.url)

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
    arl.url = this.url ? new URL(this.url) : null
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

async getFolder() {

    // check
    if (!this.validURL()) return null

    // wet have to add the api and service 
    let href = this.url.origin + '/api/folder' + this.url.pathname

    const url = new URL(href)

    // request the file - return the body
    return await HTTP.get(url)
    .then( async response => {

        // the size of the body could be 0 - that is ok
        if (response.headers.get('Content-Length') == '0') return null
        
        // convert
        return await response.json()
    })
},

// javascript source files can be imported
async jsImport() {

    // check
    if (!this.validURL()) return null

    return import(this.url)
},

async getFolderContent(){

    const content = {
        files: [],
        folders: []
    }

    // get the folder - return the promise
    return this.getFolder()
    .then( raw => {
        
        // convert to arls...
        content.files = raw.files.map(name => this.resolve(this.userPath + '/' + name)),
        content.folders = raw.folders.map(name => this.resolve(this.userPath + '/' + name))
        
        // return result - that resolves the promise
        return content
    })
    .catch (error => {

        // debug
        console.error(error)

        // if the path was not found, fail silently else throw
        if (error.options?.status != '404') throw error

        // return result
        return content
    })
}

// async post(body, mime='application/json', query=null) {

//     // post the content
//     return query ? HTTP.post(this.url+query, body, mime) :  HTTP.post(url, body, mime)
// },

// // create the folder
// async createFolder() {
// },

// // remove the file
// async remove() {

//     // remove the folder on the server
//     return HTTP.del(this.url)
//     .catch( error => {

//         // if the path was not found, fail silently 
//         if (error.options.status != '404') throw error
//     })
// },

// // rename the file 
// rename(newName){

//     // construct the url 
//     // const url = this.makeUrl()

//     // prepare the query
//     let query = `?action=rename&new-name=${newName}`

//     // request the name change - return the promise 
//     return HTTP.post(this.url+query)
//     .then( response => {

//         // change the name
//         this.xxxchangeFileName(newName)

//         // succesful
//         return response
//     })
// },
}


