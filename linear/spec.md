# vmblu Linear Code Model Specification

## Draft 0.2

## 1. Purpose

The vmblu Linear Code Model provides a structured, machine-readable model of conventional software whose behavior is primarily expressed through direct calls, imports, framework callbacks, APIs, and other non-vmblu runtime mechanisms.

It is part of the vmblu suite.

The Linear Code Model supports two complementary workflows:

1. **Design-first architecture** — define the architecture of a new conventional system before implementation, generate structural scaffolding, and verify that implementation conforms to the model.
2. **Reverse architecture** — analyze an existing codebase, reconstruct an evidence-backed architectural model, verify it continuously, and guide transformation.

The Linear Code Model enables vmblu to:

* design conventional direct-call software before implementation;
* analyze JavaScript and TypeScript codebases;
* extract compiler-backed structural facts;
* create high-level, navigable presentations of a system;
* help humans and agents reconstruct intended architecture;
* generate package, interface, and implementation scaffolding from an approved design;
* compare declared architecture with actual implementation;
* detect architectural drift;
* guide source-level refactorings;
* identify and support gradual migration of selected boundaries into a message-based vmblu model.

The Linear Code Model is not an executable runtime architecture. It does not replace application code, framework lifecycle, ordinary call stacks, or deployment infrastructure.

The message-based vmblu model remains the executable architecture model. It can generate and run the vmblu runtime composition of an application.

The Linear Code Model is an evidence-backed architecture contract for conventional software.

---

## 2. Position in the vmblu Suite

vmblu supports two complementary architectural modes.

### 2.1 Linear Code Model

The Linear Code Model represents traditional software structures:

* packages;
* modules;
* functions;
* classes;
* methods;
* APIs;
* imports;
* direct calls;
* framework entry points;
* database access;
* external integrations.

Its purpose is to design, understand, govern, and transform independently implemented systems.

### 2.2 Message Model

The vmblu Message Model represents message-based runtime architecture:

* runtime nodes;
* pins;
* interfaces;
* routes;
* requests and replies;
* events;
* policies;
* controlled agent capabilities.

Its purpose is to generate, run, observe, and control application architecture through the vmblu runtime.

### 2.3 Relationship Between the Models

The Linear Code Model may be used to:

1. design a new traditional system;
2. reconstruct the architecture of an existing traditional system;
3. validate that implementation remains consistent with intended architecture;
4. identify candidate boundaries for message-based migration;
5. generate adapters, wrappers, and migration plans for selected parts of a system;
6. progressively transform a conventional system into a vmblu Message Model.

The two models share architectural concepts where appropriate:

* component;
* interface;
* operation;
* contract;
* dependency;
* boundary;
* hierarchy;
* ownership;
* source binding;
* policy.

They differ in runtime semantics.

| Concept    | Linear Code Model                                 | Message Model                              |
| ---------- | ------------------------------------------------- | ------------------------------------------ |
| Node       | Package, module, service, class, subsystem        | Runtime node                               |
| Interface  | Public callable API                               | Group of runtime pins                      |
| Operation  | Function, method, endpoint                        | Input/output, request, reply, event        |
| Route      | Direct call or dependency                         | Brokered runtime message route             |
| Execution  | Call stack, async calls, framework lifecycle      | vmblu runtime dispatch                     |
| Main value | Design, understanding, governance, transformation | Generation, runtime control, observability |

---

## 3. Principles

### 3.1 Evidence before interpretation

The analyzer must distinguish between:

* facts extracted from source code or compiler analysis;
* inferred relationships;
* framework-specific interpretations;
* human or agent architectural decisions.

The system must not present an inferred architectural conclusion as a compiler-proven fact.

### 3.2 Architecture before implementation is valid

A Linear Code Model may be created before any implementation exists.

In a design-first workflow, the model expresses intended architecture:

* components;
* public interfaces;
* contracts;
* allowed dependencies;
* layers;
* resources;
* ownership;
* policies.

The implementation is then generated or written to satisfy the model.

### 3.3 Source provenance

Every extracted item should be traceable to source evidence wherever possible.

A user must be able to answer:

> Why does vmblu believe this component, dependency, call, or boundary exists?

### 3.4 Language-neutral core, language-specific adapters

