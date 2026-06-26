#!/usr/bin/env bash
set -euo pipefail

EXPL="../vmblu.dev/docs/public/examples"
mkdir -p $EXPL

# vscodex
DEST=$EXPL/vscode-extension
mkdir -p $DEST/model
cp ./core/core.blu $DEST/
cp ./core/model/core{.mod.blu,.mod.viz,.src.prf} $DEST/model/
cp ./ui-svelte/ui-svelte.blu $DEST/
cp ./ui-svelte/model/ui-svelte{.mod.blu,.mod.viz,.src.prf} $DEST/model/
cp ./vscodex/webview/webview.blu $DEST/
cp ./vscodex/webview/model/webview{.mod.blu,.mod.viz,.src.prf} $DEST/model/

# playground
DEST="../vmblu.dev/docs/public/examples/vscode-extension/"
mkdir -p $DEST/model
cp ./playground/playground.blu $DEST/
cp ./playground/model/playground{.mod.blu,.mod.viz,.src.prf} $DEST/model/
cp ./playground/nodes/launcher/model/app-launcher{.mod.blu,.mod.viz,.src.prf} $DEST/model/
BUNDLE="../vmblu.dev/docs/public/playground/"
cp ./playground/out/*.* $BUNDLE/