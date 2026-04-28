import type { AIDeps } from "./buildDeps";
import type { IntelResult } from "./shared";


// ========================================================================
//  AI USE-CASES  (evaluate-evidence, task guidance, deployment, translate,
//                 coveria-generate-demand)
// ========================================================================

/* ── helpers shared across AI use-cases ──────────────────────── */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}


function safePart(value: unknown, maxLen = 40): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLen);
}


/* ── Evaluate Evidence ───────────────────────────────────────── */

export interface EvidenceAnalysis {
  completenessScore: number;
  qualityScore: number;
  relevanceScore: number;
  overallScore: number;
  findings: string[];
  recommendations: string[];
  riskFlags: string[];
  complianceNotes: string[];
  analyzedAt: string;
}


export async function evaluateEvidence(
  deps: Pick<AIDeps, "brainDraft">,
  body: {
    taskId?: string;
    taskName?: string;
    taskDescription?: string;
    deliverables?: string[];
    evidence?: unknown[];
  },
  userId: string,
): Promise<IntelResult<EvidenceAnalysis>> {
  const { taskId, taskName, taskDescription, deliverables, evidence } = body;

  try {
    const draft = await deps.brainDraft.generateBrainDraftArtifact({
      decisionSpineId: taskId
        ? `DSP-EVIDENCE-${safePart(taskId) || String(taskId)}`
        : `DSP-EVIDENCE-${userId}-${todayISO()}`,
      serviceId: "portfolio_ai",
      routeKey: "portfolio.evidence.evaluate",
      artifactType: "EVIDENCE_EVALUATION",
      inputData: {
        taskId,
        taskName,
        taskDescription,
        deliverables,
        evidence: evidence || [],
        intent: `Evaluate evidence for task: ${taskName || taskId}`,
      },
      userId,
    });

    return { success: true, data: draft.content as EvidenceAnalysis };
  } catch {
    // Fallback scoring
    const evidenceCount = (evidence ?? []).length;
    const hasFileType = (item: unknown, match: string): boolean => {
      if (typeof item !== "object" || item === null || !("fileType" in item)) return false;
      const fileType = (item as { fileType?: unknown }).fileType;
      return typeof fileType === "string" && fileType.includes(match);
    };
    const hasDocumentation = (evidence ?? []).some(
      (item) => hasFileType(item, "pdf") || hasFileType(item, "word"),
    );
    const hasVisualEvidence = (evidence ?? []).some((item) => hasFileType(item, "image"));

    const completenessScore = Math.min(100, 40 + evidenceCount * 15 + (hasDocumentation ? 20 : 0));
    const qualityScore = Math.min(100, 50 + evidenceCount * 10 + (hasDocumentation ? 25 : 0));
    const relevanceScore = Math.min(100, 60 + evidenceCount * 10 + (hasVisualEvidence ? 15 : 0));
    const overallScore = Math.round((completenessScore + qualityScore + relevanceScore) / 3);

    const analysis: EvidenceAnalysis = {
      completenessScore,
      qualityScore,
      relevanceScore,
      overallScore,
      findings: [
        `${evidenceCount} evidence file(s) provided for task "${taskName}"`,
        hasDocumentation ? "Documentation evidence detected - excellent for audit compliance" : "Consider adding formal documentation",
        hasVisualEvidence ? "Visual evidence included - supports verification" : "Visual proof (screenshots, photos) would strengthen the evidence",
        (deliverables?.length ?? 0) > 0 ? `Task has ${deliverables!.length} defined deliverable(s) to validate against` : "No specific deliverables defined for validation",
      ].filter(Boolean) as string[],
      recommendations: [
        overallScore < 60 ? "Upload additional supporting documentation to improve evidence score" : null,
        !hasDocumentation ? "Add PDF or Word documents for formal sign-off records" : null,
        !hasVisualEvidence ? "Include screenshots or photos as visual proof of completion" : null,
        "Ensure evidence directly addresses each deliverable requirement",
        "Add descriptions to evidence files for better traceability",
      ].filter(Boolean) as string[],
      riskFlags: [
        evidenceCount === 0 ? "No evidence uploaded - task completion cannot be verified" : null,
        overallScore < 40 ? "Evidence score below acceptable threshold for gate approval" : null,
        !hasDocumentation && (deliverables?.length ?? 0) > 2 ? "Complex task lacks formal documentation" : null,
      ].filter(Boolean) as string[],
      complianceNotes: [],
      analyzedAt: new Date().toISOString(),
    };

    return { success: true, data: analysis };
  }
}


