export type FinancialViewMode = 'pilot' | 'full';

export function readNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export type FinancialYearKey = 'year0' | 'year1' | 'year2' | 'year3' | 'year4' | 'year5';
export type FinancialBreakdownComponentOverride = {
  annualValue?: number;
};

export type FinancialLineItemOverrideRecord = Partial<Record<FinancialYearKey, number>> & {
  breakdown?: Record<string, FinancialBreakdownComponentOverride>;
};

export type FinancialLineItemOverride = number | FinancialLineItemOverrideRecord;

export const COST_YEAR_KEYS: FinancialYearKey[] = ['year0', 'year1', 'year2', 'year3', 'year4', 'year5'];
export const BENEFIT_YEAR_KEYS: FinancialYearKey[] = ['year1', 'year2', 'year3', 'year4', 'year5'];
export const PILOT_COST_YEAR_KEYS: FinancialYearKey[] = ['year0', 'year1'];
export const PILOT_BENEFIT_YEAR_KEYS: FinancialYearKey[] = ['year1'];

export function getCostYearKeysForMode(mode: FinancialViewMode): FinancialYearKey[] {
  return mode === 'pilot' ? PILOT_COST_YEAR_KEYS : COST_YEAR_KEYS;
}

export function getBenefitYearKeysForMode(mode: FinancialViewMode): FinancialYearKey[] {
  return mode === 'pilot' ? PILOT_BENEFIT_YEAR_KEYS : BENEFIT_YEAR_KEYS;
}

export function formatPreciseAed(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function isFinancialLineItemOverrideRecord(value: unknown): value is FinancialLineItemOverrideRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeBreakdownOverrideRecord(value: unknown): Record<string, FinancialBreakdownComponentOverride> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, FinancialBreakdownComponentOverride>>((acc, [key, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return acc;
    }

    const annualValue = readNumber((entry as Record<string, unknown>).annualValue);
    if (annualValue !== undefined) {
      acc[key] = { annualValue };
    }
    return acc;
  }, {});
}

export function getBreakdownOverrideMap(override: FinancialLineItemOverride | undefined): Record<string, FinancialBreakdownComponentOverride> {
  if (!isFinancialLineItemOverrideRecord(override)) {
    return {};
  }

  return normalizeBreakdownOverrideRecord(override.breakdown);
}

export function normalizeFinancialLineItemOverrides(value: unknown): Record<string, FinancialLineItemOverride> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, FinancialLineItemOverride>>((acc, [key, entry]) => {
    const numeric = readNumber(entry);
    if (numeric !== undefined) {
      acc[key] = numeric;
      return acc;
    }

    if (isFinancialLineItemOverrideRecord(entry)) {
      const normalizedRecord = COST_YEAR_KEYS.reduce<Partial<Record<FinancialYearKey, number>>>((years, yearKey) => {
        const yearValue = readNumber(entry[yearKey]);
        if (yearValue !== undefined) {
          years[yearKey] = yearValue;
        }
        return years;
      }, {});

      const normalizedBreakdown = normalizeBreakdownOverrideRecord(entry.breakdown);

      if (Object.keys(normalizedRecord).length > 0 || Object.keys(normalizedBreakdown).length > 0) {
        acc[key] = {
          ...normalizedRecord,
          ...(Object.keys(normalizedBreakdown).length > 0 ? { breakdown: normalizedBreakdown } : {}),
        };
      }
    }

    return acc;
  }, {});
}

export function getItemYearTotal(item: Record<string, unknown>, yearKeys: FinancialYearKey[]): number {
  return yearKeys.reduce((sum, yearKey) => sum + (Number(item[yearKey]) || 0), 0);
}

export function getOverrideTotalValue(override: FinancialLineItemOverride | undefined, item: Record<string, unknown>, yearKeys: FinancialYearKey[]): number {
  if (typeof override === 'number') {
    return override;
  }

  if (!override) {
    return getItemYearTotal(item, yearKeys);
  }

  return yearKeys.reduce((sum, yearKey) => sum + (readNumber(override[yearKey]) ?? (Number(item[yearKey]) || 0)), 0);
}

