<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import Button from '../../fragments/button.svelte'
import {AGENT_SCHEMA, makeDefaultAgentSettings} from './agent-settings-model.js'

export let tx

const ID_PATTERN = /^[A-Za-z0-9_.-]+$/
const permissionKinds = ['tools', 'events', 'probes']
const interfaceKinds = [
    {value: 'embedded', label: 'Embedded'},
    {value: 'http-projection', label: 'HTTP projection'},
    {value: 'mcp-stdio', label: 'MCP stdio'},
    {value: 'mcp-http', label: 'MCP HTTP'},
]
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])

const box = {
    div: null,
    pos: null,
    title: 'Agents',
    ok: null,
    cancel: null,
}

let config = makeConfig(null).config
let capabilities = {tools: [], probes: [], events: []}
let mode = 'profiles'
let selectedProfileId = ''
let selectedInterfaceId = ''
let permissionKind = 'tools'
let search = ''
let error = ''

onMount(() => {
    tx.send('modal div', box.div)
})

export function show({settings, capabilities: nextCapabilities, pos, ok, cancel}) {
    capabilities = normalizeCapabilities(nextCapabilities)
    const normalized = makeConfig(settings)
    config = normalized.config
    selectedProfileId = config.profiles[0]?.id ?? ''
    selectedInterfaceId = config.interfaces[0]?.id ?? ''
    mode = 'profiles'
    permissionKind = 'tools'
    search = ''
    error = ''

    box.title = 'Agents'
    box.pos = {...pos}
    box.ok = () => {
        const next = collectConfig()
        if (!next) {
            box.show(box.pos)
            return
        }
        ok?.(next)
    }
    box.cancel = () => cancel?.()
    box.show(box.pos)
}

export const handlers = {
    '-> show': show,
}

$: selectedProfile = config.profiles.find(profile => profile.id === selectedProfileId) ?? config.profiles[0]
$: selectedInterface = config.interfaces.find(item => item.id === selectedInterfaceId) ?? config.interfaces[0]
$: visibleCapabilities = capabilityRows(permissionKind, search)

function makeConfig(settings) {
    if (settings?.profiles && Array.isArray(settings.profiles)) {
        return {config: normalizeCanonicalConfig(settings)}
    }

    if (settings?.agents && Array.isArray(settings.agents)) {
        return {config: migrateLegacyAgents(settings.agents, settings.defaultAgent, settings.enabled !== false)}
    }

    if (settings?.id || settings?.permissions || settings?.llm) {
        return {config: migrateLegacyAgents([settings], settings.id, settings.enabled !== false)}
    }

    return {config: makeDefaultAgentSettings(settings?.enabled === true)}
}

function normalizeCanonicalConfig(value) {
    const profiles = value.profiles.length
        ? value.profiles.map(normalizeProfile)
        : [makeProfile('assistant')]
    const interfaces = Array.isArray(value.interfaces)
        ? value.interfaces.map(item => normalizeInterface(item, profiles[0].id))
        : []
    return {
        schema: AGENT_SCHEMA,
        version: 1,
        enabled: value.enabled !== false,
        defaultInterface: value.defaultInterface ?? interfaces[0]?.id ?? '',
        profiles,
        interfaces,
    }
}

function migrateLegacyAgents(agents, defaultAgent, enabled = true) {
    const profiles = agents.map(normalizeProfile)
    const interfaces = agents.map(agent => {
        const type = agent?.type ?? inferLegacyType(agent)
        const kind = type === 'http'
            ? 'http-projection'
            : type === 'mcp' && agent?.transport?.mode === 'stdio'
                ? 'mcp-stdio'
                : type === 'mcp'
                    ? 'mcp-http'
                    : 'embedded'
        return normalizeInterface({
            id: `${agent.id || 'agent'}-${kind === 'embedded' ? 'embedded' : 'projection'}`,
            title: agent.title,
            enabled: agent.enabled,
            kind,
            profile: agent.id,
            instructions: agent.instructions,
            llm: agent.llm,
            ui: agent.ui,
            server: agent.server,
            authentication: agent.authentication,
        }, agent.id)
    })
    const defaultProfile = profiles.find(profile => profile.id === defaultAgent) ?? profiles[0]
    const defaultInterface = interfaces.find(item => item.profile === defaultProfile?.id)?.id ?? interfaces[0]?.id ?? ''

    return {
        schema: AGENT_SCHEMA,
        version: 1,
        enabled,
        defaultInterface,
        profiles,
        interfaces,
    }
}

