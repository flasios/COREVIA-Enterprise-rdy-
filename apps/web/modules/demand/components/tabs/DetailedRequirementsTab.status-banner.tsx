import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ReportVersion } from '@shared/schema';

interface BlockingGate {
  layer: number;
  status: string;
  message: string;
}

interface DetailedRequirementsStatusBannerProps {
  latestVersion: ReportVersion | null | undefined;
  blockingGate: BlockingGate | null;
}

export function DetailedRequirementsStatusBanner({
  latestVersion,
  blockingGate,
}: DetailedRequirementsStatusBannerProps) {
  const { t } = useTranslation();

  return (
    <>
      {latestVersion && latestVersion.status !== 'draft' && (
        <div className={`flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 border-b ${
          latestVersion.status === 'under_review' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' :
          latestVersion.status === 'approved' || latestVersion.status === 'manager_approval' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
          latestVersion.status === 'published' ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' :
          latestVersion.status === 'rejected' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
          'bg-muted/50 border-border'
        }`} data-testid="status-banner-requirements">
          <div className="flex items-center gap-3">
            {latestVersion.status === 'under_review' && <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            {(latestVersion.status === 'approved' || latestVersion.status === 'manager_approval') && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
            {latestVersion.status === 'published' && <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            {latestVersion.status === 'rejected' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
            <div>
              <span className={`font-semibold text-sm ${
                latestVersion.status === 'under_review' ? 'text-amber-700 dark:text-amber-300' :
                latestVersion.status === 'approved' || latestVersion.status === 'manager_approval' ? 'text-green-700 dark:text-green-300' :
                latestVersion.status === 'published' ? 'text-purple-700 dark:text-purple-300' :
                latestVersion.status === 'rejected' ? 'text-red-700 dark:text-red-300' :
                'text-foreground'
              }`}>
                {latestVersion.status === 'under_review' && 'Under Review'}
                {latestVersion.status === 'approved' && 'Approved'}
                {latestVersion.status === 'manager_approval' && 'Pending Manager Approval'}
                {latestVersion.status === 'published' && 'Published'}
                {latestVersion.status === 'rejected' && 'Rejected'}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                Version {latestVersion.versionNumber} •
                {latestVersion.status === 'under_review' && ' Awaiting reviewer approval'}
                {(latestVersion.status === 'approved' || latestVersion.status === 'manager_approval') && ` Approved ${latestVersion.approvedAt ? new Date(latestVersion.approvedAt).toLocaleDateString() : ''}`}
                {latestVersion.status === 'published' && ' Live and accessible'}
                {latestVersion.status === 'rejected' && ' Please review feedback and resubmit'}
              </span>
            </div>
          </div>
          <Badge variant="outline" className={`${
            latestVersion.status === 'under_review' ? 'border-amber-300 text-amber-700 dark:text-amber-300' :
            latestVersion.status === 'approved' || latestVersion.status === 'manager_approval' ? 'border-green-300 text-green-700 dark:text-green-300' :
            latestVersion.status === 'published' ? 'border-purple-300 text-purple-700 dark:text-purple-300' :
            latestVersion.status === 'rejected' ? 'border-red-300 text-red-700 dark:text-red-300' :
            ''
          }`}>
            {latestVersion.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      )}

      {blockingGate && (
        <div className="px-4 pt-2">
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div>
              <AlertTitle>{t('demand.tabs.requirements.generationBlockedAtLayer', { layer: blockingGate.layer })}</AlertTitle>
              <AlertDescription>
                {blockingGate.message} ({t('demand.tabs.requirements.status')}: {blockingGate.status}). {t('demand.tabs.requirements.completeUpstreamAndRetry')}
              </AlertDescription>
            </div>
          </Alert>
        </div>
      )}
    </>
  );
}