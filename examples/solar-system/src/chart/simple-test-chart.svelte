<script>
import { onMount } from 'svelte';
import SideBox from '../ui/fragments/side-box.svelte'
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

// The props
export let tx, sx

// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

const box = {
    div: null,
    title: 'Simple Test Chart',
    expanded: true
} 

let chartDiv;
let data = d3.ticks(-2, 2, 200).map(Math.sin);

function onMousemove(event) {
    const [x, y] = d3.pointer(event);
    data = data.slice(-200).concat(Math.atan2(x, y));
}

$: {
    chartDiv?.firstChild?.remove(); // remove old chart, if any
    chartDiv?.append(Plot.lineY(data).plot({grid: true})); // add the new chart
}

export const handlers = {

}
</script>
<style>
.chart-class  {
    display: block;
    color: yellow;
    outline: none;
}
</style>
<SideBox box={box}>
<div class= "chart-class" on:mousemove={onMousemove} bind:this={chartDiv} role="img">
</div>
</SideBox>