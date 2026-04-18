"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: installed-apps
 *  List installed applications.
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
  name: "getInstalledApps",
  description:
    "Scans the Windows registry and returns up to 50 installed programs with their name, version, and publisher. Use when the user asks what software is installed, whether a specific program exists on the PC, or wants a list of installed applications.",
  tags: ["system", "apps", "installed"],

  returnType: "data",
  marker: "silently",
  ui: "card-list",

  examples: [
    { user: "what apps are installed", action: "[action: getInstalledApps]" },
  ],

  async handler() {
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$paths = @(
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
@($paths | ForEach-Object { Get-ItemProperty $_ } |
Where-Object { $_.DisplayName -ne $null -and $_.DisplayName -ne '' } |
Select-Object @{N='Name';E={$_.DisplayName}}, @{N='Version';E={$_.DisplayVersion}}, Publisher |
Sort-Object Name -Unique |
Select-Object -First 50) | ConvertTo-Json -Compress
`;
    try {
      const raw = await runPowerShell(psScript, 30000);
      if (!raw || !raw.trim()) return { success: true, result: [] };
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        return { success: false, error: parseErr.message };
      }
      const result = Array.isArray(parsed) ? parsed : [parsed];
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
