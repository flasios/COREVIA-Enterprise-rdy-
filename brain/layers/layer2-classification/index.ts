import { randomUUID } from "crypto";
import {
  DecisionObject,
  LayerResult,
  ClassificationData,
  ClassificationLevel,
  AuditEvent
} from "@shared/schemas/corevia/decision-object";
import { logger } from "../../../platform/observability";

/**
 * Layer 2: Classification & Sensitivity
 *
 * Responsibilities:
 * - Classify as Public/Internal/Confidential/Sovereign
 * - Detect sector and jurisdiction
 * - Assess risk level
 * - Issue constraints (cloud/external/HITL)
 *
 * INVARIANT: Classification determines what intelligence can run
 */
export class Layer2Classification {
    private asRecord(value: unknown): Record<string, unknown> {
      return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    }

  private normalizeExplicitClassification(value: unknown): ClassificationLevel | null {
    if (typeof value !== "string") {
      return null;
    }

    switch (value.trim().toLowerCase()) {
      case "public":
        return "public";
      case "internal":
        return "internal";
      case "auto":
        return null;
      case "confidential":
        return "confidential";
      case "secret":
      case "top_secret":
      case "top-secret":
      case "sovereign":
      case "high_sensitive":
      case "high-sensitive":
        return "sovereign";
      default:
        return null;
    }
  }

  private selectHigherClassification(
    explicitClassification: ClassificationLevel | null,
    heuristicClassification: ClassificationLevel,
  ): ClassificationLevel {
    if (!explicitClassification) {
      return heuristicClassification;
    }

    const sensitivityRank: Record<ClassificationLevel, number> = {
      public: 0,
      internal: 1,
      confidential: 2,
      sovereign: 3,
    };

    return sensitivityRank[explicitClassification] >= sensitivityRank[heuristicClassification]
      ? explicitClassification
      : heuristicClassification;
  }

  // Keywords that indicate higher classification levels
  private readonly sovereignKeywords = [
    "national security", "defense", "military", "classified", "secret",
    "top secret", "restricted", "government sensitive", "critical infrastructure",
    "border control", "intelligence agency", "armed forces", "homeland security",
    "nuclear", "weapons", "cyber warfare", "state secret", "diplomatic",
    "ministry of interior", "ministry of defence", "national guard",
  ];

  private readonly confidentialKeywords = [
    "personal data", "pii", "financial records", "medical records",
    "salary", "ssn", "passport", "identity document", "identity records", "credit card",
    "patient data", "employee records", "tax records", "biometric",
    "health insurance", "social security", "criminal record", "visa",
    "residence permit", "emirates id", "national id", "disaster recovery",
    "business continuity", "critical digital assets", "real-time data replication",
    "data replication", "failover", "recovery time objective", "recovery point objective",
    "rto", "rpo",
  ];

  private readonly internalKeywords = [
    "internal only", "company confidential", "proprietary", "trade secret",
    "budget", "strategy", "roadmap", "personnel", "procurement",
    "tender", "rfp", "contract", "vendor selection", "pricing",
    "cost analysis", "workforce planning", "organizational restructuring",
  ];

  private readonly publicKeywords = [
    "public service", "open data", "public announcement", "press release",
    "community", "citizen service", "public portal", "transparency",
    "public consultation", "open tender", "public report",
  ];

