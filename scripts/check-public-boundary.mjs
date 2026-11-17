#!/usr/bin/env node

// Inspect the files Git would publish, including new untracked source. Ignored
// local environments, dependencies and build output are intentionally excluded.
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const findings = new Map();
const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
  ".md", ".html", ".css", ".yml", ".yaml", ".toml", ".sh", ".txt",
  ".svg", ".xml", ".ini", ".conf", ".example", ".npmrc",
]);
const privateDirectories = new Set([
  ".git", ".claude", ".vercel", ".terraform", ".aws", ".ssh",
  "admin", "admin-frontend", "bi", "ops", "perps-analytics",
  "charting_library", "charting-library",
  "proprietary-chart", "proprietary-charts", "proprietary_chart", "proprietary_charts",
]);
const serviceRoots = new Set(["backend", "tee", "contracts", "shared"]);
const credentialPatterns = [
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}\b/,
  /\b(?:VERCEL_TOKEN(?:_[A-Z0-9_]+)?|BINANCE_API_SECRET|AWS_SECRET_ACCESS_KEY|NPM_TOKEN)\b["']?\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{24,}/,
];
// Match retired private endpoints without embedding their literal hostnames in
// this source. Public production API/RPC URLs remain valid configuration.
const internalHostPatterns = [
  /\b(?:api\.)?bi\.orbs\.network\b/i,
  /\bperps-(?:dev|admin|staging)\.(?:orbs\.network|vercel\.app)\b/i,
  /\b(?:perps-api|ws-perpsapi)\.(?:dev|staging)\.orbs\.network\b/i,
  /\bty-offapps-\d+\b/i,
  /\bip-10-(?:\d{1,3}-){2}\d{1,3}\b/i,
];

function report(file, category) {
  const categories = findings.get(file) ?? new Set();
  categories.add(category);
  findings.set(file, categories);
}

function isInsideRoot(candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function escapesRoot(candidate) {
  if (!isInsideRoot(candidate)) return true;
  let existingPath = candidate;
  for (;;) {
    try {
      return !isInsideRoot(realpathSync(existingPath));
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error.code)) return true;
      // Resolve existing ancestors too: a missing target below a directory
      // symlink must not hide a dependency outside the repository.
      existingPath = path.dirname(existingPath);
    }
  }
}

function parseConfig(text) {
  // Support TypeScript's JSON comments/trailing commas while preserving strings.
  return JSON.parse(text
    .replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (match, string) => string ?? "")
    .replace(/("(?:\\.|[^"\\])*")|,\s*(?=[}\]])/g, (match, string) => string ?? ""));
}

function checkLocalDependencies(file, config, base) {
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const value of Object.values(config[field] ?? {})) {
      if (typeof value !== "string" || !value.startsWith("file:")) continue;
      try {
        const target = path.resolve(base, decodeURIComponent(value.slice(5)));
        if (escapesRoot(target)) report(file, "package dependency outside repository");
      } catch {
        report(file, "invalid local package dependency");
      }
    }
  }
}

function checkPackage(file, text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    report(file, "invalid package configuration");
    return;
  }
  const base = path.dirname(path.join(root, file));
  checkLocalDependencies(file, config, base);
  if (path.basename(file) !== "package-lock.json") return;
  for (const [packagePath, entry] of Object.entries(config.packages ?? {})) {
    const packageBase = path.resolve(base, packagePath);
    if (escapesRoot(packageBase)) report(file, "lockfile package outside repository");
    checkLocalDependencies(file, entry, packageBase);
    if (entry.link && typeof entry.resolved === "string" && escapesRoot(path.resolve(base, entry.resolved))) {
      report(file, "lockfile link outside repository");
    }
  }
}

function checkTypeScriptPaths(file, text) {
  let config;
  try {
    config = parseConfig(text);
  } catch {
    report(file, "invalid TypeScript configuration");
    return;
  }
  const baseUrl = config.compilerOptions?.baseUrl ?? ".";
  if (typeof baseUrl !== "string") {
    report(file, "invalid TypeScript baseUrl");
    return;
  }
  const base = path.resolve(path.dirname(path.join(root, file)), baseUrl);
  if (escapesRoot(base)) report(file, "TypeScript baseUrl outside repository");
  for (const targets of Object.values(config.compilerOptions?.paths ?? {})) {
    if (!Array.isArray(targets)) {
      report(file, "invalid TypeScript path mapping");
      continue;
    }
    for (const target of targets) {
      if (typeof target !== "string") {
        report(file, "invalid TypeScript path mapping");
      } else if (
        escapesRoot(path.resolve(base, target.replace(/\*.*/, ""))) ||
        escapesRoot(path.resolve(base, target.replace(/\*/g, "__alias_segment__")))
      ) {
        report(file, "TypeScript alias outside repository");
      }
    }
  }
}

let files;
try {
  files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).split("\0").filter(Boolean))];
} catch {
  console.error("Public boundary check could not list repository files with Git.");
  process.exit(1);
}

for (const file of files) {
  const absolute = path.resolve(root, file);
  if (!isInsideRoot(absolute)) {
    report(file, "included path outside repository");
    continue;
  }
  const parts = file.split("/");
  const basename = parts.at(-1);
  if ((basename === ".env" || basename.startsWith(".env.")) && basename !== ".env.example") {
    report(file, "actual environment file");
  }
  if (parts.some((part) => privateDirectories.has(part.toLowerCase())) || serviceRoots.has(parts[0].toLowerCase()) || /^(?:ProprietaryChart|PerpsAnalyticsPage)(?:\.test)?\.tsx$/i.test(basename)) {
    report(file, "private service, operations or proprietary chart path");
  }
  if (parts.some((part) => part.toLowerCase() === ".git")) continue;
  if (/\.(?:pem|key|p12|pfx|crt|cer|der)$/i.test(basename) || [".netrc", ".git-credentials"].includes(basename)) {
    report(file, "credential or certificate file");
  }
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") report(file, "unreadable included file");
    continue;
  }
  if (stat.isSymbolicLink()) {
    const target = path.resolve(path.dirname(absolute), readlinkSync(absolute));
    if (escapesRoot(target) || path.relative(root, target).split(path.sep).includes(".git")) {
      report(file, "symlink outside public source boundary");
    }
    continue;
  }
  if (!stat.isFile()) continue;
  if (!textExtensions.has(path.extname(basename)) && !basename.startsWith(".env") && basename !== ".npmrc") continue;
  let text;
  try {
    text = readFileSync(absolute, "utf8");
  } catch {
    report(file, "unreadable source file");
    continue;
  }
  if (credentialPatterns.some((pattern) => pattern.test(text))) report(file, "obvious credential or private PEM material");
  if (internalHostPatterns.some((pattern) => pattern.test(text))) report(file, "retired private infrastructure host");
  if (["package.json", "package-lock.json"].includes(basename)) checkPackage(file, text);
  if (/^tsconfig(?:\.[^.]+)?\.json$/.test(basename)) checkTypeScriptPaths(file, text);
}

if (findings.size) {
  console.error("Public source boundary check failed:");
  for (const [file, categories] of [...findings].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`- ${file}: ${[...categories].join("; ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Public source boundary check passed (${files.length} included files).`);
}
