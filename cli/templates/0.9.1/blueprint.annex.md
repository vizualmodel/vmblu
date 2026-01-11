# Annex A: Semantic Clarifications for blueprint.schema.json

This annex captures subtle semantic points that are not fully enforceable in the JSON Schema but are critical for correct usage of the vmblu format by both humans and LLMs.

## A.1 Nodes

A source node represents an indivisible implementation unit, whereas a group node is a purely architectural composition of nodes. 
A source node can represent a UI element, the access to a database, a login procedure, a 3D scene list etc.
The name of a node should be meaningful and unique inside a group node.
The prompt for a node should be a clear, concise and up-to-date description of its function.

## A.2 Interface names and Pin names

- Pins are grouped in **interfaces**
- There can only be one anonymous interface (name is ""), this is acceptable for nodes that only have a few pins.
- Group pins together into meaningful interfaces
- Use the following convention when giving a name to a pin: if the pin belongs to an interface start the name with the name of that interface followed by a period. If the rest of the name is more than one word, separate the words by a hyphen. Examples: _file.save_, _file.save-as_, _file.convert-to-uppercase_, where the interface name is _file_.

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
  * If `role` is `"owner"`, the pin contract must include the payload type
  * If `role` is `"follower"`, the pin must *not* include the payload type

A follower pin has no payload type by itself; it becomes meaningful only when connected. When a follower pin is disconnected, it stays a follower and has no stored payload type.

For input/output pins, the payload type is a single type that refers to a type in the `types`section. For request/reply pins the payload type consists of two types: the request payload and the reply payload. Both types also refer to a type in the `types` section.

A contract can thus have three different forms:

* for pins that follow it is simply
```json
"contract" : {
  "role": "follower"
}
```
* for input or output pins that own the contract it is
```json
"contract" : {
  "role": "owner",
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
Connections between pins are specified in the `connections` array. Message flow is from `src` to `dst`. `src` and `dst` are specified by the name of the pin and the name of the node. If the name of the node is omitted it is supposed to be a pin of the group node that contains the connection. This is the only way to receive messages from or send messages to the outside of the group node.

This means that the following connections are valid

* src: output pin @ node, dst : input pin @ node 
simple connection 
* src: request pin @ node, dst reply pin @ node 
request/reply 
* src: request pin @ node, dst: input pin @ node 
input pin can listen to requests, but not reply
* src: output pin @ node, dst: output pin
An output pin of a node is connected to an output pin of the containing group node
* src: input pin, dst: input pin @ node
An input pin of the containing group node is connected to an input of a node inside the group node.

For a connection between two pins also the contracts of the pins have to be checked.

* **owner ↔ follower**: valid. The follower must conform to the owner’s `payload`.
* **owner ↔ owner**: valid only if both owners’ `payload` values match. If they do not match, the connection is invalid unless one side is changed to `follower`.
* **follower ↔ follower**: invalid. To make it valid, upgrade one side to `owner` and define its `vmbluType`.

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

## A.10 MCP Support

Vmblu supports the Model Context Protocol (MCP). An LLM can directly communicate with nodes of a vmblu application by sending messages to nodes. The node has to indicate which inputs are available as an MCP tool simply by adding the tag 'mcp' before the handler's header:

```js
/**
 * @mcp
 * @param ...
 */
onMessage() {   // handler for the message
  ...
}
```

The messages marked will be assembled by the vmblu editor into a tool file that can be used by an LLM interacting with the application.

## A.11 AI Generation Guidelines

For LLMs working with vmblu files:

- Respect node and pin names — do not rename unless explicitly asked.
- When generating source code for the nodes in the vmblu file, only generate code for the nodes, the _main_ function and node setup is generated directly from the vmblu file itself.
- When changing code for an application only change the code for the nodes, not the application file that was generated. That file will be re-generated by the editor.