export function materializeYearOverride(item: Record<string, unknown>, override: FinancialLineItemOverride | undefined, yearKeys: FinancialYearKey[]): Partial<Record<FinancialYearKey, number>> {
  if (isFinancialLineItemOverrideRecord(override)) {
    return yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
      acc[yearKey] = readNumber(override[yearKey]) ?? (Number(item[yearKey]) || 0);
      return acc;
    }, {});
  }

  if (typeof override === 'number') {
    const originalTotal = getItemYearTotal(item, yearKeys);
    if (originalTotal > 0) {
      const factor = override / originalTotal;
      return yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
        acc[yearKey] = (Number(item[yearKey]) || 0) * factor;
        return acc;
      }, {});
    }
  }

  return yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
    acc[yearKey] = Number(item[yearKey]) || 0;
    return acc;
  }, {});
}

export function getBreakdownAnchorYearKey(item: Record<string, unknown>, yearKeys: FinancialYearKey[]): FinancialYearKey | undefined {
  return yearKeys.find((yearKey) => yearKey !== 'year0' && (Number(item[yearKey]) || 0) > 0)
    ?? yearKeys.find((yearKey) => (Number(item[yearKey]) || 0) > 0);
}

export function scaleBreakdownComponents<T extends { annualValue: number; perDelivery?: number }>(components: T[], scaleFactor: number): T[] {
  return components.map((component) => ({
    ...component,
    annualValue: component.annualValue * scaleFactor,
    perDelivery: component.perDelivery != null ? component.perDelivery * scaleFactor : undefined,
  }));
}

export function materializeBreakdownComponents(
  item: Record<string, unknown>,
  override: FinancialLineItemOverride | undefined,
  yearKeys: FinancialYearKey[],
): { name: string; annualValue: number; perDelivery?: number }[] {
  const breakdown = (item as { breakdown?: { name: string; annualValue: number; perDelivery?: number }[] }).breakdown;
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return [];
  }

  const anchorYearKey = getBreakdownAnchorYearKey(item, yearKeys);
  const baseBreakdown = (() => {
    if (!anchorYearKey) {
      return breakdown.map((component) => ({ ...component }));
    }

    const currentYears = materializeYearOverride(item, override, yearKeys);
    const originalAnchorValue = Number(item[anchorYearKey]) || 0;
    const currentAnchorValue = currentYears[anchorYearKey] ?? originalAnchorValue;
    const scaleFactor = originalAnchorValue > 0 ? currentAnchorValue / originalAnchorValue : 1;
    return scaleBreakdownComponents(breakdown, scaleFactor);
  })();

  const breakdownOverrides = getBreakdownOverrideMap(override);
  return baseBreakdown.map((component) => {
    const componentOverride = breakdownOverrides[component.name];
    if (!componentOverride || componentOverride.annualValue === undefined) {
      return component;
    }

    const componentScale = component.annualValue > 0 ? componentOverride.annualValue / component.annualValue : 1;
    return {
      ...component,
      annualValue: componentOverride.annualValue,
      perDelivery: component.perDelivery != null ? component.perDelivery * componentScale : undefined,
    };
  });
}

export function createOverrideRecord(
  yearKeys: FinancialYearKey[],
  yearValues: Partial<Record<FinancialYearKey, number>>,
  breakdown?: { name: string; annualValue: number; perDelivery?: number }[],
): FinancialLineItemOverrideRecord {
  const nextOverride: FinancialLineItemOverrideRecord = yearKeys.reduce<FinancialLineItemOverrideRecord>((acc, yearKey) => {
    acc[yearKey] = yearValues[yearKey] ?? 0;
    return acc;
  }, {});

  if (Array.isArray(breakdown) && breakdown.length > 0) {
    nextOverride.breakdown = breakdown.reduce<Record<string, FinancialBreakdownComponentOverride>>((acc, component) => {
      acc[component.name] = { annualValue: component.annualValue };
      return acc;
    }, {});
  }

  return nextOverride;
}

