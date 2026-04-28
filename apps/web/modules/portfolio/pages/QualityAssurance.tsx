import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  FileCheck,
  Layers,
  ClipboardCheck,
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  Gauge,
  Download,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Upload,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AuditTask = {
  id: string;
  taskCode: string;
  title: string;
  wbsLevel: number;
  taskType: string;
  status: string;
  progress: number;
  parentTaskId: string | null;
  assignedTo: string | null;
  evidenceUrl: string | null;
  evidenceFileName: string | null;
  evidenceNotes: string | null;
  evidenceUploadedAt: string | null;
  evidenceUploadedBy: string | null;
  evidenceVerificationStatus: string;
  evidenceVerifiedBy: string | null;
  evidenceVerifiedAt: string | null;
  evidenceVerificationNotes: string | null;
};

type ProjectSummary = {
  totalTasks: number;
  completedTasks: number;
  tasksWithEvidence: number;
  approvedEvidence: number;
  pendingEvidence: number;
  rejectedEvidence: number;
  totalDeliverables: number;
  completedDeliverables: number;
  totalMilestones: number;
  completedMilestones: number;
  totalRisks: number;
  totalStakeholders: number;
  totalDocuments: number;
};

type ProjectAuditData = {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    currentPhase: string;
    overallProgress: number;
    healthStatus: string;
    priority: string;
    charterStatus: string | null;
    projectManager: string | null;
    approvedBudget: string | null;
  };
  summary: ProjectSummary;
  tasks: AuditTask[];
};

type AuditFinding = {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
};

/* ------------------------------------------------------------------ */
/* Audit Engine                                                        */
/* ------------------------------------------------------------------ */

