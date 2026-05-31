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

// rt-browser-agent/index.js
var index_exports = {};
__export(index_exports, {
  AgentAdapterRegistry: () => AgentAdapterRegistry,
  AgentOverlay: () => AgentOverlay,
  AgentPolicy: () => AgentPolicy,
  AgentRuntime: () => AgentRuntime,
  BrokerRequestTypes: () => BrokerRequestTypes,
  BrokerResultTypes: () => BrokerResultTypes,
  CapabilityRegistry: () => CapabilityRegistry,
  HttpAgentAdapter: () => HttpAgentAdapter,
  OpenAIAgentAdapter: () => OpenAIAgentAdapter,
  OpenAIChatProvider: () => OpenAIChatProvider,
  Runtime: () => Runtime3,
  ToolBroker: () => ToolBroker,
  ToolResultStatus: () => ToolResultStatus,
  TraceRecorder: () => TraceRecorder,
  VERSION: () => VERSION,
  VmbluAgentAdapter: () => VmbluAgentAdapter,
  agentAdapterRegistry: () => agentAdapterRegistry,
  brokerError: () => brokerError,
  validateJsonSchema: () => validateJsonSchema
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
  reject(error2) {
    this._reject(error2);
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
    const matches2 = targetString.match(regex);
    const targetStringArray = matches2 ? matches2.map((part) => part.slice(1, -1).replace(/\\"/g, '"')) : [];
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
var defaultSecurity = /* @__PURE__ */ __name(() => ({
  enabled: false
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
    security: {
      ...defaults.security,
      ...dx.security ?? {}
    }
  };
  normalized.run.worker.on = !!normalized.run.worker.on;
  normalized.run.worker.path = normalized.run.worker.path ?? "";
  normalized.monitor.logMessages = !!normalized.monitor.logMessages;
  normalized.monitor.logTimings = !!normalized.monitor.logTimings;
  normalized.security.enabled = !!normalized.security.enabled;
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
    monitor: {},
    security: {
      mode: "warn",
      forwardEvents: true,
      defaults: {},
      allow: {}
    }
  };
}
__name(makeModel, "makeModel");
function normalizeModel(settings = null) {
  var _a, _b;
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
    security: {
      ...defaults.security,
      ...settings.security ?? {},
      defaults: {
        ...defaults.security.defaults,
        ...((_a = settings.security) == null ? void 0 : _a.defaults) ?? {}
      },
      allow: {
        ...defaults.security.allow,
        ...((_b = settings.security) == null ? void 0 : _b.allow) ?? {}
      }
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

// rt-base/runtime.js
var _Runtime2 = class _Runtime2 extends Runtime {
};
__name(_Runtime2, "Runtime");
var Runtime2 = _Runtime2;
Runtime2.prototype.settings = runtimeSettings;

// rt-agent/broker-protocol.js
var BrokerRequestTypes = Object.freeze({
  CAPABILITIES_LIST: "capabilities.list",
  TOOL_CALL: "tool.call",
  PROBE_READ: "probe.read",
  EVENT_WAIT: "event.wait",
  EVENTS_QUERY: "events.query",
  APPROVAL_RESOLVE: "approval.resolve"
});
var BrokerResultTypes = Object.freeze({
  CAPABILITIES_RESULT: "capabilities.result",
  TOOL_RESULT: "tool.result",
  PROBE_RESULT: "probe.result",
  EVENT_RESULT: "event.result",
  EVENTS_RESULT: "events.result",
  BROKER_ERROR: "broker.error"
});
var ToolResultStatus = Object.freeze({
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
  PENDING: "pending",
  FAILED: "failed",
  TIMEOUT: "timeout",
  DENIED: "denied"
});
function brokerError(request, code, message, details = void 0) {
  return {
    type: BrokerResultTypes.BROKER_ERROR,
    requestId: request == null ? void 0 : request.requestId,
    error: {
      code,
      message,
      details
    }
  };
}
__name(brokerError, "brokerError");

// rt-agent/agent-overlay.js
var STORAGE_PREFIX = "vmblu.rt-agent.overlay.";
var _AgentOverlay = class _AgentOverlay {
  constructor({ agent, broker = null, traceRecorder = null, config = {} } = {}) {
    var _a, _b;
    this.agent = agent;
    this.broker = broker ?? (agent == null ? void 0 : agent.broker) ?? null;
    this.traceRecorder = traceRecorder ?? ((_a = this.broker) == null ? void 0 : _a.trace) ?? null;
    this.config = config ?? {};
    this.agentId = (agent == null ? void 0 : agent.id) ?? ((_b = this.config) == null ? void 0 : _b.id) ?? "agent";
    this.storageKey = `${STORAGE_PREFIX}${this.agentId}`;
    this.messages = [];
    this.traceRecords = [];
    this.activeTab = "chat";
    this.theme = this.loadTheme();
    this.dragState = null;
    this.resizeObserver = null;
    this.unsubscribers = [];
    this.elements = {};
  }
  mount() {
    if (typeof document === "undefined") return this;
    if (this.root) return this;
    this.injectStyles();
    this.root = document.createElement("div");
    this.root.className = "vmblu-agent-overlay";
    this.root.innerHTML = this.template();
    document.body.appendChild(this.root);
    this.collectElements();
    this.restoreBounds();
    this.bindEvents();
    this.subscribe();
    this.observeBounds();
    this.renderHeader();
    this.renderChat();
    this.renderTrace();
    this.showLauncher();
    return this;
  }
  unmount() {
    var _a, _b;
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    (_a = this.resizeObserver) == null ? void 0 : _a.disconnect();
    this.resizeObserver = null;
    this.stopDrag();
    (_b = this.root) == null ? void 0 : _b.remove();
    this.root = null;
    this.elements = {};
  }
  template() {
    return `
            <button class="vmblu-agent-launcher" type="button" title="Open agent">AI</button>
            <section class="vmblu-agent-window" hidden>
                <header class="vmblu-agent-header">
                    <div class="vmblu-agent-title">
                        <strong></strong>
                        <span></span>
                    </div>
                    <div class="vmblu-agent-actions">
                        <button class="vmblu-agent-theme" type="button" title="Switch theme">Dark</button>
                        <button class="vmblu-agent-maximize" type="button" title="Maximize">[]</button>
                        <button class="vmblu-agent-close" type="button" title="Close">x</button>
                    </div>
                </header>
                <nav class="vmblu-agent-tabs" aria-label="Agent views">
                    <button class="vmblu-agent-tab is-active" type="button" data-tab="chat">Chat</button>
                    <button class="vmblu-agent-tab" type="button" data-tab="trace">Trace</button>
                </nav>
                <main class="vmblu-agent-body">
                    <section class="vmblu-agent-panel is-active" data-panel="chat">
                        <div class="vmblu-agent-chat-log"></div>
                        <form class="vmblu-agent-chat-form">
                            <textarea rows="2" placeholder="Ask the agent"></textarea>
                            <button type="submit">Send</button>
                        </form>
                    </section>
                    <section class="vmblu-agent-panel" data-panel="trace">
                        <div class="vmblu-agent-trace-toolbar">
                            <button class="vmblu-agent-trace-clear" type="button">Clear</button>
                        </div>
                        <div class="vmblu-agent-trace-log"></div>
                    </section>
                </main>
            </section>
        `;
  }
  collectElements() {
    this.elements.launcher = this.root.querySelector(".vmblu-agent-launcher");
    this.elements.window = this.root.querySelector(".vmblu-agent-window");
    this.elements.header = this.root.querySelector(".vmblu-agent-header");
    this.elements.title = this.root.querySelector(".vmblu-agent-title strong");
    this.elements.subtitle = this.root.querySelector(".vmblu-agent-title span");
    this.elements.close = this.root.querySelector(".vmblu-agent-close");
    this.elements.theme = this.root.querySelector(".vmblu-agent-theme");
    this.elements.maximize = this.root.querySelector(".vmblu-agent-maximize");
    this.elements.tabs = [...this.root.querySelectorAll(".vmblu-agent-tab")];
    this.elements.panels = [...this.root.querySelectorAll(".vmblu-agent-panel")];
    this.elements.chatLog = this.root.querySelector(".vmblu-agent-chat-log");
    this.elements.chatForm = this.root.querySelector(".vmblu-agent-chat-form");
    this.elements.chatInput = this.root.querySelector(".vmblu-agent-chat-form textarea");
    this.elements.chatSubmit = this.root.querySelector(".vmblu-agent-chat-form button");
    this.elements.traceLog = this.root.querySelector(".vmblu-agent-trace-log");
    this.elements.traceClear = this.root.querySelector(".vmblu-agent-trace-clear");
  }
  bindEvents() {
    this.elements.launcher.addEventListener("click", () => this.open());
    this.elements.close.addEventListener("click", () => this.close());
    this.elements.theme.addEventListener("click", () => this.toggleTheme());
    this.elements.maximize.addEventListener("click", () => this.toggleMaximize());
    this.elements.header.addEventListener("pointerdown", (event) => this.startDrag(event));
    this.root.addEventListener("keydown", (event) => event.stopPropagation());
    this.root.addEventListener("keyup", (event) => event.stopPropagation());
    this.elements.chatForm.addEventListener("submit", (event) => this.submitChat(event));
    this.elements.traceClear.addEventListener("click", () => this.clearTrace());
    for (const tab of this.elements.tabs) {
      tab.addEventListener("click", () => this.selectTab(tab.dataset.tab));
    }
  }
  observeBounds() {
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => {
      var _a;
      if (!((_a = this.elements.window) == null ? void 0 : _a.hidden)) this.saveBounds();
    });
    this.resizeObserver.observe(this.elements.window);
  }
  subscribe() {
    var _a, _b, _c, _d;
    if ((_a = this.agent) == null ? void 0 : _a.subscribe) {
      this.unsubscribers.push(this.agent.subscribe((message) => {
        if ((message == null ? void 0 : message.kind) === "chat.assistant") this.addMessage("agent", message.content || "");
        else this.addMessage("broker", this.formatBrokerMessage(message));
      }));
    }
    if ((_b = this.traceRecorder) == null ? void 0 : _b.subscribe) {
      this.traceRecords = ((_d = (_c = this.traceRecorder).all) == null ? void 0 : _d.call(_c)) ?? [];
      this.unsubscribers.push(this.traceRecorder.subscribe((record) => {
        this.traceRecords.push(record);
        this.renderTrace();
      }));
    }
  }
  renderHeader() {
    var _a, _b;
    const title = ((_a = this.config) == null ? void 0 : _a.title) || this.agentId;
    const llm = ((_b = this.config) == null ? void 0 : _b.llm) ?? {};
    const provider = [llm.provider, llm.model].filter(Boolean).join(" / ");
    this.elements.title.textContent = title;
    this.elements.subtitle.textContent = provider || "No provider configured";
    this.applyTheme();
  }
  renderChat() {
    const log = this.elements.chatLog;
    log.textContent = "";
    if (this.messages.length === 0) {
      this.addStaticMessage(log, "system", "Agent overlay ready. Chat is routed through the configured provider adapter; tools and trace are available.");
      this.renderCapabilitySummary(log);
      return;
    }
    for (const message of this.messages.slice(-80)) {
      this.addStaticMessage(log, message.role, message.text);
    }
    log.scrollTop = log.scrollHeight;
  }
  renderCapabilitySummary(log) {
    var _a, _b, _c;
    const tools = ((_c = (_b = (_a = this.broker) == null ? void 0 : _a.registry) == null ? void 0 : _b.list) == null ? void 0 : _c.call(_b).tools) ?? [];
    if (tools.length === 0) {
      this.addStaticMessage(log, "system", "No tools are published.");
      return;
    }
    this.addStaticMessage(log, "system", `Published tools: ${tools.map((tool) => tool.id).join(", ")}`);
  }
  addStaticMessage(log, role, text) {
    const item = document.createElement("div");
    item.className = `vmblu-agent-message vmblu-agent-message-${role}`;
    const label = document.createElement("span");
    label.textContent = role;
    const body = document.createElement("p");
    body.textContent = text;
    item.append(label, body);
    log.appendChild(item);
  }
  addMessage(role, text) {
    this.messages.push({ role, text, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    this.renderChat();
  }
  async submitChat(event) {
    var _a;
    event.preventDefault();
    const text = this.elements.chatInput.value.trim();
    if (!text) return;
    this.elements.chatInput.value = "";
    this.addMessage("user", text);
    this.setChatBusy(true);
    try {
      if (!((_a = this.agent) == null ? void 0 : _a.submitUserMessage)) throw new Error("Agent runtime does not support chat submission");
      await this.agent.submitUserMessage(text);
    } finally {
      this.setChatBusy(false);
    }
  }
  setChatBusy(busy) {
    if (this.elements.chatInput) this.elements.chatInput.disabled = busy;
    if (this.elements.chatSubmit) {
      this.elements.chatSubmit.disabled = busy;
      this.elements.chatSubmit.textContent = busy ? "..." : "Send";
    }
  }
  renderTrace() {
    const log = this.elements.traceLog;
    if (!log) return;
    log.textContent = "";
    const records = this.traceRecords.slice(-200);
    if (records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "vmblu-agent-trace-empty";
      empty.textContent = "No trace records yet.";
      log.appendChild(empty);
      return;
    }
    for (const record of records) {
      const item = document.createElement("article");
      item.className = `vmblu-agent-trace-item vmblu-agent-trace-${record.status || "info"}`;
      const meta = document.createElement("div");
      meta.className = "vmblu-agent-trace-meta";
      meta.textContent = [
        this.timeOnly(record.timestamp),
        record.type,
        record.status,
        record.agentId,
        record.requestId,
        record.callId
      ].filter(Boolean).join(" | ");
      const details = document.createElement("pre");
      details.textContent = this.formatTraceDetails(record);
      item.append(meta, details);
      log.appendChild(item);
    }
    log.scrollTop = log.scrollHeight;
  }
  clearTrace() {
    var _a, _b;
    (_b = (_a = this.traceRecorder) == null ? void 0 : _a.clear) == null ? void 0 : _b.call(_a);
    this.traceRecords = [];
    this.renderTrace();
  }
  formatTraceDetails(record) {
    const { traceId, timestamp, type, status, agentId, requestId, callId, ...rest } = record;
    return Object.keys(rest).length ? JSON.stringify(rest, null, 2) : traceId;
  }
  formatBrokerMessage(message) {
    if ((message == null ? void 0 : message.kind) === "broker.result") {
      const result = message.result ?? {};
      return `${result.type || "result"} ${result.toolId || result.probeId || result.eventId || ""} ${result.status || ""}`.trim();
    }
    if ((message == null ? void 0 : message.kind) === "event.observed") return `Event observed: ${message.eventId}`;
    return (message == null ? void 0 : message.kind) || "Broker message";
  }
  selectTab(name) {
    this.activeTab = name;
    for (const tab of this.elements.tabs) tab.classList.toggle("is-active", tab.dataset.tab === name);
    for (const panel of this.elements.panels) panel.classList.toggle("is-active", panel.dataset.panel === name);
  }
  open() {
    var _a;
    this.elements.window.hidden = false;
    this.elements.launcher.hidden = true;
    (_a = this.elements.chatInput) == null ? void 0 : _a.focus();
  }
  close() {
    this.elements.window.hidden = true;
    this.elements.launcher.hidden = false;
    this.saveBounds();
  }
  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    this.applyTheme();
    this.saveTheme();
  }
  applyTheme() {
    if (!this.root) return;
    this.root.dataset.theme = this.theme;
    if (this.elements.theme) {
      this.elements.theme.textContent = this.theme === "dark" ? "Light" : "Dark";
      this.elements.theme.title = this.theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    }
  }
  toggleMaximize() {
    const win = this.elements.window;
    if (win.classList.contains("is-maximized")) {
      win.classList.remove("is-maximized");
      this.restoreBounds();
      this.elements.maximize.title = "Maximize";
      return;
    }
    this.saveBounds();
    win.classList.add("is-maximized");
    win.style.left = "8px";
    win.style.top = "8px";
    win.style.right = "8px";
    win.style.bottom = "8px";
    win.style.width = "auto";
    win.style.height = "auto";
    this.elements.maximize.title = "Restore";
  }
  showLauncher() {
    this.elements.launcher.hidden = false;
    this.elements.window.hidden = true;
  }
  startDrag(event) {
    if (event.target.closest("button")) return;
    if (this.elements.window.classList.contains("is-maximized")) return;
    const win = this.elements.window;
    const rect = win.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    this.elements.header.setPointerCapture(event.pointerId);
    this.elements.header.addEventListener("pointermove", this.onDrag);
    this.elements.header.addEventListener("pointerup", this.onDragEnd);
  }
  onDrag = /* @__PURE__ */ __name((event) => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const left = this.dragState.left + event.clientX - this.dragState.startX;
    const top = this.dragState.top + event.clientY - this.dragState.startY;
    this.setWindowPosition(left, top);
  }, "onDrag");
  onDragEnd = /* @__PURE__ */ __name((event) => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    this.stopDrag();
    this.saveBounds();
  }, "onDragEnd");
  stopDrag() {
    var _a, _b, _c;
    if (!this.elements.header) return;
    if (((_a = this.dragState) == null ? void 0 : _a.pointerId) && ((_c = (_b = this.elements.header).hasPointerCapture) == null ? void 0 : _c.call(_b, this.dragState.pointerId))) {
      this.elements.header.releasePointerCapture(this.dragState.pointerId);
    }
    this.elements.header.removeEventListener("pointermove", this.onDrag);
    this.elements.header.removeEventListener("pointerup", this.onDragEnd);
    this.dragState = null;
  }
  setWindowPosition(left, top) {
    const win = this.elements.window;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - win.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - win.offsetHeight - margin);
    win.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
    win.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
    win.style.right = "auto";
    win.style.bottom = "auto";
  }
  saveBounds() {
    if (typeof localStorage === "undefined" || !this.elements.window) return;
    if (this.elements.window.classList.contains("is-maximized")) return;
    const rect = this.elements.window.getBoundingClientRect();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }));
    } catch {
    }
  }
  loadTheme() {
    try {
      const value = typeof localStorage !== "undefined" ? localStorage.getItem(`${this.storageKey}.theme`) : null;
      return value === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  saveTheme() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(`${this.storageKey}.theme`, this.theme);
    } catch {
    }
  }
  restoreBounds() {
    const win = this.elements.window;
    let bounds = null;
    try {
      bounds = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(this.storageKey) || "null") : null;
    } catch {
      bounds = null;
    }
    if (bounds) {
      win.style.width = `${bounds.width}px`;
      win.style.height = `${bounds.height}px`;
      win.style.left = `${bounds.left}px`;
      win.style.top = `${bounds.top}px`;
      win.style.right = "auto";
      win.style.bottom = "auto";
    }
  }
  timeOnly(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleTimeString();
  }
  injectStyles() {
    if (document.getElementById("vmblu-agent-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "vmblu-agent-overlay-style";
    style.textContent = `
.vmblu-agent-overlay{--agent-bg:#f8faf9;--agent-band:#eef2f3;--agent-header:#20313d;--agent-header-text:#fff;--agent-text:#17202a;--agent-muted:#667583;--agent-border:#b9c2ca;--agent-card:#fff;--agent-button:#fff;--agent-button-text:#1e2c36;--agent-primary:#17496d;--agent-primary-text:#fff;--agent-chat-user:#eef6fb;--agent-chat-agent:#f1f8ef;position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--agent-text)}
.vmblu-agent-overlay[data-theme="dark"]{--agent-bg:#14191d;--agent-band:#20282e;--agent-header:#0f171c;--agent-header-text:#eef5f7;--agent-text:#e6edf1;--agent-muted:#9eabb4;--agent-border:#3c4850;--agent-card:#1b2227;--agent-button:#263038;--agent-button-text:#e6edf1;--agent-primary:#66a3c7;--agent-primary-text:#0d1418;--agent-chat-user:#182b38;--agent-chat-agent:#1d3127}
.vmblu-agent-launcher{position:fixed;right:18px;bottom:18px;width:48px;height:48px;border:1px solid var(--agent-primary);border-radius:50%;background:var(--agent-primary);color:var(--agent-primary-text);font-weight:700;box-shadow:0 10px 30px rgba(15,27,43,.28);cursor:pointer;pointer-events:auto}
.vmblu-agent-window{position:fixed;right:18px;bottom:78px;width:min(520px,calc(100vw - 36px));height:min(640px,calc(100vh - 112px));min-width:320px;min-height:360px;resize:both;overflow:hidden;pointer-events:auto;background:var(--agent-bg);border:1px solid var(--agent-border);border-radius:8px;box-shadow:0 20px 60px rgba(15,27,43,.32);display:flex;flex-direction:column}
.vmblu-agent-launcher[hidden],.vmblu-agent-window[hidden]{display:none!important}
.vmblu-agent-window.is-maximized{resize:none;border-radius:6px}
.vmblu-agent-header{height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 10px 0 14px;background:var(--agent-header);color:var(--agent-header-text);cursor:move;user-select:none;touch-action:none}
.vmblu-agent-title{min-width:0;display:flex;flex-direction:column;gap:2px}
.vmblu-agent-title strong{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vmblu-agent-title span{font-size:12px;color:var(--agent-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vmblu-agent-actions{display:flex;gap:6px}
.vmblu-agent-actions button,.vmblu-agent-tabs button,.vmblu-agent-chat-form button,.vmblu-agent-trace-toolbar button{border:1px solid var(--agent-border);background:var(--agent-button);color:var(--agent-button-text);border-radius:6px;cursor:pointer}
.vmblu-agent-actions button{height:28px;min-width:28px;padding:0 8px;background:var(--agent-button);color:var(--agent-button-text);border-color:var(--agent-border)}
.vmblu-agent-tabs{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-tab{height:30px;padding:0 12px}
.vmblu-agent-tab.is-active{background:var(--agent-primary);color:var(--agent-primary-text);border-color:var(--agent-primary)}
.vmblu-agent-body{min-height:0;flex:1;display:flex}
.vmblu-agent-panel{display:none;min-width:0;min-height:0;flex:1}
.vmblu-agent-panel.is-active{display:flex;flex-direction:column}
.vmblu-agent-chat-log,.vmblu-agent-trace-log{flex:1;min-height:0;overflow:auto;padding:12px;background:var(--agent-bg)}
.vmblu-agent-message{margin:0 0 10px;padding:9px 10px;border:1px solid var(--agent-border);border-radius:8px;background:var(--agent-card)}
.vmblu-agent-message span{display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;color:var(--agent-muted)}
.vmblu-agent-message p{margin:0;font-size:13px;line-height:1.4;white-space:pre-wrap}
.vmblu-agent-message-user{background:var(--agent-chat-user)}
.vmblu-agent-message-agent{background:var(--agent-chat-agent)}
.vmblu-agent-chat-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-top:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-chat-form textarea{min-width:0;resize:none;border:1px solid var(--agent-border);border-radius:6px;padding:8px;font:inherit;font-size:13px;background:var(--agent-card);color:var(--agent-text)}
.vmblu-agent-chat-form button{width:72px}
.vmblu-agent-trace-toolbar{display:flex;justify-content:flex-end;padding:8px 10px;border-bottom:1px solid var(--agent-border);background:var(--agent-band)}
.vmblu-agent-trace-toolbar button{height:28px;padding:0 10px}
.vmblu-agent-trace-item{margin:0 0 8px;border:1px solid var(--agent-border);border-radius:6px;background:var(--agent-card);overflow:hidden}
.vmblu-agent-trace-meta{padding:6px 8px;background:var(--agent-band);font-size:12px;color:var(--agent-text)}
.vmblu-agent-trace-item pre{margin:0;padding:8px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.35;color:var(--agent-text)}
.vmblu-agent-trace-failed .vmblu-agent-trace-meta,.vmblu-agent-trace-denied .vmblu-agent-trace-meta{background:#f7dfdf;color:#743232}
.vmblu-agent-overlay[data-theme="dark"] .vmblu-agent-trace-failed .vmblu-agent-trace-meta,.vmblu-agent-overlay[data-theme="dark"] .vmblu-agent-trace-denied .vmblu-agent-trace-meta{background:#4a2427;color:#ffc8c8}
.vmblu-agent-trace-empty{font-size:13px;color:var(--agent-muted)}
        `;
    document.head.appendChild(style);
  }
};
__name(_AgentOverlay, "AgentOverlay");
var AgentOverlay = _AgentOverlay;

// rt-agent/openai-chat-provider.js
var _OpenAIChatProvider = class _OpenAIChatProvider {
  constructor({ llm = {}, fetchImpl = null } = {}) {
    this.llm = llm;
    this.fetchImpl = fetchImpl;
  }
  isConfigured() {
    var _a, _b;
    return Boolean(((_a = this.llm) == null ? void 0 : _a.endpoint) && ((_b = this.llm) == null ? void 0 : _b.model));
  }
  async complete({ messages, tools = [] } = {}) {
    if (!this.isConfigured()) throw new Error("OpenAI chat provider requires llm.endpoint and llm.model");
    const fetchFn = this.fetchImpl ?? globalThis.fetch;
    if (typeof fetchFn !== "function") throw new Error("fetch is not available in this runtime");
    const response = await fetchFn(`${normalizeEndpoint(this.llm.endpoint)}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.llm.model,
        messages,
        ...tools.length ? { tools, tool_choice: "auto" } : {}
      })
    });
    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(`LLM bridge error: ${response.status} ${text || response.statusText}`);
    }
    return response.json();
  }
};
__name(_OpenAIChatProvider, "OpenAIChatProvider");
var OpenAIChatProvider = _OpenAIChatProvider;
function normalizeEndpoint(endpoint) {
  return String(endpoint || "").replace(/\/+$/, "");
}
__name(normalizeEndpoint, "normalizeEndpoint");
async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
__name(safeReadText, "safeReadText");

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

// rt-agent/agent-runtime.js
var DEFAULT_MAX_TOOL_ROUNDS = 4;
var _AgentRuntime = class _AgentRuntime {
  constructor({ id, broker = null, provider = null, config = {} } = {}) {
    this.id = id ?? (config == null ? void 0 : config.id) ?? "mainAssistant";
    this.config = this.normalizeConfig(config);
    this.llm = this.config.llm ?? {};
    this.provider = provider ?? this.createProvider();
    this.broker = null;
    this.messages = [];
    this.transcript = [];
    this.recentEvents = [];
    this.turnQueue = Promise.resolve();
    this.listeners = /* @__PURE__ */ new Set();
    this.nextRequestId = 1;
    this.overlay = null;
    this.tools = {
      call: /* @__PURE__ */ __name((toolId, args = {}, options = {}) => this.callTool(toolId, args, options), "call")
    };
    this.probes = {
      read: /* @__PURE__ */ __name((probeId, args = {}, options = {}) => this.readProbe(probeId, args, options), "read")
    };
    this.events = {
      waitFor: /* @__PURE__ */ __name((eventId, options = {}) => this.waitForEvent(eventId, options), "waitFor"),
      query: /* @__PURE__ */ __name((options = {}) => this.queryEvents(options), "query")
    };
    this.approvals = {
      approve: /* @__PURE__ */ __name((approvalId, options = {}) => this.resolveApproval(approvalId, true, options), "approve"),
      deny: /* @__PURE__ */ __name((approvalId, options = {}) => this.resolveApproval(approvalId, false, options), "deny")
    };
    if (broker) broker.registerAgent(this);
    this.mountConfiguredOverlay();
  }
  normalizeConfig(config = {}) {
    const normalized = { ...config ?? {} };
    if (!normalized.llm && (normalized.provider || normalized.model || normalized.endpoint)) {
      normalized.llm = {
        provider: normalized.provider,
        model: normalized.model,
        endpoint: normalized.endpoint
      };
      delete normalized.provider;
      delete normalized.model;
      delete normalized.endpoint;
    }
    return normalized;
  }
  createProvider() {
    var _a, _b;
    if (((_a = this.llm) == null ? void 0 : _a.provider) === "openai" || ((_b = this.llm) == null ? void 0 : _b.endpoint)) {
      return new OpenAIChatProvider({ llm: this.llm });
    }
    return null;
  }
  attachBroker(broker) {
    if (this.unsubscribeBroker) this.unsubscribeBroker();
    this.broker = broker;
    this.unsubscribeBroker = broker.subscribe(this.id, (message) => this.receive(message));
    this.mountConfiguredOverlay();
    return this;
  }
  mountConfiguredOverlay() {
    var _a, _b, _c;
    if (this.overlay || ((_b = (_a = this.config) == null ? void 0 : _a.ui) == null ? void 0 : _b.mode) !== "overlay") return this.overlay;
    if (typeof document === "undefined") return null;
    this.overlay = new AgentOverlay({
      agent: this,
      broker: this.broker,
      traceRecorder: (_c = this.broker) == null ? void 0 : _c.trace,
      config: this.config
    });
    this.overlay.mount();
    return this.overlay;
  }
  unmountOverlay() {
    var _a;
    (_a = this.overlay) == null ? void 0 : _a.unmount();
    this.overlay = null;
  }
  receive(message) {
    this.messages.push(message);
    if ((message == null ? void 0 : message.kind) === "event.observed") this.recordAppEvent(message);
    for (const listener of this.listeners) listener(message);
    return message;
  }
  publish(message) {
    this.messages.push(message);
    if ((message == null ? void 0 : message.kind) === "event.observed") this.recordAppEvent(message);
    for (const listener of this.listeners) listener(message);
    return message;
  }
  recordAppEvent(message) {
    this.recentEvents.push({
      eventId: message.eventId,
      callId: message.callId,
      payload: makeJsonSafe(message.payload),
      timestamp: message.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
    });
    this.recentEvents = this.recentEvents.slice(-20);
  }
  subscribe(listener) {
    if (typeof listener !== "function") throw new Error("Agent listener must be a function");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  nextRequestIdValue() {
    return `req_${String(this.nextRequestId++).padStart(6, "0")}`;
  }
  request(message) {
    if (!this.broker) throw new Error(`Agent ${this.id} is not attached to a broker`);
    return this.broker.handle({
      ...message,
      agentId: this.id,
      requestId: (message == null ? void 0 : message.requestId) ?? this.nextRequestIdValue()
    });
  }
  listCapabilities(options = {}) {
    return this.request({
      type: BrokerRequestTypes.CAPABILITIES_LIST,
      ...options
    });
  }
  callTool(toolId, args = {}, options = {}) {
    return this.request({
      type: BrokerRequestTypes.TOOL_CALL,
      toolId,
      args,
      ...options
    });
  }
  readProbe(probeId, args = {}, options = {}) {
    return this.request({
      type: BrokerRequestTypes.PROBE_READ,
      probeId,
      args,
      ...options
    });
  }
  waitForEvent(eventId, options = {}) {
    return this.request({
      type: BrokerRequestTypes.EVENT_WAIT,
      eventId,
      ...options
    });
  }
  queryEvents(options = {}) {
    return this.request({
      type: BrokerRequestTypes.EVENTS_QUERY,
      ...options
    });
  }
  resolveApproval(approvalId, approved, options = {}) {
    return this.request({
      type: BrokerRequestTypes.APPROVAL_RESOLVE,
      approvalId,
      approved,
      ...options
    });
  }
  submitUserMessage(text, options = {}) {
    const userText = String(text ?? "").trim();
    if (!userText) return Promise.resolve({ role: "assistant", content: "" });
    const turn = this.turnQueue.catch(() => null).then(() => this.runTurn(userText, options));
    this.turnQueue = turn;
    return turn;
  }
  async runTurn(text) {
    var _a, _b, _c, _d, _e, _f;
    this.trace({
      type: "chat.user",
      status: "received",
      details: { text }
    });
    if (!((_a = this.provider) == null ? void 0 : _a.complete)) {
      const content = "No LLM provider adapter is configured for this agent.";
      this.addTranscriptMessage({ role: "user", content: text });
      this.addTranscriptMessage({ role: "assistant", content });
      this.publish({ kind: "chat.assistant", agentId: this.id, content, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      return { role: "assistant", content };
    }
    this.addTranscriptMessage({ role: "user", content: text });
    const tools = this.buildOpenAICapabilityTools();
    const messages = this.buildProviderMessages();
    const maxToolRounds = ((_c = (_b = this.config) == null ? void 0 : _b.limits) == null ? void 0 : _c.maxToolCallsPerTurn) ?? DEFAULT_MAX_TOOL_ROUNDS;
    try {
      for (let round = 0; round <= maxToolRounds; round += 1) {
        this.trace({
          type: "llm.request",
          status: "sending",
          details: { provider: (_d = this.llm) == null ? void 0 : _d.provider, model: (_e = this.llm) == null ? void 0 : _e.model, toolCount: tools.length, round }
        });
        const payload = await this.provider.complete({ messages, tools });
        const choice = (_f = payload == null ? void 0 : payload.choices) == null ? void 0 : _f[0];
        const assistantMessage = (choice == null ? void 0 : choice.message) ?? {};
        const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
        this.trace({
          type: "llm.response",
          status: "received",
          details: { finishReason: choice == null ? void 0 : choice.finish_reason, toolCallCount: toolCalls.length }
        });
        messages.push({
          role: "assistant",
          content: assistantMessage.content ?? "",
          ...toolCalls.length ? { tool_calls: toolCalls } : {}
        });
        if (!toolCalls.length) {
          const content = assistantMessage.content || "No text response.";
          this.addTranscriptMessage({ role: "assistant", content });
          this.publish({ kind: "chat.assistant", agentId: this.id, content, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
          return { role: "assistant", content, raw: payload };
        }
        if (round === maxToolRounds) {
          const content = "The model requested more tool calls than this agent turn allows.";
          this.addTranscriptMessage({ role: "assistant", content });
          this.publish({ kind: "chat.assistant", agentId: this.id, content, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
          return { role: "assistant", content, raw: payload };
        }
        for (const toolCall of toolCalls) {
          const result = await this.executeOpenAIToolCall(toolCall);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      }
    } catch (error2) {
      const content = `LLM request failed: ${(error2 == null ? void 0 : error2.message) || String(error2)}`;
      this.trace({
        type: "llm.error",
        status: "failed",
        details: { message: (error2 == null ? void 0 : error2.message) || String(error2) }
      });
      this.addTranscriptMessage({ role: "assistant", content });
      this.publish({ kind: "chat.assistant", agentId: this.id, content, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      return { role: "assistant", content, error: error2 };
    }
  }
  buildProviderMessages() {
    return [
      { role: "system", content: this.buildSystemPrompt() },
      ...this.transcript.map((message) => ({ role: message.role, content: message.content }))
    ];
  }
  buildSystemPrompt() {
    var _a, _b, _c, _d, _e, _f;
    const capabilities = ((_b = (_a = this.broker) == null ? void 0 : _a.capabilityView) == null ? void 0 : _b.call(_a, this.id)) ?? ((_e = (_d = (_c = this.broker) == null ? void 0 : _c.registry) == null ? void 0 : _d.list) == null ? void 0 : _e.call(_d));
    const usage = capabilities == null ? void 0 : capabilities.usageGuidance;
    const guidance = Array.isArray(usage == null ? void 0 : usage.rules) ? usage.rules.join("\n") : "";
    return [
      ((_f = this.config) == null ? void 0 : _f.instructions) || "Help the user operate this vmblu application through the published tools.",
      "When an app action is needed, call a provided tool instead of inventing state changes.",
      this.formatRecentEventsForPrompt(),
      guidance
    ].filter(Boolean).join("\n\n");
  }
  formatRecentEventsForPrompt() {
    if (!this.recentEvents.length) return "";
    const lines = this.recentEvents.slice(-8).map((event) => {
      const payload = compactJson(event.payload, 700);
      return `- ${event.eventId}${event.callId ? ` (${event.callId})` : ""}: ${payload}`;
    });
    return `Recent app events:
${lines.join("\n")}`;
  }
  addTranscriptMessage(message) {
    this.transcript.push(message);
    this.transcript = this.transcript.slice(-30);
  }
  buildOpenAICapabilityTools() {
    var _a, _b, _c, _d, _e;
    const capabilities = ((_b = (_a = this.broker) == null ? void 0 : _a.capabilityView) == null ? void 0 : _b.call(_a, this.id)) ?? ((_e = (_d = (_c = this.broker) == null ? void 0 : _c.registry) == null ? void 0 : _d.list) == null ? void 0 : _e.call(_d)) ?? {};
    const projection = new OpenAIAgentAdapter({ capabilities, agent: this.config }).project();
    this.openAICapabilityMap = projection.map;
    return projection.tools;
  }
  async executeOpenAIToolCall(toolCall) {
    var _a, _b, _c, _d;
    const name = (_a = toolCall == null ? void 0 : toolCall.function) == null ? void 0 : _a.name;
    const mapped = (_b = this.openAICapabilityMap) == null ? void 0 : _b.get(name);
    const args = parseToolArguments((_c = toolCall == null ? void 0 : toolCall.function) == null ? void 0 : _c.arguments);
    this.trace({
      type: "llm.tool_call",
      status: "requested",
      toolId: (_d = mapped == null ? void 0 : mapped.capability) == null ? void 0 : _d.id,
      callId: toolCall == null ? void 0 : toolCall.id,
      details: { name, args }
    });
    if (!mapped) {
      return {
        ok: false,
        error: { code: "unknown_tool", message: `Unknown model tool call: ${name}` }
      };
    }
    if (mapped.kind === "probe") {
      const result2 = await this.readProbe(mapped.capability.id, args);
      return {
        ok: !(result2 == null ? void 0 : result2.error),
        probeId: mapped.capability.id,
        status: result2 == null ? void 0 : result2.status,
        result: result2
      };
    }
    const result = await this.callTool(mapped.capability.id, args);
    return {
      ok: !(result == null ? void 0 : result.error),
      toolId: mapped.capability.id,
      status: result == null ? void 0 : result.status,
      result
    };
  }
  trace(entry) {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.broker) == null ? void 0 : _a.trace) == null ? void 0 : _b.record) == null ? void 0 : _c.call(_b, {
      agentId: this.id,
      ...entry
    });
  }
};
__name(_AgentRuntime, "AgentRuntime");
var AgentRuntime = _AgentRuntime;
function parseToolArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
__name(parseToolArguments, "parseToolArguments");
function makeJsonSafe(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
__name(makeJsonSafe, "makeJsonSafe");
function compactJson(value, limit = 700) {
  let text = "";
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}
__name(compactJson, "compactJson");

// rt-agent/capability-registry.js
var _CapabilityRegistry = class _CapabilityRegistry {
  constructor(capabilities = null) {
    this.capabilities = this.normalizeCapabilities(capabilities);
    this.tools = /* @__PURE__ */ new Map();
    this.probes = /* @__PURE__ */ new Map();
    this.events = /* @__PURE__ */ new Map();
    this.index();
  }
  normalizeCapabilities(capabilities) {
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
  index() {
    for (const tool of this.capabilities.tools) {
      if (tool == null ? void 0 : tool.id) this.tools.set(tool.id, tool);
    }
    for (const probe of this.capabilities.probes) {
      if (probe == null ? void 0 : probe.id) this.probes.set(probe.id, probe);
    }
    for (const event of this.capabilities.events) {
      if (event == null ? void 0 : event.id) this.events.set(event.id, event);
    }
  }
  list() {
    return {
      ...this.capabilities,
      tools: [...this.tools.values()],
      probes: [...this.probes.values()],
      events: [...this.events.values()]
    };
  }
  getTool(id) {
    return this.tools.get(id) ?? null;
  }
  getProbe(id) {
    return this.probes.get(id) ?? null;
  }
  getEvent(id) {
    return this.events.get(id) ?? null;
  }
};
__name(_CapabilityRegistry, "CapabilityRegistry");
var CapabilityRegistry = _CapabilityRegistry;

// rt-agent/json-schema.js
function validateJsonSchema(schema, value, { path = "$" } = {}) {
  const errors = [];
  validate(schema, value, path, errors);
  return {
    valid: errors.length === 0,
    errors
  };
}
__name(validateJsonSchema, "validateJsonSchema");
function validate(schema, value, path, errors) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (schema.oneOf) {
    const matches2 = schema.oneOf.filter((candidate) => {
      const candidateErrors = [];
      validate(candidate, value, path, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (matches2.length !== 1) errors.push(error(path, "oneOf", `Expected exactly one matching schema, found ${matches2.length}`));
    return;
  }
  if (schema.anyOf) {
    const matches2 = schema.anyOf.some((candidate) => {
      const candidateErrors = [];
      validate(candidate, value, path, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!matches2) errors.push(error(path, "anyOf", "Expected at least one matching schema"));
    return;
  }
  if (schema.allOf) {
    for (const candidate of schema.allOf) validate(candidate, value, path, errors);
  }
  if (schema.const !== void 0 && value !== schema.const) {
    errors.push(error(path, "const", `Expected ${JSON.stringify(schema.const)}`));
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => item === value)) {
    errors.push(error(path, "enum", `Expected one of: ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`));
  }
  if (schema.type && !matchesType(schema.type, value)) {
    errors.push(error(path, "type", `Expected ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`));
    return;
  }
  if (isObject(value)) validateObject(schema, value, path, errors);
  if (Array.isArray(value)) validateArray(schema, value, path, errors);
  if (typeof value === "number") validateNumber(schema, value, path, errors);
  if (typeof value === "string") validateString(schema, value, path, errors);
}
__name(validate, "validate");
function validateObject(schema, value, path, errors) {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.push(error(`${path}.${key}`, "required", "Missing required property"));
  }
  for (const [key, item] of Object.entries(value)) {
    if (properties[key]) {
      validate(properties[key], item, `${path}.${key}`, errors);
      continue;
    }
    if (schema.additionalProperties === false) {
      errors.push(error(`${path}.${key}`, "additionalProperties", "Unexpected property"));
    } else if (isObject(schema.additionalProperties)) {
      validate(schema.additionalProperties, item, `${path}.${key}`, errors);
    }
  }
}
__name(validateObject, "validateObject");
function validateArray(schema, value, path, errors) {
  if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
    errors.push(error(path, "minItems", `Expected at least ${schema.minItems} items`));
  }
  if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
    errors.push(error(path, "maxItems", `Expected at most ${schema.maxItems} items`));
  }
  if (schema.items) {
    value.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`, errors));
  }
}
__name(validateArray, "validateArray");
function validateNumber(schema, value, path, errors) {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    errors.push(error(path, "minimum", `Expected >= ${schema.minimum}`));
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    errors.push(error(path, "maximum", `Expected <= ${schema.maximum}`));
  }
}
__name(validateNumber, "validateNumber");
function validateString(schema, value, path, errors) {
  if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
    errors.push(error(path, "minLength", `Expected length >= ${schema.minLength}`));
  }
  if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
    errors.push(error(path, "maxLength", `Expected length <= ${schema.maxLength}`));
  }
  if (schema.pattern) {
    try {
      if (!new RegExp(schema.pattern).test(value)) errors.push(error(path, "pattern", `Expected to match ${schema.pattern}`));
    } catch {
      errors.push(error(path, "pattern", `Invalid schema pattern ${schema.pattern}`));
    }
  }
}
__name(validateString, "validateString");
function matchesType(type, value) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => {
    if (item === "array") return Array.isArray(value);
    if (item === "integer") return Number.isInteger(value);
    if (item === "number") return typeof value === "number" && Number.isFinite(value);
    if (item === "object") return isObject(value);
    if (item === "null") return value === null;
    return typeof value === item;
  });
}
__name(matchesType, "matchesType");
function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
__name(isObject, "isObject");
function error(path, keyword, message) {
  return { path, keyword, message };
}
__name(error, "error");

