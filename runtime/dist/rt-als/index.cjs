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

// rt-als/index.js
var index_exports = {};
__export(index_exports, {
  Runtime: () => Runtime2,
  SecurityPolicyError: () => SecurityPolicyError,
  SecurityReporterFactory: () => SecurityReporterFactory,
  VERSION: () => VERSION,
  safety: () => safety
});
module.exports = __toCommonJS(index_exports);

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
        if (tx) return runtime.sendTo(source, tx.pin, tx.targets, param);
      }
      console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? "missing !!"}"`, source.txMap);
      return 0;
    },
    request(pin, param, timeout = 0) {
      if (pin) {
        const tx = source.findTx(pin);
        if (tx) return runtime.requestFrom(source, tx.pin, tx.targets, param, timeout);
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
    to(nodeName) {
      const _nodeName = nodeName;
      return {
        send(pin, param) {
          if (pin) {
            const tx = source.findTx(pin);
            if (tx) {
              const actualTarget = tx.targets.find((target) => target.actor.name.toLowerCase() == _nodeName.toLowerCase());
              if (actualTarget) {
                return runtime.sendTo(source, tx.pin, [actualTarget], param);
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
                return runtime.requestFrom(source, tx.pin, [actualTarget], param, timeout);
              }
              console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`);
              return runtime.reject("selected node not connected");
            }
          }
          console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
          return runtime.reject("No such output pin");
        }
      };
    },
    select(nodeName) {
      return this.to(nodeName);
    }
  };
}
__name(createTx, "createTx");

// shared/release-version.js
var RUNTIME_VERSION = "1.12.0";
function runtimeCompatibilityFamily(version = RUNTIME_VERSION) {
  const match = String(version ?? "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`Invalid vmblu runtime version: ${version}`);
  return `${match[1]}.${match[2]}`;
}
__name(runtimeCompatibilityFamily, "runtimeCompatibilityFamily");
function assertRuntimeCompatibility(expectedFamily) {
  if (!expectedFamily) return runtimeCompatibilityFamily();
  const actualFamily = runtimeCompatibilityFamily();
  if (expectedFamily !== actualFamily) {
    throw new Error(`Incompatible vmblu runtime ${RUNTIME_VERSION}; generated application requires compatibility family ${expectedFamily}`);
  }
  return actualFamily;
}
__name(assertRuntimeCompatibility, "assertRuntimeCompatibility");

// shared/runtime.js
var _Runtime = class _Runtime {
  constructor(nodeList = [], options = {}) {
    var _a;
    assertRuntimeCompatibility((_a = options == null ? void 0 : options.vmblu) == null ? void 0 : _a.compatibilityFamily);
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
  sendTo(source, pin, targets, param) {
    var _a, _b;
    if (targets.length < 1) {
      if ((_a = source.logsMessages) == null ? void 0 : _a.call(source)) this.logNotConnected(source.name, pin);
      return 0;
    }
    ++this.msgCount;
    const log = (_b = source.logsMessages) == null ? void 0 : _b.call(source);
    for (const target of targets) {
      this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef: 0, txPin: pin, rxRef: 0, rxPin: target.pin });
      if (log) this.logMessage(this.qOut.at(-1));
    }
    this.idleCount = 0;
    if (!this.receiveTimer) this.scheduleReceive();
    return targets.length;
  }
  requestFrom(source, pin, targets, param, timeout) {
    var _a, _b;
    if (targets.length < 1) {
      if ((_a = source.logsMessages) == null ? void 0 : _a.call(source)) this.logNotConnected(source.name, pin);
      return this.reject("Not connected");
    }
    const txRef = ++this.msgCount;
    let channelCount = 0;
    const log = (_b = source.logsMessages) == null ? void 0 : _b.call(source);
    for (const target of targets) {
      this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef, txPin: pin, rxRef: 0, rxPin: target.pin });
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

// security/safety.js
var import_node_child_process = __toESM(require("child_process"), 1);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_http = __toESM(require("http"), 1);
var import_node_https = __toESM(require("https"), 1);
var import_node_path = __toESM(require("path"), 1);
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
    state.baseDir = import_node_path.default.resolve(baseDir || process.cwd());
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
      wrapMethod(import_node_child_process.default, key, (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
        report({ command: safeString(command), shell: true });
        return original.call(this, command, ...args);
      }, "wrappedExec"), restores);
    }
    for (const key of ["execFile", "execFileSync"]) {
      wrapMethod(import_node_child_process.default, key, (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, ...rest) {
        const argv = Array.isArray(rest[0]) ? rest[0] : [];
        const actualOptions = Array.isArray(rest[0]) ? rest[1] : rest[0];
        report({ command: safeString(file), args: argv.slice(), shell: !!(actualOptions == null ? void 0 : actualOptions.shell) });
        return original.call(this, file, ...rest);
      }, "wrappedExecFile"), restores);
    }
    for (const key of ["spawn", "spawnSync"]) {
      wrapMethod(import_node_child_process.default, key, (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, ...rest) {
        const argv = Array.isArray(rest[0]) ? rest[0] : [];
        const options = Array.isArray(rest[0]) ? rest[1] : rest[0];
        report({ command: safeString(command), args: argv.slice(), shell: !!(options == null ? void 0 : options.shell) });
        return original.call(this, command, ...rest);
      }, "wrappedSpawn"), restores);
    }
    wrapMethod(import_node_child_process.default, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, ...rest) {
      const argv = Array.isArray(rest[0]) ? rest[0] : [];
      report({ command: safeString(process.execPath), args: [safeString(modulePath), ...argv], shell: false });
      return original.call(this, modulePath, ...rest);
    }, "wrappedFork"), restores);
  }
  installFsHooks(restores) {
    for (const key of ["readFile", "readFileSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedFsRead(target, ...args) {
        safety.report("fs.read", { path: safeString(target) });
        return original.call(this, target, ...args);
      }, "wrappedFsRead"), restores);
    }
    for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedFsWrite(target, ...args) {
        safety.report("fs.write", { path: safeString(target) });
        return original.call(this, target, ...args);
      }, "wrappedFsWrite"), restores);
    }
    for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
      wrapMethod(import_node_fs.default, key, (original) => /* @__PURE__ */ __name(function wrappedFsDelete(target, ...args) {
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
    wrapMethod(import_node_http.default, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
      safety.report("net.egress", {
        url: describeRequestUrl(input, options, "http:"),
        method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
      });
      return original.call(this, input, options, callback);
    }, "wrappedHttpRequest"), restores);
    wrapMethod(import_node_https.default, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
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
  const absolute = import_node_path.default.resolve(baseDir, String(value ?? ""));
  let existing = absolute;
  const suffix = [];
  while (!import_node_fs.default.existsSync(existing)) {
    const parent = import_node_path.default.dirname(existing);
    if (parent === existing) break;
    suffix.unshift(import_node_path.default.basename(existing));
    existing = parent;
  }
  let resolved = existing;
  try {
    resolved = import_node_fs.default.realpathSync.native(existing);
  } catch {
    resolved = existing;
  }
  resolved = import_node_path.default.join(resolved, ...suffix).replaceAll("\\", "/").replace(/\/+$/, "");
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
  if (import_node_path.default.isAbsolute(command) || command.includes("/") || command.includes("\\")) return canonicalPath(command, baseDir);
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const folder of (process.env.PATH ?? "").split(import_node_path.default.delimiter)) {
    for (const extension of extensions) {
      const candidate = import_node_path.default.join(folder, process.platform === "win32" && !import_node_path.default.extname(command) ? `${command}${extension}` : command);
      if (import_node_fs.default.existsSync(candidate)) return canonicalPath(candidate, baseDir);
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

// rt-als/runtime.js
var _Runtime2 = class _Runtime2 extends Runtime {
  configure(options = {}) {
    this.securitySettings = options.runtimeSettings ?? null;
    this.securityBaseDir = options.securityBaseDir ?? null;
  }
  start() {
    if (safety.isOwner(this)) safety.release(this);
    const validationErrors = this.settings.validateModel(this.securitySettings).filter((error) => error.code !== "legacy_security");
    if (validationErrors.length) {
      throw new Error(`Invalid vmblu security settings: ${validationErrors.map((error) => error.message).join("; ")}`);
    }
    const policy = this.settings.effectivePolicy(this.securitySettings);
    if (policy.active && hasRelativeRoots(policy.security) && !this.securityBaseDir) {
      throw new Error("vmblu security requires securityBaseDir when file roots are relative");
    }
    try {
      if (policy.active) {
        safety.claim(this, {
          security: policy.security,
          baseDir: this.securityBaseDir
        });
      }
      return super.start();
    } catch (error) {
      safety.release(this);
      throw error;
    }
  }
  stop() {
    try {
      return super.stop();
    } finally {
      safety.release(this);
    }
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
function hasRelativeRoots(security) {
  return ["read", "write", "delete"].some((action) => {
    var _a, _b;
    const operation = (_a = security == null ? void 0 : security.fs) == null ? void 0 : _a[action];
    return (_b = operation == null ? void 0 : operation.roots) == null ? void 0 : _b.some((root) => !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(root));
  });
}
__name(hasRelativeRoots, "hasRelativeRoots");
Runtime2.prototype.settings = runtimeSettings2;

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

// rt-als/index.js
var VERSION = "0.1.1";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Runtime,
  SecurityPolicyError,
  SecurityReporterFactory,
  VERSION,
  safety
});
//# sourceMappingURL=index.cjs.map