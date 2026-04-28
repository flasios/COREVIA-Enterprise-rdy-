import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuthorization } from '@/hooks/useAuthorization';

interface DocumentPreviewModalProps {
  documentId: string;
  chunkId?: string;
  onClose: () => void;
}

interface DocumentPreview {
  documentId: string;
  title: string;
  extractedText: string;
  chunk?: {
    id: string;
    start: number;
    end: number;
    content: string;
    context: string;
  };
  metadata: {
    fileType: string;
    pageCount?: number;
    wordCount?: number;
    category?: string;
    uploadedAt?: string;
  };
}

export function DocumentPreviewModal({ documentId, chunkId, onClose }: DocumentPreviewModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { canAccess: canAccessKnowledge } = useAuthorization({ requiredPermissions: ['knowledge:read'] });
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Fetch document preview
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DocumentPreview }>({
    queryKey: ['/api/knowledge/documents', documentId, 'preview', chunkId],
    queryFn: async () => {
      const url = `/api/knowledge/documents/${documentId}/preview${chunkId ? `?chunkId=${chunkId}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch preview');
      return response.json();
    },
    enabled: !!documentId,
  });

  const preview = data?.data;

  // Scroll to highlighted chunk after render
  useEffect(() => {
    if (preview?.chunk && highlightRef.current && !hasScrolled) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setHasScrolled(true);
      }, 300);
    }
  }, [preview, hasScrolled]);

  const handleViewInKnowledgeCentre = () => {
    setLocation('/knowledge');
    onClose();
  };

  // Render document text with highlighting
  const renderDocumentText = () => {
    if (!preview) return null;

    const text = preview.extractedText;
    const chunk = preview.chunk;

    if (!chunk || !text) {
      return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>;
    }

    const before = text.substring(0, chunk.start);
    const highlighted = text.substring(chunk.start, chunk.end);
    const after = text.substring(chunk.end);

    return (
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
        {before}
        <span
          ref={highlightRef}
          className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-1 rounded"
          data-testid="highlighted-chunk"
        >
          {highlighted}
        </span>
        {after}
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-document-preview">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="truncate" data-testid="text-document-title">
                  {isLoading ? t('knowledge.documentPreview.loading') : preview?.title || t('knowledge.documentPreview.title')}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-4 w-64" />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="badge-file-type">
                      {preview?.metadata.fileType.toUpperCase()}
                    </Badge>
                    {preview?.metadata.category && (
                      <Badge variant="secondary" data-testid="badge-category">
                        {preview.metadata.category}
                      </Badge>
                    )}
                    {preview?.metadata.pageCount && (
                      <span className="text-xs text-muted-foreground">
                        {t('knowledge.documentPreview.pages', { count: preview.metadata.pageCount })}
                      </span>
                    )}
                    {preview?.metadata.wordCount && (
                      <span className="text-xs text-muted-foreground">
                        {t('knowledge.documentPreview.words', { count: preview.metadata.wordCount })}
                      </span>
                    )}
                  </div>
                )}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 min-h-0 mt-4">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center p-8 text-destructive">
              <p>{t('knowledge.documentPreview.failedToLoad')}</p>
            </div>
          )}

          {!isLoading && !error && preview && (
            <ScrollArea className="h-full pr-4" data-testid="scroll-document-content">
              {renderDocumentText()}
            </ScrollArea>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {chunkId && preview?.chunk && (
              <span data-testid="text-chunk-info">
                {t('knowledge.documentPreview.chunkInfo', { start: preview.chunk.start, end: preview.chunk.end })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {canAccessKnowledge ? (
              <Button
                variant="outline"
                onClick={handleViewInKnowledgeCentre}
                data-testid="button-view-knowledge-centre"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('knowledge.documentPreview.viewInKnowledgeCentre')}
              </Button>
            ) : null}
            <Button onClick={onClose} data-testid="button-close">
              {t('knowledge.documentPreview.close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
