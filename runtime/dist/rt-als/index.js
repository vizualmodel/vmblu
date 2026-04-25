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

// shared/runtime.js
var rtFlags = {
  LOGMSG: 1
};
var LOGMSG = rtFlags.LOGMSG;
function defaultInvokeHandler(dest, hix, param) {
  return dest.rxSink[hix].handler.call(dest.cell, param);
}
__name(defaultInvokeHandler, "defaultInvokeHandler");
function createRuntime({ invokeHandler = defaultInvokeHandler } = {}) {
  function Runtime2() {
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
  }
  __name(Runtime2, "Runtime");
  Runtime2.prototype = {
    clearReceiveTimer() {
      clearTimeout(this.receiveTimer);
      this.receiveTimer = 0;
    },
    clearIdleTimer() {
      clearTimeout(this.idleTimer);
      this.idleTimer = 0;
    },
    scheduleReceive() {
      if (this.receiveTimer) return;
      this.clearIdleTimer();
      this.receiveTimer = setTimeout(() => {
        this.receiveTimer = 0;
        this.receive();
      }, this.receiveDelay);
    },
    scheduleIdleCheck() {
      if (this.idleTimer || this.receiveTimer || this.qOut.length) return;
      this.idleTimer = setTimeout(() => {
        this.idleTimer = 0;
        this.idle();
      }, this.idleDelay);
    },
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
    },
    stop() {
      this.clearReceiveTimer();
      this.clearIdleTimer();
      this.msgCount = 0;
      this.idleCount = 0;
      this.actors.forEach((actor) => actor.cell = null);
      this.qOut = [];
      this.qIn = [];
    },
    halt() {
      this.clearReceiveTimer();
      this.clearIdleTimer();
    },
    continue() {
      if (this.qOut.length) this.scheduleReceive();
      else this.scheduleIdleCheck();
    },
    switch() {
      const temp = this.qIn;
      this.qIn = this.qOut;
      this.qOut = temp;
      this.qOut.length = 0;
    },
    idle() {
      this.idleCount++;
      const now = Date.now();
      this.qResolve.checkTimeouts(now);
      if (this.idleCount % 600 == 0) {
        const min = (now - this.startTime) / 6e4;
        console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`);
      }
      this.scheduleIdleCheck();
    },
    reject(reason) {
      return new Promise((resolve, reject) => {
        reject(new Error(reason));
      });
    },
    logMessage(msg) {
      console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}]`);
    },
    logReqReply(msg, what) {
      console.log(`${msg.source.name}[${msg.txPin}] -> ${msg.dest.name}[${msg.rxPin}] (${what})`);
    },
    logNotConnected(nodeName, pinName) {
      console.log(`${nodeName}[${pinName}] : not connected.`);
    },
    sendTo(tx, source, param) {
      if (tx.targets.length < 1) {
        if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin);
        return 0;
      }
      ++this.msgCount;
      const log = source.flags & LOGMSG;
      for (const target of tx.targets) {
        this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef: 0, txPin: tx.pin, rxRef: 0, rxPin: target.pin });
        if (log) this.logMessage(this.qOut.at(-1));
      }
      this.idleCount = 0;
      if (!this.receiveTimer) this.scheduleReceive();
      return tx.targets.length;
    },
    requestFrom(tx, source, param, timeout) {
      if (tx.targets.length < 1) {
        if (source.flags & LOGMSG) this.logNotConnected(source.name, tx.pin);
        return this.reject("Not connected");
      }
      const txRef = ++this.msgCount;
      let channelCount = 0;
      const log = source.flags & LOGMSG;
      for (const target of tx.targets) {
        this.qOut.push({ source, dest: target.actor, hix: target.hix, param, txRef, txPin: tx.pin, rxRef: 0, rxPin: target.pin });
        if (log) this.logReqReply(this.qOut.at(-1), "request");
        if (target.channel) channelCount++;
      }
      this.idleCount = 0;
      if (!this.receiveTimer) this.scheduleReceive();
      if (channelCount == 0) return this.reject("No channel");
      return this.qResolve.addPromiseHandler(txRef, timeout, channelCount);
    },
    reply(source, param) {
      var _a;
      if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return 0;
      ++this.msgCount;
      this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef: 0, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin });
      if (source.flags & LOGMSG) this.logReqReply(this.qOut.at(-1), "reply");
      this.idleCount = 0;
      if (!this.receiveTimer) this.scheduleReceive();
      return 1;
    },
    next(source, param, timeout) {
      var _a;
      if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return this.reject("No target");
      const txRef = ++this.msgCount;
      this.qOut.push({ source, dest: source.msg.source, hix: HIX_REPLY, param, txRef, txPin: source.msg.rxPin, rxRef: source.msg.txRef, rxPin: source.msg.txPin });
      this.idleCount = 0;
      if (!this.receiveTimer) this.scheduleReceive();
      return this.qResolve.addPromiseHandler(txRef, timeout);
    },
    receive() {
      if (!this.qOut.length) return this.scheduleIdleCheck();
      this.switch();
      this.handleReceiveQueue();
      if (this.qOut.length && !this.receiveTimer) this.scheduleReceive();
      else this.scheduleIdleCheck();
    },
    handleReceiveQueue() {
      for (const msg of this.qIn) {
        const dest = msg.dest;
        switch (msg.hix & HIX_TYPE_MASK) {
          case HIX_HANDLER:
            {
              dest.msg = msg;
              if (dest.flags & LOGMSG) this.logMessage(msg);
              invokeHandler(dest, msg.hix, msg.param);
            }
            break;
          case HIX_REPLY:
            {
              if (dest.flags & LOGMSG) this.logReqReply(msg, "incoming reply");
              this.qResolve.trigger(msg.rxRef, msg.param);
            }
            break;
        }
      }
    },
    reschedule(msg) {
      this.qOut.push(msg);
      this.idleCount = 0;
      if (!this.receiveTimer) this.scheduleReceive();
    }
  };
  return Runtime2;
}
__name(createRuntime, "createRuntime");

