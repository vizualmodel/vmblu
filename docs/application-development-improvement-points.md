# vmblu Application Development Improvement Points

## Purpose

This document records practical improvement opportunities observed while using
vmblu to design and implement the CrisisGrid Command Centre Web application.
It is not a complete review of vmblu. The assessment is based on one
architecture-heavy application that has progressed from responsibility design
through source nodes, a generated Svelte application, a resizable workspace,
and an interactive MapLibre view.

The central conclusion is that vmblu already provides useful architectural
discipline, but its development workflow and toolchain need to become more
predictable, economical, and evidence-driven.

## What is already working

vmblu helped preserve meaningful boundaries during implementation. Application
Shell owns the outer layout, Spatial Workspace owns only its mounted map,
Operational Picture is intended to coordinate shared browser state, and map
interactions that affect operational reality must pass through Action
Workspace. Those responsibilities survived contact with the implementation.

Node-local prompts are also valuable for long-running work by humans and
agents. They preserve why a responsibility exists, accepted decisions, open
questions, and pin intent close to the model element concerned.

The improvement points below should preserve these strengths.

## 1. Make the toolchain a single compatibility contract

### Problem

CLI, schema, runtime, editor, and generated formats can currently disagree.
The observed `factories` mismatch is a concrete example: the schema describes
file-path strings while CLI/core code emits objects. Such mismatches make it
unclear whether the model, validator, generator, or installed context is
authoritative.

### Suggested approach

- Publish a machine-readable compatibility manifest with each release. It
  should declare the supported CLI, core, schema, runtime, editor, and artifact
  format versions.
- Add a `vmblu doctor` command that reports resolved versions, incompatible
  combinations, stale generated artifacts, and known migration requirements.
- Build release candidates from one source revision and run canonical
  round-trip fixtures through load, validate, save, profile, generate, and run.
- Prevent publishing when the CLI emits artifacts that fail its own installed
  schemas.
- Keep readers temporarily backward-compatible where necessary, but always
  write one canonical representation.

## 2. Make authored and generated artifacts unmistakable

### Problem

A developer or agent must know which files are authoritative and which are
derived before making a safe change. Today that knowledge depends too much on
project instructions and experience. Editing a generated application or
profile as if it were source can produce convincing but disposable work.

### Suggested approach

- Put an explicit generated marker, generator version, source model identity,
  and source hash in every derived artifact.
- Provide one command that checks whether profiles, applications,
  capabilities, and other derived outputs match the current model.
- Make generated output locations consistent across project types.
- Refuse or prominently warn when an editor attempts to modify a generated
  artifact directly.
- Ensure regeneration is deterministic so an unchanged model produces no
  unrelated file churn.

## 3. Make prompt persistence safe and economical

### Problem

Prompt repositories provide important architectural memory, but the current
save path can rewrite clean prompts from stale in-memory content. Prompt,
model, and documentation updates also create a considerable synchronization
burden.

### Suggested approach

- Complete dirty-only prompt saving and retain dirty state safely through the
  full encode and save path.
- Detect external modification before overwriting a dirty prompt and report a
  conflict instead of silently choosing one version.
- Give every information category one clear owner: structural facts in the
  model, application-wide and node-local development context in prompt
  repositories, and demonstrated behavior in referenced scenario documents.
  Register shared project documents through the `References` section of each
  model root that depends on them instead of maintaining separate handovers.
- Add checks for duplicated or contradictory status information where
  practical.
- Generate inventories and routine status summaries from authoritative files
  instead of maintaining them manually.

## 4. Improve the source-node development loop

### Problem

Once implementation starts, developers move repeatedly between the semantic
model, source profiles, generated runtime wiring, framework components, and
ordinary application tooling. Errors at those boundaries are harder to locate
than ordinary frontend or service errors.

### Suggested approach

- Provide a watch mode that validates the model, refreshes the source profile,
  regenerates only what changed, and restarts the application when needed.
- Report errors in terms of the responsible node, pin, factory, source file,
  and generated consumer.
