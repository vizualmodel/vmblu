<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import Button from '../../fragments/button.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import LabelTextInput from '../../fragments/label-text-input.svelte'

export let tx

const box = {
    div: null,
    pos: null,
    title: 'Agent Settings',
    ok: null,
    cancel: null,
}

let config = makeAgentConfig(null)
let capabilities = {tools: [], probes: [], events: []}
let selectedId = ''
let error = ''

const providerOptions = ['openai']
const typeOptions = ['overlay', 'http', 'mcp', 'openai', 'claude', 'langchain']
const overlayOptions = ['overlay', 'none']
const transportModeOptions = ['stdio', 'http']

onMount(() => {
    tx.send('modal div', box.div)
})

export function show({settings, capabilities: nextCapabilities, pos, ok, cancel}) {
    capabilities = normalizeCapabilities(nextCapabilities)
    config = makeAgentConfig(settings, capabilities)
    selectedId = config.defaultAgent || config.agents[0]?.id || ''
    error = ''
    box.title = 'Agent Settings'
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
    "-> show": show,
}

$: selectedAgent = config.agents.find(agent => agent.id === selectedId) ?? config.agents[0]
$: allowedCounts = countAllowed(selectedAgent)

function makeAgentConfig(settings, caps = {tools: [], probes: [], events: []}) {
    if (settings?.agents && Array.isArray(settings.agents)) {
        const clone = JSON.parse(JSON.stringify(settings))
        clone.agents = clone.agents.length ? clone.agents.map(agent => normalizeAgent(agent, caps)) : [makeAgent('operator', caps)]
        clone.defaultAgent = clone.defaultAgent || clone.agents[0]?.id || 'operator'
        clone.version = clone.version ?? 1
        return clone
    }

    if (settings?.id || settings?.llm || settings?.permissions) {
        const agent = normalizeAgent(settings, caps)
        return {
            schema: 'https://vmblu.dev/schemas/agents.v1.json',
            version: 1,
            defaultAgent: agent.id,
            agents: [agent],
        }
    }

    return {
        schema: 'https://vmblu.dev/schemas/agents.v1.json',
        version: 1,
        defaultAgent: 'operator',
        agents: [makeAgent('operator', caps)],
    }
}

function makeAgent(id, caps) {
    return normalizeAgent({
        id,
        title: titleFromId(id),
        type: 'overlay',
        enabled: true,
        instructions: 'Operate the application through published tools.',
        llm: {provider: 'openai', model: 'gpt-4.1-mini', endpoint: 'http://127.0.0.1:8080/v1'},
        ui: {mode: 'overlay'},
        server: {host: '127.0.0.1', port: 8787, basePath: '/agent'},
        transport: {mode: 'stdio'},
        permissions: {
            tools: {allow: caps.tools.map(item => item.id), deny: []},
            probes: {allow: caps.probes.map(item => item.id), deny: []},
            events: {allow: caps.events.map(item => item.id), deny: []},
        },
    }, caps)
}

function normalizeAgent(agent, caps) {
    const id = String(agent?.id || 'agent').trim() || 'agent'
    return {
        id,
        type: agent?.type ?? inferAgentType(agent),
        title: agent?.title ?? titleFromId(id),
        enabled: agent?.enabled !== false,
        instructions: agent?.instructions ?? '',
        llm: {
            provider: agent?.llm?.provider ?? 'openai',
            model: agent?.llm?.model ?? 'gpt-4.1-mini',
            endpoint: agent?.llm?.endpoint ?? 'http://127.0.0.1:8080/v1',
        },
        ui: {
            mode: agent?.ui?.mode ?? 'overlay',
        },
        server: {
            host: agent?.server?.host ?? '127.0.0.1',
            port: agent?.server?.port ?? 8787,
            basePath: agent?.server?.basePath ?? '/agent',
        },
        transport: {
            mode: agent?.transport?.mode ?? 'stdio',
        },
        permissions: {
            tools: normalizePermission(agent?.permissions?.tools, caps.tools),
            probes: normalizePermission(agent?.permissions?.probes, caps.probes),
            events: normalizePermission(agent?.permissions?.events, caps.events),
        },
    }
}

function inferAgentType(agent) {
    if (agent?.transport?.mode) return 'mcp'
    if (agent?.server) return 'http'
    return 'overlay'
}

