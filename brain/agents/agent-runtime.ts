import { ragGateway } from "../intelligence/rag-gateway";
import type { ClassificationLevel } from "@shared/schemas/corevia/decision-object";
import { evidenceCollectorAgent } from "./evidence-collector-agent";
import { riskControlsAgent } from "./risk-controls-agent";
import { packBuilderAgent } from "./pack-builder-agent";
import { portfolioSyncAgent } from "./portfolio-sync-agent";
import { demandAgent } from "./demand-agent";
import { logger } from "../../platform/observability";

export interface AgentContext {
  decisionId: string;
  correlationId: string;
  classificationLevel: ClassificationLevel;
  tenantId: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

export interface AgentInput {
  task: string;
  context: AgentContext;
  parameters?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface AgentOutput {
  success: boolean;
  result: unknown;
  reasoning?: string;
  confidence: number;
  tokensUsed?: number;
  executionTimeMs: number;
  errors?: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  requiredClassification: ClassificationLevel;
  execute: (input: AgentInput) => Promise<AgentOutput>;
}

export interface AgentConfig {
  enabled: boolean;
  category: string;
  version: string;
  lastExecutedAt?: string;
  executionCount: number;
  avgExecutionTimeMs: number;
  successRate: number;
  isBuiltIn: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Cost-aware WBS generation — consumed by the wbs_builder agent below.
//
// The brain pipeline forwards three digests from the approved planning
// artifacts (see domains/portfolio/application/wbs.useCases.ts):
//   • bcCostStructure   — implementation + recurring cost anchors from BC
//   • requirementsDigest — functional/NFR/integration/capability gaps
//   • architectureDigest — TOGAF-style BA/AA/DA/TA summary
// We fold all three into phase + work-package structure so the generated WBS
// reconciles to the approved financial envelope (total plannedCost ≈ BC TCO
// implementation) and covers the approved scope (deliverables trace to
// requirements + EA components).
// ────────────────────────────────────────────────────────────────────────────

interface BcCostAnchorParam {
  ref: string;
  name: string;
  category: string;
  subcategory?: string;
  total: number;
  isRecurring: boolean;
  yearProfile?: Array<{ year: number; amount: number }>;
  description?: string;
}
interface BcCostStructureParam {
  totalApproved?: number;
  tcoBreakdown?: { implementation: number; operations: number; maintenance: number };
  financialAssumptions?: { contingencyPercent?: number; maintenancePercent?: number; discountRate?: number };
  implementationAnchors: BcCostAnchorParam[];
  recurringAnchors: BcCostAnchorParam[];
  horizonYears?: number;
}
interface RequirementsDigestParam {
  functional?: string[];
  nonFunctional?: string[];
  security?: string[];
  integrations?: string[];
  dataRequirements?: string[];
  operationalRequirements?: string[];
  capabilityGaps?: string[];
  requiredTechnology?: string[];
  constraints?: string[];
  assumptions?: string[];
  dependencies?: string[];
  outOfScope?: string[];
  phasePlan?: Array<{ name?: string; summary?: string; durationWeeks?: number }>;
}
interface ArchitectureDigestParam {
  framework?: string;
  businessCapabilities?: string[];
  applications?: string[];
  dataEntities?: string[];
  technologyComponents?: string[];
  integrationPatterns?: string[];
  keyRisks?: string[];
}

interface CostAwareWorkPackage {
  name: string;
  description: string;
  costAnchor?: string;
  plannedCost?: number;
  deliverables: string[];
  tasks: string[];
  assignedRole?: string;
  dependencies?: string[];
}
interface CostAwarePhase {
  name: string;
  description: string;
  durationMonths: number;
  deliverables: string[];
  tasks: string[];
  workPackages: CostAwareWorkPackage[];
  plannedCost: number;
  owner: string;
  status: string;
}
interface CostAwareWbsResult {
  implementationPhases: CostAwarePhase[];
  milestones: Array<{ name: string; phase: string; targetMonth?: number }>;
  totalPlannedCost: number;
  costReconciliation: { bcImplementation: number; wbsPlanned: number; variance: number };
  sustainment?: {
    name: string;
    description: string;
    horizonYears: number;
    annualProfile: Array<{ year: number; plannedCost: number }>;
    totalPlannedCost: number;
    anchors: Array<{ ref: string; name: string; total: number }>;
  };
}

// Classify a BC anchor into one of the canonical delivery phases so the WBS
// stays readable (one phase per classical delivery stage) while still
// carrying every anchor as a distinct, cost-bearing work package.
function classifyAnchorPhase(a: BcCostAnchorParam): {
  phaseKey: 'mobilize' | 'design' | 'build' | 'integrate' | 'infrastructure' | 'test' | 'deploy' | 'change' | 'reserve';
  confidence: number;
} {
  const hay = `${a.name} ${a.subcategory ?? ''} ${a.description ?? ''}`.toLowerCase();
  const has = (...kws: string[]) => kws.some((k) => hay.includes(k));
  if (has('contingen', 'reserve', 'management reserve')) return { phaseKey: 'reserve', confidence: 0.95 };
  if (has('pmo', 'project management', 'governance', 'programme management', 'program management')) return { phaseKey: 'mobilize', confidence: 0.9 };
  if (has('change management', 'training', 'adoption', 'communication', 'ocm')) return { phaseKey: 'change', confidence: 0.9 };
  if (has('infrastructure', 'hosting', 'cloud', 'hardware', 'environment', 'platform')) return { phaseKey: 'infrastructure', confidence: 0.85 };
  if (has('integration', 'interface', 'api', 'data migration', 'etl')) return { phaseKey: 'integrate', confidence: 0.88 };
  if (has('core software', 'development', 'configuration', 'customization', 'build', 'licence', 'license')) return { phaseKey: 'build', confidence: 0.85 };
  if (has('test', 'uat', 'sit', 'quality', 'qa', 'validation')) return { phaseKey: 'test', confidence: 0.88 };
  if (has('launch', 'go-live', 'deploy', 'cutover', 'hypercare', 'stabiliz')) return { phaseKey: 'deploy', confidence: 0.88 };
  // Design/solutioning rarely has a dedicated BC line; fall through to build.
  return { phaseKey: 'build', confidence: 0.55 };
}

// Context-aware WBS fallback — used when no BC cost anchors are available.
// Produces a multi-level, domain-appropriate WBS from the requirementsDigest
// and architectureDigest. Costs are deliberately zero — they are not invented;
// cost reconciliation must come from the BC once the financial tab is saved.
function buildContextAwareWbsFallback(ctx: {
  title: string;
  owner: string;
  reqs?: RequirementsDigestParam;
  arch?: ArchitectureDigestParam;
  startTime: number;
}): AgentOutput {
  const { title, owner, reqs, arch, startTime } = ctx;
  const r = reqs ?? {};
  const a = arch ?? {};

  // Domain detection — mirrors createProjectManagerAgent so WBS phases and PM
  // phases stay aligned when both agents run in the same pipeline.
  const ctx_ = `${title} ${(r.functional ?? []).join(' ')} ${(r.integrations ?? []).join(' ')} ${(a.businessCapabilities ?? []).join(' ')} ${(a.technologyComponents ?? []).join(' ')}`.toLowerCase();
  const is = (...kws: string[]) => kws.some(k => ctx_.includes(k));

  const isInfrastructure = is('infrastr', 'network', 'data cent', 'server', 'cloud', 'hosting', 'connectivity', 'fibre', 'cable');
  const isProcurement    = is('procure', 'tender', 'rfp', 'contract', 'vendor', 'supplier', 'sourcing');
  const isCapacity       = is('capacity', 'training', 'talent', 'workforce', 'human capital', 'upskill', 'learning');
  const isPolicy         = is('policy', 'regulat', 'legislat', 'framework', 'governance', 'standard', 'compliance');
  const isResearch       = is('research', 'feasibility', 'survey', 'pilot', 'proof of concept', 'poc');
  const _isDigital        = is('digital', 'transform', 'portal', 'platform', 'app', 'mobile', 'e-service', 'system', 'automat', 'workflow', 'integrat');

  // Derive scope hints from digests (up to 5 items each for readability)
  const functionalHints   = (r.functional       ?? []).slice(0, 5);
  const integrationHints  = (r.integrations     ?? []).slice(0, 4);
  const techHints         = (a.technologyComponents ?? []).slice(0, 4);
  const dataHints         = [...(r.dataRequirements ?? []), ...(a.dataEntities ?? [])].slice(0, 4);
  const securityHints     = (r.security         ?? []).slice(0, 3);
  const nfrHints          = (r.nonFunctional    ?? []).slice(0, 3);
  const capHints          = [...(r.capabilityGaps ?? []), ...(a.businessCapabilities ?? [])].slice(0, 4);

  // Build a work package for a named scope item
  const scopeWp = (name: string, desc: string, deliverables: string[], tasks: string[]): CostAwareWorkPackage => ({
    name, description: desc, plannedCost: 0, deliverables, tasks,
  });

  type PhaseSpec = { name: string; description: string; durationMonths: number; deliverables: string[]; tasks: string[]; workPackages: CostAwareWorkPackage[] };

  // ── Phase library (domain-branched) ──────────────────────────────────────
  let phases: PhaseSpec[];

  if (isInfrastructure) {
    phases = [
      {
        name: 'Assessment & Architecture',
        description: `Assess current infrastructure state and define target architecture for ${title}`,
        durationMonths: 2,
        deliverables: ['Current-state assessment', 'Target architecture blueprint', 'Capacity plan'],
        tasks: ['Site survey', 'Architecture review', 'Risk identification', 'Approval gate'],
        workPackages: [
          scopeWp('Current-State Assessment', 'Baseline existing infrastructure capacity, gaps, and technical debt', ['Assessment report', 'Gap analysis'], ['Site survey', 'Capacity measurement', 'Gap mapping']),
          scopeWp('Target Architecture Design', `Define future-state infrastructure architecture for ${title}`, ['Architecture blueprint', 'NFR specification'], ['Architecture workshops', 'Stakeholder review', 'Approval gate']),
          ...(techHints.length > 0 ? [scopeWp('Technology Stack Definition', `Define ${techHints.join(', ')} components and standards`, ['Technology selection record', 'Standards baseline'], ['Technology evaluation', 'PoC if needed', 'Adoption decision'])] : []),
        ],
      },
      {
        name: 'Procurement & Mobilisation',
        description: `Source hardware, software, and services required for ${title}`,
        durationMonths: 3,
        deliverables: ['Vendor contracts', 'Hardware delivery schedule', 'Team mobilisation plan'],
        tasks: ['RFP / sourcing', 'Contract award', 'Hardware delivery', 'Team setup'],
        workPackages: [
          scopeWp('Vendor Sourcing', 'Run competitive sourcing process for infrastructure components', ['RFP package', 'Evaluation scorecard', 'Award recommendation'], ['RFP issuance', 'Bid evaluation', 'Vendor selection']),
          scopeWp('Resource Mobilisation', 'Onboard project team and establish delivery governance', ['Team plan', 'Governance charter', 'RACI'], ['Team onboarding', 'Kickoff', 'Governance setup']),
        ],
      },
      {
        name: 'Installation & Integration',
        description: `Install, configure, and integrate all infrastructure components for ${title}`,
        durationMonths: 4,
        deliverables: ['Installed infrastructure', 'Integration test results', 'Security hardening report'],
        tasks: ['Physical/cloud installation', 'Network configuration', 'Security hardening', 'Integration testing'],
        workPackages: [
          scopeWp('Infrastructure Deployment', `Deploy and configure ${techHints.length > 0 ? techHints.slice(0,2).join(' and ') : 'core infrastructure'} components`, ['Deployment record', 'Configuration baseline'], ['Provisioning', 'Configuration', 'Smoke testing']),
          ...(integrationHints.length > 0 ? [scopeWp('System Integration', `Integrate with ${integrationHints.slice(0,3).join(', ')}`, ['Integration test evidence', 'Interface specifications'], ['Interface development', 'Integration testing', 'Sign-off'])] : []),
          ...(securityHints.length > 0 ? [scopeWp('Security Hardening', `Implement ${securityHints.join(', ')} controls`, ['Security baseline certificate', 'Penetration test report'], ['Security configuration', 'Vulnerability scan', 'Pen test'])] : []),
        ],
      },
      {
        name: 'Commissioning & Handover',
        description: `Commission live infrastructure and hand over to operations for ${title}`,
        durationMonths: 2,
        deliverables: ['Commissioning certificate', 'UAT sign-off', 'Operations runbook'],
        tasks: ['Load testing', 'UAT', 'Operations training', 'Formal handover'],
        workPackages: [
          scopeWp('Acceptance Testing', 'Execute UAT and performance validation against approved NFRs', ['UAT sign-off', 'Performance test report'], ['Test execution', 'Defect resolution', 'Sign-off']),
          scopeWp('Operations Handover', 'Transfer ownership to operations with runbooks and trained staff', ['Operations runbook', 'Training completion record', 'Handover certificate'], ['Runbook authoring', 'Ops training', 'Formal handover']),
        ],
      },
    ];
  } else if (isProcurement) {
    phases = [
      {
        name: 'Requirements & Market Scan',
        description: `Define procurement requirements and scan market for ${title}`,
        durationMonths: 1,
        deliverables: ['Requirements specification', 'Market survey', 'Procurement plan'],
        tasks: ['Needs analysis', 'Market consultation', 'Approval gate'],
        workPackages: [
          scopeWp('Needs Analysis', `Elaborate and validate procurement requirements for ${title}`, ['Requirements specification', 'Functional requirements sign-off'], ['Stakeholder workshops', 'Requirements documentation', 'SME review']),
          scopeWp('Market Scan', 'Survey vendor landscape, reference checks, and indicative pricing', ['Market survey report', 'Vendor shortlist'], ['Desk research', 'Vendor briefings', 'RFI (if applicable)']),
        ],
      },
      {
        name: 'Tender & Evaluation',
        description: `Issue tender, evaluate bids, and select supplier for ${title}`,
        durationMonths: 2,
        deliverables: ['RFP/tender package', 'Evaluation scorecard', 'Award recommendation'],
        tasks: ['RFP issuance', 'Bid evaluation', 'Reference checks', 'Award recommendation'],
        workPackages: [
          scopeWp('Tender Execution', 'Issue tender, manage Q&A, and receive bid submissions', ['Issued tender package', 'Bid submissions received'], ['RFP publication', 'Q&A management', 'Submission management']),
          scopeWp('Evaluation & Award', 'Evaluate bids against criteria and produce award recommendation', ['Evaluation report', 'Award recommendation'], ['Technical evaluation', 'Financial evaluation', 'Reference checks', 'Committee presentation']),
        ],
      },
      {
        name: 'Contracting & Onboarding',
        description: `Finalise contracts, onboard supplier, and establish governance for ${title}`,
        durationMonths: 2,
        deliverables: ['Signed contract', 'Supplier onboarding checklist', 'SLA baseline'],
        tasks: ['Contract negotiation', 'Legal review', 'Supplier onboarding', 'SLA kick-off'],
        workPackages: [
          scopeWp('Contract Execution', 'Negotiate, review legally, and execute contract', ['Signed contract', 'Legal clearance'], ['Term negotiation', 'Legal review', 'Signing ceremony']),
          scopeWp('Supplier Onboarding', 'Onboard supplier into delivery governance and systems', ['Onboarding checklist complete', 'Kick-off minutes'], ['System access', 'Governance induction', 'SLA kick-off']),
        ],
      },
      {
        name: 'Delivery & Contract Management',
        description: `Oversee supplier delivery and manage contract lifecycle for ${title}`,
        durationMonths: 3,
        deliverables: ['Delivery acceptance record', 'SLA performance reports', 'Contract closure certificate'],
        tasks: ['Milestone verification', 'SLA monitoring', 'Issue resolution', 'Contract closure'],
        workPackages: [
          scopeWp('Delivery Monitoring', 'Track supplier milestones, deliverables, and quality', ['Milestone acceptance records', 'Quality assurance reports'], ['Milestone reviews', 'Deliverable acceptance', 'Issue log management']),
          scopeWp('Contract Closure', 'Execute final acceptance, lessons learned, and contract close', ['Acceptance certificate', 'Lessons learned report'], ['Final acceptance', 'Retention release', 'Contract archiving']),
        ],
      },
    ];
  } else if (isCapacity) {
    phases = [
      {
        name: 'Needs Assessment & Design',
        description: `Identify capability gaps and design the learning programme for ${title}`,
        durationMonths: 2,
        deliverables: ['Skills gap report', 'Programme design', 'Curriculum outline'],
        tasks: ['Stakeholder interviews', 'Skills assessment', 'Programme design sign-off'],
        workPackages: [
          scopeWp('Skills Gap Assessment', `Assess current vs required competencies${capHints.length > 0 ? `: ${capHints.slice(0,3).join(', ')}` : ''}`, ['Gap analysis report', 'Target competency framework'], ['Staff surveys', 'Manager interviews', 'Gap mapping']),
          scopeWp('Programme Design', 'Design learning journey, curriculum, and assessment strategy', ['Programme design document', 'Curriculum outline'], ['Learning design', 'SME review', 'Approval gate']),
        ],
      },
      {
        name: 'Content Development & Pilot',
        description: `Develop training materials and run pilot for ${title}`,
        durationMonths: 3,
        deliverables: ['Training content package', 'Pilot report', 'Refined curriculum'],
        tasks: ['Content development', 'Facilitator training', 'Pilot delivery', 'Feedback analysis'],
        workPackages: [
          scopeWp('Content Development', 'Develop all training modules, materials, and assessments', ['Module content library', 'Assessment bank'], ['Content authoring', 'SME review', 'QA pass']),
          scopeWp('Pilot Delivery', 'Deliver pilot cohort and refine programme based on feedback', ['Pilot completion report', 'Refined content'], ['Pilot scheduling', 'Facilitated delivery', 'Feedback collection', 'Content revision']),
        ],
      },
      {
        name: 'Rollout & Delivery',
        description: `Scale programme delivery across all target cohorts for ${title}`,
        durationMonths: 4,
        deliverables: ['Training completion records', 'Competency assessment results'],
        tasks: ['Cohort delivery', 'Competency assessment', 'Completion tracking'],
        workPackages: [
          scopeWp('Cohort Delivery', 'Execute scheduled training across all departments', ['Attendance records', 'Completion certificates'], ['Scheduling', 'Facilitation', 'Tracking']),
          scopeWp('Competency Assessment', 'Assess and record participant competency post-training', ['Assessment results', 'Certification records'], ['Assessment design', 'Assessment execution', 'Results reporting']),
        ],
      },
      {
        name: 'Evaluation & Embedding',
        description: `Evaluate programme effectiveness and embed capability for ${title}`,
        durationMonths: 2,
        deliverables: ['Kirkpatrick evaluation report', 'Embedding roadmap'],
        tasks: ['Effectiveness evaluation', 'Lessons learned', 'Embedding actions'],
        workPackages: [
          scopeWp('Programme Evaluation', 'Measure learning transfer and business impact (Kirkpatrick L3/L4)', ['Evaluation report', 'ROI estimate'], ['Follow-up surveys', 'Manager interviews', 'KPI tracking']),
          scopeWp('Capability Embedding', 'Integrate new competencies into job profiles and performance frameworks', ['Updated job profiles', 'Embedding plan'], ['Profile updates', 'Manager alignment', 'Recognition programme']),
        ],
      },
    ];
  } else if (isPolicy) {
    phases = [
      {
        name: 'Research & Benchmarking',
        description: `Research current state and international benchmarks for ${title}`,
        durationMonths: 2,
        deliverables: ['Research report', 'Benchmarking summary', 'Stakeholder mapping'],
        tasks: ['Literature review', 'Comparative study', 'Stakeholder interviews'],
        workPackages: [
          scopeWp('Current-State Analysis', `Analyse existing policy/regulatory landscape relevant to ${title}`, ['Current-state report', 'Gap inventory'], ['Document review', 'Stakeholder interviews', 'Regulatory mapping']),
          scopeWp('International Benchmarking', 'Survey comparable jurisdictions and frameworks', ['Benchmarking report', 'Best-practice summary'], ['Desk research', 'Expert consultation', 'Synthesis']),
        ],
      },
      {
        name: 'Drafting & Consultation',
        description: `Develop draft policy/framework and run structured consultation for ${title}`,
        durationMonths: 3,
        deliverables: ['Draft policy/framework', 'Consultation summary', 'Revised draft'],
        tasks: ['Policy drafting', 'Expert review', 'Stakeholder consultation', 'Revision cycle'],
        workPackages: [
          scopeWp('Policy Drafting', `Author the draft policy/framework document for ${title}`, ['Draft policy document', 'Explanatory memorandum'], ['Drafting sessions', 'Legal language review', 'Internal SME review']),
          scopeWp('Stakeholder Consultation', 'Run formal consultation process and collate feedback', ['Consultation report', 'Revised draft'], ['Consultation design', 'Session facilitation', 'Feedback synthesis']),
        ],
      },
      {
        name: 'Approval & Endorsement',
        description: `Submit for formal approval through governance channels for ${title}`,
        durationMonths: 2,
        deliverables: ['Approval submission package', 'Endorsed policy/framework'],
        tasks: ['Legal review', 'Leadership endorsement', 'Formal approval', 'Publication'],
        workPackages: [
          scopeWp('Approval Process', 'Navigate sign-off through governance committees and authority levels', ['Approval minutes', 'Endorsed document'], ['Submission preparation', 'Committee presentation', 'Sign-off execution']),
          scopeWp('Publication & Communication', 'Publish and communicate the endorsed policy/framework', ['Published document', 'Communication brief'], ['Publication preparation', 'Dissemination', 'Awareness campaign']),
        ],
      },
      {
        name: 'Implementation & Compliance',
        description: `Implement policy and monitor compliance for ${title}`,
        durationMonths: 3,
        deliverables: ['Implementation guidance', 'Compliance monitoring report'],
        tasks: ['Awareness campaign', 'Implementation guides', 'Compliance tracking'],
        workPackages: [
          scopeWp('Implementation Support', 'Develop implementation guides and train affected parties', ['Implementation guide', 'Training materials'], ['Guide development', 'Training delivery', 'Helpdesk setup']),
          scopeWp('Compliance Monitoring', 'Establish monitoring framework and track adherence', ['Monitoring dashboard', 'First compliance report'], ['Monitoring design', 'Data collection', 'Reporting']  ),
        ],
      },
    ];
  } else if (isResearch) {
    phases = [
      {
        name: 'Scoping & Methodology',
        description: `Define research scope, questions, and methodology for ${title}`,
        durationMonths: 1,
        deliverables: ['Research scope document', 'Methodology plan', 'Stakeholder register'],
        tasks: ['Research question framing', 'Methodology design', 'Ethics/approvals'],
        workPackages: [
          scopeWp('Research Design', `Frame research questions and design methodology for ${title}`, ['Research design document', 'Approved methodology'], ['Question framing', 'Methodology selection', 'Ethics clearance']),
        ],
      },
      {
        name: 'Data Collection',
        description: `Execute data/field collection activities for ${title}`,
        durationMonths: 2,
        deliverables: ['Raw data set', 'Field notes', 'Interview transcripts'],
        tasks: ['Primary data collection', 'Secondary data review', 'Quality control'],
        workPackages: [
          scopeWp('Primary Research', 'Conduct surveys, interviews, or field observations', ['Survey data', 'Interview transcripts'], ['Instrument development', 'Data collection', 'Quality check']),
          scopeWp('Secondary Research', 'Review existing literature, datasets, and reports', ['Literature review', 'Secondary dataset'], ['Database search', 'Document review', 'Synthesis']),
        ],
      },
      {
        name: 'Analysis & Synthesis',
        description: `Analyse data, test hypotheses, and synthesise findings for ${title}`,
        durationMonths: 2,
        deliverables: ['Analysis outputs', 'Findings report', 'Draft recommendations'],
        tasks: ['Quantitative/qualitative analysis', 'Hypothesis testing', 'Findings synthesis'],
        workPackages: [
          scopeWp('Data Analysis', 'Apply statistical or qualitative analysis methods to collected data', ['Analysed dataset', 'Statistical outputs'], ['Data cleaning', 'Analysis execution', 'Results review']),
          scopeWp('Findings Synthesis', 'Synthesise analysis into coherent findings and recommendations', ['Findings report', 'Draft recommendations'], ['Synthesis workshops', 'Report drafting', 'Peer review']),
        ],
      },
      {
        name: 'Reporting & Dissemination',
        description: `Produce final report and disseminate findings for ${title}`,
        durationMonths: 1,
        deliverables: ['Final research report', 'Executive summary', 'Dissemination plan'],
        tasks: ['Final report production', 'Stakeholder presentation', 'Publication/dissemination'],
        workPackages: [
          scopeWp('Final Report', `Produce and approve the final ${title} research report`, ['Final report', 'Executive summary'], ['Report production', 'Stakeholder review', 'Approval']),
          scopeWp('Dissemination', 'Communicate findings to relevant stakeholders and channels', ['Presentation deck', 'Dissemination record'], ['Stakeholder briefings', 'Publication', 'Knowledge transfer']),
        ],
      },
    ];
  } else {
    // Default: digital / software delivery phases (most common COREVIA use case)
    const hasIntegrations = integrationHints.length > 0;
    const hasDataWork     = dataHints.length > 0;
    const hasTech         = techHints.length > 0;

    phases = [
      {
        name: 'Mobilise & Plan',
        description: `Establish delivery governance and baseline the plan for ${title}`,
        durationMonths: 2,
        deliverables: ['Project charter', 'Scope baseline', 'RACI & governance setup', 'Risk register v1'],
        tasks: ['Kickoff', 'Stakeholder workshops', 'Scope approval', 'Plan baseline'],
        workPackages: [
          scopeWp('Governance Setup', `Establish delivery governance, RACI, and tooling for ${title}`, ['Project charter', 'Governance structure', 'RACI matrix'], ['PMO setup', 'Stakeholder register', 'Kickoff meeting']),
          scopeWp('Scope Baseline', 'Validate scope, confirm requirements, and obtain approval to proceed', ['Approved scope statement', 'Requirements baseline'], ['Requirements review', 'Scope workshop', 'Sign-off']),
          ...(functionalHints.length > 0 ? [scopeWp('Requirements Elaboration', `Elaborate functional requirements: ${functionalHints.slice(0,3).join('; ')}`, ['Elaborated requirements', 'Use cases'], ['Requirement workshops', 'Documentation', 'SME sign-off'])] : []),
        ],
      },
      {
        name: 'Design & Architecture',
        description: `Elaborate solution design and architecture for ${title}`,
        durationMonths: 3,
        deliverables: ['Solution design document', 'Integration design', 'Data model'],
        tasks: ['Architecture design', 'Integration design', 'Security design review'],
        workPackages: [
          scopeWp('Solution Architecture', `Design end-to-end solution architecture${hasTech ? ` using ${techHints.slice(0,2).join(', ')}` : ''} for ${title}`, ['Architecture design document', 'NFR acceptance matrix'], ['Architecture workshops', 'Design reviews', 'Architecture sign-off']),
          ...(hasIntegrations ? [scopeWp('Integration Design', `Design integrations with ${integrationHints.slice(0,3).join(', ')}`, ['Integration design specification', 'API contracts'], ['Interface analysis', 'API design', 'Integration review'])] : []),
          ...(hasDataWork ? [scopeWp('Data Architecture & Migration Design', `Design data model and migration approach for ${dataHints.slice(0,2).join(', ')}`, ['Data model', 'Migration design'], ['Data modelling', 'ETL design', 'Data quality rules'])] : []),
        ],
      },
      {
        name: 'Build & Configure',
        description: `Configure the core solution and develop customisations for ${title}`,
        durationMonths: 4,
        deliverables: ['Configured solution', 'Custom modules', 'Unit test results'],
        tasks: ['Environment bootstrap', 'Core configuration', 'Custom development', 'Internal QA'],
        workPackages: [
          scopeWp('Core Build', `Implement the core solution features for ${title}${functionalHints.length > 0 ? `: ${functionalHints.slice(0,3).join('; ')}` : ''}`, ['Core build release', 'Unit test results'], ['Environment setup', 'Core development', 'Code review', 'Unit testing']),
          ...(hasIntegrations ? [scopeWp('Integration Build', `Build integrations with ${integrationHints.slice(0,3).join(', ')}`, ['Integration build', 'Component test results'], ['Interface development', 'Stub/mock testing', 'Integration QA'])] : []),
          ...(hasDataWork ? [scopeWp('Data Migration Build', `Build migration pipeline for ${dataHints.slice(0,2).join(', ')}`, ['Migration scripts', 'Data reconciliation report'], ['ETL development', 'Data quality validation', 'Trial migration run'])] : []),
          ...(nfrHints.length > 0 ? [scopeWp('Non-Functional Engineering', `Address NFRs: ${nfrHints.join(', ')}`, ['NFR evidence package'], ['Performance design', 'Security implementation', 'NFR testing'])] : []),
        ],
      },
      {
        name: 'Test & Validate',
        description: `Execute SIT, UAT, and acceptance testing for ${title}`,
        durationMonths: 2,
        deliverables: ['SIT sign-off', 'UAT sign-off', 'Security test report', 'Defect closure report'],
        tasks: ['SIT execution', 'UAT coordination', 'Performance testing', 'Defect triage'],
        workPackages: [
          scopeWp('System Integration Testing', `Execute end-to-end SIT${hasIntegrations ? ` including ${integrationHints.slice(0,2).join(' and ')} interfaces` : ''}`, ['SIT sign-off', 'Test evidence'], ['Test case execution', 'Defect triage', 'Regression testing']),
          scopeWp('User Acceptance Testing', 'Facilitate UAT with business stakeholders and obtain sign-off', ['UAT sign-off', 'Acceptance certificate'], ['UAT planning', 'Business facilitation', 'Defect resolution', 'Sign-off']),
          ...(securityHints.length > 0 ? [scopeWp('Security Testing', `Validate ${securityHints.slice(0,2).join(', ')} controls`, ['Security test report', 'Remediation log'], ['Vulnerability scanning', 'Penetration testing', 'Finding remediation'])] : []),
        ],
      },
      {
        name: 'Deploy & Stabilise',
        description: `Cut over to production and stabilise the solution for ${title}`,
        durationMonths: 2,
        deliverables: ['Go-live approval', 'Production cutover executed', 'Hypercare closure report'],
        tasks: ['Cutover rehearsal', 'Go-live', 'Hypercare', 'Operations handover'],
        workPackages: [
          scopeWp('Production Deployment', `Execute go-live cutover for ${title} with rollback-ready plan`, ['Cutover plan', 'Go-live record'], ['Cutover rehearsal', 'Data migration cutover', 'Go-live execution']),
          scopeWp('Hypercare & Stabilisation', 'Run hypercare support window and resolve production issues', ['Hypercare closure report', 'Issue register'], ['Monitoring setup', 'Issue resolution', 'Stabilisation sign-off']),
          scopeWp('Operations Handover', 'Transfer to run-and-maintain with trained ops team and runbooks', ['Operations runbook', 'Training completion record', 'Handover sign-off'], ['Runbook authoring', 'Ops training', 'Formal handover']),
        ],
      },
    ];
  }

  // ── Assemble into CostAwareWbsResult shape ───────────────────────────────
  const implementationPhases: CostAwarePhase[] = phases.map((p, idx) => ({
    name: p.name,
    description: p.description,
    durationMonths: p.durationMonths,
    deliverables: p.deliverables,
    tasks: p.tasks,
    workPackages: p.workPackages,
    plannedCost: 0,          // No authoritative cost data — do not invent a number
    owner,
    status: 'pending',
    sequence: idx + 1,
  }));

  const milestones = implementationPhases.map((p, idx) => ({
    name: `${p.name} — Complete`,
    phase: p.name,
    targetMonth: implementationPhases.slice(0, idx + 1).reduce((s, ph) => s + ph.durationMonths, 0),
  }));

  const domainLabel = isInfrastructure ? 'Infrastructure' : isProcurement ? 'Procurement' : isCapacity ? 'Capacity Building' : isPolicy ? 'Policy/Regulatory' : isResearch ? 'Research' : 'Digital Delivery';

  const result: CostAwareWbsResult = {
    implementationPhases,
    milestones,
    totalPlannedCost: 0,
    costReconciliation: { bcImplementation: 0, wbsPlanned: 0, variance: 0 },
  };

  return {
    success: true,
    result,
    reasoning: `No BC cost anchors available — generated ${implementationPhases.length}-phase context-aware WBS for ${title} (domain: ${domainLabel}). ${implementationPhases.reduce((s, p) => s + p.workPackages.length, 0)} work packages derived from requirementsDigest and architectureDigest. Costs set to 0 pending BC financial detail save.`,
    confidence: 0.72,
    executionTimeMs: Date.now() - startTime,
  };
}

function buildCostAwareWbs(ctx: {
  title: string;
  owner: string;
  bcCost: BcCostStructureParam;
  reqs?: RequirementsDigestParam;
  arch?: ArchitectureDigestParam;
}): CostAwareWbsResult {
  const { title, owner, bcCost, reqs, arch } = ctx;

  // Canonical phase catalogue — durationMonths are starting defaults; they
  // scale later in proportion to that phase's share of the planned cost.
  const phaseCatalog: Array<{ key: CostAwarePhase['name'] extends string ? string : never; label: string; desc: string; durationMonths: number; baseDeliverables: string[]; baseTasks: string[] }> = [];
  const defs: Record<string, { label: string; desc: string; durationMonths: number; baseDeliverables: string[]; baseTasks: string[] }> = {
    mobilize: {
      label: 'Mobilize, Govern & Plan',
      desc: `Stand up delivery governance, confirm scope & assumptions for ${title}, and baseline the plan against the approved business case`,
      durationMonths: 2,
      baseDeliverables: ['Project charter', 'Scope baseline', 'RACI & governance setup', 'Risk register v1', 'Baselined schedule & cost plan'],
      baseTasks: ['Kickoff', 'Stakeholder workshops', 'Scope approval', 'Plan baseline'],
    },
    design: {
      label: 'Design & Architect',
      desc: `Elaborate requirements, finalize solution architecture and integration design for ${title}`,
      durationMonths: 3,
      baseDeliverables: ['Solution design document', 'Integration design', 'Data model & migration design', 'NFR acceptance matrix'],
      baseTasks: ['Requirements elaboration', 'Architecture design', 'Integration design', 'Security design review'],
    },
    build: {
      label: 'Build & Configure',
      desc: `Configure the core solution, develop customisations and produce release candidates for ${title}`,
      durationMonths: 4,
      baseDeliverables: ['Configured solution', 'Custom modules', 'Unit & component test results', 'Build release notes'],
      baseTasks: ['Environment bootstrap', 'Core configuration', 'Custom development', 'Internal QA'],
    },
    integrate: {
      label: 'Integrate & Migrate',
      desc: `Establish system integrations, migrate data and validate end-to-end flows`,
      durationMonths: 3,
      baseDeliverables: ['Integration endpoints live', 'Data migration executed', 'End-to-end flow test evidence'],
      baseTasks: ['Interface build', 'Data mapping & ETL', 'Integration testing', 'Data reconciliation'],
    },
    infrastructure: {
      label: 'Infrastructure & Environments',
      desc: `Provision and harden environments, hosting and operational platforms required by ${title}`,
      durationMonths: 2,
      baseDeliverables: ['Provisioned environments (Dev/Test/Prod)', 'Security baseline', 'Observability stack', 'DR/backup policies'],
      baseTasks: ['Environment provisioning', 'Network & security setup', 'Monitoring & logging setup'],
    },
    test: {
      label: 'Test & Validate',
      desc: `Execute SIT, UAT, performance and security testing to confirm ${title} meets acceptance criteria`,
      durationMonths: 2,
      baseDeliverables: ['SIT sign-off', 'UAT sign-off', 'Performance & security test report', 'Defect closure report'],
      baseTasks: ['SIT execution', 'UAT coordination', 'Performance testing', 'Security testing', 'Defect triage'],
    },
    deploy: {
      label: 'Deploy & Stabilize',
      desc: `Cut over to production, deliver hypercare and handover to operations for ${title}`,
      durationMonths: 2,
      baseDeliverables: ['Go-live approval', 'Production cutover executed', 'Hypercare closure report', 'Ops handover package'],
      baseTasks: ['Cutover rehearsal', 'Go-live', 'Hypercare', 'Operations handover'],
    },
    change: {
      label: 'Change Management & Adoption',
      desc: `Drive stakeholder readiness, training and adoption for ${title}`,
      durationMonths: 3,
      baseDeliverables: ['Change impact assessment', 'Communication plan executed', 'Training delivered', 'Adoption metrics baseline'],
      baseTasks: ['Change impact assessment', 'Communications', 'Training design', 'Training delivery', 'Adoption measurement'],
    },
  };

  // Always-present phase order (we only emit a phase if it gathers anchors or
  // baseline support work).
  const phaseOrder = ['mobilize', 'design', 'infrastructure', 'build', 'integrate', 'test', 'deploy', 'change'] as const;

  type PhaseKey = (typeof phaseOrder)[number];
  const bucket: Record<PhaseKey, BcCostAnchorParam[]> = {
    mobilize: [], design: [], infrastructure: [], build: [], integrate: [], test: [], deploy: [], change: [],
  };
  let managementReserve = 0;
  const reserveAnchors: BcCostAnchorParam[] = [];

  for (const a of bcCost.implementationAnchors) {
    const { phaseKey } = classifyAnchorPhase(a);
    if (phaseKey === 'reserve') {
      managementReserve += a.total;
      reserveAnchors.push(a);
      continue;
    }
    bucket[phaseKey].push(a);
  }

  // Seed Design phase if no anchor landed there — design effort is usually
  // absorbed into Core Software; we still want an explicit phase for
  // governance/reporting, funded via a carve-out from the build bucket.
  const designCarveOut = bucket.design.length === 0 && bucket.build.length > 0
    ? Math.round(bucket.build.reduce((s, a) => s + a.total, 0) * 0.15)
    : 0;

  const totalImpl = bcCost.implementationAnchors.reduce((s, a) => s + a.total, 0);
  const reqs_ = reqs ?? {};
  const arch_ = arch ?? {};

  const integrationHints = [
    ...(reqs_.integrations ?? []),
    ...(arch_.integrationPatterns ?? []),
  ].slice(0, 6);
  const _securityHints = (reqs_.security ?? []).slice(0, 4);
  const _dataHints = [
    ...(reqs_.dataRequirements ?? []),
    ...(arch_.dataEntities ?? []),
  ].slice(0, 4);
  const capabilityHints = [
    ...(reqs_.functional ?? []),
    ...(arch_.businessCapabilities ?? []),
  ].slice(0, 6);
  const nfrHints = (reqs_.nonFunctional ?? []).slice(0, 4);

  const phases: CostAwarePhase[] = [];
  for (const key of phaseOrder) {
    const anchors = bucket[key];
    const def = defs[key]!;
    if (anchors.length === 0 && key !== 'mobilize' && key !== 'design' && key !== 'test' && key !== 'deploy') {
      // skip empty optional phases
      continue;
    }
    const workPackages: CostAwareWorkPackage[] = anchors.map((a) => {
      const wp: CostAwareWorkPackage = {
        name: a.name,
        description: a.description ?? `${a.name} — anchored to BC line ${a.ref} (${a.subcategory ?? a.category})`,
        costAnchor: a.ref,
        plannedCost: a.total,
        deliverables: [`${a.name} delivered against BC ${a.ref}`],
        tasks: [`Plan ${a.name}`, `Execute ${a.name}`, `Verify ${a.name}`],
        assignedRole: owner,
      };
      // Enrich per phase type
      if (key === 'integrate' && integrationHints.length) {
        wp.deliverables = integrationHints.map((i) => `Integration with ${i} operational`);
        wp.tasks = ['Interface spec', 'Endpoint build', 'SIT', 'Data reconciliation'];
      } else if (key === 'build' && capabilityHints.length) {
        wp.deliverables = capabilityHints.slice(0, 4).map((c) => `Capability live: ${c}`);
        wp.tasks = ['Configuration', 'Custom development', 'Code review', 'Unit testing'];
      } else if (key === 'infrastructure' && (arch_.technologyComponents?.length || 0) > 0) {
        wp.deliverables = (arch_.technologyComponents ?? []).slice(0, 3).map((t) => `${t} provisioned & hardened`);
      } else if (key === 'test' && nfrHints.length) {
        wp.deliverables = nfrHints.slice(0, 3).map((n) => `NFR validated: ${n}`);
        wp.tasks = ['SIT', 'UAT', 'Performance test', 'Security test'];
      } else if (key === 'change' && (reqs_.operationalRequirements?.length || 0) > 0) {
        wp.deliverables = (reqs_.operationalRequirements ?? []).slice(0, 3).map((o) => `Operational readiness: ${o}`);
      }
      return wp;
    });

    // Inject the design carve-out as a synthetic WP on the Design phase so
    // design cost is traceable even when BC doesn't have a dedicated line.
    if (key === 'design' && designCarveOut > 0) {
      workPackages.push({
        name: 'Solution & Integration Design',
        description: 'Design-stage effort carved from Core Software budget (15% convention)',
        costAnchor: 'BC.BUILD/15%',
        plannedCost: designCarveOut,
        deliverables: ['Solution design approved', 'Integration design approved', 'Data migration design approved'],
        tasks: ['Architecture design', 'Integration design', 'Data model design', 'Security review'],
        assignedRole: 'Solution Architect',
      });
    }

    // Mobilize always present — even with no anchor, it carries governance/PMO
    if (key === 'mobilize' && workPackages.length === 0) {
      workPackages.push({
        name: 'Delivery Governance & PMO',
        description: 'PMO, planning, baselines, risk management, committee reporting',
        plannedCost: Math.round(totalImpl * 0.05),
        deliverables: ['Project charter', 'RACI & governance', 'Baselined plan', 'Risk register v1'],
        tasks: ['Kickoff', 'Plan baseline', 'Risk & issue log setup'],
        assignedRole: 'Project Manager',
      });
    }
    if (key === 'test' && workPackages.length === 0) {
      workPackages.push({
        name: 'System Integration & UAT',
        description: 'End-to-end validation of integrated solution',
        plannedCost: 0,
        deliverables: ['SIT sign-off', 'UAT sign-off'],
        tasks: ['SIT execution', 'UAT coordination', 'Defect triage'],
        assignedRole: 'QA Lead',
      });
    }
    if (key === 'deploy' && workPackages.length === 0) {
      workPackages.push({
        name: 'Cutover, Go-Live & Hypercare',
        description: 'Production cutover, hypercare and operational handover',
        plannedCost: 0,
        deliverables: ['Go-live approval', 'Hypercare closure', 'Operations handover'],
        tasks: ['Cutover rehearsal', 'Go-live', 'Hypercare', 'Handover'],
        assignedRole: 'Release Manager',
      });
    }

    const phaseCost = workPackages.reduce((s, wp) => s + (wp.plannedCost ?? 0), 0);

    // Deliverables/tasks aggregated from base + WP
    const deliverables = Array.from(new Set([
      ...def.baseDeliverables,
      ...workPackages.flatMap((wp) => wp.deliverables),
    ])).slice(0, 8);
    const tasks = Array.from(new Set([
      ...def.baseTasks,
      ...workPackages.flatMap((wp) => wp.tasks),
    ])).slice(0, 10);

    // Scale duration loosely by cost share (min 1, max original×2)
    const costShare = totalImpl > 0 ? phaseCost / totalImpl : 0;
    const durationMonths = Math.max(1, Math.round(def.durationMonths * (0.5 + costShare * 2.5)));

    phases.push({
      name: def.label,
      description: def.desc,
      durationMonths,
      deliverables,
      tasks,
      workPackages,
      plannedCost: phaseCost,
      owner,
      status: 'pending',
    });
    phaseCatalog.push({ key, label: def.label, desc: def.desc, durationMonths, baseDeliverables: def.baseDeliverables, baseTasks: def.baseTasks });
  }

  // Distribute management reserve across phases weighted by cost share.
  if (managementReserve > 0) {
    const totalAssigned = phases.reduce((s, p) => s + p.plannedCost, 0) || 1;
    let remaining = managementReserve;
    phases.forEach((p, idx) => {
      const slice = idx === phases.length - 1
        ? remaining
        : Math.round((p.plannedCost / totalAssigned) * managementReserve);
      remaining -= slice;
      if (slice > 0) {
        p.workPackages.push({
          name: `Contingency (${p.name})`,
          description: 'Phase share of BC management reserve',
          costAnchor: reserveAnchors.map((a) => a.ref).join('+') || 'BC.RESERVE',
          plannedCost: slice,
          deliverables: ['Reserve drawdown decisions logged'],
          tasks: ['Reserve drawdown governance'],
          assignedRole: 'Steering Committee',
        });
        p.plannedCost += slice;
      }
    });
  }

  // Milestones — one per phase boundary + data migration + first BC-relevant signoff
  let cumulativeMonths = 0;
  const milestones: Array<{ name: string; phase: string; targetMonth?: number }> = [];
  for (const p of phases) {
    cumulativeMonths += p.durationMonths;
    milestones.push({ name: `${p.name} complete`, phase: p.name, targetMonth: cumulativeMonths });
  }
  // Insert "Business Case reconciliation checkpoint" at end of mobilize
  const mobilizePhase = phases.find((p) => /mobilize/i.test(p.name));
  if (mobilizePhase) {
    milestones.unshift({ name: 'Business Case & scope baseline confirmed', phase: mobilizePhase.name, targetMonth: mobilizePhase.durationMonths });
  }

  const wbsPlanned = phases.reduce((s, p) => s + p.plannedCost, 0);
  const bcImpl = Math.round(bcCost.tcoBreakdown?.implementation ?? totalImpl);

  // Recurring anchors → sustainment sub-plan
  let sustainment: CostAwareWbsResult['sustainment'];
  if (bcCost.recurringAnchors && bcCost.recurringAnchors.length > 0) {
    const horizonYears = bcCost.horizonYears ?? Math.max(
      1,
      ...bcCost.recurringAnchors.map((a) => a.yearProfile?.at(-1)?.year ?? 1),
    );
    const annualProfile: Array<{ year: number; plannedCost: number }> = [];
    for (let y = 1; y <= horizonYears; y++) {
      let amt = 0;
      for (const a of bcCost.recurringAnchors) {
        const yp = (a.yearProfile ?? []).find((x) => x.year === y);
        amt += yp?.amount ?? 0;
      }
      annualProfile.push({ year: y, plannedCost: Math.round(amt) });
    }
    sustainment = {
      name: 'Operate & Sustain (post Go-Live)',
      description: `Run-the-business phase funded by ${bcCost.recurringAnchors.length} recurring BC anchor(s) over ${horizonYears} year(s)`,
      horizonYears,
      annualProfile,
      totalPlannedCost: annualProfile.reduce((s, yp) => s + yp.plannedCost, 0),
      anchors: bcCost.recurringAnchors.map((a) => ({ ref: a.ref, name: a.name, total: a.total })),
    };
  }

  return {
    implementationPhases: phases,
    milestones,
    totalPlannedCost: wbsPlanned,
    costReconciliation: {
      bcImplementation: bcImpl,
      wbsPlanned,
      variance: wbsPlanned - bcImpl,
    },
    sustainment,
  };
}

export class ADKAgentRuntime {
  private agents: Map<string, AgentDefinition> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private executionHistory: Array<{
    agentId: string;
    input: AgentInput;
    output: AgentOutput;
    timestamp: string;
  }> = [];