- Add an optional runtime trace showing node creation, lifecycle changes,
  messages, requests, replies, fanout, and failures.
- Allow a developer to filter that trace to one operator journey or one set of
  nodes.
- Make it easy to test a source node with a small typed harness without first
  running the complete application.

The trace should expose architectural behavior without becoming another
production logging framework.

## 5. Reduce ceremony for changes that do not alter architecture

### Problem

Not every component, helper, CSS change, or third-party library decision
changes a runtime responsibility. If routine implementation work requires
model churn, the model becomes noisy and developers learn to treat it as
ceremony.

### Suggested approach

- State clearly that component boundaries are not automatically vmblu node
  boundaries.
- Require model changes only when responsibility, ownership, message flow,
  trust boundary, deployment target, or externally relevant behavior changes.
- Provide project conventions for node-owned code and shared implementation
  code without forcing shared helpers into artificial runtime nodes.
- Let ordinary framework tooling handle local rendering and library concerns;
  vmblu should concentrate on executable responsibility and interaction
  boundaries.

## 6. Prevent architectural theatre through decision ownership and evidence

### Problem

A detailed model can look rigorous even when its boundaries have not been
tested by a real user journey. Agents are particularly capable of producing
plausible architectures quickly. This can create volume and apparent
completeness without corresponding evidence.

The answer is not to forbid agents from discussing architecture. It is to make
decision ownership and validation explicit.

### Suggested approach

Use the following development protocol:

1. The developer defines the first operator journey, important constraints,
   and initial architectural hypothesis. The developer should make or approve
   the first responsibility boundaries instead of asking an agent to invent a
   complete architecture autonomously.
2. The agent acts as a critic and design assistant. It identifies missing
   responsibilities, ambiguous ownership, unsafe coupling, and alternative
   boundaries, but labels these as proposals.
3. Only developer-reviewed decisions become accepted model structure. Record
   the decision owner and short rationale for consequential boundaries.
4. Implement the narrowest vertical slice that crosses those boundaries.
5. Compare runtime evidence and operator feedback with the hypothesis. Revise
   or remove nodes and contracts that the slice does not justify.
6. Expand the architecture only when the next journey requires it.

vmblu could support this protocol directly:

- Distinguish `proposed`, `accepted`, and `validated` architectural decisions.
- Associate accepted decisions with an owner, rationale, and validating
  scenario.
- Warn when many unvalidated nodes or contracts are added ahead of any
  executable journey.
- Offer an architecture review view that asks concrete questions about
  ownership, authority, failure, and observable behavior rather than rewarding
  model size.

Developer leadership should not mean that the first architecture is treated
as correct by authority. It means the developer owns the hypothesis and the
trade-offs, while implementation evidence remains allowed to overturn it.

## 7. Make validation proportional and easy to trust

### Problem

Different changes require different checks, but developers currently need
considerable knowledge to choose and run them. Excessive validation slows the
feedback loop; insufficient validation allows silent model and generated-state
drift.

### Suggested approach

- Classify changes as prompt-only, visualization-only, semantic, source-node,
  runtime, or release changes.
- Provide a standard validation set for each class.
- Add one `vmblu verify` command that selects the required checks from the
  changed files and explains what it ran and skipped.
- Include schema validation, canonical round trips, profile consistency,
  generation consistency, focused tests, and a runtime smoke test where
  applicable.
- Fail on incompatibility and stale output, but do not regenerate unrelated
  files automatically.

## Suggested implementation order

1. Fix schema/CLI canonical-format mismatches and add release compatibility
   checks.
2. Complete dirty-only prompt saving with conflict detection.
3. Add generated-artifact provenance and stale-output verification.
4. Introduce `vmblu doctor` and `vmblu verify`.
5. Add source-node runtime tracing and a focused test harness.
6. Add architectural decision states and scenario-based validation support.

The first four items improve trust in everyday work. The final two strengthen
vmblu's distinctive value: connecting an explicit architecture to observable
application behavior without mistaking model detail for proof.