function normalizePermission(permission, items) {
    const fallback = items.map(item => item.id)
    return {
        allow: Array.isArray(permission?.allow) ? permission.allow.filter(Boolean) : fallback,
        deny: Array.isArray(permission?.deny) ? permission.deny.filter(Boolean) : [],
    }
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
    const ids = new Set()
    for (const agent of config.agents) {
        agent.id = String(agent.id ?? '').trim()
        if (!agent.id) {
            error = 'agent id is required'
            return null
        }
        if (ids.has(agent.id)) {
            error = `duplicate agent id: ${agent.id}`
            return null
        }
        ids.add(agent.id)
    }

    if (!ids.has(config.defaultAgent)) config.defaultAgent = config.agents[0]?.id ?? ''
    return JSON.parse(JSON.stringify(config))
}

function addAgent() {
    let index = config.agents.length + 1
    let id = `agent${index}`
    while (config.agents.some(agent => agent.id === id)) {
        index += 1
        id = `agent${index}`
    }
    config.agents = [...config.agents, makeAgent(id, capabilities)]
    selectedId = id
}

function duplicateAgent() {
    if (!selectedAgent) return
    let index = 2
    let id = `${selectedAgent.id}_copy`
    while (config.agents.some(agent => agent.id === id)) {
        id = `${selectedAgent.id}_copy${index}`
        index += 1
    }
    const clone = JSON.parse(JSON.stringify(selectedAgent))
    clone.id = id
    clone.title = `${selectedAgent.title || selectedAgent.id} copy`
    config.agents = [...config.agents, clone]
    selectedId = id
}

function removeAgent() {
    if (!selectedAgent || config.agents.length <= 1) return
    const index = config.agents.findIndex(agent => agent.id === selectedAgent.id)
    config.agents = config.agents.filter(agent => agent.id !== selectedAgent.id)
    selectedId = config.agents[Math.max(0, index - 1)]?.id ?? config.agents[0]?.id ?? ''
    if (config.defaultAgent === selectedAgent.id) config.defaultAgent = selectedId
}

function setAllowed(kind, id, checked) {
    if (!selectedAgent) return
    const allow = new Set(selectedAgent.permissions[kind].allow)
    if (checked) allow.add(id)
    else allow.delete(id)
    selectedAgent.permissions[kind].allow = [...allow]
    config = {...config}
}

function isAllowed(kind, id) {
    return selectedAgent?.permissions?.[kind]?.allow?.includes(id) ?? false
}

function countAllowed(agent) {
    if (!agent) return {tools: 0, probes: 0, events: 0}
    return {
        tools: agent.permissions.tools.allow.length,
        probes: agent.permissions.probes.allow.length,
        events: agent.permissions.events.allow.length,
    }
}

function titleFromId(id) {
    return String(id ?? '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
}
</script>

<style>
.agent-settings {
    display: grid;
    grid-template-columns: 12rem minmax(28rem, 42rem);
    gap: 0.75rem;
    max-width: 88vw;
    max-height: 78vh;
    color: #ddd;
    font-family: var(--fBase);
    font-size: 0.78rem;
}

.agents-list,
.agent-form {
    min-height: 30rem;
    overflow: auto;
}

.agents-list {
    border-right: 1px solid #444;
    padding-right: 0.5rem;
}

.agent-row {
    width: 100%;
    text-align: left;
    background: #202020;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 0.2rem;
    margin-bottom: 0.35rem;
    padding: 0.35rem;
    cursor: pointer;
}

.agent-row.selected {
    border-color: #888;
    background: #303030;
}

.agent-row:hover {
    background: #333;
    color: #fff;
}

.agent-title {
    font-weight: 700;
}

.agent-counts,
.hint,
.approval {
    color: #aaa;
    font-size: 0.72rem;
}

.agent-actions,
.row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
}

.agent-actions {
    grid-template-columns: 1fr;
    margin-top: 0.5rem;
}

.agent-form {
    display: grid;
    gap: 0.55rem;
}

.capability-section {
    border-top: 1px solid #444;
    padding-top: 0.55rem;
}

.capability-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.35rem;
    font-weight: 700;
}

.capability-item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.45rem;
    align-items: start;
    padding: 0.25rem 0;
}

.capability-item input[type="checkbox"] {
    width: auto;
}

.capability-title {
    font-weight: 600;
}

.capability-id {
    color: #aaa;
    font-family: var(--fFixed);
    font-size: 0.72rem;
}

.error {
    color: #ff7777;
}
</style>

