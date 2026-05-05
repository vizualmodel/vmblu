# vmblu Agent Capability Layer â€” Implementation Specification

## Context

This repository contains the vmblu project.

vmblu models applications as explicit message-passing architectures: source nodes, group nodes, pins, routes, contracts, generated runtime files, and profiles. The goal of this task is to start implementing the first foundation for allowing LLM-based agents to interact with vmblu applications in a controlled, observable, testable way.

Do **not** implement a full autonomous-agent framework. The goal is to implement the application-side capability layer that agents can use.

The architecture we want is:

```text
LLM Provider / MCP / future provider
    â‡… provider adapter
Agent Runtime
    â‡… vmblu broker protocol
Tool Broker
    â‡… vmblu runtime messages / probes / events
vmblu Application Graph
````

The first implementation should focus on:

```text
capabilities â†’ broker â†’ generated MCP compatibility
```

Agents, scripting, multi-agent orchestration, and advanced policy can come later.

---

## Core Design Decision

vmblu should not treat MCP as its internal abstraction.

MCP is a protocol/export layer.

The internal vmblu abstraction is a **capability surface**.

A capability surface describes:

```text
tools   = actions an agent may request
probes  = read-only inspection points an agent may use to verify state/effects
events  = asynchronous observations emitted by the application
effects = expected semantic consequences of tools
policies = risk/approval/limits metadata
```

A tool is **not simply an input pin**.

An input pin can be exposed as a primitive tool, but the agent-facing tool needs metadata:

```text
id
title
description
input pin reference
input schema/type
effects
verification probes/events
risk
approval hint
timeout
examples or usage guidance
```

The fundamental vmblu agent interaction model is:

```text
tool call â†’ broker dispatches vmblu message â†’ broker observes events/probes â†’ broker returns acknowledged/completed/verified result
```

Because vmblu is asynchronous, do **not** assume that a tool call has a synchronous return value.

---

## Terminology

Use these terms consistently.

### Tool

A controlled action exposed to an agent.

Usually backed by a source node input pin.

Example:

```text
camera.focusPlanet
simulation.setTime
document.updateStatus
```

### Probe

A read-only inspection point into meaningful application state.

A probe answers:

```text
What is true now?
```

Examples:

```text
camera.currentTarget
simulation.currentTime
document.currentStatus
ui.activePanel
```

A probe is not necessarily an output pin. It may eventually be backed by a node getter, runtime state, DOM inspection, file state, event log, etc.

For the first implementation, it is sufficient to define probe metadata and simple bindings/stubs.

### Event

An observable occurrence.

An event answers:

```text
What happened?
```

Events may be backed by source node output pins.

Examples:

```text
camera.targetChanged
simulation.timeChanged
document.statusChanged
```

### Effect

The semantic consequence a tool is expected to have.

Example:

```text
Calling camera.focusPlanet should change camera.currentTarget.
```

For the first implementation, effects can be embedded inside tool metadata.

### Broker

The runtime authority that receives tool/probe/event requests from agents or adapters, validates them, dispatches messages into the vmblu application, observes events/probes, verifies expected effects where possible, and returns structured results.

---

## What To Implement First

The first milestone should not implement a complete agent runtime.

Implement the foundation:

```text
1. Capability schema
2. Capability generation from model/profile metadata
3. Minimal broker protocol/types
4. Minimal broker implementation
5. MCP generation from capabilities instead of directly from @mcp tags
6. Trace/evidence records for broker activity
```

---


## Model Header Agent Configuration

The initial agent configuration belongs in the model header, directly after the
`runtime` setting.

For v1, support exactly one configured agent. Multi-agent orchestration,
external agent config files, group-level agents, and agent dispatchers are later
work.

The agent is a runtime object, not a normal vmblu node. It communicates with the
application through the broker and the generated capability surface.

Minimal header shape:

```json
{
  "runtime": "@vizualmodel/vmblu-runtime/rt-agent",
  "agent": {
    "enabled": true,
    "id": "mainAssistant",
    "title": "Main assistant",
    "instructions": "Help the user operate this application.",
    "llm": {
      "provider": "TO BE DECIDED",
      "model": "TO BE DECIDED",
      "endpoint": "TO BE DECIDED"
    },
    "ui": {
      "mode": "overlay",
      "trace": true,
      "traceWindow": "overlay"
    },
    "runtime": {
      "environment": "browser"
    },
    "capabilities": {
      "tools": [],
      "probes": [],
      "events": []
    },
    "limits": {
      "maxToolCallsPerTurn": 10
    }
  }
}
```

The `agent` block should be serialized immediately after `runtime` in the model
header so it is easy to see which runtime and which agent setup belong together.

Open decisions:

```text
provider API key/proxy configuration = TO BE DECIDED
provider-specific model names = TO BE DECIDED
provider endpoint / local bridge URL = TO BE DECIDED
node runtime UI attachment = TO BE DECIDED
in-app agent I/O routing protocol = TO BE DECIDED
multi-agent configuration shape = TO BE DECIDED
```

### Agent UI Modes

The first user-facing agent window should be runtime-owned.

Supported/target modes:

```text
overlay
  Runtime-owned browser overlay window.
  This is the preferred first implementation.