The core Linear Code Model should be language-neutral.

Language adapters provide analysis and source binding for particular ecosystems.

The initial implementation targets:

* JavaScript;
* TypeScript;
* JSX;
* TSX;
* CommonJS;
* ECMAScript modules.

The initial analyzer should use the TypeScript compiler and language-service ecosystem, including JavaScript projects through `allowJs` and, where available, `checkJs`.

### 3.5 Confidence is explicit

Every non-trivial relation should carry a confidence or resolution status.

Suggested values:

* `exact` — resolved by compiler or language service;
* `static` — determined by static syntax or module analysis;
* `framework` — inferred through a known framework adapter;
* `heuristic` — inferred from patterns;
* `agent` — proposed by an agent;
* `human` — confirmed or authored by a user;
* `unknown` — unresolved.

### 3.6 Models are durable, views are generated

The JSON model is the durable artifact.

Diagrams, presentations, dependency graphs, reports, and agent-context packages are generated views over that model. They should not become competing sources of truth.

### 3.7 Incremental adoption

A project should gain value without requiring a rewrite.

```text
Design or Analyze
        ↓
Model
        ↓
Implement or Review
        ↓
Verify
        ↓
Transform
        ↓
Migrate selected boundaries
```

---

## 4. Workflows

The Linear Code Model supports two entry paths that converge on the same canonical JSON model.

### 4.1 Design-First Workflow

The design-first workflow starts with intended architecture rather than existing source evidence.

```text
Requirements
    ↓
Architecture proposal
    ↓
Reviewed Linear Code Model
    ↓
Generated package and interface scaffolding
    ↓
Human and agent implementation
    ↓
Compiler-backed analysis
    ↓
Verification against the model
```

In this workflow, a human or coding agent defines:

* components and subsystem hierarchy;
* public interfaces;
* operations and contracts;
* allowed dependency directions;
* architectural layers;
* external resources and integrations;
* ownership;
* policies and architectural rules;
* candidate future message boundaries.

vmblu may then generate scaffolding such as:

* package and folder structure;
* module files;
* public interface declarations;
* class or function stubs;
* dependency injection or construction wiring;
* tests for declared interfaces;
* architecture verification rules;
* starter documentation and source bindings.

Generated scaffolding must not be treated as a complete application generator. Implementation behavior remains ordinary source code authored by humans or coding agents within declared architectural boundaries.

After implementation begins, the analyzer creates evidence from the real codebase and compares it with the design model. The same verification, presentation, transformation, and migration tools then apply.

### 4.2 Reverse-Architecture Workflow

The reverse-architecture workflow starts with an existing codebase.

```text
Existing codebase
    ↓
Project discovery and compiler analysis
    ↓
Evidence graph
    ↓
Candidate Linear Code Model
    ↓
Human and agent review
    ↓
Confirmed architecture and verification rules
    ↓
Transformation or message-model migration
```

The analyzer extracts evidence from source code, while humans and agents decide which inferred structures represent intended architecture.

### 4.3 Shared Lifecycle

Both workflows converge on a common lifecycle:

```text
Model
    ↓
Implement or Analyze
    ↓
Present
    ↓
Verify
    ↓
Transform
    ↓
Migrate
```

The Linear Code Model is therefore neither only a reverse-engineering artifact nor only a design document.

It is a persistent architecture contract that can be:

* designed before code exists;
* reconstructed from existing code;
* continuously verified against implementation;
* used to guide transformations;
* used to prepare migration into the Message Model.

---

## 5. Linear Code Model Analysis Pipeline

### 5.1 Phase A — Project Discovery

The analyzer identifies project shape and analysis configuration.

Inputs may include:

* project root;
* `package.json`;
* `tsconfig.json` or `jsconfig.json`;
* workspace configuration;
* source roots;
* test roots;
* ignore rules;
* package-manager metadata;
* framework configuration;
* optional user-supplied component boundaries.

Outputs include:

* project metadata;
* supported source files;
* compiler configuration;
* module-resolution configuration;
* discovered packages or workspaces;
* entry-point candidates;
* excluded paths and reasons.

### 5.2 Phase B — Compiler and Source Analysis

The analyzer parses and resolves source files.

It extracts:

