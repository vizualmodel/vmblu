# vmblu Next Steps: Security, Testing, and Agent Settings

Date: 2026-05-28

## Purpose

This document turns the current security, testing, and agent-integration work into
a coherent implementation plan. It is based on the current repo state:

- node runtime settings already exist as `dx` and are selected through
  `runtime/runtime-settings-registry.js`;
- model-level runtime settings already exist in `header.runtimeSettings`;
- generated applications import the selected runtime directly and instantiate it
  with `new Runtime(nodeList, runtimeOptions)`;
- the useful built-in runtime set is now explicit:
  `rt-base`, `rt-browser-agent`, `rt-als`, and `rt-agent`;
- `rt-browser-agent` has tools, probes, events, a capability manifest, a
  `ToolBroker`, an `AgentRuntime`, and a browser overlay without ALS safety;
- `rt-agent` combines the same agent layer with `rt-als` safety for Node.js;
- probes are defined on source nodes and read through the broker;
- Phase 1 runtime settings foundation is complete in report-first form;
- minimal schema validation, effect verification, and per-agent capability
  scoping are implemented in the broker;
- approval requests are implemented at broker/runtime API level, but there is no
  user-facing approval prompt UI yet.

The main design goal is to avoid three disconnected feature tracks. Security
settings, test generation, and agent permissions should all use the same
capability and policy vocabulary where possible.

## Implementation Log

### 2026-05-27

Started Phase 1 runtime settings groundwork.

Completed:

- Changed runtime node settings normalization from the old flat shape
  (`logMessages`, `worker`, `safety`) to the new sectioned `dx` shape:
  `run`, `monitor`, and `security`.
- Kept backward compatibility for existing saved node settings:
  - legacy `dx.logMessages` maps to `dx.monitor.logMessages`;
  - legacy `dx.worker` maps to `dx.run.worker`;
  - legacy `dx.safety` maps to `dx.security`.
- Updated `runtime/shared/runtime-node.js` so message logging reads the new
  `dx.monitor.logMessages` field while still tolerating legacy `dx.logMessages`.
- Added runtime descriptor metadata to `runtime/runtime-settings-registry.js`
  for built-in `rt-base`, `rt-als`, and `rt-agent`, preparing for future
  `rt-*` runtime extension.
- Updated runtime settings UI panels:
  - base runtime panel now shows `Run`, `Monitor`, and `Security`;
  - ALS runtime panel now uses the new `dx.security` section;
  - agent runtime has its own dedicated settings component.
- Added focused tests in `runtime/test/runtime-settings.test.js`.
- Ran `npm.cmd test` in `runtime`: all 17 tests passed.
- Ran `npm.cmd run build` in `runtime`: build passed.
- Ran `npm.cmd run build` in `ui-svelte`: build passed.
- Ran `npm.cmd run webview` in `vscodex`: build passed after making the
  `rt-agent` runtime settings panel a full component rather than a tiny wrapper.
- Updated user-guide documentation in `vmblu.dev/docs/guide/user-guide`:
  - `runtime.md`;
  - `security-enforcement.md`;
  - `testing-with-vmblu.md`;
  - `agent-integration.md`;
  - `editor-core-concepts.md`.

Not yet done at this point in the log; completed by later Phase 1 slices:

- Model-level `header.runtimeSettings` and `<model-name>.rt.json` loading were
  not implemented yet.
- Effective policy clipping against the model-level envelope was specified but
  not implemented yet.
- Runtime settings schema updates were not implemented yet.
- Runtime settings UI was still node-level only. Model-level runtime settings UI
  was not implemented yet.

Continued Phase 1 model-level runtime settings groundwork.

Completed:

- Added `header.runtimeSettings` to model header parsing and save splitting.
- Extended generated app options from `agentRuntimeOptions` to general
  `runtimeOptions`.
- Generated apps passed `runtimeSettings` to `VMBLU.scaffold(...)` at this
  stage. This was later replaced by direct runtime construction with
  `new Runtime(nodeList, runtimeOptions)`.
- Runtime settings can be:
  - inline in `header.runtimeSettings`;
  - referenced as a string path;
  - referenced as `{ "path": "./model.rt.json" }`.
- `rt-base`, `rt-als`, and `rt-agent` scaffold functions preserved
  `options.runtimeSettings` on the runtime instance at this stage. The scaffold
  functions were later removed.
- Added model-level runtime settings normalization helpers:
  - `makeModelRuntimeSettings`;
  - `normalizeModelRuntimeSettings`;
  - `effectiveRuntimePolicy`.
- Implemented `rt-als`/`rt-agent` effective policy clipping:
  node-level security requests can narrow the model envelope but cannot broaden
  it.
- Added schema support for `header.runtimeSettings` in
  `cli/context/0.9.5`, `0.9.6`, and `0.9.7`.
