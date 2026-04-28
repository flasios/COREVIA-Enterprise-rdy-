import { useState } from 'react';
import {
  Users,
  Zap,
  Play,
  Sparkles,
} from 'lucide-react';

import type { ProjectData, StakeholderData, BusinessCaseData } from '../../../types';
import { AITeamAdvisorPanel } from '../../panels/AITeamAdvisorPanel';
import { ResourceCommandCenter } from '../../views/ResourceCommandCenter';
import { KickoffPlannerView } from '../../views/KickoffPlannerView';

interface TeamResourcesTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  stakeholders: StakeholderData[];
  onAssignPM: (pmId: string) => void;
}

export function TeamResourcesTab({
  project,
  businessCase,
  stakeholders,
  onAssignPM,
}: TeamResourcesTabProps) {
  const [activeSection, setActiveSection] = useState<'ai-advisor' | 'resources' | 'kickoff'>('ai-advisor');

  const sectionConfig = {
    'ai-advisor': {
      title: 'AI Advisor',
      description: 'Smart team composition recommendations'
    },
    resources: {
      title: 'Resources',
      description: 'Resource allocation & capacity planning'
    },
    kickoff: {
      title: 'Kick-off',
      description: 'Project launch planning & preparation'
    }
  };

  return (
    <div className="space-y-6">
      {/* Innovative Header with Integrated Sub-tabs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/5 via-teal-500/5 to-emerald-500/5 border border-border/50 p-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title Section */}
          <div className="flex items-center gap-4">
            {/* Animated Icon Container */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              {/* Subtle Glow Effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 opacity-30 blur-md -z-10" />
            </div>
            
            {/* Title Text - Dynamic based on active section */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-teal-400 transition-all duration-300">
                  Team & Resources
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
          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

          {/* Right: Sub-tab Navigation */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
            <button
              onClick={() => setActiveSection('ai-advisor')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'ai-advisor'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-ai-advisor"
            >
              <Sparkles className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'ai-advisor' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>AI Advisor</span>
              {activeSection === 'ai-advisor' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
            
            <button
              onClick={() => setActiveSection('resources')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'resources'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-resources"
            >
              <Zap className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'resources' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Resources</span>
              {activeSection === 'resources' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveSection('kickoff')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'kickoff'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-kickoff"
            >
              <Play className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'kickoff' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Kick-off</span>
              {activeSection === 'kickoff' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area with Smooth Transition */}
      <div className="transition-all duration-300">
        {activeSection === 'ai-advisor' && (
          <AITeamAdvisorPanel projectId={project.id} />
        )}
        {activeSection === 'resources' && (
          <ResourceCommandCenter project={project} businessCase={businessCase} onAssignPM={onAssignPM} />
        )}
        {activeSection === 'kickoff' && (
          <KickoffPlannerView project={project} businessCase={businessCase} stakeholders={stakeholders} />
        )}
      </div>
    </div>
  );
}
