# vmblu Distribution and Project Layout Handoff

Last updated: 2026-05-04

## Purpose

This document is the implementation reference for the next vmblu distribution
and project-layout iteration. The goal is to keep vmblu agent-agnostic while
making Codex, Claude, MCP, and future agent integrations easier to install and
evolve.

The key design direction is:

```text
vmblu core packages
  -> agent-specific adapters
  -> project-local configuration
```

The vmblu CLI/runtime/schema/capability model are the canonical product.
Codex skills/plugins, Claude support files, and MCP projections are integration
layers over that core.

## Decisions

1. Keep `vmblu init` for project-local initialization.
2. Reduce `.vmblu` to vmblu project metadata, pinned versions, optional
   overrides, cache, logs, and local bridge configuration.
3. Keep `vmblu agent install <agent>` as the generic installer for
   agent-specific support files.
4. Add a Codex plugin distribution as the richer Codex UX.
5. Fill out `cli/agent/CLAUDE` with Claude-specific instructions and config.
   Do not force Claude into the Codex skill shape.
6. Make MCP and capability generation the common runtime interaction surface
   across Codex, Claude, and other agents.
7. Move application model files into a top-level `model/` folder.
8. Add a root `<projectName>.blu` entrypoint manifest that resolves to the
   actual model file inside `model/`.
9. Make runtime selection explicit with runtime package subpaths:
   `/rt-base`, `/rt-als`, or `/rt-agent`.

## Implemented So Far

The main distribution/layout slice is now implemented. Remaining work is mostly
packaging polish, migration tooling, and richer agent integrations.

Implemented in the CLI:

- Added shared entrypoint resolution in `cli/lib/resolve-entrypoint.js`.
- Updated `make-app`, `make-capabilities`, `make-test`, and `profile` so they
  accept either a direct `.mod.blu` file or a root `*.blu` entrypoint manifest.
- Updated `vmblu init` to create:

```text
<projectName>.blu
model/<projectName>.mod.blu
model/<projectName>.mod.viz
nodes/
.vmblu/vmblu.prompt.md
.vmblu/overrides/
.vmblu/cache/
.vmblu/logs/
package.json
```

- Stopped copying general schemas, annex docs, `develop.prompt.md`, and
  `test.prompt.md` into `.vmblu/` by default.
- Updated generated package scripts to use `<projectName>.blu`:
  - `vmblu profile <projectName>.blu`
  - `vmblu make-app <projectName>.blu`
  - `vmblu make-capabilities <projectName>.blu`
- Added `lib` to the CLI package `files` list.
- Updated `cli/README.md` with the new project layout and entrypoint behavior.
- Updated the Codex skill to understand root `*.blu` entrypoints and `model/`.
- Added a minimal Claude support file under `cli/agent/CLAUDE` so
  `vmblu agent install claude --dry-run` has a real payload.
- Fixed `vmblu agent install <agent> --dry-run` so existing destination files
  are reported as skipped instead of failing.
- Removed `.vmblu/project.json` from the default initialized layout because
  its previous contents duplicated information already present in the model
  header and root entrypoint.
- Simplified generated entrypoint manifests to only `kind`, `version`, and
  `model`; derived artifacts such as `.mod.viz`, `.cap.json`, `.src.prf`, and
  `.app.js` are resolved by convention from the model path unless a future
  project explicitly needs overrides.
- Migrated the workspace vmblu projects to the new root-entrypoint and
  `model/` convention:
  - `core`
  - `examples/chat-application/chat-client`
  - `examples/chat-application/chat-server`
  - `playground`
  - `ui-svelte`
- Updated model-local paths after migration:
  - node implementation paths now resolve from `model/*.mod.blu` to
    `../nodes/...`;
  - cross-model links now target `../../core/model/core.mod.blu` and
    `../../ui-svelte/model/ui-svelte.mod.blu` where appropriate;
  - build entrypoints now load generated apps from `model/*.app.js`.