- Added tests for effective policy clipping.
- Ran `node --check` on changed model/runtime modules: passed.
- Ran `npm.cmd test` in `runtime`: all 19 tests passed.
- Ran `npm.cmd run build` in `runtime`: build passed.
- Ran `npm.cmd run build` in `cli`: build passed.
- Ran `npm.cmd run webview` in `vscodex`: build passed.

Still not done at this point in the log; completed by the final Phase 1 closure
slice except for report-first enforcement:

- Model-level runtime settings editor UI was not implemented yet.
- Safety events now classify observed capabilities against the effective
  runtime policy, but `enforce` still reports rather than blocks.

Continued Phase 1 safety event policy wiring.

Completed:

- Added effective runtime policy classification to `rt-als` safety events.
- Added compatible policy classification to `rt-agent` safety events.
- Moved the shared classifier logic to `runtime/shared/safety-policy.js` at this
  stage. It was later folded into the `safety` object in
  `runtime/rt-als/safety.js`.
- Safety events now include `policy` metadata with:
  - `decision`: `allowed`, `warning`, `denied`, or `error`;
  - `domain`: `fs`, `net`, `process`, or `unknown`;
  - `permission`: the effective policy value for the capability domain;
  - `mode` and `forward` from the effective runtime policy.
- The classifier uses the active node name to find the node `dx`, then clips
  that node request against `runtime.runtimeSettings`.
- Added focused tests proving:
  - model-level security settings are reflected in `security.event.policy`;
  - a node cannot broaden the model-level security envelope.
- Ran `node --check` on changed safety/scaffold modules: passed.
- Ran `npm.cmd test` in `runtime`: all 21 tests passed.
- Ran `npm.cmd run build` in `runtime`: build passed.

Still not done:

- `enforce` does not yet block operations; it reports deterministic policy
  decisions on safety events.

Completed final Phase 1 closure slice.

Completed:

- Added model-level runtime settings editing to the model settings popup.
  The popup now has a `settings` button next to the runtime field. The button
  opens `ui-svelte/nodes/model-runtime-settings/model-runtime-settings.svelte`,
  a separate JSON editor for `header.runtimeSettings`, including the sidecar
  reference shape `{ "path": "./model.rt.json" }`.
  When no settings exist yet, the editor starts from the selected runtime's
  default model runtime settings structure.
- Updated the model settings handler so saving the popup updates both
  `header.runtime` and `header.runtimeSettings`.
- Passed model-level runtime settings into the node runtime settings popup.
- Added node-level envelope feedback in the runtime settings popup: when a node
  security request asks for more permission than the model envelope allows, the
  UI shows the clipped domain values before saving.
- Extended safety event classification to evaluate allow-list details:
  - fs events outside `security.allow.fsRoots` are classified as denied with
    reason `fs_root_not_allowed`;
  - net events outside `security.allow.netHosts` are classified as denied with
    reason `net_host_not_allowed`.
- Added a focused runtime test for fs allow-list denial.
- Ran `node --check` on changed core/runtime modules: passed.
- Ran `npm.cmd test` in `runtime`: all 22 tests passed.
- Ran `npm.cmd run build` in `runtime`: build passed.
- Ran `npm.cmd run build` in `ui-svelte`: build passed.
- Ran `npm.cmd run webview` in `vscodex`: build passed.

Phase 1 status:

- Complete for the agreed report-first security milestone.
- `enforce` remains intentionally report-first and does not hard-block
  operations yet. Blocking should be treated as a later runtime variant or a
  dedicated enforcement milestone, not as a Phase 1 requirement.

### 2026-05-28

Completed runtime architecture cleanup after Phase 1.

Completed:

- Replaced runtime settings wrapper functions with runtime settings objects.
  Runtime code now calls methods on the selected runtime settings object.
- Removed runtime-specific `runtime-node.js`, `target.js`, and `scaffold.js`
  wrappers where they only re-exported shared behavior.
- Generated apps now import the selected runtime directly and call
  `new Runtime(nodeList, runtimeOptions)`. The runtime constructor performs
  scaffold/setup internally.
- `runtime/shared/runtime.js` now exposes a concrete `Runtime` class. Runtime
  variants subclass it instead of being assembled by `createRuntime(...)`.
- `rt-als` subclasses the shared runtime and owns ALS dispatch plus safety.
- Consolidated ALS safety into the `safety` object in
  `runtime/rt-als/safety.js`. Hook installation, event reporting, and policy
  classification are safety methods; pure helpers remain unexported local
  functions.
- `rt-agent` now subclasses `rt-als Runtime`, so it reuses ALS dispatch and
  safety instead of duplicating that code.
- Added `runtime/rt-agent/agent-runtime-support.js` to hold browser-safe agent
  broker setup, event wiring, probe registration, and agent creation.
