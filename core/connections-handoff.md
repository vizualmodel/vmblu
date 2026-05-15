# Connections Handoff

Branch: `wiring`

This document captures the proposed `.mod.blu` connection model for a later session. It is about logical model connections only, not editor route geometry.

## Goal

Allow `.mod.blu` to express connection intent at a higher level than only one explicit pin-to-pin edge.

The current runtime can still receive the same normalized one-to-one connection graph it receives today. The purpose of the new forms is:

- make models clearer for coding agents and humans;
- preserve fanout/grouping intent instead of flattening it immediately;
- keep persisted connections stable under small edits;
- allow the editor to create sensible cables/buses automatically when no `.mod.viz` layout exists.

## Separation From `.mod.viz`

`.mod.blu` should contain logical connectivity only.

`.mod.viz` remains responsible for:

- route geometry;
- cables;
- buses;
- tacks;
- tack aliases and selectivity;
- positions and drawing style.

Cables and buses are editor artifacts. Agents working on `.mod.blu` should not need to inspect or author them.

If a `.mod.viz` file already exists, the editor should preserve the user's saved visual layout. The higher-level `.mod.blu` connection forms are mainly useful when creating, reading, refactoring, or auto-laying out models.

## Existing Form: One To One

Current shape:

```json
{
  "src": {
    "node": "SimulationClock",
    "pin": "clock.tick"
  },
  "dst": {
    "node": "Rendering",
    "pin": "sim.tick"
  }
}
```

Meaning:

- one output/source pin is connected to one input/destination pin;
- message flow is from `src` to `dst`;
- this remains the normalized runtime-level connection.

This form should remain valid.

## Proposed Form: One To Many

Proposed shape:

```json
{
  "src": {
    "node": "SimulationClock",
    "pin": "clock.tick"
  },
  "dst": [
    {
      "node": "Rendering",
      "pin": "sim.tick"
    },
    {
      "node": "SolarSystem",
      "pin": "sim.tick"
    },
    {
      "node": "Charts",
      "pin": "sim.tick"
    }
  ]
}
```

Meaning:

- one source pin fans out to a logical group of destination pins;
- the group itself is useful information for an agent;
- the compiler/loader may normalize this to multiple one-to-one edges;
- the editor may visualize it as a cable, bus, or repeated routes.

This is not just shorter syntax. It preserves the author's intent that the destinations belong together.

## Interfaces Are Not Connection Endpoints

Interfaces should remain semantic groups of pins, not persisted connection endpoints.

Earlier versions of this proposal considered allowing addresses such as:

```json
{
  "node": "Rendering",
  "interface": "sim"
}
```

This is no longer recommended.

Reasoning:

- a node may implement an interface completely or partially;
- the interface name is useful for agents and humans, but it does not guarantee that two nodes can communicate;
- disconnecting one pin from an interface-level connection would force a large rewrite of the persisted model;
- partial edits would need exclusions, overrides, or expansion into many explicit pin connections;
- explicit pin connections make small model changes produce small file changes.

The editor or an agent may still use interfaces as authoring aids. For example, a "connect interface" gesture can create the matching explicit pin fanouts. The saved `.mod.blu` connection model should still contain pin addresses only.

## Rejected Form: Interface To Interface

Do not persist interface-to-interface connections:

```json
{
  "src": {
    "node": "SolarSystem",
    "interface": "scene"
  },
  "dst": {
    "node": "Rendering",
    "interface": "scene"
  }
}
```

Instead, store the actual pin connections:

```json
{
  "src": {
    "node": "SolarSystem",
    "pin": "scene.patch"
  },
  "dst": {
    "node": "Rendering",
    "pin": "scene.patch"
  }
}
```

Or, when one source pin fans out:

```json
{
  "src": { "node": "SolarSystem", "pin": "scene.patch" },
  "dst": [
    { "node": "Rendering", "pin": "scene.patch" },
    { "node": "Recorder", "pin": "scene.patch" }
  ]
}
```

