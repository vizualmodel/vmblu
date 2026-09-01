<script>
import {onMount} from 'svelte'
import PopupBox from '../../fragments/popup-box.svelte'
import Button from '../../fragments/button.svelte'
import TeamField from '../../fragments/team-field.svelte'

export let tx

const DEFAULT_TEAM = 'default'
const DEFAULT_COLOR = '#0066ff'

let box = {
    div: null,
    pos: null,
    title: 'Teams',
    ok: null,
    cancel: null,
}

let _teams = []
$: _teamNames = teamNames(_teams)

onMount(() => tx.send('modal div', box.div))

export const handlers = {'-> show': show}

function show({teams, fallbackColor, pos, ok, cancel}) {
    _teams = teamsToRows(teams, fallbackColor)
    box.pos = {...(pos ?? {x: 40, y: 40})}
    box.ok = ok ? () => ok(cleanTeams(_teams, fallbackColor)) : null
    box.cancel = cancel ? () => cancel() : null
    box.show(box.pos)
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
        rows.push({name, color: team?.color ?? DEFAULT_COLOR, locked: false})
    }
    return rows
}

function cleanTeams(rows, fallbackColor) {
    const teams = {}
    const names = new Set()
    const defaultColor = validColor(fallbackColor) ? fallbackColor : DEFAULT_COLOR

    for (const row of rows ?? []) {
        const name = row.locked ? DEFAULT_TEAM : row.name.trim()
        if (!name || names.has(name)) continue
        names.add(name)
        teams[name] = {color: validColor(row.color) ? row.color : defaultColor}
    }

    if (!teams.default) teams.default = {color: defaultColor}
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
</script>

<style>
.heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.45rem;
}

.heading span {
    color: #ccc;
    font-family: var(--fBase);
    font-size: var(--fSmall);
}

.team-list {
    display: grid;
    gap: 0.35rem;
}
</style>

<PopupBox box={box}>
    <div class="heading">
        <span>Teams</span>
        <Button label="+" click={addTeam} />
    </div>
    <div class="team-list">
        {#each _teams as team, index}
            <TeamField {team} duplicate={isDuplicate(team)} update={(patch) => updateTeam(index, patch)} remove={() => removeTeam(index)} />
        {/each}
    </div>
</PopupBox>
