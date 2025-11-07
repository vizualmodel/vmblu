const iconList = null

const contextMenu = []

export function WSFile(arl, folder) {

    this.name = arl?.getName()
    this.folder = folder          
    this.arl = arl  
    this.is = {
        highLighted: false
    }                
}
WSFile.prototype = {

    getPath() {
        let path = this.folder.getPath()
        return path.at(-1) == '/' ? path + this.name : path + '/' + this.name
    },

    getExt() {
        let start = this.name.lastIndexOf('.')
        return start < 0 ? "any" : this.name.slice(start+1)
    },

    getIcon() {
        const ext = this.getExt()
        if (ext == 'vmblu') return 'account_tree' 
        if (ext == 'nmsh') return 'account_tree'
        if (ext == 'js' || ext == 'msj') return 'electric_bolt' 
        if (ext == 'json') return 'data_object'
        if (ext == 'html') return 'code'
        if (ext == 'css') return  'tag'
        return 'description'
    },

    getFileClass() {
        const ext = this.getExt()

        if (ext == "vmblu") return "vmblu-file"
        if (ext == "nmsh") return "nmsh-file"
        if (ext == "js") return "js-file"
        return "other-file"
    },

    rename(newName) {

        // no change..
        if (newName === this.name) return

        // check the name - no duplicates in the same folder
        if (!this.folder.checkName(newName)) return

        // update folder
        this.arl.rename(newName)
        .then( ok =>  {

            // the error has been given already
            if (!ok) return

            // get the old name
            const oldName = this.name

            // change the name and ..
            this.name = newName
            
            // ..update the file/folder div
            this.folder.getDrawer().update()

            // ..maybe someone needs to know that we renamed a file...
            tx.send('file renamed',{oldName,newName})
        })
        .catch( error => console.log(error))
    },

    confirmDelete(e) {
        showMessage("Confirm delete file", `Delete file  ${this.name}  ?`, (e) => this.remove() )
    },

    remove(){

        // remove the file at the server side
        this.arl?.remove()
        .then( () => {

            // add to the the folder
            this.folder.ejectFile(this)

            // update the drawer
            this.folder.getDrawer().update()

            // if there is a filetab open for the file - close it
            tx.send('file deleted',this.arl)
        })
        .catch( error => console.error(error))
    },
}