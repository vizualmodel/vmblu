var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target2, value) => __defProp(target2, "name", { value, configurable: true });
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
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

// src/index.js
var index_exports = {};
__export(index_exports, {
  VERSION: () => VERSION,
  scaffold: () => scaffold
});
module.exports = __toCommonJS(index_exports);

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
var HIX_ROUTER = 536870912;
var HIX_TYPE_MASK = 4026531840;
var HIX_MASK = 268435455;
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
      for (const target2 of targetStringArray) {
        const rawTarget = convert.stringToTarget(target2);
        if (rawTarget) rawTargets.push(rawTarget);
      }
      return { output, channel, targets: rawTargets };
    }
  },
  // This function is used for the routertable
  stringToScope(str) {
    let colon = str.indexOf(":");
    if (colon < 0) return null;
    const selector = str.slice(0, colon).trim();
    const scope = str.slice(colon + 1).trim();
    if (selector.length == 0 || scope.length == 0) return null;
    const regex = /"(?:\\.|[^"\\])*"/g;
    let matches = scope.match(regex);
    const targetStringArray = matches ? matches.map((str2) => str2.slice(1, -1).replace(/\\"/g, '"')) : [];
    const rawTargets = [];
    for (const target2 of targetStringArray) {
      const rawTarget = convert.stringToTarget(target2);
      if (rawTarget) rawTargets.push(rawTarget);
    }
    return { selector, scope: rawTargets };
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
  this.timer = 0;
  this.minDelay = 0;
  this.maxDelay = 100;
  this.scheduleDelay = this.minDelay;
  this.idleCount = 0;
  this.idleTreshold = 100;
  this.slow = false;
  this.msgCount = 0;
  this.startTime = null;
  this.qOut = [];
  this.qIn = [];
  this.qResolve = new ResolveQueue();
}
__name(Runtime, "Runtime");
Runtime.prototype = {
  // start the runtime
  start() {
    clearTimeout(this.timer);
    this.qOut = [];
    this.qIn = [];
    this.msgCount = 0;
    for (const actor of this.actors) actor.makeCell();
    this.startTime = Date.now();
    this.timer = setTimeout(this.receive.bind(this), this.scheduleDelay);
  },
  // stop the timer, clear the queues and reset the cells
  stop() {
    clearTimeout(this.timer);
    this.msgCount = 0;
    this.actors.forEach((actor) => actor.cell = null);
    this.qOut = [];
    this.qIn = [];
  },
  halt() {
    clearTimeout(this.timer);
  },
  continue() {
    this.timer = setTimeout(this.receive.bind(this), this.scheduleDelay);
  },
  switch() {
    const temp = this.qIn;
    this.qIn = this.qOut;
    this.qOut = temp;
    this.qOut.length = 0;
    if (this.slow) this.goFast();
  },
  idle() {
    this.idleCount++;
    const now = Date.now();
    this.qResolve.checkTimeouts(now);
    if (this.idleCount % 600 == 0) {
      const min = (now - this.startTime) / 6e4;
      console.log(`<idle> ${this.idleCount} cycles - nr of messages: ${this.msgCount} - running time:${min.toFixed(0)} min`);
    }
    if (!this.slow && this.idleCount > this.idleTreshold) this.goSlow();
  },
  goFast() {
    this.scheduleDelay = this.minDelay;
    this.idleCount = 0;
    this.slow = false;
  },
  goSlow() {
    this.scheduleDelay = this.maxDelay;
    this.slow = true;
  },
  // returns a promise that is immediately rejected
  reject(reason) {
    return new Promise((resolve, reject) => {
      reject(new Error(reason));
    });
  },
  // send the message to all the targets = schedule the execution of the handler
  sendTo(targets, source, pin, param) {
    if (targets.length < 1) return 0;
    if (source.flags & LOGMSG) console.log(`${source.name} -> ${pin}`);
    ++this.msgCount;
    for (const target2 of targets)
      this.qOut.push({
        from: source.uid,
        txRef: 0,
        dest: target2.actor,
        rxRef: 0,
        hix: target2.hix,
        pin,
        param
      });
    return targets.length;
  },
  // requests data from the target(s) - returns a thenable - either a promise or a promisehandler !
  requestFrom(targets, source, pin, param, timeout) {
    if (source.flags & LOGMSG) console.log(`${source.name} => ${pin}`);
    const txRef = ++this.msgCount;
    let channelCount = 0;
    for (const target2 of targets) {
      this.qOut.push({
        from: source.uid,
        txRef,
        dest: target2.actor,
        rxRef: 0,
        hix: target2.hix,
        pin,
        param
      });
      if (target2.channel) channelCount++;
    }
    if (channelCount == 0) return this.reject("No channel");
    return this.qResolve.addPromiseHandler(txRef, timeout, channelCount);
  },
  // hix: -1 indicates that it is a reply - rxRef allows the receiver to find the promise
  reply(source, param) {
    var _a;
    if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return 0;
    if (source.flags & LOGMSG) console.log(`reply to ${source.msg.pin} @ ${source.name}`);
    ++this.msgCount;
    this.qOut.push({
      from: source.uid,
      txRef: 0,
      dest: source.msg.from,
      rxRef: source.msg.txRef,
      hix: HIX_REPLY,
      pin: source.msg.pin,
      param
    });
    return 1;
  },
  next(source, param, timeout) {
    var _a;
    if (!((_a = source.msg) == null ? void 0 : _a.txRef)) return this.reject("No target");
    const txRef = ++this.msgCount;
    this.qOut.push({
      from: source.uid,
      txRef,
      dest: target.actor,
      rxRef: source.msg.txRef,
      hix: HIX_REPLY,
      pin: source.msg.pin,
      param
    });
    return this.qResolve.addPromiseHandler(txRef, timeout);
  },
  receive() {
    if (!this.qOut.length) {
      this.idle();
    } else {
      this.switch();
      this.handleReceiveQueue();
    }
    this.timer = setTimeout(this.receive.bind(this), this.scheduleDelay);
  },
  // handle the messages on the receive queue
  handleReceiveQueue() {
    var _a, _b;
    for (const msg of this.qIn) {
      const dest = msg.dest;
      switch (msg.hix & HIX_TYPE_MASK) {
        // Normal messages have a positive handler index
        case HIX_HANDLER:
          {
            dest.msg = msg;
            if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (run ${dest.rxTable[msg.hix].handler.name})`);
            dest.rxTable[msg.hix].handler.call(dest.cell, msg.param);
          }
          break;
        // replies 
        case HIX_REPLY:
          {
            if (dest.flags & LOGMSG) console.log(`${dest.name} <= ${msg.pin} (reply)`);
            this.qResolve.trigger(msg.rxRef, msg.param);
          }
          break;
        // messages that have to pass through a router filter first also have a special hix
        case HIX_ROUTER:
          {
            if (dest.flags & LOGMSG) console.log(`${dest.name} <- ${msg.pin} (filter via router)`);
            const scope = msg.dest.scopeTable[msg.hix & HIX_MASK];
            const nameList = ((_b = (_a = dest.cell).filter) == null ? void 0 : _b.call(_a, scope.targets.keys(), msg.pin, msg.param)) ?? [...scope.targets.keys()];
            if (Array.isArray(nameList) && nameList.length > 0) {
              this.forwardToAll(msg, nameList, scope.targets);
            } else {
              const actual = scope.targets.get(nameList);
              if (actual) this.forward(msg, actual);
            }
          }
          break;
      }
    }
  },
  // forward a message to the actual targets of the message
  forwardToAll(msg, nameList, targets) {
    let channelCount = 0;
    for (const name of nameList) {
      const actual = targets.get(name);
      if (actual) {
        this.forward(msg, actual);
        if (msg.txRef > 0 && actual.channel) channelCount++;
      }
    }
    if (channelCount > 1) this.qResolve.changePromiseHandler(msg.txRef, channelCount);
  },
  forward(msg, actual) {
    if ((actual.hix & HIX_TYPE_MASK) == HIX_HANDLER) {
      actual.actor.msg = msg;
      actual.actor.rxTable[actual.hix].handler.call(actual.actor.cell, msg.param);
    } else if ((actual.hix & HIX_TYPE_MASK) == HIX_ROUTER) {
      this.qOut.push({
        from: msg.from,
        txRef: msg.txRef,
        dest: actual.actor,
        rxRef: 0,
        hix: actual.hix,
        pin: actual.pin,
        param: msg.param
      });
    }
  },
  reschedule(msg) {
    this.qOut.push(msg);
  }
};

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
  this.rxTable = [];
  this.txTable = [];
  this.sx = sx ?? null;
  this.dx = dx ?? null;
  this.flags = 0;
  this.cell = null;
  this.msg = null;
  this.setFlags();
  this.initRxTxTables({ inputs, outputs });
}
__name(RuntimeNode, "RuntimeNode");
RuntimeNode.prototype = {
  setFlags() {
    var _a;
    if (!((_a = this.dx) == null ? void 0 : _a.flags)) return;
    if (this.dx.flags.includes("LOGMSG")) this.flags |= rtFlags.LOGMSG;
  },
  initRxTxTables({ inputs, outputs }) {
    for (const inputString of inputs) {
      const input = convert.stringToInput(inputString);
      if (input) this.rxTable.push(new RX(input.pin, input.channel));
    }
    for (const outputString of outputs) {
      const raw = convert.stringToOutput(outputString);
      if (!raw) continue;
      const tx = new TX(raw.output, raw.channel);
      this.txTable.push(tx);
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
    var _a;
    if (!this.cell) {
      if (((_a = this.rxTable) == null ? void 0 : _a.length) > 0) console.warn(`** NO HANDLERS ** Node ${this.name} has input pins but no implementation.`);
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
    this.rxTable.forEach((rx) => {
      if (!rx.handler) {
        console.warn(`** NO HANDLER ** Node "${this.name}" has input pin "${rx.pin}" but no handler for it.`);
        rx.handler = missingHandler;
      }
    });
  },
  // given a function name, check if it corresponds to a pin in the rx table
  getRx(functionName) {
    if (functionName.startsWith("-> ") || functionName.startsWith("=> ")) {
      const handlerName = functionName.slice(3);
      return this.rxTable.find((rx) => rx.pin == handlerName);
    }
    return this.rxTable.find((rx) => convert.pinToHandler(rx.pin) == functionName);
  },
  resolveUIDs(actors) {
    this.txTable.forEach((tx) => {
      tx.targets.forEach((target2) => {
        target2.actor = actors.find((actor) => actor.uid == target2.uid);
        if (!target2.actor) return console.error(`** ERROR ** target node ${target2.uid} in ${this.name} not found`);
        target2.hix = target2.actor.factory ? HIX_HANDLER | target2.actor.rxTable.findIndex((rx) => rx.pin == target2.pin) : HIX_ROUTER | target2.actor.scopeTable.findIndex((scope) => scope.selector == target2.pin);
      });
    });
  },
  // when sending a message find the targets for the message
  findTargets(pin) {
    if (!pin) return [];
    const tx = this.txTable.find((tx2) => tx2.pin == pin);
    if (tx) return tx.targets;
    console.warn(`** NO OUTPUT PIN ** Node "${this.name}" pin: "${pin}"`, this.txTable);
    return [];
  },
  // return an object with the functions for the cell - done like this to avoid direct access to source !
  getTx() {
    const source = this;
    return {
      // get the output pin from the message
      get pin() {
        var _a;
        return (_a = source.msg) == null ? void 0 : _a.pin;
      },
      // returns the local reference of the message
      send(pin, param) {
        if (!pin) return 0;
        const targets = source.findTargets(pin);
        return runtime.sendTo(targets, source, pin, param);
      },
      // sends a request and returns a promise or an array of promises
      request(pin, param, timeout = 0) {
        if (!pin) return null;
        const tx = source.txTable.find((tx2) => tx2.pin == pin);
        if (tx == null ? void 0 : tx.targets.length) return runtime.requestFrom(tx.targets, source, pin, param, timeout);
        console.warn(`** NO OUTPUT PIN ** Node "${this.name}" pin: "${pin}"`, this.txTable);
        return runtime.reject("Not connected");
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
      wireless(nodeName) {
        const node = runtime.actors.find((actor) => actor.name.toLowerCase() == nodeName.toLowerCase());
        if (!node) {
          console.warn(`** WIRELESS SEND TO UNKNOWN NODE ** ${nodeName}`);
          return {
            send(pin, param) {
              return 0;
            },
            request(pin, param, timeout = 1e3) {
              return new Promise((resolve, reject) => {
                reject(new Error("no node"));
              });
            }
          };
        }
        function makeTarget(pin) {
          const L = node.rxTable.length;
          for (let i = 0; i < L; i++) {
            if (node.rxTable[i].pin == pin) {
              return {
                uid: node.uid,
                actor: node,
                pin,
                channel: node.rxTable[i].channel,
                hix: HIX_HANDLER || i
              };
            }
          }
          return null;
        }
        __name(makeTarget, "makeTarget");
        return {
          // sends a message over a pin
          send(pin, param) {
            const target2 = makeTarget(pin);
            if (!target2) {
              console.warn(`** WIRELESS SEND TO UNKNOWN PIN ** ${nodeName} pin: ${pin}`);
              return 0;
            }
            return runtime.sendTo([target2], source, pin, param);
          },
          // sends a request and returns a promise or an array of promises
          request(pin, param, timeout = 0) {
            const target2 = makeTarget(pin);
            if (!target2) {
              console.warn(`** WIRELESS REQUEST TO UNKNOWN PIN ** ${nodeName} pin: ${pin}`);
              return new Promise((resolve, reject) => {
                reject(new Error("no pin"));
              });
            }
            return runtime.requestFrom([target2], source, pin, param, timeout);
          }
        };
      }
    };
  }
};

// src/runtime-filter.js
function Scope(selector) {
  this.selector = selector;
  this.targets = /* @__PURE__ */ new Map();
}
__name(Scope, "Scope");
function RuntimeFilter({ name, uid, filter, table }) {
  var _a;
  this.name = name;
  this.uid = uid;
  this.filter = filter;
  this.useNew = ((_a = filter.prototype) == null ? void 0 : _a.constructor) === filter ? false : true;
  this.scopeTable = [];
  this.cell = null;
  this.msg = null;
  this.buildScopeTable(table);
}
__name(RuntimeFilter, "RuntimeFilter");
RuntimeFilter.prototype = {
  buildScopeTable(rawTable) {
    for (const routeString of rawTable) {
      const rawRoute = convert.stringToScope(routeString);
      const scope = new Scope(rawRoute.selector);
      for (const rawTarget of rawRoute.scope) {
        const target2 = new Target(rawTarget.uid, rawTarget.pinName);
        scope.targets.set(rawTarget.nodeName, target2);
      }
      this.scopeTable.push(scope);
    }
  },
  resolveUIDs(actors) {
    for (const scope of this.scopeTable) {
      for (const target2 of scope.targets.values()) {
        target2.actor = actors.find((actor) => actor.uid == target2.uid);
        if (!target2.actor) return console.error(`** ERROR ** target node ${target2.uid} in ${this.name} not found`);
        if (target2.actor.factory) {
          target2.actor.rxTable.find((rx, index) => {
            if (rx.pin != target2.pin) return false;
            target2.hix = HIX_HANDLER | index;
            target2.channel = rx.channel;
            return true;
          });
        } else if (target2.actor.filter) {
          target2.actor.scopeTable.find((scope2, index) => {
            if (scope2.selector != target2.pin) return false;
            target2.hix = HIX_ROUTER | index;
            return true;
          });
        }
      }
    }
  },
  // create a cell for the node - pass a client runtime to that cell
  makeCell() {
    this.cell = this.useNew ? new this.filter() : this.filter();
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
  for (const rawFilter of filterList) {
    const actor = new RuntimeFilter(rawFilter);
    runtime.actors.push(actor);
  }
  runtime.actors.forEach((actor) => actor.resolveUIDs(runtime.actors));
  return runtime;
}
__name(scaffold, "scaffold");

// src/index.js
var VERSION = "0.1.1";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VERSION,
  scaffold
});
//# sourceMappingURL=index.cjs.map