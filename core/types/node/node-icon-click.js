
import {convert} from '../util/index.js'

const placePopup = (pos) => ({x: pos.x - 15, y: pos.y + 10})
const doEdit = (tx, verb, param) => tx.send('redox.doit', {verb, param})

/**
 * @node view manager
 */

export const nodeClickHandling = {

    showExportForm(pos,tx) {

        const node = this

        // send the show link path
        tx.send("name and path",{   
            title:  'Export to link' ,
            name: node.name,
            path:  '', 
            startFolder: null,
            pos:    pos,
            ok: (newName, userPath) => doEdit(tx,'saveToLink',{node, newName, userPath}),
            cancel:()=>{}
        })
    },

    showLinkForm(view, pos,tx) {

        const node = this

        // check what path to show
        const refArl = view?.getManager?.()?.getModel?.()?.getArl?.() ?? null
        const linkPath = node.link ? node.link.getPath(refArl) : ''

        // name to show
        const linkName = node.link ? node.link.lName : node.name

        // send the show link path
        tx.send("name and path",{   

            title: 'Set link' ,
            name: linkName,
            path: linkPath,
            startFolder: refArl,
            pos: pos,
            ok: (newName,newPath)=> {

                // if changed 
                if ((newName != linkName) || (newPath != linkPath)) doEdit(tx,'changeLink',{node, lName: newName, userPath: newPath})
            },
            open: (newName, newPath) => {

                // check for changes
                if ((newName != linkName) || (newPath != linkPath)) doEdit(tx,'changeLink',{node, lName: newName, userPath: newPath})

                // open the file if the link is to an outside file !
                const bluArl = node.link.model.getArl()
                if (bluArl) tx.send('open model',bluArl)
            },
            cancel:()=>{}
        })
    },

    iconClick(tx, view, icon, pos) {

        const node = this

        // move the popup a bit away from the icon
        const newPos = placePopup(pos)

        switch (icon.type) {
    
            case 'link':
            case 'lock':

                this.showLinkForm(view,newPos, tx)
                break

            case 'factory':

                // get the arl of the model
                const refArl = view?.getManager?.()?.getModel?.()?.getArl?.() ?? null

                // set the factory name and path if not available
                const factoryName = node.factory.fName.length < 1 ? convert.nodeToFactory(node.name) : node.factory.fName
                const factoryPath = node.factory.arl ? node.factory.getPath(refArl) : './nodes/' + convert.nodeToFilename(node.name) + '.js'

                // show the factory
                tx.send("name and path",{ title: 'Factory for ' + node.name, 
                                        name: factoryName,
                                        path: factoryPath,
                                        startFolder: refArl,
                                        pos: newPos,
                                        ok: (newName,newPath) => {

                                            // do the edit
                                            doEdit(tx,'changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()})
                                        },
                                        open: async (newName, newPath) => {

                                            // change the factory if anything was changed
                                            if ((newName != factoryName )||(newPath != factoryPath))
                                                doEdit(tx,'changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()})

                                            // get the current reference
                                            const arl = node.factory.arl

                                            // open the file
                                            if (arl) tx.send('open source file',{arl})
                                        },
                                        cancel:()=>{}
                })
                break;

            case 'group':
                
                // the next view to show
                let nextView = null

                // if we have a saved view
                if (node.savedView) {

                    // ..that is visible, close it and show the parent note that the savedview could still be 'raw' 
                    if (node.savedView.viewState?.visible) {

                        nextView = node.savedView.parent
                        if (nextView) node.savedView.closeView()
                    }
                    // otherwise restore the view (and cook it if necessary)
                    else {
                        view.restoreView(node)
                        nextView = node.savedView
                    }                    
                }
                else  {
                    // create a brand new subview
                    nextView = view.newSubView(node)
                }

                // switch the focus window to next
                //if (nextView) editor.switchFocus(nextView)
                break

            case 'cog':

                tx.send("node settings (sx)",{    title:'Settings for ' + node.name, 
                                        pos: newPos,
                                        json: node.sx,
                                        ok: (sx) => doEdit(tx,"changeNodeSettings",{node, sx})
                                    })                  
                break     

            case 'pulse': {

                const runtime = view?.getManager?.()?.getModel?.()?.header?.runtime ?? '@vizualmodel/vmblu-runtime/rt-base'

                tx.send("runtime settings (dx)",{    title:'Runtime settings for ' + node.name, 
                                                pos: newPos,
                                                runtime,
                                                dx: node.dx,
                                                ok: (dx) => doEdit(tx,"changeNodeDynamics",{node, dx})
                                            })
                break 
            }

            case 'comment':

                // save the node hit
                tx.send("node prompt", {   header: 'Comment for ' + node.name, 
                                            pos: newPos, 
                                            uid: node.uid, 
                                            text: node.prompt ?? '', 
                                            ok: (comment)=> doEdit(tx,"changeNodeComment",{node, comment})
                                        })
                break        
        }
    
    },

    iconCtrlClick(tx,view,icon, pos) {

        const node = this

        switch (icon.type) {
    
            case 'link': 
            case 'lock': {

                // open the file if it points to an external model
                const bluArl = node.link?.model?.getArl()
                if (bluArl) tx.send('open model', bluArl)
            }
            break

            case 'factory': {

                // check - should not be necessary
                if ( ! node.is.source) return

                // get the current reference
                const facArl = node.factory.arl //?? editor.doc.resolve('./index.js')

                // request to open the file
                if (facArl) tx.send('open source file', {facArl})
            }
            break
    
            case 'group':
                // if the node has a saved view, we show that otherwise create a new
                node.savedView ?  view.restoreView(node) : view.newSubView(node)

                // make it full screen
                node.savedView?.big()
                break

            case 'cog':
                break  
 
            case 'pulse':
                break 
                
            case 'comment':
                break        
        }
    
    }

}
