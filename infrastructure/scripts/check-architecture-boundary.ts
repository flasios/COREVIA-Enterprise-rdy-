import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type Finding = {
  level: "error" | "warning";
  message: string;
};

type SizeBaseline = {
  lineBudget?: number;
  files?: Record<string, number>;
};

const root = process.cwd();
const findings: Finding[] = [];

const canonicalRoots = [
  "apps",
  "brain",
  "domains",
  "platform",
  "interfaces",
  "packages",
  "infrastructure",
  "docs",
];

const requiredDomainLayers = ["api", "application", "domain", "infrastructure"];
const transitionalFrontendModules = new Set<string>();
const defaultSourceFileLineBudget = 1500;

function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function isDirectory(relativePath: string): boolean {
  const fullPath = path.join(root, relativePath);
  return existsSync(fullPath) && statSync(fullPath).isDirectory();
}

function listDirectories(relativePath: string): string[] {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    return [];
  }

  return readdirSync(fullPath)
    .filter((entry) => statSync(path.join(fullPath, entry)).isDirectory())
    .sort();
}

function add(level: Finding["level"], message: string): void {
  findings.push({ level, message });
}

function readSizeBaseline(): SizeBaseline {
  const baselinePath = path.join(root, ".architecture-size-baseline.json");
  if (!existsSync(baselinePath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(baselinePath, "utf8")) as SizeBaseline;
  } catch (error) {
    add("error", `.architecture-size-baseline.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function collectDistFolders(relativePath: string, results: string[] = []): string[] {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    return results;
  }

  for (const entry of readdirSync(fullPath)) {
    if (entry === "node_modules" || entry === ".git") {
      continue;
    }

    const childRelativePath = path.join(relativePath, entry);
    const childFullPath = path.join(root, childRelativePath);
    if (!statSync(childFullPath).isDirectory()) {
      continue;
    }

    if (entry === "dist") {
      results.push(childRelativePath.replaceAll(path.sep, "/"));
      continue;
    }

    collectDistFolders(childRelativePath, results);
  }

  return results;
}

function collectSourceFiles(relativePath: string, results: string[] = []): string[] {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    return results;
  }

  for (const entry of readdirSync(fullPath)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") {
      continue;
    }

    const childRelativePath = path.join(relativePath, entry);
    const childFullPath = path.join(root, childRelativePath);
    const stat = statSync(childFullPath);

    if (stat.isDirectory()) {
      collectSourceFiles(childRelativePath, results);
      continue;
    }

    if (/\.(ts|tsx|mts|cts)$/.test(entry)) {
      results.push(childRelativePath.replaceAll(path.sep, "/"));
    }
  }

  return results;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function getLineAt(content: string, index: number): string {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n")
    ? content.slice(0, -1).split("\n").length
    : content.split("\n").length;
}

function getFrontendModuleName(relativeFilePath: string): string | null {
  const match = relativeFilePath.match(/^apps\/web\/modules\/([^/]+)\//);
  return match?.[1] ?? null;
}

function getBackendDomainName(relativeFilePath: string): string | null {
  const match = relativeFilePath.match(/^domains\/([^/]+)\//);
  return match?.[1] ?? null;
}

function checkImportBoundaries(): void {
  const importPattern = /\b(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

  for (const relativeFilePath of collectSourceFiles("apps/web/modules")) {
    const sourceModule = getFrontendModuleName(relativeFilePath);
    if (!sourceModule) {
      continue;
    }

    const content = readFileSync(path.join(root, relativeFilePath), "utf8");
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? "";
      const target = specifier.match(/^@\/modules\/([^/]+)(?:\/(.+))?$/);
      if (!target) {
        continue;
      }

      const targetModule = target[1];
      const targetPath = target[2] ?? "";
      if (targetModule === sourceModule || targetPath.length === 0) {
        continue;
      }

      add(
        "error",
        `${relativeFilePath}:${getLineNumber(content, match.index ?? 0)} imports ${specifier}; cross-module imports should use @/modules/${targetModule}.`,
      );
    }
  }

  for (const relativeFilePath of collectSourceFiles("domains")) {
    const sourceDomain = getBackendDomainName(relativeFilePath);
    if (!sourceDomain) {
      continue;
    }

    const content = readFileSync(path.join(root, relativeFilePath), "utf8");
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? "";
      const lineNumber = getLineNumber(content, match.index ?? 0);
      const importLine = getLineAt(content, match.index ?? 0).trim();
      const isTypeOnlyImport = importLine.startsWith("import type ");

      if (relativeFilePath.includes("/api/")) {
        const importsOwnInfrastructure =
          specifier === "../infrastructure" ||
          specifier.startsWith("../infrastructure/") ||
          specifier === `@domains/${sourceDomain}/infrastructure` ||
          specifier.startsWith(`@domains/${sourceDomain}/infrastructure/`);

        if (importsOwnInfrastructure) {
          add(
            "error",
            `${relativeFilePath}:${lineNumber} imports ${specifier}; API routes must access infrastructure through the application layer.`,
          );
        }
      }

      if (relativeFilePath.includes("/domain/") && !isTypeOnlyImport) {
        const forbiddenDomainRuntimeImport =
          specifier.startsWith("@platform") ||
          specifier.startsWith("@interfaces") ||
          specifier.startsWith("@domains") ||
          specifier.startsWith("@/") ||
          specifier.startsWith("node:") ||
          specifier === "fs" ||
          specifier.startsWith("fs/") ||
          specifier === "express" ||
          specifier.startsWith("drizzle-orm");

        if (forbiddenDomainRuntimeImport) {
          add(
            "error",
            `${relativeFilePath}:${lineNumber} imports ${specifier}; domain layer must stay framework/runtime independent.`,
          );
        }
      }

      const domainImportMatch: RegExpMatchArray | null = specifier.match(/^@domains\/([^/]+)(?:\/(.+))?$/);
      if (!domainImportMatch) {
        continue;
      }

      const targetDomain: string = domainImportMatch[1] ?? "";
      const targetPath: string = domainImportMatch[2] ?? "";
      if (targetDomain === sourceDomain || targetPath.length === 0) {
        continue;
      }

      if (targetPath.startsWith("infrastructure")) {
        add(
          "error",
          `${relativeFilePath}:${lineNumber} imports ${specifier}; cross-domain infrastructure imports should move behind application services, contracts, or ports.`,
        );
      }
    }
  }
}

function checkSourceFileSizeBudgets(): void {
  const baseline = readSizeBaseline();
  const lineBudget = baseline.lineBudget ?? defaultSourceFileLineBudget;
  const baselineFiles = baseline.files ?? {};
  const sourceFiles = [
    ...collectSourceFiles("apps/web/modules"),
    ...collectSourceFiles("domains"),
  ];

  for (const relativeFilePath of sourceFiles) {
    const content = readFileSync(path.join(root, relativeFilePath), "utf8");
    const lineCount = countLines(content);
    const baselineLineCount = baselineFiles[relativeFilePath];

    if (lineCount <= lineBudget) {
      continue;
    }

    if (baselineLineCount === undefined) {
      add(
        "error",
        `${relativeFilePath} has ${lineCount} lines; new source files must stay within the ${lineBudget}-line EA decomposition budget.`,
      );
      continue;
    }

    if (lineCount > baselineLineCount) {
      add(
        "error",
        `${relativeFilePath} grew from baseline ${baselineLineCount} to ${lineCount} lines; split the file before adding more behavior.`,
      );
    }
  }
}

for (const canonicalRoot of canonicalRoots) {
  if (!isDirectory(canonicalRoot)) {
    add("error", `Missing canonical root: ${canonicalRoot}/`);
  }
}

for (const domainName of listDirectories("domains")) {
  if (domainName === "__tests__") {
    continue;
  }

  const domainRoot = `domains/${domainName}`;
  for (const layer of requiredDomainLayers) {
    if (!isDirectory(`${domainRoot}/${layer}`)) {
      add("error", `${domainRoot} is missing required layer: ${layer}/`);
    }
  }

  if (!exists(`${domainRoot}/index.ts`)) {
    add("error", `${domainRoot} is missing public surface: index.ts`);
  }
}

for (const moduleName of listDirectories("apps/web/modules")) {
  const moduleRoot = `apps/web/modules/${moduleName}`;
  if (transitionalFrontendModules.has(moduleName)) {
    add("warning", `${moduleRoot} is transitional; standardize or document its target ownership.`);
    continue;
  }

  if (!exists(`${moduleRoot}/index.ts`)) {
    add("error", `${moduleRoot} is missing public UI module surface: index.ts`);
  }
}

for (const sourceRoot of ["apps/web", "domains"]) {
  const distFolders = collectDistFolders(sourceRoot);
  for (const distFolder of distFolders) {
    add("error", `${distFolder} is generated output inside a source module tree.`);
  }
}

checkImportBoundaries();
checkSourceFileSizeBudgets();

const errors = findings.filter((finding) => finding.level === "error");
const warnings = findings.filter((finding) => finding.level === "warning");
const maxWarningsToPrint = 25;

for (const warning of warnings.slice(0, maxWarningsToPrint)) {
  console.warn(`[architecture-boundary] warning: ${warning.message}`);
}

if (warnings.length > maxWarningsToPrint) {
  console.warn(`[architecture-boundary] warning: ${warnings.length - maxWarningsToPrint} additional warning(s) suppressed.`);
}

for (const error of errors) {
  console.error(`[architecture-boundary] error: ${error.message}`);
}

if (errors.length > 0) {
  console.error(`[architecture-boundary] failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`[architecture-boundary] passed with ${warnings.length} warning(s).`);
