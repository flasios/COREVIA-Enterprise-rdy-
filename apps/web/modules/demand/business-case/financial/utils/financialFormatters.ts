export function formatCurrency(
  value: number | string | undefined | null, 
  currency: string = 'AED',
  compact: boolean = false
): string {
  const num = parseNumericValue(value);
  
  if (compact && Math.abs(num) >= 1000000) {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }
  
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercentage(
  value: number | string | undefined | null,
  decimals: number = 2
): string {
  const num = parseNumericValue(value);
  return `${num.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number | string | undefined | null,
  decimals: number = 0
): string {
  const num = parseNumericValue(value);
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPaybackPeriod(months: number | string | undefined | null): string {
  if (months === undefined || months === null || months === '') {
    return 'N/A';
  }

  const totalMonths = parseNumericValue(months);
  
  if (totalMonths === Infinity || isNaN(totalMonths)) {
    return 'N/A';
  }
  
  if (totalMonths <= 0) {
    return 'N/A';
  }
  
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = Math.round(totalMonths % 12);
  
  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
  
  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  
  return `${years} year${years !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
}

export function formatPaybackYears(years: number | string | undefined | null): string {
  const totalYears = parseNumericValue(years);
  
  if (totalYears === Infinity || isNaN(totalYears)) {
    return 'N/A';
  }
  
  return formatPaybackPeriod(totalYears * 12);
}

export function formatCompactNumber(value: number | string | undefined | null): string {
  const num = parseNumericValue(value);
  
  if (Math.abs(num) >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  }
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  
  return num.toFixed(0);
}

export function parseNumericValue(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function getROIStatus(roi: number): 'positive' | 'neutral' | 'negative' {
  if (roi >= 20) return 'positive';
  if (roi >= 0) return 'neutral';
  return 'negative';
}

export function getROIBadgeVariant(roi: number): 'default' | 'secondary' | 'destructive' {
  if (roi >= 50) return 'default';
  if (roi >= 20) return 'secondary';
  return 'destructive';
}

export function getNPVStatus(npv: number): 'positive' | 'neutral' | 'negative' {
  if (npv > 0) return 'positive';
  if (npv === 0) return 'neutral';
  return 'negative';
}

export function getPaybackStatus(paybackMonths: number, thresholdMonths: number = 24): 'good' | 'acceptable' | 'long' {
  if (paybackMonths <= thresholdMonths) return 'good';
  if (paybackMonths <= thresholdMonths * 1.5) return 'acceptable';
  return 'long';
}

export function formatVariance(actual: number, expected: number): { value: string; isPositive: boolean } {
  const variance = actual - expected;
  const percentage = expected !== 0 ? (variance / expected) * 100 : 0;
  
  return {
    value: `${variance >= 0 ? '+' : ''}${formatPercentage(percentage)}`,
    isPositive: variance >= 0,
  };
}

export function formatArabicCurrency(value: number, currency: string = 'AED'): string {
  const num = parseNumericValue(value);
  return new Intl.NumberFormat('ar-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDuration(months: number): string {
  if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  
  return `${years}y ${remainingMonths}m`;
}
