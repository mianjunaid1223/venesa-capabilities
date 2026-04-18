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
  name: "getRecentFiles",
  description:
    "Lists recently modified files in a folder. Use when the user asks for latest files in Documents, Downloads, Desktop, or a custom path.",
  returnType: "data",
  marker: "silently",
  ui: "table",
  tags: ["files", "recent", "productivity"],

  schema: z.object({
    folder: z
      .string()
      .optional()
      .describe("Target folder path. Supports tokens like {{user.documents}}, {{user.downloads}}, or {{user.desktop}}."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of files to return."),
  }),

  examples: [
    { user: "show my latest documents", action: "[action: getRecentFiles]" },
  ],

  async handler(params) {
    const folder = (params.folder || "{{user.documents}}").trim();
    const limit = Number(params.limit || 20);

    const psScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$target = '${escapeSingleQuotes(folder)}'
$max = ${Number.isFinite(limit) ? limit : 20}

if (-not (Test-Path -LiteralPath $target)) {
  @{ success = $false; error = "Folder not found: $target" } | ConvertTo-Json -Compress
  exit 0
}

$items = Get-ChildItem -LiteralPath $target -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First $max @{
    N = 'name'; E = { $_.Name }
  }, @{
    N = 'path'; E = { $_.FullName }
  }, @{
    N = 'sizeKB'; E = { [Math]::Round($_.Length / 1KB, 2) }
  }, @{
    N = 'modifiedAt'; E = { $_.LastWriteTime }
  }

@($items) | ConvertTo-Json -Compress
`;

    try {
      const raw = await runPowerShell(psScript, 30000);
      const parsed = JSON.parse(raw);

      if (parsed && parsed.success === false && parsed.error) {
        return { success: false, error: parsed.error };
      }

      return { success: true, result: Array.isArray(parsed) ? parsed : parsed ? [parsed] : [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
