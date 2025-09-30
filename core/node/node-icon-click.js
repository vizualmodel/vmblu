
import {convert} from '../util/index.js'
import {editor} from '../editor/index.js'

function placePopup(pos) {
    return {x: pos.x - 15, y:pos.y + 10}
}

export const nodeClickHandling = {

    showExportForm(pos) {

        const node = this
        const tx = editor.tx

        // send the show link path
        editor.tx.send("show link",{   
            title:  'Export to link' ,
            name: node.name,
            path:  '', 
            pos:    pos,
            ok: (newName, userPath) => editor.doEdit('saveToLink',{node, newName, userPath}),
            cancel:()=>{}
        })
    },

    showLinkForm(pos) {

        const node = this
        const tx = editor.tx

        // check what path to show - show no path if from the main model
        const linkPath = (node.link && (node.link.model != editor.doc?.model)) ? node.link.model?.arl.userPath : ''

        // name to show
        const linkName = node.link ? node.link.lName : node.name

        // send the show link path
        editor.tx.send("show link",{   

            title: 'Set link' ,
            name: linkName,
            path: linkPath,
            pos: pos,
            ok: (newName,newPath)=> {

                // if changed 
                if ((newName != linkName) || (newPath != linkPath))
                    editor.doEdit('changeLink',{node, lName: newName, userPath: newPath})
            },
            open: (newName, newPath) => {

                // check for changes
                if ((newName != linkName) || (newPath != linkPath))
                    editor.doEdit('changeLink',{node, lName: newName, userPath: newPath})

                // open the file if the link is to an outside file !
                if (node.link.model?.arl && (node.link.model != editor.doc?.model)) tx.send('open document',node.link.model.arl)
            },
            cancel:()=>{}
        })
    },

    iconClick(view, icon, pos) {

        const node = this
        const tx = editor.tx

        // move the popup a bit away from the icon
        const newPos = placePopup(pos)

        switch (icon.type) {
    
            case 'link':
            case 'lock':

                this.showLinkForm(newPos)
                break

            case 'factory':

                // set the factory name and path if not available
                const factoryName = node.factory.fName.length < 1 ? convert.nodeToFactory(node.name) : node.factory.fName
                const factoryPath = node.factory.arl ? node.factory.arl.userPath : ''

                // show the factory
                tx.send("show factory",{ title: 'Factory for ' + node.name, 
                                        name: factoryName,
                                        path: factoryPath,
                                        pos: newPos,
                                        ok: (newName,newPath) => {

                                            // do the edit
                                            editor.doEdit('changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()})
                                        },
                                        open: async (newName, newPath) => {

                                            // change the factory if anything was changed
                                            if ((newName != factoryName )||(newPath != factoryPath))
                                                editor.doEdit('changeFactory',{node,newName : newName.trim(),userPath: newPath.trim()})

                                            // get the current reference
                                            const arl = node.factory.arl ?? editor.doc.resolve('./index.js')

                                            // open the file
                                            tx.send('open source file',{arl})
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
                if (nextView) editor.switchView(nextView)
                break

            case 'cog':

                tx.send("settings",{    title:'Settings for ' + node.name, 
                                        pos: newPos,
                                        json: node.sx,
                                        ok: (sx) => editor.doEdit("changeNodeSettings",{node, sx})
                                    })                  
                break     

            case 'pulse':

                tx.send("runtime settings",{    title:'Runtime settings for ' + node.name, 
                                                pos: newPos,
                                                dx: node.dx,
                                                ok: (dx) => editor.doEdit("changeNodeDynamics",{node, dx})
                                            })
                break 

            case 'comment':

                // save the node hit
                tx.send("node comment", {   header: 'Comment for ' + node.name, 
                                            pos: newPos, 
                                            uid: node.uid, 
                                            text: node.prompt ?? '', 
                                            ok: (comment)=> editor.doEdit("changeNodeComment",{node, comment})
                                        })
                break        
        }
    
    },

    iconCtrlClick(view,icon, pos) {

        const node = this
        const tx = editor.tx

        switch (icon.type) {
    
            case 'link': 
            case 'lock': {

                // open the file if it points to an external model
                if (node.link?.model?.arl && (node.link.model != editor.doc?.model)) tx.send('open document',node.link.model.arl)
            }
            break

            case 'factory': {

                // check - should not be necessary
                if ( ! node.is.source) return

                // get the current reference
                const arl = node.factory.arl ?? editor.doc.resolve('./index.js')

                // request to open the file
                if (arl) tx.send("open source file", {arl})
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
    
    },

}