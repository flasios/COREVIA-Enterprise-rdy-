/**
 * COREVIA Brain — Shared UI Utilities
 * Canonical constants, helpers, and type definitions for Brain UI
 */

// ==================== LAYER DEFINITIONS ====================
export const BRAIN_LAYERS = [
  { id: 0, key: "initiation", name: "Demand Initiation", short: "L0", icon: "Zap", color: "slate" },
  { id: 1, key: "intake", name: "Intake & Canonicalization", short: "L1", icon: "ArrowDownToLine", color: "blue" },
  { id: 2, key: "classification", name: "Classification & Sensitivity", short: "L2", icon: "Shield", color: "purple" },
  { id: 3, key: "policyops", name: "Policy & Governance", short: "L3", icon: "Scale", color: "amber" },
  { id: 4, key: "context", name: "Context Readiness", short: "L4", icon: "Search", color: "cyan" },
  { id: 5, key: "routing", name: "Intelligence Routing", short: "L5", icon: "Route", color: "indigo" },
  { id: 6, key: "intelligence", name: "Governed Intelligence", short: "L6", icon: "Brain", color: "violet" },
  { id: 7, key: "approval", name: "Authority Validation (HITL)", short: "L7", icon: "UserCheck", color: "orange" },
  { id: 8, key: "memory", name: "Memory, Learning & Controlled Execution", short: "L8", icon: "BookOpen", color: "teal" },
] as const;

// ==================== STATUS ====================
export type BrainStatus = 
  | "intake" | "classification" | "policy_check" | "context_check"
  | "orchestration" | "reasoning" | "processing" | "validation"
  | "pending_approval" | "action_execution" | "memory" | "completed"
  | "blocked" | "needs_info" | "rejected" | "cancelled";

export const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string; dotClass: string }> = {
  intake: { label: "Intake", color: "blue", bgClass: "bg-blue-50 text-blue-700 border-blue-200", dotClass: "bg-blue-500" },
  classification: { label: "Classifying", color: "purple", bgClass: "bg-purple-50 text-purple-700 border-purple-200", dotClass: "bg-purple-500" },
  policy_check: { label: "Policy Check", color: "amber", bgClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" },
  context_check: { label: "Context Check", color: "cyan", bgClass: "bg-cyan-50 text-cyan-700 border-cyan-200", dotClass: "bg-cyan-500" },
  orchestration: { label: "Routing", color: "indigo", bgClass: "bg-indigo-50 text-indigo-700 border-indigo-200", dotClass: "bg-indigo-500" },
  reasoning: { label: "Analyzing", color: "violet", bgClass: "bg-violet-50 text-violet-700 border-violet-200", dotClass: "bg-violet-500" },
  processing: { label: "Processing", color: "violet", bgClass: "bg-violet-50 text-violet-700 border-violet-200", dotClass: "bg-violet-500 animate-pulse" },
  validation: { label: "Awaiting Approval", color: "orange", bgClass: "bg-orange-50 text-orange-700 border-orange-200", dotClass: "bg-orange-500 animate-pulse" },
  pending_approval: { label: "Pending Approval", color: "orange", bgClass: "bg-orange-50 text-orange-700 border-orange-200", dotClass: "bg-orange-500 animate-pulse" },
  action_execution: { label: "Executing", color: "emerald", bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500 animate-pulse" },
  memory: { label: "Memory", color: "teal", bgClass: "bg-teal-50 text-teal-700 border-teal-200", dotClass: "bg-teal-500" },
  completed: { label: "Completed", color: "green", bgClass: "bg-green-50 text-green-700 border-green-200", dotClass: "bg-green-500" },
  blocked: { label: "Blocked", color: "red", bgClass: "bg-red-50 text-red-700 border-red-200", dotClass: "bg-red-500" },
  needs_info: { label: "Needs Info", color: "yellow", bgClass: "bg-yellow-50 text-yellow-700 border-yellow-200", dotClass: "bg-yellow-500" },
  rejected: { label: "Rejected", color: "red", bgClass: "bg-red-50 text-red-700 border-red-200", dotClass: "bg-red-500" },
  cancelled: { label: "Cancelled", color: "gray", bgClass: "bg-gray-50 text-gray-700 border-gray-200", dotClass: "bg-gray-400" },
};

// ==================== CLASSIFICATION ====================
export const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string; bgClass: string; icon: string }> = {
  PUBLIC: { label: "Public", color: "green", bgClass: "bg-green-100 text-green-800", icon: "Globe" },
  INTERNAL: { label: "Internal", color: "blue", bgClass: "bg-blue-100 text-blue-800", icon: "Building" },
  CONFIDENTIAL: { label: "Confidential", color: "amber", bgClass: "bg-amber-100 text-amber-800", icon: "Lock" },
  SOVEREIGN: { label: "Sovereign", color: "red", bgClass: "bg-red-100 text-red-800", icon: "Shield" },
  HIGH_SENSITIVE: { label: "High Sensitive", color: "rose", bgClass: "bg-rose-100 text-rose-900", icon: "ShieldAlert" },
  // Handle lowercase variants
  public: { label: "Public", color: "green", bgClass: "bg-green-100 text-green-800", icon: "Globe" },
  internal: { label: "Internal", color: "blue", bgClass: "bg-blue-100 text-blue-800", icon: "Building" },
  confidential: { label: "Confidential", color: "amber", bgClass: "bg-amber-100 text-amber-800", icon: "Lock" },
  sovereign: { label: "Sovereign", color: "red", bgClass: "bg-red-100 text-red-800", icon: "Shield" },
  high_sensitive: { label: "High Sensitive", color: "rose", bgClass: "bg-rose-100 text-rose-900", icon: "ShieldAlert" },
};

// ==================== ENGINE TYPES ====================
export const ENGINE_CONFIG: Record<string, { label: string; short: string; color: string; icon: string; description: string }> = {
  SOVEREIGN_INTERNAL: {
    label: "Sovereign Internal",
    short: "Engine A",
    color: "emerald",
    icon: "Server",
    description: "RAG + rules + scoring. No external calls. For SOVEREIGN/HIGH_SENSITIVE data.",
  },
  EXTERNAL_HYBRID: {
    label: "External Hybrid",
    short: "Engine B",
    color: "blue",
    icon: "Cloud",
    description: "Claude via Redaction Gateway. For PUBLIC/INTERNAL data with masking.",
  },
  DISTILLATION: {
    label: "Distillation",
    short: "Engine C",
    color: "purple",
    icon: "Sparkles",
    description: "Learning engine. Creates versioned assets from approved decisions only.",
  },
  R1_LEARNING: {
    label: "R1 Autonomous Learning",
    short: "Engine D",
    color: "teal",
    icon: "GraduationCap",
    description: "DeepSeek R1 reasoning engine. Auto-analyzes decisions, generates assumptions, identifies patterns, and creates reasoning heuristics.",
  },
};

// ==================== HELPERS ====================
export function safeLower(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.toLowerCase();
  if (typeof val === "object" && "classificationLevel" in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).classificationLevel || "").toLowerCase();
  }
  return String(val).toLowerCase();
}