export function buildOverrideFromYearValues(
  item: Record<string, unknown>,
  override: FinancialLineItemOverride | undefined,
  yearKeys: FinancialYearKey[],
  nextYearValues: Partial<Record<FinancialYearKey, number>>,
): FinancialLineItemOverrideRecord {
  const currentYears = materializeYearOverride(item, override, yearKeys);
  const currentBreakdown = materializeBreakdownComponents(item, override, yearKeys);
  const anchorYearKey = getBreakdownAnchorYearKey(item, yearKeys);

  if (!anchorYearKey || currentBreakdown.length === 0) {
    return createOverrideRecord(yearKeys, nextYearValues);
  }

  const previousAnchorValue = currentYears[anchorYearKey] ?? (Number(item[anchorYearKey]) || 0);
  const nextAnchorValue = nextYearValues[anchorYearKey] ?? 0;
  const nextBreakdown = previousAnchorValue > 0
    ? scaleBreakdownComponents(currentBreakdown, nextAnchorValue / previousAnchorValue)
    : currentBreakdown;

  return createOverrideRecord(yearKeys, nextYearValues, nextBreakdown);
}

export function updateBreakdownComponentOverride(
  item: Record<string, unknown>,
  override: FinancialLineItemOverride | undefined,
  yearKeys: FinancialYearKey[],
  componentName: string,
  annualValue: number,
): FinancialLineItemOverrideRecord {
  const currentYears = materializeYearOverride(item, override, yearKeys);
  const currentBreakdown = materializeBreakdownComponents(item, override, yearKeys);
  const nextBreakdown = currentBreakdown.map((component) => (
    component.name === componentName
      ? { ...component, annualValue: Number.isFinite(annualValue) ? annualValue : 0 }
      : component
  ));
  const anchorYearKey = getBreakdownAnchorYearKey(item, yearKeys);

  if (!anchorYearKey) {
    return createOverrideRecord(yearKeys, currentYears, nextBreakdown);
  }

  const previousAnchorValue = currentYears[anchorYearKey] ?? (Number(item[anchorYearKey]) || 0);
  const nextAnchorValue = nextBreakdown.reduce((sum, component) => sum + component.annualValue, 0);
  const nextYearValues = yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
    const baseYearValue = currentYears[yearKey] ?? 0;
    if (previousAnchorValue > 0) {
      acc[yearKey] = baseYearValue * (nextAnchorValue / previousAnchorValue);
    } else {
      acc[yearKey] = yearKey === anchorYearKey ? nextAnchorValue : baseYearValue;
    }
    return acc;
  }, {});

  return createOverrideRecord(yearKeys, nextYearValues, nextBreakdown);
}

export function scaleOverrideToTotal(item: Record<string, unknown>, override: FinancialLineItemOverride | undefined, total: number, yearKeys: FinancialYearKey[]): FinancialLineItemOverrideRecord {
  const base = materializeYearOverride(item, override, yearKeys);
  const baseTotal = yearKeys.reduce((sum, yearKey) => sum + (base[yearKey] ?? 0), 0);
  const nextYearValues = baseTotal <= 0
    ? yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
        acc[yearKey] = yearKey === yearKeys[0] ? total : 0;
        return acc;
      }, {})
    : yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
        acc[yearKey] = (base[yearKey] ?? 0) * (total / baseTotal);
        return acc;
      }, {});

  return buildOverrideFromYearValues(item, override, yearKeys, nextYearValues);
}

export function scaleLineItemBreakdown<T extends Record<string, unknown>>(
  originalItem: T,
  nextItem: T,
  yearKeys: FinancialYearKey[],
): T {
  const breakdown = (originalItem as { breakdown?: { name: string; annualValue: number; perDelivery?: number }[] }).breakdown;
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return nextItem;
  }

  const anchorYearKey = yearKeys.find((yearKey) => yearKey !== 'year0' && (Number(originalItem[yearKey]) || 0) > 0)
    ?? yearKeys.find((yearKey) => (Number(originalItem[yearKey]) || 0) > 0);
  if (!anchorYearKey) {
    return nextItem;
  }

  const originalAnchorValue = Number(originalItem[anchorYearKey]) || 0;
  const nextAnchorValue = Number(nextItem[anchorYearKey]) || 0;
  const scaleFactor = originalAnchorValue > 0 ? nextAnchorValue / originalAnchorValue : 1;

  return {
    ...nextItem,
    breakdown: breakdown.map((component) => ({
      ...component,
      annualValue: component.annualValue * scaleFactor,
      perDelivery: component.perDelivery != null ? component.perDelivery * scaleFactor : undefined,
    })),
  };
}

