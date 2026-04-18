"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: system-info
 *  Get CPU, RAM, battery, and uptime info.
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
  name: "getSystemInfo",
  description:
    "Reports a real-time snapshot of system health: current CPU load percentage, RAM used vs total in GB, battery charge percentage (or N/A on desktops), and how long the system has been running since last reboot. Use when the user asks how the PC is performing, checks battery level, asks about RAM or CPU usage, or wants a general hardware status summary.",
  tags: ["system", "info", "monitor"],

  returnType: "data",
  marker: "silently",

  examples: [
    { user: "how is my PC doing", action: "[action: getSystemInfo]" },

    { user: "check battery level", action: "[action: getSystemInfo]" },
  ],

  async handler() {
    const psScript = `
$os = Get-CimInstance Win32_OperatingSystem -Property TotalVisibleMemorySize,FreePhysicalMemory,LastBootUpTime,Caption
$cpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -ErrorAction SilentlyContinue -Property PercentProcessorTime | Where-Object { $_.Name -eq '_Total' }
$battery = Get-CimInstance Win32_Battery -Property EstimatedChargeRemaining -ErrorAction SilentlyContinue
@{
    cpu = if ($cpu) { "$($cpu.PercentProcessorTime)%" } else { "N/A" }
    ramUsed = "$([math]::round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 1)) GB"
    ramTotal = "$([math]::round($os.TotalVisibleMemorySize / 1MB, 1)) GB"
    battery = if ($battery) { "$($battery.EstimatedChargeRemaining)%" } else { "N/A" }
    uptime = "$([math]::round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)) hours"
} | ConvertTo-Json -Compress
`;
    try {
      const raw = await runPowerShell(psScript, 15000);
      return { success: true, result: JSON.parse(raw) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