* files;
* modules;
* imports and exports;
* declarations;
* symbols;
* classes;
* functions;
* methods;
* interfaces;
* types;
* inheritance and implementation relations;
* call sites;
* references;
* async boundaries;
* dynamic imports where detectable;
* source ranges;
* diagnostics.

The analyzer must preserve unresolved or ambiguous constructs rather than silently discarding them.

### 5.3 Phase C — Framework and Infrastructure Detection

Optional adapters enrich the compiler model.

Initial candidates include:

* Express or Fastify routes;
* Svelte component and store boundaries;
* React component boundaries;
* Node HTTP server entry points;
* ORM or database-client usage;
* queue producers and consumers;
* WebSocket handlers;
* environment-variable access;
* outbound HTTP calls;
* external SDK usage.

Framework adapters must identify themselves in extracted evidence and distinguish framework inference from compiler-resolved facts.

### 5.4 Phase D — Evidence Graph Construction

The analyzer converts extracted facts into a normalized graph.

The graph should capture:

* declaration relationships;
* import relationships;
* export relationships;
* invocation relationships;
* implementation relationships;
* inheritance relationships;
* framework routes;
* persistence access;
* external integration access;
* test-to-production relationships;
* unresolved and dynamic edges.

The evidence graph is not itself an architecture model. It is the factual basis from which architecture can be understood, proposed, verified, or transformed.

### 5.5 Phase E — Architectural Candidate Generation

A human or agent may generate an architecture overlay from the evidence graph.

Candidate generation may propose:

* components;
* subsystems;
* package boundaries;
* interfaces;
* public operations;
* dependency directions;
* architectural layers;
* ownership;
* external resources;
* likely data flows;
* policy boundaries;
* message-migration candidates.

Every candidate must include:

* rationale;
* evidence references;
* confidence;
* authoring source: `agent`, `human`, `heuristic`, or `rule`.

### 5.6 Phase F — Review and Confirmation

The user reviews proposed architecture.

The editor should support:

* accept;
* reject;
* rename;
* merge;
* split;
* defer;
* mark uncertain;
* add explanatory notes;
* declare exceptions;
* assign ownership;
* promote an inferred element to confirmed architecture.

Confirmed architecture is stored separately from raw evidence.

### 5.7 Phase G — Continuous Verification

The analyzer compares the current codebase with the accepted architecture model.

It reports:

* undeclared dependencies;
* forbidden dependency directions;
* missing implementations;
* stale or deleted source bindings;
* direct infrastructure access that bypasses an intended boundary;
* unexpected public APIs;
* unresolved calls;
* architecture drift;
* changes requiring model review.

### 5.8 Phase H — Transformation and Migration

Transformation tools use the model and source evidence to make controlled changes.

Examples:

* introduce or extract a module;
* introduce an interface;
* move a function across a declared boundary;
* replace direct infrastructure access with an adapter;
* create a vmblu wrapper around an existing module;
* convert selected direct interactions into message boundaries;
* generate a migration plan from Linear Code Model to Message Model.

All transformations must preserve traceability between:

* original source;
* changed source;
* Linear Code Model changes;
* target Message Model changes;
* tests and verification results.

---

## 6. Canonical JSON File

### 6.1 File Role

The canonical JSON file stores:

1. analysis configuration and project metadata;
2. source-derived evidence;
3. architecture overlay;
4. review state;
5. diagnostics;
6. verification rules and results;
7. design intent;
8. transformation and migration metadata.

Suggested file extension:

```text
.vmlc.json
```

Working alternative:

```text
.vmblu-code.json
```

The extension should be decided together with final naming of the Linear Code Model.

### 6.2 Top-Level Structure

```json
{
  "header": {},
  "project": {},
  "analysis": {},
  "evidence": {},
  "architecture": {},
  "verification": {},
  "migration": {},
  "editor": {}
}
```

### 6.3 Header

```json
{
  "header": {
    "format": "vmblu-linear-code-model",
    "version": "0.2.0",
    "createdAt": "2026-06-26T12:00:00Z",
    "updatedAt": "2026-06-26T12:00:00Z",
    "origin": "design"
  }
}
```

Required fields:

* `format`;
* `version`.

Optional fields:

