import {
  ArrowRight,
  CheckCircle2,
  Flame,
  History,
  Link2,
  Loader2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { RiskData, WbsTaskData } from '../../../types';
import { RiskEvidenceSection } from './TaskExecutionPanels';

type RiskDetailSheetProps = {
  risk: RiskData | null;
  tasks: WbsTaskData[];
  isUpdating: boolean;
  getRiskColor: (level: string) => string;
  onClose: () => void;
  onRiskChange: (risk: RiskData) => void;
  onUpdateRisk: (id: string, updates: Partial<RiskData>) => void;
};

type AssessmentHistoryEntry = {
  date: string;
  probability: string;
  impact: string;
  notes?: string;
};

const PROBABILITY_SCORES: Record<string, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

const IMPACT_SCORES: Record<string, number> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  severe: 5,
};

const NEXT_STATUS_BY_STATUS: Record<string, string> = {
  identified: 'analyzing',
  analyzing: 'mitigating',
  mitigating: 'monitoring',
  monitoring: 'closed',
};

function getStatusProgress(status?: string): number {
  if (status === 'closed' || status === 'resolved') return 100;
  if (status === 'monitoring') return 80;
  if (status === 'mitigating') return 50;
  if (status === 'analyzing') return 20;
  return 0;
}

export function RiskDetailSheet({
  risk,
  tasks,
  isUpdating,
  getRiskColor,
  onClose,
  onRiskChange,
  onUpdateRisk,
}: RiskDetailSheetProps) {
  const updateRisk = (updates: Partial<RiskData>) => {
    if (!risk) return;
    onUpdateRisk(risk.id, updates);
    onRiskChange({ ...risk, ...updates });
  };

  const assessmentHistory = (risk?.assessmentHistory || []) as AssessmentHistoryEntry[];

  return (
    <Sheet open={!!risk} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {risk && (() => {
          const isImportedPlanningRisk = risk.id.startsWith('planning-approved:');
          const effectiveness = risk.residualRiskScore && risk.riskScore
            ? Math.round(((risk.riskScore - risk.residualRiskScore) / risk.riskScore) * 100)
            : null;
          const nextStatus = NEXT_STATUS_BY_STATUS[risk.status];
          const linkedTaskData = tasks.filter((task) =>
            (risk.linkedTasks || []).some((linked) => linked === task.id || linked === task.wbsCode || linked === task.taskCode) ||
            task.description?.toLowerCase().includes(risk.title?.toLowerCase() || '') ||
            task.taskName?.toLowerCase().includes(risk.category?.toLowerCase() || '')
          ).slice(0, 6);
          const statusProgress = getStatusProgress(risk.status);

          return (
            <div className="space-y-6 py-4">
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">{risk.riskCode}</Badge>
                  <Badge className={`${getRiskColor(risk.riskLevel || '')} text-white`}>{risk.riskLevel}</Badge>
                  <Badge className={`${
                    risk.status === 'closed' || risk.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                    risk.status === 'mitigating' ? 'bg-amber-500/20 text-amber-400' :
                    risk.status === 'monitoring' ? 'bg-indigo-500/20 text-indigo-400' :
                    risk.status === 'materialized' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>{risk.status}</Badge>
                </div>
                <SheetTitle className="text-lg mt-2">{risk.title}</SheetTitle>
                <SheetDescription>{risk.description || 'No description provided'}</SheetDescription>
              </SheetHeader>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mitigation Progress</span>
                  <span className="font-medium">{statusProgress}%</span>
                </div>
                <Progress value={statusProgress} className="h-2" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Identified</span>
                  <span>Analyzing</span>
                  <span>Mitigating</span>
                  <span>Monitoring</span>
                  <span>Closed</span>
                </div>
              </div>

              {nextStatus && risk.status !== 'materialized' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => updateRisk({ status: nextStatus })}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Advance to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                </Button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground mb-1">Pre-Mitigation</div>
                  <div className="text-lg font-bold">{risk.riskScore || 0}</div>
                  <div className="text-[10px] text-muted-foreground">{risk.probability} / {risk.impact}</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground mb-1">Post-Mitigation</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold">{risk.residualRiskScore || '--'}</div>
                    {effectiveness !== null && (
                      <Badge className={`text-[10px] ${effectiveness >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {effectiveness >= 0 ? '-' : '+'}{Math.abs(effectiveness)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {risk.residualProbability || '--'} / {risk.residualImpact || '--'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Risk Owner</Label>
                <Input
                  key={`owner-${risk.id}`}
                  defaultValue={risk.riskOwner || ''}
                  placeholder="Assign owner"
                  disabled={isImportedPlanningRisk}
                  onBlur={(event) => {
                    if (event.target.value !== (risk.riskOwner || '')) {
                      updateRisk({ riskOwner: event.target.value });
                    }
                  }}
                />
                {isImportedPlanningRisk && (
                  <p className="text-[11px] text-muted-foreground">Imported from approved Planning register snapshot. Update owner in Planning Risk Register, then re-approve to sync here.</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Response Strategy</Label>
                <Select
                  value={risk.responseStrategy || ''}
                  onValueChange={(value) => updateRisk({ responseStrategy: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avoid">Avoid - Eliminate the threat</SelectItem>
                    <SelectItem value="transfer">Transfer - Shift to third party</SelectItem>
                    <SelectItem value="mitigate">Mitigate - Reduce probability/impact</SelectItem>
                    <SelectItem value="accept">Accept - Acknowledge and monitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Mitigation Plan</Label>
                <Textarea
                  key={`mitigation-${risk.id}`}
                  defaultValue={risk.mitigationPlan || ''}
                  placeholder="Describe the mitigation actions to reduce this risk..."
                  className="h-24"
                  onBlur={(event) => {
                    if (event.target.value !== (risk.mitigationPlan || '')) {
                      updateRisk({ mitigationPlan: event.target.value });
                    }
                  }}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Contingency Plan</Label>
                <Textarea
                  key={`contingency-${risk.id}`}
                  defaultValue={risk.contingencyPlan || ''}
                  placeholder="Fallback plan if the risk materializes..."
                  className="h-20"
                  onBlur={(event) => {
                    if (event.target.value !== (risk.contingencyPlan || '')) {
                      updateRisk({ contingencyPlan: event.target.value });
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Residual Probability</Label>
                  <Select
                    value={risk.residualProbability || ''}
                    onValueChange={(value) => {
                      const residualImpact = risk.residualImpact || risk.impact;
                      const residualRiskScore = (PROBABILITY_SCORES[value] || 3) * (IMPACT_SCORES[residualImpact] || 3);
                      updateRisk({ residualProbability: value, residualRiskScore });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['very_low', 'low', 'medium', 'high', 'very_high'].map((value) => (
                        <SelectItem key={value} value={value}>{value.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Residual Impact</Label>
                  <Select
                    value={risk.residualImpact || ''}
                    onValueChange={(value) => {
                      const residualProbability = risk.residualProbability || risk.probability;
                      const residualRiskScore = (PROBABILITY_SCORES[residualProbability] || 3) * (IMPACT_SCORES[value] || 3);
                      updateRisk({ residualImpact: value, residualRiskScore });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['negligible', 'minor', 'moderate', 'major', 'severe'].map((value) => (
                        <SelectItem key={value} value={value}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Target Resolution</Label>
                  <Input
                    type="date"
                    defaultValue={risk.targetResolutionDate || ''}
                    onBlur={(event) => {
                      if (event.target.value !== (risk.targetResolutionDate || '')) {
                        updateRisk({ targetResolutionDate: event.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Category</Label>
                  <div className="p-2 bg-muted/40 rounded border border-border text-sm capitalize">{risk.category}</div>
                </div>
              </div>

              <RiskEvidenceSection riskId={risk.id} projectId={risk.projectId || ''} riskTitle={risk.title} />

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Work Management Links
                </Label>

                {linkedTaskData.length > 0 ? (
                  <div className="space-y-1.5">
                    {linkedTaskData.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border/50">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{task.wbsCode}</Badge>
                          <span className="text-xs truncate max-w-[200px]">{task.taskName}</span>
                        </div>
                        <Badge className={`text-[10px] ${
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          task.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>{task.status?.replace(/_/g, ' ') || 'pending'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(risk.linkedTasks) && risk.linkedTasks.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Linked planning references are present, but no matching execution tasks are visible right now.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {risk.linkedTasks.slice(0, 8).map((ref, index) => (
                        <Badge key={`${ref}-${index}`} variant="outline" className="text-[10px] font-mono">{ref}</Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    No work-management links are mapped for this risk yet.
                  </div>
                )}
              </div>

              {risk.status !== 'closed' && risk.status !== 'resolved' && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  {risk.status !== 'materialized' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      onClick={() => updateRisk({ status: 'materialized' })}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      Mark Materialized
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => updateRisk({ status: 'closed' })}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Close Risk
                  </Button>
                </div>
              )}

              {assessmentHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Assessment History
                  </Label>
                  <div className="space-y-1.5">
                    {assessmentHistory.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-muted/30 rounded text-xs">
                        <span className="text-muted-foreground shrink-0">{new Date(entry.date).toLocaleDateString()}</span>
                        <Badge variant="outline" className="text-[10px]">{entry.probability}</Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="text-[10px]">{entry.impact}</Badge>
                        {entry.notes && <span className="text-muted-foreground truncate">{entry.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