in-app
  App-owned window/component.
  Requires a defined route for agent input/output between the runtime and the app.
  Routing mechanism = TO BE DECIDED.

external
  CLI, VS Code panel, remote console, or other host-owned surface.
  Scope = TO BE DECIDED.
```

Every configured agent should also have a trace window or trace panel. The trace
window is not the same as the chat window. It shows broker/provider/app activity
for debugging and audit.

Initial trace window behavior:

```text
show request ids and call ids
show provider messages at a summarized level
show broker decisions
show tool calls, probe reads, event observations, and verification results
show errors and policy decisions
```

Do not block v1 on a full trace viewer. A simple overlay trace panel backed by
the existing trace/evidence log is sufficient.

### Browser and Node Runtime Support

The agent runtime must be designed for both browser and node environments.

Browser runtime:

```text
can own DOM overlay windows
can present chat and trace panels directly
must avoid node-only APIs
provider access and secrets = TO BE DECIDED
```

Node runtime:

```text
can run provider adapters and broker logic in node
cannot assume a DOM overlay exists
needs an external UI or an app bridge for chat/trace I/O
node UI bridge = TO BE DECIDED
```

The generic broker and agent runtime should stay environment-neutral where
possible. UI adapters and provider adapters can be environment-specific.

---

# Milestone 1 — Capability Schema

## Goal

Add a vmblu-native capability schema.

Preferred location:

```text
cli/templates/<current-version>/capabilities.schema.json
```

or the equivalent schema/template location used by the project.

The schema should support:

```json
{
  "schema": "...",
  "application": {},
  "tools": [],
  "probes": [],
  "events": [],
  "policies": {},
  "usageGuidance": {}
}
```

Do not overdesign. Keep v1 small but extensible.

## Minimal Shape

A generated `model.capabilities.json` should look roughly like this:

```json
{
  "schema": "https://vmblu.dev/schemas/capabilities.v1.json",
  "version": 1,
  "application": {
    "id": "example",
    "title": "Example Application",
    "description": "Example vmblu application."
  },
  "tools": [
    {
      "id": "camera.focusPlanet",
      "title": "Focus planet",
      "description": "Changes the active camera target to a named planet.",
      "input": {
        "node": "CameraController",
        "pin": "focusPlanet",
        "ref": "focusPlanet@CameraController",
        "schema": {
          "type": "object",
          "properties": {
            "planet": {
              "type": "string"
            }
          },
          "required": ["planet"]
        }
      },
      "effects": [
        {
          "id": "camera.targetChanged",
          "description": "The active camera target changes to the requested planet.",
          "verifyWith": {
            "probes": ["camera.currentTarget"],
            "events": ["camera.targetChanged"]
          },
          "successHint": "camera.currentTarget.targetName should equal the requested planet.",
          "timeoutMs": 1000
        }
      ],
      "risk": "low",
      "approval": "never"
    }
  ],
  "probes": [
    {
      "id": "camera.currentTarget",
      "title": "Current camera target",
      "description": "Returns the currently focused planet or object.",
      "kind": "state",
      "schema": {
        "type": "object",
        "properties": {
          "targetName": {
            "type": "string"
          }
        }
      }
    }
  ],
  "events": [
    {
      "id": "camera.targetChanged",
      "title": "Camera target changed",
      "description": "Emitted when the active camera target changes.",
      "source": {
        "node": "CameraController",
        "pin": "targetChanged",
        "ref": "targetChanged@CameraController"
      },
      "schema": {
        "type": "object"
      }
    }
  ],
  "policies": {
    "defaultApproval": "never"
  },
  "usageGuidance": {
    "principles": [
      "Use tools to change application state.",
      "Use probes to verify effects.",
      "Use events for asynchronous observations.",
      "Do not assume that a tool call succeeded unless a result, probe, or event confirms it."
    ]
  }
}
```

## Schema Notes

Use `id` fields as stable semantic names.

Use `ref` fields for vmblu graph references such as:

```text
pinName@NodeName
```

Do not make MCP-specific fields part of the internal capability schema.

---

# Milestone 2 â€” Extend Pin/Profile Metadata


## Goal

Replace the old `@mcp`-only concept with structured metadata.

Keep `@mcp` support as a migration/compatibility path, but make capability metadata the preferred model.

For input pins, support optional metadata like:

```json
{
  "tool": {
    "enabled": true,
    "id": "camera.focusPlanet",
    "title": "Focus planet",
    "description": "Changes the active camera target to a named planet.",
    "risk": "low",
    "approval": "never",
    "effects": [
      {
        "id": "camera.targetChanged",
        "description": "The active camera target changes to the requested planet.",
        "verifyWith": {
          "probes": ["camera.currentTarget"],
          "events": ["camera.targetChanged"]
        },
        "timeoutMs": 1000
      }
    ]
  }
}
```

For output pins, support optional metadata like:

```json
{
  "event": {
    "enabled": true,
    "id": "camera.targetChanged",
    "title": "Camera target changed",
    "description": "Emitted when the active camera target changes."
  }
}
```

For source nodes, support optional probe metadata:

```json
{
  "probes": [
    {
      "id": "camera.currentTarget",
      "title": "Current camera target",
      "description": "Returns the current target of the active camera.",
      "kind": "state",
      "schema": {
        "type": "object",
        "properties": {
          "targetName": {
            "type": "string"
          }
        }
      },
      "binding": {
        "kind": "stub"
      }
    }
  ]
}
```

If the current vmblu model/profile structure already has a better place for this, use the existing style. Do not force an awkward structure if the project has an established profile format.

The key requirement is that a compiler/generator can derive:

```text
tools
events
probes
```

from the model/profile metadata.

---

# Milestone 3 â€” Capability Generator


## Goal

Create a generator that produces:

```text
model-name.capabilities.json
```

from the vmblu model and profile metadata.

The generator should:

1. Load the model.
2. Load available profile metadata if needed.
3. Find input pins with `tool.enabled === true`.
4. Find output pins with `event.enabled === true`.
5. Find node-level probes.
6. Resolve schemas/types where possible.
7. Produce a normalized capability file.

## Compatibility

If existing handlers use `@mcp`, keep compatibility by generating a primitive tool from the old metadata.

But the new pipeline should be:

```text
model/profile metadata
    â†’ capabilities.json
    â†’ mcp.json
