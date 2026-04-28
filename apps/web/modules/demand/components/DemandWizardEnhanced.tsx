import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm, type FieldPath, type SubmitErrorHandler, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDemandReportSchema } from "@shared/schema";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useDecisionResume } from "../hooks/useDecisionResume";
import { useAuth } from "@/contexts/AuthContext";
import { Can } from "@/components/auth/Can";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import {
  getBudgetRanges,
  getCapacityLevels,
  getComplianceStandards,
  getIndustryTypeOptions,
  getIntegrationTypes,
  getRiskCategories,
  getSteps,
  getSystemTypes,
  getTimeframeOptions,
  type StepDef,
} from "./DemandWizardEnhanced.options";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Users,
  Building2,
  Target,
  DollarSign,
  Clock,
  Loader2,
  Sparkles,
  AlertCircle,
  Shield,
  Network,
  Database,
  Zap,
  Globe,
  TrendingUp,
  UserCheck,
  Rocket,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";

type DemandFormData = z.infer<typeof insertDemandReportSchema>;

const STEP_VALIDATION_FIELDS: Partial<Record<number, FieldPath<DemandFormData>[]>> = {
  1: ["organizationName", "department", "requestorName", "requestorEmail", "urgency"],
  2: ["businessObjective"],
};

function getStepForField(fieldName: string): number {
  for (const [step, fields] of Object.entries(STEP_VALIDATION_FIELDS)) {
    if (fields?.includes(fieldName as FieldPath<DemandFormData>)) {
      return Number(step);
    }
  }

  return 1;
}

interface ClassificationResult {
  requestType: string;
  confidence: number;
  reasoning: string;
  keywords: string[];
  recommendations: string[];
  highlights: string[];
  routeSummary: string;
  source?: 'explicit' | 'analysis' | 'live';
  telemetry?: {
    engineLabel?: string;
    riskLevel?: string;
    currentLayer?: number;
    classificationLevel?: string;
  };
}

type DemandEngineTelemetry = {
  currentLayer?: unknown;
  classificationLevel?: unknown;
  riskLevel?: unknown;
  primaryEngineKind?: unknown;
  primaryPluginName?: unknown;
  usedInternalEngine?: unknown;
  usedHybridEngine?: unknown;
};

function humanizeClassification(value: string): string {
  return value.replaceAll(/[_-]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildClassificationInsights(params: {
  classification: string;
  reasoning: string;
  objective: string;
  department?: string;
  organizationName?: string;
  industryType?: string;
  urgency?: string;
}): Pick<ClassificationResult, 'keywords' | 'recommendations' | 'highlights' | 'routeSummary'> {
  const objective = params.objective.toLowerCase();
  const keywords = Array.from(new Set([
    params.department || '',
    params.organizationName || '',
    /digital twin/i.test(objective) ? 'digital twin' : '',
    /smart city|urban/i.test(objective) ? 'smart city operations' : '',
    /iot|sensor|telemetry/i.test(objective) ? 'iot telemetry' : '',
    /gis|geospatial|spatial/i.test(objective) ? 'gis and geospatial' : '',
    /emergency|incident|response/i.test(objective) ? 'emergency response' : '',
    /cross-agency|integration|shared data/i.test(objective) ? 'cross-agency integration' : '',
    params.classification === 'sovereign' || params.classification === 'top_secret' || params.classification === 'secret' ? 'sovereign controls' : '',
  ].map((item) => item.trim()).filter(Boolean)));

  const recommendations = Array.from(new Set([
    params.classification === 'sovereign' || params.classification === 'top_secret' || params.classification === 'secret'
      ? 'Route this demand through Engine A and keep all restricted context inside sovereign infrastructure.'
      : 'Confirm whether any restricted data or controls require escalation to the sovereign path.',
    params.department
      ? `Validate ${params.department} as the accountable business owner before submission.`
      : 'Confirm the accountable department and executive sponsor before finalizing the draft.',
    /cross-agency|integration|shared data/i.test(objective)
      ? 'Capture priority integrations, data owners, and inter-agency dependencies during Layer 4 review.'
      : 'Capture the main systems, dependencies, and operating constraints during Layer 4 review.',
    params.urgency && params.urgency.toLowerCase() === 'high'
      ? 'Document urgency drivers, delivery milestones, and escalation triggers to support prioritization.'
      : 'Clarify delivery timing, outcomes, and readiness assumptions to improve Brain confidence.',
  ].filter(Boolean)));

  const highlights = Array.from(new Set([
    params.classification === 'sovereign' || params.classification === 'top_secret' || params.classification === 'secret'
      ? 'Sensitive content and sovereign processing requirements increase governance, hosting, and audit expectations.'
      : 'This request can be evaluated on the standard governed path unless restricted data requirements emerge.',
    params.industryType === 'government'
      ? 'Government operating context and public-service impact increase the need for policy, records, and assurance controls.'
      : '',
    /digital twin|analytics|predictive/i.test(objective)
      ? 'The demand combines operational intelligence with shared data dependencies, so quality of source data and integration design will materially affect delivery success.'
      : '',
  ].filter(Boolean)));

  const routeSummary = params.classification === 'sovereign' || params.classification === 'top_secret' || params.classification === 'secret'
    ? 'Engine A sovereign route selected because the demand includes restricted government context and should remain on the internal reasoning path.'
    : 'Standard governed route selected based on the current business objective and context.';

  return { keywords, recommendations, highlights, routeSummary };
}

function buildExplicitClassificationResult(classification: string, context: {
  objective?: string;
  department?: string;
  organizationName?: string;
  industryType?: string;
  urgency?: string;
} = {}): ClassificationResult {
  const normalizedClassification = classification.trim().toLowerCase();
  const reasoning = `Using explicit ${humanizeClassification(normalizedClassification)} classification selected in the demand wizard.`;
  const insights = buildClassificationInsights({
    classification: normalizedClassification,
    reasoning,
    objective: context.objective || '',
    department: context.department,
    organizationName: context.organizationName,
    industryType: context.industryType,
    urgency: context.urgency,
  });

  return {
    requestType: "demand",
    confidence: 100,
    reasoning,
    ...insights,
    source: 'explicit',
  };
}

function normalizeTelemetryLabel(telemetry?: DemandEngineTelemetry | null): string | undefined {
  if (!telemetry) {
    return undefined;
  }

  if (typeof telemetry.primaryPluginName === 'string' && telemetry.primaryPluginName.trim()) {
    return telemetry.primaryPluginName.trim();
  }
  if (telemetry.usedInternalEngine === true) {
    return 'Engine A';
  }
  if (telemetry.usedHybridEngine === true) {
    return 'Hybrid Route';
  }
  if (typeof telemetry.primaryEngineKind === 'string' && telemetry.primaryEngineKind.trim()) {
    return telemetry.primaryEngineKind.trim();
  }
  return undefined;
}

const FRIENDLY_TEXTAREA_CLASSNAME = "resize-y rounded-xl border border-border/70 bg-background px-4 py-3 text-sm leading-6 shadow-sm transition focus-visible:border-emerald-300 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-emerald-500/10";

type PendingDemandGeneration = {
  decisionSpineId: string;
  businessObjective: string;
};

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "live.com",
  "outlook.com",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
]);

function titleCaseOrganizationSegment(value: string): string {
  return value
    .replaceAll(/[-_.]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inferOrganizationNameFromEmail(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return "";
  }

  if (domain === "gov.ae") {
    return "UAE Government";
  }
  if (domain.endsWith(".gov.ae")) {
    const agency = domain.replace(/\.gov\.ae$/, "").split(".").pop() || "";
    return agency ? `${titleCaseOrganizationSegment(agency)} Government` : "UAE Government";
  }

  const orgSegment = domain.split(".").find((part) => part && part !== "www" && part.length > 1) || "";
  return orgSegment ? titleCaseOrganizationSegment(orgSegment) : "";
}

function inferOrganizationNameFromUser(user: Record<string, unknown>): string {
  const explicitKeys = [
    "organizationName",
    "organization",
    "companyName",
    "company",
    "agencyName",
    "tenantName",
  ];

  for (const key of explicitKeys) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const email = typeof user.email === "string" ? user.email : "";
  return inferOrganizationNameFromEmail(email);
}

function normalizeDemandClassificationForBrain(value: unknown): "public" | "internal" | "confidential" | "sovereign" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "public":
      return "public";
    case "internal":
      return "internal";
    case "confidential":
      return "confidential";
    case "secret":
    case "top_secret":
      return "sovereign";
    default:
      return undefined;
  }
}

function isInternalEngineClassification(value: unknown): boolean {
  return value === "confidential" || value === "secret" || value === "top_secret" || value === "sovereign";
}

