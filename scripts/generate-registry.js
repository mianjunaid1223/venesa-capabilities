#!/usr/bin/env node
/**
 * scripts/generate-registry.js
 *
 * Scans all capability files, evaluates their exports in a sandbox,
 * and writes registry.json with full metadata + raw download URLs.
 *
 * Versioning:    Versions are managed automatically.
 *                - New capability  → starts at 1.0.0
 *                - File unchanged  → version is preserved
 *                - File changed    → patch is bumped (e.g. 1.0.3 → 1.0.4)
 *                Capability files do NOT need a `version` field.
 *
 * Duplicate guard: Two capabilities with the same `name` will abort the
 *                  build and print which files conflict.
 *
 * Run locally:   node scripts/generate-registry.js
 * Run in CI:     triggered automatically by GitHub Actions on every push to main.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');

// ─── Configuration ─────────────────────────────────────────────────────────────

const REPO       = process.env.GITHUB_REPOSITORY || 'mianjunaid1223/venesa-capabilities';
const BRANCH     = process.env.GITHUB_REF_NAME   || 'main';
const RAW_BASE   = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const ROOT       = path.resolve(__dirname, '..');

/**
 * Directories to scan, in order of priority.
 * prefix = the repo-relative path prefix used in URLs.
 */
const SCAN_DIRS = [
    { dir: 'capabilities', prefix: 'capabilities' },
    { dir: '.',            prefix: ''             },   // root-level community files
];

/** Root-level files that are infrastructure, not capabilities. */
const SKIP_ROOT = new Set([
    'generate-registry.js',
    '.example-capability.js',
]);

// ─── Version helpers ──────────────────────────────────────────────────────────

/** SHA-256 hex digest of a file's contents. */
function hashFile(filePath) {
    try {
        const contents = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(contents).digest('hex');
    } catch {
        return null;
    }
}