```

not:

```text
@mcp metadata
    â†’ mcp.json directly
```

---

# Milestone 4 â€” MCP Export From Capabilities


## Goal

Modify MCP generation so that it reads from `model-name.capabilities.json`.

For each capability tool, generate the corresponding MCP tool definition.

MCP output should include:

```text
name
description
inputSchema
```

If possible, include structured output schema later, but do not block v1 on it.

Important:

The MCP export is a projection of vmblu capabilities.

MCP is not the internal source of truth.

---

# Milestone 5 â€” Broker Protocol Types


## Goal

Define internal vmblu broker message/request/result types.

Preferred location depends on the repo structure, but use a clear module name such as:

```text
src/agent/brokerProtocol.js
src/capabilities/brokerProtocol.js
src/runtime/brokerProtocol.js
```

or TypeScript equivalents if the project is using TypeScript in this area.

## Minimal Protocol

Support these request types:

```text
capabilities.list
tool.call
probe.read
event.wait
events.query
```

Support these result types:

```text
capabilities.result
tool.result
probe.result
event.result
events.result
broker.error
```

## Tool Call Request

```ts
type ToolCallRequest = {
  type: "tool.call";
  requestId: string;
  agentId?: string;
  toolId: string;
  args: unknown;
  wait?: "none" | "accepted" | "event" | "probe" | "verified";
  timeoutMs?: number;
};
```

## Tool Result

```ts
type ToolCallResult = {
  type: "tool.result";
  requestId: string;
  callId: string;
  toolId: string;
  status: "accepted" | "completed" | "verified" | "failed" | "timeout" | "denied";
  result?: unknown;
  events?: unknown[];
  verifiedEffects?: unknown[];
  error?: {
    code: string;
    message: string;
  };
};
```

## Probe Read Request

```ts
type ProbeReadRequest = {
  type: "probe.read";
  requestId: string;
  agentId?: string;
  probeId: string;
  args?: unknown;
};
```

## Probe Result

```ts
type ProbeReadResult = {
  type: "probe.result";
  requestId: string;
  probeId: string;
  status: "ok" | "failed" | "denied";
  value?: unknown;
  error?: {
    code: string;
    message: string;
  };
};
```

## Event Wait Request

```ts
type EventWaitRequest = {
  type: "event.wait";
  requestId: string;
  agentId?: string;
  eventId: string;
  callId?: string;
  filter?: unknown;
  timeoutMs?: number;
};
```

## Event Result

```ts
type EventWaitResult = {
  type: "event.result";
  requestId: string;
  eventId: string;
  status: "observed" | "timeout" | "failed" | "denied";
  callId?: string;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
};
```

---

# Milestone 6 â€” Minimal Tool Broker


## Goal

Implement a minimal broker that can:

```text
load a capability registry
list capabilities
receive a tool.call request
validate the tool exists
validate basic input schema if possible
check simple policy/risk fields
dispatch the corresponding vmblu message
assign callId
return accepted/completed/verified result
read probes
wait for events where possible
record trace/evidence
```

Do not overbuild.

The first broker can be limited.

## Broker Responsibilities

The broker should:

1. Maintain capability registry.
2. Maintain pending calls by `callId`.
3. Dispatch messages to vmblu runtime by pin reference.
4. Receive or observe events from vmblu runtime.
5. Read probes through registered probe bindings.
6. Return structured results.
7. Record trace entries.

## Broker Should Not

Do not make the broker reason like an LLM.

Do not implement autonomous planning.

Do not implement multi-agent orchestration.

Do not allow arbitrary runtime/node access from agent requests.

Do not expose raw app internals as tools.

---

# Milestone 7 â€” Trace / Evidence Log


## Goal

Every broker interaction should produce a trace record.

Trace records are essential to vmbluâ€™s value proposition: observable, safe, maintainable agentic interaction.

Trace each:

```text
capability list request
tool call request
policy decision
message dispatch
event observed
probe read
effect verified
timeout
error
final broker result
```

Minimal trace shape:

```json
{
  "traceId": "trace_001",
  "timestamp": "2026-04-30T10:00:00.000Z",
  "type": "tool.call",
  "agentId": "mainAgent",
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "status": "verified",
  "details": {}
}
```

Trace output can initially be in memory or written to a JSON log.

Do not block the first version on a complex trace viewer.

---

# Milestone 8 â€” Minimal Agent Runtime Stub

Only after the broker foundation exists, add a small agent runtime abstraction.


## Goal

Create a minimal runtime adapter layer that can eventually connect different LLM providers to the vmblu broker.

For now, this can be a stub or test harness.

The agent runtime should be responsible for:

```text
loading agent config
loading an agent-specific capability view
formatting provider-specific tool lists later
receiving provider-specific tool calls later
converting them into vmblu broker requests
converting broker results back into provider-specific tool results
injecting selected results/events into LLM context later
```

Do not implement a full provider integration unless the repo already has one.

Define interfaces first.

Example:

```ts
interface AgentRuntime {
  agentId: string;
  listCapabilities(): Promise<CapabilityView>;
  handleToolCall(providerCall: unknown): Promise<unknown>;
}
```

Example provider adapter interface:

```ts
interface ProviderAdapter {
  buildToolList(capabilityView: CapabilityView): unknown[];
  parseToolCalls(providerOutput: unknown): unknown[];
  formatToolResult(providerCallId: string, brokerResult: unknown): unknown;
}
```

---

# Milestone 9 â€” Header Agent Config and UI Surface

Add this after the capabilities and broker are working.

## Goal

Support the optional single-agent `agent` block in the model header.

The generated application should read the header agent configuration, instantiate
the generic `AgentRuntime`, attach it to the generic `ToolBroker`, and expose a
user-facing agent window.

For v1:

```text
one model-level agent only
configured in header.agent
agent communicates through the broker
agent is not a normal vmblu node
overlay chat window is the preferred first UI
trace window/panel is required
browser and node runtimes must both be considered
```

Do not add group-level agents in v1.

Do not implement complex orchestration, agent dispatchers, or external
`model.agents.json` files yet. Those are later configuration options.

Open decisions:

```text
in-app chat window routing = TO BE DECIDED
node runtime chat/trace UI bridge = TO BE DECIDED
provider credential handling = TO BE DECIDED
multi-agent config file format = TO BE DECIDED
```

---

# Milestone 10 â€” Capability Scripting

This is a later milestone.

Do **not** implement this before direct tool/probe/event broker calls work.


## Goal

Allow an LLM to submit a bounded script that orchestrates tools, probes, and events through the broker.

The script must be sandboxed and must not access application internals.

Conceptual API:

```js
export default async function run({ tools, probes, events, assert, trace }) {
  await tools.call("camera.focusPlanet", { planet: "Mars" });

  const target = await probes.read("camera.currentTarget");

  assert.equal(target.targetName, "Mars");

  return {
    ok: true,
    focused: target.targetName
  };
}
```

Allowed script operations:

```text
tools.call()
probes.read()
events.waitFor()
assert.*
trace.note()
return structured JSON
```

Disallowed:

```text
window
document
fetch
filesystem
child_process
eval
imports
direct node instances
raw runtime mutation
unbounded loops
large memory usage
```

Execution limits:

```text
timeoutMs
maxToolCalls
maxProbeReads
maxEventWaits
maxLoopIterations
maxOutputSize
```

---

## Important Architectural Rules

### Rule 1 â€” MCP is an adapter, not the internal model

The internal source of truth is `capabilities.json`.

MCP output is generated from capabilities.

### Rule 2 â€” Agents act through the broker

Agents should not directly send arbitrary messages into the graph.

They request tools/probes/events through the broker.

### Rule 3 â€” Tools are not enough

A useful agent interface requires:

```text
tools to act
probes to verify
events to observe
effects to explain expected consequences
policies to constrain
traces to audit
```

### Rule 4 â€” No fake synchronous return values

vmblu is asynchronous.

A broker may synthesize a result after observing probes/events, but this is not the same as a direct node return value.

Use statuses:

```text
accepted
completed
verified
failed
timeout
denied
```

### Rule 5 â€” User-facing UI should be concise

The normal user should see task-level progress:

```text
Pointing camera at Mars...
Camera pointed at Mars.
```

The detailed broker/app/LLM protocol chatter belongs in traces/debug views.

---

## Initial Acceptance Criteria

The first useful implementation is complete when:

1. The repo has a capability schema.
2. A vmblu model/profile can mark at least one input pin as a tool.
3. A vmblu model/profile can mark at least one output pin as an event.
4. A vmblu model/profile can define at least one probe.
5. A generator can produce `model-name.capabilities.json`.
6. MCP generation can use `model-name.capabilities.json`.
7. A minimal broker can list capabilities.
8. A minimal broker can receive a `tool.call` request.
9. The broker can dispatch the corresponding vmblu message.
10. The broker returns a structured result with `requestId` and `callId`.
11. The broker can read a probe through a stub or simple binding.
12. The broker records trace/evidence entries.
13. Existing MCP-based examples continue to work or have a clear compatibility path.

---

## Suggested First Test Case

Do not start with a complex application.

Create or use a minimal test model with:

```text
CameraController
  input: focusPlanet
  output: targetChanged
  probe: currentTarget
