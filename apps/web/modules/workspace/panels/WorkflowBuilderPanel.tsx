import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CalendarDays, Download, Eye, FileText, Loader2, Play, Scale, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchWorkspaceTranslationPreview,
  fetchWorkspaceTranslationUploads,
  runWorkspaceAgent,
  saveWorkspaceTranslationEditedSegments,
  saveWorkspaceTranslationEditedText,
  uploadWorkspaceTranslationDocument,
} from "@/modules/workspace/services/workspaceApi";
import type {
  WorkspaceAgent,
  WorkspaceAgentRunResponse,
  WorkspaceTranslationEditableSegment,
  WorkspaceTranslationPreview,
  WorkspaceTranslationUpload,
} from "@/modules/workspace/types";

type WorkflowBuilderPanelProps = {
  agents: WorkspaceAgent[];
  selectedAgent: WorkspaceAgent | null;
};

function initialTask(agent?: WorkspaceAgent) {
  return agent
    ? `Use the ${agent.label} workflow with the current workspace context and generate the required output.`
    : "Describe the work you want Business Dock to run using the current workspace context.";
}

function getWorkspaceOutputStatusLabel(isPending: boolean, hasOutput: boolean) {
  if (isPending) return "Running";
  if (hasOutput) return "Complete";
  return "Idle";
}

