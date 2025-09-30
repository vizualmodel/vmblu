<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import LabelInfoField from '../fragments/label-info-field.svelte'
import LabelInputField from '../fragments/label-input-field.svelte'
import ColorPicker from '../fragments/color-picker.svelte'

export let tx, sx

// the popup box
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

// The local data
let _path, _created, _version, _saved, _color, _runtime, _onColor

onMount( () => {
    // send the box div
    tx.send('modal div', box.div)
})

export const handlers = {

    // Settings is the link header of the document
    "-> show"({title, path, settings, pos, ok, cancel, onColor}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => ok(_runtime) : null
        box.cancel = cancel ? () => cancel() : null

        // The field settings
        _path = path
        _version = settings.version
        _created = settings.created
        _saved = settings.saved
        _runtime = settings.runtime
        _color = settings.style.rgb
        _onColor = onColor

        // and show
        box.show(pos)
    }
}

</script>
<style>
</style>
<PopupBox box={box}>
    <LabelInfoField label="File:" style="width: 6rem;" info={_path}  />
    <LabelInfoField label="Vmblu Version:" style="width: 6rem;" info={_version} />
    <LabelInfoField label="Creation Date:" style="width: 6rem;" info={_created} />
    <LabelInfoField label="Last Saved:" style="width: 6rem;" info={_saved}  />
    <LabelInputField label="Runtime" style="width: 6rem;" bind:input={_runtime} check={null}/>
    <ColorPicker label="Node Color:" style="width: 6rem;" color={_color} onColor={_onColor}/>
</PopupBox>