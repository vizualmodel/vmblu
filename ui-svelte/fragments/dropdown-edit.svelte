<script>

import { onMount } from 'svelte'

// The dropdown descriptor: dropdown = {instruction, choices[]}
export let dropdown = {
	instruction:'',
	choices:[],
	selected: '',			// what is in the inputfield
	select(){},				// function is set by the caller
	update(){},				// function set by the dropdown (see onMount)
	setColor(){},			// idem
	setFocus(){}			// idem
}

let mainDiv
let visible=false
let inputField
let savedColor = "white"

// the arrow at the end of the dropdown
const arrow = "&#9660;"

// css to set dropdown list visible
const showList = "inline-block"
const hideList = "none"

onMount(async () => {
	dropdown.update = update
	dropdown.setColor = setColor
	dropdown.setFocus = setFocus

    // save the good color
    savedColor = inputField.style.color
})

function update(newDropdown) {

	// set the dropdown
	dropdown = newDropdown

	// determine the size of the dropdown
	let maxLength = dropdown.instruction?.length ?? 0
	dropdown.choices.forEach(choice => { if (choice.length > maxLength) maxLength = choice.length})

	//calculate the width - 1rem = 8px ?
	let width = maxLength * 10

	// set the length of the p element
	mainDiv.querySelector("input").style.width = width+"px"

	// set the length of the UL
	mainDiv.querySelector("ul").style.width = width+"px"

	// set the input field
    inputField.value = dropdown.instruction?.length > 0 ? dropdown.instruction  : dropdown.choices[0]

	// the current selection is
	dropdown.selected = inputField.value

	// call the selection function
	dropdown.select?.()
}

function setColor(color) {
	inputField.style.color = color
}

function setFocus() {
	inputField.focus()
}

// change the color to normal when clicking on the input field
function onClickInput(e){
	inputField.style.color = savedColor
}

// input field loses focus
function onFocusOut(e) {
	dropdown.selected = inputField.value
}

function onClickArrow(e){

	// check if we show or remove
	mainDiv.querySelector("ul").style.display = visible ? hideList : showList

	// toggle
	visible = !visible
}

// when selecting in the ul
function onClickLI(e){

	// get the selection
	dropdown.selected = e.target.innerHTML

	// set the button to the selected li
	inputField.value = dropdown.selected

	// remove the dropdown list
	mainDiv.querySelector("ul").style.display = hideList

	// set visible to false
	visible = false

	// call the selection callback
	dropdown.select?.()
}

// when getting out of the drop down p area
function onMouseLeaveArrow(e){

	if (! visible) return

	// if we moved into the ul or the input - its ok...
	if ((e.relatedTarget.tagName == "UL" )||(e.relatedTarget.tagName == "INPUT" )) return

	// in any other case remove the dropdown list
	mainDiv.querySelector("ul").style.display = hideList
	visible = false
}

// when getting out of the ul area
function onMouseLeaveUL(e){

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
input.selector {
	color: var(--cField);
	background: var(--bgField);
	font-size: var(--sFontM);
	padding: 0 0.2rem 0.1rem 0.2rem;
	border-radius: var(--rFieldLeft);
}
p.arrow {
	border-radius: var(--rFieldRight);
	background: var(--bgField);
	cursor: pointer;
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
	<input class="selector" bind:this={inputField}  spellcheck="false" on:click={onClickInput} on:focusout={onFocusOut} on:keydown={onKeydown}>
	<p class="selector arrow" on:click={onClickArrow} on:mouseleave={onMouseLeaveArrow} on:keydown={onKeydown}>{@html arrow}</p>
	<ul on:mouseleave={onMouseLeaveUL}>
		{#each dropdown.choices as choice}
			<li on:click={onClickLI} on:keydown={onKeydown}>{choice}</li>
		{/each}
	</ul>
</div>