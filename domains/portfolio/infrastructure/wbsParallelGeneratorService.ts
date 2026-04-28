import { logger } from "@platform/logging/Logger";
import { EventEmitter } from 'events';

// ============ TYPE DEFINITIONS ============

interface GanttItem {
  phase?: string;
  start?: string;
  end?: string;
}

interface TimelineData {
  totalDuration?: string;
  gantt?: GanttItem[];
}

interface ImplementationPlan {
  phases?: PhaseData[];
  timeline?: TimelineData;
}

interface PhaseData {
  name?: string;
  phaseName?: string;
  deliverables?: string[];
  workPackages?: string[];
  duration?: string;
  description?: string;
}

interface BusinessCaseContent {
  content?: BusinessCaseData;
  implementationPhases?: PhaseData[];
  implementationPlan?: ImplementationPlan;
  phases?: PhaseData[];
  timeline?: TimelineData;
}

type BusinessCaseData = BusinessCaseContent | PhaseData[];

interface PredecessorObject {
  taskCode: string;
  lagDays?: number;
}

interface TaskWithPhaseOffset extends GeneratedWbsTask {
  _phaseStartOffset?: number;
}

// ============ END TYPE DEFINITIONS ============

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (typeof value === 'object' && value !== null) {
    return value as UnknownRecord;
  }
  return {};
}

