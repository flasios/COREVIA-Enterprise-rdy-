import * as fs from "node:fs";
import path from "node:path";

export interface ManagedFileHandle {
  rootDir: string;
  leafName: string;
}

function assertAllowedRoot(resolvedDirectory: string, allowedRoots: string[]) {
  if (!allowedRoots.some((root) => resolvedDirectory === root || resolvedDirectory.startsWith(`${root}${path.sep}`))) {
    throw new Error("Refusing to operate on unmanaged file path");
  }
}

function sanitizeLeafName(fileName: string): string {
  const safeLeafName = path.basename(fileName);
  if (safeLeafName !== fileName || !/^[a-zA-Z0-9._-]+$/.test(safeLeafName)) {
    throw new Error("Refusing to operate on invalid file path");
  }
  return safeLeafName;
}

export function createManagedFileHandleFromPath(filePath: string, allowedRoots: string[]): ManagedFileHandle {
  const resolvedDirectory = fs.realpathSync.native(path.resolve(path.dirname(filePath)));
  assertAllowedRoot(resolvedDirectory, allowedRoots);
  return {
    rootDir: resolvedDirectory,
    leafName: sanitizeLeafName(path.basename(filePath)),
  };
}

export function createManagedFileHandle(rootDir: string, fileName: string, allowedRoots: string[]): ManagedFileHandle {
  const resolvedDirectory = fs.realpathSync.native(path.resolve(rootDir));
  assertAllowedRoot(resolvedDirectory, allowedRoots);
  return {
    rootDir: resolvedDirectory,
    leafName: sanitizeLeafName(fileName),
  };
}

export function toAbsoluteManagedPath(handle: ManagedFileHandle): string {
  return path.join(handle.rootDir, handle.leafName);
}

export function managedFileExists(handle: ManagedFileHandle): boolean {
  return fs.existsSync(toAbsoluteManagedPath(handle));
}

export function createManagedReadStream(handle: ManagedFileHandle) {
  return fs.createReadStream(toAbsoluteManagedPath(handle));
}

export function createManagedWriteStream(handle: ManagedFileHandle) {
  return fs.createWriteStream(toAbsoluteManagedPath(handle));
}

export async function unlinkManagedFile(handle: ManagedFileHandle | null | undefined): Promise<void> {
  if (!handle) return;
  try {
    await fs.promises.unlink(toAbsoluteManagedPath(handle));
  } catch {
    // Best-effort cleanup.
  }
}

export async function copyManagedFile(source: ManagedFileHandle, destination: ManagedFileHandle): Promise<void> {
  await fs.promises.copyFile(toAbsoluteManagedPath(source), toAbsoluteManagedPath(destination));
}

export function readManagedUtf8File(handle: ManagedFileHandle): string {
  return fs.readFileSync(toAbsoluteManagedPath(handle), "utf-8");
}