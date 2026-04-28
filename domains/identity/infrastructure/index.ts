/**
 * Identity Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (email, storage, APIs).
 * Implements ports defined in ./domain.
 *
 * Allowed imports: ./domain (ports), platform/db, platform/cache, platform/queue.
 */

export { StorageUserRepository } from "./userRepository";
export { BcryptPasswordHasher } from "./passwordHasher";
export { StorageAuditLogger } from "./auditLogger";
export { ExpressSessionManager } from "./sessionManager";
