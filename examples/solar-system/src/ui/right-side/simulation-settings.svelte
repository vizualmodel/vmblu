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

// notation
const simulate = sx
let currentDate = '-'

// if the speed is selected from a dropdonw, recalculate the speed
if (simulate.speed.select.on) calculateSpeed(simulate.speed.select.selected)


// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

const box = {
    div: null,
    title: 'Simulation Settings',
    expanded: true
}   

function speedSlider() {

    // no selection
    if (simulate.speed.select.on) simulate.speed.select.on = false

    // send the speed 
    tx.send('simulation user change',{what: 'speed', simulate})
}

function selectSpeed(selected) {

    // set the select checkbox
    simulate.speed.select.on = true

    // calculate the speed from the description
    calculateSpeed(selected)

    // send the speed 
    tx.send('simulation user change',{what: 'speed', simulate})
}

// The date field only returns valid formatted dates
function startDate(validDate) {

    // change the start date
    simulate.start = validDate

    // send the date
    tx.send('simulation user change',{what:'start date', simulate})

    // if the simulation is not running do a simple render
    if (!simulate.running) tx.send('update step')

    // make sure the date is displayed in a good color
    return true
}

function clickedStartStop() {

    simulate.running = ! simulate.running

    // stop or start the update
    simulate.running ? tx.send('update start') : tx.send('update stop')
}

function speedFromDropdown() {
    simulate.speed.select.on = true
}

function toggleShowOrbit() {
    
    // hid or show the orbit for all planets
    simulate.orbit.on ? tx.send("orbit show","all") : tx.send("orbit hide", "all")
}

function calculateSpeed(selected) {

    // string that contains the speed-up
    const ref = selected.slice(selected.indexOf('=')+1).trim()

    const speed = simulate.speed

    switch(ref) {

        case 'sec': speed.current = 1/(24*60*60)
        break   
        case 'min': speed.current = 1/(24*60)
        break     
        case 'hour': speed.current = 1/24
        break
        case 'day': speed.current = 1
        break           
        case 'week': speed.current = 7
        break        
        case 'month': speed.current= 365.2425/12
        break        
        case 'year':  speed.current= 365.2425
        break        
    }

    // set the speed
    simulate.speed = simulate.speed
}

export const handlers = {

    // values are set from the outside - not by the user
    "-> simulation override"({}) {
    },

    // When a celestial body asks for the current settings
    "-> simulation get"({type, name}) {

        tx.reply(simulate)
    },

    "-> current date"(dateUpdate) {

        // update the field with the current date
        currentDate = dateUpdate
    }
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
        <Label text="Simulation speed" style={mainLabel}/>
        <CheckBoxRound check={simulate.speed.select} changed = {speedFromDropdown} />
        <Label text="" style={leftRight}/>
        <Dropdown dropdown = {simulate.speed.select} select = {selectSpeed}/>
    </SameLine>
    <SameLine>
        <Label text=" " style={mainLabel}/>
        <ValueSlider range={simulate.speed} style={sliderWidth} changed={speedSlider}/>
        <Button text={simulate.running ? "stop" : "start"} style={buttonMargin} click={clickedStartStop}/>
    </SameLine>
    <SameLine>
        <Label text="Start date" style={mainLabel}/>
        <DateInput value={simulate.start} changed={startDate}/>
    </SameLine>
    <SameLine>
        <Label text="Current date" style={mainLabel}/>
        <TextInfoField text={currentDate}/>
    </SameLine>
    <SameLine>
        <Label text="Show orbits" style={mainLabel}/>
        <CheckBoxRound check={simulate.orbit} changed = {toggleShowOrbit} />
    </SameLine>
</SideBox>