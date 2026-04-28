import { useState } from 'react';
import { 
  Plus, AlertTriangle, CheckCircle2, FileText,
  Sparkles, Shield, Layers, Trash2, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectData, BusinessCaseData, ManagementSummary, AssumptionItem, ConstraintItem, AssumptionData, ConstraintData } from '../../types';

interface AssumptionsConstraintsLogProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  management?: ManagementSummary;
  onAddAssumption: () => void;
  onAddConstraint: () => void;
  onEditAssumption: (assumption: AssumptionData) => void;
  onEditConstraint: (constraint: ConstraintData) => void;
  onDeleteAssumption: (id: string) => void;
  onDeleteConstraint: (id: string) => void;
}

interface AssumptionRow {
  id: string;
  description: string;
  category: string;
  status: string;
  validatedDate: string | null;
  source: 'business_case' | 'project' | 'default';
  canDelete: boolean;
  raw?: AssumptionData;
}

interface ConstraintRow {
  id: string;
  description: string;
  category: string;
  impact: string;
  mitigated: boolean;
  source: 'business_case' | 'project' | 'default';
  canDelete: boolean;
  raw?: ConstraintData;
}

export function AssumptionsConstraintsLog({
  project: _project,
  businessCase,
  management,
  onAddAssumption,
  onAddConstraint,
  onEditAssumption,
  onEditConstraint,
  onDeleteAssumption,
  onDeleteConstraint,
}: AssumptionsConstraintsLogProps) {
  const [activeTab, setActiveTab] = useState<'assumptions' | 'constraints'>('assumptions');

  // Safely extract data with defensive checks
  const bcAssumptionsRaw = businessCase?.assumptions || 
                        businessCase?.projectAssumptions || 
                        businessCase?.content?.assumptions ||
                        businessCase?.keyAssumptions;
  const bcAssumptions = Array.isArray(bcAssumptionsRaw) ? bcAssumptionsRaw : [];

  const bcConstraintsRaw = businessCase?.constraints || 
                        businessCase?.projectConstraints ||
                        businessCase?.content?.constraints ||
                        businessCase?.keyConstraints;
  const bcConstraints = Array.isArray(bcConstraintsRaw) ? bcConstraintsRaw : [];
  
  const projectAssumptions = Array.isArray(management?.assumptions) ? management.assumptions : [];
  const projectConstraints = Array.isArray(management?.constraints) ? management.constraints : [];

  // Transform with safe null checks
  const transformedAssumptions: AssumptionRow[] = bcAssumptions.map((a: AssumptionItem, i: number) => {
    try {
      const aObj = typeof a === 'string' ? {} : (a || {});
      return {
        id: `bc-${i}`,
        description: typeof a === 'string' ? a : (aObj.assumption || aObj.description || aObj.name || String(a)),
        category: aObj.category || 'General',
        status: String(aObj.status || 'pending'),
        validatedDate: null,
        source: 'business_case' as const,
        canDelete: false,
      };
    } catch {
      return {
        id: `bc-${i}`,
        description: 'Unknown assumption',
        category: 'General',
        status: 'pending',
        validatedDate: null,
        source: 'business_case' as const,
        canDelete: false,
      };
    }
  });
  
  const transformedProjectAssumptions: AssumptionRow[] = projectAssumptions.map((a: AssumptionData) => {
    try {
      return {
        id: a?.id || `proj-${Math.random()}`,
        description: a?.description || a?.name || 'Unknown',
        category: a?.category || 'General',
        status: a?.status || 'pending',
        validatedDate: a?.validatedDate || null,
        source: 'project' as const,
        canDelete: true,
        raw: a,
      };
    } catch {
      return {
        id: `proj-${Math.random()}`,
        description: 'Unknown assumption',
        category: 'General',
        status: 'pending',
        validatedDate: null,
        source: 'project' as const,
        canDelete: true,
      };
    }
  });

  const transformedConstraints: ConstraintRow[] = bcConstraints.map((c: ConstraintItem, i: number) => {
    try {
      const cObj = typeof c === 'string' ? {} : (c || {});
      return {
        id: `bc-${i}`,
        description: typeof c === 'string' ? c : (cObj.constraint || cObj.description || cObj.name || String(c)),
        category: cObj.type || cObj.constraintType || 'General',
        impact: String(cObj.impact || cObj.severity || 'medium'),
        mitigated: false,
        source: 'business_case' as const,
        canDelete: false,
      };
    } catch {
      return {
        id: `bc-${i}`,
        description: 'Unknown constraint',
        category: 'General',
        impact: 'medium',
        mitigated: false,
        source: 'business_case' as const,
        canDelete: false,
      };
    }
  });
  
  const transformedProjectConstraints: ConstraintRow[] = projectConstraints.map((c: ConstraintData) => {
    try {
      return {
        id: c?.id || `proj-${Math.random()}`,
        description: c?.description || c?.name || 'Unknown',
        category: c?.category || 'General',
        impact: c?.impact || 'medium',
        mitigated: c?.mitigated || false,
        source: 'project' as const,
        canDelete: true,
        raw: c,
      };
    } catch {
      return {
        id: `proj-${Math.random()}`,
        description: 'Unknown constraint',
        category: 'General',
        impact: 'medium',
        mitigated: false,
        source: 'project' as const,
        canDelete: true,
      };
    }
  });

  const hasAnyAssumptions = bcAssumptions.length > 0 || projectAssumptions.length > 0;
  const defaultAssumptions: AssumptionRow[] = !hasAnyAssumptions ? [
    { id: 'def-1', description: 'Stakeholders will be available for scheduled meetings', category: 'Resource', status: 'pending', validatedDate: null, source: 'default' as const, canDelete: false },
    { id: 'def-2', description: 'Existing infrastructure can support the new system', category: 'Technical', status: 'pending', validatedDate: null, source: 'default' as const, canDelete: false },
    { id: 'def-3', description: 'Budget will remain unchanged throughout the project', category: 'Financial', status: 'pending', validatedDate: null, source: 'default' as const, canDelete: false },
    { id: 'def-4', description: 'Regulatory requirements will not change significantly', category: 'Compliance', status: 'pending', validatedDate: null, source: 'default' as const, canDelete: false },
  ] : [];

  const hasAnyConstraints = bcConstraints.length > 0 || projectConstraints.length > 0;
  const defaultConstraints: ConstraintRow[] = !hasAnyConstraints ? [
    { id: 'def-1', description: 'Project must be completed within approved timeline', category: 'Timeline', impact: 'high', mitigated: false, source: 'default' as const, canDelete: false },
    { id: 'def-2', description: 'Budget cannot exceed approved amount', category: 'Financial', impact: 'critical', mitigated: false, source: 'default' as const, canDelete: false },
    { id: 'def-3', description: 'Must comply with UAE data residency requirements', category: 'Regulatory', impact: 'critical', mitigated: false, source: 'default' as const, canDelete: false },
    { id: 'def-4', description: 'Limited availability of specialized resources', category: 'Resource', impact: 'medium', mitigated: false, source: 'default' as const, canDelete: false },
  ] : [];

  const allAssumptions: AssumptionRow[] = [...transformedProjectAssumptions, ...transformedAssumptions, ...defaultAssumptions];
  const allConstraints: ConstraintRow[] = [...transformedProjectConstraints, ...transformedConstraints, ...defaultConstraints];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid': return <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Valid</Badge>;
      case 'invalid': return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">Invalid</Badge>;
      case 'monitoring': return <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">Monitoring</Badge>;
      default: return <Badge className="bg-muted/50 text-muted-foreground border-border/30">Pending</Badge>;
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'critical': return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">Critical</Badge>;
      case 'high': return <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30">High</Badge>;
      case 'medium': return <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">Medium</Badge>;
      default: return <Badge className="bg-muted/50 text-muted-foreground border-border/30">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Assumptions & Constraints</h3>
            <p className="text-xs text-muted-foreground">Track & validate</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="text-center px-2 py-1 rounded bg-muted/50">
            <div className="text-sm font-bold text-pink-400">{allAssumptions.length}</div>
            <div className="text-[10px] text-muted-foreground">Assumptions</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-muted/50">
            <div className="text-sm font-bold text-rose-400">{allConstraints.length}</div>
            <div className="text-[10px] text-muted-foreground">Constraints</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-0.5 bg-muted/40 rounded-md w-fit">
        <button
          onClick={() => setActiveTab('assumptions')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'assumptions'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="button-tab-assumptions"
        >
          <Sparkles className="w-3 h-3" />
          Assumptions
        </button>
        <button
          onClick={() => setActiveTab('constraints')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'constraints'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="button-tab-constraints"
        >
          <Shield className="w-3 h-3" />
          Constraints
        </button>
      </div>

      {activeTab === 'assumptions' && (
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" />
                Project Assumptions
              </CardTitle>
              {transformedAssumptions.length > 0 && (
                <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-2.5 h-2.5 mr-1" />
                  {transformedAssumptions.length} from BC
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={onAddAssumption} data-testid="button-add-assumption">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allAssumptions.map((assumption) => (
                <div key={assumption.id} className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex-1">
                    <div className="text-sm">{assumption.description}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{assumption.category}</Badge>
                      {assumption.validatedDate && (
                        <span className="text-xs text-muted-foreground/70">Validated: {assumption.validatedDate}</span>
                      )}
                      {assumption.source === 'business_case' && (
                        <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">BC</Badge>
                      )}
                      {assumption.source === 'project' && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Project</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(assumption.status)}
                    {assumption.canDelete && (
                      <>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onEditAssumption((
                            assumption.raw || {
                              id: assumption.id,
                              description: assumption.description,
                              category: assumption.category,
                              status: assumption.status,
                              validatedDate: assumption.validatedDate,
                            }
                          ) as AssumptionData)}
                          data-testid={`button-edit-assumption-${assumption.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteAssumption(assumption.id)}
                          data-testid={`button-delete-assumption-${assumption.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'constraints' && (
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" />
                Project Constraints
              </CardTitle>
              {transformedConstraints.length > 0 && (
                <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-2.5 h-2.5 mr-1" />
                  {transformedConstraints.length} from BC
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={onAddConstraint} data-testid="button-add-constraint">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allConstraints.map((constraint) => (
                <div key={constraint.id} className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {constraint.mitigated ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                      <div className="text-sm">{constraint.description}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{constraint.category}</Badge>
                      {constraint.mitigated && (
                        <Badge className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Mitigated</Badge>
                      )}
                      {constraint.source === 'business_case' && (
                        <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">BC</Badge>
                      )}
                      {constraint.source === 'project' && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Project</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getImpactBadge(constraint.impact)}
                    {constraint.canDelete && (
                      <>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onEditConstraint(
                            constraint.raw || {
                              id: constraint.id,
                              description: constraint.description,
                              category: constraint.category,
                              impact: constraint.impact,
                              mitigated: constraint.mitigated,
                            }
                          )}
                          data-testid={`button-edit-constraint-${constraint.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteConstraint(constraint.id)}
                          data-testid={`button-delete-constraint-${constraint.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
