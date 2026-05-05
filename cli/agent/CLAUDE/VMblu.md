# vmblu Project Workflow

When working in a vmblu project:

- Read `.vmblu/vmblu.prompt.md` if it exists.
- Use the root `*.blu` entrypoint to find the model.
- Treat `model/` as the application model file set.
- Treat `nodes/` as model-owned implementation code.
- Use `vmblu make-app <entrypoint>.blu`, `vmblu make-capabilities <entrypoint>.blu`, and related CLI commands for generated artifacts.
- Do not assume copied schemas or general docs in `.vmblu/` are canonical.
- Before editing a blueprint (`*.mod.blu`), read `context/<schema-version>/blu.schema.json` and `context/<schema-version>/blu.annex.md` from this installed vmblu support folder.
- Before editing or validating `*.mod.viz`, `*.src.prf`, or `*.cap.json`, read the matching schema in `context/<schema-version>/`.
- Use the version declared by the root entrypoint or model header. If that version is not installed, use the latest installed context version and report the mismatch.

vmblu capabilities are the common model for agent interaction. MCP and provider
tools should be treated as adapters over the vmblu capability manifest and
runtime broker.
