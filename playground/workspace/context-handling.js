


// the contextmenus
const contextMenu = []

export function folderContext(folder) {

    contextMenu.length = 0

    contextMenu.push({icon:"sell", text:"change name", state: "enabled",action:folder.nameDialog})

    contextMenu.push({
        icon:"note_add",text:"new file", state: "enabled", 
        action:(e) => tx.send(  "name request",{label:'new file', value:'', regex: Path.regex.file, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=>folder.newFile(newName),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"create_new_folder",text:"new folder",  state: "enabled", 
        action:(e) => tx.send(  "name request",{label:'new folder', value:'', regex: Path.regex.vizPath, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=>folder.newFolder(newName),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"folder_off",text:"remove folder", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm removal',message:`Remove ${folder.getPath()} from drawer ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => folder.remove(),
                                cancel:()=>{}})
        })
    contextMenu.push({
        icon:"delete",text:"delete folder", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm delete', message:`Delete ${folder.getPath()} ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => folder.remove(),
                                cancel:()=>{}})
        })

    return contextMenu
}

export function fileContext(file) {

    contextMenu.length = 0

    contextMenu.push({
        icon:"sell", text:"change name", state: "enabled", 
        action: (e) => tx.send( 'name request',{label:"Name ", value:this.name, regex:/^[\w,-]+$/, pos:{x:e.clientX, y:e.clientY},
                                ok:(newName)=> this.rename(newName),
                                cancel:()=> {}})
        })

    contextMenu.push({
        icon:"delete",text:"delete file", state: "enabled", 
        action: (e) => tx.send( 'message',{title:'Confirm delete',message:`Delete ${this.getPath()} ?`,pos:{x:e.clientX, y:e.clientY},
                                ok: () => this.remove(),
                                cancel:()=>{}})
    })

    return contextMenu
}

