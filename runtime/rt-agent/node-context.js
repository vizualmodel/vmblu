let currentNode = null
const suppressed = new Set()

export function runAsNode(nodeName, fn) {
    const previousNode = currentNode
    currentNode = nodeName

    try {
        const result = fn()

        if (result?.then) {
            return result.finally(() => {
                currentNode = previousNode
            })
        }

        currentNode = previousNode
        return result
    }
    catch (err) {
        currentNode = previousNode
        throw err
    }
}

export function getCurrentNode() {
    return currentNode
}

export function suppressCapability(capability, fn) {
    suppressed.add(capability)

    try {
        const result = fn()

        if (result?.then) {
            return result.finally(() => {
                suppressed.delete(capability)
            })
        }

        suppressed.delete(capability)
        return result
    }
    catch (err) {
        suppressed.delete(capability)
        throw err
    }
}

export function isCapabilitySuppressed(capability) {
    return suppressed.has(capability)
}
