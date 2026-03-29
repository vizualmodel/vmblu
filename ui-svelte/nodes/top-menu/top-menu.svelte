<script>
import {onMount} from 'svelte'

export let tx, sx

onMount(() => {

    // send the div
    tx.send("div", menuDiv)
})

let menuDiv = null
let symbols = sx ?? []

export const handlers = {

    // The menu can be changed
    "-> set menu"(newSymbols) {
        symbols = newSymbols
    }
}

function menuClick(e) {

    // get the clicked symbol
    const index = e.target.getAttribute("data-index") 

    // send the corresponding message
    tx.send(symbols[index].message,e)
}

function keydown() {}

</script>
<style>
.menu {

    --bgTooltip:rgb(30, 29, 100);
    --cTooltip:rgb(132, 197, 250);
	--fontBase: arial, helvetica, sans-serif;
    --cIcon: blue;

    display:flex;
    flex-direction:row;
    background:inherit;
    /* margin: 0.1rem 0rem 0.1rem 1rem; */
}
.menu-item {
    background:transparent;
    position:relative;
}
.menu-item:hover .tooltip {
  visibility: visible;
}
i.icon {
    color: var(--cIcon);
    margin-bottom:-0.2rem;
}
i.icon:hover {
    color:var(--cTooltip);
    cursor:pointer;
}
i.icon:active {
    transform: translateY(2px);
}
/* .menu-item .tooltip { */
.tooltip {
    visibility: hidden;
    font-family: var(--fontBase);
    font-size:0.9rem;
    width: 10rem;
    background-color: var(--bgTooltip);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 10px;
    border: 2px solid var(--cTooltip);
    padding: 0rem 1rem 0.1rem 1rem;
    
    /* Position the tooltip */
    position: absolute;
    z-index: 1;
    top: 25px;
}
.tooltip:hover{
    top: -100px;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={menuDiv} class="menu">
    {#each symbols as symbol, index}
    <div class="menu-item">
        <i class="material-icons-outlined icon" data-index={index} on:click={menuClick} on:keydown={keydown}>{symbol.name}</i>
        <div class="tooltip" style="width: {symbol.help.length*0.5}rem;">{symbol.help}</div>
    </div>
    {/each}
</div>
