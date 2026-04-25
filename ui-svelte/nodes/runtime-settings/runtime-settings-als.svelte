<script>
import SameLine from '../../fragments/same-line.svelte'
import Label from '../../fragments/label.svelte'
import TextField from '../../fragments/text-field.svelte'
import CheckBox from '../../fragments/checkbox.svelte'

export let dx
</script>

<style>
</style>

<SameLine>
    <CheckBox bind:on={dx.logMessages} />
    <Label text="log messages"/>
</SameLine>
<SameLine>
    <CheckBox bind:on={dx.worker.on} />
    <Label text="use worker script:" style="margin-right: 0.5rem;"/>
    <TextField bind:text={dx.worker.path} />
</SameLine>
<SameLine>
    <CheckBox bind:on={dx.safety.on} />
    <Label text="safety instrumentation"/>
</SameLine>
<SameLine>
    <CheckBox bind:on={dx.safety.forward} />
    <Label text="forward `security.event`"/>
</SameLine>
<SameLine>
    <Label text="safety mode:" style="margin-right: 0.5rem;"/>
    <select bind:value={dx.safety.mode}>
        <option value="off">off</option>
        <option value="warn">warn</option>
        <option value="enforce">enforce</option>
    </select>
</SameLine>