## Rejected Form: Many To Many

Do not add `src` arrays.

This shape is intentionally not part of the model:

```json
{
  "src": [
    { "node": "SolarSystem", "pin": "scene.patch" },
    { "node": "SolarSystem", "pin": "scene.camera" }
  ],
  "dst": [
    { "node": "Rendering", "pin": "scene.patch" },
    { "node": "Rendering", "pin": "scene.camera" },
    { "node": "Charts", "pin": "scene.patch" },
    { "node": "Charts", "pin": "scene.camera" }
  ]
}
```

Even if this were defined as "connect only pins with matching full names", it is not helpful enough:

- it introduces extra mental processing;
- it makes the reader infer pairings across two arrays;
- it is harder to diff and validate by eye;
- it does not create meaningful notation economy for common interface fanout cases.

Use repeated one-to-many pin fanouts instead. They keep each message path explicit and answer "where does this output pin go?" directly.

## Selectivity

Do not add a `selective` flag to `.mod.blu` connections for now.

Reasoning:

- an agent declares intended logical connections;
- if it connects two pins explicitly, the connection is intended;
- tack selectivity is a `.mod.viz`/editor concern used to implement and display bus/cable behavior.

In other words, `.mod.blu` should express connection intent, not tack filtering mechanics.

## Agent Reasoning Benefits

The higher-level forms help answer forward questions directly:

- "Where is this output pin connected to?"
- "Is this fanout intentional or just a set of unrelated edges?"

Reverse questions still require derived indexing:

- "Where does this input pin receive messages from?"

That is acceptable. Tooling can build a derived normalized graph and reverse index from the authored connection declarations.

## Normalization

Implementation should probably treat the authored connections and normalized connections separately.

Suggested pipeline:

1. Parse authored `.mod.blu` connections.
2. Validate addresses.
3. Expand one-to-many into repeated destination groups.
4. Produce the same normalized one-to-one connection list used by the current runtime/compiler.
5. Keep enough source mapping to explain where each normalized edge came from.

The source mapping is useful for agents and editor operations. For example, an agent can update one fanout group without losing the fact that it was originally authored as a group.

The normalization pipeline is an implementation concern, not part of the authored model semantics. The `.mod.blu` model should specify valid connection intent. Editors, loaders, compilers, and runtimes may derive explicit pin-to-pin edges internally as needed.

Model-aware tools should preserve authored higher-level connection declarations when saving, unless the user explicitly edits them into separate lower-level connections. A one-to-many connection is not merely shorthand; it records that the destinations belong together as a logical fanout group.

## Schema Direction

Current schema:

```json
"Connection": {
  "required": ["src", "dst"],
  "properties": {
    "src": { "$ref": "#/$defs/Address" },
    "dst": { "$ref": "#/$defs/Address" }
  }
}
```

Proposed direction:

- `src`: one `Address`;
- `dst`: either one `Address` or an array of `Address`;
- `Address`: one pin address, plus optional `node`.

Sketch:

```json
{
  "src": { "$ref": "#/$defs/Address" },
  "dst": {
    "oneOf": [
      { "$ref": "#/$defs/Address" },
      {
        "type": "array",
        "items": { "$ref": "#/$defs/Address" },
        "minItems": 1
      }
    ]
  }
}
```

```json
{
  "Address": {
    "type": "object",
    "properties": {
      "node": { "type": "string" },
      "pin": { "type": "string" }
    },
    "required": ["pin"]
  }
}
```

The final schema should keep the existing name restrictions and `additionalProperties: false`.

## Open Questions

- Whether authored one-to-many groups should be preserved on save or rewritten by the editor after manual route edits.
- How much normalized source mapping should be exposed to agents.

## Recommended Next Step

Start by updating the schema and loader to accept:

- current one-to-one pin connections;
- one-to-many pin fanout.

Then let the editor, loader, or compiler derive explicit one-to-one pin connections internally where needed. Do not change runtime semantics first.