// rt-als/node-context.js
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

// rt-als/runtime.js
var Runtime = createRuntime({
  invokeHandler(dest, hix, param) {
    return runAsNode(dest.name, () => dest.rxSink[hix].handler.call(dest.cell, param));
  }
});

// rt-als/runtime-settings.js
var defaultWorker = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
var defaultSafety = /* @__PURE__ */ __name(() => ({
  on: false,
  mode: "warn",
  forward: true
}), "defaultSafety");
function makeRuntimeSettings() {
  return {
    logMessages: false,
    worker: defaultWorker(),
    safety: defaultSafety()
  };
}
__name(makeRuntimeSettings, "makeRuntimeSettings");
function normalizeRuntimeSettings(dx = null) {
  const defaults = makeRuntimeSettings();
  if (!dx || typeof dx !== "object") return defaults;
  const normalized = {
    ...dx,
    logMessages: !!dx.logMessages,
    worker: {
      ...defaults.worker,
      ...dx.worker ?? {}
    },
    safety: {
      ...defaults.safety,
      ...dx.safety ?? {}
    }
  };
  normalized.worker.on = !!normalized.worker.on;
  normalized.worker.path = normalized.worker.path ?? "";
  normalized.safety.on = !!normalized.safety.on;
  normalized.safety.forward = normalized.safety.forward !== false;
  normalized.safety.mode = ["off", "warn", "enforce"].includes(normalized.safety.mode) ? normalized.safety.mode : defaults.safety.mode;
  return normalized;
}
__name(normalizeRuntimeSettings, "normalizeRuntimeSettings");

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
function createRuntimeNode({ getRuntime, normalizeRuntimeSettings: normalizeRuntimeSettings2, rtFlags: rtFlags2 }) {
  function RuntimeNode2({ name, uid, factory, inputs, outputs, sx, dx }) {
    this.name = name;
    this.uid = uid;
    this.factory = factory;
    this.useNew = shouldUseNew(factory);
    this.rxSink = [];
    this.txMap = /* @__PURE__ */ new Map();
    this.sx = sx ?? null;
    this.dx = dx ? normalizeRuntimeSettings2(dx) : null;
    this.flags = 0;
    this.cell = null;
    this.msg = null;
    this.setFlags();
    this.initRxTx({ inputs, outputs });
  }
  __name(RuntimeNode2, "RuntimeNode");
  RuntimeNode2.prototype = {
    setFlags() {
      if (!this.dx) return;
      if (this.dx.logMessages) this.flags |= rtFlags2.LOGMSG;
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
      const source = this;
      return {
        get pin() {
          var _a;
          return (_a = source.msg) == null ? void 0 : _a.txPin;
        },
        send(pin, param) {
          if (pin) {
            const tx = source.findTx(pin);
            if (tx) return getRuntime().sendTo(tx, source, param);
          }
          console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? "missing !!"}"`, source.txMap);
          return 0;
        },
        request(pin, param, timeout = 0) {
          if (pin) {
            const tx = source.findTx(pin);
            if (tx) return getRuntime().requestFrom(tx, source, param, timeout);
          }
          console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
          return getRuntime().reject("No such output pin");
        },
        reply(param) {
          return getRuntime().reply(source, param);
        },
        next(param, timeout = 0) {
          return getRuntime().next(source, param, timeout);
        },
        reschedule() {
          if (source.msg) getRuntime().reschedule(source.msg);
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
                    return getRuntime().sendTo(txCopy, source, param);
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
                    return getRuntime().requestFrom(txCopy, source, param, timeout);
                  }
                  console.warn(`** Select: no such target** Node "${_nodeName}" is not connected to pin ${pin}`);
                  return getRuntime().reject("selected node not connected");
                }
              }
              console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
              return getRuntime().reject("No such output pin");
            }
          };
        }
      };
    }
  };
  return RuntimeNode2;
}
__name(createRuntimeNode, "createRuntimeNode");

