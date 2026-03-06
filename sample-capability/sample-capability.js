"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  Venesa Sample Capability
 *
 *  Use this file as a reference when building a new capability.
 *  Copy it, rename it, and edit the fields below.
 *
 *  CAPABILITY STANDARD SCHEMA (Unified Protocol):
 *   - name:         string     — unique camelCase ID used by the AI as a tool name
 *   - description:  string     — injected verbatim into the AI system prompt
 *   - returnType:   string     — 'data'|'action'|'ui'|'memory'|'hybrid'  (REQUIRED)
 *   - marker:       string     — 'silently'|'announce'|'confirm'          (optional)
 *   - ui:           string     — 'table'|'key-value'|'card-list'|'command-list' (optional)
 *   - tags:         string[]   — discovery tags for the community browser  (optional)
 *   - schema:       ZodObject  — parameter validation schema               (REQUIRED)
 *   - handler:      async fn   — async (params) => result                  (REQUIRED)
 *   - dependencies: string[]   — exact npm specifiers, e.g. 'axios@1.9.0' (optional)
 *   - lifecycle:    object     — onLoad / onUnload / onEnable / onDisable  (optional)
 *
 *  DEP ENGINE: declare npm packages via `dependencies`. Exact versions only — no ranges.
 *    dependencies: ['axios@1.9.0']
 *    Then simply: const axios = require('axios') inside the handler.
 *
 *  TOKEN SYSTEM: The platform resolves {{token}} placeholders in all string params
 *  before the handler runs. Document supported tokens in .describe() so the LLM
 *  knows what to pass. Never call os.homedir() or process.env yourself.
 *    {{user.home}}       — User home directory
 *    {{user.desktop}}    — Desktop folder
 *    {{user.downloads}}  — Downloads folder
 *    {{user.documents}}  — Documents folder
 *    {{user.name}}       — User profile name
 *    {{clipboard.text}}  — Current clipboard text
 *    {{system.date}}     — Current local date
 *    {{system.time}}     — Current local time
 *    {{runtime.temp}}    — System temp directory
 *    {{system.hostname}} — Machine hostname
 *    {{env.KEY_NAME}}    — Custom key from Settings → Custom Keys (use for secrets)
 *
 *  NET GUARD: if your handler makes any HTTP call, detect offline errors in catch:
 *    const isOffline = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' ||
 *                      err.code === 'ETIMEDOUT'  || err.code === 'ERR_NETWORK'  ||
 *                      err.message?.toLowerCase().includes('network');
 *    if (isOffline) return { success: false, error: 'No internet connection. Please check your connection and try again.' };
 *
 *  Hard rules:
 *   - "use strict" at top.
 *   - CommonJS only. No import/export.
 *   - module.exports is a single object literal. No factory functions or classes.
 *   - No executable code at import time — everything runs inside handler.
 *   - Every handler wrapped in try/catch. Never throw.
 *   - Success: return { success: true, result: <value> }
 *   - Failure: return { success: false, error: err.message }
 *   - No console.log, console.warn, or console.error.
 *   - No ranges in dependencies (no ^, ~, >=, *).
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");

module.exports = {
  name: "sampleCapability",
  description:
    "Returns a custom greeting and a sample data table. Use only when the user explicitly asks to test the sample capability.",

  returnType: "data",
  marker: "silently",
  ui: "table",
  tags: ["sample", "demo"],

  schema: z.object({
    query: z.string().optional().describe("Optional input text to echo back in the greeting."),
  }),

  examples: [
    { user: "test the table capability", action: "[action: sampleCapability]" },
  ],

  async handler(params) {
    try {
      const raw = params.query || "";
      const query = raw.replace(/[<>&"']/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c])
      );

      return {
        success: true,
        result: {
          greeting: `Hello from the sample capability! You said: "${query || "Nothing"}"`,
          data: [
            { id: 1, name: "Sample Item A", status: "Active", value: 100 },
            { id: 2, name: "Sample Item B", status: "Inactive", value: 0 },
            { id: 3, name: query || "Dynamic Entry", status: "Pending", value: 42 },
          ],
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
