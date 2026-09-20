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
let activePrompt = null
let releaseDraft = null
let opening = false
let openError = ''

function closeDraft() {
    releaseDraft?.(null)
    releaseDraft = null
    activePrompt = null
}

export const handlers = {

    onMarkdown({header, pos, text='', promptKey=null, draft=null, open=null, ok=null, cancel=null}) {

        if (promptKey && activePrompt === promptKey && box.div?.style.display !== 'none') {
            box.div?.querySelector('textarea, [role="region"]')?.focus()
            return
        }
        closeDraft()
        activePrompt = promptKey
        releaseDraft = draft
        draft?.(() => newText)
        openError = ''

        // set the box parameters
        box.title = header

        // set the ok function
        box.ok = ()=> {
            ok?.(newText)
            closeDraft()
        }
        box.cancel = () => { cancel?.(); closeDraft() }

        // set the add function: when the add icon is pressed, the markdown is previewed
        box.add = () => {
            showPreview = !showPreview
        }
        box.open = sx?.openPromptFile && open ? async () => {
            if (opening) return
            opening = true
            openError = ''
            try { await open(newText) }
            catch (error) { openError = error?.message ?? String(error) }
            finally { opening = false }
        } : null

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
    {#if openError}<p role="alert">{openError}</p>{/if}
    <MarkdownInput bind:text={newText} bind:showPreview cols=50 rows=25/>
</PopupBox>
