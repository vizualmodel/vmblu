<script>
import {onMount} from 'svelte'
export let tx

let mainDiv
let contentDiv
let tabsDiv

// menuDiv is initialised with a message
let menuDiv = null;

onMount(async () => {
})

export const handlers = {

    onContentDiv(div) {
        // replace the content
        contentDiv.replaceChildren(div)

        // append the menu again
        if (menuDiv) contentDiv.append(menuDiv)

        // send out the div
        tx.send('div', mainDiv)
    },

    // The menu div is an overlay menu
    onMenuDiv(div) {

        // save
        menuDiv = div;

        // append
        contentDiv.append(menuDiv)
    },

    onTabsDiv(div) {
        tabsDiv.replaceChildren(div)
    },

    onModalDiv(div) {
		mainDiv.append(div)
    },

    onSizeChange({id, rect}) {

        // and inform other nodes about the content size change
        const w = Math.floor(contentDiv.clientWidth)
        const h = Math.floor(contentDiv.clientHeight)

        tx.send("content size change", {x:0, y:0, w, h})
    },

    onShow() {
        tx.send('div', mainDiv)
    }
}
</script>
<style>
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
.tabs {
    height: 24px;
    width: 100%;
    background: inherit;
}
.content {
    position: relative;
    height: calc(100% - 24px);
    width: 100%;
}
</style>
<div class="main" bind:this={mainDiv}>
    <div class="tabs" bind:this={tabsDiv}> </div>
    <div class="content" bind:this={contentDiv}></div>
</div>