  /**
   * Execute Layer 2 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();

    try {
      const input = decision.input;
      if (!input) {
        throw new Error("No intake data available for classification");
      }

      // Analyze content for classification — combine all available context
      const normalizedInput = this.asRecord(input.normalizedInput || input.rawInput);
      const allContext = [
        JSON.stringify(input.normalizedInput || input.rawInput),
        typeof normalizedInput.organizationName === 'string' ? normalizedInput.organizationName : '',
        typeof normalizedInput.department === 'string' ? normalizedInput.department : '',
        typeof normalizedInput.requestorName === 'string' ? normalizedInput.requestorName : '',
        typeof normalizedInput.businessObjective === 'string' ? normalizedInput.businessObjective : '',
      ].join(' ').toLowerCase();

      const explicitClassification = this.normalizeExplicitClassification(
        normalizedInput.dataClassification
        || normalizedInput.classificationLevel
        || normalizedInput.classification
        || normalizedInput.accessLevel
      );

      const heuristicClassification = this.determineClassificationLevel(allContext);
      const classificationLevel = this.selectHigherClassification(explicitClassification, heuristicClassification);

      // Determine risk level based on classification
      const riskLevel = this.determineRiskLevel(classificationLevel, input);

      // Detect sector and jurisdiction
      const sector = this.detectSector(input);
      const jurisdiction = this.detectJurisdiction(input);

      // Issue constraints based on classification
      const constraints = this.determineConstraints(classificationLevel, riskLevel);

      const classificationData: ClassificationData = {
        classificationLevel,
        sector,
        jurisdiction,
        riskLevel,
        constraints,
        classifiedBy: explicitClassification ? "manual" : "auto",
        classificationReason: explicitClassification
          ? classificationLevel === explicitClassification
            ? `Explicit classification selected in request. Level: ${classificationLevel}`
            : `Request selected ${explicitClassification}, but content sensitivity elevated classification to ${classificationLevel}`
          : `Auto-classified based on content analysis. Level: ${classificationLevel}`,
      };

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 2,
        eventType: "classification_completed",
        eventData: {
          level: classificationLevel,
          riskLevel,
          sector,
          jurisdiction,
          constraints,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(`[Layer 2] Classification: ${classificationLevel} (Risk: ${riskLevel})`);

      return {
        success: true,
        layer: 2,
        status: "policy_check",
        data: classificationData,
        shouldContinue: true,
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 2,
        eventType: "classification_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 2,
        status: "blocked",
        error: error instanceof Error ? error.message : "Classification failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  /**
   * Determine classification level based on content
   */
  private determineClassificationLevel(content: string): ClassificationLevel {
    // Check for sovereign keywords first (highest priority)
    if (this.sovereignKeywords.some(kw => content.includes(kw))) {
      return "sovereign";
    }

    // Check for confidential keywords
    if (this.confidentialKeywords.some(kw => content.includes(kw))) {
      return "confidential";
    }

    // Check for internal keywords
    if (this.internalKeywords.some(kw => content.includes(kw))) {
      return "internal";
    }

    // Check for public keywords — only classify as public if explicit signals
    if (this.publicKeywords.some(kw => content.includes(kw))) {
      return "public";
    }

    // Default to internal for government context
    return "internal";
  }

  /**
   * Determine risk level
   */
  private determineRiskLevel(
    classification: ClassificationLevel,
    input: unknown
  ): "low" | "medium" | "high" | "critical" {
    // Base risk from data classification
    const classificationRisk: Record<ClassificationLevel, "low" | "medium" | "high" | "critical"> = {
      public: "low",
      internal: "medium",
      confidential: "high",
      sovereign: "critical",
    };

    let riskLevel = classificationRisk[classification];

    // Elevate based on demand input signals (only escalate, never downgrade)
    if (riskLevel === "low" || riskLevel === "medium") {
      const inputRecord = this.asRecord(input);
      const normalizedInput = this.asRecord(inputRecord.normalizedInput || inputRecord.rawInput);
      const content = JSON.stringify(normalizedInput).toLowerCase();

      // Budget-driven elevation
      const rawBudget = normalizedInput.estimatedBudget ?? normalizedInput.budget ?? 0;
      const budgetValue =
        typeof rawBudget === "number"
          ? rawBudget
          : typeof rawBudget === "string"
            ? Number.parseFloat(String(rawBudget).replace(/[^0-9.]/g, ""))
            : 0;

      if (Number.isFinite(budgetValue) && budgetValue > 50_000_000) {
        riskLevel = "critical";
      } else if (Number.isFinite(budgetValue) && budgetValue > 10_000_000) {
        riskLevel = "high";
      } else if (
        // Explicit critical-risk signals in demand content
        content.includes("critical risk") ||
        content.includes("critical risks") ||
        content.includes("national security") ||
        content.includes("strategic national") ||
        content.includes("high risk") ||
        content.includes("very high risk")
      ) {
        riskLevel = "critical";
      } else if (
        // Strategic/cross-entity signals → elevate from low/medium to high
        content.includes("strategic") ||
        content.includes("enterprise wide") ||
        content.includes("cross ministry") ||
        content.includes("inter ministry") ||
        content.includes("national level")
      ) {
        riskLevel = "high";
      }
    }

    return riskLevel;
  }

