<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'

// popup = {box, text}
export let tx//, sx

onMount(async () => {

    // send the box div
    tx.send('modal div', box.div)
})

// the popup box data
const box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

export const handlers = {

    "-> show"({title,message, pos,ok, cancel}) {

        // set the box parameters
        box.title = title
        box.ok = ok
        box.cancel = cancel

        // show
        box.show(pos)
    },

}
</script>
<style>
/* p {
    font-family:var(--fontFixed);
    font-size:var(--sFontMS);
    padding: 0.5rem;
    background:var(--bgMB-Field);
    color:var(--cMB-Field);
    outline: none;
}  */
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<PopupBox box={box}>
    <!-- <p>{popup.text}</p>
    <i class="material-icons-outlined cancel" on:click={onCancel} >cancel</i>
    <i class="material-icons-outlined check" on:click={onOk}>check_circle</i> -->
</PopupBox>