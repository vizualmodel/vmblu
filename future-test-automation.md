# Future test automation for vmblu

Status: unified model-test foundation implemented; external application drivers remain future work

## 1. Purpose

vmblu uses three testing layers:

1. code tests for implementation details;
2. model tests for a node or a group; and
3. model tests for the complete application.

The coding agent normally writes and runs code tests after a change. Developers describe higher-level scenarios in dedicated test specification files. `vmblu make-test` turns those scenarios into deterministic JSON artifacts, and `vmblu run-test` executes them and reports the evidence.

Generated mirror nodes and visual test topologies are not part of this design. They add structure without improving execution or diagnosis.

## 2. Test perimeters

### 2.1 Code

Code tests live in the project's normal test framework and may exercise internal functions. vmblu does not interpret them.

### 2.2 Node

A node test creates one source node and interacts only through its declared pins. A scenario can send or request, inspect sends and replies, mount a returned view, interact with that view, and make DOM assertions.

The test assumes that normal runtime message switching is already covered by runtime code tests.

### 2.3 Group

A group test starts the group's complete descendant graph with real routing. It injects messages only through the group's proxy inputs and observes only its proxy outputs and replies.

A group is the supported multi-node perimeter. An arbitrary selection of unrelated nodes is not a test target: it has no natural contract or boundary.

### 2.4 Application

An application test starts the complete root model with its declared runtime and settings. It interacts at application boundaries, such as root pins, browser controls, incoming protocols, tools, timers, files, or storage.

Root pins and browser interactions are supported by the current foundation. Protocol-, tool-, timer-, filesystem-, and storage-specific drivers still need to be added. Application tests should prove complete flows, not repeat every node scenario.

## 3. Human-owned test specifications

Test intent has a different lifecycle from an implementation prompt. It therefore lives in a separate Markdown test specification, not in `promptRepo`. A test specification can be replaced or removed without rewriting the node prompt, and its notation can become more formal without making the prompt harder to read.

Every tested source or group node owns an optional `testRepo` reference. The root group uses its `testRepo` for application-level tests. The referenced Markdown file contains scenario headings and explicit executable steps:

```md
# Counter tests

## Adds two values

- Purpose: verify that consecutive inputs update the total.
- Send: `add` = `2`
- Send: `add` = `3`
- Expect send: `total` = `2`
- Expect send: `total` = `5`
```

Executable steps use a small explicit Markdown convention:

```md
- Send: `input` = `{"name":"Sam"}`
- Request: `view` = `null`
- Expect reply: `view` = `{"ok":true}`
- Mount: `view` = `null`
- Click: `{"role":"button","name":"Logout"}`
- Fill: `{"css":"input[name=email]"}` = `sam@example.com`
- Wait: `50`
- Expect view: `{"locator":{"role":"button","name":"Logout"},"visible":true,"count":1}`
- Expect send: `logout` = `null`
```

JSON-looking values are parsed as JSON; other values are strings. View locators use CSS or accessible role and name, so scenarios are independent of Svelte, React, Vue, or plain DOM implementation details. Canvas, WebGL, and other non-DOM surfaces may later use specialized drivers.

Tests do not belong in individual pin prompts. Pin prompts define intent; scenarios describe behaviour across a useful perimeter.

The test specification is the source of test intent. A coding agent may propose or replace scenarios, but `make-test` performs deterministic translation and does not reinterpret prose during a test run.

### 3.1 Ownership and linked models

`testRepo` belongs to the model that defines a source or group node. A dock node does not own or override it. An importing model may resolve and read the linked definition's test specification, but it must not save that specification or generate node-test files into the linked model. Integration behaviour of a dock instance belongs in the importing model's group or application tests.

The node cog popup is named **Node Properties**. It may edit the test specification location as node metadata. Startup settings (`sx`) are another field in this popup. Runtime settings (`dx`) remain in the separate runtime popup because a test reference is not runtime configuration.

## 4. Project layout and naming

```text
tests/
  code/
  nodes/
    Clipboard.md
    Clipboard.test.json
    Clipboard.result.json
    Orders.md
    Orders.test.json
    Orders.result.json
    Orders/
      Validator.md
      Validator.test.json
      Validator.result.json
  app/
    application.md
    application.test.json
    application.result.json
```

- `tests/code/` contains ordinary project tests and remains optional and project-defined.
- `tests/nodes/<name>.md` specifies a source-node test.
- A group has its own three files beside a same-named directory containing its children.
- `tests/app/application.md` specifies complete-application tests for the root model.

Names and directory hierarchy identify targets; UIDs do not. Safe filenames replace reserved characters and whitespace with `-`, while artifacts retain exact original node names.