function computeAudit(data: ProjectAuditData): { qaScore: number; findings: AuditFinding[] } {
  const findings: AuditFinding[] = [];
  let score = 100;
  const { project, summary } = data;

  if (!project.charterStatus || project.charterStatus === "draft") {
    findings.push({ severity: "high", category: "Charter", message: "Project charter not signed" });
    score -= 12;
  }

  const phase = project.currentPhase;
  const isActive = phase !== "intake";
  const isExec = phase === "execution" || phase === "monitoring" || phase === "closure";

  if (isActive && summary.totalTasks === 0) {
    findings.push({ severity: "critical", category: "WBS", message: "No WBS tasks defined" });
    score -= 20;
  } else if (isExec && summary.totalTasks > 0 && summary.completedTasks / summary.totalTasks < 0.1 && project.overallProgress > 30) {
    findings.push({ severity: "high", category: "WBS", message: "Task completion lags overall progress" });
    score -= 10;
  }

  if (isExec && summary.tasksWithEvidence === 0 && summary.totalTasks > 0) {
    findings.push({ severity: "high", category: "Evidence", message: "No evidence uploaded for any task" });
    score -= 15;
  } else if (isExec && summary.totalTasks > 0) {
    const evidenceRate = summary.tasksWithEvidence / summary.totalTasks;
    if (evidenceRate < 0.3) {
      findings.push({ severity: "medium", category: "Evidence", message: "Only " + Math.round(evidenceRate * 100) + "% of tasks have evidence" });
      score -= 5;
    }
  }

  if (summary.pendingEvidence > 0) {
    findings.push({ severity: "medium", category: "Verification", message: summary.pendingEvidence + " evidence items pending PMO verification" });
    score -= 3;
  }

  if (summary.rejectedEvidence > 0) {
    findings.push({ severity: "high", category: "Verification", message: summary.rejectedEvidence + " evidence items rejected" });
    score -= 8;
  }

  if (isActive && summary.totalRisks === 0) {
    findings.push({ severity: "medium", category: "Risk", message: "No risks identified" });
    score -= 5;
  }

  if (isActive && summary.totalStakeholders === 0) {
    findings.push({ severity: "medium", category: "Stakeholders", message: "No stakeholders registered" });
    score -= 5;
  }

  if (isExec && summary.totalMilestones === 0) {
    findings.push({ severity: "medium", category: "Milestones", message: "No milestones defined" });
    score -= 5;
  }

  if (isActive && !project.approvedBudget) {
    findings.push({ severity: "high", category: "Budget", message: "No approved budget" });
    score -= 10;
  }

  if (isExec && summary.totalDeliverables === 0) {
    findings.push({ severity: "medium", category: "Deliverables", message: "No deliverables defined" });
    score -= 5;
  }

  if (project.healthStatus === "critical" || project.healthStatus === "blocked") {
    findings.push({ severity: "critical", category: "Health", message: "Project is " + project.healthStatus });
    score -= 10;
  }

  return { qaScore: Math.max(0, Math.min(100, score)), findings };
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const r = (size / 2) - 3;
  const circ = 2 * Math.PI * r;
  const dashLen = (score / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeDasharray={`${dashLen} ${circ}`} strokeLinecap="round" className={color} stroke="currentColor" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${color}`}>{score}</span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[9px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
}

/* ------------------------------------------------------------------ */
/* Evidence Audit Sheet                                                */
/* ------------------------------------------------------------------ */

function EvidenceAuditSheet({
  open, onOpenChange, projectName, tasks, onVerify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  tasks: AuditTask[];
  onVerify: (taskId: string, status: "approved" | "rejected", notes: string) => void;
}) {
  const [verifyNotes, setVerifyNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [previewTask, setPreviewTask] = useState<string | null>(null);

  const tasksWithEvidence = tasks.filter((t) => t.evidenceUrl);
  const filtered = filter === "all" ? tasksWithEvidence : tasksWithEvidence.filter((t) => t.evidenceVerificationStatus === filter);
  const pendingCount = tasksWithEvidence.filter((t) => t.evidenceVerificationStatus === "pending").length;
  const approvedCount = tasksWithEvidence.filter((t) => t.evidenceVerificationStatus === "approved").length;
  const rejectedCount = tasksWithEvidence.filter((t) => t.evidenceVerificationStatus === "rejected").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
          <SheetTitle className="text-base font-semibold">{projectName} — Evidence Audit</SheetTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-muted-foreground">{tasksWithEvidence.length} uploaded</span>
            </div>
            <div className="flex gap-1">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors ${
                    filter === f
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {f === "all" ? `All (${tasksWithEvidence.length})` : f === "pending" ? `Pending (${pendingCount})` : f === "approved" ? `Approved (${approvedCount})` : `Rejected (${rejectedCount})`}
                </button>
              ))}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 text-slate-300" />
                {filter === "all" ? "No evidence uploaded yet" : `No ${filter} evidence`}
              </div>
            ) : (
              filtered.map((task) => (
                <div key={task.id} className="px-6 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-mono">{task.taskCode}</Badge>
                        <span className="text-sm font-medium text-foreground">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[9px] px-1.5 py-0 ${
                          task.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          task.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{(task.status || "not_started").replace("_", " ")}</Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">{task.taskType}</span>
                        {task.progress > 0 && <span className="text-[10px] text-muted-foreground">{task.progress}%</span>}
                      </div>
                    </div>
                    <VerificationBadge status={task.evidenceVerificationStatus} />
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-medium text-foreground">{task.evidenceFileName || "Evidence file"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.evidenceUrl && (
                          <button onClick={() => setPreviewTask(previewTask === task.id ? null : task.id)} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                            <Eye className="h-3 w-3" /> {previewTask === task.id ? "Hide" : "Preview"}
                          </button>
                        )}
                        {task.evidenceUrl && (
                          <a href={task.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400">
                            <Download className="h-3 w-3" /> Download
                          </a>
                        )}
                      </div>
                    </div>
                    {previewTask === task.id && task.evidenceUrl && (() => {
                      const ext = (task.evidenceFileName || "").split(".").pop()?.toLowerCase() || "";
                      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
                      const isPdf = ext === "pdf";
                      return (
                        <div className="mt-2 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
                          {isImage && <img src={task.evidenceUrl} alt={task.evidenceFileName || "Evidence"} className="w-full max-h-[400px] object-contain bg-white dark:bg-slate-900" />}
                          {isPdf && <iframe src={task.evidenceUrl} title={task.evidenceFileName || "Evidence"} className="w-full h-[400px] bg-white" />}
                          {!isImage && !isPdf && (
                            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                              <FileText className="h-8 w-8 mb-2 text-slate-300" />
                              <p className="text-xs mb-2">Preview not available for .{ext} files</p>
                              <a href={task.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 underline">Open in new tab</a>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {task.evidenceNotes && <p className="text-[11px] text-muted-foreground">{task.evidenceNotes}</p>}
                    {task.evidenceUploadedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Uploaded {new Date(task.evidenceUploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    )}
                    {task.evidenceVerificationNotes && (
                      <div className={`mt-1 p-2 rounded text-[11px] ${
                        task.evidenceVerificationStatus === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                        task.evidenceVerificationStatus === "rejected" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        <span className="font-medium">Review note:</span> {task.evidenceVerificationNotes}
                      </div>
                    )}
                  </div>

                  {task.evidenceVerificationStatus === "pending" && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Verification notes (optional)..."
                        className="text-xs h-16 resize-none"
                        value={verifyNotes[task.id] || ""}
                        onChange={(e) => setVerifyNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => { onVerify(task.id, "approved", verifyNotes[task.id] || ""); setVerifyNotes((prev) => ({ ...prev, [task.id]: "" })); }}>
                          <ThumbsUp className="h-3 w-3 mr-1" /> Approve Evidence
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => { onVerify(task.id, "rejected", verifyNotes[task.id] || ""); setVerifyNotes((prev) => ({ ...prev, [task.id]: "" })); }}>
                          <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {task.evidenceVerificationStatus === "rejected" && (
                    <div className="space-y-2">
                      <Textarea placeholder="Update notes..." className="text-xs h-16 resize-none"
                        value={verifyNotes[task.id] || ""}
                        onChange={(e) => setVerifyNotes((prev) => ({ ...prev, [task.id]: e.target.value }))} />
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { onVerify(task.id, "approved", verifyNotes[task.id] || ""); setVerifyNotes((prev) => ({ ...prev, [task.id]: "" })); }}>
                        <ThumbsUp className="h-3 w-3 mr-1" /> Approve Evidence
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function QualityAssurance() {
  const queryClient = useQueryClient();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [auditSheetProject, setAuditSheetProject] = useState<ProjectAuditData | null>(null);

  const { data: auditResponse, isLoading } = useQuery<{ success: boolean; data: ProjectAuditData[] }>({
    queryKey: ["/api/portfolio/qa/audit"],
  });

  const auditData = useMemo(() => auditResponse?.data ?? [], [auditResponse]);

  const verifyMutation = useMutation({
    mutationFn: async ({ taskId, status, notes }: { taskId: string; status: "approved" | "rejected"; notes: string }) => {
      return apiRequest("POST", `/api/portfolio/wbs/${taskId}/evidence/verify`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/qa/audit"] });
    },
  });

  const audits = useMemo(() => {
    return auditData.map((d) => {
      const { qaScore, findings } = computeAudit(d);
      return { ...d, qaScore, findings };
    }).sort((a, b) => a.qaScore - b.qaScore);
  }, [auditData]);

  const totalProjects = audits.length;
  const avgQaScore = totalProjects > 0 ? Math.round(audits.reduce((s, a) => s + a.qaScore, 0) / totalProjects) : 0;
  const criticalFindings = audits.reduce((s, a) => s + a.findings.filter((f) => f.severity === "critical").length, 0);
  const highFindings = audits.reduce((s, a) => s + a.findings.filter((f) => f.severity === "high").length, 0);
  const passedProjects = audits.filter((a) => a.qaScore >= 80).length;
  const failedProjects = audits.filter((a) => a.qaScore < 50).length;
  const totalPendingEvidence = audits.reduce((s, a) => s + a.summary.pendingEvidence, 0);
  const totalApprovedEvidence = audits.reduce((s, a) => s + a.summary.approvedEvidence, 0);

  const severityColor: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  const healthBadge: Record<string, string> = {
    on_track: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    at_risk: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  function getScoreBarColor(score: number) {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  }

  function handleVerify(taskId: string, status: "approved" | "rejected", notes: string) {
    verifyMutation.mutate({ taskId, status, notes });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pmo-office">
              <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Projects Quality Assurance</h1>
              <p className="text-sm text-muted-foreground">Audit project structure, evidence completeness, and verify uploaded evidence across the portfolio</p>
            </div>
          </div>
          {totalPendingEvidence > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Clock className="h-3 w-3 mr-1" /> {totalPendingEvidence} evidence pending verification
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Projects", value: totalProjects, icon: Layers, color: "text-slate-600 dark:text-slate-400", bg: "bg-white dark:bg-slate-900" },
            { label: "Avg QA Score", value: `${avgQaScore}%`, icon: Gauge, color: avgQaScore >= 80 ? "text-emerald-600" : avgQaScore >= 60 ? "text-amber-600" : "text-red-600", bg: avgQaScore >= 80 ? "bg-emerald-50 dark:bg-emerald-900/20" : avgQaScore >= 60 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-red-50 dark:bg-red-900/20" },
            { label: "Passed", value: passedProjects, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Failed", value: failedProjects, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: failedProjects > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-white dark:bg-slate-900" },
            { label: "Critical", value: criticalFindings, icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: criticalFindings > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-white dark:bg-slate-900" },
            { label: "High", value: highFindings, icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: highFindings > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-white dark:bg-slate-900" },
            { label: "Pending Review", value: totalPendingEvidence, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: totalPendingEvidence > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-white dark:bg-slate-900" },
            { label: "Approved", value: totalApprovedEvidence, icon: ThumbsUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-white dark:bg-slate-900" },
          ].map((kpi) => {
            const KpiIcon = kpi.icon;
            return (
              <Card key={kpi.label} className={`${kpi.bg} border-slate-200/60 dark:border-slate-700/40 shadow-sm`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <KpiIcon className={`h-3.5 w-3.5 ${kpi.color}`} />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-slate-200/60 dark:border-slate-700/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base font-semibold">QA Audit Register</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-2">{totalProjects} projects</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-[40px_44px_1fr_100px_90px_90px_100px_80px_60px_36px] gap-2 px-5 py-2 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <div></div><div>Score</div><div>Project</div><div>Phase</div><div>Tasks</div><div>Evidence</div><div>Verification</div><div>Progress</div><div>Findings</div><div></div>
            </div>

            <ScrollArea className="h-[calc(100vh-340px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading audit data...</div>
              ) : audits.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No projects to audit</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {audits.map((audit) => {
                    const { project, summary, qaScore, findings, tasks } = audit;
                    const isExpanded = expandedProject === project.id;
                    const tasksWithEv = tasks.filter((t) => t.evidenceUrl);
                    return (
                      <div key={project.id}>
                        <button
                          className="w-full grid grid-cols-[40px_44px_1fr_100px_90px_90px_100px_80px_60px_36px] gap-2 items-center px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                          onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                        >
                          <div>{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</div>
                          <ScoreRing score={qaScore} size={36} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground truncate">{project.projectName}</span>
                              <Badge variant="outline" className="text-[9px] shrink-0 font-mono">{project.projectCode}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className={`text-[9px] px-1.5 py-0 ${healthBadge[project.healthStatus] || healthBadge.on_track}`}>{(project.healthStatus || "on_track").replace("_", " ")}</Badge>
                              {project.projectManager && <span className="text-[10px] text-muted-foreground truncate">PM: {project.projectManager}</span>}
                            </div>
                          </div>
                          <div className="text-xs capitalize text-muted-foreground">{project.currentPhase}</div>
                          <div>
                            <div className="text-xs font-medium">{summary.completedTasks}/{summary.totalTasks}</div>
                            <div className="text-[10px] text-muted-foreground">{summary.totalTasks > 0 ? Math.round((summary.completedTasks / summary.totalTasks) * 100) : 0}% done</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium">{summary.tasksWithEvidence}/{summary.totalTasks}</div>
                            <div className="text-[10px] text-muted-foreground">{summary.totalTasks > 0 ? Math.round((summary.tasksWithEvidence / summary.totalTasks) * 100) : 0}% uploaded</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {summary.pendingEvidence > 0 && <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1">{summary.pendingEvidence} pending</Badge>}
                            {summary.approvedEvidence > 0 && <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1">{summary.approvedEvidence} ok</Badge>}
                            {summary.rejectedEvidence > 0 && <Badge className="bg-red-100 text-red-700 text-[9px] px-1">{summary.rejectedEvidence} rej</Badge>}
                            {summary.tasksWithEvidence === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-0.5"><span className="text-[10px] font-medium">{project.overallProgress}%</span></div>
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className={`h-full rounded-full ${getScoreBarColor(project.overallProgress)}`} style={{ width: `${project.overallProgress}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {findings.filter((f) => f.severity === "critical").length > 0 && <span className="text-[9px] font-bold text-red-600">{findings.filter((f) => f.severity === "critical").length}C</span>}
                            {findings.filter((f) => f.severity === "high").length > 0 && <span className="text-[9px] font-bold text-orange-600">{findings.filter((f) => f.severity === "high").length}H</span>}
                            {findings.length === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            {tasksWithEv.length > 0 && (
                              <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => setAuditSheetProject(audit)} title="Audit evidence">
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                              </button>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="bg-slate-50/80 dark:bg-slate-800/30 px-5 pb-4 pt-2">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Findings ({findings.length})</h4>
                                {findings.length === 0 ? (
                                  <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All checks passed</p>
                                ) : (
                                  <div className="space-y-1">
                                    {findings.map((finding, fi) => (
                                      <div key={fi} className="flex items-start gap-2 text-xs">
                                        <Badge className={`text-[9px] px-1.5 py-0 shrink-0 mt-0.5 ${severityColor[finding.severity]}`}>{finding.severity}</Badge>
                                        <span className="text-muted-foreground"><span className="font-medium text-foreground">{finding.category}:</span> {finding.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Structure</h4>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { l: "Tasks", v: summary.totalTasks, d: summary.completedTasks },
                                    { l: "Deliverables", v: summary.totalDeliverables, d: summary.completedDeliverables },
                                    { l: "Milestones", v: summary.totalMilestones, d: summary.completedMilestones },
                                    { l: "Risks", v: summary.totalRisks, d: 0 },
                                    { l: "Stakeholders", v: summary.totalStakeholders, d: 0 },
                                    { l: "Documents", v: summary.totalDocuments, d: 0 },
                                  ].map((item) => (
                                    <div key={item.l} className="bg-white dark:bg-slate-900 rounded-md p-2 border border-slate-200/60 dark:border-slate-700/40">
                                      <div className="text-[10px] text-muted-foreground">{item.l}</div>
                                      <div className="text-sm font-semibold">{item.v}</div>
                                      {item.d > 0 && <div className="text-[9px] text-emerald-600">{item.d} done</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5" /> Evidence</h4>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white dark:bg-slate-900 rounded-md p-2 border border-slate-200/60 dark:border-slate-700/40">
                                      <div className="text-[10px] text-muted-foreground">Uploaded</div>
                                      <div className="text-sm font-semibold">{summary.tasksWithEvidence}</div>
                                      <div className="text-[9px] text-muted-foreground">of {summary.totalTasks} tasks</div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-md p-2 border border-slate-200/60 dark:border-slate-700/40">
                                      <div className="text-[10px] text-muted-foreground">Approved</div>
                                      <div className="text-sm font-semibold text-emerald-600">{summary.approvedEvidence}</div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-md p-2 border border-slate-200/60 dark:border-slate-700/40">
                                      <div className="text-[10px] text-muted-foreground">Pending</div>
                                      <div className="text-sm font-semibold text-amber-600">{summary.pendingEvidence}</div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-md p-2 border border-slate-200/60 dark:border-slate-700/40">
                                      <div className="text-[10px] text-muted-foreground">Rejected</div>
                                      <div className="text-sm font-semibold text-red-600">{summary.rejectedEvidence}</div>
                                    </div>
                                  </div>
                                  {tasksWithEv.length > 0 && (
                                    <Button size="sm" className="w-full h-8 text-xs" onClick={() => setAuditSheetProject(audit)}>
                                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Audit Evidence ({tasksWithEv.length} items)
                                    </Button>
                                  )}
                                  {tasksWithEv.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">No evidence uploaded yet</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {auditSheetProject && (
        <EvidenceAuditSheet
          open={!!auditSheetProject}
          onOpenChange={(open) => { if (!open) setAuditSheetProject(null); }}
          projectName={auditSheetProject.project.projectName}
          tasks={auditSheetProject.tasks}
          onVerify={handleVerify}
        />
      )}
    </div>
  );
}
