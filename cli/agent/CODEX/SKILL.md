---
name: vmblu
description: Bootstrap and follow the vmblu framework workflow for new or existing vmblu application projects. Use when the user says "use vmblu", mentions the vmblu framework, or wants a project initialized with the vmblu CLI and requires reading `.vmblu/vmblu.prompt.md` before implementation.
---

# vmblu Bootstrap Workflow

Follow this workflow whenever the user wants to use the vmblu framework.

## Core rule

Do not start implementation before reading the vmblu project prompt at `.vmblu/vmblu.prompt.md` (after initialization if needed).

## Step 1: Determine target project path

Identify the project path from the user request, current workspace, or active file context.

If the target path is unclear, ask one short question and wait for the answer.

## Step 2: Initialize vmblu project (if needed)

If the target project does not appear to be initialized yet, initialize it with the vmblu CLI:

- Preferred:
  - `vmblu init <project-path>`
- Fallback if `vmblu` is not on PATH:
  - `npx @vizualmodel/vmblu-cli init "<project-path>"`

Check for initialization artifacts (especially the `.vmblu` folder) before re-running init on an existing project.

## Step 3: Read vmblu instructions

Read:

- `<project-path>/.vmblu/vmblu.prompt.md`

Treat this file as required project-specific workflow guidance.

If the file is missing, report it clearly and continue cautiously using normal engineering workflow.

## Step 4: Read project prompt/spec (if provided)

If the user points to a project prompt file (for example `application-prompt.md`), read it after `.vmblu/vmblu.prompt.md`.

Use `.vmblu/vmblu.prompt.md` as the framework/process guide and the project prompt as the product requirements/spec.

## Step 5: Work in vmblu mode

While implementing:

- Follow the vmblu prompt workflow and constraints first.
- Preserve vmblu project structure and generated files unless the user asks to change them.
- Prefer incremental changes and verify behavior after each substantial step.
- If a command or generated artifact conflicts with existing user changes, stop and ask before overwriting.

## Step 6: Report clearly

In progress updates and final output, state:

- whether init was run (and which command was used)
- whether `.vmblu/vmblu.prompt.md` was found/read
- what project prompt/spec file was used (if any)

## Notes

- When the user says only `use vmblu`, interpret that as a request to apply this workflow before coding.
- If the project is already initialized, skip init and proceed directly to reading `.vmblu/vmblu.prompt.md`.
