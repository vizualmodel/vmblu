<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import Button from '../../fragments/button.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelTextarea from '../../fragments/label-textarea.svelte'
import {getRuntimeSettings} from '../../../runtime/runtime-settings-registry.js'

export let tx

const box = {
    div: null,
    pos: null,
    title: 'Runtime Settings',
    ok: null,
    cancel: null,
}

let settingsText = ''
let settingsError = ''
let currentSettings = null
let currentRuntime = null
let view = 'form'
let netHostsText = ''
let fsRootsText = ''

const securityModeOptions = ['off', 'warn', 'enforce']
const permissionOptions = ['allow', 'warn', 'deny']

onMount(() => {
    tx.send('modal div', box.div)
})

export function show({runtime, settings, pos, ok, cancel}) {
    currentRuntime = runtime
    currentSettings = normalizeModelSettings(runtime, cloneSettings(settings))
    syncTextFromSettings()
    syncAllowTextFromSettings()
    settingsError = ''
    view = 'form'
    box.title = `Runtime Settings: ${runtimeName(runtime)}`
    box.pos = {...pos}
    box.ok = () => {
        const parsed = view === 'json' ? parseSettings() : collectFormSettings()
        if (parsed === undefined) {
            box.show(box.pos)
            return
        }
        currentSettings = normalizeModelSettings(currentRuntime, parsed)
        ok?.(parsed)
    }
    box.cancel = () => {
        settingsError = ''
        cancel?.()
    }
    box.show(box.pos)
}

export const handlers = {
    "-> show": show,
}

function cloneSettings(settings) {
    if (!settings) return null
    return JSON.parse(JSON.stringify(settings))
}

function settingsToText(settings) {
    if (!settings) return ''
    if (typeof settings === 'string') return JSON.stringify({path: settings}, null, 2)
    return JSON.stringify(settings, null, 2)
}

function normalizeModelSettings(runtime, settings = null) {
    const runtimeSettings = getRuntimeSettings(runtime)
    const base = settings ?? runtimeSettings.makeModel()
    return runtimeSettings.normalizeModel?.(base) ?? base
}

function collectFormSettings() {
    syncAllowListsFromText()
    settingsError = ''
    return normalizeModelSettings(currentRuntime, currentSettings)
}

function syncTextFromSettings() {
    settingsText = settingsToText(currentSettings)
}

function syncSettingsFromText() {
    const parsed = parseSettings()
    if (parsed === undefined) return false
    currentSettings = normalizeModelSettings(currentRuntime, parsed)
    syncAllowTextFromSettings()
    return true
}

function setView(nextView) {
    if (nextView === view) return
    if (nextView === 'json') {
        syncAllowListsFromText()
        syncTextFromSettings()
        settingsError = ''
    }
    else if (!syncSettingsFromText()) {
        return
    }
    view = nextView
}

function syncAllowTextFromSettings() {
    netHostsText = listToText(currentSettings?.security?.allow?.netHosts)
    fsRootsText = listToText(currentSettings?.security?.allow?.fsRoots)
}

function syncAllowListsFromText() {
    if (!currentSettings?.security?.allow) return
    currentSettings.security.allow.netHosts = textToList(netHostsText)
    currentSettings.security.allow.fsRoots = textToList(fsRootsText)
}

function listToText(values) {
    return Array.isArray(values) ? values.join('\n') : ''
}

function textToList(text) {
    return (text ?? '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
}

function parseSettings() {
    const text = settingsText?.trim() ?? ''
    if (!text) {
        settingsError = ''
        return null
    }

    try {
        settingsError = ''
        return JSON.parse(text)
    }
    catch (error) {
        settingsError = error?.message ?? String(error)
        return undefined
    }
}

function runtimeName(runtime) {
    return runtime?.split?.('/')?.at?.(-1) ?? runtime ?? 'runtime'
}

function hasPolicySettings(settings) {
    const defaults = settings?.security?.defaults
    return !!defaults && ['fs', 'net', 'process'].some(key => key in defaults)
}
</script>

<style>
.runtime-settings {
    width: 34rem;
    max-width: 80vw;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.tabs {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
}

.section {
    border-top: 1px solid #444;
    padding-top: 0.6rem;
    margin-top: 0.7rem;
}

.section:first-of-type {
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
}

.section h4 {
    margin: 0 0 0.45rem 0;
    color: #eee;
    font-size: var(--fBase);
    font-weight: normal;
}

.runtime-settings .json-editor {
    width: 34rem;
    max-width: 80vw;
    height: 18rem;
    background: #111;
    color: #ccc;
    border: 1px solid #555;
    font-family: var(--fFixed);
    font-size: var(--fSmall);
    outline: none;
    resize: vertical;
}

.runtime-settings .json-editor:focus {
    border-color: #888;
}

.runtime-error {
    max-width: 34rem;
    color: #ff8080;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    margin-top: 0.25rem;
}
</style>

<PopupBox box={box}>
    <div class="runtime-settings">
        <div class="tabs">
            <Button label="Form" click={() => setView('form')} active={view === 'form'} />
            <Button label="JSON" click={() => setView('json')} active={view === 'json'} />
        </div>

        {#if view === 'form' && currentSettings}
            <div class="section">
                <h4>Monitor</h4>
                <LabelCheckbox label="log messages" bind:on={currentSettings.monitor.logMessages} />
                <LabelCheckbox label="log timings" bind:on={currentSettings.monitor.logTimings} />
            </div>

            {#if currentSettings.security}
                <div class="section">
                    <h4>Security</h4>
                    <LabelSelect label="mode" bind:value={currentSettings.security.mode} options={securityModeOptions} />
                    <LabelCheckbox label="forward events" bind:on={currentSettings.security.forwardEvents} />
                </div>
            {/if}

            {#if hasPolicySettings(currentSettings)}
                <div class="section">
                    <h4>Default Permissions</h4>
                    <LabelSelect label="file system" bind:value={currentSettings.security.defaults.fs} options={permissionOptions} />
                    <LabelSelect label="network" bind:value={currentSettings.security.defaults.net} options={permissionOptions} />
                    <LabelSelect label="process" bind:value={currentSettings.security.defaults.process} options={permissionOptions} />
                </div>

                <div class="section">
                    <h4>Allow Lists</h4>
                    <LabelTextarea label="network hosts" bind:text={netHostsText} />
                    <LabelTextarea label="file roots" bind:text={fsRootsText} />
                </div>
            {/if}
        {:else}
            <textarea class="json-editor" spellcheck="false" bind:value={settingsText} on:keydown|stopPropagation></textarea>
        {/if}

        {#if settingsError}
            <div class="runtime-error">{settingsError}</div>
        {/if}
    </div>
</PopupBox>
