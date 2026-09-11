# Annex A: Semantic Clarifications for blu.schema.json

This annex captures subtle semantic points that are not fully enforceable in the JSON Schema but are critical for correct usage of the vmblu format by both humans and LLMs.

## A.1 Nodes

A source node represents an indivisible implementation unit, whereas a group node is a purely architectural composition of nodes. 
A source node can represent a UI element, the access to a database, a login procedure, a 3D scene list etc.
The name of a node should be meaningful and unique inside a group node.
The prompt for a node should be a clear, concise and up-to-date description of its function.

## A.1.1 Node teams

Nodes may declare a `team` string to make the architecture visually readable. A team identifies a semantic role such as `ui`, `domain`, `data` or `integration`; it should not be named after a color.

Team definitions live in `header.teams`. The `default` team is always present. Each team has a `color` property; team objects may gain additional properties in future schema versions.

If a node has no explicit `team`, it inherits the render-time team context from its containing group node. If there is no containing team context, it uses `default`.

For dock nodes, the linked node is rendered in the team context of the dock node. This is a visual rule and should not mutate the linked source model.

## A.2 Interface names and Pin names

- **Interfaces** are a group of pins that belong together. The purpose of interfaces is to make the design and functionality of a node easier to understand.
- There can only be one anonymous interface (name is ""), this is acceptable for nodes that only have a few pins.
- Group pins together into an interface with a meaningful name.
- Use the same interface name on different nodes when those interfaces serve the same architectural purpose. This is a naming convention, not a formal global type declaration: interface names remain local to each node, but consistent names make the model easier to read, compare and visualize.
- Do not invent different interface names merely to make node-local names unique. If two nodes both expose a `file`, `chat`, `auth`, `camera` or similar interface with the same role in the design, prefer the same interface name.
- Use the following convention when giving a name to a pin: if the pin belongs to an interface start the name with the name of that interface followed by a period. If the rest of the name is more than one word, separate the words by a hyphen. Examples: *file.save*, *file.save-as*, *file.convert-to-uppercase*, where the interface name is *file*.

## A.3 Pin contracts and types

### (1) Types and `vmbluType`

* `vmbluType` always refers to either:

  * a primitive (`string`, `number`, `boolean`, `any`, …), or
  * a named type in the model’s `types` section.
  * Structural payload details belong in the `types` section, not on pins.

### (2) Pin contract roles

* Every pin may declare a `contract` with a `role`:

  * `role: "owner"` means: **this pin defines the payload type** and is authoritative.
  * `role: "follower"` means: **this pin adapts** to the connected owner’s contract.


For input/output pins, the payload type is a single type that refers to a type in the `types`section. For request/reply pins the payload type consists of two types: the request payload and the reply payload. Both types also refer to a type in the `types` section.

A follower pin always copies the payload type of the owner pin it is connected to. An unconnected follower pin will be given the payload 'any'.

Examples:

* for input or output pins where the pin follows 
```json
"contract" : {
  "role": "follower",
  "payload" : "vmbluType"
}
```
* for request or reply pins that own the contract it is
```json
"contract" : {
  "role": "owner",
  "payload" : {
    "request" : "vmbluType",
    "reply": "vmbluType"
  }
}
```

Keep the blueprint lean and deterministic. Avoid duplicating payload shapes in multiple places; define once in `types` and reference in the contract payload.

## A.4 Connections

Connections are always made between pins. Interfaces are organizational only and are never connection endpoints.
Connections between pins are specified in the `connections` array. Message flow is from `src` to `dst`. `src` is always one pin address. `dst` is either one pin address or an array of pin addresses. A `dst` array means that one source pin fans out to a logical group of destination pins. The fanout group is part of the authored model and should be preserved by model-aware tools unless the user explicitly edits it into separate connections.

Pin addresses are specified by the name of the pin and the name of the node. If the name of the node is omitted it is supposed to be a pin of the group node that contains the connection. This is the only way to receive messages from or send messages to the outside of the group node.

Interfaces help humans, agents and editors understand related pins and may be used as authoring aids, but the saved `.mod.blu` connection model contains explicit pin addresses. Do not store interface addresses in `src` or `dst`. Do not store arrays in `src`; grouping is expressed only as one source pin with one or more destination pins.

This means that the following connections are valid