  constructor() {
    this.registerBuiltInAgents();
  }

  private registerBuiltInAgents(): void {
    this.registerAgent(this.createPolicyAnalysisAgent(), { category: "governance", isBuiltIn: true });
    this.registerAgent(this.createRiskAssessmentAgent(), { category: "risk", isBuiltIn: true });
    this.registerAgent(this.createRecommendationAgent(), { category: "strategy", isBuiltIn: true });
    this.registerAgent(this.createValidationAgent(), { category: "quality", isBuiltIn: true });
    this.registerAgent(evidenceCollectorAgent, { category: "intelligence", isBuiltIn: true });
    this.registerAgent(riskControlsAgent, { category: "risk", isBuiltIn: true });
    this.registerAgent(packBuilderAgent, { category: "governance", isBuiltIn: true });
    this.registerAgent(portfolioSyncAgent, { category: "execution", isBuiltIn: true });
    this.registerAgent(demandAgent, { category: "demand", isBuiltIn: true });
    this.registerAgent(this.createFinancialAnalysisAgent(), { category: "financial", isBuiltIn: true });
    this.registerAgent(this.createMarketResearchAgent(), { category: "intelligence", isBuiltIn: true });
    this.registerAgent(this.createComplianceCheckAgent(), { category: "governance", isBuiltIn: true });
    this.registerAgent(this.createEnterpriseArchitectureAgent(), { category: "architecture", isBuiltIn: true });
    this.registerAgent(this.createStrategicAlignmentAgent(), { category: "strategy", isBuiltIn: true });
    this.registerAgent(this.createQualityGateAgent(), { category: "quality", isBuiltIn: true });
    this.registerAgent(this.createProjectManagerAgent(), { category: "planning", isBuiltIn: true });
    this.registerAgent(this.createRequirementExtractorAgent(), { category: "analysis", isBuiltIn: true });
    this.registerAgent(this.createTraceabilityAgent(), { category: "analysis", isBuiltIn: true });
    this.registerAgent(this.createWbsBuilderAgent(), { category: "planning", isBuiltIn: true });
    this.registerAgent(this.createDependencyAgent(), { category: "planning", isBuiltIn: true });
    this.registerAgent(this.createResourceRoleAgent(), { category: "planning", isBuiltIn: true });
  }

