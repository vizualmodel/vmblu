# vmblu: An AI-Native Architecture for Building Software as Message-Passing Models

*White Paper — v1.0 (2025-09-30)*

> **Abstract.**
> LLMs accelerate coding but degrade architecture: context scatters, contracts drift, and systems become hard to reason about. **vmblu** addresses this by making the system’s architecture **explicit, executable, and AI-readable**. Applications are modeled as **nodes** connected by **pins** and **routes**, with **buses** for scalable wiring. The model is the app: it generates a runnable entry file, keeps source code linked through **pin profiles**, and exports **MCP tools** from annotated handlers. This paper explains the rationale, model, runtime, AI workflows, testing approach, migration path, and roadmap.

---

## 1) Executive Summary

Modern teams “vibe code” with LLMs and move fast—until systems scale. Architecture dissolves into tacit knowledge and scattered prompts. **vmblu** restores clarity by putting architecture at the center:

* **Explicit & executable**: The model is a JSON document that doubles as the app’s wiring diagram. It compiles to a runnable entry file.
* **AI-native**: The format is designed for LLMs. Pin profiles are extracted from source; MCP tools are generated from JSDoc-tagged handlers.
* **Parallelizable**: Nodes are independently implementable by multiple developers or LLMs, guided by a shared contract.
* **Incrementally adoptable**: Wrap existing code as nodes; refactor later into group nodes without changing external behavior.
* **Small runtime**: A lean message switch with request/reply, workers, and debugging. No framework lock-in.

**Outcome:** faster feature throughput *and* sustained architectural integrity.

---

## 2) Problem Framing: Software in the LLM Era

**The upside**: LLMs reduce time-to-code, generate boilerplate, and fill API gaps.
**The downside**: they also blur architectural boundaries.

* **Context fragmentation**: Prompts drift; assumptions diverge between sessions/LLMs.
* **Contract drift**: “What does this function accept/emit?” becomes uncertain.
* **Scaling pain**: As the app grows, ad-hoc glue becomes an untestable web.

**Hypothesis:** If the *architecture itself* becomes a first-class artifact—machine-readable and executable—then humans and LLMs can collaborate safely, repeatedly, and at scale.

---

## 3) Design Goals

1. **AI-Native by Construction**

   * JSON schema that LLMs can read and write.
   * Pin **profiles** extracted from code; **MCP tools** generated from the same source.

2. **Explicit, Composable Architecture**

   * Nodes, pins, interfaces, routes, buses, pads—simple, orthogonal primitives.
   * **Group nodes** for hierarchical composition.

3. **Parallel Work without Coordination Debt**

   * Stable, visible contracts allow many contributors/LLMs to implement nodes independently.

4. **Incremental Migration**

   * Wrap legacy code as source nodes; link and refactor over time.

5. **Small, Predictable Runtime**

   * Message queue + request/reply + optional workers + clear diagnostics.

---

## 4) The vmblu Model

> **Figure 1 (conceptual)**: Nodes with input/output pins, routes, busbar/cable, group pads.

### 4.1 Nodes

* **Source node**: has code (factory/class).
* **Group node**: contains a sub-model; behaves externally as one node.
* **Linked node**: reference to a node in another file or bundle (padlock when code is not present).

### 4.2 Pins & Interfaces

* **Input pins** map to handlers named `onX` (case-insensitive normalization; `“set canvas size” → onSetCanvasSize`).
* **Output pins** are used in code via `tx.send('pin name', payload)`.
* **Request/Reply**: output/input with a back-channel (promise semantics). `tx.request(...)`, `tx.reply(...)`, `tx.next(...)`.
* **Interfaces**: group pins under a common name; lightweight name composition (`. - _ +`) keeps labels human-readable while preserving uniqueness.

### 4.3 Routes

* Orthogonal layout for clarity (x/y segments).
* Output → Input; names need not match (data contract is in code, surfaced through profiles).

### 4.4 Buses

* **Busbar**: broadcast; connect all outputs to all inputs.
* **Cable**: connects same-named pins; ideal for symmetric interfaces.
* **Router (on a cable)**: at runtime, selects actual recipients from name-matched candidates. This keeps diagrams clean while enabling selective fan-out.

### 4.5 Pads (Group IO)

Pads expose a group node’s external pins within the group’s internal view. Pins can be “extruded” into pads for clarity.

---

## 5) JSON & Schema Rationale

> **Figure 2 (excerpt)**: Minimal model: header, factories, root group with nodes and routes.

A vmblu file has:

