<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import MarkdownInput from '../../fragments/markdown-input.svelte'

export let tx
export let sx = {}

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

export const handlers = {

    onMarkdown({header, pos, text='', open=null, ok=null, cancel=null}) {

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
        box.open = sx?.openPromptFile ? open : null

        // set the text field
        newText = text
        showPreview = false

        // show
        box.show(pos)
    },
}

</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    <MarkdownInput bind:text={newText} bind:showPreview cols=50 rows=25/>
</PopupBox>
