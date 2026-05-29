We are going to add safety features to vmblu. The safety of an application is oberved/enforced via the runtime of the application, not by changing the code of the nodes itself. This is how it works:

(1) In the header of a model the user can select the runtime that he wants to use. Currently there is only one runtime (source code in /runtime) but we will add at least one other runtime. Therefore we will have to review the structure of the /runtime folder. I think that we should rename the /runtime/src folder /runtime/rt-base and add a second folder /runtime/rt-als to add the new runtime described below. I have already added the folder /runtime/rt-als and simply copied the source from /runtime/src to that folder.
(2) Each node has a set of runtime settings - named dx - that are saved with the node in the model file. There should still only be one dx object per node, but possibly with subdivisions for settings that are specific to a runtime. In the user interface we should have a specific svelte popup for each runtime that can be selected because different runtimes can have different settings. So in the folder /ui-svelte/node/runtime-settings we will have to add a popup for each runtime supported. For the runtime described below the settings will contain details about what a specific node is allowed to do or not.
(3) The runtime is where the safety is enforced. Below you find the description of a runtime that uses AsyncLocalStorage and API wrapping to check what a node is doing and to report/intervene when a node deviates from what it is allowed to do. This is the first new runtime that we are going to implement.

---

# Prompt for Codex — Add Runtime Safety Instrumentation to vmblu

You are working on the **vmblu runtime**.
Your task is to extend the existing runtime with a **Version B safety/security layer** that adds **runtime attribution, instrumentation, and reporting**, while remaining **non-intrusive** for applications.

You have access to the current runtime implementation and must use it as the starting point.

## Objective

Implement a first safety-enabled runtime for vmblu with these properties:

* **No changes required in application node code**
* **No behavioral impact when safety mode is off**
* **Runtime attribution of dangerous operations to the responsible node**
* **Observation-first design**: detect and report privileged operations
* **Support three modes**:

  * `off`
  * `warn`
  * `enforce`

This is **not** a sandbox and **not** a full security scanner.
It is a **runtime observability and policy-checking layer**.

---

## High-level design

The implementation must use the following techniques:

### 1. AsyncLocalStorage (ALS)

Use Node.js `AsyncLocalStorage` to track the **currently executing vmblu node** across async calls.

Purpose:

* when a node handler runs, the runtime must know which node is responsible
* later, if code inside that handler calls `fetch`, `fs.writeFile`, or `child_process.exec`, the runtime must be able to attribute that action to the correct node

### 2. Wrapping privileged Node.js APIs

Instrument these APIs centrally in the runtime:

* `child_process.exec`

* `child_process.execFile`

* `child_process.spawn`

* `child_process.fork`

* `globalThis.fetch` if available

* `http.request`

* `https.request`

* `fs.writeFile`

* `fs.writeFileSync`

* `fs.appendFile`

* `fs.appendFileSync`

Optional if easy:

* `fs.rm`
* `fs.rmSync`
* `fs.unlink`
* `fs.unlinkSync`

These wrappers must:

* preserve original behavior
* emit a structured safety event
* include the current node from ALS
* avoid double-wrapping
* support uninstall / teardown cleanly

### 3. Reporting path

The runtime must provide a way to forward safety events to the vmblu graph so that a `SecurityMonitor` node in the test harness can consume them.

Use a standard internal event shape and send it through the runtime transport as:

* message name: `security.event`

If direct runtime transport injection is awkward, create a small event sink abstraction that can later forward to the graph.

---

## Implementation requirements

## A. Add safety mode support

Introduce runtime support for:

* `off`
* `warn`
* `enforce`

Expected behavior:

* `off`: no hooks installed, no safety events emitted
* `warn`: hooks installed, events emitted, runtime behavior unchanged
* `enforce`: same instrumentation as `warn`; policy failure is handled by reporting logic, not by blocking the wrapped call

Important:

* **Do not block or alter dangerous calls in this version**
* enforcement means **reporting violations deterministically**, not preventing them

---

## B. Implement ALS node attribution

Add a small module or equivalent runtime utility with at least:

* `runAsNode(nodeName, fn)`
* `getCurrentNode()`

Use `AsyncLocalStorage` from Node.js.

Then modify the runtime dispatch path so that **every node handler invocation** runs inside:

* `runAsNode(nodeName, async () => handler(...))`

Acceptance requirement:

* if a handler performs an async operation and later calls an instrumented API, the emitted event must contain the correct node name

Fallback:

* if no node is active, report node as `"UNKNOWN"`

---

## C. Implement a safety event sink

Add a runtime-level event emitter abstraction, for example:

* `setSafetyEmitter(fn)`
* `emitSafetyEvent(evt)`

Requirements:

* emitter must be optional
* emitting must never crash the application
* if no emitter is configured, safety instrumentation should silently do nothing beyond local execution

Expected event format:

```js
{
  ts: number,
  node: string,
  cap: "proc:exec" | "net:egress" | "fs:write" | "fs:delete",
  detail: object
}
```

Examples:

* process exec: `{ command: "sh -c ..." }`
* fetch: `{ url: "https://example.com", method: "GET" }`
* fs write: `{ path: "./tmp/file.txt" }`

---