* `createdAt`;
* `updatedAt`;
* generator version;
* schema identifier;
* repository revision;
* `origin`, with suggested values:

  * `design`;
  * `analysis`;
  * `hybrid`.

### 6.4 Project

```json
{
  "project": {
    "name": "example-app",
    "root": ".",
    "languages": ["typescript", "javascript"],
    "packages": [
      {
        "id": "app",
        "path": ".",
        "name": "example-app"
      }
    ],
    "sourceRoots": ["src"],
    "testRoots": ["tests"],
    "entryPoints": [
      {
        "kind": "http-server",
        "path": "src/server.ts",
        "symbol": "startServer",
        "resolution": "framework"
      }
    ]
  }
}
```

### 6.5 Analysis

```json
{
  "analysis": {
    "adapter": {
      "name": "typescript",
      "version": "initial"
    },
    "configuration": {
      "tsconfig": "tsconfig.json",
      "allowJs": true,
      "checkJs": false
    },
    "scannedAt": "2026-06-26T12:00:00Z",
    "revision": "git:abc123",
    "includedPaths": ["src", "tests"],
    "excludedPaths": ["node_modules", "dist"],
    "diagnostics": []
  }
}
```

For design-first models, analysis may be absent or incomplete until source files exist.

### 6.6 Evidence

The `evidence` section contains extracted facts.

```json
{
  "evidence": {
    "files": [],
    "modules": [],
    "symbols": [],
    "imports": [],
    "exports": [],
    "calls": [],
    "types": [],
    "inherits": [],
    "implements": [],
    "routes": [],
    "events": [],
    "databaseAccess": [],
    "externalIntegrations": [],
    "environmentAccess": [],
    "tests": [],
    "diagnostics": []
  }
}
```

### 6.7 Source Range

All source-backed entities should use a shared source-range form.

```json
{
  "file": "src/services/order-service.ts",
  "range": {
    "start": {
      "line": 42,
      "column": 3
    },
    "end": {
      "line": 59,
      "column": 4
    }
  }
}
```

### 6.8 File

```json
{
  "id": "file:src/services/order-service.ts",
  "path": "src/services/order-service.ts",
  "language": "typescript",
  "kind": "source",
  "package": "app"
}
```

### 6.9 Module

```json
{
  "id": "module:src/services/order-service",
  "path": "src/services/order-service.ts",
  "file": "file:src/services/order-service.ts",
  "kind": "esm",
  "exports": [
    "symbol:OrderService",
    "symbol:createOrder"
  ]
}
```

### 6.10 Symbol

```json
{
  "id": "symbol:OrderService.createOrder",
  "name": "createOrder",
  "qualifiedName": "OrderService.createOrder",
  "kind": "method",
  "visibility": "public",
  "module": "module:src/services/order-service",
  "signature": {
    "parameters": [
      {
        "name": "input",
        "type": "CreateOrderInput"
      }
    ],
    "returns": "Promise<Order>"
  },
  "source": {
    "file": "src/services/order-service.ts",
    "range": {
      "start": { "line": 42, "column": 3 },
      "end": { "line": 59, "column": 4 }
    }
  },
  "resolution": "exact"
}
```

### 6.11 Import

```json
{
  "id": "import:checkout-to-order-service",
  "fromModule": "module:src/ui/checkout",
  "toModule": "module:src/services/order-service",
  "kind": "static",
  "symbols": [
    {
      "local": "OrderService",
      "imported": "OrderService"
    }
  ],
  "source": {
    "file": "src/ui/checkout.ts",
    "range": {
      "start": { "line": 4, "column": 1 },
      "end": { "line": 4, "column": 48 }
    }
  },
  "resolution": "exact"
}
```

### 6.12 Call

```json
{
  "id": "call:checkout-submit-to-create-order",
  "fromSymbol": "symbol:Checkout.submit",
  "toSymbol": "symbol:OrderService.createOrder",
  "kind": "method-call",
  "async": true,
  "source": {
    "file": "src/ui/checkout.ts",
    "range": {
      "start": { "line": 87, "column": 11 },
      "end": { "line": 87, "column": 48 }
    }
  },
  "resolution": "exact",
  "confidence": 1
}
```

### 6.13 Framework Route

