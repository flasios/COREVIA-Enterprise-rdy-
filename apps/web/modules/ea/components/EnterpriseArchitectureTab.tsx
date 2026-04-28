import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReportAccess } from "@/hooks/useReportAccess";
import { useAuth } from "@/contexts/AuthContext";
import {
  CreateVersionDialog,
  VersionCollaborationIndicator,
  VersionDiffViewer,
  VersionRestoreDialog,
  VersionDetailView,
} from "@/components/shared/versioning";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Edit,
  X,
  GitBranch,
  Send,
  Landmark,
  Network,
  Database,
  Layers,
  Shield,
  Gauge,
  History,
  CheckCircle,
  Lock as LockIcon,
  Plus,
  Trash2,
  Sparkles,
  Lightbulb,
  Eye,
  Target,
  PanelLeftClose,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EnterpriseArchitectureArtifactSchema,
  type EnterpriseArchitectureArtifact,
  normalizeEnterpriseArchitectureArtifact,
  recalculateEnterpriseArchitectureDashboard,
} from "@shared/contracts/enterprise-architecture";
import type { ReportVersion } from "@shared/schema";
import {
  SpineDecisionBanner,
  SpineTraceabilityStrip,
  SpineExplainableScores,
  SpineEntityCards,
  SpineTraceabilityPanel,
  SpineWhatIfSimulator,
} from "./EaSpineOverlay";
import {
  EnterpriseArchitectureAdvisorSheet,
  EnterpriseArchitectureVersionSheet,
  type EaExternalAdvisorResponse,
} from "./EnterpriseArchitectureSheets";

interface EnterpriseArchitectureTabProps {
  reportId: string;
  canAccess?: boolean;
  businessCaseApproved?: boolean;
  requirementsApproved?: boolean;
  isFullscreen?: boolean;
}

interface EaResponse {
  success?: boolean;
  data?: EnterpriseArchitectureArtifact;
}

interface EaExternalAdvisorQueryResponse {
  success?: boolean;
  data?: EaExternalAdvisorResponse | null;
}

type CapabilityDomain = EnterpriseArchitectureArtifact["businessArchitecture"]["capabilityDomains"][number];
type AppDomain = EnterpriseArchitectureArtifact["applicationArchitecture"]["impactedApplications"][number];
type IntegrationDependency = EnterpriseArchitectureArtifact["applicationArchitecture"]["integrationDependencies"][number];
type _DataDomain = EnterpriseArchitectureArtifact["dataArchitecture"]["dataDomains"][number];

const impactLevels = ["low", "medium", "high", "critical"] as const;
const appLifecycles = ["active", "legacy", "replace"] as const;
const dataClasses = ["public", "internal", "confidential", "restricted"] as const;
const EA_TABLE_CLASS = "rounded-lg border bg-background/80 shadow-sm [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-muted/90 [&_tbody_tr:nth-child(even)]:bg-muted/15";
const CHART_AXIS_COLOR = "hsl(var(--muted-foreground))";
const CHART_GRID_COLOR = "hsl(var(--border))";
const CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
};

type ImpactLevel = (typeof impactLevels)[number];
type AppLifecycle = (typeof appLifecycles)[number];
type DataClass = (typeof dataClasses)[number];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function toLines(value: string[]): string {
  return value.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeImpact(value: string): ImpactLevel {
  return impactLevels.includes(value as ImpactLevel) ? (value as ImpactLevel) : "medium";
}

function safeLifecycle(value: string): AppLifecycle {
  return appLifecycles.includes(value as AppLifecycle) ? (value as AppLifecycle) : "active";
}

function safeDataClass(value: string): DataClass {
  return dataClasses.includes(value as DataClass) ? (value as DataClass) : "internal";
}

function scoreClass(score: number): string {
  if (score >= 70) return "bg-emerald-500/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-200";
  if (score >= 45) return "bg-amber-400/30 border-amber-500/40 text-amber-900 dark:text-amber-200";
  return "bg-rose-500/30 border-rose-500/40 text-rose-900 dark:text-rose-200";
}

function impactBadgeClass(level: ImpactLevel): string {
  if (level === "critical") return "bg-rose-500/20 text-rose-900 border-rose-400/40 dark:text-rose-200";
  if (level === "high") return "bg-amber-500/20 text-amber-900 border-amber-400/40 dark:text-amber-200";
  if (level === "medium") return "bg-sky-500/20 text-sky-900 border-sky-400/40 dark:text-sky-200";
  return "bg-emerald-500/20 text-emerald-900 border-emerald-400/40 dark:text-emerald-200";
}

function lifecycleBadgeClass(level: AppLifecycle): string {
  if (level === "legacy") return "bg-rose-500/20 text-rose-900 border-rose-400/40 dark:text-rose-200";
  if (level === "replace") return "bg-amber-500/20 text-amber-900 border-amber-400/40 dark:text-amber-200";
  return "bg-emerald-500/20 text-emerald-900 border-emerald-400/40 dark:text-emerald-200";
}

function dataClassBadgeClass(level: DataClass): string {
  if (level === "restricted") return "bg-rose-500/20 text-rose-900 border-rose-400/40 dark:text-rose-200";
  if (level === "confidential") return "bg-amber-500/20 text-amber-900 border-amber-400/40 dark:text-amber-200";
  if (level === "internal") return "bg-sky-500/20 text-sky-900 border-sky-400/40 dark:text-sky-200";
  return "bg-emerald-500/20 text-emerald-900 border-emerald-400/40 dark:text-emerald-200";
}

function riskBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "critical") return "destructive";
  if (level === "high") return "secondary";
  if (level === "medium") return "outline";
  return "default";
}

function compactLabel(value: string, maxLength = 34): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "N/A";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

function normalizeText(value: string | undefined | null): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function filterObjectEntries<T>(values: T[] | undefined | null): T[] {
  return Array.isArray(values) ? values.filter((value): value is T => isObjectRecord(value)) : [];
}

function _splitGraphLabel(value: string, maxLineLength = 26): string[] {
  const normalized = normalizeText(value) || "Unnamed";
  if (normalized.length <= maxLineLength) return [normalized];

  const words = normalized.split(" ");
  const first: string[] = [];
  const second: string[] = [];
  let firstLen = 0;

  for (const word of words) {
    if (firstLen + word.length + (first.length ? 1 : 0) <= maxLineLength) {
      first.push(word);
      firstLen += word.length + (first.length > 1 ? 1 : 0);
    } else {
      second.push(word);
    }
  }

  const firstLine = first.join(" ") || normalized.slice(0, maxLineLength);
  const secondRaw = second.join(" ") || normalized.slice(maxLineLength);
  const secondLine = secondRaw.length > maxLineLength ? `${secondRaw.slice(0, Math.max(1, maxLineLength - 1))}…` : secondRaw;
  return secondLine ? [firstLine, secondLine] : [firstLine];
}

function parseNumeric(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clampScore(parsed);
}


function cloneArtifact(value: EnterpriseArchitectureArtifact): EnterpriseArchitectureArtifact {
  return JSON.parse(JSON.stringify(value)) as EnterpriseArchitectureArtifact;
}

function normalizeArtifact(value: unknown): EnterpriseArchitectureArtifact {
  return normalizeEnterpriseArchitectureArtifact(value);
}

function hydrateMissingGeneratedFields(value: EnterpriseArchitectureArtifact): EnterpriseArchitectureArtifact {
  const next = cloneArtifact(value);

  next.businessArchitecture.capabilityDomains = filterObjectEntries(next.businessArchitecture.capabilityDomains).map((domain, index) => ({
    ...domain,
    name: normalizeText(domain.name) || `Capability Domain ${index + 1}`,
    subCapabilities: Array.isArray(domain.subCapabilities)
      ? domain.subCapabilities.map((item, itemIndex) => normalizeText(item) || `Sub-capability ${itemIndex + 1}`).filter(Boolean)
      : [],
  }));

  next.businessArchitecture.valueStreams = filterObjectEntries(next.businessArchitecture.valueStreams).map((stream, index) => ({
    ...stream,
    name: normalizeText(stream.name) || `Value Stream ${index + 1}`,
    impactLevel: safeImpact(stream.impactLevel),
  }));

  next.applicationArchitecture.impactedApplications = filterObjectEntries(next.applicationArchitecture.impactedApplications).map((app, index) => ({
    ...app,
    name: normalizeText(app.name) || `Application ${index + 1}`,
    criticality: safeImpact(app.criticality),
    impactLevel: safeImpact(app.impactLevel),
    lifecycle: safeLifecycle(app.lifecycle),
  }));

  const appNames = next.applicationArchitecture.impactedApplications.map((app) => app.name);

  next.applicationArchitecture.integrationDependencies = filterObjectEntries(next.applicationArchitecture.integrationDependencies).map((dep, index) => {
    const sourceFallback = appNames[index % Math.max(1, appNames.length)] || `Application ${index + 1}`;
    const targetFallback = appNames[(index + 1) % Math.max(1, appNames.length)] || `Application ${index + 2}`;
    return {
      ...dep,
      source: normalizeText(dep.source) || sourceFallback,
      target: normalizeText(dep.target) || targetFallback,
      apiCount: Number.isFinite(dep.apiCount) && dep.apiCount > 0 ? Math.round(dep.apiCount) : 1,
      complexityScore: clampScore(dep.complexityScore),
    };
  });

  if (next.applicationArchitecture.newSystemRequirements.length === 0) {
    next.applicationArchitecture.newSystemRequirements = [
      "Define integration contracts from approved business case and requirements.",
    ];
  }

  next.applicationArchitecture.newSystemRequirements = (Array.isArray(next.applicationArchitecture.newSystemRequirements)
    ? next.applicationArchitecture.newSystemRequirements
    : []).map((item, index) => (
    normalizeText(item) || `System requirement ${index + 1}`
  ));

  next.dataArchitecture.dataDomains = filterObjectEntries(next.dataArchitecture.dataDomains).map((domain, index) => ({
    ...domain,
    name: normalizeText(domain.name) || `Data Domain ${index + 1}`,
    classification: safeDataClass(domain.classification),
    sensitivityScore: clampScore(domain.sensitivityScore),
    piiExposureRisk: clampScore(domain.piiExposureRisk),
    crossBorderRisk: clampScore(domain.crossBorderRisk),
  }));

  next.dataArchitecture.retentionPolicyTriggers = (Array.isArray(next.dataArchitecture.retentionPolicyTriggers)
    ? next.dataArchitecture.retentionPolicyTriggers
    : [])
    .map((trigger) => normalizeText(trigger))
    .filter(Boolean);

  const hasScopedRetention = next.dataArchitecture.retentionPolicyTriggers.some((trigger) => {
    const separatorIndex = trigger.indexOf(":");
    if (separatorIndex <= 0) return false;
    const prefix = trigger.slice(0, separatorIndex).trim().toLowerCase();
    return next.dataArchitecture.dataDomains.some((domain) => normalizeText(domain.name).toLowerCase() === prefix);
  });

  if (!hasScopedRetention && next.dataArchitecture.retentionPolicyTriggers.length > 0 && next.dataArchitecture.dataDomains.length > 0) {
    next.dataArchitecture.retentionPolicyTriggers = next.dataArchitecture.retentionPolicyTriggers.map((trigger, index) => {
      const domain = next.dataArchitecture.dataDomains[index % next.dataArchitecture.dataDomains.length]!;
      return `${domain.name}: ${trigger}`;
    });
  }

  if (next.dataArchitecture.retentionPolicyTriggers.length === 0 && next.dataArchitecture.dataDomains.length > 0) {
    next.dataArchitecture.retentionPolicyTriggers = next.dataArchitecture.dataDomains.map(
      (domain) => `${domain.name}: Retain per approved legal and policy controls`
    );
  }

  next.dataArchitecture.governanceActions = (Array.isArray(next.dataArchitecture.governanceActions)
    ? next.dataArchitecture.governanceActions
    : [])
    .map((item, index) => normalizeText(item) || `Data governance action ${index + 1}`);
  next.dataArchitecture.dataFlowNotes = (Array.isArray(next.dataArchitecture.dataFlowNotes)
    ? next.dataArchitecture.dataFlowNotes
    : [])
    .map((item, index) => normalizeText(item) || `Data flow note ${index + 1}`);

  return next;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("404:");
}

