# User prompt

Currently vmblu allows llms to interact with an application as follows:

1. The nodes have an exposed API, consisting of input and output messages.
2. vmblu generates an MCP file based on these APIs: model-name.mcp.js. This file is the basis to allow an LLM to interact with the nodes of the application.

As the solar-system application has shown, this works quite well, but there are a few drawbacks that we have to consider

1. The MCP file is a separate file made for the entire collection of nodes that is an application. Is that the best solution ?
2. The MCP server gives a 'standard' toollist to an MCP client and the client forwards a toollist to the LLM in a format that the LLM understands. While it is a good solution today, how long will this remain like this ? Are there other paradigms to cater for ?
3. The MCP node (server+client) has to be wired to the nodes it needs to interact with. This means that if an LLM wants to use a tool it both has to get that info via the toollist and it has to be connected to the pin it needs to use for that tool. This seems to be a limitation to what an agent can do with an application, unless you create some very broadly defined input pins like 'ui.cmd'.
4. The current implicit link, namely that a tool corresponds with a pin, is probably not always the best association. A tool could be a scenario, eg send a message on one pin and wait for a result on another pin.

So the question is: how do we have to change vmblu to make it more inline with (future) agentic interfaces. 

The way I would frame the question we have to solve is as follows: a software app in teh future will consist of a set of tools that can perform a set operations that have to be predictable and secure. These tools are implemented in software (eg as vmblu nodes or groups of nodes). These tools are going to be used by an agent who is going to receive a task and then will reason to find a solution and call the tools to execute and verify the result. How can we bring both elements together in an application architetcure ?

I think that we will need something more general then the MCP nodes we have now, lets call it an agent node, and give that agent node access to the tools it needs. A real life app will probably need several agents that are assigned different tasks.

Before we change anything to vmblu let's find a good approach to this problem.

# Codex reply

I think the right move is to make **agent/tool capability** a first-class vmblu concept, and treat MCP as only one export/runtime adapter.

MCP is still useful, but it should not be vmblu’s internal model. The MCP spec itself frames tools as discoverable callable capabilities with schemas, dynamic `tools/list`, optional output schemas, and human approval guidance; it also explicitly says the protocol does not mandate a particular UI model. OpenAI’s current agent tooling similarly separates workflows, tools, guardrails, typed edges, handoffs, evals, and MCP connectors. That tells us the stable abstraction is not “MCP file” or “pin equals tool”; it is **capability + policy + execution binding + transport adapter**.

