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

    "-> size change"({event, rect}) {

    },

    // request to show this editor somewhere - just output the maindiv again
    "-> show"() {
        tx.send('div', mainDiv)
    }
}

</script>
<style>

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
#main {
    height:100%;
    width: 100%;
    overflow:hidden;
}
#menu {
    height: 25px;
    width: 100%;
    background: var(--bgMenu)
}
#tabs {
    height: 22px;
    width: 100%;
    background: var(--bgMenu)
}
#content {
    height: calc(100% - 47px);
    width: 100%;
}
</style>
<div id="main" bind:this={mainDiv}>
    <div id="menu" bind:this={menuDiv}> </div>
    <div id="tabs" bind:this={tabsDiv}> </div>
    <div id="content" bind:this={contentDiv}></div>
</div>