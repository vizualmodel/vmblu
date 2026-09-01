# vmblu agent integration handoff

Status: current baseline in vmblu 1.12

The original prototype handoff has been superseded by the implemented
capability, profile, interface, broker, and MCP architecture.

## Current architecture

```text
capabilities derived from the model
  -> profile allow lists
  -> embedded, MCP, or projection interface with a fixed profile
  -> ToolBroker
  -> vmblu runtime messages, probes, and events
```

Implemented components include:

- contract-derived tool input, tool output, and event payload schemas;
- structured Tool, Event, Verification, Profiles, and Interfaces editors;
- stable capability IDs and generated capability manifests;
- fail-closed profile authorization and per-profile event isolation;
- embedded browser and Node agent runtimes;
- MCP stdio and OAuth-protected MCP Streamable HTTP hosting;
- static HTTP and provider-specific projections;
- approval records with policy binding, expiry, and single-use resolution;
- distinct accepted, completed, verified, unverified, denied, and failed
  outcomes;
- versioned agent and capability schemas, provenance, generation, verification,
  and runtime/CLI tests.

See [the agent integration guide](agent-user-guide.md) for current usage and
[the deferred backlog](../../agent-integration-improvements.md) for remaining
implementation work and completion criteria.

The older `agent-prompt.md` and `agent-discussion.md` files are historical
design records. They explain how the architecture was reached, but they do not
describe current implementation status.
