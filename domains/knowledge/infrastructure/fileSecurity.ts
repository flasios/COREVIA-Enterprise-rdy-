/**
 * Knowledge Module — LegacyFileSecurity
 * Wraps file security functions behind the FileSecurityPort.
 */
import type { FileSecurityPort } from "../domain/ports";
import {
  enforceFileSecurity,
  logUploadSecurityRejection,
  safeUnlink,
} from "../../../platform/security";

export class LegacyFileSecurity implements FileSecurityPort {
  async enforceFileSecurity(params: Record<string, unknown>) {
    return enforceFileSecurity(params as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  logUploadSecurityRejection(params: Record<string, unknown>, message: string) {
    return logUploadSecurityRejection(params as any, message); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  async safeUnlink(filePath: string) {
    return safeUnlink(filePath);
  }
}
