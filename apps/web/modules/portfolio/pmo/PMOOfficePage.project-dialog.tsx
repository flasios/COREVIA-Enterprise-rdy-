import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight, CheckCircle2, FileText, Loader2, Plus, Send, Sparkles } from "lucide-react";
import type { PipelineItem } from "./PMOOfficePage";

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function deriveTargetDate(startDateValue: string, expectedTimeline: string | null | undefined): string {
  if (!startDateValue || !expectedTimeline) return "";
  const startDate = new Date(startDateValue);
  if (Number.isNaN(startDate.getTime())) return "";

  const normalized = expectedTimeline.toLowerCase();
  const numericParts = Array.from(normalized.matchAll(/\d+/g)).map((match) => Number(match[0]));
  const amount = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const targetDate = new Date(startDate);
  if (normalized.includes("year")) {
    targetDate.setFullYear(targetDate.getFullYear() + amount);
  } else if (normalized.includes("month")) {
    targetDate.setMonth(targetDate.getMonth() + amount);
  } else if (normalized.includes("week")) {
    targetDate.setDate(targetDate.getDate() + (amount * 7));
  } else if (normalized.includes("day")) {
    targetDate.setDate(targetDate.getDate() + amount);
  } else {
    return "";
  }

  return targetDate.toISOString().slice(0, 10);
}

function mapUrgencyToPriority(urgency: string | null | undefined): string {
  const normalized = String(urgency || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  return "medium";
}

export function extractBudgetRange(budgetText: string | null | undefined): string {
  if (!budgetText) return "TBD";

  const text = budgetText.trim();
  if (text === "") return "TBD";

  const upperMatch = /(under|below|less than)\s*(aed)?\s*([\d,]+(?:\.\d+)?)/i.exec(text);
  if (upperMatch) {
    return `Below AED ${upperMatch[3]}`;
  }

  const betweenMatch = /between\s*(aed)?\s*([\d,]+(?:\.\d+)?)\s*(?:and|-)\s*(aed)?\s*([\d,]+(?:\.\d+)?)/i.exec(text);
  if (betweenMatch) {
    return `AED ${betweenMatch[2]} - AED ${betweenMatch[4]}`;
  }

  const singleMatch = /([\d,]+(?:\.\d+)?)/.exec(text);
  if (singleMatch) {
    return text.toUpperCase().includes("AED") ? text : `AED ${singleMatch[1]}`;
  }

  return text;
}

function getBudgetPrefillValue(item: PipelineItem): string {
  const budgetText = extractBudgetRange(item.estimatedBudget || item.budgetRange);
  const normalized = budgetText.replaceAll(/[^0-9.]/g, "").trim();

  if (!budgetText || budgetText === "TBD") return "";
  if (normalized === "" || Number(normalized) <= 0) return "";

  return budgetText;
}

function coerceToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return '';
}

const AI_ASSIST_FIELD_MAP: ReadonlyArray<[string, string]> = [
  ['currentChallenges', 'currentChallenges'],
  ['expectedOutcomes', 'expectedOutcomes'],
  ['successCriteria', 'successCriteria'],
  ['stakeholders', 'stakeholders'],
  ['riskFactors', 'riskFactors'],
  ['suggestedProjectName', 'projectName'],
];

function applyAiGeneratedFields(
  data: Record<string, unknown>,
  currentValues: Record<string, string>,
  setters: Record<string, (value: string) => void>,
): void {
  for (const [dataKey, stateKey] of AI_ASSIST_FIELD_MAP) {
    if (data[dataKey] && !currentValues[stateKey]) {
      setters[stateKey]?.(coerceToString(data[dataKey]));
    }
  }
}

