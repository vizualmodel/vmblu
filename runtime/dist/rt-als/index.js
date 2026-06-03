var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// shared/resolve-queue.js
function Deferred() {
  this.promise = new Promise((resolve, reject) => {
    this._resolve = resolve;
    this._reject = reject;
  });
}
__name(Deferred, "Deferred");
Deferred.prototype = {
  resolve(value) {
    this._resolve(value);
  },
  reject(error) {
    this._reject(error);
  }
};
function PromiseHandler(defs) {
  this.defs = defs;
}
__name(PromiseHandler, "PromiseHandler");
PromiseHandler.prototype = {
  then(onFulfilled, onRejected) {
    const newDefs = this.defs.map((deferred) => {
      const next = new Deferred();
      deferred.promise.then(onFulfilled, onRejected).then(next.resolve.bind(next), next.reject.bind(next));
      return next;
    });
    return new PromiseHandler(newDefs);
  },
  catch(onRejected) {
    const newDefs = this.defs.map((deferred) => {
      const next = new Deferred();
      deferred.promise.catch(onRejected).then(next.resolve.bind(next), next.reject.bind(next));
      return next;
    });
    return new PromiseHandler(newDefs);
  },
  replace(count) {
    if (count > this.defs.length) {
      for (let i = this.defs.length; i < count; i++) {
        this.defs.push(new Deferred());
      }
    } else if (count < this.defs.length) {
      this.defs.splice(count);
    }
  }
};
function ResolveQueue() {
  this.minTimeout = 1e3;
  this.queue = /* @__PURE__ */ new Map();
}
__name(ResolveQueue, "ResolveQueue");
ResolveQueue.prototype = {
  addPromiseHandler(txRef, timeout, count = 1) {
    const duration = Math.max(timeout, this.minTimeout);
    const defs = Array.from({ length: count }, () => new Deferred());
    const handler = new PromiseHandler(defs);
    this.queue.set(txRef, { handler, time: { start: Date.now(), duration } });
    return handler;
  },
  changePromiseHandler(txRef, count) {
    const entry = this.queue.get(txRef);
    if (!entry) return;
    entry.handler.replace(count);
  },
  trigger(rxRef, value) {
    const entry = this.queue.get(rxRef);
    if (!entry) return console.log(rxRef, "NOT FOUND");
    const deferred = entry.handler.defs.shift();
    deferred.resolve(value);
    if (entry.handler.defs.length === 0) {
      this.queue.delete(rxRef);
    }
  },
  checkTimeouts(now = Date.now()) {
    for (const [txRef, entry] of this.queue.entries()) {
      const { start, duration } = entry.time;
      if (start + duration <= now) {
        const err = new Error("Reply timeout", { sender: txRef, msec: duration });
        entry.handler.defs.forEach((deferred) => deferred.reject(err));
        this.queue.delete(txRef);
      }
    }
  }
};

