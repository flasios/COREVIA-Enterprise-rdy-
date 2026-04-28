import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".md", ".sql"]);
const DEFAULT_IGNORES = new Set([
  "node_modules",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".git",
]);

export function collectFiles(root, directories, extensions = DEFAULT_EXTENSIONS) {
  const files = [];

  const visit = (currentPath) => {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      const name = path.basename(currentPath);
      if (DEFAULT_IGNORES.has(name)) {
        return;
      }
      for (const entry of fs.readdirSync(currentPath)) {
        visit(path.join(currentPath, entry));
      }
      return;
    }

    if (extensions.has(path.extname(currentPath))) {
      files.push(currentPath);
    }
  };

  for (const directory of directories) {
    visit(path.resolve(root, directory));
  }

  return files;
}

export function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

export function findMatches(root, directories, rules) {
  const results = [];
  for (const filePath of collectFiles(root, directories)) {
    const relativePath = normalizeRelative(root, filePath);
    const content = fs.readFileSync(filePath, "utf8");

    for (const rule of rules) {
      const matches = [...content.matchAll(rule.pattern)];
      if (matches.length === 0) {
        continue;
      }

      for (const match of matches) {
        if (rule.allow?.(relativePath, match[0], content)) {
          continue;
        }
        const line = content.slice(0, match.index ?? 0).split("\n").length;
        results.push({
          file: relativePath,
          line,
          snippet: match[0],
          message: rule.message,
        });
      }
    }
  }

  return results;
}

export function reportAndExit(label, violations) {
  if (violations.length === 0) {
    console.log(`[${label}] OK`);
    return;
  }

  console.error(`[${label}] ${violations.length} violation(s) found:`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.message}`);
  }
  process.exitCode = 1;
}

export function createPlaceholderRules(scopeName) {
  return [
    {
      pattern: /placeholder|not yet reconstituted|not recoverable in this workspace snapshot/gi,
      message: `${scopeName} still contains placeholder or incomplete markers.`,
    },
  ];
}