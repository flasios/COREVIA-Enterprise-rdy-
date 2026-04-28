import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Eye,
  Edit,
  CheckCircle2,
  RotateCcw,
  Download,
  Shield,
  Clock,
  User,
  MapPin,
  Monitor,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';
import type { VersionAuditLog } from "@shared/schema";

interface VersionAuditTrailProps {
  reportId: string;
  versionId: string;
  versionNumber: string;
}

const ACTION_CONFIG: Record<string, {
  label: string;
  icon: typeof FileText;
  color: string;
  bgColor: string;
}> = {
  created: {
    label: "Created",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30"
  },
  viewed: {
    label: "Viewed",
    icon: Eye,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30"
  },
  edited: {
    label: "Edited",
    icon: Edit,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30"
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30"
  },
  restored: {
    label: "Restored",
    icon: RotateCcw,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30"
  },
  exported: {
    label: "Exported",
    icon: Download,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
  },
  signed: {
    label: "Digitally Signed",
    icon: Shield,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
  },
  updated: {
    label: "Updated",
    icon: Edit,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
};

export function VersionAuditTrail({ reportId, versionId, versionNumber }: VersionAuditTrailProps) {
  const { t } = useTranslation();
  const { data: auditData, isLoading, error } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions', versionId, 'audit-trail'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const auditTrail = (auditData as any)?.data?.auditTrail || []; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('versioning.auditTrail.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t('versioning.auditTrail.errorTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('versioning.auditTrail.errorDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-audit-trail">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('versioning.auditTrail.titleWithVersion', { version: versionNumber })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('versioning.auditTrail.description')}
        </p>
      </CardHeader>
      <CardContent>
        {auditTrail.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('versioning.auditTrail.noEntries')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {auditTrail.map((entry: VersionAuditLog, index: number) => {
                const config = (ACTION_CONFIG[entry.action] || ACTION_CONFIG.viewed)!;
                const Icon = config.icon;
                const isFirst = index === 0;
                const isLast = index === auditTrail.length - 1;
                const securityFlags = entry.securityFlags as Record<string, unknown> | undefined;
                const hasSecurityFlags = !!securityFlags && Object.keys(securityFlags).length > 0;

                return (
                  <div
                    key={entry.id}
                    className="relative flex gap-4"
                    data-testid={`audit-entry-${entry.action}-${index}`}
                  >
                    {/* Timeline connector */}
                    {!isLast && (
                      <div
                        className="absolute left-5 top-12 bottom-0 w-0.5 bg-border"
                        style={{ height: 'calc(100% + 1rem)' }}
                      />
                    )}

                    {/* Action icon */}
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${config.bgColor}`}
                    >
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    {/* Action details */}
                    <div className="flex-1 pb-6">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="secondary"
                              className={`${config.bgColor} ${config.color} font-medium`}
                              data-testid={`badge-action-${entry.action}`}
                            >
                              {config.label}
                            </Badge>
                            {isFirst && (
                              <Badge variant="outline" className="text-xs">
                                {t('versioning.auditTrail.latest')}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm font-medium" data-testid={`text-description-${index}`}>
                            {entry.actionDescription}
                          </p>

                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              <span data-testid={`text-user-${index}`}>
                                {entry.performedByName}
                                {entry.performedByRole && (
                                  <span className="ml-1 text-muted-foreground">
                                    ({entry.performedByRole})
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              <span data-testid={`text-timestamp-${index}`}>
                                {format(new Date(entry.performedAt), 'PPpp')}
                              </span>
                            </div>

                            {entry.ipAddress && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="font-mono">{entry.ipAddress}</span>
                              </div>
                            )}

                            {entry.userAgent && (
                              <div className="flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5" />
                                <span className="truncate max-w-md" title={entry.userAgent}>
                                  {entry.userAgent.substring(0, 60)}...
                                </span>
                              </div>
                            )}

                            {entry.complianceLevel && String(entry.complianceLevel) !== 'standard' && (
                              <div className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                <Badge
                                  variant={String(entry.complianceLevel) === 'critical' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {String(entry.complianceLevel).toUpperCase()}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Display security flags if present */}
                          {hasSecurityFlags && (
                            <div className="mt-2 rounded-md bg-muted p-2">
                              <p className="text-xs font-medium mb-1">{t('versioning.auditTrail.securityDetails')}</p>
                              <pre className="text-xs text-muted-foreground overflow-auto">
                                {JSON.stringify(securityFlags, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Summary footer */}
        {auditTrail.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="text-total-entries">
              {t('versioning.auditTrail.totalEntries', { count: auditTrail.length })}
            </span>
            <span>
              Last updated: {format(new Date(auditTrail[0].performedAt), 'PPp')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VersionAuditTrail;
