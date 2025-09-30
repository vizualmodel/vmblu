<script>
import {onMount, afterUpdate} from 'svelte'
export let tx

// the page content div
let mainGrid
let leftMenu
let leftCol
let sepCol
let sepArea
let areaOne
let areaTwo

// when mounting
onMount(() => {

	// get the selected colortheme - default to dark
	getTheme()
})

function setTheme(theme){
	// always include the common class name
	document.documentElement.className = theme + " common"
	localStorage.setItem('vza-theme', theme);
}

function getTheme(){
	const theme = localStorage.getItem('vza-theme');
	theme ? setTheme(theme) : setTheme('dark')
}

// the grid status
const state = {
	dragging: false,
	sepColDrag: false,		// dragging left column separator
	sepAreaDrag: false,		// dragging area separator
    horizontal : true,
}

// vertical config
const vGrid = {
	rows:	"100%",
	get cols() {
		const wCol = leftCol.getBoundingClientRect().width
		return `30px ${wCol}px 6px 50% 6px calc(50% - 42px)`
	},
	areas:	"'lme lco spc ar1 spa ar2'"
}

// horizontal config
const hGrid = {
	rows: 	"50vh 6px auto",
	get cols() {	
		const wCol = leftCol.getBoundingClientRect().width
		return `30px ${wCol}px 6px auto` 
	},
	areas: 	"'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
}

// fullscreen config == horizontal with zero for area1
const fsGrid = {
	rows: 	"100% 0px 0px",
	get cols() {	
		const wCol = leftCol.getBoundingClientRect().width
		return `30px ${wCol}px 6px auto` 
	},
	areas: 	"'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
}

export const handlers = {

	"-> left menu"(div) {
		leftMenu.replaceChildren(div)
	},

	"-> left column"(div) {
		leftCol.replaceChildren(div)
	},

	"-> area one"(div) {

		// replace the current pane (if any)
		areaOne.replaceChildren(div)

		// note that the context of a canvas gets reset when the size changes !
		div.width = Math.floor(areaOne.clientWidth)
		div.height = Math.floor(areaOne.clientHeight)

		// send a message that the canvas size has been adapted
		tx.send("size change",{id:'area-one', rect: {x:0, y:0, w:div.width, h:div.height}})
	},

	"-> area two"(div) {

		// if the second pane is not visible, make it visible
		if ((areaTwo.clientWidth == 0 )||(areaTwo.clientHeight == 0)) {

			if (state.horizontal) gridConfig(hGrid.rows, hGrid.cols, hGrid.areas) 
			else gridConfig(vGrid.rows, vGrid.cols, vGrid.areas)
		}

		// replace the current pane (if any)
		areaTwo.replaceChildren(div)

		// note that the context of a canvas gets reset when the size changes !
		div.width = Math.floor(areaTwo.clientWidth)
		div.height = Math.floor(areaTwo.clientHeight)

		// send a message that the canvas size has been adapted
		tx.send("size change",{id:'area-two', rect: {x:0, y:0, w:div.width, h:div.height}})
	},

	"-> vertical"() {
		// if horizontal go to vertical - else go to full screen
		if (state.horizontal) {
			gridConfig(vGrid.rows, vGrid.cols, vGrid.areas)
			state.horizontal = false
		} 
		else {
			gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas) 
		}

		// set the cursor
		sepArea.style.cursor = state.horizontal ? 'ns-resize' : 'ew-resize'

		// and signal the change of area size
		areaSizeChange()
	},

	"-> horizontal"() {
		// check if fullscreen
		if (!state.horizontal || areaOne.clientHeight == 0 || areaTwo.clientHeight == 0)
			gridConfig(hGrid.rows, hGrid.cols, hGrid.areas) 
		else
			gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas)

		// full screen is also horizontal
		state.horizontal = true

		// set the cursor
		sepArea.style.cursor = 'ns-resize'

		// and signal the change of area size
		areaSizeChange()
	},
}

function gridConfig( rows, columns, areas) {

	// adjust the grid settings
	mainGrid.style.gridTemplateRows = rows
	mainGrid.style.gridTemplateColumns = columns
	mainGrid.style.gridTemplateAreas = areas
}

function clearDrag() {
	state.dragging = false
	state.sepColDrag = false
	state.sepAreaDrag = false
}

// disable pointer events for the panes
function disablePointerEvents() {
	if (areaOne?.style) areaOne.style.pointerEvents = "none"
	if (areaTwo?.style) areaTwo.style.pointerEvents = "none"
}

// enable pointer events for the panes
function enablePointerEvents() {
	if (areaOne?.style) areaOne.style.pointerEvents = "auto"
	if (areaTwo?.style) areaTwo.style.pointerEvents = "auto"
}

// mouse down is only captured on the separator.
// mouse move and mouse up are captured over the entire grid - so a check on dragging is required
// when dragging the mouse events for the iframe are disabled, otherwise the grid does not get the mouse events

