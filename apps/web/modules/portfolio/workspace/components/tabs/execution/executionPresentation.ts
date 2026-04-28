export function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    case 'blocked':
      return 'bg-red-500/20 text-red-600 dark:text-red-400';
    case 'on_hold':
      return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getPriorityBadgeClass(priority?: string) {
  switch (priority) {
    case 'critical':
      return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
    case 'high':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400';
    case 'medium':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'low':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    default:
      return 'border-border/60 bg-muted/60 text-muted-foreground';
  }
}

export function getRiskColor(level: string) {
  switch (level?.toLowerCase()) {
    case 'critical':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-amber-500';
    case 'low':
      return 'bg-emerald-500';
    default:
      return 'bg-gray-500';
  }
}

export function formatCommandCenterDate(value?: string | Date | null) {
  if (!value) return 'No date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
