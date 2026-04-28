import { Router, type Request } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildSummaryDeps } from "../application/buildDeps";
import { getManagementSummary, type PortResult } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";

type AuditEvidenceItem = {
  id: string;
  taskId: string;
  taskCode: string | null;
  title: string | null;
  taskType: string;
  status: string;
  evidenceSource: "task" | "document";
  evidenceFileName: string | null;
  evidenceUrl: string | null;
  evidenceUploadedAt: string | null;
  evidenceUploadedBy: string | null;
  evidenceVerificationStatus: string | null;
  evidenceVerifiedAt: string | null;
  evidenceVerificationNotes: string | null;
};

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createPortfolioSummaryRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildSummaryDeps(storage);

  router.get("/projects/:projectId/management-summary", auth.requireAuth, asyncHandler(async (req, res) => {
    const userId = (req as Request & { auth?: { userId?: string } }).auth?.userId || 'system';
    send(res, await getManagementSummary(deps, req.params.projectId!, userId));
  }));

  // ── QA Audit: all projects with WBS evidence status ──────
  router.get("/qa/audit", auth.requireAuth, asyncHandler(async (_req, res) => {
    try {
      const { db } = await import("@platform/db");
      const { taskEvidence } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const projects = await deps.projects.getAll();
      const auditData = await Promise.all(
        (projects as Array<Record<string, unknown>>).map(async (project) => {
          const projectId = String(project.id);
          const [tasks, risks, stakeholders, documents, evidenceRows] = await Promise.all([
            deps.wbs.getByProject(projectId),
            deps.risks.getByProject(projectId),
            deps.stakeholders.getByProject(projectId),
            deps.documents.getByProject(projectId),
            db.select().from(taskEvidence).where(eq(taskEvidence.projectId, projectId)),
          ]);

          // Normalize tasks for consistent field names
          const normalizedTasks = (tasks as Array<Record<string, unknown>>).map((t) => ({
            id: t.id,
            taskCode: t.task_code || t.taskCode,
            title: t.title,
            wbsLevel: t.wbs_level ?? t.wbsLevel,
            taskType: t.task_type || t.taskType || 'task',
            status: t.status || 'not_started',
            progress: t.progress ?? 0,
            parentTaskId: t.parent_task_id || t.parentTaskId,
            assignedTo: t.assigned_to || t.assignedTo,
            evidenceUrl: t.evidence_url || t.evidenceUrl,
            evidenceFileName: t.evidence_file_name || t.evidenceFileName,
            evidenceNotes: t.evidence_notes || t.evidenceNotes,
            evidenceUploadedAt: t.evidence_uploaded_at || t.evidenceUploadedAt,
            evidenceUploadedBy: t.evidence_uploaded_by || t.evidenceUploadedBy,
            evidenceVerificationStatus: t.evidence_verification_status || t.evidenceVerificationStatus || 'pending',
            evidenceVerifiedBy: t.evidence_verified_by || t.evidenceVerifiedBy,
            evidenceVerifiedAt: t.evidence_verified_at || t.evidenceVerifiedAt,
            evidenceVerificationNotes: t.evidence_verification_notes || t.evidenceVerificationNotes,
          }));

          const taskLookup = new Map(normalizedTasks.map((task) => [String(task.id), task]));
          const legacyEvidenceItems: AuditEvidenceItem[] = normalizedTasks
            .filter((task) => Boolean(task.evidenceUrl || task.evidenceFileName))
            .map((task) => ({
              id: String(task.id),
              taskId: String(task.id),
              taskCode: task.taskCode ? String(task.taskCode) : null,
              title: task.title ? String(task.title) : null,
              taskType: String(task.taskType || 'task'),
              status: String(task.status || 'not_started'),
              evidenceSource: 'task',
              evidenceFileName: task.evidenceFileName ? String(task.evidenceFileName) : null,
              evidenceUrl: task.evidenceUrl ? String(task.evidenceUrl) : null,
              evidenceUploadedAt: task.evidenceUploadedAt ? String(task.evidenceUploadedAt) : null,
              evidenceUploadedBy: task.evidenceUploadedBy ? String(task.evidenceUploadedBy) : null,
              evidenceVerificationStatus: task.evidenceVerificationStatus ? String(task.evidenceVerificationStatus) : 'pending',
              evidenceVerifiedAt: task.evidenceVerifiedAt ? String(task.evidenceVerifiedAt) : null,
              evidenceVerificationNotes: task.evidenceVerificationNotes ? String(task.evidenceVerificationNotes) : null,
            }));

          const documentEvidenceItems = (evidenceRows as Array<Record<string, unknown>>).reduce<AuditEvidenceItem[]>((items, row) => {
            const taskId = String(row.taskId || row.task_id || '');
            const task = taskLookup.get(taskId);
            if (!task) return items;

            items.push({
              id: String(row.id),
              taskId,
              taskCode: task.taskCode ? String(task.taskCode) : null,
              title: task.title ? String(task.title) : null,
              taskType: String(task.taskType || 'task'),
              status: String(task.status || 'not_started'),
              evidenceSource: 'document',
              evidenceFileName: row.fileName ? String(row.fileName) : row.file_name ? String(row.file_name) : null,
              evidenceUrl: row.fileUrl ? String(row.fileUrl) : row.file_url ? String(row.file_url) : null,
              evidenceUploadedAt: row.uploadedAt ? String(row.uploadedAt) : row.uploaded_at ? String(row.uploaded_at) : null,
              evidenceUploadedBy: row.uploadedBy ? String(row.uploadedBy) : row.uploaded_by ? String(row.uploaded_by) : null,
              evidenceVerificationStatus: row.verificationStatus ? String(row.verificationStatus) : row.verification_status ? String(row.verification_status) : 'pending',
              evidenceVerifiedAt: row.verifiedAt ? String(row.verifiedAt) : row.verified_at ? String(row.verified_at) : null,
              evidenceVerificationNotes: row.verificationNotes ? String(row.verificationNotes) : row.verification_notes ? String(row.verification_notes) : null,
            });

            return items;
          }, []);

          const evidenceItems = [...legacyEvidenceItems, ...documentEvidenceItems]
            .sort((left, right) => new Date(right.evidenceUploadedAt || 0).getTime() - new Date(left.evidenceUploadedAt || 0).getTime());
          const tasksWithEvidence = new Set(evidenceItems.map((item) => item.taskId)).size;
          const approvedEvidence = evidenceItems.filter((item) => item.evidenceVerificationStatus === 'approved').length;
          const pendingEvidence = evidenceItems.filter((item) => item.evidenceVerificationStatus === 'pending').length;
          const rejectedEvidence = evidenceItems.filter((item) => item.evidenceVerificationStatus === 'rejected').length;

          const totalTasks = normalizedTasks.filter((t) => t.taskType === 'task').length;
          const completedTasks = normalizedTasks.filter((t) => t.taskType === 'task' && t.status === 'completed').length;

          const deliverables = normalizedTasks.filter((t) => t.taskType === 'deliverable');
          const milestones = normalizedTasks.filter((t) => t.taskType === 'milestone');
          const totalRisks = (risks as unknown[]).length;

          return {
            project: {
              id: project.id,
              projectCode: project.project_code || project.projectCode,
              projectName: project.project_name || project.projectName,
              currentPhase: project.current_phase || project.currentPhase,
              overallProgress: project.overall_progress ?? project.overallProgress ?? 0,
              healthStatus: project.health_status || project.healthStatus || 'on_track',
              priority: project.priority || 'medium',
              charterStatus: project.charter_status || project.charterStatus,
              projectManager: project.project_manager || project.projectManager,
              approvedBudget: project.approved_budget || project.approvedBudget,
            },
            summary: {
              totalTasks,
              completedTasks,
              tasksWithEvidence,
              approvedEvidence,
              pendingEvidence,
              rejectedEvidence,
              totalDeliverables: deliverables.length,
              completedDeliverables: deliverables.filter((d) => d.status === 'completed').length,
              totalMilestones: milestones.length,
              completedMilestones: milestones.filter((m) => m.status === 'completed').length,
              totalRisks,
              totalStakeholders: (stakeholders as unknown[]).length,
              totalDocuments: (documents as unknown[]).length,
            },
            tasks: evidenceItems,
          };
        })
      );
      res.json({ success: true, data: auditData });
    } catch (error) {
      logger.error("Error fetching QA audit data:", error);
      res.status(500).json({ success: false, error: "Failed to fetch QA audit data" });
    }
  }));

  return router;
}

