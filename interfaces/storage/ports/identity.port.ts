/**
 * Identity Storage Port — User management methods
 */
import type {
  User,
  InsertUser,
  UpdateUser,
} from "@shared/schema";

export interface IIdentityStoragePort {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersWithPermission(permission: string): Promise<User[]>;
}