// rt-agent/trace-recorder.js
var _TraceRecorder = class _TraceRecorder {
  constructor({ clock = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "clock") } = {}) {
    this.clock = clock;
    this.records = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.nextId = 1;
  }
  record(entry) {
    const record = {
      traceId: (entry == null ? void 0 : entry.traceId) ?? `trace_${String(this.nextId++).padStart(6, "0")}`,
      timestamp: (entry == null ? void 0 : entry.timestamp) ?? this.clock().toISOString(),
      type: (entry == null ? void 0 : entry.type) ?? "trace",
      ...entry
    };
    this.records.push(record);
    this.emit(record);
    return record;
  }
  all() {
    return this.records.slice();
  }
  clear() {
    this.records.length = 0;
  }
  subscribe(listener) {
    if (typeof listener !== "function") throw new Error("Trace listener must be a function");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(record) {
    for (const listener of this.listeners) listener(record);
  }
};
__name(_TraceRecorder, "TraceRecorder");
var TraceRecorder = _TraceRecorder;

// rt-agent/tool-broker.js
var _ToolBroker = class _ToolBroker {
  constructor({ runtime, capabilities, registry, traceRecorder } = {}) {
    this.runtime = null;
    this.registry = registry ?? new CapabilityRegistry(capabilities);
    this.trace = traceRecorder ?? new TraceRecorder();
    this.probeReaders = /* @__PURE__ */ new Map();
    this.events = [];
    this.agents = /* @__PURE__ */ new Map();
    this.approvalRequests = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Map();
    this.nextCallId = 1;
    this.nextApprovalId = 1;
    this.source = null;
    this.actor = null;
    if (runtime) this.attachRuntime(runtime);
  }
  attachRuntime(runtime) {
    if (!runtime) throw new Error("ToolBroker requires a runtime");
    this.runtime = runtime;
    this.actor = this.makeRuntimeActor();
    this.source = this.actor;
    return this;
  }
  makeRuntimeActor() {
    const broker = this;
    const actor = {
      name: "ToolBroker",
      uid: "__vmblu_tool_broker__",
      msg: null,
      txMap: /* @__PURE__ */ new Map(),
      rxSink: [
        {
          pin: "event",
          channel: false,
          handler(param) {
            return broker.recordRuntimeEvent(actor.msg, param);
          }
        }
      ],
      cell: null,
      makeCell() {
        this.cell = { event: this.rxSink[0].handler };
      },
      resolveUIDs() {
      }
    };
    actor.cell = { event: actor.rxSink[0].handler };
    return actor;
  }
  registerAgent(agent) {
    if (!(agent == null ? void 0 : agent.id)) throw new Error("Agent must have an id");
    agent.policy = AgentPolicy.fromAgent(agent);
    this.agents.set(agent.id, agent);
    if (typeof agent.attachBroker === "function") agent.attachBroker(this);
    this.trace.record({ type: "agent.registered", agentId: agent.id, status: "ok", details: { policy: agent.policy.traceDetails() } });
    return this;
  }
  unregisterAgent(agentOrId) {
    const agentId = typeof agentOrId === "string" ? agentOrId : agentOrId == null ? void 0 : agentOrId.id;
    if (!agentId) return false;
    const removed = this.agents.delete(agentId);
    if (removed) this.trace.record({ type: "agent.unregistered", agentId, status: "ok" });
    return removed;
  }
  subscribe(agentId, listener) {
    if (typeof listener !== "function") throw new Error("Broker listener must be a function");
    const key = agentId || "*";
    if (!this.listeners.has(key)) this.listeners.set(key, /* @__PURE__ */ new Set());
    this.listeners.get(key).add(listener);
    return () => {
      var _a;
      return (_a = this.listeners.get(key)) == null ? void 0 : _a.delete(listener);
    };
  }
  publish(message) {
    if (!message) return message;
    const targets = new Set(this.listeners.get("*") ?? []);
    if (message.agentId) {
      for (const listener of this.listeners.get(message.agentId) ?? []) targets.add(listener);
    } else {
      for (const [key, listeners] of this.listeners.entries()) {
        if (key === "*") continue;
        for (const listener of listeners) targets.add(listener);
      }
    }
    for (const listener of targets) listener(message);
    return message;
  }
  emitResult(request, result) {
    if (request == null ? void 0 : request.agentId) {
      this.publish({
        kind: "broker.result",
        agentId: request.agentId,
        requestId: request.requestId,
        callId: result == null ? void 0 : result.callId,
        result,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return result;
  }
  registerProbe(probeId, reader) {
    if (typeof reader !== "function") throw new Error("Probe reader must be a function");
    this.probeReaders.set(probeId, reader);
    return this;
  }
  recordEvent(eventId, payload, callId = void 0) {
    const event = {
      eventId,
      payload,
      callId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.events.push(event);
    this.trace.record({ type: "event.observed", eventId, callId, details: { payload } });
    this.publish({
      kind: "event.observed",
      eventId,
      callId,
      payload,
      timestamp: event.timestamp
    });
    return event;
  }
  recordRuntimeEvent(msg, payload) {
    var _a;
    const event = this.registry.list().events.find((candidate) => {
      var _a2, _b, _c;
      return ((_a2 = candidate == null ? void 0 : candidate.source) == null ? void 0 : _a2.node) === ((_b = msg == null ? void 0 : msg.source) == null ? void 0 : _b.name) && ((_c = candidate == null ? void 0 : candidate.source) == null ? void 0 : _c.pin) === (msg == null ? void 0 : msg.txPin);
    });
    if (!event) {
      this.trace.record({
        type: "event.ignored",
        status: "ignored",
        details: { node: (_a = msg == null ? void 0 : msg.source) == null ? void 0 : _a.name, pin: msg == null ? void 0 : msg.txPin, payload }
      });
      return null;
    }
    return this.recordEvent(event.id, payload, payload == null ? void 0 : payload.callId);
  }
  async handle(request) {
    switch (request == null ? void 0 : request.type) {
      case BrokerRequestTypes.CAPABILITIES_LIST:
        return this.emitResult(request, this.listCapabilities(request));
      case BrokerRequestTypes.TOOL_CALL:
        return this.callTool(request);
      case BrokerRequestTypes.PROBE_READ:
        return this.readProbe(request);
      case BrokerRequestTypes.EVENT_WAIT:
        return this.waitForEvent(request);
      case BrokerRequestTypes.EVENTS_QUERY:
        return this.emitResult(request, this.queryEvents(request));
      case BrokerRequestTypes.APPROVAL_RESOLVE:
        return this.resolveApproval(request);
      default:
        return this.emitResult(request, brokerError(request, "unknown_request", `Unknown broker request type: ${request == null ? void 0 : request.type}`));
    }
  }
  listCapabilities(request = {}) {
    const policy = this.getAgentPolicy(request.agentId);
    const capabilities = policy.filterCapabilities(this.registry.list());
    this.trace.record({
      type: "capabilities.list",
      agentId: request.agentId,
      requestId: request.requestId,
      status: "ok",
      details: {
        policy: policy.traceDetails(),
        counts: {
          tools: capabilities.tools.length,
          probes: capabilities.probes.length,
          events: capabilities.events.length
        }
      }
    });
    return {
      type: BrokerResultTypes.CAPABILITIES_RESULT,
      requestId: request.requestId,
      capabilities
    };
  }
  capabilityView(agentId) {
    return this.getAgentPolicy(agentId).filterCapabilities(this.registry.list());
  }
  async callTool(request) {
    var _a;
    const tool = this.registry.getTool(request == null ? void 0 : request.toolId);
    const callId = this.newCallId();
    this.trace.record({
      type: "tool.call",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: request == null ? void 0 : request.toolId,
      status: "requested",
      details: { args: request == null ? void 0 : request.args }
    });
    if (!tool) return this.toolError(request, callId, "unknown_tool", `Unknown tool: ${request == null ? void 0 : request.toolId}`);
    if (!this.runtime) return this.toolError(request, callId, "runtime_not_attached", "ToolBroker is not attached to a runtime", tool.id);
    const policy = this.checkToolPolicy(request, tool);
    this.trace.record({
      type: "policy.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: tool.id,
      status: policy.allowed ? "allowed" : "denied",
      details: policy
    });
    if (!policy.allowed) {
      return this.toolResult(request, callId, tool.id, ToolResultStatus.DENIED, {
        error: { code: "denied", message: policy.reason }
      });
    }
    const validation = this.validateArgs("tool", tool.id, (_a = tool.input) == null ? void 0 : _a.schema, request == null ? void 0 : request.args);
    this.trace.record({
      type: "validation.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: tool.id,
      status: validation.valid ? "ok" : "failed",
      details: validation
    });
    if (!validation.valid) {
      return this.toolResult(request, callId, tool.id, ToolResultStatus.FAILED, {
        error: { code: "invalid_args", message: validation.message, details: validation.errors }
      });
    }
    const approval = this.checkToolApproval(request, callId, tool);
    this.trace.record({
      type: "approval.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: tool.id,
      status: approval.required ? "required" : "not_required",
      details: approval
    });
    if (approval.required) {
      const approvalRequest = this.createApprovalRequest(request, callId, tool, approval);
      return this.toolResult(request, callId, tool.id, ToolResultStatus.PENDING, {
        approval: approvalRequest
      });
    }
    return this.executeTool(request, tool, callId);
  }
  async executeTool(request, tool, callId) {
    var _a;
    const target = this.resolveInputTarget(tool.input);
    if (!target) return this.toolError(request, callId, "target_not_found", `No runtime target for ${(_a = tool.input) == null ? void 0 : _a.ref}`);
    try {
      const wait = request.wait ?? "accepted";
      const timeout = request.timeoutMs ?? tool.timeoutMs ?? 0;
      const tx = this.makeRuntimeTx(tool.input.pin, target);
      const payload = this.makeRuntimePayload(tool, request, callId);
      this.trace.record({
        type: "message.dispatch",
        agentId: request == null ? void 0 : request.agentId,
        requestId: request == null ? void 0 : request.requestId,
        callId,
        toolId: tool.id,
        status: "dispatching",
        details: { target: tool.input }
      });
      if (wait === "none" || wait === "accepted" || wait !== "verified" && !target.channel) {
        this.runtime.sendTo(tx, this.source, payload);
        return this.toolResult(request, callId, tool.id, ToolResultStatus.ACCEPTED);
      }
      if (wait === "verified") {
        if (target.channel) await this.runtime.requestFrom(tx, this.source, payload, timeout);
        else this.runtime.sendTo(tx, this.source, payload);
        return this.verifyToolResult(request, tool, callId, timeout);
      }
      const reply = await this.runtime.requestFrom(tx, this.source, payload, timeout);
      return this.toolResult(request, callId, tool.id, ToolResultStatus.COMPLETED, { result: reply });
    } catch (error2) {
      return this.toolError(request, callId, "dispatch_failed", (error2 == null ? void 0 : error2.message) || String(error2), tool.id);
    }
  }
  async verifyToolResult(request, tool, callId, timeoutMs = 1e3) {
    const verifyWith = normalizeVerifyWith(tool);
    const evidence = {
      events: [],
      probes: []
    };
    if (!verifyWith.events.length && !verifyWith.probes.length) {
      return this.toolResult(request, callId, tool.id, ToolResultStatus.ACCEPTED, {
        verification: { status: "not_requested", evidence }
      });
    }
    for (const eventId of verifyWith.events) {
      const event = await this.waitForEventEvidence(eventId, callId, timeoutMs);
      evidence.events.push(event);
    }
    for (const probeSpec of verifyWith.probes) {
      const probeId = typeof probeSpec === "string" ? probeSpec : probeSpec == null ? void 0 : probeSpec.id;
      if (!probeId) continue;
      const result = await this.readProbe({
        agentId: request == null ? void 0 : request.agentId,
        requestId: request == null ? void 0 : request.requestId,
        probeId,
        args: typeof probeSpec === "object" ? probeSpec.args : void 0
      });
      evidence.probes.push({
        probeId,
        status: result == null ? void 0 : result.status,
        value: result == null ? void 0 : result.value,
        error: result == null ? void 0 : result.error
      });
    }
    const verified = evidence.events.every((item) => item.status === "observed") && evidence.probes.every((item) => item.status === "ok");
    this.trace.record({
      type: "verification.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: tool.id,
      status: verified ? "verified" : "unverified",
      details: evidence
    });
    return this.toolResult(request, callId, tool.id, verified ? ToolResultStatus.VERIFIED : ToolResultStatus.UNVERIFIED, {
      verification: {
        status: verified ? "verified" : "unverified",
        evidence
      }
    });
  }
  async waitForEventEvidence(eventId, callId, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      const found = this.findEvent({ eventId, callId });
      if (found) {
        return {
          eventId,
          status: "observed",
          callId: found.callId,
          payload: found.payload
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return { eventId, status: "timeout", callId };
  }
  async resolveApproval(request = {}) {
    const approval = this.approvalRequests.get(request.approvalId);
    if (!approval) {
      return this.emitResult(request, brokerError(request, "unknown_approval", `Unknown approval request: ${request.approvalId}`));
    }
    if (approval.status !== "requested") {
      return this.emitResult(request, brokerError(request, "approval_already_resolved", `Approval request is already ${approval.status}`));
    }
    approval.status = request.approved === true ? "approved" : "denied";
    approval.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    approval.resolvedBy = request.agentId ?? approval.agentId;
    this.trace.record({
      type: "approval.resolved",
      agentId: approval.agentId,
      requestId: request.requestId,
      callId: approval.callId,
      toolId: approval.toolId,
      status: approval.status,
      details: approval
    });
    this.publish({
      kind: "approval.resolved",
      agentId: approval.agentId,
      approval,
      timestamp: approval.resolvedAt
    });
    const tool = this.registry.getTool(approval.toolId);
    if (approval.status !== "approved") {
      return this.toolResult(request, approval.callId, approval.toolId, ToolResultStatus.DENIED, {
        approval,
        error: { code: "approval_denied", message: "Approval was denied" }
      });
    }
    if (!tool) return this.toolError(request, approval.callId, "unknown_tool", `Unknown tool: ${approval.toolId}`, approval.toolId);
    return this.executeTool(approval.request, tool, approval.callId);
  }
  async readProbe(request) {
    var _a, _b;
    const probe = this.registry.getProbe(request == null ? void 0 : request.probeId);
    if (!probe) {
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: request == null ? void 0 : request.probeId,
        status: "failed",
        error: { code: "unknown_probe", message: `Unknown probe: ${request == null ? void 0 : request.probeId}` }
      });
    }
    const policy = this.checkCapabilityPolicy(request, "probes", probe.id);
    this.trace.record({
      type: "policy.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      probeId: probe.id,
      status: policy.allowed ? "allowed" : "denied",
      details: policy
    });
    if (!policy.allowed) {
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "denied",
        error: { code: "denied", message: policy.reason }
      });
    }
    const validation = this.validateArgs("probe", probe.id, probe.argsSchema ?? ((_a = probe.arguments) == null ? void 0 : _a.schema) ?? ((_b = probe.input) == null ? void 0 : _b.schema), request == null ? void 0 : request.args);
    this.trace.record({
      type: "validation.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      probeId: probe.id,
      status: validation.valid ? "ok" : "failed",
      details: validation
    });
    if (!validation.valid) {
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "failed",
        error: { code: "invalid_args", message: validation.message, details: validation.errors }
      });
    }
    const reader = this.probeReaders.get(probe.id);
    if (!reader) {
      this.trace.record({
        type: "probe.read",
        agentId: request == null ? void 0 : request.agentId,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "failed",
        details: { reason: "no_reader" }
      });
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "failed",
        error: { code: "probe_not_registered", message: `No reader registered for probe: ${probe.id}` }
      });
    }
    try {
      const value = makeJsonSafe2(await reader(request.args, probe));
      const text = stringifyProbeValue(value);
      this.trace.record({
        type: "probe.read",
        agentId: request == null ? void 0 : request.agentId,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "ok",
        details: { value, text }
      });
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "ok",
        value,
        text
      });
    } catch (error2) {
      return this.emitResult(request, {
        type: BrokerResultTypes.PROBE_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        probeId: probe.id,
        status: "failed",
        error: { code: "probe_failed", message: (error2 == null ? void 0 : error2.message) || String(error2) }
      });
    }
  }
  async waitForEvent(request) {
    const event = this.registry.getEvent(request == null ? void 0 : request.eventId);
    if (!event) {
      return this.emitResult(request, {
        type: BrokerResultTypes.EVENT_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        eventId: request == null ? void 0 : request.eventId,
        status: "failed",
        error: { code: "unknown_event", message: `Unknown event: ${request == null ? void 0 : request.eventId}` }
      });
    }
    const policy = this.checkCapabilityPolicy(request, "events", event.id);
    this.trace.record({
      type: "policy.decision",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      eventId: event.id,
      status: policy.allowed ? "allowed" : "denied",
      details: policy
    });
    if (!policy.allowed) {
      return this.emitResult(request, {
        type: BrokerResultTypes.EVENT_RESULT,
        requestId: request == null ? void 0 : request.requestId,
        eventId: event.id,
        status: "denied",
        error: { code: "denied", message: policy.reason }
      });
    }
    const timeoutMs = (request == null ? void 0 : request.timeoutMs) ?? 1e3;
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      const found = this.findEvent(request);
      if (found) {
        return this.emitResult(request, {
          type: BrokerResultTypes.EVENT_RESULT,
          requestId: request.requestId,
          eventId: request.eventId,
          status: "observed",
          callId: found.callId,
          payload: found.payload
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return this.emitResult(request, {
      type: BrokerResultTypes.EVENT_RESULT,
      requestId: request == null ? void 0 : request.requestId,
      eventId: request == null ? void 0 : request.eventId,
      status: "timeout"
    });
  }
  queryEvents(request = {}) {
    const policy = this.getAgentPolicy(request.agentId);
    const events = this.events.filter((event) => {
      if (request.eventId && event.eventId !== request.eventId) return false;
      if (request.callId && event.callId !== request.callId) return false;
      if (!policy.canUse("events", event.eventId).allowed) return false;
      return true;
    });
    return {
      type: BrokerResultTypes.EVENTS_RESULT,
      requestId: request.requestId,
      events
    };
  }
  findEvent(request) {
    return this.events.find((event) => {
      if (event.eventId !== request.eventId) return false;
      if (request.callId && event.callId !== request.callId) return false;
      return true;
    }) ?? null;
  }
  checkToolPolicy(request, tool) {
    const permission = this.checkCapabilityPolicy(request, "tools", tool.id);
    if (!permission.allowed) return permission;
    return { allowed: true, risk: tool.risk ?? "low", approval: tool.approval ?? "never" };
  }
  checkToolApproval(request, callId, tool) {
    const policy = this.getAgentPolicy(request == null ? void 0 : request.agentId);
    return {
      ...policy.approvalDecision(tool),
      agentId: (request == null ? void 0 : request.agentId) ?? null,
      callId,
      toolId: tool.id
    };
  }
  createApprovalRequest(request, callId, tool, decision) {
    const approval = {
      approvalId: this.newApprovalId(),
      agentId: (request == null ? void 0 : request.agentId) ?? null,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId: tool.id,
      status: "requested",
      reason: decision.reason,
      rule: decision.rule,
      risk: tool.risk ?? "low",
      effects: Array.isArray(tool.effects) ? tool.effects : [],
      request: {
        agentId: request == null ? void 0 : request.agentId,
        requestId: request == null ? void 0 : request.requestId,
        toolId: tool.id,
        args: request == null ? void 0 : request.args,
        wait: request == null ? void 0 : request.wait,
        timeoutMs: request == null ? void 0 : request.timeoutMs
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.approvalRequests.set(approval.approvalId, approval);
    this.trace.record({
      type: "approval.requested",
      agentId: approval.agentId,
      requestId: approval.requestId,
      callId,
      toolId: tool.id,
      status: "requested",
      details: approval
    });
    this.publish({
      kind: "approval.requested",
      agentId: approval.agentId,
      approval,
      timestamp: approval.createdAt
    });
    return approval;
  }
  checkCapabilityPolicy(request, kind, id) {
    const policy = this.getAgentPolicy(request == null ? void 0 : request.agentId);
    return {
      ...policy.canUse(kind, id),
      agentId: (request == null ? void 0 : request.agentId) ?? null,
      kind,
      capabilityId: id
    };
  }
  getAgentPolicy(agentId) {
    if (!agentId) return new AgentPolicy({ id: null });
    const agent = this.agents.get(agentId);
    if (!agent) return new AgentPolicy({ id: agentId });
    agent.policy = AgentPolicy.fromAgent(agent);
    return agent.policy;
  }
  validateArgs(kind, capabilityId, schema, args) {
    if (!schema) return { valid: true, kind, capabilityId, reason: "no_schema" };
    const value = args ?? {};
    const validation = validateJsonSchema(schema, value);
    return {
      kind,
      capabilityId,
      schemaPresent: true,
      valid: validation.valid,
      errors: validation.errors,
      message: validation.valid ? "Arguments are valid" : `Invalid ${kind} arguments for ${capabilityId}`
    };
  }
  resolveInputTarget(input) {
    const actor = this.runtime.actors.find((candidate) => candidate.name === (input == null ? void 0 : input.node));
    if (!actor) return null;
    const hix = actor.rxSink.findIndex((rx2) => rx2.pin === (input == null ? void 0 : input.pin));
    if (hix < 0) return null;
    const rx = actor.rxSink[hix];
    return {
      actor,
      hix: HIX_HANDLER | hix,
      pin: rx.pin,
      channel: rx.channel
    };
  }
  makeRuntimeTx(pin, target) {
    return {
      pin,
      channel: target.channel,
      targets: [target]
    };
  }
  makeRuntimePayload(tool, request, callId) {
    var _a;
    if (((_a = tool == null ? void 0 : tool.input) == null ? void 0 : _a.payload) === "ToolInvocation") {
      return {
        callId,
        tool: tool.id,
        arguments: (request == null ? void 0 : request.args) ?? {}
      };
    }
    return request == null ? void 0 : request.args;
  }
  toolResult(request, callId, toolId, status, extra = {}) {
    const result = {
      type: BrokerResultTypes.TOOL_RESULT,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId,
      status,
      ...extra
    };
    this.trace.record({
      type: "tool.result",
      agentId: request == null ? void 0 : request.agentId,
      requestId: request == null ? void 0 : request.requestId,
      callId,
      toolId,
      status,
      details: extra
    });
    return this.emitResult(request, result);
  }
  toolError(request, callId, code, message, toolId = request == null ? void 0 : request.toolId) {
    return this.toolResult(request, callId, toolId, ToolResultStatus.FAILED, {
      error: { code, message }
    });
  }
  newCallId() {
    return `call_${String(this.nextCallId++).padStart(6, "0")}`;
  }
  newApprovalId() {
    return `approval_${String(this.nextApprovalId++).padStart(6, "0")}`;
  }
};
__name(_ToolBroker, "ToolBroker");
var ToolBroker = _ToolBroker;
function makeJsonSafe2(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new Error("Probe returned a value that cannot be serialized as JSON");
  }
}
__name(makeJsonSafe2, "makeJsonSafe");
function stringifyProbeValue(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
__name(stringifyProbeValue, "stringifyProbeValue");
function normalizeVerifyWith(tool = {}) {
  const specs = [];
  if (tool.verifyWith) specs.push(tool.verifyWith);
  for (const effect of tool.effects ?? []) {
    if (effect == null ? void 0 : effect.verifyWith) specs.push(effect.verifyWith);
  }
  const events = [];
  const probes = [];
  for (const spec of specs) {
    if (Array.isArray(spec == null ? void 0 : spec.events)) events.push(...spec.events);
    if (Array.isArray(spec == null ? void 0 : spec.probes)) probes.push(...spec.probes);
  }
  return {
    events: events.map((item) => typeof item === "string" ? item : item == null ? void 0 : item.id).filter(Boolean),
    probes
  };
}
__name(normalizeVerifyWith, "normalizeVerifyWith");

// rt-agent/agent-runtime-support.js
var _AgentRuntimeSupport = class _AgentRuntimeSupport {
  constructor(runtime) {
    this.runtime = runtime;
  }
  configure({ capabilities = null, traceRecorder = null, agent = null } = {}) {
    const runtime = this.runtime;
    runtime.traceRecorder = traceRecorder ?? runtime.traceRecorder ?? new TraceRecorder();
    runtime.toolBroker = new ToolBroker({ capabilities, traceRecorder: runtime.traceRecorder });
    runtime.toolBroker.attachRuntime(runtime);
    this.attachToolBrokerActor();
    this.wireToolBrokerEvents();
    this.registerNodeProbes();
    runtime.agent = null;
    const selectedAgent = selectAgentConfig(agent);
    if (selectedAgent && selectedAgent.enabled !== false) {
      runtime.agent = new AgentRuntime({
        id: selectedAgent == null ? void 0 : selectedAgent.id,
        broker: runtime.toolBroker,
        config: selectedAgent ?? {}
      });
    }
    return runtime;
  }
  stop() {
    var _a, _b;
    (_b = (_a = this.runtime.agent) == null ? void 0 : _a.unmountOverlay) == null ? void 0 : _b.call(_a);
  }
  registerNodeProbes() {
    var _a;
    const runtime = this.runtime;
    if (!((_a = runtime.toolBroker) == null ? void 0 : _a.registry)) return 0;
    let count = 0;
    for (const probe of runtime.toolBroker.registry.list().probes) {
      const binding = (probe == null ? void 0 : probe.binding) ?? {};
      const nodeName = binding.node;
      if (!nodeName) continue;
      const actor = runtime.actors.find((candidate) => candidate.name === nodeName);
      if (!actor) continue;
      runtime.toolBroker.registerProbe(probe.id, async (args, currentProbe) => {
        var _a2;
        const probeFn = (_a2 = actor.cell) == null ? void 0 : _a2.probe;
        if (typeof probeFn !== "function") {
          throw new Error(`Node ${nodeName} does not implement probe(name, args)`);
        }
        const probeName = (currentProbe == null ? void 0 : currentProbe.name) || (currentProbe == null ? void 0 : currentProbe.id);
        return probeFn.call(actor.cell, probeName, args ?? {});
      });
      count++;
    }
    return count;
  }
  attachToolBrokerActor() {
    var _a;
    const runtime = this.runtime;
    if (!((_a = runtime.toolBroker) == null ? void 0 : _a.actor)) return null;
    if (!runtime.actors.includes(runtime.toolBroker.actor)) runtime.actors.push(runtime.toolBroker.actor);
    return runtime.toolBroker.actor;
  }
  wireToolBrokerEvents() {
    var _a, _b;
    const runtime = this.runtime;
    const brokerActor = (_a = runtime.toolBroker) == null ? void 0 : _a.actor;
    if (!brokerActor) return 0;
    let count = 0;
    for (const event of runtime.toolBroker.registry.list().events) {
      const source = event == null ? void 0 : event.source;
      if (!(source == null ? void 0 : source.node) || !(source == null ? void 0 : source.pin)) continue;
      const actor = runtime.actors.find((candidate) => candidate !== brokerActor && candidate.name === source.node);
      const tx = (_b = actor == null ? void 0 : actor.findTx) == null ? void 0 : _b.call(actor, source.pin);
      if (!tx) continue;
      const alreadyWired = tx.targets.some((target) => target.actor === brokerActor && target.pin === "event");
      if (alreadyWired) continue;
      tx.targets.push({
        actor: brokerActor,
        hix: HIX_HANDLER | 0,
        pin: "event",
        channel: false
      });
      count++;
    }
    return count;
  }
};
__name(_AgentRuntimeSupport, "AgentRuntimeSupport");
var AgentRuntimeSupport = _AgentRuntimeSupport;
function selectAgentConfig(agent) {
  if (!agent) return null;
  if (Array.isArray(agent == null ? void 0 : agent.agents)) {
    return agent.agents.find((candidate) => (candidate == null ? void 0 : candidate.id) === agent.defaultAgent) ?? agent.agents.find((candidate) => (candidate == null ? void 0 : candidate.enabled) !== false) ?? agent.agents[0] ?? null;
  }
  return agent;
}
__name(selectAgentConfig, "selectAgentConfig");

// rt-browser-agent/runtime.js
var _Runtime3 = class _Runtime3 extends Runtime2 {
  get settings() {
    return runtimeSettings;
  }
  get agentSupport() {
    return this._agentSupport ??= new AgentRuntimeSupport(this);
  }
  configure(options = {}) {
    super.configure(options);
    this.configureAgentRuntime(options);
  }
  configureAgentRuntime(options = {}) {
    return this.agentSupport.configure(options);
  }
  stop() {
    this.agentSupport.stop();
    return super.stop();
  }
  registerNodeProbes() {
    return this.agentSupport.registerNodeProbes();
  }
  attachToolBrokerActor() {
    return this.agentSupport.attachToolBrokerActor();
  }
  wireToolBrokerEvents() {
    return this.agentSupport.wireToolBrokerEvents();
  }
};
__name(_Runtime3, "Runtime");
var Runtime3 = _Runtime3;

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

// rt-browser-agent/index.js
var VERSION = "0.1.1-browser-agent";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentAdapterRegistry,
  AgentOverlay,
  AgentPolicy,
  AgentRuntime,
  BrokerRequestTypes,
  BrokerResultTypes,
  CapabilityRegistry,
  HttpAgentAdapter,
  OpenAIAgentAdapter,
  OpenAIChatProvider,
  Runtime,
  ToolBroker,
  ToolResultStatus,
  TraceRecorder,
  VERSION,
  VmbluAgentAdapter,
  agentAdapterRegistry,
  brokerError,
  validateJsonSchema
});
//# sourceMappingURL=index.cjs.map