- Added `rt-browser-agent`, which subclasses `rt-base Runtime` and reuses the
  same agent support without importing ALS or Node.js safety hooks.
- Updated runtime package exports and build scripts for `rt-browser-agent`.
- Updated `runtime/README.md` and `runtime/doc/agent-user-guide.md` with the
  runtime matrix:

```text
rt-base           browser + node, no safety, no agent
rt-browser-agent  browser + node, no safety, agent
rt-als            node only, ALS safety, no agent
rt-agent          node only, ALS safety, agent
```

Verification:

- Ran `npm.cmd test` in `runtime`: all 24 tests passed.
- Ran `npm.cmd run build` in `runtime`: build passed.
- Checked the `rt-browser-agent` bundle for Node-only safety imports: none
  found.

Completed minimal agent broker and settings slice.

Completed:

- Added `runtime/rt-agent/agent-policy.js` with a deliberately simple
  `AgentPolicy` object. It normalizes one or more agents and supports
  allow/deny policy for tools, probes, and events.
- Added broker enforcement in `runtime/rt-agent/tool-broker.js`:
  - filtered capability views per agent;
  - tool allow/deny checks;
  - probe allow/deny checks;
  - event allow/deny checks;
  - JSON Schema validation for tool and probe args;
  - trace records for policy and validation decisions.
- Added minimal effect verification:
  - `wait: "verified"` can read declared probes and wait for declared events;
  - results distinguish accepted, verified, unverified, pending, or denied
    broker outcomes.
- Added minimal approval plumbing:
  - tools with `approval: "always"` create approval requests;
  - runtime exposes `agent.approvals.approve(id)` and
    `agent.approvals.deny(id)`;
  - no visual approval prompt exists yet.
- Added `runtime/rt-agent/json-schema.js` with a small local validator suitable
  for the current capability schemas. This keeps the first end-to-end slice
  dependency-free and easy to replace later if needed.
- Extended broker protocol constants for pending/unverified/approval resolve
  outcomes.
- Extended runtime tests in `runtime/test/agent-broker.test.js` for filtering,
  policy denial, validation failure, approval flow, verification, and default
  agent selection.
- Kept `rt-browser-agent` as the browser-safe agent runtime and `rt-agent` as
  the Node.js ALS + agent runtime.

Verification:

- Ran `npm.cmd test` in `runtime`: passed.
- Ran `npm.cmd run build` in `runtime`: passed.

Completed editor UI slice for agent and model runtime settings.

Completed:

- Added `ui-svelte/nodes/agent-settings/agent-settings.svelte`.
  It supports multiple agents with a selected-agent panel and simple allow
  toggles for tools, probes, and events.
- Added `AgentSettingsFactory` to `ui-svelte/index.js`.
- Added the original `agent settings` source node to
  `ui-svelte/model/ui-svelte.mod.blu` under the modal popup group.
- Added the imported `agent settings` dock node to the playground model.
- Added `model runtime settings` as a real source node in
  `ui-svelte/model/ui-svelte.mod.blu` and a docked imported popup in
  `playground/model/playground.mod.blu`.
- `document settings` now emits:
  - `model runtime settings -> model runtime settings.show`;
  - `agent settings -> agent settings.show`.
- `document settings` now saves a combined object:
  - `runtime`;
  - `runtimeSettings`;
  - `agent`.
- The document settings popup now shows:
  - one `Runtime` line for the runtime id;
  - a separate `Settings` line with `Runtime` and `Agents` buttons.
- `model-runtime-settings.svelte` now has a simple form view plus a JSON
  fallback tab. The form covers monitor flags, security mode, forwarded
  security events, default fs/net/process permissions, and allow lists.
- Corrected old generated app startup in `playground/model/playground.app.js`
  from `VMBLU.scaffold(...)` to:

```js
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-agent"

const runtimeOptions = {
    capabilities
}

const runtime = new Runtime(nodeList, runtimeOptions)
```

Verification:

- Ran `node --check` on generated app files touched during the slice: passed.
- Parsed updated `.mod.blu` and `.mod.viz` files as JSON: passed.
- Ran `npm.cmd run build` in `ui-svelte`: passed.
- Ran `npm.cmd run build` in `playground`: passed.

Notes from testing:

- The old VS Code extension can still generate app startup using
  `VMBLU.scaffold(...)`. Until the extension/generator is updated, generated
  playground apps may need manual correction to the `new Runtime(...)` startup
  shape.
- The popup nodes must exist in the source `ui-svelte.mod.blu`, not only in
  generated app JS. Playground dock nodes must link to those original source
  nodes.
- For the settings popup wiring, connect:

```text
doc settings.model runtime settings -> model runtime settings.show
model runtime settings.modal div -> modal div
doc settings.agent settings -> agent settings.show
agent settings.modal div -> modal div
```

