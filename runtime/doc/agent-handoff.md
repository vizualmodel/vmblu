# vmblu Agent Capability Layer Handoff

Last updated: 2026-05-02

## Context

This work adds a vmblu-native capability layer for agents. MCP remains useful,
but it is treated as an adapter/projection over vmblu capabilities, not as the
internal model.

The current architecture is:

```text
User / app event
  -> AgentRuntime overlay or future app UI
  -> LLM provider adapter
  -> AgentRuntime
  -> ToolBroker
  -> vmblu runtime message queue / probes / events
  -> vmblu application graph
```

The key boundary is intentional: the agent may reason and plan, but the
`ToolBroker` is the deterministic capability gateway. It owns what can be
called, observed, and read.

## Current Decisions

- Capability metadata is authored in `.mod.blu`, colocated with nodes and pins.
- Input pins can be exposed as tools.
- Output pins can be exposed as events.
- Source nodes can expose read-only probes with node-level `probes` metadata.
- Tools, probes, and events are normalized into `<model>.cap.json`.
- Capability generation is a separate CLI command: `vmblu make-capabilities`.
- Generated `rt-agent` apps inline the capability manifest into
  `agentRuntimeOptions`.
- Agent config v1 lives in `header.agent`, directly after `header.runtime`.
- LLM connection config lives under `header.agent.llm` with `provider`, `model`,
  and `endpoint`.
- Secrets and API keys must not be stored in `.mod.blu`.
- Browser overlay UI is owned by `AgentRuntime`, not `ToolBroker`.
- The `ToolBroker` must preserve vmblu runtime semantics and dispatch through
  the runtime queue, not by directly calling node handlers.
- Browser and node runtimes both need to be supported. Browser can own overlay
  DOM; node needs an external UI or app bridge.
- In-app agent windows are future work and need an explicit I/O routing
  contract through the app/tool broker boundary.
- Multi-agent configuration, agent dispatchers, group-level agents, and
  external `model.agents.json` are future work.

## Implemented

- Added model support for:
  - pin `tool` metadata,
  - pin `event` metadata,
  - source-node `probes` metadata,
  - `header.agent` metadata.
- Added capability generation:
  - `core/types/model/blueprint-cap.js`,
  - `cli/commands/make-capabilities/index.js`,
  - `<model>.cap.json` output.
- Added schema/template support for capability and agent metadata:
  - `cli/templates/0.9.4/*`,
  - `cli/templates/0.9.5/*`,
  - project-local `.vmblu/capabilities.schema.json`.
- Updated `vmblu init` to copy `capabilities.schema.json`.
- Updated app generation for `rt-agent`:
  - generated apps pass `agentRuntimeOptions` into
    `VMBLU.scaffold(nodeList, filterList, agentRuntimeOptions)`,
  - capabilities are generated inline from the model,
  - `header.agent` is passed when present.
- Rebuilt the VS Code webview bundle so generation from the extension uses the
  same `agentRuntimeOptions` path as the CLI.
- Added `runtime/rt-agent`:
  - `CapabilityRegistry`,
  - `ToolBroker`,
  - `TraceRecorder`,
  - `AgentRuntime`,
  - broker protocol constants,
  - browser-safe context/safety helpers,
  - `./rt-agent` package export and build script.
- Added runtime startup integration:
  - `rt-agent/scaffold.js` accepts runtime options,
  - `rt-agent/runtime.js` creates and attaches the broker,
  - the broker is attached as an internal runtime actor,
  - declared events are wired by appending broker targets to matching output
    tx tables,
  - declared probes are auto-registered against matching source-node actors.
- Added browser overlay UI:
  - floating launcher button,
  - draggable and browser-resizable chat/trace window,
  - light/dark switch,
  - chat tab,
  - trace tab backed by `TraceRecorder`,
  - cleanup during runtime `stop()`.
- Added OpenAI-compatible browser provider adapter:
  - reads `header.agent.llm.endpoint` and `header.agent.llm.model`,
  - posts non-streaming `/chat/completions` requests,
  - exposes vmblu tools and probes as OpenAI function tools,
  - routes model tool calls back through `ToolBroker`,
  - serializes chat turns inside `AgentRuntime`.
- Added tool dispatch behavior:
  - normal tool pins receive raw model arguments,
  - pins whose payload is `ToolInvocation` receive
    `{ callId, tool, arguments }`.
- Added probe execution:
  - source nodes may implement `probe(name, args)`,
  - only declared probes are registered,
  - broker returns both JSON-safe `value` and textual `text`,
  - provider-facing probe functions are read-only and named `probe_*`.
- Added basic event observation:
  - declared output pins are observed by `ToolBroker`,
  - app-wide `event.observed` messages are delivered to registered agents,
  - `AgentRuntime` keeps a bounded recent-event buffer,
  - recent events are included as system context in the next provider turn,
  - trace keeps the full observed event stream.
- Added focused runtime tests:
  - `runtime/test/agent-broker.test.js`.

## Solar-System Demo State

The solar-system example is the current end-to-end demo.

- `header.runtime` is `@vizualmodel/vmblu-runtime/rt-agent`.
- `header.agent` defines `solar-system-agent`.
- `header.agent.llm` is configured for the existing local OpenAI-compatible
  bridge:
  - `provider: "openai"`,
  - `model: "gpt-4.1-mini"`,
  - `endpoint: "http://127.0.0.1:8080/v1"`.
