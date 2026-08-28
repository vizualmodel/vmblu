![vmblu header](https://raw.githubusercontent.com/vizualmodel/vmblu/main/vscodex/assets/vmblu-header.png)

Modern LLMs make it easy to “vibe code.” But as your application grows, features break, code bloat creeps in, and the big picture fades. It becomes difficult to understand exactly what is happening in a non-trivial application.

**vmblu** makes your architecture structured, visual, and AI-native. With vmblu, you can co-write your project with an LLM while keeping the architecture clear, the codebase maintainable, and the system navigable.

## What is vmblu?

**vmblu** is a format specification and toolset for building trusted, maintainable software with AI. It makes your software architecture explicit and easier for humans and LLMs to navigate and understand. With vmblu, architecture comes first.

vmblu is:

- **AI-native** — LLMs can design the architecture, write the code, and interact with the running system.
- A **visual modeler** — make your architecture explicit and navigable.
- A **runnable scaffold** — vmblu nodes communicate through messages, with the runtime handling message routing between nodes.
- **Agent-ready** — expose selected application behavior through explicit capabilities, policy checks, and approvals.
- **Framework-agnostic** — use any stack or package, from JavaScript and TypeScript to Svelte or Three.js.

The **vmblu model** is not a diagram maintained separately from the code. It is the architectural source of truth used to generate and run the application. The graphical editor helps you understand and evolve that architecture, while the agent runtime provides controlled entry points for external agents.

## The VS Code extension

The extension registers a visual editor for `*.blu` files. Use it to:

- Open a project through its root `*.blu` entrypoint or open a model file directly.
- Navigate and edit the nodes, pins, routes, and groups that make up the application.
- Move between the architecture and its source files without losing the system-level view.
- Open `*.sys.blu` files in vmblu System to edit applications, endpoints, and transport connections across a complete system.

The application editor and vmblu System are separate webview applications inside one extension. Projects can use vmblu without adding a system document; when system context is useful, the conventional active configuration is `system/active.sys.blu`.

## vmblu is for developers

- **vmblu** is for developers whose role is changing with the arrival of powerful AI.
- **vmblu** is designed for real, complex systems and provides a strong foundation for agentic applications.
- **Message-based architecture** gives components explicit boundaries and makes system behavior easier to understand, test, and control.

## Quick start

1. Install the [vmblu VS Code extension](https://marketplace.visualstudio.com/items?itemName=vizualmodel.vmblu).
2. Create a project and install its dependencies:

    ```bash
    npx @vizualmodel/vmblu-cli init my-app
    cd my-app
    npm install
    ```

3. Open the project folder in VS Code, then open `my-app.blu` to launch the visual editor.

To add vmblu guidance for a supported coding agent, list the available integrations and install the one you use. For example:

```bash
npx @vizualmodel/vmblu-cli agent list
npx @vizualmodel/vmblu-cli agent install codex
```

For an existing project that was not created with `vmblu init`, install the runtime and CLI locally:

```bash
npm install @vizualmodel/vmblu-runtime
npm install --save-dev @vizualmodel/vmblu-cli
```

## Requirements

- VS Code 1.74 or later for the extension.
- Node.js 18 or later for the CLI and runtime.

## Learn more and contribute

- Read the documentation at [vmblu.dev](https://vmblu.dev).
- Browse the source and contribute on [GitHub](https://github.com/vizualmodel/vmblu).
- Report problems or suggest improvements in [GitHub Issues](https://github.com/vizualmodel/vmblu/issues).

## Open source

**vmblu** is licensed under the [Apache License 2.0](./LICENSE.txt).

## Screenshot

![vmblu screenshot](https://raw.githubusercontent.com/vizualmodel/vmblu/main/vscodex/assets/vmblu-screenshot.png)

---

<p align="center">
  <strong>vmblu</strong><br>
  <span>clarity at scale</span>
</p>
