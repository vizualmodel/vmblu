<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'

export let tx, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let text = ''

onMount(async () => {

    tx.send("modal div", box.div)
})

export const handlers = {

    "-> show"({title, message, pos,ok, cancel}) {

        // notation
        const box = this.popup.box

        // set the box parameters
        box.title = title

        // The message to show
        text = message

        // show
        box.show(pos)
    },
}

</script>
<style>
p {
    font-family:var(--fFixed);
    font-size:var(--fSmall);
    padding: 0.5rem;
    background:#00000077;
    color:grey;
    outline: none;
} 
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    <p>{text}</p>
</PopupBox>