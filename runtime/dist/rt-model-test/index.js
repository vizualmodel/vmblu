var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// rt-model-test/browser-test-host.js
var _BrowserTestHost = class _BrowserTestHost {
  constructor({ document = globalThis.document, root = null, settle = null } = {}) {
    if (!document) throw new Error("BrowserTestHost requires a browser document");
    this.document = document;
    this.root = root ?? document.body;
    this.ownsRoot = false;
    this.settleCallback = settle;
    this.mountedView = null;
  }
  async mount(view) {
    var _a, _b;
    const element = (view == null ? void 0 : view.element) ?? view;
    if (!element || typeof element !== "object") throw new Error("The view reply does not contain a DOM element");
    if (!this.root) {
      this.root = this.document.createElement("div");
      this.document.body.append(this.root);
      this.ownsRoot = true;
    }
    if (!((_b = (_a = this.root).contains) == null ? void 0 : _b.call(_a, element))) this.root.append(element);
    this.mountedView = element;
    await this.settle();
    return element;
  }
  async execute(action) {
    var _a;
    if (action.kind === "click") {
      const element = this.locateOne(action.locator);
      element.click();
    } else if (action.kind === "fill") {
      const element = this.locateOne(action.locator);
      (_a = element.focus) == null ? void 0 : _a.call(element);
      element.value = action.value;
      element.dispatchEvent(new this.document.defaultView.Event("input", { bubbles: true }));
      element.dispatchEvent(new this.document.defaultView.Event("change", { bubbles: true }));
    } else if (action.kind === "wait") {
      await delay(action.ms);
    } else throw new Error(`Unsupported browser test action: ${action.kind}`);
    await this.settle();
  }
  async assert(expectation) {
    await this.settle();
    const elements = this.locate(expectation.locator);
    const failures = [];
    const requiresMatch = expectation.count === void 0 || expectation.count > 0 || expectation.text !== void 0 || expectation.class !== void 0 || expectation.visible === true;
    if (requiresMatch && elements.length === 0) failures.push("locator matched no elements");
    if (expectation.count !== void 0 && elements.length !== expectation.count) {
      failures.push(`expected ${expectation.count} matching element(s), observed ${elements.length}`);
    }
    if (expectation.visible !== void 0) {
      const visible = elements.filter(isVisible).length;
      const expected = expectation.visible ? elements.length : 0;
      if (visible !== expected) failures.push(`expected visible=${expectation.visible}, observed ${visible} visible element(s)`);
    }
    if (expectation.text !== void 0) {
      const texts = elements.map((element) => String(element.textContent ?? "").trim());
      const expectedTexts = Array.isArray(expectation.text) ? expectation.text : [expectation.text];
      if (!expectedTexts.every((text, index) => {
        var _a;
        return (_a = texts[index]) == null ? void 0 : _a.includes(String(text));
      })) {
        failures.push(`expected text ${JSON.stringify(expectedTexts)}, observed ${JSON.stringify(texts)}`);
      }
    }
    if (expectation.class !== void 0) {
      const classes = Array.isArray(expectation.class) ? expectation.class : [expectation.class];
      for (const className of classes) {
        if (!elements.every((element) => {
          var _a;
          return (_a = element.classList) == null ? void 0 : _a.contains(className);
        })) {
          failures.push(`expected every matching element to have class '${className}'`);
        }
      }
    }
    return failures.length ? {
      message: `View expectation failed: ${failures.join("; ")}`,
      expected: expectation,
      observed: elements.map((element) => ({
        text: String(element.textContent ?? "").trim(),
        class: typeof element.className === "string" ? element.className : ""
      }))
    } : null;
  }
  locate(locator = {}) {
    const root = this.mountedView ?? this.root ?? this.document;
    if (locator.css) return [...root.querySelectorAll(locator.css)];
    if (locator.role) {
      const selector = roleSelector(locator.role);
      return [...root.querySelectorAll(selector)].filter((element) => {
        var _a;
        if (((_a = element.getAttribute) == null ? void 0 : _a.call(element, "role")) && element.getAttribute("role") !== locator.role) return false;
        if (locator.name === void 0) return true;
        return accessibleName(element).includes(String(locator.name));
      });
    }
    throw new Error("A browser locator requires either css or role");
  }
  locateOne(locator) {
    const elements = this.locate(locator);
    const index = (locator == null ? void 0 : locator.index) ?? 0;
    if (!elements[index]) throw new Error(`Browser locator matched no element at index ${index}`);
    return elements[index];
  }
  async settle() {
    if (this.settleCallback) return this.settleCallback();
    await Promise.resolve();
    if (typeof globalThis.requestAnimationFrame === "function") {
      await new Promise((resolve) => globalThis.requestAnimationFrame(() => resolve()));
    } else await delay(0);
  }
  async stop() {
    var _a, _b, _c, _d, _e;
    if (this.ownsRoot) (_b = (_a = this.root) == null ? void 0 : _a.remove) == null ? void 0 : _b.call(_a);
    else if (((_c = this.mountedView) == null ? void 0 : _c.parentNode) === this.root) (_e = (_d = this.mountedView).remove) == null ? void 0 : _e.call(_d);
    this.mountedView = null;
  }
};
__name(_BrowserTestHost, "BrowserTestHost");
var BrowserTestHost = _BrowserTestHost;
function roleSelector(role) {
  const native = {
    button: 'button,[role="button"]',
    link: 'a[href],[role="link"]',
    textbox: 'input:not([type]),input[type="text"],input[type="email"],input[type="search"],textarea,[role="textbox"]',
    checkbox: 'input[type="checkbox"],[role="checkbox"]'
  };
  return native[role] ?? `[role="${cssEscape(role)}"]`;
}
__name(roleSelector, "roleSelector");
function accessibleName(element) {
  var _a, _b;
  const explicit = ((_a = element.getAttribute) == null ? void 0 : _a.call(element, "aria-label")) ?? ((_b = element.getAttribute) == null ? void 0 : _b.call(element, "title"));
  if (explicit) return String(explicit).trim();
  const text = String(element.textContent ?? "").trim();
  return text || String(element.value ?? "").trim();
}
__name(accessibleName, "accessibleName");
function isVisible(element) {
  var _a, _b, _c;
  if (element.hidden) return false;
  const style = (_c = (_b = (_a = element.ownerDocument) == null ? void 0 : _a.defaultView) == null ? void 0 : _b.getComputedStyle) == null ? void 0 : _c.call(_b, element);
  return !style || style.display !== "none" && style.visibility !== "hidden";
}
__name(isVisible, "isVisible");
function cssEscape(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}
__name(cssEscape, "cssEscape");
function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(delay, "delay");