```json
{
  "id": "route:post-orders",
  "kind": "http",
  "method": "POST",
  "path": "/orders",
  "handler": "symbol:OrderController.create",
  "framework": "fastify",
  "resolution": "framework",
  "confidence": 0.95
}
```

### 6.14 Database Access

```json
{
  "id": "db:order-repository-save",
  "fromSymbol": "symbol:OrderRepository.save",
  "operation": "write",
  "resource": {
    "kind": "table",
    "name": "orders"
  },
  "client": "prisma",
  "resolution": "framework",
  "confidence": 0.9
}
```

### 6.15 External Integration

```json
{
  "id": "integration:payment-provider-charge",
  "fromSymbol": "symbol:PaymentAdapter.charge",
  "kind": "sdk",
  "provider": "stripe",
  "operation": "payment-intent-create",
  "resolution": "framework",
  "confidence": 0.85
}
```

### 6.16 Architecture Overlay

The `architecture` section stores design intent and reviewed architecture.

```json
{
  "architecture": {
    "components": [],
    "interfaces": [],
    "operations": [],
    "dependencies": [],
    "layers": [],
    "resources": [],
    "policies": [],
    "exceptions": [],
    "decisions": []
  }
}
```

### 6.17 Component

```json
{
  "id": "component:order-service",
  "name": "Order Service",
  "kind": "service",
  "status": "confirmed",
  "sourceBindings": [
    "module:src/services/order-service",
    "module:src/services/order-validation"
  ],
  "evidence": [
    "symbol:OrderService.createOrder",
    "symbol:OrderService.cancelOrder"
  ],
  "confidence": 0.91,
  "origin": "agent",
  "owner": "orders-team",
  "description": "Coordinates order validation, persistence, and payment initiation."
}
```

Suggested `status` values:

* `candidate`;
* `confirmed`;
* `deprecated`;
* `migration-target`;
* `unresolved`.

### 6.18 Interface

```json
{
  "id": "interface:order-service.orders",
  "component": "component:order-service",
  "name": "Orders",
  "visibility": "public",
  "operations": [
    "operation:create-order",
    "operation:cancel-order"
  ]
}
```

### 6.19 Operation

```json
{
  "id": "operation:create-order",
  "interface": "interface:order-service.orders",
  "name": "createOrder",
  "kind": "call",
  "contract": {
    "input": "CreateOrderInput",
    "output": "Promise<Order>"
  },
  "sourceBindings": [
    "symbol:OrderService.createOrder"
  ]
}
```

### 6.20 Architectural Dependency

```json
{
  "id": "dependency:checkout-to-order-service",
  "fromComponent": "component:checkout-ui",
  "toComponent": "component:order-service",
  "kind": "call",
  "operations": [
    "operation:create-order"
  ],
  "status": "allowed",
  "evidence": [
    "call:checkout-submit-to-create-order"
  ],
  "confidence": 1
}
```

Suggested dependency statuses:

* `allowed`;
* `forbidden`;
* `candidate`;
* `deprecated`;
* `exception`.

### 6.21 Verification

```json
{
  "verification": {
    "rules": [],
    "results": [],
    "lastRun": "2026-06-26T12:00:00Z"
  }
}
```

A rule example:

```json
{
  "id": "rule:no-ui-to-repository",
  "kind": "dependency",
  "fromLayer": "ui",
  "toLayer": "persistence",
  "status": "forbidden",
  "message": "UI components must not call repositories directly."
}
```

A result example:

```json
{
  "id": "violation:checkout-to-order-repository",
  "rule": "rule:no-ui-to-repository",
  "severity": "error",
  "evidence": [
    "call:checkout-to-order-repository-save"
  ],
  "message": "CheckoutPage directly calls OrderRepository.save().",
  "suggestedPath": [
    "component:checkout-ui",
    "component:order-service",
    "component:order-repository"
  ]
}
```

### 6.22 Migration

The `migration` section links the Linear Code Model to a target Message Model.

```json
{
  "migration": {
    "targets": [],
    "candidates": [],
    "plans": [],
    "generatedArtifacts": []
  }
}
```

A migration candidate example:

