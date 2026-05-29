# vmblu Agent Capability User Guide

This guide explains the current vmblu agent capability layer.

The feature is usable, but still evolving. The current reference application is
`examples/solar-system`.

## Overview

A vmblu application can expose a controlled surface to an agent.

That surface is a capability manifest:

```text
<model-name>.cap.json
```

It contains:

- `tools`: actions the agent may request,
- `probes`: read-only state checks,
- `events`: app observations,
- `policies`: approval/risk metadata,
- `usageGuidance`: general instructions for agent use.

Agents do not call arbitrary nodes directly. Calls go through the runtime
broker:

```text
agent
  -> AgentRuntime
  -> ToolBroker
  -> vmblu runtime queue
  -> application node
```

## Choose A Runtime

Agent support is available in two runtime variants:

| Runtime | Browser | Node.js | Safety/ALS | Agent |
|---|---:|---:|---:|---:|
| `@vizualmodel/vmblu-runtime/rt-base` | yes | yes | no | no |
| `@vizualmodel/vmblu-runtime/rt-browser-agent` | yes | yes | no | yes |
| `@vizualmodel/vmblu-runtime/rt-als` | no | yes | yes | no |
| `@vizualmodel/vmblu-runtime/rt-agent` | no | yes | yes | yes |

Use `rt-browser-agent` for browser applications that need agent tools, probes,
events and the overlay UI. Use `rt-agent` for Node.js applications that need the
same agent layer plus ALS-based safety attribution and Node API instrumentation.

## Configure An Agent

Use an agent runtime and point `header.agent` at an agent sidecar:

```json
{
  "header": {
    "runtime": "@vizualmodel/vmblu-runtime/rt-browser-agent",
    "agent": {
      "path": "./solar-system.agent.json"
    }
  }
}
```

The agent sidecar contains the enabled flag, identity, instructions, provider
settings, UI settings and runtime limits. The generated capability manifest
remains model-derived and is written separately as `<model-name>.cap.json`.

Do not store provider secrets or API keys in `.mod.blu`. In the browser demo,
the app talks to a local OpenAI-compatible bridge via `endpoint`.

## Add A Tool

Expose an input pin by adding a `tool` block:

```json
{
  "name": "cmd.tool",
  "kind": "input",
  "contract": {
    "role": "owner",
    "payload": "ToolInvocation"
  },
  "tool": {
    "enabled": true,
    "id": "camera_control",
    "title": "Camera control",
    "description": "Reset, select, look at, follow, or set the camera.",
    "risk": "low",
    "approval": "never",
    "schema": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": ["home", "reset", "select", "look-at-body", "follow-body", "set"]
        },
        "bodyId": {
          "type": "string"
        }
      },
      "required": ["action"]
    }
  }
}
```

If the target pin payload is `ToolInvocation`, `ToolBroker` wraps model args as:

```json
{
  "callId": "tool-call-id",
  "tool": "camera_control",
  "arguments": {
    "action": "follow-body",
    "bodyId": "saturn"
  }
}
```

Other target pins receive the model arguments directly.

## Add A Probe

Expose read-only state by adding a `probes` array to a source node:

```json
{
  "kind": "source",
  "name": "CameraManager",
  "probes": [
    {
      "enabled": true,
      "id": "camera.active",
      "name": "camera.active",
      "title": "Active camera",
      "description": "Returns active camera id, mode, state, and available cameras.",
      "kind": "state",
      "schema": {
        "type": "object"
      }
    }
  ]
}
```

The source node implements:

```js
probe(name, args) {
  if (name === "camera.active") {
    return {
      cameraId: this.activeCamera?.cameraId ?? null,
      mode: this.activeCamera?.mode ?? null,
      state: this.activeCamera?.state ?? null
    }
  }
  return null
}
```

Agent runtimes auto-register declared probes against matching source nodes. The
broker returns both JSON-safe `value` and a text representation for LLM context.

## Add An Event

Expose an output pin by adding an `event` block:

```json
{
  "name": "camera.event",
  "kind": "output",
  "contract": {
    "role": "owner",
    "payload": "CameraEvent"
  },
  "event": {
    "enabled": true,
    "id": "camera.changed",
    "title": "Camera changed",
    "description": "Observed when the active camera selection or mode changes.",
    "schema": {
      "type": "object",
      "properties": {
        "reason": { "type": "string" },
        "cameraId": { "type": ["string", "null"] },
        "mode": { "type": ["string", "null"] }
      },
      "required": ["reason"]
    }
  }
}
```

Events should represent meaningful occurrences. Avoid exposing high-frequency
state streams as agent events. If an output fires every frame or tick, keep it
as app state and add a separate semantic event pin.

The solar-system app follows this rule:

- `camera.active` is continuous camera state for rendering and probes.
- `camera.event` is the semantic event output.
- `camera.changed` is the agent-facing event id.

## Generate Files

Generate the capability manifest:

```text
vmblu make-capabilities solar-system.mod.blu
```

Generate the app:

```text
vmblu make-app solar-system.mod.blu
```

For agent runtime models, the generated app should contain:

```js
import {Runtime} from '@vizualmodel/vmblu-runtime/rt-browser-agent'
import capabilities from './solar-system.cap.json' with { type: 'json' }
import agent from './solar-system.agent.json' with { type: 'json' }

const runtimeOptions = {
  capabilities,
  agent
}

const runtime = new Runtime(nodeList, runtimeOptions)
runtime.start()
```

If `runtimeOptions` does not include `agent`, the generated app will not create
the agent runtime. If it does not include `capabilities`, the broker will have no
tools, probes or events to expose.

When regenerating from the VS Code extension after updating generator code,
reload the VS Code window or reopen the vmblu editor so the webview uses the
new bundle.

## Runtime UI

The current browser UI mode is `overlay`.

It provides:

- a floating launcher button,
- a draggable/resizable chat window,
- light/dark mode,
- a chat tab,
- a trace tab,
- current tools/probes exposed to the LLM.

The overlay is owned by `AgentRuntime`. The `ToolBroker` does not own UI.

## Current Solar-System Capabilities

Tools:

- `camera_control`
- `chart_control`
- `simulation_control`
- `simulation_start`
- `solar_presentation`

Probes:

- `camera.active`
- `camera.follow`
- `chart.state`
- `simulation.state`

Events:

- `camera.changed`
- `chart.overlay`

The existing MCPClient/MCPServer nodes remain in the solar-system model and can
coexist with the new agent path.

## Current Limitations

- Tool input schema validation is not implemented yet.
- Automatic effect verification is not implemented yet.
- Human approval UI is not implemented yet.
- Provider streaming and cancellation are not implemented yet.
- Durable event subscriptions such as "if this event happens, then do this" are
  not implemented yet.
- In-app agent windows are not implemented yet.
- Node/headless runtime UI is not implemented yet.
- Multi-agent configuration is not implemented yet.

## Future Direction

The intended next layer is to make the capability surface self-improving:

- record user requests the agent could not fulfill,
- classify whether the missing piece was a tool, probe, event, policy, or app
  behavior,
- store a structured "missing capability" record,
- use those records as input for a coding agent to improve the model, nodes,
  tests, and docs.

For multi-agent support, the likely direction is one application-level
`ToolBroker`, multiple registered `AgentRuntime` instances, and a scoped
capability view per agent.
