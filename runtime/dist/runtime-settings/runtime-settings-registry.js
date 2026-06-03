var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// rt-base/runtime-settings.js
var defaultWorker = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
var defaultRun = /* @__PURE__ */ __name(() => ({
  worker: defaultWorker()
}), "defaultRun");
var defaultMonitor = /* @__PURE__ */ __name(() => ({
  logMessages: false,
  logTimings: false
}), "defaultMonitor");
function make() {
  return {
    run: defaultRun(),
    monitor: defaultMonitor()
  };
}
__name(make, "make");
function normalize(dx = null) {
  var _a, _b;
  const defaults = make();
  if (!dx || typeof dx !== "object") return defaults;
  const normalized = {
    run: {
      ...defaults.run,
      ...dx.run ?? {},
      worker: {
        ...defaults.run.worker,
        ...((_a = dx.run) == null ? void 0 : _a.worker) ?? dx.worker ?? {}
      }
    },
    monitor: {
      ...defaults.monitor,
      ...dx.monitor ?? {},
      logMessages: ((_b = dx.monitor) == null ? void 0 : _b.logMessages) ?? dx.logMessages ?? defaults.monitor.logMessages
    }
  };
  normalized.run.worker.on = !!normalized.run.worker.on;
  normalized.run.worker.path = normalized.run.worker.path ?? "";
  normalized.monitor.logMessages = !!normalized.monitor.logMessages;
  normalized.monitor.logTimings = !!normalized.monitor.logTimings;
  return normalized;
}
__name(normalize, "normalize");
function clone(dx = null) {
  return normalize(dx);
}
__name(clone, "clone");
function reset(target) {
  const defaults = make();
  assign(target, defaults);
  return target;
}
__name(reset, "reset");
function assign(target, dx = null) {
  const normalized = normalize(dx);
  target.run = structuredClone(normalized.run);
  target.monitor = structuredClone(normalized.monitor);
  delete target.logMessages;
  delete target.worker;
  delete target.security;
  return target;
}
__name(assign, "assign");
function isDefault(dx = null) {
  const normalized = normalize(dx);
  return JSON.stringify(normalized) === JSON.stringify(make());
}
__name(isDefault, "isDefault");
function makeModel() {
  return {
    run: {},
    monitor: {}
  };
}
__name(makeModel, "makeModel");
function normalizeModel(settings = null) {
  const defaults = makeModel();
  if (!settings || typeof settings !== "object") return defaults;
  return {
    run: {
      ...defaults.run,
      ...settings.run ?? {}
    },
    monitor: {
      ...defaults.monitor,
      ...settings.monitor ?? {}
    }
  };
}
__name(normalizeModel, "normalizeModel");
function effectivePolicy(modelSettings = null, nodeDx = null) {
  return {
    model: normalizeModel(modelSettings),
    node: normalize(nodeDx)
  };
}
__name(effectivePolicy, "effectivePolicy");
var runtimeSettings = {
  make,
  normalize,
  clone,
  reset,
  assign,
  isDefault,
  makeModel,
  normalizeModel,
  effectivePolicy
};

