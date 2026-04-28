import { db } from '../../db';
import { gateCheckCatalog } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from "../../platform/observability";

interface CatalogEntry {
  phase: string;
  gateType: string;
  name: string;
  category: string;
  description: string | null;
  isCritical: boolean;
  isRequired: boolean;
  weight: number;
  sortOrder: number;
  autoVerify?: boolean;
  verificationField?: string;
}

const catalogEntries: CatalogEntry[] = [
  // INITIATION PHASE CHECKS
  { phase: 'initiation', gateType: 'G0', name: 'Business Case Documented', category: 'Business Justification', description: 'Complete business case with problem statement, benefits, and ROI analysis', isCritical: true, isRequired: true, weight: 15, sortOrder: 1, autoVerify: true, verificationField: 'businessCase' },
  { phase: 'initiation', gateType: 'G0', name: 'Project Charter Approved', category: 'Governance', description: 'Signed project charter with scope, objectives, and success criteria', isCritical: true, isRequired: true, weight: 15, sortOrder: 2, autoVerify: true, verificationField: 'charterStatus' },
  { phase: 'initiation', gateType: 'G0', name: 'Executive Sponsor Assigned', category: 'Governance', description: 'Designated executive sponsor with authority and accountability', isCritical: true, isRequired: true, weight: 10, sortOrder: 3, autoVerify: true, verificationField: 'sponsor' },
  { phase: 'initiation', gateType: 'G0', name: 'Initial Budget Approval', category: 'Financial', description: 'Preliminary budget allocation and funding approval', isCritical: true, isRequired: true, weight: 12, sortOrder: 4, autoVerify: true, verificationField: 'approvedBudget' },
  { phase: 'initiation', gateType: 'G0', name: 'Stakeholder Register Complete', category: 'Stakeholder Management', description: 'Identification of all key stakeholders and their requirements', isCritical: false, isRequired: true, weight: 8, sortOrder: 5, autoVerify: true, verificationField: 'stakeholders' },
  { phase: 'initiation', gateType: 'G0', name: 'Initial Risk Assessment', category: 'Risk Management', description: 'Preliminary identification of major project risks', isCritical: false, isRequired: true, weight: 8, sortOrder: 6, autoVerify: true, verificationField: 'risks' },
  { phase: 'initiation', gateType: 'G0', name: 'Strategic Alignment Verified', category: 'Strategic Fit', description: 'Confirmation of alignment with organizational strategic objectives', isCritical: true, isRequired: true, weight: 12, sortOrder: 7, autoVerify: true, verificationField: 'strategicAlignment' },
  { phase: 'initiation', gateType: 'G0', name: 'Project Manager Assigned', category: 'Governance', description: 'Designated project manager with clear authority', isCritical: true, isRequired: true, weight: 10, sortOrder: 8, autoVerify: true, verificationField: 'projectManager' },
  { phase: 'initiation', gateType: 'G0', name: 'High-Level Requirements Defined', category: 'Scope', description: 'Initial requirements gathering and documentation', isCritical: false, isRequired: true, weight: 5, sortOrder: 9, autoVerify: true, verificationField: 'requirements' },
  { phase: 'initiation', gateType: 'G0', name: 'Compliance Review Complete', category: 'Regulatory', description: 'Initial regulatory and compliance assessment', isCritical: false, isRequired: false, weight: 5, sortOrder: 10, autoVerify: true, verificationField: 'compliance' },

  // PLANNING PHASE CHECKS
  { phase: 'planning', gateType: 'G1', name: 'Work Breakdown Structure Complete', category: 'Scope Management', description: 'Detailed WBS with all deliverables and work packages', isCritical: true, isRequired: true, weight: 15, sortOrder: 1 },
  { phase: 'planning', gateType: 'G1', name: 'Project Schedule Baselined', category: 'Schedule Management', description: 'Approved schedule with milestones, dependencies, and critical path', isCritical: true, isRequired: true, weight: 12, sortOrder: 2 },
  { phase: 'planning', gateType: 'G1', name: 'Budget Baseline Established', category: 'Cost Management', description: 'Detailed budget with cost breakdown by phase and category', isCritical: true, isRequired: true, weight: 12, sortOrder: 3 },
  { phase: 'planning', gateType: 'G1', name: 'Resource Plan Approved', category: 'Resource Management', description: 'Resource allocation plan with team assignments and skills mapping', isCritical: true, isRequired: true, weight: 10, sortOrder: 4 },
  { phase: 'planning', gateType: 'G1', name: 'Risk Register Developed', category: 'Risk Management', description: 'Comprehensive risk register with mitigation strategies', isCritical: true, isRequired: true, weight: 10, sortOrder: 5 },
  { phase: 'planning', gateType: 'G1', name: 'Quality Management Plan', category: 'Quality Management', description: 'Quality standards, metrics, and assurance procedures defined', isCritical: false, isRequired: true, weight: 8, sortOrder: 6 },
  { phase: 'planning', gateType: 'G1', name: 'Communication Plan Developed', category: 'Communications', description: 'Stakeholder communication strategy and reporting schedule', isCritical: false, isRequired: true, weight: 6, sortOrder: 7 },
  { phase: 'planning', gateType: 'G1', name: 'Procurement Plan Complete', category: 'Procurement', description: 'Procurement strategy and vendor selection criteria defined', isCritical: false, isRequired: false, weight: 6, sortOrder: 8 },
  { phase: 'planning', gateType: 'G1', name: 'Change Control Process Defined', category: 'Change Management', description: 'Change request process and approval workflow established', isCritical: false, isRequired: true, weight: 6, sortOrder: 9 },
  { phase: 'planning', gateType: 'G1', name: 'Detailed Requirements Approved', category: 'Scope Management', description: 'Complete requirements traceability matrix approved by stakeholders', isCritical: true, isRequired: true, weight: 10, sortOrder: 10 },
  { phase: 'planning', gateType: 'G1', name: 'Technical Design Reviewed', category: 'Technical', description: 'Solution architecture and technical design documentation reviewed', isCritical: false, isRequired: false, weight: 5, sortOrder: 11 },

  // EXECUTION PHASE CHECKS
  { phase: 'execution', gateType: 'G2', name: 'Deliverables in Progress', category: 'Delivery', description: 'Work packages actively being executed per schedule', isCritical: true, isRequired: true, weight: 15, sortOrder: 1, autoVerify: true, verificationField: 'exec.deliverablesInProgress' },
  { phase: 'execution', gateType: 'G2', name: 'Quality Reviews Conducted', category: 'Quality Assurance', description: 'Regular quality inspections and reviews being performed', isCritical: true, isRequired: true, weight: 12, sortOrder: 2, autoVerify: true, verificationField: 'exec.qualityReviews' },
  { phase: 'execution', gateType: 'G2', name: 'Change Requests Managed', category: 'Change Management', description: 'Change control process actively managing scope changes', isCritical: false, isRequired: true, weight: 8, sortOrder: 3 },
  { phase: 'execution', gateType: 'G2', name: 'Risk Responses Implemented', category: 'Risk Management', description: 'Risk mitigation actions being executed as planned', isCritical: true, isRequired: true, weight: 10, sortOrder: 4, autoVerify: true, verificationField: 'exec.riskResponses' },
  { phase: 'execution', gateType: 'G2', name: 'Team Performance Tracked', category: 'Resource Management', description: 'Team productivity and capacity being monitored', isCritical: false, isRequired: true, weight: 8, sortOrder: 5, autoVerify: true, verificationField: 'exec.teamPerformance' },
  { phase: 'execution', gateType: 'G2', name: 'Stakeholder Engagement Active', category: 'Stakeholder Management', description: 'Regular stakeholder communication and feedback collection', isCritical: false, isRequired: true, weight: 8, sortOrder: 6, autoVerify: true, verificationField: 'exec.stakeholderEngagement' },
  { phase: 'execution', gateType: 'G2', name: 'Vendor Performance Monitored', category: 'Procurement', description: 'Third-party deliverables tracked against contracts', isCritical: false, isRequired: false, weight: 6, sortOrder: 7 },
  { phase: 'execution', gateType: 'G2', name: 'Issues Being Resolved', category: 'Issue Management', description: 'Active issue log with resolution tracking', isCritical: true, isRequired: true, weight: 10, sortOrder: 8, autoVerify: true, verificationField: 'exec.issuesResolved' },
  { phase: 'execution', gateType: 'G2', name: 'Resource Utilization Optimal', category: 'Resource Management', description: 'Resources utilized within 80-100% of planned capacity', isCritical: false, isRequired: false, weight: 6, sortOrder: 9, autoVerify: true, verificationField: 'exec.resourceUtilization' },
  { phase: 'execution', gateType: 'G2', name: 'Testing Activities Started', category: 'Quality Assurance', description: 'Test planning and early testing activities commenced', isCritical: false, isRequired: true, weight: 7, sortOrder: 10, autoVerify: true, verificationField: 'exec.testingStarted' },
  { phase: 'execution', gateType: 'G2', name: 'Documentation Updated', category: 'Documentation', description: 'Project documentation kept current with execution progress', isCritical: false, isRequired: true, weight: 5, sortOrder: 11, autoVerify: true, verificationField: 'exec.documentationUpdated' },
  { phase: 'execution', gateType: 'G2', name: 'Budget Tracking Active', category: 'Cost Management', description: 'Actual costs being recorded and tracked against budget', isCritical: true, isRequired: true, weight: 5, sortOrder: 12, autoVerify: true, verificationField: 'exec.budgetTracking' },

  // MONITORING PHASE CHECKS
  { phase: 'monitoring', gateType: 'G3', name: 'Task Completion >75%', category: 'Progress Tracking', description: 'At least 75% of planned tasks completed', isCritical: true, isRequired: true, weight: 15, sortOrder: 1, autoVerify: true, verificationField: 'mon.taskCompletion75' },
  { phase: 'monitoring', gateType: 'G3', name: 'Budget Variance <10%', category: 'Cost Control', description: 'Cost variance within acceptable threshold', isCritical: true, isRequired: true, weight: 12, sortOrder: 2, autoVerify: true, verificationField: 'mon.budgetVariance10' },
  { phase: 'monitoring', gateType: 'G3', name: 'Schedule Variance <10%', category: 'Schedule Control', description: 'Schedule variance within acceptable threshold', isCritical: true, isRequired: true, weight: 12, sortOrder: 3, autoVerify: true, verificationField: 'mon.scheduleVariance10' },
  { phase: 'monitoring', gateType: 'G3', name: 'Quality Metrics Met', category: 'Quality Control', description: 'Quality KPIs meeting or exceeding targets', isCritical: true, isRequired: true, weight: 12, sortOrder: 4, autoVerify: true, verificationField: 'mon.qualityMetrics' },
  { phase: 'monitoring', gateType: 'G3', name: 'Critical Issues Resolved', category: 'Issue Management', description: 'All critical and high-priority issues resolved', isCritical: true, isRequired: true, weight: 12, sortOrder: 5, autoVerify: true, verificationField: 'mon.criticalIssuesResolved' },
  { phase: 'monitoring', gateType: 'G3', name: 'Lessons Learned Documented', category: 'Knowledge Management', description: 'Lessons learned being captured throughout project', isCritical: false, isRequired: true, weight: 8, sortOrder: 6, autoVerify: true, verificationField: 'mon.lessonsLearned' },
  { phase: 'monitoring', gateType: 'G3', name: 'Risk Register Updated', category: 'Risk Management', description: 'Risk register current with new risks and status updates', isCritical: false, isRequired: true, weight: 7, sortOrder: 7, autoVerify: true, verificationField: 'mon.riskRegisterUpdated' },
  { phase: 'monitoring', gateType: 'G3', name: 'Stakeholder Satisfaction Assessed', category: 'Stakeholder Management', description: 'Regular stakeholder feedback and satisfaction tracking', isCritical: false, isRequired: false, weight: 6, sortOrder: 8, autoVerify: true, verificationField: 'mon.stakeholderSatisfaction' },
  { phase: 'monitoring', gateType: 'G3', name: 'Performance Reports Current', category: 'Reporting', description: 'Status reports and dashboards up to date', isCritical: false, isRequired: true, weight: 6, sortOrder: 9, autoVerify: true, verificationField: 'mon.performanceReports' },
  { phase: 'monitoring', gateType: 'G3', name: 'Forecasts Updated', category: 'Forecasting', description: 'EAC, ETC, and completion forecasts maintained', isCritical: false, isRequired: true, weight: 5, sortOrder: 10, autoVerify: true, verificationField: 'mon.forecastsUpdated' },
  { phase: 'monitoring', gateType: 'G3', name: 'Scope Changes Controlled', category: 'Scope Control', description: 'Scope creep managed, changes properly documented', isCritical: false, isRequired: true, weight: 5, sortOrder: 11 },

  // CLOSURE PHASE CHECKS
  { phase: 'closure', gateType: 'G4', name: 'All Deliverables Complete', category: 'Delivery', description: 'All project deliverables completed and verified', isCritical: true, isRequired: true, weight: 15, sortOrder: 1, autoVerify: true, verificationField: 'clos.allDeliverablesComplete' },
  { phase: 'closure', gateType: 'G4', name: 'Deliverables Accepted', category: 'Acceptance', description: 'Formal acceptance of all deliverables by stakeholders', isCritical: true, isRequired: true, weight: 15, sortOrder: 2, autoVerify: true, verificationField: 'clos.deliverablesAccepted' },
  { phase: 'closure', gateType: 'G4', name: 'Final Documentation Complete', category: 'Documentation', description: 'All project documentation finalized and archived', isCritical: true, isRequired: true, weight: 10, sortOrder: 3, autoVerify: true, verificationField: 'clos.finalDocumentation' },
  { phase: 'closure', gateType: 'G4', name: 'Knowledge Transfer Complete', category: 'Transition', description: 'Knowledge transferred to operations/support teams', isCritical: true, isRequired: true, weight: 10, sortOrder: 4, autoVerify: true, verificationField: 'clos.knowledgeTransfer' },
  { phase: 'closure', gateType: 'G4', name: 'Contracts Closed', category: 'Procurement', description: 'All vendor contracts formally closed', isCritical: false, isRequired: true, weight: 8, sortOrder: 5, autoVerify: true, verificationField: 'clos.contractsClosed' },
  { phase: 'closure', gateType: 'G4', name: 'Financial Closure Complete', category: 'Financial', description: 'Final budget reconciliation and financial closure', isCritical: true, isRequired: true, weight: 10, sortOrder: 6, autoVerify: true, verificationField: 'clos.financialClosure' },
  { phase: 'closure', gateType: 'G4', name: 'Lessons Learned Finalized', category: 'Knowledge Management', description: 'Final lessons learned documented and shared', isCritical: false, isRequired: true, weight: 8, sortOrder: 7, autoVerify: true, verificationField: 'clos.lessonsLearnedFinal' },
  { phase: 'closure', gateType: 'G4', name: 'Benefits Realization Plan', category: 'Benefits', description: 'Plan for tracking and measuring project benefits', isCritical: false, isRequired: true, weight: 8, sortOrder: 8, autoVerify: true, verificationField: 'clos.benefitsRealization' },
  { phase: 'closure', gateType: 'G4', name: 'Team Released', category: 'Resource Management', description: 'Project team formally released and recognized', isCritical: false, isRequired: true, weight: 6, sortOrder: 9, autoVerify: true, verificationField: 'clos.teamReleased' },
  { phase: 'closure', gateType: 'G4', name: 'Project Closure Report', category: 'Reporting', description: 'Final project report with performance summary', isCritical: true, isRequired: true, weight: 10, sortOrder: 10, autoVerify: true, verificationField: 'clos.closureReport' },
];

