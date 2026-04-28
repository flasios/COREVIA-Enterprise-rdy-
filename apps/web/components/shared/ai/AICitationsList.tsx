import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText, Eye } from 'lucide-react';
import { DocumentPreviewModal } from '@/components/shared/document';
import type { AICitation } from '@shared/aiAdapters';

interface AICitationsListProps {
  citations?: AICitation[];
  className?: string;
}

export function AICitationsList({ citations, className }: AICitationsListProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ documentId: string; chunkId?: string } | null>(null);

  if (!citations || citations.length === 0) {
    return null;
  }

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (relevance >= 0.6) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    if (relevance >= 0.4) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300';
  };

  const formatRelevance = (relevance: number) => {
    return `${(relevance * 100).toFixed(0)}%`;
  };

  return (
    <Card className={className} data-testid="card-citations-list">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 hover-elevate active-elevate-2"
              data-testid="button-toggle-citations"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <CardTitle className="text-sm font-medium">
                  {t('ai.citations.sourceDocuments')}
                </CardTitle>
                <Badge variant="secondary" className="ml-2" data-testid="badge-citation-count">
                  {citations.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CardDescription className="text-xs">
            {t('ai.citations.description')}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {citations.map((citation, index) => (
                <div
                  key={`${citation.documentId}-${citation.chunkId}-${index}`}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border hover-elevate"
                  data-testid={`citation-item-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm font-medium truncate" title={citation.documentTitle}>
                        {citation.documentTitle}
                      </p>
                    </div>
                    
                    {/* Show excerpt if available */}
                    {citation.excerpt && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {citation.excerpt}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {t('ai.citations.relevance')}:
                      </span>
                      <Badge
                        variant="outline"
                        className={`${getRelevanceColor(citation.relevance)} text-xs`}
                        data-testid={`badge-relevance-${index}`}
                      >
                        {formatRelevance(citation.relevance)}
                      </Badge>
                      
                      {/* Show page number if available */}
                      {citation.page && (
                        <Badge variant="outline" className="text-xs">
                          {t('ai.citations.page', { page: citation.page })}
                        </Badge>
                      )}
                      
                      {/* Show section path if available */}
                      {citation.sectionPath && (
                        <Badge variant="outline" className="text-xs">
                          {citation.sectionPath}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => {
                      setPreviewDocument({
                        documentId: citation.documentId,
                        chunkId: citation.chunkId,
                      });
                    }}
                    title={t('common.viewPreview')}
                    data-testid={`button-view-preview-${index}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {t('ai.citations.preview')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          documentId={previewDocument.documentId}
          chunkId={previewDocument.chunkId}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </Card>
  );
}
