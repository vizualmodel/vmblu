<script>
    import { onMount } from 'svelte';

    export let width = '256px'; // Default width of the panel
    export let side = 'right'; // 'right' or 'left'
    export let visible = true

    let panel;
    let isResizing = false;
    let initialMouseX = 0;
    let initialWidth = 0;

    function handleMouseDown(event) {
        isResizing = true;
        initialMouseX = event.clientX;
        initialWidth = panel.getBoundingClientRect().width;
        document.body.style.cursor = 'ew-resize'; // Change cursor to resize style
    }

    function handleMouseMove(event) {
        if (isResizing) {
            const deltaX = event.clientX - initialMouseX;

            // Adjust the width calculation based on the side of the panel
            const newWidth = side === 'right'
                ? initialWidth - deltaX // Increase width when dragging to the right
                : initialWidth + deltaX; // Increase width when dragging to the right for left-side panel

            if (newWidth > 50) { // Minimum width check to prevent collapsing
                panel.style.width = `${newWidth}px`;
            }
        }
    }

    function handleMouseUp() {
        isResizing = false;
        document.body.style.cursor = ''; // Reset cursor style
    }

    // Attach and clean up event listeners
    onMount(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    });
</script>

<style>
    .resizable-panel {
        position: absolute; /* Make it absolute to align with its container */
        top: 0;
        height: 100%; /* Occupies the full height of its parent */
        overflow: hidden;
        background: var(--cGreyT, #222); /* Default background color */
        display: flex; /* Enables flexbox for stacking content */
        flex-direction: column; /* Stacks children vertically */
    }

    .resizable-panel.right {
        right: 0; /* Align to the right edge of the container */
    }

    .resizable-panel.left {
        left: 0; /* Align to the left edge of the container */
    }

    .resize-handle {
        position: absolute;
        top: 2%; /* Center vertically */
        width: 5px;
        height: 20px;
        background-color: #ff8800; /* Handle color */
        cursor: ew-resize; /* Horizontal resize cursor */
        transform: translateY(-50%); /* Center the handle vertically */
    }

    .resize-handle.right {
        left: 0; /* Handle on the left for the right-side panel */
    }

    .resize-handle.left {
        right: 0; /* Handle on the right for the left-side panel */
    }
</style>
<div
    class="resizable-panel {side}"
    bind:this={panel}
    style="width: {width}; display: {visible ? 'flex':'none'};"
>
    <slot></slot> <!-- This allows you to pass content into the panel -->
    <div class="resize-handle {side}" on:mousedown={handleMouseDown}>
    </div>
</div>
