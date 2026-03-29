<script>
import { onMount } from 'svelte'


// properties: title, and array of component, content
export let popup

// the outer div
let mainDiv

onMount(async () => {

	// set the show, hide and update functions
	popup.show = ()=> mainDiv.style.display = 'block'
	popup.hide = ()=> mainDiv.style.display = 'none'
	popup.update = ()=> popup = popup
})

function show(e) { mainDiv.style.display = 'block' }
function hide(e) { mainDiv.style.display = 'none' }
function update(e) {popup = popup}

// this div is movable
function onMouseMove(e) {
    if (e.buttons == 1) {
        mainDiv.style.left = (mainDiv.offsetLeft + e.movementX) + "px"
        mainDiv.style.top =  (mainDiv.offsetTop + e.movementY) + "px"
        e.preventDefault()
    }
}

</script>
<style>

@import './gadget-styles.css';
.mainDiv {
	display: none;
	position:absolute;
	z-index: 1; 
	left: 20%;
	top: 20%;
	width: 20%; 
	overflow: auto; 
	background-color: var(--bgPopup);
	border: 2px solid var(--cBorder);
	border-radius: var(--rBox);
}
.hdr {
	display: block;
	background: var(--bgField);
}
h1 {
	display: inline;
	font-size: var(--sFontL);
	font-weight: normal;
	font-style: italic;
	padding-left: 1rem;
	color: var(--cFont);
}
#exit {
	display: inline;
	float:right;
}
#exit > p {
	font-style:normal;
	font-weight:lighter;
	cursor:pointer;
}
.content {
	display:block;
	width:100%;
}
</style>
<div class="mainDiv" bind:this={mainDiv}>
	<div class="hdr"  on:mousemove={onMouseMove} >
    	<h1>{popup.title}<h1>
    	<div id="exit" on:click={hide} on:keydown={hide}>
      		<p>&nbsp;&#10005;&nbsp;</p>
    	</div>
  	</div>
	<div class="content">     
		<svelte:component this={popup.component} content={popup.content}/>
	</div>
</div>