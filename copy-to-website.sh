#!/usr/bin/env bash
set -euo pipefail

# vscodex
DEST="../vmblu.dev/docs/public/examples/vscode-extension/"
cp ./core/types/ai/ai{.mod.blu,.mod.viz,.src.prf} $DEST
cp ./core/core{.mod.blu,.mod.viz,.src.prf} $DEST
cp ./ui-svelte/ui-svelte{.mod.blu,.mod.viz,.src.prf} $DEST
cp ./vscodex/webview/webview{.mod.blu,.mod.viz,.src.prf} $DEST

# playground
DEST="../vmblu.dev/docs/public/examples/vscode-extension/"
cp ./playground/playground{.mod.blu,.mod.viz,.src.prf} $DEST
cp ./playground/nodes/launcher/app-launcher{.mod.blu,.mod.viz,.src.prf} $DEST

# copy the bundle
DEST="../vmblu.dev/docs/public/playground/"
cp ./playground/out/*.* $DEST

# copy the chat application
DEST="../vmblu.dev/docs/public/examples/chat-application/"
cp ./examples/chat-application/chat-client/chat-client{.mod.blu,.mod.viz,.src.prf} $DEST
cp ./examples/chat-application/chat-server/chat-server{.mod.blu,.mod.viz,.src.prf} $DEST

# copy the solar system application + bundle
DEST="../vmblu.dev/docs/public/examples/solar-system/"
cp ./examples/solar-system/solar-system{.mod.blu,.mod.viz,.src.prf,.mcp.js} $DEST
cp ./examples/solar-system/out/solar-system.app-bundle.js $DEST
cp ./examples/solar-system/out/website-index.html $DEST/index.html
cp ./examples/solar-system/out/assets/*.* $DEST/assets