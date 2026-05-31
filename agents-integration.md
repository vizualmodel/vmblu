# Agent Integration Handoff

Date: 2026-05-31

## Purpose

This document defines the next agent-integration work for vmblu. The goal is to
make vmblu applications usable by external agents without turning vmblu into an
agent framework.

The central principle is:

```text
vmblu owns the controlled application capability surface.
Agent frameworks consume projections of that surface.
All execution still goes through the ToolBroker and vmblu runtime.
```

The work should keep three concepts separate:

1. **AI nodes**: nodes inside the application graph that perform defined AI
   tasks such as summarization, classification, extraction or generation.
2. **Agent interface configuration**: vmblu-native configuration that defines
   which agent-facing interface exists, which capabilities it can access, and
   how it is exposed.
3. **External agent or agent SDK**: an overlay LLM client, MCP client, OpenAI
   Agents SDK process, Claude client, LangChain process, or custom automation
   service operating the application from outside the graph.

## Agreed Direction

The current editor Agent Settings popup should evolve from "overlay settings"
into a general **agent interface configuration** editor.

It should support different interface types, for example:

- built-in overlay;
- MCP;
- OpenAI tools / OpenAI Agents SDK;
- Claude tools;
- LangChain;
- custom vmblu-native HTTP or WebSocket integration.

The capability manifest remains the source of truth for what the application
can expose. Target-specific formats are projections generated from that source.

For browser applications, the near-term scope should stay narrow: support the
built-in AI overlay through the existing LLM bridge. External agent gateway
support for browser apps can be deferred because it requires live browser
session routing through a trusted bridge.

For Node.js applications, the app can host the agent gateway directly because
the process can access the runtime and ToolBroker in-process.

## Target Architecture

The target architecture is:

```text
vmblu model
  -> selected tools, probes and events
  -> capability manifest
  -> agent interface configuration
  -> projection registry / adapter
  -> agent gateway or generated integration artifact
  -> external agent client
  -> ToolBroker
  -> vmblu runtime queue
  -> target node input pin, probe or event stream
```

The generated capability manifest should describe:

- tools;
- probes;
- events;
- schemas;
- approval hints;
- risk/effect metadata;
- routing metadata needed by the ToolBroker.

Agent interface configuration should describe:

- interface id;
- interface type;
- enabled/default state;
- title;
- instructions;
- allowed tools, probes and events;
- provider/model/endpoint settings where relevant;
- transport/server settings where relevant;
- policy and limits.

Target-specific projections should be generated from the capability manifest
plus one selected agent interface configuration.

## Runtime Paths

### Built-In Browser Overlay

The built-in overlay path is the simplest complete integration:

```text
user
  -> browser overlay
  -> AgentRuntime
  -> OpenAI-compatible chat endpoint
  -> generated OpenAI-style tool schemas
  -> ToolBroker
  -> vmblu runtime queue
  -> application node/probe/event
```

For this path:

- use `@vizualmodel/vmblu-runtime/rt-browser-agent` for browser apps;
- use the local LLM bridge or an application backend as the endpoint;
- do not put provider API keys in browser code;
- consume agent configuration directly from generated runtime options.

### Node.js Agent Gateway

For Node.js apps, vmblu should provide an agent gateway that can run inside the
application process:

```text
external agent
  -> app-hosted agent gateway
  -> ToolBroker
  -> vmblu runtime
```

The gateway can expose one or more protocol surfaces:

```text
GET  /agent/capabilities
GET  /agent/capabilities?format=openai
GET  /agent/capabilities?format=claude
POST /agent/tools/:toolId/call
POST /agent/probes/:probeId/read
GET  /agent/events
POST /agent/approvals/:approvalId
```

MCP may need a protocol-specific server rather than the generic HTTP shape, but
it should still use the same capability projection and broker dispatch path.

### Browser External Agent Gateway

For browser apps, full external agent integration should be deferred.

The browser cannot be the trusted public agent server. A bridge or backend would
need to route calls to a specific live browser session, probably over WebSocket:

```text
external agent
  -> trusted bridge/gateway
  -> browser app session
  -> ToolBroker
```

This is useful later, but it is not required for the near-term browser overlay
milestone.

## Static Generation vs Runtime Projection

vmblu should support both runtime projection and CLI generation from the same
projection code.

Runtime projection is preferred for live integrations:

```text
GET /agent/capabilities?format=openai
GET /agent/capabilities?format=claude
```

Advantages:

- avoids stale generated files;
- applies per-agent permissions at request time;
- allows version negotiation;
- allows runtime availability to be reflected later;
- keeps all targets on one projection implementation.

CLI generation remains useful for frameworks that expect files, code wrappers,
or packaged integration artifacts:

```bash
vmblu make-agent-interface app.blu --agent operator --target mcp
vmblu make-agent-interface app.blu --agent operator --target openai
vmblu make-agent-interface app.blu --agent operator --target claude
vmblu make-agent-interface app.blu --agent operator --target langchain
```

The CLI must call the same projection library used by the runtime gateway.

## Projection Targets

Different agent systems need different projection shapes.

