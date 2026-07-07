# vmblu ELK Auto-Layout Specification

## Draft 0.1

## 1. Purpose

Add an optional **Auto Layout** feature to the existing vmblu editor using ELK.js.

The feature calculates initial node placement and route geometry for a vmblu model, then applies the resulting geometry through the existing vmblu model-edit and undo/redo system.

ELK must improve layout and routing without changing vmblu semantics.

The feature applies to the existing message-based vmblu editor. It does not introduce a new model format or alter runtime behavior.

---

## 2. Goals

The first implementation must:

* automatically place visible vmblu nodes in a readable directed layout;
* route normal connections with orthogonal bend points;
* preserve vmblu node, pin, interface, group, and connection semantics;
* use existing vmblu rendering and interaction code;
* apply geometry through controlled edits so auto-layout is undoable;
* save resulting geometry in existing editor/view fields;
* work in both browser and VS Code webview hosts.

The first implementation is intentionally limited to flat models with ordinary node-to-node connections.

---

## 3. Non-Goals for the First Version

Do not implement initially:

* group or compound-node layout;
* nested group routing;
* bus layout;
* special request/reply pair treatment;
* preservation of arbitrary manual route edits;
* incremental interactive layout while dragging;
* automatic layout after every model edit;
* layout of hidden or collapsed content;
* redesign of existing vmblu graphics or route semantics.

Auto-layout must be an explicit user action.

---

## 4. Design Principles

### 4.1 ELK is geometry only

ELK must not own or mutate the vmblu model directly.

```text id="akgi1r"
vmblu semantic model
        ↓
temporary ELK graph projection
        ↓
ELK layout result
        ↓
layout patch
        ↓
existing vmblu edit system
        ↓
editor/view geometry update
```

### 4.2 Preserve model semantics

ELK must not alter:

* node identity;
* node factory;
* pins;
* interfaces;
* connection source or destination;
* request/reply semantics;
* runtime configuration;
* source bindings;
* group membership.

ELK may alter only editor geometry:

* node position;
* optional node dimensions if vmblu permits calculated dimensions;
* route bend points;
* route attachment geometry;
* future group bounds.

### 4.3 vmblu controls port meaning

vmblu decides:

* which pins are visible;
* pin ordering;
* pin side;
* source and destination direction;
* node dimensions;
* whether a connection is eligible for layout.

ELK receives that information as constraints.

ELK decides:

* node placement;
* route geometry;
* edge bend points;
* crossing reduction;
* directed layering.

### 4.4 Layout must be undoable

Applying an auto-layout result must create one structured undoable edit.

```text id="lmr8i1"
Auto Layout
    ↓
layout patch generated
    ↓
single vmblu edit transaction
    ↓
undo restores previous geometry
    ↓
redo reapplies generated geometry
```

---

## 5. Dependency

Use ELK.js.

The expected layout algorithm is ELK Layered, which is designed for directed node-link diagrams with explicit ports. ELK Layered supports orthogonal routing and port constraints, including fixed port sides and port order.

Suggested package:

```text id="nypxu2"
elkjs
```

Do not add a graph-editor framework.

---

## 6. User Experience

### 6.1 Command

Add an explicit editor command:

```text id="jczunh"
Auto Layout
```

Possible command identifiers:

```text id="w8u6qn"
vmblu.autoLayout
editor.autoLayout
layout.auto
```

Use the project’s existing command naming convention.

### 6.2 User Flow

```text id="c841gg"
User invokes Auto Layout
    ↓
Current in-memory vmblu model is cloned or read-only projected
    ↓
ELK graph is built
    ↓
ELK computes layout
    ↓
Editor previews or directly applies geometry
    ↓
One undoable edit updates editor geometry
    ↓
Canvas re-renders
```

For the first version, direct apply is acceptable. A preview mode can be added later.

### 6.3 Expected Result

For a conventional left-to-right model:

* source-side nodes tend to appear left;
* destination-side nodes tend to appear right;
* input pins remain on the left side of nodes;
* output pins remain on the right side of nodes;
* connections use orthogonal routing;
* crossing is reduced where possible;
* disconnected components are laid out with reasonable spacing.

---

## 7. Architecture

