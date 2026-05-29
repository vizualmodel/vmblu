<script>
import SameLine from '../../fragments/same-line.svelte'
import Label from '../../fragments/label.svelte'
import TextField from '../../fragments/text-field.svelte'
import LabelCheckbox from '../../fragments/label-checkbox.svelte'

export let dx
</script>

<style>
</style>

<h4>Run</h4>
<LabelCheckbox label="use worker script:" bind:on={dx.run.worker.on}>
    <TextField bind:text={dx.run.worker.path} />
</LabelCheckbox>
<h4>Monitor</h4>
<LabelCheckbox label="log messages" bind:on={dx.monitor.logMessages} />
<LabelCheckbox label="log timings" bind:on={dx.monitor.logTimings} />
<h4>Security</h4>
<LabelCheckbox label="custom security settings" bind:on={dx.security.enabled} />
<LabelCheckbox label="forward `security.event`" bind:on={dx.security.forward} />
<SameLine>
    <Label text="security mode:" style="margin-right: 0.5rem;"/>
    <select bind:value={dx.security.mode}>
        <option value="off">off</option>
        <option value="warn">warn</option>
        <option value="enforce">enforce</option>
    </select>
</SameLine>
