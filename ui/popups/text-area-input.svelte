<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import TextAreaInput from '../fragments/text-area-input.svelte'

export let tx, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

onMount(() => {
    tx.send("modal div", box.div)
})

// the text
let newText = ''

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key != "Escape" && e.key != "Esc" ) e.stopPropagation()
}

export const handlers = {

    "-> text"({header, pos, text, ok=null, cancel=null}) {

        // set the box parameters
        box.title = header
        box.ok = ()=> {
            ok?.(newText)
        }

        // set the text field
        newText = text

        // show
        box.show(pos)
    },
}

</script>
<style>
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    <TextAreaInput bind:text={newText} cols=50 rows=25/>
</PopupBox>