function getRecordString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function buildRequirementsContext(requirementsAnalysis: unknown): string {
  if (!requirementsAnalysis) return '';
  const ra = asRecord(requirementsAnalysis).content ?? requirementsAnalysis;
  const raRecord = asRecord(ra);
  
  const sections: string[] = ['\nDETAILED REQUIREMENTS ANALYSIS:'];
  
  const funcReqs = raRecord.functionalRequirements || raRecord.functional_requirements || [];
  if (Array.isArray(funcReqs) && funcReqs.length > 0) {
    sections.push('Functional Requirements:');
    funcReqs.slice(0, 15).forEach((r: unknown) => {
      const record = asRecord(r);
      const name = typeof r === 'string' ? r : getRecordString(record, ['name', 'title', 'requirement', 'description']);
      const priority = typeof r === 'string' ? '' : getRecordString(record, ['priority', 'importance']);
      if (name) sections.push(`  - ${name}${priority ? ` [${priority}]` : ''}`);
    });
  }
  
  const nonFuncReqs = raRecord.nonFunctionalRequirements || raRecord.non_functional_requirements || raRecord.nfrs || [];
  if (Array.isArray(nonFuncReqs) && nonFuncReqs.length > 0) {
    sections.push('Non-Functional Requirements:');
    nonFuncReqs.slice(0, 10).forEach((r: unknown) => {
      const record = asRecord(r);
      const name = typeof r === 'string' ? r : getRecordString(record, ['name', 'title', 'requirement', 'category']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const secReqs = raRecord.securityRequirements || raRecord.security_requirements || [];
  if (Array.isArray(secReqs) && secReqs.length > 0) {
    sections.push('Security Requirements:');
    secReqs.slice(0, 8).forEach((r: unknown) => {
      const record = asRecord(r);
      const name = typeof r === 'string' ? r : getRecordString(record, ['name', 'title', 'requirement']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const integrations = raRecord.integrationRequirements || raRecord.integration_requirements || raRecord.integrations || [];
  if (Array.isArray(integrations) && integrations.length > 0) {
    sections.push('Integration Requirements:');
    integrations.slice(0, 8).forEach((r: unknown) => {
      const record = asRecord(r);
      const name = typeof r === 'string' ? r : getRecordString(record, ['name', 'system', 'title']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const capabilities = raRecord.capabilities || raRecord.systemCapabilities || [];
  if (Array.isArray(capabilities) && capabilities.length > 0) {
    sections.push('System Capabilities:');
    capabilities.slice(0, 10).forEach((c: unknown) => {
      const record = asRecord(c);
      const name = typeof c === 'string' ? c : getRecordString(record, ['name', 'capability', 'title']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const techStack = raRecord.technologyStack || raRecord.technology_stack || raRecord.techStack || null;
  if (techStack) {
    sections.push(`Technology Stack: ${typeof techStack === 'string' ? techStack : JSON.stringify(techStack).slice(0, 500)}`);
  }
  
  if (sections.length <= 1) return '';
  return sections.join('\n') + '\n';
}

function buildStrategicFitContext(strategicFitAnalysis: unknown): string {
  if (!strategicFitAnalysis) return '';
  const sf = asRecord(strategicFitAnalysis).content ?? strategicFitAnalysis;
  const sfRecord = asRecord(sf);
  
  const sections: string[] = ['\nSTRATEGIC FIT ANALYSIS:'];
  
  const route = sfRecord.recommendedRoute || sfRecord.recommended_route || sfRecord.implementationRoute || '';
  if (route) {
    const routeName = typeof route === 'string' ? route : getRecordString(asRecord(route), ['name', 'route', 'recommendation']);
    if (routeName) sections.push(`Recommended Implementation Route: ${routeName}`);
  }
  
  const alignment = sfRecord.strategicAlignment || sfRecord.strategic_alignment || sfRecord.alignmentScore || null;
  if (alignment) {
    sections.push(`Strategic Alignment: ${typeof alignment === 'object' ? JSON.stringify(alignment).slice(0, 300) : alignment}`);
  }
  
  const risks = sfRecord.implementationRisks || sfRecord.risks || sfRecord.riskFactors || [];
  if (Array.isArray(risks) && risks.length > 0) {
    sections.push('Implementation Risks:');
    risks.slice(0, 8).forEach((r: unknown) => {
      const record = asRecord(r);
      const name = typeof r === 'string' ? r : getRecordString(record, ['risk', 'name', 'title', 'description']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const considerations = sfRecord.implementationConsiderations || sfRecord.considerations || sfRecord.keyConsiderations || [];
  if (Array.isArray(considerations) && considerations.length > 0) {
    sections.push('Implementation Considerations:');
    considerations.slice(0, 8).forEach((c: unknown) => {
      const record = asRecord(c);
      const name = typeof c === 'string' ? c : getRecordString(record, ['name', 'consideration', 'title']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const dependencies = sfRecord.dependencies || sfRecord.externalDependencies || [];
  if (Array.isArray(dependencies) && dependencies.length > 0) {
    sections.push('Strategic Dependencies:');
    dependencies.slice(0, 6).forEach((d: unknown) => {
      const record = asRecord(d);
      const name = typeof d === 'string' ? d : getRecordString(record, ['name', 'dependency', 'title']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  const compliance = sfRecord.complianceRequirements || sfRecord.compliance || sfRecord.regulatoryConsiderations || [];
  if (Array.isArray(compliance) && compliance.length > 0) {
    sections.push('Compliance/Regulatory Requirements:');
    compliance.slice(0, 6).forEach((c: unknown) => {
      const record = asRecord(c);
      const name = typeof c === 'string' ? c : getRecordString(record, ['name', 'requirement', 'title']);
      if (name) sections.push(`  - ${name}`);
    });
  }
  
  if (sections.length <= 1) return '';
  return sections.join('\n') + '\n';
}

export interface WbsGenerationProgress {
  phase: 'analyzing' | 'planning' | 'generating' | 'computing' | 'complete' | 'error';
  step: number;
  totalSteps: number;
  message: string;
  percentage: number;
  details?: string;
}

export interface GeneratedWbsTask {
  taskCode: string;
  title: string;
  description: string;
  taskType: 'phase' | 'task' | 'milestone' | 'deliverable';
  priority: 'critical' | 'high' | 'medium' | 'low';
  plannedStartDate: string;
  plannedEndDate: string;
  duration: number;
  estimatedHours: number;
  dependencies: string[];
  predecessors?: Array<string | { taskCode: string; lagDays?: number }>;
  deliverables: string[];
  resources: string[];
  wbsLevel: number;
  parentTaskCode?: string;
  sortOrder: number;
  isCriticalPath?: boolean;
  isMilestone?: boolean;
  riskLevel?: 'high' | 'medium' | 'low';
}

export interface WbsGenerationResult {
  tasks: GeneratedWbsTask[];
  summary: {
    totalTasks: number;
    totalPhases: number;
    totalMilestones: number;
    criticalPathDuration: number;
    estimatedTotalHours: number;
    criticalPathTaskCount: number;
  };
}

const progressEmitters = new Map<string, EventEmitter>();
const progressState = new Map<string, WbsGenerationProgress>();

export function createProgressEmitter(projectId: string): EventEmitter {
  const emitter = new EventEmitter();
  progressEmitters.set(projectId, emitter);
  return emitter;
}

export function getProgress(projectId: string): WbsGenerationProgress | null {
  return progressState.get(projectId) || null;
}

export function clearProgress(projectId: string): void {
  progressEmitters.delete(projectId);
  progressState.delete(projectId);
}

function updateProgress(projectId: string, progress: WbsGenerationProgress) {
  progressState.set(projectId, progress);
  const emitter = progressEmitters.get(projectId);
  if (emitter) {
    emitter.emit('progress', progress);
  }
}

interface PhaseStructure {
  phaseNumber: number;
  phaseName: string;
  phaseDescription: string;
  duration: number;
  startMonth: number; // Month number when phase starts (1-based)
  workPackages: string[];
}

// Convert duration string like "2 months", "3 weeks", "15 days" to working days
function parseDurationToDays(durationStr: string): number {
  if (!durationStr) return 22; // Default 1 month
  
  const str = durationStr.toLowerCase().trim();
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  const num = numMatch ? parseFloat(numMatch[1]!) : 1;
  
  if (str.includes('month')) {
    return Math.round(num * 22); // ~22 working days per month
  } else if (str.includes('week')) {
    return Math.round(num * 5); // 5 working days per week
  } else if (str.includes('day')) {
    return Math.round(num);
  } else if (str.includes('year')) {
    return Math.round(num * 260); // ~260 working days per year
  }
  
  return Math.round(num * 22); // Default to months if unspecified
}

// Parse "Month X" format to number
function parseMonthNumber(monthStr: string): number {
  if (!monthStr) return 1;
  const match = monthStr.match(/(\d+)/);
  return match ? parseInt(match[1]!) : 1;
}

async function generatePhaseStructure(
  projectName: string,
  projectDescription: string,
  businessCase: BusinessCaseData
): Promise<PhaseStructure[]> {
  const businessCaseRecord = asRecord(businessCase);
  const bc = asRecord((businessCaseRecord.content ?? businessCase) as unknown);
  const bcAny = bc as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  const implementationPhases = bcAny?.implementationPhases ||
    bcAny?.implementationPlan?.phases ||
    bcAny?.phases || [];
    
  // Get timeline Gantt data for phase scheduling
  const timeline = bcAny?.timeline || bcAny?.implementationPlan?.timeline || {};
  const ganttData = timeline?.gantt || [];
  
  // Build a map of phase name to gantt schedule
  const ganttMap = new Map<string, { start: number; end: number }>();
  ganttData.forEach((g: GanttItem) => {
    if (g.phase) {
      ganttMap.set(g.phase.toLowerCase(), {
        start: parseMonthNumber(g.start || ''),
        end: parseMonthNumber(g.end || '')
      });
    }
  });
  
  logger.info(`[WBS] Timeline: ${timeline?.totalDuration || 'unknown'}, Gantt phases: ${ganttMap.size}`);

  // If we have phases from business case, USE THEM instead of generating new ones
  if (implementationPhases && implementationPhases.length > 0) {
    logger.info(`[WBS] Using ${implementationPhases.length} phases from business case`);
    
    let cumulativeStartMonth = 1;
    
    return implementationPhases.map((phase: PhaseData, index: number) => {
      const phaseName = phase.name || phase.phaseName || `Phase ${index + 1}`;
      const deliverables = phase.deliverables || phase.workPackages || [];
      
      // Try to find matching Gantt data for this phase
      const phaseNameLower = phaseName.toLowerCase();
      let startMonth = cumulativeStartMonth;
      let durationDays: number;
      
      // Search for matching Gantt entry
      let matchedGantt: { start: number; end: number } | undefined;
      const ganttEntries = Array.from(ganttMap.entries());
      for (const [key, value] of ganttEntries) {
        if (phaseNameLower.includes(key) || key.includes(phaseNameLower.replace(/phase \d+:\s*/i, ''))) {
          matchedGantt = value;
          break;
        }
      }
      
      if (matchedGantt) {
        // Use Gantt schedule from timeline
        startMonth = matchedGantt.start;
        const durationMonths = matchedGantt.end - matchedGantt.start + 1;
        durationDays = durationMonths * 22; // 22 working days per month
        logger.info(`[WBS] Phase "${phaseName}": Month ${startMonth} to ${matchedGantt.end} (${durationMonths} months = ${durationDays} days)`);
      } else {
        // Fallback to phase duration field
        durationDays = parseDurationToDays(phase.duration || '1 month');
        logger.info(`[WBS] Phase "${phaseName}": Using duration field (${durationDays} days), starting month ${startMonth}`);
      }
      
      // Update cumulative for next phase if no Gantt data
      if (!matchedGantt) {
        cumulativeStartMonth += Math.ceil(durationDays / 22);
      }
      
      return {
        phaseNumber: index + 1,
        phaseName: phaseName,
        phaseDescription: phase.description || `${phaseName} for the project`,
        duration: durationDays,
        startMonth: startMonth,
        workPackages: Array.isArray(deliverables) ? deliverables.slice(0, 6) : [],
      };
    });
  }

  // Only call AI if NO phases exist in business case (fallback)
  logger.info(`[WBS] No phases in business case, generating with AI`);

  // Legacy direct-provider generation is disabled for production readiness.
  // WBS generation must run through Corevia Brain governance (/brain/ai/run contract).
  throw new Error("Legacy WBS phase generation disabled: use Corevia Brain wbs.generate");
}

async function generatePhaseTasksParallel(
  phase: PhaseStructure,
  projectName: string,
  startDate: string,
  phaseIndex: number,
  requirementsAnalysis?: unknown,
  strategicFitAnalysis?: unknown
): Promise<GeneratedWbsTask[]> {
  const phaseCode = `${phaseIndex + 1}.0`;
  
  const reqContext = buildRequirementsContext(requirementsAnalysis);
  const stratContext = buildStrategicFitContext(strategicFitAnalysis);
  
  const prompt = `Generate detailed WBS tasks for this project phase.

PROJECT: ${projectName}
PHASE ${phaseIndex + 1}: ${phase.phaseName}
DESCRIPTION: ${phase.phaseDescription}
DURATION: ${phase.duration} days
WORK PACKAGES: ${phase.workPackages.join(', ')}
${reqContext}${stratContext}
Generate tasks with this structure - return ONLY valid JSON array:

[
  {
    "taskCode": "${phaseCode}",
    "title": "${phase.phaseName}",
    "description": "${phase.phaseDescription}",
    "taskType": "phase",
    "priority": "high",
    "duration": ${phase.duration},
    "estimatedHours": ${phase.duration * 8},
    "dependencies": [],
    "deliverables": [],
    "resources": ["Project Manager"],
    "wbsLevel": 1,
    "sortOrder": 1
  },
  {
    "taskCode": "${phaseIndex + 1}.1",
    "title": "Work Package Name",
    "description": "Description",
    "taskType": "task",
    "priority": "medium",
    "duration": 5,
    "estimatedHours": 40,
    "dependencies": [],
    "deliverables": ["Deliverable name"],
    "resources": ["Role"],
    "wbsLevel": 2,
    "parentTaskCode": "${phaseCode}",
    "sortOrder": 2
  },
  {
    "taskCode": "${phaseIndex + 1}.1.1",
    "title": "Activity Name",
    "description": "Specific activity",
    "taskType": "task",
    "priority": "medium",
    "duration": 2,
    "estimatedHours": 16,
    "dependencies": [],
    "deliverables": [],
    "resources": ["Role"],
    "wbsLevel": 3,
    "parentTaskCode": "${phaseIndex + 1}.1",
    "sortOrder": 3
  }
]

RULES:
- Create 2-3 Level 2 work packages per phase
- Create 2-3 Level 3 activities per work package
- Use realistic UAE government durations
- Include proper dependencies within the phase`;

  void prompt;
  void startDate;

  // Legacy direct-provider generation is disabled for production readiness.
  // WBS generation must run through Corevia Brain governance (/brain/ai/run contract).
  throw new Error("Legacy WBS task generation disabled: use Corevia Brain wbs.generate");
}

// Helper to normalize all dependency sources into task codes (shared utility)
function getNormalizedDependencies(task: GeneratedWbsTask): string[] {
  const deps: string[] = [];
  
  // Add from dependencies array (string codes)
  if (task.dependencies && Array.isArray(task.dependencies)) {
    task.dependencies.forEach(d => {
      if (typeof d === 'string' && d) deps.push(d);
    });
  }
  
  // Add from predecessors array (may be objects or strings)
  if (task.predecessors && Array.isArray(task.predecessors)) {
    task.predecessors.forEach((p: string | PredecessorObject) => {
      if (typeof p === 'string' && p) {
        deps.push(p);
      } else if (p && typeof p === 'object' && (p as PredecessorObject).taskCode) {
        deps.push((p as PredecessorObject).taskCode);
      }
    });
  }
  
  // Return unique codes
  return Array.from(new Set(deps));
}

function markMilestonesAndRisks(tasks: GeneratedWbsTask[]): GeneratedWbsTask[] {
  // Strict milestone keywords - only explicit milestone indicators
  const strictMilestoneKeywords = [
    'sign-off', 'signoff', 'go-live', 'golive', 'launch', 'handover',
    'hand-over', 'release', 'acceptance', 'cutover', 'milestone'
  ];
  
  // Words that indicate high risk
  const riskKeywords = [
    'migration', 'integration', 'security', 'compliance', 'testing', 'procurement',
    'vendor', 'data', 'infrastructure', 'deployment', 'uat', 'user acceptance'
  ];
  
  return tasks.map(task => {
    const title = task.title.toLowerCase();
    const desc = (task.description || '').toLowerCase();
    const combined = `${title} ${desc}`;
    
    // Check if already marked as milestone by AI
    const alreadyMilestone = task.taskType === 'milestone';
    
    // Check for strict milestone keywords (not generic words like "complete")
    const hasStrictKeyword = strictMilestoneKeywords.some(kw => combined.includes(kw));

    // Only mark as milestone when the task is explicitly modeled as a milestone.
    const isMilestone = alreadyMilestone || hasStrictKeyword;
    
    // Check for risk indicators
    const hasRiskIndicators = riskKeywords.some(kw => combined.includes(kw));
    const isHighPriority = task.priority === 'high' || task.priority === 'critical';
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (hasRiskIndicators && isHighPriority) {
      riskLevel = 'high';
    } else if (hasRiskIndicators || isHighPriority) {
      riskLevel = 'medium';
    }
    
    // Set taskType='milestone' for persistence, but ONLY for non-phase tasks
    // Phase tasks should remain as 'phase' type even if they're milestones
    const shouldSetMilestoneType = isMilestone && task.taskType !== 'phase';
    
    return {
      ...task,
      taskType: shouldSetMilestoneType ? 'milestone' as const : task.taskType,
      isMilestone,
      riskLevel,
    };
  });
}

// Link phases together by adding dependencies from last task of each phase to first task of next phase
function linkSequentialPhases(tasks: GeneratedWbsTask[]): GeneratedWbsTask[] {
  // Helper to compare task codes numerically
  const compareTaskCodes = (a: string, b: string): number => {
    const aParts = a.split('.').map(p => parseInt(p, 10) || 0);
    const bParts = b.split('.').map(p => parseInt(p, 10) || 0);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  };
  
  // Group tasks by phase number
  const phaseGroups = new Map<number, GeneratedWbsTask[]>();
  tasks.forEach(task => {
    const phaseNum = parseInt(task.taskCode.split('.')[0]!, 10);
    if (!phaseGroups.has(phaseNum)) {
      phaseGroups.set(phaseNum, []);
    }
    phaseGroups.get(phaseNum)!.push(task);
  });
  
  // Find the last task (milestone) in each phase and first task of each phase
  const phaseLastTask = new Map<number, string>();
  const phaseFirstTask = new Map<number, string>();
  
  phaseGroups.forEach((phaseTasks, phaseNum) => {
    // Find first non-phase-level task (first work package or activity)
    const nonPhaseTasks = phaseTasks.filter(t => t.wbsLevel >= 2);
    if (nonPhaseTasks.length === 0) return;
    
    // Sort by task code to find first and last
    nonPhaseTasks.sort((a, b) => compareTaskCodes(a.taskCode, b.taskCode));
    
    phaseFirstTask.set(phaseNum, nonPhaseTasks[0]!.taskCode);
    phaseLastTask.set(phaseNum, nonPhaseTasks[nonPhaseTasks.length - 1]!.taskCode);
  });
  
  // Get sorted phase numbers
  const phaseNumbers = Array.from(phaseGroups.keys()).sort((a, b) => a - b);
  
  // Create task map for quick lookup
  const taskMap = new Map<string, GeneratedWbsTask>();
  tasks.forEach(t => taskMap.set(t.taskCode, t));
  
  // Link phases: add dependency from previous phase's last task to current phase's first task
  for (let i = 1; i < phaseNumbers.length; i++) {
    const prevPhase = phaseNumbers[i - 1]!;
    const currentPhase = phaseNumbers[i]!;
    
    const prevLastTaskCode = phaseLastTask.get(prevPhase);
    const currentFirstTaskCode = phaseFirstTask.get(currentPhase);
    
    if (prevLastTaskCode && currentFirstTaskCode) {
      const currentFirstTask = taskMap.get(currentFirstTaskCode);
      if (currentFirstTask) {
        // Add the dependency if not already present
        const existingDeps = currentFirstTask.dependencies || [];
        if (!existingDeps.includes(prevLastTaskCode)) {
          currentFirstTask.dependencies = [...existingDeps, prevLastTaskCode];
          logger.info(`[WBS] Linked Phase ${prevPhase} -> Phase ${currentPhase}: ${prevLastTaskCode} -> ${currentFirstTaskCode}`);
        }
      }
    }
  }
  
  return tasks;
}

function calculateDependencyBasedDates(tasks: GeneratedWbsTask[], baseDate: Date): GeneratedWbsTask[] {
  const taskMap = new Map<string, GeneratedWbsTask>();
  tasks.forEach(t => taskMap.set(t.taskCode, t));
  
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  tasks.forEach(t => {
    inDegree.set(t.taskCode, 0);
    adjacency.set(t.taskCode, []);
  });
  
  // Use normalized dependencies (includes both dependencies AND predecessors)
  tasks.forEach(t => {
    const allDeps = getNormalizedDependencies(t);
    allDeps.forEach(depCode => {
      if (taskMap.has(depCode)) {
        inDegree.set(t.taskCode, (inDegree.get(t.taskCode) || 0) + 1);
        const adj = adjacency.get(depCode) || [];
        adj.push(t.taskCode);
        adjacency.set(depCode, adj);
      }
    });
  });
  
  const processingOrder: string[] = [];
  const queue: string[] = [];
  const remainingDegree = new Map(inDegree);
  
  remainingDegree.forEach((deg, code) => {
    if (deg === 0) queue.push(code);
  });
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    processingOrder.push(current);
    
    (adjacency.get(current) || []).forEach(successor => {
      const newDeg = (remainingDegree.get(successor) || 1) - 1;
      remainingDegree.set(successor, newDeg);
      if (newDeg === 0) queue.push(successor);
    });
  }
  
  const orphanTasks = tasks.filter(t => !processingOrder.includes(t.taskCode)).map(t => t.taskCode);
  processingOrder.push(...orphanTasks);
  
  const taskDates = new Map<string, { start: Date; end: Date }>();
  
  processingOrder.forEach(taskCode => {
    const task = taskMap.get(taskCode);
    if (!task) return;
    
    let startDate: Date;
    
    // Use normalized dependencies (both dependencies AND predecessors)
    const allDeps = getNormalizedDependencies(task);
    
    if (allDeps.length === 0) {
      if (task.parentTaskCode) {
        const parentDates = taskDates.get(task.parentTaskCode);
        startDate = parentDates ? new Date(parentDates.start) : new Date(baseDate);
      } else {
        // Use phase start offset if available (from timeline Gantt)
        const phaseOffset = (task as TaskWithPhaseOffset)._phaseStartOffset || 0;
        startDate = new Date(baseDate);
        startDate.setDate(startDate.getDate() + phaseOffset);
      }
    } else {
      let maxEndDate = new Date(baseDate);
      maxEndDate.setDate(maxEndDate.getDate() - 1);
      
      // Use all normalized dependencies
      allDeps.forEach(depCode => {
        const depDates = taskDates.get(depCode);
        if (depDates && depDates.end > maxEndDate) {
          maxEndDate = new Date(depDates.end);
        }
      });
      
      startDate = new Date(maxEndDate);
      startDate.setDate(startDate.getDate() + 1);
    }
    
    const duration = task.duration || 5;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);
    
    taskDates.set(taskCode, { start: startDate, end: endDate });
  });
  
  return tasks.map(task => {
    const dates = taskDates.get(task.taskCode);
    if (dates) {
      return {
        ...task,
        plannedStartDate: dates.start.toISOString().split('T')[0]!,
        plannedEndDate: dates.end.toISOString().split('T')[0]!,
      };
    }
    return task;
  });
}

function computeCriticalPath(tasks: GeneratedWbsTask[]): GeneratedWbsTask[] {
  if (tasks.length === 0) return tasks;
  
  const taskMap = new Map<string, GeneratedWbsTask>();
  tasks.forEach(t => taskMap.set(t.taskCode, t));
  
  // Find the project start date from the earliest task
  let projectStartDate: Date | null = null;
  tasks.forEach(t => {
    if (t.plannedStartDate) {
      const d = new Date(t.plannedStartDate);
      if (!projectStartDate || d < projectStartDate) projectStartDate = d;
    }
  });
  if (!projectStartDate) projectStartDate = new Date();
  
  // Convert planned dates to day offsets for calculation
  const getOffset = (dateStr: string): number => {
    const d = new Date(dateStr);
    return Math.floor((d.getTime() - projectStartDate!.getTime()) / (1000 * 60 * 60 * 24));
  };
  
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();
  
  // Include all tasks with dependencies for critical path (not just leaf tasks)
  const workTasks = tasks.filter(t => t.wbsLevel >= 1);
  
  // Create adjacency list for topological sort
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  workTasks.forEach(task => {
    inDegree.set(task.taskCode, 0);
    adjacency.set(task.taskCode, []);
  });
  
  // Build graph based on all dependencies (both dependencies and predecessors)
  workTasks.forEach(task => {
    const allDeps = getNormalizedDependencies(task);
    if (allDeps.length > 0) {
      allDeps.forEach(depCode => {
        if (taskMap.has(depCode) && adjacency.has(depCode)) {
          const successors = adjacency.get(depCode) || [];
          successors.push(task.taskCode);
          adjacency.set(depCode, successors);
          inDegree.set(task.taskCode, (inDegree.get(task.taskCode) || 0) + 1);
        }
      });
    }
  });
  
  // Topological sort using Kahn's algorithm
  const queue: string[] = [];
  workTasks.forEach(task => {
    if ((inDegree.get(task.taskCode) || 0) === 0) {
      queue.push(task.taskCode);
    }
  });
  
  const sortedCodes: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedCodes.push(current);
    (adjacency.get(current) || []).forEach(successor => {
      const newDeg = (inDegree.get(successor) || 1) - 1;
      inDegree.set(successor, newDeg);
      if (newDeg === 0) queue.push(successor);
    });
  }
  
  // Add orphan tasks that weren't processed
  workTasks.forEach(t => {
    if (!sortedCodes.includes(t.taskCode)) {
      sortedCodes.push(t.taskCode);
    }
  });
  
  // Forward pass - use actual planned dates as starting point
  sortedCodes.forEach(code => {
    const task = taskMap.get(code);
    if (!task) return;
    
    // Use actual planned start date as ES baseline
    let es = task.plannedStartDate ? getOffset(task.plannedStartDate) : 0;
    
    // If task has dependencies, ES = max(EF of predecessors)
    // Use normalized dependencies (includes both dependencies AND predecessors)
    const allDeps = getNormalizedDependencies(task);
    if (allDeps.length > 0) {
      allDeps.forEach(depCode => {
        const depEf = earliestFinish.get(depCode);
        if (depEf !== undefined && depEf > es) es = depEf;
      });
    }
    
    earliestStart.set(code, es);
    earliestFinish.set(code, es + (task.duration || 5));
  });
  
  // Find project duration
  let projectDuration = 0;
  earliestFinish.forEach(ef => {
    if (ef > projectDuration) projectDuration = ef;
  });
  
  // Initialize latest finish for terminal tasks
  workTasks.forEach(task => {
    const successors = adjacency.get(task.taskCode) || [];
    if (successors.length === 0) {
      latestFinish.set(task.taskCode, projectDuration);
      latestStart.set(task.taskCode, projectDuration - (task.duration || 5));
    }
  });
  
  // Backward pass - calculate latest start/finish
  [...sortedCodes].reverse().forEach(code => {
    const task = taskMap.get(code);
    if (!task) return;
    
    if (latestFinish.has(code)) return;
    
    const successors = adjacency.get(code) || [];
    let lf = projectDuration;
    
    if (successors.length > 0) {
      successors.forEach(succCode => {
        const succLs = latestStart.get(succCode);
        if (succLs !== undefined && succLs < lf) lf = succLs;
      });
    }
    
    latestFinish.set(code, lf);
    latestStart.set(code, lf - (task.duration || 5));
  });
  
  // Mark critical path tasks (total float = 0 or near 0)
  return tasks.map(task => {
    const es = earliestStart.get(task.taskCode);
    const ls = latestStart.get(task.taskCode);
    
    if (es === undefined || ls === undefined) {
      return { ...task, isCriticalPath: false };
    }
    
    const totalFloat = Math.abs(ls - es);
    const isCritical = totalFloat <= 2; // Allow small float tolerance (2 days)
    
    return {
      ...task,
      isCriticalPath: isCritical,
      totalFloat: totalFloat,
    };
  });
}

export async function generateWbsParallel(
  projectId: string,
  projectName: string,
  projectDescription: string,
  businessCase: BusinessCaseData,
  startDate: string,
  requirementsAnalysis?: unknown,
  strategicFitAnalysis?: unknown
): Promise<WbsGenerationResult> {
  logger.info(`[WBS Parallel] Starting parallel generation for project: ${projectId}`);
  
  try {
    updateProgress(projectId, {
      phase: 'analyzing',
      step: 1,
      totalSteps: 4,
      message: 'Analyzing business case and project requirements...',
      percentage: 10,
      details: 'Extracting phases, milestones, and deliverables from your business case',
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    const phases = await generatePhaseStructure(projectName, projectDescription, businessCase);
    logger.info(`[WBS Parallel] Generated ${phases.length} phases`);
    
    updateProgress(projectId, {
      phase: 'planning',
      step: 2,
      totalSteps: 4,
      message: `Planning ${phases.length} project phases in parallel...`,
      percentage: 25,
      details: phases.map(p => p.phaseName).join(' • '),
    });
    
    await new Promise(r => setTimeout(r, 300));
    
    updateProgress(projectId, {
      phase: 'generating',
      step: 3,
      totalSteps: 4,
      message: `Generating detailed tasks for ${phases.length} phases simultaneously...`,
      percentage: 40,
      details: 'Creating 3-level WBS hierarchy with work packages and activities',
    });
    
    const phaseTaskPromises = phases.map((phase, index) => 
      generatePhaseTasksParallel(phase, projectName, startDate, index, requirementsAnalysis, strategicFitAnalysis)
    );
    
    const phaseTaskResults = await Promise.all(phaseTaskPromises);
    
    let allTasks: GeneratedWbsTask[] = [];
    let sortOrder = 1;
    const baseDate = new Date(startDate);
    
    phaseTaskResults.forEach((phaseTasks, phaseIndex) => {
      const phase = phases[phaseIndex]!;
      // Calculate phase start date based on startMonth from timeline
      const phaseStartOffset = (phase.startMonth - 1) * 22; // Working days offset
      const phaseStartDate = new Date(baseDate);
      phaseStartDate.setDate(phaseStartDate.getDate() + phaseStartOffset);
      
      phaseTasks.forEach(task => {
        // Apply phase start offset to task dates
        const taskWithPhaseOffset = {
          ...task,
          sortOrder: sortOrder++,
          _phaseStartOffset: phaseStartOffset, // Store for date calculation
        };
        allTasks.push(taskWithPhaseOffset);
      });
    });
    
    logger.info(`[WBS Parallel] Generated ${allTasks.length} total tasks`);
    
    // Mark phase completion tasks as milestones
    allTasks = markMilestonesAndRisks(allTasks);
    
    // CRITICAL: Link phases together so Phase 2 depends on Phase 1, etc.
    // This ensures early phases are on the critical path (they have successors)
    allTasks = linkSequentialPhases(allTasks);
    
    updateProgress(projectId, {
      phase: 'computing',
      step: 4,
      totalSteps: 4,
      message: 'Computing critical path and scheduling...',
      percentage: 80,
      details: `Processing ${allTasks.length} tasks with dependency-based scheduling`,
    });
    
    // Use baseDate already defined above
    allTasks = calculateDependencyBasedDates(allTasks, baseDate);
    allTasks = computeCriticalPath(allTasks);
    
    const criticalCount = allTasks.filter(t => t.isCriticalPath).length;
    const totalHours = allTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const phaseCount = allTasks.filter(t => t.wbsLevel === 1).length;
    const milestoneCount = allTasks.filter(t => t.taskType === 'milestone').length;
    
    let projectDuration = 0;
    allTasks.forEach(task => {
      if (task.plannedEndDate) {
        const endDate = new Date(task.plannedEndDate);
        const days = Math.ceil((endDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > projectDuration) projectDuration = days;
      }
    });
    
    updateProgress(projectId, {
      phase: 'complete',
      step: 4,
      totalSteps: 4,
      message: 'WBS generation complete!',
      percentage: 100,
      details: `Created ${allTasks.length} tasks with ${criticalCount} critical path items`,
    });
    
    return {
      tasks: allTasks,
      summary: {
        totalTasks: allTasks.length,
        totalPhases: phaseCount,
        totalMilestones: milestoneCount,
        criticalPathDuration: projectDuration,
        estimatedTotalHours: totalHours,
        criticalPathTaskCount: criticalCount,
      },
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[WBS Parallel] Generation error:', error);
    updateProgress(projectId, {
      phase: 'error',
      step: 0,
      totalSteps: 4,
      message: 'Generation failed',
      percentage: 0,
      details: errorMessage,
    });
    throw error;
  }
}