```

Tool:

```text
camera.focusPlanet
```

Probe:

```text
camera.currentTarget
```

Event:

```text
camera.targetChanged
```

Test flow:

```text
broker receives tool.call camera.focusPlanet({ planet: "Mars" })
broker dispatches focusPlanet@CameraController
CameraController updates target
broker reads camera.currentTarget
broker returns status verified
trace records the full sequence
```

This is enough to validate the architecture.

---

## Deferred Work

Do not implement these in the first pass unless the foundation is already working:

```text
full agent runtime with real LLM provider
multi-agent orchestration
agent dispatcher
group-level agent setup
complex policy engine
human approval UI
capability script execution
DOM probes
filesystem probes
visual probes
long-term memory
vector retrieval
advanced eval framework
full trace viewer
provider-specific optimizations
```

These are later stages.

---

## Final Goal

The goal is to make vmblu applications naturally usable by bounded agents.

The final conceptual architecture should support this sentence:

> A vmblu application exposes a controlled capability surface to agents. Agents can request tools, read probes, observe events, and verify effects through a broker. The broker enforces policy, dispatches messages into the application, observes results, and records traceable evidence. MCP and other provider-specific protocols are generated adapters over this vmblu-native capability model.

Implement the smallest coherent version of this first.

````

My recommendation is that you ask Codex to start with only this slice:

```text
capabilities schema
pin/profile metadata
capability generator
MCP export from capabilities
minimal broker protocol/types
````

