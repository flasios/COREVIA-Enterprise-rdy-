import { db } from "../db";
import { layerConfigurations } from "@shared/schema/corevia";
import { eq, sql } from "drizzle-orm";

export type PolicyMode = "enforce" | "monitor";

export interface LayerConfig {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  mode: "enforce" | "monitor" | "bypass";
  timeoutMs: number;
  retries: number;
  slaMs: number;
  approvalRequired: boolean;
  approvalRoles: string[];
  description: string;
}

export interface ControlPlaneState {
  intakeEnabled: boolean;
  policyMode: PolicyMode;
  agentThrottle: number;
  updatedAt: string;
  layers: LayerConfig[];
}

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 1, key: "intake", name: "Intake & Canonicalization", enabled: true, mode: "enforce", timeoutMs: 30000, retries: 2, slaMs: 30000, approvalRequired: false, approvalRoles: [], description: "Receives raw demands from intake plugins, canonicalizes fields and validates schema" },
  { id: 2, key: "classification", name: "Classification & Sensitivity", enabled: true, mode: "enforce", timeoutMs: 15000, retries: 1, slaMs: 15000, approvalRequired: false, approvalRoles: [], description: "Auto-classifies data sensitivity (Public → Sovereign) and applies routing tags" },
  { id: 3, key: "policyops", name: "Policy & Governance (Friction)", enabled: true, mode: "enforce", timeoutMs: 10000, retries: 0, slaMs: 10000, approvalRequired: false, approvalRoles: [], description: "Evaluates active policy packs — can BLOCK or FLAG decisions before intelligence" },
  { id: 4, key: "context", name: "Context Readiness", enabled: true, mode: "enforce", timeoutMs: 60000, retries: 3, slaMs: 60000, approvalRequired: false, approvalRoles: [], description: "Gathers missing context, verifies completeness, may pause for NEEDS_INFO" },
  { id: 5, key: "routing", name: "Intelligence Routing", enabled: true, mode: "enforce", timeoutMs: 5000, retries: 1, slaMs: 5000, approvalRequired: false, approvalRoles: [], description: "Routes to the correct engine (A: Sovereign Internal, B: External Hybrid, C: Distillation)" },
  { id: 6, key: "intelligence", name: "Governed Intelligence", enabled: true, mode: "enforce", timeoutMs: 1_080_000, retries: 0, slaMs: 900_000, approvalRequired: false, approvalRoles: [], description: "Executes AI analysis through the selected engine with redaction and attestation" },
  { id: 7, key: "approval", name: "Authority Validation (HITL)", enabled: true, mode: "enforce", timeoutMs: 0, retries: 0, slaMs: 0, approvalRequired: false, approvalRoles: ["pmo_director", "director"], description: "Human-in-the-loop approval gate — creates ApprovalID for authorized signatories when policy or control-plane approval requires it" },
  { id: 8, key: "memory", name: "Memory, Learning & Controlled Execution", enabled: true, mode: "enforce", timeoutMs: 60000, retries: 1, slaMs: 60000, approvalRequired: false, approvalRoles: [], description: "Records decision memory and runs approved post-approval actions when authorized" },
];

function cloneDefaults(): LayerConfig[] {
  return DEFAULT_LAYERS.map(l => ({ ...l, approvalRoles: [...l.approvalRoles] }));
}

const DEFAULT_STATE: ControlPlaneState = {
  intakeEnabled: true,
  policyMode: "enforce",
  agentThrottle: 100,
  updatedAt: new Date().toISOString(),
  layers: cloneDefaults(),
};

function getStore(): ControlPlaneState {
  const globalStore = globalThis as { __coreviaControlPlane?: ControlPlaneState };
  if (!globalStore.__coreviaControlPlane) {
    globalStore.__coreviaControlPlane = {
      intakeEnabled: DEFAULT_STATE.intakeEnabled,
      policyMode: DEFAULT_STATE.policyMode,
      agentThrottle: DEFAULT_STATE.agentThrottle,
      updatedAt: new Date().toISOString(),
      layers: cloneDefaults(),
    };
  }
  return globalStore.__coreviaControlPlane;
}

// ── DB persistence helpers ─────────────────────────────────────────────

let _dbLoaded = false;