## Product Decisions Needed

These decisions are now accepted and should guide the implementation.

1. Model-level runtime settings should support both a simple header form and a
   sidecar form. Simple runtime configurations stay in the model header near
   `header.runtime`. More complex configurations can move to a sidecar named
   `<model-name>.rt.json`, following the same pattern as agent configuration.
2. Each runtime should have its own dedicated settings panel or an intentional
   shared panel. `rt-base` and `rt-browser-agent` can share base settings for
   now; `rt-als` and `rt-agent` share ALS safety settings for now because
   `rt-agent` is explicitly the Node.js safety + agent runtime.
3. Runtime security enforcement should remain report-first for now. The
   important milestone is reliably registering that a security breach occurred
   through `security.event`; concrete reactions to that breach can be attached
   later.
4. Tests should support both generated and authored cases, with a strong bias
   toward automatic generation. The framework should generate a large baseline
   from tools, effects, probes, events, examples, schemas, and security policy,
   while still allowing explicit authored scenarios for important workflows.
5. Agent configuration should continue to support simple `header.agent`
   configuration and the existing `<model-name>.agent.json` sidecar. The header
   form is appropriate for simple applications; the sidecar is the preferred
   shape when settings, permissions, providers, or future multi-agent setup
   become too large for the header.
6. Runtime selection should stay explicit:
   - use `rt-base` for browser or Node.js apps without agent or safety needs;
   - use `rt-browser-agent` for browser apps with agent support;
   - use `rt-als` for Node.js apps with safety but no agent;
   - use `rt-agent` for Node.js apps with both safety and agent support.

## Architecture Principles

The implementation should use one shared mental model:

```text
runtime security policy
  controls what nodes and runtimes may do

capability policy
  controls what agents may call, read, or observe

test policy
  decides which generated cases are meaningful enough to execute
```

The shared data objects should be:

- `RuntimePolicy`: model-level maximum envelope for the selected runtime.
- `NodeRuntimePolicy`: node-level runtime, monitoring, and security requests
  stored in `node.dx`; security requests can narrow or specialize the envelope
  but can never exceed it.
- `CapabilityManifest`: generated tools, probes, events, effects, and default
  policies.
- `AgentPolicy`: per-agent view of allowed tools, probes, events, approvals,
  limits, and UI/provider settings.
- `TestSpec`: generated or authored scenarios that call tools, read probes, wait
  for events, and assert results.

## 1. Configurable Runtime Security

### Current State

Phase 1 is complete for the report-first security milestone.

The repo now has:

- `runtime/runtime-settings-registry.js` selecting settings implementation by
  runtime, including `rt-browser-agent`;
- runtime settings objects with standard methods such as `make`, `normalize`,
  `makeModel`, `normalizeModel`, and `effectivePolicy`;
- model-level runtime settings in `header.runtimeSettings`, including sidecar
  reference support;
- generated apps passing `runtimeSettings` through `runtimeOptions`;
- `runtime/rt-base/runtime-settings.js` for base/browser-safe settings;
- `runtime/rt-als/runtime-settings.js` for ALS safety settings;
- `runtime/rt-browser-agent/runtime-settings.js` re-exporting base settings;
- `runtime/rt-agent/runtime-settings.js` re-exporting ALS settings;
- `runtime/rt-als/safety.js` owning safety hooks, event reporting, and policy
  classification through the `safety` object;
- node-level `dx` with `run`, `monitor`, and `security` sections;
- model-level runtime settings UI and node-level envelope feedback.

The remaining security work is not Phase 1 setup. It is broker policy,
validation, approval, verification, or later hard-blocking enforcement.

### Specification

Model-level runtime settings are stored in the model header for simple cases,
with an optional `<model-name>.rt.json` sidecar for complex cases:

```json
{
  "header": {
    "runtime": "@vizualmodel/vmblu-runtime/rt-agent",
    "runtimeSettings": {
      "@vizualmodel/vmblu-runtime/rt-agent": {
        "security": {
          "mode": "warn",
          "forwardEvents": true,
          "defaults": {
            "fs": "warn",
            "net": "warn",
            "process": "deny"
          },
          "allow": {
            "netHosts": ["127.0.0.1", "localhost"],
            "fsRoots": ["./data", "./tmp"]
          }
        },
        "broker": {
          "schemaValidation": "warn",
          "effectVerification": "warn",
          "approvalMode": "manual"
        }
      }
    }
  }
}
```

Keep node-level runtime settings in `node.dx`, but organize them into three
sections:

- `run`: where and how the node runs, such as worker/main-thread/runtime
  placement and other execution configuration;
- `monitor`: observability flags, such as logging sent/received messages,
  timings, queue behavior, or runtime traces;
