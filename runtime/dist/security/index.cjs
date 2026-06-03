var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// security/index.js
var index_exports = {};
__export(index_exports, {
  SecurityReporterFactory: () => SecurityReporterFactory,
  getCurrentNode: () => getCurrentNode,
  isCapabilitySuppressed: () => isCapabilitySuppressed,
  runAsNode: () => runAsNode,
  safety: () => safety,
  suppressCapability: () => suppressCapability
});
module.exports = __toCommonJS(index_exports);

// security/node-context.js
var import_node_async_hooks = require("async_hooks");
var nodeStorage = new import_node_async_hooks.AsyncLocalStorage();
function cloneStore() {
  const store = nodeStorage.getStore();
  return store ? { node: store.node, suppressCaps: new Set(store.suppressCaps ?? []) } : { node: "UNKNOWN", suppressCaps: /* @__PURE__ */ new Set() };
}
__name(cloneStore, "cloneStore");
function runAsNode(nodeName, fn) {
  const store = cloneStore();
  store.node = nodeName ?? "UNKNOWN";
  return nodeStorage.run(store, fn);
}
__name(runAsNode, "runAsNode");
function getCurrentNode() {
  var _a;
  return ((_a = nodeStorage.getStore()) == null ? void 0 : _a.node) ?? "UNKNOWN";
}
__name(getCurrentNode, "getCurrentNode");
function suppressCapability(cap, fn) {
  const store = cloneStore();
  store.suppressCaps.add(cap);
  return nodeStorage.run(store, fn);
}
__name(suppressCapability, "suppressCapability");
function isCapabilitySuppressed(cap) {
  var _a, _b;
  return ((_b = (_a = nodeStorage.getStore()) == null ? void 0 : _a.suppressCaps) == null ? void 0 : _b.has(cap)) ?? false;
}
__name(isCapabilitySuppressed, "isCapabilitySuppressed");

