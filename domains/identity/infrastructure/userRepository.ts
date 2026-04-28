import type { IIdentityStoragePort } from "@interfaces/storage/ports";
import type {
  UserRepository,
  UserRecord,
  CreateUserData,
} from "../domain";

/**
 * Adapts the IIdentityStoragePort to the UserRepository port.
 * This is the seam — once storage is split, only this file changes.
 */
export class StorageUserRepository implements UserRepository {
  constructor(private readonly storage: IIdentityStoragePort) {}

  async findById(id: string): Promise<UserRecord | undefined> {
    const user = await this.storage.getUser(id);
    return user ? (user as unknown as UserRecord) : undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const user = await this.storage.getUserByEmail(email);
    return user ? (user as unknown as UserRecord) : undefined;
  }

  async findByUsername(username: string): Promise<UserRecord | undefined> {
    const user = await this.storage.getUserByUsername(username);
    return user ? (user as unknown as UserRecord) : undefined;
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    const user = await this.storage.createUser({
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      role: data.role as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      department: data.department,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      organizationType: data.organizationType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      departmentId: data.departmentId,
      departmentName: data.departmentName,
    });
    return user as unknown as UserRecord;
  }

  async updateLastLogin(id: string, date: Date): Promise<void> {
    await this.storage.updateUser(id, { lastLogin: date });
  }
}
