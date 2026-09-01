# Sysblu implementation handover

## Purpose

Sysblu is the system-level companion to the vmblu application model. A vmblu
model describes the internal architecture of one application; a sysblu document
shows how multiple vmblu and non-vmblu applications communicate.

The first useful browser slice is complete. It is integrated into Playground,
exercised against the Chat example, and intentionally remains smaller than the
vmblu model editor.

## Current status

- The sysblu vmblu project lives in `vmblu/sysblu`; `sysblu.blu` resolves its
  canonical architecture in `model/sysblu.mod.blu`.
- The authored system format is defined by
  `cli/context/1.12.0/sys.schema.json`.
- Framework-neutral protocol documents use `*.protocol.json` and are defined by
  `cli/context/1.12.0/protocol.schema.json`.
- Playground recognizes `*.sys.blu`, gives sysblu its own pane and canvas, and
  routes loading, saving, navigation, and shared inspectors through the host.
- The real reference configuration is
  `vmblu-examples/chat-application/system/active.sys.blu` with
  `system/chat.protocol.json`.
- Application, endpoint, and connection editing are complete
  for the current scope. All mutations are validated, atomic, undoable, and
  preserve data not owned by the inspector.
- The combined vmblu VS Code extension now contains a dedicated sysblu webview
  application under `vscodex/sysblu`. The existing `*.blu` custom-editor
  provider classifies `*.sys.blu` before generic vmblu documents and loads the
  corresponding isolated webview bundle.

## Accepted conventions

### Optional system context

A vmblu application never needs a sysblu document. When a project chooses to
provide discoverable system context, the convention is:

```text
system/active.sys.blu
```

The `system/` directory is optional. Other `*.sys.blu` configurations may sit
beside the active one, but they are selected explicitly. There is no redirect
file and application entrypoints do not point back to a system.

An explicitly supplied system path takes precedence. Otherwise, future shared
discovery should search from the application entrypoint directory toward the
workspace boundary for the nearest `system/active.sys.blu`. The discovery
algorithm must not escape the workspace or create missing system content.

Files placed beside `active.sys.blu` have no implicit meaning. Prompts,
protocols, scripts, documentation, and other material remain explicit
references in the system document.

### One authored system file

Semantic content and layout currently live in one `*.sys.blu` JSON document.
There is no `*.mod.viz` equivalent. Stable IDs define identity; names, paths,
and canvas coordinates do not.

### One-way ownership

Dependencies point inward:

```text
system configuration -> explicitly referenced application and protocol files
```

Application models continue to own their internal nodes, pins, routes, types,
factories, and runtime behavior. Sysblu owns only the system map: participants,
public endpoints, transport bindings, system-level references, and layout.

### Explicit and framework-neutral references

Reference targets may be paths relative to the containing `*.sys.blu` file,
absolute ARLs, or absolute HTTP(S) URLs. Relative documents open in the host
editor; web URLs open externally.

References are typed as `prompt`, `documentation`, `model`, `source`, `build`,
`deployment`, `test`, `operations`, or `other`. A reference may optionally
contain both:

```json
{
  "command": "npm run build",
  "workingDirectory": "../chat-client"
}
```

Neither field may occur alone. The command is terminal text, not a sysblu shell
language. Scripts own arguments and environment variables; a trusted host owns
confirmation and execution. Credentials never belong in sysblu documents.

## Current format

### Nodes

Every participant uses the `application` node kind and has a required `vmblu`
boolean. The flag is true for vmblu applications and false for non-vmblu
participants; it controls the node rendering but does not create a second node
type. New nodes default to `vmblu: true`.

Applications have a stable ID, display name, position, optional description,
typed references, and endpoints. A vmblu root `.blu` file is an explicit
node-level `model` reference rather than a separate entrypoint property.

### Endpoints

An endpoint is a named API or protocol attachment point with:

- stable `id`;
- display `name`;
- `role`: `client`, `server`, or `peer`;
- optional `remarks`;
- optional `protocol` file or HTTP(S) webpage.

The endpoint name can be the API name when no protocol is referenced. Endpoints
do not own additional references; specifications, documentation, source, and
operations files remain references on the containing application node.

### Connections

A connection binds two endpoint IDs and represents one independently meaningful
communication channel. It has a required `transport`, optional remarks,
optional references, and optional route points. Its route label displays the
transport. It has no separate display name or flow field.

Protocol and transport remain distinct:

- the endpoint describes the API/protocol understood by one participant;
- the connection describes the common transport used by both participants.

### Protocol documents

An owned formal protocol may be stored as `*.protocol.json`. It contains:

- `header` with schema version, name, and optional description;
- `interactions`, each with `id`, `flow`, `type`, and `response`;
- a `types` object using the vmblu type representation.

`flow` is `right`, `left`, or `both`. By convention, right means client,
initiator, or master to server, listener, or slave. `response` describes only
valid correlated direct replies: `"any"`, `[]`, or an array of `{id, remark?}`.
It is not a state-machine language. Types may refer to other named types,
including recursively.

## Implemented editor behavior

- The canvas is black and all authored drawing choices live in
  `sysblu/nodes/sysblu-view/system-style.js`.