async function updateExistingCatalogAutoVerify() {
  const autoVerifyMap: Record<string, string> = {
    // Initiation
    'Business Case Documented': 'businessCase',
    'Project Charter Approved': 'charterStatus',
    'Executive Sponsor Assigned': 'sponsor',
    'Initial Budget Approval': 'approvedBudget',
    'Stakeholder Register Complete': 'stakeholders',
    'Initial Risk Assessment': 'risks',
    'Strategic Alignment Verified': 'strategicAlignment',
    'Project Manager Assigned': 'projectManager',
    'High-Level Requirements Defined': 'requirements',
    'Compliance Review Complete': 'compliance',
    // Execution
    'Deliverables in Progress': 'exec.deliverablesInProgress',
    'Quality Reviews Conducted': 'exec.qualityReviews',
    'Risk Responses Implemented': 'exec.riskResponses',
    'Team Performance Tracked': 'exec.teamPerformance',
    'Stakeholder Engagement Active': 'exec.stakeholderEngagement',
    'Issues Being Resolved': 'exec.issuesResolved',
    'Resource Utilization Optimal': 'exec.resourceUtilization',
    'Testing Activities Started': 'exec.testingStarted',
    'Documentation Updated': 'exec.documentationUpdated',
    'Budget Tracking Active': 'exec.budgetTracking',
    // Monitoring
    'Task Completion >75%': 'mon.taskCompletion75',
    'Budget Variance <10%': 'mon.budgetVariance10',
    'Schedule Variance <10%': 'mon.scheduleVariance10',
    'Quality Metrics Met': 'mon.qualityMetrics',
    'Critical Issues Resolved': 'mon.criticalIssuesResolved',
    'Lessons Learned Documented': 'mon.lessonsLearned',
    'Risk Register Updated': 'mon.riskRegisterUpdated',
    'Stakeholder Satisfaction Assessed': 'mon.stakeholderSatisfaction',
    'Performance Reports Current': 'mon.performanceReports',
    'Forecasts Updated': 'mon.forecastsUpdated',
    // Closure
    'All Deliverables Complete': 'clos.allDeliverablesComplete',
    'Deliverables Accepted': 'clos.deliverablesAccepted',
    'Final Documentation Complete': 'clos.finalDocumentation',
    'Knowledge Transfer Complete': 'clos.knowledgeTransfer',
    'Contracts Closed': 'clos.contractsClosed',
    'Financial Closure Complete': 'clos.financialClosure',
    'Lessons Learned Finalized': 'clos.lessonsLearnedFinal',
    'Benefits Realization Plan': 'clos.benefitsRealization',
    'Team Released': 'clos.teamReleased',
    'Project Closure Report': 'clos.closureReport',
  };

  for (const [name, field] of Object.entries(autoVerifyMap)) {
    await db.update(gateCheckCatalog)
      .set({ autoVerify: true, verificationField: field })
      .where(eq(gateCheckCatalog.name, name));
  }
  logger.info('[Gate Catalog] Updated auto-verify fields for G0 checks');
}