/* ── Task Completion Advisor (+ fallback guidance) ───────────── */

function generateFallbackTaskGuidance(context: {
  taskName?: string;
  taskDescription?: string;
  taskType?: string;
  priority?: string;
  status?: string;
  percentComplete?: number;
  projectName?: string;
  deliverables?: string[];
  linkedRisksCount?: number;
  linkedIssuesCount?: number;
}) {
  const { taskName, taskDescription, taskType, priority, status, percentComplete, projectName, deliverables, linkedRisksCount, linkedIssuesCount } = context;
  const isHighPriority = ["high", "urgent", "critical"].includes(String(priority || "").toLowerCase());
  const isMilestone = taskType === "milestone";
  const hasRisks = (linkedRisksCount || 0) > 0;
  const hasIssues = (linkedIssuesCount || 0) > 0;
  const isInProgress = status === "in_progress";
  const deliverablesText = deliverables?.join(", ") || "Not specified";

  return {
    taskSnapshot: {
      purpose: taskDescription || `"${taskName}" is a ${isHighPriority ? "high-priority" : ""} ${isMilestone ? "milestone" : "task"} in ${projectName || "this project"} that drives progress toward project objectives.`,
      currentState: isInProgress
        ? `Currently ${percentComplete}% complete. ${hasRisks ? `${linkedRisksCount} linked risk(s) require monitoring.` : ""} ${hasIssues ? `${linkedIssuesCount} open issue(s) need resolution.` : ""}`
        : `Status: ${status || "Pending"}. Ready to begin execution.`,
    },
    strategicInsights: [
      { title: isHighPriority ? "Critical Path Focus" : "Value Delivery Focus", description: `For "${taskName}", ${isHighPriority ? "prioritize speed and accuracy to maintain schedule integrity" : "focus on delivering the core value to stakeholders"}. ${deliverablesText !== "Not specified" ? `Key deliverables: ${deliverablesText}` : ""}`, impact: isHighPriority ? "high" : "medium" },
      { title: "Stakeholder Engagement", description: `Maintain clear communication with stakeholders on "${taskName}" progress. ${isMilestone ? "As a milestone, this task requires formal sign-off." : "Regular updates build confidence and surface issues early."}`, impact: isMilestone ? "high" : "medium" },
      { title: "Quality Assurance", description: `Ensure deliverables meet defined acceptance criteria before marking complete. ${(percentComplete || 0) >= 75 ? "With " + percentComplete + "% progress, focus on final quality checks." : "Build quality checks into each phase."}`, impact: "high" },
    ],
    innovationOpportunities: [
      { title: "Process Streamlining", description: `Identify and eliminate non-value-added steps in "${taskName}" execution workflow`, category: "process" },
      { title: "Documentation Automation", description: "Use templates and automation to reduce documentation overhead", category: "automation" },
      { title: "Knowledge Capture", description: `Document lessons learned from "${taskName}" for organizational benefit and future projects`, category: "process" },
      { title: "Stakeholder Collaboration", description: "Leverage digital collaboration tools for faster feedback cycles", category: "technology" },
    ],
    risksAndBlindSpots: hasRisks
      ? [
          { title: `${linkedRisksCount} linked risk(s) require attention`, likelihood: "high", impact: "medium", mitigation: "Review and update risk mitigation plans. Escalate blockers immediately." },
          { title: "Dependency delays", likelihood: "medium", impact: "high", mitigation: "Verify predecessor tasks are complete. Identify alternative paths if blocked." },
        ]
      : [
          { title: "Scope creep potential", likelihood: "medium", impact: "medium", mitigation: "Maintain clear scope boundaries. Document change requests formally." },
          { title: "Resource availability", likelihood: "medium", impact: "medium", mitigation: "Confirm resource allocation. Have backup resources identified." },
        ],
    enablementToolkit: [
      { name: "Task Completion Checklist", description: `Track all required elements for "${taskName}" completion`, category: "tool" },
      { name: "Stakeholder Communication Plan", description: "Template for structured progress updates", category: "document" },
      { name: "Quality Review Template", description: `Checklist for verifying deliverable quality ${deliverablesText !== "Not specified" ? "against: " + deliverablesText : ""}`, category: "document" },
    ],
    accelerationPlaybook: [
      { title: "Daily Stand-up Review", description: `Brief daily check on "${taskName}" blockers and progress`, timeToImplement: "Immediate" },
      { title: "Parallel Workstreams", description: "Identify task elements that can proceed simultaneously", timeToImplement: "1-2 days" },
      { title: "Early Deliverable Review", description: "Share draft deliverables early for feedback, reducing rework", timeToImplement: "This week" },
    ],
  };
}


