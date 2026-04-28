import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DollarSign,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Building2,
  CalendarDays,
  Search,
  Loader2,
  Banknote,
  CreditCard,
  Package,
  Truck,
  BarChart3,
  Trash2,
  Shield,
  Target,
  Wallet,
  ArrowRight,
  CircleDollarSign,
  PieChart,
  Activity,
  TrendingUp,
  TrendingDown,
  Pencil,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProjectData, BusinessCaseData } from '../../types';
import { normalizeFinancialData, type RawBusinessCaseFinancials } from '../../utils/normalizers';

interface ExecutionCostProcurementHubProps {
  project: ProjectData;
  initialTab?: 'cost' | 'procurement';
  businessCase?: BusinessCaseData | null;
}

interface CostEntryRecord {
  id: string;
  entry_type?: string;
  entryType?: string;
  amount: string;
  category?: string;
  description?: string;
  vendor?: string;
  cost_date?: string;
  costDate?: string;
  invoice_ref?: string;
  invoiceRef?: string;
  currency?: string;
  status?: string;
}

interface ProcurementItemRecord {
  id: string;
  title: string;
  vendor: string;
  contract_value?: string;
  contractValue?: string;
  currency?: string;
  paid_amount?: string;
  paidAmount?: string;
  status: string;
  start_date?: string;
  startDate?: string;
  end_date?: string;
  endDate?: string;
  vendor_contact?: string;
  vendorContact?: string;
  contract_ref?: string;
  contractRef?: string;
  procurement_type?: string;
  procurementType?: string;
  payment_terms?: string;
  paymentTerms?: string;
  deliverables?: string[];
  description?: string;
}

interface PlanningProcurementShell {
  key: string;
  title: string;
  vendor: string;
  contractRef: string | null;
  contractValue: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  description: string | null;
  sourceLabel: string;
}

interface PlanningProcurementLink {
  shell: PlanningProcurementShell;
  rawContractValue: number;
  resolvedContractValue: number;
  needsSync: boolean;
}

interface SyncPlanningContractValueVariables {
  id: string;
  contractValue: number;
  mode?: 'auto' | 'manual';
}

interface PaymentRecord {
  id: string;
  due_date?: string;
  dueDate?: string;
  payment_date?: string;
  paymentDate?: string;
  payment_method?: string;
  paymentMethod?: string;
  receipt_ref?: string;
  receiptRef?: string;
  invoice_ref?: string;
  invoiceRef?: string;
  milestone_ref?: string;
  milestoneRef?: string;
  procurement_item_id?: string;
  procurementItemId?: string;
  amount: string;
  currency?: string;
  status?: string;
  description?: string;
  notes?: string;
  procurement_title?: string;
  procurement_vendor?: string;
}

interface WbsTaskRecord {
  id: string;
  task_code?: string;
  taskCode?: string;
  wbs_code?: string;
  wbsCode?: string;
  name?: string;
  title?: string;
  status?: string;
  wbs_level?: number;
  wbsLevel?: number;
  planned_cost?: string;
  plannedCost?: string;
  actual_cost?: string;
  actualCost?: string;
}

interface CostEntryInput {
  entryType: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  vendor: string | null;
  invoiceRef: string | null;
  costDate: string;
  notes: string | null;
}

interface ProcurementItemInput {
  procurementType: string;
  title: string;
  description: string | null;
  vendor: string;
  vendorContact: string | null;
  contractRef: string | null;
  contractValue: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  paymentTerms: string | null;
  deliverables: string[] | null;
}

interface PaymentInput {
  procurementItemId: string;
  amount: string;
  currency: string;
  dueDate: string | null;
  paymentDate: string;
  status: string;
  paymentMethod: string;
  receiptRef: string | null;
  invoiceRef: string | null;
  milestoneRef: string | null;
  description: string | null;
  notes: string | null;
}

type _ActiveTab = 'cost' | 'procurement';
type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const COST_CATEGORIES = [
  'labor', 'software', 'hardware', 'consulting', 'training',
  'infrastructure', 'licensing', 'travel', 'maintenance', 'other'
];

const CATEGORY_COLORS: Record<string, string> = {
  labor: 'bg-blue-500',
  software: 'bg-violet-500',
  hardware: 'bg-amber-500',
  consulting: 'bg-emerald-500',
  training: 'bg-cyan-500',
  infrastructure: 'bg-rose-500',
  licensing: 'bg-indigo-500',
  travel: 'bg-orange-500',
  maintenance: 'bg-teal-500',
  other: 'bg-slate-500',
};

const _CATEGORY_BG: Record<string, string> = {
  labor: 'bg-blue-500/10',
  software: 'bg-violet-500/10',
  hardware: 'bg-amber-500/10',
  consulting: 'bg-emerald-500/10',
  training: 'bg-cyan-500/10',
  infrastructure: 'bg-rose-500/10',
  licensing: 'bg-indigo-500/10',
  travel: 'bg-orange-500/10',
  maintenance: 'bg-teal-500/10',
  other: 'bg-slate-500/10',
};

