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

function runtimeSettingsComponent(runtime) {
    if (runtime === RT_AGENT) return RuntimeSettingsAgent
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
    const request = policy.node?.security?.request ?? {}
    const clipped = []

    for (const domain of ['fs', 'net', 'process']) {
        if (request[domain] !== 'inherit' && request[domain] !== policy.security?.[domain]) {
            clipped.push(`${domain}: ${request[domain]} -> ${policy.security?.[domain]}`)
        }
    }

    return clipped.length ? `Outside model envelope: ${clipped.join(', ')}` : ''
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
    <svelte:component this={runtimeSettingsComponent(runtimeName)} bind:dx={localDx} />
    {#if envelopeWarning}
        <p class="runtime-warning">{envelopeWarning}</p>
    {/if}
</PopupBox>
