export const AGENT_SCHEMA = 'https://vmblu.dev/schemas/agents.v1.json'

export function makeDefaultAgentSettings(enabled = false) {
    return {
        schema: AGENT_SCHEMA,
        version: 1,
        enabled,
        defaultInterface: 'embedded',
        profiles: [{
            id: 'assistant',
            title: 'Assistant',
            enabled: true,
            permissions: {
                tools: {allow: []},
                events: {allow: []},
                probes: {allow: []},
            },
            limits: {maxToolCallsPerTurn: 10},
        }],
        interfaces: [{
            id: 'embedded',
            title: 'Embedded',
            enabled: true,
            kind: 'embedded',
            profile: 'assistant',
            instructions: 'Operate the application through published tools.',
            llm: {
                provider: 'openai',
                model: 'gpt-4.1-mini',
                endpoint: 'http://127.0.0.1:8080/v1',
            },
            ui: {mode: 'overlay'},
        }],
    }
}