export async function getTaskCompletionGuidance(
  deps: Pick<AIDeps, "brainDraft">,
  body: Record<string, unknown>,
  userId: string,
): Promise<IntelResult<unknown>> {
  const {
    taskName, taskDescription, taskType, priority, status,
    deliverables, percentComplete, plannedStartDate, plannedEndDate,
    linkedRisksCount, linkedIssuesCount, projectName,
  } = body;

  let guidance: unknown;
  try {
    const draft = await deps.brainDraft.generateBrainDraftArtifact({
      decisionSpineId: `DSP-TASK-GUIDANCE-${userId}-${todayISO()}`,
      serviceId: "portfolio_ai",
      routeKey: "portfolio.task.guidance",
      artifactType: "TASK_COMPLETION_GUIDANCE",
      inputData: {
        taskName, taskDescription, taskType, priority, status,
        percentComplete, projectName, deliverables,
        plannedStartDate, plannedEndDate,
        linkedRisksCount, linkedIssuesCount,
        intent: `Provide task completion guidance for: ${taskName}`,
      },
      userId,
    });
    guidance = draft.content;
  } catch {
    guidance = generateFallbackTaskGuidance({
      taskName: taskName as string | undefined,
      taskDescription: taskDescription as string | undefined,
      taskType: taskType as string | undefined,
      priority: priority as string | undefined,
      status: status as string | undefined,
      percentComplete: percentComplete as number | undefined,
      projectName: projectName as string | undefined,
      deliverables: deliverables as string[] | undefined,
      linkedRisksCount: linkedRisksCount as number | undefined,
      linkedIssuesCount: linkedIssuesCount as number | undefined,
    });
  }

  (guidance as Record<string, unknown>).generatedAt = new Date().toISOString();
  return { success: true, data: guidance };
}


/* ── Deployment Strategy Recommendation ──────────────────────── */

