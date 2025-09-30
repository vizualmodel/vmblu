<script>
import {onMount} from 'svelte'
import SideBox from '../fragments/side-box.svelte'
import Label from '../fragments/label.svelte'
import InlineIcon from '../fragments/inline-icon.svelte'
import SameLine from '../fragments/same-line.svelte'
import TextInfoField from '../fragments/text-info-field.svelte'
import Dropdown from '../fragments/dropdown.svelte'
import DropdownInput from '../fragments/dropdown-input.svelte'
import LogValueSlider from '../fragments/log-value-slider.svelte'
import CheckBoxRound from '../fragments/checkbox-round.svelte'

export let tx, sx

// when mounting
onMount(() => {

    // make the canvas known to the studio
    tx.send('div', box.div)
})

const box = {
    div: null,
    title: 'Cameras',
    expanded: true
}   

// The settings structure for a camera
const uiCamera = {
    all: {
        selected: 'create a camera',
        choices: [],
    },
    //newName : null,
    controls: null,
    helpers : {
        on: false,
    },
    types: {
        selected: 'perspective',
        choices: ['orthographic', 'perspective']
    },
    far: {min:0.001, max:1000, current:1},
    near: {min:0.0000001, max:1000, current:0.01},
    fov: {min:30, max:120, current:45},
    zoom:{min:0.01, max:100, current: 1},
    aspect: {
        selected: 'canvas',
        choices: ['canvas','16:9', '4:3', '21:9']
    }
}

export const handlers = {

    "-> list"(list) {

        // set the choices list
        uiCamera.all.choices = list

        // check
        if (list.length == 0) return

        // if the currently selected camera is in the list, keep it, otherwise take the first.
        uiCamera.all.selected = list.includes(uiCamera.all.selected) ? uiCamera.all.selected : list[0]

        // send the selection to get the parameters for this camera
        tx.send('user select', uiCamera.all.selected)

        // not a new camera...
        //uiCamera.newName = null
    },

    "-> settings"({definition, controls}) {

        // copy the values to the ui settings
        copyToUI(definition, controls)
    },

}

function copyToUI(definition, controls) {

    // copy the values to the ui settings
    uiCamera.types.selected = definition.type
    uiCamera.near.current = definition.near
    uiCamera.far.current = definition.far
    uiCamera.fov.current = definition.fov
    uiCamera.aspect.selected = definition.aspect
    uiCamera.zoom.current = definition.zoom  
    uiCamera.controls = controls
}

function selectCamera(selection) {

    // check if the new name is in the list - it could have been typed
    for(const name of uiCamera.all.choices) {

        if (selection != name) continue

        // hide the add-icon
        //uiCamera.newName = null

        // request the uiCamera for this camera
        tx.send("user select",selection)
        
        // nothing else to do
        return
    }

    // it is a new name - show the add-icon
    //uiCamera.newName = selection
}

function changeCameraType(selection) {
    // reactive 
    uiCamera.types.selected = selection
}

function updateCamera() {

    // if we are working on new camera no update 
    // if (uiCamera.newName) return

    // transmit the update
    tx.send('user update', { 
            near: uiCamera.near.current,
            far: uiCamera.far.current,
            fov: uiCamera.fov.current,
            zoom: uiCamera.zoom.current,
            aspect: uiCamera.aspect.selected
        })
}
/*
function onAdd() {

    const newCamera = { 
            name: uiCamera.newName,
            type: uiCamera.types.selected,
            near: uiCamera.near.current,
            far: uiCamera.far.current,
            fov: uiCamera.fov.current,
            zoom: uiCamera.zoom.current,
            aspect: uiCamera.aspect.selected
        }

    // check the values, and send if ok
    if (checkCameraValues(newCamera)) tx.send('user.add', newCamera)
}

function onDelete() {

    tx.send('user.delete', {name:uiCamera.names.selected})
}
*/
function checkCameraValues({name,type,near,far,fov,zoom,aspect}) {

    // near and far must be positive
    if (near < 0 || far < 0) return false

    // near must be smaller than far
    if (near > far) return false

    // zoom must be reasonable
    if (zoom < 0 || zoom > 1000000) return false

    return true
}

function check() {
}

function helpersOnOff() {
    uiCamera.helpers.on ? tx.send('show helpers') : tx.send('hide helpers')
}

// specific label styles 
const lab1 = 'width:4rem;'
const lab2 = 'margin-right:0.5rem;'
const lab3 = 'margin-left: 0.5rem; margin-right:0.3rem;'

// slider width
const sliderWidth = 'width:4rem;'
   
</script>
<style>
.camera-group {
    margin-left: 4rem;
}
</style>
<!-- svelte-ignore a11y-label-has-associated-control a11y-no-static-element-interactions a11y-click-events-have-key-events-->
<SideBox box={box}>

    <SameLine>
        <Label text='Name' style={lab1}/>
        <Dropdown dropdown = {uiCamera.all} select = {selectCamera}/>
    </SameLine>
    <SameLine>
        <Label text='Type' style={lab1}/>
        <TextInfoField text={uiCamera.types.selected} />
    </SameLine>
    <SameLine>
        <Label text="Controls" style={lab1}/>
        <TextInfoField text={uiCamera.controls} />
    </SameLine>
    <SameLine>
        <Label text="Show" style={lab1}/>
        <CheckBoxRound check={uiCamera.helpers} changed={helpersOnOff}/>
    </SameLine>
    <SameLine>
        <Label text="Parameters" style={lab1}/>
    </SameLine>
    <div class="camera-group">
        <SameLine> 
            <Label text='near' style={lab2}/>
            <LogValueSlider range={uiCamera.near} style={sliderWidth} changed={updateCamera}/>
            <Label text='far' style={lab3}/>
            <LogValueSlider range={uiCamera.far} style={sliderWidth}  changed={updateCamera}/>
        </SameLine>
        <SameLine>
            <Label text='aspect ratio' style={lab2}/>
            <Dropdown dropdown = {uiCamera.aspect} select = {updateCamera}/>
        </SameLine>
        <SameLine>
            <Label text='zoom' style={lab2}/>
            <LogValueSlider range={uiCamera.zoom} style={sliderWidth}  changed={updateCamera}/>
        </SameLine>
        {#if uiCamera.types.selected == 'perspective'}
            <SameLine>
                <Label text='field of view' style={lab2}/>
                <LogValueSlider range={uiCamera.fov} style={sliderWidth}  changed={updateCamera}/>
            </SameLine>
        {/if}
    </div>
</SideBox>