- Checked and repaired the embedded VS Code extension model at
  `vscodex/webview/webview.mod.blu`:
  - fixed invalid JSON in the `imports` array;
  - updated cross-model paths to the new `model/` locations;
  - updated the runtime path to `../../runtime/rt-base/scaffold.js`.
- Made runtime selection explicit:
  - base runtime models use `@vizualmodel/vmblu-runtime/rt-base`;
  - agent runtime models use `@vizualmodel/vmblu-runtime/rt-agent`;
  - the package-root `@vizualmodel/vmblu-runtime` export was removed from the
    runtime package so stale ambiguous imports fail clearly.
- Bumped the runtime package to `0.3.0` and updated new-project package
  generation to depend on `@vizualmodel/vmblu-runtime@^0.3.0`.
- Added a repo-local Codex plugin source package under `plugins/vmblu/`.
- Added `vmblu plugin build-codex` to assemble the Codex plugin from the
  canonical Codex agent files and existing branded assets.
- Added `.agents/plugins/marketplace.json` for local Codex plugin discovery.

Verified:

```bash
npm.cmd run build
node cli/bin/vmblu.js init <tmp-project>
node cli/bin/vmblu.js make-capabilities <tmp-project>/<projectName>.blu
node cli/bin/vmblu.js make-app <tmp-project>/<projectName>.blu
node cli/bin/vmblu.js make-test <tmp-project>/<projectName>.blu
node cli/bin/vmblu.js profile <tmp-project>/<projectName>.blu
node cli/bin/vmblu.js agent list
node cli/bin/vmblu.js agent install codex --dry-run
node cli/bin/vmblu.js agent install claude --dry-run
node cli/bin/vmblu.js plugin build-codex
```

Solar-system migration trial:

- Added a non-destructive new-layout copy in `examples/solar-system`:
  - `main.blu`
  - `model/main.mod.blu`
  - `model/main.mod.viz`
  - `model/main.cap.json`
  - `model/main.app.js`
- Kept the existing root model/source files in place.
- Adjusted only the copied `model/main.mod.blu` node references from
  `./nodes/...` to `../nodes/...`, because node paths are relative to the model
  file location.
- Verified `make-capabilities`, `make-app`, `profile`, and the solar-system
  Vite build through the new entrypoint path.

Note: `/examples/` is ignored by the repository `.gitignore`, so the
solar-system migration trial is a local verification fixture unless those files
are explicitly force-added later.

## Non-Goals

- Do not make a Codex plugin the canonical vmblu distribution.
- Do not store the authoritative application model under `.vmblu/`.
- Do not copy all general vmblu docs into every initialized project.
- Do not duplicate the same canonical documentation separately for Codex and
  Claude. Agent adapters may contain short entry instructions, but the vmblu
  CLI/runtime/package docs remain canonical.
- Do not make each model-related file look like a separate model. A vmblu model
  can be spread across several files, but it remains one logical model.

## Target Project Layout

For a new project named `my-app`, `vmblu init my-app` should create:

```text
my-app/
  my-app.blu
  package.json
  model/
    my-app.mod.blu
    my-app.mod.viz
  nodes/
  .vmblu/
    vmblu.prompt.md
    overrides/
    cache/
    logs/
```

Optional files may be added as features require them:

```text
my-app/
  model/
    my-app.cap.json
    my-app.src.prf
    my-app.test.blu
  .vmblu/
    llm-bridge/
      config.json
      proxy.js
```

### Meaning of Each Area

`<projectName>.blu`

- Public project entrypoint.
- Human/editor/CLI-friendly file to open.
- Not the full model.
- Resolves to the canonical model file in `model/`.

`model/`

- Application model file set.
- Contains model, visual layout, generated capabilities, profiles, and
  model-level test files.
- Files in this folder may be part of the application distribution if the app
  needs them at runtime.