That gets the â€œmachineâ€ moving without forcing you into premature decisions about full agents, scripting, or orchestration.



Yes, correct.

I would define the split like this:

```text
vmblu runtime package
  contains generic machinery:
    AgentRuntime
    ToolBroker
    broker protocol
    capability registry loader
    provider adapter interfaces
    trace/evidence recorder
    script executor later

generated application
  contains app-specific artifacts:
    model.app.js
    model.capabilities.json
    model.mcp.json, if needed
    header.agent configuration, if configured
    app-specific probe bindings, if generated
```

## Capabilities are application-specific

The capabilities file should be generated when the app is generated because it depends on the actual application model:

```text
nodes
pins
contracts/types
profiles
tool metadata
event metadata
probe metadata
effects
policies
```

So the pipeline should be:

```text
model.mod.blu
+ model.app.prf
+ capability metadata
      â†“
model.capabilities.json
      â†“
model.app.js uses/loads it
model.mcp.json generated from it, if required
```

The capabilities file is not part of the generic runtime. It is an app artifact.

## Broker and agents are runtime objects

The broker and agents should be generic runtime classes/services.

For example:

```js
import {
  ToolBroker,
  AgentRuntime,
  OpenAIAdapter
} from "@vizualmodel/vmblu/runtime";
```

