/**
 * Demand Module — Normalizers
 *
 * Pure data-transformation functions that bridge the gap between
 * Brain AI output formats and the UI-expected schemas.
 * No side-effects, no I/O — easily testable.
 */

// ── Shared helpers ────────────────────────────────────────────────

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toMoneyString(value: unknown, fallback = "0.00"): string {
  const n = toNumber(value, Number(fallback));
  if (!Number.isFinite(n)) return fallback;
  return n.toFixed(2);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value
    : value == null
      ? fallback
      : String(value);
}

export function asArrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asObjectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

// ── Requirements Normalizer ───────────────────────────────────────

/**
 * Normalize the AI-generated requirements data to match the UI schema.
 * Fixes corrupted arrays, maps priority labels, synthesises missing
 * sections (capabilities, gaps, technology, resources, roles, effort).
 */
export function normalizeRequirementsForUI(raw: Record<string, unknown>): Record<string, unknown> {
  const r = { ...raw };

  // --- Fix corrupted string arrays (char-by-char arrays → joined strings) ---
  function fixCorruptedStringArray(arr: unknown): string[] {
    if (!Array.isArray(arr)) return [];
    if (
      arr.length > 0 &&
      arr.every((item: unknown) => typeof item === "string" && item.length <= 1)
    ) {
      const joined = arr.join("");
      const parts = joined
        .split(/(?:\d+\.\s+|;\s*|\n+|•\s*)/)
        .filter((s: string) => s.trim().length > 2);
      return parts.length > 0 ? parts.map((s: string) => s.trim()) : [joined.trim()];
    }
    return arr.filter(
      (item: unknown) => typeof item === "string" && item.trim().length > 0,
    ) as string[];
  }

  if (Array.isArray(r.outOfScope)) r.outOfScope = fixCorruptedStringArray(r.outOfScope);
  if (Array.isArray(r.assumptions)) r.assumptions = fixCorruptedStringArray(r.assumptions);
  if (Array.isArray(r.constraints)) r.constraints = fixCorruptedStringArray(r.constraints);
  if (Array.isArray(r.dependencies)) r.dependencies = fixCorruptedStringArray(r.dependencies);

  // --- Priority mapping ---
  function normalizePriority(p: unknown): string {
    const s = String(p || "").toLowerCase().trim();
    if (s === "high" || s === "must-have" || s === "critical" || s === "essential") return "High";
    if (s === "medium" || s === "should-have" || s === "important" || s === "moderate") return "Medium";
    if (s === "low" || s === "could-have" || s === "nice-to-have" || s === "optional") return "Low";
    if (s.includes("must") || s.includes("critical")) return "High";
    if (s.includes("should") || s.includes("important")) return "Medium";
    return "Medium";
  }

  // --- Functional Requirements normalization ---
  if (Array.isArray(r.functionalRequirements)) {
    r.functionalRequirements = (r.functionalRequirements as Record<string, unknown>[]).map((fr: Record<string, unknown>) => {
      const obj = typeof fr === "object" && fr !== null ? fr : {};
      const requirement = obj.requirement || obj.title || obj.name || obj.description || "";
      const category = obj.category || "";
      const rawAC =
        Array.isArray(obj.acceptanceCriteria) && obj.acceptanceCriteria.length > 0
          ? obj.acceptanceCriteria
          : obj.acceptance || obj.criteria || [];
      const acceptanceCriteria = Array.isArray(rawAC)
        ? rawAC
        : typeof rawAC === "string" && rawAC.trim()
          ? [rawAC]
          : [];
      const bestPractice = obj.bestPractice || obj.best_practice || "";
      return {
        id: obj.id || `FR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        requirement,
        category,
        priority: normalizePriority(obj.priority),
        acceptanceCriteria,
        bestPractice,
        description: obj.description || "",
      };
    });
  }

  // --- Non-Functional Requirements normalization ---
  if (Array.isArray(r.nonFunctionalRequirements)) {
    r.nonFunctionalRequirements = (r.nonFunctionalRequirements as Record<string, unknown>[]).map((nfr: Record<string, unknown>) => {
      const obj = typeof nfr === "object" && nfr !== null ? nfr : {};
      return {
        id: obj.id || `NFR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        requirement: obj.requirement || obj.description || obj.title || obj.name || "",
        category: obj.category || "",
        metric: obj.metric || obj.measure || obj.target || "",
        priority: normalizePriority(obj.priority || (obj.category === "Security" ? "High" : "Medium")),
        bestPractice: obj.bestPractice || obj.best_practice || "",
      };
    });
  }

  // --- Security Requirements: extract from NFRs + merge with existing ---
  const securityNFRs = Array.isArray(r.nonFunctionalRequirements)
    ? (r.nonFunctionalRequirements as Record<string, unknown>[]).filter((nfr: Record<string, unknown>) => {
        const cat = String(nfr.category || "").toLowerCase();
        const req = String(nfr.requirement || "").toLowerCase();
        return (
          cat.includes("security") || cat.includes("compliance") || cat.includes("privacy") ||
          cat.includes("safety") || cat.includes("access") || cat.includes("data protection") ||
          req.includes("security") || req.includes("encryption") || req.includes("authentication") ||
          req.includes("cyber") || req.includes("compliance") || req.includes("safety") ||
          req.includes("access control") || req.includes("audit") || req.includes("gdpr") ||
          req.includes("data protection") || req.includes("authorization") || req.includes("firewall") ||
          req.includes("vulnerability") || req.includes("penetration") || req.includes("backup") ||
          req.includes("disaster recovery") || req.includes("incident")
        );
      })
    : [];

  const existingSecReqs = Array.isArray(r.securityRequirements) ? (r.securityRequirements as Record<string, unknown>[]) : [];
  const existingIds = new Set(existingSecReqs.map((sr: Record<string, unknown>) => String(sr.id || "").toLowerCase()));
  const existingReqs = new Set(existingSecReqs.map((sr: Record<string, unknown>) => String(sr.requirement || "").toLowerCase().trim()));

  const mergedFromNFRs = securityNFRs
    .filter((nfr: Record<string, unknown>) => {
      const nfrId = String(nfr.id || "").toLowerCase();
      const nfrReq = String(nfr.requirement || "").toLowerCase().trim();
      return !existingIds.has(nfrId) && !existingReqs.has(nfrReq);
    })
    .map((nfr: Record<string, unknown>) => ({
      id: nfr.id || `SR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      requirement: nfr.requirement || nfr.description || nfr.title || "",
      category: nfr.category || "Security",
      priority: normalizePriority(nfr.priority || "High"),
      compliance: nfr.metric || nfr.compliance || "",
      implementation: nfr.bestPractice || nfr.implementation || "",
    }));

  const normalizedExisting = existingSecReqs.map((sr: Record<string, unknown>) => {
    const obj = typeof sr === "object" && sr !== null ? sr : {};
    return {
      id: obj.id || `SR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      requirement: obj.requirement || obj.description || obj.title || "",
      category: obj.category || "Security",
      priority: normalizePriority(obj.priority || "High"),
      compliance: obj.compliance || obj.metric || "",
      implementation: obj.implementation || obj.bestPractice || "",
    };
  });

  r.securityRequirements = [...normalizedExisting, ...mergedFromNFRs];

  // If still no security requirements, synthesize baseline ones
  if ((r.securityRequirements as Record<string, unknown>[]).length === 0) {
    r.securityRequirements = [
      { id: "SR-001", requirement: "Role-based access control (RBAC) with least-privilege principles", category: "Authorization", priority: "High", compliance: "ISO 27001, NIST AC-6", implementation: "Implement granular role definitions with regular access reviews" },
      { id: "SR-002", requirement: "Data encryption at rest and in transit", category: "Data Protection", priority: "High", compliance: "ISO 27001, AES-256", implementation: "TLS 1.3 for transit, AES-256 for storage, key rotation policy" },
      { id: "SR-003", requirement: "Multi-factor authentication for all user access", category: "Authentication", priority: "High", compliance: "NIST SP 800-63B", implementation: "Integrate MFA with SSO provider, support TOTP and hardware tokens" },
      { id: "SR-004", requirement: "Comprehensive audit logging and monitoring", category: "Monitoring", priority: "Medium", compliance: "ISO 27001 A.12.4", implementation: "Centralized SIEM with real-time alerting and 12-month log retention" },
      { id: "SR-005", requirement: "Regular vulnerability assessments and penetration testing", category: "Security Testing", priority: "Medium", compliance: "OWASP, ISO 27001", implementation: "Quarterly automated scans, annual third-party penetration tests" },
    ];
  }

  // --- Capabilities: derive from FRs if not present ---
  if (!Array.isArray(r.capabilities) || (r.capabilities as Record<string, unknown>[]).length === 0) {
    if (Array.isArray(r.functionalRequirements) && (r.functionalRequirements as Record<string, unknown>[]).length > 0) {
      const frs = r.functionalRequirements as Record<string, unknown>[];
      const categories = new Map<string, Record<string, unknown>[]>();
      for (const fr of frs) {
        const cat = String(fr.category || "Core Capability");
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(fr);
      }
      if (categories.size > 1) {
        r.capabilities = Array.from(categories.entries()).map(([cat, items]) => ({
          name: cat || "Core Capability",
          description: items.map((i: Record<string, unknown>) => i.requirement || i.title || "").filter(Boolean).join("; "),
          priority: normalizePriority(items[0]?.priority || "High"),
          reasoning: `Derived from ${items.length} functional requirement(s) in this category`,
        }));
      } else {
        r.capabilities = frs.map((fr: Record<string, unknown>) => ({
          name: fr.requirement || fr.title || fr.name || "Capability",
          description: fr.description || fr.requirement || "",
          priority: normalizePriority(fr.priority),
          reasoning: fr.bestPractice || `Supports requirement ${fr.id}`,
        }));
      }
    }
  } else if (Array.isArray(r.capabilities)) {
    r.capabilities = (r.capabilities as Record<string, unknown>[]).map((cap: Record<string, unknown>) => {
      const obj = typeof cap === "object" && cap !== null ? cap : {};
      return {
        name: obj.name || obj.title || obj.capability || "",
        description: obj.description || "",
        priority: normalizePriority(obj.priority),
        reasoning: obj.reasoning || obj.rationale || "",
      };
    });
  }

  // --- Capability Gaps: synthesize from data if not present ---
  if (!Array.isArray(r.capabilityGaps) || (r.capabilityGaps as Record<string, unknown>[]).length === 0) {
    const caps = Array.isArray(r.capabilities) ? (r.capabilities as Record<string, unknown>[]) : [];
    const constraints = Array.isArray(r.constraints) ? (r.constraints as string[]) : [];
    const gaps: Record<string, unknown>[] = [];
    const highPriCaps = caps.filter((c: Record<string, unknown>) => c.priority === "High").slice(0, 3);
    for (const cap of highPriCaps) {
      gaps.push({
        gap: `${cap.name} implementation capability`,
        currentState: "No existing system or process in place",
        targetState: cap.description || `Fully operational ${cap.name}`,
        recommendation: `Invest in building or acquiring ${cap.name} through phased implementation`,
      });
    }
    for (const constraint of constraints.slice(0, 2)) {
      gaps.push({
        gap: `Constraint: ${constraint}`,
        currentState: "Constraint to be addressed",
        targetState: "Constraint mitigated or resolved",
        recommendation: `Develop mitigation strategy for: ${constraint}`,
      });
    }
    if (gaps.length > 0) r.capabilityGaps = gaps;
  } else if (Array.isArray(r.capabilityGaps)) {
    r.capabilityGaps = (r.capabilityGaps as Record<string, unknown>[]).map((gap: Record<string, unknown>) => ({
      gap: gap.gap || gap.name || gap.title || gap.description || "",
      currentState: gap.currentState || gap.current || "",
      targetState: gap.targetState || gap.target || "",
      recommendation: gap.recommendation || gap.action || "",
    }));
  }

  // --- Required Technology: synthesize if not present ---
  if (
    !r.requiredTechnology ||
    typeof r.requiredTechnology !== "object" ||
    Object.keys(r.requiredTechnology as object).length === 0
  ) {
    r.requiredTechnology = {
      frontend: ["React / Next.js", "TypeScript", "Responsive UI Framework"],
      backend: ["Node.js / Express", "RESTful API", "Microservices Architecture"],
      database: ["PostgreSQL", "Redis Cache", "Data Warehousing"],
      infrastructure: ["Cloud Hosting (Azure/AWS)", "Container Orchestration", "CI/CD Pipeline"],
      tools: ["Git Version Control", "Automated Testing Framework", "Monitoring & Observability"],
    };
  } else {
    const tech = r.requiredTechnology as Record<string, unknown>;
    r.requiredTechnology = {
      frontend: Array.isArray(tech.frontend) ? tech.frontend : [],
      backend: Array.isArray(tech.backend) ? tech.backend : [],
      database: Array.isArray(tech.database) ? tech.database : [],
      infrastructure: Array.isArray(tech.infrastructure) ? tech.infrastructure : [],
      tools: Array.isArray(tech.tools) ? tech.tools : [],
    };
  }

  // --- Required Resources: synthesize if not present ---
  if (
    !r.requiredResources ||
    typeof r.requiredResources !== "object" ||
    Object.keys(r.requiredResources as object).length === 0
  ) {
    const frCount = Array.isArray(r.functionalRequirements) ? (r.functionalRequirements as Record<string, unknown>[]).length : 0;
    const nfrCount = Array.isArray(r.nonFunctionalRequirements) ? (r.nonFunctionalRequirements as Record<string, unknown>[]).length : 0;
    const complexity = frCount + nfrCount;
    const teamSize = complexity <= 8 ? "4-6 team members" : complexity <= 15 ? "8-12 team members" : "12-18 team members";
    const timeline = complexity <= 8 ? "3-6 months" : complexity <= 15 ? "6-9 months" : "9-14 months";
    r.requiredResources = {
      teamSize,
      budgetEstimate: "To be determined based on detailed scoping",
      timelineEstimate: timeline,
      infrastructure: ["Development Environment", "Staging Environment", "Production Environment", "CI/CD Pipeline"],
    };
  } else {
    const res = r.requiredResources as Record<string, unknown>;
    r.requiredResources = {
      teamSize: String(res.teamSize || ""),
      budgetEstimate: String(res.budgetEstimate || ""),
      timelineEstimate: String(res.timelineEstimate || ""),
      infrastructure: Array.isArray(res.infrastructure) ? res.infrastructure : [],
    };
  }

  // --- Roles and Responsibilities: synthesize if not present ---
  if (!Array.isArray(r.rolesAndResponsibilities) || (r.rolesAndResponsibilities as Record<string, unknown>[]).length === 0) {
    r.rolesAndResponsibilities = [
      { role: "Project Manager", count: "1", responsibilities: ["Project planning and scheduling", "Stakeholder communication", "Risk management", "Budget tracking"], skills: ["PMP/PRINCE2", "Agile methodology", "Stakeholder management"] },
      { role: "Solution Architect", count: "1", responsibilities: ["System design and architecture", "Technology selection", "Integration planning", "Technical governance"], skills: ["Enterprise architecture", "Cloud platforms", "System integration"] },
      { role: "Senior Developer", count: "2-3", responsibilities: ["Core feature development", "Code review", "Technical mentoring", "API design"], skills: ["Full-stack development", "Database design", "Security best practices"] },
      { role: "QA Engineer", count: "1-2", responsibilities: ["Test strategy and planning", "Automated testing", "Performance testing", "User acceptance testing"], skills: ["Test automation", "CI/CD", "Performance testing tools"] },
      { role: "Business Analyst", count: "1", responsibilities: ["Requirements refinement", "User story creation", "Stakeholder liaison", "Process documentation"], skills: ["Business analysis", "Requirements engineering", "Domain expertise"] },
      { role: "DevOps Engineer", count: "1", responsibilities: ["Infrastructure setup", "CI/CD pipeline management", "Monitoring and alerting", "Security compliance"], skills: ["Cloud infrastructure", "Container orchestration", "Infrastructure as Code"] },
    ];
  } else {
    r.rolesAndResponsibilities = (r.rolesAndResponsibilities as Record<string, unknown>[]).map((role: Record<string, unknown>) => {
      const obj = typeof role === "object" && role !== null ? role : {};
      return {
        role: obj.role || obj.title || obj.name || "",
        count: String(obj.count || obj.number || "1"),
        responsibilities: Array.isArray(obj.responsibilities) ? obj.responsibilities : [],
        skills: Array.isArray(obj.skills) ? obj.skills : [],
      };
    });
  }

  // --- World Class Recommendations ---
  if (
    !r.worldClassRecommendations ||
    typeof r.worldClassRecommendations !== "object" ||
    Object.keys(r.worldClassRecommendations as object).length === 0
  ) {
    const constraints = Array.isArray(r.constraints) ? (r.constraints as string[]) : [];
    r.worldClassRecommendations = {
      industryBestPractices: ["Agile/Scrum methodology with 2-week sprints", "Continuous integration and continuous deployment (CI/CD)", "Design thinking for user experience", "Regular security audits and code reviews"],
      technologyStack: ["Cloud-native architecture for scalability", "API-first design for extensibility", "Containerization for deployment consistency"],
      architecturePatterns: ["Microservices for modularity", "Event-driven architecture for real-time processing", "Domain-driven design for business alignment"],
      securityFrameworks: ["ISO 27001 Information Security Management", "NIST Cybersecurity Framework", "OWASP Application Security"],
      complianceStandards: constraints.length > 0 ? constraints : ["Data protection and privacy regulations", "Industry-specific compliance requirements", "Government IT standards and policies"],
    };
  } else {
    const wc = r.worldClassRecommendations as Record<string, unknown>;
    r.worldClassRecommendations = {
      industryBestPractices: Array.isArray(wc.industryBestPractices) ? wc.industryBestPractices : [],
      technologyStack: Array.isArray(wc.technologyStack) ? wc.technologyStack : [],
      architecturePatterns: Array.isArray(wc.architecturePatterns) ? wc.architecturePatterns : [],
      securityFrameworks: Array.isArray(wc.securityFrameworks) ? wc.securityFrameworks : [],
      complianceStandards: Array.isArray(wc.complianceStandards) ? wc.complianceStandards : [],
    };
  }

  // --- Estimated Effort ---
  if (
    !r.estimatedEffort ||
    typeof r.estimatedEffort !== "object" ||
    Object.keys(r.estimatedEffort as object).length === 0
  ) {
    const frCount = Array.isArray(r.functionalRequirements) ? (r.functionalRequirements as Record<string, unknown>[]).length : 0;
    const complexity = frCount <= 5 ? "low" : frCount <= 10 ? "medium" : "high";
    const phases =
      complexity === "low"
        ? [
            { phase: "Discovery & Planning", duration: "2 weeks", effort: "160 person-hours", deliverables: ["Project charter", "Detailed requirements", "Architecture blueprint"] },
            { phase: "Design & Prototyping", duration: "3 weeks", effort: "240 person-hours", deliverables: ["System design document", "UI/UX prototypes", "API specifications"] },
            { phase: "Development", duration: "8 weeks", effort: "960 person-hours", deliverables: ["Core features", "API endpoints", "Database schema"] },
            { phase: "Testing & QA", duration: "3 weeks", effort: "360 person-hours", deliverables: ["Test reports", "Bug fixes", "Performance benchmarks"] },
            { phase: "Deployment & Handover", duration: "2 weeks", effort: "160 person-hours", deliverables: ["Production deployment", "Documentation", "Training materials"] },
          ]
        : complexity === "medium"
          ? [
              { phase: "Discovery & Planning", duration: "3 weeks", effort: "240 person-hours", deliverables: ["Project charter", "Detailed requirements", "Architecture blueprint", "Risk register"] },
              { phase: "Design & Prototyping", duration: "4 weeks", effort: "480 person-hours", deliverables: ["System design document", "UI/UX prototypes", "API specifications", "Data model"] },
              { phase: "Development - Sprint 1-3", duration: "6 weeks", effort: "1,080 person-hours", deliverables: ["Core platform features", "Authentication & authorization", "Primary workflows"] },
              { phase: "Development - Sprint 4-6", duration: "6 weeks", effort: "1,080 person-hours", deliverables: ["Integration features", "Reporting module", "Advanced features"] },
              { phase: "Testing & QA", duration: "4 weeks", effort: "640 person-hours", deliverables: ["Automated test suite", "Performance test results", "Security audit report"] },
              { phase: "UAT & Deployment", duration: "3 weeks", effort: "360 person-hours", deliverables: ["UAT sign-off", "Production deployment", "User training", "Operations handover"] },
            ]
          : [
              { phase: "Discovery & Planning", duration: "4 weeks", effort: "480 person-hours", deliverables: ["Project charter", "Detailed requirements", "Architecture blueprint", "Risk register", "Governance framework"] },
              { phase: "Design & Prototyping", duration: "5 weeks", effort: "600 person-hours", deliverables: ["System design document", "UI/UX prototypes", "API specifications", "Data model", "Security architecture"] },
              { phase: "Development Phase 1", duration: "8 weeks", effort: "1,440 person-hours", deliverables: ["Core platform", "Authentication/Authorization", "Primary business workflows", "Base API layer"] },
              { phase: "Development Phase 2", duration: "8 weeks", effort: "1,440 person-hours", deliverables: ["Advanced features", "Integration layer", "Reporting & analytics", "Admin portal"] },
              { phase: "Testing & QA", duration: "5 weeks", effort: "800 person-hours", deliverables: ["Comprehensive test suite", "Performance benchmarks", "Security penetration test", "Load test results"] },
              { phase: "UAT, Deployment & Stabilization", duration: "4 weeks", effort: "480 person-hours", deliverables: ["UAT completion", "Production deployment", "Monitoring setup", "Knowledge transfer", "Post-launch support plan"] },
            ];

    const totalHours = phases.reduce((sum, p) => {
      const h = parseInt(p.effort.replace(/[^0-9]/g, ""), 10);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);

    r.estimatedEffort = { totalEffort: `${totalHours.toLocaleString()} person-hours`, phases };
  } else {
    const effort = r.estimatedEffort as Record<string, unknown>;
    r.estimatedEffort = {
      totalEffort: String(effort.totalEffort || ""),
      phases: Array.isArray(effort.phases) ? (effort.phases as Record<string, unknown>[]).map((p: Record<string, unknown>) => ({
        phase: p.phase || p.name || "",
        duration: p.duration || "",
        effort: p.effort || "",
        deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
      })) : [],
    };
  }

  return r;
}

// ── Strategic Fit Normalizer ──────────────────────────────────────

function mapSeverity(value: string): "High" | "Medium" | "Low" {
  const lower = (value || "").toString().toLowerCase();
  if (lower === "high" || lower === "critical" || lower === "severe") return "High";
  if (lower === "low" || lower === "minimal" || lower === "negligible") return "Low";
  return "Medium";
}

/**
 * If data already has the new schema but may be missing some optional sections,
 * ensure every section at least has baseline defaults.
 */
function patchMissingFields(data: Record<string, unknown>): Record<string, unknown> {
  if (!data.implementationApproach) {
    data.implementationApproach = {
      phase1: { name: "Discovery & Planning", duration: "4-6 weeks", keyActivities: ["Requirements validation", "Resource planning"], owner: "Project Sponsor", deliverables: ["Project charter", "Resource plan"] },
      phase2: { name: "Execution & Delivery", duration: "3-6 months", keyActivities: ["Solution development", "Testing"], owner: "Project Manager", deliverables: ["Solution components", "Test results"] },
      phase3: { name: "Transition & Optimization", duration: "4-8 weeks", keyActivities: ["UAT", "Go-live"], owner: "Delivery Lead", deliverables: ["UAT sign-off", "Go-live checklist"] },
    };
  }
  if (!data.governanceRequirements) {
    data.governanceRequirements = {
      approvalAuthority: "Executive Steering Committee",
      complianceFrameworks: ["UAE Federal IT Governance Framework"],
      auditRequirements: ["Quarterly compliance audit"],
      reportingCadence: "Monthly",
      approvalGates: [
        { checkpoint: "Gate 1", name: "Project Initiation", approver: "Executive Sponsor", owner: "PMO", timing: "Week 2" },
        { checkpoint: "Gate 2", name: "Go-Live Authorization", approver: "Steering Committee", owner: "PM", timing: "Pre Go-Live" },
      ],
    };
  }
  if (!data.resourceRequirements) {
    data.resourceRequirements = {
      internalTeam: { roles: ["Project Manager", "Business Analyst"], effort: "Full-time core team" },
      externalSupport: { expertise: ["Technical consultants"], estimatedCost: "TBD" },
      infrastructure: ["Development environment", "Production hosting"],
    };
  }
  if (!data.riskMitigation) {
    data.riskMitigation = {
      primaryRisks: [
        { risk: "Resource constraints", severity: "Medium", mitigation: "Early resource planning" },
        { risk: "Scope changes", severity: "High", mitigation: "Strict change control" },
      ],
    };
  }
  if (!data.complianceConsiderations) {
    data.complianceConsiderations = {
      procurementRegulations: "Subject to organizational procurement policy",
      dataGovernance: "Comply with applicable data protection regulations",
      securityStandards: "ISO 27001 baseline",
    };
  }
  if (!data.decisionCriteria) {
    const pr = data.primaryRecommendation as Record<string, unknown> | undefined;
    const score = pr?.confidenceScore || pr?.confidence || 70;
    data.decisionCriteria = {
      budgetThreshold: { analysis: "Budget assessment pending detailed analysis", score, weight: 0.2 },
      technicalComplexity: { analysis: "Technical complexity assessed", score, weight: 0.2 },
      organizationalCapability: { analysis: "Organizational capability reviewed", score, weight: 0.15 },
      riskProfile: { analysis: "Risk profile evaluation", score, weight: 0.2 },
      timelineCriticality: { analysis: "Timeline criticality reviewed", score, weight: 0.1 },
      strategicImportance: { analysis: "Strategic importance assessed", score, weight: 0.15 },
    };
  }
  return data;
}

/**
 * Transform Brain output (old alignment-based schema OR new routing-based
 * schema) into the exact shape the StrategicFitTab.tsx UI expects.
 */
export function normalizeStrategicFitForUI(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return raw;

  // If already in new UI format, pass through with minimal patching
  if ((raw.primaryRecommendation as Record<string, unknown>)?.route && raw.decisionCriteria) {
    return patchMissingFields(raw);
  }

  // ── Rich data with broken primaryRecommendation ──────────────────
  // The AI may produce decisionCriteria, implementationApproach, alternativeRecommendations
  // etc. correctly but leave primaryRecommendation.route as null. In this case we reconstruct
  // ONLY the primaryRecommendation from the existing data and preserve everything else.
  const hasRichDecisionCriteria = raw.decisionCriteria && typeof raw.decisionCriteria === "object" &&
    Object.keys(raw.decisionCriteria as Record<string, unknown>).length >= 3;
  const hasRichImplementation = raw.implementationApproach && typeof raw.implementationApproach === "object";
  const hasAlternatives = Array.isArray(raw.alternativeRecommendations) &&
    (raw.alternativeRecommendations as unknown[]).length > 0;

  if (hasRichDecisionCriteria && (hasRichImplementation || hasAlternatives)) {
    // Infer the primary route from overallScore or alternativeRecommendations
    const overallScore = typeof raw.overallScore === "number" ? raw.overallScore : 70;
    const altRoutes = hasAlternatives
      ? (raw.alternativeRecommendations as Array<Record<string, unknown>>).map(a => a.route as string)
      : [];

    // Pick a route type not already in alternatives, or infer from score
    type RouteType = "VENDOR_MANAGEMENT" | "PMO_OFFICE" | "IT_DEVELOPMENT" | "HYBRID";
    const allRoutes: RouteType[] = ["HYBRID", "IT_DEVELOPMENT", "PMO_OFFICE", "VENDOR_MANAGEMENT"];
    let primaryRoute: RouteType;
    const missingFromAlts = allRoutes.filter(r => !altRoutes.includes(r));
    if (missingFromAlts.length === 1) {
      primaryRoute = missingFromAlts[0]!;
    } else if (overallScore >= 80) {
      primaryRoute = altRoutes.includes("HYBRID") ? "IT_DEVELOPMENT" : "HYBRID";
    } else if (overallScore >= 65) {
      primaryRoute = "HYBRID";
    } else if (overallScore >= 45) {
      primaryRoute = "PMO_OFFICE";
    } else {
      primaryRoute = "VENDOR_MANAGEMENT";
    }

    const confidenceScore = typeof raw.confidenceScore === "number" ? raw.confidenceScore : Math.round(overallScore * 1.04);
    const existingPR = (raw.primaryRecommendation || {}) as Record<string, unknown>;
    const justification = typeof raw.justification === "string" ? raw.justification : "";
    const competitiveAdvantage = typeof raw.competitiveAdvantage === "string" ? raw.competitiveAdvantage : "";
    const reasoning = (existingPR.reasoning as string) || justification || competitiveAdvantage || `Strategic alignment score of ${overallScore}%`;

    // Build summary fields from decisionCriteria
    const dc = raw.decisionCriteria as Record<string, Record<string, unknown>>;
    const budgetAnalysis = dc.budgetThreshold?.analysis as string || "";
    const riskAnalysis = dc.riskProfile?.analysis as string || "";
    const highRiskMention = riskAnalysis.toLowerCase().includes("high");
    const riskLevel = highRiskMention ? "Medium" : "Low";
    const complexity = (dc.technicalComplexity?.score as number) >= 80 ? "High" : "Medium";

    // Build key strengths from high-scoring criteria
    const keyStrengths: string[] = [];
    for (const [key, crit] of Object.entries(dc)) {
      if (typeof crit?.score === "number" && crit.score >= 75) {
        const labels: Record<string, string> = {
          budgetThreshold: "Budget alignment",
          technicalComplexity: "Technical capability",
          organizationalCapability: "Organizational readiness",
          riskProfile: "Risk management",
          timelineCriticality: "Timeline management",
          strategicImportance: "Strategic importance",
        };
        keyStrengths.push(labels[key] || key);
      }
    }

    // Reconstruct the primaryRecommendation while keeping everything else
    const reconPrimaryRecommendation = {
      route: primaryRoute,
      confidenceScore: Math.min(confidenceScore, 100),
      confidence: Math.min(confidenceScore, 100),
      reasoning,
      keyFactors: (existingPR.keyFactors as string[]) || keyStrengths.slice(0, 4).map(s => `${s} verified`),
      keyStrengths: (existingPR.keyStrengths as string[]) || keyStrengths,
      expectedOutcome: (existingPR.expectedOutcome as string) || competitiveAdvantage || `Aligned delivery with ${overallScore}% strategic fit.`,
      estimatedTimeToStart: (existingPR.estimatedTimeToStart as string) || "4-6 weeks",
      criticalSuccessFactors: (existingPR.criticalSuccessFactors as string[]) || [],
      budgetEstimate: (existingPR.budgetEstimate as string) || budgetAnalysis || "See business case financial model",
      budget: (existingPR.budget as string) || budgetAnalysis || "See business case financial model",
      timeline: (existingPR.timeline as string) || "18-24 months",
      complexity,
      riskLevel,
      tradeoffs: (existingPR.tradeoffs as Record<string, unknown>) || {
        pros: keyStrengths.slice(0, 3).map(s => `Strong ${s.toLowerCase()}`),
        cons: [`${complexity} implementation complexity`, `${riskLevel} risk profile`],
      },
    };

    return {
      ...raw,
      primaryRecommendation: reconPrimaryRecommendation,
    };
  }

  // ---------- Old schema fields ----------
  const overallScore: number = typeof raw.overallScore === "number" ? raw.overallScore : 70;
  const alignmentAreas: Array<{ area?: string; score?: number; evidence?: string[]; rationale?: string }> =
    Array.isArray(raw.alignmentAreas) ? raw.alignmentAreas : [];
  const strategicRisks: Array<{ risk?: string; impact?: string; severity?: string; mitigation?: string; likelihood?: string }> =
    Array.isArray(raw.strategicRisks) ? raw.strategicRisks : [];
  const governmentAlignment: { compliance?: string; initiatives?: string } =
    raw.governmentAlignment && typeof raw.governmentAlignment === "object" ? raw.governmentAlignment : {};
  const competitiveAdvantage: string = typeof raw.competitiveAdvantage === "string" ? raw.competitiveAdvantage : "";
  const justification: string = typeof raw.justification === "string" ? raw.justification : "";
  const recommendation: string = typeof raw.recommendation === "string" ? raw.recommendation : "";

  // ---------- Determine route type from score ----------
  type RouteType = "VENDOR_MANAGEMENT" | "PMO_OFFICE" | "IT_DEVELOPMENT" | "HYBRID";
  let primaryRoute: RouteType;
  let altRoutes: RouteType[];
  if (overallScore >= 80) {
    primaryRoute = "IT_DEVELOPMENT";
    altRoutes = ["HYBRID", "PMO_OFFICE"];
  } else if (overallScore >= 65) {
    primaryRoute = "HYBRID";
    altRoutes = ["IT_DEVELOPMENT", "VENDOR_MANAGEMENT"];
  } else if (overallScore >= 45) {
    primaryRoute = "PMO_OFFICE";
    altRoutes = ["VENDOR_MANAGEMENT", "HYBRID"];
  } else {
    primaryRoute = "VENDOR_MANAGEMENT";
    altRoutes = ["PMO_OFFICE", "HYBRID"];
  }

  const keyStrengths = alignmentAreas
    .filter((a) => (a.score ?? 0) >= 70)
    .map((a) => a.area || "Strategic area")
    .slice(0, 5);
  const keyFactors = alignmentAreas
    .map((a) => `${a.area || "Area"}: ${a.rationale || `Score ${a.score ?? "N/A"}`}`)
    .slice(0, 5);

  const reasoning =
    [justification, competitiveAdvantage].filter(Boolean).join(". ") ||
    `Overall strategic alignment score of ${overallScore}% indicates ${recommendation || "alignment"}.`;

  const highRiskCount = strategicRisks.filter((r) => {
    const sev = (r.severity || r.impact || "").toString().toLowerCase();
    return sev === "high" || sev === "critical";
  }).length;
  const riskLevel = highRiskCount >= 2 ? "High" : highRiskCount === 1 ? "Medium" : "Low";
  const complexity = overallScore >= 70 ? "Medium" : "High";

  // ---------- Build primaryRecommendation ----------
  const primaryRecommendation = {
    route: primaryRoute,
    confidenceScore: overallScore,
    confidence: overallScore,
    reasoning,
    keyFactors,
    keyStrengths,
    expectedOutcome: competitiveAdvantage || `Aligned delivery with ${overallScore}% strategic fit across ${alignmentAreas.length} domains.`,
    estimatedTimeToStart: "4-6 weeks",
    criticalSuccessFactors: alignmentAreas
      .filter((a) => (a.score ?? 0) < 70)
      .map((a) => `Improve ${a.area || "area"} alignment (currently ${a.score ?? 0}%)`)
      .concat(strategicRisks.slice(0, 2).map((r) => `Mitigate: ${r.risk || "risk"}`))
      .slice(0, 5),
    budgetEstimate: "To be determined during planning",
    budget: "To be determined during planning",
    timeline: "6-12 months",
    complexity,
    riskLevel,
    tradeoffs: {
      pros: [
        `Strong strategic alignment (${overallScore}%)`,
        ...keyStrengths.slice(0, 2).map((s) => `Leverages ${s} capabilities`),
        competitiveAdvantage ? "Clear competitive advantage identified" : "Government alignment verified",
      ].slice(0, 4),
      cons: strategicRisks.slice(0, 3).map((r) => r.risk || "Risk identified") || [
        "Requires dedicated resource allocation",
        "Change management complexity",
      ],
    },
  };

  // ---------- Build alternativeRecommendations ----------
  const alternativeRecommendations = altRoutes.map((route, idx) => {
    const confidenceDelta = (idx + 1) * 12;
    return {
      route,
      confidenceScore: Math.max(20, overallScore - confidenceDelta),
      confidence: Math.max(20, overallScore - confidenceDelta),
      reasoning: `Alternative approach with adjusted confidence based on strategic alignment analysis.`,
      keyFactors: keyFactors.slice(0, 3),
      keyStrengths: keyStrengths.slice(0, 2),
      expectedOutcome: `Delivery via ${route.replace(/_/g, " ").toLowerCase()} approach.`,
      estimatedTimeToStart: idx === 0 ? "6-8 weeks" : "8-12 weeks",
      criticalSuccessFactors: [`Verify organizational readiness for ${route.replace(/_/g, " ").toLowerCase()}`],
      budgetEstimate: "Subject to detailed assessment",
      budget: "Subject to detailed assessment",
      timeline: idx === 0 ? "8-14 months" : "10-16 months",
      complexity: idx === 0 ? "Medium" : "High",
      riskLevel: idx === 0 ? "Medium" : "High",
      tradeoffs: {
        pros: [`Structured ${route.replace(/_/g, " ").toLowerCase()} governance`],
        cons: [`Lower strategic fit confidence (${Math.max(20, overallScore - confidenceDelta)}%)`],
      },
    };
  });

  // ---------- Build decisionCriteria from alignmentAreas ----------
  const areaScore = (keyword: string) => {
    const match = alignmentAreas.find((a) => (a.area || "").toLowerCase().includes(keyword));
    return match?.score ?? Math.round(overallScore * 0.9);
  };
  const areaRationale = (keyword: string, fallback: string) => {
    const match = alignmentAreas.find((a) => (a.area || "").toLowerCase().includes(keyword));
    return match?.rationale || fallback;
  };

  const decisionCriteria = {
    budgetThreshold: {
      analysis: areaRationale("budget", areaRationale("cost", areaRationale("financial", `Budget alignment assessed at ${overallScore}%`))),
      score: areaScore("budget") || areaScore("cost") || areaScore("financial"),
      weight: 0.2,
    },
    technicalComplexity: {
      analysis: areaRationale("technic", areaRationale("digital", areaRationale("innovation", `Technical complexity assessment based on ${alignmentAreas.length} alignment areas`))),
      score: areaScore("technic") || areaScore("digital") || areaScore("innovation"),
      weight: 0.2,
    },
    organizationalCapability: {
      analysis: areaRationale("organi", areaRationale("capacity", areaRationale("human", `Organizational readiness evaluated at ${overallScore}%`))),
      score: areaScore("organi") || areaScore("capacity") || areaScore("human"),
      weight: 0.15,
    },
    riskProfile: {
      analysis: `${strategicRisks.length} strategic risks identified. ${highRiskCount} rated high severity. ${strategicRisks[0]?.risk || "Risk assessment complete."}`,
      score: Math.max(30, 100 - highRiskCount * 20),
      weight: 0.2,
    },
    timelineCriticality: {
      analysis: areaRationale("time", areaRationale("schedule", areaRationale("deliver", `Timeline criticality assessed relative to strategic priorities`))),
      score: areaScore("time") || areaScore("schedule") || areaScore("deliver") || Math.round(overallScore * 0.85),
      weight: 0.1,
    },
    strategicImportance: {
      analysis: justification || `Overall strategic importance score: ${overallScore}%. ${recommendation ? `Recommendation: ${recommendation}` : ""}`,
      score: overallScore,
      weight: 0.15,
    },
  };

  // ---------- Build implementationApproach ----------
  const implementationApproach = raw.implementationApproach || {
    phase1: { name: "Discovery & Planning", duration: "4-6 weeks", keyActivities: ["Stakeholder alignment workshops", "Detailed requirements validation", "Resource allocation planning", "Risk mitigation strategy finalization"], owner: "Project Sponsor", deliverables: ["Project charter", "Detailed project plan", "Resource plan", "Risk register"] },
    phase2: { name: "Execution & Delivery", duration: "3-6 months", keyActivities: ["Solution design and development", "Iterative delivery sprints", "Quality assurance and testing", "Stakeholder progress reviews"], owner: "Project Manager", deliverables: ["Solution components", "Test results", "Progress reports", "Change requests"] },
    phase3: { name: "Transition & Optimization", duration: "4-8 weeks", keyActivities: ["User acceptance testing", "Training and change management", "Go-live preparation and execution", "Post-implementation review"], owner: "Delivery Lead", deliverables: ["UAT sign-off", "Training materials", "Go-live checklist", "Lessons learned report"] },
  };

  // ---------- Build governanceRequirements ----------
  const governanceRequirements = raw.governanceRequirements || {
    approvalAuthority: "Executive Steering Committee",
    complianceFrameworks: [
      ...(governmentAlignment.compliance ? [governmentAlignment.compliance] : []),
      "UAE Federal IT Governance Framework",
      "ISO 27001 Information Security",
    ].slice(0, 4),
    auditRequirements: ["Quarterly compliance audit", "Annual strategic alignment review", "Budget utilization reporting"],
    reportingCadence: "Bi-weekly progress, monthly steering committee",
    approvalGates: [
      { checkpoint: "Gate 1", name: "Project Initiation Approval", approver: "Executive Sponsor", owner: "PMO", timing: "Week 2" },
      { checkpoint: "Gate 2", name: "Design Sign-off", approver: "Technical Authority", owner: "Solution Architect", timing: "Week 8" },
      { checkpoint: "Gate 3", name: "Go-Live Authorization", approver: "Steering Committee", owner: "Project Manager", timing: "Pre Go-Live" },
      { checkpoint: "Gate 4", name: "Post-Implementation Review", approver: "Executive Sponsor", owner: "PMO", timing: "Go-Live + 4 weeks" },
    ],
  };

  // ---------- Build resourceRequirements ----------
  const resourceRequirements = raw.resourceRequirements || {
    internalTeam: { roles: ["Project Manager", "Business Analyst", "Solution Architect", "Change Manager", "Quality Assurance Lead"], effort: "Full-time core team for project duration" },
    externalSupport: { expertise: ["Specialized technical consultants", "Industry domain experts", "Integration specialists"], estimatedCost: "To be determined during planning phase" },
    infrastructure: ["Development environment", "Testing infrastructure", "Production hosting", "Monitoring tools"],
  };

  // ---------- Build riskMitigation from strategicRisks ----------
  const riskMitigation = raw.riskMitigation || {
    primaryRisks:
      strategicRisks.length > 0
        ? strategicRisks.map((r) => ({
            risk: r.risk || "Unspecified risk",
            severity: mapSeverity(r.impact || r.severity || "Medium"),
            mitigation: r.mitigation || "Develop targeted mitigation plan",
          }))
        : [
            { risk: "Resource availability constraints", severity: "Medium" as const, mitigation: "Early resource planning and backup allocation" },
            { risk: "Scope creep during execution", severity: "High" as const, mitigation: "Strict change control and governance gates" },
            { risk: "Stakeholder alignment gaps", severity: "Medium" as const, mitigation: "Regular steering committee reviews and communications" },
          ],
  };

  // ---------- Build complianceConsiderations ----------
  const complianceConsiderations = raw.complianceConsiderations || {
    procurementRegulations: governmentAlignment.initiatives || "Subject to UAE federal procurement regulations and organizational procurement policy",
    dataGovernance: governmentAlignment.compliance || "Data handling must comply with UAE data protection regulations and organizational data governance framework",
    securityStandards: "ISO 27001, UAE Information Assurance Standards, organizational security baseline requirements",
  };

  // ---------- Assemble final output ----------
  return {
    ...(raw.meta ? { meta: raw.meta } : {}),
    ...(raw.artifactType ? { artifactType: raw.artifactType } : {}),
    overallScore,
    justification,
    alignmentAreas,
    recommendation,
    strategicRisks: raw.strategicRisks,
    governmentAlignment: raw.governmentAlignment,
    competitiveAdvantage,
    primaryRecommendation,
    alternativeRecommendations,
    decisionCriteria,
    implementationApproach,
    governanceRequirements,
    resourceRequirements,
    riskMitigation,
    complianceConsiderations,
  };
}

// ── Business Case Normalizer ──────────────────────────────────────

/**
 * Normalize AI-generated business case field names to match the UI schema.
 * Bridges the gap between AI output (proposedSolution, risks, timeline, …)
 * and what the UI sections expect (solutionOverview, identifiedRisks, …).
 */
export function normalizeBusinessCaseFields(raw: Record<string, unknown>): Record<string, unknown> {
  const bc = { ...raw };

  if (Array.isArray(bc.keyMilestones) && !Array.isArray(bc.milestones)) {
    bc.milestones = bc.keyMilestones;
  }

  // --- Text field mappings ---
  if (bc.proposedSolution && !bc.solutionOverview) bc.solutionOverview = bc.proposedSolution;
  if (!bc.backgroundContext) {
    if (bc.background) bc.backgroundContext = bc.background;
    else if (bc.context) bc.backgroundContext = bc.context;
    else if (bc.projectBackground) bc.backgroundContext = bc.projectBackground;
  }
  if (bc.recommendation && !bc.recommendations) bc.recommendations = bc.recommendation;

  // --- Risk fields ---
  const risks = bc.risks;
  if (Array.isArray(risks) && risks.length > 0) {
    if (!bc.identifiedRisks) {
      bc.identifiedRisks = risks.map((r: unknown, idx: number) => {
        if (typeof r === "string") return { name: r, severity: "medium", impact: r, likelihood: "medium", mitigation: "" };
        if (r && typeof r === "object") {
          const ro = r as Record<string, unknown>;
          return {
            name: ro.name || ro.title || ro.risk || ro.description || `Risk ${idx + 1}`,
            severity: ro.severity || ro.level || "medium",
            impact: ro.impact || ro.description || ro.name || "",
            likelihood: ro.likelihood || ro.probability || "medium",
            mitigation: ro.mitigation || ro.mitigationStrategy || "",
          };
        }
        return { name: String(r), severity: "medium", impact: String(r), likelihood: "medium", mitigation: "" };
      });
    }
    if (!bc.riskLevel) {
      const severities = (bc.identifiedRisks as Array<{ severity?: string }>).map((r) => r.severity);
      if (severities.includes("critical")) bc.riskLevel = "critical";
      else if (severities.includes("high")) bc.riskLevel = "high";
      else if (severities.includes("medium")) bc.riskLevel = "medium";
      else bc.riskLevel = "low";
    }
    if (bc.riskScore === undefined) {
      const riskLevels: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 90 };
      bc.riskScore = riskLevels[bc.riskLevel as string] || 50;
    }
  }

  // Normalize riskScore: some engines return decimals (0-1) instead of 0-100
  if (bc.riskScore !== undefined && bc.riskScore !== null) {
    const rawScore = typeof bc.riskScore === "string" ? parseFloat(bc.riskScore) : typeof bc.riskScore === "number" ? bc.riskScore : NaN;
    if (Number.isFinite(rawScore)) {
      let normalizedRiskScore = rawScore > 0 && rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
      if (normalizedRiskScore < 0) normalizedRiskScore = 0;
      if (normalizedRiskScore > 100) normalizedRiskScore = 100;
      bc.riskScore = normalizedRiskScore;
    }
  }

  // Derive riskMatrixData if missing
  if (!bc.riskMatrixData && Array.isArray(bc.identifiedRisks) && (bc.identifiedRisks as Record<string, unknown>[]).length > 0) {
    const buckets: Record<string, Record<string, unknown>[]> = {
      highProbabilityHighImpact: [],
      highProbabilityLowImpact: [],
      lowProbabilityHighImpact: [],
      lowProbabilityLowImpact: [],
    };
    const toLevel = (value: unknown): "low" | "medium" | "high" => {
      const s = String(value || "").toLowerCase();
      if (s.includes("high") || s.includes("critical")) return "high";
      if (s.includes("med")) return "medium";
      return "low";
    };
    for (const r of bc.identifiedRisks as Record<string, unknown>[]) {
      const ro: Record<string, unknown> = r && typeof r === "object" ? r : { name: String(r) };
      const prob = toLevel(ro.likelihood || ro.probability);
      const impact = toLevel(ro.severity || ro.impact);
      if (prob === "high" && impact === "high") buckets.highProbabilityHighImpact!.push(ro);
      else if (prob === "high" && impact !== "high") buckets.highProbabilityLowImpact!.push(ro);
      else if (prob !== "high" && impact === "high") buckets.lowProbabilityHighImpact!.push(ro);
      else buckets.lowProbabilityLowImpact!.push(ro);
    }
    bc.riskMatrixData = buckets;
  }

  // --- Timeline → implementationPhases + milestones ---
  const timeline = bc.timeline;
  if (timeline && !bc.implementationPhases) {
    if (Array.isArray(timeline)) {
      bc.implementationPhases = timeline.map((phase: unknown) => {
        if (typeof phase === "string") return { name: phase, durationMonths: 1 };
        if (phase && typeof phase === "object") {
          const p = phase as Record<string, unknown>;
          return {
            name: p.name || p.phase || p.title || p.description || "Phase",
            durationMonths: Number(p.durationMonths || p.duration || p.months || 1),
            description: p.description || p.details || "",
            startDate: p.startDate || p.start || "",
            endDate: p.endDate || p.end || "",
          };
        }
        return { name: String(phase), durationMonths: 1 };
      });
    } else if (typeof timeline === "object") {
      const tl = timeline as Record<string, unknown>;
      if (tl.phases && Array.isArray(tl.phases)) bc.implementationPhases = tl.phases;
      if (tl.milestones && Array.isArray(tl.milestones)) bc.milestones = tl.milestones;
    }
  }

  if (Array.isArray(bc.implementationPhases)) {
    const timelineObject = timeline && typeof timeline === "object" && !Array.isArray(timeline)
      ? { ...(timeline as Record<string, unknown>) }
      : {};
    const timelinePhases = Array.isArray(timelineObject.phases) ? timelineObject.phases : [];
    const timelineMilestones = Array.isArray(timelineObject.milestones) ? timelineObject.milestones : [];

    if (timelinePhases.length === 0) {
      timelineObject.phases = bc.implementationPhases;
    }
    if (timelineMilestones.length === 0 && Array.isArray(bc.milestones)) {
      timelineObject.milestones = bc.milestones;
    }
    if (!bc.timeline || Object.keys(timelineObject).length > 0) {
      bc.timeline = timelineObject;
    }
    if (!bc.implementationTimeline) {
      bc.implementationTimeline = timelineObject;
    }
  }

  if (Array.isArray(bc.milestones) && !Array.isArray(bc.keyMilestones)) {
    bc.keyMilestones = bc.milestones;
  }

  if (Array.isArray(bc.nextSteps)) {
    bc.nextSteps = bc.nextSteps.map((step: unknown, index: number) => {
      if (typeof step === "string") {
        return {
          action: step,
          owner: index === 0 ? "PMO" : "Delivery Team",
          priority: index === 0 ? "High" : "Medium",
          timeline: "TBD",
        };
      }
      if (step && typeof step === "object") {
        const record = step as Record<string, unknown>;
        return {
          ...record,
          action: typeof record.action === "string"
            ? record.action
            : typeof record.step === "string"
              ? record.step
              : typeof record.text === "string"
                ? record.text
                : typeof record.description === "string"
                  ? record.description
                  : `Next step ${index + 1}`,
          owner: typeof record.owner === "string" ? record.owner : "Delivery Team",
          priority: typeof record.priority === "string" ? record.priority : "Medium",
          timeline: typeof record.timeline === "string"
            ? record.timeline
            : typeof record.deadline === "string"
              ? record.deadline
              : "TBD",
        };
      }
      return {
        action: `Next step ${index + 1}`,
        owner: "Delivery Team",
        priority: "Medium",
        timeline: "TBD",
      };
    });
  }

  // --- Cost fields ---
  const costEstimate = bc.costEstimate;
  if (costEstimate && typeof costEstimate === "object" && !bc.totalCostEstimate) {
    const ce = costEstimate as Record<string, unknown>;
    const total = ce.total || ce.totalCost || ce.estimatedCost || ce.totalEstimate;
    if (total !== undefined) {
      bc.totalCostEstimate = typeof total === "string" ? parseFloat(total.replace(/[^0-9.-]/g, "")) : Number(total);
    }
  }

  // --- Benefits → structured format ---
  const benefits = bc.benefits;
  if (Array.isArray(benefits) && benefits.length > 0 && !bc.detailedBenefits) {
    bc.detailedBenefits = benefits.map((b: unknown) => {
      if (typeof b === "string") return { category: "General", description: b, type: "qualitative" };
      if (b && typeof b === "object") {
        const bo = b as Record<string, unknown>;
        return {
          category: bo.category || "General",
          description: bo.description || bo.benefit || bo.name || String(b),
          value: bo.value || bo.amount,
          type: bo.type || (bo.value ? "quantitative" : "qualitative"),
        };
      }
      return { category: "General", description: String(b), type: "qualitative" };
    });
  }

  // --- Stakeholders → stakeholderAnalysis ---
  const stakeholders = bc.stakeholders;
  if (Array.isArray(stakeholders) && stakeholders.length > 0 && !bc.stakeholderAnalysis) {
    bc.stakeholderAnalysis = stakeholders.map((s: unknown) => {
      if (typeof s === "string") return { name: s, role: "", interest: "high", influence: "medium" };
      if (s && typeof s === "object") {
        const so = s as Record<string, unknown>;
        return {
          name: so.name || so.stakeholder || so.title || "",
          role: so.role || so.department || "",
          interest: so.interest || "high",
          influence: so.influence || so.power || "medium",
          impact: so.impact || so.description || "",
        };
      }
      return { name: String(s), role: "", interest: "high", influence: "medium" };
    });
  }

  // --- Assumptions normalization ---
  if (bc.assumptions && !bc.keyAssumptions) {
    if (Array.isArray(bc.assumptions)) {
      bc.keyAssumptions = bc.assumptions.map((a: unknown) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object") return (a as Record<string, unknown>).assumption || (a as Record<string, unknown>).description || String(a);
        return String(a);
      });
    }
  }

  // --- Alternatives → alternativesAnalysis ---
  if (bc.alternatives && !bc.alternativesAnalysis) bc.alternativesAnalysis = bc.alternatives;

  // --- ROI → roiPercentage ---
  const roi = bc.roi;
  if (roi !== undefined && bc.roiPercentage === undefined) {
    if (typeof roi === "number") {
      bc.roiPercentage = roi;
    } else if (typeof roi === "object" && roi !== null) {
      const roiObj = roi as Record<string, unknown>;
      if (roiObj.percentage !== undefined) bc.roiPercentage = Number(roiObj.percentage);
      else if (roiObj.value !== undefined) bc.roiPercentage = Number(roiObj.value);
      else if (roiObj.roi !== undefined) bc.roiPercentage = Number(roiObj.roi);
    }
  }

  // --- Dependencies ---
  if (bc.projectDependencies && !bc.dependencies) {
    const pd = bc.projectDependencies as Record<string, unknown>;
    if (Array.isArray(pd.dependencies) && pd.dependencies.length > 0) bc.dependencies = pd.dependencies;
    else if (Array.isArray(bc.projectDependencies)) bc.dependencies = bc.projectDependencies;
  }
  if (Array.isArray(bc.dependencies) && (bc.dependencies as Record<string, unknown>[]).length > 0) {
    bc.projectDependencies = bc.dependencies;
  }
  if (bc.projectDependencies && typeof bc.projectDependencies === "object" && !Array.isArray(bc.projectDependencies)) {
    const pd = bc.projectDependencies as Record<string, unknown>;
    if (Array.isArray(pd.dependencies) && pd.dependencies.length === 0 && Array.isArray(bc.dependencies) && (bc.dependencies as Record<string, unknown>[]).length > 0) {
      bc.projectDependencies = bc.dependencies;
    }
  }

  return bc;
}