`nodes/`

- Source code owned by the model.
- The generated app and model should reference node implementation files here.

`.vmblu/`

- vmblu workspace/tool metadata.
- Project-local prompt and optional overrides.
- Local cache, logs, bridge config, traces, and other generated local state.
- Not the place for primary application source or authoritative model files.

## Entrypoint Manifest

The root `<projectName>.blu` file should be a small JSON manifest:

```json
{
  "kind": "vmblu.entrypoint",
  "version": 1,
  "model": "model/my-app.mod.blu"
}
```

Recommended v1 fields:

- `kind`: must be `"vmblu.entrypoint"`.
- `version`: entrypoint manifest format version.
- `model`: relative path to the canonical `.mod.blu` file.

No derived artifact paths should be listed by default. The editor and CLI can
derive related files from the model path:

```text
model/my-app.mod.blu -> model/my-app.mod.viz
model/my-app.mod.blu -> model/my-app.cap.json
model/my-app.mod.blu -> model/my-app.src.prf
model/my-app.mod.blu -> model/my-app.app.js
```

Only add optional override fields later if a project intentionally diverges
from these conventions.

Paths are relative to the directory containing the entrypoint file.

### Resolver Behavior

All vmblu commands that currently accept a `.mod.blu` path should accept either:

```bash
vmblu make-app model/my-app.mod.blu
vmblu make-app my-app.blu
```

When the input is an entrypoint manifest, the command should resolve the
manifest's `model` path and operate on that model.

The resolver should:

- Detect `*.blu` files with `kind: "vmblu.entrypoint"`.
- Resolve relative paths from the entrypoint file's directory.
- Return both the original entrypoint path and resolved model path.
- Preserve command output paths unless the command has its own documented
  output convention.
- Fail clearly when the entrypoint is invalid or the referenced model is
  missing.

The resolver should not treat arbitrary `.blu` files as entrypoints unless the
`kind` value matches.

## `.vmblu/project.json`

`vmblu init` should not create `.vmblu/project.json` by default.

The previous default file mostly duplicated information already available
elsewhere:

- schema version lives in the model header,
- the CLI version is not a project contract,
- the root entrypoint is visible as `<projectName>.blu`,
- derived files are conventionally resolved from the model path.

Reserve `.vmblu/project.json` for future non-default configuration that cannot
be inferred from the entrypoint/model. Possible future fields:

- `schemaMode`: package, pinned-copy, remote, or custom
- `overrides`
- `runtimePackage`
- `runtimeVersion`
- `agentAdapters`

## `.vmblu/vmblu.prompt.md`

Keep this file small and project-facing.

It should tell coding agents:

- This is a vmblu project.
- Use the root `*.blu` entrypoint to find the model.
- Treat `model/` as the application model file set.
- Treat `nodes/` as model-owned implementation code.
- Use installed vmblu agent support, plugin support, or CLI package docs for
  general vmblu instructions.
- Do not assume copied schemas/docs in `.vmblu` are canonical.

The current large copied docs/prompts should move toward package-level or
agent-installed docs. Project-specific overrides can live under
`.vmblu/overrides/`.

## Schema and Docs Policy

The old `vmblu init` copied these files into `.vmblu/`:

```text
blu.schema.json
blu.annex.md
viz.schema.json
prf.schema.json
capabilities.schema.json
vmblu.prompt.md
develop.prompt.md
test.prompt.md
```

New behavior:

- Do not copy general schemas and annex docs by default.
- Store the schema version in the model header.
- Resolve schemas and annex docs from `cli/context/<schema-version>/` in the
  installed `@vizualmodel/vmblu-cli` package.
- Allow project-specific overrides under `.vmblu/overrides/`.
- Consider an explicit flag later for fully offline/pinned copies, for example
  `vmblu init --copy-schemas` or `vmblu pin-schemas`.