<PopupBox box={box}>
    <div class="agent-settings">
        <div class="agents-list">
            {#each config.agents as agent}
                <button type="button" class="agent-row" class:selected={agent.id === selectedId} on:click={() => selectedId = agent.id}>
                    <div class="agent-title">{agent.title || agent.id}</div>
                    <div>{agent.id}</div>
                    <div class="agent-counts">
                        {agent.permissions.tools.allow.length} tools,
                        {agent.permissions.probes.allow.length} probes,
                        {agent.permissions.events.allow.length} events
                    </div>
                </button>
            {/each}

            <div class="agent-actions">
                <Button label="add agent" click={addAgent} />
                <Button label="duplicate" click={duplicateAgent} />
                <Button label="delete" click={removeAgent} disabled={config.agents.length <= 1} />
            </div>
        </div>

        {#if selectedAgent}
            <div class="agent-form">
                <LabelCheckbox label="enabled" bind:on={selectedAgent.enabled} />

                <div class="row">
                    <LabelTextInput label="id" bind:text={selectedAgent.id} onInput={() => selectedId = selectedAgent.id} />
                    <LabelSelect label="default agent" bind:value={config.defaultAgent} options={config.agents.map(agent => agent.id)} />
                </div>

                <LabelSelect label="type" bind:value={selectedAgent.type} options={typeOptions} />
                <LabelTextInput label="title" bind:text={selectedAgent.title} />
                <LabelTextarea label="instructions" bind:text={selectedAgent.instructions} />

                {#if selectedAgent.type === 'overlay' || selectedAgent.type === 'openai'}
                    <div class="row">
                        <LabelSelect label="provider" bind:value={selectedAgent.llm.provider} options={providerOptions} />
                        <LabelSelect label="overlay" bind:value={selectedAgent.ui.mode} options={overlayOptions} />
                    </div>

                    <div class="row">
                        <LabelTextInput label="model" bind:text={selectedAgent.llm.model} />
                        <LabelTextInput label="endpoint" bind:text={selectedAgent.llm.endpoint} />
                    </div>
                {/if}

                {#if selectedAgent.type === 'http'}
                    <div class="row">
                        <LabelTextInput label="server host" bind:text={selectedAgent.server.host} />
                        <LabelTextInput label="server port" bind:text={selectedAgent.server.port} />
                    </div>
                    <LabelTextInput label="base path" bind:text={selectedAgent.server.basePath} />
                {/if}

                {#if selectedAgent.type === 'mcp'}
                    <LabelSelect label="transport" bind:value={selectedAgent.transport.mode} options={transportModeOptions} />
                {/if}

                <div class="hint">
                    Effective view: {allowedCounts.tools} tools, {allowedCounts.probes} probes, {allowedCounts.events} events.
                </div>

                <div class="capability-section">
                    <div class="capability-header">
                        <span>Tools</span>
                        <span class="hint">{selectedAgent.permissions.tools.allow.length} selected</span>
                    </div>
                    {#each capabilities.tools as item}
                        <label class="capability-item">
                            <input
                                type="checkbox"
                                checked={isAllowed('tools', item.id)}
                                on:change={(event) => setAllowed('tools', item.id, event.currentTarget.checked)}
                            />
                            <span>
                                <span class="capability-title">{item.title || item.id}</span>
                                {#if item.approval === 'always'}
                                    <span class="approval"> requires approval</span>
                                {/if}
                                <span class="capability-id">{item.id}</span>
                            </span>
                        </label>
                    {/each}
                </div>

                <div class="capability-section">
                    <div class="capability-header">
                        <span>Probes</span>
                        <span class="hint">{selectedAgent.permissions.probes.allow.length} selected</span>
                    </div>
                    {#each capabilities.probes as item}
                        <label class="capability-item">
                            <input
                                type="checkbox"
                                checked={isAllowed('probes', item.id)}
                                on:change={(event) => setAllowed('probes', item.id, event.currentTarget.checked)}
                            />
                            <span>
                                <span class="capability-title">{item.title || item.id}</span>
                                <span class="capability-id">{item.id}</span>
                            </span>
                        </label>
                    {/each}
                </div>

                <div class="capability-section">
                    <div class="capability-header">
                        <span>Events</span>
                        <span class="hint">{selectedAgent.permissions.events.allow.length} selected</span>
                    </div>
                    {#each capabilities.events as item}
                        <label class="capability-item">
                            <input
                                type="checkbox"
                                checked={isAllowed('events', item.id)}
                                on:change={(event) => setAllowed('events', item.id, event.currentTarget.checked)}
                            />
                            <span>
                                <span class="capability-title">{item.title || item.id}</span>
                                <span class="capability-id">{item.id}</span>
                            </span>
                        </label>
                    {/each}
                </div>

                {#if error}
                    <div class="error">{error}</div>
                {/if}
            </div>
        {/if}
    </div>
</PopupBox>