const translationLanguageOptions = [
  { value: "auto", label: "Auto detect" },
  { value: "ar", label: "Arabic" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTranslationTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatTranslationStageLabel(stage: WorkspaceTranslationUpload["progressStage"]) {
  switch (stage) {
    case "queued":
      return "Queued";
    case "analysis":
      return "Document Analysis";
    case "translation":
      return "Translation In Progress";
    case "reconstruction":
      return "Layout Reconstruction";
    case "finalizing":
      return "Final Quality Pass";
    case "completed":
      return "Completed";
    case "failed":
      return "Attention Required";
    default:
      return "Processing";
  }
}

function getTranslationFormatLabel(format: WorkspaceTranslationUpload["documentFormat"]) {
  switch (format) {
    case "docx":
      return "Word";
    case "pptx":
      return "Slides";
    case "xlsx":
      return "Sheet";
    case "pdf":
      return "PDF";
    case "html":
      return "HTML";
    case "txt":
      return "Text";
    case "md":
      return "Markdown";
    default:
      return "File";
  }
}

function getTranslationStatusBadgeClass(status: WorkspaceTranslationUpload["status"]) {
  switch (status) {
    case "translated":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "processing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getTranslationCardAccentClass(status: WorkspaceTranslationUpload["status"]) {
  switch (status) {
    case "translated":
      return "bg-emerald-500";
    case "processing":
      return "bg-sky-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

function getTranslationListSummary(upload: WorkspaceTranslationUpload) {
  if (upload.status === "translated") {
    return "Ready for preview and download.";
  }

  if (upload.status === "processing") {
    return formatTranslationStageLabel(upload.progressStage);
  }

  if (upload.status === "failed") {
    return "Attention required.";
  }

  return "Queued for processing.";
}

function sanitizeTranslationProgressMessage(message: string) {
  const trimmed = message.trim();

  const normalized = trimmed
    .replaceAll(/provider\s+[a-z0-9_-]+\.?\s*/gi, "")
    .replaceAll(/using\s+(?:the\s+)?[a-z0-9_-]+\s+provider\.?\s*/gi, "")
    .replaceAll(/\b(?:anthropic|openai|falcon)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const batchMatch = normalized.match(/translating batch\s+(\d+)\s+of\s+(\d+)\s+with\s+(\d+)\s+parallel lanes\s+[•-]\s+(\d+)\/(\d+)\s+segments completed\.?/i);
  if (batchMatch) {
    const [, batchIndex, batchCount, laneCount, completedSegments, totalSegments] = batchMatch;
    return `Translation is underway across secured parallel lanes. Batch ${batchIndex} of ${batchCount} is active with ${completedSegments} of ${totalSegments} segments completed across ${laneCount} lanes.`;
  }

  if (normalized.length === 0) {
    return "Translation is underway inside the COREVIA processing pipeline.";
  }

  return normalized;
}

function _buildProfessionalTranslationProgress(upload: WorkspaceTranslationUpload) {
  if (upload.translatedAt) {
    return `Translated ${formatTranslationTimestamp(upload.translatedAt)}.`;
  }

  if (upload.progressMessage?.trim()) {
    return sanitizeTranslationProgressMessage(upload.progressMessage);
  }

  switch (upload.progressStage) {
    case "analysis":
      return "Inspecting structure, reading layout signals, and preparing the translation plan.";
    case "translation":
      return "Translating content blocks and preserving document meaning, hierarchy, and formatting intent.";
    case "reconstruction":
      return "Rebuilding the translated artifact and restoring document structure for review.";
    case "finalizing":
      return "Completing the final validation pass and preparing the deliverable.";
    case "completed":
      return "Translated artifact is ready for review and download.";
    case "failed":
      return "The translation pipeline encountered an issue.";
    default:
      return "Queued for document analysis.";
  }
}

function severityPriority(level: "low" | "medium" | "high") {
  if (level === "high") return 0;
  if (level === "medium") return 1;
  return 2;
}

function clauseAssessmentPriority(level: "covered" | "attention" | "missing") {
  if (level === "missing") return 0;
  if (level === "attention") return 1;
  return 2;
}

function buildLegalReviewDownloadContent(preview: WorkspaceTranslationPreview) {
  const review = preview.legalReview;
  if (!review) {
    return "Legal review is not available for this document.";
  }

  const isRtl = preview.html?.includes('dir="rtl"') ?? false;

  const lines = [
    isRtl ? "المراجعة القانونية — COREVIA" : "COREVIA Legal Review",
    `${isRtl ? "المستند" : "Document"}: ${preview.translatedFilename}`,
    `${isRtl ? "تاريخ الإنشاء" : "Generated"}: ${formatTranslationTimestamp(review.generatedAt) ?? review.generatedAt}`,
    `${isRtl ? "المزوّد" : "Provider"}: ${review.provider}`,
    `${isRtl ? "المخاطر الإجمالية" : "Overall Risk"}: ${review.overallRisk.toUpperCase()}`,
    "",
    isRtl ? "الملخص التنفيذي" : "Executive Summary",
    review.summary,
  ];

  if (review.clauseAssessments.length > 0) {
    lines.push("", isRtl ? "خريطة تغطية البنود" : "Clause Coverage Map");
    review.clauseAssessments.forEach((assessment, index) => {
      lines.push(
        `${index + 1}. ${assessment.area} [${assessment.status.toUpperCase()}]`,
        `${isRtl ? "التقييم" : "Assessment"}: ${assessment.detail}`,
        assessment.excerpt ? `${isRtl ? "الدليل" : "Evidence"}: ${assessment.excerpt}` : (isRtl ? "الدليل: لم يُقدم مقتطف مباشر." : "Evidence: No direct excerpt provided."),
      );
    });
  }

  if (review.concerns.length > 0) {
    lines.push("", isRtl ? "المخاوف الرئيسية" : "Key Concerns");
    review.concerns.forEach((concern, index) => {
      lines.push(
        `${index + 1}. ${concern.title} [${concern.severity.toUpperCase()}]`,
        concern.excerpt ? `${isRtl ? "الدليل" : "Evidence"}: ${concern.excerpt}` : (isRtl ? "الدليل: لم يُقدم مقتطف مباشر." : "Evidence: No direct excerpt provided."),
        `${isRtl ? "الأثر" : "Impact"}: ${concern.explanation}`,
        concern.recommendation ? `${isRtl ? "الإجراء الموصى به" : "Recommended Action"}: ${concern.recommendation}` : "",
      );
    });
  }

  if (review.priorityActions.length > 0) {
    lines.push("", isRtl ? "إجراءات ذات أولوية" : "Priority Actions");
    review.priorityActions.forEach((action, index) => {
      lines.push(
        `${index + 1}. ${action.title} [${action.urgency.toUpperCase()}]`,
        `${isRtl ? "المبرر" : "Rationale"}: ${action.rationale}`,
      );
    });
  }

  if (review.strengths.length > 0) {
    lines.push("", isRtl ? "نقاط القوة المؤكدة" : "Confirmed Strengths");
    review.strengths.forEach((strength, index) => lines.push(`${index + 1}. ${strength}`));
  }

  if (review.suggestions.length > 0) {
    lines.push("", isRtl ? "الإجراءات الموصى بها" : "Recommended Actions");
    review.suggestions.forEach((suggestion, index) => lines.push(`${index + 1}. ${suggestion}`));
  }

  lines.push("", isRtl ? "إخلاء مسؤولية" : "Disclaimer", review.disclaimer);
  return lines.filter((line, index, all) => line.length > 0 || all[index - 1] !== "").join("\n");
}

function downloadLegalReview(preview: WorkspaceTranslationPreview) {
  if (!preview.legalReview || typeof document === "undefined") {
    return;
  }

  const content = buildLegalReviewDownloadContent(preview);
  const baseName = (preview.translatedFilename || "translation")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "translation";
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}.legal-review.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function TranslationWorkflowPanel({ selectedAgent }: Readonly<{ selectedAgent: WorkspaceAgent | null }>) {
  const queryClient = useQueryClient();
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("ar");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadsQuery = useQuery<WorkspaceTranslationUpload[]>({
    queryKey: ["/api/intelligent-workspace/translation/uploads"],
    queryFn: fetchWorkspaceTranslationUploads,
    refetchInterval: (query) => query.state.data?.some((item) => item.status === "processing") ? 3000 : 15000,
  });

  const previewQuery = useQuery<WorkspaceTranslationPreview>({
    queryKey: ["/api/intelligent-workspace/translation/uploads", previewDocumentId, "preview"],
    queryFn: () => fetchWorkspaceTranslationPreview(previewDocumentId ?? ""),
    enabled: Boolean(previewDocumentId),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadWorkspaceTranslationDocument,
    onSuccess: async (document) => {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setPreviewDocumentId(document.status === "translated" ? document.id : null);
      await uploadsQuery.refetch();
    },
  });

  const uploads = uploadsQuery.data ?? [];
  const translatedUploads = uploads.filter((upload) => upload.status === "translated").length;
  const processingUploads = uploads.filter((upload) => upload.status === "processing").length;
  const failedUploads = uploads.filter((upload) => upload.status === "failed").length;
  const translateDisabled = !selectedFile || uploadMutation.isPending;

  useEffect(() => {
    if (!previewDocumentId || !(previewQuery.error instanceof Error) || !previewQuery.error.message.startsWith("404:")) {
      return;
    }

    void uploadsQuery.refetch().then((result) => {
      const nextUploads = result.data ?? [];
      if (!nextUploads.some((upload) => upload.id === previewDocumentId)) {
        setPreviewDocumentId(null);
      }
    });
  }, [previewDocumentId, previewQuery.error, uploadsQuery]);

  return (
    <div className="flex h-full flex-col gap-4 p-1">
      <div className="min-h-0 flex-1">
        <div className="grid min-h-full gap-4 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Business Dock</div>
                <div className="text-lg font-semibold text-slate-900">{selectedAgent?.label ?? "Document Translation Workflow"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">What this service does</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedAgent?.description ?? "Upload source documents and prepare them for structure-preserving translation into the target language."}
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                Output
                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 shadow-sm">Translation-ready document</span>
              </div>
            </div>

            <div className="mt-5 rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Source Document</div>
              <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-slate-50 p-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">Upload a document to prepare translation intake</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Upload a source document, choose the target language, and COREVIA will classify, translate, and reconstruct the output artifact.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Source Language</div>
                  <select
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value)}
                    className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-0"
                  >
                    {translationLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Target Language</div>
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className="h-11 w-full rounded-[14px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-0"
                  >
                    {translationLanguageOptions.filter((option) => option.value !== "auto").map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                accept=".docx,.pdf,.pptx,.xlsx,.txt,.md,.html"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-[14px] border-slate-300 px-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose document
                </Button>
                <Button
                  className="h-11 rounded-[14px] bg-gradient-to-r from-cyan-600 to-violet-600 px-4 text-white hover:from-cyan-700 hover:to-violet-700"
                  disabled={translateDisabled}
                  onClick={() => {
                    if (!selectedFile) return;
                    uploadMutation.mutate({
                      file: selectedFile,
                      sourceLanguage,
                      targetLanguage,
                    });
                  }}
                >
                  {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Translate Document
                </Button>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                {selectedFile
                  ? `${selectedFile.name} • ${formatFileSize(selectedFile.size)}`
                  : "The workflow preserves protected tokens and reconstructs a translated output file in the target format."}
              </div>

              {uploadMutation.error ? (
                <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {uploadMutation.error.message}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Execution Feed</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Translation Runtime</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {uploads.length} files
              </div>
            </div>

            {uploadsQuery.isLoading ? (
              <div className="mt-5 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Loading translation jobs...</div>
            ) : uploads.length === 0 ? (
              <div className="mt-5 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Awaiting translated output.</div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/90 p-3 shadow-inner">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">List View</div>
                    <div className="mt-1 text-sm text-slate-600">A cleaner file runtime with only the high-level translation state.</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                      Ready <span className="ml-1 font-semibold text-slate-900">{translatedUploads}</span>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                      Active <span className="ml-1 font-semibold text-slate-900">{processingUploads}</span>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                      Exceptions <span className="ml-1 font-semibold text-slate-900">{failedUploads}</span>
                    </div>
                  </div>
                </div>
                <div className="max-h-[38rem] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                    <div className="hidden grid-cols-[minmax(0,1.5fr)_160px_180px_180px] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:grid">
                      <div>Document</div>
                      <div>Status</div>
                      <div>Last Activity</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                    {uploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 lg:grid-cols-[minmax(0,1.5fr)_160px_180px_180px] lg:items-center"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", getTranslationCardAccentClass(upload.status))} />
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-slate-50 text-slate-700">
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{upload.originalName}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span>{getTranslationFormatLabel(upload.documentFormat)}</span>
                              <span className="text-slate-300">•</span>
                              <span>{upload.sourceLanguage.toUpperCase()} → {upload.targetLanguage.toUpperCase()}</span>
                              <span className="text-slate-300">•</span>
                              <span>{getTranslationListSummary(upload)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center lg:block">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Status</div>
                          <div className={cn(
                            "mt-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] lg:mt-0",
                            getTranslationStatusBadgeClass(upload.status),
                          )}>
                            {upload.status}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">Last Activity</div>
                          <div className="text-sm font-medium text-slate-900">
                            {formatTranslationTimestamp(upload.translatedAt ?? upload.uploadedAt) ?? "Unknown"}
                          </div>
                          {upload.status === "processing" ? (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-sky-500 to-violet-600" style={{ width: `${Math.max(6, upload.progressPercent)}%` }} />
                              </div>
                              <div className="text-[11px] font-medium text-slate-500">{upload.progressPercent}%</div>
                            </div>
                          ) : null}
                          {upload.status === "failed" && upload.translationError ? (
                            <div className="mt-1 text-[12px] text-red-600">{upload.translationError}</div>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-start gap-2 lg:justify-end">
                          {upload.status === "translated" ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-[12px] border-slate-300 bg-white px-3"
                                onClick={() => setPreviewDocumentId(upload.id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </Button>
                              <a
                                href={`/api/intelligent-workspace/translation/uploads/${upload.id}/download`}
                                className="inline-flex h-9 items-center justify-center rounded-[12px] bg-slate-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Save
                              </a>
                            </>
                          ) : upload.status === "processing" ? (
                            <div className="text-[12px] font-medium text-slate-500">In progress</div>
                          ) : (
                            <div className="text-[12px] font-medium text-slate-500">Review required</div>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewDocumentId ? (
              <TranslationPreviewModal
              isOpen
              onClose={() => setPreviewDocumentId(null)}
              documentId={previewDocumentId}
              preview={previewQuery.data}
              isLoading={previewQuery.isLoading}
              isRefreshing={previewQuery.isFetching}
              errorMessage={previewQuery.error?.message ?? null}
              onRefresh={() => previewQuery.refetch()}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

      function TranslationPreviewModal({
        isOpen,
        onClose,
        documentId,
        preview,
        isLoading,
        isRefreshing,
        errorMessage,
        onRefresh,
      }: {
        isOpen: boolean;
        onClose: () => void;
        documentId: string;
        preview: WorkspaceTranslationPreview | undefined;
        isLoading: boolean;
        isRefreshing: boolean;
        errorMessage: string | null;
        onRefresh: () => void;
      }) {
        const [editableTextDraft, setEditableTextDraft] = useState(preview?.editableText ?? "");
        const [segmentDrafts, setSegmentDrafts] = useState<WorkspaceTranslationEditableSegment[]>(preview?.editableSegments ?? []);
        const [isEditorExpanded, setIsEditorExpanded] = useState(false);
        const [showOriginalPanel, setShowOriginalPanel] = useState(true);
        const [showLegalReviewPanel, setShowLegalReviewPanel] = useState(true);

        useEffect(() => {
          setEditableTextDraft(preview?.editableText ?? "");
          setSegmentDrafts(preview?.editableSegments ?? []);
        }, [preview?.editableText, preview?.editableSegments, documentId]);

        useEffect(() => {
          setIsEditorExpanded(false);
          setShowOriginalPanel(true);
          setShowLegalReviewPanel(true);
        }, [documentId]);

        const saveEditedTextMutation = useMutation({
          mutationFn: (translatedText: string) => saveWorkspaceTranslationEditedText({ documentId, translatedText }),
          onSuccess: async (savedPreview) => {
            queryClient.setQueryData(["/api/intelligent-workspace/translation/uploads", documentId, "preview"], savedPreview);
            await uploadsQuery.refetch();
          },
        });

        const saveEditedSegmentsMutation = useMutation({
          mutationFn: (segments: WorkspaceTranslationEditableSegment[]) => saveWorkspaceTranslationEditedSegments({ documentId, segments }),
          onSuccess: async (savedPreview) => {
            queryClient.setQueryData(["/api/intelligent-workspace/translation/uploads", documentId, "preview"], savedPreview);
            await uploadsQuery.refetch();
          },
        });

        if (!isOpen) return null;

    const riskTone = preview?.legalReview?.overallRisk === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : preview?.legalReview?.overallRisk === "low"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
    const legalReviewProvider = preview?.legalReview?.provider === "corevia-heuristic"
      ? "COREVIA fallback review"
      : preview?.legalReview?.provider ?? null;
    const sortedConcerns = [...(preview?.legalReview?.concerns ?? [])].sort((left, right) => severityPriority(left.severity) - severityPriority(right.severity));
    const sortedClauseAssessments = [...(preview?.legalReview?.clauseAssessments ?? [])].sort((left, right) => clauseAssessmentPriority(left.status) - clauseAssessmentPriority(right.status));
    const sortedPriorityActions = [...(preview?.legalReview?.priorityActions ?? [])].sort((left, right) => severityPriority(left.urgency) - severityPriority(right.urgency));
    const reviewGeneratedAt = formatTranslationTimestamp(preview?.legalReview?.generatedAt ?? null);
    const isRtl = preview?.html?.includes('dir="rtl"') ?? false;
    const lbl = {
      overallRisk: isRtl ? "المخاطر الإجمالية" : "Overall Risk",
      concernCount: isRtl ? "عدد المخاوف" : "Concern Count",
      concernCountDesc: isRtl ? "مسائل يجب مراجعتها من قبل المسؤولين القانونيين أو التجاريين قبل التوقيع." : "Issues that should be reviewed by legal or commercial owners before signing.",
      clauseAreas: isRtl ? "مجالات البنود المُراجعة" : "Clause Areas Reviewed",
      clauseAreasDesc: isRtl ? "مجالات قانونية وتجارية رئيسية تم فحصها لتغطية البنود أو ثغرات الصياغة." : "Core legal and commercial areas checked for visible clause coverage or drafting gaps.",
      priorityActions: isRtl ? "إجراءات ذات أولوية" : "Priority Actions",
      priorityActionsDesc: isRtl ? "خطوات صياغة أو تفاوض مرتّبة يجب معالجتها أولاً." : "Ordered drafting or negotiation moves that should be handled first.",
      confirmedStrengths: isRtl ? "نقاط القوة المؤكدة" : "Confirmed Strengths",
      confirmedStrengthsDesc: isRtl ? "بنود أو حمايات تم تحديدها إيجابياً في النص المترجم." : "Clauses or protections the review could positively identify in the translated text.",
      clauseCoverage: isRtl ? "خريطة تغطية البنود" : "Clause Coverage Map",
      evidenceFromReview: isRtl ? "الدليل من المراجعة" : "Evidence From Review",
      keyConcerns: isRtl ? "المخاوف الرئيسية" : "Key Concerns",
      whyItMatters: isRtl ? "لماذا هذا مهم" : "Why It Matters",
      recommendedAction: isRtl ? "الإجراء الموصى به" : "Recommended Action",
      recommendedActions: isRtl ? "الإجراءات الموصى بها" : "Recommended Actions",
      downloadLegalReview: isRtl ? "تحميل المراجعة القانونية" : "Download Legal Review",
      refreshReview: isRtl ? "تحديث المراجعة" : "Refresh Review",
      generateReview: isRtl ? "إنشاء المراجعة" : "Generate Review",
      legalReview: isRtl ? "المراجعة القانونية" : "Legal Review",
      concern: (n: number) => isRtl ? `${n} مخاوف` : `${n} concern${n === 1 ? "" : "s"}`,
      clauseArea: (n: number) => isRtl ? `${n} مجالات بنود` : `${n} clause area${n === 1 ? "" : "s"}`,
      priorityAction: (n: number) => isRtl ? `${n} إجراءات أولوية` : `${n} priority action${n === 1 ? "" : "s"}`,
      action: (n: number) => isRtl ? `${n} إجراءات` : `${n} action${n === 1 ? "" : "s"}`,
      reviewed: (ts: string) => isRtl ? `تمت المراجعة ${ts}` : `Reviewed ${ts}`,
    };
    const hasUnsavedEdits = preview ? editableTextDraft.trim() !== preview.editableText.trim() : false;
    const hasSegmentEditor = Boolean(preview?.canRegenerateArtifactFromEdits && preview?.editableSegments?.length);
    const hasUnsavedSegmentEdits = hasSegmentEditor && preview
      ? JSON.stringify(segmentDrafts.map((segment) => [segment.id, segment.translatedText]))
        !== JSON.stringify((preview.editableSegments ?? []).map((segment) => [segment.id, segment.translatedText]))
      : false;
    const translationSavedLabel = preview?.editableTextUpdatedAt
      ? `Saved ${formatTranslationTimestamp(preview.editableTextUpdatedAt)}`
      : "No saved text edits yet.";
    const reviewWorkspaceLayout = showOriginalPanel && showLegalReviewPanel
      ? "xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.45fr)_420px]"
      : showOriginalPanel
        ? "xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.6fr)]"
        : showLegalReviewPanel
          ? "xl:grid-cols-[minmax(0,1.55fr)_420px]"
          : "grid-cols-1";

    const renderEditorFields = (expanded: boolean) => {
      if (hasSegmentEditor) {
        return (
          <div className={cn("space-y-3 overflow-y-auto pr-1", expanded ? "min-h-0 flex-1" : "mt-3 max-h-[280px]")}>
            {segmentDrafts.map((segment, index) => (
              <div key={segment.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Segment {index + 1} • {segment.type.replaceAll("_", " ")}
                  </div>
                  <div className="text-[10px] text-slate-400">#{segment.order}</div>
                </div>
                <Textarea
                  value={segment.translatedText}
                  onChange={(event) => setSegmentDrafts((current) => current.map((entry) => entry.id === segment.id ? { ...entry, translatedText: event.target.value } : entry))}
                  className={cn(
                    "mt-2 resize-y rounded-[12px] border-slate-300 bg-white text-sm leading-6 text-slate-900",
                    expanded ? "min-h-[160px]" : "min-h-[96px]",
                  )}
                  dir="rtl"
                />
              </div>
            ))}
          </div>
        );
      }

      return (
        <Textarea
          value={editableTextDraft}
          onChange={(event) => setEditableTextDraft(event.target.value)}
          className={cn(
            "resize-y rounded-[14px] border-slate-300 bg-white text-sm leading-6 text-slate-900",
            expanded ? "min-h-0 flex-1" : "mt-3 min-h-[220px]",
          )}
          dir="rtl"
        />
      );
    };

    const renderEditorActions = () => (
      <>
        <div className="text-xs text-slate-500">
          {preview?.editableTextUpdatedAt
            ? `Saved ${formatTranslationTimestamp(preview.editableTextUpdatedAt)}`
            : "No saved text edits yet."}
        </div>
        <div className="flex items-center gap-2">
          {hasSegmentEditor ? (
            <>
              {hasUnsavedSegmentEdits ? <div className="text-xs font-medium text-amber-700">Unsaved segment edits</div> : null}
              <Button
                type="button"
                className="h-10 rounded-[14px] bg-slate-900 px-4 text-white hover:bg-slate-800"
                disabled={!preview || !hasUnsavedSegmentEdits || segmentDrafts.some((segment) => !segment.translatedText.trim()) || saveEditedSegmentsMutation.isPending}
                onClick={() => saveEditedSegmentsMutation.mutate(segmentDrafts)}
              >
                {saveEditedSegmentsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Edits And Rebuild Document
              </Button>
            </>
          ) : (
            <>
              {hasUnsavedEdits ? <div className="text-xs font-medium text-amber-700">Unsaved edits</div> : null}
              <Button
                type="button"
                className="h-10 rounded-[14px] bg-slate-900 px-4 text-white hover:bg-slate-800"
                disabled={!preview || !editableTextDraft.trim() || !hasUnsavedEdits || saveEditedTextMutation.isPending}
                onClick={() => saveEditedTextMutation.mutate(editableTextDraft)}
              >
                {saveEditedTextMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Edits And Refresh Review
              </Button>
            </>
          )}
        </div>
      </>
    );

        const modalContent = (
          <div className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm">
            <div className="absolute inset-0 flex min-h-dvh w-screen flex-col overflow-hidden bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Translation Review</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{preview?.translatedFilename ?? "Preparing preview"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={showOriginalPanel ? "outline" : "ghost"}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-sm"
                    onClick={() => setShowOriginalPanel((current) => !current)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {showOriginalPanel ? "Hide Original" : "Show Original"}
                  </Button>
                  <Button
                    type="button"
                    variant={showLegalReviewPanel ? "outline" : "ghost"}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-sm"
                    onClick={() => setShowLegalReviewPanel((current) => !current)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {showLegalReviewPanel ? "Hide Legal Review" : "Show Legal Review"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                    {preview?.legalReview ? "Refresh Legal Review" : "Generate Legal Review"}
                  </Button>
                  {preview?.legalReview ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-slate-300 bg-white px-4 text-sm"
                      onClick={() => downloadLegalReview(preview)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Legal Review
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="px-6 py-8 text-sm text-slate-600">Loading preview...</div>
              ) : errorMessage ? (
                <div className="px-6 py-8 text-sm text-red-700">{errorMessage}</div>
              ) : (
                <div className={cn("grid min-h-0 flex-1 gap-0", reviewWorkspaceLayout)}>
                  {showOriginalPanel ? (
                  <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
                    <div className="border-b border-slate-200 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Original
                    </div>
                    <iframe title="Original preview" className="min-h-0 flex-1 w-full bg-white" srcDoc={preview?.originalHtml ?? ""} />
                  </div>
                  ) : null}
                  <div className={cn("flex min-h-0 flex-col border-b border-slate-200 bg-slate-50", showLegalReviewPanel ? "xl:border-b-0 xl:border-r" : "border-b-0")}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Translated</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{translationSavedLabel}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {preview?.hasSavedTextEdits ? (
                          <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            Saved edits
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-[12px] border-slate-300 bg-white px-3 text-xs"
                          onClick={() => setIsEditorExpanded(true)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {hasSegmentEditor ? "Edit Translation" : "Open Editor"}
                        </Button>
                      </div>
                    </div>
                    <iframe title="Translated preview" className="min-h-0 flex-1 w-full bg-white" srcDoc={preview?.html ?? ""} />
                  </div>
                  {showLegalReviewPanel ? (
                  <div className="flex min-h-0 flex-col border-t border-slate-200 xl:border-l xl:border-t-0">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {lbl.legalReview}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-[12px] border-slate-300 px-3 text-xs"
                          onClick={onRefresh}
                          disabled={isRefreshing}
                        >
                          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                          {preview?.legalReview ? lbl.refreshReview : lbl.generateReview}
                        </Button>
                        {preview?.legalReview ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-[12px] border-slate-300 px-3 text-xs"
                            onClick={() => downloadLegalReview(preview)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download Review
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4" dir={isRtl ? "rtl" : "ltr"}>
                      <div className="space-y-4">
                      {preview?.legalReview ? (
                        <div className="space-y-4">
                          <div className={`rounded-[16px] border px-4 py-3 ${riskTone}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">{lbl.overallRisk}</div>
                              {legalReviewProvider ? <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">{legalReviewProvider}</div> : null}
                            </div>
                            <div className="mt-1 text-base font-semibold">{preview.legalReview.overallRisk.toUpperCase()}</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{preview.legalReview.summary}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
                              <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-700">
                                {lbl.concern(sortedConcerns.length)}
                              </span>
                              <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-700">
                                {lbl.clauseArea(sortedClauseAssessments.length)}
                              </span>
                              <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-700">
                                {lbl.priorityAction(sortedPriorityActions.length)}
                              </span>
                              <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-700">
                                {lbl.action(preview.legalReview.suggestions.length)}
                              </span>
                              {reviewGeneratedAt ? (
                                <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-700">
                                  {lbl.reviewed(reviewGeneratedAt)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-4">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-[12px] border-white/60 bg-white/85 px-4 text-sm text-slate-900 hover:bg-white"
                                onClick={() => downloadLegalReview(preview)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                {lbl.downloadLegalReview}
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                {lbl.concernCount}
                              </div>
                              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{sortedConcerns.length}</div>
                              <div className="mt-1 text-sm leading-6 text-slate-600">{lbl.concernCountDesc}</div>
                            </div>
                            <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                {lbl.clauseAreas}
                              </div>
                              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{sortedClauseAssessments.length}</div>
                              <div className="mt-1 text-sm leading-6 text-slate-600">{lbl.clauseAreasDesc}</div>
                            </div>
                            <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                <Scale className="h-4 w-4 text-sky-700" />
                                {lbl.priorityActions}
                              </div>
                              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{sortedPriorityActions.length}</div>
                              <div className="mt-1 text-sm leading-6 text-slate-600">{lbl.priorityActionsDesc}</div>
                            </div>
                            <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                <CalendarDays className="h-4 w-4 text-slate-600" />
                                {lbl.confirmedStrengths}
                              </div>
                              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{preview.legalReview.strengths.length}</div>
                              <div className="mt-1 text-sm leading-6 text-slate-600">{lbl.confirmedStrengthsDesc}</div>
                            </div>
                          </div>

                          {sortedClauseAssessments.length > 0 ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.clauseCoverage}</div>
                              <div className="mt-3 space-y-3">
                                {sortedClauseAssessments.map((assessment, index) => (
                                  <div key={`${assessment.area}-${index}`} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-semibold text-slate-900">{assessment.area}</div>
                                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${assessment.status === "missing" ? "bg-red-100 text-red-700" : assessment.status === "attention" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                        {assessment.status}
                                      </span>
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assessment.detail}</p>
                                    {assessment.excerpt ? (
                                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.evidenceFromReview}</div>
                                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assessment.excerpt}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {sortedConcerns.length > 0 ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.keyConcerns}</div>
                              <div className="mt-3 space-y-3">
                                {sortedConcerns.map((concern, index) => (
                                  <div key={`${concern.title}-${index}`} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-semibold text-slate-900">{concern.title}</div>
                                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${concern.severity === "high" ? "bg-red-100 text-red-700" : concern.severity === "low" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                        {concern.severity}
                                      </span>
                                    </div>
                                    {concern.excerpt ? (
                                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.evidenceFromReview}</div>
                                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{concern.excerpt}</div>
                                      </div>
                                    ) : null}
                                    <div className="mt-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.whyItMatters}</div>
                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{concern.explanation}</p>
                                    </div>
                                    {concern.recommendation ? (
                                      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">{lbl.recommendedAction}</div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">{concern.recommendation}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {sortedPriorityActions.length > 0 ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.priorityActions}</div>
                              <div className="mt-3 space-y-2">
                                {sortedPriorityActions.map((action, index) => (
                                  <div key={`${action.title}-${index}`} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="font-semibold text-slate-900">{index + 1}. {action.title}</div>
                                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${action.urgency === "high" ? "bg-red-100 text-red-700" : action.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                        {action.urgency}
                                      </span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{action.rationale}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {preview.legalReview.strengths.length > 0 ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.confirmedStrengths}</div>
                              <div className="mt-3 space-y-2">
                                {preview.legalReview.strengths.map((strength, index) => (
                                  <div key={`${strength}-${index}`} className="rounded-[14px] border border-emerald-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 shadow-sm">{strength}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {preview.legalReview.suggestions.length > 0 ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{lbl.recommendedActions}</div>
                              <div className="mt-3 space-y-2">
                                {preview.legalReview.suggestions.map((suggestion, index) => (
                                  <div key={`${suggestion}-${index}`} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                                    <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">{index + 1}</span>
                                    {suggestion}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-500 shadow-sm">
                            {preview.legalReview.disclaimer}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[16px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">Legal review is not available yet.</div>
                          <p className="mt-2">
                            If review generation was temporarily unavailable, use the button below to request a fresh review without leaving the translation workspace.
                          </p>
                          <div className="mt-4">
                            <Button
                              type="button"
                              className="h-10 rounded-[14px] bg-slate-900 px-4 text-white hover:bg-slate-800"
                              onClick={onRefresh}
                              disabled={isRefreshing}
                            >
                              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                              Generate Legal Review
                            </Button>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                  ) : null}
                </div>
              )}

              {isEditorExpanded ? (
                <div className="absolute inset-0 z-20 flex flex-col bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Focused Translation Editor</div>
                      <div className="mt-1 text-base font-semibold text-slate-900">Edit the translated Arabic text in a larger workspace</div>
                    </div>
                    <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={() => setIsEditorExpanded(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col bg-slate-50 px-5 py-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="text-sm text-slate-600">
                        Arabic-only editing surface for long documents. Save here to rebuild the translated artifact and refresh legal review.
                      </div>
                      {preview?.hasSavedTextEdits ? (
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                          Saved edits
                        </div>
                      ) : null}
                    </div>

                    {renderEditorFields(true)}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      {renderEditorActions()}
                    </div>

                    {saveEditedTextMutation.error ? (
                      <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {saveEditedTextMutation.error.message}
                      </div>
                    ) : null}

                    {saveEditedSegmentsMutation.error ? (
                      <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {saveEditedSegmentsMutation.error.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );

        return createPortal(modalContent, document.body);
      }
}

export function WorkflowNavigatorModal({
  isOpen,
  onClose,
  agents,
  selectedId,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  agents: WorkspaceAgent[];
  selectedId: string | undefined;
  onSelect: (agent: WorkspaceAgent) => void;
}) {
  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <button
        type="button"
        aria-label="Close service selector"
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 mx-auto w-[90vw] max-w-[900px]">
        <div className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-lg backdrop-blur-2xl">
          <div className="relative p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Business Dock</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">Choose a service</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Pick the workflow you want to run inside the workspace.</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:scale-105 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const isSelected = selectedId === agent.id;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelect(agent)}
                    className={cn(
                      "rounded-[18px] border p-5 text-left shadow-sm transition-all",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:-translate-y-0.5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700")}>
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600")}>
                        {agent.workflowSteps.length} agents
                      </div>
                    </div>
                    <div className="mt-4 text-lg font-semibold tracking-[-0.03em]">{agent.label}</div>
                    <p className={cn("mt-2 text-sm leading-6", isSelected ? "text-slate-100" : "text-slate-600")}>{agent.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function WorkflowBuilderPanel({ agents: _agents, selectedAgent }: Readonly<WorkflowBuilderPanelProps>) {
  const [taskDraft, setTaskDraft] = useState(initialTask(selectedAgent ?? undefined));

  useEffect(() => {
    setTaskDraft(initialTask(selectedAgent ?? undefined));
  }, [selectedAgent]);

  const runMutation = useMutation<WorkspaceAgentRunResponse, Error, { agent: string; inputs: Record<string, unknown> }>({
    mutationFn: runWorkspaceAgent,
  });

  const runDisabled = !(selectedAgent?.enabled && taskDraft.trim()) || runMutation.isPending;
  const workspaceOutputStatusLabel = getWorkspaceOutputStatusLabel(runMutation.isPending, Boolean(runMutation.data));

  if (selectedAgent?.id === "translation-agent") {
    return <TranslationWorkflowPanel selectedAgent={selectedAgent} />;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-1">
      <div className="min-h-0 flex-1">
        <div className="grid min-h-full gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Business Dock</div>
                <div className="text-lg font-semibold text-slate-900">{selectedAgent?.label ?? "Select a workflow"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">What this service does</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedAgent?.description ?? "Choose a Business Dock service to compose work and generate output."}</p>
              {selectedAgent ? (
                <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Output
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 shadow-sm">{selectedAgent.output}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Task Brief</div>
              <Textarea
                value={taskDraft}
                onChange={(event) => {
                  setTaskDraft(event.target.value);
                }}
                className="min-h-[14rem] resize-none rounded-[16px] border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 shadow-none placeholder:text-slate-500"
                placeholder="Describe your task. The selected service will use workspace context to generate the output."
              />
            </div>

            <Button
              className="mt-4 h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-violet-600 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-cyan-700 hover:to-violet-700 disabled:opacity-40"
              disabled={runDisabled}
              onClick={() => {
                if (!selectedAgent) return;
                runMutation.mutate({
                  agent: selectedAgent.id,
                  inputs: {
                    task: taskDraft.trim(),
                    includeDecisions: true,
                    includeSignals: true,
                    source: "workspace",
                  },
                });
              }}
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {runMutation.isPending ? "Processing..." : "Run Agent"}
            </Button>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Execution Feed</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Workspace Output</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {workspaceOutputStatusLabel}
              </div>
            </div>

            <div className="mt-5 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 shadow-sm">
              {runMutation.data?.message ?? "Select a workflow, describe the task, and run the service. COREVIA will process the current workspace context and return the result here."}
            </div>

            {runMutation.data?.outputs?.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {runMutation.data.outputs.map((output) => (
                  <div
                    key={`${runMutation.data?.taskId}-${output.agentId}`}
                    className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{output.agentId}</span>
                      <span className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                        output.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                      )}>
                        {output.success ? "Success" : "Failed"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Confidence:</span>
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">{Math.round(output.confidence * 100)}%</span>
                      <span>·</span>
                      <span>{output.executionTimeMs}ms</span>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-muted-foreground">{output.reasoning ?? "No reasoning returned."}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
