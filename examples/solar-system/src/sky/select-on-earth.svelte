<script>
import { onMount } from 'svelte';
import * as THREE from 'three'
import {SelectOnEarth} from './select-on-earth'
import SameLine from '../ui/fragments/same-line.svelte'
import Label from '../ui/fragments/label.svelte'
import TextInputField from '../ui/fragments/text-input-field.svelte'
import { parseCoordinates, formatCoordinates} from '../sky/equations-and-constants'

export let tx, sx

let selector = null
let container
let squareCanvas

const planet = 'earth'
let camera = null
let camSpec = null

onMount( () => {

    // get a canvas for the rotating earth
    tx.request('add canvas', container).then( () => {

        // only initialize when the canvas is added to the screen - otherwise the size is 0,0
        selector = new SelectOnEarth(squareCanvas, sx)
    })

    // get the settings for the earth cam
    camSpec = sx.planetCameras[0]

    // the location is a string with the coordinates of the camera, so we use this for the moment
    const location = {
        position : new THREE.Vector3(1,1,1), 
        lookAt : new THREE.Vector3(0,0,0)
    }

    // modify the parameters to include the temporary location
    // const modified = {...camSpec}
    // modified.location = location

    // get a camera to place on earth
    tx.request('get camera', {definition: camSpec.definition, location, controls: camSpec.controls}).then( (newCamera) => {

        // save the camera
        camera = newCamera

        // send it to the planet
        tx.send('place camera', {planet, coordinates: camSpec.location.coordinates, camera})

        // check that the coordinates are ok
        const { latitude, longitude }  = parseCoordinates(camSpec.location.coordinates)

        // returning false 
        if (! latitude || !longitude) return

        // place the cone
        selector?.placeOnEarth(latitude, longitude)        
    })
})

const labelStyle = 'width:8rem;'

// The field with the coordinates of the camera
let coordField = {

    value: '',
    check: (coordString) => {

        // check that the coordinates are ok
        const { latitude, longitude }  = parseCoordinates(coordString)

        // returning false 
        if (! latitude || !longitude) return false

        // The coordinates are ok...
        selector?.placeOnEarth(latitude, longitude)

        // change the coordinates
        camSpec.location.coordinates = coordString

        // update the camera on the planet in the simulation
        tx.send('place camera', {planet, coordinates: camSpec.location.coordinates, camera})

        // done
        return true
    }
}

// when double clicking on the sphere, place the camera there
function doubleClick(e) {

    // get the point wher the mouse has clicked
    const intersection = selector.mouseIntersection(event.clientX, event.clientY);

    // check
    if (!intersection) return

    // if the earth is turning we have to counterrotate
    selector.counterRotate(intersection)

    // get latitude and longitude
    const { latitude, longitude }  = selector.vectorToCoordinates(intersection)

    // Place the cone on the earth
    selector?.placeOnEarth(latitude, longitude)

    // get the string
    const coordinates = formatCoordinates(latitude, longitude)

    // set the field
    coordField.value = coordinates

    // change the coordinates of the earth camera 
    camSpec.location.coordinates = coordinates

    // update the earth camera on the planet in the simulation
    tx.send('place camera', {planet, coordinates, camera})
}

</script>
<style>
    
#container {

    width: 100%; /* Full width or any desired width */
    position: relative; /* Make the container a positioning context */
}

#squareCanvas {
    width: 100%; 
    aspect-ratio: 1 / 1; 
    display: block; 
}

#overlayDiv {
    position: absolute;
    bottom: -25px;
    left: 0;
    width: 60%;
    margin-left: 20%;
}
p.introText {
    width: 100%; 
    font-family: var(--fFamily, sans-serif);
    font-size: var(--fSmall, 0.8rem);
    color: var(--cLabel, #ffffff);
    box-sizing: border-box; /* Include padding in the width calculation */
    user-select:none;
}
span {
    margin-right:4rem;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={container} id="container">
    <canvas bind:this={squareCanvas} id="squareCanvas" on:dblclick={doubleClick}></canvas>
    <div id="overlayDiv">
        <p class="introText">
            Enter the coordinates of the earth camera or double-click
            on the earth globe : dd°mm'ss.s N/S dd°mm'ss.s E/W. Minutes and seconds are optional.
        </p>
        <span></span><TextInputField field={coordField} />
    </div>
</div>

  