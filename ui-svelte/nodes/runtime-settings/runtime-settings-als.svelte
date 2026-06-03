<script>
import TextField from '../../fragments/text-field.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'
import Button from '../../fragments/button.svelte'
import NodeSecuritySettings from './node-security-settings.svelte'

export let dx
export let tx
export let runtime
export let modelRuntimeSettings
export let popupPos

let securitySettingsPopup

function showSecuritySettings() {
    dx.security.enabled = true
    dx = {...dx}

    securitySettingsPopup.show({
        runtime,
        security: dx.security,
        modelRuntimeSettings,
        pos: securityPopupPosition(),
        ok: security => {
            dx = {
                ...dx,
                security,
            }
        },
    })
}

function securityPopupPosition() {
    const pos = popupPos ?? {x: 40, y: 40}
    return {
        x: (pos.x ?? 40) + 24,
        y: (pos.y ?? 40) + 24,
    }
}
</script>

<h4>Run</h4>
<LabelCheckbox label="use worker script:" bind:on={dx.run.worker.on}>
    <TextField bind:text={dx.run.worker.path} />
</LabelCheckbox>
<h4>Monitor</h4>
<LabelCheckbox label="log messages" bind:on={dx.monitor.logMessages} />
<LabelCheckbox label="log timings" bind:on={dx.monitor.logTimings} />
<h4>Security</h4>
<LabelCheckbox label="custom security settings" bind:on={dx.security.enabled}>
    <Button label="settings" click={showSecuritySettings} disabled={!dx.security.enabled} />
</LabelCheckbox>

<NodeSecuritySettings bind:this={securitySettingsPopup} {tx} />
