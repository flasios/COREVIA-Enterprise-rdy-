export type CostViewId =
  | 'overview'
  | 'baseline'
  | 'rates'
  | 'cashflow'
  | 'evm'
  | 'reserves'
  | 'commitments';

export interface CbsLineItem {
  id: string;
  wbsCode: string;
  description: string;
  category: 'labor' | 'subcontractor' | 'material' | 'equipment' | 'overhead' | 'other';
  quantity: number;
  unit: string;
  unitRate: number;
  markupPct: number;
  contingencyPct: number;
  costClass: 'CAPEX' | 'OPEX';
  segment?: 'implementation' | 'operations' | 'maintenance' | 'other';
  source?: 'manual' | 'wbs' | 'business-case';
  notes?: string;
  committed?: number;
  actual?: number;
  /**
   * Optional annualized breakdown used for recurring / operational lines.
   * Keeping the profile inline preserves the approved business-case phasing
   * without losing fidelity when the line is still represented as a single
   * quantity × unitRate baseline row.
   */
  yearBreakdown?: Array<{ year: number; amount: number; label?: string }>;
  /**
   * Contracts attached to this CBS line — e.g. the support SLA, licence
   * renewal, or hosting contract that funds an operations / maintenance
   * stream. Cost of all active contracts should reconcile to the year
   * breakdown. Stored inline on the line so the plan is self-contained.
   */
  contracts?: Array<BcLineContract>;
  /**
   * Sub-tasks that decompose this CBS line into discrete, pricable
   * activities — e.g. a "Core Software & Development" line may be split
   * into "Licences", "Custom modules", "Environment setup", each with its
   * own owner and share of the line total. Sub-task amounts should sum to
   * quantity × unitRate so the line remains reconciled. Stored inline so
   * the detail is preserved across reloads.
   */
  subTasks?: Array<CbsLineSubTask>;
}

export interface CbsLineSubTask {
  id: string;
  description: string;
  amount: number;          // AED share of the parent line
  owner?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

export interface BcLineContract {
  id: string;
  vendor: string;
  reference?: string; // PO / contract number
  scope?: string;
  startDate?: string; // ISO
  endDate?: string;
  dueDate?: string;
  annualValue: number;
  status: 'draft' | 'active' | 'renewal' | 'expired' | 'terminated';
  notes?: string;
}

export interface RateCardEntry {
  id: string;
  category: CbsLineItem['category'];
  code: string;
  name: string;
  unit: string;
  rate: number;
  burdenPct: number;
  notes?: string;
}

export interface CommitmentEntry {
  id: string;
  ref: string; // PO / Contract no
  vendor: string;
  description?: string;
  scope?: string;
  awardedValue: number;
  invoicedValue: number;
  paidValue: number;
  retentionPct?: number;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  status: 'draft' | 'awarded' | 'in_progress' | 'closed' | 'cancelled';
  costClass: 'CAPEX' | 'OPEX';
}

export interface ChangeLogEntry {
  id: string;
  date: string; // ISO
  ref: string; // CR-####
  title: string;
  reason?: string;
  amount: number; // positive or negative
  status: 'proposed' | 'approved' | 'rejected' | 'applied';
  approver?: string;
}

export interface ReserveState {
  contingencyPct: number; // % of BAC reserved for known-unknowns
  contingencyUsed: number; // amount drawn from contingency
  managementReservePct: number; // % of BAC held outside baseline
  managementReserveUsed: number;
}

export interface CostPlanState {
  version: number;
  baselineLockedAt?: string | null;
  baselineLockedBy?: string | null;
  rateCard: RateCardEntry[];
  cbs: CbsLineItem[];
  commitments: CommitmentEntry[];
  changes: ChangeLogEntry[];
  reserves: ReserveState;
  notes?: string;
}
