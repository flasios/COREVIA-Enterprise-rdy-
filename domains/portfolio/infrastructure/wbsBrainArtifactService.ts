type UnknownRecord = Record<string, unknown>;

function isValidIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampPlausibleDateOnly(params: { raw: unknown; baseDate: Date; maxTime?: number }): string | null {
  const baseTime = params.baseDate.getTime();
  const minTime = baseTime - 30 * 24 * 60 * 60 * 1000; // allow slight pre-start milestones
  // Default envelope: 5 years from start. Callers that know the planned project
  // duration should pass an explicit maxTime so hallucinated multi-decade dates
  // are rejected at parse time.
  const maxTime = typeof params.maxTime === 'number' && Number.isFinite(params.maxTime)
    ? params.maxTime
    : new Date(params.baseDate.getFullYear() + 5, params.baseDate.getMonth(), params.baseDate.getDate()).getTime();

  const normalize = (d: Date): string | null => {
    const t = d.getTime();
    if (Number.isNaN(t)) return null;
    if (t < minTime || t > maxTime) return null;
    return d.toISOString().split('T')[0]!;
  };

  if (typeof params.raw === 'string') {
    const trimmed = params.raw.trim();
    if (!trimmed) return null;
    if (isValidIsoDateOnly(trimmed)) return normalize(new Date(trimmed));
    const parsed = new Date(trimmed);
    return normalize(parsed);
  }

  if (typeof params.raw === 'number' && Number.isFinite(params.raw)) {
    const n = params.raw;
    // Heuristic: seconds vs ms since epoch
    const ms = n < 10_000_000_000 ? n * 1000 : n;
    return normalize(new Date(ms));
  }

  return null;
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
}

function toLookupKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushUnique(map: Map<string, Set<string>>, key: string, value: string): void {
  if (!key || !value) return;
  const existing = map.get(key) || new Set<string>();
  existing.add(value);
  map.set(key, existing);
}

function parseWorkingDaysFromText(value: unknown, fallbackDays: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  if (typeof value !== 'string') return fallbackDays;

  const text = value.toLowerCase();
  const n = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return fallbackDays;

  if (text.includes('week')) return Math.max(1, Math.round(n * 7));
  if (text.includes('month')) return Math.max(1, Math.round(n * 30));
  if (text.includes('year')) return Math.max(1, Math.round(n * 365));
  if (text.includes('day')) return Math.max(1, Math.round(n));

  return Math.max(1, Math.round(n));
}

function extractMonthOrdinal(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/month\s*(\d{1,3})/i);
  if (!match) return null;
  const month = Number.parseInt(match[1] || '', 10);
  return Number.isFinite(month) && month > 0 ? month : null;
}

function parseEffortHoursFromText(value: unknown, fallbackHours: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== 'string') return fallbackHours;

  const text = value.toLowerCase();
  const n = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return fallbackHours;

  if (text.includes('person-day') || text.includes('person day') || text.includes('personday') || text.includes('pd')) {
    return Math.round(n * 8);
  }
  if (text.includes('day')) return Math.round(n * 8);
  if (text.includes('hour')) return Math.round(n);

  return Math.round(n);
}

export type GeneratedWbsTaskLike = {
  taskCode: string;
  title: string;
  description?: string | null;
  taskType: 'phase' | 'task' | 'milestone' | 'deliverable';
  priority: 'critical' | 'high' | 'medium' | 'low';
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  duration: number;
  estimatedHours: number;
  dependencies: string[];
  deliverables: string[];
  resources: string[];
  wbsLevel: number;
  parentTaskCode?: string | null;
  sortOrder: number;
  isCriticalPath?: boolean;
  /** Planned cost in project currency, derived from BC cost anchors (cost-aware WBS). */
  plannedCost?: number | null;
  /** Business Case cost anchor reference (e.g. "BC.04") linking this task to an approved BC line. */
  costAnchor?: string | null;
};

export type BrainWbsArtifactSummary = {
  totalTasks: number;
  totalPhases: number;
  totalMilestones: number;
  criticalPathDuration: number;
  estimatedTotalHours: number;
};

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

