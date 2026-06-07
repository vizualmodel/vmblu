# Annex A: Semantic Clarifications for blu.schema.json

This annex captures subtle semantic points that are not fully enforceable in the JSON Schema but are critical for correct usage of the vmblu format by both humans and LLMs.

## A.1 Nodes

A source node represents an indivisible implementation unit, whereas a group node is a purely architectural composition of nodes. 
A source node can represent a UI element, the access to a database, a login procedure, a 3D scene list etc.
The name of a node should be meaningful and unique inside a group node.
The prompt for a node should be a clear, concise and up-to-date description of its function.

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

## A.7 Request / Reply Semantics

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

## A.8 Factory Function Signature

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

## A.9 Dock Nodes and Drift

- A dock node references another node defined in a different file via a link.
- Pins and connections of the dock node are kept in the importing file.
- If the external node definition changes, the editor highlights differences (“drift”) between the dock node and its linked definition.

## A.10 Agent Capabilities

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

## A.11 Architecture-First Model Design

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

## A.12 AI Generation Guidelines

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