function makeProfile(id) {
    return {
        id,
        title: titleFromId(id),
        enabled: true,
        permissions: {
            tools: {allow: []},
            events: {allow: []},
            probes: {allow: []},
        },
        limits: {maxToolCallsPerTurn: 10},
    }
}

function normalizeProfile(profile) {
    const id = String(profile?.id || 'profile').trim() || 'profile'
    return {
        id,
        title: profile?.title ?? titleFromId(id),
        enabled: profile?.enabled !== false,
        permissions: {
            tools: normalizePermission(profile?.permissions?.tools),
            events: normalizePermission(profile?.permissions?.events),
            probes: normalizePermission(profile?.permissions?.probes),
        },
        limits: {
            maxToolCallsPerTurn: profile?.limits?.maxToolCallsPerTurn ?? 10,
        },
    }
}

function normalizePermission(permission) {
    return {
        allow: Array.isArray(permission?.allow) ? [...new Set(permission.allow.filter(Boolean))] : [],
        deny: Array.isArray(permission?.deny) ? [...new Set(permission.deny.filter(Boolean))] : [],
    }
}

function makeEmbeddedInterface(id, profile) {
    return normalizeInterface({
        id,
        title: titleFromId(id),
        enabled: true,
        kind: 'embedded',
        profile,
    }, profile)
}

function normalizeInterface(item, fallbackProfile) {
    const id = String(item?.id || 'interface').trim() || 'interface'
    return {
        id,
        title: item?.title ?? titleFromId(id),
        enabled: item?.enabled !== false,
        kind: item?.kind ?? 'embedded',
        profile: item?.profile ?? fallbackProfile,
        instructions: item?.instructions ?? 'Operate the application through published tools.',
        llm: {
            provider: item?.llm?.provider ?? 'openai',
            model: item?.llm?.model ?? 'gpt-4.1-mini',
            endpoint: item?.llm?.endpoint ?? 'http://127.0.0.1:8080/v1',
        },
        ui: {
            mode: item?.ui?.mode ?? 'overlay',
        },
        server: {
            host: item?.server?.host ?? '127.0.0.1',
            port: item?.server?.port ?? 8787,
            basePath: item?.server?.basePath ?? '/agent',
            path: item?.server?.path ?? '/mcp',
        },
        authentication: {
            mode: item?.authentication?.mode ?? 'oauth',
            issuer: item?.authentication?.issuer ?? '',
            resourceServerUrl: item?.authentication?.resourceServerUrl ?? '',
            requiredScopes: Array.isArray(item?.authentication?.requiredScopes)
                ? item.authentication.requiredScopes.join(' ')
                : (item?.authentication?.requiredScopes ?? 'mcp'),
        },
    }
}

function inferLegacyType(agent) {
    if (agent?.server) return 'http'
    return 'overlay'
}

function normalizeCapabilities(value) {
    return {
        tools: Array.isArray(value?.tools) ? value.tools.filter(item => item?.id) : [],
        probes: Array.isArray(value?.probes) ? value.probes.filter(item => item?.id) : [],
        events: Array.isArray(value?.events) ? value.events.filter(item => item?.id) : [],
    }
}

