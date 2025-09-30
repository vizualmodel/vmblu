<script>
import { onMount } from 'svelte';
import {RingBuffer} from './ring-buffer'
import SideBox from '../ui/fragments/side-box.svelte';
import * as d3 from 'd3';
import {julianDateFromUTC} from '../sky/equations-and-constants'

// The props
export let tx, sx;

// some constants 
const mSecPerDay = 24*60*60*1000
const mSecPerYear = 365*mSecPerDay
const julianDate_jan_1_1970 = 2440587.5

// the definition and parts of the chart
const margin = { top: 20, right: 30, bottom: 30, left: 40 }
const width = 600 - margin.left - margin.right
const height = 400 - margin.top - margin.bottom

// make a new time chart
let chart = null
let chartDiv = null

// when mounting
onMount(() => {
    tx.send('div', box.div);
    chart = new Chart(chartDiv,width, height, margin)
    chart.init();
});

// The data that we keep for each planet
function PlanetSettings(name) {
    this.name = name,
    this.color = '#ffffff',
    this.tracking = false
    this.ringBuffer = new RingBuffer(width)
}

// The container for the chart
const box = {
    div: null,
    title: 'Distance of the selected planets to planet earth',
    expanded: true,
};

// the position of the reference planet
let posEarth = null;


function Chart(div, width, height, margin) {

    this.margin = margin
    this.width = width
    this.height = height

    this.div = div
    this.svg = null
    this.legend = null

    this.active = false
    this.newData = false

    this.x = new xAxis(width)
    this.y = new yAxis()
    this.lineGen= null
    this.lines= []
}
Chart.prototype = {

    init() {

        // add a legend container
        this.legend = d3   .select( this.div)
                            .append('div')
                            .attr('class', 'legend-container')
                            .style('display', 'flex')
                            .style('flex-wrap', 'wrap');

        // The div that will contain the chart
        this.svg = d3
            .select( this.div)
            .append('svg')
            .attr('width',  this.width +  this.margin.left +  this.margin.right)
            .attr('height',  this.height +  this.margin.top +  this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${ this.margin.left},${ this.margin.top})`);

        // append an x-axis
        this.x.axis =  this.svg    .append('g')
                                    .attr('transform', `translate(0,${ this.height})`)
                                    .attr('class', 'axis');

        // Define scales
        this.x.scale = d3  .scaleTime()
                            .range([0,  this.width]);

        // append gridlines
        this.svg   .append('g')
                    .attr('class', 'grid x-grid')
                    .attr('transform', `translate(0,${ this.height})`)

        // adjust the x axis
        this.x.update( this.height,  this.svg)

        // the y-axis
        this.y.axis =  this.svg    .append('g')
                                    .attr('class', 'axis');

        // the scale
        this.y.scale = d3  .scaleLinear()
                            .range([ this.height, 0]);

        // Add horizontal gridlines (one per 0.2 AU)
        this.svg   .append('g')
                    .attr('class', 'grid y-grid')

        // update the y-axis
        this.y.update( this.width,  this.svg)

        // Define the line generator
        this.lineGen = d3
            .line()
            .x((d) =>  this.x.scale(d.time))
            .y((d) =>  this.y.scale(d.distance));

        // Append a line path for each planet
        this.lines = {};

        // Add scroll event listener to the x-axis div to adjust the x-range
        d3  .select( this.div)
            .on('wheel', function (event) {
                            event.preventDefault();
                            this.x.adjustRange(event.deltaY);
                            this.update();
                        });
    },

    addLine(planet) {

        // If the planet is not being tracked, set it grey
        const planetSettings = planetData.get(planet)
        const color = planetSettings?.color ?? '#444'

        this.lines[planet] = this.svg
            .append('path')
            .datum([])
            .attr('class', 'line')
            .style('stroke', color) 
            .style('fill', 'none');

        // Add legend entry with toggle functionality
        this.legend.append('div')
            .attr('class', 'legend-item')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('margin-right', '10px')
            .style('cursor', 'pointer')
            .style('opacity', planetSettings?.tracking ? 1.0 : 0.25)
            .html(`<div style='width: 0.5rem; height: 0.5rem; background-color: ${color}; margin-right: 8px;'></div> <span>${planet}</span>`)
            .on('click',function() {onClickLegend(this, planet)});
    },

    update() {

        if (! this.newData) return;

        // Prepare the filtered data for rendering without overwriting the RingBuffer
        const renderingData = new Map();

        // Get the data from the ringbuffer as a continuous array
        for (let [planet, data] of planetData) {
            if (data.tracking) renderingData.set(planet, data.ringBuffer.asArray());
        }

        // Adapt the axes if required
        if ( this.x.change)  this.x.update( this.height, this.svg)
        if ( this.y.change)  this.y.update( this.width, this.svg)

        // Update the line paths for each planet using the filtered data
        for (let [planet, data] of renderingData) {
            if (data.length > 0)  this.lines[planet].datum(data).attr('d',  this.lineGen);
        }

         this.newData = false;
    }
}

function xAxis(width) {

        this.width = width

        // timeframe
        this.start = 0
        this.end = 0
        this.delta = 0
        this.next = 0

        this.change = false
        this.axis = null
        this.scale = null
}
xAxis.prototype = {

    // time is unix time
    setRange(time) {

        const x = this

        x.start = time
        x.end = x.start + mSecPerYear;
        x.change = true

        // calculate the delta time
        x.delta = (x.end - x.start) / this.width

        // The next sample we will accept
        x.next = time
    },

    // adjust the x-scale as a gliding scale
    update(height, chartSvg) {

        const x = this

        x.scale.domain([x.start, x.end])

        x.axis.call( d3 .axisBottom(x.scale)
                        .tickFormat(d3.timeFormat('%b \'%y')));

        chartSvg    .select('.grid.x-grid')
                    .call(d3    .axisBottom(x.scale)
                                .tickFormat('')
                                .tickSize(-height)
                                .ticks(d3.timeMonth))
                    .style('color', '#333');

        x.change = false
    },

    // Adjust the range of x-axis when scrolling with the mouse wheel
    adjustRange(delta) {

        // notation
        const x = this

        // wider or narrower
        const k = delta > 0 ? 1.1 : 0.9;

        // keep start, but adapt end
        x.end = x.start + (x.end - x.start) * k;

        // also adapt the delta time
        x.delta *= k

        // set flag
        x.change = true;
    },
}

function yAxis() {

    this.min = 0
    this.max = 0
    this.change = false
    this.axis =null
    this.scale = null
}
yAxis.prototype = {

    update(width, chartSvg) {

        const y = this

        y.scale.domain([y.min, y.max])

        y.axis.call(d3  .axisLeft(y.scale)
                        .tickFormat(d => `${d} AU`));

        chartSvg    .select('.grid.y-grid')
                    .call(d3    .axisLeft(y.scale)
                                .tickFormat('')
                                .tickSize(-width)
                                .ticks(8))
                    .style('color', '#333');

        y.change = false
    }
}

// here we keep the data relative to the planets we are tracking
const planetData = (()=>{

    const map =new Map()
    for(const planet of sx.planets) {

        // get a data collector 
        const settings = new PlanetSettings(planet)

        // we will track these planets
        settings.tracking = true

        // save in the map
        map.set(planet, settings)
    }
    return map
})()

// The handlers
export const handlers = {
    
    // Here we receive the planets we could track
    '-> setup'({name, type, color}) {

        // only planets
        if (type != 'planet') return

        // check if we have the planet settings already
        let planetSettings = planetData.get(name)

        // create an entry for the planet
        if (!planetSettings) {

            planetSettings = new PlanetSettings(name)
            planetData.set(name, planetSettings)
        }
        // change the hex color value to a string
        planetSettings.color = '#' + color.toString(16).slice(2)

        // make sure we can select it
        if (! chart.lines[name]) chart.addLine(name)
    },

    '-> user change'({what, simulate}) {

        // We just react to a change of starting date
        if (what != 'start date') return

        // calculate julian date
        const timestamp = (julianDateFromUTC(simulate.start) - julianDate_jan_1_1970) * mSecPerDay;

        // set a new range
        chart.x.setRange(timestamp)

        // update the x-axis
        chart.x.change = true
        //chart.x.update(chart.height, chart.svg)

        // reset the ringbuffers
        for(const planet in planetData.values()) planet.ringBuffer.reset()
    },

    // time is the julian time !
    '-> position'({ name, time, pos }) {

        // Convert Julian Date to JavaScript Timestamp
        const timestamp = (time - julianDate_jan_1_1970) * mSecPerDay;

        // Save the most recent Earth position
        if (name === 'Earth') {

            // save the starting time for the graph
            if (!chart.active) {
                chart.x.setRange(timestamp)
                chart.active = true
            }

            // save the position of the earth if later then needed
            if (timestamp >= chart.x.next) {
                posEarth = pos;
                chart.x.next += chart.x.delta;
            }
            return;
        }

        // we should have a reference position
        if (!posEarth) return;

        // check if we are tracking the planet
        const planetSettings = planetData.get(name)
        if (! planetSettings?.tracking) return;

        // Retrieve the ring buffer for the planet
        let planetBuffer = planetSettings.ringBuffer

        // notation
        const x = chart.x
        const y = chart.y

        // check
        if (timestamp < x.next) return;

        // Calculate the distance from Earth
        const distance = Math.hypot(
            posEarth.x - pos.x,
            posEarth.y - pos.y,
            posEarth.z - pos.z
        );

        // adapt the max distance as required
        if (distance > y.max) {
            y.max = distance
            y.change = true
        }

        if (timestamp > x.end) {
            x.start = timestamp - (x.end - x.start)
            x.end = timestamp
            x.change = true
        }

        // Add the new data to the ring buffer
        planetBuffer.add({ time: timestamp, distance });
        chart.newData = true;
    },
}

// when clicking on an item in the legend
function onClickLegend(legendItem, planet) {

    // Check if we have the data for the planet
    const planetSettings = planetData.get(planet)
    if (!planetSettings) return;

    // toggle
    if (planetSettings.tracking) {

        planetSettings.tracking = false
        d3.select(legendItem).style('opacity', 0.5);
    }
    else {

        planetSettings.tracking = true
        d3.select(legendItem).style('opacity', 1);
    }
}
   
// Reactively update the chart when data changes
$: if (chart?.newData) chart.update();


</script> 
<style>
.chart-class {
    display: block;
    color: var(--cLabel, #ffffff);
    font-family: Arial, sans-serif;
    font-size: 0.7rem;
    outline: none;
}
.legend-container {
        display: flex;
        flex-wrap: wrap;
        margin-bottom: 10px;
}
.legend-item {
    display: flex;
    align-items: center;
    margin-right: 10px;
    cursor: pointer;
}
</style>
<SideBox box={box}>
    <div class="chart-class" bind:this={chartDiv}></div>
</SideBox>