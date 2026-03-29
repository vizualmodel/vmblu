import {View} from '../../types/view/index.js'
import {ModelBlueprint} from '../../types/model/index.js'

// The document is the main item handled by the editor

export function Document(arl=null) {

    // The outer view for this document (contains all the views)
    this.view = new View({x:0,y:0,h:0,w:0})

    // The model
    this.model = arl ? new ModelBlueprint(arl) : null

}
Document.prototype = {}