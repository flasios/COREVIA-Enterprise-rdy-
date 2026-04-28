/**
 * Operations Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for each route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  IOperationsStoragePort,
  IIdentityStoragePort,
  IPortfolioStoragePort,
} from "@interfaces/storage/ports";

/** Narrowed — drops unneeded port interfaces versus full IStorage. */
export type OpsStorageSlice = IOperationsStoragePort & IIdentityStoragePort & IPortfolioStoragePort;

import type {
  TeamRepository,
  AuditLoggerPort,
  UserRepository,
  PortfolioProjectReader,
  PasswordHasherPort,
  CacheManagerPort,
} from "../domain/ports";

import {
  StorageTeamRepository,
  StorageAuditLogger,
  StorageUserRepository,
  StoragePortfolioProjectReader,
  BcryptPasswordHasher,
  LegacyCacheManager,
} from "../infrastructure/adapters";

/* ─── Team deps ─────────────────────────────────────────────── */

export interface TeamDeps {
  teams: TeamRepository;
  audit: AuditLoggerPort;
}

export function buildTeamDeps(storage: OpsStorageSlice): TeamDeps {
  return {
    teams: new StorageTeamRepository(storage),
    audit: new StorageAuditLogger(storage),
  };
}

/* ─── User deps ─────────────────────────────────────────────── */

export interface UserDeps {
  users: UserRepository;
  projects: PortfolioProjectReader;
  audit: AuditLoggerPort;
  hasher: PasswordHasherPort;
}

export function buildUserDeps(storage: OpsStorageSlice): UserDeps {
  return {
    users: new StorageUserRepository(storage),
    projects: new StoragePortfolioProjectReader(storage),
    audit: new StorageAuditLogger(storage),
    hasher: new BcryptPasswordHasher(),
  };
}

/* ─── Cache deps ────────────────────────────────────────────── */

export interface CacheDeps {
  cache: CacheManagerPort;
}

export function buildCacheDeps(): CacheDeps {
  return {
    cache: new LegacyCacheManager(),
  };
}
