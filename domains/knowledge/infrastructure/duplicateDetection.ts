/**
 * Knowledge Module — LegacyDuplicateDetection
 * Wraps the createDuplicateDetectionService factory behind the DuplicateDetectionPort.
 */
import type { IIdentityStoragePort, IKnowledgeStoragePort } from "@interfaces/storage/ports";
import type { DuplicateDetectionPort } from "../domain/ports";
import { createDuplicateDetectionService } from "./duplicateDetectionService";

type DuplicateDetectionStorage = IKnowledgeStoragePort & IIdentityStoragePort;

export class LegacyDuplicateDetection implements DuplicateDetectionPort {
  private svc: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(storage: DuplicateDetectionStorage) {
    this.svc = createDuplicateDetectionService(storage);
  }

  calculateContentHash(text: string): string {
    return this.svc.calculateContentHash(text);
  }
  async checkExactDuplicate(hash: string) {
    return this.svc.checkExactDuplicate(hash);
  }
  async checkNearDuplicate(text: string, embedding: number[], threshold: number) {
    return this.svc.checkNearDuplicate(text, embedding, threshold);
  }
}
