<script>
import RuntimeSettingsAls from './runtime-settings-als.svelte'

export let dx
export let tx
export let runtime
export let modelRuntimeSettings
export let popupPos
</script>

<RuntimeSettingsAls bind:dx {tx} {runtime} {modelRuntimeSettings} {popupPos} />
<h4>Agent broker</h4>
<p>Agent-specific node runtime settings will be added here.</p>
