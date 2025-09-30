import {ARL} from '../../core/arl/index.js'
import {Drawer} from './drawer.js'
import {WSFolder} from './ws-folder.js'
import {WSFile} from './ws-file.js'

export function SimpleServer(arl) {

    this.arl = arl
}
SimpleServer.prototype = {

async getDrawers() {

    // get the file
    const raw = await this.arl.get('json')
    .catch( err => {
        console.error("Could not get workspace file ",this.arl.getPath(), err)
        return
    })

    // convert to json
    return await this.cookJSON(raw)
},

async cookJSON(raw) {
    const drawers = await Promise.all(
        raw.drawers.map(rawDrawer => this.cookDrawer(rawDrawer))
    );
    return drawers;
},
    
async cookDrawer(rawDrawer) {

    // create a drawer
    const drawer = new Drawer(rawDrawer.name.slice(1), new WSFolder(this.arl,null))

    // set if expanded
    drawer.root.is.expanded = (rawDrawer.name[0] == '+')

    // the folders - check
    if (!rawDrawer.folders) return

    let wsFolder = null
    for (const strArl of rawDrawer.folders) {

        // convert the arl 
        const rawArl = strArl.slice(1)

        // get the type character
        const indicator = strArl[0]

        // resolve the url
        let arl = this.arl.resolve(rawArl)

        // create the workspace folder also
        wsFolder =  new WSFolder(arl, this.root)

        // save the root folders
        drawer.root.folders.push(wsFolder)

        // if the folder is not expanded just continue
        if (indicator == '-') continue

        // set the expansion bit
        wsFolder.is.expanded = true

        // get the folder content
        await wsFolder.update()

        // // do an update of the folder - wait for it - the next one might be a subfolder ..
        // if (await wsFolder.update()) {

        //     // if we are at the root level, the updates have been done 
        //     if (indicator=='+') continue

        //     // try to find the expanded directory in the last added folder
        //     const here = this.root.folders.at(-1).findFolder(wsFolder.arl.userPath)

        //     // check
        //     if (!here) {
        //         console.log('Cannot attach folder in drawer.cookJSON: ', wsFolder.arl.userPath)
        //         continue
        //     }

        //     // set files and folders for the expanded
        //     here.folders = wsFolder.folders
        //     here.files = wsFolder.files
        //     here.is.expanded = true
        // }
    }

    return drawer
},

}