function toCatalogValues(entry: CatalogEntry) {
  return {
    phase: entry.phase,
    category: entry.category,
    name: entry.name,
    description: entry.description,
    isRequired: entry.isRequired,
    isCritical: entry.isCritical,
    weight: entry.weight,
    autoVerify: entry.autoVerify ?? false,
    verificationField: entry.verificationField ?? null,
    sortOrder: entry.sortOrder,
    isActive: true,
  };
}

export async function seedGateCheckCatalog() {
  logger.info('[Gate Catalog] Seeding gate check catalog...');

  const existingEntries = await db.query.gateCheckCatalog.findMany();
  let inserted = 0;
  let updated = 0;

  for (const entry of catalogEntries) {
    const existing = existingEntries.find((catalogEntry) => {
      return catalogEntry.phase === entry.phase && catalogEntry.name === entry.name;
    });

    if (existing) {
      await db.update(gateCheckCatalog)
        .set({
          ...toCatalogValues(entry),
          updatedAt: new Date(),
        })
        .where(and(
          eq(gateCheckCatalog.phase, entry.phase),
          eq(gateCheckCatalog.name, entry.name),
        ));
      updated++;
      continue;
    }

    await db.insert(gateCheckCatalog).values(toCatalogValues(entry));
    inserted++;
  }

  if (existingEntries.length > 0) {
    await updateExistingCatalogAutoVerify();
  }

  logger.info(`[Gate Catalog] Sync complete: ${inserted} inserted, ${updated} updated, ${catalogEntries.length} expected entries`);
}

export { catalogEntries };
