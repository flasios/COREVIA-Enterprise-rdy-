import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileTypeFromFile as detectFileType } from "file-type";
import { logSecurityEvent, logger } from "@platform/logging/Logger";

const execFileAsync = promisify(execFile);

const DEFAULT_SCANNER_CANDIDATES = ["clamdscan", "clamscan"];
const DEFAULT_SCAN_TIMEOUT_MS = 45_000;

const EXTENSION_TO_ALLOWED_MIME: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword", "application/x-cfb", "application/octet-stream"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ".ppt": ["application/vnd.ms-powerpoint", "application/x-cfb", "application/octet-stream"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".rtf": ["application/rtf", "text/rtf", "text/plain"],
  ".json": ["application/json", "text/plain"],
  ".xml": ["application/xml", "text/xml", "text/plain"],
  ".html": ["text/html", "application/xhtml+xml", "text/plain"],
  ".yml": ["application/x-yaml", "text/yaml", "text/plain"],
  ".yaml": ["application/x-yaml", "text/yaml", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".bmp": ["image/bmp"],
  ".webp": ["image/webp"],
  ".tiff": ["image/tiff"],
};

const ALLOW_UNKNOWN_MAGIC_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".yml",
  ".yaml",
  ".rtf",
  ".doc",
]);

type MalwareScanMode = "off" | "optional" | "required";

export type FileSecurityPolicy = {
  allowedExtensions: string[];
  path: string;
  originalName: string;
  declaredMimeType?: string | null;
  correlationId?: string;
  userId?: string;
};

function normalizeExtension(ext: string): string {
  return ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
}

async function detectFileTypeFromPath(filePath: string) {
  if (typeof detectFileType !== "function") {
    throw new TypeError("file-type module does not expose a file detection function");
  }
  return detectFileType(filePath);
}

function getScannerCandidates(): string[] {
  const configured = (process.env.MALWARE_SCANNER_BIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_SCANNER_CANDIDATES;
}

function getMalwareScanMode(): MalwareScanMode {
  const value = (process.env.MALWARE_SCAN_MODE || "").trim().toLowerCase();
  if (value === "off" || value === "optional" || value === "required") {
    return value;
  }
  return process.env.NODE_ENV === "production" ? "required" : "optional";
}

function getAllowedMimesForExtension(extension: string): Set<string> {
  return new Set(EXTENSION_TO_ALLOWED_MIME[extension] || []);
}

function isLikelyInfectedOutput(stdout: string, stderr: string): boolean {
  const output = `${stdout}\n${stderr}`.toUpperCase();
  return output.includes("FOUND");
}

function getErrorField<T = unknown>(error: unknown, field: string): T | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return value as T | undefined;
}

function getScannerErrorText(error: unknown): string {
  const message = getErrorField<string>(error, "message");
  return typeof message === "string" ? message : "scanner_error";
}

function getScanTextOutput(error: unknown): { stdout: string; stderr: string } {
  const stdout = getErrorField(error, "stdout");
  const stderr = getErrorField(error, "stderr");
  return {
    stdout: typeof stdout === "string" ? stdout : "",
    stderr: typeof stderr === "string" ? stderr : "",
  };
}

function isScannerMissing(code: string | number | undefined): boolean {
  return code === "ENOENT";
}

function isMalwareDetection(code: string | number | undefined, stdout: string, stderr: string): boolean {
  return code === 1 || isLikelyInfectedOutput(stdout, stderr);
}

function logOptionalScanFailure(scanner: string, error: unknown, policy: FileSecurityPolicy): void {
  logger.warn("[Upload Security] Malware scan failed in optional mode", {
    operation: "malware_scan_optional",
    metadata: {
      scanner,
      error: getScannerErrorText(error),
      path: policy.path,
    },
  });
}

function handleScannerExecutionFailure(
  scanner: string,
  error: unknown,
  mode: MalwareScanMode,
  policy: FileSecurityPolicy,
): { status: "scanner_missing" | "detected" | "required_failure" | "optional_failure" } {
  const code = getErrorField<string | number>(error, "code");
  const { stdout, stderr } = getScanTextOutput(error);

  if (isScannerMissing(code)) {
    return { status: "scanner_missing" };
  }

  if (isMalwareDetection(code, stdout, stderr)) {
    return { status: "detected" };
  }

  if (mode === "required") {
    return { status: "required_failure" };
  }

  logOptionalScanFailure(scanner, error, policy);
  return { status: "optional_failure" };
}

