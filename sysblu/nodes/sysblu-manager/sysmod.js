import {cloneSystemDocument} from './system-document.js'

function systemNode(document, id) {
    const node = document?.nodes?.find(candidate => candidate.id === id)
    if (!node) throw new Error(`Unknown system node: ${id ?? '<missing>'}.`)
    return node
}

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : value
}

function cleanReferences(references) {
    if (!Array.isArray(references)) return references
    return references.map(reference => {
        const next = {
            ...reference,
            kind: cleanText(reference?.kind),
            label: cleanText(reference?.label),
            target: cleanText(reference?.target),
        }
        const command = cleanText(reference?.command)
        const workingDirectory = cleanText(reference?.workingDirectory)
        if (command || workingDirectory) {
            next.command = command
            next.workingDirectory = workingDirectory
        }
        else {
            delete next.command
            delete next.workingDirectory
        }
        return next
    })
}

const actions = {
    addApplication(document, {application} = {}) {
        if (!application || typeof application !== 'object' || Array.isArray(application)) {
            throw new Error('Adding an application needs an application object.')
        }
        if (document?.nodes?.some(node => node.id === application.id)) {
            throw new Error(`System node id already exists: ${application.id ?? '<missing>'}.`)
        }
        document.nodes.push(cloneSystemDocument(application))
        return true
    },

    deleteApplication(document, {id} = {}) {
        const index = document?.nodes?.findIndex(candidate => candidate.id === id) ?? -1
        if (index < 0) throw new Error(`Cannot delete unknown system node: ${id ?? '<missing>'}.`)
        if (document.nodes[index].kind !== 'application') throw new Error(`System node ${id} is not an application.`)

        document.nodes.splice(index, 1)
        document.connections = document.connections.filter(connection => connection.from?.node !== id && connection.to?.node !== id)
        return true
    },

    moveNode(document, {id, position} = {}) {
        const node = document?.nodes?.find(candidate => candidate.id === id)
        if (!node) throw new Error(`Cannot move unknown system node: ${id ?? '<missing>'}.`)
        if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
            throw new Error('A node move needs a finite x and y position.')
        }
        if (node.position?.x === position.x && node.position?.y === position.y) return false
        node.position = {x: position.x, y: position.y}
        return true
    },

    editApplication(document, {id, name, role, vmblu, references} = {}) {
        const node = systemNode(document, id)
        if (node.kind !== 'application') throw new Error(`System node ${id} is not an application.`)

        const next = {
            name: typeof name === 'string' ? name.trim() : name,
            vmblu,
            references: cleanReferences(references),
        }
        const description = typeof role === 'string' ? role.trim() : role
        const before = JSON.stringify(node)

        node.name = next.name
        node.vmblu = next.vmblu
        node.references = next.references
        if (description) node.description = description
        else delete node.description

        return JSON.stringify(node) !== before
    },

    addEndpoint(document, {nodeId, endpoint} = {}) {
        const node = systemNode(document, nodeId)
        if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
            throw new Error('Adding an endpoint needs an endpoint object.')
        }
        node.endpoints ??= []
        if (node.endpoints.some(candidate => candidate.id === endpoint.id)) {
            throw new Error(`Endpoint id already exists on ${nodeId}: ${endpoint.id ?? '<missing>'}.`)
        }
        const replacement = {
            ...endpoint,
            name: cleanText(endpoint.name),
        }
        if (cleanText(endpoint.protocol)) replacement.protocol = cleanText(endpoint.protocol)
        else delete replacement.protocol
        if (cleanText(endpoint.remarks)) replacement.remarks = cleanText(endpoint.remarks)
        else delete replacement.remarks
        delete replacement.description
        delete replacement.direction
        delete replacement.transport
        delete replacement.references
        node.endpoints.push(cloneSystemDocument(replacement))
        return true
    },

    editEndpoint(document, {nodeId, id, endpoint} = {}) {
        const node = systemNode(document, nodeId)
        const index = node.endpoints?.findIndex(candidate => candidate.id === id) ?? -1
        if (index < 0) throw new Error(`Cannot edit unknown endpoint ${id ?? '<missing>'} on ${nodeId}.`)
        if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
            throw new Error('Editing an endpoint needs an endpoint object.')
        }

        const current = node.endpoints[index]
        const replacement = {
            ...current,
            ...cloneSystemDocument(endpoint),
            id,
            name: cleanText(endpoint.name),
        }
        if (cleanText(endpoint.protocol)) replacement.protocol = cleanText(endpoint.protocol)
        else delete replacement.protocol
        delete replacement.direction
        delete replacement.transport
        delete replacement.references
        if (cleanText(endpoint.remarks)) replacement.remarks = cleanText(endpoint.remarks)
        else delete replacement.remarks
        delete replacement.description

        if (JSON.stringify(current) === JSON.stringify(replacement)) return false
        node.endpoints[index] = replacement
        return true
    },

    deleteEndpoint(document, {nodeId, id} = {}) {
        const node = systemNode(document, nodeId)
        const index = node.endpoints?.findIndex(candidate => candidate.id === id) ?? -1
        if (index < 0) throw new Error(`Cannot delete unknown endpoint ${id ?? '<missing>'} on ${nodeId}.`)
        node.endpoints.splice(index, 1)
        document.connections = document.connections.filter(connection => !(
            connection.from?.node === nodeId && connection.from?.endpoint === id
        ) && !(
            connection.to?.node === nodeId && connection.to?.endpoint === id
        ))
        return true
    },

    addConnection(document, {connection} = {}) {
        if (!connection || typeof connection !== 'object' || Array.isArray(connection)) {
            throw new Error('Adding a connection needs a connection object.')
        }
        if (document.connections.some(candidate => candidate.id === connection.id)) {
            throw new Error(`Connection id already exists: ${connection.id ?? '<missing>'}.`)
        }
        const replacement = {
            ...connection,
            transport: cleanText(connection.transport),
        }
        if (cleanText(connection.remarks)) replacement.remarks = cleanText(connection.remarks)
        else delete replacement.remarks
        delete replacement.name
        delete replacement.description
        delete replacement.flow
        delete replacement.direction
        delete replacement.protocol
        document.connections.push(cloneSystemDocument(replacement))
        return true
    },

    editConnection(document, {id, remarks, transport} = {}) {
        const connection = document.connections.find(candidate => candidate.id === id)
        if (!connection) throw new Error(`Cannot edit unknown connection: ${id ?? '<missing>'}.`)
        const before = JSON.stringify(connection)

        if (cleanText(remarks)) connection.remarks = cleanText(remarks)
        else delete connection.remarks
        connection.transport = cleanText(transport)
        delete connection.name
        delete connection.description
        delete connection.flow
        delete connection.direction
        delete connection.protocol

        return JSON.stringify(connection) !== before
    },

    deleteConnection(document, {id} = {}) {
        const index = document.connections.findIndex(candidate => candidate.id === id)
        if (index < 0) throw new Error(`Cannot delete unknown connection: ${id ?? '<missing>'}.`)
        document.connections.splice(index, 1)
        return true
    },
}