- `security`: node-specific security requests.

Node security settings are off by default. In the UI, a node should need to
explicitly enable security-specific settings, for example with a checkbox such
as "custom security settings". This avoids making every node look like a policy
object while preserving the feature for nodes that need it.

Normalize `node.dx` per runtime:

```json
{
  "dx": {
    "run": {
      "worker": {
        "on": false,
        "path": ""
      }
    },
    "monitor": {
      "logMessages": false,
      "logTimings": false
    },
    "security": {
      "enabled": false,
      "request": {
        "fs": "inherit",
        "net": "deny",
        "process": "deny",
        "allow": {
          "netHosts": [],
          "fsRoots": []
        }
      }
    }
  }
}
```

Policy values should be:

- `inherit`: use model-level runtime setting;
- `allow`: allow without violation;
- `warn`: emit security event but continue;
- `deny`: emit deterministic violation; actual blocking is a later milestone.

The effective policy is:

```text
runtime defaults
  -> model-level runtimeSettings / <model-name>.rt.json envelope
  -> node.dx security request
  -> effective policy clipped to the model-level envelope
```

A node must never be able to override or broaden model-level security settings.
The model-wide runtime policy defines the maximum allowed envelope. Node-level
security settings are judged against that envelope and can only make behavior
more restrictive, more observable, or more explicit. If a node requests
something outside the envelope, the runtime should treat that as a policy
violation or configuration error and report it through the same security event
path.

### Runtime Extensibility

Runtimes should become a first-class extension point. Going forward, application
developers may want to modify or add runtimes for specific deployment, security,
testing, or agent-integration needs. Coding agents will make it practical to
create runtime variants quickly, so vmblu should avoid hard-coding only the
current built-in runtimes.

Current built-in runtimes:

| Runtime | Browser | Node.js | Safety/ALS | Agent |
|---|---:|---:|---:|---:|
| `@vizualmodel/vmblu-runtime/rt-base` | yes | yes | no | no |
| `@vizualmodel/vmblu-runtime/rt-browser-agent` | yes | yes | no | yes |
| `@vizualmodel/vmblu-runtime/rt-als` | no | yes | yes | no |
| `@vizualmodel/vmblu-runtime/rt-agent` | no | yes | yes | yes |

Use a naming convention:

```text
runtime id:      @scope/package/rt-name or local rt-name
runtime folder:  rt-name
runtime prefix:  rt-
```

A runtime folder should expose a consistent minimum surface:

```text
rt-name/
  index.js
  runtime-settings.js
  runtime.js
  runtime-settings.svelte, or registered UI component metadata
```

The registry should be able to load built-in runtimes and later developer
provided runtimes through the same metadata shape. The first implementation can
still use static imports for the built-in runtimes, but the registry design
should not prevent adding local or package-provided runtimes later.

### UI Plan

The runtime settings UI should continue moving toward a registry shape that
mirrors the JS runtime settings registry:

- `ui-svelte/nodes/runtime-settings/runtime-settings-base.svelte`
- `ui-svelte/nodes/runtime-settings/runtime-settings-als.svelte`
- `ui-svelte/nodes/runtime-settings/runtime-settings-browser-agent.svelte`, if
  browser-agent settings diverge from base settings later
- `ui-svelte/nodes/runtime-settings/runtime-settings-agent.svelte`

Update `runtime-settings.svelte` so selection is not a hard-coded
`isAlsRuntime()` check. It should map runtime id to component:

```text
rt-base  -> base panel
rt-browser-agent -> base or browser-agent panel
rt-als   -> ALS security panel
rt-agent -> agent runtime panel
```

The model-level runtime settings popup already exists. Node-level settings stay
on the pulse icon.

Node runtime panels should show the same three-section structure for every
runtime:

```text
Run
Monitor
Security
```

The section contents can vary by runtime. The security section should be
collapsed or disabled by default and become editable only when the node opts
into custom security requests. The UI should show when a request is outside the
model-level envelope before the user saves it.

### Remaining Runtime Plan

1. Keep generated app startup on `new Runtime(nodeList, runtimeOptions)`.
2. Keep `rt-browser-agent` as the browser/default agent runtime in docs and
   browser examples.
3. Add UI registry entries for `rt-browser-agent` if its settings diverge from
   `rt-base`.
4. Keep safety enforcement report-first until a dedicated hard-blocking
   milestone is designed.
5. Do not reintroduce runtime scaffold wrappers or runtime-node wrappers.

## 2. Coherent Testing Approach

### Current State

The runtime has focused Node tests for safety and agent broker behavior. The
framework concepts are now clearer:

- mirror nodes can observe behavior without changing application nodes;
- the test harness can drive generated apps;
- probes provide read-only truth;
- events provide asynchronous observations;
- tools provide controlled actions.