// rt-model-test/artifact-hash.js
function hashTestArtifact(value) {
  const text = JSON.stringify(normalize(value));
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index++) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
__name(hashTestArtifact, "hashTestArtifact");
function normalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => item === void 0 ? null : normalize(item));
  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== void 0) normalized[key] = normalize(value[key]);
  }
  return normalized;
}
__name(normalize, "normalize");

// rt-model-test/deep-equal.js
function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}
__name(deepEqual, "deepEqual");
function reportValue(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (isElement(value)) return describeElement(value);
  if (seen.has(value)) return "<circular>";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => reportValue(item, seen));
  const result = {};
  for (const [key, item] of Object.entries(value)) result[key] = reportValue(item, seen);
  return result;
}
__name(reportValue, "reportValue");
function isElement(value) {
  return typeof (value == null ? void 0 : value.nodeType) === "number" && typeof (value == null ? void 0 : value.nodeName) === "string";
}
__name(isElement, "isElement");
function describeElement(element) {
  const name = String(element.nodeName ?? "element").toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = typeof element.className === "string" && element.className.trim() ? `.${element.className.trim().split(/\s+/).join(".")}` : "";
  return `<${name}${id}${className}>`;
}
__name(describeElement, "describeElement");

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
    const pinName2 = str.slice(0, atIndex).trim();
    const nodeName = str.slice(atIndex + 1, uidStart).trim();
    if (pinName2.length == 0 || nodeName.length == 0) return null;
    return { pinName: pinName2, nodeName, uid };
  },
  pinToHandler(pinName2) {
    const words = pinName2.split(/[ .-]+/).map((word) => word.replace(/[^a-zA-Z0-9_]/g, ""));
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
  logNotConnected(nodeName, pinName2) {
    console.log(`${nodeName}[${pinName2}] : not connected.`);
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
function normalize2(dx = null) {
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
__name(normalize2, "normalize");
function clone(dx = null) {
  return normalize2(dx);
}
__name(clone, "clone");
function reset(target) {
  const defaults = make();
  assign(target, defaults);
  return target;
}
__name(reset, "reset");
function assign(target, dx = null) {
  const normalized = normalize2(dx);
  target.run = structuredClone(normalized.run);
  target.monitor = structuredClone(normalized.monitor);
  delete target.logMessages;
  delete target.worker;
  delete target.security;
  return target;
}
__name(assign, "assign");
function isDefault(dx = null) {
  const normalized = normalize2(dx);
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
    node: normalize2(nodeDx)
  };
}
__name(effectivePolicy, "effectivePolicy");
var runtimeSettings = {
  make,
  normalize: normalize2,
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

// rt-model-test/routed-model-adapter.js
var _RoutedModelTestAdapter = class _RoutedModelTestAdapter {
  constructor({ nodeList = [], boundary = { inputs: [], outputs: [] }, Runtime: Runtime3 = Runtime2, runtimeOptions = {}, host = null } = {}) {
    this.nodeList = nodeList;
    this.boundary = boundary;
    this.Runtime = Runtime3;
    this.runtimeOptions = runtimeOptions;
    this.host = host;
    this.runtime = null;
    this.observations = [];
    this.started = 0;
    this.replyObservation = null;
    this.mountOnly = false;
  }
  async start() {
    this.started = Date.now();
    this.observations = [];
    this.runtime = new this.Runtime(this.nodeList, this.runtimeOptions);
    this.instrumentRuntime();
    this.runtime.start();
  }
  async execute(action) {
    if (action.kind === "wait") {
      if (this.host) await this.host.execute(action);
      else await delay2(action.ms);
      await this.drain();
      return;
    }
    if (action.kind === "send" || action.kind === "request" || action.kind === "mount") {
      const boundaryInput = this.boundary.inputs.find((input) => input.pin === action.pin);
      if (!boundaryInput) throw new Error(`Target boundary has no input pin '${action.pin}'`);
      this.replyObservation = action.kind === "request" || action.kind === "mount" ? void 0 : null;
      this.mountOnly = action.kind === "mount";
      for (const target of boundaryInput.targets) {
        await this.deliver(target, action.pin, action.message, action.kind !== "send");
      }
      await this.drain();
      if (action.kind === "mount") {
        if (!this.host) throw new Error("The mount action requires a browser test host");
        if (this.replyObservation === void 0) throw new Error(`Boundary pin '${action.pin}' did not reply with a view`);
        await this.host.mount(this.replyObservation);
      }
      return;
    }
    if (!this.host) throw new Error(`Action '${action.kind}' requires a browser test host`);
    await this.host.execute(action);
  }
  async assert(expectation) {
    if (expectation.kind !== "view") return null;
    if (!this.host) return { message: "A view expectation requires a browser test host" };
    return this.host.assert(expectation);
  }
  getObservations() {
    return this.observations;
  }
  async stop() {
    var _a, _b, _c, _d;
    (_b = (_a = this.runtime) == null ? void 0 : _a.stop) == null ? void 0 : _b.call(_a);
    await ((_d = (_c = this.host) == null ? void 0 : _c.stop) == null ? void 0 : _d.call(_c));
    this.runtime = null;
  }
  instrumentRuntime() {
    const runtime = this.runtime;
    const originalSendTo = runtime.sendTo.bind(runtime);
    const originalReply = runtime.reply.bind(runtime);
    runtime.sendTo = (source, pin, targets, message) => {
      for (const output of this.boundary.outputs) {
        if (output.sourceUid === source.uid && output.sourcePin === pin) {
          this.observe("send", output.pin, message);
        }
      }
      return originalSendTo(source, pin, targets, message);
    };
    runtime.reply = (source, message) => {
      var _a, _b;
      if ((_b = (_a = source.msg) == null ? void 0 : _a.source) == null ? void 0 : _b.isTestBoundary) {
        if (this.replyObservation === void 0) {
          this.replyObservation = message;
          if (!this.mountOnly) this.observe("reply", source.msg.txPin, message);
        } else this.observe("reply", source.msg.txPin, message);
        return 1;
      }
      return originalReply(source, message);
    };
  }
  async deliver(target, boundaryPin, message, expectsReply) {
    const actor = this.runtime.actors.find((candidate) => candidate.uid === target.uid);
    if (!actor) throw new Error(`Boundary target node '${target.uid}' was not found`);
    const rxIndex = actor.rxSink.findIndex((rx2) => rx2.pin === target.pin);
    if (rxIndex < 0) throw new Error(`Boundary target pin '${target.pin}' was not found on '${actor.name}'`);
    const rx = actor.rxSink[rxIndex];
    const boundarySource = {
      isTestBoundary: true,
      name: "<test boundary>",
      uid: "<test boundary>"
    };
    actor.msg = {
      source: boundarySource,
      dest: actor,
      param: message,
      txRef: expectsReply ? 1 : 0,
      txPin: boundaryPin,
      rxRef: 0,
      rxPin: target.pin
    };
    await rx.handler.call(actor.cell, message);
  }
  async drain() {
    var _a, _b;
    for (let pass = 0; pass < 100 && this.runtime.qOut.length; pass++) {
      this.runtime.clearReceiveTimer();
      this.runtime.receive();
      await Promise.resolve();
    }
    if (this.runtime.qOut.length) throw new Error("Routed model did not become idle after 100 message passes");
    await ((_b = (_a = this.host) == null ? void 0 : _a.settle) == null ? void 0 : _b.call(_a));
  }
  observe(kind, pin, message) {
    this.observations.push({ kind, pin, message: reportValue(message), atMs: Date.now() - this.started });
  }
};
__name(_RoutedModelTestAdapter, "RoutedModelTestAdapter");
var RoutedModelTestAdapter = _RoutedModelTestAdapter;
function delay2(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(delay2, "delay");

// rt-model-test/source-node-adapter.js
var _SourceNodeTestAdapter = class _SourceNodeTestAdapter {
  constructor({ factory, sx = null, inputPins = [], outputPins = [], host = null } = {}) {
    if (typeof factory !== "function") throw new TypeError("SourceNodeTestAdapter requires a node factory");
    this.factory = factory;
    this.sx = sx;
    this.inputPins = new Set(inputPins.map(pinName));
    this.outputPins = new Set(outputPins.map(pinName));
    this.host = host;
    this.cell = null;
    this.handlers = /* @__PURE__ */ new Map();
    this.observations = [];
    this.started = 0;
    this.activePin = null;
    this.mountReply = null;
  }
  async start() {
    this.started = Date.now();
    this.observations = [];
    this.mountReply = null;
    const tx = this.createTx();
    this.cell = makeCell(this.factory, tx, this.sx);
    this.handlers = collectHandlers(this.cell, this.inputPins);
  }
  async execute(action) {
    if (action.kind === "wait") {
      if (this.host) await this.host.execute(action);
      else await delay3(action.ms);
      return;
    }
    if (action.kind === "send" || action.kind === "request" || action.kind === "mount") {
      if (!this.inputPins.has(action.pin)) throw new Error(`Target has no input pin '${action.pin}'`);
      const handler = this.handlers.get(action.pin);
      if (!handler) throw new Error(`Target has no handler for input pin '${action.pin}'`);
      this.activePin = action.pin;
      this.mountReply = action.kind === "mount" ? void 0 : null;
      try {
        await handler.call(this.cell, action.message);
      } finally {
        this.activePin = null;
      }
      if (action.kind === "mount") {
        if (!this.host) throw new Error("The mount action requires a browser test host");
        if (this.mountReply === void 0) throw new Error(`Input pin '${action.pin}' did not reply with a view`);
        await this.host.mount(this.mountReply);
      }
      return;
    }
    if (!this.host) throw new Error(`Action '${action.kind}' requires a browser test host`);
    await this.host.execute(action);
  }
  async assert(expectation) {
    if (expectation.kind !== "view") return null;
    if (!this.host) return { message: "A view expectation requires a browser test host" };
    return this.host.assert(expectation);
  }
  getObservations() {
    return this.observations;
  }
  async stop() {
    var _a, _b, _c, _d, _e, _f;
    await ((_b = (_a = this.host) == null ? void 0 : _a.stop) == null ? void 0 : _b.call(_a));
    await ((_d = (_c = this.cell) == null ? void 0 : _c.stop) == null ? void 0 : _d.call(_c));
    await ((_f = (_e = this.cell) == null ? void 0 : _e.destroy) == null ? void 0 : _f.call(_e));
    this.cell = null;
  }
  createTx() {
    const adapter = this;
    const observe = /* @__PURE__ */ __name((kind, pin, message) => {
      this.observations.push({ kind, pin, message: reportValue(message), atMs: Date.now() - this.started });
      return 1;
    }, "observe");
    return {
      get pin() {
        return adapter.activePin;
      },
      send: /* @__PURE__ */ __name((pin, message) => {
        if (!this.outputPins.has(pin)) throw new Error(`Target sent on undeclared output pin '${pin}'`);
        return observe("send", pin, message);
      }, "send"),
      request() {
        throw new Error("Outbound test requests require a configured collaborator");
      },
      reply: /* @__PURE__ */ __name((message) => {
        if (this.mountReply === void 0) {
          this.mountReply = message;
          return 1;
        }
        return observe("reply", this.activePin, message);
      }, "reply"),
      next() {
        throw new Error("Chained test replies are not supported");
      },
      reschedule() {
        throw new Error("Test rescheduling is not supported");
      },
      to() {
        throw new Error("Selective test sends are not supported by an isolated source node");
      },
      select() {
        throw new Error("Selective test sends are not supported by an isolated source node");
      }
    };
  }
};
__name(_SourceNodeTestAdapter, "SourceNodeTestAdapter");
var SourceNodeTestAdapter = _SourceNodeTestAdapter;
function delay3(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(delay3, "delay");
function pinName(pin) {
  return typeof pin === "string" ? pin : pin == null ? void 0 : pin.name;
}
__name(pinName, "pinName");
function makeCell(factory, tx, sx) {
  if (shouldUseNew2(factory)) return new factory(tx, sx);
  try {
    return factory(tx, sx);
  } catch (error) {
    if (error instanceof TypeError && /class constructor/i.test(error.message)) return new factory(tx, sx);
    throw error;
  }
}
__name(makeCell, "makeCell");
function shouldUseNew2(factory) {
  if (typeof factory !== "function" || !factory.prototype) return false;
  const names = Object.getOwnPropertyNames(factory.prototype);
  return names.length !== 1 || names[0] !== "constructor" || factory.prototype.constructor !== factory;
}
__name(shouldUseNew2, "shouldUseNew");
function collectHandlers(cell, inputPins) {
  const handlers = /* @__PURE__ */ new Map();
  if (!cell) return handlers;
  const entries = Object.entries(cell);
  let prototype = Object.getPrototypeOf(cell);
  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name !== "constructor" && typeof prototype[name] === "function") entries.push([name, prototype[name]]);
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  for (const pin of inputPins) {
    const handlerNames = [`-> ${pin}`, `=> ${pin}`, pinToHandler(pin)];
    const entry = entries.find(([name, value]) => handlerNames.includes(name) && typeof value === "function");
    if (entry) handlers.set(pin, entry[1]);
  }
  return handlers;
}
__name(collectHandlers, "collectHandlers");
function pinToHandler(pin) {
  const words = String(pin).split(/[ .-]+/).map((word) => word.replace(/[^a-zA-Z0-9_]/g, "")).filter(Boolean);
  return `on${words.map((word) => word[0].toUpperCase() + word.slice(1)).join("")}`;
}
__name(pinToHandler, "pinToHandler");

// rt-model-test/model-test-runtime.js
var _ModelTestRuntime = class _ModelTestRuntime {
  constructor({ adapter = null, scope = null, ...options } = {}) {
    this.adapter = adapter ?? createAdapter(scope, options);
    if (!this.adapter) throw new TypeError("ModelTestRuntime requires a target adapter or supported scope");
  }
  async run(artifact, { testPath = "<memory>", artifactHash = null } = {}) {
    if (!(artifact == null ? void 0 : artifact.target) || !Array.isArray(artifact == null ? void 0 : artifact.scenarios)) {
      throw new TypeError("ModelTestRuntime requires a valid model test artifact");
    }
    const started = Date.now();
    const scenarios = [];
    for (const scenario of artifact.scenarios) scenarios.push(await this.runScenario(scenario));
    const summary = summarize(scenarios);
    return {
      $schema: `https://vmblu.dev/context/${artifact.schemaVersion}/test-report.schema.json`,
      kind: "vmblu.test-report",
      version: 1,
      schemaVersion: artifact.schemaVersion,
      test: testPath,
      artifactHash: artifactHash ?? hashTestArtifact(artifact),
      target: normalizeTarget(artifact.target),
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
      status: summary.error > 0 ? "error" : summary.failed > 0 ? "failed" : "passed",
      summary,
      scenarios
    };
  }
  async runScenario(scenario) {
    var _a, _b;
    const started = Date.now();
    const failures = [];
    let observations = [];
    let status = "passed";
    try {
      await this.adapter.start(scenario);
      const timeoutMs = scenario.timeoutMs ?? 1e3;
      await withTimeout(this.runActions(scenario.actions), timeoutMs, scenario.id);
      observations = this.adapter.getObservations();
      failures.push(...compareMessageObservations(scenario.expect, observations));
      for (const expectation of scenario.expect.filter((item) => item.kind === "view")) {
        const failure = await this.adapter.assert(expectation);
        if (failure) failures.push(failure);
      }
      status = failures.length ? "failed" : "passed";
    } catch (error) {
      observations = ((_b = (_a = this.adapter).getObservations) == null ? void 0 : _b.call(_a)) ?? observations;
      failures.push({ message: (error == null ? void 0 : error.message) ?? String(error) });
      status = "error";
    } finally {
      try {
        await this.adapter.stop();
      } catch (error) {
        failures.push({ message: `Test cleanup failed: ${(error == null ? void 0 : error.message) ?? String(error)}` });
        status = "error";
      }
    }
    return scenarioResult(scenario, status, started, observations, failures);
  }
  async runActions(actions) {
    for (const action of actions) await this.adapter.execute(action);
  }
};
__name(_ModelTestRuntime, "ModelTestRuntime");
var ModelTestRuntime = _ModelTestRuntime;
async function runModelTests(options) {
  var _a;
  const { artifact, testPath, artifactHash, ...runtimeOptions } = options ?? {};
  const scope = ((_a = artifact == null ? void 0 : artifact.target) == null ? void 0 : _a.scope) ?? runtimeOptions.scope ?? "node";
  return new ModelTestRuntime({ ...runtimeOptions, scope }).run(artifact, { testPath, artifactHash });
}
__name(runModelTests, "runModelTests");
function createAdapter(scope, options) {
  if (scope === "node") return new SourceNodeTestAdapter(options);
  if (scope === "group" || scope === "model") return new RoutedModelTestAdapter(options);
  return null;
}
__name(createAdapter, "createAdapter");
function compareMessageObservations(expectations, observations) {
  const expected = expand(expectations.filter((item) => item.kind === "send" || item.kind === "reply"));
  const actual = observations.filter((item) => item.kind === "send" || item.kind === "reply").map(({ kind, pin, message }) => ({ kind, pin, message }));
  if (deepEqual(actual, expected)) return [];
  return [{
    message: "Observed boundary messages do not match the expected sequence",
    expected,
    observed: actual
  }];
}
__name(compareMessageObservations, "compareMessageObservations");
function expand(expectations) {
  const result = [];
  for (const expectation of expectations) {
    for (let index = 0; index < (expectation.count ?? 1); index++) {
      result.push({ kind: expectation.kind, pin: expectation.pin, message: expectation.message });
    }
  }
  return result;
}
__name(expand, "expand");
function scenarioResult(scenario, status, started, observations, failures) {
  return {
    id: scenario.id,
    title: scenario.title,
    purpose: scenario.purpose,
    actions: scenario.actions,
    expect: scenario.expect,
    status,
    durationMs: Date.now() - started,
    observations,
    failures
  };
}
__name(scenarioResult, "scenarioResult");
function normalizeTarget(target) {
  return { scope: target.scope ?? "node", name: target.name, path: target.path };
}
__name(normalizeTarget, "normalizeTarget");
function summarize(scenarios) {
  const summary = { total: scenarios.length, passed: 0, failed: 0, skipped: 0, error: 0 };
  for (const scenario of scenarios) summary[scenario.status]++;
  return summary;
}
__name(summarize, "summarize");
function withTimeout(promise, timeoutMs, scenarioId) {
  if (!timeoutMs) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Scenario '${scenarioId}' timed out after ${timeoutMs} ms`)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
__name(withTimeout, "withTimeout");
export {
  BrowserTestHost,
  ModelTestRuntime,
  RoutedModelTestAdapter,
  SourceNodeTestAdapter,
  hashTestArtifact,
  runModelTests
};
//# sourceMappingURL=index.js.map