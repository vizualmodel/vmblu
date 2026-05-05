# vmblu Codex Plugin

This folder is the source package for the vmblu Codex plugin.

It packages the same Codex support files used by:

```sh
vmblu agent install codex
```

The plugin adds vmblu workflow guidance to Codex through the `vmblu` skill and
packages the shared versioned context from `cli/context/`.

Keep the canonical Codex skill content in `cli/agent/CODEX/` and the canonical
schema/annex context in `cli/context/`, then refresh this plugin folder with:

```sh
node cli/bin/vmblu.js plugin build-codex
```

Use a custom output folder when preparing a separate distributable copy:

```sh
node cli/bin/vmblu.js plugin build-codex --out ./dist/plugins/vmblu
```
