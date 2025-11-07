export {WSFolder} from './ws-folder.js'
export {WSFile} from './ws-file.js'
import Workspace from './workspace.svelte'
import {mount} from 'svelte'

// the workspace factory 
export function WorkspaceFactory(tx, sx) {

    // create a div for the tab ribbon
    const div = document.createElement("div")

    const workspace = mount(Workspace, {
        target: div,
        props: { tx, sx }
    });

    // create the workspace div
    // const workspace = new Workspace(
    //     {
    //         target: div,
    //         props: {
    //             tx, sx
    //         }
    //     }
    // )

    // return the handlers of the cell
    return workspace.handlers
}