// ── Business Case Artifact Builder ────────────────────────────────

/**
 * Build a DB-ready business case insert payload from a Brain artifact.
 */
export function buildInsertBusinessCaseFromArtifact(params: {
  demandReportId: string;
  decisionSpineId: string | null;
  generatedBy: string;
  artifact: Record<string, unknown>;
  qualityReport?: unknown;
}): Record<string, unknown> {
  const a = params.artifact;
  const costEstimate = asObjectOrEmpty(a.costEstimate);
  const roi = asObjectOrEmpty(a.roi);
  const timeline = asObjectOrEmpty(a.timeline);
  const timelinePhases = Array.isArray(timeline.phases) ? timeline.phases : [];
  const totalCostEstimate = a.totalCostEstimate ?? costEstimate.totalCostOfOwnership ?? costEstimate.totalCost ?? costEstimate.tco;
  const roiPercentage = a.roiPercentage ?? roi.expectedROI ?? roi.roi;
  const npvValue = a.npvValue ?? roi.npv;
  const paybackMonths = a.paybackMonths ?? roi.paybackPeriod;
  const benefitEstimate = a.totalBenefitEstimate ?? 0;

  const identifiedRisks = Array.isArray(a.identifiedRisks)
    ? a.identifiedRisks
    : Array.isArray(a.risks)
      ? a.risks.map((r: unknown) => {
          const ro = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
          return {
            name: ro.name || ro.risk || ro.title || "Risk",
            severity: (String(ro.severity || ro.impact || "medium")).toLowerCase(),
            description: ro.description || ro.risk || "",
            probability: ro.probability || ro.likelihood || "",
            impact: ro.impact || "",
            mitigation: ro.mitigation || "",
          };
        })
      : [];

  const mitigationStrategies = Array.isArray(a.mitigationStrategies)
    ? a.mitigationStrategies
    : Array.isArray(identifiedRisks)
      ? identifiedRisks.map((r: unknown) => {
          const ro = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
          return { risk: ro.name || "Risk", mitigation: ro.mitigation || "" };
        })
      : [];

  const implementationPhases = Array.isArray(a.implementationPhases)
    ? a.implementationPhases
    : Array.isArray(a.timeline)
      ? a.timeline
      : timelinePhases.map((p: unknown) => {
          const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
          return {
            name: po.name || po.phase || "Phase",
            description: po.description || "",
            duration: po.duration || "",
            durationMonths: toNumber(po.durationMonths || po.months, 1),
            deliverables: Array.isArray(po.keyDeliverables) ? po.keyDeliverables : Array.isArray(po.deliverables) ? po.deliverables : [],
          };
        });

  const milestones = Array.isArray(a.milestones) ? a.milestones : [];
  const normalizedTimeline: Record<string, unknown> = {
    ...(Object.keys(timeline).length > 0 ? timeline : {}),
    phases: timelinePhases.length > 0 ? timelinePhases : asArrayOrEmpty(implementationPhases),
    milestones: Array.isArray(timeline.milestones) ? timeline.milestones : asArrayOrEmpty(milestones),
  };

  if (!normalizedTimeline.estimatedDuration) {
    const totalDurationMonths = asArrayOrEmpty(implementationPhases).reduce<number>((sum, phase) => {
      if (!phase || typeof phase !== "object") return sum;
      const phaseRecord = phase as Record<string, unknown>;
      return sum + toNumber(phaseRecord.durationMonths || phaseRecord.months, 0);
    }, 0);
    if (totalDurationMonths > 0) {
      normalizedTimeline.estimatedDuration = `${totalDurationMonths} months`;
    }
  }

  const kpis = asArrayOrEmpty(a.kpis);
  const successCriteria = asArrayOrEmpty(a.successCriteria);
  const performanceTargets = asArrayOrEmpty(a.performanceTargets);
  const tcoBreakdown = asObjectOrEmpty(a.tcoBreakdown);
  const roiCalculation = asObjectOrEmpty(a.roiCalculation);
  const npvCalculation = asObjectOrEmpty(a.npvCalculation);
  const paybackCalculation = asObjectOrEmpty(a.paybackCalculation);
  const implementationCosts = asObjectOrEmpty(a.implementationCosts);
  const operationalCosts = asObjectOrEmpty(a.operationalCosts);
  const benefitsBreakdown = asObjectOrEmpty(a.benefitsBreakdown);
  const resourceRequirements = asObjectOrEmpty(a.resourceRequirements);
  const discountRate = a.discountRate ?? (npvCalculation as Record<string, unknown>)?.discountRate;

  // ── Financial coherence guardrails ─────────────────────────────────────
  // AI sometimes returns inconsistent money numbers (e.g., negative ROI when benefits > costs).
  // Recompute ROI/NPV/Payback deterministically when they look invalid.
  const costN = toNumber(totalCostEstimate, 0);
  const benefitN = toNumber(benefitEstimate, 0);
  const discountRateN = toNumber(discountRate ?? 8, 8);
  const rawTimeframe = toNumber(a.tcoTimeframe ?? 36, 36);
  // AI sometimes provides timeframe as years (e.g., 3 or 5) rather than months.
  // Treat small values as years and convert, then clamp to a sane window.
  const normalizedTimeframeMonths = rawTimeframe > 0 && rawTimeframe <= 10
    ? rawTimeframe * 12
    : rawTimeframe;
  const timeframeMonths = Math.min(120, Math.max(12, Math.round(normalizedTimeframeMonths || 36)));
  const providedRoiN = toNumber(roiPercentage, NaN);
  const providedPaybackN = toNumber(paybackMonths, NaN);
  const providedNpvN = toNumber(npvValue, NaN);

  const derivedRoiN = costN > 0 ? ((benefitN - costN) / costN) * 100 : 0;
  const monthlyBenefit = timeframeMonths > 0 ? benefitN / timeframeMonths : 0;
  const derivedPaybackMonths = monthlyBenefit > 0 ? costN / monthlyBenefit : 0;

  const monthlyDiscount = Math.pow(1 + discountRateN / 100, 1 / 12) - 1;
  let derivedNpv = -costN;
  if (monthlyBenefit > 0) {
    for (let m = 1; m <= timeframeMonths; m += 1) {
      derivedNpv += monthlyBenefit / Math.pow(1 + monthlyDiscount, m);
    }
  }

  const roiLooksInvalid = !Number.isFinite(providedRoiN)
    || (costN > 0 && benefitN > 0 && Math.sign(providedRoiN) !== Math.sign(derivedRoiN) && Math.abs(derivedRoiN) > 1)
    || (Number.isFinite(providedRoiN) && Math.abs(providedRoiN - derivedRoiN) > 75);

  const paybackLooksInvalid = !Number.isFinite(providedPaybackN)
    || providedPaybackN < 0
    || (monthlyBenefit > 0 && providedPaybackN === 0)
    || (Number.isFinite(providedPaybackN) && derivedPaybackMonths > 0 && Math.abs(providedPaybackN - derivedPaybackMonths) > Math.max(6, derivedPaybackMonths * 0.5));

  const npvLooksInvalid = !Number.isFinite(providedNpvN)
    || (costN > 0 && benefitN > 0 && Math.sign(providedNpvN) !== Math.sign(derivedNpv) && Math.abs(derivedNpv) > 1)
    || (Number.isFinite(providedNpvN) && Number.isFinite(derivedNpv) && Math.abs(providedNpvN - derivedNpv) > Math.max(50_000, Math.abs(derivedNpv) * 0.5));

  const finalRoi = roiLooksInvalid ? derivedRoiN : providedRoiN;
  const finalPayback = paybackLooksInvalid ? derivedPaybackMonths : providedPaybackN;
  const finalNpv = npvLooksInvalid ? derivedNpv : providedNpvN;

  const finalRoiCalculation = Object.keys(roiCalculation).length > 0 && !roiLooksInvalid
    ? roiCalculation
    : {
        roi: finalRoi,
        basis: "computed",
        formula: "(totalBenefitEstimate - totalCostEstimate) / totalCostEstimate * 100",
        totalCostEstimate: costN,
        totalBenefitEstimate: benefitN,
      };

  const finalPaybackCalculation = Object.keys(paybackCalculation).length > 0 && !paybackLooksInvalid
    ? paybackCalculation
    : {
        paybackMonths: finalPayback,
        basis: "computed",
        assumptions: {
          timeframeMonths,
          monthlyBenefit,
        },
      };

  const finalNpvCalculation = Object.keys(npvCalculation).length > 0 && !npvLooksInvalid
    ? npvCalculation
    : {
        npv: finalNpv,
        basis: "computed",
        discountRate: discountRateN,
        timeframeMonths,
        monthlyDiscountRate: monthlyDiscount,
        cashFlows: [
          { month: 0, type: "cost", amount: -costN },
          ...Array.from({ length: timeframeMonths }).map((_, idx) => ({ month: idx + 1, type: "benefit", amount: monthlyBenefit })),
        ],
      };

  return {
    demandReportId: params.demandReportId,
    decisionSpineId: params.decisionSpineId,
    generatedBy: params.generatedBy,
    generationMethod: "ai_full",
    aiModel: (() => { const meta = a.meta; return meta && typeof meta === "object" && (meta as Record<string, unknown>).engine ? String((meta as Record<string, unknown>).engine) : null; })(),

    executiveSummary: asString(a.executiveSummary, ""),
    backgroundContext: typeof a.backgroundContext === "string" ? a.backgroundContext : null,
    problemStatement: typeof a.problemStatement === "string" ? a.problemStatement : null,

    businessRequirements: asString(a.businessRequirements, ""),
    solutionOverview: asString(a.solutionOverview ?? a.proposedSolution, ""),
    proposedSolution: asString(a.proposedSolution ?? a.solutionOverview, ""),
    alternativeSolutions: Array.isArray(a.alternativeSolutions) ? a.alternativeSolutions : null,

    smartObjectives: a.smartObjectives ?? null,
    scopeDefinition: a.scopeDefinition ?? null,
    expectedDeliverables: a.expectedDeliverables ?? null,

    totalCostEstimate: toMoneyString(costN),
    totalBenefitEstimate: toMoneyString(benefitN),
    roiPercentage: toMoneyString(finalRoi, "0.00"),
    roiCalculation: finalRoiCalculation,
    npvValue: toMoneyString(finalNpv, "0.00"),
    npvCalculation: finalNpvCalculation,
    discountRate: toMoneyString(discountRateN, "8.00"),
    paybackMonths: toMoneyString(finalPayback, "0.00"),
    paybackCalculation: finalPaybackCalculation,

    tcoBreakdown: Object.keys(tcoBreakdown).length > 0 ? tcoBreakdown : { implementation: 0, operational: 0, maintenance: 0 },
    tcoTimeframe: typeof a.tcoTimeframe === "number" ? a.tcoTimeframe : 36,
    implementationCosts: Object.keys(implementationCosts).length > 0 ? implementationCosts : {},
    operationalCosts: Object.keys(operationalCosts).length > 0 ? operationalCosts : {},
    benefitsBreakdown: Object.keys(benefitsBreakdown).length > 0 ? benefitsBreakdown : {},
    costSavings: a.costSavings ?? null,
    detailedCosts: a.detailedCosts ?? null,
    detailedBenefits: a.detailedBenefits ?? null,

    riskLevel: asString(a.riskLevel, "medium"),
    riskScore: Math.round(toNumber(a.riskScore, 50)),
    identifiedRisks,
    mitigationStrategies,
    contingencyPlans: a.contingencyPlans ?? null,
    riskMatrixData: a.riskMatrixData ?? null,

    implementationPhases: asArrayOrEmpty(implementationPhases),
    implementationTimeline: normalizedTimeline,
    timeline: normalizedTimeline,
    milestones: asArrayOrEmpty(milestones),
    keyMilestones: asArrayOrEmpty(milestones),
    resourceRequirements: Object.keys(resourceRequirements).length > 0 ? resourceRequirements : {},
    dependencies: a.dependencies ?? null,

    kpis,
    successCriteria,
    performanceTargets,
    measurementPlan: a.measurementPlan ?? null,

    complianceRequirements: a.complianceRequirements ?? null,
    governanceFramework: a.governanceFramework ?? null,
    policyReferences: a.policyReferences ?? null,
    auditRequirements: a.auditRequirements ?? null,

    strategicObjectives: a.strategicObjectives ?? null,
    departmentImpact: a.departmentImpact ?? null,
    organizationalBenefits: a.organizationalBenefits ?? null,

    stakeholderAnalysis: a.stakeholderAnalysis ?? null,
    communicationPlan: a.communicationPlan ?? null,

    keyAssumptions: a.keyAssumptions ?? null,
    projectDependencies: a.projectDependencies ?? null,

    recommendations: a.recommendations ?? a.recommendation ?? null,
    conclusionSummary: typeof a.conclusionSummary === "string" ? a.conclusionSummary : null,
    nextSteps: a.nextSteps ?? null,

    status: "draft",
    approvalStatus: "pending",

    validationStatus: a.validationStatus ?? null,
    validationErrors: a.validationErrors ?? null,
    qualityScore: typeof a.qualityScore === "number" ? a.qualityScore : null,
    qualityReport: params.qualityReport ?? a.qualityReport ?? null,

    clarifications: a.clarifications ?? null,
    completenessScore: a.completenessScore ?? null,
    clarificationResponses: a.clarificationResponses ?? null,

    financialAssumptions: a.financialAssumptions ?? null,
    domainParameters: a.domainParameters ?? null,
    aiRecommendedBudget: a.aiRecommendedBudget ?? null,
    computedFinancialModel: a.computedFinancialModel ?? null,

    marketResearch: a.marketResearch ?? null,
    marketResearchGeneratedAt: a.marketResearchGeneratedAt ?? null,
  };
}