- The old MCPClient/MCPServer nodes remain in place and still work.
- `camera_control` is bound to `CommandRouter.cmd.tool`, because the command
  router is the application command boundary and accepts the stable high-level
  tool schema.
- Other tools remain directly bound where their schema already matches the
  target pin contract.
- Current tools:
  - `camera_control`,
  - `chart_control`,
  - `simulation_control`,
  - `simulation_start`,
  - `solar_presentation`.
- Current probes:
  - `simulation.state` on `SimulationClock`,
  - `camera.active` on `CameraManager`,
  - `camera.follow` on `CameraManager`,
  - `chart.state` on `DistanceChart`.
- Current events:
  - `camera.changed` on `CameraManager.camera.event`,
  - `chart.overlay` on `DistanceChart.chart.overlay`.

Important event design decision:

- `CameraManager.camera.active` is a continuous render-state stream and must
  not be an agent event.
- A separate `CameraManager.camera.event` output pin was added for semantic
  camera changes.
- The agent-facing event id is `camera.changed`.
- This avoids flooding the agent and trace while a follow camera updates every
  simulation tick.

Generated/derived files refreshed:

- `examples/solar-system/solar-system.cap.json`
- `examples/solar-system/solar-system.app.js`

## Verification

Recent checks run successfully:

- `runtime`: `npm.cmd run build`
- `runtime`: `npm.cmd test`
- `cli`: `npm.cmd run build`
- `examples/solar-system`: `npm.cmd run build`
- `vscodex`: `npm.cmd run webview`
- CLI generation:
  - `node cli\bin\vmblu.js make-capabilities examples\solar-system\solar-system.mod.blu`
  - `node cli\bin\vmblu.js make-app examples\solar-system\solar-system.mod.blu`

The solar-system app has been tested with the local LLM bridge. The agent can
call `camera_control`, the app changes the camera, and probes can verify state.

## Caveats

- Tool input schema validation is not implemented yet.
- Effect verification is not automatic yet.
- Human approval is represented in metadata, but no approval UI exists yet.
- Provider streaming and cancellation are not implemented yet.
- Provider credentials/proxy configuration beyond the local bridge is not
  designed yet.
- In-app agent windows are not implemented yet.
- Node runtime UI bridge is not designed yet.
- Event context is basic: observed events are added to recent context, but
  durable event subscriptions such as "when this happens, do that" are not
  implemented yet.
- The VS Code extension/webview must be reloaded after rebuilding the webview
  bundle, otherwise an already-open editor may still use stale generator code.

## Future Work

### Capability Quality

- Add JSON Schema validation in `ToolBroker` before dispatch.
- Add automatic post-tool verification using declared probes/events.
- Add effect metadata that says which probe/event can confirm a tool outcome.
- Add better tool-result summaries for the LLM.
- Add failure classification: invalid args, missing tool, rejected by policy,
  runtime timeout, app-level failure, and unverifiable outcome.

### Event Workflows

- Add durable agent event subscriptions for requests like:
  "If this event happens, then do this."
- Represent subscriptions explicitly in agent state, not as hidden prompt text.
- Add unsubscribe/inspect subscription tools.
- Add event throttling/deduplication policy for high-frequency outputs.
- Keep the current design rule: continuous state streams should not be exposed
  as semantic events unless explicitly throttled or summarized.

### Missing-Capability Learning Loop

A useful future feature is an "unfulfilled request log":

- When the agent cannot satisfy a user request because no suitable tool, probe,
  or event exists, it should record a structured gap.
- The gap record should include:
  - the user request,
  - the missing capability,
  - why existing tools/probes/events were insufficient,
  - suggested tool/probe/event metadata,
  - likely target node/pin if the agent can infer one,
  - any relevant failed attempts.
- These records can become input for a coding agent such as Codex.
- A coding agent could use the log to propose model changes, node
  implementation changes, tests, and documentation updates.
- This turns real user interaction into a prioritized backlog for improving
  the application capability surface.

### Multi-Agent Direction

Possible multi-agent model:

- Keep one application-level `ToolBroker` as the authority boundary.
- Allow multiple `AgentRuntime` instances to register with the broker.
- Give each agent a scoped capability view.
- Add explicit agent identity to traces, tool calls, events, and approvals.
- Add an orchestrator only after single-agent capability scoping is stable.
- Consider `model.agents.json` later if `header.agent` becomes too large.
- Avoid letting agents call arbitrary graph internals; inter-agent calls should
  also be broker-mediated capabilities.

### UI Directions

- Add in-app agent window mode, routed through explicit app pins or broker I/O.
- Add external UI mode for node/headless runtimes.
- Add richer trace filtering by turn, tool call, event, probe, and agent id.
- Add visible approval UI for non-`never` approval policies.

### Runtime/Tooling

- Add focused tests for `blueprint-cap.js`.
- Add tests that generated `rt-agent` apps include `agentRuntimeOptions`.
- Add tests for event wiring from declared output pins.
- Add tests for probe auto-registration failure behavior.
- Keep `runtime/doc/agent-user-guide.md` current as the feature evolves.