```json
{
  "header": {
    "version": "1.0",
    "description": "…",
    "runtime": "@vizualmodel/vmblu"
  },
  "models": [],
  "factories": [{ "key": "_", "path": "./src" }],
  "root": { "group": "Root", "pins": [], "nodes": [], "routes": [], "prompt": "…" }
}
```

**Why JSON?**

* Familiar, diff-friendly, LLM-friendly.
* Enables **template → instantiate → run** workflows.

**Factories**

* By convention, `_` resolves `./src/index.js`, which re-exports node factories. This keeps models terse and source organization flexible.

**LLM-oriented details**

* **Pin profiles** (human text + types) carry enough structure for code generation.
* **Suggested future fields** (optional):

  * `profiles.pinTypes` (nominal/structural hints),
  * `suggestedRoutes` (editor AI assistance),
  * `routingRules` (required vs optional connections).

---

## 6) Runtime Architecture

> **Figure 3**: Message queue; node handler calls; request/reply lifecycle.

**Core loop**

* Messages enter a queue.
* Runtime dispatches to target handlers; each handler may emit further messages.
* End of queue → idle; new messages awaken the loop.

**API surface (`tx`)**

* `tx.send(pin, payload) → numberDelivered`
* `tx.request(pin, payload, { timeout? }) → Promise`
* `tx.reply(result)`, `tx.next(partial)`
* `tx.reschedule()` (requeue current message; useful for order coordination)
* `tx.pin` (originating output pin name)
* `tx.wireless(nodeName)` (direct send/request without a route; reserved for MCP/test nodes)

**Workers & diagnostics**

* Nodes may opt into workers (via `dx` runtime settings).
* Console warnings for missing handlers or pins (e.g., `** NO HANDLER **`, `** NO OUTPUT PIN **`).
* Logging hooks for traffic introspection.

**Performance notes**

* Dispatch tables precomputed from routes/buses.
* Routers run only on cables with potential multiple recipients.
* Architecture is message-centric; scale by splitting nodes and using cables/routers.

---

## 7) Source Integration & Profiles

**Factories**

* `(tx, sx) → objectWithHandlers`.
* `sx`: node settings from the cog icon.
* `dx`: runtime hints (workers, logging), not passed to the node.

**Handler discovery**

* Input pins map to `onX` handlers by naming convention.
* **ts-morph** (or equivalent) extracts:

  * Handler locations for **input profiles**.
  * Literal `tx.send('…')` callsites for **output profiles**.
* JSDoc tags guide extraction:

  * `@node <name>` — associates handlers in file with a node.
  * `@prompt <text>` — concise purpose statement for LLMs.
  * `@mcp` — mark handlers to expose as MCP tools.

**MCP export**

* During “Make app”, vmblu can generate a tools file containing the MCP tool specs from `@mcp`-tagged handlers. This turns your model into a tool surface for LLMs.

---

## 8) AI Collaboration Patterns

### 8.1 Single-LLM loop

1. Author/modify the model (nodes, pins, routes).
2. Ask the LLM to generate/adjust handlers for selected nodes (guardrails below).
3. Check profiles; run; iterate.

### 8.2 Multi-LLM parallelization

* Assign nodes or groups to separate LLMs.
* Use stable pin names/interfaces as the contract.
* Use **linked nodes** to share structure across files, accepting changes as they land.

### 8.3 Guardrails (copy into prompts)

* Do **not** rename pins or interfaces.
* Keep factory signature `(tx, sx)` and name handlers `onX`.
* Use literal strings for `tx.send('pin name', …)` (no aliasing).
* Add `@node`, `@prompt`, `@mcp` where applicable.

### 8.4 Review tactics

* **Profiles as review surface**: compare handler signatures & `tx.send` sites before running.
* Prefer **cables + routers** for selective fan-out over complex route spaghetti.
* Frequent request/reply between the same pair? Consider merging into a group node.

---

## 9) Testing in the LLM Era

> **Two pillars**: **Trustworthiness** (it does what it should) and **Efficiency** (it does it fast enough).

**Patterns**

* **Test node (mirror)**: auto-generate a node that inverts IO (inputs ↔ outputs) to exercise a target node in isolation.
* **Contract checks**: probe handlers with schema-backed payloads (from profiles).
* **Golden traces**: record message traces for scenarios; replay after changes.
* **Interface conformance**: for cables, verify same-named pins across nodes behave consistently.
* **Performance guards**: cap routing fan-out; detect long request chains/timeouts.

**LLM-assisted tests**

* Ask LLMs to propose edge cases from handler prompts & types.
* Generate property-based tests from pin profiles.

---

## 10) Comparative Landscape