The missing piece is the selection strategy: which input combinations are worth
testing.

### Specification

Introduce a generated test artifact:

```text
<model-name>.test.json
```

Shape:

```json
{
  "schema": "https://vmblu.dev/schemas/test.v1.json",
  "version": 1,
  "application": "solar-system",
  "cases": [
    {
      "id": "camera_control.follow_saturn",
      "source": "generated-from-tool-example",
      "tool": "camera_control",
      "args": {"action": "follow-body", "bodyId": "saturn"},
      "expect": {
        "events": ["camera.changed"],
        "probes": [
          {
            "id": "camera.follow",
            "assert": {"path": "$.bodyId", "equals": "saturn"}
          }
        ],
        "timeoutMs": 1000
      }
    }
  ]
}
```

Mirror nodes should be generated only for observations that cannot be covered by
broker event wiring or probes. In other words:

1. Prefer probes for current state.
2. Prefer declared events for semantic occurrences.
3. Use mirror nodes to capture internal messages when the capability metadata
   says a route/output is important but it is not an agent event.
4. Avoid mirroring every wire by default.

### Test Case Selection Strategy

Generated testing should use a tiered strategy rather than all input
combinations.

Tier 1: smoke cases

- one valid example per tool;
- one probe read per probe;
- one event observation path per event where it can be triggered.

Tier 2: schema boundary cases

- required field missing;
- enum invalid value;
- min/max boundary for numbers;
- empty and maximum useful strings;
- invalid object shape.

Tier 3: effect cases

- cases declared in `tool.effects[].verifyWith`;
- cases declared in `tool.examples`;
- cases declared in explicit `testHints`.

Tier 4: risk/security cases

- tools with `risk` higher than low;
- tools requiring approval;
- nodes with non-default security settings;
- tools expected to touch fs/net/process capabilities.

Tier 5: authored scenarios

- user-written workflows for meaningful app behavior.

Do not generate Cartesian products except for very small enum sets. Use pairwise
coverage at most, and only where the schema gives clear independent dimensions.

### Required Metadata Additions

Extend tool metadata with optional testing hints:

```json
{
  "tool": {
    "enabled": true,
    "id": "camera_control",
    "examples": [
      {
        "name": "follow Saturn",
        "args": {"action": "follow-body", "bodyId": "saturn"},
        "expect": {
          "probes": ["camera.follow"],
          "events": ["camera.changed"]
        }
      }
    ],
    "testHints": {
      "generateBoundaryCases": true,
      "importantEnums": {
        "action": ["home", "follow-body", "set"]
      }
    }
  }
}
```

### Implementation Plan

1. Add `cli/context/*/test.schema.json`.
2. Add a capability-to-test generator in `core/types/model/blueprint-test.js`.
3. Add CLI command `vmblu make-tests <model.mod.blu>`.
4. Generate Tier 1 smoke tests from examples, effects, probes, and events.
5. Add a runtime test harness package that can:
   - start the generated app runtime;
   - call tools through `ToolBroker`;
   - read probes;
   - wait for events;
   - assert JSON paths;
   - collect trace and security events.
6. Add mirror-node generation only for selected internal observations.
7. Add docs explaining how generated tests should be reviewed and extended.

### Mirror Node Rule

Mirror nodes should be explicit generated test instrumentation, not part of the
normal app. The generator should add them to a test model or test app wrapper,
not mutate the canonical `.mod.blu`.

Use mirror nodes when:

- an output pin is relevant to an expected effect but is not published as an
  event;
- a route-level invariant matters;
- a security or policy test needs to observe an internal message.

Do not use mirror nodes when a probe or declared event already provides the
assertion.

## 3. Agent Tool, Event, Probe, and Permission Settings

### Current State

The capability layer is in good shape structurally:

- input pins can publish tools;
- output pins can publish events;
- source nodes can publish probes;
- `<model>.cap.json` is generated;
- `rt-agent` exposes tools and probes to an OpenAI-compatible provider;
- `ToolBroker` handles tool calls, probe reads, event waits, and traces.

The broker now has a minimal working policy layer:

- `AgentPolicy` normalizes simple single-agent and multi-agent settings.
- `ToolBroker` filters capability views per agent.
- Tool, probe, and event access is checked against allow/deny policy.
- Tool and probe args are validated before dispatch.
- Policy and validation decisions are traced.
- `approval: "always"` creates pending approval requests that can be resolved
  through the runtime API.
- `wait: "verified"` performs basic probe/event verification.

The remaining weak parts are operational and schema polish:

- no visual approval prompt UI yet;
- no generated `model-name.agents.json` schema yet;
- risk/effect approval rules are not implemented beyond simple
  `approval: "always"`;
- no full chat/provider end-to-end demo has been confirmed after the UI work;
- agent settings UI writes header settings but sidecar creation/editing is not
  done yet.

