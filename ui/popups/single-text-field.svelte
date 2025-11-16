<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import TextField from '../fragments/text-field.svelte'

export let tx //, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let _text = ''

onMount( () => {
    tx.send("modal div", box.div)
})

export const handlers = {

    // The uid is the uid of the node for which the popup is opened
    "-> show"({label, value, pos, ok, cancel}) {

        // The box 
        box.title = label,
        box.pos = {...pos}
        box.ok = ok ? () => ok(_text) : null
        box.cancel = cancel ? () => cancel() : null

        // the text 
        _text = value

        // show the popup
        box.show(box.pos)
    },
}

</script>
<style>
</style>
<PopupBox box={box}>
    <TextField bind:text={_text} style={null} check={null} />
</PopupBox>