/** Bump the patch component of a semver string, e.g. "1.0.3" → "1.0.4". */
function bumpPatch(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
    if (!m) return '1.0.0';
    return `${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
}

// ─── Load previous registry for version preservation ─────────────────────────

const REGISTRY_PATH = path.join(ROOT, 'registry.json');

/** Map of capabilityName → { version, fileHash } from the last successful run. */
const previousVersions = new Map();

if (fs.existsSync(REGISTRY_PATH)) {
    try {
        const prev = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        if (Array.isArray(prev.capabilities)) {
            for (const cap of prev.capabilities) {
                if (cap.name && cap.version) {
                    previousVersions.set(cap.name, {
                        version:  cap.version,
                        fileHash: cap.fileHash || null,
                    });
                }
            }
        }
        console.log(`📦  Loaded ${previousVersions.size} previous version(s) from registry.json\n`);
    } catch (e) {
        console.warn(`  ⚠  Could not parse existing registry.json: ${e.message}\n`);
    }
}

// ─── Chainable proxy ──────────────────────────────────────────────────────────
// Used to mock zod, electron, powershell and any other require() call so the
// capability files can be evaluated in a sandbox without real dependencies.

function createChain() {
    const fn = function () { return createChain(); };
    return new Proxy(fn, {
        get(_, prop) {
            if (prop === Symbol.toPrimitive) return () => '';
            if (prop === Symbol.iterator)   return function* () {};
            if (prop === 'then')            return undefined; // not a thenable/Promise
            if (prop === 'toJSON')          return () => null;
            return createChain();
        },
        apply()    { return createChain(); },
        construct(){ return createChain(); },
        set()      { return true; },
    });
}

function mockRequire(id) {
    // zod — expose a z object where every method is chainable
    if (id === 'zod') {
        return { z: new Proxy({}, { get: () => createChain() }) };
    }
    // everything else (electron, powershell, logger, memory, …)
    return createChain();
}

// ─── Evaluate a capability file in a VM sandbox ───────────────────────────────

function evalCapability(filePath) {
    let code;
    try {
        code = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        console.warn(`  ⚠  Cannot read ${filePath}: ${e.message}`);
        return null;
    }

    const mod = { exports: {} };

    const sandbox = {
        module:      mod,
        exports:     mod.exports,
        require:     mockRequire,
        __filename:  filePath,
        __dirname:   path.dirname(filePath),
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
            timeout:  5000,
        });
        return mod.exports;
    } catch (e) {
        console.warn(`  ⚠  Sandbox error in ${path.basename(filePath)}: ${e.message}`);
        return null;
    }
}

// ─── Extract only serialisable metadata ───────────────────────────────────────

function extractMeta(exp) {
    if (!exp || typeof exp !== 'object') return null;

    const str  = (v) => (typeof v === 'string'  ? v    : null);
    const bool = (v) => (typeof v === 'boolean' ? v    : true);
    const arr  = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

    const name = str(exp.name);
    if (!name) return null; // name is the minimum required field

    return {
        name,
        description: str(exp.description) ?? '',
        returnType:  str(exp.returnType)  ?? null,
        tags:        arr(exp.tags),
        ui:          str(exp.ui)          ?? null,
        marker:      str(exp.marker)      ?? null,
        enabled:     bool(exp.enabled),
    };
}

// ─── Scan directories ─────────────────────────────────────────────────────────

console.log(`\n  Scanning capabilities in: ${ROOT}\n`);

const capabilities = [];
const seenFiles    = new Set();   // deduplicate by filename (capabilities/ wins over root)
const seenNames    = new Map();   // name → relPath  — abort on duplicate

for (const { dir, prefix } of SCAN_DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;

    const entries = fs.readdirSync(dirPath)
        .filter(f => {
            if (!f.endsWith('.js'))                          return false;
            if (f.startsWith('.') || f.startsWith('_'))     return false;  // hidden/private
            if (dir === '.' && SKIP_ROOT.has(f))            return false;
            if (dir === '.' && f === path.basename(__filename)) return false;
            try {
                if (fs.statSync(path.join(dirPath, f)).isDirectory()) return false;
            } catch { return false; }
            return true;
        })
        .sort();

    for (const file of entries) {
        if (seenFiles.has(file)) continue;   // already indexed from a higher-priority dir
        seenFiles.add(file);

        const filePath = path.join(dirPath, file);
        const relPath  = prefix ? `${prefix}/${file}` : file;

        process.stdout.write(`  Processing ${relPath} … `);

        const exported = evalCapability(filePath);
        if (!exported) continue;

        const meta = extractMeta(exported);
        if (!meta) {
            console.log('skipped (no name field)');
            continue;
        }

        // ── Duplicate name guard ──────────────────────────────────────────────
        if (seenNames.has(meta.name)) {
            const conflict = seenNames.get(meta.name);
            console.error(`\n\n❌  DUPLICATE CAPABILITY NAME: "${meta.name}"`);
            console.error(`       First seen in : ${conflict}`);
            console.error(`       Conflict in   : ${relPath}`);
            console.error(`\n   Each capability must have a unique name. Aborting.\n`);
            process.exit(1);
        }
        seenNames.set(meta.name, relPath);

        // ── Auto-versioning ───────────────────────────────────────────────────
        const fileHash = hashFile(filePath);
        const prev     = previousVersions.get(meta.name);
        let version;

        if (!prev) {
            // Brand new capability
            version = '1.0.0';
            console.log(`✓  ${meta.name}  (new → v${version})`);
        } else if (prev.fileHash && prev.fileHash === fileHash) {
            // File unchanged — preserve version
            version = prev.version;
            console.log(`✓  ${meta.name}  (unchanged, v${version})`);
        } else {
            // File changed — bump patch
            version = bumpPatch(prev.version);
            console.log(`✓  ${meta.name}  (updated v${prev.version} → v${version})`);
        }

        capabilities.push({
            ...meta,
            version,
            fileHash,
            file:  file,
            path:  relPath,
            url:   `${RAW_BASE}/${relPath}`,
        });
    }
}

// ─── Write registry.json ──────────────────────────────────────────────────────

const registry = {
    generated:    new Date().toISOString(),
    repository:   REPO,
    branch:       BRANCH,
    rawBase:      RAW_BASE,
    count:        capabilities.length,
    capabilities,
};

const outPath = path.join(ROOT, 'registry.json');
fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');

console.log(`\n✅  registry.json written — ${capabilities.length} capabilities indexed.`);
console.log(`    ${outPath}\n`);
