<script>
    import { onMount } from 'svelte';

    export let width = '256px'; // Default width of the panel
    export let side = 'right'; // 'right' or 'left'
    export let visible = true

    let panel;

    // Attach and clean up event listeners
    onMount(() => {});

</script>

<style>
    .fixed-width-panel {
        position: absolute; /* Make it absolute to align with its container */
        top: 0;
        height: 100%; /* Occupies the full height of its parent */
        overflow: hidden;
        background: var(--cGreyT, #222); /* Default background color */
        display: flex; /* Enables flexbox for stacking content */
        flex-direction: column; /* Stacks children vertically */
    }

    .fixed-width-panel.right {
        right: 0; /* Align to the right edge of the container */
    }

    .fixed-width-panel.left {
        left: 0; /* Align to the left edge of the container */
    }
</style>

<div
    class="fixed-width-panel {side}"
    bind:this={panel}
    style="width: {width}; display: {visible ? 'flex':'none'};"
>
    <slot></slot> <!-- This allows you to pass content into the panel -->
</div>