This avoids stale copied docs while still allowing reproducible projects when
explicitly requested. `cli/context/` is now the canonical packaged source for
schema and annex context.

## Agent Distribution

### Generic Agent Installer

Keep:

```bash
vmblu agent list
vmblu agent install codex
vmblu agent install claude
```

`cli/commands/agent/index.js` already discovers manifests from `cli/agent/*`.
That mechanism should remain generic.

### Codex

Keep the current Codex skill path as the lightweight installation route:

```text
cli/agent/CODEX/
  manifest.json
  SKILL.md
  openai.yaml
```

The repo now also contains a Codex plugin source package as the richer UX
route. The plugin may eventually expose:

- vmblu project detection
- entrypoint/model resolution
- commands for `init`, `make-app`, `make-capabilities`, `make-test`, and
  `agent install`
- links to vmblu docs
- possibly project diagnostics

The plugin should call the vmblu CLI/runtime. It should not duplicate vmblu
core logic.

#### Codex Plugin

Status: first useful version implemented.

The Codex plugin is the richer Codex UX layer over vmblu core. It is not the
canonical vmblu distribution. The plugin packages presentation metadata, the
vmblu Codex skill, branded assets, and later may package helper scripts and
MCP/app integration files.

Current repo-local plugin layout:

```text
plugins/vmblu/
  .codex-plugin/
    plugin.json
  README.md
  skills/
    vmblu/
      SKILL.md
      agents/
        openai.yaml
  assets/
    icon.png
    logo.png
    screenshot.png
```

The plugin skill files are assembled from `cli/agent/CODEX/`, which remains the
canonical source for `vmblu agent install codex`.

Current assembly command:

```bash
node cli/bin/vmblu.js plugin build-codex
node cli/bin/vmblu.js plugin build-codex --out ./dist/plugins/vmblu
```

Current `plugin.json` shape:

```json
{
  "name": "vmblu",
  "version": "0.1.0",
  "description": "Codex support for creating and working in vmblu projects.",
  "author": {
    "name": "Vizual Model",
    "url": "https://github.com/vizualmodel/vmblu"
  },
  "homepage": "https://github.com/vizualmodel/vmblu",
  "repository": "https://github.com/vizualmodel/vmblu",
  "license": "Apache-2.0",
  "keywords": ["vmblu", "visual-modeling", "architecture", "codex", "mcp"],
  "skills": "./skills/",
  "interface": {
    "displayName": "vmblu",
    "shortDescription": "Work with vmblu visual architecture projects.",
    "longDescription": "Adds Codex guidance for initializing vmblu projects, reading project-local vmblu prompts, using root entrypoints, and preserving generated model structure.",
    "developerName": "Vizual Model",
    "category": "Developer Tools",
    "capabilities": [
      "Project scaffolding",
      "Code generation guidance",
      "Model-aware workflow"
    ],
    "websiteURL": "https://github.com/vizualmodel/vmblu",
    "brandColor": "#2C7BE5",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png",
    "screenshots": [
      "./assets/screenshot.png"
    ],
    "defaultPrompt": [
      "Use vmblu in this project.",
      "Initialize a vmblu project here.",
      "Check this vmblu model structure."
    ]
  }
}
```

Asset requirements:

- `assets/icon.png`: small square composer icon.
- `assets/logo.png`: larger plugin logo/card asset.
- `assets/screenshot.png`: current starter screenshot asset.
- Future polished versions can add separate screenshots for init, model, and
  agent/capability workflows.
- Keep asset paths relative to plugin root and use PNG screenshots.

Implementation steps:

1. Scaffold a repo-local plugin at `plugins/vmblu/`. Done.
2. Add `.codex-plugin/plugin.json` with metadata. Done.
3. Copy `cli/agent/CODEX/SKILL.md` into
   `plugins/vmblu/skills/vmblu/SKILL.md`. Done through
   `vmblu plugin build-codex`.
