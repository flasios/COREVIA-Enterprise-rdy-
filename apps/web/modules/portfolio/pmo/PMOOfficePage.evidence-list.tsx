import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

/* ── Extracted: Evidence list (reduces nesting depth for SonarQube) ── */
interface PMOEvidenceListProps {
  qaProjects: Array<{
    project: { id: string; projectName: string; projectCode: string };
    summary: { pendingEvidence: number; approvedEvidence: number; rejectedEvidence: number; tasksWithEvidence: number; totalTasks: number };
    tasks: Array<{
      id: string; taskId: string; taskCode: string | null; title: string | null; taskType: string; status: string;
      evidenceSource: 'task' | 'document';
      evidenceFileName: string | null; evidenceUrl: string | null;
      evidenceUploadedAt: string | null; evidenceUploadedBy: string | null;
      evidenceVerificationStatus: string | null; evidenceVerifiedAt: string | null;
      evidenceVerificationNotes?: string | null;
    }>;
  }>;
  evidenceFilter: "all" | "pending" | "approved" | "rejected";
  evidenceVerifyIsPending: boolean;
  evidenceVerifyMutate: (vars: { id: string; source: 'task' | 'document'; status: 'approved' | 'rejected'; notes: string }) => void;
  evidenceVerifyingId: string | null;
  evidenceVerifyNotes: Record<string, string>;
  evidencePreviewTask: string | null;
  setEvidencePreviewTask: (v: string | null) => void;
  updateEvidenceNote: (id: string, value: string) => void;
  clearEvidenceNote: (id: string) => void;
  setEvidenceVerifyingId: (v: string | null) => void;
}

/* ── Extracted: Single evidence item card (keeps cognitive complexity low) ── */
type EvidenceItemType = PMOEvidenceListProps['qaProjects'][number]['tasks'][number] & { projectName: string; projectId: string };
interface PMOEvidenceItemProps {
  item: EvidenceItemType;
  isVerifying: boolean;
  evidenceVerifyNotes: Record<string, string>;
  evidencePreviewTask: string | null;
  setEvidencePreviewTask: (v: string | null) => void;
  updateEvidenceNote: (id: string, value: string) => void;
  clearEvidenceNote: (id: string) => void;
  setEvidenceVerifyingId: (v: string | null) => void;
  evidenceVerifyMutate: (vars: { id: string; source: 'task' | 'document'; status: 'approved' | 'rejected'; notes: string }) => void;
}

