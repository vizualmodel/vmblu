var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/resolve-queue.js
function Deferred() {
  this.promise = new Promise((resolve, reject) => {
    this._resolve = resolve;
    this._reject = reject;
  });
}
__name(Deferred, "Deferred");
Deferred.prototype = {
  // when deferred is resolved/rejected call the actual resolve
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
    const newDefs = this.defs.map((d) => {
      const next = new Deferred();
      d.promise.then(onFulfilled, onRejected).then(next.resolve.bind(next), next.reject.bind(next));
      return next;
    });
    return new PromiseHandler(newDefs);
  },
  catch(onRejected) {
    const newDefs = this.defs.map((d) => {
      const next = new Deferred();
      d.promise.catch(onRejected).then(next.resolve.bind(next), next.reject.bind(next));
      return next;
    });
    return new PromiseHandler(newDefs);
  },
  // Dynamically resize the handler to hold `count` deferreds
  replace(count) {
    if (count > this.defs.length) {
      for (let i = this.defs.length; i < count; i++) {
        this.defs.push(new Deferred());
      }
    } else if (count < this.defs.length) {
      this.defs.splice(count).forEach((d) => {
      });
    }
  }
};
function ResolveQueue() {
  this.minTimeout = 1e3;
  this.queue = /* @__PURE__ */ new Map();
}
__name(ResolveQueue, "ResolveQueue");
ResolveQueue.prototype = {
  /**
   * Always returns a PromiseHandler (even for a single reply)
   * @param {string} txRef - transaction reference
   * @param {number} timeout - desired timeout in ms
   * @param {number} count - number of expected replies (default 1)
   */
  addPromiseHandler(txRef, timeout, count = 1) {
    const duration = Math.max(timeout, this.minTimeout);
    const defs = Array.from({ length: count }, () => new Deferred());
    const handler = new PromiseHandler(defs);
    this.queue.set(txRef, { handler, time: { start: Date.now(), duration } });
    return handler;
  },
  /**
   * Replace the existing handler's deferred count
   * @param {string} txRef
   * @param {number} count
   */
  changePromiseHandler(txRef, count) {
    const entry = this.queue.get(txRef);
    if (!entry) return;
    entry.handler.replace(count);
  },
  /**
   * Trigger the next deferred in line when a reply arrives
   * @param {string} rxRef
   * @param {*} value
   */
  trigger(rxRef, value) {
    const entry = this.queue.get(rxRef);
    if (!entry) return console.log(rxRef, "NOT FOUND");
    const d = entry.handler.defs.shift();
    d.resolve(value);
    if (entry.handler.defs.length === 0) {
      this.queue.delete(rxRef);
    }
  },
  /**
   * Periodically call this to reject any timed‑out handlers
   * @param {number} [now=Date.now()]
   */
  checkTimeouts(now = Date.now()) {
    for (const [txRef, entry] of this.queue.entries()) {
      const { start, duration } = entry.time;
      if (start + duration <= now) {
        const err = new Error("Reply timeout", { sender: txRef, msec: duration });
        entry.handler.defs.forEach((d) => d.reject(err));
        this.queue.delete(txRef);
      }
    }
  }
};

// src/target.js
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
  // just remove the arrow at the front and trim
  stringToInput(str) {
    const pure = str.trim();
    const symbol = pure.slice(0, 2);
    const pin = pure.slice(2).trim();
    return {
      pin,
      channel: symbol === arrow ? false : true
    };
  },
  // make an output record for a single output string
  stringToOutput(str) {
    function singleTarget(str2) {
      return str2[0] == "[" && str2.at(-1) == "]" ? false : true;
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
    } else {
      const regex = /"(?:\\.|[^"\\])*"/g;
      let matches = targetString.match(regex);
      const targetStringArray = matches ? matches.map((str2) => str2.slice(1, -1).replace(/\\"/g, '"')) : [];
      const rawTargets = [];
      for (const target of targetStringArray) {
        const rawTarget = convert.stringToTarget(target);
        if (rawTarget) rawTargets.push(rawTarget);
      }
      return { output, channel, targets: rawTargets };
    }
  },
  // format: pin name @ node name (uid)
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
  // transforms a name to a valid javascript identifier
  pinToHandler(pinName) {
    const words = pinName.split(/[ .-]+/).map((w) => w.replace(/[^a-zA-Z0-9_]/g, ""));
    const cleaned = words.filter(Boolean);
    return "on" + cleaned.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
  }
};

