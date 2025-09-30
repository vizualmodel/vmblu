<script>
import {onMount} from 'svelte'

export let tx,sx

let menuDiv
const menu = sx

onMount(() => {
    tx.send('div',menuDiv)
})

function menuClick(e) {
    const index = e.target.getAttribute("data-index") 
    tx.send(menu[index].message)
}

function keydown() {}

</script>
<style>
.menu {

    --bgMenu: transparent;
    --bgTooltip:rgb(30, 29, 100);
    --cTooltip:rgb(132, 197, 250);
	--fontBase: arial, helvetica, sans-serif;
    --cIcon: rgb(0, 204, 255);

    display:flex;
    flex-direction:row;
    align-items: flex-start;
    width:auto;
    background:var(--bgMenu);
}
.menu-item {
    background:transparent;
    position:relative;
}
.menu-item:hover .tooltip{
    visibility: visible;
}
i.icon {
    color: var(--cIcon);
    font-size: var(--fNormal);
}
i.icon:hover {
    color:var(--cTooltip);
    cursor:pointer;
}
i.icon:active {
    transform: translateY(2px);
}
.tooltip {
    position: absolute;
    z-index: 2;
    visibility: hidden;
    font-family: var(--fontBase);
    font-size:var(--fSmall);
    white-space: nowrap;
    background-color: var(--bgTooltip);
    color: var(--cTooltip);
    text-align: left;
    border-radius: 5px;
    border: 1px solid var(--cTooltip);
    padding: 0rem 1rem 0.1rem 1rem;
    margin-left: 1rem;
}

</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="menu" bind:this={menuDiv}>
    {#each menu as symbol, index}
    <div class="menu-item">
        <i class="material-icons-outlined icon" data-index={index} on:click={menuClick} on:keydown={keydown}>{symbol.name}</i>
        <div class="tooltip">{symbol.help}</div>
    </div>
    {/each}
</div>