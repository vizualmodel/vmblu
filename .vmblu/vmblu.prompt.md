# vmblu project

This folder contains several vmblu projects.
Each vmblu project has its own .vmblu folder
General vmblu instructions come from the installed vmblu skill/plugin/CLI docs.

When making changes to vmblu there are two applications that have be looked at

- vmblu/playground for the browser based version of vmblu
- vmblu/vscodex for vmblu as a vscode extension. The extension folder contains the vmblu model in the folder webview.

Both applications use the same node libraries

- vmblu/core for the main functionality of the nodes of the vmblu project
- vmblu/ui-svelte for the ui nodes

The vmblu/cli folder contains the cli commands used in the vmblu project. These commands heavily reuse the code of the core folder