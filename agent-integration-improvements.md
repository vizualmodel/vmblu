# Deferred agent integration improvements

Status: deferred follow-up work

## Current baseline

vmblu now has a workable agent integration with three separate layers:

1. model-derived tools, probes, and events;
2. fail-closed profiles containing capability allow lists;
3. embedded, MCP, and projection interfaces bound to fixed profiles.

The implementation includes structured editors, request/reply schema
derivation, verification evidence, per-profile event isolation, versioned
schemas, generated artifacts, an embedded overlay, MCP stdio, OAuth-protected
MCP Streamable HTTP, and runtime/CLI tests.

This document no longer specifies the completed implementation. It records
only the remaining work that has deliberately been deferred.

## 1. Human approval UI

The broker already creates approval records that are bound to the profile,
tool, arguments, risk, expected effects, and original request. Records expire,
are single-use, and are invalidated when bound policy data changes.

What remains:

- show pending approvals to a trusted human in the embedded overlay;
- provide explicit Approve and Deny actions;
- show the tool, arguments, risk, expected effects, requesting profile, and
  expiry before a decision;
- ensure closing the UI, stopping the runtime, or losing the approver never
  implies approval;
- allow a host-provided approval service without letting the requesting agent
  approve itself.

Complete when an `approval: "always"` tool cannot run until a visible human or
explicitly configured trusted service approves that exact request.

## 2. Agent sidecars in the editor

Generation and CLI verification understand inline agent settings and string or
`{path}` sidecar references. The Application Settings popup currently edits
inline settings only and cannot safely load and round-trip an authored sidecar.

What remains:

- detect string and `{path}` agent references in the editor;
- load and validate the referenced `agents.v1.json` document;
- make it clear that the editor is editing a sidecar;
- save an authored sidecar only after an explicit user confirmation;
- preserve the reference when the runtime changes or agents are disabled;
- report missing, malformed, read-only, or unavailable sidecars without
  replacing them with default inline settings.

Complete when opening and closing Application Settings without edits preserves
the exact sidecar reference, and confirmed edits round-trip through the same
schema without silent conversion to inline settings.

## 3. Overlay outcome presentation

The broker and provider-facing result already distinguish `pending`, `denied`,
`accepted`, `completed`, `verified`, `unverified`, and `failed`.

What remains:

- display these states explicitly in the embedded overlay;
- distinguish dispatch from application completion;
- show verification evidence or the reason verification was not observed;
- connect pending results to the approval UI;
- keep trace, chat, and provider-facing wording consistent.

Complete when a user cannot mistake `accepted` for completed or verified work
in any visible agent interaction.

## 4. End-to-end editor tests

Core, runtime, and CLI behavior has focused automated coverage. Agent editing
still needs application-level regression tests.

Add tests for both the playground and VS Code webview covering:

- opening a model does not leave the loading spinner active;
- Agents support status and Enabled behavior across runtime changes;
- settings remain editable while disabled or unsupported;
- profile add, duplicate, delete, rename, and validation;
- Tools, Events, and Probes selection, Select All, Clear, and search;
- interface/profile references and interface-specific fields;
- saving, reopening, and preserving agent configuration;
- inline and sidecar configurations once sidecar editing is implemented.

Complete when the same behavioral suite runs against both editor hosts and
catches state-refresh and model-loading regressions.

## 5. Administrative principal

Normal agent profiles are intentionally fail-closed. Administrative broker
operations must not acquire implicit unrestricted access.

What remains:

- define an explicit privileged-principal configuration;
- separate administrative operations from normal application capabilities;
- authenticate the principal at the hosting boundary;
- record every administrative action in an audit trace;
- add denial and isolation tests for absent or untrusted principals.

Complete when administrative access exists only through explicit configuration
and authentication, with no unrestricted internal fallback.

## Additional non-blocking extensions

These are useful future features but are not required to close the five items
above:

- provider streaming and cancellation;
- durable event subscriptions and event-driven agent workflows;
- a UI bridge for Node/headless applications;
- richer trace filtering and export;
- additional provider projections and MCP resources or prompts.

They should be specified separately before implementation so they do not blur
the capability, profile, and interface boundaries.
