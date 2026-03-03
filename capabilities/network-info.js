/**
 * ═══════════════════════════════════════════════════════════════
 *  SKILL: get-network-info
 *  Get network adapter and IP address info.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const powershell = require("../src/lib/powershell");
const runPowerShell = (script, args, timeout = 30000) =>
  powershell.execute(script, args || [], timeout);

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
      return await runPowerShell(psScript, [], 10000);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
};
