/**
 * .example-capability.js
 *
 * This file demonstrates the required format for a Venesa community capability.
 * Copy this structure as a starting point for your own capability.
 *
 * RULES:
 *  - One file = one capability
 *  - Place your file at the repository root
 *  - Use lowercase, hyphen-separated file names (e.g. web-search.js)
 *  - Export exactly one object via module.exports
 *  - handler must be async
 *  - No side effects at import time
 */

// Optional: use zod for schema validation (recommended)
// const { z } = require('zod');

module.exports = {
  // ─── Required Fields ───────────────────────────────────────────────────────

  name: "example",
  description: "Example Venesa capability",
  version: "1.0.0",

  /**
   * handler — the execution entry point.
   * @param {object} params   - Validated input parameters
   * @param {object} context  - Venesa runtime context
   * @returns {Promise<any>}  - Result returned to the orchestrator
   */
  async handler(params, context) {
    return "example response";
  },

  // ─── Optional Fields ───────────────────────────────────────────────────────

  // returnType: "data",       // 'data' | 'action' | 'ui' | 'memory' | 'hybrid'
  // tags: ["example"],        // categorization tags
  // enabled: true,            // enabled by default

  // ui: "key-value",          // render hint: 'table' | 'key-value' | 'card-list' | 'command-list'
  // marker: "announce",       // visibility: 'silently' | 'announce' | 'confirm'

  // schema: z.object({
  //   query: z.string().optional(),
  // }),
};
