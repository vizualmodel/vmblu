<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import LabelInputField from '../fragments/label-input-field.svelte'
// import SameLine from '../fragments/same-line.svelte'
// import Label from '../fragments/label.svelte'
// import TextField from '../fragments/text-field.svelte'

export let tx, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}
// local copies of the 
let _name = ''
let _path = ''
let _regex = ''

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

    onNameAndPath({title, pos, name, path, regex, ok, cancel, open, trash}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = () => {
            ok?.(_name, _path)
        }
        box.cancel = cancel ? () => cancel() : null
        box.open = (e)=> {
            open?.(_name, _path)
            box.hide()
        }

        box.trash = trash ? () => trash() : null

        // the name field
        _name = name
        _path = path
        _regex = regex

        // show the popup
        box.show(pos)
    },
}

</script>
<style>
</style>
<PopupBox box={box}>
    <LabelInputField label="Name" style="width: 3rem;" bind:input={_name} check={null} />
    <LabelInputField label="Path" style="width: 3rem;" bind:input={_path} check={checkPath} />
</PopupBox>

