# Pin bundles

Status: agreed implementation specification. Automatic interface naming is a prerequisite. This document does not assign a release version to pin bundles.

## Purpose

Reduce diagram height and repetitive wiring by displaying several ordinary pins as one row, for example `new, add, remove`. Keep each pin and connection independent in the architectural model.

Each pin has a `bundle` property: `null` for an ordinary pin, otherwise the same ordered array of member pin widgets shared by every member. Only the first member renders the bundled row. All members remain authoritative for model serialization, validation, metadata, and logical connections. Bundle-specific functions must be readily identifiable by including `bundle` in their name (for example `restorePinBundles` or `expandBundle`).

The feature must work in both the browser playground and the VS Code editor through their shared core implementation.

## Model and naming invariants

- A named interface qualifies every member as `interface.pin`. Labels inside the interface show local names without a leading period.
- A collapsed row is a visual bundle of existing pins, not a new message, runtime construct, wildcard, or comma-containing model pin.
- Every member retains its own identity, direction, kind, contract, prompt, capabilities, and ordinary connections in `.mod.blu`.
- Collapsing or expanding changes only `.mod.viz`. It must not change `.mod.blu`, including its timestamps, or trigger semantic regeneration solely because presentation changed.
- Creating, renaming, deleting, or connecting members remains a model edit, even when performed through a collapsed row.
- Loading without visualization data shows the ordinary separate pins and preserves all behavior.

## Bundle eligibility

For the first implementation, all members must belong to the same node and interface, occupy the same side, and have the same pin kind: input, output, request, or reply. Bundles contain at least two pins, cannot overlap, and cannot nest. An unnamed interface may also contain a bundle.

Member contracts need not be identical: they remain independent and connection validation operates on each pair. Bundling never merges payload types or capability metadata.

## Creating, editing, and expanding

1. Select eligible pins and choose **Collapse pins**. Replace their displayed rows with a single row, retaining their relative order.
2. Alternatively, enter a comma-separated list such as `new, add, remove` while creating pins. Trim whitespace and create three ordinary pins in the selected interface, then bundle them. This is a model creation operation followed by a visual bundling operation.
3. Reject empty members, duplicates, invalid names, and handler-name collisions before changing anything. Commas are list delimiters in this interaction; they must never silently reinterpret a legacy stored pin name on load.
4. Select the collapsed row and choose **Expand pins**. Restore individual rows and their connections in member order, shifting surrounding layout as needed.
5. Provide a member list for inspecting and editing individual contracts, prompts, and capability metadata. Editing the displayed list must not silently delete or rename existing members. Use explicit member operations.

New bundles use the first selected member's position. Preserve individual expanded layout information to restore member ordering and spacing without overlapping neighboring rows. A bundle moves as a unit, translating all members' saved positions together. Collapse and expansion adjust surrounding layout. Moving it into another interface is an explicit semantic membership change under the automatic naming rules. Removing the first member promotes the next; fewer than two remaining members dissolves the bundle. Expanding sets every member's `bundle` to `null`; there is no retained expanded bundle identity or collapsed-state flag.

Bundle selection highlights all members and their routes. Deleting a visual bundle means ungrouping; deleting its underlying pins is a separate, explicitly named action following the editor's normal deletion behavior.

## Connecting

Use exact local member names for automatic matching, after applying the project's standard name validation. Do not introduce fuzzy matching or an independent case-normalization rule. Interface names may differ: `toolbar.add` can connect to `items.add`.

| Gesture | Effect |
| --- | --- |
| Bundle to ordinary pin | Connect the uniquely matching member to that pin. |
| Ordinary pin to bundle | Connect that pin to the uniquely matching member. |
| Bundle to bundle | Connect the intersection of local member names, one ordinary connection per matching pair. |
| No matching names | Reject the gesture with an explanation. |
| Ambiguous matching | Require explicit member selection; do not guess. |

Apply existing direction, kind, contract, and connection rules to every candidate pair. Commit a valid gesture immediately, without a confirmation popup. Report unmatched members as nonblocking information. If any candidate pair is invalid or ambiguous, do not partially apply the operation; show the problem for resolution. Existing identical connections are retained without duplication. If every pair already exists, the gesture is a no-op.

Bundle matching is an editing shortcut, not a new constraint on ordinary wiring. Expanding a bundle preserves any existing connections between differently named pins. Users can expand and use ordinary wiring when automatic matching is inappropriate.

Adding a member later never automatically wires it. Renaming, rebundling, collapsing, or expanding never creates connections.

A successful gesture stores ordinary individual connections in `.mod.blu`. No runtime multicast or routing-by-list is introduced.

Manually drawn bundle connections preserve the user's traced path and existing pin sides. Each new matched connection inherits that path, with endpoint adjustments for its underlying member pins. Automatic routing is reserved for an explicit automatic connection action.

## Route display and feedback

To reduce line density as well as row count, connections between the same pair of displayed endpoints may share a visible route. Connections to different endpoints remain distinguishable. Preserve the individual logical connections and sufficient route data to expand them again.

