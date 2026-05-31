var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// agent-adapters/index.js
var index_exports = {};
__export(index_exports, {
  AgentAdapterRegistry: () => AgentAdapterRegistry,
  AgentCapabilityFilter: () => AgentCapabilityFilter,
  HttpAgentAdapter: () => HttpAgentAdapter,
  OpenAIAgentAdapter: () => OpenAIAgentAdapter,
  VmbluAgentAdapter: () => VmbluAgentAdapter,
  agentAdapterRegistry: () => agentAdapterRegistry,
  normalizeCapabilities: () => normalizeCapabilities,
  normalizeOpenAIJsonSchema: () => normalizeOpenAIJsonSchema,
  normalizeTarget: () => normalizeTarget
});
module.exports = __toCommonJS(index_exports);

// rt-agent/agent-policy.js
var _AgentPolicy = class _AgentPolicy {
  static fromAgent(agent = {}) {
    return new _AgentPolicy((agent == null ? void 0 : agent.config) ?? agent);
  }
  constructor(agent = {}) {
    const permissions = (agent == null ? void 0 : agent.permissions) ?? {};
    this.agentId = (agent == null ? void 0 : agent.id) ?? null;
    this.enabled = (agent == null ? void 0 : agent.enabled) !== false;
    this.permissions = {
      tools: normalizePermissionSet(permissions.tools),
      probes: normalizePermissionSet(permissions.probes),
      events: normalizePermissionSet(permissions.events)
    };
  }
  canUse(kind, id) {
    var _a;
    const set = (_a = this.permissions) == null ? void 0 : _a[kind];
    if (!set || !id) return { allowed: true, reason: "no_policy" };
    if (matches(set.deny, id)) return { allowed: false, reason: `${kind}_denied`, rule: "deny" };
    if (set.hasAllowList && !matches(set.allow, id)) return { allowed: false, reason: `${kind}_not_allowed`, rule: "allow" };
    return { allowed: true, reason: set.hasAllowList ? "allowed_list" : "default_allow", rule: set.hasAllowList ? "allow" : "default" };
  }
  approvalDecision(tool = {}) {
    if ((tool == null ? void 0 : tool.approval) === "always") {
      return { required: true, reason: "approval_required", rule: "tool.approval" };
    }
    return { required: false, reason: "approval_not_required", rule: "tool.approval" };
  }
  filterCapabilities(capabilities = {}) {
    return {
      ...capabilities,
      tools: ((capabilities == null ? void 0 : capabilities.tools) ?? []).filter((tool) => this.canUse("tools", tool == null ? void 0 : tool.id).allowed),
      probes: ((capabilities == null ? void 0 : capabilities.probes) ?? []).filter((probe) => this.canUse("probes", probe == null ? void 0 : probe.id).allowed),
      events: ((capabilities == null ? void 0 : capabilities.events) ?? []).filter((event) => this.canUse("events", event == null ? void 0 : event.id).allowed)
    };
  }
  traceDetails() {
    return {
      agentId: this.agentId,
      enabled: this.enabled,
      permissions: this.permissions
    };
  }
  toJSON() {
    return this.traceDetails();
  }
};
__name(_AgentPolicy, "AgentPolicy");
var AgentPolicy = _AgentPolicy;
function normalizePermissionSet(value = {}) {
  const hasAllowList = Array.isArray(value == null ? void 0 : value.allow);
  return {
    allow: normalizeStringList(value == null ? void 0 : value.allow),
    deny: normalizeStringList(value == null ? void 0 : value.deny),
    hasAllowList
  };
}
__name(normalizePermissionSet, "normalizePermissionSet");
function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}
__name(normalizeStringList, "normalizeStringList");
function matches(patterns, id) {
  return patterns.includes("*") || patterns.includes(id);
}
__name(matches, "matches");