// rt-als/runtime-settings.js
var PERMISSIONS = ["allow", "warn", "deny"];
var PERMISSION_ORDER = { deny: 0, warn: 1, allow: 2 };
var defaultWorker2 = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
var defaultRun2 = /* @__PURE__ */ __name(() => ({
  worker: defaultWorker2()
}), "defaultRun");
var defaultMonitor2 = /* @__PURE__ */ __name(() => ({
  logMessages: false,
  logTimings: false
}), "defaultMonitor");
var defaultFsOperation = /* @__PURE__ */ __name((mode = "deny") => ({
  mode,
  roots: []
}), "defaultFsOperation");
var defaultNetOperation = /* @__PURE__ */ __name((mode = "deny") => ({
  mode,
  hosts: []
}), "defaultNetOperation");
var defaultProcessOperation = /* @__PURE__ */ __name((mode = "deny") => ({
  mode,
  commands: []
}), "defaultProcessOperation");
var defaultSecurityPolicy = /* @__PURE__ */ __name(() => ({
  fs: {
    read: defaultFsOperation(),
    write: defaultFsOperation(),
    delete: defaultFsOperation()
  },
  net: {
    egress: defaultNetOperation()
  },
  process: {
    exec: defaultProcessOperation()
  }
}), "defaultSecurityPolicy");
var defaultSecurity = /* @__PURE__ */ __name(() => ({
  enabled: false,
  ...defaultSecurityPolicy()
}), "defaultSecurity");
function make2() {
  return {
    run: defaultRun2(),
    monitor: defaultMonitor2(),
    security: defaultSecurity()
  };
}
__name(make2, "make");
function normalize2(dx = null) {
  var _a, _b;
  const defaults = make2();
  if (!dx || typeof dx !== "object") return defaults;
  const legacySafety = dx.safety ?? {};
  const security = normalizeNodeSecurity(dx.security, legacySafety);
  const normalized = {
    run: {
      ...defaults.run,
      ...dx.run ?? {},
      worker: {
        ...defaults.run.worker,
        ...((_a = dx.run) == null ? void 0 : _a.worker) ?? dx.worker ?? {}
      }
    },
    monitor: {
      ...defaults.monitor,
      ...dx.monitor ?? {},
      logMessages: ((_b = dx.monitor) == null ? void 0 : _b.logMessages) ?? dx.logMessages ?? defaults.monitor.logMessages
    },
    security
  };
  normalized.run.worker.on = !!normalized.run.worker.on;
  normalized.run.worker.path = normalized.run.worker.path ?? "";
  normalized.monitor.logMessages = !!normalized.monitor.logMessages;
  normalized.monitor.logTimings = !!normalized.monitor.logTimings;
  return normalized;
}
__name(normalize2, "normalize");
function clone2(dx = null) {
  return normalize2(dx);
}
__name(clone2, "clone");
function reset2(target) {
  const defaults = make2();
  assign2(target, defaults);
  return target;
}
__name(reset2, "reset");
function assign2(target, dx = null) {
  const normalized = normalize2(dx);
  target.run = structuredClone(normalized.run);
  target.monitor = structuredClone(normalized.monitor);
  target.security = structuredClone(normalized.security);
  delete target.logMessages;
  delete target.worker;
  delete target.safety;
  return target;
}
__name(assign2, "assign");
function isDefault2(dx = null) {
  const normalized = normalize2(dx);
  const defaults = make2();
  if (!normalized.security.enabled || isDefaultSecurityPolicy(normalized.security)) {
    normalized.security = structuredClone(defaults.security);
  }
  return JSON.stringify(normalized) === JSON.stringify(defaults);
}
__name(isDefault2, "isDefault");
function makeModel2() {
  return {
    run: {},
    monitor: {},
    security: defaultSecurityPolicy()
  };
}
__name(makeModel2, "makeModel");
function normalizeModel2(settings = null) {
  const defaults = makeModel2();
  if (!settings || typeof settings !== "object") return defaults;
  return {
    run: {
      ...defaults.run,
      ...settings.run ?? {}
    },
    monitor: {
      ...defaults.monitor,
      ...settings.monitor ?? {}
    },
    security: normalizeModelSecurity(settings.security)
  };
}
__name(normalizeModel2, "normalizeModel");
function effectivePolicy2(modelSettings = null, nodeDx = null) {
  var _a;
  const hasModelSecurity = !!(modelSettings && typeof modelSettings === "object" && modelSettings.security);
  const model = normalizeModel2(modelSettings);
  const node = normalize2(nodeDx);
  const nodeSecurity = ((_a = node.security) == null ? void 0 : _a.enabled) ? node.security : defaultSecurity();
  return {
    active: hasModelSecurity,
    security: intersectSecurity(model.security, nodeSecurity),
    model,
    node
  };
}
__name(effectivePolicy2, "effectivePolicy");
function normalizeNodeSecurity(security = null, legacySafety = {}) {
  const source = security ?? {};
  const legacy = legacyNodeSecurity(source);
  const enabled = source.enabled ?? legacySafety.on ?? false;
  return {
    enabled: !!enabled,
    ...normalizeSecurityPolicy(source, legacy)
  };
}
__name(normalizeNodeSecurity, "normalizeNodeSecurity");
function normalizeModelSecurity(security = null) {
  return normalizeSecurityPolicy(security, legacyModelSecurity(security));
}
__name(normalizeModelSecurity, "normalizeModelSecurity");
function normalizeSecurityPolicy(source = null, legacy = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const defaults = defaultSecurityPolicy();
  const value = source ?? {};
  return {
    fs: {
      read: normalizeFsOperation(((_a = value.fs) == null ? void 0 : _a.read) ?? ((_b = legacy.fs) == null ? void 0 : _b.read) ?? defaults.fs.read),
      write: normalizeFsOperation(((_c = value.fs) == null ? void 0 : _c.write) ?? ((_d = legacy.fs) == null ? void 0 : _d.write) ?? defaults.fs.write),
      delete: normalizeFsOperation(((_e = value.fs) == null ? void 0 : _e.delete) ?? ((_f = legacy.fs) == null ? void 0 : _f.delete) ?? defaults.fs.delete)
    },
    net: {
      egress: normalizeNetOperation(((_g = value.net) == null ? void 0 : _g.egress) ?? ((_h = legacy.net) == null ? void 0 : _h.egress) ?? defaults.net.egress)
    },
    process: {
      exec: normalizeProcessOperation(((_i = value.process) == null ? void 0 : _i.exec) ?? ((_j = legacy.process) == null ? void 0 : _j.exec) ?? defaults.process.exec)
    }
  };
}
__name(normalizeSecurityPolicy, "normalizeSecurityPolicy");
function normalizeFsOperation(value = null) {
  const mode = normalizeMode(value == null ? void 0 : value.mode);
  return {
    mode,
    roots: mode === "deny" ? [] : normalizeList(value == null ? void 0 : value.roots)
  };
}
__name(normalizeFsOperation, "normalizeFsOperation");
function normalizeNetOperation(value = null) {
  const mode = normalizeMode(value == null ? void 0 : value.mode);
  return {
    mode,
    hosts: mode === "deny" ? [] : normalizeList(value == null ? void 0 : value.hosts)
  };
}
__name(normalizeNetOperation, "normalizeNetOperation");
function normalizeProcessOperation(value = null) {
  const mode = normalizeMode(value == null ? void 0 : value.mode);
  return {
    mode,
    commands: mode === "deny" ? [] : normalizeList(value == null ? void 0 : value.commands)
  };
}
__name(normalizeProcessOperation, "normalizeProcessOperation");
function normalizeMode(value) {
  return PERMISSIONS.includes(value) ? value : "deny";
}
__name(normalizeMode, "normalizeMode");
function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
}
__name(normalizeList, "normalizeList");
function legacyModelSecurity(security = null) {
  if (!(security == null ? void 0 : security.defaults) && !(security == null ? void 0 : security.allow)) return {};
  const defaults = security.defaults ?? {};
  const allow = security.allow ?? {};
  return {
    fs: {
      read: defaultFsOperation("deny"),
      write: { mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots) },
      delete: { mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots) }
    },
    net: {
      egress: { mode: normalizeLegacyMode(defaults.net), hosts: normalizeList(allow.netHosts) }
    },
    process: {
      exec: { mode: normalizeLegacyMode(defaults.process), commands: [] }
    }
  };
}
__name(legacyModelSecurity, "legacyModelSecurity");
function legacyNodeSecurity(security = null) {
  if (!(security == null ? void 0 : security.request)) return {};
  const request = security.request ?? {};
  const allow = request.allow ?? {};
  return {
    fs: {
      read: defaultFsOperation("deny"),
      write: { mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots) },
      delete: { mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots) }
    },
    net: {
      egress: { mode: normalizeLegacyMode(request.net), hosts: normalizeList(allow.netHosts) }
    },
    process: {
      exec: { mode: normalizeLegacyMode(request.process), commands: [] }
    }
  };
}
__name(legacyNodeSecurity, "legacyNodeSecurity");
function normalizeLegacyMode(value) {
  return value === "inherit" ? "deny" : normalizeMode(value);
}
__name(normalizeLegacyMode, "normalizeLegacyMode");
function intersectSecurity(model, node) {
  return {
    fs: {
      read: intersectFsOperation(model.fs.read, node.fs.read),
      write: intersectFsOperation(model.fs.write, node.fs.write),
      delete: intersectFsOperation(model.fs.delete, node.fs.delete)
    },
    net: {
      egress: intersectNetOperation(model.net.egress, node.net.egress)
    },
    process: {
      exec: intersectProcessOperation(model.process.exec, node.process.exec)
    }
  };
}
__name(intersectSecurity, "intersectSecurity");
function intersectFsOperation(model, node) {
  const mode = stricterMode(model.mode, node.mode);
  return {
    mode,
    roots: mode === "deny" ? [] : intersectScope(model.roots, node.roots)
  };
}
__name(intersectFsOperation, "intersectFsOperation");
function intersectNetOperation(model, node) {
  const mode = stricterMode(model.mode, node.mode);
  return {
    mode,
    hosts: mode === "deny" ? [] : intersectScope(model.hosts, node.hosts)
  };
}
__name(intersectNetOperation, "intersectNetOperation");
function intersectProcessOperation(model, node) {
  const mode = stricterMode(model.mode, node.mode);
  return {
    mode,
    commands: mode === "deny" ? [] : intersectScope(model.commands, node.commands)
  };
}
__name(intersectProcessOperation, "intersectProcessOperation");
function stricterMode(modelMode, nodeMode) {
  return PERMISSION_ORDER[nodeMode] <= PERMISSION_ORDER[modelMode] ? nodeMode : modelMode;
}
__name(stricterMode, "stricterMode");
function intersectScope(modelValues = [], nodeValues = []) {
  if (!Array.isArray(modelValues) || !modelValues.length) return Array.isArray(nodeValues) ? nodeValues.slice() : [];
  if (!Array.isArray(nodeValues) || !nodeValues.length) return modelValues.slice();
  const allowed = new Set(modelValues);
  return nodeValues.filter((value) => allowed.has(value));
}
__name(intersectScope, "intersectScope");
function isDefaultSecurityPolicy(security = {}) {
  const { enabled, ...policy } = security;
  return JSON.stringify(policy) === JSON.stringify(defaultSecurityPolicy());
}
__name(isDefaultSecurityPolicy, "isDefaultSecurityPolicy");
var runtimeSettings2 = {
  make: make2,
  normalize: normalize2,
  clone: clone2,
  reset: reset2,
  assign: assign2,
  isDefault: isDefault2,
  makeModel: makeModel2,
  normalizeModel: normalizeModel2,
  effectivePolicy: effectivePolicy2
};

