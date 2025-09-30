<script>
import {onMount} from 'svelte'

export let tx, sx

// this.menu
let floatingDiv
let symbols = sx

onMount(() => {

    // send the div
    tx.send("div", floatingDiv)
})

export const handlers = {

    "-> set menu"(newSymbols) {

        symbols = newSymbols
    }
}

function menuClick(e) {

    const index = e.target.getAttribute("data-index")
    if (symbols[index].message?.length > 0) tx.send(symbols[index].message, e)
}

function keydown(e) {}

</script>
<style>
.menu {

    --bgMenu: transparent;
    --cIcon: #0fb2e4;
    --bgTooltip:#231958;
    --cTooltip:rgb(83, 150, 212);
	--fontBase: arial, helvetica, sans-serif;

    display:flex;
    position: absolute;
    top:0px;
    left:32px;
    flex-direction:column;
    background:var(--bgMenu);
    margin: 2rem 0 0 3px;
}
.menu-item {
    background:transparent;
    position:relative;
}
i.icon {
    /* color: var(--cIcon); */
    margin-bottom:-0.2rem;
    font-size: 1.2rem;
}
i.icon:hover {
    color:var(--cTooltip);
    cursor:pointer;
}
i.icon:active {
    transform: translateY(2px);
}
.menu-item .tooltip {
    position: absolute;
    z-index: 2;
    visibility: hidden;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--fontBase);
    font-size:0.9rem;
    width: 10rem;
    background-color: var(--bgTooltip);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 10px;
    border: 2px solid var(--cTooltip);
    padding: 0rem 1rem 0.1rem 1rem;
    margin-left: 2rem;
}

.menu-item:hover .tooltip {
    visibility: visible;
}
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={floatingDiv} class="menu">
    {#each symbols as symbol, index}
    <div class="menu-item">
        <i class="material-icons-outlined icon" style="color: {symbol.color};" data-index={index} on:click={menuClick} on:keydown={keydown}>{symbol.icon}</i>
        <div class="tooltip" style="width: {symbol.help.length*0.5}rem;">{symbol.help}</div>
    </div>
    {/each}
</div>