export class Sysmod {
    constructor(manager, {limit = 31} = {}) {
        this.manager = manager
        this.limit = limit
        this.history = []
        this.cursor = 0
        this.cleanDocument = null
    }

    reset() {
        this.history.length = 0
        this.cursor = 0
        this.markClean()
    }

    markClean() {
        this.cleanDocument = JSON.stringify(this.manager.document)
    }

    isDirty() {
        return JSON.stringify(this.manager.document) !== this.cleanDocument
    }

    status(verb = '') {
        return {
            verb,
            undo: this.cursor > 0,
            redo: this.cursor < this.history.length,
            dirty: this.isDirty(),
        }
    }

    updateHeader(properties) {
        const apply = document => {
            if (document?.header) Object.assign(document.header, properties)
        }
        apply(this.manager.document)
        for (const edit of this.history) {
            apply(edit.before)
            apply(edit.after)
        }
    }

    doit(verb, param) {
        const action = actions[verb]
        if (!action) throw new Error(`Unknown sysmod action: ${verb ?? '<missing>'}.`)
        if (!this.manager.document) throw new Error('There is no active system document.')

        const before = cloneSystemDocument(this.manager.document)
        const candidate = cloneSystemDocument(this.manager.document)
        const changed = action(candidate, param)
        if (!changed) return {...this.status(verb), changed: false}

        const validation = this.manager.validate(candidate)
        if (!validation.ok) throw new Error(validation.errors.join(' '))

        this.manager.document = candidate
        const after = cloneSystemDocument(candidate)
        this.history.splice(this.cursor)
        this.history.push({verb, before, after})
        if (this.history.length > this.limit) this.history.shift()
        this.cursor = this.history.length

        return {...this.status(verb), changed: true}
    }

    undo() {
        if (this.cursor === 0) return {...this.status('undo'), changed: false}
        const edit = this.history[--this.cursor]
        this.manager.document = cloneSystemDocument(edit.before)
        return {...this.status(edit.verb), changed: true}
    }

    redo() {
        if (this.cursor >= this.history.length) return {...this.status('redo'), changed: false}
        const edit = this.history[this.cursor++]
        this.manager.document = cloneSystemDocument(edit.after)
        return {...this.status(edit.verb), changed: true}
    }
}