* **Flow-based tools (Node-RED, NoFlo)**: similar graph metaphor, but vmblu centers **LLM-readable contracts** and code integration (profiles/MCP).
* **ECS / data-oriented**: excellent for performance; vmblu favors **message clarity** and LLM collaboration.
* **Service meshes / microservices**: solve cross-service concerns; vmblu focuses on **in-app architectural clarity** (though the model could describe service boundaries too).
* **Low-code builders**: prioritize non-dev UX; vmblu is **developer-centric** and keeps code first-class.

**Trade-offs**

* vmblu doesn’t enforce cross-node types at runtime; enforcement is via code + profiles.
* Requires discipline to keep pin names stable; the editor helps (linked nodes, accept changes).

---

## 11) Migration Path

1. **Wrap single component** as a source node; add 1–2 routes to exercise it.
2. **Extract neighbors** over time; convert bundles of routes to **cables** (then add **routers** if needed).
3. **Promote to group node** when internals deserve a sub-model.
4. **Split across files** and **link nodes** for reuse; accept changes to propagate structure.
5. **Adopt MCP** to expose select handlers to tooling or copilots.

---

## 12) Security & Safety Notes

* **Message boundaries**: treat payloads as untrusted; validate at handlers.
* **Wireless**: restrict to testing, diagnostics, or well-scoped orchestrators (MCP/test nodes).
* **Workers**: isolate heavy/unsafe computations.
* **MCP exposure**: export only `@mcp`-tagged handlers; document rate limits, auth, and expected side effects.

---

## 13) Governance, Versioning, and Schema

* **Semantic versioning** for schema and runtime.
* Models embed a `header.version` and `header.runtime`.
* **Linked nodes**: changes are explicit; the editor shows additions/removals in green/red and supports “Accept changes.”

**Editor-assisted governance (future)**

* “Suggested routes” from AI; PR-style change reviews for model edits; policy checks (e.g., “no wireless in production builds”).

---

## 14) Roadmap

* **Docgen v2**: full TypeScript support; incremental updates on file change.
* **Enhanced buses**: typed/interface-level routing hints; bus health metrics.
* **AI assist in editor**: propose nodes/routes from natural language; highlight contract violations; auto-generate test nodes.
* **Schema evolutions**: optional pin types, suggested routes, routing rules (required/optional), richer profiles.
* **Deeper MCP**: end-to-end “model as tools” with permissions and auditing.

---

## 15) Case Study (Appendix): Solar System Simulation (brief)

> **Figure 4**: Top-level model: UI, Camera Manager, Planet Routers, Renderers.

Highlights:

* **Cables + Router** for planet-specific commands (e.g., `place local camera` filtered by planet name).
* **Group nodes** for complex subsystems (camera controls, ephemerides).
* **Profiles** link “get camera”/“camera update” handlers to source, enabling LLM-guided tweaks to controls without breaking the wiring.
* **MCP tools** for safe external control (e.g., scripted camera placement for demos/tests).

---

## 16) Conclusion

**vmblu** turns architecture into a shared, executable contract between humans and LLMs. With a simple model, a small runtime, and strong source integration, teams can scale code generation without losing the plot. The result is software that remains **navigable, testable, and evolvable**—even as multiple LLMs contribute in parallel.

---

## Appendix A — Minimal Snippets

**Handler mapping**

```js
// Input pin: "set canvas size" → handler:
export function Renderer(tx, sx) {
  return {
    /** @node Renderer @prompt Update canvas size */
    onSetCanvasSize({ width, height }) {
      // …
    }
  }
}
```

**Request/Reply**

```js
// Requester:
const result = await tx.request('get metrics', { scope: 'frame' }, { timeout: 500 });

// Responder:
onGetMetrics() {
  tx.reply({ fps: 60, drawCalls: 1200 });
}
```

**Cable + Router concept**

```txt
[cable: SceneBus] connects same-named pins.
[router: SceneFilter] selects recipients from candidates based on payload. 
```

---

## Appendix B — Glossary (selected)

* **Node**: source/group/linked component.
* **Pin**: input/output connection point.
* **Interface**: group of pins with shared naming context.
* **Route**: wire between pins.
* **Busbar**: broadcast bus.
* **Cable**: same-name-only bus.
* **Router**: selective filter on a cable.
* **Pad**: group node IO exposed internally.
* **Profile**: pin metadata linking model ↔ source.
* **MCP**: Model Context Protocol for exposing handlers as tools.
* **sx/dx**: node settings vs runtime settings.

---

### Acknowledgments

vmblu is developed under **vizualmodel** and used to build itself—browser app and VS Code extension—validating the approach on a real system.

---

If you want, I can also output a **print-optimized PDF version** (with figure frames and page-break hints) or a **website-ready version** with a generated table of contents and linkable section anchors.