4. Copy `cli/agent/CODEX/openai.yaml` into
   `plugins/vmblu/skills/vmblu/agents/openai.yaml`. Done through
   `vmblu plugin build-codex`.
5. Add branded PNG assets under `plugins/vmblu/assets/`. Done using the
   existing VS Code extension assets.
6. Add a repo marketplace entry in `.agents/plugins/marketplace.json`. Done:

```json
{
  "name": "vmblu",
  "source": {
    "source": "local",
    "path": "./plugins/vmblu"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Developer Tools"
}
```

7. Validate plugin and marketplace JSON. Done.
8. Test assembly to a custom output folder. Done.
9. Test plugin installation/discovery locally in Codex. Pending.
10. Add optional helper scripts only after the first plugin package works.

Future plugin enhancements:

- `scripts/detect-project.js`: detect root `*.blu` entrypoints and `model/`.
- `hooks.json`: optional project detection or context hooks if Codex plugin
  support needs them.
- `.mcp.json`: optional MCP server configuration once the vmblu MCP projection
  is packaged as a stable plugin-facing server.
- richer screenshots after the new project layout and agent runtime have a
  stable visual story.

### Runtime Packages

The runtime package currently exposes explicit subpaths only:

```text
@vizualmodel/vmblu-runtime/rt-base
@vizualmodel/vmblu-runtime/rt-als
@vizualmodel/vmblu-runtime/rt-agent
```

`@vizualmodel/vmblu-runtime` is intentionally no longer exported. This avoids
silent fallback to base runtime when a model should clearly state its runtime.

Current model usage:

- `core`, `chat-client`, `chat-server`, `ui-svelte`: `/rt-base`
- `playground`: `/rt-agent`
- `vscodex/webview`: repo-relative `../../runtime/rt-base/scaffold.js`

New `vmblu init` projects should write:

```json
"runtime": "@vizualmodel/vmblu-runtime/rt-base"
```

### Claude

Fill out:

```text
cli/agent/CLAUDE/
  manifest.json
  ...
```

Claude support should use Claude-native instruction/config conventions and MCP
where appropriate. Do not force it to mirror the Codex `SKILL.md` layout unless
Claude itself benefits from that shape.

### MCP and Capabilities

The common runtime interaction model is:

```text
vmblu model metadata
  -> capability manifest
  -> MCP/provider/tool adapter
  -> agent
  -> ToolBroker
  -> vmblu runtime queue
```

Capabilities remain vmblu-native. MCP is an adapter/projection, not the
internal model.

## CLI Implementation Plan

### Phase 1: Add Entrypoint Resolver

Status: implemented.

Add a shared resolver module in the CLI, for example:

```text
cli/lib/resolve-entrypoint.js
```

Responsibilities:

- Accept a path.
- If it points to a `.mod.blu`, return it unchanged as the model path.
- If it points to an entrypoint manifest, load JSON and resolve `model`.
- Validate `kind`, `version`, and `model`.
- Return a structured result:

```js
{
  inputPath,
  inputKind: "model" | "entrypoint",
  entrypointPath,
  modelPath,
  entrypoint
}
```

Commands should use this helper instead of ad hoc path assumptions.

### Phase 2: Update Commands to Accept Entrypoints

Status: implemented for root `*.blu` entrypoints in `make-app`,
`make-capabilities`, `make-test`, and `profile`.

Update commands that currently accept model files:

- `make-app`
- `make-capabilities`
- `make-test`
- `profile`, if applicable
- editor/VS Code integration paths, if applicable

Each command should continue accepting direct `.mod.blu` paths.

### Phase 3: Update `vmblu init`

Status: implemented for the new default layout and slim `.vmblu/`.

Previous implementation:

- Creates `<projectName>.mod.blu` in the project root.
- Creates `.vmblu/`.
- Creates `nodes/`.
- Copies schemas, annex, and prompts into `.vmblu/`.
- Creates `package.json`.

