# Annex A: Semantic Clarifications for vmblu v0.8

This annex captures subtle semantic points that are not fully enforceable in the JSON Schema but are critical for correct usage of the vmblu format by both humans and LLMs.

---

## A.1 Request / Reply Semantics

- A **request pin** is an **output pin**.  
  - It is used by the requester node to initiate a request with `tx.request('pinName', payload)`.  
  - This function returns a **Promise** which resolves when the callee replies.

- A **reply pin** is an **input pin** on the callee.  
  - It receives the request payload and has a handler like any input pin.  
  - Inside this handler, the callee must call `tx.reply(payload)` to respond to the requester.  
  - The runtime delivers this reply on the backchannel and resolves the requester’s Promise.

- **Connections**:  
  - Normally, `request` pins connect to `reply` pins.  
  - It is also valid to connect a `request` pin to an `input` pin (e.g. for logging or monitoring), but in that case no reply is sent.

---

## A.2 Handler Naming

Every **input** or **reply** pin corresponds to a message handler in the node implementation.  

- Handler name is `on<PinNameInCamelCase>`.  
- Example:  
  - Pin: `"name": "saveMessage", "kind": "input"`  
  - Handler: `onSaveMessage(payload)`  

This uniform convention ensures LLMs and the editor can always map pins to their corresponding handler.

---

## A.3 Factory Function Signature

A source node references its implementation via a **factory** object (`path` + `function`).  
The factory function is called by the runtime to create the node instance.

In order to let documentation tools find the factory function add a *node* JSdoc tag before the function.

- Signature:  
  ```js
  /**
   * @node node name
   */
  export function createMyNode( tx, sx ) { ... }
  ```

- tx: object exposing runtime message functions (send, request, reply).
- sx: arbitrary initialization data supplied by the model.
- rx: not passed to the node. Runtime-only directives; used by the runtime to decide how/where to host the node (e.g. worker thread, debug flags).

## A.4 Dock Nodes and Drift

- A dock node references another node defined in a different file via a link.
- Pins and connections of the dock node are kept in the importing file.
- If the external node definition changes, the editor highlights differences (“drift”) between the dock node and its linked definition.

## A.5 Buses and Pads

A bus simplifies routing:

- Outputs connected to a bus are forwarded to inputs of the same name.
- Buses do not introduce new message names; they only group routes.

Pads are how group nodes expose their internal pins externally.
- If a connection omits the node in its address, it refers to a pad on the group itself.

## A.6 Connections

A connection is between pins or interfaces.

For a connection between pins, the message flow is from 'src' to 'dst'. So 'src is either an ouput pin of a node or an input pin of the containing group node (a pad in the editor) and 'dst' is either an input pin of a node or an ouput pin of the containing group node.

When connecting interfaces the *ouput pins* of the interface are connected the *input pins* with the same name, of the interface on the other node, and in the same way the *input pins* of the interface are connected to the *output pins* with the same name of the interface connected to on the other node. Not all pins have to be present in both interfaces.

## A.7 AI Generation Guidelines

For LLMs working with vmblu files:

- Respect node and pin names — do not rename unless explicitly asked.
- Connection rules — only connect compatible pins:

    - output → input
    - request → reply

- Reply requirement — every new request pin should be connected to at least one reply pin.
- Do not edit editor fields — they are for the graphical editor only.

When generating source code for the nodes in the vmblu file, only generate code for the nodes, the *main* function and node setup is generated directly from the vmblu file itself.
