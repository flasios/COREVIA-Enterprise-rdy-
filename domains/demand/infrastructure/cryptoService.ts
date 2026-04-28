import type { CryptoServicePort } from "../domain/ports";
import { createCryptoService } from "@platform/crypto";
import { storage } from "@interfaces/storage";
import type { IStorage } from "@interfaces/storage";

/**
 * Wraps createCryptoService behind the CryptoServicePort port.
 */
export class LegacyCryptoService implements CryptoServicePort {
  create(storageOverride?: unknown): ReturnType<CryptoServicePort["create"]> {
    const scopedStorage = (storageOverride ?? storage) as IStorage;
    return createCryptoService(scopedStorage) as unknown as ReturnType<CryptoServicePort["create"]>;
  }
}
