import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  MessageSquare,
  Mail,
  Sparkles,
} from 'lucide-react';

import type { ProjectData, StakeholderData, BusinessCaseData, DemandReportData } from '../../../types';
import { StakeholderMapView } from '../../views/StakeholderMapView';
import { CommunicationPlanBuilder } from '../../views/CommunicationPlanBuilder';

interface StakeholderHubTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  stakeholders: StakeholderData[];
  demandReport?: DemandReportData;
  onAddStakeholder: () => void;
}

export function StakeholderHubTab({
  project,
  businessCase,
  stakeholders,
  demandReport,
  onAddStakeholder,
}: StakeholderHubTabProps) {
  const [activeSection, setActiveSection] = useState<'stakeholders' | 'communication'>('stakeholders');

  const rawDemandStakeholders = demandReport?.stakeholders || demandReport?.keyStakeholders;
  const demandStakeholders = Array.isArray(rawDemandStakeholders) ? rawDemandStakeholders : [];
  const demandOwner = demandReport?.demandOwner;
  const demandContact = demandReport?.contactPerson;
  const projectGovernanceContacts = [project.sponsor, project.projectManager].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );

  const projectStakeholderCount = Math.max(stakeholders.length, projectGovernanceContacts.length);
  const demandStakeholderCount = demandStakeholders.length + (demandOwner ? 1 : 0) + (demandContact ? 1 : 0);
  const bcStakeholderCount = businessCase?.stakeholders?.length || businessCase?.content?.stakeholders?.length || 0;

  const sectionConfig = {
    stakeholders: {
      title: 'Stakeholders',
      description: 'Map key players & influence levels'
    },
    communication: {
      title: 'Communication',
      description: 'Strategic stakeholder engagement'
    }
  };

  return (
    <div className="space-y-6">
      {/* Innovative Header with Integrated Sub-tabs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500/5 via-violet-500/5 to-fuchsia-500/5 border border-border/50 p-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-fuchsia-500/10 to-purple-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title Section */}
          <div className="flex items-center gap-4">
            {/* Animated Icon Container */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              {/* Subtle Glow Effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 opacity-30 blur-md -z-10" />
            </div>
            
            {/* Title Text - Dynamic based on active section */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-violet-400 transition-all duration-300">
                  Stakeholder Hub
                  <span className="mx-1.5 text-muted-foreground/50">•</span>
                  <span className="transition-all duration-300">
                    {sectionConfig[activeSection].title}
                  </span>
                </h3>
                <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground transition-all duration-300">
                {sectionConfig[activeSection].description}
              </p>
            </div>
          </div>

          {/* Gradient Divider */}
          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-purple-500/50 to-transparent" />

          {/* Right: Sub-tab Navigation + Stats */}
          <div className="flex items-center gap-3">
            {/* Stats Badges */}
            <div className="hidden md:flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {projectStakeholderCount} Project
              </Badge>
              {demandStakeholderCount > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {demandStakeholderCount} Demand
                </Badge>
              )}
              {bcStakeholderCount > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                  {bcStakeholderCount} BC
                </Badge>
              )}
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
              <button
                onClick={() => setActiveSection('stakeholders')}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === 'stakeholders'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                data-testid="button-section-stakeholders"
              >
                <Users className={`w-4 h-4 transition-transform duration-300 ${
                  activeSection === 'stakeholders' ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                <span>Stakeholders</span>
                {activeSection === 'stakeholders' && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
                )}
              </button>
              
              <button
                onClick={() => setActiveSection('communication')}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeSection === 'communication'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                data-testid="button-section-communication"
              >
                <Mail className={`w-4 h-4 transition-transform duration-300 ${
                  activeSection === 'communication' ? 'scale-110' : 'group-hover:scale-105'
                }`} />
                <span>Communication</span>
                {activeSection === 'communication' && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area with Smooth Transition */}
      <div className="transition-all duration-300">
        {activeSection === 'stakeholders' && (
          <StakeholderMapView 
            project={project} 
            businessCase={businessCase} 
            stakeholders={stakeholders} 
            demandReport={demandReport}
            onAddStakeholder={onAddStakeholder}
          />
        )}
        {activeSection === 'communication' && (
          <CommunicationPlanBuilder 
            project={project} 
            businessCase={businessCase} 
            stakeholders={stakeholders}
          />
        )}
      </div>
    </div>
  );
}