## D. Wrap privileged APIs

Implement a module that installs hooks once and returns an uninstall function.

Recommended object method:

* `safety.installHooks({ mode })`

Behavior:

* if `mode === "off"`: no-op
* otherwise install wrappers and emit events

Requirements:

* preserve original function behavior and `this` binding
* avoid duplicate wrapping
* keep implementation small and readable
* use one generic wrapper helper where possible

Need wrappers for:

### Process execution

* `child_process.exec`
* `child_process.execFile`
* `child_process.spawn`
* `child_process.fork`

Emit:

* `cap: "proc:exec"`

### Network egress

* `globalThis.fetch`
* `http.request`
* `https.request`

Emit:

* `cap: "net:egress"`

### Filesystem writes

* `fs.writeFile`
* `fs.writeFileSync`
* `fs.appendFile`
* `fs.appendFileSync`

Emit:

* `cap: "fs:write"`

Optional delete operations:

* `cap: "fs:delete"`

---

## E. Connect safety events to the vmblu runtime transport

The runtime must expose one integration point that lets the generated app or test app connect safety events to vmblu messaging.

Example target behavior:

* runtime installs hooks
* runtime sets emitter
* emitter forwards each safety event as:

  * `tx.send("security.event", evt)`

Do not hardcode assumptions that only test models exist.
Make this reusable so the test harness can enable it easily.

A good shape would be a helper like:

* `safety.enable({ mode }, tx)`

which:

* configures emitter
* installs hooks
* returns `{ uninstall }`

---

## F. Add deterministic policy evaluation support path

Do **not** implement the full `SecurityMonitor` node unless it is already part of the runtime scope.

But the runtime must make that possible by ensuring:

* safety events have stable structure
* event attribution is correct
* event forwarding path exists

If there is already a place in the runtime to attach system-level nodes or internal services, use it cleanly.

---

## Deliverables

Implement the following, adapting filenames to the actual runtime structure:

1. **ALS context module**

   * runtime-local
   * no application API exposure required

2. **Safety event sink**

   * configurable emitter
   * no-crash behavior

3. **Safety hook installer**

   * wraps privileged APIs
   * uninstall support
   * no double wrap

4. **Runtime dispatch integration**

   * all handler invocations wrapped with ALS context

5. **Runtime integration helper**

   * easy way to enable safety mode and forward `security.event`

6. **Tests**

   * unit or integration tests covering:

     * ALS attribution across `await`
     * process exec event emission
     * fetch/http event emission
     * fs write event emission
     * no events in `off` mode
     * no duplicate events when hooks installed twice

---

## Constraints

* Do **not** require changes to existing node source code
* Do **not** expose ALS directly to applications
* Do **not** break current runtime behavior
* Do **not** introduce a hard dependency on OpenTelemetry or third-party tracing libraries
* Do **not** over-engineer configuration
* Do **not** add a prevention/sandbox layer in this iteration

Keep this implementation:

* small
* explicit
* testable
* easy to disable

---

## Recommended step-by-step plan

Follow these steps in order:

### Step 1 — Inspect current runtime dispatch

Find where node handlers are invoked.
Identify the narrowest place where all handler execution passes through one call boundary.

### Step 2 — Add ALS context

Implement `runAsNode` / `getCurrentNode`.
Wrap handler execution in the runtime dispatch path.
Verify attribution survives async boundaries.

### Step 3 — Add safety event sink

Implement emitter registration and safe emission.

### Step 4 — Add hook installer

Implement wrappers for:

* `child_process.*`
* `fetch/http/https`
* `fs.write*` / `append*`

Make hooks idempotent and uninstallable.

### Step 5 — Add runtime integration helper

Implement a helper that:

* accepts `mode`
* installs hooks
* forwards events via runtime transport as `security.event`

### Step 6 — Add tests

Create focused tests for:

* correct node attribution
* event emission structure
* off/warn behavior
* double-install safety

### Step 7 — Document

Add a short internal runtime note explaining:

* ALS attribution
* wrapped APIs
* event format
* how the generated test app can enable safety mode

---

## Acceptance criteria

The work is complete only when all of the following are true:

1. A node handler that performs `await` and then `fs.writeFile(...)` emits a `security.event` with the correct node name
2. A node handler that performs `fetch(...)` emits a `net:egress` event
3. A node handler that performs `child_process.exec(...)` emits a `proc:exec` event
4. `off` mode emits nothing
5. Installing hooks twice does not double-report
6. Existing runtime behavior remains unchanged when safety is disabled
7. The implementation is isolated in runtime code and does not require application/node API changes

---

## Coding style expectations

* Prefer plain, readable Node.js code
* Use small helper functions instead of clever abstractions
* Comment the non-obvious parts only
* Keep the implementation easy to audit
* If runtime structure is unclear, choose the simplest design that satisfies the acceptance criteria

---

## Final output expected from you

Please do the following:

1. Inspect the current runtime and identify the best integration points
2. Implement the safety runtime as described
3. Add tests
4. Summarize:

   * files added/changed
   * key design decisions
   * any limitations or edge cases still present

Do not stop at analysis.
Implement the changes in a copy of the current runtime codebase that sits in the folder /rt-als
