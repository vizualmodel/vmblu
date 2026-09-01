export function deepEqual(left, right) {
    if (Object.is(left, right)) return true
    if (typeof left !== typeof right || left === null || right === null) return false
    if (typeof left !== 'object') return false

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
        return left.every((value, index) => deepEqual(value, right[index]))
    }

    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (!deepEqual(leftKeys, rightKeys)) return false
    return leftKeys.every(key => deepEqual(left[key], right[key]))
}

export function reportValue(value, seen=new WeakSet()) {
    if (value === null || typeof value !== 'object') return value
    if (isElement(value)) return describeElement(value)
    if (seen.has(value)) return '<circular>'
    seen.add(value)

    if (Array.isArray(value)) return value.map(item => reportValue(item, seen))

    const result = {}
    for (const [key, item] of Object.entries(value)) result[key] = reportValue(item, seen)
    return result
}

function isElement(value) {
    return typeof value?.nodeType === 'number' && typeof value?.nodeName === 'string'
}

function describeElement(element) {
    const name = String(element.nodeName ?? 'element').toLowerCase()
    const id = element.id ? `#${element.id}` : ''
    const className = typeof element.className === 'string' && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).join('.')}`
        : ''
    return `<${name}${id}${className}>`
}
