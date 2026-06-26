<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelSelect from '../../fragments/label-select.svelte'
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

onMount(() => {
    tx.send('modal div', box.div)
})

export const handlers = {
    "-> show"({title, pos, team: nodeTeam, teams: modelTeams, json, ok}) {

        box.title = title
        box.pos = {...pos}
        box.ok = () => {
            const result = checkJSON()
            if (!result.ok) {
                box.show(pos)
                return
            }
            ok?.({team: team || null, sx: result.value})
        }

        team = nodeTeam ?? ''
        teams = makeTeamOptions(modelTeams)
        text = json ? JSON.stringify(json, null, '  ') : ''

        box.show(pos)
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
</style>

<PopupBox box={box}>
    <LabelSelect label="Team" style="width: 6rem;" bind:value={team} options={teams}/>
    <div class="sx-label">Settings</div>
    <TextAreaInput bind:text={text} cols=50 rows=20/>
</PopupBox>
