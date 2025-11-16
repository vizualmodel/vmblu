<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import LabelInputField from '../fragments/label-input-field.svelte'

export let tx//, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}
// local copies of the 
let _path, _regex

function checkPath(str) {
                
    // if we need to test the input..
    if (!_regex) return true

    // test the input against the regex
    return _regex.test?.(str)
}

onMount( () => {
    tx.send("modal div", box.div)
})

export const handlers = {

    // The uid is the uid of the node for which the popup is opened
    "-> path"({title, path, pos, ok, cancel}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => ok(_path) : null
        box.cancel = cancel ? () => cancel() : null

        // the path field
        _path = path

        // show the popup
        box.show()
    },
}

</script>
<style>
</style>
<PopupBox box={box}>
    <LabelInputField label="Path :" style="width: 2rem;" bind:input={_path} check={checkPath} />
</PopupBox>

