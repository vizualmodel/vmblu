<script>
import {onMount} from 'svelte'
import SideBox from '../fragments/side-box.svelte'
import SameLine from '../fragments/same-line.svelte'
import Label from '../fragments/label.svelte'
import LogValueSlider from '../fragments/log-value-slider.svelte'
import CheckBoxRound from '../fragments/checkbox-round.svelte'

export let tx, sx

// sx = 


// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

const box = {
    div: null,
    title: '3D helper tools',
    expanded: true
}   

const axes = {
    visible: {on: false},
    size: {min:0.01, max:100, current: 1}
}

const grid = {
    x: { on:false},
    y: { on:false},
    z: { on:false},
    size : { min:1, max:100, current:10},
    divisions: { min:1, max:100, current:10},
}

function axesChanged() {
    tx.send('axes change',{on: axes.visible.on, size: axes.size.current})
}

function gridChanged() {
    tx.send('grid change',{x: grid.x.on, y: grid.y.on, z: grid.z.on, size: grid.size.current, divisions: grid.divisions.current} )
}

export const handlers = {

    // this sets the initial values 
    "-> axes set"({on, size}) {

        axes.visible.on = on
        axes.size.current = size

        // axesChanged()
    },

    "-> grid set"({x,y,z,size, divisions}) {

        grid.x.on = x
        grid.y.on = y
        grid.z.on = z
        grid.size.current = size
        grid.divisions.current = divisions

        // gridChanged()
    }
}
// specific label styles 
const lab1 = 'width:4rem;'
const lab2 = 'margin-left:0rem;'
const lab3 = 'margin-left:0.8rem;'
const lab4 = 'margin-right:0.5rem;'
const lab5 = 'margin-left: 0.5rem; margin-right:0.3rem;'
    
</script>
<style>
</style>
<!-- svelte-ignore a11y-label-has-associated-control -->
<SideBox box={box}>
    <SameLine>
        <Label text="Axes" style={lab1}/>
        <Label text="on" style={lab2}/><CheckBoxRound check={axes.visible} changed={axesChanged}/>
        <Label text="size" style={lab5}/><LogValueSlider range={axes.size} style='width:5rem' changed={axesChanged}/>
    </SameLine>
    <SameLine>
        <Label text="Grid" style={lab1}/>
        <Label text="x" style={lab2}/><CheckBoxRound check={grid.x} changed={gridChanged}/>
        <Label text="y" style={lab3}/><CheckBoxRound check={grid.y} changed={gridChanged}/>
        <Label text="z" style={lab3}/><CheckBoxRound check={grid.z} changed={gridChanged}/>
    </SameLine>
    <SameLine>
        <Label text="" style={lab1}/>
        <Label text="size" style={lab4}/><LogValueSlider range={grid.size} style='width:4rem'changed={gridChanged}/>
        <Label text="divisions" style={lab5}/><LogValueSlider range={grid.divisions} style='width:4rem' changed={gridChanged}/>
    </SameLine>
</SideBox>