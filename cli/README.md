# CLI for vmblu
This folder contains the CLI commands that are available for vmblu. Currently there is only the 'init' and 'help' command, but others will follow.


## Folder layout

```txt
vmblu/
  cli/                      # your CLI source
    commands/
      init/
      migrate/
    templates/
      0.8.2/
        vmblu.schema.json
        vmblu.annex.md
        seed.md
        srcdoc.schema.json
    bin/
      vmblu.js             # the executable (router)
    package.json
    README.md
```

## Add more commands

Create commands/migrate/index.js with the same export shape { command, describe, builder, handler }. The router auto-discovers it, so users can run vmblu migrate ….

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
## Tips

* Keep templates inside the package and list them in "files" so npx works offline.
* If you later prefer a richer UX, you can swap the router to commander/yargs without changing your command folders.
* If your main repo houses both runtime and CLI, publish the CLI from vmblu/cli (separate package.json). This keeps runtime installs lean.
* This gives you one tidy package for all current and future commands, with zero drift and easy discoverability.