/**
 * Operations Module — Domain Ports
 *
 * Pure interfaces for every external dependency the operations module needs.
 * Infrastructure adapters implement these; use-cases depend only on port types.
 *
 * NO concrete imports allowed — @shared/schema types ARE allowed.
 */

import type {
  User,
  Team,
  TeamMember,
  InsertAuditLog,
  SelectAuditLog,
  PortfolioProject,
  InsertTeam,
  UpdateTeam,
  InsertTeamMember,
  InsertUser,
  UpdateUser,
} from "@shared/schema";

// ── Team Repository ────────────────────────────────────────────────

export interface TeamRepository {
  getTeams(): Promise<Team[]>;
  createTeam(data: Partial<InsertTeam> & { createdBy: string }): Promise<Team>;
  updateTeam(id: string, updates: Partial<UpdateTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;
  getTeamMembers(teamId: string): Promise<Array<TeamMember & { user: User }>>;
  addTeamMember(data: Partial<InsertTeamMember>): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<boolean>;
}

// ── Audit Logger ───────────────────────────────────────────────────

export interface AuditLoggerPort {
  log(entry: InsertAuditLog): Promise<SelectAuditLog>;
}

// ── User Repository ────────────────────────────────────────────────

export interface UserRepository {
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: Partial<InsertUser>): Promise<User>;
  updateUser(id: string, updates: Partial<UpdateUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
}

// ── Portfolio Project Reader (cross-module) ────────────────────────

export interface PortfolioProjectReader {
  getAllPortfolioProjects(): Promise<PortfolioProject[]>;
}

// ── Password Hasher ────────────────────────────────────────────────

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
}

// ── Notification Repository ────────────────────────────────────────

export interface NotificationRepository {
  getUserNotifications(userId: string, limit?: number): Promise<unknown[]>;
  getUnreadNotifications(userId: string, limit?: number): Promise<unknown[]>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;
}

// ── Cache Manager (wraps demandAnalysisService) ────────────────────

export interface CacheManagerPort {
  getCacheStats(): Record<string, unknown>;
  clearCache(): void;
}
