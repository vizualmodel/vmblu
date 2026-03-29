<script>
import {onMount} from 'svelte'
export let tx

let mainDiv
let contentDiv
let menuDiv
let tabsDiv


onMount(async () => {
})

export const handlers = {

    "-> content div"(div) {
        // replace the content
        contentDiv.replaceChildren(div)

        // send out the div
        tx.send('div', mainDiv)
    },

    "-> menu div"(div) {
        menuDiv.replaceChildren(div)
    },

    "-> tabs div"(div) {
        tabsDiv.replaceChildren(div)
    },

    "-> modal div"(div) {
		mainDiv.append(div)
    },

    "-> size change"({id, rect}) {

        const w = Math.floor(contentDiv.clientWidth)
        const h = Math.floor(contentDiv.clientHeight)

        tx.send("content size change", {x:0, y:0, w, h})
    },

    "-> show"() {
        tx.send('div', mainDiv)
    }
}
</script>
<style>
/* :global(html) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden; 
    display: flex;
    justify-content: center;
    align-items: center;
}
:global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden; 
    display: flex;
    justify-content: center;
    align-items: center;
    transform: none !important;
} */
/* Other custom styles */
:root {
    /* Fonts */
    --fFamily: Tahoma, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    --fFixed: 'Courier New', Courier, monospace;
    --fBig: 1.2rem;
    --fNormal: 0.9rem;
    --fSmall: 0.7rem;

    /* Colors */
    --cHeaders: #ff8800;
    --cSelected: yellow;
    --cNotSelected: rgba(255, 255, 0, 0.5);
    --cInput: yellow;
    --cLabel: white;
    --cGreyT: #20203088;
}
:root.dark {
	--bgMenu:#aaa;
}
:root.light {
	--bgMenu:#aaa;
}
/* webkit scrollbar */
::-webkit-scrollbar {
width: 10px;
height:10px;
}
::-webkit-scrollbar-track {
    background: red;
    border-radius: 5px;
}
::-webkit-scrollbar-thumb {
    background: green;
    border-radius: 5px;
    height: 10%;
}
/**/
.main {
    height:100%;
    width: 100%;
    overflow:hidden;
}
.menu {
    height: 25px;
    width: 100%;
    background: var(--bgMenu);
}
.tabs {
    height: 22px;
    width: 100%;
    background: var(--bgMenu);
}
.content {
    height: calc(100% - 47px);
    width: 100%;
}
</style>
<div class="main" bind:this={mainDiv}>
    <div class="menu" bind:this={menuDiv}> </div>
    <div class="tabs" bind:this={tabsDiv}> </div>
    <div class="content" bind:this={contentDiv}></div>
</div>