* src: output pin @ node, dst : input pin @ node 
simple connection 
* src: output pin @ node, dst : array of input pins @ nodes
one-to-many fanout
* src: request pin @ node, dst reply pin @ node 
request/reply 
* src: request pin @ node, dst : array containing at most one reply pin and zero or more input pins @ nodes
request fanout, where input destinations can listen but not reply and reply semantics remain unambiguous
* src: request pin @ node, dst: input pin @ node 
input pin can listen to requests, but not reply
* src: output pin @ node, dst: output pin
An output pin of a node is connected to an output pin of the containing group node
* src: input pin, dst: input pin @ node
An input pin of the containing group node is connected to an input of a node inside the group node.

For a connection between two pins also the contracts of the pins have to be checked.

* **owner ↔ follower**: valid. The follower must conform to the owner’s `payload`. If there is a conflict, copy the owners's payload type to the follower.
* **owner ↔ owner**: valid only if both owners’ `payload` values match. If they do not match, the connection is invalid unless one side is changed to `follower`.
* **follower ↔ follower**: invalid. To make it valid, upgrade one side to `owner` and match the follower's contract payload to that of the owner.

Implementation obligations:

* When connecting a follower to an owner, adapt the follower implementation (or add an adapter node) so its payload handling conforms to the owner’s `vmbluType`.
* Changing an owner’s `vmbluType` is a breaking change for all connected followers; update them accordingly.
* Changing a pin’s role (`owner` ↔ `follower`) is an architectural decision. Do it deliberately and update connections/implementations accordingly.
* If a connection is invalid under the rules above, either:

  * adjust roles, or
  * introduce an explicit adapter node, or
  * change payload types (as a conscious breaking change).

## A.5 Pin Message Handlers

Every **input** or **reply** pin corresponds to a message handler in the node implementation.

The naming convention for a handler is as follows:

- Handler name is `on<PinNameInCamelCase>`.
- Example:
    - Pin: `"name": "saveMessage", "kind": "input"`
    - Handler: `onSaveMessage(payload)`

This uniform convention ensures LLMs and the editor can always map pins to their corresponding handler.

Do not return a value from a handler, it is ignored.

## A.6 Pin prompts

A **pin prompt** is a short, natural-language description written primarily for an LLM during the **design phase** of a system.

It serves as:

* semantic guidance for generating handlers and emitters,
* a reminder of *why* a pin exists,
* a clarification of *when* a pin is used.

It is **not** a specification and **not authoritative**. Do not duplicate in a prompt what is in the pin contract.

## What a Pin Prompt Should Answer

Depending on pin kind, the prompt should answer **one core question**.

* Output pins: *When do I emit, and why?*
* Input pins: *What do I do when a message arrives?*
* Request pins: *What is being requested, and for what purpose?*
* Reply pins: *What does this reply confirm or return?*

A pin prompt must **not**:

* Describe payload fields or structure
  (that belongs in `types`)
* Repeat `vmbluType`
* Define validation rules
* Impose constraints not expressible elsewhere
* Explain internal implementation details

Avoid phrases like:

* “This pin sends an object containing…”
* “The payload has fields…”
* “Must always / must never…”

## Length and Form

* **1–2 sentences**
* **Present tense**
* **Plain language**
* No lists, no markdown, no long explanations

Think: *intent note*, not documentation.

## Examples

* output: *“Emits updated orbital parameters whenever the simulation time advances. Trigger: after physics integration.”*
* input: *“Applies incoming orbit updates to update the rendered trajectory.”*
* request: *“Requests the active camera data.”*
* reply: *“Returns the spec of the active camera to the requestor.”*

## A.7 Prompt repositories

Node and pin prompts are part of the model, but they do not have to be stored inline in the `.mod.blu` file. A node may use `promptRepo` to point to a model-owned markdown file containing both.

Use external prompt files as the normal form for non-trivial models. This keeps the structural model - nodes, interfaces, pins, contracts and connections - readable for humans and coding agents while still keeping design prompts under model ownership.

### PromptRepo object

`promptRepo` belongs on a non-dock node. Dock nodes do not have their own prompts; they get their meaning from the linked node.

The `promptRepo` object contains:

```json
{
  "arl": "./prompts/NodeName.md",
  "pathKind": 2
}
```

