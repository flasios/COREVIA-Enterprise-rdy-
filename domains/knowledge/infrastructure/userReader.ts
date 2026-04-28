/**
 * Knowledge Module — StorageUserReader
 * Wraps IStorage user methods behind the UserReader port.
 */
import type { IIdentityStoragePort } from "@interfaces/storage/ports";
import type { UserReader } from "../domain/ports";

export class StorageUserReader implements UserReader {
  constructor(private storage: IIdentityStoragePort) {}
  getById(id: string) { return this.storage.getUser(id); }
}