// src/runtime.js
var rtFlags = {
  LOGMSG: 1
};
var LOGMSG = rtFlags.LOGMSG;
function Runtime() {
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
__name(Runtime, "Runtime");
Runtime.prototype = {
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
  // start the runtime
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
  // stop the timer, clear the queues and reset the cells
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
  // returns a promise that is immediately rejected
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
  // send the message to all the targets = schedule the execution of the handler
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
  // requests data from the target(s) - returns a thenable - either a promise or a promisehandler !
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
  // hix: -1 indicates that it is a reply - rxRef allows the receiver to find the promise
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
  // handle the messages on the receive queue
  handleReceiveQueue() {
    for (const msg of this.qIn) {
      const dest = msg.dest;
      switch (msg.hix & HIX_TYPE_MASK) {
        // Normal messages have a positive handler index
        case HIX_HANDLER:
          {
            dest.msg = msg;
            if (dest.flags & LOGMSG) this.logMessage(msg);
            dest.rxSink[msg.hix].handler.call(dest.cell, msg.param);
          }
          break;
        // replies 
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

// src/runtime-settings.js
var defaultWorker = /* @__PURE__ */ __name(() => ({
  on: false,
  path: ""
}), "defaultWorker");
function makeRuntimeSettings() {
  return {
    logMessages: false,
    worker: defaultWorker()
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
    }
  };
  normalized.worker.on = !!normalized.worker.on;
  normalized.worker.path = normalized.worker.path ?? "";
  return normalized;
}
__name(normalizeRuntimeSettings, "normalizeRuntimeSettings");

// src/runtime-node.js
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
function RuntimeNode({ name, uid, factory, inputs, outputs, sx, dx }) {
  this.name = name;
  this.uid = uid;
  this.factory = factory;
  this.useNew = shouldUseNew(factory);
  this.rxSink = [];
  this.txMap = /* @__PURE__ */ new Map();
  this.sx = sx ?? null;
  this.dx = dx ? normalizeRuntimeSettings(dx) : null;
  this.flags = 0;
  this.cell = null;
  this.msg = null;
  this.setFlags();
  this.initRxTx({ inputs, outputs });
}
__name(RuntimeNode, "RuntimeNode");
RuntimeNode.prototype = {
  setFlags() {
    if (!this.dx) return;
    if (this.dx.logMessages) this.flags |= rtFlags.LOGMSG;
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
  // given a function name, check if it corresponds to a pin in the rx sink
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
  // return an object with the functions for the cell - done like this to avoid direct access to source !
  getTx() {
    const source = this;
    return {
      // get the output pin from the message
      get pin() {
        var _a;
        return (_a = source.msg) == null ? void 0 : _a.txPin;
      },
      // returns the local reference of the message
      send(pin, param) {
        if (pin) {
          const tx = source.findTx(pin);
          if (tx) return runtime.sendTo(tx, source, param);
        }
        console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin ?? "missing !!"}"`, source.txMap);
        return 0;
      },
      // sends a request and returns a promise or an array of promises
      request(pin, param, timeout = 0) {
        if (pin) {
          const tx = source.findTx(pin);
          if (tx) return runtime.requestFrom(tx, source, param, timeout);
        }
        console.warn(`** NO OUTPUT PIN ** Node "${source.name}" pin: "${pin}"`, source.txMap);
        return runtime.reject("No such output pin");
      },
      // Returns a message to the sender over the backchannel
      reply(param) {
        return runtime.reply(source, param);
      },
      // sends a reply and returns a promise
      next(param, timeout = 0) {
        return runtime.next(source, param, timeout);
      },
      // if a message cannot be handled yet, it can be rescheduled
      reschedule() {
        if (source.msg) runtime.reschedule(source.msg);
      },
      // you can select a destination here - message will only be sent if there is a connection to that node
      select(nodeName) {
        const _nodeName = nodeName;
        return {
          // returns the local reference of the message
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
          // sends a request and returns a promise or an array of promises
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
};

// src/scaffold.js
var runtime = null;
function scaffold(nodeList, filterList = []) {
  runtime = new Runtime();
  for (const rawNode of nodeList) {
    const actor = new RuntimeNode(rawNode);
    runtime.actors.push(actor);
  }
  runtime.actors.forEach((actor) => actor.resolveUIDs(runtime.actors));
  return runtime;
}
__name(scaffold, "scaffold");

// src/index.js
var VERSION = "0.1.1";
export {
  VERSION,
  scaffold
};
//# sourceMappingURL=index.js.map