function rollUpParentPlannedDates(tasks: GeneratedWbsTaskLike[]): GeneratedWbsTaskLike[] {
  const byCode = new Map<string, GeneratedWbsTaskLike>();
  for (const t of tasks) byCode.set(t.taskCode, t);

  const childrenByParent = new Map<string, GeneratedWbsTaskLike[]>();
  for (const t of tasks) {
    if (!t.parentTaskCode) continue;
    const parentCode = String(t.parentTaskCode);
    const list = childrenByParent.get(parentCode) || [];
    list.push(t);
    childrenByParent.set(parentCode, list);
  }

  // Process deepest first so rollups cascade correctly.
  const ordered = [...tasks].sort((a, b) => (Number(b.wbsLevel) || 0) - (Number(a.wbsLevel) || 0));

  for (const parent of ordered) {
    const children = childrenByParent.get(parent.taskCode);
    if (!children || children.length === 0) continue;

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    for (const child of children) {
      if (!child.plannedStartDate || !child.plannedEndDate) continue;
      const s = new Date(child.plannedStartDate);
      const e = new Date(child.plannedEndDate);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;

      if (!minStart || s < minStart) minStart = s;
      if (!maxEnd || e > maxEnd) maxEnd = e;
    }

    if (!minStart || !maxEnd) continue;

    const rolled = byCode.get(parent.taskCode);
    if (!rolled) continue;

    rolled.plannedStartDate = minStart.toISOString().split('T')[0];
    rolled.plannedEndDate = maxEnd.toISOString().split('T')[0];
    rolled.duration = Math.max(1, daysBetweenInclusive(minStart, maxEnd));
  }

  return tasks;
}

function scaleDurationsToTarget(params: {
  tasks: GeneratedWbsTaskLike[];
  baseDate: Date;
  targetDurationDays: number;
}): GeneratedWbsTaskLike[] {
  const seeded = calculateDependencyBasedDates(params.tasks, params.baseDate);
  let maxEnd: Date | null = null;

  for (const t of seeded) {
    if (!t.plannedEndDate) continue;
    const d = new Date(t.plannedEndDate);
    if (Number.isNaN(d.getTime())) continue;
    if (!maxEnd || d > maxEnd) maxEnd = d;
  }

  if (!maxEnd) return params.tasks;

  const currentDuration = Math.max(1, daysBetweenInclusive(params.baseDate, maxEnd));
  const targetDuration = Math.max(1, Math.round(params.targetDurationDays));

  if (currentDuration === targetDuration) return params.tasks;
  const scale = targetDuration / currentDuration;

  return params.tasks.map((t) => {
    if (t.taskType === 'milestone') return t;
    const newDuration = Math.max(1, Math.round((Number(t.duration) || 1) * scale));
    const newHours = Math.max(0, Math.round((Number(t.estimatedHours) || 0) * scale));
    return { ...t, duration: newDuration, estimatedHours: newHours };
  });
}

