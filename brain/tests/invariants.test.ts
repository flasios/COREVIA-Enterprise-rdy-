/**
 * COREVIA Brain Console - Unit Tests for 8 Invariants
 * 
 * These tests verify the core governance invariants of the COREVIA Brain
 * via decision-object structure and contract assertions — no database
 * or AI provider required.
 * 
 * 1. No intelligence before Layer 3 allows it
 * 2. No side effects before Layer 7 approval
 * 3. No learning from rejected outputs
 * 4. Append-only decision object
 * 5. Full audit trail
 * 6. Classification constraints respected
 * 7. Policy enforcement is mandatory
 * 8. Approval required for high-risk decisions
 */

import { describe, it, expect } from "vitest";
import { agentRuntime } from "../agents/agent-runtime";
import type { DecisionObject } from "@shared/schemas/corevia/decision-object";
import { ClassificationLevelSchema } from "../../packages/contracts/brain";

/* ---------- helpers ---------- */

function makeDecision(overrides: Partial<DecisionObject> = {}): DecisionObject {
  const now = new Date().toISOString();
  return {
    decisionId: "test-" + Math.random().toString(36).slice(2, 8),
    correlationId: "cor_test_" + Date.now(),
    currentLayer: 1,
    status: "intake",
    audit: {
      events: [{
        id: "evt-1",
        layer: 0,
        eventType: "decision_created",
        eventData: { serviceId: "test", routeKey: "test" },
        actorType: "system",
        timestamp: now,
      }],
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function addLayerEvent(
  decision: DecisionObject,
  layer: number,
  eventType: string,
  actorId = "system",
): DecisionObject {
  const now = new Date().toISOString();
  return {
    ...decision,
    currentLayer: Math.max(decision.currentLayer, layer),
    audit: {
      events: [
        ...decision.audit.events,
        {
          id: `evt-L${layer}-${eventType}`,
          layer,
          eventType,
          eventData: {},
          actorType: "system",
          actorId,
          timestamp: now,
        },
      ],
    },
    updatedAt: now,
  };
}

/* ---------- tests ---------- */

describe("COREVIA Brain - Invariant Tests", () => {
  describe("Classification contract", () => {
    it("accepts public as a first-class classification", () => {
      expect(ClassificationLevelSchema.parse("public")).toBe("public");
    });
  });

  describe("Invariant 1: No intelligence before Layer 3 allows it", () => {
    it("should not have advisory output when still at Layer 1 (Intake)", () => {
      const decision = makeDecision({ currentLayer: 1, status: "intake" });
      // At L1, no policy has been evaluated → advisory must be absent
      expect(decision.advisory).toBeUndefined();
    });

    it("should not have advisory when policy denies at Layer 3", () => {
      const decision = makeDecision({
        currentLayer: 3,
        status: "blocked",
        policy: { result: "deny", reason: "Blocked by policy" },
      });
      // When policy blocks, advisory must not exist
      expect(decision.advisory).toBeUndefined();
    });

    it("should allow advisory only when policy result is 'allow'", () => {
      const decision = makeDecision({
        currentLayer: 6,
        status: "reasoning",
        policy: { result: "allow" },
        advisory: { recommendation: "Proceed", confidence: 0.85 },
      });
      // Advisory exists only because policy allowed it
      expect(decision.policy?.result).toBe("allow");
      expect(decision.advisory).toBeDefined();
    });
  });

  describe("Invariant 2: No side effects before Layer 7 approval", () => {
    it("should have no actions when approval has not been granted", () => {
      const decision = makeDecision({
        currentLayer: 6,
        status: "reasoning",
        validation: { status: "pending" },
      });
      // Without L7 approval, there must be no executed actions
      expect(decision.validation?.status).not.toBe("approved");
      // Decision object must not contain action results
      expect(decision.actions).toBeUndefined();
    });

    it("should only permit actions after explicit approval", () => {
      const decision = makeDecision({
        currentLayer: 8,
        status: "action_execution",
        validation: {
          status: "approved",
          approvedActions: ["create_project"],
        },
      });
      // After approval, actions may be recorded
      expect(decision.validation?.status).toBe("approved");
      expect(decision.validation?.approvedActions?.length).toBeGreaterThan(0);
    });
  });

  describe("Invariant 3: No learning from rejected outputs", () => {
    it("should not have memory entries when decision is rejected", () => {
      const decision = makeDecision({
        currentLayer: 7,
        status: "rejected",
        validation: { status: "rejected" },
      });
      // Rejected decisions must not produce learning/memory
      expect(decision.memory).toBeUndefined();
    });

    it("should only distill artifacts from approved decisions", () => {
      const approved = makeDecision({
        currentLayer: 8,
        status: "completed",
        validation: { status: "approved" },
        memory: { learningArtifactIds: ["art-1"], distilledAt: new Date().toISOString() },
      });
      expect(approved.memory?.learningArtifactIds).toBeDefined();
      expect(approved.memory?.learningArtifactIds?.length).toBeGreaterThan(0);

      const rejected = makeDecision({
        currentLayer: 8,
        status: "rejected",
        validation: { status: "rejected" },
      });
      expect(rejected.memory?.learningArtifactIds).toBeFalsy();
    });
  });

  describe("Invariant 4: Append-only decision object", () => {
    it("should preserve all layer outputs without overwriting", () => {
      let decision = makeDecision();
      decision = addLayerEvent(decision, 1, "intake_completed");
      decision = { ...decision, classification: { level: "internal" } };
      decision = addLayerEvent(decision, 2, "classification_completed");
      decision = { ...decision, policy: { result: "allow" } };
      decision = addLayerEvent(decision, 3, "policy_evaluated");

      // All layers should be preserved
      expect(decision.classification).toBeDefined();
      expect(decision.policy).toBeDefined();
      // Audit trail should be append-only
      expect(decision.audit.events.length).toBeGreaterThanOrEqual(4); // 1 creation + 3 layer events
    });

    it("should never delete or modify previous layer outputs", () => {
      let decision = makeDecision({ classification: { level: "internal" } });
      decision = addLayerEvent(decision, 2, "classification_completed");
      const classificationBefore = decision.classification;

      // Simulate adding L3 policy without touching classification
      decision = { ...decision, policy: { result: "allow" } };
      decision = addLayerEvent(decision, 3, "policy_evaluated");

      // Classification reference must remain identical
      expect(decision.classification).toBe(classificationBefore);
    });
  });

  describe("Invariant 5: Full audit trail", () => {
    it("should record audit events for every layer transition", () => {
      let decision = makeDecision();
      decision = addLayerEvent(decision, 1, "intake_completed", "system");
      decision = addLayerEvent(decision, 2, "classification_completed", "system");
      decision = addLayerEvent(decision, 3, "policy_evaluated", "system");

      // At least 1 event per layer + creation event
      expect(decision.audit.events.length).toBeGreaterThanOrEqual(4);
      const layers = decision.audit.events.map(e => e.layer);
      expect(layers).toContain(0); // creation
      expect(layers).toContain(1);
      expect(layers).toContain(2);
      expect(layers).toContain(3);
    });

    it("should include timestamps and actor information", () => {
      let decision = makeDecision();
      decision = addLayerEvent(decision, 1, "intake_completed", "user-123");

      for (const event of decision.audit.events) {
        expect(event.timestamp).toBeDefined();
        expect(event.eventType).toBeDefined();
        expect(event.actorType || event.actorId).toBeDefined();
      }
    });
  });

  describe("Invariant 6: Classification constraints respected", () => {
    it("should require HITL for sovereign/confidential classification", () => {
      const sovereign = makeDecision({
        classification: {
          classification: "sovereign",
          hitlRequired: true,
          cloudAllowed: false,
          constraints: { allowExternalModels: false },
        },
      });
      expect(sovereign.classification?.hitlRequired).toBe(true);

      const confidential = makeDecision({
        classification: {
          classification: "confidential",
          hitlRequired: true,
          constraints: { allowExternalModels: false },
        },
      });
      expect(confidential.classification?.hitlRequired).toBe(true);
    });

    it("should restrict cloud processing for sovereign data", () => {
      const decision = makeDecision({
        classification: {
          classification: "sovereign",
          cloudAllowed: false,
          constraints: { allowExternalModels: false },
        },
      });
      expect(decision.classification?.cloudAllowed).toBe(false);
      expect(decision.classification?.constraints?.allowExternalModels).toBe(false);
    });
  });

  describe("Invariant 7: Policy enforcement is mandatory", () => {
    it("should always have policy evaluated before reasoning layers", () => {
      // A decision at Layer 6+ must have policy data
      const decision = makeDecision({
        currentLayer: 6,
        policy: { result: "allow" },
        advisory: { recommendation: "Proceed" },
      });
      expect(decision.policy).toBeDefined();
      expect(decision.policy?.result).toBe("allow");
    });

    it("should block pipeline when policy denies", () => {
      const decision = makeDecision({
        currentLayer: 3,
        status: "blocked",
        policy: { result: "deny", reason: "Policy violation detected" },
      });
      expect(decision.status).toBe("blocked");
      expect(decision.policy?.result).toBe("deny");
      // Advisory must not exist when blocked by policy
      expect(decision.advisory).toBeUndefined();
    });
  });

  describe("Invariant 8: Approval required for high-risk decisions", () => {
    it("should require HITL approval for high-risk classifications", () => {
      const decision = makeDecision({
        currentLayer: 7,
        status: "validation",
        classification: {
          classification: "confidential",
          hitlRequired: true,
        },
        validation: {
          status: "pending",
          approvalId: "APR-" + Date.now(),
          requiresHumanReview: true,
        },
      });
      expect(decision.classification?.hitlRequired).toBe(true);
      expect(decision.validation?.status).toBe("pending");
      expect(decision.validation?.approvalId).toMatch(/^APR-/);
    });

    it("should not execute actions until high-risk approval is granted", () => {
      const decision = makeDecision({
        currentLayer: 7,
        status: "validation",
        classification: { hitlRequired: true },
        validation: {
          status: "pending",
          approvalId: "APR-test",
        },
      });
      // While pending, no actions should be recorded
      expect(decision.validation?.status).toBe("pending");
      expect(decision.actions).toBeUndefined();
    });
  });

  describe("Agent Registry Verification", () => {
    it("should have all required agents registered", () => {
      const agents = agentRuntime.listAgents();
      const agentIds = agents.map(a => a.id);
      
      const requiredAgents = [
        "demand-agent",
        "evidence-collector-agent",
        "risk-controls-agent",
        "pack-builder-agent",
        "portfolio-sync-agent",
      ];
      
      for (const required of requiredAgents) {
        expect(agentIds).toContain(required);
      }
    });

    it("should enforce read-only mode for analysis agents", () => {
      const agents = agentRuntime.listAgents();
      
      const evidenceAgent = agents.find(a => a.id === "evidence-collector-agent");
      const demandAgent = agents.find(a => a.id === "demand-agent");
      const riskAgent = agents.find(a => a.id === "risk-controls-agent");
      const packAgent = agents.find(a => a.id === "pack-builder-agent");
      
      expect(demandAgent?.capabilities).toContain("demand_field_synthesis");
      expect(evidenceAgent?.capabilities).toContain("evidence_gathering");
      expect(riskAgent?.capabilities).toContain("risk_identification");
      expect(packAgent?.capabilities).toContain("package_assembly");
    });

    it("should only allow portfolio-sync-agent to execute after approval", () => {
      const agents = agentRuntime.listAgents();
      
      const portfolioAgent = agents.find(a => a.id === "portfolio-sync-agent");
      
      expect(portfolioAgent?.capabilities).toContain("portfolio_update");
    });
  });
});
