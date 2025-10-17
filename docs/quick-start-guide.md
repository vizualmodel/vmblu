![logo](./logo/vmblu-512.png)

# Quick Start — Your First vmblu Project

> Build and run a tiny vmblu app in ~10 minutes.  
> No UI required — just three nodes wired together, then one optional LLM enhancement.

---

## Prerequisites

- Node.js **18+** (20+ recommended)
- One of:
  - **VS Code extension** for vmblu (recommended)
  - **Browser app** (Chromium-based browser)
- A writable project folder

---

## 1) Create a minimal project

```bash
mkdir vmblu-quickstart
cd vmblu-quickstart
npm init -y
npm install @vizualmodel/vmblu
npm install -D vite
````

**package.json** (replace contents)

```json
{
  "name": "vmblu-quickstart",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vizualmodel/vmblu": "^0.1.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

**index.html**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>vmblu Quick Start</title>
  </head>
  <body>
    <!-- The vmblu editor will generate ./app.js via “Make app” -->
    <script type="module" src="./app.js"></script>
  </body>
</html>
```

---

## 2) Add the model

Create **`/models/quickstart.vmblu`**:

```json
{
  "header": {
    "version": "1.0",
    "description": "Quickstart: Pinger -> Button -> Logger"
  },
  "models": [],
  "factories": [
    { "key": "_", "path": "./src" }
  ],
  "root": {
    "group": "Root",
    "pins": [],
    "nodes": [
      {
        "source": "Pinger",
        "pins": [
          { "output": "simulate click", "kind": "output", "profile": "Emits a trigger that simulates a user click." }
        ],
        "prompt": "Emits one 'simulate click' shortly after start."
      },
      {
        "source": "Button",
        "pins": [
          { "input": "simulate click", "kind": "input", "profile": "Input that simulates a user click." },
          { "output": "click", "kind": "output", "profile": "Emitted when a click happens." }
        ],
        "prompt": "Turns a 'simulate click' input into a 'click' output."
      },
      {
        "source": "Logger",
        "pins": [
          { "input": "log click", "kind": "input", "profile": "Logs a click event to the console." }
        ],
        "prompt": "Logs received click events."
      }
    ],
    "routes": [
      { "pin_": "simulate click@Pinger", "_pin": "simulate click@Button" },
      { "pin_": "click@Button", "_pin": "log click@Logger" }
    ],
    "prompt": "Self-running quickstart: Pinger -> Button -> Logger."
  }
}
```

> **Why `factories: [{ "key": "_", "path": "./src" }]`?**
> By convention, `_` points to `./src/index.js`, which re-exports your node factory functions.

---

## 3) Add node sources

Create **`/src/index.js`** (re-export factories)

```js
export { PingerFactory } from './pinger.js';
export { ButtonFactory } from './button.js';
export { LoggerFactory } from './logger.js';
```

Create **`/src/pinger.js`**

```js
/** A tiny node that sends one 'simulate click' after startup. */
export function Pinger(tx, sx) {
  // Emit after a short delay so other nodes are created and wired.
  setTimeout(() => {
    tx.send('simulate click', { source: 'pinger', at: Date.now() });
  }, 150);

  // No inputs/handlers required.
  return {};
}
export const PingerFactory = Pinger;
```

Create **`/src/button.js`**

```js
/**
 * Turns an incoming 'simulate click' into a 'click' message.
 */
export function Button(tx, sx) {
  return {
    /**
     * @prompt Simulate a user click and emit a 'click' message.
     * @node Button
     * @param {Object} [data]
     * @param {string} [data.source] - Who triggered the simulation.
     * @mcp
     */
    onSimulateClick(data = {}) {
      tx.send('click', { ...data, kind: 'click', at: Date.now() });
    }
  };
}
export const ButtonFactory = Button;
```

Create **`/src/logger.js`**

```js
/**
 * Logs click events.
 */
export function Logger(tx, sx) {
  return {
    /**
     * @prompt Log a click event to the console.
     * @node Logger
     * @param {Object} evt
     * @param {string} [evt.source] - Origin of the event.
     * @param {number} evt.at - Timestamp (ms).
     * @param {string} [evt.kind] - Event type.
     * @mcp
     */
    onLogClick(evt) {
      console.log('[Logger] click:', evt);
    }
  };
}
export const LoggerFactory = Logger;
```

---

## 4) Open the model in the vmblu editor

* **VS Code:** open the folder → open `models/quickstart.vmblu` → the vmblu editor view appears.
* **Browser app:** open the folder → open `models/quickstart.vmblu`.

Check in the model header menu that **factories** path resolves to `./src/index.js`.

---

## 5) Generate the app

Click **Make app** in the editor. This generates **`./app.js`** at project root:

* Imports your factories from `./src/index.js`
* Builds the node list and any routers
* Calls the runtime:

  ```js
  import * as VMBLU from '@vizualmodel/vmblu';
  const runtime = VMBLU.scaffold(nodeList, routerList);
  runtime.start();
  ```

---

## 6) Run & verify

```bash
npm run dev
```

Open the local server (Vite prints the URL).
Open **DevTools → Console** — you should see something like:

```
[Logger] click: { source: 'pinger', at: 173..., kind: 'click' }
```

If nothing appears, see **Troubleshooting** below.

---

## 7) (Optional) Ask an LLM to extend it

Copy this prompt along with your current `button.js`:

```
I’m using vmblu. Here is the Button node code.
Add a 300ms debounce so multiple 'simulate click' inputs within 300ms result in only one 'click' output.
Keep pin names unchanged. Use @node and @prompt JSDoc tags. Return just the updated button.js.
```

Re-run steps **5–6** (Make app → dev server) to see the change.

---

## What’s next?

* **User Guide:** concepts, editor usage, tx API, and patterns
* **AI Collaboration:** prompt patterns, guardrails, MCP tools
* **Examples:** more sample projects (UI button, bus/cable/router)

---

## Troubleshooting (fast answers)

* **“NO HANDLERS”** — Your factory returned `{}` or nothing; return an object with handlers.
* **“NO HANDLER”** — Input pin exists but no `onX`. Mapping: `"set canvas size"` → `onSetCanvasSize`.
* **“NO OUTPUT PIN”** — Called `tx.send('name')` but no output pin named `name` exists.
* **Profiles empty** — Add `@node <node name>`; keep `tx.send('…')` **literal** (don’t alias the string).
* **Linked node stale** — Use **Accept changes** or **Sync model** in the editor.

---

## File tree recap

```
vmblu-quickstart/
├─ index.html
├─ package.json
├─ app.js                # generated by vmblu → Make app
├─ models/
│  └─ quickstart.vmblu
└─ src/
   ├─ index.js
   ├─ button.js
   ├─ logger.js
   └─ pinger.js
```

> Tip: If you change the model, click **Make app** again to regenerate `app.js`.

```
