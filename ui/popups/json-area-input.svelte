<script>
import {onMount} from 'svelte'
import PopupBox from '../fragments/popup-box.svelte'
import TextAreaInput from '../fragments/text-area-input.svelte'

export let tx, sx

onMount(async () => {
    tx.send("modal div", box.div)
})

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

// the text
let text = ''

// only the escape key can go to the box
function onKeydown(e) {
    if (e.key != "Escape" && e.key != "Esc" ) e.stopPropagation()
}

export const handlers = {

    "-> json"({title, pos, json, ok}) {

        // set the box parameters
        box.title = title
        box.pos = {...pos}

        // The ok function for the box
        box.ok = ()=> {
            // check
            const newJson = checkJSON()

            // check for empty 
            if (newJson?.length == 0) return ok ? ok('') : null

            // save or restart
            newJson ? ok?.(newJson) : box.show(pos)
        }

        // transform json to text
        text = json ? JSON.stringify(json,null,'  ') : ''

        box.show(pos)
    }
}

function checkJSON(){

    // check for a SyntaxError
    let syntax = text.indexOf("SyntaxError")

    // remove the syntax error if any
    if (syntax != -1) text = syntax > 1 ? text.slice(0,syntax-2) : ''

    // it could be that the content is just empty
    if (text.length == 0) return ''

    // convert the json to an object
    try {
        // parse the content of the field
        return JSON.parse(text)
    }
    catch(error) {
        // show the content followed by the error
        text = text + '\n\n' + error
        
        // no valid json
        return null
    }
}
</script>
<style>
</style>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<PopupBox box={box}>
    <TextAreaInput bind:text={text} cols=50 rows=25/>
</PopupBox>