### Specification

Introduce a sidecar agent config:

```text
<model-name>.agents.json
```

Shape:

```json
{
  "schema": "https://vmblu.dev/schemas/agents.v1.json",
  "version": 1,
  "agents": [
    {
      "id": "operator",
      "title": "Operator agent",
      "enabled": true,
      "instructions": "Operate the application through published tools.",
      "llm": {
        "provider": "openai",
        "model": "gpt-4.1-mini",
        "endpoint": "http://127.0.0.1:8080/v1"
      },
      "ui": {
        "mode": "overlay"
      },
      "permissions": {
        "tools": {
          "allow": ["camera_control", "simulation_control"],
          "deny": []
        },
        "probes": {
          "allow": ["camera.active", "camera.follow", "simulation.state"]
        },
        "events": {
          "allow": ["camera.changed"]
        },
        "effects": {
          "deny": ["external:send", "document:delete"]
        }
      },
      "policy": {
        "approval": {
          "mode": "manual",
          "requiredForRisk": ["high"],
          "requiredForEffects": ["fs:write", "net:egress"]
        },
        "limits": {
          "maxToolCallsPerTurn": 4,
          "maxProbeReadsPerTurn": 12,
          "maxEventWaitsPerTurn": 4,
          "toolTimeoutMs": 3000
        }
      }
    }
  ]
}
```

Keep `header.agent` as shorthand:

```json
{
  "header": {
    "agent": {
      "path": "./solar-system.agents.json",
      "defaultAgent": "operator"
    }
  }
}
```

### Capability Metadata Tightening

Tool settings should explicitly separate:

- identity: `id`, `title`, `description`;
- input contract: `schema`, examples;
- behavior: `effects`, `verifyWith`, timeout;
- policy hint: `risk`, `approval`;
- generated binding: target node/pin/payload.

Event settings should add:

- frequency: `semantic`, `state-stream`, `high-frequency`;
- retention: how many recent events to keep;
- visibility: whether agents can see it by default;
- correlation hint: `callId`, payload field, latest-only.

Probe settings should add:

- kind: `state`, `dom`, `file`, `runtime`, `computed`;
- cost: `cheap`, `moderate`, `expensive`;
- staleness: `live`, `cached`;
- default visibility.

### Broker Enforcement Status

Implemented:

1. Agent capability view filters `capabilities.list` by agent permissions.
2. Tool allow/deny rejects calls outside the agent's allowed set.
3. Probe/event allow/deny rejects reads and waits outside allowed sets.
4. JSON Schema validation runs for tool args and probe args.
5. Approval handling exists for the simple `approval: "always"` case.
6. Effect verification exists for the first `wait: "verified"` slice.
7. Broker traces policy, validation, approval, and verification decisions.

Not implemented yet:

1. Risk/effect-driven approval rules.
2. User-facing approval prompt UI.
3. Rich verification metadata normalization.
4. Generated tests over broker flows.
5. Better UI for pending approvals and runtime traces.

### Agent UI Plan

Use two interfaces, because they serve different users:

1. Editor settings UI for authoring:
   - create/edit agents;
   - choose provider/model/endpoint;
   - select allowed tools/probes/events;
   - configure approvals and limits;
   - inspect effective capability view.
2. Runtime UI for operation:
   - chat/task interface;
   - trace;
   - approval prompts;
   - visible current permissions;
   - security warnings.

Editor authoring now exists in a first simple form. The next milestone should
extend the runtime overlay with approval prompts, current permissions, and
trace visibility.

## Implementation Phases

### Phase 1: Runtime Settings Foundation

Status: complete for the report-first milestone and runtime architecture cleanup.

- Add model-level runtime settings schema.
- Add runtime settings normalization for model-level and node-level policy.
- Add `rt-agent` runtime settings UI component.
- Replace hard-coded runtime UI selection with registry-style selection.
- Pass effective runtime policy into `rt-als` and `rt-agent`.
- Add model settings popup editing for `header.runtimeSettings`.
- Show node-level envelope feedback in the runtime settings popup.
- Classify safety events against domain policy and allow-list details.
- Use runtime classes directly through `new Runtime(nodeList, runtimeOptions)`.
- Add the complete built-in runtime matrix:
  `rt-base`, `rt-browser-agent`, `rt-als`, and `rt-agent`.
- Consolidate ALS safety into `runtime/rt-als/safety.js`.

Acceptance:

- base, ALS, and agent runtimes show distinct settings panels;
- node `dx` remains backwards compatible;
- generated apps can receive model-level runtime settings;
- `security.event.policy` records the effective decision for observed
  fs/net/process behavior.
- browser applications can use agent features through `rt-browser-agent`
  without importing ALS or Node.js safety hooks.

