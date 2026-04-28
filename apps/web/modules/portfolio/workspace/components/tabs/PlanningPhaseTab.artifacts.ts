import { format, parseISO } from 'date-fns';
import { CalendarDays, FileCheck, Shield, Target, Users, Wallet } from 'lucide-react';
import type { PlanningPackageStatus } from './PlanningPhaseTab.types';

export const PLANNING_DELIVERABLE_TEMPLATES = [
  {
    id: 'scope-baseline',
    title: 'Scope & Requirements Baseline',
    description: 'Freeze the planning scope, acceptance boundaries, and traceability needed before execution starts.',
    icon: Target,
    keywords: ['scope', 'requirement', 'requirements', 'traceability', 'acceptance', 'business requirement', 'functional specification'],
    defaults: [
      { name: 'Requirements baseline', description: 'Approved scope and requirement set locked for delivery.' },
      { name: 'Requirements traceability matrix', description: 'Trace business objectives through deliverables, controls, and acceptance.' },
      { name: 'Acceptance criteria register', description: 'Define the acceptance conditions for each major planning output.' },
    ],
  },
  {
    id: 'schedule-baseline',
    title: 'Schedule & Milestone Baseline',
    description: 'Establish the integrated schedule, milestone commitments, sequencing, and dependency posture.',
    icon: CalendarDays,
    keywords: ['schedule', 'milestone', 'timeline', 'plan', 'planning', 'dependency', 'critical path', 'cutover'],
    defaults: [
      { name: 'Integrated master schedule', description: 'Working schedule baseline aligned to phases, dates, and sequencing.' },
      { name: 'Milestone commitment plan', description: 'Named milestone gates with target dates and owners.' },
      { name: 'Dependency and sequencing log', description: 'Cross-workstream dependency map with predecessor control.' },
    ],
  },
  {
    id: 'cost-controls',
    title: 'Cost, Procurement & Funding Controls',
    description: 'Set the commercial envelope, procurement path, and cost controls expected from a real planning phase.',
    icon: Wallet,
    keywords: ['cost', 'budget', 'funding', 'procurement', 'contract', 'commercial', 'financial'],
    defaults: [
      { name: 'Cost baseline', description: 'Approved budget, forecast envelope, and control thresholds.' },
      { name: 'Procurement and sourcing plan', description: 'Commercial route, market engagement, and vendor decision path.' },
      { name: 'Contract register', description: 'Planned commercial packages linked to milestones and value release.' },
    ],
  },
  {
    id: 'resource-readiness',
    title: 'Resource & Operating Readiness',
    description: 'Confirm the delivery organization, staffing model, and ownership required to execute the plan.',
    icon: Users,
    keywords: ['resource', 'team', 'staff', 'owner', 'raci', 'responsibility', 'operating model', 'mobilization'],
    defaults: [
      { name: 'Resource management plan', description: 'Planned roles, capacity, and delivery staffing requirements.' },
      { name: 'RACI and ownership matrix', description: 'Decision, approval, delivery, and control accountability mapped.' },
      { name: 'Mobilization plan', description: 'Sequenced ramp-up plan for teams, partners, and enabling resources.' },
    ],
  },
  {
    id: 'governance-controls',
    title: 'Governance, RAID & Change Control',
    description: 'Package the governance controls that make the plan executable and reviewable by PMO and sponsors.',
    icon: Shield,
    keywords: ['governance', 'raid', 'risk', 'issue', 'assumption', 'constraint', 'change', 'decision', 'gate'],
    defaults: [
      { name: 'RAID control log', description: 'Integrated risk, assumption, issue, and dependency control set.' },
      { name: 'Stage-gate review pack', description: 'Planning evidence prepared for sponsor and PMO approval.' },
      { name: 'Change control approach', description: 'Rules, thresholds, and routes for baseline change decisions.' },
    ],
  },
  {
    id: 'quality-readiness',
    title: 'Quality, Acceptance & Readiness',
    description: 'Define how planning outputs will be assured, accepted, and handed over into controlled delivery.',
    icon: FileCheck,
    keywords: ['quality', 'test', 'acceptance', 'assurance', 'readiness', 'deployment', 'handover', 'quality plan'],
    defaults: [
      { name: 'Quality management plan', description: 'Quality controls, review cadence, and acceptance checkpoints.' },
      { name: 'Test and acceptance strategy', description: 'How the project will validate deliverables before sign-off.' },
      { name: 'Deployment and handover readiness', description: 'Operational readiness, release preparation, and transition controls.' },
    ],
  },
] as const;

export function _formatPlanningDate(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (!Number.isFinite(parsed.getTime())) return null;
    return format(parsed, 'dd MMM yyyy');
  } catch {
    return null;
  }
}

export function getPlanningArtifactStatusLabel(status: string): string {
  switch (status) {
    case 'controlled':
      return 'Checked';
    case 'in_build':
      return 'In Build';
    case 'planned':
      return 'Planned';
    case 'gap':
      return 'Standard';
    default:
      return 'Planned';
  }
}

export function getPlanningArtifactStatusClass(status: string): string {
  switch (status) {
    case 'controlled':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'in_build':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'planned':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'gap':
      return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getPlanningPackageStatusLabel(status: PlanningPackageStatus): string {
  switch (status) {
    case 'controlled':
      return 'Checked';
    case 'in_build':
      return 'In Progress';
    case 'planned':
      return 'Planned';
    case 'gap':
      return 'Standard Pack';
    default:
      return 'Planned';
  }
}

export function getPlanningPackageStatusClass(status: PlanningPackageStatus): string {
  switch (status) {
    case 'controlled':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'in_build':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'planned':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'gap':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}
