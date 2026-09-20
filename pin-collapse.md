# Collapsed pins

Status: specification for a future implementation. Automatic interface naming is to be implemented first. This document does not assign a release version to pin collapse.

## Purpose

Reduce diagram height and repetitive wiring by displaying several ordinary pins as one row, for example `new, add, remove`. Keep each pin and connection independent in the architectural model.

The feature must work in both the browser playground and the VS Code editor through their shared core implementation.

## Model and naming invariants

- A named interface qualifies every member as `interface.pin`. Labels inside the interface show local names without a leading period.
- A collapsed row is a visual group of existing pins, not a new message, runtime construct, wildcard, or comma-containing model pin.
- Every member retains its own identity, direction, kind, contract, prompt, capabilities, and ordinary connections in `.mod.blu`.
- Collapsing or expanding changes only `.mod.viz`. It must not change `.mod.blu`, including its timestamps, or trigger semantic regeneration solely because presentation changed.
- Creating, renaming, deleting, or connecting members remains a model edit, even when performed through a collapsed row.
- Loading without visualization data shows the ordinary separate pins and preserves all behavior.

## Group eligibility

For the first implementation, all members must belong to the same node and interface, occupy the same side, and have the same pin kind: input, output, request, or reply. Groups contain at least two pins, cannot overlap, and cannot nest. An unnamed interface may also contain a group.

Member contracts need not be identical: they remain independent and connection validation operates on each pair. Grouping never merges payload types or capability metadata.

## Creating, editing, and expanding

1. Select eligible pins and choose **Collapse pins**. Replace their displayed rows with a single row, retaining their relative order.
2. Alternatively, enter a comma-separated list such as `new, add, remove` while creating pins. Trim whitespace and create three ordinary pins in the selected interface, then group them. This is a model creation operation followed by a visual grouping operation.
3. Reject empty members, duplicates, invalid names, and handler-name collisions before changing anything. Commas are list delimiters in this interaction; they must never silently reinterpret a legacy stored pin name on load.
4. Select the collapsed row and choose **Expand pins**. Restore individual rows and their connections in member order, shifting surrounding layout as needed.
5. Provide a member list for inspecting and editing individual contracts, prompts, and capability metadata. Editing the displayed list must not silently delete or rename existing members. Use explicit member operations.

New groups use the first selected member's position. Preserve enough expanded layout information to restore member ordering and spacing without overlapping neighboring rows. A group moves as a unit. Moving it into another interface is an explicit semantic membership change under the automatic naming rules.

Group selection highlights all members and their routes. Deleting a visual group means ungrouping; deleting its underlying pins is a separate, explicitly named action following the editor's normal deletion behavior.

## Connecting

Use exact local member names for automatic matching, after applying the project's standard name validation. Do not introduce fuzzy matching or an independent case-normalization rule. Interface names may differ: `toolbar.add` can connect to `items.add`.

| Gesture | Effect |
| --- | --- |
| Group to ordinary pin | Connect the uniquely matching member to that pin. |
| Ordinary pin to group | Connect that pin to the uniquely matching member. |
| Group to group | Connect the intersection of local member names, one ordinary connection per matching pair. |
| No matching names | Reject the gesture with an explanation. |
| Ambiguous matching | Require explicit member selection; do not guess. |

Apply existing direction, kind, contract, and connection rules to every candidate pair. Preview the matching pairs and unmatched members before committing the gesture. If any candidate pair is invalid or ambiguous, do not partially apply the operation; show the problem for resolution. Existing identical connections are retained without duplication. If every pair already exists, the gesture is a no-op.

Group matching is an editing shortcut, not a new constraint on ordinary wiring. Expanding a group preserves any existing connections between differently named pins. Users can expand and use ordinary wiring when automatic matching is inappropriate.

Adding a member later never automatically wires it. Renaming, regrouping, collapsing, or expanding never creates connections.

A successful gesture stores ordinary individual connections in `.mod.blu`. No runtime multicast or routing-by-list is introduced.

## Route display and feedback

