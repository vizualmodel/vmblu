# Cleanup Mode Handoff

Branch: `wiring`

This document captures a proposed editor cleanup mode for manually improving route layout while preserving the logical `.mod.blu` connection model.

## Goal

Allow a user to delete and redraw routes, cables, and buses without losing track of the logical connections that must still be visually represented.

Automatic routing can create a valid but visually messy diagram. Manual cleanup is acceptable, but it should be safe:

- the user should see which pins still need to be reconnected;
- temporary visual disconnections should not silently change `.mod.blu`;
- a half-cleaned diagram should not be saved as the good model by accident.

## Source Of Truth

During cleanup mode, logical connectivity comes from `.mod.blu`.

The editor should derive an expected connection list from the cooked model connections. The visual routes in `.mod.viz` are then checked against that expected list.

Cleanup mode edits visual layout only:

- routes;
- cables;
- buses;
- tacks;
- route geometry.

It should not change the authored `.mod.blu` `connections` array unless the user explicitly performs a model-level connect or disconnect command outside cleanup mode.

## User Workflow

Suggested workflow:

1. User enters cleanup mode.
2. Editor builds the expected logical connection list.
3. User deletes, converts, redraws, or reroutes visual connections.
4. Any expected connection that is not currently represented visually becomes pending.
5. Pending endpoints remain highlighted until a route, cable, or bus path represents the connection again.
6. When every pending connection is satisfied, cleanup mode can be completed.
7. If pending connections remain, the editor blocks normal save or requires an explicit discard/revert decision.

## Pending Connection Feedback

For each missing visual connection, the editor should make both endpoints visible and recognizable.

Possible UI signals:

- highlight the source pin/pad and destination pin/pad;
- show a small pending marker on each endpoint;
- draw a faint ghost line between pending endpoints;
- list pending connections in a cleanup panel;
- when the user starts drawing from one pending endpoint, emphasize its required counterpart.

The goal is that the user can freely remove a messy route, but still knows exactly what must be reconnected.

## Equivalence Rule

A cleaned diagram is functionally equivalent when every expected logical connection is represented by the current visual routes.

Representation may be direct or indirect:

- direct pin-to-pin route;
- pin-to-pad route for group boundaries;
- route through a bus;
- route through a cable;
- route through bridged buses/cables, if existing route traversal semantics allow it.

The checker should use the same effective connectivity logic used by runtime route tables and existing route/connection comparison code. In particular, it should not require the new visual route shape to match the old visual route shape.

## Implementation Ideas

The existing cook path already has useful pieces:

- `cookConx(raw.connections)` derives concrete source/destination endpoint pairs.
- `findRouteInConx(route, conx)` compares visual routes against expected logical connections.
- bus/cable tacks can derive reachable endpoint lists through `makeConxList`.

Cleanup mode can make this comparison interactive:

1. Build `expectedConx` from the current raw/cooked `.mod.blu` connections.
2. Build `actualConx` from the current visual routes, buses, cables, and tacks.
3. Compare by endpoint identity, not by route identity.
4. Mark every expected pair not found in actual as pending.
5. Refresh this pending set after every route/cable/bus edit while cleanup mode is active.

Endpoint identity should be stable enough to survive route edits:

- child node name + pin name for node pins;
- group boundary pin name for pads/proxies;
- direction/kind where needed to disambiguate.

## Save Safety

A half-cleaned model should not overwrite the good saved model silently.

Recommended guard:

- while cleanup mode is active and pending connections exist, normal save is blocked;
- autosave should either be suspended or write only to a recovery/draft location;
- closing the model with pending connections should prompt the user to finish, discard cleanup edits, or save a draft;
- successful completion of cleanup mode clears the pending state and allows normal save.

Possible implementation states:

- `cleanup.active`: cleanup mode is enabled;
- `cleanup.expectedConx`: logical connection snapshot taken when cleanup mode started;
- `cleanup.pendingConx`: currently missing visual representations;
- `cleanup.dirtyViz`: visual layout changed while cleanup mode is active;
- `cleanup.canSave`: true only when `pendingConx.length === 0`.

If the user explicitly wants to change logical connectivity, they should exit cleanup mode or use a separate model-edit command that updates `.mod.blu` deliberately.

## Recovery

Cleanup mode should keep enough state to recover safely:

- snapshot the initial `.mod.viz` route/cable/bus state when cleanup starts;
- allow "cancel cleanup" to restore that snapshot;
- allow "finish cleanup" only when no pending expected connections remain;
- optionally allow "save cleanup draft" for work in progress without replacing the canonical `.mod.viz`.

This makes cleanup mode a protected visual editing session instead of an ordinary destructive route-editing session.

## Open Questions

- Whether pending cleanup state belongs only in editor memory or should have an explicit draft file.
- Whether autosave should be disabled completely during cleanup mode or redirected to a recovery file.
- How visible ghost lines should be when many pending connections exist.
- Whether cleanup mode should support deliberate logical disconnects through a separate confirmation flow.
