import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Upload, FileText, Sparkles, CheckCircle2, AlertTriangle,
  Loader2, FileSpreadsheet, FileImage, FileCode, File,
  Pencil, Trash2, Plus, ChevronDown, ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── Field definitions per registry type ──────────────────────────────
const REGISTRY_FIELDS: Record<string, Array<{
  key: string; label: string; type: "text" | "number" | "select" | "boolean" | "textarea";
  options?: string[]; required?: boolean;
}>> = {
  applications: [
    { key: "name", label: "Application Name", type: "text", required: true },
    { key: "vendor", label: "Vendor", type: "text" },
    { key: "version", label: "Version", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "criticality", label: "Criticality", type: "select", options: ["critical", "high", "medium", "low"] },
    { key: "lifecycle", label: "Lifecycle", type: "select", options: ["active", "planned", "sunset", "retired"] },
    { key: "hosting", label: "Hosting", type: "select", options: ["on-premise", "cloud", "hybrid", "SaaS"] },
    { key: "department", label: "Department", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "tier", label: "Tier", type: "select", options: ["tier1", "tier2", "tier3"] },
    { key: "userCount", label: "User Count", type: "number" },
    { key: "annualCost", label: "Annual Cost", type: "number" },
    { key: "contractExpiry", label: "Contract Expiry", type: "text" },
    { key: "dataClassification", label: "Data Classification", type: "select", options: ["public", "internal", "confidential", "restricted"] },
    { key: "disasterRecovery", label: "Disaster Recovery", type: "select", options: ["active-active", "active-passive", "cold-standby", "none"] },
  ],
  capabilities: [
    { key: "name", label: "Capability Name", type: "text", required: true },
    { key: "level", label: "Level", type: "number" },
    { key: "domain", label: "Domain", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "maturity", label: "Maturity", type: "select", options: ["initial", "managed", "defined", "quantitatively_managed", "optimizing"] },
    { key: "strategicImportance", label: "Strategic Importance", type: "select", options: ["critical", "high", "medium", "low"] },
    { key: "description", label: "Description", type: "textarea" },
  ],
  "data-domains": [
    { key: "name", label: "Domain Name", type: "text", required: true },
    { key: "classification", label: "Classification", type: "select", options: ["public", "internal", "confidential", "restricted", "top_secret"] },
    { key: "owner", label: "Owner", type: "text" },
    { key: "steward", label: "Steward", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "piiFlag", label: "Contains PII", type: "boolean" },
    { key: "crossBorderRestriction", label: "Cross-Border Restriction", type: "boolean" },
    { key: "retentionPeriod", label: "Retention Period", type: "text" },
    { key: "storageLocation", label: "Storage Location", type: "text" },
    { key: "qualityScore", label: "Quality Score (0-100)", type: "number" },
    { key: "sourceSystem", label: "Source System", type: "text" },
    { key: "regulatoryFramework", label: "Regulatory Framework", type: "text" },
  ],
  "technology-standards": [
    { key: "name", label: "Technology Name", type: "text", required: true },
    { key: "layer", label: "Layer", type: "select", options: ["infrastructure", "platform", "application", "data", "security", "integration"], required: true },
    { key: "category", label: "Category", type: "text" },
    { key: "vendor", label: "Vendor", type: "text" },
    { key: "version", label: "Version", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["approved", "under_review", "deprecated", "prohibited"] },
    { key: "lifecycle", label: "Lifecycle", type: "select", options: ["active", "planned", "sunset", "retired"] },
    { key: "description", label: "Description", type: "textarea" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "supportExpiry", label: "Support Expiry", type: "text" },
    { key: "replacementPlan", label: "Replacement Plan", type: "textarea" },
  ],
  integrations: [
    { key: "sourceName", label: "Source System", type: "text", required: true },
    { key: "targetName", label: "Target System", type: "text", required: true },
    { key: "protocol", label: "Protocol", type: "select", options: ["REST", "SOAP", "GraphQL", "gRPC", "SFTP", "MQ", "Kafka"] },
    { key: "pattern", label: "Pattern", type: "select", options: ["sync", "async", "batch", "event-driven", "pub-sub"] },
    { key: "frequency", label: "Frequency", type: "select", options: ["real-time", "hourly", "daily", "weekly", "on-demand"] },
    { key: "dataFlow", label: "Data Flow", type: "select", options: ["unidirectional", "bidirectional"] },
    { key: "criticality", label: "Criticality", type: "select", options: ["critical", "high", "medium", "low"] },
    { key: "status", label: "Status", type: "select", options: ["active", "planned", "deprecated"] },
    { key: "description", label: "Description", type: "textarea" },
    { key: "owner", label: "Owner", type: "text" },
  ],
};

