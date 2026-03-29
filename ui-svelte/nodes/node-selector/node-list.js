const maxCols = 10
const maxColSize = 20

export function alfa(str) {
return str
}

export function xalfa(str) {
    const p = str ? str.indexOf('|') : -1
    return p<0  ? str : str.slice(p+1)
}

export function NodeList(tx) {

    this.tx = tx

    // cols is an array of arrays
    this.cols = []
    this.xyLocal = {x:0, y:0}

}
NodeList.prototype = {

    // a function to init the cols array - just counts the number of columns that are required
    init(libMap) {

        // reset 
        this.cols = []

        // the nr of cols we have so far
        let colNr = 0

        // the size remaining in a col
        let colRemaining = maxColSize

        // all the first level nodes in the links
        for(const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

            // if we have enough place for the entire linkmap, we add it to the current column
            const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++
                colRemaining = maxColSize
            }
            colRemaining -= libSize
        }

        // set the nr of cols
        colNr++
        while (colNr-- > 0) this.cols.push([])
    },

    fill(libMap) {

        // notation
        const cols = this.cols

        // The col nr 
        let colNr = 0

        // The remaining size in the col
        let colRemaining = maxColSize

        // make the cols to display
        for (const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

           // if we have enough place for the entire linkmap, we add it to the current column
           const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++
                colRemaining = maxColSize
            }
            colRemaining -= libSize

            // The name of the library comes first
            cols[colNr].push({nextModel:true, model, expanded:true})

            // The nodes in the library
            if (model.raw.root.nodes) 
                for (const node of model.raw.root.nodes) cols[colNr].push({model, node, expanded:false})
            else 
                cols[colNr].push({model, node: model.raw.root, expanded:false})
        }
    },

    onRemoveLib(e) {

        // get the index of the node clicked
        const iCol  = e.target.parentNode.dataset?.col
        const iNode = e.target.parentNode.dataset?.node

        // get the model in the table
        const entry = this.cols[iCol]?.[iNode]
    
        // check
        if ( ! entry?.nextModel ) return

        // message with file to remove
        this.tx.send('remove file', {model: entry.model})
    },
    
    addLib(e) {
    
        const pos = {x:e.screenX, y:e.screenY}
        this.tx.send('get path',  { title:'add file to node library', 
                                    path:null, 
                                    pos,
                                    ok:(userPath) => {
                                        this.tx.send('add file',userPath)
                                    },
                                    cancel:null
                                })
    },

    onSelect(e, box){

        // hide the modal box
        box.hide()
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col
        const iNode = e.target.parentNode.dataset?.node
        const iSub = e.target.parentNode.dataset?.sub
    
        // get the model
        const model = this.cols[iCol][iNode].model

        // by default the groupName is empty
        let groupName = ''
    
        // get the node in the col
        let rawNode = this.cols[iCol][iNode].node
    
        // if a subnode was selected, get it and save the groupNode
        if (iSub) {
            groupName = rawNode.group
            rawNode = rawNode.nodes.find( (sub,i) => i==iSub)
        }
    
        // check
        if (!rawNode) return

        // the name of the selected node
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock

        // make the full node name
        const nodePath = groupName.length == 0 ? nodeName : groupName + '|' + nodeName
    
        // return the selected node to the 
        this.tx.send("selected node",{model, nodePath, xyLocal:this.xyLocal})
    },
    
    onArrowClick(e) {
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col
        const iNode = e.target.parentNode.dataset?.node
    
        // toggle the expanded boolean...
        this.cols[iCol][iNode].expanded = !this.cols[iCol][iNode].expanded
    }

}
