import { 
  Plus, GitBranch, AlertTriangle as _AlertTriangle, Settings, Users,
  ArrowUpRight, Link as LinkIcon, Layers, Trash2, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectData, BusinessCaseData, ManagementSummary, DependencyItem, DependencyData } from '../../types';

interface DependenciesMapperProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  management?: ManagementSummary;
  onAddDependency: () => void;
  onEditDependency: (dep: DependencyData) => void;
  onDeleteDependency: (id: string) => void;
}

export function DependenciesMapper({
   
  project: _project,
  businessCase,
  management,
  onAddDependency,
  onEditDependency,
  onDeleteDependency,
}: DependenciesMapperProps) {
  const bcDependencies = businessCase?.dependencies || 
                          businessCase?.projectDependencies || 
                          businessCase?.content?.dependencies ||
                          businessCase?.implementationPlan?.dependencies || [];
  
  const projectDependencies = management?.dependencies || [];

  const dependencyTypes = [
    { type: 'Internal', icon: LinkIcon, color: 'blue', description: 'Dependencies within the organization' },
    { type: 'External', icon: ArrowUpRight, color: 'purple', description: 'Dependencies on external parties' },
    { type: 'Technical', icon: Settings, color: 'emerald', description: 'System and technology dependencies' },
    { type: 'Resource', icon: Users, color: 'amber', description: 'People and skill dependencies' },
  ];

  const categorizeDep = (dep: DependencyItem): string => {
    if (typeof dep === 'string') return 'Internal';
    const depText = (dep.name || dep.dependency || dep.type || '').toLowerCase();
    if (depText.includes('external') || depText.includes('vendor') || depText.includes('contract')) return 'External';
    if (depText.includes('technical') || depText.includes('system') || depText.includes('infrastructure')) return 'Technical';
    if (depText.includes('resource') || depText.includes('staff') || depText.includes('training')) return 'Resource';
    return 'Internal';
  };

  const transformedBcDeps = bcDependencies.map((dep: DependencyItem, i: number) => {
    const getName = () => {
      if (typeof dep === 'string') return dep;
      if (dep.name) return dep.name;
      if (dep.dependency) return dep.dependency;
      if (dep.title) return dep.title;
      if (dep.task) return dep.task;
      if (dep.description) return dep.description;
      return `Dependency ${i + 1}`;
    };
    const depObj = typeof dep === 'string' ? {} : dep;
    return {
      id: `bc-${i}`,
      name: getName(),
      type: depObj.type || categorizeDep(dep),
      status: depObj.status || 'pending',
      owner: depObj.owner || depObj.responsible || 'TBD',
      dueDate: depObj.dueDate || depObj.targetDate || 'TBD',
      source: 'business_case' as const,
      canDelete: false,
    };
  });

  const transformedProjectDeps = projectDependencies.map((dep: DependencyData) => ({
    id: dep.id,
    name: dep.name || dep.title,
    type: dep.type || 'Internal',
    status: dep.status || 'pending',
    owner: dep.owner || 'TBD',
    dueDate: dep.dueDate || 'TBD',
    source: 'project' as const,
    canDelete: true,
  }));

  const hasAnyDependencies = bcDependencies.length > 0 || projectDependencies.length > 0;
  const defaultDependencies = !hasAnyDependencies ? [
    { id: 'def-1', name: 'IT Infrastructure Readiness', type: 'Technical', status: 'pending', owner: 'IT Dept', dueDate: 'TBD', source: 'default' as const, canDelete: false },
    { id: 'def-2', name: 'Vendor Selection & Contracts', type: 'External', status: 'pending', owner: 'Procurement', dueDate: 'TBD', source: 'default' as const, canDelete: false },
    { id: 'def-3', name: 'Security Clearances', type: 'Internal', status: 'pending', owner: 'Security', dueDate: 'TBD', source: 'default' as const, canDelete: false },
    { id: 'def-4', name: 'Staff Training Requirements', type: 'Resource', status: 'pending', owner: 'HR', dueDate: 'TBD', source: 'default' as const, canDelete: false },
  ] : [];

  const allDependencies = [...transformedProjectDeps, ...transformedBcDeps, ...defaultDependencies];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'on_track': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'at_risk': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'blocked': return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
      default: return 'bg-muted/50 text-muted-foreground border-border/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <LinkIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Dependencies Mapper</h3>
            <p className="text-xs text-muted-foreground">Track dependencies</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={onAddDependency} data-testid="button-add-dependency">
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dependencyTypes.map((dt) => (
          <Card key={dt.type} className="bg-card/60 border-border hover:border-border cursor-pointer transition-all">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${dt.color}-500/20 flex items-center justify-center`}>
                  <dt.icon className={`w-5 h-5 text-${dt.color}-400`} />
                </div>
                <div>
                  <div className="font-medium text-sm">{dt.type}</div>
                  <div className="text-xs text-muted-foreground/70">{dt.description}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-violet-400" />
              Project Dependencies
            </CardTitle>
            {transformedBcDeps.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                <Layers className="w-2.5 h-2.5 mr-1" />
                {transformedBcDeps.length} from Business Case
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allDependencies.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${
                    dep.status === 'completed' ? 'bg-emerald-500' :
                    dep.status === 'on_track' ? 'bg-blue-500' :
                    dep.status === 'at_risk' ? 'bg-amber-500' :
                    'bg-muted-foreground/60'
                  }`} />
                  <div>
                    <div className="font-medium text-sm">{dep.name}</div>
                    <div className="text-xs text-muted-foreground">Owner: {dep.owner}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{dep.type}</Badge>
                  <Badge className={`text-xs ${getStatusColor(dep.status)}`}>
                    {dep.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground/70">{dep.dueDate}</span>
                  {dep.source === 'business_case' && (
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">BC</Badge>
                  )}
                  {dep.source === 'project' && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Project</Badge>
                  )}
                  {dep.canDelete && (
                    <>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => onEditDependency(dep)}
                        data-testid={`button-edit-dependency-${dep.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteDependency(dep.id)}
                        data-testid={`button-delete-dependency-${dep.id}`}
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
    </div>
  );
}
