<script>
	import { onMount } from 'svelte'
	
	// The dropdown descriptor: dropdown = {selected, choices[]}
	export let dropdown
	export let select
	
	// the divs
	let list
	let selector
	
	// Reactive variable to track expanded state
	let isExpanded = false
	
	// css to set dropdown list visible
	const showList = "inline-block"
	const hideList = "none"
	
	onMount(async () => {
		// set the width of the dropdown
		setWidth(dropdown)
	})
	
	function setWidth(dropdown) {
		// determine the width of the dropdown
		let max = dropdown.selected.length
		dropdown.choices.forEach(choice => { if (choice.length > max) max = choice.length})
	
		// set the length of the p and ul element
		list.style.width = selector.style.width = max*0.6 + 1 + "rem"
	}
	
	// when clicking on the text we show or remove the dropdown list
	let onClickTop = (e) => {
		// Toggle the expanded state
		isExpanded = !isExpanded
	
		// update list display style based on the expanded state
		list.style.display = isExpanded ? showList : hideList
	
		// update component
		dropdown = dropdown
	}
	
	// when selecting in the ul
	let onClickList = (e) => {
		// check
		if (!isExpanded) return
	
		// set the selection
		dropdown.selected = e.target.innerHTML
	
		// collapse the dropdown list
		isExpanded = false
		list.style.display = hideList

		// call the selection callback
		select?.(dropdown.selected)
	}
	
	// when getting out of the drop down p area
	let onMouseLeaveTop = (e) => {
		// if nothing is visible - or if we moved into the UL/LI - do nothing
		if (!isExpanded || (e.relatedTarget.tagName == "UL" ) || (e.relatedTarget.tagName == "LI" )) return
	
		// in any other case remove the dropdown list
		isExpanded = false
		list.style.display = hideList
	}
	
	// when getting out of the ul area
	let onMouseLeaveList = (e) => {
		// remove the dropdown list
		isExpanded = false
		list.style.display = hideList
	}
	</script>
	<style>
	.dropdown {

		--cFont: var(--cInput, #ffffff);
		--bgList: #333;
		--cHover: #eee;
		--bgHover: #ccc;
	
		font-family: var(--fFixed);
		font-size: var(--fSmall);
	
		/* settings */
		position: relative;
		display: inline-flex;
		align-items:baseline;
		margin-left:-0.3rem;
	}
	p.text {
		display:inline;
		color: var(--cFont);
		background: transparent;
		font-size: var(--fSmall);
		margin: 0rem;
		cursor: pointer;
	}
	p.text:hover{
		color: var(--cHover);
	}
	ul {
		display: none;
		position: absolute;
		top: var(--fNormal);
		color: var(--cFont);
		background: var(--bgList);
		list-style-type: none;
		font-size: var(--fSmall);
		line-height: 1rem;
		cursor: pointer;
		border: solid 1px #ccc;
		border-radius: 0.5rem;
		padding: 0.5rem 0rem 0.5rem 0rem;
		margin: 0;
		z-index: 1;
	}
	i {
		color: var(--cFont);
		font-size: var(--fNormal);
		transform: translateY(0.3rem);
	}
	i:hover {
		cursor: pointer;
	}
	li {
		margin-left: 0.8rem;
		height: 1rem;
	}
	li:hover {
		background-color: #666;
		color: #fff;
	}
	</style>
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions a11y-no-static-element-interactions a11y-click-events-have-key-events-->
	<div class="dropdown">
		{#if isExpanded}
			<i class="material-icons-outlined" on:click={onClickTop}>expand_more</i>
		{:else}
			<i class="material-icons-outlined" on:click={onClickTop}>navigate_next</i>
		{/if}
		<p bind:this={selector} class="text" on:click={onClickTop} on:mouseleave={onMouseLeaveTop}>		
			{dropdown.selected}
		</p>
		<ul bind:this={list} on:mouseleave={onMouseLeaveList}>
			{#each dropdown.choices as choice}
				<li on:click={onClickList}>{choice}</li>
			{/each}
		</ul>
	</div>
	