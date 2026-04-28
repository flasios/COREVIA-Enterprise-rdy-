import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  FileText, 
  Eye,
  Copy,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useStageKnowledgeSuggestions, type KnowledgeSuggestion } from '@/hooks/useStageKnowledgeSuggestions';
import { UseAsTemplateModal } from './UseAsTemplateModal';

interface SuggestedKnowledgeSidebarProps {
  stage: 'creation' | 'review' | 'approval';
  context: {
    title?: string;
    description?: string;
    requestType?: string;
    category?: string;
    priority?: string;
    requirements?: string;
    businessCase?: string;
    costs?: string;
    strategicAlignment?: string;
  };
  demandId?: number;
  onUseTemplate?: (documentId: string, sections: string[]) => void;
}

export function SuggestedKnowledgeSidebar({
  stage,
  context,
  demandId,
  onUseTemplate,
}: SuggestedKnowledgeSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useTranslation();
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    title: string;
    type: string;
  } | null>(null);

  const { suggestions, loading, error, refresh, showMore, hasMore } = 
    useStageKnowledgeSuggestions(stage, context, demandId);

  const getStageLabel = () => {
    switch (stage) {
      case 'creation': return t('knowledge.suggestedSidebar.creationStage');
      case 'review': return t('knowledge.suggestedSidebar.reviewStage');
      case 'approval': return t('knowledge.suggestedSidebar.approvalStage');
    }
  };

  const getStageColor = () => {
    switch (stage) {
      case 'creation': return 'bg-blue-500';
      case 'review': return 'bg-amber-500';
      case 'approval': return 'bg-emerald-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-emerald-600 dark:text-emerald-400';
    if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const handleUseTemplate = (suggestion: KnowledgeSuggestion) => {
    setSelectedDocument({
      id: suggestion.id,
      title: suggestion.title,
      type: suggestion.documentType,
    });
  };

  const handleTemplateConfirm = (sections: string[]) => {
    if (selectedDocument && onUseTemplate) {
      onUseTemplate(selectedDocument.id, sections);
    }
    setSelectedDocument(null);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="h-full flex flex-col" data-testid="suggested-knowledge-sidebar">
          <CardHeader className="flex-shrink-0 space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm">{t('knowledge.suggestedSidebar.title')}</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={refresh}
                  disabled={loading}
                  data-testid="button-refresh-suggestions"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    data-testid="button-toggle-sidebar"
                  >
                    {isOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge 
                variant="secondary" 
                className={`${getStageColor()} text-white text-xs`}
                data-testid={`badge-stage-${stage}`}
              >
                {t('knowledge.suggestedSidebar.stage', { stage: getStageLabel() })}
              </Badge>
              {!loading && suggestions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('knowledge.suggestedSidebar.suggestionCount', { count: suggestions.length })}
                </span>
              )}
            </div>
          </CardHeader>

          <CollapsibleContent className="flex-1 min-h-0">
            <CardContent className="h-full flex flex-col p-4 pt-0">
              <ScrollArea className="flex-1 -mr-2 pr-2">
                {loading && suggestions.length === 0 && (
                  <div className="space-y-3" data-testid="loading-skeleton">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="p-3">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-full mb-1" />
                        <Skeleton className="h-3 w-5/6" />
                      </Card>
                    ))}
                  </div>
                )}

                {error && (
                  <Alert variant="destructive" data-testid="error-alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {!loading && !error && suggestions.length === 0 && (
                  <div 
                    className="flex flex-col items-center justify-center py-8 text-center"
                    data-testid="empty-state"
                  >
                    <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('knowledge.suggestedSidebar.noSuggestions')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('knowledge.suggestedSidebar.addMoreContext')}
                    </p>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="space-y-3" data-testid="suggestions-list">
                    {suggestions.map((suggestion, index) => (
                      <Card 
                        key={suggestion.id} 
                        className="hover-elevate"
                        data-testid={`suggestion-card-${index}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium truncate" title={suggestion.title}>
                                {suggestion.title}
                              </h4>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`text-xs shrink-0 ${getConfidenceColor(suggestion.confidence)}`}
                              data-testid={`confidence-badge-${index}`}
                            >
                              {Math.round(suggestion.confidence * 100)}%
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {suggestion.snippet}
                          </p>

                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {suggestion.documentType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.category}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1 mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs flex-1"
                              data-testid={`button-preview-${index}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {t('knowledge.suggestedSidebar.preview')}
                            </Button>
                            {suggestion.actions.includes('use_as_template') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs flex-1"
                                onClick={() => handleUseTemplate(suggestion)}
                                data-testid={`button-use-template-${index}`}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                {t('knowledge.suggestedSidebar.useTemplate')}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {hasMore && !loading && (
                <div className="pt-3 border-t mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={showMore}
                    data-testid="button-show-more"
                  >
                    {t('knowledge.suggestedSidebar.showMore')}
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {selectedDocument && (
        <UseAsTemplateModal
          documentId={selectedDocument.id}
          documentTitle={selectedDocument.title}
          documentType={selectedDocument.type}
          onConfirm={handleTemplateConfirm}
          onCancel={() => setSelectedDocument(null)}
        />
      )}
    </>
  );
}