- `arl` is resolved relative to the current model file.
- `pathKind` uses the same values as vmblu `Path.Kind`.
- Do not store runtime state such as `is.hydrated` in the model. Hydration status is runtime-only.

During initial model creation, agents may write `prompt` fields inline on nodes and pins as an authoring convenience. Tools may read these inline prompts, but when saving prompts they should prefer `promptRepo` files so inline prompts disappear over time.

### File layout

Use one markdown prompt file per non-dock node. The conventional folder is `prompts/` next to the model file:

```text
model/
  server.mod.blu
  prompts/
    Transport.md
    Authentication.md
    DataCenter.md
```

For nodes inside a group node, place child prompt files in a folder named after the group node:

```text
model/
  prompts/
    GroupNode.md
    GroupNode/
      ChildNode.md
      OtherChildNode.md
```

A group node may therefore have both its own prompt file and a folder for its child nodes.

### Markdown format

Prompt repository files reserve two headings so node and pin prompts can share one document:

```md
# NodeName

## Node

The node prompt can use whatever Markdown organization is useful.

## Pins

### interface.pin-name

Pin-level prompt text.
```

Everything inside `## Node` is one free-form node prompt. There is no required set or order of subsections within it; authors may use anything from a short paragraph to a detailed document. `## Pins` contains one `###` subsection per pin, using the exact pin name from the model. Tools preserve the complete repository text when it is edited through the prompt window.

Do not duplicate node kind, interfaces, pins, contracts, connections, types, factories, runtime settings or capabilities unless that context materially improves the prompt. Those structural model fields remain authoritative. Relative Markdown links resolve from the prompt repository file.

Pin prompts remain concise behavioral prompts as described in A.6, but hydrate from and save to their owning node's prompt repository.

### Guidance for coding agents

When refining or implementing a node, inspect the structural model first: node kind, factory, interfaces, pins, contracts, connections, types, runtime settings and capabilities. Then read the complete `promptRepo` file, if present.

Prompts are guidance. Contracts, types, capabilities, runtime settings and source code remain the authoritative sources for executable behavior. When code has been implemented and later diverges from an old prompt, prefer the current model and source code over stale prompt text unless the user explicitly asks to update the prompt.

## A.7.1 Test specification repositories

Model-level test intent has an independent lifecycle from implementation prompts. A source or group node may therefore declare a `testRepo` that points to a model-owned Markdown test specification:

```json
{
  "testRepo": {
    "arl": "../tests/nodes/Orders/Validator.md",
    "pathKind": 2
  }
}
```

`testRepo` is optional and uses the same path representation as `promptRepo`. Its `arl` is resolved relative to the model file. Absence means that no model-level tests are currently specified; it does not make the node invalid.

The conventional project layout is `tests/nodes/` for source and group nodes and `tests/app/application.md` for the root group's application scenarios. Node hierarchy is mirrored in `tests/nodes/`: a group has its own files beside a same-named directory containing its children. The authored `.md` specification, generated `.test.json` artifact, and latest `.result.json` report use the same basename.

A dock node must not declare `testRepo`. Its linked source or group definition owns the test specification. An importing model may resolve and read that specification, but must not save it. Behaviour specific to the importing model belongs in that model's group or application tests.

Test specifications describe behaviour at node, group, or application boundaries. They do not replace pin contracts, implementation prompts, runtime settings, or code-level tests. Generated artifacts record specification and contract fingerprints; results record the artifact fingerprint so stale evidence is detectable.

## A.8 Request / Reply Semantics

A Request/Reply connection allows to group a message and the response to that message in one exchange. 
Because the Request/Reply connection consists of two data exchanges, the request and the reply, the contract for the pin in the owner-role contains two vmbluTypes: one for the request and one for the reply.

- A **request pin** is an **output pin**.
    - It is used by the requester node to initiate a request with `tx.request('pinName', payload)`.
    - This function returns a **Promise** which resolves when the callee replies. The **Promise** is generated and managed by the runtime.

- A **reply pin** is an **input pin** on the callee.
    - It receives the request payload and has a handler like any input pin.
    - Inside this handler, the callee must call `tx.reply(payload)` to respond to the requester.
    - The runtime delivers this reply on the backchannel and resolves the requester’s Promise.
    - Note that the handler return value is ignored, optional async only to await internal work.
    - If tx.reply is not called, the request promise will simply time out.