export function getStatusConfig(status: string | undefined | null) {
  if (!status) return STATUS_CONFIG.intake;
  const key = safeLower(status);
  return STATUS_CONFIG[key] || STATUS_CONFIG.intake;
}

export function getClassificationConfig(cls: string | undefined | null) {
  if (!cls) return CLASSIFICATION_CONFIG.INTERNAL;
  const normalized = typeof cls === "object" ? (cls as any).classificationLevel || "INTERNAL" : cls; // eslint-disable-line @typescript-eslint/no-explicit-any
  return CLASSIFICATION_CONFIG[normalized] || CLASSIFICATION_CONFIG.INTERNAL;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-AE", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatRelativeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(dateStr);
  } catch {
    return "—";
  }
}

export function getLayerForStatus(status: string | undefined): number {
  const map: Record<string, number> = {
    intake: 1, classification: 2, policy_check: 3, context_check: 4,
    orchestration: 5, reasoning: 6, processing: 6, validation: 7,
    pending_approval: 7, action_execution: 8, memory: 8, completed: 8,
    blocked: 3, needs_info: 4, rejected: 7,
  };
  return map[safeLower(status)] || 0;
}

export function extractProjectName(d: unknown): string {
  const data = (d && typeof d === "object") ? (d as Record<string, unknown>) : {};
  const input = (data.normalizedInput ?? data.inputData ?? data.input ?? {}) as Record<string, unknown>;
  return String(input.suggestedProjectName ?? input.projectName ?? input.title ?? input.name ?? data.title ?? "Untitled");
}

export function extractServiceLabel(d: unknown): string {
  const data = (d && typeof d === "object") ? (d as Record<string, unknown>) : {};
  const serviceId = String(data.serviceId ?? data.useCaseType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  // Journey hierarchy labels
  const journeyMap: Record<string, string> = {
    requirements_analysis: "DEMAND_DECISION",
    detailed_requirements: "DEMAND_DECISION",
    demand_management: "DEMAND_REQUEST",
    demand_request: "DEMAND_REQUEST",
    demand_intake: "DEMAND_REQUEST",
    demand_analysis: "DEMAND_REQUEST",
    business_case: "BUSINESS_CASE",
    strategic_fit: "STRATEGIC_FIT",
    assessment: "ASSESSMENT",
    closure_report: "CLOSURE_DECISION",
    lessons_learned: "LESSONS_LEARNED",
    final_assessment: "FINAL_ASSESSMENT",
    portfolio: "Portfolio",
    generic: "General Analysis",
  };
  for (const [key, label] of Object.entries(journeyMap)) {
    if (serviceId.includes(key)) return label;
  }
  return serviceId || "Unknown";
}
