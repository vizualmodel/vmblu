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
import path from "path";
var STATE_KEY = /* @__PURE__ */ Symbol.for("vmblu.runtime.security");
var WRAPPED = /* @__PURE__ */ Symbol.for("vmblu.runtime.security.wrapped");
var _Safety = class _Safety {
  claim(owner, { security, baseDir } = {}) {
    if (!owner) throw new Error("vmblu security instrumentation requires a runtime owner");
    if (!security) return false;
    const state = getState();
    if (state.owner && state.owner !== owner) {
      throw new Error("vmblu security instrumentation is already owned by another runtime in this process");
    }
    if (state.owner === owner) return true;
    state.owner = owner;
    state.security = security;
    state.baseDir = path.resolve(baseDir || process.cwd());
    state.subscribers = /* @__PURE__ */ new Set();
    state.restores = [];
    try {
      this.installProcessHooks(state.restores);
      this.installFetchHook(state.restores);
      this.installHttpHooks(state.restores);
      this.installFsHooks(state.restores);
      return true;
    } catch (error) {
      this.release(owner);
      throw error;
    }
  }
  release(owner) {
    const state = getState();
    if (!state.owner || state.owner !== owner) return false;
    for (const restore of state.restores.splice(0).reverse()) restore();
    state.subscribers.clear();
    state.owner = null;
    state.security = null;
    state.baseDir = null;
    return true;
  }
  subscribe(listener) {
    if (typeof listener !== "function") return () => {
    };
    const state = getState();
    state.subscribers.add(listener);
    return () => state.subscribers.delete(listener);
  }
  isOwner(owner) {
    return getState().owner === owner;
  }
  get owner() {
    return getState().owner;
  }
  emit(event) {
    for (const listener of [...getState().subscribers]) {
      try {
        listener(event);
      } catch (error) {
        console.warn("vmblu security subscriber failed:", error);
      }
    }
  }
  report(operation, detail = {}) {
    if (isCapabilitySuppressed(operation)) return null;
    const state = getState();
    if (!state.owner || !state.security) return null;
    const parsed = parseOperation(operation);
    const configured = operationPolicy(state.security, parsed);
    const policy = classifyPolicy(parsed, detail, configured, state.baseDir);
    const event = {
      schemaVersion: 1,
      ts: Date.now(),
      node: getCurrentNode(),
      operation: parsed.name,
      cap: legacyCapabilityName(parsed.name),
      detail,
      policy
    };
    if (policy.decision !== "allowed") this.emit(event);
    if (policy.decision === "denied") throw new SecurityPolicyError(event);
    return event;
  }
  installProcessHooks(restores) {
    const report = /* @__PURE__ */ __name((detail) => this.report("process.exec", detail), "report");
    for (const key of ["exec", "execSync"]) {
      wrapMethod(childProcess, key, (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
        report({ command: safeString(command), shell: true });
        return original.call(this, command, ...args);
      }, "wrappedExec"), restores);
    }
    for (const key of ["execFile", "execFileSync"]) {
      wrapMethod(childProcess, key, (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, ...rest) {
        const argv = Array.isArray(rest[0]) ? rest[0] : [];
        const actualOptions = Array.isArray(rest[0]) ? rest[1] : rest[0];
        report({ command: safeString(file), args: argv.slice(), shell: !!(actualOptions == null ? void 0 : actualOptions.shell) });
        return original.call(this, file, ...rest);
      }, "wrappedExecFile"), restores);
    }
    for (const key of ["spawn", "spawnSync"]) {
      wrapMethod(childProcess, key, (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, ...rest) {
        const argv = Array.isArray(rest[0]) ? rest[0] : [];
        const options = Array.isArray(rest[0]) ? rest[1] : rest[0];
        report({ command: safeString(command), args: argv.slice(), shell: !!(options == null ? void 0 : options.shell) });
        return original.call(this, command, ...rest);
      }, "wrappedSpawn"), restores);
    }
    wrapMethod(childProcess, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, ...rest) {
      const argv = Array.isArray(rest[0]) ? rest[0] : [];
      report({ command: safeString(process.execPath), args: [safeString(modulePath), ...argv], shell: false });
      return original.call(this, modulePath, ...rest);
    }, "wrappedFork"), restores);
  }
  installFsHooks(restores) {
    for (const key of ["readFile", "readFileSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFsRead(target, ...args) {
        safety.report("fs.read", { path: safeString(target) });
        return original.call(this, target, ...args);
      }, "wrappedFsRead"), restores);
    }
    for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFsWrite(target, ...args) {
        safety.report("fs.write", { path: safeString(target) });
        return original.call(this, target, ...args);
      }, "wrappedFsWrite"), restores);
    }
    for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFsDelete(target, ...args) {
        safety.report("fs.delete", { path: safeString(target) });
        return original.call(this, target, ...args);
      }, "wrappedFsDelete"), restores);
    }
  }
  installFetchHook(restores) {
    if (typeof globalThis.fetch !== "function") return;
    wrapMethod(globalThis, "fetch", (original) => /* @__PURE__ */ __name(function wrappedFetch(input, init) {
      safety.report("net.egress", {
        url: describeRequestUrl(input),
        method: (init == null ? void 0 : init.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return suppressCapability("net.egress", () => original.call(this, input, init));
    }, "wrappedFetch"), restores);
  }
  installHttpHooks(restores) {
    wrapMethod(http, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
      safety.report("net.egress", {
        url: describeRequestUrl(input, options, "http:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpRequest"), restores);
    wrapMethod(https, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
      safety.report("net.egress", {
        url: describeRequestUrl(input, options, "https:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpsRequest"), restores);
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
      owner: null,
      security: null,
      baseDir: null,
      restores: [],
      subscribers: /* @__PURE__ */ new Set()
    };
  }
  return globalThis[STATE_KEY];
}
__name(getState, "getState");
function wrapMethod(target, key, wrapFactory, restores) {
  const original = target[key];
  if (typeof original !== "function") return;
  if (original[WRAPPED]) throw new Error(`Node.js API ${key} is already wrapped by vmblu security`);
  const wrapped = wrapFactory(original);
  Object.defineProperty(wrapped, WRAPPED, { value: true });
  target[key] = wrapped;
  restores.push(() => {
    if (target[key] === wrapped) target[key] = original;
  });
}
__name(wrapMethod, "wrapMethod");
function classifyPolicy(operation, detail, policy, baseDir) {
  if (!policy || policy.mode === "deny") return denied(operation, "operation_denied");
  if (!policy.all) {
    if (operation.area === "fs" && !isPathAllowed(detail.path, policy.roots, baseDir)) return denied(operation, "fs_root_not_allowed");
    if (operation.area === "net" && !isHostAllowed(detail.url, policy.hosts)) return denied(operation, "net_host_not_allowed");
    if (operation.area === "process") {
      if (detail.shell) return denied(operation, "process_shell_not_allowed");
      if (!isCommandAllowed(detail.command, policy.commands, baseDir)) return denied(operation, "process_command_not_allowed");
    }
  }
  return {
    decision: policy.mode === "warn" ? "warning" : "allowed",
    area: operation.area,
    action: operation.action,
    mode: policy.mode
  };
}
__name(classifyPolicy, "classifyPolicy");
function denied(operation, reason) {
  return {
    decision: "denied",
    area: operation.area,
    action: operation.action,
    mode: "deny",
    reason
  };
}
__name(denied, "denied");
function operationPolicy(security, operation) {
  var _a;
  return ((_a = security == null ? void 0 : security[operation.area]) == null ? void 0 : _a[operation.action]) ?? null;
}
__name(operationPolicy, "operationPolicy");
function isPathAllowed(value, roots = [], baseDir) {
  if (!value || !Array.isArray(roots) || !roots.length) return false;
  const target = canonicalPath(value, process.cwd());
  return roots.some((root) => {
    const allowed = canonicalPath(root, baseDir);
    return target === allowed || target.startsWith(`${allowed}/`);
  });
}
__name(isPathAllowed, "isPathAllowed");
function canonicalPath(value, baseDir) {
  const absolute = path.resolve(baseDir, String(value ?? ""));
  let existing = absolute;
  const suffix = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  let resolved = existing;
  try {
    resolved = fs.realpathSync.native(existing);
  } catch {
    resolved = existing;
  }
  resolved = path.join(resolved, ...suffix).replaceAll("\\", "/").replace(/\/+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
__name(canonicalPath, "canonicalPath");
function isHostAllowed(value, hosts = []) {
  try {
    const observed = new URL(String(value)).hostname.toLowerCase();
    return hosts.some((host) => normalizeConfiguredHost(host) === observed);
  } catch {
    return false;
  }
}
__name(isHostAllowed, "isHostAllowed");
function normalizeConfiguredHost(value) {
  try {
    const text = String(value ?? "").trim();
    if (!text || text.includes("/") || text.includes(":")) return "";
    return new URL(`http://${text}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}
__name(normalizeConfiguredHost, "normalizeConfiguredHost");
function isCommandAllowed(value, commands = [], baseDir) {
  const observed = executableIdentity(value, baseDir);
  return !!observed && commands.some((command) => executableIdentity(command, baseDir) === observed);
}
__name(isCommandAllowed, "isCommandAllowed");
function executableIdentity(value, baseDir) {
  const command = String(value ?? "").trim();
  if (!command) return "";
  if (path.isAbsolute(command) || command.includes("/") || command.includes("\\")) return canonicalPath(command, baseDir);
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const folder of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(folder, process.platform === "win32" && !path.extname(command) ? `${command}${extension}` : command);
      if (fs.existsSync(candidate)) return canonicalPath(candidate, baseDir);
    }
  }
  return process.platform === "win32" ? command.toLowerCase() : command;
}
__name(executableIdentity, "executableIdentity");
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
    const requestPath = input.path ?? input.pathname ?? (options == null ? void 0 : options.path) ?? (options == null ? void 0 : options.pathname) ?? "";
    const authority = port ? `${host}:${port}` : host;
    return authority ? `${actualProtocol}//${authority}${requestPath}` : requestPath;
  }
  return safeString(input);
}
__name(describeRequestUrl, "describeRequestUrl");
function parseOperation(value) {
  const normalized = String(value ?? "").replace(":", ".");
  if (normalized === "proc.exec") return { name: "process.exec", area: "process", action: "exec" };
  const [area = "unknown", action = "unknown"] = normalized.split(".");
  return { name: `${area}.${action}`, area, action };
}
__name(parseOperation, "parseOperation");
function legacyCapabilityName(value) {
  const operation = parseOperation(value);
  if (operation.name === "process.exec") return "proc:exec";
  return operation.name.replace(".", ":");
}
__name(legacyCapabilityName, "legacyCapabilityName");
var safety = new Safety();

// security/security-reporter.js
function SecurityReporterFactory(tx) {
  let currentTx = tx;
  let unsubscribe = safety.subscribe((event) => {
    var _a;
    (_a = currentTx == null ? void 0 : currentTx.send) == null ? void 0 : _a.call(currentTx, "security.event", event);
  });
  return {
    setTx(nextTx) {
      currentTx = nextTx ?? currentTx;
    },
    stop() {
      unsubscribe();
      unsubscribe = /* @__PURE__ */ __name(() => {
      }, "unsubscribe");
    }
  };
}
__name(SecurityReporterFactory, "SecurityReporterFactory");
export {
  SecurityPolicyError,
  SecurityReporterFactory,
  getCurrentNode,
  isCapabilitySuppressed,
  runAsNode,
  safety,
  suppressCapability
};
//# sourceMappingURL=index.js.map