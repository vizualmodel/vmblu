<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import PathInputField from '../../fragments/path-input-field.svelte'

export let tx//, sx

// the popup box data
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}
// local copies of the 
let _path, _regex
let _startFolder = null
let _fileExtensions = ''

async function getFolder(path = '') {
    try {
        return await tx.request('folder.get', {startFolder: _startFolder, path})
    }
    catch {
        return {folders: [], files: []}
    }
}

function checkPath(str) {
                
    // if we need to test the input..
    if (!_regex) return true

    // test the input against the regex
    return _regex.test?.(str)
}

onMount( () => {
    tx.send("modal div", box.div)
})

export const handlers = {

    // The uid is the uid of the node for which the popup is opened
    "-> path"({title, path, pos, ok, cancel, startFolder = null, fileExtensions = ''}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => ok(_path) : null
        box.cancel = cancel ? () => cancel() : null

        // the path field
        _path = path
        _startFolder = startFolder
        _fileExtensions = fileExtensions

        // show the popup
        box.show()
    },
}

</script>
<style>
</style>
<PopupBox box={box}>
    <PathInputField label="Path :" style="width: 2rem;" bind:input={_path} check={checkPath} getFolder={getFolder} fileExtensions={_fileExtensions} />
</PopupBox>
