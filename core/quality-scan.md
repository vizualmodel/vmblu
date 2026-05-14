# Core Quality Scan

Date: 2026-05-07

Scope: `core/` source files, excluding `node_modules` and `package-lock.json`. I reviewed 143 tracked core files, including about 21.7k lines of JavaScript source. No implementation files were changed.

Note: the repository root does not contain `.vmblu/vmblu.prompt.md`, so the vmblu project-specific prompt could not be read.

## Executive Summary

`core` has a coherent module layout and a clear domain split between ARL/resource access, model compilation, node graph behavior, view handling, widgets, and generated model artifacts. The code is readable enough to follow and most modules are small or moderately sized.

The main publication risks are not broad architectural failure, but a handful of concrete defects and missing quality gates:

- Some files contain typo-level runtime errors that will only fail on uncommon branches.
- The AI/MCP core modules currently cannot be imported in a clean install because required packages/files are missing from `core/package.json`.
- The package build script is not a valid release verification command for `core` right now.
- Save paths frequently fire asynchronous writes without awaiting or propagating errors.
- There is a lot of diagnostic `console.*` output in library/runtime paths, including leftover debug output.
- The test story for `core` appears effectively absent.

## Checks Run

- `npx.cmd eslint core`
  - Result: passed with no output.
- `npm.cmd run build` from `core/`
  - Result: failed because Vite could not resolve `index.html`.
  - This looks like a package/script issue rather than a source compile failure.
- `npm.cmd run lint` from repository root
  - Result: failed outside `core`, in generated/out files under `ui-svelte` and `vscodex`.
- `node --check core/types/ai/mcp-client.js`
  - Result: syntax OK.
- `node --check core/types/ai/mcp-server.js`
  - Result: syntax OK.
- `node --input-type=module -e "await import('./core/types/ai/mcp-client.js')"`
  - Result: failed with `ERR_MODULE_NOT_FOUND` for `@modelcontextprotocol/sdk`.
- `node --input-type=module -e "await import('./core/types/ai/mcp-server.js')"`
  - Result: failed with `ERR_MODULE_NOT_FOUND` for `@modelcontextprotocol/sdk`.

## Findings

### High: AI/MCP modules are not publishable from `core`

Files:

- `core/types/ai/mcp-client.js:1`
- `core/types/ai/mcp-client.js:2`
- `core/types/ai/mcp-server.js:2`
- `core/package.json`

`mcp-client.js` and `mcp-server.js` import `@modelcontextprotocol/sdk`, but `core/package.json` only declares `@vizualmodel/vmblu-runtime`, `@vizualmodel/vmblu-cli`, `typescript`, and `vite`. Importing either module directly fails with `ERR_MODULE_NOT_FOUND`.

`mcp-client.js` also imports `./llm-interface.svelte`, but no such file appears under `core/types/ai`. That means the missing SDK is probably only the first import failure.

Impact: any consumer that imports these modules from the published core package will fail before application code runs.

Recommendation: either add and verify the missing dependencies/assets, move AI/MCP experiments outside the publishable core surface, or clearly exclude these files from the published package/export map until they are production-ready.

### High: Several typo-level runtime errors hide in rare branches

Files:

- `core/types/model/uid-generator.js:35`
- `core/types/node/route-rxtx.js:380`
- `core/types/node/route-rxtx.js:395`

`console.eror` and `console.warning` are not standard console methods. These branches are error/reporting paths, so they are easy to miss during normal use, but when reached they throw a new exception while handling an exceptional state.

Impact: collision exhaustion in UID generation and missing route table records can turn from recoverable diagnostics into secondary runtime failures.

Recommendation: fix these directly, then consider a lint rule or type-checking pass that catches unknown properties on globals.

### High: `core` build script is not a valid quality gate

File:

- `core/package.json`

`npm.cmd run build` runs `vite build`, but `core` has no `index.html`, so Vite fails with:

`Could not resolve entry module "index.html".`

Impact: before publishing, there is no package-level build command that proves core can be bundled, imported, or emitted as a library.

Recommendation: decide whether `core` is a Vite app, a library package, or generated source only. If it is a library, replace the script with a library build or an import smoke test. If it is not meant to build independently, remove or rename the script so release verification is explicit.

### Medium: Node ARL has browser-URL assumptions

File:

- `core/types/arl/arl-node.js:37-44`

`ARL` in `arl-node.js` stores `this.url` as a string path, but `sameDir()` reads `this.url.href` and `arl.url.href`. For string paths, `.href` is undefined, so `sameDir()` will throw if called with normal node ARLs.

Impact: path comparison behavior diverges between browser ARL and node ARL implementations.

Recommendation: add unit tests for the shared ARL contract across `arl.js`, `arl-node.js`, and `arl-local.js`, especially `resolve`, `relativeTo`, `sameDir`, `equals`, `getFullPath`, and empty/missing resources.

### Medium: Save flows often ignore async completion and failures

Files:

- `core/types/model/blueprint-raw.js:111-123`
- `core/types/model/blueprint-app.js:64`
- `core/types/model/blueprint-app.js:151`
- `core/types/model/blueprint-app.js:156`
- `core/types/model/blueprint-app.js:498`
- `core/types/model/blueprint-cap.js:52`
- `core/types/model/blueprint-lib.js:31`
- `core/nodes/model-manager/model-manager.js:434`

