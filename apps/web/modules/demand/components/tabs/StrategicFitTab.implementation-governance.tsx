import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Flag,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {
  ApprovalGate,
  GovernanceRequirements,
  ImplementationApproach,
  ImplementationMilestone,
  ImplementationPhase,
  NextStep,
  ResourceRequirements,
} from "./StrategicFitTab.types";

interface StrategicFitImplementationGovernanceProps {
  implementationApproach: ImplementationApproach;
  implementationMilestones?: ImplementationMilestone[];
  nextSteps: NextStep[];
  completedSteps: number;
  totalSteps: number;
  governanceRequirements?: GovernanceRequirements;
  resourceRequirements?: ResourceRequirements;
}

export function StrategicFitImplementationGovernance({
  implementationApproach,
  implementationMilestones,
  nextSteps,
  completedSteps,
  totalSteps,
  governanceRequirements,
  resourceRequirements,
}: StrategicFitImplementationGovernanceProps) {
  return (
    <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Implementation & Governance</h3>
              <p className="text-sm text-muted-foreground">Phased delivery with approval gates</p>
            </div>
          </div>
          {nextSteps.length > 0 && (
            <Badge variant="outline" className="text-xs">{completedSteps}/{totalSteps} steps</Badge>
          )}
        </div>

        {/* Implementation Phases — full width */}
        <div className="space-y-4 mb-6">
          {Object.entries(implementationApproach as Record<string, ImplementationPhase | undefined>)
            .filter(([key]) => key.startsWith('phase'))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([phaseKey, phaseData], idx) => {
              if (!phaseData || typeof phaseData !== 'object') return null;
              const colors = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600'];
              const lightBgs = ['bg-blue-50 dark:bg-blue-950/20', 'bg-purple-50 dark:bg-purple-950/20', 'bg-emerald-50 dark:bg-emerald-950/20', 'bg-amber-50 dark:bg-amber-950/20'];
              const textColors = ['text-blue-700 dark:text-blue-300', 'text-purple-700 dark:text-purple-300', 'text-emerald-700 dark:text-emerald-300', 'text-amber-700 dark:text-amber-300'];
              return (
                <div key={phaseKey} className={`p-4 rounded-lg border border-slate-200 dark:border-slate-700 ${lightBgs[idx % 4]}`}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className={`h-6 w-6 rounded-full ${colors[idx % 4]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-bold text-white">{idx + 1}</span>
                    </div>
                    <span className={`text-sm font-semibold ${textColors[idx % 4]}`}>{phaseData.name || `Phase ${idx + 1}`}</span>
                    {phaseData.duration && (
                      <Badge variant="outline" className="text-xs ml-auto"><Clock className="h-3 w-3 mr-1" />{phaseData.duration}</Badge>
                    )}
                  </div>
                  {phaseData.owner && (
                    <p className="text-xs text-muted-foreground ml-8 mb-2">Owner: {phaseData.owner}</p>
                  )}
                  {phaseData.keyActivities && phaseData.keyActivities.length > 0 && (
                    <div className="space-y-1.5 mt-2 ml-8">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Activities</p>
                      {phaseData.keyActivities.map((activity: string, activityIndex: number) => (
                        <p key={activityIndex} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className={`h-3 w-3 mt-0.5 flex-shrink-0 ${textColors[idx % 4]}`} />
                          <span>{activity}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {phaseData.deliverables && phaseData.deliverables.length > 0 && (
                    <div className="mt-3 ml-8">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Deliverables</p>
                      <div className="space-y-1">
                        {phaseData.deliverables.map((deliverable: string, deliverableIndex: number) => (
                          <p key={deliverableIndex} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mt-1 flex-shrink-0 ${colors[idx % 4]}`} />
                            <span>{deliverable}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Critical Milestones */}
        {implementationMilestones && implementationMilestones.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-amber-600" />
              Critical Milestones
            </p>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-3 bottom-3 w-px bg-amber-300 dark:bg-amber-700" />
              <div className="space-y-3">
                {implementationMilestones.map((milestone, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    <div className="h-[18px] w-[18px] rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 z-10 mt-0.5">
                      <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{milestone.name}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {new Date(milestone.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Governance & Resources — side by side */}
        <div className="grid lg:grid-cols-2 gap-6">
          {governanceRequirements && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                Governance
              </p>
              {governanceRequirements.approvalAuthority && (
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Authority</span>
                  <span className="font-semibold">{governanceRequirements.approvalAuthority}</span>
                </div>
              )}
              {governanceRequirements.reportingCadence && (
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Reporting</span>
                  <span className="font-semibold">{governanceRequirements.reportingCadence}</span>
                </div>
              )}
              {governanceRequirements.approvalGates && governanceRequirements.approvalGates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  {governanceRequirements.approvalGates.map((gate: ApprovalGate, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs mb-2">
                      <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-purple-700">{idx + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground font-medium leading-4">{gate.name || gate.checkpoint}</p>
                        {gate.timing && (
                          <p className="text-muted-foreground leading-4 mt-0.5">{gate.timing}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {resourceRequirements && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                Resources
              </p>
              {resourceRequirements.internalTeam?.roles && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {resourceRequirements.internalTeam.roles.map((role: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">{role}</Badge>
                  ))}
                </div>
              )}
              {resourceRequirements.externalSupport?.estimatedCost && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" />External: {resourceRequirements.externalSupport.estimatedCost}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}