```json
{
  "id": "migration-candidate:payment-capability",
  "sourceDependency": "dependency:order-service-to-payment-adapter",
  "reason": [
    "External payment provider access",
    "Security-sensitive capability",
    "Multiple callers",
    "Async request/reply interaction"
  ],
  "recommendedTarget": {
    "kind": "message-boundary",
    "node": "Payment Capability",
    "request": "charge card",
    "reply": "payment result"
  },
  "status": "candidate"
}
```

### 6.23 Editor Data

The `editor` section is non-semantic presentation state.

It may contain:

* positions;
* collapsed groups;
* routes;
* annotations;
* selected views;
* filters;
* layout settings.

No semantic architecture rule should depend on `editor` fields.

---

## 7. Tooling

### 7.1 Design Tool

The design tool creates or evolves a Linear Code Model before implementation exists.

Initial command concept:

```text
vmblu linear design
```

The design tool should support:

* creating components, interfaces, operations, and contracts;
* defining allowed dependencies and layers;
* declaring external resources and integrations;
* assigning ownership and architectural policies;
* generating an initial package hierarchy;
* producing model fragments suitable for agent tasks;
* comparing alternative architecture proposals;
* marking selected direct-call boundaries as future message-migration candidates.

### 7.2 Scaffold Tool

The scaffold tool generates conventional source-code structure from an approved Linear Code Model.

Initial command concept:

```text
vmblu linear scaffold
```

Initial generated artifacts may include:

* directories and package boundaries;
* JavaScript or TypeScript module files;
* exports and import placeholders;
* interface and type declarations;
* class, function, or service stubs;
* tests for declared public operations;
* dependency wiring placeholders;
* architecture rule configuration;
* source bindings back into the model.

The scaffold tool must generate only the structural implementation implied by the model. It must not claim to generate the full business behavior of an application.

### 7.3 Analyzer

The analyzer creates or updates the evidence model.

Initial command concept:

```text
vmblu linear analyze
```

Responsibilities:

* discover project configuration;
* parse supported files;
* resolve imports and symbols;
* extract evidence;
* preserve source locations;
* emit diagnostics;
* update the canonical JSON model.

### 7.4 Profile Tool

The profile tool answers focused, evidence-backed questions.

Initial command concept:

```text
vmblu linear profile <query>
```

Example queries:

```text
profile symbol OrderService.createOrder
profile callers OrderService.createOrder
profile imports src/ui/checkout.ts
profile dependencies component:checkout-ui
profile path "POST /orders" --to database
profile integrations
profile cycles
profile unresolved
profile violations
profile migration-candidates
```

The profile tool should return compact structured data suitable for both humans and agents.

### 7.5 Presentation Tool

The presentation tool generates filtered views from the model.

Initial command concept:

```text
vmblu linear view <view>
```

Initial views:

* package map;
* module dependency graph;
* component architecture view;
* public API view;
* endpoint-to-database flow;
* external integration view;
* dependency-cycle view;
* verification violations;
* migration candidates;
* agent task-context view.

The editor should support interactive exploration:

* click component to inspect evidence;
* click operation to navigate to implementation;
* click dependency to inspect all call sites;
* filter by package, component, layer, risk, or confidence;
* compare selected architecture against current evidence.

### 7.6 Architecture Proposal Tool

The proposal tool creates candidate architecture overlays.

Initial command concept:

```text
vmblu linear propose architecture
```

Possible proposals:

* subsystem grouping;
* public interface extraction;
* layering;
* ownership;
* package boundaries;
* anti-corruption adapters;
* direct-call violations;
* candidate vmblu message boundaries.

All proposals must include evidence and confidence.

### 7.7 Verification Tool

The verification tool compares code evidence against the accepted architecture overlay.

Initial command concept:

```text
vmblu linear verify
```

Checks may include:

* forbidden dependencies;
* undeclared dependencies;
* missing operation bindings;
* stale source bindings;
* direct access to protected resources;
* cycles;
* public API growth;
* architectural rule violations.

This tool should be suitable for CI.

### 7.8 Transformation Tool

The transformation tool makes source and model changes together.

Initial command concept:

```text
vmblu linear transform <operation>
```

Initial transformation candidates:

* extract module;
* move symbol;
* introduce interface;
* replace direct import with adapter;
* create service façade;
* split component;
* rename architecture component and bound source symbols;
* add architectural boundary rule;
* update model bindings after code movement.

