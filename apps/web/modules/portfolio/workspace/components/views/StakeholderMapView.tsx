import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Plus, ShieldAlert, Eye, Bell, Radio, Pencil, Trash2, MessageSquare } from "lucide-react";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { 
  ProjectData, 
  BusinessCaseData, 
  DemandReportData,
  StakeholderData,
  BusinessCaseStakeholder,
} from "../../types";

interface StakeholderMapViewProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  stakeholders: StakeholderData[];
  demandReport?: DemandReportData;
  onAddStakeholder?: () => void;
}

interface MappedStakeholder {
  id: string;
  name: string;
  role: string;
  influence: string;
  interest: string;
  engagement: string;
  type: string;
  email?: string;
  impact?: string;
  source: 'project' | 'demand_report' | 'business_case';
}

export function StakeholderMapView({
   
  project,
  businessCase,
  stakeholders,
  demandReport,
  onAddStakeholder,
}: StakeholderMapViewProps) {
  const bc = businessCase?.content || businessCase;
  const demandReportRecord = demandReport as Record<string, unknown> | undefined;
  const rawStakeholderAnalysis = (bc as Record<string, unknown>)?.stakeholderAnalysis;
  
  // stakeholderAnalysis can be a direct array or an object with stakeholders/keyStakeholders
  const bcStakeholders: BusinessCaseStakeholder[] = (() => {
    if (Array.isArray(rawStakeholderAnalysis)) return rawStakeholderAnalysis as BusinessCaseStakeholder[];
    const sa = rawStakeholderAnalysis as { stakeholders?: BusinessCaseStakeholder[]; keyStakeholders?: BusinessCaseStakeholder[] } | undefined;
    return sa?.stakeholders || sa?.keyStakeholders || bc?.stakeholders || bc?.keyStakeholders || [];
  })();

  const rawDemandStakeholders = demandReportRecord?.stakeholders ?? demandReportRecord?.keyStakeholders;
  const demandStakeholders: BusinessCaseStakeholder[] = (() => {
    if (Array.isArray(rawDemandStakeholders)) return rawDemandStakeholders;
    // Parse bullet-point string into stakeholder objects
    if (typeof rawDemandStakeholders === 'string' && rawDemandStakeholders.trim()) {
      return rawDemandStakeholders
        .split('\n')
        .map((line: string) => line.replace(/^[\s•\-*]+/, '').trim())
        .filter(Boolean)
        .map((line: string) => {
          const match = line.match(/^(.+?)\s*\((.+?)\)\s*$/);
          return {
            name: match ? match[1]!.trim() : line,
            role: match ? match[2]!.trim() : 'Stakeholder',
          } as BusinessCaseStakeholder;
        });
    }
    return [];
  })();
  const demandOwner = demandReport?.demandOwner;
  const demandContact = demandReport?.contactPerson;
  const governanceContacts = [
    project.sponsor
      ? {
          id: 'project-sponsor',
          name: project.sponsor,
          role: 'Project Sponsor',
          influence: 'high',
          interest: 'high',
          engagement: 'high',
          type: 'executive',
          source: 'project' as const,
        }
      : null,
    project.projectManager
      ? {
          id: 'project-manager',
          name: project.projectManager,
          role: 'Project Manager',
          influence: 'high',
          interest: 'high',
          engagement: 'high',
          type: 'internal',
          source: 'project' as const,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const allStakeholders: MappedStakeholder[] = [
    ...stakeholders.map(s => ({
      id: s.id,
      name: s.name,
      role: s.title || s.role || s.stakeholderType || '',
      influence: s.influenceLevel || 'medium',
      interest: s.interestLevel || 'medium',
      engagement: s.engagementLevel || 'medium',
      type: s.stakeholderType || 'internal',
      email: s.email,
      source: 'project' as const,
    })),
    ...governanceContacts,
    ...(demandOwner ? [{
      id: 'demand-owner',
      name: demandOwner,
      role: 'Demand Owner',
      influence: 'high',
      interest: 'high',
      engagement: 'high',
      type: 'internal',
      source: 'demand_report' as const,
    }] : []),
    ...(demandContact ? [{
      id: 'demand-contact',
      name: demandContact,
      role: 'Contact Person',
      influence: 'medium',
      interest: 'high',
      engagement: 'medium',
      type: 'internal',
      source: 'demand_report' as const,
    }] : []),
    ...demandStakeholders.map((s: BusinessCaseStakeholder, i: number) => ({
      id: `demand-${i}`,
      name: s.name || s.stakeholder || `Demand Stakeholder ${i + 1}`,
      role: s.role || s.title || 'Stakeholder',
      influence: s.influence || s.influenceLevel || 'medium',
      interest: s.interest || s.interestLevel || 'high',
      engagement: 'medium',
      type: s.type || 'internal',
      source: 'demand_report' as const,
    })),
    ...bcStakeholders.map((s: BusinessCaseStakeholder, i: number) => ({
      id: `bc-${i}`,
      name: s.name || s.stakeholder || `Stakeholder ${i + 1}`,
      role: s.role || s.title || s.type || 'Stakeholder',
      influence: s.influence || s.influenceLevel || 'medium',
      interest: s.interest || s.interestLevel || 'medium',
      engagement: 'medium',
      type: s.type || 'internal',
      impact: (s as Record<string, unknown>).impact as string | undefined,
      source: 'business_case' as const,
    })),
  ];
  const dedupedStakeholders = Array.from(
    new Map(allStakeholders.map((stakeholder) => {
      const key = `${stakeholder.name.toLowerCase()}::${stakeholder.role.toLowerCase()}`;
      return [key, stakeholder];
    })).values()
  );

  const quadrants = [
    { id: 'manage-closely', title: 'Manage Closely', subtitle: 'High Power · High Interest', icon: ShieldAlert, color: 'red' },
    { id: 'keep-satisfied', title: 'Keep Satisfied', subtitle: 'High Power · Low Interest', icon: Eye, color: 'amber' },
    { id: 'keep-informed', title: 'Keep Informed', subtitle: 'Low Power · High Interest', icon: Bell, color: 'blue' },
    { id: 'monitor', title: 'Monitor', subtitle: 'Low Power · Low Interest', icon: Radio, color: 'slate' },
  ];

  const getQuadrantStakeholders = (quadrantId: string) => {
    return dedupedStakeholders.filter(s => {
      if (hiddenIds.has(s.id)) return false;
      const highInfluence = s.influence?.toLowerCase() === 'high';
      const highInterest = s.interest?.toLowerCase() === 'high';
      if (quadrantId === 'manage-closely') return highInfluence && highInterest;
      if (quadrantId === 'keep-satisfied') return highInfluence && !highInterest;
      if (quadrantId === 'keep-informed') return !highInfluence && highInterest;
      return !highInfluence && !highInterest;
    });
  };

  const sourceStyle: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    project: { label: 'PRJ', dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300' },
    demand_report: { label: 'DMD', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300' },
    business_case: { label: 'BC', dot: 'bg-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300' },
  };
  const defaultSourceStyle = { label: 'PRJ', dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300' };

  const colorMap: Record<string, { bg: string; border: string; headerBg: string; dot: string; text: string; ring: string }> = {
    red:   { bg: 'bg-red-500/[0.03]', border: 'border-red-500/20', headerBg: 'bg-red-500/8', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/30' },
    amber: { bg: 'bg-amber-500/[0.03]', border: 'border-amber-500/20', headerBg: 'bg-amber-500/8', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/30' },
    blue:  { bg: 'bg-blue-500/[0.03]', border: 'border-blue-500/20', headerBg: 'bg-blue-500/8', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/30' },
    slate: { bg: 'bg-slate-500/[0.03]', border: 'border-slate-500/15', headerBg: 'bg-muted/50', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-400/30' },
  };
  const defaultColorStyle = { bg: 'bg-slate-500/[0.03]', border: 'border-slate-500/15', headerBg: 'bg-muted/50', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-400/30' };
  const getColorStyle = (color: string) => colorMap[color] ?? defaultColorStyle;
  const getSourceStyle = (source: string) => sourceStyle[source] ?? defaultSourceStyle;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleAddNote = useCallback((s: MappedStakeholder) => {
    const currentNote = notes[s.id] || '';
    const newNote = prompt(`Note for ${s.name}:`, currentNote);
    if (newNote !== null) {
      setNotes(prev => ({ ...prev, [s.id]: newNote }));
      toast({ title: newNote ? 'Note saved' : 'Note cleared', description: s.name });
    }
  }, [notes, toast]);

  const handleEdit = useCallback((s: MappedStakeholder) => {
    setExpandedId(prev => prev === s.id ? null : s.id);
  }, []);

  const handleRemove = useCallback((s: MappedStakeholder) => {
    if (!confirm(`Remove ${s.name} from the stakeholder map?`)) return;
    setHiddenIds(prev => new Set(prev).add(s.id));
    toast({ title: 'Stakeholder removed', description: `${s.name} hidden from map` });
  }, [toast]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-3">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight leading-none">Power–Interest Matrix</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{dedupedStakeholders.length} stakeholders · {quadrants.filter(q => getQuadrantStakeholders(q.id).length > 0).length} active quadrants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(sourceStyle).map(([key, s]) => {
            const count = dedupedStakeholders.filter(st => st.source === key).length;
            if (!count) return null;
            return (
              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="font-medium">{count}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            );
          })}
          {onAddStakeholder && (
            <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] ml-2 border-dashed" onClick={onAddStakeholder} data-testid="button-add-stakeholder-matrix">
              <Plus className="w-3 h-3" /> Add
            </Button>
          )}
        </div>
      </div>

      {/* ── 2×2 Quadrant Grid ── */}
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map((q) => {
          const QIcon = q.icon;
          const c = getColorStyle(q.color);
          const stakeholderList = getQuadrantStakeholders(q.id);
          return (
            <div key={q.id} className={`rounded-lg border ${c.border} ${c.bg} overflow-hidden`}>
              {/* Quadrant header */}
              <div className={`px-3 py-2 ${c.headerBg} flex items-center justify-between border-b ${c.border}`}>
                <div className="flex items-center gap-1.5">
                  <QIcon className={`w-3.5 h-3.5 ${c.text}`} />
                  <span className="text-xs font-semibold">{q.title}</span>
                  <span className="text-[9px] text-muted-foreground ml-1 hidden sm:inline">{q.subtitle}</span>
                </div>
                <span className={`text-[10px] font-bold ${c.text} tabular-nums`}>{stakeholderList.length}</span>
              </div>

              {/* Stakeholder rows */}
              <div className="divide-y divide-border/30">
                {stakeholderList.length > 0 ? stakeholderList.map((s) => {
                  const src = getSourceStyle(s.source);
                  const isExpanded = expandedId === s.id;
                  return (
                    <div key={s.id} className="group">
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-${q.color === 'slate' ? 'zinc' : q.color}-400 to-${q.color === 'slate' ? 'zinc' : q.color}-600 flex items-center justify-center text-[10px] font-bold text-white ring-1 ${c.ring} shrink-0`}>
                          {s.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        {/* Name + Role */}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate leading-none">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{s.role}</div>
                        </div>
                        {/* Source badge */}
                        <Badge variant="outline" className={`text-[8px] h-4 px-1 shrink-0 ${src.bg} ${src.text} border-transparent font-semibold`}>
                          {src.label}
                        </Badge>
                        {/* Action buttons (visible on hover) */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={(e) => { e.stopPropagation(); handleAddNote(s); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">{notes[s.id] ? 'Edit Note' : 'Add Note'}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={(e) => { e.stopPropagation(); handleRemove(s); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Remove</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <div className="px-3 pb-2.5 pt-0.5 ml-9">
                          <div className="rounded-md bg-muted/30 border border-border/30 px-3 py-2 space-y-1.5">
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div><span className="text-muted-foreground">Influence:</span> <span className="font-medium capitalize">{s.influence}</span></div>
                              <div><span className="text-muted-foreground">Interest:</span> <span className="font-medium capitalize">{s.interest}</span></div>
                              <div><span className="text-muted-foreground">Source:</span> <span className="font-medium">{s.source.replace('_', ' ')}</span></div>
                            </div>
                            {s.impact && (
                              <div className="text-[10px]">
                                <span className="text-muted-foreground">Impact:</span>{' '}
                                <span className="text-foreground/80">{s.impact}</span>
                              </div>
                            )}
                            {s.email && <div className="text-[10px] text-muted-foreground">{s.email}</div>}
                            {notes[s.id] && (
                              <div className="text-[10px] mt-1 pt-1 border-t border-border/20">
                                <span className="text-muted-foreground">Note:</span>{' '}
                                <span className="text-foreground/80 italic">{notes[s.id]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="flex items-center justify-center py-6 text-muted-foreground/40">
                    <span className="text-[10px]">No stakeholders</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Engagement strategy (compact) ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { title: 'Manage Closely', freq: 'Weekly', color: 'red', icon: ShieldAlert },
          { title: 'Keep Satisfied', freq: 'Bi-weekly', color: 'amber', icon: Eye },
          { title: 'Keep Informed', freq: 'Monthly', color: 'blue', icon: Bell },
          { title: 'Monitor', freq: 'Quarterly', color: 'slate', icon: Radio },
        ].map(s => {
          const SIcon = s.icon;
          const cm = getColorStyle(s.color);
          return (
            <div key={s.title} className={`rounded-lg border ${cm.border} ${cm.bg} px-3 py-2`}>
              <div className="flex items-center gap-1.5 mb-1">
                <SIcon className={`w-3 h-3 ${cm.text}`} />
                <span className={`text-[10px] font-semibold ${cm.text}`}>{s.title}</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <div className={`w-1 h-1 rounded-full ${cm.dot}`} />
                {s.freq} check-ins
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </TooltipProvider>
  );
}