// Optimized Multi-select chip component with better performance
const MultiSelectChips = ({
  options,
  selected,
  onChange,
  title,
  className = "",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any[];
  selected: string[];
  onChange: (value: string) => void;
  title: string;
  className?: string;
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.div
              key={option.value}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
              }`}
              onClick={() => onChange(option.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

type AIAssistanceMode = 'ai_only';

const TECHNOLOGY_STACK_OPTIONS = [
  { value: "not-confirmed", label: "Not confirmed yet" },
  { value: "sap", label: "SAP / enterprise suite" },
  { value: "oracle", label: "Oracle stack" },
  { value: "microsoft", label: "Microsoft cloud / Dynamics / Power Platform" },
  { value: "salesforce", label: "Salesforce ecosystem" },
  { value: "aws", label: "AWS cloud stack" },
  { value: "azure", label: "Azure cloud stack" },
  { value: "gcp", label: "Google Cloud stack" },
  { value: "kubernetes", label: "Kubernetes / container platform" },
  { value: "api-gateway", label: "API gateway / microservices" },
  { value: "data-platform", label: "Data platform / lakehouse" },
  { value: "ai-ml", label: "AI / ML platform" },
  { value: "iot-edge", label: "IoT / edge platform" },
  { value: "legacy-custom", label: "Legacy or custom-built stack" },
  { value: "vendor-saas", label: "Vendor SaaS platform" },
  { value: "other", label: "Other / to be assessed" },
] as const;

const INTEGRATION_IMPLEMENTATION_OPTIONS = [
  { value: "not-confirmed", label: "Not confirmed yet" },
  { value: "rest-api", label: "REST / JSON API layer" },
  { value: "event-streaming", label: "Event streaming / message bus" },
  { value: "ipaas", label: "iPaaS / enterprise integration platform" },
  { value: "esb", label: "Enterprise service bus" },
  { value: "etl-elt", label: "ETL / ELT data pipeline" },
  { value: "secure-file", label: "Secure file exchange / SFTP" },
  { value: "webhooks", label: "Webhook callbacks" },
  { value: "identity-federation", label: "SSO / identity federation" },
  { value: "data-virtualization", label: "Data virtualization / API facade" },
  { value: "custom-adapter", label: "Custom adapter or connector" },
  { value: "vendor-connector", label: "Vendor-certified connector" },
  { value: "other", label: "Other / to be assessed" },
] as const;

const TEXT_FIELDS_WITH_OBJECT_HANDLING = new Set([
  "currentChallenges", "successCriteria", "stakeholders", "expectedOutcomes",
  "constraints", "riskFactors", "integrationRequirements", "complianceRequirements", "existingSystems",
]);

function stringifyDuration(obj: Record<string, unknown>): string {
  const duration = typeof obj.totalDuration === 'string' ? obj.totalDuration : JSON.stringify(obj.totalDuration);
  return obj.phases ? `${duration}\n\nPhases:\n${(obj.phases as string[]).join("\n")}` : duration;
}

function formatGeneratedList(items: unknown[]): string {
  return items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => item.startsWith("•") ? item : `• ${item}`)
    .join("\n");
}

function parsePreviewSections(value: string): { bullets: string[]; paragraphs: string[] } {
  const normalized = value.trim();
  if (!normalized) {
    return { bullets: [], paragraphs: [] };
  }

  const bullets = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean);

  if (bullets.length > 0) {
    return { bullets, paragraphs: [] };
  }

  return {
    bullets: [],
    paragraphs: normalized.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean),
  };
}

function GeneratedContentPreview(props: { title: string; value?: string | null; tone?: 'default' | 'emphasis' }) {
  const value = String(props.value || '').trim();
  if (!value) {
    return null;
  }

  const sections = parsePreviewSections(value);
  const toneClass = props.tone === 'emphasis'
    ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40'
    : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/30';

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
        <span>{props.title}</span>
      </div>
      {sections.paragraphs.length > 0 && (
        <div className="space-y-3 text-sm leading-6 text-foreground/90">
          {sections.paragraphs.map((paragraph, index) => (
            <p key={`${props.title}-paragraph-${index}`}>{paragraph}</p>
          ))}
        </div>
      )}
      {sections.bullets.length > 0 && (
        <div className="space-y-2">
          {sections.bullets.map((bullet, index) => (
            <div key={`${props.title}-bullet-${index}`} className="flex items-start gap-2 rounded-lg bg-background/80 px-3 py-2 text-sm leading-5 text-foreground/90">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneratedTextareaFrame(props: {
  title: string;
  value?: string | null;
  tone?: 'default' | 'emphasis';
  children: React.ReactNode;
}) {
  const value = String(props.value || '').trim();
  const toneClass = props.tone === 'emphasis'
    ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40'
    : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/30';
  const inactiveClass = 'border-border/60 bg-card/40';

  return (
    <div className={`rounded-xl border p-4 transition-colors focus-within:border-emerald-300/90 focus-within:shadow-sm ${value ? toneClass : inactiveClass}`}>
      {value ? (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span>{props.title}</span>
        </div>
      ) : null}
      <div className="space-y-3">{props.children}</div>
    </div>
  );
}

function processObjectValue(key: string, obj: Record<string, unknown>): string {
  if (key === "timeframe" && obj.totalDuration) {
    return stringifyDuration(obj);
  }
  if (TEXT_FIELDS_WITH_OBJECT_HANDLING.has(key)) {
    const items = (obj.criteria ?? obj.items ?? obj.list) as string[] | undefined;
    return Array.isArray(items)
      ? formatGeneratedList(items)
      : formatGeneratedList(Object.entries(obj).map(([k, v]) => `${k}: ${v}`));
  }
  return JSON.stringify(obj, null, 2);
}

function normalizeGeneratedIndustryType(value: unknown): DemandFormData["industryType"] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replaceAll(/\s+/g, "-");
  switch (normalized) {
    case "government":
    case "public-sector":
      return "government";
    case "semi-government":
      return "semi-government";
    case "public-private-partnership":
    case "ppp":
      return "public-private-partnership";
    case "private":
    case "private-sector":
      return "private-sector";
    case "non-profit":
    case "nonprofit":
      return "non-profit";
    default:
      return undefined;
  }
}

function processGeneratedValue(key: string, value: unknown): unknown {
  if (key === "industryType") {
    return normalizeGeneratedIndustryType(value);
  }
  if (Array.isArray(value)) {
    return formatGeneratedList(value);
  }
  if (typeof value === "object" && value !== null) {
    return processObjectValue(key, value as Record<string, unknown>);
  }
  return value;
}

type DemandClarificationPrompt = {
  field: keyof DemandFormData;
  label: string;
  prompt: string;
};

const LONG_TEXT_CLARIFICATION_FIELDS = new Set<keyof DemandFormData>([
  'currentChallenges',
  'expectedOutcomes',
  'successCriteria',
  'stakeholders',
  'existingSystems',
  'integrationRequirements',
  'complianceRequirements',
]);

type DemandDecisionFeedback = {
  decisionId?: unknown;
  status?: unknown;
  missingFields?: unknown[];
  requiredInfo?: unknown[];
  completenessScore?: unknown;
};

function decisionFeedbackRequiresClarification(decisionFeedback?: DemandDecisionFeedback | null): boolean {
  if (!decisionFeedback) {
    return false;
  }

  if (decisionFeedback.status === 'needs_info') {
    return true;
  }

  const missingFields = Array.isArray(decisionFeedback.missingFields)
    ? decisionFeedback.missingFields.map(String).filter(Boolean)
    : [];
  const requiredInfo = Array.isArray(decisionFeedback.requiredInfo)
    ? decisionFeedback.requiredInfo
    : [];

  return missingFields.length > 0 || requiredInfo.length > 0;
}

const DEMAND_CLARIFICATION_PROMPT_MAP: Record<string, DemandClarificationPrompt> = {
  organizationName: {
    field: 'organizationName',
    label: 'Organization',
    prompt: 'Which organization is sponsoring this demand?',
  },
  department: {
    field: 'department',
    label: 'Owning department',
    prompt: 'Which department will own this demand and lead delivery?',
  },
  requestorName: {
    field: 'requestorName',
    label: 'Requestor name',
    prompt: 'Who is the accountable requestor for this demand?',
  },
  requestorEmail: {
    field: 'requestorEmail',
    label: 'Requestor email',
    prompt: 'What is the best contact email for the accountable requestor?',
  },
  urgency: {
    field: 'urgency',
    label: 'Urgency',
    prompt: 'How urgent is this demand for the business or service?',
  },
  currentChallenges: {
    field: 'currentChallenges',
    label: 'Current challenges',
    prompt: 'What problem is happening today, and what is the operational impact if nothing changes?',
  },
  expectedOutcomes: {
    field: 'expectedOutcomes',
    label: 'Expected outcomes',
    prompt: 'What concrete outcomes should this initiative deliver for the business or citizen experience?',
  },
  successCriteria: {
    field: 'successCriteria',
    label: 'Success criteria',
    prompt: 'How will success be measured once the initiative is live?',
  },
  budgetRange: {
    field: 'budgetRange',
    label: 'Budget range',
    prompt: 'What funding envelope or budget range should planning assume?',
  },
  timeframe: {
    field: 'timeframe',
    label: 'Timeframe',
    prompt: 'What delivery horizon or target timeline should the business case use?',
  },
  stakeholders: {
    field: 'stakeholders',
    label: 'Stakeholders',
    prompt: 'Which stakeholders must approve, fund, or operate this initiative?',
  },
  existingSystems: {
    field: 'existingSystems',
    label: 'Existing systems',
    prompt: 'Which current systems, vendors, or platforms does this initiative depend on?',
  },
  complianceRequirements: {
    field: 'complianceRequirements',
    label: 'Compliance requirements',
    prompt: 'What regulatory, sovereignty, or compliance requirements must this demand satisfy?',
  },
  integrationRequirements: {
    field: 'integrationRequirements',
    label: 'Integration requirements',
    prompt: 'What integrations or data exchanges are required for this demand to succeed?',
  },
};

function humanizeDemandField(field: string): string {
  return field
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/^./g, (char) => char.toUpperCase());
}

function readClarificationDescription(record: Record<string, unknown>): string {
  if (typeof record.description === 'string') {
    return record.description;
  }
  if (typeof record.question === 'string') {
    return record.question;
  }
  return '';
}

function stringifyPromptFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function summarizeDemandPreviewValue(value: unknown): string {
  const normalized = stringifyPromptFieldValue(value).trim();

  if (!normalized) {
    return 'Not provided yet';
  }

  return normalized;
}

function hasMeaningfulDemandPreviewValue(value: unknown): boolean {
  return summarizeDemandPreviewValue(value) !== 'Not provided yet';
}

function buildClarificationPrompt(field: string, promptOverride?: string): DemandClarificationPrompt {
  const mapped = DEMAND_CLARIFICATION_PROMPT_MAP[field];
  if (mapped) {
    return {
      field: mapped.field,
      label: mapped.label,
      prompt: promptOverride || mapped.prompt,
    };
  }

  return {
    field: field as keyof DemandFormData,
    label: humanizeDemandField(field),
    prompt: promptOverride || `Please provide the missing detail for ${humanizeDemandField(field).toLowerCase()}.`,
  };
}

function buildDemandClarificationPromptsFromDecisionFeedback(decisionFeedback?: DemandDecisionFeedback | null): DemandClarificationPrompt[] {
  if (!decisionFeedback) {
    return [];
  }

  let missingFields: string[] = [];
  if (Array.isArray(decisionFeedback.missingFields)) {
    missingFields = decisionFeedback.missingFields.map(String).filter(Boolean);
  }
  if (missingFields.length === 0) {
    return [];
  }

  const requiredInfoMap = new Map<string, string>();
  if (Array.isArray(decisionFeedback.requiredInfo)) {
    decisionFeedback.requiredInfo.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const record = entry as Record<string, unknown>;
      const field = typeof record.field === 'string' ? record.field : '';
      const description = readClarificationDescription(record);
      if (field && description) {
        requiredInfoMap.set(field, description);
      }
    });
  }

  return missingFields.map((field) => buildClarificationPrompt(field, requiredInfoMap.get(field)));
}

function buildDemandClarificationPrompts(values: Partial<DemandFormData>): DemandClarificationPrompt[] {
  const prompts: DemandClarificationPrompt[] = [];

  if (!String(values.department || "").trim()) {
    prompts.push(buildClarificationPrompt('department'));
  }

  if (!String(values.currentChallenges || "").trim()) {
    prompts.push(buildClarificationPrompt('currentChallenges'));
  }

  if (!String(values.expectedOutcomes || "").trim()) {
    prompts.push(buildClarificationPrompt('expectedOutcomes'));
  }

  if (!String(values.successCriteria || "").trim()) {
    prompts.push(buildClarificationPrompt('successCriteria'));
  }

  if (!String(values.budgetRange || "").trim()) {
    prompts.push(buildClarificationPrompt('budgetRange'));
  }

  if (!String(values.timeframe || "").trim()) {
    prompts.push(buildClarificationPrompt('timeframe'));
  }

  return prompts;
}

function getApplyFieldsToastTitle(
  hasGeneratedData: boolean,
  promptsLength: number,
  decisionFeedback: DemandDecisionFeedback | null | undefined,
  t: (key: string) => string,
): string {
  if (!hasGeneratedData && promptsLength > 0) {
    return 'Demand Agent kept the current draft in review';
  }
  if (decisionFeedbackRequiresClarification(decisionFeedback)) {
    return 'Draft ready for Layer 4 review';
  }
  return t('demand.wizard.aiAnalysisComplete');
}

function getApplyFieldsToastDescription(
  hasGeneratedData: boolean,
  promptsLength: number,
  provider: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!hasGeneratedData && promptsLength > 0) {
    return 'COREVIA did not receive additional generated field content before the timeout, so the current draft remains in Layer 4 review for manual confirmation or retry.';
  }
  if (promptsLength > 0) {
    return `${t('demand.wizard.smartSuggestionsGenerated', { provider: provider || 'brain' })} ${promptsLength} key detail(s) were flagged for Layer 4 review on submit.`;
  }
  return t('demand.wizard.smartSuggestionsGenerated', { provider: provider || 'brain' });
}

function getLayer4DialogLabels(isReviewMode: boolean) {
  if (isReviewMode) {
    return {
      badge: 'Layer 4 final review',
      title: 'Review the governed gaps before final submission',
      description: 'The generated draft is already applied to the wizard. Confirm the missing Layer 4 inputs below, then submit the demand so COREVIA can carry the governed draft into the lifecycle review.',
      itemsLabel: 'Layer 4 items to confirm',
      itemsSummary: 'COREVIA will treat your confirmation as approval of these Layer 4 details and carry them into the governed lifecycle record.',
      dismissLabel: 'Keep editing before submit',
      generateLabel: 'Generate missing content with Demand Agent',
    };
  }

  return {
    badge: 'Layer 4 clarification',
    title: 'Confirm the missing governance inputs',
    description: 'The draft is already applied to the wizard. Use this focused review window to confirm the missing fields, then regenerate so COREVIA can update the context cleanly.',
    itemsLabel: 'Outstanding prompts',
    itemsSummary: 'Resolve these items in one pass without pushing the main step layout out of place.',
    dismissLabel: 'Keep current draft visible',
    generateLabel: 'Generate missing Layer 4 content',
  };
}


function StepNavItem({ step, currentStep, setCurrentStep, index }: Readonly<{
  step: StepDef;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  index: number;
}>) {
  const isActive = step.id <= currentStep;
  const isCompleted = step.id < currentStep;
  return (
    <motion.div
      className={`relative p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
        isActive
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-muted bg-muted/30 hover:border-muted-foreground/30"
      }`}
      onClick={() => isCompleted && setCurrentStep(step.id)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: isActive ? 1.02 : 1 }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
            isActive
              ? `bg-gradient-to-br ${step.color} text-white`
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isCompleted ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            step.icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium truncate ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {step.title}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {step.description}
          </div>
        </div>
      </div>
      {step.id === currentStep && (
        <motion.div
          className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </motion.div>
  );
}

export function DemandWizardEnhanced() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>(
    [],
  );
  const [selectedCompliance, setSelectedCompliance] = useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [technologyStackBySystem, setTechnologyStackBySystem] = useState<Record<string, string>>({});
  const [systemNotesBySystem, setSystemNotesBySystem] = useState<Record<string, string>>({});
  const [integrationImplementationByType, setIntegrationImplementationByType] = useState<Record<string, string>>({});
  const [integrationNotesByType, setIntegrationNotesByType] = useState<Record<string, string>>({});
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestionDismissed, setAiSuggestionDismissed] = useState(false);
  const [showInternalEngineNote, setShowInternalEngineNote] = useState(false);
  const [pendingDemandGeneration, setPendingDemandGeneration] = useState<PendingDemandGeneration | null>(null);
  const [aiClarificationPrompts, setAiClarificationPrompts] = useState<DemandClarificationPrompt[]>([]);
  const [showAiClarificationPrompts, setShowAiClarificationPrompts] = useState(false);
  const [pendingSubmitReviewData, setPendingSubmitReviewData] = useState<DemandFormData | null>(null);
  const [activeBrainDecisionId, setActiveBrainDecisionId] = useState<string | null>(null);
  const serverErrorRetryCountRef = useRef(0);
  const targetedLayer4FieldsRef = useRef<Set<keyof DemandFormData> | null>(null);
  const enableGovernance = true;
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [, setLocation] = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const form = useForm<DemandFormData>({
    resolver: zodResolver(insertDemandReportSchema),
    defaultValues: {
      organizationName: "",
      industryType: undefined,
      requestorName: "",
      requestorEmail: "",
      department: "",
      urgency: "medium",
      businessObjective: "",
      currentChallenges: "",
      expectedOutcomes: "",
      successCriteria: "",
      constraints: "",
      currentCapacity: "",
      budgetRange: "",
      timeframe: "",
      stakeholders: "",
      existingSystems: "",
      integrationRequirements: "",
      complianceRequirements: "",
      riskFactors: "",
      suggestedProjectName: "",
      dataClassification: "auto",
    },
  });

  const businessObjective = form.watch("businessObjective");
  const selectedDataClassification = form.watch("dataClassification");
  const suggestedProjectName = form.watch("suggestedProjectName");
  const systemTypeOptions = useMemo(() => getSystemTypes(), []);
  const integrationTypeOptions = useMemo(() => getIntegrationTypes(), []);
  const complianceStandardOptions = useMemo(() => getComplianceStandards(), []);
  const riskCategoryOptions = useMemo(() => getRiskCategories(), []);
  const technologyStackLabelByValue = useMemo(() => Object.fromEntries(
    TECHNOLOGY_STACK_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<string, string>, []);
  const integrationImplementationLabelByValue = useMemo(() => Object.fromEntries(
    INTEGRATION_IMPLEMENTATION_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<string, string>, []);
  const systemLabelByValue = useMemo(() => Object.fromEntries(
    systemTypeOptions.map((option) => [option.value, option.label]),
  ) as Record<string, string>, [systemTypeOptions]);
  const integrationLabelByValue = useMemo(() => Object.fromEntries(
    integrationTypeOptions.map((option) => [option.value, option.label]),
  ) as Record<string, string>, [integrationTypeOptions]);

  useEffect(() => {
    if (!currentUser) return;
    const userRecord = currentUser as Record<string, unknown>;
    const displayName = typeof currentUser.displayName === "string" ? currentUser.displayName : "";
    const email = typeof currentUser.email === "string" ? currentUser.email : "";
    const departmentName = typeof userRecord.departmentName === "string" ? userRecord.departmentName : "";
    const department = departmentName || (typeof currentUser.department === "string" ? currentUser.department : "");
    const organizationName = inferOrganizationNameFromUser(userRecord);
    const organizationType = typeof userRecord.organizationType === "string" ? userRecord.organizationType : "";

    if (!form.getValues("requestorName") && displayName) {
      form.setValue("requestorName", displayName);
    }
    if (!form.getValues("requestorEmail") && email) {
      form.setValue("requestorEmail", email);
    }
    if (!form.getValues("department") && department) {
      form.setValue("department", department);
    }
    if (!form.getValues("organizationName") && organizationName) {
      form.setValue("organizationName", organizationName);
    }
    if (!form.getValues("industryType") && organizationType) {
      const validTypes = new Set(["government", "semi-government", "public-private-partnership", "private-sector", "non-profit"]);
      if (validTypes.has(organizationType)) {
        form.setValue("industryType", organizationType as DemandFormData["industryType"]);
      }
    }
  }, [currentUser, form]);

  const buildGenerationContext = useCallback(() => {
    const normalizedClassification = normalizeDemandClassificationForBrain(form.getValues('dataClassification'));
    return {
      ...form.getValues(),
      dataClassification: normalizedClassification || form.getValues('dataClassification'),
      accessLevel: normalizedClassification || form.getValues('dataClassification'),
    };
  }, [form]);

  const clearClassificationResult = useCallback(() => {
    setClassification(null);
    form.resetField("requestType");
    form.resetField("classificationConfidence");
    form.resetField("classificationReasoning");
  }, [form]);

  const createClassificationResult = useCallback((params: {
    requestType: string;
    confidence: number;
    reasoning: string;
    classification: string;
    source?: 'explicit' | 'analysis' | 'live';
    telemetry?: DemandEngineTelemetry | null;
  }): ClassificationResult => {
    const context = form.getValues();
    const insights = buildClassificationInsights({
      classification: params.classification,
      reasoning: params.reasoning,
      objective: String(context.businessObjective || ''),
      department: String(context.department || ''),
      organizationName: String(context.organizationName || ''),
      industryType: typeof context.industryType === 'string' ? context.industryType : undefined,
      urgency: typeof context.urgency === 'string' ? context.urgency : undefined,
    });

    return {
      requestType: params.requestType,
      confidence: params.confidence,
      reasoning: params.reasoning,
      ...insights,
      source: params.source || 'analysis',
      telemetry: params.telemetry ? {
        engineLabel: normalizeTelemetryLabel(params.telemetry),
        riskLevel: typeof params.telemetry.riskLevel === 'string' ? params.telemetry.riskLevel : undefined,
        currentLayer: typeof params.telemetry.currentLayer === 'number' ? params.telemetry.currentLayer : undefined,
        classificationLevel: typeof params.telemetry.classificationLevel === 'string' ? params.telemetry.classificationLevel : undefined,
      } : undefined,
    };
  }, [form]);

  useEffect(() => {
    if (!pendingDemandGeneration?.decisionSpineId) {
      return;
    }

    form.setValue('decisionSpineId', pendingDemandGeneration.decisionSpineId);
  }, [form, pendingDemandGeneration?.decisionSpineId]);

  const captureActiveBrainDecision = useCallback((decisionFeedback?: DemandDecisionFeedback | null) => {
    const decisionId = typeof decisionFeedback?.decisionId === 'string' ? decisionFeedback.decisionId : null;
    setActiveBrainDecisionId(decisionId);
  }, []);

  const applyLayer4ClarificationPrompts = useCallback((decisionFeedback?: DemandDecisionFeedback | null) => {
    captureActiveBrainDecision(decisionFeedback);
    const prompts = buildDemandClarificationPromptsFromDecisionFeedback(decisionFeedback);
    if (prompts.length === 0) {
      return false;
    }

    setAiClarificationPrompts(prompts);
    return true;
  }, [captureActiveBrainDecision]);

  const handleClarificationGate = useCallback((decisionFeedback?: DemandDecisionFeedback | null, options?: { preserveDraft?: boolean }) => {
    captureActiveBrainDecision(decisionFeedback);
    const prompts = buildDemandClarificationPromptsFromDecisionFeedback(decisionFeedback);
    setAiClarificationPrompts(prompts);
    setShowAiClarificationPrompts(prompts.length > 0);
    setPendingDemandGeneration(null);
    if (!options?.preserveDraft) {
      clearClassificationResult();
      toast({
        title: 'Layer 4 review required',
        description: 'COREVIA still needs the missing business context before it can complete the governed draft.',
      });
    }
    return prompts;
  }, [captureActiveBrainDecision, clearClassificationResult, toast]);

  const applyGeneratedFields = useCallback((payload: { data: Record<string, unknown>; provider?: string; decisionFeedback?: DemandDecisionFeedback | null; engineTelemetry?: DemandEngineTelemetry | null }) => {
    const generatedData = payload.data;
    const hasGeneratedData = Object.keys(generatedData).length > 0;
    const currentObjective = String(form.getValues("businessObjective") || "").trim();
    const targetedFields = targetedLayer4FieldsRef.current;
    const shouldLimitToLayer4Targets = Boolean(targetedFields && targetedFields.size > 0);

    if (!shouldLimitToLayer4Targets && generatedData.enhancedBusinessObjective && typeof generatedData.enhancedBusinessObjective === 'string') {
      const generatedObjective = generatedData.enhancedBusinessObjective.trim();
      const shouldReplaceObjective = !currentObjective
        || (generatedObjective !== currentObjective && generatedObjective.length >= currentObjective.length + 20)
        || (generatedObjective !== currentObjective && /governed transformation initiative|enabling|sovereign infrastructure/i.test(generatedObjective));
      if (shouldReplaceObjective) {
        form.setValue("businessObjective", generatedObjective);
      }
    }

    if (!shouldLimitToLayer4Targets && generatedData.suggestedProjectName && typeof generatedData.suggestedProjectName === 'string') {
      form.setValue("suggestedProjectName", generatedData.suggestedProjectName);
    }

    Object.entries(generatedData).forEach(([key, value]) => {
      if (key === 'enhancedBusinessObjective' || key === 'suggestedProjectName') return;

      if (key in form.getValues() && value && (!shouldLimitToLayer4Targets || targetedFields?.has(key as keyof DemandFormData))) {
        const processedValue = processGeneratedValue(key, value);
        if (processedValue === undefined) {
          return;
        }
        form.setValue(key as keyof DemandFormData, processedValue as DemandFormData[keyof DemandFormData]);
      }
    });

    if (payload.engineTelemetry) {
      const explicitClassification = String(form.getValues('dataClassification') || generatedData.dataClassification || classification?.telemetry?.classificationLevel || 'demand').toLowerCase();
      const engineLabel = normalizeTelemetryLabel(payload.engineTelemetry) || 'Engine A';
      const layerLabel = typeof payload.engineTelemetry.currentLayer === 'number' ? `Layer ${payload.engineTelemetry.currentLayer}` : 'runtime';
      setClassification(createClassificationResult({
        requestType: typeof generatedData.requestType === 'string' ? generatedData.requestType : (classification?.requestType || 'demand'),
        confidence: typeof generatedData.classificationConfidence === 'number' ? generatedData.classificationConfidence : (classification?.confidence || 100),
        reasoning: `Live routing confirmed on ${engineLabel} at ${layerLabel}.`,
        classification: explicitClassification,
        source: 'live',
        telemetry: payload.engineTelemetry,
      }));
    }

    targetedLayer4FieldsRef.current = null;

    const prompts = applyLayer4ClarificationPrompts(payload.decisionFeedback)
      ? buildDemandClarificationPromptsFromDecisionFeedback(payload.decisionFeedback)
      : buildDemandClarificationPrompts(form.getValues());
    setAiClarificationPrompts(prompts);
    setShowAiClarificationPrompts(!hasGeneratedData && prompts.length > 0);

    toast({
      title: getApplyFieldsToastTitle(hasGeneratedData, prompts.length, payload.decisionFeedback, t),
      description: getApplyFieldsToastDescription(hasGeneratedData, prompts.length, payload.provider, t),
    });

    return prompts;
  }, [applyLayer4ClarificationPrompts, classification, createClassificationResult, form, t, toast]);

  // Optimized classification mutation
  const classifyMutation = useMutation({
    mutationFn: async (params: { businessObjective: string; generationMode?: AIAssistanceMode; additionalContext?: Record<string, unknown> }) => {
      const response = await apiRequest(
        "POST",
        "/api/demand-analysis/classify",
        {
          businessObjective: params.businessObjective,
          additionalContext: params.additionalContext || form.getValues(),
          generationMode: 'ai_only',
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${response.status}:${body}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      const payload = typeof data?.data === 'object' && data.data !== null ? data.data : null;
      const requestType = typeof payload?.requestType === 'string' ? payload.requestType : '';
      const classificationLevel = typeof payload?.classificationLevel === 'string' ? payload.classificationLevel : '';
      const confidence = typeof payload?.confidence === 'number' ? payload.confidence : undefined;
      const reasoning = typeof payload?.reasoning === 'string' ? payload.reasoning : '';

      if (data.success && requestType && reasoning) {
        const selectedClassification = String(form.getValues('dataClassification') || '').toLowerCase();
        const normalizedClassification = selectedClassification === 'auto'
          ? String(classificationLevel || requestType || 'internal').toLowerCase()
          : String(selectedClassification || classificationLevel || requestType || '').toLowerCase();
        setClassification(createClassificationResult({
          requestType,
          confidence: confidence ?? 0,
          reasoning,
          classification: normalizedClassification,
          source: 'analysis',
        }));
        // Only promote the form field to sovereign — never auto-set confidential from
        // AI analysis, because that triggers an "explicit" classification path on the backend
        // and forces sovereignty rules even for normal enterprise demands (e.g. performance
        // management). The setClassification() UI state above is enough for display purposes.
        if (selectedClassification === 'auto' && (classificationLevel === 'sovereign')) {
          form.setValue("dataClassification", "top_secret");
        }
        form.setValue("requestType", requestType);
        if (typeof confidence === 'number') {
          form.setValue("classificationConfidence", confidence);
        }
        form.setValue("classificationReasoning", reasoning);
        return;
      }

      clearClassificationResult();
    },
    onError: (error) => {
      console.error("Classification error:", error);
      clearClassificationResult();
    },
  });

  const maybeRunClassification = useCallback((_prompts: DemandClarificationPrompt[]) => {
    const normalizedClassification = normalizeDemandClassificationForBrain(form.getValues('dataClassification'));
    const shouldSkipClassification = Boolean(
      normalizedClassification && normalizedClassification !== 'public' && normalizedClassification !== 'internal',
    );
    const objective = String(form.getValues('businessObjective') || businessObjective || '').trim();

    if (!objective || objective.length < 10 || shouldSkipClassification || classifyMutation.isPending) {
      return;
    }

    clearClassificationResult();
    classifyMutation.mutate({
      businessObjective: objective,
      generationMode: 'ai_only',
      additionalContext: buildGenerationContext(),
    });
  }, [businessObjective, buildGenerationContext, classifyMutation, clearClassificationResult, form]);

  const { provideInfoAsync, isSubmitting: isResumingDecision } = useDecisionResume();

  const generateFieldsStatusQuery = useQuery({
    queryKey: ['demand-fields-status', pendingDemandGeneration?.decisionSpineId, pendingDemandGeneration?.businessObjective],
    enabled: Boolean(pendingDemandGeneration?.decisionSpineId),
    refetchInterval: pendingDemandGeneration ? 4000 : false,
    refetchIntervalInBackground: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    queryFn: async () => {
      if (!pendingDemandGeneration) {
        throw new Error('No pending demand generation');
      }

      const search = new URLSearchParams({
        decisionSpineId: pendingDemandGeneration.decisionSpineId,
        businessObjective: pendingDemandGeneration.businessObjective,
      });
      const response = await apiRequest('GET', `/api/demand-analysis/generate-fields/status?${search.toString()}`);
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status}:${body}`);
      }
      return JSON.parse(body) as {
        success: boolean;
        pending?: boolean;
        requiresClarification?: boolean;
        data?: Record<string, unknown>;
        provider?: string;
        decisionFeedback?: DemandDecisionFeedback;
        engineTelemetry?: DemandEngineTelemetry;
      };
    },
  });

  useEffect(() => {
    if (!pendingDemandGeneration) return;
    if (!generateFieldsStatusQuery.data?.success) return;
    if (generateFieldsStatusQuery.data.requiresClarification && !generateFieldsStatusQuery.data.data) {
      handleClarificationGate(generateFieldsStatusQuery.data.decisionFeedback);
      return;
    }
    if (generateFieldsStatusQuery.data.pending) return;

    const prompts = applyGeneratedFields({
      data: generateFieldsStatusQuery.data.data || {},
      provider: generateFieldsStatusQuery.data.provider,
      decisionFeedback: generateFieldsStatusQuery.data.decisionFeedback,
      engineTelemetry: generateFieldsStatusQuery.data.engineTelemetry,
    });
    maybeRunClassification(prompts);
    setPendingDemandGeneration(null);
  }, [applyGeneratedFields, generateFieldsStatusQuery.data, handleClarificationGate, maybeRunClassification, pendingDemandGeneration]);

  useEffect(() => {
    if (!pendingDemandGeneration) return;
    if (!generateFieldsStatusQuery.data?.success) return;
    if (!generateFieldsStatusQuery.data.pending) return;

    applyLayer4ClarificationPrompts(generateFieldsStatusQuery.data.decisionFeedback);
  }, [applyLayer4ClarificationPrompts, generateFieldsStatusQuery.data, pendingDemandGeneration]);

  useEffect(() => {
    if (!pendingDemandGeneration || !generateFieldsStatusQuery.error) return;

    const errorMessage = generateFieldsStatusQuery.error instanceof Error
      ? generateFieldsStatusQuery.error.message
      : 'AI generation could not complete';

    const statusCode = Number.parseInt(errorMessage.split(':', 1)[0] || '', 10);
    if (!Number.isNaN(statusCode) && statusCode >= 500) {
      serverErrorRetryCountRef.current += 1;
      if (serverErrorRetryCountRef.current <= 3) {
        toast({
          title: t('demand.wizard.aiAnalysisInProgress', { defaultValue: 'AI analysis in progress' }),
          description: t('demand.wizard.aiAnalysisInProgressDesc', { defaultValue: 'COREVIA Brain is still completing the governed demand generation. Fields will populate automatically.' }),
        });
        return; // let the refetchInterval handle the next poll
      }
      // Exhausted server-error retries — fall through to show error dialog
    }

    serverErrorRetryCountRef.current = 0;
    setPendingDemandGeneration(null);
    toast({
      title: t('demand.wizard.creationFailed', { defaultValue: 'AI generation failed' }),
      description: errorMessage,
      variant: 'destructive',
    });
  }, [generateFieldsStatusQuery, pendingDemandGeneration, t, toast]);

  // Pre-fill form from URL template parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const templateParam = urlParams.get('template');

    if (templateParam) {
      try {
        const templateData = JSON.parse(decodeURIComponent(templateParam));

        // Pre-fill form fields with template data
        if (templateData.title) {
          form.setValue('businessObjective', templateData.title);
        }
        if (templateData.description) {
          form.setValue('expectedOutcomes', templateData.description);
        }
        if (templateData.sector) {
          form.setValue('department', templateData.sector);
        }
        if (templateData.suggestedTechnologies && Array.isArray(templateData.suggestedTechnologies)) {
          form.setValue('existingSystems', templateData.suggestedTechnologies.join(', '));
        }

        toast({
          title: t('demand.wizard.innovationTemplateApplied'),
          description: t('demand.wizard.formPrefilledWithTemplate'),
        });
      } catch (error) {
        console.error('Error parsing template data:', error);
        toast({
          title: t('demand.wizard.error'),
          description: t('demand.wizard.failedToApplyTemplate'),
          variant: "destructive",
        });
      }

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Optimized auto-generate fields mutation
  const generateFieldsMutation = useMutation({
    mutationFn: async (params: { businessObjective: string; organizationName?: string; generationMode?: AIAssistanceMode; accessLevel?: string; dataClassification?: string; additionalContext?: Record<string, unknown> }) => {
      const response = await apiRequest(
        "POST",
        "/api/demand-analysis/generate-fields",
        {
          businessObjective: params.businessObjective,
          organizationName: params.organizationName || undefined,
          generationMode: 'ai_only',
          accessLevel: params.accessLevel,
          dataClassification: params.dataClassification,
          additionalContext: params.additionalContext || {},
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${response.status}:${body}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && typeof data.decisionSpineId === 'string' && data.decisionSpineId.trim()) {
        form.setValue('decisionSpineId', data.decisionSpineId);
      }

      if (data.success && data.requiresClarification && !data.data) {
        handleClarificationGate(data.decisionFeedback as DemandDecisionFeedback | undefined);
        return;
      }

      if (data.success && data.pending && typeof data.decisionSpineId === 'string') {
        serverErrorRetryCountRef.current = 0;
        applyLayer4ClarificationPrompts(data.decisionFeedback as DemandDecisionFeedback | undefined);
        setPendingDemandGeneration({
          decisionSpineId: data.decisionSpineId,
          businessObjective,
        });
        toast({
          title: t('demand.wizard.aiAnalysisInProgress', { defaultValue: 'AI analysis in progress' }),
          description: t('demand.wizard.aiAnalysisInProgressDesc', { defaultValue: 'COREVIA Brain is still completing the governed demand generation. Fields will populate automatically.' }),
        });
        return;
      }

      if (data.success) {
        const prompts = applyGeneratedFields({
          data: data.data || {},
          provider: data.provider,
          decisionFeedback: data.decisionFeedback as DemandDecisionFeedback | undefined,
          engineTelemetry: (typeof data.engineTelemetry === 'object' && data.engineTelemetry !== null ? data.engineTelemetry : null) as DemandEngineTelemetry | null,
        });
        maybeRunClassification(prompts);
      }
    },
    onError: (error) => {
      targetedLayer4FieldsRef.current = null;
      console.error("Generation error:", error);
      const errorMessage = error.message || "";

      // Handle 409 — AI unavailable, prompt user for fallback choice
      if (errorMessage.startsWith("409:")) {
        try {
          const parsed = JSON.parse(errorMessage.substring(4).trim());
          if (parsed?.message || parsed?.fallbackReason) {
            toast({
              title: t('demand.wizard.creationFailed', { defaultValue: 'AI generation failed' }),
              description: parsed.fallbackReason || parsed.message || 'AI provider unavailable',
              variant: 'destructive',
            });
            return;
          }
        } catch {
          // fall through to catch-all below
        }
      }

      // Any other error (500, network, etc.) — still show fallback choice dialog
      // so the user can choose template data, keep empty, or retry
      const reason = errorMessage.includes(":")
        ? errorMessage.substring(errorMessage.indexOf(":") + 1).trim().slice(0, 200)
        : errorMessage || "AI generation failed";
      toast({
        title: t('demand.wizard.creationFailed', { defaultValue: 'AI generation failed' }),
        description: reason || 'AI generation could not complete',
        variant: 'destructive',
      });
    },
  });

  const isGeneratingFields = generateFieldsMutation.isPending || Boolean(pendingDemandGeneration);

  // AI-enhanced objective mutation
  // Optimized create report mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: DemandFormData) => {
      const response = await apiRequest("POST", "/api/demand-reports", data);
      if (!response.ok)
        throw new Error(`Creation failed: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setShowAiClarificationPrompts(false);
        setAiClarificationPrompts([]);
        setPendingSubmitReviewData(null);
        setActiveBrainDecisionId(null);
        toast({
          title: t('demand.wizard.success', { defaultValue: 'Demand submitted' }),
          description: t('demand.wizard.demandSubmittedForAcknowledgement', {
            defaultValue: 'Demand intake recorded. COREVIA will acknowledge the request and notify you before Business Case becomes available.',
          }),
        });
        const createdReportId = typeof data?.data?.id === 'string' ? data.data.id : null;
        const nextSearch = new URLSearchParams({
          section: 'demands',
          demandSubmitted: '1',
        });
        if (createdReportId) {
          nextSearch.set('reportId', createdReportId);
        }
        setLocation(`/intelligent-library?${nextSearch.toString()}`);
        form.reset();
        setCurrentStep(1);
        setClassification(null);
      }
    },
    onError: (error) => {
      setPendingSubmitReviewData(null);
      console.error("Report creation error:", error);
      toast({
        title: t('demand.wizard.creationFailed'),
        description: t('demand.wizard.failedToCreateReport'),
        variant: "destructive",
      });
    },
  });

  const submitDemandReport = useCallback((data: DemandFormData) => {
    toast({
      title: enableGovernance ? t('demand.wizard.submittingToGovernance') : t('demand.wizard.submittingRequest'),
      description: enableGovernance
        ? t('demand.wizard.governancePipelineDesc')
        : t('demand.wizard.processingDesc'),
    });
    createReportMutation.mutate(data);
  }, [createReportMutation, enableGovernance, t, toast]);

  // Show AI suggestion prompt when user types enough in business objective
  useEffect(() => {
    if (businessObjective && businessObjective.length > 30 && !aiSuggestionDismissed) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setShowAISuggestion(true);
      }, 1500); // Wait 1.5 seconds after user stops typing
    } else {
      setShowAISuggestion(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [businessObjective, aiSuggestionDismissed]);

  // Handler for AI generation when user accepts the suggestion
  const startAIAssistance = (mode?: AIAssistanceMode) => {
    if (businessObjective && businessObjective.length > 20) {
      setShowAISuggestion(false);
      setAiSuggestionDismissed(true);
      if (!isGeneratingFields && !classifyMutation.isPending) {
        setPendingDemandGeneration(null);
        setAiClarificationPrompts([]);
        setShowAiClarificationPrompts(false);
        setActiveBrainDecisionId(null);
        const generationMode = mode || 'ai_only';
        const normalizedClassification = normalizeDemandClassificationForBrain(form.getValues('dataClassification'));
        const shouldSkipClassification = Boolean(normalizedClassification && normalizedClassification !== 'public' && normalizedClassification !== 'internal');
        const targetedLayer4Fields = Array.from(targetedLayer4FieldsRef.current || []);
        clearClassificationResult();
        // Generate fields (includes objective enhancement) and classify in parallel
        // Include org name so AI generates org-specific content
        const currentOrgName = form.getValues('organizationName') || '';
        const additionalContext = buildGenerationContext();

        generateFieldsMutation.mutate({
          businessObjective,
          organizationName: currentOrgName,
          generationMode,
          accessLevel: normalizedClassification || form.getValues('dataClassification') || undefined,
          dataClassification: normalizedClassification || form.getValues('dataClassification') || undefined,
          additionalContext: targetedLayer4Fields.length > 0
            ? {
                ...additionalContext,
                layer4FocusFields: targetedLayer4Fields,
                generationInstruction: 'Fill only the currently missing Layer 4 governance fields and preserve all other approved demand content.',
              }
            : additionalContext,
        });
        if (shouldSkipClassification) {
          const explicitClassification = normalizedClassification || String(form.getValues('dataClassification') || 'internal');
          setClassification(buildExplicitClassificationResult(explicitClassification, {
            objective: businessObjective,
            department: String(form.getValues('department') || ''),
            organizationName: String(form.getValues('organizationName') || ''),
            industryType: typeof form.getValues('industryType') === 'string' ? form.getValues('industryType') : undefined,
            urgency: typeof form.getValues('urgency') === 'string' ? form.getValues('urgency') : undefined,
          }));
          form.setValue("requestType", "demand");
          form.setValue("classificationConfidence", 100);
          form.setValue("classificationReasoning", `Using explicit ${explicitClassification} classification selected in the demand wizard.`);
        }
      }
    }
  };

  const handleGenerateMissingContentWithDemandAgent = () => {
    const targetedFields = aiClarificationPrompts
      .map((item) => item.field)
      .filter(Boolean);

    targetedLayer4FieldsRef.current = new Set(targetedFields);
    setShowAiClarificationPrompts(true);
    startAIAssistance('ai_only');
  };

  const handleUseAIAssistance = (mode: AIAssistanceMode = 'ai_only') => {
    if (isInternalEngineClassification(selectedDataClassification)) {
      setShowInternalEngineNote(true);
      return;
    }

    startAIAssistance(mode);
  };

  const confirmInternalEngineAIAssistance = () => {
    setShowInternalEngineNote(false);
    startAIAssistance('ai_only');
  };

  const handleDismissAISuggestion = () => {
    setShowAISuggestion(false);
    setAiSuggestionDismissed(true);
  };

  const renderClarificationInput = (item: DemandClarificationPrompt) => {
    const renderCurrentDraftValue = (value: unknown) => {
      if (!pendingSubmitReviewData || !hasMeaningfulDemandPreviewValue(value)) {
        return null;
      }

      return (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Current generated draft
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground whitespace-pre-wrap break-words">
            {summarizeDemandPreviewValue(value)}
          </p>
        </div>
      );
    };

    if (item.field === 'urgency') {
      return (
        <FormField
          key={item.field}
          control={form.control}
          name={item.field}
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-sm font-medium">{item.label}</FormLabel>
              {renderCurrentDraftValue(field.value)}
              <Select value={stringifyPromptFieldValue(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid={`clarification-${item.field}`}>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{item.prompt}</p>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    if (item.field === 'budgetRange') {
      return (
        <FormField
          key={item.field}
          control={form.control}
          name={item.field}
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-sm font-medium">{item.label}</FormLabel>
              {renderCurrentDraftValue(field.value)}
              <Select value={String(field.value || '')} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid={`clarification-${item.field}`}>
                    <SelectValue placeholder="Select budget range" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {getBudgetRanges().map((budget) => (
                    <SelectItem key={budget.value} value={budget.value}>{budget.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{item.prompt}</p>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    if (item.field === 'timeframe') {
      return (
        <FormField
          key={item.field}
          control={form.control}
          name={item.field}
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-sm font-medium">{item.label}</FormLabel>
              {renderCurrentDraftValue(field.value)}
              <Select value={String(field.value || '')} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid={`clarification-${item.field}`}>
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {getTimeframeOptions().map((timeframe) => (
                    <SelectItem key={timeframe.value} value={timeframe.value}>{timeframe.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{item.prompt}</p>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    const isLongText = LONG_TEXT_CLARIFICATION_FIELDS.has(item.field);

    return (
      <FormField
        key={item.field}
        control={form.control}
        name={item.field}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel className="text-sm font-medium">{item.label}</FormLabel>
            {renderCurrentDraftValue(field.value)}
            <FormControl>
              {isLongText ? (
                <Textarea
                  {...field}
                  value={stringifyPromptFieldValue(field.value)}
                  className="min-h-[96px]"
                  data-testid={`clarification-${item.field}`}
                />
              ) : (
                <Input
                  {...field}
                  value={stringifyPromptFieldValue(field.value)}
                  data-testid={`clarification-${item.field}`}
                />
              )}
            </FormControl>
            <p className="text-xs text-muted-foreground">{item.prompt}</p>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  // Safe parsing function with no dependencies to prevent infinite loops
  const parseToArray = useCallback((value: string | string[] | null | undefined) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value)
      return value
        .split(/\n|,(?=\s|$)/)
        .map((item) => item.replace(/^•\s*/, "").trim())
        .filter(Boolean);
    return [];
  }, []);

  const parseSelectedOptionValues = useCallback((
    value: string | string[] | null | undefined,
    options: Array<{ value: string; label: string }>,
  ) => {
    const parsed = parseToArray(value);
    return Array.from(new Set(parsed.map((item) => {
      const normalizedItem = item.toLowerCase();
      const matched = options.find((option) => {
        const normalizedValue = option.value.toLowerCase();
        const normalizedLabel = option.label.toLowerCase();
        return normalizedItem === normalizedValue
          || normalizedItem === normalizedLabel
          || normalizedItem.startsWith(`${normalizedLabel} `)
          || normalizedItem.startsWith(`${normalizedLabel} (`)
          || normalizedItem.includes(`system: ${normalizedLabel}`)
          || normalizedItem.includes(`integration: ${normalizedLabel}`);
      });
      return matched?.value;
    }).filter((item): item is string => Boolean(item))));
  }, [parseToArray]);

  const formatSelectedSystemsForBrain = useCallback(() => {
    return selectedSystems.map((systemValue) => {
      const systemLabel = systemLabelByValue[systemValue] || systemValue;
      const stackValue = technologyStackBySystem[systemValue] || "not-confirmed";
      const stackLabel = technologyStackLabelByValue[stackValue] || stackValue;
      const note = systemNotesBySystem[systemValue]?.trim();
      return [
        `System: ${systemLabel}`,
        `Potential technology stack: ${stackLabel}`,
        note ? `End-user note: ${note}` : "",
      ].filter(Boolean).join(" | ");
    }).join("\n");
  }, [selectedSystems, systemLabelByValue, systemNotesBySystem, technologyStackBySystem, technologyStackLabelByValue]);

  const formatSelectedIntegrationsForBrain = useCallback(() => (
    selectedIntegrations
      .map((integrationValue) => {
        const integrationLabel = integrationLabelByValue[integrationValue] || integrationValue;
        const implementationValue = integrationImplementationByType[integrationValue] || "not-confirmed";
        const implementationLabel = integrationImplementationLabelByValue[implementationValue] || implementationValue;
        const note = integrationNotesByType[integrationValue]?.trim();
        return [
          `Integration: ${integrationLabel}`,
          `Implementation pattern: ${implementationLabel}`,
          note ? `End-user note: ${note}` : "",
        ].filter(Boolean).join(" | ");
      })
      .join("\n")
  ), [integrationImplementationByType, integrationImplementationLabelByValue, integrationLabelByValue, integrationNotesByType, selectedIntegrations]);

  const formatOptionValuesForBrain = useCallback((
    selectedValues: string[],
    options: Array<{ value: string; label: string }>,
  ) => {
    const labelByValue = Object.fromEntries(options.map((option) => [option.value, option.label])) as Record<string, string>;
    return selectedValues.map((value) => labelByValue[value] || value).join("\n");
  }, []);

  // Initialize state arrays from form values once (avoiding circular updates)
  const existingSystems = form.watch("existingSystems");
  const integrationRequirements = form.watch("integrationRequirements");
  const complianceRequirements = form.watch("complianceRequirements");
  const riskFactors = form.watch("riskFactors");

  // One-way sync only: when user manually changes form inputs, update state arrays
  // Remove the circular dependency by not syncing back to form automatically
  useEffect(() => {
    const parsed = parseSelectedOptionValues(existingSystems, systemTypeOptions);
    setSelectedSystems(prev => {
      const stringified = JSON.stringify(prev.toSorted((a, b) => a.localeCompare(b)));
      const newStringified = JSON.stringify(parsed.toSorted((a, b) => a.localeCompare(b)));
      return stringified === newStringified ? prev : parsed;
    });
  }, [existingSystems, parseSelectedOptionValues, systemTypeOptions]);

  useEffect(() => {
    const parsed = parseSelectedOptionValues(integrationRequirements, integrationTypeOptions);
    setSelectedIntegrations(prev => {
      const stringified = JSON.stringify(prev.toSorted((a, b) => a.localeCompare(b)));
      const newStringified = JSON.stringify(parsed.toSorted((a, b) => a.localeCompare(b)));
      return stringified === newStringified ? prev : parsed;
    });
  }, [integrationRequirements, integrationTypeOptions, parseSelectedOptionValues]);

  useEffect(() => {
    const parsed = parseSelectedOptionValues(complianceRequirements, complianceStandardOptions);
    setSelectedCompliance(prev => {
      const stringified = JSON.stringify(prev.toSorted((a, b) => a.localeCompare(b)));
      const newStringified = JSON.stringify(parsed.toSorted((a, b) => a.localeCompare(b)));
      return stringified === newStringified ? prev : parsed;
    });
  }, [complianceRequirements, complianceStandardOptions, parseSelectedOptionValues]);

  useEffect(() => {
    const parsed = parseSelectedOptionValues(riskFactors, riskCategoryOptions);
    setSelectedRisks(prev => {
      const stringified = JSON.stringify(prev.toSorted((a, b) => a.localeCompare(b)));
      const newStringified = JSON.stringify(parsed.toSorted((a, b) => a.localeCompare(b)));
      return stringified === newStringified ? prev : parsed;
    });
  }, [riskFactors, parseSelectedOptionValues, riskCategoryOptions]);

  useEffect(() => {
    const nextExistingSystems = formatSelectedSystemsForBrain();
    const currentExistingSystems = String(form.getValues("existingSystems") || "");
    if (nextExistingSystems && nextExistingSystems !== currentExistingSystems) {
      form.setValue("existingSystems", nextExistingSystems, { shouldDirty: true });
    } else if (!nextExistingSystems && /^System:/im.test(currentExistingSystems)) {
      form.setValue("existingSystems", "", { shouldDirty: true });
    }
  }, [form, formatSelectedSystemsForBrain]);

  useEffect(() => {
    const nextIntegrationRequirements = formatSelectedIntegrationsForBrain();
    const currentIntegrationRequirements = String(form.getValues("integrationRequirements") || "");
    if (nextIntegrationRequirements && nextIntegrationRequirements !== currentIntegrationRequirements) {
      form.setValue("integrationRequirements", nextIntegrationRequirements, { shouldDirty: true });
    } else if (!nextIntegrationRequirements && /^Integration:/im.test(currentIntegrationRequirements)) {
      form.setValue("integrationRequirements", "", { shouldDirty: true });
    }
  }, [form, formatSelectedIntegrationsForBrain]);

  useEffect(() => {
    const nextComplianceRequirements = formatOptionValuesForBrain(selectedCompliance, complianceStandardOptions);
    if (nextComplianceRequirements && nextComplianceRequirements !== form.getValues("complianceRequirements")) {
      form.setValue("complianceRequirements", nextComplianceRequirements, { shouldDirty: true });
    }
  }, [complianceStandardOptions, form, formatOptionValuesForBrain, selectedCompliance]);

  useEffect(() => {
    const nextRiskFactors = formatOptionValuesForBrain(selectedRisks, riskCategoryOptions);
    if (nextRiskFactors && nextRiskFactors !== form.getValues("riskFactors")) {
      form.setValue("riskFactors", nextRiskFactors, { shouldDirty: true });
    }
  }, [form, formatOptionValuesForBrain, riskCategoryOptions, selectedRisks]);

  // Memoized calculations
  const progress = useMemo(
    () => ((currentStep) / getSteps().length) * 100,
    [currentStep],
  );
  const currentStepData = useMemo(
    () => getSteps().find((step) => step.id === currentStep),
    [currentStep],
  );

  // Optimized handlers
  const nextStep = useCallback(async () => {
    const fieldsToValidate = STEP_VALIDATION_FIELDS[currentStep];

    if (fieldsToValidate && fieldsToValidate.length > 0) {
      const isStepValid = await form.trigger(fieldsToValidate, { shouldFocus: true });
      if (!isStepValid) {
        toast({
          title: 'Complete Required Fields',
          description: 'Fill in the required fields before continuing to the next step.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (currentStep < getSteps().length) setCurrentStep(currentStep + 1);
  }, [currentStep, form, toast]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const prepareDemandDataForSubmit = useCallback((data: DemandFormData): DemandFormData => {
    const budgetRange = String(data.budgetRange || "").trim();
    const timeframe = String(data.timeframe || "").trim();
    return {
      ...data,
      budgetRange: !budgetRange || budgetRange === "tbd"
        ? "AI suggested estimate - no official budget approval"
        : data.budgetRange,
      timeframe: !timeframe
        ? "AI suggested timeline - not officially approved"
        : data.timeframe,
    };
  }, []);

  const onSubmit = useCallback<SubmitHandler<DemandFormData>>(
    (data: DemandFormData) => {
      const preparedData = prepareDemandDataForSubmit(data);
      const clarificationPrompts = aiClarificationPrompts.length > 0
        ? aiClarificationPrompts
        : buildDemandClarificationPrompts(preparedData);

      if (clarificationPrompts.length > 0) {
        setAiClarificationPrompts(clarificationPrompts);
        setPendingSubmitReviewData(preparedData);
        setShowAiClarificationPrompts(true);
        toast({
          title: 'Layer 4 review before submission',
          description: 'Review the missing Layer 4 inputs, confirm the generated draft, then submit or refresh the draft with updated answers.',
        });
        return;
      }

      submitDemandReport(preparedData);
    },
    [aiClarificationPrompts, prepareDemandDataForSubmit, submitDemandReport, toast],
  );

  const handleSubmitAfterLayer4Review = useCallback(async () => {
    if (!pendingSubmitReviewData || createReportMutation.isPending || isResumingDecision) {
      return;
    }

    const isValid = await form.trigger(undefined, { shouldFocus: true });
    if (!isValid) {
      toast({
        title: 'Layer 4 review still incomplete',
        description: 'Complete the required clarification fields before submitting the demand.',
        variant: 'destructive',
      });
      return;
    }

    const reviewedDemandData = form.getValues();

    if (activeBrainDecisionId) {
      try {
        const resumeResult = await provideInfoAsync({
          decisionId: activeBrainDecisionId,
          additionalData: buildGenerationContext(),
        });

        if (resumeResult.finalStatus === 'needs_info') {
          toast({
            title: 'Layer 4 review still incomplete',
            description: 'COREVIA still requires additional governed context before the demand can continue.',
            variant: 'destructive',
          });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const isStaleClarificationState = /does not require additional information|decision not found/i.test(message);
        if (!isStaleClarificationState) {
          toast({
            title: 'Submitting demand with latest Layer 4 inputs',
            description: 'COREVIA could not update the in-flight clarification session, but your demand will still be saved for acknowledgment.',
          });
        }
      }
    }

    setShowAiClarificationPrompts(false);
    setPendingSubmitReviewData(reviewedDemandData);
    submitDemandReport(reviewedDemandData);
  }, [activeBrainDecisionId, buildGenerationContext, createReportMutation.isPending, form, isResumingDecision, pendingSubmitReviewData, provideInfoAsync, submitDemandReport, toast]);

  const onInvalidSubmit = useCallback<SubmitErrorHandler<DemandFormData>>(
    (errors) => {
      const firstInvalidField = Object.keys(errors)[0] ?? '';
      const targetStep = getStepForField(firstInvalidField);
      setCurrentStep(targetStep);
      toast({
        title: 'Unable To Submit',
        description: 'Complete the required fields before submitting the demand request.',
        variant: 'destructive',
      });
    },
    [toast],
  );

  // Optimized toggle handlers
  const toggleSelection = useCallback(
    (
      value: string,
      currentSelections: string[],
      setter: (selections: string[]) => void,
    ) => {
      setter(
        currentSelections.includes(value)
          ? currentSelections.filter((item) => item !== value)
          : [...currentSelections, value],
      );
    },
    [],
  );

  const toggleSystemSelection = useCallback((value: string) => {
    const isSelected = selectedSystems.includes(value);
    const nextSelections = isSelected
      ? selectedSystems.filter((item) => item !== value)
      : [...selectedSystems, value];

    setSelectedSystems(nextSelections);
    if (isSelected) {
      setTechnologyStackBySystem((current) => {
        const { [value]: _removed, ...remaining } = current;
        return remaining;
      });
      setSystemNotesBySystem((current) => {
        const { [value]: _removed, ...remaining } = current;
        return remaining;
      });
    }
  }, [selectedSystems]);

  const toggleIntegrationSelection = useCallback((value: string) => {
    const isSelected = selectedIntegrations.includes(value);
    const nextSelections = isSelected
      ? selectedIntegrations.filter((item) => item !== value)
      : [...selectedIntegrations, value];

    setSelectedIntegrations(nextSelections);
    if (isSelected) {
      setIntegrationImplementationByType((current) => {
        const { [value]: _removed, ...remaining } = current;
        return remaining;
      });
      setIntegrationNotesByType((current) => {
        const { [value]: _removed, ...remaining } = current;
        return remaining;
      });
    }
  }, [selectedIntegrations]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "ArrowRight":
            event.preventDefault();
            nextStep();
            break;
          case "ArrowLeft":
            event.preventDefault();
            prevStep();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [nextStep, prevStep]);

  // Memoized animation variants
  const stepVariants = useMemo(
    () => ({
      hidden: { opacity: 0, x: 50, scale: 0.95 },
      visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { duration: 0.4, ease: "easeOut" },
      },
      exit: {
        opacity: 0,
        x: -50,
        scale: 0.95,
        transition: { duration: 0.3, ease: "easeIn" },
      },
    }),
    [],
  );

  const cardVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" },
      },
    }),
    [],
  );

  const iconVariants = useMemo(
    () => ({
      hidden: { scale: 0, rotate: -180 },
      visible: {
        scale: 1,
        rotate: 0,
        transition: { duration: 0.5, ease: "easeOut", delay: 0.2 },
      },
    }),
    [],
  );

  return (
    <Can
      permissions={['report:create']}
      fallback={
        <div className="flex items-center justify-center h-full p-8">
          <AccessDenied
            reason={t('demand.wizard.noPermission')}
          />
        </div>
      }
    >
      <div
        className={`${isMaximized ? "fixed inset-0 z-50 bg-background p-4" : "h-full"} flex flex-col`}
      >
      {/* Enhanced Progress Header with Animation */}
      <motion.div
        className="relative overflow-hidden rounded-xl mb-3 flex-shrink-0"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div
          className={`absolute inset-0 bg-gradient-to-r ${currentStepData?.color || "from-blue-500 to-emerald-500"} opacity-10`}
        />
        <div className="relative intelligence-panel border-0 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                className={`h-10 w-10 rounded-xl bg-gradient-to-br ${currentStepData?.color || "from-emerald-500 to-blue-500"} flex items-center justify-center text-white shadow-lg`}
                variants={iconVariants}
                initial="hidden"
                animate="visible"
                key={currentStep}
              >
                <HexagonLogoFrame px={20} />
              </motion.div>
              <div>
                <motion.h2
                  className="text-lg font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {t('demand.wizard.intelligenceDemandRequest')}
                </motion.h2>
                <motion.p
                  className="text-sm text-muted-foreground flex items-center gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  {t('demand.wizard.intelligentGovernmentAnalysis')}
                </motion.p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-white/10"
                onClick={() => setIsMaximized(!isMaximized)}
                data-testid="button-maximize-wizard"
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Badge variant="secondary" className="px-3 py-1">
                {t('demand.wizard.stepOf', { current: currentStep, total: getSteps().length })}
              </Badge>
              <motion.div
                className="text-right"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-lg font-bold text-primary">
                  {Math.round(progress)}%
                </div>
                <div className="text-xs text-muted-foreground">{t('demand.wizard.complete')}</div>
              </motion.div>
            </div>
          </div>

          {/* Enhanced Progress Visualization */}
          <div className="space-y-2">
            <div className="relative">
              <Progress value={progress} className="h-2 rounded-full" />
              <motion.div
                className="absolute top-0 left-0 h-2 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 rounded-full opacity-20"
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {getSteps().map((step, index) => (
                <StepNavItem
                  key={step.id}
                  step={step}
                  currentStep={currentStep}
                  setCurrentStep={setCurrentStep}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI Classification Display */}
      <AnimatePresence>
        {!classification && classifyMutation.isPending && (
          <motion.div
            className="intelligence-panel rounded-xl p-4 mb-6 flex-shrink-0"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <div className="flex-1">
                <h3 className="font-semibold">{t('demand.wizard.aiClassification')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  COREVIA is classifying the demand against the latest business objective and context.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        {classification && (
          <motion.div
            className="intelligence-panel rounded-xl p-4 mb-6 flex-shrink-0"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t('demand.wizard.aiClassification')}</h3>
                  <Badge
                    variant={
                      classification.requestType === "demand"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {classification.requestType.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(Number(classification.confidence) > 0 && Number(classification.confidence) <= 1 ? Number(classification.confidence) * 100 : Number(classification.confidence))}% {t('demand.wizard.confidence')}
                  </Badge>
                  {classification.telemetry?.engineLabel && (
                    <Badge variant="secondary" className="text-xs">{classification.telemetry.engineLabel}</Badge>
                  )}
                  {classification.telemetry?.riskLevel && (
                    <Badge variant="outline" className="text-xs capitalize">{classification.telemetry.riskLevel} risk</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {classification.reasoning}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {classification.keywords.slice(0, 5).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="text-[11px]">{keyword}</Badge>
                  ))}
                </div>
                <div className="mt-3 space-y-2 text-sm text-foreground/90">
                  <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{classification.routeSummary}</span>
                  </div>
                  {classification.recommendations[0] && (
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>{classification.recommendations[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Content */}
      <div className="flex-1 overflow-y-scroll min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="intelligence-panel">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <motion.div
                        className={`h-8 w-8 rounded-lg bg-gradient-to-br ${currentStepData?.color} flex items-center justify-center text-white shadow-lg`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {currentStepData?.icon}
                      </motion.div>
                      <div>
                        <CardTitle className="text-lg">
                          {currentStepData?.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {currentStepData?.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Step 1: Basic Information */}
                    {currentStep === 1 && (
                      <div className="space-y-5">
                        <GeneratedContentPreview
                          title="Enhanced Objective Preview"
                          value={String(form.watch("businessObjective") || "")}
                          tone="emphasis"
                        />

                        {/* Section: Organization Details */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Organization Details</h3>
                              <p className="text-[11px] text-muted-foreground">Provide your organization and contact information</p>
                            </div>
                          </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="organizationName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.organizationName')} *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('demand.wizard.orgNamePlaceholder')}
                                    {...field}
                                    data-testid="input-organization"
                                    className="h-12"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="industryType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.industryType')} *</FormLabel>
                                <FormControl>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value || undefined}
                                    data-testid="select-industry-type"
                                  >
                                    <SelectTrigger className="h-12">
                                      <SelectValue placeholder={t('demand.wizard.selectOrgType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getIndustryTypeOptions().map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            {option.icon}
                                            <div>
                                              <div className="font-medium">{option.label}</div>
                                              <div className="text-xs text-muted-foreground">{option.description}</div>
                                            </div>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="department"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.department')} *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('demand.wizard.departmentPlaceholder')}
                                    className="h-12"
                                    data-testid="input-department"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requestorName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.yourFullName')} *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('demand.wizard.fullNamePlaceholder')}
                                    {...field}
                                    data-testid="input-requestor-name"
                                    className="h-12"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="requestorEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.emailAddress')} *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder={t('demand.wizard.emailPlaceholder')}
                                    {...field}
                                    data-testid="input-email"
                                    className="h-12"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        </div>

                        {/* Section: Data Classification */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                              <Database className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Data Classification</h3>
                              <p className="text-[11px] text-muted-foreground">Determines AI routing: sovereign, hybrid, or cloud</p>
                            </div>
                          </div>
                        {/* Data Classification for LLM Routing */}
                        <FormField
                          control={form.control}
                          name="dataClassification"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                {t('demand.wizard.dataClassification')}
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({t('demand.wizard.leaveAsAuto')})
                                </span>
                              </FormLabel>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                                {[
                                  {
                                    value: "auto",
                                    label: "Auto",
                                    desc: "AI determines classification",
                                    icon: <Sparkles className="h-4 w-4" />,
                                    color: "from-violet-500 to-purple-600",
                                  },
                                  {
                                    value: "public",
                                    label: "Public",
                                    desc: "Open government data",
                                    icon: <Globe className="h-4 w-4" />,
                                    color: "from-green-500 to-emerald-600",
                                  },
                                  {
                                    value: "internal",
                                    label: "Internal",
                                    desc: "Government use only",
                                    icon: <Building2 className="h-4 w-4" />,
                                    color: "from-blue-500 to-indigo-600",
                                  },
                                  {
                                    value: "confidential",
                                    label: "Confidential",
                                    desc: "Sensitive operations",
                                    icon: <Shield className="h-4 w-4" />,
                                    color: "from-amber-500 to-orange-600",
                                  },
                                  {
                                    value: "secret",
                                    label: "Secret",
                                    desc: "Restricted access",
                                    icon: <Shield className="h-4 w-4" />,
                                    color: "from-red-500 to-rose-600",
                                  },
                                  {
                                    value: "top_secret",
                                    label: "Top Secret",
                                    desc: "Sovereign AI only",
                                    icon: <AlertCircle className="h-4 w-4" />,
                                    color: "from-slate-700 to-slate-900",
                                  },
                                ].map((classification) => (
                                  <motion.div
                                    key={classification.value}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                      field.value === classification.value
                                        ? `border-primary bg-gradient-to-br ${classification.color} text-white shadow-lg`
                                        : "border-muted hover:border-muted-foreground/50 bg-card"
                                    }`}
                                    onClick={() =>
                                      field.onChange(classification.value)
                                    }
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    data-testid={`classification-${classification.value}`}
                                  >
                                    <div className="text-center">
                                      <div className={`flex items-center justify-center mb-1.5 ${field.value === classification.value ? 'text-white' : 'text-muted-foreground'}`}>{classification.icon}</div>
                                      <div className="text-sm font-semibold">
                                        {classification.label}
                                      </div>
                                      <div className={`text-[10px] ${field.value === classification.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                                        {classification.desc}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              {field.value === 'auto' && (
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-violet-500" />
                                  AI will analyze your request content and automatically route to the appropriate LLM (cloud or sovereign)
                                </p>
                              )}
                              {(field.value === 'secret' || field.value === 'top_secret') && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  {t('demand.wizard.sovereignAiRouting')}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>

                        {/* Section: Urgency Level */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
                              <Zap className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Priority & Urgency</h3>
                              <p className="text-[11px] text-muted-foreground">Set the priority level for this intelligence request</p>
                            </div>
                          </div>
                        <FormField
                          control={form.control}
                          name="urgency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('demand.wizard.urgencyLevel')} *</FormLabel>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                {[
                                  {
                                    value: "low",
                                    label: "Low",
                                    desc: "Non-critical improvements",
                                    icon: <Clock className="h-4 w-4" />,
                                    color: "from-green-500 to-emerald-600",
                                  },
                                  {
                                    value: "medium",
                                    label: "Medium",
                                    desc: "Standard business needs",
                                    icon: <TrendingUp className="h-4 w-4" />,
                                    color: "from-blue-500 to-cyan-600",
                                  },
                                  {
                                    value: "high",
                                    label: "High",
                                    desc: "Important strategic initiative",
                                    icon: <Zap className="h-4 w-4" />,
                                    color: "from-amber-500 to-orange-600",
                                  },
                                  {
                                    value: "critical",
                                    label: "Critical",
                                    desc: "Urgent operational requirement",
                                    icon: <AlertCircle className="h-4 w-4" />,
                                    color: "from-red-500 to-rose-600",
                                  },
                                ].map((urgency) => (
                                  <motion.div
                                    key={urgency.value}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      field.value === urgency.value
                                        ? `border-primary bg-gradient-to-br ${urgency.color} text-white shadow-lg`
                                        : "border-muted hover:border-muted-foreground/50"
                                    }`}
                                    onClick={() =>
                                      field.onChange(urgency.value)
                                    }
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <div className="text-center">
                                      <div className={`flex items-center justify-center mb-1.5 ${field.value === urgency.value ? 'text-white' : 'text-muted-foreground'}`}>{urgency.icon}</div>
                                      <div className="text-sm font-semibold">
                                        {urgency.label}
                                      </div>
                                      <div className={`text-[10px] ${field.value === urgency.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                                        {urgency.desc}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                      </div>
                    )}

                    {/* Step 2: Business Requirements */}
                    {currentStep === 2 && (
                      <div className="space-y-5">
                        {/* Section 1: Strategic Vision */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-sm">
                              <Target className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Strategic Vision</h3>
                              <p className="text-[11px] text-muted-foreground">Define the core objective driving this initiative</p>
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name="businessObjective"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-base">
                                  Business Objective *
                                  <motion.div
                                    animate={
                                      isGeneratingFields
                                        ? { rotate: 360 }
                                        : {}
                                    }
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                  >
                                    <HexagonLogoFrame px={16} />
                                  </motion.div>
                                  <span className="text-xs text-emerald-500 font-normal">
                                    ({t('demand.wizard.aiAssistanceAvailable')})
                                  </span>
                                </FormLabel>
                                <GeneratedTextareaFrame
                                  title="AI Enhanced Objective"
                                  value={String(field.value || '')}
                                  tone="emphasis"
                                >
                                  {suggestedProjectName && !showAiClarificationPrompts && (
                                    <div className="mb-3 rounded-lg border border-emerald-200/80 bg-background/80 px-3 py-2 dark:border-emerald-900">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                                        {t('demand.wizard.aiSuggestedProjectName')}
                                      </div>
                                      <Input
                                        value={suggestedProjectName}
                                        onChange={(event) => form.setValue("suggestedProjectName", event.target.value, { shouldDirty: true })}
                                        className="mt-1 h-11 rounded-lg border border-border/60 bg-background px-3 text-base font-semibold text-foreground shadow-sm focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                                        data-testid="input-suggested-project-name"
                                      />
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {t('demand.wizard.projectNameUsage')}
                                      </p>
                                    </div>
                                  )}
                                  <FormControl>
                                    <Textarea
                                      placeholder={t('demand.wizard.businessObjectivePlaceholder')}
                                      className={`${FRIENDLY_TEXTAREA_CLASSNAME} min-h-[160px] text-base`}
                                      {...field}
                                      value={field.value || ""}
                                      rows={7}
                                      data-testid="textarea-business-objective"
                                    />
                                  </FormControl>
                                </GeneratedTextareaFrame>

                                <FormMessage />

                                {/* AI Assistance Suggestion */}
                                <AnimatePresence>
                                  {showAISuggestion && !isGeneratingFields && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -10 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      <Alert className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800">
                                        <Sparkles className="h-4 w-4 text-emerald-600" />
                                        <AlertTitle className="text-emerald-900 dark:text-emerald-100 font-semibold">
                                          {t('demand.wizard.aiAssistantAvailable')}
                                        </AlertTitle>
                                        <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                                          <p className="mb-3">
                                            {t('demand.wizard.aiAssistantDesc')}
                                          </p>
                                          <div className="flex gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() => handleUseAIAssistance()}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                              data-testid="button-use-ai-assistance"
                                            >
                                              <Sparkles className="h-3 w-3 mr-1" />
                                              {t('demand.wizard.yesUseAi')}
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={handleDismissAISuggestion}
                                              className="border-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20"
                                              data-testid="button-dismiss-ai-suggestion"
                                            >
                                              {t('demand.wizard.noFillManually')}
                                            </Button>
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    </motion.div>
                                  )}

                                  {/* AI Processing State */}
                                  {isGeneratingFields && (
                                    <motion.div
                                      className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                    >
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      {t('demand.wizard.aiAnalyzing')}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Section 2: Current Challenges */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Current Challenges</h3>
                              <p className="text-[11px] text-muted-foreground">Describe the pain points and obstacles to address</p>
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name="currentChallenges"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.currentChallenges')}</FormLabel>
                                <GeneratedTextareaFrame title="AI Generated Content" value={String(field.value || '')}>
                                  <FormControl>
                                    <Textarea
                                      placeholder={t('demand.wizard.currentChallengesPlaceholder')}
                                      {...field}
                                      value={field.value || ""}
                                      rows={7}
                                      data-testid="textarea-challenges"
                                      className={`${FRIENDLY_TEXTAREA_CLASSNAME} min-h-[180px]`}
                                    />
                                  </FormControl>
                                </GeneratedTextareaFrame>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Section 3: Expected Outcomes & Success Criteria */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                              <TrendingUp className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Outcomes & Success Metrics</h3>
                              <p className="text-[11px] text-muted-foreground">Define measurable results and how success will be evaluated</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="expectedOutcomes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('demand.wizard.expectedOutcomes')}</FormLabel>
                                  <GeneratedTextareaFrame title="AI Generated Content" value={String(field.value || '')}>
                                    <FormControl>
                                      <Textarea
                                        placeholder={t('demand.wizard.expectedOutcomesPlaceholder')}
                                        {...field}
                                        value={field.value || ""}
                                        rows={6}
                                        data-testid="textarea-outcomes"
                                        className={`${FRIENDLY_TEXTAREA_CLASSNAME} min-h-[170px]`}
                                      />
                                    </FormControl>
                                  </GeneratedTextareaFrame>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="successCriteria"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('demand.wizard.successCriteria')}</FormLabel>
                                  <GeneratedTextareaFrame title="AI Generated Content" value={String(field.value || '')}>
                                    <FormControl>
                                      <Textarea
                                        placeholder={t('demand.wizard.successCriteriaPlaceholder')}
                                        {...field}
                                        value={field.value || ""}
                                        rows={6}
                                        data-testid="textarea-success-criteria"
                                        className={`${FRIENDLY_TEXTAREA_CLASSNAME} min-h-[170px]`}
                                      />
                                    </FormControl>
                                  </GeneratedTextareaFrame>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Section 4: Constraints & Limitations */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white shadow-sm">
                              <Shield className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Constraints & Limitations</h3>
                              <p className="text-[11px] text-muted-foreground">Identify boundaries, restrictions, and known limitations</p>
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name="constraints"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('demand.wizard.constraintsLimitations')}</FormLabel>
                                <GeneratedTextareaFrame title="AI Generated Content" value={String(field.value || '')}>
                                  <FormControl>
                                    <Textarea
                                      placeholder={t('demand.wizard.constraintsPlaceholder')}
                                      {...field}
                                      value={field.value || ""}
                                      rows={5}
                                      data-testid="textarea-constraints"
                                      className={`${FRIENDLY_TEXTAREA_CLASSNAME} min-h-[150px]`}
                                    />
                                  </FormControl>
                                </GeneratedTextareaFrame>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 3: Resource Information */}
                    {currentStep === 3 && (
                      <div className="space-y-5">
                        {/* Section: Team Capacity */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Team Capacity</h3>
                              <p className="text-[11px] text-muted-foreground">Current team readiness and resource availability</p>
                            </div>
                          </div>
                        <FormField
                          control={form.control}
                          name="currentCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('demand.wizard.currentTeamCapacity')}</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                                {getCapacityLevels().map((level) => (
                                  <motion.div
                                    key={level.value}
                                    className={`relative overflow-hidden p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      field.value === level.value
                                        ? "border-primary bg-primary/10 shadow-sm"
                                        : "border-muted hover:border-muted-foreground/50"
                                    }`}
                                    onClick={() => field.onChange(level.value)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <div
                                      className={`absolute inset-0 bg-gradient-to-r ${level.color} opacity-5`}
                                    />
                                    <div className="relative text-center">
                                      <div className="flex items-center justify-center gap-2 mb-2">
                                        {level.icon}
                                        <span className="font-semibold text-sm">
                                          {level.label}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mb-1">
                                        {level.description}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {level.subtext}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>

                        {/* Section: Budget & Timeline */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-sm">
                              <DollarSign className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Budget & Timeline</h3>
                              <p className="text-[11px] text-muted-foreground">Financial allocation and project delivery schedule</p>
                            </div>
                          </div>
                        <FormField
                          control={form.control}
                          name="budgetRange"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('demand.wizard.budgetRange')}</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                                {getBudgetRanges().map((budget) => (
                                  <motion.div
                                    key={budget.value}
                                    className={`relative overflow-hidden p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      field.value === budget.value
                                        ? "border-primary bg-primary/10 shadow-sm"
                                        : "border-muted hover:border-muted-foreground/50"
                                    }`}
                                    onClick={() => field.onChange(budget.value)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <div
                                      className={`absolute inset-0 bg-gradient-to-r ${budget.color} opacity-5`}
                                    />
                                    <div className="relative text-center">
                                      <div className="font-semibold text-sm">
                                        {budget.label}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {budget.description}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="timeframe"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('demand.wizard.projectTimeframe')}</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                                {getTimeframeOptions().map((timeframe) => (
                                  <motion.div
                                    key={timeframe.value}
                                    className={`relative overflow-hidden p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      field.value === timeframe.value
                                        ? "border-primary bg-primary/10 shadow-sm"
                                        : "border-muted hover:border-muted-foreground/50"
                                    }`}
                                    onClick={() =>
                                      field.onChange(timeframe.value)
                                    }
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <div
                                      className={`absolute inset-0 bg-gradient-to-r ${timeframe.color} opacity-5`}
                                    />
                                    <div className="relative text-center">
                                      <div className="flex items-center justify-center gap-2 mb-2">
                                        {timeframe.icon}
                                        <span className="font-semibold text-sm">
                                          {timeframe.label}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {timeframe.description}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>

                        {/* Section: Key Stakeholders */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                              <UserCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Key Stakeholders</h3>
                              <p className="text-[11px] text-muted-foreground">Decision-makers and key personnel involved</p>
                            </div>
                          </div>
                        <FormField
                          control={form.control}
                          name="stakeholders"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('demand.wizard.keyStakeholders')}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t('demand.wizard.stakeholdersPlaceholder')}
                                  {...field}
                                  value={field.value || ""}
                                  data-testid="textarea-stakeholders"
                                  className="min-h-[100px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                      </div>
                    )}

                    {/* Step 4: Technical Details with Multi-Select */}
                    {currentStep === 4 && (
                      <div className="space-y-5">
                        {/* Section: Systems & Integrations */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                              <Network className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Systems & Integrations</h3>
                              <p className="text-[11px] text-muted-foreground">Existing infrastructure and integration touchpoints</p>
                            </div>
                          </div>
                          <div className="space-y-5">
                            <MultiSelectChips
                              title={t('demand.wizard.existingSystemsTitle')}
                              options={systemTypeOptions}
                              selected={selectedSystems}
                              onChange={toggleSystemSelection}
                            />

                            {selectedSystems.length > 0 && (
                              <div className="rounded-xl border border-blue-200/70 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                                <div className="mb-3">
                                  <h4 className="text-sm font-semibold text-foreground">Technology Stack Behind Selected Systems</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Select the likely stack and add context so the business case can price, risk, and sequence the implementation more accurately.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {selectedSystems.map((systemValue) => {
                                    const systemLabel = systemLabelByValue[systemValue] || systemValue;
                                    return (
                                      <div key={systemValue} className="grid gap-3 rounded-lg border border-border/60 bg-background/80 p-3 md:grid-cols-[minmax(0,220px)_minmax(0,260px)_1fr]">
                                        <div>
                                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected system</div>
                                          <div className="mt-1 text-sm font-semibold">{systemLabel}</div>
                                        </div>
                                        <div>
                                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Potential technology stack</div>
                                          <Select
                                            value={technologyStackBySystem[systemValue] || "not-confirmed"}
                                            onValueChange={(value) => setTechnologyStackBySystem((current) => ({
                                              ...current,
                                              [systemValue]: value,
                                            }))}
                                          >
                                            <SelectTrigger className="h-10" data-testid={`select-system-stack-${systemValue}`}>
                                              <SelectValue placeholder="Select stack" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TECHNOLOGY_STACK_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">End-user note</div>
                                          <Textarea
                                            value={systemNotesBySystem[systemValue] || ""}
                                            onChange={(event) => setSystemNotesBySystem((current) => ({
                                              ...current,
                                              [systemValue]: event.target.value,
                                            }))}
                                            placeholder="Example: currently used by operations, must integrate with SSO, vendor contract expires next year..."
                                            className="min-h-[72px] resize-y text-sm"
                                            data-testid={`textarea-system-note-${systemValue}`}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <MultiSelectChips
                              title={t('demand.wizard.integrationRequirementsTitle')}
                              options={integrationTypeOptions}
                              selected={selectedIntegrations}
                              onChange={toggleIntegrationSelection}
                            />

                            {selectedIntegrations.length > 0 && (
                              <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                                <div className="mb-3">
                                  <h4 className="text-sm font-semibold text-foreground">Integration Technology Detail</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Select the likely implementation pattern and add any constraint the business case should consider for cost, delivery risk, and architecture sequencing.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {selectedIntegrations.map((integrationValue) => {
                                    const integrationLabel = integrationLabelByValue[integrationValue] || integrationValue;
                                    return (
                                      <div key={integrationValue} className="grid gap-3 rounded-lg border border-border/60 bg-background/80 p-3 md:grid-cols-[minmax(0,220px)_minmax(0,260px)_1fr]">
                                        <div>
                                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected integration</div>
                                          <div className="mt-1 text-sm font-semibold">{integrationLabel}</div>
                                        </div>
                                        <div>
                                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Technology stack / pattern</div>
                                          <Select
                                            value={integrationImplementationByType[integrationValue] || "not-confirmed"}
                                            onValueChange={(value) => setIntegrationImplementationByType((current) => ({
                                              ...current,
                                              [integrationValue]: value,
                                            }))}
                                          >
                                            <SelectTrigger className="h-10" data-testid={`select-integration-stack-${integrationValue}`}>
                                              <SelectValue placeholder="Select pattern" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {INTEGRATION_IMPLEMENTATION_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">End-user note</div>
                                          <Textarea
                                            value={integrationNotesByType[integrationValue] || ""}
                                            onChange={(event) => setIntegrationNotesByType((current) => ({
                                              ...current,
                                              [integrationValue]: event.target.value,
                                            }))}
                                            placeholder="Example: preferred vendor connector, near real-time SLA, one-way sync, data owner approval needed..."
                                            className="min-h-[72px] resize-y text-sm"
                                            data-testid={`textarea-integration-note-${integrationValue}`}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section: Compliance & Risk */}
                        <div className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-white shadow-sm">
                              <Shield className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">Compliance & Risk</h3>
                              <p className="text-[11px] text-muted-foreground">Regulatory requirements and risk assessment factors</p>
                            </div>
                          </div>
                          <div className="space-y-5">
                            <MultiSelectChips
                              title={t('demand.wizard.complianceRequirementsTitle')}
                              options={complianceStandardOptions}
                              selected={selectedCompliance}
                              onChange={(value) =>
                                toggleSelection(
                                  value,
                                  selectedCompliance,
                                  setSelectedCompliance,
                                )
                              }
                            />

                            <MultiSelectChips
                              title={t('demand.wizard.riskFactorsTitle')}
                              options={riskCategoryOptions}
                              selected={selectedRisks}
                              onChange={(value) =>
                                toggleSelection(
                                  value,
                                  selectedRisks,
                                  setSelectedRisks,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between pt-6 mt-2 border-t border-border/60">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="flex items-center gap-2 h-10"
                        data-testid="button-wizard-previous"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('demand.wizard.previous')}
                      </Button>

                      <div className="text-xs font-medium text-muted-foreground tracking-wide">
                        {t('demand.wizard.stepOf', { current: currentStep, total: getSteps().length })}
                      </div>

                      {currentStep < getSteps().length ? (
                        <Button
                          type="button"
                          onClick={nextStep}
                          className="flex items-center gap-2 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
                          data-testid="button-wizard-continue"
                        >
                          {t('demand.wizard.continue')}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={createReportMutation.isPending}
                          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white"
                          data-testid="button-create-report"
                        >
                          {createReportMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Rocket className="h-4 w-4" />
                          )}
                          {createReportMutation.isPending
                            ? t('demand.wizard.processingRequest')
                            : t('demand.wizard.submitDemandRequest')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
            <Dialog
              open={showAiClarificationPrompts && aiClarificationPrompts.length > 0}
              onOpenChange={(open) => setShowAiClarificationPrompts(open)}
            >
              <DialogContent className="flex max-h-[94vh] w-[min(98vw,96rem)] max-w-7xl flex-col overflow-y-auto border-amber-200 p-0 dark:border-amber-800">
                {(() => {
                  const l4 = getLayer4DialogLabels(Boolean(pendingSubmitReviewData));
                  return (
                <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1.15fr)]">
                  <div className="border-b border-amber-200 bg-gradient-to-b from-amber-100/80 via-amber-50/80 to-background p-6 dark:border-amber-800 dark:from-amber-950/40 dark:via-amber-950/20 dark:to-background lg:border-b-0 lg:border-r">
                    <div className="space-y-4">
                      <Badge variant="outline" className="w-fit border-amber-300 bg-amber-100/80 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                        <AlertCircle className="mr-1 h-3.5 w-3.5" />
                        {l4.badge}
                      </Badge>
                      <DialogHeader className="space-y-3 text-left">
                        <DialogTitle className="text-xl text-amber-950 dark:text-amber-50">
                          {l4.title}
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
                          {l4.description}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-2xl border border-amber-200/80 bg-background/80 p-4 dark:border-amber-800 dark:bg-background/60">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                          {l4.itemsLabel}
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-foreground">
                          {aiClarificationPrompts.length}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {l4.itemsSummary}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
                          Demand Agent assist
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Let the Demand Agent draft only the missing Layer 4 content from the current demand context. Review the generated values directly in each field, adjust if needed, then approve.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col bg-background">
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {aiClarificationPrompts.map((item) => renderClarificationInput(item))}
                      </div>
                    </div>
                    <DialogFooter className="sticky bottom-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAiClarificationPrompts(false)}
                        data-testid="button-dismiss-ai-clarifications-dialog"
                      >
                        {l4.dismissLabel}
                      </Button>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button
                          type="button"
                          onClick={handleGenerateMissingContentWithDemandAgent}
                          variant="outline"
                          disabled={isGeneratingFields}
                          data-testid="button-generate-missing-content-with-demand-agent"
                        >
                          {isGeneratingFields ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {l4.generateLabel}
                        </Button>
                        {pendingSubmitReviewData ? (
                          <Button
                            type="button"
                            onClick={handleSubmitAfterLayer4Review}
                            disabled={createReportMutation.isPending || isResumingDecision}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            data-testid="button-submit-demand-after-layer4-review"
                          >
                            {createReportMutation.isPending || isResumingDecision ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Approve Layer 4 details and submit demand
                          </Button>
                        ) : null}
                      </div>
                    </DialogFooter>
                  </div>
                </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </form>
        </Form>
      </div>
    </div>
    <Dialog open={showInternalEngineNote} onOpenChange={setShowInternalEngineNote}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            Engine A will process this request
          </DialogTitle>
          <DialogDescription>
            This demand is marked as confidential or sovereign-sensitive. Corevia will use Engine A for local processing instead of the hybrid route.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Your AI assistance request will stay on the internal reasoning path, which is slower but designed for sensitive government content.
          </p>
          <p>
            Selected classification: <span className="font-medium text-foreground capitalize">{String(selectedDataClassification || "sovereign").replace("_", " ")}</span>
          </p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setShowInternalEngineNote(false)}>
            Cancel
          </Button>
          <Button onClick={confirmInternalEngineAIAssistance} className="bg-amber-600 hover:bg-amber-700 text-white">
            Continue with Engine A
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </Can>
  );
}