export function normalizeBrainWbsArtifactToGeneratedTasks(params: {
  artifactContent: unknown;
  startDate: string;
  targetDurationDays?: number;
}): { tasks: GeneratedWbsTaskLike[]; summary: BrainWbsArtifactSummary } {
  const content = asRecord(params.artifactContent);
  const phases = Array.isArray(content.phases) ? content.phases.map(asRecord) : [];
  const milestones = Array.isArray(content.milestones) ? content.milestones.map(asRecord) : [];
  const criticalPathIds = new Set(asStringArray(content.criticalPath));

  const wbsIdToTaskCode = new Map<string, string>();
  const phaseNameToCode = new Map<string, string>();
  const taskTitleToCodes = new Map<string, Set<string>>();
  const deliverableNameToTaskCodes = new Map<string, Set<string>>();
  const phaseLeafTaskCodes = new Map<string, Set<string>>();
  const phaseCodeByTaskCode = new Map<string, string>();
  const milestoneSequenceByPhase = new Map<string, number>();
  const phaseTimelineBounds = new Map<string, { startMonth: number; endMonth: number }>();
  const tasks: GeneratedWbsTaskLike[] = [];

  let sortOrder = 1;
  let lastLeafTaskCode: string | null = null;
  let cumulativePhaseDays = 0;

  // Phase + work package tasks
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
    const phase = phases[phaseIndex]!;
    const phaseId = asString(phase.id, `WBS-${phaseIndex + 1}`);
    const phaseCode = `${phaseIndex + 1}.0`;
    wbsIdToTaskCode.set(phaseId, phaseCode);

    const phaseBarrierDependency = phaseIndex > 0 ? lastLeafTaskCode : null;

    const phaseDurationDays = parseWorkingDaysFromText(phase.duration, 22);
    const phaseStartMonth = Math.floor(cumulativePhaseDays / 30) + 1;
    const phaseEndMonth = Math.max(phaseStartMonth, Math.ceil((cumulativePhaseDays + phaseDurationDays) / 30));
    phaseTimelineBounds.set(phaseCode, { startMonth: phaseStartMonth, endMonth: phaseEndMonth });
    cumulativePhaseDays += phaseDurationDays;

    const phasePlannedCostRaw = (phase as UnknownRecord).plannedCost;
    const phasePlannedCost = typeof phasePlannedCostRaw === 'number' && Number.isFinite(phasePlannedCostRaw)
      ? phasePlannedCostRaw
      : null;
    const phaseTask: GeneratedWbsTaskLike = {
      taskCode: phaseCode,
      title: asString(phase.name, `Phase ${phaseIndex + 1}`),
      description: asString(phase.description, '') || null,
      taskType: 'phase',
      priority: criticalPathIds.has(phaseId) ? 'critical' : 'high',
      duration: phaseDurationDays,
      estimatedHours: phaseDurationDays * 8,
      dependencies: [],
      deliverables: [],
      resources: [],
      wbsLevel: 1,
      parentTaskCode: null,
      sortOrder: sortOrder++,
      isCriticalPath: criticalPathIds.has(phaseId),
      plannedCost: phasePlannedCost,
      costAnchor: null,
    };
    tasks.push(phaseTask);
    phaseNameToCode.set(toLookupKey(phaseTask.title), phaseCode);
    phaseCodeByTaskCode.set(phaseCode, phaseCode);

    const leafTaskCodesInPhase: string[] = [];

    const workPackages = Array.isArray(phase.workPackages)
      ? (phase.workPackages as unknown[]).map(asRecord)
      : [];

    let _phaseHadAnyWorkPackages = false;

    for (let wpIndex = 0; wpIndex < workPackages.length; wpIndex++) {
      _phaseHadAnyWorkPackages = true;
      const wp = workPackages[wpIndex]!;
      const wpId = asString(wp.id, `${phaseId}.${wpIndex + 1}`);
      const wpCode = `${phaseIndex + 1}.${wpIndex + 1}`;
      wbsIdToTaskCode.set(wpId, wpCode);

      const deliverables = asStringArray(wp.deliverables);
      const wpDependenciesRaw = asStringArray(wp.dependencies);
      const wpDependencies = (() => {
        const normalized = wpDependenciesRaw.map((d) => wbsIdToTaskCode.get(d) || d).filter(Boolean);
        if (!phaseBarrierDependency) return normalized;
        if (normalized.includes(phaseBarrierDependency)) return normalized;
        return [...normalized, phaseBarrierDependency];
      })();
      const assignedRole = asString(wp.assignedRole, '');

      const wpDurationDays = parseWorkingDaysFromText(wp.estimatedEffort, 10);
      const wpEffortHours = parseEffortHoursFromText(wp.estimatedEffort, wpDurationDays * 8);

      const wpPlannedCostRaw = wp.plannedCost;
      const wpPlannedCost = typeof wpPlannedCostRaw === 'number' && Number.isFinite(wpPlannedCostRaw)
        ? wpPlannedCostRaw
        : null;
      const wpCostAnchor = asString(wp.costAnchor, '') || null;
      tasks.push({
        taskCode: wpCode,
        title: asString(wp.name, `Work Package ${wpCode}`),
        description: asString(wp.description, '') || null,
        taskType: deliverables.length > 0 ? 'deliverable' : 'task',
        priority: criticalPathIds.has(wpId) ? 'critical' : 'medium',
        duration: wpDurationDays,
        estimatedHours: wpEffortHours,
        dependencies: wpDependencies,
        deliverables,
        resources: assignedRole ? [assignedRole] : [],
        wbsLevel: 2,
        parentTaskCode: phaseCode,
        sortOrder: sortOrder++,
        isCriticalPath: criticalPathIds.has(wpId),
        plannedCost: wpPlannedCost,
        costAnchor: wpCostAnchor,
      });
      phaseCodeByTaskCode.set(wpCode, phaseCode);
      pushUnique(taskTitleToCodes, toLookupKey(asString(wp.name, `Work Package ${wpCode}`)), wpCode);
      deliverables.forEach((deliverable) => pushUnique(deliverableNameToTaskCodes, toLookupKey(deliverable), wpCode));

      // Track leaves for phase completion barrier
      leafTaskCodesInPhase.push(wpCode);

      // Expand deliverables into Level-3 activities so the UI has “activities” to show.
      // This keeps the structure “strong” even if Brain output is phase/workPackage oriented.
      const activitySources = deliverables.length > 0 ? deliverables : [asString(wp.name, `Activity for ${wpCode}`)];
      const perActivityDays = Math.max(1, Math.round(wpDurationDays / Math.max(1, activitySources.length)));
      const perActivityHours = Math.max(0, Math.round(wpEffortHours / Math.max(1, activitySources.length)));

      for (let actIndex = 0; actIndex < activitySources.length; actIndex++) {
        const actCode = `${wpCode}.${actIndex + 1}`;
        const actDeps = actIndex === 0
          ? wpDependencies
          : [(`${wpCode}.${actIndex}`)];

        tasks.push({
          taskCode: actCode,
          title: String(activitySources[actIndex]),
          description: null,
          taskType: 'task',
          priority: criticalPathIds.has(wpId) ? 'critical' : 'medium',
          duration: perActivityDays,
          estimatedHours: perActivityHours,
          dependencies: actDeps,
          deliverables: [],
          resources: assignedRole ? [assignedRole] : [],
          wbsLevel: 3,
          parentTaskCode: wpCode,
          sortOrder: sortOrder++,
          isCriticalPath: criticalPathIds.has(wpId),
        });
        phaseCodeByTaskCode.set(actCode, phaseCode);
        pushUnique(taskTitleToCodes, toLookupKey(activitySources[actIndex]), actCode);

        leafTaskCodesInPhase.push(actCode);
      }
    }

    phaseLeafTaskCodes.set(phaseCode, new Set(leafTaskCodesInPhase));

    // Phase completion barrier: phase summary depends on all leaf tasks in the phase.
    // This allows parallel work packages within the phase, while ensuring the next phase starts
    // only after the prior phase finishes.
    if (leafTaskCodesInPhase.length > 0) {
      phaseTask.dependencies = Array.from(new Set([
        ...leafTaskCodesInPhase.filter((c) => c && c !== phaseCode),
        ...(phaseBarrierDependency ? [phaseBarrierDependency] : []),
      ]));
      // Barrier only: avoid pushing the next phase out by the (often large) phase duration.
      // Roll-up later will set the displayed start/end/duration for the summary row.
      phaseTask.duration = 1;
      phaseTask.estimatedHours = 0;
    } else if (phaseBarrierDependency) {
      // If there are no leaves, still chain phases.
      phaseTask.dependencies = [phaseBarrierDependency];
      phaseTask.duration = 1;
      phaseTask.estimatedHours = 0;
    }

    // Use the phase summary as the barrier for the next phase.
    lastLeafTaskCode = phaseCode;
  }

  // Milestones -> anchor to the owning phase/workstream instead of defaulting to the final phase.
  const milestonePhaseCode = phases.length > 0 ? `${phases.length}.0` : '1.0';
  const milestonePhaseExists = tasks.some((t) => t.taskCode === milestonePhaseCode);
  if (!milestonePhaseExists) {
    tasks.unshift({
      taskCode: milestonePhaseCode,
      title: 'Project Planning',
      description: null,
      taskType: 'phase',
      priority: 'high',
      duration: 22,
      estimatedHours: 22 * 8,
      dependencies: [],
      deliverables: [],
      resources: [],
      wbsLevel: 1,
      parentTaskCode: null,
      sortOrder: 0,
      isCriticalPath: false,
    });
    // Re-number sort orders later
  }

  const defaultMilestoneDependency = (() => {
    // Put milestones at the end of the computed plan when the artifact doesn’t specify dependencies.
    const lastNonMilestone = [...tasks].reverse().find((t) => t.taskType !== 'milestone');
    return lastNonMilestone?.taskCode || null;
  })();

  const baseDate = new Date(params.startDate);

  // ─────────────────────────────────────────────────────────────
  // Title-based milestone → task anchor index.
  //
  // Why: the Brain LLM sometimes emits every milestone with the same trailing
  // target date (e.g. "Project Charter Approved", "UAT Sign-off" and "Go-Live"
  // all stamped with the project end date, or wildly hallucinated dates like
  // 2036-01-01). The prior phase-anchoring fallback then puts every milestone
  // in the final phase because their targetMonth lies there.
  //
  // The strongest signal for *where* a milestone really belongs is the
  // lifecycle keyword in its title. "Charter Approved" → the charter task.
  // "UAT Sign-off" → the UAT task. We match on shared significant tokens
  // and, when found, anchor the milestone to that task's phase and make it
  // depend on the matched task so dependency-based scheduling places the
  // milestone's date correctly (no trust in the LLM's targetDate).
  // ─────────────────────────────────────────────────────────────
  const MILESTONE_TITLE_STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'per', 'via', 'of', 'to', 'in',
    'on', 'a', 'an', 'is', 'are', 'be', 'this', 'that', 'by', 'as', 'or', 'at',
    'all', 'complete', 'completed', 'completion', 'approved', 'approval',
    'signoff', 'sign', 'off', 'signed', 'ready', 'done', 'milestone', 'gate',
    'phase', 'stage', 'review', 'baseline', 'final', 'initial',
    'start', 'begin', 'end', 'finish', 'launch',
  ]);
  function titleTokens(value: string): Set<string> {
    // Allow 3-char tokens so acronyms like UAT / API / CRM survive.
    return new Set(
      toLookupKey(value)
        .split(' ')
        .filter((tok) => tok.length >= 3 && !MILESTONE_TITLE_STOPWORDS.has(tok)),
    );
  }
  type TaskAnchorCandidate = { code: string; tokens: Set<string>; rawTitle: string };
  const taskAnchorIndex: TaskAnchorCandidate[] = tasks
    .filter((t) => t.taskType !== 'phase' && t.taskType !== 'milestone' && t.title)
    .map((t) => ({ code: t.taskCode, tokens: titleTokens(t.title), rawTitle: t.title }))
    .filter((c) => c.tokens.size > 0);

  function findTitleAnchor(milestoneTitle: string): { code: string; phaseCode: string } | null {
    const msTokens = titleTokens(milestoneTitle);
    if (msTokens.size === 0) return null;
    let best: { code: string; score: number; specificity: number } | null = null;
    for (const cand of taskAnchorIndex) {
      let shared = 0;
      for (const tok of msTokens) if (cand.tokens.has(tok)) shared++;
      // Require ≥ 2 shared tokens, OR exactly 1 shared significant token when
      // milestone is short (1-2 tokens total) — e.g. "Go-Live" → "Go-live activities".
      const threshold = msTokens.size <= 2 ? 1 : 2;
      if (shared < threshold) continue;
      // Specificity = shared / candidate token count. Higher means the candidate
      // title is more focused on the milestone (prefer leaf activity "Scope
      // baseline" over parent work package "Scope baseline package").
      const specificity = shared / cand.tokens.size;
      if (!best
        || shared > best.score
        || (shared === best.score && specificity > best.specificity)) {
        best = { code: cand.code, score: shared, specificity };
      }
    }
    if (!best) return null;
    const phaseCode = phaseCodeByTaskCode.get(best.code) || `${String(best.code).split('.')[0]}.0`;
    if (!tasks.some((t) => t.taskCode === phaseCode)) return null;
    return { code: best.code, phaseCode };
  }

  // The project envelope is the approved planned duration (from BC/SF timeline)
  // plus a small buffer; any milestone date past it is an LLM hallucination.
  // Without an explicit target duration, fall back to a 3-year envelope — which
  // is still far stricter than the previous 10-year window that let dates like
  // 2036-01-01 leak through and roll up into 3500-day phase durations.
  const envelopeDays = Number.isFinite(params.targetDurationDays) && Number(params.targetDurationDays) > 0
    ? Math.round(Number(params.targetDurationDays)) + 60
    : 3 * 365;
  const MAX_PLAUSIBLE_MS = baseDate.getTime() + envelopeDays * 86400000;
  function sanitizeTargetDate(raw: string | null): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() > MAX_PLAUSIBLE_MS) return null;
    if (d.getTime() < baseDate.getTime()) return null;
    return raw;
  }

  for (let m = 0; m < milestones.length; m++) {
    const ms = milestones[m]!;
    const milestoneRecord = ms as UnknownRecord;
    const targetDate = sanitizeTargetDate(clampPlausibleDateOnly({
      raw: milestoneRecord.targetDate ?? milestoneRecord.date ?? milestoneRecord.target_date,
      baseDate,
      maxTime: MAX_PLAUSIBLE_MS,
    }));
    const msDependencies = asStringArray(milestoneRecord.dependencies ?? milestoneRecord.dependsOn);
    const milestoneDeliverables = Array.from(new Set([
      asString(milestoneRecord.deliverable),
      ...asStringArray(milestoneRecord.deliverables),
      ...asStringArray(milestoneRecord.outputs),
    ].filter(Boolean)));
    const phaseHint = [
      milestoneRecord.phase,
      milestoneRecord.phaseName,
      milestoneRecord.phase_name,
      milestoneRecord.stream,
      milestoneRecord.workstream,
      milestoneRecord.workStream,
    ].map((value) => toLookupKey(value)).find(Boolean) || '';
    const targetMonth = extractMonthOrdinal(milestoneRecord.targetDate ?? milestoneRecord.date ?? milestoneRecord.target_date);

    const mappedDependencies = Array.from(new Set(msDependencies.flatMap((dependency) => {
      const mappedCode = wbsIdToTaskCode.get(dependency);
      if (mappedCode) return [mappedCode];
      const titleMatches = taskTitleToCodes.get(toLookupKey(dependency));
      if (titleMatches && titleMatches.size > 0) return Array.from(titleMatches);
      return dependency ? [dependency] : [];
    }).filter(Boolean)));

    const deliverableDependencyCodes = Array.from(new Set(milestoneDeliverables.flatMap((deliverable) => {
      const key = toLookupKey(deliverable);
      // Prefer the leaf activity carrying the same title over the parent work
      // package so milestone dependencies land on the actual executed task.
      const titleMatches = taskTitleToCodes.get(key);
      if (titleMatches && titleMatches.size > 0) return Array.from(titleMatches);
      const matches = deliverableNameToTaskCodes.get(key);
      return matches ? Array.from(matches) : [];
    })));

    // Primary signal: milestone title matches a concrete task in the WBS.
    const titleAnchor = findTitleAnchor(asString(ms.name, ''));

    const inferredPhaseCode = (() => {
      if (titleAnchor) return titleAnchor.phaseCode;

      if (phaseHint) {
        const directPhase = phaseNameToCode.get(phaseHint);
        if (directPhase) return directPhase;
      }

      if (targetMonth) {
        for (const [phaseCode, bounds] of phaseTimelineBounds.entries()) {
          if (targetMonth >= bounds.startMonth && targetMonth <= bounds.endMonth) {
            return phaseCode;
          }
        }
      }

      const evidenceCodes = [...mappedDependencies, ...deliverableDependencyCodes];
      for (const code of evidenceCodes) {
        const phaseCode = phaseCodeByTaskCode.get(code) || `${String(code).split('.')[0]}.0`;
        if (phaseCode && tasks.some((task) => task.taskCode === phaseCode)) {
          return phaseCode;
        }
      }

      return milestonePhaseCode;
    })();

    const phaseLeafDependencies = Array.from(phaseLeafTaskCodes.get(inferredPhaseCode) || []);
    // Priority: title-anchored task ≻ mapped deps ≻ deliverable-linked tasks ≻ phase leaves.
    // When title-anchored, we intentionally drop phase-leaf deps so the milestone
    // sits immediately after its anchor task, not at the back of the phase.
    const finalDependencies = titleAnchor
      ? Array.from(new Set([titleAnchor.code, ...mappedDependencies]))
      : mappedDependencies.length > 0
        ? mappedDependencies
        : deliverableDependencyCodes.length > 0
          ? deliverableDependencyCodes
          : phaseLeafDependencies.length > 0
            ? phaseLeafDependencies
            : (defaultMilestoneDependency ? [defaultMilestoneDependency] : []);

    // If we anchored by title, discard the LLM's targetDate so scheduling
    // derives it from the anchor task's end date.
    const effectiveTargetDate = titleAnchor ? null : targetDate;

    const milestoneOrdinal = (milestoneSequenceByPhase.get(inferredPhaseCode) || 0) + 1;
    milestoneSequenceByPhase.set(inferredPhaseCode, milestoneOrdinal);
    const phasePrefix = inferredPhaseCode.replace(/\.0$/, '');
    const msCode = `${phasePrefix}.${90 + milestoneOrdinal}`;

    tasks.push({
      taskCode: msCode,
      title: asString(ms.name, `Milestone ${m + 1}`),
      description: asString(milestoneRecord.description || milestoneRecord.criteria, '') || null,
      taskType: 'milestone',
      priority: 'high',
      duration: 1,
      estimatedHours: 0,
      dependencies: finalDependencies,
      deliverables: milestoneDeliverables,
      resources: [],
      wbsLevel: 2,
      parentTaskCode: inferredPhaseCode,
      sortOrder: sortOrder++,
      plannedStartDate: effectiveTargetDate || null,
      plannedEndDate: effectiveTargetDate || null,
      isCriticalPath: false,
    });
  }

  // Ensure sortOrder is strictly increasing
  tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  for (let i = 0; i < tasks.length; i++) tasks[i]!.sortOrder = i + 1;

  const scaledTasks = Number.isFinite(params.targetDurationDays)
    ? scaleDurationsToTarget({
        tasks,
        baseDate,
        targetDurationDays: Number(params.targetDurationDays),
      })
    : tasks;

  const tasksWithDates = calculateDependencyBasedDates(scaledTasks, baseDate);

  // Clamp any task end-date that slipped past sanitization (e.g. a milestone
  // that arrived with valid-looking but far-future explicit dates) to the
  // project envelope. Without this, parent rollup below propagates that
  // hallucinated date into the phase summary (3500-day durations etc.).
  for (const t of tasksWithDates) {
    if (!t.plannedEndDate) continue;
    const end = new Date(t.plannedEndDate);
    if (Number.isNaN(end.getTime())) continue;
    if (end.getTime() > MAX_PLAUSIBLE_MS) {
      const clamped = new Date(MAX_PLAUSIBLE_MS).toISOString().split('T')[0]!;
      t.plannedEndDate = clamped;
      if (t.plannedStartDate && new Date(t.plannedStartDate).getTime() > MAX_PLAUSIBLE_MS) {
        t.plannedStartDate = clamped;
      }
      // Recompute duration from clamped window.
      if (t.plannedStartDate) {
        const s = new Date(t.plannedStartDate);
        const e = new Date(t.plannedEndDate);
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
          t.duration = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
        }
      }
    }
  }

  rollUpParentPlannedDates(tasksWithDates);

  const phaseCount = tasksWithDates.filter((t) => t.wbsLevel === 1).length;
  const milestoneCount = tasksWithDates.filter((t) => t.taskType === 'milestone').length;
  const totalHours = tasksWithDates.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);

  // crude duration: max end date - start date
  let projectDuration = 0;
  for (const t of tasksWithDates) {
    if (!t.plannedEndDate) continue;
    const end = new Date(t.plannedEndDate);
    const days = Math.ceil((end.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(days) && days > projectDuration) projectDuration = days;
  }

  return {
    tasks: tasksWithDates,
    summary: {
      totalTasks: tasksWithDates.length,
      totalPhases: phaseCount,
      totalMilestones: milestoneCount,
      criticalPathDuration: projectDuration,
      estimatedTotalHours: totalHours,
    },
  };
}

