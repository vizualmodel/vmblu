import {ModelMap} from './model-map.js'
import {style} from '../util/index.js'
import {SCHEMA_VERSION} from './schema-version.js'

const DEFAULT_TEAM = 'default'
const DEFAULT_TEAM_COLOR = '#0066ff'

export function ModelHeader() {

    const today = new Date()

    // Set the schema version in the header
    this.version = SCHEMA_VERSION
    this.created = today.toLocaleString()
    this.saved = today.toLocaleString()
    this.utc = today.toJSON()
    this.style = style
    this.teams = makeTeams(null, style.rgb)
    this.teamStyles = makeTeamStyles(this.teams)
    this.runtime = '@vizualmodel/vmblu-runtime/rt-base'
    this.runtimeSettings = null
    this.agent = null
}
ModelHeader.prototype = {

    // get the header data from the raw file
    cook(arl, raw) {

        const today = new Date()

        // date and version
        this.created = raw.created?.slice() ?? today.toLocaleString(),
        this.saved = raw.saved?.slice() ?? today.toLocaleString(),
        this.utc = raw.utc?.slice() ?? today.toJSON()
        this.version = raw.version?.slice() ?? 'no version'

        // Create a style for the model
        this.style = style.create(raw.style)
        this.teams = makeTeams(raw.teams, raw.style)
        this.teamStyles = makeTeamStyles(this.teams)

        // get the runtime
        this.runtime = raw.runtime?.slice() ?? '@vizualmodel/vmblu-runtime/rt-base'

        // get runtime configuration
        this.runtimeSettings = raw.runtimeSettings ? JSON.parse(JSON.stringify(raw.runtimeSettings)) : null

        // get the agent configuration
        this.agent = raw.agent ? JSON.parse(JSON.stringify(raw.agent)) : null
    },

    // copy
    copyWithoutStyle() {

        const raw = {
            // Set the schema version in the header
            version: this.version = SCHEMA_VERSION,
            created: this.created,
            saved: this.saved,
            utc: this.utc,
            style: this.style.rgb,
            teams: cloneTeams(this.teams),
            runtime: this.runtime
        }

        if (this.runtimeSettings) raw.runtimeSettings = JSON.parse(JSON.stringify(this.runtimeSettings))
        if (this.agent) raw.agent = JSON.parse(JSON.stringify(this.agent))

        return raw
    },

    teamStyle(team) {

        const key = team?.length ? team : DEFAULT_TEAM
        const teamStyle = this.teamStyles?.[key] ?? this.teamStyles?.[DEFAULT_TEAM]
        if (!this.teamStyles?.[key] && key !== DEFAULT_TEAM) {
            console.warn(`Unknown team '${key}', using '${DEFAULT_TEAM}'`)
        }
        return teamStyle ?? this.style
    },

    setTeams(teams) {

        this.teams = makeTeams(teams, this.style.rgb)
        this.teamStyles = makeTeamStyles(this.teams)
        this.style.adapt(this.teams[DEFAULT_TEAM].color)
    }
}

function makeTeams(rawTeams, fallbackColor = DEFAULT_TEAM_COLOR) {

    const teams = {}
    const source = rawTeams && typeof rawTeams === 'object' ? rawTeams : null
    const fallback = validColor(fallbackColor) ? fallbackColor : DEFAULT_TEAM_COLOR

    if (source) {
        for (const [name, value] of Object.entries(source)) {
            if (!name?.length) continue
            const color = typeof value === 'string' ? value : value?.color
            teams[name] = {
                ...(typeof value === 'object' && value !== null ? value : {}),
                color: validColor(color) ? color : fallback
            }
        }
    }

    if (!teams[DEFAULT_TEAM]) teams[DEFAULT_TEAM] = {color: fallback}
    if (!validColor(teams[DEFAULT_TEAM].color)) teams[DEFAULT_TEAM].color = fallback

    return cloneTeams(teams)
}

function makeTeamStyles(teams) {

    const teamStyles = {}
    for (const [name, team] of Object.entries(teams)) {
        teamStyles[name] = style.create(team.color)
    }
    return teamStyles
}

function cloneTeams(teams) {

    return JSON.parse(JSON.stringify(teams ?? {[DEFAULT_TEAM]: {color: DEFAULT_TEAM_COLOR}}))
}

function validColor(color) {

    return typeof color === 'string' && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(color)
}
