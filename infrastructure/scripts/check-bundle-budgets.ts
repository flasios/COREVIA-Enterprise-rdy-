import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

interface Budget {
  label: string;
  path: string;
  maxBytes: number;
  isDir?: boolean;
}

const budgets: Budget[] = [
  { label: "API server",        path: "dist/index.js",           maxBytes: 6 * 1024 * 1024 },    // 6 MB
  { label: "Processing worker", path: "dist/worker/index.js",    maxBytes: 4 * 1024 * 1024 },    // 4 MB
  { label: "AI service",        path: "dist/ai-service/index.js", maxBytes: 512 * 1024 },         // 512 KB
  { label: "Client bundle",     path: "dist/public",             maxBytes: 12 * 1024 * 1024, isDir: true }, // 12 MB total
];

function dirSize(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let failures = 0;

for (const budget of budgets) {
  const full = path.resolve(ROOT, budget.path);
  if (!fs.existsSync(full)) {
    console.log(`[bundle-budget] SKIP  ${budget.label} — ${budget.path} not found (not built yet)`);
    continue;
  }

  const actual = budget.isDir ? dirSize(full) : fs.statSync(full).size;
  const ok = actual <= budget.maxBytes;
  const prefix = ok ? "OK   " : "FAIL ";
  console.log(`[bundle-budget] ${prefix} ${budget.label}: ${formatBytes(actual)} / ${formatBytes(budget.maxBytes)} limit`);
  if (!ok) failures++;
}

if (failures > 0) {
  console.error(`\n[bundle-budget] ${failures} budget(s) exceeded.`);
  process.exit(1);
} else {
  console.log("[bundle-budget] All budgets within limits.");
}