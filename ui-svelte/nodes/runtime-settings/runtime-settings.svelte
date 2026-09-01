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

$: runtimeComponent = runtimeSettingsComponent(runtimeName)

function runtimeSettingsComponent(runtime) {
    if (runtime === RT_AGENT || runtime === RT_NODEJS_AGENT) return RuntimeSettingsAgent
    if (runtime === RT_ALS) return RuntimeSettingsAls
    return RuntimeSettingsBase
}

export const handlers = {
    onShow({title, pos, dx, runtime, ok, cancel}) {
        runtimeName = runtime ?? RT_BASE
        box.title = title
        box.pos = {...pos}
        box.ok = () => ok?.(getRuntimeSettings(runtimeName).clone(localDx))
        box.cancel = () => cancel?.()
        const runtimeSettings = getRuntimeSettings(runtimeName)
        localDx = dx ? runtimeSettings.clone(dx) : runtimeSettings.make()
        box.show(box.pos)
    },
}
</script>

<PopupBox box={box}>
    {#if runtimeComponent === RuntimeSettingsBase}
        <RuntimeSettingsBase bind:dx={localDx} />
    {:else}
        <svelte:component
            this={runtimeComponent}
            bind:dx={localDx}
        />
    {/if}
</PopupBox>
