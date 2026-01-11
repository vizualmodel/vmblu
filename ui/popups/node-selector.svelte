<script>
// -------------------------------------------------------------------
// This box allows presentation and selection of nodes in libraries
// there can be a selection up to one level down in a group node
// -------------------------------------------------------------------
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import {NodeList, alfa} from './node-list.js'

// tx and sx
export let tx //, sx

let nodeList = new NodeList(tx)

// the arrow at the end of the dropdown
const arrowRight = "&#9656;"
const arrowDown  = "&#9662;"

let box = {
    div:null,
    title:'Select Node',
    pos:null,
    ok:null,
    cancel:null,
    add: (e) => nodeList.addLib(e)
}

onMount(async () => {

    // send the box div
    tx.send('modal div', box.div)
})

export const handlers = {

    onBuildTable(libMap) {

        nodeList.init(libMap)
        nodeList.fill(libMap)

        // if visible, refresh
        if (box.div?.style.display == 'block')  nodeList = nodeList
    },

    onShow({xyScreen, xyLocal}) {

        // save the coord where the node will be created 
        nodeList.xyLocal.x = xyLocal.x
        nodeList.xyLocal.y = xyLocal.y

        //show the box at the right coordinates
        box.show({ x: xyScreen.x + 10, y: xyScreen.y + 10 })
    },
}

function onKeydown(e){
}
function onRemoveLib(e) {
    nodeList.onRemoveLib(e)
    nodeList = nodeList
}
function onSelect (e) {
    nodeList.onSelect(e, box)
    nodeList = nodeList
}
function onArrowClick(e) {
    nodeList.onArrowClick(e)
    nodeList = nodeList
}

</script>
<style>
.content {

    --sIcon:1rem;
    --sLib: 0.8rem;

    --bgBox:#0a0a0a;
    --bgScroll:#1a1a1a;
    --bgThumb: #555454;

    --cLib:#000;
    --cNode:#eee;
    --cNodeHover:yellow;
    --cIcon:yellow;
    --cIconHover:rgb(214, 16, 214);
    --sNode: 0.8rem;

    --cFolder:#9cdbff;
    --cFileJson: #FB8604;
    --cFileJs: #FB8604;
    --cFileOther:#1ed4cb;

    /* background: transparent; */
}
/* webkit scrollbar */

::-webkit-scrollbar {
    width: 10px;
}
::-webkit-scrollbar-track {
    background: var(--bgScroll);
}
::-webkit-scrollbar-thumb {
    background: var(--bgThumb);
    border-radius:  0.5rem;
    height: 10%;
}

.column {
    /* background:var(--bgBox); */
    float: left;
    padding: 0rem 2rem 0rem 0rem;
}
.arl {
    display: flex;
    align-items:center;
    /* justify-content:space-between; */
    justify-content:left;
    margin: 1rem 0rem 0.5rem 0rem;
}
i.lib {
    float:right;
    color: var(--cFileJson);
    font-size: var(--sFontLib); 
    cursor:pointer;
}
i.lib:active {
    transform: translateY(0.1rem);
}
i.lib-json {
    color: var(--cFileJson);
}
i.lib-js {
    color: var(--cFileJs);
}
p {
    font-family: inherit;
}
p.lib{
    display: inline-block;
    background:transparent;
    font-size: var(--sLib);
    margin: 0rem 0rem 0rem 0.5rem;
    /* padding: 0.1rem 0.2rem; */
}
p.lib-json {
    color: var(--cFileJson);
    /* border:1px solid var(--cFileJson); */
}
p.lib-js {
    color: var(--cFileJs);
    /* border:1px solid var(--cFileJs); */
}
p.node {
    background:transparent;
    margin: 0rem 0rem 0.2rem 0rem;
}
p.node:hover {
    background:black;
}
p.sub-node {
    background:transparent; 
    margin: 0rem 0rem 0.2rem 1.5rem;
}
p.sub-node:hover {
    background:black;
}
i.icon {
    color: var(--cIcon);
    vertical-align:bottom;
    font-size: var(--sIcon);
}
i.icon:hover{
    color: var(--cIconHover);
}
i.icon:active{
    transform: translateY(0.1rem);
}
span.node-name{
    color: var(--cNode);
    font-size: var(--sNode);
    margin-left:0.2rem;
    cursor:pointer;
}
span.node-name:hover{
    color: var(--cNodeHover);
}
span.arrow {
    /* margin-left:1rem; */
    color: var(--cNode);
    font-size: 0.8rem;
}
span.arrow:hover {
    color: var(--cNodeHover);
}

