'use strict';

/**
 * Venesa Sample Capability
 *
 * CAPABILITY STANDARD SCHEMA (Unified Protocol):
 *  - name:         string     — unique camelCase ID used by the AI as a tool name
 *  - description:  string     — shown in Settings and injected into the AI prompt
 *  - returnType:   string     — 'data'|'action'|'ui'|'memory'|'hybrid'  (REQUIRED)
 *  - marker:       string     — 'silently'|'announce'|'confirm'          (optional)
 *  - ui:           string     — 'table'|'key-value'|'card-list'|'command-list' (optional)
 *  - tags:         string[]   — discovery tags for the community browser  (optional)
 *  - schema:       ZodObject  — parameter validation schema               (REQUIRED)
 *  - handler:      async fn   — async (params) => result                  (REQUIRED)
 *  - dependencies: string[]   — exact npm specifiers, e.g. '<dep_name>@1.7.9' (optional)
 *  - lifecycle:    object     — onLoad / onUnload / onEnable / onDisable  (optional)
 *
 * DEP ENGINE: declare npm packages via `dependencies`. Exact versions only — no ranges.
 *   dependencies: ['<dep_name>@1.7.9']
 *   Then simply: const <dep_name> = require('<dep_name>');
 *
 * NET GUARD: if your handler makes any HTTP call, detect offline errors in catch:
 *   const isOffline = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || ...
 *   if (isOffline) return { success: false, error: 'No internet connection. Please check your connection and try again.' };
 *
 * Hard rules:
 *  - CommonJS only. No import/export.
 *  - Every handler wrapped in try/catch. Never throw.
 *  - On error return { success: false, error: string }.
 *  - No console.log.
 *  - No ranges in dependencies.
 */
const { z } = require('zod');

module.exports = {
    name: 'sampleCapability',
    description: 'Returns a custom greeting and a sample data table. ONLY use when the user EXPLICITLY asks to "test the table capability" or "show the sample capability". Do NOT use for general UI questions.',

    returnType: 'data',
    marker: 'silently',
    ui: 'table',
    tags: ['sample', 'demo'],
    enabled: true,

    schema: z.object({
        query: z.string().optional().describe('The user query to demonstrate the capability.'),
        text: z.string().optional().describe('Fallback text input.'),
    }),

    examples: [
        { user: 'test the table capability', action: '[action: sampleCapability]' },
    ],

    async handler(params) {
        try {
            const raw = params.query || params.text || '';
            const query = raw.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

            const data = [
                { id: 1, Name: 'Sample Item A', Status: 'Active', Value: 100 },
                { id: 2, Name: 'Sample Item B', Status: 'Inactive', Value: 0 },
                { id: 3, Name: query || 'Dynamic Entry', Status: 'Pending', Value: 42 },
            ];

            return {
                success: true,
                message: `Hello from the sample capability! You said: "${query || 'Nothing'}"`,
                data,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },
};
