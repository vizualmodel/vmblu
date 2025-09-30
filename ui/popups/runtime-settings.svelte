<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import SameLine from '../fragments/same-line.svelte'
import Label from '../fragments/label.svelte'
import TextField from '../fragments/text-field.svelte'
import CheckBox from '../fragments/checkbox.svelte'

export let tx, sx

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

// set the defauult value 
const localRx = {
    logMessages: false,
    worker: {
        on: false,
        path: ''
    }
}

export const handlers = {

    // Settings is the link header of the document
    "-> show"({title, pos, rx, ok, cancel}) {

        // The box 
        box.title = title,
        box.pos = {...pos}

        // if there is a callback, call it
        box.ok = (e) => {

            if (!ok) return

            // call ok with the local rx
            ok(localRx) 
        }
        box.cancel = () => {
            cancel?.()
        }

        // Copy the settings if any
        if (rx) {
            localRx.logMessages = rx.logMessages
            localRx.worker.on = rx.worker.on
            localRx.worker.path = rx.worker.path
        }

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
        <CheckBox on = {localRx.logMessages} onToggle = {onToggle}/>
        <Label text="log messages"/>
    </SameLine>
    <SameLine>
        <CheckBox field= {localRx.worker.on} />
        <Label text="use worker script:" style="margin-right: 0.5rem;"/>
        <TextField field={localRx.worker.path} />
    </SameLine>
</PopupBox>