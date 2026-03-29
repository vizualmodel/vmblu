<script>
import {onMount} from 'svelte'
export let tx

// the page content div
let pageContent

// when mounting
onMount(async () => {

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

// Better alternative
function todo_setTheme(theme) {
    // Remove the previous theme class if it exists
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    // Add the new theme class
    document.documentElement.classList.add(theme);
    // Add the "common" class if it's not already present
    if (!document.documentElement.classList.contains('common')) {
        document.documentElement.classList.add('common');
    }
    // Persist the theme choice
    localStorage.setItem('vza-theme', theme);
}


export const handlers = {

	"-> menu"(div) {
		const menuBox = pageContent.querySelector("#menu-box")?.append(div)
	},

	"-> tab ribbon"(div) {
		const tabBox = pageContent.querySelector("#tab-box")?.append(div)
	},

	"-> workspace"(div) {
		const leftBox = pageContent.querySelector("#left-box")?.append(div)
	},

	"-> canvas"(canvas) {

		const centerBox = pageContent.querySelector("#center-box")?.append(canvas)

		// note that the context of a canvas gets reset when the size changes !
		canvas.width = Math.floor(canvas.parentElement.clientWidth)
		canvas.height = Math.floor(canvas.parentElement.clientHeight)

		// send a message that the canvas size has been adapted
		tx.send("canvas size change",{rect:{x:0, y:0, w:canvas.width, h:canvas.height}})
	},

	"-> modal div"(div) {
		const contextMenu = pageContent.querySelector("#center-box")?.append(div)
	}
}

</script>
<style>
:root.dark {
	--bgLeft:#aaa;
	--bgCenter:#000;
	--bgMenu:#aaa;
}
:root.light {
	--bgLeft:#aaa;
	--bgCenter:#000;
	--bgMenu:#aaa;
}
#page-content {
	display:flex;
	flex-direction:row;
}
#menu-box {
	display:block;
	background-color: var(--bgMenu);
	grid-area:mnu;
}
#tab-box {
	display: block;
	background-color: var(--bgMenu);
	grid-area:tab;
}
#left-box {
	display:flex;
	background-color: var(--bgLeft);
	z-index:1;
	grid-area: lft;
}
#center-box {
	display:flex;
	background-color: var(--bgCenter);
	grid-area:ctr;
}
#main-grid{
	display: grid;
	width:100vw;
	height:100vh;
	padding: 0px 0px 0px 0px;
	grid-template-columns: 15vw calc(100% - 15vw);
	grid-template-rows:  2vh 2vh calc(100% - 4vh);
	grid-template-areas:
	  'lft mnu'
	  'lft tab'
	  'lft ctr';
	grid-gap: 0px;
}
</style>
<div id="page-content" bind:this={pageContent}>
	<div id="main-grid">
		<div id="menu-box">
		</div>
		<div id="tab-box">
		</div>
		<div id="left-box">
		</div>
		<div id="center-box">
		</div>
	</div>
</div>