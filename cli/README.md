# CLI for vmblu
This folder contains the CLI commands that are available for vmblu.

## Folder layout

```txt
vmblu/
  cli/                      # your CLI source
    agent/                  # skills for an agent
      CODEX/
      CLAUDE/
    context/                # canonical agent/CLI context by schema version
      x.y.z/
        blu.schema.json
        blu.annex.md
        viz.schema.json
        prf.schema.json
        capabilities.schema.json
    bin/
      vmblu.js              # discovers and adds commands
    lib/
      resolve-entrypoint.js
    commands/
      init/
      agent/
      make-app/
      make-test/
      profile/
      migrate/
    package.json
    README.md
    LICENSE.txt
```

## Add more commands

Create commands/migrate/index.js with the same export shape { command, describe, builder, handler }. The router auto-discovers it.

## Dev/test workflow

### from vmblu/cli

```bash
npm link               # exposes "vmblu" globally
vmblu init my-app --schema 0.8.2
vmblu --help
vmblu init --help
```
### Publish & use

```bash
npm publish --access public
```
## Usage

```bash
npx @vizualmodel/vmblu-cli init my-app --schema 0.8.2
```

**or, after global install:**

```bash
vmblu init my-app
```

`vmblu init` creates the current project layout:

```txt
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

`my-app.blu` is a vmblu entrypoint manifest:

```json
{
  "kind": "vmblu.entrypoint",
  "version": 1,
  "model": "model/my-app.mod.blu"
}
```

Commands that accept a model file can use either the direct model path or the
entrypoint:

```bash
vmblu make-app model/my-app.mod.blu
vmblu make-app my-app.blu
vmblu make-capabilities my-app.blu
vmblu verify my-app.blu
```

`vmblu verify` checks the model and visualization compatibility family,
canonical factory indexes, and the provenance/source hashes of generated
profiles, applications and capability manifests. Missing generated artifacts
are reported as skipped by default; use `--require-generated` to require all
three standard outputs.

## Compatibility versions

CLI, core, runtime and schema versions use `xx.yy.zz`. The `xx.yy` pair is the
compatibility family and `zz` is an independent patch level. Components in the
same family are compatible; crossing a family boundary requires migration.
Package dependency ranges must therefore remain inside one family, for example
`>=1.10.0 <1.11.0`.

General schemas and docs are resolved from the installed CLI package. The
canonical agent-readable files live under `cli/context/<schema-version>/`.
New projects keep `.vmblu/` for local prompts, overrides, cache, logs, and
bridge configuration.

Agent support files are installed separately:

```bash
vmblu agent list
vmblu agent install codex
vmblu agent install claude
```

## Tips

* Keep `context` inside the package; installed agent support and plugins copy it from there.
* If you later prefer a richer UX, you can swap the router to commander/yargs without changing your command folders.
* If your main repo houses both runtime and CLI, publish the CLI from vmblu/cli (separate package.json). This keeps runtime installs lean.
* This gives you one tidy package for all current and future commands, with zero drift and easy discoverability.