const PROCUREMENT_TYPES = ['service', 'product', 'license', 'subscription', 'consulting'];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  recorded: { label: 'Recorded', variant: 'secondary' },
  pending_approval: { label: 'Pending Approval', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'outline' },
  completed: { label: 'Completed', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  closed: { label: 'Closed', variant: 'secondary' },
  voided: { label: 'Voided', variant: 'destructive' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  check: 'Check',
  wire: 'Wire',
  credit_card: 'Credit Card',
  cash: 'Cash',
};

function formatCurrency(amount: number | string | undefined | null, currency = 'AED'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return `${currency} 0.00`;
  if (num >= 1000000) return `${currency} ${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${currency} ${(num / 1000).toFixed(1)}K`;
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFullCurrency(amount: number | string | undefined | null, currency = 'AED'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function procurementMatchKey({ contractRef, vendor, title }: { contractRef?: string | null; vendor?: string | null; title?: string | null }): string {
  const normalizedRef = contractRef?.trim().toLowerCase();
  if (normalizedRef) return `ref:${normalizedRef}`;

  const normalizedVendor = vendor?.trim().toLowerCase() || 'unknown-vendor';
  const normalizedTitle = title?.trim().toLowerCase() || 'untitled';
  return `vendor:${normalizedVendor}|title:${normalizedTitle}`;
}

function procurementRecordMatchKey(item: ProcurementItemRecord): string {
  return procurementMatchKey({
    contractRef: item.contract_ref ?? item.contractRef,
    vendor: item.vendor,
    title: item.title,
  });
}

function procurementContractValue(item: Pick<ProcurementItemRecord, 'contract_value' | 'contractValue'>): number {
  return asNumber(item.contract_value ?? item.contractValue ?? null);
}

function procurementPaidAmount(item: Pick<ProcurementItemRecord, 'paid_amount' | 'paidAmount'>): number {
  return asNumber(item.paid_amount ?? item.paidAmount ?? null);
}

function buildPlanningProcurementShells(project: ProjectData): PlanningProcurementShell[] {
  const metadata = asRecord(project.metadata);
  const costPlan = asRecord(metadata?.costPlan);
  if (!costPlan) return [];

  const shells = new Map<string, PlanningProcurementShell>();

  const upsertShell = (candidate: Omit<PlanningProcurementShell, 'key'>) => {
    if (!candidate.vendor && !candidate.contractRef && !candidate.title) return;

    const key = procurementMatchKey({
      contractRef: candidate.contractRef,
      vendor: candidate.vendor,
      title: candidate.title,
    });

    const existing = shells.get(key);
    if (!existing) {
      shells.set(key, { ...candidate, key });
      return;
    }

    shells.set(key, {
      ...existing,
      title: existing.title || candidate.title,
      vendor: existing.vendor || candidate.vendor,
      contractRef: existing.contractRef || candidate.contractRef,
      contractValue: existing.contractValue || candidate.contractValue,
      currency: existing.currency || candidate.currency,
      startDate: existing.startDate || candidate.startDate,
      endDate: existing.endDate || candidate.endDate,
      dueDate: existing.dueDate || candidate.dueDate,
      description: existing.description || candidate.description,
      sourceLabel: existing.sourceLabel.includes(candidate.sourceLabel)
        ? existing.sourceLabel
        : `${existing.sourceLabel} + ${candidate.sourceLabel}`,
    });
  };

  asArray(costPlan.commitments).forEach((entry) => {
    const commitment = asRecord(entry);
    if (!commitment) return;

    const vendor = asString(commitment.vendor) || 'Planning vendor';
    const contractRef = asString(commitment.ref);
    const scope = asString(commitment.scope);
    const description = asString(commitment.description);

    upsertShell({
      title: scope || description || contractRef || `${vendor} contract`,
      vendor,
      contractRef,
      contractValue: asNumber(commitment.awardedValue),
      currency: 'AED',
      startDate: asString(commitment.startDate),
      endDate: asString(commitment.endDate),
      dueDate: asString(commitment.dueDate),
      description: description || scope,
      sourceLabel: 'Planning commitment',
    });
  });

  asArray(costPlan.cbs).forEach((lineEntry) => {
    const line = asRecord(lineEntry);
    if (!line) return;

    const lineDescription = asString(line.description);
    asArray(line.contracts).forEach((contractEntry) => {
      const contract = asRecord(contractEntry);
      if (!contract) return;

      const vendor = asString(contract.vendor) || 'Planning vendor';
      const contractRef = asString(contract.reference);
      const scope = asString(contract.scope);

      upsertShell({
        title: scope || lineDescription || contractRef || `${vendor} contract`,
        vendor,
        contractRef,
        contractValue: asNumber(contract.annualValue),
        currency: 'AED',
        startDate: asString(contract.startDate),
        endDate: asString(contract.endDate),
        dueDate: asString(contract.dueDate),
        description: lineDescription,
        sourceLabel: lineDescription ? `Planning contract shell · ${lineDescription}` : 'Planning contract shell',
      });
    });
  });

  return Array.from(shells.values()).sort((left, right) => {
    const leftValue = left.contractValue || 0;
    const rightValue = right.contractValue || 0;
    if (leftValue !== rightValue) return rightValue - leftValue;
    return left.title.localeCompare(right.title);
  });
}

function getBudgetHealthStatus(utilization: number): { label: string; color: string; bgColor: string; icon: typeof Shield } {
  if (utilization <= 60) return { label: 'On Track', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Shield };
  if (utilization <= 80) return { label: 'Monitor', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', icon: Activity };
  if (utilization <= 100) return { label: 'At Risk', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10', icon: AlertTriangle };
  return { label: 'Over Budget', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', icon: AlertTriangle };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const [yearRaw = '', monthRaw = '', dayRaw = ''] = dateStr.split('T')[0]?.split('-') || [];
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day) && year > 0 && month > 0 && day > 0) {
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function differenceInCalendarDays(target: Date, compareDate = new Date()): number {
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const compareStart = new Date(compareDate.getFullYear(), compareDate.getMonth(), compareDate.getDate());
  return Math.round((targetStart.getTime() - compareStart.getTime()) / 86400000);
}

function isClosedPaymentStatus(status: string | null | undefined): boolean {
  return ['completed', 'voided', 'rejected', 'cancelled'].includes(status || 'completed');
}

function paymentSortKey(payment: Pick<PaymentRecord, 'due_date' | 'dueDate' | 'payment_date' | 'paymentDate'>): number {
  const anchorDate = parseDateOnly(payment.due_date || payment.dueDate || payment.payment_date || payment.paymentDate);
  return anchorDate?.getTime() || 0;
}

function getPaymentDueSignal(
  payment: Pick<PaymentRecord, 'due_date' | 'dueDate' | 'payment_date' | 'paymentDate' | 'status'>,
): { label: string; variant: StatusVariant; detail: string; days: number | null } {
  const dueDate = parseDateOnly(payment.due_date || payment.dueDate);
  const paymentDate = parseDateOnly(payment.payment_date || payment.paymentDate);
  const closed = isClosedPaymentStatus(payment.status);

  if (!dueDate) {
    if (closed) {
      return { label: 'Closed', variant: 'secondary', detail: 'Closed without a due-date baseline', days: null };
    }
    return { label: 'No due date', variant: 'outline', detail: 'Add a due date to enable reminders', days: null };
  }

  const dayDelta = differenceInCalendarDays(dueDate);
  if (closed) {
    if (!paymentDate) {
      return { label: 'Closed', variant: 'secondary', detail: 'Closed against the planned due date', days: dayDelta };
    }

    const settlementDelta = differenceInCalendarDays(paymentDate, dueDate);
    if (settlementDelta === 0) {
      return { label: 'Closed', variant: 'secondary', detail: 'Settled on the due date', days: dayDelta };
    }
    if (settlementDelta > 0) {
      return { label: 'Closed', variant: 'secondary', detail: `Settled ${settlementDelta}d late`, days: dayDelta };
    }
    return { label: 'Closed', variant: 'secondary', detail: `Settled ${Math.abs(settlementDelta)}d early`, days: dayDelta };
  }

  if (dayDelta < 0) {
    return { label: 'Overdue', variant: 'destructive', detail: `${Math.abs(dayDelta)}d overdue`, days: dayDelta };
  }
  if (dayDelta === 0) {
    return { label: 'Due today', variant: 'outline', detail: 'Reminder window is active now', days: 0 };
  }
  if (dayDelta <= 7) {
    return { label: 'Due soon', variant: 'outline', detail: `Due in ${dayDelta}d`, days: dayDelta };
  }
  return { label: 'Scheduled', variant: 'secondary', detail: `Due in ${dayDelta}d`, days: dayDelta };
}

export function ExecutionCostProcurementHub({ project, initialTab = 'cost', businessCase }: ExecutionCostProcurementHubProps) {
  const activeTab = initialTab;
  const autoPlanningSyncKeysRef = useRef(new Set<string>());
  const [costSearch, setCostSearch] = useState('');
  const [costCategoryFilter, setCostCategoryFilter] = useState('all');
  const [costTypeFilter, setCostTypeFilter] = useState('all');
  const [procSearch, setProcSearch] = useState('');
  const [procStatusFilter, setProcStatusFilter] = useState('all');
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showProcDialog, setShowProcDialog] = useState(false);
  const [costViewMode, setCostViewMode] = useState<'breakdown' | 'entries' | 'task-costs'>('breakdown');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState('');
  const [showCostTasksAll, setShowCostTasksAll] = useState(false);
  const [selectedProcurementId, setSelectedProcurementId] = useState<string | null>(null);
  const [focusedPaymentId, setFocusedPaymentId] = useState<string | null>(null);
  const [autoSyncingProcurementId, setAutoSyncingProcurementId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    procurementItemId: '',
    amount: '',
    currency: 'AED',
    dueDate: todayDate(),
    paymentDate: todayDate(),
    status: 'completed',
    paymentMethod: 'bank_transfer',
    receiptRef: '',
    invoiceRef: '',
    milestoneRef: '',
    description: '',
    notes: '',
  });
  const { toast } = useToast();
  const { t } = useTranslation();

  const [costForm, setCostForm] = useState({
    entryType: 'actual',
    category: 'software',
    description: '',
    amount: '',
    currency: 'AED',
    vendor: '',
    invoiceRef: '',
    costDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [procForm, setProcForm] = useState({
    procurementType: 'service',
    title: '',
    description: '',
    vendor: '',
    vendorContact: '',
    contractRef: '',
    contractValue: '',
    currency: 'AED',
    startDate: '',
    endDate: '',
    paymentTerms: '',
    deliverables: '',
  });

  const { data: costEntries = [], isLoading: loadingCosts } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'cost-entries'],
  });

  const { data: procurementItems = [], isLoading: loadingProcurement } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'],
  });

  const { data: wbsTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'wbs-tasks'],
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'payments'],
  });

  const { data: projectSnapshotResponse } = useQuery<{ data?: { project?: ProjectData } }>({
    queryKey: ['/api/portfolio/projects', project.id],
    enabled: Boolean(project.id),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const financials = useMemo(() => {
    return normalizeFinancialData(businessCase as unknown as RawBusinessCaseFinancials);
  }, [businessCase]);

  const projectSnapshot = projectSnapshotResponse?.data?.project ?? project;
  const procurementRecords = procurementItems as ProcurementItemRecord[];
  const paymentRecords = payments as PaymentRecord[];
  const planningProcurementShells = useMemo(() => buildPlanningProcurementShells(projectSnapshot), [projectSnapshot]);

  const createCostMutation = useMutation({
    mutationFn: (data: CostEntryInput) => apiRequest('POST', `/api/portfolio/projects/${project.id}/cost-entries`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'cost-entries'] });
      setShowCostDialog(false);
      resetCostForm();
      toast({ title: t('projectWorkspace.toast.costEntryRecorded') });
    },
    onError: () => toast({ title: t('projectWorkspace.toast.failedRecordCostEntry'), variant: 'destructive' }),
  });

  const deleteCostMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/portfolio/projects/${project.id}/cost-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'cost-entries'] });
      toast({ title: t('projectWorkspace.toast.costEntryDeleted') });
    },
  });

  const createProcMutation = useMutation({
    mutationFn: (data: ProcurementItemInput) => apiRequest('POST', `/api/portfolio/projects/${project.id}/procurement-items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      setShowProcDialog(false);
      resetProcForm();
      toast({ title: t('projectWorkspace.toast.procurementItemCreated') });
    },
    onError: () => toast({ title: t('projectWorkspace.toast.failedCreateProcurementItem'), variant: 'destructive' }),
  });

  const deleteProcMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/portfolio/projects/${project.id}/procurement-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      toast({ title: t('projectWorkspace.toast.procurementItemDeleted') });
    },
  });

  const updateProcStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest('PATCH', `/api/portfolio/projects/${project.id}/procurement-items/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      toast({ title: t('projectWorkspace.toast.statusUpdated') });
    },
  });

  const syncPlanningContractValueMutation = useMutation({
    mutationFn: ({ id, contractValue }: SyncPlanningContractValueVariables) =>
      apiRequest('PATCH', `/api/portfolio/projects/${project.id}/procurement-items/${id}`, {
        contractValue: String(contractValue),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      if (variables.mode !== 'auto') {
        toast({ title: 'Contract value synced from planning' });
      }
    },
    onError: (_error, variables) => toast({
      title: variables.mode === 'auto'
        ? 'Failed to refresh a draft procurement from planning'
        : 'Failed to sync contract value from planning',
      variant: 'destructive',
    }),
  });

  const updateActualCostMutation = useMutation({
    mutationFn: ({ taskId, actualCost }: { taskId: string; actualCost: string }) =>
      apiRequest('PATCH', `/api/portfolio/projects/${project.id}/wbs-tasks/${taskId}/actual-cost`, { actualCost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs-tasks'] });
      toast({ title: t('projectWorkspace.toast.actualCostUpdated') });
      setEditingTaskId(null);
    },
    onError: () => toast({ title: t('projectWorkspace.toast.failedUpdateActualCost'), variant: 'destructive' }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: PaymentInput) => apiRequest('POST', `/api/portfolio/projects/${project.id}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      setShowPaymentDialog(false);
      resetPaymentForm();
      toast({ title: t('projectWorkspace.toast.paymentRecorded') });
    },
    onError: () => toast({ title: t('projectWorkspace.toast.failedRecordPayment'), variant: 'destructive' }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/portfolio/projects/${project.id}/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      toast({ title: t('projectWorkspace.toast.paymentDeleted') });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PaymentInput> }) =>
      apiRequest('PATCH', `/api/portfolio/projects/${project.id}/payments/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'procurement-items'] });
      toast({ title: 'Payment updated' });
    },
    onError: () => toast({ title: 'Failed to update payment', variant: 'destructive' }),
  });

  function resetPaymentForm() {
    const defaultDate = todayDate();
    setPaymentForm({
      procurementItemId: '', amount: '', currency: 'AED',
      dueDate: defaultDate,
      paymentDate: defaultDate,
      status: 'completed',
      paymentMethod: 'bank_transfer', receiptRef: '', invoiceRef: '',
      milestoneRef: '', description: '', notes: '',
    });
  }

  function openPaymentDialog(options: { procurementItemId?: string; dueDate?: string | null; status?: string } = {}) {
    const defaultDate = options.dueDate || todayDate();
    const relatedProcurement = options.procurementItemId
      ? procurementRecords.find((item) => item.id === options.procurementItemId)
      : undefined;

    setPaymentForm({
      procurementItemId: options.procurementItemId || '',
      amount: '',
      currency: relatedProcurement?.currency || 'AED',
      dueDate: defaultDate,
      paymentDate: defaultDate,
      status: options.status || 'completed',
      paymentMethod: 'bank_transfer',
      receiptRef: '',
      invoiceRef: '',
      milestoneRef: '',
      description: '',
      notes: '',
    });
    setShowPaymentDialog(true);
  }

  function handlePaymentSubmit() {
    if (!paymentForm.procurementItemId || !paymentForm.amount || !paymentForm.paymentDate) {
      toast({ title: t('projectWorkspace.toast.fillRequiredFields'), variant: 'destructive' });
      return;
    }
    createPaymentMutation.mutate({
      procurementItemId: paymentForm.procurementItemId,
      amount: paymentForm.amount,
      currency: paymentForm.currency,
      dueDate: paymentForm.dueDate || null,
      paymentDate: paymentForm.paymentDate,
      status: paymentForm.status,
      paymentMethod: paymentForm.paymentMethod,
      receiptRef: paymentForm.receiptRef || null,
      invoiceRef: paymentForm.invoiceRef || null,
      milestoneRef: paymentForm.milestoneRef || null,
      description: paymentForm.description || null,
      notes: paymentForm.notes || null,
    });
  }

  const taskCostAnalysis = useMemo(() => {
    const tasks = (wbsTasks as WbsTaskRecord[]).map((t: WbsTaskRecord) => {
      const planned = parseFloat(t.planned_cost || t.plannedCost || '0');
      const actual = parseFloat(t.actual_cost || t.actualCost || '0');
      const variance = planned - actual;
      const variancePercent = planned > 0 ? (variance / planned) * 100 : 0;
      return {
        id: t.id,
        taskCode: t.task_code || t.taskCode || t.wbs_code || t.wbsCode || '-',
        name: t.name || t.title || '-',
        status: t.status || 'pending',
        wbsLevel: t.wbs_level || t.wbsLevel || 0,
        planned,
        actual,
        variance,
        variancePercent,
        hasCostData: planned > 0 || actual > 0,
      };
    });

    const filtered = showCostTasksAll ? tasks : tasks.filter(t => t.hasCostData);
    const totalPlanned = filtered.reduce((s, t) => s + t.planned, 0);
    const totalActual = filtered.reduce((s, t) => s + t.actual, 0);
    const totalVariance = totalPlanned - totalActual;
    const cpi = totalActual > 0 ? totalPlanned / totalActual : 0;

    return { tasks: filtered, allTasks: tasks, totalPlanned, totalActual, totalVariance, cpi };
  }, [wbsTasks, showCostTasksAll]);

  function resetCostForm() {
    setCostForm({
      entryType: 'actual', category: 'software', description: '', amount: '',
      currency: 'AED', vendor: '', invoiceRef: '', costDate: new Date().toISOString().split('T')[0], notes: '',
    });
  }

  function resetProcForm() {
    setProcForm({
      procurementType: 'service', title: '', description: '', vendor: '', vendorContact: '',
      contractRef: '', contractValue: '', currency: 'AED', startDate: '', endDate: '',
      paymentTerms: '', deliverables: '',
    });
  }

  function handleCostSubmit() {
    if (!costForm.description || !costForm.amount || !costForm.costDate) {
      toast({ title: t('projectWorkspace.toast.fillRequiredFields'), variant: 'destructive' });
      return;
    }
    createCostMutation.mutate({
      entryType: costForm.entryType,
      category: costForm.category,
      description: costForm.description,
      amount: costForm.amount,
      currency: costForm.currency,
      vendor: costForm.vendor || null,
      invoiceRef: costForm.invoiceRef || null,
      costDate: costForm.costDate,
      notes: costForm.notes || null,
    });
  }

  function handleProcSubmit() {
    if (!procForm.title || !procForm.vendor || !procForm.contractValue) {
      toast({ title: t('projectWorkspace.toast.fillRequiredFields'), variant: 'destructive' });
      return;
    }
    createProcMutation.mutate({
      procurementType: procForm.procurementType,
      title: procForm.title,
      description: procForm.description || null,
      vendor: procForm.vendor,
      vendorContact: procForm.vendorContact || null,
      contractRef: procForm.contractRef || null,
      contractValue: procForm.contractValue,
      currency: procForm.currency,
      startDate: procForm.startDate || null,
      endDate: procForm.endDate || null,
      paymentTerms: procForm.paymentTerms || null,
      deliverables: procForm.deliverables ? procForm.deliverables.split(',').map((d: string) => d.trim()) : null,
    });
  }

  function importPlanningShell(shell: PlanningProcurementShell) {
    createProcMutation.mutate({
      procurementType: 'service',
      title: shell.title,
      description: shell.description || `Imported from ${shell.sourceLabel}`,
      vendor: shell.vendor,
      vendorContact: null,
      contractRef: shell.contractRef,
      contractValue: String(shell.contractValue || 0),
      currency: shell.currency || 'AED',
      startDate: shell.startDate,
      endDate: shell.endDate,
      paymentTerms: shell.dueDate ? `Planning due-date baseline: ${shell.dueDate}` : null,
      deliverables: null,
    });
  }

  const budgetAnalysis = useMemo(() => {
    const entries = costEntries as CostEntryRecord[];
    const actualEntries = entries.filter((e: CostEntryRecord) => (e.entry_type || e.entryType) === 'actual');
    const forecastEntries = entries.filter((e: CostEntryRecord) => (e.entry_type || e.entryType) === 'forecast');

    const totalActualSpend = actualEntries.reduce((sum: number, e: CostEntryRecord) => sum + parseFloat(e.amount || '0'), 0);
    const totalForecasted = forecastEntries.reduce((sum: number, e: CostEntryRecord) => sum + parseFloat(e.amount || '0'), 0);

    const confirmedBudget = project.totalBudget || financials.totalCost || 0;
    const totalEstimatedCost = financials.totalCost || confirmedBudget;
    const implementationCost = financials.implementationCost || 0;
    const operationsCost = financials.operationsCost || 0;
    const maintenanceCost = financials.maintenanceCost || 0;

    const remaining = confirmedBudget - totalActualSpend;
    const utilization = confirmedBudget > 0 ? (totalActualSpend / confirmedBudget) * 100 : 0;
    const committed = totalActualSpend + totalForecasted;
    const uncommitted = confirmedBudget - committed;

    const byCategory: Record<string, { actual: number; forecast: number; count: number }> = {};
    entries.forEach((e: CostEntryRecord) => {
      const cat = e.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { actual: 0, forecast: 0, count: 0 };
      const amt = parseFloat(e.amount || '0');
      const type = e.entry_type || e.entryType;
      if (type === 'actual') byCategory[cat].actual += amt;
      else byCategory[cat].forecast += amt;
      byCategory[cat].count++;
    });

    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        actual: data.actual,
        forecast: data.forecast,
        total: data.actual + data.forecast,
        count: data.count,
        percentOfBudget: confirmedBudget > 0 ? ((data.actual + data.forecast) / confirmedBudget) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const byMonth: Record<string, { actual: number; forecast: number }> = {};
    entries.forEach((e: CostEntryRecord) => {
      const dateStr = e.cost_date || e.costDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { actual: 0, forecast: 0 };
      const amt = parseFloat(e.amount || '0');
      const type = e.entry_type || e.entryType;
      if (type === 'actual') byMonth[key].actual += amt;
      else byMonth[key].forecast += amt;
    });

    const monthlyTrend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        actual: data.actual,
        forecast: data.forecast,
      }));

    const byVendor: Record<string, number> = {};
    actualEntries.forEach((e: CostEntryRecord) => {
      const vendor = e.vendor || 'Unspecified';
      byVendor[vendor] = (byVendor[vendor] || 0) + parseFloat(e.amount || '0');
    });
    const topVendors = Object.entries(byVendor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendor, amount]) => ({ vendor, amount, percent: totalActualSpend > 0 ? (amount / totalActualSpend) * 100 : 0 }));

    return {
      confirmedBudget,
      totalEstimatedCost,
      totalActualSpend,
      totalForecasted,
      remaining,
      utilization,
      committed,
      uncommitted,
      implementationCost,
      operationsCost,
      maintenanceCost,
      categoryBreakdown,
      monthlyTrend,
      topVendors,
      actualCount: actualEntries.length,
      forecastCount: forecastEntries.length,
      healthStatus: getBudgetHealthStatus(utilization),
      roi: financials.roi,
      npv: financials.npv,
      paybackPeriod: financials.paybackPeriod,
    };
  }, [costEntries, project.totalBudget, financials]);

  const planningShellByKey = useMemo(() => {
    const next = new Map<string, PlanningProcurementShell>();
    planningProcurementShells.forEach((shell) => next.set(shell.key, shell));
    return next;
  }, [planningProcurementShells]);

  const planningLinkByProcurementId = useMemo(() => {
    const next = new Map<string, PlanningProcurementLink>();

    procurementRecords.forEach((item) => {
      const shell = planningShellByKey.get(procurementRecordMatchKey(item));
      if (!shell) return;

      const rawContractValue = procurementContractValue(item);
      const resolvedContractValue = item.status === 'draft' && rawContractValue <= 0 && shell.contractValue > 0
        ? shell.contractValue
        : rawContractValue;

      next.set(item.id, {
        shell,
        rawContractValue,
        resolvedContractValue,
        needsSync: item.status === 'draft' && shell.contractValue > 0 && Math.abs(rawContractValue - shell.contractValue) >= 0.01,
      });
    });

    return next;
  }, [planningShellByKey, procurementRecords]);

  const pendingPlanningAutoSync = useMemo(() => {
    for (const item of procurementRecords) {
      const planningLink = planningLinkByProcurementId.get(item.id);
      if (!planningLink?.needsSync) continue;

      const syncKey = `${item.id}:${planningLink.shell.contractValue}`;
      if (autoPlanningSyncKeysRef.current.has(syncKey)) continue;

      return {
        id: item.id,
        contractValue: planningLink.shell.contractValue,
        syncKey,
      };
    }

    return null;
  }, [planningLinkByProcurementId, procurementRecords]);

  useEffect(() => {
    if (!pendingPlanningAutoSync || syncPlanningContractValueMutation.isPending || autoSyncingProcurementId) {
      return;
    }

    autoPlanningSyncKeysRef.current.add(pendingPlanningAutoSync.syncKey);
    setAutoSyncingProcurementId(pendingPlanningAutoSync.id);

    syncPlanningContractValueMutation.mutate(
      {
        id: pendingPlanningAutoSync.id,
        contractValue: pendingPlanningAutoSync.contractValue,
        mode: 'auto',
      },
      {
        onSettled: () => {
          setAutoSyncingProcurementId((current) => (
            current === pendingPlanningAutoSync.id ? null : current
          ));
        },
      },
    );
  }, [autoSyncingProcurementId, pendingPlanningAutoSync, syncPlanningContractValueMutation]);

  const getPlanningLinkForProcurement = (item: ProcurementItemRecord): PlanningProcurementLink | null => {
    return planningLinkByProcurementId.get(item.id) ?? null;
  };

  const getResolvedProcurementContractValue = useCallback((item: ProcurementItemRecord): number => {
    return planningLinkByProcurementId.get(item.id)?.resolvedContractValue ?? procurementContractValue(item);
  }, [planningLinkByProcurementId]);

  const procStats = useMemo(() => {
    const items = procurementRecords;
    const totalValue = items.reduce((sum: number, i: ProcurementItemRecord) => sum + getResolvedProcurementContractValue(i), 0);
    const totalPaid = items.reduce((sum: number, i: ProcurementItemRecord) => sum + procurementPaidAmount(i), 0);
    const active = items.filter((i: ProcurementItemRecord) => ['active', 'in_progress'].includes(i.status)).length;
    const completed = items.filter((i: ProcurementItemRecord) => i.status === 'completed').length;
    return { totalValue, totalPaid, active, completed, totalItems: items.length };
  }, [procurementRecords, getResolvedProcurementContractValue]);

  const filteredCosts = useMemo(() => {
    let entries = costEntries as CostEntryRecord[];
    if (costSearch) {
      const s = costSearch.toLowerCase();
      entries = entries.filter((e: CostEntryRecord) => (e.description || '').toLowerCase().includes(s) || (e.vendor || '').toLowerCase().includes(s));
    }
    if (costCategoryFilter !== 'all') entries = entries.filter((e: CostEntryRecord) => e.category === costCategoryFilter);
    if (costTypeFilter !== 'all') entries = entries.filter((e: CostEntryRecord) => (e.entry_type || e.entryType) === costTypeFilter);
    return entries;
  }, [costEntries, costSearch, costCategoryFilter, costTypeFilter]);

  const filteredProcurement = useMemo(() => {
    let items = procurementRecords;
    if (procSearch) {
      const s = procSearch.toLowerCase();
      items = items.filter((i: ProcurementItemRecord) => (i.title || '').toLowerCase().includes(s) || (i.vendor || '').toLowerCase().includes(s));
    }
    if (procStatusFilter !== 'all') items = items.filter((i: ProcurementItemRecord) => i.status === procStatusFilter);
    return items;
  }, [procurementRecords, procSearch, procStatusFilter]);

  const planningHandoffItems = useMemo(() => {
    const liveKeys = new Set(
      procurementRecords.map((item) => procurementRecordMatchKey(item)),
    );

    let items = planningProcurementShells.filter((item) => !liveKeys.has(item.key));
    if (procSearch) {
      const searchTerm = procSearch.toLowerCase();
      items = items.filter((item) =>
        item.title.toLowerCase().includes(searchTerm)
        || item.vendor.toLowerCase().includes(searchTerm)
        || (item.contractRef || '').toLowerCase().includes(searchTerm),
      );
    }

    if (procStatusFilter !== 'all') return [] as PlanningProcurementShell[];
    return items;
  }, [planningProcurementShells, procurementRecords, procSearch, procStatusFilter]);

  const paymentSummaryByProcurement = useMemo(() => {
    const summary: Record<string, { nextDueDate: string | null; openCount: number; overdueCount: number; missingDueCount: number }> = {};

    paymentRecords.forEach((payment) => {
      const procurementItemId = payment.procurement_item_id || payment.procurementItemId;
      if (!procurementItemId) return;

      const current = summary[procurementItemId] || {
        nextDueDate: null,
        openCount: 0,
        overdueCount: 0,
        missingDueCount: 0,
      };

      if (!isClosedPaymentStatus(payment.status)) {
        current.openCount += 1;

        const dueDate = payment.due_date || payment.dueDate || null;
        if (dueDate) {
          if (!current.nextDueDate || dueDate < current.nextDueDate) {
            current.nextDueDate = dueDate;
          }
        } else {
          current.missingDueCount += 1;
        }

        if (getPaymentDueSignal(payment).label === 'Overdue') {
          current.overdueCount += 1;
        }
      }

      summary[procurementItemId] = current;
    });

    return summary;
  }, [paymentRecords]);

  const selectedProcurementItem = useMemo(() => {
    if (!selectedProcurementId) return null;
    return procurementRecords.find((item) => item.id === selectedProcurementId) || null;
  }, [procurementRecords, selectedProcurementId]);

  const selectedProcurementPlanningLink = useMemo(() => {
    if (!selectedProcurementItem) return null;
    return planningLinkByProcurementId.get(selectedProcurementItem.id) ?? null;
  }, [planningLinkByProcurementId, selectedProcurementItem]);

  const selectedProcurementPayments = useMemo(() => {
    if (!selectedProcurementId) return [] as PaymentRecord[];
    return paymentRecords
      .filter((payment) => (payment.procurement_item_id || payment.procurementItemId) === selectedProcurementId)
      .sort((left, right) => paymentSortKey(left) - paymentSortKey(right));
  }, [paymentRecords, selectedProcurementId]);

  const maxMonthlyValue = useMemo(() => {
    if (budgetAnalysis.monthlyTrend.length === 0) return 1;
    return Math.max(...budgetAnalysis.monthlyTrend.map(m => Math.max(m.actual, m.forecast)));
  }, [budgetAnalysis.monthlyTrend]);

  return (
    <div className="space-y-4">
      {activeTab === 'cost' && (
        <div className="space-y-4">

          {/* ===== SECTION 1: BUDGET OVERVIEW DASHBOARD ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Budget Card */}
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-md bg-primary/10">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Confirmed Budget</div>
                      <div className="text-2xl font-bold tracking-tight">{formatFullCurrency(budgetAnalysis.confirmedBudget)}</div>
                    </div>
                  </div>
                  {(() => {
                    const HealthIcon = budgetAnalysis.healthStatus.icon;
                    return (
                      <Badge
                        variant={budgetAnalysis.healthStatus.label === 'On Track' ? 'default' :
                          budgetAnalysis.healthStatus.label === 'Monitor' ? 'secondary' : 'destructive'}
                        className="text-xs gap-1"
                      >
                        <HealthIcon className="w-3 h-3" />
                        {budgetAnalysis.healthStatus.label}
                      </Badge>
                    );
                  })()}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Budget Utilization</span>
                      <span className="font-medium">{budgetAnalysis.utilization.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          budgetAnalysis.utilization <= 60 ? 'bg-emerald-500' :
                          budgetAnalysis.utilization <= 80 ? 'bg-amber-500' :
                          budgetAnalysis.utilization <= 100 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(budgetAnalysis.utilization, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-muted-foreground">
                        Spent: <span className="font-medium text-foreground">{formatCurrency(budgetAnalysis.totalActualSpend)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Remaining: <span className="font-medium text-foreground">{formatCurrency(Math.max(0, budgetAnalysis.remaining))}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Actual Spend</div>
                      <div className="text-sm font-semibold">{formatCurrency(budgetAnalysis.totalActualSpend)}</div>
                      <div className="text-xs text-muted-foreground">{budgetAnalysis.actualCount} entries</div>
                    </div>
                    <div className="text-center border-x border-border">
                      <div className="text-xs text-muted-foreground mb-0.5">Forecasted</div>
                      <div className="text-sm font-semibold">{formatCurrency(budgetAnalysis.totalForecasted)}</div>
                      <div className="text-xs text-muted-foreground">{budgetAnalysis.forecastCount} entries</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Committed Total</div>
                      <div className="text-sm font-semibold">{formatCurrency(budgetAnalysis.committed)}</div>
                      <div className="text-xs text-muted-foreground">
                        {budgetAnalysis.confirmedBudget > 0
                          ? `${((budgetAnalysis.committed / budgetAnalysis.confirmedBudget) * 100).toFixed(1)}% of budget`
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Metrics Side Panel */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financial Metrics</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total Estimated Cost</span>
                      <span className="text-sm font-semibold">{formatCurrency(budgetAnalysis.totalEstimatedCost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">ROI</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {budgetAnalysis.roi ? `${budgetAnalysis.roi.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">NPV</span>
                      <span className="text-sm font-semibold">{budgetAnalysis.npv ? formatCurrency(budgetAnalysis.npv) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Payback Period</span>
                      <span className="text-sm font-semibold">
                        {budgetAnalysis.paybackPeriod ? `${budgetAnalysis.paybackPeriod.toFixed(1)} yrs` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(budgetAnalysis.implementationCost > 0 || budgetAnalysis.operationsCost > 0 || budgetAnalysis.maintenanceCost > 0) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TCO Breakdown</span>
                    </div>
                    <div className="space-y-2">
                      {budgetAnalysis.implementationCost > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Implementation</span>
                            <span className="font-medium">{formatCurrency(budgetAnalysis.implementationCost)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${budgetAnalysis.totalEstimatedCost > 0 ? (budgetAnalysis.implementationCost / budgetAnalysis.totalEstimatedCost) * 100 : 0}%` }} />
                          </div>
                        </div>
                      )}
                      {budgetAnalysis.operationsCost > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Operations</span>
                            <span className="font-medium">{formatCurrency(budgetAnalysis.operationsCost)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${budgetAnalysis.totalEstimatedCost > 0 ? (budgetAnalysis.operationsCost / budgetAnalysis.totalEstimatedCost) * 100 : 0}%` }} />
                          </div>
                        </div>
                      )}
                      {budgetAnalysis.maintenanceCost > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Maintenance</span>
                            <span className="font-medium">{formatCurrency(budgetAnalysis.maintenanceCost)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${budgetAnalysis.totalEstimatedCost > 0 ? (budgetAnalysis.maintenanceCost / budgetAnalysis.totalEstimatedCost) * 100 : 0}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ===== SECTION 2: SPENDING BREAKDOWN & MONTHLY TREND ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Category Breakdown */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    Spending by Category
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {budgetAnalysis.categoryBreakdown.length} categories
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {budgetAnalysis.categoryBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No cost entries yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {budgetAnalysis.categoryBreakdown.map(cat => (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat.category] || 'bg-slate-500'}`} />
                            <span className="capitalize font-medium">{cat.category}</span>
                            <span className="text-muted-foreground">({cat.count})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(cat.total)}</span>
                            <span className="text-muted-foreground w-12 text-right">{cat.percentOfBudget.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full flex">
                            <div
                              className={`${CATEGORY_COLORS[cat.category] || 'bg-slate-500'} transition-all`}
                              style={{ width: `${budgetAnalysis.confirmedBudget > 0 ? (cat.actual / budgetAnalysis.confirmedBudget) * 100 : 0}%` }}
                            />
                            <div
                              className={`${CATEGORY_COLORS[cat.category] || 'bg-slate-500'} opacity-40 transition-all`}
                              style={{ width: `${budgetAnalysis.confirmedBudget > 0 ? (cat.forecast / budgetAnalysis.confirmedBudget) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>Actual: {formatCurrency(cat.actual)}</span>
                          {cat.forecast > 0 && <span>Forecast: {formatCurrency(cat.forecast)}</span>}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-primary rounded-sm" />
                        <span>Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-primary/40 rounded-sm" />
                        <span>Forecast</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Spending Trend */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    Monthly Spending Trend
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {budgetAnalysis.monthlyTrend.length} months
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {budgetAnalysis.monthlyTrend.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No spending data yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {budgetAnalysis.monthlyTrend.map(month => (
                      <div key={month.month} className="group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-14 shrink-0">{month.label}</span>
                          <div className="flex-1 flex flex-col gap-0.5">
                            {month.actual > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="h-2 bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${maxMonthlyValue > 0 ? (month.actual / maxMonthlyValue) * 100 : 0}%`, minWidth: '4px' }} />
                                <span className="text-xs font-medium shrink-0">{formatCurrency(month.actual)}</span>
                              </div>
                            )}
                            {month.forecast > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="h-2 bg-blue-500/50 rounded-full transition-all"
                                  style={{ width: `${maxMonthlyValue > 0 ? (month.forecast / maxMonthlyValue) * 100 : 0}%`, minWidth: '4px' }} />
                                <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(month.forecast)}</span>
                              </div>
                            )}
                            {month.actual === 0 && month.forecast === 0 && (
                              <div className="h-2" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-emerald-500 rounded-sm" />
                        <span>Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-blue-500/50 rounded-sm" />
                        <span>Forecast</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===== SECTION 3: TOP VENDORS & FORECAST vs ACTUAL ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Vendors */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Top Vendors by Spend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {budgetAnalysis.topVendors.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No vendor data
                  </div>
                ) : (
                  <div className="space-y-3">
                    {budgetAnalysis.topVendors.map((v, idx) => (
                      <div key={v.vendor} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{v.vendor}</span>
                            <span className="text-sm font-semibold shrink-0">{formatCurrency(v.amount)}</span>
                          </div>
                          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${v.percent}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{v.percent.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Forecast vs Actual Summary */}
            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  Forecast vs Actual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Banknote className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Total Actual</span>
                      </div>
                      <div className="text-lg font-bold">{formatCurrency(budgetAnalysis.totalActualSpend)}</div>
                      <div className="text-xs text-muted-foreground">{budgetAnalysis.actualCount} entries</div>
                    </div>
                    <div className="p-3 rounded-md bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Total Forecast</span>
                      </div>
                      <div className="text-lg font-bold">{formatCurrency(budgetAnalysis.totalForecasted)}</div>
                      <div className="text-xs text-muted-foreground">{budgetAnalysis.forecastCount} entries</div>
                    </div>
                  </div>

                  {budgetAnalysis.totalForecasted > 0 && budgetAnalysis.totalActualSpend > 0 && (
                    <div className="p-3 rounded-md bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Forecast Accuracy</span>
                        <span className="text-sm font-semibold">
                          {Math.abs(100 - (budgetAnalysis.totalActualSpend / budgetAnalysis.totalForecasted) * 100).toFixed(1)}% variance
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {budgetAnalysis.totalActualSpend > budgetAnalysis.totalForecasted
                          ? `Actual spending exceeds forecast by ${formatCurrency(budgetAnalysis.totalActualSpend - budgetAnalysis.totalForecasted)}`
                          : `Actual spending is ${formatCurrency(budgetAnalysis.totalForecasted - budgetAnalysis.totalActualSpend)} under forecast`}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-md border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Uncommitted Budget</span>
                      <span className={`text-sm font-semibold ${budgetAnalysis.uncommitted < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {formatCurrency(budgetAnalysis.uncommitted)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Budget not yet allocated to actual or forecasted costs
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ===== SECTION 4: COST ENTRIES LIST ===== */}
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  Cost Entries Register
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={costViewMode === 'breakdown' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setCostViewMode('breakdown')}
                    >
                      Summary
                    </Button>
                    <Button
                      variant={costViewMode === 'entries' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setCostViewMode('entries')}
                    >
                      All Entries
                    </Button>
                    <Button
                      variant={costViewMode === 'task-costs' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setCostViewMode('task-costs')}
                    >
                      Task Costs
                    </Button>
                  </div>
                  <Button size="sm" onClick={() => setShowCostDialog(true)} className="gap-1">
                    <Plus className="w-4 h-4" /> Record Cost
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {costViewMode === 'entries' && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t('projectWorkspace.costProcurement.searchCosts')}
                      value={costSearch}
                      onChange={e => setCostSearch(e.target.value)}
                      className="pl-8 w-48"
                    />
                  </div>
                  <Select value={costCategoryFilter} onValueChange={setCostCategoryFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder={t('projectWorkspace.costProcurement.category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {COST_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={costTypeFilter} onValueChange={setCostTypeFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={t('projectWorkspace.costProcurement.type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="actual">Actual</SelectItem>
                      <SelectItem value="forecast">Forecast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {loadingCosts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : costViewMode === 'breakdown' ? (
                <div>
                  {budgetAnalysis.categoryBreakdown.length === 0 ? (
                    <div className="text-center py-8">
                      <CircleDollarSign className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">{t('projectWorkspace.costProcurement.noCostEntriesRecorded')}</p>
                      <Button size="sm" variant="outline" onClick={() => setShowCostDialog(true)}>
                        Record First Cost
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actual</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Forecast</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">% of Budget</th>
                            <th className="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetAnalysis.categoryBreakdown.map(cat => (
                            <tr key={cat.category} className="border-b border-border/50">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat.category] || 'bg-slate-500'}`} />
                                  <span className="capitalize font-medium">{cat.category}</span>
                                  <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(cat.actual)}</td>
                              <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(cat.forecast)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(cat.total)}</td>
                              <td className="py-2.5 px-3 text-right">{cat.percentOfBudget.toFixed(1)}%</td>
                              <td className="py-2.5 px-3">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${CATEGORY_COLORS[cat.category] || 'bg-slate-500'} rounded-full`}
                                    style={{ width: `${Math.min(cat.percentOfBudget, 100)}%` }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border font-semibold">
                            <td className="py-2.5 px-3">Total</td>
                            <td className="py-2.5 px-3 text-right">{formatCurrency(budgetAnalysis.totalActualSpend)}</td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(budgetAnalysis.totalForecasted)}</td>
                            <td className="py-2.5 px-3 text-right">{formatCurrency(budgetAnalysis.committed)}</td>
                            <td className="py-2.5 px-3 text-right">
                              {budgetAnalysis.confirmedBudget > 0
                                ? `${((budgetAnalysis.committed / budgetAnalysis.confirmedBudget) * 100).toFixed(1)}%`
                                : '-'}
                            </td>
                            <td className="py-2.5 px-3" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ) : costViewMode === 'task-costs' ? (
                <div className="space-y-4">
                  {loadingTasks ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                          {taskCostAnalysis.cpi > 0 && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${
                              taskCostAnalysis.cpi >= 1
                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                : 'bg-red-500/5 border-red-500/20'
                            }`}>
                              {taskCostAnalysis.cpi >= 1
                                ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                                : <TrendingDown className="w-4 h-4 text-red-500" />}
                              <span className="text-xs text-muted-foreground">CPI</span>
                              <span className={`text-sm font-bold ${
                                taskCostAnalysis.cpi >= 1
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {taskCostAnalysis.cpi.toFixed(2)}
                              </span>
                              <Badge variant={taskCostAnalysis.cpi >= 1 ? 'default' : 'destructive'} className="text-xs">
                                {taskCostAnalysis.cpi >= 1 ? 'Under Budget' : 'Over Budget'}
                              </Badge>
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {taskCostAnalysis.tasks.length} of {taskCostAnalysis.allTasks.length} tasks
                          </span>
                        </div>
                        <Button
                          variant={showCostTasksAll ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setShowCostTasksAll(!showCostTasksAll)}
                        >
                          {showCostTasksAll ? 'Show With Costs' : 'Show All Tasks'}
                        </Button>
                      </div>

                      {taskCostAnalysis.tasks.length === 0 ? (
                        <div className="text-center py-8">
                          <Target className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">{t('projectWorkspace.costProcurement.noWbsTasksWithCostData')}</p>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[500px]">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">WBS Code</th>
                                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Task Name</th>
                                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Planned (AED)</th>
                                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actual (AED)</th>
                                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Variance</th>
                                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Var %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {taskCostAnalysis.tasks.map((task) => (
                                  <tr key={task.id} className="border-b border-border/50">
                                    <td className="py-2.5 px-3">
                                      <span className="font-mono text-xs">{task.taskCode}</span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-medium">{task.name}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <Badge variant={STATUS_CONFIG[task.status]?.variant || 'secondary'} className="text-xs">
                                        {STATUS_CONFIG[task.status]?.label || task.status}
                                      </Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium">
                                      {task.planned > 0 ? formatFullCurrency(task.planned) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {editingTaskId === task.id ? (
                                        <div className="flex items-center gap-1 justify-end">
                                          <Input
                                            type="number"
                                            value={editingCostValue}
                                            onChange={(e) => setEditingCostValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                updateActualCostMutation.mutate({ taskId: task.id, actualCost: editingCostValue });
                                              }
                                              if (e.key === 'Escape') setEditingTaskId(null);
                                            }}
                                            onBlur={() => {
                                              if (editingCostValue !== String(task.actual)) {
                                                updateActualCostMutation.mutate({ taskId: task.id, actualCost: editingCostValue });
                                              } else {
                                                setEditingTaskId(null);
                                              }
                                            }}
                                            className="w-28 text-right"
                                            autoFocus
                                          />
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => updateActualCostMutation.mutate({ taskId: task.id, actualCost: editingCostValue })}
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <button
                                          className="inline-flex items-center gap-1.5 cursor-pointer group"
                                          onClick={() => {
                                            setEditingTaskId(task.id);
                                            setEditingCostValue(String(task.actual || ''));
                                          }}
                                        >
                                          <span className="font-medium">
                                            {task.actual > 0 ? formatFullCurrency(task.actual) : <span className="text-muted-foreground">-</span>}
                                          </span>
                                          <Pencil className="w-3 h-3 text-muted-foreground invisible group-hover:visible" />
                                        </button>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {(task.planned > 0 || task.actual > 0) ? (
                                        <span className={`font-medium ${
                                          task.variance > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                          task.variance < 0 ? 'text-red-600 dark:text-red-400' :
                                          'text-muted-foreground'
                                        }`}>
                                          {task.variance > 0 ? '+' : ''}{formatFullCurrency(task.variance)}
                                        </span>
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {(task.planned > 0 || task.actual > 0) ? (
                                        <Badge
                                          variant={task.variance > 0 ? 'default' : task.variance < 0 ? 'destructive' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {task.variancePercent > 0 ? '+' : ''}{task.variancePercent.toFixed(1)}%
                                        </Badge>
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-border font-semibold">
                                  <td className="py-2.5 px-3" colSpan={3}>Total</td>
                                  <td className="py-2.5 px-3 text-right">{formatFullCurrency(taskCostAnalysis.totalPlanned)}</td>
                                  <td className="py-2.5 px-3 text-right">{formatFullCurrency(taskCostAnalysis.totalActual)}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    <span className={`${
                                      taskCostAnalysis.totalVariance > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                      taskCostAnalysis.totalVariance < 0 ? 'text-red-600 dark:text-red-400' : ''
                                    }`}>
                                      {taskCostAnalysis.totalVariance > 0 ? '+' : ''}{formatFullCurrency(taskCostAnalysis.totalVariance)}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {taskCostAnalysis.totalPlanned > 0 && (
                                      <Badge
                                        variant={taskCostAnalysis.totalVariance >= 0 ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {((taskCostAnalysis.totalVariance / taskCostAnalysis.totalPlanned) * 100).toFixed(1)}%
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </ScrollArea>
                      )}
                    </>
                  )}
                </div>
              ) : filteredCosts.length === 0 ? (
                <div className="text-center py-8">
                  <CircleDollarSign className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{t('projectWorkspace.costProcurement.noCostEntriesFound')}</p>
                  <Button size="sm" variant="outline" onClick={() => setShowCostDialog(true)}>
                    Record First Cost
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {filteredCosts.map((entry: CostEntryRecord) => {
                      const entryType = entry.entry_type || entry.entryType || 'actual';
                      const costDate = entry.cost_date || entry.costDate;
                      const invoiceRef = entry.invoice_ref || entry.invoiceRef;
                      const cat = entry.category || 'other';
                      return (
                        <div key={entry.id} className="flex items-center gap-3 p-3 rounded-md border border-border/50 hover-elevate">
                          <div className={`w-1 h-10 rounded-full ${CATEGORY_COLORS[cat] || 'bg-slate-500'}`} />
                          <div className={`p-2 rounded-md ${entryType === 'actual' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                            {entryType === 'actual'
                              ? <Banknote className="w-4 h-4 text-emerald-500" />
                              : <CreditCard className="w-4 h-4 text-blue-500" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{entry.description}</span>
                              <Badge variant={entryType === 'actual' ? 'default' : 'secondary'} className="text-xs">
                                {entryType}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">{cat}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              {entry.vendor && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{entry.vendor}</span>}
                              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(costDate)}</span>
                              {invoiceRef && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{invoiceRef}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="font-semibold text-sm">{formatFullCurrency(entry.amount, entry.currency)}</div>
                              {entry.status && (
                                <Badge variant={STATUS_CONFIG[entry.status]?.variant || 'secondary'} className="text-xs mt-0.5">
                                  {STATUS_CONFIG[entry.status]?.label || entry.status}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteCostMutation.mutate(entry.id)}
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'procurement' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Contract Value</div>
                    <div className="text-lg font-semibold">{formatCurrency(procStats.totalValue)}</div>
                    <div className="text-xs text-muted-foreground">{procStats.totalItems} items</div>
                  </div>
                  <div className="p-2 rounded-md bg-blue-500/10">
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Paid</div>
                    <div className="text-lg font-semibold">{formatCurrency(procStats.totalPaid)}</div>
                    <div className="text-xs text-muted-foreground">
                      {procStats.totalValue > 0
                        ? `${((procStats.totalPaid / procStats.totalValue) * 100).toFixed(1)}% disbursed`
                        : '-'}
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-emerald-500/10">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Active Contracts</div>
                    <div className="text-lg font-semibold">{procStats.active}</div>
                    <div className="text-xs text-muted-foreground">in progress</div>
                  </div>
                  <div className="p-2 rounded-md bg-orange-500/10">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="text-lg font-semibold">{procStats.completed}</div>
                    <div className="text-xs text-muted-foreground">contracts closed</div>
                  </div>
                  <div className="p-2 rounded-md bg-emerald-500/10">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t('projectWorkspace.costProcurement.searchProcurement')}
                      value={procSearch}
                      onChange={e => setProcSearch(e.target.value)}
                      className="pl-8 w-48"
                    />
                  </div>
                  <Select value={procStatusFilter} onValueChange={setProcStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder={t('projectWorkspace.costProcurement.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={() => setShowProcDialog(true)} className="gap-1">
                  <Plus className="w-4 h-4" /> Add Procurement
                </Button>
              </div>
            </CardContent>
          </Card>

          {planningHandoffItems.length > 0 && (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ArrowRight className="w-4 h-4 text-primary" />
                      Planning handoff queue
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Contracts added in Planning are visible here until they are materialized into live Execution procurement records.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {planningHandoffItems.length} pending from Planning
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {planningHandoffItems.map((item) => (
                  <div key={item.key} className="rounded-lg border border-dashed border-border bg-background/80 p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{item.title}</span>
                          <Badge variant="outline" className="text-xs">Planned in Planning</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.vendor}</span>
                          {item.contractRef ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{item.contractRef}</span> : null}
                          {item.startDate ? <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(item.startDate)} - {formatDate(item.endDate)}</span> : null}
                          {item.dueDate ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Planned due {formatDate(item.dueDate)}</span> : null}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{item.sourceLabel}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-auto">
                        <div className="text-sm font-semibold whitespace-nowrap">{formatCurrency(item.contractValue, item.currency)}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => importPlanningShell(item)}
                          disabled={createProcMutation.isPending}
                        >
                          {createProcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Import to Execution
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {loadingProcurement ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProcurement.length === 0 && planningHandoffItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">{t('projectWorkspace.costProcurement.noProcurementItemsFound')}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowProcDialog(true)}>
                  Add First Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {filteredProcurement.map((item: ProcurementItemRecord) => {
                  const planningLink = getPlanningLinkForProcurement(item);
                  const isPlanningSyncing = autoSyncingProcurementId === item.id;
                  const contractValue = getResolvedProcurementContractValue(item);
                  const paidAmount = procurementPaidAmount(item);
                  const progress = contractValue > 0 ? (paidAmount / contractValue) * 100 : 0;
                  const startDate = item.start_date || item.startDate;
                  const endDate = item.end_date || item.endDate;
                  const contractRef = item.contract_ref || item.contractRef;
                  const procType = item.procurement_type || item.procurementType || 'service';
                  const paymentSummary = paymentSummaryByProcurement[item.id];
                  return (
                    <Card
                      key={item.id}
                      className={`hover-elevate cursor-pointer transition-colors ${selectedProcurementId === item.id ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`}
                      onClick={() => {
                        setSelectedProcurementId(item.id);
                        setFocusedPaymentId(null);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-blue-500/10">
                              {procType === 'product' ? <Package className="w-4 h-4 text-blue-500" /> :
                               procType === 'license' ? <FileText className="w-4 h-4 text-blue-500" /> :
                               <Truck className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{item.title}</span>
                                <Badge variant={STATUS_CONFIG[item.status]?.variant || 'secondary'} className="text-xs">
                                  {STATUS_CONFIG[item.status]?.label || item.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs capitalize">{procType}</Badge>
                                {paymentSummary?.overdueCount ? (
                                  <Badge variant="destructive" className="text-xs">{paymentSummary.overdueCount} overdue</Badge>
                                ) : null}
                                {paymentSummary?.nextDueDate ? (
                                  <Badge variant="outline" className="text-xs">Next due {formatDate(paymentSummary.nextDueDate)}</Badge>
                                ) : null}
                                {planningLink?.needsSync ? (
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-500/50 dark:text-amber-300">
                                    {isPlanningSyncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                    {isPlanningSyncing
                                      ? 'Syncing planning value'
                                      : `Draft mirrors planning ${formatCurrency(planningLink.shell.contractValue, planningLink.shell.currency)}`}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.vendor}</span>
                                {contractRef && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{contractRef}</span>}
                                {startDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(startDate)} - {formatDate(endDate)}</span>}
                                {paymentSummary?.missingDueCount ? (
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    {paymentSummary.missingDueCount} reminder gaps
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatCurrency(paidAmount)} / {formatCurrency(contractValue)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateProcStatusMutation.mutate({ id: item.id, status: 'active' });
                                }}
                              >
                                Activate
                              </Button>
                            )}
                            {item.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateProcStatusMutation.mutate({ id: item.id, status: 'completed' });
                                }}
                              >
                                Complete
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteProcMutation.mutate(item.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* ===== PAYMENT REGISTER ===== */}
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  Payment Register
                </CardTitle>
                <Button size="sm" onClick={() => openPaymentDialog()} className="gap-1">
                  <Plus className="w-4 h-4" /> Record Payment
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingPayments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (payments as unknown[]).length === 0 ? (
                <div className="text-center py-8">
                  <Banknote className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{t('projectWorkspace.costProcurement.noPaymentsRecorded')}</p>
                  <Button size="sm" variant="outline" onClick={() => openPaymentDialog()}>
                    Record First Payment
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Due</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt Ref</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentRecords.map((payment: PaymentRecord) => {
                          const payDate = payment.payment_date || payment.paymentDate;
                          const dueDate = payment.due_date || payment.dueDate;
                          const method = payment.payment_method || payment.paymentMethod || 'bank_transfer';
                          const receiptRef = payment.receipt_ref || payment.receiptRef || '-';
                          const procItemId = payment.procurement_item_id || payment.procurementItemId;
                          const procItem = procurementRecords.find((p: ProcurementItemRecord) => p.id === procItemId);
                          const dueSignal = getPaymentDueSignal(payment);
                          return (
                            <tr
                              key={payment.id}
                              className={`border-b border-border/50 ${focusedPaymentId === payment.id ? 'bg-primary/5' : 'hover:bg-muted/40'} ${procItemId ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (!procItemId) return;
                                setSelectedProcurementId(procItemId);
                                setFocusedPaymentId(payment.id);
                              }}
                            >
                              <td className="py-2.5 px-3">
                                <span className="text-sm">{formatDate(payDate)}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-sm">{formatDate(dueDate)}</span>
                                  <Badge variant={dueSignal.variant} className="text-[10px]">
                                    {dueSignal.label}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-sm">{procItem?.title || payment.description || '-'}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="font-semibold">{formatFullCurrency(payment.amount, payment.currency)}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant="outline" className="text-xs">
                                  {PAYMENT_METHOD_LABELS[method] || method}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-sm text-muted-foreground">{receiptRef}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={STATUS_CONFIG[payment.status ?? '']?.variant || 'secondary'} className="text-xs">
                                  {STATUS_CONFIG[payment.status ?? '']?.label || payment.status || 'Recorded'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deletePaymentMutation.mutate(payment.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ExecutionProcurementDetailPanel
        open={Boolean(selectedProcurementItem)}
        item={selectedProcurementItem}
        planningLink={selectedProcurementPlanningLink}
        payments={selectedProcurementPayments}
        focusedPaymentId={focusedPaymentId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProcurementId(null);
            setFocusedPaymentId(null);
          }
        }}
        onPlanPayment={() => {
          if (!selectedProcurementItem) return;
          openPaymentDialog({
            procurementItemId: selectedProcurementItem.id,
            dueDate: paymentSummaryByProcurement[selectedProcurementItem.id]?.nextDueDate || todayDate(),
            status: 'scheduled',
          });
        }}
        onRecordPayment={() => {
          if (!selectedProcurementItem) return;
          openPaymentDialog({ procurementItemId: selectedProcurementItem.id, status: 'completed' });
        }}
        onActivate={selectedProcurementItem?.status === 'draft'
          ? () => updateProcStatusMutation.mutate({ id: selectedProcurementItem.id, status: 'active' })
          : undefined}
        onComplete={selectedProcurementItem?.status === 'active'
          ? () => updateProcStatusMutation.mutate({ id: selectedProcurementItem.id, status: 'completed' })
          : undefined}
        isStatusMutating={updateProcStatusMutation.isPending}
        onCompletePayment={(paymentId) => {
          updatePaymentMutation.mutate({
            id: paymentId,
            updates: {
              status: 'completed',
              paymentDate: todayDate(),
            },
          });
        }}
        isPaymentUpdating={updatePaymentMutation.isPending}
        isSyncingPlanningValue={Boolean(selectedProcurementItem && autoSyncingProcurementId === selectedProcurementItem.id)}
      />

      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Record Cost Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={costForm.entryType} onValueChange={v => setCostForm(f => ({ ...f, entryType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actual">Actual Cost</SelectItem>
                    <SelectItem value="forecast">Forecast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={costForm.category} onValueChange={v => setCostForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COST_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                value={costForm.description}
                onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.costDescription')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={costForm.amount}
                  onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={costForm.currency} onValueChange={v => setCostForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor</Label>
                <Input
                  value={costForm.vendor}
                  onChange={e => setCostForm(f => ({ ...f, vendor: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.vendorName')}
                />
              </div>
              <div>
                <Label>Invoice Ref</Label>
                <Input
                  value={costForm.invoiceRef}
                  onChange={e => setCostForm(f => ({ ...f, invoiceRef: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.invoicePlaceholder')}
                />
              </div>
            </div>
            <div>
              <Label>Cost Date *</Label>
              <Input
                type="date"
                value={costForm.costDate}
                onChange={e => setCostForm(f => ({ ...f, costDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={costForm.notes}
                onChange={e => setCostForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.additionalNotes')}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostDialog(false)}>Cancel</Button>
            <Button onClick={handleCostSubmit} disabled={createCostMutation.isPending} className="gap-1">
              {createCostMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Cost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProcDialog} onOpenChange={setShowProcDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Add Procurement Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={procForm.procurementType} onValueChange={v => setProcForm(f => ({ ...f, procurementType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROCUREMENT_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={procForm.currency} onValueChange={v => setProcForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                value={procForm.title}
                onChange={e => setProcForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.contractTitle')}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={procForm.description}
                onChange={e => setProcForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.procurementDescription')}
                className="resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor *</Label>
                <Input
                  value={procForm.vendor}
                  onChange={e => setProcForm(f => ({ ...f, vendor: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.vendorName')}
                />
              </div>
              <div>
                <Label>Vendor Contact</Label>
                <Input
                  value={procForm.vendorContact}
                  onChange={e => setProcForm(f => ({ ...f, vendorContact: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.contactEmail')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contract Ref</Label>
                <Input
                  value={procForm.contractRef}
                  onChange={e => setProcForm(f => ({ ...f, contractRef: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.contractNumber')}
                />
              </div>
              <div>
                <Label>Contract Value *</Label>
                <Input
                  type="number"
                  value={procForm.contractValue}
                  onChange={e => setProcForm(f => ({ ...f, contractValue: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={procForm.startDate}
                  onChange={e => setProcForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={procForm.endDate}
                  onChange={e => setProcForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Input
                value={procForm.paymentTerms}
                onChange={e => setProcForm(f => ({ ...f, paymentTerms: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.paymentTermsPlaceholder')}
              />
            </div>
            <div>
              <Label>Deliverables (comma-separated)</Label>
              <Input
                value={procForm.deliverables}
                onChange={e => setProcForm(f => ({ ...f, deliverables: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.itemsList')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcDialog(false)}>Cancel</Button>
            <Button onClick={handleProcSubmit} disabled={createProcMutation.isPending} className="gap-1">
              {createProcMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Procurement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Procurement Item *</Label>
              <Select value={paymentForm.procurementItemId} onValueChange={v => setPaymentForm(f => ({ ...f, procurementItemId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('projectWorkspace.costProcurement.selectContract')} /></SelectTrigger>
                <SelectContent>
                  {(procurementItems as ProcurementItemRecord[]).map((item: ProcurementItemRecord) => (
                    <SelectItem key={item.id} value={item.id}>{item.title} - {item.vendor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={paymentForm.currency} onValueChange={v => setPaymentForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={paymentForm.status} onValueChange={v => setPaymentForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Scheduled and approval-stage payment events stay outside disbursed totals until they are marked completed.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={paymentForm.dueDate}
                  onChange={e => setPaymentForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Payment / Settlement Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Receipt Reference</Label>
                <Input
                  value={paymentForm.receiptRef}
                  onChange={e => setPaymentForm(f => ({ ...f, receiptRef: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.receiptNumber')}
                />
              </div>
              <div>
                <Label>Invoice Reference</Label>
                <Input
                  value={paymentForm.invoiceRef}
                  onChange={e => setPaymentForm(f => ({ ...f, invoiceRef: e.target.value }))}
                  placeholder={t('projectWorkspace.costProcurement.invoiceNumberPlaceholder')}
                />
              </div>
            </div>
            <div>
              <Label>Milestone Reference</Label>
              <Input
                value={paymentForm.milestoneRef}
                onChange={e => setPaymentForm(f => ({ ...f, milestoneRef: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.milestonePlaceholder')}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={paymentForm.description}
                onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.paymentDescription')}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('projectWorkspace.costProcurement.additionalNotesPayment')}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} disabled={createPaymentMutation.isPending} className="gap-1">
              {createPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ExecutionProcurementDetailPanelProps {
  open: boolean;
  item: ProcurementItemRecord | null;
  planningLink?: PlanningProcurementLink | null;
  payments: PaymentRecord[];
  focusedPaymentId: string | null;
  onOpenChange: (open: boolean) => void;
  onPlanPayment: () => void;
  onRecordPayment: () => void;
  onActivate?: () => void;
  onComplete?: () => void;
  isStatusMutating: boolean;
  onCompletePayment: (paymentId: string) => void;
  isPaymentUpdating: boolean;
  isSyncingPlanningValue?: boolean;
}

function ExecutionProcurementDetailPanel({
  open,
  item,
  planningLink,
  payments,
  focusedPaymentId,
  onOpenChange,
  onPlanPayment,
  onRecordPayment,
  onActivate,
  onComplete,
  isStatusMutating,
  onCompletePayment,
  isPaymentUpdating,
  isSyncingPlanningValue,
}: ExecutionProcurementDetailPanelProps) {
  if (!item) return null;

  const contractValue = planningLink?.resolvedContractValue ?? procurementContractValue(item);
  const paidAmount = procurementPaidAmount(item);
  const remaining = contractValue - paidAmount;
  const startDate = item.start_date || item.startDate;
  const endDate = item.end_date || item.endDate;
  const contractRef = item.contract_ref || item.contractRef;
  const procurementType = item.procurement_type || item.procurementType || 'service';
  const vendorContact = item.vendor_contact || item.vendorContact;
  const paymentTerms = item.payment_terms || item.paymentTerms;
  const deliverables = item.deliverables || [];
  const currency = item.currency || 'AED';

  const openPayments = payments.filter((payment) => !isClosedPaymentStatus(payment.status));
  const openWithoutDue = openPayments.filter((payment) => !(payment.due_date || payment.dueDate));
  const overduePayments = openPayments.filter((payment) => getPaymentDueSignal(payment).label === 'Overdue');
  const nextDuePayment = [...openPayments]
    .filter((payment) => Boolean(payment.due_date || payment.dueDate))
    .sort((left, right) => paymentSortKey(left) - paymentSortKey(right))[0] || null;
  const scheduledExposure = openPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);

  const remindersSummary = overduePayments.length > 0
    ? `${overduePayments.length} payment obligations are overdue.`
    : openWithoutDue.length > 0
      ? `${openWithoutDue.length} open payment events cannot trigger reminders yet.`
      : nextDuePayment
        ? getPaymentDueSignal(nextDuePayment).detail
        : 'No active payment reminders are configured on this contract.';

  const nextActions: string[] = [];
  if (item.status === 'draft') {
    nextActions.push('Activate the contract before treating due dates as live execution commitments.');
  }
  if (payments.length === 0) {
    nextActions.push('No payment schedule is attached yet. Add a scheduled payment event with a due date to enable reminders.');
  }
  if (openWithoutDue.length > 0) {
    nextActions.push(`${openWithoutDue.length} open payment events are missing due dates and need reminder anchors.`);
  }
  if (overduePayments.length > 0) {
    nextActions.push(`${overduePayments.length} payment events are overdue against the execution plan and need supplier or finance follow-up.`);
  }
  if (remaining <= 0 && item.status !== 'completed') {
    nextActions.push('Disbursed value has reached the contract cap. Review closure or change-control before issuing more payments.');
  }
  if (nextActions.length === 0) {
    nextActions.push('Payment schedule is anchored with due dates and there are no overdue execution commitments on this line.');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border bg-background/95 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-lg leading-tight">{item.title}</SheetTitle>
                <Badge variant={STATUS_CONFIG[item.status]?.variant || 'secondary'} className="text-xs">
                  {STATUS_CONFIG[item.status]?.label || item.status}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">{procurementType}</Badge>
              </div>
              <SheetDescription className="flex items-center gap-3 flex-wrap text-xs">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.vendor}</span>
                {contractRef ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{contractRef}</span> : null}
                {startDate ? <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(startDate)} - {formatDate(endDate)}</span> : null}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Contract Value</div>
                  <div className="text-lg font-semibold">{formatFullCurrency(contractValue, currency)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {planningLink?.needsSync
                      ? isSyncingPlanningValue
                        ? 'Syncing the planning baseline into the draft execution record.'
                        : 'Draft items inherit the planning baseline automatically until activation.'
                      : 'Commercial baseline'}
                  </div>
                  {planningLink?.needsSync ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-500/50 dark:text-amber-300">
                        {isSyncingPlanningValue ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Planning {formatFullCurrency(planningLink.shell.contractValue, planningLink.shell.currency)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {isSyncingPlanningValue ? 'Updating execution record...' : 'Draft stays aligned automatically.'}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Disbursed</div>
                  <div className="text-lg font-semibold">{formatFullCurrency(paidAmount, currency)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {contractValue > 0 ? `${((paidAmount / contractValue) * 100).toFixed(1)}% of contract` : 'No contract cap'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Open Payment Plan</div>
                  <div className="text-lg font-semibold">{formatFullCurrency(scheduledExposure, currency)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{openPayments.length} active payment events</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Reminder Readiness</div>
                  <div className="text-sm font-semibold">
                    {nextDuePayment ? formatDate(nextDuePayment.due_date || nextDuePayment.dueDate) : 'No next due date'}
                  </div>
                  <div className={`text-xs mt-1 ${overduePayments.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {remindersSummary}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  Next Best Moves
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {nextActions.map((action) => (
                  <div key={action} className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-sm leading-5">{action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  Payment Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {payments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No payment events linked yet. Add a scheduled entry with a due date to start reminder coverage.
                  </div>
                ) : payments.map((payment) => {
                  const dueSignal = getPaymentDueSignal(payment);
                  const paymentDate = payment.payment_date || payment.paymentDate;
                  const dueDate = payment.due_date || payment.dueDate;
                  const milestoneRef = payment.milestone_ref || payment.milestoneRef;
                  const invoiceRef = payment.invoice_ref || payment.invoiceRef;
                  const method = payment.payment_method || payment.paymentMethod || 'bank_transfer';

                  return (
                    <div
                      key={payment.id}
                      className={`rounded-lg border p-3 space-y-2 ${focusedPaymentId === payment.id ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-background'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{payment.description || milestoneRef || 'Payment event'}</p>
                            <Badge variant={STATUS_CONFIG[payment.status || '']?.variant || 'secondary'} className="text-[10px]">
                              {STATUS_CONFIG[payment.status || '']?.label || payment.status || 'Completed'}
                            </Badge>
                            <Badge variant={dueSignal.variant} className="text-[10px]">
                              {dueSignal.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{dueSignal.detail}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold">{formatFullCurrency(payment.amount, payment.currency || currency)}</div>
                          <div className="text-xs text-muted-foreground mt-1">{PAYMENT_METHOD_LABELS[method] || method}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due {formatDate(dueDate)}</span>
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Paid {formatDate(paymentDate)}</span>
                        {invoiceRef ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{invoiceRef}</span> : null}
                        {milestoneRef ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{milestoneRef}</span> : null}
                      </div>

                      {!isClosedPaymentStatus(payment.status) ? (
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCompletePayment(payment.id)}
                            disabled={isPaymentUpdating}
                          >
                            Mark Completed
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Contract Context
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3 text-sm">
                {item.description ? <p className="text-muted-foreground leading-6">{item.description}</p> : null}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground mb-1">Remaining Headroom</div>
                    <div className={`font-semibold ${remaining < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {formatFullCurrency(remaining, currency)}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground mb-1">Vendor Contact</div>
                    <div className="font-semibold break-words">{vendorContact || 'Not captured'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment Terms</div>
                  <div className="text-sm">{paymentTerms || 'No payment terms recorded yet.'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Deliverables</div>
                  {deliverables.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {deliverables.map((deliverable) => (
                        <Badge key={deliverable} variant="outline" className="text-xs">{deliverable}</Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No deliverables linked to this contract line.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-background/95">
          <div className="text-xs text-muted-foreground max-w-[260px]">
            Scheduled and approval-stage payment events stay outside disbursed totals until they are marked completed.
          </div>
          <div className="flex items-center gap-2">
            {onActivate ? (
              <Button size="sm" variant="outline" onClick={onActivate} disabled={isStatusMutating}>
                Activate
              </Button>
            ) : null}
            {onComplete ? (
              <Button size="sm" variant="outline" onClick={onComplete} disabled={isStatusMutating}>
                Complete
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onPlanPayment}>
              Plan Payment
            </Button>
            <Button size="sm" onClick={onRecordPayment}>
              Record Payment
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
