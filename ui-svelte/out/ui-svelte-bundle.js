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

// rt-base/runtime-settings.js
var defaultWorker$2 = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
var defaultRun$2 = /* @__PURE__ */ __name(() => ({
  worker: defaultWorker$2()
}), "defaultRun");
var defaultMonitor$2 = /* @__PURE__ */ __name(() => ({
  logMessages: false,
  logTimings: false
}), "defaultMonitor");
var defaultSecurity$1 = /* @__PURE__ */ __name(() => ({
  enabled: false
}), "defaultSecurity");
function make$2() {
  return {
    run: defaultRun$2(),
    monitor: defaultMonitor$2(),
    security: defaultSecurity$1()
  };
}
__name(make$2, "make");
function normalize$3(dx = null) {
  var _a, _b;
  const defaults = make$2();
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
__name(normalize$3, "normalize");
function clone$2(dx = null) {
  return normalize$3(dx);
}
__name(clone$2, "clone");
function reset$2(target) {
  const defaults = make$2();
  assign$4(target, defaults);
  return target;
}
__name(reset$2, "reset");
function assign$4(target, dx = null) {
  const normalized = normalize$3(dx);
  target.run = structuredClone(normalized.run);
  target.monitor = structuredClone(normalized.monitor);
  target.security = structuredClone(normalized.security);
  delete target.logMessages;
  delete target.worker;
  return target;
}
__name(assign$4, "assign");
function isDefault$2(dx = null) {
  const normalized = normalize$3(dx);
  return JSON.stringify(normalized) === JSON.stringify(make$2());
}
__name(isDefault$2, "isDefault");
function makeModel$2() {
  return {
    run: {},
    monitor: {},
    security: {
      fs: {
        read: { mode: "deny", roots: [] },
        write: { mode: "deny", roots: [] },
        delete: { mode: "deny", roots: [] }
      },
      net: {
        egress: { mode: "deny", hosts: [] }
      },
      process: {
        exec: { mode: "deny", commands: [] }
      }
    }
  };
}
__name(makeModel$2, "makeModel");
function normalizeModel$2(settings = null) {
  var _a, _b, _c, _d, _e;
  const defaults = makeModel$2();
  if (!settings || typeof settings !== "object") return defaults;
  const security = settings.security ?? {};
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
      fs: {
        read: { ...defaults.security.fs.read, ...((_a = security.fs) == null ? void 0 : _a.read) ?? {} },
        write: { ...defaults.security.fs.write, ...((_b = security.fs) == null ? void 0 : _b.write) ?? {} },
        delete: { ...defaults.security.fs.delete, ...((_c = security.fs) == null ? void 0 : _c.delete) ?? {} }
      },
      net: {
        egress: { ...defaults.security.net.egress, ...((_d = security.net) == null ? void 0 : _d.egress) ?? {} }
      },
      process: {
        exec: { ...defaults.security.process.exec, ...((_e = security.process) == null ? void 0 : _e.exec) ?? {} }
      }
    }
  };
}
__name(normalizeModel$2, "normalizeModel");
function effectivePolicy$2(modelSettings = null, nodeDx = null) {
  return {
    model: normalizeModel$2(modelSettings),
    node: normalize$3(nodeDx)
  };
}
__name(effectivePolicy$2, "effectivePolicy");
var runtimeSettings$2 = {
  make: make$2,
  normalize: normalize$3,
  clone: clone$2,
  reset: reset$2,
  assign: assign$4,
  isDefault: isDefault$2,
  makeModel: makeModel$2,
  normalizeModel: normalizeModel$2,
  effectivePolicy: effectivePolicy$2
};

// rt-base/runtime.js
var _Runtime2 = class _Runtime2 extends Runtime {
};
__name(_Runtime2, "Runtime");
var Runtime2 = _Runtime2;
Runtime2.prototype.settings = runtimeSettings$2;

const node_env = globalThis.process?.env?.NODE_ENV;
var DEV = node_env && !node_env.toLowerCase().startsWith('prod');

// Store the references to globals in case someone tries to monkey patch these, causing the below
// to de-opt (this occurs often when using popular extensions).
var is_array = Array.isArray;
var array_from = Array.from;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var get_descriptors = Object.getOwnPropertyDescriptors;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;

const noop = () => {};

/** @param {Function} fn */
function run(fn) {
	return fn();
}

/** @param {Array<() => void>} arr */
function run_all(arr) {
	for (var i = 0; i < arr.length; i++) {
		arr[i]();
	}
}

/**
 * @template V
 * @param {V} value
 * @param {V | (() => V)} fallback
 * @param {boolean} [lazy]
 * @returns {V}
 */
function fallback(value, fallback, lazy = false) {
	return value === undefined
		? lazy
			? /** @type {() => V} */ (fallback)()
			: /** @type {V} */ (fallback)
		: value;
}

const DERIVED = 1 << 1;
const EFFECT = 1 << 2;
const RENDER_EFFECT = 1 << 3;
const BLOCK_EFFECT = 1 << 4;
const BRANCH_EFFECT = 1 << 5;
const ROOT_EFFECT = 1 << 6;
const UNOWNED = 1 << 7;
const DISCONNECTED = 1 << 8;
const CLEAN = 1 << 9;
const DIRTY = 1 << 10;
const MAYBE_DIRTY = 1 << 11;
const INERT = 1 << 12;
const DESTROYED = 1 << 13;
const EFFECT_RAN = 1 << 14;
/** 'Transparent' effects do not create a transition boundary */
const EFFECT_TRANSPARENT = 1 << 15;
/** Svelte 4 legacy mode props need to be handled with deriveds and be recognized elsewhere, hence the dedicated flag */
const LEGACY_DERIVED_PROP = 1 << 16;
const INSPECT_EFFECT = 1 << 17;
const HEAD_EFFECT = 1 << 18;
const EFFECT_HAS_DERIVED = 1 << 19;

const STATE_SYMBOL = Symbol('$state');
const STATE_SYMBOL_METADATA = Symbol('$state metadata');
const LOADING_ATTR_SYMBOL = Symbol('');

/** @import { Equals } from '#client' */
/** @type {Equals} */
function equals(value) {
	return value === this.v;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function safe_not_equal(a, b) {
	return a != a
		? b == b
		: a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
}

/** @type {Equals} */
function safe_equals(value) {
	return !safe_not_equal(value, this.v);
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * Using `bind:value` together with a checkbox input is not allowed. Use `bind:checked` instead
 * @returns {never}
 */
function bind_invalid_checkbox_value() {
	if (DEV) {
		const error = new Error(`bind_invalid_checkbox_value\nUsing \`bind:value\` together with a checkbox input is not allowed. Use \`bind:checked\` instead`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("bind_invalid_checkbox_value");
	}
}

/**
 * A derived value cannot reference itself recursively
 * @returns {never}
 */
function derived_references_self() {
	if (DEV) {
		const error = new Error(`derived_references_self\nA derived value cannot reference itself recursively`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("derived_references_self");
	}
}

/**
 * `%rune%` cannot be used inside an effect cleanup function
 * @param {string} rune
 * @returns {never}
 */
function effect_in_teardown(rune) {
	if (DEV) {
		const error = new Error(`effect_in_teardown\n\`${rune}\` cannot be used inside an effect cleanup function`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("effect_in_teardown");
	}
}

/**
 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
 * @returns {never}
 */
function effect_in_unowned_derived() {
	if (DEV) {
		const error = new Error(`effect_in_unowned_derived\nEffect cannot be created inside a \`$derived\` value that was not itself created inside an effect`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("effect_in_unowned_derived");
	}
}

/**
 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
 * @param {string} rune
 * @returns {never}
 */
function effect_orphan(rune) {
	if (DEV) {
		const error = new Error(`effect_orphan\n\`${rune}\` can only be used inside an effect (e.g. during component initialisation)`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("effect_orphan");
	}
}

/**
 * Maximum update depth exceeded. This can happen when a reactive block or effect repeatedly sets a new value. Svelte limits the number of nested updates to prevent infinite loops
 * @returns {never}
 */
function effect_update_depth_exceeded() {
	if (DEV) {
		const error = new Error(`effect_update_depth_exceeded\nMaximum update depth exceeded. This can happen when a reactive block or effect repeatedly sets a new value. Svelte limits the number of nested updates to prevent infinite loops`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("effect_update_depth_exceeded");
	}
}

/**
 * Cannot do `bind:%key%={undefined}` when `%key%` has a fallback value
 * @param {string} key
 * @returns {never}
 */
function props_invalid_value(key) {
	if (DEV) {
		const error = new Error(`props_invalid_value\nCannot do \`bind:${key}={undefined}\` when \`${key}\` has a fallback value`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("props_invalid_value");
	}
}

/**
 * The `%rune%` rune is only available inside `.svelte` and `.svelte.js/ts` files
 * @param {string} rune
 * @returns {never}
 */
function rune_outside_svelte(rune) {
	if (DEV) {
		const error = new Error(`rune_outside_svelte\nThe \`${rune}\` rune is only available inside \`.svelte\` and \`.svelte.js/ts\` files`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("rune_outside_svelte");
	}
}

/**
 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
 * @returns {never}
 */
function state_descriptors_fixed() {
	if (DEV) {
		const error = new Error(`state_descriptors_fixed\nProperty descriptors defined on \`$state\` objects must contain \`value\` and always be \`enumerable\`, \`configurable\` and \`writable\`.`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("state_descriptors_fixed");
	}
}

/**
 * Cannot set prototype of `$state` object
 * @returns {never}
 */
function state_prototype_fixed() {
	if (DEV) {
		const error = new Error(`state_prototype_fixed\nCannot set prototype of \`$state\` object`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("state_prototype_fixed");
	}
}

/**
 * Reading state that was created inside the same derived is forbidden. Consider using `untrack` to read locally created state
 * @returns {never}
 */
function state_unsafe_local_read() {
	if (DEV) {
		const error = new Error(`state_unsafe_local_read\nReading state that was created inside the same derived is forbidden. Consider using \`untrack\` to read locally created state`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("state_unsafe_local_read");
	}
}

/**
 * Updating state inside a derived or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
 * @returns {never}
 */
function state_unsafe_mutation() {
	if (DEV) {
		const error = new Error(`state_unsafe_mutation\nUpdating state inside a derived or a template expression is forbidden. If the value should not be reactive, declare it without \`$state\``);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("state_unsafe_mutation");
	}
}

/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

let inspect_effects = new Set();

/**
 * @param {Set<any>} v
 */
function set_inspect_effects(v) {
	inspect_effects = v;
}

/**
 * @template V
 * @param {V} v
 * @returns {Source<V>}
 */
function source(v) {
	return {
		f: 0, // TODO ideally we could skip this altogether, but it causes type errors
		v,
		reactions: null,
		equals,
		version: 0
	};
}

/**
 * @template V
 * @param {V} initial_value
 * @param {boolean} [immutable]
 * @returns {Source<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function mutable_source(initial_value, immutable = false) {
	const s = source(initial_value);
	if (!immutable) {
		s.equals = safe_equals;
	}

	// bind the signal to the component context, in case we need to
	// track updates to trigger beforeUpdate/afterUpdate callbacks
	if (component_context !== null && component_context.l !== null) {
		(component_context.l.s ??= []).push(s);
	}

	return s;
}

/**
 * @template V
 * @param {V} v
 * @param {boolean} [immutable]
 * @returns {Source<V>}
 */
function mutable_state(v, immutable = false) {
	return push_derived_source(mutable_source(v, immutable));
}

/**
 * @template V
 * @param {Source<V>} source
 */
/*#__NO_SIDE_EFFECTS__*/
function push_derived_source(source) {
	if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0) {
		if (derived_sources === null) {
			set_derived_sources([source]);
		} else {
			derived_sources.push(source);
		}
	}

	return source;
}

/**
 * @template V
 * @param {Value<V>} source
 * @param {V} value
 */
function mutate(source, value) {
	set(
		source,
		untrack(() => get(source))
	);
	return value;
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @returns {V}
 */
function set(source, value) {
	if (
		active_reaction !== null &&
		is_runes() &&
		(active_reaction.f & (DERIVED | BLOCK_EFFECT)) !== 0 &&
		// If the source was created locally within the current derived, then
		// we allow the mutation.
		(derived_sources === null || !derived_sources.includes(source))
	) {
		state_unsafe_mutation();
	}

	return internal_set(source, value);
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @returns {V}
 */
function internal_set(source, value) {
	if (!source.equals(value)) {
		source.v = value;
		source.version = increment_version();

		mark_reactions(source, DIRTY);

		// If the current signal is running for the first time, it won't have any
		// reactions as we only allocate and assign the reactions after the signal
		// has fully executed. So in the case of ensuring it registers the reaction
		// properly for itself, we need to ensure the current effect actually gets
		// scheduled. i.e: `$effect(() => x++)`
		if (
			is_runes() &&
			active_effect !== null &&
			(active_effect.f & CLEAN) !== 0 &&
			(active_effect.f & BRANCH_EFFECT) === 0
		) {
			if (new_deps !== null && new_deps.includes(source)) {
				set_signal_status(active_effect, DIRTY);
				schedule_effect(active_effect);
			} else {
				if (untracked_writes === null) {
					set_untracked_writes([source]);
				} else {
					untracked_writes.push(source);
				}
			}
		}

		if (DEV && inspect_effects.size > 0) {
			const inspects = Array.from(inspect_effects);
			var previously_flushing_effect = is_flushing_effect;
			set_is_flushing_effect(true);
			try {
				for (const effect of inspects) {
					// Mark clean inspect-effects as maybe dirty and then check their dirtiness
					// instead of just updating the effects - this way we avoid overfiring.
					if ((effect.f & CLEAN) !== 0) {
						set_signal_status(effect, MAYBE_DIRTY);
					}
					if (check_dirtiness(effect)) {
						update_effect(effect);
					}
				}
			} finally {
				set_is_flushing_effect(previously_flushing_effect);
			}
			inspect_effects.clear();
		}
	}

	return value;
}

/**
 * @param {Value} signal
 * @param {number} status should be DIRTY or MAYBE_DIRTY
 * @returns {void}
 */
function mark_reactions(signal, status) {
	var reactions = signal.reactions;
	if (reactions === null) return;

	var runes = is_runes();
	var length = reactions.length;

	for (var i = 0; i < length; i++) {
		var reaction = reactions[i];
		var flags = reaction.f;

		// Skip any effects that are already dirty
		if ((flags & DIRTY) !== 0) continue;

		// In legacy mode, skip the current effect to prevent infinite loops
		if (!runes && reaction === active_effect) continue;

		// Inspect effects need to run immediately, so that the stack trace makes sense
		if (DEV && (flags & INSPECT_EFFECT) !== 0) {
			inspect_effects.add(reaction);
			continue;
		}

		set_signal_status(reaction, status);

		// If the signal a) was previously clean or b) is an unowned derived, then mark it
		if ((flags & (CLEAN | UNOWNED)) !== 0) {
			if ((flags & DERIVED) !== 0) {
				mark_reactions(/** @type {Derived} */ (reaction), MAYBE_DIRTY);
			} else {
				schedule_effect(/** @type {Effect} */ (reaction));
			}
		}
	}
}

const EACH_ITEM_REACTIVE = 1;
const EACH_INDEX_REACTIVE = 1 << 1;
/** See EachBlock interface metadata.is_controlled for an explanation what this is */
const EACH_IS_CONTROLLED = 1 << 2;
const EACH_IS_ANIMATED = 1 << 3;
const EACH_ITEM_IMMUTABLE = 1 << 4;

const PROPS_IS_IMMUTABLE = 1;
const PROPS_IS_RUNES = 1 << 1;
const PROPS_IS_UPDATED = 1 << 2;
const PROPS_IS_BINDABLE = 1 << 3;
const PROPS_IS_LAZY_INITIAL = 1 << 4;

const TEMPLATE_FRAGMENT = 1;
const TEMPLATE_USE_IMPORT_NODE = 1 << 1;

const UNINITIALIZED = Symbol();

// Dev-time component properties
const FILENAME = Symbol('filename');

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


var bold = 'font-weight: bold';
var normal = 'font-weight: normal';

/**
 * %component% mutated a value owned by %owner%. This is strongly discouraged. Consider passing values to child components with `bind:`, or use a callback instead
 * @param {string | undefined | null} [component]
 * @param {string | undefined | null} [owner]
 */
function ownership_invalid_mutation(component, owner) {
	if (DEV) {
		console.warn(`%c[svelte] ownership_invalid_mutation\n%c${component ? `${component} mutated a value owned by ${owner}. This is strongly discouraged. Consider passing values to child components with \`bind:\`, or use a callback instead` : "Mutating a value outside the component that created it is strongly discouraged. Consider passing values to child components with `bind:`, or use a callback instead"}`, bold, normal);
	} else {
		// TODO print a link to the documentation
		console.warn("ownership_invalid_mutation");
	}
}

/**
 * Reactive `$state(...)` proxies and the values they proxy have different identities. Because of this, comparisons with `%operator%` will produce unexpected results
 * @param {string} operator
 */
function state_proxy_equality_mismatch(operator) {
	if (DEV) {
		console.warn(`%c[svelte] state_proxy_equality_mismatch\n%cReactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`${operator}\` will produce unexpected results`, bold, normal);
	} else {
		// TODO print a link to the documentation
		console.warn("state_proxy_equality_mismatch");
	}
}

/** @import { TemplateNode } from '#client' */


/**
 * Use this variable to guard everything related to hydration code so it can be treeshaken out
 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
 */
let hydrating = false;

/** @import { ProxyMetadata } from '#client' */
/** @typedef {{ file: string, line: number, column: number }} Location */


/** @type {Record<string, Array<{ start: Location, end: Location, component: Function }>>} */
const boundaries = {};

const chrome_pattern = /at (?:.+ \()?(.+):(\d+):(\d+)\)?$/;
const firefox_pattern = /@(.+):(\d+):(\d+)$/;

function get_stack() {
	const stack = new Error().stack;
	if (!stack) return null;

	const entries = [];

	for (const line of stack.split('\n')) {
		let match = chrome_pattern.exec(line) ?? firefox_pattern.exec(line);

		if (match) {
			entries.push({
				file: match[1],
				line: +match[2],
				column: +match[3]
			});
		}
	}

	return entries;
}

/**
 * Determines which `.svelte` component is responsible for a given state change
 * @returns {Function | null}
 */
function get_component() {
	// first 4 lines are svelte internals; adjust this number if we change the internal call stack
	const stack = get_stack()?.slice(4);
	if (!stack) return null;

	for (let i = 0; i < stack.length; i++) {
		const entry = stack[i];
		const modules = boundaries[entry.file];
		if (!modules) {
			// If the first entry is not a component, that means the modification very likely happened
			// within a .svelte.js file, possibly triggered by a component. Since these files are not part
			// of the bondaries/component context heuristic, we need to bail in this case, else we would
			// have false positives when the .svelte.ts file provides a state creator function, encapsulating
			// the state and its mutations, and is being called from a component other than the one who
			// called the state creator function.
			if (i === 0) return null;
			continue;
		}

		for (const module of modules) {
			if (module.start.line < entry.line && module.end.line > entry.line) {
				return module.component;
			}
		}
	}

	return null;
}

/**
 * @param {ProxyMetadata | null} from
 * @param {ProxyMetadata} to
 */
function widen_ownership(from, to) {
	if (to.owners === null) {
		return;
	}

	while (from) {
		if (from.owners === null) {
			to.owners = null;
			break;
		}

		for (const owner of from.owners) {
			to.owners.add(owner);
		}

		from = from.parent;
	}
}

/**
 * @param {ProxyMetadata} metadata
 * @param {Function} component
 * @returns {boolean}
 */
function has_owner(metadata, component) {
	if (metadata.owners === null) {
		return true;
	}

	return (
		metadata.owners.has(component) ||
		(metadata.parent !== null && has_owner(metadata.parent, component))
	);
}

/**
 * @param {ProxyMetadata} metadata
 * @returns {any}
 */
function get_owner(metadata) {
	return (
		metadata?.owners?.values().next().value ??
		get_owner(/** @type {ProxyMetadata} */ (metadata.parent))
	);
}

/**
 * @param {ProxyMetadata} metadata
 */
function check_ownership(metadata) {

	const component = get_component();

	if (component && !has_owner(metadata, component)) {
		let original = get_owner(metadata);

		// @ts-expect-error
		if (original[FILENAME] !== component[FILENAME]) {
			// @ts-expect-error
			ownership_invalid_mutation(component[FILENAME], original[FILENAME]);
		} else {
			ownership_invalid_mutation();
		}
	}
}

/** @import { ProxyMetadata, ProxyStateObject, Source } from '#client' */

/**
 * @template T
 * @param {T} value
 * @param {ProxyMetadata | null} [parent]
 * @param {Source<T>} [prev] dev mode only
 * @returns {T}
 */
function proxy(value, parent = null, prev) {
	// if non-proxyable, or is already a proxy, return `value`
	if (typeof value !== 'object' || value === null || STATE_SYMBOL in value) {
		return value;
	}

	const prototype = get_prototype_of(value);

	if (prototype !== object_prototype && prototype !== array_prototype) {
		return value;
	}

	/** @type {Map<any, Source<any>>} */
	var sources = new Map();
	var is_proxied_array = is_array(value);
	var version = source(0);

	if (is_proxied_array) {
		// We need to create the length source eagerly to ensure that
		// mutations to the array are properly synced with our proxy
		sources.set('length', source(/** @type {any[]} */ (value).length));
	}

	/** @type {ProxyMetadata} */
	var metadata;

	if (DEV) {
		metadata = {
			parent,
			owners: null
		};

		{
			metadata.owners =
				parent === null
					? component_context !== null
						? new Set([component_context.function])
						: null
					: new Set();
		}
	}

	return new Proxy(/** @type {any} */ (value), {
		defineProperty(_, prop, descriptor) {
			if (
				!('value' in descriptor) ||
				descriptor.configurable === false ||
				descriptor.enumerable === false ||
				descriptor.writable === false
			) {
				// we disallow non-basic descriptors, because unless they are applied to the
				// target object — which we avoid, so that state can be forked — we will run
				// afoul of the various invariants
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
				state_descriptors_fixed();
			}

			var s = sources.get(prop);

			if (s === undefined) {
				s = source(descriptor.value);
				sources.set(prop, s);
			} else {
				set(s, proxy(descriptor.value, metadata));
			}

			return true;
		},

		deleteProperty(target, prop) {
			var s = sources.get(prop);

			if (s === undefined) {
				if (prop in target) {
					sources.set(prop, source(UNINITIALIZED));
				}
			} else {
				// When working with arrays, we need to also ensure we update the length when removing
				// an indexed property
				if (is_proxied_array && typeof prop === 'string') {
					var ls = /** @type {Source<number>} */ (sources.get('length'));
					var n = Number(prop);

					if (Number.isInteger(n) && n < ls.v) {
						set(ls, n);
					}
				}
				set(s, UNINITIALIZED);
				update_version(version);
			}

			return true;
		},

		get(target, prop, receiver) {
			if (DEV && prop === STATE_SYMBOL_METADATA) {
				return metadata;
			}

			if (prop === STATE_SYMBOL) {
				return value;
			}

			var s = sources.get(prop);
			var exists = prop in target;

			// create a source, but only if it's an own property and not a prototype property
			if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				s = source(proxy(exists ? target[prop] : UNINITIALIZED, metadata));
				sources.set(prop, s);
			}

			if (s !== undefined) {
				var v = get(s);

				// In case of something like `foo = bar.map(...)`, foo would have ownership
				// of the array itself, while the individual items would have ownership
				// of the component that created bar. That means if we later do `foo[0].baz = 42`,
				// we could get a false-positive ownership violation, since the two proxies
				// are not connected to each other via the parent metadata relationship.
				// For this reason, we need to widen the ownership of the children
				// upon access when we detect they are not connected.
				if (DEV) {
					/** @type {ProxyMetadata | undefined} */
					var prop_metadata = v?.[STATE_SYMBOL_METADATA];
					if (prop_metadata && prop_metadata?.parent !== metadata) {
						widen_ownership(metadata, prop_metadata);
					}
				}

				return v === UNINITIALIZED ? undefined : v;
			}

			return Reflect.get(target, prop, receiver);
		},

		getOwnPropertyDescriptor(target, prop) {
			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			if (descriptor && 'value' in descriptor) {
				var s = sources.get(prop);
				if (s) descriptor.value = get(s);
			} else if (descriptor === undefined) {
				var source = sources.get(prop);
				var value = source?.v;

				if (source !== undefined && value !== UNINITIALIZED) {
					return {
						enumerable: true,
						configurable: true,
						value,
						writable: true
					};
				}
			}

			return descriptor;
		},

		has(target, prop) {
			if (DEV && prop === STATE_SYMBOL_METADATA) {
				return true;
			}

			if (prop === STATE_SYMBOL) {
				return true;
			}

			var s = sources.get(prop);
			var has = (s !== undefined && s.v !== UNINITIALIZED) || Reflect.has(target, prop);

			if (
				s !== undefined ||
				(active_effect !== null && (!has || get_descriptor(target, prop)?.writable))
			) {
				if (s === undefined) {
					s = source(has ? proxy(target[prop], metadata) : UNINITIALIZED);
					sources.set(prop, s);
				}

				var value = get(s);
				if (value === UNINITIALIZED) {
					return false;
				}
			}

			return has;
		},

		set(target, prop, value, receiver) {
			var s = sources.get(prop);
			var has = prop in target;

			// variable.length = value -> clear all signals with index >= value
			if (is_proxied_array && prop === 'length') {
				for (var i = value; i < /** @type {Source<number>} */ (s).v; i += 1) {
					var other_s = sources.get(i + '');
					if (other_s !== undefined) {
						set(other_s, UNINITIALIZED);
					} else if (i in target) {
						// If the item exists in the original, we need to create a uninitialized source,
						// else a later read of the property would result in a source being created with
						// the value of the original item at that index.
						other_s = source(UNINITIALIZED);
						sources.set(i + '', other_s);
					}
				}
			}

			// If we haven't yet created a source for this property, we need to ensure
			// we do so otherwise if we read it later, then the write won't be tracked and
			// the heuristics of effects will be different vs if we had read the proxied
			// object property before writing to that property.
			if (s === undefined) {
				if (!has || get_descriptor(target, prop)?.writable) {
					s = source(undefined);
					set(s, proxy(value, metadata));
					sources.set(prop, s);
				}
			} else {
				has = s.v !== UNINITIALIZED;
				set(s, proxy(value, metadata));
			}

			if (DEV) {
				/** @type {ProxyMetadata | undefined} */
				var prop_metadata = value?.[STATE_SYMBOL_METADATA];
				if (prop_metadata && prop_metadata?.parent !== metadata) {
					widen_ownership(metadata, prop_metadata);
				}
				check_ownership(metadata);
			}

			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			// Set the new value before updating any signals so that any listeners get the new value
			if (descriptor?.set) {
				descriptor.set.call(receiver, value);
			}

			if (!has) {
				// If we have mutated an array directly, we might need to
				// signal that length has also changed. Do it before updating metadata
				// to ensure that iterating over the array as a result of a metadata update
				// will not cause the length to be out of sync.
				if (is_proxied_array && typeof prop === 'string') {
					var ls = /** @type {Source<number>} */ (sources.get('length'));
					var n = Number(prop);

					if (Number.isInteger(n) && n >= ls.v) {
						set(ls, n + 1);
					}
				}

				update_version(version);
			}

			return true;
		},

		ownKeys(target) {
			get(version);

			var own_keys = Reflect.ownKeys(target).filter((key) => {
				var source = sources.get(key);
				return source === undefined || source.v !== UNINITIALIZED;
			});

			for (var [key, source] of sources) {
				if (source.v !== UNINITIALIZED && !(key in target)) {
					own_keys.push(key);
				}
			}

			return own_keys;
		},

		setPrototypeOf() {
			state_prototype_fixed();
		}
	});
}

/**
 * @param {Source<number>} signal
 * @param {1 | -1} [d]
 */
function update_version(signal, d = 1) {
	set(signal, signal.v + d);
}

/**
 * @param {any} value
 */
function get_proxied_value(value) {
	if (value !== null && typeof value === 'object' && STATE_SYMBOL in value) {
		return value[STATE_SYMBOL];
	}

	return value;
}

/**
 * @param {any} a
 * @param {any} b
 */
function is(a, b) {
	return Object.is(get_proxied_value(a), get_proxied_value(b));
}

function init_array_prototype_warnings() {
	const array_prototype = Array.prototype;
	// The REPL ends up here over and over, and this prevents it from adding more and more patches
	// of the same kind to the prototype, which would slow down everything over time.
	// @ts-expect-error
	const cleanup = Array.__svelte_cleanup;
	if (cleanup) {
		cleanup();
	}

	const { indexOf, lastIndexOf, includes } = array_prototype;

	array_prototype.indexOf = function (item, from_index) {
		const index = indexOf.call(this, item, from_index);

		if (index === -1) {
			const test = indexOf.call(get_proxied_value(this), get_proxied_value(item), from_index);

			if (test !== -1) {
				state_proxy_equality_mismatch('array.indexOf(...)');
			}
		}

		return index;
	};

	array_prototype.lastIndexOf = function (item, from_index) {
		// we need to specify this.length - 1 because it's probably using something like
		// `arguments` inside so passing undefined is different from not passing anything
		const index = lastIndexOf.call(this, item, from_index ?? this.length - 1);

		if (index === -1) {
			// we need to specify this.length - 1 because it's probably using something like
			// `arguments` inside so passing undefined is different from not passing anything
			const test = lastIndexOf.call(
				get_proxied_value(this),
				get_proxied_value(item),
				from_index ?? this.length - 1
			);

			if (test !== -1) {
				state_proxy_equality_mismatch('array.lastIndexOf(...)');
			}
		}

		return index;
	};

	array_prototype.includes = function (item, from_index) {
		const has = includes.call(this, item, from_index);

		if (!has) {
			const test = includes.call(get_proxied_value(this), get_proxied_value(item), from_index);

			if (test) {
				state_proxy_equality_mismatch('array.includes(...)');
			}
		}

		return has;
	};

	// @ts-expect-error
	Array.__svelte_cleanup = () => {
		array_prototype.indexOf = indexOf;
		array_prototype.lastIndexOf = lastIndexOf;
		array_prototype.includes = includes;
	};
}

/** @import { TemplateNode } from '#client' */

// export these for reference in the compiled code, making global name deduplication unnecessary
/** @type {Window} */
var $window;

/** @type {() => Node | null} */
var first_child_getter;
/** @type {() => Node | null} */
var next_sibling_getter;

/**
 * Initialize these lazily to avoid issues when using the runtime in a server context
 * where these globals are not available while avoiding a separate server entry point
 */
function init_operations() {
	if ($window !== undefined) {
		return;
	}

	$window = window;

	var element_prototype = Element.prototype;
	var node_prototype = Node.prototype;

	// @ts-ignore
	first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
	// @ts-ignore
	next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

	// the following assignments improve perf of lookups on DOM nodes
	// @ts-expect-error
	element_prototype.__click = undefined;
	// @ts-expect-error
	element_prototype.__className = '';
	// @ts-expect-error
	element_prototype.__attributes = null;
	// @ts-expect-error
	element_prototype.__e = undefined;

	// @ts-expect-error
	Text.prototype.__t = undefined;

	if (DEV) {
		// @ts-expect-error
		element_prototype.__svelte_meta = null;

		init_array_prototype_warnings();
	}
}

/**
 * @param {string} value
 * @returns {Text}
 */
function create_text(value = '') {
	return document.createTextNode(value);
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
/*@__NO_SIDE_EFFECTS__*/
function get_first_child(node) {
	return first_child_getter.call(node);
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
/*@__NO_SIDE_EFFECTS__*/
function get_next_sibling(node) {
	return next_sibling_getter.call(node);
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @template {Node} N
 * @param {N} node
 * @returns {Node | null}
 */
function child(node) {
	{
		return get_first_child(node);
	}
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @param {DocumentFragment | TemplateNode[]} fragment
 * @param {boolean} is_text
 * @returns {Node | null}
 */
function first_child(fragment, is_text) {
	{
		// when not hydrating, `fragment` is a `DocumentFragment` (the result of calling `open_frag`)
		var first = /** @type {DocumentFragment} */ (get_first_child(/** @type {Node} */ (fragment)));

		// TODO prevent user comments with the empty string when preserveComments is true
		if (first instanceof Comment && first.data === '') return get_next_sibling(first);

		return first;
	}
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @param {TemplateNode} node
 * @param {number} count
 * @param {boolean} is_text
 * @returns {Node | null}
 */
function sibling(node, count = 1, is_text = false) {
	let next_sibling = node;

	while (count--) {
		next_sibling = /** @type {TemplateNode} */ (get_next_sibling(next_sibling));
	}

	{
		return next_sibling;
	}
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {void}
 */
function clear_text_content(node) {
	node.textContent = '';
}

/** @import { Derived, Effect } from '#client' */

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived(fn) {
	var flags = DERIVED | DIRTY;

	if (active_effect === null) {
		flags |= UNOWNED;
	} else {
		// Since deriveds are evaluated lazily, any effects created inside them are
		// created too late to ensure that the parent effect is added to the tree
		active_effect.f |= EFFECT_HAS_DERIVED;
	}

	/** @type {Derived<V>} */
	const signal = {
		children: null,
		deps: null,
		equals,
		f: flags,
		fn,
		reactions: null,
		v: /** @type {V} */ (null),
		version: 0,
		parent: active_effect
	};

	if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0) {
		var derived = /** @type {Derived} */ (active_reaction);
		(derived.children ??= []).push(signal);
	}

	return signal;
}

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived_safe_equal(fn) {
	const signal = derived(fn);
	signal.equals = safe_equals;
	return signal;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function destroy_derived_children(derived) {
	var children = derived.children;

	if (children !== null) {
		derived.children = null;

		for (var i = 0; i < children.length; i += 1) {
			var child = children[i];
			if ((child.f & DERIVED) !== 0) {
				destroy_derived(/** @type {Derived} */ (child));
			} else {
				destroy_effect(/** @type {Effect} */ (child));
			}
		}
	}
}

/**
 * The currently updating deriveds, used to detect infinite recursion
 * in dev mode and provide a nicer error than 'too much recursion'
 * @type {Derived[]}
 */
let stack = [];

/**
 * @template T
 * @param {Derived} derived
 * @returns {T}
 */
function execute_derived(derived) {
	var value;
	var prev_active_effect = active_effect;

	set_active_effect(derived.parent);

	if (DEV) {
		let prev_inspect_effects = inspect_effects;
		set_inspect_effects(new Set());
		try {
			if (stack.includes(derived)) {
				derived_references_self();
			}

			stack.push(derived);

			destroy_derived_children(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
			set_inspect_effects(prev_inspect_effects);
			stack.pop();
		}
	} else {
		try {
			destroy_derived_children(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
		}
	}

	return value;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function update_derived(derived) {
	var value = execute_derived(derived);
	var status =
		(skip_reaction || (derived.f & UNOWNED) !== 0) && derived.deps !== null ? MAYBE_DIRTY : CLEAN;

	set_signal_status(derived, status);

	if (!derived.equals(value)) {
		derived.v = value;
		derived.version = increment_version();
	}
}

/**
 * @param {Derived} signal
 * @returns {void}
 */
function destroy_derived(signal) {
	destroy_derived_children(signal);
	remove_reactions(signal, 0);
	set_signal_status(signal, DESTROYED);

	// TODO we need to ensure we remove the derived from any parent derives
	signal.v = signal.children = signal.deps = signal.reactions = null;
}

/** @import { ComponentContext, ComponentContextLegacy, Derived, Effect, Reaction, TemplateNode, TransitionManager } from '#client' */

/**
 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
 */
function validate_effect(rune) {
	if (active_effect === null && active_reaction === null) {
		effect_orphan(rune);
	}

	if (active_reaction !== null && (active_reaction.f & UNOWNED) !== 0) {
		effect_in_unowned_derived();
	}

	if (is_destroying_effect) {
		effect_in_teardown(rune);
	}
}

/**
 * @param {Effect} effect
 * @param {Effect} parent_effect
 */
function push_effect(effect, parent_effect) {
	var parent_last = parent_effect.last;
	if (parent_last === null) {
		parent_effect.last = parent_effect.first = effect;
	} else {
		parent_last.next = effect;
		effect.prev = parent_last;
		parent_effect.last = effect;
	}
}

/**
 * @param {number} type
 * @param {null | (() => void | (() => void))} fn
 * @param {boolean} sync
 * @param {boolean} push
 * @returns {Effect}
 */
function create_effect(type, fn, sync, push = true) {
	var is_root = (type & ROOT_EFFECT) !== 0;
	var parent_effect = active_effect;

	if (DEV) {
		// Ensure the parent is never an inspect effect
		while (parent_effect !== null && (parent_effect.f & INSPECT_EFFECT) !== 0) {
			parent_effect = parent_effect.parent;
		}
	}

	/** @type {Effect} */
	var effect = {
		ctx: component_context,
		deps: null,
		deriveds: null,
		nodes_start: null,
		nodes_end: null,
		f: type | DIRTY,
		first: null,
		fn,
		last: null,
		next: null,
		parent: is_root ? null : parent_effect,
		prev: null,
		teardown: null,
		transitions: null,
		version: 0
	};

	if (DEV) {
		effect.component_function = dev_current_component_function;
	}

	if (sync) {
		var previously_flushing_effect = is_flushing_effect;

		try {
			set_is_flushing_effect(true);
			update_effect(effect);
			effect.f |= EFFECT_RAN;
		} catch (e) {
			destroy_effect(effect);
			throw e;
		} finally {
			set_is_flushing_effect(previously_flushing_effect);
		}
	} else if (fn !== null) {
		schedule_effect(effect);
	}

	// if an effect has no dependencies, no DOM and no teardown function,
	// don't bother adding it to the effect tree
	var inert =
		sync &&
		effect.deps === null &&
		effect.first === null &&
		effect.nodes_start === null &&
		effect.teardown === null &&
		(effect.f & EFFECT_HAS_DERIVED) === 0;

	if (!inert && !is_root && push) {
		if (parent_effect !== null) {
			push_effect(effect, parent_effect);
		}

		// if we're in a derived, add the effect there too
		if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0) {
			var derived = /** @type {Derived} */ (active_reaction);
			(derived.children ??= []).push(effect);
		}
	}

	return effect;
}

/**
 * @param {() => void} fn
 */
function teardown(fn) {
	const effect = create_effect(RENDER_EFFECT, null, false);
	set_signal_status(effect, CLEAN);
	effect.teardown = fn;
	return effect;
}

/**
 * Internal representation of `$effect(...)`
 * @param {() => void | (() => void)} fn
 */
function user_effect(fn) {
	validate_effect('$effect');

	// Non-nested `$effect(...)` in a component should be deferred
	// until the component is mounted
	var defer =
		active_effect !== null &&
		(active_effect.f & BRANCH_EFFECT) !== 0 &&
		component_context !== null &&
		!component_context.m;

	if (DEV) {
		define_property(fn, 'name', {
			value: '$effect'
		});
	}

	if (defer) {
		var context = /** @type {ComponentContext} */ (component_context);
		(context.e ??= []).push({
			fn,
			effect: active_effect,
			reaction: active_reaction
		});
	} else {
		var signal = effect(fn);
		return signal;
	}
}

/**
 * Internal representation of `$effect.pre(...)`
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function user_pre_effect(fn) {
	validate_effect('$effect.pre');
	if (DEV) {
		define_property(fn, 'name', {
			value: '$effect.pre'
		});
	}
	return render_effect(fn);
}

/**
 * Internal representation of `$effect.root(...)`
 * @param {() => void | (() => void)} fn
 * @returns {() => void}
 */
function effect_root(fn) {
	const effect = create_effect(ROOT_EFFECT, fn, true);
	return () => {
		destroy_effect(effect);
	};
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function effect(fn) {
	return create_effect(EFFECT, fn, false);
}

/**
 * Internal representation of `$: ..`
 * @param {() => any} deps
 * @param {() => void | (() => void)} fn
 */
function legacy_pre_effect(deps, fn) {
	var context = /** @type {ComponentContextLegacy} */ (component_context);

	/** @type {{ effect: null | Effect, ran: boolean }} */
	var token = { effect: null, ran: false };
	context.l.r1.push(token);

	token.effect = render_effect(() => {
		deps();

		// If this legacy pre effect has already run before the end of the reset, then
		// bail out to emulate the same behavior.
		if (token.ran) return;

		token.ran = true;
		set(context.l.r2, true);
		untrack(fn);
	});
}

function legacy_pre_effect_reset() {
	var context = /** @type {ComponentContextLegacy} */ (component_context);

	render_effect(() => {
		if (!get(context.l.r2)) return;

		// Run dirty `$:` statements
		for (var token of context.l.r1) {
			var effect = token.effect;

			// If the effect is CLEAN, then make it MAYBE_DIRTY. This ensures we traverse through
			// the effects dependencies and correctly ensure each dependency is up-to-date.
			if ((effect.f & CLEAN) !== 0) {
				set_signal_status(effect, MAYBE_DIRTY);
			}

			if (check_dirtiness(effect)) {
				update_effect(effect);
			}

			token.ran = false;
		}

		context.l.r2.v = false; // set directly to avoid rerunning this effect
	});
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function render_effect(fn) {
	return create_effect(RENDER_EFFECT, fn, true);
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function template_effect(fn) {
	if (DEV) {
		define_property(fn, 'name', {
			value: '{expression}'
		});
	}
	return block$1(fn);
}

/**
 * @param {(() => void)} fn
 * @param {number} flags
 */
function block$1(fn, flags = 0) {
	return create_effect(RENDER_EFFECT | BLOCK_EFFECT | flags, fn, true);
}

/**
 * @param {(() => void)} fn
 * @param {boolean} [push]
 */
function branch(fn, push = true) {
	return create_effect(RENDER_EFFECT | BRANCH_EFFECT, fn, true, push);
}

/**
 * @param {Effect} effect
 */
function execute_effect_teardown(effect) {
	var teardown = effect.teardown;
	if (teardown !== null) {
		const previously_destroying_effect = is_destroying_effect;
		const previous_reaction = active_reaction;
		set_is_destroying_effect(true);
		set_active_reaction(null);
		try {
			teardown.call(null);
		} finally {
			set_is_destroying_effect(previously_destroying_effect);
			set_active_reaction(previous_reaction);
		}
	}
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function destroy_effect_deriveds(signal) {
	var deriveds = signal.deriveds;

	if (deriveds !== null) {
		signal.deriveds = null;

		for (var i = 0; i < deriveds.length; i += 1) {
			destroy_derived(deriveds[i]);
		}
	}
}

/**
 * @param {Effect} signal
 * @param {boolean} remove_dom
 * @returns {void}
 */
function destroy_effect_children(signal, remove_dom = false) {
	var effect = signal.first;
	signal.first = signal.last = null;

	while (effect !== null) {
		var next = effect.next;
		destroy_effect(effect, remove_dom);
		effect = next;
	}
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function destroy_block_effect_children(signal) {
	var effect = signal.first;

	while (effect !== null) {
		var next = effect.next;
		if ((effect.f & BRANCH_EFFECT) === 0) {
			destroy_effect(effect);
		}
		effect = next;
	}
}

/**
 * @param {Effect} effect
 * @param {boolean} [remove_dom]
 * @returns {void}
 */
function destroy_effect(effect, remove_dom = true) {
	var removed = false;

	if ((remove_dom || (effect.f & HEAD_EFFECT) !== 0) && effect.nodes_start !== null) {
		/** @type {TemplateNode | null} */
		var node = effect.nodes_start;
		var end = effect.nodes_end;
		var previous_reaction = active_reaction;
		var previous_effect = active_effect;

		// Really we only need to do this in Chromium because of https://chromestatus.com/feature/5128696823545856,
		// as removal of the DOM can cause sync `blur` events to fire, which can cause logic to run inside
		// the current `active_reaction`, which isn't what we want at all. Additionally, the blur event handler
		// might create a derived or effect and they will be incorrectly attached to the wrong thing
		set_active_reaction(null);
		set_active_effect(null);
		try {
			while (node !== null) {
				/** @type {TemplateNode | null} */
				var next = node === end ? null : /** @type {TemplateNode} */ (get_next_sibling(node));

				node.remove();
				node = next;
			}
		} finally {
			set_active_reaction(previous_reaction);
			set_active_effect(previous_effect);
		}

		removed = true;
	}

	destroy_effect_deriveds(effect);
	destroy_effect_children(effect, remove_dom && !removed);
	remove_reactions(effect, 0);
	set_signal_status(effect, DESTROYED);

	var transitions = effect.transitions;

	if (transitions !== null) {
		for (const transition of transitions) {
			transition.stop();
		}
	}

	execute_effect_teardown(effect);

	var parent = effect.parent;

	// If the parent doesn't have any children, then skip this work altogether
	if (parent !== null && parent.first !== null) {
		unlink_effect(effect);
	}

	if (DEV) {
		effect.component_function = null;
	}

	// `first` and `child` are nulled out in destroy_effect_children
	effect.next =
		effect.prev =
		effect.teardown =
		effect.ctx =
		effect.deps =
		effect.parent =
		effect.fn =
		effect.nodes_start =
		effect.nodes_end =
			null;
}

/**
 * Detach an effect from the effect tree, freeing up memory and
 * reducing the amount of work that happens on subsequent traversals
 * @param {Effect} effect
 */
function unlink_effect(effect) {
	var parent = effect.parent;
	var prev = effect.prev;
	var next = effect.next;

	if (prev !== null) prev.next = next;
	if (next !== null) next.prev = prev;

	if (parent !== null) {
		if (parent.first === effect) parent.first = next;
		if (parent.last === effect) parent.last = prev;
	}
}

/**
 * When a block effect is removed, we don't immediately destroy it or yank it
 * out of the DOM, because it might have transitions. Instead, we 'pause' it.
 * It stays around (in memory, and in the DOM) until outro transitions have
 * completed, and if the state change is reversed then we _resume_ it.
 * A paused effect does not update, and the DOM subtree becomes inert.
 * @param {Effect} effect
 * @param {() => void} [callback]
 */
function pause_effect(effect, callback) {
	/** @type {TransitionManager[]} */
	var transitions = [];

	pause_children(effect, transitions, true);

	run_out_transitions(transitions, () => {
		destroy_effect(effect);
		if (callback) callback();
	});
}

/**
 * @param {TransitionManager[]} transitions
 * @param {() => void} fn
 */
function run_out_transitions(transitions, fn) {
	var remaining = transitions.length;
	if (remaining > 0) {
		var check = () => --remaining || fn();
		for (var transition of transitions) {
			transition.out(check);
		}
	} else {
		fn();
	}
}

/**
 * @param {Effect} effect
 * @param {TransitionManager[]} transitions
 * @param {boolean} local
 */
function pause_children(effect, transitions, local) {
	if ((effect.f & INERT) !== 0) return;
	effect.f ^= INERT;

	if (effect.transitions !== null) {
		for (const transition of effect.transitions) {
			if (transition.is_global || local) {
				transitions.push(transition);
			}
		}
	}

	var child = effect.first;

	while (child !== null) {
		var sibling = child.next;
		var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
		// TODO we don't need to call pause_children recursively with a linked list in place
		// it's slightly more involved though as we have to account for `transparent` changing
		// through the tree.
		pause_children(child, transitions, transparent ? local : false);
		child = sibling;
	}
}

/**
 * The opposite of `pause_effect`. We call this if (for example)
 * `x` becomes falsy then truthy: `{#if x}...{/if}`
 * @param {Effect} effect
 */
function resume_effect(effect) {
	resume_children(effect, true);
}

/**
 * @param {Effect} effect
 * @param {boolean} local
 */
function resume_children(effect, local) {
	if ((effect.f & INERT) === 0) return;
	effect.f ^= INERT;

	// If a dependency of this effect changed while it was paused,
	// apply the change now
	if (check_dirtiness(effect)) {
		update_effect(effect);
	}

	var child = effect.first;

	while (child !== null) {
		var sibling = child.next;
		var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
		// TODO we don't need to call resume_children recursively with a linked list in place
		// it's slightly more involved though as we have to account for `transparent` changing
		// through the tree.
		resume_children(child, transparent ? local : false);
		child = sibling;
	}

	if (effect.transitions !== null) {
		for (const transition of effect.transitions) {
			if (transition.is_global || local) {
				transition.in();
			}
		}
	}
}

let is_micro_task_queued$1 = false;

/** @type {Array<() => void>} */
let current_queued_micro_tasks = [];

function process_micro_tasks() {
	is_micro_task_queued$1 = false;
	const tasks = current_queued_micro_tasks.slice();
	current_queued_micro_tasks = [];
	run_all(tasks);
}

/**
 * @param {() => void} fn
 */
function queue_micro_task(fn) {
	if (!is_micro_task_queued$1) {
		is_micro_task_queued$1 = true;
		queueMicrotask(process_micro_tasks);
	}
	current_queued_micro_tasks.push(fn);
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * `%name%(...)` can only be used during component initialisation
 * @param {string} name
 * @returns {never}
 */
function lifecycle_outside_component(name) {
	if (DEV) {
		const error = new Error(`lifecycle_outside_component\n\`${name}(...)\` can only be used during component initialisation`);

		error.name = 'Svelte error';
		throw error;
	} else {
		// TODO print a link to the documentation
		throw new Error("lifecycle_outside_component");
	}
}

/** @import { ComponentContext, Derived, Effect, Reaction, Signal, Source, Value } from '#client' */

// Used for DEV time error handling
/** @param {WeakSet<Error>} value */
const handled_errors = new WeakSet();
// Used for handling scheduling
let is_micro_task_queued = false;

let is_flushing_effect = false;
let is_destroying_effect = false;

/** @param {boolean} value */
function set_is_flushing_effect(value) {
	is_flushing_effect = value;
}

/** @param {boolean} value */
function set_is_destroying_effect(value) {
	is_destroying_effect = value;
}

// Handle effect queues

/** @type {Effect[]} */
let queued_root_effects = [];

let flush_count = 0;
/** @type {Effect[]} Stack of effects, dev only */
let dev_effect_stack = [];
// Handle signal reactivity tree dependencies and reactions

/** @type {null | Reaction} */
let active_reaction = null;

/** @param {null | Reaction} reaction */
function set_active_reaction(reaction) {
	active_reaction = reaction;
}

/** @type {null | Effect} */
let active_effect = null;

/** @param {null | Effect} effect */
function set_active_effect(effect) {
	active_effect = effect;
}

/**
 * When sources are created within a derived, we record them so that we can safely allow
 * local mutations to these sources without the side-effect error being invoked unnecessarily.
 * @type {null | Source[]}
 */
let derived_sources = null;

/**
 * @param {Source[] | null} sources
 */
function set_derived_sources(sources) {
	derived_sources = sources;
}

/**
 * The dependencies of the reaction that is currently being executed. In many cases,
 * the dependencies are unchanged between runs, and so this will be `null` unless
 * and until a new dependency is accessed — we track this via `skipped_deps`
 * @type {null | Value[]}
 */
let new_deps = null;

let skipped_deps = 0;

/**
 * Tracks writes that the effect it's executed in doesn't listen to yet,
 * so that the dependency can be added to the effect later on if it then reads it
 * @type {null | Source[]}
 */
let untracked_writes = null;

/** @param {null | Source[]} value */
function set_untracked_writes(value) {
	untracked_writes = value;
}

/** @type {number} Used by sources and deriveds for handling updates to unowned deriveds */
let current_version = 0;

// If we are working with a get() chain that has no active container,
// to prevent memory leaks, we skip adding the reaction.
let skip_reaction = false;
// Handle collecting all signals which are read during a specific time frame
let is_signals_recorded = false;
let captured_signals = new Set();

// Handling runtime component context
/** @type {ComponentContext | null} */
let component_context = null;

/**
 * The current component function. Different from current component context:
 * ```html
 * <!-- App.svelte -->
 * <Foo>
 *   <Bar /> <!-- context == Foo.svelte, function == App.svelte -->
 * </Foo>
 * ```
 * @type {ComponentContext['function']}
 */
let dev_current_component_function = null;

function increment_version() {
	return ++current_version;
}

/** @returns {boolean} */
function is_runes() {
	return component_context !== null && component_context.l === null;
}

/**
 * Determines whether a derived or effect is dirty.
 * If it is MAYBE_DIRTY, will set the status to CLEAN
 * @param {Reaction} reaction
 * @returns {boolean}
 */
function check_dirtiness(reaction) {
	var flags = reaction.f;

	if ((flags & DIRTY) !== 0) {
		return true;
	}

	if ((flags & MAYBE_DIRTY) !== 0) {
		var dependencies = reaction.deps;
		var is_unowned = (flags & UNOWNED) !== 0;

		if (dependencies !== null) {
			var i;

			if ((flags & DISCONNECTED) !== 0) {
				for (i = 0; i < dependencies.length; i++) {
					(dependencies[i].reactions ??= []).push(reaction);
				}

				reaction.f ^= DISCONNECTED;
			}

			for (i = 0; i < dependencies.length; i++) {
				var dependency = dependencies[i];

				if (check_dirtiness(/** @type {Derived} */ (dependency))) {
					update_derived(/** @type {Derived} */ (dependency));
				}

				// If we are working with an unowned signal as part of an effect (due to !skip_reaction)
				// and the version hasn't changed, we still need to check that this reaction
				// is linked to the dependency source – otherwise future updates will not be caught.
				if (
					is_unowned &&
					active_effect !== null &&
					!skip_reaction &&
					!dependency?.reactions?.includes(reaction)
				) {
					(dependency.reactions ??= []).push(reaction);
				}

				if (dependency.version > reaction.version) {
					return true;
				}
			}
		}

		// Unowned signals should never be marked as clean.
		if (!is_unowned) {
			set_signal_status(reaction, CLEAN);
		}
	}

	return false;
}

/**
 * @param {Error} error
 * @param {Effect} effect
 * @param {ComponentContext | null} component_context
 */
function handle_error(error, effect, component_context) {
	// Given we don't yet have error boundaries, we will just always throw.
	if (!DEV || handled_errors.has(error) || component_context === null) {
		throw error;
	}

	const component_stack = [];

	const effect_name = effect.fn?.name;

	if (effect_name) {
		component_stack.push(effect_name);
	}

	/** @type {ComponentContext | null} */
	let current_context = component_context;

	while (current_context !== null) {
		if (DEV) {
			/** @type {string} */
			var filename = current_context.function?.[FILENAME];

			if (filename) {
				const file = filename.split('/').pop();
				component_stack.push(file);
			}
		}

		current_context = current_context.p;
	}

	const indent = /Firefox/.test(navigator.userAgent) ? '  ' : '\t';
	define_property(error, 'message', {
		value: error.message + `\n${component_stack.map((name) => `\n${indent}in ${name}`).join('')}\n`
	});

	const stack = error.stack;

	// Filter out internal files from callstack
	if (stack) {
		const lines = stack.split('\n');
		const new_lines = [];
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.includes('svelte/src/internal')) {
				continue;
			}
			new_lines.push(line);
		}
		define_property(error, 'stack', {
			value: error.stack + new_lines.join('\n')
		});
	}

	handled_errors.add(error);
	throw error;
}

/**
 * @template V
 * @param {Reaction} reaction
 * @returns {V}
 */
function update_reaction(reaction) {
	var previous_deps = new_deps;
	var previous_skipped_deps = skipped_deps;
	var previous_untracked_writes = untracked_writes;
	var previous_reaction = active_reaction;
	var previous_skip_reaction = skip_reaction;
	var prev_derived_sources = derived_sources;
	var flags = reaction.f;

	new_deps = /** @type {null | Value[]} */ (null);
	skipped_deps = 0;
	untracked_writes = null;
	active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;
	skip_reaction = !is_flushing_effect && (flags & UNOWNED) !== 0;
	derived_sources = null;

	try {
		var result = /** @type {Function} */ (0, reaction.fn)();
		var deps = reaction.deps;

		if (new_deps !== null) {
			var i;

			remove_reactions(reaction, skipped_deps);

			if (deps !== null && skipped_deps > 0) {
				deps.length = skipped_deps + new_deps.length;
				for (i = 0; i < new_deps.length; i++) {
					deps[skipped_deps + i] = new_deps[i];
				}
			} else {
				reaction.deps = deps = new_deps;
			}

			if (!skip_reaction) {
				for (i = skipped_deps; i < deps.length; i++) {
					(deps[i].reactions ??= []).push(reaction);
				}
			}
		} else if (deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}

		return result;
	} finally {
		new_deps = previous_deps;
		skipped_deps = previous_skipped_deps;
		untracked_writes = previous_untracked_writes;
		active_reaction = previous_reaction;
		skip_reaction = previous_skip_reaction;
		derived_sources = prev_derived_sources;
	}
}

/**
 * @template V
 * @param {Reaction} signal
 * @param {Value<V>} dependency
 * @returns {void}
 */
function remove_reaction(signal, dependency) {
	let reactions = dependency.reactions;
	if (reactions !== null) {
		var index = reactions.indexOf(signal);
		if (index !== -1) {
			var new_length = reactions.length - 1;
			if (new_length === 0) {
				reactions = dependency.reactions = null;
			} else {
				// Swap with last element and then remove.
				reactions[index] = reactions[new_length];
				reactions.pop();
			}
		}
	}
	// If the derived has no reactions, then we can disconnect it from the graph,
	// allowing it to either reconnect in the future, or be GC'd by the VM.
	if (
		reactions === null &&
		(dependency.f & DERIVED) !== 0 &&
		// Destroying a child effect while updating a parent effect can cause a dependency to appear
		// to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
		// allows us to skip the expensive work of disconnecting and immediately reconnecting it
		(new_deps === null || !new_deps.includes(dependency))
	) {
		set_signal_status(dependency, MAYBE_DIRTY);
		// If we are working with a derived that is owned by an effect, then mark it as being
		// disconnected.
		if ((dependency.f & (UNOWNED | DISCONNECTED)) === 0) {
			dependency.f ^= DISCONNECTED;
		}
		remove_reactions(/** @type {Derived} **/ (dependency), 0);
	}
}

/**
 * @param {Reaction} signal
 * @param {number} start_index
 * @returns {void}
 */
function remove_reactions(signal, start_index) {
	var dependencies = signal.deps;
	if (dependencies === null) return;

	for (var i = start_index; i < dependencies.length; i++) {
		remove_reaction(signal, dependencies[i]);
	}
}

/**
 * @param {Effect} effect
 * @returns {void}
 */
function update_effect(effect) {
	var flags = effect.f;

	if ((flags & DESTROYED) !== 0) {
		return;
	}

	set_signal_status(effect, CLEAN);

	var previous_effect = active_effect;
	var previous_component_context = component_context;

	active_effect = effect;
	component_context = effect.ctx;

	if (DEV) {
		var previous_component_fn = dev_current_component_function;
		dev_current_component_function = effect.component_function;
	}

	try {
		destroy_effect_deriveds(effect);
		if ((flags & BLOCK_EFFECT) !== 0) {
			destroy_block_effect_children(effect);
		} else {
			destroy_effect_children(effect);
		}

		execute_effect_teardown(effect);
		var teardown = update_reaction(effect);
		effect.teardown = typeof teardown === 'function' ? teardown : null;
		effect.version = current_version;

		if (DEV) {
			dev_effect_stack.push(effect);
		}
	} catch (error) {
		handle_error(/** @type {Error} */ (error), effect, previous_component_context);
	} finally {
		active_effect = previous_effect;
		component_context = previous_component_context;

		if (DEV) {
			dev_current_component_function = previous_component_fn;
		}
	}
}

function infinite_loop_guard() {
	if (flush_count > 1000) {
		flush_count = 0;
		if (DEV) {
			try {
				effect_update_depth_exceeded();
			} catch (error) {
				// stack is garbage, ignore. Instead add a console.error message.
				define_property(error, 'stack', {
					value: ''
				});
				// eslint-disable-next-line no-console
				console.error(
					'Last ten effects were: ',
					dev_effect_stack.slice(-10).map((d) => d.fn)
				);
				dev_effect_stack = [];
				throw error;
			}
		} else {
			effect_update_depth_exceeded();
		}
	}
	flush_count++;
}

/**
 * @param {Array<Effect>} root_effects
 * @returns {void}
 */
function flush_queued_root_effects(root_effects) {
	var length = root_effects.length;
	if (length === 0) {
		return;
	}
	infinite_loop_guard();

	var previously_flushing_effect = is_flushing_effect;
	is_flushing_effect = true;

	try {
		for (var i = 0; i < length; i++) {
			var effect = root_effects[i];

			if ((effect.f & CLEAN) === 0) {
				effect.f ^= CLEAN;
			}

			/** @type {Effect[]} */
			var collected_effects = [];

			process_effects(effect, collected_effects);
			flush_queued_effects(collected_effects);
		}
	} finally {
		is_flushing_effect = previously_flushing_effect;
	}
}

/**
 * @param {Array<Effect>} effects
 * @returns {void}
 */
function flush_queued_effects(effects) {
	var length = effects.length;
	if (length === 0) return;

	for (var i = 0; i < length; i++) {
		var effect = effects[i];

		if ((effect.f & (DESTROYED | INERT)) === 0 && check_dirtiness(effect)) {
			update_effect(effect);

			// Effects with no dependencies or teardown do not get added to the effect tree.
			// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
			// don't know if we need to keep them until they are executed. Doing the check
			// here (rather than in `update_effect`) allows us to skip the work for
			// immediate effects.
			if (effect.deps === null && effect.first === null && effect.nodes_start === null) {
				if (effect.teardown === null) {
					// remove this effect from the graph
					unlink_effect(effect);
				} else {
					// keep the effect in the graph, but free up some memory
					effect.fn = null;
				}
			}
		}
	}
}

function process_deferred() {
	is_micro_task_queued = false;
	if (flush_count > 1001) {
		return;
	}
	const previous_queued_root_effects = queued_root_effects;
	queued_root_effects = [];
	flush_queued_root_effects(previous_queued_root_effects);
	if (!is_micro_task_queued) {
		flush_count = 0;
		if (DEV) {
			dev_effect_stack = [];
		}
	}
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function schedule_effect(signal) {
	{
		if (!is_micro_task_queued) {
			is_micro_task_queued = true;
			queueMicrotask(process_deferred);
		}
	}

	var effect = signal;

	while (effect.parent !== null) {
		effect = effect.parent;
		var flags = effect.f;

		if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
			if ((flags & CLEAN) === 0) return;
			effect.f ^= CLEAN;
		}
	}

	queued_root_effects.push(effect);
}

/**
 *
 * This function both runs render effects and collects user effects in topological order
 * from the starting effect passed in. Effects will be collected when they match the filtered
 * bitwise flag passed in only. The collected effects array will be populated with all the user
 * effects to be flushed.
 *
 * @param {Effect} effect
 * @param {Effect[]} collected_effects
 * @returns {void}
 */
function process_effects(effect, collected_effects) {
	var current_effect = effect.first;
	var effects = [];

	main_loop: while (current_effect !== null) {
		var flags = current_effect.f;
		var is_branch = (flags & BRANCH_EFFECT) !== 0;
		var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;

		if (!is_skippable_branch && (flags & INERT) === 0) {
			if ((flags & RENDER_EFFECT) !== 0) {
				if (is_branch) {
					current_effect.f ^= CLEAN;
				} else if (check_dirtiness(current_effect)) {
					update_effect(current_effect);
				}

				var child = current_effect.first;

				if (child !== null) {
					current_effect = child;
					continue;
				}
			} else if ((flags & EFFECT) !== 0) {
				effects.push(current_effect);
			}
		}

		var sibling = current_effect.next;

		if (sibling === null) {
			let parent = current_effect.parent;

			while (parent !== null) {
				if (effect === parent) {
					break main_loop;
				}
				var parent_sibling = parent.next;
				if (parent_sibling !== null) {
					current_effect = parent_sibling;
					continue main_loop;
				}
				parent = parent.parent;
			}
		}

		current_effect = sibling;
	}

	// We might be dealing with many effects here, far more than can be spread into
	// an array push call (callstack overflow). So let's deal with each effect in a loop.
	for (var i = 0; i < effects.length; i++) {
		child = effects[i];
		collected_effects.push(child);
		process_effects(child, collected_effects);
	}
}

/**
 * @template V
 * @param {Value<V>} signal
 * @returns {V}
 */
function get(signal) {
	var flags = signal.f;
	var is_derived = (flags & DERIVED) !== 0;

	// If the derived is destroyed, just execute it again without retaining
	// its memoisation properties as the derived is stale
	if (is_derived && (flags & DESTROYED) !== 0) {
		var value = execute_derived(/** @type {Derived} */ (signal));
		// Ensure the derived remains destroyed
		destroy_derived(/** @type {Derived} */ (signal));
		return value;
	}

	if (is_signals_recorded) {
		captured_signals.add(signal);
	}

	// Register the dependency on the current reaction signal.
	if (active_reaction !== null) {
		if (derived_sources !== null && derived_sources.includes(signal)) {
			state_unsafe_local_read();
		}
		var deps = active_reaction.deps;

		// If the signal is accessing the same dependencies in the same
		// order as it did last time, increment `skipped_deps`
		// rather than updating `new_deps`, which creates GC cost
		if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
			skipped_deps++;
		} else if (new_deps === null) {
			new_deps = [signal];
		} else {
			new_deps.push(signal);
		}

		if (
			untracked_writes !== null &&
			active_effect !== null &&
			(active_effect.f & CLEAN) !== 0 &&
			(active_effect.f & BRANCH_EFFECT) === 0 &&
			untracked_writes.includes(signal)
		) {
			set_signal_status(active_effect, DIRTY);
			schedule_effect(active_effect);
		}
	} else if (is_derived && /** @type {Derived} */ (signal).deps === null) {
		var derived = /** @type {Derived} */ (signal);
		var parent = derived.parent;

		if (parent !== null && !parent.deriveds?.includes(derived)) {
			(parent.deriveds ??= []).push(derived);
		}
	}

	if (is_derived) {
		derived = /** @type {Derived} */ (signal);

		if (check_dirtiness(derived)) {
			update_derived(derived);
		}
	}

	return signal.v;
}

/**
 * Invokes a function and captures all signals that are read during the invocation,
 * then invalidates them.
 * @param {() => any} fn
 */
function invalidate_inner_signals(fn) {
	var previous_is_signals_recorded = is_signals_recorded;
	var previous_captured_signals = captured_signals;
	is_signals_recorded = true;
	captured_signals = new Set();
	var captured = captured_signals;
	var signal;
	try {
		untrack(fn);
	} finally {
		is_signals_recorded = previous_is_signals_recorded;
		if (is_signals_recorded) {
			for (signal of captured_signals) {
				previous_captured_signals.add(signal);
			}
		}
		captured_signals = previous_captured_signals;
	}
	for (signal of captured) {
		// Go one level up because derived signals created as part of props in legacy mode
		if ((signal.f & LEGACY_DERIVED_PROP) !== 0) {
			for (const dep of /** @type {Derived} */ (signal).deps || []) {
				if ((dep.f & DERIVED) === 0) {
					mutate(dep, null /* doesnt matter */);
				}
			}
		} else {
			mutate(signal, null /* doesnt matter */);
		}
	}
}

/**
 * Use `untrack` to prevent something from being treated as an `$effect`/`$derived` dependency.
 *
 * https://svelte-5-preview.vercel.app/docs/functions#untrack
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
	const previous_reaction = active_reaction;
	try {
		active_reaction = null;
		return fn();
	} finally {
		active_reaction = previous_reaction;
	}
}

const STATUS_MASK = -3585;

/**
 * @param {Signal} signal
 * @param {number} status
 * @returns {void}
 */
function set_signal_status(signal, status) {
	signal.f = (signal.f & STATUS_MASK) | status;
}

/**
 * @param {Record<string, unknown>} props
 * @param {any} runes
 * @param {Function} [fn]
 * @returns {void}
 */
function push(props, runes = false, fn) {
	component_context = {
		p: component_context,
		c: null,
		e: null,
		m: false,
		s: props,
		x: null,
		l: null
	};

	if (!runes) {
		component_context.l = {
			s: null,
			u: null,
			r1: [],
			r2: source(false)
		};
	}

	if (DEV) {
		// component function
		component_context.function = fn;
		dev_current_component_function = fn;
	}
}

/**
 * @template {Record<string, any>} T
 * @param {T} [component]
 * @returns {T}
 */
function pop(component) {
	const context_stack_item = component_context;
	if (context_stack_item !== null) {
		if (component !== undefined) {
			context_stack_item.x = component;
		}
		const component_effects = context_stack_item.e;
		if (component_effects !== null) {
			var previous_effect = active_effect;
			var previous_reaction = active_reaction;
			context_stack_item.e = null;
			try {
				for (var i = 0; i < component_effects.length; i++) {
					var component_effect = component_effects[i];
					set_active_effect(component_effect.effect);
					set_active_reaction(component_effect.reaction);
					effect(component_effect.fn);
				}
			} finally {
				set_active_effect(previous_effect);
				set_active_reaction(previous_reaction);
			}
		}
		component_context = context_stack_item.p;
		if (DEV) {
			dev_current_component_function = context_stack_item.p?.function ?? null;
		}
		context_stack_item.m = true;
	}
	// Micro-optimization: Don't set .a above to the empty object
	// so it can be garbage-collected when the return here is unused
	return component || /** @type {T} */ ({});
}

/**
 * Possibly traverse an object and read all its properties so that they're all reactive in case this is `$state`.
 * Does only check first level of an object for performance reasons (heuristic should be good for 99% of all cases).
 * @param {any} value
 * @returns {void}
 */
function deep_read_state(value) {
	if (typeof value !== 'object' || !value || value instanceof EventTarget) {
		return;
	}

	if (STATE_SYMBOL in value) {
		deep_read(value);
	} else if (!Array.isArray(value)) {
		for (let key in value) {
			const prop = value[key];
			if (typeof prop === 'object' && prop && STATE_SYMBOL in prop) {
				deep_read(prop);
			}
		}
	}
}

/**
 * Deeply traverse an object and read all its properties
 * so that they're all reactive in case this is `$state`
 * @param {any} value
 * @param {Set<any>} visited
 * @returns {void}
 */
function deep_read(value, visited = new Set()) {
	if (
		typeof value === 'object' &&
		value !== null &&
		// We don't want to traverse DOM elements
		!(value instanceof EventTarget) &&
		!visited.has(value)
	) {
		visited.add(value);
		// When working with a possible SvelteDate, this
		// will ensure we capture changes to it.
		if (value instanceof Date) {
			value.getTime();
		}
		for (let key in value) {
			try {
				deep_read(value[key], visited);
			} catch (e) {
				// continue
			}
		}
		const proto = get_prototype_of(value);
		if (
			proto !== Object.prototype &&
			proto !== Array.prototype &&
			proto !== Map.prototype &&
			proto !== Set.prototype &&
			proto !== Date.prototype
		) {
			const descriptors = get_descriptors(proto);
			for (let key in descriptors) {
				const get = descriptors[key].get;
				if (get) {
					try {
						get.call(value);
					} catch (e) {
						// continue
					}
				}
			}
		}
	}
}

if (DEV) {
	/**
	 * @param {string} rune
	 */
	function throw_rune_error(rune) {
		if (!(rune in globalThis)) {
			// TODO if people start adjusting the "this can contain runes" config through v-p-s more, adjust this message
			/** @type {any} */
			let value; // let's hope noone modifies this global, but belts and braces
			Object.defineProperty(globalThis, rune, {
				configurable: true,
				// eslint-disable-next-line getter-return
				get: () => {
					if (value !== undefined) {
						return value;
					}

					rune_outside_svelte(rune);
				},
				set: (v) => {
					value = v;
				}
			});
		}
	}

	throw_rune_error('$state');
	throw_rune_error('$effect');
	throw_rune_error('$derived');
	throw_rune_error('$inspect');
	throw_rune_error('$props');
	throw_rune_error('$bindable');
}

/** @import { Location } from 'locate-character' */

/** @type {Set<string>} */
const all_registered_events = new Set();

/** @type {Set<(events: Array<string>) => void>} */
const root_event_handles = new Set();

/**
 * @param {string} event_name
 * @param {EventTarget} dom
 * @param {EventListener} handler
 * @param {AddEventListenerOptions} options
 */
function create_event(event_name, dom, handler, options) {
	/**
	 * @this {EventTarget}
	 */
	function target_handler(/** @type {Event} */ event) {
		if (!options.capture) {
			// Only call in the bubble phase, else delegated events would be called before the capturing events
			handle_event_propagation.call(dom, event);
		}
		if (!event.cancelBubble) {
			return handler.call(this, event);
		}
	}

	// Chrome has a bug where pointer events don't work when attached to a DOM element that has been cloned
	// with cloneNode() and the DOM element is disconnected from the document. To ensure the event works, we
	// defer the attachment till after it's been appended to the document. TODO: remove this once Chrome fixes
	// this bug. The same applies to wheel events and touch events.
	if (
		event_name.startsWith('pointer') ||
		event_name.startsWith('touch') ||
		event_name === 'wheel'
	) {
		queue_micro_task(() => {
			dom.addEventListener(event_name, target_handler, options);
		});
	} else {
		dom.addEventListener(event_name, target_handler, options);
	}

	return target_handler;
}

/**
 * @param {string} event_name
 * @param {Element} dom
 * @param {EventListener} handler
 * @param {boolean} capture
 * @param {boolean} [passive]
 * @returns {void}
 */
function event(event_name, dom, handler, capture, passive) {
	var options = { capture, passive };
	var target_handler = create_event(event_name, dom, handler, options);

	// @ts-ignore
	if (dom === document.body || dom === window || dom === document) {
		teardown(() => {
			dom.removeEventListener(event_name, target_handler, options);
		});
	}
}

/**
 * @this {EventTarget}
 * @param {Event} event
 * @returns {void}
 */
function handle_event_propagation(event) {
	var handler_element = this;
	var owner_document = /** @type {Node} */ (handler_element).ownerDocument;
	var event_name = event.type;
	var path = event.composedPath?.() || [];
	var current_target = /** @type {null | Element} */ (path[0] || event.target);

	// composedPath contains list of nodes the event has propagated through.
	// We check __root to skip all nodes below it in case this is a
	// parent of the __root node, which indicates that there's nested
	// mounted apps. In this case we don't want to trigger events multiple times.
	var path_idx = 0;

	// @ts-expect-error is added below
	var handled_at = event.__root;

	if (handled_at) {
		var at_idx = path.indexOf(handled_at);
		if (
			at_idx !== -1 &&
			(handler_element === document || handler_element === /** @type {any} */ (window))
		) {
			// This is the fallback document listener or a window listener, but the event was already handled
			// -> ignore, but set handle_at to document/window so that we're resetting the event
			// chain in case someone manually dispatches the same event object again.
			// @ts-expect-error
			event.__root = handler_element;
			return;
		}

		// We're deliberately not skipping if the index is higher, because
		// someone could create an event programmatically and emit it multiple times,
		// in which case we want to handle the whole propagation chain properly each time.
		// (this will only be a false negative if the event is dispatched multiple times and
		// the fallback document listener isn't reached in between, but that's super rare)
		var handler_idx = path.indexOf(handler_element);
		if (handler_idx === -1) {
			// handle_idx can theoretically be -1 (happened in some JSDOM testing scenarios with an event listener on the window object)
			// so guard against that, too, and assume that everything was handled at this point.
			return;
		}

		if (at_idx <= handler_idx) {
			path_idx = at_idx;
		}
	}

	current_target = /** @type {Element} */ (path[path_idx] || event.target);
	// there can only be one delegated event per element, and we either already handled the current target,
	// or this is the very first target in the chain which has a non-delegated listener, in which case it's safe
	// to handle a possible delegated event on it later (through the root delegation listener for example).
	if (current_target === handler_element) return;

	// Proxy currentTarget to correct target
	define_property(event, 'currentTarget', {
		configurable: true,
		get() {
			return current_target || owner_document;
		}
	});

	try {
		/**
		 * @type {unknown}
		 */
		var throw_error;
		/**
		 * @type {unknown[]}
		 */
		var other_errors = [];

		while (current_target !== null) {
			/** @type {null | Element} */
			var parent_element =
				current_target.assignedSlot ||
				current_target.parentNode ||
				/** @type {any} */ (current_target).host ||
				null;

			try {
				// @ts-expect-error
				var delegated = current_target['__' + event_name];

				if (delegated !== undefined && !(/** @type {any} */ (current_target).disabled)) {
					if (is_array(delegated)) {
						var [fn, ...data] = delegated;
						fn.apply(current_target, [event, ...data]);
					} else {
						delegated.call(current_target, event);
					}
				}
			} catch (error) {
				if (throw_error) {
					other_errors.push(error);
				} else {
					throw_error = error;
				}
			}
			if (event.cancelBubble || parent_element === handler_element || parent_element === null) {
				break;
			}
			current_target = parent_element;
		}

		if (throw_error) {
			for (let error of other_errors) {
				// Throw the rest of the errors, one-by-one on a microtask
				queueMicrotask(() => {
					throw error;
				});
			}
			throw throw_error;
		}
	} finally {
		// @ts-expect-error is used above
		event.__root = handler_element;
		// @ts-ignore remove proxy on currentTarget
		delete event.currentTarget;
	}
}

/** @param {string} html */
function create_fragment_from_html(html) {
	var elem = document.createElement('template');
	elem.innerHTML = html;
	return elem.content;
}

/** @import { Effect, TemplateNode } from '#client' */

/**
 * @param {TemplateNode} start
 * @param {TemplateNode | null} end
 */
function assign_nodes(start, end) {
	var effect = /** @type {Effect} */ (active_effect);
	if (effect.nodes_start === null) {
		effect.nodes_start = start;
		effect.nodes_end = end;
	}
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
function template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

	/** @type {Node} */
	var node;

	/**
	 * Whether or not the first item is a text/element node. If not, we need to
	 * create an additional comment node to act as `effect.nodes.start`
	 */
	var has_start = !content.startsWith('<!>');

	return () => {

		if (node === undefined) {
			node = create_fragment_from_html(has_start ? content : '<!>' + content);
			if (!is_fragment) node = /** @type {Node} */ (get_first_child(node));
		}

		var clone = /** @type {TemplateNode} */ (
			use_import_node ? document.importNode(node, true) : node.cloneNode(true)
		);

		if (is_fragment) {
			var start = /** @type {TemplateNode} */ (get_first_child(clone));
			var end = /** @type {TemplateNode} */ (clone.lastChild);

			assign_nodes(start, end);
		} else {
			assign_nodes(clone, clone);
		}

		return clone;
	};
}

function comment$1() {

	var frag = document.createDocumentFragment();
	var start = document.createComment('');
	var anchor = create_text();
	frag.append(start, anchor);

	assign_nodes(start, anchor);

	return frag;
}

/**
 * Assign the created (or in hydration mode, traversed) dom elements to the current block
 * and insert the elements into the dom (in client mode).
 * @param {Text | Comment | Element} anchor
 * @param {DocumentFragment | Element} dom
 */
function append(anchor, dom) {

	if (anchor === null) {
		// edge case — void `<svelte:element>` with content
		return;
	}

	anchor.before(/** @type {Node} */ (dom));
}

/**
 * Subset of delegated events which should be passive by default.
 * These two are already passive via browser defaults on window, document and body.
 * But since
 * - we're delegating them
 * - they happen often
 * - they apply to mobile which is generally less performant
 * we're marking them as passive by default for other elements, too.
 */
const PASSIVE_EVENTS = ['touchstart', 'touchmove'];

/**
 * Returns `true` if `name` is a passive event
 * @param {string} name
 */
function is_passive_event(name) {
	return PASSIVE_EVENTS.includes(name);
}

/** @import { ComponentContext, Effect, TemplateNode } from '#client' */
/** @import { Component, ComponentType, SvelteComponent } from '../../index.js' */

/**
 * @param {Element} text
 * @param {string} value
 * @returns {void}
 */
function set_text(text, value) {
	// For objects, we apply string coercion (which might make things like $state array references in the template reactive) before diffing
	var str = value == null ? '' : typeof value === 'object' ? value + '' : value;
	// @ts-expect-error
	if (str !== (text.__t ??= text.nodeValue)) {
		// @ts-expect-error
		text.__t = str;
		text.nodeValue = str == null ? '' : str + '';
	}
}

/**
 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
 * Transitions will play during the initial render unless the `intro` option is set to `false`.
 *
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
 * @param {{} extends Props ? {
 * 		target: Document | Element | ShadowRoot;
 * 		anchor?: Node;
 * 		props?: Props;
 * 		events?: Record<string, (e: any) => any>;
 * 		context?: Map<any, any>;
 * 		intro?: boolean;
 * 	}: {
 * 		target: Document | Element | ShadowRoot;
 * 		props: Props;
 * 		anchor?: Node;
 * 		events?: Record<string, (e: any) => any>;
 * 		context?: Map<any, any>;
 * 		intro?: boolean;
 * 	}} options
 * @returns {Exports}
 */
function mount(component, options) {
	return _mount(component, options);
}

/** @type {Map<string, number>} */
const document_listeners = new Map();

/**
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
 * @param {{
 * 		target: Document | Element | ShadowRoot;
 * 		anchor?: Node;
 * 		props?: any;
 * 		events?: any;
 * 		context?: Map<any, any>;
 * 		intro?: boolean;
 * 	}} options
 * @returns {Exports}
 */
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
	init_operations();

	var registered_events = new Set();

	/** @param {Array<string>} events */
	var event_handle = (events) => {
		for (var i = 0; i < events.length; i++) {
			var event_name = events[i];

			if (registered_events.has(event_name)) continue;
			registered_events.add(event_name);

			var passive = is_passive_event(event_name);

			// Add the event listener to both the container and the document.
			// The container listener ensures we catch events from within in case
			// the outer content stops propagation of the event.
			target.addEventListener(event_name, handle_event_propagation, { passive });

			var n = document_listeners.get(event_name);

			if (n === undefined) {
				// The document listener ensures we catch events that originate from elements that were
				// manually moved outside of the container (e.g. via manual portals).
				document.addEventListener(event_name, handle_event_propagation, { passive });
				document_listeners.set(event_name, 1);
			} else {
				document_listeners.set(event_name, n + 1);
			}
		}
	};

	event_handle(array_from(all_registered_events));
	root_event_handles.add(event_handle);

	/** @type {Exports} */
	// @ts-expect-error will be defined because the render effect runs synchronously
	var component = undefined;

	var unmount = effect_root(() => {
		var anchor_node = anchor ?? target.appendChild(create_text());

		branch(() => {
			if (context) {
				push({});
				var ctx = /** @type {ComponentContext} */ (component_context);
				ctx.c = context;
			}

			if (events) {
				// We can't spread the object or else we'd lose the state proxy stuff, if it is one
				/** @type {any} */ (props).$$events = events;
			}
			// @ts-expect-error the public typings are not what the actual function looks like
			component = Component(anchor_node, props) || {};

			if (context) {
				pop();
			}
		});

		return () => {
			for (var event_name of registered_events) {
				target.removeEventListener(event_name, handle_event_propagation);

				var n = /** @type {number} */ (document_listeners.get(event_name));

				if (--n === 0) {
					document.removeEventListener(event_name, handle_event_propagation);
					document_listeners.delete(event_name);
				} else {
					document_listeners.set(event_name, n);
				}
			}

			root_event_handles.delete(event_handle);
			mounted_components.delete(component);
			if (anchor_node !== anchor) {
				anchor_node.parentNode?.removeChild(anchor_node);
			}
		};
	});

	mounted_components.set(component, unmount);
	return component;
}

/**
 * References of the components that were mounted or hydrated.
 * Uses a `WeakMap` to avoid memory leaks.
 */
let mounted_components = new WeakMap();

/** @import { Effect, TemplateNode } from '#client' */

/**
 * @param {TemplateNode} node
 * @param {() => boolean} get_condition
 * @param {(anchor: Node) => void} consequent_fn
 * @param {null | ((anchor: Node) => void)} [alternate_fn]
 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
 * @returns {void}
 */
function if_block(node, get_condition, consequent_fn, alternate_fn = null, elseif = false) {

	var anchor = node;

	/** @type {Effect | null} */
	var consequent_effect = null;

	/** @type {Effect | null} */
	var alternate_effect = null;

	/** @type {boolean | null} */
	var condition = null;

	var flags = elseif ? EFFECT_TRANSPARENT : 0;

	block$1(() => {
		if (condition === (condition = !!get_condition())) return;

		if (condition) {
			if (consequent_effect) {
				resume_effect(consequent_effect);
			} else {
				consequent_effect = branch(() => consequent_fn(anchor));
			}

			if (alternate_effect) {
				pause_effect(alternate_effect, () => {
					alternate_effect = null;
				});
			}
		} else {
			if (alternate_effect) {
				resume_effect(alternate_effect);
			} else if (alternate_fn) {
				alternate_effect = branch(() => alternate_fn(anchor));
			}

			if (consequent_effect) {
				pause_effect(consequent_effect, () => {
					consequent_effect = null;
				});
			}
		}
	}, flags);
}

/** @import { EachItem, EachState, Effect, MaybeSource, Source, TemplateNode, TransitionManager, Value } from '#client' */

/**
 * The row of a keyed each block that is currently updating. We track this
 * so that `animate:` directives have something to attach themselves to
 * @type {EachItem | null}
 */
let current_each_item = null;

/**
 * @param {any} _
 * @param {number} i
 */
function index(_, i) {
	return i;
}

/**
 * Pause multiple effects simultaneously, and coordinate their
 * subsequent destruction. Used in each blocks
 * @param {EachState} state
 * @param {EachItem[]} items
 * @param {null | Node} controlled_anchor
 * @param {Map<any, EachItem>} items_map
 */
function pause_effects(state, items, controlled_anchor, items_map) {
	/** @type {TransitionManager[]} */
	var transitions = [];
	var length = items.length;

	for (var i = 0; i < length; i++) {
		pause_children(items[i].e, transitions, true);
	}

	var is_controlled = length > 0 && transitions.length === 0 && controlled_anchor !== null;
	// If we have a controlled anchor, it means that the each block is inside a single
	// DOM element, so we can apply a fast-path for clearing the contents of the element.
	if (is_controlled) {
		var parent_node = /** @type {Element} */ (
			/** @type {Element} */ (controlled_anchor).parentNode
		);
		clear_text_content(parent_node);
		parent_node.append(/** @type {Element} */ (controlled_anchor));
		items_map.clear();
		link$1(state, items[0].prev, items[length - 1].next);
	}

	run_out_transitions(transitions, () => {
		for (var i = 0; i < length; i++) {
			var item = items[i];
			if (!is_controlled) {
				items_map.delete(item.k);
				link$1(state, item.prev, item.next);
			}
			destroy_effect(item.e, !is_controlled);
		}
	});
}

/**
 * @template V
 * @param {Element | Comment} node The next sibling node, or the parent node if this is a 'controlled' block
 * @param {number} flags
 * @param {() => V[]} get_collection
 * @param {(value: V, index: number) => any} get_key
 * @param {(anchor: Node, item: MaybeSource<V>, index: MaybeSource<number>) => void} render_fn
 * @param {null | ((anchor: Node) => void)} fallback_fn
 * @returns {void}
 */
function each(node, flags, get_collection, get_key, render_fn, fallback_fn = null) {
	var anchor = node;

	/** @type {EachState} */
	var state = { flags, items: new Map(), first: null };

	var is_controlled = (flags & EACH_IS_CONTROLLED) !== 0;

	if (is_controlled) {
		var parent_node = /** @type {Element} */ (node);

		anchor = parent_node.appendChild(create_text());
	}

	/** @type {Effect | null} */
	var fallback = null;

	var was_empty = false;

	block$1(() => {
		var collection = get_collection();

		var array = is_array(collection)
			? collection
			: collection == null
				? []
				: array_from(collection);

		var length = array.length;

		if (was_empty && length === 0) {
			// ignore updates if the array is empty,
			// and it already was empty on previous run
			return;
		}
		was_empty = length === 0;

		{
			reconcile(array, state, anchor, render_fn, flags, get_key);
		}

		if (fallback_fn !== null) {
			if (length === 0) {
				if (fallback) {
					resume_effect(fallback);
				} else {
					fallback = branch(() => fallback_fn(anchor));
				}
			} else if (fallback !== null) {
				pause_effect(fallback, () => {
					fallback = null;
				});
			}
		}

		// When we mount the each block for the first time, the collection won't be
		// connected to this effect as the effect hasn't finished running yet and its deps
		// won't be assigned. However, it's possible that when reconciling the each block
		// that a mutation occurred and it's made the collection MAYBE_DIRTY, so reading the
		// collection again can provide consistency to the reactive graph again as the deriveds
		// will now be `CLEAN`.
		get_collection();
	});
}

/**
 * Add, remove, or reorder items output by an each block as its input changes
 * @template V
 * @param {Array<V>} array
 * @param {EachState} state
 * @param {Element | Comment | Text} anchor
 * @param {(anchor: Node, item: MaybeSource<V>, index: number | Source<number>) => void} render_fn
 * @param {number} flags
 * @param {(value: V, index: number) => any} get_key
 * @returns {void}
 */
function reconcile(array, state, anchor, render_fn, flags, get_key) {
	var is_animated = (flags & EACH_IS_ANIMATED) !== 0;
	var should_update = (flags & (EACH_ITEM_REACTIVE | EACH_INDEX_REACTIVE)) !== 0;

	var length = array.length;
	var items = state.items;
	var first = state.first;
	var current = first;

	/** @type {undefined | Set<EachItem>} */
	var seen;

	/** @type {EachItem | null} */
	var prev = null;

	/** @type {undefined | Set<EachItem>} */
	var to_animate;

	/** @type {EachItem[]} */
	var matched = [];

	/** @type {EachItem[]} */
	var stashed = [];

	/** @type {V} */
	var value;

	/** @type {any} */
	var key;

	/** @type {EachItem | undefined} */
	var item;

	/** @type {number} */
	var i;

	if (is_animated) {
		for (i = 0; i < length; i += 1) {
			value = array[i];
			key = get_key(value, i);
			item = items.get(key);

			if (item !== undefined) {
				item.a?.measure();
				(to_animate ??= new Set()).add(item);
			}
		}
	}

	for (i = 0; i < length; i += 1) {
		value = array[i];
		key = get_key(value, i);
		item = items.get(key);

		if (item === undefined) {
			var child_anchor = current ? /** @type {TemplateNode} */ (current.e.nodes_start) : anchor;

			prev = create_item(
				child_anchor,
				state,
				prev,
				prev === null ? state.first : prev.next,
				value,
				key,
				i,
				render_fn,
				flags
			);

			items.set(key, prev);

			matched = [];
			stashed = [];

			current = prev.next;
			continue;
		}

		if (should_update) {
			update_item(item, value, i, flags);
		}

		if ((item.e.f & INERT) !== 0) {
			resume_effect(item.e);
			if (is_animated) {
				item.a?.unfix();
				(to_animate ??= new Set()).delete(item);
			}
		}

		if (item !== current) {
			if (seen !== undefined && seen.has(item)) {
				if (matched.length < stashed.length) {
					// more efficient to move later items to the front
					var start = stashed[0];
					var j;

					prev = start.prev;

					var a = matched[0];
					var b = matched[matched.length - 1];

					for (j = 0; j < matched.length; j += 1) {
						move(matched[j], start, anchor);
					}

					for (j = 0; j < stashed.length; j += 1) {
						seen.delete(stashed[j]);
					}

					link$1(state, a.prev, b.next);
					link$1(state, prev, a);
					link$1(state, b, start);

					current = start;
					prev = b;
					i -= 1;

					matched = [];
					stashed = [];
				} else {
					// more efficient to move earlier items to the back
					seen.delete(item);
					move(item, current, anchor);

					link$1(state, item.prev, item.next);
					link$1(state, item, prev === null ? state.first : prev.next);
					link$1(state, prev, item);

					prev = item;
				}

				continue;
			}

			matched = [];
			stashed = [];

			while (current !== null && current.k !== key) {
				// If the item has an effect that is already inert, skip over adding it
				// to our seen Set as the item is already being handled
				if ((current.e.f & INERT) === 0) {
					(seen ??= new Set()).add(current);
				}
				stashed.push(current);
				current = current.next;
			}

			if (current === null) {
				continue;
			}

			item = current;
		}

		matched.push(item);
		prev = item;
		current = item.next;
	}

	if (current !== null || seen !== undefined) {
		var to_destroy = seen === undefined ? [] : array_from(seen);

		while (current !== null) {
			// Inert effects are currently outroing and will be removed once the transition is finished
			if ((current.e.f & INERT) === 0) {
				to_destroy.push(current);
			}
			current = current.next;
		}

		var destroy_length = to_destroy.length;

		if (destroy_length > 0) {
			var controlled_anchor = (flags & EACH_IS_CONTROLLED) !== 0 && length === 0 ? anchor : null;

			if (is_animated) {
				for (i = 0; i < destroy_length; i += 1) {
					to_destroy[i].a?.measure();
				}

				for (i = 0; i < destroy_length; i += 1) {
					to_destroy[i].a?.fix();
				}
			}

			pause_effects(state, to_destroy, controlled_anchor, items);
		}
	}

	if (is_animated) {
		queue_micro_task(() => {
			if (to_animate === undefined) return;
			for (item of to_animate) {
				item.a?.apply();
			}
		});
	}

	/** @type {Effect} */ (active_effect).first = state.first && state.first.e;
	/** @type {Effect} */ (active_effect).last = prev && prev.e;
}

/**
 * @param {EachItem} item
 * @param {any} value
 * @param {number} index
 * @param {number} type
 * @returns {void}
 */
function update_item(item, value, index, type) {
	if ((type & EACH_ITEM_REACTIVE) !== 0) {
		internal_set(item.v, value);
	}

	if ((type & EACH_INDEX_REACTIVE) !== 0) {
		internal_set(/** @type {Value<number>} */ (item.i), index);
	} else {
		item.i = index;
	}
}

/**
 * @template V
 * @param {Node} anchor
 * @param {EachState} state
 * @param {EachItem | null} prev
 * @param {EachItem | null} next
 * @param {V} value
 * @param {unknown} key
 * @param {number} index
 * @param {(anchor: Node, item: V | Source<V>, index: number | Value<number>) => void} render_fn
 * @param {number} flags
 * @returns {EachItem}
 */
function create_item(anchor, state, prev, next, value, key, index, render_fn, flags) {
	var previous_each_item = current_each_item;

	try {
		var reactive = (flags & EACH_ITEM_REACTIVE) !== 0;
		var mutable = (flags & EACH_ITEM_IMMUTABLE) === 0;

		var v = reactive ? (mutable ? mutable_source(value) : source(value)) : value;
		var i = (flags & EACH_INDEX_REACTIVE) === 0 ? index : source(index);

		/** @type {EachItem} */
		var item = {
			i,
			v,
			k: key,
			a: null,
			// @ts-expect-error
			e: null,
			prev,
			next
		};

		current_each_item = item;
		item.e = branch(() => render_fn(anchor, v, i), hydrating);

		item.e.prev = prev && prev.e;
		item.e.next = next && next.e;

		if (prev === null) {
			state.first = item;
		} else {
			prev.next = item;
			prev.e.next = item.e;
		}

		if (next !== null) {
			next.prev = item;
			next.e.prev = item.e;
		}

		return item;
	} finally {
		current_each_item = previous_each_item;
	}
}

/**
 * @param {EachItem} item
 * @param {EachItem | null} next
 * @param {Text | Element | Comment} anchor
 */
function move(item, next, anchor) {
	var end = item.next ? /** @type {TemplateNode} */ (item.next.e.nodes_start) : anchor;

	var dest = next ? /** @type {TemplateNode} */ (next.e.nodes_start) : anchor;
	var node = /** @type {TemplateNode} */ (item.e.nodes_start);

	while (node !== end) {
		var next_node = /** @type {TemplateNode} */ (get_next_sibling(node));
		dest.before(node);
		node = next_node;
	}
}

/**
 * @param {EachState} state
 * @param {EachItem | null} prev
 * @param {EachItem | null} next
 */
function link$1(state, prev, next) {
	if (prev === null) {
		state.first = next;
	} else {
		prev.next = next;
		prev.e.next = next && next.e;
	}

	if (next !== null) {
		next.prev = prev;
		next.e.prev = prev && prev.e;
	}
}

/** @import { Effect, TemplateNode } from '#client' */

/**
 * @param {Element | Text | Comment} node
 * @param {() => string} get_value
 * @param {boolean} svg
 * @param {boolean} mathml
 * @param {boolean} [skip_warning]
 * @returns {void}
 */
function html(node, get_value, svg, mathml, skip_warning) {
	var anchor = node;

	var value = '';

	/** @type {Effect | undefined} */
	var effect;

	block$1(() => {
		if (value === (value = get_value() ?? '')) {
			return;
		}

		if (effect !== undefined) {
			destroy_effect(effect);
			effect = undefined;
		}

		if (value === '') return;

		effect = branch(() => {

			var html = value + '';

			// Don't use create_fragment_with_script_from_html here because that would mean script tags are executed.
			// @html is basically `.innerHTML = ...` and that doesn't execute scripts either due to security reasons.
			/** @type {DocumentFragment | Element} */
			var node = create_fragment_from_html(html);

			assign_nodes(
				/** @type {TemplateNode} */ (get_first_child(node)),
				/** @type {TemplateNode} */ (node.lastChild)
			);

			{
				anchor.before(node);
			}
		});
	});
}

/**
 * @param {Comment} anchor
 * @param {Record<string, any>} $$props
 * @param {string} name
 * @param {Record<string, unknown>} slot_props
 * @param {null | ((anchor: Comment) => void)} fallback_fn
 */
function slot(anchor, $$props, name, slot_props, fallback_fn) {

	var slot_fn = $$props.$$slots?.[name];
	// Interop: Can use snippets to fill slots
	var is_interop = false;
	if (slot_fn === true) {
		slot_fn = $$props['children' ];
		is_interop = true;
	}

	if (slot_fn === undefined) ; else {
		slot_fn(anchor, is_interop ? () => slot_props : slot_props);
	}
}

/** @import { TemplateNode, Dom, Effect } from '#client' */

/**
 * @template P
 * @template {(props: P) => void} C
 * @param {TemplateNode} node
 * @param {() => C} get_component
 * @param {(anchor: TemplateNode, component: C) => Dom | void} render_fn
 * @returns {void}
 */
function component(node, get_component, render_fn) {

	var anchor = node;

	/** @type {C} */
	var component;

	/** @type {Effect | null} */
	var effect;

	block$1(() => {
		if (component === (component = get_component())) return;

		if (effect) {
			pause_effect(effect);
			effect = null;
		}

		if (component) {
			effect = branch(() => render_fn(anchor, component));
		}
	}, EFFECT_TRANSPARENT);
}

let listening_to_form_reset = false;

function add_form_reset_listener() {
	if (!listening_to_form_reset) {
		listening_to_form_reset = true;
		document.addEventListener(
			'reset',
			(evt) => {
				// Needs to happen one tick later or else the dom properties of the form
				// elements have not updated to their reset values yet
				Promise.resolve().then(() => {
					if (!evt.defaultPrevented) {
						for (const e of /**@type {HTMLFormElement} */ (evt.target).elements) {
							// @ts-expect-error
							e.__on_r?.();
						}
					}
				});
			},
			// In the capture phase to guarantee we get noticed of it (no possiblity of stopPropagation)
			{ capture: true }
		);
	}
}

/**
 * @param {Element} element
 * @param {boolean} checked
 */
function set_checked(element, checked) {
	// @ts-expect-error
	var attributes = (element.__attributes ??= {});

	if (attributes.checked === (attributes.checked = checked)) return;
	// @ts-expect-error
	element.checked = checked;
}

/**
 * @param {Element} element
 * @param {string} attribute
 * @param {string | null} value
 * @param {boolean} [skip_warning]
 */
function set_attribute(element, attribute, value, skip_warning) {
	// @ts-expect-error
	var attributes = (element.__attributes ??= {});

	if (attributes[attribute] === (attributes[attribute] = value)) return;

	if (attribute === 'loading') {
		// @ts-expect-error
		element[LOADING_ATTR_SYMBOL] = value;
	}

	if (value == null) {
		element.removeAttribute(attribute);
	} else if (typeof value !== 'string' && get_setters(element).includes(attribute)) {
		// @ts-ignore
		element[attribute] = value;
	} else {
		element.setAttribute(attribute, value);
	}
}

/** @type {Map<string, string[]>} */
var setters_cache = new Map();

/** @param {Element} element */
function get_setters(element) {
	var setters = setters_cache.get(element.nodeName);
	if (setters) return setters;
	setters_cache.set(element.nodeName, (setters = []));
	var descriptors;
	var proto = get_prototype_of(element);

	// Stop at Element, from there on there's only unnecessary setters we're not interested in
	while (proto.constructor.name !== 'Element') {
		descriptors = get_descriptors(proto);

		for (var key in descriptors) {
			if (descriptors[key].set) {
				setters.push(key);
			}
		}

		proto = get_prototype_of(proto);
	}

	return setters;
}

/**
 * @param {HTMLElement} dom
 * @param {string} value
 * @returns {void}
 */
function set_class(dom, value) {
	// @ts-expect-error need to add __className to patched prototype
	var prev_class_name = dom.__className;
	var next_class_name = to_class(value);

	if (
		prev_class_name !== next_class_name ||
		(hydrating)
	) {
		// Removing the attribute when the value is only an empty string causes
		// peformance issues vs simply making the className an empty string. So
		// we should only remove the class if the the value is nullish.
		if (value == null) {
			dom.removeAttribute('class');
		} else {
			dom.className = next_class_name;
		}

		// @ts-expect-error need to add __className to patched prototype
		dom.__className = next_class_name;
	}
}

/**
 * @template V
 * @param {V} value
 * @returns {string | V}
 */
function to_class(value) {
	return value == null ? '' : value;
}

/**
 * @param {Element} dom
 * @param {string} class_name
 * @param {boolean} value
 * @returns {void}
 */
function toggle_class(dom, class_name, value) {
	if (value) {
		if (dom.classList.contains(class_name)) return;
		dom.classList.add(class_name);
	} else {
		if (!dom.classList.contains(class_name)) return;
		dom.classList.remove(class_name);
	}
}

/**
 * Listen to the given event, and then instantiate a global form reset listener if not already done,
 * to notify all bindings when the form is reset
 * @param {HTMLElement} element
 * @param {string} event
 * @param {() => void} handler
 * @param {() => void} [on_reset]
 */
function listen_to_event_and_reset_event(element, event, handler, on_reset = handler) {
	element.addEventListener(event, handler);
	// @ts-expect-error
	const prev = element.__on_r;
	if (prev) {
		// special case for checkbox that can have multiple binds (group & checked)
		// @ts-expect-error
		element.__on_r = () => {
			prev();
			on_reset();
		};
	} else {
		// @ts-expect-error
		element.__on_r = on_reset;
	}

	add_form_reset_listener();
}

/**
 * @param {HTMLInputElement} input
 * @param {() => unknown} get
 * @param {(value: unknown) => void} set
 * @returns {void}
 */
function bind_value(input, get, set = get) {
	var runes = is_runes();

	listen_to_event_and_reset_event(input, 'input', () => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		/** @type {unknown} */
		var value = is_numberlike_input(input) ? to_number(input.value) : input.value;
		set(value);

		// In runes mode, respect any validation in accessors (doesn't apply in legacy mode,
		// because we use mutable state which ensures the render effect always runs)
		if (runes && value !== (value = get())) {
			// @ts-expect-error the value is coerced on assignment
			input.value = value ?? '';
		}
	});

	render_effect(() => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		var value = get();

		if (is_numberlike_input(input) && value === to_number(input.value)) {
			// handles 0 vs 00 case (see https://github.com/sveltejs/svelte/issues/9959)
			return;
		}

		if (input.type === 'date' && !value && !input.value) {
			// Handles the case where a temporarily invalid date is set (while typing, for example with a leading 0 for the day)
			// and prevents this state from clearing the other parts of the date input (see https://github.com/sveltejs/svelte/issues/7897)
			return;
		}

		// don't set the value of the input if it's the same to allow
		// minlength to work properly
		if (value !== input.value) {
			// @ts-expect-error the value is coerced on assignment
			input.value = value ?? '';
		}
	});
}

/**
 * @param {HTMLInputElement} input
 * @param {() => unknown} get
 * @param {(value: unknown) => void} set
 * @returns {void}
 */
function bind_checked(input, get, set = get) {
	listen_to_event_and_reset_event(input, 'change', () => {
		var value = input.checked;
		set(value);
	});

	if (get() == undefined) {
		set(false);
	}

	render_effect(() => {
		var value = get();
		input.checked = Boolean(value);
	});
}

/**
 * @param {HTMLInputElement} input
 */
function is_numberlike_input(input) {
	var type = input.type;
	return type === 'number' || type === 'range';
}

/**
 * @param {string} value
 */
function to_number(value) {
	return value === '' ? null : +value;
}

/**
 * Makes an `export`ed (non-prop) variable available on the `$$props` object
 * so that consumers can do `bind:x` on the component.
 * @template V
 * @param {Record<string, unknown>} props
 * @param {string} prop
 * @param {V} value
 * @returns {void}
 */
function bind_prop(props, prop, value) {
	var desc = get_descriptor(props, prop);

	if (desc && desc.set) {
		props[prop] = value;
		teardown(() => {
			props[prop] = null;
		});
	}
}

/**
 * Selects the correct option(s) (depending on whether this is a multiple select)
 * @template V
 * @param {HTMLSelectElement} select
 * @param {V} value
 * @param {boolean} [mounting]
 */
function select_option(select, value, mounting) {
	if (select.multiple) {
		return select_options(select, value);
	}

	for (var option of select.options) {
		var option_value = get_option_value(option);
		if (is(option_value, value)) {
			option.selected = true;
			return;
		}
	}

	if (!mounting || value !== undefined) {
		select.selectedIndex = -1; // no option should be selected
	}
}

/**
 * Selects the correct option(s) if `value` is given,
 * and then sets up a mutation observer to sync the
 * current selection to the dom when it changes. Such
 * changes could for example occur when options are
 * inside an `#each` block.
 * @template V
 * @param {HTMLSelectElement} select
 * @param {() => V} [get_value]
 */
function init_select(select, get_value) {
	effect(() => {

		var observer = new MutationObserver(() => {
			// @ts-ignore
			var value = select.__value;
			select_option(select, value);
			// Deliberately don't update the potential binding value,
			// the model should be preserved unless explicitly changed
		});

		observer.observe(select, {
			// Listen to option element changes
			childList: true,
			subtree: true, // because of <optgroup>
			// Listen to option element value attribute changes
			// (doesn't get notified of select value changes,
			// because that property is not reflected as an attribute)
			attributes: true,
			attributeFilter: ['value']
		});

		return () => {
			observer.disconnect();
		};
	});
}

/**
 * @param {HTMLSelectElement} select
 * @param {() => unknown} get
 * @param {(value: unknown) => void} set
 * @returns {void}
 */
function bind_select_value(select, get, set = get) {
	var mounting = true;

	listen_to_event_and_reset_event(select, 'change', () => {
		/** @type {unknown} */
		var value;

		if (select.multiple) {
			value = [].map.call(select.querySelectorAll(':checked'), get_option_value);
		} else {
			/** @type {HTMLOptionElement | null} */
			var selected_option = select.querySelector(':checked');
			value = selected_option && get_option_value(selected_option);
		}

		set(value);
	});

	// Needs to be an effect, not a render_effect, so that in case of each loops the logic runs after the each block has updated
	effect(() => {
		var value = get();
		select_option(select, value, mounting);

		// Mounting and value undefined -> take selection from dom
		if (mounting && value === undefined) {
			/** @type {HTMLOptionElement | null} */
			var selected_option = select.querySelector(':checked');
			if (selected_option !== null) {
				value = get_option_value(selected_option);
				set(value);
			}
		}

		// @ts-ignore
		select.__value = value;
		mounting = false;
	});

	// don't pass get_value, we already initialize it in the effect above
	init_select(select);
}

/**
 * @template V
 * @param {HTMLSelectElement} select
 * @param {V} value
 */
function select_options(select, value) {
	for (var option of select.options) {
		// @ts-ignore
		option.selected = ~value.indexOf(get_option_value(option));
	}
}

/** @param {HTMLOptionElement} option */
function get_option_value(option) {
	// __value only exists if the <option> has a value attribute
	if ('__value' in option) {
		return option.__value;
	} else {
		return option.value;
	}
}

/**
 * @param {any} bound_value
 * @param {Element} element_or_component
 * @returns {boolean}
 */
function is_bound_this(bound_value, element_or_component) {
	return (
		bound_value === element_or_component || bound_value?.[STATE_SYMBOL] === element_or_component
	);
}

/**
 * @param {any} element_or_component
 * @param {(value: unknown, ...parts: unknown[]) => void} update
 * @param {(...parts: unknown[]) => unknown} get_value
 * @param {() => unknown[]} [get_parts] Set if the this binding is used inside an each block,
 * 										returns all the parts of the each block context that are used in the expression
 * @returns {void}
 */
function bind_this(element_or_component = {}, update, get_value, get_parts) {
	effect(() => {
		/** @type {unknown[]} */
		var old_parts;

		/** @type {unknown[]} */
		var parts;

		render_effect(() => {
			old_parts = parts;
			// We only track changes to the parts, not the value itself to avoid unnecessary reruns.
			parts = [];

			untrack(() => {
				if (element_or_component !== get_value(...parts)) {
					update(element_or_component, ...parts);
					// If this is an effect rerun (cause: each block context changes), then nullfiy the binding at
					// the previous position if it isn't already taken over by a different effect.
					if (old_parts && is_bound_this(get_value(...old_parts), element_or_component)) {
						update(null, ...old_parts);
					}
				}
			});
		});

		return () => {
			// We cannot use effects in the teardown phase, we we use a microtask instead.
			queue_micro_task(() => {
				if (parts && is_bound_this(get_value(...parts), element_or_component)) {
					update(null, ...parts);
				}
			});
		};
	});

	return element_or_component;
}

/** @import { ActionReturn } from 'svelte/action' */

/**
 * Substitute for the `stopPropagation` event modifier
 * @deprecated
 * @param {(event: Event, ...args: Array<unknown>) => void} fn
 * @returns {(event: Event, ...args: unknown[]) => void}
 */
function stopPropagation(fn) {
	return function (...args) {
		var event = /** @type {Event} */ (args[0]);
		event.stopPropagation();
		// @ts-ignore
		return fn?.apply(this, args);
	};
}

/**
 * Substitute for the `preventDefault` event modifier
 * @deprecated
 * @param {(event: Event, ...args: Array<unknown>) => void} fn
 * @returns {(event: Event, ...args: unknown[]) => void}
 */
function preventDefault(fn) {
	return function (...args) {
		var event = /** @type {Event} */ (args[0]);
		event.preventDefault();
		// @ts-ignore
		return fn?.apply(this, args);
	};
}

/** @import { ComponentContextLegacy } from '#client' */

/**
 * Legacy-mode only: Call `onMount` callbacks and set up `beforeUpdate`/`afterUpdate` effects
 * @param {boolean} [immutable]
 */
function init(immutable = false) {
	const context = /** @type {ComponentContextLegacy} */ (component_context);

	const callbacks = context.l.u;
	if (!callbacks) return;

	let props = () => deep_read_state(context.s);

	if (immutable) {
		let version = 0;
		let prev = /** @type {Record<string, any>} */ ({});

		// In legacy immutable mode, before/afterUpdate only fire if the object identity of a prop changes
		const d = derived(() => {
			let changed = false;
			const props = context.s;
			for (const key in props) {
				if (props[key] !== prev[key]) {
					prev[key] = props[key];
					changed = true;
				}
			}
			if (changed) version++;
			return version;
		});

		props = () => get(d);
	}

	// beforeUpdate
	if (callbacks.b.length) {
		user_pre_effect(() => {
			observe_all(context, props);
			run_all(callbacks.b);
		});
	}

	// onMount (must run before afterUpdate)
	user_effect(() => {
		const fns = untrack(() => callbacks.m.map(run));
		return () => {
			for (const fn of fns) {
				if (typeof fn === 'function') {
					fn();
				}
			}
		};
	});

	// afterUpdate
	if (callbacks.a.length) {
		user_effect(() => {
			observe_all(context, props);
			run_all(callbacks.a);
		});
	}
}

/**
 * Invoke the getter of all signals associated with a component
 * so they can be registered to the effect this function is called in.
 * @param {ComponentContextLegacy} context
 * @param {(() => void)} props
 */
function observe_all(context, props) {
	if (context.l.s) {
		for (const signal of context.l.s) get(signal);
	}

	props();
}

/**
 * @this {any}
 * @param {Record<string, unknown>} $$props
 * @param {Event} event
 * @returns {void}
 */
function bubble_event($$props, event) {
	var events = /** @type {Record<string, Function[] | Function>} */ ($$props.$$events)?.[
		event.type
	];

	var callbacks = is_array(events) ? events.slice() : events == null ? [] : [events];

	for (var fn of callbacks) {
		// Preserve "this" context
		fn.call(this, event);
	}
}

/** @import { Derived, Source } from './types.js' */

/**
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function with_parent_branch(fn) {
	var effect = active_effect;
	var previous_effect = active_effect;

	while (effect !== null && (effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0) {
		effect = effect.parent;
	}
	try {
		set_active_effect(effect);
		return fn();
	} finally {
		set_active_effect(previous_effect);
	}
}

/**
 * This function is responsible for synchronizing a possibly bound prop with the inner component state.
 * It is used whenever the compiler sees that the component writes to the prop, or when it has a default prop_value.
 * @template V
 * @param {Record<string, unknown>} props
 * @param {string} key
 * @param {number} flags
 * @param {V | (() => V)} [fallback]
 * @returns {(() => V | ((arg: V) => V) | ((arg: V, mutation: boolean) => V))}
 */
function prop(props, key, flags, fallback) {
	var immutable = (flags & PROPS_IS_IMMUTABLE) !== 0;
	var runes = (flags & PROPS_IS_RUNES) !== 0;
	var bindable = (flags & PROPS_IS_BINDABLE) !== 0;
	var lazy = (flags & PROPS_IS_LAZY_INITIAL) !== 0;

	var prop_value = /** @type {V} */ (props[key]);
	var setter = get_descriptor(props, key)?.set;

	var fallback_value = /** @type {V} */ (fallback);
	var fallback_dirty = true;
	var fallback_used = false;

	var get_fallback = () => {
		fallback_used = true;
		if (fallback_dirty) {
			fallback_dirty = false;
			if (lazy) {
				fallback_value = untrack(/** @type {() => V} */ (fallback));
			} else {
				fallback_value = /** @type {V} */ (fallback);
			}
		}

		return fallback_value;
	};

	if (prop_value === undefined && fallback !== undefined) {
		if (setter && runes) {
			props_invalid_value(key);
		}

		prop_value = get_fallback();
		if (setter) setter(prop_value);
	}

	/** @type {() => V} */
	var getter;
	if (runes) {
		getter = () => {
			var value = /** @type {V} */ (props[key]);
			if (value === undefined) return get_fallback();
			fallback_dirty = true;
			fallback_used = false;
			return value;
		};
	} else {
		// Svelte 4 did not trigger updates when a primitive value was updated to the same value.
		// Replicate that behavior through using a derived
		var derived_getter = with_parent_branch(() =>
			(immutable ? derived : derived_safe_equal)(() => /** @type {V} */ (props[key]))
		);
		derived_getter.f |= LEGACY_DERIVED_PROP;
		getter = () => {
			var value = get(derived_getter);
			if (value !== undefined) fallback_value = /** @type {V} */ (undefined);
			return value === undefined ? fallback_value : value;
		};
	}

	// easy mode — prop is never written to
	if ((flags & PROPS_IS_UPDATED) === 0) {
		return getter;
	}

	// intermediate mode — prop is written to, but the parent component had
	// `bind:foo` which means we can just call `$$props.foo = value` directly
	if (setter) {
		var legacy_parent = props.$$legacy;
		return function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
			if (arguments.length > 0) {
				// We don't want to notify if the value was mutated and the parent is in runes mode.
				// In that case the state proxy (if it exists) should take care of the notification.
				// If the parent is not in runes mode, we need to notify on mutation, too, that the prop
				// has changed because the parent will not be able to detect the change otherwise.
				if (!runes || !mutation || legacy_parent) {
					/** @type {Function} */ (setter)(mutation ? getter() : value);
				}
				return value;
			} else {
				return getter();
			}
		};
	}

	// hard mode. this is where it gets ugly — the value in the child should
	// synchronize with the parent, but it should also be possible to temporarily
	// set the value to something else locally.
	var from_child = false;
	var was_from_child = false;

	// The derived returns the current value. The underlying mutable
	// source is written to from various places to persist this value.
	var inner_current_value = mutable_source(prop_value);

	var current_value = with_parent_branch(() =>
		derived(() => {
			var parent_value = getter();
			var child_value = get(inner_current_value);
			var current_derived = /** @type {Derived} */ (active_reaction);

			// If the getter from the parent returns undefined, switch
			// to using the local value from inner_current_value instead,
			// as the parent value might have been torn down
			if (from_child || (parent_value === undefined && (current_derived.f & DESTROYED) !== 0)) {
				from_child = false;
				was_from_child = true;
				return child_value;
			}

			was_from_child = false;
			return (inner_current_value.v = parent_value);
		})
	);

	if (!immutable) current_value.equals = safe_equals;

	return function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
		var current = get(current_value);

		// legacy nonsense — need to ensure the source is invalidated when necessary
		// also needed for when handling inspect logic so we can inspect the correct source signal
		if (is_signals_recorded) {
			// set this so that we don't reset to the parent value if `d`
			// is invalidated because of `invalidate_inner_signals` (rather
			// than because the parent or child value changed)
			from_child = was_from_child;
			// invoke getters so that signals are picked up by `invalidate_inner_signals`
			getter();
			get(inner_current_value);
		}

		if (arguments.length > 0) {
			const new_value = mutation ? get(current_value) : runes && bindable ? proxy(value) : value;

			if (!current_value.equals(new_value)) {
				from_child = true;
				set(inner_current_value, new_value);
				// To ensure the fallback value is consistent when used with proxies, we
				// update the local fallback_value, but only if the fallback is actively used
				if (fallback_used && fallback_value !== undefined) {
					fallback_value = new_value;
				}
				get(current_value); // force a synchronisation immediately
			}

			return value;
		}

		return current;
	};
}

/** @import { Readable } from './public' */

/**
 * @template T
 * @param {Readable<T> | null | undefined} store
 * @param {(value: T) => void} run
 * @param {(value: T) => void} [invalidate]
 * @returns {() => void}
 */
function subscribe_to_store(store, run, invalidate) {
	if (store == null) {
		// @ts-expect-error
		run(undefined);

		return noop;
	}

	// Svelte store takes a private second argument
	const unsub = store.subscribe(
		run,
		// @ts-expect-error
		invalidate
	);

	// Also support RxJS
	// @ts-expect-error TODO fix this in the types?
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

/** @import { StoreReferencesContainer } from '#client' */
/** @import { Store } from '#shared' */

/**
 * Gets the current value of a store. If the store isn't subscribed to yet, it will create a proxy
 * signal that will be updated when the store is. The store references container is needed to
 * track reassignments to stores and to track the correct component context.
 * @template V
 * @param {Store<V> | null | undefined} store
 * @param {string} store_name
 * @param {StoreReferencesContainer} stores
 * @returns {V}
 */
function store_get(store, store_name, stores) {
	const entry = (stores[store_name] ??= {
		store: null,
		source: mutable_source(undefined),
		unsubscribe: noop
	});

	if (entry.store !== store) {
		entry.unsubscribe();
		entry.store = store ?? null;

		if (store == null) {
			entry.source.v = undefined; // see synchronous callback comment below
			entry.unsubscribe = noop;
		} else {
			var is_synchronous_callback = true;

			entry.unsubscribe = subscribe_to_store(store, (v) => {
				if (is_synchronous_callback) {
					// If the first updates to the store value (possibly multiple of them) are synchronously
					// inside a derived, we will hit the `state_unsafe_mutation` error if we `set` the value
					entry.source.v = v;
				} else {
					set(entry.source, v);
				}
			});

			is_synchronous_callback = false;
		}
	}

	return get(entry.source);
}

/**
 * Unsubscribes from all auto-subscribed stores on destroy
 * @returns {StoreReferencesContainer}
 */
function setup_stores() {
	/** @type {StoreReferencesContainer} */
	const stores = {};

	teardown(() => {
		for (var store_name in stores) {
			const ref = stores[store_name];
			ref.unsubscribe();
		}
	});

	return stores;
}

/** @import { ComponentContext, ComponentContextLegacy } from '#client' */
/** @import { EventDispatcher } from './index.js' */
/** @import { NotFunction } from './internal/types.js' */

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
 *
 * @template T
 * @param {() => NotFunction<T> | Promise<NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	if (component_context === null) {
		lifecycle_outside_component('onMount');
	}

	if (component_context.l !== null) {
		init_update_callbacks(component_context).m.push(fn);
	} else {
		user_effect(() => {
			const cleanup = untrack(fn);
			if (typeof cleanup === 'function') return /** @type {() => void} */ (cleanup);
		});
	}
}

/**
 * Legacy-mode: Init callbacks object for onMount/beforeUpdate/afterUpdate
 * @param {ComponentContext} context
 */
function init_update_callbacks(context) {
	var l = /** @type {ComponentContextLegacy} */ (context).l;
	return (l.u ??= { a: [], b: [], m: [] });
}

// generated during release, do not modify

const PUBLIC_VERSION = '5';

if (typeof window !== 'undefined')
	// @ts-ignore
	(window.__svelte ||= { v: new Set() }).v.add(PUBLIC_VERSION);

var root$r = template(`<div class="main svelte-1xg9j2"><div class="menu svelte-1xg9j2"></div> <div class="tabs svelte-1xg9j2"></div> <div class="content svelte-1xg9j2"></div></div>`);

function Menu_tabs_window($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	let mainDiv = mutable_state();
	let contentDiv = mutable_state();
	let menuDiv = mutable_state();
	let tabsDiv = mutable_state();

	onMount(async () => {});

	const handlers = {
		"-> content div"(div) {
			// replace the content
			get(contentDiv).replaceChildren(div);
			// send out the div
			tx().send('div', get(mainDiv));
		},
		"-> menu div"(div) {
			get(menuDiv).replaceChildren(div);
		},
		"-> tabs div"(div) {
			get(tabsDiv).replaceChildren(div);
		},
		"-> modal div"(div) {
			get(mainDiv).append(div);
		},
		"-> size change"({ id, rect }) {
			const w = Math.floor(get(contentDiv).clientWidth);
			const h = Math.floor(get(contentDiv).clientHeight);

			tx().send("content size change", { x: 0, y: 0, w, h });
		},
		"-> show"() {
			tx().send('div', get(mainDiv));
		}
	};

	init();

	var div_1 = root$r();

	bind_this(div_1, ($$value) => set(mainDiv, $$value), () => get(mainDiv));

	var div_2 = child(div_1);

	bind_this(div_2, ($$value) => set(menuDiv, $$value), () => get(menuDiv));

	var div_3 = sibling(div_2, 2);

	bind_this(div_3, ($$value) => set(tabsDiv, $$value), () => get(tabsDiv));

	var div_4 = sibling(div_3, 2);

	bind_this(div_4, ($$value) => set(contentDiv, $$value), () => get(contentDiv));
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$q = template(`<div class="main svelte-1pnzbgh"><div class="tabs svelte-1pnzbgh"></div> <div class="content svelte-1pnzbgh"></div></div>`);

function Vertical_menu_tabs_content($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	let mainDiv = mutable_state();
	let contentDiv = mutable_state();
	let tabsDiv = mutable_state();
	// menuDiv is initialised with a message
	let menuDiv = null;

	onMount(async () => {});

	const handlers = {
		onContentDiv(div) {
			// replace the content
			get(contentDiv).replaceChildren(div);
			// append the menu again
			if (menuDiv) get(contentDiv).append(menuDiv);
			// send out the div
			tx().send('div', get(mainDiv));
		},
		onMenuDiv(div) {
			// save
			menuDiv = div;
			// append
			get(contentDiv).append(menuDiv);
		},
		onTabsDiv(div) {
			get(tabsDiv).replaceChildren(div);
		},
		onModalDiv(div) {
			get(mainDiv).append(div);
		},
		onSizeChange({ id, rect }) {
			// and inform other nodes about the content size change
			const w = Math.floor(get(contentDiv).clientWidth);
			const h = Math.floor(get(contentDiv).clientHeight);

			tx().send("content size change", { x: 0, y: 0, w, h });
		},
		onShow() {
			tx().send('div', get(mainDiv));
		}
	};

	init();

	var div_1 = root$q();

	bind_this(div_1, ($$value) => set(mainDiv, $$value), () => get(mainDiv));

	var div_2 = child(div_1);

	bind_this(div_2, ($$value) => set(tabsDiv, $$value), () => get(tabsDiv));

	var div_3 = sibling(div_2, 2);

	bind_this(div_3, ($$value) => set(contentDiv, $$value), () => get(contentDiv));
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$p = template(`<div id="page-content" class="svelte-jgeogz"><div id="main-grid" class="svelte-jgeogz"><div id="menu-box" class="svelte-jgeogz"></div> <div id="tab-box" class="svelte-jgeogz"></div> <div id="left-box" class="svelte-jgeogz"></div> <div id="center-box" class="svelte-jgeogz"></div></div></div>`);

function Canvas_layout($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	// the page content div
	let pageContent = mutable_state();

	// when mounting
	onMount(async () => {
		// get the selected colortheme - default to dark
		getTheme();
	});

	function setTheme(theme) {
		// always include the common class name
		document.documentElement.className = theme + " common";
		localStorage.setItem('vza-theme', theme);
	}

	function getTheme() {
		const theme = localStorage.getItem('vza-theme');

		theme ? setTheme(theme) : setTheme('dark');
	}

	const handlers = {
		onMenu(div) {
			get(pageContent).querySelector("#menu-box")?.append(div);
		},
		onTabRibbon(div) {
			get(pageContent).querySelector("#tab-box")?.append(div);
		},
		onWorkspace(div) {
			get(pageContent).querySelector("#left-box")?.append(div);
		},
		onCanvas(canvas) {
			get(pageContent).querySelector("#center-box")?.append(canvas);

			// note that the context of a canvas gets reset when the size changes !
			canvas.width = Math.floor(canvas.parentElement.clientWidth);
			canvas.height = Math.floor(canvas.parentElement.clientHeight);

			// send a message that the canvas size has been adapted
			tx().send("canvas size change", {
				rect: {
					x: 0,
					y: 0,
					w: canvas.width,
					h: canvas.height
				}
			});
		},
		onModalDiv(div) {
			get(pageContent).querySelector("#center-box")?.append(div);
		}
	};

	init();

	var div_1 = root$p();

	bind_this(div_1, ($$value) => set(pageContent, $$value), () => get(pageContent));
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$o = template(`<div id="page-content" class="svelte-1ew5eoh"><div id="main-grid" class="svelte-1ew5eoh"><div id="left-menu" class="svelte-1ew5eoh"></div> <div id="left-column" class="svelte-1ew5eoh"></div> <div id="sep-col" class="svelte-1ew5eoh"></div> <div id="area-one" class="svelte-1ew5eoh"></div> <div id="sep-area" class="svelte-1ew5eoh"></div> <div id="area-two" class="svelte-1ew5eoh"></div></div></div>`);

function Left_menu_layout($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	// the page content div
	let mainGrid = mutable_state();
	let leftMenu = mutable_state();
	let leftCol = mutable_state();
	let sepCol = mutable_state();
	let sepArea = mutable_state();
	let areaOne = mutable_state();
	let areaTwo = mutable_state();

	// when mounting
	onMount(() => {
		// get the selected colortheme - default to dark
		getTheme();
	});

	function setTheme(theme) {
		// always include the common class name
		document.documentElement.className = theme + " common";
		localStorage.setItem('vza-theme', theme);
	}

	function getTheme() {
		const theme = localStorage.getItem('vza-theme');

		theme ? setTheme(theme) : setTheme('dark');
	}

	// the grid status
	const state = {
		dragging: false,
		sepColDrag: false, // dragging left column separator
		sepAreaDrag: false, // dragging area separator
		horizontal: true
	};

	// vertical config
	const vGrid = {
		rows: "100%",
		get cols() {
			const wCol = get(leftCol).getBoundingClientRect().width;

			return `30px ${wCol}px 6px 50% 6px calc(50% - 42px)`;
		},
		areas: "'lme lco spc ar1 spa ar2'"
	};

	// horizontal config
	const hGrid = {
		rows: "50vh 6px auto",
		get cols() {
			const wCol = get(leftCol).getBoundingClientRect().width;

			return `30px ${wCol}px 6px auto`;
		},
		areas: "'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
	};

	// fullscreen config == horizontal with zero for area1
	const fsGrid = {
		rows: "100% 0px 0px",
		get cols() {
			const wCol = get(leftCol).getBoundingClientRect().width;

			return `30px ${wCol}px 6px auto`;
		},
		areas: "'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
	};

	const handlers = {
		"-> left menu"(div) {
			get(leftMenu).replaceChildren(div);
		},
		"-> left column"(div) {
			get(leftCol).replaceChildren(div);
		},
		"-> area one"(div) {
			// replace the current pane (if any)
			get(areaOne).replaceChildren(div);
			// note that the context of a canvas gets reset when the size changes !
			div.width = Math.floor(get(areaOne).clientWidth);
			div.height = Math.floor(get(areaOne).clientHeight);

			// send a message that the canvas size has been adapted
			tx().send("size change", {
				id: 'area-one',
				rect: { x: 0, y: 0, w: div.width, h: div.height }
			});
		},
		"-> area two"(div) {
			// if the second pane is not visible, make it visible
			if (get(areaTwo).clientWidth == 0 || get(areaTwo).clientHeight == 0) {
				if (state.horizontal) gridConfig(hGrid.rows, hGrid.cols, hGrid.areas); else gridConfig(vGrid.rows, vGrid.cols, vGrid.areas);
			}

			// replace the current pane (if any)
			get(areaTwo).replaceChildren(div);
			// note that the context of a canvas gets reset when the size changes !
			div.width = Math.floor(get(areaTwo).clientWidth);
			div.height = Math.floor(get(areaTwo).clientHeight);

			// send a message that the canvas size has been adapted
			tx().send("size change", {
				id: 'area-two',
				rect: { x: 0, y: 0, w: div.width, h: div.height }
			});
		},
		"-> vertical"() {
			// if horizontal go to vertical - else go to full screen
			if (state.horizontal) {
				gridConfig(vGrid.rows, vGrid.cols, vGrid.areas);
				state.horizontal = false;
			} else {
				gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas);
			}

			// set the cursor
			mutate(sepArea, get(sepArea).style.cursor = state.horizontal ? 'ns-resize' : 'ew-resize');
			// and signal the change of area size
			areaSizeChange();
		},
		"-> horizontal"() {
			// check if fullscreen
			if (!state.horizontal || get(areaOne).clientHeight == 0 || get(areaTwo).clientHeight == 0) gridConfig(hGrid.rows, hGrid.cols, hGrid.areas); else gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas);
			// full screen is also horizontal
			state.horizontal = true;
			// set the cursor
			mutate(sepArea, get(sepArea).style.cursor = 'ns-resize');
			// and signal the change of area size
			areaSizeChange();
		}
	};

	function gridConfig(rows, columns, areas) {
		// adjust the grid settings
		mutate(mainGrid, get(mainGrid).style.gridTemplateRows = rows);
		mutate(mainGrid, get(mainGrid).style.gridTemplateColumns = columns);
		mutate(mainGrid, get(mainGrid).style.gridTemplateAreas = areas);
	}

	function clearDrag() {
		state.dragging = false;
		state.sepColDrag = false;
		state.sepAreaDrag = false;
	}

	// disable pointer events for the panes
	function disablePointerEvents() {
		if (get(areaOne)?.style) mutate(areaOne, get(areaOne).style.pointerEvents = "none");
		if (get(areaTwo)?.style) mutate(areaTwo, get(areaTwo).style.pointerEvents = "none");
	}

	// enable pointer events for the panes
	function enablePointerEvents() {
		if (get(areaOne)?.style) mutate(areaOne, get(areaOne).style.pointerEvents = "auto");
		if (get(areaTwo)?.style) mutate(areaTwo, get(areaTwo).style.pointerEvents = "auto");
	}

	// mouse down is only captured on the separator.
	// mouse move and mouse up are captured over the entire grid - so a check on dragging is required
	// when dragging the mouse events for the iframe are disabled, otherwise the grid does not get the mouse events
	function sepAreaMouseDown(e) {
		// set the state
		state.dragging = true;
		// set the type of separator
		state.sepAreaDrag = true;
		// disbale pointer events
		disablePointerEvents();
	}

	function sepColMouseDown(e) {
		// set the state
		state.dragging = true;
		// set the separator
		state.sepColDrag = true;
		// disbale pointer events
		disablePointerEvents();
	}

	function gridMouseUp(e) {
		// check
		if (!state.dragging) return;
		// change state 
		clearDrag();
		// enable pointer events
		enablePointerEvents();
		// canvas size has changed
		areaSizeChange();
	}

	function sepColDrag(dx) {
		const rcAreaOne = get(areaOne).getBoundingClientRect();
		const rcLeftCol = get(leftCol).getBoundingClientRect();

		mutate(mainGrid, get(mainGrid).style.gridTemplateColumns = `30px ${rcLeftCol.width + dx}px 6px ${rcAreaOne.width - dx}px 6px auto`);
	}

	function hSepAreaDrag(dy) {
		const rcAreaOne = get(areaOne).getBoundingClientRect();

		mutate(mainGrid, get(mainGrid).style.gridTemplateRows = `${rcAreaOne.height + dy}px 6px auto`);
	}

	function vSepAreaDrag(dx) {
		const rcAreaOne = get(areaOne).getBoundingClientRect();
		const rcLeftCol = get(leftCol).getBoundingClientRect();

		mutate(mainGrid, get(mainGrid).style.gridTemplateColumns = `30px ${rcLeftCol.width}px 6px ${rcAreaOne.width + dx}px 6px auto`);
	}

	function gridMouseMove(e) {
		// check
		if (!state.dragging) return;

		if (state.sepAreaDrag) {
			state.horizontal ? hSepAreaDrag(e.movementY) : vSepAreaDrag(e.movementX);
		} else if (state.sepColDrag) sepColDrag(e.movementX);
	}

	function areaSizeChange() {
		// first box
		if (get(areaOne).hasChildNodes()) {
			const rect = {
				x: 0,
				y: 0,
				w: get(areaOne).clientWidth,
				h: get(areaOne).clientHeight
			};

			tx().send("size change", { id: 'area-one', rect });
		}

		// second box
		if (get(areaTwo).hasChildNodes()) {
			const rect = {
				x: 0,
				y: 0,
				w: get(areaTwo).clientWidth,
				h: get(areaTwo).clientHeight
			};

			tx().send("size change", { id: 'area-two', rect });
		}
	}

	init();

	var div_1 = root$o();
	var div_2 = child(div_1);

	bind_this(div_2, ($$value) => set(mainGrid, $$value), () => get(mainGrid));

	var div_3 = child(div_2);

	bind_this(div_3, ($$value) => set(leftMenu, $$value), () => get(leftMenu));

	var div_4 = sibling(div_3, 2);

	bind_this(div_4, ($$value) => set(leftCol, $$value), () => get(leftCol));

	var div_5 = sibling(div_4, 2);

	bind_this(div_5, ($$value) => set(sepCol, $$value), () => get(sepCol));

	var div_6 = sibling(div_5, 2);

	bind_this(div_6, ($$value) => set(areaOne, $$value), () => get(areaOne));

	var div_7 = sibling(div_6, 2);

	bind_this(div_7, ($$value) => set(sepArea, $$value), () => get(sepArea));

	var div_8 = sibling(div_7, 2);

	bind_this(div_8, ($$value) => set(areaTwo, $$value), () => get(areaTwo));
	event("mousedown", div_5, sepColMouseDown);
	event("mousedown", div_7, sepAreaMouseDown);
	event("mousemove", div_2, gridMouseMove);
	event("mouseup", div_2, gridMouseUp);
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$n = template(`<div class="column-main-layout svelte-r7atyp"><div class="left-column svelte-r7atyp"></div> <div class="separator svelte-r7atyp"></div> <div class="main-area svelte-r7atyp"></div></div>`);

function Column_main($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	let container = mutable_state();
	let leftColumn = mutable_state();
	let mainArea = mutable_state();
	let separator = mutable_state();
	let leftWidth = mutable_state(0);
	let dragging = false;
	let pendingFrame = null;
	let resizeObserver;
	const DEFAULT_LEFT_RATIO = 0.12;
	const MIN_LEFT_WIDTH = 160;
	const MIN_MAIN_WIDTH = 320;
	const WINDOWLESS_WIDTH_FALLBACK = 1024;
	const hasWindow = typeof window !== 'undefined';

	const requestFrame = (cb) => {
		if (hasWindow && typeof window.requestAnimationFrame === 'function') {
			return window.requestAnimationFrame(cb);
		}

		return setTimeout(() => cb(Date.now()), 16);
	};

	const cancelFrame = (handle) => {
		if (handle === null) return;

		if (hasWindow && typeof window.cancelAnimationFrame === 'function') {
			window.cancelAnimationFrame(handle);
			return;
		}

		clearTimeout(handle);
	};

	const scheduleMainAreaNotification = () => {
		if (pendingFrame !== null) return;

		pendingFrame = requestFrame(() => {
			pendingFrame = null;
			sendMainAreaSize();
		});
	};

	const clampLeftWidth = (width) => {
		const viewportWidth = hasWindow ? window.innerWidth : WINDOWLESS_WIDTH_FALLBACK;
		const total = get(container)?.clientWidth ?? viewportWidth ?? width;

		if (!total) return width;

		const minCandidate = Math.max(total - MIN_MAIN_WIDTH, 80);
		const min = Math.min(MIN_LEFT_WIDTH, minCandidate);
		const max = Math.max(total - MIN_MAIN_WIDTH, min);
		const limited = Math.min(Math.max(width, min), max);

		return Number.isFinite(limited) ? limited : min;
	};

	const stopDragging = () => {
		if (!dragging) return;
		dragging = false;

		if (hasWindow) {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		}

		get(separator)?.classList.remove('dragging');
		sendMainAreaSize();
	};

	const handlePointerMove = (event) => {
		if (!dragging || !get(container)) return;

		const { left } = get(container).getBoundingClientRect();
		const proposed = clampLeftWidth(event.clientX - left);

		if (proposed !== get(leftWidth)) {
			set(leftWidth, proposed);
			scheduleMainAreaNotification();
		}
	};

	const handlePointerUp = () => stopDragging();

	const startDragging = (event) => {
		event.preventDefault();
		dragging = true;
		get(separator)?.classList.add('dragging');

		if (hasWindow) {
			window.addEventListener('pointermove', handlePointerMove);
			window.addEventListener('pointerup', handlePointerUp);
		}
	};

	const handleWindowResize = () => {
		set(leftWidth, clampLeftWidth(get(leftWidth)));
		scheduleMainAreaNotification();
	};

	const sendMainAreaSize = () => {
		if (!get(mainArea) || !tx()) return;

		const rect = get(mainArea).getBoundingClientRect();

		const payload = {
			rect: {
				x: 0,
				y: 0,
				w: Math.floor(rect.width),
				h: Math.floor(rect.height)
			}
		};

		tx().send('size change', payload);
	};

	onMount(() => {
		const viewportWidth = hasWindow ? window.innerWidth : WINDOWLESS_WIDTH_FALLBACK;
		const total = get(container)?.clientWidth ?? viewportWidth ?? 0;

		set(leftWidth, clampLeftWidth(total * DEFAULT_LEFT_RATIO || MIN_LEFT_WIDTH));

		if (hasWindow) {
			window.addEventListener('resize', handleWindowResize);
		}

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => scheduleMainAreaNotification());
			if (get(mainArea)) resizeObserver.observe(get(mainArea));
		}

		// notify once the DOM settled
		scheduleMainAreaNotification();

		return () => {
			if (hasWindow) {
				window.removeEventListener('resize', handleWindowResize);
			}

			stopDragging();
			resizeObserver?.disconnect();

			if (pendingFrame !== null) {
				cancelFrame(pendingFrame);
				pendingFrame = null;
			}
		};
	});

	const handlers = {
		onLeftColumn(div) {
			get(leftColumn)?.replaceChildren(div);
		},
		onMainArea(div) {
			if (!get(mainArea)) return;
			get(mainArea).replaceChildren(div);
			div.width = Math.floor(get(mainArea).clientWidth);
			div.height = Math.floor(get(mainArea).clientHeight);
			scheduleMainAreaNotification(); //sendMainAreaSize()
		}
	};

	init();

	var div_1 = root$n();

	bind_this(div_1, ($$value) => set(container, $$value), () => get(container));

	var div_2 = child(div_1);

	bind_this(div_2, ($$value) => set(leftColumn, $$value), () => get(leftColumn));

	var div_3 = sibling(div_2, 2);

	bind_this(div_3, ($$value) => set(separator, $$value), () => get(separator));

	var div_4 = sibling(div_3, 2);

	bind_this(div_4, ($$value) => set(mainArea, $$value), () => get(mainArea));
	template_effect(() => set_attribute(div_2, "style", `width:${get(leftWidth)}px;flex-basis:${get(leftWidth)}px;`));
	event("pointerdown", div_3, startDragging);
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_1$i = template(`<div class="menu-item svelte-15nacvn"><i class="material-icons-outlined icon svelte-15nacvn"> </i> <div class="tooltip svelte-15nacvn"> </div></div>`);
var root$m = template(`<div class="menu svelte-15nacvn"></div>`);

function Top_menu($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8),
		sx = prop($$props, "sx", 8);

	onMount(() => {
		// send the div
		tx().send("div", get(menuDiv));
	});

	let menuDiv = mutable_state(null);
	let symbols = mutable_state(sx() ?? []);

	const handlers = {
		"-> set menu"(newSymbols) {
			set(symbols, newSymbols);
		}
	};

	function menuClick(e) {
		// get the clicked symbol
		const index = e.target.getAttribute("data-index");

		// send the corresponding message
		tx().send(get(symbols)[index].message, e);
	}

	function keydown() {}
	init();

	var div = root$m();

	bind_this(div, ($$value) => set(menuDiv, $$value), () => get(menuDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$i();
		var i = child(div_1);

		set_attribute(i, "data-index", index);

		var text = child(i);

		var div_2 = sibling(i, 2);
		var text_1 = child(div_2);

		template_effect(() => {
			set_text(text, get(symbol).name);
			set_attribute(div_2, "style", `width: ${get(symbol).help.length * 0.5 ?? ""}rem;`);
			set_text(text_1, get(symbol).help);
		});

		event("click", i, menuClick);
		event("keydown", i, keydown);
		append($$anchor, div_1);
	});
	append($$anchor, div);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_1$h = template(`<div class="menu-item svelte-1st5yi2"><i class="material-icons-outlined icon svelte-1st5yi2"> </i> <div class="tooltip svelte-1st5yi2"> </div></div>`);
var root$l = template(`<div class="menu svelte-1st5yi2"></div>`);

function Side_menu($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8),
		sx = prop($$props, "sx", 8);

	onMount(() => {
		// send the div
		tx().send("div", get(menuDiv));
	});

	let menuDiv = mutable_state(null);
	let symbols = mutable_state(sx() ?? []);

	const handlers = {
		"-> set menu"(newSymbols) {
			set(symbols, newSymbols);
		}
	};

	function menuClick(e) {
		// get the clicked symbol
		const index = e.target.getAttribute("data-index");

		// send the corresponding message
		tx().send(get(symbols)[index].message, e);
	}

	function keydown() {}
	init();

	var div = root$l();

	bind_this(div, ($$value) => set(menuDiv, $$value), () => get(menuDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$h();
		var i = child(div_1);

		set_attribute(i, "data-index", index);

		var text = child(i);

		var div_2 = sibling(i, 2);
		var text_1 = child(div_2);

		template_effect(() => {
			set_text(text, get(symbol).name);
			set_attribute(div_2, "style", `width: ${get(symbol).help.length * 0.5 ?? ""}rem;`);
			set_text(text_1, get(symbol).help);
		});

		event("click", i, menuClick);
		event("keydown", i, keydown);
		append($$anchor, div_1);
	});
	append($$anchor, div);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_2$b = template(`<div class="tab selected svelte-14ugtii"> <input class="button svelte-14ugtii" type="button"> <div class="full-name svelte-14ugtii"> </div></div>`);
var root_3$4 = template(`<div class="tab svelte-14ugtii"> <input class="button svelte-14ugtii" type="button"> <div class="full-name svelte-14ugtii"> </div></div>`);
var root$k = template(`<div class="tab-ribbon svelte-14ugtii"></div>`);

function Tab_ribbon($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	onMount(() => {
		tx().send("div", get(ribbon).div);
	});

	// The tabs
	let ribbon = mutable_state({ div: null, selected: -1, tabs: [] });

	const handlers = {
		onTabNew(name) {
			mutate(ribbon, get(ribbon).selected = get(ribbon).tabs.push(name) - 1);
			set(ribbon, get(ribbon));
		},
		onTabRemove(name) {
			// notation
			const tabs = get(ribbon).tabs;
			// remove the tab with the name
			const L = tabs.length;

			for (let i = 0; i < L; (i += 1) - 1) {
				if (tabs[i] == name) {
					if (L > 1) for (let j = i; j < L - 1; (j += 1) - 1) tabs[j] = tabs[j + 1];
					tabs.pop();
					break;
				}
			}

			set(ribbon, get(ribbon));
		},
		onTabRename({ oldName, newName }) {
			// notation
			const tabs = get(ribbon).tabs;
			const index = tabs.findIndex((tab) => tab == oldName);

			if (index >= 0) tabs[index] = newName;
			set(ribbon, get(ribbon));
		},
		onTabSelect(name) {
			// notation
			const tabs = get(ribbon).tabs;
			const index = tabs.findIndex((tab) => tab == name);

			if (index >= 0) mutate(ribbon, get(ribbon).selected = index);
			set(ribbon, get(ribbon));
		}
	};

	// Event Functions 
	function onClick(e) {
		// get the uid of the tab clicked
		const index = e.target.getAttribute("data-index");

		if (index < 0 || index >= get(ribbon).tabs.length) return;
		tx().send("tab.request to select", get(ribbon).tabs[index]);
	}

	function onClose(e) {
		// no propagation
		e.stopPropagation();

		// get the uid of the tab clicked
		const index = e.target.parentNode.getAttribute("data-index");

		if (index < 0 || index >= get(ribbon).tabs.length) return;
		tx().send("tab.request to close", get(ribbon).tabs[index]);
	}

	function onKeydown(e) {}
	init();

	var div = root$k();

	bind_this(div, ($$value) => mutate(ribbon, get(ribbon).div = $$value), () => get(ribbon)?.div);

	each(div, 5, () => get(ribbon).tabs, index, ($$anchor, tab, index) => {
		var fragment = comment$1();
		var node = first_child(fragment);

		if_block(
			node,
			() => index == get(ribbon).selected,
			($$anchor) => {
				var div_1 = root_2$b();

				set_attribute(div_1, "data-index", index);

				var text = child(div_1);
				var input = sibling(text);
				var div_2 = sibling(input, 2);
				var text_1 = child(div_2);

				template_effect(() => {
					set_text(text, `${get(tab) ?? ""} `);
					set_attribute(div_2, "style", `width: ${get(tab).length * 0.5 ?? ""}rem;`);
					set_text(text_1, get(tab));
				});

				event("click", input, onClose);
				event("keydown", input, onKeydown);
				event("click", div_1, onClick);
				event("keydown", div_1, onKeydown);
				append($$anchor, div_1);
			},
			($$anchor) => {
				var div_3 = root_3$4();

				set_attribute(div_3, "data-index", index);

				var text_2 = child(div_3);
				var input_1 = sibling(text_2);
				var div_4 = sibling(input_1, 2);
				var text_3 = child(div_4);

				template_effect(() => {
					set_text(text_2, `${get(tab) ?? ""} `);
					set_attribute(div_4, "style", `width: ${get(tab).length * 0.5 ?? ""}rem;`);
					set_text(text_3, get(tab));
				});

				event("click", input_1, onClose);
				event("keydown", input_1, onKeydown);
				event("click", div_3, onClick);
				event("keydown", div_3, onKeydown);
				append($$anchor, div_3);
			}
		);

		append($$anchor, fragment);
	});
	append($$anchor, div);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_1$g = template(`<div class="menu-item svelte-oi2iq"><i class="material-icons-outlined icon svelte-oi2iq"> </i> <div class="tooltip svelte-oi2iq"> </div></div>`);
var root$j = template(`<div class="menu svelte-oi2iq"></div>`);

function Vscode_side_menu($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8),
		sx = prop($$props, "sx", 8);

	// this.menu
	let floatingDiv = mutable_state();
	let symbols = mutable_state(sx());

	onMount(() => {
		// send the div
		tx().send("div", get(floatingDiv));
	});

	const handlers = {
		"onSetMenu"(newSymbols) {
			set(symbols, newSymbols);
		}
	};

	function menuClick(e) {
		const index = e.target.getAttribute("data-index");

		if (get(symbols)[index].message?.length > 0) tx().send(get(symbols)[index].message, e);
	}

	function keydown(e) {}
	init();

	var div = root$j();

	bind_this(div, ($$value) => set(floatingDiv, $$value), () => get(floatingDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$g();
		var i = child(div_1);

		set_attribute(i, "data-index", index);

		var text = child(i);

		var div_2 = sibling(i, 2);
		var text_1 = child(div_2);

		template_effect(() => {
			set_attribute(i, "style", `color: ${get(symbol).color ?? ""};`);
			set_text(text, get(symbol).icon);
			set_attribute(div_2, "style", `width: ${get(symbol).help.length * 0.5 ?? ""}rem;`);
			set_text(text_1, get(symbol).help);
		});

		event("click", i, menuClick);
		event("keydown", i, keydown);
		append($$anchor, div_1);
	});
	append($$anchor, div);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

/** @import { Readable, StartStopNotifier, Subscriber, Unsubscriber, Updater, Writable } from '../public.js' */
/** @import { Stores, StoresValues, SubscribeInvalidateTuple } from '../private.js' */

/**
 * @type {Array<SubscribeInvalidateTuple<any> | any>}
 */
const subscriber_queue = [];

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * @template T
 * @param {T} [value] initial value
 * @param {StartStopNotifier<T>} [start]
 * @returns {Writable<T>}
 */
function writable(value, start = noop) {
	/** @type {Unsubscriber | null} */
	let stop = null;

	/** @type {Set<SubscribeInvalidateTuple<T>>} */
	const subscribers = new Set();

	/**
	 * @param {T} new_value
	 * @returns {void}
	 */
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				// store is ready
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}

	/**
	 * @param {Updater<T>} fn
	 * @returns {void}
	 */
	function update(fn) {
		set(fn(/** @type {T} */ (value)));
	}

	/**
	 * @param {Subscriber<T>} run
	 * @param {() => void} [invalidate]
	 * @returns {Unsubscriber}
	 */
	function subscribe(run, invalidate = noop) {
		/** @type {SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set, update) || noop;
		}
		run(/** @type {T} */ (value));
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe };
}

// The themes supported are 'dark' and 'light'

// Initialize the theme based on user's previous choices stored in localStorage
function getInitialTheme() {
    return localStorage.getItem('vmblu-theme') || 'dark'; // Default to 'light' if nothing in localStorage
}

// the global theme variable
const theme = writable(getInitialTheme());

// save it when it changes
theme.subscribe(value => {
    localStorage.setItem('vmblu-theme', value);  // Update localStorage whenever the theme changes
});

var root_1$f = template(`<i class="material-icons-outlined open svelte-e6df58">description</i>`);
var root_2$a = template(`<i class="material-icons-outlined open svelte-e6df58">add_circle</i>`);
var root_3$3 = template(`<div class="right-icons svelte-e6df58"><i class="material-icons-outlined trash svelte-e6df58">delete</i></div>`);
var root$i = template(`<div><div class="hdr svelte-e6df58"><div class="left-icons svelte-e6df58"><i class="material-icons-outlined cancel svelte-e6df58">cancel</i> <i class="material-icons-outlined check svelte-e6df58">check_circle</i> <!> <!></div> <h1 class="svelte-e6df58"> </h1> <!></div> <!></div>`);

function Popup_box($$anchor, $$props) {
	push($$props, false);

	const $$stores = setup_stores();
	const $theme = () => store_get(theme, "$theme", $$stores);
	let box = prop($$props, "box", 12);
	// dragging behaviour
	let startX, startY, initialLeft, initialTop;
	let dragging = false;
	let pendingShowPos = null;

	onMount(() => {
		// set the show, hide and update functions
		box(box().show = show, true);
		box(box().hide = hide, true);
		box(box().update = () => box(box()), true);

		if (pendingShowPos !== null) {
			const pos = pendingShowPos;

			pendingShowPos = null;
			queueMicrotask(() => show(pos));
		}
	});

	function onMouseDown(e) {
		startX = e.clientX;
		startY = e.clientY;
		initialLeft = box().div.offsetLeft;
		initialTop = box().div.offsetTop;
		dragging = true;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e) {
		if (dragging) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			box(box().div.style.left = `${initialLeft + dx}px`, true);
			box(box().div.style.top = `${initialTop + dy}px`, true);
		}
	}

	function onMouseUp(e) {
		dragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	function show(pos) {
		if (!box().div) {
			pendingShowPos = pos ?? box().pos ?? {};
			return;
		}

		if (!pos) pos = box().pos;

		if (pos) {
			box(box().div.style.left = `${pos.x}px`, true);
			box(box().div.style.top = `${pos.y}px`, true);
		}

		box(box().div.style.display = 'block', true);
		box(box());
	}

	function hide() {
		if (!box().div) return;
		box(box().div.style.display = 'none', true);
	}

	function onCancel(e) {
		hide();
		box().cancel?.(e);
	}

	function onOk(e) {
		hide();
		box().ok?.(e);
	}

	function onOpen(e) {
		box().open?.(e);
	}

	function onAdd(e) {
		box().add?.(e);
	}

	function onTrash(e) {
		hide();
		box().trash?.(e);
	}

	function onKeydown(e) {
		// prevent the keydown from having effects on the editor !
		e.stopPropagation();
		// check the key
		return e.key == "Enter" ? onOk(e) : e.key == "Escape" || e.key == "Esc" ? onCancel(e) : null;
	}

	init();

	var div = root$i();

	bind_this(div, ($$value) => box(box().div = $$value, true), () => box()?.div);

	var div_1 = child(div);
	var div_2 = child(div_1);
	var i = child(div_2);
	var i_1 = sibling(i, 2);
	var node = sibling(i_1, 2);

	if_block(node, () => box().open, ($$anchor) => {
		var i_2 = root_1$f();

		event("click", i_2, onOpen);
		event("keydown", i_2, onKeydown);
		append($$anchor, i_2);
	});

	var node_1 = sibling(node, 2);

	if_block(node_1, () => box().add, ($$anchor) => {
		var i_3 = root_2$a();

		event("click", i_3, onAdd);
		event("keydown", i_3, onKeydown);
		append($$anchor, i_3);
	});

	var h1 = sibling(div_2, 2);
	var text = child(h1);

	var node_2 = sibling(h1, 2);

	if_block(node_2, () => box().trash, ($$anchor) => {
		var div_3 = root_3$3();
		var i_4 = child(div_3);
		event("click", i_4, onTrash);
		event("keydown", i_4, onKeydown);
		append($$anchor, div_3);
	});

	var node_3 = sibling(div_1, 2);

	slot(node_3, $$props, "default", {});

	template_effect(() => {
		set_class(div, `main ${$theme() ?? ""} svelte-e6df58`);
		set_text(text, box().title);
	});

	event("click", i, onCancel);
	event("keydown", i, onKeydown);
	event("click", i_1, onOk);
	event("keydown", i_1, onKeydown);
	event("mousedown", div_1, onMouseDown);
	event("keydown", div, onKeydown);
	append($$anchor, div);
	pop();
}

var root$h = template(`<input class="grow svelte-w2c0k9" type="text" spellcheck="false">`);

function Text_field($$anchor, $$props) {
	push($$props, false);

	let text = prop($$props, "text", 12),
		check = prop($$props, "check", 8),
		style = prop($$props, "style", 8);

	let input = mutable_state();
	// color to indicate good/bad input
	let savedColor = null;
	const badInputColor = "#ff0000";

	onMount(() => {
		// save the good color
		savedColor = get(input).style.color;
	});

	function onInput(e) {
		// reinitialize the width
		mutate(input, get(input).style.width = '0px');
		// Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
		mutate(input, get(input).style.width = get(input).scrollWidth > 100 ? get(input).scrollWidth + 2 + 'px' : '100px');

		// Do we need to check 
		if (check()) {
			// show disapproval when input is nok
			mutate(input, get(input).style.color = check()(get(input).value) ? savedColor : badInputColor);
		}
	}

	init();

	var input_1 = root$h();

	bind_this(input_1, ($$value) => set(input, $$value), () => get(input));
	template_effect(() => set_attribute(input_1, "style", style() ? style() : ''));
	bind_value(input_1, text);
	event("input", input_1, onInput);
	append($$anchor, input_1);
	pop();
}

var root$g = template(`<input type="checkbox" class="svelte-kvi95y">`);

function Checkbox($$anchor, $$props) {
	push($$props, false);

	let style = prop($$props, "style", 8);
	let on = prop($$props, "on", 12);
	let onToggle = prop($$props, "onToggle", 8);

	// call the on color function if requested
	function onInput() {
		onToggle()?.(on());
	}

	init();

	var input = root$g();
	template_effect(() => set_attribute(input, "style", style() ? style() : ''));
	bind_checked(input, on);
	event("change", input, onInput);
	append($$anchor, input);
	pop();
}

var root$f = template(`<div class="label-checkbox svelte-2li08e"><label class="svelte-2li08e"> </label> <div class="checkbox-field svelte-2li08e"><!> <!></div></div>`);

function Label_checkbox($$anchor, $$props) {
	let label = prop($$props, "label", 8);
	let on = prop($$props, "on", 12);
	let style = prop($$props, "style", 8, 'width: 9rem;');
	let onToggle = prop($$props, "onToggle", 8);
	var div = root$f();
	var label_1 = child(div);
	var text = child(label_1);

	var div_1 = sibling(label_1, 2);
	var node = child(div_1);

	Checkbox(node, {
		get on() {
			return on();
		},
		set on($$value) {
			on($$value);
		},
		get onToggle() {
			return onToggle();
		},
		$$legacy: true
	});

	var node_1 = sibling(node, 2);

	slot(node_1, $$props, "default", {});

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	append($$anchor, div);
}

var root$e = template(`<h4>Run</h4> <!> <h4>Monitor</h4> <!> <!>`, 1);

function Runtime_settings_base($$anchor, $$props) {
	push($$props, false);

	let dx = prop($$props, "dx", 12);

	init();

	var fragment = root$e();
	var node = sibling(first_child(fragment), 2);

	Label_checkbox(node, {
		label: "use worker script:",
		get on() {
			return dx().run.worker.on;
		},
		set on($$value) {
			dx(dx().run.worker.on = $$value, true);
		},
		children: ($$anchor, $$slotProps) => {
			Text_field($$anchor, {
				get text() {
					return dx().run.worker.path;
				},
				set text($$value) {
					dx(dx().run.worker.path = $$value, true);
				},
				$$legacy: true
			});
		},
		$$slots: { default: true },
		$$legacy: true
	});

	var node_1 = sibling(node, 4);

	Label_checkbox(node_1, {
		label: "log messages",
		get on() {
			return dx().monitor.logMessages;
		},
		set on($$value) {
			dx(dx().monitor.logMessages = $$value, true);
		},
		$$legacy: true
	});

	var node_2 = sibling(node_1, 2);

	Label_checkbox(node_2, {
		label: "log timings",
		get on() {
			return dx().monitor.logTimings;
		},
		set on($$value) {
			dx(dx().monitor.logTimings = $$value, true);
		},
		$$legacy: true
	});

	append($$anchor, fragment);
	pop();
}

var root$d = template(`<button type="button" class="svelte-2d29qn"> </button>`);

function Button($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let click = prop($$props, "click", 8);
	let active = prop($$props, "active", 8, false);
	let disabled = prop($$props, "disabled", 8, false);

	init();

	var button = root$d();
	var text = child(button);

	template_effect(() => {
		button.disabled = disabled();
		toggle_class(button, "active", active());
		set_text(text, label());
	});

	event("click", button, () => click()?.());
	append($$anchor, button);
	pop();
}

var root_1$e = template(`<option> </option>`);
var root$c = template(`<div class="select-field svelte-16klf86"><label class="svelte-16klf86"> </label> <select class="svelte-16klf86"></select></div>`);

function Label_select($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let value = prop($$props, "value", 12);
	let options = prop($$props, "options", 24, () => []);
	let style = prop($$props, "style", 8, 'width: 9rem;');
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	function optionValue(option) {
		return typeof option === 'object' ? option.value : option;
	}

	function optionLabel(option) {
		return typeof option === 'object' ? option.label : option;
	}

	init();

	var div = root$c();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var select = sibling(label_1, 2);

	template_effect(() => {
		value();

		invalidate_inner_signals(() => {
			options();
		});
	});

	set_attribute(select, "id", fid);

	each(select, 5, options, index, ($$anchor, option) => {
		var option_1 = root_1$e();
		var option_1_value = {};
		var text_1 = child(option_1);

		template_effect(() => set_text(text_1, optionLabel(get(option))));

		template_effect(() => {
			if (option_1_value !== (option_1_value = optionValue(get(option)))) {
				option_1.value = null == (option_1.__value = optionValue(get(option))) ? "" : optionValue(get(option));
			}
		});

		append($$anchor, option_1);
	});

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	bind_select_value(select, value);
	append($$anchor, div);
	pop();
}

var root$b = template(`<div class="textarea-field svelte-har9rk"><label class="svelte-har9rk"> </label> <textarea spellcheck="false" class="svelte-har9rk"></textarea></div>`);

function Label_textarea($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let text = prop($$props, "text", 12);
	let style = prop($$props, "style", 8, 'width: 9rem;');
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	init();

	var div = root$b();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text_1 = child(label_1);

	var textarea = sibling(label_1, 2);
	set_attribute(textarea, "id", fid);

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text_1, label());
	});

	bind_value(textarea, text);

	event("keydown", textarea, stopPropagation(function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	}));

	append($$anchor, div);
	pop();
}

const defaultWorker$1 = () => ({
    on: false,
    path: '',
});

const defaultRun$1 = () => ({
    worker: defaultWorker$1(),
});

const defaultMonitor$1 = () => ({
    logMessages: false,
    logTimings: false,
});

function make$1() {
    return {
        run: defaultRun$1(),
        monitor: defaultMonitor$1(),
    }
}

function normalize$2(dx = null) {

    const defaults = make$1();

    if (!dx || typeof dx !== 'object') return defaults

    const normalized = {
        run: {
            ...defaults.run,
            ...(dx.run ?? {}),
            worker: {
                ...defaults.run.worker,
                ...(dx.run?.worker ?? dx.worker ?? {}),
            },
        },
        monitor: {
            ...defaults.monitor,
            ...(dx.monitor ?? {}),
            logMessages: dx.monitor?.logMessages ?? dx.logMessages ?? defaults.monitor.logMessages,
        },
    };

    normalized.run.worker.on = !!normalized.run.worker.on;
    normalized.run.worker.path = normalized.run.worker.path ?? '';
    normalized.monitor.logMessages = !!normalized.monitor.logMessages;
    normalized.monitor.logTimings = !!normalized.monitor.logTimings;

    return normalized
}

function clone$1(dx = null) {
    return normalize$2(dx)
}

function reset$1(target) {

    const defaults = make$1();

    assign$3(target, defaults);

    return target
}

function assign$3(target, dx = null) {

    const normalized = normalize$2(dx);

    target.run = structuredClone(normalized.run);
    target.monitor = structuredClone(normalized.monitor);

    delete target.logMessages;
    delete target.worker;
    delete target.security;

    return target
}

function isDefault$1(dx = null) {

    const normalized = normalize$2(dx);

    return JSON.stringify(normalized) === JSON.stringify(make$1())
}

function makeModel$1() {
    return {
        run: {},
        monitor: {},
    }
}

function normalizeModel$1(settings = null) {
    const defaults = makeModel$1();
    if (!settings || typeof settings !== 'object') return defaults

    return {
        run: {
            ...defaults.run,
            ...(settings.run ?? {}),
        },
        monitor: {
            ...defaults.monitor,
            ...(settings.monitor ?? {}),
        },
    }
}

function effectivePolicy$1(modelSettings = null, nodeDx = null) {
    return {
        model: normalizeModel$1(modelSettings),
        node: normalize$2(nodeDx),
    }
}

const runtimeSettings$1 = {
    make: make$1,
    normalize: normalize$2,
    clone: clone$1,
    reset: reset$1,
    assign: assign$3,
    isDefault: isDefault$1,
    makeModel: makeModel$1,
    normalizeModel: normalizeModel$1,
    effectivePolicy: effectivePolicy$1,
};

const PERMISSIONS = ['allow', 'warn', 'deny'];
const PERMISSION_ORDER = {deny: 0, warn: 1, allow: 2};

const defaultWorker = () => ({
    on: false,
    path: '',
});

const defaultRun = () => ({
    worker: defaultWorker(),
});

const defaultMonitor = () => ({
    logMessages: false,
    logTimings: false,
});

const defaultFsOperation = (mode = 'deny') => ({
    mode,
    roots: [],
});

const defaultNetOperation = (mode = 'deny') => ({
    mode,
    hosts: [],
});

const defaultProcessOperation = (mode = 'deny') => ({
    mode,
    commands: [],
});

const defaultSecurityPolicy = () => ({
    fs: {
        read: defaultFsOperation(),
        write: defaultFsOperation(),
        delete: defaultFsOperation(),
    },
    net: {
        egress: defaultNetOperation(),
    },
    process: {
        exec: defaultProcessOperation(),
    },
});

const defaultSecurity = () => ({
    enabled: false,
    ...defaultSecurityPolicy(),
});

function make() {
    return {
        run: defaultRun(),
        monitor: defaultMonitor(),
        security: defaultSecurity(),
    }
}

function normalize$1(dx = null) {

    const defaults = make();

    if (!dx || typeof dx !== 'object') return defaults

    const legacySafety = dx.safety ?? {};
    const security = normalizeNodeSecurity(dx.security, legacySafety);

    const normalized = {
        run: {
            ...defaults.run,
            ...(dx.run ?? {}),
            worker: {
                ...defaults.run.worker,
                ...(dx.run?.worker ?? dx.worker ?? {}),
            },
        },
        monitor: {
            ...defaults.monitor,
            ...(dx.monitor ?? {}),
            logMessages: dx.monitor?.logMessages ?? dx.logMessages ?? defaults.monitor.logMessages,
        },
        security,
    };

    normalized.run.worker.on = !!normalized.run.worker.on;
    normalized.run.worker.path = normalized.run.worker.path ?? '';
    normalized.monitor.logMessages = !!normalized.monitor.logMessages;
    normalized.monitor.logTimings = !!normalized.monitor.logTimings;

    return normalized
}

function clone(dx = null) {
    return normalize$1(dx)
}

function reset(target) {

    const defaults = make();

    assign$2(target, defaults);

    return target
}

function assign$2(target, dx = null) {

    const normalized = normalize$1(dx);

    target.run = structuredClone(normalized.run);
    target.monitor = structuredClone(normalized.monitor);
    target.security = structuredClone(normalized.security);

    delete target.logMessages;
    delete target.worker;
    delete target.safety;

    return target
}

function isDefault(dx = null) {

    const normalized = normalize$1(dx);
    const defaults = make();

    if (!normalized.security.enabled || isDefaultSecurityPolicy(normalized.security)) {
        normalized.security = structuredClone(defaults.security);
    }

    return JSON.stringify(normalized) === JSON.stringify(defaults)
}

function makeModel() {
    return {
        run: {},
        monitor: {},
        security: defaultSecurityPolicy(),
    }
}

function normalizeModel(settings = null) {
    const defaults = makeModel();
    if (!settings || typeof settings !== 'object') return defaults

    return {
        run: {
            ...defaults.run,
            ...(settings.run ?? {}),
        },
        monitor: {
            ...defaults.monitor,
            ...(settings.monitor ?? {}),
        },
        security: normalizeModelSecurity(settings.security),
    }
}

function effectivePolicy(modelSettings = null, nodeDx = null) {
    const hasModelSecurity = !!(modelSettings && typeof modelSettings === 'object' && modelSettings.security);
    const model = normalizeModel(modelSettings);
    const node = normalize$1(nodeDx);
    const nodeSecurity = node.security?.enabled ? node.security : defaultSecurity();

    return {
        active: hasModelSecurity,
        security: intersectSecurity(model.security, nodeSecurity),
        model,
        node,
    }
}

function normalizeNodeSecurity(security = null, legacySafety = {}) {
    const source = security ?? {};
    const legacy = legacyNodeSecurity(source);
    const enabled = source.enabled ?? legacySafety.on ?? false;

    return {
        enabled: !!enabled,
        ...normalizeSecurityPolicy(source, legacy),
    }
}

function normalizeModelSecurity(security = null) {
    return normalizeSecurityPolicy(security, legacyModelSecurity(security))
}

function normalizeSecurityPolicy(source = null, legacy = {}) {
    const defaults = defaultSecurityPolicy();
    const value = source ?? {};

    return {
        fs: {
            read: normalizeFsOperation(value.fs?.read ?? legacy.fs?.read ?? defaults.fs.read),
            write: normalizeFsOperation(value.fs?.write ?? legacy.fs?.write ?? defaults.fs.write),
            delete: normalizeFsOperation(value.fs?.delete ?? legacy.fs?.delete ?? defaults.fs.delete),
        },
        net: {
            egress: normalizeNetOperation(value.net?.egress ?? legacy.net?.egress ?? defaults.net.egress),
        },
        process: {
            exec: normalizeProcessOperation(value.process?.exec ?? legacy.process?.exec ?? defaults.process.exec),
        },
    }
}

function normalizeFsOperation(value = null) {
    const mode = normalizeMode(value?.mode);
    return {
        mode,
        roots: mode === 'deny' ? [] : normalizeList(value?.roots),
    }
}

function normalizeNetOperation(value = null) {
    const mode = normalizeMode(value?.mode);
    return {
        mode,
        hosts: mode === 'deny' ? [] : normalizeList(value?.hosts),
    }
}

function normalizeProcessOperation(value = null) {
    const mode = normalizeMode(value?.mode);
    return {
        mode,
        commands: mode === 'deny' ? [] : normalizeList(value?.commands),
    }
}

function normalizeMode(value) {
    return PERMISSIONS.includes(value) ? value : 'deny'
}

function normalizeList(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(item => String(item)) : []
}

function legacyModelSecurity(security = null) {
    if (!security?.defaults && !security?.allow) return {}

    const defaults = security.defaults ?? {};
    const allow = security.allow ?? {};

    return {
        fs: {
            read: defaultFsOperation('deny'),
            write: {mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots)},
            delete: {mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots)},
        },
        net: {
            egress: {mode: normalizeLegacyMode(defaults.net), hosts: normalizeList(allow.netHosts)},
        },
        process: {
            exec: {mode: normalizeLegacyMode(defaults.process), commands: []},
        },
    }
}

function legacyNodeSecurity(security = null) {
    if (!security?.request) return {}

    const request = security.request ?? {};
    const allow = request.allow ?? {};

    return {
        fs: {
            read: defaultFsOperation('deny'),
            write: {mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots)},
            delete: {mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots)},
        },
        net: {
            egress: {mode: normalizeLegacyMode(request.net), hosts: normalizeList(allow.netHosts)},
        },
        process: {
            exec: {mode: normalizeLegacyMode(request.process), commands: []},
        },
    }
}

function normalizeLegacyMode(value) {
    return value === 'inherit' ? 'deny' : normalizeMode(value)
}

function intersectSecurity(model, node) {
    return {
        fs: {
            read: intersectFsOperation(model.fs.read, node.fs.read),
            write: intersectFsOperation(model.fs.write, node.fs.write),
            delete: intersectFsOperation(model.fs.delete, node.fs.delete),
        },
        net: {
            egress: intersectNetOperation(model.net.egress, node.net.egress),
        },
        process: {
            exec: intersectProcessOperation(model.process.exec, node.process.exec),
        },
    }
}

function intersectFsOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode);
    return {
        mode,
        roots: mode === 'deny' ? [] : intersectScope(model.roots, node.roots),
    }
}

function intersectNetOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode);
    return {
        mode,
        hosts: mode === 'deny' ? [] : intersectScope(model.hosts, node.hosts),
    }
}

function intersectProcessOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode);
    return {
        mode,
        commands: mode === 'deny' ? [] : intersectScope(model.commands, node.commands),
    }
}

function stricterMode(modelMode, nodeMode) {
    return PERMISSION_ORDER[nodeMode] <= PERMISSION_ORDER[modelMode] ? nodeMode : modelMode
}

function intersectScope(modelValues = [], nodeValues = []) {
    if (!Array.isArray(modelValues) || !modelValues.length) return Array.isArray(nodeValues) ? nodeValues.slice() : []
    if (!Array.isArray(nodeValues) || !nodeValues.length) return modelValues.slice()
    const allowed = new Set(modelValues);
    return nodeValues.filter(value => allowed.has(value))
}

function isDefaultSecurityPolicy(security = {}) {
    const {enabled, ...policy} = security;
    return JSON.stringify(policy) === JSON.stringify(defaultSecurityPolicy())
}

const runtimeSettings = {
    make,
    normalize: normalize$1,
    clone,
    reset,
    assign: assign$2,
    isDefault,
    makeModel,
    normalizeModel,
    effectivePolicy,
};

const RT_BASE = '@vizualmodel/vmblu-runtime/rt-base';
const RT_ALS = '@vizualmodel/vmblu-runtime/rt-als';
const RT_BROWSER_AGENT = '@vizualmodel/vmblu-runtime/rt-browser-agent';
const RT_NODEJS_AGENT = '@vizualmodel/vmblu-runtime/rt-nodejs-agent';
const RT_AGENT = '@vizualmodel/vmblu-runtime/rt-agent';

const RUNTIME_DESCRIPTORS = [
    {
        id: RT_BASE,
        name: 'rt-base',
        settings: runtimeSettings$1,
        supportsAgents: false,
    },
    {
        id: RT_ALS,
        name: 'rt-als',
        settings: runtimeSettings,
        supportsAgents: false,
    },
    {
        id: RT_BROWSER_AGENT,
        name: 'rt-browser-agent',
        settings: runtimeSettings$1,
        supportsAgents: true,
    },
    {
        id: RT_NODEJS_AGENT,
        name: 'rt-nodejs-agent',
        settings: runtimeSettings,
        supportsAgents: true,
        aliases: [RT_AGENT, 'rt-agent'],
    },
];

function getRuntimeDescriptor(runtime) {
    return RUNTIME_DESCRIPTORS.find(candidate => {
        return candidate.id === runtime
            || candidate.name === runtime
            || candidate.aliases?.includes(runtime)
    }) ?? RUNTIME_DESCRIPTORS[0]
}

function getRuntimeSettings(runtime) {
    return getRuntimeDescriptor(runtime).settings
}

var root_2$9 = template(`<p class="runtime-warning svelte-jkuczt"> </p>`);
var root_1$d = template(`<div class="node-security-settings svelte-jkuczt"><div class="section svelte-jkuczt"><h4 class="svelte-jkuczt">File System</h4> <!> <!> <!> <!> <!> <!></div> <div class="section svelte-jkuczt"><h4 class="svelte-jkuczt">Network</h4> <!> <!></div> <div class="section svelte-jkuczt"><h4 class="svelte-jkuczt">Process</h4> <!> <!></div> <!></div>`);

function Node_security_settings($$anchor, $$props) {
	push($$props, false);

	const envelopeWarning = mutable_state();
	let tx = prop($$props, "tx", 8);
	const permissionOptions = ['allow', 'warn', 'deny'];

	const box = mutable_state({
		div: null,
		pos: null,
		title: 'Node Security Settings',
		ok: null,
		cancel: null
	});

	let runtime = mutable_state(null);
	let modelRuntimeSettings = mutable_state(null);
	let security = mutable_state(makeDefaultSecurity());
	let scopeText = mutable_state(makeScopeText());
	let projectedSecurity = mutable_state(makeDefaultSecurity());

	onMount(() => {
		tx()?.send('modal div', get(box).div);
	});

	function show(
		{
			runtime: runtimeName,
			security: nodeSecurity,
			modelRuntimeSettings: settings,
			pos,
			ok,
			cancel
		}
	) {
		set(runtime, runtimeName);
		set(modelRuntimeSettings, settings ?? null);
		set(security, normalizeSecurity(get(runtime), nodeSecurity));
		syncTextFromSecurity();
		mutate(box, get(box).pos = { ...pos });

		mutate(box, get(box).ok = () => {
			ok?.(clone(get(projectedSecurity)));
		});

		mutate(box, get(box).cancel = () => cancel?.());
		get(box).show(get(box).pos);
	}

	function normalizeSecurity(runtimeName, nodeSecurity) {
		const dx = getRuntimeSettings(runtimeName).normalize({ security: nodeSecurity });

		return { ...clone(dx.security), enabled: true };
	}

	function makeDefaultSecurity() {
		return {
			enabled: true,
			fs: {
				read: { mode: 'deny', roots: [] },
				write: { mode: 'deny', roots: [] },
				delete: { mode: 'deny', roots: [] }
			},
			net: { egress: { mode: 'deny', hosts: [] } },
			process: { exec: { mode: 'deny', commands: [] } }
		};
	}

	function makeScopeText() {
		return {
			fsReadRoots: '',
			fsWriteRoots: '',
			fsDeleteRoots: '',
			netEgressHosts: '',
			processExecCommands: ''
		};
	}

	function syncTextFromSecurity() {
		set(scopeText, {
			fsReadRoots: listToText(get(security)?.fs?.read?.roots),
			fsWriteRoots: listToText(get(security)?.fs?.write?.roots),
			fsDeleteRoots: listToText(get(security)?.fs?.delete?.roots),
			netEgressHosts: listToText(get(security)?.net?.egress?.hosts),
			processExecCommands: listToText(get(security)?.process?.exec?.commands)
		});
	}

	function securityFromText(source, text) {
		const next = clone(source);

		next.fs.read.roots = textToList(text.fsReadRoots);
		next.fs.write.roots = textToList(text.fsWriteRoots);
		next.fs.delete.roots = textToList(text.fsDeleteRoots);
		next.net.egress.hosts = textToList(text.netEgressHosts);
		next.process.exec.commands = textToList(text.processExecCommands);
		return next;
	}

	function listToText(values) {
		return Array.isArray(values) ? values.join('\n') : '';
	}

	function textToList(text) {
		return (text ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
	}

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function runtimeEnvelopeWarning(runtimeName, settings, nodeSecurity) {
		if (!settings || typeof settings !== 'object') return '';

		const dx = getRuntimeSettings(runtimeName).normalize({ security: nodeSecurity });
		const policy = getRuntimeSettings(runtimeName).effectivePolicy(settings, dx);
		const clipped = [];

		collectClippedOperation(clipped, 'fs.read', policy.node?.security?.fs?.read, policy.security?.fs?.read, 'roots');
		collectClippedOperation(clipped, 'fs.write', policy.node?.security?.fs?.write, policy.security?.fs?.write, 'roots');
		collectClippedOperation(clipped, 'fs.delete', policy.node?.security?.fs?.delete, policy.security?.fs?.delete, 'roots');
		collectClippedOperation(clipped, 'net.egress', policy.node?.security?.net?.egress, policy.security?.net?.egress, 'hosts');
		collectClippedOperation(clipped, 'process.exec', policy.node?.security?.process?.exec, policy.security?.process?.exec, 'commands');
		return clipped.length ? `Outside model envelope: ${clipped.join(', ')}` : '';
	}

	function collectClippedOperation(
		clipped,
		label,
		requested,
		effective,
		scopeKey
	) {
		if (!requested || !effective) return;

		if (requested.mode !== effective.mode) {
			clipped.push(`${label}: ${requested.mode} -> ${effective.mode}`);
			return;
		}

		const requestedScope = requested[scopeKey] ?? [];
		const effectiveScope = effective[scopeKey] ?? [];

		if (requestedScope.length && JSON.stringify(requestedScope) !== JSON.stringify(effectiveScope)) {
			clipped.push(`${label} scope clipped`);
		}
	}

	legacy_pre_effect(() => (get(security), get(scopeText)), () => {
		set(projectedSecurity, securityFromText(get(security), get(scopeText)));
	});

	legacy_pre_effect(
		() => (
			get(runtime),
			get(modelRuntimeSettings),
			get(projectedSecurity)
		),
		() => {
			set(envelopeWarning, runtimeEnvelopeWarning(get(runtime), get(modelRuntimeSettings), get(projectedSecurity)));
		}
	);

	legacy_pre_effect_reset();
	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$d();
			var div_1 = child(div);
			var node = sibling(child(div_1), 2);

			Label_select(node, {
				label: "read",
				get value() {
					return get(security).fs.read.mode;
				},
				set value($$value) {
					mutate(security, get(security).fs.read.mode = $$value);
				},
				options: permissionOptions,
				$$legacy: true
			});

			var node_1 = sibling(node, 2);

			Label_textarea(node_1, {
				label: "read roots",
				get text() {
					return get(scopeText).fsReadRoots;
				},
				set text($$value) {
					mutate(scopeText, get(scopeText).fsReadRoots = $$value);
				},
				$$legacy: true
			});

			var node_2 = sibling(node_1, 2);

			Label_select(node_2, {
				label: "write",
				get value() {
					return get(security).fs.write.mode;
				},
				set value($$value) {
					mutate(security, get(security).fs.write.mode = $$value);
				},
				options: permissionOptions,
				$$legacy: true
			});

			var node_3 = sibling(node_2, 2);

			Label_textarea(node_3, {
				label: "write roots",
				get text() {
					return get(scopeText).fsWriteRoots;
				},
				set text($$value) {
					mutate(scopeText, get(scopeText).fsWriteRoots = $$value);
				},
				$$legacy: true
			});

			var node_4 = sibling(node_3, 2);

			Label_select(node_4, {
				label: "delete",
				get value() {
					return get(security).fs.delete.mode;
				},
				set value($$value) {
					mutate(security, get(security).fs.delete.mode = $$value);
				},
				options: permissionOptions,
				$$legacy: true
			});

			var node_5 = sibling(node_4, 2);

			Label_textarea(node_5, {
				label: "delete roots",
				get text() {
					return get(scopeText).fsDeleteRoots;
				},
				set text($$value) {
					mutate(scopeText, get(scopeText).fsDeleteRoots = $$value);
				},
				$$legacy: true
			});

			var div_2 = sibling(div_1, 2);
			var node_6 = sibling(child(div_2), 2);

			Label_select(node_6, {
				label: "egress",
				get value() {
					return get(security).net.egress.mode;
				},
				set value($$value) {
					mutate(security, get(security).net.egress.mode = $$value);
				},
				options: permissionOptions,
				$$legacy: true
			});

			var node_7 = sibling(node_6, 2);

			Label_textarea(node_7, {
				label: "hosts",
				get text() {
					return get(scopeText).netEgressHosts;
				},
				set text($$value) {
					mutate(scopeText, get(scopeText).netEgressHosts = $$value);
				},
				$$legacy: true
			});

			var div_3 = sibling(div_2, 2);
			var node_8 = sibling(child(div_3), 2);

			Label_select(node_8, {
				label: "exec",
				get value() {
					return get(security).process.exec.mode;
				},
				set value($$value) {
					mutate(security, get(security).process.exec.mode = $$value);
				},
				options: permissionOptions,
				$$legacy: true
			});

			var node_9 = sibling(node_8, 2);

			Label_textarea(node_9, {
				label: "commands",
				get text() {
					return get(scopeText).processExecCommands;
				},
				set text($$value) {
					mutate(scopeText, get(scopeText).processExecCommands = $$value);
				},
				$$legacy: true
			});

			var node_10 = sibling(div_3, 2);

			if_block(node_10, () => get(envelopeWarning), ($$anchor) => {
				var p = root_2$9();
				var text_1 = child(p);
				template_effect(() => set_text(text_1, get(envelopeWarning)));
				append($$anchor, p);
			});
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "show", show);
	return pop({ show });
}

var root$a = template(`<h4>Run</h4> <!> <h4>Monitor</h4> <!> <!> <h4>Security</h4> <!> <!>`, 1);

function Runtime_settings_als($$anchor, $$props) {
	push($$props, false);

	let dx = prop($$props, "dx", 12);
	let tx = prop($$props, "tx", 8);
	let runtime = prop($$props, "runtime", 8);
	let modelRuntimeSettings = prop($$props, "modelRuntimeSettings", 8);
	let popupPos = prop($$props, "popupPos", 8);
	let securitySettingsPopup = mutable_state();

	function showSecuritySettings() {
		dx(dx().security.enabled = true, true);
		dx({ ...dx() });

		get(securitySettingsPopup).show({
			runtime: runtime(),
			security: dx().security,
			modelRuntimeSettings: modelRuntimeSettings(),
			pos: securityPopupPosition(),
			ok: (security) => {
				dx({ ...dx(), security });
			}
		});
	}

	function securityPopupPosition() {
		const pos = popupPos() ?? { x: 40, y: 40 };

		return { x: (pos.x ?? 40) + 24, y: (pos.y ?? 40) + 24 };
	}

	init();

	var fragment = root$a();
	var node = sibling(first_child(fragment), 2);

	Label_checkbox(node, {
		label: "use worker script:",
		get on() {
			return dx().run.worker.on;
		},
		set on($$value) {
			dx(dx().run.worker.on = $$value, true);
		},
		children: ($$anchor, $$slotProps) => {
			Text_field($$anchor, {
				get text() {
					return dx().run.worker.path;
				},
				set text($$value) {
					dx(dx().run.worker.path = $$value, true);
				},
				$$legacy: true
			});
		},
		$$slots: { default: true },
		$$legacy: true
	});

	var node_1 = sibling(node, 4);

	Label_checkbox(node_1, {
		label: "log messages",
		get on() {
			return dx().monitor.logMessages;
		},
		set on($$value) {
			dx(dx().monitor.logMessages = $$value, true);
		},
		$$legacy: true
	});

	var node_2 = sibling(node_1, 2);

	Label_checkbox(node_2, {
		label: "log timings",
		get on() {
			return dx().monitor.logTimings;
		},
		set on($$value) {
			dx(dx().monitor.logTimings = $$value, true);
		},
		$$legacy: true
	});

	var node_3 = sibling(node_2, 4);

	Label_checkbox(node_3, {
		label: "custom security settings",
		get on() {
			return dx().security.enabled;
		},
		set on($$value) {
			dx(dx().security.enabled = $$value, true);
		},
		children: ($$anchor, $$slotProps) => {
			var disabled = derived_safe_equal(() => !dx().security.enabled);

			Button($$anchor, {
				label: "settings",
				click: showSecuritySettings,
				get disabled() {
					return get(disabled);
				}
			});
		},
		$$slots: { default: true },
		$$legacy: true
	});

	var node_4 = sibling(node_3, 2);

	bind_this(
		Node_security_settings(node_4, {
			get tx() {
				return tx();
			},
			$$legacy: true
		}),
		($$value) => set(securitySettingsPopup, $$value),
		() => get(securitySettingsPopup)
	);

	append($$anchor, fragment);
	pop();
}

var root$9 = template(`<!> <h4>Agent broker</h4> <p>Agent-specific node runtime settings will be added here.</p>`, 1);

function Runtime_settings_agent($$anchor, $$props) {
	let dx = prop($$props, "dx", 12);
	let tx = prop($$props, "tx", 8);
	let runtime = prop($$props, "runtime", 8);
	let modelRuntimeSettings = prop($$props, "modelRuntimeSettings", 8);
	let popupPos = prop($$props, "popupPos", 8);
	var fragment = root$9();
	var node = first_child(fragment);

	Runtime_settings_als(node, {
		get dx() {
			return dx();
		},
		set dx($$value) {
			dx($$value);
		},
		get tx() {
			return tx();
		},
		get runtime() {
			return runtime();
		},
		get modelRuntimeSettings() {
			return modelRuntimeSettings();
		},
		get popupPos() {
			return popupPos();
		},
		$$legacy: true
	});
	append($$anchor, fragment);
}

var root_4$2 = template(`<p class="runtime-warning svelte-f3trbc"> </p>`);
var root_1$c = template(`<!> <!>`, 1);

function Runtime_settings($$anchor, $$props) {
	push($$props, false);

	const envelopeWarning = mutable_state();
	const runtimeComponent = mutable_state();
	let tx = prop($$props, "tx", 8);

	onMount(() => {
		tx().send('modal div', get(box).div);
	});

	const box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	let runtimeName = mutable_state(RT_BASE);
	let localDx = mutable_state(getRuntimeSettings(RT_BASE).make());
	let modelRuntimeSettings = mutable_state(null);

	function runtimeSettingsComponent(runtime) {
		if (runtime === RT_AGENT || runtime === RT_NODEJS_AGENT) return Runtime_settings_agent;
		if (runtime === RT_ALS) return Runtime_settings_als;
		return Runtime_settings_base;
	}

	const handlers = {
		onShow(
			{
				title,
				pos,
				dx,
				runtime,
				modelRuntimeSettings: settings,
				ok,
				cancel
			}
		) {
			set(runtimeName, runtime ?? RT_BASE);
			set(modelRuntimeSettings, settings ?? null);
			mutate(box, get(box).title = title);
			mutate(box, get(box).pos = { ...pos });
			mutate(box, get(box).ok = () => ok?.(getRuntimeSettings(get(runtimeName)).clone(get(localDx))));
			mutate(box, get(box).cancel = () => cancel?.());

			const runtimeSettings = getRuntimeSettings(get(runtimeName));

			set(localDx, dx ? runtimeSettings.clone(dx) : runtimeSettings.make());
			get(box).show(get(box).pos);
		}
	};

	function runtimeEnvelopeWarning(runtime, modelSettings, dx) {
		if (!dx?.security?.enabled || !modelSettings || typeof modelSettings !== 'object') return '';

		const policy = getRuntimeSettings(runtime).effectivePolicy(modelSettings, dx);
		const clipped = [];

		collectClippedOperation(clipped, 'fs.read', policy.node?.security?.fs?.read, policy.security?.fs?.read, 'roots');
		collectClippedOperation(clipped, 'fs.write', policy.node?.security?.fs?.write, policy.security?.fs?.write, 'roots');
		collectClippedOperation(clipped, 'fs.delete', policy.node?.security?.fs?.delete, policy.security?.fs?.delete, 'roots');
		collectClippedOperation(clipped, 'net.egress', policy.node?.security?.net?.egress, policy.security?.net?.egress, 'hosts');
		collectClippedOperation(clipped, 'process.exec', policy.node?.security?.process?.exec, policy.security?.process?.exec, 'commands');
		return clipped.length ? `Outside model envelope: ${clipped.join(', ')}` : '';
	}

	function collectClippedOperation(
		clipped,
		label,
		requested,
		effective,
		scopeKey
	) {
		if (!requested || !effective) return;

		if (requested.mode !== effective.mode) {
			clipped.push(`${label}: ${requested.mode} -> ${effective.mode}`);
			return;
		}

		const requestedScope = requested[scopeKey] ?? [];
		const effectiveScope = effective[scopeKey] ?? [];

		if (requestedScope.length && JSON.stringify(requestedScope) !== JSON.stringify(effectiveScope)) {
			clipped.push(`${label} scope clipped`);
		}
	}

	legacy_pre_effect(
		() => (
			get(runtimeName),
			get(modelRuntimeSettings),
			get(localDx)
		),
		() => {
			set(envelopeWarning, runtimeEnvelopeWarning(get(runtimeName), get(modelRuntimeSettings), get(localDx)));
		}
	);

	legacy_pre_effect(() => (get(runtimeName)), () => {
		set(runtimeComponent, runtimeSettingsComponent(get(runtimeName)));
	});

	legacy_pre_effect_reset();
	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$c();
			var node = first_child(fragment_1);

			if_block(
				node,
				() => get(runtimeComponent) === Runtime_settings_base,
				($$anchor) => {
					Runtime_settings_base($$anchor, {
						get dx() {
							return get(localDx);
						},
						set dx($$value) {
							set(localDx, $$value);
						},
						$$legacy: true
					});
				},
				($$anchor) => {
					var fragment_3 = comment$1();
					var node_1 = first_child(fragment_3);

					component(node_1, () => get(runtimeComponent), ($$anchor, $$component) => {
						$$component($$anchor, {
							get dx() {
								return get(localDx);
							},
							set dx($$value) {
								set(localDx, $$value);
							},
							get tx() {
								return tx();
							},
							get runtime() {
								return get(runtimeName);
							},
							get modelRuntimeSettings() {
								return get(modelRuntimeSettings);
							},
							get popupPos() {
								return get(box).pos;
							},
							$$legacy: true
						});
					});

					append($$anchor, fragment_3);
				}
			);

			var node_2 = sibling(node, 2);

			if_block(node_2, () => get(envelopeWarning), ($$anchor) => {
				var p = root_4$2();
				var text = child(p);
				template_effect(() => set_text(text, get(envelopeWarning)));
				append($$anchor, p);
			});

			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_3$2 = template(`<div class="section svelte-1p0odh6"><h4 class="svelte-1p0odh6">File System</h4> <!> <!> <!> <!> <!> <!></div> <div class="section svelte-1p0odh6"><h4 class="svelte-1p0odh6">Network</h4> <!> <!></div> <div class="section svelte-1p0odh6"><h4 class="svelte-1p0odh6">Process</h4> <!> <!></div>`, 1);
var root_2$8 = template(`<div class="section svelte-1p0odh6"><h4 class="svelte-1p0odh6">Monitor</h4> <!> <!></div> <!>`, 1);
var root_4$1 = template(`<textarea class="json-editor svelte-1p0odh6" spellcheck="false"></textarea>`);
var root_5$3 = template(`<div class="runtime-error svelte-1p0odh6"> </div>`);
var root_1$b = template(`<div class="runtime-settings svelte-1p0odh6"><div class="tabs svelte-1p0odh6"><!> <!></div> <!> <!></div>`);

function Model_runtime_settings($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	const box = mutable_state({
		div: null,
		pos: null,
		title: 'Runtime Settings',
		ok: null,
		cancel: null
	});

	let settingsText = mutable_state('');
	let settingsError = mutable_state('');
	let currentSettings = mutable_state(null);
	let currentRuntime = null;
	let view = mutable_state('form');
	let scopeText = mutable_state(makeScopeText());
	const permissionOptions = ['allow', 'warn', 'deny'];

	onMount(() => {
		tx().send('modal div', get(box).div);
	});

	function show({ runtime, settings, pos, ok, cancel }) {
		currentRuntime = runtime;
		set(currentSettings, normalizeModelSettings(runtime, cloneSettings(settings)));
		syncTextFromSettings();
		syncAllowTextFromSettings();
		set(settingsError, '');
		set(view, 'form');
		mutate(box, get(box).title = `Runtime Settings: ${runtimeName(runtime)}`);
		mutate(box, get(box).pos = { ...pos });

		mutate(box, get(box).ok = () => {
			const parsed = get(view) === 'json' ? parseSettings() : collectFormSettings();

			if (parsed === undefined) {
				get(box).show(get(box).pos);
				return;
			}

			set(currentSettings, normalizeModelSettings(currentRuntime, parsed));
			ok?.(parsed);
		});

		mutate(box, get(box).cancel = () => {
			set(settingsError, '');
			cancel?.();
		});

		get(box).show(get(box).pos);
	}

	const handlers = { "-> show": show };

	function cloneSettings(settings) {
		if (!settings) return null;
		return JSON.parse(JSON.stringify(settings));
	}

	function settingsToText(settings) {
		if (!settings) return '';
		if (typeof settings === 'string') return JSON.stringify({ path: settings }, null, 2);
		return JSON.stringify(settings, null, 2);
	}

	function normalizeModelSettings(runtime, settings = null) {
		const runtimeSettings = getRuntimeSettings(runtime);
		const base = settings ?? runtimeSettings.makeModel();

		return runtimeSettings.normalizeModel?.(base) ?? base;
	}

	function collectFormSettings() {
		syncScopeListsFromText();
		set(settingsError, '');
		return normalizeModelSettings(currentRuntime, get(currentSettings));
	}

	function syncTextFromSettings() {
		set(settingsText, settingsToText(get(currentSettings)));
	}

	function syncSettingsFromText() {
		const parsed = parseSettings();

		if (parsed === undefined) return false;
		set(currentSettings, normalizeModelSettings(currentRuntime, parsed));
		syncAllowTextFromSettings();
		return true;
	}

	function setView(nextView) {
		if (nextView === get(view)) return;

		if (nextView === 'json') {
			syncScopeListsFromText();
			syncTextFromSettings();
			set(settingsError, '');
		} else if (!syncSettingsFromText()) {
			return;
		}

		set(view, nextView);
	}

	function syncAllowTextFromSettings() {
		set(scopeText, {
			fsReadRoots: listToText(get(currentSettings)?.security?.fs?.read?.roots),
			fsWriteRoots: listToText(get(currentSettings)?.security?.fs?.write?.roots),
			fsDeleteRoots: listToText(get(currentSettings)?.security?.fs?.delete?.roots),
			netEgressHosts: listToText(get(currentSettings)?.security?.net?.egress?.hosts),
			processExecCommands: listToText(get(currentSettings)?.security?.process?.exec?.commands)
		});
	}

	function syncScopeListsFromText() {
		const security = get(currentSettings)?.security;

		if (!security) return;
		security.fs.read.roots = textToList(get(scopeText).fsReadRoots);
		security.fs.write.roots = textToList(get(scopeText).fsWriteRoots);
		security.fs.delete.roots = textToList(get(scopeText).fsDeleteRoots);
		security.net.egress.hosts = textToList(get(scopeText).netEgressHosts);
		security.process.exec.commands = textToList(get(scopeText).processExecCommands);
	}

	function makeScopeText() {
		return {
			fsReadRoots: '',
			fsWriteRoots: '',
			fsDeleteRoots: '',
			netEgressHosts: '',
			processExecCommands: ''
		};
	}

	function listToText(values) {
		return Array.isArray(values) ? values.join('\n') : '';
	}

	function textToList(text) {
		return (text ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
	}

	function parseSettings() {
		const text = get(settingsText)?.trim() ?? '';

		if (!text) {
			set(settingsError, '');
			return null;
		}

		try {
			set(settingsError, '');
			return JSON.parse(text);
		} catch(error) {
			set(settingsError, error?.message ?? String(error));
			return undefined;
		}
	}

	function runtimeName(runtime) {
		return runtime?.split?.('/')?.at?.(-1) ?? runtime ?? 'runtime';
	}

	function hasPolicySettings(settings) {
		return !!(settings?.security?.fs && settings?.security?.net && settings?.security?.process);
	}

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$b();
			var div_1 = child(div);
			var node = child(div_1);
			var active = derived_safe_equal(() => get(view) === 'form');

			Button(node, {
				label: "Form",
				click: () => setView('form'),
				get active() {
					return get(active);
				}
			});

			var node_1 = sibling(node, 2);
			var active_1 = derived_safe_equal(() => get(view) === 'json');

			Button(node_1, {
				label: "JSON",
				click: () => setView('json'),
				get active() {
					return get(active_1);
				}
			});

			var node_2 = sibling(div_1, 2);

			if_block(
				node_2,
				() => get(view) === 'form' && get(currentSettings),
				($$anchor) => {
					var fragment_1 = root_2$8();
					var div_2 = first_child(fragment_1);
					var node_3 = sibling(child(div_2), 2);

					Label_checkbox(node_3, {
						label: "log messages",
						get on() {
							return get(currentSettings).monitor.logMessages;
						},
						set on($$value) {
							mutate(currentSettings, get(currentSettings).monitor.logMessages = $$value);
						},
						$$legacy: true
					});

					var node_4 = sibling(node_3, 2);

					Label_checkbox(node_4, {
						label: "log timings",
						get on() {
							return get(currentSettings).monitor.logTimings;
						},
						set on($$value) {
							mutate(currentSettings, get(currentSettings).monitor.logTimings = $$value);
						},
						$$legacy: true
					});

					var node_5 = sibling(div_2, 2);

					if_block(node_5, () => hasPolicySettings(get(currentSettings)), ($$anchor) => {
						var fragment_2 = root_3$2();
						var div_3 = first_child(fragment_2);
						var node_6 = sibling(child(div_3), 2);

						Label_select(node_6, {
							label: "read",
							get value() {
								return get(currentSettings).security.fs.read.mode;
							},
							set value($$value) {
								mutate(currentSettings, get(currentSettings).security.fs.read.mode = $$value);
							},
							options: permissionOptions,
							$$legacy: true
						});

						var node_7 = sibling(node_6, 2);

						Label_textarea(node_7, {
							label: "read roots",
							get text() {
								return get(scopeText).fsReadRoots;
							},
							set text($$value) {
								mutate(scopeText, get(scopeText).fsReadRoots = $$value);
							},
							$$legacy: true
						});

						var node_8 = sibling(node_7, 2);

						Label_select(node_8, {
							label: "write",
							get value() {
								return get(currentSettings).security.fs.write.mode;
							},
							set value($$value) {
								mutate(currentSettings, get(currentSettings).security.fs.write.mode = $$value);
							},
							options: permissionOptions,
							$$legacy: true
						});

						var node_9 = sibling(node_8, 2);

						Label_textarea(node_9, {
							label: "write roots",
							get text() {
								return get(scopeText).fsWriteRoots;
							},
							set text($$value) {
								mutate(scopeText, get(scopeText).fsWriteRoots = $$value);
							},
							$$legacy: true
						});

						var node_10 = sibling(node_9, 2);

						Label_select(node_10, {
							label: "delete",
							get value() {
								return get(currentSettings).security.fs.delete.mode;
							},
							set value($$value) {
								mutate(currentSettings, get(currentSettings).security.fs.delete.mode = $$value);
							},
							options: permissionOptions,
							$$legacy: true
						});

						var node_11 = sibling(node_10, 2);

						Label_textarea(node_11, {
							label: "delete roots",
							get text() {
								return get(scopeText).fsDeleteRoots;
							},
							set text($$value) {
								mutate(scopeText, get(scopeText).fsDeleteRoots = $$value);
							},
							$$legacy: true
						});

						var div_4 = sibling(div_3, 2);
						var node_12 = sibling(child(div_4), 2);

						Label_select(node_12, {
							label: "egress",
							get value() {
								return get(currentSettings).security.net.egress.mode;
							},
							set value($$value) {
								mutate(currentSettings, get(currentSettings).security.net.egress.mode = $$value);
							},
							options: permissionOptions,
							$$legacy: true
						});

						var node_13 = sibling(node_12, 2);

						Label_textarea(node_13, {
							label: "hosts",
							get text() {
								return get(scopeText).netEgressHosts;
							},
							set text($$value) {
								mutate(scopeText, get(scopeText).netEgressHosts = $$value);
							},
							$$legacy: true
						});

						var div_5 = sibling(div_4, 2);
						var node_14 = sibling(child(div_5), 2);

						Label_select(node_14, {
							label: "exec",
							get value() {
								return get(currentSettings).security.process.exec.mode;
							},
							set value($$value) {
								mutate(currentSettings, get(currentSettings).security.process.exec.mode = $$value);
							},
							options: permissionOptions,
							$$legacy: true
						});

						var node_15 = sibling(node_14, 2);

						Label_textarea(node_15, {
							label: "commands",
							get text() {
								return get(scopeText).processExecCommands;
							},
							set text($$value) {
								mutate(scopeText, get(scopeText).processExecCommands = $$value);
							},
							$$legacy: true
						});
						append($$anchor, fragment_2);
					});

					append($$anchor, fragment_1);
				},
				($$anchor) => {
					var textarea = root_4$1();
					bind_value(textarea, () => get(settingsText), ($$value) => set(settingsText, $$value));

					event("keydown", textarea, stopPropagation(function ($$arg) {
						bubble_event.call(this, $$props, $$arg);
					}));

					append($$anchor, textarea);
				}
			);

			var node_16 = sibling(node_2, 2);

			if_block(node_16, () => get(settingsError), ($$anchor) => {
				var div_6 = root_5$3();
				var text_1 = child(div_6);
				template_effect(() => set_text(text_1, get(settingsError)));
				append($$anchor, div_6);
			});
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "show", show);
	bind_prop($$props, "handlers", handlers);
	return pop({ show, handlers });
}

function Confirm_box($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	onMount(async () => {
		// send the box div
		tx().send('modal div', get(box).div);
	});

	// the popup box data
	const box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	const handlers = {
		"-> show"({ title, message, pos, ok, cancel }) {
			// set the box parameters
			mutate(box, get(box).title = title);
			mutate(box, get(box).ok = ok);
			mutate(box, get(box).cancel = cancel);
			// show
			get(box).show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		}
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_1$a = template(`<li><i> </i> <span class="choice-text svelte-1wos05d"> </span> <span class="choice-char svelte-1wos05d"> </span></li>`);
var root$8 = template(`<div class="svelte-1wos05d"><ul class="svelte-1wos05d"></ul></div>`);

function Context_menu($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	let context = mutable_state({ div: null, menu: [], show: () => {} });

	onMount(() => {
		mutate(context, get(context).show = show);
		// send the box div
		tx().send('modal div', get(context).div);
	});

	const handlers = {
		"-> context menu"({ menu, event }) {
			// set the menu
			mutate(context, get(context).menu = menu);
			// show the menu at the requested position
			get(context).show(event);
		}
	};

	// show the list - typically on a right click "oncontextmenu"
	function show(e) {
		// check
		if (get(context).menu.length <= 0) return;
		// calculate the width of the list
		setWidth();
		// the div has the display 'absolute' attribute - so we use client coordinates !
		mutate(context, get(context).div.style.display = "block");
		// + or -10 is to make sure the cursor is in the selection list
		mutate(context, get(context).div.style.left = `${e.clientX - 10}px`);
		mutate(context, get(context).div.style.top = `${e.clientY - 20}px`);
		// force an update
		set(context, get(context));
	}

	// calculate the width of the list
	function setWidth() {
		// determine the width of the clicklist
		let max = 0;

		get(context).menu.forEach((choice) => {
			const len = choice.text.length + (choice.char ? choice.char.length + 5 : 0);

			if (len > max) max = len;
		});

		// set the width of the UL
		get(context).div.querySelector("ul").style.width = (0.5 * max + 1.5).toString() + "rem";
	}

	// when getting out of the ul area
	function hide(e) {
		mutate(context, get(context).div.style.display = "none");
	}

	function goAway(e) {
		e.preventDefault();
		mutate(context, get(context).div.style.display = "none");
	}

	// when selecting in the ul
	function onClickLI(e) {
		// hide the list
		mutate(context, get(context).div.style.display = "none");

		// get the index
		let index = e.target.dataset.index ?? e.target.parentNode.dataset.index;

		// check if enabled
		if (get(context).menu[index]) {
			if (get(context).menu[index].state == "enabled") get(context).menu[index].action(e);
		}
	}

	function onKeydown(e) {}
	init();

	var div = root$8();

	bind_this(div, ($$value) => mutate(context, get(context).div = $$value), () => get(context)?.div);

	var ul = child(div);

	each(ul, 5, () => get(context).menu, index, ($$anchor, choice, index) => {
		var li = root_1$a();

		set_attribute(li, "data-index", index);

		var i = child(li);
		var text = child(i);

		var span = sibling(i, 2);
		var text_1 = child(span);

		var span_1 = sibling(span, 2);
		var text_2 = child(span_1);

		template_effect(() => {
			set_class(li, `${get(choice).state ?? ""} svelte-1wos05d`);
			set_class(i, `material-icons-outlined choice-icon ${get(choice).state ?? ""} svelte-1wos05d`);
			set_text(text, get(choice).icon);
			set_text(text_1, get(choice).text);
			set_text(text_2, get(choice).char ?? ' ');
		});

		event("click", li, onClickLI);
		event("keydown", li, onKeydown);
		append($$anchor, li);
	});
	event("mouseleave", ul, hide);
	event("click", div, hide);
	event("contextmenu", div, goAway);
	event("keydown", div, onKeydown);
	append($$anchor, div);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$7 = template(`<textarea name="txt-name" spellcheck="false" class="svelte-1xkqtu5"></textarea>`);

function Text_area_input$1($$anchor, $$props) {
	push($$props, false);

	let text = prop($$props, "text", 12),
		cols = prop($$props, "cols", 8),
		rows = prop($$props, "rows", 8);

	onMount(() => {});

	// only the escape key can go to the box
	function onKeydown(e) {
		if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
	}

	init();

	var textarea = root$7();

	template_effect(() => {
		set_attribute(textarea, "rows", rows());
		set_attribute(textarea, "cols", cols());
	});

	bind_value(textarea, text);
	event("keydown", textarea, onKeydown);
	append($$anchor, textarea);
	pop();
}

function Json_area_input($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	onMount(async () => {
		tx().send("modal div", get(box).div);
	});

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	// the text
	let text = mutable_state('');

	const handlers = {
		"-> json"({ title, pos, json, ok }) {
			// set the box parameters
			mutate(box, get(box).title = title);
			mutate(box, get(box).pos = { ...pos });

			// The ok function for the box
			mutate(box, get(box).ok = () => {
				// check
				const newJson = checkJSON();

				// check for empty 
				if (newJson?.length == 0) return ok ? ok('') : null;
				// save or restart
				newJson ? ok?.(newJson) : get(box).show(pos);
			});

			// transform json to text
			set(text, json ? JSON.stringify(json, null, '  ') : '');
			get(box).show(pos);
		}
	};

	function checkJSON() {
		// check for a SyntaxError
		let syntax = get(text).indexOf("SyntaxError");

		// remove the syntax error if any
		if (syntax != -1) set(text, syntax > 1 ? get(text).slice(0, syntax - 2) : '');
		// it could be that the content is just empty
		if (get(text).length == 0) return '';

		// convert the json to an object
		try {
			// parse the content of the field
			return JSON.parse(get(text));
		} catch(error) {
			// show the content followed by the error
			set(text, get(text) + '\n\n' + error);
			// no valid json
			return null;
		}
	}

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			Text_area_input$1($$anchor, {
				get text() {
					return get(text);
				},
				set text($$value) {
					set(text, $$value);
				},
				cols: "50",
				rows: "25",
				$$legacy: true
			});
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

function Text_area_input($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	// the text
	let newText = mutable_state('');

	const handlers = {
		"-> text"(
			{
				header,
				pos,
				text,
				ok = null,
				cancel = null
			}
		) {
			// set the box parameters
			mutate(box, get(box).title = header);

			mutate(box, get(box).ok = () => {
				ok?.(get(newText));
			});

			// set the text field
			set(newText, text);
			// show
			get(box).show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			Text_area_input$1($$anchor, {
				get text() {
					return get(newText);
				},
				set text($$value) {
					set(newText, $$value);
				},
				cols: "50",
				rows: "25",
				$$legacy: true
			});
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

/* eslint-disable no-bitwise */

const decodeCache = {};

function getDecodeCache (exclude) {
  let cache = decodeCache[exclude];
  if (cache) { return cache }

  cache = decodeCache[exclude] = [];

  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }

  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = '%' + ('0' + ch.toString(16).toUpperCase()).slice(-2);
  }

  return cache
}

// Decode percent-encoded string.
//
function decode$1 (string, exclude) {
  if (typeof exclude !== 'string') {
    exclude = decode$1.defaultChars;
  }

  const cache = getDecodeCache(exclude);

  return string.replace(/(%[a-f0-9]{2})+/gi, function (seq) {
    let result = '';

    for (let i = 0, l = seq.length; i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);

      if (b1 < 0x80) {
        result += cache[b1];
        continue
      }

      if ((b1 & 0xE0) === 0xC0 && (i + 3 < l)) {
        // 110xxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);

        if ((b2 & 0xC0) === 0x80) {
          const chr = ((b1 << 6) & 0x7C0) | (b2 & 0x3F);

          if (chr < 0x80) {
            result += '\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 3;
          continue
        }
      }

      if ((b1 & 0xF0) === 0xE0 && (i + 6 < l)) {
        // 1110xxxx 10xxxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
          const chr = ((b1 << 12) & 0xF000) | ((b2 << 6) & 0xFC0) | (b3 & 0x3F);

          if (chr < 0x800 || (chr >= 0xD800 && chr <= 0xDFFF)) {
            result += '\ufffd\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 6;
          continue
        }
      }

      if ((b1 & 0xF8) === 0xF0 && (i + 9 < l)) {
        // 111110xx 10xxxxxx 10xxxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
          let chr = ((b1 << 18) & 0x1C0000) | ((b2 << 12) & 0x3F000) | ((b3 << 6) & 0xFC0) | (b4 & 0x3F);

          if (chr < 0x10000 || chr > 0x10FFFF) {
            result += '\ufffd\ufffd\ufffd\ufffd';
          } else {
            chr -= 0x10000;
            result += String.fromCharCode(0xD800 + (chr >> 10), 0xDC00 + (chr & 0x3FF));
          }

          i += 9;
          continue
        }
      }

      result += '\ufffd';
    }

    return result
  })
}

decode$1.defaultChars = ';/?:@&=+$,#';
decode$1.componentChars = '';

const encodeCache = {};

// Create a lookup array where anything but characters in `chars` string
// and alphanumeric chars is percent-encoded.
//
function getEncodeCache (exclude) {
  let cache = encodeCache[exclude];
  if (cache) { return cache }

  cache = encodeCache[exclude] = [];

  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);

    if (/^[0-9a-z]$/i.test(ch)) {
      // always allow unencoded alphanumeric characters
      cache.push(ch);
    } else {
      cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
    }
  }

  for (let i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }

  return cache
}

// Encode unsafe characters with percent-encoding, skipping already
// encoded sequences.
//
//  - string       - string to encode
//  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
//  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
//
function encode$1 (string, exclude, keepEscaped) {
  if (typeof exclude !== 'string') {
    // encode(string, keepEscaped)
    keepEscaped = exclude;
    exclude = encode$1.defaultChars;
  }

  if (typeof keepEscaped === 'undefined') {
    keepEscaped = true;
  }

  const cache = getEncodeCache(exclude);
  let result = '';

  for (let i = 0, l = string.length; i < l; i++) {
    const code = string.charCodeAt(i);

    if (keepEscaped && code === 0x25 /* % */ && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue
      }
    }

    if (code < 128) {
      result += cache[code];
      continue
    }

    if (code >= 0xD800 && code <= 0xDFFF) {
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
        const nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue
        }
      }
      result += '%EF%BF%BD';
      continue
    }

    result += encodeURIComponent(string[i]);
  }

  return result
}

encode$1.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode$1.componentChars = "-_.!~*'()";

function format (url) {
  let result = '';

  result += url.protocol || '';
  result += url.slashes ? '//' : '';
  result += url.auth ? url.auth + '@' : '';

  if (url.hostname && url.hostname.indexOf(':') !== -1) {
    // ipv6 address
    result += '[' + url.hostname + ']';
  } else {
    result += url.hostname || '';
  }

  result += url.port ? ':' + url.port : '';
  result += url.pathname || '';
  result += url.search || '';
  result += url.hash || '';

  return result
}

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

//
// Changes from joyent/node:
//
// 1. No leading slash in paths,
//    e.g. in `url.parse('http://foo?bar')` pathname is ``, not `/`
//
// 2. Backslashes are not replaced with slashes,
//    so `http:\\example.org\` is treated like a relative path
//
// 3. Trailing colon is treated like a part of the path,
//    i.e. in `http://example.org:foo` pathname is `:foo`
//
// 4. Nothing is URL-encoded in the resulting object,
//    (in joyent/node some chars in auth and paths are encoded)
//
// 5. `url.parse()` does not have `parseQueryString` argument
//
// 6. Removed extraneous result properties: `host`, `path`, `query`, etc.,
//    which can be constructed using other parts of the url.
//

function Url () {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
const protocolPattern = /^([a-z0-9.+-]+:)/i;
const portPattern = /:[0-9]*$/;

// Special case for a simple path URL
/* eslint-disable-next-line no-useless-escape */
const simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;

// RFC 2396: characters reserved for delimiting URLs.
// We actually just auto-escape these.
const delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'];

// RFC 2396: characters not allowed for various reasons.
const unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims);

// Allowed by RFCs, but cause of XSS attacks.  Always escape these.
const autoEscape = ['\''].concat(unwise);
// Characters that are never ever allowed in a hostname.
// Note that any invalid chars are also handled, but these
// are the ones that are *expected* to be seen, so we fast-path
// them.
const nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape);
const hostEndingChars = ['/', '?', '#'];
const hostnameMaxLen = 255;
const hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
const hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
// protocols that can allow "unsafe" and "unwise" chars.
// protocols that never have a hostname.
const hostlessProtocol = {
  javascript: true,
  'javascript:': true
};
// protocols that always contain a // bit.
const slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  'http:': true,
  'https:': true,
  'ftp:': true,
  'gopher:': true,
  'file:': true
};

function urlParse (url, slashesDenoteHost) {
  if (url && url instanceof Url) return url

  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u
}

Url.prototype.parse = function (url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this
    }
  }

  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  /* eslint-disable-next-line no-useless-escape */
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {
    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    let auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }

    if (rest[hostEnd - 1] === ':') { hostEnd--; }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost(host);

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    const ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) { continue }
        if (!part.match(hostnamePartPattern)) {
          let newpart = '';
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    }

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }

  // chop off from the tail first.
  const hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) { this.pathname = rest; }
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '';
  }

  return this
};

Url.prototype.parseHost = function (host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) { this.hostname = host; }
};

var mdurl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  decode: decode$1,
  encode: encode$1,
  format: format,
  parse: urlParse
});

var Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;

var Cc = /[\0-\x1F\x7F-\x9F]/;

var regex$1 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;

var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

var regex = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;

var Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

var ucmicro = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Any: Any,
  Cc: Cc,
  Cf: regex$1,
  P: P,
  S: regex,
  Z: Z
});

// Generated using scripts/write-decode-map.ts
var htmlDecodeTree = new Uint16Array(
// prettier-ignore
"\u1d41<\xd5\u0131\u028a\u049d\u057b\u05d0\u0675\u06de\u07a2\u07d6\u080f\u0a4a\u0a91\u0da1\u0e6d\u0f09\u0f26\u10ca\u1228\u12e1\u1415\u149d\u14c3\u14df\u1525\0\0\0\0\0\0\u156b\u16cd\u198d\u1c12\u1ddd\u1f7e\u2060\u21b0\u228d\u23c0\u23fb\u2442\u2824\u2912\u2d08\u2e48\u2fce\u3016\u32ba\u3639\u37ac\u38fe\u3a28\u3a71\u3ae0\u3b2e\u0800EMabcfglmnoprstu\\bfms\x7f\x84\x8b\x90\x95\x98\xa6\xb3\xb9\xc8\xcflig\u803b\xc6\u40c6P\u803b&\u4026cute\u803b\xc1\u40c1reve;\u4102\u0100iyx}rc\u803b\xc2\u40c2;\u4410r;\uc000\ud835\udd04rave\u803b\xc0\u40c0pha;\u4391acr;\u4100d;\u6a53\u0100gp\x9d\xa1on;\u4104f;\uc000\ud835\udd38plyFunction;\u6061ing\u803b\xc5\u40c5\u0100cs\xbe\xc3r;\uc000\ud835\udc9cign;\u6254ilde\u803b\xc3\u40c3ml\u803b\xc4\u40c4\u0400aceforsu\xe5\xfb\xfe\u0117\u011c\u0122\u0127\u012a\u0100cr\xea\xf2kslash;\u6216\u0176\xf6\xf8;\u6ae7ed;\u6306y;\u4411\u0180crt\u0105\u010b\u0114ause;\u6235noullis;\u612ca;\u4392r;\uc000\ud835\udd05pf;\uc000\ud835\udd39eve;\u42d8c\xf2\u0113mpeq;\u624e\u0700HOacdefhilorsu\u014d\u0151\u0156\u0180\u019e\u01a2\u01b5\u01b7\u01ba\u01dc\u0215\u0273\u0278\u027ecy;\u4427PY\u803b\xa9\u40a9\u0180cpy\u015d\u0162\u017aute;\u4106\u0100;i\u0167\u0168\u62d2talDifferentialD;\u6145leys;\u612d\u0200aeio\u0189\u018e\u0194\u0198ron;\u410cdil\u803b\xc7\u40c7rc;\u4108nint;\u6230ot;\u410a\u0100dn\u01a7\u01adilla;\u40b8terDot;\u40b7\xf2\u017fi;\u43a7rcle\u0200DMPT\u01c7\u01cb\u01d1\u01d6ot;\u6299inus;\u6296lus;\u6295imes;\u6297o\u0100cs\u01e2\u01f8kwiseContourIntegral;\u6232eCurly\u0100DQ\u0203\u020foubleQuote;\u601duote;\u6019\u0200lnpu\u021e\u0228\u0247\u0255on\u0100;e\u0225\u0226\u6237;\u6a74\u0180git\u022f\u0236\u023aruent;\u6261nt;\u622fourIntegral;\u622e\u0100fr\u024c\u024e;\u6102oduct;\u6210nterClockwiseContourIntegral;\u6233oss;\u6a2fcr;\uc000\ud835\udc9ep\u0100;C\u0284\u0285\u62d3ap;\u624d\u0580DJSZacefios\u02a0\u02ac\u02b0\u02b4\u02b8\u02cb\u02d7\u02e1\u02e6\u0333\u048d\u0100;o\u0179\u02a5trahd;\u6911cy;\u4402cy;\u4405cy;\u440f\u0180grs\u02bf\u02c4\u02c7ger;\u6021r;\u61a1hv;\u6ae4\u0100ay\u02d0\u02d5ron;\u410e;\u4414l\u0100;t\u02dd\u02de\u6207a;\u4394r;\uc000\ud835\udd07\u0100af\u02eb\u0327\u0100cm\u02f0\u0322ritical\u0200ADGT\u0300\u0306\u0316\u031ccute;\u40b4o\u0174\u030b\u030d;\u42d9bleAcute;\u42ddrave;\u4060ilde;\u42dcond;\u62c4ferentialD;\u6146\u0470\u033d\0\0\0\u0342\u0354\0\u0405f;\uc000\ud835\udd3b\u0180;DE\u0348\u0349\u034d\u40a8ot;\u60dcqual;\u6250ble\u0300CDLRUV\u0363\u0372\u0382\u03cf\u03e2\u03f8ontourIntegra\xec\u0239o\u0274\u0379\0\0\u037b\xbb\u0349nArrow;\u61d3\u0100eo\u0387\u03a4ft\u0180ART\u0390\u0396\u03a1rrow;\u61d0ightArrow;\u61d4e\xe5\u02cang\u0100LR\u03ab\u03c4eft\u0100AR\u03b3\u03b9rrow;\u67f8ightArrow;\u67faightArrow;\u67f9ight\u0100AT\u03d8\u03derrow;\u61d2ee;\u62a8p\u0241\u03e9\0\0\u03efrrow;\u61d1ownArrow;\u61d5erticalBar;\u6225n\u0300ABLRTa\u0412\u042a\u0430\u045e\u047f\u037crrow\u0180;BU\u041d\u041e\u0422\u6193ar;\u6913pArrow;\u61f5reve;\u4311eft\u02d2\u043a\0\u0446\0\u0450ightVector;\u6950eeVector;\u695eector\u0100;B\u0459\u045a\u61bdar;\u6956ight\u01d4\u0467\0\u0471eeVector;\u695fector\u0100;B\u047a\u047b\u61c1ar;\u6957ee\u0100;A\u0486\u0487\u62a4rrow;\u61a7\u0100ct\u0492\u0497r;\uc000\ud835\udc9frok;\u4110\u0800NTacdfglmopqstux\u04bd\u04c0\u04c4\u04cb\u04de\u04e2\u04e7\u04ee\u04f5\u0521\u052f\u0536\u0552\u055d\u0560\u0565G;\u414aH\u803b\xd0\u40d0cute\u803b\xc9\u40c9\u0180aiy\u04d2\u04d7\u04dcron;\u411arc\u803b\xca\u40ca;\u442dot;\u4116r;\uc000\ud835\udd08rave\u803b\xc8\u40c8ement;\u6208\u0100ap\u04fa\u04fecr;\u4112ty\u0253\u0506\0\0\u0512mallSquare;\u65fberySmallSquare;\u65ab\u0100gp\u0526\u052aon;\u4118f;\uc000\ud835\udd3csilon;\u4395u\u0100ai\u053c\u0549l\u0100;T\u0542\u0543\u6a75ilde;\u6242librium;\u61cc\u0100ci\u0557\u055ar;\u6130m;\u6a73a;\u4397ml\u803b\xcb\u40cb\u0100ip\u056a\u056fsts;\u6203onentialE;\u6147\u0280cfios\u0585\u0588\u058d\u05b2\u05ccy;\u4424r;\uc000\ud835\udd09lled\u0253\u0597\0\0\u05a3mallSquare;\u65fcerySmallSquare;\u65aa\u0370\u05ba\0\u05bf\0\0\u05c4f;\uc000\ud835\udd3dAll;\u6200riertrf;\u6131c\xf2\u05cb\u0600JTabcdfgorst\u05e8\u05ec\u05ef\u05fa\u0600\u0612\u0616\u061b\u061d\u0623\u066c\u0672cy;\u4403\u803b>\u403emma\u0100;d\u05f7\u05f8\u4393;\u43dcreve;\u411e\u0180eiy\u0607\u060c\u0610dil;\u4122rc;\u411c;\u4413ot;\u4120r;\uc000\ud835\udd0a;\u62d9pf;\uc000\ud835\udd3eeater\u0300EFGLST\u0635\u0644\u064e\u0656\u065b\u0666qual\u0100;L\u063e\u063f\u6265ess;\u62dbullEqual;\u6267reater;\u6aa2ess;\u6277lantEqual;\u6a7eilde;\u6273cr;\uc000\ud835\udca2;\u626b\u0400Aacfiosu\u0685\u068b\u0696\u069b\u069e\u06aa\u06be\u06caRDcy;\u442a\u0100ct\u0690\u0694ek;\u42c7;\u405eirc;\u4124r;\u610clbertSpace;\u610b\u01f0\u06af\0\u06b2f;\u610dizontalLine;\u6500\u0100ct\u06c3\u06c5\xf2\u06a9rok;\u4126mp\u0144\u06d0\u06d8ownHum\xf0\u012fqual;\u624f\u0700EJOacdfgmnostu\u06fa\u06fe\u0703\u0707\u070e\u071a\u071e\u0721\u0728\u0744\u0778\u078b\u078f\u0795cy;\u4415lig;\u4132cy;\u4401cute\u803b\xcd\u40cd\u0100iy\u0713\u0718rc\u803b\xce\u40ce;\u4418ot;\u4130r;\u6111rave\u803b\xcc\u40cc\u0180;ap\u0720\u072f\u073f\u0100cg\u0734\u0737r;\u412ainaryI;\u6148lie\xf3\u03dd\u01f4\u0749\0\u0762\u0100;e\u074d\u074e\u622c\u0100gr\u0753\u0758ral;\u622bsection;\u62c2isible\u0100CT\u076c\u0772omma;\u6063imes;\u6062\u0180gpt\u077f\u0783\u0788on;\u412ef;\uc000\ud835\udd40a;\u4399cr;\u6110ilde;\u4128\u01eb\u079a\0\u079ecy;\u4406l\u803b\xcf\u40cf\u0280cfosu\u07ac\u07b7\u07bc\u07c2\u07d0\u0100iy\u07b1\u07b5rc;\u4134;\u4419r;\uc000\ud835\udd0dpf;\uc000\ud835\udd41\u01e3\u07c7\0\u07ccr;\uc000\ud835\udca5rcy;\u4408kcy;\u4404\u0380HJacfos\u07e4\u07e8\u07ec\u07f1\u07fd\u0802\u0808cy;\u4425cy;\u440cppa;\u439a\u0100ey\u07f6\u07fbdil;\u4136;\u441ar;\uc000\ud835\udd0epf;\uc000\ud835\udd42cr;\uc000\ud835\udca6\u0580JTaceflmost\u0825\u0829\u082c\u0850\u0863\u09b3\u09b8\u09c7\u09cd\u0a37\u0a47cy;\u4409\u803b<\u403c\u0280cmnpr\u0837\u083c\u0841\u0844\u084dute;\u4139bda;\u439bg;\u67ealacetrf;\u6112r;\u619e\u0180aey\u0857\u085c\u0861ron;\u413ddil;\u413b;\u441b\u0100fs\u0868\u0970t\u0500ACDFRTUVar\u087e\u08a9\u08b1\u08e0\u08e6\u08fc\u092f\u095b\u0390\u096a\u0100nr\u0883\u088fgleBracket;\u67e8row\u0180;BR\u0899\u089a\u089e\u6190ar;\u61e4ightArrow;\u61c6eiling;\u6308o\u01f5\u08b7\0\u08c3bleBracket;\u67e6n\u01d4\u08c8\0\u08d2eeVector;\u6961ector\u0100;B\u08db\u08dc\u61c3ar;\u6959loor;\u630aight\u0100AV\u08ef\u08f5rrow;\u6194ector;\u694e\u0100er\u0901\u0917e\u0180;AV\u0909\u090a\u0910\u62a3rrow;\u61a4ector;\u695aiangle\u0180;BE\u0924\u0925\u0929\u62b2ar;\u69cfqual;\u62b4p\u0180DTV\u0937\u0942\u094cownVector;\u6951eeVector;\u6960ector\u0100;B\u0956\u0957\u61bfar;\u6958ector\u0100;B\u0965\u0966\u61bcar;\u6952ight\xe1\u039cs\u0300EFGLST\u097e\u098b\u0995\u099d\u09a2\u09adqualGreater;\u62daullEqual;\u6266reater;\u6276ess;\u6aa1lantEqual;\u6a7dilde;\u6272r;\uc000\ud835\udd0f\u0100;e\u09bd\u09be\u62d8ftarrow;\u61daidot;\u413f\u0180npw\u09d4\u0a16\u0a1bg\u0200LRlr\u09de\u09f7\u0a02\u0a10eft\u0100AR\u09e6\u09ecrrow;\u67f5ightArrow;\u67f7ightArrow;\u67f6eft\u0100ar\u03b3\u0a0aight\xe1\u03bfight\xe1\u03caf;\uc000\ud835\udd43er\u0100LR\u0a22\u0a2ceftArrow;\u6199ightArrow;\u6198\u0180cht\u0a3e\u0a40\u0a42\xf2\u084c;\u61b0rok;\u4141;\u626a\u0400acefiosu\u0a5a\u0a5d\u0a60\u0a77\u0a7c\u0a85\u0a8b\u0a8ep;\u6905y;\u441c\u0100dl\u0a65\u0a6fiumSpace;\u605flintrf;\u6133r;\uc000\ud835\udd10nusPlus;\u6213pf;\uc000\ud835\udd44c\xf2\u0a76;\u439c\u0480Jacefostu\u0aa3\u0aa7\u0aad\u0ac0\u0b14\u0b19\u0d91\u0d97\u0d9ecy;\u440acute;\u4143\u0180aey\u0ab4\u0ab9\u0aberon;\u4147dil;\u4145;\u441d\u0180gsw\u0ac7\u0af0\u0b0eative\u0180MTV\u0ad3\u0adf\u0ae8ediumSpace;\u600bhi\u0100cn\u0ae6\u0ad8\xeb\u0ad9eryThi\xee\u0ad9ted\u0100GL\u0af8\u0b06reaterGreate\xf2\u0673essLes\xf3\u0a48Line;\u400ar;\uc000\ud835\udd11\u0200Bnpt\u0b22\u0b28\u0b37\u0b3areak;\u6060BreakingSpace;\u40a0f;\u6115\u0680;CDEGHLNPRSTV\u0b55\u0b56\u0b6a\u0b7c\u0ba1\u0beb\u0c04\u0c5e\u0c84\u0ca6\u0cd8\u0d61\u0d85\u6aec\u0100ou\u0b5b\u0b64ngruent;\u6262pCap;\u626doubleVerticalBar;\u6226\u0180lqx\u0b83\u0b8a\u0b9bement;\u6209ual\u0100;T\u0b92\u0b93\u6260ilde;\uc000\u2242\u0338ists;\u6204reater\u0380;EFGLST\u0bb6\u0bb7\u0bbd\u0bc9\u0bd3\u0bd8\u0be5\u626fqual;\u6271ullEqual;\uc000\u2267\u0338reater;\uc000\u226b\u0338ess;\u6279lantEqual;\uc000\u2a7e\u0338ilde;\u6275ump\u0144\u0bf2\u0bfdownHump;\uc000\u224e\u0338qual;\uc000\u224f\u0338e\u0100fs\u0c0a\u0c27tTriangle\u0180;BE\u0c1a\u0c1b\u0c21\u62eaar;\uc000\u29cf\u0338qual;\u62ecs\u0300;EGLST\u0c35\u0c36\u0c3c\u0c44\u0c4b\u0c58\u626equal;\u6270reater;\u6278ess;\uc000\u226a\u0338lantEqual;\uc000\u2a7d\u0338ilde;\u6274ested\u0100GL\u0c68\u0c79reaterGreater;\uc000\u2aa2\u0338essLess;\uc000\u2aa1\u0338recedes\u0180;ES\u0c92\u0c93\u0c9b\u6280qual;\uc000\u2aaf\u0338lantEqual;\u62e0\u0100ei\u0cab\u0cb9verseElement;\u620cghtTriangle\u0180;BE\u0ccb\u0ccc\u0cd2\u62ebar;\uc000\u29d0\u0338qual;\u62ed\u0100qu\u0cdd\u0d0cuareSu\u0100bp\u0ce8\u0cf9set\u0100;E\u0cf0\u0cf3\uc000\u228f\u0338qual;\u62e2erset\u0100;E\u0d03\u0d06\uc000\u2290\u0338qual;\u62e3\u0180bcp\u0d13\u0d24\u0d4eset\u0100;E\u0d1b\u0d1e\uc000\u2282\u20d2qual;\u6288ceeds\u0200;EST\u0d32\u0d33\u0d3b\u0d46\u6281qual;\uc000\u2ab0\u0338lantEqual;\u62e1ilde;\uc000\u227f\u0338erset\u0100;E\u0d58\u0d5b\uc000\u2283\u20d2qual;\u6289ilde\u0200;EFT\u0d6e\u0d6f\u0d75\u0d7f\u6241qual;\u6244ullEqual;\u6247ilde;\u6249erticalBar;\u6224cr;\uc000\ud835\udca9ilde\u803b\xd1\u40d1;\u439d\u0700Eacdfgmoprstuv\u0dbd\u0dc2\u0dc9\u0dd5\u0ddb\u0de0\u0de7\u0dfc\u0e02\u0e20\u0e22\u0e32\u0e3f\u0e44lig;\u4152cute\u803b\xd3\u40d3\u0100iy\u0dce\u0dd3rc\u803b\xd4\u40d4;\u441eblac;\u4150r;\uc000\ud835\udd12rave\u803b\xd2\u40d2\u0180aei\u0dee\u0df2\u0df6cr;\u414cga;\u43a9cron;\u439fpf;\uc000\ud835\udd46enCurly\u0100DQ\u0e0e\u0e1aoubleQuote;\u601cuote;\u6018;\u6a54\u0100cl\u0e27\u0e2cr;\uc000\ud835\udcaaash\u803b\xd8\u40d8i\u016c\u0e37\u0e3cde\u803b\xd5\u40d5es;\u6a37ml\u803b\xd6\u40d6er\u0100BP\u0e4b\u0e60\u0100ar\u0e50\u0e53r;\u603eac\u0100ek\u0e5a\u0e5c;\u63deet;\u63b4arenthesis;\u63dc\u0480acfhilors\u0e7f\u0e87\u0e8a\u0e8f\u0e92\u0e94\u0e9d\u0eb0\u0efcrtialD;\u6202y;\u441fr;\uc000\ud835\udd13i;\u43a6;\u43a0usMinus;\u40b1\u0100ip\u0ea2\u0eadncareplan\xe5\u069df;\u6119\u0200;eio\u0eb9\u0eba\u0ee0\u0ee4\u6abbcedes\u0200;EST\u0ec8\u0ec9\u0ecf\u0eda\u627aqual;\u6aaflantEqual;\u627cilde;\u627eme;\u6033\u0100dp\u0ee9\u0eeeuct;\u620fortion\u0100;a\u0225\u0ef9l;\u621d\u0100ci\u0f01\u0f06r;\uc000\ud835\udcab;\u43a8\u0200Ufos\u0f11\u0f16\u0f1b\u0f1fOT\u803b\"\u4022r;\uc000\ud835\udd14pf;\u611acr;\uc000\ud835\udcac\u0600BEacefhiorsu\u0f3e\u0f43\u0f47\u0f60\u0f73\u0fa7\u0faa\u0fad\u1096\u10a9\u10b4\u10bearr;\u6910G\u803b\xae\u40ae\u0180cnr\u0f4e\u0f53\u0f56ute;\u4154g;\u67ebr\u0100;t\u0f5c\u0f5d\u61a0l;\u6916\u0180aey\u0f67\u0f6c\u0f71ron;\u4158dil;\u4156;\u4420\u0100;v\u0f78\u0f79\u611cerse\u0100EU\u0f82\u0f99\u0100lq\u0f87\u0f8eement;\u620builibrium;\u61cbpEquilibrium;\u696fr\xbb\u0f79o;\u43a1ght\u0400ACDFTUVa\u0fc1\u0feb\u0ff3\u1022\u1028\u105b\u1087\u03d8\u0100nr\u0fc6\u0fd2gleBracket;\u67e9row\u0180;BL\u0fdc\u0fdd\u0fe1\u6192ar;\u61e5eftArrow;\u61c4eiling;\u6309o\u01f5\u0ff9\0\u1005bleBracket;\u67e7n\u01d4\u100a\0\u1014eeVector;\u695dector\u0100;B\u101d\u101e\u61c2ar;\u6955loor;\u630b\u0100er\u102d\u1043e\u0180;AV\u1035\u1036\u103c\u62a2rrow;\u61a6ector;\u695biangle\u0180;BE\u1050\u1051\u1055\u62b3ar;\u69d0qual;\u62b5p\u0180DTV\u1063\u106e\u1078ownVector;\u694feeVector;\u695cector\u0100;B\u1082\u1083\u61bear;\u6954ector\u0100;B\u1091\u1092\u61c0ar;\u6953\u0100pu\u109b\u109ef;\u611dndImplies;\u6970ightarrow;\u61db\u0100ch\u10b9\u10bcr;\u611b;\u61b1leDelayed;\u69f4\u0680HOacfhimoqstu\u10e4\u10f1\u10f7\u10fd\u1119\u111e\u1151\u1156\u1161\u1167\u11b5\u11bb\u11bf\u0100Cc\u10e9\u10eeHcy;\u4429y;\u4428FTcy;\u442ccute;\u415a\u0280;aeiy\u1108\u1109\u110e\u1113\u1117\u6abcron;\u4160dil;\u415erc;\u415c;\u4421r;\uc000\ud835\udd16ort\u0200DLRU\u112a\u1134\u113e\u1149ownArrow\xbb\u041eeftArrow\xbb\u089aightArrow\xbb\u0fddpArrow;\u6191gma;\u43a3allCircle;\u6218pf;\uc000\ud835\udd4a\u0272\u116d\0\0\u1170t;\u621aare\u0200;ISU\u117b\u117c\u1189\u11af\u65a1ntersection;\u6293u\u0100bp\u118f\u119eset\u0100;E\u1197\u1198\u628fqual;\u6291erset\u0100;E\u11a8\u11a9\u6290qual;\u6292nion;\u6294cr;\uc000\ud835\udcaear;\u62c6\u0200bcmp\u11c8\u11db\u1209\u120b\u0100;s\u11cd\u11ce\u62d0et\u0100;E\u11cd\u11d5qual;\u6286\u0100ch\u11e0\u1205eeds\u0200;EST\u11ed\u11ee\u11f4\u11ff\u627bqual;\u6ab0lantEqual;\u627dilde;\u627fTh\xe1\u0f8c;\u6211\u0180;es\u1212\u1213\u1223\u62d1rset\u0100;E\u121c\u121d\u6283qual;\u6287et\xbb\u1213\u0580HRSacfhiors\u123e\u1244\u1249\u1255\u125e\u1271\u1276\u129f\u12c2\u12c8\u12d1ORN\u803b\xde\u40deADE;\u6122\u0100Hc\u124e\u1252cy;\u440by;\u4426\u0100bu\u125a\u125c;\u4009;\u43a4\u0180aey\u1265\u126a\u126fron;\u4164dil;\u4162;\u4422r;\uc000\ud835\udd17\u0100ei\u127b\u1289\u01f2\u1280\0\u1287efore;\u6234a;\u4398\u0100cn\u128e\u1298kSpace;\uc000\u205f\u200aSpace;\u6009lde\u0200;EFT\u12ab\u12ac\u12b2\u12bc\u623cqual;\u6243ullEqual;\u6245ilde;\u6248pf;\uc000\ud835\udd4bipleDot;\u60db\u0100ct\u12d6\u12dbr;\uc000\ud835\udcafrok;\u4166\u0ae1\u12f7\u130e\u131a\u1326\0\u132c\u1331\0\0\0\0\0\u1338\u133d\u1377\u1385\0\u13ff\u1404\u140a\u1410\u0100cr\u12fb\u1301ute\u803b\xda\u40dar\u0100;o\u1307\u1308\u619fcir;\u6949r\u01e3\u1313\0\u1316y;\u440eve;\u416c\u0100iy\u131e\u1323rc\u803b\xdb\u40db;\u4423blac;\u4170r;\uc000\ud835\udd18rave\u803b\xd9\u40d9acr;\u416a\u0100di\u1341\u1369er\u0100BP\u1348\u135d\u0100ar\u134d\u1350r;\u405fac\u0100ek\u1357\u1359;\u63dfet;\u63b5arenthesis;\u63ddon\u0100;P\u1370\u1371\u62c3lus;\u628e\u0100gp\u137b\u137fon;\u4172f;\uc000\ud835\udd4c\u0400ADETadps\u1395\u13ae\u13b8\u13c4\u03e8\u13d2\u13d7\u13f3rrow\u0180;BD\u1150\u13a0\u13a4ar;\u6912ownArrow;\u61c5ownArrow;\u6195quilibrium;\u696eee\u0100;A\u13cb\u13cc\u62a5rrow;\u61a5own\xe1\u03f3er\u0100LR\u13de\u13e8eftArrow;\u6196ightArrow;\u6197i\u0100;l\u13f9\u13fa\u43d2on;\u43a5ing;\u416ecr;\uc000\ud835\udcb0ilde;\u4168ml\u803b\xdc\u40dc\u0480Dbcdefosv\u1427\u142c\u1430\u1433\u143e\u1485\u148a\u1490\u1496ash;\u62abar;\u6aeby;\u4412ash\u0100;l\u143b\u143c\u62a9;\u6ae6\u0100er\u1443\u1445;\u62c1\u0180bty\u144c\u1450\u147aar;\u6016\u0100;i\u144f\u1455cal\u0200BLST\u1461\u1465\u146a\u1474ar;\u6223ine;\u407ceparator;\u6758ilde;\u6240ThinSpace;\u600ar;\uc000\ud835\udd19pf;\uc000\ud835\udd4dcr;\uc000\ud835\udcb1dash;\u62aa\u0280cefos\u14a7\u14ac\u14b1\u14b6\u14bcirc;\u4174dge;\u62c0r;\uc000\ud835\udd1apf;\uc000\ud835\udd4ecr;\uc000\ud835\udcb2\u0200fios\u14cb\u14d0\u14d2\u14d8r;\uc000\ud835\udd1b;\u439epf;\uc000\ud835\udd4fcr;\uc000\ud835\udcb3\u0480AIUacfosu\u14f1\u14f5\u14f9\u14fd\u1504\u150f\u1514\u151a\u1520cy;\u442fcy;\u4407cy;\u442ecute\u803b\xdd\u40dd\u0100iy\u1509\u150drc;\u4176;\u442br;\uc000\ud835\udd1cpf;\uc000\ud835\udd50cr;\uc000\ud835\udcb4ml;\u4178\u0400Hacdefos\u1535\u1539\u153f\u154b\u154f\u155d\u1560\u1564cy;\u4416cute;\u4179\u0100ay\u1544\u1549ron;\u417d;\u4417ot;\u417b\u01f2\u1554\0\u155boWidt\xe8\u0ad9a;\u4396r;\u6128pf;\u6124cr;\uc000\ud835\udcb5\u0be1\u1583\u158a\u1590\0\u15b0\u15b6\u15bf\0\0\0\0\u15c6\u15db\u15eb\u165f\u166d\0\u1695\u169b\u16b2\u16b9\0\u16becute\u803b\xe1\u40e1reve;\u4103\u0300;Ediuy\u159c\u159d\u15a1\u15a3\u15a8\u15ad\u623e;\uc000\u223e\u0333;\u623frc\u803b\xe2\u40e2te\u80bb\xb4\u0306;\u4430lig\u803b\xe6\u40e6\u0100;r\xb2\u15ba;\uc000\ud835\udd1erave\u803b\xe0\u40e0\u0100ep\u15ca\u15d6\u0100fp\u15cf\u15d4sym;\u6135\xe8\u15d3ha;\u43b1\u0100ap\u15dfc\u0100cl\u15e4\u15e7r;\u4101g;\u6a3f\u0264\u15f0\0\0\u160a\u0280;adsv\u15fa\u15fb\u15ff\u1601\u1607\u6227nd;\u6a55;\u6a5clope;\u6a58;\u6a5a\u0380;elmrsz\u1618\u1619\u161b\u161e\u163f\u164f\u1659\u6220;\u69a4e\xbb\u1619sd\u0100;a\u1625\u1626\u6221\u0461\u1630\u1632\u1634\u1636\u1638\u163a\u163c\u163e;\u69a8;\u69a9;\u69aa;\u69ab;\u69ac;\u69ad;\u69ae;\u69aft\u0100;v\u1645\u1646\u621fb\u0100;d\u164c\u164d\u62be;\u699d\u0100pt\u1654\u1657h;\u6222\xbb\xb9arr;\u637c\u0100gp\u1663\u1667on;\u4105f;\uc000\ud835\udd52\u0380;Eaeiop\u12c1\u167b\u167d\u1682\u1684\u1687\u168a;\u6a70cir;\u6a6f;\u624ad;\u624bs;\u4027rox\u0100;e\u12c1\u1692\xf1\u1683ing\u803b\xe5\u40e5\u0180cty\u16a1\u16a6\u16a8r;\uc000\ud835\udcb6;\u402amp\u0100;e\u12c1\u16af\xf1\u0288ilde\u803b\xe3\u40e3ml\u803b\xe4\u40e4\u0100ci\u16c2\u16c8onin\xf4\u0272nt;\u6a11\u0800Nabcdefiklnoprsu\u16ed\u16f1\u1730\u173c\u1743\u1748\u1778\u177d\u17e0\u17e6\u1839\u1850\u170d\u193d\u1948\u1970ot;\u6aed\u0100cr\u16f6\u171ek\u0200ceps\u1700\u1705\u170d\u1713ong;\u624cpsilon;\u43f6rime;\u6035im\u0100;e\u171a\u171b\u623dq;\u62cd\u0176\u1722\u1726ee;\u62bded\u0100;g\u172c\u172d\u6305e\xbb\u172drk\u0100;t\u135c\u1737brk;\u63b6\u0100oy\u1701\u1741;\u4431quo;\u601e\u0280cmprt\u1753\u175b\u1761\u1764\u1768aus\u0100;e\u010a\u0109ptyv;\u69b0s\xe9\u170cno\xf5\u0113\u0180ahw\u176f\u1771\u1773;\u43b2;\u6136een;\u626cr;\uc000\ud835\udd1fg\u0380costuvw\u178d\u179d\u17b3\u17c1\u17d5\u17db\u17de\u0180aiu\u1794\u1796\u179a\xf0\u0760rc;\u65efp\xbb\u1371\u0180dpt\u17a4\u17a8\u17adot;\u6a00lus;\u6a01imes;\u6a02\u0271\u17b9\0\0\u17becup;\u6a06ar;\u6605riangle\u0100du\u17cd\u17d2own;\u65bdp;\u65b3plus;\u6a04e\xe5\u1444\xe5\u14adarow;\u690d\u0180ako\u17ed\u1826\u1835\u0100cn\u17f2\u1823k\u0180lst\u17fa\u05ab\u1802ozenge;\u69ebriangle\u0200;dlr\u1812\u1813\u1818\u181d\u65b4own;\u65beeft;\u65c2ight;\u65b8k;\u6423\u01b1\u182b\0\u1833\u01b2\u182f\0\u1831;\u6592;\u65914;\u6593ck;\u6588\u0100eo\u183e\u184d\u0100;q\u1843\u1846\uc000=\u20e5uiv;\uc000\u2261\u20e5t;\u6310\u0200ptwx\u1859\u185e\u1867\u186cf;\uc000\ud835\udd53\u0100;t\u13cb\u1863om\xbb\u13cctie;\u62c8\u0600DHUVbdhmptuv\u1885\u1896\u18aa\u18bb\u18d7\u18db\u18ec\u18ff\u1905\u190a\u1910\u1921\u0200LRlr\u188e\u1890\u1892\u1894;\u6557;\u6554;\u6556;\u6553\u0280;DUdu\u18a1\u18a2\u18a4\u18a6\u18a8\u6550;\u6566;\u6569;\u6564;\u6567\u0200LRlr\u18b3\u18b5\u18b7\u18b9;\u655d;\u655a;\u655c;\u6559\u0380;HLRhlr\u18ca\u18cb\u18cd\u18cf\u18d1\u18d3\u18d5\u6551;\u656c;\u6563;\u6560;\u656b;\u6562;\u655fox;\u69c9\u0200LRlr\u18e4\u18e6\u18e8\u18ea;\u6555;\u6552;\u6510;\u650c\u0280;DUdu\u06bd\u18f7\u18f9\u18fb\u18fd;\u6565;\u6568;\u652c;\u6534inus;\u629flus;\u629eimes;\u62a0\u0200LRlr\u1919\u191b\u191d\u191f;\u655b;\u6558;\u6518;\u6514\u0380;HLRhlr\u1930\u1931\u1933\u1935\u1937\u1939\u193b\u6502;\u656a;\u6561;\u655e;\u653c;\u6524;\u651c\u0100ev\u0123\u1942bar\u803b\xa6\u40a6\u0200ceio\u1951\u1956\u195a\u1960r;\uc000\ud835\udcb7mi;\u604fm\u0100;e\u171a\u171cl\u0180;bh\u1968\u1969\u196b\u405c;\u69c5sub;\u67c8\u016c\u1974\u197el\u0100;e\u1979\u197a\u6022t\xbb\u197ap\u0180;Ee\u012f\u1985\u1987;\u6aae\u0100;q\u06dc\u06db\u0ce1\u19a7\0\u19e8\u1a11\u1a15\u1a32\0\u1a37\u1a50\0\0\u1ab4\0\0\u1ac1\0\0\u1b21\u1b2e\u1b4d\u1b52\0\u1bfd\0\u1c0c\u0180cpr\u19ad\u19b2\u19ddute;\u4107\u0300;abcds\u19bf\u19c0\u19c4\u19ca\u19d5\u19d9\u6229nd;\u6a44rcup;\u6a49\u0100au\u19cf\u19d2p;\u6a4bp;\u6a47ot;\u6a40;\uc000\u2229\ufe00\u0100eo\u19e2\u19e5t;\u6041\xee\u0693\u0200aeiu\u19f0\u19fb\u1a01\u1a05\u01f0\u19f5\0\u19f8s;\u6a4don;\u410ddil\u803b\xe7\u40e7rc;\u4109ps\u0100;s\u1a0c\u1a0d\u6a4cm;\u6a50ot;\u410b\u0180dmn\u1a1b\u1a20\u1a26il\u80bb\xb8\u01adptyv;\u69b2t\u8100\xa2;e\u1a2d\u1a2e\u40a2r\xe4\u01b2r;\uc000\ud835\udd20\u0180cei\u1a3d\u1a40\u1a4dy;\u4447ck\u0100;m\u1a47\u1a48\u6713ark\xbb\u1a48;\u43c7r\u0380;Ecefms\u1a5f\u1a60\u1a62\u1a6b\u1aa4\u1aaa\u1aae\u65cb;\u69c3\u0180;el\u1a69\u1a6a\u1a6d\u42c6q;\u6257e\u0261\u1a74\0\0\u1a88rrow\u0100lr\u1a7c\u1a81eft;\u61baight;\u61bb\u0280RSacd\u1a92\u1a94\u1a96\u1a9a\u1a9f\xbb\u0f47;\u64c8st;\u629birc;\u629aash;\u629dnint;\u6a10id;\u6aefcir;\u69c2ubs\u0100;u\u1abb\u1abc\u6663it\xbb\u1abc\u02ec\u1ac7\u1ad4\u1afa\0\u1b0aon\u0100;e\u1acd\u1ace\u403a\u0100;q\xc7\xc6\u026d\u1ad9\0\0\u1ae2a\u0100;t\u1ade\u1adf\u402c;\u4040\u0180;fl\u1ae8\u1ae9\u1aeb\u6201\xee\u1160e\u0100mx\u1af1\u1af6ent\xbb\u1ae9e\xf3\u024d\u01e7\u1afe\0\u1b07\u0100;d\u12bb\u1b02ot;\u6a6dn\xf4\u0246\u0180fry\u1b10\u1b14\u1b17;\uc000\ud835\udd54o\xe4\u0254\u8100\xa9;s\u0155\u1b1dr;\u6117\u0100ao\u1b25\u1b29rr;\u61b5ss;\u6717\u0100cu\u1b32\u1b37r;\uc000\ud835\udcb8\u0100bp\u1b3c\u1b44\u0100;e\u1b41\u1b42\u6acf;\u6ad1\u0100;e\u1b49\u1b4a\u6ad0;\u6ad2dot;\u62ef\u0380delprvw\u1b60\u1b6c\u1b77\u1b82\u1bac\u1bd4\u1bf9arr\u0100lr\u1b68\u1b6a;\u6938;\u6935\u0270\u1b72\0\0\u1b75r;\u62dec;\u62dfarr\u0100;p\u1b7f\u1b80\u61b6;\u693d\u0300;bcdos\u1b8f\u1b90\u1b96\u1ba1\u1ba5\u1ba8\u622arcap;\u6a48\u0100au\u1b9b\u1b9ep;\u6a46p;\u6a4aot;\u628dr;\u6a45;\uc000\u222a\ufe00\u0200alrv\u1bb5\u1bbf\u1bde\u1be3rr\u0100;m\u1bbc\u1bbd\u61b7;\u693cy\u0180evw\u1bc7\u1bd4\u1bd8q\u0270\u1bce\0\0\u1bd2re\xe3\u1b73u\xe3\u1b75ee;\u62ceedge;\u62cfen\u803b\xa4\u40a4earrow\u0100lr\u1bee\u1bf3eft\xbb\u1b80ight\xbb\u1bbde\xe4\u1bdd\u0100ci\u1c01\u1c07onin\xf4\u01f7nt;\u6231lcty;\u632d\u0980AHabcdefhijlorstuwz\u1c38\u1c3b\u1c3f\u1c5d\u1c69\u1c75\u1c8a\u1c9e\u1cac\u1cb7\u1cfb\u1cff\u1d0d\u1d7b\u1d91\u1dab\u1dbb\u1dc6\u1dcdr\xf2\u0381ar;\u6965\u0200glrs\u1c48\u1c4d\u1c52\u1c54ger;\u6020eth;\u6138\xf2\u1133h\u0100;v\u1c5a\u1c5b\u6010\xbb\u090a\u016b\u1c61\u1c67arow;\u690fa\xe3\u0315\u0100ay\u1c6e\u1c73ron;\u410f;\u4434\u0180;ao\u0332\u1c7c\u1c84\u0100gr\u02bf\u1c81r;\u61catseq;\u6a77\u0180glm\u1c91\u1c94\u1c98\u803b\xb0\u40b0ta;\u43b4ptyv;\u69b1\u0100ir\u1ca3\u1ca8sht;\u697f;\uc000\ud835\udd21ar\u0100lr\u1cb3\u1cb5\xbb\u08dc\xbb\u101e\u0280aegsv\u1cc2\u0378\u1cd6\u1cdc\u1ce0m\u0180;os\u0326\u1cca\u1cd4nd\u0100;s\u0326\u1cd1uit;\u6666amma;\u43ddin;\u62f2\u0180;io\u1ce7\u1ce8\u1cf8\u40f7de\u8100\xf7;o\u1ce7\u1cf0ntimes;\u62c7n\xf8\u1cf7cy;\u4452c\u026f\u1d06\0\0\u1d0arn;\u631eop;\u630d\u0280lptuw\u1d18\u1d1d\u1d22\u1d49\u1d55lar;\u4024f;\uc000\ud835\udd55\u0280;emps\u030b\u1d2d\u1d37\u1d3d\u1d42q\u0100;d\u0352\u1d33ot;\u6251inus;\u6238lus;\u6214quare;\u62a1blebarwedg\xe5\xfan\u0180adh\u112e\u1d5d\u1d67ownarrow\xf3\u1c83arpoon\u0100lr\u1d72\u1d76ef\xf4\u1cb4igh\xf4\u1cb6\u0162\u1d7f\u1d85karo\xf7\u0f42\u026f\u1d8a\0\0\u1d8ern;\u631fop;\u630c\u0180cot\u1d98\u1da3\u1da6\u0100ry\u1d9d\u1da1;\uc000\ud835\udcb9;\u4455l;\u69f6rok;\u4111\u0100dr\u1db0\u1db4ot;\u62f1i\u0100;f\u1dba\u1816\u65bf\u0100ah\u1dc0\u1dc3r\xf2\u0429a\xf2\u0fa6angle;\u69a6\u0100ci\u1dd2\u1dd5y;\u445fgrarr;\u67ff\u0900Dacdefglmnopqrstux\u1e01\u1e09\u1e19\u1e38\u0578\u1e3c\u1e49\u1e61\u1e7e\u1ea5\u1eaf\u1ebd\u1ee1\u1f2a\u1f37\u1f44\u1f4e\u1f5a\u0100Do\u1e06\u1d34o\xf4\u1c89\u0100cs\u1e0e\u1e14ute\u803b\xe9\u40e9ter;\u6a6e\u0200aioy\u1e22\u1e27\u1e31\u1e36ron;\u411br\u0100;c\u1e2d\u1e2e\u6256\u803b\xea\u40ealon;\u6255;\u444dot;\u4117\u0100Dr\u1e41\u1e45ot;\u6252;\uc000\ud835\udd22\u0180;rs\u1e50\u1e51\u1e57\u6a9aave\u803b\xe8\u40e8\u0100;d\u1e5c\u1e5d\u6a96ot;\u6a98\u0200;ils\u1e6a\u1e6b\u1e72\u1e74\u6a99nters;\u63e7;\u6113\u0100;d\u1e79\u1e7a\u6a95ot;\u6a97\u0180aps\u1e85\u1e89\u1e97cr;\u4113ty\u0180;sv\u1e92\u1e93\u1e95\u6205et\xbb\u1e93p\u01001;\u1e9d\u1ea4\u0133\u1ea1\u1ea3;\u6004;\u6005\u6003\u0100gs\u1eaa\u1eac;\u414bp;\u6002\u0100gp\u1eb4\u1eb8on;\u4119f;\uc000\ud835\udd56\u0180als\u1ec4\u1ece\u1ed2r\u0100;s\u1eca\u1ecb\u62d5l;\u69e3us;\u6a71i\u0180;lv\u1eda\u1edb\u1edf\u43b5on\xbb\u1edb;\u43f5\u0200csuv\u1eea\u1ef3\u1f0b\u1f23\u0100io\u1eef\u1e31rc\xbb\u1e2e\u0269\u1ef9\0\0\u1efb\xed\u0548ant\u0100gl\u1f02\u1f06tr\xbb\u1e5dess\xbb\u1e7a\u0180aei\u1f12\u1f16\u1f1als;\u403dst;\u625fv\u0100;D\u0235\u1f20D;\u6a78parsl;\u69e5\u0100Da\u1f2f\u1f33ot;\u6253rr;\u6971\u0180cdi\u1f3e\u1f41\u1ef8r;\u612fo\xf4\u0352\u0100ah\u1f49\u1f4b;\u43b7\u803b\xf0\u40f0\u0100mr\u1f53\u1f57l\u803b\xeb\u40ebo;\u60ac\u0180cip\u1f61\u1f64\u1f67l;\u4021s\xf4\u056e\u0100eo\u1f6c\u1f74ctatio\xee\u0559nential\xe5\u0579\u09e1\u1f92\0\u1f9e\0\u1fa1\u1fa7\0\0\u1fc6\u1fcc\0\u1fd3\0\u1fe6\u1fea\u2000\0\u2008\u205allingdotse\xf1\u1e44y;\u4444male;\u6640\u0180ilr\u1fad\u1fb3\u1fc1lig;\u8000\ufb03\u0269\u1fb9\0\0\u1fbdg;\u8000\ufb00ig;\u8000\ufb04;\uc000\ud835\udd23lig;\u8000\ufb01lig;\uc000fj\u0180alt\u1fd9\u1fdc\u1fe1t;\u666dig;\u8000\ufb02ns;\u65b1of;\u4192\u01f0\u1fee\0\u1ff3f;\uc000\ud835\udd57\u0100ak\u05bf\u1ff7\u0100;v\u1ffc\u1ffd\u62d4;\u6ad9artint;\u6a0d\u0100ao\u200c\u2055\u0100cs\u2011\u2052\u03b1\u201a\u2030\u2038\u2045\u2048\0\u2050\u03b2\u2022\u2025\u2027\u202a\u202c\0\u202e\u803b\xbd\u40bd;\u6153\u803b\xbc\u40bc;\u6155;\u6159;\u615b\u01b3\u2034\0\u2036;\u6154;\u6156\u02b4\u203e\u2041\0\0\u2043\u803b\xbe\u40be;\u6157;\u615c5;\u6158\u01b6\u204c\0\u204e;\u615a;\u615d8;\u615el;\u6044wn;\u6322cr;\uc000\ud835\udcbb\u0880Eabcdefgijlnorstv\u2082\u2089\u209f\u20a5\u20b0\u20b4\u20f0\u20f5\u20fa\u20ff\u2103\u2112\u2138\u0317\u213e\u2152\u219e\u0100;l\u064d\u2087;\u6a8c\u0180cmp\u2090\u2095\u209dute;\u41f5ma\u0100;d\u209c\u1cda\u43b3;\u6a86reve;\u411f\u0100iy\u20aa\u20aerc;\u411d;\u4433ot;\u4121\u0200;lqs\u063e\u0642\u20bd\u20c9\u0180;qs\u063e\u064c\u20c4lan\xf4\u0665\u0200;cdl\u0665\u20d2\u20d5\u20e5c;\u6aa9ot\u0100;o\u20dc\u20dd\u6a80\u0100;l\u20e2\u20e3\u6a82;\u6a84\u0100;e\u20ea\u20ed\uc000\u22db\ufe00s;\u6a94r;\uc000\ud835\udd24\u0100;g\u0673\u061bmel;\u6137cy;\u4453\u0200;Eaj\u065a\u210c\u210e\u2110;\u6a92;\u6aa5;\u6aa4\u0200Eaes\u211b\u211d\u2129\u2134;\u6269p\u0100;p\u2123\u2124\u6a8arox\xbb\u2124\u0100;q\u212e\u212f\u6a88\u0100;q\u212e\u211bim;\u62e7pf;\uc000\ud835\udd58\u0100ci\u2143\u2146r;\u610am\u0180;el\u066b\u214e\u2150;\u6a8e;\u6a90\u8300>;cdlqr\u05ee\u2160\u216a\u216e\u2173\u2179\u0100ci\u2165\u2167;\u6aa7r;\u6a7aot;\u62d7Par;\u6995uest;\u6a7c\u0280adels\u2184\u216a\u2190\u0656\u219b\u01f0\u2189\0\u218epro\xf8\u209er;\u6978q\u0100lq\u063f\u2196les\xf3\u2088i\xed\u066b\u0100en\u21a3\u21adrtneqq;\uc000\u2269\ufe00\xc5\u21aa\u0500Aabcefkosy\u21c4\u21c7\u21f1\u21f5\u21fa\u2218\u221d\u222f\u2268\u227dr\xf2\u03a0\u0200ilmr\u21d0\u21d4\u21d7\u21dbrs\xf0\u1484f\xbb\u2024il\xf4\u06a9\u0100dr\u21e0\u21e4cy;\u444a\u0180;cw\u08f4\u21eb\u21efir;\u6948;\u61adar;\u610firc;\u4125\u0180alr\u2201\u220e\u2213rts\u0100;u\u2209\u220a\u6665it\xbb\u220alip;\u6026con;\u62b9r;\uc000\ud835\udd25s\u0100ew\u2223\u2229arow;\u6925arow;\u6926\u0280amopr\u223a\u223e\u2243\u225e\u2263rr;\u61fftht;\u623bk\u0100lr\u2249\u2253eftarrow;\u61a9ightarrow;\u61aaf;\uc000\ud835\udd59bar;\u6015\u0180clt\u226f\u2274\u2278r;\uc000\ud835\udcbdas\xe8\u21f4rok;\u4127\u0100bp\u2282\u2287ull;\u6043hen\xbb\u1c5b\u0ae1\u22a3\0\u22aa\0\u22b8\u22c5\u22ce\0\u22d5\u22f3\0\0\u22f8\u2322\u2367\u2362\u237f\0\u2386\u23aa\u23b4cute\u803b\xed\u40ed\u0180;iy\u0771\u22b0\u22b5rc\u803b\xee\u40ee;\u4438\u0100cx\u22bc\u22bfy;\u4435cl\u803b\xa1\u40a1\u0100fr\u039f\u22c9;\uc000\ud835\udd26rave\u803b\xec\u40ec\u0200;ino\u073e\u22dd\u22e9\u22ee\u0100in\u22e2\u22e6nt;\u6a0ct;\u622dfin;\u69dcta;\u6129lig;\u4133\u0180aop\u22fe\u231a\u231d\u0180cgt\u2305\u2308\u2317r;\u412b\u0180elp\u071f\u230f\u2313in\xe5\u078ear\xf4\u0720h;\u4131f;\u62b7ed;\u41b5\u0280;cfot\u04f4\u232c\u2331\u233d\u2341are;\u6105in\u0100;t\u2338\u2339\u621eie;\u69dddo\xf4\u2319\u0280;celp\u0757\u234c\u2350\u235b\u2361al;\u62ba\u0100gr\u2355\u2359er\xf3\u1563\xe3\u234darhk;\u6a17rod;\u6a3c\u0200cgpt\u236f\u2372\u2376\u237by;\u4451on;\u412ff;\uc000\ud835\udd5aa;\u43b9uest\u803b\xbf\u40bf\u0100ci\u238a\u238fr;\uc000\ud835\udcben\u0280;Edsv\u04f4\u239b\u239d\u23a1\u04f3;\u62f9ot;\u62f5\u0100;v\u23a6\u23a7\u62f4;\u62f3\u0100;i\u0777\u23aelde;\u4129\u01eb\u23b8\0\u23bccy;\u4456l\u803b\xef\u40ef\u0300cfmosu\u23cc\u23d7\u23dc\u23e1\u23e7\u23f5\u0100iy\u23d1\u23d5rc;\u4135;\u4439r;\uc000\ud835\udd27ath;\u4237pf;\uc000\ud835\udd5b\u01e3\u23ec\0\u23f1r;\uc000\ud835\udcbfrcy;\u4458kcy;\u4454\u0400acfghjos\u240b\u2416\u2422\u2427\u242d\u2431\u2435\u243bppa\u0100;v\u2413\u2414\u43ba;\u43f0\u0100ey\u241b\u2420dil;\u4137;\u443ar;\uc000\ud835\udd28reen;\u4138cy;\u4445cy;\u445cpf;\uc000\ud835\udd5ccr;\uc000\ud835\udcc0\u0b80ABEHabcdefghjlmnoprstuv\u2470\u2481\u2486\u248d\u2491\u250e\u253d\u255a\u2580\u264e\u265e\u2665\u2679\u267d\u269a\u26b2\u26d8\u275d\u2768\u278b\u27c0\u2801\u2812\u0180art\u2477\u247a\u247cr\xf2\u09c6\xf2\u0395ail;\u691barr;\u690e\u0100;g\u0994\u248b;\u6a8bar;\u6962\u0963\u24a5\0\u24aa\0\u24b1\0\0\0\0\0\u24b5\u24ba\0\u24c6\u24c8\u24cd\0\u24f9ute;\u413amptyv;\u69b4ra\xee\u084cbda;\u43bbg\u0180;dl\u088e\u24c1\u24c3;\u6991\xe5\u088e;\u6a85uo\u803b\xab\u40abr\u0400;bfhlpst\u0899\u24de\u24e6\u24e9\u24eb\u24ee\u24f1\u24f5\u0100;f\u089d\u24e3s;\u691fs;\u691d\xeb\u2252p;\u61abl;\u6939im;\u6973l;\u61a2\u0180;ae\u24ff\u2500\u2504\u6aabil;\u6919\u0100;s\u2509\u250a\u6aad;\uc000\u2aad\ufe00\u0180abr\u2515\u2519\u251drr;\u690crk;\u6772\u0100ak\u2522\u252cc\u0100ek\u2528\u252a;\u407b;\u405b\u0100es\u2531\u2533;\u698bl\u0100du\u2539\u253b;\u698f;\u698d\u0200aeuy\u2546\u254b\u2556\u2558ron;\u413e\u0100di\u2550\u2554il;\u413c\xec\u08b0\xe2\u2529;\u443b\u0200cqrs\u2563\u2566\u256d\u257da;\u6936uo\u0100;r\u0e19\u1746\u0100du\u2572\u2577har;\u6967shar;\u694bh;\u61b2\u0280;fgqs\u258b\u258c\u0989\u25f3\u25ff\u6264t\u0280ahlrt\u2598\u25a4\u25b7\u25c2\u25e8rrow\u0100;t\u0899\u25a1a\xe9\u24f6arpoon\u0100du\u25af\u25b4own\xbb\u045ap\xbb\u0966eftarrows;\u61c7ight\u0180ahs\u25cd\u25d6\u25derrow\u0100;s\u08f4\u08a7arpoon\xf3\u0f98quigarro\xf7\u21f0hreetimes;\u62cb\u0180;qs\u258b\u0993\u25falan\xf4\u09ac\u0280;cdgs\u09ac\u260a\u260d\u261d\u2628c;\u6aa8ot\u0100;o\u2614\u2615\u6a7f\u0100;r\u261a\u261b\u6a81;\u6a83\u0100;e\u2622\u2625\uc000\u22da\ufe00s;\u6a93\u0280adegs\u2633\u2639\u263d\u2649\u264bppro\xf8\u24c6ot;\u62d6q\u0100gq\u2643\u2645\xf4\u0989gt\xf2\u248c\xf4\u099bi\xed\u09b2\u0180ilr\u2655\u08e1\u265asht;\u697c;\uc000\ud835\udd29\u0100;E\u099c\u2663;\u6a91\u0161\u2669\u2676r\u0100du\u25b2\u266e\u0100;l\u0965\u2673;\u696alk;\u6584cy;\u4459\u0280;acht\u0a48\u2688\u268b\u2691\u2696r\xf2\u25c1orne\xf2\u1d08ard;\u696bri;\u65fa\u0100io\u269f\u26a4dot;\u4140ust\u0100;a\u26ac\u26ad\u63b0che\xbb\u26ad\u0200Eaes\u26bb\u26bd\u26c9\u26d4;\u6268p\u0100;p\u26c3\u26c4\u6a89rox\xbb\u26c4\u0100;q\u26ce\u26cf\u6a87\u0100;q\u26ce\u26bbim;\u62e6\u0400abnoptwz\u26e9\u26f4\u26f7\u271a\u272f\u2741\u2747\u2750\u0100nr\u26ee\u26f1g;\u67ecr;\u61fdr\xeb\u08c1g\u0180lmr\u26ff\u270d\u2714eft\u0100ar\u09e6\u2707ight\xe1\u09f2apsto;\u67fcight\xe1\u09fdparrow\u0100lr\u2725\u2729ef\xf4\u24edight;\u61ac\u0180afl\u2736\u2739\u273dr;\u6985;\uc000\ud835\udd5dus;\u6a2dimes;\u6a34\u0161\u274b\u274fst;\u6217\xe1\u134e\u0180;ef\u2757\u2758\u1800\u65cange\xbb\u2758ar\u0100;l\u2764\u2765\u4028t;\u6993\u0280achmt\u2773\u2776\u277c\u2785\u2787r\xf2\u08a8orne\xf2\u1d8car\u0100;d\u0f98\u2783;\u696d;\u600eri;\u62bf\u0300achiqt\u2798\u279d\u0a40\u27a2\u27ae\u27bbquo;\u6039r;\uc000\ud835\udcc1m\u0180;eg\u09b2\u27aa\u27ac;\u6a8d;\u6a8f\u0100bu\u252a\u27b3o\u0100;r\u0e1f\u27b9;\u601arok;\u4142\u8400<;cdhilqr\u082b\u27d2\u2639\u27dc\u27e0\u27e5\u27ea\u27f0\u0100ci\u27d7\u27d9;\u6aa6r;\u6a79re\xe5\u25f2mes;\u62c9arr;\u6976uest;\u6a7b\u0100Pi\u27f5\u27f9ar;\u6996\u0180;ef\u2800\u092d\u181b\u65c3r\u0100du\u2807\u280dshar;\u694ahar;\u6966\u0100en\u2817\u2821rtneqq;\uc000\u2268\ufe00\xc5\u281e\u0700Dacdefhilnopsu\u2840\u2845\u2882\u288e\u2893\u28a0\u28a5\u28a8\u28da\u28e2\u28e4\u0a83\u28f3\u2902Dot;\u623a\u0200clpr\u284e\u2852\u2863\u287dr\u803b\xaf\u40af\u0100et\u2857\u2859;\u6642\u0100;e\u285e\u285f\u6720se\xbb\u285f\u0100;s\u103b\u2868to\u0200;dlu\u103b\u2873\u2877\u287bow\xee\u048cef\xf4\u090f\xf0\u13d1ker;\u65ae\u0100oy\u2887\u288cmma;\u6a29;\u443cash;\u6014asuredangle\xbb\u1626r;\uc000\ud835\udd2ao;\u6127\u0180cdn\u28af\u28b4\u28c9ro\u803b\xb5\u40b5\u0200;acd\u1464\u28bd\u28c0\u28c4s\xf4\u16a7ir;\u6af0ot\u80bb\xb7\u01b5us\u0180;bd\u28d2\u1903\u28d3\u6212\u0100;u\u1d3c\u28d8;\u6a2a\u0163\u28de\u28e1p;\u6adb\xf2\u2212\xf0\u0a81\u0100dp\u28e9\u28eeels;\u62a7f;\uc000\ud835\udd5e\u0100ct\u28f8\u28fdr;\uc000\ud835\udcc2pos\xbb\u159d\u0180;lm\u2909\u290a\u290d\u43bctimap;\u62b8\u0c00GLRVabcdefghijlmoprstuvw\u2942\u2953\u297e\u2989\u2998\u29da\u29e9\u2a15\u2a1a\u2a58\u2a5d\u2a83\u2a95\u2aa4\u2aa8\u2b04\u2b07\u2b44\u2b7f\u2bae\u2c34\u2c67\u2c7c\u2ce9\u0100gt\u2947\u294b;\uc000\u22d9\u0338\u0100;v\u2950\u0bcf\uc000\u226b\u20d2\u0180elt\u295a\u2972\u2976ft\u0100ar\u2961\u2967rrow;\u61cdightarrow;\u61ce;\uc000\u22d8\u0338\u0100;v\u297b\u0c47\uc000\u226a\u20d2ightarrow;\u61cf\u0100Dd\u298e\u2993ash;\u62afash;\u62ae\u0280bcnpt\u29a3\u29a7\u29ac\u29b1\u29ccla\xbb\u02deute;\u4144g;\uc000\u2220\u20d2\u0280;Eiop\u0d84\u29bc\u29c0\u29c5\u29c8;\uc000\u2a70\u0338d;\uc000\u224b\u0338s;\u4149ro\xf8\u0d84ur\u0100;a\u29d3\u29d4\u666el\u0100;s\u29d3\u0b38\u01f3\u29df\0\u29e3p\u80bb\xa0\u0b37mp\u0100;e\u0bf9\u0c00\u0280aeouy\u29f4\u29fe\u2a03\u2a10\u2a13\u01f0\u29f9\0\u29fb;\u6a43on;\u4148dil;\u4146ng\u0100;d\u0d7e\u2a0aot;\uc000\u2a6d\u0338p;\u6a42;\u443dash;\u6013\u0380;Aadqsx\u0b92\u2a29\u2a2d\u2a3b\u2a41\u2a45\u2a50rr;\u61d7r\u0100hr\u2a33\u2a36k;\u6924\u0100;o\u13f2\u13f0ot;\uc000\u2250\u0338ui\xf6\u0b63\u0100ei\u2a4a\u2a4ear;\u6928\xed\u0b98ist\u0100;s\u0ba0\u0b9fr;\uc000\ud835\udd2b\u0200Eest\u0bc5\u2a66\u2a79\u2a7c\u0180;qs\u0bbc\u2a6d\u0be1\u0180;qs\u0bbc\u0bc5\u2a74lan\xf4\u0be2i\xed\u0bea\u0100;r\u0bb6\u2a81\xbb\u0bb7\u0180Aap\u2a8a\u2a8d\u2a91r\xf2\u2971rr;\u61aear;\u6af2\u0180;sv\u0f8d\u2a9c\u0f8c\u0100;d\u2aa1\u2aa2\u62fc;\u62facy;\u445a\u0380AEadest\u2ab7\u2aba\u2abe\u2ac2\u2ac5\u2af6\u2af9r\xf2\u2966;\uc000\u2266\u0338rr;\u619ar;\u6025\u0200;fqs\u0c3b\u2ace\u2ae3\u2aeft\u0100ar\u2ad4\u2ad9rro\xf7\u2ac1ightarro\xf7\u2a90\u0180;qs\u0c3b\u2aba\u2aealan\xf4\u0c55\u0100;s\u0c55\u2af4\xbb\u0c36i\xed\u0c5d\u0100;r\u0c35\u2afei\u0100;e\u0c1a\u0c25i\xe4\u0d90\u0100pt\u2b0c\u2b11f;\uc000\ud835\udd5f\u8180\xac;in\u2b19\u2b1a\u2b36\u40acn\u0200;Edv\u0b89\u2b24\u2b28\u2b2e;\uc000\u22f9\u0338ot;\uc000\u22f5\u0338\u01e1\u0b89\u2b33\u2b35;\u62f7;\u62f6i\u0100;v\u0cb8\u2b3c\u01e1\u0cb8\u2b41\u2b43;\u62fe;\u62fd\u0180aor\u2b4b\u2b63\u2b69r\u0200;ast\u0b7b\u2b55\u2b5a\u2b5flle\xec\u0b7bl;\uc000\u2afd\u20e5;\uc000\u2202\u0338lint;\u6a14\u0180;ce\u0c92\u2b70\u2b73u\xe5\u0ca5\u0100;c\u0c98\u2b78\u0100;e\u0c92\u2b7d\xf1\u0c98\u0200Aait\u2b88\u2b8b\u2b9d\u2ba7r\xf2\u2988rr\u0180;cw\u2b94\u2b95\u2b99\u619b;\uc000\u2933\u0338;\uc000\u219d\u0338ghtarrow\xbb\u2b95ri\u0100;e\u0ccb\u0cd6\u0380chimpqu\u2bbd\u2bcd\u2bd9\u2b04\u0b78\u2be4\u2bef\u0200;cer\u0d32\u2bc6\u0d37\u2bc9u\xe5\u0d45;\uc000\ud835\udcc3ort\u026d\u2b05\0\0\u2bd6ar\xe1\u2b56m\u0100;e\u0d6e\u2bdf\u0100;q\u0d74\u0d73su\u0100bp\u2beb\u2bed\xe5\u0cf8\xe5\u0d0b\u0180bcp\u2bf6\u2c11\u2c19\u0200;Ees\u2bff\u2c00\u0d22\u2c04\u6284;\uc000\u2ac5\u0338et\u0100;e\u0d1b\u2c0bq\u0100;q\u0d23\u2c00c\u0100;e\u0d32\u2c17\xf1\u0d38\u0200;Ees\u2c22\u2c23\u0d5f\u2c27\u6285;\uc000\u2ac6\u0338et\u0100;e\u0d58\u2c2eq\u0100;q\u0d60\u2c23\u0200gilr\u2c3d\u2c3f\u2c45\u2c47\xec\u0bd7lde\u803b\xf1\u40f1\xe7\u0c43iangle\u0100lr\u2c52\u2c5ceft\u0100;e\u0c1a\u2c5a\xf1\u0c26ight\u0100;e\u0ccb\u2c65\xf1\u0cd7\u0100;m\u2c6c\u2c6d\u43bd\u0180;es\u2c74\u2c75\u2c79\u4023ro;\u6116p;\u6007\u0480DHadgilrs\u2c8f\u2c94\u2c99\u2c9e\u2ca3\u2cb0\u2cb6\u2cd3\u2ce3ash;\u62adarr;\u6904p;\uc000\u224d\u20d2ash;\u62ac\u0100et\u2ca8\u2cac;\uc000\u2265\u20d2;\uc000>\u20d2nfin;\u69de\u0180Aet\u2cbd\u2cc1\u2cc5rr;\u6902;\uc000\u2264\u20d2\u0100;r\u2cca\u2ccd\uc000<\u20d2ie;\uc000\u22b4\u20d2\u0100At\u2cd8\u2cdcrr;\u6903rie;\uc000\u22b5\u20d2im;\uc000\u223c\u20d2\u0180Aan\u2cf0\u2cf4\u2d02rr;\u61d6r\u0100hr\u2cfa\u2cfdk;\u6923\u0100;o\u13e7\u13e5ear;\u6927\u1253\u1a95\0\0\0\0\0\0\0\0\0\0\0\0\0\u2d2d\0\u2d38\u2d48\u2d60\u2d65\u2d72\u2d84\u1b07\0\0\u2d8d\u2dab\0\u2dc8\u2dce\0\u2ddc\u2e19\u2e2b\u2e3e\u2e43\u0100cs\u2d31\u1a97ute\u803b\xf3\u40f3\u0100iy\u2d3c\u2d45r\u0100;c\u1a9e\u2d42\u803b\xf4\u40f4;\u443e\u0280abios\u1aa0\u2d52\u2d57\u01c8\u2d5alac;\u4151v;\u6a38old;\u69bclig;\u4153\u0100cr\u2d69\u2d6dir;\u69bf;\uc000\ud835\udd2c\u036f\u2d79\0\0\u2d7c\0\u2d82n;\u42dbave\u803b\xf2\u40f2;\u69c1\u0100bm\u2d88\u0df4ar;\u69b5\u0200acit\u2d95\u2d98\u2da5\u2da8r\xf2\u1a80\u0100ir\u2d9d\u2da0r;\u69beoss;\u69bbn\xe5\u0e52;\u69c0\u0180aei\u2db1\u2db5\u2db9cr;\u414dga;\u43c9\u0180cdn\u2dc0\u2dc5\u01cdron;\u43bf;\u69b6pf;\uc000\ud835\udd60\u0180ael\u2dd4\u2dd7\u01d2r;\u69b7rp;\u69b9\u0380;adiosv\u2dea\u2deb\u2dee\u2e08\u2e0d\u2e10\u2e16\u6228r\xf2\u1a86\u0200;efm\u2df7\u2df8\u2e02\u2e05\u6a5dr\u0100;o\u2dfe\u2dff\u6134f\xbb\u2dff\u803b\xaa\u40aa\u803b\xba\u40bagof;\u62b6r;\u6a56lope;\u6a57;\u6a5b\u0180clo\u2e1f\u2e21\u2e27\xf2\u2e01ash\u803b\xf8\u40f8l;\u6298i\u016c\u2e2f\u2e34de\u803b\xf5\u40f5es\u0100;a\u01db\u2e3as;\u6a36ml\u803b\xf6\u40f6bar;\u633d\u0ae1\u2e5e\0\u2e7d\0\u2e80\u2e9d\0\u2ea2\u2eb9\0\0\u2ecb\u0e9c\0\u2f13\0\0\u2f2b\u2fbc\0\u2fc8r\u0200;ast\u0403\u2e67\u2e72\u0e85\u8100\xb6;l\u2e6d\u2e6e\u40b6le\xec\u0403\u0269\u2e78\0\0\u2e7bm;\u6af3;\u6afdy;\u443fr\u0280cimpt\u2e8b\u2e8f\u2e93\u1865\u2e97nt;\u4025od;\u402eil;\u6030enk;\u6031r;\uc000\ud835\udd2d\u0180imo\u2ea8\u2eb0\u2eb4\u0100;v\u2ead\u2eae\u43c6;\u43d5ma\xf4\u0a76ne;\u660e\u0180;tv\u2ebf\u2ec0\u2ec8\u43c0chfork\xbb\u1ffd;\u43d6\u0100au\u2ecf\u2edfn\u0100ck\u2ed5\u2eddk\u0100;h\u21f4\u2edb;\u610e\xf6\u21f4s\u0480;abcdemst\u2ef3\u2ef4\u1908\u2ef9\u2efd\u2f04\u2f06\u2f0a\u2f0e\u402bcir;\u6a23ir;\u6a22\u0100ou\u1d40\u2f02;\u6a25;\u6a72n\u80bb\xb1\u0e9dim;\u6a26wo;\u6a27\u0180ipu\u2f19\u2f20\u2f25ntint;\u6a15f;\uc000\ud835\udd61nd\u803b\xa3\u40a3\u0500;Eaceinosu\u0ec8\u2f3f\u2f41\u2f44\u2f47\u2f81\u2f89\u2f92\u2f7e\u2fb6;\u6ab3p;\u6ab7u\xe5\u0ed9\u0100;c\u0ece\u2f4c\u0300;acens\u0ec8\u2f59\u2f5f\u2f66\u2f68\u2f7eppro\xf8\u2f43urlye\xf1\u0ed9\xf1\u0ece\u0180aes\u2f6f\u2f76\u2f7approx;\u6ab9qq;\u6ab5im;\u62e8i\xed\u0edfme\u0100;s\u2f88\u0eae\u6032\u0180Eas\u2f78\u2f90\u2f7a\xf0\u2f75\u0180dfp\u0eec\u2f99\u2faf\u0180als\u2fa0\u2fa5\u2faalar;\u632eine;\u6312urf;\u6313\u0100;t\u0efb\u2fb4\xef\u0efbrel;\u62b0\u0100ci\u2fc0\u2fc5r;\uc000\ud835\udcc5;\u43c8ncsp;\u6008\u0300fiopsu\u2fda\u22e2\u2fdf\u2fe5\u2feb\u2ff1r;\uc000\ud835\udd2epf;\uc000\ud835\udd62rime;\u6057cr;\uc000\ud835\udcc6\u0180aeo\u2ff8\u3009\u3013t\u0100ei\u2ffe\u3005rnion\xf3\u06b0nt;\u6a16st\u0100;e\u3010\u3011\u403f\xf1\u1f19\xf4\u0f14\u0a80ABHabcdefhilmnoprstux\u3040\u3051\u3055\u3059\u30e0\u310e\u312b\u3147\u3162\u3172\u318e\u3206\u3215\u3224\u3229\u3258\u326e\u3272\u3290\u32b0\u32b7\u0180art\u3047\u304a\u304cr\xf2\u10b3\xf2\u03ddail;\u691car\xf2\u1c65ar;\u6964\u0380cdenqrt\u3068\u3075\u3078\u307f\u308f\u3094\u30cc\u0100eu\u306d\u3071;\uc000\u223d\u0331te;\u4155i\xe3\u116emptyv;\u69b3g\u0200;del\u0fd1\u3089\u308b\u308d;\u6992;\u69a5\xe5\u0fd1uo\u803b\xbb\u40bbr\u0580;abcfhlpstw\u0fdc\u30ac\u30af\u30b7\u30b9\u30bc\u30be\u30c0\u30c3\u30c7\u30cap;\u6975\u0100;f\u0fe0\u30b4s;\u6920;\u6933s;\u691e\xeb\u225d\xf0\u272el;\u6945im;\u6974l;\u61a3;\u619d\u0100ai\u30d1\u30d5il;\u691ao\u0100;n\u30db\u30dc\u6236al\xf3\u0f1e\u0180abr\u30e7\u30ea\u30eer\xf2\u17e5rk;\u6773\u0100ak\u30f3\u30fdc\u0100ek\u30f9\u30fb;\u407d;\u405d\u0100es\u3102\u3104;\u698cl\u0100du\u310a\u310c;\u698e;\u6990\u0200aeuy\u3117\u311c\u3127\u3129ron;\u4159\u0100di\u3121\u3125il;\u4157\xec\u0ff2\xe2\u30fa;\u4440\u0200clqs\u3134\u3137\u313d\u3144a;\u6937dhar;\u6969uo\u0100;r\u020e\u020dh;\u61b3\u0180acg\u314e\u315f\u0f44l\u0200;ips\u0f78\u3158\u315b\u109cn\xe5\u10bbar\xf4\u0fa9t;\u65ad\u0180ilr\u3169\u1023\u316esht;\u697d;\uc000\ud835\udd2f\u0100ao\u3177\u3186r\u0100du\u317d\u317f\xbb\u047b\u0100;l\u1091\u3184;\u696c\u0100;v\u318b\u318c\u43c1;\u43f1\u0180gns\u3195\u31f9\u31fcht\u0300ahlrst\u31a4\u31b0\u31c2\u31d8\u31e4\u31eerrow\u0100;t\u0fdc\u31ada\xe9\u30c8arpoon\u0100du\u31bb\u31bfow\xee\u317ep\xbb\u1092eft\u0100ah\u31ca\u31d0rrow\xf3\u0feaarpoon\xf3\u0551ightarrows;\u61c9quigarro\xf7\u30cbhreetimes;\u62ccg;\u42daingdotse\xf1\u1f32\u0180ahm\u320d\u3210\u3213r\xf2\u0feaa\xf2\u0551;\u600foust\u0100;a\u321e\u321f\u63b1che\xbb\u321fmid;\u6aee\u0200abpt\u3232\u323d\u3240\u3252\u0100nr\u3237\u323ag;\u67edr;\u61fer\xeb\u1003\u0180afl\u3247\u324a\u324er;\u6986;\uc000\ud835\udd63us;\u6a2eimes;\u6a35\u0100ap\u325d\u3267r\u0100;g\u3263\u3264\u4029t;\u6994olint;\u6a12ar\xf2\u31e3\u0200achq\u327b\u3280\u10bc\u3285quo;\u603ar;\uc000\ud835\udcc7\u0100bu\u30fb\u328ao\u0100;r\u0214\u0213\u0180hir\u3297\u329b\u32a0re\xe5\u31f8mes;\u62cai\u0200;efl\u32aa\u1059\u1821\u32ab\u65b9tri;\u69celuhar;\u6968;\u611e\u0d61\u32d5\u32db\u32df\u332c\u3338\u3371\0\u337a\u33a4\0\0\u33ec\u33f0\0\u3428\u3448\u345a\u34ad\u34b1\u34ca\u34f1\0\u3616\0\0\u3633cute;\u415bqu\xef\u27ba\u0500;Eaceinpsy\u11ed\u32f3\u32f5\u32ff\u3302\u330b\u330f\u331f\u3326\u3329;\u6ab4\u01f0\u32fa\0\u32fc;\u6ab8on;\u4161u\xe5\u11fe\u0100;d\u11f3\u3307il;\u415frc;\u415d\u0180Eas\u3316\u3318\u331b;\u6ab6p;\u6abaim;\u62e9olint;\u6a13i\xed\u1204;\u4441ot\u0180;be\u3334\u1d47\u3335\u62c5;\u6a66\u0380Aacmstx\u3346\u334a\u3357\u335b\u335e\u3363\u336drr;\u61d8r\u0100hr\u3350\u3352\xeb\u2228\u0100;o\u0a36\u0a34t\u803b\xa7\u40a7i;\u403bwar;\u6929m\u0100in\u3369\xf0nu\xf3\xf1t;\u6736r\u0100;o\u3376\u2055\uc000\ud835\udd30\u0200acoy\u3382\u3386\u3391\u33a0rp;\u666f\u0100hy\u338b\u338fcy;\u4449;\u4448rt\u026d\u3399\0\0\u339ci\xe4\u1464ara\xec\u2e6f\u803b\xad\u40ad\u0100gm\u33a8\u33b4ma\u0180;fv\u33b1\u33b2\u33b2\u43c3;\u43c2\u0400;deglnpr\u12ab\u33c5\u33c9\u33ce\u33d6\u33de\u33e1\u33e6ot;\u6a6a\u0100;q\u12b1\u12b0\u0100;E\u33d3\u33d4\u6a9e;\u6aa0\u0100;E\u33db\u33dc\u6a9d;\u6a9fe;\u6246lus;\u6a24arr;\u6972ar\xf2\u113d\u0200aeit\u33f8\u3408\u340f\u3417\u0100ls\u33fd\u3404lsetm\xe9\u336ahp;\u6a33parsl;\u69e4\u0100dl\u1463\u3414e;\u6323\u0100;e\u341c\u341d\u6aaa\u0100;s\u3422\u3423\u6aac;\uc000\u2aac\ufe00\u0180flp\u342e\u3433\u3442tcy;\u444c\u0100;b\u3438\u3439\u402f\u0100;a\u343e\u343f\u69c4r;\u633ff;\uc000\ud835\udd64a\u0100dr\u344d\u0402es\u0100;u\u3454\u3455\u6660it\xbb\u3455\u0180csu\u3460\u3479\u349f\u0100au\u3465\u346fp\u0100;s\u1188\u346b;\uc000\u2293\ufe00p\u0100;s\u11b4\u3475;\uc000\u2294\ufe00u\u0100bp\u347f\u348f\u0180;es\u1197\u119c\u3486et\u0100;e\u1197\u348d\xf1\u119d\u0180;es\u11a8\u11ad\u3496et\u0100;e\u11a8\u349d\xf1\u11ae\u0180;af\u117b\u34a6\u05b0r\u0165\u34ab\u05b1\xbb\u117car\xf2\u1148\u0200cemt\u34b9\u34be\u34c2\u34c5r;\uc000\ud835\udcc8tm\xee\xf1i\xec\u3415ar\xe6\u11be\u0100ar\u34ce\u34d5r\u0100;f\u34d4\u17bf\u6606\u0100an\u34da\u34edight\u0100ep\u34e3\u34eapsilo\xee\u1ee0h\xe9\u2eafs\xbb\u2852\u0280bcmnp\u34fb\u355e\u1209\u358b\u358e\u0480;Edemnprs\u350e\u350f\u3511\u3515\u351e\u3523\u352c\u3531\u3536\u6282;\u6ac5ot;\u6abd\u0100;d\u11da\u351aot;\u6ac3ult;\u6ac1\u0100Ee\u3528\u352a;\u6acb;\u628alus;\u6abfarr;\u6979\u0180eiu\u353d\u3552\u3555t\u0180;en\u350e\u3545\u354bq\u0100;q\u11da\u350feq\u0100;q\u352b\u3528m;\u6ac7\u0100bp\u355a\u355c;\u6ad5;\u6ad3c\u0300;acens\u11ed\u356c\u3572\u3579\u357b\u3326ppro\xf8\u32faurlye\xf1\u11fe\xf1\u11f3\u0180aes\u3582\u3588\u331bppro\xf8\u331aq\xf1\u3317g;\u666a\u0680123;Edehlmnps\u35a9\u35ac\u35af\u121c\u35b2\u35b4\u35c0\u35c9\u35d5\u35da\u35df\u35e8\u35ed\u803b\xb9\u40b9\u803b\xb2\u40b2\u803b\xb3\u40b3;\u6ac6\u0100os\u35b9\u35bct;\u6abeub;\u6ad8\u0100;d\u1222\u35c5ot;\u6ac4s\u0100ou\u35cf\u35d2l;\u67c9b;\u6ad7arr;\u697bult;\u6ac2\u0100Ee\u35e4\u35e6;\u6acc;\u628blus;\u6ac0\u0180eiu\u35f4\u3609\u360ct\u0180;en\u121c\u35fc\u3602q\u0100;q\u1222\u35b2eq\u0100;q\u35e7\u35e4m;\u6ac8\u0100bp\u3611\u3613;\u6ad4;\u6ad6\u0180Aan\u361c\u3620\u362drr;\u61d9r\u0100hr\u3626\u3628\xeb\u222e\u0100;o\u0a2b\u0a29war;\u692alig\u803b\xdf\u40df\u0be1\u3651\u365d\u3660\u12ce\u3673\u3679\0\u367e\u36c2\0\0\0\0\0\u36db\u3703\0\u3709\u376c\0\0\0\u3787\u0272\u3656\0\0\u365bget;\u6316;\u43c4r\xeb\u0e5f\u0180aey\u3666\u366b\u3670ron;\u4165dil;\u4163;\u4442lrec;\u6315r;\uc000\ud835\udd31\u0200eiko\u3686\u369d\u36b5\u36bc\u01f2\u368b\0\u3691e\u01004f\u1284\u1281a\u0180;sv\u3698\u3699\u369b\u43b8ym;\u43d1\u0100cn\u36a2\u36b2k\u0100as\u36a8\u36aeppro\xf8\u12c1im\xbb\u12acs\xf0\u129e\u0100as\u36ba\u36ae\xf0\u12c1rn\u803b\xfe\u40fe\u01ec\u031f\u36c6\u22e7es\u8180\xd7;bd\u36cf\u36d0\u36d8\u40d7\u0100;a\u190f\u36d5r;\u6a31;\u6a30\u0180eps\u36e1\u36e3\u3700\xe1\u2a4d\u0200;bcf\u0486\u36ec\u36f0\u36f4ot;\u6336ir;\u6af1\u0100;o\u36f9\u36fc\uc000\ud835\udd65rk;\u6ada\xe1\u3362rime;\u6034\u0180aip\u370f\u3712\u3764d\xe5\u1248\u0380adempst\u3721\u374d\u3740\u3751\u3757\u375c\u375fngle\u0280;dlqr\u3730\u3731\u3736\u3740\u3742\u65b5own\xbb\u1dbbeft\u0100;e\u2800\u373e\xf1\u092e;\u625cight\u0100;e\u32aa\u374b\xf1\u105aot;\u65ecinus;\u6a3alus;\u6a39b;\u69cdime;\u6a3bezium;\u63e2\u0180cht\u3772\u377d\u3781\u0100ry\u3777\u377b;\uc000\ud835\udcc9;\u4446cy;\u445brok;\u4167\u0100io\u378b\u378ex\xf4\u1777head\u0100lr\u3797\u37a0eftarro\xf7\u084fightarrow\xbb\u0f5d\u0900AHabcdfghlmoprstuw\u37d0\u37d3\u37d7\u37e4\u37f0\u37fc\u380e\u381c\u3823\u3834\u3851\u385d\u386b\u38a9\u38cc\u38d2\u38ea\u38f6r\xf2\u03edar;\u6963\u0100cr\u37dc\u37e2ute\u803b\xfa\u40fa\xf2\u1150r\u01e3\u37ea\0\u37edy;\u445eve;\u416d\u0100iy\u37f5\u37farc\u803b\xfb\u40fb;\u4443\u0180abh\u3803\u3806\u380br\xf2\u13adlac;\u4171a\xf2\u13c3\u0100ir\u3813\u3818sht;\u697e;\uc000\ud835\udd32rave\u803b\xf9\u40f9\u0161\u3827\u3831r\u0100lr\u382c\u382e\xbb\u0957\xbb\u1083lk;\u6580\u0100ct\u3839\u384d\u026f\u383f\0\0\u384arn\u0100;e\u3845\u3846\u631cr\xbb\u3846op;\u630fri;\u65f8\u0100al\u3856\u385acr;\u416b\u80bb\xa8\u0349\u0100gp\u3862\u3866on;\u4173f;\uc000\ud835\udd66\u0300adhlsu\u114b\u3878\u387d\u1372\u3891\u38a0own\xe1\u13b3arpoon\u0100lr\u3888\u388cef\xf4\u382digh\xf4\u382fi\u0180;hl\u3899\u389a\u389c\u43c5\xbb\u13faon\xbb\u389aparrows;\u61c8\u0180cit\u38b0\u38c4\u38c8\u026f\u38b6\0\0\u38c1rn\u0100;e\u38bc\u38bd\u631dr\xbb\u38bdop;\u630eng;\u416fri;\u65f9cr;\uc000\ud835\udcca\u0180dir\u38d9\u38dd\u38e2ot;\u62f0lde;\u4169i\u0100;f\u3730\u38e8\xbb\u1813\u0100am\u38ef\u38f2r\xf2\u38a8l\u803b\xfc\u40fcangle;\u69a7\u0780ABDacdeflnoprsz\u391c\u391f\u3929\u392d\u39b5\u39b8\u39bd\u39df\u39e4\u39e8\u39f3\u39f9\u39fd\u3a01\u3a20r\xf2\u03f7ar\u0100;v\u3926\u3927\u6ae8;\u6ae9as\xe8\u03e1\u0100nr\u3932\u3937grt;\u699c\u0380eknprst\u34e3\u3946\u394b\u3952\u395d\u3964\u3996app\xe1\u2415othin\xe7\u1e96\u0180hir\u34eb\u2ec8\u3959op\xf4\u2fb5\u0100;h\u13b7\u3962\xef\u318d\u0100iu\u3969\u396dgm\xe1\u33b3\u0100bp\u3972\u3984setneq\u0100;q\u397d\u3980\uc000\u228a\ufe00;\uc000\u2acb\ufe00setneq\u0100;q\u398f\u3992\uc000\u228b\ufe00;\uc000\u2acc\ufe00\u0100hr\u399b\u399fet\xe1\u369ciangle\u0100lr\u39aa\u39afeft\xbb\u0925ight\xbb\u1051y;\u4432ash\xbb\u1036\u0180elr\u39c4\u39d2\u39d7\u0180;be\u2dea\u39cb\u39cfar;\u62bbq;\u625alip;\u62ee\u0100bt\u39dc\u1468a\xf2\u1469r;\uc000\ud835\udd33tr\xe9\u39aesu\u0100bp\u39ef\u39f1\xbb\u0d1c\xbb\u0d59pf;\uc000\ud835\udd67ro\xf0\u0efbtr\xe9\u39b4\u0100cu\u3a06\u3a0br;\uc000\ud835\udccb\u0100bp\u3a10\u3a18n\u0100Ee\u3980\u3a16\xbb\u397en\u0100Ee\u3992\u3a1e\xbb\u3990igzag;\u699a\u0380cefoprs\u3a36\u3a3b\u3a56\u3a5b\u3a54\u3a61\u3a6airc;\u4175\u0100di\u3a40\u3a51\u0100bg\u3a45\u3a49ar;\u6a5fe\u0100;q\u15fa\u3a4f;\u6259erp;\u6118r;\uc000\ud835\udd34pf;\uc000\ud835\udd68\u0100;e\u1479\u3a66at\xe8\u1479cr;\uc000\ud835\udccc\u0ae3\u178e\u3a87\0\u3a8b\0\u3a90\u3a9b\0\0\u3a9d\u3aa8\u3aab\u3aaf\0\0\u3ac3\u3ace\0\u3ad8\u17dc\u17dftr\xe9\u17d1r;\uc000\ud835\udd35\u0100Aa\u3a94\u3a97r\xf2\u03c3r\xf2\u09f6;\u43be\u0100Aa\u3aa1\u3aa4r\xf2\u03b8r\xf2\u09eba\xf0\u2713is;\u62fb\u0180dpt\u17a4\u3ab5\u3abe\u0100fl\u3aba\u17a9;\uc000\ud835\udd69im\xe5\u17b2\u0100Aa\u3ac7\u3acar\xf2\u03cer\xf2\u0a01\u0100cq\u3ad2\u17b8r;\uc000\ud835\udccd\u0100pt\u17d6\u3adcr\xe9\u17d4\u0400acefiosu\u3af0\u3afd\u3b08\u3b0c\u3b11\u3b15\u3b1b\u3b21c\u0100uy\u3af6\u3afbte\u803b\xfd\u40fd;\u444f\u0100iy\u3b02\u3b06rc;\u4177;\u444bn\u803b\xa5\u40a5r;\uc000\ud835\udd36cy;\u4457pf;\uc000\ud835\udd6acr;\uc000\ud835\udcce\u0100cm\u3b26\u3b29y;\u444el\u803b\xff\u40ff\u0500acdefhiosw\u3b42\u3b48\u3b54\u3b58\u3b64\u3b69\u3b6d\u3b74\u3b7a\u3b80cute;\u417a\u0100ay\u3b4d\u3b52ron;\u417e;\u4437ot;\u417c\u0100et\u3b5d\u3b61tr\xe6\u155fa;\u43b6r;\uc000\ud835\udd37cy;\u4436grarr;\u61ddpf;\uc000\ud835\udd6bcr;\uc000\ud835\udccf\u0100jn\u3b85\u3b87;\u600dj;\u600c"
    .split("")
    .map((c) => c.charCodeAt(0)));

// Generated using scripts/write-decode-map.ts
var xmlDecodeTree = new Uint16Array(
// prettier-ignore
"\u0200aglq\t\x15\x18\x1b\u026d\x0f\0\0\x12p;\u4026os;\u4027t;\u403et;\u403cuot;\u4022"
    .split("")
    .map((c) => c.charCodeAt(0)));

// Adapted from https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/src/he.js#L106-L134
var _a;
const decodeMap = new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376],
]);
/**
 * Polyfill for `String.fromCodePoint`. It is used to create a string from a Unicode code point.
 */
const fromCodePoint$1 = 
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
(_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function (codePoint) {
    let output = "";
    if (codePoint > 0xffff) {
        codePoint -= 0x10000;
        output += String.fromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
        codePoint = 0xdc00 | (codePoint & 0x3ff);
    }
    output += String.fromCharCode(codePoint);
    return output;
};
/**
 * Replace the given code point with a replacement character if it is a
 * surrogate or is outside the valid range. Otherwise return the code
 * point unchanged.
 */
function replaceCodePoint(codePoint) {
    var _a;
    if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
        return 0xfffd;
    }
    return (_a = decodeMap.get(codePoint)) !== null && _a !== void 0 ? _a : codePoint;
}

var CharCodes;
(function (CharCodes) {
    CharCodes[CharCodes["NUM"] = 35] = "NUM";
    CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
    CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
    CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
    CharCodes[CharCodes["NINE"] = 57] = "NINE";
    CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
    CharCodes[CharCodes["LOWER_F"] = 102] = "LOWER_F";
    CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
    CharCodes[CharCodes["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes[CharCodes["UPPER_A"] = 65] = "UPPER_A";
    CharCodes[CharCodes["UPPER_F"] = 70] = "UPPER_F";
    CharCodes[CharCodes["UPPER_Z"] = 90] = "UPPER_Z";
})(CharCodes || (CharCodes = {}));
/** Bit that needs to be set to convert an upper case ASCII character to lower case */
const TO_LOWER_BIT = 0b100000;
var BinTrieFlags;
(function (BinTrieFlags) {
    BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
})(BinTrieFlags || (BinTrieFlags = {}));
function isNumber(code) {
    return code >= CharCodes.ZERO && code <= CharCodes.NINE;
}
function isHexadecimalCharacter(code) {
    return ((code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_F) ||
        (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_F));
}
function isAsciiAlphaNumeric(code) {
    return ((code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_Z) ||
        (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_Z) ||
        isNumber(code));
}
/**
 * Checks if the given character is a valid end character for an entity in an attribute.
 *
 * Attribute values that aren't terminated properly aren't parsed, and shouldn't lead to a parser error.
 * See the example in https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state
 */
function isEntityInAttributeInvalidEnd(code) {
    return code === CharCodes.EQUALS || isAsciiAlphaNumeric(code);
}
var EntityDecoderState;
(function (EntityDecoderState) {
    EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function (DecodingMode) {
    /** Entities in text nodes that can end with any character. */
    DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
    /** Only allow entities terminated with a semicolon. */
    DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
    /** Entities in attributes have limitations on ending characters. */
    DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
/**
 * Token decoder with support of writing partial entities.
 */
class EntityDecoder {
    constructor(
    /** The tree used to decode entities. */
    decodeTree, 
    /**
     * The function that is called when a codepoint is decoded.
     *
     * For multi-byte named entities, this will be called multiple times,
     * with the second codepoint, and the same `consumed` value.
     *
     * @param codepoint The decoded codepoint.
     * @param consumed The number of bytes consumed by the decoder.
     */
    emitCodePoint, 
    /** An object that is used to produce errors. */
    errors) {
        this.decodeTree = decodeTree;
        this.emitCodePoint = emitCodePoint;
        this.errors = errors;
        /** The current state of the decoder. */
        this.state = EntityDecoderState.EntityStart;
        /** Characters that were consumed while parsing an entity. */
        this.consumed = 1;
        /**
         * The result of the entity.
         *
         * Either the result index of a numeric entity, or the codepoint of a
         * numeric entity.
         */
        this.result = 0;
        /** The current index in the decode tree. */
        this.treeIndex = 0;
        /** The number of characters that were consumed in excess. */
        this.excess = 1;
        /** The mode in which the decoder is operating. */
        this.decodeMode = DecodingMode.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
        this.decodeMode = decodeMode;
        this.state = EntityDecoderState.EntityStart;
        this.result = 0;
        this.treeIndex = 0;
        this.excess = 1;
        this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param string The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(str, offset) {
        switch (this.state) {
            case EntityDecoderState.EntityStart: {
                if (str.charCodeAt(offset) === CharCodes.NUM) {
                    this.state = EntityDecoderState.NumericStart;
                    this.consumed += 1;
                    return this.stateNumericStart(str, offset + 1);
                }
                this.state = EntityDecoderState.NamedEntity;
                return this.stateNamedEntity(str, offset);
            }
            case EntityDecoderState.NumericStart: {
                return this.stateNumericStart(str, offset);
            }
            case EntityDecoderState.NumericDecimal: {
                return this.stateNumericDecimal(str, offset);
            }
            case EntityDecoderState.NumericHex: {
                return this.stateNumericHex(str, offset);
            }
            case EntityDecoderState.NamedEntity: {
                return this.stateNamedEntity(str, offset);
            }
        }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(str, offset) {
        if (offset >= str.length) {
            return -1;
        }
        if ((str.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
            this.state = EntityDecoderState.NumericHex;
            this.consumed += 1;
            return this.stateNumericHex(str, offset + 1);
        }
        this.state = EntityDecoderState.NumericDecimal;
        return this.stateNumericDecimal(str, offset);
    }
    addToNumericResult(str, start, end, base) {
        if (start !== end) {
            const digitCount = end - start;
            this.result =
                this.result * Math.pow(base, digitCount) +
                    parseInt(str.substr(start, digitCount), base);
            this.consumed += digitCount;
        }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(str, offset) {
        const startIdx = offset;
        while (offset < str.length) {
            const char = str.charCodeAt(offset);
            if (isNumber(char) || isHexadecimalCharacter(char)) {
                offset += 1;
            }
            else {
                this.addToNumericResult(str, startIdx, offset, 16);
                return this.emitNumericEntity(char, 3);
            }
        }
        this.addToNumericResult(str, startIdx, offset, 16);
        return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(str, offset) {
        const startIdx = offset;
        while (offset < str.length) {
            const char = str.charCodeAt(offset);
            if (isNumber(char)) {
                offset += 1;
            }
            else {
                this.addToNumericResult(str, startIdx, offset, 10);
                return this.emitNumericEntity(char, 2);
            }
        }
        this.addToNumericResult(str, startIdx, offset, 10);
        return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
        var _a;
        // Ensure we consumed at least one digit.
        if (this.consumed <= expectedLength) {
            (_a = this.errors) === null || _a === void 0 ? void 0 : _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
            return 0;
        }
        // Figure out if this is a legit end of the entity
        if (lastCp === CharCodes.SEMI) {
            this.consumed += 1;
        }
        else if (this.decodeMode === DecodingMode.Strict) {
            return 0;
        }
        this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
        if (this.errors) {
            if (lastCp !== CharCodes.SEMI) {
                this.errors.missingSemicolonAfterCharacterReference();
            }
            this.errors.validateNumericCharacterReference(this.result);
        }
        return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(str, offset) {
        const { decodeTree } = this;
        let current = decodeTree[this.treeIndex];
        // The mask is the number of bytes of the value, including the current byte.
        let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
        for (; offset < str.length; offset++, this.excess++) {
            const char = str.charCodeAt(offset);
            this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
            if (this.treeIndex < 0) {
                return this.result === 0 ||
                    // If we are parsing an attribute
                    (this.decodeMode === DecodingMode.Attribute &&
                        // We shouldn't have consumed any characters after the entity,
                        (valueLength === 0 ||
                            // And there should be no invalid characters.
                            isEntityInAttributeInvalidEnd(char)))
                    ? 0
                    : this.emitNotTerminatedNamedEntity();
            }
            current = decodeTree[this.treeIndex];
            valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
            // If the branch is a value, store it and continue
            if (valueLength !== 0) {
                // If the entity is terminated by a semicolon, we are done.
                if (char === CharCodes.SEMI) {
                    return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
                }
                // If we encounter a non-terminated (legacy) entity while parsing strictly, then ignore it.
                if (this.decodeMode !== DecodingMode.Strict) {
                    this.result = this.treeIndex;
                    this.consumed += this.excess;
                    this.excess = 0;
                }
            }
        }
        return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
        var _a;
        const { result, decodeTree } = this;
        const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
        this.emitNamedEntityData(result, valueLength, this.consumed);
        (_a = this.errors) === null || _a === void 0 ? void 0 : _a.missingSemicolonAfterCharacterReference();
        return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
        const { decodeTree } = this;
        this.emitCodePoint(valueLength === 1
            ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH
            : decodeTree[result + 1], consumed);
        if (valueLength === 3) {
            // For multi-byte values, we need to emit the second byte.
            this.emitCodePoint(decodeTree[result + 2], consumed);
        }
        return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
        var _a;
        switch (this.state) {
            case EntityDecoderState.NamedEntity: {
                // Emit a named entity if we have one.
                return this.result !== 0 &&
                    (this.decodeMode !== DecodingMode.Attribute ||
                        this.result === this.treeIndex)
                    ? this.emitNotTerminatedNamedEntity()
                    : 0;
            }
            // Otherwise, emit a numeric entity if we have one.
            case EntityDecoderState.NumericDecimal: {
                return this.emitNumericEntity(0, 2);
            }
            case EntityDecoderState.NumericHex: {
                return this.emitNumericEntity(0, 3);
            }
            case EntityDecoderState.NumericStart: {
                (_a = this.errors) === null || _a === void 0 ? void 0 : _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
                return 0;
            }
            case EntityDecoderState.EntityStart: {
                // Return 0 if we have no entity.
                return 0;
            }
        }
    }
}
/**
 * Creates a function that decodes entities in a string.
 *
 * @param decodeTree The decode tree.
 * @returns A function that decodes entities in a string.
 */
function getDecoder(decodeTree) {
    let ret = "";
    const decoder = new EntityDecoder(decodeTree, (str) => (ret += fromCodePoint$1(str)));
    return function decodeWithTrie(str, decodeMode) {
        let lastIndex = 0;
        let offset = 0;
        while ((offset = str.indexOf("&", offset)) >= 0) {
            ret += str.slice(lastIndex, offset);
            decoder.startEntity(decodeMode);
            const len = decoder.write(str, 
            // Skip the "&"
            offset + 1);
            if (len < 0) {
                lastIndex = offset + decoder.end();
                break;
            }
            lastIndex = offset + len;
            // If `len` is 0, skip the current `&` and continue.
            offset = len === 0 ? lastIndex + 1 : lastIndex;
        }
        const result = ret + str.slice(lastIndex);
        // Make sure we don't keep a reference to the final string.
        ret = "";
        return result;
    };
}
/**
 * Determines the branch of the current node that is taken given the current
 * character. This function is used to traverse the trie.
 *
 * @param decodeTree The trie.
 * @param current The current node.
 * @param nodeIdx The index right after the current node and its value.
 * @param char The current character.
 * @returns The index of the next node, or -1 if no branch is taken.
 */
function determineBranch(decodeTree, current, nodeIdx, char) {
    const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
    // Case 1: Single branch encoded in jump offset
    if (branchCount === 0) {
        return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
    }
    // Case 2: Multiple branches encoded in jump table
    if (jumpOffset) {
        const value = char - jumpOffset;
        return value < 0 || value >= branchCount
            ? -1
            : decodeTree[nodeIdx + value] - 1;
    }
    // Case 3: Multiple branches encoded in dictionary
    // Binary search for the character.
    let lo = nodeIdx;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const midVal = decodeTree[mid];
        if (midVal < char) {
            lo = mid + 1;
        }
        else if (midVal > char) {
            hi = mid - 1;
        }
        else {
            return decodeTree[mid + branchCount];
        }
    }
    return -1;
}
const htmlDecoder = getDecoder(htmlDecodeTree);
getDecoder(xmlDecodeTree);
/**
 * Decodes an HTML string.
 *
 * @param str The string to decode.
 * @param mode The decoding mode.
 * @returns The decoded string.
 */
function decodeHTML(str, mode = DecodingMode.Legacy) {
    return htmlDecoder(str, mode);
}

// Utilities
//


function _class$1 (obj) { return Object.prototype.toString.call(obj) }

function isString$1 (obj) { return _class$1(obj) === '[object String]' }

const _hasOwnProperty = Object.prototype.hasOwnProperty;

function has (object, key) {
  return _hasOwnProperty.call(object, key)
}

// Merge objects
//
function assign$1 (obj /* from1, from2, from3, ... */) {
  const sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be object')
    }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj
}

// Remove element from array and put another array at those position.
// Useful for some operations with tokens
function arrayReplaceAt (src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1))
}

function isValidEntityCode (c) {
  /* eslint no-bitwise:0 */
  // broken sequence
  if (c >= 0xD800 && c <= 0xDFFF) { return false }
  // never used
  if (c >= 0xFDD0 && c <= 0xFDEF) { return false }
  if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false }
  // control codes
  if (c >= 0x00 && c <= 0x08) { return false }
  if (c === 0x0B) { return false }
  if (c >= 0x0E && c <= 0x1F) { return false }
  if (c >= 0x7F && c <= 0x9F) { return false }
  // out of range
  if (c > 0x10FFFF) { return false }
  return true
}

function fromCodePoint (c) {
  /* eslint no-bitwise:0 */
  if (c > 0xffff) {
    c -= 0x10000;
    const surrogate1 = 0xd800 + (c >> 10);
    const surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2)
  }
  return String.fromCharCode(c)
}

const UNESCAPE_MD_RE  = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const ENTITY_RE       = /&([a-z#][a-z0-9]{1,31});/gi;
const UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + '|' + ENTITY_RE.source, 'gi');

const DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;

function replaceEntityPattern (match, name) {
  if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code = name[1].toLowerCase() === 'x'
      ? parseInt(name.slice(2), 16)
      : parseInt(name.slice(1), 10);

    if (isValidEntityCode(code)) {
      return fromCodePoint(code)
    }

    return match
  }

  const decoded = decodeHTML(match);
  if (decoded !== match) {
    return decoded
  }

  return match
}

/* function replaceEntities(str) {
  if (str.indexOf('&') < 0) { return str; }

  return str.replace(ENTITY_RE, replaceEntityPattern);
} */

function unescapeMd (str) {
  if (str.indexOf('\\') < 0) { return str }
  return str.replace(UNESCAPE_MD_RE, '$1')
}

function unescapeAll (str) {
  if (str.indexOf('\\') < 0 && str.indexOf('&') < 0) { return str }

  return str.replace(UNESCAPE_ALL_RE, function (match, escaped, entity) {
    if (escaped) { return escaped }
    return replaceEntityPattern(match, entity)
  })
}

const HTML_ESCAPE_TEST_RE = /[&<>"]/;
const HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
const HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar (ch) {
  return HTML_REPLACEMENTS[ch]
}

function escapeHtml (str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar)
  }
  return str
}

const REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;

function escapeRE$1 (str) {
  return str.replace(REGEXP_ESCAPE_RE, '\\$&')
}

function isSpace (code) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true
  }
  return false
}

// Zs (unicode class) || [\t\f\v\r\n]
function isWhiteSpace (code) {
  if (code >= 0x2000 && code <= 0x200A) { return true }
  switch (code) {
    case 0x09: // \t
    case 0x0A: // \n
    case 0x0B: // \v
    case 0x0C: // \f
    case 0x0D: // \r
    case 0x20:
    case 0xA0:
    case 0x1680:
    case 0x202F:
    case 0x205F:
    case 0x3000:
      return true
  }
  return false
}

/* eslint-disable max-len */

// Currently without astral characters support.
function isPunctChar (ch) {
  return P.test(ch) || regex.test(ch)
}

// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
function isMdAsciiPunct (ch) {
  switch (ch) {
    case 0x21/* ! */:
    case 0x22/* " */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x27/* ' */:
    case 0x28/* ( */:
    case 0x29/* ) */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2C/* , */:
    case 0x2D/* - */:
    case 0x2E/* . */:
    case 0x2F/* / */:
    case 0x3A/* : */:
    case 0x3B/* ; */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x3F/* ? */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7C/* | */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true
    default:
      return false
  }
}

// Hepler to unify [reference labels].
//
function normalizeReference (str) {
  // Trim and collapse whitespace
  //
  str = str.trim().replace(/\s+/g, ' ');

  // In node v10 'ẞ'.toLowerCase() === 'Ṿ', which is presumed to be a bug
  // fixed in v12 (couldn't find any details).
  //
  // So treat this one as a special case
  // (remove this when node v10 is no longer supported).
  //
  if ('ẞ'.toLowerCase() === 'Ṿ') {
    str = str.replace(/ẞ/g, 'ß');
  }

  // .toLowerCase().toUpperCase() should get rid of all differences
  // between letter variants.
  //
  // Simple .toLowerCase() doesn't normalize 125 code points correctly,
  // and .toUpperCase doesn't normalize 6 of them (list of exceptions:
  // İ, ϴ, ẞ, Ω, K, Å - those are already uppercased, but have differently
  // uppercased versions).
  //
  // Here's an example showing how it happens. Lets take greek letter omega:
  // uppercase U+0398 (Θ), U+03f4 (ϴ) and lowercase U+03b8 (θ), U+03d1 (ϑ)
  //
  // Unicode entries:
  // 0398;GREEK CAPITAL LETTER THETA;Lu;0;L;;;;;N;;;;03B8;
  // 03B8;GREEK SMALL LETTER THETA;Ll;0;L;;;;;N;;;0398;;0398
  // 03D1;GREEK THETA SYMBOL;Ll;0;L;<compat> 03B8;;;;N;GREEK SMALL LETTER SCRIPT THETA;;0398;;0398
  // 03F4;GREEK CAPITAL THETA SYMBOL;Lu;0;L;<compat> 0398;;;;N;;;;03B8;
  //
  // Case-insensitive comparison should treat all of them as equivalent.
  //
  // But .toLowerCase() doesn't change ϑ (it's already lowercase),
  // and .toUpperCase() doesn't change ϴ (already uppercase).
  //
  // Applying first lower then upper case normalizes any character:
  // '\u0398\u03f4\u03b8\u03d1'.toLowerCase().toUpperCase() === '\u0398\u0398\u0398\u0398'
  //
  // Note: this is equivalent to unicode case folding; unicode normalization
  // is a different step that is not required here.
  //
  // Final result should be uppercased, because it's later stored in an object
  // (this avoid a conflict with Object.prototype members,
  // most notably, `__proto__`)
  //
  return str.toLowerCase().toUpperCase()
}

// Re-export libraries commonly used in both markdown-it and its plugins,
// so plugins won't have to depend on them explicitly, which reduces their
// bundled size (e.g. a browser build).
//
const lib = { mdurl, ucmicro };

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  arrayReplaceAt: arrayReplaceAt,
  assign: assign$1,
  escapeHtml: escapeHtml,
  escapeRE: escapeRE$1,
  fromCodePoint: fromCodePoint,
  has: has,
  isMdAsciiPunct: isMdAsciiPunct,
  isPunctChar: isPunctChar,
  isSpace: isSpace,
  isString: isString$1,
  isValidEntityCode: isValidEntityCode,
  isWhiteSpace: isWhiteSpace,
  lib: lib,
  normalizeReference: normalizeReference,
  unescapeAll: unescapeAll,
  unescapeMd: unescapeMd
});

// Parse link label
//
// this function assumes that first character ("[") already matches;
// returns the end of the label
//

function parseLinkLabel (state, start, disableNested) {
  let level, found, marker, prevPos;

  const max = state.posMax;
  const oldPos = state.pos;

  state.pos = start + 1;
  level = 1;

  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5D /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break
      }
    }

    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 0x5B /* [ */) {
      if (prevPos === state.pos - 1) {
        // increase level if we find text `[`, which is not a part of any token
        level++;
      } else if (disableNested) {
        state.pos = oldPos;
        return -1
      }
    }
  }

  let labelEnd = -1;

  if (found) {
    labelEnd = state.pos;
  }

  // restore old state
  state.pos = oldPos;

  return labelEnd
}

// Parse link destination
//


function parseLinkDestination (str, start, max) {
  let code;
  let pos = start;

  const result = {
    ok: false,
    pos: 0,
    str: ''
  };

  if (str.charCodeAt(pos) === 0x3C /* < */) {
    pos++;
    while (pos < max) {
      code = str.charCodeAt(pos);
      if (code === 0x0A /* \n */) { return result }
      if (code === 0x3C /* < */) { return result }
      if (code === 0x3E /* > */) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result
      }
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2;
        continue
      }

      pos++;
    }

    // no closing '>'
    return result
  }

  // this should be ... } else { ... branch

  let level = 0;
  while (pos < max) {
    code = str.charCodeAt(pos);

    if (code === 0x20) { break }

    // ascii control characters
    if (code < 0x20 || code === 0x7F) { break }

    if (code === 0x5C /* \ */ && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 0x20) { break }
      pos += 2;
      continue
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 32) { return result }
    }

    if (code === 0x29 /* ) */) {
      if (level === 0) { break }
      level--;
    }

    pos++;
  }

  if (start === pos) { return result }
  if (level !== 0) { return result }

  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result
}

// Parse link title
//


// Parse link title within `str` in [start, max] range,
// or continue previous parsing if `prev_state` is defined (equal to result of last execution).
//
function parseLinkTitle (str, start, max, prev_state) {
  let code;
  let pos = start;

  const state = {
    // if `true`, this is a valid link title
    ok: false,
    // if `true`, this link can be continued on the next line
    can_continue: false,
    // if `ok`, it's the position of the first character after the closing marker
    pos: 0,
    // if `ok`, it's the unescaped title
    str: '',
    // expected closing marker character code
    marker: 0
  };

  if (prev_state) {
    // this is a continuation of a previous parseLinkTitle call on the next line,
    // used in reference links only
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) { return state }

    let marker = str.charCodeAt(pos);
    if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return state }

    start++;
    pos++;

    // if opening marker is "(", switch it to closing marker ")"
    if (marker === 0x28) { marker = 0x29; }

    state.marker = marker;
  }

  while (pos < max) {
    code = str.charCodeAt(pos);
    if (code === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state
    } else if (code === 0x28 /* ( */ && state.marker === 0x29 /* ) */) {
      return state
    } else if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos++;
    }

    pos++;
  }

  // no closing marker found, but this link title may continue on the next line (for references)
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state
}

// Just a shortcut for bulk export

var helpers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  parseLinkDestination: parseLinkDestination,
  parseLinkLabel: parseLinkLabel,
  parseLinkTitle: parseLinkTitle
});

/**
 * class Renderer
 *
 * Generates HTML from parsed token stream. Each instance has independent
 * copy of rules. Those can be rewritten with ease. Also, you can add new
 * rules if you create plugin and adds new token types.
 **/


const default_rules = {};

default_rules.code_inline = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  return  '<code' + slf.renderAttrs(token) + '>' +
          escapeHtml(token.content) +
          '</code>'
};

default_rules.code_block = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  return  '<pre' + slf.renderAttrs(token) + '><code>' +
          escapeHtml(tokens[idx].content) +
          '</code></pre>\n'
};

default_rules.fence = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : '';
  let langName = '';
  let langAttrs = '';

  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join('');
  }

  let highlighted;
  if (options.highlight) {
    highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
  } else {
    highlighted = escapeHtml(token.content);
  }

  if (highlighted.indexOf('<pre') === 0) {
    return highlighted + '\n'
  }

  // If language exists, inject class gently, without modifying original token.
  // May be, one day we will add .deepClone() for token and simplify this part, but
  // now we prefer to keep things local.
  if (info) {
    const i = token.attrIndex('class');
    const tmpAttrs = token.attrs ? token.attrs.slice() : [];

    if (i < 0) {
      tmpAttrs.push(['class', options.langPrefix + langName]);
    } else {
      tmpAttrs[i] = tmpAttrs[i].slice();
      tmpAttrs[i][1] += ' ' + options.langPrefix + langName;
    }

    // Fake token just to render attributes
    const tmpToken = {
      attrs: tmpAttrs
    };

    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>\n`
  }

  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>\n`
};

default_rules.image = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs[token.attrIndex('alt')][1] =
    slf.renderInlineAsText(token.children, options, env);

  return slf.renderToken(tokens, idx, options)
};

default_rules.hardbreak = function (tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n'
};
default_rules.softbreak = function (tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
};

default_rules.text = function (tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content)
};

default_rules.html_block = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
};
default_rules.html_inline = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
};

/**
 * new Renderer()
 *
 * Creates new [[Renderer]] instance and fill [[Renderer#rules]] with defaults.
 **/
function Renderer () {
  /**
   * Renderer#rules -> Object
   *
   * Contains render rules for tokens. Can be updated and extended.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.renderer.rules.strong_open  = function () { return '<b>'; };
   * md.renderer.rules.strong_close = function () { return '</b>'; };
   *
   * var result = md.renderInline(...);
   * ```
   *
   * Each rule is called as independent static function with fixed signature:
   *
   * ```javascript
   * function my_token_render(tokens, idx, options, env, renderer) {
   *   // ...
   *   return renderedHTML;
   * }
   * ```
   *
   * See [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.mjs)
   * for more details and examples.
   **/
  this.rules = assign$1({}, default_rules);
}

/**
 * Renderer.renderAttrs(token) -> String
 *
 * Render token attributes to string.
 **/
Renderer.prototype.renderAttrs = function renderAttrs (token) {
  let i, l, result;

  if (!token.attrs) { return '' }

  result = '';

  for (i = 0, l = token.attrs.length; i < l; i++) {
    result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
  }

  return result
};

/**
 * Renderer.renderToken(tokens, idx, options) -> String
 * - tokens (Array): list of tokens
 * - idx (Numbed): token index to render
 * - options (Object): params of parser instance
 *
 * Default token renderer. Can be overriden by custom function
 * in [[Renderer#rules]].
 **/
Renderer.prototype.renderToken = function renderToken (tokens, idx, options) {
  const token = tokens[idx];
  let result = '';

  // Tight list paragraphs
  if (token.hidden) {
    return ''
  }

  // Insert a newline between hidden paragraph and subsequent opening
  // block-level tag.
  //
  // For example, here we should insert a newline before blockquote:
  //  - a
  //    >
  //
  if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
    result += '\n';
  }

  // Add token name, e.g. `<img`
  result += (token.nesting === -1 ? '</' : '<') + token.tag;

  // Encode attributes, e.g. `<img src="foo"`
  result += this.renderAttrs(token);

  // Add a slash for self-closing tags, e.g. `<img src="foo" /`
  if (token.nesting === 0 && options.xhtmlOut) {
    result += ' /';
  }

  // Check if we need to add a newline after this tag
  let needLf = false;
  if (token.block) {
    needLf = true;

    if (token.nesting === 1) {
      if (idx + 1 < tokens.length) {
        const nextToken = tokens[idx + 1];

        if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
          needLf = false;
        } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
          needLf = false;
        }
      }
    }
  }

  result += needLf ? '>\n' : '>';

  return result
};

/**
 * Renderer.renderInline(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * The same as [[Renderer.render]], but for single token of `inline` type.
 **/
Renderer.prototype.renderInline = function (tokens, options, env) {
  let result = '';
  const rules = this.rules;

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type;

    if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options);
    }
  }

  return result
};

/** internal
 * Renderer.renderInlineAsText(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Special kludge for image `alt` attributes to conform CommonMark spec.
 * Don't try to use it! Spec requires to show `alt` content with stripped markup,
 * instead of simple escaping.
 **/
Renderer.prototype.renderInlineAsText = function (tokens, options, env) {
  let result = '';

  for (let i = 0, len = tokens.length; i < len; i++) {
    switch (tokens[i].type) {
      case 'text':
        result += tokens[i].content;
        break
      case 'image':
        result += this.renderInlineAsText(tokens[i].children, options, env);
        break
      case 'html_inline':
      case 'html_block':
        result += tokens[i].content;
        break
      case 'softbreak':
      case 'hardbreak':
        result += '\n';
        break
        // all other tokens are skipped
    }
  }

  return result
};

/**
 * Renderer.render(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Takes token stream and generates HTML. Probably, you will never need to call
 * this method directly.
 **/
Renderer.prototype.render = function (tokens, options, env) {
  let result = '';
  const rules = this.rules;

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type;

    if (type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env);
    } else if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options, env);
    }
  }

  return result
};

/**
 * class Ruler
 *
 * Helper class, used by [[MarkdownIt#core]], [[MarkdownIt#block]] and
 * [[MarkdownIt#inline]] to manage sequences of functions (rules):
 *
 * - keep rules in defined order
 * - assign the name to each rule
 * - enable/disable rules
 * - add/replace rules
 * - allow assign rules to additional named chains (in the same)
 * - cacheing lists of active rules
 *
 * You will not need use this class directly until write plugins. For simple
 * rules control use [[MarkdownIt.disable]], [[MarkdownIt.enable]] and
 * [[MarkdownIt.use]].
 **/

/**
 * new Ruler()
 **/
function Ruler () {
  // List of added rules. Each element is:
  //
  // {
  //   name: XXX,
  //   enabled: Boolean,
  //   fn: Function(),
  //   alt: [ name2, name3 ]
  // }
  //
  this.__rules__ = [];

  // Cached rule chains.
  //
  // First level - chain name, '' for default.
  // Second level - diginal anchor for fast filtering by charcodes.
  //
  this.__cache__ = null;
}

// Helper methods, should not be used directly

// Find rule index by name
//
Ruler.prototype.__find__ = function (name) {
  for (let i = 0; i < this.__rules__.length; i++) {
    if (this.__rules__[i].name === name) {
      return i
    }
  }
  return -1
};

// Build rules lookup cache
//
Ruler.prototype.__compile__ = function () {
  const self = this;
  const chains = [''];

  // collect unique names
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) { return }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName);
      }
    });
  });

  self.__cache__ = {};

  chains.forEach(function (chain) {
    self.__cache__[chain] = [];
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) { return }

      if (chain && rule.alt.indexOf(chain) < 0) { return }

      self.__cache__[chain].push(rule.fn);
    });
  });
};

/**
 * Ruler.at(name, fn [, options])
 * - name (String): rule name to replace.
 * - fn (Function): new rule function.
 * - options (Object): new rule options (not mandatory).
 *
 * Replace rule by name with new function & options. Throws error if name not
 * found.
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * Replace existing typographer replacement rule with new one:
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.at('replacements', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.at = function (name, fn, options) {
  const index = this.__find__(name);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + name) }

  this.__rules__[index].fn = fn;
  this.__rules__[index].alt = opt.alt || [];
  this.__cache__ = null;
};

/**
 * Ruler.before(beforeName, ruleName, fn [, options])
 * - beforeName (String): new rule will be added before this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain before one with given name. See also
 * [[Ruler.after]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  const index = this.__find__(beforeName);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + beforeName) }

  this.__rules__.splice(index, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.after(afterName, ruleName, fn [, options])
 * - afterName (String): new rule will be added after this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain after one with given name. See also
 * [[Ruler.before]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.inline.ruler.after('text', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  const index = this.__find__(afterName);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + afterName) }

  this.__rules__.splice(index + 1, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.push(ruleName, fn [, options])
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Push new rule to the end of chain. See also
 * [[Ruler.before]], [[Ruler.after]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.push('my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.push = function (ruleName, fn, options) {
  const opt = options || {};

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.enable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to enable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.disable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.enable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  const result = [];

  // Search by name and enable
  list.forEach(function (name) {
    const idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = true;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result
};

/**
 * Ruler.enableOnly(list [, ignoreInvalid])
 * - list (String|Array): list of rule names to enable (whitelist).
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names, and disable everything else. If any rule name
 * not found - throw Error. Errors can be disabled by second param.
 *
 * See also [[Ruler.disable]], [[Ruler.enable]].
 **/
Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  this.__rules__.forEach(function (rule) { rule.enabled = false; });

  this.enable(list, ignoreInvalid);
};

/**
 * Ruler.disable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Disable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.enable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.disable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  const result = [];

  // Search by name and disable
  list.forEach(function (name) {
    const idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = false;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result
};

/**
 * Ruler.getRules(chainName) -> Array
 *
 * Return array of active functions (rules) for given chain name. It analyzes
 * rules configuration, compiles caches if not exists and returns result.
 *
 * Default chain name is `''` (empty string). It can't be skipped. That's
 * done intentionally, to keep signature monomorphic for high speed.
 **/
Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__();
  }

  // Chain can be empty, if rules disabled. But we still have to return Array.
  return this.__cache__[chainName] || []
};

// Token class

/**
 * class Token
 **/

/**
 * new Token(type, tag, nesting)
 *
 * Create new token and fill passed properties.
 **/
function Token (type, tag, nesting) {
  /**
   * Token#type -> String
   *
   * Type of the token (string, e.g. "paragraph_open")
   **/
  this.type     = type;

  /**
   * Token#tag -> String
   *
   * html tag name, e.g. "p"
   **/
  this.tag      = tag;

  /**
   * Token#attrs -> Array
   *
   * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
   **/
  this.attrs    = null;

  /**
   * Token#map -> Array
   *
   * Source map info. Format: `[ line_begin, line_end ]`
   **/
  this.map      = null;

  /**
   * Token#nesting -> Number
   *
   * Level change (number in {-1, 0, 1} set), where:
   *
   * -  `1` means the tag is opening
   * -  `0` means the tag is self-closing
   * - `-1` means the tag is closing
   **/
  this.nesting  = nesting;

  /**
   * Token#level -> Number
   *
   * nesting level, the same as `state.level`
   **/
  this.level    = 0;

  /**
   * Token#children -> Array
   *
   * An array of child nodes (inline and img tokens)
   **/
  this.children = null;

  /**
   * Token#content -> String
   *
   * In a case of self-closing tag (code, html, fence, etc.),
   * it has contents of this tag.
   **/
  this.content  = '';

  /**
   * Token#markup -> String
   *
   * '*' or '_' for emphasis, fence string for fence, etc.
   **/
  this.markup   = '';

  /**
   * Token#info -> String
   *
   * Additional information:
   *
   * - Info string for "fence" tokens
   * - The value "auto" for autolink "link_open" and "link_close" tokens
   * - The string value of the item marker for ordered-list "list_item_open" tokens
   **/
  this.info     = '';

  /**
   * Token#meta -> Object
   *
   * A place for plugins to store an arbitrary data
   **/
  this.meta     = null;

  /**
   * Token#block -> Boolean
   *
   * True for block-level tokens, false for inline tokens.
   * Used in renderer to calculate line breaks
   **/
  this.block    = false;

  /**
   * Token#hidden -> Boolean
   *
   * If it's true, ignore this element when rendering. Used for tight lists
   * to hide paragraphs.
   **/
  this.hidden   = false;
}

/**
 * Token.attrIndex(name) -> Number
 *
 * Search attribute index by name.
 **/
Token.prototype.attrIndex = function attrIndex (name) {
  if (!this.attrs) { return -1 }

  const attrs = this.attrs;

  for (let i = 0, len = attrs.length; i < len; i++) {
    if (attrs[i][0] === name) { return i }
  }
  return -1
};

/**
 * Token.attrPush(attrData)
 *
 * Add `[ name, value ]` attribute to list. Init attrs if necessary
 **/
Token.prototype.attrPush = function attrPush (attrData) {
  if (this.attrs) {
    this.attrs.push(attrData);
  } else {
    this.attrs = [attrData];
  }
};

/**
 * Token.attrSet(name, value)
 *
 * Set `name` attribute to `value`. Override old value if exists.
 **/
Token.prototype.attrSet = function attrSet (name, value) {
  const idx = this.attrIndex(name);
  const attrData = [name, value];

  if (idx < 0) {
    this.attrPush(attrData);
  } else {
    this.attrs[idx] = attrData;
  }
};

/**
 * Token.attrGet(name)
 *
 * Get the value of attribute `name`, or null if it does not exist.
 **/
Token.prototype.attrGet = function attrGet (name) {
  const idx = this.attrIndex(name);
  let value = null;
  if (idx >= 0) {
    value = this.attrs[idx][1];
  }
  return value
};

/**
 * Token.attrJoin(name, value)
 *
 * Join value to existing attribute via space. Or create new attribute if not
 * exists. Useful to operate with token classes.
 **/
Token.prototype.attrJoin = function attrJoin (name, value) {
  const idx = this.attrIndex(name);

  if (idx < 0) {
    this.attrPush([name, value]);
  } else {
    this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value;
  }
};

// Core state object
//


function StateCore (src, md, env) {
  this.src = src;
  this.env = env;
  this.tokens = [];
  this.inlineMode = false;
  this.md = md; // link to parser instance
}

// re-export Token class to use in core rules
StateCore.prototype.Token = Token;

// Normalize input string

// https://spec.commonmark.org/0.29/#line-ending
const NEWLINES_RE  = /\r\n?|\n/g;
const NULL_RE      = /\0/g;

function normalize (state) {
  let str;

  // Normalize newlines
  str = state.src.replace(NEWLINES_RE, '\n');

  // Replace NULL characters
  str = str.replace(NULL_RE, '\uFFFD');

  state.src = str;
}

function block (state) {
  let token;

  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0);
    token.content  = state.src;
    token.map      = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else {
    state.md.block.parse(state.src, state.md, state.env, state.tokens);
  }
}

function inline (state) {
  const tokens = state.tokens;

  // Parse inlines
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === 'inline') {
      state.md.inline.parse(tok.content, state.md, state.env, tok.children);
    }
  }
}

// Replace link-like texts with link nodes.
//
// Currently restricted by `md.validateLink()` to http/https/ftp
//


function isLinkOpen$1 (str) {
  return /^<a[>\s]/i.test(str)
}
function isLinkClose$1 (str) {
  return /^<\/a\s*>/i.test(str)
}

function linkify$1 (state) {
  const blockTokens = state.tokens;

  if (!state.md.options.linkify) { return }

  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline' ||
        !state.md.linkify.pretest(blockTokens[j].content)) {
      continue
    }

    let tokens = blockTokens[j].children;

    let htmlLinkLevel = 0;

    // We scan from the end, to keep position when new tags added.
    // Use reversed logic in links start/end match
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];

      // Skip content of markdown links
      if (currentToken.type === 'link_close') {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
          i--;
        }
        continue
      }

      // Skip content of html tag links
      if (currentToken.type === 'html_inline') {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--;
        }
        if (isLinkClose$1(currentToken.content)) {
          htmlLinkLevel++;
        }
      }
      if (htmlLinkLevel > 0) { continue }

      if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {
        const text = currentToken.content;
        let links = state.md.linkify.match(text);

        // Now split string to nodes
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;

        // forbid escape sequence at the start of the string,
        // this avoids http\://example.com/ from being linkified as
        // http:<a href="//example.com/">//example.com/</a>
        if (links.length > 0 &&
            links[0].index === 0 &&
            i > 0 &&
            tokens[i - 1].type === 'text_special') {
          links = links.slice(1);
        }

        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url;
          const fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) { continue }

          let urlText = links[ln].text;

          // Linkifier might send raw hostnames like "example.com", where url
          // starts with domain name. So we prepend http:// in those cases,
          // and remove it afterwards.
          //
          if (!links[ln].schema) {
            urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '');
          } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
            urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '');
          } else {
            urlText = state.md.normalizeLinkText(urlText);
          }

          const pos = links[ln].index;

          if (pos > lastPos) {
            const token   = new state.Token('text', '', 0);
            token.content = text.slice(lastPos, pos);
            token.level   = level;
            nodes.push(token);
          }

          const token_o   = new state.Token('link_open', 'a', 1);
          token_o.attrs   = [['href', fullUrl]];
          token_o.level   = level++;
          token_o.markup  = 'linkify';
          token_o.info    = 'auto';
          nodes.push(token_o);

          const token_t   = new state.Token('text', '', 0);
          token_t.content = urlText;
          token_t.level   = level;
          nodes.push(token_t);

          const token_c   = new state.Token('link_close', 'a', -1);
          token_c.level   = --level;
          token_c.markup  = 'linkify';
          token_c.info    = 'auto';
          nodes.push(token_c);

          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text.length) {
          const token   = new state.Token('text', '', 0);
          token.content = text.slice(lastPos);
          token.level   = level;
          nodes.push(token);
        }

        // replace current node
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  }
}

// Simple typographic replacements
//
// (c) (C) → ©
// (tm) (TM) → ™
// (r) (R) → ®
// +- → ±
// ... → … (also ?.... → ?.., !.... → !..)
// ???????? → ???, !!!!! → !!!, `,,` → `,`
// -- → &ndash;, --- → &mdash;
//

// TODO:
// - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - multiplications 2 x 4 -> 2 × 4

const RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

// Workaround for phantomjs - need regex without /g flag,
// or root check will fail every second time
const SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;

const SCOPED_ABBR_RE = /\((c|tm|r)\)/ig;
const SCOPED_ABBR = {
  c: '©',
  r: '®',
  tm: '™'
};

function replaceFn (match, name) {
  return SCOPED_ABBR[name.toLowerCase()]
}

function replace_scoped (inlineTokens) {
  let inside_autolink = 0;

  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];

    if (token.type === 'text' && !inside_autolink) {
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    }

    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--;
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++;
    }
  }
}

function replace_rare (inlineTokens) {
  let inside_autolink = 0;

  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];

    if (token.type === 'text' && !inside_autolink) {
      if (RARE_RE.test(token.content)) {
        token.content = token.content
          .replace(/\+-/g, '±')
          // .., ..., ....... -> …
          // but ?..... & !..... -> ?.. & !..
          .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
          .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
          // em-dash
          .replace(/(^|[^-])---(?=[^-]|$)/mg, '$1\u2014')
          // en-dash
          .replace(/(^|\s)--(?=\s|$)/mg, '$1\u2013')
          .replace(/(^|[^-\s])--(?=[^-\s]|$)/mg, '$1\u2013');
      }
    }

    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--;
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++;
    }
  }
}

function replace (state) {
  let blkIdx;

  if (!state.md.options.typographer) { return }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== 'inline') { continue }

    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
      replace_scoped(state.tokens[blkIdx].children);
    }

    if (RARE_RE.test(state.tokens[blkIdx].content)) {
      replace_rare(state.tokens[blkIdx].children);
    }
  }
}

// Convert straight quotation marks to typographic ones
//


const QUOTE_TEST_RE = /['"]/;
const QUOTE_RE = /['"]/g;
const APOSTROPHE = '\u2019'; /* ’ */

function replaceAt (str, index, ch) {
  return str.slice(0, index) + ch + str.slice(index + 1)
}

function process_inlines (tokens, state) {
  let j;

  const stack = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const thisLevel = tokens[i].level;

    for (j = stack.length - 1; j >= 0; j--) {
      if (stack[j].level <= thisLevel) { break }
    }
    stack.length = j + 1;

    if (token.type !== 'text') { continue }

    let text = token.content;
    let pos = 0;
    let max = text.length;

    /* eslint no-labels:0,block-scoped-var:0 */
    OUTER:
    while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text);
      if (!t) { break }

      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = (t[0] === "'");

      // Find previous character,
      // default to space if it's the beginning of the line
      //
      let lastChar = 0x20;

      if (t.index - 1 >= 0) {
        lastChar = text.charCodeAt(t.index - 1);
      } else {
        for (j = i - 1; j >= 0; j--) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // lastChar defaults to 0x20
          if (!tokens[j].content) continue // should skip all tokens except 'text', 'html_inline' or 'code_inline'

          lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
          break
        }
      }

      // Find next character,
      // default to space if it's the end of the line
      //
      let nextChar = 0x20;

      if (pos < max) {
        nextChar = text.charCodeAt(pos);
      } else {
        for (j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // nextChar defaults to 0x20
          if (!tokens[j].content) continue // should skip all tokens except 'text', 'html_inline' or 'code_inline'

          nextChar = tokens[j].content.charCodeAt(0);
          break
        }
      }

      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);

      if (isNextWhiteSpace) {
        canOpen = false;
      } else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) {
          canOpen = false;
        }
      }

      if (isLastWhiteSpace) {
        canClose = false;
      } else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) {
          canClose = false;
        }
      }

      if (nextChar === 0x22 /* " */ && t[0] === '"') {
        if (lastChar >= 0x30 /* 0 */ && lastChar <= 0x39 /* 9 */) {
          // special case: 1"" - count first quote as an inch
          canClose = canOpen = false;
        }
      }

      if (canOpen && canClose) {
        // Replace quotes in the middle of punctuation sequence, but not
        // in the middle of the words, i.e.:
        //
        // 1. foo " bar " baz - not replaced
        // 2. foo-"-bar-"-baz - replaced
        // 3. foo"bar"baz     - not replaced
        //
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }

      if (!canOpen && !canClose) {
        // middle of word
        if (isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
        continue
      }

      if (canClose) {
        // this could be a closing quote, rewind the stack to get a match
        for (j = stack.length - 1; j >= 0; j--) {
          let item = stack[j];
          if (stack[j].level < thisLevel) { break }
          if (item.single === isSingle && stack[j].level === thisLevel) {
            item = stack[j];

            let openQuote;
            let closeQuote;
            if (isSingle) {
              openQuote = state.md.options.quotes[2];
              closeQuote = state.md.options.quotes[3];
            } else {
              openQuote = state.md.options.quotes[0];
              closeQuote = state.md.options.quotes[1];
            }

            // replace token.content *before* tokens[item.token].content,
            // because, if they are pointing at the same token, replaceAt
            // could mess up indices when quote length != 1
            token.content = replaceAt(token.content, t.index, closeQuote);
            tokens[item.token].content = replaceAt(
              tokens[item.token].content, item.pos, openQuote);

            pos += closeQuote.length - 1;
            if (item.token === i) { pos += openQuote.length - 1; }

            text = token.content;
            max = text.length;

            stack.length = j;
            continue OUTER
          }
        }
      }

      if (canOpen) {
        stack.push({
          token: i,
          pos: t.index,
          single: isSingle,
          level: thisLevel
        });
      } else if (canClose && isSingle) {
        token.content = replaceAt(token.content, t.index, APOSTROPHE);
      }
    }
  }
}

function smartquotes (state) {
  /* eslint max-depth:0 */
  if (!state.md.options.typographer) { return }

  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== 'inline' ||
        !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
      continue
    }

    process_inlines(state.tokens[blkIdx].children, state);
  }
}

// Join raw text tokens with the rest of the text
//
// This is set as a separate rule to provide an opportunity for plugins
// to run text replacements after text join, but before escape join.
//
// For example, `\:)` shouldn't be replaced with an emoji.
//

function text_join (state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;

  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== 'inline') continue

    const tokens = blockTokens[j].children;
    const max = tokens.length;

    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text_special') {
        tokens[curr].type = 'text';
      }
    }

    for (curr = last = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text' &&
          curr + 1 < max &&
          tokens[curr + 1].type === 'text') {
        // collapse two adjacent text nodes
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
      } else {
        if (curr !== last) { tokens[last] = tokens[curr]; }

        last++;
      }
    }

    if (curr !== last) {
      tokens.length = last;
    }
  }
}

/** internal
 * class Core
 *
 * Top-level rules executor. Glues block/inline parsers and does intermediate
 * transformations.
 **/


const _rules$2 = [
  ['normalize',      normalize],
  ['block',          block],
  ['inline',         inline],
  ['linkify',        linkify$1],
  ['replacements',   replace],
  ['smartquotes',    smartquotes],
  // `text_join` finds `text_special` tokens (for escape sequences)
  // and joins them with the rest of the text
  ['text_join',      text_join]
];

/**
 * new Core()
 **/
function Core () {
  /**
   * Core#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of core rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules$2.length; i++) {
    this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }
}

/**
 * Core.process(state)
 *
 * Executes core chain rules.
 **/
Core.prototype.process = function (state) {
  const rules = this.ruler.getRules('');

  for (let i = 0, l = rules.length; i < l; i++) {
    rules[i](state);
  }
};

Core.prototype.State = StateCore;

// Parser state class


function StateBlock (src, md, env, tokens) {
  this.src = src;

  // link to parser instance
  this.md     = md;

  this.env = env;

  //
  // Internal state vartiables
  //

  this.tokens = tokens;

  this.bMarks = [];  // line begin offsets for fast jumps
  this.eMarks = [];  // line end offsets for fast jumps
  this.tShift = [];  // offsets of the first non-space characters (tabs not expanded)
  this.sCount = [];  // indents for each line (tabs expanded)

  // An amount of virtual spaces (tabs expanded) between beginning
  // of each line (bMarks) and real beginning of that line.
  //
  // It exists only as a hack because blockquotes override bMarks
  // losing information in the process.
  //
  // It's used only when expanding tabs, you can think about it as
  // an initial tab length, e.g. bsCount=21 applied to string `\t123`
  // means first tab should be expanded to 4-21%4 === 3 spaces.
  //
  this.bsCount = [];

  // block parser variables

  // required block content indent (for example, if we are
  // inside a list, it would be positioned after list marker)
  this.blkIndent  = 0;
  this.line       = 0; // line index in src
  this.lineMax    = 0; // lines count
  this.tight      = false;  // loose/tight mode for lists
  this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)
  this.listIndent = -1; // indent of the current list block (-1 if there isn't any)

  // can be 'blockquote', 'list', 'root', 'paragraph' or 'reference'
  // used in lists to determine if they interrupt a paragraph
  this.parentType = 'root';

  this.level = 0;

  // Create caches
  // Generate markers.
  const s = this.src;

  for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
    const ch = s.charCodeAt(pos);

    if (!indent_found) {
      if (isSpace(ch)) {
        indent++;

        if (ch === 0x09) {
          offset += 4 - offset % 4;
        } else {
          offset++;
        }
        continue
      } else {
        indent_found = true;
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++; }
      this.bMarks.push(start);
      this.eMarks.push(pos);
      this.tShift.push(indent);
      this.sCount.push(offset);
      this.bsCount.push(0);

      indent_found = false;
      indent = 0;
      offset = 0;
      start = pos + 1;
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length);
  this.eMarks.push(s.length);
  this.tShift.push(0);
  this.sCount.push(0);
  this.bsCount.push(0);

  this.lineMax = this.bMarks.length - 1; // don't count last fake line
}

// Push new token to "stream".
//
StateBlock.prototype.push = function (type, tag, nesting) {
  const token = new Token(type, tag, nesting);
  token.block = true;

  if (nesting < 0) this.level--; // closing tag
  token.level = this.level;
  if (nesting > 0) this.level++; // opening tag

  this.tokens.push(token);
  return token
};

StateBlock.prototype.isEmpty = function isEmpty (line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line]
};

StateBlock.prototype.skipEmptyLines = function skipEmptyLines (from) {
  for (let max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break
    }
  }
  return from
};

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces (pos) {
  for (let max = this.src.length; pos < max; pos++) {
    const ch = this.src.charCodeAt(pos);
    if (!isSpace(ch)) { break }
  }
  return pos
};

// Skip spaces from given position in reverse.
StateBlock.prototype.skipSpacesBack = function skipSpacesBack (pos, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (!isSpace(this.src.charCodeAt(--pos))) { return pos + 1 }
  }
  return pos
};

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars (pos, code) {
  for (let max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break }
  }
  return pos
};

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack (pos, code, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1 }
  }
  return pos
};

// cut lines range from source.
StateBlock.prototype.getLines = function getLines (begin, end, indent, keepLastLF) {
  if (begin >= end) {
    return ''
  }

  const queue = new Array(end - begin);

  for (let i = 0, line = begin; line < end; line++, i++) {
    let lineIndent = 0;
    const lineStart = this.bMarks[line];
    let first = lineStart;
    let last;

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1;
    } else {
      last = this.eMarks[line];
    }

    while (first < last && lineIndent < indent) {
      const ch = this.src.charCodeAt(first);

      if (isSpace(ch)) {
        if (ch === 0x09) {
          lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
        } else {
          lineIndent++;
        }
      } else if (first - lineStart < this.tShift[line]) {
        // patched tShift masked characters to look like spaces (blockquotes, list markers)
        lineIndent++;
      } else {
        break
      }

      first++;
    }

    if (lineIndent > indent) {
      // partially expanding tabs in code blocks, e.g '\t\tfoobar'
      // with indent=2 becomes '  \tfoobar'
      queue[i] = new Array(lineIndent - indent + 1).join(' ') + this.src.slice(first, last);
    } else {
      queue[i] = this.src.slice(first, last);
    }
  }

  return queue.join('')
};

// re-export Token class to use in block rules
StateBlock.prototype.Token = Token;

// GFM table, https://github.github.com/gfm/#tables-extension-


// Limit the amount of empty autocompleted cells in a table,
// see https://github.com/markdown-it/markdown-it/issues/1000,
//
// Both pulldown-cmark and commonmark-hs limit the number of cells this way to ~200k.
// We set it to 65k, which can expand user input by a factor of x370
// (256x256 square is 1.8kB expanded into 650kB).
const MAX_AUTOCOMPLETED_CELLS = 0x10000;

function getLine (state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];

  return state.src.slice(pos, max)
}

function escapedSplit (str) {
  const result = [];
  const max = str.length;

  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = '';

  while (pos < max) {
    if (ch === 0x7c/* | */) {
      if (!isEscaped) {
        // pipe separating cells, '|'
        result.push(current + str.substring(lastPos, pos));
        current = '';
        lastPos = pos + 1;
      } else {
        // escaped pipe, '\|'
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    }

    isEscaped = (ch === 0x5c/* \ */);
    pos++;

    ch = str.charCodeAt(pos);
  }

  result.push(current + str.substring(lastPos));

  return result
}

function table (state, startLine, endLine, silent) {
  // should have at least two lines
  if (startLine + 2 > endLine) { return false }

  let nextLine = startLine + 1;

  if (state.sCount[nextLine] < state.blkIndent) { return false }

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[nextLine] - state.blkIndent >= 4) { return false }

  // first character of the second line should be '|', '-', ':',
  // and no other characters are allowed but spaces;
  // basically, this is the equivalent of /^[-:|][-:|\s]*$/ regexp

  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) { return false }

  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 0x7C/* | */ && firstCh !== 0x2D/* - */ && firstCh !== 0x3A/* : */) { return false }

  if (pos >= state.eMarks[nextLine]) { return false }

  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 0x7C/* | */ && secondCh !== 0x2D/* - */ && secondCh !== 0x3A/* : */ && !isSpace(secondCh)) {
    return false
  }

  // if first character is '-', then second character must not be a space
  // (due to parsing ambiguity with list)
  if (firstCh === 0x2D/* - */ && isSpace(secondCh)) { return false }

  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);

    if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */ && !isSpace(ch)) { return false }

    pos++;
  }

  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split('|');
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === columns.length - 1) {
        continue
      } else {
        return false
      }
    }

    if (!/^:?-+:?$/.test(t)) { return false }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left');
    } else {
      aligns.push('');
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf('|') === -1) { return false }
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === '') columns.shift();
  if (columns.length && columns[columns.length - 1] === '') columns.pop();

  // header row will define an amount of columns in the entire table,
  // and align row should be exactly the same (the rest of the rows can differ)
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) { return false }

  if (silent) { return true }

  const oldParentType = state.parentType;
  state.parentType = 'table';

  // use 'blockquote' lists for termination because it's
  // the most similar to tables
  const terminatorRules = state.md.block.ruler.getRules('blockquote');

  const token_to = state.push('table_open', 'table', 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;

  const token_tho = state.push('thead_open', 'thead', 1);
  token_tho.map = [startLine, startLine + 1];

  const token_htro = state.push('tr_open', 'tr', 1);
  token_htro.map = [startLine, startLine + 1];

  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push('th_open', 'th', 1);
    if (aligns[i]) {
      token_ho.attrs  = [['style', 'text-align:' + aligns[i]]];
    }

    const token_il = state.push('inline', '', 0);
    token_il.content  = columns[i].trim();
    token_il.children = [];

    state.push('th_close', 'th', -1);
  }

  state.push('tr_close', 'tr', -1);
  state.push('thead_close', 'thead', -1);

  let tbodyLines;
  let autocompletedCells = 0;

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) { break }

    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }

    if (terminate) { break }
    lineText = getLine(state, nextLine).trim();
    if (!lineText) { break }
    if (state.sCount[nextLine] - state.blkIndent >= 4) { break }
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === '') columns.shift();
    if (columns.length && columns[columns.length - 1] === '') columns.pop();

    // note: autocomplete count can be negative if user specifies more columns than header,
    // but that does not affect intended use (which is limiting expansion)
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) { break }

    if (nextLine === startLine + 2) {
      const token_tbo = state.push('tbody_open', 'tbody', 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }

    const token_tro = state.push('tr_open', 'tr', 1);
    token_tro.map = [nextLine, nextLine + 1];

    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push('td_open', 'td', 1);
      if (aligns[i]) {
        token_tdo.attrs  = [['style', 'text-align:' + aligns[i]]];
      }

      const token_il = state.push('inline', '', 0);
      token_il.content  = columns[i] ? columns[i].trim() : '';
      token_il.children = [];

      state.push('td_close', 'td', -1);
    }
    state.push('tr_close', 'tr', -1);
  }

  if (tbodyLines) {
    state.push('tbody_close', 'tbody', -1);
    tbodyLines[1] = nextLine;
  }

  state.push('table_close', 'table', -1);
  tableLines[1] = nextLine;

  state.parentType = oldParentType;
  state.line = nextLine;
  return true
}

// Code block (4 spaces padded)

function code (state, startLine, endLine/*, silent */) {
  if (state.sCount[startLine] - state.blkIndent < 4) { return false }

  let nextLine = startLine + 1;
  let last = nextLine;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue
    }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue
    }
    break
  }

  state.line = last;

  const token   = state.push('code_block', 'code', 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + '\n';
  token.map     = [startLine, state.line];

  return true
}

// fences (``` lang, ~~~ lang)

function fence (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (pos + 3 > max) { return false }

  const marker = state.src.charCodeAt(pos);

  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false
  }

  // scan marker length
  let mem = pos;
  pos = state.skipChars(pos, marker);

  let len = pos - mem;

  if (len < 3) { return false }

  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);

  if (marker === 0x60 /* ` */) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) {
      return false
    }
  }

  // Since start is found, we can report success here in validation mode
  if (silent) { return true }

  // search end of block
  let nextLine = startLine;
  let haveEndMarker = false;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.sCount[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break
    }

    if (state.src.charCodeAt(pos) !== marker) { continue }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) { continue }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) { continue }

    haveEndMarker = true;
    // found!
    break
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.sCount[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);

  const token   = state.push('fence', 'code', 0);
  token.info    = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup  = markup;
  token.map     = [startLine, state.line];

  return true
}

// Block quotes


function blockquote (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  const oldLineMax = state.lineMax;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // check the block quote marker
  if (state.src.charCodeAt(pos) !== 0x3E/* > */) { return false }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) { return true }

  const oldBMarks  = [];
  const oldBSCount = [];
  const oldSCount  = [];
  const oldTShift  = [];

  const terminatorRules = state.md.block.ruler.getRules('blockquote');

  const oldParentType = state.parentType;
  state.parentType = 'blockquote';
  let lastLineEmpty = false;
  let nextLine;

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag:
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    // check if it's outdented, i.e. it's inside list item and indented
    // less than said list item:
    //
    // ```
    // 1. anything
    //    > current blockquote
    // 2. checking this line
    // ```
    const isOutdented = state.sCount[nextLine] < state.blkIndent;

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */ && !isOutdented) {
      // This line is inside the blockquote.

      // set offset past spaces and ">"
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20 /* space */) {
        // ' >   test '
        //     ^ -- position start of line here:
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 0x09 /* tab */) {
        spaceAfterMarker = true;

        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          // '  >\t  test '
          //       ^ -- position start of line here (tab has width===1)
          pos++;
          initial++;
          adjustTab = false;
        } else {
          // ' >\t  test '
          //    ^ -- position start of line here + shift bsCount slightly
          //         to make extra space appear
          adjustTab = true;
        }
      } else {
        spaceAfterMarker = false;
      }

      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      while (pos < max) {
        const ch = state.src.charCodeAt(pos);

        if (isSpace(ch)) {
          if (ch === 0x09) {
            offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
          } else {
            offset++;
          }
        } else {
          break
        }

        pos++;
      }

      lastLineEmpty = pos >= max;

      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);

      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) { break }

    // Case 3: another tag found.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }

    if (terminate) {
      // Quirk to enforce "hard termination mode" for paragraphs;
      // normally if you call `tokenize(state, startLine, nextLine)`,
      // paragraphs will look below nextLine for paragraph continuation,
      // but if blockquote is terminated by another tag, they shouldn't
      state.lineMax = nextLine;

      if (state.blkIndent !== 0) {
        // state.blkIndent was non-zero, we now set it to zero,
        // so we need to re-calculate all offsets to appear as
        // if indent wasn't changed
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }

      break
    }

    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);

    // A negative indentation means that this is a paragraph continuation
    //
    state.sCount[nextLine] = -1;
  }

  const oldIndent = state.blkIndent;
  state.blkIndent = 0;

  const token_o  = state.push('blockquote_open', 'blockquote', 1);
  token_o.markup = '>';
  const lines = [startLine, 0];
  token_o.map    = lines;

  state.md.block.tokenize(state, startLine, nextLine);

  const token_c  = state.push('blockquote_close', 'blockquote', -1);
  token_c.markup = '>';

  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;

  return true
}

// Horizontal rule


function hr (state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false
  }

  // markers can be mixed with spaces, but there should be at least 3 of them

  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) { return false }
    if (ch === marker) { cnt++; }
  }

  if (cnt < 3) { return false }

  if (silent) { return true }

  state.line = startLine + 1;

  const token  = state.push('hr', 'hr', 0);
  token.map    = [startLine, state.line];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));

  return true
}

// Lists


// Search `[-+*][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipBulletListMarker (state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];

  const marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1
  }

  if (pos < max) {
    const ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " -test " - is not a list item
      return -1
    }
  }

  return pos
}

// Search `\d+[.)][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipOrderedListMarker (state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;

  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) { return -1 }

  let ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1 }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1 }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {
      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) { return -1 }

      continue
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break
    }

    return -1
  }

  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " 1.test " - is not a list item
      return -1
    }
  }
  return pos
}

function markTightParagraphs (state, idx) {
  const level = state.level + 2;

  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}

function list (state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[nextLine] - state.blkIndent >= 4) { return false }

  // Special case:
  //  - item 1
  //   - item 2
  //    - item 3
  //     - item 4
  //      - this one is a paragraph continuation
  if (state.listIndent >= 0 &&
      state.sCount[nextLine] - state.listIndent >= 4 &&
      state.sCount[nextLine] < state.blkIndent) {
    return false
  }

  let isTerminatingParagraph = false;

  // limit conditions when list can interrupt
  // a paragraph (validation mode only)
  if (silent && state.parentType === 'paragraph') {
    // Next list item should still terminate previous list item;
    //
    // This code can fail if plugins use blkIndent as well as lists,
    // but I hope the spec gets fixed long before that happens.
    //
    if (state.sCount[nextLine] >= state.blkIndent) {
      isTerminatingParagraph = true;
    }
  }

  // Detect list type and position after marker
  let isOrdered;
  let markerValue;
  let posAfterMarker;
  if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));

    // If we're starting a new ordered list right after
    // a paragraph, it should start with 1.
    if (isTerminatingParagraph && markerValue !== 1) return false
  } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) {
    isOrdered = false;
  } else {
    return false
  }

  // If we're starting a new unordered list right after
  // a paragraph, first line should not be empty.
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false
  }

  // For validation mode we can terminate immediately
  if (silent) { return true }

  // We should terminate list on style change. Remember first one to compare.
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // Start list
  const listTokIdx = state.tokens.length;

  if (isOrdered) {
    token       = state.push('ordered_list_open', 'ol', 1);
    if (markerValue !== 1) {
      token.attrs = [['start', markerValue]];
    }
  } else {
    token       = state.push('bullet_list_open', 'ul', 1);
  }

  const listLines = [nextLine, 0];
  token.map    = listLines;
  token.markup = String.fromCharCode(markerCharCode);

  //
  // Iterate list items
  //

  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules('list');

  const oldParentType = state.parentType;
  state.parentType = 'list';

  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];

    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;

    while (pos < max) {
      const ch = state.src.charCodeAt(pos);

      if (ch === 0x09) {
        offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      } else if (ch === 0x20) {
        offset++;
      } else {
        break
      }

      pos++;
    }

    const contentStart = pos;
    let indentAfterMarker;

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = offset - initial;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    const indent = initial + indentAfterMarker;

    // Run subparser & write tokens
    token        = state.push('list_item_open', 'li', 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map    = itemLines;
    if (isOrdered) {
      token.info = state.src.slice(start, posAfterMarker - 1);
    }

    // change current state, then restore it after parser subcall
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];

    //  - example list
    // ^ listIndent position will be here
    //   ^ blkIndent position will be here
    //
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;

    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;

    if (contentStart >= max && state.isEmpty(nextLine + 1)) {
      // workaround for this case
      // (list item is empty, list terminates before "foo"):
      // ~~~~~~~~
      //   -
      //
      //     foo
      // ~~~~~~~~
      state.line = Math.min(state.line + 2, endLine);
    } else {
      state.md.block.tokenize(state, nextLine, endLine, true);
    }

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - nextLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;

    token        = state.push('list_item_close', 'li', -1);
    token.markup = String.fromCharCode(markerCharCode);

    nextLine = state.line;
    itemLines[1] = nextLine;

    if (nextLine >= endLine) { break }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.sCount[nextLine] < state.blkIndent) { break }

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[nextLine] - state.blkIndent >= 4) { break }

    // fail if terminating block found
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break }
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break }
  }

  // Finalize list
  if (isOrdered) {
    token = state.push('ordered_list_close', 'ol', -1);
  } else {
    token = state.push('bullet_list_close', 'ul', -1);
  }
  token.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  state.parentType = oldParentType;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true
}

function reference (state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (state.src.charCodeAt(pos) !== 0x5B/* [ */) { return false }

  function getNextLine (nextLine) {
    const endLine = state.lineMax;

    if (nextLine >= endLine || state.isEmpty(nextLine)) {
      // empty line or end of input
      return null
    }

    let isContinuation = false;

    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { isContinuation = true; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { isContinuation = true; }

    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules('reference');
      const oldParentType = state.parentType;
      state.parentType = 'reference';

      // Some tags can terminate paragraph without empty line.
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break
        }
      }

      state.parentType = oldParentType;
      if (terminate) {
        // terminated by another block
        return null
      }
    }

    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];

    // max + 1 explicitly includes the newline
    return state.src.slice(pos, max + 1)
  }

  let str = state.src.slice(pos, max + 1);

  max = str.length;
  let labelEnd = -1;

  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x5B /* [ */) {
      return false
    } else if (ch === 0x5D /* ] */) {
      labelEnd = pos;
      break
    } else if (ch === 0x0A /* \n */) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 0x5C /* \ */) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 0x0A) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return false }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ; else {
      break
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok) { return false }

  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) { return false }

  pos = destRes.pos;

  // save cursor state, we could require to rollback later
  const destEndPos = pos;
  const destEndLineNo = nextLine;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ; else {
      break
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null) break
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;

  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = '';
    pos = destEndPos;
    nextLine = destEndLineNo;
  }

  // skip trailing spaces until the rest of the line
  while (pos < max) {
    const ch = str.charCodeAt(pos);
    if (!isSpace(ch)) { break }
    pos++;
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = '';
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        const ch = str.charCodeAt(pos);
        if (!isSpace(ch)) { break }
        pos++;
      }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    // garbage at the end of the line
    return false
  }

  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false
  }

  // Reference can not terminate anything. This check is for safety only.
  /* istanbul ignore if */
  if (silent) { return true }

  if (typeof state.env.references === 'undefined') {
    state.env.references = {};
  }
  if (typeof state.env.references[label] === 'undefined') {
    state.env.references[label] = { title, href };
  }

  state.line = nextLine;
  return true
}

// List of valid html blocks names, according to commonmark spec
// https://spec.commonmark.org/0.30/#html-blocks

var block_names = [
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul'
];

// Regexps to match html elements

const attr_name     = '[a-zA-Z_:][a-zA-Z0-9:._-]*';

const unquoted      = '[^"\'=<>`\\x00-\\x20]+';
const single_quoted = "'[^']*'";
const double_quoted = '"[^"]*"';

const attr_value  = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')';

const attribute   = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)';

const open_tag    = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>';

const close_tag   = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>';
const comment     = '<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->';
const processing  = '<[?][\\s\\S]*?[?]>';
const declaration = '<![A-Za-z][^>]*>';
const cdata       = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>';

const HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment +
                        '|' + processing + '|' + declaration + '|' + cdata + ')');
const HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');

// HTML block


// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
//
const HTML_SEQUENCES = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/,        /-->/,   true],
  [/^<\?/,         /\?>/,   true],
  [/^<![A-Z]/,     />/,     true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true],
  [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false]
];

function html_block (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (!state.md.options.html) { return false }

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  let lineText = state.src.slice(pos, max);

  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) { break }
  }
  if (i === HTML_SEQUENCES.length) { return false }

  if (silent) {
    // true if this sequence can be a terminator, false otherwise
    return HTML_SEQUENCES[i][2]
  }

  let nextLine = startLine + 1;

  // If we are here - we detected HTML block.
  // Let's roll down till block end.
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) { break }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);

      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) { nextLine++; }
        break
      }
    }
  }

  state.line = nextLine;

  const token   = state.push('html_block', '', 0);
  token.map     = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);

  return true
}

// heading (#, ##, ...)


function heading (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let ch  = state.src.charCodeAt(pos);

  if (ch !== 0x23/* # */ || pos >= max) { return false }

  // count heading level
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && !isSpace(ch))) { return false }

  if (silent) { return true }

  // Let's cut tails like '    ###  ' from the end of string

  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
    max = tmp;
  }

  state.line = startLine + 1;

  const token_o  = state.push('heading_open', 'h' + String(level), 1);
  token_o.markup = '########'.slice(0, level);
  token_o.map    = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = state.src.slice(pos, max).trim();
  token_i.map      = [startLine, state.line];
  token_i.children = [];

  const token_c  = state.push('heading_close', 'h' + String(level), -1);
  token_c.markup = '########'.slice(0, level);

  return true
}

// lheading (---, ===)

function lheading (state, startLine, endLine/*, silent */) {
  const terminatorRules = state.md.block.ruler.getRules('paragraph');

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  const oldParentType = state.parentType;
  state.parentType = 'paragraph'; // use paragraph to match terminatorRules

  // jump line-by-line until empty one or EOF
  let level = 0;
  let marker;
  let nextLine = startLine + 1;

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    //
    // Check for underline in setext header
    //
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];

      if (pos < max) {
        marker = state.src.charCodeAt(pos);

        if (marker === 0x2D/* - */ || marker === 0x3D/* = */) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);

          if (pos >= max) {
            level = (marker === 0x3D/* = */ ? 1 : 2);
            break
          }
        }
      }
    }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { continue }

    // Some tags can terminate paragraph without empty line.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }
  }

  if (!level) {
    // Didn't find valid underline
    return false
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine + 1;

  const token_o    = state.push('heading_open', 'h' + String(level), 1);
  token_o.markup   = String.fromCharCode(marker);
  token_o.map      = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = content;
  token_i.map      = [startLine, state.line - 1];
  token_i.children = [];

  const token_c    = state.push('heading_close', 'h' + String(level), -1);
  token_c.markup   = String.fromCharCode(marker);

  state.parentType = oldParentType;

  return true
}

// Paragraph

function paragraph (state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules('paragraph');
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = 'paragraph';

  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { continue }

    // Some tags can terminate paragraph without empty line.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine;

  const token_o    = state.push('paragraph_open', 'p', 1);
  token_o.map      = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = content;
  token_i.map      = [startLine, state.line];
  token_i.children = [];

  state.push('paragraph_close', 'p', -1);

  state.parentType = oldParentType;

  return true
}

/** internal
 * class ParserBlock
 *
 * Block-level tokenizer.
 **/


const _rules$1 = [
  // First 2 params - rule name & source. Secondary array - list of rules,
  // which can be terminated by this one.
  ['table',      table,      ['paragraph', 'reference']],
  ['code',       code],
  ['fence',      fence,      ['paragraph', 'reference', 'blockquote', 'list']],
  ['blockquote', blockquote, ['paragraph', 'reference', 'blockquote', 'list']],
  ['hr',         hr,         ['paragraph', 'reference', 'blockquote', 'list']],
  ['list',       list,       ['paragraph', 'reference', 'blockquote']],
  ['reference',  reference],
  ['html_block', html_block, ['paragraph', 'reference', 'blockquote']],
  ['heading',    heading,    ['paragraph', 'reference', 'blockquote']],
  ['lheading',   lheading],
  ['paragraph',  paragraph]
];

/**
 * new ParserBlock()
 **/
function ParserBlock () {
  /**
   * ParserBlock#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of block rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules$1.length; i++) {
    this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
  }
}

// Generate tokens for input range
//
ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const maxNesting = state.md.options.maxNesting;
  let line = startLine;
  let hasEmptyLines = false;

  while (line < endLine) {
    state.line = line = state.skipEmptyLines(line);
    if (line >= endLine) { break }

    // Termination condition for nested calls.
    // Nested calls currently used for blockquotes & lists
    if (state.sCount[line] < state.blkIndent) { break }

    // If nesting level exceeded - skip tail to the end. That's not ordinary
    // situation and we should not care about content.
    if (state.level >= maxNesting) {
      state.line = endLine;
      break
    }

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.line`
    // - update `state.tokens`
    // - return true
    const prevLine = state.line;
    let ok = false;

    for (let i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false);
      if (ok) {
        if (prevLine >= state.line) {
          throw new Error("block rule didn't increment state.line")
        }
        break
      }
    }

    // this can only happen if user disables paragraph rule
    if (!ok) throw new Error('none of the block rules matched')

    // set state.tight if we had an empty line before current tag
    // i.e. latest empty line should not count
    state.tight = !hasEmptyLines;

    // paragraph might "eat" one newline after it in nested lists
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true;
    }

    line = state.line;

    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true;
      line++;
      state.line = line;
    }
  }
};

/**
 * ParserBlock.parse(str, md, env, outTokens)
 *
 * Process input string and push block tokens into `outTokens`
 **/
ParserBlock.prototype.parse = function (src, md, env, outTokens) {
  if (!src) { return }

  const state = new this.State(src, md, env, outTokens);

  this.tokenize(state, state.line, state.lineMax);
};

ParserBlock.prototype.State = StateBlock;

// Inline parser state


function StateInline (src, md, env, outTokens) {
  this.src = src;
  this.env = env;
  this.md = md;
  this.tokens = outTokens;
  this.tokens_meta = Array(outTokens.length);

  this.pos = 0;
  this.posMax = this.src.length;
  this.level = 0;
  this.pending = '';
  this.pendingLevel = 0;

  // Stores { start: end } pairs. Useful for backtrack
  // optimization of pairs parse (emphasis, strikes).
  this.cache = {};

  // List of emphasis-like delimiters for current tag
  this.delimiters = [];

  // Stack of delimiter lists for upper level tags
  this._prev_delimiters = [];

  // backtick length => last seen position
  this.backticks = {};
  this.backticksScanned = false;

  // Counter used to disable inline linkify-it execution
  // inside <a> and markdown links
  this.linkLevel = 0;
}

// Flush pending text
//
StateInline.prototype.pushPending = function () {
  const token = new Token('text', '', 0);
  token.content = this.pending;
  token.level = this.pendingLevel;
  this.tokens.push(token);
  this.pending = '';
  return token
};

// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (type, tag, nesting) {
  if (this.pending) {
    this.pushPending();
  }

  const token = new Token(type, tag, nesting);
  let token_meta = null;

  if (nesting < 0) {
    // closing tag
    this.level--;
    this.delimiters = this._prev_delimiters.pop();
  }

  token.level = this.level;

  if (nesting > 0) {
    // opening tag
    this.level++;
    this._prev_delimiters.push(this.delimiters);
    this.delimiters = [];
    token_meta = { delimiters: this.delimiters };
  }

  this.pendingLevel = this.level;
  this.tokens.push(token);
  this.tokens_meta.push(token_meta);
  return token
};

// Scan a sequence of emphasis-like markers, and determine whether
// it can start an emphasis sequence or end an emphasis sequence.
//
//  - start - position to scan from (it should point at a valid marker);
//  - canSplitWord - determine if these markers can be found inside a word
//
StateInline.prototype.scanDelims = function (start, canSplitWord) {
  const max = this.posMax;
  const marker = this.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20;

  let pos = start;
  while (pos < max && this.src.charCodeAt(pos) === marker) { pos++; }

  const count = pos - start;

  // treat end of the line as a whitespace
  const nextChar = pos < max ? this.src.charCodeAt(pos) : 0x20;

  const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  const isLastWhiteSpace = isWhiteSpace(lastChar);
  const isNextWhiteSpace = isWhiteSpace(nextChar);

  const left_flanking =
    !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
  const right_flanking =
    !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);

  const can_open  = left_flanking  && (canSplitWord || !right_flanking || isLastPunctChar);
  const can_close = right_flanking && (canSplitWord || !left_flanking  || isNextPunctChar);

  return { can_open, can_close, length: count }
};

// re-export Token class to use in block rules
StateInline.prototype.Token = Token;

// Skip text characters for text token, place those to pending buffer
// and increment current pos

// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~

// !!!! Don't confuse with "Markdown ASCII Punctuation" chars
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
function isTerminatorChar (ch) {
  switch (ch) {
    case 0x0A/* \n */:
    case 0x21/* ! */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2D/* - */:
    case 0x3A/* : */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true
    default:
      return false
  }
}

function text (state, silent) {
  let pos = state.pos;

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++;
  }

  if (pos === state.pos) { return false }

  if (!silent) { state.pending += state.src.slice(state.pos, pos); }

  state.pos = pos;

  return true
}

// Alternative implementation, for memory.
//
// It costs 10% of performance, but allows extend terminators list, if place it
// to `ParserInline` property. Probably, will switch to it sometime, such
// flexibility required.

/*
var TERMINATOR_RE = /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

module.exports = function text(state, silent) {
  var pos = state.pos,
      idx = state.src.slice(pos).search(TERMINATOR_RE);

  // first char is terminator -> empty text
  if (idx === 0) { return false; }

  // no terminator -> text till end of string
  if (idx < 0) {
    if (!silent) { state.pending += state.src.slice(pos); }
    state.pos = state.src.length;
    return true;
  }

  if (!silent) { state.pending += state.src.slice(pos, pos + idx); }

  state.pos += idx;

  return true;
}; */

// Process links like https://example.org/

// RFC3986: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
const SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;

function linkify (state, silent) {
  if (!state.md.options.linkify) return false
  if (state.linkLevel > 0) return false

  const pos = state.pos;
  const max = state.posMax;

  if (pos + 3 > max) return false
  if (state.src.charCodeAt(pos) !== 0x3A/* : */) return false
  if (state.src.charCodeAt(pos + 1) !== 0x2F/* / */) return false
  if (state.src.charCodeAt(pos + 2) !== 0x2F/* / */) return false

  const match = state.pending.match(SCHEME_RE);
  if (!match) return false

  const proto = match[1];

  const link = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
  if (!link) return false

  let url = link.url;

  // invalid link, but still detected by linkify somehow;
  // need to check to prevent infinite loop below
  if (url.length <= proto.length) return false

  // disallow '*' at the end of the link (conflicts with emphasis)
  // do manual backsearch to avoid perf issues with regex /\*+$/ on "****...****a".
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 0x2A/* * */) {
    urlEnd--;
  }
  if (urlEnd !== url.length) {
    url = url.slice(0, urlEnd);
  }

  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false

  if (!silent) {
    state.pending = state.pending.slice(0, -proto.length);

    const token_o = state.push('link_open', 'a', 1);
    token_o.attrs = [['href', fullUrl]];
    token_o.markup = 'linkify';
    token_o.info = 'auto';

    const token_t = state.push('text', '', 0);
    token_t.content = state.md.normalizeLinkText(url);

    const token_c = state.push('link_close', 'a', -1);
    token_c.markup = 'linkify';
    token_c.info = 'auto';
  }

  state.pos += url.length - proto.length;
  return true
}

// Proceess '\n'


function newline (state, silent) {
  let pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false }

  const pmax = state.pending.length - 1;
  const max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        // Find whitespaces tail of pending chars.
        let ws = pmax - 1;
        while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 0x20) ws--;

        state.pending = state.pending.slice(0, ws);
        state.push('hardbreak', 'br', 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push('softbreak', 'br', 0);
      }
    } else {
      state.push('softbreak', 'br', 0);
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && isSpace(state.src.charCodeAt(pos))) { pos++; }

  state.pos = pos;
  return true
}

// Process escaped chars and hardbreaks


const ESCAPED = [];

for (let i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function (ch) { ESCAPED[ch.charCodeAt(0)] = 1; });

function escape (state, silent) {
  let pos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) return false
  pos++;

  // '\' at the end of the inline block
  if (pos >= max) return false

  let ch1 = state.src.charCodeAt(pos);

  if (ch1 === 0x0A) {
    if (!silent) {
      state.push('hardbreak', 'br', 0);
    }

    pos++;
    // skip leading whitespaces from next line
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break
      pos++;
    }

    state.pos = pos;
    return true
  }

  let escapedStr = state.src[pos];

  if (ch1 >= 0xD800 && ch1 <= 0xDBFF && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);

    if (ch2 >= 0xDC00 && ch2 <= 0xDFFF) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }

  const origStr = '\\' + escapedStr;

  if (!silent) {
    const token = state.push('text_special', '', 0);

    if (ch1 < 256 && ESCAPED[ch1] !== 0) {
      token.content = escapedStr;
    } else {
      token.content = origStr;
    }

    token.markup = origStr;
    token.info   = 'escape';
  }

  state.pos = pos + 1;
  return true
}

// Parse backticks

function backtick (state, silent) {
  let pos = state.pos;
  const ch = state.src.charCodeAt(pos);

  if (ch !== 0x60/* ` */) { return false }

  const start = pos;
  pos++;
  const max = state.posMax;

  // scan marker length
  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;

  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker;
    state.pos += openerLength;
    return true
  }

  let matchEnd = pos;
  let matchStart;

  // Nothing found in the cache, scan until the end of the line (or until marker is found)
  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    // scan marker length
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

    const closerLength = matchEnd - matchStart;

    if (closerLength === openerLength) {
      // Found matching closer length.
      if (!silent) {
        const token = state.push('code_inline', 'code', 0);
        token.markup = marker;
        token.content = state.src.slice(pos, matchStart)
          .replace(/\n/g, ' ')
          .replace(/^ (.+) $/, '$1');
      }
      state.pos = matchEnd;
      return true
    }

    // Some different length found, put it in cache as upper limit of where closer can be found
    state.backticks[closerLength] = matchStart;
  }

  // Scanned through the end, didn't find anything
  state.backticksScanned = true;

  if (!silent) state.pending += marker;
  state.pos += openerLength;
  return true
}

// ~~strike through~~
//

// Insert each marker as a separate text token, and add it to delimiter list
//
function strikethrough_tokenize (state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);

  if (silent) { return false }

  if (marker !== 0x7E/* ~ */) { return false }

  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);

  if (len < 2) { return false }

  let token;

  if (len % 2) {
    token         = state.push('text', '', 0);
    token.content = ch;
    len--;
  }

  for (let i = 0; i < len; i += 2) {
    token         = state.push('text', '', 0);
    token.content = ch + ch;

    state.delimiters.push({
      marker,
      length: 0,     // disable "rule of 3" length checks meant for emphasis
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }

  state.pos += scanned.length;

  return true
}

function postProcess$1 (state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;

  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];

    if (startDelim.marker !== 0x7E/* ~ */) {
      continue
    }

    if (startDelim.end === -1) {
      continue
    }

    const endDelim = delimiters[startDelim.end];

    token         = state.tokens[startDelim.token];
    token.type    = 's_open';
    token.tag     = 's';
    token.nesting = 1;
    token.markup  = '~~';
    token.content = '';

    token         = state.tokens[endDelim.token];
    token.type    = 's_close';
    token.tag     = 's';
    token.nesting = -1;
    token.markup  = '~~';
    token.content = '';

    if (state.tokens[endDelim.token - 1].type === 'text' &&
        state.tokens[endDelim.token - 1].content === '~') {
      loneMarkers.push(endDelim.token - 1);
    }
  }

  // If a marker sequence has an odd number of characters, it's splitted
  // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
  // start of the sequence.
  //
  // So, we have to move all those markers after subsequent s_close tags.
  //
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;

    while (j < state.tokens.length && state.tokens[j].type === 's_close') {
      j++;
    }

    j--;

    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
//
function strikethrough_postProcess (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  postProcess$1(state, state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      postProcess$1(state, tokens_meta[curr].delimiters);
    }
  }
}

var r_strikethrough = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};

// Process *this* and _that_
//

// Insert each marker as a separate text token, and add it to delimiter list
//
function emphasis_tokenize (state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);

  if (silent) { return false }

  if (marker !== 0x5F /* _ */ && marker !== 0x2A /* * */) { return false }

  const scanned = state.scanDelims(state.pos, marker === 0x2A);

  for (let i = 0; i < scanned.length; i++) {
    const token = state.push('text', '', 0);
    token.content = String.fromCharCode(marker);

    state.delimiters.push({
      // Char code of the starting marker (number).
      //
      marker,

      // Total length of these series of delimiters.
      //
      length: scanned.length,

      // A position of the token this delimiter corresponds to.
      //
      token: state.tokens.length - 1,

      // If this delimiter is matched as a valid opener, `end` will be
      // equal to its position, otherwise it's `-1`.
      //
      end: -1,

      // Boolean flags that determine if this delimiter could open or close
      // an emphasis.
      //
      open: scanned.can_open,
      close: scanned.can_close
    });
  }

  state.pos += scanned.length;

  return true
}

function postProcess (state, delimiters) {
  const max = delimiters.length;

  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];

    if (startDelim.marker !== 0x5F/* _ */ && startDelim.marker !== 0x2A/* * */) {
      continue
    }

    // Process only opening markers
    if (startDelim.end === -1) {
      continue
    }

    const endDelim = delimiters[startDelim.end];

    // If the previous delimiter has the same marker and is adjacent to this one,
    // merge those into one strong delimiter.
    //
    // `<em><em>whatever</em></em>` -> `<strong>whatever</strong>`
    //
    const isStrong = i > 0 &&
               delimiters[i - 1].end === startDelim.end + 1 &&
               // check that first two markers match and adjacent
               delimiters[i - 1].marker === startDelim.marker &&
               delimiters[i - 1].token === startDelim.token - 1 &&
               // check that last two markers are adjacent (we can safely assume they match)
               delimiters[startDelim.end + 1].token === endDelim.token + 1;

    const ch = String.fromCharCode(startDelim.marker);

    const token_o   = state.tokens[startDelim.token];
    token_o.type    = isStrong ? 'strong_open' : 'em_open';
    token_o.tag     = isStrong ? 'strong' : 'em';
    token_o.nesting = 1;
    token_o.markup  = isStrong ? ch + ch : ch;
    token_o.content = '';

    const token_c   = state.tokens[endDelim.token];
    token_c.type    = isStrong ? 'strong_close' : 'em_close';
    token_c.tag     = isStrong ? 'strong' : 'em';
    token_c.nesting = -1;
    token_c.markup  = isStrong ? ch + ch : ch;
    token_c.content = '';

    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = '';
      state.tokens[delimiters[startDelim.end + 1].token].content = '';
      i--;
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
//
function emphasis_post_process (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  postProcess(state, state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      postProcess(state, tokens_meta[curr].delimiters);
    }
  }
}

var r_emphasis = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};

// Process [link](<to> "stuff")


function link (state, silent) {
  let code, label, res, ref;
  let href = '';
  let title = '';
  let start = state.pos;
  let parseReference = true;

  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false }

  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false }

  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // might have found a valid shortcut link, disable reference parsing
    parseReference = false;

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }
    if (pos >= max) { return false }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }

      // [link](  <href>  "title"  )
      //                ^^ skipping these spaces
      start = pos;
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break }
      }

      // [link](  <href>  "title"  )
      //                  ^^^^^^^ parsing link title
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;

        // [link](  <href>  "title"  )
        //                         ^^ skipping these spaces
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (!isSpace(code) && code !== 0x0A) { break }
        }
      }
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      // parsing a valid shortcut link failed, fallback to reference
      parseReference = true;
    }
    pos++;
  }

  if (parseReference) {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    const token_o = state.push('link_open', 'a', 1);
    const attrs = [['href', href]];
    token_o.attrs  = attrs;
    if (title) {
      attrs.push(['title', title]);
    }

    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;

    state.push('link_close', 'a', -1);
  }

  state.pos = pos;
  state.posMax = max;
  return true
}

// Process ![image](<src> "title")


function image (state, silent) {
  let code, content, label, pos, ref, res, title, start;
  let href = '';
  const oldPos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(state.pos) !== 0x21/* ! */) { return false }
  if (state.src.charCodeAt(state.pos + 1) !== 0x5B/* [ */) { return false }

  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }
    if (pos >= max) { return false }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);

    const tokens = [];
    state.md.inline.parse(
      content,
      state.md,
      state.env,
      tokens
    );

    const token = state.push('image', 'img', 0);
    const attrs = [['src', href], ['alt', '']];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;

    if (title) {
      attrs.push(['title', title]);
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true
}

// Process autolinks '<protocol:...>'

/* eslint max-len:0 */
const EMAIL_RE    = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
/* eslint-disable-next-line no-control-regex */
const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;

function autolink (state, silent) {
  let pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  const start = state.pos;
  const max = state.posMax;

  for (;;) {
    if (++pos >= max) return false

    const ch = state.src.charCodeAt(pos);

    if (ch === 0x3C /* < */) return false
    if (ch === 0x3E /* > */) break
  }

  const url = state.src.slice(start + 1, pos);

  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      const token_o   = state.push('link_open', 'a', 1);
      token_o.attrs   = [['href', fullUrl]];
      token_o.markup  = 'autolink';
      token_o.info    = 'auto';

      const token_t   = state.push('text', '', 0);
      token_t.content = state.md.normalizeLinkText(url);

      const token_c   = state.push('link_close', 'a', -1);
      token_c.markup  = 'autolink';
      token_c.info    = 'auto';
    }

    state.pos += url.length + 2;
    return true
  }

  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink('mailto:' + url);
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      const token_o   = state.push('link_open', 'a', 1);
      token_o.attrs   = [['href', fullUrl]];
      token_o.markup  = 'autolink';
      token_o.info    = 'auto';

      const token_t   = state.push('text', '', 0);
      token_t.content = state.md.normalizeLinkText(url);

      const token_c   = state.push('link_close', 'a', -1);
      token_c.markup  = 'autolink';
      token_c.info    = 'auto';
    }

    state.pos += url.length + 2;
    return true
  }

  return false
}

// Process html tags


function isLinkOpen (str) {
  return /^<a[>\s]/i.test(str)
}
function isLinkClose (str) {
  return /^<\/a\s*>/i.test(str)
}

function isLetter (ch) {
  /* eslint no-bitwise:0 */
  const lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */)
}

function html_inline (state, silent) {
  if (!state.md.options.html) { return false }

  // Check start
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false
  }

  // Quick fail on second char
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter(ch)) {
    return false
  }

  const match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) { return false }

  if (!silent) {
    const token = state.push('html_inline', '', 0);
    token.content = match[0];

    if (isLinkOpen(token.content))  state.linkLevel++;
    if (isLinkClose(token.content)) state.linkLevel--;
  }
  state.pos += match[0].length;
  return true
}

// Process html entity - &#123;, &#xAF;, &quot;, ...


const DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
const NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;

function entity (state, silent) {
  const pos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x26/* & */) return false

  if (pos + 1 >= max) return false

  const ch = state.src.charCodeAt(pos + 1);

  if (ch === 0x23 /* # */) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);

        const token   = state.push('text_special', '', 0);
        token.content = isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
        token.markup  = match[0];
        token.info    = 'entity';
      }
      state.pos += match[0].length;
      return true
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTML(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token   = state.push('text_special', '', 0);
          token.content = decoded;
          token.markup  = match[0];
          token.info    = 'entity';
        }
        state.pos += match[0].length;
        return true
      }
    }
  }

  return false
}

// For each opening emphasis-like marker find a matching closing one
//

function processDelimiters (delimiters) {
  const openersBottom = {};
  const max = delimiters.length;

  if (!max) return

  // headerIdx is the first delimiter of the current (where closer is) delimiter run
  let headerIdx = 0;
  let lastTokenIdx = -2; // needs any value lower than -1
  const jumps = [];

  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];

    jumps.push(0);

    // markers belong to same delimiter run if:
    //  - they have adjacent tokens
    //  - AND markers are the same
    //
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) {
      headerIdx = closerIdx;
    }

    lastTokenIdx = closer.token;

    // Length is only used for emphasis-specific "rule of 3",
    // if it's not defined (in strikethrough or 3rd party plugins),
    // we can default it to 0 to disable those checks.
    //
    closer.length = closer.length || 0;

    if (!closer.close) continue

    // Previously calculated lower bounds (previous fails)
    // for each marker, each delimiter length modulo 3,
    // and for whether this closer can be an opener;
    // https://github.com/commonmark/cmark/commit/34250e12ccebdc6372b8b49c44fab57c72443460
    /* eslint-disable-next-line no-prototype-builtins */
    if (!openersBottom.hasOwnProperty(closer.marker)) {
      openersBottom[closer.marker] = [-1, -1, -1, -1, -1, -1];
    }

    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length % 3)];

    let openerIdx = headerIdx - jumps[headerIdx] - 1;

    let newMinOpenerIdx = openerIdx;

    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];

      if (opener.marker !== closer.marker) continue

      if (opener.open && opener.end < 0) {
        let isOddMatch = false;

        // from spec:
        //
        // If one of the delimiters can both open and close emphasis, then the
        // sum of the lengths of the delimiter runs containing the opening and
        // closing delimiters must not be a multiple of 3 unless both lengths
        // are multiples of 3.
        //
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
              isOddMatch = true;
            }
          }
        }

        if (!isOddMatch) {
          // If previous delimiter cannot be an opener, we can safely skip
          // the entire sequence in future checks. This is required to make
          // sure algorithm has linear complexity (see *_*_*_*_*_... case).
          //
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open
            ? jumps[openerIdx - 1] + 1
            : 0;

          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;

          closer.open  = false;
          opener.end   = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          // treat next token as start of run,
          // it optimizes skips in **<...>**a**<...>** pathological case
          lastTokenIdx = -2;
          break
        }
      }
    }

    if (newMinOpenerIdx !== -1) {
      // If match for this delimiter run failed, we want to set lower bound for
      // future lookups. This is required to make sure algorithm has linear
      // complexity.
      //
      // See details here:
      // https://github.com/commonmark/cmark/issues/178#issuecomment-270417442
      //
      openersBottom[closer.marker][(closer.open ? 3 : 0) + ((closer.length || 0) % 3)] = newMinOpenerIdx;
    }
  }
}

function link_pairs (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  processDelimiters(state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      processDelimiters(tokens_meta[curr].delimiters);
    }
  }
}

// Clean up tokens after emphasis and strikethrough postprocessing:
// merge adjacent text nodes into one and re-calculate all token levels
//
// This is necessary because initially emphasis delimiter markers (*, _, ~)
// are treated as their own separate text tokens. Then emphasis rule either
// leaves them as text (needed to merge with adjacent text) or turns them
// into opening/closing tags (which messes up levels inside).
//

function fragments_join (state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;

  for (curr = last = 0; curr < max; curr++) {
    // re-calculate levels after emphasis/strikethrough turns some text nodes
    // into opening/closing tags
    if (tokens[curr].nesting < 0) level--; // closing tag
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++; // opening tag

    if (tokens[curr].type === 'text' &&
        curr + 1 < max &&
        tokens[curr + 1].type === 'text') {
      // collapse two adjacent text nodes
      tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    } else {
      if (curr !== last) { tokens[last] = tokens[curr]; }

      last++;
    }
  }

  if (curr !== last) {
    tokens.length = last;
  }
}

/** internal
 * class ParserInline
 *
 * Tokenizes paragraph content.
 **/


// Parser rules

const _rules = [
  ['text',            text],
  ['linkify',         linkify],
  ['newline',         newline],
  ['escape',          escape],
  ['backticks',       backtick],
  ['strikethrough',   r_strikethrough.tokenize],
  ['emphasis',        r_emphasis.tokenize],
  ['link',            link],
  ['image',           image],
  ['autolink',        autolink],
  ['html_inline',     html_inline],
  ['entity',          entity]
];

// `rule2` ruleset was created specifically for emphasis/strikethrough
// post-processing and may be changed in the future.
//
// Don't use this for anything except pairs (plugins working with `balance_pairs`).
//
const _rules2 = [
  ['balance_pairs',   link_pairs],
  ['strikethrough',   r_strikethrough.postProcess],
  ['emphasis',        r_emphasis.postProcess],
  // rules for pairs separate '**' into its own text tokens, which may be left unused,
  // rule below merges unused segments back with the rest of the text
  ['fragments_join',  fragments_join]
];

/**
 * new ParserInline()
 **/
function ParserInline () {
  /**
   * ParserInline#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of inline rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }

  /**
   * ParserInline#ruler2 -> Ruler
   *
   * [[Ruler]] instance. Second ruler used for post-processing
   * (e.g. in emphasis-like rules).
   **/
  this.ruler2 = new Ruler();

  for (let i = 0; i < _rules2.length; i++) {
    this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
}

// Skip single token by running all rules in validation mode;
// returns `true` if any rule reported success
//
ParserInline.prototype.skipToken = function (state) {
  const pos = state.pos;
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const maxNesting = state.md.options.maxNesting;
  const cache = state.cache;

  if (typeof cache[pos] !== 'undefined') {
    state.pos = cache[pos];
    return
  }

  let ok = false;

  if (state.level < maxNesting) {
    for (let i = 0; i < len; i++) {
      // Increment state.level and decrement it later to limit recursion.
      // It's harmless to do here, because no tokens are created. But ideally,
      // we'd need a separate private state variable for this purpose.
      //
      state.level++;
      ok = rules[i](state, true);
      state.level--;

      if (ok) {
        if (pos >= state.pos) { throw new Error("inline rule didn't increment state.pos") }
        break
      }
    }
  } else {
    // Too much nesting, just skip until the end of the paragraph.
    //
    // NOTE: this will cause links to behave incorrectly in the following case,
    //       when an amount of `[` is exactly equal to `maxNesting + 1`:
    //
    //       [[[[[[[[[[[[[[[[[[[[[foo]()
    //
    // TODO: remove this workaround when CM standard will allow nested links
    //       (we can replace it by preventing links from being parsed in
    //       validation mode)
    //
    state.pos = state.posMax;
  }

  if (!ok) { state.pos++; }
  cache[pos] = state.pos;
};

// Generate tokens for input range
//
ParserInline.prototype.tokenize = function (state) {
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const end = state.posMax;
  const maxNesting = state.md.options.maxNesting;

  while (state.pos < end) {
    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true
    const prevPos = state.pos;
    let ok = false;

    if (state.level < maxNesting) {
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) { throw new Error("inline rule didn't increment state.pos") }
          break
        }
      }
    }

    if (ok) {
      if (state.pos >= end) { break }
      continue
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }
};

/**
 * ParserInline.parse(str, md, env, outTokens)
 *
 * Process input string and push inline tokens into `outTokens`
 **/
ParserInline.prototype.parse = function (str, md, env, outTokens) {
  const state = new this.State(str, md, env, outTokens);

  this.tokenize(state);

  const rules = this.ruler2.getRules('');
  const len = rules.length;

  for (let i = 0; i < len; i++) {
    rules[i](state);
  }
};

ParserInline.prototype.State = StateInline;

function reFactory (opts) {
  const re = {};
  opts = opts || {};

  re.src_Any = Any.source;
  re.src_Cc = Cc.source;
  re.src_Z = Z.source;
  re.src_P = P.source;

  // \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)
  re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join('|');

  // \p{\Z\Cc} (white spaces + control)
  re.src_ZCc = [re.src_Z, re.src_Cc].join('|');

  // Experimental. List of chars, completely prohibited in links
  // because can separate it from other part of text
  const text_separators = '[><\uff5c]';

  // All possible word characters (everything without punctuation, spaces & controls)
  // Defined via punctuation & spaces to save space
  // Should be something like \p{\L\N\S\M} (\w but without `_`)
  re.src_pseudo_letter = '(?:(?!' + text_separators + '|' + re.src_ZPCc + ')' + re.src_Any + ')';
  // The same as abothe but without [0-9]
  // var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCc + ')' + src_Any + ')';

  re.src_ip4 =

    '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

  // Prohibit any of "@/[]()" in user/pass to avoid wrong domain fetch.
  re.src_auth = '(?:(?:(?!' + re.src_ZCc + '|[@/\\[\\]()]).)+@)?';

  re.src_port =

    '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';

  re.src_host_terminator =

    '(?=$|' + text_separators + '|' + re.src_ZPCc + ')' +
    '(?!' + (opts['---'] ? '-(?!--)|' : '-|') + '_|:\\d|\\.-|\\.(?!$|' + re.src_ZPCc + '))';

  re.src_path =

    '(?:' +
      '[/?#]' +
        '(?:' +
          '(?!' + re.src_ZCc + '|' + text_separators + '|[()[\\]{}.,"\'?!\\-;]).|' +
          '\\[(?:(?!' + re.src_ZCc + '|\\]).)*\\]|' +
          '\\((?:(?!' + re.src_ZCc + '|[)]).)*\\)|' +
          '\\{(?:(?!' + re.src_ZCc + '|[}]).)*\\}|' +
          '\\"(?:(?!' + re.src_ZCc + '|["]).)+\\"|' +
          "\\'(?:(?!" + re.src_ZCc + "|[']).)+\\'|" +

          // allow `I'm_king` if no pair found
          "\\'(?=" + re.src_pseudo_letter + '|[-])|' +

          // google has many dots in "google search" links (#66, #81).
          // github has ... in commit range links,
          // Restrict to
          // - english
          // - percent-encoded
          // - parts of file path
          // - params separator
          // until more examples found.
          '\\.{2,}[a-zA-Z0-9%/&]|' +

          '\\.(?!' + re.src_ZCc + '|[.]|$)|' +
          (opts['---']
            ? '\\-(?!--(?:[^-]|$))(?:-*)|' // `---` => long dash, terminate
            : '\\-+|'
          ) +
          // allow `,,,` in paths
          ',(?!' + re.src_ZCc + '|$)|' +

          // allow `;` if not followed by space-like char
          ';(?!' + re.src_ZCc + '|$)|' +

          // allow `!!!` in paths, but not at the end
          '\\!+(?!' + re.src_ZCc + '|[!]|$)|' +

          '\\?(?!' + re.src_ZCc + '|[?]|$)' +
        ')+' +
      '|\\/' +
    ')?';

  // Allow anything in markdown spec, forbid quote (") at the first position
  // because emails enclosed in quotes are far more common
  re.src_email_name =

    '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*';

  re.src_xn =

    'xn--[a-z0-9\\-]{1,59}';

  // More to read about domain names
  // http://serverfault.com/questions/638260/

  re.src_domain_root =

    // Allow letters & digits (http://test1)
    '(?:' +
      re.src_xn +
      '|' +
      re.src_pseudo_letter + '{1,63}' +
    ')';

  re.src_domain =

    '(?:' +
      re.src_xn +
      '|' +
      '(?:' + re.src_pseudo_letter + ')' +
      '|' +
      '(?:' + re.src_pseudo_letter + '(?:-|' + re.src_pseudo_letter + '){0,61}' + re.src_pseudo_letter + ')' +
    ')';

  re.src_host =

    '(?:' +
    // Don't need IP check, because digits are already allowed in normal domain names
    //   src_ip4 +
    // '|' +
      '(?:(?:(?:' + re.src_domain + ')\\.)*' + re.src_domain/* _root */ + ')' +
    ')';

  re.tpl_host_fuzzy =

    '(?:' +
      re.src_ip4 +
    '|' +
      '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))' +
    ')';

  re.tpl_host_no_ip_fuzzy =

    '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))';

  re.src_host_strict =

    re.src_host + re.src_host_terminator;

  re.tpl_host_fuzzy_strict =

    re.tpl_host_fuzzy + re.src_host_terminator;

  re.src_host_port_strict =

    re.src_host + re.src_port + re.src_host_terminator;

  re.tpl_host_port_fuzzy_strict =

    re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;

  re.tpl_host_port_no_ip_fuzzy_strict =

    re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;

  //
  // Main rules
  //

  // Rude test fuzzy links by host, for quick deny
  re.tpl_host_fuzzy_test =

    'localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + re.src_ZPCc + '|>|$))';

  re.tpl_email_fuzzy =

      '(^|' + text_separators + '|"|\\(|' + re.src_ZCc + ')' +
      '(' + re.src_email_name + '@' + re.tpl_host_fuzzy_strict + ')';

  re.tpl_link_fuzzy =
      // Fuzzy link can't be prepended with .:/\- and non punctuation.
      // but can start with > (markdown blockquote)
      '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' +
      '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_fuzzy_strict + re.src_path + ')';

  re.tpl_link_no_ip_fuzzy =
      // Fuzzy link can't be prepended with .:/\- and non punctuation.
      // but can start with > (markdown blockquote)
      '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' +
      '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_no_ip_fuzzy_strict + re.src_path + ')';

  return re
}

//
// Helpers
//

// Merge objects
//
function assign (obj /* from1, from2, from3, ... */) {
  const sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj
}

function _class (obj) { return Object.prototype.toString.call(obj) }
function isString (obj) { return _class(obj) === '[object String]' }
function isObject (obj) { return _class(obj) === '[object Object]' }
function isRegExp (obj) { return _class(obj) === '[object RegExp]' }
function isFunction (obj) { return _class(obj) === '[object Function]' }

function escapeRE (str) { return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&') }

//

const defaultOptions = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};

function isOptionsObj (obj) {
  return Object.keys(obj || {}).reduce(function (acc, k) {
    /* eslint-disable-next-line no-prototype-builtins */
    return acc || defaultOptions.hasOwnProperty(k)
  }, false)
}

const defaultSchemas = {
  'http:': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.http) {
        // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.http = new RegExp(
          '^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length
      }
      return 0
    }
  },
  'https:': 'http:',
  'ftp:': 'http:',
  '//': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.no_http) {
      // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.no_http = new RegExp(
          '^' +
          self.re.src_auth +
          // Don't allow single-level domains, because of false positives like '//test'
          // with code comments
          '(?:localhost|(?:(?:' + self.re.src_domain + ')\\.)+' + self.re.src_domain_root + ')' +
          self.re.src_port +
          self.re.src_host_terminator +
          self.re.src_path,

          'i'
        );
      }

      if (self.re.no_http.test(tail)) {
        // should not be `://` & `///`, that protects from errors in protocol name
        if (pos >= 3 && text[pos - 3] === ':') { return 0 }
        if (pos >= 3 && text[pos - 3] === '/') { return 0 }
        return tail.match(self.re.no_http)[0].length
      }
      return 0
    }
  },
  'mailto:': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.mailto) {
        self.re.mailto = new RegExp(
          '^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i'
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length
      }
      return 0
    }
  }
};

// RE pattern for 2-character tlds (autogenerated by ./support/tlds_2char_gen.js)
/* eslint-disable-next-line max-len */
const tlds_2ch_src_re = 'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]';

// DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead
const tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');

function resetScanCache (self) {
  self.__index__ = -1;
  self.__text_cache__ = '';
}

function createValidator (re) {
  return function (text, pos) {
    const tail = text.slice(pos);

    if (re.test(tail)) {
      return tail.match(re)[0].length
    }
    return 0
  }
}

function createNormalizer () {
  return function (match, self) {
    self.normalize(match);
  }
}

// Schemas compiler. Build regexps.
//
function compile (self) {
  // Load & clone RE patterns.
  const re = self.re = reFactory(self.__opts__);

  // Define dynamic patterns
  const tlds = self.__tlds__.slice();

  self.onCompile();

  if (!self.__tlds_replaced__) {
    tlds.push(tlds_2ch_src_re);
  }
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join('|');

  function untpl (tpl) { return tpl.replace('%TLDS%', re.src_tlds) }

  re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), 'i');
  re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), 'i');
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), 'i');
  re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), 'i');

  //
  // Compile each schema
  //

  const aliases = [];

  self.__compiled__ = {}; // Reset compiled data

  function schemaError (name, val) {
    throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val)
  }

  Object.keys(self.__schemas__).forEach(function (name) {
    const val = self.__schemas__[name];

    // skip disabled methods
    if (val === null) { return }

    const compiled = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }

      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }

      return
    }

    if (isString(val)) {
      aliases.push(name);
      return
    }

    schemaError(name, val);
  });

  //
  // Compile postponed aliases
  //

  aliases.forEach(function (alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      // Silently fail on missed schemas to avoid errons on disable.
      // schemaError(alias, self.__schemas__[alias]);
      return
    }

    self.__compiled__[alias].validate =
      self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize =
      self.__compiled__[self.__schemas__[alias]].normalize;
  });

  //
  // Fake record for guessed links
  //
  self.__compiled__[''] = { validate: null, normalize: createNormalizer() };

  //
  // Build schema condition
  //
  const slist = Object.keys(self.__compiled__)
    .filter(function (name) {
      // Filter disabled & fake schemas
      return name.length > 0 && self.__compiled__[name]
    })
    .map(escapeRE)
    .join('|');
  // (?!_) cause 1.5x slowdown
  self.re.schema_test = RegExp('(^|(?!_)(?:[><\uff5c]|' + re.src_ZPCc + '))(' + slist + ')', 'i');
  self.re.schema_search = RegExp('(^|(?!_)(?:[><\uff5c]|' + re.src_ZPCc + '))(' + slist + ')', 'ig');
  self.re.schema_at_start = RegExp('^' + self.re.schema_search.source, 'i');

  self.re.pretest = RegExp(
    '(' + self.re.schema_test.source + ')|(' + self.re.host_fuzzy_test.source + ')|@',
    'i'
  );

  //
  // Cleanup
  //

  resetScanCache(self);
}

/**
 * class Match
 *
 * Match result. Single element of array, returned by [[LinkifyIt#match]]
 **/
function Match (self, shift) {
  const start = self.__index__;
  const end = self.__last_index__;
  const text = self.__text_cache__.slice(start, end);

  /**
   * Match#schema -> String
   *
   * Prefix (protocol) for matched string.
   **/
  this.schema = self.__schema__.toLowerCase();
  /**
   * Match#index -> Number
   *
   * First position of matched string.
   **/
  this.index = start + shift;
  /**
   * Match#lastIndex -> Number
   *
   * Next position after matched string.
   **/
  this.lastIndex = end + shift;
  /**
   * Match#raw -> String
   *
   * Matched string.
   **/
  this.raw = text;
  /**
   * Match#text -> String
   *
   * Notmalized text of matched string.
   **/
  this.text = text;
  /**
   * Match#url -> String
   *
   * Normalized url of matched string.
   **/
  this.url = text;
}

function createMatch (self, shift) {
  const match = new Match(self, shift);

  self.__compiled__[match.schema].normalize(match, self);

  return match
}

/**
 * class LinkifyIt
 **/

/**
 * new LinkifyIt(schemas, options)
 * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Creates new linkifier instance with optional additional schemas.
 * Can be called without `new` keyword for convenience.
 *
 * By default understands:
 *
 * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
 * - "fuzzy" links and emails (example.com, foo@bar.com).
 *
 * `schemas` is an object, where each key/value describes protocol/rule:
 *
 * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
 *   for example). `linkify-it` makes shure that prefix is not preceeded with
 *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
 * - __value__ - rule to check tail after link prefix
 *   - _String_ - just alias to existing rule
 *   - _Object_
 *     - _validate_ - validator function (should return matched length on success),
 *       or `RegExp`.
 *     - _normalize_ - optional function to normalize text & url of matched result
 *       (for example, for @twitter mentions).
 *
 * `options`:
 *
 * - __fuzzyLink__ - recognige URL-s without `http(s):` prefix. Default `true`.
 * - __fuzzyIP__ - allow IPs in fuzzy links above. Can conflict with some texts
 *   like version numbers. Default `false`.
 * - __fuzzyEmail__ - recognize emails without `mailto:` prefix.
 *
 **/
function LinkifyIt (schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options)
  }

  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }

  this.__opts__ = assign({}, defaultOptions, options);

  // Cache last tested result. Used to skip repeating steps on next `match` call.
  this.__index__ = -1;
  this.__last_index__ = -1; // Next scan position
  this.__schema__ = '';
  this.__text_cache__ = '';

  this.__schemas__ = assign({}, defaultSchemas, schemas);
  this.__compiled__ = {};

  this.__tlds__ = tlds_default;
  this.__tlds_replaced__ = false;

  this.re = {};

  compile(this);
}

/** chainable
 * LinkifyIt#add(schema, definition)
 * - schema (String): rule name (fixed pattern prefix)
 * - definition (String|RegExp|Object): schema definition
 *
 * Add new rule definition. See constructor description for details.
 **/
LinkifyIt.prototype.add = function add (schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this
};

/** chainable
 * LinkifyIt#set(options)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Set recognition options for links without schema.
 **/
LinkifyIt.prototype.set = function set (options) {
  this.__opts__ = assign(this.__opts__, options);
  return this
};

/**
 * LinkifyIt#test(text) -> Boolean
 *
 * Searches linkifiable pattern and returns `true` on success or `false` on fail.
 **/
LinkifyIt.prototype.test = function test (text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__ = -1;

  if (!text.length) { return false }

  let m, ml, me, len, shift, next, re, tld_pos, at_pos;

  // try to scan for link with schema - that's the most simple rule
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        this.__schema__ = m[2];
        this.__index__ = m.index + m[1].length;
        this.__last_index__ = m.index + m[0].length + len;
        break
      }
    }
  }

  if (this.__opts__.fuzzyLink && this.__compiled__['http:']) {
    // guess schemaless links
    tld_pos = text.search(this.re.host_fuzzy_test);
    if (tld_pos >= 0) {
      // if tld is located after found link - no need to check fuzzy pattern
      if (this.__index__ < 0 || tld_pos < this.__index__) {
        if ((ml = text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {
          shift = ml.index + ml[1].length;

          if (this.__index__ < 0 || shift < this.__index__) {
            this.__schema__ = '';
            this.__index__ = shift;
            this.__last_index__ = ml.index + ml[0].length;
          }
        }
      }
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__['mailto:']) {
    // guess schemaless emails
    at_pos = text.indexOf('@');
    if (at_pos >= 0) {
      // We can't skip this check, because this cases are possible:
      // 192.168.1.1@gmail.com, my.in@example.com
      if ((me = text.match(this.re.email_fuzzy)) !== null) {
        shift = me.index + me[1].length;
        next = me.index + me[0].length;

        if (this.__index__ < 0 || shift < this.__index__ ||
            (shift === this.__index__ && next > this.__last_index__)) {
          this.__schema__ = 'mailto:';
          this.__index__ = shift;
          this.__last_index__ = next;
        }
      }
    }
  }

  return this.__index__ >= 0
};

/**
 * LinkifyIt#pretest(text) -> Boolean
 *
 * Very quick check, that can give false positives. Returns true if link MAY BE
 * can exists. Can be used for speed optimization, when you need to check that
 * link NOT exists.
 **/
LinkifyIt.prototype.pretest = function pretest (text) {
  return this.re.pretest.test(text)
};

/**
 * LinkifyIt#testSchemaAt(text, name, position) -> Number
 * - text (String): text to scan
 * - name (String): rule (schema) name
 * - position (Number): text offset to check from
 *
 * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
 * at given position. Returns length of found pattern (0 on fail).
 **/
LinkifyIt.prototype.testSchemaAt = function testSchemaAt (text, schema, pos) {
  // If not supported schema check requested - terminate
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this)
};

/**
 * LinkifyIt#match(text) -> Array|null
 *
 * Returns array of found link descriptions or `null` on fail. We strongly
 * recommend to use [[LinkifyIt#test]] first, for best speed.
 *
 * ##### Result match description
 *
 * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
 *   protocol-neutral  links.
 * - __index__ - offset of matched text
 * - __lastIndex__ - index of next char after mathch end
 * - __raw__ - matched text
 * - __text__ - normalized text
 * - __url__ - link, generated from matched text
 **/
LinkifyIt.prototype.match = function match (text) {
  const result = [];
  let shift = 0;

  // Try to take previous element from cache, if .test() called before
  if (this.__index__ >= 0 && this.__text_cache__ === text) {
    result.push(createMatch(this, shift));
    shift = this.__last_index__;
  }

  // Cut head if cache was used
  let tail = shift ? text.slice(shift) : text;

  // Scan string until end reached
  while (this.test(tail)) {
    result.push(createMatch(this, shift));

    tail = tail.slice(this.__last_index__);
    shift += this.__last_index__;
  }

  if (result.length) {
    return result
  }

  return null
};

/**
 * LinkifyIt#matchAtStart(text) -> Match|null
 *
 * Returns fully-formed (not fuzzy) link if it starts at the beginning
 * of the string, and null otherwise.
 **/
LinkifyIt.prototype.matchAtStart = function matchAtStart (text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__ = -1;

  if (!text.length) return null

  const m = this.re.schema_at_start.exec(text);
  if (!m) return null

  const len = this.testSchemaAt(text, m[2], m[0].length);
  if (!len) return null

  this.__schema__ = m[2];
  this.__index__ = m.index + m[1].length;
  this.__last_index__ = m.index + m[0].length + len;

  return createMatch(this, 0)
};

/** chainable
 * LinkifyIt#tlds(list [, keepOld]) -> this
 * - list (Array): list of tlds
 * - keepOld (Boolean): merge with current list if `true` (`false` by default)
 *
 * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
 * to avoid false positives. By default this algorythm used:
 *
 * - hostname with any 2-letter root zones are ok.
 * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
 *   are ok.
 * - encoded (`xn--...`) root zones are ok.
 *
 * If list is replaced, then exact match for 2-chars root zones will be checked.
 **/
LinkifyIt.prototype.tlds = function tlds (list, keepOld) {
  list = Array.isArray(list) ? list : [list];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this
  }

  this.__tlds__ = this.__tlds__.concat(list)
    .sort()
    .filter(function (el, idx, arr) {
      return el !== arr[idx - 1]
    })
    .reverse();

  compile(this);
  return this
};

/**
 * LinkifyIt#normalize(match)
 *
 * Default normalizer (if schema does not define it's own).
 **/
LinkifyIt.prototype.normalize = function normalize (match) {
  // Do minimal possible changes by default. Need to collect feedback prior
  // to move forward https://github.com/markdown-it/linkify-it/issues/1

  if (!match.schema) { match.url = 'http://' + match.url; }

  if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
    match.url = 'mailto:' + match.url;
  }
};

/**
 * LinkifyIt#onCompile()
 *
 * Override to modify basic RegExp-s.
 **/
LinkifyIt.prototype.onCompile = function onCompile () {
};

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'

/** Regular expressions */
const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7F]/; // Note: U+007F DEL is excluded too.
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/** Error messages */
const errors = {
	'overflow': 'Overflow: input needs wider integers to process',
	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	'invalid-input': 'Invalid input'
};

/** Convenience shortcuts */
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
function error(type) {
	throw new RangeError(errors[type]);
}

/**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
function map(array, callback) {
	const result = [];
	let length = array.length;
	while (length--) {
		result[length] = callback(array[length]);
	}
	return result;
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {String} A new string of characters returned by the callback
 * function.
 */
function mapDomain(domain, callback) {
	const parts = domain.split('@');
	let result = '';
	if (parts.length > 1) {
		// In email addresses, only the domain name should be punycoded. Leave
		// the local part (i.e. everything up to `@`) intact.
		result = parts[0] + '@';
		domain = parts[1];
	}
	// Avoid `split(regex)` for IE8 compatibility. See #17.
	domain = domain.replace(regexSeparators, '\x2E');
	const labels = domain.split('.');
	const encoded = map(labels, callback).join('.');
	return result + encoded;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
	const output = [];
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			// It's a high surrogate, and there is a next character.
			const extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}

/**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param {Array} codePoints The array of numeric code points.
 * @returns {String} The new Unicode string (UCS-2).
 */
const ucs2encode = codePoints => String.fromCodePoint(...codePoints);

/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param {Number} codePoint The basic numeric code point value.
 * @returns {Number} The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */
const basicToDigit = function(codePoint) {
	if (codePoint >= 0x30 && codePoint < 0x3A) {
		return 26 + (codePoint - 0x30);
	}
	if (codePoint >= 0x41 && codePoint < 0x5B) {
		return codePoint - 0x41;
	}
	if (codePoint >= 0x61 && codePoint < 0x7B) {
		return codePoint - 0x61;
	}
	return base;
};

/**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
const digitToBasic = function(digit, flag) {
	//  0..25 map to ASCII a..z or A..Z
	// 26..35 map to ASCII 0..9
	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
const adapt = function(delta, numPoints, firstTime) {
	let k = 0;
	delta = firstTime ? floor(delta / damp) : delta >> 1;
	delta += floor(delta / numPoints);
	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
		delta = floor(delta / baseMinusTMin);
	}
	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param {String} input The Punycode string of ASCII-only symbols.
 * @returns {String} The resulting string of Unicode symbols.
 */
const decode = function(input) {
	// Don't use UCS-2.
	const output = [];
	const inputLength = input.length;
	let i = 0;
	let n = initialN;
	let bias = initialBias;

	// Handle the basic code points: let `basic` be the number of input code
	// points before the last delimiter, or `0` if there is none, then copy
	// the first basic code points to the output.

	let basic = input.lastIndexOf(delimiter);
	if (basic < 0) {
		basic = 0;
	}

	for (let j = 0; j < basic; ++j) {
		// if it's not a basic code point
		if (input.charCodeAt(j) >= 0x80) {
			error('not-basic');
		}
		output.push(input.charCodeAt(j));
	}

	// Main decoding loop: start just after the last delimiter if any basic code
	// points were copied; start at the beginning otherwise.

	for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

		// `index` is the index of the next character to be consumed.
		// Decode a generalized variable-length integer into `delta`,
		// which gets added to `i`. The overflow checking is easier
		// if we increase `i` as we go, then subtract off its starting
		// value at the end to obtain `delta`.
		const oldi = i;
		for (let w = 1, k = base; /* no condition */; k += base) {

			if (index >= inputLength) {
				error('invalid-input');
			}

			const digit = basicToDigit(input.charCodeAt(index++));

			if (digit >= base) {
				error('invalid-input');
			}
			if (digit > floor((maxInt - i) / w)) {
				error('overflow');
			}

			i += digit * w;
			const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

			if (digit < t) {
				break;
			}

			const baseMinusT = base - t;
			if (w > floor(maxInt / baseMinusT)) {
				error('overflow');
			}

			w *= baseMinusT;

		}

		const out = output.length + 1;
		bias = adapt(i - oldi, out, oldi == 0);

		// `i` was supposed to wrap around from `out` to `0`,
		// incrementing `n` each time, so we'll fix that now:
		if (floor(i / out) > maxInt - n) {
			error('overflow');
		}

		n += floor(i / out);
		i %= out;

		// Insert `n` at position `i` of the output.
		output.splice(i++, 0, n);

	}

	return String.fromCodePoint(...output);
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
const encode = function(input) {
	const output = [];

	// Convert the input in UCS-2 to an array of Unicode code points.
	input = ucs2decode(input);

	// Cache the length.
	const inputLength = input.length;

	// Initialize the state.
	let n = initialN;
	let delta = 0;
	let bias = initialBias;

	// Handle the basic code points.
	for (const currentValue of input) {
		if (currentValue < 0x80) {
			output.push(stringFromCharCode(currentValue));
		}
	}

	const basicLength = output.length;
	let handledCPCount = basicLength;

	// `handledCPCount` is the number of code points that have been handled;
	// `basicLength` is the number of basic code points.

	// Finish the basic string with a delimiter unless it's empty.
	if (basicLength) {
		output.push(delimiter);
	}

	// Main encoding loop:
	while (handledCPCount < inputLength) {

		// All non-basic code points < n have been handled already. Find the next
		// larger one:
		let m = maxInt;
		for (const currentValue of input) {
			if (currentValue >= n && currentValue < m) {
				m = currentValue;
			}
		}

		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
		// but guard against overflow.
		const handledCPCountPlusOne = handledCPCount + 1;
		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
			error('overflow');
		}

		delta += (m - n) * handledCPCountPlusOne;
		n = m;

		for (const currentValue of input) {
			if (currentValue < n && ++delta > maxInt) {
				error('overflow');
			}
			if (currentValue === n) {
				// Represent delta as a generalized variable-length integer.
				let q = delta;
				for (let k = base; /* no condition */; k += base) {
					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
					if (q < t) {
						break;
					}
					const qMinusT = q - t;
					const baseMinusT = base - t;
					output.push(
						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
					);
					q = floor(qMinusT / baseMinusT);
				}

				output.push(stringFromCharCode(digitToBasic(q, 0)));
				bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
				delta = 0;
				++handledCPCount;
			}
		}

		++delta;
		++n;

	}
	return output.join('');
};

/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param {String} input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns {String} The Unicode representation of the given Punycode
 * string.
 */
const toUnicode = function(input) {
	return mapDomain(input, function(string) {
		return regexPunycode.test(string)
			? decode(string.slice(4).toLowerCase())
			: string;
	});
};

/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
const toASCII = function(input) {
	return mapDomain(input, function(string) {
		return regexNonASCII.test(string)
			? 'xn--' + encode(string)
			: string;
	});
};

/*--------------------------------------------------------------------------*/

/** Define the public API */
const punycode = {
	/**
	 * A string representing the current Punycode.js version number.
	 * @memberOf punycode
	 * @type String
	 */
	'version': '2.3.1',
	/**
	 * An object of methods to convert from JavaScript's internal character
	 * representation (UCS-2) to Unicode code points, and back.
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode
	 * @type Object
	 */
	'ucs2': {
		'decode': ucs2decode,
		'encode': ucs2encode
	},
	'decode': decode,
	'encode': encode,
	'toASCII': toASCII,
	'toUnicode': toUnicode
};

// markdown-it default options

var cfg_default = {
  options: {
    // Enable HTML tags in source
    html: false,

    // Use '/' to close single tags (<br />)
    xhtmlOut: false,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 100
  },

  components: {
    core: {},
    block: {},
    inline: {}
  }
};

// "Zero" preset, with nothing enabled. Useful for manual configuring of simple
// modes. For example, to parse bold/italic only.

var cfg_zero = {
  options: {
    // Enable HTML tags in source
    html: false,

    // Use '/' to close single tags (<br />)
    xhtmlOut: false,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 20
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline',
        'text_join'
      ]
    },

    block: {
      rules: [
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'text'
      ],
      rules2: [
        'balance_pairs',
        'fragments_join'
      ]
    }
  }
};

// Commonmark default options

var cfg_commonmark = {
  options: {
    // Enable HTML tags in source
    html: true,

    // Use '/' to close single tags (<br />)
    xhtmlOut: true,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 20
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline',
        'text_join'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fence',
        'heading',
        'hr',
        'html_block',
        'lheading',
        'list',
        'reference',
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'emphasis',
        'entity',
        'escape',
        'html_inline',
        'image',
        'link',
        'newline',
        'text'
      ],
      rules2: [
        'balance_pairs',
        'emphasis',
        'fragments_join'
      ]
    }
  }
};

// Main parser class


const config = {
  default: cfg_default,
  zero: cfg_zero,
  commonmark: cfg_commonmark
};

//
// This validator can prohibit more than really needed to prevent XSS. It's a
// tradeoff to keep code simple and to be secure by default.
//
// If you need different setup - override validator method as you wish. Or
// replace it with dummy function and use external sanitizer.
//

const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

function validateLink (url) {
  // url should be normalized at this point, and existing entities are decoded
  const str = url.trim().toLowerCase();

  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true
}

const RECODE_HOSTNAME_FOR = ['http:', 'https:', 'mailto:'];

function normalizeLink (url) {
  const parsed = urlParse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname);
      } catch (er) { /**/ }
    }
  }

  return encode$1(format(parsed))
}

function normalizeLinkText (url) {
  const parsed = urlParse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname);
      } catch (er) { /**/ }
    }
  }

  // add '%' to exclude list because of https://github.com/markdown-it/markdown-it/issues/720
  return decode$1(format(parsed), decode$1.defaultChars + '%')
}

/**
 * class MarkdownIt
 *
 * Main parser/renderer class.
 *
 * ##### Usage
 *
 * ```javascript
 * // node.js, "classic" way:
 * var MarkdownIt = require('markdown-it'),
 *     md = new MarkdownIt();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // node.js, the same, but with sugar:
 * var md = require('markdown-it')();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // browser without AMD, added to "window" on script load
 * // Note, there are no dash.
 * var md = window.markdownit();
 * var result = md.render('# markdown-it rulezz!');
 * ```
 *
 * Single line rendering, without paragraph wrap:
 *
 * ```javascript
 * var md = require('markdown-it')();
 * var result = md.renderInline('__markdown-it__ rulezz!');
 * ```
 **/

/**
 * new MarkdownIt([presetName, options])
 * - presetName (String): optional, `commonmark` / `zero`
 * - options (Object)
 *
 * Creates parser instanse with given config. Can be called without `new`.
 *
 * ##### presetName
 *
 * MarkdownIt provides named presets as a convenience to quickly
 * enable/disable active syntax rules and options for common use cases.
 *
 * - ["commonmark"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/commonmark.mjs) -
 *   configures parser to strict [CommonMark](http://commonmark.org/) mode.
 * - [default](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/default.mjs) -
 *   similar to GFM, used when no preset name given. Enables all available rules,
 *   but still without html, typographer & autolinker.
 * - ["zero"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/zero.mjs) -
 *   all rules disabled. Useful to quickly setup your config via `.enable()`.
 *   For example, when you need only `bold` and `italic` markup and nothing else.
 *
 * ##### options:
 *
 * - __html__ - `false`. Set `true` to enable HTML tags in source. Be careful!
 *   That's not safe! You may need external sanitizer to protect output from XSS.
 *   It's better to extend features via plugins, instead of enabling HTML.
 * - __xhtmlOut__ - `false`. Set `true` to add '/' when closing single tags
 *   (`<br />`). This is needed only for full CommonMark compatibility. In real
 *   world you will need HTML output.
 * - __breaks__ - `false`. Set `true` to convert `\n` in paragraphs into `<br>`.
 * - __langPrefix__ - `language-`. CSS language class prefix for fenced blocks.
 *   Can be useful for external highlighters.
 * - __linkify__ - `false`. Set `true` to autoconvert URL-like text to links.
 * - __typographer__  - `false`. Set `true` to enable [some language-neutral
 *   replacement](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.mjs) +
 *   quotes beautification (smartquotes).
 * - __quotes__ - `“”‘’`, String or Array. Double + single quotes replacement
 *   pairs, when typographer enabled and smartquotes on. For example, you can
 *   use `'«»„“'` for Russian, `'„“‚‘'` for German, and
 *   `['«\xA0', '\xA0»', '‹\xA0', '\xA0›']` for French (including nbsp).
 * - __highlight__ - `null`. Highlighter function for fenced code blocks.
 *   Highlighter `function (str, lang)` should return escaped HTML. It can also
 *   return empty string if the source was not changed and should be escaped
 *   externaly. If result starts with <pre... internal wrapper is skipped.
 *
 * ##### Example
 *
 * ```javascript
 * // commonmark mode
 * var md = require('markdown-it')('commonmark');
 *
 * // default mode
 * var md = require('markdown-it')();
 *
 * // enable everything
 * var md = require('markdown-it')({
 *   html: true,
 *   linkify: true,
 *   typographer: true
 * });
 * ```
 *
 * ##### Syntax highlighting
 *
 * ```js
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
 *       } catch (__) {}
 *     }
 *
 *     return ''; // use external default escaping
 *   }
 * });
 * ```
 *
 * Or with full wrapper override (if you need assign class to `<pre>` or `<code>`):
 *
 * ```javascript
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * // Actual default values
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return '<pre><code class="hljs">' +
 *                hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
 *                '</code></pre>';
 *       } catch (__) {}
 *     }
 *
 *     return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
 *   }
 * });
 * ```
 *
 **/
function MarkdownIt (presetName, options) {
  if (!(this instanceof MarkdownIt)) {
    return new MarkdownIt(presetName, options)
  }

  if (!options) {
    if (!isString$1(presetName)) {
      options = presetName || {};
      presetName = 'default';
    }
  }

  /**
   * MarkdownIt#inline -> ParserInline
   *
   * Instance of [[ParserInline]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.inline = new ParserInline();

  /**
   * MarkdownIt#block -> ParserBlock
   *
   * Instance of [[ParserBlock]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.block = new ParserBlock();

  /**
   * MarkdownIt#core -> Core
   *
   * Instance of [[Core]] chain executor. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.core = new Core();

  /**
   * MarkdownIt#renderer -> Renderer
   *
   * Instance of [[Renderer]]. Use it to modify output look. Or to add rendering
   * rules for new token types, generated by plugins.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * function myToken(tokens, idx, options, env, self) {
   *   //...
   *   return result;
   * };
   *
   * md.renderer.rules['my_token'] = myToken
   * ```
   *
   * See [[Renderer]] docs and [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.mjs).
   **/
  this.renderer = new Renderer();

  /**
   * MarkdownIt#linkify -> LinkifyIt
   *
   * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
   * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/linkify.mjs)
   * rule.
   **/
  this.linkify = new LinkifyIt();

  /**
   * MarkdownIt#validateLink(url) -> Boolean
   *
   * Link validation function. CommonMark allows too much in links. By default
   * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
   * except some embedded image types.
   *
   * You can change this behaviour:
   *
   * ```javascript
   * var md = require('markdown-it')();
   * // enable everything
   * md.validateLink = function () { return true; }
   * ```
   **/
  this.validateLink = validateLink;

  /**
   * MarkdownIt#normalizeLink(url) -> String
   *
   * Function used to encode link url to a machine-readable format,
   * which includes url-encoding, punycode, etc.
   **/
  this.normalizeLink = normalizeLink;

  /**
   * MarkdownIt#normalizeLinkText(url) -> String
   *
   * Function used to decode link url to a human-readable format`
   **/
  this.normalizeLinkText = normalizeLinkText;

  // Expose utils & helpers for easy acces from plugins

  /**
   * MarkdownIt#utils -> utils
   *
   * Assorted utility functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.mjs).
   **/
  this.utils = utils;

  /**
   * MarkdownIt#helpers -> helpers
   *
   * Link components parser functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/helpers).
   **/
  this.helpers = assign$1({}, helpers);

  this.options = {};
  this.configure(presetName);

  if (options) { this.set(options); }
}

/** chainable
 * MarkdownIt.set(options)
 *
 * Set parser options (in the same format as in constructor). Probably, you
 * will never need it, but you can change options after constructor call.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .set({ html: true, breaks: true })
 *             .set({ typographer, true });
 * ```
 *
 * __Note:__ To achieve the best possible performance, don't modify a
 * `markdown-it` instance options on the fly. If you need multiple configurations
 * it's best to create multiple instances and initialize each with separate
 * config.
 **/
MarkdownIt.prototype.set = function (options) {
  assign$1(this.options, options);
  return this
};

/** chainable, internal
 * MarkdownIt.configure(presets)
 *
 * Batch load of all options and compenent settings. This is internal method,
 * and you probably will not need it. But if you will - see available presets
 * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/lib/presets)
 *
 * We strongly recommend to use presets instead of direct config loads. That
 * will give better compatibility with next versions.
 **/
MarkdownIt.prototype.configure = function (presets) {
  const self = this;

  if (isString$1(presets)) {
    const presetName = presets;
    presets = config[presetName];
    if (!presets) { throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name') }
  }

  if (!presets) { throw new Error('Wrong `markdown-it` preset, can\'t be empty') }

  if (presets.options) { self.set(presets.options); }

  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enableOnly(presets.components[name].rules);
      }
      if (presets.components[name].rules2) {
        self[name].ruler2.enableOnly(presets.components[name].rules2);
      }
    });
  }
  return this
};

/** chainable
 * MarkdownIt.enable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to enable
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable list or rules. It will automatically find appropriate components,
 * containing rules with given names. If rule not found, and `ignoreInvalid`
 * not set - throws exception.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .enable(['sub', 'sup'])
 *             .disable('smartquotes');
 * ```
 **/
MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
  let result = [];

  if (!Array.isArray(list)) { list = [list]; }

  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.enable(list, true));
  }, this);

  result = result.concat(this.inline.ruler2.enable(list, true));

  const missed = list.filter(function (name) { return result.indexOf(name) < 0 });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed)
  }

  return this
};

/** chainable
 * MarkdownIt.disable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * The same as [[MarkdownIt.enable]], but turn specified rules off.
 **/
MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
  let result = [];

  if (!Array.isArray(list)) { list = [list]; }

  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.disable(list, true));
  }, this);

  result = result.concat(this.inline.ruler2.disable(list, true));

  const missed = list.filter(function (name) { return result.indexOf(name) < 0 });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed)
  }
  return this
};

/** chainable
 * MarkdownIt.use(plugin, params)
 *
 * Load specified plugin with given params into current parser instance.
 * It's just a sugar to call `plugin(md, params)` with curring.
 *
 * ##### Example
 *
 * ```javascript
 * var iterator = require('markdown-it-for-inline');
 * var md = require('markdown-it')()
 *             .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
 *               tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar');
 *             });
 * ```
 **/
MarkdownIt.prototype.use = function (plugin /*, params, ... */) {
  const args = [this].concat(Array.prototype.slice.call(arguments, 1));
  plugin.apply(plugin, args);
  return this
};

/** internal
 * MarkdownIt.parse(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Parse input string and return list of block tokens (special token type
 * "inline" will contain list of inline tokens). You should not call this
 * method directly, until you write custom renderer (for example, to produce
 * AST).
 *
 * `env` is used to pass data between "distributed" rules and return additional
 * metadata like reference info, needed for the renderer. It also can be used to
 * inject data in specific cases. Usually, you will be ok to pass `{}`,
 * and then pass updated object to renderer.
 **/
MarkdownIt.prototype.parse = function (src, env) {
  if (typeof src !== 'string') {
    throw new Error('Input data should be a String')
  }

  const state = new this.core.State(src, this, env);

  this.core.process(state);

  return state.tokens
};

/**
 * MarkdownIt.render(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Render markdown string into html. It does all magic for you :).
 *
 * `env` can be used to inject additional metadata (`{}` by default).
 * But you will not need it with high probability. See also comment
 * in [[MarkdownIt.parse]].
 **/
MarkdownIt.prototype.render = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parse(src, env), this.options, env)
};

/** internal
 * MarkdownIt.parseInline(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * The same as [[MarkdownIt.parse]] but skip all block rules. It returns the
 * block tokens list with the single `inline` element, containing parsed inline
 * tokens in `children` property. Also updates `env` object.
 **/
MarkdownIt.prototype.parseInline = function (src, env) {
  const state = new this.core.State(src, this, env);

  state.inlineMode = true;
  this.core.process(state);

  return state.tokens
};

/**
 * MarkdownIt.renderInline(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Similar to [[MarkdownIt.render]] but for single paragraph content. Result
 * will NOT be wrapped into `<p>` tags.
 **/
MarkdownIt.prototype.renderInline = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parseInline(src, env), this.options, env)
};

var root_1$9 = template(`<div class="preview svelte-1uavf00" aria-label="Markdown preview" tabindex="0"><!></div>`);
var root_2$7 = template(`<textarea name="txt-name" spellcheck="false" class="svelte-1uavf00"></textarea>`);
var root$6 = template(`<div class="wrapper svelte-1uavf00"><!></div>`);

function Markdown_input$1($$anchor, $$props) {
	push($$props, false);

	const previewHtml = mutable_state();
	const fieldWidth = mutable_state();
	const fieldHeight = mutable_state();
	const fieldStyle = mutable_state();
	let text = prop($$props, "text", 12, '');
	let cols = prop($$props, "cols", 8, 50);
	let rows = prop($$props, "rows", 8, 10);
	let showPreview = prop($$props, "showPreview", 8, true);

	// only the escape key can go to the box
	function onKeydown(e) {
		if (e.key !== "Escape" && e.key !== "Esc") e.stopPropagation();
	}

	const md = mutable_state(new MarkdownIt({ html: false, linkify: true, breaks: true }));
	const defaultLinkOpen = get(md).renderer.rules.link_open ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

	mutate(md, get(md).renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const token = tokens[idx];

		token.attrSet('target', '_blank');
		token.attrSet('rel', 'noreferrer noopener');
		return defaultLinkOpen(tokens, idx, options, env, self);
	});

	legacy_pre_effect(
		() => (
			get(md),
			deep_read_state(text())
		),
		() => {
			set(previewHtml, get(md).render(text() ?? ''));
		}
	);

	legacy_pre_effect(() => (deep_read_state(cols())), () => {
		set(fieldWidth, `${Number(cols()) || 50}ch`);
	});

	legacy_pre_effect(() => (deep_read_state(rows())), () => {
		set(fieldHeight, `${(Number(rows()) || 10) * 1.35 + 1}em`);
	});

	legacy_pre_effect(() => (get(fieldWidth), get(fieldHeight)), () => {
		set(fieldStyle, `width:${get(fieldWidth)}; min-height:${get(fieldHeight)};`);
	});

	legacy_pre_effect_reset();

	var div = root$6();
	var node = child(div);

	if_block(
		node,
		showPreview,
		($$anchor) => {
			var div_1 = root_1$9();
			var node_1 = child(div_1);

			html(node_1, () => get(previewHtml));
			template_effect(() => set_attribute(div_1, "style", get(fieldStyle)));
			append($$anchor, div_1);
		},
		($$anchor) => {
			var textarea = root_2$7();

			template_effect(() => {
				set_attribute(textarea, "style", get(fieldStyle));
				set_attribute(textarea, "rows", rows());
				set_attribute(textarea, "cols", cols());
			});

			bind_value(textarea, text);
			event("keydown", textarea, onKeydown);
			append($$anchor, textarea);
		}
	);
	append($$anchor, div);
	pop();
}

function Markdown_input($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null,
		add: null
	});

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	// the text
	let newText = mutable_state('');
	let showPreview = mutable_state(false);

	const handlers = {
		onMarkdown(
			{
				header,
				pos,
				text,
				ok = null,
				cancel = null
			}
		) {
			// set the box parameters
			mutate(box, get(box).title = header);

			// set the ok function
			mutate(box, get(box).ok = () => {
				ok?.(get(newText));
			});

			// set the add function: when the add icon is pressed, the markdown is previewed
			mutate(box, get(box).add = () => {
				set(showPreview, !get(showPreview));
			});

			// set the text field
			set(newText, text);
			set(showPreview, false);
			// show
			get(box).show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			Markdown_input$1($$anchor, {
				get text() {
					return get(newText);
				},
				set text($$value) {
					set(newText, $$value);
				},
				get showPreview() {
					return get(showPreview);
				},
				set showPreview($$value) {
					set(showPreview, $$value);
				},
				cols: "50",
				rows: "25",
				$$legacy: true
			});
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_5$2 = template(`<p class="line contract-line svelte-m7l4mw"><span class="contract-key svelte-m7l4mw"> </span><span class="punct svelte-m7l4mw">:</span></p>`);
var root_8$1 = template(`<p class="line contract-line svelte-m7l4mw"><span class="contract-key svelte-m7l4mw">summary</span><span class="punct svelte-m7l4mw">:</span><span class="summary svelte-m7l4mw"> </span></p>`);
var root_7$1 = template(`<p class="line contract-line svelte-m7l4mw"><span class="field svelte-m7l4mw"> </span><span class="punct svelte-m7l4mw">:</span><span class="type svelte-m7l4mw"> </span></p> <!>`, 1);
var root_10$1 = template(`<p class="line contract-line svelte-m7l4mw"><span class="contract-key svelte-m7l4mw">kind</span><span class="punct svelte-m7l4mw">:</span><span class="kind svelte-m7l4mw"> </span></p>`);
var root_11$1 = template(`<p class="line contract-line svelte-m7l4mw"><span class="contract-key svelte-m7l4mw">summary</span><span class="punct svelte-m7l4mw">:</span><span class="summary svelte-m7l4mw"> </span></p>`);
var root_9$2 = template(`<p class="line contract-line svelte-m7l4mw"><span class="contract-key svelte-m7l4mw">type</span><span class="punct svelte-m7l4mw">:</span><span class="type svelte-m7l4mw"> </span></p> <!> <!>`, 1);
var root_3$1 = template(`<p class="line brace svelte-m7l4mw"></p> <p class="line contract-line svelte-m7l4mw" style="--indent:1"><span class="contract-key svelte-m7l4mw">role</span><span class="punct svelte-m7l4mw">:</span><span class="type svelte-m7l4mw"> </span></p> <!> <p class="line brace svelte-m7l4mw"></p>`, 1);
var root_13$1 = template(`<pre class="line svelte-m7l4mw"> </pre>`);
var root_2$6 = template(`<div class="section svelte-m7l4mw"><p class="section-title svelte-m7l4mw">Contract</p> <div class="box contract svelte-m7l4mw"><!></div></div>`);
var root_19 = template(`<p class="line meta svelte-m7l4mw"><span class="clickable svelte-m7l4mw"> </span></p>`);
var root_21$1 = template(`<p class="line meta svelte-m7l4mw"><span class="clickable svelte-m7l4mw"> </span></p>`);
var root_22 = template(`<p class="line empty svelte-m7l4mw">No source profile entry for this internal pin.</p>`);
var root_16$1 = template(`<p class="line endpoint svelte-m7l4mw"> </p> <!>`, 1);
var root_23 = template(`<p class="line empty svelte-m7l4mw">No internal pins are currently resolved behind this proxy.</p>`);
var root_14$1 = template(`<div class="section svelte-m7l4mw"><p class="section-title svelte-m7l4mw"> </p> <div class="box lines svelte-m7l4mw"><!></div></div>`);
var root_28 = template(`<p class="line status-warning svelte-m7l4mw"> </p>`);
var root_29 = template(`<p class="line status-ok svelte-m7l4mw">&#x2714 contract match</p>`);
var root_30 = template(`<div class="section svelte-m7l4mw"><p class="section-title svelte-m7l4mw">Description</p> <div class="box svelte-m7l4mw"><pre class="line summary svelte-m7l4mw"> </pre></div></div>`);
var root_26 = template(`<div class="box svelte-m7l4mw"><div class="lines svelte-m7l4mw"><p class="line svelte-m7l4mw"> <span class="clickable svelte-m7l4mw"> </span></p> <!></div></div> <!>`, 1);
var root_25 = template(`<div class="section svelte-m7l4mw"><p class="section-title svelte-m7l4mw">Handler</p></div> <!>`, 1);
var root_34 = template(`<p class="line svelte-m7l4mw"><span class="clickable svelte-m7l4mw"> </span></p>`);
var root_32 = template(`<div class="box svelte-m7l4mw"><div class="lines svelte-m7l4mw"></div></div>`);
var root_36 = template(`<div class="box svelte-m7l4mw"><div class="lines svelte-m7l4mw"><p class="line svelte-m7l4mw"><span class="clickable svelte-m7l4mw"> </span></p></div></div>`);
var root_31 = template(`<div class="section svelte-m7l4mw"><p class="section-title svelte-m7l4mw">Sent at</p></div> <!>`, 1);
var root_1$8 = template(`<div class="profile svelte-m7l4mw"><!> <!></div>`);

function Pin_profile($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: () => set(_pin, null)
	});

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	// save local data
	let _profile = mutable_state(null);
	let _pin = mutable_state(null);
	let _open = mutable_state(null);
	let _contract = mutable_state(null);

	// small helper
	const closeBox = () => {
		set(_pin, null);
		get(box).hide();
	};

	const handlers = {
		onShow(
			{ pos, pin, contract, profile, open = null }
		) {
			// check and just hide if repeat
			if (get(_pin) && pin === get(_pin)) return closeBox();
			mutate(box, get(box).title = pin.name + ' @ ' + pin.node.name + (pin.is.input ? ' (in)' : ' (out)'));
			set(_pin, pin);
			set(_contract, contract);
			set(_profile, profile);
			set(_open, open);
			get(box).show(pos);
		}
	};

	function onProfileKeydown(e) {
		if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
	}

	function asArray(value) {
		if (!value) return [];
		return Array.isArray(value) ? value : [value];
	}

	function partText(parts, kind) {
		return parts?.find((part) => part.kind === kind)?.text ?? '';
	}

	function cleanKind(text) {
		return String(text ?? '').replace(/[()]/g, '').trim();
	}

	function cleanSummary(text) {
		return String(text ?? '').replace(/^\s*-\s*/, '').trim();
	}

	function contractRow(line) {
		const parts = line.parts ?? [];
		const header = partText(parts, 'header');
		const field = partText(parts, 'field');
		const type = partText(parts, 'type');
		const kind = cleanKind(partText(parts, 'kind'));
		const summary = cleanSummary(partText(parts, 'summary'));

		if (header) return { kind: 'header', key: header };
		if (field) return { kind: 'field', key: field, type, summary };
		return { kind: 'type', type, typeKind: kind, summary };
	}

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$8();
			var node = child(div);

			if_block(node, () => get(_contract), ($$anchor) => {
				var div_1 = root_2$6();
				var div_2 = sibling(child(div_1), 2);
				var node_1 = child(div_2);

				if_block(
					node_1,
					() => get(_contract).tokens,
					($$anchor) => {
						var fragment_1 = root_3$1();
						var p = first_child(fragment_1);

						p.textContent = `{`;

						var p_1 = sibling(p, 2);
						var span = sibling(child(p_1), 2);
						var text_1 = child(span);

						var node_2 = sibling(p_1, 2);

						each(node_2, 1, () => get(_contract).tokens, index, ($$anchor, line) => {
							var fragment_2 = comment$1();
							const row = derived_safe_equal(() => contractRow(get(line)));
							var node_3 = first_child(fragment_2);

							if_block(
								node_3,
								() => get(row).kind === 'header',
								($$anchor) => {
									var p_2 = root_5$2();
									var span_1 = child(p_2);
									var text_2 = child(span_1);

									template_effect(() => {
										set_attribute(p_2, "style", `--indent:${get(line).indent + 1}`);
										set_text(text_2, get(row).key);
									});

									append($$anchor, p_2);
								},
								($$anchor) => {
									var fragment_3 = comment$1();
									var node_4 = first_child(fragment_3);

									if_block(
										node_4,
										() => get(row).kind === 'field',
										($$anchor) => {
											var fragment_4 = root_7$1();
											var p_3 = first_child(fragment_4);
											var span_2 = child(p_3);
											var text_3 = child(span_2);

											var span_3 = sibling(span_2, 2);
											var text_4 = child(span_3);

											var node_5 = sibling(p_3, 2);

											if_block(node_5, () => get(row).summary, ($$anchor) => {
												var p_4 = root_8$1();
												var span_4 = sibling(child(p_4), 2);
												var text_5 = child(span_4);

												template_effect(() => {
													set_attribute(p_4, "style", `--indent:${get(line).indent + 2}`);
													set_text(text_5, get(row).summary);
												});

												append($$anchor, p_4);
											});

											template_effect(() => {
												set_attribute(p_3, "style", `--indent:${get(line).indent + 1}`);
												set_text(text_3, get(row).key);
												set_text(text_4, get(row).type);
											});

											append($$anchor, fragment_4);
										},
										($$anchor) => {
											var fragment_5 = root_9$2();
											var p_5 = first_child(fragment_5);
											var span_5 = sibling(child(p_5), 2);
											var text_6 = child(span_5);

											var node_6 = sibling(p_5, 2);

											if_block(node_6, () => get(row).typeKind, ($$anchor) => {
												var p_6 = root_10$1();
												var span_6 = sibling(child(p_6), 2);
												var text_7 = child(span_6);

												template_effect(() => {
													set_attribute(p_6, "style", `--indent:${get(line).indent + 1}`);
													set_text(text_7, get(row).typeKind);
												});

												append($$anchor, p_6);
											});

											var node_7 = sibling(node_6, 2);

											if_block(node_7, () => get(row).summary, ($$anchor) => {
												var p_7 = root_11$1();
												var span_7 = sibling(child(p_7), 2);
												var text_8 = child(span_7);

												template_effect(() => {
													set_attribute(p_7, "style", `--indent:${get(line).indent + 1}`);
													set_text(text_8, get(row).summary);
												});

												append($$anchor, p_7);
											});

											template_effect(() => {
												set_attribute(p_5, "style", `--indent:${get(line).indent + 1}`);
												set_text(text_6, get(row).type);
											});

											append($$anchor, fragment_5);
										},
										true
									);

									append($$anchor, fragment_3);
								}
							);

							append($$anchor, fragment_2);
						});

						var p_8 = sibling(node_2, 2);

						p_8.textContent = `}`;
						template_effect(() => set_text(text_1, get(_contract).role ?? 'follower'));
						append($$anchor, fragment_1);
					},
					($$anchor) => {
						var fragment_6 = comment$1();
						var node_8 = first_child(fragment_6);

						if_block(
							node_8,
							() => get(_contract).text,
							($$anchor) => {
								var pre = root_13$1();
								var text_9 = child(pre);
								template_effect(() => set_text(text_9, get(_contract).text));
								append($$anchor, pre);
							},
							null,
							true
						);

						append($$anchor, fragment_6);
					}
				);
				append($$anchor, div_1);
			});

			var node_9 = sibling(node, 2);

			if_block(
				node_9,
				() => get(_pin)?.is?.proxy,
				($$anchor) => {
					var div_3 = root_14$1();
					var p_9 = child(div_3);
					var text_10 = child(p_9);

					var div_4 = sibling(p_9, 2);
					var node_10 = child(div_4);

					if_block(
						node_10,
						() => get(_profile)?.targets?.length,
						($$anchor) => {
							var fragment_7 = comment$1();
							var node_11 = first_child(fragment_7);

							each(node_11, 1, () => get(_profile).targets, index, ($$anchor, target) => {
								var fragment_8 = root_16$1();
								var p_10 = first_child(fragment_8);
								var text_11 = child(p_10);

								var node_12 = sibling(p_10, 2);

								if_block(
									node_12,
									() => asArray(get(target).profile).length,
									($$anchor) => {
										var fragment_9 = comment$1();
										var node_13 = first_child(fragment_9);

										each(node_13, 1, () => asArray(get(target).profile), index, ($$anchor, item) => {
											var fragment_10 = comment$1();
											var node_14 = first_child(fragment_10);

											if_block(
												node_14,
												() => get(item)?.handler,
												($$anchor) => {
													var p_11 = root_19();
													var span_8 = child(p_11);
													var text_12 = child(span_8);
													template_effect(() => set_text(text_12, `${get(item).file ?? ""} (${get(item).line ?? ""})`));

													event("click", span_8, () => get(_open)?.({
														file: get(item).file,
														line: get(item).line
													}));

													event("keydown", span_8, onProfileKeydown);
													append($$anchor, p_11);
												},
												($$anchor) => {
													var fragment_11 = comment$1();
													var node_15 = first_child(fragment_11);

													if_block(
														node_15,
														() => get(item)?.file,
														($$anchor) => {
															var p_12 = root_21$1();
															var span_9 = child(p_12);
															var text_13 = child(span_9);
															template_effect(() => set_text(text_13, `${get(item).file ?? ""} (${get(item).line ?? ""})`));

															event("click", span_9, () => get(_open)?.({
																file: get(item).file,
																line: get(item).line
															}));

															event("keydown", span_9, onProfileKeydown);
															append($$anchor, p_12);
														},
														null,
														true
													);

													append($$anchor, fragment_11);
												}
											);

											append($$anchor, fragment_10);
										});

										append($$anchor, fragment_9);
									},
									($$anchor) => {
										var p_13 = root_22();

										append($$anchor, p_13);
									}
								);

								template_effect(() => set_text(text_11, get(target).pin + ' @ ' + get(target).node));
								append($$anchor, fragment_8);
							});

							append($$anchor, fragment_7);
						},
						($$anchor) => {
							var p_14 = root_23();

							append($$anchor, p_14);
						}
					);
					template_effect(() => set_text(text_10, get(_pin)?.is.input ? 'Connected internal handlers' : 'Connected internal emitters'));
					append($$anchor, div_3);
				},
				($$anchor) => {
					var fragment_12 = comment$1();
					var node_16 = first_child(fragment_12);

					if_block(
						node_16,
						() => get(_pin)?.is.input,
						($$anchor) => {
							var fragment_13 = root_25();
							var node_17 = sibling(first_child(fragment_13), 2);

							if_block(node_17, () => get(_profile) != null, ($$anchor) => {
								var fragment_14 = root_26();
								var div_5 = first_child(fragment_14);
								var div_6 = child(div_5);
								var p_15 = child(div_6);
								var text_14 = child(p_15);
								var span_10 = sibling(text_14);
								var text_15 = child(span_10);

								var node_18 = sibling(p_15, 2);

								if_block(
									node_18,
									() => get(_profile).typeErrors?.length,
									($$anchor) => {
										var fragment_15 = comment$1();
										var node_19 = first_child(fragment_15);

										each(node_19, 1, () => get(_profile).typeErrors, index, ($$anchor, msg) => {
											var p_16 = root_28();
											var text_16 = child(p_16);
											template_effect(() => set_text(text_16, get(msg)));
											append($$anchor, p_16);
										});

										append($$anchor, fragment_15);
									},
									($$anchor) => {
										var p_17 = root_29();

										append($$anchor, p_17);
									}
								);

								var node_20 = sibling(div_5, 2);

								if_block(node_20, () => get(_profile).summary, ($$anchor) => {
									var div_7 = root_30();
									var div_8 = sibling(child(div_7), 2);
									var pre_1 = child(div_8);
									var text_17 = child(pre_1);
									template_effect(() => set_text(text_17, get(_profile).summary));
									append($$anchor, div_7);
								});

								template_effect(() => {
									set_text(text_14, `${get(_profile).handler + ' ' ?? ""} `);
									set_text(text_15, `${get(_profile).file ?? ""} (${get(_profile).line ?? ""})`);
								});

								event("click", span_10, () => get(_open)?.({
									file: get(_profile).file,
									line: get(_profile).line
								}));

								event("keydown", span_10, onProfileKeydown);
								append($$anchor, fragment_14);
							});

							append($$anchor, fragment_13);
						},
						($$anchor) => {
							var fragment_16 = root_31();
							var node_21 = sibling(first_child(fragment_16), 2);

							if_block(
								node_21,
								() => Array.isArray(get(_profile)),
								($$anchor) => {
									var div_9 = root_32();
									var div_10 = child(div_9);

									each(div_10, 5, () => get(_profile), index, ($$anchor, singleProfile) => {
										var fragment_17 = comment$1();
										var node_22 = first_child(fragment_17);

										if_block(node_22, () => get(singleProfile) != null, ($$anchor) => {
											var p_18 = root_34();
											var span_11 = child(p_18);
											var text_18 = child(span_11);
											template_effect(() => set_text(text_18, `${get(singleProfile).file ?? ""} (${get(singleProfile).line ?? ""})`));

											event("click", span_11, () => get(_open)?.({
												file: get(singleProfile).file,
												line: get(singleProfile).line
											}));

											event("keydown", span_11, onProfileKeydown);
											append($$anchor, p_18);
										});

										append($$anchor, fragment_17);
									});
									append($$anchor, div_9);
								},
								($$anchor) => {
									var fragment_18 = comment$1();
									var node_23 = first_child(fragment_18);

									if_block(node_23, () => get(_profile) != null, ($$anchor) => {
										var div_11 = root_36();
										var div_12 = child(div_11);
										var p_19 = child(div_12);
										var span_12 = child(p_19);
										var text_19 = child(span_12);
										template_effect(() => set_text(text_19, `${get(_profile).file ?? ""} (${get(_profile).line ?? ""})`));

										event("click", span_12, () => get(_open)?.({
											file: get(_profile).file,
											line: get(_profile).line
										}));

										event("keydown", span_12, onProfileKeydown);
										append($$anchor, div_11);
									});

									append($$anchor, fragment_18);
								}
							);

							append($$anchor, fragment_16);
						},
						true
					);

					append($$anchor, fragment_12);
				}
			);
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_2$5 = template(`<div class="error svelte-1wofc62"> </div>`);
var root_1$7 = template(`<div class="form svelte-1wofc62"><label class="inline svelte-1wofc62"><input type="checkbox" class="svelte-1wofc62"> expose input pin as agent tool</label> <label class="svelte-1wofc62">id <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">title <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">description <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <div class="row svelte-1wofc62"><label class="svelte-1wofc62">risk <select class="svelte-1wofc62"><option>low</option><option>medium</option><option>high</option></select></label> <label class="svelte-1wofc62">approval <select class="svelte-1wofc62"><option>never</option><option>on-request</option><option>always</option></select></label></div> <label class="svelte-1wofc62">timeoutMs <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">schema JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">effects JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">examples JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">usageGuidance JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <!></div>`);

function Pin_tool($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	let pin = null;
	let ok = null;
	let settings = mutable_state(makeSettings(null));
	let schemaText = mutable_state('{}');
	let effectsText = mutable_state('[]');
	let examplesText = mutable_state('');
	let usageGuidanceText = mutable_state('');
	let error = mutable_state('');

	onMount(() => {
		tx().send('modal div', get(box).div);
	});

	// small helper
	const closeBox = () => {
		pin = null;
		get(box).hide();
	};

	const handlers = {
		onShow({ pos, pin: shownPin, ok: okFn, cancel }) {
			// toggle behaviour for repeat key press
			if (pin && pin == shownPin) return closeBox();
			pin = shownPin;
			ok = okFn;
			set(settings, makeSettings(pin));
			set(schemaText, jsonText(get(settings).schema, '{}'));
			set(effectsText, jsonText(get(settings).effects, '[]'));
			set(examplesText, jsonText(get(settings).examples, ''));
			set(usageGuidanceText, jsonText(get(settings).usageGuidance, ''));
			set(error, '');
			mutate(box, get(box).title = `Tool settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`);
			mutate(box, get(box).pos = { ...pos });
			mutate(box, get(box).ok = submit);
			mutate(box, get(box).cancel = () => cancel?.());
			get(box).show(get(box).pos);
		}
	};

	function submit() {
		const next = collectSettings();

		if (!next) {
			get(box).show(get(box).pos);
			return;
		}

		ok?.(next);
	}

	function makeSettings(pin) {
		const current = pin?.tool ?? {};

		return {
			enabled: current.enabled ?? false,
			id: current.id ?? defaultId(pin),
			title: current.title ?? titleFromName(pin?.name),
			description: current.description ?? pin?.prompt ?? '',
			risk: current.risk ?? 'low',
			approval: current.approval ?? 'never',
			timeoutMs: current.timeoutMs ?? '',
			effects: current.effects ?? [],
			examples: current.examples,
			usageGuidance: current.usageGuidance,
			schema: current.schema
		};
	}

	function collectSettings() {
		set(error, '');

		const next = {
			enabled: get(settings).enabled,
			id: get(settings).id.trim(),
			title: get(settings).title.trim(),
			description: get(settings).description.trim(),
			risk: get(settings).risk,
			approval: get(settings).approval
		};

		if (!next.enabled) return { enabled: false };

		if (!next.id) {
			set(error, 'id is required');
			return null;
		}

		const schema = parseOptionalJson(get(schemaText), 'schema');

		if (schema === undefined) return null;
		if (schema !== null) next.schema = schema;

		const effects = parseOptionalJson(get(effectsText), 'effects');

		if (effects === undefined) return null;
		next.effects = Array.isArray(effects) ? effects : [];

		if (get(settings).timeoutMs !== '') {
			const timeoutMs = Number(get(settings).timeoutMs);

			if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
				set(error, 'timeoutMs must be a positive integer');
				return null;
			}

			next.timeoutMs = timeoutMs;
		}

		const examples = parseOptionalJson(get(examplesText), 'examples');

		if (examples === undefined) return null;
		if (examples !== null) next.examples = examples;

		const usageGuidance = parseOptionalJson(get(usageGuidanceText), 'usageGuidance');

		if (usageGuidance === undefined) return null;
		if (usageGuidance !== null) next.usageGuidance = usageGuidance;
		return next;
	}

	function parseOptionalJson(text, label) {
		if (!text?.trim()) return null;

		try {
			return JSON.parse(text);
		} catch(err) {
			set(error, `${label} is not valid JSON`);
			return undefined;
		}
	}

	function jsonText(value, fallback) {
		return value == null ? fallback : JSON.stringify(value, null, 2);
	}

	function defaultId(pin) {
		const pinName = String(pin?.name ?? '').trim();
		const nodeName = String(pin?.node?.name ?? '').trim();

		if (pinName && nodeName) return `${pinName} @ ${nodeName}`;
		return pinName || nodeName;
	}

	function titleFromName(name) {
		return String(name ?? '').replace(/[-_.]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$7();
			var label_1 = child(div);
			var input = child(label_1);

			var label_2 = sibling(label_1, 2);
			var input_1 = sibling(child(label_2));

			var label_3 = sibling(label_2, 2);
			var input_2 = sibling(child(label_3));

			var label_4 = sibling(label_3, 2);
			var textarea = sibling(child(label_4));

			var div_1 = sibling(label_4, 2);
			var label_5 = child(div_1);
			var select = sibling(child(label_5));

			template_effect(() => {
				get(settings).risk;
				invalidate_inner_signals(() => {});
			});

			var option = child(select);

			option.value = null == (option.__value = "low") ? "" : "low";

			var option_1 = sibling(option);

			option_1.value = null == (option_1.__value = "medium") ? "" : "medium";

			var option_2 = sibling(option_1);

			option_2.value = null == (option_2.__value = "high") ? "" : "high";

			var label_6 = sibling(label_5, 2);
			var select_1 = sibling(child(label_6));

			template_effect(() => {
				get(settings).approval;
				invalidate_inner_signals(() => {});
			});

			var option_3 = child(select_1);

			option_3.value = null == (option_3.__value = "never") ? "" : "never";

			var option_4 = sibling(option_3);

			option_4.value = null == (option_4.__value = "on-request") ? "" : "on-request";

			var option_5 = sibling(option_4);

			option_5.value = null == (option_5.__value = "always") ? "" : "always";

			var label_7 = sibling(div_1, 2);
			var input_3 = sibling(child(label_7));

			var label_8 = sibling(label_7, 2);
			var textarea_1 = sibling(child(label_8));

			var label_9 = sibling(label_8, 2);
			var textarea_2 = sibling(child(label_9));

			var label_10 = sibling(label_9, 2);
			var textarea_3 = sibling(child(label_10));

			var label_11 = sibling(label_10, 2);
			var textarea_4 = sibling(child(label_11));

			var node = sibling(label_11, 2);

			if_block(node, () => get(error), ($$anchor) => {
				var div_2 = root_2$5();
				var text_1 = child(div_2);
				template_effect(() => set_text(text_1, get(error)));
				append($$anchor, div_2);
			});
			bind_checked(input, () => get(settings).enabled, ($$value) => mutate(settings, get(settings).enabled = $$value));
			bind_value(input_1, () => get(settings).id, ($$value) => mutate(settings, get(settings).id = $$value));
			bind_value(input_2, () => get(settings).title, ($$value) => mutate(settings, get(settings).title = $$value));
			bind_value(textarea, () => get(settings).description, ($$value) => mutate(settings, get(settings).description = $$value));
			bind_select_value(select, () => get(settings).risk, ($$value) => mutate(settings, get(settings).risk = $$value));
			bind_select_value(select_1, () => get(settings).approval, ($$value) => mutate(settings, get(settings).approval = $$value));
			bind_value(input_3, () => get(settings).timeoutMs, ($$value) => mutate(settings, get(settings).timeoutMs = $$value));
			bind_value(textarea_1, () => get(schemaText), ($$value) => set(schemaText, $$value));
			bind_value(textarea_2, () => get(effectsText), ($$value) => set(effectsText, $$value));
			bind_value(textarea_3, () => get(examplesText), ($$value) => set(examplesText, $$value));
			bind_value(textarea_4, () => get(usageGuidanceText), ($$value) => set(usageGuidanceText, $$value));
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_2$4 = template(`<div class="error svelte-1jevcjj"> </div>`);
var root_1$6 = template(`<div class="form svelte-1jevcjj"><label class="inline svelte-1jevcjj"><input type="checkbox" class="svelte-1jevcjj"> expose output pin as agent event</label> <label class="svelte-1jevcjj">id <input spellcheck="false" class="svelte-1jevcjj"></label> <label class="svelte-1jevcjj">title <input spellcheck="false" class="svelte-1jevcjj"></label> <label class="svelte-1jevcjj">description <textarea spellcheck="false" class="svelte-1jevcjj"></textarea></label> <label class="svelte-1jevcjj">schema JSON <textarea spellcheck="false" class="svelte-1jevcjj"></textarea></label> <!></div>`);

function Pin_event($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	let pin = null;
	let ok = null;
	let settings = mutable_state(makeSettings(null));
	let schemaText = mutable_state('{}');
	let error = mutable_state('');

	onMount(() => {
		tx().send('modal div', get(box).div);
	});

	// small helper
	const closeBox = () => {
		pin = null;
		get(box).hide();
	};

	const handlers = {
		onShow({ pos, pin: shownPin, ok: okFn, cancel }) {
			// toggle behaviour for repeat key press
			if (pin && pin == shownPin) return closeBox();
			pin = shownPin;
			ok = okFn;
			set(settings, makeSettings(pin));
			set(schemaText, jsonText(get(settings).schema, '{}'));
			set(error, '');
			mutate(box, get(box).title = `Event settings: ${pin?.name ?? ''} @ ${pin?.node?.name ?? ''}`);
			mutate(box, get(box).pos = { ...pos });
			mutate(box, get(box).ok = submit);
			mutate(box, get(box).cancel = () => cancel?.());
			get(box).show(get(box).pos);
		}
	};

	function submit() {
		const next = collectSettings();

		if (!next) {
			get(box).show(get(box).pos);
			return;
		}

		ok?.(next);
	}

	function makeSettings(pin) {
		const current = pin?.event ?? {};

		return {
			enabled: current.enabled ?? false,
			id: current.id ?? defaultId(pin),
			title: current.title ?? titleFromName(pin?.name),
			description: current.description ?? pin?.prompt ?? '',
			schema: current.schema
		};
	}

	function collectSettings() {
		set(error, '');

		const next = {
			enabled: get(settings).enabled,
			id: get(settings).id.trim(),
			title: get(settings).title.trim(),
			description: get(settings).description.trim()
		};

		if (!next.enabled) return { enabled: false };

		if (!next.id) {
			set(error, 'id is required');
			return null;
		}

		const schema = parseOptionalJson(get(schemaText), 'schema');

		if (schema === undefined) return null;
		if (schema !== null) next.schema = schema;
		return next;
	}

	function parseOptionalJson(text, label) {
		if (!text?.trim()) return null;

		try {
			return JSON.parse(text);
		} catch(err) {
			set(error, `${label} is not valid JSON`);
			return undefined;
		}
	}

	function jsonText(value, fallback) {
		return value == null ? fallback : JSON.stringify(value, null, 2);
	}

	function defaultId(pin) {
		const pinName = String(pin?.name ?? '').trim();
		const nodeName = String(pin?.node?.name ?? '').trim();

		if (pinName && nodeName) return `${pinName} @ ${nodeName}`;
		return pinName || nodeName;
	}

	function titleFromName(name) {
		return String(name ?? '').replace(/[-_.]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$6();
			var label_1 = child(div);
			var input = child(label_1);

			var label_2 = sibling(label_1, 2);
			var input_1 = sibling(child(label_2));

			var label_3 = sibling(label_2, 2);
			var input_2 = sibling(child(label_3));

			var label_4 = sibling(label_3, 2);
			var textarea = sibling(child(label_4));

			var label_5 = sibling(label_4, 2);
			var textarea_1 = sibling(child(label_5));

			var node = sibling(label_5, 2);

			if_block(node, () => get(error), ($$anchor) => {
				var div_1 = root_2$4();
				var text_1 = child(div_1);
				template_effect(() => set_text(text_1, get(error)));
				append($$anchor, div_1);
			});
			bind_checked(input, () => get(settings).enabled, ($$value) => mutate(settings, get(settings).enabled = $$value));
			bind_value(input_1, () => get(settings).id, ($$value) => mutate(settings, get(settings).id = $$value));
			bind_value(input_2, () => get(settings).title, ($$value) => mutate(settings, get(settings).title = $$value));
			bind_value(textarea, () => get(settings).description, ($$value) => mutate(settings, get(settings).description = $$value));
			bind_value(textarea_1, () => get(schemaText), ($$value) => set(schemaText, $$value));
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root_1$5 = template(`<p class="svelte-nkfvqo"> </p>`);

function Message_box($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	let text = mutable_state('');

	onMount(async () => {
		tx().send("modal div", box.div);
	});

	const handlers = {
		"-> show"({ title, message, pos, ok, cancel }) {
			// notation
			const box = this.popup.box;

			// set the box parameters
			box.title = title;
			// The message to show
			set(text, message);
			// show
			box.show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		box,
		children: ($$anchor, $$slotProps) => {
			var p = root_1$5();
			var text_1 = child(p);
			template_effect(() => set_text(text_1, get(text)));
			append($$anchor, p);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$5 = template(`<div class="input-field svelte-dgsivs"><label class="svelte-dgsivs"> </label> <input type="text" spellcheck="false" class="svelte-dgsivs"></div>`);

function Label_input_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8),
		input = prop($$props, "input", 12),
		style = prop($$props, "style", 8),
		check = prop($$props, "check", 8);

	let field = mutable_state();
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	const setFieldWidth = () => {
		mutate(field, get(field).style.width = '0px');
		mutate(field, get(field).style.width = get(field).scrollWidth + 2 + 'px');
	};

	// color to indicate good/bad input
	let savedColor = null;
	const badInputColor = "#ff0000";

	onMount(() => {
		// save the good color
		savedColor = get(field).style.color;
		// Set input width based on its scrollWidth (for initial value)
		setFieldWidth();
	});

	function onInput(e) {
		// reinitialize the width
		setFieldWidth();
		// Do we need to check 
		if (!check()) return;
		// show disapproval when input is nok
		mutate(field, get(field).style.color = check()(e.target.value) ? savedColor : badInputColor);
	}

	legacy_pre_effect(() => (get(field)), () => {
		if (get(field)) setFieldWidth();
	});

	legacy_pre_effect_reset();
	init();

	var div = root$5();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var input_1 = sibling(label_1, 2);

	bind_this(input_1, ($$value) => set(field, $$value), () => get(field));
	set_attribute(input_1, "id", fid);

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	bind_value(input_1, input);
	event("input", input_1, onInput);
	event("click", input_1, onInput);
	append($$anchor, div);
	pop();
}

var root_2$3 = template(`<li class="svelte-1kcgyk9"><span class="material-icons-outlined kind svelte-1kcgyk9"> </span> <span class="name svelte-1kcgyk9"> </span></li>`);
var root_1$4 = template(`<ul class="suggestions svelte-1kcgyk9"></ul>`);
var root$4 = template(`<div class="input-field svelte-1kcgyk9"><label class="svelte-1kcgyk9"> </label> <input type="text" spellcheck="false" class="svelte-1kcgyk9"></div> <!>`, 1);

function Path_input_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let input = prop($$props, "input", 12, '');
	let style = prop($$props, "style", 8);
	let check = prop($$props, "check", 8);
	let maxSuggestions = prop($$props, "maxSuggestions", 8, 12);
	let fileExtensions = prop($$props, "fileExtensions", 8, '');
	let getFolder = prop($$props, "getFolder", 8, null);
	let field = mutable_state();
	let listOpen = mutable_state(false);
	let activeIndex = mutable_state(-1);
	let suggestions = mutable_state([]);
	let queryToken = 0;
	let listRect = mutable_state(null);
	let cachedFolderPath = null;
	let cachedFolder = { folders: [], files: [] };
	const fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	const badInputColor = '#ff0000';
	let savedColor = null;

	const setFieldWidth = () => {
		if (!get(field)) return;
		mutate(field, get(field).style.width = '0px');
		mutate(field, get(field).style.width = get(field).scrollWidth + 2 + 'px');
	};

	function updateListRect() {
		if (!get(field)) return;

		const rect = get(field).getBoundingClientRect();
		const gap = 4;

		set(listRect, {
			left: rect.left,
			top: rect.bottom + gap,
			minWidth: Math.max(rect.width, 240)
		});
	}

	function normalizePath(value = '') {
		return value.replace(/\\/g, '/').replace(/\/+/g, '/');
	}

	function parseExtensionFilter(value = '') {
		if (typeof value !== 'string' || !value.trim()) return [];
		return value.split(';').map((ext) => ext.trim().toLowerCase()).filter(Boolean).map((ext) => ext.startsWith('.') ? ext : '.' + ext);
	}

	function matchesExtension(name, allowedExtensions) {
		if (!allowedExtensions.length) return true;

		const dot = name.lastIndexOf('.');
		const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';

		return allowedExtensions.includes(ext);
	}

	function splitInput(value = '') {
		const normalized = normalizePath(value ?? '');

		if (!normalized) return { folderPath: '', partial: '', prefix: '' };

		if (normalized.endsWith('/')) {
			return {
				folderPath: normalized,
				partial: '',
				prefix: normalized
			};
		}

		const slash = normalized.lastIndexOf('/');

		if (slash < 0) return {
			folderPath: '',
			partial: normalized,
			prefix: ''
		};

		const folderPath = normalized.slice(0, slash + 1);

		return {
			folderPath,
			partial: normalized.slice(slash + 1),
			prefix: folderPath
		};
	}

	async function ensureFolderLoaded(folderPath, token) {
		if (cachedFolderPath === folderPath) return true;

		if (typeof getFolder() !== 'function') {
			cachedFolderPath = folderPath;
			cachedFolder = { folders: [], files: [] };
			return true;
		}

		const nextFolder = await getFolder()(folderPath);

		if (token !== queryToken) return false;
		cachedFolderPath = folderPath;
		cachedFolder = nextFolder ?? { folders: [], files: [] };
		return true;
	}

	async function updateSuggestions(value) {
		const token = queryToken += 1;
		const { folderPath, partial, prefix } = splitInput(value);
		const allowedExtensions = parseExtensionFilter(fileExtensions());

		try {
			const stillCurrent = await ensureFolderLoaded(folderPath, token);

			if (!stillCurrent || token !== queryToken) return;

			const lowerPartial = partial.toLowerCase();
			const nextSuggestions = [];

			for (const name of cachedFolder.folders ?? []) {
				if (partial && !name.toLowerCase().startsWith(lowerPartial)) continue;

				nextSuggestions.push({
					name,
					kind: 'directory',
					value: prefix + name + '/'
				});
			}

			for (const name of cachedFolder.files ?? []) {
				if (partial && !name.toLowerCase().startsWith(lowerPartial)) continue;
				if (!matchesExtension(name, allowedExtensions)) continue;
				nextSuggestions.push({ name, kind: 'file', value: prefix + name });
			}

			nextSuggestions.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
				return a.name.localeCompare(b.name);
			});

			set(suggestions, nextSuggestions.slice(0, maxSuggestions()));
			set(activeIndex, get(suggestions).length ? 0 : -1);
			set(listOpen, get(suggestions).length > 0);
			if (get(listOpen)) updateListRect();
		} catch {
			if (token !== queryToken) return;
			set(suggestions, []);
			set(activeIndex, -1);
			set(listOpen, false);
		}
	}

	function updateInputState(value) {
		setFieldWidth();
		if (!check() || !get(field)) return;
		mutate(field, get(field).style.color = check()(value) ? savedColor : badInputColor);
	}

	function onInput(e) {
		updateInputState(e.target.value);
		updateSuggestions(e.target.value);
	}

	function applySuggestion(suggestion) {
		input(suggestion.value);
		updateInputState(input());
		updateSuggestions(input());
		get(field)?.focus();
	}

	function onKeydown(e) {
		if (!get(listOpen) || !get(suggestions).length) return;
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				e.stopPropagation();
				set(activeIndex, (get(activeIndex) + 1) % get(suggestions).length);
				break;

			case 'ArrowUp':
				e.preventDefault();
				e.stopPropagation();
				set(activeIndex, (get(activeIndex) - 1 + get(suggestions).length) % get(suggestions).length);
				break;

			case 'Enter':

			case 'Tab':
				if (get(activeIndex) < 0) return;
				e.preventDefault();
				e.stopPropagation();
				applySuggestion(get(suggestions)[get(activeIndex)]);
				break;

			case 'Escape':
				e.stopPropagation();
				set(listOpen, false);
				set(activeIndex, -1);
				break;
		}
	}

	function onFocus() {
		if (input()) updateSuggestions(input());
		updateListRect();
	}

	function onBlur() {
		setTimeout(
			() => {
				set(listOpen, false);
				set(activeIndex, -1);
			},
			120
		);
	}

	onMount(() => {
		savedColor = get(field).style.color;
		setFieldWidth();
		updateInputState(input());

		const onViewportChange = () => {
			if (get(listOpen)) updateListRect();
		};

		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, true);

		return () => {
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange, true);
		};
	});

	legacy_pre_effect(() => (get(field)), () => {
		if (get(field)) setFieldWidth();
	});

	legacy_pre_effect(() => (get(field), get(listOpen)), () => {
		if (get(field) && get(listOpen)) updateListRect();
	});

	legacy_pre_effect_reset();
	init();

	var fragment = root$4();
	var div = first_child(fragment);
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var input_1 = sibling(label_1, 2);

	bind_this(input_1, ($$value) => set(field, $$value), () => get(field));
	set_attribute(input_1, "id", fid);

	var node = sibling(div, 2);

	if_block(node, () => get(listOpen) && get(suggestions).length && get(listRect), ($$anchor) => {
		var ul = root_1$4();

		each(ul, 5, () => get(suggestions), index, ($$anchor, suggestion, index) => {
			var li = root_2$3();
			var span = child(li);
			var text_1 = child(span);

			var span_1 = sibling(span, 2);
			var text_2 = child(span_1);

			template_effect(() => {
				toggle_class(li, "active", index === get(activeIndex));
				set_text(text_1, get(suggestion).kind === 'directory' ? 'folder' : 'file_open');
				set_text(text_2, get(suggestion).value);
			});

			event("mousedown", li, preventDefault(() => applySuggestion(get(suggestion))));
			append($$anchor, li);
		});
		template_effect(() => set_attribute(ul, "style", `left:${get(listRect).left}px; top:${get(listRect).top}px; min-width:${get(listRect).minWidth}px; max-width:min(36rem, calc(100vw - ${get(listRect).left + 16}px));`));
		append($$anchor, ul);
	});

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	bind_value(input_1, input);
	event("input", input_1, onInput);
	event("click", input_1, onInput);
	event("keydown", input_1, onKeydown);
	event("focus", input_1, onFocus);
	event("blur", input_1, onBlur);
	append($$anchor, fragment);
	pop();
}

var root_1$3 = template(`<!> <!>`, 1);

function Name_path($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	// local copies of the 
	let _name = mutable_state('');
	let _path = mutable_state('');
	let _regex = '';
	let _startFolder = null;
	let _fileExtensions = mutable_state('');

	async function getFolder(path = '') {
		try {
			return await tx().request('folder.get', { startFolder: _startFolder, path });
		} catch {
			return { folders: [], files: [] };
		}
	}

	function checkPath(str) {
		// if we need to test the input..
		if (!_regex) return true;
		// test the input against the regex
		return _regex.test?.(str);
	}

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	const handlers = {
		onNameAndPath(
			{
				title,
				pos,
				name,
				path,
				regex,
				ok,
				cancel,
				open,
				trash,
				startFolder = null,
				fileExtensions = ''
			}
		) {
			// The box 
			(
				mutate(box, get(box).title = title),
				mutate(box, get(box).pos = { ...pos })
			);

			mutate(box, get(box).ok = () => {
				ok?.(get(_name), get(_path));
			});

			mutate(box, get(box).cancel = cancel ? () => cancel() : null);

			mutate(box, get(box).open = (e) => {
				open?.(get(_name), get(_path));
				get(box).hide();
			});

			mutate(box, get(box).trash = trash ? () => trash() : null);
			// the name field
			set(_name, name);
			set(_path, path);
			_regex = regex;
			_startFolder = startFolder;
			set(_fileExtensions, fileExtensions);
			// show the popup
			get(box).show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$3();
			var node = first_child(fragment_1);

			Label_input_field(node, {
				label: "Name",
				style: "width: 3rem;",
				get input() {
					return get(_name);
				},
				set input($$value) {
					set(_name, $$value);
				},
				check: null,
				$$legacy: true
			});

			var node_1 = sibling(node, 2);

			Path_input_field(node_1, {
				label: "Path",
				style: "width: 3rem;",
				get input() {
					return get(_path);
				},
				set input($$value) {
					set(_path, $$value);
				},
				check: checkPath,
				getFolder,
				get fileExtensions() {
					return get(_fileExtensions);
				},
				$$legacy: true
			});

			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

function Path($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	// local copies of the 
	let _path = mutable_state();
	let _startFolder = null;
	let _fileExtensions = mutable_state('');

	async function getFolder(path = '') {
		try {
			return await tx().request('folder.get', { startFolder: _startFolder, path });
		} catch {
			return { folders: [], files: [] };
		}
	}

	function checkPath(str) {
		// if we need to test the input..
		return true;
	}

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	const handlers = {
		"-> path"(
			{
				title,
				path,
				pos,
				ok,
				cancel,
				startFolder = null,
				fileExtensions = ''
			}
		) {
			// The box 
			(
				mutate(box, get(box).title = title),
				mutate(box, get(box).pos = { ...pos })
			);

			mutate(box, get(box).ok = ok ? () => ok(get(_path)) : null);
			mutate(box, get(box).cancel = cancel ? () => cancel() : null);
			// the path field
			set(_path, path);
			_startFolder = startFolder;
			set(_fileExtensions, fileExtensions);
			// show the popup
			get(box).show();
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			Path_input_field($$anchor, {
				label: "Path :",
				style: "width: 2rem;",
				get input() {
					return get(_path);
				},
				set input($$value) {
					set(_path, $$value);
				},
				check: checkPath,
				getFolder,
				get fileExtensions() {
					return get(_fileExtensions);
				},
				$$legacy: true
			});
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

function Single_text_field($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);

	// the popup box data
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	let _text = mutable_state('');

	onMount(() => {
		tx().send("modal div", get(box).div);
	});

	const handlers = {
		"-> show"({ label, value, pos, ok, cancel }) {
			// The box 
			(
				mutate(box, get(box).title = label),
				mutate(box, get(box).pos = { ...pos })
			);

			mutate(box, get(box).ok = ok ? () => ok(get(_text)) : null);
			mutate(box, get(box).cancel = cancel ? () => cancel() : null);
			// the text 
			set(_text, value);
			// show the popup
			get(box).show(get(box).pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			Text_field($$anchor, {
				get text() {
					return get(_text);
				},
				set text($$value) {
					set(_text, $$value);
				},
				style: null,
				check: null,
				$$legacy: true
			});
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$3 = template(`<div class="input-field svelte-1tr5m2d"><label class="svelte-1tr5m2d"> </label> <input type="text" spellcheck="false" readonly="" class="svelte-1tr5m2d"></div>`);

function Label_info_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8),
		info = prop($$props, "info", 12),
		style = prop($$props, "style", 8);

	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {});
	init();

	var div = root$3();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var input = sibling(label_1, 2);
	set_attribute(input, "id", fid);

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	bind_value(input, info);
	append($$anchor, div);
	pop();
}

var root$2 = template(`<div class="color-field svelte-2bjr9q"><label class="svelte-2bjr9q"> </label> <input type="color" class="svelte-2bjr9q"></div>`);

function Color_picker($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let style = prop($$props, "style", 8);
	let color = prop($$props, "color", 12);
	let onColor = prop($$props, "onColor", 8);
	let input = mutable_state();
	// random field id
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {});

	// call the on color function if requested
	function onInput(e) {
		onColor()?.(color());
	}

	init();

	var div = root$2();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var input_1 = sibling(label_1, 2);

	bind_this(input_1, ($$value) => set(input, $$value), () => get(input));
	set_attribute(input_1, "id", fid);

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	bind_value(input_1, color);
	event("input", input_1, onInput);
	append($$anchor, div);
	pop();
}

var root$1 = template(`<div class="button-row svelte-1t3mcnt"><label class="svelte-1t3mcnt"> </label> <!></div>`);

function Button_row($$anchor, $$props) {
	let label = prop($$props, "label", 8);
	let style = prop($$props, "style", 8, '');
	var div = root$1();
	var label_1 = child(div);
	var text = child(label_1);

	var node = sibling(label_1, 2);

	slot(node, $$props, "default", {});

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text, label());
	});

	append($$anchor, div);
}

var root_2$2 = template(`<!> <!>`, 1);
var root_1$2 = template(`<!> <!> <!> <!> <!> <!> <!>`, 1);

function Document_settings($$anchor, $$props) {
	push($$props, false);

	const _supportsAgents = mutable_state();
	let tx = prop($$props, "tx", 8);

	// the popup box
	let box = mutable_state({
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	});

	// The local data
	let _path = mutable_state(),
		_created = mutable_state(),
		_version = mutable_state(),
		_saved = mutable_state(),
		_color = mutable_state(),
		_runtime = mutable_state(),
		_runtimeSettings,
		_agent,
		_capabilities,
		_onColor = mutable_state();

	onMount(() => {
		// send the box div
		tx().send('modal div', get(box).div);
	});

	const handlers = {
		"-> show"(
			{
				title,
				path,
				settings,
				capabilities,
				pos,
				ok,
				cancel,
				onColor
			}
		) {
			// The box 
			(
				mutate(box, get(box).title = title),
				mutate(box, get(box).pos = { ...pos })
			);

			mutate(box, get(box).ok = ok
				? () => {
					ok({
						runtime: get(_runtime),
						runtimeSettings: _runtimeSettings,
						agent: _agent
					});
				}
				: null);
			mutate(box, get(box).cancel = cancel ? () => cancel() : null);
			// The field settings
			set(_path, path);
			set(_version, settings.version);
			set(_created, settings.created);
			set(_saved, settings.saved);
			set(_runtime, settings.runtime);
			_runtimeSettings = cloneSettings(settings.runtimeSettings);
			_agent = cloneSettings(settings.agent);
			_capabilities = cloneSettings(capabilities);
			set(_color, settings.style.rgb);
			set(_onColor, onColor);
			// and show
			get(box).show(pos);
		}
	};

	function cloneSettings(settings) {
		if (!settings) return null;
		return JSON.parse(JSON.stringify(settings));
	}

	function showRuntimeSettings() {
		tx().send('model runtime settings', {
			runtime: get(_runtime),
			settings: _runtimeSettings,
			pos: {
				x: (get(box).pos?.x ?? 25) + 40,
				y: (get(box).pos?.y ?? 25) + 40
			},
			ok(settings) {
				_runtimeSettings = settings;
			}
		});
	}

	function showAgentSettings() {
		if (!get(_supportsAgents)) return;

		tx().send('agent settings', {
			settings: _agent,
			capabilities: _capabilities,
			pos: {
				x: (get(box).pos?.x ?? 25) + 70,
				y: (get(box).pos?.y ?? 25) + 70
			},
			ok(settings) {
				_agent = settings;
			}
		});
	}

	legacy_pre_effect(() => (get(_runtime)), () => {
		set(_supportsAgents, getRuntimeDescriptor(get(_runtime)).supportsAgents);
	});

	legacy_pre_effect_reset();
	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$2();
			var node = first_child(fragment_1);

			Label_info_field(node, {
				label: "File:",
				style: "width: 6rem;",
				get info() {
					return get(_path);
				}
			});

			var node_1 = sibling(node, 2);

			Label_info_field(node_1, {
				label: "Vmblu Version:",
				style: "width: 6rem;",
				get info() {
					return get(_version);
				}
			});

			var node_2 = sibling(node_1, 2);

			Label_info_field(node_2, {
				label: "Creation Date:",
				style: "width: 6rem;",
				get info() {
					return get(_created);
				}
			});

			var node_3 = sibling(node_2, 2);

			Label_info_field(node_3, {
				label: "Last Saved:",
				style: "width: 6rem;",
				get info() {
					return get(_saved);
				}
			});

			var node_4 = sibling(node_3, 2);

			Label_input_field(node_4, {
				label: "Runtime",
				style: "width: 6rem;",
				get input() {
					return get(_runtime);
				},
				set input($$value) {
					set(_runtime, $$value);
				},
				check: null,
				$$legacy: true
			});

			var node_5 = sibling(node_4, 2);

			Button_row(node_5, {
				label: "Settings",
				style: "width: 6rem;",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_2$2();
					var node_6 = first_child(fragment_2);

					Button(node_6, { label: "Runtime", click: showRuntimeSettings });

					var node_7 = sibling(node_6, 2);

					if_block(node_7, () => get(_supportsAgents), ($$anchor) => {
						Button($$anchor, { label: "Agents", click: showAgentSettings });
					});

					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});

			var node_8 = sibling(node_5, 2);

			Color_picker(node_8, {
				label: "Node Color:",
				style: "width: 6rem;",
				get color() {
					return get(_color);
				},
				get onColor() {
					return get(_onColor);
				}
			});

			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root = template(`<div class="text-input-field svelte-wltv54"><label class="svelte-wltv54"> </label> <input spellcheck="false" class="svelte-wltv54"></div>`);

function Label_text_input($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8);
	let text = prop($$props, "text", 12);
	let style = prop($$props, "style", 8, 'width: 9rem;');
	let onInput = prop($$props, "onInput", 8);
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	init();

	var div = root();
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text_1 = child(label_1);

	var input = sibling(label_1, 2);
	set_attribute(input, "id", fid);

	template_effect(() => {
		set_attribute(label_1, "style", style());
		set_text(text_1, label());
	});

	bind_value(input, text);
	event("input", input, () => onInput()?.());
	append($$anchor, div);
	pop();
}

var root_2$1 = template(`<span class="approval svelte-1thwlxz">requires approval</span>`);
var root_1$1 = template(`<label class="capability-item svelte-1thwlxz"><input type="checkbox" class="svelte-1thwlxz"> <span><span class="capability-title svelte-1thwlxz"> </span> <!> <span class="capability-id svelte-1thwlxz"> </span></span></label>`);
var root_3 = template(`<div class="capability-section svelte-1thwlxz"><div class="capability-header svelte-1thwlxz"><span> </span> <span class="hint svelte-1thwlxz"> </span></div> <!></div>`);
var root_6$1 = template(`<button type="button" class="agent-row svelte-1thwlxz"><div class="agent-title svelte-1thwlxz"> </div> <div> </div> <div class="agent-counts svelte-1thwlxz"> </div></button>`);
var root_9$1 = template(`<div class="row svelte-1thwlxz"><!> <!></div> <div class="row svelte-1thwlxz"><!> <!></div>`, 1);
var root_10 = template(`<div class="row svelte-1thwlxz"><!> <!></div> <!>`, 1);
var root_8 = template(`<!> <div class="row svelte-1thwlxz"><!> <!></div> <!> <!> <!> <!> <!> <!> <div class="hint svelte-1thwlxz"> </div> <!> <!> <!>`, 1);
var root_12 = template(`<textarea class="json-editor svelte-1thwlxz" spellcheck="false"></textarea>`);
var root_13 = template(`<div class="error svelte-1thwlxz"> </div>`);
var root_7 = template(`<div class="agent-form svelte-1thwlxz"><div class="tabs svelte-1thwlxz"><!> <!></div> <!> <!></div>`);
var root_5$1 = template(`<div class="agent-settings svelte-1thwlxz"><div class="agents-list svelte-1thwlxz"><!> <div class="agent-actions svelte-1thwlxz"><!> <!> <!></div></div> <!></div>`);

function Agent_settings($$anchor, $$props) {
	push($$props, false);

	const selectedAgent = mutable_state();
	const allowedCounts = mutable_state();

	const capabilityItem = (
		$$anchor,
		kind = noop,
		item = noop,
		$$arg2
	) => {
		let showApproval = derived_safe_equal(() => fallback($$arg2?.(), false));
		var label = root_1$1();
		var input = child(label);
		template_effect(() => set_checked(input, isAllowed(kind(), item().id)));

		var span = sibling(input, 2);
		var span_1 = child(span);
		var text_1 = child(span_1);

		var node = sibling(span_1, 2);

		if_block(node, () => get(showApproval) && item().approval === 'always', ($$anchor) => {
			var span_2 = root_2$1();

			append($$anchor, span_2);
		});

		var span_3 = sibling(node, 2);
		var text_2 = child(span_3);

		template_effect(() => {
			set_text(text_1, item().title || item().id);
			set_text(text_2, item().id);
		});

		event("change", input, (event) => setAllowed(kind(), item().id, event.currentTarget.checked));
		append($$anchor, label);
	};

	const capabilitySection = (
		$$anchor,
		kind = noop,
		title = noop,
		items = noop,
		$$arg3
	) => {
		let showApproval = derived_safe_equal(() => fallback($$arg3?.(), false));
		var div = root_3();
		var div_1 = child(div);
		var span_4 = child(div_1);
		var text_3 = child(span_4);

		var span_5 = sibling(span_4, 2);
		var text_4 = child(span_5);

		var node_1 = sibling(div_1, 2);

		each(node_1, 1, items, index, ($$anchor, item) => {
			capabilityItem($$anchor, kind, () => get(item), () => get(showApproval));
		});

		template_effect(() => {
			set_text(text_3, title());
			set_text(text_4, `${get(selectedAgent).permissions[kind()].allow.length ?? ""} selected`);
		});

		append($$anchor, div);
	};

	let tx = prop($$props, "tx", 8);

	const box = mutable_state({
		div: null,
		pos: null,
		title: 'Agent Settings',
		ok: null,
		cancel: null
	});

	let config = mutable_state(makeAgentConfig(null));
	let configText = mutable_state('');
	let capabilities = mutable_state({ tools: [], probes: [], events: [] });
	let selectedId = mutable_state('');
	let error = mutable_state('');
	let view = mutable_state('form');
	const providerOptions = ['openai'];

	const typeOptions = [
		'overlay',
		'http',
		'mcp',
		'openai',
		'claude',
		'langchain'
	];

	const overlayOptions = ['overlay', 'none'];
	const transportModeOptions = ['stdio', 'http'];

	onMount(() => {
		tx().send('modal div', get(box).div);
	});

	function show(
		{
			settings,
			capabilities: nextCapabilities,
			pos,
			ok,
			cancel
		}
	) {
		set(capabilities, normalizeCapabilities(nextCapabilities));
		set(config, makeAgentConfig(settings, get(capabilities)));
		set(selectedId, get(config).defaultAgent || get(config).agents[0]?.id || '');
		syncTextFromConfig();
		set(error, '');
		set(view, 'form');
		mutate(box, get(box).title = 'Agent Settings');
		mutate(box, get(box).pos = { ...pos });

		mutate(box, get(box).ok = () => {
			const next = get(view) === 'json' ? parseConfigText() : collectConfig();

			if (!next) {
				get(box).show(get(box).pos);
				return;
			}

			ok?.(next);
		});

		mutate(box, get(box).cancel = () => cancel?.());
		get(box).show(get(box).pos);
	}

	const handlers = { "-> show": show };

	function makeAgentConfig(
		settings,
		caps = { tools: [], probes: [], events: [] }
	) {
		if (settings?.agents && Array.isArray(settings.agents)) {
			const clone = JSON.parse(JSON.stringify(settings));

			clone.agents = clone.agents.length ? clone.agents.map((agent) => normalizeAgent(agent, caps)) : [makeAgent('operator', caps)];
			clone.defaultAgent = clone.defaultAgent || clone.agents[0]?.id || 'operator';
			clone.version = clone.version ?? 1;
			return clone;
		}

		if (settings?.id || settings?.llm || settings?.permissions) {
			const agent = normalizeAgent(settings, caps);

			return {
				schema: 'https://vmblu.dev/schemas/agents.v1.json',
				version: 1,
				defaultAgent: agent.id,
				agents: [agent]
			};
		}

		return {
			schema: 'https://vmblu.dev/schemas/agents.v1.json',
			version: 1,
			defaultAgent: 'operator',
			agents: [makeAgent('operator', caps)]
		};
	}

	function makeAgent(id, caps) {
		return normalizeAgent(
			{
				id,
				title: titleFromId(id),
				type: 'overlay',
				enabled: true,
				instructions: 'Operate the application through published tools.',
				llm: {
					provider: 'openai',
					model: 'gpt-4.1-mini',
					endpoint: 'http://127.0.0.1:8080/v1'
				},
				ui: { mode: 'overlay' },
				server: {
					host: '127.0.0.1',
					port: 8787,
					basePath: '/agent'
				},
				transport: { mode: 'stdio' },
				permissions: {
					tools: {
						allow: caps.tools.map((item) => item.id),
						deny: []
					},
					probes: {
						allow: caps.probes.map((item) => item.id),
						deny: []
					},
					events: {
						allow: caps.events.map((item) => item.id),
						deny: []
					}
				}
			},
			caps
		);
	}

	function normalizeAgent(agent, caps) {
		const id = String(agent?.id || 'agent').trim() || 'agent';

		return {
			id,
			type: agent?.type ?? inferAgentType(agent),
			title: agent?.title ?? titleFromId(id),
			enabled: agent?.enabled !== false,
			instructions: agent?.instructions ?? '',
			llm: {
				provider: agent?.llm?.provider ?? 'openai',
				model: agent?.llm?.model ?? 'gpt-4.1-mini',
				endpoint: agent?.llm?.endpoint ?? 'http://127.0.0.1:8080/v1'
			},
			ui: { mode: agent?.ui?.mode ?? 'overlay' },
			server: {
				host: agent?.server?.host ?? '127.0.0.1',
				port: agent?.server?.port ?? 8787,
				basePath: agent?.server?.basePath ?? '/agent'
			},
			transport: { mode: agent?.transport?.mode ?? 'stdio' },
			permissions: {
				tools: normalizePermission(agent?.permissions?.tools, caps.tools),
				probes: normalizePermission(agent?.permissions?.probes, caps.probes),
				events: normalizePermission(agent?.permissions?.events, caps.events)
			}
		};
	}

	function inferAgentType(agent) {
		if (agent?.transport?.mode) return 'mcp';
		if (agent?.server) return 'http';
		return 'overlay';
	}

	function normalizePermission(permission, items) {
		const fallback = items.map((item) => item.id);

		return {
			allow: Array.isArray(permission?.allow) ? permission.allow.filter(Boolean) : fallback,
			deny: Array.isArray(permission?.deny) ? permission.deny.filter(Boolean) : []
		};
	}

	function normalizeCapabilities(value) {
		return {
			tools: Array.isArray(value?.tools) ? value.tools.filter((item) => item?.id) : [],
			probes: Array.isArray(value?.probes) ? value.probes.filter((item) => item?.id) : [],
			events: Array.isArray(value?.events) ? value.events.filter((item) => item?.id) : []
		};
	}

	function collectConfig() {
		set(error, '');

		const ids = new Set();

		for (const agent of get(config).agents) {
			agent.id = String(agent.id ?? '').trim();

			if (!agent.id) {
				set(error, 'agent id is required');
				return null;
			}

			if (ids.has(agent.id)) {
				set(error, `duplicate agent id: ${agent.id}`);
				return null;
			}

			ids.add(agent.id);
		}

		if (!ids.has(get(config).defaultAgent)) mutate(config, get(config).defaultAgent = get(config).agents[0]?.id ?? '');
		return JSON.parse(JSON.stringify(get(config)));
	}

	function configToText(value) {
		return JSON.stringify(value ?? makeAgentConfig(null, get(capabilities)), null, 2);
	}

	function syncTextFromConfig() {
		const collected = collectConfig();

		set(configText, configToText(collected ?? get(config)));
		set(error, '');
	}

	function syncConfigFromText() {
		const parsed = parseConfigText();

		if (!parsed) return false;
		set(config, makeAgentConfig(parsed, get(capabilities)));
		set(selectedId, get(config).defaultAgent || get(config).agents[0]?.id || '');
		return true;
	}

	function setView(nextView) {
		if (nextView === get(view)) return;

		if (nextView === 'json') {
			syncTextFromConfig();
		} else if (!syncConfigFromText()) {
			return;
		}

		set(view, nextView);
	}

	function parseConfigText() {
		const text = get(configText)?.trim() ?? '';

		if (!text) {
			set(error, 'agent settings JSON is required');
			return null;
		}

		try {
			set(error, '');
			return makeAgentConfig(JSON.parse(text), get(capabilities));
		} catch(parseError) {
			set(error, parseError?.message ?? String(parseError));
			return null;
		}
	}

	function addAgent() {
		let index = get(config).agents.length + 1;
		let id = `agent${index}`;

		while (get(config).agents.some((agent) => agent.id === id)) {
			index += 1;
			id = `agent${index}`;
		}

		mutate(config, get(config).agents = [
			...get(config).agents,
			makeAgent(id, get(capabilities))
		]);

		set(selectedId, id);
	}

	function duplicateAgent() {
		if (!get(selectedAgent)) return;

		let index = 2;
		let id = `${get(selectedAgent).id}_copy`;

		while (get(config).agents.some((agent) => agent.id === id)) {
			id = `${get(selectedAgent).id}_copy${index}`;
			index += 1;
		}

		const clone = JSON.parse(JSON.stringify(get(selectedAgent)));

		clone.id = id;
		clone.title = `${get(selectedAgent).title || get(selectedAgent).id} copy`;
		mutate(config, get(config).agents = [...get(config).agents, clone]);
		set(selectedId, id);
	}

	function removeAgent() {
		if (!get(selectedAgent) || get(config).agents.length <= 1) return;

		const index = get(config).agents.findIndex((agent) => agent.id === get(selectedAgent).id);

		mutate(config, get(config).agents = get(config).agents.filter((agent) => agent.id !== get(selectedAgent).id));
		set(selectedId, get(config).agents[Math.max(0, index - 1)]?.id ?? get(config).agents[0]?.id ?? '');
		if (get(config).defaultAgent === get(selectedAgent).id) mutate(config, get(config).defaultAgent = get(selectedId));
	}

	function setAllowed(kind, id, checked) {
		if (!get(selectedAgent)) return;

		const allow = new Set(get(selectedAgent).permissions[kind].allow);

		if (checked) allow.add(id); else allow.delete(id);
		mutate(selectedAgent, get(selectedAgent).permissions[kind].allow = [...allow]);
		set(config, { ...get(config) });
	}

	function isAllowed(kind, id) {
		return get(selectedAgent)?.permissions?.[kind]?.allow?.includes(id) ?? false;
	}

	function countAllowed(agent) {
		if (!agent) return { tools: 0, probes: 0, events: 0 };

		return {
			tools: agent.permissions.tools.allow.length,
			probes: agent.permissions.probes.allow.length,
			events: agent.permissions.events.allow.length
		};
	}

	function titleFromId(id) {
		return String(id ?? '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	legacy_pre_effect(() => (get(config), get(selectedId)), () => {
		set(selectedAgent, get(config).agents.find((agent) => agent.id === get(selectedId)) ?? get(config).agents[0]);
	});

	legacy_pre_effect(() => (get(selectedAgent)), () => {
		set(allowedCounts, countAllowed(get(selectedAgent)));
	});

	legacy_pre_effect_reset();
	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var div_2 = root_5$1();
			var div_3 = child(div_2);
			var node_2 = child(div_3);

			each(node_2, 1, () => get(config).agents, index, ($$anchor, agent) => {
				var button = root_6$1();
				var div_4 = child(button);
				var text_5 = child(div_4);

				var div_5 = sibling(div_4, 2);
				var text_6 = child(div_5);

				var div_6 = sibling(div_5, 2);
				var text_7 = child(div_6);

				template_effect(() => {
					toggle_class(button, "selected", get(agent).id === get(selectedId));
					set_text(text_5, get(agent).title || get(agent).id);
					set_text(text_6, get(agent).id);

					set_text(text_7, `${get(agent).permissions.tools.allow.length ?? ""} tools,
                        ${get(agent).permissions.probes.allow.length ?? ""} probes,
                        ${get(agent).permissions.events.allow.length ?? ""} events`);
				});

				event("click", button, () => set(selectedId, get(agent).id));
				append($$anchor, button);
			});

			var div_7 = sibling(node_2, 2);
			var node_3 = child(div_7);

			Button(node_3, { label: "add agent", click: addAgent });

			var node_4 = sibling(node_3, 2);

			Button(node_4, { label: "duplicate", click: duplicateAgent });

			var node_5 = sibling(node_4, 2);
			var disabled = derived_safe_equal(() => get(config).agents.length <= 1);

			Button(node_5, {
				label: "delete",
				click: removeAgent,
				get disabled() {
					return get(disabled);
				}
			});

			var node_6 = sibling(div_3, 2);

			if_block(node_6, () => get(selectedAgent), ($$anchor) => {
				var div_8 = root_7();
				var div_9 = child(div_8);
				var node_7 = child(div_9);
				var active = derived_safe_equal(() => get(view) === 'form');

				Button(node_7, {
					label: "Form",
					click: () => setView('form'),
					get active() {
						return get(active);
					}
				});

				var node_8 = sibling(node_7, 2);
				var active_1 = derived_safe_equal(() => get(view) === 'json');

				Button(node_8, {
					label: "JSON",
					click: () => setView('json'),
					get active() {
						return get(active_1);
					}
				});

				var node_9 = sibling(div_9, 2);

				if_block(
					node_9,
					() => get(view) === 'form',
					($$anchor) => {
						var fragment_2 = root_8();
						var node_10 = first_child(fragment_2);

						Label_checkbox(node_10, {
							label: "enabled",
							get on() {
								return get(selectedAgent).enabled;
							},
							set on($$value) {
								mutate(selectedAgent, get(selectedAgent).enabled = $$value);
							},
							$$legacy: true
						});

						var div_10 = sibling(node_10, 2);
						var node_11 = child(div_10);

						Label_text_input(node_11, {
							label: "id",
							get text() {
								return get(selectedAgent).id;
							},
							set text($$value) {
								mutate(selectedAgent, get(selectedAgent).id = $$value);
							},
							onInput: () => set(selectedId, get(selectedAgent).id),
							$$legacy: true
						});

						var node_12 = sibling(node_11, 2);
						var options = derived_safe_equal(() => get(config).agents.map((agent) => agent.id));

						Label_select(node_12, {
							label: "default agent",
							get value() {
								return get(config).defaultAgent;
							},
							set value($$value) {
								mutate(config, get(config).defaultAgent = $$value);
							},
							get options() {
								return get(options);
							},
							$$legacy: true
						});

						var node_13 = sibling(div_10, 2);

						Label_select(node_13, {
							label: "type",
							get value() {
								return get(selectedAgent).type;
							},
							set value($$value) {
								mutate(selectedAgent, get(selectedAgent).type = $$value);
							},
							options: typeOptions,
							$$legacy: true
						});

						var node_14 = sibling(node_13, 2);

						Label_text_input(node_14, {
							label: "title",
							get text() {
								return get(selectedAgent).title;
							},
							set text($$value) {
								mutate(selectedAgent, get(selectedAgent).title = $$value);
							},
							$$legacy: true
						});

						var node_15 = sibling(node_14, 2);

						Label_textarea(node_15, {
							label: "instructions",
							get text() {
								return get(selectedAgent).instructions;
							},
							set text($$value) {
								mutate(selectedAgent, get(selectedAgent).instructions = $$value);
							},
							$$legacy: true
						});

						var node_16 = sibling(node_15, 2);

						if_block(node_16, () => get(selectedAgent).type === 'overlay' || get(selectedAgent).type === 'openai', ($$anchor) => {
							var fragment_3 = root_9$1();
							var div_11 = first_child(fragment_3);
							var node_17 = child(div_11);

							Label_select(node_17, {
								label: "provider",
								get value() {
									return get(selectedAgent).llm.provider;
								},
								set value($$value) {
									mutate(selectedAgent, get(selectedAgent).llm.provider = $$value);
								},
								options: providerOptions,
								$$legacy: true
							});

							var node_18 = sibling(node_17, 2);

							Label_select(node_18, {
								label: "overlay",
								get value() {
									return get(selectedAgent).ui.mode;
								},
								set value($$value) {
									mutate(selectedAgent, get(selectedAgent).ui.mode = $$value);
								},
								options: overlayOptions,
								$$legacy: true
							});

							var div_12 = sibling(div_11, 2);
							var node_19 = child(div_12);

							Label_text_input(node_19, {
								label: "model",
								get text() {
									return get(selectedAgent).llm.model;
								},
								set text($$value) {
									mutate(selectedAgent, get(selectedAgent).llm.model = $$value);
								},
								$$legacy: true
							});

							var node_20 = sibling(node_19, 2);

							Label_text_input(node_20, {
								label: "endpoint",
								get text() {
									return get(selectedAgent).llm.endpoint;
								},
								set text($$value) {
									mutate(selectedAgent, get(selectedAgent).llm.endpoint = $$value);
								},
								$$legacy: true
							});
							append($$anchor, fragment_3);
						});

						var node_21 = sibling(node_16, 2);

						if_block(node_21, () => get(selectedAgent).type === 'http', ($$anchor) => {
							var fragment_4 = root_10();
							var div_13 = first_child(fragment_4);
							var node_22 = child(div_13);

							Label_text_input(node_22, {
								label: "server host",
								get text() {
									return get(selectedAgent).server.host;
								},
								set text($$value) {
									mutate(selectedAgent, get(selectedAgent).server.host = $$value);
								},
								$$legacy: true
							});

							var node_23 = sibling(node_22, 2);

							Label_text_input(node_23, {
								label: "server port",
								get text() {
									return get(selectedAgent).server.port;
								},
								set text($$value) {
									mutate(selectedAgent, get(selectedAgent).server.port = $$value);
								},
								$$legacy: true
							});

							var node_24 = sibling(div_13, 2);

							Label_text_input(node_24, {
								label: "base path",
								get text() {
									return get(selectedAgent).server.basePath;
								},
								set text($$value) {
									mutate(selectedAgent, get(selectedAgent).server.basePath = $$value);
								},
								$$legacy: true
							});

							append($$anchor, fragment_4);
						});

						var node_25 = sibling(node_21, 2);

						if_block(node_25, () => get(selectedAgent).type === 'mcp', ($$anchor) => {
							Label_select($$anchor, {
								label: "transport",
								get value() {
									return get(selectedAgent).transport.mode;
								},
								set value($$value) {
									mutate(selectedAgent, get(selectedAgent).transport.mode = $$value);
								},
								options: transportModeOptions,
								$$legacy: true
							});
						});

						var div_14 = sibling(node_25, 2);
						var text_8 = child(div_14);

						var node_26 = sibling(div_14, 2);

						capabilitySection(node_26, () => 'tools', () => 'Tools', () => get(capabilities).tools, () => true);

						var node_27 = sibling(node_26, 2);

						capabilitySection(node_27, () => 'probes', () => 'Probes', () => get(capabilities).probes);

						var node_28 = sibling(node_27, 2);

						capabilitySection(node_28, () => 'events', () => 'Events', () => get(capabilities).events);
						template_effect(() => set_text(text_8, `Effective view: ${get(allowedCounts).tools ?? ""} tools, ${get(allowedCounts).probes ?? ""} probes, ${get(allowedCounts).events ?? ""} events.`));
						append($$anchor, fragment_2);
					},
					($$anchor) => {
						var textarea = root_12();
						bind_value(textarea, () => get(configText), ($$value) => set(configText, $$value));

						event("keydown", textarea, stopPropagation(function ($$arg) {
							bubble_event.call(this, $$props, $$arg);
						}));

						append($$anchor, textarea);
					}
				);

				var node_29 = sibling(node_9, 2);

				if_block(node_29, () => get(error), ($$anchor) => {
					var div_15 = root_13();
					var text_9 = child(div_15);
					template_effect(() => set_text(text_9, get(error)));
					append($$anchor, div_15);
				});
				append($$anchor, div_8);
			});
			append($$anchor, div_2);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "show", show);
	bind_prop($$props, "handlers", handlers);
	return pop({ show, handlers });
}

const maxColSize = 20;

function alfa(str) {
return str
}

function NodeList(tx) {

    this.tx = tx;

    // cols is an array of arrays
    this.cols = [];
    this.xyLocal = {x:0, y:0};

}
NodeList.prototype = {

    // a function to init the cols array - just counts the number of columns that are required
    init(libMap) {

        // reset 
        this.cols = [];

        // the nr of cols we have so far
        let colNr = 0;

        // the size remaining in a col
        let colRemaining = maxColSize;

        // all the first level nodes in the links
        for(const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

            // if we have enough place for the entire linkmap, we add it to the current column
            const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;
        }

        // set the nr of cols
        colNr++;
        while (colNr-- > 0) this.cols.push([]);
    },

    fill(libMap) {

        // notation
        const cols = this.cols;

        // The col nr 
        let colNr = 0;

        // The remaining size in the col
        let colRemaining = maxColSize;

        // make the cols to display
        for (const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

           // if we have enough place for the entire linkmap, we add it to the current column
           const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;

            // The name of the library comes first
            cols[colNr].push({nextModel:true, model, expanded:true});

            // The nodes in the library
            if (model.raw.root.nodes) 
                for (const node of model.raw.root.nodes) cols[colNr].push({model, node, expanded:false});
            else 
                cols[colNr].push({model, node: model.raw.root, expanded:false});
        }
    },

    onRemoveLib(e) {

        // get the index of the node clicked
        const iCol  = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;

        // get the model in the table
        const entry = this.cols[iCol]?.[iNode];
    
        // check
        if ( ! entry?.nextModel ) return

        // message with file to remove
        this.tx.send('remove file', {model: entry.model});
    },
    
    addLib(e) {
    
        const pos = {x:e.screenX, y:e.screenY};
        this.tx.send('get path',  { title:'add file to node library', 
                                    path:null, 
                                    pos,
                                    ok:(userPath) => {
                                        this.tx.send('add file',userPath);
                                    },
                                    cancel:null
                                });
    },

    onSelect(e, box){

        // hide the modal box
        box.hide();
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
        const iSub = e.target.parentNode.dataset?.sub;
    
        // get the model
        const model = this.cols[iCol][iNode].model;

        // by default the groupName is empty
        let groupName = '';
    
        // get the node in the col
        let rawNode = this.cols[iCol][iNode].node;
    
        // if a subnode was selected, get it and save the groupNode
        if (iSub) {
            groupName = rawNode.group;
            rawNode = rawNode.nodes.find( (sub,i) => i==iSub);
        }
    
        // check
        if (!rawNode) return

        // the name of the selected node
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock;

        // make the full node name
        const nodePath = groupName.length == 0 ? nodeName : groupName + '|' + nodeName;
    
        // return the selected node to the 
        this.tx.send("selected node",{model, nodePath, xyLocal:this.xyLocal});
    },
    
    onArrowClick(e) {
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
    
        // toggle the expanded boolean...
        this.cols[iCol][iNode].expanded = !this.cols[iCol][iNode].expanded;
    }

};

var root_5 = template(`<i class="material-icons-outlined lib lib-js svelte-kfxdt6">cancel</i> <p class="lib lib-js svelte-kfxdt6"> </p>`, 1);
var root_6 = template(`<i class="material-icons-outlined lib lib-json svelte-kfxdt6">cancel</i> <p class="lib lib-json svelte-kfxdt6"> </p>`, 1);
var root_4 = template(`<div class="arl svelte-kfxdt6"><!></div>`);
var root_9 = template(`<p class="node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">factory</i> <span class="node-name svelte-kfxdt6"> </span></p>`);
var root_11 = template(`<p class="node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">factory</i> <span class="node-name svelte-kfxdt6"> </span></p>`);
var root_16 = template(`<p class="sub-node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">factory</i> <span class="node-name svelte-kfxdt6"> </span></p>`);
var root_18 = template(`<p class="sub-node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">account_tree</i> <span class="node-name svelte-kfxdt6"> </span></p>`);
var root_20 = template(`<p class="sub-node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">account_tree</i> <span class="node-name svelte-kfxdt6"> </span></p>`);
var root_14 = template(`<p class="node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">account_tree</i> <span class="node-name svelte-kfxdt6"> </span> <span class="arrow svelte-kfxdt6"><!></span></p> <!>`, 1);
var root_21 = template(`<p class="node svelte-kfxdt6"><i class="material-icons-outlined icon svelte-kfxdt6">account_tree</i> <span class="node-name svelte-kfxdt6"> </span> <span class="arrow svelte-kfxdt6"><!></span></p>`);
var root_2 = template(`<div class="column svelte-kfxdt6"></div>`);
var root_1 = template(`<div class="content svelte-kfxdt6"></div>`);

function Node_selector($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, "tx", 8);
	let nodeList = mutable_state(new NodeList(tx()));
	// the arrow at the end of the dropdown
	const arrowRight = "&#9656;";
	const arrowDown = "&#9662;";

	let box = {
		div: null,
		title: 'Select Node',
		pos: null,
		ok: null,
		cancel: null,
		add: (e) => get(nodeList).addLib(e)
	};

	onMount(async () => {
		// send the box div
		tx().send('modal div', box.div);
	});

	const handlers = {
		onBuildTable(libMap) {
			get(nodeList).init(libMap);
			get(nodeList).fill(libMap);
			// if visible, refresh
			if (box.div?.style.display == 'block') set(nodeList, get(nodeList));
		},
		onShow({ xyScreen, xyLocal }) {
			// save the coord where the node will be created 
			mutate(nodeList, get(nodeList).xyLocal.x = xyLocal.x);
			mutate(nodeList, get(nodeList).xyLocal.y = xyLocal.y);
			//show the box at the right coordinates
			box.show({ x: xyScreen.x + 10, y: xyScreen.y + 10 });
		}
	};

	function onKeydown(e) {}

	function onRemoveLib(e) {
		get(nodeList).onRemoveLib(e);
		set(nodeList, get(nodeList));
	}

	function onSelect(e) {
		get(nodeList).onSelect(e, box);
		set(nodeList, get(nodeList));
	}

	function onArrowClick(e) {
		get(nodeList).onArrowClick(e);
		set(nodeList, get(nodeList));
	}

	init();

	Popup_box($$anchor, {
		box,
		children: ($$anchor, $$slotProps) => {
			var div = root_1();

			each(div, 5, () => get(nodeList).cols, index, ($$anchor, col, iCol) => {
				var div_1 = root_2();

				each(div_1, 5, () => get(col), index, ($$anchor, entry, iNode) => {
					var fragment_1 = comment$1();
					var node = first_child(fragment_1);

					if_block(
						node,
						() => get(entry).nextModel,
						($$anchor) => {
							var div_2 = root_4();

							set_attribute(div_2, "data-col", iCol);
							set_attribute(div_2, "data-node", iNode);

							var node_1 = child(div_2);

							if_block(
								node_1,
								() => get(entry).model.getArl()?.getExt() === 'js',
								($$anchor) => {
									var fragment_2 = root_5();
									var i = first_child(fragment_2);
									var p = sibling(i, 2);
									var text = child(p);

									template_effect(() => set_text(text, get(entry).model.getArl().getName()));
									event("click", i, onRemoveLib);
									event("keydown", i, onKeydown);
									append($$anchor, fragment_2);
								},
								($$anchor) => {
									var fragment_3 = root_6();
									var i_1 = first_child(fragment_3);
									var p_1 = sibling(i_1, 2);
									var text_1 = child(p_1);

									template_effect(() => set_text(text_1, get(entry).model.getArl().getName()));
									event("click", i_1, onRemoveLib);
									event("keydown", i_1, onKeydown);
									append($$anchor, fragment_3);
								}
							);
							append($$anchor, div_2);
						},
						($$anchor) => {
							var fragment_4 = comment$1();
							var node_2 = first_child(fragment_4);

							if_block(
								node_2,
								() => get(entry).node,
								($$anchor) => {
									var fragment_5 = comment$1();
									var node_3 = first_child(fragment_5);

									if_block(
										node_3,
										() => get(entry).node.source,
										($$anchor) => {
											var p_2 = root_9();

											set_attribute(p_2, "data-col", iCol);
											set_attribute(p_2, "data-node", iNode);

											var i_2 = child(p_2);
											var span = sibling(i_2, 2);
											var text_2 = child(span);

											template_effect(() => set_text(text_2, alfa(get(entry).node.source)));
											event("click", i_2, onSelect);
											event("keydown", i_2, onKeydown);
											event("click", span, onSelect);
											event("keydown", span, onKeydown);
											append($$anchor, p_2);
										},
										($$anchor) => {
											var fragment_6 = comment$1();
											var node_4 = first_child(fragment_6);

											if_block(
												node_4,
												() => get(entry).node.dock,
												($$anchor) => {
													var p_3 = root_11();

													set_attribute(p_3, "data-col", iCol);
													set_attribute(p_3, "data-node", iNode);

													var i_3 = child(p_3);
													var span_1 = sibling(i_3, 2);
													var text_3 = child(span_1);

													template_effect(() => set_text(text_3, alfa(get(entry).node.dock)));
													event("click", i_3, onSelect);
													event("keydown", i_3, onKeydown);
													event("click", span_1, onSelect);
													event("keydown", span_1, onKeydown);
													append($$anchor, p_3);
												},
												($$anchor) => {
													var fragment_7 = comment$1();
													var node_5 = first_child(fragment_7);

													if_block(
														node_5,
														() => get(entry).node.group,
														($$anchor) => {
															var fragment_8 = comment$1();
															var node_6 = first_child(fragment_8);

															if_block(
																node_6,
																() => get(entry).expanded,
																($$anchor) => {
																	var fragment_9 = root_14();
																	var p_4 = first_child(fragment_9);

																	set_attribute(p_4, "data-col", iCol);
																	set_attribute(p_4, "data-node", iNode);

																	var i_4 = child(p_4);
																	var span_2 = sibling(i_4, 2);
																	var text_4 = child(span_2);

																	template_effect(() => set_text(text_4, alfa(get(entry).node.group)));

																	var span_3 = sibling(span_2, 2);
																	var node_7 = child(span_3);

																	html(node_7, () => arrowDown);

																	var node_8 = sibling(p_4, 2);

																	each(node_8, 1, () => get(entry).node.nodes, index, ($$anchor, sub, iSub) => {
																		var fragment_10 = comment$1();
																		var node_9 = first_child(fragment_10);

																		if_block(
																			node_9,
																			() => get(sub).source,
																			($$anchor) => {
																				var p_5 = root_16();

																				set_attribute(p_5, "data-col", iCol);
																				set_attribute(p_5, "data-node", iNode);
																				set_attribute(p_5, "data-sub", iSub);

																				var i_5 = child(p_5);
																				var span_4 = sibling(i_5, 2);
																				var text_5 = child(span_4);

																				template_effect(() => set_text(text_5, alfa(get(sub).source)));
																				event("click", i_5, onSelect);
																				event("keydown", i_5, onKeydown);
																				event("click", span_4, onSelect);
																				event("keydown", span_4, onKeydown);
																				append($$anchor, p_5);
																			},
																			($$anchor) => {
																				var fragment_11 = comment$1();
																				var node_10 = first_child(fragment_11);

																				if_block(
																					node_10,
																					() => get(sub).group,
																					($$anchor) => {
																						var p_6 = root_18();

																						set_attribute(p_6, "data-col", iCol);
																						set_attribute(p_6, "data-node", iNode);
																						set_attribute(p_6, "data-sub", iSub);

																						var i_6 = child(p_6);
																						var span_5 = sibling(i_6, 2);
																						var text_6 = child(span_5);

																						template_effect(() => set_text(text_6, alfa(get(sub).group)));
																						event("click", i_6, onSelect);
																						event("keydown", i_6, onKeydown);
																						event("click", span_5, onSelect);
																						event("keydown", span_5, onKeydown);
																						append($$anchor, p_6);
																					},
																					($$anchor) => {
																						var fragment_12 = comment$1();
																						var node_11 = first_child(fragment_12);

																						if_block(
																							node_11,
																							() => get(sub).dock,
																							($$anchor) => {
																								var p_7 = root_20();

																								set_attribute(p_7, "data-col", iCol);
																								set_attribute(p_7, "data-node", iNode);
																								set_attribute(p_7, "data-sub", iSub);

																								var i_7 = child(p_7);
																								var span_6 = sibling(i_7, 2);
																								var text_7 = child(span_6);

																								template_effect(() => set_text(text_7, alfa(get(sub).dock)));
																								event("click", i_7, onSelect);
																								event("keydown", i_7, onKeydown);
																								event("click", span_6, onSelect);
																								event("keydown", span_6, onKeydown);
																								append($$anchor, p_7);
																							},
																							null,
																							true
																						);

																						append($$anchor, fragment_12);
																					},
																					true
																				);

																				append($$anchor, fragment_11);
																			}
																		);

																		append($$anchor, fragment_10);
																	});

																	event("click", i_4, onSelect);
																	event("keydown", i_4, onKeydown);
																	event("click", span_2, onArrowClick);
																	event("keydown", span_2, onKeydown);
																	event("click", span_3, onArrowClick);
																	event("keydown", span_3, onKeydown);
																	append($$anchor, fragment_9);
																},
																($$anchor) => {
																	var p_8 = root_21();

																	set_attribute(p_8, "data-col", iCol);
																	set_attribute(p_8, "data-node", iNode);

																	var i_8 = child(p_8);
																	var span_7 = sibling(i_8, 2);
																	var text_8 = child(span_7);

																	template_effect(() => set_text(text_8, alfa(get(entry).node.group)));

																	var span_8 = sibling(span_7, 2);
																	var node_12 = child(span_8);

																	html(node_12, () => arrowRight);
																	event("click", i_8, onSelect);
																	event("keydown", i_8, onKeydown);
																	event("click", span_7, onArrowClick);
																	event("keydown", span_7, onKeydown);
																	event("click", span_8, onArrowClick);
																	event("keydown", span_8, onKeydown);
																	append($$anchor, p_8);
																}
															);

															append($$anchor, fragment_8);
														},
														null,
														true
													);

													append($$anchor, fragment_7);
												},
												true
											);

											append($$anchor, fragment_6);
										}
									);

									append($$anchor, fragment_5);
								},
								null,
								true
							);

							append($$anchor, fragment_4);
						}
					);

					append($$anchor, fragment_1);
				});
				append($$anchor, div_1);
			});
			append($$anchor, div);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

// // Returns a factory function for the svelte component
// function xxgetFactory( svelteDef, htmlTarget=null) {
// 	return function (tx, sx) {

// 		const component = new svelteDef({
// 			target: htmlTarget ?? document.createElement('div'),
// 			props: {
// 				tx, sx, handlers:null
// 			}
// 		})
// 		return component.handlers
// 	}
// }

// returns a factory function for teh sveltecomponent
function getFactory( svelteComponent, htmlTarget=null) {

	return function (tx, sx) {
		const node = mount(svelteComponent, {
			target: htmlTarget ?? document.createElement("div"),
			props: { tx, sx }
		});

		// return the handlers of the cell
		return node.handlers
	}
}
const MenuTabsWindow = getFactory(Menu_tabs_window);
const VerticalMenuTabsContent = getFactory(Vertical_menu_tabs_content);
const CanvasLayoutFactory = getFactory(Canvas_layout, document.body);
const LeftMenuLayoutFactory = getFactory(Left_menu_layout, document.body);
const ColumnMainFactory = getFactory(Column_main, document.body);
const TopMenuFactory = getFactory(Top_menu);
const SideMenuFactory = getFactory(Side_menu);
const TabRibbonFactory = getFactory(Tab_ribbon);
const VscodeSideMenuFactory = getFactory(Vscode_side_menu);
const RuntimeSettingsFactory = getFactory(Runtime_settings);
const ModelRuntimeSettingsFactory = getFactory(Model_runtime_settings);
const ConfirmBox = getFactory(Confirm_box);
const ContextMenuFactory = getFactory(Context_menu);
const JsonInputFactory = getFactory(Json_area_input);
const TextBlockFactory = getFactory(Text_area_input);
const MarkdownInputFactory = getFactory(Markdown_input);
const PinProfileFactory = getFactory(Pin_profile);
const PinToolFactory = getFactory(Pin_tool);
const PinEventFactory = getFactory(Pin_event);
const MessageBoxFactory = getFactory(Message_box);
const NameAndPathFactory = getFactory(Name_path);
const PathRequestFactory = getFactory(Path);
const SingleTextFieldFactory = getFactory(Single_text_field);
const DocumentSettingsFactory = getFactory(Document_settings);
const AgentSettingsFactory = getFactory(Agent_settings);
const NodeSelectorFactory = getFactory(Node_selector);

// ------------------------------------------------------------------
// Model: 
// Path: C:/dev/vmblu/ui-svelte/model/ui-svelte.app.js
// Creation date 5/29/2026, 10:09:22 AM
// ------------------------------------------------------------------




//The runtime nodes
const nodeList = [
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "Rahz", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "Najb", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> ()",
		"folder.get => ()"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field", 
	uid: "cAOO", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "bCec", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//__________________________________________________JSON INPUT
	{
	name: "json input", 
	uid: "UTfO", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "pgdK", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "DJWw", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> build table",
		"-> show"
		],
	outputs: [
		"selected node -> ()",
		"get path -> ()",
		"add file -> ()",
		"remove file -> ()",
		"modal div -> ()"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "ihKL", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> ()",
		"folder.get => ()"
		]
	},
	//___________________________________________DOCUMENT SETTINGS
	{
	name: "document settings", 
	uid: "YvzX", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()",
		"model runtime settings -> ()",
		"agent settings -> ()"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "gflc", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "LAfG", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "DTDV", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "RNxd", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "ylzp", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "MmgG", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "qvLk", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input", 
	uid: "kmtS", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________CANVAS LAYOUT
	{
	name: "canvas layout", 
	uid: "lyRj", 
	factory: CanvasLayoutFactory,
	inputs: [
		"-> menu",
		"-> tab ribbon",
		"-> workspace",
		"-> canvas",
		"-> modal div"
		],
	outputs: [
		"canvas size change -> ()"
		]
	},
	//____________________________________________MENU TABS WINDOW
	{
	name: "menu tabs window", 
	uid: "nlwi", 
	factory: MenuTabsWindow,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> ()",
		"div -> ()"
		]
	},
	//____________________________________________LEFT MENU LAYOUT
	{
	name: "left menu layout", 
	uid: "EOCw", 
	factory: LeftMenuLayoutFactory,
	inputs: [
		"-> left menu",
		"-> left column",
		"-> area one",
		"-> area two",
		"-> vertical",
		"-> horizontal"
		],
	outputs: [
		"size change -> ()"
		]
	},
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout", 
	uid: "ENCY", 
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> ()"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content", 
	uid: "FVYe", 
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> ()",
		"div -> ()"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "TzIY", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> ()",
		"tab.request to close -> ()",
		"tab.request to select -> ()"
		]
	},
	//________________________________________________OLD TOP MENU
	{
	name: "old top menu", 
	uid: "QvDh", 
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"save -> ()",
		"save as -> ()",
		"save all -> ()",
		"accept changes -> ()",
		"sync -> ()",
		"recalibrate -> ()",
		"make app page -> ()",
		"make build lib -> ()",
		"analyze model -> ()",
		"run app page -> ()",
		"run app in iframe -> ()",
		"vertical -> ()",
		"horizontal -> ()",
		"show code editor -> ()",
		"div -> ()"
		]
	},
	//____________________________________________________TOP MENU
	{
	name: "top menu", 
	uid: "FkAJ", 
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"save -> ()",
		"save as -> ()",
		"save all -> ()",
		"accept changes -> ()",
		"sync -> ()",
		"recalibrate -> ()",
		"grid on-off -> ()",
		"make app page -> ()",
		"make build lib -> ()",
		"run app page -> ()",
		"run app in iframe -> ()",
		"show settings -> ()",
		"set save point -> ()",
		"back to save point -> ()",
		"div -> ()"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "QweY", 
	factory: SideMenuFactory,
	inputs: [],
	outputs: [
		"vertical -> ()",
		"horizontal -> ()",
		"show code editor -> ()",
		"show app -> ()",
		"div -> ()"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "STGJ", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> ()",
		"accept changes -> ()",
		"recalibrate -> ()",
		"sync model -> ()",
		"grid on-off -> ()",
		"show settings -> ()",
		"set save point -> ()",
		"back to save point -> ()",
		"make lib -> ()",
		"make app -> ()"
		]
	},
];

// Runtime options
const runtimeOptions = {};

// prepare the runtime
const runtime = new Runtime2(nodeList, runtimeOptions);

// and start the app
runtime.start();
//# sourceMappingURL=ui-svelte-bundle.js.map
