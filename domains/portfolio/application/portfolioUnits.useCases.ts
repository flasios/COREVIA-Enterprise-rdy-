import type { PortResult } from "./shared";
import type { PortfolioStorageSlice } from "./buildDeps";
import type { ProjectRepository, UserReader } from "../domain/ports";
import type { PortfolioProject, Team, User } from "@shared/schema";

const PMU_PREFIX = "PMU::";
const PMU_META_PREFIX = "__PMU__";

type PortfolioUnitMeta = {
  sector?: string;
  description?: string;
  status?: "active" | "archived";
  managerUserId?: string;
};

type PortfolioUnitMemberRole = "manager" | "analyst" | "viewer";

type PortfolioUnitMember = {
  userId: string;
  role: PortfolioUnitMemberRole;
  displayName: string;
  email: string;
};

type PortfolioUnitSummary = {
  id: string;
  name: string;
  sector: string;
  description: string;
  status: "active" | "archived";
  manager: { id: string; displayName: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  atRiskCount: number;
  totalBudget: number;
};

type PortfolioUnitsDeps = {
  storage: PortfolioStorageSlice;
  projects: ProjectRepository;
  users: UserReader;
};

function serializeMeta(meta: PortfolioUnitMeta): string {
  return `${PMU_META_PREFIX}${JSON.stringify(meta)}`;
}

function parseMeta(description: string | null | undefined): PortfolioUnitMeta {
  if (!description || !description.startsWith(PMU_META_PREFIX)) return {};
  const payload = description.slice(PMU_META_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as PortfolioUnitMeta;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function isPortfolioUnit(team: Team): boolean {
  return typeof team.name === "string" && team.name.startsWith(PMU_PREFIX);
}

function toDisplayName(teamName: string): string {
  return teamName.startsWith(PMU_PREFIX) ? teamName.slice(PMU_PREFIX.length).trim() : teamName;
}

function mapTeamRoleToPortfolioRole(role: string | null | undefined): PortfolioUnitMemberRole {
  if (role === "lead") return "manager";
  if (role === "viewer") return "viewer";
  return "analyst";
}

function mapPortfolioRoleToTeamRole(role: PortfolioUnitMemberRole): "lead" | "member" {
  return role === "manager" ? "lead" : "member";
}

function getProjectUnitId(project: PortfolioProject): string | null {
  const metadata = (project.metadata ?? null) as Record<string, unknown> | null;
  const raw = metadata?.portfolioUnitId;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function buildUnitSummary(
  deps: PortfolioUnitsDeps,
  team: Team,
  usersById: Map<string, User>,
  projects: PortfolioProject[],
): Promise<PortfolioUnitSummary> {
  const meta = parseMeta(team.description);
  const members = await deps.storage.getTeamMembers(team.id);
  const managerMember = members.find((member) => member.role === "lead");
  const managerId = meta.managerUserId || managerMember?.userId || null;
  const managerUser = managerId ? usersById.get(managerId) || null : null;

  const unitProjects = projects.filter((project) => getProjectUnitId(project) === team.id);
  const atRiskCount = unitProjects.filter((project) => project.healthStatus === "at_risk" || project.healthStatus === "critical").length;
  const totalBudget = unitProjects.reduce((sum, project) => sum + toSafeNumber(project.approvedBudget), 0);

  return {
    id: team.id,
    name: toDisplayName(team.name),
    sector: meta.sector || "General",
    description: meta.description || "",
    status: meta.status === "archived" ? "archived" : "active",
    manager: managerUser
      ? {
          id: managerUser.id,
          displayName: managerUser.displayName,
          email: managerUser.email,
        }
      : null,
    memberCount: members.length,
    projectCount: unitProjects.length,
    atRiskCount,
    totalBudget,
  };
}

export async function listPortfolioUnits(deps: PortfolioUnitsDeps): Promise<PortResult<PortfolioUnitSummary[]>> {
  const teams = await deps.storage.getTeams();
  const unitTeams = teams.filter(isPortfolioUnit);
  const users = await deps.users.getAll();
  const usersById = new Map(users.map((user) => [user.id, user]));
  const projects = await deps.projects.getAll();

  const summaries = await Promise.all(unitTeams.map((team) => buildUnitSummary(deps, team, usersById, projects)));
  summaries.sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1;
    if (right.projectCount !== left.projectCount) return right.projectCount - left.projectCount;
    return left.name.localeCompare(right.name);
  });

  return { success: true, data: summaries };
}

export async function createPortfolioUnit(
  deps: PortfolioUnitsDeps,
  userId: string,
  body: {
    name: string;
    sector?: string;
    description?: string;
    managerUserId?: string;
  },
): Promise<PortResult<PortfolioUnitSummary>> {
  const name = body.name.trim();
  if (name.length < 2) return { success: false, error: "Portfolio unit name is required", status: 400 };

  const meta: PortfolioUnitMeta = {
    sector: body.sector?.trim() || "General",
    description: body.description?.trim() || "",
    status: "active",
    managerUserId: body.managerUserId || undefined,
  };

  const team = await deps.storage.createTeam({
    name: `${PMU_PREFIX}${name}`,
    description: serializeMeta(meta),
    color: "#1D4ED8",
    createdBy: userId,
  });

  if (body.managerUserId) {
    await deps.storage.addTeamMember({
      teamId: team.id,
      userId: body.managerUserId,
      role: "lead",
      addedBy: userId,
    });
  }

  const users = await deps.users.getAll();
  const usersById = new Map(users.map((user) => [user.id, user]));
  const projects = await deps.projects.getAll();
  const summary = await buildUnitSummary(deps, team, usersById, projects);
  return { success: true, data: summary };
}

export async function updatePortfolioUnit(
  deps: PortfolioUnitsDeps,
  unitId: string,
  body: {
    name?: string;
    sector?: string;
    description?: string;
    status?: "active" | "archived";
    managerUserId?: string | null;
  },
): Promise<PortResult<PortfolioUnitSummary>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  const oldMeta = parseMeta(team.description);
  const nextMeta: PortfolioUnitMeta = {
    sector: body.sector?.trim() ?? oldMeta.sector ?? "General",
    description: body.description?.trim() ?? oldMeta.description ?? "",
    status: body.status ?? oldMeta.status ?? "active",
    managerUserId: body.managerUserId === null ? undefined : body.managerUserId ?? oldMeta.managerUserId,
  };

  const nextName = body.name?.trim().length ? `${PMU_PREFIX}${body.name.trim()}` : team.name;

  const updated = await deps.storage.updateTeam(unitId, {
    name: nextName,
    description: serializeMeta(nextMeta),
  });

  if (!updated) return { success: false, error: "Failed to update portfolio unit", status: 500 };

  const users = await deps.users.getAll();
  const usersById = new Map(users.map((user) => [user.id, user]));
  const projects = await deps.projects.getAll();
  const summary = await buildUnitSummary(deps, updated, usersById, projects);
  return { success: true, data: summary };
}

export async function listPortfolioUnitMembers(
  deps: PortfolioUnitsDeps,
  unitId: string,
): Promise<PortResult<PortfolioUnitMember[]>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  const members = await deps.storage.getTeamMembers(unitId);
  const data: PortfolioUnitMember[] = members.map((member) => ({
    userId: member.userId,
    role: mapTeamRoleToPortfolioRole(member.role),
    displayName: member.user.displayName,
    email: member.user.email,
  }));
  return { success: true, data };
}

