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

// rt-base/index.js
var index_exports = {};
__export(index_exports, {
  Runtime: () => Runtime2,
  VERSION: () => VERSION
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

// rt-base/runtime.js
var _Runtime2 = class _Runtime2 extends Runtime {
};
__name(_Runtime2, "Runtime");
var Runtime2 = _Runtime2;
Runtime2.prototype.settings = runtimeSettings;

// rt-base/index.js
var VERSION = "0.1.1";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Runtime,
  VERSION
});
//# sourceMappingURL=index.cjs.map