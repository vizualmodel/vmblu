<script>
	import { onMount, afterUpdate } from 'svelte'
	import InlineIcon from './inline-icon.svelte'
	
	// The dropdown descriptor: dropdown = {selected, choices[]}
	export let dropdown
    export let check
	export let select
	
	// the divs
	let list
	let selector
	
	// The selected item in the list
	let previous = dropdown.selected
	
	// Reactive variable to track expanded state
	let isExpanded = false
	
	// css to set dropdown list visible
	const showList = "inline-block"
	const hideList = "none"

    // color to indicate good/bad input
    let goodInputColor = "#ffffff"
    const badInputColor = "#ff0000"

	onMount(()=> {
		dropdownWidth()
		goodInputColor = selector.style.color
	})

	// Use beforeUpdate to handle changes before the DOM updates
	afterUpdate(() => {
		dropdownWidth();
	});

	function dropdownWidth() {

		// Check if dropdown is defined
		if (!dropdown || dropdown.choices.length == 0 || !selector || !list) return;

		// determine the width of the dropdown
		let max = dropdown.selected.length
		dropdown.choices.forEach(choice => { if (choice.length > max) max = choice.length})
	
		// set the length of the p and ul element
		list.style.width = selector.style.width = max*0.6 + 1 + "rem"
	}

    function inputWidth() {

        // reselectedize the width
        selector.style.width = '0px';

        // Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
        selector.style.width = selector.scrollWidth > 20 ? (selector.scrollWidth + 2) + 'px' : '20px'        
    }


    function onInput(e) {

        // adapt the width
        inputWidth()

        // Do we need to check 
        if ( check ) selector.style.color = check(selector.value) ? goodInputColor : badInputColor

		// callback
		select?.(selector.value)
    }


    function onKeydown(e) {
        switch (e.key) {
            case 'Enter':  // 'return' key

                // check the selection
                select?.(selector.value)

                // remove focus
                selector.blur()
                break;

            case 'Escape': // 'esc' key

                // restore the previous selection
                dropdown.selected = previous
                break;

            case 'Delete': // 'delete' key

                dropdown.selected = ''
                break;

            default:
                break;
        }
    }

    function onClickInput(e) {

        list.style.display = hideList
        isExpanded = false
    }
	
	// when clicking on the text we show or remove the dropdown list
	let onClickIcon = (e) => {
		// Toggle the expanded state
		isExpanded = !isExpanded

        // recalculate the width of the list
        if (isExpanded) dropdownWidth(dropdown)
	
		// update list display style based on the expanded state
		list.style.display = isExpanded ? showList : hideList
	}
	
	// when selecting in the ul
	let onClickList = (e) => {
		// check
		if (!isExpanded) return
	
		// set the selector
		dropdown.selected = e.target.innerHTML

		// collapse the dropdown list
		isExpanded = false
		list.style.display = hideList
	
		// call the selector callback
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
		--bgList: #000;
		--cBorder: var(--cInput);
		--bgNoFocus: #00000077;
		--bgHover: #222;
        --bgFocus:#000;
	
		font-family: var(--fFixed);
		font-size: var(--fSmall);
	
		/* settings */
		position: relative;
		display: inline-flex;
		align-items:baseline;
		margin-left:-0.3rem;
	}
    input.grow {
        background: var(--bgNoFocus);
        color: var(--cInput);
        font-family:var(--fFixed);
        font-size: var(--fSmall);
        height:0.7rem;
        cursor: text;
        outline:none;
        border:none;
    }
    input:focus {
        background: var(--bgFocus);
    }
	ul {
		display: none;
		position: absolute;
		top: var(--fNormal);
		color: var(--cInput);
		background: var(--bgList);
		list-style-type: none;
		font-size: var(--fSmall);
		line-height: 1rem;
		cursor: pointer;
		border: solid 1px var(--cBorder);
		border-radius: 0.1rem;
		padding: 0.3rem 0rem 0.3rem 0rem;
		margin-top: 0.2rem;
		z-index: 1;
	}
	li {
		height: 1rem;
		margin: 0rem 0.3rem 0rem 0.3rem;
	}
	li:hover {
		background-color: var(--bgHover);
	}
	</style>
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions a11y-no-static-element-interactions a11y-click-events-have-key-events-->
	<div class="dropdown">
		{#if isExpanded}
			<InlineIcon name='expand_more' style='--cNormal: var(--cInput); --cHover: var(--cInput);' on:click={onClickIcon} />
		{:else}
			<InlineIcon name='navigate_next' style='--cNormal: var(--cInput); --cHover: var(--cInput);' on:click={onClickIcon} />
		{/if}
        <input bind:this={selector} class="grow" type="text" spellcheck="false" bind:value={dropdown.selected}  on:keydown={onKeydown} on:input={onInput} on:click={onClickInput} on:mouseleave={onMouseLeaveTop}>
		<ul bind:this={list} on:mouseleave={onMouseLeaveList}>
			{#each dropdown.choices as choice}
				<li on:click={onClickList}>{choice}</li>
			{/each}
		</ul>
	</div>
	