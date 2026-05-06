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

// rt-base/runtime.js
var Runtime = createRuntime();

// rt-base/runtime-settings.js
var defaultWorker$2 = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
function makeRuntimeSettings$3() {
  return {
    logMessages: false,
    worker: defaultWorker$2()
  };
}
__name(makeRuntimeSettings$3, "makeRuntimeSettings");
function normalizeRuntimeSettings$2(dx = null) {
  const defaults = makeRuntimeSettings$3();
  if (!dx || typeof dx !== "object") return defaults;
  const normalized = {
    ...dx,
    logMessages: !!dx.logMessages,
    worker: {
      ...defaults.worker,
      ...dx.worker ?? {}
    }
  };
  normalized.worker.on = !!normalized.worker.on;
  normalized.worker.path = normalized.worker.path ?? "";
  return normalized;
}
__name(normalizeRuntimeSettings$2, "normalizeRuntimeSettings");

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

// rt-base/runtime-node.js
var RuntimeNode = createRuntimeNode({
  getRuntime: /* @__PURE__ */ __name(() => runtime$1, "getRuntime"),
  normalizeRuntimeSettings: normalizeRuntimeSettings$2,
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

// rt-base/scaffold.js
var runtime$1 = null;
var scaffold = createScaffold({
  createRuntime: /* @__PURE__ */ __name(() => new Runtime(), "createRuntime"),
  RuntimeNode,
  setRuntime(value) {
    runtime$1 = value;
  }
});

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
	return block(fn);
}

/**
 * @param {(() => void)} fn
 * @param {number} flags
 */
function block(fn, flags = 0) {
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

function comment() {

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

	block(() => {
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

	block(() => {
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

	block(() => {
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

var root$l = template(`<div class="main svelte-1xg9j2"><div class="menu svelte-1xg9j2"></div> <div class="tabs svelte-1xg9j2"></div> <div class="content svelte-1xg9j2"></div></div>`);

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

	var div_1 = root$l();

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

var root$k = template(`<div class="main svelte-1pnzbgh"><div class="tabs svelte-1pnzbgh"></div> <div class="content svelte-1pnzbgh"></div></div>`);

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

	var div_1 = root$k();

	bind_this(div_1, ($$value) => set(mainDiv, $$value), () => get(mainDiv));

	var div_2 = child(div_1);

	bind_this(div_2, ($$value) => set(tabsDiv, $$value), () => get(tabsDiv));

	var div_3 = sibling(div_2, 2);

	bind_this(div_3, ($$value) => set(contentDiv, $$value), () => get(contentDiv));
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$j = template(`<div id="page-content" class="svelte-jgeogz"><div id="main-grid" class="svelte-jgeogz"><div id="menu-box" class="svelte-jgeogz"></div> <div id="tab-box" class="svelte-jgeogz"></div> <div id="left-box" class="svelte-jgeogz"></div> <div id="center-box" class="svelte-jgeogz"></div></div></div>`);

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

	var div_1 = root$j();

	bind_this(div_1, ($$value) => set(pageContent, $$value), () => get(pageContent));
	append($$anchor, div_1);
	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$i = template(`<div id="page-content" class="svelte-1ew5eoh"><div id="main-grid" class="svelte-1ew5eoh"><div id="left-menu" class="svelte-1ew5eoh"></div> <div id="left-column" class="svelte-1ew5eoh"></div> <div id="sep-col" class="svelte-1ew5eoh"></div> <div id="area-one" class="svelte-1ew5eoh"></div> <div id="sep-area" class="svelte-1ew5eoh"></div> <div id="area-two" class="svelte-1ew5eoh"></div></div></div>`);

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

	var div_1 = root$i();
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

var root$h = template(`<div class="column-main-layout svelte-r7atyp"><div class="left-column svelte-r7atyp"></div> <div class="separator svelte-r7atyp"></div> <div class="main-area svelte-r7atyp"></div></div>`);

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

	var div_1 = root$h();

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

var root_1$e = template(`<div class="menu-item svelte-15nacvn"><i class="material-icons-outlined icon svelte-15nacvn"> </i> <div class="tooltip svelte-15nacvn"> </div></div>`);
var root$g = template(`<div class="menu svelte-15nacvn"></div>`);

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

	var div = root$g();

	bind_this(div, ($$value) => set(menuDiv, $$value), () => get(menuDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$e();
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

var root_1$d = template(`<div class="menu-item svelte-1st5yi2"><i class="material-icons-outlined icon svelte-1st5yi2"> </i> <div class="tooltip svelte-1st5yi2"> </div></div>`);
var root$f = template(`<div class="menu svelte-1st5yi2"></div>`);

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

	var div = root$f();

	bind_this(div, ($$value) => set(menuDiv, $$value), () => get(menuDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$d();
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

var root_2$8 = template(`<div class="tab selected svelte-14ugtii"> <input class="button svelte-14ugtii" type="button"> <div class="full-name svelte-14ugtii"> </div></div>`);
var root_3$3 = template(`<div class="tab svelte-14ugtii"> <input class="button svelte-14ugtii" type="button"> <div class="full-name svelte-14ugtii"> </div></div>`);
var root$e = template(`<div class="tab-ribbon svelte-14ugtii"></div>`);

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

	var div = root$e();

	bind_this(div, ($$value) => mutate(ribbon, get(ribbon).div = $$value), () => get(ribbon)?.div);

	each(div, 5, () => get(ribbon).tabs, index, ($$anchor, tab, index) => {
		var fragment = comment();
		var node = first_child(fragment);

		if_block(
			node,
			() => index == get(ribbon).selected,
			($$anchor) => {
				var div_1 = root_2$8();

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
				var div_3 = root_3$3();

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

var root_1$c = template(`<div class="menu-item svelte-1c44ark"><i class="material-icons-outlined icon svelte-1c44ark"> </i> <div class="tooltip svelte-1c44ark"> </div></div>`);
var root$d = template(`<div class="menu svelte-1c44ark"></div>`);

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

	var div = root$d();

	bind_this(div, ($$value) => set(floatingDiv, $$value), () => get(floatingDiv));

	each(div, 5, () => get(symbols), index, ($$anchor, symbol, index) => {
		var div_1 = root_1$c();
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

var root_1$b = template(`<i class="material-icons-outlined open svelte-e6df58">description</i>`);
var root_2$7 = template(`<i class="material-icons-outlined open svelte-e6df58">add_circle</i>`);
var root_3$2 = template(`<div class="right-icons svelte-e6df58"><i class="material-icons-outlined trash svelte-e6df58">delete</i></div>`);
var root$c = template(`<div><div class="hdr svelte-e6df58"><div class="left-icons svelte-e6df58"><i class="material-icons-outlined cancel svelte-e6df58">cancel</i> <i class="material-icons-outlined check svelte-e6df58">check_circle</i> <!> <!></div> <h1 class="svelte-e6df58"> </h1> <!></div> <!></div>`);

function Popup_box($$anchor, $$props) {
	push($$props, false);

	const $$stores = setup_stores();
	const $theme = () => store_get(theme, "$theme", $$stores);
	let box = prop($$props, "box", 12);
	// dragging behaviour
	let startX, startY, initialLeft, initialTop;
	let dragging = false;

	onMount(() => {
		// set the show, hide and update functions
		box(box().show = show, true);
		box(box().hide = hide, true);
		box(box().update = () => box(box()), true);
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
		if (!pos) pos = box().pos;

		if (pos) {
			box(box().div.style.left = `${pos.x}px`, true);
			box(box().div.style.top = `${pos.y}px`, true);
		}

		box(box().div.style.display = 'block', true);
		box(box());
	}

	function hide() {
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

	var div = root$c();

	bind_this(div, ($$value) => box(box().div = $$value, true), () => box()?.div);

	var div_1 = child(div);
	var div_2 = child(div_1);
	var i = child(div_2);
	var i_1 = sibling(i, 2);
	var node = sibling(i_1, 2);

	if_block(node, () => box().open, ($$anchor) => {
		var i_2 = root_1$b();

		event("click", i_2, onOpen);
		event("keydown", i_2, onKeydown);
		append($$anchor, i_2);
	});

	var node_1 = sibling(node, 2);

	if_block(node_1, () => box().add, ($$anchor) => {
		var i_3 = root_2$7();

		event("click", i_3, onAdd);
		event("keydown", i_3, onKeydown);
		append($$anchor, i_3);
	});

	var h1 = sibling(div_2, 2);
	var text = child(h1);

	var node_2 = sibling(h1, 2);

	if_block(node_2, () => box().trash, ($$anchor) => {
		var div_3 = root_3$2();
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

var root$b = template(`<div class="same-line svelte-nv80og"><!></div>`);

function Same_line($$anchor, $$props) {
	var div = root$b();
	var node = child(div);

	slot(node, $$props, "default", {});
	append($$anchor, div);
}

var root$a = template(`<label class="label svelte-1w9b525"> </label>`);

function Label($$anchor, $$props) {
	let text = prop($$props, "text", 8);
	let style = prop($$props, "style", 8);
	var label = root$a();
	var text_1 = child(label);

	template_effect(() => {
		set_attribute(label, "style", style() ? style() : '');
		set_text(text_1, text());
	});

	append($$anchor, label);
}

var root$9 = template(`<input class="grow svelte-w2c0k9" type="text" spellcheck="false">`);

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

	var input_1 = root$9();

	bind_this(input_1, ($$value) => set(input, $$value), () => get(input));
	template_effect(() => set_attribute(input_1, "style", style() ? style() : ''));
	bind_value(input_1, text);
	event("input", input_1, onInput);
	append($$anchor, input_1);
	pop();
}

var root$8 = template(`<input type="checkbox" class="svelte-kvi95y">`);

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

	var input = root$8();
	template_effect(() => set_attribute(input, "style", style() ? style() : ''));
	bind_checked(input, on);
	event("change", input, onInput);
	append($$anchor, input);
	pop();
}

var root_1$a = template(`<!> <!>`, 1);
var root_2$6 = template(`<!> <!> <!>`, 1);
var root$7 = template(`<!> <!>`, 1);

function Runtime_settings_base($$anchor, $$props) {
	push($$props, false);

	let dx = prop($$props, "dx", 12);

	init();

	var fragment = root$7();
	var node = first_child(fragment);

	Same_line(node, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$a();
			var node_1 = first_child(fragment_1);

			Checkbox(node_1, {
				get on() {
					return dx().logMessages;
				},
				set on($$value) {
					dx(dx().logMessages = $$value, true);
				},
				$$legacy: true
			});

			var node_2 = sibling(node_1, 2);

			Label(node_2, { text: "log messages" });
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	var node_3 = sibling(node, 2);

	Same_line(node_3, {
		children: ($$anchor, $$slotProps) => {
			var fragment_2 = root_2$6();
			var node_4 = first_child(fragment_2);

			Checkbox(node_4, {
				get on() {
					return dx().worker.on;
				},
				set on($$value) {
					dx(dx().worker.on = $$value, true);
				},
				$$legacy: true
			});

			var node_5 = sibling(node_4, 2);

			Label(node_5, {
				text: "use worker script:",
				style: "margin-right: 0.5rem;"
			});

			var node_6 = sibling(node_5, 2);

			Text_field(node_6, {
				get text() {
					return dx().worker.path;
				},
				set text($$value) {
					dx(dx().worker.path = $$value, true);
				},
				$$legacy: true
			});

			append($$anchor, fragment_2);
		},
		$$slots: { default: true }
	});

	append($$anchor, fragment);
	pop();
}

var root_1$9 = template(`<!> <!>`, 1);
var root_2$5 = template(`<!> <!> <!>`, 1);
var root_3$1 = template(`<!> <!>`, 1);
var root_4$1 = template(`<!> <!>`, 1);
var root_5$2 = template(`<!> <select><option>off</option><option>warn</option><option>enforce</option></select>`, 1);
var root$6 = template(`<!> <!> <!> <!> <!>`, 1);

function Runtime_settings_als($$anchor, $$props) {
	push($$props, false);

	let dx = prop($$props, "dx", 12);

	init();

	var fragment = root$6();
	var node = first_child(fragment);

	Same_line(node, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$9();
			var node_1 = first_child(fragment_1);

			Checkbox(node_1, {
				get on() {
					return dx().logMessages;
				},
				set on($$value) {
					dx(dx().logMessages = $$value, true);
				},
				$$legacy: true
			});

			var node_2 = sibling(node_1, 2);

			Label(node_2, { text: "log messages" });
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	var node_3 = sibling(node, 2);

	Same_line(node_3, {
		children: ($$anchor, $$slotProps) => {
			var fragment_2 = root_2$5();
			var node_4 = first_child(fragment_2);

			Checkbox(node_4, {
				get on() {
					return dx().worker.on;
				},
				set on($$value) {
					dx(dx().worker.on = $$value, true);
				},
				$$legacy: true
			});

			var node_5 = sibling(node_4, 2);

			Label(node_5, {
				text: "use worker script:",
				style: "margin-right: 0.5rem;"
			});

			var node_6 = sibling(node_5, 2);

			Text_field(node_6, {
				get text() {
					return dx().worker.path;
				},
				set text($$value) {
					dx(dx().worker.path = $$value, true);
				},
				$$legacy: true
			});

			append($$anchor, fragment_2);
		},
		$$slots: { default: true }
	});

	var node_7 = sibling(node_3, 2);

	Same_line(node_7, {
		children: ($$anchor, $$slotProps) => {
			var fragment_3 = root_3$1();
			var node_8 = first_child(fragment_3);

			Checkbox(node_8, {
				get on() {
					return dx().safety.on;
				},
				set on($$value) {
					dx(dx().safety.on = $$value, true);
				},
				$$legacy: true
			});

			var node_9 = sibling(node_8, 2);

			Label(node_9, { text: "safety instrumentation" });
			append($$anchor, fragment_3);
		},
		$$slots: { default: true }
	});

	var node_10 = sibling(node_7, 2);

	Same_line(node_10, {
		children: ($$anchor, $$slotProps) => {
			var fragment_4 = root_4$1();
			var node_11 = first_child(fragment_4);

			Checkbox(node_11, {
				get on() {
					return dx().safety.forward;
				},
				set on($$value) {
					dx(dx().safety.forward = $$value, true);
				},
				$$legacy: true
			});

			var node_12 = sibling(node_11, 2);

			Label(node_12, { text: "forward `security.event`" });
			append($$anchor, fragment_4);
		},
		$$slots: { default: true }
	});

	var node_13 = sibling(node_10, 2);

	Same_line(node_13, {
		children: ($$anchor, $$slotProps) => {
			var fragment_5 = root_5$2();
			var node_14 = first_child(fragment_5);

			Label(node_14, {
				text: "safety mode:",
				style: "margin-right: 0.5rem;"
			});

			var select = sibling(node_14, 2);

			template_effect(() => {
				dx().safety.mode;
				invalidate_inner_signals(() => {});
			});

			var option = child(select);

			option.value = null == (option.__value = "off") ? "" : "off";

			var option_1 = sibling(option);

			option_1.value = null == (option_1.__value = "warn") ? "" : "warn";

			var option_2 = sibling(option_1);

			option_2.value = null == (option_2.__value = "enforce") ? "" : "enforce";
			bind_select_value(select, () => dx().safety.mode, ($$value) => dx(dx().safety.mode = $$value, true));
			append($$anchor, fragment_5);
		},
		$$slots: { default: true }
	});

	append($$anchor, fragment);
	pop();
}

const defaultWorker$1 = () => ({
    on: false,
    path: '',
});

function makeRuntimeSettings$2() {
    return {
        logMessages: false,
        worker: defaultWorker$1(),
    }
}

function normalizeRuntimeSettings$1(dx = null) {

    const defaults = makeRuntimeSettings$2();

    if (!dx || typeof dx !== 'object') return defaults

    const normalized = {
        ...dx,
        logMessages: !!dx.logMessages,
        worker: {
            ...defaults.worker,
            ...(dx.worker ?? {}),
        }
    };

    normalized.worker.on = !!normalized.worker.on;
    normalized.worker.path = normalized.worker.path ?? '';

    return normalized
}

function cloneRuntimeSettings$2(dx = null) {
    return normalizeRuntimeSettings$1(dx)
}

function resetRuntimeSettings$1(target) {

    const defaults = makeRuntimeSettings$2();

    target.logMessages = defaults.logMessages;
    target.worker = target.worker ?? {};
    target.worker.on = defaults.worker.on;
    target.worker.path = defaults.worker.path;

    return target
}

function assignRuntimeSettings$1(target, dx = null) {

    const normalized = normalizeRuntimeSettings$1(dx);

    target.logMessages = normalized.logMessages;
    target.worker = target.worker ?? {};
    target.worker.on = normalized.worker.on;
    target.worker.path = normalized.worker.path;

    for (const key of Object.keys(normalized)) {
        if ((key === 'logMessages') || (key === 'worker')) continue
        target[key] = normalized[key];
    }

    for (const key of Object.keys(target)) {
        if ((key === 'logMessages') || (key === 'worker')) continue
        if (!(key in normalized)) delete target[key];
    }

    for (const key of Object.keys(normalized.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        target.worker[key] = normalized.worker[key];
    }

    for (const key of Object.keys(target.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        if (!(key in normalized.worker)) delete target.worker[key];
    }

    return target
}

function isDefaultRuntimeSettings$1(dx = null) {

    const normalized = normalizeRuntimeSettings$1(dx);
    const workerKeys = Object.keys(normalized.worker ?? {});
    const topKeys = Object.keys(normalized);

    if (normalized.logMessages) return false
    if (normalized.worker?.on) return false
    if ((normalized.worker?.path ?? '') !== '') return false
    if (topKeys.some(key => !['logMessages', 'worker'].includes(key))) return false
    if (workerKeys.some(key => !['on', 'path'].includes(key))) return false

    return true
}

var baseRuntimeSettings = /*#__PURE__*/Object.freeze({
  __proto__: null,
  assignRuntimeSettings: assignRuntimeSettings$1,
  cloneRuntimeSettings: cloneRuntimeSettings$2,
  isDefaultRuntimeSettings: isDefaultRuntimeSettings$1,
  makeRuntimeSettings: makeRuntimeSettings$2,
  normalizeRuntimeSettings: normalizeRuntimeSettings$1,
  resetRuntimeSettings: resetRuntimeSettings$1
});

const defaultWorker = () => ({
    on: false,
    path: '',
});

const defaultSafety = () => ({
    on: false,
    mode: 'warn',
    forward: true,
});

function makeRuntimeSettings$1() {
    return {
        logMessages: false,
        worker: defaultWorker(),
        safety: defaultSafety(),
    }
}

function normalizeRuntimeSettings(dx = null) {

    const defaults = makeRuntimeSettings$1();

    if (!dx || typeof dx !== 'object') return defaults

    const normalized = {
        ...dx,
        logMessages: !!dx.logMessages,
        worker: {
            ...defaults.worker,
            ...(dx.worker ?? {}),
        },
        safety: {
            ...defaults.safety,
            ...(dx.safety ?? {}),
        }
    };

    normalized.worker.on = !!normalized.worker.on;
    normalized.worker.path = normalized.worker.path ?? '';
    normalized.safety.on = !!normalized.safety.on;
    normalized.safety.forward = normalized.safety.forward !== false;
    normalized.safety.mode = ['off', 'warn', 'enforce'].includes(normalized.safety.mode) ? normalized.safety.mode : defaults.safety.mode;

    return normalized
}

function cloneRuntimeSettings$1(dx = null) {
    return normalizeRuntimeSettings(dx)
}

function resetRuntimeSettings(target) {

    const defaults = makeRuntimeSettings$1();

    target.logMessages = defaults.logMessages;
    target.worker = target.worker ?? {};
    target.worker.on = defaults.worker.on;
    target.worker.path = defaults.worker.path;
    target.safety = target.safety ?? {};
    target.safety.on = defaults.safety.on;
    target.safety.mode = defaults.safety.mode;
    target.safety.forward = defaults.safety.forward;

    return target
}

function assignRuntimeSettings(target, dx = null) {

    const normalized = normalizeRuntimeSettings(dx);

    target.logMessages = normalized.logMessages;
    target.worker = target.worker ?? {};
    target.worker.on = normalized.worker.on;
    target.worker.path = normalized.worker.path;
    target.safety = target.safety ?? {};
    target.safety.on = normalized.safety.on;
    target.safety.mode = normalized.safety.mode;
    target.safety.forward = normalized.safety.forward;

    for (const key of Object.keys(normalized)) {
        if ((key === 'logMessages') || (key === 'worker') || (key === 'safety')) continue
        target[key] = normalized[key];
    }

    for (const key of Object.keys(target)) {
        if ((key === 'logMessages') || (key === 'worker') || (key === 'safety')) continue
        if (!(key in normalized)) delete target[key];
    }

    for (const key of Object.keys(normalized.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        target.worker[key] = normalized.worker[key];
    }

    for (const key of Object.keys(target.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        if (!(key in normalized.worker)) delete target.worker[key];
    }

    for (const key of Object.keys(normalized.safety)) {
        if ((key === 'on') || (key === 'mode') || (key === 'forward')) continue
        target.safety[key] = normalized.safety[key];
    }

    for (const key of Object.keys(target.safety)) {
        if ((key === 'on') || (key === 'mode') || (key === 'forward')) continue
        if (!(key in normalized.safety)) delete target.safety[key];
    }

    return target
}

function isDefaultRuntimeSettings(dx = null) {

    const normalized = normalizeRuntimeSettings(dx);
    const workerKeys = Object.keys(normalized.worker ?? {});
    const safetyKeys = Object.keys(normalized.safety ?? {});
    const topKeys = Object.keys(normalized);

    if (normalized.logMessages) return false
    if (normalized.worker?.on) return false
    if ((normalized.worker?.path ?? '') !== '') return false
    if (normalized.safety?.on) return false
    if (normalized.safety?.mode !== 'warn') return false
    if (normalized.safety?.forward !== true) return false
    if (topKeys.some(key => !['logMessages', 'worker', 'safety'].includes(key))) return false
    if (workerKeys.some(key => !['on', 'path'].includes(key))) return false
    if (safetyKeys.some(key => !['on', 'mode', 'forward'].includes(key))) return false

    return true
}

var alsRuntimeSettings = /*#__PURE__*/Object.freeze({
  __proto__: null,
  assignRuntimeSettings: assignRuntimeSettings,
  cloneRuntimeSettings: cloneRuntimeSettings$1,
  isDefaultRuntimeSettings: isDefaultRuntimeSettings,
  makeRuntimeSettings: makeRuntimeSettings$1,
  normalizeRuntimeSettings: normalizeRuntimeSettings,
  resetRuntimeSettings: resetRuntimeSettings
});

var agentRuntimeSettings = /*#__PURE__*/Object.freeze({
  __proto__: null,
  assignRuntimeSettings: assignRuntimeSettings,
  cloneRuntimeSettings: cloneRuntimeSettings$1,
  isDefaultRuntimeSettings: isDefaultRuntimeSettings,
  makeRuntimeSettings: makeRuntimeSettings$1,
  normalizeRuntimeSettings: normalizeRuntimeSettings,
  resetRuntimeSettings: resetRuntimeSettings
});

const RT_BASE = '@vizualmodel/vmblu-runtime/rt-base';
const RT_ALS = '@vizualmodel/vmblu-runtime/rt-als';
const RT_AGENT = '@vizualmodel/vmblu-runtime/rt-agent';

function selectRuntimeSettings(runtime) {
    if (runtime === RT_AGENT) return agentRuntimeSettings
    return runtime === RT_ALS ? alsRuntimeSettings : baseRuntimeSettings
}

function makeRuntimeSettings(runtime) {
    return selectRuntimeSettings(runtime).makeRuntimeSettings()
}

function cloneRuntimeSettings(runtime, dx = null) {
    return selectRuntimeSettings(runtime).cloneRuntimeSettings(dx)
}

function Runtime_settings($$anchor, $$props) {
	push($$props, false);

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
	let localDx = mutable_state(makeRuntimeSettings(RT_BASE));

	function isAlsRuntime(runtime) {
		return runtime === RT_ALS;
	}

	const handlers = {
		onShow({ title, pos, dx, runtime, ok, cancel }) {
			set(runtimeName, runtime ?? RT_BASE);
			mutate(box, get(box).title = title);
			mutate(box, get(box).pos = { ...pos });
			mutate(box, get(box).ok = () => ok?.(cloneRuntimeSettings(get(runtimeName), get(localDx))));
			mutate(box, get(box).cancel = () => cancel?.());
			set(localDx, dx ? cloneRuntimeSettings(get(runtimeName), dx) : makeRuntimeSettings(get(runtimeName)));
			get(box).show(get(box).pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = comment();
			var node = first_child(fragment_1);

			if_block(
				node,
				() => isAlsRuntime(get(runtimeName)),
				($$anchor) => {
					Runtime_settings_als($$anchor, {
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
					Runtime_settings_base($$anchor, {
						get dx() {
							return get(localDx);
						},
						set dx($$value) {
							set(localDx, $$value);
						},
						$$legacy: true
					});
				}
			);

			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
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

var root_1$8 = template(`<li><i> </i> <span class="choice-text svelte-1wos05d"> </span> <span class="choice-char svelte-1wos05d"> </span></li>`);
var root$5 = template(`<div class="svelte-1wos05d"><ul class="svelte-1wos05d"></ul></div>`);

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

	var div = root$5();

	bind_this(div, ($$value) => mutate(context, get(context).div = $$value), () => get(context)?.div);

	var ul = child(div);

	each(ul, 5, () => get(context).menu, index, ($$anchor, choice, index) => {
		var li = root_1$8();

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

var root$4 = template(`<textarea name="txt-name" spellcheck="false" class="svelte-1xkqtu5"></textarea>`);

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

	var textarea = root$4();

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

var root_5$1 = template(`<p class="line contract-line svelte-1y335rc"><span class="contract-key svelte-1y335rc"> </span><span class="punct svelte-1y335rc">:</span></p>`);
var root_8 = template(`<p class="line contract-line svelte-1y335rc"><span class="contract-key svelte-1y335rc">summary</span><span class="punct svelte-1y335rc">:</span><span class="summary svelte-1y335rc"> </span></p>`);
var root_7 = template(`<p class="line contract-line svelte-1y335rc"><span class="field svelte-1y335rc"> </span><span class="punct svelte-1y335rc">:</span><span class="type svelte-1y335rc"> </span></p> <!>`, 1);
var root_10 = template(`<p class="line contract-line svelte-1y335rc"><span class="contract-key svelte-1y335rc">kind</span><span class="punct svelte-1y335rc">:</span><span class="kind svelte-1y335rc"> </span></p>`);
var root_11$1 = template(`<p class="line contract-line svelte-1y335rc"><span class="contract-key svelte-1y335rc">summary</span><span class="punct svelte-1y335rc">:</span><span class="summary svelte-1y335rc"> </span></p>`);
var root_9$1 = template(`<p class="line contract-line svelte-1y335rc"><span class="contract-key svelte-1y335rc">type</span><span class="punct svelte-1y335rc">:</span><span class="type svelte-1y335rc"> </span></p> <!> <!>`, 1);
var root_3 = template(`<p class="line brace svelte-1y335rc"></p> <p class="line contract-line svelte-1y335rc" style="--indent:1"><span class="contract-key svelte-1y335rc">role</span><span class="punct svelte-1y335rc">:</span><span class="type svelte-1y335rc"> </span></p> <!> <p class="line brace svelte-1y335rc"></p>`, 1);
var root_13 = template(`<pre class="line svelte-1y335rc"> </pre>`);
var root_2$4 = template(`<div class="section svelte-1y335rc"><p class="section-title svelte-1y335rc">Contract</p> <div class="box contract svelte-1y335rc"><!></div></div>`);
var root_19 = template(`<p class="line meta svelte-1y335rc"><span class="clickable svelte-1y335rc"> </span></p>`);
var root_21$1 = template(`<p class="line meta svelte-1y335rc"><span class="clickable svelte-1y335rc"> </span></p>`);
var root_22 = template(`<p class="line empty svelte-1y335rc">No source profile entry for this internal pin.</p>`);
var root_16$1 = template(`<p class="line endpoint svelte-1y335rc"> </p> <!>`, 1);
var root_23 = template(`<p class="line empty svelte-1y335rc">No internal pins are currently resolved behind this proxy.</p>`);
var root_14$1 = template(`<div class="section svelte-1y335rc"><p class="section-title svelte-1y335rc"> </p> <div class="box lines svelte-1y335rc"><!></div></div>`);
var root_28 = template(`<p class="line status-warning svelte-1y335rc"> </p>`);
var root_29 = template(`<p class="line status-ok svelte-1y335rc">contract match</p>`);
var root_30 = template(`<div class="section svelte-1y335rc"><p class="section-title svelte-1y335rc">Description</p> <div class="box svelte-1y335rc"><pre class="line summary svelte-1y335rc"> </pre></div></div>`);
var root_26 = template(`<div class="box svelte-1y335rc"><div class="lines svelte-1y335rc"><p class="line svelte-1y335rc"><span class="clickable svelte-1y335rc"> </span> </p> <!></div></div> <!>`, 1);
var root_25 = template(`<div class="section svelte-1y335rc"><p class="section-title svelte-1y335rc">Handler and parameters</p></div> <!>`, 1);
var root_34 = template(`<p class="line svelte-1y335rc"><span class="clickable svelte-1y335rc"> </span> </p>`);
var root_32 = template(`<div class="box svelte-1y335rc"><div class="lines svelte-1y335rc"></div></div>`);
var root_36 = template(`<div class="box svelte-1y335rc"><div class="lines svelte-1y335rc"><p class="line svelte-1y335rc"><span class="clickable svelte-1y335rc"> </span> </p></div></div>`);
var root_31 = template(`<div class="section svelte-1y335rc"><p class="section-title svelte-1y335rc">Sent at</p></div> <!>`, 1);
var root_1$7 = template(`<div class="profile svelte-1y335rc"><!> <!></div>`);

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

	const handlers = {
		onShow(
			{ pos, pin, contract, profile, open = null }
		) {
			// check and just hide if repeat
			if (get(_pin) && pin === get(_pin)) {
				set(_pin, null);
				get(box).hide();
				return;
			}

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
			var div = root_1$7();
			var node = child(div);

			if_block(node, () => get(_contract), ($$anchor) => {
				var div_1 = root_2$4();
				var div_2 = sibling(child(div_1), 2);
				var node_1 = child(div_2);

				if_block(
					node_1,
					() => get(_contract).tokens,
					($$anchor) => {
						var fragment_1 = root_3();
						var p = first_child(fragment_1);

						p.textContent = `{`;

						var p_1 = sibling(p, 2);
						var span = sibling(child(p_1), 2);
						var text_1 = child(span);

						var node_2 = sibling(p_1, 2);

						each(node_2, 1, () => get(_contract).tokens, index, ($$anchor, line) => {
							var fragment_2 = comment();
							const row = derived_safe_equal(() => contractRow(get(line)));
							var node_3 = first_child(fragment_2);

							if_block(
								node_3,
								() => get(row).kind === 'header',
								($$anchor) => {
									var p_2 = root_5$1();
									var span_1 = child(p_2);
									var text_2 = child(span_1);

									template_effect(() => {
										set_attribute(p_2, "style", `--indent:${get(line).indent + 1}`);
										set_text(text_2, get(row).key);
									});

									append($$anchor, p_2);
								},
								($$anchor) => {
									var fragment_3 = comment();
									var node_4 = first_child(fragment_3);

									if_block(
										node_4,
										() => get(row).kind === 'field',
										($$anchor) => {
											var fragment_4 = root_7();
											var p_3 = first_child(fragment_4);
											var span_2 = child(p_3);
											var text_3 = child(span_2);

											var span_3 = sibling(span_2, 2);
											var text_4 = child(span_3);

											var node_5 = sibling(p_3, 2);

											if_block(node_5, () => get(row).summary, ($$anchor) => {
												var p_4 = root_8();
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
											var fragment_5 = root_9$1();
											var p_5 = first_child(fragment_5);
											var span_5 = sibling(child(p_5), 2);
											var text_6 = child(span_5);

											var node_6 = sibling(p_5, 2);

											if_block(node_6, () => get(row).typeKind, ($$anchor) => {
												var p_6 = root_10();
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
						var fragment_6 = comment();
						var node_8 = first_child(fragment_6);

						if_block(
							node_8,
							() => get(_contract).text,
							($$anchor) => {
								var pre = root_13();
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
							var fragment_7 = comment();
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
										var fragment_9 = comment();
										var node_13 = first_child(fragment_9);

										each(node_13, 1, () => asArray(get(target).profile), index, ($$anchor, item) => {
											var fragment_10 = comment();
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
													var fragment_11 = comment();
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
					var fragment_12 = comment();
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
								var span_10 = child(p_15);
								var text_14 = child(span_10);

								var text_15 = sibling(span_10);

								var node_18 = sibling(p_15, 2);

								if_block(
									node_18,
									() => get(_profile).typeErrors?.length,
									($$anchor) => {
										var fragment_15 = comment();
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
									set_text(text_14, get(_profile).handler);
									set_text(text_15, `  in ${get(_profile).file ?? ""} (${get(_profile).line ?? ""})`);
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
										var fragment_17 = comment();
										var node_22 = first_child(fragment_17);

										if_block(node_22, () => get(singleProfile) != null, ($$anchor) => {
											var p_18 = root_34();
											var span_11 = child(p_18);
											var text_18 = child(span_11);

											var text_19 = sibling(span_11);

											template_effect(() => {
												set_text(text_18, get(singleProfile).pin);
												set_text(text_19, `  ${get(singleProfile).file ?? ""} (${get(singleProfile).line ?? ""})`);
											});

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
									var fragment_18 = comment();
									var node_23 = first_child(fragment_18);

									if_block(node_23, () => get(_profile) != null, ($$anchor) => {
										var div_11 = root_36();
										var div_12 = child(div_11);
										var p_19 = child(div_12);
										var span_12 = child(p_19);
										var text_20 = child(span_12);

										var text_21 = sibling(span_12);

										template_effect(() => {
											set_text(text_20, get(_profile).pin);
											set_text(text_21, `  ${get(_profile).file ?? ""} (${get(_profile).line ?? ""})`);
										});

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

var root_2$3 = template(`<div class="error svelte-1wofc62"> </div>`);
var root_1$6 = template(`<div class="form svelte-1wofc62"><label class="inline svelte-1wofc62"><input type="checkbox" class="svelte-1wofc62"> expose input pin as agent tool</label> <label class="svelte-1wofc62">id <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">title <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">description <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <div class="row svelte-1wofc62"><label class="svelte-1wofc62">risk <select class="svelte-1wofc62"><option>low</option><option>medium</option><option>high</option></select></label> <label class="svelte-1wofc62">approval <select class="svelte-1wofc62"><option>never</option><option>on-request</option><option>always</option></select></label></div> <label class="svelte-1wofc62">timeoutMs <input spellcheck="false" class="svelte-1wofc62"></label> <label class="svelte-1wofc62">schema JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">effects JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">examples JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <label class="svelte-1wofc62">usageGuidance JSON <textarea spellcheck="false" class="svelte-1wofc62"></textarea></label> <!></div>`);

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

	const handlers = {
		onShow({ pos, pin: shownPin, ok: okFn, cancel }) {
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
			var div = root_1$6();
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
				var div_2 = root_2$3();
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

var root_2$2 = template(`<div class="error svelte-1jevcjj"> </div>`);
var root_1$5 = template(`<div class="form svelte-1jevcjj"><label class="inline svelte-1jevcjj"><input type="checkbox" class="svelte-1jevcjj"> expose output pin as agent event</label> <label class="svelte-1jevcjj">id <input spellcheck="false" class="svelte-1jevcjj"></label> <label class="svelte-1jevcjj">title <input spellcheck="false" class="svelte-1jevcjj"></label> <label class="svelte-1jevcjj">description <textarea spellcheck="false" class="svelte-1jevcjj"></textarea></label> <label class="svelte-1jevcjj">schema JSON <textarea spellcheck="false" class="svelte-1jevcjj"></textarea></label> <!></div>`);

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

	const handlers = {
		onShow({ pos, pin: shownPin, ok: okFn, cancel }) {
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
			var div = root_1$5();
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
				var div_1 = root_2$2();
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

var root_1$4 = template(`<p class="svelte-nkfvqo"> </p>`);

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
			var p = root_1$4();
			var text_1 = child(p);
			template_effect(() => set_text(text_1, get(text)));
			append($$anchor, p);
		},
		$$slots: { default: true }
	});

	bind_prop($$props, "handlers", handlers);
	return pop({ handlers });
}

var root$3 = template(`<div class="input-field svelte-dgsivs"><label class="svelte-dgsivs"> </label> <input type="text" spellcheck="false" class="svelte-dgsivs"></div>`);

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

	var div = root$3();
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

var root_2$1 = template(`<li class="svelte-1kcgyk9"><span class="material-icons-outlined kind svelte-1kcgyk9"> </span> <span class="name svelte-1kcgyk9"> </span></li>`);
var root_1$3 = template(`<ul class="suggestions svelte-1kcgyk9"></ul>`);
var root$2 = template(`<div class="input-field svelte-1kcgyk9"><label class="svelte-1kcgyk9"> </label> <input type="text" spellcheck="false" class="svelte-1kcgyk9"></div> <!>`, 1);

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

	var fragment = root$2();
	var div = first_child(fragment);
	var label_1 = child(div);

	set_attribute(label_1, "for", fid);

	var text = child(label_1);

	var input_1 = sibling(label_1, 2);

	bind_this(input_1, ($$value) => set(field, $$value), () => get(field));
	set_attribute(input_1, "id", fid);

	var node = sibling(div, 2);

	if_block(node, () => get(listOpen) && get(suggestions).length && get(listRect), ($$anchor) => {
		var ul = root_1$3();

		each(ul, 5, () => get(suggestions), index, ($$anchor, suggestion, index) => {
			var li = root_2$1();
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

var root_1$2 = template(`<!> <!>`, 1);

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
			var fragment_1 = root_1$2();
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

var root$1 = template(`<div class="input-field svelte-1tr5m2d"><label class="svelte-1tr5m2d"> </label> <input type="text" spellcheck="false" readonly="" class="svelte-1tr5m2d"></div>`);

function Label_info_field($$anchor, $$props) {
	push($$props, false);

	let label = prop($$props, "label", 8),
		info = prop($$props, "info", 12),
		style = prop($$props, "style", 8);

	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {});
	init();

	var div = root$1();
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

var root = template(`<div class="color-field svelte-2bjr9q"><label class="svelte-2bjr9q"> </label> <input type="color" class="svelte-2bjr9q"></div>`);

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

	var div = root();
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

var root_1$1 = template(`<!> <!> <!> <!> <!> <!>`, 1);

function Document_settings($$anchor, $$props) {
	push($$props, false);

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

			mutate(box, get(box).ok = ok ? () => ok(get(_runtime)) : null);
			mutate(box, get(box).cancel = cancel ? () => cancel() : null);
			// The field settings
			set(_path, path);
			set(_version, settings.version);
			set(_created, settings.created);
			set(_saved, settings.saved);
			set(_runtime, settings.runtime);
			set(_color, settings.style.rgb);
			set(_onColor, onColor);
			// and show
			get(box).show(pos);
		}
	};

	init();

	Popup_box($$anchor, {
		get box() {
			return get(box);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$1();
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

			Color_picker(node_5, {
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
					var fragment_1 = comment();
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
							var fragment_4 = comment();
							var node_2 = first_child(fragment_4);

							if_block(
								node_2,
								() => get(entry).node,
								($$anchor) => {
									var fragment_5 = comment();
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
											var fragment_6 = comment();
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
													var fragment_7 = comment();
													var node_5 = first_child(fragment_7);

													if_block(
														node_5,
														() => get(entry).node.group,
														($$anchor) => {
															var fragment_8 = comment();
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
																		var fragment_10 = comment();
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
																				var fragment_11 = comment();
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
																						var fragment_12 = comment();
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
const ConfirmBox = getFactory(Confirm_box);
const ContextMenuFactory = getFactory(Context_menu);
const JsonInputFactory = getFactory(Json_area_input);
const TextBlockFactory = getFactory(Text_area_input);
const PinProfileFactory = getFactory(Pin_profile);
const PinToolFactory = getFactory(Pin_tool);
const PinEventFactory = getFactory(Pin_event);
const MessageBoxFactory = getFactory(Message_box);
const NameAndPathFactory = getFactory(Name_path);
const PathRequestFactory = getFactory(Path);
const SingleTextFieldFactory = getFactory(Single_text_field);
const DocumentSettingsFactory = getFactory(Document_settings);
const NodeSelectorFactory = getFactory(Node_selector);

// ------------------------------------------------------------------
// Model: 
// Path: C:/dev/vmblu/ui-svelte/model/ui-svelte.app.js
// Creation date 5/4/2026, 11:15:15 AM
// ------------------------------------------------------------------


//The runtime nodes
const nodeList = [
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "ALvG", 
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
	uid: "CmQX", 
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
	uid: "cPCR", 
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
	uid: "lAxf", 
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
	uid: "lOuj", 
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
	uid: "eHpa", 
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
	uid: "OhIc", 
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
	uid: "RDAl", 
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
	uid: "WmBb", 
	factory: DocumentSettingsFactory,
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
	uid: "UhiS", 
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
	uid: "yVJT", 
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
	uid: "jTQo", 
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
	uid: "KYkJ", 
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
	uid: "yESR", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________CANVAS LAYOUT
	{
	name: "canvas layout", 
	uid: "rWmC", 
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
	uid: "yduf", 
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
	uid: "VakN", 
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
	uid: "UbGq", 
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
	uid: "PzJY", 
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
	uid: "kmxS", 
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
	uid: "WPlK", 
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
	uid: "MiUG", 
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"save -> ()",
		"save as -> ()",
		"save all -> ()",
		"accept changes -> ()",
		"sync model -> ()",
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
	uid: "ZThq", 
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
	uid: "mBfE", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> ()",
		"accept changes -> ()",
		"recalibrate -> ()",
		"sync -> ()",
		"grid on-off -> ()",
		"show settings -> ()",
		"set save point -> ()",
		"back to save point -> ()",
		"make lib -> ()",
		"make app -> ()"
		]
	},
];

//The filters
const filterList = [
];

const agentRuntimeOptions = {};

// prepare the runtime
const runtime = scaffold(nodeList, filterList, agentRuntimeOptions);

// and start the app
runtime.start();
//# sourceMappingURL=ui-svelte-bundle.js.map