- vmblu and non-vmblu applications use separate node colors. A title-bar gear
  opens the application inspector; the rest of the title bar drags the node.
- The side menu adds an application, opens the explicit
  top-level prompt reference, and saves the active system.
- Application settings edit name, responsibility, the vmblu flag, and
  node-level references. There is no separate entrypoint field.
- The plus action on a card creates an endpoint. Clicking an endpoint edits or
  deletes it.
- Client endpoints are placed on the right and server endpoints on the left so
  the conventional left-to-right client-to-server layout connects directly.
  Peer endpoints remain on the right.
- Dragging one endpoint connector to another opens the Transport inspector and
  creates a connection. Clicking a route edits or deletes it.
- Deleting a node or endpoint removes incident connections in the same undoable
  operation.
- `Ctrl/Cmd+Z` undoes; `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` redo. Inspector exit
  restores canvas focus so an extra click is unnecessary.
- Dragging empty canvas space pans the viewport. Middle-button drag and
  `Space` + left-button drag pan from anywhere without moving nodes. Panning,
  like zoom, is transient and does not dirty the system document.
- Reference icons open their target. Command-capable icons have a small marker;
  `Ctrl/Cmd+click` emits a host command request.
- Missing documents produce a compact dismissible notification rather than
  blocking the canvas.
- Sysblu-specific inspectors are reusable `ui-svelte` nodes hosted in the
  Playground `sysblu popups` group.

## Internal architecture

The sysblu application has two core responsibilities:

1. `sysblu view` owns rendering, selection, dragging, transient zoom state,
   inspectors, reference activation, and translation of gestures into commands.
2. `sysblu manager` owns the active document, semantic validation, persistence,
   dirty state, and the `sysmod` undo/redo history.

The view never owns an independent editable document. It emits `sysmod.doit`,
`sysmod.undo`, or `sysmod.redo`; the manager applies a validated change and
publishes a complete `system.updated` snapshot.

The host document manager classifies `.sys.blu` before generic `.blu`, activates
exactly one of the model, text, or sysblu editors, and owns file and external-URL
navigation. Keep this boundary host-neutral so a future VS Code host can reuse
the sysblu application.

The VS Code shell is itself a vmblu application. It links the canonical sysblu
group as a dock node and connects it to a VS Code message broker, the shared
sysblu inspectors, and the system side menu. The reusable sysblu group exposes
complete snapshots and validation diagnostics to its host, plus host-routed
undo and redo inputs. VS Code owns the custom-document dirty and undo stacks;
the sysblu manager still owns validation and the actual reversible mutations.

The VS Code host supports normal save, hot-exit backup, revert, file watching,
relative and external navigation, Problems-panel validation diagnostics, and
trusted command requests. Command execution requires a trusted workspace and
an explicit modal confirmation, then sends the authored command to a visible
terminal in the resolved working directory.

Architectural source files are `*.mod.blu`. Do not edit generated `*.app.js`,
`*.src.prf`, `*.cap.json`, or visualization artifacts directly.

## Validation baseline

Validated on 2026-08-28 after unifying vmblu and non-vmblu applications:

- core: 137 tests passing;
- CLI: 19 tests passing;
- sysblu: 37 tests passing;
- Playground: 5 tests passing;
- repository ESLint passes;
- ui-svelte and Playground production builds pass;
- existing Svelte accessibility, circular-dependency, and bundle-size warnings
  remain non-blocking.
- both the canonical sysblu application and the VS Code sysblu shell verify
  against the 1.12 schemas with current generated artifacts;
- the VS Code TypeScript host and both extension bundles build;
- a disposable combined VSIX packaging and isolated CLI installation check
  succeeds at about 3.06 MiB,
  compared with about 2.77 MiB before the sysblu webview.

## Remaining work

The current browser slice is suitable for the Chat example. Useful next work is
deliberately not predesigned:

1. Exercise Patient Ledger and CrisisGrid and evolve the format only when those
   systems reveal a concrete gap.
2. Add visible broken-reference diagnostics without making the rest of the
   diagram unusable.
3. Decide whether configuration switching needs an operation that promotes an
   alternative file to `active.sys.blu`.
4. Decide ownership and reuse rules for protocol documents shared across
   projects.
5. Exercise the combined extension in a VS Code Extension Development Host,
   then add automated host-protocol coverage and harden Save As and external
   change conflict handling from observed behavior.
6. Consider protocol visualization or payload editing only after real usage
   demonstrates value.

Current limitations include transient zoom and panning, no fit/grid actions,
no command executor in browser Playground, no automated VS Code host
tests, no explicit conflict flow when a dirty system file changes externally,
and focused semantic validation rather than line-precise JSON Schema
diagnostics.

## Continuation checklist

1. Read `sysblu/.vmblu/vmblu.prompt.md` and this document.
2. Inspect the dirty worktree and preserve unrelated changes.
3. Use `sysblu.blu` to locate the canonical model.
4. Before editing a vmblu blueprint, read the matching schema and annex.
5. Make one coherent vertical slice and test it against a real system.
6. Regenerate derived vmblu artifacts only from their source models.
7. Update this handover only when current behavior, accepted decisions, or open
   work materially changes; do not restore a chronological implementation log.
