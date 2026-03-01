# Venesa Community Capability Repository

Official registry of community capabilities for the [Venesa](https://github.com/mianjunaid1223/venesa) intelligence platform.

## What are Venesa Capabilities?

Capabilities are self-contained JavaScript modules that extend the Venesa intelligence platform. Each capability gives Venesa a new skill — from fetching weather data and searching the web, to reading files, sending emails, or controlling system processes.

Venesa's orchestrator dynamically discovers and loads capabilities at runtime. Once installed, a capability becomes part of Venesa's tool chain and can be invoked by the AI to complete tasks on your behalf.

## One File = One Capability

This repository follows a strict flat structure:

- **Every capability is a single `.js` file**
- **No folders, no sub-packages, no nested structures**
- **The repository root itself is the registry**

Venesa discovers capabilities by listing files in this repository via the GitHub API and fetching them directly by raw file URL. No manifest, no registry.json — the file tree is the registry.

## Installation

Capabilities are installed directly inside Venesa. From the Venesa UI, navigate to **Capabilities → Browse Community** and install any capability by file name — no manual downloads required.

Venesa fetches the raw capability file and loads it into its execution engine automatically.

## Capability Rules

- One capability per file
- File extension must be `.js`
- Export exactly one object
- Async handler required
- No side effects during import

## Example Capability

```javascript
module.exports = {
  name: "example",
  description: "Example Venesa capability",
  version: "1.0.0",

  async handler(params, context) {
    return "example response";
  }
};
```

For the full specification including schema validation, return types, lifecycle hooks, and UI rendering options, see the **capabilitie Development Specification** section below.

---

# capabilitie Development Specification

## The Unified Protocol Standard

Venesa's internal reasoning logic treats both core features and community extensions uniformly via a strictly typed capabilitie standard. Every capabilitie must export a compliant object (module.exports).

The architecture guarantees isolation; failed executions will be trapped and resolved cleanly by the orchestrator.

## Schema Declaration

```javascript
const { z } = require("zod");

module.exports = {
  // Mandatory Implementation
  name: "mycapabilitie",
  description: "Provides precise system queries to the execution engine.",
  returnType: "data", // Valid types: 'data' | 'action' | 'ui' | 'memory' | 'hybrid'
  schema: z.object({
    // Hard boundary parameter validation
    query: z.string().optional(),
  }),
  handler: async (params) => {
    /* logic */
  }, // Asynchronous execution block

  // Optional Parameters
  ui: "table", // Render hints: 'table' | 'key-value' | 'card-list' | 'command-list'
  marker: "announce", // Visibility markers: 'silently' | 'announce' | 'confirm'
  tags: ["monitoring", "query"],
  enabled: true,
  config: z.object({
    /* params */
  }), // Expected settings definitions
  lifecycle: {
    onLoad() {},
    onUnload() {},
    onEnable() {},
    onDisable() {},
  },
};
```

## Component Requirements

### Handler Logic

The `handler(params)` encapsulates the functional operation.

- **Payload:** The `params` object contains variables already sanitized against the defined `schema`.
- **Isolation:** Operational context like the application thread is abstracted away from the parameter intake. The capabilitie solely acts upon structured parameters.
- **Response Format:** Returns a native object, JSON string, or standard string.

### Schema Validation

Extracted inputs are hard-validated against the `schema` variable before triggering the payload handler.

- **Pre-Validation:** This avoids allocating computational resources for syntax-error LLM predictions. A runtime rejection instructs the model internally to attempt self-correction.
- **Type Casting:** Zod parameters can implement `.default()` or `.transform()` to guarantee strict internal assumptions.

### Configuration Binding

capabilities can supply external variable structures via `config`, using the Zod syntax model. Values propagate internally at boot from application configurations or persistent stores. Ensure you attach `.default()` fallback states so modules perform cleanly immediately upon insertion.

## Handling Outputs

The `returnType` delineates to the LLM the behavioral path required post-execution.

| Type     | Behavioral Model                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`   | The AI suspends process threads awaiting response structures before formulation.                                                                                                                                                                            |
| `action` | Dispatches instructions silently by default. When a visibility marker (`announce` or `confirm`) is set, confirmations or UI feedback are emitted; otherwise no user-facing output is produced. Returns confirmation metadata only when markers are present. |
| `ui`     | Forwards execution payload straight to the user-interface dispatcher.                                                                                                                                                                                       |
| `memory` | Manipulates internal context variables without exposing events.                                                                                                                                                                                             |
| `hybrid` | Execution response dictates adaptive behavior across the platform.                                                                                                                                                                                          |

## Utilizing Lifecycles

Lifecycles tie specific actions directly to external triggers. Hooks enforce asynchronous wrappers natively. Error outputs invoke standard warnings to the console without breaking daemon continuity.

- `onLoad()`: Executed immediately following cache allocation within the registry index.
- `onUnload()`: Invoked during daemon termination or cache purging.
- `onEnable()` / `onDisable()`: Triggers upon user-toggled UI events.

## Directory Formatting

All capabilities live under the `/capabilities/` structure.

- A solitary file logic block: `/capabilities/automation-feature.js`
- Packaged multi-module structures: `/capabilities/automation-feature/skill.js` (where `skill.js` serves as the target map).
- Hidden logic elements (prefixed with `.` or `_`) are still loaded and executed by the system, but they are **not indexed** within the orchestrator loop. This means they will not appear in the AI's tool list and cannot be invoked by name through the orchestrator, though their side effects (e.g., lifecycle hooks) still run.