export function generateDeploymentStrategy(
  body: Record<string, unknown>,
): IntelResult<unknown> {
  const {
    projectName, projectType, taskCount: _taskCount, completedTasks: _completedTasks,
    hasIntegrations, hasMigration, hasTraining, taskType, taskPriority,
  } = body;

  const taskCount = typeof _taskCount === "number" ? _taskCount : 0;
  const completedTasks = typeof _completedTasks === "number" ? _completedTasks : 0;
  const isTaskLevel = taskCount === 1;
  const completionRate = taskCount > 0 ? (completedTasks / taskCount) * 100 : 0;
  const isComplex = !!hasIntegrations || !!hasMigration;
  const isCritical = taskPriority === "critical" || String(projectType ?? "").toLowerCase().includes("critical") || String(taskType ?? "").toLowerCase().includes("milestone");
  const isMilestone = taskType === "milestone";

  let primaryStrategyId = "phased";
  let projectFitAnalysis = "";

  if (isTaskLevel) {
    if (isMilestone) {
      primaryStrategyId = "parallel";
      projectFitAnalysis = `This milestone task "${projectName}" requires careful validation. A Parallel Running approach allows verification against existing systems before full transition.`;
    } else if (isCritical) {
      primaryStrategyId = "blue-green";
      projectFitAnalysis = `Critical task "${projectName}" benefits from Blue-Green deployment for instant rollback capability.`;
    } else if (hasIntegrations) {
      primaryStrategyId = "canary";
      projectFitAnalysis = `Task "${projectName}" involves integrations. A Canary Release allows gradual rollout to validate integration points.`;
    } else if (hasMigration) {
      primaryStrategyId = "parallel";
      projectFitAnalysis = `Data migration in task "${projectName}" requires Parallel Running to validate data integrity.`;
    } else {
      primaryStrategyId = "rolling";
      projectFitAnalysis = `Task "${projectName}" is suitable for Rolling Deployment with gradual implementation.`;
    }
  } else {
    if (isCritical && hasMigration) {
      primaryStrategyId = "parallel";
      projectFitAnalysis = `Given the critical nature of "${projectName}" and data migration requirements, Parallel Running is recommended.`;
    } else if (isComplex && hasIntegrations) {
      primaryStrategyId = "phased";
      projectFitAnalysis = `With ${taskCount} tasks and integration dependencies, "${projectName}" is best suited for a Phased Rollout.`;
    } else if (!isComplex && !hasMigration) {
      primaryStrategyId = "canary";
      projectFitAnalysis = `"${projectName}" has a manageable scope. A Canary Release will allow rapid deployment with monitoring.`;
    } else if (hasTraining) {
      primaryStrategyId = "phased";
      projectFitAnalysis = `Training requirements indicate user adoption is critical. A Phased Rollout aligned with training schedules is recommended.`;
    }
  }

  const strategies = [
    { id: "big-bang", name: "Big Bang Deployment", description: "Complete system replacement at once", suitabilityScore: isCritical ? 20 : isComplex ? 40 : 70, pros: ["Simple execution", "Single cutover event", "No parallel systems"], cons: ["High risk", "No rollback safety net", "All-or-nothing"], riskLevel: "high" as const, estimatedDuration: "1-2 days", requiredResources: ["Full team on standby", "Extended support hours"], bestFor: ["Small systems", "Non-critical applications"] },
    { id: "phased", name: "Phased Rollout", description: "Deploy in planned phases by module or user group", suitabilityScore: isComplex ? 90 : hasTraining ? 85 : 75, pros: ["Controlled risk", "Learn from each phase", "Manageable scope"], cons: ["Longer timeline", "Integration complexity", "Parallel support needed"], riskLevel: "medium" as const, estimatedDuration: "2-8 weeks", requiredResources: ["Phase coordinators", "Integration testing team"], bestFor: ["Large enterprises", "Multiple locations", "Complex integrations"] },
    { id: "parallel", name: "Parallel Running", description: "Old and new systems run simultaneously", suitabilityScore: isCritical ? 95 : hasMigration ? 90 : 60, pros: ["Safest approach", "Data validation", "Easy rollback"], cons: ["Resource intensive", "Data sync challenges", "User confusion possible"], riskLevel: "low" as const, estimatedDuration: "4-12 weeks", requiredResources: ["Double infrastructure", "Data reconciliation team"], bestFor: ["Critical systems", "Financial applications", "Regulatory compliance"] },
    { id: "canary", name: "Canary Release", description: "Deploy to small subset, monitor, then expand", suitabilityScore: !isComplex ? 85 : 65, pros: ["Early detection", "Limited blast radius", "Quick rollback"], cons: ["Requires feature flags", "Complex routing"], riskLevel: "low" as const, estimatedDuration: "1-4 weeks", requiredResources: ["Feature flag system", "A/B testing infrastructure"], bestFor: ["Web applications", "SaaS products", "Continuous delivery"] },
    { id: "blue-green", name: "Blue-Green Deployment", description: "Two identical environments with instant switchover", suitabilityScore: hasIntegrations ? 80 : 70, pros: ["Zero downtime", "Instant rollback", "Full production testing"], cons: ["Double infrastructure cost", "Database sync complexity"], riskLevel: "low" as const, estimatedDuration: "1-3 days", requiredResources: ["Duplicate environment", "Load balancer control"], bestFor: ["High availability systems", "E-commerce", "APIs"] },
    { id: "rolling", name: "Rolling Deployment", description: "Gradually replace instances one at a time", suitabilityScore: 65, pros: ["No downtime", "Gradual validation", "Resource efficient"], cons: ["Version mixing during rollout", "Session management complexity"], riskLevel: "medium" as const, estimatedDuration: "2-7 days", requiredResources: ["Orchestration tools", "Health monitoring"], bestFor: ["Microservices", "Container environments", "Stateless apps"] },
  ];

  const primaryStrategy = strategies.find((s) => s.id === primaryStrategyId) || strategies[1];
  const alternativeStrategies = strategies.filter((s) => s.id !== primaryStrategyId).sort((a, b) => b.suitabilityScore - a.suitabilityScore).slice(0, 3);

  return {
    success: true,
    data: {
      primaryStrategy,
      alternativeStrategies,
      projectFitAnalysis,
      keyConsiderations: [
        `Project completion: ${Math.round(completionRate)}% of ${taskCount} tasks completed`,
        hasIntegrations ? "Integration dependencies require careful sequencing" : "No major integration dependencies identified",
        hasMigration ? "Data migration requires parallel running or extended validation" : "No data migration complexity",
        hasTraining ? "User training should align with deployment phases" : "Minimal user training requirements",
      ],
      implementationSteps: [
        "Finalize deployment environment and infrastructure",
        "Complete pre-deployment checklist and quality gates",
        "Execute deployment according to selected strategy",
        "Monitor system health and user feedback",
        "Conduct post-deployment validation and sign-off",
        "Document lessons learned for future deployments",
      ],
      riskMitigation: [
        "Prepare rollback procedures and test in staging",
        "Establish communication plan for all stakeholders",
        "Define success criteria and monitoring thresholds",
        "Schedule deployment during low-traffic periods",
      ],
      generatedAt: new Date().toISOString(),
    },
  };
}


