import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { BookOpen, Clock, GitBranch, ShieldCheck, Sparkles, Users } from "lucide-react";

interface ProvenanceTagsProps {
  sectionName: string;
  versionNumber?: string;
  lastModified?: string;
  lastModifiedBy?: string;
}

export function SectionProvenanceTags({ sectionName: _sectionName, versionNumber, lastModified, lastModifiedBy }: ProvenanceTagsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground audit-breadcrumb py-2 px-3 rounded-md bg-muted/30 border border-muted-foreground/10">
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3" />
        <span className="font-medium">{t('demand.tabs.requirements.modifiedBy')}:</span>
        <span>{lastModifiedBy || t('demand.tabs.requirements.system')}</span>
      </div>
      <Separator orientation="vertical" className="h-3" />
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        <span>{lastModified ? format(new Date(lastModified), "MMM d, yyyy") : t('demand.tabs.requirements.never')}</span>
      </div>
      <Separator orientation="vertical" className="h-3" />
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3" />
        <span className="font-medium">{t('demand.tabs.requirements.version')}:</span>
        <span>{versionNumber || 'N/A'}</span>
      </div>
    </div>
  );
}

interface GovernanceIndicatorsProps {
  dataSource: 'ai-generated' | 'manual' | 'hybrid';
  complianceLevel?: string;
  traceabilityLink?: string;
}

export function DataGovernanceIndicators({ dataSource, complianceLevel, traceabilityLink }: GovernanceIndicatorsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge
        variant="outline"
        className={`text-xs ${
          dataSource === 'ai-generated'
            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
            : dataSource === 'manual'
              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
              : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
        }`}
      >
        <Sparkles className="h-3 w-3 mr-1" />
        {dataSource === 'ai-generated' ? t('demand.tabs.requirements.aiGenerated') : dataSource === 'manual' ? t('demand.tabs.requirements.manual') : t('demand.tabs.requirements.hybrid')}
      </Badge>

      {complianceLevel && (
        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          <ShieldCheck className="h-3 w-3 mr-1" />
          {complianceLevel}
        </Badge>
      )}

      {traceabilityLink && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 cursor-pointer hover-elevate">
                <BookOpen className="h-3 w-3 mr-1" />
                {t('demand.tabs.requirements.traceable')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{t('demand.tabs.requirements.source')}: {traceabilityLink}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}