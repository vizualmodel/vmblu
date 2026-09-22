import {Path} from '../arl/index.js'
import {convert} from '../util/convert.js'

export function defaultNodeTestPath(node) {
    const filename = `${convert.nodeToFilename(node.name) || 'node'}.md`
    const model = node.model
    const ref = model?.getArl?.()
    const entry = model?.entrypoint?.arl
    if (entry && ref) return Path.relative(entry.resolve(`./tests/nodes/${filename}`).getFullPath(), ref.getFullPath())
    const prefix = /\/model\/[^/]+$/.test(ref?.getFullPath?.()?.replace(/\\/g, '/') ?? '') ? '../' : './'
    return `${prefix}tests/nodes/${filename}`
}

export async function ensureNodeTestFile(node, path) {
    if (node.link || node.testRepo?.readOnly) {
        if (!node.testRepo?.arl) throw new Error('This linked node has no test specification.')
        return node.testRepo.arl
    }
    const ref = node.model?.getArl?.()
    if (!ref) throw new Error('Save the model before creating a test specification.')
    const value = String(path ?? '').trim()
    if (!value) throw new Error('Enter a test specification path.')
    const arl = ref.resolve(value)
    // The shared Markdown file adapter creates only when absent and protects
    // existing content, including unsaved editors, in both editor hosts.
    if (!arl.createPromptFile) throw new Error('This location does not support creating test specifications.')
    await arl.createPromptFile(`# ${node.name} — test specification\n\n`)
    return arl
}