function collectConfig() {
    error = ''
    if (!config.profiles.length) {
        error = 'at least one profile is required'
        return null
    }

    const profileIds = validateIds(config.profiles, 'profile')
    if (!profileIds) return null
    const interfaceIds = validateIds(config.interfaces, 'interface')
    if (!interfaceIds) return null

    for (const profile of config.profiles) {
        const maxCalls = Number(profile.limits.maxToolCallsPerTurn)
        if (!Number.isInteger(maxCalls) || maxCalls < 1) {
            error = `maximum tool calls must be a positive integer for profile ${profile.id}`
            return null
        }
        profile.limits.maxToolCallsPerTurn = maxCalls

        for (const kind of permissionKinds) {
            const known = new Set(capabilities[kind].map(item => item.id))
            const invalid = [...(profile.permissions[kind].allow ?? []), ...(profile.permissions[kind].deny ?? [])]
                .filter(id => id !== '*' && !known.has(id))
            if (invalid.length) {
                error = `profile ${profile.id} references unknown ${kind}: ${invalid.join(', ')}`
                return null
            }
        }
    }

    for (const item of config.interfaces) {
        if (!profileIds.has(item.profile)) {
            error = `interface ${item.id} references unknown profile: ${item.profile}`
            return null
        }
        if (!interfaceKinds.some(option => option.value === item.kind)) {
            error = `unsupported interface kind: ${item.kind}`
            return null
        }
        if (item.kind === 'http-projection' || item.kind === 'mcp-http') {
            const port = Number(item.server.port)
            if (!Number.isInteger(port) || port < 1 || port > 65535) {
                error = `invalid HTTP port for interface ${item.id}`
                return null
            }
        }
        if (item.kind === 'mcp-http') {
            if (!String(item.server.path ?? '').startsWith('/')) {
                error = `MCP path must start with / for interface ${item.id}`
                return null
            }
            if (item.authentication.mode === 'loopback' && !loopbackHosts.has(item.server.host)) {
                error = `unauthenticated MCP must use a loopback host for interface ${item.id}`
                return null
            }
            if (item.authentication.mode === 'oauth') {
                if (!isHttpUrl(item.authentication.issuer) || !isHttpUrl(item.authentication.resourceServerUrl)) {
                    error = `OAuth issuer and resource server must be HTTP URLs for interface ${item.id}`
                    return null
                }
                if (!scopeList(item.authentication.requiredScopes).length) {
                    error = `at least one OAuth scope is required for interface ${item.id}`
                    return null
                }
            }
        }
    }

    if (config.interfaces.length && !interfaceIds.has(config.defaultInterface)) {
        error = 'default interface must reference an existing interface'
        return null
    }
    if (!config.interfaces.length) config.defaultInterface = ''

    return canonicalConfigForSave(config)
}

function canonicalConfigForSave(value) {
    return {
        schema: AGENT_SCHEMA,
        version: 1,
        enabled: value.enabled !== false,
        defaultInterface: value.defaultInterface,
        profiles: value.profiles.map(profile => ({
            id: profile.id,
            title: profile.title,
            enabled: profile.enabled,
            permissions: Object.fromEntries(permissionKinds.map(kind => [kind, canonicalPermission(profile.permissions[kind], kind)])),
            limits: {maxToolCallsPerTurn: Number(profile.limits.maxToolCallsPerTurn)},
        })),
        interfaces: value.interfaces.map(item => {
            const common = {
                id: item.id,
                title: item.title,
                enabled: item.enabled,
                kind: item.kind,
                profile: item.profile,
            }
            if (item.kind === 'embedded') {
                return {
                    ...common,
                    instructions: item.instructions,
                    llm: JSON.parse(JSON.stringify(item.llm)),
                    ui: JSON.parse(JSON.stringify(item.ui)),
                }
            }
            if (item.kind === 'mcp-stdio') return common
            if (item.kind === 'mcp-http') {
                const authentication = item.authentication.mode === 'loopback'
                    ? {mode: 'loopback'}
                    : {
                        mode: 'oauth',
                        issuer: item.authentication.issuer.trim(),
                        resourceServerUrl: item.authentication.resourceServerUrl.trim(),
                        requiredScopes: scopeList(item.authentication.requiredScopes),
                    }
                return {
                    ...common,
                    server: {
                        host: item.server.host,
                        port: Number(item.server.port),
                        path: item.server.path,
                    },
                    authentication,
                }
            }
            return {
                ...common,
                server: {
                    host: item.server.host,
                    port: Number(item.server.port),
                    basePath: item.server.basePath,
                },
            }
        }),
    }
}

function canonicalPermission(permission, kind) {
    const known = capabilities[kind].map(item => item.id)
    const denied = new Set(permission?.deny ?? [])
    const allowed = permission?.allow?.includes('*') ? known : (permission?.allow ?? [])
    return {allow: [...new Set(allowed.filter(id => id !== '*' && !denied.has('*') && !denied.has(id)))]}
}

function scopeList(value) {
    return [...new Set(String(value ?? '').split(/[\s,]+/).map(scope => scope.trim()).filter(Boolean))]
}

function isHttpUrl(value) {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
        return false
    }
}