// shared/target.js
var HIX_HANDLER = 0;
var HIX_REPLY = 268435456;
var HIX_TYPE_MASK = 4026531840;
function Target(uid, pin, channel = false) {
  this.uid = uid;
  this.actor = null;
  this.pin = pin;
  this.channel = channel;
  this.hix = HIX_HANDLER;
}
__name(Target, "Target");
var arrow = "->";
var channelArrow = "=>";
var convert = {
  stringToInput(str) {
    const pure = str.trim();
    const symbol = pure.slice(0, 2);
    const pin = pure.slice(2).trim();
    return {
      pin,
      channel: symbol === arrow ? false : true
    };
  },
  stringToOutput(str) {
    function singleTarget(targetString2) {
      return targetString2[0] == "[" && targetString2.at(-1) == "]" ? false : true;
    }
    __name(singleTarget, "singleTarget");
    let channel = false;
    let symbolIndex = str.indexOf(arrow);
    if (symbolIndex < 0) {
      symbolIndex = str.indexOf(channelArrow);
      channel = true;
    }
    if (symbolIndex < 0) return null;
    const output = str.slice(0, symbolIndex).trim();
    const targetString = str.slice(symbolIndex + 2).trim();
    if (output.length == 0 || targetString.length == 0) return null;
    if (singleTarget(targetString)) {
      const rawTarget = convert.stringToTarget(targetString);
      return rawTarget ? { output, channel, targets: [rawTarget] } : { output, channel, targets: [] };
    }
    const regex = /"(?:\\.|[^"\\])*"/g;
    const matches = targetString.match(regex);
    const targetStringArray = matches ? matches.map((part) => part.slice(1, -1).replace(/\\"/g, '"')) : [];
    const rawTargets = [];
    for (const target of targetStringArray) {
      const rawTarget = convert.stringToTarget(target);
      if (rawTarget) rawTargets.push(rawTarget);
    }
    return { output, channel, targets: rawTargets };
  },
  stringToTarget(str) {
    const uidStart = str.lastIndexOf("(");
    if (uidStart < 0) return null;
    const uidEnd = str.lastIndexOf(")");
    if (uidEnd < 0) return null;
    if (uidEnd - uidStart < 2) return null;
    const uid = str.slice(uidStart + 1, uidEnd);
    const atIndex = str.indexOf("@");
    if (atIndex < 0) return null;
    const pinName = str.slice(0, atIndex).trim();
    const nodeName = str.slice(atIndex + 1, uidStart).trim();
    if (pinName.length == 0 || nodeName.length == 0) return null;
    return { pinName, nodeName, uid };
  },
  pinToHandler(pinName) {
    const words = pinName.split(/[ .-]+/).map((word) => word.replace(/[^a-zA-Z0-9_]/g, ""));
    const cleaned = words.filter(Boolean);
    return "on" + cleaned.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
  }
};

