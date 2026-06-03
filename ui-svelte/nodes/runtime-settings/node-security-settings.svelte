<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import {getRuntimeSettings} from '../../../runtime/runtime-settings-registry.js'

export let tx

const permissionOptions = ['allow', 'warn', 'deny']

const box = {
    div: null,
    pos: null,
    title: 'Node Security Settings',
    ok: null,
    cancel: null,
}

let runtime = null
let modelRuntimeSettings = null
let security = makeDefaultSecurity()
let scopeText = makeScopeText()
let projectedSecurity = makeDefaultSecurity()

$: projectedSecurity = securityFromText(security, scopeText)
$: envelopeWarning = runtimeEnvelopeWarning(runtime, modelRuntimeSettings, projectedSecurity)

onMount(() => {
    tx?.send('modal div', box.div)
})

export function show({runtime: runtimeName, security: nodeSecurity, modelRuntimeSettings: settings, pos, ok, cancel}) {
    runtime = runtimeName
    modelRuntimeSettings = settings ?? null
    security = normalizeSecurity(runtime, nodeSecurity)
    syncTextFromSecurity()
    box.pos = {...pos}
    box.ok = () => {
        ok?.(clone(projectedSecurity))
    }
    box.cancel = () => cancel?.()
    box.show(box.pos)
}

function normalizeSecurity(runtimeName, nodeSecurity) {
    const dx = getRuntimeSettings(runtimeName).normalize({security: nodeSecurity})
    return {
        ...clone(dx.security),
        enabled: true,
    }
}

function makeDefaultSecurity() {
    return {
        enabled: true,
        fs: {
            read: {mode: 'deny', roots: []},
            write: {mode: 'deny', roots: []},
            delete: {mode: 'deny', roots: []},
        },
        net: {
            egress: {mode: 'deny', hosts: []},
        },
        process: {
            exec: {mode: 'deny', commands: []},
        },
    }
}

function makeScopeText() {
    return {
        fsReadRoots: '',
        fsWriteRoots: '',
        fsDeleteRoots: '',
        netEgressHosts: '',
        processExecCommands: '',
    }
}

function syncTextFromSecurity() {
    scopeText = {
        fsReadRoots: listToText(security?.fs?.read?.roots),
        fsWriteRoots: listToText(security?.fs?.write?.roots),
        fsDeleteRoots: listToText(security?.fs?.delete?.roots),
        netEgressHosts: listToText(security?.net?.egress?.hosts),
        processExecCommands: listToText(security?.process?.exec?.commands),
    }
}

function securityFromText(source, text) {
    const next = clone(source)
    next.fs.read.roots = textToList(text.fsReadRoots)
    next.fs.write.roots = textToList(text.fsWriteRoots)
    next.fs.delete.roots = textToList(text.fsDeleteRoots)
    next.net.egress.hosts = textToList(text.netEgressHosts)
    next.process.exec.commands = textToList(text.processExecCommands)
    return next
}

function listToText(values) {
    return Array.isArray(values) ? values.join('\n') : ''
}

function textToList(text) {
    return (text ?? '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
}

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function runtimeEnvelopeWarning(runtimeName, settings, nodeSecurity) {
    if (!settings || typeof settings !== 'object') return ''

    const dx = getRuntimeSettings(runtimeName).normalize({security: nodeSecurity})
    const policy = getRuntimeSettings(runtimeName).effectivePolicy(settings, dx)
    const clipped = []

    collectClippedOperation(clipped, 'fs.read', policy.node?.security?.fs?.read, policy.security?.fs?.read, 'roots')
    collectClippedOperation(clipped, 'fs.write', policy.node?.security?.fs?.write, policy.security?.fs?.write, 'roots')
    collectClippedOperation(clipped, 'fs.delete', policy.node?.security?.fs?.delete, policy.security?.fs?.delete, 'roots')
    collectClippedOperation(clipped, 'net.egress', policy.node?.security?.net?.egress, policy.security?.net?.egress, 'hosts')
    collectClippedOperation(clipped, 'process.exec', policy.node?.security?.process?.exec, policy.security?.process?.exec, 'commands')

    return clipped.length ? `Outside model envelope: ${clipped.join(', ')}` : ''
}

function collectClippedOperation(clipped, label, requested, effective, scopeKey) {
    if (!requested || !effective) return
    if (requested.mode !== effective.mode) {
        clipped.push(`${label}: ${requested.mode} -> ${effective.mode}`)
        return
    }

    const requestedScope = requested[scopeKey] ?? []
    const effectiveScope = effective[scopeKey] ?? []
    if (requestedScope.length && JSON.stringify(requestedScope) !== JSON.stringify(effectiveScope)) {
        clipped.push(`${label} scope clipped`)
    }
}
</script>

<style>
.node-security-settings {
    width: 34rem;
    max-width: 80vw;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.section {
    border-top: 1px solid #444;
    padding-top: 0.6rem;
    margin-top: 0.7rem;
}

.section:first-of-type {
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
}

.section h4 {
    margin: 0 0 0.45rem 0;
    color: #eee;
    font-size: var(--fBase);
    font-weight: normal;
}

.runtime-warning {
    color: #ffcc66;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    margin: 0.75rem 0 0 0;
}
</style>

<PopupBox box={box}>
    <div class="node-security-settings">
        <div class="section">
            <h4>File System</h4>
            <LabelSelect label="read" bind:value={security.fs.read.mode} options={permissionOptions} />
            <LabelTextarea label="read roots" bind:text={scopeText.fsReadRoots} />
            <LabelSelect label="write" bind:value={security.fs.write.mode} options={permissionOptions} />
            <LabelTextarea label="write roots" bind:text={scopeText.fsWriteRoots} />
            <LabelSelect label="delete" bind:value={security.fs.delete.mode} options={permissionOptions} />
            <LabelTextarea label="delete roots" bind:text={scopeText.fsDeleteRoots} />
        </div>

        <div class="section">
            <h4>Network</h4>
            <LabelSelect label="egress" bind:value={security.net.egress.mode} options={permissionOptions} />
            <LabelTextarea label="hosts" bind:text={scopeText.netEgressHosts} />
        </div>

        <div class="section">
            <h4>Process</h4>
            <LabelSelect label="exec" bind:value={security.process.exec.mode} options={permissionOptions} />
            <LabelTextarea label="commands" bind:text={scopeText.processExecCommands} />
        </div>

        {#if envelopeWarning}
            <p class="runtime-warning">{envelopeWarning}</p>
        {/if}
    </div>
</PopupBox>