export function PmoCreateProjectDialog({
  open,
  onOpenChange,
  pipelineItems,
  onConfirm,
  isPending,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineItems: PipelineItem[];
  onConfirm: (data: {
    creationMode: 'conversion' | 'direct';
    demandReportId?: string;
    projectName: string;
    priority: string;
    projectType: string;
    projectManager: string;
    estimatedBudget: string;
    targetDate: string;
    strategicObjective: string;
    workspacePath: 'standard' | 'accelerator';
    organizationName: string;
    department: string;
    requestorName: string;
    requestorEmail: string;
    industryType: string;
    currentChallenges: string;
    expectedOutcomes: string;
    successCriteria: string;
    stakeholders: string;
    riskFactors: string;
    dataClassification: string;
  }) => void;
  isPending: boolean;
}>) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const eligibleItems = pipelineItems.filter((item) => !item.hasPortfolioProject);
  const [creationMode, setCreationMode] = useState<'conversion' | 'direct'>(eligibleItems.length > 0 ? 'conversion' : 'direct');
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [workspacePath, setWorkspacePath] = useState<'standard' | 'accelerator'>('standard');
  const [projectName, setProjectName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [projectType, setProjectType] = useState("transformation");
  const [projectManager, setProjectManager] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [strategicObjective, setStrategicObjective] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [department, setDepartment] = useState("");
  const [requestorName, setRequestorName] = useState(currentUser?.displayName || "");
  const [requestorEmail, setRequestorEmail] = useState(currentUser?.email || "");
  const [industryType, setIndustryType] = useState("government");
  const [currentChallenges, setCurrentChallenges] = useState("");
  const [expectedOutcomes, setExpectedOutcomes] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [stakeholders, setStakeholders] = useState("");
  const [riskFactors, setRiskFactors] = useState("");
  const [dataClassification, setDataClassification] = useState("internal");
  const [aiFieldsGenerated, setAiFieldsGenerated] = useState(false);

  const aiAssistMutation = useMutation({
    mutationFn: async (objective: string) => {
      const response = await apiRequest("POST", "/api/demand-analysis/generate-fields", {
        businessObjective: objective,
        organizationName: organizationName || undefined,
        department: department || undefined,
        industryType: industryType || undefined,
        dataClassification: dataClassification || undefined,
      });
      return response.json();
    },
    onSuccess: (result: Record<string, unknown>) => {
      const data = result?.data as Record<string, unknown> | undefined;
      if (!data) return;
      applyAiGeneratedFields(
        data,
        { currentChallenges, expectedOutcomes, successCriteria, stakeholders, riskFactors, projectName },
        { currentChallenges: setCurrentChallenges, expectedOutcomes: setExpectedOutcomes, successCriteria: setSuccessCriteria, stakeholders: setStakeholders, riskFactors: setRiskFactors, projectName: setProjectName },
      );
      setAiFieldsGenerated(true);
    },
  });

  const selectedItem = eligibleItems.find((item) => item.id === selectedPipelineId) ?? null;

  useEffect(() => {
    if (!open) return;
    setCreationMode(eligibleItems.length > 0 ? 'conversion' : 'direct');
  }, [open, eligibleItems.length]);

  useEffect(() => {
    if (!open) return;
    if (eligibleItems.length === 0) {
      setSelectedPipelineId("");
      return;
    }
    setSelectedPipelineId((current) => (current && eligibleItems.some((item) => item.id === current) ? current : eligibleItems[0]!.id));
  }, [open, eligibleItems]);

  useEffect(() => {
    if (!open) return;

    if (creationMode === 'direct') {
      setProjectName("");
      setPriority("medium");
      setProjectType("transformation");
      setProjectManager("");
      setEstimatedBudget("");
      setTargetDate("");
      setStrategicObjective("");
      setOrganizationName("");
      setDepartment("");
      setRequestorName(currentUser?.displayName || "");
      setRequestorEmail(currentUser?.email || "");
      setIndustryType("government");
      setCurrentChallenges("");
      setExpectedOutcomes("");
      setSuccessCriteria("");
      setStakeholders("");
      setRiskFactors("");
      setDataClassification("internal");
      setAiFieldsGenerated(false);
      return;
    }

    if (!selectedItem) return;

    const defaultStartDate = toDateInputValue(selectedItem.createdAt) || toDateInputValue(new Date().toISOString());
    setProjectName(asText(selectedItem.suggestedProjectName ?? selectedItem.businessObjective));
    setPriority(mapUrgencyToPriority(selectedItem.urgency));
    setProjectType("transformation");
    setProjectManager("");
    setEstimatedBudget(getBudgetPrefillValue(selectedItem));
    setTargetDate(deriveTargetDate(defaultStartDate, selectedItem.expectedTimeline));
    setStrategicObjective(asText(selectedItem.businessObjective));
  }, [open, creationMode, selectedItem, currentUser?.displayName, currentUser?.email]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-pmo-create-project">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            Add Project From PMO
          </DialogTitle>
          <DialogDescription>
            Create a project directly from PMO or convert an approved demand from the pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={creationMode === 'direct' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setCreationMode('direct')}
              data-testid="button-pmo-direct-project"
            >
              <Plus className="h-4 w-4" />
              Create Directly
            </Button>
            <Button
              type="button"
              variant={creationMode === 'conversion' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => eligibleItems.length > 0 && setCreationMode('conversion')}
              disabled={eligibleItems.length === 0}
              data-testid="button-pmo-convert-demand"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Convert Demand
            </Button>
          </div>

          {creationMode === 'conversion' && eligibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">No eligible pipeline demands available</p>
              <p className="mt-1 text-sm text-muted-foreground">Switch to direct creation or move a demand into the approved pipeline first.</p>
            </div>
          ) : null}

          {creationMode === 'conversion' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="pmo-source-demand">Source demand</Label>
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger id="pmo-source-demand" data-testid="select-pmo-source-demand">
                    <SelectValue placeholder="Select demand" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {(item.suggestedProjectName || item.businessObjective || 'Demand').slice(0, 80)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedItem ? (
                <>
                  <Card className="border-slate-200/60 bg-slate-50/80 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/40">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-sky-600" />
                        Demand Intake Summary
                      </CardTitle>
                      <CardDescription>
                        Review the approved demand details before submitting the project conversion.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Demand</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedItem.suggestedProjectName || selectedItem.businessObjective || 'Demand intake'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Organization</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedItem.organizationName || organizationName || 'Not provided'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedItem.estimatedBudget || selectedItem.budgetRange || estimatedBudget || 'TBD'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedItem.expectedTimeline || 'TBD'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="pmo-project-name-conversion">Project name <span className="text-destructive">*</span></Label>
                      <Input
                        id="pmo-project-name-conversion"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Enter project name"
                        data-testid="input-pmo-project-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger data-testid="select-pmo-priority"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-muted-foreground">
                  Select an approved demand to preload the conversion form.
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-muted-foreground">
              Start with the core project details below. COREVIA will create the project directly in the PMO workspace.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-project-name-direct">Project name <span className="text-destructive">*</span></Label>
              <Input
                id="pmo-project-name-direct"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                data-testid="input-pmo-project-name-direct"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-pmo-priority-direct"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Project category</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger data-testid="select-pmo-project-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transformation">Transformation</SelectItem>
                  <SelectItem value="enhancement">Enhancement</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="innovation">Innovation</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Workspace path</Label>
              <Select value={workspacePath} onValueChange={(value: 'standard' | 'accelerator') => setWorkspacePath(value)}>
                <SelectTrigger data-testid="select-pmo-workspace-path"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard delivery</SelectItem>
                  <SelectItem value="accelerator">Accelerator path</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Industry type</Label>
              <Select value={industryType} onValueChange={setIndustryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="semi-government">Semi-Government</SelectItem>
                  <SelectItem value="private-sector">Private Sector</SelectItem>
                  <SelectItem value="public-private-partnership">Public-Private Partnership</SelectItem>
                  <SelectItem value="non-profit">Non-Profit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-project-manager-direct">Project manager</Label>
              <Input id="pmo-project-manager-direct" value={projectManager} onChange={(e) => setProjectManager(e.target.value)} placeholder="Assign PM" data-testid="input-pmo-project-manager" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmo-estimated-budget-direct">Approved budget</Label>
              <Input id="pmo-estimated-budget-direct" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="AED 0" data-testid="input-pmo-estimated-budget" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-target-date-direct">Target completion date</Label>
              <Input id="pmo-target-date-direct" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} data-testid="input-pmo-target-date" />
            </div>
          </div>

          <div className="space-y-1 border-t pt-2">
            <h4 className="text-sm font-semibold text-foreground">Organization & Requestor</h4>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-org-name-direct">Organization name <span className="text-destructive">*</span></Label>
              <Input id="pmo-org-name-direct" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="e.g. Abu Dhabi Digital Authority" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmo-dept-direct">Department <span className="text-destructive">*</span></Label>
              <Input id="pmo-dept-direct" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Digital Transformation" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-requestor-name-direct">Requestor name <span className="text-destructive">*</span></Label>
              <Input id="pmo-requestor-name-direct" value={requestorName} onChange={(e) => setRequestorName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmo-requestor-email-direct">Requestor email <span className="text-destructive">*</span></Label>
              <Input id="pmo-requestor-email-direct" type="email" value={requestorEmail} onChange={(e) => setRequestorEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1 border-t pt-2">
            <h4 className="text-sm font-semibold text-foreground">Business Context</h4>
            <p className="text-xs text-muted-foreground">This information feeds into AI-generated documents such as business case and requirements artifacts.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmo-strategic-objective-direct">Business objective <span className="text-destructive">*</span></Label>
            <Textarea id="pmo-strategic-objective-direct" value={strategicObjective} onChange={(e) => { setStrategicObjective(e.target.value); setAiFieldsGenerated(false); }} className="h-20" placeholder="What is the primary business objective this project aims to achieve?" data-testid="textarea-pmo-strategic-objective" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              disabled={!strategicObjective.trim() || strategicObjective.trim().length < 10 || aiAssistMutation.isPending}
              onClick={() => aiAssistMutation.mutate(strategicObjective.trim())}
            >
              {aiAssistMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
              {(() => {
                if (aiAssistMutation.isPending) return 'Generating...';
                return aiFieldsGenerated ? 'Regenerate with AI' : 'Auto-fill with AI';
              })()}
            </Button>
            {aiAssistMutation.isError && (
              <p className="text-xs text-destructive">AI generation failed. You can fill fields manually.</p>
            )}
          </div>

          {aiAssistMutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              COREVIA AI is analyzing your business objective and generating field suggestions...
            </div>
          )}

          {aiFieldsGenerated && !aiAssistMutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Sparkles className="h-4 w-4" />
              AI suggestions applied to empty fields below. Review and edit as needed.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pmo-challenges-direct">Current challenges</Label>
            <Textarea id="pmo-challenges-direct" value={currentChallenges} onChange={(e) => setCurrentChallenges(e.target.value)} className="h-20" placeholder="What problems or pain points does the organization currently face?" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmo-outcomes-direct">Expected outcomes</Label>
            <Textarea id="pmo-outcomes-direct" value={expectedOutcomes} onChange={(e) => setExpectedOutcomes(e.target.value)} className="h-20" placeholder="What measurable outcomes are expected from this project?" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmo-criteria-direct">Success criteria</Label>
            <Textarea id="pmo-criteria-direct" value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)} className="h-20" placeholder="How will success be measured?" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmo-stakeholders-direct">Key stakeholders</Label>
              <Input id="pmo-stakeholders-direct" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} placeholder="e.g. CTO, CFO, Department Heads" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmo-risks-direct">Risk factors</Label>
              <Input id="pmo-risks-direct" value={riskFactors} onChange={(e) => setRiskFactors(e.target.value)} placeholder="Key risks to flag" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data classification</Label>
              <Select value={dataClassification} onValueChange={setDataClassification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="confidential">Confidential</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('pmo.office.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm({
                creationMode,
                demandReportId: creationMode === 'conversion' ? selectedItem?.id : undefined,
                projectName: projectName || selectedItem?.suggestedProjectName || selectedItem?.businessObjective || 'Project',
                priority,
                projectType,
                projectManager,
                estimatedBudget,
                targetDate,
                strategicObjective,
                workspacePath,
                organizationName,
                department,
                requestorName,
                requestorEmail,
                industryType,
                currentChallenges,
                expectedOutcomes,
                successCriteria,
                stakeholders,
                riskFactors,
                dataClassification,
              });
            }}
            disabled={isPending || (creationMode === 'conversion' && !selectedItem) || !projectName.trim() || (creationMode === 'direct' && (!organizationName.trim() || !department.trim() || !requestorName.trim() || !requestorEmail.trim() || !strategicObjective.trim()))}
            className="gap-2"
            data-testid="button-submit-pmo-project"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {creationMode === 'conversion' ? 'Submit for PMO approval' : 'Create project now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
