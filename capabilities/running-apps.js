/**
 * ═══════════════════════════════════════════════════════════════
 *  SKILL: list-running-apps
 *  List currently running visible applications.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const powershell = require("../src/lib/powershell");
const runPowerShell = (script, args, timeout = 30000) =>
  powershell.execute(script, args || [], timeout);

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
      return await runPowerShell(psScript, [], 10000);
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};