// agent-adapters/capability-filter.js
var _AgentCapabilityFilter = class _AgentCapabilityFilter {
  constructor({ agent = null } = {}) {
    this.agent = agent;
    this.policy = AgentPolicy.fromAgent(agent ?? {});
  }
  filter(capabilities = {}) {
    return this.policy.filterCapabilities(normalizeCapabilities(capabilities));
  }
};
__name(_AgentCapabilityFilter, "AgentCapabilityFilter");
var AgentCapabilityFilter = _AgentCapabilityFilter;
function normalizeCapabilities(capabilities = {}) {
  return {
    schema: (capabilities == null ? void 0 : capabilities.schema) ?? "https://vmblu.dev/schemas/capabilities.v1.json",
    version: (capabilities == null ? void 0 : capabilities.version) ?? 1,
    application: (capabilities == null ? void 0 : capabilities.application) ?? {},
    tools: Array.isArray(capabilities == null ? void 0 : capabilities.tools) ? capabilities.tools : [],
    probes: Array.isArray(capabilities == null ? void 0 : capabilities.probes) ? capabilities.probes : [],
    events: Array.isArray(capabilities == null ? void 0 : capabilities.events) ? capabilities.events : [],
    policies: (capabilities == null ? void 0 : capabilities.policies) ?? {},
    usageGuidance: (capabilities == null ? void 0 : capabilities.usageGuidance) ?? {}
  };
}
__name(normalizeCapabilities, "normalizeCapabilities");

// agent-adapters/http-adapter.js
var _HttpAgentAdapter = class _HttpAgentAdapter {
  constructor({ capabilities = {}, agent = null, server = null } = {}) {
    this.capabilities = capabilities;
    this.agent = agent;
    this.server = server ?? (agent == null ? void 0 : agent.server) ?? {};
    this.filter = new AgentCapabilityFilter({ agent });
  }
  project() {
    var _a;
    const view = this.filter.filter(this.capabilities);
    const basePath = this.server.basePath ?? "/agent";
    return {
      target: "http",
      agentId: ((_a = this.agent) == null ? void 0 : _a.id) ?? null,
      application: view.application,
      server: {
        host: this.server.host ?? "127.0.0.1",
        port: this.server.port ?? 8787,
        basePath
      },
      endpoints: {
        capabilities: `${basePath}/capabilities`,
        callTool: `${basePath}/tools/{toolId}/call`,
        readProbe: `${basePath}/probes/{probeId}/read`,
        events: `${basePath}/events`,
        approvals: `${basePath}/approvals/{approvalId}`
      },
      capabilities: view
    };
  }
};
__name(_HttpAgentAdapter, "HttpAgentAdapter");
var HttpAgentAdapter = _HttpAgentAdapter;