Then the generated app wires them up:

```js
import capabilities from "./solar-system.capabilities.json";

const broker = new ToolBroker({
  runtime,
  capabilities,
  traceRecorder
});

const mainAgent = header.agent?.enabled
  ? new AgentRuntime({
      id: header.agent.id,
      broker,
      capabilities,
      config: header.agent,
      provider: new OpenAIAdapter(...)
    })
  : null;
```

Conceptually:

```text
ToolBroker class = generic
broker instance = app runtime object configured with app capabilities
```

Same for agents:

```text
AgentRuntime class = generic
agent instance = app runtime object configured from header.agent
```

## Important distinction

The broker is generic, but its **registry** is app-specific.

```text
ToolBroker
  generic logic:
    validate
    dispatch
    observe
    verify
    trace

CapabilityRegistry
  app-specific data:
    camera.focusPlanet
    simulation.setTime
    document.updateStatus
```

So you do not generate a new broker implementation per app. You generate the data the broker runs on.

## This affects the Codex spec

I would add this clarification to the prompt:

````md
## Runtime vs Generated Artifacts

Agents and the tool broker are generic runtime objects. They belong in the vmblu runtime/library, not in app-specific generated code.

The app-specific capability manifest is generated when the app is generated.

The generated application should instantiate/configure the generic broker using the generated capability manifest.

Do not generate a custom broker implementation for each application unless a small app-specific binding layer is required.

The intended split is:

```text
Generic runtime:
  ToolBroker
  AgentRuntime
  broker protocol
  provider adapter interfaces
  trace recorder
  capability registry loader
  script executor later

Generated per application:
  model.app.js
  model.capabilities.json
  model.mcp.json
  header.agent config if configured
  optional generated probe bindings
````

The generated app should load `model.capabilities.json` and pass it to the generic `ToolBroker`.

````

## About probe bindings

One nuance: probe definitions are app-specific, but probe execution may need runtime hooks.

For example, the capabilities file may say:

```json
{
  "id": "camera.currentTarget",
  "binding": {
    "kind": "nodeProbe",
    "node": "CameraController",
    "probe": "currentTarget"
  }
}
````

The generic broker can understand `kind: "nodeProbe"`.

But the generated app may need to register the actual probe implementation:

```js
broker.registerProbe("camera.currentTarget", () => {
  return cameraController.getCurrentTarget();
});
```

So:

```text
probe metadata = generated
probe executor = registered at runtime
broker mechanism = generic
```

That is the clean split.

## Final rule

I would state it like this:

> The vmblu runtime provides the generic agent/broker machinery. The generated application provides the capability manifest and app-specific bindings. At startup, the generated app instantiates the runtime broker, loads the generated capabilities, registers any required probe/event/message bindings, and optionally creates the configured header agent.

That is the correct architecture.