- **Connections**:
    - Normally, `request` pins connect to `reply` pins.
    - It is also valid to connect a `request` pin to an `input` pin (e.g. for logging or monitoring), but in that case no reply is sent.

    Typical use of request/reply

    The requesting node issues a request and then waits for the reply

    ```js
    tx.request('pinName', requestPayload).then ( replyPayload => {

      // handle the reply from the other node
      ...
    })
    ```

    The receiving node has a handler for the request

    ```js
    onPinName(requestPayload) {
      // does some processing
      ...
      // and replies to the requesting node
      tx.reply(replyPayload)
    }
    ```

## A.9 Factory Function Signature

A source node references its implementation via a **factory** object (`path` + `function`).  
The factory function is called by the runtime to create the node instance.

The runtime will detect if the factory function is a generator function or a class name and will call the factory function in that case as follows: `new factoryFunction(...)`

In order to let documentation tools find the handlers of a node, add a _node_ JSdoc tag in the file where the handlers are defined.
The tage remains valid until the end of the file or until a new node tag is defined.

- Signature:

    ```js
    /**
     * @node node name
     */
    export function createMyNode( tx, sx ) { ... }
    ```

- tx: object exposing runtime message functions (send, request, reply).
- sx: arbitrary initialization data supplied by the model. sx can be null.
- rx: not passed to the node. Runtime-only directives; used by the runtime to decide how/where to host the node (e.g. worker thread, debug flags).

## A.10 Dock Nodes and Drift

- A dock node references another node defined in a different file via a link.
- Pins and connections of the dock node are kept in the importing file.
- If the external node definition changes, the editor highlights differences (“drift”) between the dock node and its linked definition.

## A.11 Agent Capabilities

Vmblu exposes application behaviour to coding agents and LLM clients through model-defined capabilities. Capabilities are declared in the blueprint and generated into a capability manifest with `vmblu make-capabilities <entrypoint>.blu`.

The capability manifest is the canonical agent-facing description. MCP tool descriptions and provider-specific function/tool schemas are adapters over that manifest, not the source of truth.

Capability exposure is explicit. A handler, node or pin is not exposed to an agent merely because it exists in source code. The model must declare the capability metadata.

There are three capability kinds:

- **Tools** are operations an agent may call to change application state or trigger behaviour.
- **Probes** are read-only observations an agent may use to inspect or verify application state.
- **Events** are asynchronous observations emitted by the application and made visible to the agent runtime.

### Tools

A tool is declared on a pin with `tool.enabled: true`. Tools normally belong on input or reply pins, because the tool broker dispatches a tool call into the vmblu runtime by sending a message to the declared node and pin.

Tool metadata should include a stable `id`, a human-readable `title`, a precise `description`, and risk/approval policy where relevant. If `schema` is omitted, the generated capability manifest derives the input schema from the pin contract. The derived capability stores the runtime binding in its `input` object: target node, target pin, reference, payload type and JSON schema.

Use `effects` to document the expected consequence of a tool call. Effects can name probes and events that should be used to verify the result. This is important for agents: a tool call should not be treated as successful only because it was accepted by the runtime.

### Probes

A probe is declared on a source node in the node's `probes` array. A probe must be read-only from the agent's point of view.

Probe metadata should include a stable `id`, optional implementation `name`, `title`, `description`, `kind`, `schema` and `binding`. The `kind` describes the observation type:

- `state`: direct state held by the node.
- `derived`: calculated state derived from node data.
- `runtime`: runtime or instrumentation state.
- `custom`: application-specific observation.

At runtime, probes are read through the tool broker. The agent runtime registers node probe readers and calls the node implementation through a probe function. A source node that declares probes should implement a probe reader, for example `probe(name, args)`, and return JSON-safe data that matches the probe schema.

Do not use a probe to mutate state, trigger work, or hide an operation that should be a tool. If a read requires expensive work or has side effects, model it as a tool instead.

### Events

An event is declared on a pin with `event.enabled: true`. Events normally belong on output or request pins, because they describe application observations emitted by a node.

Event metadata should include a stable `id`, `title`, `description` and `schema`. If `schema` is omitted, the generated capability manifest derives it from the pin contract. The derived capability stores the source node and pin so the tool broker can recognize matching runtime messages and record them as observed events.

Agents can use events to wait for asynchronous outcomes or to verify tool effects. Prefer events for things that happened, and probes for state that can be inspected on demand.

