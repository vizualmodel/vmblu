# Prompt Repository Dirty-Save Task

## Problem

vmblu hydrates external prompt repositories into the in-memory model when a
model is opened. A later model save serializes and writes every prompt
repository, even if its prompt was never edited in vmblu. If another tool or
agent changed a prompt file after hydration, an unrelated model save can write
the stale in-memory text over that external change. Whether the prompt editor
tab is open is irrelevant because the prompt text belongs to the loaded node.

The relevant shared-core paths currently include:

- `core/types/model/blueprint-prompt.js`
  - `hydratePromptRepos`
  - `preparePromptReposForSave`
  - `savePromptRepos`
- `core/types/model/blueprint-raw.js`
  - `saveRaw`
- `core/types/node/prompt-repo.js`
- `core/nodes/model-manager/redox-node.js`
  - `changeNodePrompt`
- `core/nodes/model-manager/redox-widget.js`
  - `changePinPrompt`
- `core/tests/prompt-repository.test.js`

Both the browser playground and the VS Code extension use this core code. Fix
the shared behavior rather than adding independent UI-specific workarounds.

## Required behavior

1. Hydrating an existing prompt repository leaves it clean.
2. Changing any node prompt section in vmblu marks that node's prompt
   repository dirty, but only when the value actually changes.
3. Changing a pin prompt marks its owning node's prompt repository dirty, but
   only when the value actually changes.
4. Undo and redo must not allow changed prompt content to be treated as clean.
   Remaining conservatively dirty after an undo is acceptable.
5. A newly created prompt repository containing inline prompt text is dirty so
   it is written on its first save.
6. Saving the model may serialize references to all prompt repositories, but it
   writes only dirty prompt files.
7. A successful prompt-file write clears that repository's dirty state. A
   failed write reports the failure and leaves it dirty so it can be retried.
8. Saving `.mod.blu` or `.mod.viz` changes must never touch a clean prompt
   repository.
9. Dirty state is runtime/editor state. It must not appear in the persisted
   `promptRepo` object in `.mod.blu`.

## Important implementation constraint

Trace the complete edit, encode, `setRaw`, and `saveRaw` path before choosing
where the dirty flag lives. Node encoding currently turns `PromptRepo` into a
raw reference, so a flag added only to the live `PromptRepo` instance may be
lost before `preparePromptReposForSave` runs. Carry or query the transient state
through the save operation deliberately, without serializing it into the model
file.

Prefer one small helper for marking a node's prompt repository dirty, used by
both node-section and pin-prompt edits. Do not infer dirtiness merely because a
prompt contains text.

Make prompt saving awaitable. Do not silently swallow prompt write failures,
and do not clear dirty state until the corresponding write succeeds.

## Tests

Add focused regression tests proving at least:

- Loading and saving a model without prompt edits performs no prompt writes.
- An unrelated semantic or visual model edit does not write clean prompt
  repositories.
- Editing a node Prompt, Status, Decisions, or Open section writes only that
  node's repository.
- Editing a pin prompt writes its owning node's repository.
- Submitting an unchanged value does not mark the repository dirty.
- A new repository is written on first save.
- Successful saving clears dirty state; failed saving retains it.
- With two prompt repositories, editing one never writes the other.
- An externally changed clean prompt file remains untouched by a later model
  save.

Retain the existing parsing, structured-section, serialization, and legacy
prompt compatibility tests.

## Out of scope

- Loading prompts only when their editor is opened.
- Automatically merging concurrent edits.
- Adding file watchers to the prompt editor.
- Changing the prompt markdown format or semantic-model schema.

A later improvement may record the file stamp at hydration and reject a dirty
write if the file changed externally. Dirty-only saving is the required fix for
the current loss-of-update defect; stamp-based conflict handling may be added
only if it remains a small, separately tested extension.

## Completion criteria

- The regression tests pass in `core`.
- Existing core tests continue to pass.
- The browser playground and VS Code extension are confirmed to use the shared
  corrected save path.
- No generated application, profile, distribution, or extension bundle is
  committed unless explicitly requested.
- The final report lists changed files, tests run, and any remaining conflict
  scenario not covered by dirty-only saving.