// security/safety.js
var import_node_child_process = __toESM(require("child_process"), 1);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_http = __toESM(require("http"), 1);
var import_node_https = __toESM(require("https"), 1);
var import_node_path = __toESM(require("path"), 1);
var STATE_KEY = /* @__PURE__ */ Symbol.for("vmblu.rt-als.safetyHooks");
var WRAPPED = /* @__PURE__ */ Symbol.for("vmblu.rt-als.wrapped");
var _Safety = class _Safety {
  constructor() {
    this.emitter = null;
    this.policyClassifier = null;
  }
  setEmitter(fn = null) {
    this.emitter = typeof fn === "function" ? fn : null;
  }
  setPolicyClassifier(fn = null) {
    this.policyClassifier = typeof fn === "function" ? fn : null;
  }
  emit(event) {
    if (!this.emitter) return;
    try {
      this.emitter(event);
    } catch (error) {
      console.warn("vmblu safety emitter failed:", error);
    }
  }
  makePolicyClassifier({ runtime, runtimeSettings: modelRuntimeSettings } = {}) {
    return (event) => {
      var _a, _b, _c, _d;
      const actor = (_b = (_a = runtime == null ? void 0 : runtime.actors) == null ? void 0 : _a.find) == null ? void 0 : _b.call(_a, (candidate) => candidate.name === (event == null ? void 0 : event.node));
      const effectivePolicy = (_d = (_c = runtime == null ? void 0 : runtime.settings) == null ? void 0 : _c.effectivePolicy) == null ? void 0 : _d.call(_c, modelRuntimeSettings, actor == null ? void 0 : actor.dx);
      if (!(effectivePolicy == null ? void 0 : effectivePolicy.active) || !(effectivePolicy == null ? void 0 : effectivePolicy.security)) return null;
      const operation = parseOperation(event.operation ?? event.cap ?? event.capability);
      const policy = operationPolicy(effectivePolicy.security, operation);
      if (!policy) return null;
      const scopeDecision = classifyScope(operation, event.detail, policy);
      const decision = (scopeDecision == null ? void 0 : scopeDecision.decision) ?? (policy.mode === "deny" ? "denied" : policy.mode === "warn" ? "warning" : "allowed");
      return {
        decision,
        area: operation.area,
        action: operation.action,
        mode: (scopeDecision == null ? void 0 : scopeDecision.mode) ?? policy.mode,
        ...(scopeDecision == null ? void 0 : scopeDecision.reason) ? { reason: scopeDecision.reason } : {}
      };
    };
  }
  report(operation, detail = {}) {
    const event = {
      ts: Date.now(),
      node: getCurrentNode(),
      operation: normalizeOperationName(operation),
      cap: legacyCapabilityName(operation),
      detail
    };
    const policy = this.classify(event);
    if (policy) event.policy = policy;
    this.emit(event);
    return event;
  }
  classify(event) {
    if (!this.policyClassifier) return null;
    try {
      return this.policyClassifier(event) ?? null;
    } catch (error) {
      return {
        decision: "error",
        reason: "policy_classifier_failed",
        message: (error == null ? void 0 : error.message) || String(error)
      };
    }
  }
  emitCapability(operation, detail) {
    var _a;
    if (isCapabilitySuppressed(operation)) return null;
    const event = this.report(operation, detail);
    if (((_a = event == null ? void 0 : event.policy) == null ? void 0 : _a.decision) === "denied") {
      throw new SecurityPolicyError(event);
    }
    return event;
  }
  installHooks({ mode = "off" } = {}) {
    if (mode === "off") return () => {
    };
    const state = getState();
    state.count += 1;
    if (state.count === 1) {
      state.restores = [];
      this.installProcessHooks(state.restores);
      this.installFetchHook(state.restores);
      this.installHttpHooks(state.restores);
      this.installFsHooks(state.restores);
    }
    return () => {
      state.count = Math.max(0, state.count - 1);
      if (state.count > 0) return;
      for (const restore of state.restores.splice(0).reverse()) restore();
    };
  }
  installProcessHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    wrapMethod(import_node_child_process.default, "exec", (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
      report("process.exec", { command: safeString(command) });
      return original.call(this, command, ...args);
    }, "wrappedExec"), restores);
    wrapMethod(import_node_child_process.default, "execFile", (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, args, options, callback) {
      const argv = Array.isArray(args) ? args : [];
      report("process.exec", { command: safeString(file), args: argv.slice() });
      return original.call(this, file, args, options, callback);
    }, "wrappedExecFile"), restores);
    wrapMethod(import_node_child_process.default, "spawn", (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, args, options) {
      report("process.exec", { command: safeString(command), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, command, args, options);
    }, "wrappedSpawn"), restores);
    wrapMethod(import_node_child_process.default, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, args, options) {
      report("process.exec", { command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, modulePath, args, options);
    }, "wrappedFork"), restores);
  }
  installFsHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    for (const key of ["readFile", "readFileSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedFsRead(path2, ...args) {
        report("fs.read", { path: safeString(path2) });
        return original.call(this, path2, ...args);
      }, "wrappedFsRead"), restores);
    }
    for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedFs(path2, ...args) {
        report("fs.write", { path: safeString(path2) });
        return original.call(this, path2, ...args);
      }, "wrappedFs"), restores);
    }
    for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedDelete(path2, ...args) {
        report("fs.delete", { path: safeString(path2) });
        return original.call(this, path2, ...args);
      }, "wrappedDelete"), restores);
    }
  }
  installFetchHook(restores) {
    if (typeof globalThis.fetch !== "function") return;
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    wrapMethod(globalThis, "fetch", (original) => /* @__PURE__ */ __name(function wrappedFetch(input, init) {
      const detail = {
        url: describeRequestUrl(input),
        method: (init == null ? void 0 : init.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      };
      report("net.egress", detail);
      return suppressCapability("net.egress", () => original.call(this, input, init));
    }, "wrappedFetch"), restores);
  }
  installHttpHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    wrapMethod(import_node_http.default, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
      report("net.egress", {
        url: describeRequestUrl(input, options, "http:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpRequest"), restores);
    wrapMethod(import_node_https.default, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
      report("net.egress", {
        url: describeRequestUrl(input, options, "https:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpsRequest"), restores);
  }
  enable({ mode = "off" } = {}, tx = null) {
    if (mode === "off") {
      this.setEmitter(null);
      return { uninstall() {
      } };
    }
    this.setEmitter((event) => {
      var _a;
      (_a = tx == null ? void 0 : tx.send) == null ? void 0 : _a.call(tx, "security.event", event);
    });
    const uninstallHooks = this.installHooks({ mode });
    return {
      uninstall: /* @__PURE__ */ __name(() => {
        uninstallHooks();
        this.setEmitter(null);
      }, "uninstall")
    };
  }
};
__name(_Safety, "Safety");
var Safety = _Safety;
var _SecurityPolicyError = class _SecurityPolicyError extends Error {
  constructor(event) {
    super(`vmblu security policy denied ${(event == null ? void 0 : event.operation) ?? "operation"}`);
    this.name = "SecurityPolicyError";
    this.event = event;
  }
};
__name(_SecurityPolicyError, "SecurityPolicyError");
var SecurityPolicyError = _SecurityPolicyError;
function getState() {
  if (!globalThis[STATE_KEY]) {
    globalThis[STATE_KEY] = {
      count: 0,
      restores: []
    };
  }
  return globalThis[STATE_KEY];
}
__name(getState, "getState");
function wrapMethod(target, key, wrapFactory, restores) {
  const original = target[key];
  if (typeof original !== "function") return;
  if (original[WRAPPED]) return;
  const wrapped = wrapFactory(original);
  wrapped[WRAPPED] = true;
  target[key] = wrapped;
  restores.push(() => {
    if (target[key] === wrapped) target[key] = original;
  });
}
__name(wrapMethod, "wrapMethod");
function safeString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof URL) return value.toString();
  return String(value);
}
__name(safeString, "safeString");
function describeRequestUrl(input, options = null, protocol = "") {
  if (input instanceof URL) return input.toString();
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const actualProtocol = input.protocol ?? (options == null ? void 0 : options.protocol) ?? protocol;
    const host = input.hostname ?? input.host ?? (options == null ? void 0 : options.hostname) ?? (options == null ? void 0 : options.host) ?? "";
    const port = input.port ?? (options == null ? void 0 : options.port);
    const path2 = input.path ?? input.pathname ?? (options == null ? void 0 : options.path) ?? (options == null ? void 0 : options.pathname) ?? "";
    const authority = port ? `${host}:${port}` : host;
    return authority ? `${actualProtocol}//${authority}${path2}` : path2;
  }
  return safeString(input);
}
__name(describeRequestUrl, "describeRequestUrl");
function normalizeOperationName(value) {
  return parseOperation(value).name;
}
__name(normalizeOperationName, "normalizeOperationName");
function legacyCapabilityName(value) {
  const operation = parseOperation(value);
  if (operation.name === "process.exec") return "proc:exec";
  return operation.name.replace(".", ":");
}
__name(legacyCapabilityName, "legacyCapabilityName");
function parseOperation(value) {
  const normalized = String(value ?? "").replace(":", ".");
  if (normalized === "proc.exec") return { name: "process.exec", area: "process", action: "exec" };
  const [area = "unknown", action = "unknown"] = normalized.split(".");
  return { name: `${area}.${action}`, area, action };
}
__name(parseOperation, "parseOperation");
function operationPolicy(security = {}, operation) {
  var _a;
  return ((_a = security == null ? void 0 : security[operation.area]) == null ? void 0 : _a[operation.action]) ?? null;
}
__name(operationPolicy, "operationPolicy");
function classifyScope(operation, detail = {}, policy = {}) {
  var _a, _b, _c;
  if (operation.area === "fs" && ((_a = policy.roots) == null ? void 0 : _a.length) && (detail == null ? void 0 : detail.path)) {
    return isPathAllowed(detail.path, policy.roots) ? null : { decision: "denied", mode: "deny", reason: "fs_root_not_allowed" };
  }
  if (operation.area === "net" && ((_b = policy.hosts) == null ? void 0 : _b.length) && (detail == null ? void 0 : detail.url)) {
    return isHostAllowed(detail.url, policy.hosts) ? null : { decision: "denied", mode: "deny", reason: "net_host_not_allowed" };
  }
  if (operation.area === "process" && ((_c = policy.commands) == null ? void 0 : _c.length) && (detail == null ? void 0 : detail.command)) {
    return isCommandAllowed(detail.command, policy.commands) ? null : { decision: "denied", mode: "deny", reason: "process_command_not_allowed" };
  }
  return null;
}
__name(classifyScope, "classifyScope");
function isPathAllowed(value, roots = []) {
  const target = normalizePath(value);
  return roots.some((root) => {
    const normalizedRoot = normalizePath(root);
    return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`);
  });
}
__name(isPathAllowed, "isPathAllowed");
function normalizePath(value) {
  return import_node_path.default.resolve(String(value ?? "")).replaceAll("\\", "/").replace(/\/+$/, "");
}
__name(normalizePath, "normalizePath");
function isHostAllowed(value, hosts = []) {
  try {
    const host = new URL(String(value)).hostname;
    return hosts.includes(host);
  } catch {
    return false;
  }
}
__name(isHostAllowed, "isHostAllowed");
function isCommandAllowed(value, commands = []) {
  return commands.includes(String(value ?? ""));
}
__name(isCommandAllowed, "isCommandAllowed");
var safety = new Safety();

// security/security-reporter.js
function SecurityReporterFactory(tx, sx = null) {
  const mode = (sx == null ? void 0 : sx.mode) ?? "warn";
  let currentTx = tx;
  let safetyControl = safety.enable({ mode }, {
    send(name, payload) {
      if (name !== "security.event") return 0;
      return currentTx.send("security.event", payload);
    }
  });
  return {
    configure(nextSettings = null) {
      const nextMode = (nextSettings == null ? void 0 : nextSettings.mode) ?? mode;
      safetyControl.uninstall();
      safetyControl = safety.enable({ mode: nextMode }, {
        send(name, payload) {
          if (name !== "security.event") return 0;
          return currentTx.send("security.event", payload);
        }
      });
    },
    setTx(nextTx) {
      currentTx = nextTx ?? currentTx;
    }
  };
}
__name(SecurityReporterFactory, "SecurityReporterFactory");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SecurityReporterFactory,
  getCurrentNode,
  isCapabilitySuppressed,
  runAsNode,
  safety,
  suppressCapability
});
//# sourceMappingURL=index.cjs.map