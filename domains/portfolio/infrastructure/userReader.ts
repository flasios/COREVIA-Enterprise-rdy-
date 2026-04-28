/**
 * Portfolio Module — StorageUserReader
 * Wraps IStorage user/team methods behind the UserReader port.
 */
import type { IIdentityStoragePort, IOperationsStoragePort } from "@interfaces/storage/ports";
import type { UserReader } from "../domain/ports";

export class StorageUserReader implements UserReader {
  constructor(private storage: IIdentityStoragePort & IOperationsStoragePort) {}
  getById(id: string) { return this.storage.getUser(id); }
  getAll() { return this.storage.getAllUsers(); }
  getTeams() { return this.storage.getTeams(); }
  getWithPermission(permission: string) { return this.storage.getUsersWithPermission(permission); }
}
