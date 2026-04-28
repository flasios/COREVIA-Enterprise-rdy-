/**
 * Portfolio Module — communications use-cases
 */

import type {
  CommsDeps,
} from "./buildDeps";

import { PortResult, asRecord } from "./shared";



export async function getProjectCommunications(deps: Pick<CommsDeps, "communications">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.communications.getByProject(projectId) };
}


export async function createCommunication(deps: Pick<CommsDeps, "communications">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.communications.create(validatedData) };
}


export async function updateCommunication(deps: Pick<CommsDeps, "communications">, id: string, validatedData: Record<string, unknown>): Promise<PortResult> {
  await deps.communications.update(id, validatedData);
  return { success: true, data: null };
}


export async function publishCommunication(deps: Pick<CommsDeps, "communications">, id: string): Promise<PortResult> {
  await deps.communications.update(id, { status: 'published', publishedAt: new Date(), sentAt: new Date() });
  return { success: true, data: null };
}


export async function deleteCommunication(deps: Pick<CommsDeps, "communications">, id: string): Promise<PortResult> {
  await deps.communications.delete(id);
  return { success: true, data: null };
}


export async function sendNotification(
  deps: Pick<CommsDeps, "email">,
  validated: { subject: string; content: string; recipients: Array<{ email: string; name: string }> },
): Promise<PortResult> {
  const results: { email: string; success: boolean }[] = [];
  for (const recipient of validated.recipients) {
    const personalizedContent = validated.content.replace(/\{\{recipient_name\}\}/g, recipient.name).replace(/\{\{project_name\}\}/g, 'Project');
    const success = await deps.email.send({
      to: recipient.email, from: 'falah.aldameiry@gmail.com', subject: validated.subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;"><h2 style="color: white; margin: 0;">Project Communication</h2></div><div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">${personalizedContent.replace(/\n/g, '<br/>')}</div><p style="color: #718096; font-size: 12px; text-align: center; margin-top: 20px;">Enterprise Intelligence - AI Transformation Platform Hub (EIAPH)</p></div>`,
    });
    results.push({ email: recipient.email, success });
  }
  const successCount = results.filter(r => r.success).length;
  return { success: true, data: { sent: successCount, total: validated.recipients.length, results } };
}


export async function getCommunicationPlan(
  deps: Pick<CommsDeps, "projects">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = (project.metadata as Record<string, unknown>) || {};
  return { success: true, data: (metadata.communicationPlan as Record<string, unknown>) || null };
}


export async function saveCommunicationPlan(
  deps: Pick<CommsDeps, "projects" | "users" | "notifications">,
  projectId: string,
  validated: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const existingMetadata = (project.metadata as Record<string, unknown>) || {};
  const wasApproved = (existingMetadata.communicationPlan as Record<string, unknown>)?.isApproved || false;
  const isNowApproved = (validated as Record<string, unknown>).isApproved;
  await deps.projects.update(projectId, { metadata: { ...existingMetadata, communicationPlan: validated } });
  let notificationsSent = 0;
  if (isNowApproved && !wasApproved) {
    const steeringCommitteeMembers = ((existingMetadata.steeringCommitteeMembers || []) as Array<{ userId: string }>);
    const allUsers = await deps.users.getAll();
    const activeUsers = allUsers.filter(u => u.isActive);
    const sponsorUser = activeUsers.find(u => u.displayName === project.sponsor);
    const pmUser = activeUsers.find(u => u.displayName === project.projectManager);
    const recipientIds = new Set<string>();
    if (sponsorUser) recipientIds.add(sponsorUser.id);
    if (pmUser) recipientIds.add(pmUser.id);
    steeringCommitteeMembers.forEach((m) => { if (m.userId) recipientIds.add(m.userId); });
    const recipientUserIds = recipientIds.size > 0 ? Array.from(recipientIds) : activeUsers.map(u => u.id);
    const projectDisplayName = project.projectName || 'Project';
    await Promise.all(recipientUserIds.map(uId =>
      deps.notifications.create({
        userId: uId, type: 'communication_plan_activated',
        title: `${projectDisplayName}: Communication Plan Active`,
        message: `You're now subscribed to project updates for "${projectDisplayName}". You'll receive notifications about milestones, status updates, and important project events.`,
        metadata: { projectId, projectName: projectDisplayName },
      })
    ));
    notificationsSent = recipientUserIds.length;
  }
  return { success: true, data: { ...validated, notificationsSent } };
}


export async function approveCommunicationPlan(
  deps: Pick<CommsDeps, "projects" | "users" | "email">,
  projectId: string,
  userId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = asRecord(project.metadata);
  const plan = asRecord(metadata.communicationPlan);
  if (!plan || Object.keys(plan).length === 0) return { success: false, error: "No communication plan found", status: 404 };
  const approvedPlan = { ...plan, isApproved: true, approvedBy: userId, approvedAt: new Date().toISOString() };
  await deps.projects.update(projectId, { metadata: { ...metadata, communicationPlan: approvedPlan } });
  // Email blast to all users with active emails
  let emailsSent = 0;
  try {
    const allUsers = await deps.users.getAll();
    const activeEmails = allUsers.filter(u => u.isActive && u.email).map(u => ({ email: u.email, name: u.displayName || u.username }));
    for (const recipient of activeEmails) {
      await deps.email.send({ to: recipient.email, from: 'falah.aldameiry@gmail.com', subject: `Communication Plan Approved: ${project.projectName}`, html: `<p>The communication plan for ${project.projectName} has been approved.</p>` });
      emailsSent++;
    }
  } catch (_e) { /* non-blocking */ }
  return { success: true, data: { ...approvedPlan, emailsSent } };
}


export async function executeCommunicationTrigger(
  deps: Pick<CommsDeps, "projects" | "notifications" | "email">,
  projectId: string,
  triggerType: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = asRecord(project.metadata);
  const plan = asRecord(metadata.communicationPlan);
  if (!plan?.isApproved) return { success: false, error: "Communication plan not approved", status: 400 };
  const stakeholderIds = [project.projectManagerId, project.sponsorId, project.financialDirectorId].filter(Boolean) as string[];
  for (const sid of stakeholderIds) {
    await deps.notifications.create({
      userId: sid, type: `comms_trigger_${triggerType}`,
      title: `${project.projectName}: ${triggerType.replace(/_/g, ' ')}`,
      message: `Communication trigger "${triggerType}" executed for project "${project.projectName}".`,
      metadata: { projectId, triggerType },
    });
  }
  return { success: true, data: { triggerType, notificationsSent: stakeholderIds.length } };
}