Sources: [MCP tools spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools), [OpenAI Agent Builder](https://platform.openai.com/docs/guides/agent-builder), [OpenAI tools](https://platform.openai.com/docs/guides/tools/tool-choice), [OpenAI agent safety](https://platform.openai.com/docs/guides/agent-builder-safety).

**Recommended Direction**

Introduce a vmblu **Tool/Capability layer** between nodes and agents.

A vmblu tool should be its own model object, not merely a generated side effect of a handler:

```js
{
  name: "simulation_start",
  title: "Start simulation",
  description: "...",
  inputSchema: {...},
  outputSchema: {...},
  effects: ["simulation:write"],
  risk: "medium",
  approval: "optional|required|never",
  timeoutMs: 3000,
  binding: {
    kind: "scenario",
    steps: [
      { send: "clock.config @ SimulationClock", from: "$input" },
      { waitFor: "sim.state @ SimulationClock", select: "$latest" }
    ]
  }
}
```

That tool can bind to:
- one input pin
- one request/reply pair
- a multi-step scenario
- a group boundary
- a plain JS handler
- another agent
- an external MCP/server connector

This solves the main flaw: **pins remain architecture plumbing; tools become intentional agent-facing operations**.

**Agent Node**

An `Agent` node should not be “an MCP client/server node”. It should be a vmblu runtime node with:

- assigned task/instructions
- model/provider settings
- allowed tools by reference or capability scope
- context resources/state subscriptions
- safety policy
- memory policy, if any
- handoff targets, if any
- trace/eval hooks

The agent should connect to the graph through a small number of stable channels, for example:

- `agent.task`
- `agent.reply`
- `agent.event`
- `tool.call`
- `tool.result`
- `approval.request`
- `security.event`

It should not need a direct wire to every application pin it might use. Instead, it calls tools through a **Tool Broker**.

**Tool Broker**

The broker is the important runtime primitive. It owns:

- tool registry
- access control
- schema validation
- approval checks
- execution
- result validation
- tracing
- safe runtime attribution

The broker can execute a tool by calling the correct vmblu binding internally. This gives agents broad-but-controlled access without creating giant `ui.cmd` pins or brittle direct wiring.

So the runtime shape becomes:

```text
Agent Node
   -> Tool Broker
      -> vmblu Tool Registry
         -> node pin / request-reply / scenario / group / external adapter
```

**MCP Positioning**

Keep MCP, but demote it to an adapter:

```text
vmblu tool registry
  -> MCP server adapter
  -> OpenAI function-tool adapter
  -> local in-app agent adapter
  -> future adapter
```

The generated `.mcp.js` file can still exist for compatibility, but it should be generated from the vmblu tool registry, not from pin metadata directly.

**Model Changes**

I would add three concepts gradually:

1. `tools`
   First-class tool definitions in `.blu` or derived profile metadata.

2. `agents`
   Agent node configuration: instructions, model, tool scope, guardrails, handoffs.

3. `policies`
   Security/approval constraints reusable across agents and tools.

The important design rule: **tools are application-level intentions; bindings are implementation details**.

**Why This Fits vmblu**

vmblu already has the strong foundation: explicit nodes, pins, contracts, profiles, generated artifacts, and now safe runtime attribution. The missing abstraction is an explicit contract for “what an intelligent actor is allowed to do with this app”.

The solar-system `CommandRouter` is basically a hand-written prototype of that idea. It maps tool names to application commands. The next architecture should generalize that router into a declarative tool registry plus broker.

**Suggested Next Step**

Before implementation, I’d write a short ADR in `new-agent.md` around this decision:

> vmblu will model agent-facing capabilities as first-class tools. MCP is a transport/export format, not the internal abstraction. Agents receive scoped access to tools through a runtime broker, and tools bind to pins, request/reply flows, scenarios, groups, or external systems.

Then we can prototype with solar-system by replacing the hard-coded MCP/tool routing with one or two declarative vmblu tools and a minimal broker.

# ADR

## Title

Model agent-facing capabilities as first-class vmblu tools

## Status

Draft

## Context

vmblu currently exposes application behavior to LLMs through MCP generation. Node handlers can declare MCP metadata, vmblu generates a `<model-name>.mcp.js` file, and an MCP-oriented client/server flow exposes those tool definitions to an LLM. In the solar-system application this has proven useful: the LLM can inspect a list of available tools, call them, and drive the application through structured commands.

The current approach also exposes architectural limits:

1. The generated MCP file is application-wide and separate from the model semantics it represents.
2. MCP is a useful current protocol, but it should not become vmblu's internal abstraction for agentic interaction.
3. The LLM-facing tool list and the graph wiring are separate. A tool can be advertised to an agent, but the MCP node still has to be wired to the pins that ultimately execute the operation.
4. The implicit mapping "one tool equals one pin" is too narrow. A useful tool may be a scenario: send one message, wait for another, validate state, and return a structured result.
5. Real applications will likely need multiple agents with different responsibilities, different tool scopes, and different safety constraints.

The deeper architectural question is how vmblu should represent predictable, secure operations that agents can use while preserving the explicit node-and-pin architecture that makes vmblu understandable.

## Decision

vmblu should introduce an agent/tool capability layer as a first-class architectural concept.

A vmblu **tool** is an intentional application-level capability. It is not the same thing as a pin, a handler, or an MCP tool declaration. A tool has a stable name, description, input schema, optional output schema, safety metadata, and an execution binding.

MCP should remain supported, but as an adapter generated from vmblu tool definitions. MCP is one way to expose tools to external clients; it is not the internal model for agent interaction.

An **agent node** should be introduced as a more general successor to the current MCP client/server pattern. An agent node receives tasks, reasons with a model/provider, and calls tools through a broker. The agent does not need direct graph wiring to every node it may operate on. Its authority comes from its configured tool scope and policy.

A **tool broker** should mediate tool execution. It owns the runtime registry of tools, validates arguments, enforces access policy, handles approval when required, executes the bound vmblu behavior, validates or normalizes results, and emits trace/security events.

The resulting architecture is:

```text
Agent Node
  -> Tool Broker
     -> Tool Registry
        -> node pin / request-reply / scenario / group boundary / external adapter
```

## Key Concepts

### Tool

A tool is an agent-facing capability.

Example shape:

```js
{
  name: "simulation_start",
  title: "Start simulation",
  description: "Starts the simulation at a specific UTC time and optional stop time.",
  inputSchema: {
    type: "object",
    properties: {
      startIsoUtc: { type: "string" },
      timeScale: { type: "number" },
      stopIsoUtc: { type: "string" }
    },
    required: ["startIsoUtc"]
  },
  outputSchema: {
    type: "object",
    properties: {
      simTimeIsoUtc: { type: "string" },
      timeScale: { type: "number" }
    }
  },
  effects: ["simulation:write"],
  risk: "medium",
  approval: "optional",
  timeoutMs: 3000,
  binding: {
    kind: "scenario",
    steps: [
      { send: "clock.config @ SimulationClock", from: "$input" },
      { waitFor: "sim.state @ SimulationClock", select: "$latest" }
    ]
  }
}
```

The binding is deliberately separate from the public tool contract. This allows vmblu to keep stable agent-facing capabilities even when the internal node graph changes.

Supported binding kinds should grow incrementally:

- `pin`: send a message to one input pin.
- `request`: call a request/reply pair and return the reply.
- `scenario`: execute a small declarative flow of sends, waits, and result selection.
- `group`: expose a capability at a group boundary.
- `handler`: call a local JS function when graph routing is not the right abstraction.
- `external`: delegate to MCP, HTTP, filesystem, shell, or another provider through an explicit adapter.
- `agent`: delegate to another agent.

### Agent

An agent is a runtime node configured with:

- task or role instructions
- model/provider settings
- allowed tools or capability scopes
- context subscriptions
- safety policy
- optional memory policy
- optional handoff targets
- trace/evaluation settings

An agent should use a small stable vmblu interface, for example:

- `agent.task`
- `agent.reply`
- `agent.event`
- `tool.call`
- `tool.result`
- `approval.request`
- `security.event`

The exact pin names can change later, but the principle is that the agent talks to the tool system, not directly to every application node.

### Tool Broker

The broker is the runtime authority for tool execution.

Responsibilities:

- maintain or receive the effective tool registry
- filter tools by agent identity and policy
- validate tool arguments against schemas
- enforce allow/deny rules
- request human approval where needed
- execute the binding
- apply timeouts
- validate or normalize returned results
- emit trace events
- integrate with the safe runtime security event stream

The broker is also the right place to record "who did what": agent id, task id, tool name, input, result, approval status, and runtime safety warnings.

### Tool Registry

The registry is the model/runtime inventory of available tools. It should be derivable from the `.blu` model and profile metadata, but not limited to handler-level MCP declarations.

The registry should support:

- statically declared tools in the model
- tools derived from existing handler metadata for compatibility
- generated MCP tool files
- generated provider-specific tool formats
- runtime filtering per agent

## Consequences

Positive consequences:

- Tools become explicit architectural objects instead of accidental byproducts of pins.
- MCP remains supported without coupling vmblu's future to MCP.
- Agents can use tools without being wired to every underlying node.
- Multi-step operations become first-class and can return meaningful results.
- Safety, approval, tracing, and access control have a single enforcement point.
- Multiple agents can coexist with different responsibilities and tool scopes.
- Internal graph changes do not necessarily break the agent-facing tool contract.

Costs and risks:

- vmblu needs a new model concept and editor support for tools and agents.
- The runtime needs a broker and a binding executor.
- Tool definitions can become too abstract if they drift away from the actual graph.
- Scenario bindings introduce ordering, waiting, timeout, and result-selection semantics that must be kept small and predictable.
- There is a risk of recreating a workflow engine inside vmblu if the first version is too ambitious.

Mitigations:

- Start with a minimal binding set: `pin`, `request`, and a small `scenario`.
- Keep scenario semantics deliberately limited.
- Generate MCP from the tool registry to preserve compatibility.
- Keep existing handler-level `mcp` metadata as an import/compatibility path, not as the final architecture.
- Use the safe runtime events to audit tool execution from the beginning.

## Alternatives Considered

### Keep MCP as the main abstraction

This is the smallest short-term change, but it makes vmblu dependent on one protocol's vocabulary. It also does not solve the direct wiring problem or the "tool equals pin" assumption.

### Keep exposing pins directly

This preserves the current graph model, but it exposes implementation details to agents. It also encourages broad command pins such as `ui.cmd`, which are flexible but weakly typed and harder to secure.

### Introduce only an MCP router node

A generic MCP router would reduce hand-written routing, but it would still be MCP-centered and would not give vmblu a general model for agent capabilities, policies, approval, and non-MCP adapters.

### Treat every agent as an external process

External agents are useful and should be supported, but vmblu also needs in-app agents that are visible in the architecture, scoped by the model, and traceable by the runtime.

## Migration Strategy

1. Keep the current MCP generation working.
2. Define a minimal tool registry format.
3. Generate the existing `.mcp.js` from the registry instead of directly from handler metadata.
4. Add a minimal tool broker that can execute tools bound to pins or request/reply pairs.
5. Convert one solar-system tool, such as `simulation_start`, to the new registry format.
6. Replace part of `CommandRouter` with broker execution.
7. Add scenario bindings for operations that need send-and-wait behavior.
8. Add an agent node that calls broker tools through a provider adapter.

## Solar-System Prototype

The solar-system application is the right first test case because it already contains the pattern by hand:

- `solar-system.mcp.js` contains the generated tool declarations.
- `MCPClient` imports those declarations and converts them for the LLM provider.
- `CommandRouter` maps tool names to internal application commands.
- Results are routed back through `ui.tool-result`.

The prototype should replace this hard-coded mapping with:

- a declarative tool registry for a small number of tools
- a broker node that executes the binding
- MCP/OpenAI tool output generated from the registry
- the existing UI still calling tools as before

The first prototype should not attempt to solve all agent behavior. It should only prove that a tool can be declared once, exposed to an LLM, executed through graph bindings, and traced safely.

## Open Questions

1. Where should first-class tool definitions live: directly in `.blu`, in profile metadata, or in a companion generated/runtime file?
2. Should tools be owned by nodes, groups, or the application root?
3. What is the smallest useful scenario language?
4. How should tool result schemas be validated at runtime?
5. How should approvals be represented in the graph and UI?
6. How should agents discover context: explicit state subscriptions, resources, or tool calls?
7. Should agent nodes be generic provider-independent nodes, or should provider adapters be separate child nodes?
8. How should tool scopes be visualized in the editor?
9. Should safe runtime warnings be advisory for all tools, or should some tool policies fail closed when warnings occur?

## Decision Summary

vmblu will model agent-facing capabilities as first-class tools. MCP will be treated as an adapter generated from those tools, not as the internal architecture. Agents will receive scoped access to tools through a runtime broker. Tools will bind to vmblu behavior through pins, request/reply pairs, scenarios, groups, handlers, external adapters, or other agents. This keeps the vmblu graph explicit while giving agents a predictable and secure interface to application behavior.

## My thoughts about the ADR proposal

This subject, how to introduce agents in vmblu, is a big one, so we have to think very carefully before we start to implement. Here is a list of thoughts from me on the subject: (1) The way we have introduced MCP nodes in the solar system example is ok. It is fine to simply have an mcp file that corresponds to pins and use that to make an llm based user interface. We will not touch the solar system example, but make a new example application to demonstrate the use of agents. (2) I think that the split between a tool broker and an agent is valid. The agent is the active element: trying to realize a certain goal, the broker defines capabilities and has a defensive role: checking actions arguments etc. (3) My first worry is the tool definition: it should not become an extra burden for a user to define tool restrictions, scenarios etc. If there has to be a translation from what nodes offer as services it should be automatic and done by the tool broker. We have to look at how this can be done, but I suppose that an agent, given a set of 'primitives' should be able to work out scenarios, ie a list of instructions to execute. An important aspect of what an agent needs to be able to execute its taks, is being able to verify the result of an action. This is not automatc in vmblu applications, where sending a message does not have a 'return value'. (4) In a real application, I think people will want to use multiple agents, and then we have to look at orchestration. We could add a node manually for every type of agent that we want to use in an application, or add another node 'agent dispatcher', but I am not clear how this would work. (5) An agent probably has a standardized interface to the tool broker as in your proposal, I think that is very good. Equally important : an agent would also have settings like the ones you mentioned, but we can discover what these have to be as move forward. (6) How should we add agents to the vmblu model ? Agents have little to do with the actual architecture of the application they are working with: all interactions are channeled via the tool broker. We could visualize the application as living inside the tool broker for example, in this way we would add an extra level in the vmblu model. On the other hand we have to think also of an agent as a node in a vmblu application: suppose I have an application where I want to use an agent for translating text in my normal message flow, that would be cool as well. I think we could make very powerfull applications if we could compose agent nodes like this. Think carefully about this and give me your thoughts.

## Codex reply on my thoughts

I agree with your framing, especially the distinction between **agent as active goal-seeker** and **broker as defensive capability boundary**. That split is probably the core architectural move.

My current view is that vmblu should support **two different agent roles**, because they solve different problems:

1. **Application-level agents**
   These act “over” an application. They receive a task, inspect available tools, call broker-mediated capabilities, verify outcomes, and possibly coordinate with other agents.

2. **Flow-level agent nodes**
   These behave like normal vmblu nodes inside a message flow. Example: translate text, classify a message, summarize a document, decide routing, generate UI copy, extract structured data.

Both are useful, but they should not be collapsed too early.

**Tool Broker**

I think the broker should not require users to manually define a rich tool catalog upfront. That would be a mistake. If vmblu already has nodes with typed input/output messages, the broker should be able to derive **primitive tools** automatically.

For example, a node input pin like:

```text
DocumentStore.search
```

could become a primitive broker capability:

```text
search_document_store(args) -> event/result handle
```

But there is an important issue you point out: vmblu message sending has no inherent return value. So the broker needs a way to represent execution as something closer to:

```text
call capability
observe resulting events/state
decide whether success condition was met
return structured result
```

That suggests the primitive operation is not “send message and return value”, but:

```text
send + observe
```

The first broker version could support a few automatic result patterns:

- **Fire-and-observe:** send to an input pin, then watch declared output pins or state events.
- **Request/reply convention:** if a message has `correlationId`, match output messages with the same id.
- **State verification:** after an action, query or observe a state node/resource.
- **Agent verification:** let the agent decide whether observed state satisfies the task.

This means the broker can expose simple primitives automatically, while more refined tools can be added later only when needed.

**Tool Definitions**

I would avoid starting with user-authored scenario definitions.

Instead, I would separate three layers:

1. **Primitive capabilities**
   Automatically derived from node APIs, group APIs, and maybe profile metadata.

2. **Composed tools**
   Optional, higher-level tools declared by the app author when there is value in giving the agent a stable business operation.

3. **Agent plans**
   Dynamically created by the agent from primitives and composed tools.

So the user should not have to say:

```text
tool A = send here, wait there, validate this
```

unless they want a stable reusable capability. The agent should usually be able to form that sequence itself, provided the broker gives it enough observable feedback.

This changes the broker’s role slightly. It is not just “execute declared tools”. It is more like:

```text
capability registry + policy guard + execution monitor + observation gateway
```

**Verification**

Verification is probably the hardest design point.

Agents need to know whether an action worked. In ordinary code, this is a return value. In vmblu, it may be an output message, state change, visual UI change, log event, or absence of an error.

So I think vmblu needs a more explicit concept of **observable state/resources** for agents. Not everything has to be a tool. Some things are read-only context.

For example:

```text
tools:
  - set_simulation_time
  - start_simulation
  - focus_planet

resources:
  - current_simulation_state
  - selected_planet
  - visible_ui_state
  - recent_events
```

The agent acts through tools and verifies through resources/events.

That seems cleaner than making every verification path another tool.

**Multiple Agents**

For multiple agents, I would avoid designing a heavy orchestration system at the start. There are at least three patterns:

1. **Manual composition**
   The user places several agent nodes in the graph. They communicate like normal nodes.

2. **Broker-mediated delegation**
   One agent can call another agent as a tool/capability.

3. **Dispatcher/supervisor**
   A higher-level node receives tasks and routes them to specialized agents.

The first version should probably support patterns 1 and 2. A dedicated `AgentDispatcher` can come later if repeated examples prove the need.

The interesting design is that an agent itself can be exposed as a broker capability:

```text
translate_text_agent(input) -> translated_text
```

or:

```text
research_agent(task) -> report
```

This gives vmblu a compositional model without needing a separate orchestration framework immediately.

**How Agents Fit In The Model**

I would not model the application as “inside” the tool broker. That may be conceptually useful, but visually it risks making the broker look like it owns the application. In vmblu, the graph should remain the source of architectural truth.

Instead, I would model the broker as a **boundary/index over the graph**.

Something like:

```text
Application graph
  contains nodes, groups, pins, state

Tool broker
  indexes selected capabilities from the graph
  enforces policy
  exposes capabilities to agents

Agents
  may live outside the normal flow
  or inside the normal flow as nodes
```

So there may be two visual modes:

1. **Graph view**
   Shows agents, broker, and normal nodes as part of the application architecture.

2. **Capability view**
   Shows what each agent can see and do through the broker.

The capability view may be more important than drawing every connection from agent to every tool.

**Agent As Node**

I think this is essential. An agent should be usable as a normal vmblu node.

A flow-level agent node could have pins like:

```text
agent.input
agent.output
agent.error
agent.event
```

And internally it still uses the same agent runtime:

```text
model/provider
instructions
tool scope
context
memory
policy
```

But in this mode, its goal is usually bounded by the incoming message. For example:

```text
incoming email -> classify agent -> routing decision
```

or:

```text
text -> translation agent -> translated text
```

This is different from an application-level autonomous agent that receives an open task and keeps working until done.

So I would define:

```text
Agent runtime = common engine
Agent node = graph-embedded use of that engine
Application agent = task-driven use of that engine through broker
```

Same underlying machinery, different architectural role.

**Recommended Direction**

I would revise the architecture like this:

```text
Agent Runtime
  provider/model adapter
  instructions
  context
  memory
  tool protocol
  tracing

Agent Node
  vmblu node wrapper around Agent Runtime
  participates in normal message flow

Application Agent
  task-oriented agent configured at app/group level
  uses broker capabilities

Tool Broker
  derives primitive capabilities from graph APIs
  exposes optional composed tools
  enforces policy
  provides observation/resources
  records traces

Capability Registry
  generated from nodes, groups, pins, profiles, and optional tool declarations
```

The important shift from the earlier ADR is this:

> First-class tools should exist, but they should not be the mandatory starting point. The broker should automatically derive primitive capabilities from the vmblu graph, and explicit tools should be an optional layer for stable, higher-level application intentions.

That addresses your concern about user burden while preserving the ability to create well-defined tools where it matters.

For the first new example application, I would choose something that naturally demonstrates:

- an agent node inside a normal flow
- an application-level agent using broker capabilities
- verification through observed state/resources
- at least two agents, but without a complex dispatcher

A good example might be a small **document workflow** app:

```text
User drops text/document
  -> classifier agent
  -> extraction/summarization agent
  -> broker tools update document state
  -> review agent verifies required fields
```

It is more representative than solar-system for agentic workflows, and it would force us to solve the right problems: tools, verification, state, multiple agents, and normal vmblu composition.

## My reaction

Good take. (1) I fully agree on the agent dispatcher: if we need it at a given moment we will be able to build it on top of what we have. Not a worry for the moment. (2) The distinction between the two types of agent nodes is very true and valuable: vmblu can have agentic nodes in its normal workflow and have agents that are 'outside' the graph. (3) We have to solve the observability issue in vmblu - agent nodes could play a role in this, for example to observe screen output - but we have to consider this problem veru carefully, it is a cornerstone. (4) Let's think about how to make the 'agent-toolbroker' interface for a user. First I think it should be part of the model file because it is closely linked to the application, but we also know that vmblu files are already multi-file by design because of the linked nodes, so maybe the best solution is for  a vmblu model to have a filed like 'agentSetup' that refers to a separate file for the definitions that the tool broker and agents need - but without duplication for what can be found in the model file. It also avoids to over-burden a vmblu model file that does not need an agent setup.

## Codex reply

I think `agentSetup` as an optional linked file is the right direction.

It keeps the base vmblu model clean, but still makes the agent configuration part of the application architecture rather than an external runtime accident.

A rough shape could be:

```json
{
  "name": "document-workflow",
  "nodes": [...],
  "links": [...],
  "agentSetup": "./document-workflow.agents.json"
}
```

Then the agent setup file should not duplicate the graph. It should reference graph concepts and add only agent-specific meaning.

Example:

```json
{
  "version": 1,

  "brokers": [
    {
      "id": "mainBroker",
      "scope": {
        "includeGroups": ["DocumentWorkflow"],
        "includeNodes": ["DocumentStore", "ReviewQueue"],
        "excludePins": ["admin.deleteAll"]
      },
      "policies": ["defaultSafeActions"]
    }
  ],

  "agents": [
    {
      "id": "intakeAgent",
      "kind": "flow",
      "instructions": "Classify incoming documents and extract routing metadata.",
      "broker": "mainBroker",
      "tools": {
        "allow": ["DocumentStore.search", "DocumentStore.updateMetadata"]
      },
      "resources": {
        "allow": ["DocumentStore.currentDocument"]
      }
    },
    {
      "id": "reviewAgent",
      "kind": "application",
      "instructions": "Check whether processed documents are complete and ready for human review.",
      "broker": "mainBroker",
      "tools": {
        "allow": ["ReviewQueue.add", "DocumentStore.read"]
      },
      "resources": {
        "allow": ["DocumentStore.recentEvents", "ReviewQueue.pendingItems"]
      }
    }
  ],

  "policies": [
    {
      "id": "defaultSafeActions",
      "approval": {
        "requiredForEffects": ["document:delete", "external:send"]
      }
    }
  ]
}
```

The important design principle:

> The vmblu model defines what exists. The agent setup defines what agents may perceive, call, and decide.

That means the broker can derive most primitive capabilities automatically from the model:

```text
node input pins -> callable primitive tools
node output pins -> observable events
state/resource declarations -> readable resources
groups -> capability boundaries
profiles -> runtime/provider details
```

The `agentSetup` file then only answers questions the model cannot know by itself:

```text
Which agents exist?
Which broker do they use?
Which capabilities are allowed?
Which observations are visible?
Which actions require approval?
Which model/provider/instructions/memory settings apply?
```

I would avoid putting concrete tool definitions in the first version unless they are manually curated higher-level tools. Most entries should be references and policies.

So instead of:

```json
{
  "tool": "updateDocument",
  "binding": {
    "send": "DocumentStore.update"
  }
}
```

we should prefer automatic derivation:

```json
{
  "tools": {
    "allow": ["DocumentStore.update"]
  }
}
```

Later, when the user wants a stable business-level operation, they can define an explicit composed tool:

```json
{
  "tools": [
    {
      "id": "markDocumentReadyForReview",
      "description": "Validate required fields and add the document to the review queue.",
      "steps": [
        { "call": "DocumentStore.read" },
        { "call": "ReviewQueue.add" }
      ]
    }
  ]
}
```

But this should be optional, not the default burden.

On observability, I think we need to be stricter than “agents can inspect outputs.” We probably need three categories:

```text
tools      = things an agent may do
resources  = state an agent may read
events     = things an agent may observe over time
```

For vmblu this matters because a sent message does not naturally return a value. So the broker-agent interface should probably always be asynchronous at the conceptual level:

```text
agent calls tool
broker validates and dispatches action
broker returns call id / accepted / immediate result if available
agent observes events/resources
agent decides whether goal is satisfied
```

Even if the implementation sometimes gives a synchronous reply, the architecture should not depend on that.

For the model structure, I would lean toward:

```text
app.blu.json
app.agents.json
app.profile.json
generated artifacts
```

Where `app.blu.json` has only:

```json
"agentSetup": "./app.agents.json"
```

This gives us a clean migration path:

1. Existing vmblu apps remain unchanged.
2. Apps that want agents opt in with one linked file.
3. The broker derives primitive capabilities from the existing model.
4. Advanced users can add explicit tools, policies, resources, and agent definitions incrementally.

One additional thought: `agentSetup` should probably be allowed at both application and group level eventually.

At application level:

```json
"agentSetup": "./app.agents.json"
```

At group level:

```json
{
  "id": "DocumentWorkflow",
  "agentSetup": "./document-workflow.agents.json"
}
```

That would let reusable groups carry their own agent-facing contract without forcing the whole app to adopt one global agent layer. For a first version, though, application-level only is enough.

So my current recommendation is:

> Add an optional `agentSetup` reference to the vmblu model. The referenced file defines brokers, agents, policy, allowed tools/resources/events, and optional composed tools. It must reference the model instead of duplicating it. The broker derives primitives automatically from the graph, and explicit tool definitions remain an optional refinement.

## my comment

We are getting closer to a specification for how agents are integrated in vmblu applications. There are basically two ways: (1) embedded agents are like nodes and they fit in the application architecture. They have pins and are wired to other nodes. They provide specific services to the application. I am not sure if we should call these nodes 'agents' or something else. They will mostly be implemented in software (see the user interface example that we made in the solar-system example), but should we name them 'agent node' or something ? Personally I don't think so, but I just want to make sure that I am not overlooking anything, because often they will have a similar architecture, like having an MCP interface, need for an API key etc, so there might be things to standardize or streamline. (2) external agents are not part of the application but see it as a toolbox that they can use to obtain certain results. Agents can have an exposed interface to the user wher the user can enter what he wants to achieve, or they can be 'hidden' and receive partial or specific requests from other agents. External agents communicate via a standardised set of pins with a toolbox to discover tools etc. Agents have specific settings wrt what they can do, should not do etc. Agents are configured in a specific 'model-name.agents.json' file that is listed as the 'agents' property in the model file (I have chosen the name 'agents' iso 'agentSetup' because that aligns better with the names already used ('imports', 'factories', 'types', etc.) I don't think we need agents at the group node level, because an external agent is an entity that looks at the 'total picture' in order to achieve some goal, but I do think that the 'tool broker' entity should be available/created at the group node level so that it can be composed into the tool broker entity for the entire application. But I am not sure yet how we can do that. In our current workflow, we generate a file 'model-name.mcp.json' that should be the basis for our tool file. An MCP server node will still be able to extract from that file the mcp data that the mcp client needs to send to a specific LLM, so that our solar system example can still use the same setup. What do you think ?

## codex reply

I think this is a good split, and I would make it explicit in the terminology.

**1. Embedded LLM-powered nodes**

I would not call these “agent nodes” by default.

In vmblu terms, they are normal application nodes that happen to use an LLM/model internally. Their architectural role is still ordinary node behavior: receive messages, produce messages, participate in the graph.

Better names might be:

- `model node`
- `llm node`
- `ai node`
- `assistant node`
- or simply domain-specific names like `Translator`, `Classifier`, `Planner`, `PromptUI`

I would reserve **agent** for something with task autonomy: it receives a goal, decides which capabilities to use, evaluates progress, and can take multiple actions.

That distinction matters because otherwise every LLM call becomes an “agent”, and the word stops helping.

That said, vmblu can still standardize shared infrastructure for embedded LLM nodes:

```text
model/provider settings
API key profile binding
prompt/instructions
tool/MCP adapter support if needed
structured output schema
trace events
rate/error handling
```

So I would say:

> Embedded LLM-powered nodes are normal vmblu nodes. They may use a shared model-runtime/helper layer, but they are not necessarily agents.

If an embedded node truly does autonomous multi-step work inside the flow, then it can be called an agent-like node or maybe an `AgentWorker`, but I would not make that the default category.

**2. External agents**

Your external-agent definition feels right.

These are not part of the application’s message architecture in the same way. They look at the application through a controlled interface and use it as a toolbox.

So the model distinction becomes:

```text
nodes/factories/types/imports
  = application architecture

agents
  = external task actors and their permissions/context
```

Using `"agents"` in the model file instead of `"agentSetup"` is better. It fits vmblu naming style.

Example:

```json
{
  "name": "document-workflow",
  "imports": [...],
  "types": [...],
  "nodes": [...],
  "links": [...],
  "agents": "./document-workflow.agents.json"
}
```

Then `model-name.agents.json` defines:

```text
external agents
their model/provider settings
instructions
tool scopes
resource/event visibility
approval policy
memory/tracing/eval settings
```

**Tool Broker At Group Level**

I agree with your instinct: probably no group-level external agents for now, but group-level broker/capability metadata is valuable.

A reusable group can expose a local capability surface. The application broker can then compose those surfaces.

Conceptually:

```text
Group broker/capability surface
  exposes tools/resources/events for that group

Application broker
  imports/composes group capability surfaces
  applies app-level policy
  exposes final filtered toolbox to external agents
```

This preserves encapsulation. A group can say:

```text
These are the operations I expose.
These are the events/resources I make observable.
These internal pins are not agent-facing.
```

Then the application decides which of those capabilities an agent may use.

I would avoid making the group broker a full runtime “agent broker” at first. It can start as a generated/declared **capability surface**. The actual runtime broker can remain application-level.

So maybe:

```text
group capability surface = local metadata / generated registry
application tool broker = runtime authority
```

That keeps the first version simpler.

**Relationship To `model-name.mcp.json`**

I think the existing `model-name.mcp.json` should remain, but its meaning should shift slightly over time.

Current:

```text
model graph / pins / handler metadata
  -> model-name.mcp.json
  -> MCP server/client tooling
```

Future:

```text
model graph + group capability surfaces + optional agents/tool policy
  -> capability registry
  -> model-name.mcp.json
  -> MCP server/client tooling
```

The important point is that `model-name.mcp.json` can stay as a generated compatibility/export artifact. The solar-system example can continue to use it exactly as it does now.

But internally, vmblu should not think “MCP is the capability model.” Instead:

```text
vmblu capability registry
  -> MCP export
  -> OpenAI tools export
  -> internal agent/tool-broker interface
```

For the next step, I would define a minimal pipeline:

```text
.blu model
  declares "agents": "./model-name.agents.json"

compiler/runtime derives:
  primitive tools from input pins
  observable events from output pins
  optional resources from state/profile declarations
  group capability surfaces where available

generator emits:
  model-name.capabilities.json
  model-name.mcp.json
```

Then `model-name.mcp.json` remains what MCP nodes consume.

**Key Recommendation**

I would write the specification around three separate concepts:

```text
LLM-powered node
  A normal vmblu node that uses a model internally.

External agent
  A task actor configured in model-name.agents.json.

Tool broker / capability registry
  The defensive interface between external agents and the vmblu application.
```

This gives vmblu room to support powerful embedded AI behavior without making the whole application “agentic”, while also giving true external agents a clean and secure way to operate over the full application.

## my rephrasing

Yes, I think that is the right conclusion. (1) The LLM-powered node - or maybe more catchy 'ai-node' i sclear. For te moment we have nothing additional to define. We can simply define some conventions for such a node in the /cli/templates/x.y.z/annex.md later (x.y.z is the version number). (2) External agent or simply agent, is where we have to do the bulk of the work first. We have to define a schema, agent.schema.json, as part of the /cli/templates. We will add an icon to the main vertical menu to call up an agent canvas that will let a user define and setup the agent architecture of an application. We probably will also have to modify the runtime because the messaging between agents and the toolbroker and between agents themselves will probably be very different from the messaging between nodes. (3) 'tools' is an entry that we will add to the definition of a group node, so we will have to add it to the existing template blu.schema.json. The tools property is the basis for what the tool broker of an application will contain. The tools property is also what will allow the compiler to generate an mcp file for applications that would need it. In the current vmblu setup, a message handler is added to the mcp file if it has the doc tag 'mcp' in front of it. This will have to change: we will add a 'tools' icon to a group node (eg iso of the settings icon) to allow the user to change 'tools' settings for the group. For source nodes we will modify the 'profile' popup to set specific tool parameters for the input/output pin. What do you think of this ?

## Codex reply

I think this is the right shape, with one important refinement: `tools` on a group node should describe the **capability surface** of that group, not necessarily every low-level tool the application broker will expose.

So I would frame it like this:

**1. AI Node**

Yes: `ai-node` is clear enough, and I would keep it informal for now. It is a normal vmblu node that uses a model internally. No schema work yet. Later we can add conventions in `cli/templates/x.y.z/blu.annex.md` around provider config, API keys, structured output, tracing, etc.

**2. Agent**

Agreed: this is where the main work starts.

Adding `agent.schema.json` under `cli/templates/<version>/` makes sense. The model would reference it with:

```json
"agents": "./model-name.agents.json"
```

The agent canvas is also the right editor concept. It should probably visualize:

- agents
- their instructions/settings
- allowed tool scopes
- visible resources/events
- agent-to-agent communication paths
- broker access/policies

I also agree runtime changes are likely. Agent messaging should not be forced into ordinary node message semantics. Agents need task state, tool calls, observations, approvals, traces, maybe conversation state. That is adjacent to vmblu messaging, but not identical.

**3. Tools On Group Nodes**

Adding `tools` to group node definitions is a strong idea.

A group is the right architectural boundary to say:

```text
These operations/resources/events are intentionally exposed from this part of the application.
```

That gives the application-level broker something composable:

```text
group tools -> application tool broker -> agent-specific filtered toolbox
```

I would avoid making source-node handler doc tags the primary source of truth long-term. The current `@mcp` tag was fine as a quick bridge, but the new direction should move toward explicit tool metadata in the model/profile/editor.

The migration path could be:

1. Keep `@mcp` support as compatibility.
2. Generate initial tool entries from existing `@mcp` tags.
3. Let users edit group-level `tools`.
4. Eventually generate `model-name.mcp.json` from the group/application tool registry, not directly from handler tags.

For editor UX, your split sounds right:

- Group node gets a `tools` icon to configure the group capability surface.
- Source node/profile popup gets pin-level tool settings for input/output pins.
- Application agent canvas consumes those capabilities and scopes them per agent.

One nuance: I would not replace the settings icon with the tools icon. Tools are not general settings; they deserve their own affordance. If space is tight, maybe the group node has compact action icons where settings and tools are distinct.

**Schema Direction**

In `blu.schema.json`, group node `tools` might start small:

```json
"tools": {
  "expose": [
    {
      "id": "document.search",
      "pin": "search.input",
      "title": "Search documents",
      "description": "...",
      "effects": ["document:read"],
      "risk": "low"
    }
  ],
  "resources": [],
  "events": []
}
```

But I would keep the first schema minimal. The key is to support references to existing pins/resources without duplicating their schemas unless an override is needed.

So the principle becomes:

> Pin and type schemas remain in the vmblu model/profile. Group `tools` adds agent-facing intent, visibility, naming, policy hints, and broker composition metadata.

Also: I used the vmblu skill as requested by the framework context. This repo does not have `.vmblu/vmblu.prompt.md`, so I’m continuing cautiously from the local discussion and existing files.

## what to do first

What would be in your opinion the first logical step in getting this scaffolded: working on the tools definition first or starting from the agents point of view ? In my opinion tools definitions come first because they will define what an agent can do. When we have that we can look at how we allow agents use and report about these tools.

## Codex reply

I agree: start with **tools**, not agents.

The agent side depends on having a stable answer to:

```text
What can this application expose?
How is it named?
What is callable?
What is observable?
What effects/risk does it have?
How can it be exported to MCP?
```

Until that exists, an `agents` schema would mostly be speculative. We would end up defining agent permissions against concepts that are not stable yet.

The first logical scaffold should be:

```text
group tools definition
  -> compiler/tool registry
  -> generated model-name.mcp.json
  -> existing MCP path still works
```

That gives immediate value and keeps the work grounded.

I would break it down like this:

1. **Define minimal `tools` schema in `blu.schema.json`**
   Add `tools` to group nodes. Keep it small: expose input pins as callable tools, output pins/events as observable events, and maybe later resources.

2. **Define the internal capability/tool registry shape**
   This is probably not the same as MCP. It should be vmblu-native and then exportable.

3. **Change MCP generation to read from tools**
   Keep compatibility with current `@mcp` doc tags for now, but make the new `tools` section the preferred source.

4. **Add editor affordance later**
   The UI can edit the same `tools` data, but the schema/compiler should come first.

5. **Only then define `agent.schema.json`**
   At that point agents can reference real tool ids, scopes, effects, events, and policies.

The most important design choice for the first version is to avoid making users redefine what the model already knows. A tool entry should mainly add agent-facing metadata and exposure intent.

Something like:

```json
"tools": {
  "expose": [
    {
      "id": "simulation.start",
      "title": "Start simulation",
      "description": "Starts the simulation.",
      "pin": "SimulationClock.start",
      "effects": ["simulation:write"],
      "risk": "medium"
    }
  ]
}
```

The input schema should come from the pin/message type where possible.

So yes: **tools first**. Agents should be built on top of the tool surface, not designed in isolation.

## further thougths on tools

I have been thinking and I am still not clear about the tool definition: (1) group nodes are purely editor constructs, they have no runtime equivalent, so I think we have to define 'tools' at the level of the source node (2) getting rid of the @mcp doc tag will be easy: we can simply add a checkbox to the profile popup and set it if the pin needs to be included as a 'tool' (3) for every tool pin we need to have some description of the effect of teh tool so that the agent can reason about it. We probably also have to specify if the input message will result in output message(s) and when. (4) This brings us to the next problem: nodes are interconnected so an agent will have to reason about an action while looking at the architecture of teh application. Only in this way will he be able to understand the consequences. Is this possible with the current model file or generated application ?

## Codex reply

Yes, if group nodes have no runtime equivalent, then `tools` should not be primarily defined on groups. Groups can still help the editor organize or filter capabilities, but the real tool declaration should live where runtime behavior exists: **source node pins / node API profile**.

I would revise the model like this:

```text
source node input pin
  -> may be exposed as a tool

source node output pin
  -> may be exposed as an observable event/result

source node state/query capability, if any
  -> may be exposed as a resource
```

So the tool source of truth becomes the node profile, not the group.

**Tool Pin Metadata**

Replacing `@mcp` with profile metadata is the right move. A checkbox is the minimal UI:

```text
Expose as tool
```

But the checkbox alone is not enough. A useful tool needs at least:

```text
tool id/name
title
description
input pin reference
input schema/type, derived
effect description
effects/risk category
expected result behavior
observable outputs
timeout expectation
approval hint, later
```

The key missing part is result semantics. We need to tell the agent what happens after the input message is sent.

For example:

```json
{
  "tool": {
    "enabled": true,
    "id": "simulation.setTime",
    "title": "Set simulation time",
    "description": "Sets the simulation clock to the requested UTC timestamp.",
    "effects": ["simulation:write"],
    "result": {
      "mode": "event",
      "outputs": ["SimulationClock.state"],
      "correlation": "messageId",
      "timeoutMs": 2000,
      "description": "Emits the updated simulation clock state."
    }
  }
}
```

This keeps the tool definition attached to the input pin, while letting output pins describe what the agent can observe.

**Can The Agent Reason From The Architecture?**

Partly, but not enough from the current model alone.

The current model can probably tell an agent:

```text
nodes exist
pins exist
messages have schemas
links connect outputs to inputs
```

That is useful structural information, but it does not fully describe consequences.

A graph edge says:

```text
message from A goes to B
```

It does not say:

```text
B updates state
B emits event C after validation
B may reject invalid input
B triggers side effects
B eventually causes UI update
```

So an agent can reason about architecture only if we add a layer of **semantic metadata**.

I would not expect the agent to infer consequences reliably from graph topology alone. It may help, but it is too weak as a contract.

**What We Need**

I think the broker should expose three things to agents:

```text
tools
  callable input pins with descriptions and schemas

events
  observable output pins with descriptions and schemas

resources
  readable current state snapshots, where available
```

Then each tool should declare its expected relationship to events/resources:

```text
calling this tool usually causes these events
calling this tool updates this resource
calling this tool has no direct observable result
```

That is enough for a first useful model.

Example:

```json
{
  "id": "document.updateStatus",
  "input": "DocumentStore.setStatus",
  "description": "Changes a document status.",
  "effects": ["document:write"],
  "expects": {
    "events": ["DocumentStore.statusChanged"],
    "resources": ["DocumentStore.documentById"],
    "timeoutMs": 1000
  }
}
```

The agent does not need to understand every internal link. It needs a reliable contract:

```text
If I call this, this is what it is meant to do, and this is how I can check.
```

**Generated Application vs Model File**

The generated application may know runtime wiring, but it is the wrong primary source for agent reasoning. Agents should reason from a generated **capability description** derived from the model/profile metadata.

Something like:

```text
model + profiles
  -> capability registry
     tools
     events
     resources
     expected results
     graph context, optional
  -> mcp export
  -> agent broker runtime
```

The graph can be included as supporting context, but the tool contract should be explicit.

So my answer is:

> Yes, agents can use the architecture as context, but the current model file is not enough for robust consequence reasoning. We need tool/result/event/resource metadata at the source-node profile level, and the compiler should generate a capability registry that the broker and agents use.

That also keeps the user burden reasonable. The user does not define full scenarios. They mark pins as tools, describe the effect, and optionally link expected outputs/resources for verification.

## Chat gpt review

Your direction is basically right. The important thing is not to make “agents” the starting abstraction. The starting abstraction should be:

> **What can this application safely expose as intentional capabilities, and how can those capabilities be observed, verified, and constrained?**

Agents come after that.

My blunt assessment: **vmblu is a very natural fit for agents, but only if you resist the temptation to equate “agent access” with “pin access.”** Pins are too low-level. MCP tools are too protocol-specific. The right vmblu-native concept is a **capability surface** derived from the application architecture, enriched with just enough semantics for an agent to act and verify.

## 1. The core split is correct

I would keep these three concepts separate:

### 1. AI node

A normal vmblu source node that internally uses an LLM or model.

Examples:

```text
Translator
Classifier
PromptInterpreter
IntentExtractor
UIAssistant
Summarizer
```

These are **not necessarily agents**. They receive input messages, perform bounded work, and emit output messages.

Do not over-formalize this yet. Later, vmblu can define conventions for model/provider settings, API key references, structured output, tracing, etc. But for now, an AI node is just a node.

### 2. Agent

An agent is an autonomous or semi-autonomous actor that receives a task, chooses actions, calls tools, observes results, and decides whether the goal is complete.

This is different from an AI node. The key difference is not “uses an LLM”; the key difference is **task-directed agency**.

### 3. Tool broker / capability registry

This is the defensive layer between agents and the application.

It answers:

```text
What can the agent call?
What can the agent observe?
What is the input schema?
What is the expected effect?
How can success be verified?
What is forbidden?
What requires approval?
What happened during execution?
```

This is the piece that makes vmblu valuable for agents.

## 2. I agree: tools should start at source-node/profile level, not group level

Your correction is important.

If group nodes are editor/modeling constructs without runtime identity, then they should not be the primary source of executable tool definitions.

The real executable unit is:

```text
source node input pin
```

So the primitive tool definition should live close to the source node API/profile.

A source node input pin can be marked as:

```text
exposable as tool
```

A source node output pin can be marked as:

```text
observable as event/result
```

A state/query interface, if present, can be marked as:

```text
readable resource
```

That gives you a clean primitive model:

```text
input pins  -> tools
output pins -> events
state/query -> resources
```

This is the right foundation.

## 3. But groups still matter as capability surfaces

Even if groups do not exist at runtime, they are still extremely useful architecturally.

A group can define or aggregate a **capability surface**, not execute tools itself.

For example:

```json
{
  "group": "DocumentWorkflow",
  "tools": {
    "include": [
      "DocumentStore.search",
      "DocumentStore.updateStatus",
      "ReviewQueue.add"
    ],
    "events": [
      "DocumentStore.statusChanged",
      "ReviewQueue.itemAdded"
    ],
    "resources": [
      "DocumentStore.currentDocument"
    ]
  }
}
```

This does not mean the group executes anything. It means:

> This architectural subsystem intentionally exposes these capabilities.

Then the application-level broker can compose these group surfaces.

So I would use this hierarchy:

```text
source pin metadata
  = primitive executable capability

group tools/capability surface
  = curated subsystem-level exposure

application capability registry
  = composed global toolbox

agent config
  = filtered permissions over the global toolbox
```

That gives you both runtime correctness and architectural clarity.

## 4. The biggest missing concept is not “tool”; it is “expected observation”

You already identified the key problem: vmblu messages do not naturally return values.

This is central.

In ordinary function calling, a tool has a return value:

```js
const result = await tool(args)
```

In vmblu, a message may trigger:

```text
an output message
a state change
a UI update
a log event
a later asynchronous event
nothing directly observable
```

Therefore a vmblu tool definition must not only say:

```text
call this input pin
```

It must also say:

```text
what should happen next
how the agent can observe it
how long it should wait
what counts as success or failure
```

A minimal tool metadata shape should include something like:

```json
{
  "enabled": true,
  "id": "simulation.setTime",
  "title": "Set simulation time",
  "description": "Sets the simulation clock to the requested UTC timestamp.",
  "input": "setTime@SimulationClock",
  "effects": ["simulation:write"],
  "risk": "medium",
  "expects": {
    "events": ["stateChanged@SimulationClock"],
    "resources": ["simulation.currentState"],
    "timeoutMs": 2000,
    "description": "The clock emits an updated state containing the new simulation time."
  }
}
```

The `expects` section is vital. Without it, agents are blind.

This is probably the most important addition to the vmblu model for agent-readiness.

## 5. Do not expect the agent to infer consequences from topology alone

The graph helps, but it is not enough.

A route tells the agent:

```text
output A connects to input B
```

It does not reliably tell the agent:

```text
B mutates state
B may reject the payload
B emits an event later
B causes a UI repaint
B triggers an external side effect
B silently ignores invalid data
```

So topology is useful context, but not a sufficient semantic contract.

The capability registry should expose explicit semantics:

```text
Tool: what the agent can do
Event: what the agent can observe
Resource: what the agent can read
Expectation: how a tool normally changes events/resources
Policy: what is allowed, risky, or approval-gated
```

That is the agent-facing contract.

## 6. I would not start with scenarios

I agree with your instinct to avoid burdening users with scenario definitions too early.

A first implementation should not require users to describe:

```text
send this, wait for that, then call this, then validate this
```

That becomes a workflow engine very quickly.

Instead, start with primitive capabilities plus expectations.

First version:

```text
input pin can be exposed as tool
output pin can be exposed as event
state/query can be exposed as resource
tool can declare expected events/resources
broker validates input and records execution
MCP file generated from capability registry
```

Only later add composed tools/scenarios.

Composed tools should be optional, useful when the application author wants to expose a stable high-level operation:

```text
markDocumentReadyForReview
startSimulationAndFocusEarth
importFileAndExtractMetadata
```

But the default should remain lightweight.

## 7. The generated artifact should probably be `model-name.capabilities.json`

I would avoid making `model-name.mcp.json` the central generated artifact.

Instead:

```text
model + profile metadata
  -> model-name.capabilities.json
  -> model-name.mcp.json
  -> provider-specific tool formats
  -> broker runtime registry
```

So the MCP file remains a compatibility/export artifact.

The vmblu-native artifact is the capability registry.

Something like:

```text
model-name.mod.blu
model-name.mod.viz
model-name.app.prf
model-name.capabilities.json
model-name.mcp.json
model-name.agents.json
```

Or using your compact style later:

```text
model.mod.blu
model.mod.viz
model.app.prf
model.app.cap
model.app.mcp
model.agents.json
```

But conceptually, I would keep this distinction:

```text
capabilities = vmblu-native
mcp = exported protocol view
agents = actor configuration
```

## 8. `model-name.agents.json` should come after capabilities

I agree with your current conclusion: **tools/capabilities first, agents second.**

The agents file should not define what the application can do. It should define what specific agents are allowed to see and use.

For example:

```json
{
  "version": 1,
  "agents": [
    {
      "id": "reviewAgent",
      "kind": "external",
      "instructions": "Check documents for completeness before review.",
      "broker": "main",
      "tools": {
        "allow": [
          "document.read",
          "document.updateStatus",
          "reviewQueue.add"
        ]
      },
      "events": {
        "allow": [
          "document.statusChanged",
          "reviewQueue.itemAdded"
        ]
      },
      "resources": {
        "allow": [
          "document.current",
          "reviewQueue.pending"
        ]
      }
    }
  ],
  "policies": [
    {
      "id": "default",
      "approvalRequiredForEffects": [
        "external:send",
        "document:delete"
      ]
    }
  ]
}
```

The agents file should reference capability IDs generated from the model/profile. It should not duplicate schemas, pin definitions, or graph structure.

## 9. The profile popup is the right first UI

Your proposed UI path is good:

### Source node / profile popup

For input pins:

```text
[ ] Expose as tool
Tool id
Title
Description
Effect
Risk
Expected event/resource
Timeout
Approval hint
```

For output pins:

```text
[ ] Expose as observable event
Event id
Description
Payload meaning
```

For state/query interfaces, later:

```text
[ ] Expose as resource
Resource id
Description
Read semantics
```

### Group node tools icon

Use this for capability curation/aggregation:

```text
Which primitive tools/events/resources from inside this group are part of the group’s public capability surface?
```

### Agent canvas

Later, use this to define:

```text
agents
tool permissions
resource/event visibility
policies
agent-to-agent communication
broker settings
```

This is a good progression. Do not start with the agent canvas. Start with pin-level capability metadata and capability generation.

## 10. The tool broker should not be “just another node”

This is subtle.

The broker may be implemented as a node for compatibility with the runtime, but conceptually it is not just a normal business node. It is a runtime authority.

It needs to do things ordinary nodes do not normally do:

```text
inspect capability registry
validate schemas
enforce policy
dispatch messages
watch events
correlate tool calls
record traces
apply timeouts
possibly request approval
possibly block dangerous operations
```

So I would define it as a **runtime service with node-facing adapters**, not merely a node.

In the graph/editor it can appear as a node-like thing, but architecturally it is closer to:

```text
runtime capability gateway
```

This matters because the broker will need privileged knowledge of the graph and runtime events.

## 11. The broker-agent interface should be asynchronous

Even if some tools can return immediate results, the conceptual interface should be async.

Something like:

```text
agent -> broker: list capabilities
agent -> broker: call tool
broker -> agent: accepted / rejected / callId
broker -> graph: dispatch message
graph -> broker: observed events/resources
broker -> agent: tool observation/result
broker -> trace: record execution
```

This fits vmblu better than pretending every tool is a synchronous function.

The broker can still expose synchronous-looking MCP tools when needed, but internally it should treat tool execution as:

```text
call + observe + conclude
```

Not:

```text
call + return
```

## 12. Concrete first scaffold

I would implement in this order.

### Step 1: Replace `@mcp` with pin-level tool metadata

Do not remove `@mcp` yet. Keep it as migration input.

Add profile/model metadata equivalent to:

```json
{
  "input": "setTime",
  "kind": "input",
  "profile": "...",
  "tool": {
    "enabled": true,
    "id": "simulation.setTime",
    "title": "Set simulation time",
    "description": "Sets the simulation clock to a UTC timestamp.",
    "effects": ["simulation:write"],
    "risk": "medium",
    "expects": {
      "events": ["stateChanged@SimulationClock"],
      "timeoutMs": 2000
    }
  }
}
```

### Step 2: Add observable metadata to output pins

Example:

```json
{
  "output": "stateChanged",
  "kind": "output",
  "profile": "...",
  "event": {
    "enabled": true,
    "id": "simulation.stateChanged",
    "description": "Emitted when the simulation clock state changes."
  }
}
```

### Step 3: Generate `model-name.capabilities.json`

This should contain normalized, vmblu-native capability data:

```json
{
  "version": 1,
  "tools": [],
  "events": [],
  "resources": [],
  "graphRefs": []
}
```

### Step 4: Generate `model-name.mcp.json` from capabilities

Not from `@mcp` directly.

For now:

```text
@mcp tag -> imported into capability metadata -> mcp export
```

Later:

```text
tool metadata -> capability registry -> mcp export
```

### Step 5: Build minimal broker

First broker only needs to:

```text
list tools
validate input
send message to input pin
wait for configured event if any
return observed result or timeout
record trace
```

No full agent system yet.

### Step 6: Only then design `model-name.agents.json`

At that point the agents schema has real things to reference.

## 13. My recommended terminology

I would use:

```text
AI node
```

For normal LLM-powered source nodes.

```text
Agent
```

For task-directed external or semi-external actors.

```text
Capability
```

For the vmblu-native umbrella concept.

```text
Tool
```

For callable capabilities.

```text
Event
```

For observable output capabilities.

```text
Resource
```

For readable state/context capabilities.

```text
Broker
```

For the runtime authority that exposes capabilities to agents.

This vocabulary is clean and future-proof.

## 14. The strategic conclusion

The natural fit between vmblu and agents is not that “agents can call node pins.”

That is useful, but too primitive.

The natural fit is this:

> vmblu already describes software as explicit message-passing architecture. By adding capability metadata — tools, events, resources, expectations, and policies — vmblu can give agents a controlled, inspectable, testable interface to real applications.

That is powerful.

It means vmblu can become the layer that answers the core agentic-software question:

> What is this agent allowed to do, through which architectural boundary, with what expected effect, and how do we know whether it worked?

That is exactly where vmblu can be stronger than ad hoc MCP wiring, raw function calling, or ordinary generated code.

## My remarks

I think your last question hits the nail on the head: "What is this agent allowed to do, through which architectural boundary, with what expected effect, and how do we know whether it worked?". The first part is reasonably straightforward: starting from input pins and messages, we can define what an agent  can do, is allowed to do etc. It will require a bit of experimenting, but it is conceptually clear. The second part is more challenging: we cannot just use output pins as results. An output pin is often just a node getting some data to accomplish something or a node taken up its role in the bigger scheme of things. Often the results that matter will not leave the node and for example result in screen updates, a file being saved etc. A reply or an output from a pin can be useful for an agent to check a result, but is of limited value. I have been thinking about a new idea - very vague still - that I would call a 'probe' or 'effect' and that can be inspected by an agent in some way. A second thing I have been thinking about is how opaque the architecture of a vmblu application has to be. On the one hand I think an agent doesn't have to know the internals, on the other hand I think it might help in understanding an app and getting the most out of it. What do you think ?

## chatGPT 5.5 answer

Yes. This is exactly the hard part.

The first half of the agent interface is relatively easy:

> **Allowed action** = “agent may send this message to this input pin with this schema under this policy.”

The second half is the real design problem:

> **Observed effect** = “after the action, what changed in the world, and how can the agent inspect that change?”

And I agree: output pins are not enough.

## 1. Output pins are not results

A vmblu output pin means:

> this node emits a message into the graph.

It does **not** necessarily mean:

> this is the semantic result of the action.

Sometimes it is. Often it is not.

For example, if an agent calls:

```text
focusPlanet@CameraController
```

the meaningful result may be:

```text
the camera now shows Mars
the UI label changed
the render loop uses a new target
the selected planet state changed
```

But none of those may be emitted as a clean output message.

So I would avoid designing the agent system around:

```text
tool call -> output pin result
```

That is too function-call-like and does not fit vmblu’s architecture.

The better model is:

```text
tool call -> expected effect -> observable verification
```

## 2. “Probe” is probably the right concept

Your instinct toward a **probe** is strong.

I would define a probe as:

> A declared, read-only observation point that lets an agent inspect some meaningful state or effect of the application.

A probe is not a normal message pin. It is not part of the application flow. It exists for inspection, verification, testing, tracing, and agent reasoning.

Examples:

```text
current selected planet
current camera target
current simulation time
last saved filename
document status
visible UI route
current form validation state
last error
recent tool trace
rendered object count
```

A probe answers:

```text
What is true now?
```

Whereas a tool answers:

```text
What may I do?
```

That gives you the pair you need:

```text
Tool  = controlled action
Probe = controlled observation
```

This is probably cleaner than calling it “effect”, because “effect” is the thing that happens, while “probe” is the mechanism by which the effect is inspected.

## 3. I would distinguish effect from probe

I would use both terms, but for different roles.

### Effect

An **effect** is the semantic consequence a tool is expected to have.

Example:

```json
{
  "effect": "camera.focus.targetChanged"
}
```

It describes intent:

```text
Calling this tool should change the camera target.
```

### Probe

A **probe** is how that effect can be verified.

Example:

```json
{
  "probe": "camera.currentTarget"
}
```

It describes inspection:

```text
Read this to check what the camera target currently is.
```

So a tool definition might say:

```json
{
  "id": "camera.focusPlanet",
  "input": "focusPlanet@CameraController",
  "description": "Focuses the camera on a named planet.",
  "effects": [
    {
      "id": "camera.focus.targetChanged",
      "description": "The active camera target changes to the requested planet.",
      "verifyWith": ["camera.currentTarget"],
      "successWhen": {
        "probe": "camera.currentTarget",
        "equalsInput": "planetName"
      }
    }
  ]
}
```

This is extremely valuable for agents, testing, and human inspection.

## 4. Probes should be first-class, but read-only

I would make probes first-class in the capability layer, alongside tools.

Something like:

```text
tools   = things an agent may do
probes  = things an agent may inspect
events  = things an agent may subscribe to or observe over time
```

That gives you three orthogonal concepts:

```text
Tool  -> action
Probe -> state inspection
Event -> temporal observation
```

A probe should be:

```text
read-only
typed
named
described
policy-controlled
possibly scoped per agent
```

Example:

```json
{
  "id": "simulation.currentTime",
  "source": "SimulationClock",
  "kind": "state",
  "description": "Current simulation time in UTC.",
  "schema": {
    "type": "object",
    "properties": {
      "isoUtc": { "type": "string" },
      "timeScale": { "type": "number" }
    }
  }
}
```

The agent does not need to know how the state is stored internally. It only needs the declared probe.

## 5. Probes can be implemented in several ways

A probe does not have to map to one implementation mechanism.

It could be backed by:

```text
a node state getter
a runtime-inspected value
a DOM/UI inspection hook
a file existence/hash check
a recent event log query
a renderer/canvas state summary
a test harness assertion
a database query
a custom handler
```

For example:

```json
{
  "id": "ui.activePanel",
  "kind": "dom",
  "description": "The currently visible main UI panel.",
  "binding": {
    "selector": "[data-vmblu-active-panel]",
    "read": "textContent"
  }
}
```

Or:

```json
{
  "id": "file.lastSaved",
  "kind": "filesystem",
  "description": "The most recently saved project file.",
  "binding": {
    "node": "ProjectSaver",
    "getter": "getLastSavedFile"
  }
}
```

Or:

```json
{
  "id": "camera.currentTarget",
  "kind": "nodeState",
  "description": "The object currently targeted by the active camera.",
  "binding": {
    "node": "CameraController",
    "getter": "currentTarget"
  }
}
```

This is where vmblu becomes powerful: a probe gives the agent an intentional observation surface without exposing arbitrary internals.

## 6. “Effect” metadata should connect tools to probes

A tool should not merely have a description. It should declare expected effects.

Minimal version:

```json
{
  "id": "simulation.setTime",
  "input": "setTime@SimulationClock",
  "description": "Sets the simulation time.",
  "effects": [
    {
      "description": "The current simulation time changes to the requested timestamp.",
      "verifyWith": ["simulation.currentTime"],
      "timeoutMs": 1000
    }
  ]
}
```

More advanced later:

```json
{
  "success": {
    "probe": "simulation.currentTime.isoUtc",
    "equalsInput": "isoUtc"
  }
}
```

You do not need to solve the full assertion language immediately. Start with:

```text
plain-language effect description
list of verification probes
optional timeout
optional correlation/event
```

Later you can add machine-checkable assertions.

## 7. This also solves testing

This concept is not only useful for agents.

It gives vmblu a proper test model:

```text
call tool
read probe
compare expected state
record trace
```

That is much stronger than:

```text
send message
hope output pin emits something
```

So the same layer can serve:

```text
agents
tests
debugging
security audits
human inspection
runtime traces
```

That is a very good sign architecturally. It means the abstraction is probably real, not just agent-specific scaffolding.

## 8. Should agents see the internal architecture?

My answer: **yes, but as optional context, not as authority.**

The agent should primarily operate through the capability surface:

```text
tools
probes
events
policies
effects
```

That is the contract.

The internal graph can be exposed at different levels depending on trust, task, and agent role.

I would think in three levels.

### Level 1: Opaque application

The agent sees only:

```text
available tools
available probes
available events
instructions
policies
```

This is safest and simplest.

Good for:

```text
external agents
user-facing agents
untrusted agents
general task assistants
```

### Level 2: Architectural overview

The agent also sees:

```text
groups
nodes
pin descriptions
high-level routes
capability ownership
```

This helps the agent understand the system without exposing every implementation detail.

Good for:

```text
developer agents
debugging agents
test agents
documentation agents
```

### Level 3: Full internal inspection

The agent sees:

```text
full graph
profiles
source locations
handler docs
runtime traces
possibly code
```

Good for:

```text
coding agents
maintenance agents
security agents
refactoring agents
```

So the answer is not one-size-fits-all. vmblu should support visibility scopes.

## 9. Do not hide architecture from developer agents

For ordinary user-facing agents, architecture can be mostly opaque.

But for development-oriented agents, vmblu’s explicit architecture is a major advantage. You should exploit it.

A coding/debugging agent should be able to inspect:

```text
this tool maps to this pin
this pin belongs to this node
this node sends these outputs
these routes propagate the message
these probes verify the resulting state
this source handler implements the behavior
```

That is exactly what makes vmblu agent-native.

So I would distinguish:

```text
operational agent
  uses the app

development agent
  understands/modifies/tests the app
```

The operational agent gets a toolbox.
The development agent gets the architecture.

## 10. I would add `probes` to the capability model before `agents`

Your current likely progression should become:

```text
1. tool metadata on input pins
2. event metadata on output pins
3. probe metadata for inspectable state/effects
4. generated capability registry
5. MCP export from tools
6. minimal broker that can call tools and read probes
7. agents schema
```

The addition of probes should happen before serious agent work.

Without probes, agents can act but not reliably verify.

## 11. Possible schema direction

At source node level:

```json
{
  "source": "CameraController",
  "pins": [
    {
      "input": "focusPlanet",
      "kind": "input",
      "profile": "Focuses the active camera on a planet.",
      "tool": {
        "enabled": true,
        "id": "camera.focusPlanet",
        "title": "Focus planet",
        "description": "Changes the active camera target to the requested planet.",
        "effects": [
          {
            "id": "camera.targetChanged",
            "description": "The active camera target becomes the requested planet.",
            "verifyWith": ["camera.currentTarget"],
            "timeoutMs": 1000
          }
        ]
      }
    }
  ],
  "probes": [
    {
      "id": "camera.currentTarget",
      "title": "Current camera target",
      "description": "The planet or object currently targeted by the active camera.",
      "kind": "state",
      "schema": {
        "type": "object",
        "properties": {
          "targetId": { "type": "string" },
          "targetName": { "type": "string" }
        }
      }
    }
  ]
}
```

The implementation binding for the probe could live in the profile file rather than the blueprint if you want to keep the model clean:

```json
{
  "node": "CameraController",
  "probes": [
    {
      "id": "camera.currentTarget",
      "binding": {
        "kind": "getter",
        "handler": "getCurrentTarget",
        "file": "src/CameraController.js",
        "line": 142
      }
    }
  ]
}
```

That separation feels vmblu-consistent:

```text
blueprint says what exists architecturally
profile says where/how it is implemented
```

## 12. Probe vs resource

Earlier I used the word `resource`. I now think your word `probe` may be better for vmblu.

`resource` sounds like a static thing an agent reads.

`probe` sounds like an intentional inspection point into a live system.

That fits vmblu better.

I would perhaps use this vocabulary:

```text
tool  = callable action
event = emitted occurrence
probe = inspectable current condition/state/effect
```

Then later, if you need “resource”, it can be a subtype of probe:

```text
resource probe
DOM probe
state probe
file probe
trace probe
visual probe
```

## 13. “Effect” may become the semantic glue

A mature vmblu capability registry could look like this:

```text
tools:
  camera.focusPlanet

effects:
  camera.targetChanged

probes:
  camera.currentTarget

events:
  camera.focusChanged
```

Where:

```text
tool declares expected effects
effects declare verification probes/events
probes provide current truth
events provide temporal evidence
```

But for the first version, I would not make `effects` a separate top-level concept yet. I would embed effects inside tool metadata.

Start simple:

```json
"tool": {
  "effects": [
    {
      "description": "...",
      "verifyWith": ["..."]
    }
  ]
}
```

Later, if effects become reusable, promote them to first-class objects.

## 14. The architecture should be selectively transparent

Final answer to your opacity question:

> The application should be opaque at the execution boundary, but transparent at the explanation/debugging boundary.

Meaning:

An agent should not be allowed to bypass tools and directly manipulate arbitrary internals just because it can see the graph.

But it may be allowed to inspect architecture to understand what the tools mean.

So:

```text
authority comes from tools/probes/policies
understanding may come from architecture
```

That is the clean rule.

The agent can know:

```text
camera.focusPlanet calls CameraController.focusPlanet
CameraController is connected to Renderer
Renderer updates the canvas
camera.currentTarget verifies the effect
```

But the agent is still only allowed to act through:

```text
camera.focusPlanet
```

and inspect through:

```text
camera.currentTarget
```

This preserves security while using vmblu’s architectural explicitness.

## 15. My recommended formulation

I would define the agent-facing capability model like this:

> A vmblu application exposes itself to agents through a capability surface. The capability surface consists of tools, events, and probes. Tools are controlled actions, events are observable occurrences, and probes are read-only inspection points into meaningful application state or effects. A tool may declare expected effects and identify the probes or events that can verify those effects. Agents may use the internal architecture as explanatory context, but their authority is limited to the capabilities granted by the broker.

That feels like the concept you are looking for.

The key new word is indeed probably:

```text
probe
```

Not output pin. Not result. Not resource. Probe.

## My next prompt
Clear. Up to now I was thinking in terms of 'how can I implement this in vmblu', but the first question I have to solve is this: 'how can I provide the best possible capability surface to an agent ?'. Taking into account standards and how the major players are thinking about agent interfaces, what would an ideal 'document' for an agent look like to get it work efficiently with an application ?

## Chat gpt reply

Yes. That is the right reframing.

The question is no longer:

> How do I expose vmblu pins to an agent?

The question is:

> What is the best possible **operating manual** for an agent that needs to use this application safely and efficiently?

The answer is: not just an MCP tool list. The ideal document is a **capability manifest**: a compact, structured, agent-facing description of what the application can do, what the agent may do, how to observe effects, and how to recover from failure.

Current standards point in that direction. MCP defines tools, resources, prompts/workflows, input schemas, and structured tool outputs; OpenAI’s Agents SDK treats tools broadly, including function tools, hosted tools, MCP servers, and agents-as-tools; Anthropic’s tool guidance stresses meaningful tool names, efficient tool descriptions, useful returned context, tool search, examples, and avoiding overwhelming the model with too many raw tool definitions. ([Model Context Protocol][1])

So for vmblu, I would define a generated file something like:

```text
model-name.capabilities.json
```

or, more explicitly:

```text
model-name.agent.manifest.json
```

I slightly prefer **capabilities** as the internal vmblu artifact, because it is not tied to one kind of agent.

## The ideal agent document

The document should contain seven things.

```text
1. Application identity
2. Operational contract
3. Tools
4. Probes
5. Events
6. Policies
7. Usage guidance and examples
```

That is the minimum useful shape.

## 1. Application identity

The agent needs a short description of what the application is, what domain it operates in, and what kind of tasks it can support.

Example:

```json
{
  "application": {
    "id": "solar-system",
    "title": "Solar System Simulation",
    "description": "Interactive 3D simulation of the solar system with controllable time, camera views, planet selection, and UI overlays.",
    "version": "0.1.0"
  }
}
```

This gives the agent domain orientation.

## 2. Operational contract

This is the “how to use this app” section. It should be short, but extremely explicit.

Example:

```json
{
  "operationalContract": {
    "interactionModel": "asynchronous-tool-call-with-probes",
    "principles": [
      "Use tools to change application state.",
      "Use probes to verify state after tool calls.",
      "Use events for recent activity and temporal feedback.",
      "Do not assume a tool succeeded unless a probe or event confirms the expected effect."
    ],
    "defaultVerification": {
      "required": true,
      "preferredOrder": ["probe", "event", "toolResult"]
    }
  }
}
```

This matters because vmblu is not naturally a function-call system. The agent must understand:

```text
tool call does not automatically mean semantic success
```

This section tells it how to behave.

## 3. Tools

Tools are controlled actions.

A tool definition should be more than:

```text
name + input schema
```

Modern tool systems already emphasize schema, structured outputs, and descriptions; MCP specifically supports input schemas and structured output schemas, and Anthropic notes that schema alone is not enough because agents also need usage patterns and conventions. ([Model Context Protocol][2])

A vmblu tool should therefore include:

```text
id
title
description
input schema
optional immediate output schema
binding reference
effects
risk
authorization/approval metadata
expected verification
failure behavior
examples
```

Example:

```json
{
  "tools": [
    {
      "id": "simulation.setTime",
      "title": "Set simulation time",
      "description": "Sets the simulation clock to a specific UTC timestamp.",
      "category": "simulation",
      "input": {
        "vmbluPin": "setTime@SimulationClock",
        "schema": {
          "type": "object",
          "properties": {
            "isoUtc": {
              "type": "string",
              "description": "UTC timestamp in ISO 8601 format."
            },
            "timeScale": {
              "type": "number",
              "description": "Simulation speed multiplier."
            }
          },
          "required": ["isoUtc"]
        }
      },
      "effects": [
        {
          "id": "simulation.timeChanged",
          "description": "The current simulation time changes to the requested UTC time.",
          "verifyWith": {
            "probes": ["simulation.currentTime"],
            "events": ["simulation.timeChanged"]
          },
          "successHint": "Read simulation.currentTime and compare isoUtc with the requested isoUtc.",
          "timeoutMs": 1000
        }
      ],
      "risk": "low",
      "effectsClass": ["simulation:write"],
      "approval": "never",
      "examples": [
        {
          "goal": "Set the simulation to 1 January 2030.",
          "input": {
            "isoUtc": "2030-01-01T00:00:00Z"
          },
          "thenVerify": [
            "Read simulation.currentTime.",
            "Check that isoUtc is 2030-01-01T00:00:00Z."
          ]
        }
      ]
    }
  ]
}
```

This is much richer than an MCP tool declaration, but it can still be exported to MCP or OpenAI/Anthropic tool formats.

## 4. Probes

This is the part vmblu needs that most generic tool standards do not fully solve.

A **probe** is a read-only inspection point. It tells the agent what it can check.

Example:

```json
{
  "probes": [
    {
      "id": "simulation.currentTime",
      "title": "Current simulation time",
      "description": "Returns the current UTC simulation time and active time scale.",
      "kind": "state",
      "schema": {
        "type": "object",
        "properties": {
          "isoUtc": { "type": "string" },
          "timeScale": { "type": "number" },
          "running": { "type": "boolean" }
        },
        "required": ["isoUtc", "running"]
      },
      "readPolicy": {
        "cost": "cheap",
        "sideEffects": false
      }
    },
    {
      "id": "camera.currentTarget",
      "title": "Current camera target",
      "description": "Returns the planet or object currently targeted by the active camera.",
      "kind": "state",
      "schema": {
        "type": "object",
        "properties": {
          "targetId": { "type": "string" },
          "targetName": { "type": "string" }
        }
      }
    }
  ]
}
```

This is the key vmblu addition.

Generic standards often talk about tools and resources. MCP, for example, describes connecting agents to data sources, tools, apps, and workflows. ([Model Context Protocol][1]) But for vmblu, **probe** is the better term because the agent is inspecting a live application, not merely fetching a document or static resource.

## 5. Events

Events are observable occurrences. They are not the same as probes.

A probe says:

```text
What is true now?
```

An event says:

```text
What just happened?
```

Example:

```json
{
  "events": [
    {
      "id": "simulation.timeChanged",
      "source": "stateChanged@SimulationClock",
      "description": "Emitted when the simulation clock time or time scale changes.",
      "schema": {
        "type": "object",
        "properties": {
          "isoUtc": { "type": "string" },
          "timeScale": { "type": "number" }
        }
      }
    },
    {
      "id": "camera.targetChanged",
      "source": "targetChanged@CameraController",
      "description": "Emitted when the active camera target changes."
    }
  ]
}
```

Events are useful for asynchronous behavior, but they should not be the only verification mechanism. For agents, probes are usually more reliable because they represent current truth.

## 6. Policies

The agent must know not only what exists, but what it may do.

Policies should be included in the capability document or resolved into an agent-specific view.

Example:

```json
{
  "policies": {
    "riskLevels": ["low", "medium", "high"],
    "approval": {
      "requiredForEffects": ["file:write", "external:send", "system:execute"],
      "neverRequiredForEffects": ["simulation:read", "simulation:write"]
    },
    "limits": {
      "maxToolCallsPerTask": 25,
      "maxConsecutiveFailures": 3
    },
    "failurePolicy": {
      "onTimeout": "read relevant probes before retrying",
      "onValidationError": "repair arguments once, then report failure",
      "onPolicyDenied": "do not retry; explain the denied action"
    }
  }
}
```

This is where vmblu can be much stronger than a normal API description.

The document should make it very hard for an agent to misunderstand what is safe, risky, or forbidden.

## 7. Usage guidance and examples

This is not optional.

Anthropic’s recent tool guidance explicitly says agents need examples and usage patterns, not only schema definitions; it also warns that too many raw tool definitions create context cost and wrong-tool selection problems. ([Anthropic][3])

So the ideal vmblu document should include short examples.

Example:

```json
{
  "usageGuidance": {
    "toolSelection": [
      "Prefer high-level tools over low-level tools when both are available.",
      "After any state-changing tool, verify using the probe listed in the tool's effects.",
      "Do not call multiple write tools in parallel unless the tools explicitly allow it."
    ],
    "examples": [
      {
        "task": "Focus the camera on Mars.",
        "steps": [
          {
            "call": "camera.focusPlanet",
            "input": { "planet": "Mars" }
          },
          {
            "readProbe": "camera.currentTarget"
          },
          {
            "successCondition": "camera.currentTarget.targetName == 'Mars'"
          }
        ]
      }
    ]
  }
}
```

This is crucial because schemas only describe valid structure. They do not fully describe good behavior.

## The ideal document should have two forms

There should be a **complete manifest** and an **agent-specific manifest**.

### Complete manifest

Generated from the whole vmblu application:

```text
model-name.capabilities.json
```

Contains everything the application can expose.

### Agent-specific manifest

Generated or filtered for one agent:

```text
model-name.agent.reviewAgent.capabilities.json
```

Contains only what that agent is allowed to see and use.

This matters because major platforms are moving away from loading giant tool lists into the model context. Anthropic has explicitly described tool-search and programmatic tool-calling approaches to avoid loading every tool definition up front, because large tool lists consume context and increase wrong-tool/parameter errors. ([Anthropic][3])

For vmblu, that means the broker should be able to provide:

```text
discover capabilities
search capabilities
load details for selected capability
call capability
read probe
observe events
```

Not just dump every tool into the prompt.

## The document should be layered

I would use this structure:

```json
{
  "schema": "https://vmblu.dev/schemas/capabilities.v1.json",
  "application": {},
  "operationalContract": {},
  "namespaces": [],
  "tools": [],
  "probes": [],
  "events": [],
  "effects": [],
  "policies": {},
  "architectureContext": {},
  "usageGuidance": {},
  "exports": {}
}
```

The most important parts are:

```text
tools
probes
events
effects
policies
usageGuidance
```

The `architectureContext` should be optional and summarized.

## Architecture visibility

I would not put the full vmblu graph in the default agent document.

The default agent document should expose:

```text
capability surface, not implementation internals
```

But it should include enough architecture context to help the agent choose correctly.

Example:

```json
{
  "architectureContext": {
    "visibility": "summary",
    "groups": [
      {
        "id": "Simulation",
        "description": "Controls time, orbital calculations, and simulation state.",
        "capabilities": [
          "simulation.setTime",
          "simulation.start",
          "simulation.pause",
          "simulation.currentTime"
        ]
      },
      {
        "id": "Camera",
        "description": "Controls active viewpoint and target selection.",
        "capabilities": [
          "camera.focusPlanet",
          "camera.currentTarget"
        ]
      }
    ]
  }
}
```

For a development agent, you can expose more:

```json
{
  "architectureContext": {
    "visibility": "developer",
    "includeGraph": true,
    "includeRoutes": true,
    "includeSourceLocations": true,
    "includeProfiles": true
  }
}
```

So I would make visibility configurable:

```text
opaque       = tools/probes/events only
summary      = tools/probes/events plus subsystem overview
developer    = full graph/profile/source references
```

The rule remains:

> Visibility gives understanding. Authority comes only from tools, probes, events, and policies.

## The document should optimize for agent behavior, not human completeness

A normal API document tries to be complete.

An agent capability document should be:

```text
selective
high-signal
structured
action-oriented
verification-oriented
policy-aware
example-rich
```

Anthropic’s guidance is especially relevant here: tool names should reflect natural task subdivisions, returned context should be meaningful rather than low-level, and semantic identifiers are easier for agents than cryptic IDs. ([Anthropic][4])

So avoid exposing a hundred raw pins as tools if ten higher-level capabilities are better.

For vmblu this means:

```text
raw pin exposure should be possible
but curated capability surfaces should be preferred
```

## What this means for vmblu

The vmblu compiler should eventually generate this pipeline:

```text
model.mod.blu
+ model.app.prf
+ pin tool metadata
+ probe metadata
+ group summaries
+ policies
        ↓
model.capabilities.json
        ↓
MCP export
OpenAI tool export
Anthropic tool export
broker runtime registry
agent-specific filtered manifests
```

The native document is not MCP. MCP is one export.

The native document is the vmblu capability manifest.

## My proposed first version

Do not try to solve everything.

First version should support:

```text
tools
probes
events
effects
basic policies
examples
MCP export
```

A minimal complete example:

```json
{
  "schema": "https://vmblu.dev/schemas/capabilities.v1.json",
  "application": {
    "id": "solar-system",
    "title": "Solar System Simulation",
    "description": "Interactive 3D solar system simulation."
  },
  "operationalContract": {
    "interactionModel": "tool-call-plus-verification",
    "principles": [
      "Use tools to change state.",
      "Use probes to verify effects.",
      "Use events for recent activity.",
      "Do not assume success without verification."
    ]
  },
  "tools": [
    {
      "id": "camera.focusPlanet",
      "title": "Focus planet",
      "description": "Changes the active camera target to a named planet.",
      "input": {
        "vmbluPin": "focusPlanet@CameraController",
        "schema": {
          "type": "object",
          "properties": {
            "planet": { "type": "string" }
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
      "schema": {
        "type": "object",
        "properties": {
          "targetName": { "type": "string" }
        }
      }
    }
  ],
  "events": [
    {
      "id": "camera.targetChanged",
      "description": "Emitted when the active camera target changes."
    }
  ],
  "usageGuidance": {
    "examples": [
      {
        "task": "Focus the camera on Mars.",
        "steps": [
          {
            "call": "camera.focusPlanet",
            "input": { "planet": "Mars" }
          },
          {
            "readProbe": "camera.currentTarget"
          },
          {
            "successCondition": "targetName is Mars"
          }
        ]
      }
    ]
  }
}
```

## The key design principle

The ideal document for an agent is not a tool list.

It is this:

> A compact operational contract that tells the agent what it can do, what it can inspect, what effects to expect, how to verify success, what policies constrain it, and which examples show correct use.

For vmblu, that document should be native to the architecture and exportable to MCP/OpenAI/Anthropic formats.

That is a very strong position for vmblu, because most existing tool systems describe **how to call functions**, while vmblu can describe **how to operate an application architecture safely and observably**.

[1]: https://modelcontextprotocol.io/docs/getting-started/intro "What is the Model Context Protocol (MCP)? - Model Context Protocol"
[2]: https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"
[3]: https://www.anthropic.com/engineering/advanced-tool-use "Introducing advanced tool use on the Claude Developer Platform \ Anthropic"
[4]: https://www.anthropic.com/engineering/writing-tools-for-agents "Writing effective tools for AI agents—using AI agents \ Anthropic"


## My question about scripting

Good take. I see that big applications often have a scripting language. To get things done, the agent will then write a script and submit it via a some mcp mechanism. Is this a good direction ? Should I look at some generic scripting mechanism that can be used with vmblu apps ? 

## reply about scripts

Yes, but with a very important qualification:

> **A scripting mechanism is a good direction for vmblu, but only if it is a constrained orchestration layer over vmblu capabilities — not a general-purpose escape hatch into the application.**

In other words: agents writing small scripts can be powerful, but the script must call the same broker-controlled tools/probes/events that a normal agent call would use.

## Why scripting is attractive

There is a real trend in this direction. Anthropic has argued that direct tool calls can become inefficient because every tool definition and tool result consumes context; their alternative is to let the agent write code that calls tools through MCP, execute that code, and return compact results. Cloudflare’s “Code Mode” makes a similar point: instead of describing every operation as a separate tool, the model writes code against a typed SDK and executes it safely; the code becomes a compact plan that can compose multiple calls. ([Anthropic][1])

That maps very naturally to vmblu, because vmblu applications are message-based and often asynchronous. A script can express:

```js
await tools["camera.focusPlanet"]({ planet: "Mars" });
const target = await probes["camera.currentTarget"].read();

if (target.targetName !== "Mars") {
  throw new Error("Camera did not focus Mars");
}
```

That is much better than forcing the LLM to perform every micro-step as a separate conversational tool call.

## But do not make it an unrestricted scripting language

This is the trap.

A generic scripting mechanism that can call arbitrary JavaScript, access the DOM freely, inspect node internals, use `fetch`, read files, spawn processes, or mutate runtime objects would undermine everything vmblu is trying to achieve.

MCP’s own specification warns that tools represent arbitrary code execution and need appropriate caution, user consent, and access controls. ([Model Context Protocol][2]) OpenAI’s agent tooling also emphasizes guardrails and tracing around tool usage, and its Agents SDK includes tracing of agent runs, tool calls, handoffs, guardrails, and custom events. ([OpenAI GitHub][3])

So the vmblu version should not be:

```text
agent writes arbitrary script against the app
```

It should be:

```text
agent writes a bounded capability script against the broker
```

That is a big difference.

## What I would build for vmblu

I would call it something like:

```text
vmblu capability script
```

or:

```text
broker script
```

Not “application scripting” yet.

The script should have access only to a small SDK:

```ts
tools.call(id, args)
probes.read(id, args?)
events.waitFor(id, filter?, timeout?)
effects.verify(effectId, context?)
trace.note(message, data?)
```

Example:

```js
const call = await tools.call("simulation.setTime", {
  isoUtc: "2030-01-01T00:00:00Z"
});

const state = await probes.read("simulation.currentTime");

assert.equal(state.isoUtc, "2030-01-01T00:00:00Z");

return {
  ok: true,
  simulationTime: state.isoUtc
};
```

The key point: the script does not know how to reach `SimulationClock` directly. It only knows the capability surface.

## The script should be a plan, not a new application layer

The role of the script is orchestration:

```text
call tool A
read probe B
wait for event C
branch if needed
retry once
return compact result
```

It should not become a place where users implement business logic that should live in vmblu nodes.

So I would position it as:

> A temporary, agent-authored execution plan over declared capabilities.

Not:

> A permanent scripting API for extending the application.

Later, if some scripts become valuable and stable, they can be promoted into explicit composed tools.

That is actually elegant:

```text
agent-written script
  -> useful repeated pattern
  -> reviewed by developer
  -> promoted to composed vmblu tool
```

## Minimal scripting model

The first version should be deliberately small.

Allow:

```text
variables
conditionals
loops with limits
tool calls
probe reads
event waits
assertions
return value
```

Disallow by default:

```text
network access
filesystem access
DOM access
eval/new Function
imports
timers except broker-controlled timeouts
direct node access
direct runtime mutation
unbounded loops
large memory allocation
```

Execution limits:

```text
max runtime
max tool calls
max probe reads
max event waits
max loop iterations
max output size
max retries
```

This is where vmblu’s security work with runtime attribution, tracing, and eventually AsyncLocalStorage-style execution context becomes relevant.

## The scripting language itself

I would not invent a new language unless you absolutely must.

Use a restricted JavaScript or TypeScript-like environment because:

```text
LLMs are good at writing it
developers understand it
typed SDKs are easy
examples are readable
it maps well to async tool/probe/event operations
```

But the runtime should be sandboxed. Not browser-global JavaScript. Not Node global JavaScript. A constrained evaluator or isolated worker-style execution model.

A script should see something like:

```js
export default async function run({ tools, probes, events, assert, trace }) {
  await tools.call("camera.focusPlanet", { planet: "Mars" });

  const target = await probes.read("camera.currentTarget");

  assert.equal(target.targetName, "Mars");

  return { focused: target.targetName };
}
```

Not:

```js
window.app.nodes.CameraController.focusPlanet("Mars")
```

The second version is a bypass. The first version preserves architecture.

## How this relates to MCP

MCP can still be the transport, but not the internal model.

You could expose a single MCP tool:

```text
run_vmblu_script
```

Its input:

```json
{
  "script": "...",
  "capabilityScope": "...",
  "timeoutMs": 3000
}
```

But I would be careful. A single “run script” MCP tool is very powerful and therefore risky.

A safer model:

```text
MCP exposes:
  list_capabilities
  get_capability_details
  run_capability_script
  read_probe
  call_tool
```

Where `run_capability_script` is broker-controlled and scoped.

The broker should parse/check/execute the script, not the MCP server blindly.

## Why this is better than many raw tool calls

Suppose an agent needs to achieve:

```text
Set the simulation date, focus Mars, verify the camera, then report current Mars distance.
```

Without scripting, the agent may need several round trips:

```text
call setTime
receive result
read currentTime
call focusPlanet
receive result
read currentTarget
read planetInfo
summarize
```

With scripting, the agent can submit one compact plan:

```js
await tools.call("simulation.setTime", { isoUtc });
assert.equal((await probes.read("simulation.currentTime")).isoUtc, isoUtc);

await tools.call("camera.focusPlanet", { planet: "Mars" });
assert.equal((await probes.read("camera.currentTarget")).targetName, "Mars");

const mars = await probes.read("planet.currentInfo", { planet: "Mars" });

return {
  time: isoUtc,
  focused: "Mars",
  distanceKm: mars.distanceKm
};
```

This reduces context noise, makes verification explicit, and gives the broker a complete traceable unit of work.

That is very aligned with vmblu.

## How it fits your capability document

The capability document should eventually include an SDK description for agents:

```json
{
  "scriptInterface": {
    "language": "vmblu-js/v1",
    "execution": "sandboxed",
    "availableGlobals": ["tools", "probes", "events", "assert", "trace"],
    "limits": {
      "timeoutMs": 5000,
      "maxToolCalls": 20,
      "maxProbeReads": 50,
      "maxEventWaits": 10
    },
    "examples": []
  }
}
```

Then the agent knows:

```text
I can either call a tool directly,
or write a bounded script that calls multiple capabilities and verifies results.
```

## Where this should sit in the architecture

I would add this layer:

```text
Agent
  -> broker
     -> direct tool call
     -> probe read
     -> event wait
     -> capability script execution
        -> tools/probes/events only
```

So scripting is not above the broker and not beside the broker. It is **inside** the broker boundary.

That is the essential design rule.

## My recommendation

Yes, investigate a generic scripting mechanism for vmblu apps — but do it as **broker-mediated capability scripting**, not general app scripting.

The sequence should be:

```text
1. Define tools, probes, events.
2. Generate capability manifest.
3. Build broker that can call tools and read probes.
4. Add simple direct agent interactions.
5. Add capability scripting as an optimization/orchestration layer.
```

Do not start with scripting before tools/probes are clear. The script language needs a stable API to call.

## Best formulation

I would frame it like this in the vmblu design:

> vmblu agents may interact with an application either by direct capability calls or by submitting bounded capability scripts. A capability script is a sandboxed, broker-executed program that can call approved tools, read approved probes, wait for approved events, assert expected effects, and return a compact structured result. It cannot access application internals directly. Its purpose is orchestration and verification, not arbitrary extension of the application.

That is a very strong direction.

It aligns with the industry trend toward code-executing agents, but preserves vmblu’s main value: explicit architecture, controlled boundaries, observability, and safety.

[1]: https://www.anthropic.com/engineering/code-execution-with-mcp?utm_source=chatgpt.com "Code execution with MCP: building more efficient AI agents"
[2]: https://modelcontextprotocol.io/specification/2025-06-18?utm_source=chatgpt.com "Specification"
[3]: https://openai.github.io/openai-agents-python/guardrails/?utm_source=chatgpt.com "Guardrails - OpenAI Agents SDK"

## How does this work exactly...

Ok, but just that I understand it very clearly how this would work: eventually replies/events have to find their way into the context of the LLM that is at the heart of the agent. The llm formats his own tool call requests (or probe requests) in an agreed json format, and the tool broker returns a some data in a json format that gets injected in the llm context. The llm can then link both together by using the id of the request and the result ? An event will just be injected into the context of the llm.


## GPT 5 reply

Yes. Conceptually that is exactly right, with one important nuance:

> The LLM does not receive events magically. The **agent runtime** decides which broker replies/events/probe values are inserted into the LLM context, in what form, and when.

So the architecture is:

```text
LLM
  -> emits tool/probe/event-wait request as structured JSON
Agent runtime
  -> validates/parses request
  -> sends request to Tool Broker
Tool Broker
  -> executes/observes/verifies
  -> returns structured JSON
Agent runtime
  -> injects selected result/event/probe data back into LLM context
LLM
  -> reasons over the new context and decides next step
```

The LLM is the reasoning core, but the **agent runtime is the conversation/context manager**.

## Basic synchronous-looking flow

Suppose the LLM wants to focus Mars.

It emits something like:

```json
{
  "type": "tool.call",
  "requestId": "req_001",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  }
}
```

The agent runtime sends that to the broker.

The broker may return:

```json
{
  "type": "tool.result",
  "requestId": "req_001",
  "callId": "call_847",
  "toolId": "camera.focusPlanet",
  "status": "accepted",
  "message": "Action dispatched."
}
```

That means:

```text
The message was accepted and sent into the vmblu application.
It does not yet prove that the camera now shows Mars.
```

Then the LLM, or the agent runtime automatically, may ask for verification:

```json
{
  "type": "probe.read",
  "requestId": "req_002",
  "probeId": "camera.currentTarget"
}
```

Broker returns:

```json
{
  "type": "probe.result",
  "requestId": "req_002",
  "probeId": "camera.currentTarget",
  "value": {
    "targetName": "Mars"
  }
}
```

The agent runtime injects this into the LLM context, and now the LLM can conclude:

```text
The camera is focused on Mars.
```

## Better flow: broker returns a verified result

For common cases, the broker can do the verification itself if the tool metadata says how.

The LLM calls:

```json
{
  "type": "tool.call",
  "requestId": "req_001",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  },
  "wait": "verified"
}
```

Broker dispatches the message, reads the relevant probe, and returns:

```json
{
  "type": "tool.result",
  "requestId": "req_001",
  "callId": "call_847",
  "toolId": "camera.focusPlanet",
  "status": "verified",
  "result": {
    "targetName": "Mars"
  },
  "verifiedEffects": [
    {
      "effectId": "camera.targetChanged",
      "probeId": "camera.currentTarget",
      "ok": true
    }
  ]
}
```

This is more efficient because the LLM gets the meaningful result directly.

But it is still not a synchronous return value from the node. It is a **broker-synthesized verified result**.

## How request IDs and call IDs differ

You probably want both.

### `requestId`

This belongs to the LLM/agent-runtime exchange.

```text
The LLM asked for something.
```

It lets the LLM/runtime connect:

```text
my request req_001 -> this response
```

### `callId`

This belongs to the broker/runtime execution.

```text
The broker dispatched an action into the application.
```

It lets the broker connect:

```text
this app event/probe/effect belongs to call_847
```

So:

```json
{
  "requestId": "req_001",
  "callId": "call_847"
}
```

means:

```text
The LLM request req_001 created broker action call_847.
```

The LLM can use both, but the `callId` is more important for asynchronous events.

## How events get into the LLM context

There are three possible modes.

### 1. The LLM explicitly waits for an event

The LLM asks:

```json
{
  "type": "event.wait",
  "requestId": "req_003",
  "eventId": "camera.targetChanged",
  "callId": "call_847",
  "timeoutMs": 1000
}
```

Broker returns:

```json
{
  "type": "event.result",
  "requestId": "req_003",
  "eventId": "camera.targetChanged",
  "callId": "call_847",
  "payload": {
    "targetName": "Mars"
  }
}
```

This is clean and controlled.

### 2. The agent runtime subscribes and injects selected events

The agent runtime has a subscription:

```json
{
  "subscribe": [
    "tool.lifecycle",
    "camera.targetChanged",
    "simulation.timeChanged"
  ]
}
```

Then, when an event occurs, the runtime may add a compact message to the LLM context:

```json
{
  "type": "event.observed",
  "eventId": "camera.targetChanged",
  "callId": "call_847",
  "payload": {
    "targetName": "Mars"
  }
}
```

This is useful, but you must be careful. If every app event is injected into the LLM context, the context becomes noisy and expensive.

### 3. The broker stores events and the LLM queries recent events

Instead of pushing everything, the runtime can make recent events available through a tool:

```json
{
  "type": "events.query",
  "requestId": "req_004",
  "filter": {
    "sinceCallId": "call_847",
    "eventIds": ["camera.targetChanged"]
  }
}
```

Broker returns a compact list.

This is often the best default for larger applications.

## Do not inject all events automatically

This is important.

An agent should not receive every event emitted by the application. That would create:

```text
context pollution
irrelevant reasoning
token cost
race-condition confusion
security leakage
```

Instead, events should be filtered by:

```text
agent permissions
current task
active callId
subscribed event types
importance level
recency
broker policy
```

So the event flow should be:

```text
application emits many events
broker observes many events
agent runtime selects relevant events
LLM sees only the relevant subset
```

The LLM context should contain **curated observations**, not the raw event stream.

## What the LLM actually sees

A good LLM context might look like this:

```text
System/developer instructions:
You operate the Solar System app through broker tools, probes, and events.
After state-changing actions, verify using probes.

Available capabilities:
- camera.focusPlanet
- camera.currentTarget
- simulation.setTime
- simulation.currentTime

User task:
Focus the camera on Mars.

Assistant/tool request:
{"type":"tool.call","requestId":"req_001","toolId":"camera.focusPlanet","args":{"planet":"Mars"},"wait":"verified"}

Tool result injected by runtime:
{"type":"tool.result","requestId":"req_001","callId":"call_847","status":"verified","result":{"targetName":"Mars"}}

Assistant final answer:
The camera is now focused on Mars.
```

That is the core loop.

## Who creates the JSON?

There are two common models.

### Model A: LLM emits tool calls through provider-native mechanism

For OpenAI/Anthropic/etc., the LLM does not literally write arbitrary JSON in text. It emits a structured tool call according to the provider protocol.

The agent runtime receives that as structured data and converts it to broker JSON.

```text
LLM provider tool call
  -> agent runtime
     -> broker request JSON
```

This is how modern tool calling usually works.

### Model B: LLM writes explicit JSON messages

For a custom or local agent runtime, you can ask the LLM to output:

```json
{
  "type": "tool.call",
  "toolId": "...",
  "args": {}
}
```

Then the runtime parses it.

This is possible, but provider-native tool calling is usually more reliable.

For vmblu, the internal broker protocol should be JSON either way. The provider adapter can translate from OpenAI/Anthropic/MCP/etc. into the same vmblu broker protocol.

## The broker protocol can be stable even if providers differ

That is the important design.

```text
OpenAI tool call
Anthropic tool call
MCP call
local JSON call
capability script call
        ↓
vmblu broker protocol
        ↓
vmblu app
```

So vmblu should define its own internal messages:

```text
tool.call
tool.result
probe.read
probe.result
event.wait
event.result
events.subscribe
events.query
```

Then adapters translate.

## Event injection example

Suppose the agent has an ongoing task: “Start the simulation and report when it reaches 2030.”

The LLM calls:

```json
{
  "type": "tool.call",
  "requestId": "req_010",
  "toolId": "simulation.start",
  "args": {
    "startIsoUtc": "2029-12-31T23:59:00Z",
    "timeScale": 1000
  }
}
```

Broker returns:

```json
{
  "type": "tool.result",
  "requestId": "req_010",
  "callId": "call_900",
  "status": "accepted"
}
```

Then the agent runtime may wait outside the LLM until a relevant event occurs. When the simulation reaches 2030, it injects:

```json
{
  "type": "event.observed",
  "eventId": "simulation.timeReached",
  "relatedCallId": "call_900",
  "payload": {
    "isoUtc": "2030-01-01T00:00:00Z"
  }
}
```

Then the LLM is called again with that event in context and can respond:

```text
The simulation has reached 2030-01-01T00:00:00Z.
```

The LLM does not need to be continuously running. The runtime can wake it when relevant events arrive.

## Very important distinction: LLM context is not the event log

The broker/runtime should keep the full trace separately:

```text
complete event log
tool call log
probe reads
security warnings
approval decisions
errors
timeouts
```

The LLM only gets selected slices.

So:

```text
trace = complete factual record
LLM context = curated reasoning context
```

This is crucial for long-running agents.

## Best architecture sentence

I would define it like this:

> The LLM communicates with vmblu through an agent runtime. The LLM emits structured requests for tool calls, probe reads, event waits, or capability scripts. The agent runtime forwards these requests to the tool broker. The broker executes or observes the vmblu application and returns structured results tagged with request and call identifiers. The agent runtime injects selected results and relevant events back into the LLM context, allowing the LLM to correlate actions and observations and decide the next step.

That is the exact mechanism.

## Final answer to your question

Yes:

```text
LLM formats request
broker executes/observes
broker returns JSON
runtime injects result into LLM context
LLM links request/result via requestId and callId
```

And for events:

```text
application emits event
broker observes event
runtime filters it
runtime injects relevant event into LLM context
LLM reasons over it
```

But the event should not simply be dumped blindly into context. The **agent runtime** should filter, summarize, correlate, and inject only what matters.

## I rephrase...

Let me rephrase this: (1) current major LLMs need to get a tool list in their specific format. We can derive these from the internal capabilities document. (2) current major LLMs will initiate a tool call in their own specific format. The agent runtime will convert these into the specific vmblu format and make a request via the broker. (3) The agent runtime receives the result from the broker and will decide  if and when to return something to the LLM, again by converting an internal vmblu format to a format that the particular LLM wants to see. The link in the LLM between actions and results is made via some identifier (a name ? a number ? a short description ?). (4) The user of the program working with the LLM more often then not will not want to see all the details of the chit/chat between the LLM and the app. Often he will only want to see eg 'point camera at mars' and then a bit later 'camera pointed at mars'.

## GPT 5

Yes. Your rephrasing is correct. I would only sharpen the boundaries a little.

The clean architecture is:

```text
LLM provider format
    ⇅
Agent runtime / provider adapter
    ⇅
vmblu broker protocol
    ⇅
Tool broker
    ⇅
vmblu application
```

The LLM never needs to understand vmblu’s internal messaging directly. The broker never needs to understand OpenAI/Anthropic/MCP-specific quirks directly. The **agent runtime/provider adapter** is the translation layer.

## 1. Tool list: external format derived from internal capabilities

Correct.

The source of truth should be:

```text
model.capabilities.json
```

From that, vmblu can generate provider-specific tool definitions:

```text
OpenAI tools
Anthropic tools
MCP tools
future provider tools
internal broker tools
```

So the flow is:

```text
vmblu capability manifest
    -> provider-specific tool list
    -> LLM context/tool registry
```

This keeps vmblu independent from today’s tool-calling standards.

## 2. Tool call: provider format converted into vmblu broker request

Correct.

The LLM will emit something like:

```text
provider-native tool call
```

The agent runtime converts it into something vmblu-native:

```json
{
  "type": "tool.call",
  "requestId": "req_42",
  "agentId": "agent_camera",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  },
  "wait": "verified"
}
```

Then the broker handles validation, dispatch, observation, and verification.

## 3. Result: vmblu broker result converted back into provider format

Correct again.

The broker might return:

```json
{
  "type": "tool.result",
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "status": "verified",
  "result": {
    "targetName": "Mars"
  },
  "verifiedEffects": [
    {
      "effectId": "camera.targetChanged",
      "probeId": "camera.currentTarget",
      "ok": true
    }
  ]
}
```

The agent runtime then decides what to give back to the LLM.

For the LLM, the result may become something provider-specific like:

```json
{
  "tool_call_id": "provider_call_abc",
  "content": {
    "status": "verified",
    "targetName": "Mars"
  }
}
```

The important rule:

> The provider call identifier links the LLM-visible tool request to the LLM-visible tool result. The vmblu `requestId` and `callId` link the provider call to the internal broker/app execution.

So I would use three identifiers, not one.

## The three IDs

### 1. Provider tool-call ID

Created by the LLM provider or provider adapter.

Purpose:

```text
Links the LLM’s tool call to the tool-result message expected by that provider.
```

Example:

```text
providerCallId = "call_x7z..."
```

This is mostly adapter-level plumbing.

### 2. vmblu request ID

Created by the agent runtime when it converts the provider call into a vmblu broker request.

Purpose:

```text
Links one agent/runtime request to one broker response.
```

Example:

```text
requestId = "req_42"
```

This is useful for the agent runtime.

### 3. vmblu call ID

Created by the broker when it dispatches an actual action into the vmblu application.

Purpose:

```text
Links app events, probe reads, traces, effect verification, and lifecycle messages to the actual execution.
```

Example:

```text
callId = "call_983"
```

This is the most important ID for asynchronous vmblu execution.

So the full mapping is:

```text
providerCallId
  -> requestId
      -> callId
          -> events/probes/effects/traces
```

The LLM does not need to see all of these every time. But the runtime and trace system should keep them.

## 4. User UI should show the task-level story, not the protocol chatter

Strongly agree.

The user usually should not see:

```text
tool.call req_42
tool.result call_983
probe.read camera.currentTarget
event.observed camera.targetChanged
```

They should see something like:

```text
Point camera at Mars.
Camera pointed at Mars.
```

Or, in a slightly more transparent UI:

```text
Task: Point camera at Mars
Status: completed
Evidence: camera.currentTarget = Mars
```

The protocol chatter belongs in:

```text
debug panel
agent trace view
developer console
audit log
test report
```

Not in the normal user conversation.

## This creates two output layers

The agent runtime should produce two different streams.

### User-facing stream

Concise, intentional, human-readable:

```json
{
  "type": "agent.userStatus",
  "message": "Pointing camera at Mars..."
}
```

```json
{
  "type": "agent.userStatus",
  "message": "Camera pointed at Mars."
}
```

### Trace/debug stream

Complete technical record:

```json
{
  "type": "trace.toolCall",
  "providerCallId": "call_x7z",
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  },
  "status": "verified",
  "verifiedEffects": [
    {
      "effectId": "camera.targetChanged",
      "probeId": "camera.currentTarget",
      "ok": true
    }
  ]
}
```

This distinction is important for vmblu’s positioning:

> The user sees intent and outcome. The developer can inspect the evidence.

That fits your “observable, safe, maintainable” direction perfectly.

## Should the LLM see all broker details?

No. The LLM should see enough to reason, but not necessarily the full internal trace.

For example, after a successful verified call, the LLM might only need:

```json
{
  "status": "verified",
  "tool": "camera.focusPlanet",
  "result": {
    "targetName": "Mars"
  }
}
```

It does not need:

```text
which node emitted which event
which probe was used
which timeout was applied
full routing path
internal call lifecycle
```

unless it is a developer/debugging agent.

So again you need visibility levels:

```text
normal agent context:
  concise operational result

debug/developer agent context:
  detailed evidence and trace

human user UI:
  task-level summary
```

## The important design principle

I would formulate the architecture like this:

> vmblu separates provider protocol, broker protocol, application execution, LLM reasoning context, user-visible status, and developer trace. A tool call may be represented differently at each layer, but all layers are linked by stable identifiers.

This is the heart of the design.

## Concrete flow for “point camera at Mars”

### User says

```text
Point the camera at Mars.
```

### LLM sees tools and emits provider-native call

Conceptually:

```json
{
  "tool": "camera.focusPlanet",
  "arguments": {
    "planet": "Mars"
  }
}
```

### Agent runtime converts to vmblu broker request

```json
{
  "type": "tool.call",
  "requestId": "req_42",
  "agentId": "mainAgent",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  },
  "wait": "verified"
}
```

### Broker executes

Internally:

```text
validate args
check policy
dispatch focusPlanet@CameraController
observe event/probe
verify camera.currentTarget == Mars
record trace
```

### Broker returns internal result

```json
{
  "type": "tool.result",
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "status": "verified",
  "result": {
    "targetName": "Mars"
  }
}
```

### Agent runtime sends compact result to LLM

```json
{
  "status": "verified",
  "targetName": "Mars"
}
```

### LLM replies to user

```text
Camera pointed at Mars.
```

### User-visible UI may show only

```text
Pointing camera at Mars...
Camera pointed at Mars.
```

### Developer trace view may show

```text
req_42 -> call_983 -> focusPlanet@CameraController -> camera.currentTarget == Mars
```

That is the model.

## One correction to your point 3

You wrote:

> The link in the LLM between actions and results is made via some identifier — a name, number, short description?

Use an **opaque identifier**, not a description.

A short description is useful for humans, but it is not reliable enough for protocol correlation.

Use:

```text
providerCallId
requestId
callId
```

The human-readable fields are supplementary:

```text
toolId
title
description
taskLabel
```

So the result can include both:

```json
{
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "title": "Focus planet",
  "status": "verified"
}
```

The IDs do correlation. The names/descriptions help reasoning and debugging.

## Final version of your four points

I would rewrite your model as:

1. **Capability export**
   The vmblu capability manifest is converted into the tool/resource/probe format required by the current LLM provider or MCP adapter.

2. **Provider-to-broker call translation**
   The LLM emits a provider-native tool call. The agent runtime maps it to a vmblu broker request with `requestId`, `agentId`, `toolId`, arguments, and execution preferences such as `wait: "verified"`.

3. **Broker-to-provider result translation**
   The broker executes the request, assigns a `callId`, observes events/probes, and returns a structured vmblu result. The agent runtime converts the relevant part into the provider’s expected tool-result format and injects it into the LLM context. Correlation is maintained through opaque IDs.

4. **User-facing abstraction**
   The user normally sees a task-level narrative: requested action, progress, completion/failure. The detailed broker/app/LLM exchange is stored in traces and shown only in developer/debug/audit views.

That is clean and implementable.

## conclusion from my side

I think I begin to see now what we need to implement this all. (1) a schema for the capabilities file (2) an agent runtime that communicates with the LLM provider on the one side and the broker on the other side. The agent runtime will have to cater for different types of LLMs. We will have to provide some mechanism for that, but that is not so difficult. The agent runtime id configurable so that the scope of what it can / cannot do can be set. There can be one or several agents. (3) a tool broker that converts agent requests into messages to inject in the application and that returns results and events to the applicable agent. (4) a script specification so that the LLM can write scripts that the agent executes via the broker.

## reply from chatGPT

Yes. That is the implementation map. I would refine it into **four layers**, with one extra cross-cutting concern: **trace/evidence**.

The architecture becomes:

```text
LLM Provider
   ⇅ provider adapter
Agent Runtime
   ⇅ vmblu agent/broker protocol
Tool Broker
   ⇅ vmblu runtime messages/probes/events
Application Graph
```

And the artifacts become:

```text
model.capabilities.json
model.agents.json
broker/runtime implementation
capability script spec
trace/evidence log
```

## 1. Capabilities schema

This should come first.

It defines the application’s agent-facing surface:

```text
tools   = actions an agent may request
probes  = read-only inspection points
events  = asynchronous observations
effects = expected semantic consequences of tools
policies = risk/approval/limits metadata
```

The capabilities file should not be provider-specific. It should be vmblu-native.

Example structure:

```json
{
  "schema": "https://vmblu.dev/schemas/capabilities.v1.json",
  "application": {
    "id": "solar-system",
    "title": "Solar System Simulation",
    "description": "Interactive 3D solar-system simulation."
  },
  "tools": [],
  "probes": [],
  "events": [],
  "policies": {},
  "usageGuidance": {}
}
```

This file then feeds:

```text
MCP export
OpenAI/Anthropic/Gemini tool definitions
broker registry
agent-specific filtered capability views
script SDK generation
```

## 2. Agent runtime

Correct.

The agent runtime is the **orchestrator around the LLM**.

It handles:

```text
provider-specific communication
tool-list formatting
provider tool-call parsing
conversion to vmblu broker requests
conversation/context management
event/probe/result injection into LLM context
agent configuration
scope enforcement at the agent level
user-facing status messages
```

It should support multiple providers through adapters:

```ts
interface LLMProviderAdapter {
  buildToolList(capabilities: CapabilityView): ProviderToolSpec[];
  sendTurn(input: AgentTurnInput): Promise<AgentTurnOutput>;
  parseToolCalls(output: AgentTurnOutput): ProviderToolCall[];
  formatToolResult(result: BrokerResult): ProviderToolResult;
}
```

But vmblu’s internal agent logic should not care whether the provider is OpenAI, Anthropic, MCP, local model, etc.

You probably want:

```text
AgentRuntime
  owns conversation state
  owns provider adapter
  owns agent config
  talks to broker
```

And the config belongs in:

```text
model.agents.json
```

Example:

```json
{
  "agents": [
    {
      "id": "mainAssistant",
      "title": "Main application assistant",
      "provider": "openai",
      "model": "gpt-5.5",
      "instructions": "Help the user operate the solar-system simulation.",
      "capabilities": {
        "tools": ["camera.focusPlanet", "simulation.setTime"],
        "probes": ["camera.currentTarget", "simulation.currentTime"],
        "events": ["camera.targetChanged", "simulation.timeChanged"]
      },
      "limits": {
        "maxToolCallsPerTurn": 10
      }
    }
  ]
}
```

## 3. Tool broker

The broker is the **runtime authority**.

It does not reason like the LLM. It enforces, dispatches, observes, and reports.

Responsibilities:

```text
receive broker requests from agent runtimes
validate arguments
check permissions/policies
assign request/call IDs
dispatch vmblu messages
observe events
read probes
verify declared effects where possible
manage pending calls
handle timeouts
return structured results
emit trace records
```

The broker protocol should be vmblu-native and stable:

```text
tool.call
tool.result
probe.read
probe.result
event.wait
event.result
events.subscribe
events.query
script.run
script.result
```

Example internal request:

```json
{
  "type": "tool.call",
  "requestId": "req_42",
  "agentId": "mainAssistant",
  "toolId": "camera.focusPlanet",
  "args": {
    "planet": "Mars"
  },
  "wait": "verified"
}
```

Example internal result:

```json
{
  "type": "tool.result",
  "requestId": "req_42",
  "callId": "call_983",
  "toolId": "camera.focusPlanet",
  "status": "verified",
  "result": {
    "targetName": "Mars"
  }
}
```

The broker is where vmblu’s asynchronous nature becomes manageable.

## 4. Capability script specification

Yes, but I would make this **version 1.5**, not the very first thing.

The script spec depends on the existence of:

```text
stable tool IDs
stable probe IDs
stable event IDs
stable broker protocol
execution limits
trace system
```

The script should be a constrained orchestration language over the broker, not a general app scripting API.

A first script API could be:

```ts
await tools.call(id, args, options?)
await probes.read(id, args?)
await probes.until(id, predicate, options?)
await events.waitFor(id, filter?, options?)
assert.equal(a, b)
trace.note(message, data?)
return value
```

Example:

```js
export default async function run({ tools, probes, assert }) {
  await tools.call("camera.focusPlanet", { planet: "Mars" }, { wait: "accepted" });

  const target = await probes.read("camera.currentTarget");

  assert.equal(target.targetName, "Mars");

  return {
    ok: true,
    focused: target.targetName
  };
}
```

But I would not allow arbitrary JS access to the app.

The script environment must not expose:

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
```

Only broker-mediated capabilities.

## 5. The missing fifth piece: traces/evidence

I would add this explicitly now, not later.

Every agent interaction should produce a trace:

```text
user task
LLM request
provider call id
vmblu request id
broker call id
tool/probe/event used
arguments
policy decision
result
verified effects
errors/timeouts
user-visible summary
```

This is essential for vmblu’s value proposition.

The user sees:

```text
Camera pointed at Mars.
```

The developer can inspect:

```text
mainAssistant -> camera.focusPlanet({ planet: "Mars" })
req_42 -> call_983
dispatched focusPlanet@CameraController
verified via camera.currentTarget
result targetName = Mars
```

This is where vmblu becomes more than “MCP wiring.”

## Recommended implementation order

I would do it in this exact order:

```text
1. Define capabilities schema
2. Add tool/probe/event metadata to model/profile
3. Generate model.capabilities.json
4. Generate current model.mcp.json from capabilities
5. Build minimal broker: call tool, read probe, wait event
6. Add trace/evidence recording
7. Build one provider adapter in agent runtime
8. Add model.agents.json
9. Add script.run after direct calls work
```

Do not build scripting before the broker works.
Do not build agent orchestration before capabilities work.
Do not overdesign multi-agent behavior before one agent can reliably act and verify.

## The most important dependency chain

The dependency chain is:

```text
capabilities → broker → agent runtime → scripts → multi-agent orchestration
```

Not:

```text
agents → scripts → tools
```

Capabilities are the foundation.

## Clean final formulation

I would write the architecture decision like this:

> vmblu will introduce a capability layer for agent interaction. A generated capabilities file describes tools, probes, events, effects, and policies. An agent runtime adapts LLM-provider-specific tool protocols to vmblu’s broker protocol. A tool broker enforces policy, dispatches messages into the vmblu application, observes events and probes, verifies effects, and returns structured results. A later capability-script layer will allow agents to submit bounded scripts that orchestrate approved tools, probes, and events through the broker. All interactions produce trace/evidence records for debugging, audit, and user trust.

That is the scaffold. It is coherent, implementable, and strongly aligned with vmblu’s architectural identity.

## The tweet about about agents

Here are 10 things senior AI engineers stopped wasting time on:

1. AutoGen / AG2: moved to community maintenance, releases stalled. dead for production

2. CrewAI: demos well, breaks in production. engineers building real systems already moved off it

3. Autonomous agent pitches: the AutoGPT / BabyAGI wave is dead in product form. the industry settled on supervised, bounded, evaluated agents

4. Agent app stores / marketplaces: promised since 2023, zero enterprise traction

5. SWE-bench leaderboard chasing: researchers proved nearly every public benchmark can be gamed without solving the underlying task

6. Microsoft Semantic Kernel: unless you're locked into Microsoft enterprise stack, it's not where the ecosystem is heading

7. DSPy: philosophical merit, niche audience. not a general agent framework

8. Horizontal "build any agent" platforms: Google Agentspace, AWS Bedrock Agents, Copilot Studio. confusing, slow-shipping, the math still favors building yourself

9. Per-seat SaaS pricing for agent products: market moved to outcome-based. per-seat is already dead

10. The framework that went viral on HN this week: wait 6 months. if it still matters, it'll be obvious

what actually compounds instead:

- context engineering
- tool design
- orchestrator-subagent pattern
- eval discipline
- the harness mindset (harness > model, always)
- MCP as the protocol layer

be few steps ahead than your competitors and outperform this market till it became mass-opinion

study this.

## Chat gpt reply

Yes — what we have defined is strongly aligned with the serious part of that tweet.

I would not treat every claim in the tweet as objective fact. Some of it is deliberately provocative. But the underlying direction is right:

> The industry is moving away from “autonomous agent magic” and toward bounded agents, carefully designed tools, strong context management, orchestration, evaluation, harnesses, and MCP as one protocol layer.

That is almost exactly where your vmblu design is heading.

## 1. The tweet argues against generic agent frameworks

The tweet is basically saying:

```text
Do not bet on fashionable horizontal agent frameworks.
Do not assume generic autonomous agents solve production problems.
Do not build around whatever framework is popular this month.
Build your own bounded harness around your application, tools, context, evaluation, and protocol adapters.
```

That is compatible with vmblu.

In fact, it is a good argument **for** vmblu, because vmblu is not trying to be a generic “build any agent” framework. It is trying to make a concrete application architecture explicit, inspectable, toolable, testable, and agent-operable.

That distinction matters.

vmblu should not present itself as:

```text
A general autonomous-agent framework.
```

It should present itself as:

```text
An architecture and harness layer for making real applications safely usable by agents.
```

That is much stronger.

## 2. The tweet’s “what compounds” list maps almost directly to vmblu

The valuable part of the tweet is this list:

```text
context engineering
tool design
orchestrator-subagent pattern
eval discipline
harness mindset
MCP as protocol layer
```

Your emerging vmblu architecture maps very cleanly onto all six.

## Context engineering

This is exactly your capability manifest and agent runtime.

The capability document decides what gets into the model context:

```text
tools
probes
events
effects
policies
examples
architecture summaries
agent-specific scopes
```

Anthropic has explicitly warned that bloated tool sets and ambiguous tool choices degrade agent performance; if a human engineer cannot clearly decide which tool should be used, the model will not do better. ([Anthropic][1])

That is precisely why vmblu should generate filtered, scoped, high-signal capability surfaces instead of dumping every pin into a tool list.

So vmblu’s answer to context engineering is:

```text
capability manifest + agent-specific filtered view + broker-curated observations
```

Good alignment.

## Tool design

This is the center of your design.

You are no longer saying:

```text
Every input pin is automatically a tool.
```

You are moving toward:

```text
A tool is an intentional, documented, policy-controlled capability with expected effects and verification probes.
```

That is exactly what good agent tool design requires.

Anthropic’s tool-use guidance also emphasizes that tools need meaningful names, clear descriptions, good examples, and useful returned context — not just a raw schema. ([Anthropic][2])

Your tools/probes/effects model is therefore ahead of a simple MCP tool-list approach.

## Orchestrator-subagent pattern

Your distinction between:

```text
AI node
Agent runtime
Tool broker
multiple agents
broker-mediated permissions
event/probe visibility
```

fits this direction.

The important correction is that vmblu should not start by building a complex multi-agent orchestration framework.

Your current plan is better:

```text
one agent runtime
one broker
one capability registry
then multiple agents later
then agent-to-agent / subagent patterns later
```

That avoids the over-engineered AutoGPT/CrewAI trap.

## Eval discipline

This is where probes become strategically important.

Most agent systems struggle because they can “do something” but cannot reliably determine whether it worked.

Your model says:

```text
tool call -> expected effect -> probe/event verification -> trace/evidence
```

That is an evaluation primitive.

It can support:

```text
agent self-verification
test harnesses
regression tests
security audits
user-visible evidence
developer trace inspection
```

This is much better than simply giving an LLM tools and hoping it behaves.

## Harness mindset

This is probably the strongest alignment.

The tweet says:

```text
harness > model
```

That means: the surrounding system matters more than chasing the newest model.

vmblu is basically a harness architecture:

```text
explicit application graph
capability manifest
broker
provider adapters
runtime tracing
probes
events
policies
script execution limits
generated MCP/export artifacts
```

That is exactly the kind of durable infrastructure that survives model/provider changes.

This is also why vmblu should not tie itself too tightly to MCP, OpenAI, Anthropic, or any one agent framework.

## MCP as protocol layer

Your architecture treats MCP exactly the right way:

```text
MCP = protocol/export/transport layer
not vmblu's internal model
```

MCP is increasingly treated as a standard integration layer for connecting agents to tools and context. Anthropic describes MCP as an open standard for connecting AI applications to tools, data sources, and workflows; OpenAI and Google have also adopted MCP-related integrations. ([Anthropic][3])

But MCP itself should not be the architecture. Your internal architecture should be:

```text
vmblu capability manifest
vmblu broker protocol
provider adapters
MCP export
```

That is the right separation.

## 3. The tweet is also a warning: do not build an “agent framework”

This is the most important strategic takeaway.

Do not let vmblu drift into becoming:

```text
another horizontal agent platform
another CrewAI/AutoGen alternative
another "build any autonomous agent" toolkit
```

That would be a mistake.

vmblu’s strength is more specific:

> vmblu makes a real application understandable and operable by humans, coding agents, and runtime agents through an explicit architecture and a controlled capability surface.

That is not the same market as AutoGen/CrewAI.

You are not competing with LangGraph, OpenAI Agents SDK, Claude Agent SDK, Bedrock Agents, or Copilot Studio head-on.

You are building the **application-side architecture/harness** that agents need.

That is much more defensible.

## 4. The tweet’s criticism of autonomous agents supports your bounded-agent design

The tweet says the AutoGPT/BabyAGI-style autonomous pitch is dead in product form and that the industry settled on:

```text
supervised, bounded, evaluated agents
```

That is exactly what you are designing:

```text
supervised: broker, policies, approval, user-visible status
bounded: scoped tools/probes/events per agent
evaluated: effects, probes, traces, harness
```

So yes, your design is aligned.

Actually, your current design is better than many “agent” architectures because it does not start with autonomy. It starts with capability boundaries and verification.

## 5. Current framework volatility supports your provider-adapter approach

Some factual claims in the tweet are real, some are exaggerated.

For example, Microsoft’s AutoGen repository now warns that AutoGen is in maintenance mode, with no new features or enhancements, and community-managed going forward. ([GitHub][4]) AG2’s own roadmap says the older `autogen.agentchat` framework is being prepared for maintenance mode, though AG2 itself continues toward v1.0. ([docs.ag2.ai][5])

That supports your design choice:

```text
Do not depend on one agent framework.
Do not make MCP or any provider SDK the internal abstraction.
Use adapters.
```

Your stack should be:

```text
vmblu capability model
vmblu broker
vmblu agent runtime
provider adapters
```

This is exactly the right response to framework churn.

## 6. The scripting idea is also aligned with the direction of serious agents

The tweet does not mention scripting explicitly, but it fits the “harness” and “context engineering” direction.

Anthropic’s “code execution with MCP” article argues that direct tool calls consume context for each tool definition and result, while agents can scale better by writing code that calls tools and returns compact results. ([Anthropic][3]) Simon Willison summarized the same issue: large MCP tool descriptions consume context, and chaining many tool calls through the context introduces token cost and additional chances for mistakes. ([Simon Willison’s Weblog][6])

That aligns with your proposed:

```text
bounded capability scripts
executed by broker
over tools/probes/events
with limits and traces
```

This is not “random scripting.” It is a harness mechanism.

Good direction.

## 7. Security warning: MCP as protocol layer is useful but not sufficient

One caution: the tweet says “MCP as protocol layer,” but MCP is not automatically safe.

Recent reporting has highlighted security concerns around MCP servers and SDKs, including issues involving path validation, argument injection, and remote-code-execution-style risks in tool/server setups. ([TechRadar][7])

That reinforces your broker/policy design:

```text
MCP should never directly expose raw app internals.
MCP should talk to the broker.
The broker enforces scope, validation, approval, tracing, and sandboxing.
```

So the vmblu position should be:

```text
MCP-compatible, not MCP-dependent.
MCP-exposed, not MCP-trusting.
```

That is important.

## 8. What I would change based on the tweet

I would slightly adjust your implementation emphasis.

Your current list was:

```text
1. capabilities schema
2. agent runtime
3. tool broker
4. script specification
```

I would reorder and sharpen it:

```text
1. capability manifest: tools, probes, events, effects, policies
2. broker/harness: validation, dispatch, verification, traces
3. provider adapters: MCP/OpenAI/Anthropic/etc.
4. simple agent runtime: bounded, scoped, supervised
5. eval/test harness using the same capabilities
6. bounded capability scripting
7. multi-agent/orchestrator-subagent patterns
```

The tweet would push me to bring **eval/test harness** earlier, not later.

Because “harness > model” means vmblu should prove that an agent’s behavior can be tested, replayed, inspected, and verified.

So add this as a first-class target:

```text
A capability can be used by:
- an LLM agent
- a test runner
- a human/debug console
- an MCP client
- a script
```

That is the durable abstraction.

## 9. The clearest positioning

Based on the tweet, I would position vmblu like this:

> vmblu is not another agent framework. It is an application architecture and harness layer for bounded agents. It turns a message-based application into a controlled capability surface: tools to act, probes to verify, events to observe, policies to constrain, and traces to evaluate.

That sentence is very close to where the market seems to be going.

## 10. Final verdict

Yes, your design is very much in line with the serious signal in the tweet.

The tweet says serious agent engineering is moving toward:

```text
boundedness
tool design
context discipline
protocol adapters
orchestration
evaluation
harnesses
```

Your vmblu design says:

```text
capability manifest
tools/probes/events/effects
broker
provider adapters
agent runtime
bounded scripts
traces/evidence
```

That is aligned.

The main warning is: **do not market or design vmblu as an agent framework.**

Design it as:

```text
the architecture/capability/evidence layer that serious agents need in order to operate real applications.
```

That is the stronger, more durable niche.

[1]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents?utm_source=chatgpt.com "Effective context engineering for AI agents"
[2]: https://www.anthropic.com/engineering/advanced-tool-use?utm_source=chatgpt.com "Introducing advanced tool use on the Claude Developer ..."
[3]: https://www.anthropic.com/engineering/code-execution-with-mcp?utm_source=chatgpt.com "Code execution with MCP: building more efficient AI agents"
[4]: https://github.com/microsoft/autogen?utm_source=chatgpt.com "microsoft/autogen: A programming framework for agentic AI"
[5]: https://docs.ag2.ai/latest/docs/user-guide/release-roadmap?utm_source=chatgpt.com "AG2 - Release Roadmap"
[6]: https://simonwillison.net/2025/Nov/4/code-execution-with-mcp/?utm_source=chatgpt.com "Code execution with MCP: Building more efficient agents"
[7]: https://www.techradar.com/pro/security/anthropics-official-git-mcp-server-had-some-worrying-security-flaws-this-is-what-happened-next?utm_source=chatgpt.com "Anthropic's official Git MCP server had some worrying security flaws - this is what happened next"
