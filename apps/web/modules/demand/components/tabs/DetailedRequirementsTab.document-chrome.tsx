import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import type { ReportVersion } from '@shared/schema';

interface DetailedRequirementsDocumentChromeProps {
  latestVersion: ReportVersion | null | undefined;
  isVersionLocked: boolean;
}

export function DetailedRequirementsDocumentChrome({
  latestVersion,
  isVersionLocked,
}: DetailedRequirementsDocumentChromeProps) {
  const { t } = useTranslation();

  return (
    <>
      {latestVersion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold select-none"
            style={{
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              opacity: latestVersion.status === 'draft' ? '0.12' :
                latestVersion.status === 'under_review' ? '0.10' :
                latestVersion.status === 'approved' || latestVersion.status === 'manager_approval' ? '0.08' :
                latestVersion.status === 'published' ? '0.15' : '0.10',
              color: latestVersion.status === 'draft' ? 'hsl(var(--muted-foreground))' :
                latestVersion.status === 'under_review' ? 'hsl(var(--accent-amber))' :
                latestVersion.status === 'approved' || latestVersion.status === 'manager_approval' ? 'hsl(var(--accent-cyan))' :
                latestVersion.status === 'published' ? 'hsl(var(--accent-purple))' : 'hsl(var(--muted-foreground))',
              whiteSpace: 'nowrap',
            }}
          >
            {latestVersion.status === 'draft' ? t('demand.tabs.requirements.watermark.draft') :
              latestVersion.status === 'under_review' ? t('demand.tabs.requirements.watermark.underReview') :
              latestVersion.status === 'approved' ? t('demand.tabs.requirements.watermark.approved') :
              latestVersion.status === 'manager_approval' ? t('demand.tabs.requirements.watermark.finalApproval') :
              latestVersion.status === 'published' ? t('demand.tabs.requirements.watermark.published') : ''}
          </div>
        </div>
      )}

      {isVersionLocked && latestVersion && (
        <Card className="border-green-500/20 bg-muted/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-green-500/10">
                <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
                    {t('demand.tabs.requirements.requirementsDocumentLocked')}
                  </h3>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    {latestVersion.status === 'published'
                      ? t('demand.tabs.requirements.statusPublished')
                      : t('demand.tabs.requirements.statusManagerApproval')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('demand.tabs.requirements.lockedDescription')}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {t('demand.tabs.requirements.versionApprovedOn', {
                      version: latestVersion.versionNumber,
                      date: new Date(latestVersion.approvedAt || latestVersion.createdAt).toLocaleDateString(),
                    })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}