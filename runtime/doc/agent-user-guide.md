# vmblu agent integration

This guide describes the agent integration available in vmblu 1.12.

## Architecture

Agent integration has three separate layers:

1. **Capabilities** describe application tools, probes, and events.
2. **Profiles** determine which capabilities an agent may use.
3. **Interfaces** connect an embedded or external agent to one fixed profile.

MCP and provider-specific tool formats are adapters over this model. They are
not the source of truth.

```text
embedded agent or external client
  -> interface with fixed profile
  -> ToolBroker policy and validation
  -> vmblu runtime queue, probes, and events
  -> application graph
```

## Runtime support

| Runtime | Browser | Node.js | Security | Agents |
|---|---:|---:|---:|---:|
| `@vizualmodel/vmblu-runtime/rt-base` | yes | yes | no | no |
| `@vizualmodel/vmblu-runtime/rt-browser-agent` | yes | yes | no | yes |
| `@vizualmodel/vmblu-runtime/rt-als` | no | yes | yes | no |
| `@vizualmodel/vmblu-runtime/rt-nodejs-agent` | no | yes | yes | yes |

Agent settings are application model data. They remain saved when agents are
disabled or when the selected runtime does not support them.

## Capabilities

Capabilities are explicitly exposed from the model. Existing handlers and
pins are not available to agents merely because they exist.

### Tools

An input pin may be exposed as a tool. Open its Tool settings and configure:

- Exposed;
- a stable ID;
- risk: low, medium, or high;
- approval: never or always;
- optional verification using exposed events and probes.

The input schema is derived from the pin request contract. A request/reply
pin also gets an output schema derived from its reply contract. Title and
description come from the pin name and prompt.

The saved metadata is intentionally small:

```json
{
  "tool": {
    "enabled": true,
    "id": "orders.submit",
    "risk": "medium",
    "approval": "never"
  }
}
```

Tools targeting a `ToolInvocation` pin receive
`{callId, tool, arguments}`. Other tool pins receive the validated arguments
directly.

### Events

An output pin may be exposed as an event. Its payload schema is derived from
the pin contract. Use semantic events rather than high-frequency state or
render streams.

```json
{
  "event": {
    "enabled": true,
    "id": "orders.changed"
  }
}
```

### Probes

A source node may declare read-only probes. The node implements
`probe(name, args)` and returns JSON-safe data matching the declared schema.
Agent runtimes register probes only when they are explicitly declared by the
model.

## Application settings

Open Application Settings and use the Agents row.

- **supported/unsupported** describes the selected runtime.
- **Enabled** activates configured interfaces when the runtime supports them.
- The Agents button always opens the editor, including when agents are
  disabled or unsupported.

The editor has two sections.

### Profiles

A profile contains:

- ID, title, and enabled state;
- maximum tool calls per turn;
- allow lists for tools, events, and probes.

Permissions are fail-closed: an unchecked or missing capability is denied.
Select All selects only the capabilities currently exposed; capabilities
added later are not granted automatically.

### Interfaces

Every interface selects one fixed profile. A caller cannot choose or override
that profile.

Supported interface kinds are:

- **Embedded**: an in-application agent using the configured provider, model,
  instructions, and overlay mode;
- **MCP stdio**: a Node-hosted MCP server whose launching process is the trust
  boundary;
- **MCP HTTP**: a Node-hosted MCP Streamable HTTP server using OAuth, or an
  explicitly configured loopback-only development mode;
- **HTTP projection**: a static provider projection, not a running or
  authenticated server.

Only one embedded interface starts automatically. MCP interfaces are started
explicitly by the Node host.

## Broker behavior

The broker applies the selected profile to capability discovery, tool calls,
probe reads, event waits and queries, passive event delivery, approvals, and
adapter projections.

Requests are denied when identity is missing or unknown, a profile is
disabled, a capability is unknown, or the relevant allow list does not grant
it. Events are filtered separately for each profile and do not enter another
profile's history, overlay context, query results, or trace.

Tool outcomes have distinct meanings:

- `pending`: waiting for trusted approval;
- `denied`: rejected by policy or approval;
- `accepted`: dispatched without evidence of application completion;
- `completed`: a request/reply tool returned successfully;
- `verified`: configured evidence confirmed the effect;
- `unverified`: dispatch occurred but required evidence was not observed;
- `failed`: validation, routing, runtime, or provider execution failed.

## MCP hosting

The optional `@vizualmodel/vmblu-runtime/mcp` export provides MCP stdio and
Streamable HTTP hosting on Node.js 20 or newer.

```js
import {startConfiguredVmbluMcpInterfaces} from '@vizualmodel/vmblu-runtime/mcp'

const mcp = await startConfiguredVmbluMcpInterfaces({
  runtime,
  hostOptions: {
    remote: {
      authentication: {
        verifier,
        oauthMetadata
      }
    }
  }
})

await mcp.close()
```

For OAuth HTTP, the model stores public issuer, resource-server URL, and scope
configuration. The host supplies token verification, authorization-server
metadata, and secrets. Bearer authentication is enforced before MCP requests
reach the fixed profile. Unauthenticated HTTP is restricted to an explicit
loopback listener.

MCP exposes:

- allowed application tools under their stable IDs;
- allowed probes as `probe.<id>`;
- allowed events as `event.wait.<id>`.

## Generation and verification

`vmblu make-app <entrypoint>.blu` is the normal generation command. For an
agent runtime it produces the application and capability manifest. Inline
agent settings produce a generated agent artifact; authored sidecars remain
referenced rather than being replaced.

Useful inspection and CI commands are:

```text
vmblu make-capabilities <entrypoint>.blu
vmblu make-agent-adapter <model-file> --target <target>
vmblu verify <entrypoint>.blu
```

Generated artifacts include provenance with the source-model hash, schema
version, and generator version. `vmblu verify` validates schemas, references,
interfaces, sidecars, and artifact freshness.

Secrets, tokens, client secrets, and provider keys must never be stored in a
`.blu` model, agent sidecar, generated browser code, or client storage.

## Deferred work

The current integration is workable, but these areas remain intentionally
deferred:

- a human Approve/Deny UI for tools using `approval: "always"`;
- safe editor loading and round-tripping of authored agent sidecars;
- explicit presentation of every tool outcome in the overlay;
- end-to-end agent-settings tests in the playground and VS Code webview;
- an explicitly configured privileged administrative principal;
- provider streaming and cancellation;
- durable agent event subscriptions;
- a UI bridge for Node/headless applications.

See [the deferred backlog](../../agent-integration-improvements.md) for the
implementation details and completion criteria.