// rt-als/runtime-node.js
var RuntimeNode = createRuntimeNode({
  getRuntime: /* @__PURE__ */ __name(() => runtime, "getRuntime"),
  normalizeRuntimeSettings,
  rtFlags
});

// shared/scaffold.js
function createScaffold({ createRuntime: createRuntime2, RuntimeNode: RuntimeNode2, setRuntime }) {
  return /* @__PURE__ */ __name(function scaffold2(nodeList, filterList = []) {
    const runtime2 = createRuntime2();
    setRuntime(runtime2);
    for (const rawNode of nodeList) {
      runtime2.actors.push(new RuntimeNode2(rawNode));
    }
    runtime2.actors.forEach((actor) => actor.resolveUIDs(runtime2.actors));
    return runtime2;
  }, "scaffold");
}
__name(createScaffold, "createScaffold");

// rt-als/scaffold.js
var runtime = null;
var scaffold = createScaffold({
  createRuntime: /* @__PURE__ */ __name(() => new Runtime(), "createRuntime"),
  RuntimeNode,
  setRuntime(value) {
    runtime = value;
  }
});

// rt-als/safety-hooks.js
import childProcess from "child_process";
import fs from "fs";
import http from "http";
import https from "https";

// rt-als/safety-events.js
var safetyEmitter = null;
function setSafetyEmitter(fn = null) {
  safetyEmitter = typeof fn === "function" ? fn : null;
}
__name(setSafetyEmitter, "setSafetyEmitter");
function emitSafetyEvent(event) {
  if (!safetyEmitter) return;
  try {
    safetyEmitter(event);
  } catch (error) {
    console.warn("vmblu safety emitter failed:", error);
  }
}
__name(emitSafetyEvent, "emitSafetyEvent");
function reportSafetyEvent(cap, detail = {}) {
  emitSafetyEvent({
    ts: Date.now(),
    node: getCurrentNode(),
    cap,
    detail
  });
}
__name(reportSafetyEvent, "reportSafetyEvent");