function validateIds(items, label) {
    const ids = new Set()
    for (const item of items) {
        item.id = String(item.id ?? '').trim()
        if (!item.id) {
            error = `${label} id is required`
            return null
        }
        if (!ID_PATTERN.test(item.id)) {
            error = `${label} id may contain only letters, digits, dot, dash, and underscore: ${item.id}`
            return null
        }
        if (ids.has(item.id)) {
            error = `duplicate ${label} id: ${item.id}`
            return null
        }
        ids.add(item.id)
    }
    return ids
}

function addProfile() {
    const id = uniqueId('profile', config.profiles)
    config.profiles = [...config.profiles, makeProfile(id)]
    selectedProfileId = id
}

function duplicateProfile() {
    if (!selectedProfile) return
    const id = uniqueId(`${selectedProfile.id}-copy`, config.profiles)
    const clone = JSON.parse(JSON.stringify(selectedProfile))
    clone.id = id
    clone.title = `${selectedProfile.title || selectedProfile.id} copy`
    config.profiles = [...config.profiles, clone]
    selectedProfileId = id
}

function removeProfile() {
    if (!selectedProfile || config.profiles.length <= 1) return
    if (config.interfaces.some(item => item.profile === selectedProfile.id)) {
        error = `profile ${selectedProfile.id} is used by an interface`
        return
    }
    const index = config.profiles.indexOf(selectedProfile)
    config.profiles = config.profiles.filter(profile => profile !== selectedProfile)
    selectedProfileId = config.profiles[Math.max(0, index - 1)]?.id ?? ''
}

function renameProfile(value) {
    if (!selectedProfile) return
    const oldId = selectedProfile.id
    selectedProfile.id = value
    for (const item of config.interfaces) {
        if (item.profile === oldId) item.profile = value
    }
    selectedProfileId = value
    config = {...config}
}

function addInterface() {
    const id = uniqueId('interface', config.interfaces)
    const profile = selectedProfile?.id ?? config.profiles[0]?.id ?? ''
    config.interfaces = [...config.interfaces, makeEmbeddedInterface(id, profile)]
    if (!config.defaultInterface) config.defaultInterface = id
    selectedInterfaceId = id
}

function duplicateInterface() {
    if (!selectedInterface) return
    const id = uniqueId(`${selectedInterface.id}-copy`, config.interfaces)
    const clone = JSON.parse(JSON.stringify(selectedInterface))
    clone.id = id
    clone.title = `${selectedInterface.title || selectedInterface.id} copy`
    config.interfaces = [...config.interfaces, clone]
    selectedInterfaceId = id
}

function removeInterface() {
    if (!selectedInterface) return
    const index = config.interfaces.indexOf(selectedInterface)
    config.interfaces = config.interfaces.filter(item => item !== selectedInterface)
    selectedInterfaceId = config.interfaces[Math.max(0, index - 1)]?.id ?? ''
    if (config.defaultInterface === selectedInterface.id) config.defaultInterface = selectedInterfaceId
}

function renameInterface(value) {
    if (!selectedInterface) return
    const oldId = selectedInterface.id
    selectedInterface.id = value
    if (config.defaultInterface === oldId) config.defaultInterface = value
    selectedInterfaceId = value
    config = {...config}
}

function uniqueId(base, items) {
    const used = new Set(items.map(item => item.id))
    let index = 1
    let id = base
    while (used.has(id)) id = `${base}${++index}`
    return id
}

function capabilityRows(kind, query) {
    if (!selectedProfile) return []
    const known = capabilities[kind]
    const knownIds = new Set(known.map(item => item.id))
    const referenced = [
        ...(selectedProfile.permissions[kind].allow ?? []),
        ...(selectedProfile.permissions[kind].deny ?? []),
    ]
    const missing = [...new Set(referenced)]
        .filter(id => id !== '*' && !knownIds.has(id))
        .map(id => ({id, title: 'Missing capability', missing: true}))
    const needle = String(query ?? '').trim().toLowerCase()
    return [...known, ...missing].filter(item => {
        if (!needle) return true
        return `${item.title ?? ''} ${item.id}`.toLowerCase().includes(needle)
    })
}

function isAllowed(profile, kind, id) {
    const allow = profile?.permissions?.[kind]?.allow ?? []
    const deny = profile?.permissions?.[kind]?.deny ?? []
    return !deny.includes('*') && !deny.includes(id) && (allow.includes('*') || allow.includes(id))
}