// runtime-settings-registry.js
var RT_BASE = "@vizualmodel/vmblu-runtime/rt-base";
var RT_ALS = "@vizualmodel/vmblu-runtime/rt-als";
var RT_BROWSER_AGENT = "@vizualmodel/vmblu-runtime/rt-browser-agent";
var RT_NODEJS_AGENT = "@vizualmodel/vmblu-runtime/rt-nodejs-agent";
var RT_AGENT = "@vizualmodel/vmblu-runtime/rt-agent";
var RUNTIME_DESCRIPTORS = [
  {
    id: RT_BASE,
    name: "rt-base",
    settings: runtimeSettings,
    supportsAgents: false
  },
  {
    id: RT_ALS,
    name: "rt-als",
    settings: runtimeSettings2,
    supportsAgents: false
  },
  {
    id: RT_BROWSER_AGENT,
    name: "rt-browser-agent",
    settings: runtimeSettings,
    supportsAgents: true
  },
  {
    id: RT_NODEJS_AGENT,
    name: "rt-nodejs-agent",
    settings: runtimeSettings2,
    supportsAgents: true,
    aliases: [RT_AGENT, "rt-agent"]
  }
];
function listRuntimeDescriptors() {
  return RUNTIME_DESCRIPTORS.map(({ id, name, supportsAgents }) => ({ id, name, supportsAgents }));
}
__name(listRuntimeDescriptors, "listRuntimeDescriptors");
function getRuntimeDescriptor(runtime) {
  return RUNTIME_DESCRIPTORS.find((candidate) => {
    var _a;
    return candidate.id === runtime || candidate.name === runtime || ((_a = candidate.aliases) == null ? void 0 : _a.includes(runtime));
  }) ?? RUNTIME_DESCRIPTORS[0];
}
__name(getRuntimeDescriptor, "getRuntimeDescriptor");
function getRuntimeSettings(runtime) {
  return getRuntimeDescriptor(runtime).settings;
}
__name(getRuntimeSettings, "getRuntimeSettings");
export {
  RT_AGENT,
  RT_ALS,
  RT_BASE,
  RT_BROWSER_AGENT,
  RT_NODEJS_AGENT,
  RUNTIME_DESCRIPTORS,
  getRuntimeDescriptor,
  getRuntimeSettings,
  listRuntimeDescriptors
};
//# sourceMappingURL=runtime-settings-registry.js.map