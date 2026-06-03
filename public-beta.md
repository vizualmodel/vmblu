# Public Beta Handoff

Date: 2026-06-02

## Positioning

The next public milestone should be a pre-1.0 public beta, not a 1.0 release.
vmblu has not yet had enough external usage to justify a 1.0 claim.

The public message should be:

```text
vmblu makes applications usable by agents through a controlled, inspectable and
policy-governed capability surface.
```

vmblu should not be positioned as an agent framework. It does not build the
agent. It exposes an application boundary that agents and agent frameworks can
use safely.

## Current Status

Recent work has brought the agent and security architecture into a coherent
state:

- External agents interact through declared capabilities, not direct
  application code calls.
- The `ToolBroker` is the mandatory execution boundary for tool, probe and
  event access.
- Runtime code is split into reusable libraries and small runtime composition
  folders.
- Agent support is separated into common agent base code, target-specific
  adapters and optional overlay code.
- Node.js security enforcement is defined as a model-wide envelope plus
  per-node requests.
- Security areas are `fs`, `net` and `process`, with operation-level modes
  `allow`, `warn` and `deny`.
- Node security requests cannot broaden the model security envelope.
- Browser runtimes no longer expose Node.js security controls.
- Runtime tests cover broker dispatch, adapter projection, browser-agent,
  nodejs-agent, runtime settings and security classification.
- The CLI package now depends on a separate `@vizualmodel/vmblu-core` package
  for model loading and compilation. `vmblu-core` does not depend on the
  runtime; runtime-specific `dx` normalization happens in the runtime.
- Examples have been moved out of the main repository into `vmblu-examples` and
  should use published `@vizualmodel/*` packages rather than local `file:`
  dependencies.

## Repositories

The public beta work touches three repositories:

- `vmblu`: framework, runtime, CLI, editor UI and playground.
- `vmblu.dev`: user guide and website documentation.
- `vmblu-examples`: public examples that demonstrate vmblu applications,
  including the planned agent integration and security behavior example.

## Step 1: Commit And Push Current vmblu Branch

Goal: preserve the current agent/security architecture work before starting the
public examples work.

Tasks:

1. Review the current dirty tree on the `agent-integration` branch.
2. Confirm which deletions are intentional:
   - `agents-integration.md`
   - `next-steps.md`
   - old pointer files under runtime variant folders
3. Confirm generated files are expected:
   - runtime `dist` files
   - runtime `dist/runtime-settings` files
   - `ui-svelte/out` files
   - playground generated bundle/files
   - CLI profile bundle
4. Confirm package-boundary changes are intentional:
   - root workspace includes `runtime`, `core` and `cli`
   - `core/package.json` publishes `@vizualmodel/vmblu-core`
   - `cli/package.json` depends on `@vizualmodel/vmblu-core`
   - `runtime/package.json` exposes the runtime settings subpath used by editor
     tooling
5. Run verification before commit:

```powershell
npm.cmd test
npm.cmd run build
```

from `runtime`, and:

```powershell
npm.cmd test
```

from `core`, and:

```powershell
npm.cmd run build
```

from `cli`, and:

```powershell
npm.cmd run build
```

from `ui-svelte` and `playground`.

6. Commit the current branch with a message that reflects the combined work,
   for example:

```text
Refine agent runtime and security settings
```

7. Push the branch to GitHub.

## Step 1a: Publish Package Fixes

Goal: make the published CLI usable outside the monorepo before examples depend
on it.

Package changes to preserve:

- `@vizualmodel/vmblu-runtime@0.5.5`
- `@vizualmodel/vmblu-core@0.5.5`
- `@vizualmodel/vmblu-cli@0.5.5`

Publish order:

1. `@vizualmodel/vmblu-runtime`
2. `@vizualmodel/vmblu-core`
3. `@vizualmodel/vmblu-cli`

Reason: the CLI imports model/compiler code from `@vizualmodel/vmblu-core`.
The old published CLI contained monorepo-relative imports that failed in a clean
install.

Verification before publishing:

- pack/install runtime, core and CLI in a clean temp project
- import `@vizualmodel/vmblu-core/types/model`
- import CLI command modules for `make-app`, `make-capabilities`,
  `make-agent-adapter` and `make-test`