function setAllowed(kind, id, checked) {
    if (!selectedProfile) return
    const permission = selectedProfile.permissions[kind]
    const knownIds = capabilities[kind].map(item => item.id)
    const allow = permission.allow.includes('*')
        ? new Set(knownIds)
        : new Set(permission.allow)
    if (checked) allow.add(id)
    else allow.delete(id)
    updatePermission(kind, [...allow])
}

function allowAll(kind) {
    if (!selectedProfile) return
    updatePermission(kind, capabilities[kind].map(item => item.id))
}

function clearAllowed(kind) {
    if (!selectedProfile) return
    updatePermission(kind, [])
}

function updatePermission(kind, allow) {
    const profileId = selectedProfile.id
    config = {
        ...config,
        profiles: config.profiles.map(profile => profile.id !== profileId ? profile : {
            ...profile,
            permissions: {
                ...profile.permissions,
                [kind]: {allow, deny: []},
            },
        }),
    }
}

function allowedCount(profile, kind) {
    const allow = profile?.permissions?.[kind]?.allow ?? []
    const deny = new Set(profile?.permissions?.[kind]?.deny ?? [])
    if (deny.has('*')) return 0
    if (allow.includes('*')) return capabilities[kind].filter(item => !deny.has(item.id)).length
    return allow.filter(id => !deny.has(id)).length
}

function titleFromId(id) {
    return String(id ?? '')
        .replace(/[-_.]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
}
</script>

<style>
.settings {
    display: grid;
    grid-template-columns: 13rem minmax(32rem, 48rem);
    gap: 0.8rem;
    width: min(88vw, 64rem);
    max-height: 78vh;
    color: #ddd;
    font-family: var(--fBase);
    font-size: 0.78rem;
}

.sidebar,
.editor {
    min-height: 32rem;
    overflow: auto;
}

.sidebar {
    border-right: 1px solid #444;
    padding-right: 0.55rem;
}

.mode-tabs,
.actions,
.permission-tabs,
.permission-actions,
.row {
    display: flex;
    gap: 0.4rem;
}

.mode-tabs {
    margin-bottom: 0.55rem;
}

.actions {
    flex-direction: column;
    margin-top: 0.5rem;
}

.item-row {
    width: 100%;
    text-align: left;
    background: #202020;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 0.2rem;
    margin-bottom: 0.35rem;
    padding: 0.4rem;
    cursor: pointer;
}

.item-row.selected {
    border-color: #e2c64e;
    background: #303030;
}

.item-title {
    font-weight: 700;
}

.counts,
.hint,
.capability-id,
.badge {
    color: #aaa;
    font-size: 0.72rem;
}

.editor {
    display: grid;
    align-content: start;
    gap: 0.55rem;
}

.field {
    display: grid;
    gap: 0.18rem;
}

.field.inline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

.row > .field {
    flex: 1;
}

input,
select,
textarea {
    box-sizing: border-box;
    width: 100%;
    background: #1f1f1f;
    color: #ddd;
    border: 1px solid #555;
    border-radius: 0.15rem;
    padding: 0.25rem 0.35rem;
    font-family: var(--fFixed);
    font-size: 0.76rem;
}

input[type='checkbox'] {
    width: auto;
}

textarea {
    min-height: 4rem;
    resize: vertical;
}

.permission-panel {
    border-top: 1px solid #444;
    padding-top: 0.55rem;
}

.permission-toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    margin: 0.45rem 0;
}

.permission-actions {
    align-items: center;
}

.permission-search {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.permission-search .material-icons-outlined {
    color: #aaa;
    font-size: 1rem;
}

.capability-list {
    max-height: 19rem;
    overflow: auto;
}

.capability-item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.45rem;
    align-items: start;
    padding: 0.28rem 0;
}

.permission-checks {
    display: grid;
    gap: 0.15rem;
    color: #bbb;
    font-size: 0.7rem;
}

.permission-checks label {
    display: flex;
    gap: 0.2rem;
    align-items: center;
}

.capability-item.missing {
    color: #ff7777;
}

.capability-title {
    font-weight: 600;
}

.badge {
    margin-left: 0.35rem;
    color: #e2c64e;
}

.error {
    color: #ff7777;
}
</style>