export async function addPortfolioUnitMember(
  deps: PortfolioUnitsDeps,
  userId: string,
  unitId: string,
  body: { memberUserId: string; role: PortfolioUnitMemberRole },
): Promise<PortResult<{ ok: true }>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  await deps.storage.addTeamMember({
    teamId: unitId,
    userId: body.memberUserId,
    role: mapPortfolioRoleToTeamRole(body.role),
    addedBy: userId,
  });

  if (body.role === "manager") {
    const meta = parseMeta(team.description);
    await deps.storage.updateTeam(unitId, {
      description: serializeMeta({ ...meta, managerUserId: body.memberUserId }),
    });
  }

  return { success: true, data: { ok: true } };
}

export async function removePortfolioUnitMember(
  deps: PortfolioUnitsDeps,
  unitId: string,
  memberUserId: string,
): Promise<PortResult<{ ok: true }>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  const removed = await deps.storage.removeTeamMember(unitId, memberUserId);
  if (!removed) return { success: false, error: "Member not found", status: 404 };

  const meta = parseMeta(team.description);
  if (meta.managerUserId === memberUserId) {
    await deps.storage.updateTeam(unitId, {
      description: serializeMeta({ ...meta, managerUserId: undefined }),
    });
  }

  return { success: true, data: { ok: true } };
}

export async function assignProjectToPortfolioUnit(
  deps: PortfolioUnitsDeps,
  unitId: string,
  projectId: string,
): Promise<PortResult<{ ok: true }>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };

  const metadata = (project.metadata ?? {}) as Record<string, unknown>;
  await deps.projects.update(projectId, {
    metadata: {
      ...metadata,
      portfolioUnitId: unitId,
      portfolioUnitName: toDisplayName(team.name),
    },
  });

  return { success: true, data: { ok: true } };
}

export async function listPortfolioUnitProjects(
  deps: PortfolioUnitsDeps,
  unitId: string,
): Promise<PortResult<PortfolioProject[]>> {
  const team = await deps.storage.getTeam(unitId);
  if (!team || !isPortfolioUnit(team)) return { success: false, error: "Portfolio unit not found", status: 404 };

  const projects = await deps.projects.getAll();
  const filtered = projects.filter((project) => getProjectUnitId(project) === unitId);
  return { success: true, data: filtered };
}
