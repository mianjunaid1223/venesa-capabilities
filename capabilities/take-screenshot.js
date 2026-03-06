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
    "Takes a full-desktop screenshot and saves it as a PNG file, then optionally opens it in an application. Use when the user asks to capture, take, or save a screenshot of their screen. Accepts an optional save folder (defaults to Desktop), filename, and app to open the file with.",

  returnType: "action",
  marker: "announce",
  tags: ["screenshot", "capture", "screen", "image"],
  schema: z.object({
    savePath: z
      .string()
      .default("{{user.desktop}}")
      .describe(
        "Folder path to save the screenshot. Defaults to {{user.desktop}}. Supports tokens: {{user.desktop}}, {{user.documents}}, {{user.downloads}}, {{user.pictures}}.",
      ),
    filename: z
      .string()
      .optional()
      .describe("Filename including .png extension. Defaults to 'screenshot.png'."),
    openWith: z
      .string()
      .optional()
      .describe(
        "App to open the saved file with. Use 'default' for the system default image viewer, or a specific executable name like 'mspaint'. Omit entirely if the user did not ask to open the file.",
      ),
  }),

  examples: [
    {
      user: "take a screenshot",
      action: "[action: takeScreenshot]",
    },
    {
      user: "capture my screen",
      action: "[action: takeScreenshot]",
    },
    {
      user: "take a screenshot and open it",
      action: "[action: takeScreenshot, openWith: default]",
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
      user: "take a screenshot and save it to my desktop",
      action: "[action: takeScreenshot]",
    },
    {
      user: "take a screenshot, save it to my desktop and open it in Paint",
      action: "[action: takeScreenshot, openWith: mspaint]",
    },
    {
      user: "take a screenshot and save it to my Documents folder",
      action: "[action: takeScreenshot, savePath: {{user.documents}}]",
    },
    {
      user: "take a screenshot and save it to my Documents folder and open it in Paint",
      action: "[action: takeScreenshot, savePath: {{user.documents}}, openWith: mspaint]",
    },
    {
      user: "take a screenshot and save it to my downloads folder",
      action: "[action: takeScreenshot, savePath: {{user.downloads}}]",
    },
    {
      user: "take a screenshot and save it to my pictures",
      action: "[action: takeScreenshot, savePath: {{user.pictures}}]",
    },
  ],

  async handler(params) {
    try {
      const folder = params.savePath.trim();

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

      const openWith = params.openWith && params.openWith.trim()
        ? params.openWith.trim()
        : null;

      let message = `Screenshot saved to '${fullPath}'.`;

      if (openWith) {
        // Escape fullPath for PowerShell single-quoted string (double each ')
        const psFullPath = fullPath.replace(/'/g, "''");
        // Escape openWith for PowerShell double-quoted string (backtick then quote)
        const psOpenWith = openWith.replace(/`/g, "``").replace(/"/g, '`"');

        const openScript = openWith === "default"
          ? `Start-Process '${psFullPath}'`
          : `Start-Process -FilePath "${psOpenWith}" -ArgumentList '"${psFullPath.replace(/"/g, '`"')}"'`;

        try {
          await runPowerShellFile(openScript, 10000);
          const appLabel = openWith === "default" ? "the default image viewer"
            : openWith === "mspaint" ? "Microsoft Paint"
            : openWith;
          message = `Screenshot saved to '${fullPath}' and opened in ${appLabel}.`;
        } catch (openErr) {
          return {
            success: false,
            error: `Screenshot was saved to '${fullPath}' but could not be opened with '${openWith}': ${openErr.message}`,
            path: fullPath,
          };
        }
      }

      return {
        success: true,
        message,
        path: fullPath,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};
