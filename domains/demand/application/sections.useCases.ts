import type { DemandAllDeps } from "./buildDeps";
import type { InsertSectionAssignment, UpdateSectionAssignment } from "@shared/schema";
import { DemandResult } from "./shared";
import { logger } from "@platform/logging/Logger";


// ══════════════════════════════════════════════════════════════════════
// Section Assignment Use-Cases
// ══════════════════════════════════════════════════════════════════════

export async function listSectionAssignments(
  deps: Pick<DemandAllDeps, "sections">,
  reportId: string,
): Promise<DemandResult<unknown[]>> {
  const assignments = await deps.sections.findByReportId(reportId);
  return { success: true, data: assignments };
}


export async function assignSection(
  deps: Pick<DemandAllDeps, "reports" | "sections" | "audit" | "notifier" | "users">,
  reportId: string,
  userId: string,
  body: {
    sectionName: string;
    assignedToTeamId?: string | null;
    assignedToUserId?: string | null;
    notes?: string;
    status?: string;
  },
  auditContext: { storage: unknown; req: unknown },
): Promise<DemandResult<unknown>> {
  const assignment = await deps.sections.assign({
    reportId,
    sectionName: body.sectionName,
    assignedBy: userId,
    assignedToTeamId: body.assignedToTeamId || null,
    assignedToUserId: body.assignedToUserId || null,
    notes: body.notes,
    status: (body.status || "pending_confirmation") as InsertSectionAssignment['status'],
  } as Partial<InsertSectionAssignment>);

  await deps.audit.log({
    storage: auditContext.storage,
    req: auditContext.req,
    userId,
    action: "assign_section",
    result: "success",
    details: {
      reportId,
      sectionName: body.sectionName,
      assignedToTeamId: body.assignedToTeamId,
      assignedToUserId: body.assignedToUserId,
    },
  });

  // Send notifications (non-blocking)
  if (body.assignedToTeamId) {
    try {
      const teamMembers = await deps.users.getTeamMembers(body.assignedToTeamId);
      const team = await deps.users.getTeam(body.assignedToTeamId);
      const report = await deps.reports.findById(reportId);
      const assignedByUser = await deps.users.getUser(userId);

      if (teamMembers.length > 0 && team && report && assignedByUser) {
        const memberEmails = teamMembers.map((m) => ({
          email: m.user.email,
          displayName: m.user.displayName,
        }));

        const result = await deps.notifier.sendTeamAssignment(
          memberEmails,
          team.name,
          body.sectionName,
          report.requestorName + "'s " + report.organizationName + " Project",
          reportId,
          assignedByUser.displayName,
          body.notes,
        );
        logger.info(`Team assignment notifications: ${result.sent} sent, ${result.failed} failed`);

        try {
          const reportTitle = report.requestorName + "'s " + report.organizationName + " Project";
          let notificationCount = 0;
          for (const member of teamMembers) {
            await deps.users.createNotification({
              userId: member.userId,
              type: "section_assigned",
              title: "New Section Assignment",
              message: `You have been assigned to ${body.sectionName} for ${reportTitle}`,
              reportId,
              sectionName: body.sectionName,
              metadata: {
                assignedBy: assignedByUser.displayName,
                assignedByUserId: assignedByUser.id,
                teamName: team.name,
              },
              isRead: false,
            });
            notificationCount++;
          }
          logger.info(`Created ${notificationCount} in-app notifications for team assignment`);
        } catch (inAppNotificationError) {
          logger.error("Error creating in-app notifications for team assignment:", inAppNotificationError);
        }
      }
    } catch (notificationError) {
      logger.error("Error sending team assignment notifications:", notificationError);
    }
  } else if (body.assignedToUserId) {
    try {
      const assignedUser = await deps.users.getUser(body.assignedToUserId);
      const report = await deps.reports.findById(reportId);
      const assignedByUser = await deps.users.getUser(userId);

      if (assignedUser && report && assignedByUser) {
        const result = await deps.notifier.sendTeamAssignment(
          [{ email: assignedUser.email, displayName: assignedUser.displayName }],
          assignedUser.displayName,
          body.sectionName,
          report.requestorName + "'s " + report.organizationName + " Project",
          reportId,
          assignedByUser.displayName,
          body.notes,
        );
        logger.info(`Individual user assignment notification: ${result.sent} sent, ${result.failed} failed`);

        try {
          const reportTitle = report.requestorName + "'s " + report.organizationName + " Project";
          await deps.users.createNotification({
            userId: assignedUser.id,
            type: "section_assigned",
            title: "New Section Assignment",
            message: `You have been assigned to ${body.sectionName} for ${reportTitle}`,
            reportId,
            sectionName: body.sectionName,
            metadata: {
              assignedBy: assignedByUser.displayName,
              assignedByUserId: assignedByUser.id,
            },
            isRead: false,
          });
          logger.info("Created 1 in-app notification for individual user assignment");
        } catch (inAppNotificationError) {
          logger.error("Error creating in-app notification for individual user assignment:", inAppNotificationError);
        }
      }
    } catch (notificationError) {
      logger.error("Error sending individual user assignment notification:", notificationError);
    }
  }

  return { success: true, data: assignment };
}


