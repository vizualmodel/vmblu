import {View} from '../../types/view/index.js'
import {ModelBlueprint} from '../../types/model/index.js'

// The document is the main item handled by the editor

export function Document(arl=null) {

    this.kind = 'model'
    this.arl = arl
    this.line = null

    // The outer view for this document (contains all the views)
    this.view = new View({x:0,y:0,h:0,w:0})

    // The model
    this.model = arl ? new ModelBlueprint(arl) : null

}
Document.prototype = {
    getArl() {
        return this.model?.getArl?.() ?? this.arl
    },

    getName() {
        return this.getArl()?.getName?.() ?? ''
    },

    getTabId() {
        const arl = this.getArl()
        return arl?.url?.href ?? arl?.getFullPath?.() ?? arl?.getPath?.() ?? this.getName()
    },

    getTab() {
        const arl = this.getArl()
        return {
            id: this.getTabId(),
            label: this.getName(),
            readOnly: arl?.canWrite?.() === false
        }
    }
}

export function TextDocument(arl=null, line=null) {
    this.kind = 'text'
    this.arl = arl
    this.line = Number.isInteger(line) ? line : null
    this.view = null
    this.model = null
}
TextDocument.prototype = Object.create(Document.prototype)
TextDocument.prototype.constructor = TextDocument

export function SystemDocument(arl=null) {
    this.kind = 'sysblu'
    this.arl = arl
    this.line = null
    this.view = null
    this.model = null
}
SystemDocument.prototype = Object.create(Document.prototype)
SystemDocument.prototype.constructor = SystemDocument