  /**
   * Detect sector from input
   */
  private detectSector(input: unknown): string | undefined {
    const inputRecord = this.asRecord(input);
    const normalizedInput = this.asRecord(inputRecord.normalizedInput || inputRecord.rawInput);
    const content = [
      JSON.stringify(normalizedInput),
      typeof normalizedInput.organizationName === 'string' ? normalizedInput.organizationName : '',
      typeof normalizedInput.department === 'string' ? normalizedInput.department : '',
      typeof normalizedInput.industryType === 'string' ? normalizedInput.industryType : '',
    ].join(' ').toLowerCase();

    const sectors: Record<string, string[]> = {
      "government": ["government", "ministry", "public sector", "municipality", "federal", "emirate", "authority"],
      "healthcare": ["health", "hospital", "medical", "patient", "clinic", "pharmaceutical"],
      "finance": ["banking", "finance", "investment", "treasury", "insurance", "fintech"],
      "defense": ["defense", "military", "armed forces", "national guard", "ministry of defense", "military intelligence"],
      "education": ["education", "school", "university", "academic", "training", "scholarship"],
      "infrastructure": ["infrastructure", "transport", "mobility", "autonomous", "taxi", "utilities", "energy", "water", "electricity"],
      "technology": ["technology", "digital", "it ", "software", "ai ", "data center", "smart city"],
      "tourism": ["tourism", "hospitality", "hotel", "travel", "airline", "expo"],
      "real_estate": ["real estate", "property", "construction", "housing", "urban planning"],
    };

    for (const [sector, keywords] of Object.entries(sectors)) {
      if (keywords.some(kw => content.includes(kw))) {
        return sector;
      }
    }

    return "government"; // Default for UAE context
  }

  /**
   * Detect jurisdiction from input
   */
  private detectJurisdiction(input: unknown): string | undefined {
    const inputRecord = this.asRecord(input);
    const content = JSON.stringify(inputRecord.normalizedInput || inputRecord.rawInput).toLowerCase();

    if (content.includes("uae") || content.includes("emirates") || content.includes("dubai") || content.includes("abu dhabi")) {
      return "UAE";
    }

    return "UAE"; // Default jurisdiction
  }

  /**
   * Determine constraints based on classification and risk
   */
  private determineConstraints(
    classification: ClassificationLevel,
    riskLevel: string
  ): ClassificationData["constraints"] {
    switch (classification) {
      case "sovereign":
        return {
          allowCloudProcessing: false,
          allowExternalModels: false,
          requireHitl: true,
          additional: {
            requireDataLocalization: true,
            requireAuditEnhanced: true,
          },
        };

      case "confidential":
        // External models are permitted for confidential enterprise demands.
        // Confidential = sensitive enterprise data (HR, finance, procurement) — it is NOT
        // a sovereignty mandate. Only "sovereign" classification requires data localisation
        // and blocks external LLMs. Confidential demands still require HITL review and
        // data redaction, but can use Hybrid (external) engines for artifact generation.
        return {
          allowCloudProcessing: true,
          allowExternalModels: true,
          requireHitl: true,
          additional: {
            requireDataRedaction: true,
          },
        };

      case "internal":
        return {
          allowCloudProcessing: true,
          allowExternalModels: true,
          requireHitl: riskLevel === "high",
        };

      case "public":
      default:
        return {
          allowCloudProcessing: true,
          allowExternalModels: true,
          requireHitl: false,
        };
    }
  }
}
