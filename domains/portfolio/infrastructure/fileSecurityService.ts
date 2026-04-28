/**
 * Portfolio Module — LegacyFileSecurityService
 * Wraps the legacy fileSecurity utilities behind the FileSecurityService port.
 */
import type { FileSecurityService } from "../domain/ports";
import {
  enforceFileSecurity,
  logUploadSecurityRejection,
  safeUnlink,
} from "@platform/security";

export class LegacyFileSecurityService implements FileSecurityService {
  async enforce(opts: {
    allowedExtensions: string[];
    path: string;
    originalName: string;
    declaredMimeType: string;
    correlationId?: string;
    userId: string;
  }) {
    await enforceFileSecurity(opts);
  }

  logRejection(opts: {
    allowedExtensions: string[];
    path: string;
    originalName: string;
    declaredMimeType: string;
    correlationId?: string;
    userId: string;
  }, message: string) {
    logUploadSecurityRejection(opts, message);
  }

  async safeUnlink(filePath: string | undefined) {
    await safeUnlink(filePath);
  }
}