function handleMissingScanners(
  scannerNotFoundCount: number,
  scannerCandidates: string[],
  mode: MalwareScanMode,
  policy: FileSecurityPolicy,
): boolean {
  if (scannerNotFoundCount !== scannerCandidates.length) {
    return false;
  }

  const message = "No malware scanner binary found (expected clamdscan/clamscan)";
  if (mode === "required") {
    throw new Error(message);
  }

  logger.warn("[Upload Security] Scanner unavailable in optional mode", {
    operation: "malware_scan_optional",
    metadata: {
      scanners: scannerCandidates,
      path: policy.path,
    },
  });

  return true;
}

function throwRequiredScanFailure(lastError: unknown, mode: MalwareScanMode): void {
  if (lastError && mode === "required") {
    throw new Error("Malware scan failed");
  }
}

async function validateFileSignature(policy: FileSecurityPolicy): Promise<void> {
  const ext = normalizeExtension(path.extname(policy.originalName));
  const allowedExtensions = new Set(policy.allowedExtensions.map(normalizeExtension));

  if (!allowedExtensions.has(ext)) {
    throw new Error(`File extension ${ext} is not permitted`);
  }
  const allowedMimes = getAllowedMimesForExtension(ext);
  const declaredMime = (policy.declaredMimeType || "").toLowerCase();

  if (
    declaredMime &&
    allowedMimes.size > 0 &&
    declaredMime !== "application/octet-stream" &&
    !allowedMimes.has(declaredMime)
  ) {
    throw new Error(`Declared MIME type ${declaredMime} does not match extension ${ext}`);
  }

  const detected = await detectFileTypeFromPath(policy.path);
  if (!detected) {
    if (!ALLOW_UNKNOWN_MAGIC_EXTENSIONS.has(ext)) {
      throw new Error(`Unable to verify file signature for ${ext} file`);
    }
    return;
  }

  if (allowedMimes.size > 0 && !allowedMimes.has(detected.mime.toLowerCase())) {
    throw new Error(
      `Detected MIME type ${detected.mime} does not match expected file type ${ext}`,
    );
  }
}

async function runMalwareScan(policy: FileSecurityPolicy): Promise<void> {
  const mode = getMalwareScanMode();
  if (mode === "off") {
    return;
  }

  const timeoutMs = Number(process.env.MALWARE_SCAN_TIMEOUT_MS || DEFAULT_SCAN_TIMEOUT_MS);
  const scannerCandidates = getScannerCandidates();
  let scannerNotFoundCount = 0;
  let lastError: unknown;

  for (const scanner of scannerCandidates) {
    try {
      await execFileAsync(scanner, ["--no-summary", policy.path], {
        timeout: timeoutMs,
        windowsHide: true,
      });
      return;
    } catch (error) {
      lastError = error;
      const failure = handleScannerExecutionFailure(scanner, error, mode, policy);
      if (failure.status === "scanner_missing") {
        scannerNotFoundCount += 1;
        continue;
      }

      if (failure.status === "detected") {
        throw new Error("Malware detected in uploaded file");
      }

      if (failure.status === "required_failure") {
        throw new Error(`Malware scan failed using ${scanner}`);
      }

      return;
    }
  }

  if (handleMissingScanners(scannerNotFoundCount, scannerCandidates, mode, policy)) {
    return;
  }

  throwRequiredScanFailure(lastError, mode);
}

export async function enforceFileSecurity(policy: FileSecurityPolicy): Promise<void> {
  await validateFileSignature(policy);
  await runMalwareScan(policy);
}

export async function safeUnlink(filePath: string | undefined | null): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // Best-effort cleanup.
  }
}

export function logUploadSecurityRejection(policy: FileSecurityPolicy, reason: string): void {
  logSecurityEvent("Upload rejected by security policy", {
    path: policy.path,
    fileName: path.basename(policy.originalName),
    mimeType: policy.declaredMimeType,
    reason,
    correlationId: policy.correlationId,
    userId: policy.userId,
  });
}
