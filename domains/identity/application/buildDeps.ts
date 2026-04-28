/**
 * Identity Module — Dependency Wiring
 *
 * Builds the IdentityDeps aggregate from infrastructure adapters.
 * This keeps the API layer free of infrastructure imports.
 */
import type { Request } from "express";
import type {
  IIdentityStoragePort,
  IOperationsStoragePort,
} from "@interfaces/storage/ports";
import type { IdentityDeps } from "./useCases";
import {
  StorageUserRepository,
  BcryptPasswordHasher,
  StorageAuditLogger,
  ExpressSessionManager as IdentityExpressSessionManager,
} from "../infrastructure";

export type IdentityStorageSlice = IIdentityStoragePort & IOperationsStoragePort;

export function buildIdentityDeps(storage: IdentityStorageSlice, req: Request): IdentityDeps {
  return {
    users: new StorageUserRepository(storage),
    passwords: new BcryptPasswordHasher(),
    audit: new StorageAuditLogger(storage, req),
    sessions: new IdentityExpressSessionManager(),
  };
}
