# Contributing to Venesa Community Capabilities

Thank you for contributing to the official Venesa community capability registry. This document defines the contribution protocol all submissions must follow.

---

## Contribution Protocol

### 1. Fork the Repository

Click **Fork** on [mianjunaid1223/venesa-plugins](https://github.com/mianjunaid1223/venesa-plugins) to create your personal copy.

### 2. Add Your Capability File at Root

Add a single `.js` file directly at the **root** of the repository.

**No folders. No sub-directories. Root only.**

### 3. File Name Format

```
<capability-name>.js
```

Use lowercase, hyphen-separated names that describe what the capability does.

**Valid examples:**
```
weather.js
filesystem.js
web-search.js
screenshot.js
send-email.js
github-issues.js
```

**Invalid examples:**
```
MyPlugin.js          ❌  (uppercase)
my_plugin.js         ❌  (underscores)
plugins/weather.js   ❌  (nested in folder)
weather/index.js     ❌  (folder structure)
```

### 4. Submit a Pull Request

Open a Pull Request from your fork targeting the `main` branch of this repository. Include a brief description of what your capability does.

---

## Capability File Requirements

Every capability file must export a valid object using `module.exports`. The object must include:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Unique identifier for the capability |
| `description` | `string` | ✅ | Human-readable description of what it does |
| `version` | `string` | ✅ | Semantic version (e.g. `"1.0.0"`) |
| `handler` | `async function` | ✅ | The execution entry point |
| `schema` | `zod object` | recommended | Input validation schema |
| `returnType` | `string` | recommended | One of: `data`, `action`, `ui`, `memory`, `hybrid` |
| `tags` | `string[]` | optional | Categorization tags |
| `ui` | `string` | optional | Render hint: `table`, `key-value`, `card-list`, `command-list` |
| `marker` | `string` | optional | Visibility: `silently`, `announce`, `confirm` |
| `enabled` | `boolean` | optional | Whether enabled by default (defaults to `true`) |

### Minimal Valid Structure

```javascript
module.exports = {
  name: "my-capability",
  description: "What this capability does",
  version: "1.0.0",

  async handler(params, context) {
    // your logic here
    return result;
  }
};
```

### Recommended Full Structure

```javascript
const { z } = require('zod');

module.exports = {
  name: "my-capability",
  description: "What this capability does",
  version: "1.0.0",
  returnType: "data",
  tags: ["category", "keyword"],
  ui: "key-value",
  marker: "announce",

  schema: z.object({
    query: z.string().optional(),
  }),

  async handler(params, context) {
    // your logic here
    return result;
  }
};
```

---

## Rules

All submissions must follow these rules to be accepted:

- **No folders** — capability file must be at repository root
- **No bundled dependencies** — use Node.js built-ins or packages already available in the Venesa runtime
- **No malicious execution** — no code that harms users, exfiltrates data, or executes unsolicited system commands
- **No side effects during import** — the module must not execute logic when `require()`'d; all execution must be inside `handler`
- **Metadata required** — `name`, `description`, and `version` fields are mandatory inside the export
- **One capability per file** — do not bundle multiple capabilities in a single file
- **Async handler** — the `handler` function must be declared `async`

---

## Review Process

Submitted pull requests go through the following:

1. Automated structure validation (file at root, `.js` extension, valid export shape)
2. Manual review for security and policy compliance
3. Approval by at least 1 maintainer
4. Merge into `main` — capability is immediately discoverable by Venesa

---

## Questions

Open an [issue](https://github.com/mianjunaid1223/venesa-plugins/issues) or start a [discussion](https://github.com/mianjunaid1223/venesa-plugins/discussions) if you have questions about the contribution process.
