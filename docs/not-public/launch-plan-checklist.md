# vmblu Open Source Launch Plan

This checklist outlines the key steps for releasing vmblu as an open source project, publishing the VS Code extension, and creating visibility through a website and case studies.

---

## 1. Repository Preparation
- [ ] Create a **public GitHub repo** under `vizualmodel` org.
- [ ] Add a clear **README.md**:
  - What is vmblu?
  - Quickstart example
  - Screenshot of the editor
  - Links (docs, schema, marketplace)
- [ ] Add a **LICENSE** (MIT or Apache 2.0).
- [ ] Add a **CONTRIBUTING.md** (how to set up, coding style, PR guidelines).
- [ ] Add an **examples/** folder:
  - Chat app case study
  - Solar system simulation
- [ ] Add **docs/** folder with schema specs (0.8), annex, and guides.
- [ ] Set up basic GitHub Actions (lint/test/build).
- [ ] Create **issues** for roadmap items (first set of milestones).

---

## 2. VS Code Marketplace Release
- [ ] Finalize `package.json` metadata (name, publisher, description, icon).
- [ ] Ensure `.vscodeignore` is correct (no missing assets).
- [ ] Verify extension works cleanly in both **VS Code Desktop** and **Web (vscode.dev)**.
- [ ] Package and **publish to Marketplace**.
- [ ] Write a concise **Marketplace description** with screenshots & GIF demo.

---

## 3. Website (vmblu.dev)
- [ ] Landing page:
  - Tagline + slogan (`Clarity at scale.` or `The clarity to build. The power to scale.`)
  - One-sentence value proposition
  - Screenshot of the editor
- [ ] Sections:
  - **Quickstart** (install extension, open example, run)
  - **Docs** (link to schema & guides)
  - **Case Studies** (chat app, solar system sim)
  - **GitHub & Marketplace links**
- [ ] Add **blog section** (for release notes & updates).
- [ ] Deploy to vmblu.dev.

---

## 4. Case Studies & Examples
- [ ] **Chat App**: demonstrate node-based architecture → working code.
- [ ] **Solar System Simulation**: highlight visualization + LLM reasoning.
- [ ] Show JSON snippets (`src`/`dst` in v0.8 schema).
- [ ] Include diagrams/screenshots from the vmblu editor.

---

## 5. Announcement & Outreach
- [ ] Write a **launch blog post**:
  - Why vmblu?
  - What problem it solves
  - Case studies
  - How to get started
- [ ] Share on:
  - GitHub Discussions
  - VS Code extension release notes
  - Twitter/X, LinkedIn, Reddit (r/programming, r/vscode)
- [ ] Reach out to early adopters for feedback.

---

## 6. Post-Launch Roadmap
- [ ] Collect user feedback via GitHub issues & discussions.
- [ ] Add more **examples** (e.g. agent workflows).
- [ ] Explore **Pro features / Cloud service** vision.
- [ ] Define long-term goals (agent factory, collaboration features).

---

## Notes
- **Open Source Core**: free & transparent → drives adoption.
- **Business Layer**: could come later (Pro tools, hosted runtime, consulting).
- **Message**: vmblu is the missing layer that makes LLM-assisted software development **structured, collaborative, and maintainable**.