To reduce line density as well as row count, connections between the same pair of displayed endpoints may share a visible route. Connections to different endpoints remain distinguishable. Preserve the individual logical connections and sufficient route data to expand them again.

- Hovering a grouped route shows its exact source-to-target member pairs.
- A collapsed row exposes which members are connected and which are unconnected, for example `2/3 connected`. Count connected members, not edges; fan-out must not inflate the count.
- A bundled line must not imply that every group member is connected. Hover and selection expose actual pair coverage, including connections to differently named pins.
- Aggregate validation, capability, and selection indicators must retain access to member details; one valid member must not hide another member's error.
- Deleting a bundled route explicitly removes all connections represented by that route as one undoable action. Individual connection deletion is available through member details or expansion.
- For long lists, truncate the label to available space and expose the complete ordered list on hover and in member details.

Initial bulk matching covers direct pin connections. Existing bus, pad, and proxy connections must survive grouping and expansion. Creating new grouped connections to buses, pads, or proxies is out of scope for the first version; require expansion for those gestures.

## Visualization persistence

Extend the visualization schema with explicit group metadata. Decide the exact JSON shape during implementation after reading the then-current schema; do not encode group membership by parsing the display label.

Persist a group identifier, an ordered list of references to existing member pins, collapsed state, group placement, and the layout/route information required for expansion. References must remain unambiguous within their node and survive rename through coordinated reference updates. Do not introduce model-only pin IDs solely to support this visual feature.

The existing visualization format uses widget identifiers and named pin entries. Audit their stability before choosing the reference representation. Visual route bundles must reference their constituent ordinary connections unambiguously.

Loading and reconciliation rules:

- Older visualization files without groups show separate pins.
- Missing members are removed from the visual group with a diagnostic; groups with fewer than two surviving members dissolve.
- Invalid mixed-kind, mixed-interface, or overlapping groups fall back to separate pins with a diagnostic, without modifying the model.
- New pins discovered from an externally edited model appear separately; do not infer grouping or new connections.
- Copy/paste remaps group and member references to the pasted pins and retains only applicable route metadata.
- Saving and reopening preserves membership, order, state, and connection coverage.

Follow the repository's compatibility-family policy when introducing the schema extension. Do not assume an older editor can safely round-trip unknown group metadata.

## Undo and redo

Collapse and expand are each one visual undo step. Bulk pin creation and bulk connection gestures are each one coherent user action. Undo/redo must restore member identities, model connections, selection, grouping, and route layout without duplicate pins or edges.

## Acceptance criteria

1. Collapse, save, reload, expand, and save again leave `.mod.blu` byte-for-byte unchanged for a previously saved model.
2. Generated behavior and message delivery are identical before and after visual grouping.
3. A comma-list creation produces separate qualified model pins with separate metadata; no comma-list message appears in the model.
4. Connecting groups with `new, add, remove` and `add, remove, clear` creates exactly the two matching ordinary connections and visibly reports unmatched members.
5. Group-to-single wiring affects only the matching member. Repeating a gesture produces no duplicates.
6. Invalid or ambiguous bulk wiring performs no partial model edit.
7. Expanding preserves fan-out, differently named endpoint pairs, contracts, capability metadata, and existing bus/proxy/pad connections.
8. Partial connectivity remains visible, and route inspection reports exact member pairs.
9. Renames, deletions, external model edits, copy/paste, and undo/redo preserve valid references or fall back safely as specified.
10. Browser and VS Code editors pass the same interaction and persistence checks.

## Implementation starting points

Inspect `core/types/widget/widget-pin.js`, `widget-pin-name.js`, `core/types/node/look-interface.js`, the pin/interface context menus, model-manager undo operations, route endpoint handling, and `core/types/model/blueprint-raw.js`. Read the current visualization schema before changing persistence.

The current pin widget combines semantic pin data with rendering and route state. Introduce a visual group abstraction without substituting a synthetic semantic pin in routing, serialization, or generation. Keep individual pins authoritative throughout.