const REGISTRY_LABELS: Record<string, string> = {
  applications: "Applications",
  capabilities: "Capabilities",
  "data-domains": "Data Domains",
  "technology-standards": "Technology Standards",
  integrations: "Integrations",
};

const ACCENT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  applications: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  capabilities: { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" },
  "data-domains": { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  "technology-standards": { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" },
  integrations: { bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-300", badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
};

const fileIcon = (name: string) => {
  if (name.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (name.endsWith(".xlsx") || name.endsWith(".csv") || name.endsWith(".xls")) return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".xml")) return <FileCode className="h-5 w-5 text-amber-500" />;
  return <File className="h-5 w-5 text-slate-500" />;
};

type ExtractedEntry = Record<string, unknown>;

interface DocumentUploadExtractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registryType: string;
  /** Query key to invalidate after successful confirm */
  queryKey: string[];
}

type Phase = "upload" | "extracting" | "review" | "confirming" | "done";

export function DocumentUploadExtractDialog({
  open,
  onOpenChange,
  registryType,
  queryKey,
}: DocumentUploadExtractDialogProps) {
  const { t: _t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedEntries, setExtractedEntries] = useState<ExtractedEntry[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  const fields = REGISTRY_FIELDS[registryType] ?? [];
  const accent = (ACCENT_COLORS[registryType] ?? ACCENT_COLORS.applications)!;
  const label = REGISTRY_LABELS[registryType] ?? registryType;

  const reset = () => {
    setPhase("upload");
    setSelectedFile(null);
    setExtractedEntries([]);
    setEditingIndex(null);
    setRemovedIndices(new Set());
    setDocumentId(null);
    setErrorMsg(null);
    setExpandedEntries(new Set());
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // ── Upload & Extract mutation ──────────────────────────────────────
  const uploadExtractMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/ea/registry/documents/${registryType}/upload-extract`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload & extraction failed");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setExtractedEntries(data.extractedEntries || []);
      setDocumentId(data.documentId || null);
      // Auto-expand all entries
      setExpandedEntries(new Set((data.extractedEntries || []).map((_: unknown, i: number) => i)));
      setPhase("review");
      toast({
        title: `${data.totalExtracted} entries extracted`,
        description: `From "${data.fileName}". Review and confirm below.`,
      });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setPhase("upload");
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Confirm mutation ───────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: async (entries: ExtractedEntry[]) => {
      const r = await fetch(`/api/ea/registry/documents/${registryType}/confirm-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, documentId }),
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Confirm failed" }));
        throw new Error(err.error || "Failed to confirm entries");
      }
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/ea/registry/baseline"] });
      setPhase("done");
      toast({
        title: `${data.totalCreated} entries created`,
        description: `Successfully added to ${label} registry.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create entries", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleStartExtraction = () => {
    if (!selectedFile) return;
    setPhase("extracting");
    uploadExtractMutation.mutate(selectedFile);
  };

  const handleConfirm = () => {
    const entries = extractedEntries.filter((_, i) => !removedIndices.has(i));
    if (entries.length === 0) {
      toast({ title: "No entries to confirm", variant: "destructive" });
      return;
    }
    setPhase("confirming");
    confirmMutation.mutate(entries);
  };

  const updateEntry = (index: number, key: string, value: unknown) => {
    setExtractedEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const toggleRemove = (index: number) => {
    setRemovedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const activeEntries = extractedEntries.filter((_, i) => !removedIndices.has(i));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Upload & Extract — {label}
            <Badge className={`${accent.badge} text-xs ml-auto`}>
              AI-Powered
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ── Phase: Upload ────────────────────────────────────────── */}
          {phase === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a document (PDF, DOCX, XLSX, CSV, etc.) and COREVIA AI will automatically extract
                structured {label.toLowerCase()} data. You can review and edit before confirming.
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                  ${dragOver
                    ? `${accent.border} ${accent.bg} scale-[1.01]`
                    : selectedFile
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.yaml,.pptx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    {fileIcon(selectedFile.name)}
                    <div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Upload className="h-10 w-10" />
                    <div>
                      <p className="font-medium text-sm">Drop your document here or click to browse</p>
                      <p className="text-xs mt-1">PDF, DOCX, XLSX, CSV, TXT, PPTX — up to 50 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  disabled={!selectedFile}
                  onClick={handleStartExtraction}
                  className={`gap-2 ${accent.bg} ${accent.text} ${accent.border} border hover:opacity-90`}
                >
                  <Sparkles className="h-4 w-4" />
                  Upload & Extract with AI
                </Button>
              </div>
            </div>
          )}

          {/* ── Phase: Extracting ────────────────────────────────────── */}
          {phase === "extracting" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center animate-pulse">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <Loader2 className="absolute -top-2 -right-2 h-6 w-6 text-indigo-500 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Extracting data from document...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  COREVIA AI is reading "{selectedFile?.name}" and extracting {label.toLowerCase()} data
                </p>
              </div>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="h-1.5 w-8 rounded-full bg-indigo-500/30"
                    style={{
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Phase: Review ────────────────────────────────────────── */}
          {phase === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Extracted {extractedEntries.length} {label.toLowerCase()} entries
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Review, edit, or remove entries before adding to the registry. Entries will be created with "Pending Verification" status.
                  </p>
                </div>
                <Badge className={accent.badge}>
                  {activeEntries.length} / {extractedEntries.length} selected
                </Badge>
              </div>

              <div className="space-y-3">
                {extractedEntries.map((entry, index) => {
                  const isRemoved = removedIndices.has(index);
                  const isExpanded = expandedEntries.has(index);
                  const isEditing = editingIndex === index;
                  const entryName = String(
                    entry.name || entry.sourceName || `Entry ${index + 1}`
                  );

                  return (
                    <div
                      key={index}
                      className={`rounded-lg border transition-all ${
                        isRemoved
                          ? "opacity-40 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10"
                          : `${accent.border} ${accent.bg}`
                      }`}
                    >
                      {/* Entry header */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button onClick={() => toggleExpand(index)} className="p-0.5">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </button>
                        <span className={`text-xs font-mono ${accent.text} px-1.5 py-0.5 rounded ${accent.badge}`}>
                          #{index + 1}
                        </span>
                        <span className="font-medium text-sm flex-1 truncate">{entryName}</span>
                        <div className="flex items-center gap-1">
                          {!isRemoved && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingIndex(isEditing ? null : index)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${isRemoved ? "text-emerald-500" : "text-red-500"}`}
                            onClick={() => toggleRemove(index)}
                          >
                            {isRemoved ? <Plus className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Entry fields */}
                      {isExpanded && !isRemoved && (
                        <div className="px-3 pb-3 border-t border-slate-200/50 dark:border-slate-700/50">
                          <div className={`grid gap-2 mt-2 ${isEditing ? "grid-cols-2" : "grid-cols-3"}`}>
                            {fields.map((field) => {
                              const val = entry[field.key];
                              const displayVal = val === null || val === undefined ? "—" : String(val);

                              if (isEditing) {
                                return (
                                  <div key={field.key} className={field.type === "textarea" ? "col-span-2" : ""}>
                                    <Label className="text-[10px] text-muted-foreground">
                                      {field.label}
                                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                    </Label>
                                    {field.type === "select" ? (
                                      <Select
                                        value={displayVal === "—" ? "" : displayVal}
                                        onValueChange={(v) => updateEntry(index, field.key, v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {field.options?.map(o => (
                                            <SelectItem key={o} value={o}>{o}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : field.type === "textarea" ? (
                                      <Textarea
                                        className="text-xs min-h-[60px]"
                                        value={displayVal === "—" ? "" : displayVal}
                                        onChange={(e) => updateEntry(index, field.key, e.target.value)}
                                      />
                                    ) : field.type === "boolean" ? (
                                      <Select
                                        value={val ? "true" : "false"}
                                        onValueChange={(v) => updateEntry(index, field.key, v === "true")}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="true">Yes</SelectItem>
                                          <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        className="h-8 text-xs"
                                        type={field.type === "number" ? "number" : "text"}
                                        value={displayVal === "—" ? "" : displayVal}
                                        onChange={(e) => updateEntry(
                                          index,
                                          field.key,
                                          field.type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value
                                        )}
                                      />
                                    )}
                                  </div>
                                );
                              }

                              // Read-only display
                              if (displayVal === "—" || displayVal === "" || displayVal === "null") return null;
                              return (
                                <div key={field.key} className="text-xs">
                                  <span className="text-muted-foreground">{field.label}:</span>{" "}
                                  <span className="font-medium">
                                    {field.type === "boolean"
                                      ? (val ? "Yes" : "No")
                                      : displayVal}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {isEditing && (
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => setEditingIndex(null)}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Done Editing
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1">
                  <Upload className="h-3 w-3" />
                  Upload Different Document
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={activeEntries.length === 0}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Add {activeEntries.length} Entries
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Phase: Confirming ─────────────────────────────────────── */}
          {phase === "confirming" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium">Creating {activeEntries.length} registry entries...</p>
            </div>
          )}

          {/* ── Phase: Done ───────────────────────────────────────────── */}
          {phase === "done" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Extraction Complete!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {confirmMutation.data?.totalCreated ?? activeEntries.length} entries have been added to the {label} registry
                  with "Pending Verification" status.
                </p>
              </div>
              <Button onClick={handleClose} className="mt-2">Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