<PopupBox box={box}>
    <div class="settings">
        <div class="sidebar">
            <div class="mode-tabs">
                <Button label="Profiles" click={() => mode = 'profiles'} active={mode === 'profiles'} />
                <Button label="Interfaces" click={() => mode = 'interfaces'} active={mode === 'interfaces'} />
            </div>

            {#if mode === 'profiles'}
                {#each config.profiles as profile}
                    <button type="button" class="item-row" class:selected={profile.id === selectedProfileId} on:click={() => selectedProfileId = profile.id}>
                        <div class="item-title">{profile.title || profile.id}</div>
                        <div>{profile.id}</div>
                        <div class="counts">
                            {allowedCount(profile, 'tools')} tools,
                            {allowedCount(profile, 'events')} events,
                            {allowedCount(profile, 'probes')} probes
                        </div>
                    </button>
                {/each}
                <div class="actions">
                    <Button label="Add profile" click={addProfile} />
                    <Button label="Duplicate" click={duplicateProfile} disabled={!selectedProfile} />
                    <Button label="Delete" click={removeProfile} disabled={!selectedProfile || config.profiles.length <= 1} />
                </div>
            {:else}
                {#each config.interfaces as item}
                    <button type="button" class="item-row" class:selected={item.id === selectedInterfaceId} on:click={() => selectedInterfaceId = item.id}>
                        <div class="item-title">{item.title || item.id}</div>
                        <div>{item.id}</div>
                        <div class="counts">{item.kind} → {item.profile}</div>
                    </button>
                {/each}
                <div class="actions">
                    <Button label="Add interface" click={addInterface} />
                    <Button label="Duplicate" click={duplicateInterface} disabled={!selectedInterface} />
                    <Button label="Delete" click={removeInterface} disabled={!selectedInterface} />
                </div>
            {/if}
        </div>

        <div class="editor">
            {#if mode === 'profiles' && selectedProfile}
                <label class="field inline">
                    <input type="checkbox" bind:checked={selectedProfile.enabled} />
                    Enabled
                </label>
                <div class="row">
                    <label class="field">
                        ID
                        <input value={selectedProfile.id} on:input={(event) => renameProfile(event.currentTarget.value)} />
                    </label>
                    <label class="field">
                        Title
                        <input bind:value={selectedProfile.title} />
                    </label>
                </div>
                <label class="field">
                    Maximum tool calls per turn
                    <input type="number" min="1" bind:value={selectedProfile.limits.maxToolCallsPerTurn} />
                </label>

                <div class="permission-panel">
                    <div class="permission-tabs">
                        {#each permissionKinds as kind}
                            <Button label={`${titleFromId(kind)} (${allowedCount(selectedProfile, kind)})`} click={() => permissionKind = kind} active={permissionKind === kind} />
                        {/each}
                    </div>
                    <div class="permission-toolbar">
                        <div class="permission-search">
                            <span class="material-icons-outlined" aria-hidden="true">search</span>
                            <input aria-label="Search capabilities" placeholder="Search exposed capabilities" bind:value={search} />
                        </div>
                        <div class="permission-actions">
                            <Button label="Select All" click={() => allowAll(permissionKind)} />
                            <Button label="Clear" click={() => clearAllowed(permissionKind)} />
                        </div>
                    </div>
                    <div class="capability-list">
                        {#each visibleCapabilities as item}
                            <div class="capability-item" class:missing={item.missing}>
                                <span class="permission-checks">
                                    <label title="Allow"><input
                                        type="checkbox"
                                        aria-label={`Allow ${item.title || item.id}`}
                                        checked={isAllowed(selectedProfile, permissionKind, item.id)}
                                        on:change={(event) => setAllowed(permissionKind, item.id, event.currentTarget.checked)}
                                    /></label>
                                </span>
                                <span>
                                    <span class="capability-title">{item.title || item.id}</span>
                                    {#if permissionKind === 'tools'}
                                        <span class="badge">{item.risk || 'low'} risk</span>
                                        {#if item.approval === 'always'}<span class="badge">approval required</span>{/if}
                                    {/if}
                                    {#if item.missing}<span class="badge">missing</span>{/if}
                                    <span class="capability-id"> {item.id}</span>
                                </span>
                            </div>
                        {/each}
                        {#if !visibleCapabilities.length}<div class="hint">No matching exposed capabilities.</div>{/if}
                    </div>
                </div>
            {:else if mode === 'interfaces' && selectedInterface}
                <label class="field inline">
                    <input type="checkbox" bind:checked={selectedInterface.enabled} />
                    Enabled
                </label>
                <div class="row">
                    <label class="field">
                        ID
                        <input value={selectedInterface.id} on:input={(event) => renameInterface(event.currentTarget.value)} />
                    </label>
                    <label class="field">
                        Title
                        <input bind:value={selectedInterface.title} />
                    </label>
                </div>
                <div class="row">
                    <label class="field">
                        Kind
                        <select bind:value={selectedInterface.kind}>
                            {#each interfaceKinds as option}<option value={option.value}>{option.label}</option>{/each}
                        </select>
                    </label>
                    <label class="field">
                        Profile
                        <select bind:value={selectedInterface.profile}>
                            {#each config.profiles as profile}<option value={profile.id}>{profile.title || profile.id}</option>{/each}
                        </select>
                    </label>
                </div>
                <label class="field">
                    Default interface
                    <select bind:value={config.defaultInterface}>
                        {#each config.interfaces as item}<option value={item.id}>{item.title || item.id}</option>{/each}
                    </select>
                </label>

                {#if selectedInterface.kind === 'embedded'}
                    <label class="field">
                        Instructions
                        <textarea bind:value={selectedInterface.instructions}></textarea>
                    </label>
                    <div class="row">
                        <label class="field">
                            Provider
                            <select bind:value={selectedInterface.llm.provider}><option value="openai">OpenAI</option></select>
                        </label>
                        <label class="field">
                            Overlay
                            <select bind:value={selectedInterface.ui.mode}>
                                <option value="overlay">Overlay</option>
                                <option value="none">None</option>
                            </select>
                        </label>
                    </div>
                    <div class="row">
                        <label class="field">
                            Model
                            <input bind:value={selectedInterface.llm.model} />
                        </label>
                        <label class="field">
                            Endpoint
                            <input bind:value={selectedInterface.llm.endpoint} />
                        </label>
                    </div>
                {:else if selectedInterface.kind === 'http-projection'}
                    <div class="hint">This produces configuration for the static HTTP projection; it does not start a server.</div>
                    <div class="row">
                        <label class="field">
                            Host
                            <input bind:value={selectedInterface.server.host} />
                        </label>
                        <label class="field">
                            Port
                            <input type="number" bind:value={selectedInterface.server.port} />
                        </label>
                    </div>
                    <label class="field">
                        Base path
                        <input bind:value={selectedInterface.server.basePath} />
                    </label>
                {:else if selectedInterface.kind === 'mcp-stdio'}
                    <div class="hint">The launching process owns this MCP connection and binds it to the selected profile. OAuth is not used for stdio.</div>
                {:else if selectedInterface.kind === 'mcp-http'}
                    <div class="hint">The host supplies the OAuth token verifier at runtime. Secrets are never stored in the model.</div>
                    <div class="row">
                        <label class="field">
                            Host
                            <input bind:value={selectedInterface.server.host} />
                        </label>
                        <label class="field">
                            Port
                            <input type="number" bind:value={selectedInterface.server.port} />
                        </label>
                    </div>
                    <div class="row">
                        <label class="field">
                            Path
                            <input bind:value={selectedInterface.server.path} />
                        </label>
                        <label class="field">
                            Authentication
                            <select bind:value={selectedInterface.authentication.mode}>
                                <option value="oauth">OAuth</option>
                                <option value="loopback">Loopback development only</option>
                            </select>
                        </label>
                    </div>
                    {#if selectedInterface.authentication.mode === 'oauth'}
                        <label class="field">
                            Authorization server issuer
                            <input placeholder="https://auth.example.com" bind:value={selectedInterface.authentication.issuer} />
                        </label>
                        <label class="field">
                            Resource server URL
                            <input placeholder="https://app.example.com/mcp" bind:value={selectedInterface.authentication.resourceServerUrl} />
                        </label>
                        <label class="field">
                            Required scopes
                            <input placeholder="mcp" bind:value={selectedInterface.authentication.requiredScopes} />
                        </label>
                    {:else}
                        <div class="hint">Loopback mode is intentionally unauthenticated and can bind only to localhost.</div>
                    {/if}
                {/if}
            {:else}
                <div class="hint">Add an interface to connect an agent to a profile.</div>
            {/if}

            {#if error}<div class="error">{error}</div>{/if}
        </div>
    </div>
</PopupBox>
