#!/usr/bin/env bash
set -euo pipefail

# vscodex
DEST="../vmblu.dev/docs/public/examples/vscode-extension/"
cp ./core/core.blu $DEST
cp ./core/model/core{.mod.blu,.mod.viz,.src.prf} $DEST/model
cp ./ui-svelte/ui-svelte.blu $DEST
cp ./ui-svelte/model/ui-svelte{.mod.blu,.mod.viz,.src.prf} $DEST/model
cp ./vscodex/webview/webview.blu $DEST
cp ./vscodex/webview/model/webview{.mod.blu,.mod.viz,.src.prf} $DEST/model

# playground
DEST="../vmblu.dev/docs/public/examples/vscode-extension/"
cp ./playground/playground.blu $DEST
cp ./playground/model/playground{.mod.blu,.mod.viz,.src.prf} $DEST/model
cp ./playground/nodes/launcher/model/app-launcher{.mod.blu,.mod.viz,.src.prf} $DEST/model

# copy the bundle
DEST="../vmblu.dev/docs/public/playground/"
cp ./playground/out/*.* $DEST

# copy the chat application
DEST="../vmblu.dev/docs/public/examples/chat-application/"
cp ./examples/chat-application/chat-client/chat-client.blu $DEST
cp ./examples/chat-application/chat-client/model/chat-client{.mod.blu,.mod.viz,.src.prf} $DEST/model
cp ./examples/chat-application/chat-server/chat-server.blu $DEST
cp ./examples/chat-application/chat-server/model/chat-server{.mod.blu,.mod.viz,.src.prf} $DEST/model

# copy the solar system application + bundle
DEST="../vmblu.dev/docs/public/examples/solar-system/"
cp ./examples/solar-system/solar-system.blu $DEST
cp ./examples/solar-system/model/solar-system{.mod.blu,.mod.viz,.src.prf} $DEST/model
cp ./examples/solar-system/out/solar-system.app-bundle.js $DEST
cp ./examples/solar-system/out/website-index.html $DEST/index.html
cp ./examples/solar-system/out/assets/*.* $DEST/assets
