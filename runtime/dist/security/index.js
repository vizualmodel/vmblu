var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// security/node-context.js
import { AsyncLocalStorage } from "async_hooks";
var nodeStorage = new AsyncLocalStorage();
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
import childProcess from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
var STATE_KEY = Symbol.for("vmblu.rt-als.safetyHooks");
var WRAPPED = Symbol.for("vmblu.rt-als.wrapped");
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
      if (!(effectivePolicy == null ? void 0 : effectivePolicy.security)) return null;
      const domain = capabilityDomain(event.cap ?? event.capability);
      const permission = effectivePolicy.security[domain];
      const allowListDecision = classifyAllowList(domain, event.detail, effectivePolicy.security.allow);
      const decision = (allowListDecision == null ? void 0 : allowListDecision.decision) ?? (permission === "deny" ? "denied" : permission === "warn" ? "warning" : "allowed");
      return {
        decision,
        domain,
        permission,
        mode: effectivePolicy.mode,
        forward: effectivePolicy.forward,
        ...(allowListDecision == null ? void 0 : allowListDecision.reason) ? { reason: allowListDecision.reason } : {}
      };
    };
  }
  report(cap, detail = {}) {
    const event = {
      ts: Date.now(),
      node: getCurrentNode(),
      cap,
      detail
    };
    const policy = this.classify(event);
    if (policy) event.policy = policy;
    this.emit(event);
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
  emitCapability(cap, detail) {
    if (isCapabilitySuppressed(cap)) return;
    this.report(cap, detail);
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
    wrapMethod(childProcess, "exec", (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
      report("proc:exec", { command: safeString(command) });
      return original.call(this, command, ...args);
    }, "wrappedExec"), restores);
    wrapMethod(childProcess, "execFile", (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, args, options, callback) {
      const argv = Array.isArray(args) ? args : [];
      report("proc:exec", { command: safeString(file), args: argv.slice() });
      return original.call(this, file, args, options, callback);
    }, "wrappedExecFile"), restores);
    wrapMethod(childProcess, "spawn", (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, args, options) {
      report("proc:exec", { command: safeString(command), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, command, args, options);
    }, "wrappedSpawn"), restores);
    wrapMethod(childProcess, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, args, options) {
      report("proc:exec", { command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, modulePath, args, options);
    }, "wrappedFork"), restores);
  }
  installFsHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFs(path, ...args) {
        report("fs:write", { path: safeString(path) });
        return original.call(this, path, ...args);
      }, "wrappedFs"), restores);
    }
    for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedDelete(path, ...args) {
        report("fs:delete", { path: safeString(path) });
        return original.call(this, path, ...args);
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
      report("net:egress", detail);
      return suppressCapability("net:egress", () => original.call(this, input, init));
    }, "wrappedFetch"), restores);
  }
  installHttpHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    wrapMethod(http, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
      report("net:egress", {
        url: describeRequestUrl(input, options, "http:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpRequest"), restores);
    wrapMethod(https, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
      report("net:egress", {
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
    const path = input.path ?? input.pathname ?? (options == null ? void 0 : options.path) ?? (options == null ? void 0 : options.pathname) ?? "";
    const authority = port ? `${host}:${port}` : host;
    return authority ? `${actualProtocol}//${authority}${path}` : path;
  }
  return safeString(input);
}
__name(describeRequestUrl, "describeRequestUrl");
function capabilityDomain(cap) {
  var _a, _b, _c;
  if ((_a = cap == null ? void 0 : cap.startsWith) == null ? void 0 : _a.call(cap, "fs:")) return "fs";
  if ((_b = cap == null ? void 0 : cap.startsWith) == null ? void 0 : _b.call(cap, "net:")) return "net";
  if ((_c = cap == null ? void 0 : cap.startsWith) == null ? void 0 : _c.call(cap, "proc:")) return "process";
  return "unknown";
}
__name(capabilityDomain, "capabilityDomain");
function classifyAllowList(domain, detail = {}, allow = {}) {
  var _a, _b;
  if (domain === "fs" && ((_a = allow.fsRoots) == null ? void 0 : _a.length) && (detail == null ? void 0 : detail.path)) {
    return isPathAllowed(detail.path, allow.fsRoots) ? null : { decision: "denied", reason: "fs_root_not_allowed" };
  }
  if (domain === "net" && ((_b = allow.netHosts) == null ? void 0 : _b.length) && (detail == null ? void 0 : detail.url)) {
    return isHostAllowed(detail.url, allow.netHosts) ? null : { decision: "denied", reason: "net_host_not_allowed" };
  }
  return null;
}
__name(classifyAllowList, "classifyAllowList");
function isPathAllowed(value, roots = []) {
  const target = normalizePath(value);
  return roots.some((root) => {
    const normalizedRoot = normalizePath(root);
    return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`);
  });
}
__name(isPathAllowed, "isPathAllowed");
function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/\/+$/, "");
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
export {
  SecurityReporterFactory,
  getCurrentNode,
  isCapabilitySuppressed,
  runAsNode,
  safety,
  suppressCapability
};
//# sourceMappingURL=index.js.map