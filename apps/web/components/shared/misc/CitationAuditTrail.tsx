import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, History, User, Clock } from 'lucide-react';
import { formatDistance } from 'date-fns';

interface CitationAuditTrailProps {
  documentId: string;
  className?: string;
}

interface CitationHistory {
  usageCount: number;
  lastUsedAt: string | null;
  history: Array<{
    timestamp: string;
    userId: string;
    userName: string;
    context: string;
    confidence: number | null;
  }>;
}

export function CitationAuditTrail({ documentId, className }: CitationAuditTrailProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 5;

  // Fetch citation history
  const { data, isLoading } = useQuery<{ success: boolean; data: CitationHistory }>({
    queryKey: ['/api/knowledge/citations', documentId, 'history'],
    enabled: isOpen && !!documentId,
  });

  const history = data?.data;
  const paginatedHistory = history?.history.slice(page * pageSize, (page + 1) * pageSize) || [];
  const totalPages = Math.ceil((history?.history.length || 0) / pageSize);

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card className={className} data-testid="card-citation-audit-trail">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 hover-elevate active-elevate-2"
              data-testid="button-toggle-audit-trail"
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <CardTitle className="text-sm font-medium">
                  {t('ai.citationAudit.usageHistory')}
                </CardTitle>
                {!isLoading && history && (
                  <Badge variant="secondary" className="ml-2" data-testid="badge-usage-count">
                    {t('ai.citationAudit.uses', { count: history.usageCount })}
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md border">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && history && history.history.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('ai.citationAudit.noHistory')}</p>
                <p className="text-xs mt-1">
                  {t('ai.citationAudit.noHistoryDescription')}
                </p>
              </div>
            )}

            {!isLoading && history && paginatedHistory.length > 0 && (
              <>
                <div className="space-y-3">
                  {paginatedHistory.map((item, index) => (
                    <div
                      key={`${item.timestamp}-${index}`}
                      className="flex items-start gap-3 p-3 rounded-md border hover-elevate"
                      data-testid={`audit-item-${index}`}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={item.userName}>
                              {item.userName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.context}
                            </p>
                          </div>
                          {item.confidence !== null && (
                            <Badge
                              variant="outline"
                              className="flex-shrink-0"
                              data-testid={`badge-confidence-${index}`}
                            >
                              {(item.confidence * 100).toFixed(0)}% {t('ai.citationAudit.confidence')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span data-testid={`text-timestamp-${index}`}>
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      {t('ai.citationAudit.pageOf', { current: page + 1, total: totalPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        data-testid="button-prev-page"
                      >
                        {t('ai.citationAudit.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        data-testid="button-next-page"
                      >
                        {t('ai.citationAudit.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