Implemented behavior:

- Create root `<projectName>.blu`.
- Create `model/<projectName>.mod.blu`.
- Create `model/<projectName>.mod.viz` if the editor expects it or if a minimal visual
  scaffold is already available.
- Create `nodes/`.
- Create small `.vmblu/vmblu.prompt.md`.
- Create `.vmblu/overrides/`, `.vmblu/cache/`, and `.vmblu/logs/`.
- Create `package.json`.
- Do not copy general schemas/docs by default.

The final tree hint should show the new layout.

### Phase 4: Package Docs And Context

Status: implemented for the current pre-compatibility phase. `cli/README.md`,
`cli/package.json`, Codex skill guidance, shared `cli/context/`, `vmblu init`,
and `vmblu migrate` have been updated.

Keep CLI package docs and context aligned:

- `cli/README.md`
- any init help text
- package `files` list if new helper modules or context versions are added
- context files under `cli/context/<version>/`

Keep context files in the package so commands work through `npx`.

### Phase 5: Agent Adapters

Status: partially implemented. Codex skill guidance has been updated and is
now also packaged through the repo-local Codex plugin. Codex and Claude both
install the shared versioned `cli/context/` folder. Claude has a minimal
installable support file, but the Claude-native integration still needs more
design.

- Keep `cli/agent/CODEX` working.
- Update Codex skill instructions so they look for root `*.blu` entrypoints
  and `model/`.
- Add useful Claude files under `cli/agent/CLAUDE`.
- Update `vmblu agent list/install` docs.
- Keep `plugins/vmblu/` assembled from the Codex agent files with
  `vmblu plugin build-codex`.

### Phase 6: Codex Plugin Distribution

Status: first useful version implemented.

Current pieces:

- `plugins/vmblu/.codex-plugin/plugin.json`
- `plugins/vmblu/README.md`
- `plugins/vmblu/skills/vmblu/SKILL.md`
- `plugins/vmblu/skills/vmblu/agents/openai.yaml`
- `plugins/vmblu/assets/icon.png`
- `plugins/vmblu/assets/logo.png`
- `plugins/vmblu/assets/screenshot.png`
- `.agents/plugins/marketplace.json`
- `cli/commands/plugin/index.js`

Current command:

```bash
node cli/bin/vmblu.js plugin build-codex
node cli/bin/vmblu.js plugin build-codex --out ./dist/plugins/vmblu
```

Remaining plugin work:

- Test installation/discovery in Codex itself.
- Decide whether the plugin should eventually move to a separate distribution
  repo or stay packaged from this repo.
- Add helper scripts, hooks, and MCP config only after the basic plugin package
  is validated in the target Codex UX.

### Phase 7: Optional Migration Command

Status: not implemented. A manual/non-destructive solar-system migration trial
was used for verification.

Add or extend `vmblu migrate` to convert old flat projects:

```text
old:
  my-app.mod.blu
  .vmblu/blu.schema.json
  .vmblu/blu.annex.md

new:
  my-app.blu
  model/my-app.mod.blu
```

Migration must be conservative:

- Do not overwrite user files unless `--force` is supplied.
- Preserve existing `.mod.blu`, `.mod.viz`, `.cap.json`, profile, and test
  files.
- Prefer move/copy plans that can be shown with `--dry-run`.
- Remove copied docs/schemas only with explicit confirmation or a dedicated
  cleanup flag.

## Runtime and App Distribution

Some model-related files are application assets and may need to be included in
the app distribution. Therefore they belong under `model/`, not `.vmblu/`.

Build/package scripts should be able to include:

```text
<projectName>.blu
model/
nodes/
```

Local-only files should remain under `.vmblu/` and can often be ignored from
published app artifacts:

```text
.vmblu/cache/
.vmblu/logs/
.vmblu/llm-bridge/config.local.json
```

Runtime imports in generated apps must be explicit. Use:

