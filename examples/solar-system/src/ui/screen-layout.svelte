<script>
    import { onMount , tick} from 'svelte';
    import { theme } from './theme.js';
    import ResizablePanel from './fragments/resizable-panel.svelte'; 
    import FixedWidthPanel from './fragments/fixed-width-panel.svelte'; 

    export let tx, sx;

    let main;
    let canvas;
    let chart;
    let menu;
    let timeline;
    let io;
    let leftSide;

    // a variable to keep track of which panels have to be shown
    const show = {
        left: true,
        right:true
    }

    // When mounting
    onMount(() => {
        // Initial adjustment
        adjustLayout();

        // Make the main canvas known to the studio
        tx.send('canvas', canvas);
    });

    export const handlers = {
        "-> menu"(div) {
            menu.append(div)
        },

        "-> timeline"(div) {
        },

        "-> modal div"(div) {
            main.append(div);
        },

        "-> right side add div"(div) {
            io.append(div);
        },

        "-> right side toggle"() {
            show.right = !show.right
        },

        "-> left side canvas"(div) {

            // add the div that contains a canvas
            leftSide.append(div);

            // reply to the request 
            tx.reply()
        },
        "-> left side chart"(div) {
            chart.append(div);
        },

        "-> left side toggle"() {
            show.left = !show.left
        },


    };

    function adjustLayout() {
        // Set the size of the main element to match the visual viewport
        main.style.width = `${visualViewport.width}px`;
        main.style.height = `${visualViewport.height}px`;

        // Position the main element to stay within the visual viewport
        main.style.left = `${visualViewport.offsetLeft}px`;
        main.style.top = `${visualViewport.offsetTop}px`;
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            // Pause the simulation when the tab is hidden
            console.log("Tab is hidden, pausing simulation.")
            tx.send('visible stop')
        } else {
            // Resume the simulation when the tab becomes visible
            console.log("Tab is visible, resuming simulation.")
            tx.send('visible start')
        }
    }

    // Attach event listeners to handle resize and scroll events
    window.visualViewport.addEventListener('resize', adjustLayout);
    window.visualViewport.addEventListener('scroll', adjustLayout);

    // add a handler for when the tab is no longer visible
    document.addEventListener('visibilitychange', handleVisibilityChange)

</script>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden; /* Hide any overflow */
        display: flex;
        justify-content: center;
        align-items: center;
    }

    /* Other custom styles */
    :root {
        /* Fonts */
        --fFamily: Tahoma, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        --fFixed: 'Courier New', Courier, monospace;
        --fBig: 1.2rem;
        --fNormal: 0.9rem;
        --fSmall: 0.7rem;

        /* Colors */
        --cHeaders: #ff8800;
        --cSection: hsl(210, 86%, 53%);
        --cInput: #00aeff;
        --cLabel: #88c6ff;
        --cGreyT: #20203088;

        --cSelected: #00ffff;
        --cNotSelected: #00ffff80;
    }

    #main-screen {
    }

    #main-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    #menu-container {
        display:flex;
        flex-direction: row;
        position: absolute;
        top: 1rem;
        right: 25rem;
    }

    .div-container {
        display: flex;
        flex-direction: column; /* Stack children vertically */
        gap: 10px; /* Optional: spacing between items */
        padding: 10px; /* Optional: internal padding */
        width: 100%; /* Ensure the container takes the full width of the parent */
    }

    h1 {
        font-family: var(--fFamily);
        font-size: var(--fMedium);
        color: var(--cHeaders);
        margin: 0.3rem;
    }
</style>

<div id="main-screen" bind:this={main}>
    <canvas bind:this={canvas} id="main-canvas"></canvas>
    <div bind:this={menu} id="menu-container"></div>
    <ResizablePanel width="600px" side="left" visible={show.left}>
        <div bind:this={chart} class="div-container">
            <h1>Charts</h1>
        </div>
        <div bind:this={leftSide} class="div-container">
        </div>
        <!-- <canvas bind:this={leftCanvas} id="left-canvas"></canvas> -->
    </ResizablePanel>
    <FixedWidthPanel width="20rem" side="right" visible={show.right}>
        <div bind:this={io} class="div-container">
            <h1>Settings</h1>
        </div>
    </FixedWidthPanel>
</div>
