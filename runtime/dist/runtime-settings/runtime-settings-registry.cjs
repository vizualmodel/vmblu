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

// runtime-settings-registry.js
var runtime_settings_registry_exports = {};
__export(runtime_settings_registry_exports, {
  RT_AGENT: () => RT_AGENT,
  RT_ALS: () => RT_ALS,
  RT_BASE: () => RT_BASE,
  RT_BROWSER_AGENT: () => RT_BROWSER_AGENT,
  RT_NODEJS_AGENT: () => RT_NODEJS_AGENT,
  RUNTIME_DESCRIPTORS: () => RUNTIME_DESCRIPTORS,
  getRuntimeDescriptor: () => getRuntimeDescriptor,
  getRuntimeSettings: () => getRuntimeSettings,
  listRuntimeDescriptors: () => listRuntimeDescriptors
});
module.exports = __toCommonJS(runtime_settings_registry_exports);

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
var MODES = /* @__PURE__ */ new Set(["allow", "warn", "deny"]);
var denyOperation = /* @__PURE__ */ __name(() => ({ mode: "deny" }), "denyOperation");
var defaultSecurityPolicy = /* @__PURE__ */ __name(() => ({
  enabled: true,
  fs: {
    read: denyOperation(),
    write: denyOperation(),
    delete: denyOperation()
  },
  net: {
    egress: denyOperation()
  },
  process: {
    exec: denyOperation()
  }
}), "defaultSecurityPolicy");
function make2() {
  return runtimeSettings.make();
}
__name(make2, "make");
function normalize2(dx = null) {
  return runtimeSettings.normalize(dx);
}
__name(normalize2, "normalize");
function clone2(dx = null) {
  return runtimeSettings.clone(dx);
}
__name(clone2, "clone");
function reset2(target) {
  return runtimeSettings.reset(target);
}
__name(reset2, "reset");
function assign2(target, dx = null) {
  return runtimeSettings.assign(target, dx);
}
__name(assign2, "assign");
function isDefault2(dx = null) {
  return runtimeSettings.isDefault(dx);
}
__name(isDefault2, "isDefault");
function makeModel2() {
  return {
    ...runtimeSettings.makeModel(),
    security: defaultSecurityPolicy()
  };
}
__name(makeModel2, "makeModel");
function normalizeModel2(settings = null) {
  const base = runtimeSettings.normalizeModel(settings);
  if (!settings || typeof settings !== "object" || !settings.security) return base;
  return {
    ...base,
    security: normalizeModelSecurity(settings.security)
  };
}
__name(normalizeModel2, "normalizeModel");
function effectivePolicy2(modelSettings = null) {
  const model = normalizeModel2(modelSettings);
  return {
    active: !!model.security && model.security.enabled !== false,
    security: model.security ?? null,
    model
  };
}
__name(effectivePolicy2, "effectivePolicy");
function normalizeModelSecurity(security = null) {
  var _a, _b, _c, _d, _e;
  const legacy = legacyModelSecurity(security);
  const source = legacy ?? security ?? {};
  return {
    enabled: source.enabled !== false,
    fs: {
      read: normalizeOperation((_a = source.fs) == null ? void 0 : _a.read, "roots"),
      write: normalizeOperation((_b = source.fs) == null ? void 0 : _b.write, "roots"),
      delete: normalizeOperation((_c = source.fs) == null ? void 0 : _c.delete, "roots")
    },
    net: {
      egress: normalizeOperation((_d = source.net) == null ? void 0 : _d.egress, "hosts")
    },
    process: {
      exec: normalizeOperation((_e = source.process) == null ? void 0 : _e.exec, "commands")
    }
  };
}
__name(normalizeModelSecurity, "normalizeModelSecurity");
function normalizeOperation(value = null, scopeKey) {
  const mode = MODES.has(value == null ? void 0 : value.mode) ? value.mode : "deny";
  if (mode === "deny") return denyOperation();
  if ((value == null ? void 0 : value.all) === true) return { mode, all: true };
  const scope = normalizeList(value == null ? void 0 : value[scopeKey]);
  return scope.length ? { mode, [scopeKey]: scope } : denyOperation();
}
__name(normalizeOperation, "normalizeOperation");
function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}
__name(normalizeList, "normalizeList");
function legacyModelSecurity(security = null) {
  if (!security || !security.defaults && !security.allow && !security.mode && security.forwardEvents == null) return null;
  const defaults = security.defaults ?? {};
  const allow = security.allow ?? {};
  const fsRoots = normalizeList(allow.fsRoots);
  const hosts = normalizeList(allow.netHosts);
  return {
    enabled: security.mode !== "off",
    fs: {
      read: denyOperation(),
      write: legacyOperation(defaults.fs, "roots", fsRoots),
      delete: legacyOperation(defaults.fs, "roots", fsRoots)
    },
    net: {
      egress: legacyOperation(defaults.net, "hosts", hosts)
    },
    process: {
      exec: legacyOperation(defaults.process, "commands", [])
    }
  };
}
__name(legacyModelSecurity, "legacyModelSecurity");
function legacyOperation(value, scopeKey, scope) {
  const mode = MODES.has(value) ? value : "deny";
  if (mode === "deny") return denyOperation();
  return scope.length ? { mode, [scopeKey]: scope } : { mode, all: true };
}
__name(legacyOperation, "legacyOperation");
function validateModel(settings = null) {
  var _a, _b, _c, _d, _e;
  const errors = [];
  if (!settings || typeof settings !== "object" || !settings.security) return errors;
  const security = settings.security;
  if (legacyModelSecurity(security)) {
    errors.push({ code: "legacy_security", path: "security", message: "legacy application security settings are deprecated" });
    return errors;
  }
  validateKeys(errors, security, ["enabled", "fs", "net", "process"], "security");
  if (security.enabled != null && typeof security.enabled !== "boolean") {
    errors.push({ code: "malformed_security", path: "security.enabled", message: "security.enabled must be a boolean" });
  }
  validateKeys(errors, security.fs, ["read", "write", "delete"], "security.fs");
  validateKeys(errors, security.net, ["egress"], "security.net");
  validateKeys(errors, security.process, ["exec"], "security.process");
  validateOperation(errors, (_a = security.fs) == null ? void 0 : _a.read, "roots", "security.fs.read");
  validateOperation(errors, (_b = security.fs) == null ? void 0 : _b.write, "roots", "security.fs.write");
  validateOperation(errors, (_c = security.fs) == null ? void 0 : _c.delete, "roots", "security.fs.delete");
  validateOperation(errors, (_d = security.net) == null ? void 0 : _d.egress, "hosts", "security.net.egress");
  validateOperation(errors, (_e = security.process) == null ? void 0 : _e.exec, "commands", "security.process.exec");
  return errors;
}
__name(validateModel, "validateModel");
function validateKeys(errors, value, allowed, location) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push({ code: "malformed_security", path: location, message: `${location} must be an object` });
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push({ code: "unknown_security_field", path: `${location}.${key}`, message: `unknown security field ${location}.${key}` });
  }
}
__name(validateKeys, "validateKeys");
function validateOperation(errors, value, scopeKey, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push({ code: "malformed_security", path: location, message: `${location} must be an object` });
    return;
  }
  validateKeys(errors, value, ["mode", "all", scopeKey], location);
  if (!MODES.has(value.mode)) errors.push({ code: "invalid_security_mode", path: `${location}.mode`, message: `${location}.mode must be allow, warn, or deny` });
  const hasAll = value.all === true;
  const hasScope = Array.isArray(value[scopeKey]) && value[scopeKey].length > 0;
  if (value.mode === "deny" && (value.all != null || value[scopeKey] != null)) {
    errors.push({ code: "invalid_security_scope", path: location, message: `${location} deny mode cannot define a scope` });
  } else if (value.mode !== "deny" && hasAll === hasScope) {
    errors.push({ code: "invalid_security_scope", path: location, message: `${location} must define either all: true or a non-empty ${scopeKey} array` });
  }
  if (value[scopeKey] != null && (!Array.isArray(value[scopeKey]) || value[scopeKey].some((item) => typeof item !== "string" || !item.trim()))) {
    errors.push({ code: "invalid_security_scope", path: `${location}.${scopeKey}`, message: `${location}.${scopeKey} must contain non-empty strings` });
  } else if (Array.isArray(value[scopeKey])) {
    for (const item of value[scopeKey]) {
      if (!validScopeValue(item, scopeKey)) {
        errors.push({ code: "invalid_security_target", path: `${location}.${scopeKey}`, message: `${location}.${scopeKey} contains an invalid ${scopeKey} value: ${item}` });
      }
    }
  }
}
__name(validateOperation, "validateOperation");
function validScopeValue(value, scopeKey) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) return false;
  if (scopeKey !== "hosts") return true;
  const text = value.trim();
  if (text.includes("/") || text.includes(":")) return false;
  try {
    const parsed = new URL(`http://${text}`);
    return !!parsed.hostname && parsed.pathname === "/";
  } catch {
    return false;
  }
}
__name(validScopeValue, "validScopeValue");
var runtimeSettings2 = {
  make: make2,
  normalize: normalize2,
  clone: clone2,
  reset: reset2,
  assign: assign2,
  isDefault: isDefault2,
  makeModel: makeModel2,
  normalizeModel: normalizeModel2,
  effectivePolicy: effectivePolicy2,
  validateModel
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
    supportsAgents: false,
    supportsSecurity: false
  },
  {
    id: RT_ALS,
    name: "rt-als",
    settings: runtimeSettings2,
    supportsAgents: false,
    supportsSecurity: true
  },
  {
    id: RT_BROWSER_AGENT,
    name: "rt-browser-agent",
    settings: runtimeSettings,
    supportsAgents: true,
    supportsSecurity: false
  },
  {
    id: RT_NODEJS_AGENT,
    name: "rt-nodejs-agent",
    settings: runtimeSettings2,
    supportsAgents: true,
    supportsSecurity: true,
    aliases: [RT_AGENT, "rt-agent"]
  }
];
function listRuntimeDescriptors() {
  return RUNTIME_DESCRIPTORS.map(({ id, name, supportsAgents, supportsSecurity }) => ({ id, name, supportsAgents, supportsSecurity }));
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RT_AGENT,
  RT_ALS,
  RT_BASE,
  RT_BROWSER_AGENT,
  RT_NODEJS_AGENT,
  RUNTIME_DESCRIPTORS,
  getRuntimeDescriptor,
  getRuntimeSettings,
  listRuntimeDescriptors
});
//# sourceMappingURL=runtime-settings-registry.cjs.map