"use strict";

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

function escapeSingleQuotes(value) {
  return String(value || "").replace(/'/g, "''");
}

module.exports = {
  name: "getServiceStatus",
  description:
    "Checks Windows service status and returns matching services. Use when the user asks whether a service is running, stopped, or wants a quick service list.",
  returnType: "data",
  marker: "silently",
  ui: "table",
  tags: ["services", "windows", "system"],

  schema: z.object({
    serviceName: z
      .string()
      .optional()
      .describe("Optional service name or display name filter, for example 'Spooler' or 'Windows Update'."),
    state: z
      .enum(["all", "running", "stopped"])
      .default("all")
      .describe("Filter services by status."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of services to return."),
  }),

  examples: [
    { user: "is print spooler running", action: "[action: getServiceStatus serviceName='Spooler']" },
  ],

  async handler(params) {
    const serviceName = (params.serviceName || "").trim();
    const state = params.state || "all";
    const limit = Number(params.limit || 50);

    const nameFilter = escapeSingleQuotes(serviceName);

    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$services = Get-Service | Select-Object Name, DisplayName, Status

if ('${state}' -eq 'running') {
  $services = $services | Where-Object { $_.Status -eq 'Running' }
} elseif ('${state}' -eq 'stopped') {
  $services = $services | Where-Object { $_.Status -eq 'Stopped' }
}

if ('${nameFilter}' -ne '') {
  $needle = '${nameFilter}'
  $services = $services | Where-Object {
    $_.Name -like "*$needle*" -or $_.DisplayName -like "*$needle*"
  }
}

@($services | Sort-Object DisplayName | Select-Object -First ${Number.isFinite(limit) ? limit : 50}) | ConvertTo-Json -Compress
`;

    try {
      const raw = await runPowerShell(psScript, 30000);
      const parsed = JSON.parse(raw);
      return { success: true, result: Array.isArray(parsed) ? parsed : parsed ? [parsed] : [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
