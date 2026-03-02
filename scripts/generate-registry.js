#!/usr/bin/env node
/**
 * scripts/generate-registry.js
 *
 * Scans all capability files, evaluates their exports in a sandbox,
 * and writes registry.json with full metadata + raw download URLs.
 *
 * Version management (self-contained in registry.json):
 *   - New capabilities start at "1.0.0".
 *   - If a capability's file content changes, the patch version is bumped automatically.
 *   - If the capability itself exports an explicit version string it overrides auto-versioning
 *     AND is stored so the next run keeps it unless the file changes again.
 *   - Version history is tracked inside registry.json itself — no separate versions.json.
 *
 * Duplicate-name guard:
 *   - Two capability files that export the same `name` are an error.
 *     The script prints both file paths and exits with code 1.
 *
 * Run locally:   node scripts/generate-registry.js
 * Run in CI:     triggered automatically by GitHub Actions on every push to main.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// ─── Configuration ─────────────────────────────────────────────────────────────

const REPO =
  process.env.GITHUB_REPOSITORY || "mianjunaid1223/venesa-capabilities";
const BRANCH = process.env.GITHUB_REF_NAME || "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const ROOT = path.resolve(__dirname, "..");

/**
 * Directories to scan, in order of priority.
 * prefix = the repo-relative path prefix used in URLs.
 */
const SCAN_DIRS = [
  { dir: "capabilities", prefix: "capabilities" },
  { dir: ".", prefix: "" }, // root-level community files
];

/** Root-level files that are infrastructure, not capabilities. */
const SKIP_ROOT = new Set(["generate-registry.js", ".example-capability.js"]);

/** Path to registry.json (source of truth for version history). */
const REGISTRY_PATH = path.join(ROOT, "registry.json");

// ─── Version ledger helpers ───────────────────────────────────────────────────

/**
 * Load the previous registry.json (or empty structure if absent).
 */
function loadPrevRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    return { capabilities: [] };
  }
}

/**
 * Build a version ledger from the previously generated registry.json.
 * Shape: { [capabilityName]: { version: string, hash: string } }
 */
function loadLedgerFromRegistry(prev) {
  const ledger = {};
  for (const cap of prev.capabilities ?? []) {
    if (cap.name && cap.version && cap.hash) {
      ledger[cap.name] = { version: cap.version, hash: cap.hash };
    }
  }
  return ledger;
}

/** Compute the SHA-256 hash of a file's content (hex, first 16 chars). */
function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
}

/** Bump the patch segment of a semver string: "1.0.0" → "1.0.1". */
function bumpPatch(version) {
  const parts = String(version).split(".");
  while (parts.length < 3) parts.push("0");
  parts[2] = String(Number(parts[2]) + 1);
  return parts.join(".");
}

/**
 * Resolve the version for a capability.
 *
 * Rules (in order):
 *  1. If the exported meta has an explicit, non-null version string, honour it.
 *  2. If this is a known capability whose file hasn't changed, keep the stored version.
 *  3. If this is a known capability whose file HAS changed, bump the patch.
 *  4. If this is a brand-new capability, start at "1.0.0".
 *
 * Returns { version: string, entry: { version, hash } } — the caller should
 * store `entry` back into the ledger.
 */
function resolveVersion(name, filePath, exportedVersion, ledger) {
  const hash = fileHash(filePath);
  const stored = ledger[name];

  let version;
  if (exportedVersion) {
    // Explicit version in the file wins.
    version = exportedVersion;
  } else if (!stored) {
    // Brand-new capability.
    version = "1.0.0";
  } else if (stored.hash !== hash) {
    // File changed → bump patch.
    version = bumpPatch(stored.version);
  } else {
    // Unchanged — keep the stored version.
    version = stored.version;
  }

  return { version, entry: { version, hash } };
}

// ─── Chainable proxy ──────────────────────────────────────────────────────────
// Used to mock zod, electron, powershell and any other require() call so the
// capability files can be evaluated in a sandbox without real dependencies.

function createChain() {
  const fn = function () {
    return createChain();
  };
  return new Proxy(fn, {
    get(_, prop) {
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "then") return undefined; // not a thenable/Promise
      if (prop === "toJSON") return () => null;
      return createChain();
    },
    apply() {
      return createChain();
    },
    construct() {
      return createChain();
    },
    set() {
      return true;
    },
  });
}

function mockRequire(id) {
  // zod — expose a z object where every method is chainable
  if (id === "zod") {
    return { z: new Proxy({}, { get: () => createChain() }) };
  }
  // everything else (electron, powershell, logger, memory, …)
  return createChain();
}

// ─── Evaluate a capability file in a VM sandbox ───────────────────────────────

function evalCapability(filePath) {
  let code;
  try {
    code = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.warn(`   Cannot read ${filePath}: ${e.message}`);
    return null;
  }

  const mod = { exports: {} };

  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: mockRequire,
    __filename: filePath,
    __dirname: path.dirname(filePath),
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
  };

  try {
    vm.runInNewContext(code, sandbox, {
      filename: filePath,
      timeout: 5000,
    });
    return mod.exports;
  } catch (e) {
    console.warn(
      `  ⚠  Sandbox error in ${path.basename(filePath)}: ${e.message}`,
    );
    return null;
  }
}

