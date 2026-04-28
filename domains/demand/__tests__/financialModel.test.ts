import { describe, expect, it } from "vitest";
import { buildInputsFromData, computeUnifiedFinancialModel, detectArchetype, estimateInvestmentFromDemandContext } from "../infrastructure/financialModel";
import { PROJECT_ARCHETYPES, getArchetypeConfig, type DomainAssumption } from "../../../packages/constants/archetypes";

describe("financial model input estimation", () => {
  it("uses an explicit single-value budget as the investment anchor", () => {
    const demandReport = {
      suggestedProjectName: "RTA Smart CRM 2024 - AI-Powered Citizen Services Platform",
      businessObjective: "Create an AI-powered citizen CRM with predictive analytics, omnichannel workflows, and real-time service routing.",
      budgetRange: "AED 15M",
      timeframe: "18-24 months",
      urgency: "high",
      integrationRequirements: ["Nol", "RTA mobile app", "licensing platform", "traffic fines"],
      complianceRequirements: ["UAE Data Protection Law", "TDRA", "NESA", "ISO 27001"],
      keyStakeholders: ["CDO", "Customer Service", "Transport Agency", "Licensing Agency"],
      riskFactors: ["legacy integration", "AI Arabic accuracy", "cybersecurity"],
    } as Record<string, unknown>;

    const estimate = estimateInvestmentFromDemandContext(demandReport, "Government Digital Transformation");

    expect(estimate).toBe(15_000_000);
  });

  it("keeps derived investment within the provided demand budget range", () => {
    const demandReport = {
      suggestedProjectName: "RTA Smart CRM 2024 - AI-Powered Citizen Services Platform",
      businessObjective: "Create an AI-powered citizen CRM with predictive analytics, omnichannel workflows, and real-time service routing.",
      budgetRange: "5m-15m",
      timeframe: "18-24 months",
      urgency: "high",
      integrationRequirements: ["Nol", "RTA mobile app", "licensing platform", "traffic fines"],
      complianceRequirements: ["UAE Data Protection Law", "TDRA", "NESA", "ISO 27001"],
      keyStakeholders: ["CDO", "Customer Service", "Transport Agency", "Licensing Agency"],
      riskFactors: ["legacy integration", "AI Arabic accuracy", "cybersecurity"],
    } as Record<string, unknown>;

    const estimate = estimateInvestmentFromDemandContext(demandReport, "Government Digital Transformation");

    expect(estimate).toBeGreaterThanOrEqual(5_000_000);
    expect(estimate).toBeLessThanOrEqual(15_000_000);
    expect(estimate).toBeGreaterThan(10_000_000);
  });

  it("builds financial inputs from demand context when no saved totals exist", () => {
    const demandReport = {
      suggestedProjectName: "RTA Smart CRM 2024 - AI-Powered Citizen Services Platform",
      businessObjective: "Transform citizen service delivery with AI CRM, predictive insights, and cross-channel integration.",
      budgetRange: "5m-15m",
      timeframe: "18-24 months",
      urgency: "medium",
      integrationRequirements: ["Metro", "Bus", "Taxi", "Licensing"],
      complianceRequirements: ["UAE Data Protection Law", "TDRA", "NESA"],
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({}, demandReport);

    expect(inputs.archetype).toBe("AI/ML Platform");
    expect(inputs.totalInvestment).toBeGreaterThanOrEqual(5_000_000);
    expect(inputs.totalInvestment).toBeLessThanOrEqual(15_000_000);
    expect(inputs.discountRate).toBe(11);
  });

  it("does not attach AI operating assumptions to plain digital transformation", () => {
    const demandReport = {
      suggestedProjectName: "Citizen Service Workflow Modernization",
      businessObjective: "Modernize digital government case handling, service request intake, workflow digitization, and operating dashboards across departments.",
      budgetRange: "AED 8M",
      timeframe: "12-18 months",
      urgency: "medium",
      integrationRequirements: ["identity", "case management", "document records"],
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({}, demandReport);
    const result = computeUnifiedFinancialModel(inputs);

    expect(inputs.archetype).toBe("Government Digital Transformation");
    expect(Object.keys(inputs.domainParameters).some((key) => key.includes("GPU") || key.includes("LLM") || key.includes("MLOps") || key.startsWith("AI "))).toBe(false);
    expect(result.costs.some((cost) => cost.subcategory.startsWith("AI") || cost.name.includes("LLM") || cost.name.includes("GPU"))).toBe(false);
  });

  it("keeps explicit AI initiatives on the AI/ML financial archetype", () => {
    const demandReport = {
      suggestedProjectName: "Government AI Decision Support Platform",
      businessObjective: "Build an AI-powered predictive analytics and MLOps platform using model training, inference monitoring, and governed AI automation.",
      budgetRange: "AED 12M",
      timeframe: "18 months",
      urgency: "high",
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({}, demandReport);
    const result = computeUnifiedFinancialModel(inputs);

    expect(inputs.archetype).toBe("AI/ML Platform");
    expect(inputs.domainParameters["GPU / ML Compute Annual"]).toBeGreaterThan(0);
    expect(result.costs.some((cost) => cost.name === "GPU / ML Compute")).toBe(true);
    expect(result.costs.some((cost) => cost.name === "LLM Inference & API Usage")).toBe(true);
  });

  it("prefers the explicit demand budget over a saved AI recommendation", () => {
    const demandReport = {
      suggestedProjectName: "Citizen Service Modernization",
      businessObjective: "Improve citizen service turnaround and digital case handling.",
      budgetRange: "AED 15M",
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({ aiRecommendedBudget: 54_750_000 }, demandReport);

    expect(inputs.totalInvestment).toBe(15_000_000);
  });

  it("keeps performance management platforms on the digital service platform archetype", () => {
    const inputs = buildInputsFromData({}, {
      suggestedProjectName: "Corevia Command Performance Nexus",
      businessObjective: "Implement a performance management system for executive dashboards, KPIs, scorecards, and strategy execution tracking.",
      budgetRange: "250,000 - 500,000 AED",
    } as Record<string, unknown>);

    expect(inputs.archetype).toBe("Digital Service Platform");
    expect(inputs.totalInvestment).toBe(375_000);
  });

  it("routes disaster recovery demands to a resilience financial archetype", () => {
    const demandReport = {
      suggestedProjectName: "Corevia Resilience Shield Initiative",
      businessObjective: "Implement disaster recovery and business continuity for critical digital assets with failover, data replication, backup restore, and tested RTO/RPO controls.",
      problemStatement: "Current mission critical services lack a governed DR site and auditable continuity runbooks for outage, cyber incident, and recovery scenarios.",
      budgetRange: "AED 12M",
      timeframe: "12-18 months",
      urgency: "critical",
      integrationRequirements: ["identity", "core applications", "monitoring", "backup platform"],
      complianceRequirements: ["ISO 22301", "NESA", "UAE information assurance"],
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({}, demandReport);
    const result = computeUnifiedFinancialModel(inputs);

    expect(inputs.archetype).toBe("Disaster Recovery & Business Continuity Platform");
    expect(inputs.domainParameters["Critical Services Protected"]).toBeGreaterThan(0);
    expect(result.costs.map((cost) => cost.name)).toContain("Secondary Recovery Environment");
    expect(result.costs.map((cost) => cost.name)).toContain("DR Exercise, Audit & Evidence");
    expect(result.benefits.map((benefit) => benefit.name)).toEqual([
      "Avoided Outage Loss",
      "Recovery Time Productivity Protection",
      "Data Loss and Rework Avoidance",
      "Cyber and Continuity Assurance Value",
    ]);
    expect(result.costs.some((cost) => cost.name === "Core Software & Development")).toBe(false);
    expect(result.benefits.some((benefit) => benefit.name === "Operational Productivity Gains")).toBe(false);
  });

  it("treats open-ended budgets as minimum thresholds rather than exact caps", () => {
    const demandReport = {
      suggestedProjectName: "Dubai Taxi Company Autonomous Vehicle Platform Program",
      businessObjective: "Establish an autonomous vehicle platform with commercial fleet rollout, RTA integration, dispatch modernization, and smart mobility operations.",
      budgetRange: "over-15m",
      timeframe: "18-24 months",
      urgency: "high",
      integrationRequirements: ["RTA transport management", "IoT infrastructure", "dispatch", "payments", "customer app"],
      existingSystems: ["fleet management", "dispatch", "maintenance", "billing", "driver scheduling"],
      riskFactors: ["regulatory approval", "capital investment", "cybersecurity", "public trust"],
    } as Record<string, unknown>;

    const estimate = estimateInvestmentFromDemandContext(demandReport, "Autonomous Vehicle Platform");
    const inputs = buildInputsFromData({}, demandReport);

    expect(estimate).toBeGreaterThan(15_000_000);
    expect(inputs.totalInvestment).toBeGreaterThan(15_000_000);
  });

  it("does not let draft artifact totals override context-based sizing during generation", () => {
    const demandReport = {
      suggestedProjectName: "Dubai Taxi Company Autonomous Vehicle Platform Program",
      businessObjective: "Establish an autonomous vehicle platform with commercial fleet rollout, RTA integration, dispatch modernization, and smart mobility operations.",
      budgetRange: "over-15m",
      timeframe: "18-24 months",
      urgency: "high",
      integrationRequirements: ["RTA transport management", "IoT infrastructure", "dispatch", "payments", "customer app"],
      existingSystems: ["fleet management", "dispatch", "maintenance", "billing", "driver scheduling"],
      riskFactors: ["regulatory approval", "capital investment", "cybersecurity", "public trust"],
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({
      totalCostEstimate: 15_000_000,
    }, demandReport);

    expect(inputs.totalInvestment).toBeGreaterThan(15_000_000);
  });

  it("still honors persisted business-case totals when recalculating saved models", () => {
    const demandReport = {
      suggestedProjectName: "Dubai Taxi Company Autonomous Vehicle Platform Program",
      businessObjective: "Establish an autonomous vehicle platform with commercial fleet rollout, RTA integration, dispatch modernization, and smart mobility operations.",
      budgetRange: "over-15m",
    } as Record<string, unknown>;

    const inputs = buildInputsFromData({
      id: "bc-1",
      generatedAt: new Date().toISOString(),
      totalCostEstimate: 54_750_000,
    }, demandReport);

    expect(inputs.totalInvestment).toBe(54_750_000);
  });

  it("scales investment for large multi-site programs when no explicit budget exists", () => {
    const lowScale = estimateInvestmentFromDemandContext({
      suggestedProjectName: "Internal approvals digitization",
      businessObjective: "Digitize internal approval workflows for 200 employees at headquarters.",
      timeframe: "6 months",
      integrationRequirements: ["HR platform"],
      expectedOutcomes: ["faster approvals"],
    } as Record<string, unknown>, "Government Digital Transformation");

    const highScale = estimateInvestmentFromDemandContext({
      suggestedProjectName: "Citizen service transformation",
      businessObjective: "Modernize services for 250,000 citizens across 18 service centers with 12 interfaces and 4 rollout phases.",
      timeframe: "24 months",
      urgency: "high",
      integrationRequirements: ["CRM", "Payments", "Identity", "Mobile app", "IVR", "Case management"],
      existingSystems: ["Licensing", "ERP", "Document management", "Data warehouse"],
      implementationPhases: [{ name: "Mobilize" }, { name: "Build" }, { name: "Pilot" }, { name: "Scale" }],
      resourceRequirements: {
        internalTeam: { roles: ["Sponsor", "PM", "BA", "Architect", "Security", "Data Lead", "Change Lead"] },
        externalSupport: { expertise: ["Integration", "Migration", "Testing"] },
        infrastructure: ["Cloud", "API gateway", "Observability"],
      },
    } as Record<string, unknown>, "Government Digital Transformation");

    expect(highScale).toBeGreaterThan(lowScale);
    expect(highScale).toBeGreaterThan(10_000_000);
  });

  it("uses saved domain parameters to size upfront investment when budget is not provided", () => {
    const inputs = buildInputsFromData({
      domainParameters: {
        "Fleet Size": 200,
        "Vehicle Cost": 600000,
      },
    }, {
      suggestedProjectName: "Autonomous transport pilot",
      businessObjective: "Deploy an autonomous vehicle platform for urban mobility operations.",
      timeframe: "18 months",
    } as Record<string, unknown>);

    expect(inputs.archetype).toBe("Autonomous Vehicle Platform");
    expect(inputs.totalInvestment).toBeGreaterThan(45_000_000);
  });

  it("hydrates shared operating drivers from savedDomainParameters when rebuilding inputs", () => {
    const inputs = buildInputsFromData({
      savedDomainParameters: {
        "Fleet Size": 80,
        "Drone Unit Cost": 120000,
        "Pilot Fleet Size": 12,
        "Platform Fee per Delivery": 4.2,
      },
      savedFinancialAssumptions: {
        adoptionRate: 0.62,
        discountRate: 0.09,
      },
    }, {
      suggestedProjectName: "Dubai Drone Delivery Pilot",
      businessObjective: "Launch a governed drone last-mile delivery service with staged pilot and commercial economics.",
      timeframe: "12 months",
    } as Record<string, unknown>);

    expect(inputs.archetype).toBe("Drone Last Mile Delivery");
    expect(inputs.domainParameters["Fleet Size"]).toBe(80);
    expect(inputs.domainParameters["Drone Unit Cost"]).toBe(120000);
    expect(inputs.domainParameters["Pilot Fleet Size"]).toBe(12);
    expect(inputs.domainParameters["Platform Fee per Delivery"]).toBe(4.2);
    expect(inputs.adoptionRate).toBe(0.62);
    expect(inputs.discountRate).toBe(9);
  });

  it("caps implausible persisted AV fleet assumptions before they distort the model", () => {
    const inputs = buildInputsFromData({
      domainParameters: {
        "Fleet Size": 10_000,
        "Vehicle Cost": 2_000_000,
        "Taxi Fare Rate": 50,
        "Average Trip Distance": 200,
        "Daily Trips per Vehicle": 100,
        "Fleet Utilization Rate": 1,
        "Operating Cost per km": 10,
        "Driver Cost Savings": 500_000,
      },
    }, {
      suggestedProjectName: "Dubai Taxi Autonomous Mobility Vanguard",
      businessObjective: "Launch a regulated autonomous taxi fleet with phased commercial rollout and dispatch modernization.",
      timeframe: "24 months",
    } as Record<string, unknown>);

    expect(inputs.archetype).toBe("Autonomous Vehicle Platform");
    expect(inputs.domainParameters["Fleet Size"]).toBe(500);
    expect(inputs.domainParameters["Vehicle Cost"]).toBe(750_000);
    expect(inputs.domainParameters["Taxi Fare Rate"]).toBe(10);
    expect(inputs.domainParameters["Daily Trips per Vehicle"]).toBe(40);
  });

  it("does not misclassify autonomous mobility programs as AI/ML because of incidental AI wording", () => {
    const demandReport = {
      suggestedProjectName: "Dubai Taxi Autonomous Mobility Vanguard",
      businessObjective: "Dubai Taxi seeks to establish autonomous vehicle (AV) technology as a transformative new business vertical aligned with the UAE National Strategy for Artificial Intelligence. The initiative uses automation to reduce operating costs while launching regulated autonomous mobility services.",
      problemStatement: "Current taxi operations depend on conventional fleet economics and do not provide a pathway to commercial autonomous taxi deployment.",
      organizationName: "Dubai Taxi Company",
      budgetRange: "over-15m",
    } as Record<string, unknown>;

    expect(detectArchetype({
      projectName: demandReport.suggestedProjectName as string,
      projectDescription: demandReport.businessObjective as string,
      organization: demandReport.organizationName as string,
      objectives: demandReport.businessObjective as string,
      problemStatement: demandReport.problemStatement as string,
    })).toBe("Autonomous Vehicle Platform");

    const inputs = buildInputsFromData({}, demandReport);

    expect(inputs.archetype).toBe("Autonomous Vehicle Platform");
  });

  it("uses autonomous vehicle fleet economics to drive benefits", () => {
    const baseCase = computeUnifiedFinancialModel({
      totalInvestment: 101_750_000,
      archetype: "Autonomous Vehicle Platform",
      discountRate: 10,
      adoptionRate: 0.68,
      maintenancePercent: 0.22,
      contingencyPercent: 0.28,
      domainParameters: {
        "Fleet Size": 120,
        "Vehicle Cost": 380000,
        "Taxi Fare Rate": 2.7,
        "Average Trip Distance": 13,
        "Daily Trips per Vehicle": 22,
        "Fleet Utilization Rate": 0.78,
        "Operating Cost per km": 0.95,
        "Driver Cost Savings": 132000,
      },
    });
    expect(baseCase.benefits.map((benefit) => benefit.name)).toEqual([
      "Net Mobility Contribution",
      "Net Labor Productivity Savings",
      "Safety, Data, and Mobility Leadership",
    ]);

    const upsideCase = computeUnifiedFinancialModel({
      totalInvestment: 101_750_000,
      archetype: "Autonomous Vehicle Platform",
      discountRate: 10,
      adoptionRate: 0.75,
      maintenancePercent: 0.22,
      contingencyPercent: 0.28,
      domainParameters: {
        "Fleet Size": 140,
        "Vehicle Cost": 380000,
        "Taxi Fare Rate": 3,
        "Average Trip Distance": 14,
        "Daily Trips per Vehicle": 26,
        "Fleet Utilization Rate": 0.82,
        "Operating Cost per km": 0.95,
        "Driver Cost Savings": 132000,
      },
    });

    expect(baseCase.metrics.totalBenefits).toBeGreaterThan(0);
    expect(upsideCase.metrics.totalBenefits).toBeGreaterThan(baseCase.metrics.totalBenefits);
    expect(upsideCase.metrics.roi).toBeGreaterThan(baseCase.metrics.roi);
  });

  it("does not double count AV trip economics as both revenue and margin", () => {
    const result = computeUnifiedFinancialModel({
      totalInvestment: 101_750_000,
      archetype: "Autonomous Vehicle Platform",
      discountRate: 10,
      adoptionRate: 0.68,
      maintenancePercent: 0.22,
      contingencyPercent: 0.28,
      domainParameters: {
        "Fleet Size": 120,
        "Vehicle Cost": 380000,
        "Taxi Fare Rate": 2.7,
        "Average Trip Distance": 13,
        "Daily Trips per Vehicle": 22,
        "Fleet Utilization Rate": 0.78,
        "Operating Cost per km": 0.95,
        "Driver Cost Savings": 132000,
      },
    });

    expect(result.benefits.some((benefit) => benefit.name === "Ride Fare Revenue")).toBe(false);
    expect(result.benefits.some((benefit) => benefit.name === "Fleet Contribution Margin")).toBe(false);
    expect(result.benefits.some((benefit) => benefit.name === "Driver Cost Elimination")).toBe(false);
  });

  it("emits operational intelligence analytics for autonomous vehicle cases", () => {
    const result = computeUnifiedFinancialModel({
      totalInvestment: 113_500_000,
      archetype: "Autonomous Vehicle Platform",
      discountRate: 9,
      adoptionRate: 0.87,
      maintenancePercent: 0.16,
      contingencyPercent: 0.14,
      domainParameters: {
        "Fleet Size": 500,
        "Vehicle Cost": 380000,
        "Taxi Fare Rate": 2.7,
        "Average Trip Distance": 13,
        "Daily Trips per Vehicle": 22,
        "Fleet Utilization Rate": 0.78,
        "Operating Cost per km": 0.95,
        "Driver Cost Savings": 132000,
      },
    });

    expect(result.driverModel?.revenueDrivers.segments).toHaveLength(3);
    expect(result.driverModel?.revenueDrivers.segments.map((segment) => segment.name)).toEqual([
      "Premium Routes",
      "Airport and Hotel",
      "Corporate Contracts",
    ]);
    expect(result.killSwitchMetrics?.thresholds.length).toBeGreaterThanOrEqual(5);
    expect(result.killSwitchMetrics?.pilotGateStatus).toBe("PASS");
    expect(result.riskAdjustedAnalysis?.riskAdjustedNpv).toBeLessThan(result.riskAdjustedAnalysis?.baseNpv ?? Number.POSITIVE_INFINITY);
    expect(result.riskAdjustedAnalysis?.stressNpv).toBeLessThan(result.riskAdjustedAnalysis?.riskAdjustedNpv ?? Number.POSITIVE_INFINITY);
  });

  it("uses consistent non-overlapping taxonomy for non-AV archetypes", () => {
    const droneLastMile = computeUnifiedFinancialModel({
      totalInvestment: 18_000_000,
      archetype: "Drone Last Mile Delivery",
      discountRate: 9,
      adoptionRate: 0.7,
      maintenancePercent: 0.12,
      contingencyPercent: 0.1,
      domainParameters: {
        "Fleet Size": 60,
        "Daily Deliveries per Drone": 28,
        "Delivery Fare Rate": 42,
        "Cost per Delivery (Traditional)": 31,
        "Cost per Drone Delivery": 13,
        "Carbon Emission Reduction": 72,
      },
    });

    expect(droneLastMile.benefits.map((benefit) => benefit.name)).toEqual([
      "Tiered Delivery Contribution",
      "Platform & API Fee Revenue",
      "Logistics Cost Avoidance (Shared)",
      "Carbon and Service Resilience Value",
    ]);
    expect(droneLastMile.benefits.some((benefit) => benefit.name === "Delivery Fee Revenue")).toBe(false);
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.fleetSize).toBeGreaterThanOrEqual(10);
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.fleetSize).toBeLessThanOrEqual(20);
    expect(droneLastMile.driverModel?.stagedEconomics?.scaleCase.dailyDeliveriesPerDrone).toBeGreaterThanOrEqual(110);
    expect(droneLastMile.driverModel?.stagedEconomics?.scaleCase.dailyDeliveriesPerDrone).toBeLessThanOrEqual(140);
    expect(droneLastMile.driverModel?.stagedEconomics?.scaleCase.effectiveCostPerDelivery).toBeLessThanOrEqual(35);
    expect(droneLastMile.driverModel?.costDrivers.effectiveCostPerDelivery[4]).toBeLessThan(
      droneLastMile.driverModel?.costDrivers.effectiveCostPerDelivery[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.partneringStrategy).toContain("Wing / Zipline-style");
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.automationRate).toBeGreaterThan(0.1);
    expect(droneLastMile.driverModel?.stagedEconomics?.scaleCase.idleTimeReduction).toBeGreaterThan(0.1);
    expect(droneLastMile.driverModel?.stagedEconomics?.expansionDecision).toBe("STOP");
    expect(droneLastMile.operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay).toBeLessThan(
      droneLastMile.operationalConstraints?.theoreticalDeliveriesPerDronePerDay ?? Number.POSITIVE_INFINITY,
    );
    expect(droneLastMile.unitEconomics?.minimumViableCheck).not.toBe("FAIL");
    expect(droneLastMile.scenarioIntelligence?.sensitivityRanking[0]?.driver).toBeTruthy();
    expect(droneLastMile.commercialAudit?.verdict).toBeDefined();
    expect(droneLastMile.benchmarkValidation?.checks.length).toBeGreaterThan(0);
    expect(droneLastMile.capitalEfficiency?.classification).toBeDefined();
    expect(droneLastMile.modelConfidence?.score).toBeGreaterThan(0);
    expect(droneLastMile.decision.approvalScope).toBe("PILOT_ONLY");
    expect(droneLastMile.decision.automaticHalt).toBe(true);
    expect(droneLastMile.financialViews?.defaultView).toBe("pilot");
    expect(droneLastMile.financialViews?.pilot?.title).toBe("Pilot Financial Model");
    expect(droneLastMile.financialViews?.full?.title).toBe("Full Commercial Model");
    expect(droneLastMile.financialViews?.pilot?.metrics.paybackMonths).toBeGreaterThanOrEqual(0);
    expect(droneLastMile.financialViews?.full?.costs.find((cost) => cost.name === "Variable Operating Cost")?.breakdown?.length).toBeGreaterThan(0);
    expect(droneLastMile.driverModel?.revenueDrivers.segments.map((segment) => segment.name)).toEqual([
      "Premium Express",
      "Pharma / Critical Delivery",
      "B2B Contracted Volume",
    ]);
    expect(droneLastMile.killSwitchMetrics?.thresholds.some((threshold) => threshold.metric === "Scale Cost per Delivery")).toBe(true);
    expect(droneLastMile.riskAdjustedAnalysis?.riskAdjustedNpv).toBeLessThan(droneLastMile.riskAdjustedAnalysis?.baseNpv ?? Number.POSITIVE_INFINITY);
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.preRealizationRevenuePerDelivery).toBeGreaterThan(
      droneLastMile.driverModel?.stagedEconomics?.pilotCase.recognizedRevenuePerDelivery ?? 0,
    );
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.realizedRevenuePerDelivery).toBe(
      droneLastMile.driverModel?.stagedEconomics?.pilotCase.recognizedRevenuePerDelivery,
    );
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.annualRecognizedRevenue).toBe(
      droneLastMile.driverModel?.stagedEconomics?.pilotCase.annualRevenue,
    );
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.recognizedAnnualDeliveries).toBe(
      droneLastMile.driverModel?.stagedEconomics?.pilotCase.annualDeliveries,
    );
    expect(droneLastMile.driverModel?.stagedEconomics?.pilotCase.recognizedRevenuePerDelivery).toBeCloseTo(
      (droneLastMile.driverModel?.stagedEconomics?.pilotCase.annualRecognizedRevenue ?? 0)
        / Math.max(1, droneLastMile.driverModel?.stagedEconomics?.pilotCase.recognizedAnnualDeliveries ?? 1),
      6,
    );

    const healthcare = computeUnifiedFinancialModel({
      totalInvestment: 24_000_000,
      archetype: "Healthcare Digital Transformation",
      discountRate: 8,
      adoptionRate: 0.78,
      maintenancePercent: 0.14,
      contingencyPercent: 0.12,
      domainParameters: {},
    });

    expect(healthcare.benefits.map((benefit) => benefit.name)).toEqual([
      "Clinical Productivity Gains",
      "Patient Outcome and Capacity Value",
      "Compliance and Patient Safety Risk Reduction",
    ]);
  });

  it("stops drone expansion when hard scale gates fail even if the pilot remains viable", () => {
    const droneLastMile = computeUnifiedFinancialModel({
      totalInvestment: 18_000_000,
      archetype: "Drone Last Mile Delivery",
      discountRate: 9,
      adoptionRate: 0.7,
      maintenancePercent: 0.12,
      contingencyPercent: 0.1,
      domainParameters: {
        "Fleet Size": 120,
        "Enterprise Contract Share": 0.55,
      },
    });

    expect(droneLastMile.driverModel?.stagedEconomics?.expansionDecision).toBe("STOP");
    expect(droneLastMile.driverModel?.stagedEconomics?.scaleGateOpen).toBe(false);
    expect(droneLastMile.driverModel?.stagedEconomics?.enforcementSummary).toContain("STOP expansion");
    expect(droneLastMile.killSwitchMetrics?.pilotGateStatus).toBe("CONDITIONAL");
    expect(droneLastMile.killSwitchMetrics?.summary).toContain("STOP expansion");
    expect(droneLastMile.decision.label).toContain("Approve Pilot Only");
    expect(droneLastMile.decision.conditions?.length).toBeGreaterThan(0);
    expect(droneLastMile.decision.triggers?.length).toBeGreaterThan(0);
  });

  it("infers government-scale domain parameters from demand context when none are saved", () => {
    const inputs = buildInputsFromData({}, {
      suggestedProjectName: "Citizen digital services modernization",
      businessObjective: "Serve 320,000 citizens across 14 service centers and 9 integrated systems.",
      timeframe: "18 months",
      implementationPhases: [{ name: "Design" }, { name: "Build" }, { name: "Pilot" }, { name: "Scale" }],
    } as Record<string, unknown>);

    expect(inputs.archetype).toBe("Government Digital Transformation");
    expect(inputs.domainParameters["Citizen Users"]).toBe(320000);
    expect(inputs.domainParameters["Transaction Volume"]).toBeGreaterThan(320000);
    expect(inputs.totalInvestment).toBeGreaterThan(10_000_000);
  });

  it("keeps every archetype on the complete business-case section contract", () => {
    const representativeInvestment: Record<string, number> = {
      "Autonomous Vehicle Platform": 113_500_000,
      "Drone Last Mile Delivery": 18_000_000,
      "Drone First Mile Delivery": 24_000_000,
      "Healthcare Digital Transformation": 27_000_000,
      "Healthcare Digital System": 18_000_000,
      "Government-Wide System": 25_000_000,
      "Smart Government Infrastructure": 18_000_000,
      "Disaster Recovery & Business Continuity Platform": 16_000_000,
      "ERP Implementation": 15_000_000,
      "Insurance Digital Platform": 14_000_000,
      "Education Digital Platform": 11_000_000,
    };

    for (const archetypeName of Object.keys(PROJECT_ARCHETYPES)) {
      const config = getArchetypeConfig(archetypeName);
      const domainParameters = (config.assumptions.domainAssumptions ?? []).reduce<Record<string, number>>((acc: Record<string, number>, assumption: DomainAssumption) => {
        if (typeof assumption.value === "number") {
          acc[assumption.name] = assumption.value;
        }
        return acc;
      }, {});

      const result = computeUnifiedFinancialModel({
        totalInvestment: representativeInvestment[archetypeName] ?? 12_000_000,
        archetype: archetypeName,
        discountRate: config.assumptions.discountRate * 100,
        adoptionRate: config.assumptions.adoptionRate,
        maintenancePercent: config.assumptions.maintenancePercent,
        contingencyPercent: config.assumptions.contingencyPercent,
        domainParameters,
      });

      expect(Number.isFinite(result.metrics.npv), `${archetypeName} should have finite NPV`).toBe(true);
      expect(Number.isFinite(result.metrics.roi), `${archetypeName} should have finite ROI`).toBe(true);
      expect(result.costs.length, `${archetypeName} should have cost lines`).toBeGreaterThan(0);
      expect(result.benefits.length, `${archetypeName} should have benefit lines`).toBeGreaterThan(0);
      expect(result.scenarios.map((scenario) => scenario.name), `${archetypeName} should expose all scenarios`).toEqual([
        "pessimistic",
        "base",
        "optimistic",
      ]);
      expect(result.scenarios.reduce((sum, scenario) => sum + scenario.probability, 0), `${archetypeName} scenario probabilities should sum to 1`).toBeCloseTo(1, 6);
      expect(result.scenarios[0]!.npv, `${archetypeName} pessimistic case should not exceed base case`).toBeLessThanOrEqual(result.scenarios[1]!.npv);
      expect(result.scenarios[1]!.npv, `${archetypeName} base case should not exceed optimistic case`).toBeLessThanOrEqual(result.scenarios[2]!.npv);
      expect(result.fiveYearProjections.yearly.length, `${archetypeName} should have 5-year projections`).toBe(6);
      expect(result.governmentValue.score, `${archetypeName} should include government value`).toBeGreaterThan(0);
      expect(result.breakEvenAnalysis.summary.length, `${archetypeName} should include break-even analysis`).toBeGreaterThan(0);
      expect(result.terminalValue.methodology.length, `${archetypeName} should include terminal value`).toBeGreaterThan(0);
      expect(result.investmentCommitteeSummary.readinessGrade.length, `${archetypeName} should include IC summary`).toBeGreaterThan(0);
      expect(result.driverModel?.revenueDrivers.segments.length, `${archetypeName} should include revenue segmentation`).toBeGreaterThan(0);
      expect(result.killSwitchMetrics?.thresholds.length, `${archetypeName} should include kill-switch metrics`).toBeGreaterThan(0);
      expect(result.riskAdjustedAnalysis?.riskAdjustedNpv, `${archetypeName} should include risk-adjusted NPV`).toBeDefined();
    }
  });
});
