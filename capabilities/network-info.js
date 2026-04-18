"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: network-info
 *  Get network adapter and IP address info.
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
  name: "getNetworkInfo",
  description:
    "Returns all active network adapters and their IPv4 addresses. Use when the user asks for their IP address, which network or adapter they are connected to, their network speed, or wants to see connection details.",
  tags: ["system", "network", "wifi"],

  returnType: "data",
  marker: "silently",
  ui: "key-value",

  examples: [
    { user: "show my network info", action: "[action: getNetworkInfo]" },
  ],

  async handler() {
    const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$adapters = @()
$ipConfig = @()
$errors = @()
try {
    $adapters = @(Get-NetAdapter -ErrorAction Stop | Where-Object { $_.Status -eq 'Up' } | Select-Object Name, InterfaceDescription, Status, LinkSpeed)
} catch {
    $errors += "Get-NetAdapter: $($_.Exception.Message)"
}
try {
    $ipConfig = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object IPAddress, InterfaceAlias)
} catch {
    $errors += "Get-NetIPAddress: $($_.Exception.Message)"
}
@{
    adapters = $adapters
    ip = $ipConfig
    diagnostics = if ($errors.Count -gt 0) { $errors } else { $null }
} | ConvertTo-Json -Compress -Depth 3
`;
    try {
      const raw = await runPowerShell(psScript, 10000);
      return { success: true, result: JSON.parse(raw) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
