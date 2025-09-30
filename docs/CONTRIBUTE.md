# Vizual Model Blueprint

![logo](./logo/logo-256.png)

# Contributing to vmblu

Thank you for your interest in contributing to **vmblu** 🎉  
We welcome contributions from developers, designers, testers, and anyone excited about making **architecture explicit, visual, and AI-native** — the future of software development.

## 🟦 How to Contribute

There are many ways to get involved:

- **Report bugs** and request features via [GitHub Issues](https://github.com/vizualmodel/vmblu/issues).  
- **Improve documentation** (README, schema specs, guides). Clear docs are essential for new users and for LLMs.  
- **Contribute code**: fix bugs, add features, improve performance.  
- **Extend standard nodes/libraries** by adding reusable building blocks.  
- **Test** the runtime and editor and share feedback on usability and edge cases.  

## 🟦 Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/vizualmodel/vmblu.git
   cd vmblu
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

You can now build **vmblu** either as a browser app or as a VS Code extension.
**vmblu** shines as a VS Code extension, but debugging is usually easier in the browser version.
Since both share the same codebase, starting with the browser build is recommended.

3. **Run the editor (browser build)**

   ```bash
   npm run br
   ```

4. **Build the VS Code extension**

   ```bash
   npm run vx
   ```

   To install locally in VS Code:

   * Open the **Extensions** view
   * Click **…** (More Actions) → *Install from VSIX*
   * Select `vmblu-x.y.z.vsix` in the `/vscodex` directory
   * Restart VS Code

5. **Run tests**

   ```bash
   npm run test
   ```

   Tests are grouped into **unit**, **integration**, and **e2e** under `/browser/tests`.

## 🟦 Guidelines

To ensure smooth collaboration and high-quality contributions, please follow these guidelines:

* **Follow the Code Style**
  Run `npm run lint` and `npm run format` before committing. This ensures consistent style using ESLint and Prettier.

* **Write Clear Commit Messages**
  Use descriptive commit messages such as:

  * `feat: add new feature`
  * `fix: correct typo`
    This makes it easier to track changes and maintain a clean history.

* **Keep Pull Requests Focused**
  A PR should address one issue or feature. Avoid bundling unrelated changes. This makes reviews faster and clearer.

* **Add Tests for New Functionality**
  If you add a feature or fix a bug, include tests to prevent regressions. Run `npm run test` before opening a PR.

* **Document Your Changes**
  Update relevant documentation (README, schema, guides) when you change functionality.

## 🟦 Communication

* **Ask Questions**
  Open a GitHub issue with the `question` label. This keeps discussions public and searchable.

* **Discuss New Features**
  For major features or architectural changes, open an issue before coding. This avoids duplicated work and keeps everyone aligned.

* **Be Respectful**
  We expect constructive and respectful communication. Our goal is a positive, welcoming environment.
  *(We follow the [Contributor Covenant](https://www.contributor-covenant.org/) as our Code of Conduct.)*

## 🟦 Contribution Process

1. **Fork & clone** the repository.
2. **Create a branch** for your feature or fix (e.g. `fix/runtime-queue-bug`).
3. **Make changes** and commit with clear messages.
4. **Push your branch** to your fork and open a **Pull Request (PR)**.

   * Describe *what* you changed and *why*.
   * Link related issues if applicable.
5. **Review**: Maintainers will review your PR and may request changes.
6. **Merge**: If accepted, a maintainer will merge your PR.

   * PRs may be rebased or squashed for a clean history.
   * Merging does **not** mean an immediate release. Releases are published separately.

## 🟦 License

All contributions are licensed under the [Apache License 2.0](./LICENSE).
By submitting code, you agree to this license.
