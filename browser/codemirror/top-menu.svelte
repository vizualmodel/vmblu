<script>
import {onMount} from 'svelte'

export let tx, symbols

// this.menu
let menuDiv


onMount(() => {

    // send the div
    tx.send("div", menuDiv)
})

export const handlers = {

    "-> set menu"(newSymbols) {
        symbols = newSymbols
    }
}

function menuClick(e) {

    const index = e.target.getAttribute("data-index")  
    tx.send(symbols[index].message)
}

function keydown() {}

</script>
<style>
.menu {
    display:flex;
    flex-direction:row;
    background:inherit;
    /* margin: 0.1rem 0rem 0.1rem 1rem; */
}
.menu-item {
    background:transparent;
    position:relative;
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
.menu-item .tooltip {
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
  top: 120%;
}

.menu-item:hover .tooltip {
  visibility: visible;
}

</style>
<div bind:this={menuDiv} class="menu">
    {#each symbols as symbol, index}
    <div class="menu-item">
        <i class="material-icons-outlined icon" data-index={index} on:click={menuClick} on:keydown={keydown}>{symbol.name}</i>
        <div class="tooltip" style="width: {symbol.help.length*0.5}rem;">{symbol.help}</div>
    </div>
    {/each}
</div>