```js
import * as VMBLU from "@vizualmodel/vmblu-runtime/rt-base"
```

or another explicit runtime subpath such as `/rt-als` or `/rt-agent`.
Do not generate package-root runtime imports.

## Verification Plan

Add focused tests for:

- `resolve-entrypoint` with direct `.mod.blu` input.
- `resolve-entrypoint` with valid `<projectName>.blu`.
- invalid entrypoint `kind`.
- missing `model` field.
- missing referenced model file.
- command behavior for `make-app <projectName>.blu`.
- command behavior for `make-capabilities <projectName>.blu`.
- `vmblu init --dry-run` output for new layout.
- `vmblu init` creates the target tree.
- `vmblu agent install codex --dry-run` still works.
- `vmblu agent install claude --dry-run` once Claude files are added.
- `vmblu plugin build-codex` creates the repo-local plugin.
- `vmblu plugin build-codex --out <path>` creates a distributable copy.
- runtime package root import is rejected.
- runtime explicit subpath import succeeds.

Manual verification:

```bash
node cli/bin/vmblu.js init tmp-app --dry-run
node cli/bin/vmblu.js init tmp-app
node cli/bin/vmblu.js make-app tmp-app/tmp-app.blu
node cli/bin/vmblu.js make-capabilities tmp-app/tmp-app.blu
node cli/bin/vmblu.js agent list
node cli/bin/vmblu.js agent install codex --dry-run
node cli/bin/vmblu.js agent install claude --dry-run
node cli/bin/vmblu.js plugin build-codex
node cli/bin/vmblu.js plugin build-codex --out C:/tmp/vmblu-plugin-check
npm.cmd run build
```

Additional manual verification already run during this slice:

```bash
npm.cmd run build  # runtime
npm.cmd test       # runtime
npm.cmd run build  # cli
npm.cmd run build  # examples/chat-application/chat-client
npm.cmd run build  # playground
npm.cmd run build  # ui-svelte
npm.cmd run webview # vscodex
```

## Backward Compatibility

For now, keep support for existing flat projects:

```text
project.mod.blu
.vmblu/
```

The CLI should accept direct `.mod.blu` paths indefinitely. The root `*.blu`
entrypoint is an added convenience and project convention, not the only way to
run vmblu.

Old `.vmblu` docs/schemas may continue to exist in existing projects. New code
should not assume they exist.

Runtime imports are the exception to this compatibility stance for now:
generated apps and model headers should no longer use
`@vizualmodel/vmblu-runtime` without a subpath. Use explicit runtime subpaths
instead.

## Open Questions

- Should `vmblu init` continue to create `model/<projectName>.mod.viz` immediately?
  Current implementation does create a minimal visual scaffold.
- Should generated profile output standardize on `model/<projectName>.src.prf`
  in all docs and commands?
- Should fully offline schema pinning be a flag on `init`, a separate
  `pin-schemas` command, or both?
- What exact Claude-native files should `cli/agent/CLAUDE` install beyond the
  first minimal `VMblu.md`?
- Should the Codex plugin stay repo-local under `plugins/vmblu/`, be published
  from a separate distribution repo, or support both?
- Should a future plugin version package MCP config once the MCP projection is
  finalized?

## Implementation Order

Recommended order:

1. Add entrypoint resolver. Done.
2. Update `make-app` and `make-capabilities` to use it. Done.
3. Update `make-test` and `profile` to use it. Done.
4. Update `vmblu init` to create `<projectName>.blu`, `model/`, and slim `.vmblu/`.
   Done.
5. Update docs and Codex skill. Partially done.
6. Add Claude support files. Minimal first pass done.
7. Add Codex plugin distribution. First useful version done.
8. Add explicit runtime subpaths and remove ambiguous runtime package root.
   Done.
9. Add migration support for old flat projects.

This order gives immediate value while preserving backward compatibility.
