<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelInfoField from '../../fragments/label-info-field.svelte'
import LabelInputField from '../../fragments/label-input-field.svelte'
import CheckBox from '../../fragments/checkbox.svelte'
import {getRuntimeDescriptor, getRuntimeSettings, RT_ALS} from '../../../runtime/runtime-settings-registry.js'
import {makeDefaultAgentSettings} from '../agent-settings/agent-settings-model.js'

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
let _path, _created, _version, _saved, _runtime, _runtimeSettings, _agent, _capabilities, _teams, _fallbackTeamColor
let _securityEnabled = false
let _agentEnabled = false

$: _supportsAgents = getRuntimeDescriptor(_runtime).supportsAgents
$: _supportsSecurity = getRuntimeDescriptor(_runtime).supportsSecurity
$: _securitySidecar = isRuntimeSidecar(_runtimeSettings)
$: if (_securitySidecar && _securityEnabled) _securityEnabled = false

onMount( () => {
    // send the box div
    tx.send('modal div', box.div)
})

export const handlers = {

    // Settings is the link header of the document
    onShow({title, path, settings, capabilities, pos, ok, cancel, onColor}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => {
            ok({
                runtime: _runtime,
                runtimeSettings: securitySettingsForSave(),
                agent: _agent,
                teams: cloneSettings(_teams),
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
        normalizeInlineSecurity()
        _securityEnabled = !isRuntimeSidecar(_runtimeSettings)
            && !!_runtimeSettings?.security
            && _runtimeSettings.security.enabled !== false
        _agent = cloneSettings(settings.agent)
        _agentEnabled = !!_agent && _agent.enabled !== false
        _capabilities = cloneSettings(capabilities)
        _teams = cloneSettings(settings.teams)
        _fallbackTeamColor = settings.style?.rgb

        // and show
        box.show(pos)
    }
}

function cloneSettings(settings) {
    if (!settings) return null
    return JSON.parse(JSON.stringify(settings))
}

function isRuntimeSidecar(settings) {
    return typeof settings === 'string' || !!settings?.path
}

function normalizeInlineSecurity() {
    if (isRuntimeSidecar(_runtimeSettings) || !_runtimeSettings?.security) return
    const security = getRuntimeSettings(RT_ALS).normalizeModel({security: _runtimeSettings.security}).security
    _runtimeSettings = {..._runtimeSettings, security}
}

function securitySettingsForSave() {
    return cloneSettings(_runtimeSettings)
}

function onSecurityToggle(enabled) {
    if (!_supportsSecurity || _securitySidecar) return

    const settings = _runtimeSettings && typeof _runtimeSettings === 'object' ? _runtimeSettings : {}
    const securitySettings = getRuntimeSettings(RT_ALS)
    const security = securitySettings.normalizeModel({security: settings.security}).security
        ?? securitySettings.makeModel().security
    _runtimeSettings = {...settings, security: {...cloneSettings(security), enabled}}
}

function onAgentToggle(enabled) {
    if (!_supportsAgents) return
    const settings = _agent && typeof _agent === 'object' && !_agent.path
        ? _agent
        : makeDefaultAgentSettings(enabled)
    _agent = {...settings, enabled}
    _agentEnabled = enabled
}

function showSecurityCategory(category) {
    if (_securitySidecar) return
    const offsets = {fs: 35, net: 55, process: 75}
    const offset = offsets[category] ?? 35
    const security = _runtimeSettings?.security
        ?? {...getRuntimeSettings(RT_ALS).makeModel().security, enabled: _securityEnabled}

    tx.send('model runtime settings', {
        category,
        security: cloneSettings(security),
        pos: {
            x: (box.pos?.x ?? 25) + offset,
            y: (box.pos?.y ?? 25) + offset,
        },
        ok(security) {
            const settings = _runtimeSettings && typeof _runtimeSettings === 'object' ? _runtimeSettings : {}
            _runtimeSettings = {...settings, security}
        },
    })
}

function showTeamSettings() {
    tx.send('team settings', {
        teams: cloneSettings(_teams),
        fallbackColor: _fallbackTeamColor,
        pos: {
            x: (box.pos?.x ?? 25) + 55,
            y: (box.pos?.y ?? 25) + 55,
        },
        ok(teams) {
            _teams = teams
        },
    })
}

function showAgentSettings() {
    tx.send('agent settings', {
        settings: _agent,
        capabilities: _capabilities,
        pos: {
            x: (box.pos?.x ?? 25) + 70,
            y: (box.pos?.y ?? 25) + 70,
        },
        ok(settings) {
            _agent = settings
            _agentEnabled = settings.enabled !== false
        },
    })
}

</script>
<style>
.security-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0 0 0.45rem;
}

.security-label {
    width: 6rem;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.security-status {
    width: 6.5rem;
    border: 0;
    outline: 0;
    background: #000;
    color: #cebf6d;
    font-family: var(--fFixed);
    font-size: var(--fSmall);
    padding: 0.2rem 0.35rem;
}

.enabled-control {
    display: flex;
    align-items: center;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.security-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.7rem;
    border: 1px solid yellow;
    border-radius: 0.2rem;
    background: #222;
    color: yellow;
    cursor: pointer;
}

.security-icon:hover:not(:disabled) {
    background: #333;
    color: yellow;
}

.security-icon.first {
    margin-left: 0.7rem;
}

.security-icon:disabled {
    opacity: 0.45;
    cursor: default;
}

.security-icon .material-icons-outlined {
    font-size: 1.1rem;
}

.settings-popup-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.25rem 0;
}

.settings-popup-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.7rem;
    border: 1px solid yellow;
    border-radius: 0.2rem;
    background: #222;
    color: yellow;
    cursor: pointer;
}

.settings-popup-icon:hover {
    background: #333;
    color: yellow;
}

.settings-popup-icon .material-icons-outlined {
    font-size: 1.1rem;
}

.agent-settings-icon {
    margin-left: 0.7rem;
}
</style>
<PopupBox box={box}>
    <LabelInfoField label="File:" style="width: 6rem;" info={_path}  />
    <LabelInfoField label="Vmblu Version:" style="width: 6rem;" info={_version} />
    <LabelInfoField label="Creation Date:" style="width: 6rem;" info={_created} />
    <LabelInfoField label="Last Saved:" style="width: 6rem;" info={_saved}  />
    <LabelInputField label="Runtime" style="width: 6rem;" bind:input={_runtime} check={null}/>
    <div class="security-row">
        <label class="security-label" for="security-support">Security</label>
        <input id="security-support" class="security-status" value={_supportsSecurity ? 'supported' : 'unsupported'} readonly />
        <label class="enabled-control" title={_securitySidecar ? 'Security is configured in the runtime sidecar.' : !_supportsSecurity ? 'The selected runtime cannot enforce security.' : ''}>
            <CheckBox bind:on={_securityEnabled} disabled={!_supportsSecurity || _securitySidecar} onToggle={onSecurityToggle} />
            Enabled
        </label>
        <button class="security-icon first" type="button" title="File System" aria-label="File System" disabled={_securitySidecar} on:click={() => showSecurityCategory('fs')}>
            <span class="material-icons-outlined">folder</span>
        </button>
        <button class="security-icon" type="button" title="Network" aria-label="Network" disabled={_securitySidecar} on:click={() => showSecurityCategory('net')}>
            <span class="material-icons-outlined">language</span>
        </button>
        <button class="security-icon" type="button" title="Process" aria-label="Process" disabled={_securitySidecar} on:click={() => showSecurityCategory('process')}>
            <span class="material-icons-outlined">terminal</span>
        </button>
    </div>
    <div class="security-row">
        <label class="security-label" for="agent-support">Agents</label>
        <input id="agent-support" class="security-status" value={_supportsAgents ? 'supported' : 'unsupported'} readonly />
        <label class="enabled-control" title={!_supportsAgents ? 'The selected runtime cannot provide agent interfaces.' : ''}>
            <CheckBox bind:on={_agentEnabled} disabled={!_supportsAgents} onToggle={onAgentToggle} />
            Enabled
        </label>
        <button class="settings-popup-icon agent-settings-icon" type="button" title="Agents" aria-label="Agents" on:click={showAgentSettings}>
            <span class="material-icons-outlined">smart_toy</span>
        </button>
    </div>
    <div class="settings-popup-row">
        <span class="security-label">Teams</span>
        <button class="settings-popup-icon" type="button" title="Teams" aria-label="Teams" on:click={showTeamSettings}>
            <span class="material-icons-outlined">groups</span>
        </button>
    </div>
</PopupBox>