// ─── Extract only serialisable metadata ───────────────────────────────────────

function extractMeta(exp) {
  if (!exp || typeof exp !== "object") return null;

  const str = (v) => (typeof v === "string" ? v : null);
  const bool = (v) => (typeof v === "boolean" ? v : true);
  const arr = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

  const name = str(exp.name);
  if (!name) return null; // name is the minimum required field

  const examples = Array.isArray(exp.examples)
    ? exp.examples.filter(
        (e) => e && typeof e === "object" && typeof e.user === "string",
      )
    : [];

  return {
    name,
    description: str(exp.description) ?? "",
    version: str(exp.version) ?? null,
    returnType: str(exp.returnType) ?? null,
    tags: arr(exp.tags),
    ui: str(exp.ui) ?? null,
    marker: str(exp.marker) ?? null,
    enabled: bool(exp.enabled),
    examples,
  };
}

// ─── Scan directories ─────────────────────────────────────────────────────────

console.log(`\n🔍  Scanning capabilities in: ${ROOT}\n`);

const capabilities = [];
const seenFiles = new Set(); // deduplicate by filename (capabilities/ wins over root)
const seenNames = new Map(); // name → relPath — used to detect duplicate names

// Load previous registry once — used for version ledger and change detection.
const prevRegistry = loadPrevRegistry();
const prevCapMap = new Map(
  (prevRegistry.capabilities ?? []).map((c) => [c.name, c]),
);
const ledger = loadLedgerFromRegistry(prevRegistry);

for (const { dir, prefix } of SCAN_DIRS) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) continue;

  const entries = fs
    .readdirSync(dirPath)
    .filter((f) => {
      if (!f.endsWith(".js")) return false;
      if (f.startsWith(".") || f.startsWith("_")) return false; // hidden/private
      if (dir === "." && SKIP_ROOT.has(f)) return false;
      if (dir === "." && f === path.basename(__filename)) return false;
      try {
        if (fs.statSync(path.join(dirPath, f)).isDirectory()) return false;
      } catch {
        return false;
      }
      return true;
    })
    .sort();

  for (const file of entries) {
    if (seenFiles.has(file)) continue; // already indexed from a higher-priority dir
    seenFiles.add(file);

    const filePath = path.join(dirPath, file);
    const relPath = prefix ? `${prefix}/${file}` : file;

    process.stdout.write(`  Processing ${relPath} … `);

    const exported = evalCapability(filePath);
    if (!exported) continue;

    const meta = extractMeta(exported);
    if (!meta) {
      console.log("skipped (no name field)");
      continue;
    }

    // ── Duplicate-name guard ──────────────────────────────────────────────────
    if (seenNames.has(meta.name)) {
      const firstPath = seenNames.get(meta.name);
      console.error(
        `\n\n❌  Duplicate capability name detected: "${meta.name}"\n` +
        `       First  : ${firstPath}\n` +
        `       Second : ${relPath}\n\n` +
        `   Each capability must have a unique name.\n` +
        `   Rename one of them and re-run the script.\n`,
      );
      process.exit(1);
    }
    seenNames.set(meta.name, relPath);

    // ── Auto-version ──────────────────────────────────────────────────────────
    const { version, entry } = resolveVersion(
      meta.name,
      filePath,
      meta.version,   // may be null
      ledger,
    );

    const wasNull = meta.version === null;
    meta.version = version;

    // Detect metadata changes for logging
    const prevCap = prevCapMap.get(meta.name) ?? null;

    const changedFields = [];
    if (prevCap) {
      for (const key of ["description", "returnType", "ui", "marker", "enabled"]) {
        if (JSON.stringify(prevCap[key]) !== JSON.stringify(meta[key])) {
          changedFields.push(key);
        }
      }
      if (JSON.stringify(prevCap.tags) !== JSON.stringify(meta.tags)) changedFields.push("tags");
      if (JSON.stringify(prevCap.examples) !== JSON.stringify(meta.examples)) changedFields.push("examples");
    }

    const metaNote = changedFields.length ? `  [updated: ${changedFields.join(", ")}]` : "";
    if (wasNull) {
      console.log(`✓  ${meta.name}  (version → ${version})${metaNote}`);
    } else {
      console.log(`✓  ${meta.name}  (version ${version})${metaNote}`);
    }

    capabilities.push({
      ...meta,
      hash: entry.hash,
      file: file,
      path: relPath,
      url: `${RAW_BASE}/${relPath}`,
    });
  }
}

// ─── Write registry.json and versions.json ────────────────────────────────────

const registry = {
  generated: new Date().toISOString(),
  repository: REPO,
  branch: BRANCH,
  rawBase: RAW_BASE,
  count: capabilities.length,
  capabilities,
};

fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf8");

console.log(
  `\n✅  registry.json written — ${capabilities.length} capabilities indexed.`,
);
console.log(`    ${REGISTRY_PATH}\n`);
