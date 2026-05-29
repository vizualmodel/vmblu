export class AgentPolicy {
    static fromAgent(agent = {}) {
        return new AgentPolicy(agent?.config ?? agent)
    }

    constructor(agent = {}) {
        const permissions = agent?.permissions ?? {}
        this.agentId = agent?.id ?? null
        this.enabled = agent?.enabled !== false
        this.permissions = {
            tools: normalizePermissionSet(permissions.tools),
            probes: normalizePermissionSet(permissions.probes),
            events: normalizePermissionSet(permissions.events),
        }
    }

    canUse(kind, id) {
        const set = this.permissions?.[kind]
        if (!set || !id) return {allowed: true, reason: 'no_policy'}
        if (matches(set.deny, id)) return {allowed: false, reason: `${kind}_denied`, rule: 'deny'}
        if (set.hasAllowList && !matches(set.allow, id)) return {allowed: false, reason: `${kind}_not_allowed`, rule: 'allow'}
        return {allowed: true, reason: set.hasAllowList ? 'allowed_list' : 'default_allow', rule: set.hasAllowList ? 'allow' : 'default'}
    }

    approvalDecision(tool = {}) {
        if (tool?.approval === 'always') {
            return {required: true, reason: 'approval_required', rule: 'tool.approval'}
        }
        return {required: false, reason: 'approval_not_required', rule: 'tool.approval'}
    }

    filterCapabilities(capabilities = {}) {
        return {
            ...capabilities,
            tools: (capabilities?.tools ?? []).filter(tool => this.canUse('tools', tool?.id).allowed),
            probes: (capabilities?.probes ?? []).filter(probe => this.canUse('probes', probe?.id).allowed),
            events: (capabilities?.events ?? []).filter(event => this.canUse('events', event?.id).allowed),
        }
    }

    traceDetails() {
        return {
            agentId: this.agentId,
            enabled: this.enabled,
            permissions: this.permissions,
        }
    }

    toJSON() {
        return this.traceDetails()
    }
}

function normalizePermissionSet(value = {}) {
    const hasAllowList = Array.isArray(value?.allow)
    return {
        allow: normalizeStringList(value?.allow),
        deny: normalizeStringList(value?.deny),
        hasAllowList,
    }
}

function normalizeStringList(value) {
    if (!Array.isArray(value)) return []
    return value.map(item => String(item ?? '').trim()).filter(Boolean)
}

function matches(patterns, id) {
    return patterns.includes('*') || patterns.includes(id)
}