</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box = {box}>          
    <div class="content">
        {#each nodeList.cols as col, iCol}
            <div class="column">
                {#each col as entry, iNode}
                    {#if entry.nextModel}
                        <div class="arl" data-col={iCol} data-node={iNode}>
                        {#if entry.model.getArl()?.getExt() === 'js'}
                            <i class="material-icons-outlined lib lib-js" on:click={onRemoveLib} on:keydown={onKeydown}>cancel</i>
                            <p class="lib lib-js" >{entry.model.getArl().getName()}</p>
                        {:else}
                            <i class="material-icons-outlined lib lib-json" on:click={onRemoveLib} on:keydown={onKeydown}>cancel</i>
                            <p class="lib lib-json" >{entry.model.getArl().getName()}</p>
                        {/if}
                        </div>
                    {:else if entry.node}
                        {#if entry.node.source}
                            <p class="node" data-col={iCol} data-node={iNode}>
                                <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>factory</i>
                                <span class="node-name" on:click={onSelect} on:keydown={onKeydown}>{alfa(entry.node.source)}</span>
                            </p>
                        {:else if entry.node.dock}
                            <p class="node" data-col={iCol} data-node={iNode}>
                                <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>factory</i>
                                <span class="node-name" on:click={onSelect} on:keydown={onKeydown}>{alfa(entry.node.dock)}</span>
                            </p>
                        {:else if entry.node.group}
                            {#if entry.expanded}
                                <p class="node" data-col={iCol} data-node={iNode}>            
                                    <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>account_tree</i>
                                    <span class="node-name" on:click={onArrowClick} on:keydown={onKeydown}>{alfa(entry.node.group)}</span>
                                    <span class="arrow" on:click={onArrowClick} on:keydown={onKeydown}>{@html arrowDown}</span>
                                </p>
                                {#each entry.node.nodes as sub, iSub}
                                    {#if sub.source}
                                        <p class="sub-node" data-col={iCol} data-node={iNode} data-sub={iSub}>
                                            <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>factory</i>
                                            <span class="node-name" on:click={onSelect} on:keydown={onKeydown}>{alfa(sub.source)}</span>
                                        </p>
                                    {:else if sub.group}
                                        <p class="sub-node" data-col={iCol} data-node={iNode} data-sub={iSub}>            
                                            <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>account_tree</i>
                                            <span class="node-name" on:click={onSelect} on:keydown={onKeydown}>{alfa(sub.group)}</span>
                                        </p>
                                    {:else if sub.dock}
                                        <p class="sub-node" data-col={iCol} data-node={iNode} data-sub={iSub}>            
                                            <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>account_tree</i>
                                            <span class="node-name" on:click={onSelect} on:keydown={onKeydown}>{alfa(sub.dock)}</span>
                                        </p>
                                    {/if}
                                {/each}
                            {:else}
                                <p class="node" data-col={iCol} data-node={iNode}>            
                                    <i class="material-icons-outlined icon" on:click={onSelect} on:keydown={onKeydown}>account_tree</i>
                                    <span class="node-name" on:click={onArrowClick} on:keydown={onKeydown}>{alfa(entry.node.group)}</span>
                                    <span class="arrow" on:click={onArrowClick} on:keydown={onKeydown}>{@html arrowRight}</span>
                                </p>                        
                            {/if}
                        {/if}
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
</PopupBox>