export function applyLineItemOverride<T extends Record<string, unknown>>(
  item: T,
  override: FinancialLineItemOverride | undefined,
  yearKeys: FinancialYearKey[],
): T {
  if (override === undefined) {
    return item;
  }

  if (typeof override === 'number') {
    const originalTotal = getItemYearTotal(item, yearKeys);
    if (originalTotal <= 0) {
      return item;
    }
    const factor = override / originalTotal;
    if (Math.abs(factor - 1) < 1e-6) {
      return item;
    }
    const scaledItem = {
      ...item,
      ...yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
        acc[yearKey] = (Number(item[yearKey]) || 0) * factor;
        return acc;
      }, {}),
    };
    return scaleLineItemBreakdown(item, scaledItem, yearKeys);
  }

  const overriddenItem = {
    ...item,
    ...yearKeys.reduce<Partial<Record<FinancialYearKey, number>>>((acc, yearKey) => {
      const yearValue = readNumber(override[yearKey]);
      if (yearValue !== undefined) {
        acc[yearKey] = yearValue;
      }
      return acc;
    }, {}),
  };
  const overriddenBreakdown = materializeBreakdownComponents(item, override, yearKeys);
  const scaledItem = scaleLineItemBreakdown(item, overriddenItem, yearKeys);
  return overriddenBreakdown.length > 0
    ? {
        ...scaledItem,
        breakdown: overriddenBreakdown,
      }
    : scaledItem;
}

export function cloneFinancialLineItemOverrides(
  source: Record<string, FinancialLineItemOverride>,
): Record<string, FinancialLineItemOverride> {
  const result: Record<string, FinancialLineItemOverride> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      result[key] = value;
    } else if (value && typeof value === 'object') {
      // Deep copy override record (years + optional breakdown overrides)
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          copy[k] = { ...(v as Record<string, unknown>) };
        } else {
          copy[k] = v;
        }
      }
      result[key] = copy as FinancialLineItemOverride;
    }
  }
  return result;
}

export function lineItemOverridesChanged(
  current: Record<string, FinancialLineItemOverride>,
  persisted: Record<string, FinancialLineItemOverride>,
  yearKeys: FinancialYearKey[],
): boolean {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(persisted)]);
  for (const key of allKeys) {
    const currentValue = current[key];
    const persistedValue = persisted[key];

    if (typeof currentValue === 'number' || typeof persistedValue === 'number') {
      if (typeof currentValue !== 'number' || typeof persistedValue !== 'number') {
        return true;
      }
      if (Math.abs(currentValue - persistedValue) > 0.01) {
        return true;
      }
      continue;
    }

    const currentRecord = currentValue ?? {};
    const persistedRecord = persistedValue ?? {};
    for (const yearKey of yearKeys) {
      if (Math.abs((currentRecord[yearKey] ?? 0) - (persistedRecord[yearKey] ?? 0)) > 0.01) {
        return true;
      }
    }

    const currentBreakdown = getBreakdownOverrideMap(currentValue);
    const persistedBreakdown = getBreakdownOverrideMap(persistedValue);
    const breakdownKeys = new Set([...Object.keys(currentBreakdown), ...Object.keys(persistedBreakdown)]);
    for (const breakdownKey of breakdownKeys) {
      if (Math.abs((currentBreakdown[breakdownKey]?.annualValue ?? 0) - (persistedBreakdown[breakdownKey]?.annualValue ?? 0)) > 0.01) {
        return true;
      }
    }
  }

  return false;
}
