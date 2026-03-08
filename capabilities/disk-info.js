"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: disk-info
 *  Get disk usage information.
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
  name: "getDiskInfo",
  description:
    "Shows all fixed drives (C:, D:, etc...) with total size, free space in GB, and usage percentage. Use when the user asks about disk space, storage capacity, how full a drive is, or whether they have enough space.",
  tags: ["system", "disk", "storage"],
  returnType: "data",
  marker: "silently",
  ui: "key-value",

  examples: [
    { user: "how much disk space do I have", action: "[action: getDiskInfo]" },
  ],

  async handler() {
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
Select-Object DeviceID,
  @{N='SizeGB';E={[math]::round($_.Size/1GB,1)}},
  @{N='FreeGB';E={[math]::round($_.FreeSpace/1GB,1)}},
  @{N='UsedPercent';E={if($_.Size -gt 0){[math]::round((($_.Size-$_.FreeSpace)/$_.Size)*100,1)}else{0}}}) |
ConvertTo-Json -Compress
`;
    try {
      const raw = await runPowerShell(psScript, 10000);
      return { success: true, result: JSON.parse(raw) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