// agent-adapters/openai-adapter.js
var _OpenAIAgentAdapter = class _OpenAIAgentAdapter {
  constructor({ capabilities = {}, agent = null } = {}) {
    this.capabilities = capabilities;
    this.agent = agent;
    this.filter = new AgentCapabilityFilter({ agent });
  }
  project() {
    var _a;
    const view = this.filter.filter(this.capabilities);
    const map = /* @__PURE__ */ new Map();
    const tools = [
      ...this.projectTools(view.tools, map),
      ...this.projectProbes(view.probes, map)
    ];
    return {
      target: "openai",
      agentId: ((_a = this.agent) == null ? void 0 : _a.id) ?? null,
      application: view.application,
      tools,
      map
    };
  }
  projectTools(tools = [], map) {
    return tools.map((tool, index) => {
      var _a;
      const name = this.capabilityName("tool", tool.id, index);
      map == null ? void 0 : map.set(name, { kind: "tool", capability: tool });
      return {
        type: "function",
        function: {
          name,
          description: tool.description || tool.title || tool.id,
          parameters: normalizeOpenAIJsonSchema(((_a = tool.input) == null ? void 0 : _a.schema) ?? { type: "object", additionalProperties: true })
        }
      };
    });
  }
  projectProbes(probes = [], map) {
    return probes.map((probe, index) => {
      const name = this.capabilityName("probe", probe.id, index);
      map == null ? void 0 : map.set(name, { kind: "probe", capability: probe });
      return {
        type: "function",
        function: {
          name,
          description: `Read-only probe: ${probe.description || probe.title || probe.id}`,
          parameters: normalizeOpenAIJsonSchema(probe.schema ?? { type: "object", additionalProperties: true })
        }
      };
    });
  }
  capabilityName(prefix, id, index) {
    const base = String(id || `${prefix}_${index + 1}`).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
    return `${prefix}_${base || "capability"}_${index + 1}`;
  }
};
__name(_OpenAIAgentAdapter, "OpenAIAgentAdapter");
var OpenAIAgentAdapter = _OpenAIAgentAdapter;
function normalizeOpenAIJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return { type: "object", additionalProperties: true };
  if (Array.isArray(schema)) return schema.map((item) => normalizeOpenAIJsonSchema(item));
  const normalized = { ...schema };
  const types = Array.isArray(normalized.type) ? normalized.type : [normalized.type];
  if (types.includes("array") && !normalized.items) {
    normalized.items = {};
  }
  if (normalized.properties && typeof normalized.properties === "object") {
    normalized.properties = Object.fromEntries(
      Object.entries(normalized.properties).map(([key, value]) => [key, normalizeOpenAIJsonSchema(value)])
    );
  }
  if (normalized.items && typeof normalized.items === "object") {
    normalized.items = normalizeOpenAIJsonSchema(normalized.items);
  }
  return normalized;
}
__name(normalizeOpenAIJsonSchema, "normalizeOpenAIJsonSchema");

// agent-adapters/vmblu-adapter.js
var _VmbluAgentAdapter = class _VmbluAgentAdapter {
  constructor({ capabilities = {}, agent = null } = {}) {
    this.capabilities = capabilities;
    this.agent = agent;
    this.filter = new AgentCapabilityFilter({ agent });
  }
  project() {
    var _a;
    return {
      target: "vmblu",
      agentId: ((_a = this.agent) == null ? void 0 : _a.id) ?? null,
      capabilities: this.filter.filter(this.capabilities)
    };
  }
};
__name(_VmbluAgentAdapter, "VmbluAgentAdapter");
var VmbluAgentAdapter = _VmbluAgentAdapter;

// agent-adapters/adapter-registry.js
var _AgentAdapterRegistry = class _AgentAdapterRegistry {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map([
      ["http", HttpAgentAdapter],
      ["openai", OpenAIAgentAdapter],
      ["vmblu", VmbluAgentAdapter]
    ]);
  }
  get(target) {
    return this.adapters.get(normalizeTarget(target)) ?? null;
  }
  create(target, options = {}) {
    const Adapter = this.get(target);
    if (!Adapter) throw new Error(`Unknown agent adapter target: ${target}`);
    return new Adapter(options);
  }
  project({ target, capabilities, agent = null, server = null } = {}) {
    return this.create(target, { capabilities, agent, server }).project();
  }
  targets() {
    return [...this.adapters.keys()];
  }
};
__name(_AgentAdapterRegistry, "AgentAdapterRegistry");
var AgentAdapterRegistry = _AgentAdapterRegistry;
function normalizeTarget(target) {
  const normalized = String(target ?? "vmblu").trim().toLowerCase();
  if (normalized === "openai-tools" || normalized === "openai-agents") return "openai";
  if (normalized === "native") return "vmblu";
  return normalized;
}
__name(normalizeTarget, "normalizeTarget");
var agentAdapterRegistry = new AgentAdapterRegistry();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentAdapterRegistry,
  AgentCapabilityFilter,
  HttpAgentAdapter,
  OpenAIAgentAdapter,
  VmbluAgentAdapter,
  agentAdapterRegistry,
  normalizeCapabilities,
  normalizeOpenAIJsonSchema,
  normalizeTarget
});
//# sourceMappingURL=index.cjs.map