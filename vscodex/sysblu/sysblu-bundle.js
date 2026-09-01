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

// Server error
function ServerError(message, status, cause) {
    this.message = 'HTTP code: ' + status + ': ' + message;
    this.cause = cause;
}

// time-out before operation gets aborted
const msAbort=8000;

// The Promise returned from fetch() won't reject on HTTP error status even if the response is an HTTP 404 or 500. 
// Instead, as soon as the server responds with headers, the Promise will resolve normally 
// (with the ok property of the response set to false if the response isn't in the range 200–299), 
// and it will only reject on network failure or if anything prevented the request from completing
async function get$2(resource,options={}) {

    // get an abort controller - not reusable !
    const controller = new AbortController();

    // add the signal to the options
    options.signal = controller.signal;

    // launch a timeout with the abort controller - when controller.abort is called - it generates a DOMException AbortError
    const id = setTimeout(() => controller.abort(), msAbort);

    // launch and wait for fetch
    return fetch(resource, options)
    .then( response => {
            // stop the timer
            clearTimeout(id);

            // check (200 - 299 range)
            if (response.ok) return response

            // throw the error
            throw new ServerError("GET failed", response.status, "")
    })
    .catch( error =>  {

        // stop the timer
        clearTimeout(id);

        // there was a network error - rethrow
        throw error
    })
}

// save with timeout
async function post(resource,body,mime='text/plain') {

    // get an abort controller - not reusable !
    const controller = new AbortController();

    // launch a timeout with the abort controller
    const id = setTimeout(() => controller.abort(), msAbort);

    let options = {
        method: 'POST',                     // *GET, POST, PUT, DELETE, etc.
        mode: 'cors',                       // no-cors, *cors, same-origin
        cache: 'no-cache',                  // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',         // include, *same-origin, omit
        headers: {
          'Content-Type': mime
        },
        redirect: 'follow',                 // manual, *follow, error
        referrerPolicy: 'no-referrer',      // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body,                               // body data type must match "Content-Type" header

        signal: controller.signal
    };
    // launch and wait for fetch
    const response = await fetch(resource, options)
    .catch(error => {
        // log
        console.log("Network failure", error);

        // rethrow
        throw error       
    });
    // stop the timer 
    clearTimeout(id);

    // check what we got in return
    if (response.ok) return response

    // throw the error
    let srvError = await response.json();
    throw new ServerError("POST failed", response.status, srvError)
}

// regular expression for a file name and path
// The file extension is handled separately when required

// The path type that 
const Kind = {
    Unknown: 0,
    Absolute: 1,
    Relative: 2,
    Empty: 3,
};

function getKind(path) {
    if (path == null || path.length == 0) return Kind.Empty
    return isAbsolutePath(path) ? Kind.Absolute : Kind.Relative
}

function normalizeSeparators(value) {
    return (typeof value === 'string') ? value.replace(/\\/g, '/') : value
}

function getDomain(str) {

    // find the first colon and the first slash
    const colon = str.indexOf(':');
    const slash = str.indexOf('/');

    // format = domain:path - so find a colon that is not part of the path /...:... is not valid !
    if ((colon < 0) || (slash < colon)) return null

    return str.slice(0, colon)
}

// splits 'file.ext' in 'file' and '.ext' and 'file.ext1.ext2' if 'file' and '.ext1.ext2'
function getSplit(path)  {

    // we only need the fileName
    let slash = path.lastIndexOf('/');
    const fileName = slash > 0 ? path.slice(slash+1) : path;

    let p1 = fileName.lastIndexOf('.');
    let p2 = fileName.lastIndexOf('.', p1-1);
    
    return {
        name: p2 > 0 ? fileName.slice(0,p2) : (p1 > 0 ? fileName.slice(0,p1) : fileName),
        ext: p2 > 0 ? fileName.slice(p2) : (p1 > 0 ? fileName.slice(p1) : null)
    }
}

// Examples
// console.log(isAbsolutePath('/users/docs'));  // Returns true
// console.log(isAbsolutePath('users/newfile.txt'));  // Returns false
// console.log(isAbsolutePath('https://example.com'));  // Returns true
// console.log(isAbsolutePath('C:\\Users\\docs'));  // Returns true
// console.log(isAbsolutePath('file:///C:/Users/docs'));  // Returns true

function isAbsolutePath(path) {
    // Checks if the path starts with '/', 'http://', 'https://', 'file://', or a Windows drive letter
    return /^(\/|https?:\/\/|file:\/\/\/|[a-zA-Z]:[\\/]|[\w\s-]+:\/)/.test(path);
}

// make a path relative to the reference
// relativePath  /A/B/C/filea , /A/B/fileb => ./C/filea
// relativePath  /A/B/C/filea , /A/B/G/fileb => ../C/filea
// relativePath  /A/B/C/filea , /A/B/G/F/fileb => ../../C/filea
function relative(path, ref) {

    path = normalizeSeparators(path);
    ref = normalizeSeparators(ref);

    // empty values are returned unchanged
    if (!path?.length || !ref?.length) return path

    // do not try to relativize across different schemes / domains
    const pathDomain = getDomain(path);
    const refDomain = getDomain(ref);
    if (pathDomain || refDomain) {
        if (pathDomain !== refDomain) return path
    }

    const pathRooted = path.startsWith('/');
    const refRooted = ref.startsWith('/');
    if (pathRooted !== refRooted) return path

    // split into path components; ref is always treated as a file
    const pathParts = path.split('/').filter(Boolean);
    const refParts = ref.split('/').filter(Boolean);
    const refDirParts = refParts.slice(0, -1);

    let same = 0;
    const max = Math.min(pathParts.length, refDirParts.length);
    while (same < max && pathParts[same] === refDirParts[same]) same++;

    const upCount = refDirParts.length - same;
    const downParts = pathParts.slice(same);

    if (upCount === 0) return './' + downParts.join('/')

    return '../'.repeat(upCount) + downParts.join('/')
}

// if path starts with ./ or ../ or just name, make it into an absolute path based on the ref path.
// the ref path is always considered to be a file 
// The rules are as follows
//                      /a/b/c + /d = /d
//                      /a/b/c + ./d = /a/b/d
//                      /a/b/c + ../d = /a/d
//                      /a/b/c + d = /a/b/d
function absolute(path, ref) {

    path = normalizeSeparators(path);
    ref = normalizeSeparators(ref);

    // keep the original values intact while resolving
    const target = path ?? '';
    const reference = ref ?? '';

    if (!reference.length) return target
    if (!target.length)    return reference

    // already absolute
    if (isAbsolutePath(target) || getDomain(target)) return target

    // derive the base directory from the reference (ref is a file)
    const lastSlash = reference.lastIndexOf('/');
    const baseDir = lastSlash < 0 ? '' : reference.slice(0, lastSlash);
    const rooted = reference.startsWith('/');
    const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
    let extraUp = 0;

    // split and normalize the target path components
    const parts = target.split('/');
    for (const part of parts) {

        // ignore empty segments and current directory markers
        if (!part || part === '.') continue

        if (part === '..') {
            if (stack.length) {
                stack.pop();
            } else if (!rooted) {
                extraUp++;
            }
            // if rooted and nothing to pop, stay at root
        } else {
            stack.push(part);
        }
    }

    // rebuild the path
    let resolved = rooted ? '/' : '';
    if (!rooted && extraUp) resolved += '../'.repeat(extraUp);

    resolved += stack.join('/');

    // avoid returning an empty string; rooted means '/'
    return resolved || (rooted ? '/' : '.')
}

// domain path resource are the shorthands as they appear in the workspace file 
function stringCheck(userPath) {
    if (typeof userPath === 'string') return userPath;
    if (userPath && typeof userPath === 'object') {
        if (typeof userPath.fsPath === 'string') return userPath.fsPath;
        if (typeof userPath.path === 'string') return userPath.path;
        if (typeof userPath.url === 'string') return userPath.url;
    }
    return null;
}

// domain path resource uses a canonical path plus the resolved url
function ARL(path) {

    const stringPath = stringCheck(path);
    this._locator = normalizeSeparators(stringPath ?? '');

    // the resolved url
    this.url = null;

    // Resource access travels with the locator. HTTP-backed ARLs remain
    // writable by default for compatibility with the vmblu simple server.
    this.access = Object.freeze({read: true, write: true});
}

class ReadOnlyResourceError extends Error {
    constructor(path, operation = 'write') {
        super(`${operation} is not allowed for read-only resource ${path}`);
        this.name = 'ReadOnlyResourceError';
        this.code = 'ERR_ARL_READ_ONLY';
        this.path = path;
        this.operation = operation;
    }
}

ARL.prototype =  {  // makes a url based on the components

// The url is a full url - derive the canonical path from it
// typically used as new ARL().absolute(url)
absolute(url) {

    // generate the url
    this.url = new URL(url);
    this._locator = this.url.pathname;

    // return the arl
    return this
},

toJSON() {
    return this._locator
},

equals(arl) {

    return (this.url && arl.url)&&(this.url.href == arl.url.href)
},

// returns true if both files are in the same directory
sameDir(arl) {

    if (!this.url || !arl.url) return false

    const slash1 = this.url.href.lastIndexOf('/');
    const slash2 = arl.url.href.lastIndexOf('/');

    return this.url.href.slice(0,slash1) === arl.url.href.slice(0, slash2)
},

getPath() {
    return this._locator
},

setReadOnly(readOnly = true) {
    this.access = Object.freeze({...this.access, write: !readOnly});
    return this
},

canWrite() {
    return this.access?.write !== false
},

assertWritable(operation = 'write') {
    if (!this.canWrite()) throw new ReadOnlyResourceError(this.getPath(), operation)
},

getExt() {
    // get the position of the last period
    let n = this._locator.lastIndexOf('.');

    // get the extension of the file - if any
    return n < 0 ? '' : this._locator.slice(n+1)
},

getName() {
    // for /dir1/dir2 and repo:/dir1/dir2 we use dir2
    const normalized = this._locator.endsWith('/') && this._locator.length > 1
        ? this._locator.slice(0, -1)
        : this._locator;
    const slash = normalized.lastIndexOf('/');
    if (slash >= 0) return normalized.slice(slash + 1)

    // for repo: we use repo
    const colon = normalized.indexOf(':'); 
    if (colon > 0) return normalized.slice(0, colon) 
    
    // otherwise just use the path
    return normalized
},

// The full pathname - no host and no queries
getFullPath() {
    return this.url ? this.url.pathname : this._locator
},

setWSReference(wsRef) {},

// resolve a path wrt this arl - returns a new arl !
resolve(path) {

    const normalizedPath = normalizeSeparators(path);

    // relative path: check that we have a url
    if (!this.url) {
        console.error(`cannot resolve ${path} - missing reference`);
        return null
    }

    // and make a url that is relative to this
    const url = new URL(normalizedPath, this.url);
    const arl = new ARL(url.pathname);
    arl.url = url;
    arl.access = this.access;

    // done
    return arl
},

resolve_dbg(path) {

    const arl = this.resolve(path);
    //DEV ONLY
    //console.log(`%cresolved: ${path} using ${this._locator} to ${arl._locator}`, 'background: #ff0; color: #00f')
    return arl
},

relativeTo(ref) {
    return relative(this.getFullPath(), ref.getFullPath())
},

makeRelative(ref) {
    return this.relativeTo(ref)
},

copy() {
    const arl = new ARL(this._locator);
    arl.url = this.url ? new URL(this.url) : null;
    arl.access = this.access;
    return arl
},

async getMeta() {

    // check
    if (!this.validURL()) return null

    const response = await get$2(this.url, {method: 'HEAD'});
    const modified = response.headers.get('Last-Modified');
    const etag = response.headers.get('ETag');
    const contentLength = response.headers.get('Content-Length');
    const size = contentLength == null ? null : +contentLength;

    return {modified, etag, size}
},

async getStamp() {

    const meta = await this.getMeta().catch(() => null);
    if (!meta) return null

    if (meta.etag) return `etag:${meta.etag}`

    const modified = meta.modified ?? '';
    const size = meta.size ?? '';
    return (modified || size !== '') ? `modified:${modified}|size:${size}` : null
},

validURL() {
    if (!this.url) {
        console.error(`missing url ${this._locator}`);
        return false
    } 
    return true
},

async get(as='text') {

    // check
    if (!this.validURL()) return null

    // get the file - return the promise
    return get$2(this.url)
    .then( async response => {

        // the size of the body could be 0 - that is ok
        if (response.headers.get('Content-Length') == '0') return null

        // wait for the content and return it 
        return (as=='json') ? await response.json() : await response.text()
    })
},

async save(body) {

    // Enforce access before performing any network operation.
    this.assertWritable('save');

    // check
    if (!this.validURL()) return null

    // add a query
    let query = `?action=save`;

    // post the content
    return post(this.url+query, body)
},

// async getFolder() {

//     // check
//     if (!this.validURL()) return null

//     // wet have to add the api and service 
//     let href = this.url.origin + '/api/folder' + this.url.pathname

//     const url = new URL(href)

//     // request the file - return the body
//     return await HTTP.get(url)
//     .then( async response => {

//         // the size of the body could be 0 - that is ok
//         if (response.headers.get('Content-Length') == '0') return null
        
//         // convert
//         return await response.json()
//     })
// },

// javascript source files can be imported
async jsImport() {},

};

// Auto-generated by cli/scripts/generate-schema-version.js
const SCHEMA_VERSION = "1.12.0";

const vscode = acquireVsCodeApi();
let rqKey = 1;

// the callback map
const promiseMap = new Map();

function requestVsCode(verb, payload = {}) {
	const currentKey = rqKey++;
	const promise = new Promise(resolve => promiseMap.set(currentKey, resolve));
	vscode.postMessage({verb, rqKey: currentKey, ...payload});
	return promise;
}

// The function called to change some of the methods of ARL
function adaptARL() {
	
	// change some of the ARL methods
	Object.assign(ARL.prototype, vscodeARLmethods);
}

// The list of methods that need to be changed...
const vscodeARLmethods = {

	absolute(url) {
		const asString = typeof url === 'string' ? url : String(url);
		let locator = asString;
		try {
			locator = normalizeSeparators(decodeURIComponent(new URL(asString).pathname));
		}
		catch {}

		this._locator = locator;
		this.url = url;

		return this;
	},

	// resolves a userpath wrt this arl - returns a new arl
	resolve(userPath) {

		const normalizedPath = normalizeSeparators(userPath);
		if (!normalizedPath?.length) return this.copy();

		// absolute native windows path
		if (/^[a-zA-Z]:\//.test(normalizedPath)) return this.nativeWindows(normalizedPath);

		// absolute uri or rooted path
		if (getKind(normalizedPath) === Kind.Absolute) {
			if (/^[a-zA-Z]+:\/\//.test(normalizedPath)) return new ARL(normalizedPath).absolute(normalizedPath);

			const arl = new ARL(normalizedPath);
			arl.url = this.makeFileUri(normalizedPath);
			return arl;
		}

		// relative path: resolve against the current uri
		if (!this.url) return null;

		const url = new URL(normalizedPath, this.url).toString();
		const arl = new ARL(absolute(normalizedPath, this.getPath()));
		arl.url = url;

		return arl;
	},

	// absolute native windows format (mainly from the documentation)
	nativeWindows(windowsPath) {

		const normalizedPath = normalizeSeparators(windowsPath);
		const arl = new ARL(normalizedPath);
		arl.url = this.makeFileUri(normalizedPath);
		return arl;
	},

	// two arl are equal if the url are equal
	equals(arl) {
		return !!(this.url && arl?.url && (this.url === arl.url));
	},

	// returns true if both files are in the same directory
	sameDir(arl) {

		if (!this.url || !arl.url) return false;

		const slash1 = this.url.lastIndexOf('/');
		const slash2 = arl.url.lastIndexOf('/');

		return this.url.slice(0,slash1) === arl.url.slice(0, slash2);
	},

	// returns a copy of this arl
	copy() {
		const arl = new ARL(this._locator);
		arl.url = this.url ? this.url.slice() : null;
		return arl;
	},

	// returns the full path of the vscode uri
	getFullPath() {
		if (this.url) {
			try {
				return normalizeSeparators(decodeURIComponent(new URL(this.url).pathname));
			}
			catch {}
		}
		return this._locator;
	},

	getPath() {
		return this._locator;
	},

	makeFileUri(filePath) {
		const normalizedPath = normalizeSeparators(filePath);
		const prefixed = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
		return 'file://' + encodeURI(prefixed);
	},

	async getMeta() {
		return requestVsCode('HTTP-STAT', {arl:this});
	},

	async getStamp() {
		const meta = await this.getMeta().catch(() => null);
		if (!meta) return null;

		const modified = meta.mtime ?? meta.modified ?? '';
		const size = meta.size ?? '';
		return (modified || size !== '') ? `modified:${modified}|size:${size}` : null;
	},

	// for get we use the access to the filesystem that we have at the vscode-side - therefore we send a message
	async get( as = 'text') {
		return requestVsCode('HTTP-GET', {arl:this, format: as});
	},

	async jsImport() {
	},


	async save(body) {
		// encode the string as a Utf8Array
		const encoder = new TextEncoder();
		const bodyAsBytes = encoder.encode(body);

		return requestVsCode('HTTP-POST', {arl:this, bytes: bodyAsBytes});
	}
};

var arlAdapter = /*#__PURE__*/Object.freeze({
  __proto__: null,
  adaptARL: adaptARL,
  promiseMap: promiseMap,
  requestVsCode: requestVsCode,
  vscode: vscode
});

// This function catches the console.log output in the webview part
// save the original console function
const consoleLog = console.log;

// and adapt it now
function adaptConsole() {

	// Overriding console.log to capture logs and send them to the extension
	console.log = function(...args) {

		// keeps the default behavior
		consoleLog.apply(console, args);

        // sanitize data is a recursive function - max depth avoids endless loops
        const maxDepth = 2;
        const visited = new WeakSet(); // Use a single WeakSet for all arguments

		// Sanitize each argument
		const sanitizedArgs = args.map(arg => sanitizeData(arg, maxDepth, visited));

		// Convert each argument to a string in a readable form
		const stringifiedArgs = sanitizedArgs.map(arg => {
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2); // Pretty print objects
				} catch (e) {
					return '[Unable to stringify]';
				}
			}
			return arg; // Non-objects are returned as is
		});
		
		// send the resulting string
		vscode.postMessage({ verb: 'console log', string: stringifiedArgs.join(' ')}); 
	};
}

// sanitize the data
function sanitizeData(data, depth, visited) {

    if (depth == 0) return '[Max depth]';

    if (data === null || data === undefined) return data; // Null or undefined can be cloned

    // Check if data is an object or an array, and prepare to iterate
    if (typeof data === 'object' || Array.isArray(data)) {

        // Detect circular references
        if (visited.has(data)) {
            return '[Circular]';
        }
        visited.add(data);

        // Initialize as array or object
        const newData = Array.isArray(data) ? [] : {}; 

        // Go through the data
        for (const key in data) {

            // Ensure the property belongs to the object and not its prototype
            if (Object.prototype.hasOwnProperty.call(data, key)) {

                if (typeof data[key] === 'function') {

                    // Functions can't be cloned => replacing with a descriptive string
                    newData[key] = `Function: ${data[key].name}`;

                } else {

                    // Recursively sanitize nested objects or arrays
                    newData[key] = sanitizeData(data[key], depth - 1, visited);
                }
            }
        }
        visited.delete(data); // Remove from visited to handle other branches correctly
        return newData;
    }

    // Directly return non-object, non-array types
    return data;
}

const LOGVSCODE = 0x1;

function emptySystem(name = 'System') {
    const now = new Date().toISOString();
    return {
        header: {
            version: SCHEMA_VERSION,
            name,
            created: now,
            saved: now,
            utc: now,
        },
        nodes: [],
        connections: [],
        references: [],
        view: {offset: {x: 0, y: 0}, zoom: 1},
    }
}

/** @node system message broker */
function SystemMessageBroker(tx) {
    this.tx = tx;
    this.activeArl = null;
    this.latestSnapshot = null;
    this.lastDocument = null;
    this.savePending = false;
    this.historyPending = false;
    this.resizing = 0;
    this.documentFlags = 0;

    adaptConsole();
    adaptARL();

    window.addEventListener('message', event => this.onMessage(event));
    window.addEventListener('keydown', event => this.interceptKeys(event), true);
    vscode.postMessage({verb: 'ready'});
}

