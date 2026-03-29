<script>

import { onMount } from 'svelte'

// The dropdown descriptor: dropdown = {instruction, choices[]}
export let dropdown = {
	choices:[],
	instruction:'',
	update(){},
	select(){},
	selected: ''
}

let mainDiv
let visible=false

// the arrow at the end of the dropdown
const arrow = "&#9660;"

// css to set dropdown list visible
const showList = "inline-block"
const hideList = "none"

onMount(async () => {
	dropdown.update = update
})

function update(newDropdown) {

	// set the dropdown
	dropdown = newDropdown

	// determine the size of the dropdown
	let maxLength = dropdown.instruction.length
	dropdown.choices.forEach(choice => { if (choice.length > maxLength) maxLength = choice.length})

	//calculate the width - 1rem = 8px ?
	let width = maxLength * 10

	// set the length of the p element
	mainDiv.querySelector("p").style.width = width+"px"

	// set the length of the UL
	mainDiv.querySelector("ul").style.width = width+"px"

		// if there is an instruction... 
	dropdown.instruction.length > 0   	? mainDiv.querySelector("p").innerHTML = dropdown.instruction 
										: mainDiv.querySelector("p").innerHTML = choices[0]	
}

// when clicking on the button we show or remove the dropdown list
let onClickP = (e) => {

	// check if we show or remove
	mainDiv.querySelector("ul").style.display = visible ? hideList : showList

	// toggle
	visible = !visible
}

// when selecting in the ul
let onClickLI = (e) => {

	dropdown.selected = e.target.innerHTML

	// set the button to the selected li
	mainDiv.querySelector("p").innerHTML = dropdown.selected

	// remove the dropdown list
	mainDiv.querySelector("ul").style.display = hideList

	// set visible to false
	visible = false

	// call the selection callback
	dropdown.select?.()
}

// when getting out of the drop down p area
let onMouseLeaveP = (e) => {

	// if nothing is visible - or if we moved into the UL - do nothing
	if ((!visible)||(e.relatedTarget.tagName == "UL" )||(e.relatedTarget.tagName == "P" )) return

	// in any other case remove the dropdown list
	mainDiv.querySelector("ul").style.display = hideList
	visible = false
}

// when getting out of the ul area
let onMouseLeaveUL = (e) => {

	// remove the dropdown list
	mainDiv.querySelector("ul").style.display = hideList
	visible = false
}

function onKeydown(e) {}


</script>
<style>
/* @import './gadget-styles.css'; */

.dropdown {
    /* settings */
	display: inline-flex;
	position:relative;
	background: inherit;
}
p.default-text {
	color: var(--cField);
	background: var(--bgField);
	font-size: var(--sFontM);
	padding: 0 0.2rem 0.1rem 0.2rem;
	cursor: pointer;
	border-radius: var(--rFieldLeft);
}
p.arrow {
	border-radius: var(--rFieldRight);
}
ul {
	display: none;
	position: absolute;
	/* top: 1.1rem; */
	color: var(--cFont);
	background:var(--bgField);
	list-style-type: none;
	font-size: var(--sFontM);
	line-height: 1rem;
	padding: 0.3rem 0.2rem 0.2rem 0.2rem;
	cursor:pointer;
	z-index:1;
	border-radius: var(--rFieldBottom);
	border: solid 1px black;
}
li {
	height:1rem;
}
li:hover{
	background-color:var(--bgInvert);
	color:var(--cFontInvert);
}
</style>
<div class="dropdown" bind:this={mainDiv}>
	<p class="default-text" on:click={onClickP} on:mouseleave={onMouseLeaveP} on:keydown={onKeydown}></p>
	<p class="default-text arrow" on:click={onClickP} on:mouseleave={onMouseLeaveP} on:keydown={onKeydown}>{@html arrow}</p>
	<ul on:mouseleave={onMouseLeaveUL}>
		{#each dropdown.choices as choice}
			<li on:click={onClickLI} on:keydown={onKeydown}>{choice}</li>
		{/each}
	</ul>
</div>