"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: wifi-passwords
 *  Retrieve saved WiFi network passwords.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require('zod');
const { execFile } = require('child_process');

function runPowerShell(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: timeoutMs || 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      }
    );
  });
}

module.exports = {
    name: 'wifiPasswords',
    description: 'Retrieves saved WiFi network credentials stored on this Windows PC. Without a network name, returns a list of all saved networks and whether each has a password. With a network name, confirms whether a password is saved for that specific network. Passwords are returned redacted for security. Use when the user asks what WiFi networks are saved, or wants to check a saved network.',
    tags: ['wifi', 'password', 'network', 'internet'],

    returnType: 'data',
    marker: 'confirm',
    ui: 'table',

    schema: z.object({
        networkName: z.string().optional().describe('Specific WiFi network name, or empty for all'),
    }),

    examples: [

        { user: 'show saved wifi passwords', action: '[action: wifiPasswords]' },

    ],


    async handler(params) {
        const { networkName } = params || {};
        const safeName = networkName
            ? networkName.replace(/`/g, '``').replace(/"/g, '`"').replace(/'/g, "''")
            : '';

        const psScript = networkName
            ? `
$NetName = '${safeName}'
$profile = netsh wlan show profile name="$NetName" key=clear 2>&1
$keyLine = ($profile | Where-Object { $_ -match 'Key Content|Contenu de la|Schlüsselinhalt|Contenido de la clave|Clé de sécurité' } | Select-Object -First 1) -replace '.*:\\s*', ''
if (-not $keyLine) {
    $keyLine = 'UNKNOWN'
}
if ($keyLine -and $keyLine -ne 'UNKNOWN') {
    @{ network = $NetName; hasPassword = $true; password = '***REDACTED***' } | ConvertTo-Json -Compress
} else {
    @{ network = $NetName; hasPassword = $false; password = '(could not determine)' } | ConvertTo-Json -Compress
}
`
            : `
$profileLines = netsh wlan show profiles
$profiles = @()
foreach ($line in $profileLines) {
    if ($line -match ':\\s*(.+)$' -and $line -notmatch '^-') {
        $name = $Matches[1].Trim()
        if ($name -and $name.Length -gt 0 -and $name -ne '') {
            $profiles += $name
        }
    }
}
# Filter to actual profile names (skip header lines)
$profiles = $profiles | Where-Object { $_.Length -gt 1 -and $_ -notmatch 'Version|WirelessLAN|Wireless LAN' }

$results = @()
foreach ($p in $profiles) {
    $detail = netsh wlan show profile name="$p" key=clear 2>&1
    $key = ($detail | Where-Object { $_ -match 'Key Content|Contenu de la|Schlüsselinhalt|Contenido de la clave|Clé de sécurité' } | Select-Object -First 1) -replace '.*:\s*', ''
    if (-not $key) { $key = $null }
    $results += @{ network = $p; hasPassword = [bool]$key; password = if ($key) { '***REDACTED***' } else { '(open/enterprise)' } }
}
if ($results.Count -eq 0) {
    '[]'
} elseif ($results.Count -eq 1) {
    '[' + ($results[0] | ConvertTo-Json -Compress) + ']'
} else {
    $results | ConvertTo-Json -Compress
}
`;
        try {
            const timeout = networkName ? 15000 : 30000;
            const raw = await runPowerShell(psScript, timeout);
            return { success: true, result: JSON.parse(raw) };
        } catch (err) {
            return { success: false, error: err?.message ?? String(err) };
        }
    },
};