### Phase 2: Broker Policy and Validation

Status: complete for the minimal end-to-end slice.

- Add agent policy normalization.
- Add filtered capability views per agent.
- Add allow/deny checks for tools, probes, and events.
- Add JSON Schema validation.
- Add trace records for policy decisions.

Acceptance:

- an agent cannot call a denied tool;
- invalid tool args fail before runtime dispatch;
- `capabilities.list` only returns what the agent may use.

### Phase 3: Effects, Approval, and Verification

Status: partially complete.

Implemented:

- `wait: "verified"` in `ToolBroker.callTool`;
- basic probe/event verification after dispatch;
- structured accepted/verified/unverified outcomes;
- broker approval requests for `approval: "always"`;
- runtime API to approve or deny pending approval requests.

Remaining:

- normalize richer `effects.verifyWith` metadata;
- add risk/effect-driven approval rules;
- add user-facing approval prompts;
- add trace UI for verification steps;
- add generated test coverage around verification flows.

Acceptance:

- a tool with `verifyWith.probes` can return `verified`;
- timeout returns `unverified` with evidence;
- trace shows event/probe verification steps;
- approval-required tools are not silently executed and can be approved from
  the UI.

### Phase 4: Test Generation

- Add `test.schema.json`.
- Add `make-tests`.
- Generate smoke and effect tests from capability metadata.
- Add a test harness runner over `ToolBroker`.
- Add selective mirror-node instrumentation.

Acceptance:

- the solar-system example gets generated smoke tests;
- tests can call a tool, wait for an event, read a probe, and assert result;
- mirror nodes are only generated for selected observations.

### Phase 5: Agent Settings UI

Status: partially complete.

Implemented:

- editor popup node for agent settings;
- original `agent settings` source node in `ui-svelte`;
- imported dock node in playground;
- simple multi-agent editing;
- permission selection UI for tools/probes/events;
- saving through `header.agent`.

Remaining:

- add `agents.json` schema;
- add sidecar creation/editing flow;
- add runtime overlay permissions summary;
- add approval request UI;
- improve provider/model settings after a real provider end-to-end test.

Acceptance:

- a user can configure one or more agents without editing JSON manually;
- the runtime overlay shows the effective permissions;
- approval-required tools are not silently executed.

## Near-Term File Map

Likely implementation files:

- `runtime/rt-agent/agent-runtime-support.js`
- `runtime/rt-agent/tool-broker.js`
- `runtime/rt-agent/agent-runtime.js`
- `runtime/rt-agent/agent-overlay.js`
- `runtime/rt-agent/capability-registry.js`
- `runtime/rt-agent/broker-protocol.js`
- `runtime/rt-agent/agent-policy.js`
- `runtime/rt-agent/json-schema.js`
- `runtime/rt-browser-agent/runtime.js`
- `ui-svelte/nodes/runtime-settings/*`
- `ui-svelte/nodes/agent-settings/*`
- `ui-svelte/nodes/model-runtime-settings/*`
- `ui-svelte/nodes/document-settings/document-settings.svelte`
- `core/types/model/blueprint-cap.js`
- `core/types/model/blueprint-test.js`
- `cli/commands/make-capabilities/index.js`
- `cli/commands/make-tests/index.js`
- `cli/context/*/blu.schema.json`
- `cli/context/*/capabilities.schema.json`
- `cli/context/*/agents.schema.json`
- `cli/context/*/test.schema.json`

## Recommended Next Slice

The best next slice is to test the full agent loop end-to-end in playground and
fill only the gaps that block that loop.

1. Start playground with `rt-agent` or `rt-browser-agent`.
2. Confirm the document settings popup saves:
   - selected runtime;
   - model runtime settings;
   - agent settings.
3. Confirm the generated capability manifest reaches `ToolBroker`.
4. Confirm `capabilities.list` reflects the selected agent's permissions.
5. Confirm a denied tool/probe/event is rejected with a trace record.
6. Confirm a permitted tool call reaches the target node.
7. Confirm invalid args fail before dispatch.
8. Confirm a `wait: "verified"` tool returns useful evidence.
9. Confirm an `approval: "always"` tool creates a pending approval request.

After that works, implement the smallest useful runtime UI additions:

1. Show pending approval requests in the agent overlay.
2. Add approve/deny buttons that call `agent.approvals.approve(id)` or
   `agent.approvals.deny(id)`.
3. Show the current agent's effective permissions in the overlay.
4. Show a compact broker trace panel for the last tool/probe/event decisions.

Then update generators/tooling:

1. Fix the old VS Code extension/generator startup shape so generated apps use
   `import {Runtime}` and `new Runtime(nodeList, runtimeOptions)`.
2. Add `agents.json` schema.
3. Add Tier 1 broker smoke tests from the capability manifest.