  registerAgent(agent: AgentDefinition, configOverrides?: Partial<AgentConfig>): void {
    this.agents.set(agent.id, agent);
    if (!this.agentConfigs.has(agent.id)) {
      this.agentConfigs.set(agent.id, {
        enabled: true,
        category: configOverrides?.category || "general",
        version: "1.0.0",
        executionCount: 0,
        avgExecutionTimeMs: 0,
        successRate: 100,
        isBuiltIn: configOverrides?.isBuiltIn ?? false,
      });
    }
    logger.info(`[ADK] Agent registered: ${agent.id}`);
  }

  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.agentConfigs.get(agentId);
  }

  updateAgentConfig(agentId: string, updates: Partial<AgentConfig>): boolean {
    const config = this.agentConfigs.get(agentId);
    if (!config) return false;
    Object.assign(config, updates);
    return true;
  }

  toggleAgent(agentId: string, enabled: boolean): boolean {
    const config = this.agentConfigs.get(agentId);
    if (!config) return false;
    config.enabled = enabled;
    return true;
  }

  removeAgent(agentId: string): boolean {
    const config = this.agentConfigs.get(agentId);
    if (config?.isBuiltIn) return false;
    this.agents.delete(agentId);
    this.agentConfigs.delete(agentId);
    return true;
  }

  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  listAgentsWithConfig(): Array<AgentDefinition & { config: AgentConfig }> {
    return Array.from(this.agents.entries()).map(([id, agent]) => ({
      ...agent,
      config: this.agentConfigs.get(id) || {
        enabled: true, category: "general", version: "1.0.0",
        executionCount: 0, avgExecutionTimeMs: 0, successRate: 100, isBuiltIn: false,
      },
    }));
  }

