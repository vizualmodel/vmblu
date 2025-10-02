
# Contributing to vmblu

Thank you for your interest in contributing to **vmblu** 🎉  
We welcome contributions from developers, designers, testers, and anyone excited about making **architecture explicit, visual, and AI-native**.

---

## 🟦 Branching & Workflow

- The default branch is **`main`**.
- **Small fixes** (docs, typos, minor tweaks) may be committed directly to `main`.
- **Features and bugfixes** must use a **feature branch**:
  - Branch name convention:  
    - `feature/<short-name>` for new features  
    - `bugfix/<short-name>` for fixes  
  - Example: `feature/camera-system`, `bugfix/route-connection`
- Open a **Pull Request (PR)** from your branch into `main`.

---

## 🟦 Rebasing vs Merging

- **Solo branch**: keep up to date with `main` using `git rebase origin/main`.
- **Shared branch** (multiple contributors): use `git merge origin/main` to avoid rewriting history.
- **Merging into main**:
  - Prefer **Squash & Merge** (one commit per feature).
  - If detailed history is valuable, a normal **Merge commit** is acceptable.

---

## 🟦 Commit Guidelines

- Use short, imperative commit messages:  
  - ✅ `Add CameraSystem node`  
  - ❌ `Added CameraSystem node` or `I worked on cameras`
- Group related changes into one commit.
- Reference issues/PRs in commit or PR descriptions when applicable.

---

## 🟦 Large Files

- Do not commit files >100 MB (GitHub limit).  
- Either:  
  - Add them to `.gitignore`, or  
  - Use **Git LFS** if the file is required in the repo.

---

## 🟦 Code Style

- Follow the conventions of existing code.  
- Prefer clear, consistent naming.  
- For JSON (`.vmblu` files), keep indentation at 4 spaces.  
- For JavaScript/TypeScript, use JSDoc for documenting pins and handlers.

---

## 🟦 Getting Started

1. Clone the repo:  
   ```bash
   git clone https://github.com/vizualmodel/vmblu.git
   cd vmblu
````

2. Install dependencies:

   ```bash
   npm install
   ```
3. Run the browser version:

   ```bash
   npm run br
   ```
4. Run the VS Code extension build:

   ```bash
   npm run vsix
   ```

---

## 🟦 Discussions & Decisions

* Major changes to workflow (branching, merging, release process) should be agreed on by the team.
* Please open an **issue** or start a **discussion** on GitHub if you propose changes.

---

By following this workflow, we keep the history clean, collaboration smooth, and contributions easy to review.
Thanks for helping make **vmblu** better 🚀

```
