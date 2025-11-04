# Annex A: Semantic Clarifications for vmblu v0.8

This annex captures subtle semantic points that are not fully enforceable in the JSON Schema but are critical for correct usage of the vmblu format by both humans and LLMs.

## A.1 Nodes

A source node groups the functionality of a system that belongs logically together. A source node can represent a UI element, the access to a database, a login procedure, a 3D scene list etc.

The name of a node should be meaningful and unique inside a group node.

## A.2 Interface names and Pin names

- Pins are grouped in **interfaces**
- There can only be one anonymous interface (name is ""), this is acceptable for nodes that have only a few pins.
- Group pins together into meaningful interfaces
- It is good practice to start a pin name with the name of the interface separated by a period or hyphen.

## A.3 Handlers

Every **input** or **reply** pin corresponds to a message handler in the node implementation.

The naming convention for a handler is as follows:

- Handler name is `on<PinNameInCamelCase>`.  
- Example:  
  - Pin: `"name": "saveMessage", "kind": "input"`  
  - Handler: `onSaveMessage(payload)`  

This uniform convention ensures LLMs and the editor can always map pins to their corresponding handler.

Do not return a value from a handler, it is ignored.

## A.4 Request / Reply Semantics

A Request/Reply connection allows to group a message and the response to that message in one exchange.

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
  tx.request('pinName', payload).then ( replyPayload => {

    // handle the reply from the other node
    ...
  }) 
  ```

  The receiving node has a handler for the request
  ```js
  onPinName(payloed) {
    // does some processing
    ...
    // and replies to the requesting node
    tx.reply(replyPayload)
  }
  ```

## A.5 Factory Function Signature

A source node references its implementation via a **factory** object (`path` + `function`).  
The factory function is called by the runtime to create the node instance.

The runtime will detect if the factory function is a generator function or a class name and will call the factory function in that case as follows: `new factoryFunction(...)`

In order to let documentation tools find the handlers of a node, add a *node* JSdoc tag in the file where the handlers are defined.
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

## A.6 Dock Nodes and Drift

- A dock node references another node defined in a different file via a link.
- Pins and connections of the dock node are kept in the importing file.
- If the external node definition changes, the editor highlights differences (“drift”) between the dock node and its linked definition.

## A.7 Buses

A bus simplifies routing:

- Outputs connected to a bus are forwarded to inputs of the same name.
- Buses do not introduce new message names; they only group routes.

Buses are created in the editor by the user to improve the readability of the vmblu diagram.

## A.8 Pads

Pads are how group nodes expose their internal pins externally.
If a connection omits the node in its address, it refers to a pad on the group itself.

## A.9 Connections

A connection is between pins or interfaces.

For a connection between pins, the message flow is from 'src' to 'dst'. So 'src is either an ouput pin of a node or an input pin of the containing group node (a pad in the editor) and 'dst' is either an input pin of a node or an ouput pin of the containing group node.

When connecting interfaces the *ouput pins* of the interface are connected the *input pins* with the same name, of the interface on the other node, and in the same way the *input pins* of the interface are connected to the *output pins* with the same name of the interface connected to on the other node. Not all pins have to be present in both interfaces.

## A.10 AI Generation Guidelines

For LLMs working with vmblu files:

- Respect node and pin names — do not rename unless explicitly asked.
- Connection rules — only connect compatible pins:

    - output → input
    - request → reply

- Reply requirement — every new request pin should be connected to at least one reply pin.
- Do not edit editor fields — they are for the graphical editor only.
- When generating source code for the nodes in the vmblu file, only generate code for the nodes, the *main* function and node setup is generated directly from the vmblu file itself. 
- When changing code for an application only change the code for the nodes, not the application file that was generated. That file will be re-generated by the editor.