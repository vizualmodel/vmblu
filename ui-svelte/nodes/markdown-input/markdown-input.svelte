<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import MarkdownInput from '../../fragments/markdown-input.svelte'

export let tx // sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
    add: null,
}

onMount(() => {
    tx.send("modal div", box.div)
})

// the text
let newText = ''
let showPreview = false

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key != "Escape" && e.key != "Esc" ) e.stopPropagation()
}

export const handlers = {

    onMarkdown({header, pos, text, ok=null, cancel=null}) {

        // set the box parameters
        box.title = header

        // set the ok function
        box.ok = ()=> {
            ok?.(newText)
        }

        // set the add function: when the add icon is pressed, the markdown is previewed
        box.add = () => {
            showPreview = !showPreview
        }

        // set the text field
        newText = text
        showPreview = false

        // show
        box.show(pos)
    },
}

</script>
<style>
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    <MarkdownInput bind:text={newText} bind:showPreview cols=50 rows=25/>
</PopupBox>