Transformations should:

1. generate a plan;
2. identify affected files and model entities;
3. apply source edits;
4. update the canonical model;
5. run verification;
6. report unresolved manual work.

### 7.9 Migration Tool

The migration tool converts selected Linear Code Model structures into vmblu Message Model structures.

Initial command concept:

```text
vmblu linear migrate <candidate>
```

Initial migration operations:

* wrap an existing module as a vmblu source node;
* generate a message-node adapter;
* generate request/reply pins from an existing callable operation;
* replace selected direct calls with vmblu request/send calls;
* generate a target Message Model fragment;
* preserve compatibility through an adapter;
* create a staged migration plan.

The migration tool must not imply that all direct calls should become messages. It should target boundaries where runtime mediation provides real value.

### 7.10 Agent Implementation Tooling

Coding agents should be able to receive a scoped architectural task from the Linear Code Model.

For example:

```text
Implement component:order-service.

It may expose operations createOrder and cancelOrder.
It may call component:payment-adapter and component:order-repository.
It may not access database resources directly.
Preserve declared contracts and update source bindings.
Run vmblu linear verify after implementation.
```

This makes the Linear Code Model an active design constraint for agent-authored code, rather than documentation supplied after implementation.

---

## 8. Agent Interface

Agents should interact with the Linear Code Model through structured profile and transformation tools rather than broad repository reading wherever possible.

An agent workflow should be:

```text
1. Read the relevant architecture model slice.
2. Ask a profile question when source evidence is required.
3. Receive evidence-backed results.
4. Form a hypothesis or implementation plan.
5. Propose architecture or transformation changes.
6. Apply changes through controlled tools.
7. Re-run analysis and verification.
```

Examples:

```text
Find all callers of PaymentAdapter.charge.
Show all paths from checkout UI to payment provider.
Identify direct calls that bypass the Order Service.
Propose components for the billing area and explain the evidence.
Create a migration plan for PaymentAdapter into a message capability.
Verify that no UI component accesses persistence directly.
Implement the declared Order Service interface without adding new dependencies.
```

The model should provide agents with:

* stable identifiers;
* source ranges;
* confidence;
* provenance;
* architectural status;
* transformation impact;
* verification results;
* declared constraints;
* allowed dependencies;
* operation contracts.

---

## 9. Initial MVP Scope

The first implementation should remain deliberately narrow.

### Included

* JavaScript and TypeScript analysis;
* TypeScript compiler and language-service integration;
* files, modules, imports, exports, symbols, calls, signatures, and source ranges;
* unresolved relation reporting;
* canonical JSON evidence model;
* design-first architecture authoring;
* package and interface scaffolding;
* package/dependency presentation;
* basic call-flow presentation;
* profile queries;
* architecture overlay with components, interfaces, operations, and dependencies;
* basic verification rules;
* source navigation.

### Deferred

* complete dynamic call resolution;
* all framework adapters;
* runtime tracing;
* full automated source refactoring;
* automatic migration of arbitrary systems into vmblu messages;
* multi-language support beyond JavaScript and TypeScript;
* advanced semantic merge tooling;
* enterprise ownership and policy integrations.

---

## 10. Success Criteria

The Linear Code Model is successful when it allows a human or agent to answer questions such as:

* What are the major components of this codebase?
* Which parts call this service or public operation?
* Which routes lead from this endpoint to this database write?
* Which modules access this external provider?
* Which dependencies violate the intended architecture?
* What source evidence supports this architecture diagram?
* What is the likely blast radius of changing this interface?
* Which direct-call boundaries are candidates for vmblu message migration?
* Can this refactoring update code and architecture together?
* Can a new application be designed before implementation?
* Can a coding agent generate and implement work while remaining inside explicit architectural boundaries?

---

## 11. Summary

The vmblu Linear Code Model gives vmblu an entry point for both new conventional systems and existing codebases.

It does not compete with the message-based vmblu model. It complements it.

```text
Linear Code Model:
Design, understand, and govern direct-call software.

Message Model:
Generate and control selected runtime architecture.

Together:
Make software understandable, maintainable, and safe for agents.
```