export function calculateDependencyBasedDates(tasks: GeneratedWbsTaskLike[], baseDate: Date): GeneratedWbsTaskLike[] {
  const taskMap = new Map<string, GeneratedWbsTaskLike>();
  tasks.forEach((t) => taskMap.set(t.taskCode, t));

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.taskCode, 0);
    adjacency.set(t.taskCode, []);
  }

  for (const t of tasks) {
    for (const depCode of (Array.isArray(t.dependencies) ? t.dependencies : [])) {
      if (!taskMap.has(depCode)) continue;
      inDegree.set(t.taskCode, (inDegree.get(t.taskCode) || 0) + 1);
      const succ = adjacency.get(depCode) || [];
      succ.push(t.taskCode);
      adjacency.set(depCode, succ);
    }
  }

  const processingOrder: string[] = [];
  const queue: string[] = [];
  const remainingDegree = new Map(inDegree);

  remainingDegree.forEach((deg, code) => {
    if (deg === 0) queue.push(code);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    processingOrder.push(current);

    for (const successor of (adjacency.get(current) || [])) {
      const newDeg = (remainingDegree.get(successor) || 1) - 1;
      remainingDegree.set(successor, newDeg);
      if (newDeg === 0) queue.push(successor);
    }
  }

  // Append orphans (cycles/disconnected)
  const orphanCodes = tasks.filter((t) => !processingOrder.includes(t.taskCode)).map((t) => t.taskCode);
  processingOrder.push(...orphanCodes);

  const taskDates = new Map<string, { start: Date; end: Date }>();

  for (const taskCode of processingOrder) {
    const task = taskMap.get(taskCode);
    if (!task) continue;

    // If task has explicit date (milestone target), keep it.
    if (task.plannedStartDate && task.plannedEndDate) {
      const s = new Date(task.plannedStartDate);
      const e = new Date(task.plannedEndDate);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
        taskDates.set(taskCode, { start: s, end: e });
        continue;
      }
    }

    let start: Date;
    const deps = Array.isArray(task.dependencies) ? task.dependencies : [];

    if (deps.length === 0) {
      start = new Date(baseDate);
    } else {
      let maxEnd = new Date(baseDate);
      maxEnd.setDate(maxEnd.getDate() - 1);

      for (const dep of deps) {
        const depDates = taskDates.get(dep);
        if (depDates && depDates.end > maxEnd) maxEnd = new Date(depDates.end);
      }

      start = new Date(maxEnd);
      start.setDate(start.getDate() + 1);
    }

    const duration = Math.max(1, Number(task.duration) || 1);
    const end = new Date(start);
    end.setDate(end.getDate() + duration - 1);

    taskDates.set(taskCode, { start, end });
  }

  return tasks.map((t) => {
    const dates = taskDates.get(t.taskCode);
    if (!dates) return t;
    return {
      ...t,
      plannedStartDate: dates.start.toISOString().split('T')[0],
      plannedEndDate: dates.end.toISOString().split('T')[0],
    };
  });
}
