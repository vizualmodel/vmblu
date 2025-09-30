Here’s the exact install process for **Vitest** in your `/browser` folder (since that’s where you’re putting your tests):

---

### 1️⃣ Install the dependencies

Run this inside `/browser`:
The first option is for when you use typescript
```bash
npm install -D vitest @vitest/ui @types/node 
npm install -D vitest @vitest/ui

```

* `vitest` → the test runner itself
* `@vitest/ui` → optional, gives you a local browser dashboard (`npm run test:ui`)
* `@types/node` → type definitions if you’re writing tests in TypeScript

---

### 2️⃣ Add scripts to `package.json` (in `/browser`)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

* `npm test` → run all tests once (for CI)
* `npm run test:watch` → keep running as you edit files
* `npm run test:ui` → open Vitest dashboard in the browser

---

### 3️⃣ Add a config file (optional but useful)

Create `/browser/vitest.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,       // so you don’t need to import test/expect everywhere
    environment: "node", // "jsdom" if you need a browser-like DOM
    include: ["tests/**/*.{test,spec}.{ts,js}"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
```

---

### 4️⃣ Create your first test

Make a file `/browser/tests/unit/sanity.spec.ts`:

```ts
import { test, expect } from "vitest";

test("sanity check", () => {
  expect(1 + 2).toBe(3);
});
```

---

### 5️⃣ Run it 🎉

```bash
npm test
```

You should see:

```
✓ sanity.spec.ts (1)
  ✓ sanity check (3ms)

Test Files  1 passed (1)
     Tests  1 passed (1)
```

---

👉 After this works, you can start adding **editor API tests** (`editor.doEdit(...)`) step by step.

Do you want me to show you how to write your **first real test for `editor.doEdit('padCreate', …)`**, so you immediately test part of the editor instead of just math?



```js
// tests/unit/editor/editor-basic.spec.ts
import { describe, test, expect, beforeEach } from "vitest";
import { createEditor } from "../../../src/editor/testing/createEditor"; // helper that returns a fresh EditorModel per test

/**
 * Test 1 — Add → Connect → Serialize (stable)
 * Ensures: nodes & route appear; serialization is stable (great for golden snapshots)
 */
describe("EditorModel: add/connect/serialize", () => {
  let ed: ReturnType<typeof createEditor>;

  beforeEach(() => {
    ed = createEditor(); // empty model
  });

  test("adds two nodes, connects pins, stable serialization", () => {
    ed.addNode({
      id: "A",
      name: "NodeA",
      pins: [{ output: "out", kind: "output" }],
      pos: { x: 100, y: 100 }
    });
    ed.addNode({
      id: "B",
      name: "NodeB",
      pins: [{ input: "in", kind: "input" }],
      pos: { x: 400, y: 100 }
    });

    ed.connect("out@A", "in@B");

    const json = ed.serialize(); // string or object—if object, JSON.stringify with sorted keys in helper
    // Inline snapshot is fine to start; later switch to a golden file snapshot if you prefer
    expect(json).toMatchInlineSnapshot(`
"{
  \\"nodes\\": [
    {\\"id\\":\\"A\\",\\"name\\":\\"NodeA\\",\\"pins\\":[{\\"output\\":\\"out\\",\\"kind\\":\\"output\\"}],\\"pos\\":{\\"x\\":100,\\"y\\":100}},
    {\\"id\\":\\"B\\",\\"name\\":\\"NodeB\\",\\"pins\\":[{\\"input\\":\\"in\\",\\"kind\\":\\"input\\"}],\\"pos\\":{\\"x\\":400,\\"y\\":100}}
  ],
  \\"routes\\": [
    {\\"pin_\\":\\"out@A\\",\\"_pin\\":\\"in@B\\"}
  ]
}"
`);
  });
});
```