Several save calls are made without `await` and without returning `Promise.all(...)`. In `saveRaw()`, both `.blu` and `.viz` saves are started and then the function returns immediately.

Impact: callers can report success or continue with stale state while writes are still pending. Failed writes may become unhandled or invisible depending on environment.

Recommendation: make save methods consistently async, await writes, and return a clear success/failure result to UI and model-manager callers.

### Medium: `mcp-client.js` appears internally inconsistent

File:

- `core/types/ai/mcp-client.js`

Examples:

- `send()` uses `tx.send(...)` at line 44 instead of `this.tx.send(...)`.
- `onReceive()` assigns `mcpCallback = callback` at line 51, but the instance field is `this.callback`.
- `start()` uses `this.transport` at line 82, but the constructor stores `this.tx`.
- `newUserPrompt()` calls `this.addUserMessage(...)` at line 101, but no such method is defined in the class.
- `const mcpClient = new LLMInterface(...)` at line 21 is unused.

Impact: even if dependencies are added, this class is unlikely to work as written.

Recommendation: either remove this older direct-browser OpenAI client in favor of `mcp-client-in-browser.js`, or bring it under tests and align the transport/chat API.

### Medium: Generated/imported package boundaries are unclear

Files:

- `core/types/node/node.js:10`
- `core/nodes/model-manager/redox-node.js:1`
- `core/types/ai/*`
- `core/model/core.app.js`

`core` reaches into `../runtime` via relative imports and also depends on generated model/app files. That may be fine in the monorepo, but it is fragile for publication unless package exports and install layout are explicit.

Impact: consumers may import a module whose relative runtime dependency does not exist in the published package layout.

Recommendation: define the intended public entry points and package export map before publishing. Verify those entry points from a temporary clean project, not only from the monorepo.

### Low: Leftover debug logging is present in library paths

Examples:

- `core/types/model/blueprint-raw.js:366`
- `core/types/model/blueprint-raw.js:385`
- `core/types/model/blueprint.js:182`
- `core/types/view/view-keyboard.js:13`
- `core/types/arl/arl.js:106`
- `core/types/arl/arl-node.js:116`

There are many `console.log`, `console.warn`, and `console.error` calls in core. Some are useful diagnostics, but several look like temporary debugging.

Impact: publication consumers may see noisy console output during normal workflows, and some logs leak internal model state.

Recommendation: replace intentional diagnostics with a small logger/debug flag, and remove temporary logs.

### Low: Dead/experimental code remains in source

Examples:

- `core/types/arl/arl-local.js:188` contains `xxxget(...)`, an apparent old implementation retained beside `get(...)`.
- `core/types/ai/mcp-server.js:43-72` contains solar-system-specific example MCP tools.
- `core/types/ai/mcp-server.js:75-86` logs calls but returns no result.

Impact: dead code makes it harder to distinguish product surface from experiments and can accidentally become public API after publishing.

Recommendation: move experiments to examples or docs, and keep core focused on framework primitives.

### Low: Encoding corruption appears in comments

File:

- `core/types/ai/mcp-server.js:76-77`

The comments contain mojibake in place of an apostrophe and arrow symbol.

Impact: low runtime risk, but it signals file encoding churn and looks unpolished in published source.

Recommendation: normalize source files to UTF-8 and keep comments ASCII unless needed.

## Strengths

- The codebase has a strong domain-oriented split: `types/model`, `types/node`, `types/view`, `types/widget`, `types/arl`, and node managers are easy to navigate.
- The raw/viz split in model handling is explicit and centralized.
- The custom JSON parser with duplicate-key warnings is a good publication-quality feature for model files.
- `npx.cmd eslint core` currently passes, so the core files meet the existing lint baseline.
- The ARL abstraction is a useful portability layer across browser, local file system, and Node contexts.

## Test And Release Gaps

I did not find a dedicated core test command. Before publishing, the highest-value tests would be:

- ARL contract tests for browser-like, local, and Node ARLs.
- Model load/save round-trip tests for `.blu` plus `.viz`.
- Entry-point resolution tests for `kind: "vmblu.entrypoint"`.
- Route connect/disconnect tests that cover pin, pad, bus, tack, proxy, and missing-table branches.
- Import smoke tests for every intended public module.
- A clean-project install test that imports the published package entry points.

## Suggested First Fix Order

1. Decide the publishable surface of `core` and exclude or repair AI/MCP modules.

Core is not a standalone application, it is the core library for the playground browser editor and the vscode extension editor
You can remove the the AI/MCP modules. Agent interfacing is done differently now.

2. Fix typo-level runtime errors: `console.eror` and `console.warning`.

Agreed, please fix

3. Replace the current `core` build script with a real package verification command.

Agreed.

4. Make save paths awaitable and error-aware.

Agree, but do not use 'await' but use .catch() to inform the user with a console message. Save errors will be very rare.

5. Add smoke tests around public imports and ARL/model round trips.

Agreed. Create a /core/tests folder and add these tests.

6. Remove temporary debug logs and experimental/example code from core.

Place a comment marker '//DEV ONLY' before the debug logs and experimental/example code you have found, I will check.