/** Load saved layer configs from the database on first access */
export async function loadLayerConfigsFromDB(): Promise<void> {
  if (_dbLoaded) return;
  try {
    const rows = await db.select().from(layerConfigurations);
    if (rows.length > 0) {
      const store = getStore();
      for (const row of rows) {
        const cfg = row.config as Record<string, unknown>;
        const layer = store.layers.find(l => l.key === row.layerKey);
        if (layer && cfg) {
          if (cfg.enabled !== undefined) layer.enabled = cfg.enabled as boolean;
          if (cfg.mode) layer.mode = cfg.mode as LayerConfig["mode"];
          if (cfg.timeoutMs !== undefined) layer.timeoutMs = cfg.timeoutMs as number;
          if (cfg.retries !== undefined) layer.retries = cfg.retries as number;
          if (cfg.slaMs !== undefined) layer.slaMs = cfg.slaMs as number;
          if (cfg.approvalRequired !== undefined) layer.approvalRequired = cfg.approvalRequired as boolean;
          if (Array.isArray(cfg.approvalRoles)) layer.approvalRoles = cfg.approvalRoles as string[];
          if (cfg.name) layer.name = cfg.name as string;
          if (cfg.description) layer.description = cfg.description as string;
        }
      }
      store.updatedAt = new Date().toISOString();
    }
    _dbLoaded = true;
  } catch (err) {
    // If DB isn't ready yet, fall through to in-memory defaults
    console.warn("[ControlPlane] Could not load layer configs from DB:", err instanceof Error ? err.message : err);
    _dbLoaded = true; // Don't retry every call
  }
}

/** Persist a single layer config to the database */
async function persistLayerConfig(layer: LayerConfig): Promise<void> {
  try {
    const existing = await db.select().from(layerConfigurations).where(eq(layerConfigurations.layerKey, layer.key));
    const configPayload = {
      enabled: layer.enabled,
      mode: layer.mode,
      timeoutMs: layer.timeoutMs,
      retries: layer.retries,
      slaMs: layer.slaMs,
      approvalRequired: layer.approvalRequired,
      approvalRoles: layer.approvalRoles,
      name: layer.name,
      description: layer.description,
    };

    if (existing.length > 0) {
      await db.update(layerConfigurations)
        .set({
          config: configPayload,
          version: sql`${layerConfigurations.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(layerConfigurations.layerKey, layer.key));
    } else {
      await db.insert(layerConfigurations).values({
        layerKey: layer.key,
        config: configPayload,
      });
    }
  } catch (err) {
    console.error("[ControlPlane] Failed to persist layer config:", err instanceof Error ? err.message : err);
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export function getControlPlaneState(): ControlPlaneState {
  return { ...getStore(), layers: getStore().layers.map(l => ({ ...l })) };
}

export function setIntakeEnabled(enabled: boolean): ControlPlaneState {
  const store = getStore();
  store.intakeEnabled = enabled;
  store.updatedAt = new Date().toISOString();
  return { ...store };
}

export function setPolicyMode(mode: PolicyMode): ControlPlaneState {
  const store = getStore();
  store.policyMode = mode;
  store.updatedAt = new Date().toISOString();
  return { ...store };
}

export function setAgentThrottle(throttle: number): ControlPlaneState {
  const normalized = Math.max(0, Math.min(100, Math.round(throttle)));
  const store = getStore();
  store.agentThrottle = normalized;
  store.updatedAt = new Date().toISOString();
  return { ...store };
}

export function getLayerConfigs(): LayerConfig[] {
  return getStore().layers.map(l => ({ ...l }));
}

export function getLayerConfig(layerId: number): LayerConfig | undefined {
  return getStore().layers.find(l => l.id === layerId);
}

export function updateLayerConfig(layerId: number, updates: Partial<Omit<LayerConfig, "id" | "key">>): LayerConfig | null {
  const store = getStore();
  const layer = store.layers.find(l => l.id === layerId);
  if (!layer) return null;
  if (updates.enabled !== undefined) layer.enabled = updates.enabled;
  if (updates.mode) layer.mode = updates.mode;
  if (updates.timeoutMs !== undefined) layer.timeoutMs = Math.max(0, updates.timeoutMs);
  if (updates.retries !== undefined) layer.retries = Math.max(0, Math.min(10, updates.retries));
  if (updates.slaMs !== undefined) layer.slaMs = Math.max(0, updates.slaMs);
  if (updates.approvalRequired !== undefined) layer.approvalRequired = updates.approvalRequired;
  if (updates.approvalRoles) layer.approvalRoles = updates.approvalRoles;
  if (updates.name) layer.name = updates.name;
  if (updates.description) layer.description = updates.description;
  store.updatedAt = new Date().toISOString();

  // Persist to database (fire-and-forget — don't block the response)
  persistLayerConfig(layer).catch(() => {});

  return { ...layer };
}
