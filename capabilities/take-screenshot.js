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
const fs = require("fs");
const path = require("path");
const os = require("os");
const { dependencies } = require("./currency-convert");

function runPowerShellFile(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `venesa_ss_${Date.now()}.ps1`);
    try {
      fs.writeFileSync(tmpFile, script, "utf8");
    } catch (e) {
      return reject(new Error("Could not write temp PS1 file: " + e.message));
    }

    execFile(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        tmpFile,
      ],
      { timeout: timeoutMs || 30000 },
      (err, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}
        if (err) return reject(new Error(stderr.trim() || err.message));
        resolve(stdout.trim());
      },
    );
  });
}

module.exports = {
  name: "takeScreenshot",
  description:
    "Takes a full-desktop screenshot and saves it as a PNG file. " +
    "savePath defaults to the user's Desktop. filename defaults to screenshot.png. " +
    "openWith defaults to 'mspaint' (Microsoft Paint) — always pass openWith: mspaint unless the user says otherwise. " +
    "Use whenever the user asks to take, capture, or save a screenshot of their screen or desktop, " +
    "or asks to open a screenshot in Paint or any other application.",

  returnType: "action",
  marker: "announce",
  tags: ["screenshot", "capture", "screen", "desktop", "image", "paint"],
  enabled: true,
  dependencies: ["zod"],
  schema: z.object({
    savePath: z
      .string()
      .optional()
      .describe(
        "Absolute folder path where the screenshot is saved. Defaults to the user's Desktop.",
      ),
    filename: z
      .string()
      .optional()
      .describe(
        "Filename including .png extension. Defaults to 'screenshot.png'.",
      ),
    openWith: z
      .string()
      .optional()
      .describe(
        "Executable to open the saved file with. Use 'mspaint' for Microsoft Paint. Defaults to 'mspaint'.",
      ),
  }),

  examples: [
    {
      user: "take a screenshot",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
    {
      user: "take a screenshot and open it in Paint",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
    {
      user: "take a screenshot and open it in Microsoft Paint",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
    {
      user: "take a screenshot and save it to my desktop and open it in Paint",
      action:
        "[action: takeScreenshot, savePath: C:\\Users\\username\\Desktop, openWith: mspaint]",
    },
    {
      user: "take a screenshot and save it to my Documents folder and open it in Paint",
      action:
        "[action: takeScreenshot, savePath: C:\\Users\\username\\Documents, openWith: mspaint]",
    },
    {
      user: "capture my screen",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
  ],

  async handler(params) {
    try {
      const folder =
        params.savePath && params.savePath.trim()
          ? params.savePath.trim()
          : path.join(os.homedir(), "Desktop");

      const rawName =
        params.filename && params.filename.trim()
          ? params.filename.trim()
          : "screenshot.png";

      const safeFilename = rawName.toLowerCase().endsWith(".png")
        ? rawName
        : rawName + ".png";

      const fullPath = path.join(folder, safeFilename);

      const captureScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

public class VenesaScreenCapture {
    public static string Capture(string outputPath) {
        try {
            Rectangle bounds = Screen.PrimaryScreen.Bounds;
            using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.CopyFromScreen(bounds.Location, System.Drawing.Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                }
                string dir = System.IO.Path.GetDirectoryName(outputPath);
                if (!System.IO.Directory.Exists(dir)) {
                    System.IO.Directory.CreateDirectory(dir);
                }
                bmp.Save(outputPath, ImageFormat.Png);
            }
            return "OK";
        } catch (Exception ex) {
            return "ERR:" + ex.Message;
        }
    }
}
"@ -ReferencedAssemblies System.Windows.Forms, System.Drawing

$result = [VenesaScreenCapture]::Capture('${fullPath.replace(/'/g, "''")}') 
Write-Output $result
`.trim();

      const result = await runPowerShellFile(captureScript, 25000);

      if (!result.startsWith("OK")) {
        return {
          success: false,
          error: `Screenshot capture failed. Detail: ${result.replace(/^ERR:/, "")}`,
        };
      }

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `Screenshot was reported saved but the file was not found at '${fullPath}'.`,
        };
      }

      const openWith =
        params.openWith && params.openWith.trim()
          ? params.openWith.trim()
          : "mspaint";

      const openScript = `Start-Process -FilePath "${openWith}" -ArgumentList '"${fullPath.replace(/`/g, "``").replace(/"/g, '`"')}"'`;
      await runPowerShellFile(openScript, 10000).catch(() => {});

      const appLabel = openWith === "mspaint" ? "Microsoft Paint" : openWith;

      return {
        success: true,
        message: `Screenshot saved to '${fullPath}' and opened in ${appLabel}.`,
        path: fullPath,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
