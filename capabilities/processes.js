"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: processes
 *  List top 10 CPU-heavy processes.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const { execFile } = require("child_process");

function runPowerShell(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: timeoutMs || 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      }
    );
  });
}

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
      const raw = await runPowerShell(
        "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 -Property Id, ProcessName, CPU, WorkingSet | ConvertTo-Json -Compress",
        15000
      );
      if (!raw || !raw.trim()) {
        return { success: false, error: "PowerShell returned no output", raw };
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        return { success: false, error: `Failed to parse PowerShell output: ${parseErr.message}`, raw };
      }
      return { success: true, result: parsed };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