## 7.1 New Layout Module

Create a dedicated layout module, isolated from rendering and semantic model logic.

Suggested structure:

```text id="dgcvaj"
src/
  layout/
    elk/
      layoutElk.ts
      toElkGraph.ts
      fromElkResult.ts
      elkOptions.ts
      layoutTypes.ts
```

Exact paths should follow the current repository structure.

## 7.2 Public API

Suggested API:

```ts
export type VmbluLayoutPatch = {
  nodes: Array<{
    uid: string
    x: number
    y: number
  }>
  routes: Array<{
    connectionId: string
    points: Array<{ x: number; y: number }>
  }>
}

export async function layoutElk(
  model: VmbluModel,
  options?: VmbluElkLayoutOptions
): Promise<VmbluLayoutPatch>
```

Suggested application function:

```ts
export async function autoLayoutCurrentModel(): Promise<void> {
  const patch = await layoutElk(currentModel)
  doEdit({
    kind: "layoutApply",
    patch
  })
}
```

Adapt names and model types to the existing vmblu codebase.

## 7.3 Required Separation

The implementation must separate:

```text id="80xj4t"
toElkGraph(model)
    Converts vmblu model into ELK graph JSON.

runElkLayout(graph, options)
    Calls ELK.js.

fromElkResult(result, model)
    Converts ELK geometry into a vmblu layout patch.

applyLayoutPatch(patch)
    Uses existing vmblu structured edit / undo system.
```

No rendering component should contain ELK conversion logic.

---

## 8. ELK Graph Mapping

## 8.1 Root Graph

Use ELK Layered with left-to-right direction.

Suggested initial options:

```ts
{
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.spacing.edgeNode": "20",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "20"
}
```

These are starting values only. Keep them centralized in `elkOptions.ts`.

ELK exposes layout options such as algorithm, direction, edge routing, node spacing, and port constraints.

## 8.2 Nodes

Each visible vmblu node maps to one ELK child node.

```ts
type ElkNode = {
  id: string
  width: number
  height: number
  ports?: ElkPort[]
  layoutOptions?: Record<string, string>
}
```

Mapping rules:

* ELK node `id` equals vmblu node UID;
* width and height come from the current renderer’s calculated or estimated node dimensions;
* hidden nodes are excluded;
* groups are excluded in version 1 unless they are rendered as ordinary visible nodes;
* node coordinates from the current model are not used initially except in future interactive layout support.

## 8.3 Ports

Each visible vmblu pin maps to one ELK port.

Use ports so ELK routes edges to the correct side of each node.

Suggested mapping:

| vmblu pin                | ELK port side |
| ------------------------ | ------------- |
| Input pin                | `WEST`        |
| Output pin               | `EAST`        |
| Explicit top-side pin    | `NORTH`       |
| Explicit bottom-side pin | `SOUTH`       |

At first, use fixed side constraints.

```ts
layoutOptions: {
  "org.eclipse.elk.portConstraints": "FIXED_ORDER"
}
```

Each port should define its side:

```ts
layoutOptions: {
  "org.eclipse.elk.port.side": "WEST"
}
```

ELK supports `FIXED_SIDE`, `FIXED_ORDER`, `FIXED_RATIO`, and `FIXED_POS` port constraints.

When fixed side or fixed order is used, ELK requires port-side information.

## 8.4 Port Order

vmblu must continue to own visible pin order.

Map pins to ELK ports in the order they appear in the vmblu renderer.

Use `FIXED_ORDER` initially so that:

* existing pin ordering is preserved;
* ports do not jump unpredictably after layout;
* generated routes match the visible node structure.

## 8.5 Connections

Each eligible vmblu connection maps to one ELK edge.

```ts
type ElkEdge = {
  id: string
  sources: string[]
  targets: string[]
}
```

Mapping rules:

* ELK edge `id` equals stable vmblu connection ID;
* `sources` contains the source pin port ID;
* `targets` contains the destination pin port ID;
* only valid pin-to-pin connections are included;
* connections whose endpoints are unavailable are skipped and reported in diagnostics;
* each physical vmblu connection becomes one ELK edge.

## 8.6 Request and Reply Connections

For version 1:

* treat request and reply connections as ordinary directed edges;
* do not attempt to visually pair them;
* preserve their existing semantic route definitions;
* allow their route geometry to be calculated independently.

A dedicated request/reply layout strategy can be added after basic ELK routing is proven.

---

## 9. Geometry Conversion

## 9.1 Node Position Conversion

ELK returns positions relative to the root graph.

Convert them into vmblu node geometry:

```ts
{
  uid: elkNode.id,
  x: elkNode.x,
  y: elkNode.y
}
```

Apply only to existing editor or visualization position fields.

Do not modify semantic node definitions.

## 9.2 Route Conversion

ELK may return one or more edge sections.

For each edge:

1. find the vmblu connection by ELK edge ID;
2. read the first section;
3. collect:

   * start point;
   * bend points;
   * end point;
4. convert them into vmblu route geometry.

Suggested patch form:

```ts
{
  connectionId: "connection:abc",
  points: [
    { x: 120, y: 80 },
    { x: 180, y: 80 },
    { x: 180, y: 220 },
    { x: 240, y: 220 }
  ]
}
```

The existing vmblu renderer may already calculate start and end points from pins. If so, persist only ELK bend points rather than duplicating endpoints.

Preferred initial rule:

```text id="e7rq1d"
Persist bend points only when the existing route format supports them.
Continue deriving endpoint coordinates from actual pin locations.
```

## 9.3 Existing Route Formats

Inspect the current vmblu route representation before implementation.

Possible existing forms may include:

```text id="x4wqyh"
editor.route.wire
editor.route.points
editor.route.polyline
editor.route.kind
```

Codex must map ELK bend points into the existing preferred representation rather than introducing a parallel route format unless necessary.

## 9.4 Node Dimensions

Version 1 should not let ELK resize nodes.

vmblu owns node sizing.

Pass fixed measured or estimated dimensions to ELK.

If exact node dimensions are not available before render:

1. use the existing node-size calculation logic if present;
2. otherwise use deterministic dimensions based on pin count and label length;
3. document assumptions in the layout module;
4. refine later after real rendering measurements are available.

---

## 10. Layout Patch and Edit Integration

## 10.1 Layout Patch Type

Create a dedicated layout patch type.

```ts
type VmbluLayoutPatch = {
  nodes: Array<{
    uid: string
    x: number
    y: number
  }>
  routes: Array<{
    connectionId: string
    bendPoints: Array<{ x: number; y: number }>
  }>
  meta?: {
    algorithm: "elk-layered"
    direction: "RIGHT"
    edgeRouting: "ORTHOGONAL"
  }
}
```

## 10.2 Controlled Edit

Add a structured edit operation.

Suggested form:

```ts
{
  kind: "layoutApply",
  patch: VmbluLayoutPatch
}
```

Requirements:

* validate node and connection IDs before applying;
* ignore or report unknown IDs;
* update only editor/view geometry;
* create one undo/redo history entry;
* preserve previous geometry for undo;
* trigger a single view refresh;
* mark relevant file state dirty.

## 10.3 Persistence

Auto-layout results should be persisted in the same place as current editor geometry.

Use the existing vmblu convention:

```text id="gajnzf"
editor.* fields in the model
```

or, if the current codebase already has separate `.viz` storage:

```text id="4sue3l"
project.blu.viz
```

Do not create a new storage mechanism solely for ELK.

---

## 11. Error Handling and Diagnostics

The feature must fail safely.

Possible failure cases:

* ELK initialization failure;
* invalid graph projection;
* missing node dimensions;
* missing pin bindings;
* missing connection IDs;
* ELK result without expected edge sections;
* layout timeout or unexpected result;
* malformed existing editor route data.

Behavior:

* do not alter the current model if layout fails;
* show a concise user-visible error;
* log detailed diagnostics for development;
* return a structured failure result where practical.

Suggested result type:

```ts
type LayoutResult =
  | { ok: true; patch: VmbluLayoutPatch; diagnostics: LayoutDiagnostic[] }
  | { ok: false; error: string; diagnostics: LayoutDiagnostic[] }
```

---

## 12. Testing

## 12.1 Unit Tests

Add tests for:

