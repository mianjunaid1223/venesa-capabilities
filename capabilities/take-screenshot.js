/**
 * ═══════════════════════════════════════════════════════════════
 *  SKILL: take-screenshot
 *  Capture screen, save to a configurable path, open with any app.
 * ═══════════════════════════════════════════════════════════════
 */

const { z } = require("zod");
const path = require("path");
const fs = require("fs");
const {
  HOME_DIR,
  runPowerShell,
  escapeForPowerShell,
  logger,
} = require("./_shared");

// Normalise openWith aliases to a stable executable/command name
function resolveOpenWith(raw) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "default") return "default";
  if (
    v === "code" ||
    v === "vscode" ||
    v === "vs code" ||
    v === "visual studio code"
  )
    return "code";
  if (v === "mspaint" || v === "paint" || v === "ms paint") return "mspaint";
  if (v === "notepad") return "notepad";
  if (v === "photos" || v === "microsoft photos") return "ms-photos:";
  return raw.trim(); // pass through as-is
}

module.exports = {
  schema: z.object({
    savePath: z
      .string()
      .optional()
      .describe(
        "Directory to save the screenshot. Defaults to ~/Pictures/Screenshots. Use {{user.desktop}} for Desktop.",
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Filename for the screenshot (include .png). Defaults to screenshot_<timestamp>.png.",
      ),
    openWith: z
      .string()
      .optional()
      .describe(
        "App to open the file after saving. Use: default | code | mspaint | notepad | or any executable name.",
      ),
  }),
  name: "takeScreenshot",
  description:
    "Take a full-screen screenshot. Can save to any path (default: ~/Pictures/Screenshots), use a custom filename, and open the result with any application, based on what user wants",
  tags: ["screen", "screenshot", "capture"],

  returnType: "action",
  marker: "announce",
  ui: null,

  examples: [
    { user: "take a screenshot", action: "[action: takeScreenshot]" },
    {
      user: "capture my screen and save to desktop",
      action: "[action: takeScreenshot, savePath: {{user.desktop}}]",
    },
    {
      user: "take a screenshot and open it in VS Code",
      action:
        "[action: takeScreenshot, savePath: {{user.desktop}}, filename: screenshot.png, openWith: code]",
    },
    {
      user: "screenshot and open with paint",
      action:
        "[action: takeScreenshot, savePath: {{user.desktop}}, openWith: mspaint]",
    },
    {
      user: "take a screenshot and open it with the default app",
      action:
        "[action: takeScreenshot, savePath: {{user.desktop}}, openWith: default]",
    },
  ],

  async handler(params) {
    const saveDir =
      params && params.savePath
        ? params.savePath
        : path.join(HOME_DIR, "Pictures", "Screenshots");

    const filename =
      params && params.filename
        ? params.filename
        : `screenshot_${Date.now()}.png`;

    try {
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
    } catch (err) {
      logger.error(
        `[screenshot] Failed to create directory ${saveDir}: ${err?.message ?? String(err)}`,
      );
      return JSON.stringify({
        error: `Failed to create screenshot directory: ${err?.message ?? String(err)}`,
      });
    }

    const screenshotPath = path.join(saveDir, filename);
    const openWith = resolveOpenWith(params && params.openWith);

    // Delay 300ms so voice overlay isn't captured
    await new Promise((r) => setTimeout(r, 300));

    const psScript = `
param($SafePath)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$left   = [System.Windows.Forms.SystemInformation]::VirtualScreen.Left
$top    = [System.Windows.Forms.SystemInformation]::VirtualScreen.Top
$width  = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
$height = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($left, $top, 0, 0, (New-Object System.Drawing.Size($width, $height)))

$bitmap.Save($SafePath, [System.Drawing.Imaging.ImageFormat]::Png)

# Copy to clipboard via STA thread (Clipboard requires STA)
# Clone the bitmap so the thread owns a separate copy and we can safely
# dispose the original after saving without racing the clipboard write.
$clipSuccess = $false
try {
    $bitmapClone = $bitmap.Clone()
    $thread = New-Object System.Threading.Thread([System.Threading.ThreadStart]{
        try {
            [System.Windows.Forms.Clipboard]::SetImage($bitmapClone)
            $script:clipSuccess = $true
            $bitmapClone.Dispose()
        } catch {
            $script:clipSuccess = $false
            try { $bitmapClone.Dispose() } catch { }
        }
    })
    $thread.SetApartmentState([System.Threading.ApartmentState]::STA)
    $thread.Start()
    $joined = $thread.Join(5000)
    if (-not $joined) { $clipSuccess = $false }
} catch {
    $clipSuccess = $false
}

# The original bitmap and graphics can be disposed immediately since
# the thread works on a clone ($bitmapClone) that it disposes itself.
$graphics.Dispose()
$bitmap.Dispose()

@{ success = $true; path = $SafePath; clipboard = $clipSuccess } | ConvertTo-Json -Compress
`;

    // Build optional open-with script fragment
    let openScript = "";
    if (openWith) {
      const safeApp = escapeForPowerShell(openWith);
      if (openWith === "default") {
        openScript = `\nInvoke-Item $SafePath`;
      } else if (openWith === "ms-photos:") {
        // Microsoft Photos uses a URI protocol
        openScript = `\nStart-Process ('ms-photos:' + $SafePath)`;
      } else {
        openScript = `\nStart-Process '${safeApp}' -ArgumentList $SafePath`;
      }
    }

    const fullScript = psScript + openScript;

    try {
      return await runPowerShell(fullScript, [screenshotPath], 15000);
    } catch (e) {
      return JSON.stringify({ error: e?.message ?? String(e) });
    }
  },
};
