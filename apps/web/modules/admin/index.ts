/**
 * Admin Module — Public API surface.
 *
 * Covers user management, team management, system monitoring.
 */

// ── Types ─────────────────────────────────────────────────────────────
export {
  createUserFormSchema,
  editUserFormSchema,
  resetPasswordFormSchema,
  type CreateUserFormData,
  type EditUserFormData,
  type ResetPasswordFormData,
} from "./types/userManagement";

export {
  createTeamFormSchema,
  editTeamFormSchema,
  type CreateTeamFormData,
  type EditTeamFormData,
} from "./types/teamManagement";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchTeams,
} from "./api/adminApi";
