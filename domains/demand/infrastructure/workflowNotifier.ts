import type { WorkflowNotifier } from "../domain/ports";
import {
  WorkflowNotificationService,
  getSuperadminUserId,
} from "@platform/notifications";

/**
 * Wraps WorkflowNotificationService static methods + getSuperadminUserId
 * behind the WorkflowNotifier port.
 */
export class LegacyWorkflowNotifier implements WorkflowNotifier {
  constructor(private readonly storage: unknown) {}

  private readonly svc = WorkflowNotificationService;

  async sendMeetingRequest(
    email: string, name: string, title: string, org: string, reportId: string,
  ): Promise<boolean> {
    return this.svc.sendMeetingRequestNotification(email, name, title, org, reportId);
  }

  async sendManagerApproval(
    email: string, title: string, org: string, requesterName: string, reportId: string,
  ): Promise<boolean> {
    return this.svc.sendManagerApprovalNotification(email, title, org, requesterName, reportId);
  }

  async sendWorkflowStatus(
    email: string, name: string, title: string, org: string,
    status: string, reason: string, reportId: string,
  ): Promise<boolean> {
    return this.svc.sendWorkflowStatusNotification(email, name, title, org, status, reason, reportId);
  }

  async sendSpecialistNotification(
    email: string, name: string, role: string, title: string, org: string,
    params: { urgency: string; insight: string; reportId: string },
  ): Promise<boolean> {
    return this.svc.sendCoveriaSpecialistNotification(email, name, role, title, org, { urgency: params.urgency, coveriaInsight: params.insight, reportId: params.reportId });
  }

  async sendBusinessCaseMeeting(params: Record<string, unknown>): Promise<void> {
    await this.svc.sendBusinessCaseMeetingNotification(params as {
      recipientEmail: string;
      recipientName: string;
      demandTitle: string;
      organizationName: string;
      reportId: string;
      meetingDate: Date;
      meetingNotes?: string;
    });
  }

  async sendTeamAssignment(
    members: Array<{ email: string; displayName: string }>,
    teamName: string, sectionName: string, projectDesc: string,
    reportId: string, assignedByName: string, notes?: string,
  ): Promise<{ sent: number; failed: number }> {
    return this.svc.sendTeamAssignmentNotification(
      members, teamName, sectionName, projectDesc, reportId, assignedByName, notes,
    );
  }

  createNotificationLogEntry(type: string, email: string, success: boolean) {
    return this.svc.createNotificationLogEntry(
      type as 'meeting_request' | 'status_update' | 'manager_approval' | 'section_assignment' | 'section_status' | 'business_case_meeting' | 'coveria_specialist',
      email,
      success,
    );
  }

  async sendBusinessCaseToManager(
    managerEmail: string,
    businessCaseData: Record<string, unknown>,
    versionNumber: string,
    senderName: string,
    message: string,
    reportId: string,
    params: { versionId: string; reportTitle?: string },
  ): Promise<boolean> {
    return this.svc.sendBusinessCaseToManager(
      managerEmail,
      businessCaseData,
      versionNumber,
      senderName,
      message,
      reportId,
      params,
    );
  }

  async sendRequirementsToManager(
    managerEmail: string,
    requirementsData: Record<string, unknown>,
    teamAssignments: Array<{ team: string; [key: string]: unknown }>,
    versionNumber: string,
    senderName: string,
    message: string,
    params: { reportId: string; versionId: string; reportTitle?: string },
  ): Promise<boolean> {
    return this.svc.sendRequirementsToManager(
      managerEmail,
      requirementsData,
      teamAssignments,
      versionNumber,
      senderName,
      message,
      params,
    );
  }

  async getSuperadminUserId(): Promise<string | undefined> {
    return getSuperadminUserId() ?? undefined;
  }
}