| Target | Projection shape |
|---|---|
| vmblu-native | JSON capabilities and broker request API |
| OpenAI tools | JSON tool/function schemas plus tool-call handling |
| OpenAI Agents SDK | generated tool wrappers or runtime tool registration backed by broker calls |
| Claude tools | Claude-compatible tool schemas plus tool-call handling |
| MCP | MCP server/tool protocol backed by broker calls |
| LangChain | generated JS/Python tool wrappers or dynamic tool objects backed by broker calls |
| Custom HTTP | simple vmblu gateway endpoints |

LangChain is not just "send LangChain JSON". LangChain tools are usually code
objects/functions in the host runtime. A LangChain projection may need generated
helper code that creates tools whose implementations call the vmblu gateway.

## Agent Settings UI

The existing popup lives at:

```text
ui-svelte/nodes/agent-settings/agent-settings.svelte
```

Current capabilities:

- multiple agent entries;
- id, title and enabled flag;
- instructions;
- OpenAI provider/model/endpoint;
- overlay mode;
- tools/probes/events allow lists;
- default agent selection.

This should evolve into an agent interface editor.

Suggested model:

```json
{
  "schema": "https://vmblu.dev/schemas/agents.v1.json",
  "version": 1,
  "defaultAgent": "operator",
  "agents": [
    {
      "id": "operator",
      "type": "overlay",
      "title": "Agent Interface",
      "enabled": true,
      "instructions": "Operate the application through published vmblu capabilities.",
      "permissions": {
        "tools": {"allow": ["camera_control"], "deny": []},
        "probes": {"allow": ["camera.active"], "deny": []},
        "events": {"allow": ["camera.changed"], "deny": []}
      },
      "llm": {
        "provider": "openai",
        "model": "gpt-4.1-mini",
        "endpoint": "http://127.0.0.1:8080/v1"
      },
      "ui": {
        "mode": "overlay"
      },
      "policy": {
        "limits": {
          "maxToolCallsPerTurn": 4
        }
      }
    }
  ]
}
```

For an MCP interface:

```json
{
  "id": "automation",
  "type": "mcp",
  "title": "Automation Interface",
  "enabled": true,
  "instructions": "Use only the published application capabilities.",
  "permissions": {
    "tools": {"allow": ["camera_control"], "deny": []},
    "probes": {"allow": ["camera.active"], "deny": []},
    "events": {"allow": ["camera.changed"], "deny": []}
  },
  "transport": {
    "mode": "stdio"
  }
}
```

For a generic gateway interface:

```json
{
  "id": "external-http",
  "type": "http",
  "enabled": true,
  "server": {
    "host": "127.0.0.1",
    "port": 8787,
    "basePath": "/agent"
  }
}
```

The UI should show target-specific fields only when relevant.

Near-term UI types:

1. `overlay`
2. `mcp`
3. `openai`
4. `claude`
5. `langchain`
6. `http`

The first implementation can support `overlay` fully and keep the others as
configuration/projection targets without implying that all runtime servers are
done.

## Capability Projection Library

Add a shared projection module used by both CLI and runtime gateway.

Likely package location:

```text
runtime/rt-agent/projections/
```

or, if the projections should not depend on runtime code:

```text
core/agent/
```

The cleaner long-term split is:

```text
core/agent/
  capability-projection.js
  projection-openai.js
  projection-claude.js
  projection-mcp.js
  projection-langchain.js
  projection-http.js
```

The projection entry point should accept a capability manifest and an agent
interface configuration:

```js
projectCapabilities(capabilities, {
    target: 'openai',
    agent: agentConfig,
})
```

It should return target-specific data without dispatching runtime calls.

The runtime/gateway layer should provide the execution handlers that call the
ToolBroker.

## CLI Work

Add a CLI command that generates target-specific interface artifacts from the
same projection code used by the runtime gateway.

Possible command:

```bash
vmblu make-agent-interface <model-name>.blu --agent <agent-id> --target <target>
```

Targets:

- `vmblu`
- `openai`
- `claude`
- `mcp`
- `langchain`
- `http`

Possible outputs:

```text
<model-name>.agent.openai.json
<model-name>.agent.claude.json
<model-name>.mcp.json
<model-name>.langchain.js
<model-name>.agent.http.json
```

For targets that require live execution, generated artifacts should point to a
gateway URL or MCP server command rather than bypassing the ToolBroker.

The command should:

1. load the model;
2. generate or load the capability manifest;
3. load `header.agent` or `<model-name>.agents.json`;
4. select the requested agent/interface;
5. apply that interface's permission view;
6. project into the requested target format;
7. write the target artifact.

## Runtime Gateway Work

Add a broker-backed gateway for Node.js apps.

Responsibilities:

- expose vmblu-native capability descriptions;
- expose target-specific capability projections where useful;
- receive tool calls and route them to `ToolBroker.callTool`;
- receive probe reads and route them to `ToolBroker.readProbe`;
- expose events through polling or streaming;
- expose approval resolution endpoints;
- include trace/correlation ids in responses.

The gateway should not execute node code directly. It must use the same broker
request path as the overlay.

Likely files:

```text
runtime/rt-agent/agent-gateway.js
runtime/rt-agent/agent-gateway-http.js
runtime/rt-agent/agent-gateway-mcp.js
runtime/rt-agent/projections/*
```

## Documentation Work

Update the user guide with a practical setup path.

The guide should include:

1. What an agent interface is.
2. How AI nodes differ from external agents.
3. How to expose tools, probes and events.
4. How to generate the capability manifest.
5. How to use the Agent Settings popup.
6. How to run the built-in overlay with the LLM bridge.
7. How external integrations differ from the overlay.
8. How a Node.js gateway exposes capabilities to MCP/OpenAI/Claude/LangChain.
9. What is generated statically and what is projected dynamically.
10. Security rules: no direct app-code calls, no browser provider keys, broker
    remains mandatory.

The guide should be task-oriented:

```text
Expose capabilities
Configure an agent interface
Use the built-in overlay
Connect an external agent framework
Secure the interface
```

## Example Work

Add one example besides the existing overlay path.

Recommended first example: a Node.js app with a simple HTTP or MCP gateway.

Why:

- Node.js can host the gateway in-process;
- no browser session routing is needed;
- the example can demonstrate external-agent access clearly;
- it exercises the same capability manifest, agent config, projection code and
  ToolBroker path.

Example should show:

1. model with one or two useful tools;
2. at least one probe for verification;
3. one event;
4. agent interface configuration;
5. generated capability manifest;
6. gateway startup;
7. external script/client calling a tool through the gateway;
8. probe read to verify the result.

Possible example names:

```text
examples/agent-gateway-basic
examples/node-agent-gateway
examples/agent-http-gateway
```

## Implementation Phases

### Phase 1: Schema and UI Model

- Rename the conceptual UI from overlay settings to agent interface settings.
- Add `type` to agent configurations.
- Add fields for `server` and `transport`.
- Keep existing overlay behavior working.
- Add or update `agents.v1.json` schema.
- Preserve backward compatibility for current `header.agent` shape.

Acceptance:

- current overlay configuration still works;
- existing agent settings normalize into the new type-aware shape;
- UI can display and save at least `overlay`, `mcp`, `openai`, `claude`,
  `langchain`, and `http` types.

### Phase 2: Projection Library

- Add shared projection entry point.
- Move OpenAI tool schema generation out of `AgentRuntime` into the projection
  library.
- Add vmblu-native and OpenAI projections first.
- Add placeholders or minimal projections for Claude, MCP and HTTP.
- Keep LangChain as generated wrapper design until concrete implementation is
  chosen.

Acceptance:

- overlay uses the same OpenAI projection code as CLI/gateway;
- projection tests prove per-agent permission filtering;
- no target projection becomes the source of truth.

### Phase 3: CLI Projection Command

- Add `vmblu make-agent-interface`.
- Support at least `openai` and `http` targets.
- Add MCP target when the server shape is settled.
- Add docs for static artifact generation.

Acceptance:

- command reads the same capability manifest and agent config;
- generated OpenAI tool schema matches runtime overlay schema;
- denied tools/probes/events are absent from generated output.

### Phase 4: Node.js Gateway

- Add HTTP gateway for Node.js runtime.
- Add runtime option to enable gateway from agent config.
- Expose vmblu-native capabilities and OpenAI projection over HTTP.
- Route calls through ToolBroker only.

Acceptance:

- external process can list capabilities;
- external process can call a tool;
- external process can read a probe;
- denied calls fail before runtime dispatch;
- traces identify the agent/interface id.

### Phase 5: Example and User Guide

- Add Node.js gateway example.
- Update user guide with practical setup steps.
- Include overlay and external gateway paths.
- Keep browser external-agent gateway out of near-term scope.

Acceptance:

- user can follow the guide to configure overlay;
- user can follow the example to connect an external process;
- docs explain what vmblu generates and what remains framework-specific.

## Open Decisions

1. The CLI command should be named `make-agent-adapter`.
2. Agent-facing adapter and gateway code should live under
   `runtime/agent-adapters`. Over time, shared source that currently lives under
   `runtime/rt-agent` can move there when it is not specific to the `rt-agent`
   runtime variant.
3. Gateway configuration should start per agent interface, because it gives the
   most flexibility. Common gateway defaults can be factored into an app-level
   block later if repeated configuration becomes painful.
4. The first external example should be HTTP. MCP is also needed, but HTTP is
   the smallest gateway that proves the architecture.
5. Browser external-agent gateway support should remain possible, but it is not
   a priority. Near-term browser work should stay focused on the overlay and
   LLM bridge.

## Near-Term Recommendation

Start with the smallest coherent implementation:

1. Introduce `type` in agent settings and normalize old overlay settings to
   `type: "overlay"`.
2. Extract OpenAI tool projection from `AgentRuntime` into a shared projection
   module.
3. Add `vmblu make-agent-adapter --target openai`.
4. Add a minimal Node.js HTTP gateway target.
5. Build `examples/agent-http-gateway`.
6. Update the user guide with the practical setup path.

This gives vmblu a credible end-to-end story:

```text
one capability model
one broker boundary
multiple agent-facing projections
```
