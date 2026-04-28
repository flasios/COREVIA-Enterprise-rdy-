import type { TeamDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";
import { logger } from "@platform/logging/Logger";


// ═══════════════════════════════════════════════════════════════════
//  TEAM USE-CASES
// ═══════════════════════════════════════════════════════════════════

export async function listTeams(
  deps: Pick<TeamDeps, "teams">,
): Promise<PortResult> {
  try {
    const data = await deps.teams.getTeams();
    return ok(data);
  } catch (e) {
    logger.error("Error fetching teams:", e);
    return fail(500, "Failed to fetch teams");
  }
}


export async function createTeam(
  deps: Pick<TeamDeps, "teams" | "audit">,
  userId: string,
  body: Record<string, unknown>,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const team = await deps.teams.createTeam({ ...body, createdBy: userId });
    await deps.audit.log({
      userId,
      action: "create_team",
      result: "success",
      details: { teamId: (team as any).id, teamName: (team as any).name }, // eslint-disable-line @typescript-eslint/no-explicit-any
      ipAddress: ipAddress ?? null,
    });
    return ok(team);
  } catch (e) {
    logger.error("Error creating team:", e);
    return fail(500, "Failed to create team");
  }
}


export async function updateTeam(
  deps: Pick<TeamDeps, "teams" | "audit">,
  userId: string,
  teamId: string,
  body: Record<string, unknown>,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const team = await deps.teams.updateTeam(teamId, body);
    if (!team) return fail(404, "Team not found");
    await deps.audit.log({
      userId,
      action: "update_team",
      result: "success",
      details: { teamId: (team as any).id, updates: Object.keys(body) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      ipAddress: ipAddress ?? null,
    });
    return ok(team);
  } catch (e) {
    logger.error("Error updating team:", e);
    return fail(500, "Failed to update team");
  }
}


export async function deleteTeam(
  deps: Pick<TeamDeps, "teams" | "audit">,
  userId: string,
  teamId: string,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const success = await deps.teams.deleteTeam(teamId);
    if (!success) return fail(404, "Team not found");
    await deps.audit.log({
      userId,
      action: "delete_team",
      result: "success",
      details: { teamId },
      ipAddress: ipAddress ?? null,
    });
    return ok(null, "Team deleted successfully");
  } catch (e) {
    logger.error("Error deleting team:", e);
    return fail(500, "Failed to delete team");
  }
}


export async function getTeamMembers(
  deps: Pick<TeamDeps, "teams">,
  teamId: string,
): Promise<PortResult> {
  try {
    const data = await deps.teams.getTeamMembers(teamId);
    return ok(data);
  } catch (e) {
    logger.error("Error fetching team members:", e);
    return fail(500, "Failed to fetch team members");
  }
}


export async function addTeamMember(
  deps: Pick<TeamDeps, "teams" | "audit">,
  authUserId: string,
  teamId: string,
  body: { userId: string; role?: string },
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const member = await deps.teams.addTeamMember({
      teamId,
      userId: body.userId,
      role: (body.role || "member") as 'member' | 'lead',
      addedBy: authUserId,
    });
    await deps.audit.log({
      userId: authUserId,
      action: "add_team_member",
      result: "success",
      details: { teamId, addedUserId: body.userId, role: body.role },
      ipAddress: ipAddress ?? null,
    });
    return ok(member);
  } catch (e) {
    logger.error("Error adding team member:", e);
    return fail(500, "Failed to add team member");
  }
}


export async function removeTeamMember(
  deps: Pick<TeamDeps, "teams" | "audit">,
  authUserId: string,
  teamId: string,
  memberUserId: string,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const success = await deps.teams.removeTeamMember(teamId, memberUserId);
    if (!success) return fail(404, "Team member not found");
    await deps.audit.log({
      userId: authUserId,
      action: "remove_team_member",
      result: "success",
      details: { teamId, removedUserId: memberUserId },
      ipAddress: ipAddress ?? null,
    });
    return ok(null, "Team member removed successfully");
  } catch (e) {
    logger.error("Error removing team member:", e);
    return fail(500, "Failed to remove team member");
  }
}