### Runtime Flow

Agent interaction should enter a vmblu application through the capability adapter, tool broker and runtime message queue. This keeps agent interaction inside the same architecture as normal application messages:

```text
agent or provider adapter
  -> capability manifest
  -> ToolBroker
  -> vmblu runtime
  -> target node/pin, probe reader, or observed event
```

MCP remains useful as an adapter format, but the blueprint capability metadata is the authoritative model. Do not mark handlers with source-level tags to expose them as agent tools; define tools, probes and events in the model.

## A.12 Architecture-First Model Design

Vmblu models can be used before implementation details are known. During early design, it is valid and often useful to model a system as a small number of coarse responsibility nodes with provisional pins and broad payload types. This gives humans and agents a concrete graph to discuss without forcing premature implementation decisions.

Start general and refine step by step:

- Begin with the major responsibility areas and runtime boundaries.
- Use group nodes for architectural areas that may later contain subnodes.
- Add only the pins needed to show important message flow.
- Use clear but provisional type names when payload contracts are not stable yet.
- Refine node boundaries, pins, interfaces and contracts when the model reveals ambiguity or when implementation needs become clearer.
- Split a node when it contains distinct ownership, security, lifecycle, observability or failure-mode concerns.
- Keep a node coarse when splitting would only create routing noise.

Do not treat an early model as incomplete merely because it lacks final source nodes, precise payload fields or exhaustive pins. The purpose of the early model is to make the current architectural hypothesis inspectable. A good first model should be readable, discussable and easy to change.

When moving from architecture to implementation, make the refinement explicit. Replace broad payload types with structured types, promote group nodes to source nodes only when an implementation unit is ready, and add pin prompts or capability metadata only when they clarify actual behavior.

## A.13 AI Generation Guidelines

For LLMs working with vmblu files:

Additional rules for architecture and model authoring:

- Use `blu.schema.json` and this annex as the canonical authoring guidance. Do not infer vmblu rules from existing examples unless the schema and annex are insufficient; if they are insufficient, report the gap.
- Edit semantic model files such as `.mod.blu`. Do not edit `.mod.viz` files unless the user explicitly asks for visual layout changes. `.mod.viz` files are editor-maintained view state.
- Do not generate or edit source-profile files such as `.src.prf` during architecture-only work. Source profiles are useful when source exists and are normally created by vmblu tooling or the editor.
- Do not run source generation, profile generation, application builds or capability generation merely to validate an architecture sketch. Prefer schema/model validation until implementation work begins.
- Preserve the user's current design level. If the user is discussing responsibility areas, do not jump directly to implementation nodes, source factories, generated code or final contracts.

- Respect node and pin names — do not rename unless explicitly asked.
- When generating source code for the nodes in the vmblu file, only generate code for the nodes, the _main_ function and node setup is generated directly from the vmblu file itself.
- When changing code for an application only change the code for the nodes, not the application file that was generated. That file will be re-generated by the editor.

## A.14 Optional system context discovery

A vmblu project may, but does not have to, author a system-level description of
how several applications and external systems interact. The presence of a
`system/` directory is an organizational choice and must not be required for an
application model to load, build, or run.

An explicitly supplied `*.sys.blu` configuration path always takes precedence.
This allows a user, task, prompt, editor, or CLI option to select an alternative
configuration deliberately.

Without an explicit selection, discovery starts in the directory containing
the application's root `.blu` entrypoint. At each directory, the agent checks
this relative path:

```text
system/active.sys.blu
```

The search proceeds upward through ancestor directories, stops at the workspace
boundary, and returns the nearest match. It must not inspect ancestors outside
that boundary. If the file exists, it is the active authored system
configuration. There is no root `.sys` entrypoint and no redirect file such as
`active.sys`. Other
`*.sys.blu` files in the directory are alternative configurations and are
opened only when explicitly selected; their presence does not make them active.
If `system/active.sys.blu` is absent, the project has no discoverable authored
system context. This is valid and agents must not create or migrate system
documents merely to satisfy discovery.

The `system/` directory may also group prompts, documentation, contracts, or
other useful material, but directory placement never creates an implicit
relationship. Every such relationship remains an explicit reference in the
active `*.sys.blu` document. Application entrypoints and application models do
not contain back-references to the system configuration.