// shared/runtime-node.js
function RX(pin, channel = false) {
  this.pin = pin;
  this.channel = channel;
  this.handler = null;
}
__name(RX, "RX");
function TX(pin, channel = false) {
  this.pin = pin;
  this.channel = channel;
  this.targets = [];
}
__name(TX, "TX");
function missingHandler(param) {
  const names = Object.getOwnPropertyNames(this);
  console.warn(`Missing handler for cell: ${names} - parameters: ${param}`);
}
__name(missingHandler, "missingHandler");
function shouldUseNew(factory) {
  if (typeof factory !== "function" || !factory.prototype) return false;
  const protoKeys = Object.getOwnPropertyNames(factory.prototype);
  return protoKeys.length !== 1 || protoKeys[0] !== "constructor" || factory.prototype.constructor !== factory;
}
__name(shouldUseNew, "shouldUseNew");
function RuntimeNode(runtime, { name, uid, factory, inputs, outputs, sx, dx }) {
  this.name = name;
  this.uid = uid;
  this.factory = factory;
  this.useNew = shouldUseNew(factory);
  this.rxSink = [];
  this.txMap = /* @__PURE__ */ new Map();
  this.sx = sx ?? null;
  this.dx = dx ? runtime.settings.normalize(dx) : null;
  this.cell = null;
  this.msg = null;
  this.tx = createTx(runtime, this);
  this.initRxTx({ inputs, outputs });
}
__name(RuntimeNode, "RuntimeNode");
RuntimeNode.prototype = {
  logsMessages() {
    var _a, _b, _c;
    return !!(((_b = (_a = this.dx) == null ? void 0 : _a.monitor) == null ? void 0 : _b.logMessages) || ((_c = this.dx) == null ? void 0 : _c.logMessages));
  },
  initRxTx({ inputs, outputs }) {
    for (const inputString of inputs) {
      const input = convert.stringToInput(inputString);
      if (input) this.rxSink.push(new RX(input.pin, input.channel));
    }
    for (const outputString of outputs) {
      const raw = convert.stringToOutput(outputString);
      if (!raw) continue;
      const tx = new TX(raw.output, raw.channel);
      this.txMap.set(tx.pin, tx);
      for (const rawTarget of raw.targets) {
        tx.targets.push(new Target(rawTarget.uid, rawTarget.pinName, raw.channel));
      }
    }
  },
  makeCell() {
    try {
      if (this.useNew) {
        this.cell = new this.factory(this.getTx(), this.sx);
      } else {
        this.cell = this.factory(this.getTx(), this.sx);
      }
    } catch (err) {
      if (err instanceof TypeError && typeof this.factory === "function" && /class constructor/i.test(err.message)) {
        this.useNew = true;
        this.cell = new this.factory(this.getTx(), this.sx);
      } else throw err;
    }
    this.addHandlersForCell();
  },
  addHandlersForCell() {
    if (!this.cell) {
      if (this.rxSink.length > 0) console.warn(`** NO HANDLERS ** Node ${this.name} has input pins but no implementation.`);
      return;
    }
    const entries = Object.entries(this.cell);
    const proto = Object.getPrototypeOf(this.cell);
    const protoNames = Object.getOwnPropertyNames(proto) ?? [];
    for (const protoName of protoNames) {
      if (typeof proto[protoName] === "function") entries.push([protoName, proto[protoName]]);
    }
    entries.forEach(([name, fn]) => {
      if (typeof fn === "function") {
        const rx = this.getRx(name);
        if (rx) rx.handler = fn;
      }
    });
    for (const rx of this.rxSink) {
      if (!rx.handler) {
        console.warn(`** NO HANDLER ** Node "${this.name}" has input pin "${rx.pin}" but no handler for it.`);
        rx.handler = missingHandler;
      }
    }
  },
  getRx(functionName) {
    if (functionName.startsWith("-> ") || functionName.startsWith("=> ")) {
      const handlerName = functionName.slice(3);
      return this.rxSink.find((rx) => rx.pin == handlerName);
    }
    for (const rx of this.rxSink) {
      if (convert.pinToHandler(rx.pin) == functionName) return rx;
    }
    return null;
  },
  resolveUIDs(actors) {
    for (const tx of this.txMap.values()) {
      for (const target of tx.targets) {
        target.actor = actors.find((actor) => actor.uid == target.uid);
        if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`);
        const hix = target.actor.rxSink.findIndex((rx) => rx.pin == target.pin);
        if (hix < 0) return console.error(`** ERROR ** target pin ${target.pin} in ${target.actor.name} not found`);
        target.hix = HIX_HANDLER | hix;
      }
    }
  },
  findTx(pin) {
    if (!pin) return null;
    return this.txMap.get(pin) ?? null;
  },
  getTx() {
    return this.tx;
  }
};
function createTx(runtime, source) {
  return {
    get pin() {
      var _a;
      return (_a = source.msg) == null ? void 0 : _a.txPin;
    },
    send(pin, param) {
      if (pin) {
        const tx = source.findTx(pin);
        if (tx) return runtime.sendTo(tx, source, param);
      }
      console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? "missing !!"}"`, source.txMap);
      return 0;
    },
    request(pin, param, timeout = 0) {
      if (pin) {
        const tx = source.findTx(pin);
        if (tx) return runtime.requestFrom(tx, source, param, timeout);
      }
      console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
      return runtime.reject("No such output pin");
    },
    reply(param) {
      return runtime.reply(source, param);
    },
    next(param, timeout = 0) {
      return runtime.next(source, param, timeout);
    },
    reschedule() {
      if (source.msg) runtime.reschedule(source.msg);
    },
    select(nodeName) {
      const _nodeName = nodeName;
      return {
        send(pin, param) {
          if (pin) {
            const tx = source.findTx(pin);
            if (tx) {
              const actualTarget = tx.targets.find((target) => target.actor.name.toLowerCase() == _nodeName.toLowerCase());
              if (actualTarget) {
                const txCopy = new TX(tx.pin, tx.channel);
                txCopy.targets = [actualTarget];
                return runtime.sendTo(txCopy, source, param);
              }
              console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`);
              return 0;
            }
          }
          console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? "missing !!"}"`, source.txMap);
          return 0;
        },
        request(pin, param, timeout = 0) {
          if (pin) {
            const tx = source.findTx(pin);
            if (tx) {
              const actualTarget = tx.targets.find((target) => target.actor.name.toLowerCase() == _nodeName.toLowerCase());
              if (actualTarget) {
                const txCopy = new TX(tx.pin, tx.channel);
                txCopy.targets = [actualTarget];
                return runtime.requestFrom(txCopy, source, param, timeout);
              }
              console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`);
              return runtime.reject("selected node not connected");
            }
          }
          console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
          return runtime.reject("No such output pin");
        }
      };
    }
  };
}
__name(createTx, "createTx");

// shared/runtime.js
var _Runtime = class _Runtime {
  constructor(nodeList = [], options = {}) {
    this.actors = [];
    this.receiveTimer = 0;
    this.idleTimer = 0;
    this.receiveDelay = 0;
    this.idleDelay = 100;
    this.idleCount = 0;
    this.msgCount = 0;
    this.startTime = null;
    this.qOut = [];
    this.qIn = [];
    this.qResolve = new ResolveQueue();
    this.options = options ?? {};
    this.runtimeSettings = (options == null ? void 0 : options.runtimeSettings) ?? null;
    this.scaffold(nodeList);
  }
  scaffold(nodeList = []) {
    this.actors = [];
    for (const rawNode of nodeList) {
      this.actors.push(new RuntimeNode(this, rawNode));
    }
    this.actors.forEach((actor) => actor.resolveUIDs(this.actors));
    this.configure(this.options);
    return this;
  }
  configure(options = {}) {
  }
  clearReceiveTimer() {
    clearTimeout(this.receiveTimer);
    this.receiveTimer = 0;
  }
  clearIdleTimer() {
    clearTimeout(this.idleTimer);
    this.idleTimer = 0;
  }
  scheduleReceive() {
    if (this.receiveTimer) return;
    this.clearIdleTimer();
    this.receiveTimer = setTimeout(() => {
      this.receiveTimer = 0;
      this.receive();
    }, this.receiveDelay);
  }
  scheduleIdleCheck() {
    if (this.idleTimer || this.receiveTimer || this.qOut.length) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = 0;
      this.idle();
    }, this.idleDelay);
  }
  start() {
    this.clearReceiveTimer();
    this.clearIdleTimer();
    this.qOut = [];
    this.qIn = [];
    this.msgCount = 0;
    this.idleCount = 0;
    for (const actor of this.actors) actor.makeCell();
    this.startTime = Date.now();
    this.scheduleIdleCheck();
  }
  stop() {
    this.clearReceiveTimer();
    this.clearIdleTimer();
    this.msgCount = 0;
    this.idleCount = 0;
    this.actors.forEach((actor) => actor.cell = null);
    this.qOut = [];
    this.qIn = [];
  }
  halt() {
    this.clearReceiveTimer();
    this.clearIdleTimer();
  }
  continue() {
    if (this.qOut.length) this.scheduleReceive();
    else this.scheduleIdleCheck();
  }
  switch() {
    const temp = this.qIn;
    this.qIn = this.qOut;
    this.qOut = temp;
    this.qOut.length = 0;
  }
  idle() {
    this.idleCount++;
    const now = Date.now();
    this.qResolve.checkTimeouts(now);
    if (this.idleCount % 600 == 0) {
      const min = (now - this.startTime) / 6e4;
      console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`);
    }
    this.scheduleIdleCheck();
  }
  reject(reason) {
    return new Promise((resolve, reject) => {
      reject(new Error(reason));
    });
  }
  logMessage(msg) {
    console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}]`);
  }
  logReqReply(msg, what) {
    console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}] (${what})`);
  }
  logNotConnected(nodeName, pinName) {
    console.log(`${nodeName}[${pinName}] : not connected.`);
  }
  sendTo(tx, source, param) {
    var _a, _b;
    if (tx.targets.length < 1) {
      if ((_a = source.logsMessages) == null ? void 0 : _a.call(source)) this.logNotConnected(source.name, tx.pin);
      return 0;
    }
    ++this.msgCount;
    const log = (_b = source.logsMessages) == null ? void 0 : _b.call(source);
    for (const target of tx.targets) {
      this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef: 0, txPin: tx.pin, rxRef: 0, rxPin: target.pin });
      if (log) this.logMessage(this.qOut.at(-1));
    }
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
    return tx.targets.length;
  }
  requestFrom(tx, source, param, timeout) {
    var _a, _b;
    if (tx.targets.length < 1) {
      if ((_a = source.logsMessages) == null ? void 0 : _a.call(source)) this.logNotConnected(source.name, tx.pin);
      return this.reject("Not connected");
    }
    const txRef = ++this.msgCount;
    let channelCount = 0;
    const log = (_b = source.logsMessages) == null ? void 0 : _b.call(source);
    for (const target of tx.targets) {
      this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef, txPin: tx.pin, rxRef: 0, rxPin: target.pin });
      if (log) this.logReqReply(this.qOut.at(-1), "request");
      if (target.channel) channelCount++;
    }
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
    if (channelCount == 0) return this.reject("No channel");
    return this.qResolve.addPromiseHandler(txRef, timeout, channelCount);
  }
  reply(source, param) {
    var _a, _b;
    if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return 0;
    ++this.msgCount;
    this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef: 0, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin });
    if ((_b = source.logsMessages) == null ? void 0 : _b.call(source)) this.logReqReply(this.qOut.at(-1), "reply");
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
    return 1;
  }
  next(source, param, timeout) {
    var _a;
    if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return this.reject("No target");
    const txRef = ++this.msgCount;
    this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin });
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
    return this.qResolve.addPromiseHandler(txRef, timeout);
  }
  receive() {
    if (!this.qOut.length) return this.scheduleIdleCheck();
    this.switch();
    this.handleReceiveQueue();
    if (this.qOut.length && !this.receiveTimer) this.scheduleReceive();
    else this.scheduleIdleCheck();
  }
  handleReceiveQueue() {
    var _a, _b;
    for (const msg of this.qIn) {
      const dest = msg.dest;
      switch (msg.hix & HIX_TYPE_MASK) {
        case HIX_HANDLER:
          {
            dest.msg = msg;
            if ((_a = dest.logsMessages) == null ? void 0 : _a.call(dest)) this.logMessage(msg);
            dest.rxSink[msg.hix].handler.call(dest.cell, msg.param);
          }
          break;
        case HIX_REPLY:
          {
            if ((_b = dest.logsMessages) == null ? void 0 : _b.call(dest)) this.logReqReply(msg, "incoming reply");
            this.qResolve.trigger(msg.rxRef, msg.param);
          }
          break;
      }
    }
  }
  reschedule(msg) {
    this.qOut.push(msg);
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
  }
};
__name(_Runtime, "Runtime");
var Runtime = _Runtime;

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

