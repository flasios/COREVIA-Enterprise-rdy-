type RequirementPriority = 'High' | 'Medium' | 'Low';

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'High':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    case 'Medium':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
    case 'Low':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function calculatePriorityDistribution(items: Array<{ priority: RequirementPriority }>) {
  const total = items.length;
  const high = items.filter((item) => item.priority === 'High').length;
  const medium = items.filter((item) => item.priority === 'Medium').length;
  const low = items.filter((item) => item.priority === 'Low').length;

  return {
    high: { count: high, percentage: total > 0 ? (high / total) * 100 : 0 },
    medium: { count: medium, percentage: total > 0 ? (medium / total) * 100 : 0 },
    low: { count: low, percentage: total > 0 ? (low / total) * 100 : 0 },
  };
}

export function PrioritySparkline({ items }: { items: Array<{ priority: RequirementPriority }> }) {
  const dist = calculatePriorityDistribution(items);

  return (
    <div className="flex items-center gap-1.5" data-testid="priority-sparkline">
      <div className="flex gap-0.5 h-4 flex-1 max-w-[120px]">
        {dist.high.percentage > 0 && (
          <div
            className="bg-gradient-to-t from-red-500 to-red-400 rounded-sm transition-all hover:opacity-80"
            style={{ width: `${dist.high.percentage}%` }}
            title={`High: ${dist.high.count}`}
          />
        )}
        {dist.medium.percentage > 0 && (
          <div
            className="bg-gradient-to-t from-amber-500 to-amber-400 rounded-sm transition-all hover:opacity-80"
            style={{ width: `${dist.medium.percentage}%` }}
            title={`Medium: ${dist.medium.count}`}
          />
        )}
        {dist.low.percentage > 0 && (
          <div
            className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-sm transition-all hover:opacity-80"
            style={{ width: `${dist.low.percentage}%` }}
            title={`Low: ${dist.low.count}`}
          />
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {dist.high.count}H / {dist.medium.count}M / {dist.low.count}L
      </div>
    </div>
  );
}