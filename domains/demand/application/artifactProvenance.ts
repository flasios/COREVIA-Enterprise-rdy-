function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function resolveEngineLabel(kind: string | null): string | null {
  if (kind === "SOVEREIGN_INTERNAL") return "Engine A / Sovereign Internal";
  if (kind === "EXTERNAL_HYBRID") return "Engine B / External Hybrid";
  if (kind === "DISTILLATION") return "Engine C / Distillation";
  return null;
}

export interface ArtifactProvenance {
  generatedAt: string | null;
  legacyEngine: string | null;
  plannedEngineKind: string | null;
  plannedEngineLabel: string | null;
  plannedPluginId: string | null;
  plannedPluginName: string | null;
  actualEngineKind: string | null;
  actualEngineLabel: string | null;
  executionMode: string | null;
  usedInternalEngine: boolean | null;
  usedHybridEngine: boolean | null;
  hybridStatus: string | null;
}

export function deriveArtifactProvenance(brainResult: unknown): ArtifactProvenance | null {
  const brain = asRecord(brainResult);
  const decision = asRecord(brain.decision);
  const orchestration = asRecord(decision.orchestration);
  const selectedEngines = asRecord(orchestration.selectedEngines);
  const primary = asRecord(selectedEngines.primary);

  const plannedEngineKind = asString(primary.kind);
  const plannedPluginId = asString(primary.pluginId);
  const plannedPluginName = asString(primary.pluginName) || asString(primary.name);

  const rawAuditEvents = Array.isArray(decision.auditEvents)
    ? (decision.auditEvents as unknown[])
    : Array.isArray(brain.auditEvents)
      ? (brain.auditEvents as unknown[])
      : [];

  const layer6Event = [...rawAuditEvents]
    .map((event) => asRecord(event))
    .reverse()
    .find((event) => {
      const layer = event.layer;
      const eventType = asString(event.eventType);
      return layer === 6 || eventType === "reasoning_completed";
    });

  const eventData = asRecord(layer6Event?.eventData);
  const usedInternalEngine = asBoolean(eventData.usedInternalEngine);
  const usedHybridEngine = asBoolean(eventData.usedHybridEngine);
  const hybridStatus = asString(eventData.hybridStatus);

  let actualEngineKind: string | null = null;
  let actualEngineLabel: string | null = null;
  let executionMode: string | null = null;
  let legacyEngine: string | null = null;

  if (usedInternalEngine && usedHybridEngine) {
    actualEngineKind = "MIXED";
    actualEngineLabel = hybridStatus === "fallback"
      ? "Engine A with hybrid fallback"
      : "Engine A with hybrid assistance";
    executionMode = hybridStatus === "fallback"
      ? "internal_with_hybrid_fallback"
      : "internal_with_hybrid_assistance";
    legacyEngine = "A+B";
  } else if (usedInternalEngine) {
    actualEngineKind = "SOVEREIGN_INTERNAL";
    actualEngineLabel = "Engine A only";
    executionMode = "internal_only";
    legacyEngine = "A";
  } else if (usedHybridEngine) {
    actualEngineKind = "EXTERNAL_HYBRID";
    actualEngineLabel = hybridStatus === "fallback" ? "Engine B fallback" : "Engine B only";
    executionMode = hybridStatus === "fallback" ? "hybrid_fallback" : "hybrid_only";
    legacyEngine = "B";
  }

  const resolvedGeneratedAt = asString(asRecord(brain.generatedArtifact).generatedAt)
    || asString(asRecord(decision.generatedArtifact).generatedAt)
    || new Date().toISOString();

  const hasSignal = plannedEngineKind || actualEngineKind || usedInternalEngine !== null || usedHybridEngine !== null;
  if (!hasSignal) {
    return null;
  }

  return {
    generatedAt: resolvedGeneratedAt,
    legacyEngine,
    plannedEngineKind,
    plannedEngineLabel: resolveEngineLabel(plannedEngineKind),
    plannedPluginId,
    plannedPluginName,
    actualEngineKind,
    actualEngineLabel,
    executionMode,
    usedInternalEngine,
    usedHybridEngine,
    hybridStatus,
  };
}

export function attachArtifactProvenance<T extends Record<string, unknown>>(artifact: T, brainResult: unknown): T {
  const originalMeta = asRecord(artifact.meta);
  const provenance = deriveArtifactProvenance(brainResult);

  if (!provenance) {
    return artifact;
  }

  return {
    ...artifact,
    meta: {
      ...originalMeta,
      generatedAt: provenance.generatedAt,
      engine: provenance.legacyEngine ?? originalMeta.engine ?? null,
      provenance,
    },
  };
}

export function buildArtifactMetaFromPayload(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  const meta = asRecord(record.meta);
  const provenance = asRecord(meta.provenance);

  const generatedAt = asString(meta.generatedAt) || asString(provenance.generatedAt);
  const engine = asString(meta.engine) || asString(provenance.legacyEngine);
  const plannedEngineKind = asString(provenance.plannedEngineKind);
  const plannedEngineLabel = asString(provenance.plannedEngineLabel);
  const plannedPluginId = asString(provenance.plannedPluginId);
  const plannedPluginName = asString(provenance.plannedPluginName);
  const actualEngineKind = asString(provenance.actualEngineKind);
  const actualEngineLabel = asString(provenance.actualEngineLabel);
  const executionMode = asString(provenance.executionMode);
  const hybridStatus = asString(provenance.hybridStatus);
  const usedInternalEngine = asBoolean(provenance.usedInternalEngine);
  const usedHybridEngine = asBoolean(provenance.usedHybridEngine);

  const hasAnyValue = [
    generatedAt,
    engine,
    plannedEngineKind,
    actualEngineKind,
    executionMode,
    hybridStatus,
  ].some(Boolean) || usedInternalEngine !== null || usedHybridEngine !== null;

  if (!hasAnyValue) {
    return null;
  }

  return {
    artifactVersionId: null,
    version: null,
    generatedAt,
    engine,
    plannedEngineKind,
    plannedEngineLabel,
    plannedPluginId,
    plannedPluginName,
    actualEngineKind,
    actualEngineLabel,
    executionMode,
    usedInternalEngine,
    usedHybridEngine,
    hybridStatus,
  };
}