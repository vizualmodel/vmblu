<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import LabelInfoField from '../../fragments/label-info-field.svelte'
import LabelInputField from '../../fragments/label-input-field.svelte'
import ButtonRow from '../../fragments/button-row.svelte'
import Button from '../../fragments/button.svelte'
import TeamField from '../../fragments/team-field.svelte'
import {getRuntimeDescriptor} from '../../../runtime/runtime-settings-registry.js'

export let tx //, sx

// the popup box
let box = {
    div: null,
    pos: null,
    title: '',
    ok: null,
    cancel: null,
}

const DEFAULT_TEAM = 'default'
const DEFAULT_COLOR = '#0066ff'

// The local data
let _path, _created, _version, _saved, _runtime, _runtimeSettings, _agent, _capabilities, _teams

$: _supportsAgents = getRuntimeDescriptor(_runtime).supportsAgents
$: _teamNames = teamNames(_teams)

onMount( () => {
    // send the box div
    tx.send('modal div', box.div)
})

export const handlers = {

    // Settings is the link header of the document
    onShow({title, path, settings, capabilities, pos, ok, cancel, onColor}) {

        // The box 
        box.title = title,
        box.pos = {...pos}
        box.ok = ok ? () => {
            ok({
                runtime: _runtime,
                runtimeSettings: _runtimeSettings,
                agent: _agent,
                teams: cleanTeams(_teams),
            })
        } : null
        box.cancel = cancel ? () => cancel() : null

        // The field settings
        _path = path
        _version = settings.version
        _created = settings.created
        _saved = settings.saved
        _runtime = settings.runtime
        _runtimeSettings = cloneSettings(settings.runtimeSettings)
        _agent = cloneSettings(settings.agent)
        _capabilities = cloneSettings(capabilities)
        _teams = teamsToRows(settings.teams, settings.style?.rgb)

        // and show
        box.show(pos)
    }
}

function cloneSettings(settings) {
    if (!settings) return null
    return JSON.parse(JSON.stringify(settings))
}

function teamsToRows(teams, fallbackColor) {
    const rows = []
    const source = teams ?? {default: {color: fallbackColor ?? DEFAULT_COLOR}}

    rows.push({
        name: DEFAULT_TEAM,
        color: source.default?.color ?? fallbackColor ?? DEFAULT_COLOR,
        locked: true,
    })

    for (const [name, team] of Object.entries(source)) {
        if (name === DEFAULT_TEAM) continue
        rows.push({
            name,
            color: team?.color ?? DEFAULT_COLOR,
            locked: false,
        })
    }

    return rows
}

function cleanTeams(rows) {
    const teams = {}
    const names = new Set()

    for (const row of rows ?? []) {
        const name = row.locked ? DEFAULT_TEAM : row.name.trim()
        if (!name || names.has(name)) continue
        names.add(name)
        teams[name] = {color: validColor(row.color) ? row.color : DEFAULT_COLOR}
    }

    if (!teams.default) teams.default = {color: DEFAULT_COLOR}

    return teams
}

function addTeam() {
    const names = new Set((_teams ?? []).map(row => row.name.trim()).filter(Boolean))
    let index = 1
    let name = `team${index}`
    while (names.has(name)) name = `team${++index}`

    _teams = [...(_teams ?? []), {name, color: DEFAULT_COLOR, locked: false}]
}

function removeTeam(index) {
    _teams = _teams.filter((row, i) => i !== index || row.locked)
}

function updateTeam(index, patch) {
    _teams = _teams.map((row, i) => i === index ? {...row, ...patch} : row)
}

function teamNames(rows) {
    const counts = new Map()
    for (const row of rows ?? []) {
        const name = row.name.trim()
        if (!name) continue
        counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return counts
}

function isDuplicate(row) {
    const name = row.name.trim()
    return !!name && (_teamNames.get(name) ?? 0) > 1
}

function validColor(color) {
    return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(color ?? '')
}

function showRuntimeSettings() {
    tx.send('model runtime settings', {
        runtime: _runtime,
        settings: _runtimeSettings,
        pos: {
            x: (box.pos?.x ?? 25) + 40,
            y: (box.pos?.y ?? 25) + 40,
        },
        ok(settings) {
            _runtimeSettings = settings
        },
    })
}

function showAgentSettings() {
    if (!_supportsAgents) return

    tx.send('agent settings', {
        settings: _agent,
        capabilities: _capabilities,
        pos: {
            x: (box.pos?.x ?? 25) + 70,
            y: (box.pos?.y ?? 25) + 70,
        },
        ok(settings) {
            _agent = settings
        },
    })
}

</script>
<style>
.teams {
    margin-top: 0.5rem;
}

.teams-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.45rem 0 0.25rem;
}

.teams-heading label {
    width: 6.5rem;
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.team-list {
    display: grid;
    gap: 0.35rem;
    margin-left: 6rem;
}
</style>
<PopupBox box={box}>
    <LabelInfoField label="File:" style="width: 6rem;" info={_path}  />
    <LabelInfoField label="Vmblu Version:" style="width: 6rem;" info={_version} />
    <LabelInfoField label="Creation Date:" style="width: 6rem;" info={_created} />
    <LabelInfoField label="Last Saved:" style="width: 6rem;" info={_saved}  />
    <LabelInputField label="Runtime" style="width: 6rem;" bind:input={_runtime} check={null}/>
    <ButtonRow label="Settings" style="width: 6rem;">
        <Button label="Runtime" click={showRuntimeSettings} />
        {#if _supportsAgents}
            <Button label="Agents" click={showAgentSettings} />
        {/if}
    </ButtonRow>
    <div class="teams">
        <div class="teams-heading">
            <label>Teams</label>
            <Button label="+" click={addTeam} />
        </div>
        <div class="team-list">
            {#each _teams ?? [] as team, index}
                <TeamField {team} duplicate={isDuplicate(team)} update={(patch) => updateTeam(index, patch)} remove={() => removeTeam(index)} />
            {/each}
        </div>
    </div>
</PopupBox>
