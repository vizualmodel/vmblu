export {WSFolder} from './ws-folder.js'
export {WSFile} from './ws-file.js'
import WorkspaceSvelte from './workspace.svelte'
import { mount } from 'svelte'

// the workspace factory 
export function Workspace(tx, sx) {

    // create a div for the tab ribbon
    const div = document.createElement("div")

    const workspace = mount(WorkspaceSvelte, {
        target: div,
        props: { tx, sx }
    })

    // return the handlers of the cell
    return workspace.handlers
}
