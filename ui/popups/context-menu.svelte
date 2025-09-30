<script>
import {onMount} from 'svelte'

export let tx, sx

let context = {
	div: null,
	menu: [],
	show : ()=>{},
}

onMount(() => {

	context.show = show

    // send the box div
    tx.send('modal div', context.div)
})

export const handlers = {


	// pos = x,y = e.clientX e.clientY
	"-> context menu"({menu, event}) {

		// set the menu
		context.menu = menu

		// show the menu at the requested position
		context.show(event)
	}    
}

// show the list - typically on a right click "oncontextmenu"
function show(e) {

	// check
	if (context.menu.length <= 0)  return 

	// calculate the width of the list
	setWidth() 

	// the div has the display 'absolute' attribute - so we use client coordinates !
	context.div.style.display = "block"

	// + or -10 is to make sure the cursor is in the selection list
	context.div.style.left = `${e.clientX - 10}px`;
	context.div.style.top =  `${e.clientY - 20}px`;

	// force an update
	context = context
}

// calculate the width of the list
function setWidth() {

	// determine the width of the clicklist
	let max = 0
	context.menu.forEach(choice => { 

		const len = choice.text.length + (choice.char ? (choice.char.length + 5) : 0)
		if (len > max) max = len
	})

	// set the width of the UL
	context.div.querySelector("ul").style.width = (0.5*max + 1.5).toString() + "rem"	
}

// when getting out of the ul area
function hide(e){
	context.div.style.display = "none"
}

function goAway(e) {
	e.preventDefault()
	context.div.style.display = "none"
}

// when selecting in the ul
function onClickLI(e) {

	// hide the list
	context.div.style.display = "none"

	// get the index
	let index = e.target.dataset.index ?? e.target.parentNode.dataset.index

	// check if enabled
	if (context.menu[index]) {
		if (context.menu[index].state == "enabled") context.menu[index].action(e) 
	}
}

function onKeydown(e) {}

</script>
<style>
div {
	--fontBase: arial, helvetica, sans-serif;
	--fontFixed: "courier new";
	--sFont:0.8rem;

	--bgList:#0a0a0a;
	--cList:#111;

	--cEnable:#eee;
	--cDisable:#888;
	--bgHover:#606060;
	--cHover:#fff;

	--sIcon:1rem;
    --cIcon:yellow;
    --cIconDisabled: rgb(128, 128, 51);

	display: none;
	position: absolute;
	background:transparent;
}
ul {
	display: block;
	position: relative;
	top: 1px;
	background:var(--bgList);
	color: var(--cList);
	list-style-type: none;
	font-family: var(--fontBase);
	font-size: var(--sFont);
	line-height: var(--sFont);
	padding: 0.5rem;
	cursor:pointer;
	z-index:5;
	border: 1px solid #606060;
	border-radius: 0.1rem;
	user-select:none;
}
li {
	margin-bottom:0.3rem;
}
li.enabled {
	color: var(--cEnable);
}
li.disabled {
	color:var(--cDisable);
}
li.enabled:hover{
	background-color:var(--bgHover);
	color:var(--cHover);
	border-radius: var(--rList);
}
i.choice-icon {
    font-size: var(--sIcon);
	color: var(--cIcon);
	margin-right: 0.5rem;
	vertical-align: bottom;
}
i.choice-icon.disabled {
	color: var(--cIconDisabled)
}
span.choice-text {
	display:inline;
	vertical-align:text-top;
}
span.choice-char {
	display:inline;
	vertical-align: text-bottom;
	float: right;
	color: var(--cIcon);
	font-family: var(--fontFixed);
	font-size: var(--sFont);
	font-weight:500;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div bind:this={context.div} on:click={hide} on:contextmenu={goAway} on:keydown={onKeydown}>
	<ul on:mouseleave={hide}>
		{#each context.menu as choice, index}
			<li on:click={onClickLI} data-index={index} class={choice.state} on:keydown={onKeydown}>
				<i  class="material-icons-outlined choice-icon {choice.state}">{choice.icon}</i>
				<span class="choice-text">{choice.text}</span>
				<span class="choice-char">{choice.char ?? ' '}</span>
			</li>
		{/each}
	</ul>
</div>