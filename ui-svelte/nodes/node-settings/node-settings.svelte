<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
import LabelTextInput from '../../fragments/label-text-input.svelte'
import TextAreaInput from '../../fragments/text-area-input.svelte'

export let tx

let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

let team = ''
let teams = []
let text = ''
let testRepo = ''
let testRepoReadOnly = false
let openTestRepo = null
let defaultTestRepo = ''
let openingTestRepo = false
let testRepoError = ''
let requestVersion = 0

onMount(() => {
    tx.send('modal div', box.div)
})

export const handlers = {
    "-> show"({title, pos, team: nodeTeam, teams: modelTeams, json, testRepo: nodeTestRepo, defaultTestRepo: defaultPath, testRepoReadOnly: readOnly, openTestRepo: open, ok}) {

        box.title = title
        box.pos = {...pos}
        box.ok = () => {
            const result = checkJSON()
            if (!result.ok) {
                box.show(pos)
                return false
            }
            ok?.({team: team || null, sx: result.value, testRepo: testRepo.trim() || null})
        }

        team = nodeTeam ?? ''
        teams = makeTeamOptions(modelTeams)
        text = json ? JSON.stringify(json, null, '  ') : ''
        testRepo = nodeTestRepo ?? ''
        testRepoReadOnly = !!readOnly
        openTestRepo = open ?? null
        defaultTestRepo = defaultPath ?? './tests/nodes/node.md'
        openingTestRepo = false
        testRepoError = ''
        requestVersion++

        box.show(pos)
    }
}

async function openSpecification() {
    if (openingTestRepo || !openTestRepo) return
    testRepoError = ''
    if (!testRepo.trim() && !testRepoReadOnly) {
        testRepo = defaultTestRepo
        return
    }
    const version = requestVersion
    openingTestRepo = true
    try {
        await openTestRepo(testRepo.trim())
    } catch (error) {
        if (version === requestVersion) testRepoError = error?.message ?? String(error)
    } finally {
        if (version === requestVersion) openingTestRepo = false
    }
}

function specificationKeydown(event) {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
        event.preventDefault()
        event.stopPropagation()
        openSpecification()
    }
}

function makeTeamOptions(modelTeams) {
    //const options = [{value: '', label: 'inherit'}]
    const options = []
    const source = modelTeams ?? {default: {color: '#0066ff'}}

    for (const name of Object.keys(source)) {
        options.push({value: name, label: name})
    }

    if (team && !options.some(option => option.value === team)) {
        options.push({value: team, label: `${team} (missing)`})
    }

    return options
}

function checkJSON(){
    const syntax = text.indexOf('SyntaxError')
    if (syntax !== -1) text = syntax > 1 ? text.slice(0, syntax - 2) : ''
    if (text.length === 0) return {ok: true, value: null}

    try {
        return {ok: true, value: JSON.parse(text)}
    }
    catch(error) {
        text = text + '\n\n' + error
        return {ok: false, value: null}
    }
}
</script>

<style>
.sx-label {
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
    margin: 0.5rem 0 0.25rem;
}
.test-error { color: #e5b65d; font: 0.75rem var(--fBase, sans-serif); }
</style>

<PopupBox box={box}>
    <LabelSelect label="Team" style="width: 6rem;" bind:value={team} options={teams}/>
    {#if !testRepoReadOnly}
    <div role="group" aria-label="Test specification file">
        <LabelTextInput label="Test specification" style="width: 6rem;" bind:text={testRepo} openFile={openTestRepo ? openSpecification : null} fileIcon={testRepo.trim() ? 'description' : 'note_add'} fileTitle={testRepo.trim() ? 'Open test specification' : 'Suggest test specification path'} disabled={testRepoReadOnly || openingTestRepo} on:keydown={specificationKeydown}/>
        {#if testRepoError}<p class="test-error" role="alert">{testRepoError}</p>{/if}
    </div>
    {/if}
    <div class="sx-label">Startup settings</div>
    <TextAreaInput bind:text={text} cols=50 rows=20/>
</PopupBox>