SystemMessageBroker.prototype = {
    interceptKeys(event) {
        const modifier = event.ctrlKey || event.metaKey;
        if (modifier && !event.altKey && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            event.stopImmediatePropagation();
            vscode.postMessage({verb: event.shiftKey ? 'redo document' : 'undo document'});
            return
        }
        if (modifier && !event.altKey && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            event.stopImmediatePropagation();
            vscode.postMessage({verb: 'redo document'});
            return
        }

        if (['Delete', 'Enter', 'Escape'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
        }
    },

    makeArl(uri) {
        try {
            const url = new URL(uri);
            const arl = new ARL(normalizeSeparators(decodeURIComponent(url.pathname)));
            arl.url = uri;
            return arl
        }
        catch {
            const normalized = normalizeSeparators(uri);
            const arl = new ARL(normalized);
            arl.url = uri;
            return arl
        }
    },

    documentName(arl) {
        const split = getSplit(arl.getPath());
        return split.name.replace(/\.sys$/, '') || 'System'
    },

    setActiveDocument(arl, model) {
        this.activeArl = arl;
        this.latestSnapshot = null;
        this.lastDocument = null;
        this.tx.send('sysblu.set', {kind: 'sysblu', arl, model});
    },

    async onMessage(event) {
        const message = event.data;
        if (this.documentFlags & LOGVSCODE) console.log(`vscodex sysblu ~~~> [${message.verb}]`);

        switch (message.verb) {
            case 'open main': {
                const arl = this.makeArl(message.uri);
                this.setActiveDocument(arl);
                vscode.postMessage({verb: 'start system watcher', system: arl});
                return
            }

            case 'new main': {
                const arl = this.makeArl(message.uri);
                this.setActiveDocument(arl, emptySystem(this.documentName(arl)));
                return
            }

            case 'save request': {
                if (message.uri) {
                    const target = this.makeArl(message.uri);
                    const document = this.latestSnapshot?.document;
                    if (!document) {
                        vscode.postMessage({verb: 'file save failed', error: 'There is no system document to save.'});
                        return
                    }

                    const body = JSON.stringify(document, null, 2);
                    try {
                        await target.save(body);
                        vscode.postMessage({verb: 'file saved'});
                    }
                    catch (error) {
                        vscode.postMessage({verb: 'file save failed', error: error?.message ?? String(error)});
                    }
                    return
                }

                this.savePending = true;
                this.tx.send('sysblu.save');
                return
            }

            case 'visible':
                return

            case 'system changed':
                if (this.activeArl) this.setActiveDocument(this.activeArl);
                return

            case 'host undo':
                this.historyPending = true;
                this.tx.send('sysblu.undo');
                return

            case 'host redo':
                this.historyPending = true;
                this.tx.send('sysblu.redo');
                return

            case 'documentFlags':
                this.documentFlags = message.flags;
                return

            case '200':
            case '404': {
                const {promiseMap} = await Promise.resolve().then(function () { return arlAdapter; });
                const resolve = promiseMap.get(message.rqKey);
                if (!resolve) return
                resolve(message.content);
                promiseMap.delete(message.rqKey);
                return
            }

            default:
                console.log(`System message broker: "${message.verb}" is unknown`);
        }
    },

    onCanvas(canvas) {
        document.documentElement.className = 'dark common';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        document.body.append(canvas);
        canvas.focus();

        const resize = () => {
            if (this.resizing) return
            this.resizing = requestAnimationFrame(() => {
                this.resizing = 0;
                this.tx.send('size change', {
                    w: Math.round(window.innerWidth),
                    h: Math.round(window.innerHeight),
                    dpr: window.devicePixelRatio || 1,
                });
            });
        };

        window.addEventListener('resize', resize, {passive: true});
        resize();
    },

    onFloatingMenu(menu) {
        document.body.append(menu);
    },

    onSave() {
        vscode.postMessage({verb: 'save document'});
    },

    onModalDiv(modal) {
        document.body.append(modal);
    },

    onSystemUpdated(snapshot) {
        const serialized = snapshot?.document ? JSON.stringify(snapshot.document) : null;
        const changed = serialized !== null && this.lastDocument !== null && serialized !== this.lastDocument;

        this.latestSnapshot = snapshot;
        if (changed && snapshot.dirty && !this.historyPending) vscode.postMessage({verb: 'report edit', edit: 'Edit system'});
        this.historyPending = false;
        this.lastDocument = serialized;

        if (this.savePending && snapshot && !snapshot.dirty) {
            this.savePending = false;
            vscode.postMessage({verb: 'file saved'});
        }
    },

    onSysbluLoaded() {},

    onSysbluDiagnostics(diagnostics) {
        vscode.postMessage({verb: 'system diagnostics', diagnostics});
    },

    onSysbluFailed() {
        if (this.savePending) {
            this.savePending = false;
            vscode.postMessage({verb: 'file save failed', error: 'The system document could not be saved.'});
        }
    },

    onOpenReference(reference) {
        vscode.postMessage({verb: 'open reference', reference});
    },

    onExecuteCommand(request) {
        vscode.postMessage({verb: 'execute command', request});
    },
};

// Fixed visual language for the sysblu system editor.
//
// Unlike the model editor style, sysblu currently has one color scheme. Keep
// every authored drawing choice here so widgets and routes share one coherent
// visual language and a future theme does not require hunting through renderers.
const systemStyle = {
    canvas: {
        background: '#000000',
        emptyText: '#667085',
        emptyFont: '14px system-ui, sans-serif',
        emptyTextAlign: 'center',
        emptyTextBaseline: 'middle',
        outline: 'none',
        touchAction: 'none',
        cursorDefault: 'default',
        cursorMove: 'move',
        cursorGrab: 'grab',
        cursorGrabbing: 'grabbing',
        cursorReference: 'pointer',
    },
    application: {
        width: 290,
        headerHeight: 36,
        referenceRowHeight: 34,
        endpointRowHeight: 34,
        bottomPadding: 8,
        cornerRadius: 8,
        fill: '#8e8e8e',
        externalFill: '#8e8e8e',
        nodeColor: 'hsl(218, 70%, 34%)',
        externalNodeColor: 'hsl(0, 0%, 20%)',
        borderWidth: 2,
        selected: '#ff7700',
        selectedBorderWidth: 4,
        titleText: '#ffffff',
        titleFont: '600 14px system-ui, sans-serif',
        titleTextAlign: 'center',
        titleTextBaseline: 'middle',
        settingsSize: 24,
        settingsLeftPadding: 6,
        settingsGlyph: '\u2699',
        settingsText: '#ffffff',
        settingsFont: '17px system-ui, sans-serif',
        settingsTextAlign: 'center',
        settingsTextBaseline: 'middle',
        settingsTextOffsetY: 0.5,
        settingsTooltip: 'Edit application',
        addEndpointSize: 24,
        addEndpointRightPadding: 6,
        addEndpointGlyph: '+',
        addEndpointText: '#ffffff',
        addEndpointFont: '600 20px system-ui, sans-serif',
        addEndpointTextAlign: 'center',
        addEndpointTextBaseline: 'middle',
        addEndpointTextOffsetY: -0.5,
        addEndpointTooltip: 'Add endpoint',
        dividerWidth: 1.5
    },
    reference: {
        size: 24,
        gap: 6,
        leftPadding: 10,
        cornerRadius: 4,
        fill: '#76c8e6',
        border: '#000000',
        borderWidth: 1,
        text: '#000000',
        font: '600 9px system-ui, sans-serif',
        textAlign: 'center',
        textBaseline: 'middle',
        textOffsetY: 0,
        commandMarker: '#0037ff',
        commandMarkerRadius: 2,
        commandMarkerBottomPadding: 3,
    },
    endpoint: {
        radius: 6,
        hitRadius: 8,
        border: '#000000',
        borderWidth: 1,
        text: '#07090d',
        textFont: '12px system-ui, sans-serif',
        detailText: '#2d313b',
        detailFont: '10px system-ui, sans-serif',
        horizontalPadding: 12,
        nameOffsetY: 10,
        detailOffsetY: 23,
        textBaseline: 'middle',
        leftTextAlign: 'left',
        rightTextAlign: 'right',
        server: '#00ff80',
        client: '#ff8000',
        peer: '#8000ff',
        connectionTooltip: 'Drag to another endpoint to create a connection',
        settingsTooltip: 'Edit endpoint',
    },
    route: {
        normal: '#00ccff',
        selected: '#ff7700',
        broken: '#ff0019',
        width: 4,
        selectedWidth: 4,
        brokenDash: [6, 4],
        hitTolerance: 7,
        endpointStub: 24,
        bypassGap: 30,
        arrowLength: 15,
        arrowAngle: Math.PI / 6,
        labelBackground: '#1d2045',
        labelBorder: '#00ccff',
        labelBorderWidth: 1.5,
        labelCornerRadius: 6,
        labelFont: '12px system-ui, sans-serif',
        labelPaddingX: 8,
        labelHeight: 24,
        labelTextAlign: 'center',
        labelTextBaseline: 'middle',
        draft: '#ff7700',
        draftWidth: 2,
        draftDash: [6, 4],
    },
    text: {
        measureCharacterWidth: 7,
    },
};

function roundedRect(ctx, rect, radius) {
    const {x, y, w, h} = rect;
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function topRoundedRect(ctx, rect, radius) {
    const {x, y, w, h} = rect;
    const r = Math.min(radius, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function inside(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
}

function pointSegmentDistance(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y)
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

class SystemRoute {
    constructor(connection, widgets) {
        this.connection = connection;
        this.widgets = widgets;
        this.selected = false;
        this.broken = false;
        this.points = [];
        this.layout();
    }

    endpoint(end, fallbackSide) {
        const widget = this.widgets.get(end?.node);
        if (!widget) return null
        const endpoint = widget.endpoint(end?.endpoint);
        return {
            point: endpoint?.center() ?? widget.defaultConnectionPoint(fallbackSide),
            side: endpoint?.side ?? fallbackSide,
            widget,
        }
    }

    layout() {
        const start = this.endpoint(this.connection.from, 'right');
        const end = this.endpoint(this.connection.to, 'left');
        this.broken = !start || !end;
        if (this.broken) {
            this.points = [];
            return
        }

        if (this.connection.route?.length) {
            this.points = [start.point, ...this.connection.route.map(point => ({...point})), end.point];
            return
        }

        const startDirection = start.side === 'left' ? -1 : 1;
        const endDirection = end.side === 'left' ? -1 : 1;
        const style = systemStyle.route;
        const departure = {x: start.point.x + startDirection * style.endpointStub, y: start.point.y};
        const arrival = {x: end.point.x + endDirection * style.endpointStub, y: end.point.y};
        const startFacesAway = (end.point.x - start.point.x) * startDirection < 0;
        const endFacesAway = (start.point.x - end.point.x) * endDirection < 0;

        if (startFacesAway || endFacesAway) {
            const bypassY = Math.min(start.widget.rect.y, end.widget.rect.y) - style.bypassGap;
            this.points = [
                start.point,
                departure,
                {x: departure.x, y: bypassY},
                {x: arrival.x, y: bypassY},
                arrival,
                end.point,
            ];
            return
        }

        const middle = (departure.x + arrival.x) / 2;
        this.points = [
            start.point,
            departure,
            {x: middle, y: departure.y},
            {x: middle, y: arrival.y},
            arrival,
            end.point,
        ];
    }

    hit(point, tolerance = systemStyle.route.hitTolerance) {
        for (let index = 1; index < this.points.length; index += 1) {
            if (pointSegmentDistance(point, this.points[index - 1], this.points[index]) <= tolerance) return true
        }
        return false
    }

    labelRect(ctx) {
        const style = systemStyle.route;
        const point = this.points[Math.floor(this.points.length / 2)];
        const width = ctx.measureText(this.connection.transport ?? '').width + style.labelPaddingX * 2;
        return {
            x: point.x - width / 2,
            y: point.y - style.labelHeight / 2,
            w: width,
            h: style.labelHeight,
        }
    }

    render(ctx) {
        if (this.points.length < 2) return
        const style = systemStyle.route;
        const color = this.broken ? style.broken : this.selected ? style.selected : style.normal;
        ctx.strokeStyle = color;
        ctx.lineWidth = this.selected ? style.selectedWidth : style.width;
        ctx.setLineDash(this.broken ? style.brokenDash : []);
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (const point of this.points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const text = this.connection.transport ?? '';
        ctx.font = style.labelFont;
        const labelRect = this.labelRect(ctx);
        roundedRect(ctx, labelRect, style.labelCornerRadius);
        ctx.fillStyle = style.labelBackground;
        ctx.fill();
        ctx.strokeStyle = style.labelBorder;
        ctx.lineWidth = style.labelBorderWidth;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = style.labelTextAlign;
        ctx.textBaseline = style.labelTextBaseline;
        ctx.fillText(text, labelRect.x + labelRect.w / 2, labelRect.y + labelRect.h / 2);
    }
}

const endpointColors = {
    server: systemStyle.endpoint.server,
    client: systemStyle.endpoint.client,
    peer: systemStyle.endpoint.peer,
};

function protocolLabel(protocol) {
    const target = String(protocol ?? '').split(/[?#]/, 1)[0];
    const filename = target.split(/[\\/]/).at(-1) ?? '';
    if (/\.protocol\.json$/i.test(filename)) return filename.replace(/\.protocol\.json$/i, '')
    return filename.replace(/\.[^.]+$/, '')
}

class EndpointWidget {
    constructor(endpoint, row, nodeRect) {
        this.endpoint = endpoint;
        this.row = {...row};
        this.nodeRect = nodeRect;
        this.side = endpoint.role === 'server' ? 'left' : 'right';
    }

    center() {
        return {
            x: this.side === 'left' ? this.nodeRect.x : this.nodeRect.x + this.nodeRect.w,
            y: this.row.y + this.row.h / 2,
        }
    }

    hit(point) {
        return this.hitConnector(point) || this.hitRow(point)
    }

    hitConnector(point) {
        const center = this.center();
        return Math.hypot(point.x - center.x, point.y - center.y) <= systemStyle.endpoint.hitRadius
    }

    hitRow(point) {
        return inside(point, this.row)
    }

    render(ctx) {
        const style = systemStyle.endpoint;
        const center = this.center();
        const protocol = protocolLabel(this.endpoint.protocol);
        const name = this.endpoint.name || protocol;

        ctx.fillStyle = endpointColors[this.endpoint.role] ?? style.detailText;
        ctx.beginPath();
        ctx.arc(center.x, center.y, style.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = style.border;
        ctx.lineWidth = style.borderWidth;
        ctx.stroke();

        const left = this.side === 'left';
        ctx.textBaseline = style.textBaseline;
        ctx.textAlign = left ? style.leftTextAlign : style.rightTextAlign;
        ctx.fillStyle = style.text;
        ctx.font = style.textFont;
        ctx.fillText(name, left ? this.row.x + style.horizontalPadding : this.row.x + this.row.w - style.horizontalPadding, this.row.y + style.nameOffsetY);

        const detail = protocol;
        if (detail) {
            ctx.fillStyle = style.detailText;
            ctx.font = style.detailFont;
            ctx.fillText(detail, left ? this.row.x + style.horizontalPadding : this.row.x + this.row.w - style.horizontalPadding, this.row.y + style.detailOffsetY);
        }
    }
}

const labels = {
    documentation: 'DOC',
    model: 'APP',
    source: 'SRC',
    build: 'BLD',
    deployment: 'DEP',
    test: 'TST',
    operations: 'OPS',
    other: 'REF',
};

class ReferenceWidget {
    constructor(reference, rect) {
        this.reference = reference;
        this.rect = {...rect};
        this.label = labels[reference.kind] ?? labels.other;
    }

    hit(point) {
        return inside(point, this.rect)
    }

    tooltip() {
        const label = this.reference.label || this.reference.description || this.reference.target || this.reference.kind;
        return this.hasCommand() ? `${label} — Ctrl/Cmd+click: ${this.reference.command}` : label
    }

    hasCommand() {
        return Boolean(this.reference.command && this.reference.workingDirectory)
    }

    render(ctx) {
        const style = systemStyle.reference;
        roundedRect(ctx, this.rect, style.cornerRadius);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.strokeStyle = style.border;
        ctx.lineWidth = style.borderWidth;
        ctx.stroke();
        ctx.fillStyle = style.text;
        ctx.font = style.font;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = style.textBaseline;
        ctx.fillText(this.label, this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2 + style.textOffsetY);

        if (this.hasCommand()) {
            ctx.fillStyle = style.commandMarker;
            ctx.beginPath();
            ctx.arc(
                this.rect.x + this.rect.w / 2,
                this.rect.y + this.rect.h - style.commandMarkerBottomPadding - style.commandMarkerRadius,
                style.commandMarkerRadius,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
    }
}

function nodeReferences(node) {
    return node.references ?? []
}

class ApplicationWidget {
    constructor(node) {
        this.node = node;
        this.selected = false;
        this.references = [];
        this.endpoints = [];
        this.layout();
    }

    layout() {
        const style = systemStyle.application;
        const referenceStyle = systemStyle.reference;
        const width = this.node.size?.width ?? style.width;
        const endpointCount = this.node.endpoints?.length ?? 0;
        const calculatedHeight = style.headerHeight + style.referenceRowHeight + endpointCount * style.endpointRowHeight + style.bottomPadding;
        const height = Math.max(this.node.size?.height ?? 0, calculatedHeight);
        this.rect = {x: this.node.position.x, y: this.node.position.y, w: width, h: height};
        this.headerRect = {x: this.rect.x, y: this.rect.y, w: width, h: style.headerHeight};
        this.settingsRect = {
            x: this.headerRect.x + style.settingsLeftPadding,
            y: this.headerRect.y + (style.headerHeight - style.settingsSize) / 2,
            w: style.settingsSize,
            h: style.settingsSize,
        };
        this.addEndpointRect = {
            x: this.headerRect.x + this.headerRect.w - style.addEndpointRightPadding - style.addEndpointSize,
            y: this.headerRect.y + (style.headerHeight - style.addEndpointSize) / 2,
            w: style.addEndpointSize,
            h: style.addEndpointSize,
        };
        this.actionRect = {x: this.rect.x, y: this.rect.y + style.headerHeight, w: width, h: style.referenceRowHeight};

        this.references = nodeReferences(this.node).map((reference, index) => new ReferenceWidget(reference, {
            x: this.rect.x + referenceStyle.leftPadding + index * (referenceStyle.size + referenceStyle.gap),
            y: this.actionRect.y + (style.referenceRowHeight - referenceStyle.size) / 2,
            w: referenceStyle.size,
            h: referenceStyle.size,
        }));

        this.endpoints = (this.node.endpoints ?? []).map((endpoint, index) => new EndpointWidget(endpoint, {
            x: this.rect.x,
            y: this.actionRect.y + style.referenceRowHeight + index * style.endpointRowHeight,
            w: width,
            h: style.endpointRowHeight,
        }, this.rect));
    }

    setPosition(position) {
        this.node.position = {x: position.x, y: position.y};
        this.layout();
    }

    hit(point) {
        return inside(point, this.rect)
    }

    hitHeader(point) {
        return inside(point, this.headerRect)
    }

    hitSettings(point) {
        return inside(point, this.settingsRect)
    }

    hitAddEndpoint(point) {
        return inside(point, this.addEndpointRect)
    }

    referenceAt(point) {
        return this.references.find(reference => reference.hit(point)) ?? null
    }

    endpoint(id) {
        return this.endpoints.find(endpoint => endpoint.endpoint.id === id) ?? null
    }

    endpointAt(point) {
        return this.endpoints.find(endpoint => endpoint.hit(point)) ?? null
    }

    defaultConnectionPoint(side) {
        return {
            x: side === 'left' ? this.rect.x : this.rect.x + this.rect.w,
            y: this.rect.y + this.rect.h / 2,
        }
    }

    render(ctx) {
        const style = systemStyle.application;
        const nodeColor = this.node.vmblu ? style.nodeColor : style.externalNodeColor;
        roundedRect(ctx, this.rect, style.cornerRadius);
        ctx.fillStyle = this.node.vmblu ? style.fill : style.externalFill;
        ctx.fill();
        ctx.strokeStyle = this.selected ? style.selected : nodeColor;
        ctx.lineWidth = this.selected ? style.selectedBorderWidth : style.borderWidth;
        ctx.stroke();

        topRoundedRect(ctx, this.headerRect, style.cornerRadius);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        ctx.fillStyle = style.titleText;
        ctx.font = style.titleFont;
        ctx.textAlign = style.titleTextAlign;
        ctx.textBaseline = style.titleTextBaseline;
        ctx.fillText(this.node.name, this.headerRect.x + this.headerRect.w / 2, this.headerRect.y + this.headerRect.h / 2);

        ctx.fillStyle = style.settingsText;
        ctx.font = style.settingsFont;
        ctx.textAlign = style.settingsTextAlign;
        ctx.textBaseline = style.settingsTextBaseline;
        ctx.fillText(style.settingsGlyph, this.settingsRect.x + this.settingsRect.w / 2, this.settingsRect.y + this.settingsRect.h / 2 + style.settingsTextOffsetY);


        ctx.fillStyle = style.addEndpointText;
        ctx.font = style.addEndpointFont;
        ctx.textAlign = style.addEndpointTextAlign;
        ctx.textBaseline = style.addEndpointTextBaseline;
        ctx.fillText(
            style.addEndpointGlyph,
            this.addEndpointRect.x + this.addEndpointRect.w / 2,
            this.addEndpointRect.y + this.addEndpointRect.h / 2 + style.addEndpointTextOffsetY,
        );

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = style.dividerWidth;
        ctx.beginPath();
        ctx.moveTo(this.actionRect.x, this.actionRect.y + this.actionRect.h);
        ctx.lineTo(this.actionRect.x + this.actionRect.w, this.actionRect.y + this.actionRect.h);
        ctx.stroke();

        for (const reference of this.references) reference.render(ctx);
        for (const endpoint of this.endpoints) endpoint.render(ctx);
    }
}

function nullContext() {
    const noop = () => {};
    return new Proxy({measureText: text => ({width: String(text ?? '').length * systemStyle.text.measureCharacterWidth})}, {
        get(target, property) {
            return property in target ? target[property] : noop
        },
        set(target, property, value) {
            target[property] = value;
            return true
        },
    })
}

function nullCanvas() {
    return {
        width: 0,
        height: 0,
        style: {},
        title: '',
        addEventListener() {},
        setAttribute() {},
        focus() {},
        getBoundingClientRect: () => ({left: 0, top: 0}),
        getContext: () => nullContext(),
    }
}

/**
 * @node sysblu view
 */
function SysbluView(tx, sx = {}) {
    this.tx = tx;
    this.sx = sx;
    const documentRef = sx?.document ?? globalThis.document;
    this.canvas = sx?.canvas ?? documentRef?.createElement?.('canvas') ?? nullCanvas();
    this.ctx = this.canvas.getContext?.('2d') ?? nullContext();
    this.document = null;
    this.arl = null;
    this.widgets = new Map();
    this.routes = [];
    this.selection = null;
    this.drag = null;
    this.pan = null;
    this.spacePressed = false;
    this.connectionDrag = null;
    this.pendingReference = null;
    this.pendingSelection = null;
    this.transform = {x: 0, y: 0, zoom: 1};
    this.size = {w: 0, h: 0, dpr: 1};
    this.waitingForFrame = false;

    this.setupCanvas();
    this.addEventHandlers();
}

SysbluView.prototype = {
    setupCanvas() {
        this.canvas.setAttribute?.('tabindex', '0');
        this.canvas.setAttribute?.('role', 'application');
        this.canvas.setAttribute?.('aria-label', 'System architecture diagram');
        this.canvas.style.outline = systemStyle.canvas.outline;
        this.canvas.style.touchAction = systemStyle.canvas.touchAction;
    },

    addEventHandlers() {
        this.canvas.addEventListener?.('pointerdown', event => this.pointerDown(event));
        this.canvas.addEventListener?.('pointermove', event => this.pointerMove(event));
        this.canvas.addEventListener?.('pointerup', event => this.pointerUp(event));
        this.canvas.addEventListener?.('pointercancel', () => this.cancelPointer());
        this.canvas.addEventListener?.('wheel', event => this.wheel(event), {passive: false});
        this.canvas.addEventListener?.('keydown', event => this.keydown(event));
        this.canvas.addEventListener?.('keyup', event => this.keyup(event));
    },

    /** @param {SystemSnapshot} snapshot */
    onSystemUpdated(snapshot) {
        const isSnapshot = snapshot && Object.hasOwn(snapshot, 'document');
        this.document = isSnapshot ? snapshot.document : snapshot ?? null;
        this.arl = isSnapshot ? snapshot.arl ?? null : null;
        this.transform = {
            x: this.document?.view?.offset?.x ?? this.transform.x,
            y: this.document?.view?.offset?.y ?? this.transform.y,
            zoom: this.document?.view?.zoom ?? this.transform.zoom,
        };
        this.rebuild();
        this.redraw();
        if (this.document) this.tx.send('canvas', this.canvas);
    },

    onSysmodDone(result) {
        if (result?.error) this.pendingSelection = null;
        this.redraw();
    },

    /** @param {ViewSize} size */
    onSizeChange(size) {
        if (!size || !Number.isFinite(size.w) || !Number.isFinite(size.h)) return
        const dpr = size.dpr ?? globalThis.devicePixelRatio ?? 1;
        this.size = {w: size.w, h: size.h, dpr};
        this.canvas.width = Math.round(size.w * dpr);
        this.canvas.height = Math.round(size.h * dpr);
        this.canvas.style.width = `${size.w}px`;
        this.canvas.style.height = `${size.h}px`;
        this.ctx = this.canvas.getContext?.('2d') ?? this.ctx;
        this.redraw();
    },

    rebuild() {
        const selected = this.selection;
        this.widgets = new Map((this.document?.nodes ?? []).map(node => [node.id, new ApplicationWidget(node)]));
        this.routes = (this.document?.connections ?? []).map(connection => new SystemRoute(connection, this.widgets));
        const pending = this.pendingSelection;
        this.selection = pending && this.findSelectable(pending.kind, pending.id)
            ? pending
            : selected && this.findSelectable(selected.kind, selected.id)
                ? selected
                : null;
        if (pending && this.selection === pending) this.pendingSelection = null;
        this.applySelection();
    },

    rebuildRoutes() {
        for (const route of this.routes) route.layout();
    },

    findSelectable(kind, id) {
        return kind === 'node'
            ? this.widgets.get(id)
            : kind === 'connection'
                ? this.routes.find(route => route.connection.id === id)
                : null
    },

    select(kind, id) {
        this.selection = kind && id ? {kind, id} : null;
        this.applySelection();
        this.redraw();
    },

    focusCanvasAfterInspector() {
        const schedule = globalThis.queueMicrotask ?? (callback => Promise.resolve().then(callback));
        schedule(() => this.canvas.focus?.());
    },

    popupPosition(event = {}) {
        const canvasRect = this.canvas.getBoundingClientRect?.() ?? {left: 0, top: 0};
        const point = this.eventPoint(event);
        return {
            x: Number.isFinite(event.clientX) ? event.clientX : canvasRect.left + point.x,
            y: Number.isFinite(event.clientY) ? event.clientY : canvasRect.top + point.y,
        }
    },

    openApplicationInspector(widget, event = {}) {
        if (widget?.node?.kind !== 'application') return
        const pos = this.popupPosition(event);
        const application = JSON.parse(JSON.stringify(widget.node));

        this.tx.send('application settings', {
            title: 'Application',
            pos,
            application,
            ok: changes => {
                this.tx.send('sysmod.doit', {
                    verb: 'editApplication',
                    param: {id: application.id, ...changes},
                });
                this.focusCanvasAfterInspector();
            },
            cancel: () => this.focusCanvasAfterInspector(),
            trash: () => {
                this.tx.send('sysmod.doit', {
                    verb: 'deleteApplication',
                    param: {id: application.id},
                });
                this.focusCanvasAfterInspector();
            },
        });
    },

    openEndpointInspector(widget, endpointWidget = null, event = {}) {
        if (!widget?.node) return
        const endpoint = endpointWidget ? JSON.parse(JSON.stringify(endpointWidget.endpoint)) : {};
        const existing = Boolean(endpoint.id);
        this.tx.send('endpoint settings', {
            title: 'Endpoint',
            pos: this.popupPosition(event),
            endpoint,
            endpointIds: widget.endpoints.map(candidate => candidate.endpoint.id),
            open: target => this.activateReference({target}),
            ok: changes => {
                this.tx.send('sysmod.doit', {
                    verb: existing ? 'editEndpoint' : 'addEndpoint',
                    param: existing
                        ? {nodeId: widget.node.id, id: endpoint.id, endpoint: changes}
                        : {nodeId: widget.node.id, endpoint: changes},
                });
                this.focusCanvasAfterInspector();
            },
            cancel: () => this.focusCanvasAfterInspector(),
            ...(existing ? {
                trash: () => {
                    this.tx.send('sysmod.doit', {
                        verb: 'deleteEndpoint',
                        param: {nodeId: widget.node.id, id: endpoint.id},
                    });
                    this.focusCanvasAfterInspector();
                },
            } : {}),
        });
    },

    endpointLabel(binding) {
        return `${binding.widget.node.name}: ${binding.endpoint.endpoint.name}`
    },

    uniqueConnectionId(connection) {
        const seed = [
            connection?.from?.node,
            connection?.from?.endpoint,
            connection?.to?.node,
            connection?.to?.endpoint,
            connection?.transport,
        ].filter(Boolean).join('-');
        const base = String(seed)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'connection';
        const ids = new Set((this.document?.connections ?? []).map(connection => connection.id));
        let id = base;
        let suffix = 2;
        while (ids.has(id)) id = `${base}-${suffix++}`;
        return id
    },

    openConnectionInspector(connection, event = {}, bindings = {}) {
        const existing = Boolean(connection.id);
        const snapshot = JSON.parse(JSON.stringify(connection));
        this.tx.send('connection settings', {
            title: 'Transport',
            pos: this.popupPosition(event),
            connection: snapshot,
            fromLabel: bindings.fromLabel ?? this.connectionEndLabel(connection.from),
            toLabel: bindings.toLabel ?? this.connectionEndLabel(connection.to),
            ok: changes => {
                if (existing) {
                    this.tx.send('sysmod.doit', {
                        verb: 'editConnection',
                        param: {id: connection.id, ...changes},
                    });
                }
                else {
                    const id = this.uniqueConnectionId(changes);
                    this.pendingSelection = {kind: 'connection', id};
                    this.tx.send('sysmod.doit', {
                        verb: 'addConnection',
                        param: {connection: {id, ...changes}},
                    });
                }
                this.focusCanvasAfterInspector();
            },
            cancel: () => this.focusCanvasAfterInspector(),
            ...(existing ? {
                trash: () => {
                    this.tx.send('sysmod.doit', {
                        verb: 'deleteConnection',
                        param: {id: connection.id},
                    });
                    this.focusCanvasAfterInspector();
                },
            } : {}),
        });
    },

    connectionEndLabel(end) {
        const widget = this.widgets.get(end?.node);
        const endpoint = widget?.endpoint(end?.endpoint);
        return widget && endpoint ? this.endpointLabel({widget, endpoint}) : `${end?.node ?? '?'}: ${end?.endpoint ?? '?'}`
    },

    beginConnection(widget, endpoint, event) {
        const point = this.worldPoint(event);
        this.connectionDrag = {widget, endpoint, point};
        this.canvas.setPointerCapture?.(event.pointerId);
        this.redraw();
    },

    completeConnection(targetWidget, targetEndpoint, event) {
        const source = this.connectionDrag;
        if (!source || !targetWidget || !targetEndpoint) return
        if (source.widget.node.id === targetWidget.node.id && source.endpoint.endpoint.id === targetEndpoint.endpoint.id) return

        const from = {node: source.widget.node.id, endpoint: source.endpoint.endpoint.id};
        const to = {node: targetWidget.node.id, endpoint: targetEndpoint.endpoint.id};
        const connection = {
            from,
            to,
            transport: 'unspecified',
        };
        this.openConnectionInspector(connection, event, {
            fromLabel: this.endpointLabel(source),
            toLabel: this.endpointLabel({widget: targetWidget, endpoint: targetEndpoint}),
        });
    },

    uniqueApplicationId(name) {
        const base = String(name ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'application';
        let id = base;
        let suffix = 2;
        while (this.widgets.has(id)) id = `${base}-${suffix++}`;
        return id
    },

    newApplicationPosition() {
        const style = systemStyle.application;
        const stagger = (this.document?.nodes?.length ?? 0) * 16;
        return {
            x: ((this.size.w || 600) / 2 - this.transform.x) / this.transform.zoom - style.width / 2 + stagger,
            y: ((this.size.h || 400) / 2 - this.transform.y) / this.transform.zoom - style.headerHeight + stagger,
        }
    },

    onAddApplication(event = {}) {
        if (!this.document) return
        const pos = {
            x: Number.isFinite(event.clientX) ? event.clientX : 48,
            y: Number.isFinite(event.clientY) ? event.clientY : 48,
        };
        const position = this.newApplicationPosition();

        this.tx.send('application settings', {
            title: 'Application',
            pos,
            application: {name: '', description: '', vmblu: true, references: []},
            ok: changes => {
                const id = this.uniqueApplicationId(changes.name);
                this.pendingSelection = {kind: 'node', id};
                this.tx.send('sysmod.doit', {
                    verb: 'addApplication',
                    param: {
                        application: {
                            id,
                            kind: 'application',
                            name: changes.name,
                            vmblu: changes.vmblu,
                            ...(changes.role ? {description: changes.role} : {}),
                            position,
                            references: changes.references,
                            endpoints: [],
                        },
                    },
                });
                this.focusCanvasAfterInspector();
            },
            cancel: () => this.focusCanvasAfterInspector(),
        });
    },

    applySelection() {
        for (const widget of this.widgets.values()) widget.selected = this.selection?.kind === 'node' && this.selection.id === widget.node.id;
        for (const route of this.routes) route.selected = this.selection?.kind === 'connection' && this.selection.id === route.connection.id;
    },

    eventPoint(event) {
        if (Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) return {x: event.offsetX, y: event.offsetY}
        const rect = this.canvas.getBoundingClientRect?.() ?? {left: 0, top: 0};
        return {x: event.clientX - rect.left, y: event.clientY - rect.top}
    },

    worldPoint(event) {
        const point = this.eventPoint(event);
        return {
            x: (point.x - this.transform.x) / this.transform.zoom,
            y: (point.y - this.transform.y) / this.transform.zoom,
        }
    },

    widgetAt(point) {
        return [...this.widgets.values()].reverse().find(widget => widget.hit(point)) ?? null
    },

    routeAt(point) {
        return [...this.routes].reverse().find(route => route.hit(point, systemStyle.route.hitTolerance / this.transform.zoom)) ?? null
    },

    pointerDown(event) {
        const isLeftButton = event.button == null || event.button === 0;
        const isMiddleButton = event.button === 1;
        if (!isLeftButton && !isMiddleButton) return
        this.canvas.focus?.();
        event.preventDefault?.();

        if (isMiddleButton || this.spacePressed) {
            this.beginPan(event);
            return
        }

        const point = this.worldPoint(event);
        const widget = this.widgetAt(point);

        if (widget) {
            const reference = widget.referenceAt(point);
            if (reference) {
                this.pendingReference = reference;
                return
            }

            this.select('node', widget.node.id);
            if (widget.hitSettings(point)) {
                this.openApplicationInspector(widget, event);
                return
            }
            if (widget.hitAddEndpoint(point)) {
                this.openEndpointInspector(widget, null, event);
                return
            }
            const endpoint = widget.endpointAt(point);
            if (endpoint?.hitConnector(point)) {
                this.beginConnection(widget, endpoint, event);
                return
            }
            if (endpoint) {
                this.openEndpointInspector(widget, endpoint, event);
                return
            }
            if (widget.hitHeader(point)) {
                this.drag = {
                    widget,
                    start: point,
                    origin: {...widget.node.position},
                    moved: false,
                };
                this.canvas.setPointerCapture?.(event.pointerId);
            }
            return
        }

        const route = this.routeAt(point);
        if (route) {
            this.select('connection', route.connection.id);
            this.openConnectionInspector(route.connection, event);
        }
        else {
            this.select(null, null);
            this.beginPan(event);
        }
    },

    pointerMove(event) {
        if (this.pan) {
            const point = this.eventPoint(event);
            this.transform.x = this.pan.origin.x + point.x - this.pan.start.x;
            this.transform.y = this.pan.origin.y + point.y - this.pan.start.y;
            this.redraw();
            return
        }

        const point = this.worldPoint(event);
        if (this.connectionDrag) {
            this.connectionDrag.point = point;
            this.redraw();
            return
        }
        if (this.drag) {
            const position = {
                x: this.drag.origin.x + point.x - this.drag.start.x,
                y: this.drag.origin.y + point.y - this.drag.start.y,
            };
            this.drag.moved ||= position.x !== this.drag.origin.x || position.y !== this.drag.origin.y;
            this.drag.widget.setPosition(position);
            this.rebuildRoutes();
            this.redraw();
            return
        }

        const widget = this.widgetAt(point);
        const reference = widget?.referenceAt(point);
        const settings = widget?.hitSettings(point);
        const addEndpoint = widget?.hitAddEndpoint(point);
        const endpoint = widget?.endpointAt(point);
        this.canvas.title = reference?.tooltip()
            || (settings ? systemStyle.application.settingsTooltip : '')
            || (addEndpoint ? systemStyle.application.addEndpointTooltip : '')
            || (endpoint?.hitConnector(point) ? systemStyle.endpoint.connectionTooltip : '')
            || (endpoint ? systemStyle.endpoint.settingsTooltip : '');
        this.canvas.style.cursor = reference || settings || addEndpoint || endpoint
            ? systemStyle.canvas.cursorReference
            : widget?.hitHeader(point)
                ? systemStyle.canvas.cursorMove
                : systemStyle.canvas.cursorDefault;
    },

    pointerUp(event) {
        if (this.pan) {
            this.pan = null;
            this.canvas.releasePointerCapture?.(event.pointerId);
            this.canvas.style.cursor = this.spacePressed
                ? systemStyle.canvas.cursorGrab
                : systemStyle.canvas.cursorDefault;
            return
        }

        const point = this.worldPoint(event);
        if (this.pendingReference) {
            const reference = this.pendingReference;
            this.pendingReference = null;
            if (reference.hit(point)) this.activateReference(reference.reference, event);
        }

        if (this.connectionDrag) {
            const targetWidget = this.widgetAt(point);
            const targetEndpoint = targetWidget?.endpointAt(point);
            const source = this.connectionDrag;
            this.connectionDrag = null;
            this.canvas.releasePointerCapture?.(event.pointerId);
            if (targetEndpoint) {
                this.connectionDrag = source;
                this.completeConnection(targetWidget, targetEndpoint, event);
                this.connectionDrag = null;
            }
            this.redraw();
            return
        }

        if (!this.drag) return
        const drag = this.drag;
        this.drag = null;
        this.canvas.releasePointerCapture?.(event.pointerId);
        if (!drag.moved) return
        this.tx.send('sysmod.doit', {
            verb: 'moveNode',
            param: {
                id: drag.widget.node.id,
                position: {...drag.widget.node.position},
            },
        });
    },

    cancelPointer() {
        if (this.pan) {
            this.transform.x = this.pan.origin.x;
            this.transform.y = this.pan.origin.y;
        }
        if (this.drag) {
            this.drag.widget.setPosition(this.drag.origin);
            this.rebuildRoutes();
        }
        this.pan = null;
        this.drag = null;
        this.connectionDrag = null;
        this.pendingReference = null;
        this.canvas.style.cursor = this.spacePressed
            ? systemStyle.canvas.cursorGrab
            : systemStyle.canvas.cursorDefault;
        this.redraw();
    },

    beginPan(event) {
        const point = this.eventPoint(event);
        this.pan = {
            start: point,
            origin: {x: this.transform.x, y: this.transform.y},
        };
        this.canvas.setPointerCapture?.(event.pointerId);
        this.canvas.style.cursor = systemStyle.canvas.cursorGrabbing;
    },

    activateReference(reference, event = {}) {
        if ((event.ctrlKey || event.metaKey) && reference?.command && reference?.workingDirectory) {
            const workingDirectory = this.arl?.resolve?.(reference.workingDirectory) ?? reference.workingDirectory;
            this.tx.send('execute command', {
                command: reference.command,
                workingDirectory,
            });
            return
        }
        if (!reference?.target) return
        if (/^https?:\/\//i.test(reference.target)) {
            this.tx.send('open reference', {externalUrl: reference.target});
            return
        }
        const target = this.arl?.resolve?.(reference.target) ?? reference.target;
        this.tx.send('open reference', target);
    },

    onApplicationPrompt() {
        const reference = this.document?.references?.find(candidate => candidate.kind === 'prompt');
        this.activateReference(reference);
    },

    wheel(event) {
        event.preventDefault?.();
        const point = this.eventPoint(event);
        const world = {
            x: (point.x - this.transform.x) / this.transform.zoom,
            y: (point.y - this.transform.y) / this.transform.zoom,
        };
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        const zoom = Math.max(0.25, Math.min(4, this.transform.zoom * factor));
        this.transform.x = point.x - world.x * zoom;
        this.transform.y = point.y - world.y * zoom;
        this.transform.zoom = zoom;
        this.redraw();
    },

    keydown(event) {
        if (event.code === 'Space' || event.key === ' ') {
            this.spacePressed = true;
            if (!this.pan) this.canvas.style.cursor = systemStyle.canvas.cursorGrab;
            event.preventDefault?.();
            return
        }

        if (!(event.ctrlKey || event.metaKey)) return
        const key = event.key?.toLowerCase();
        if (key === 'z' && event.shiftKey) this.tx.send('sysmod.redo');
        else if (key === 'z') this.tx.send('sysmod.undo');
        else if (key === 'y') this.tx.send('sysmod.redo');
        else return
        event.preventDefault?.();
        event.stopPropagation?.();
    },

    keyup(event) {
        if (event.code !== 'Space' && event.key !== ' ') return
        this.spacePressed = false;
        if (!this.pan) this.canvas.style.cursor = systemStyle.canvas.cursorDefault;
        event.preventDefault?.();
    },

    redraw() {
        if (this.waitingForFrame) return
        this.waitingForFrame = true;
        const requestFrame = globalThis.requestAnimationFrame ?? (callback => callback());
        requestFrame(() => {
            this.waitingForFrame = false;
            this.render();
        });
    },

    render() {
        const ctx = this.ctx;
        const {w, h, dpr} = this.size;
        ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = systemStyle.canvas.background;
        ctx.fillRect(0, 0, w || this.canvas.width, h || this.canvas.height);
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.zoom, this.transform.zoom);

        for (const route of this.routes) route.render(ctx);
        if (this.connectionDrag) {
            const style = systemStyle.route;
            const start = this.connectionDrag.endpoint.center();
            ctx.strokeStyle = style.draft;
            ctx.lineWidth = style.draftWidth;
            ctx.setLineDash(style.draftDash);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(this.connectionDrag.point.x, this.connectionDrag.point.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        for (const widget of this.widgets.values()) widget.render(ctx);

        if (!this.document) {
            ctx.fillStyle = systemStyle.canvas.emptyText;
            ctx.font = systemStyle.canvas.emptyFont;
            ctx.textAlign = systemStyle.canvas.emptyTextAlign;
            ctx.textBaseline = systemStyle.canvas.emptyTextBaseline;
            ctx.fillText('Select a system file to begin', (w || 400) / 2, (h || 240) / 2);
        }
    },
};

function cloneSystemDocument(document) {
    if (document == null) return null
    return JSON.parse(JSON.stringify(document))
}

function validateSystemDocument(document) {
    const errors = [];

    const validateReference = (reference, owner) => {
        if (typeof reference?.kind !== 'string' || !reference.kind) errors.push(`A reference on ${owner} needs a kind.`);
        if (typeof reference?.target !== 'string' || !reference.target) errors.push(`A reference on ${owner} needs a target.`);
        const hasCommand = Object.hasOwn(reference ?? {}, 'command');
        const hasWorkingDirectory = Object.hasOwn(reference ?? {}, 'workingDirectory');
        if (hasCommand && (typeof reference.command !== 'string' || !reference.command.trim())) {
            errors.push(`A command reference on ${owner} needs a non-empty command.`);
        }
        if (hasWorkingDirectory && (typeof reference.workingDirectory !== 'string' || !reference.workingDirectory.trim())) {
            errors.push(`A command reference on ${owner} needs a non-empty workingDirectory.`);
        }
        if (hasCommand !== hasWorkingDirectory) {
            errors.push(`A command reference on ${owner} needs both command and workingDirectory.`);
        }
    };

    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        return {ok: false, errors: ['The system document must be an object.']}
    }

    if (!document.header || typeof document.header !== 'object') errors.push('Missing system header.');
    if (document.header?.version !== SCHEMA_VERSION) {
        errors.push(`The system document must use schema version ${SCHEMA_VERSION}.`);
    }
    if (typeof document.header?.name !== 'string' || !document.header.name.trim()) errors.push('The system header needs a name.');
    if (!Array.isArray(document.nodes)) errors.push('The system document needs a nodes array.');
    if (!Array.isArray(document.connections)) errors.push('The system document needs a connections array.');

    const nodeIds = new Set();
    const endpointsByNode = new Map();
    for (const node of Array.isArray(document.nodes) ? document.nodes : []) {
        if (!node || typeof node !== 'object') {
            errors.push('Every system node must be an object.');
            continue
        }
        if (typeof node.id !== 'string' || !node.id) errors.push('Every system node needs an id.');
        else if (nodeIds.has(node.id)) errors.push(`Duplicate system node id: ${node.id}.`);
        else nodeIds.add(node.id);

        if (node.kind !== 'application') errors.push(`Unknown node kind for ${node.id ?? '<unknown>'}.`);
        if (typeof node.name !== 'string' || !node.name.trim()) errors.push(`System node ${node.id ?? '<unknown>'} needs a name.`);
        if (typeof node.vmblu !== 'boolean') errors.push(`Application ${node.id ?? '<unknown>'} needs a vmblu flag.`);
        for (const reference of Array.isArray(node.references) ? node.references : []) {
            validateReference(reference, node.id ?? '<unknown>');
        }
        if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
            errors.push(`Node ${node.id ?? '<unknown>'} needs a finite position.`);
        }

        const endpoints = new Map();
        for (const endpoint of Array.isArray(node.endpoints) ? node.endpoints : []) {
            if (typeof endpoint?.id !== 'string' || !endpoint.id) errors.push(`An endpoint on ${node.id ?? '<unknown>'} needs an id.`);
            else if (endpoints.has(endpoint.id)) errors.push(`Duplicate endpoint id ${endpoint.id} on ${node.id}.`);
            else endpoints.set(endpoint.id, endpoint);
            if (typeof endpoint?.name !== 'string' || !endpoint.name) errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} needs a name.`);
            if (!['client', 'server', 'peer'].includes(endpoint?.role)) {
                errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} has an invalid role.`);
            }
            if (Object.hasOwn(endpoint ?? {}, 'protocol') && (typeof endpoint.protocol !== 'string' || !endpoint.protocol.trim())) {
                errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} has an invalid protocol definition.`);
            }
            if (Object.hasOwn(endpoint ?? {}, 'references')) errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} cannot own references.`);
        }
        if (node.id) endpointsByNode.set(node.id, endpoints);
    }

    const connectionIds = new Set();
    for (const connection of Array.isArray(document.connections) ? document.connections : []) {
        if (typeof connection?.id !== 'string' || !connection.id) errors.push('Every connection needs an id.');
        else if (connectionIds.has(connection.id)) errors.push(`Duplicate connection id: ${connection.id}.`);
        else connectionIds.add(connection.id);
        if (typeof connection?.transport !== 'string' || !connection.transport) {
            errors.push(`Connection ${connection?.id ?? '<unknown>'} has an invalid transport.`);
        }
        for (const reference of Array.isArray(connection?.references) ? connection.references : []) {
            validateReference(reference, `connection ${connection?.id ?? '<unknown>'}`);
        }

        for (const end of ['from', 'to']) {
            const nodeId = connection?.[end]?.node;
            if (typeof nodeId !== 'string' || !nodeIds.has(nodeId)) {
                errors.push(`Connection ${connection?.id ?? '<unknown>'} has an unknown ${end} node.`);
            }
            const endpointId = connection?.[end]?.endpoint;
            if (endpointId && !endpointsByNode.get(nodeId)?.has(endpointId)) {
                errors.push(`Connection ${connection?.id ?? '<unknown>'} has an unknown ${end} endpoint.`);
            }
        }
    }

    for (const reference of Array.isArray(document.references) ? document.references : []) {
        validateReference(reference, 'the system');
    }

    return {ok: errors.length === 0, errors}
}

function documentFromActive(active) {
    if (!active) return null
    if (active.document) return active.document
    if (active.raw) return active.raw
    if (active.model?.raw) return active.model.raw
    if (active.model?.header && active.model?.nodes && active.model?.connections) return active.model
    if (active.header && active.nodes && active.connections) return active
    return null
}

function arlFromActive(active) {
    return active?.arl ?? active?.model?.getArl?.() ?? active?.model?.arl ?? null
}

function systemNode(document, id) {
    const node = document?.nodes?.find(candidate => candidate.id === id);
    if (!node) throw new Error(`Unknown system node: ${id ?? '<missing>'}.`)
    return node
}

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : value
}

function cleanReferences(references) {
    if (!Array.isArray(references)) return references
    return references.map(reference => {
        const next = {
            ...reference,
            kind: cleanText(reference?.kind),
            label: cleanText(reference?.label),
            target: cleanText(reference?.target),
        };
        const command = cleanText(reference?.command);
        const workingDirectory = cleanText(reference?.workingDirectory);
        if (command || workingDirectory) {
            next.command = command;
            next.workingDirectory = workingDirectory;
        }
        else {
            delete next.command;
            delete next.workingDirectory;
        }
        return next
    })
}

const actions = {
    addApplication(document, {application} = {}) {
        if (!application || typeof application !== 'object' || Array.isArray(application)) {
            throw new Error('Adding an application needs an application object.')
        }
        if (document?.nodes?.some(node => node.id === application.id)) {
            throw new Error(`System node id already exists: ${application.id ?? '<missing>'}.`)
        }
        document.nodes.push(cloneSystemDocument(application));
        return true
    },

    deleteApplication(document, {id} = {}) {
        const index = document?.nodes?.findIndex(candidate => candidate.id === id) ?? -1;
        if (index < 0) throw new Error(`Cannot delete unknown system node: ${id ?? '<missing>'}.`)
        if (document.nodes[index].kind !== 'application') throw new Error(`System node ${id} is not an application.`)

        document.nodes.splice(index, 1);
        document.connections = document.connections.filter(connection => connection.from?.node !== id && connection.to?.node !== id);
        return true
    },

    moveNode(document, {id, position} = {}) {
        const node = document?.nodes?.find(candidate => candidate.id === id);
        if (!node) throw new Error(`Cannot move unknown system node: ${id ?? '<missing>'}.`)
        if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
            throw new Error('A node move needs a finite x and y position.')
        }
        if (node.position?.x === position.x && node.position?.y === position.y) return false
        node.position = {x: position.x, y: position.y};
        return true
    },

    editApplication(document, {id, name, role, vmblu, references} = {}) {
        const node = systemNode(document, id);
        if (node.kind !== 'application') throw new Error(`System node ${id} is not an application.`)

        const next = {
            name: typeof name === 'string' ? name.trim() : name,
            vmblu,
            references: cleanReferences(references),
        };
        const description = typeof role === 'string' ? role.trim() : role;
        const before = JSON.stringify(node);

        node.name = next.name;
        node.vmblu = next.vmblu;
        node.references = next.references;
        if (description) node.description = description;
        else delete node.description;

        return JSON.stringify(node) !== before
    },

    addEndpoint(document, {nodeId, endpoint} = {}) {
        const node = systemNode(document, nodeId);
        if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
            throw new Error('Adding an endpoint needs an endpoint object.')
        }
        node.endpoints ??= [];
        if (node.endpoints.some(candidate => candidate.id === endpoint.id)) {
            throw new Error(`Endpoint id already exists on ${nodeId}: ${endpoint.id ?? '<missing>'}.`)
        }
        const replacement = {
            ...endpoint,
            name: cleanText(endpoint.name),
        };
        if (cleanText(endpoint.protocol)) replacement.protocol = cleanText(endpoint.protocol);
        else delete replacement.protocol;
        if (cleanText(endpoint.remarks)) replacement.remarks = cleanText(endpoint.remarks);
        else delete replacement.remarks;
        delete replacement.description;
        delete replacement.direction;
        delete replacement.transport;
        delete replacement.references;
        node.endpoints.push(cloneSystemDocument(replacement));
        return true
    },

    editEndpoint(document, {nodeId, id, endpoint} = {}) {
        const node = systemNode(document, nodeId);
        const index = node.endpoints?.findIndex(candidate => candidate.id === id) ?? -1;
        if (index < 0) throw new Error(`Cannot edit unknown endpoint ${id ?? '<missing>'} on ${nodeId}.`)
        if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
            throw new Error('Editing an endpoint needs an endpoint object.')
        }

        const current = node.endpoints[index];
        const replacement = {
            ...current,
            ...cloneSystemDocument(endpoint),
            id,
            name: cleanText(endpoint.name),
        };
        if (cleanText(endpoint.protocol)) replacement.protocol = cleanText(endpoint.protocol);
        else delete replacement.protocol;
        delete replacement.direction;
        delete replacement.transport;
        delete replacement.references;
        if (cleanText(endpoint.remarks)) replacement.remarks = cleanText(endpoint.remarks);
        else delete replacement.remarks;
        delete replacement.description;

        if (JSON.stringify(current) === JSON.stringify(replacement)) return false
        node.endpoints[index] = replacement;
        return true
    },

    deleteEndpoint(document, {nodeId, id} = {}) {
        const node = systemNode(document, nodeId);
        const index = node.endpoints?.findIndex(candidate => candidate.id === id) ?? -1;
        if (index < 0) throw new Error(`Cannot delete unknown endpoint ${id ?? '<missing>'} on ${nodeId}.`)
        node.endpoints.splice(index, 1);
        document.connections = document.connections.filter(connection => !(
            connection.from?.node === nodeId && connection.from?.endpoint === id
        ) && !(
            connection.to?.node === nodeId && connection.to?.endpoint === id
        ));
        return true
    },

    addConnection(document, {connection} = {}) {
        if (!connection || typeof connection !== 'object' || Array.isArray(connection)) {
            throw new Error('Adding a connection needs a connection object.')
        }
        if (document.connections.some(candidate => candidate.id === connection.id)) {
            throw new Error(`Connection id already exists: ${connection.id ?? '<missing>'}.`)
        }
        const replacement = {
            ...connection,
            transport: cleanText(connection.transport),
        };
        if (cleanText(connection.remarks)) replacement.remarks = cleanText(connection.remarks);
        else delete replacement.remarks;
        delete replacement.name;
        delete replacement.description;
        delete replacement.flow;
        delete replacement.direction;
        delete replacement.protocol;
        document.connections.push(cloneSystemDocument(replacement));
        return true
    },

    editConnection(document, {id, remarks, transport} = {}) {
        const connection = document.connections.find(candidate => candidate.id === id);
        if (!connection) throw new Error(`Cannot edit unknown connection: ${id ?? '<missing>'}.`)
        const before = JSON.stringify(connection);

        if (cleanText(remarks)) connection.remarks = cleanText(remarks);
        else delete connection.remarks;
        connection.transport = cleanText(transport);
        delete connection.name;
        delete connection.description;
        delete connection.flow;
        delete connection.direction;
        delete connection.protocol;

        return JSON.stringify(connection) !== before
    },

    deleteConnection(document, {id} = {}) {
        const index = document.connections.findIndex(candidate => candidate.id === id);
        if (index < 0) throw new Error(`Cannot delete unknown connection: ${id ?? '<missing>'}.`)
        document.connections.splice(index, 1);
        return true
    },
};

class Sysmod {
    constructor(manager, {limit = 31} = {}) {
        this.manager = manager;
        this.limit = limit;
        this.history = [];
        this.cursor = 0;
        this.cleanDocument = null;
    }

    reset() {
        this.history.length = 0;
        this.cursor = 0;
        this.markClean();
    }

    markClean() {
        this.cleanDocument = JSON.stringify(this.manager.document);
    }

    isDirty() {
        return JSON.stringify(this.manager.document) !== this.cleanDocument
    }

    status(verb = '') {
        return {
            verb,
            undo: this.cursor > 0,
            redo: this.cursor < this.history.length,
            dirty: this.isDirty(),
        }
    }

    updateHeader(properties) {
        const apply = document => {
            if (document?.header) Object.assign(document.header, properties);
        };
        apply(this.manager.document);
        for (const edit of this.history) {
            apply(edit.before);
            apply(edit.after);
        }
    }

    doit(verb, param) {
        const action = actions[verb];
        if (!action) throw new Error(`Unknown sysmod action: ${verb ?? '<missing>'}.`)
        if (!this.manager.document) throw new Error('There is no active system document.')

        const before = cloneSystemDocument(this.manager.document);
        const candidate = cloneSystemDocument(this.manager.document);
        const changed = action(candidate, param);
        if (!changed) return {...this.status(verb), changed: false}

        const validation = this.manager.validate(candidate);
        if (!validation.ok) throw new Error(validation.errors.join(' '))

        this.manager.document = candidate;
        const after = cloneSystemDocument(candidate);
        this.history.splice(this.cursor);
        this.history.push({verb, before, after});
        if (this.history.length > this.limit) this.history.shift();
        this.cursor = this.history.length;

        return {...this.status(verb), changed: true}
    }

    undo() {
        if (this.cursor === 0) return {...this.status('undo'), changed: false}
        const edit = this.history[--this.cursor];
        this.manager.document = cloneSystemDocument(edit.before);
        return {...this.status(edit.verb), changed: true}
    }

    redo() {
        if (this.cursor >= this.history.length) return {...this.status('redo'), changed: false}
        const edit = this.history[this.cursor++];
        this.manager.document = cloneSystemDocument(edit.after);
        return {...this.status(edit.verb), changed: true}
    }
}

/**
 * @node sysblu manager
 */
function SysbluManager(tx, sx = {}) {
    this.tx = tx;
    this.sx = sx;
    this.document = null;
    this.arl = null;
    this.sysmod = new Sysmod(this, {limit: sx?.historyLimit ?? 31});
}

SysbluManager.prototype = {
    validate(document) {
        return validateSystemDocument(document)
    },

    /** @param {ActiveDocument} active */
    async onSysbluSet(active) {
        if (!active) {
            this.document = null;
            this.arl = null;
            this.sysmod.reset();
            this.publish();
            return
        }

        this.arl = arlFromActive(active);

        try {
            let document = documentFromActive(active);
            if (!document && this.arl?.get) document = await this.arl.get('json');

            const validation = validateSystemDocument(document);
            if (!validation.ok) throw new Error(validation.errors.join(' '))

            this.document = cloneSystemDocument(document);
            this.sysmod.reset();
            this.publish();
            this.tx.send('sysblu.diagnostics', {arl: this.arl, errors: []});
            this.tx.send('sysblu.loaded', this.arl);
        }
        catch (error) {
            this.document = null;
            this.sysmod.reset();
            console.error(`Could not load sysblu document ${this.arl?.getPath?.() ?? ''}:`, error);
            this.tx.send('sysblu.diagnostics', {arl: this.arl, errors: [error.message]});
            this.tx.send('sysblu.failed', this.arl);
        }
    },

    async onSysbluSave() {
        if (!this.document || !this.arl?.save) return null
        if (this.arl.canWrite?.() === false) {
            this.tx.send('sysblu.failed', this.arl);
            return null
        }

        const timestamp = new Date().toISOString();
        this.sysmod.updateHeader({saved: timestamp, utc: timestamp});
        const text = JSON.stringify(this.document, null, 2);

        try {
            await this.arl.save(text);
            this.sysmod.markClean();
            this.publish();
            return text
        }
        catch (error) {
            console.error(`Could not save sysblu document ${this.arl?.getPath?.() ?? ''}:`, error);
            this.tx.send('sysblu.failed', this.arl);
            return null
        }
    },

    /** @param {SysmodDoit} command */
    onSysmodDoit(command = {}) {
        const {verb, param} = command;
        if (!verb) return
        this.applySysmod(() => this.sysmod.doit(verb, param), verb);
    },

    onSysmodUndo() {
        this.applySysmod(() => this.sysmod.undo(), 'undo');
    },

    onSysmodRedo() {
        this.applySysmod(() => this.sysmod.redo(), 'redo');
    },

    applySysmod(operation, fallbackVerb) {
        try {
            const result = operation();
            if (result.changed) this.publish();
            this.tx.send('sysmod.done', {
                verb: result.verb || fallbackVerb,
                undo: result.undo,
                redo: result.redo,
                dirty: result.dirty,
            });
        }
        catch (error) {
            console.error(`Could not apply sysmod action ${fallbackVerb}:`, error);
            this.tx.send('sysmod.done', {
                ...this.sysmod.status(),
                verb: fallbackVerb,
                error: error.message,
            });
        }
    },

    publish() {
        this.tx.send('system.updated', {
            document: cloneSystemDocument(this.document),
            arl: this.arl,
            dirty: this.sysmod.isDirty(),
        });
    },
};

const node_env = globalThis.process?.env?.NODE_ENV;
var DEV = node_env && !node_env.toLowerCase().startsWith('prod');

// Store the references to globals in case someone tries to monkey patch these, causing the below
// to de-opt (this occurs often when using popular extensions).
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var array_from = Array.from;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var get_descriptors = Object.getOwnPropertyDescriptors;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;
var is_extensible = Object.isExtensible;

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
 * TODO replace with Promise.withResolvers once supported widely enough
 * @template T
 */
function deferred() {
	/** @type {(value: T) => void} */
	var resolve;

	/** @type {(reason: any) => void} */
	var reject;

	/** @type {Promise<T>} */
	var promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	// @ts-expect-error
	return { promise, resolve, reject };
}

// General flags
const DERIVED = 1 << 1;
const EFFECT = 1 << 2;
const RENDER_EFFECT = 1 << 3;
const BLOCK_EFFECT = 1 << 4;
const BRANCH_EFFECT = 1 << 5;
const ROOT_EFFECT = 1 << 6;
const BOUNDARY_EFFECT = 1 << 7;
/**
 * Indicates that a reaction is connected to an effect root — either it is an effect,
 * or it is a derived that is depended on by at least one effect. If a derived has
 * no dependents, we can disconnect it from the graph, allowing it to either be
 * GC'd or reconnected later if an effect comes to depend on it again
 */
const CONNECTED = 1 << 9;
const CLEAN = 1 << 10;
const DIRTY = 1 << 11;
const MAYBE_DIRTY = 1 << 12;
const INERT = 1 << 13;
const DESTROYED = 1 << 14;

// Flags exclusive to effects
/** Set once an effect that should run synchronously has run */
const EFFECT_RAN = 1 << 15;
/**
 * 'Transparent' effects do not create a transition boundary.
 * This is on a block effect 99% of the time but may also be on a branch effect if its parent block effect was pruned
 */
const EFFECT_TRANSPARENT = 1 << 16;
const EAGER_EFFECT = 1 << 17;
const HEAD_EFFECT = 1 << 18;
const EFFECT_PRESERVED = 1 << 19;
const USER_EFFECT = 1 << 20;

// Flags exclusive to deriveds
/**
 * Tells that we marked this derived and its reactions as visited during the "mark as (maybe) dirty"-phase.
 * Will be lifted during execution of the derived and during checking its dirty state (both are necessary
 * because a derived might be checked but not executed).
 */
const WAS_MARKED = 1 << 15;

// Flags used for async
const REACTION_IS_UPDATING = 1 << 21;
const ASYNC = 1 << 22;

const ERROR_VALUE = 1 << 23;

const STATE_SYMBOL = Symbol('$state');
const LEGACY_PROPS = Symbol('legacy props');
const LOADING_ATTR_SYMBOL = Symbol('');
const PROXY_PATH_SYMBOL = Symbol('proxy path');

/** allow users to ignore aborted signal errors if `reason.name === 'StaleReactionError` */
const STALE_REACTION = new (class StaleReactionError extends Error {
	name = 'StaleReactionError';
	message = 'The reaction that called `getAbortSignal()` was re-run or destroyed';
})();

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * `%name%(...)` can only be used during component initialisation
 * @param {string} name
 * @returns {never}
 */
function lifecycle_outside_component(name) {
	if (DEV) {
		const error = new Error(`lifecycle_outside_component\n\`${name}(...)\` can only be used during component initialisation\nhttps://svelte.dev/e/lifecycle_outside_component`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/lifecycle_outside_component`);
	}
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * Cannot create a `$derived(...)` with an `await` expression outside of an effect tree
 * @returns {never}
 */
function async_derived_orphan() {
	if (DEV) {
		const error = new Error(`async_derived_orphan\nCannot create a \`$derived(...)\` with an \`await\` expression outside of an effect tree\nhttps://svelte.dev/e/async_derived_orphan`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/async_derived_orphan`);
	}
}

/**
 * Using `bind:value` together with a checkbox input is not allowed. Use `bind:checked` instead
 * @returns {never}
 */
function bind_invalid_checkbox_value() {
	if (DEV) {
		const error = new Error(`bind_invalid_checkbox_value\nUsing \`bind:value\` together with a checkbox input is not allowed. Use \`bind:checked\` instead\nhttps://svelte.dev/e/bind_invalid_checkbox_value`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/bind_invalid_checkbox_value`);
	}
}

/**
 * A derived value cannot reference itself recursively
 * @returns {never}
 */
function derived_references_self() {
	if (DEV) {
		const error = new Error(`derived_references_self\nA derived value cannot reference itself recursively\nhttps://svelte.dev/e/derived_references_self`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/derived_references_self`);
	}
}

/**
 * `%rune%` cannot be used inside an effect cleanup function
 * @param {string} rune
 * @returns {never}
 */
function effect_in_teardown(rune) {
	if (DEV) {
		const error = new Error(`effect_in_teardown\n\`${rune}\` cannot be used inside an effect cleanup function\nhttps://svelte.dev/e/effect_in_teardown`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_in_teardown`);
	}
}

/**
 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
 * @returns {never}
 */
function effect_in_unowned_derived() {
	if (DEV) {
		const error = new Error(`effect_in_unowned_derived\nEffect cannot be created inside a \`$derived\` value that was not itself created inside an effect\nhttps://svelte.dev/e/effect_in_unowned_derived`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
	}
}

/**
 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
 * @param {string} rune
 * @returns {never}
 */
function effect_orphan(rune) {
	if (DEV) {
		const error = new Error(`effect_orphan\n\`${rune}\` can only be used inside an effect (e.g. during component initialisation)\nhttps://svelte.dev/e/effect_orphan`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_orphan`);
	}
}

/**
 * Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
 * @returns {never}
 */
function effect_update_depth_exceeded() {
	if (DEV) {
		const error = new Error(`effect_update_depth_exceeded\nMaximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state\nhttps://svelte.dev/e/effect_update_depth_exceeded`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
	}
}

/**
 * Cannot do `bind:%key%={undefined}` when `%key%` has a fallback value
 * @param {string} key
 * @returns {never}
 */
function props_invalid_value(key) {
	if (DEV) {
		const error = new Error(`props_invalid_value\nCannot do \`bind:${key}={undefined}\` when \`${key}\` has a fallback value\nhttps://svelte.dev/e/props_invalid_value`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/props_invalid_value`);
	}
}

/**
 * The `%rune%` rune is only available inside `.svelte` and `.svelte.js/ts` files
 * @param {string} rune
 * @returns {never}
 */
function rune_outside_svelte(rune) {
	if (DEV) {
		const error = new Error(`rune_outside_svelte\nThe \`${rune}\` rune is only available inside \`.svelte\` and \`.svelte.js/ts\` files\nhttps://svelte.dev/e/rune_outside_svelte`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/rune_outside_svelte`);
	}
}

/**
 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
 * @returns {never}
 */
function state_descriptors_fixed() {
	if (DEV) {
		const error = new Error(`state_descriptors_fixed\nProperty descriptors defined on \`$state\` objects must contain \`value\` and always be \`enumerable\`, \`configurable\` and \`writable\`.\nhttps://svelte.dev/e/state_descriptors_fixed`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
	}
}

/**
 * Cannot set prototype of `$state` object
 * @returns {never}
 */
function state_prototype_fixed() {
	if (DEV) {
		const error = new Error(`state_prototype_fixed\nCannot set prototype of \`$state\` object\nhttps://svelte.dev/e/state_prototype_fixed`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
	}
}

/**
 * Updating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
 * @returns {never}
 */
function state_unsafe_mutation() {
	if (DEV) {
		const error = new Error(`state_unsafe_mutation\nUpdating state inside \`$derived(...)\`, \`$inspect(...)\` or a template expression is forbidden. If the value should not be reactive, declare it without \`$state\`\nhttps://svelte.dev/e/state_unsafe_mutation`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
	}
}

/**
 * A `<svelte:boundary>` `reset` function cannot be called while an error is still being handled
 * @returns {never}
 */
function svelte_boundary_reset_onerror() {
	if (DEV) {
		const error = new Error(`svelte_boundary_reset_onerror\nA \`<svelte:boundary>\` \`reset\` function cannot be called while an error is still being handled\nhttps://svelte.dev/e/svelte_boundary_reset_onerror`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
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

const NAMESPACE_HTML = 'http://www.w3.org/1999/xhtml';

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


var bold = 'font-weight: bold';
var normal = 'font-weight: normal';

/**
 * An async derived, `%name%` (%location%) was not read immediately after it resolved. This often indicates an unnecessary waterfall, which can slow down your app
 * @param {string} name
 * @param {string} location
 */
function await_waterfall(name, location) {
	if (DEV) {
		console.warn(`%c[svelte] await_waterfall\n%cAn async derived, \`${name}\` (${location}) was not read immediately after it resolved. This often indicates an unnecessary waterfall, which can slow down your app\nhttps://svelte.dev/e/await_waterfall`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/await_waterfall`);
	}
}

/**
 * Reactive `$state(...)` proxies and the values they proxy have different identities. Because of this, comparisons with `%operator%` will produce unexpected results
 * @param {string} operator
 */
function state_proxy_equality_mismatch(operator) {
	if (DEV) {
		console.warn(`%c[svelte] state_proxy_equality_mismatch\n%cReactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`${operator}\` will produce unexpected results\nhttps://svelte.dev/e/state_proxy_equality_mismatch`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/state_proxy_equality_mismatch`);
	}
}

/**
 * A `<svelte:boundary>` `reset` function only resets the boundary the first time it is called
 */
function svelte_boundary_reset_noop() {
	if (DEV) {
		console.warn(`%c[svelte] svelte_boundary_reset_noop\n%cA \`<svelte:boundary>\` \`reset\` function only resets the boundary the first time it is called\nhttps://svelte.dev/e/svelte_boundary_reset_noop`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
	}
}

/** @import { TemplateNode } from '#client' */


/**
 * Use this variable to guard everything related to hydration code so it can be treeshaken out
 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
 */
let hydrating = false;

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

let async_mode_flag = false;
let legacy_mode_flag = false;
let tracing_mode_flag = false;

function enable_legacy_mode_flag() {
	legacy_mode_flag = true;
}

/** @import { Derived, Reaction, Value } from '#client' */

/**
 * @param {string} label
 * @returns {Error & { stack: string } | null}
 */
function get_stack(label) {
	// @ts-ignore stackTraceLimit doesn't exist everywhere
	const limit = Error.stackTraceLimit;

	// @ts-ignore
	Error.stackTraceLimit = Infinity;
	let error = Error();

	// @ts-ignore
	Error.stackTraceLimit = limit;

	const stack = error.stack;

	if (!stack) return null;

	const lines = stack.split('\n');
	const new_lines = ['\n'];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const posixified = line.replaceAll('\\', '/');

		if (line === 'Error') {
			continue;
		}

		if (line.includes('validate_each_keys')) {
			return null;
		}

		if (posixified.includes('svelte/src/internal') || posixified.includes('node_modules/.vite')) {
			continue;
		}

		new_lines.push(line);
	}

	if (new_lines.length === 1) {
		return null;
	}

	define_property(error, 'stack', {
		value: new_lines.join('\n')
	});

	define_property(error, 'name', {
		value: label
	});

	return /** @type {Error & { stack: string }} */ (error);
}

/**
 * @param {Value} source
 * @param {string} label
 */
function tag(source, label) {
	source.label = label;
	tag_proxy(source.v, label);

	return source;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function tag_proxy(value, label) {
	// @ts-expect-error
	value?.[PROXY_PATH_SYMBOL]?.(label);
	return value;
}

/** @import { ComponentContext, DevStackEntry, Effect } from '#client' */

/** @type {ComponentContext | null} */
let component_context = null;

/** @param {ComponentContext | null} context */
function set_component_context(context) {
	component_context = context;
}

/** @type {DevStackEntry | null} */
let dev_stack = null;

/** @param {DevStackEntry | null} stack */
function set_dev_stack(stack) {
	dev_stack = stack;
}

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

/** @param {ComponentContext['function']} fn */
function set_dev_current_component_function(fn) {
	dev_current_component_function = fn;
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
		i: false,
		c: null,
		e: null,
		s: props,
		x: null,
		l: legacy_mode_flag && !runes ? { s: null, u: null, $: [] } : null
	};

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
	var context = /** @type {ComponentContext} */ (component_context);
	var effects = context.e;

	if (effects !== null) {
		context.e = null;

		for (var fn of effects) {
			create_user_effect(fn);
		}
	}

	if (component !== undefined) {
		context.x = component;
	}

	context.i = true;

	component_context = context.p;

	if (DEV) {
		dev_current_component_function = component_context?.function ?? null;
	}

	return component ?? /** @type {T} */ ({});
}

/** @returns {boolean} */
function is_runes() {
	return !legacy_mode_flag || (component_context !== null && component_context.l === null);
}

/** @type {Array<() => void>} */
let micro_tasks = [];

function run_micro_tasks() {
	var tasks = micro_tasks;
	micro_tasks = [];
	run_all(tasks);
}

/**
 * @param {() => void} fn
 */
function queue_micro_task(fn) {
	if (micro_tasks.length === 0 && !is_flushing_sync) {
		var tasks = micro_tasks;
		queueMicrotask(() => {
			// If this is false, a flushSync happened in the meantime. Do _not_ run new scheduled microtasks in that case
			// as the ordering of microtasks would be broken at that point - consider this case:
			// - queue_micro_task schedules microtask A to flush task X
			// - synchronously after, flushSync runs, processing task X
			// - synchronously after, some other microtask B is scheduled, but not through queue_micro_task but for example a Promise.resolve() in user code
			// - synchronously after, queue_micro_task schedules microtask C to flush task Y
			// - one tick later, microtask A now resolves, flushing task Y before microtask B, which is incorrect
			// This if check prevents that race condition (that realistically will only happen in tests)
			if (tasks === micro_tasks) run_micro_tasks();
		});
	}

	micro_tasks.push(fn);
}

/**
 * Synchronously run any queued tasks.
 */
function flush_tasks() {
	while (micro_tasks.length > 0) {
		run_micro_tasks();
	}
}

/** @import { Derived, Effect } from '#client' */
/** @import { Boundary } from './dom/blocks/boundary.js' */

const adjustments = new WeakMap();

/**
 * @param {unknown} error
 */
function handle_error(error) {
	var effect = active_effect;

	// for unowned deriveds, don't throw until we read the value
	if (effect === null) {
		/** @type {Derived} */ (active_reaction).f |= ERROR_VALUE;
		return error;
	}

	if (DEV && error instanceof Error && !adjustments.has(error)) {
		adjustments.set(error, get_adjustments(error, effect));
	}

	if ((effect.f & EFFECT_RAN) === 0) {
		// if the error occurred while creating this subtree, we let it
		// bubble up until it hits a boundary that can handle it
		if ((effect.f & BOUNDARY_EFFECT) === 0) {
			if (DEV && !effect.parent && error instanceof Error) {
				apply_adjustments(error);
			}

			throw error;
		}

		/** @type {Boundary} */ (effect.b).error(error);
	} else {
		// otherwise we bubble up the effect tree ourselves
		invoke_error_boundary(error, effect);
	}
}

/**
 * @param {unknown} error
 * @param {Effect | null} effect
 */
function invoke_error_boundary(error, effect) {
	while (effect !== null) {
		if ((effect.f & BOUNDARY_EFFECT) !== 0) {
			try {
				/** @type {Boundary} */ (effect.b).error(error);
				return;
			} catch (e) {
				error = e;
			}
		}

		effect = effect.parent;
	}

	if (DEV && error instanceof Error) {
		apply_adjustments(error);
	}

	throw error;
}

/**
 * Add useful information to the error message/stack in development
 * @param {Error} error
 * @param {Effect} effect
 */
function get_adjustments(error, effect) {
	const message_descriptor = get_descriptor(error, 'message');

	// if the message was already changed and it's not configurable we can't change it
	// or it will throw a different error swallowing the original error
	if (message_descriptor && !message_descriptor.configurable) return;

	var indent = is_firefox ? '  ' : '\t';
	var component_stack = `\n${indent}in ${effect.fn?.name || '<unknown>'}`;
	var context = effect.ctx;

	while (context !== null) {
		component_stack += `\n${indent}in ${context.function?.[FILENAME].split('/').pop()}`;
		context = context.p;
	}

	return {
		message: error.message + `\n${component_stack}\n`,
		stack: error.stack
			?.split('\n')
			.filter((line) => !line.includes('svelte/src/internal'))
			.join('\n')
	};
}

/**
 * @param {Error} error
 */
function apply_adjustments(error) {
	const adjusted = adjustments.get(error);

	if (adjusted) {
		define_property(error, 'message', {
			value: adjusted.message
		});

		define_property(error, 'stack', {
			value: adjusted.stack
		});
	}
}

/** @import { Fork } from 'svelte' */
/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

/**
 * @typedef {{
 *   parent: EffectTarget | null;
 *   effect: Effect | null;
 *   effects: Effect[];
 *   render_effects: Effect[];
 *   block_effects: Effect[];
 * }} EffectTarget
 */

/** @type {Set<Batch>} */
const batches = new Set();

/** @type {Batch | null} */
let current_batch = null;

/**
 * This is needed to avoid overwriting inputs in non-async mode
 * TODO 6.0 remove this, as non-async mode will go away
 * @type {Batch | null}
 */
let previous_batch = null;

/**
 * When time travelling (i.e. working in one batch, while other batches
 * still have ongoing work), we ignore the real values of affected
 * signals in favour of their values within the batch
 * @type {Map<Value, any> | null}
 */
let batch_values = null;

/** @type {Effect[]} */
let queued_root_effects = [];

/** @type {Effect | null} */
let last_scheduled_effect = null;

let is_flushing = false;
let is_flushing_sync = false;

class Batch {
	committed = false;

	/**
	 * The current values of any sources that are updated in this batch
	 * They keys of this map are identical to `this.#previous`
	 * @type {Map<Source, any>}
	 */
	current = new Map();

	/**
	 * The values of any sources that are updated in this batch _before_ those updates took place.
	 * They keys of this map are identical to `this.#current`
	 * @type {Map<Source, any>}
	 */
	previous = new Map();

	/**
	 * When the batch is committed (and the DOM is updated), we need to remove old branches
	 * and append new ones by calling the functions added inside (if/each/key/etc) blocks
	 * @type {Set<() => void>}
	 */
	#commit_callbacks = new Set();

	/**
	 * If a fork is discarded, we need to destroy any effects that are no longer needed
	 * @type {Set<(batch: Batch) => void>}
	 */
	#discard_callbacks = new Set();

	/**
	 * The number of async effects that are currently in flight
	 */
	#pending = 0;

	/**
	 * The number of async effects that are currently in flight, _not_ inside a pending boundary
	 */
	#blocking_pending = 0;

	/**
	 * A deferred that resolves when the batch is committed, used with `settled()`
	 * TODO replace with Promise.withResolvers once supported widely enough
	 * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
	 */
	#deferred = null;

	/**
	 * Deferred effects (which run after async work has completed) that are DIRTY
	 * @type {Effect[]}
	 */
	#dirty_effects = [];

	/**
	 * Deferred effects that are MAYBE_DIRTY
	 * @type {Effect[]}
	 */
	#maybe_dirty_effects = [];

	/**
	 * A set of branches that still exist, but will be destroyed when this batch
	 * is committed — we skip over these during `process`
	 * @type {Set<Effect>}
	 */
	skipped_effects = new Set();

	is_fork = false;

	/**
	 *
	 * @param {Effect[]} root_effects
	 */
	process(root_effects) {
		queued_root_effects = [];

		previous_batch = null;

		this.apply();

		/** @type {EffectTarget} */
		var target = {
			parent: null,
			effect: null,
			effects: [],
			render_effects: [],
			block_effects: []
		};

		for (const root of root_effects) {
			this.#traverse_effect_tree(root, target);
		}

		if (!this.is_fork) {
			this.#resolve();
		}

		if (this.#blocking_pending > 0 || this.is_fork) {
			this.#defer_effects(target.effects);
			this.#defer_effects(target.render_effects);
			this.#defer_effects(target.block_effects);
		} else {
			// If sources are written to, then work needs to happen in a separate batch, else prior sources would be mixed with
			// newly updated sources, which could lead to infinite loops when effects run over and over again.
			previous_batch = this;
			current_batch = null;

			flush_queued_effects(target.render_effects);
			flush_queued_effects(target.effects);

			previous_batch = null;

			this.#deferred?.resolve();
		}

		batch_values = null;
	}

	/**
	 * Traverse the effect tree, executing effects or stashing
	 * them for later execution as appropriate
	 * @param {Effect} root
	 * @param {EffectTarget} target
	 */
	#traverse_effect_tree(root, target) {
		root.f ^= CLEAN;

		var effect = root.first;

		while (effect !== null) {
			var flags = effect.f;
			var is_branch = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
			var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;

			var skip = is_skippable_branch || (flags & INERT) !== 0 || this.skipped_effects.has(effect);

			if ((effect.f & BOUNDARY_EFFECT) !== 0 && effect.b?.is_pending()) {
				target = {
					parent: target,
					effect,
					effects: [],
					render_effects: [],
					block_effects: []
				};
			}

			if (!skip && effect.fn !== null) {
				if (is_branch) {
					effect.f ^= CLEAN;
				} else if ((flags & EFFECT) !== 0) {
					target.effects.push(effect);
				} else if (is_dirty(effect)) {
					if ((effect.f & BLOCK_EFFECT) !== 0) target.block_effects.push(effect);
					update_effect(effect);
				}

				var child = effect.first;

				if (child !== null) {
					effect = child;
					continue;
				}
			}

			var parent = effect.parent;
			effect = effect.next;

			while (effect === null && parent !== null) {
				if (parent === target.effect) {
					// TODO rather than traversing into pending boundaries and deferring the effects,
					// could we just attach the effects _to_ the pending boundary and schedule them
					// once the boundary is ready?
					this.#defer_effects(target.effects);
					this.#defer_effects(target.render_effects);
					this.#defer_effects(target.block_effects);

					target = /** @type {EffectTarget} */ (target.parent);
				}

				effect = parent.next;
				parent = parent.parent;
			}
		}
	}

	/**
	 * @param {Effect[]} effects
	 */
	#defer_effects(effects) {
		for (const e of effects) {
			const target = (e.f & DIRTY) !== 0 ? this.#dirty_effects : this.#maybe_dirty_effects;
			target.push(e);

			// mark as clean so they get scheduled if they depend on pending async state
			set_signal_status(e, CLEAN);
		}
	}

	/**
	 * Associate a change to a given source with the current
	 * batch, noting its previous and current values
	 * @param {Source} source
	 * @param {any} value
	 */
	capture(source, value) {
		if (!this.previous.has(source)) {
			this.previous.set(source, value);
		}

		// Don't save errors in `batch_values`, or they won't be thrown in `runtime.js#get`
		if ((source.f & ERROR_VALUE) === 0) {
			this.current.set(source, source.v);
			batch_values?.set(source, source.v);
		}
	}

	activate() {
		current_batch = this;
		this.apply();
	}

	deactivate() {
		current_batch = null;
		batch_values = null;
	}

	flush() {
		this.activate();

		if (queued_root_effects.length > 0) {
			flush_effects();

			if (current_batch !== null && current_batch !== this) {
				// this can happen if a new batch was created during `flush_effects()`
				return;
			}
		} else if (this.#pending === 0) {
			this.process([]); // TODO this feels awkward
		}

		this.deactivate();
	}

	discard() {
		for (const fn of this.#discard_callbacks) fn(this);
		this.#discard_callbacks.clear();
	}

	#resolve() {
		if (this.#blocking_pending === 0) {
			// append/remove branches
			for (const fn of this.#commit_callbacks) fn();
			this.#commit_callbacks.clear();
		}

		if (this.#pending === 0) {
			this.#commit();
		}
	}

	#commit() {
		// If there are other pending batches, they now need to be 'rebased' —
		// in other words, we re-run block/async effects with the newly
		// committed state, unless the batch in question has a more
		// recent value for a given source
		if (batches.size > 1) {
			this.previous.clear();

			var previous_batch_values = batch_values;
			var is_earlier = true;

			/** @type {EffectTarget} */
			var dummy_target = {
				parent: null,
				effect: null,
				effects: [],
				render_effects: [],
				block_effects: []
			};

			for (const batch of batches) {
				if (batch === this) {
					is_earlier = false;
					continue;
				}

				/** @type {Source[]} */
				const sources = [];

				for (const [source, value] of this.current) {
					if (batch.current.has(source)) {
						if (is_earlier && value !== batch.current.get(source)) {
							// bring the value up to date
							batch.current.set(source, value);
						} else {
							// same value or later batch has more recent value,
							// no need to re-run these effects
							continue;
						}
					}

					sources.push(source);
				}

				if (sources.length === 0) {
					continue;
				}

				// Re-run async/block effects that depend on distinct values changed in both batches
				const others = [...batch.current.keys()].filter((s) => !this.current.has(s));
				if (others.length > 0) {
					/** @type {Set<Value>} */
					const marked = new Set();
					/** @type {Map<Reaction, boolean>} */
					const checked = new Map();
					for (const source of sources) {
						mark_effects(source, others, marked, checked);
					}

					if (queued_root_effects.length > 0) {
						current_batch = batch;
						batch.apply();

						for (const root of queued_root_effects) {
							batch.#traverse_effect_tree(root, dummy_target);
						}

						// TODO do we need to do anything with `target`? defer block effects?

						queued_root_effects = [];
						batch.deactivate();
					}
				}
			}

			current_batch = null;
			batch_values = previous_batch_values;
		}

		this.committed = true;
		batches.delete(this);
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	increment(blocking) {
		this.#pending += 1;
		if (blocking) this.#blocking_pending += 1;
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	decrement(blocking) {
		this.#pending -= 1;
		if (blocking) this.#blocking_pending -= 1;

		this.revive();
	}

	revive() {
		for (const e of this.#dirty_effects) {
			set_signal_status(e, DIRTY);
			schedule_effect(e);
		}

		for (const e of this.#maybe_dirty_effects) {
			set_signal_status(e, MAYBE_DIRTY);
			schedule_effect(e);
		}

		this.#dirty_effects = [];
		this.#maybe_dirty_effects = [];

		this.flush();
	}

	/** @param {() => void} fn */
	oncommit(fn) {
		this.#commit_callbacks.add(fn);
	}

	/** @param {(batch: Batch) => void} fn */
	ondiscard(fn) {
		this.#discard_callbacks.add(fn);
	}

	settled() {
		return (this.#deferred ??= deferred()).promise;
	}

	static ensure() {
		if (current_batch === null) {
			const batch = (current_batch = new Batch());
			batches.add(current_batch);

			if (!is_flushing_sync) {
				Batch.enqueue(() => {
					if (current_batch !== batch) {
						// a flushSync happened in the meantime
						return;
					}

					batch.flush();
				});
			}
		}

		return current_batch;
	}

	/** @param {() => void} task */
	static enqueue(task) {
		queue_micro_task(task);
	}

	apply() {
		return;
	}
}

/**
 * Synchronously flush any pending updates.
 * Returns void if no callback is provided, otherwise returns the result of calling the callback.
 * @template [T=void]
 * @param {(() => T) | undefined} [fn]
 * @returns {T}
 */
function flushSync(fn) {

	var was_flushing_sync = is_flushing_sync;
	is_flushing_sync = true;

	try {
		var result;

		if (fn) {
			if (current_batch !== null) {
				flush_effects();
			}

			result = fn();
		}

		while (true) {
			flush_tasks();

			if (queued_root_effects.length === 0) {
				current_batch?.flush();

				// we need to check again, in case we just updated an `$effect.pending()`
				if (queued_root_effects.length === 0) {
					// this would be reset in `flush_effects()` but since we are early returning here,
					// we need to reset it here as well in case the first time there's 0 queued root effects
					last_scheduled_effect = null;

					return /** @type {T} */ (result);
				}
			}

			flush_effects();
		}
	} finally {
		is_flushing_sync = was_flushing_sync;
	}
}

function flush_effects() {
	var was_updating_effect = is_updating_effect;
	is_flushing = true;

	try {
		var flush_count = 0;
		set_is_updating_effect(true);

		while (queued_root_effects.length > 0) {
			var batch = Batch.ensure();

			if (flush_count++ > 1000) {
				if (DEV) {
					var updates = new Map();

					for (const source of batch.current.keys()) {
						for (const [stack, update] of source.updated ?? []) {
							var entry = updates.get(stack);

							if (!entry) {
								entry = { error: update.error, count: 0 };
								updates.set(stack, entry);
							}

							entry.count += update.count;
						}
					}

					for (const update of updates.values()) {
						// eslint-disable-next-line no-console
						console.error(update.error);
					}
				}

				infinite_loop_guard();
			}

			batch.process(queued_root_effects);
			old_values.clear();
		}
	} finally {
		is_flushing = false;
		set_is_updating_effect(was_updating_effect);

		last_scheduled_effect = null;
	}
}

function infinite_loop_guard() {
	try {
		effect_update_depth_exceeded();
	} catch (error) {
		if (DEV) {
			// stack contains no useful information, replace it
			define_property(error, 'stack', { value: '' });
		}

		// Best effort: invoke the boundary nearest the most recent
		// effect and hope that it's relevant to the infinite loop
		invoke_error_boundary(error, last_scheduled_effect);
	}
}

/** @type {Set<Effect> | null} */
let eager_block_effects = null;

/**
 * @param {Array<Effect>} effects
 * @returns {void}
 */
function flush_queued_effects(effects) {
	var length = effects.length;
	if (length === 0) return;

	var i = 0;

	while (i < length) {
		var effect = effects[i++];

		if ((effect.f & (DESTROYED | INERT)) === 0 && is_dirty(effect)) {
			eager_block_effects = new Set();

			update_effect(effect);

			// Effects with no dependencies or teardown do not get added to the effect tree.
			// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
			// don't know if we need to keep them until they are executed. Doing the check
			// here (rather than in `update_effect`) allows us to skip the work for
			// immediate effects.
			if (effect.deps === null && effect.first === null && effect.nodes_start === null) {
				// if there's no teardown or abort controller we completely unlink
				// the effect from the graph
				if (effect.teardown === null && effect.ac === null) {
					// remove this effect from the graph
					unlink_effect(effect);
				} else {
					// keep the effect in the graph, but free up some memory
					effect.fn = null;
				}
			}

			// If update_effect() has a flushSync() in it, we may have flushed another flush_queued_effects(),
			// which already handled this logic and did set eager_block_effects to null.
			if (eager_block_effects?.size > 0) {
				old_values.clear();

				for (const e of eager_block_effects) {
					// Skip eager effects that have already been unmounted
					if ((e.f & (DESTROYED | INERT)) !== 0) continue;

					// Run effects in order from ancestor to descendant, else we could run into nullpointers
					/** @type {Effect[]} */
					const ordered_effects = [e];
					let ancestor = e.parent;
					while (ancestor !== null) {
						if (eager_block_effects.has(ancestor)) {
							eager_block_effects.delete(ancestor);
							ordered_effects.push(ancestor);
						}
						ancestor = ancestor.parent;
					}

					for (let j = ordered_effects.length - 1; j >= 0; j--) {
						const e = ordered_effects[j];
						// Skip eager effects that have already been unmounted
						if ((e.f & (DESTROYED | INERT)) !== 0) continue;
						update_effect(e);
					}
				}

				eager_block_effects.clear();
			}
		}
	}

	eager_block_effects = null;
}

/**
 * This is similar to `mark_reactions`, but it only marks async/block effects
 * depending on `value` and at least one of the other `sources`, so that
 * these effects can re-run after another batch has been committed
 * @param {Value} value
 * @param {Source[]} sources
 * @param {Set<Value>} marked
 * @param {Map<Reaction, boolean>} checked
 */
function mark_effects(value, sources, marked, checked) {
	if (marked.has(value)) return;
	marked.add(value);

	if (value.reactions !== null) {
		for (const reaction of value.reactions) {
			const flags = reaction.f;

			if ((flags & DERIVED) !== 0) {
				mark_effects(/** @type {Derived} */ (reaction), sources, marked, checked);
			} else if (
				(flags & (ASYNC | BLOCK_EFFECT)) !== 0 &&
				(flags & DIRTY) === 0 && // we may have scheduled this one already
				depends_on(reaction, sources, checked)
			) {
				set_signal_status(reaction, DIRTY);
				schedule_effect(/** @type {Effect} */ (reaction));
			}
		}
	}
}

/**
 * @param {Reaction} reaction
 * @param {Source[]} sources
 * @param {Map<Reaction, boolean>} checked
 */
function depends_on(reaction, sources, checked) {
	const depends = checked.get(reaction);
	if (depends !== undefined) return depends;

	if (reaction.deps !== null) {
		for (const dep of reaction.deps) {
			if (sources.includes(dep)) {
				return true;
			}

			if ((dep.f & DERIVED) !== 0 && depends_on(/** @type {Derived} */ (dep), sources, checked)) {
				checked.set(/** @type {Derived} */ (dep), true);
				return true;
			}
		}
	}

	checked.set(reaction, false);

	return false;
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function schedule_effect(signal) {
	var effect = (last_scheduled_effect = signal);

	while (effect.parent !== null) {
		effect = effect.parent;
		var flags = effect.f;

		// if the effect is being scheduled because a parent (each/await/etc) block
		// updated an internal source, bail out or we'll cause a second flush
		if (
			is_flushing &&
			effect === active_effect &&
			(flags & BLOCK_EFFECT) !== 0 &&
			(flags & HEAD_EFFECT) === 0
		) {
			return;
		}

		if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
			if ((flags & CLEAN) === 0) return;
			effect.f ^= CLEAN;
		}
	}

	queued_root_effects.push(effect);
}

/**
 * Returns a `subscribe` function that integrates external event-based systems with Svelte's reactivity.
 * It's particularly useful for integrating with web APIs like `MediaQuery`, `IntersectionObserver`, or `WebSocket`.
 *
 * If `subscribe` is called inside an effect (including indirectly, for example inside a getter),
 * the `start` callback will be called with an `update` function. Whenever `update` is called, the effect re-runs.
 *
 * If `start` returns a cleanup function, it will be called when the effect is destroyed.
 *
 * If `subscribe` is called in multiple effects, `start` will only be called once as long as the effects
 * are active, and the returned teardown function will only be called when all effects are destroyed.
 *
 * It's best understood with an example. Here's an implementation of [`MediaQuery`](https://svelte.dev/docs/svelte/svelte-reactivity#MediaQuery):
 *
 * ```js
 * import { createSubscriber } from 'svelte/reactivity';
 * import { on } from 'svelte/events';
 *
 * export class MediaQuery {
 * 	#query;
 * 	#subscribe;
 *
 * 	constructor(query) {
 * 		this.#query = window.matchMedia(`(${query})`);
 *
 * 		this.#subscribe = createSubscriber((update) => {
 * 			// when the `change` event occurs, re-run any effects that read `this.current`
 * 			const off = on(this.#query, 'change', update);
 *
 * 			// stop listening when all the effects are destroyed
 * 			return () => off();
 * 		});
 * 	}
 *
 * 	get current() {
 * 		// This makes the getter reactive, if read in an effect
 * 		this.#subscribe();
 *
 * 		// Return the current state of the query, whether or not we're in an effect
 * 		return this.#query.matches;
 * 	}
 * }
 * ```
 * @param {(update: () => void) => (() => void) | void} start
 * @since 5.7.0
 */
function createSubscriber(start) {
	let subscribers = 0;
	let version = source(0);
	/** @type {(() => void) | void} */
	let stop;

	if (DEV) {
		tag(version, 'createSubscriber version');
	}

	return () => {
		if (effect_tracking()) {
			get$1(version);

			render_effect(() => {
				if (subscribers === 0) {
					stop = untrack(() => start(() => increment(version)));
				}

				subscribers += 1;

				return () => {
					queue_micro_task(() => {
						// Only count down after a microtask, else we would reach 0 before our own render effect reruns,
						// but reach 1 again when the tick callback of the prior teardown runs. That would mean we
						// re-subcribe unnecessarily and create a memory leak because the old subscription is never cleaned up.
						subscribers -= 1;

						if (subscribers === 0) {
							stop?.();
							stop = undefined;
							// Increment the version to ensure any dependent deriveds are marked dirty when the subscription is picked up again later.
							// If we didn't do this then the comparison of write versions would determine that the derived has a later version than
							// the subscriber, and it would not be re-run.
							increment(version);
						}
					});
				};
			});
		}
	};
}

/** @import { Effect, Source, TemplateNode, } from '#client' */

/**
 * @typedef {{
 * 	 onerror?: (error: unknown, reset: () => void) => void;
 *   failed?: (anchor: Node, error: () => unknown, reset: () => () => void) => void;
 *   pending?: (anchor: Node) => void;
 * }} BoundaryProps
 */

var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED | BOUNDARY_EFFECT;

/**
 * @param {TemplateNode} node
 * @param {BoundaryProps} props
 * @param {((anchor: Node) => void)} children
 * @returns {void}
 */
function boundary(node, props, children) {
	new Boundary(node, props, children);
}

class Boundary {
	/** @type {Boundary | null} */
	parent;

	#pending = false;

	/** @type {TemplateNode} */
	#anchor;

	/** @type {TemplateNode | null} */
	#hydrate_open = null;

	/** @type {BoundaryProps} */
	#props;

	/** @type {((anchor: Node) => void)} */
	#children;

	/** @type {Effect} */
	#effect;

	/** @type {Effect | null} */
	#main_effect = null;

	/** @type {Effect | null} */
	#pending_effect = null;

	/** @type {Effect | null} */
	#failed_effect = null;

	/** @type {DocumentFragment | null} */
	#offscreen_fragment = null;

	/** @type {TemplateNode | null} */
	#pending_anchor = null;

	#local_pending_count = 0;
	#pending_count = 0;

	#is_creating_fallback = false;

	/**
	 * A source containing the number of pending async deriveds/expressions.
	 * Only created if `$effect.pending()` is used inside the boundary,
	 * otherwise updating the source results in needless `Batch.ensure()`
	 * calls followed by no-op flushes
	 * @type {Source<number> | null}
	 */
	#effect_pending = null;

	#effect_pending_subscriber = createSubscriber(() => {
		this.#effect_pending = source(this.#local_pending_count);

		if (DEV) {
			tag(this.#effect_pending, '$effect.pending()');
		}

		return () => {
			this.#effect_pending = null;
		};
	});

	/**
	 * @param {TemplateNode} node
	 * @param {BoundaryProps} props
	 * @param {((anchor: Node) => void)} children
	 */
	constructor(node, props, children) {
		this.#anchor = node;
		this.#props = props;
		this.#children = children;

		this.parent = /** @type {Effect} */ (active_effect).b;

		this.#pending = !!this.#props.pending;

		this.#effect = block(() => {
			/** @type {Effect} */ (active_effect).b = this;

			{
				var anchor = this.#get_anchor();

				try {
					this.#main_effect = branch(() => children(anchor));
				} catch (error) {
					this.error(error);
				}

				if (this.#pending_count > 0) {
					this.#show_pending_snippet();
				} else {
					this.#pending = false;
				}
			}

			return () => {
				this.#pending_anchor?.remove();
			};
		}, flags);
	}

	#hydrate_resolved_content() {
		try {
			this.#main_effect = branch(() => this.#children(this.#anchor));
		} catch (error) {
			this.error(error);
		}

		// Since server rendered resolved content, we never show pending state
		// Even if client-side async operations are still running, the content is already displayed
		this.#pending = false;
	}

	#hydrate_pending_content() {
		const pending = this.#props.pending;
		if (!pending) {
			return;
		}
		this.#pending_effect = branch(() => pending(this.#anchor));

		Batch.enqueue(() => {
			var anchor = this.#get_anchor();

			this.#main_effect = this.#run(() => {
				Batch.ensure();
				return branch(() => this.#children(anchor));
			});

			if (this.#pending_count > 0) {
				this.#show_pending_snippet();
			} else {
				pause_effect(/** @type {Effect} */ (this.#pending_effect), () => {
					this.#pending_effect = null;
				});

				this.#pending = false;
			}
		});
	}

	#get_anchor() {
		var anchor = this.#anchor;

		if (this.#pending) {
			this.#pending_anchor = create_text();
			this.#anchor.before(this.#pending_anchor);

			anchor = this.#pending_anchor;
		}

		return anchor;
	}

	/**
	 * Returns `true` if the effect exists inside a boundary whose pending snippet is shown
	 * @returns {boolean}
	 */
	is_pending() {
		return this.#pending || (!!this.parent && this.parent.is_pending());
	}

	has_pending_snippet() {
		return !!this.#props.pending;
	}

	/**
	 * @param {() => Effect | null} fn
	 */
	#run(fn) {
		var previous_effect = active_effect;
		var previous_reaction = active_reaction;
		var previous_ctx = component_context;

		set_active_effect(this.#effect);
		set_active_reaction(this.#effect);
		set_component_context(this.#effect.ctx);

		try {
			return fn();
		} catch (e) {
			handle_error(e);
			return null;
		} finally {
			set_active_effect(previous_effect);
			set_active_reaction(previous_reaction);
			set_component_context(previous_ctx);
		}
	}

	#show_pending_snippet() {
		const pending = /** @type {(anchor: Node) => void} */ (this.#props.pending);

		if (this.#main_effect !== null) {
			this.#offscreen_fragment = document.createDocumentFragment();
			this.#offscreen_fragment.append(/** @type {TemplateNode} */ (this.#pending_anchor));
			move_effect(this.#main_effect, this.#offscreen_fragment);
		}

		if (this.#pending_effect === null) {
			this.#pending_effect = branch(() => pending(this.#anchor));
		}
	}

	/**
	 * Updates the pending count associated with the currently visible pending snippet,
	 * if any, such that we can replace the snippet with content once work is done
	 * @param {1 | -1} d
	 */
	#update_pending_count(d) {
		if (!this.has_pending_snippet()) {
			if (this.parent) {
				this.parent.#update_pending_count(d);
			}

			// if there's no parent, we're in a scope with no pending snippet
			return;
		}

		this.#pending_count += d;

		if (this.#pending_count === 0) {
			this.#pending = false;

			if (this.#pending_effect) {
				pause_effect(this.#pending_effect, () => {
					this.#pending_effect = null;
				});
			}

			if (this.#offscreen_fragment) {
				this.#anchor.before(this.#offscreen_fragment);
				this.#offscreen_fragment = null;
			}
		}
	}

	/**
	 * Update the source that powers `$effect.pending()` inside this boundary,
	 * and controls when the current `pending` snippet (if any) is removed.
	 * Do not call from inside the class
	 * @param {1 | -1} d
	 */
	update_pending_count(d) {
		this.#update_pending_count(d);

		this.#local_pending_count += d;

		if (this.#effect_pending) {
			internal_set(this.#effect_pending, this.#local_pending_count);
		}
	}

	get_effect_pending() {
		this.#effect_pending_subscriber();
		return get$1(/** @type {Source<number>} */ (this.#effect_pending));
	}

	/** @param {unknown} error */
	error(error) {
		var onerror = this.#props.onerror;
		let failed = this.#props.failed;

		// If we have nothing to capture the error, or if we hit an error while
		// rendering the fallback, re-throw for another boundary to handle
		if (this.#is_creating_fallback || (!onerror && !failed)) {
			throw error;
		}

		if (this.#main_effect) {
			destroy_effect(this.#main_effect);
			this.#main_effect = null;
		}

		if (this.#pending_effect) {
			destroy_effect(this.#pending_effect);
			this.#pending_effect = null;
		}

		if (this.#failed_effect) {
			destroy_effect(this.#failed_effect);
			this.#failed_effect = null;
		}

		var did_reset = false;
		var calling_on_error = false;

		const reset = () => {
			if (did_reset) {
				svelte_boundary_reset_noop();
				return;
			}

			did_reset = true;

			if (calling_on_error) {
				svelte_boundary_reset_onerror();
			}

			// If the failure happened while flushing effects, current_batch can be null
			Batch.ensure();

			this.#local_pending_count = 0;

			if (this.#failed_effect !== null) {
				pause_effect(this.#failed_effect, () => {
					this.#failed_effect = null;
				});
			}

			// we intentionally do not try to find the nearest pending boundary. If this boundary has one, we'll render it on reset
			// but it would be really weird to show the parent's boundary on a child reset.
			this.#pending = this.has_pending_snippet();

			this.#main_effect = this.#run(() => {
				this.#is_creating_fallback = false;
				return branch(() => this.#children(this.#anchor));
			});

			if (this.#pending_count > 0) {
				this.#show_pending_snippet();
			} else {
				this.#pending = false;
			}
		};

		var previous_reaction = active_reaction;

		try {
			set_active_reaction(null);
			calling_on_error = true;
			onerror?.(error, reset);
			calling_on_error = false;
		} catch (error) {
			invoke_error_boundary(error, this.#effect && this.#effect.parent);
		} finally {
			set_active_reaction(previous_reaction);
		}

		if (failed) {
			queue_micro_task(() => {
				this.#failed_effect = this.#run(() => {
					Batch.ensure();
					this.#is_creating_fallback = true;

					try {
						return branch(() => {
							failed(
								this.#anchor,
								() => error,
								() => reset
							);
						});
					} catch (error) {
						invoke_error_boundary(error, /** @type {Effect} */ (this.#effect.parent));
						return null;
					} finally {
						this.#is_creating_fallback = false;
					}
				});
			});
		}
	}
}

/** @import { Effect, TemplateNode, Value } from '#client' */

/**
 * @param {Array<Promise<void>>} blockers
 * @param {Array<() => any>} sync
 * @param {Array<() => Promise<any>>} async
 * @param {(values: Value[]) => any} fn
 */
function flatten(blockers, sync, async, fn) {
	const d = is_runes() ? derived : derived_safe_equal;

	if (async.length === 0 && blockers.length === 0) {
		fn(sync.map(d));
		return;
	}

	var batch = current_batch;
	var parent = /** @type {Effect} */ (active_effect);

	var restore = capture();

	function run() {
		Promise.all(async.map((expression) => async_derived(expression)))
			.then((result) => {
				restore();

				try {
					fn([...sync.map(d), ...result]);
				} catch (error) {
					// ignore errors in blocks that have already been destroyed
					if ((parent.f & DESTROYED) === 0) {
						invoke_error_boundary(error, parent);
					}
				}

				batch?.deactivate();
				unset_context();
			})
			.catch((error) => {
				invoke_error_boundary(error, parent);
			});
	}

	if (blockers.length > 0) {
		Promise.all(blockers).then(() => {
			restore();

			try {
				return run();
			} finally {
				batch?.deactivate();
				unset_context();
			}
		});
	} else {
		run();
	}
}

/**
 * Captures the current effect context so that we can restore it after
 * some asynchronous work has happened (so that e.g. `await a + b`
 * causes `b` to be registered as a dependency).
 */
function capture() {
	var previous_effect = active_effect;
	var previous_reaction = active_reaction;
	var previous_component_context = component_context;
	var previous_batch = current_batch;

	if (DEV) {
		var previous_dev_stack = dev_stack;
	}

	return function restore(activate_batch = true) {
		set_active_effect(previous_effect);
		set_active_reaction(previous_reaction);
		set_component_context(previous_component_context);
		if (activate_batch) previous_batch?.activate();

		if (DEV) {
			set_dev_stack(previous_dev_stack);
		}
	};
}

function unset_context() {
	set_active_effect(null);
	set_active_reaction(null);
	set_component_context(null);

	if (DEV) {
		set_dev_stack(null);
	}
}

/** @import { Derived, Effect, Source } from '#client' */
/** @import { Batch } from './batch.js'; */

const recent_async_deriveds = new Set();

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived(fn) {
	var flags = DERIVED | DIRTY;
	var parent_derived =
		active_reaction !== null && (active_reaction.f & DERIVED) !== 0
			? /** @type {Derived} */ (active_reaction)
			: null;

	if (active_effect !== null) {
		// Since deriveds are evaluated lazily, any effects created inside them are
		// created too late to ensure that the parent effect is added to the tree
		active_effect.f |= EFFECT_PRESERVED;
	}

	/** @type {Derived<V>} */
	const signal = {
		ctx: component_context,
		deps: null,
		effects: null,
		equals,
		f: flags,
		fn,
		reactions: null,
		rv: 0,
		v: /** @type {V} */ (UNINITIALIZED),
		wv: 0,
		parent: parent_derived ?? active_effect,
		ac: null
	};

	if (DEV && tracing_mode_flag) {
		signal.created = get_stack('created at');
	}

	return signal;
}

/**
 * @template V
 * @param {() => V | Promise<V>} fn
 * @param {string} [location] If provided, print a warning if the value is not read immediately after update
 * @returns {Promise<Source<V>>}
 */
/*#__NO_SIDE_EFFECTS__*/
function async_derived(fn, location) {
	let parent = /** @type {Effect | null} */ (active_effect);

	if (parent === null) {
		async_derived_orphan();
	}

	var boundary = /** @type {Boundary} */ (parent.b);

	var promise = /** @type {Promise<V>} */ (/** @type {unknown} */ (undefined));
	var signal = source(/** @type {V} */ (UNINITIALIZED));

	// only suspend in async deriveds created on initialisation
	var should_suspend = !active_reaction;

	/** @type {Map<Batch, ReturnType<typeof deferred<V>>>} */
	var deferreds = new Map();

	async_effect(() => {

		/** @type {ReturnType<typeof deferred<V>>} */
		var d = deferred();
		promise = d.promise;

		try {
			// If this code is changed at some point, make sure to still access the then property
			// of fn() to read any signals it might access, so that we track them as dependencies.
			// We call `unset_context` to undo any `save` calls that happen inside `fn()`
			Promise.resolve(fn())
				.then(d.resolve, d.reject)
				.then(() => {
					if (batch === current_batch && batch.committed) {
						// if the batch was rejected as stale, we need to cleanup
						// after any `$.save(...)` calls inside `fn()`
						batch.deactivate();
					}

					unset_context();
				});
		} catch (error) {
			d.reject(error);
			unset_context();
		}

		var batch = /** @type {Batch} */ (current_batch);

		if (should_suspend) {
			var blocking = !boundary.is_pending();

			boundary.update_pending_count(1);
			batch.increment(blocking);

			deferreds.get(batch)?.reject(STALE_REACTION);
			deferreds.delete(batch); // delete to ensure correct order in Map iteration below
			deferreds.set(batch, d);
		}

		/**
		 * @param {any} value
		 * @param {unknown} error
		 */
		const handler = (value, error = undefined) => {

			batch.activate();

			if (error) {
				if (error !== STALE_REACTION) {
					signal.f |= ERROR_VALUE;

					// @ts-expect-error the error is the wrong type, but we don't care
					internal_set(signal, error);
				}
			} else {
				if ((signal.f & ERROR_VALUE) !== 0) {
					signal.f ^= ERROR_VALUE;
				}

				internal_set(signal, value);

				// All prior async derived runs are now stale
				for (const [b, d] of deferreds) {
					deferreds.delete(b);
					if (b === batch) break;
					d.reject(STALE_REACTION);
				}

				if (DEV && location !== undefined) {
					recent_async_deriveds.add(signal);

					setTimeout(() => {
						if (recent_async_deriveds.has(signal)) {
							await_waterfall(/** @type {string} */ (signal.label), location);
							recent_async_deriveds.delete(signal);
						}
					});
				}
			}

			if (should_suspend) {
				boundary.update_pending_count(-1);
				batch.decrement(blocking);
			}
		};

		d.promise.then(handler, (e) => handler(null, e || 'unknown'));
	});

	teardown(() => {
		for (const d of deferreds.values()) {
			d.reject(STALE_REACTION);
		}
	});

	if (DEV) {
		// add a flag that lets this be printed as a derived
		// when using `$inspect.trace()`
		signal.f |= ASYNC;
	}

	return new Promise((fulfil) => {
		/** @param {Promise<V>} p */
		function next(p) {
			function go() {
				if (p === promise) {
					fulfil(signal);
				} else {
					// if the effect re-runs before the initial promise
					// resolves, delay resolution until we have a value
					next(promise);
				}
			}

			p.then(go, go);
		}

		next(promise);
	});
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
function destroy_derived_effects(derived) {
	var effects = derived.effects;

	if (effects !== null) {
		derived.effects = null;

		for (var i = 0; i < effects.length; i += 1) {
			destroy_effect(/** @type {Effect} */ (effects[i]));
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
 * @param {Derived} derived
 * @returns {Effect | null}
 */
function get_derived_parent_effect(derived) {
	var parent = derived.parent;
	while (parent !== null) {
		if ((parent.f & DERIVED) === 0) {
			return /** @type {Effect} */ (parent);
		}
		parent = parent.parent;
	}
	return null;
}

/**
 * @template T
 * @param {Derived} derived
 * @returns {T}
 */
function execute_derived(derived) {
	var value;
	var prev_active_effect = active_effect;

	set_active_effect(get_derived_parent_effect(derived));

	if (DEV) {
		let prev_eager_effects = eager_effects;
		set_eager_effects(new Set());
		try {
			if (stack.includes(derived)) {
				derived_references_self();
			}

			stack.push(derived);

			derived.f &= ~WAS_MARKED;
			destroy_derived_effects(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
			set_eager_effects(prev_eager_effects);
			stack.pop();
		}
	} else {
		try {
			derived.f &= ~WAS_MARKED;
			destroy_derived_effects(derived);
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

	if (!derived.equals(value)) {
		// TODO can we avoid setting `derived.v` when `batch_values !== null`,
		// without causing the value to be stale later?
		derived.v = value;
		derived.wv = increment_write_version();
	}

	// don't mark derived clean if we're reading it inside a
	// cleanup function, or it will cache a stale value
	if (is_destroying_effect) {
		return;
	}

	// During time traveling we don't want to reset the status so that
	// traversal of the graph in the other batches still happens
	if (batch_values !== null) {
		// only cache the value if we're in a tracking context, otherwise we won't
		// clear the cache in `mark_reactions` when dependencies are updated
		if (effect_tracking()) {
			batch_values.set(derived, derived.v);
		}
	} else {
		var status = (derived.f & CONNECTED) === 0 ? MAYBE_DIRTY : CLEAN;
		set_signal_status(derived, status);
	}
}

/** @import { Derived, Effect, Source, Value } from '#client' */

/** @type {Set<any>} */
let eager_effects = new Set();

/** @type {Map<Source, any>} */
const old_values = new Map();

/**
 * @param {Set<any>} v
 */
function set_eager_effects(v) {
	eager_effects = v;
}

let eager_effects_deferred = false;

function set_eager_effects_deferred() {
	eager_effects_deferred = true;
}

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 * @returns {Source<V>}
 */
// TODO rename this to `state` throughout the codebase
function source(v, stack) {
	/** @type {Value} */
	var signal = {
		f: 0, // TODO ideally we could skip this altogether, but it causes type errors
		v,
		reactions: null,
		equals,
		rv: 0,
		wv: 0
	};

	if (DEV && tracing_mode_flag) {
		signal.created = stack ?? get_stack('created at');
		signal.updated = null;
		signal.set_during_effect = false;
		signal.trace = null;
	}

	return signal;
}

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 */
/*#__NO_SIDE_EFFECTS__*/
function state(v, stack) {
	const s = source(v, stack);

	push_reaction_value(s);

	return s;
}

/**
 * @template V
 * @param {V} initial_value
 * @param {boolean} [immutable]
 * @returns {Source<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function mutable_source(initial_value, immutable = false, trackable = true) {
	const s = source(initial_value);
	if (!immutable) {
		s.equals = safe_equals;
	}

	// bind the signal to the component context, in case we need to
	// track updates to trigger beforeUpdate/afterUpdate callbacks
	if (legacy_mode_flag && trackable && component_context !== null && component_context.l !== null) {
		(component_context.l.s ??= []).push(s);
	}

	return s;
}

/**
 * @template V
 * @param {Value<V>} source
 * @param {V} value
 */
function mutate(source, value) {
	set(
		source,
		untrack(() => get$1(source))
	);
	return value;
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @param {boolean} [should_proxy]
 * @returns {V}
 */
function set(source, value, should_proxy = false) {
	if (
		active_reaction !== null &&
		// since we are untracking the function inside `$inspect.with` we need to add this check
		// to ensure we error if state is set inside an inspect effect
		(!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) &&
		is_runes() &&
		(active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 &&
		!current_sources?.includes(source)
	) {
		state_unsafe_mutation();
	}

	let new_value = should_proxy ? proxy(value) : value;

	if (DEV) {
		tag_proxy(new_value, /** @type {string} */ (source.label));
	}

	return internal_set(source, new_value);
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @returns {V}
 */
function internal_set(source, value) {
	if (!source.equals(value)) {
		var old_value = source.v;

		if (is_destroying_effect) {
			old_values.set(source, value);
		} else {
			old_values.set(source, old_value);
		}

		source.v = value;

		var batch = Batch.ensure();
		batch.capture(source, old_value);

		if (DEV) {
			if (active_effect !== null) {
				const error = get_stack('updated at');

				if (error !== null) {
					source.updated ??= new Map();
					let entry = source.updated.get(error.stack);

					if (!entry) {
						entry = { error, count: 0 };
						source.updated.set(error.stack, entry);
					}

					entry.count++;
				}
			}

			if (active_effect !== null) {
				source.set_during_effect = true;
			}
		}

		if ((source.f & DERIVED) !== 0) {
			// if we are assigning to a dirty derived we set it to clean/maybe dirty but we also eagerly execute it to track the dependencies
			if ((source.f & DIRTY) !== 0) {
				execute_derived(/** @type {Derived} */ (source));
			}

			set_signal_status(source, (source.f & CONNECTED) !== 0 ? CLEAN : MAYBE_DIRTY);
		}

		source.wv = increment_write_version();

		mark_reactions(source, DIRTY);

		// It's possible that the current reaction might not have up-to-date dependencies
		// whilst it's actively running. So in the case of ensuring it registers the reaction
		// properly for itself, we need to ensure the current effect actually gets
		// scheduled. i.e: `$effect(() => x++)`
		if (
			is_runes() &&
			active_effect !== null &&
			(active_effect.f & CLEAN) !== 0 &&
			(active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0
		) {
			if (untracked_writes === null) {
				set_untracked_writes([source]);
			} else {
				untracked_writes.push(source);
			}
		}

		if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
			flush_eager_effects();
		}
	}

	return value;
}

function flush_eager_effects() {
	eager_effects_deferred = false;

	const inspects = Array.from(eager_effects);

	for (const effect of inspects) {
		// Mark clean inspect-effects as maybe dirty and then check their dirtiness
		// instead of just updating the effects - this way we avoid overfiring.
		if ((effect.f & CLEAN) !== 0) {
			set_signal_status(effect, MAYBE_DIRTY);
		}

		if (is_dirty(effect)) {
			update_effect(effect);
		}
	}

	eager_effects.clear();
}

/**
 * Silently (without using `get`) increment a source
 * @param {Source<number>} source
 */
function increment(source) {
	set(source, source.v + 1);
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

		// In legacy mode, skip the current effect to prevent infinite loops
		if (!runes && reaction === active_effect) continue;

		// Inspect effects need to run immediately, so that the stack trace makes sense
		if (DEV && (flags & EAGER_EFFECT) !== 0) {
			eager_effects.add(reaction);
			continue;
		}

		var not_dirty = (flags & DIRTY) === 0;

		// don't set a DIRTY reaction to MAYBE_DIRTY
		if (not_dirty) {
			set_signal_status(reaction, status);
		}

		if ((flags & DERIVED) !== 0) {
			var derived = /** @type {Derived} */ (reaction);

			batch_values?.delete(derived);

			if ((flags & WAS_MARKED) === 0) {
				// Only connected deriveds can be reliably unmarked right away
				if (flags & CONNECTED) {
					reaction.f |= WAS_MARKED;
				}

				mark_reactions(derived, MAYBE_DIRTY);
			}
		} else if (not_dirty) {
			if ((flags & BLOCK_EFFECT) !== 0) {
				if (eager_block_effects !== null) {
					eager_block_effects.add(/** @type {Effect} */ (reaction));
				}
			}

			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/** @import { Source } from '#client' */

// TODO move all regexes into shared module?
const regex_is_valid_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function proxy(value) {
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
	var version = state(0);

	var stack = DEV && tracing_mode_flag ? get_stack('created at') : null;
	var parent_version = update_version;

	/**
	 * Executes the proxy in the context of the reaction it was originally created in, if any
	 * @template T
	 * @param {() => T} fn
	 */
	var with_parent = (fn) => {
		if (update_version === parent_version) {
			return fn();
		}

		// child source is being created after the initial proxy —
		// prevent it from being associated with the current reaction
		var reaction = active_reaction;
		var version = update_version;

		set_active_reaction(null);
		set_update_version(parent_version);

		var result = fn();

		set_active_reaction(reaction);
		set_update_version(version);

		return result;
	};

	if (is_proxied_array) {
		// We need to create the length source eagerly to ensure that
		// mutations to the array are properly synced with our proxy
		sources.set('length', state(/** @type {any[]} */ (value).length, stack));
		if (DEV) {
			value = /** @type {any} */ (inspectable_array(/** @type {any[]} */ (value)));
		}
	}

	/** Used in dev for $inspect.trace() */
	var path = '';
	let updating = false;
	/** @param {string} new_path */
	function update_path(new_path) {
		if (updating) return;
		updating = true;
		path = new_path;

		tag(version, `${path} version`);

		// rename all child sources and child proxies
		for (const [prop, source] of sources) {
			tag(source, get_label(path, prop));
		}
		updating = false;
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
				s = with_parent(() => {
					var s = state(descriptor.value, stack);
					sources.set(prop, s);
					if (DEV && typeof prop === 'string') {
						tag(s, get_label(path, prop));
					}
					return s;
				});
			} else {
				set(s, descriptor.value, true);
			}

			return true;
		},

		deleteProperty(target, prop) {
			var s = sources.get(prop);

			if (s === undefined) {
				if (prop in target) {
					const s = with_parent(() => state(UNINITIALIZED, stack));
					sources.set(prop, s);
					increment(version);

					if (DEV) {
						tag(s, get_label(path, prop));
					}
				}
			} else {
				set(s, UNINITIALIZED);
				increment(version);
			}

			return true;
		},

		get(target, prop, receiver) {
			if (prop === STATE_SYMBOL) {
				return value;
			}

			if (DEV && prop === PROXY_PATH_SYMBOL) {
				return update_path;
			}

			var s = sources.get(prop);
			var exists = prop in target;

			// create a source, but only if it's an own property and not a prototype property
			if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				s = with_parent(() => {
					var p = proxy(exists ? target[prop] : UNINITIALIZED);
					var s = state(p, stack);

					if (DEV) {
						tag(s, get_label(path, prop));
					}

					return s;
				});

				sources.set(prop, s);
			}

			if (s !== undefined) {
				var v = get$1(s);
				return v === UNINITIALIZED ? undefined : v;
			}

			return Reflect.get(target, prop, receiver);
		},

		getOwnPropertyDescriptor(target, prop) {
			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			if (descriptor && 'value' in descriptor) {
				var s = sources.get(prop);
				if (s) descriptor.value = get$1(s);
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
					s = with_parent(() => {
						var p = has ? proxy(target[prop]) : UNINITIALIZED;
						var s = state(p, stack);

						if (DEV) {
							tag(s, get_label(path, prop));
						}

						return s;
					});

					sources.set(prop, s);
				}

				var value = get$1(s);
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
						// If the item exists in the original, we need to create an uninitialized source,
						// else a later read of the property would result in a source being created with
						// the value of the original item at that index.
						other_s = with_parent(() => state(UNINITIALIZED, stack));
						sources.set(i + '', other_s);

						if (DEV) {
							tag(other_s, get_label(path, i));
						}
					}
				}
			}

			// If we haven't yet created a source for this property, we need to ensure
			// we do so otherwise if we read it later, then the write won't be tracked and
			// the heuristics of effects will be different vs if we had read the proxied
			// object property before writing to that property.
			if (s === undefined) {
				if (!has || get_descriptor(target, prop)?.writable) {
					s = with_parent(() => state(undefined, stack));

					if (DEV) {
						tag(s, get_label(path, prop));
					}
					set(s, proxy(value));

					sources.set(prop, s);
				}
			} else {
				has = s.v !== UNINITIALIZED;

				var p = with_parent(() => proxy(value));
				set(s, p);
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

				increment(version);
			}

			return true;
		},

		ownKeys(target) {
			get$1(version);

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
 * @param {string} path
 * @param {string | symbol} prop
 */
function get_label(path, prop) {
	if (typeof prop === 'symbol') return `${path}[Symbol(${prop.description ?? ''})]`;
	if (regex_is_valid_identifier.test(prop)) return `${path}.${prop}`;
	return /^\d+$/.test(prop) ? `${path}[${prop}]` : `${path}['${prop}']`;
}

/**
 * @param {any} value
 */
function get_proxied_value(value) {
	try {
		if (value !== null && typeof value === 'object' && STATE_SYMBOL in value) {
			return value[STATE_SYMBOL];
		}
	} catch {
		// the above if check can throw an error if the value in question
		// is the contentWindow of an iframe on another domain, in which
		// case we want to just return the value (because it's definitely
		// not a proxied value) so we don't break any JavaScript interacting
		// with that iframe (such as various payment companies client side
		// JavaScript libraries interacting with their iframes on the same
		// domain)
	}

	return value;
}

const ARRAY_MUTATING_METHODS = new Set([
	'copyWithin',
	'fill',
	'pop',
	'push',
	'reverse',
	'shift',
	'sort',
	'splice',
	'unshift'
]);

/**
 * Wrap array mutating methods so $inspect is triggered only once and
 * to prevent logging an array in intermediate state (e.g. with an empty slot)
 * @param {any[]} array
 */
function inspectable_array(array) {
	return new Proxy(array, {
		get(target, prop, receiver) {
			var value = Reflect.get(target, prop, receiver);
			if (!ARRAY_MUTATING_METHODS.has(/** @type {string} */ (prop))) {
				return value;
			}

			/**
			 * @this {any[]}
			 * @param {any[]} args
			 */
			return function (...args) {
				set_eager_effects_deferred();
				var result = value.apply(this, args);
				flush_eager_effects();
				return result;
			};
		}
	});
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
			for (let i = from_index ?? 0; i < this.length; i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.indexOf(...)');
					break;
				}
			}
		}

		return index;
	};

	array_prototype.lastIndexOf = function (item, from_index) {
		// we need to specify this.length - 1 because it's probably using something like
		// `arguments` inside so passing undefined is different from not passing anything
		const index = lastIndexOf.call(this, item, from_index ?? this.length - 1);

		if (index === -1) {
			for (let i = 0; i <= (from_index ?? this.length - 1); i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.lastIndexOf(...)');
					break;
				}
			}
		}

		return index;
	};

	array_prototype.includes = function (item, from_index) {
		const has = includes.call(this, item, from_index);

		if (!has) {
			for (let i = 0; i < this.length; i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.includes(...)');
					break;
				}
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

/** @import { Effect, TemplateNode } from '#client' */

// export these for reference in the compiled code, making global name deduplication unnecessary
/** @type {Window} */
var $window;

/** @type {boolean} */
var is_firefox;

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
	is_firefox = /Firefox/.test(navigator.userAgent);

	var element_prototype = Element.prototype;
	var node_prototype = Node.prototype;
	var text_prototype = Text.prototype;

	// @ts-ignore
	first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
	// @ts-ignore
	next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

	if (is_extensible(element_prototype)) {
		// the following assignments improve perf of lookups on DOM nodes
		// @ts-expect-error
		element_prototype.__click = undefined;
		// @ts-expect-error
		element_prototype.__className = undefined;
		// @ts-expect-error
		element_prototype.__attributes = null;
		// @ts-expect-error
		element_prototype.__style = undefined;
		// @ts-expect-error
		element_prototype.__e = undefined;
	}

	if (is_extensible(text_prototype)) {
		// @ts-expect-error
		text_prototype.__t = undefined;
	}

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
 * @param {boolean} is_text
 * @returns {Node | null}
 */
function child(node, is_text) {
	{
		return get_first_child(node);
	}
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @param {DocumentFragment | TemplateNode | TemplateNode[]} fragment
 * @param {boolean} [is_text]
 * @returns {Node | null}
 */
function first_child(fragment, is_text = false) {
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

/**
 * Returns `true` if we're updating the current block, for example `condition` in
 * an `{#if condition}` block just changed. In this case, the branch should be
 * appended (or removed) at the same time as other updates within the
 * current `<svelte:boundary>`
 */
function should_defer_append() {
	return false;
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
 * @template T
 * @param {() => T} fn
 */
function without_reactive_context(fn) {
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);
	try {
		return fn();
	} finally {
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}

/**
 * Listen to the given event, and then instantiate a global form reset listener if not already done,
 * to notify all bindings when the form is reset
 * @param {HTMLElement} element
 * @param {string} event
 * @param {(is_reset?: true) => void} handler
 * @param {(is_reset?: true) => void} [on_reset]
 */
function listen_to_event_and_reset_event(element, event, handler, on_reset = handler) {
	element.addEventListener(event, () => without_reactive_context(handler));
	// @ts-expect-error
	const prev = element.__on_r;
	if (prev) {
		// special case for checkbox that can have multiple binds (group & checked)
		// @ts-expect-error
		element.__on_r = () => {
			prev();
			on_reset(true);
		};
	} else {
		// @ts-expect-error
		element.__on_r = () => on_reset(true);
	}

	add_form_reset_listener();
}

/** @import { ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */

/**
 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
 */
function validate_effect(rune) {
	if (active_effect === null) {
		if (active_reaction === null) {
			effect_orphan(rune);
		}

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
	var parent = active_effect;

	if (DEV) {
		// Ensure the parent is never an inspect effect
		while (parent !== null && (parent.f & EAGER_EFFECT) !== 0) {
			parent = parent.parent;
		}
	}

	if (parent !== null && (parent.f & INERT) !== 0) {
		type |= INERT;
	}

	/** @type {Effect} */
	var effect = {
		ctx: component_context,
		deps: null,
		nodes_start: null,
		nodes_end: null,
		f: type | DIRTY | CONNECTED,
		first: null,
		fn,
		last: null,
		next: null,
		parent,
		b: parent && parent.b,
		prev: null,
		teardown: null,
		transitions: null,
		wv: 0,
		ac: null
	};

	if (DEV) {
		effect.component_function = dev_current_component_function;
	}

	if (sync) {
		try {
			update_effect(effect);
			effect.f |= EFFECT_RAN;
		} catch (e) {
			destroy_effect(effect);
			throw e;
		}
	} else if (fn !== null) {
		schedule_effect(effect);
	}

	if (push) {
		/** @type {Effect | null} */
		var e = effect;

		// if an effect has already ran and doesn't need to be kept in the tree
		// (because it won't re-run, has no DOM, and has no teardown etc)
		// then we skip it and go to its child (if any)
		if (
			sync &&
			e.deps === null &&
			e.teardown === null &&
			e.nodes_start === null &&
			e.first === e.last && // either `null`, or a singular child
			(e.f & EFFECT_PRESERVED) === 0
		) {
			e = e.first;
			if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
				e.f |= EFFECT_TRANSPARENT;
			}
		}

		if (e !== null) {
			e.parent = parent;

			if (parent !== null) {
				push_effect(e, parent);
			}

			// if we're in a derived, add the effect there too
			if (
				active_reaction !== null &&
				(active_reaction.f & DERIVED) !== 0 &&
				(type & ROOT_EFFECT) === 0
			) {
				var derived = /** @type {Derived} */ (active_reaction);
				(derived.effects ??= []).push(e);
			}
		}
	}

	return effect;
}

/**
 * Internal representation of `$effect.tracking()`
 * @returns {boolean}
 */
function effect_tracking() {
	return active_reaction !== null && !untracking;
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

	if (DEV) {
		define_property(fn, 'name', {
			value: '$effect'
		});
	}

	// Non-nested `$effect(...)` in a component should be deferred
	// until the component is mounted
	var flags = /** @type {Effect} */ (active_effect).f;
	var defer = !active_reaction && (flags & BRANCH_EFFECT) !== 0 && (flags & EFFECT_RAN) === 0;

	if (defer) {
		// Top-level `$effect(...)` in an unmounted component — defer until mount
		var context = /** @type {ComponentContext} */ (component_context);
		(context.e ??= []).push(fn);
	} else {
		// Everything else — create immediately
		return create_user_effect(fn);
	}
}

/**
 * @param {() => void | (() => void)} fn
 */
function create_user_effect(fn) {
	return create_effect(EFFECT | USER_EFFECT, fn, false);
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
	return create_effect(RENDER_EFFECT | USER_EFFECT, fn, true);
}

/**
 * An effect root whose children can transition out
 * @param {() => void} fn
 * @returns {(options?: { outro?: boolean }) => Promise<void>}
 */
function component_root(fn) {
	Batch.ensure();
	const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);

	return (options = {}) => {
		return new Promise((fulfil) => {
			if (options.outro) {
				pause_effect(effect, () => {
					destroy_effect(effect);
					fulfil(undefined);
				});
			} else {
				destroy_effect(effect);
				fulfil(undefined);
			}
		});
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

	/** @type {{ effect: null | Effect, ran: boolean, deps: () => any }} */
	var token = { effect: null, ran: false, deps };

	context.l.$.push(token);

	token.effect = render_effect(() => {
		deps();

		// If this legacy pre effect has already run before the end of the reset, then
		// bail out to emulate the same behavior.
		if (token.ran) return;

		token.ran = true;
		untrack(fn);
	});
}

function legacy_pre_effect_reset() {
	var context = /** @type {ComponentContextLegacy} */ (component_context);

	render_effect(() => {
		// Run dirty `$:` statements
		for (var token of context.l.$) {
			token.deps();

			var effect = token.effect;

			// If the effect is CLEAN, then make it MAYBE_DIRTY. This ensures we traverse through
			// the effects dependencies and correctly ensure each dependency is up-to-date.
			if ((effect.f & CLEAN) !== 0) {
				set_signal_status(effect, MAYBE_DIRTY);
			}

			if (is_dirty(effect)) {
				update_effect(effect);
			}

			token.ran = false;
		}
	});
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function async_effect(fn) {
	return create_effect(ASYNC | EFFECT_PRESERVED, fn, true);
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function render_effect(fn, flags = 0) {
	return create_effect(RENDER_EFFECT | flags, fn, true);
}

/**
 * @param {(...expressions: any) => void | (() => void)} fn
 * @param {Array<() => any>} sync
 * @param {Array<() => Promise<any>>} async
 * @param {Array<Promise<void>>} blockers
 * @param {boolean} defer
 */
function template_effect(fn, sync = [], async = [], blockers = [], defer = false) {
	flatten(blockers, sync, async, (values) => {
		create_effect(defer ? EFFECT : RENDER_EFFECT, () => fn(...values.map(get$1)), true);
	});
}

/**
 * @param {(() => void)} fn
 * @param {number} flags
 */
function block(fn, flags = 0) {
	var effect = create_effect(BLOCK_EFFECT | flags, fn, true);
	if (DEV) {
		effect.dev_stack = dev_stack;
	}
	return effect;
}

/**
 * @param {(() => void)} fn
 * @param {boolean} [push]
 */
function branch(fn, push = true) {
	return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn, true, push);
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
 * @param {boolean} remove_dom
 * @returns {void}
 */
function destroy_effect_children(signal, remove_dom = false) {
	var effect = signal.first;
	signal.first = signal.last = null;

	while (effect !== null) {
		const controller = effect.ac;

		if (controller !== null) {
			without_reactive_context(() => {
				controller.abort(STALE_REACTION);
			});
		}

		var next = effect.next;

		if ((effect.f & ROOT_EFFECT) !== 0) {
			// this is now an independent root
			effect.parent = null;
		} else {
			destroy_effect(effect, remove_dom);
		}

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

	if (
		(remove_dom || (effect.f & HEAD_EFFECT) !== 0) &&
		effect.nodes_start !== null &&
		effect.nodes_end !== null
	) {
		remove_effect_dom(effect.nodes_start, /** @type {TemplateNode} */ (effect.nodes_end));
		removed = true;
	}

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
	// we don't null out `parent` so that error propagation can work correctly
	effect.next =
		effect.prev =
		effect.teardown =
		effect.ctx =
		effect.deps =
		effect.fn =
		effect.nodes_start =
		effect.nodes_end =
		effect.ac =
			null;
}

/**
 *
 * @param {TemplateNode | null} node
 * @param {TemplateNode} end
 */
function remove_effect_dom(node, end) {
	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : /** @type {TemplateNode} */ (get_next_sibling(node));

		node.remove();
		node = next;
	}
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
 * @param {boolean} [destroy]
 */
function pause_effect(effect, callback, destroy = true) {
	/** @type {TransitionManager[]} */
	var transitions = [];

	pause_children(effect, transitions, true);

	run_out_transitions(transitions, () => {
		if (destroy) destroy_effect(effect);
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
		var transparent =
			(child.f & EFFECT_TRANSPARENT) !== 0 ||
			// If this is a branch effect without a block effect parent,
			// it means the parent block effect was pruned. In that case,
			// transparency information was transferred to the branch effect.
			((child.f & BRANCH_EFFECT) !== 0 && (effect.f & BLOCK_EFFECT) !== 0);
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
	// schedule the effect to update. we don't use `is_dirty`
	// here because we don't want to eagerly recompute a derived like
	// `{#if foo}{foo.bar()}{/if}` if `foo` is now `undefined
	if ((effect.f & CLEAN) === 0) {
		set_signal_status(effect, DIRTY);
		schedule_effect(effect);
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

/**
 * @param {Effect} effect
 * @param {DocumentFragment} fragment
 */
function move_effect(effect, fragment) {
	var node = effect.nodes_start;
	var end = effect.nodes_end;

	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : /** @type {TemplateNode} */ (get_next_sibling(node));

		fragment.append(node);
		node = next;
	}
}

/** @import { Value } from '#client' */

/**
 * @type {Set<Value> | null}
 * @deprecated
 */
let captured_signals = null;

/**
 * Capture an array of all the signals that are read when `fn` is called
 * @template T
 * @param {() => T} fn
 */
function capture_signals(fn) {
	var previous_captured_signals = captured_signals;

	try {
		captured_signals = new Set();

		untrack(fn);

		if (previous_captured_signals !== null) {
			for (var signal of captured_signals) {
				previous_captured_signals.add(signal);
			}
		}

		return captured_signals;
	} finally {
		captured_signals = previous_captured_signals;
	}
}

/**
 * Invokes a function and captures all signals that are read during the invocation,
 * then invalidates them.
 * @param {() => any} fn
 * @deprecated
 */
function invalidate_inner_signals(fn) {
	for (var signal of capture_signals(fn)) {
		internal_set(signal, signal.v);
	}
}

/** @import { Derived, Effect, Reaction, Signal, Source, Value } from '#client' */

let is_updating_effect = false;

/** @param {boolean} value */
function set_is_updating_effect(value) {
	is_updating_effect = value;
}

let is_destroying_effect = false;

/** @param {boolean} value */
function set_is_destroying_effect(value) {
	is_destroying_effect = value;
}

/** @type {null | Reaction} */
let active_reaction = null;

let untracking = false;

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
 * When sources are created within a reaction, reading and writing
 * them within that reaction should not cause a re-run
 * @type {null | Source[]}
 */
let current_sources = null;

/** @param {Value} value */
function push_reaction_value(value) {
	if (active_reaction !== null && (!async_mode_flag )) {
		if (current_sources === null) {
			current_sources = [value];
		} else {
			current_sources.push(value);
		}
	}
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

/**
 * @type {number} Used by sources and deriveds for handling updates.
 * Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
 **/
let write_version = 1;

/** @type {number} Used to version each read of a source of derived to avoid duplicating depedencies inside a reaction */
let read_version = 0;

let update_version = read_version;

/** @param {number} value */
function set_update_version(value) {
	update_version = value;
}

function increment_write_version() {
	return ++write_version;
}

/**
 * Determines whether a derived or effect is dirty.
 * If it is MAYBE_DIRTY, will set the status to CLEAN
 * @param {Reaction} reaction
 * @returns {boolean}
 */
function is_dirty(reaction) {
	var flags = reaction.f;

	if ((flags & DIRTY) !== 0) {
		return true;
	}

	if (flags & DERIVED) {
		reaction.f &= ~WAS_MARKED;
	}

	if ((flags & MAYBE_DIRTY) !== 0) {
		var dependencies = reaction.deps;

		if (dependencies !== null) {
			var length = dependencies.length;

			for (var i = 0; i < length; i++) {
				var dependency = dependencies[i];

				if (is_dirty(/** @type {Derived} */ (dependency))) {
					update_derived(/** @type {Derived} */ (dependency));
				}

				if (dependency.wv > reaction.wv) {
					return true;
				}
			}
		}

		if (
			(flags & CONNECTED) !== 0 &&
			// During time traveling we don't want to reset the status so that
			// traversal of the graph in the other batches still happens
			batch_values === null
		) {
			set_signal_status(reaction, CLEAN);
		}
	}

	return false;
}

/**
 * @param {Value} signal
 * @param {Effect} effect
 * @param {boolean} [root]
 */
function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
	var reactions = signal.reactions;
	if (reactions === null) return;

	if (current_sources?.includes(signal)) {
		return;
	}

	for (var i = 0; i < reactions.length; i++) {
		var reaction = reactions[i];

		if ((reaction.f & DERIVED) !== 0) {
			schedule_possible_effect_self_invalidation(/** @type {Derived} */ (reaction), effect, false);
		} else if (effect === reaction) {
			if (root) {
				set_signal_status(reaction, DIRTY);
			} else if ((reaction.f & CLEAN) !== 0) {
				set_signal_status(reaction, MAYBE_DIRTY);
			}
			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/** @param {Reaction} reaction */
function update_reaction(reaction) {
	var previous_deps = new_deps;
	var previous_skipped_deps = skipped_deps;
	var previous_untracked_writes = untracked_writes;
	var previous_reaction = active_reaction;
	var previous_sources = current_sources;
	var previous_component_context = component_context;
	var previous_untracking = untracking;
	var previous_update_version = update_version;

	var flags = reaction.f;

	new_deps = /** @type {null | Value[]} */ (null);
	skipped_deps = 0;
	untracked_writes = null;
	active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;

	current_sources = null;
	set_component_context(reaction.ctx);
	untracking = false;
	update_version = ++read_version;

	if (reaction.ac !== null) {
		without_reactive_context(() => {
			/** @type {AbortController} */ (reaction.ac).abort(STALE_REACTION);
		});

		reaction.ac = null;
	}

	try {
		reaction.f |= REACTION_IS_UPDATING;
		var fn = /** @type {Function} */ (reaction.fn);
		var result = fn();
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

			if (is_updating_effect && effect_tracking() && (reaction.f & CONNECTED) !== 0) {
				for (i = skipped_deps; i < deps.length; i++) {
					(deps[i].reactions ??= []).push(reaction);
				}
			}
		} else if (deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}

		// If we're inside an effect and we have untracked writes, then we need to
		// ensure that if any of those untracked writes result in re-invalidation
		// of the current effect, then that happens accordingly
		if (
			is_runes() &&
			untracked_writes !== null &&
			!untracking &&
			deps !== null &&
			(reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0
		) {
			for (i = 0; i < /** @type {Source[]} */ (untracked_writes).length; i++) {
				schedule_possible_effect_self_invalidation(
					untracked_writes[i],
					/** @type {Effect} */ (reaction)
				);
			}
		}

		// If we are returning to an previous reaction then
		// we need to increment the read version to ensure that
		// any dependencies in this reaction aren't marked with
		// the same version
		if (previous_reaction !== null && previous_reaction !== reaction) {
			read_version++;

			if (untracked_writes !== null) {
				if (previous_untracked_writes === null) {
					previous_untracked_writes = untracked_writes;
				} else {
					previous_untracked_writes.push(.../** @type {Source[]} */ (untracked_writes));
				}
			}
		}

		if ((reaction.f & ERROR_VALUE) !== 0) {
			reaction.f ^= ERROR_VALUE;
		}

		return result;
	} catch (error) {
		return handle_error(error);
	} finally {
		reaction.f ^= REACTION_IS_UPDATING;
		new_deps = previous_deps;
		skipped_deps = previous_skipped_deps;
		untracked_writes = previous_untracked_writes;
		active_reaction = previous_reaction;
		current_sources = previous_sources;
		set_component_context(previous_component_context);
		untracking = previous_untracking;
		update_version = previous_update_version;
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
		var index = index_of.call(reactions, signal);
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
		// disconnected and remove the mark flag, as it cannot be reliably removed otherwise
		if ((dependency.f & CONNECTED) !== 0) {
			dependency.f ^= CONNECTED;
			dependency.f &= ~WAS_MARKED;
		}
		// Disconnect any reactions owned by this reaction
		destroy_derived_effects(/** @type {Derived} **/ (dependency));
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
	var was_updating_effect = is_updating_effect;

	active_effect = effect;
	is_updating_effect = true;

	if (DEV) {
		var previous_component_fn = dev_current_component_function;
		set_dev_current_component_function(effect.component_function);
		var previous_stack = /** @type {any} */ (dev_stack);
		// only block effects have a dev stack, keep the current one otherwise
		set_dev_stack(effect.dev_stack ?? dev_stack);
	}

	try {
		if ((flags & BLOCK_EFFECT) !== 0) {
			destroy_block_effect_children(effect);
		} else {
			destroy_effect_children(effect);
		}

		execute_effect_teardown(effect);
		var teardown = update_reaction(effect);
		effect.teardown = typeof teardown === 'function' ? teardown : null;
		effect.wv = write_version;

		// In DEV, increment versions of any sources that were written to during the effect,
		// so that they are correctly marked as dirty when the effect re-runs
		if (DEV && tracing_mode_flag && (effect.f & DIRTY) !== 0 && effect.deps !== null) {
			for (var dep of effect.deps) {
				if (dep.set_during_effect) {
					dep.wv = increment_write_version();
					dep.set_during_effect = false;
				}
			}
		}
	} finally {
		is_updating_effect = was_updating_effect;
		active_effect = previous_effect;

		if (DEV) {
			set_dev_current_component_function(previous_component_fn);
			set_dev_stack(previous_stack);
		}
	}
}

/**
 * Returns a promise that resolves once any pending state changes have been applied.
 * @returns {Promise<void>}
 */
async function tick() {

	await Promise.resolve();

	// By calling flushSync we guarantee that any pending state changes are applied after one tick.
	// TODO look into whether we can make flushing subsequent updates synchronously in the future.
	flushSync();
}

/**
 * @template V
 * @param {Value<V>} signal
 * @returns {V}
 */
function get$1(signal) {
	var flags = signal.f;
	var is_derived = (flags & DERIVED) !== 0;

	captured_signals?.add(signal);

	// Register the dependency on the current reaction signal.
	if (active_reaction !== null && !untracking) {
		// if we're in a derived that is being read inside an _async_ derived,
		// it's possible that the effect was already destroyed. In this case,
		// we don't add the dependency, because that would create a memory leak
		var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;

		if (!destroyed && !current_sources?.includes(signal)) {
			var deps = active_reaction.deps;

			if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
				// we're in the effect init/update cycle
				if (signal.rv < read_version) {
					signal.rv = read_version;

					// If the signal is accessing the same dependencies in the same
					// order as it did last time, increment `skipped_deps`
					// rather than updating `new_deps`, which creates GC cost
					if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
						skipped_deps++;
					} else if (new_deps === null) {
						new_deps = [signal];
					} else if (!new_deps.includes(signal)) {
						new_deps.push(signal);
					}
				}
			} else {
				// we're adding a dependency outside the init/update cycle
				// (i.e. after an `await`)
				(active_reaction.deps ??= []).push(signal);

				var reactions = signal.reactions;

				if (reactions === null) {
					signal.reactions = [active_reaction];
				} else if (!reactions.includes(active_reaction)) {
					reactions.push(active_reaction);
				}
			}
		}
	}

	if (DEV) {
		// TODO reinstate this, but make it actually work
		// if (current_async_effect) {
		// 	var tracking = (current_async_effect.f & REACTION_IS_UPDATING) !== 0;
		// 	var was_read = current_async_effect.deps?.includes(signal);

		// 	if (!tracking && !untracking && !was_read) {
		// 		w.await_reactivity_loss(/** @type {string} */ (signal.label));

		// 		var trace = get_stack('traced at');
		// 		// eslint-disable-next-line no-console
		// 		if (trace) console.warn(trace);
		// 	}
		// }

		recent_async_deriveds.delete(signal);
	}

	if (is_destroying_effect) {
		if (old_values.has(signal)) {
			return old_values.get(signal);
		}

		if (is_derived) {
			var derived = /** @type {Derived} */ (signal);

			var value = derived.v;

			// if the derived is dirty and has reactions, or depends on the values that just changed, re-execute
			// (a derived can be maybe_dirty due to the effect destroy removing its last reaction)
			if (
				((derived.f & CLEAN) === 0 && derived.reactions !== null) ||
				depends_on_old_values(derived)
			) {
				value = execute_derived(derived);
			}

			old_values.set(derived, value);

			return value;
		}
	} else if (is_derived) {
		derived = /** @type {Derived} */ (signal);

		if (batch_values?.has(derived)) {
			return batch_values.get(derived);
		}

		if (is_dirty(derived)) {
			update_derived(derived);
		}

		if (is_updating_effect && effect_tracking() && (derived.f & CONNECTED) === 0) {
			reconnect(derived);
		}
	} else if (batch_values?.has(signal)) {
		return batch_values.get(signal);
	}

	if ((signal.f & ERROR_VALUE) !== 0) {
		throw signal.v;
	}

	return signal.v;
}

/**
 * (Re)connect a disconnected derived, so that it is notified
 * of changes in `mark_reactions`
 * @param {Derived} derived
 */
function reconnect(derived) {
	if (derived.deps === null) return;

	derived.f ^= CONNECTED;

	for (const dep of derived.deps) {
		(dep.reactions ??= []).push(derived);

		if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
			reconnect(/** @type {Derived} */ (dep));
		}
	}
}

/** @param {Derived} derived */
function depends_on_old_values(derived) {
	if (derived.v === UNINITIALIZED) return true; // we don't know, so assume the worst
	if (derived.deps === null) return false;

	for (const dep of derived.deps) {
		if (old_values.has(dep)) {
			return true;
		}

		if ((dep.f & DERIVED) !== 0 && depends_on_old_values(/** @type {Derived} */ (dep))) {
			return true;
		}
	}

	return false;
}

/**
 * When used inside a [`$derived`](https://svelte.dev/docs/svelte/$derived) or [`$effect`](https://svelte.dev/docs/svelte/$effect),
 * any state read inside `fn` will not be treated as a dependency.
 *
 * ```ts
 * $effect(() => {
 *   // this will run when `data` changes, but not when `time` changes
 *   save(data, {
 *     timestamp: untrack(() => time)
 *   });
 * });
 * ```
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
	var previous_untracking = untracking;
	try {
		untracking = true;
		return fn();
	} finally {
		untracking = previous_untracking;
	}
}

const STATUS_MASK = ~(DIRTY | MAYBE_DIRTY | CLEAN);

/**
 * @param {Signal} signal
 * @param {number} status
 * @returns {void}
 */
function set_signal_status(signal, status) {
	signal.f = (signal.f & STATUS_MASK) | status;
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

/** @type {Set<string>} */
const all_registered_events = new Set();

/** @type {Set<(events: Array<string>) => void>} */
const root_event_handles = new Set();

/**
 * @param {string} event_name
 * @param {EventTarget} dom
 * @param {EventListener} [handler]
 * @param {AddEventListenerOptions} [options]
 */
function create_event(event_name, dom, handler, options = {}) {
	/**
	 * @this {EventTarget}
	 */
	function target_handler(/** @type {Event} */ event) {
		if (!options.capture) {
			// Only call in the bubble phase, else delegated events would be called before the capturing events
			handle_event_propagation.call(dom, event);
		}
		if (!event.cancelBubble) {
			return without_reactive_context(() => {
				return handler?.call(this, event);
			});
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
 * @param {EventListener} [handler]
 * @param {boolean} [capture]
 * @param {boolean} [passive]
 * @returns {void}
 */
function event(event_name, dom, handler, capture, passive) {
	var options = { capture, passive };
	var target_handler = create_event(event_name, dom, handler, options);

	if (
		dom === document.body ||
		// @ts-ignore
		dom === window ||
		// @ts-ignore
		dom === document ||
		// Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
		dom instanceof HTMLMediaElement
	) {
		teardown(() => {
			dom.removeEventListener(event_name, target_handler, options);
		});
	}
}

// used to store the reference to the currently propagated event
// to prevent garbage collection between microtasks in Firefox
// If the event object is GCed too early, the expando __root property
// set on the event object is lost, causing the event delegation
// to process the event twice
let last_propagated_event = null;

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

	last_propagated_event = event;

	// composedPath contains list of nodes the event has propagated through.
	// We check __root to skip all nodes below it in case this is a
	// parent of the __root node, which indicates that there's nested
	// mounted apps. In this case we don't want to trigger events multiple times.
	var path_idx = 0;

	// the `last_propagated_event === event` check is redundant, but
	// without it the variable will be DCE'd and things will
	// fail mysteriously in Firefox
	// @ts-expect-error is added below
	var handled_at = last_propagated_event === event && event.__root;

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

	// This started because of Chromium issue https://chromestatus.com/feature/5128696823545856,
	// where removal or moving of of the DOM can cause sync `blur` events to fire, which can cause logic
	// to run inside the current `active_reaction`, which isn't what we want at all. However, on reflection,
	// it's probably best that all event handled by Svelte have this behaviour, as we don't really want
	// an event handler to run in the context of another reaction or effect.
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);

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

				if (
					delegated != null &&
					(!(/** @type {any} */ (current_target).disabled) ||
						// DOM could've been updated already by the time this is reached, so we check this as well
						// -> the target could not have been disabled because it emits the event in the first place
						event.target === current_target)
				) {
					delegated.call(current_target, event);
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
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}

/** @param {string} html */
function create_fragment_from_html(html) {
	var elem = document.createElement('template');
	elem.innerHTML = html.replaceAll('<!>', '<!---->'); // XHTML compliance
	return elem.content;
}

/** @import { Effect, TemplateNode } from '#client' */
/** @import { TemplateStructure } from './types' */

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
function from_html(content, flags) {
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
			use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true)
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

/** @import { ComponentContext, Effect, TemplateNode } from '#client' */
/** @import { Component, ComponentType, SvelteComponent, MountOptions } from '../../index.js' */

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
		text.nodeValue = str + '';
	}
}

/**
 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
 * Transitions will play during the initial render unless the `intro` option is set to `false`.
 *
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
 * @param {MountOptions<Props>} options
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
 * @param {MountOptions} options
 * @returns {Exports}
 */
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
	init_operations();

	/** @type {Set<string>} */
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

	var unmount = component_root(() => {
		var anchor_node = anchor ?? target.appendChild(create_text());

		boundary(
			/** @type {TemplateNode} */ (anchor_node),
			{
				pending: () => {}
			},
			(anchor_node) => {
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
			}
		);

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
 * @typedef {{ effect: Effect, fragment: DocumentFragment }} Branch
 */

/**
 * @template Key
 */
class BranchManager {
	/** @type {TemplateNode} */
	anchor;

	/** @type {Map<Batch, Key>} */
	#batches = new Map();

	/** @type {Map<Key, Effect>} */
	#onscreen = new Map();

	/** @type {Map<Key, Branch>} */
	#offscreen = new Map();

	/**
	 * Whether to pause (i.e. outro) on change, or destroy immediately.
	 * This is necessary for `<svelte:element>`
	 */
	#transition = true;

	/**
	 * @param {TemplateNode} anchor
	 * @param {boolean} transition
	 */
	constructor(anchor, transition = true) {
		this.anchor = anchor;
		this.#transition = transition;
	}

	#commit = () => {
		var batch = /** @type {Batch} */ (current_batch);

		// if this batch was made obsolete, bail
		if (!this.#batches.has(batch)) return;

		var key = /** @type {Key} */ (this.#batches.get(batch));

		var onscreen = this.#onscreen.get(key);

		if (onscreen) {
			// effect is already in the DOM — abort any current outro
			resume_effect(onscreen);
		} else {
			// effect is currently offscreen. put it in the DOM
			var offscreen = this.#offscreen.get(key);

			if (offscreen) {
				this.#onscreen.set(key, offscreen.effect);
				this.#offscreen.delete(key);

				// remove the anchor...
				/** @type {TemplateNode} */ (offscreen.fragment.lastChild).remove();

				// ...and append the fragment
				this.anchor.before(offscreen.fragment);
				onscreen = offscreen.effect;
			}
		}

		for (const [b, k] of this.#batches) {
			this.#batches.delete(b);

			if (b === batch) {
				// keep values for newer batches
				break;
			}

			const offscreen = this.#offscreen.get(k);

			if (offscreen) {
				// for older batches, destroy offscreen effects
				// as they will never be committed
				destroy_effect(offscreen.effect);
				this.#offscreen.delete(k);
			}
		}

		// outro/destroy all onscreen effects...
		for (const [k, effect] of this.#onscreen) {
			// ...except the one that was just committed
			if (k === key) continue;

			const on_destroy = () => {
				const keys = Array.from(this.#batches.values());

				if (keys.includes(k)) {
					// keep the effect offscreen, as another batch will need it
					var fragment = document.createDocumentFragment();
					move_effect(effect, fragment);

					fragment.append(create_text()); // TODO can we avoid this?

					this.#offscreen.set(k, { effect, fragment });
				} else {
					destroy_effect(effect);
				}

				this.#onscreen.delete(k);
			};

			if (this.#transition || !onscreen) {
				pause_effect(effect, on_destroy, false);
			} else {
				on_destroy();
			}
		}
	};

	/**
	 * @param {Batch} batch
	 */
	#discard = (batch) => {
		this.#batches.delete(batch);

		const keys = Array.from(this.#batches.values());

		for (const [k, branch] of this.#offscreen) {
			if (!keys.includes(k)) {
				destroy_effect(branch.effect);
				this.#offscreen.delete(k);
			}
		}
	};

	/**
	 *
	 * @param {any} key
	 * @param {null | ((target: TemplateNode) => void)} fn
	 */
	ensure(key, fn) {
		var batch = /** @type {Batch} */ (current_batch);
		var defer = should_defer_append();

		if (fn && !this.#onscreen.has(key) && !this.#offscreen.has(key)) {
			if (defer) {
				var fragment = document.createDocumentFragment();
				var target = create_text();

				fragment.append(target);

				this.#offscreen.set(key, {
					effect: branch(() => fn(target)),
					fragment
				});
			} else {
				this.#onscreen.set(
					key,
					branch(() => fn(this.anchor))
				);
			}
		}

		this.#batches.set(batch, key);

		if (defer) {
			for (const [k, effect] of this.#onscreen) {
				if (k === key) {
					batch.skipped_effects.delete(effect);
				} else {
					batch.skipped_effects.add(effect);
				}
			}

			for (const [k, branch] of this.#offscreen) {
				if (k === key) {
					batch.skipped_effects.delete(branch.effect);
				} else {
					batch.skipped_effects.add(branch.effect);
				}
			}

			batch.oncommit(this.#commit);
			batch.ondiscard(this.#discard);
		} else {

			this.#commit();
		}
	}
}

/** @import { TemplateNode } from '#client' */

// TODO reinstate https://github.com/sveltejs/svelte/pull/15250

/**
 * @param {TemplateNode} node
 * @param {(branch: (fn: (anchor: Node) => void, flag?: boolean) => void) => void} fn
 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
 * @returns {void}
 */
function if_block(node, fn, elseif = false) {

	var branches = new BranchManager(node);
	var flags = elseif ? EFFECT_TRANSPARENT : 0;

	/**
	 * @param {boolean} condition,
	 * @param {null | ((anchor: Node) => void)} fn
	 */
	function update_branch(condition, fn) {

		branches.ensure(condition, fn);
	}

	block(() => {
		var has_branch = false;

		fn((fn, flag = true) => {
			has_branch = true;
			update_branch(flag, fn);
		});

		if (!has_branch) {
			update_branch(false, null);
		}
	}, flags);
}

/** @import { EachItem, EachState, Effect, MaybeSource, Source, TemplateNode, TransitionManager, Value } from '#client' */
/** @import { Batch } from '../../reactivity/batch.js'; */

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
 */
function pause_effects(state, items, controlled_anchor) {
	var items_map = state.items;

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
		link(state, items[0].prev, items[length - 1].next);
	}

	run_out_transitions(transitions, () => {
		for (var i = 0; i < length; i++) {
			var item = items[i];
			if (!is_controlled) {
				items_map.delete(item.k);
				link(state, item.prev, item.next);
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

	/** @type {Map<any, EachItem>} */
	var offscreen_items = new Map();

	// TODO: ideally we could use derived for runes mode but because of the ability
	// to use a store which can be mutated, we can't do that here as mutating a store
	// will still result in the collection array being the same from the store
	var each_array = derived_safe_equal(() => {
		var collection = get_collection();

		return is_array(collection) ? collection : collection == null ? [] : array_from(collection);
	});

	/** @type {V[]} */
	var array;

	/** @type {Effect} */
	var each_effect;

	function commit() {
		reconcile(
			each_effect,
			array,
			state,
			offscreen_items,
			anchor,
			render_fn,
			flags,
			get_key,
			get_collection
		);

		if (fallback_fn !== null) {
			if (array.length === 0) {
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
	}

	block(() => {
		// store a reference to the effect so that we can update the start/end nodes in reconciliation
		each_effect ??= /** @type {Effect} */ (active_effect);

		array = /** @type {V[]} */ (get$1(each_array));
		var length = array.length;

		if (was_empty && length === 0) {
			// ignore updates if the array is empty,
			// and it already was empty on previous run
			return;
		}
		was_empty = length === 0;

		// this is separate to the previous block because `hydrating` might change
		var item, value, key, i; 

		{
			if (should_defer_append()) {
				var keys = new Set();
				var batch = /** @type {Batch} */ (current_batch);

				for (i = 0; i < length; i += 1) {
					value = array[i];
					key = get_key(value, i);

					var existing = state.items.get(key) ?? offscreen_items.get(key);

					if (existing) {
						// update before reconciliation, to trigger any async updates
						if ((flags & (EACH_ITEM_REACTIVE | EACH_INDEX_REACTIVE)) !== 0) {
							update_item(existing, value, i, flags);
						}
					} else {
						item = create_item(
							null,
							state,
							null,
							null,
							value,
							key,
							i,
							render_fn,
							flags,
							get_collection,
							true
						);

						offscreen_items.set(key, item);
					}

					keys.add(key);
				}

				for (const [key, item] of state.items) {
					if (!keys.has(key)) {
						batch.skipped_effects.add(item.e);
					}
				}

				batch.oncommit(commit);
			} else {
				commit();
			}
		}

		// When we mount the each block for the first time, the collection won't be
		// connected to this effect as the effect hasn't finished running yet and its deps
		// won't be assigned. However, it's possible that when reconciling the each block
		// that a mutation occurred and it's made the collection MAYBE_DIRTY, so reading the
		// collection again can provide consistency to the reactive graph again as the deriveds
		// will now be `CLEAN`.
		get$1(each_array);
	});
}

/**
 * Add, remove, or reorder items output by an each block as its input changes
 * @template V
 * @param {Effect} each_effect
 * @param {Array<V>} array
 * @param {EachState} state
 * @param {Map<any, EachItem>} offscreen_items
 * @param {Element | Comment | Text} anchor
 * @param {(anchor: Node, item: MaybeSource<V>, index: number | Source<number>, collection: () => V[]) => void} render_fn
 * @param {number} flags
 * @param {(value: V, index: number) => any} get_key
 * @param {() => V[]} get_collection
 * @returns {void}
 */
function reconcile(
	each_effect,
	array,
	state,
	offscreen_items,
	anchor,
	render_fn,
	flags,
	get_key,
	get_collection
) {
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
			var pending = offscreen_items.get(key);

			if (pending !== undefined) {
				offscreen_items.delete(key);
				items.set(key, pending);

				var next = prev ? prev.next : current;

				link(state, prev, pending);
				link(state, pending, next);

				move(pending, next, anchor);
				prev = pending;
			} else {
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
					flags,
					get_collection
				);
			}

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

					link(state, a.prev, b.next);
					link(state, prev, a);
					link(state, b, start);

					current = start;
					prev = b;
					i -= 1;

					matched = [];
					stashed = [];
				} else {
					// more efficient to move earlier items to the back
					seen.delete(item);
					move(item, current, anchor);

					link(state, item.prev, item.next);
					link(state, item, prev === null ? state.first : prev.next);
					link(state, prev, item);

					prev = item;
				}

				continue;
			}

			matched = [];
			stashed = [];

			while (current !== null && current.k !== key) {
				// If the each block isn't inert and an item has an effect that is already inert,
				// skip over adding it to our seen Set as the item is already being handled
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
			// If the each block isn't inert, then inert effects are currently outroing and will be removed once the transition is finished
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

			pause_effects(state, to_destroy, controlled_anchor);
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

	each_effect.first = state.first && state.first.e;
	each_effect.last = prev && prev.e;

	for (var unused of offscreen_items.values()) {
		destroy_effect(unused.e);
	}

	offscreen_items.clear();
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
 * @param {Node | null} anchor
 * @param {EachState} state
 * @param {EachItem | null} prev
 * @param {EachItem | null} next
 * @param {V} value
 * @param {unknown} key
 * @param {number} index
 * @param {(anchor: Node, item: V | Source<V>, index: number | Value<number>, collection: () => V[]) => void} render_fn
 * @param {number} flags
 * @param {() => V[]} get_collection
 * @param {boolean} [deferred]
 * @returns {EachItem}
 */
function create_item(
	anchor,
	state,
	prev,
	next,
	value,
	key,
	index,
	render_fn,
	flags,
	get_collection,
	deferred
) {
	var reactive = (flags & EACH_ITEM_REACTIVE) !== 0;
	var mutable = (flags & EACH_ITEM_IMMUTABLE) === 0;

	var v = reactive ? (mutable ? mutable_source(value, false, false) : source(value)) : value;
	var i = (flags & EACH_INDEX_REACTIVE) === 0 ? index : source(index);

	if (DEV && reactive) {
		// For tracing purposes, we need to link the source signal we create with the
		// collection + index so that tracing works as intended
		/** @type {Value} */ (v).trace = () => {
			var collection_index = typeof i === 'number' ? index : i.v;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			get_collection()[collection_index];
		};
	}

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

	try {
		if (anchor === null) {
			var fragment = document.createDocumentFragment();
			fragment.append((anchor = create_text()));
		}

		item.e = branch(() => render_fn(/** @type {Node} */ (anchor), v, i, get_collection), hydrating);

		item.e.prev = prev && prev.e;
		item.e.next = next && next.e;

		if (prev === null) {
			if (!deferred) {
				state.first = item;
			}
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

	while (node !== null && node !== end) {
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
function link(state, prev, next) {
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
		slot_fn = $$props[name === 'default' ? 'children' : name];
		is_interop = true;
	}

	if (slot_fn === undefined) {
		if (fallback_fn !== null) {
			fallback_fn(anchor);
		}
	} else {
		slot_fn(anchor, is_interop ? () => slot_props : slot_props);
	}
}

const whitespace = [...' \t\n\r\f\u00a0\u000b\ufeff'];

/**
 * @param {any} value
 * @param {string | null} [hash]
 * @param {Record<string, boolean>} [directives]
 * @returns {string | null}
 */
function to_class(value, hash, directives) {
	var classname = value == null ? '' : '' + value;

	if (hash) {
		classname = classname ? classname + ' ' + hash : hash;
	}

	if (directives) {
		for (var key in directives) {
			if (directives[key]) {
				classname = classname ? classname + ' ' + key : key;
			} else if (classname.length) {
				var len = key.length;
				var a = 0;

				while ((a = classname.indexOf(key, a)) >= 0) {
					var b = a + len;

					if (
						(a === 0 || whitespace.includes(classname[a - 1])) &&
						(b === classname.length || whitespace.includes(classname[b]))
					) {
						classname = (a === 0 ? '' : classname.substring(0, a)) + classname.substring(b + 1);
					} else {
						a = b;
					}
				}
			}
		}
	}

	return classname === '' ? null : classname;
}

/**
 *
 * @param {Record<string,any>} styles
 * @param {boolean} important
 */
function append_styles(styles, important = false) {
	var separator = important ? ' !important;' : ';';
	var css = '';

	for (var key in styles) {
		var value = styles[key];
		if (value != null && value !== '') {
			css += ' ' + key + ': ' + value + separator;
		}
	}

	return css;
}

/**
 * @param {string} name
 * @returns {string}
 */
function to_css_name(name) {
	if (name[0] !== '-' || name[1] !== '-') {
		return name.toLowerCase();
	}
	return name;
}

/**
 * @param {any} value
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [styles]
 * @returns {string | null}
 */
function to_style(value, styles) {
	if (styles) {
		var new_style = '';

		/** @type {Record<string,any> | undefined} */
		var normal_styles;

		/** @type {Record<string,any> | undefined} */
		var important_styles;

		if (Array.isArray(styles)) {
			normal_styles = styles[0];
			important_styles = styles[1];
		} else {
			normal_styles = styles;
		}

		if (value) {
			value = String(value)
				.replaceAll(/\s*\/\*.*?\*\/\s*/g, '')
				.trim();

			/** @type {boolean | '"' | "'"} */
			var in_str = false;
			var in_apo = 0;
			var in_comment = false;

			var reserved_names = [];

			if (normal_styles) {
				reserved_names.push(...Object.keys(normal_styles).map(to_css_name));
			}
			if (important_styles) {
				reserved_names.push(...Object.keys(important_styles).map(to_css_name));
			}

			var start_index = 0;
			var name_index = -1;

			const len = value.length;
			for (var i = 0; i < len; i++) {
				var c = value[i];

				if (in_comment) {
					if (c === '/' && value[i - 1] === '*') {
						in_comment = false;
					}
				} else if (in_str) {
					if (in_str === c) {
						in_str = false;
					}
				} else if (c === '/' && value[i + 1] === '*') {
					in_comment = true;
				} else if (c === '"' || c === "'") {
					in_str = c;
				} else if (c === '(') {
					in_apo++;
				} else if (c === ')') {
					in_apo--;
				}

				if (!in_comment && in_str === false && in_apo === 0) {
					if (c === ':' && name_index === -1) {
						name_index = i;
					} else if (c === ';' || i === len - 1) {
						if (name_index !== -1) {
							var name = to_css_name(value.substring(start_index, name_index).trim());

							if (!reserved_names.includes(name)) {
								if (c !== ';') {
									i++;
								}

								var property = value.substring(start_index, i).trim();
								new_style += ' ' + property + ';';
							}
						}

						start_index = i + 1;
						name_index = -1;
					}
				}
			}
		}

		if (normal_styles) {
			new_style += append_styles(normal_styles);
		}

		if (important_styles) {
			new_style += append_styles(important_styles, true);
		}

		new_style = new_style.trim();
		return new_style === '' ? null : new_style;
	}

	return value == null ? null : String(value);
}

/**
 * @param {Element} dom
 * @param {boolean | number} is_html
 * @param {string | null} value
 * @param {string} [hash]
 * @param {Record<string, any>} [prev_classes]
 * @param {Record<string, any>} [next_classes]
 * @returns {Record<string, boolean> | undefined}
 */
function set_class(dom, is_html, value, hash, prev_classes, next_classes) {
	// @ts-expect-error need to add __className to patched prototype
	var prev = dom.__className;

	if (
		prev !== value ||
		prev === undefined // for edge case of `class={undefined}`
	) {
		var next_class_name = to_class(value, hash, next_classes);

		{
			// Removing the attribute when the value is only an empty string causes
			// performance issues vs simply making the className an empty string. So
			// we should only remove the class if the value is nullish
			// and there no hash/directives :
			if (next_class_name == null) {
				dom.removeAttribute('class');
			} else if (is_html) {
				dom.className = next_class_name;
			} else {
				dom.setAttribute('class', next_class_name);
			}
		}

		// @ts-expect-error need to add __className to patched prototype
		dom.__className = value;
	} else if (next_classes && prev_classes !== next_classes) {
		for (var key in next_classes) {
			var is_present = !!next_classes[key];

			if (prev_classes == null || is_present !== !!prev_classes[key]) {
				dom.classList.toggle(key, is_present);
			}
		}
	}

	return next_classes;
}

/**
 * @param {Element & ElementCSSInlineStyle} dom
 * @param {Record<string, any>} prev
 * @param {Record<string, any>} next
 * @param {string} [priority]
 */
function update_styles(dom, prev = {}, next, priority) {
	for (var key in next) {
		var value = next[key];

		if (prev[key] !== value) {
			if (next[key] == null) {
				dom.style.removeProperty(key);
			} else {
				dom.style.setProperty(key, value, priority);
			}
		}
	}
}

/**
 * @param {Element & ElementCSSInlineStyle} dom
 * @param {string | null} value
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [prev_styles]
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [next_styles]
 */
function set_style(dom, value, prev_styles, next_styles) {
	// @ts-expect-error
	var prev = dom.__style;

	if (prev !== value) {
		var next_style_attr = to_style(value, next_styles);

		{
			if (next_style_attr == null) {
				dom.removeAttribute('style');
			} else {
				dom.style.cssText = next_style_attr;
			}
		}

		// @ts-expect-error
		dom.__style = value;
	} else if (next_styles) {
		if (Array.isArray(next_styles)) {
			update_styles(dom, prev_styles?.[0], next_styles[0]);
			update_styles(dom, prev_styles?.[1], next_styles[1], 'important');
		} else {
			update_styles(dom, prev_styles, next_styles);
		}
	}

	return next_styles;
}

/** @import { Effect } from '#client' */

const IS_CUSTOM_ELEMENT = Symbol('is custom element');
const IS_HTML = Symbol('is html');

/**
 * @param {Element} element
 * @param {string} attribute
 * @param {string | null} value
 * @param {boolean} [skip_warning]
 */
function set_attribute(element, attribute, value, skip_warning) {
	var attributes = get_attributes(element);

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

/**
 *
 * @param {Element} element
 */
function get_attributes(element) {
	return /** @type {Record<string | symbol, unknown>} **/ (
		// @ts-expect-error
		element.__attributes ??= {
			[IS_CUSTOM_ELEMENT]: element.nodeName.includes('-'),
			[IS_HTML]: element.namespaceURI === NAMESPACE_HTML
		}
	);
}

/** @type {Map<string, string[]>} */
var setters_cache = new Map();

/** @param {Element} element */
function get_setters(element) {
	var cache_key = element.getAttribute('is') || element.nodeName;
	var setters = setters_cache.get(cache_key);
	if (setters) return setters;
	setters_cache.set(cache_key, (setters = []));

	var descriptors;
	var proto = element; // In the case of custom elements there might be setters on the instance
	var element_proto = Element.prototype;

	// Stop at Element, from there on there's only unnecessary setters we're not interested in
	// Do not use contructor.name here as that's unreliable in some browser environments
	while (element_proto !== proto) {
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

/** @import { Batch } from '../../../reactivity/batch.js' */

/**
 * @param {HTMLInputElement} input
 * @param {() => unknown} get
 * @param {(value: unknown) => void} set
 * @returns {void}
 */
function bind_value(input, get, set = get) {
	var batches = new WeakSet();

	listen_to_event_and_reset_event(input, 'input', async (is_reset) => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		/** @type {any} */
		var value = is_reset ? input.defaultValue : input.value;
		value = is_numberlike_input(input) ? to_number(value) : value;
		set(value);

		if (current_batch !== null) {
			batches.add(current_batch);
		}

		// Because `{#each ...}` blocks work by updating sources inside the flush,
		// we need to wait a tick before checking to see if we should forcibly
		// update the input and reset the selection state
		await tick();

		// Respect any validation in accessors
		if (value !== (value = get())) {
			var start = input.selectionStart;
			var end = input.selectionEnd;
			var length = input.value.length;

			// the value is coerced on assignment
			input.value = value ?? '';

			// Restore selection
			if (end !== null) {
				var new_length = input.value.length;
				// If cursor was at end and new input is longer, move cursor to new end
				if (start === end && end === length && new_length > length) {
					input.selectionStart = new_length;
					input.selectionEnd = new_length;
				} else {
					input.selectionStart = start;
					input.selectionEnd = Math.min(end, new_length);
				}
			}
		}
	});

	if (
		// If we are hydrating and the value has since changed,
		// then use the updated value from the input instead.
		// If defaultValue is set, then value == defaultValue
		// TODO Svelte 6: remove input.value check and set to empty string?
		(untrack(get) == null && input.value)
	) {
		set(is_numberlike_input(input) ? to_number(input.value) : input.value);

		if (current_batch !== null) {
			batches.add(current_batch);
		}
	}

	render_effect(() => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		var value = get();

		if (input === document.activeElement) {
			// we need both, because in non-async mode, render effects run before previous_batch is set
			var batch = /** @type {Batch} */ (previous_batch ?? current_batch);

			// Never rewrite the contents of a focused input. We can get here if, for example,
			// an update is deferred because of async work depending on the input:
			//
			// <input bind:value={query}>
			// <p>{await find(query)}</p>
			if (batches.has(batch)) {
				return;
			}
		}

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
	listen_to_event_and_reset_event(input, 'change', (is_reset) => {
		var value = is_reset ? input.defaultChecked : input.checked;
		set(value);
	});

	if (
		// If we are hydrating and the value has since changed,
		// then use the update value from the input instead.
		// If defaultChecked is set, then checked == defaultChecked
		untrack(get) == null
	) {
		set(input.checked);
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
			parts = get_parts?.() || [];

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

		props = () => get$1(d);
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
		for (const signal of context.l.s) get$1(signal);
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

		// @ts-expect-error
		if (invalidate) invalidate(undefined);

		return noop;
	}

	// Svelte store takes a private second argument
	// StartStopNotifier could mutate state, and we want to silence the corresponding validation error
	const unsub = untrack(() =>
		store.subscribe(
			run,
			// @ts-expect-error
			invalidate
		)
	);

	// Also support RxJS
	// @ts-expect-error TODO fix this in the types?
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
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

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 *
 * @template T
 * @param {Readable<T>} store
 * @returns {T}
 */
function get(store) {
	let value;
	subscribe_to_store(store, (_) => (value = _))();
	// @ts-expect-error
	return value;
}

/** @import { StoreReferencesContainer } from '#client' */
/** @import { Store } from '#shared' */

/**
 * Whether or not the prop currently being read is a store binding, as in
 * `<Child bind:x={$y} />`. If it is, we treat the prop as mutable even in
 * runes mode, and skip `binding_property_non_reactive` validation
 */
let is_store_binding = false;

let IS_UNMOUNTED = Symbol();

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

	if (DEV) {
		entry.source.label = store_name;
	}

	// if the component that setup this is already unmounted we don't want to register a subscription
	if (entry.store !== store && !(IS_UNMOUNTED in stores)) {
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

	// if the component that setup this stores is already unmounted the source will be out of sync
	// so we just use the `get` for the stores, less performant but it avoids to create a memory leak
	// and it will keep the value consistent
	if (store && IS_UNMOUNTED in stores) {
		return get(store);
	}

	return get$1(entry.source);
}

/**
 * Unsubscribes from all auto-subscribed stores on destroy
 * @returns {[StoreReferencesContainer, ()=>void]}
 */
function setup_stores() {
	/** @type {StoreReferencesContainer} */
	const stores = {};

	function cleanup() {
		teardown(() => {
			for (var store_name in stores) {
				const ref = stores[store_name];
				ref.unsubscribe();
			}
			define_property(stores, IS_UNMOUNTED, {
				enumerable: false,
				value: true
			});
		});
	}

	return [stores, cleanup];
}

/**
 * Returns a tuple that indicates whether `fn()` reads a prop that is a store binding.
 * Used to prevent `binding_property_non_reactive` validation false positives and
 * ensure that these props are treated as mutable even in runes mode
 * @template T
 * @param {() => T} fn
 * @returns {[T, boolean]}
 */
function capture_store_binding(fn) {
	var previous_is_store_binding = is_store_binding;

	try {
		is_store_binding = false;
		return [fn(), is_store_binding];
	} finally {
		is_store_binding = previous_is_store_binding;
	}
}

/** @import { Effect, Source } from './types.js' */

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
	var runes = !legacy_mode_flag || (flags & PROPS_IS_RUNES) !== 0;
	var bindable = (flags & PROPS_IS_BINDABLE) !== 0;
	var lazy = (flags & PROPS_IS_LAZY_INITIAL) !== 0;

	var fallback_value = /** @type {V} */ (fallback);
	var fallback_dirty = true;

	var get_fallback = () => {
		if (fallback_dirty) {
			fallback_dirty = false;

			fallback_value = lazy
				? untrack(/** @type {() => V} */ (fallback))
				: /** @type {V} */ (fallback);
		}

		return fallback_value;
	};

	/** @type {((v: V) => void) | undefined} */
	var setter;

	if (bindable) {
		// Can be the case when someone does `mount(Component, props)` with `let props = $state({...})`
		// or `createClassComponent(Component, props)`
		var is_entry_props = STATE_SYMBOL in props || LEGACY_PROPS in props;

		setter =
			get_descriptor(props, key)?.set ??
			(is_entry_props && key in props ? (v) => (props[key] = v) : undefined);
	}

	var initial_value;
	var is_store_sub = false;

	if (bindable) {
		[initial_value, is_store_sub] = capture_store_binding(() => /** @type {V} */ (props[key]));
	} else {
		initial_value = /** @type {V} */ (props[key]);
	}

	if (initial_value === undefined && fallback !== undefined) {
		initial_value = get_fallback();

		if (setter) {
			if (runes) props_invalid_value(key);
			setter(initial_value);
		}
	}

	/** @type {() => V} */
	var getter;

	if (runes) {
		getter = () => {
			var value = /** @type {V} */ (props[key]);
			if (value === undefined) return get_fallback();
			fallback_dirty = true;
			return value;
		};
	} else {
		getter = () => {
			var value = /** @type {V} */ (props[key]);

			if (value !== undefined) {
				// in legacy mode, we don't revert to the fallback value
				// if the prop goes from defined to undefined. The easiest
				// way to model this is to make the fallback undefined
				// as soon as the prop has a value
				fallback_value = /** @type {V} */ (undefined);
			}

			return value === undefined ? fallback_value : value;
		};
	}

	// prop is never written to — we only need a getter
	if (runes && (flags & PROPS_IS_UPDATED) === 0) {
		return getter;
	}

	// prop is written to, but the parent component had `bind:foo` which
	// means we can just call `$$props.foo = value` directly
	if (setter) {
		var legacy_parent = props.$$legacy;
		return /** @type {() => V} */ (
			function (/** @type {V} */ value, /** @type {boolean} */ mutation) {
				if (arguments.length > 0) {
					// We don't want to notify if the value was mutated and the parent is in runes mode.
					// In that case the state proxy (if it exists) should take care of the notification.
					// If the parent is not in runes mode, we need to notify on mutation, too, that the prop
					// has changed because the parent will not be able to detect the change otherwise.
					if (!runes || !mutation || legacy_parent || is_store_sub) {
						/** @type {Function} */ (setter)(mutation ? getter() : value);
					}

					return value;
				}

				return getter();
			}
		);
	}

	// Either prop is written to, but there's no binding, which means we
	// create a derived that we can write to locally.
	// Or we are in legacy mode where we always create a derived to replicate that
	// Svelte 4 did not trigger updates when a primitive value was updated to the same value.
	var overridden = false;

	var d = ((flags & PROPS_IS_IMMUTABLE) !== 0 ? derived : derived_safe_equal)(() => {
		overridden = false;
		return getter();
	});

	if (DEV) {
		d.label = key;
	}

	// Capture the initial value if it's bindable
	if (bindable) get$1(d);

	var parent_effect = /** @type {Effect} */ (active_effect);

	return /** @type {() => V} */ (
		function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
			if (arguments.length > 0) {
				const new_value = mutation ? get$1(d) : runes && bindable ? proxy(value) : value;

				set(d, new_value);
				overridden = true;

				if (fallback_value !== undefined) {
					fallback_value = new_value;
				}

				return value;
			}

			// special case — avoid recalculating the derived if we're in a
			// teardown function and the prop was overridden locally, or the
			// component was already destroyed (this latter part is necessary
			// because `bind:this` can read props after the component has
			// been destroyed. TODO simplify `bind:this`
			if ((is_destroying_effect && overridden) || (parent_effect.f & DESTROYED) !== 0) {
				return d.v;
			}

			return get$1(d);
		}
	);
}

/** @import { ComponentContext, ComponentContextLegacy } from '#client' */
/** @import { EventDispatcher } from './index.js' */
/** @import { NotFunction } from './internal/types.js' */

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

/**
 * `onMount`, like [`$effect`](https://svelte.dev/docs/svelte/$effect), schedules a function to run as soon as the component has been mounted to the DOM.
 * Unlike `$effect`, the provided function only runs once.
 *
 * It must be called during the component's initialisation (but doesn't need to live _inside_ the component;
 * it can be called from an external module). If a function is returned _synchronously_ from `onMount`,
 * it will be called when the component is unmounted.
 *
 * `onMount` functions do not run during [server-side rendering](https://svelte.dev/docs/svelte/svelte-server#render).
 *
 * @template T
 * @param {() => NotFunction<T> | Promise<NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	if (component_context === null) {
		lifecycle_outside_component('onMount');
	}

	if (legacy_mode_flag && component_context.l !== null) {
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

if (typeof window !== 'undefined') {
	// @ts-expect-error
	((window.__svelte ??= {}).v ??= new Set()).add(PUBLIC_VERSION);
}

enable_legacy_mode_flag();

var root_1$6 = from_html(`<div class="menu-item svelte-1gqilec"><i class="material-icons-outlined icon svelte-1gqilec"> </i> <div class="tooltip svelte-1gqilec"> </div></div>`);
var root$7 = from_html(`<div class="menu svelte-1gqilec"></div>`);

function Vscode_side_menu($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, 'tx', 8),
		sx = prop($$props, 'sx', 8);

	// this.menu
	let floatingDiv = mutable_source();

	let symbols = mutable_source(sx());

	onMount(() => {
		// send the div
		tx().send("div", get$1(floatingDiv));
	});

	const handlers = {
		"onSetMenu"(newSymbols) {
			set(symbols, newSymbols);
		}
	};

	function menuClick(e) {
		const index = e.target.getAttribute("data-index");

		if (get$1(symbols)[index].message?.length > 0) tx().send(get$1(symbols)[index].message, e);
	}

	function keydown(e) {}

	var $$exports = { handlers };

	init();

	var div = root$7();

	each(div, 5, () => get$1(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$6();
		var i = child(div_1);

		set_attribute(i, 'data-index', index);

		var text = child(i);

		var div_2 = sibling(i, 2);
		var text_1 = child(div_2);

		template_effect(() => {
			set_style(i, `color: ${(get$1(symbol), untrack(() => get$1(symbol).color)) ?? ''};`);
			set_text(text, (get$1(symbol), untrack(() => get$1(symbol).icon)));

			set_style(div_2, `width: ${(
				get$1(symbol),
				untrack(() => get$1(symbol).help.length * 0.5)
			) ?? ''}rem;`);

			set_text(text_1, (get$1(symbol), untrack(() => get$1(symbol).help)));
		});

		event('click', i, menuClick);
		event('keydown', i, keydown);
		append($$anchor, div_1);
	});
	bind_this(div, ($$value) => set(floatingDiv, $$value), () => get$1(floatingDiv));
	append($$anchor, div);
	bind_prop($$props, 'handlers', handlers);

	return pop($$exports);
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

var root_1$5 = from_html(`<i class="material-icons-outlined open svelte-16f3fxd">description</i>`);
var root_2$4 = from_html(`<i class="material-icons-outlined open svelte-16f3fxd">add_circle</i>`);
var root_3$2 = from_html(`<div class="right-icons svelte-16f3fxd"><i class="material-icons-outlined trash svelte-16f3fxd">delete</i></div>`);
var root$6 = from_html(`<div><div class="hdr svelte-16f3fxd"><div class="left-icons svelte-16f3fxd"><i class="material-icons-outlined cancel svelte-16f3fxd">cancel</i> <i class="material-icons-outlined check svelte-16f3fxd">check_circle</i> <!> <!></div> <h1> </h1> <!></div> <!></div>`);

function Popup_box($$anchor, $$props) {
	push($$props, false);

	const $theme = () => store_get(theme, '$theme', $$stores);
	const [$$stores, $$cleanup] = setup_stores();

	// box = {title, pos, ok, cancel, open, show, hide, update}
	let box = prop($$props, 'box', 12);

	// dragging behaviour
	let startX, startY, initialLeft, initialTop;

	let dragging = false;
	let pendingShowPos = null;

	// Handlers can receive a request as soon as the runtime starts. Install the
	// popup API synchronously so an early request can use show() and let it queue
	// the position until the DOM node is mounted.
	box(box().show = show, true);

	box(box().hide = hide, true);
	box(box().update = () => box(box()), true);

	onMount(() => {
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
		if (box().ok?.(e) !== false) hide();
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
		return e.key == "Enter"
			? onOk(e)
			: e.key == "Escape" || e.key == "Esc" ? onCancel(e) : null;
	}

	init();

	var div = root$6();
	var div_1 = child(div);
	var div_2 = child(div_1);
	var i = child(div_2);
	var i_1 = sibling(i, 2);
	var node = sibling(i_1, 2);

	{
		var consequent = ($$anchor) => {
			var i_2 = root_1$5();

			event('click', i_2, onOpen);
			event('keydown', i_2, onKeydown);
			append($$anchor, i_2);
		};

		if_block(node, ($$render) => {
			if ((deep_read_state(box()), untrack(() => box().open))) $$render(consequent);
		});
	}

	var node_1 = sibling(node, 2);

	{
		var consequent_1 = ($$anchor) => {
			var i_3 = root_2$4();

			event('click', i_3, onAdd);
			event('keydown', i_3, onKeydown);
			append($$anchor, i_3);
		};

		if_block(node_1, ($$render) => {
			if ((deep_read_state(box()), untrack(() => box().add))) $$render(consequent_1);
		});
	}

	var h1 = sibling(div_2, 2);
	let classes;
	var text = child(h1);

	var node_2 = sibling(h1, 2);

	{
		var consequent_2 = ($$anchor) => {
			var div_3 = root_3$2();
			var i_4 = child(div_3);
			event('click', i_4, onTrash);
			event('keydown', i_4, onKeydown);
			append($$anchor, div_3);
		};

		if_block(node_2, ($$render) => {
			if ((deep_read_state(box()), untrack(() => box().trash))) $$render(consequent_2);
		});
	}

	var node_3 = sibling(div_1, 2);

	slot(node_3, $$props, 'default', {}, null);
	bind_this(div, ($$value) => box(box().div = $$value, true), () => box()?.div);

	template_effect(() => {
		set_class(div, 1, `main ${$theme() ?? ''}`, 'svelte-16f3fxd');
		classes = set_class(h1, 1, 'svelte-16f3fxd', null, classes, { largeTitle: box().largeTitle });
		set_text(text, (deep_read_state(box()), untrack(() => box().title)));
	});

	event('click', i, onCancel);
	event('keydown', i, onKeydown);
	event('click', i_1, onOk);
	event('keydown', i_1, onKeydown);
	event('mousedown', div_1, onMouseDown);
	event('keydown', div, onKeydown);
	append($$anchor, div);
	pop();
	$$cleanup();
}

var root$5 = from_html(`<input type="checkbox" class="svelte-wgdzge"/>`);

function Checkbox($$anchor, $$props) {
	push($$props, false);

	let style = prop($$props, 'style', 8);
	let on = prop($$props, 'on', 12);
	let onToggle = prop($$props, 'onToggle', 8);
	let disabled = prop($$props, 'disabled', 8, false);

	// call the on color function if requested
	function onInput() {
		onToggle()?.(on());
	}

	init();

	var input = root$5();

	template_effect(() => {
		set_style(input, style() ? style() : '');
		input.disabled = disabled();
	});

	bind_checked(input, on);
	event('change', input, onInput);
	append($$anchor, input);
	pop();
}

var root$4 = from_html(`<div class="label-checkbox svelte-1isfpfn"><label class="svelte-1isfpfn"> </label> <div class="checkbox-field svelte-1isfpfn"><!> <!></div></div>`);

function Label_checkbox($$anchor, $$props) {
	let label = prop($$props, 'label', 8);
	let on = prop($$props, 'on', 12);
	let style = prop($$props, 'style', 8, 'width: 9rem;');
	let onToggle = prop($$props, 'onToggle', 8);
	let disabled = prop($$props, 'disabled', 8, false);
	var div = root$4();
	var label_1 = child(div);
	var text = child(label_1);

	var div_1 = sibling(label_1, 2);
	var node = child(div_1);

	Checkbox(node, {
		get onToggle() {
			return onToggle();
		},

		get disabled() {
			return disabled();
		},

		get on() {
			return on();
		},

		set on($$value) {
			on($$value);
		},

		$$legacy: true
	});

	var node_1 = sibling(node, 2);

	slot(node_1, $$props, 'default', {}, null);

	template_effect(() => {
		set_style(label_1, style());
		set_text(text, label());
	});

	append($$anchor, div);
}

var root_2$3 = from_html(`<li role="option"> </li>`);
var root_1$4 = from_html(`<ul role="listbox" class="svelte-1vrac7q"></ul>`);
var root$3 = from_html(`<div class="select-field svelte-1vrac7q"><label class="svelte-1vrac7q"> </label> <div class="select-box svelte-1vrac7q"><button type="button" aria-haspopup="listbox" class="svelte-1vrac7q"> <span class="arrow svelte-1vrac7q">▾</span></button> <!></div></div>`);

function Label_select($$anchor, $$props) {
	push($$props, false);

	const selected = mutable_source();
	const selectedLabel = mutable_source();
	let label = prop($$props, 'label', 8);
	let value = prop($$props, 'value', 12);
	let options = prop($$props, 'options', 24, () => []);
	let style = prop($$props, 'style', 8, 'width: 9rem;');
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	let labelId = fid + '-label';
	let open = mutable_source(false);

	function optionValue(option) {
		return typeof option === 'object' ? option.value : option;
	}

	function optionLabel(option) {
		return typeof option === 'object' ? option.label : option;
	}

	onMount(() => {
		function onDocumentClick() {
			set(open, false);
		}

		document.addEventListener('click', onDocumentClick);

		return () => {
			document.removeEventListener('click', onDocumentClick);
		};
	});

	function toggleOpen() {
		set(open, !get$1(open));
	}

	function choose(option) {
		value(optionValue(option));
		set(open, false);
	}

	function onKeydown(e) {
		if (e.key === 'Escape') {
			set(open, false);
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleOpen();
		}
	}

	legacy_pre_effect(() => (deep_read_state(options()), deep_read_state(value())), () => {
		set(selected, options().find((option) => optionValue(option) === value()));
	});

	legacy_pre_effect(() => (get$1(selected)), () => {
		set(selectedLabel, get$1(selected) ? optionLabel(get$1(selected)) : '');
	});

	legacy_pre_effect_reset();
	init();

	var div = root$3();
	var label_1 = child(div);
	var text = child(label_1);

	var div_1 = sibling(label_1, 2);
	var button = child(div_1);
	var text_1 = child(button);

	var node = sibling(button, 2);

	{
		var consequent = ($$anchor) => {
			var ul = root_1$4();

			each(ul, 5, options, index, ($$anchor, option) => {
				var li = root_2$3();
				let classes;
				var text_2 = child(li);

				template_effect(
					($0, $1, $2) => {
						set_attribute(li, 'aria-selected', $0);
						classes = set_class(li, 1, 'svelte-1vrac7q', null, classes, $1);
						set_text(text_2, $2);
					},
					[
						() => (
							get$1(option),
							deep_read_state(value()),
							untrack(() => optionValue(get$1(option)) === value())
						),

						() => ({ selected: optionValue(get$1(option)) === value() }),
						() => (get$1(option), untrack(() => optionLabel(get$1(option))))
					]
				);

				event('click', li, () => choose(get$1(option)));
				event('keydown', li, onKeydown);
				append($$anchor, li);
			});
			template_effect(() => set_attribute(ul, 'aria-labelledby', labelId));
			append($$anchor, ul);
		};

		if_block(node, ($$render) => {
			if (get$1(open)) $$render(consequent);
		});
	}

	template_effect(() => {
		set_attribute(label_1, 'id', labelId);
		set_style(label_1, style());
		set_text(text, label());
		set_attribute(button, 'id', fid);
		set_attribute(button, 'aria-labelledby', labelId);
		set_attribute(button, 'aria-expanded', get$1(open));
		set_text(text_1, get$1(selectedLabel));
	});

	event('click', button, toggleOpen);
	event('keydown', button, onKeydown);

	event('click', div_1, stopPropagation(function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	}));

	append($$anchor, div);
	pop();
}

var root$2 = from_html(`<div class="textarea-field svelte-1uuyv1k"><label class="svelte-1uuyv1k"> </label> <textarea spellcheck="false" class="svelte-1uuyv1k"></textarea></div>`);

function Label_textarea($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, 'label', 8);
	let text = prop($$props, 'text', 12);
	let style = prop($$props, 'style', 8, 'width: 9rem;');
	let disabled = prop($$props, 'disabled', 8, false);
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	init();

	var div = root$2();
	var label_1 = child(div);
	var text_1 = child(label_1);

	var textarea = sibling(label_1, 2);

	template_effect(() => {
		set_attribute(label_1, 'for', fid);
		set_style(label_1, style());
		set_text(text_1, label());
		set_attribute(textarea, 'id', fid);
		textarea.disabled = disabled();
	});

	bind_value(textarea, text);

	event('keydown', textarea, stopPropagation(function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	}));

	append($$anchor, div);
	pop();
}

var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

var regex = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;

// Utilities
//


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
const HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');

// HTML block


// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
//
[
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/,        /-->/,   true],
  [/^<\?/,         /\?>/,   true],
  [/^<![A-Z]/,     />/,     true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true],
  [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false]
];

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

// Process escaped chars and hardbreaks


const ESCAPED = [];

for (let i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function (ch) { ESCAPED[ch.charCodeAt(0)] = 1; });

var root$1 = from_html(`<div class="input-field svelte-1k8nfap"><label class="svelte-1k8nfap"> </label> <input type="text" spellcheck="false" class="svelte-1k8nfap"/></div>`);

function Label_input_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, 'label', 8),
		input = prop($$props, 'input', 12),
		style = prop($$props, 'style', 8),
		check = prop($$props, 'check', 8);

	let field = mutable_source();
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	const setFieldWidth = () => {
		mutate(field, get$1(field).style.width = '0px');
		mutate(field, get$1(field).style.width = get$1(field).scrollWidth + 2 + 'px');
	};

	// color to indicate good/bad input
	let savedColor = null;

	const badInputColor = "#ff0000";

	onMount(() => {
		// save the good color
		savedColor = get$1(field).style.color;

		// Set input width based on its scrollWidth (for initial value)
		setFieldWidth();
	});

	function onInput(e) {
		// reinitialize the width
		setFieldWidth();

		// Do we need to check 
		if (!check()) return;

		// show disapproval when input is nok
		mutate(field, get$1(field).style.color = check()(e.target.value) ? savedColor : badInputColor);
	}

	legacy_pre_effect(() => (get$1(field)), () => {
		if (get$1(field)) setFieldWidth();
	});

	legacy_pre_effect_reset();
	init();

	var div = root$1();
	var label_1 = child(div);
	var text = child(label_1);

	var input_1 = sibling(label_1, 2);
	bind_this(input_1, ($$value) => set(field, $$value), () => get$1(field));

	template_effect(() => {
		set_attribute(label_1, 'for', fid);
		set_style(label_1, style());
		set_text(text, label());
		set_attribute(input_1, 'id', fid);
	});

	bind_value(input_1, input);
	event('input', input_1, onInput);
	event('click', input_1, onInput);
	append($$anchor, div);
	pop();
}

var root_1$3 = from_html(`<button class="open-file svelte-1gvp99k" type="button" title="Open file" aria-label="Open file"><span class="material-icons-outlined svelte-1gvp99k">file_open</span></button>`);
var root_3$1 = from_html(`<li><span class="material-icons-outlined kind svelte-1gvp99k"> </span> <span class="name svelte-1gvp99k"> </span></li>`);
var root_2$2 = from_html(`<ul class="suggestions svelte-1gvp99k"></ul>`);
var root = from_html(`<div class="input-field svelte-1gvp99k"><label class="svelte-1gvp99k"> </label> <!> <input type="text" spellcheck="false"/></div> <!>`, 1);

function Path_input_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, 'label', 8);
	let input = prop($$props, 'input', 12, '');
	let style = prop($$props, 'style', 8);
	let check = prop($$props, 'check', 8);
	let maxSuggestions = prop($$props, 'maxSuggestions', 8, 12);
	let fileExtensions = prop($$props, 'fileExtensions', 8, '');
	let getFolder = prop($$props, 'getFolder', 8, null);
	let openFile = prop($$props, 'openFile', 8, null);
	let showOpenFile = prop($$props, 'showOpenFile', 8, false);
	let field = mutable_source();
	let listOpen = mutable_source(false);
	let activeIndex = mutable_source(-1);
	let suggestions = mutable_source([]);
	let queryToken = 0;
	let listRect = mutable_source(null);
	let cachedFolderPath = null;
	let cachedFolder = { folders: [], files: [] };
	let hasOpenFile = mutable_source(false);
	const fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	const badInputColor = '#ff0000';
	let savedColor = null;

	const setFieldWidth = () => {
		if (!get$1(field)) return;

		mutate(field, get$1(field).style.width = '0px');
		mutate(field, get$1(field).style.width = get$1(field).scrollWidth + 2 + 'px');
	};

	function updateListRect() {
		if (!get$1(field)) return;

		const rect = get$1(field).getBoundingClientRect();
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
			return { folderPath: normalized, partial: '', prefix: normalized };
		}

		const slash = normalized.lastIndexOf('/');

		if (slash < 0) return { folderPath: '', partial: normalized, prefix: '' };

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
		const token = ++queryToken;
		const { folderPath, partial, prefix } = splitInput(value);
		const allowedExtensions = parseExtensionFilter(fileExtensions());

		try {
			const stillCurrent = await ensureFolderLoaded(folderPath, token);

			if (!stillCurrent || token !== queryToken) return;

			const lowerPartial = partial.toLowerCase();
			const nextSuggestions = [];

			for (const name of cachedFolder.folders ?? []) {
				if (partial && !name.toLowerCase().startsWith(lowerPartial)) continue;

				nextSuggestions.push({ name, kind: 'directory', value: prefix + name + '/' });
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
			set(activeIndex, get$1(suggestions).length ? 0 : -1);
			set(listOpen, get$1(suggestions).length > 0);

			if (get$1(listOpen)) updateListRect();
		} catch {
			if (token !== queryToken) return;

			set(suggestions, []);
			set(activeIndex, -1);
			set(listOpen, false);
		}
	}

	function updateInputState(value) {
		setFieldWidth();

		if (!check() || !get$1(field)) return;

		mutate(field, get$1(field).style.color = check()(value) ? savedColor : badInputColor);
	}

	function onInput(e) {
		updateInputState(e.target.value);
		updateSuggestions(e.target.value);
	}

	function applySuggestion(suggestion) {
		input(suggestion.value);
		updateInputState(input());
		updateSuggestions(input());
		get$1(field)?.focus();
	}

	function onKeydown(e) {
		if (!get$1(listOpen) || !get$1(suggestions).length) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				e.stopPropagation();
				set(activeIndex, (get$1(activeIndex) + 1) % get$1(suggestions).length);
				break;

			case 'ArrowUp':
				e.preventDefault();
				e.stopPropagation();
				set(activeIndex, (get$1(activeIndex) - 1 + get$1(suggestions).length) % get$1(suggestions).length);
				break;

			case 'Enter':

			case 'Tab':
				if (get$1(activeIndex) < 0) return;
				e.preventDefault();
				e.stopPropagation();
				applySuggestion(get$1(suggestions)[get$1(activeIndex)]);
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

	function openInputFile() {
		const target = String(input() ?? '').trim();

		if (target && typeof openFile() === 'function') openFile()(target);
	}

	onMount(() => {
		savedColor = get$1(field).style.color;
		setFieldWidth();
		updateInputState(input());

		const onViewportChange = () => {
			if (get$1(listOpen)) updateListRect();
		};

		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, true);

		return () => {
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange, true);
		};
	});

	legacy_pre_effect(() => (get$1(field)), () => {
		if (get$1(field)) setFieldWidth();
	});

	legacy_pre_effect(() => (get$1(field), get$1(listOpen)), () => {
		if (get$1(field) && get$1(listOpen)) updateListRect();
	});

	legacy_pre_effect(
		() => (
			deep_read_state(showOpenFile()),
			deep_read_state(openFile())
		),
		() => {
			set(hasOpenFile, showOpenFile() || typeof openFile() === 'function');
		}
	);

	legacy_pre_effect_reset();
	init();

	var fragment = root();
	var div = first_child(fragment);
	var label_1 = child(div);
	var text = child(label_1);

	var node = sibling(label_1, 2);

	{
		var consequent = ($$anchor) => {
			var button = root_1$3();

			template_effect(($0) => button.disabled = $0, [
				() => (
					deep_read_state(input()),
					deep_read_state(openFile()),
					untrack(() => !String(input() ?? '').trim() || typeof openFile() !== 'function')
				)
			]);

			event('mousedown', button, preventDefault(stopPropagation(function ($$arg) {
				bubble_event.call(this, $$props, $$arg);
			})));

			event('click', button, stopPropagation(openInputFile));
			append($$anchor, button);
		};

		if_block(node, ($$render) => {
			if (get$1(hasOpenFile)) $$render(consequent);
		});
	}

	var input_1 = sibling(node, 2);

	let classes;

	bind_this(input_1, ($$value) => set(field, $$value), () => get$1(field));

	var node_1 = sibling(div, 2);

	{
		var consequent_1 = ($$anchor) => {
			var ul = root_2$2();

			each(ul, 5, () => get$1(suggestions), index, ($$anchor, suggestion, index) => {
				var li = root_3$1();
				let classes_1;
				var span = child(li);
				var text_1 = child(span);

				var span_1 = sibling(span, 2);
				var text_2 = child(span_1);

				template_effect(() => {
					classes_1 = set_class(li, 1, 'svelte-1gvp99k', null, classes_1, { active: index === get$1(activeIndex) });

					set_text(text_1, (
						get$1(suggestion),
						untrack(() => get$1(suggestion).kind === 'directory' ? 'folder' : 'file_open')
					));

					set_text(text_2, (get$1(suggestion), untrack(() => get$1(suggestion).value)));
				});

				event('mousedown', li, preventDefault(() => applySuggestion(get$1(suggestion))));
				append($$anchor, li);
			});

			template_effect(() => set_style(ul, (
				get$1(listRect),
				untrack(() => `left:${get$1(listRect).left}px; top:${get$1(listRect).top}px; min-width:${get$1(listRect).minWidth}px; max-width:min(36rem, calc(100vw - ${get$1(listRect).left + 16}px));`)
			)));

			append($$anchor, ul);
		};

		if_block(node_1, ($$render) => {
			if ((
				get$1(listOpen),
				get$1(suggestions),
				get$1(listRect),
				untrack(() => get$1(listOpen) && get$1(suggestions).length && get$1(listRect))
			)) $$render(consequent_1);
		});
	}

	template_effect(() => {
		set_attribute(label_1, 'for', fid);
		set_style(label_1, style());
		set_text(text, label());
		set_attribute(input_1, 'id', fid);
		classes = set_class(input_1, 1, 'svelte-1gvp99k', null, classes, { 'has-open-file': get$1(hasOpenFile) });
	});

	bind_value(input_1, input);
	event('input', input_1, onInput);
	event('click', input_1, onInput);
	event('keydown', input_1, onKeydown);
	event('focus', input_1, onFocus);
	event('blur', input_1, onBlur);
	append($$anchor, fragment);
	pop();
}

var root_2$1 = from_html(`<div class="reference-row svelte-1osxllq"><div class="reference-fields svelte-1osxllq"><!> <!> <!> <!> <!></div> <button class="remove svelte-1osxllq" type="button" title="Remove reference">remove</button></div>`);
var root_3 = from_html(`<p class="error svelte-1osxllq"> </p>`);
var root_1$2 = from_html(`<div class="inspector svelte-1osxllq"><!> <!> <!> <div class="references-header svelte-1osxllq"><span>Typed references</span> <button type="button" title="Add reference" class="svelte-1osxllq">+ Add reference</button></div> <!> <!></div>`);

function Application_inspector($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, 'tx', 8);

	const referenceKinds = [
		'documentation',
		'model',
		'source',
		'build',
		'deployment',
		'test',
		'operations',
		'other'
	];

	const labelStyle = 'width: 5rem;';
	const referenceLabelStyle = 'width: 7.5rem;';
	let box = mutable_source({ div: null, pos: null, title: '', ok: null, cancel: null });
	let name = mutable_source('');
	let role = mutable_source('');
	let vmblu = mutable_source(true);
	let references = mutable_source([]);
	let error = mutable_source('');

	onMount(() => tx().send('modal div', get$1(box).div));

	function cloneReferences(value) {
		return (value ?? []).map((reference) => ({ ...reference }));
	}

	function addReference() {
		set(references, [
			...get$1(references),
			{ kind: 'documentation', label: '', target: '' }
		]);
	}

	function removeReference(index) {
		set(references, get$1(references).filter((_, candidate) => candidate !== index));
	}

	function submit(ok) {
		const cleanName = get$1(name).trim();

		const cleanReferences = get$1(references).map((reference) => {
			const command = reference.command?.trim();
			const workingDirectory = reference.workingDirectory?.trim();

			const clean = {
				...reference,
				kind: reference.kind?.trim(),
				label: reference.label?.trim(),
				target: reference.target?.trim()
			};

			if (command || workingDirectory) {
				clean.command = command;
				clean.workingDirectory = workingDirectory;
			} else {
				delete clean.command;
				delete clean.workingDirectory;
			}

			return clean;
		});

		if (!cleanName) set(error, 'The application name is required.'); else if (cleanReferences.some((reference) => !reference.kind || !reference.target)) {
			set(error, 'Every reference needs a kind and path.');
		} else if (cleanReferences.some((reference) => Boolean(reference.command) !== Boolean(reference.workingDirectory))) {
			set(error, 'A command reference needs both a command and working directory.');
		} else {
			set(error, '');

			ok?.({
				name: cleanName,
				role: get$1(role).trim(),
				vmblu: get$1(vmblu),
				references: cleanReferences
			});

			return true;
		}

		return false;
	}

	const handlers = {
		onApplicationSettings({ pos, application, ok, cancel, trash }) {
			set(name, application?.name ?? '');
			set(role, application?.description ?? '');
			set(vmblu, application?.vmblu !== false);
			set(references, cloneReferences(application?.references));
			set(error, '');
			mutate(box, get$1(box).title = 'Application');
			mutate(box, get$1(box).largeTitle = true);
			mutate(box, get$1(box).pos = { ...pos });
			mutate(box, get$1(box).ok = () => submit(ok));
			mutate(box, get$1(box).cancel = cancel ? () => cancel() : null);
			mutate(box, get$1(box).trash = trash ? () => trash() : null);
			get$1(box).show(pos);
		}
	};

	var $$exports = { handlers };

	init();

	Popup_box($$anchor, {
		get box() {
			return get$1(box);
		},

		children: ($$anchor, $$slotProps) => {
			var div = root_1$2();
			var node = child(div);

			Label_input_field(node, {
				label: 'Name',
				style: labelStyle,
				check: (value) => Boolean(value.trim()),

				get input() {
					return get$1(name);
				},

				set input($$value) {
					set(name, $$value);
				},

				$$legacy: true
			});

			var node_1 = sibling(node, 2);

			Label_textarea(node_1, {
				label: 'Role',
				style: labelStyle,

				get text() {
					return get$1(role);
				},

				set text($$value) {
					set(role, $$value);
				},

				$$legacy: true
			});

			var node_2 = sibling(node_1, 2);

			Label_checkbox(node_2, {
				label: 'vmblu application',
				style: labelStyle,

				get on() {
					return get$1(vmblu);
				},

				set on($$value) {
					set(vmblu, $$value);
				},

				$$legacy: true
			});

			var div_1 = sibling(node_2, 2);
			var button = sibling(child(div_1), 2);

			var node_3 = sibling(div_1, 2);

			each(node_3, 1, () => get$1(references), index, ($$anchor, reference, index) => {
				var div_2 = root_2$1();
				var div_3 = child(div_2);
				var node_4 = child(div_3);

				Label_select(node_4, {
					label: 'Kind',
					style: referenceLabelStyle,

					get options() {
						return referenceKinds;
					},

					get value() {
						return get$1(reference).kind;
					},

					set value($$value) {
						(
							get$1(reference).kind = $$value,
							invalidate_inner_signals(() => (get$1(references)))
						);
					},

					$$legacy: true
				});

				var node_5 = sibling(node_4, 2);

				Label_input_field(node_5, {
					label: 'Label',
					style: referenceLabelStyle,
					check: null,

					get input() {
						return get$1(reference).label;
					},

					set input($$value) {
						(
							get$1(reference).label = $$value,
							invalidate_inner_signals(() => (get$1(references)))
						);
					},

					$$legacy: true
				});

				var node_6 = sibling(node_5, 2);

				Path_input_field(node_6, {
					label: 'Path or URL',
					style: referenceLabelStyle,
					check: (value) => Boolean(value.trim()),

					get input() {
						return get$1(reference).target;
					},

					set input($$value) {
						(
							get$1(reference).target = $$value,
							invalidate_inner_signals(() => (get$1(references)))
						);
					},

					$$legacy: true
				});

				var node_7 = sibling(node_6, 2);

				Label_input_field(node_7, {
					label: 'Command',
					style: referenceLabelStyle,
					check: null,

					get input() {
						return get$1(reference).command;
					},

					set input($$value) {
						(
							get$1(reference).command = $$value,
							invalidate_inner_signals(() => (get$1(references)))
						);
					},

					$$legacy: true
				});

				var node_8 = sibling(node_7, 2);

				Path_input_field(node_8, {
					label: 'Working directory',
					style: referenceLabelStyle,
					check: null,

					get input() {
						return get$1(reference).workingDirectory;
					},

					set input($$value) {
						(
							get$1(reference).workingDirectory = $$value,
							invalidate_inner_signals(() => (get$1(references)))
						);
					},

					$$legacy: true
				});

				var button_1 = sibling(div_3, 2);
				event('click', button_1, () => removeReference(index));
				append($$anchor, div_2);
			});

			var node_9 = sibling(node_3, 2);

			{
				var consequent = ($$anchor) => {
					var p = root_3();
					var text = child(p);
					template_effect(() => set_text(text, get$1(error)));
					append($$anchor, p);
				};

				if_block(node_9, ($$render) => {
					if (get$1(error)) $$render(consequent);
				});
			}
			event('click', button, addReference);
			append($$anchor, div);
		},

		$$slots: { default: true }
	});

	bind_prop($$props, 'handlers', handlers);

	return pop($$exports);
}

var root_2 = from_html(`<p class="error svelte-30k4gm"> </p>`);
var root_1$1 = from_html(`<div class="inspector svelte-30k4gm"><!> <!> <!> <!> <!></div>`);

function Endpoint_inspector($$anchor, $$props) {
	push($$props, false);

	let tx = prop($$props, 'tx', 8);
	const roles = ['client', 'server', 'peer'];
	const labelStyle = 'width: 7rem;';
	let box = mutable_source({ div: null, pos: null, title: '', ok: null, cancel: null });
	let original = {};
	let existingIds = [];
	let name = mutable_source('');
	let protocol = mutable_source('');
	let role = mutable_source('client');
	let remarks = mutable_source('');
	let error = mutable_source('');
	let openProtocol = mutable_source(null);

	onMount(() => tx().send('modal div', get$1(box).div));

	function slug(value) {
		return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'endpoint';
	}

	function uniqueId(value) {
		if (original.id) return original.id;

		const base = slug(value);
		let id = base;
		let suffix = 2;

		while (existingIds.includes(id)) id = `${base}-${suffix++}`;

		return id;
	}

	function submit(ok) {
		const cleanName = get$1(name).trim();
		const cleanProtocol = get$1(protocol).trim();

		if (!cleanName) set(error, 'The endpoint name is required.'); else {
			const endpoint = {
				...original,
				id: uniqueId(cleanName),
				name: cleanName,
				role: get$1(role)
			};

			if (cleanProtocol) endpoint.protocol = cleanProtocol; else delete endpoint.protocol;

			delete endpoint.references;

			const cleanRemarks = get$1(remarks).trim();

			if (cleanRemarks) endpoint.remarks = cleanRemarks; else delete endpoint.remarks;

			delete endpoint.description;
			delete endpoint.direction;
			delete endpoint.transport;
			set(error, '');
			ok?.(endpoint);

			return true;
		}

		return false;
	}

	const handlers = {
		onEndpointSettings({ pos, endpoint, endpointIds = [], open, ok, cancel, trash }) {
			original = structuredClone(endpoint ?? {});
			existingIds = [...endpointIds];
			set(name, original.name ?? '');
			set(protocol, original.protocol ?? '');
			set(role, original.role ?? 'client');
			set(remarks, original.remarks ?? '');
			set(error, '');
			set(openProtocol, typeof open === 'function' ? open : null);
			mutate(box, get$1(box).title = 'Endpoint');
			mutate(box, get$1(box).largeTitle = true);
			mutate(box, get$1(box).pos = { ...pos });
			mutate(box, get$1(box).ok = () => submit(ok));
			mutate(box, get$1(box).cancel = cancel ? () => cancel() : null);
			mutate(box, get$1(box).trash = trash ? () => trash() : null);
			get$1(box).show(pos);
		}
	};

	var $$exports = { handlers };

	init();

	Popup_box($$anchor, {
		get box() {
			return get$1(box);
		},

		children: ($$anchor, $$slotProps) => {
			var div = root_1$1();
			var node = child(div);

			Label_input_field(node, {
				label: 'Name',
				style: labelStyle,
				check: (value) => Boolean(value.trim()),

				get input() {
					return get$1(name);
				},

				set input($$value) {
					set(name, $$value);
				},

				$$legacy: true
			});

			var node_1 = sibling(node, 2);

			Path_input_field(node_1, {
				label: 'Protocol',
				style: labelStyle,
				check: null,

				get openFile() {
					return get$1(openProtocol);
				},

				showOpenFile: true,

				get input() {
					return get$1(protocol);
				},

				set input($$value) {
					set(protocol, $$value);
				},

				$$legacy: true
			});

			var node_2 = sibling(node_1, 2);

			Label_select(node_2, {
				label: 'Role',
				style: labelStyle,

				get options() {
					return roles;
				},

				get value() {
					return get$1(role);
				},

				set value($$value) {
					set(role, $$value);
				},

				$$legacy: true
			});

			var node_3 = sibling(node_2, 2);

			Label_textarea(node_3, {
				label: 'Remarks',
				style: labelStyle,

				get text() {
					return get$1(remarks);
				},

				set text($$value) {
					set(remarks, $$value);
				},

				$$legacy: true
			});

			var node_4 = sibling(node_3, 2);

			{
				var consequent = ($$anchor) => {
					var p = root_2();
					var text = child(p);
					template_effect(() => set_text(text, get$1(error)));
					append($$anchor, p);
				};

				if_block(node_4, ($$render) => {
					if (get$1(error)) $$render(consequent);
				});
			}
			append($$anchor, div);
		},

		$$slots: { default: true }
	});

	bind_prop($$props, 'handlers', handlers);

	return pop($$exports);
}

var root_1 = from_html(`<div class="inspector svelte-1qvdjvs"><!> <!></div>`);

function Connection_inspector($$anchor, $$props) {
	push($$props, false);

	const transportOptions = mutable_source();
	let tx = prop($$props, 'tx', 8);

	const transports = [
		'unspecified',
		'http',
		'https',
		'websocket',
		'tcp',
		'udp',
		'in-process',
		'ipc',
		'queue',
		'file',
		'shared-store',
		'other'
	];

	const labelStyle = 'width: 7rem;';
	let box = mutable_source({ div: null, pos: null, title: '', ok: null, cancel: null });
	let original = {};
	let transport = mutable_source('unspecified');
	let remarks = mutable_source('');

	onMount(() => tx().send('modal div', get$1(box).div));

	function submit(ok) {
		const connection = { ...original, transport: get$1(transport) };
		const cleanRemarks = get$1(remarks).trim();

		if (cleanRemarks) connection.remarks = cleanRemarks; else delete connection.remarks;

		delete connection.name;
		delete connection.description;
		delete connection.flow;
		delete connection.direction;
		delete connection.protocol;
		ok?.(connection);

		return true;
	}

	const handlers = {
		onConnectionSettings({ pos, connection, ok, cancel, trash }) {
			original = structuredClone(connection ?? {});
			set(transport, original.transport ?? 'unspecified');
			set(remarks, original.remarks ?? '');
			mutate(box, get$1(box).title = 'Transport');
			mutate(box, get$1(box).largeTitle = true);
			mutate(box, get$1(box).pos = { ...pos });
			mutate(box, get$1(box).ok = () => submit(ok));
			mutate(box, get$1(box).cancel = cancel ? () => cancel() : null);
			mutate(box, get$1(box).trash = trash ? () => trash() : null);
			get$1(box).show(pos);
		}
	};

	legacy_pre_effect(() => (get$1(transport)), () => {
		set(transportOptions, transports.includes(get$1(transport)) ? transports : [get$1(transport), ...transports]);
	});

	legacy_pre_effect_reset();

	var $$exports = { handlers };

	init();

	Popup_box($$anchor, {
		get box() {
			return get$1(box);
		},

		children: ($$anchor, $$slotProps) => {
			var div = root_1();
			var node = child(div);

			Label_select(node, {
				label: 'Transport',
				style: labelStyle,

				get options() {
					return get$1(transportOptions);
				},

				get value() {
					return get$1(transport);
				},

				set value($$value) {
					set(transport, $$value);
				},

				$$legacy: true
			});

			var node_1 = sibling(node, 2);

			Label_textarea(node_1, {
				label: 'Remarks',
				style: labelStyle,

				get text() {
					return get$1(remarks);
				},

				set text($$value) {
					set(remarks, $$value);
				},

				$$legacy: true
			});
			append($$anchor, div);
		},

		$$slots: { default: true }
	});

	bind_prop($$props, 'handlers', handlers);

	return pop($$exports);
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
const VscodeSideMenuFactory = getFactory(Vscode_side_menu);
const ApplicationInspectorFactory = getFactory(Application_inspector);
const EndpointInspectorFactory = getFactory(Endpoint_inspector);
const ConnectionInspectorFactory = getFactory(Connection_inspector);

// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:7859b9eb1b95ba7c"}}
// ------------------------------------------------------------------




//The runtime nodes
const nodeList = [
	//_______________________________________SYSTEM MESSAGE BROKER
	{
	name: "system message broker",
	uid: "KkUJ",
	factory: SystemMessageBroker,
	inputs: [
		"-> sysblu.loaded",
		"-> sysblu.failed",
		"-> sysblu.diagnostics",
		"-> system.updated",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"-> save",
		"-> open reference",
		"-> execute command"
		],
	outputs: [
		"sysblu.set -> sysblu.set @ sysblu manager (UAmj)",
		"sysblu.save -> sysblu.save @ sysblu manager (UAmj)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (UAmj)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (UAmj)",
		"size change -> size change @ sysblu view (cfdd)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "cfdd",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (KkUJ)",
		"application settings -> application settings @ application inspector (nFIn)",
		"endpoint settings -> endpoint settings @ endpoint inspector (CyxS)",
		"connection settings -> connection settings @ connection inspector (ytsa)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (UAmj)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (UAmj)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (UAmj)",
		"open reference -> open reference @ system message broker (KkUJ)",
		"execute command -> execute command @ system message broker (KkUJ)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "UAmj",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (KkUJ)",
		"sysblu.failed -> sysblu.failed @ system message broker (KkUJ)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (KkUJ)",
		`system.updated -> [ 
			"system.updated @ sysblu view (cfdd)",
			"system.updated @ system message broker (KkUJ)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (cfdd)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "dDcl",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (KkUJ)",
		"save -> save @ system message broker (KkUJ)",
		"application prompt -> application prompt @ sysblu view (cfdd)",
		"add application -> add application @ sysblu view (cfdd)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "Save system"
		    }
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "nFIn",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "CyxS",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "ytsa",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
		]
	},
];

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.0","schemaVersion":"1.12.0"}
};

// prepare the runtime
const runtime = new Runtime2(nodeList, runtimeOptions);

// and start the app
runtime.start();
//# sourceMappingURL=sysblu-bundle.js.map
