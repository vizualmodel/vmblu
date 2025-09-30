<script>
import {onMount} from 'svelte'
import SideBox from '../fragments/side-box.svelte'
import SameLine from '../fragments/same-line.svelte'
import Label from '../fragments/label.svelte'
import LogValueSlider from '../fragments/log-value-slider.svelte'
import ValueSlider from '../fragments/value-slider.svelte'
import CheckBoxRound from '../fragments/checkbox-round.svelte'
import Dropdown from '../fragments/dropdown.svelte'
import DateInput from '../fragments/date-input-field.svelte'
import TextInfoField from '../fragments/text-info-field.svelte'
import Button from '../fragments/button.svelte'

export let tx, sx

const solsys = sx
let currentDate = '-'

// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

const box = {
    div: null,
    title: 'Solar System Settings',
    expanded: true
}   

// The functions to call when settings change
function labelsOnOff() {
    tx.send('presentation user change',{what:'label on/off',solsys})
}

// The functions to call when settings change
function starsOnOff() {
    tx.send('presentation user change',{what:'stars on/off',solsys})
}

function constellationsOnOff() {
    tx.send('presentation user change',{what:'constellations on/off',solsys})
}

function magnifyOnOff() {

    // the checkbox only changed the sun - change the rest also
    const M = solsys.magnify
    M.planet.on = M.moon.on = M.moon.orbit.on = M.sun.on

    // send the message
    tx.send('presentation user change',{what: 'magnify',solsys})
}

function magnifySlider() {

    if (solsys.magnify.sun.on) tx.send('presentation user change',{what: 'magnify',solsys})
}

export const handlers = {

    // values are set from the outside - not by the user
    "-> presentation override"({}) {
    },

    // When a celestial body asks for the current settings
    "-> presentation get"() {

        // return the settings
        tx.reply(solsys)
    },
}
// specific label styles 
const mainLabel = 'width:8rem;'
const leftRight = 'margin-left: 0.5rem; margin-right:0.3rem;'
const sliderWidth = 'width:5rem;'
const buttonMargin = 'margin-left: 0.5rem;'
        
</script>
<style>
</style>
<!-- svelte-ignore a11y-label-has-associated-control -->
<SideBox box={box}>
    <SameLine>
        <Label text="Labels on/off" style={mainLabel}/>
        <CheckBoxRound check={solsys.labels} changed={labelsOnOff}/>
    </SameLine>
    <SameLine>
        <Label text="Stars on/off" style={mainLabel}/>
        <CheckBoxRound check={solsys.stars} changed={starsOnOff}/>
    </SameLine>
    <SameLine>
        <Label text="Constellations on/off" style={mainLabel}/>
        <CheckBoxRound check={solsys.constellations} changed={constellationsOnOff}/>
    </SameLine>
    <SameLine>
        <Label text="Magnify on/off" style={mainLabel}/>
        <CheckBoxRound check={solsys.magnify.sun} changed={magnifyOnOff}/>
    </SameLine>
    <SameLine>
        <Label text="Magnify Sun" style={mainLabel}/>
        <LogValueSlider range={solsys.magnify.sun.size} style={sliderWidth} changed={magnifySlider}/>
    </SameLine>
    <SameLine>
        <Label text="Magnify Planets" style={mainLabel}/>
        <LogValueSlider range={solsys.magnify.planet.size} style={sliderWidth} changed={magnifySlider}/>
    </SameLine>
    <SameLine>
        <Label text="Magnify Moons" style={mainLabel}/>
        <LogValueSlider range={solsys.magnify.moon.size} style={sliderWidth} changed={magnifySlider}/>
    </SameLine>
    <SameLine>
        <Label text="Magnify Moon orbits" style={mainLabel}/>
        <LogValueSlider range={solsys.magnify.moon.orbit.size} style={sliderWidth} changed={magnifySlider}/>
    </SameLine>
</SideBox>