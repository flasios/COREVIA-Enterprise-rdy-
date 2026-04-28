import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  Shield,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import type { ProjectData, ManagementSummary, DependencyData, AssumptionData, ConstraintData, BusinessCaseData } from '../../../types';
import { RiskRegisterInit } from '../../panels/RiskRegisterInit';
import { DependenciesMapper } from '../../panels/DependenciesMapper';
import { AssumptionsConstraintsLog } from '../../panels/AssumptionsConstraintsLog';
import { useDemandReport } from '../../../utils/useDemandReport';

interface RiskConstraintsTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  management?: ManagementSummary;
  onAddRisk: () => void;
  onAddDependency: () => void;
  onAddAssumption: () => void;
  onAddConstraint: () => void;
  onEditDependency: (dep: DependencyData) => void;
  onEditAssumption: (assumption: AssumptionData) => void;
  onEditConstraint: (constraint: ConstraintData) => void;
  onDeleteDependency: (id: string) => void;
  onDeleteAssumption: (id: string) => void;
  onDeleteConstraint: (id: string) => void;
}

interface ProjectDetailsCache {
  data?: {
    project?: {
      metadata?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function RiskConstraintsTab({
  project,
  businessCase,
  management,
  onAddRisk,
  onAddDependency,
  onAddAssumption,
  onAddConstraint,
  onEditDependency,
  onEditAssumption,
  onEditConstraint,
  onDeleteDependency,
  onDeleteAssumption,
  onDeleteConstraint,
}: RiskConstraintsTabProps) {
  const [activeSection, setActiveSection] = useState<'risks' | 'dependencies' | 'assumptions'>('risks');
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: demandReport } = useDemandReport(
    (project as unknown as { demandReportId?: string }).demandReportId ?? null,
  );
  
  const _initializedRef = useRef(false);
  const lastProjectIdRef = useRef<string | null>(null);
  
  const [isAcknowledged, setIsAcknowledged] = useState(() => {
    const metadata = project.metadata as Record<string, unknown> | undefined;
    return Boolean(metadata?.risksAcknowledged);
  });

  useEffect(() => {
    if (lastProjectIdRef.current !== project.id) {
      lastProjectIdRef.current = project.id;
      const metadata = project.metadata as Record<string, unknown> | undefined;
      setIsAcknowledged(Boolean(metadata?.risksAcknowledged));
    }
  }, [project.id, project.metadata]);

  const saveAcknowledgedMutation = useMutation({
    mutationFn: async (acknowledged: boolean) => {
      const currentMetadata = (project.metadata as Record<string, unknown>) || {};
      const updatedMetadata = { ...currentMetadata, risksAcknowledged: acknowledged };
      return apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, { metadata: updatedMetadata });
    },
    onMutate: async (acknowledged: boolean) => {
      await queryClient.cancelQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      const previousData = queryClient.getQueryData(['/api/portfolio/projects', project.id]);
      
      queryClient.setQueryData(['/api/portfolio/projects', project.id], (old: ProjectDetailsCache | undefined) => {
        if (!old?.data?.project) return old;
        const currentMetadata = (old.data.project.metadata as Record<string, unknown>) || {};
        return { 
          ...old, 
          data: { 
            ...old.data, 
            project: { 
              ...old.data.project, 
              metadata: { ...currentMetadata, risksAcknowledged: acknowledged } 
            } 
          } 
        };
      });
      
      return { previousData };
    },
    onError: (_err, _acknowledged, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/portfolio/projects', project.id], context.previousData);
        const metadata = (context.previousData as any)?.data?.project?.metadata as Record<string, unknown> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
        setIsAcknowledged(Boolean(metadata?.risksAcknowledged));
      }
      toast({
        title: t('projectWorkspace.toast.error'),
        description: t('projectWorkspace.toast.failedSaveAcknowledgment'),
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
    }
  });

  const handleAcknowledgeToggle = (newValue: boolean) => {
    setIsAcknowledged(newValue);
    saveAcknowledgedMutation.mutate(newValue);
  };

  const sectionConfig = {
    risks: {
      title: 'Risks',
      description: 'Risk register & mitigation strategies'
    },
    dependencies: {
      title: 'Dependencies',
      description: 'Project dependencies & relationships'
    },
    assumptions: {
      title: 'Assumptions',
      description: 'Assumptions & constraints log'
    }
  };

  return (
    <div className="space-y-6">
      {/* Innovative Header with Integrated Sub-tabs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500/5 via-orange-500/5 to-amber-500/5 border border-border/50 p-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-amber-500/10 to-red-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title Section */}
          <div className="flex items-center gap-4">
            {/* Animated Icon Container */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              {/* Subtle Glow Effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 opacity-30 blur-md -z-10" />
            </div>
            
            {/* Title Text - Dynamic based on active section */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent dark:from-red-400 dark:to-orange-400 transition-all duration-300">
                  Risk & Constraints
                  <span className="mx-1.5 text-muted-foreground/50">•</span>
                  <span className="transition-all duration-300">
                    {sectionConfig[activeSection].title}
                  </span>
                </h3>
                <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground transition-all duration-300">
                {sectionConfig[activeSection].description}
              </p>
            </div>
          </div>

          {/* Gradient Divider */}
          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-orange-500/50 to-transparent" />

          {/* Right: Acknowledge Toggle + Sub-tab Navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Acknowledge Toggle */}
            <div 
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isAcknowledged 
                  ? 'bg-emerald-500/20 border-emerald-500/50' 
                  : 'bg-muted/50 border-border hover:border-muted-foreground/30'
              } ${saveAcknowledgedMutation.isPending ? 'opacity-70 pointer-events-none' : ''}`}
              onClick={() => handleAcknowledgeToggle(!isAcknowledged)}
              data-testid="toggle-acknowledge-risks"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                isAcknowledged ? 'bg-emerald-500' : 'bg-muted-foreground/20'
              }`}>
                {saveAcknowledgedMutation.isPending ? (
                  <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                ) : isAcknowledged ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : (
                  <Shield className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <span className={`text-xs font-medium ${isAcknowledged ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {isAcknowledged ? 'Acknowledged' : 'Acknowledge'}
              </span>
              <Switch 
                checked={isAcknowledged}
                onCheckedChange={handleAcknowledgeToggle}
                className="ml-1 scale-75"
                disabled={saveAcknowledgedMutation.isPending}
                data-testid="switch-acknowledge-risks"
              />
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
              <button
                onClick={() => setActiveSection('risks')}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === 'risks'
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                data-testid="button-section-risks"
              >
                <AlertTriangle className={`w-4 h-4 transition-transform duration-300 ${
                  activeSection === 'risks' ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                <span>Risks</span>
                {activeSection === 'risks' && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
                )}
              </button>
              
              <button
                onClick={() => setActiveSection('dependencies')}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === 'dependencies'
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                data-testid="button-section-dependencies"
              >
                <LinkIcon className={`w-4 h-4 transition-transform duration-300 ${
                  activeSection === 'dependencies' ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                <span>Dependencies</span>
                {activeSection === 'dependencies' && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setActiveSection('assumptions')}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === 'assumptions'
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                data-testid="button-section-assumptions"
              >
                <Sparkles className={`w-4 h-4 transition-transform duration-300 ${
                  activeSection === 'assumptions' ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                <span>Assumptions</span>
                {activeSection === 'assumptions' && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area with Smooth Transition */}
      <div className="transition-all duration-300">
        {activeSection === 'risks' && (
          <RiskRegisterInit project={project} businessCase={businessCase} demandReport={demandReport} onAddRisk={onAddRisk} />
        )}
        {activeSection === 'dependencies' && (
          <DependenciesMapper 
            project={project} 
            businessCase={businessCase} 
            management={management}
            onAddDependency={onAddDependency}
            onEditDependency={onEditDependency}
            onDeleteDependency={onDeleteDependency}
          />
        )}
        {activeSection === 'assumptions' && (
          <AssumptionsConstraintsLog 
            project={project} 
            businessCase={businessCase} 
            management={management}
            onAddAssumption={onAddAssumption} 
            onAddConstraint={onAddConstraint}
            onEditAssumption={onEditAssumption}
            onEditConstraint={onEditConstraint}
            onDeleteAssumption={onDeleteAssumption}
            onDeleteConstraint={onDeleteConstraint}
          />
        )}
      </div>
    </div>
  );
}