- Hovering a bundled route shows its exact source-to-target member pairs.
- Clicking a bundled line selects its stable representative using the existing single-route selection mechanism. Dragging edits that representative's displayed path, and the other represented connections share the edited display while bundled. The representative remains fixed throughout the gesture. Expanding retains its edited geometry and the other routes' previous geometry. A drag is one undo step; a click alone does not change saved geometry.
- A collapsed row exposes which members are connected and which are unconnected, for example `2/3 connected`. Count connected members, not edges; fan-out must not inflate the count.
- A bundled line must not imply that every bundle member is connected. Hover and selection expose actual pair coverage, including connections to differently named pins.
- Aggregate validation, capability, and selection indicators must retain access to member details; one valid member must not hide another member's error.
- Deleting a bundled route explicitly removes all connections represented by that route as one undoable action. Individual connection deletion is available through member details or expansion.
- For long lists, truncate the label to available space and expose the complete ordered list on hover and in member details.

Initial bulk matching covers direct pin connections. Existing bus, pad, and proxy connections must survive bundling and expansion. Creating new bundled connections to buses, pads, or proxies is out of scope for the first version; require expansion for those gestures.

## Visualization persistence

Extend the compact pin string produced by `pinToString` in `core/types/util/convert.js`. Only the first member writes the ordered bundle widget IDs after the side marker, for example `(10 R 10 18 7) pin-name`. All pins continue to be saved as ordinary individual entries, with their existing layout and route data. Other members use the existing pin syntax. Never infer membership by parsing a label or a stored model pin name.

Widget IDs are stable and unambiguous within a node, including across pin rename. Do not add a separate bundle identifier, persistent collapsed-state flag, or model-only pin IDs. The first member represents bundle placement; ordinary member and route entries retain the information needed for expansion.

Reconstruct bundles in a second pass after all node pins exist: resolve the saved widget IDs, validate membership, and assign the same array to every member. Centralize bundle mutations so all members remain consistent, including during undo/redo. Visual route bundles retain references to their constituent ordinary connections.

Loading and reconciliation rules:

- Older visualization files without bundles show separate pins.
- Missing members are removed from the visual bundle with a diagnostic; bundles with fewer than two surviving members dissolve.
- Invalid mixed-kind, mixed-interface, or overlapping bundles fall back to separate pins with a diagnostic, without modifying the model.
- New pins discovered from an externally edited model appear separately; do not infer bundling or new connections.
- Copy/paste remaps bundle and member references to the pasted pins and retains only applicable route metadata.
- Saving and reopening preserves membership, order, placement, and connection coverage.

Older editors may discard bundle widget IDs when saving. This is an accepted compatibility behavior: the pins reopen expanded, with their ordinary model connections intact. No compatibility-family change is required solely for this extension.

## Undo and redo

Collapse and expand are each one visual undo step. Bulk pin creation and bulk connection gestures are each one coherent user action. Undo/redo must restore member identities, model connections, selection, bundling, and route layout without duplicate pins or edges.

## Acceptance criteria

1. Collapse, save, reload, expand, and save again leave `.mod.blu` byte-for-byte unchanged for a previously saved model.
2. Generated behavior and message delivery are identical before and after visual bundling.
3. A comma-list creation produces separate qualified model pins with separate metadata; no comma-list message appears in the model.
4. Connecting bundles with `new, add, remove` and `add, remove, clear` creates exactly the two matching ordinary connections and visibly reports unmatched members.
5. Bundle-to-single wiring affects only the matching member. Repeating a gesture produces no duplicates.
6. Invalid or ambiguous bulk wiring performs no partial model edit.
7. Expanding preserves fan-out, differently named endpoint pairs, contracts, capability metadata, and existing bus/proxy/pad connections.
8. Partial connectivity remains visible, and route inspection reports exact member pairs.
9. Renames, deletions, external model edits, copy/paste, and undo/redo preserve valid references or fall back safely as specified.
10. Browser and VS Code editors pass the same interaction and persistence checks.

## Implementation starting points

Inspect `core/types/widget/widget-pin.js`, `widget-pin-name.js`, `core/types/node/look-interface.js`, the pin/interface context menus, model-manager undo operations, route endpoint handling, and `core/types/model/blueprint-raw.js`. Read the current visualization schema before changing persistence.

The current pin widget combines semantic pin data with rendering and route state. Implement bundles through the shared `Pin.bundle` array and clearly named bundle helpers, without substituting a synthetic semantic pin in routing, serialization, or generation. Keep individual pins authoritative throughout. Comma-list creation and bulk wiring validate the entire operation before applying changes, each as one undoable action.

## Implementation notes

- Bundle membership, validation, loading reconciliation, matching, and display geometry are centralized in `core/types/widget/pin-bundle.js`.
- Expanded pin rectangles remain authoritative. `bundleRect` projects the collapsed rows and surrounding layout without changing the order used by model serialization. Individual route wires are retained; `route-bundle.js` computes their bundled display.
- Bundle actions and their undo/redo operations are in `core/nodes/model-manager/redox-bundle.js`. The shared context menus expose member profiles, capability settings, explicit rename/delete actions, and bundled-route inspection/deletion.
- The semantic save skips rewriting an unchanged `.mod.blu`, including preserving its existing formatting and filesystem timestamp. Generated-artifact provenance excludes bundle membership.