/* ── Translate ───────────────────────────────────────────────── */

export async function translateText(
  deps: Pick<AIDeps, "brainDraft">,
  body: { text?: string; from?: string; to?: string },
  userId: string,
): Promise<IntelResult<{ translatedText: string; originalText: string; from: string; to: string }>> {
  const { text, from, to } = body;
  if (!text || !from || !to) {
    return { success: false, error: "Missing required parameters: text, from, to", status: 400 };
  }

  const draft = await deps.brainDraft.generateBrainDraftArtifact({
    decisionSpineId: `DSP-TRANSLATE-${userId}-${todayISO()}`,
    serviceId: "language",
    routeKey: "language.translate",
    artifactType: "TRANSLATION",
    inputData: { text, from, to, intent: `Translate text from ${from} to ${to}` },
    userId,
  });

  const draftContent = (draft.content || {}) as Record<string, unknown>;
  const translatedText = typeof draftContent.translatedText === "string" ? draftContent.translatedText : text;

  return { success: true, data: { translatedText, originalText: text, from, to } };
}


/* ── Coveria Generate Demand ─────────────────────────────────── */

export async function coveriaGenerateDemand(
  deps: Pick<AIDeps, "brainDraft">,
  body: {
    description?: string;
    requestorName?: string;
    requestorEmail?: string;
    department?: string;
    departmentName?: string;
    organizationName?: string;
    organizationType?: string;
  },
  userId: string,
): Promise<IntelResult<{ demandData: Record<string, unknown>; aiMetadata: { citations: null; confidence: number | null; isFallback?: boolean; fallbackReason?: string | null } }>> {
  const { description, requestorName, requestorEmail, departmentName, organizationName, organizationType } = body;
  const department = body.department || departmentName;
  if (!description) {
    return { success: false, error: "Description is required", status: 400 };
  }

  const draft = await deps.brainDraft.generateBrainDraftArtifact({
    decisionSpineId: `DSP-COVERIA-DEMAND-${Date.now()}`,
    serviceId: "demand_analysis",
    routeKey: "demand.generate_fields",
    artifactType: "DEMAND_FIELDS",
    inputData: {
      businessObjective: description,
      userId,
      accessLevel: "all",
      intent: "Generate demand fields from natural language description",
      // Include org/contact context so AI can produce accurate, context-aware output
      ...(requestorName ? { requestorName } : {}),
      ...(requestorEmail ? { requestorEmail } : {}),
      ...(department ? { department } : {}),
      ...(departmentName ? { departmentName } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(organizationType ? { organizationType, industryType: organizationType } : {}),
      requesterContext: {
        userId,
        requestorName: requestorName || null,
        requestorEmail: requestorEmail || null,
        organizationName: organizationName || null,
        organizationType: organizationType || null,
        department: department || null,
      },
    },
    userId,
  });

  const content = (draft.content || {}) as Record<string, unknown>;

  const pickString = (...keys: string[]): string => {
    for (const key of keys) {
      const v = content[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const pickAny = (...keys: string[]): unknown => {
    for (const key of keys) {
      const v = content[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  };
  const toText = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      const items = value
        .map((v) => {
          if (v == null) return "";
          if (typeof v === "string") return v.trim();
          if (typeof v === "object") {
            const rec = v as Record<string, unknown>;
            const label = rec.title || rec.name || rec.label;
            return typeof label === "string" ? label.trim() : JSON.stringify(v);
          }
          return String(v);
        })
        .filter(Boolean);
      return items.length <= 1 ? (items[0] ?? "") : items.map((i) => `- ${i}`).join("\n");
    }
    try { return JSON.stringify(value); } catch { return String(value); }
  };

  const urgencyMatch = description.toLowerCase();
  let urgency = "Medium";
  if (urgencyMatch.includes("urgent") || urgencyMatch.includes("critical") || urgencyMatch.includes("asap") || urgencyMatch.includes("immediate")) {
    urgency = "Critical";
  } else if (urgencyMatch.includes("priority") || urgencyMatch.includes("important")) {
    urgency = "High";
  } else if (urgencyMatch.includes("low priority") || urgencyMatch.includes("not urgent")) {
    urgency = "Low";
  }

  const demandData: Record<string, unknown> = {
    organizationName: organizationName || pickString("organizationName", "organization") || "Government Organization",
    industryType: organizationType || pickString("industryType", "industry", "sector") || "government",
    requestorName: requestorName || "AI Generated Request",
    requestorEmail: requestorEmail || "ai@coveria.ae",
    department: department || pickString("department", "organizationUnit", "unit") || "Digital Transformation Office",
    urgency,
    suggestedProjectName: pickString("suggestedProjectName", "projectName", "title", "name") || "AI-Generated Demand",
    businessObjective: pickString("enhancedBusinessObjective", "businessObjective", "problemStatement", "description") || description,
    currentChallenges: toText(pickAny("currentChallenges", "current_challenges", "challenges", "painPoints", "pain_points", "currentState", "problems")) || `Current operational challenges related to: ${description.substring(0, 200)}. Detailed assessment pending full analysis.`,
    riskFactors: toText(pickAny("riskFactors", "risk_factors", "risks", "keyRisks")),
    expectedOutcomes: toText(pickAny("expectedOutcomes", "expectedBenefits", "outcomes")),
    successCriteria: toText(pickAny("successCriteria", "successMetrics", "kpis")),
    constraints: toText(pickAny("constraints", "limitations", "projectConstraints")),
    currentCapacity: toText(pickAny("currentCapacity", "capacity", "asIsCapacity")),
    budgetRange: toText(pickAny("budgetRange", "budget", "estimatedBudget", "requestedBudget", "estimatedCost")),
    timeframe: toText(pickAny("timeframe", "timeline", "implementationTimeline", "duration", "targetDate")),
    stakeholders: toText(pickAny("stakeholders", "keyStakeholders", "stakeholdersList")),
    existingSystems: toText(pickAny("existingSystems", "currentSystems", "legacySystems")),
    integrationRequirements: toText(pickAny("integrationRequirements", "integrationNeeds")),
    complianceRequirements: toText(pickAny("complianceRequirements", "regulatoryRequirements")),
    requestType: pickString("requestType", "type") || "demand",
    classificationConfidence: typeof content.classificationConfidence === "number" ? content.classificationConfidence : 80,
    classificationReasoning: pickString("classificationReasoning", "reasoning") || "AI-generated classification",
    workflowStatus: "new",
  };

  // Normalize empty strings to null
  for (const key of [
    "currentChallenges", "riskFactors", "expectedOutcomes", "successCriteria",
    "constraints", "currentCapacity", "budgetRange", "timeframe",
    "stakeholders", "existingSystems", "integrationRequirements", "complianceRequirements",
  ]) {
    if (typeof demandData[key] === "string" && !(demandData[key] as string).trim()) {
      demandData[key] = null;
    }
  }

  // Detect if we got a fallback (no-LLM) response
  const meta = content.meta as Record<string, unknown> | undefined;
  const isFallback = meta?.fallback === true;
  const confidence = typeof meta?.confidence === "number" ? meta.confidence : null;
  const explicitFallbackReason = typeof meta?.fallbackReason === "string" ? meta.fallbackReason : null;

  return {
    success: true,
    data: {
      demandData,
      aiMetadata: {
        citations: null,
        confidence,
        isFallback,
        fallbackReason: isFallback
          ? (explicitFallbackReason || "AI provider temporarily unavailable — fields were extracted heuristically")
          : null,
      },
    },
  };
}


/* ── Send Evidence Email (builds HTML + sends) ───────────────── */

export async function sendEvidenceEmail(
  deps: Pick<AIDeps, "email">,
  body: {
    recipientEmail?: string;
    recipientName?: string;
    taskName?: string;
    projectName?: string;
    analysis?: Record<string, unknown>;
    emailType?: string;
    senderName?: string;
    additionalMessage?: string;
  },
): Promise<IntelResult<{ message: string }>> {
  const {
    recipientEmail, recipientName, taskName, projectName,
    analysis, emailType, senderName, additionalMessage,
  } = body;

  if (!recipientEmail) return { success: false, error: "Recipient email is required", status: 400 };
  if (!analysis || typeof analysis.overallScore !== "number") return { success: false, error: "Valid analysis data is required", status: 400 };

  const safeAnalysis = {
    overallScore: (analysis.overallScore as number) ?? 0,
    completenessScore: (analysis.completenessScore as number) ?? 0,
    qualityScore: (analysis.qualityScore as number) ?? 0,
    relevanceScore: (analysis.relevanceScore as number) ?? 0,
    findings: Array.isArray(analysis.findings) ? analysis.findings : [],
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
    riskFlags: Array.isArray(analysis.riskFlags) ? analysis.riskFlags : [],
    analyzedAt: (analysis.analyzedAt as string) || new Date().toISOString(),
  };

  const isEscalation = emailType === "escalation";
  const scoreColor = safeAnalysis.overallScore >= 80 ? "#10b981" : safeAnalysis.overallScore >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = safeAnalysis.overallScore >= 80 ? "Excellent" : safeAnalysis.overallScore >= 60 ? "Good" : "Needs Attention";
  const subject = isEscalation ? `ESCALATION - Evidence Review Required: ${taskName}` : `Evidence Evaluation Report: ${taskName}`;
  const displayDate = new Date(safeAnalysis.analyzedAt).toLocaleString("en-AE", { timeZone: "Asia/Dubai" });

  const html = buildEvidenceEmailHtml({
    isEscalation, recipientName, taskName, projectName,
    senderName, additionalMessage, safeAnalysis, scoreColor, scoreLabel, displayDate,
  });

  const text = buildEvidenceEmailText({
    isEscalation, recipientName, taskName, projectName,
    senderName, additionalMessage, safeAnalysis, scoreLabel, displayDate,
  });

  const success = await deps.email.sendEmail({
    to: recipientEmail,
    from: "falah.aldameiry@gmail.com",
    subject,
    html,
    text,
  });

  if (success) return { success: true, data: { message: `Email sent to ${recipientEmail}` } };
  return { success: false, error: "Failed to send email", status: 500 };
}


/* ── private email template helpers ────────────────────────────── */

interface EmailTemplateCtx {
  isEscalation: boolean;
  recipientName?: string;
  taskName?: string;
  projectName?: string;
  senderName?: string;
  additionalMessage?: string;
  safeAnalysis: {
    overallScore: number;
    completenessScore: number;
    qualityScore: number;
    relevanceScore: number;
    findings: unknown[];
    recommendations: unknown[];
    riskFlags: unknown[];
    analyzedAt: string;
  };
  scoreColor: string;
  scoreLabel: string;
  displayDate: string;
}


function buildEvidenceEmailHtml(ctx: EmailTemplateCtx): string {
  const { isEscalation, recipientName, taskName, projectName, senderName, additionalMessage, safeAnalysis, scoreColor, scoreLabel, displayDate } = ctx;
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, ${isEscalation ? "#dc2626" : "#667eea"} 0%, ${isEscalation ? "#991b1b" : "#764ba2"} 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${isEscalation ? "Evidence Escalation Notice" : "Evidence Evaluation Report"}</h1>
    <p style="color: #e2e8f0; margin: 10px 0 0 0;">Enterprise Intelligence - AI Transformation Platform Hub</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">Dear ${recipientName || "Colleague"},</p>
    ${isEscalation ? '<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px;"><p style="color: #991b1b; margin: 0; font-weight: bold;">This task requires your immediate attention.</p></div>' : ""}
    <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">${isEscalation ? `An evidence evaluation for task "${taskName}" in project "${projectName || "N/A"}" has been escalated to you for review.` : `Please find below the AI-powered evidence evaluation for task "${taskName}" in project "${projectName || "N/A"}".`}</p>
    ${additionalMessage ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;"><p style="color: #374151; margin: 0;"><strong>Message from ${senderName || "Team Member"}:</strong></p><p style="color: #4b5563; margin: 10px 0 0 0;">${additionalMessage}</p></div>` : ""}
    <div style="background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #2d3748; margin-bottom: 15px;">Evidence Evaluation Summary</h3>
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <div style="text-align: center; padding: 10px; background: ${scoreColor}15; border-radius: 8px; flex: 1; margin-right: 10px;"><div style="font-size: 24px; font-weight: bold; color: ${scoreColor};">${safeAnalysis.overallScore}%</div><div style="font-size: 12px; color: #6b7280;">Overall Score</div></div>
        <div style="text-align: center; padding: 10px; background: #f3f4f6; border-radius: 8px; flex: 1; margin-right: 10px;"><div style="font-size: 18px; font-weight: bold; color: #374151;">${safeAnalysis.completenessScore}%</div><div style="font-size: 12px; color: #6b7280;">Completeness</div></div>
        <div style="text-align: center; padding: 10px; background: #f3f4f6; border-radius: 8px; flex: 1; margin-right: 10px;"><div style="font-size: 18px; font-weight: bold; color: #374151;">${safeAnalysis.qualityScore}%</div><div style="font-size: 12px; color: #6b7280;">Quality</div></div>
        <div style="text-align: center; padding: 10px; background: #f3f4f6; border-radius: 8px; flex: 1;"><div style="font-size: 18px; font-weight: bold; color: #374151;">${safeAnalysis.relevanceScore}%</div><div style="font-size: 12px; color: #6b7280;">Relevance</div></div>
      </div>
      <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: ${scoreColor}; font-weight: bold;">${scoreLabel}</span></p>
    </div>
    ${safeAnalysis.findings.length > 0 ? `<div style="margin-bottom: 20px;"><h4 style="color: #2d3748; margin-bottom: 10px;">Key Findings:</h4><ul style="color: #4a5568; margin: 0; padding-left: 20px;">${safeAnalysis.findings.map((f) => `<li style="margin-bottom: 8px;">${f}</li>`).join("")}</ul></div>` : ""}
    ${safeAnalysis.recommendations.length > 0 ? `<div style="background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin-bottom: 20px;"><h4 style="color: #92400e; margin-bottom: 10px;">Recommendations:</h4><ul style="color: #78350f; margin: 0; padding-left: 20px;">${safeAnalysis.recommendations.map((r) => `<li style="margin-bottom: 8px;">${r}</li>`).join("")}</ul></div>` : ""}
    ${safeAnalysis.riskFlags.length > 0 ? `<div style="background: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin-bottom: 20px;"><h4 style="color: #991b1b; margin-bottom: 10px;">Risk Flags:</h4><ul style="color: #7f1d1d; margin: 0; padding-left: 20px;">${safeAnalysis.riskFlags.map((r) => `<li style="margin-bottom: 8px;">${r}</li>`).join("")}</ul></div>` : ""}
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
      <p style="color: #718096; font-size: 14px; margin: 0;">This evaluation was generated by COREVIA AI on ${displayDate}<br><br>Best regards,<br>UAE Government Digital Transformation Team<br><em>Advancing UAE Vision 2071 through Digital Innovation</em></p>
    </div>
  </div>
</div>`;
}


function buildEvidenceEmailText(ctx: Omit<EmailTemplateCtx, "scoreColor">): string {
  const { isEscalation, recipientName, taskName, projectName, senderName, additionalMessage, safeAnalysis, scoreLabel, displayDate } = ctx;
  return `${isEscalation ? "ESCALATION - Evidence Review Required" : "Evidence Evaluation Report"}
Enterprise Intelligence - AI Transformation Platform Hub

Dear ${recipientName || "Colleague"},

${isEscalation ? `An evidence evaluation for task "${taskName}" in project "${projectName || "N/A"}" has been escalated.` : `Please find the evidence evaluation for task "${taskName}" in project "${projectName || "N/A"}".`}
${additionalMessage ? `\nMessage from ${senderName || "Team Member"}:\n${additionalMessage}\n` : ""}
EVIDENCE EVALUATION SUMMARY
Overall Score: ${safeAnalysis.overallScore}% (${scoreLabel})
Completeness: ${safeAnalysis.completenessScore}%
Quality: ${safeAnalysis.qualityScore}%
Relevance: ${safeAnalysis.relevanceScore}%

${safeAnalysis.findings.length > 0 ? `KEY FINDINGS:\n${safeAnalysis.findings.map((f) => `- ${f}`).join("\n")}` : ""}
${safeAnalysis.recommendations.length > 0 ? `RECOMMENDATIONS:\n${safeAnalysis.recommendations.map((r) => `- ${r}`).join("\n")}` : ""}
${safeAnalysis.riskFlags.length > 0 ? `RISK FLAGS:\n${safeAnalysis.riskFlags.map((r) => `- ${r}`).join("\n")}` : ""}

Generated by COREVIA AI on ${displayDate}

Best regards,
UAE Government Digital Transformation Team`;
}
