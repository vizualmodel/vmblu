<script>
import {onMount} from 'svelte'
import {theme} from '../theme.js'

// box = {div, title, expanded}
export let box
let content

onMount(() => {

	// set the show, hide and update functions
	box.show = show
	box.hide = hide
	box.update = ()=> box = box
})

function show() {
    box.div.style.display = 'block';
}

function hide() {
    box.div.style.display = 'none';
}

function onExpand(e) {
    box.expanded ? content.style.display = 'none' : content.style.display = 'block'
    box.expanded = !box.expanded
    box = box
}

function onKeydown(e) {

    // prevent the keydown from having effects on the editor !
    e.stopPropagation()
}
</script>
<style>
.main {

    --cText: var(--cInput, #ffffff);

    display: flex;
    flex-direction: column;
    width: 100%;
    font-family:var(--fFamily);
	overflow: visible;
	border-top: 1px solid var(--cText);
    margin-bottom:0.5rem;
}
.hdr {
    display: flex;
    align-items:center;
    justify-content:start;
    height: 1rem;
    margin-top: 0.1rem;
    margin-bottom: 0.5rem;
}
i {
    float:left;
    font-size:1rem;
    cursor:pointer;
}
i.expand {
    color:#ff8800;
    /* margin-right: 0.3rem; */
}
i.expand:hover {
    color:#ffffff;
}
h1 {
	display: inline;
    font-family:inherit;
	font-size: var(--fSmall);
	font-weight: normal;
    text-align:center;
	color: var(--cText);
}
.content {
    display: flex;
    flex-direction:column;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="main" bind:this={box.div} on:keydown={onKeydown}>
	<div class="hdr">
        {#if box.expanded}
            <i class="material-icons-outlined expand" on:click={onExpand} on:keydown={onKeydown}>expand_more</i>
        {:else}
            <i class="material-icons-outlined expand" on:click={onExpand} on:keydown={onKeydown}>navigate_next</i>
        {/if}
        <h1>{box.title}</h1>
  	</div>
    <div class="content" bind:this={content}>
        <slot/>
    </div>
</div>