- run those commands against a copied example model

Note: on the current Windows/npm setup, `npm pack` for `cli` may hit an npm
workspace/arborist issue when run from inside the workspace. Packing the CLI
from a temporary copy worked and the tarball passed smoke tests.

## Step 2: Write The Example Spec

Goal: define one strong public example, or two smaller examples, before writing
code.

Preferred direction: combine agent integration and security into one example if
the result stays understandable. A combined example is stronger because it shows
why the agent boundary matters.

Candidate combined example:

```text
Agent-operated task workspace
```

The application exposes a small set of agent-facing capabilities:

- tools for creating or updating task records
- probes for reading selected application state
- events for observing meaningful application changes
- a Node.js runtime security envelope that limits filesystem, network and
  process access

The example should demonstrate:

- an external agent calling the application through a generated adapter or
  gateway
- all calls routed through the `ToolBroker`
- a permitted action succeeding
- a denied or warned runtime action being reported
- node-specific security settings being clipped by the model-wide envelope

Alternative split:

- `agent-integration-example`: focuses on capabilities, adapter/gateway and
  broker dispatch.
- `security-enforcement-example`: focuses on model envelope, node request and
  runtime security events.

Decision point: choose combined unless it becomes too dense for a first public
reader.

## Step 3: Implement The Example

Goal: create a working example that a new user can run and inspect.

Implementation requirements:

- Keep it small enough to understand in one sitting.
- Work in the `vmblu-examples` repository.
- Depend on published `@vizualmodel/*` packages, not local packages from
  `../vmblu`.
- Use a Node.js runtime for the security part, because browser runtimes do not
  enforce Node-style `fs/net/process` policy.
- Include a clear capability surface:
  - at least one tool
  - at least one probe
  - at least one event
- Route agent actions through the `ToolBroker`.
- Include a simple adapter/gateway path suitable for a public demo.
- Keep browser overlay use optional; the example should also show the external
  agent boundary.
- Add focused tests or scripted verification where practical.

Verification should cover:

- app starts
- capabilities are generated or loaded
- agent-facing adapter/gateway exposes the expected surface
- allowed tool call succeeds
- denied runtime behavior is denied or reported
- trace/security output is visible enough to explain

## Step 4: Review Example And User Documentation

Goal: ensure the public story is consistent across code, examples and docs.

Review the example for:

- clear setup steps
- no hidden local paths or machine-specific assumptions
- concise README
- obvious distinction between external agent, runtime support and AI nodes
- explicit broker boundary
- realistic security behavior

Review `vmblu.dev` documentation for:

- installation page matches the simplified public installation flow
- agent integration chapter reflects the current runtime split
- security enforcement chapter matches runtime-specific behavior
- browser runtimes are not described as enforcing Node.js `fs/net/process`
  security
- model-wide settings and per-node settings are described consistently
- examples are linked from the relevant user guide sections
- public language says pre-1.0/public beta, not 1.0

Specific docs to revisit:

- `docs/guide/installation.md`
- `docs/guide/user-guide/agent-integration.md`
- `docs/guide/user-guide/security-enforcement.md`

Current install-doc direction:

- installation is agent-oriented but agent-independent
- normal users install CLI and runtime
- `vmblu-core` is mentioned as a CLI dependency, not as a separate application
  install step
- runtime is selected in the editor/model, not by editing generated app files
- examples link points to `https://github.com/vizualmodel/vmblu-examples`

## Step 5: Commit And Push Examples And vmblu.dev

Goal: make the public beta material available in GitHub.

Tasks:

1. Commit the examples repository after the example is implemented and
   verified.
2. Commit `vmblu.dev` after the docs are reviewed and updated.
3. Push `vmblu-examples` and `vmblu.dev` to GitHub.
4. Confirm links between docs and examples resolve correctly.
5. Do a final public-beta smoke test from fresh instructions.

## Final Public Beta Checklist

Before announcing publicly:

- vmblu branch pushed.
- runtime/core/CLI package fixes published or ready to publish.
- examples repository pushed.
- vmblu.dev pushed.
- one strong agent/security example is available.
- docs explain how to run the example.
- docs describe vmblu as pre-1.0/public beta.
- runtime tests pass.
- UI/playground build passes.
- website build passes.

