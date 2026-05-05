export class OpenAIChatProvider {
    constructor({llm = {}, fetchImpl = null} = {}) {
        this.llm = llm
        this.fetchImpl = fetchImpl
    }

    isConfigured() {
        return Boolean(this.llm?.endpoint && this.llm?.model)
    }

    async complete({messages, tools = []} = {}) {
        if (!this.isConfigured()) throw new Error('OpenAI chat provider requires llm.endpoint and llm.model')
        const fetchFn = this.fetchImpl ?? globalThis.fetch
        if (typeof fetchFn !== 'function') throw new Error('fetch is not available in this runtime')

        const response = await fetchFn(`${normalizeEndpoint(this.llm.endpoint)}/chat/completions`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: this.llm.model,
                messages,
                ...(tools.length ? {tools, tool_choice: 'auto'} : {}),
            }),
        })

        if (!response.ok) {
            const text = await safeReadText(response)
            throw new Error(`LLM bridge error: ${response.status} ${text || response.statusText}`)
        }

        return response.json()
    }
}

export function normalizeEndpoint(endpoint) {
    return String(endpoint || '').replace(/\/+$/, '')
}

async function safeReadText(response) {
    try {
        return await response.text()
    }
    catch {
        return ''
    }
}
