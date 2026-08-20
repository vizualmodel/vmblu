import {ARL} from '../../../core/types/arl/index.js'

export const defaultGitHubRepository = Object.freeze({
    owner: 'vizualmodel',
    repository: 'vmblu-examples',
    ref: 'main',
    readOnly: true
})

function encodeRepositoryPath(path = '') {
    return path
        .split('/')
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join('/')
}

function sortFolder(folder) {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name))
    folder.files.sort((a, b) => a.name.localeCompare(b.name))
    folder.folders.forEach(sortFolder)
    return folder
}

export function repositoryTree(entries = [], repository = 'repository') {
    const root = {name: repository, path: '', folders: [], files: []}
    const folders = new Map([['', root]])

    const ensureFolder = (folderPath) => {
        const normalized = folderPath.split('/').filter(Boolean).join('/')
        if (folders.has(normalized)) return folders.get(normalized)

        const slash = normalized.lastIndexOf('/')
        const parentPath = slash < 0 ? '' : normalized.slice(0, slash)
        const name = slash < 0 ? normalized : normalized.slice(slash + 1)
        const folder = {name, path: normalized, folders: [], files: []}
        ensureFolder(parentPath).folders.push(folder)
        folders.set(normalized, folder)
        return folder
    }

    for (const entry of entries) {
        if (!entry?.path) continue
        if (entry.type === 'tree') {
            ensureFolder(entry.path)
            continue
        }
        if (entry.type !== 'blob') continue

        const slash = entry.path.lastIndexOf('/')
        const parentPath = slash < 0 ? '' : entry.path.slice(0, slash)
        const name = slash < 0 ? entry.path : entry.path.slice(slash + 1)
        ensureFolder(parentPath).files.push({name, path: entry.path, size: entry.size ?? null})
    }

    return sortFolder(root)
}

export class GitHubRepositoryProvider {
    constructor(config = {}, dependencies = {}) {
        this.config = {...defaultGitHubRepository, ...config}
        this.fetch = dependencies.fetch ?? globalThis.fetch?.bind(globalThis)
        this.storage = dependencies.storage ?? globalThis.sessionStorage ?? null

        if (!this.config.owner || !this.config.repository || !this.config.ref) {
            throw new Error('GitHub repository configuration requires owner, repository, and ref')
        }
        if (!this.fetch) throw new Error('GitHub repository provider requires fetch')
    }

    get cacheKey() {
        const {owner, repository, ref} = this.config
        return `vmblu:github-tree:${owner}/${repository}@${ref}`
    }

    get apiUrl() {
        const {owner, repository, ref} = this.config
        return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    }

    get rawBaseUrl() {
        const {owner, repository, ref} = this.config
        return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(ref)}/`
    }

    readCache() {
        try {
            const cached = this.storage?.getItem(this.cacheKey)
            if (!cached) return null
            const parsed = JSON.parse(cached)
            return Array.isArray(parsed?.tree) && parsed.truncated !== true ? parsed : null
        } catch {
            return null
        }
    }

    writeCache(rawTree) {
        try {
            this.storage?.setItem(this.cacheKey, JSON.stringify(rawTree))
        } catch {
            // Storage can be unavailable or full; the mounted repository still works.
        }
    }

    async getTree() {
        let rawTree = this.readCache()

        if (!rawTree) {
            const response = await this.fetch(this.apiUrl, {
                headers: {Accept: 'application/vnd.github+json'}
            })
            if (!response.ok) {
                const remaining = response.headers?.get?.('x-ratelimit-remaining')
                const suffix = remaining === '0' ? ' (GitHub API rate limit reached)' : ''
                throw new Error(`GitHub repository tree request failed with HTTP ${response.status}${suffix}`)
            }
            rawTree = await response.json()
            if (rawTree.truncated) throw new Error('GitHub repository tree is truncated')
            if (!Array.isArray(rawTree.tree)) throw new Error('GitHub repository tree response is invalid')
            this.writeCache(rawTree)
        }

        return repositoryTree(rawTree.tree, this.config.repository)
    }

    createArl(path = '') {
        const repositoryPath = path.split('/').filter(Boolean).join('/')
        const logicalPath = `/${this.config.repository}${repositoryPath ? `/${repositoryPath}` : ''}`
        const rawUrl = new URL(encodeRepositoryPath(repositoryPath), this.rawBaseUrl)
        const arl = new ARL(logicalPath)
        arl.url = rawUrl
        // Public browser mounts never carry GitHub credentials and are always
        // read-only, even if a caller supplies a contradictory configuration.
        arl.setReadOnly()
        return arl
    }
}