// rt-als/safety-hooks.js
var STATE_KEY = Symbol.for("vmblu.rt-als.safetyHooks");
var WRAPPED = Symbol.for("vmblu.rt-als.wrapped");
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
function emitCapability(cap, detail) {
  if (isCapabilitySuppressed(cap)) return;
  reportSafetyEvent(cap, detail);
}
__name(emitCapability, "emitCapability");
function installProcessHooks(restores) {
  wrapMethod(childProcess, "exec", (original) => /* @__PURE__ */ __name(function wrappedExec(command, ...args) {
    emitCapability("proc:exec", { command: safeString(command) });
    return original.call(this, command, ...args);
  }, "wrappedExec"), restores);
  wrapMethod(childProcess, "execFile", (original) => /* @__PURE__ */ __name(function wrappedExecFile(file, args, options, callback) {
    const argv = Array.isArray(args) ? args : [];
    emitCapability("proc:exec", { command: safeString(file), args: argv.slice() });
    return original.call(this, file, args, options, callback);
  }, "wrappedExecFile"), restores);
  wrapMethod(childProcess, "spawn", (original) => /* @__PURE__ */ __name(function wrappedSpawn(command, args, options) {
    emitCapability("proc:exec", { command: safeString(command), args: Array.isArray(args) ? args.slice() : [] });
    return original.call(this, command, args, options);
  }, "wrappedSpawn"), restores);
  wrapMethod(childProcess, "fork", (original) => /* @__PURE__ */ __name(function wrappedFork(modulePath, args, options) {
    emitCapability("proc:exec", { command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : [] });
    return original.call(this, modulePath, args, options);
  }, "wrappedFork"), restores);
}
__name(installProcessHooks, "installProcessHooks");
function installFsHooks(restores) {
  for (const key of ["writeFile", "writeFileSync", "appendFile", "appendFileSync"]) {
    wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedFs(path, ...args) {
      emitCapability("fs:write", { path: safeString(path) });
      return original.call(this, path, ...args);
    }, "wrappedFs"), restores);
  }
  for (const key of ["rm", "rmSync", "unlink", "unlinkSync"]) {
    wrapMethod(fs, key, (original) => /* @__PURE__ */ __name(function wrappedDelete(path, ...args) {
      emitCapability("fs:delete", { path: safeString(path) });
      return original.call(this, path, ...args);
    }, "wrappedDelete"), restores);
  }
}
__name(installFsHooks, "installFsHooks");
function installFetchHook(restores) {
  if (typeof globalThis.fetch !== "function") return;
  wrapMethod(globalThis, "fetch", (original) => /* @__PURE__ */ __name(function wrappedFetch(input, init) {
    const detail = {
      url: describeRequestUrl(input),
      method: (init == null ? void 0 : init.method) ?? (input == null ? void 0 : input.method) ?? "GET"
    };
    emitCapability("net:egress", detail);
    return suppressCapability("net:egress", () => original.call(this, input, init));
  }, "wrappedFetch"), restores);
}
__name(installFetchHook, "installFetchHook");
function installHttpHooks(restores) {
  wrapMethod(http, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpRequest(input, options, callback) {
    emitCapability("net:egress", {
      url: describeRequestUrl(input, options, "http:"),
      method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
    });
    return original.call(this, input, options, callback);
  }, "wrappedHttpRequest"), restores);
  wrapMethod(https, "request", (original) => /* @__PURE__ */ __name(function wrappedHttpsRequest(input, options, callback) {
    emitCapability("net:egress", {
      url: describeRequestUrl(input, options, "https:"),
      method: (options == null ? void 0 : options.method) ?? (input == null ? void 0 : input.method) ?? "GET"
    });
    return original.call(this, input, options, callback);
  }, "wrappedHttpsRequest"), restores);
}
__name(installHttpHooks, "installHttpHooks");
function installSafetyHooks({ mode = "off" } = {}) {
  if (mode === "off") return () => {
  };
  const state = getState();
  state.count += 1;
  if (state.count === 1) {
    state.restores = [];
    installProcessHooks(state.restores);
    installFetchHook(state.restores);
    installHttpHooks(state.restores);
    installFsHooks(state.restores);
  }
  return () => {
    state.count = Math.max(0, state.count - 1);
    if (state.count > 0) return;
    for (const restore of state.restores.splice(0).reverse()) restore();
  };
}
__name(installSafetyHooks, "installSafetyHooks");

// rt-als/safety.js
function enableSafety({ mode = "off" } = {}, tx = null) {
  if (mode === "off") {
    setSafetyEmitter(null);
    return { uninstall() {
    } };
  }
  setSafetyEmitter((event) => {
    var _a;
    (_a = tx == null ? void 0 : tx.send) == null ? void 0 : _a.call(tx, "security.event", event);
  });
  const uninstallHooks = installSafetyHooks({ mode });
  return {
    uninstall() {
      uninstallHooks();
      setSafetyEmitter(null);
    }
  };
}
__name(enableSafety, "enableSafety");

// rt-als/security-reporter.js
function SecurityReporterFactory(tx, sx = null) {
  const mode = (sx == null ? void 0 : sx.mode) ?? "warn";
  let currentTx = tx;
  let safetyControl = enableSafety({ mode }, {
    send(name, payload) {
      if (name !== "security.event") return 0;
      return currentTx.send("security.event", payload);
    }
  });
  return {
    configure(nextSettings = null) {
      const nextMode = (nextSettings == null ? void 0 : nextSettings.mode) ?? mode;
      safetyControl.uninstall();
      safetyControl = enableSafety({ mode: nextMode }, {
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
  SecurityReporterFactory,
  VERSION,
  enableSafety,
  scaffold
};
//# sourceMappingURL=index.js.map