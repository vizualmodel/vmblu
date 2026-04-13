<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import SameLine from '../../fragments/same-line.svelte'
import Label from '../../fragments/label.svelte'
import TextField from '../../fragments/text-field.svelte'
import CheckBox from '../../fragments/checkbox.svelte'
import {makeRuntimeSettings, cloneRuntimeSettings} from '../../../runtime/src/runtime-settings.js'

export let tx//, sx

onMount( () => {

    // send out the div
    tx.send("modal div", box.div)
})

// the popup box data
const box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let localDx = makeRuntimeSettings()

export const handlers = {

    // Settings is the link header of the document
    onShow({title, pos, dx, ok, cancel}) {

        // The box 
        box.title = title,
        box.pos = {...pos}

        // if there is a callback, call it
        box.ok = () => {

            if (!ok) return

            // call ok with the local rx
            ok(cloneRuntimeSettings(localDx)) 
        }
        box.cancel = () => {
            cancel?.()
        }

        // Copy the settings while keeping Svelte reactivity
        localDx = cloneRuntimeSettings(dx)

        // and show
        box.show(box.pos)
    },
}

function onToggle(e) {
}

</script>
<style>
</style>
<PopupBox box={box}>
    <SameLine>
        <CheckBox bind:on={localDx.logMessages} onToggle = {onToggle}/>
        <Label text="log messages"/>
    </SameLine>
    <SameLine>
        <CheckBox bind:on={localDx.worker.on} style=""/>
        <Label text="use worker script:" style="margin-right: 0.5rem;"/>
        <TextField bind:text={localDx.worker.path} />
    </SameLine>
</PopupBox>
