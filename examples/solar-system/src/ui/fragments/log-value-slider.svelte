<script>
    import { onMount } from 'svelte';

    export let range;
    export let style;
    export let changed;

    let slider;
    let input;

    // spread the slider input over a larger interval (see below)
    const factor = 100;

    // not used her yet
    const integerRegex = /^[+-]?\d+$/;
    const floatRegex = /^[+-]?(\d*\.\d+|\d+\.?\d*)([eE][+-]?\d+)?$/;

    onMount(() => {
        updateSliderPosition()
    });

    // Reactive statement to update slider value when range.current changes
    $: updateSliderPosition();

    function onInput(e) {

        // Check if the input is a valid floating-point number
        if (!floatRegex.test(input.value)) {

            // If invalid characters are present, clean the input
            input.value = input.value.replace(/[^0-9eE.+-]/g, "");
        }

        // Handle empty input case separately
        if (input.value === "") {
            range.current = "";  // Set range.current to an empty string
            return
        } 

        // parse
        const inputValue = parseFloat(input.value);

        // check the range
        range.current = inputValue < range.min ? range.min : (inputValue > range.max ? range.max : inputValue)

        // Reflect the input value in the input field
        input.value = (range.current !== "") ? range.current.toLocaleString() : "";

        // Call the callback function if defined
        changed?.();

        // Update the slider position after input change
        updateSliderPosition();
    }

    function onSliderInput(e) {
        // Calculate the real slider value, which is clamped to the min-max range
        const sliderValue = Math.pow(10, +slider.value / factor);
        const scale = Math.pow(10, Math.round(+slider.value / factor) - 1);

        // Round and update the range.current value
        range.current = scale * Math.round(sliderValue / scale);

        // Update the input value to reflect the clamped slider value
        input.value = range.current.toLocaleString();

        // Call the callback function if defined
        changed?.();
    }

    function updateSliderPosition() {

        if (slider && (range.current !== "")) {

            // Clamp range.current to be within the min-max range for the slider
            const clampedValue = Math.max(range.min, Math.min(range.max, range.current));
            slider.value = Math.log10(clampedValue) * factor;
        }
    }
</script>

<style>
.value-slider {
    --bgFocus:#000;
    --cField: var(--cInput, #ffffff);
    --cSlider: var(--cLabel, #aaaaaa80);

    display: inline-flex; 
    position: relative;
    align-items: center;
    background: transparent;
}
input {
    background: #00000088;
    color: var(--cField);
    font-family: var(--fFixed);
    font-size: var(--fSmall);
    height: 0.7rem;
    cursor: text;
    outline: none;
    border: none;
}
input:focus {
    background: var(--bgFocus);
}
.slider {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    height: 0.0001rem;
    appearance: none;
    pointer-events: none;
    outline: none;
    background:transparent;
}
.slider::-webkit-slider-thumb {
    width: 0.3rem;
    height: 1.0rem;
    appearance: none;
    background: var(--cSlider);
    cursor: e-resize;
    pointer-events: auto;
}
</style>

<!-- svelte-ignore a11y-label-has-associated-control -->
<div class="value-slider">
    <input bind:this={input} style={style} type="text" spellcheck="false" value={range.current} on:input={onInput}>
    <input bind:this={slider} style={style} class="slider" type="range" min={Math.log10(range.min) * factor} max={Math.log10(range.max) * factor} on:input={onSliderInput}>
</div>
