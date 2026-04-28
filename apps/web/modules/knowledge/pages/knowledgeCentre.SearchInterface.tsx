import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, Sparkles, Loader2, Zap,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { getFileIcon } from "./knowledgeCentre.display";
import type {
  AskAIResponse,
  SearchResult,
} from "./knowledgeCentre.types";

// ============================================================================
// SEARCH INTERFACE COMPONENT
// ============================================================================

interface SearchInterfaceProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: 'semantic' | 'keyword';
  setSearchMode: (mode: 'semantic' | 'keyword') => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSearch: () => void;
  askAIQuery: string;
  setAskAIQuery: (query: string) => void;
  askAIResponse: AskAIResponse | null;
  isAskingAI: boolean;
  onAskAI: () => void;
}

export function SearchInterface({
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  searchResults,
  isSearching,
  onSearch,
  askAIQuery,
  setAskAIQuery,
  askAIResponse,
  isAskingAI,
  onAskAI,
}: SearchInterfaceProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Search Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t('knowledge.searchInterface.title')}
          </CardTitle>
          <CardDescription>
            {t('knowledge.searchInterface.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <Label className="text-sm font-medium">{t('knowledge.searchInterface.searchMode')}:</Label>
            <div className="flex items-center gap-2">
              <Button
                variant={searchMode === 'semantic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('semantic')}
                data-testid="button-mode-semantic"
              >
                <HexagonLogoFrame px={16} className="mr-2" />
                {t('knowledge.searchInterface.semantic')}
              </Button>
              <Button
                variant={searchMode === 'keyword' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('keyword')}
                data-testid="button-mode-keyword"
              >
                <Zap className="h-4 w-4 mr-2" />
                {t('knowledge.searchInterface.hybrid')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('knowledge.searchInterface.searchQuery')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('knowledge.searchInterface.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSearching) {
                    onSearch();
                  }
                }}
                data-testid="input-search-query"
              />
              <Button
                onClick={onSearch}
                disabled={isSearching}
                data-testid="button-search"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('knowledge.searchInterface.searchResults', { count: searchResults.length })}
              </Label>
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-3">
                  {searchResults.map((result, idx) => (
                    <Card key={`${result.chunkId}-${idx}`} className="p-4" data-testid={`search-result-${idx}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {getFileIcon(result.filename.split('.').pop() || 'txt')}
                          <span className="font-semibold text-sm">{result.filename}</span>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-score-${idx}`}>
                          {(result.score * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      {result.category && (
                        <Badge variant="outline" className="mb-2">{result.category}</Badge>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {result.content}
                      </p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ask AI Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {t('knowledge.searchInterface.askAi')}
          </CardTitle>
          <CardDescription>
            {t('knowledge.searchInterface.askAiDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('knowledge.searchInterface.yourQuestion')}</Label>
            <Textarea
              placeholder={t('knowledge.searchInterface.questionPlaceholder')}
              value={askAIQuery}
              onChange={(e) => setAskAIQuery(e.target.value)}
              rows={4}
              data-testid="textarea-ai-query"
            />
          </div>

          <Button
            onClick={onAskAI}
            disabled={isAskingAI}
            className="w-full"
            data-testid="button-ask-ai"
          >
            {isAskingAI ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('knowledge.searchInterface.generatingAnswer')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('knowledge.searchInterface.askAi')}
              </>
            )}
          </Button>

          {/* AI Response */}
          {askAIResponse && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg" data-testid="ai-response-container">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('knowledge.searchInterface.aiResponse')}</Label>
                <Badge variant="secondary" data-testid="badge-confidence">
                  Confidence: {(askAIResponse.confidence * 100).toFixed(0)}%
                </Badge>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-sm whitespace-pre-wrap" data-testid="text-ai-answer">
                  {askAIResponse.answer}
                </p>
              </div>

              {askAIResponse.citations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('knowledge.searchInterface.sources', { count: askAIResponse.citations.length })}
                  </Label>
                  <div className="space-y-2">
                    {askAIResponse.citations.map((citation, idx) => (
                      <Card key={idx} className="p-3" data-testid={`citation-${idx}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-xs">{citation.filename}</span>
                          <Badge variant="outline" className="text-xs">
                            {(citation.score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {citation.content}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
