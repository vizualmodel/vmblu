<script>
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
