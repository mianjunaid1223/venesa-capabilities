"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: running-apps
 *  List currently running visible applications.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const { execFile } = require("child_process");

function runPowerShell(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: timeoutMs || 30000 },
      (err, stdout, stderr) => {
        const out = String(stdout || "").trim();
        if (out) {
          resolve(out);
          return;
        }
        const message = String(stderr || "").trim() || err?.message || "PowerShell command failed";
        reject(new Error(message));
      }
    );
  });
}

module.exports = {
  schema: z.object({}),
  name: "listRunningApps",
  description:
    "Lists all applications with a visible window currently open on the desktop, showing app name, window title, and memory usage in MB. Background services and system processes are excluded. Use when the user asks what apps or windows are open right now.",
  tags: ["system", "apps", "running"],

  returnType: "data",
  marker: "silently",
  ui: "card-list",

  examples: [
    {
      user: "what apps are open right now",
      action: "[action: listRunningApps]",
    },
  ],

  async handler() {
    const psScript = `
$excluded = @('explorer', 'powershell', 'pwsh', 'conhost', 'cmd', 'svchost', 'System', 'Idle', 'dwm')
$r = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $excluded -notcontains $_.ProcessName } |
Select-Object ProcessName, MainWindowTitle, @{N='MemoryMB';E={[math]::round($_.WorkingSet64/1MB,1)}} |
Sort-Object MemoryMB -Descending)
if ($r.Count -eq 0) { '[]' } elseif ($r.Count -eq 1) { '[' + ($r[0] | ConvertTo-Json -Compress) + ']' } else { $r | ConvertTo-Json -Compress }
`;
    try {
      const raw = await runPowerShell(psScript, 10000);
      return { success: true, result: JSON.parse(raw) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