export async function updateSectionAssignment(
  deps: Pick<DemandAllDeps, "reports" | "sections" | "audit" | "users">,
  reportId: string,
  sectionName: string,
  currentUserId: string,
  body: { status?: string; notes?: string },
  auditContext: { storage: unknown; req: unknown },
): Promise<DemandResult<unknown>> {
  if (body.status && !["pending_confirmation", "in_progress", "under_review", "completed"].includes(body.status)) {
    return { success: false, error: "Invalid status value", status: 400 };
  }

  const assignment = await deps.sections.findByReportIdAndSection(reportId, sectionName);
  if (!assignment) return { success: false, error: "Section assignment not found", status: 404 };

  // Authorization check: must be assigned user or team member
  let isAuthorized = false;
  if (assignment.assignedToUserId === currentUserId) isAuthorized = true;
  if (assignment.assignedToTeamId && !isAuthorized) {
    const userTeams = await deps.users.getUserTeams(currentUserId);
    isAuthorized = userTeams.some((team) => team.id === assignment.assignedToTeamId);
  }
  if (!isAuthorized) {
    return {
      success: false,
      error: "You are not authorized to update this assignment. Only the assignee or team members can update it.",
      status: 403,
    };
  }

  const previousStatus = assignment.status;

  const updatedAssignment = await deps.sections.update(reportId, sectionName, {
    ...(body.status && { status: body.status as UpdateSectionAssignment['status'] }),
    ...(body.notes !== undefined && { notes: body.notes }),
    statusUpdatedBy: currentUserId,
    statusUpdatedAt: new Date(),
  } as Partial<UpdateSectionAssignment>);

  if (!updatedAssignment) return { success: false, error: "Failed to update section assignment", status: 404 };

  await deps.audit.log({
    storage: auditContext.storage,
    req: auditContext.req,
    userId: currentUserId,
    action: "update_section_assignment",
    result: "success",
    details: {
      reportId,
      sectionName,
      previousStatus,
      newStatus: body.status,
      notesUpdated: body.notes !== undefined,
    },
  });

  // Notify team members of status change
  if (body.status && body.status !== previousStatus) {
    try {
      const report = await deps.reports.findById(reportId);
      const updatedByUser = await deps.users.getUser(currentUserId);

      if (report && updatedByUser && assignment.assignedToTeamId) {
        const teamMembers = await deps.users.getTeamMembers(assignment.assignedToTeamId);
        let notificationCount = 0;
        for (const member of teamMembers) {
          if (member.userId !== currentUserId) {
            await deps.users.createNotification({
              userId: member.userId,
              type: "status_changed",
              title: `Section Review Updated: ${sectionName}`,
              message: `The ${sectionName} section is now ${body.status.replaceAll("_", " ")}. Open the request section to review the latest update from ${updatedByUser.displayName}.`,
              reportId,
              sectionName,
              metadata: {
                previousStatus,
                newStatus: body.status,
                updatedBy: updatedByUser.displayName,
              },
              isRead: false,
            });
            notificationCount++;
          }
        }
        logger.info(`Created ${notificationCount} in-app notifications for status change`);
      }
    } catch (inAppNotificationError) {
      logger.error("Error creating in-app notifications for status change:", inAppNotificationError);
    }
  }

  return { success: true, data: updatedAssignment };
}


export async function removeSectionAssignment(
  deps: Pick<DemandAllDeps, "sections" | "audit">,
  reportId: string,
  sectionName: string,
  userId: string,
  auditContext: { storage: unknown; req: unknown },
): Promise<DemandResult<{ removed: boolean }>> {
  const success = await deps.sections.remove(reportId, sectionName);
  if (!success) return { success: false, error: "Section assignment not found", status: 404 };

  await deps.audit.log({
    storage: auditContext.storage,
    req: auditContext.req,
    userId,
    action: "remove_section_assignment",
    result: "success",
    details: { reportId, sectionName },
  });

  return { success: true, data: { removed: true } };
}