The `.md` specification and deterministic `.test.json` artifact may be committed. `.result.json` is the canonical report from the latest run and is normally ignored by Git, even though it is stored beside the related files. Human-readable console output is derived from that JSON report.

A project does not need a `tests/` directory when it starts. Developers or coding agents add `tests/code`, `tests/nodes`, or `tests/app` only when those layers become useful. Code tests may mirror node hierarchy when that helps, but vmblu does not require code-level tests to belong to nodes.

## 5. Formal artifacts

All three model perimeters use the versioned `model-test.schema.json`. Its target scope is `node`, `group`, or `model`. Shared scenario syntax and reporting stay uniform while the runtime selects the correct execution adapter.

Each artifact records:

- schema and artifact version;
- source model and test-specification paths;
- test-specification and model-contract fingerprints;
- exact name path and scope;
- host type (`node` or `browser`); and
- scenario actions, expectations, purposes, and timeouts.

Formal artifacts are derived and may be regenerated. Authored fixtures or external-driver code must remain separate.

Reports identify the formal artifact and its fingerprint so an adjacent old result cannot be mistaken for evidence about a newly generated test. Generating a new artifact makes an older result stale until the test is run again.

## 6. Unified runtime

`@vizualmodel/vmblu-runtime/rt-model-test` owns scenario lifecycle, timeouts, observations, exact ordered comparisons, view assertions, cleanup, and reports. It selects one of two execution strategies:

- the source-node adapter creates one factory directly and supplies a test `tx` interface;
- the routed-model adapter starts a group subtree or complete model with real vmblu routing and exposes only its natural boundary.

Every scenario gets a fresh target. Actions within one scenario share the same instance, allowing stateful sequences. Reports distinguish a failed expectation from an execution or cleanup error.

The browser host is framework-neutral. A temporary Vite harness loads the project's source modules with the project's own Vite configuration, and Playwright drives a real browser. This lets framework plugins compile Svelte, React, Vue, or other Vite-supported sources without coupling the test format to a framework. The harness mounts a view returned by a node, performs accessible or CSS-located actions, and records node boundary messages and browser errors.

## 7. Commands

```text
vmblu make-test node <model-file> --node <name-path>
vmblu make-test node <model-file> --node <path> --node <path>
vmblu make-test group <model-file> --group <name-path>
vmblu make-test app <model-file>

vmblu run-test node <model-file> --node <name-path> [--scenario <id>]
vmblu run-test group <model-file> --group <name-path> [--scenario <id>]
vmblu run-test app <model-file> [--scenario <id>]
```

`make-test` resolves `testRepo`, validates names, pins, schema, and fingerprints, and writes the formal artifact beside its specification. If `testRepo` is absent or its specification is empty, it writes nothing. `run-test` rejects stale artifacts, writes `.result.json` beside the specification and artifact, prints a concise result, and exits non-zero for failures or errors. It does not invoke a coding agent and is suitable for CI.

Generating unrelated nodes in one command is only batch artifact generation; it does not make them one runtime test perimeter.

## 8. Reporting

The canonical report is JSON. Each scenario includes its purpose, actions, expectations, observations, duration, failure evidence, and status: `passed`, `failed`, `skipped`, or `error`.

A useful developer summary answers:

1. What behaviour and perimeter were tested?
2. What inputs and observations support the result?
3. What failed, where, and with what evidence?
4. What important behaviour remains outside the selected scenarios or available drivers?

Console and future JUnit output are views of the same report, not separate truth sources.

## 9. Agent workflow

For model tests, the coding agent:

1. reads the model, prompt, test specification, implementation, and existing tests;
2. proposes high-value missing scenarios when useful;
3. adds, replaces, or refines agreed scenarios in the test specification;
4. generates and validates the formal artifact;
5. creates only the fixtures or drivers the scenario requires;
6. runs the selected perimeter;
7. fixes implementation failures and reruns affected tests; and
8. reports evidence and remaining gaps clearly.

## 10. Implementation direction

The implemented foundation includes the unified schema, node/group/model scopes, direct and routed execution, source fingerprints, JSON reports, request/reply, asynchronous waits, and a real browser host for DOM-based nodes.

Next work should add application-boundary drivers in response to concrete use cases. Each driver needs a narrow action/observation contract and bounded diagnostic evidence. Likely candidates are HTTP or WebSocket input, tools, timers, and controlled filesystem events.

Later CI and editor work may add JUnit output, combined layer commands, and editor actions. Specialized visual drivers for Canvas or WebGL should be added only when a real application requires them.
