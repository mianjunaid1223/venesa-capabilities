# Contributing to Venesa Community Capabilities

Thank you for contributing to the official Venesa community capability registry. This document defines the contribution protocol all submissions must follow.

---

## Contribution Protocol

### 1. Fork the Repository

Click **Fork** on [mianjunaid1223/venesa-capabilities](https://github.com/mianjunaid1223/venesa-capabilities) to create your personal copy.

### 2. Add Your Capability File

Add a single `.js` file inside the **`/capabilities/`** folder of the repository.

**No sub-directories inside `/capabilities/`. One flat level only.**

### 3. File Name Format

```
<capability-name>.js
```

Use lowercase, hyphen-separated names that describe what the capability does.

**Valid examples:**
```
capabilities/weather.js
capabilities/filesystem.js
capabilities/web-search.js
capabilities/screenshot.js
capabilities/send-email.js
capabilities/github-issues.js
```

**Invalid examples:**
```
MyCapability.js                        ❌  (uppercase)
my_capability.js                       ❌  (underscores)
capabilities/weather/index.js          ❌  (nested sub-folder)
```

### 4. Submit a Pull Request

Open a Pull Request from your fork targeting the `main` branch of this repository. Include a brief description of what your capability does.

---

## Capability File Requirements

Every capability file must export a valid object using `module.exports`. The object must include:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Unique camelCase identifier for the capability |
| `description` | `string` | ✅ | Injected into the AI prompt — be precise |
| `handler` | `async function` | ✅ | The execution entry point. Must be wrapped in `try/catch` |
| `schema` | `zod object` | ✅ | Input validation schema |
| `returnType` | `string` | ✅ | One of: `data`, `action`, `ui`, `memory`, `hybrid` |
| `tags` | `string[]` | optional | Categorization tags |
| `ui` | `string` | optional | Render hint: `table`, `key-value`, `card-list`, `command-list` |
| `marker` | `string` | optional | Visibility: `silently`, `announce`, `confirm` |
| `enabled` | `boolean` | optional | Whether enabled by default (defaults to `true`) |
| `dependencies` | `string[]` | optional | Exact npm specifiers only — e.g. `"<dep_name>@1.7.9"`. No ranges. |

### Minimal Valid Structure

```javascript
'use strict';

const { z } = require('zod');

module.exports = {
  name: 'myCapability',
  description: 'What this capability does.',
  returnType: 'data',

  schema: z.object({}),

  async handler(params) {
    try {
      // your logic here
      return { success: true, result: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
```

### Recommended Full Structure

```javascript
'use strict';

const { z } = require('zod');

// Declare exact-version npm dependencies (no ranges).
// dependencies: ['<dep_name>@1.7.9']

module.exports = {
  name: 'myCapability',
  description: 'What this capability does.',
  returnType: 'data',
  marker: 'silently',
  tags: ['category', 'keyword'],
  ui: 'key-value',
  // dependencies: ['<dep_name>@1.7.9'],

  schema: z.object({
    query: z.string().trim().min(1).describe('Input query.'),
  }),

  async handler({ query }) {
    try {
      // your logic here
      return { success: true, result: query };
    } catch (err) {
      // For network capabilities, detect offline:
      // const isOffline = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED';
      // if (isOffline) return { success: false, error: 'No internet connection. Please check your connection and try again.' };
      return { success: false, error: err.message };
    }
  },
};
```

---

## Rules

All submissions must follow these rules to be accepted:

- **Place files in `/capabilities/`** — capability file must live directly inside the `/capabilities/` directory (no sub-folders)
- **CommonJS only** — use `require` / `module.exports`. No `import`/`export`
- **No bundled dependencies** — declare external packages via the `dependencies` array. No git, http, file:, or tarball entries. Exact versions only — no ranges (`^`, `~`, `>=`, `*`)
- **No malicious execution** — no code that harms users, exfiltrates data, or executes unsolicited system commands
- **No side effects during import** — the module must not execute logic when `require()`'d; all execution must be inside `handler`
- **Metadata required** — `name`, `description`, `returnType`, and `schema` fields are mandatory
- **One capability per file** — do not bundle multiple capabilities in a single file
- **Async handler with try/catch** — the `handler` must be `async` and every code path wrapped in `try/catch`. Never throw unhandled
- **Error contract** — on failure return `{ success: false, error: string }`. Never throw
- **No logging** — no `console.log` or any logger calls inside capability files
- **Offline handling** — if your handler makes any HTTP call, detect and return the standard offline error on `ENOTFOUND`/`ETIMEDOUT`/`ECONNREFUSED`

---

## Review Process

Submitted pull requests go through the following:

### 1. Automated structure validation (file in `/capabilities/`, `.js` extension, valid export shape)
2. Manual review for security and policy compliance
3. Approval by at least 1 maintainer
4. Merge into `main` — capability is immediately discoverable by Venesa

---

## Questions

Open an [issue](https://github.com/mianjunaid1223/venesa-capabilities/issues) or start a [discussion](https://github.com/mianjunaid1223/venesa-capabilities/discussions) if you have questions about the contribution process.