  private canExecute(agent: AgentDefinition, requestorLevel: ClassificationLevel): boolean {
    const hierarchy: ClassificationLevel[] = ["public", "internal", "confidential", "sovereign"];
    return hierarchy.indexOf(requestorLevel) >= hierarchy.indexOf(agent.requiredClassification);
  }

  async execute(agentId: string, input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const agent = this.agents.get(agentId);

    if (!agent) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [`Agent not found: ${agentId}`],
      };
    }

    const config = this.agentConfigs.get(agentId);
    if (config && !config.enabled) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [`Agent is disabled: ${agentId}`],
      };
    }

    if (!this.canExecute(agent, input.context.classificationLevel)) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [`Insufficient classification level for agent: ${agentId}`],
      };
    }

    try {
      const output = await agent.execute(input);

      this.executionHistory.push({
        agentId,
        input,
        output,
        timestamp: new Date().toISOString(),
      });

      if (config) {
        config.executionCount++;
        config.lastExecutedAt = new Date().toISOString();
        const total = config.executionCount;
        config.avgExecutionTimeMs = Math.round(
          ((config.avgExecutionTimeMs * (total - 1)) + output.executionTimeMs) / total
        );
        config.successRate = Math.round(
          ((config.successRate * (total - 1)) + (output.success ? 100 : 0)) / total
        );
      }

      return output;
    } catch (error) {
      if (config) {
        config.executionCount++;
        config.lastExecutedAt = new Date().toISOString();
        const total = config.executionCount;
        config.successRate = Math.round(
          ((config.successRate * (total - 1)) + 0) / total
        );
      }
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  async executeParallel(agentIds: string[], input: AgentInput): Promise<Map<string, AgentOutput>> {
    const results = new Map<string, AgentOutput>();
    const promises = agentIds.map(async (agentId) => {
      const output = await this.execute(agentId, input);
      results.set(agentId, output);
    });

    await Promise.all(promises);
    return results;
  }

  private createPolicyAnalysisAgent(): AgentDefinition {
    return {
      id: "policy-analysis-agent",
      name: "Policy Analysis Agent",
      description: "Analyzes decisions against organizational policies and governance frameworks",
      capabilities: ["policy_matching", "compliance_check", "governance_validation"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();

        const ragResponse = await ragGateway.retrieve({
          query: `policy governance compliance ${input.task}`,
          context: { domain: "policy", intent: input.task },
          classificationLevel: input.context.classificationLevel,
          maxResults: 5,
        });

        const matchedPolicies = ragResponse.results.map((r) => ({
          source: r.source,
          relevance: r.score,
          content: r.content.substring(0, 200),
        }));

        const complianceScore = matchedPolicies.length > 0
          ? matchedPolicies.reduce((sum, p) => sum + p.relevance, 0) / matchedPolicies.length
          : 0.5;

        return {
          success: true,
          result: {
            matchedPolicies,
            complianceScore,
            recommendations: complianceScore < 0.7
              ? ["Review applicable policies before proceeding", "Consider seeking policy guidance"]
              : ["Policy alignment confirmed"],
            gaps: complianceScore < 0.5
              ? ["No direct policy match found - may require new policy creation"]
              : [],
          },
          reasoning: `Analyzed ${matchedPolicies.length} relevant policies with average relevance of ${(complianceScore * 100).toFixed(1)}%`,
          confidence: Math.min(complianceScore + 0.2, 1.0),
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createRiskAssessmentAgent(): AgentDefinition {
    return {
      id: "risk-assessment-agent",
      name: "Risk Assessment Agent",
      description: "Evaluates risks across technical, financial, operational, and strategic dimensions",
      capabilities: ["risk_identification", "impact_analysis", "mitigation_recommendation"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();

        const parameters = input.parameters || {};
        const budgetAmount = parameters.budget || 0;
        const complexity = parameters.complexity || "medium";
        const timeline = parameters.timeline || "6_months";

        const riskDimensions = {
          technical: this.calculateTechnicalRisk(complexity),
          financial: this.calculateFinancialRisk(budgetAmount),
          operational: this.calculateOperationalRisk(timeline),
          compliance: 0.3,
          strategic: 0.25,
        };

        const overallRisk = Object.values(riskDimensions).reduce((a, b) => a + b, 0) / 5;
        const riskLevel = overallRisk > 0.7 ? "high" : overallRisk > 0.4 ? "medium" : "low";

        const mitigations: string[] = [];
        if (riskDimensions.technical > 0.5) mitigations.push("Conduct technical feasibility study");
        if (riskDimensions.financial > 0.5) mitigations.push("Implement phased budget approval");
        if (riskDimensions.operational > 0.5) mitigations.push("Create detailed implementation timeline");

        return {
          success: true,
          result: {
            riskDimensions,
            overallRisk,
            riskLevel,
            mitigations,
            riskMatrix: {
              likelihood: overallRisk,
              impact: Math.max(...Object.values(riskDimensions)),
            },
          },
          reasoning: `Assessed 5 risk dimensions with overall risk score of ${(overallRisk * 100).toFixed(1)}%`,
          confidence: 0.85,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private calculateTechnicalRisk(complexity: string): number {
    const risks: Record<string, number> = { low: 0.2, medium: 0.4, high: 0.7, critical: 0.9 };
    return risks[complexity] || 0.4;
  }

  private calculateFinancialRisk(budget: number): number {
    if (budget > 10000000) return 0.8;
    if (budget > 5000000) return 0.6;
    if (budget > 1000000) return 0.4;
    return 0.2;
  }

  private calculateOperationalRisk(timeline: string): number {
    const risks: Record<string, number> = {
      "1_month": 0.7,
      "3_months": 0.5,
      "6_months": 0.3,
      "12_months": 0.4,
      "24_months": 0.5,
    };
    return risks[timeline] || 0.4;
  }

  private createRecommendationAgent(): AgentDefinition {
    return {
      id: "recommendation-agent",
      name: "Recommendation Agent",
      description: "Generates strategic recommendations and alternatives for decision support",
      capabilities: ["alternative_generation", "option_ranking", "strategic_alignment"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();

        const ragResponse = await ragGateway.retrieve({
          query: `best practices recommendations ${input.task}`,
          context: { domain: "strategy", intent: input.task },
          classificationLevel: input.context.classificationLevel,
          maxResults: 5,
        });

        const alternatives = [
          {
            id: "ALT-1",
            name: "Standard Approach",
            description: "Follow established procedures with minimal deviation",
            pros: ["Lower risk", "Predictable timeline", "Proven success rate"],
            cons: ["May not address all requirements", "Limited innovation"],
            score: 0.75,
          },
          {
            id: "ALT-2",
            name: "Accelerated Approach",
            description: "Fast-track implementation with agile methodology",
            pros: ["Faster delivery", "Early value realization", "Adaptive to changes"],
            cons: ["Higher risk", "Resource intensive", "Requires strong governance"],
            score: 0.65,
          },
          {
            id: "ALT-3",
            name: "Phased Approach",
            description: "Incremental rollout with validation at each phase",
            pros: ["Risk mitigation", "Learning opportunities", "Flexible scope"],
            cons: ["Longer timeline", "Potential scope creep", "Integration challenges"],
            score: 0.8,
          },
        ];

        const recommendedAlternative = alternatives.reduce((a, b) => (a.score > b.score ? a : b));

        return {
          success: true,
          result: {
            alternatives,
            recommendation: recommendedAlternative,
            supportingEvidence: ragResponse.results.slice(0, 3).map((r) => r.content.substring(0, 150)),
            strategicAlignment: 0.82,
          },
          reasoning: `Generated ${alternatives.length} alternatives based on context analysis and best practices`,
          confidence: 0.78,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createValidationAgent(): AgentDefinition {
    return {
      id: "validation-agent",
      name: "Validation Agent",
      description: "Validates decisions for completeness, consistency, and compliance",
      capabilities: ["completeness_check", "consistency_validation", "compliance_verification"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();

        const parameters = input.parameters || {};
        const checks = {
          hasTitle: !!parameters.title,
          hasDescription: !!parameters.description,
          hasCategory: !!parameters.category,
          hasBudget: parameters.budget !== undefined,
          hasTimeline: !!parameters.timeline,
          hasOwner: !!parameters.owner,
          hasObjectives: Array.isArray(parameters.objectives) && parameters.objectives.length > 0,
        };

        const passedChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        const completenessScore = passedChecks / totalChecks;

        const validationErrors: string[] = [];
        if (!checks.hasTitle) validationErrors.push("Missing required field: title");
        if (!checks.hasDescription) validationErrors.push("Missing required field: description");
        if (!checks.hasCategory) validationErrors.push("Missing required field: category");
        if (!checks.hasBudget) validationErrors.push("Budget information not provided");

        const isValid = completenessScore >= 0.7 && validationErrors.length <= 1;

        return {
          success: true,
          result: {
            isValid,
            completenessScore,
            checks,
            validationErrors,
            recommendations: validationErrors.length > 0
              ? ["Complete all required fields before submission"]
              : ["Validation passed - ready for review"],
          },
          reasoning: `Validated ${passedChecks}/${totalChecks} required fields`,
          confidence: completenessScore,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  getExecutionHistory(limit: number = 10): typeof this.executionHistory {
    return this.executionHistory.slice(-limit);
  }

  getAgentExecutionHistory(agentId: string, limit: number = 10): typeof this.executionHistory {
    return this.executionHistory.filter(h => h.agentId === agentId).slice(-limit);
  }

  getAgentStats(): {
    totalAgents: number;
    activeAgents: number;
    totalExecutions: number;
    categories: Record<string, number>;
  } {
    const configs = Array.from(this.agentConfigs.values());
    const categories: Record<string, number> = {};
    for (const c of configs) {
      categories[c.category] = (categories[c.category] || 0) + 1;
    }
    return {
      totalAgents: this.agents.size,
      activeAgents: configs.filter(c => c.enabled).length,
      totalExecutions: configs.reduce((sum, c) => sum + c.executionCount, 0),
      categories,
    };
  }

  private createFinancialAnalysisAgent(): AgentDefinition {
    return {
      id: "financial-analysis-agent",
      name: "Financial Analysis Agent",
      description: "Performs NPV, IRR, ROI, and payback period analysis with scenario modeling for business cases",
      capabilities: ["npv_analysis", "irr_calculation", "roi_modeling", "scenario_analysis", "cost_benefit"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};

        // Use the unified financial model so agent outputs match the business-case financial view.
        const rawBudget = params.budget || params.totalCost || params.estimatedBudget || params.budgetRange || "";
        const timelineRaw = params.timeframe || params.timeline || params.timelineYears || "3 years";
        const discountRateRaw = Number(params.discountRate ?? 0.08);
        const industry = params.industryType || params.industry || "government";
        const urgency = params.urgency || "Medium";
        const projectName = params.projectName || params.title || "Project";
        const { computeUnifiedFinancialModel, detectArchetype, estimateInvestmentFromDemandContext } = await import("@domains/demand/infrastructure/financialModel");

        const demandContext: Record<string, unknown> = {
          suggestedProjectName: projectName,
          businessObjective: params.businessObjective || params.description || params.objective || "",
          problemStatement: params.problemStatement || params.currentChallenges || "",
          organizationName: params.organizationName || params.organization || "",
          department: params.department || industry,
          budgetRange: typeof rawBudget === "string" ? rawBudget : String(rawBudget || ""),
          estimatedBudget: params.estimatedBudget,
          timeframe: timelineRaw,
          urgency,
          integrationRequirements: params.integrationRequirements,
          complianceRequirements: params.complianceRequirements,
          keyStakeholders: params.stakeholders,
          riskFactors: params.riskFactors,
          expectedOutcomes: params.expectedOutcomes,
        };

        const archetype = detectArchetype({
          projectName,
          projectDescription: String(demandContext.businessObjective || ""),
          organization: String(demandContext.organizationName || ""),
          objectives: String(demandContext.businessObjective || ""),
          problemStatement: String(demandContext.problemStatement || ""),
        });

        const budget = estimateInvestmentFromDemandContext(demandContext, archetype) || this.parseBudgetAmount(rawBudget);
        const discountRate = Number.isFinite(discountRateRaw)
          ? (discountRateRaw > 1 ? discountRateRaw : discountRateRaw * 100)
          : 8;
        const adoptionRate = industry === "government" ? 0.78 : industry === "semi-government" ? 0.75 : 0.72;
        const maintenancePercent = /platform|crm|enterprise/i.test(projectName) ? 0.18 : 0.15;
        const contingencyPercent = urgency === "Critical" ? 0.15 : urgency === "High" ? 0.12 : 0.10;

        const unifiedModel = computeUnifiedFinancialModel({
          totalInvestment: budget,
          archetype,
          discountRate,
          adoptionRate,
          maintenancePercent,
          contingencyPercent,
          domainParameters: {},
        });

        const timeline = Math.max(1, Math.round(unifiedModel.cashFlows.length - 1));
        const paybackYears = Number.isFinite(unifiedModel.metrics.paybackMonths)
          ? Math.max(1, Math.round(unifiedModel.metrics.paybackMonths / 12))
          : timeline;
        const recurringCosts = unifiedModel.costs.filter((cost) => cost.isRecurring);
        const annualOpex = Math.round(recurringCosts.reduce((sum, cost) => sum + cost.year1, 0));
        const implementationCosts = {
          phase1_setup: Math.round(budget * 0.35),
          phase2_deployment: Math.round(budget * 0.40),
          phase3_optimization: Math.round(budget * 0.15),
          contingency: Math.round(budget * contingencyPercent),
        };
        const scenarios = Object.fromEntries(
          unifiedModel.scenarios.map((scenario) => [scenario.name, {
            npv: Math.round(scenario.npv),
            roi: Math.round(scenario.roi * 10) / 10,
            payback: Number.isFinite(scenario.paybackMonths) ? Math.max(1, Math.round(scenario.paybackMonths / 12)) : timeline,
            assumptions: `${scenario.label} scenario based on unified financial model assumptions`,
          }]),
        );
        const investmentGrade = unifiedModel.decision.verdict;

        return {
          success: true,
          result: {
            projectName,
            archetype,
            npv: Math.round(unifiedModel.metrics.npv),
            roi: Math.round(unifiedModel.metrics.roi * 10) / 10,
            paybackPeriod: paybackYears,
            paybackMonths: Number.isFinite(unifiedModel.metrics.paybackMonths) ? Math.round(unifiedModel.metrics.paybackMonths) : null,
            totalInvestment: budget,
            totalBenefits: Math.round(unifiedModel.metrics.totalBenefits),
            totalCostOfOwnership: Math.round(unifiedModel.metrics.totalCosts),
            annualOperatingCost: annualOpex,
            implementationCosts,
            cashFlows: unifiedModel.cashFlows.map((cashFlow) => Math.round(cashFlow.netCashFlow)),
            scenarios,
            recommendation: unifiedModel.decision.verdict,
            investmentGrade,
            governmentValue: unifiedModel.governmentValue,
            financialRiskIndicators: {
              budgetConcentration: budget > 5000000 ? "HIGH" : budget > 1000000 ? "MEDIUM" : "LOW",
              paybackWithinHorizon: Number.isFinite(unifiedModel.metrics.paybackMonths) && unifiedModel.metrics.paybackMonths <= timeline * 12,
              positiveNPV: unifiedModel.metrics.npv > 0,
              roiAboveThreshold: unifiedModel.metrics.roi > 15,
            },
          },
          reasoning: `Financial model for ${projectName}: archetype=${archetype}, NPV=${Math.round(unifiedModel.metrics.npv).toLocaleString()} AED, ROI=${Math.round(unifiedModel.metrics.roi)}%, Payback=${paybackYears}yr. Public value verdict: ${unifiedModel.governmentValue.label}. Investment verdict: ${unifiedModel.decision.label}.`,
          confidence: budget > 0 ? 0.85 : 0.50,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private parseBudgetAmount(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string" || !raw) return 1000000;
    const cleaned = raw.replace(/[^0-9.kmb]/gi, "").trim();
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 1000000;
    const lower = String(raw).toLowerCase();
    if (lower.includes("b") || lower.includes("billion")) return num * 1000000000;
    if (lower.includes("m") || lower.includes("million")) return num * 1000000;
    if (lower.includes("k") || lower.includes("thousand")) return num * 1000;
    return num;
  }

  private parseTimelineYears(raw: unknown): number {
    if (typeof raw === "number") return Math.max(1, Math.min(raw, 10));
    if (typeof raw !== "string" || !raw) return 5;
    const match = String(raw).match(/(\d+)/); 
    const num = match ? parseInt(match[1]!, 10) : 5;
    const lower = String(raw).toLowerCase();
    if (lower.includes("month")) return Math.max(1, Math.round(num / 12));
    return Math.max(1, Math.min(num, 10));
  }

  private createMarketResearchAgent(): AgentDefinition {
    return {
      id: "market-research-agent",
      name: "Market Research Agent",
      description: "Analyzes market trends, competitive landscape, supplier ecosystem, and technology adoption patterns",
      capabilities: ["market_analysis", "competitive_intelligence", "supplier_assessment", "technology_trends"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const projectName = params.projectName || params.title || "Project";
        const objective = params.businessObjective || params.description || params.objective || "";
        const industry = params.industryType || params.industry || "government";
        const domain = params.domain || params.category || "digital transformation";

        const ragResponse = await ragGateway.retrieve({
          query: `market analysis trends ${domain} ${objective} ${industry} government enterprise UAE`,
          context: { domain: "market_research", intent: input.task },
          classificationLevel: input.context.classificationLevel,
          maxResults: 5,
        });

        // Derive market segments from project context
        const objLower = String(objective).toLowerCase();
        const segments: Array<{ segment: string; growth: string; maturity: string; relevance: number }> = [];

        if (/cloud|saas|paas|iaas|infrastructure/i.test(objLower))
          segments.push({ segment: "Cloud Infrastructure & Services", growth: "18.2%", maturity: "Scaling", relevance: 0.92 });
        if (/ai|machine learn|deep learn|nlp|generative|llm/i.test(objLower))
          segments.push({ segment: "AI/ML Services", growth: "35.7%", maturity: "Emerging", relevance: 0.95 });
        if (/erp|crm|hrm|procurement|finance/i.test(objLower))
          segments.push({ segment: "Enterprise Applications (ERP/CRM)", growth: "8.5%", maturity: "Mature", relevance: 0.88 });
        if (/cyber|security|identity|access|zero.?trust/i.test(objLower))
          segments.push({ segment: "Cybersecurity Solutions", growth: "14.8%", maturity: "Growing", relevance: 0.90 });
        if (/data|analytics|bi|warehouse|lake/i.test(objLower))
          segments.push({ segment: "Data Analytics & BI", growth: "22.3%", maturity: "Growing", relevance: 0.87 });
        if (/iot|sensor|smart|device|edge/i.test(objLower))
          segments.push({ segment: "IoT & Smart Infrastructure", growth: "25.1%", maturity: "Emerging", relevance: 0.82 });
        if (/portal|website|digital.?service|citizen|e.?gov/i.test(objLower))
          segments.push({ segment: "Digital Government Services", growth: "15.6%", maturity: "Growing", relevance: 0.90 });

        // Default segments if nothing matched
        if (segments.length === 0) {
          segments.push(
            { segment: "Enterprise Software", growth: "12.5%", maturity: "Growing", relevance: 0.80 },
            { segment: "Cloud Infrastructure", growth: "18.2%", maturity: "Scaling", relevance: 0.75 },
            { segment: "Digital Transformation Services", growth: "16.8%", maturity: "Growing", relevance: 0.78 },
          );
        }

        // Technology readiness based on domain
        const isEmergingTech = /ai|blockchain|quantum|generative|iot/i.test(objLower);
        const trl = isEmergingTech ? "TRL-5 to TRL-7" : "TRL-7 to TRL-9";
        const adoption = isEmergingTech ? "Early Adopter" : "Early Majority";

        return {
          success: true,
          result: {
            projectName,
            domain,
            industry,
            marketSegments: segments,
            competitiveLandscape: {
              totalVendors: ragResponse.results.length + 8,
              marketConcentration: segments.some(s => parseFloat(s.growth) > 20) ? "fragmented" : "moderate",
              uaeMarketContext: `UAE ${industry} sector — active digital transformation with government-backed initiatives`,
            },
            technologyReadiness: {
              level: trl,
              adoptionRate: adoption,
              riskProfile: isEmergingTech ? "Medium-High" : "Low-Medium",
            },
            recommendations: [
              `Evaluate UAE-based suppliers for ${domain} to support local content requirements`,
              "Consider vendor lock-in risk mitigation through open standards and API-first design",
              industry === "government" ? "Leverage existing government cloud (G-Cloud) frameworks for hosting" : "Assess private cloud options meeting UAE data residency requirements",
              segments.length > 2 ? "Multi-segment opportunity — consider phased approach targeting highest-relevance segments first" : "",
              isEmergingTech ? "Pilot emerging technology with proof-of-concept before full-scale deployment" : "",
            ].filter(Boolean),
            supportingEvidence: ragResponse.results.slice(0, 3).map(r => r.content.substring(0, 200)),
          },
          reasoning: `Market analysis for ${projectName} in ${domain}: ${segments.length} relevant market segments identified. Technology readiness: ${trl}, adoption stage: ${adoption}. ${ragResponse.results.length} supporting documents retrieved.`,
          confidence: ragResponse.results.length > 0 ? 0.78 : 0.65,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createComplianceCheckAgent(): AgentDefinition {
    return {
      id: "compliance-check-agent",
      name: "Compliance Check Agent",
      description: "Validates regulatory compliance, data sovereignty requirements, and government procurement standards",
      capabilities: ["regulatory_compliance", "data_sovereignty", "procurement_validation", "standards_check"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const budget = this.parseBudgetAmount(params.budget || params.budgetRange || params.estimatedBudget || 0);
        const classification = input.context.classificationLevel || "internal";
        const industry = params.industryType || params.industry || "government";
        const projectName = params.projectName || params.title || "Project";
        const complianceReqs = params.complianceRequirements || "";
        const existingSystems = params.existingSystems || "";
        const integrationReqs = params.integrationRequirements || "";

        const ragResponse = await ragGateway.retrieve({
          query: `compliance regulatory standards government procurement ${input.task} ${complianceReqs}`,
          context: { domain: "compliance", intent: input.task },
          classificationLevel: input.context.classificationLevel,
          maxResults: 5,
        });

        // Data sovereignty assessment based on classification
        const dataSovereigntyStatus = classification === "sovereign" || classification === "confidential"
          ? "requires_review"
          : "compliant";
        const dataSovereigntyDetails = classification === "sovereign"
          ? `${projectName}: Sovereign-classified data MUST remain on UAE-hosted infrastructure per TDRA/NESA regulations`
          : classification === "confidential"
            ? `${projectName}: Confidential data requires UAE-resident hosting and encrypted transit per NESA standards`
            : `${projectName}: Internal data — standard UAE hosting policies apply`;

        // Procurement threshold (UAE government procurement regulations)
        const procStatus = budget > 5000000 ? "requires_review" : budget > 1000000 ? "conditional" : "compliant";
        const procDetails = budget > 5000000
          ? `Budget ${Math.round(budget / 1000000)}M AED exceeds threshold — requires open tender and Higher Purchase Committee approval`
          : budget > 1000000
            ? `Budget ${Math.round(budget / 1000000)}M AED — requires competitive quotation process per Federal Decree-Law No. 44/2024`
            : `Budget within direct purchase threshold — standard procurement process applies`;

        // Integration compliance
        const integrationStatus = integrationReqs || existingSystems ? "requires_review" : "compliant";
        const integrationDetails = integrationReqs || existingSystems
          ? `Integration with existing systems identified — interoperability and data flow assessment needed`
          : `No legacy integration identified — greenfield compliance pathway`;

        const checks: Record<string, { status: string; details: string; regulation?: string }> = {
          dataSovereignty: {
            status: dataSovereigntyStatus,
            details: dataSovereigntyDetails,
            regulation: "UAE Federal Decree-Law No. 45/2021 (Data Protection), NESA Information Assurance Standards",
          },
          procurementStandards: {
            status: procStatus,
            details: procDetails,
            regulation: "UAE Federal Decree-Law No. 44/2024 (Government Procurement)",
          },
          accessibilityStandards: {
            status: "compliant",
            details: `${projectName}: WCAG 2.1 AA compliance pathway identified for digital interfaces`,
            regulation: "UAE Digital Government Standards",
          },
          securityFramework: {
            status: classification === "sovereign" ? "requires_review" : "compliant",
            details: classification === "sovereign"
              ? `${projectName}: Enhanced security assessment required for sovereign classification — NESA ISR/IIA alignment mandatory`
              : `${projectName}: Standard security framework alignment (NESA baseline controls)`,
            regulation: "NESA UAE Information Security Regulations (ISR)",
          },
          privacyRegulations: {
            status: "compliant",
            details: `${projectName}: Personal data handling procedures aligned with UAE Data Protection Law`,
            regulation: "UAE Federal Decree-Law No. 45/2021",
          },
          systemIntegration: {
            status: integrationStatus,
            details: integrationDetails,
            regulation: "TDRA Digital Government Interoperability Framework",
          },
        };

        const complianceScore = Object.values(checks).filter(c => c.status === "compliant").length / Object.keys(checks).length;
        const issues = Object.entries(checks)
          .filter(([, v]) => v.status !== "compliant")
          .map(([k, v]) => `${k}: ${v.details}${v.regulation ? ` [Ref: ${v.regulation}]` : ""}`);

        return {
          success: true,
          result: {
            projectName,
            industry,
            classificationLevel: classification,
            overallCompliance: complianceScore >= 0.8 ? "COMPLIANT" : complianceScore >= 0.5 ? "CONDITIONAL" : "NON_COMPLIANT",
            complianceScore: Math.round(complianceScore * 100),
            checks,
            issues,
            recommendations: [
              ...issues.map(issue => `Review: ${issue.split(":")[0]}`),
              ...(budget > 5000000 ? ["Engage Government Procurement Office for tender process"] : []),
              ...(classification === "sovereign" ? ["Complete NESA Information Assurance Assessment before procurement"] : []),
              ...(complianceReqs ? [`Address explicit compliance requirements: ${String(complianceReqs).substring(0, 100)}`] : []),
              issues.length === 0 ? "Full compliance verified — proceed with standard governance" : "",
            ].filter(Boolean),
            supportingPolicies: ragResponse.results.slice(0, 3).map(r => ({
              source: r.source,
              relevance: r.score,
            })),
            applicableRegulations: [
              "UAE Federal Decree-Law No. 45/2021 (Data Protection)",
              "UAE Federal Decree-Law No. 44/2024 (Government Procurement)",
              "NESA Information Security Regulations (ISR)",
              "TDRA Digital Government Standards",
              ...(industry === "government" ? ["UAE Vision 2031 Digital Government Framework"] : []),
            ],
          },
          reasoning: `Compliance evaluation for ${projectName}: ${Math.round(complianceScore * 100)}% across ${Object.keys(checks).length} regulatory dimensions. ${issues.length} areas require attention. Classification: ${classification}.`,
          confidence: ragResponse.results.length > 0 ? 0.88 : 0.75,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createStrategicAlignmentAgent(): AgentDefinition {
    return {
      id: "strategic-alignment-agent",
      name: "Strategic Alignment Agent",
      description: "Evaluates alignment with organizational strategy, UAE Vision 2031/2071, and digital transformation objectives",
      capabilities: ["vision_alignment", "strategic_scoring", "transformation_assessment", "objective_mapping"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const projectName = params.projectName || params.title || "Project";
        const objective = params.businessObjective || params.description || params.objective || "";
        const department = params.department || "";
        const industry = params.industryType || params.industry || "government";
        const urgency = params.urgency || "Medium";
        const successCriteria = params.successCriteria || "";
        const existingSystems = params.existingSystems || "";

        const ragResponse = await ragGateway.retrieve({
          query: `strategic alignment vision objectives ${objective} ${projectName} ${department}`,
          context: { domain: "strategy", intent: input.task },
          classificationLevel: input.context.classificationLevel,
          maxResults: 5,
        });

        // Score dimensions based on actual project characteristics
        const objectiveLower = String(objective).toLowerCase();
        const hasDigitalKeywords = /digital|automat|ai|machine learn|cloud|platform|data|smart|iot/i.test(objectiveLower);
        const hasServiceKeywords = /citizen|public|service|portal|customer|experience|user/i.test(objectiveLower);
        const hasEfficiencyKeywords = /efficien|optim|streamlin|reduc|improv|enhanc|transform/i.test(objectiveLower);
        const hasDataKeywords = /data|analytics|intelligence|insight|dashboard|report|bi/i.test(objectiveLower);
        const hasSustainability = /sustain|green|energy|carbon|environment/i.test(objectiveLower);
        const hasInnovation = /innovat|emerging|blockchain|ai|generative|disrupt/i.test(objectiveLower);

        const alignmentDimensions: Record<string, { score: number; weight: number; rationale: string }> = {
          digitalTransformation: {
            score: hasDigitalKeywords ? 0.90 : hasEfficiencyKeywords ? 0.72 : 0.55,
            weight: 0.25,
            rationale: hasDigitalKeywords
              ? `${projectName} directly advances digital transformation through technology-driven modernization`
              : `${projectName} contributes indirectly to digital transformation via operational improvement`,
          },
          operationalExcellence: {
            score: hasEfficiencyKeywords ? 0.85 : existingSystems ? 0.70 : 0.55,
            weight: 0.20,
            rationale: hasEfficiencyKeywords
              ? `${projectName} targets operational efficiency and process optimization`
              : `${projectName} supports operational continuity with standard improvement potential`,
          },
          citizenExperience: {
            score: hasServiceKeywords ? 0.88 : industry === "government" ? 0.65 : 0.50,
            weight: 0.20,
            rationale: hasServiceKeywords
              ? `${projectName} directly improves citizen/public service delivery`
              : `${projectName} has indirect impact on public-facing services`,
          },
          dataIntelligence: {
            score: hasDataKeywords ? 0.92 : hasDigitalKeywords ? 0.70 : 0.50,
            weight: 0.15,
            rationale: hasDataKeywords
              ? `${projectName} leverages data analytics for evidence-based decision making`
              : `${projectName} generates data assets that can be leveraged for insights`,
          },
          sustainability: {
            score: hasSustainability ? 0.85 : 0.55,
            weight: 0.10,
            rationale: hasSustainability
              ? `${projectName} contributes to UAE sustainability and environmental goals`
              : `${projectName} has neutral environmental impact — sustainability practices can be incorporated`,
          },
          innovation: {
            score: hasInnovation ? 0.90 : hasDigitalKeywords ? 0.72 : 0.50,
            weight: 0.10,
            rationale: hasInnovation
              ? `${projectName} introduces innovative technology and approaches`
              : `${projectName} uses established approaches with room for innovative enhancements`,
          },
        };

        const overallAlignment = Object.values(alignmentDimensions)
          .reduce((sum, d) => sum + d.score * d.weight, 0);

        const gaps = Object.entries(alignmentDimensions)
          .filter(([, v]) => v.score < 0.65)
          .map(([k, v]) => ({
            dimension: k,
            currentScore: Math.round(v.score * 100),
            targetScore: 80,
            gap: Math.round((0.8 - v.score) * 100),
            recommendation: v.rationale,
          }));

        const visionAlignment = {
          uaeVision2031: overallAlignment >= 0.7 ? "ALIGNED" : "PARTIAL",
          digitalGovernment: hasDigitalKeywords ? "STRONG" : "MODERATE",
          centennialPlan2071: hasInnovation ? "CONTRIBUTING" : "NEUTRAL",
          nationalAIStrategy: hasDataKeywords || hasInnovation ? "ALIGNED" : "INDIRECT",
        };

        return {
          success: true,
          result: {
            projectName,
            department,
            overallAlignment: Math.round(overallAlignment * 100),
            alignmentGrade: overallAlignment >= 0.80 ? "STRONG" : overallAlignment >= 0.65 ? "MODERATE" : "WEAK",
            dimensions: alignmentDimensions,
            gaps,
            visionAlignment,
            strategicFit: overallAlignment >= 0.75 ? "HIGH_FIT" : overallAlignment >= 0.55 ? "MODERATE_FIT" : "LOW_FIT",
            recommendations: [
              ...(gaps.length > 0 ? [`Strengthen alignment in: ${gaps.map(g => g.dimension).join(", ")}`] : []),
              ...(urgency === "Critical" ? [`${projectName} urgency supports fast-track strategic approval`] : []),
              ...(successCriteria ? [`Map success criteria to strategic KPIs: ${String(successCriteria).substring(0, 80)}`] : []),
              "Ensure continuous strategic alignment monitoring post-implementation",
              `Review ${projectName} outcomes against UAE Vision 2031 indicators quarterly`,
            ],
            supportingEvidence: ragResponse.results.slice(0, 3).map(r => r.content.substring(0, 200)),
          },
          reasoning: `Strategic alignment for ${projectName}: ${Math.round(overallAlignment * 100)}% across ${Object.keys(alignmentDimensions).length} dimensions. ${gaps.length} gaps identified. Vision 2031 alignment: ${visionAlignment.uaeVision2031}. Strategic fit: ${overallAlignment >= 0.75 ? "HIGH" : overallAlignment >= 0.55 ? "MODERATE" : "LOW"}.`,
          confidence: ragResponse.results.length > 0 ? 0.82 : 0.70,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createEnterpriseArchitectureAgent(): AgentDefinition {
    return {
      id: "enterprise-architecture-agent",
      name: "Enterprise Architecture Agent",
      description: "Builds actionable target architecture guidance across application, domain, integration, data, and infrastructure layers",
      capabilities: ["application_architecture", "domain_modeling", "integration_design", "data_architecture", "infrastructure_patterns"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const objective = String(params.businessObjective || params.description || "");
        const integrations = Array.isArray(params.integrationRequirements) ? params.integrationRequirements : [];
        const constraints = Array.isArray(params.constraints) ? params.constraints : [];
        const existingSystems = Array.isArray(params.existingSystems) ? params.existingSystems : [];

        const objectiveLower = objective.toLowerCase();
        const apiFirst = /api|integration|platform|service/i.test(objectiveLower);
        const eventDriven = /real[- ]?time|event|stream/i.test(objectiveLower);
        const dataIntensive = /data|analytics|insight|dashboard|report/i.test(objectiveLower);

        const targetPatterns = [
          apiFirst ? "API-first service boundaries with versioned contracts" : "Domain-aligned service boundaries",
          eventDriven ? "Event-driven integration for asynchronous coordination" : "Hybrid sync/async integration model",
          dataIntensive ? "Governed analytical + operational data stores" : "Transactional-first data architecture",
          "Layered architecture (API / app / domain / infra) with clear ownership",
        ];

        return {
          success: true,
          result: {
            architectureReadiness: apiFirst || eventDriven ? "advanced" : "baseline",
            recommendedPatterns: targetPatterns,
            applicationLayer: {
              principles: [
                "Bounded-context services",
                "Consumer-focused API contracts",
                "Versioned interface governance",
              ],
              integrationRequirements: integrations,
            },
            domainLayer: {
              aggregates: ["Demand", "BusinessCase", "Requirements", "EnterpriseArchitecture", "StrategicFit"],
              constraints,
            },
            dataLayer: {
              sourceSystems: existingSystems,
              governance: ["Data classification tagging", "Lineage and auditability", "PII minimization controls"],
            },
            infrastructureLayer: {
              deploymentModel: "Secure cloud-native with policy-enforced runtime",
              controls: ["Zero-trust service communication", "Observability by default", "Backup and continuity by design"],
            },
          },
          reasoning: "Generated target EA guidance from demand context, integration requirements, and constraints with API/app/domain/infra alignment.",
          confidence: 0.84,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createQualityGateAgent(): AgentDefinition {
    return {
      id: "quality-gate-agent",
      name: "Quality Gate Agent",
      description: "Adjudicates advisory quality and safety: required sections, evidence sufficiency, and policy-risk flags",
      capabilities: ["quality_gate", "evidence_validation", "policy_safety_check", "revision_trigger"],
      requiredClassification: "internal",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};

        const hasTitle = Boolean(params.title);
        const hasDescription = Boolean(params.description);
        const hasBudget = params.budget != null && params.budget !== "";
        const hasTimeline = Boolean(params.timeline);
        const evidenceCount = Array.isArray(params.evidence) ? params.evidence.length : 0;
        const hasEvidence = evidenceCount > 0;

        const missingSections: string[] = [];
        if (!hasTitle) missingSections.push("title");
        if (!hasDescription) missingSections.push("description");
        if (!hasBudget) missingSections.push("budget");
        if (!hasTimeline) missingSections.push("timeline");

        const policyFlags: string[] = [];
        const classification = String(input.context.classificationLevel || "internal").toLowerCase();
        if ((classification === "sovereign" || classification === "confidential") && params.externalModelUsed === true) {
          policyFlags.push("external_model_not_allowed_for_classification");
        }
        if (!hasEvidence) {
          policyFlags.push("insufficient_evidence");
        }

        const qualityScore = Math.max(
          0,
          Math.min(
            100,
            100
            - missingSections.length * 15
            - (hasEvidence ? 0 : 20)
            - policyFlags.length * 10
          )
        );

        const shouldRevise = missingSections.length > 0 || policyFlags.length > 0 || qualityScore < 70;

        return {
          success: true,
          result: {
            qualityScore,
            missingSections,
            policyFlags,
            evidenceCount,
            verdict: shouldRevise ? "REVISION_REQUIRED" : "PASS",
            recommendedActions: shouldRevise
              ? [
                  "Fill missing sections",
                  "Attach supporting evidence",
                  "Re-run policy-safe generation path",
                ]
              : ["Quality gate passed"],
          },
          reasoning: shouldRevise
            ? `Quality gate failed with ${missingSections.length} missing sections and ${policyFlags.length} safety flags`
            : `Quality gate passed with score ${qualityScore}`,
          confidence: 0.9,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createRequirementExtractorAgent(): AgentDefinition {
    return {
      id: "requirement-extractor-agent",
      name: "Requirement Extractor Agent",
      description: "Extracts structured capabilities and requirements from demand and business-case context",
      capabilities: ["capability_extraction", "functional_requirements", "nonfunctional_requirements", "security_requirements"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const title = String(params.title || params.projectName || "Initiative");
        const objective = String(params.description || params.businessObjective || "");
        const department = String(params.category || params.department || "Business");
        const integrationRequirements = Array.isArray(params.integrationRequirements)
          ? params.integrationRequirements.map((item: unknown) => String(item)).filter(Boolean)
          : typeof params.integrationRequirements === "string"
            ? params.integrationRequirements.split(/[;,\n]+/).map((item: string) => item.trim()).filter(Boolean)
            : [];
        const complianceRequirements = Array.isArray(params.complianceRequirements)
          ? params.complianceRequirements.map((item: unknown) => String(item)).filter(Boolean)
          : typeof params.complianceRequirements === "string"
            ? params.complianceRequirements.split(/[;,\n]+/).map((item: string) => item.trim()).filter(Boolean)
            : [];

        return {
          success: true,
          result: {
            capabilities: [
              {
                name: `${title} workflow enablement`,
                description: `Support ${department} teams in capturing, reviewing, and progressing ${title}`,
                priority: "High",
                reasoning: "Core workflow control is required before automation and reporting provide value",
              },
              {
                name: `${title} insight and reporting`,
                description: `Provide KPI visibility and role-based reporting aligned to ${objective || title}`,
                priority: "High",
                reasoning: "Decision makers need measurable outcomes and status visibility",
              },
            ],
            functionalRequirements: [
              {
                id: "FR-001",
                requirement: `The platform shall support end-to-end lifecycle management for ${title}`,
                description: `Users must be able to create, review, approve, and track ${title} work items`,
                category: "Core Workflow",
                priority: "High",
                acceptanceCriteria: [
                  "Users can create and update requests",
                  "Lifecycle status transitions are visible and auditable",
                ],
                bestPractice: "Use explicit workflow states and ownership handoffs",
              },
              {
                id: "FR-002",
                requirement: `The platform shall maintain structured requirement outputs for ${title}`,
                description: `Capabilities and requirements must be generated and editable in organized sections`,
                category: "Requirements Management",
                priority: "High",
                acceptanceCriteria: [
                  "Requirements can be generated from demand context",
                  "Generated outputs can be refined before approval",
                ],
                bestPractice: "Keep requirements normalized by section and priority",
              },
              {
                id: "FR-003",
                requirement: `The platform shall capture integration and compliance requirements for ${title}`,
                description: `The solution must store external dependencies and governance obligations in structured form`,
                category: "Governance",
                priority: "High",
                acceptanceCriteria: [
                  "Integration dependencies are recorded",
                  "Compliance obligations are visible to reviewers",
                ],
                bestPractice: "Track integrations and controls as first-class requirements",
              },
            ],
            nonFunctionalRequirements: [
              {
                id: "NFR-001",
                requirement: `The ${title} solution shall remain responsive for daily operational use`,
                category: "Performance",
                metric: "Core interactions complete in under 3 seconds",
                priority: "High",
                bestPractice: "Define measurable performance targets for primary journeys",
              },
              {
                id: "NFR-002",
                requirement: `The ${title} solution shall maintain resilience and recoverability`,
                category: "Reliability",
                metric: "99.5% availability with defined recovery procedures",
                priority: "Medium",
                bestPractice: "Align reliability targets with business criticality",
              },
            ],
            securityRequirements: [
              {
                id: "SR-001",
                requirement: `The ${title} solution shall enforce role-based access and auditability`,
                category: "Authorization",
                priority: "High",
                compliance: complianceRequirements[0] || "Organizational security policy",
                implementation: "Integrate with centralized identity and immutable audit logs",
              },
              {
                id: "SR-002",
                requirement: `The ${title} solution shall protect data at rest and in transit`,
                category: "Data Protection",
                priority: "High",
                compliance: complianceRequirements[1] || "Data protection standards",
                implementation: "Use encrypted transport, secure storage, and classified data handling",
              },
            ],
            capabilityGaps: integrationRequirements.slice(0, 3).map((req: string, index: number) => ({
              gap: `Integration dependency ${index + 1}`,
              currentState: "Captured at high level only",
              targetState: req,
              recommendation: `Define interface scope, ownership, and testing approach for ${req}`,
            })),
          },
          reasoning: `Extracted structured requirements for ${title} using available demand context and governance data.`,
          confidence: objective ? 0.84 : 0.68,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createProjectManagerAgent(): AgentDefinition {
    return {
      id: "project-manager-agent",
      name: "Project Manager Agent",
      description: "Builds the integrated delivery plan across phases, milestones, dependencies, resources, and immediate next actions",
      capabilities: ["delivery_planning", "phase_design", "milestone_planning", "dependency_coordination", "resource_governance"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const title = String(params.title || params.projectName || "Initiative");
        const owner = String(params.category || params.department || "PMO");
        const budget = String(params.budget || params.budgetRange || "To be confirmed");
        const description = String(params.description || params.businessObjective || "");
        const category = String(params.category || params.department || "");
        const objectives: string[] = Array.isArray(params.objectives)
          ? (params.objectives as string[])
          : typeof params.objectives === "string"
          ? [params.objectives as string]
          : [];

        // ── Derive context-specific phase vocabulary ─────────────────
        // Detect broad domain from title + description + category so phases
        // reflect what the project actually does rather than generic labels.
        const contextRaw = `${title} ${description} ${category} ${objectives.join(" ")}`.toLowerCase();

        const isInfrastructure = /infrastr|network|data.?cent|server|cloud|hosting|connectivity|fibre|cable/.test(contextRaw);
        const isDigitalTransformation = /digital|transform|portal|platform|app|mobile|e-service|system|automat|workflow|integrat/.test(contextRaw);
        const isProcurement = /procure|tender|rfp|contract|vendor|supplier|sourcing/.test(contextRaw);
        const isCapacity = /capacity|training|talent|workforce|human.?capital|capability|upskill|learning/.test(contextRaw);
        const isPolicy = /policy|regulat|legislat|framework|governance|standard|compliance|bylaw/.test(contextRaw);
        const isResearch = /research|study|feasibility|survey|pilot|proof.of.concept|poc/.test(contextRaw);
        const _isCivil = /civil|construct|build|facilit|road|bridge|infrastructure.project/.test(contextRaw);

        type Phase = {
          name: string;
          description: string;
          durationMonths: number;
          deliverables: string[];
          tasks: string[];
          owner: string;
          status: string;
        };

        let implementationPhases: Phase[];
        let milestones: Array<{ name: string; phase: string }>;
        let nextSteps: Array<{ action: string; owner: string; timeline: string; priority: string }>;

        if (isInfrastructure) {
          implementationPhases = [
            {
              name: "Assessment & Architecture",
              description: `Assess current infrastructure, define target architecture, and obtain approvals for ${title}`,
              durationMonths: 2,
              deliverables: ["Current-state assessment", "Target architecture blueprint", "Capacity plan"],
              tasks: ["Site survey", "Architecture review", "Risk identification", "Approval gate"],
              owner, status: "pending",
            },
            {
              name: "Procurement & Mobilisation",
              description: `Source, procure, and mobilise all hardware, software, and services for ${title}`,
              durationMonths: 3,
              deliverables: ["Vendor contracts", "Hardware delivery schedule", "Team mobilisation plan"],
              tasks: ["RFP / sourcing", "Contract award", "Hardware delivery", "Team setup"],
              owner, status: "pending",
            },
            {
              name: "Installation & Integration",
              description: `Install, configure, and integrate all infrastructure components for ${title}`,
              durationMonths: 4,
              deliverables: ["Installed infrastructure", "Integration test results", "Security hardening report"],
              tasks: ["Physical/cloud installation", "Network configuration", "Security hardening", "Integration testing"],
              owner, status: "pending",
            },
            {
              name: "Commissioning & Handover",
              description: `Commission live infrastructure, complete user acceptance, and hand over to operations for ${title}`,
              durationMonths: 2,
              deliverables: ["Commissioning certificate", "UAT sign-off", "Operations runbook"],
              tasks: ["Load testing", "UAT", "Operations training", "Formal handover"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Architecture Approved", phase: "Assessment & Architecture" },
            { name: "Contracts Awarded", phase: "Procurement & Mobilisation" },
            { name: "Integration Testing Passed", phase: "Installation & Integration" },
            { name: "Go-Live & Handover", phase: "Commissioning & Handover" },
          ];
          nextSteps = [
            { action: "Commission current-state infrastructure assessment and gap analysis", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Initiate procurement process and vendor shortlist", owner, timeline: "Week 3-4", priority: "High" },
          ];
        } else if (isProcurement) {
          implementationPhases = [
            {
              name: "Requirements & Market Scan",
              description: `Define procurement requirements and scan market options for ${title}`,
              durationMonths: 1,
              deliverables: ["Requirements specification", "Market survey", "Approved procurement plan"],
              tasks: ["Needs analysis", "Market consultation", "Approval gate"],
              owner, status: "pending",
            },
            {
              name: "Tender & Evaluation",
              description: `Issue tender documents, evaluate bids, and select supplier for ${title}`,
              durationMonths: 2,
              deliverables: ["RFP / tender package", "Evaluation scorecard", "Award recommendation"],
              tasks: ["RFP issuance", "Bid evaluation", "Reference checks", "Award recommendation"],
              owner, status: "pending",
            },
            {
              name: "Contracting & Onboarding",
              description: `Finalise contracts, onboard supplier, and establish governance for ${title}`,
              durationMonths: 2,
              deliverables: ["Signed contract", "Supplier onboarding checklist", "SLA baseline"],
              tasks: ["Contract negotiation", "Legal review", "Supplier onboarding", "SLA kick-off"],
              owner, status: "pending",
            },
            {
              name: "Delivery & Contract Management",
              description: `Oversee supplier delivery, monitor SLAs, and close the contract lifecycle for ${title}`,
              durationMonths: 3,
              deliverables: ["Delivery acceptance record", "SLA performance report", "Contract closure certificate"],
              tasks: ["Milestone verification", "SLA monitoring", "Issue resolution", "Contract closure"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Procurement Plan Approved", phase: "Requirements & Market Scan" },
            { name: "Supplier Selected", phase: "Tender & Evaluation" },
            { name: "Contract Signed", phase: "Contracting & Onboarding" },
            { name: "Delivery Accepted", phase: "Delivery & Contract Management" },
          ];
          nextSteps = [
            { action: "Finalise requirements specification and procurement plan for approval", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Engage legal and compliance for contract template readiness", owner, timeline: "Week 2-3", priority: "High" },
          ];
        } else if (isCapacity) {
          implementationPhases = [
            {
              name: "Needs Assessment & Design",
              description: `Identify capability gaps and design the learning & development programme for ${title}`,
              durationMonths: 2,
              deliverables: ["Skills gap report", "Programme design", "Curriculum outline"],
              tasks: ["Stakeholder interviews", "Skills assessment", "Learning-design sign-off"],
              owner, status: "pending",
            },
            {
              name: "Content Development & Pilot",
              description: `Develop training materials, run pilot cohort, and refine based on feedback for ${title}`,
              durationMonths: 3,
              deliverables: ["Training content package", "Pilot delivery report", "Refined curriculum"],
              tasks: ["Content development", "Facilitator training", "Pilot delivery", "Feedback analysis"],
              owner, status: "pending",
            },
            {
              name: "Rollout & Delivery",
              description: `Scale programme delivery across all target cohorts for ${title}`,
              durationMonths: 4,
              deliverables: ["Training completion records", "Competency assessment results", "Attendance reports"],
              tasks: ["Scheduled cohort delivery", "Competency assessment", "Completion tracking"],
              owner, status: "pending",
            },
            {
              name: "Evaluation & Embedding",
              description: `Evaluate programme effectiveness and embed capability into operations for ${title}`,
              durationMonths: 2,
              deliverables: ["Kirkpatrick evaluation report", "Improvement plan", "Embedding roadmap"],
              tasks: ["Effectiveness evaluation", "Lessons learned", "Embedding actions"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Programme Design Approved", phase: "Needs Assessment & Design" },
            { name: "Pilot Completed", phase: "Content Development & Pilot" },
            { name: "Full Rollout Delivered", phase: "Rollout & Delivery" },
            { name: "Evaluation Report Issued", phase: "Evaluation & Embedding" },
          ];
          nextSteps = [
            { action: "Commission skills gap assessment and stakeholder alignment workshops", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Identify facilitators and content development resources", owner, timeline: "Week 2-3", priority: "High" },
          ];
        } else if (isPolicy) {
          implementationPhases = [
            {
              name: "Research & Benchmarking",
              description: `Research current state, international benchmarks, and stakeholder positions for ${title}`,
              durationMonths: 2,
              deliverables: ["Research report", "Benchmarking summary", "Stakeholder mapping"],
              tasks: ["Literature review", "Comparative study", "Stakeholder interviews"],
              owner, status: "pending",
            },
            {
              name: "Drafting & Consultation",
              description: `Develop policy/framework draft and conduct structured consultation for ${title}`,
              durationMonths: 3,
              deliverables: ["Draft policy / framework", "Consultation summary", "Revised draft"],
              tasks: ["Policy drafting", "Expert review", "Stakeholder consultation", "Revision cycle"],
              owner, status: "pending",
            },
            {
              name: "Approval & Endorsement",
              description: `Submit for formal approval through governance channels for ${title}`,
              durationMonths: 2,
              deliverables: ["Approval submission package", "Endorsed policy / framework", "Gazette / publication"],
              tasks: ["Legal review", "Leadership endorsement", "Formal approval", "Publication"],
              owner, status: "pending",
            },
            {
              name: "Implementation & Compliance",
              description: `Communicate, implement, and monitor compliance with the approved policy for ${title}`,
              durationMonths: 3,
              deliverables: ["Communication plan execution", "Implementation guidance", "Compliance monitoring report"],
              tasks: ["Awareness campaign", "Implementation guides", "Compliance tracking", "Review cycle"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Research Report Issued", phase: "Research & Benchmarking" },
            { name: "Draft Policy Approved for Consultation", phase: "Drafting & Consultation" },
            { name: "Policy Formally Endorsed", phase: "Approval & Endorsement" },
            { name: "Compliance Monitoring Live", phase: "Implementation & Compliance" },
          ];
          nextSteps = [
            { action: "Initiate research and international benchmarking process", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Map and engage key stakeholders for consultation planning", owner, timeline: "Week 2-3", priority: "High" },
          ];
        } else if (isResearch) {
          implementationPhases = [
            {
              name: "Study Design & Ethics",
              description: `Define research methodology, scope, and obtain ethics/governance approval for ${title}`,
              durationMonths: 2,
              deliverables: ["Study design document", "Ethics/governance approval", "Data collection plan"],
              tasks: ["Methodology definition", "Ethics submission", "Data plan sign-off"],
              owner, status: "pending",
            },
            {
              name: "Data Collection & Analysis",
              description: `Execute data collection, primary and secondary analysis for ${title}`,
              durationMonths: 4,
              deliverables: ["Raw data set", "Analysis report", "Interim findings brief"],
              tasks: ["Data collection", "Statistical analysis", "Expert review", "Interim findings"],
              owner, status: "pending",
            },
            {
              name: "Findings & Recommendations",
              description: `Synthesise findings, develop recommendations, and validate with stakeholders for ${title}`,
              durationMonths: 2,
              deliverables: ["Final research report", "Recommendations brief", "Stakeholder validation record"],
              tasks: ["Report drafting", "Peer review", "Stakeholder validation"],
              owner, status: "pending",
            },
            {
              name: "Dissemination & Adoption",
              description: `Publish findings and support adoption of recommendations from ${title}`,
              durationMonths: 2,
              deliverables: ["Published report / paper", "Adoption plan", "Policy/operational briefing"],
              tasks: ["Publication", "Briefing sessions", "Adoption tracking"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Study Design Approved", phase: "Study Design & Ethics" },
            { name: "Data Collection Completed", phase: "Data Collection & Analysis" },
            { name: "Final Report Issued", phase: "Findings & Recommendations" },
            { name: "Findings Published", phase: "Dissemination & Adoption" },
          ];
          nextSteps = [
            { action: "Finalise study design document and submit for ethics review", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Establish data collection protocols and sourcing plan", owner, timeline: "Week 2-4", priority: "High" },
          ];
        } else if (isDigitalTransformation) {
          implementationPhases = [
            {
              name: "Discovery & Blueprint",
              description: `Map current processes, define target digital architecture, and align stakeholders for ${title}`,
              durationMonths: 2,
              deliverables: ["As-is process maps", "Digital blueprint", "Approved requirements"],
              tasks: ["Process mapping", "Requirements workshops", "Architecture blueprint", "Stakeholder sign-off"],
              owner, status: "pending",
            },
            {
              name: "Design & Configure",
              description: `Design the solution, configure the platform, and prepare the integration layer for ${title}`,
              durationMonths: 3,
              deliverables: ["Solution design document", "Configured platform", "Integration specification"],
              tasks: ["UX/UI design", "Platform configuration", "Integration design", "Design sign-off"],
              owner, status: "pending",
            },
            {
              name: "Build, Test & Integrate",
              description: `Build custom components, run system and integration tests, and complete UAT for ${title}`,
              durationMonths: 3,
              deliverables: ["Tested solution", "Integration test report", "UAT sign-off"],
              tasks: ["Development", "System testing", "Integration testing", "User acceptance testing"],
              owner, status: "pending",
            },
            {
              name: "Launch, Adopt & Stabilise",
              description: `Go live, drive user adoption, provide hypercare, and transition to BAU for ${title}`,
              durationMonths: 2,
              deliverables: ["Live solution", "Adoption metrics report", "BAU transition plan"],
              tasks: ["Go-live", "User onboarding", "Hypercare support", "Performance monitoring"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Blueprint Approved", phase: "Discovery & Blueprint" },
            { name: "Solution Design Sign-off", phase: "Design & Configure" },
            { name: "UAT Passed", phase: "Build, Test & Integrate" },
            { name: "Go-Live & BAU Handover", phase: "Launch, Adopt & Stabilise" },
          ];
          nextSteps = [
            { action: "Initiate process-mapping workshops with business and IT leads", owner, timeline: "Week 1-2", priority: "High" },
            { action: "Confirm platform selection and integration architecture", owner, timeline: "Week 2-4", priority: "High" },
          ];
        } else {
          // Contextual generic fallback — still uses project-specific language
          const focusArea = objectives[0]
            ? objectives[0].replace(/^(to |the )/i, "").slice(0, 60)
            : description.slice(0, 60) || title;
          implementationPhases = [
            {
              name: "Initiation & Scope",
              description: `Define scope, governance, and success criteria for ${title}`,
              durationMonths: 2,
              deliverables: [`Approved project charter for ${title}`, "Stakeholder register", "Scope baseline"],
              tasks: ["Sponsor alignment", "Scope workshop", "Governance setup", "Charter approval"],
              owner, status: "pending",
            },
            {
              name: "Planning & Design",
              description: `Develop the delivery plan and design the solution to achieve: ${focusArea}`,
              durationMonths: 3,
              deliverables: ["Detailed delivery plan", "Solution / approach design", "Risk register"],
              tasks: ["Solution design", "Risk assessment", "Resource planning", "Design review"],
              owner, status: "pending",
            },
            {
              name: "Execution & Delivery",
              description: `Execute planned activities and deliver outputs for ${title}`,
              durationMonths: 4,
              deliverables: ["Core deliverables package", "Progress and quality reports", "Issue log"],
              tasks: ["Work-package execution", "Quality assurance", "Stakeholder reporting", "Change management"],
              owner, status: "pending",
            },
            {
              name: "Closure & Embedding",
              description: `Complete acceptance, embed outcomes, and close ${title}`,
              durationMonths: 1,
              deliverables: ["Acceptance record", "Lessons-learned report", "Closure certificate"],
              tasks: ["Outcome verification", "Lessons learned", "Knowledge transfer", "Formal closure"],
              owner, status: "pending",
            },
          ];
          milestones = [
            { name: "Charter Approved", phase: "Initiation & Scope" },
            { name: "Design Sign-off", phase: "Planning & Design" },
            { name: "Deliverables Accepted", phase: "Execution & Delivery" },
            { name: "Project Closed", phase: "Closure & Embedding" },
          ];
          nextSteps = [
            { action: `Align sponsor and key stakeholders on scope and success criteria for ${title}`, owner, timeline: "Week 1-2", priority: "High" },
            { action: "Complete planning and design activities before committing to execution", owner, timeline: "Week 3-6", priority: "High" },
          ];
        }

        const dependencies = [
          {
            name: "Executive and business sign-off",
            description: "Sponsors and business owners must validate scope and release decisions",
            type: "internal",
            status: "pending",
            impact: "Affects approval and transition timing",
            owner,
          },
          {
            name: "Environment and security readiness",
            description: "Required environments, access, and controls must be ready before build begins",
            type: "internal",
            status: "pending",
            impact: "Blocks configuration and testing",
            owner: "IT Operations",
          },
        ];

        const resourceRequirements = {
          internalTeam: {
            roles: ["Project Manager", "Business Analyst", "Solution Architect", "QA Lead", "Change Manager"],
            effort: "Cross-functional planning and execution through launch",
          },
          externalSupport: {
            expertise: ["Implementation partner", "Integration specialist", "Training support"],
            estimatedCost: budget,
          },
          infrastructure: ["Development environment", "Test environment", "Production environment", "Monitoring and reporting tooling"],
        };

        return {
          success: true,
          result: {
            implementationPhases,
            milestones,
            dependencies,
            resourceRequirements,
            nextSteps,
          },
          reasoning: `Built a context-specific ${implementationPhases.length}-phase delivery plan for ${title} based on detected domain (${category || "general"}).`,
          confidence: 0.88,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createTraceabilityAgent(): AgentDefinition {
    return {
      id: "traceability-agent",
      name: "Traceability Agent",
      description: "Builds traceability between objectives, capabilities, requirements, and KPIs",
      capabilities: ["requirements_traceability", "objective_mapping", "kpi_linkage"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const objective = String(params.description || params.businessObjective || "Improve business outcomes");
        const title = String(params.title || params.projectName || "Initiative");

        const traceabilityMatrix = [
          {
            objective: objective || title,
            capability: `${title} workflow enablement`,
            requirementIds: ["FR-001", "FR-002"],
            kpis: ["Cycle time reduction", "Submission completeness"],
          },
          {
            objective: `Governed execution for ${title}`,
            capability: `${title} governance and controls`,
            requirementIds: ["FR-003", "SR-001", "SR-002"],
            kpis: ["Approval SLA", "Audit readiness", "Control compliance"],
          },
        ];

        return {
          success: true,
          result: {
            traceabilityMatrix,
            linkedObjectives: traceabilityMatrix.length,
            coverageScore: 88,
          },
          reasoning: `Mapped objectives for ${title} to structured requirement and KPI coverage.`,
          confidence: 0.82,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createWbsBuilderAgent(): AgentDefinition {
    return {
      id: "wbs-builder-agent",
      name: "WBS Builder Agent",
      description: "Builds implementation phases, tasks, and milestone structure for delivery planning",
      capabilities: ["phase_planning", "task_breakdown", "milestone_design"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const title = String(params.title || params.projectName || "Initiative");
        const owner = String(params.category || params.department || "PMO");

        // ── Cost-aware WBS generation ─────────────────────────────────
        // When the brain pipeline hands us a bcCostStructure (from the
        // approved business case), we drive the phase & work-package
        // layout from the financial envelope rather than emitting a
        // generic 4-phase template. Each work package carries its BC
        // anchor ref + planned cost so downstream persistence can wire
        // wbs_tasks.plannedCost back to the cost baseline in the CMS.
        const bcCost = params.bcCostStructure as BcCostStructureParam | undefined;
        const reqs = params.requirementsDigest as RequirementsDigestParam | undefined;
        const arch = params.architectureDigest as ArchitectureDigestParam | undefined;

        if (bcCost && Array.isArray(bcCost.implementationAnchors) && bcCost.implementationAnchors.length > 0) {
          const built = buildCostAwareWbs({ title, owner, bcCost, reqs, arch });
          return {
            success: true,
            result: built,
            reasoning: `Derived ${built.implementationPhases.length}-phase WBS from ${bcCost.implementationAnchors.length} BC cost anchors (total planned AED ${Math.round(bcCost.tcoBreakdown?.implementation ?? 0).toLocaleString()}). ${bcCost.recurringAnchors?.length ?? 0} recurring anchor(s) mapped to sustainment phase.`,
            confidence: 0.88,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // ── Context-aware fallback: no detailed BC cost lines available ─────────
        // Build a domain-appropriate, multi-level WBS from the available context
        // (requirementsDigest + architectureDigest). Phases and work packages are
        // derived from what the project actually does — not a generic template.
        // Costs are deliberately omitted (0) because no authoritative cost data
        // exists at this point; cost reconciliation must come from the BC detail.
        return buildContextAwareWbsFallback({ title, owner, reqs, arch, startTime });
      },
    };
  }

  private createDependencyAgent(): AgentDefinition {
    return {
      id: "dependency-agent",
      name: "Dependency Agent",
      description: "Builds dependency map and critical-path constraints for implementation planning",
      capabilities: ["dependency_mapping", "critical_path_analysis", "readiness_constraints"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const owner = String(params.category || params.department || "PMO");

        return {
          success: true,
          result: {
            dependencies: [
              {
                name: "Business stakeholder availability",
                description: "Decision-makers and subject matter experts must be available for workshops and approvals",
                type: "internal",
                status: "pending",
                impact: "May delay scope validation and acceptance",
                owner,
              },
              {
                name: "Environment and access readiness",
                description: "Environments, credentials, and security approvals must be ready before build starts",
                type: "internal",
                status: "pending",
                impact: "Blocks configuration and integration work",
                owner: "IT Operations",
              },
              {
                name: "External integration coordination",
                description: "Dependent systems must provide contracts and testing support",
                type: "external",
                status: "pending",
                impact: "Affects end-to-end validation and launch readiness",
                owner: "Integration Owners",
              },
            ],
            criticalPath: ["Scope Baseline Approved", "Design Approved", "Environment and access readiness", "UAT Approved", "Go-Live"],
          },
          reasoning: "Generated dependency and critical-path structure for implementation planning.",
          confidence: 0.8,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }

  private createResourceRoleAgent(): AgentDefinition {
    return {
      id: "resource-role-agent",
      name: "Resource Role Agent",
      description: "Recommends delivery roles, effort posture, and external support for implementation",
      capabilities: ["resource_planning", "role_design", "effort_estimation"],
      requiredClassification: "public",
      execute: async (input: AgentInput): Promise<AgentOutput> => {
        const startTime = Date.now();
        const params = input.parameters || {};
        const budget = String(params.budget || params.budgetRange || "To be confirmed");

        return {
          success: true,
          result: {
            resourceRequirements: {
              internalTeam: {
                roles: ["Project Manager", "Business Analyst", "Solution Architect", "QA Lead", "Change Manager"],
                effort: "Cross-functional team through design, build, and launch phases",
              },
              externalSupport: {
                expertise: ["Implementation partner", "Integration specialist", "Training support"],
                estimatedCost: budget,
              },
              infrastructure: ["Development environment", "Test environment", "Production environment", "Monitoring and audit tooling"],
            },
            raciHints: [
              { role: "Project Manager", responsibility: "Overall planning, governance, and delivery coordination" },
              { role: "Business Analyst", responsibility: "Requirements quality and stakeholder alignment" },
              { role: "Solution Architect", responsibility: "Target design and integration decisions" },
            ],
          },
          reasoning: "Recommended roles and effort structure for governed delivery planning.",
          confidence: 0.81,
          executionTimeMs: Date.now() - startTime,
        };
      },
    };
  }
}

export const agentRuntime = new ADKAgentRuntime();
