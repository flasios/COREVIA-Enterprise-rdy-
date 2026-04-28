import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const domainsDir = path.resolve(rootDir, "domains");

function listApiRouteFiles(dirPath) {
  const files = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "__tests__") {
        continue;
      }
      files.push(...listApiRouteFiles(absolute));
      continue;
    }

    if (/\.routes\.ts$/i.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

const approvalPathPattern = /\/(approve|reject|decide|workflow)\b/i;
const routerCallPattern = /router\.(get|post|put|patch|delete)\(/;

const failures = [];

for (const filePath of listApiRouteFiles(domainsDir)) {
  const source = readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!routerCallPattern.test(line)) {
      continue;
    }

    if (!approvalPathPattern.test(line)) {
      continue;
    }

    const localWindow = lines.slice(index, Math.min(lines.length, index + 10)).join("\n");
    const hasPermissionGuard = localWindow.includes("requirePermission(");

    if (!hasPermissionGuard) {
      failures.push({
        filePath,
        lineNumber: index + 1,
        lineText: line.trim(),
      });
    }
  }
}

if (failures.length > 0) {
  console.error("Approval permission coverage failed. Approval-like routes without requirePermission found:\n");
  for (const failure of failures) {
    const relativePath = path.relative(rootDir, failure.filePath);
    console.error(`- ${relativePath}:${failure.lineNumber} -> ${failure.lineText}`);
  }
  process.exit(1);
}

console.log("Approval permission coverage passed.");
