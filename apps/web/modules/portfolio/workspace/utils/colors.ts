export const phaseColors: Record<string, string> = {
  initiation: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40',
  planning: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/40',
  execution: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40',
  monitoring: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40',
  closing: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40',
};

export const healthColors: Record<string, string> = {
  on_track: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  at_risk: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  critical: 'bg-red-500/20 text-red-600 dark:text-red-400',
  delayed: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
};

export const riskLevelColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40',
  low: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40',
};

export const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  low: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
};

export const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  resolved: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
  pending: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  approved: 'bg-green-500/20 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/20 text-red-600 dark:text-red-400',
};

export const gateStatusColors: Record<string, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-500',
  submitted: 'bg-violet-500',
  in_review: 'bg-blue-500',
  in_progress: 'bg-blue-500',
  rejected: 'bg-red-500',
  not_started: 'bg-muted-foreground',
};

export const gateStatusLabels: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending',
  submitted: 'Awaiting PMO Review',
  in_review: 'Under PMO Review',
  in_progress: 'In Progress',
  rejected: 'Rejected',
  not_started: 'Not Started',
};

export const getCapacityColor = (current: number, max: number): string => {
  const ratio = current / max;
  if (ratio >= 0.9) return 'bg-red-500';
  if (ratio >= 0.7) return 'bg-amber-500';
  if (ratio >= 0.5) return 'bg-blue-500';
  return 'bg-emerald-500';
};

export const getMatchBadgeStyle = (score: number): string => {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40';
  if (score >= 60) return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40';
  if (score >= 40) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40';
  return 'bg-muted/20 text-muted-foreground border-border/40';
};

export const getInfluenceColor = (level: string): string => {
  switch (level?.toLowerCase()) {
    case 'high': return 'border-red-500 bg-red-500/10';
    case 'medium': return 'border-amber-500 bg-amber-500/10';
    case 'low': return 'border-emerald-500 bg-emerald-500/10';
    default: return 'border-border bg-muted/30';
  }
};

export const getInterestColor = (level: string): string => {
  switch (level?.toLowerCase()) {
    case 'high': return 'text-emerald-600 dark:text-emerald-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    case 'low': return 'text-muted-foreground';
    default: return 'text-muted-foreground/70';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'on_track': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'at_risk': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'blocked': return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
    default: return 'bg-muted/50 text-muted-foreground border-border/30';
  }
};

export const getMatrixColor = (level: string): string => {
  switch (level) {
    case 'Critical': return 'bg-red-600 text-white';
    case 'High': return 'bg-orange-500 text-white';
    case 'Medium': return 'bg-amber-500 text-white';
    case 'Low': return 'bg-emerald-500 text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};
