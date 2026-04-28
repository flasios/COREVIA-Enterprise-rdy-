/**
 * Operations Module — Infrastructure Adapters
 *
 * Concrete implementations of domain ports.
 * Each adapter wraps an existing service/storage call.
 */

import type { IOperationsStoragePort, IIdentityStoragePort, IPortfolioStoragePort } from "@interfaces/storage/ports";
import { demandAnalysisService } from "@domains/demand/application";
import type {
  TeamRepository,
  AuditLoggerPort,
  UserRepository,
  PortfolioProjectReader,
  PasswordHasherPort,
  CacheManagerPort,
} from "../domain/ports";

// ── Team Repository ────────────────────────────────────────────────

export class StorageTeamRepository implements TeamRepository {
  constructor(private s: IOperationsStoragePort) {}
  getTeams() { return this.s.getTeams(); }
  createTeam(data: Parameters<IOperationsStoragePort["createTeam"]>[0]) { return this.s.createTeam(data); }
  updateTeam(id: string, updates: Record<string, unknown>) { return this.s.updateTeam(id, updates as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  deleteTeam(id: string) { return this.s.deleteTeam(id); }
  getTeamMembers(teamId: string) { return this.s.getTeamMembers(teamId); }
  addTeamMember(data: Parameters<IOperationsStoragePort["addTeamMember"]>[0]) { return this.s.addTeamMember(data); }
  removeTeamMember(teamId: string, userId: string) { return this.s.removeTeamMember(teamId, userId); }
}

// ── Audit Logger ───────────────────────────────────────────────────

export class StorageAuditLogger implements AuditLoggerPort {
  constructor(private s: IOperationsStoragePort) {}
  log(entry: Parameters<IOperationsStoragePort["createAuditLog"]>[0]) { return this.s.createAuditLog(entry); }
}

// ── User Repository ────────────────────────────────────────────────

export class StorageUserRepository implements UserRepository {
  constructor(private s: IIdentityStoragePort) {}
  getAllUsers() { return this.s.getAllUsers(); }
  getUser(id: string) { return this.s.getUser(id); }
  getUserByEmail(email: string) { return this.s.getUserByEmail(email); }
  createUser(data: Parameters<IIdentityStoragePort["createUser"]>[0]) { return this.s.createUser(data); }
  updateUser(id: string, updates: Record<string, unknown>) { return this.s.updateUser(id, updates as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  deleteUser(id: string) { return this.s.deleteUser(id); }
}

// ── Portfolio Project Reader ───────────────────────────────────────

export class StoragePortfolioProjectReader implements PortfolioProjectReader {
  constructor(private s: IPortfolioStoragePort) {}
  getAllPortfolioProjects() { return this.s.getAllPortfolioProjects(); }
}

// ── Password Hasher ────────────────────────────────────────────────

export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(password: string) {
    const bcrypt = await import("bcryptjs");
    return bcrypt.default.hash(password, 10);
  }
}

// ── Cache Manager ──────────────────────────────────────────────────

export class LegacyCacheManager implements CacheManagerPort {
  private readonly svc = demandAnalysisService;

  getCacheStats() { return this.svc.getCacheStats(); }
  clearCache() { this.svc.clearCache(); }
}
