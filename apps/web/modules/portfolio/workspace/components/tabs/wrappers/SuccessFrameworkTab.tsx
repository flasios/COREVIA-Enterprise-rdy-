import { useState } from 'react';
import {
  Target,
  BarChart3,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import type { ProjectData, StakeholderData, BusinessCaseData, DemandReportData } from '../../../types';
import { SuccessMetricsDashboard } from '../../views/SuccessMetricsDashboard';

interface ReadinessTrackerProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  stakeholders: StakeholderData[];
}

interface SuccessFrameworkTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  stakeholders: StakeholderData[];
}

export function SuccessFrameworkTab({
  project,
  businessCase,
  demandReport,
  stakeholders,
}: SuccessFrameworkTabProps) {
  const [activeSection, setActiveSection] = useState<'metrics' | 'readiness'>('metrics');

  const sectionConfig = {
    metrics: {
      title: 'Metrics',
      description: 'Key performance indicators & success measures'
    },
    readiness: {
      title: 'Readiness',
      description: 'Project readiness checklist & launch status'
    }
  };

  return (
    <div className="space-y-6">
      {/* Innovative Header with Integrated Sub-tabs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 border border-border/50 p-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-cyan-500/10 to-emerald-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title Section */}
          <div className="flex items-center gap-4">
            {/* Animated Icon Container */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              {/* Subtle Glow Effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 opacity-30 blur-md -z-10" />
            </div>
            
            {/* Title Text - Dynamic based on active section */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400 transition-all duration-300">
                  Success Framework
                  <span className="mx-1.5 text-muted-foreground/50">•</span>
                  <span className="transition-all duration-300">
                    {sectionConfig[activeSection].title}
                  </span>
                </h3>
                <Sparkles className="w-4 h-4 text-teal-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground transition-all duration-300">
                {sectionConfig[activeSection].description}
              </p>
            </div>
          </div>

          {/* Gradient Divider */}
          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-emerald-500/50 to-transparent" />

          {/* Right: Sub-tab Navigation */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
            <button
              onClick={() => setActiveSection('metrics')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'metrics'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-metrics"
            >
              <BarChart3 className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'metrics' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Metrics</span>
              {activeSection === 'metrics' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
            
            <button
              onClick={() => setActiveSection('readiness')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'readiness'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-readiness"
            >
              <CheckCircle2 className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'readiness' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Readiness</span>
              {activeSection === 'readiness' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area with Smooth Transition */}
      <div className="transition-all duration-300">
        {activeSection === 'metrics' && (
          <SuccessMetricsDashboard project={project} businessCase={businessCase} />
        )}
        {activeSection === 'readiness' && (
          <ReadinessTracker project={project} businessCase={businessCase} demandReport={demandReport} stakeholders={stakeholders} />
        )}
      </div>
    </div>
  );
}

 
function ReadinessTracker({ project, businessCase, demandReport: _demandReport, stakeholders }: ReadinessTrackerProps) {
  const bc = (businessCase as any)?.content || businessCase; // eslint-disable-line @typescript-eslint/no-explicit-any

  const readinessItems = [
    { id: 'pm', label: 'Project Manager Assigned', status: project.projectManagerId ? 'complete' : 'pending' },
    { id: 'bc', label: 'Business Case Approved', status: businessCase ? 'complete' : 'pending' },
    { id: 'stakeholders', label: 'Key Stakeholders Identified', status: stakeholders.length > 0 ? 'complete' : 'pending' },
    { id: 'scope', label: 'Scope Defined', status: bc?.scopeDefinition ? 'complete' : 'pending' },
    { id: 'budget', label: 'Budget Allocated', status: project.totalBudget ? 'complete' : 'pending' },
  ];

  const completedItems = readinessItems.filter(i => i.status === 'complete').length;
  const readinessScore = Math.round((completedItems / readinessItems.length) * 100);

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Project Readiness
          </CardTitle>
          <Badge className={readinessScore >= 80 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}>
            {readinessScore}% Ready
          </Badge>
        </div>
        <Progress value={readinessScore} className="h-2 mt-4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {readinessItems.map((item) => (
            <div key={item.id} className={`p-3 rounded-lg border flex items-center gap-3 ${
              item.status === 'complete' 
                ? 'bg-emerald-900/20 border-emerald-700/30' 
                : 'bg-muted/40 border-border/50'
            }`}>
              {item.status === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
              <span className={`text-sm ${item.status === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