// rt-als/runtime-settings.js
var PERMISSIONS = ["allow", "warn", "deny"];
var PERMISSION_ORDER = { deny: 0, warn: 1, allow: 2 };
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
function make() {
  return {
    run: defaultRun(),
    monitor: defaultMonitor(),
    security: defaultSecurity()
  };
}
__name(make, "make");
function normalize(dx = null) {
  var _a, _b;
  const defaults = make();
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
  target.security = structuredClone(normalized.security);
  delete target.logMessages;
  delete target.worker;
  delete target.safety;
  return target;
}
__name(assign, "assign");
function isDefault(dx = null) {
  const normalized = normalize(dx);
  const defaults = make();
  if (!normalized.security.enabled || isDefaultSecurityPolicy(normalized.security)) {
    normalized.security = structuredClone(defaults.security);
  }
  return JSON.stringify(normalized) === JSON.stringify(defaults);
}
__name(isDefault, "isDefault");
function makeModel() {
  return {
    run: {},
    monitor: {},
    security: defaultSecurityPolicy()
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
    },
    security: normalizeModelSecurity(settings.security)
  };
}
__name(normalizeModel, "normalizeModel");
function effectivePolicy(modelSettings = null, nodeDx = null) {
  var _a;
  const hasModelSecurity = !!(modelSettings && typeof modelSettings === "object" && modelSettings.security);
  const model = normalizeModel(modelSettings);
  const node = normalize(nodeDx);
  const nodeSecurity = ((_a = node.security) == null ? void 0 : _a.enabled) ? node.security : defaultSecurity();
  return {
    active: hasModelSecurity,
    security: intersectSecurity(model.security, nodeSecurity),
    model,
    node
  };
}
__name(effectivePolicy, "effectivePolicy");
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

