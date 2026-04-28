import { useState } from 'react';
import {
  FileText,
  Shield,
  GitBranch,
  Sparkles,
} from 'lucide-react';

import type { ProjectData, BusinessCaseData, DemandReportData } from '../../../types';
import { ProjectCharterView } from '../../views/ProjectCharterView';
import { GovernanceStructureView } from '../../views/GovernanceStructureView';

interface ProjectFoundationTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
}

export function ProjectFoundationTab({
  project,
  businessCase,
  demandReport,
}: ProjectFoundationTabProps) {
  const [activeSection, setActiveSection] = useState<'charter' | 'governance'>('governance');

  return (
    <div className="space-y-6">
      {/* Innovative Header with Integrated Sub-tabs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-blue-500/5 border border-border/50 p-4">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title Section */}
          <div className="flex items-center gap-4">
            {/* Animated Icon Container */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              {/* Subtle Glow Effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 opacity-30 blur-md -z-10" />
            </div>
            
            {/* Title Text - Dynamic based on active section */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 transition-all duration-300">
                  Project Foundation
                  <span className="mx-1.5 text-muted-foreground/50">•</span>
                  <span className="transition-all duration-300">
                    {activeSection === 'governance' ? 'Governance' : 'Charter'}
                  </span>
                </h3>
                <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground transition-all duration-300">
                {activeSection === 'governance' 
                  ? 'Organizational structure & decision framework' 
                  : 'Project authorization & stakeholder commitments'}
              </p>
            </div>
          </div>

          {/* Gradient Divider */}
          <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-indigo-500/50 to-transparent" />

          {/* Right: Sub-tab Navigation */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
            <button
              onClick={() => setActiveSection('governance')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'governance'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-governance"
            >
              <GitBranch className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'governance' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Governance</span>
              {activeSection === 'governance' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
            
            <button
              onClick={() => setActiveSection('charter')}
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeSection === 'charter'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              data-testid="button-section-charter"
            >
              <FileText className={`w-4 h-4 transition-transform duration-300 ${
                activeSection === 'charter' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span>Charter</span>
              {activeSection === 'charter' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/50 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area with Smooth Transition */}
      <div className="transition-all duration-300">
        {activeSection === 'governance' && (
          <GovernanceStructureView project={project} businessCase={businessCase} />
        )}
        {activeSection === 'charter' && (
          <ProjectCharterView project={project} businessCase={businessCase} demandReport={demandReport} />
        )}
      </div>
    </div>
  );
}