async function requestEaWithFallback(
  method: "GET" | "POST" | "PATCH",
  reportId: string,
  action: "" | "/generate",
  body?: unknown
): Promise<Response> {
  const primaryUrl = `/api/demand-reports/${reportId}/ea${action}`;
  const fallbackUrl = `/api/ea/${reportId}${action}`;

  try {
    return await apiRequest(method, primaryUrl, body);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  try {
    return await apiRequest(method, fallbackUrl, body);
  } catch (fallbackError) {
    if (isNotFoundError(fallbackError)) {
      throw new Error(
        "EA API route is not mounted on the running backend. Restart backend and retry."
      );
    }
    throw fallbackError;
  }
}

function KpiTile({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <Card className="border-muted/40">
      <CardContent className="p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}

function SingleColumnTableEditor({
  label,
  values,
  disabled,
  itemName,
  onChange,
}: {
  label: string;
  values: string[];
  disabled: boolean;
  itemName: string;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const qualityClass = (value: string) => {
    const length = value.trim().length;
    if (length >= 100) return "bg-emerald-500/20 text-emerald-900 border-emerald-400/40 dark:text-emerald-200";
    if (length >= 45) return "bg-sky-500/20 text-sky-900 border-sky-400/40 dark:text-sky-200";
    return "bg-amber-500/20 text-amber-900 border-amber-400/40 dark:text-amber-200";
  };

  const qualityLabel = (value: string) => {
    const length = value.trim().length;
    if (length >= 100) return t('ea.architectureTab.detailed');
    if (length >= 45) return t('ea.architectureTab.standard');
    return t('ea.architectureTab.brief');
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Table className={EA_TABLE_CLASS}>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead>{t('ea.architectureTab.statement')}</TableHead>
            <TableHead className="w-28 text-center">{t('ea.architectureTab.quality')}</TableHead>
            <TableHead className="w-14" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {values.map((value, index) => (
            <TableRow key={`${itemName}-${index}`} className="hover:bg-muted/20">
              <TableCell className="p-2 text-center text-xs font-semibold text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="p-2">
                {disabled ? (
                  <p className="text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">{value || "—"}</p>
                ) : (
                  <Textarea
                    className="bg-background text-foreground"
                    disabled={disabled}
                    rows={2}
                    value={value}
                    onChange={(event) => {
                      const next = [...values];
                      next[index] = event.target.value;
                      onChange(next);
                    }}
                  />
                )}
              </TableCell>
              <TableCell className="p-2 text-center">
                <Badge variant="outline" className={qualityClass(value)}>{qualityLabel(value)}</Badge>
              </TableCell>
              <TableCell className="p-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || values.length <= 1}
                  onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...values, `${itemName} ${values.length + 1}`])}
        >
          <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addRow')}
        </Button>
      </div>
    </div>
  );
}

export default function EnterpriseArchitectureTab({
  reportId,
  canAccess = true,
  businessCaseApproved = false,
  requirementsApproved = false,
  isFullscreen = false,
}: EnterpriseArchitectureTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { canGenerateEnterpriseArchitecture } = useReportAccess();
  const [draft, setDraft] = useState<EnterpriseArchitectureArtifact | null>(null);
  const [editBaseline, setEditBaseline] = useState<EnterpriseArchitectureArtifact | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("business");
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [comparisonVersions, setComparisonVersions] = useState<{ versionA: ReportVersion | null; versionB: ReportVersion | null }>({
    versionA: null,
    versionB: null,
  });
  const [showVersionDetail, setShowVersionDetail] = useState(false);
  const [selectedVersionForDetail, setSelectedVersionForDetail] = useState<ReportVersion | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<ReportVersion | null>(null);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [isVersionLockedForRestore, setIsVersionLockedForRestore] = useState(false);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [showIntelligenceRail, setShowIntelligenceRail] = useState(false);
  const [showAdvisorDetailsPanel, setShowAdvisorDetailsPanel] = useState(false);
  const [isGeneratingAdvisor, setIsGeneratingAdvisor] = useState(false);
  const [advisorData, setAdvisorData] = useState<EaExternalAdvisorResponse | null>(null);

  const prerequisitesMet = businessCaseApproved && requirementsApproved;

  const { data: eaData, isLoading, refetch } = useQuery<EaResponse>({
    queryKey: ["/api/ea", reportId],
    queryFn: async () => {
      const response = await requestEaWithFallback("GET", reportId, "");
      return response.json();
    },
    retry: false,
    enabled: !!reportId && canAccess && prerequisitesMet,
  });

  useEffect(() => {
    if (!isDirty && !isEditMode && eaData?.success && eaData.data) {
      setDraft(hydrateMissingGeneratedFields(normalizeArtifact(eaData.data)));
    }
    if (!isDirty && !isEditMode && eaData && !eaData.success) {
      setDraft(null);
    }
  }, [eaData, isDirty, isEditMode]);

  const { data: versionsData, refetch: refetchVersions } = useQuery<{ data: ReportVersion[] }>({
    queryKey: ["/api/demand-reports", reportId, "versions"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}/versions`);
      return response.json();
    },
    enabled: !!reportId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: latestExternalAdvisorData } = useQuery<EaExternalAdvisorQueryResponse>({
    queryKey: ["/api/ai-assistant/ea-external-advisor/latest", reportId],
    queryFn: async () => {
      if (!reportId) return { success: true, data: null };
      const response = await apiRequest("GET", `/api/ai-assistant/ea-external-advisor/latest/${reportId}`);
      return response.json();
    },
    enabled: !!reportId && canAccess,
    staleTime: 30000,
  });

  useEffect(() => {
    if (latestExternalAdvisorData?.success && latestExternalAdvisorData.data) {
      setAdvisorData(latestExternalAdvisorData.data);
    }
  }, [latestExternalAdvisorData]);

  const enterpriseVersions = useMemo(
    () =>
      (versionsData?.data ?? [])
        .filter((version) => version.versionType === "enterprise_architecture" || version.versionType === "both")
        .sort((a, b) => {
          if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion;
          if (a.minorVersion !== b.minorVersion) return b.minorVersion - a.minorVersion;
          if (a.patchVersion !== b.patchVersion) return b.patchVersion - a.patchVersion;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    [versionsData?.data]
  );

  const latestVersion = enterpriseVersions[0] ?? null;
  const isLocked = latestVersion?.status === "manager_approval" || latestVersion?.status === "published";
  const currentVersionLabel = latestVersion?.versionNumber != null
    ? String(latestVersion.versionNumber).trim()
    : '0';
  const displayVersionLabel = /^v/i.test(currentVersionLabel)
    ? currentVersionLabel
    : `v${currentVersionLabel}`;
  const eaRailCardClass = "overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_18px_45px_-38px_rgba(15,23,42,0.55)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]";
  const eaRailHeaderClass = "border-b border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/30";
  const eaRailBodyClass = "space-y-3 p-3";
  const eaRailInsetClass = "rounded-xl border border-slate-200/70 bg-white/80 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50";

  const submitForReview = useMutation({
    mutationFn: async () => {
      if (!latestVersion) throw new Error("No EA version found");
      if (!currentUser) throw new Error("User not authenticated");
      return apiRequest("POST", `/api/versions/${latestVersion.id}/submit-review`, {
        submittedBy: currentUser.id,
        submittedByName: currentUser.displayName,
        submittedByRole: currentUser.role,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await refetchVersions();
      toast({ title: t('ea.architectureTab.toastSubmittedForReview'), description: t('ea.architectureTab.toastSubmittedForReviewDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastSubmitFailed'), description: error.message, variant: "destructive" });
    },
  });

  const approveVersion = useMutation({
    mutationFn: async () => {
      if (!latestVersion) throw new Error("No EA version found");
      if (!currentUser) throw new Error("User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestVersion.id}/approve`, {
        approvedBy: currentUser.id,
        approvedByName: currentUser.displayName,
        approvedByRole: currentUser.role,
        approvalComments: "EA initial approval",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await refetchVersions();
      toast({ title: t('ea.architectureTab.toastInitialApproval'), description: t('ea.architectureTab.toastInitialApprovalDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastApprovalFailed'), description: error.message, variant: "destructive" });
    },
  });

  const sendToDirector = useMutation({
    mutationFn: async () => {
      if (!latestVersion) throw new Error("No EA version found");
      if (!currentUser) throw new Error("User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestVersion.id}/send-to-manager`, {
        message: "Enterprise Architecture ready for final approval",
        sentBy: currentUser.id,
        sentByName: currentUser.displayName,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await refetchVersions();
      toast({ title: t('ea.architectureTab.toastSentForDirector'), description: t('ea.architectureTab.toastSentForDirectorDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastSendFailed'), description: error.message, variant: "destructive" });
    },
  });

  const finalApprove = useMutation({
    mutationFn: async () => {
      if (!latestVersion) throw new Error("No EA version found");
      if (!currentUser) throw new Error("User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestVersion.id}/approve`, {
        approvedBy: currentUser.id,
        approvedByName: currentUser.displayName,
        approvedByRole: currentUser.role,
        approvalComments: "EA final approval",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await refetchVersions();
      toast({ title: t('ea.architectureTab.toastFinalApproval'), description: t('ea.architectureTab.toastFinalApprovalDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastFinalApprovalFailed'), description: error.message, variant: "destructive" });
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("No EA data available");
      if (!currentUser) throw new Error("User not authenticated");
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/versions`, {
        versionType: "minor",
        contentType: "enterprise_architecture",
        changesSummary: "New draft version created from approved EA",
        skipAiSummary: true,
        editReason: "Creating new EA draft from locked version",
        createdBy: currentUser.id,
        createdByName: currentUser.displayName,
        createdByRole: currentUser.role,
        editedContent: draft,
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await refetchVersions();
      if (draft) {
        setIsEditMode(true);
        setIsDirty(false);
        setEditBaseline(cloneArtifact(draft));
        setChangedFields(new Set());
      }
      toast({ title: t('ea.architectureTab.toastNewDraftCreated'), description: t('ea.architectureTab.toastNewDraftCreatedDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastCreationFailed'), description: error.message, variant: "destructive" });
    },
  });

  const confirmRestoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${versionId}/restore`, {});
      return response.json();
    },
    onSuccess: async (_result, versionId) => {
      const restored = enterpriseVersions.find((version) => version.id === versionId);
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/ea", reportId] });
      setShowRestoreDialog(false);
      setSelectedVersionForRestore(null);
      setConflictWarnings([]);
      setIsVersionLockedForRestore(false);
      toast({
        title: t('ea.architectureTab.toastVersionRestored'),
        description: restored ? t('ea.architectureTab.toastVersionRestoredDesc', { version: restored.versionNumber }) : t('ea.architectureTab.toastVersionRestoredDefault'),
      });
    },
    onError: (error: Error) => {
      toast({ title: t('ea.architectureTab.toastRestoreFailed'), description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await requestEaWithFallback("POST", reportId, "/generate");
      return response.json();
    },
    onSuccess: async (result) => {
      if (!result?.success) {
        throw new Error(result?.error || "Failed to generate enterprise architecture");
      }
      setDraft(hydrateMissingGeneratedFields(normalizeArtifact(result.data)));
      setIsDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/ea", reportId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"] });
      toast({
        title: t('ea.architectureTab.toastEaGenerated'),
        description: t('ea.architectureTab.toastEaGeneratedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('ea.architectureTab.toastGenerationFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-generate EA snapshot when prerequisites are met but no data exists yet.
  // Guard: never auto-trigger if eaData query returned successfully (even if draft
  // hasn't been hydrated yet by the sync effect), or if a published EA version
  // already exists (to prevent creating a new draft on top of an approved version).
  const autoGenerateTriggered = useRef(false);
  const hasPublishedEaVersion = useMemo(() => {
    return enterpriseVersions.some((v) => v.status === "published");
  }, [enterpriseVersions]);
  useEffect(() => {
    if (
      !autoGenerateTriggered.current &&
      !isLoading &&
      !draft &&
      !eaData?.success &&
      !hasPublishedEaVersion &&
      prerequisitesMet &&
      canAccess &&
      canGenerateEnterpriseArchitecture &&
      !generateMutation.isPending
    ) {
      autoGenerateTriggered.current = true;
      generateMutation.mutate();
    }
  }, [isLoading, draft, eaData, hasPublishedEaVersion, prerequisitesMet, canAccess, canGenerateEnterpriseArchitecture, generateMutation.isPending, generateMutation]);

  const buildAnonymizedEaContext = (artifact: EnterpriseArchitectureArtifact) => {
    const avg = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));

    return {
      modelName: artifact.modelName,
      framework: artifact.framework,
      capabilityDomainCount: artifact.businessArchitecture.capabilityDomains.length,
      valueStreamCount: artifact.businessArchitecture.valueStreams.length,
      impactedApplicationCount: artifact.applicationArchitecture.impactedApplications.length,
      integrationDependencyCount: artifact.applicationArchitecture.integrationDependencies.length,
      integrationAverageComplexity: avg(artifact.applicationArchitecture.integrationDependencies.map((dep) => dep.complexityScore)),
      integrationAverageApiCount: avg(artifact.applicationArchitecture.integrationDependencies.map((dep) => dep.apiCount)),
      dataDomainCount: artifact.dataArchitecture.dataDomains.length,
      dataSensitivityAverage: avg(artifact.dataArchitecture.dataDomains.map((domain) => domain.sensitivityScore)),
      piiRiskAverage: avg(artifact.dataArchitecture.dataDomains.map((domain) => domain.piiExposureRisk)),
      crossBorderRiskAverage: avg(artifact.dataArchitecture.dataDomains.map((domain) => domain.crossBorderRisk)),
      cloudAlignmentScore: artifact.technologyArchitecture.cloudAlignmentScore,
      securityBaselineCompliance: artifact.technologyArchitecture.securityBaselineCompliance,
      devOpsCompatibility: artifact.technologyArchitecture.devOpsCompatibility,
      policyDeviationFlags: artifact.technologyArchitecture.policyDeviationFlags.length,
      riskSnapshot: {
        architectureComplexityScore: artifact.riskImpactDashboard.architectureComplexityScore,
        integrationRiskScore: artifact.riskImpactDashboard.integrationRiskScore,
        dataSensitivityRisk: artifact.riskImpactDashboard.dataSensitivityRisk,
        targetArchitectureAlignment: artifact.riskImpactDashboard.targetArchitectureAlignment,
        technicalDebtExposure: artifact.riskImpactDashboard.technicalDebtExposure,
        strategicMisalignmentRisk: artifact.riskImpactDashboard.strategicMisalignmentRisk,
      },
    };
  };

  const handleGenerateExternalAdvisor = async (
    focus: "ideation" | "alternatives" | "benchmarks" | "all",
  ) => {
    if (!draft) return;
    setIsGeneratingAdvisor(true);

    try {
      const response = await fetch("/api/ai-assistant/ea-external-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportId,
          focus,
          context: buildAnonymizedEaContext(draft),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to generate external advisory");
      }

      setAdvisorData(payload.data as EaExternalAdvisorResponse);
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/ea-external-advisor/latest", reportId] });
      setShowAdvisorDetailsPanel(true);
      toast({
        title: t('ea.architectureTab.toastAdvisoryReady'),
        description: t('ea.architectureTab.toastAdvisoryReadyDesc'),
      });
    } catch (error) {
      toast({
        title: t('ea.architectureTab.toastAdvisoryFailed'),
        description: error instanceof Error ? error.message : t('ea.architectureTab.unableToGenerateAdvisory'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAdvisor(false);
    }
  };

  const generatedAtLabel = useMemo(() => {
    if (!draft?.generatedAt) return t('ea.architectureTab.notGenerated');
    const date = new Date(draft.generatedAt);
    if (Number.isNaN(date.getTime())) return t('ea.architectureTab.notGenerated');
    return date.toLocaleString();
  }, [draft?.generatedAt, t]);

  const showMainGovernanceCard = isFullscreen;

  const renderEaStatusBadge = (status?: string | null) => {
    if (!status) return null;

    const classes =
      status === "published"
        ? "border-purple-300 text-purple-700 dark:text-purple-300"
        : status === "manager_approval" || status === "approved"
          ? "border-green-300 text-green-700 dark:text-green-300"
          : status === "under_review"
            ? "border-amber-300 text-amber-700 dark:text-amber-300"
            : "border-slate-300 text-slate-700 dark:text-slate-300";

    return (
      <Badge variant="outline" className={classes}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };


  const businessHeatmap = useMemo(() => {
    if (!draft) return { domains: [] as CapabilityDomain[], subCapabilities: [] as string[] };
    const domains = draft.businessArchitecture.capabilityDomains.slice(0, 8);
    const subCapabilities = Array.from(
      new Set(domains.flatMap((domain) => domain.subCapabilities))
    ).slice(0, 8);
    return { domains, subCapabilities };
  }, [draft]);

  const appNetwork = useMemo(() => {
    if (!draft) return { nodes: [] as Array<{ name: string; x: number; y: number; level: ImpactLevel; lifecycle: AppLifecycle }>, edges: [] as IntegrationDependency[] };
    const apps = draft.applicationArchitecture.impactedApplications.map((app, index) => ({
      ...app,
      name: normalizeText(app.name) || `Application ${index + 1}`,
      criticality: safeImpact(app.criticality),
      lifecycle: safeLifecycle(app.lifecycle),
    }));
    const appNames = apps.map((app) => app.name);
    const edges = draft.applicationArchitecture.integrationDependencies.map((edge, index) => ({
      ...edge,
      source: normalizeText(edge.source) || appNames[index % Math.max(1, appNames.length)] || `Application ${index + 1}`,
      target: normalizeText(edge.target) || appNames[(index + 1) % Math.max(1, appNames.length)] || `Application ${index + 2}`,
      apiCount: Number.isFinite(edge.apiCount) && edge.apiCount > 0 ? Math.round(edge.apiCount) : 1,
      complexityScore: clampScore(edge.complexityScore),
    }));
    const lanes: ImpactLevel[] = ["low", "medium", "high", "critical"];
    const laneX: Record<ImpactLevel, number> = {
      low: 110,
      medium: 280,
      high: 450,
      critical: 620,
    };

    const grouped = lanes.reduce((accumulator, lane) => {
      accumulator[lane] = apps.filter((app) => app.criticality === lane);
      return accumulator;
    }, { low: [] as AppDomain[], medium: [] as AppDomain[], high: [] as AppDomain[], critical: [] as AppDomain[] });

    const nodes = lanes.flatMap((lane) => {
      const items = grouped[lane];
      const spacing = 52;
      const startY = Math.max(68, 170 - ((items.length - 1) * spacing) / 2);
      return items.map((app, index) => ({
        name: app.name,
        x: laneX[lane],
        y: startY + index * spacing,
        level: app.criticality,
        lifecycle: app.lifecycle,
      }));
    });

    return { nodes, edges };
  }, [draft]);

  function updateDraft(
    updater: (current: EnterpriseArchitectureArtifact) => EnterpriseArchitectureArtifact,
    options?: { recalculate?: boolean; field?: string }
  ) {
    if (!isEditMode || isLocked) return;

    setDraft((current) => {
      const baseline = current ? cloneArtifact(current) : normalizeArtifact(undefined);
      const updated = updater(baseline);
      const parsed = EnterpriseArchitectureArtifactSchema.parse(updated);
      const next = options?.recalculate === false ? parsed : recalculateEnterpriseArchitectureDashboard(parsed);
      setIsDirty(true);
      setChangedFields((previous) => {
        const updatedFields = new Set(previous);
        updatedFields.add(options?.field || `ea.${activeTab}`);
        return updatedFields;
      });
      return next;
    });
  }

  const generateChangesSummary = (): string => {
    const fieldCount = changedFields.size;
    if (!fieldCount) return t('ea.architectureTab.refinementUpdate');
    return t('ea.architectureTab.updatedFields', { count: fieldCount });
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      const shouldCancel = window.confirm(t('ea.architectureTab.confirmDiscardChanges'));
      if (!shouldCancel) return;
      setDraft(editBaseline ? cloneArtifact(editBaseline) : draft);
      setIsEditMode(false);
      setIsDirty(false);
      setChangedFields(new Set());
      setEditBaseline(null);
      return;
    }

    if (!draft) return;
    if (isLocked) {
      toast({
        title: t('ea.architectureTab.toastEaLocked'),
        description: t('ea.architectureTab.toastEaLockedDesc'),
        variant: "destructive",
      });
      return;
    }

    setEditBaseline(cloneArtifact(draft));
    setIsEditMode(true);
    setIsDirty(false);
    setChangedFields(new Set());
  };

  const handleCreateNewVersion = () => {
    if (!draft) {
      toast({ title: t('ea.architectureTab.toastNoEaData'), description: t('ea.architectureTab.toastNoEaDataDesc'), variant: "destructive" });
      return;
    }
    createVersionMutation.mutate();
  };

  const handleCompareVersions = (versionId1: string, versionId2: string) => {
    const versionA = enterpriseVersions.find((version) => version.id === versionId1) || null;
    const versionB = enterpriseVersions.find((version) => version.id === versionId2) || null;
    if (!versionA || !versionB) return;
    setComparisonVersions({ versionA, versionB });
    setShowVersionComparison(true);
  };

  const handleViewVersion = (versionId: string) => {
    const version = enterpriseVersions.find((item) => item.id === versionId);
    if (!version) return;
    setSelectedVersionForDetail(version);
    setShowVersionDetail(true);
  };

  const handleRestoreVersion = (versionId: string) => {
    const version = enterpriseVersions.find((item) => item.id === versionId);
    if (!version) return;

    const warnings: string[] = [];
    if (isEditMode && isDirty) {
      warnings.push(t('ea.architectureTab.unsavedEditsWarning'));
    }
    const locked = false;

    setSelectedVersionForRestore(version);
    setConflictWarnings(warnings);
    setIsVersionLockedForRestore(locked);
    setShowRestoreDialog(true);
  };

  const movedHeaderContent = (
    <>
      <Card className="border border-border/60 bg-card/95 shadow-sm" data-testid="ea-report-identity-moved">
        <CardHeader className="p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{t('ea.architectureTab.enterpriseArchitecture')}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {t('ea.architectureTab.versionAlignedWorkspace', { generatedAt: generatedAtLabel })}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden border border-border/60 bg-card/95 shadow-sm" data-testid="ea-actions-moved">
        <CardHeader className="p-2.5">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-2.5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20">
                  <Landmark className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Architecture governance and actions</h3>
                    {isEditMode && (
                      <Badge variant="outline" className="h-5 border-sky-400/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300">
                        <Edit className="mr-1 h-3 w-3" />
                        {t('ea.architectureTab.edit')}
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <LockIcon className="mr-1 h-3 w-3" />
                        {t('ea.architectureTab.viewOnly')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">Review, govern, and version enterprise architecture from one compact workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Version</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex h-7 min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                      {displayVersionLabel}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-50">{latestVersion ? String(latestVersion.status).replace(/_/g, ' ') : 'No version'}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Mode</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-900 dark:text-slate-50">
                    {isLocked ? (
                      <>
                        <LockIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{t('ea.architectureTab.viewOnly')}</span>
                      </>
                    ) : isEditMode ? (
                      <>
                        <Edit className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                        <span className="truncate">Editing</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate">Ready</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {latestVersion && (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <VersionCollaborationIndicator
                    versionId={latestVersion.id}
                    reportId={reportId}
                    compact
                  />
                </div>
              )}

              {!isEditMode ? (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Action Dock</p>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">Primary decisions first.</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionSheet(true)}
                    className="h-8 w-full justify-between rounded-lg border-slate-300/80 bg-white/80 px-2.5 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                    data-testid="button-toggle-versions-ea-moved"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <History className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t('ea.architectureTab.versionHistory')}</span>
                    </span>
                  </Button>

                  <div className="mt-2 grid gap-2">
                    {latestVersion?.status === "draft" && (
                      <Button
                        onClick={() => submitForReview.mutate()}
                        disabled={submitForReview.isPending}
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700"
                        data-testid="button-submit-review-ea-moved"
                      >
                        {submitForReview.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        {t('ea.architectureTab.submitForReview')}
                      </Button>
                    )}

                    {latestVersion?.status === "under_review" && (
                      <Button
                        onClick={() => approveVersion.mutate()}
                        disabled={approveVersion.isPending}
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                        data-testid="button-approve-ea-moved"
                      >
                        {approveVersion.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        {t('ea.architectureTab.initialApproval')}
                      </Button>
                    )}

                    {latestVersion?.status === "approved" && (
                      <Button
                        onClick={() => sendToDirector.mutate()}
                        disabled={sendToDirector.isPending}
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700"
                        data-testid="button-send-director-ea-moved"
                      >
                        {sendToDirector.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        {t('ea.architectureTab.submitForDirector')}
                      </Button>
                    )}

                    {latestVersion?.status === "manager_approval" && (
                      <Button
                        onClick={() => finalApprove.mutate()}
                        disabled={finalApprove.isPending}
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700"
                        data-testid="button-final-approve-ea-moved"
                      >
                        {finalApprove.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        {t('ea.architectureTab.finalApproval')}
                      </Button>
                    )}

                    {isLocked ? (
                      <>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-600/70 dark:bg-slate-900/60 dark:text-slate-300">
                          <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t('ea.architectureTab.viewOnly')}</span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleCreateNewVersion}
                          disabled={createVersionMutation.isPending}
                          size="sm"
                          className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                          data-testid="button-create-new-ea-version-moved"
                        >
                          {createVersionMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <GitBranch className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                          {t('ea.architectureTab.newVersion')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleEditToggle}
                        size="sm"
                        variant="outline"
                        className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                        data-testid="button-edit-ea-moved"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        {t('ea.architectureTab.edit')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-sky-300/50 bg-sky-50/80 p-2.5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Edit Session</p>
                  <p className="mt-1 text-[11px] text-sky-900 dark:text-slate-50">Validate, then save as a tracked version.</p>
                  <div className="mt-2 grid gap-2">
                    <Button
                      onClick={() => {
                        if (!isDirty) {
                          toast({ title: t('ea.architectureTab.toastNoChanges'), description: t('ea.architectureTab.toastNoChangesDesc') });
                          return;
                        }
                        setShowVersionDialog(true);
                      }}
                      disabled={!isDirty}
                      size="sm"
                      className="h-8 justify-start rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white hover:bg-sky-700"
                      data-testid="button-save-exit-ea-moved"
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {t('ea.architectureTab.saveAndExit')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleEditToggle}
                      size="sm"
                      className="h-8 justify-start rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                      data-testid="button-cancel-edit-ea-moved"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      {t('ea.architectureTab.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );

  if (!canAccess || !prerequisitesMet) {
    return (
      <div className="flex items-center justify-center min-h-[520px] p-6" data-testid="ea-locked">
        <Card className="max-w-2xl">
          <CardContent className="p-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t('ea.architectureTab.eaLocked')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('ea.architectureTab.publishPrerequisites')}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className={`flex items-start gap-3 p-3 rounded-lg ${businessCaseApproved ? "bg-green-50 dark:bg-green-950/20" : "bg-orange-50 dark:bg-orange-950/20"}`}>
                {businessCaseApproved ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-orange-600" />}
                <div>
                  <p className="font-medium">{t('ea.architectureTab.businessCase')}</p>
                  <p className="text-sm text-muted-foreground">{businessCaseApproved ? t('ea.architectureTab.published') : t('ea.architectureTab.publishBusinessCaseFirst')}</p>
                </div>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg ${requirementsApproved ? "bg-green-50 dark:bg-green-950/20" : "bg-orange-50 dark:bg-orange-950/20"}`}>
                {requirementsApproved ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-orange-600" />}
                <div>
                  <p className="font-medium">{t('ea.architectureTab.requirements')}</p>
                  <p className="text-sm text-muted-foreground">{requirementsApproved ? t('ea.architectureTab.published') : t('ea.architectureTab.publishRequirementsFirst')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !draft) {
    return (
      <div className="space-y-4 p-6" data-testid="loading-ea">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="h-full p-6">
        <Card className="h-full border-dashed">
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 text-center p-10">
            <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              {generateMutation.isPending ? (
                <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : (
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                {generateMutation.isPending ? t('ea.architectureTab.generatingEaIntelligence') : t('ea.architectureTab.eaIntelligence')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mt-2">
                {generateMutation.isPending
                  ? t('ea.architectureTab.generatingDescription')
                  : t('ea.architectureTab.eaWillBeGenerated')}
              </p>
            </div>
            {!canGenerateEnterpriseArchitecture && (
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.noPermission')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const _businessGauge = [{ name: "Alignment", value: draft.businessArchitecture.strategicAlignmentScore, fill: "#0284c7" }];
  const valueStreamChart = draft.businessArchitecture.valueStreams.map((stream) => ({
    name: compactLabel(stream.name, 38),
    fullName: stream.name,
    score: stream.impactLevel === "critical" ? 95 : stream.impactLevel === "high" ? 75 : stream.impactLevel === "medium" ? 50 : 25,
  }));

  const integrationComplexityChart = draft.applicationArchitecture.integrationDependencies.map((item) => ({
    name: compactLabel(`${item.source} -> ${item.target}`, 38),
    fullName: `${item.source} -> ${item.target}`,
    complexity: item.complexityScore,
  }));

  const lifecycleMatrix = ["active", "legacy", "replace"].map((life) => ({
    lifecycle: life,
    count: draft.applicationArchitecture.impactedApplications.filter((app) => app.lifecycle === life).length,
  }));

  const dataSensitivityChart = draft.dataArchitecture.dataDomains.map((domain) => ({
    name: compactLabel(domain.name, 38),
    fullName: domain.name,
    sensitivity: domain.sensitivityScore,
    pii: domain.piiExposureRisk,
  }));

  const technologyScoreChart = [
    { name: "Cloud", value: draft.technologyArchitecture.cloudAlignmentScore },
    { name: "Security", value: draft.technologyArchitecture.securityBaselineCompliance },
    { name: "DevOps", value: draft.technologyArchitecture.devOpsCompatibility },
  ];

  const technologyRadar = [
    { dimension: "Cloud", value: draft.technologyArchitecture.cloudAlignmentScore },
    { dimension: "Security", value: draft.technologyArchitecture.securityBaselineCompliance },
    { dimension: "DevOps", value: draft.technologyArchitecture.devOpsCompatibility },
    { dimension: "Policy", value: Math.max(0, 100 - draft.riskImpactDashboard.policyDeviationFlags * 10) },
  ];

  const technologyLayers: [string, string[]][] = [
    [t('ea.architectureTab.presentation'), draft.technologyArchitecture.stackLayers.presentation],
    [t('ea.architectureTab.applicationLayerShort'), draft.technologyArchitecture.stackLayers.application],
    [t('ea.architectureTab.integrationLayerShort'), draft.technologyArchitecture.stackLayers.integration],
    [t('ea.architectureTab.dataLayerShort'), draft.technologyArchitecture.stackLayers.data],
    [t('ea.architectureTab.infrastructure'), draft.technologyArchitecture.stackLayers.infrastructure],
    [t('ea.architectureTab.security'), draft.technologyArchitecture.stackLayers.security],
  ];

  const riskRadar = [
    { metric: "Complexity", value: draft.riskImpactDashboard.architectureComplexityScore },
    { metric: "Integration", value: draft.riskImpactDashboard.integrationRiskScore },
    { metric: "Data", value: draft.riskImpactDashboard.dataSensitivityRisk },
    { metric: "Policy", value: Math.min(100, draft.riskImpactDashboard.policyDeviationFlags * 10) },
    { metric: "Debt", value: draft.riskImpactDashboard.technicalDebtExposure },
    { metric: "Misalign", value: draft.riskImpactDashboard.strategicMisalignmentRisk },
  ];

  const alignmentGauge = [{ name: "Alignment", value: draft.riskImpactDashboard.targetArchitectureAlignment, fill: "#16a34a" }];

  return (
    <div className={`flex w-full max-w-full min-w-0 flex-col ${isFullscreen ? "min-h-full overflow-visible p-6" : "h-[calc(100vh-4rem)] overflow-hidden p-4"} gap-4`} data-testid="ea-tab">
      {showMainGovernanceCard && <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                {t('ea.architectureTab.enterpriseArchitecture')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('ea.architectureTab.versionAlignedWorkspace', { generatedAt: generatedAtLabel })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isEditMode ? (
                <>
                  {latestVersion?.status === "draft" && (
                    <Button
                      onClick={() => submitForReview.mutate()}
                      disabled={submitForReview.isPending}
                      size="sm"
                      data-testid="button-submit-review-ea"
                    >
                      {submitForReview.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {t('ea.architectureTab.submitForReview')}
                    </Button>
                  )}
                  {latestVersion?.status === "under_review" && (
                    <Button
                      onClick={() => approveVersion.mutate()}
                      disabled={approveVersion.isPending}
                      size="sm"
                      data-testid="button-approve-ea"
                    >
                      {approveVersion.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {t('ea.architectureTab.initialApproval')}
                    </Button>
                  )}
                  {latestVersion?.status === "approved" && (
                    <Button
                      onClick={() => sendToDirector.mutate()}
                      disabled={sendToDirector.isPending}
                      size="sm"
                      data-testid="button-send-director-ea"
                    >
                      {sendToDirector.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {t('ea.architectureTab.submitForDirector')}
                    </Button>
                  )}
                  {latestVersion?.status === "manager_approval" && (
                    <Button
                      onClick={() => finalApprove.mutate()}
                      disabled={finalApprove.isPending}
                      size="sm"
                      data-testid="button-final-approve-ea"
                    >
                      {finalApprove.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {t('ea.architectureTab.finalApproval')}
                    </Button>
                  )}
                  {isLocked ? (
                    <>
                      <Badge variant="secondary" className="gap-1"><LockIcon className="h-3 w-3" /> {t('ea.architectureTab.viewOnly')}</Badge>
                      <Button
                        variant="outline"
                        onClick={handleCreateNewVersion}
                        disabled={createVersionMutation.isPending}
                        size="sm"
                        data-testid="button-create-new-ea-version"
                      >
                        {createVersionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
                        {t('ea.architectureTab.newVersion')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleEditToggle}
                      size="sm"
                      data-testid="button-edit-ea"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t('ea.architectureTab.edit')}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      if (!isDirty) {
                        toast({ title: t('ea.architectureTab.toastNoChanges'), description: t('ea.architectureTab.toastNoChangesDesc') });
                        return;
                      }
                      setShowVersionDialog(true);
                    }}
                    disabled={!isDirty}
                    size="sm"
                    data-testid="button-save-exit-ea"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {t('ea.architectureTab.saveAndExit')}
                  </Button>
                  <Button variant="outline" onClick={handleEditToggle} size="sm" data-testid="button-cancel-edit-ea">
                    <X className="h-4 w-4 mr-2" />
                    {t('ea.architectureTab.cancel')}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowVersionSheet(true)} data-testid="button-ea-version-history">
                <History className="h-4 w-4 mr-2" />
                {t('ea.architectureTab.versionHistory')}
              </Button>
            </div>
          </div>
        </CardHeader>
        {latestVersion && (
          <CardContent className="pt-0">
            <VersionCollaborationIndicator
              versionId={latestVersion.id}
              reportId={reportId}
              compact
            />
          </CardContent>
        )}
      </Card>}

      {isLocked && (
        <Card className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-green-700 dark:text-green-400">{t('ea.architectureTab.eaDocumentLocked')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('ea.architectureTab.eaDocumentLockedDesc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative flex w-full flex-1 min-h-0 overflow-hidden" data-testid="ea-content-with-intelligence">
        {!isFullscreen && !showVersionComparison && !showIntelligenceRail && (
          <div
            className="group absolute left-0 top-0 z-30 flex h-full w-3 cursor-pointer flex-col items-center justify-center border-r border-transparent bg-transparent transition-all duration-200 hover:w-5 hover:border-sky-300/40 hover:bg-gradient-to-r hover:from-sky-500/10 hover:via-cyan-500/10 hover:to-transparent dark:hover:border-sky-400/30 dark:hover:from-sky-500/15 dark:hover:via-cyan-500/10"
            onMouseEnter={() => setShowIntelligenceRail(true)}
            onClick={() => setShowIntelligenceRail(true)}
            data-testid="button-show-intelligence-rail-ea"
            role="button"
            tabIndex={0}
            aria-label="Show Intelligence Panel"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowIntelligenceRail(true);
              }
            }}
          >
            <span
              className="pointer-events-none flex h-16 w-1 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 via-cyan-500 to-teal-500 opacity-60 shadow-[0_0_12px_rgba(14,165,233,0.55)] transition-all duration-200 group-hover:h-20 group-hover:w-1.5 group-hover:opacity-100 group-hover:shadow-[0_0_18px_rgba(14,165,233,0.85)] dark:from-sky-300 dark:via-cyan-400 dark:to-teal-400"
              aria-hidden="true"
            />
            <span className="sr-only">Show Intelligence Panel</span>
          </div>
        )}

        {!isFullscreen && !showVersionComparison && showIntelligenceRail && (
          <div
            className="absolute left-0 top-0 z-40 flex h-full min-h-0 w-[380px] flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] dark:shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(148,163,184,0.08)]"
            onMouseLeave={() => setShowIntelligenceRail(false)}
            data-testid="ea-intelligence-rail"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-slate-200/60 to-transparent dark:via-slate-700/50" aria-hidden="true" />
            <div className="flex-shrink-0 border-b border-slate-200/70 bg-gradient-to-r from-white via-sky-50/40 to-white text-foreground backdrop-blur dark:border-slate-800/70 dark:from-slate-950/60 dark:via-sky-950/30 dark:to-slate-950/60">
              <div className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">{t('ea.architectureTab.intelligencePanel')}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Decision support · Quality · Workflow</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="h-5 gap-1 border-emerald-400/30 bg-emerald-500/10 px-1.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                    Live
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    onClick={() => setShowIntelligenceRail(false)}
                    data-testid="button-hide-intelligence-rail-ea"
                    aria-label="Hide Intelligence Panel"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="space-y-3" data-testid="intelligence-rail-moved-header-ea">
                {movedHeaderContent}
              </div>

              <Card className={`mission-module ${eaRailCardClass}`}>
                <CardHeader className={eaRailHeaderClass}>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 via-indigo-500/15 to-cyan-500/15 text-violet-600 dark:text-violet-300">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-foreground">{t('ea.architectureTab.coreviaAdvisor')}</span>
                    <Badge variant="outline" className="text-[9px] h-4 border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">AI</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className={eaRailBodyClass}>
                  <div className={eaRailInsetClass}>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      {t('ea.architectureTab.externalAdvisoryPackDesc')}
                    </p>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-auto justify-start rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-3 py-3 text-left text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:via-indigo-700 hover:to-cyan-700"
                    onClick={() => handleGenerateExternalAdvisor("all")}
                    disabled={isGeneratingAdvisor || !latestVersion}
                    data-testid="button-generate-ea-advisory-pack"
                  >
                    <div className="flex items-center gap-2">
                      {isGeneratingAdvisor ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <Lightbulb className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide">{t('ea.architectureTab.eaAdvisoryPack')}</p>
                        <p className="text-[10px] text-white/80">Guidance, options, and benchmarks.</p>
                      </div>
                    </div>
                  </Button>

                  {advisorData && (
                    <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/80 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-violet-600 flex items-center gap-1 dark:text-violet-300">
                          <Sparkles className="h-3 w-3" />
                          {t('ea.architectureTab.advisoryPackReady')}
                        </p>
                        <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/50 text-emerald-600">
                          {t('ea.architectureTab.complete')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                          <p className="text-[9px] text-muted-foreground">{t('ea.architectureTab.ideation')}</p>
                          <p className="text-[10px] font-medium text-blue-600">{advisorData.ideation.length}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                          <p className="text-[9px] text-muted-foreground">{t('ea.architectureTab.alternatives')}</p>
                          <p className="text-[10px] font-medium text-emerald-600">{advisorData.alternativeArchitectures.length}</p>
                        </div>
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                          <p className="text-[9px] text-muted-foreground">{t('ea.architectureTab.benchmarks')}</p>
                          <p className="text-[10px] font-medium text-amber-600">{advisorData.benchmarkComparisons.length}</p>
                        </div>
                      </div>

                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-indigo-600"
                        onClick={() => setShowAdvisorDetailsPanel(true)}
                        data-testid="button-view-ea-advisory-details"
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        {t('ea.architectureTab.viewDetails')}
                      </Button>
                    </div>
                  )}

                  {!advisorData && latestVersion && (
                    <div className={eaRailInsetClass}>
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                          <History className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">Advisory is ready when you are</p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-600 dark:text-slate-300">Use the pack generator to compare options, benchmark patterns, and strengthen executive review discussions.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`mission-module ${eaRailCardClass}`}>
                <CardHeader className={eaRailHeaderClass}>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                      <div
                        className="h-2 w-2 rounded-full status-pulse"
                        style={{ background: 'hsl(var(--accent-cyan))' }}
                        role="status"
                        aria-label="Active collaboration status"
                      />
                    </div>
                    Live Collaboration
                  </CardTitle>
                </CardHeader>
                <CardContent className={eaRailBodyClass}>
                  {latestVersion && (
                    <div className={eaRailInsetClass}>
                      <VersionCollaborationIndicator
                        versionId={latestVersion.id}
                        reportId={reportId}
                        variant="sidebar"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`mission-module depth-2 ${eaRailCardClass}`}>
                <CardHeader className={eaRailHeaderClass}>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
                      <Target className="h-4 w-4" />
                    </span>
                    Workflow Status
                  </CardTitle>
                </CardHeader>
                <CardContent className={eaRailBodyClass}>
                  {latestVersion && (
                    <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Active version</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{displayVersionLabel}</p>
                        </div>
                        {renderEaStatusBadge(latestVersion.status)}
                      </div>
                      {latestVersion.approvedAt && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Approved:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-50">{new Date(latestVersion.approvedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`mission-module ${eaRailCardClass}`}>
                <CardHeader className={eaRailHeaderClass}>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <History className="h-4 w-4" />
                    </span>
                    Recent Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className={eaRailBodyClass}>
                  {enterpriseVersions.slice(0, 3).map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 dark:border-slate-800/70 dark:bg-slate-900/50">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Version</p>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">{/^v/i.test(String(version.versionNumber)) ? String(version.versionNumber) : `v${String(version.versionNumber)}`}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{new Date(version.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {enterpriseVersions.length === 0 && (
                    <p className="rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-400">No changes recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          <SpineDecisionBanner spine={draft.spine} />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 w-full min-w-0 flex-col">
        <div className="flex-shrink-0 overflow-x-auto pb-1">
        <TabsList className="inline-flex min-w-max h-auto gap-2 border bg-muted/40 p-2 rounded-xl">
          <TabsTrigger value="business" className="min-w-[9.25rem] text-xs sm:text-sm justify-start gap-2 rounded-lg border border-transparent px-3 data-[state=active]:border-blue-500/40 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" /> {t('ea.architectureTab.tabBusiness')}
          </TabsTrigger>
          <TabsTrigger value="application" className="min-w-[9.25rem] text-xs sm:text-sm justify-start gap-2 rounded-lg border border-transparent px-3 data-[state=active]:border-indigo-500/40 data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm">
            <Network className="h-4 w-4" /> {t('ea.architectureTab.tabApplication')}
          </TabsTrigger>
          <TabsTrigger value="data" className="min-w-[9.25rem] text-xs sm:text-sm justify-start gap-2 rounded-lg border border-transparent px-3 data-[state=active]:border-emerald-500/40 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm">
            <Database className="h-4 w-4" /> {t('ea.architectureTab.tabData')}
          </TabsTrigger>
          <TabsTrigger value="technology" className="min-w-[9.25rem] text-xs sm:text-sm justify-start gap-2 rounded-lg border border-transparent px-3 data-[state=active]:border-violet-500/40 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-sm">
            <Layers className="h-4 w-4" /> {t('ea.architectureTab.tabTechnology')}
          </TabsTrigger>
          <TabsTrigger value="risk" className="min-w-[9.25rem] text-xs sm:text-sm justify-start gap-2 rounded-lg border border-transparent px-3 data-[state=active]:border-rose-500/40 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-300 data-[state=active]:shadow-sm">
            <Gauge className="h-4 w-4" /> {t('ea.architectureTab.tabRiskImpact')}
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="business" className="mt-4 flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background/40 p-3">
          <SpineTraceabilityStrip spine={draft.spine} tab="business" />
          <SpineEntityCards spine={draft.spine} tab="business" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label={t('ea.architectureTab.strategicAlignment')} value={`${draft.businessArchitecture.strategicAlignmentScore}%`} subtitle={t('ea.architectureTab.missionAlignment')} />
            <KpiTile label={t('ea.architectureTab.capabilityDomains')} value={draft.businessArchitecture.capabilityDomains.length} subtitle={t('ea.architectureTab.mappedCapabilities')} />
            <KpiTile label={t('ea.architectureTab.valueStreams')} value={draft.businessArchitecture.valueStreams.length} subtitle={t('ea.architectureTab.impactPathways')} />
            <KpiTile label={t('ea.architectureTab.kpiLinks')} value={draft.businessArchitecture.kpiLinkage.length} subtitle={t('ea.architectureTab.boardKpiTraceability')} />
          </div>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                {t('ea.architectureTab.capabilityHeatmap')}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto overflow-y-hidden">
              <div className="min-w-[760px] rounded-lg border bg-background/70 shadow-sm overflow-hidden">
                <div className="grid" style={{ gridTemplateColumns: `160px repeat(${Math.max(1, businessHeatmap.domains.length)}, minmax(72px, 1fr))` }}>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-b bg-muted/40">{t('ea.architectureTab.subCapability')}</div>
                  {businessHeatmap.domains.map((domain) => (
                    <div key={domain.name} className="p-2 text-[11px] font-semibold text-center leading-4 border-b bg-muted/40" title={domain.name}>
                      {compactLabel(domain.name, 20)}
                    </div>
                  ))}

                  {(businessHeatmap.subCapabilities.length > 0 ? businessHeatmap.subCapabilities : [t('ea.architectureTab.noSubCapabilitiesHeatmap')]).map((sub) => (
                    <Fragment key={sub}>
                      <div key={`${sub}-label`} className="p-2 text-[11px] leading-4 border-b font-medium text-foreground/90 bg-muted/10" title={sub}>
                        {compactLabel(sub, 42)}
                      </div>
                      {businessHeatmap.domains.map((domain) => {
                        const ownsSub = domain.subCapabilities.includes(sub);
                        const score = ownsSub
                          ? Math.round((domain.alignmentScore + domain.transformationPriority) / 2)
                          : Math.round(domain.alignmentScore * 0.3);
                        return (
                          <div key={`${sub}-${domain.name}`} className={`p-2 text-xs border-b border-l text-center ${scoreClass(score)}`}>
                            {score}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 border-sky-500/20 bg-gradient-to-br from-sky-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.strategicAlignmentGauge')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: "Alignment", value: draft.businessArchitecture.strategicAlignmentScore }]} layout="vertical" margin={{ left: 20, right: 20, top: 20, bottom: 12 }}>
                    <defs>
                      <linearGradient id="eaBusinessGaugeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" hide />
                    <ReferenceArea x1={0} x2={45} fill="#fef3c7" fillOpacity={0.45} />
                    <ReferenceArea x1={45} x2={70} fill="#dbeafe" fillOpacity={0.45} />
                    <ReferenceArea x1={70} x2={100} fill="#dcfce7" fillOpacity={0.45} />
                    <ReferenceLine x={70} stroke="#0891b2" strokeDasharray="4 3" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill="url(#eaBusinessGaugeGradient)" radius={[8, 8, 8, 8]} barSize={34} />
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} payload={[
                      { value: t('ea.architectureTab.legendLow'), type: "square", color: "#fef3c7" },
                      { value: t('ea.architectureTab.legendMedium'), type: "square", color: "#dbeafe" },
                      { value: t('ea.architectureTab.legendStrong'), type: "square", color: "#dcfce7" },
                    ]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.valueStreamImpact')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueStreamChart} layout="vertical" margin={{ left: 24, right: 10 }}>
                    <defs>
                      <linearGradient id="eaValueStreamGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis type="number" domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={220} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(label, payload) => {
                        const fullName = payload?.[0]?.payload?.fullName;
                        return typeof fullName === "string" ? fullName : String(label);
                      }}
                    />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="score" name={t('ea.architectureTab.impactScore')} radius={[6, 6, 6, 6]}>
                      {valueStreamChart.map((item) => (
                        <Cell key={item.name} fill={item.score >= 70 ? "#0ea5e9" : item.score >= 45 ? "#6366f1" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('ea.architectureTab.businessArchitectureWorkspace')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.businessWorkspaceDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground [&_textarea:disabled]:bg-background [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_input:disabled]:bg-background">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.domainMappingInputs')}</p>
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  <div className="space-y-1 overflow-x-auto">
                    <Label>{t('ea.architectureTab.capabilityDomainsLabel')}</Label>
                    <Table className={EA_TABLE_CLASS}>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>{t('ea.architectureTab.name')}</TableHead>
                          <TableHead>{t('ea.architectureTab.alignmentPct')}</TableHead>
                          <TableHead>{t('ea.architectureTab.priorityPct')}</TableHead>
                          <TableHead>{t('ea.architectureTab.subCapabilities')}</TableHead>
                          <TableHead className="w-14" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draft.businessArchitecture.capabilityDomains.map((domain, index) => (
                          <TableRow key={`capability-domain-${index}`} className="hover:bg-muted/20">
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Input
                                  className="bg-background text-foreground"
                                  disabled={!isEditMode}
                                  value={domain.name}
                                  onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, name: event.target.value } : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.capabilityDomains" })}
                                />
                              ) : (
                                <p className="text-sm font-medium text-foreground">{domain.name || "—"}</p>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Input
                                  className="bg-background text-foreground"
                                  disabled={!isEditMode}
                                  value={domain.alignmentScore}
                                  onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, alignmentScore: parseNumeric(event.target.value, item.alignmentScore) }
                                          : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.capabilityDomains" })}
                                />
                              ) : (
                                <Badge variant="outline" className={scoreClass(domain.alignmentScore)}>{domain.alignmentScore}%</Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Input
                                  className="bg-background text-foreground"
                                  disabled={!isEditMode}
                                  value={domain.transformationPriority}
                                  onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              transformationPriority: parseNumeric(event.target.value, item.transformationPriority),
                                            }
                                          : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.capabilityDomains" })}
                                />
                              ) : (
                                <Badge variant="outline" className={scoreClass(domain.transformationPriority)}>{domain.transformationPriority}%</Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <div className="space-y-2">
                                  {domain.subCapabilities.map((subCapability, subIndex) => (
                                    <div key={`sub-capability-${index}-${subIndex}`} className="flex items-center gap-2">
                                      <Input
                                        className="bg-background text-foreground"
                                        value={subCapability}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          businessArchitecture: {
                                            ...current.businessArchitecture,
                                            capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    subCapabilities: item.subCapabilities.map((subItem, subItemIndex) =>
                                                      subItemIndex === subIndex ? event.target.value : subItem
                                                    ),
                                                  }
                                                : item
                                            ),
                                          },
                                        }), { field: "businessArchitecture.capabilityDomains" })}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={domain.subCapabilities.length <= 1}
                                        onClick={() => updateDraft((current) => ({
                                          ...current,
                                          businessArchitecture: {
                                            ...current.businessArchitecture,
                                            capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    subCapabilities: item.subCapabilities.filter((_, subItemIndex) => subItemIndex !== subIndex),
                                                  }
                                                : item
                                            ),
                                          },
                                        }), { field: "businessArchitecture.capabilityDomains" })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateDraft((current) => ({
                                      ...current,
                                      businessArchitecture: {
                                        ...current.businessArchitecture,
                                        capabilityDomains: current.businessArchitecture.capabilityDomains.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                subCapabilities: [...item.subCapabilities, `Sub-Capability ${item.subCapabilities.length + 1}`],
                                              }
                                            : item
                                        ),
                                      },
                                    }), { field: "businessArchitecture.capabilityDomains" })}
                                  >
                                    <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addSubCapability')}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {domain.subCapabilities.length > 0 ? (
                                    domain.subCapabilities.map((subCapability) => (
                                      <Badge key={`${domain.name}-${subCapability}`} variant="outline" className="bg-blue-500/15 text-blue-900 border-blue-400/30 dark:text-blue-200">
                                        {subCapability}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{t('ea.architectureTab.noSubCapabilities')}</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!isEditMode || draft.businessArchitecture.capabilityDomains.length <= 1}
                                onClick={() => updateDraft((current) => ({
                                  ...current,
                                  businessArchitecture: {
                                    ...current.businessArchitecture,
                                    capabilityDomains: current.businessArchitecture.capabilityDomains.filter((_, itemIndex) => itemIndex !== index),
                                  },
                                }), { field: "businessArchitecture.capabilityDomains" })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isEditMode}
                        onClick={() => updateDraft((current) => ({
                          ...current,
                          businessArchitecture: {
                            ...current.businessArchitecture,
                            capabilityDomains: [
                              ...current.businessArchitecture.capabilityDomains,
                              {
                                name: `Capability ${current.businessArchitecture.capabilityDomains.length + 1}`,
                                alignmentScore: 0,
                                transformationPriority: 0,
                                subCapabilities: [],
                              },
                            ],
                          },
                        }), { field: "businessArchitecture.capabilityDomains" })}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addRow')}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 overflow-x-auto">
                    <Label>{t('ea.architectureTab.valueStreamsLabel')}</Label>
                    <Table className={EA_TABLE_CLASS}>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>{t('ea.architectureTab.name')}</TableHead>
                          <TableHead>{t('ea.architectureTab.impact')}</TableHead>
                          <TableHead>{t('ea.architectureTab.kpiLinkage')}</TableHead>
                          <TableHead className="w-14" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draft.businessArchitecture.valueStreams.map((stream, index) => (
                          <TableRow key={`value-stream-${index}`} className="hover:bg-muted/20">
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Input
                                  className="bg-background text-foreground"
                                  disabled={!isEditMode}
                                  value={stream.name}
                                  onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      valueStreams: current.businessArchitecture.valueStreams.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, name: event.target.value } : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.valueStreams" })}
                                />
                              ) : (
                                <p className="text-sm font-medium text-foreground">{stream.name || "—"}</p>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Select
                                  disabled={!isEditMode}
                                  value={stream.impactLevel}
                                  onValueChange={(value) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      valueStreams: current.businessArchitecture.valueStreams.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, impactLevel: value as ImpactLevel } : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.valueStreams" })}
                                >
                                  <SelectTrigger className="bg-background text-foreground"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">{t('ea.architectureTab.low')}</SelectItem>
                                    <SelectItem value="medium">{t('ea.architectureTab.medium')}</SelectItem>
                                    <SelectItem value="high">{t('ea.architectureTab.high')}</SelectItem>
                                    <SelectItem value="critical">{t('ea.architectureTab.critical')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={impactBadgeClass(stream.impactLevel)}>{stream.impactLevel.toUpperCase()}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {isEditMode ? (
                                <Input
                                  className="bg-background text-foreground"
                                  disabled={!isEditMode}
                                  value={stream.kpiLinkage.join(", ")}
                                  onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    businessArchitecture: {
                                      ...current.businessArchitecture,
                                      valueStreams: current.businessArchitecture.valueStreams.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, kpiLinkage: fromLines(event.target.value.replace(/,/g, "\n")) }
                                          : item
                                      ),
                                    },
                                  }), { field: "businessArchitecture.valueStreams" })}
                                />
                              ) : (
                                <p className="text-sm text-foreground/95 leading-relaxed">{stream.kpiLinkage.join(", ") || "—"}</p>
                              )}
                            </TableCell>
                            <TableCell className="p-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!isEditMode || draft.businessArchitecture.valueStreams.length <= 1}
                                onClick={() => updateDraft((current) => ({
                                  ...current,
                                  businessArchitecture: {
                                    ...current.businessArchitecture,
                                    valueStreams: current.businessArchitecture.valueStreams.filter((_, itemIndex) => itemIndex !== index),
                                  },
                                }), { field: "businessArchitecture.valueStreams" })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isEditMode}
                        onClick={() => updateDraft((current) => ({
                          ...current,
                          businessArchitecture: {
                            ...current.businessArchitecture,
                            valueStreams: [
                              ...current.businessArchitecture.valueStreams,
                              {
                                name: `Value Stream ${current.businessArchitecture.valueStreams.length + 1}`,
                                impactLevel: "medium",
                                kpiLinkage: [],
                              },
                            ],
                          },
                        }), { field: "businessArchitecture.valueStreams" })}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addRow')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.qualityTraceabilityInputs')}</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.kpiLinkageLabel')}
                    values={draft.businessArchitecture.kpiLinkage}
                    disabled={!isEditMode}
                    itemName="KPI"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      businessArchitecture: {
                        ...current.businessArchitecture,
                        kpiLinkage: next,
                      },
                    }), { field: "businessArchitecture.kpiLinkage" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.duplicationHotspots')}
                    values={draft.businessArchitecture.duplicationHotspots}
                    disabled={!isEditMode}
                    itemName="Hotspot"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      businessArchitecture: {
                        ...current.businessArchitecture,
                        duplicationHotspots: next,
                      },
                    }), { field: "businessArchitecture.duplicationHotspots" })}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label>{t('ea.architectureTab.strategicAlignmentScorePct')}</Label>
                  <Input
                    disabled={!isEditMode}
                    value={draft.businessArchitecture.strategicAlignmentScore}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      businessArchitecture: {
                        ...current.businessArchitecture,
                        strategicAlignmentScore: parseNumeric(event.target.value, current.businessArchitecture.strategicAlignmentScore),
                      },
                    }), { field: "businessArchitecture.strategicAlignmentScore" })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="mt-4 flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background/40 p-3">
          <SpineTraceabilityStrip spine={draft.spine} tab="application" />
          <SpineEntityCards spine={draft.spine} tab="application" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label={t('ea.architectureTab.impactedSystems')} value={draft.applicationArchitecture.impactedApplications.length} subtitle={t('ea.architectureTab.architectureInventory')} />
            <KpiTile label={t('ea.architectureTab.dependencies')} value={draft.applicationArchitecture.integrationDependencies.length} subtitle={t('ea.architectureTab.integrationEdges')} />
            <KpiTile label={t('ea.architectureTab.integrationRisk')} value={`${draft.applicationArchitecture.integrationRiskScore}%`} subtitle={t('ea.architectureTab.crossSystemRisk')} />
            <KpiTile label={t('ea.architectureTab.apiComplexity')} value={`${draft.applicationArchitecture.apiComplexityScore}%`} subtitle={t('ea.architectureTab.interfaceLoad')} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-indigo-600" />
                {t('ea.architectureTab.applicationNetworkGraph')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const edges = appNetwork.edges.slice(0, 24);
                const fallbackNames = appNetwork.nodes.map((node) => node.name).slice(0, 8);
                const nodeByName = new Map(appNetwork.nodes.map((node) => [node.name, node]));
                const criticalityRank: Record<ImpactLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };

                const outboundCount = edges.reduce<Record<string, number>>((accumulator, edge) => {
                  accumulator[edge.source] = (accumulator[edge.source] || 0) + 1;
                  return accumulator;
                }, {});

                const inboundCount = edges.reduce<Record<string, number>>((accumulator, edge) => {
                  accumulator[edge.target] = (accumulator[edge.target] || 0) + 1;
                  return accumulator;
                }, {});

                const sourceNames = Array.from(new Set(edges.map((edge) => edge.source)));
                const targetNames = Array.from(new Set(edges.map((edge) => edge.target)));

                const rankNames = (names: string[], counts: Record<string, number>) =>
                  names
                    .sort((a, b) => {
                      const levelA = nodeByName.get(a)?.level || "medium";
                      const levelB = nodeByName.get(b)?.level || "medium";
                      const rankDiff = criticalityRank[levelB] - criticalityRank[levelA];
                      if (rankDiff !== 0) return rankDiff;
                      return (counts[b] || 0) - (counts[a] || 0);
                    })
                    .slice(0, 10);

                const leftNames = sourceNames.length > 0 ? rankNames(sourceNames, outboundCount) : fallbackNames;
                const rightNames = targetNames.length > 0 ? rankNames(targetNames, inboundCount) : fallbackNames;
                const splitCompactGraphLabel = (value: string, maxLineLength = 34, maxLines = 3): string[] => {
                  const normalized = normalizeText(value) || "Unnamed";
                  const words = normalized.split(" ");
                  const lines: string[] = [];
                  let current = "";

                  for (const word of words) {
                    const candidate = current ? `${current} ${word}` : word;
                    if (candidate.length <= maxLineLength) {
                      current = candidate;
                    } else {
                      if (current) lines.push(current);
                      current = word;
                    }
                    if (lines.length === maxLines - 1) break;
                  }

                  const consumedWords = lines.join(" ").split(" ").filter(Boolean).length;
                  const remainingWords = words.slice(consumedWords);
                  const tail = (current ? [current] : []).concat(remainingWords).join(" ").trim();
                  if (tail) {
                    lines.push(tail.length > maxLineLength ? `${tail.slice(0, Math.max(1, maxLineLength - 1))}…` : tail);
                  }

                  return lines.slice(0, maxLines);
                };

                const leftLines = Object.fromEntries(leftNames.map((name) => [name, splitCompactGraphLabel(name)])) as Record<string, string[]>;
                const rightLines = Object.fromEntries(rightNames.map((name) => [name, splitCompactGraphLabel(name)])) as Record<string, string[]>;

                const rowGap = 62;
                const graphHeaderBottomY = 100;
                const firstRowTopPadding = 28;
                const startY = graphHeaderBottomY + firstRowTopPadding;
                const leftY = Object.fromEntries(leftNames.map((name, index) => [name, startY + index * rowGap])) as Record<string, number>;
                const rightY = Object.fromEntries(rightNames.map((name, index) => [name, startY + index * rowGap])) as Record<string, number>;

                const canvasHeight = Math.max(500, startY + 120 + Math.max(leftNames.length, rightNames.length) * rowGap);

                const topRiskEdge = edges.reduce<IntegrationDependency | null>((highest, edge) => {
                  if (!highest) return edge;
                  return edge.complexityScore > highest.complexityScore ? edge : highest;
                }, null);

                const mostConnected = Object.entries({ ...outboundCount, ...inboundCount })
                  .sort((a, b) => ((outboundCount[b[0]] || 0) + (inboundCount[b[0]] || 0)) - ((outboundCount[a[0]] || 0) + (inboundCount[a[0]] || 0)))[0]?.[0];

                const levelColor = (level: ImpactLevel | undefined) => {
                  if (level === "critical") return "#ef4444";
                  if (level === "high") return "#f59e0b";
                  if (level === "medium") return "#3b82f6";
                  return "#16a34a";
                };

                return (
                  <div className="rounded-lg border bg-muted/20 overflow-x-auto">
                    <svg
                      viewBox={`0 0 980 ${canvasHeight}`}
                      preserveAspectRatio="xMidYMin meet"
                      className="w-full min-w-[880px]"
                      style={{ height: `${Math.max(440, canvasHeight)}px` }}
                    >
                      <defs>
                        <marker id="eaEdgeArrowCompact" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                          <path d="M0,0 L8,4 L0,8 z" fill="#6366f1" />
                        </marker>
                      </defs>

                      <rect x={16} y={18} width={312} height={canvasHeight - 36} rx={12} fill="#dbeafe" opacity={0.45} />
                      <rect x={652} y={18} width={312} height={canvasHeight - 36} rx={12} fill="#e0e7ff" opacity={0.45} />
                      <rect x={372} y={18} width={220} height={canvasHeight - 36} rx={12} fill="hsl(var(--background))" stroke="hsl(var(--border))" />

                      <text x={172} y={44} textAnchor="middle" fontSize="13" fontWeight={700} fill="currentColor">{t('ea.architectureTab.sourceSystems')}</text>
                      <text x={808} y={44} textAnchor="middle" fontSize="13" fontWeight={700} fill="currentColor">{t('ea.architectureTab.targetSystems')}</text>
                      <text x={482} y={44} textAnchor="middle" fontSize="13" fontWeight={700} fill="currentColor">{t('ea.architectureTab.integrationFabric')}</text>
                      <text x={482} y={64} textAnchor="middle" fontSize="11" fill="currentColor">{t('ea.architectureTab.routeDescription')}</text>

                      <rect x={26} y={72} width={292} height={28} rx={8} fill="hsl(var(--background))" stroke="hsl(var(--border))" />
                      <text x={42} y={90} fontSize="11" fill="currentColor">{t('ea.architectureTab.mostConnected')}: {compactLabel(mostConnected || "N/A", 48)}</text>

                      <rect x={662} y={72} width={292} height={28} rx={8} fill="hsl(var(--background))" stroke="hsl(var(--border))" />
                      <text x={690} y={90} fontSize="11" fill="currentColor">{t('ea.architectureTab.highestRiskLink')}: {topRiskEdge ? `${compactLabel(topRiskEdge.source, 22)} → ${compactLabel(topRiskEdge.target, 22)}` : "N/A"}</text>

                      {edges.map((edge, index) => {
                        const startY = leftY[edge.source];
                        const endY = rightY[edge.target];
                        if (typeof startY !== "number" || typeof endY !== "number") return null;
                        const curve = 64 + (index % 4) * 12;
                        const stroke = edge.complexityScore >= 70 ? "#ef4444" : edge.complexityScore >= 45 ? "#f59e0b" : "#6366f1";
                        const labelX = 482;
                        const labelY = (startY + endY) / 2 - 2;
                        return (
                          <g key={`compact-edge-${edge.source}-${edge.target}-${index}`}>
                            <path
                              d={`M 328 ${startY} C ${396 + curve} ${startY}, ${584 - curve} ${endY}, 652 ${endY}`}
                              fill="none"
                              stroke={stroke}
                              strokeWidth={1.2 + edge.apiCount * 0.2}
                              opacity={0.8}
                              markerEnd="url(#eaEdgeArrowCompact)"
                            />
                            <rect x={labelX - 42} y={labelY - 10} width={84} height={18} rx={6} fill="hsl(var(--background))" stroke="hsl(var(--border))" opacity={0.95} />
                            <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="10" fill="currentColor">{edge.apiCount} API • {edge.complexityScore}%</text>
                          </g>
                        );
                      })}

                      {leftNames.map((name) => (
                        <g key={`left-${name}`}>
                          <rect x={26} y={(leftY[name] || 0) - 26} width={292} height={52} rx={7} fill="hsl(var(--background))" stroke="hsl(var(--border))" />
                          <rect x={26} y={(leftY[name] || 0) - 26} width={4} height={52} rx={7} fill={levelColor(nodeByName.get(name)?.level)} />
                          <text x={38} y={(leftY[name] || 0) - 11} fontSize="11.5" fill="currentColor">
                            <tspan x={38} dy="0">{leftLines[name]?.[0] || "Unnamed"}</tspan>
                            {leftLines[name]?.[1] ? <tspan x={38} dy="13">{leftLines[name][1]}</tspan> : null}
                            {leftLines[name]?.[2] ? <tspan x={38} dy="13">{leftLines[name][2]}</tspan> : null}
                          </text>
                          <text x={308} y={(leftY[name] || 0) + 4} textAnchor="end" fontSize="11" fill="currentColor">OUT {outboundCount[name] || 0}</text>
                        </g>
                      ))}

                      {rightNames.map((name) => (
                        <g key={`right-${name}`}>
                          <rect x={652} y={(rightY[name] || 0) - 26} width={292} height={52} rx={7} fill="hsl(var(--background))" stroke="hsl(var(--border))" />
                          <rect x={940} y={(rightY[name] || 0) - 26} width={4} height={52} rx={7} fill={levelColor(nodeByName.get(name)?.level)} />
                          <text x={664} y={(rightY[name] || 0) - 11} fontSize="11.5" fill="currentColor">
                            <tspan x={664} dy="0">{rightLines[name]?.[0] || "Unnamed"}</tspan>
                            {rightLines[name]?.[1] ? <tspan x={664} dy="13">{rightLines[name][1]}</tspan> : null}
                            {rightLines[name]?.[2] ? <tspan x={664} dy="13">{rightLines[name][2]}</tspan> : null}
                          </text>
                          <text x={938} y={(rightY[name] || 0) + 4} textAnchor="end" fontSize="11" fill="currentColor">IN {inboundCount[name] || 0}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.integrationComplexity')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={integrationComplexityChart} layout="vertical" margin={{ left: 24, right: 10 }}>
                    <defs>
                      <linearGradient id="eaIntegrationGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis type="number" domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={220} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(label, payload) => {
                        const fullName = payload?.[0]?.payload?.fullName;
                        return typeof fullName === "string" ? fullName : String(label);
                      }}
                    />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="complexity" name={t('ea.architectureTab.complexityChartName')} radius={[6, 6, 6, 6]}>
                      {integrationComplexityChart.map((item) => (
                        <Cell key={item.name} fill={item.complexity >= 70 ? "#ef4444" : item.complexity >= 45 ? "#f59e0b" : "#6366f1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.applicationLifecycleMatrix')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lifecycleMatrix}>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis dataKey="lifecycle" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis allowDecimals={false} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {lifecycleMatrix.map((entry) => (
                        <Cell key={entry.lifecycle} fill={entry.lifecycle === "legacy" ? "#ef4444" : entry.lifecycle === "replace" ? "#f59e0b" : "#16a34a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('ea.architectureTab.applicationArchitectureWorkspace')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.applicationWorkspaceDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground [&_textarea:disabled]:bg-background [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_input:disabled]:bg-background">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.systemIntegrationInputs')}</p>
                <Label>{t('ea.architectureTab.unifiedSystemMapping')}</Label>
                <p className="text-[11px] text-muted-foreground">{t('ea.architectureTab.unifiedSystemMappingDesc')}</p>
                {(() => {
                  const applications = draft.applicationArchitecture.impactedApplications;
                  const dependencies = draft.applicationArchitecture.integrationDependencies;
                  if (applications.length === 0) {
                    return (
                      <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                        No applications are mapped in this enterprise architecture draft yet.
                      </div>
                    );
                  }
                  const rowDescriptors: Array<{ appIndex: number; dependencyIndex: number | null }> = [];
                  const normalizedApps = applications.map((application) => normalizeText(application.name).toLowerCase());
                  const usedDependencyIndexes = new Set<number>();

                  applications.forEach((application, appIndex) => {
                    const sourceKey = normalizeText(application.name).toLowerCase();
                    const dependentIndexes = dependencies
                      .map((dependency, dependencyIndex) => ({ dependency, dependencyIndex }))
                      .filter(({ dependency }) => normalizeText(dependency.source).toLowerCase() === sourceKey)
                      .map(({ dependencyIndex }) => dependencyIndex);

                    if (dependentIndexes.length === 0) {
                      rowDescriptors.push({ appIndex, dependencyIndex: null });
                    } else {
                      dependentIndexes.forEach((dependencyIndex) => {
                        usedDependencyIndexes.add(dependencyIndex);
                        rowDescriptors.push({ appIndex, dependencyIndex });
                      });
                    }
                  });

                  dependencies.forEach((dependency, dependencyIndex) => {
                    if (usedDependencyIndexes.has(dependencyIndex)) return;

                    const sourceKey = normalizeText(dependency.source).toLowerCase();
                    const targetKey = normalizeText(dependency.target).toLowerCase();
                    let appIndex = normalizedApps.findIndex((name) => name === sourceKey || name === targetKey);
                    if (appIndex < 0) {
                      appIndex = dependencyIndex % Math.max(1, applications.length);
                    }

                    rowDescriptors.push({ appIndex, dependencyIndex });
                  });

                  return (
                    <>
                      <div className="rounded-md border overflow-x-auto">
                        <Table className={`${EA_TABLE_CLASS} min-w-[1100px] table-fixed`}>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-[220px]">{t('ea.architectureTab.application')}</TableHead>
                              <TableHead className="w-[120px]">{t('ea.architectureTab.criticality')}</TableHead>
                              <TableHead className="w-[110px]">{t('ea.architectureTab.impact')}</TableHead>
                              <TableHead className="w-[110px]">{t('ea.architectureTab.lifecycle')}</TableHead>
                              <TableHead className="w-[260px]">{t('ea.architectureTab.integratedWith')}</TableHead>
                              <TableHead className="w-[120px]">{t('ea.architectureTab.complexityPct')}</TableHead>
                              <TableHead className="w-[100px]">{t('ea.architectureTab.apiCount')}</TableHead>
                              <TableHead className="w-14" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                          {rowDescriptors.map((descriptor, rowIndex) => {
                            const app = applications[descriptor.appIndex];
                            if (!app) return null;
                            const dependency =
                              descriptor.dependencyIndex === null
                                ? null
                                : dependencies[descriptor.dependencyIndex];

                            return (
                              <TableRow key={`mapped-row-${descriptor.appIndex}-${descriptor.dependencyIndex ?? "none"}-${rowIndex}`} className="hover:bg-muted/20">
                                <TableCell className="p-1.5 align-top">
                                  <Input
                                    className="bg-background text-foreground h-8"
                                    disabled={!isEditMode}
                                    value={app.name}
                                    onChange={(event) => {
                                      const nextName = event.target.value;
                                      updateDraft((current) => {
                                        const previousName = current.applicationArchitecture.impactedApplications[descriptor.appIndex]?.name ?? "";
                                        return {
                                          ...current,
                                          applicationArchitecture: {
                                            ...current.applicationArchitecture,
                                            impactedApplications: current.applicationArchitecture.impactedApplications.map((item, itemIndex) =>
                                              itemIndex === descriptor.appIndex ? { ...item, name: nextName } : item
                                            ),
                                            integrationDependencies: current.applicationArchitecture.integrationDependencies.map((item) =>
                                              item.source === previousName ? { ...item, source: nextName } : item
                                            ),
                                          },
                                        };
                                      }, { field: "applicationArchitecture.impactedApplications" });
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {isEditMode ? (
                                    <Select
                                      disabled={!isEditMode}
                                      value={app.criticality}
                                      onValueChange={(value) => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          impactedApplications: current.applicationArchitecture.impactedApplications.map((item, itemIndex) =>
                                            itemIndex === descriptor.appIndex ? { ...item, criticality: value as ImpactLevel } : item
                                          ),
                                        },
                                      }), { field: "applicationArchitecture.impactedApplications" })}
                                    >
                                      <SelectTrigger className="bg-background text-foreground h-8"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">{t('ea.architectureTab.low')}</SelectItem>
                                        <SelectItem value="medium">{t('ea.architectureTab.medium')}</SelectItem>
                                        <SelectItem value="high">{t('ea.architectureTab.high')}</SelectItem>
                                        <SelectItem value="critical">{t('ea.architectureTab.critical')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className={`${impactBadgeClass(app.criticality)} whitespace-nowrap`}>{app.criticality.toUpperCase()}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {isEditMode ? (
                                    <Select
                                      disabled={!isEditMode}
                                      value={app.impactLevel}
                                      onValueChange={(value) => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          impactedApplications: current.applicationArchitecture.impactedApplications.map((item, itemIndex) =>
                                            itemIndex === descriptor.appIndex ? { ...item, impactLevel: value as ImpactLevel } : item
                                          ),
                                        },
                                      }), { field: "applicationArchitecture.impactedApplications" })}
                                    >
                                      <SelectTrigger className="bg-background text-foreground h-8"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">{t('ea.architectureTab.low')}</SelectItem>
                                        <SelectItem value="medium">{t('ea.architectureTab.medium')}</SelectItem>
                                        <SelectItem value="high">{t('ea.architectureTab.high')}</SelectItem>
                                        <SelectItem value="critical">{t('ea.architectureTab.critical')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className={`${impactBadgeClass(app.impactLevel)} whitespace-nowrap`}>{app.impactLevel.toUpperCase()}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {isEditMode ? (
                                    <Select
                                      disabled={!isEditMode}
                                      value={app.lifecycle}
                                      onValueChange={(value) => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          impactedApplications: current.applicationArchitecture.impactedApplications.map((item, itemIndex) =>
                                            itemIndex === descriptor.appIndex ? { ...item, lifecycle: value as AppLifecycle } : item
                                          ),
                                        },
                                      }), { field: "applicationArchitecture.impactedApplications" })}
                                    >
                                      <SelectTrigger className="bg-background text-foreground h-8"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">{t('ea.architectureTab.active')}</SelectItem>
                                        <SelectItem value="legacy">{t('ea.architectureTab.legacy')}</SelectItem>
                                        <SelectItem value="replace">{t('ea.architectureTab.replace')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className={`${lifecycleBadgeClass(app.lifecycle)} whitespace-nowrap`}>{app.lifecycle.toUpperCase()}</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {dependency ? (
                                    <Input
                                      className="bg-background text-foreground h-8"
                                      disabled={!isEditMode}
                                      value={dependency.target}
                                      onChange={(event) => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          integrationDependencies: current.applicationArchitecture.integrationDependencies.map((item, itemIndex) =>
                                            itemIndex === descriptor.dependencyIndex ? { ...item, target: event.target.value } : item
                                          ),
                                        },
                                      }), { field: "applicationArchitecture.integrationDependencies" })}
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs">{t('ea.architectureTab.noLinkedIntegration')}</Badge>
                                      {isEditMode && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => updateDraft((current) => {
                                            const currentApp = current.applicationArchitecture.impactedApplications[descriptor.appIndex];
                                            const fallbackTarget =
                                              current.applicationArchitecture.impactedApplications.find((item, idx) => idx !== descriptor.appIndex)?.name || currentApp?.name || "Target";
                                            return {
                                              ...current,
                                              applicationArchitecture: {
                                                ...current.applicationArchitecture,
                                                integrationDependencies: [
                                                  ...current.applicationArchitecture.integrationDependencies,
                                                  {
                                                    source: currentApp?.name || `Application ${descriptor.appIndex + 1}`,
                                                    target: fallbackTarget,
                                                    complexityScore: 0,
                                                    apiCount: 0,
                                                  },
                                                ],
                                              },
                                            };
                                          }, { field: "applicationArchitecture.integrationDependencies" })}
                                        >
                                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('ea.architectureTab.link')}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {dependency ? (
                                    isEditMode ? (
                                      <Input
                                        className="bg-background text-foreground h-8"
                                        disabled={!isEditMode}
                                        value={dependency.complexityScore}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          applicationArchitecture: {
                                            ...current.applicationArchitecture,
                                            integrationDependencies: current.applicationArchitecture.integrationDependencies.map((item, itemIndex) =>
                                              itemIndex === descriptor.dependencyIndex
                                                ? { ...item, complexityScore: parseNumeric(event.target.value, item.complexityScore) }
                                                : item
                                            ),
                                          },
                                        }), { field: "applicationArchitecture.integrationDependencies" })}
                                      />
                                    ) : (
                                      <Badge variant="outline" className={`${scoreClass(dependency.complexityScore)} whitespace-nowrap`}>{dependency.complexityScore}%</Badge>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 align-top">
                                  {dependency ? (
                                    <Input
                                      className="bg-background text-foreground h-8"
                                      disabled={!isEditMode}
                                      value={dependency.apiCount}
                                      onChange={(event) => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          integrationDependencies: current.applicationArchitecture.integrationDependencies.map((item, itemIndex) =>
                                            itemIndex === descriptor.dependencyIndex
                                              ? { ...item, apiCount: Math.max(0, Math.round(Number(event.target.value) || 0)) }
                                              : item
                                          ),
                                        },
                                      }), { field: "applicationArchitecture.integrationDependencies" })}
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="p-1.5 text-right align-top">
                                  {dependency ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={!isEditMode}
                                      onClick={() => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          integrationDependencies: current.applicationArchitecture.integrationDependencies.filter((_, itemIndex) => itemIndex !== descriptor.dependencyIndex),
                                        },
                                      }), { field: "applicationArchitecture.integrationDependencies" })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={!isEditMode || draft.applicationArchitecture.impactedApplications.length <= 1}
                                      onClick={() => updateDraft((current) => ({
                                        ...current,
                                        applicationArchitecture: {
                                          ...current.applicationArchitecture,
                                          impactedApplications: current.applicationArchitecture.impactedApplications.filter((_, itemIndex) => itemIndex !== descriptor.appIndex),
                                        },
                                      }), { field: "applicationArchitecture.impactedApplications" })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isEditMode}
                          onClick={() => updateDraft((current) => ({
                            ...current,
                            applicationArchitecture: {
                              ...current.applicationArchitecture,
                              impactedApplications: [
                                ...current.applicationArchitecture.impactedApplications,
                                {
                                  name: "",
                                  criticality: "medium",
                                  impactLevel: "medium",
                                  lifecycle: "active",
                                },
                              ],
                            },
                          }), { field: "applicationArchitecture.impactedApplications" })}
                        >
                          <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addApplication')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isEditMode}
                          onClick={() => updateDraft((current) => ({
                            ...current,
                            applicationArchitecture: {
                              ...current.applicationArchitecture,
                              integrationDependencies: [
                                ...current.applicationArchitecture.integrationDependencies,
                                {
                                  source: current.applicationArchitecture.impactedApplications[0]?.name || "",
                                  target: "",
                                  complexityScore: 0,
                                  apiCount: 0,
                                },
                              ],
                            },
                          }), { field: "applicationArchitecture.integrationDependencies" })}
                        >
                          <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addIntegration')}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.deliveryReadinessInputs')}</p>
                <SingleColumnTableEditor
                  label={t('ea.architectureTab.newSystemRequirements')}
                  values={draft.applicationArchitecture.newSystemRequirements}
                  disabled={!isEditMode}
                  itemName="Requirement"
                  onChange={(next) => updateDraft((current) => ({
                    ...current,
                    applicationArchitecture: {
                      ...current.applicationArchitecture,
                      newSystemRequirements: next,
                    },
                  }), { field: "applicationArchitecture.newSystemRequirements" })}
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.integrationRiskScorePct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.applicationArchitecture.integrationRiskScore}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        applicationArchitecture: {
                          ...current.applicationArchitecture,
                          integrationRiskScore: parseNumeric(event.target.value, current.applicationArchitecture.integrationRiskScore),
                        },
                      }), { recalculate: false, field: "applicationArchitecture.integrationRiskScore" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.apiComplexityScorePct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.applicationArchitecture.apiComplexityScore}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        applicationArchitecture: {
                          ...current.applicationArchitecture,
                          apiComplexityScore: parseNumeric(event.target.value, current.applicationArchitecture.apiComplexityScore),
                        },
                      }), { recalculate: false, field: "applicationArchitecture.apiComplexityScore" })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4 flex-1 w-full max-w-full min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background/40 p-3">
          <SpineTraceabilityStrip spine={draft.spine} tab="data" />
          <SpineEntityCards spine={draft.spine} tab="data" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label={t('ea.architectureTab.dataDomains')} value={draft.dataArchitecture.dataDomains.length} subtitle={t('ea.architectureTab.governedDataScope')} />
            <KpiTile label={t('ea.architectureTab.dataSensitivity')} value={`${draft.dataArchitecture.dataSensitivityRisk}%`} subtitle={t('ea.architectureTab.domainAverage')} />
            <KpiTile label={t('ea.architectureTab.piiExposure')} value={`${Math.round(draft.dataArchitecture.dataDomains.reduce((sum, domain) => sum + domain.piiExposureRisk, 0) / Math.max(1, draft.dataArchitecture.dataDomains.length))}%`} subtitle={t('ea.architectureTab.privacyRisk')} />
            <KpiTile label={t('ea.architectureTab.retentionTriggers')} value={draft.dataArchitecture.retentionPolicyTriggers.length} subtitle={t('ea.architectureTab.policyEvents')} />
          </div>

          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" />
                {t('ea.architectureTab.dataSensitivityMap')}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="w-full max-w-full overflow-x-auto">
                <div className="min-w-[560px] grid rounded-lg border bg-background/70 shadow-sm overflow-hidden" style={{ gridTemplateColumns: "220px repeat(3, minmax(100px, 1fr))" }}>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-b bg-muted/40">{t('ea.architectureTab.dataDomain')}</div>
                  <div className="p-2 text-xs font-semibold text-center border-b bg-muted/40">{t('ea.architectureTab.sensitivity')}</div>
                  <div className="p-2 text-xs font-semibold text-center border-b bg-muted/40">{t('ea.architectureTab.piiRisk')}</div>
                  <div className="p-2 text-xs font-semibold text-center border-b bg-muted/40">{t('ea.architectureTab.crossBorder')}</div>

                  {draft.dataArchitecture.dataDomains.map((domain) => (
                    <Fragment key={domain.name}>
                      <div key={`${domain.name}-name`} className="p-2 text-xs border-b font-medium">{domain.name}</div>
                      <div key={`${domain.name}-s`} className={`p-2 text-xs text-center border-b border-l ${scoreClass(domain.sensitivityScore)}`}>{domain.sensitivityScore}</div>
                      <div key={`${domain.name}-p`} className={`p-2 text-xs text-center border-b border-l ${scoreClass(domain.piiExposureRisk)}`}>{domain.piiExposureRisk}</div>
                      <div key={`${domain.name}-c`} className={`p-2 text-xs text-center border-b border-l ${scoreClass(domain.crossBorderRisk)}`}>{domain.crossBorderRisk}</div>
                    </Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.dataRiskProfile')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataSensitivityChart} layout="vertical" margin={{ left: 24, right: 10 }}>
                    <defs>
                      <linearGradient id="eaDataSensitivityGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#0891b2" />
                      </linearGradient>
                      <linearGradient id="eaDataPiiGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis type="number" domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={220} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(label, payload) => {
                        const fullName = payload?.[0]?.payload?.fullName;
                        return typeof fullName === "string" ? fullName : String(label);
                      }}
                    />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sensitivity" fill="url(#eaDataSensitivityGradient)" radius={[5, 5, 5, 5]} />
                    <Bar dataKey="pii" fill="url(#eaDataPiiGradient)" radius={[5, 5, 5, 5]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.piiExposureIndicator')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[{
                      name: "PII Risk",
                      value: Math.round(
                        draft.dataArchitecture.dataDomains.reduce((sum, domain) => sum + domain.piiExposureRisk, 0) /
                          Math.max(1, draft.dataArchitecture.dataDomains.length)
                      ),
                    }]}
                    layout="vertical"
                    margin={{ left: 20, right: 20, top: 20, bottom: 12 }}
                  >
                    <defs>
                      <linearGradient id="eaDataPiiGaugeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" hide />
                    <ReferenceArea x1={0} x2={30} fill="#dcfce7" fillOpacity={0.45} />
                    <ReferenceArea x1={30} x2={65} fill="#fef3c7" fillOpacity={0.45} />
                    <ReferenceArea x1={65} x2={100} fill="#fee2e2" fillOpacity={0.55} />
                    <ReferenceLine x={65} stroke="#dc2626" strokeDasharray="4 3" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill="url(#eaDataPiiGaugeGradient)" radius={[8, 8, 8, 8]} barSize={34} />
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} payload={[
                      { value: t('ea.architectureTab.legendControlled'), type: "square", color: "#dcfce7" },
                      { value: t('ea.architectureTab.legendWatch'), type: "square", color: "#fef3c7" },
                      { value: t('ea.architectureTab.legendHigh'), type: "square", color: "#fee2e2" },
                    ]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('ea.architectureTab.dataArchitectureWorkspace')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.dataWorkspaceDesc')}</p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground [&_textarea:disabled]:bg-background [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_input:disabled]:bg-background">
              <div className="w-full min-w-0 rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.dataDomainInputs')}</p>
                <p className="text-[11px] text-muted-foreground">{t('ea.architectureTab.unifiedGovernanceMatrix')}</p>
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200">
                    {t('ea.architectureTab.aiBaselineSource', { generatedAt: generatedAtLabel })}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || !canGenerateEnterpriseArchitecture || isEditMode}
                  >
                    {generateMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    {t('ea.architectureTab.refreshFromAiSource')}
                  </Button>
                </div>
                {(() => {
                  const getDomainKey = (name: string, index: number) => (name.trim() || `Domain ${index + 1}`);
                  const getDomainTriggers = (domainName: string, index: number) => {
                    const key = getDomainKey(domainName, index).toLowerCase();
                    const prefix = `${key}:`;
                    return draft.dataArchitecture.retentionPolicyTriggers
                      .filter((trigger) => trigger.toLowerCase().startsWith(prefix))
                      .map((trigger) => trigger.slice(prefix.length).trim())
                      .filter(Boolean);
                  };

                  const updateDomainTriggers = (domainName: string, index: number, rawValue: string) => {
                    const nextTriggers = fromLines(rawValue);

                    updateDraft((current) => {
                      const liveDomainName = current.dataArchitecture.dataDomains[index]?.name ?? domainName;
                      const liveDomainKey = getDomainKey(liveDomainName, index);
                      const livePrefix = `${liveDomainKey.toLowerCase()}:`;

                      const retained = current.dataArchitecture.retentionPolicyTriggers.filter(
                        (trigger) => !trigger.toLowerCase().startsWith(livePrefix)
                      );

                      const scoped = nextTriggers.map((trigger) => `${liveDomainKey}: ${trigger}`);

                      return {
                        ...current,
                        dataArchitecture: {
                          ...current.dataArchitecture,
                          retentionPolicyTriggers: [...retained, ...scoped],
                        },
                      };
                    }, { field: "dataArchitecture.retentionPolicyTriggers" });
                  };

                  return (
                    <>
                      <div className="w-full min-w-0 max-w-full rounded-md border overflow-x-auto">
                        <Table className={`${EA_TABLE_CLASS} min-w-[1080px] table-fixed`}>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-[320px]">{t('ea.architectureTab.domain')}</TableHead>
                              <TableHead className="w-[120px]">{t('ea.architectureTab.class')}</TableHead>
                              <TableHead className="w-[110px]">{t('ea.architectureTab.sensitivityPct')}</TableHead>
                              <TableHead className="w-[90px]">{t('ea.architectureTab.piiPct')}</TableHead>
                              <TableHead className="w-[120px]">{t('ea.architectureTab.crossBorderPct')}</TableHead>
                              <TableHead>{t('ea.architectureTab.retentionTriggersMapped')}</TableHead>
                              <TableHead className="w-14" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.dataArchitecture.dataDomains.map((domain, index) => {
                              const mappedTriggers = getDomainTriggers(domain.name, index);
                              return (
                                <TableRow key={`data-domain-${index}`} className="hover:bg-muted/20">
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Textarea
                                        className="bg-background text-foreground min-h-[72px] resize-y leading-5"
                                        disabled={!isEditMode}
                                        value={domain.name}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          dataArchitecture: {
                                            ...current.dataArchitecture,
                                            dataDomains: current.dataArchitecture.dataDomains.map((item, itemIndex) =>
                                              itemIndex === index ? { ...item, name: event.target.value } : item
                                            ),
                                          },
                                        }), { field: "dataArchitecture.dataDomains" })}
                                        placeholder={t('ea.architectureTab.domainNamePlaceholder')}
                                      />
                                    ) : (
                                      <div className="text-sm leading-5 whitespace-pre-wrap break-words py-1">
                                        {domain.name || "—"}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Select
                                        disabled={!isEditMode}
                                        value={domain.classification}
                                        onValueChange={(value) => updateDraft((current) => ({
                                          ...current,
                                          dataArchitecture: {
                                            ...current.dataArchitecture,
                                            dataDomains: current.dataArchitecture.dataDomains.map((item, itemIndex) =>
                                              itemIndex === index ? { ...item, classification: value as DataClass } : item
                                            ),
                                          },
                                        }), { field: "dataArchitecture.dataDomains" })}
                                      >
                                        <SelectTrigger className="bg-background text-foreground h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="public">{t('ea.architectureTab.public')}</SelectItem>
                                          <SelectItem value="internal">{t('ea.architectureTab.internal')}</SelectItem>
                                          <SelectItem value="confidential">{t('ea.architectureTab.confidential')}</SelectItem>
                                          <SelectItem value="restricted">{t('ea.architectureTab.restricted')}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge variant="outline" className={dataClassBadgeClass(domain.classification)}>{domain.classification.toUpperCase()}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Input
                                        className="bg-background text-foreground h-8"
                                        disabled={!isEditMode}
                                        value={domain.sensitivityScore}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          dataArchitecture: {
                                            ...current.dataArchitecture,
                                            dataDomains: current.dataArchitecture.dataDomains.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? { ...item, sensitivityScore: parseNumeric(event.target.value, item.sensitivityScore) }
                                                : item
                                            ),
                                          },
                                        }), { field: "dataArchitecture.dataDomains" })}
                                      />
                                    ) : (
                                      <Badge variant="outline" className={scoreClass(domain.sensitivityScore)}>{domain.sensitivityScore}%</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Input
                                        className="bg-background text-foreground h-8"
                                        disabled={!isEditMode}
                                        value={domain.piiExposureRisk}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          dataArchitecture: {
                                            ...current.dataArchitecture,
                                            dataDomains: current.dataArchitecture.dataDomains.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? { ...item, piiExposureRisk: parseNumeric(event.target.value, item.piiExposureRisk) }
                                                : item
                                            ),
                                          },
                                        }), { field: "dataArchitecture.dataDomains" })}
                                      />
                                    ) : (
                                      <Badge variant="outline" className={scoreClass(domain.piiExposureRisk)}>{domain.piiExposureRisk}%</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Input
                                        className="bg-background text-foreground h-8"
                                        disabled={!isEditMode}
                                        value={domain.crossBorderRisk}
                                        onChange={(event) => updateDraft((current) => ({
                                          ...current,
                                          dataArchitecture: {
                                            ...current.dataArchitecture,
                                            dataDomains: current.dataArchitecture.dataDomains.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? { ...item, crossBorderRisk: parseNumeric(event.target.value, item.crossBorderRisk) }
                                                : item
                                            ),
                                          },
                                        }), { field: "dataArchitecture.dataDomains" })}
                                      />
                                    ) : (
                                      <Badge variant="outline" className={scoreClass(domain.crossBorderRisk)}>{domain.crossBorderRisk}%</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 align-top">
                                    {isEditMode ? (
                                      <Textarea
                                        className="bg-background text-foreground min-h-[108px] resize-y whitespace-pre-wrap leading-5 text-sm"
                                        disabled={!isEditMode}
                                        value={toLines(mappedTriggers)}
                                        onChange={(event) => updateDomainTriggers(domain.name, index, event.target.value)}
                                        placeholder={t('ea.architectureTab.oneTriggerPerLine')}
                                      />
                                    ) : mappedTriggers.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {mappedTriggers.map((trigger) => (
                                          <Badge key={`${domain.name}-${trigger}`} variant="outline" className="bg-emerald-500/10 text-emerald-800 border-emerald-400/30 dark:text-emerald-200">
                                            {trigger}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">{t('ea.architectureTab.noMappedTriggers')}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-1.5 text-right align-top">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={!isEditMode || draft.dataArchitecture.dataDomains.length <= 1}
                                      onClick={() => updateDraft((current) => ({
                                        ...current,
                                        dataArchitecture: {
                                          ...current.dataArchitecture,
                                          dataDomains: current.dataArchitecture.dataDomains.filter((_, itemIndex) => itemIndex !== index),
                                        },
                                      }), { field: "dataArchitecture.dataDomains" })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isEditMode}
                          onClick={() => updateDraft((current) => ({
                            ...current,
                            dataArchitecture: {
                              ...current.dataArchitecture,
                              dataDomains: [
                                ...current.dataArchitecture.dataDomains,
                                {
                                  name: "",
                                  classification: "internal",
                                  sensitivityScore: 0,
                                  piiExposureRisk: 0,
                                  crossBorderRisk: 0,
                                },
                              ],
                            },
                          }), { field: "dataArchitecture.dataDomains" })}
                        >
                          <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addDomain')}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.governanceInputs')}</p>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.governanceActions')}
                    values={draft.dataArchitecture.governanceActions}
                    disabled={!isEditMode}
                    itemName="Action"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      dataArchitecture: {
                        ...current.dataArchitecture,
                        governanceActions: next,
                      },
                    }), { field: "dataArchitecture.governanceActions" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.dataFlowNotes')}
                    values={draft.dataArchitecture.dataFlowNotes}
                    disabled={!isEditMode}
                    itemName="Note"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      dataArchitecture: {
                        ...current.dataArchitecture,
                        dataFlowNotes: next,
                      },
                    }), { field: "dataArchitecture.dataFlowNotes" })}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="space-y-1">
                  <Label>{t('ea.architectureTab.dataSensitivityRiskPct')}</Label>
                  <Input
                    disabled={!isEditMode}
                    value={draft.dataArchitecture.dataSensitivityRisk}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      dataArchitecture: {
                        ...current.dataArchitecture,
                        dataSensitivityRisk: parseNumeric(event.target.value, current.dataArchitecture.dataSensitivityRisk),
                      },
                    }), { recalculate: false, field: "dataArchitecture.dataSensitivityRisk" })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technology" className="mt-4 flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background/40 p-3">
          <SpineTraceabilityStrip spine={draft.spine} tab="technology" />
          <SpineEntityCards spine={draft.spine} tab="technology" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label={t('ea.architectureTab.cloudAlignment')} value={`${draft.technologyArchitecture.cloudAlignmentScore}%`} subtitle={t('ea.architectureTab.targetCloudPosture')} />
            <KpiTile label={t('ea.architectureTab.securityBaseline')} value={`${draft.technologyArchitecture.securityBaselineCompliance}%`} subtitle={t('ea.architectureTab.controlAdherence')} />
            <KpiTile label={t('ea.architectureTab.devOpsCompatibility')} value={`${draft.technologyArchitecture.devOpsCompatibility}%`} subtitle={t('ea.architectureTab.deliveryReadiness')} />
            <KpiTile label={t('ea.architectureTab.policyDeviations')} value={draft.technologyArchitecture.policyDeviationFlags.length} subtitle={t('ea.architectureTab.deviationFlags')} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-600" />
                {t('ea.architectureTab.layeredTechStackView')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {technologyLayers.map(([label, items]) => (
                <div key={label} className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{label}</p>
                    <Badge variant="outline">{(items as string[]).length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(items as string[]).map((item) => (
                      <Badge key={`${label}-${item}`} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                    {(items as string[]).length === 0 ? <p className="text-xs text-muted-foreground">{t('ea.architectureTab.noItemsYet')}</p> : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.technologyAlignmentIndicators')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={technologyScoreChart}>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis dataKey="name" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="value" name={t('ea.architectureTab.alignmentScoreChartName')} radius={[6, 6, 0, 0]}>
                      {technologyScoreChart.map((item) => (
                        <Cell key={item.name} fill={item.value >= 70 ? "#16a34a" : item.value >= 45 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.securityComplianceRadar')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={technologyRadar}>
                    <PolarGrid stroke={CHART_GRID_COLOR} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: CHART_AXIS_COLOR, fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('ea.architectureTab.technologyArchitectureWorkspace')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.technologyWorkspaceDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground [&_textarea:disabled]:bg-background [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_input:disabled]:bg-background">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.layerByLayerStackInputs')}</p>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.presentationLayer')}
                    values={draft.technologyArchitecture.stackLayers.presentation}
                    disabled={!isEditMode}
                    itemName="Presentation Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          presentation: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.presentation" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.applicationLayer')}
                    values={draft.technologyArchitecture.stackLayers.application}
                    disabled={!isEditMode}
                    itemName="Application Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          application: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.application" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.integrationLayer')}
                    values={draft.technologyArchitecture.stackLayers.integration}
                    disabled={!isEditMode}
                    itemName="Integration Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          integration: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.integration" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.dataLayer')}
                    values={draft.technologyArchitecture.stackLayers.data}
                    disabled={!isEditMode}
                    itemName="Data Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          data: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.data" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.infrastructureLayer')}
                    values={draft.technologyArchitecture.stackLayers.infrastructure}
                    disabled={!isEditMode}
                    itemName="Infrastructure Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          infrastructure: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.infrastructure" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.securityLayer')}
                    values={draft.technologyArchitecture.stackLayers.security}
                    disabled={!isEditMode}
                    itemName="Security Item"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        stackLayers: {
                          ...current.technologyArchitecture.stackLayers,
                          security: next,
                        },
                      },
                    }), { field: "technologyArchitecture.stackLayers.security" })}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.governanceImpactInputs')}</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.aiEngineUsage')}
                    values={draft.technologyArchitecture.aiEngineUsage}
                    disabled={!isEditMode}
                    itemName="AI Usage"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        aiEngineUsage: next,
                      },
                    }), { field: "technologyArchitecture.aiEngineUsage" })}
                  />
                  <SingleColumnTableEditor
                    label={t('ea.architectureTab.policyDeviationFlags')}
                    values={draft.technologyArchitecture.policyDeviationFlags}
                    disabled={!isEditMode}
                    itemName="Policy Flag"
                    onChange={(next) => updateDraft((current) => ({
                      ...current,
                      technologyArchitecture: {
                        ...current.technologyArchitecture,
                        policyDeviationFlags: next,
                      },
                    }), { field: "technologyArchitecture.policyDeviationFlags" })}
                  />
                  <div className="lg:col-span-2">
                    <SingleColumnTableEditor
                      label={t('ea.architectureTab.infrastructureImpact')}
                      values={draft.technologyArchitecture.infrastructureImpact}
                      disabled={!isEditMode}
                      itemName="Impact Item"
                      onChange={(next) => updateDraft((current) => ({
                        ...current,
                        technologyArchitecture: {
                          ...current.technologyArchitecture,
                          infrastructureImpact: next,
                        },
                      }), { field: "technologyArchitecture.infrastructureImpact" })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.cloudAlignmentPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.technologyArchitecture.cloudAlignmentScore}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        technologyArchitecture: {
                          ...current.technologyArchitecture,
                          cloudAlignmentScore: parseNumeric(event.target.value, current.technologyArchitecture.cloudAlignmentScore),
                        },
                      }), { field: "technologyArchitecture.cloudAlignmentScore" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.securityBaselinePct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.technologyArchitecture.securityBaselineCompliance}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        technologyArchitecture: {
                          ...current.technologyArchitecture,
                          securityBaselineCompliance: parseNumeric(event.target.value, current.technologyArchitecture.securityBaselineCompliance),
                        },
                      }), { field: "technologyArchitecture.securityBaselineCompliance" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.devOpsCompatibilityPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.technologyArchitecture.devOpsCompatibility}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        technologyArchitecture: {
                          ...current.technologyArchitecture,
                          devOpsCompatibility: parseNumeric(event.target.value, current.technologyArchitecture.devOpsCompatibility),
                        },
                      }), { field: "technologyArchitecture.devOpsCompatibility" })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4 flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background/40 p-3">
          <SpineTraceabilityStrip spine={draft.spine} tab="risk" />
          <SpineTraceabilityPanel spine={draft.spine} />
          <SpineExplainableScores spine={draft.spine} />
          <SpineWhatIfSimulator spine={draft.spine} />
          <SpineEntityCards spine={draft.spine} tab="risk" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiTile label={t('ea.architectureTab.complexity')} value={`${draft.riskImpactDashboard.architectureComplexityScore}%`} />
            <KpiTile label={t('ea.architectureTab.integration')} value={`${draft.riskImpactDashboard.integrationRiskScore}%`} />
            <KpiTile label={t('ea.architectureTab.dataRisk')} value={`${draft.riskImpactDashboard.dataSensitivityRisk}%`} />
            <KpiTile label={t('ea.architectureTab.policyFlags')} value={draft.riskImpactDashboard.policyDeviationFlags} />
            <KpiTile label={t('ea.architectureTab.alignment')} value={`${draft.riskImpactDashboard.targetArchitectureAlignment}%`} />
            <KpiTile label={t('ea.architectureTab.techDebt')} value={`${draft.riskImpactDashboard.technicalDebtExposure}%`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-rose-600" />
                {t('ea.architectureTab.architectureRiskProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={riskRadar}>
                  <PolarGrid stroke={CHART_GRID_COLOR} />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: CHART_AXIS_COLOR, fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.riskTrendOverTime')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={draft.riskImpactDashboard.riskTrend}>
                    <defs>
                      <linearGradient id="eaRiskTrendArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" opacity={0.45} />
                    <XAxis dataKey="label" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="value" name={t('ea.architectureTab.riskLevelChartName')} stroke="#e11d48" strokeWidth={2.5} fill="url(#eaRiskTrendArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-background">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ea.architectureTab.targetArchitectureAlignment')}</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="60%" outerRadius="100%" data={alignmentGauge} startAngle={180} endAngle={0}>
                    <defs>
                      <linearGradient id="eaAlignmentGaugeGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                    </defs>
                    <RadialBar dataKey="value" cornerRadius={10} fill="url(#eaAlignmentGaugeGradient)" />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {t('ea.architectureTab.governanceGateControls')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('ea.architectureTab.governanceGateControlsDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:text-foreground [&_textarea:disabled]:bg-background [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_input:disabled]:bg-background">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={riskBadgeVariant(draft.riskImpactDashboard.overallRiskLevel)}>
                  {t('ea.architectureTab.overallRisk')}: {draft.riskImpactDashboard.overallRiskLevel.toUpperCase()}
                </Badge>
                <Badge variant={draft.governance.status === "approved" ? "default" : "secondary"}>
                  {t('ea.architectureTab.eaStatus')}: {draft.governance.status.toUpperCase()}
                </Badge>
                {draft.governance.status !== "approved" ? (
                  <Badge variant="destructive">{t('ea.architectureTab.implementationBlocked')}</Badge>
                ) : (
                  <Badge variant="default">{t('ea.architectureTab.eaGateCleared')}</Badge>
                )}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.governanceOwnership')}</p>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.governanceStatus')}</Label>
                    <Select
                      disabled={!isEditMode}
                      value={draft.governance.status}
                      onValueChange={(value) => updateDraft((current) => ({
                        ...current,
                        governance: {
                          ...current.governance,
                          status: value as EnterpriseArchitectureArtifact["governance"]["status"],
                        },
                      }), { recalculate: false, field: "governance.status" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('ea.architectureTab.selectStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t('ea.architectureTab.draft')}</SelectItem>
                        <SelectItem value="review">{t('ea.architectureTab.review')}</SelectItem>
                        <SelectItem value="approved">{t('ea.architectureTab.approved')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.architectOwner')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.governance.architectOwner || ""}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        governance: {
                          ...current.governance,
                          architectOwner: event.target.value,
                        },
                      }), { recalculate: false, field: "governance.architectOwner" })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.riskPostureSettings')}</p>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.overallRiskLevel')}</Label>
                    <Select
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.overallRiskLevel}
                      onValueChange={(value) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          overallRiskLevel: value as EnterpriseArchitectureArtifact["riskImpactDashboard"]["overallRiskLevel"],
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.overallRiskLevel" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('ea.architectureTab.selectRiskLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t('ea.architectureTab.low')}</SelectItem>
                        <SelectItem value="medium">{t('ea.architectureTab.medium')}</SelectItem>
                        <SelectItem value="high">{t('ea.architectureTab.high')}</SelectItem>
                        <SelectItem value="critical">{t('ea.architectureTab.critical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.reviewCadence')}</Label>
                    <Textarea
                      disabled={!isEditMode}
                      rows={2}
                      value={draft.governance.reviewCadence}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        governance: {
                          ...current.governance,
                          reviewCadence: event.target.value,
                        },
                      }), { recalculate: false, field: "governance.reviewCadence" })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.quantitativeRiskInputs')}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.architectureComplexityPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.architectureComplexityScore}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          architectureComplexityScore: parseNumeric(event.target.value, current.riskImpactDashboard.architectureComplexityScore),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.architectureComplexityScore" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.integrationRiskPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.integrationRiskScore}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          integrationRiskScore: parseNumeric(event.target.value, current.riskImpactDashboard.integrationRiskScore),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.integrationRiskScore" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.dataSensitivityRiskPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.dataSensitivityRisk}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          dataSensitivityRisk: parseNumeric(event.target.value, current.riskImpactDashboard.dataSensitivityRisk),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.dataSensitivityRisk" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.policyFlagsCount')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.policyDeviationFlags}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          policyDeviationFlags: Math.max(0, Math.round(Number(event.target.value) || 0)),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.policyDeviationFlags" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.targetAlignmentPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.targetArchitectureAlignment}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          targetArchitectureAlignment: parseNumeric(event.target.value, current.riskImpactDashboard.targetArchitectureAlignment),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.targetArchitectureAlignment" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.technicalDebtPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.technicalDebtExposure}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          technicalDebtExposure: parseNumeric(event.target.value, current.riskImpactDashboard.technicalDebtExposure),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.technicalDebtExposure" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('ea.architectureTab.strategicMisalignmentPct')}</Label>
                    <Input
                      disabled={!isEditMode}
                      value={draft.riskImpactDashboard.strategicMisalignmentRisk}
                      onChange={(event) => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          strategicMisalignmentRisk: parseNumeric(event.target.value, current.riskImpactDashboard.strategicMisalignmentRisk),
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.strategicMisalignmentRisk" })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('ea.architectureTab.gateNarrativeInputs')}</p>
                <div className="space-y-1">
                  <Label>{t('ea.architectureTab.gateDecision')}</Label>
                  <Textarea
                    disabled={!isEditMode}
                    rows={2}
                    value={draft.governance.gateDecision}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      governance: {
                        ...current.governance,
                        gateDecision: event.target.value,
                      },
                    }), { recalculate: false, field: "governance.gateDecision" })}
                  />
                </div>

                <div className="space-y-1">
                  <Label>{t('ea.architectureTab.riskTrend')}</Label>
                  <Table className={EA_TABLE_CLASS}>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>{t('ea.architectureTab.label')}</TableHead>
                        <TableHead>{t('ea.architectureTab.valuePct')}</TableHead>
                        <TableHead className="w-14" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.riskImpactDashboard.riskTrend.map((point, index) => (
                        <TableRow key={`risk-trend-${index}`} className="hover:bg-muted/20">
                          <TableCell className="p-2">
                            {isEditMode ? (
                              <Input
                                className="bg-background text-foreground"
                                disabled={!isEditMode}
                                value={point.label}
                                onChange={(event) => updateDraft((current) => ({
                                  ...current,
                                  riskImpactDashboard: {
                                    ...current.riskImpactDashboard,
                                    riskTrend: current.riskImpactDashboard.riskTrend.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, label: event.target.value } : item
                                    ),
                                  },
                                }), { recalculate: false, field: "riskImpactDashboard.riskTrend" })}
                              />
                            ) : (
                              <p className="text-sm font-medium text-foreground">{point.label || "—"}</p>
                            )}
                          </TableCell>
                          <TableCell className="p-2">
                            {isEditMode ? (
                              <Input
                                className="bg-background text-foreground"
                                disabled={!isEditMode}
                                value={point.value}
                                onChange={(event) => updateDraft((current) => ({
                                  ...current,
                                  riskImpactDashboard: {
                                    ...current.riskImpactDashboard,
                                    riskTrend: current.riskImpactDashboard.riskTrend.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, value: parseNumeric(event.target.value, item.value) }
                                        : item
                                    ),
                                  },
                                }), { recalculate: false, field: "riskImpactDashboard.riskTrend" })}
                              />
                            ) : (
                              <Badge variant="outline" className={scoreClass(point.value)}>{point.value}%</Badge>
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!isEditMode || draft.riskImpactDashboard.riskTrend.length <= 1}
                              onClick={() => updateDraft((current) => ({
                                ...current,
                                riskImpactDashboard: {
                                  ...current.riskImpactDashboard,
                                  riskTrend: current.riskImpactDashboard.riskTrend.filter((_, itemIndex) => itemIndex !== index),
                                },
                              }), { recalculate: false, field: "riskImpactDashboard.riskTrend" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isEditMode}
                      onClick={() => updateDraft((current) => ({
                        ...current,
                        riskImpactDashboard: {
                          ...current.riskImpactDashboard,
                          riskTrend: [
                            ...current.riskImpactDashboard.riskTrend,
                            {
                              label: `Point ${current.riskImpactDashboard.riskTrend.length + 1}`,
                              value: 0,
                            },
                          ],
                        },
                      }), { recalculate: false, field: "riskImpactDashboard.riskTrend" })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> {t('ea.architectureTab.addRow')}
                    </Button>
                  </div>
                </div>

                <SingleColumnTableEditor
                  label={t('ea.architectureTab.governanceNotes')}
                  values={draft.governance.notes}
                  disabled={!isEditMode}
                  itemName="Governance Note"
                  onChange={(next) => updateDraft((current) => ({
                    ...current,
                    governance: {
                      ...current.governance,
                      notes: next,
                    },
                  }), { recalculate: false, field: "governance.notes" })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => refetch()} data-testid="button-refresh-ea">
          {t('ea.architectureTab.refreshEaData')}
        </Button>
      </div>

      <EnterpriseArchitectureVersionSheet
        open={showVersionSheet}
        onOpenChange={setShowVersionSheet}
        reportId={reportId}
        latestVersion={latestVersion}
        enterpriseVersions={enterpriseVersions}
        submitForReview={{
          isPending: submitForReview.isPending,
          run: () => submitForReview.mutate(),
        }}
        approveVersion={{
          isPending: approveVersion.isPending,
          run: () => approveVersion.mutate(),
        }}
        sendToDirector={{
          isPending: sendToDirector.isPending,
          run: () => sendToDirector.mutate(),
        }}
        finalApprove={{
          isPending: finalApprove.isPending,
          run: () => finalApprove.mutate(),
        }}
        onViewVersion={handleViewVersion}
        onCompareVersions={handleCompareVersions}
        onRestoreVersion={handleRestoreVersion}
      />

      <EnterpriseArchitectureAdvisorSheet
        open={showAdvisorDetailsPanel}
        onOpenChange={setShowAdvisorDetailsPanel}
        advisorData={advisorData}
      />

      {showVersionComparison && comparisonVersions.versionA && comparisonVersions.versionB && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto p-4">
          <VersionDiffViewer
            versionA={comparisonVersions.versionA}
            versionB={comparisonVersions.versionB}
            onClose={() => {
              setShowVersionComparison(false);
              setComparisonVersions({ versionA: null, versionB: null });
            }}
          />
        </div>
      )}

      {showVersionDialog && (
        <CreateVersionDialog
          reportId={reportId}
          contentType="enterprise_architecture"
          editedContent={draft}
          open={showVersionDialog}
          onOpenChange={setShowVersionDialog}
          initialChangesSummary={generateChangesSummary()}
          onVersionCreated={async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/ea", reportId] });
            await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "versions"], exact: false });
            setIsEditMode(false);
            setIsDirty(false);
            setChangedFields(new Set());
            setEditBaseline(null);
            toast({ title: t('ea.architectureTab.toastVersionCreated'), description: t('ea.architectureTab.toastVersionCreatedDesc') });
          }}
        />
      )}

      {showVersionDetail && selectedVersionForDetail && (
        <VersionDetailView
          open={showVersionDetail}
          onClose={() => {
            setShowVersionDetail(false);
            setSelectedVersionForDetail(null);
          }}
          version={selectedVersionForDetail}
        />
      )}

      {showRestoreDialog && (
        <VersionRestoreDialog
          open={showRestoreDialog}
          onClose={() => {
            setShowRestoreDialog(false);
            setSelectedVersionForRestore(null);
            setConflictWarnings([]);
            setIsVersionLockedForRestore(false);
          }}
          version={selectedVersionForRestore}
          currentVersion={latestVersion}
          onConfirmRestore={(versionId) => confirmRestoreVersion.mutate(versionId)}
          isRestoring={confirmRestoreVersion.isPending}
          conflictWarnings={conflictWarnings}
          isLocked={isVersionLockedForRestore}
          lockedBy={selectedVersionForRestore?.createdByName}
        />
      )}
    </div>
  );
}