function sepAreaMouseDown(e) {

	// set the state
    state.dragging = true

	// set the type of separator
	state.sepAreaDrag = true

    // disbale pointer events
    disablePointerEvents()
}
function sepColMouseDown(e) {

	// set the state
	state.dragging = true

	// set the separator
	state.sepColDrag = true

	// disbale pointer events
	disablePointerEvents()
}

function gridMouseUp(e) {

	// check
    if (!state.dragging) return

	// change state 
    clearDrag()

    // enable pointer events
    enablePointerEvents()

	// canvas size has changed
	areaSizeChange()
}

function sepColDrag(dx) {
	const rcAreaOne = areaOne.getBoundingClientRect()
	const rcLeftCol = leftCol.getBoundingClientRect()
	mainGrid.style.gridTemplateColumns = `30px ${rcLeftCol.width + dx}px 6px ${rcAreaOne.width - dx}px 6px auto`
}

function hSepAreaDrag(dy) {
	const rcAreaOne = areaOne.getBoundingClientRect()
	mainGrid.style.gridTemplateRows = `${rcAreaOne.height + dy}px 6px auto`
}

function vSepAreaDrag(dx) {
	const rcAreaOne = areaOne.getBoundingClientRect()
	const rcLeftCol = leftCol.getBoundingClientRect()
	mainGrid.style.gridTemplateColumns = `30px ${rcLeftCol.width}px 6px ${rcAreaOne.width + dx}px 6px auto`
}

function gridMouseMove (e) {

	// check
    if (!state.dragging) return

	if (state.sepAreaDrag) {
		state.horizontal? hSepAreaDrag(e.movementY) : vSepAreaDrag(e.movementX)
	}
	else if (state.sepColDrag) sepColDrag(e.movementX)
}

function areaSizeChange() {

	// first box
	if (areaOne.hasChildNodes()) {
        const rect = { x:0, y:0, w:areaOne.clientWidth, h:areaOne.clientHeight}
		tx.send("size change",{id:'area-one', rect})
	}

	// second box
	if (areaTwo.hasChildNodes()) {
        const rect = { x:0,  y:0, w:areaTwo.clientWidth, h:areaTwo.clientHeight }
		tx.send("size change",{id:'area-two', rect})
	}
}
</script>
<style>
:global(html) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden; 
    display: flex;
    justify-content: center;
    align-items: center;
}
:global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden; 
    display: flex;
    justify-content: center;
    align-items: center;
    transform: none !important;
}
:root.dark {
	--bgLeft:#aaa;
	--bgLeftMenu:#555;
	--bgCenter:#000;
	--bgBottom:#ccc;
	--bgMenu:#aaa;
    --bgSep: #aaa;
    --bgSepHover: #2085a3;
}
:root.light {
	--bgLeft:#aaa;
	--bgLeftMenu:#555;
	--bgCenter:#000;
	--bgBottom:#ccc;
	--bgMenu:#aaa;
    --bgSep: #aaa;
    --bgSepHover: #2085a3;
}
#page-content {
	display:flex;
	flex-direction:row;
}
#left-menu{
	display:flex;
	background-color: var(--bgLeftMenu);
	grid-area: lme;
}
#left-column {
	display:flex;
	background-color: var(--bgLeft);
	z-index:1;
	grid-area: lco;
}
#sep-col {
    display: block;
    grid-area:spc;
	cursor: ew-resize;
    width:100%;
    height:100%;
    background: var(--bgSep);
}
#sep-col:hover {
	background: var(--bgSepHover)
}
#area-one {
	display:block;
	background-color: var(--bgCenter);
	grid-area:ar1;
	width:100%;
	height:100%;
}
#sep-area {
    display: block;
    grid-area:spa;
	cursor: ns-resize;
    width:100%;
    height:100%;
    background: var(--bgSep);
}
#sep-area:hover {
	background: var(--bgSepHover)
}
#area-two {
	display:block;
	background-color: var(--bgBottom);
	grid-area:ar2;
	width:100%;
	height:100%;
}
#main-grid{
	display: grid;
	width:100vw;
	height:100vh;
	padding: 0px 0px 0px 0px;
	grid-template-columns: 30px 15vw 6px auto;
	grid-template-rows: 100% 0px 0px;
	grid-template-areas: 'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2';
	grid-gap: 0px;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div id="page-content">
	<div id="main-grid" bind:this={mainGrid} on:mousemove={gridMouseMove} on:mouseup={gridMouseUp}>
		<div id="left-menu" bind:this={leftMenu}></div>
        <div id="left-column" bind:this={leftCol}></div>
        <div id="sep-col" bind:this={sepCol} on:mousedown={sepColMouseDown} ></div>
		<div id="area-one" bind:this={areaOne}></div>
        <div id="sep-area" bind:this={sepArea} on:mousedown={sepAreaMouseDown} ></div>
		<div id="area-two" bind:this={areaTwo}></div>
	</div>
</div>