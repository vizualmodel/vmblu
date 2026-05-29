<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelInfoField from '../../fragments/label-info-field.svelte'
import LabelInputField from '../../fragments/label-input-field.svelte'
import ColorPicker from '../../fragments/color-picker.svelte'
import ButtonRow from '../../fragments/button-row.svelte'
import Button from '../../fragments/button.svelte'
import {getRuntimeDescriptor} from '../../../runtime/runtime-settings-registry.js'

export let tx //, sx

// the popup box
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

// The local data
let _path, _created, _version, _saved, _color, _runtime, _runtimeSettings, _agent, _capabilities, _onColor

$: _supportsAgents = getRuntimeDescriptor(_runtime).supportsAgents

onMount( () => {
    // send the box div
    tx.send('modal div', box.div)
})

export const handlers = {

    // Settings is the link header of the document
    "-> show"({title, path, settings, capabilities, pos, ok, cancel, onColor}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => {
            ok({
                runtime: _runtime,
                runtimeSettings: _runtimeSettings,
                agent: _agent,
            })
        } : null
        box.cancel = cancel ? () => cancel() : null

        // The field settings
        _path = path
        _version = settings.version
        _created = settings.created
        _saved = settings.saved
        _runtime = settings.runtime
        _runtimeSettings = cloneSettings(settings.runtimeSettings)
        _agent = cloneSettings(settings.agent)
        _capabilities = cloneSettings(capabilities)
        _color = settings.style.rgb
        _onColor = onColor

        // and show
        box.show(pos)
    }
}

function cloneSettings(settings) {
    if (!settings) return null
    return JSON.parse(JSON.stringify(settings))
}

function showRuntimeSettings() {
    tx.send('model runtime settings', {
        runtime: _runtime,
        settings: _runtimeSettings,
        pos: {
            x: (box.pos?.x ?? 25) + 40,
            y: (box.pos?.y ?? 25) + 40,
        },
        ok(settings) {
            _runtimeSettings = settings
        },
    })
}

function showAgentSettings() {
    if (!_supportsAgents) return

    tx.send('agent settings', {
        settings: _agent,
        capabilities: _capabilities,
        pos: {
            x: (box.pos?.x ?? 25) + 70,
            y: (box.pos?.y ?? 25) + 70,
        },
        ok(settings) {
            _agent = settings
        },
    })
}

</script>
<PopupBox box={box}>
    <LabelInfoField label="File:" style="width: 6rem;" info={_path}  />
    <LabelInfoField label="Vmblu Version:" style="width: 6rem;" info={_version} />
    <LabelInfoField label="Creation Date:" style="width: 6rem;" info={_created} />
    <LabelInfoField label="Last Saved:" style="width: 6rem;" info={_saved}  />
    <LabelInputField label="Runtime" style="width: 6rem;" bind:input={_runtime} check={null}/>
    <ButtonRow label="Settings" style="width: 6rem;">
        <Button label="Runtime" click={showRuntimeSettings} />
        {#if _supportsAgents}
            <Button label="Agents" click={showAgentSettings} />
        {/if}
    </ButtonRow>
    <ColorPicker label="Node Color:" style="width: 6rem;" color={_color} onColor={_onColor}/>
</PopupBox>
