"use strict";

/**
 * ═══════════════════════════════════════════════════════════════
 *  capability: take-screenshot
 *  Captures the primary display and saves it as a PNG, then
 *  optionally opens the file in a chosen application.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const { execFile } = require("child_process");
const path = require("path");
const os = require("os");

function runPowerShell(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: timeoutMs || 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr.trim() || err.message));
        resolve(stdout.trim());
      },
    );
  });
}

module.exports = {
  name: "takeScreenshot",
  description:
    "Takes a screenshot of the entire desktop and saves it as a PNG file. " +
    "Accepts an optional save path (defaults to the user's desktop folder) and an optional filename " +
    "(defaults to screenshot.png). Optionally opens the saved file in a specified application such as Paint (mspaint). " +
    "Use whenever the user asks to take, capture, or save a screenshot of their screen or desktop.",

  returnType: "action",
  marker: "announce",
  tags: ["screenshot", "capture", "screen", "desktop", "image"],
  enabled: true,

  schema: z.object({
    savePath: z
      .string()
      .optional()
      .describe(
        "Absolute folder path where the screenshot will be saved. Defaults to the user's desktop folder.",
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Filename for the screenshot including extension, e.g. screenshot.png. Defaults to 'screenshot.png'.",
      ),
    openWith: z
      .string()
      .optional()
      .describe(
        "Executable name or path to open the saved screenshot with, e.g. 'mspaint' for Paint, 'explorer' to show in File Explorer. Omit to skip opening.",
      ),
  }),

  examples: [
    {
      user: "take a screenshot of my desktop",
      action: "[action: takeScreenshot]",
    },
    {
      user: "take a screenshot and save it to my Desktop folder",
      action:
        "[action: takeScreenshot, savePath: C:\\Users\\username\\Desktop]",
    },
    {
      user: "take a screenshot and open it in Paint",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
    {
      user: "take a screenshot of my desktop, save it to my Desktop folder, and open it in Paint",
      action:
        "[action: takeScreenshot, savePath: C:\\Users\\username\\Desktop, filename: screenshot.png, openWith: mspaint]",
    },
  ],

  async handler(params) {
    try {
      // Resolve destination path
      const folder =
        params.savePath && params.savePath.trim()
          ? params.savePath.trim()
          : path.join(os.homedir(), "Desktop");

      const filename =
        params.filename && params.filename.trim()
          ? params.filename.trim()
          : "screenshot.png";

      // Ensure the filename has a .png extension
      const safeFilename = filename.endsWith(".png")
        ? filename
        : filename + ".png";

      // Escape the full output path for PowerShell
      const fullPath = path.join(folder, safeFilename);
      const psPath = fullPath.replace(/'/g, "''"); // escape single quotes

      const captureScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$folder = '${folder.replace(/'/g, "''")}'
if (-not (Test-Path $folder)) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

$screen  = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds  = $screen.Bounds
$bitmap  = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g       = [System.Drawing.Graphics]::FromImage($bitmap)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$bitmap.Save('${psPath}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()

if (Test-Path '${psPath}') { Write-Output 'OK' } else { Write-Output 'FAILED' }
`.trim();

      const result = await runPowerShell(captureScript, 20000);

      if (result !== "OK") {
        return {
          success: false,
          error: `Screenshot was not saved to '${fullPath}'. PowerShell reported: ${result}`,
        };
      }

      // Optionally open the file with the requested application
      if (params.openWith && params.openWith.trim()) {
        const app = params.openWith.trim();
        const openScript = `Start-Process -FilePath '${app.replace(/'/g, "''")}' -ArgumentList '"${psPath}"'`;
        await runPowerShell(openScript, 10000);
      }

      return {
        success: true,
        message: params.openWith
          ? `Screenshot saved to '${fullPath}' and opened in ${params.openWith}.`
          : `Screenshot saved to '${fullPath}'.`,
        path: fullPath,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
