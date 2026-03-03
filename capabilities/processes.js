/**
 * ═══════════════════════════════════════════════════════════════
 *  SKILL: list-processes
 *  List top 10 CPU-heavy processes.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const powershell = require("../src/lib/powershell");
const runPowerShell = (script, args, timeout = 30000) =>
  powershell.execute(script, args || [], timeout);

module.exports = {
  schema: z.object({}),
  name: "listProcesses",
  description:
    "Lists the top 10 processes consuming the most CPU, showing process ID, name, CPU time, and memory usage in bytes. Use when the user asks what is slowing the PC down, which processes are running, what is consuming CPU, or wants to identify resource hogs.",
  tags: ["system", "processes"],

  returnType: "data",
  marker: "silently",
  ui: "table",

  examples: [
    {
      user: "what processes are using the most CPU",
      action: "[action: listProcesses]",
    },
  ],

  async handler() {
    try {
      return await runPowerShell(
        "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 -Property Id, ProcessName, CPU, WorkingSet | ConvertTo-Json -Compress",
      );
    } catch (e) {
      const normalizedError = e && e.message
        ? e.message
        : typeof e === 'string'
          ? e
          : String(e);
      return JSON.stringify({ success: false, error: normalizedError });
    }
  },
};