// security/safety.js
import childProcess from "child_process";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
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
      const effectivePolicy2 = (_d = (_c = runtime == null ? void 0 : runtime.settings) == null ? void 0 : _c.effectivePolicy) == null ? void 0 : _d.call(_c, modelRuntimeSettings, actor == null ? void 0 : actor.dx);
      if (!(effectivePolicy2 == null ? void 0 : effectivePolicy2.active) || !(effectivePolicy2 == null ? void 0 : effectivePolicy2.security)) return null;
      const operation = parseOperation(event.operation ?? event.cap ?? event.capability);
      const policy = operationPolicy(effectivePolicy2.security, operation);
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
    wrapMethod(childProcess, "exec", (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
      report("process.exec", { command: safeString(command) });
      return original.call(this, command, ...args);
    }, "wrappedExec"), restores);
    wrapMethod(childProcess, "execFile", (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, args, options, callback) {
      const argv = Array.isArray(args) ? args : [];
      report("process.exec", { command: safeString(file), args: argv.slice() });
      return original.call(this, file, args, options, callback);
    }, "wrappedExecFile"), restores);
    wrapMethod(childProcess, "spawn", (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, args, options) {
      report("process.exec", { command: safeString(command), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, command, args, options);
    }, "wrappedSpawn"), restores);
    wrapMethod(childProcess, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, args, options) {
      report("process.exec", { command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : [] });
      return original.call(this, modulePath, args, options);
    }, "wrappedFork"), restores);
  }
  installFsHooks(restores) {
    const report = /* @__PURE__ */ __name((cap, detail) => this.emitCapability(cap, detail), "report");
    for (const key of ["readFile", "readFileSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFsRead(path2, ...args) {
        report("fs.read", { path: safeString(path2) });
        return original.call(this, path2, ...args);
      }, "wrappedFsRead"), restores);
    }
    for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFs(path2, ...args) {
        report("fs.write", { path: safeString(path2) });
        return original.call(this, path2, ...args);
      }, "wrappedFs"), restores);
    }
    for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
      wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedDelete(path2, ...args) {
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
    wrapMethod(http, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
      report("net.egress", {
        url: describeRequestUrl(input, options, "http:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpRequest"), restores);
    wrapMethod(https, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
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
  return path.resolve(String(value ?? "")).replaceAll("\\", "/").replace(/\/+$/, "");
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

// rt-als/runtime.js
var _Runtime2 = class _Runtime2 extends Runtime {
  configure(options = {}) {
    safety.setPolicyClassifier(safety.makePolicyClassifier({
      runtime: this,
      runtimeSettings: options.runtimeSettings
    }));
  }
  handleReceiveQueue() {
    var _a, _b;
    for (const msg of this.qIn) {
      const dest = msg.dest;
      switch (msg.hix & HIX_TYPE_MASK) {
        case HIX_HANDLER:
          {
            dest.msg = msg;
            if ((_a = dest.logsMessages) == null ? void 0 : _a.call(dest)) this.logMessage(msg);
            runAsNode(dest.name, () => dest.rxSink[msg.hix].handler.call(dest.cell, msg.param));
          }
          break;
        case HIX_REPLY:
          {
            if ((_b = dest.logsMessages) == null ? void 0 : _b.call(dest)) this.logReqReply(msg, "incoming reply");
            this.qResolve.trigger(msg.rxRef, msg.param);
          }
          break;
      }
    }
  }
};
__name(_Runtime2, "Runtime");
var Runtime2 = _Runtime2;
Runtime2.prototype.settings = runtimeSettings;

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

// rt-als/index.js
var VERSION = "0.1.1";
export {
  Runtime2 as Runtime,
  SecurityReporterFactory,
  VERSION,
  safety
};
//# sourceMappingURL=index.js.map