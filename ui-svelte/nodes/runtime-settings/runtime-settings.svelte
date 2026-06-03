<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import RuntimeSettingsBase from './runtime-settings-base.svelte'
import RuntimeSettingsAls from './runtime-settings-als.svelte'
import RuntimeSettingsAgent from './runtime-settings-agent.svelte'
import {
    RT_BASE,
    RT_ALS,
    RT_AGENT,
    RT_NODEJS_AGENT,
    getRuntimeSettings,
} from '../../../runtime/runtime-settings-registry.js'
export let tx

onMount(() => {
    tx.send('modal div', box.div)
})

const box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let runtimeName = RT_BASE
let localDx = getRuntimeSettings(RT_BASE).make()
let modelRuntimeSettings = null

$: envelopeWarning = runtimeEnvelopeWarning(runtimeName, modelRuntimeSettings, localDx)
$: runtimeComponent = runtimeSettingsComponent(runtimeName)

function runtimeSettingsComponent(runtime) {
    if (runtime === RT_AGENT || runtime === RT_NODEJS_AGENT) return RuntimeSettingsAgent
    if (runtime === RT_ALS) return RuntimeSettingsAls
    return RuntimeSettingsBase
}

export const handlers = {
    onShow({title, pos, dx, runtime, modelRuntimeSettings: settings, ok, cancel}) {
        runtimeName = runtime ?? RT_BASE
        modelRuntimeSettings = settings ?? null
        box.title = title
        box.pos = {...pos}
        box.ok = () => ok?.(getRuntimeSettings(runtimeName).clone(localDx))
        box.cancel = () => cancel?.()
        const runtimeSettings = getRuntimeSettings(runtimeName)
        localDx = dx ? runtimeSettings.clone(dx) : runtimeSettings.make()
        box.show(box.pos)
    },
}

function runtimeEnvelopeWarning(runtime, modelSettings, dx) {
    if (!dx?.security?.enabled || !modelSettings || typeof modelSettings !== 'object') return ''

    const policy = getRuntimeSettings(runtime).effectivePolicy(modelSettings, dx)
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
.runtime-warning {
    max-width: 34rem;
    color: #ffcc66;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    margin: 0.75rem 0 0 0;
}
</style>

<PopupBox box={box}>
    {#if runtimeComponent === RuntimeSettingsBase}
        <RuntimeSettingsBase bind:dx={localDx} />
    {:else}
        <svelte:component
            this={runtimeComponent}
            bind:dx={localDx}
            {tx}
            runtime={runtimeName}
            {modelRuntimeSettings}
            popupPos={box.pos}
        />
    {/if}
    {#if envelopeWarning}
        <p class="runtime-warning">{envelopeWarning}</p>
    {/if}
</PopupBox>
