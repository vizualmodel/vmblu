# Connections Handoff

Branch: `wiring`

This document captures the proposed `.mod.blu` connection model for a later session. It is about logical model connections only, not editor route geometry.

## Goal

Allow `.mod.blu` to express connection intent at a higher level than only one explicit pin-to-pin edge.

The current runtime can still receive the same normalized one-to-one connection graph it receives today. The purpose of the new forms is:

- make models clearer for coding agents and humans;
- preserve fanout/grouping intent instead of flattening it immediately;
- allow agents to reason with interfaces as first-class connection endpoints;
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

## Proposed Address Extension: Interfaces

The current `Address` only identifies a pin:

```json
{
  "node": "Rendering",
  "pin": "sim.tick"
}
```

Proposed extension:

```json
{
  "node": "Rendering",
  "interface": "sim"
}
```

An address should identify exactly one of:

- `pin`
- `interface`

If `node` is omitted, the containing group node is implied, same as for current pin addresses.

## Proposed Form: Interface To Interface

Proposed shape:

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

Meaning:

- connect compatible pins from the source interface to compatible pins on the destination interface;
- compatibility should be resolved by pin name and direction;
- this should normalize to explicit one-to-one pin connections;
- the interface-level declaration should remain available for agent reasoning.

Example expansion:

```json
{
  "src": {"node": "SolarSystem", "pin": "scene.patch"},
  "dst": {"node": "Rendering", "pin": "scene.patch"}
}
```

The exact matching rule still needs to be implemented, but the intended baseline is:

- source side contributes output-like pins;
- destination side contributes input-like pins;
- matching is by compatible pin names after interface naming conventions are resolved;
- contracts can be used as an additional validation check.

## Proposed Form: Interface To Many Interfaces

Proposed shape:

```json
{
  "src": {
    "node": "SimulationClock",
    "interface": "clock"
  },
  "dst": [
    {
      "node": "Rendering",
      "interface": "sim"
    },
    {
      "node": "SolarSystem",
      "interface": "sim"
    },
    {
      "node": "Charts",
      "interface": "sim"
    }
  ]
}
```

Meaning:

- one source interface is broadcast to a logical group of destination interfaces;
- each destination interface is expanded independently;
- the group helps an agent answer questions such as "where is this interface connected?";
- the editor may visualize this with a bus-like layout if it needs to create routes.

## Selectivity

Do not add a `selective` flag to `.mod.blu` connections for now.

Reasoning:

- an agent declares intended logical connections;
- if it connects two pins explicitly, the connection is intended;
- if it connects two interfaces, matching names/contracts determine which pin pairs are intended;
- tack selectivity is a `.mod.viz`/editor concern used to implement and display bus/cable behavior.

In other words, `.mod.blu` should express connection intent, not tack filtering mechanics.

## Agent Reasoning Benefits

The higher-level forms help answer forward questions directly:

- "Where is this output pin connected to?"
- "Where is this interface connected to?"
- "Which subsystems receive this interface?"
- "Is this fanout intentional or just a set of unrelated edges?"

Reverse questions still require derived indexing:

- "Where does this input pin receive messages from?"
- "Which source interfaces can reach this destination interface?"

That is acceptable. Tooling can build a derived normalized graph and reverse index from the authored connection declarations.

## Normalization

Implementation should probably treat the authored connections and normalized connections separately.

Suggested pipeline:

1. Parse authored `.mod.blu` connections.
2. Validate addresses.
3. Expand one-to-many into repeated destination groups.
4. Expand interface addresses into compatible pin pairs.
5. Produce the same normalized one-to-one connection list used by the current runtime/compiler.
6. Keep enough source mapping to explain where each normalized edge came from.

The source mapping is useful for agents and editor operations. For example, an agent can update one fanout group without losing the fact that it was originally authored as a group.

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
- `Address`: exactly one of `pin` or `interface`, plus optional `node`.

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
      "pin": { "type": "string" },
      "interface": { "type": "string" }
    },
    "oneOf": [
      { "required": ["pin"] },
      { "required": ["interface"] }
    ]
  }
}
```

The final schema should keep the existing name restrictions and `additionalProperties: false`.

## Open Questions

- Exact interface pin matching rule:
  - by full pin name;
  - by suffix after interface prefix;
  - by explicit interface membership name;
  - by contract compatibility as a secondary check.
- Whether request/reply pins need special expansion rules.
- Whether one source interface may connect to one destination pin, or one source pin to one destination interface. This can be useful but should be specified deliberately.
- Whether authored one-to-many groups should be preserved on save or rewritten by the editor after manual route edits.
- How much normalized source mapping should be exposed to agents.

## Recommended Next Step

Start by updating the schema and loader to accept:

- current one-to-one pin connections;
- one-to-many pin fanout;
- interface-to-interface;
- interface-to-many-interfaces.

Then add a normalizer that expands all forms into the existing one-to-one connection list before runtime/compiler use. Do not change runtime semantics first.
