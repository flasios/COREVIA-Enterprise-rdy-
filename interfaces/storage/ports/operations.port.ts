/**
 * Operations Storage Port — Teams, sections, notifications, audit logs
 */
import type {
  InsertAuditLog,
  SelectAuditLog,
  Team,
  InsertTeam,
  UpdateTeam,
  TeamMember,
  InsertTeamMember,
  User,
  SectionAssignment,
  InsertSectionAssignment,
  UpdateSectionAssignment,
  Notification,
  InsertNotification,
} from "@shared/schema";

export interface IOperationsStoragePort {
  // Audit Logs (append-only)
  createAuditLog(log: InsertAuditLog): Promise<SelectAuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SelectAuditLog[]>;

  // Team Management
  createTeam(team: InsertTeam & { createdBy: string }): Promise<Team>;
  getTeam(id: string): Promise<Team | undefined>;
  getTeams(): Promise<Team[]>;
  updateTeam(id: string, updates: UpdateTeam): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;

  // Team Members Management
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getTeamMembers(teamId: string): Promise<Array<TeamMember & { user: User }>>;
  removeTeamMember(teamId: string, userId: string): Promise<boolean>;
  getUserTeams(userId: string): Promise<Array<Team>>;

  // Section Assignments Management
  assignSection(assignment: InsertSectionAssignment & { assignedBy: string }): Promise<SectionAssignment>;
  getSectionAssignments(reportId: string): Promise<Array<SectionAssignment & {
    team?: Team | null;
    user?: User | null;
    assignedByUser: User;
  }>>;
  getSectionAssignment(reportId: string, sectionName: string): Promise<SectionAssignment | undefined>;
  updateSectionAssignment(reportId: string, sectionName: string, updates: UpdateSectionAssignment): Promise<SectionAssignment | undefined>;
  updateSectionAssignmentStatus(reportId: string, sectionName: string, status: string, updatedBy: string): Promise<boolean>;
  removeSectionAssignment(reportId: string, sectionName: string): Promise<boolean>;
  getUserAssignedSections(userId: string, reportId: string): Promise<string[]>;
  getUserAssignedSectionsWithStatus(userId: string, reportId: string): Promise<Array<{ sectionName: string; status: string }>>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  deleteNotification(notificationId: string): Promise<boolean>;
}
