<script>
    import {onMount} from 'svelte'

    // the tab control props
    export let tx

    // the div
    let tabDiv

    // the list of tabs : a tab has a label and a unique ref {label, ref}
    const tabs = []

    // the nr of the selected tab
    let selected = -1
    
    onMount(() => {

        // send the div
        tx.send("div", tabDiv)
    })

    // msg Handler
    export const handlers = {

        "-> new tab"({label, ref}) {
            selected = tabs.push({label, ref}) - 1
            tabs = tabs
        },

        "-> rename tab"({label, ref, newLabel}) {
            const index = tabs.findIndex( tab => tab.ref == ref)
            if (index >=0 ) tabs[index].label = newLabel
            tabs = tabs
        },

        "-> select tab"(ref) {
            const index = tabs.findIndex( tab => tab.ref == ref)
            if (index >= 0) selected = index
            tabs = tabs
        },

        "-> save"() {

            // return the reference of the current doc
            if (selected >=0) tx.send("save doc", tabs[selected].ref)

        }
    }

    function _close(ref) {

        // remove the tab with the name
        const L = tabs.length
        for (let i=0; i<L; i++) {
            if (tabs[i].ref == ref) {

                // the new selected tab if any
                selected = L < 2 ? -1 : i > 0 ? i-1 : 0

                // shift the tabs
                for (let j=i; j<L-1; j++ )  tabs[j] = tabs[j+1]

                // remove one element
                tabs.pop()
                break
            }
        }
    }

    // Event Functions 
    function onClick(e) {
        // get the uid of the tab clicked
        const ref = e.target.getAttribute("data-ref")     

        // find the index
        const index = tabs.findIndex( tab => tab.ref == ref)

        // tell the user
        if (index >= 0) {
            tx.send("show doc", tabs[index].ref) 
            selected = index
        }
    }

    function onClose(e) {
        // get the index of the tab clicked
        const ref = e.target.parentNode.getAttribute("data-ref")  

        // find the index
        const index = tabs.findIndex( tab => tab.ref == ref)

        // tell the user which one is closed before removing it from the array !
        tx.send("close doc", tabs[index].ref )

        // remove the tab
        _close(tabs[index].ref)

        // also tell the new selection if any
        selected > 0 ? tx.send("show doc", tabs[selected].ref) : tx.send("show doc", null)

        // stop it
        e.stopPropagation()
    }

    function onKeydown(e) {
    }

</script>
<style>
.tab-ribbon{
	display:block;
	background: inherit;
    height:100%;
}
.tab {
	display: inline-block;
    height:100%;
    font-family: var(--fontBase);
    font-size: 0.8rem;
	font-weight: normal;  
	cursor: pointer;
	background-color: var(--bgTab);
	color: var(--cFontTab);
    margin-top: 0.1rem;
	padding: 0.2rem 0.3rem 0rem 1rem;
	border-radius: 0.5rem 0.5rem 0 0;
}
.selected {
    background-color: var(--bgTabSelect);
	color: var(--cFontTabSelect); 
}
.button{
    display: inline-block;
    font-size: 0.5rem;
    border: none;
    background-color: var(--cCloseTab);
    height: 0.6rem;
    width: 0.6rem;
    border-radius: 50%;
    margin-left: 0.5rem;
    cursor: pointer;
}
.button:hover{
    background-color:var(--cCloseTabHover);
    cursor:default;
}
</style>
<div class="tab-ribbon" bind:this={tabDiv}>
    {#each tabs as tab, index}
        {#if index == selected}
            <div class="tab selected" data-ref={tab.ref} on:click={onClick} on:keydown={onKeydown}>
                {tab.label}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
            </div>
        {:else}
            <div class="tab" data-ref={tab.ref} on:click={onClick} on:keydown={onKeydown}>
                {tab.label}
                <input class="button"  type="button" on:click={onClose} on:keydown={onKeydown}>
            </div>
        {/if}
    {/each}
</div>