* vmblu node to ELK node mapping;
* pin-side to ELK port-side mapping;
* pin-order preservation;
* connection to ELK edge mapping;
* ELK result to layout patch conversion;
* bend-point conversion;
* missing/invalid connection handling;
* layout patch application;
* undo and redo behavior.

Use small deterministic fixture models.

## 12.2 Integration Tests

Add integration tests for:

* flat graph with a simple left-to-right chain;
* fan-out from one node to multiple nodes;
* fan-in from multiple nodes to one node;
* disconnected components;
* cyclic graph;
* node with multiple ordered ports;
* request/reply connections treated as ordinary edges;
* model with existing manual positions;
* undo after auto-layout;
* redo after auto-layout.

## 12.3 Visual Validation

Create at least one fixture model for manual visual review:

```text id="3e419n"
Source → Parser → Processor → Output
```

And one more complex fixture:

```text id="52yptw"
UI → Service → Repository
UI → Service → Payment Adapter
Service → Logger
Service ↔ Request/Reply Handler
```

Visual acceptance criteria:

* nodes do not overlap;
* labels remain legible;
* input/output pin sides remain correct;
* routes attach to expected pins;
* most routes are orthogonal;
* route crossings are reduced compared with unlaid-out geometry.

---

## 13. Implementation Phases

### Phase 1 — ELK Spike

Implement:

* dependency installation;
* a hard-coded test fixture;
* `toElkGraph`;
* ELK Layered invocation;
* logging or rendering of returned node coordinates and edge sections.

Success criterion:

> ELK returns correct geometry for a simple vmblu fixture with ports.

### Phase 2 — Layout Patch

Implement:

* `fromElkResult`;
* `VmbluLayoutPatch`;
* route bend-point conversion;
* diagnostics.

Success criterion:

> ELK output can be represented as a vmblu-specific geometry patch without mutating the model directly.

### Phase 3 — Editor Integration

Implement:

* `layoutApply` structured edit;
* undo/redo support;
* command or toolbar action;
* save/load through current geometry persistence.

Success criterion:

> A user can invoke Auto Layout and undo it in one action.

### Phase 4 — Real Model Validation

Test against:

* existing vmblu examples;
* generated models;
* models with many pins;
* models with request/reply paths;
* models with disconnected subgraphs.

Success criterion:

> Auto Layout produces a materially more usable first layout on real models.

---

## 14. Deferred Enhancements

After the first version proves useful, consider:

* compound/group layout;
* nested groups;
* bus-aware layout;
* request/reply pairing;
* incremental interactive layout;
* preserve manual positions using ELK interactive constraints;
* layout only selected nodes;
* layout only a group;
* route labels;
* optional top-to-bottom direction;
* layout profiles;
* automatic layout after agent-generated model changes;
* animation from old to new geometry;
* reuse of the ELK adapter in the Linear Model project, if ever resumed.

ELK supports interactive constraints based on prior positions, which may be useful later for preserving user adjustments during re-layout.

---

## 15. Acceptance Criteria

The feature is complete when:

1. The editor exposes an explicit Auto Layout command.
2. Auto Layout uses ELK.js through an isolated adapter.
3. Flat visible vmblu nodes are converted into ELK nodes.
4. Visible vmblu pins are converted into ordered ELK ports.
5. Input and output pin sides remain semantically correct.
6. Connections are converted into ELK edges.
7. ELK Layered runs left-to-right with orthogonal routing.
8. Resulting node positions are applied to editor/view geometry only.
9. Resulting route bend points are applied to existing route geometry only.
10. Semantic model data remains unchanged.
11. The resulting operation is undoable and redoable as one action.
12. The result persists using existing vmblu editor geometry storage.
13. Layout failure does not corrupt the current model.
14. The implementation has unit and integration coverage for graph conversion and patch application.

---

## 16. Summary

The Auto Layout feature must preserve the existing vmblu architecture:

```text id="vv8i0f"
vmblu model owns semantics
vmblu edit system owns controlled change and history
vmblu renderer owns presentation and interaction
ELK supplies node placement and route geometry
```

The first release is a contained, explicit layout command for flat models. It should prove whether ELK materially improves the initial presentation of vmblu models before more complex semantics such as groups, buses, and request/reply-aware routing are added.
