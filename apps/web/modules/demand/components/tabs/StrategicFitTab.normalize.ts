import type {
  AlignmentAreaLegacy,
  RawStrategicFitData,
  RouteType,
  StrategicRiskLegacy,
} from "./StrategicFitTab.types";

export function normalizeStrategicFitData(rawStrategicFitData: RawStrategicFitData | undefined) {
  if (!rawStrategicFitData) {
    return rawStrategicFitData;
  }

  if (rawStrategicFitData.primaryRecommendation?.route && rawStrategicFitData.decisionCriteria) {
    return rawStrategicFitData;
  }

  // ── Rich data with broken primaryRecommendation ──────────────────
  // The AI may produce decisionCriteria, implementationApproach, alternativeRecommendations
  // etc. correctly but leave primaryRecommendation.route as null. Reconstruct only the
  // primaryRecommendation while preserving all other rich fields.
  const hasRichDC = rawStrategicFitData.decisionCriteria && typeof rawStrategicFitData.decisionCriteria === 'object' &&
    Object.keys(rawStrategicFitData.decisionCriteria as Record<string, unknown>).length >= 3;
  const hasRichImpl = rawStrategicFitData.implementationApproach && typeof rawStrategicFitData.implementationApproach === 'object';
  const hasAlts = Array.isArray(rawStrategicFitData.alternativeRecommendations) &&
    (rawStrategicFitData.alternativeRecommendations as unknown[]).length > 0;

  if (hasRichDC && (hasRichImpl || hasAlts)) {
    const overallScore = typeof rawStrategicFitData.overallScore === 'number' ? rawStrategicFitData.overallScore : 70;
    const altRoutes = hasAlts
      ? (rawStrategicFitData.alternativeRecommendations as Array<{ route?: string }>).map(a => a.route)
      : [];
    type RT = 'VENDOR_MANAGEMENT' | 'PMO_OFFICE' | 'IT_DEVELOPMENT' | 'HYBRID';
    const allRoutes: RT[] = ['HYBRID', 'IT_DEVELOPMENT', 'PMO_OFFICE', 'VENDOR_MANAGEMENT'];
    let primaryRoute: RT;
    const missing = allRoutes.filter(r => !altRoutes.includes(r));
    if (missing.length === 1) { primaryRoute = missing[0]!; }
    else if (overallScore >= 80) { primaryRoute = altRoutes.includes('HYBRID') ? 'IT_DEVELOPMENT' : 'HYBRID'; }
    else if (overallScore >= 65) { primaryRoute = 'HYBRID'; }
    else if (overallScore >= 45) { primaryRoute = 'PMO_OFFICE'; }
    else { primaryRoute = 'VENDOR_MANAGEMENT'; }

    const conf = typeof rawStrategicFitData.confidenceScore === 'number' ? rawStrategicFitData.confidenceScore : Math.round(overallScore * 1.04);
    const pr = (rawStrategicFitData.primaryRecommendation || {}) as Record<string, unknown>;
    const dc = rawStrategicFitData.decisionCriteria as Record<string, { analysis?: string; score?: number }>;
    const keyStrengths: string[] = [];
    for (const [key, crit] of Object.entries(dc)) {
      if (typeof crit?.score === 'number' && crit.score >= 75) {
        const labels: Record<string, string> = {
          budgetThreshold: 'Budget alignment', technicalComplexity: 'Technical capability',
          organizationalCapability: 'Organizational readiness', riskProfile: 'Risk management',
          timelineCriticality: 'Timeline management', strategicImportance: 'Strategic importance',
        };
        keyStrengths.push(labels[key] || key);
      }
    }

    return {
      ...rawStrategicFitData,
      primaryRecommendation: {
        route: primaryRoute,
        confidenceScore: Math.min(conf as number, 100),
        confidence: Math.min(conf as number, 100),
        reasoning: (pr.reasoning as string) || `Strategic alignment score of ${overallScore}%`,
        keyFactors: (pr.keyFactors as string[]) || keyStrengths.slice(0, 4).map(s => `${s} verified`),
        keyStrengths: (pr.keyStrengths as string[]) || keyStrengths,
        expectedOutcome: (pr.expectedOutcome as string) || `Aligned delivery with ${overallScore}% strategic fit.`,
        estimatedTimeToStart: (pr.estimatedTimeToStart as string) || '4-6 weeks',
        criticalSuccessFactors: (pr.criticalSuccessFactors as string[]) || [],
        budgetEstimate: (pr.budgetEstimate as string) || dc.budgetThreshold?.analysis || 'See business case',
        budget: (pr.budget as string) || dc.budgetThreshold?.analysis || 'See business case',
        timeline: (pr.timeline as string) || '18-24 months',
        complexity: (dc.technicalComplexity?.score ?? 0) >= 80 ? 'High' : 'Medium',
        riskLevel: (dc.riskProfile?.analysis || '').toLowerCase().includes('high') ? 'Medium' : 'Low',
        tradeoffs: (pr.tradeoffs as Record<string, unknown>) || {
          pros: keyStrengths.slice(0, 3).map(s => `Strong ${s.toLowerCase()}`),
          cons: ['Implementation complexity', 'Risk profile requires monitoring'],
        },
      },
    };
  }

  const raw = rawStrategicFitData;
  const overallScore = typeof raw.overallScore === 'number' ? raw.overallScore : 70;
  const alignmentAreas = Array.isArray(raw.alignmentAreas) ? raw.alignmentAreas : [];
  const strategicRisks = Array.isArray(raw.strategicRisks) ? raw.strategicRisks : [];
  const govAlign = raw.governmentAlignment || {};
  const competitiveAdvantage = raw.competitiveAdvantage || '';
  const justification = raw.justification || '';
  const recommendation = raw.recommendation || '';

  let primaryRoute: RouteType;
  let altRoutes: RouteType[];
  if (overallScore >= 80) { primaryRoute = 'IT_DEVELOPMENT'; altRoutes = ['HYBRID', 'PMO_OFFICE']; }
  else if (overallScore >= 65) { primaryRoute = 'HYBRID'; altRoutes = ['IT_DEVELOPMENT', 'VENDOR_MANAGEMENT']; }
  else if (overallScore >= 45) { primaryRoute = 'PMO_OFFICE'; altRoutes = ['VENDOR_MANAGEMENT', 'HYBRID']; }
  else { primaryRoute = 'VENDOR_MANAGEMENT'; altRoutes = ['PMO_OFFICE', 'HYBRID']; }

  const keyStrengths = alignmentAreas
    .filter((area: AlignmentAreaLegacy) => (area.score ?? 0) >= 70)
    .map((area: AlignmentAreaLegacy) => area.area || 'Strategic area')
    .slice(0, 5);
  const keyFactors = alignmentAreas
    .map((area: AlignmentAreaLegacy) => `${area.area || 'Area'}: ${area.rationale || `Score ${area.score ?? 'N/A'}`}`)
    .slice(0, 5);
  const reasoning = [justification, competitiveAdvantage].filter(Boolean).join('. ') || `Overall strategic alignment score of ${overallScore}%.`;
  const highRiskCount = strategicRisks.filter((risk: StrategicRiskLegacy) => {
    const severity = (risk.severity || risk.impact || '').toString().toLowerCase();
    return severity === 'high' || severity === 'critical';
  }).length;
  const riskLevel = highRiskCount >= 2 ? 'High' : highRiskCount === 1 ? 'Medium' : 'Low';
  const complexity = overallScore >= 70 ? 'Medium' : 'High';

  const mapSeverity = (value: string) => {
    const lowerValue = (value || '').toLowerCase();
    if (lowerValue === 'high' || lowerValue === 'critical') return 'High';
    if (lowerValue === 'low' || lowerValue === 'minimal') return 'Low';
    return 'Medium';
  };
  const areaScore = (keyword: string) => {
    const match = alignmentAreas.find((area: AlignmentAreaLegacy) => (area.area || '').toLowerCase().includes(keyword));
    return match?.score ?? Math.round(overallScore * 0.9);
  };
  const areaRationale = (keyword: string, fallback: string) => {
    const match = alignmentAreas.find((area: AlignmentAreaLegacy) => (area.area || '').toLowerCase().includes(keyword));
    return match?.rationale || fallback;
  };

  return {
    ...raw,
    primaryRecommendation: {
      route: primaryRoute,
      confidenceScore: overallScore,
      confidence: overallScore,
      reasoning,
      keyFactors,
      keyStrengths,
      expectedOutcome: competitiveAdvantage || `Aligned delivery with ${overallScore}% strategic fit.`,
      estimatedTimeToStart: '4-6 weeks',
      criticalSuccessFactors: alignmentAreas
        .filter((area: AlignmentAreaLegacy) => (area.score ?? 0) < 70)
        .map((area: AlignmentAreaLegacy) => `Improve ${area.area || 'area'} alignment (${area.score ?? 0}%)`)
        .concat(strategicRisks.slice(0, 2).map((risk: StrategicRiskLegacy) => `Mitigate: ${risk.risk || 'risk'}`))
        .slice(0, 5),
      budgetEstimate: 'To be determined',
      budget: 'To be determined',
      timeline: '6-12 months',
      complexity,
      riskLevel,
      tradeoffs: {
        pros: [`Strong strategic alignment (${overallScore}%)`, ...keyStrengths.slice(0, 2).map((strength: string) => `Leverages ${strength}`), 'Government alignment verified'].slice(0, 4),
        cons: strategicRisks.slice(0, 3).map((risk: StrategicRiskLegacy) => risk.risk || 'Risk identified'),
      },
    },
    alternativeRecommendations: altRoutes.map((route, index) => ({
      route,
      confidenceScore: Math.max(20, overallScore - (index + 1) * 12),
      confidence: Math.max(20, overallScore - (index + 1) * 12),
      reasoning: 'Alternative approach based on strategic alignment analysis.',
      keyFactors: keyFactors.slice(0, 3),
      keyStrengths: keyStrengths.slice(0, 2),
      expectedOutcome: `Delivery via ${route.replace(/_/g, ' ').toLowerCase()} approach.`,
      estimatedTimeToStart: index === 0 ? '6-8 weeks' : '8-12 weeks',
      budgetEstimate: 'Subject to assessment',
      budget: 'Subject to assessment',
      timeline: index === 0 ? '8-14 months' : '10-16 months',
      complexity: index === 0 ? 'Medium' : 'High',
      riskLevel: index === 0 ? 'Medium' : 'High',
      tradeoffs: {
        pros: [`Structured ${route.replace(/_/g, ' ').toLowerCase()} governance`],
        cons: [`Lower fit confidence (${Math.max(20, overallScore - (index + 1) * 12)}%)`],
      },
    })),
    decisionCriteria: {
      budgetThreshold: { analysis: areaRationale('budget', areaRationale('cost', `Budget alignment at ${overallScore}%`)), score: areaScore('budget') || areaScore('cost'), weight: 0.2 },
      technicalComplexity: { analysis: areaRationale('technic', areaRationale('digital', 'Technical complexity assessment')), score: areaScore('technic') || areaScore('digital'), weight: 0.2 },
      organizationalCapability: { analysis: areaRationale('organi', areaRationale('capacity', `Organizational readiness at ${overallScore}%`)), score: areaScore('organi') || areaScore('capacity'), weight: 0.15 },
      riskProfile: { analysis: `${strategicRisks.length} strategic risks identified. ${highRiskCount} high severity.`, score: Math.max(30, 100 - highRiskCount * 20), weight: 0.2 },
      timelineCriticality: { analysis: areaRationale('time', areaRationale('schedule', 'Timeline criticality assessed')), score: areaScore('time') || areaScore('schedule') || Math.round(overallScore * 0.85), weight: 0.1 },
      strategicImportance: { analysis: justification || `Strategic importance: ${overallScore}%. ${recommendation ? `Recommendation: ${recommendation}` : ''}`, score: overallScore, weight: 0.15 },
    },
    implementationApproach: raw.implementationApproach || {
      phase1: { name: 'Discovery & Planning', duration: '4-6 weeks', keyActivities: ['Stakeholder alignment', 'Requirements validation', 'Resource planning', 'Risk mitigation'], owner: 'Project Sponsor', deliverables: ['Project charter', 'Project plan', 'Resource plan', 'Risk register'] },
      phase2: { name: 'Execution & Delivery', duration: '3-6 months', keyActivities: ['Solution design', 'Iterative delivery', 'Quality assurance', 'Progress reviews'], owner: 'Project Manager', deliverables: ['Solution components', 'Test results', 'Progress reports'] },
      phase3: { name: 'Transition & Optimization', duration: '4-8 weeks', keyActivities: ['User acceptance testing', 'Training & change management', 'Go-live execution', 'Post-implementation review'], owner: 'Delivery Lead', deliverables: ['UAT sign-off', 'Training materials', 'Go-live checklist', 'Lessons learned'] },
    },
    governanceRequirements: raw.governanceRequirements || {
      approvalAuthority: 'Executive Steering Committee',
      complianceFrameworks: [...(govAlign.compliance ? [govAlign.compliance] : []), 'UAE Federal IT Governance Framework', 'ISO 27001'].slice(0, 4),
      auditRequirements: ['Quarterly compliance audit', 'Annual strategic alignment review', 'Budget utilization reporting'],
      reportingCadence: 'Bi-weekly progress, monthly steering committee',
      approvalGates: [
        { checkpoint: 'Gate 1', name: 'Project Initiation Approval', approver: 'Executive Sponsor', owner: 'PMO', timing: 'Week 2' },
        { checkpoint: 'Gate 2', name: 'Design Sign-off', approver: 'Technical Authority', owner: 'Solution Architect', timing: 'Week 8' },
        { checkpoint: 'Gate 3', name: 'Go-Live Authorization', approver: 'Steering Committee', owner: 'Project Manager', timing: 'Pre Go-Live' },
        { checkpoint: 'Gate 4', name: 'Post-Implementation Review', approver: 'Executive Sponsor', owner: 'PMO', timing: 'Go-Live + 4 weeks' },
      ],
    },
    resourceRequirements: raw.resourceRequirements || {
      internalTeam: { roles: ['Project Manager', 'Business Analyst', 'Solution Architect', 'Change Manager', 'QA Lead'], effort: 'Full-time core team' },
      externalSupport: { expertise: ['Technical consultants', 'Domain experts', 'Integration specialists'], estimatedCost: 'To be determined' },
      infrastructure: ['Development environment', 'Testing infrastructure', 'Production hosting', 'Monitoring tools'],
    },
    riskMitigation: raw.riskMitigation || {
      primaryRisks: strategicRisks.length > 0
        ? strategicRisks.map((risk: StrategicRiskLegacy) => ({ risk: risk.risk || 'Risk', severity: mapSeverity(risk.impact || risk.severity || 'Medium'), mitigation: risk.mitigation || 'Develop mitigation plan' }))
        : [{ risk: 'Resource constraints', severity: 'Medium', mitigation: 'Early resource planning' }, { risk: 'Scope creep', severity: 'High', mitigation: 'Strict change control' }, { risk: 'Stakeholder gaps', severity: 'Medium', mitigation: 'Regular steering reviews' }],
    },
    complianceConsiderations: raw.complianceConsiderations || {
      procurementRegulations: govAlign.initiatives || 'Subject to UAE federal procurement regulations',
      dataGovernance: govAlign.compliance || 'Must comply with UAE data protection regulations',
      securityStandards: 'ISO 27001, UAE Information Assurance Standards',
    },
  };
}