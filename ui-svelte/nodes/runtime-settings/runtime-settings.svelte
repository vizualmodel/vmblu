<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import RuntimeSettingsBase from './runtime-settings-base.svelte'
import RuntimeSettingsAls from './runtime-settings-als.svelte'
import {
    RT_BASE,
    RT_ALS,
    makeRuntimeSettings,
    cloneRuntimeSettings,
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
let localDx = makeRuntimeSettings(RT_BASE)

function isAlsRuntime(runtime) {
    return runtime === RT_ALS
}

export const handlers = {
    onShow({title, pos, dx, runtime, ok, cancel}) {
        runtimeName = runtime ?? RT_BASE
        box.title = title
        box.pos = {...pos}
        box.ok = () => ok?.(cloneRuntimeSettings(runtimeName, localDx))
        box.cancel = () => cancel?.()
        localDx = dx ? cloneRuntimeSettings(runtimeName, dx) : makeRuntimeSettings(runtimeName)
        box.show(box.pos)
    },
}
</script>

<style>
</style>

<PopupBox box={box}>
    {#if isAlsRuntime(runtimeName)}
        <RuntimeSettingsAls bind:dx={localDx} />
    {:else}
        <RuntimeSettingsBase bind:dx={localDx} />
    {/if}
</PopupBox>
