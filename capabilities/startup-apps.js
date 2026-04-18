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

module.exports = {
  name: "getStartupApps",
  description:
    "Lists apps configured to run at Windows startup from registry and startup folders. Use when the user asks what launches on boot or wants startup troubleshooting.",
  returnType: "data",
  marker: "silently",
  ui: "table",
  tags: ["startup", "apps", "system"],

  schema: z.object({}),

  examples: [
    { user: "what starts when windows boots", action: "[action: getStartupApps]" },
  ],

  async handler() {
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$items = @()

$runKeys = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
)

foreach ($key in $runKeys) {
  if (Test-Path $key) {
    $props = Get-ItemProperty -Path $key
    foreach ($prop in $props.PSObject.Properties) {
      if ($prop.Name -notmatch '^PS') {
        $items += [pscustomobject]@{
          source = $key
          name = $prop.Name
          command = [string]$prop.Value
        }
      }
    }
  }
}

$startupFolders = @(
  "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
  "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp"
)

foreach ($folder in $startupFolders) {
  if (Test-Path -LiteralPath $folder) {
    Get-ChildItem -LiteralPath $folder -ErrorAction SilentlyContinue | ForEach-Object {
      $items += [pscustomobject]@{
        source = $folder
        name = $_.Name
        command = $_.FullName
      }
    }
  }
}

@($items | Sort-Object name -Unique) | ConvertTo-Json -Compress
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
