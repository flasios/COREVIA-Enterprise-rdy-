import type { IIdentityStoragePort, IOperationsStoragePort } from "@interfaces/storage/ports";
import type { UserReader } from "../domain/ports";

/**
 * Wraps IStorage user/team read methods behind the UserReader port.
 */
export class StorageUserReader implements UserReader {
  constructor(private storage: IIdentityStoragePort & IOperationsStoragePort) {}

  async getUser(id: string) {
    return this.storage.getUser(id);
  }

  async getTeamMembers(teamId: string) {
    return this.storage.getTeamMembers(teamId);
  }

  async getTeam(teamId: string) {
    return this.storage.getTeam(teamId);
  }

  async getUserTeams(userId: string) {
    return this.storage.getUserTeams(userId);
  }

  async createNotification(data: Record<string, unknown>) {
    return this.storage.createNotification(data as Parameters<IOperationsStoragePort["createNotification"]>[0]);
  }

  async getUsersWithPermission(permission: string) {
    return this.storage.getUsersWithPermission(permission);
  }
}
