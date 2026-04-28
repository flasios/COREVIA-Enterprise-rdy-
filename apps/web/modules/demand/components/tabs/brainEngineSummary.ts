function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

type EngineSummaryVariant = "internal" | "hybrid" | "pending";

export interface EngineSummaryCard {
  badge: string;
  label: string;
  description: string;
  variant: EngineSummaryVariant;
}

export interface BrainEngineSummary {
  planned: EngineSummaryCard;
  actual: EngineSummaryCard;
}

function findLayer6EventData(brainDecision: unknown): Record<string, unknown> {
  const decision = asRecord(brainDecision);
  const auditTrail = Array.isArray(decision.auditTrail) ? decision.auditTrail : [];
  const layer6Entry = [...auditTrail]
    .map((entry) => asRecord(entry))
    .reverse()
    .find((entry) => {
      const payload = asRecord(entry.payload);
      const layer = typeof entry.layer === "number"
        ? entry.layer
        : (typeof payload.layer === "number" ? payload.layer : null);
      return layer === 6;
    });

  return asRecord(asRecord(layer6Entry).payload).eventData as Record<string, unknown> || {};
}

function resolvePlannedSummary(brainDecision: unknown, artifactMeta: unknown): EngineSummaryCard {
  const decision = asRecord(brainDecision);
  const orchestrationPlan = asRecord(decision.orchestrationPlan);
  const routing = asRecord(orchestrationPlan.routing);
  const plannedEngineKind = asString(routing.primaryEngineKind) || asString(asRecord(artifactMeta).plannedEngineKind);
  const plannedPluginName = asString(routing.primaryPluginName)
    || asString(asRecord(artifactMeta).plannedPluginName)
    || asString(asRecord(orchestrationPlan.primaryPlugin).name);

  if (plannedEngineKind === "EXTERNAL_HYBRID") {
    return {
      badge: "Engine B planned",
      label: "Engine B / External Hybrid",
      description: plannedPluginName
        ? `The brain planned a hybrid run via ${plannedPluginName}.`
        : "The brain planned a hybrid external run.",
      variant: "hybrid",
    };
  }

  if (plannedEngineKind === "SOVEREIGN_INTERNAL") {
    return {
      badge: "Engine A planned",
      label: "Engine A / Sovereign Internal",
      description: plannedPluginName
        ? `The brain planned to stay on the internal route via ${plannedPluginName}.`
        : "The brain planned to stay on the internal sovereign route.",
      variant: "internal",
    };
  }

  return {
    badge: "Route pending",
    label: "Planned route not recorded",
    description: "The saved artifact does not yet include a planned engine route.",
    variant: "pending",
  };
}

function resolveActualSummary(brainDecision: unknown, artifactMeta: unknown): EngineSummaryCard {
  const eventData = findLayer6EventData(brainDecision);
  const meta = asRecord(artifactMeta);

  const usedInternalEngine = typeof eventData.usedInternalEngine === "boolean"
    ? Boolean(eventData.usedInternalEngine)
    : meta.usedInternalEngine === true;
  const usedHybridEngine = typeof eventData.usedHybridEngine === "boolean"
    ? Boolean(eventData.usedHybridEngine)
    : meta.usedHybridEngine === true;
  const hybridStatus = asString(eventData.hybridStatus) || asString(meta.hybridStatus);
  const actualEngineKind = asString(meta.actualEngineKind);
  const actualEngineLabel = asString(meta.actualEngineLabel);

  if (usedInternalEngine && usedHybridEngine) {
    return {
      badge: "Hybrid fallback engaged",
      label: hybridStatus === "fallback" ? "Engine A with hybrid fallback" : "Engine A with hybrid assistance",
      description: "The run started internally and also used the hybrid path to complete or repair the draft.",
      variant: "hybrid",
    };
  }

  if (usedInternalEngine || actualEngineKind === "SOVEREIGN_INTERNAL") {
    return {
      badge: "Engine A executed",
      label: actualEngineLabel || "Generated on Engine A only",
      description: "The draft completed on the internal offline LLM path without switching to the hybrid engine.",
      variant: "internal",
    };
  }

  if (usedHybridEngine || actualEngineKind === "EXTERNAL_HYBRID") {
    return {
      badge: "Hybrid executed",
      label: actualEngineLabel || "Generated on the hybrid path",
      description: "The draft used the hybrid engine path for generation.",
      variant: "hybrid",
    };
  }

  return {
    badge: "Execution pending",
    label: "Awaiting runtime evidence",
    description: "The route is known, but final Layer 6 execution telemetry is not available for this artifact yet.",
    variant: "pending",
  };
}

export function summarizeBrainEngineUsage(brainDecision: unknown, artifactMeta: unknown): BrainEngineSummary {
  return {
    planned: resolvePlannedSummary(brainDecision, artifactMeta),
    actual: resolveActualSummary(brainDecision, artifactMeta),
  };
}