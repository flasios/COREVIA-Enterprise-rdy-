/**
 * Identity Module — Application Layer
 *
 * Use-cases: login, register, session management, permission checks.
 * Orchestrates domain rules + infrastructure adapters.
 *
 * Allowed imports: ./domain, shared/contracts, platform abstractions.
 */
export {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  checkSession,
  registerSchema,
  loginSchema,
  type IdentityDeps,
  type AuthResult,
} from "./useCases";

export { buildIdentityDeps } from "./buildDeps";
export { ExpressSessionManager } from "../infrastructure";