function getVerificationBadge(status: string | null): React.ReactNode {
  if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[9px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
}

function getVerificationNoteClass(status: string | null): string {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
  if (status === "rejected") return "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  return "bg-slate-100 text-slate-600";
}

function getTaskStatusClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function PMOEvidenceItem(props: Readonly<PMOEvidenceItemProps>) {
  const { item, isVerifying, evidenceVerifyNotes, evidencePreviewTask, setEvidencePreviewTask, updateEvidenceNote, clearEvidenceNote, setEvidenceVerifyingId, evidenceVerifyMutate } = props;
  const handleVerifyNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => updateEvidenceNote(item.id, e.target.value);
  const handleVerify = (status: 'approved' | 'rejected') => {
    setEvidenceVerifyingId(item.id);
    evidenceVerifyMutate({ id: item.id, source: item.evidenceSource, status, notes: evidenceVerifyNotes[item.id] || '' });
    clearEvidenceNote(item.id);
  };

  return (
    <div className="px-4 py-3 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] font-mono shrink-0">{item.taskCode}</Badge>
            <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[9px] px-1.5 py-0 ${getTaskStatusClass(item.status)}`}>{(item.status || "not_started").replaceAll("_", " ")}</Badge>
            <span className="text-[10px] text-muted-foreground capitalize">{item.taskType}</span>
            <span className="text-[10px] text-muted-foreground">{item.evidenceSource === 'document' ? 'Work package document' : 'Legacy task evidence'}</span>
          </div>
        </div>
        {getVerificationBadge(item.evidenceVerificationStatus)}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">{item.evidenceFileName || "Evidence file"}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.evidenceUrl && (
              <button onClick={() => setEvidencePreviewTask(evidencePreviewTask === item.id ? null : item.id)} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                <Eye className="h-3 w-3" /> {evidencePreviewTask === item.id ? "Hide" : "Preview"}
              </button>
            )}
            {item.evidenceUrl && (
              <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <Download className="h-3 w-3" /> Download
              </a>
            )}
          </div>
        </div>
        {evidencePreviewTask === item.id && item.evidenceUrl && (() => {
          const ext = (item.evidenceFileName || "").split(".").pop()?.toLowerCase() || "";
          const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
          const isPdf = ext === "pdf";
          return (
            <div className="mt-2 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
              {isImage && <img src={item.evidenceUrl} alt={item.evidenceFileName || "Evidence"} className="w-full max-h-[400px] object-contain bg-white dark:bg-slate-900" />}
              {isPdf && <iframe src={item.evidenceUrl} title={item.evidenceFileName || "Evidence"} className="w-full h-[400px] bg-white" />}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-xs mb-2">Preview not available for .{ext} files</p>
                  <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 underline">Open in new tab</a>
                </div>
              )}
            </div>
          );
        })()}
        {item.evidenceUploadedAt && (
          <p className="text-[10px] text-muted-foreground">
            Uploaded {new Date(item.evidenceUploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
        {Boolean((item as Record<string, unknown>).evidenceVerificationNotes) && (
          <div className={`mt-1 p-2 rounded text-[11px] ${getVerificationNoteClass(item.evidenceVerificationStatus)}`}>
            <span className="font-medium">Review note:</span> {String((item as Record<string, unknown>).evidenceVerificationNotes)}
          </div>
        )}
      </div>

      {item.evidenceVerificationStatus === "pending" && (
        <div className="space-y-2">
          <Textarea placeholder="Verification notes (optional)..." className="text-xs h-16 resize-none" value={evidenceVerifyNotes[item.id] || ""} onChange={handleVerifyNoteChange} />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isVerifying} onClick={() => handleVerify('approved')}>
              {isVerifying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ThumbsUp className="h-3 w-3 mr-1" />} Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={isVerifying} onClick={() => handleVerify('rejected')}>
              {isVerifying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ThumbsDown className="h-3 w-3 mr-1" />} Reject
            </Button>
          </div>
        </div>
      )}

      {item.evidenceVerificationStatus === "rejected" && (
        <div className="space-y-2">
          <Textarea placeholder="Update notes..." className="text-xs h-16 resize-none" value={evidenceVerifyNotes[item.id] || ""} onChange={handleVerifyNoteChange} />
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isVerifying} onClick={() => handleVerify('approved')}>
            {isVerifying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ThumbsUp className="h-3 w-3 mr-1" />} Approve
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Evidence list grouped by project ── */
export function PMOEvidenceList(props: Readonly<PMOEvidenceListProps>) {
  const {
    qaProjects, evidenceFilter, evidenceVerifyIsPending, evidenceVerifyMutate,
    evidenceVerifyingId, evidenceVerifyNotes, evidencePreviewTask,
    setEvidencePreviewTask, updateEvidenceNote, clearEvidenceNote, setEvidenceVerifyingId,
  } = props;

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const toggleProject = (id: string) =>
    setCollapsedProjects((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  /* Build project groups with filtered evidence */
  const projectGroups = qaProjects
    .map((p) => {
      const items = p.tasks
        .filter((t) => t.evidenceFileName)
        .map((t): EvidenceItemType => ({ ...t, projectName: p.project.projectName, projectId: p.project.id }))
        .sort((a, b) => new Date(b.evidenceUploadedAt || 0).getTime() - new Date(a.evidenceUploadedAt || 0).getTime());
      const filtered = evidenceFilter === "all" ? items : items.filter((t) => t.evidenceVerificationStatus === evidenceFilter);
      return { project: p.project, summary: p.summary, items: filtered };
    })
    .filter((g) => g.items.length > 0);

  if (projectGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 text-slate-300" />
        {evidenceFilter === "all" ? "No evidence uploaded yet" : `No ${evidenceFilter} evidence`}
      </div>
    );
  }

  return (
    <>
      {projectGroups.map((group) => {
        const isCollapsed = collapsedProjects.has(group.project.id);
        const pending = group.summary.pendingEvidence;
        const approved = group.summary.approvedEvidence;
        const rejected = group.summary.rejectedEvidence;
        return (
          <div key={group.project.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
            {/* ── Project header ── */}
            <button
              type="button"
              onClick={() => toggleProject(group.project.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
            >
              <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 shrink-0">
                  <Briefcase className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate">{group.project.projectName}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{group.project.projectCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {pending > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Clock className="h-2.5 w-2.5" />{pending}</span>}
                {approved > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><CheckCircle2 className="h-2.5 w-2.5" />{approved}</span>}
                {rejected > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"><XCircle className="h-2.5 w-2.5" />{rejected}</span>}
                <span className="text-[10px] text-muted-foreground ml-1">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</span>
              </div>
            </button>

            {/* ── Evidence items within this project ── */}
            {!isCollapsed && (
              <div className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-500/20 ml-7 mb-2">
                {group.items.map((item) => (
                  <PMOEvidenceItem
                    key={item.id}
                    item={item}
                    isVerifying={evidenceVerifyIsPending && evidenceVerifyingId === item.id}
                    evidenceVerifyNotes={evidenceVerifyNotes}
                    evidencePreviewTask={evidencePreviewTask}
                    setEvidencePreviewTask={setEvidencePreviewTask}
                    updateEvidenceNote={updateEvidenceNote}
                    clearEvidenceNote={clearEvidenceNote}
                    setEvidenceVerifyingId={setEvidenceVerifyingId}
                    evidenceVerifyMutate={evidenceVerifyMutate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
