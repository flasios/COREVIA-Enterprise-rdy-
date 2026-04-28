import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  FileText, Sparkles, Loader2, FolderInput, Languages,
} from "lucide-react";
import type {
  DocumentWithUploader,
} from "./knowledgeCentre.types";
import {
  KNOWLEDGE_CLASSIFICATION_LIST,
} from "@shared/schema";

// ============================================================================
// CONSTANTS
// ============================================================================

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// REGENERATE EMBEDDINGS SECTION COMPONENT
// ============================================================================

export function RegenerateEmbeddingsSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [results, setResults] = useState<{ id: string; title: string; status: string; error?: string }[] | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/knowledge/documents/regenerate-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        toast({
          title: t('knowledge.adminSections.embeddingsRegenerated'),
          description: t('knowledge.adminSections.embeddingsRegeneratedDesc', { processed: data.processed, failed: data.failed, remaining: data.remaining > 0 ? t('knowledge.adminSections.remainingClick', { count: data.remaining }) : '' }),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
      } else {
        toast({
          variant: "destructive",
          title: t('knowledge.adminSections.error'),
          description: data.error || t('knowledge.adminSections.failedRegenerate'),
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: t('knowledge.adminSections.error'),
        description: t('knowledge.adminSections.failedToConnect'),
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t('knowledge.adminSections.regenerateTitle')}
        </CardTitle>
        <CardDescription>
          {t('knowledge.adminSections.regenerateDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            data-testid="button-regenerate-embeddings"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('knowledge.adminSections.processing')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('knowledge.adminSections.regenerateEmbeddings')}
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('knowledge.adminSections.processesUpTo10')}
          </p>
        </div>
        
        {results && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('knowledge.adminSections.results')}:</p>
            <ScrollArea className="h-40">
              <div className="space-y-1">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                    <Badge 
                      variant={r.status === 'success' ? 'default' : r.status === 'skipped' ? 'secondary' : 'destructive'}
                      className={r.status === 'success' ? 'bg-emerald-500' : ''}
                    >
                      {r.status}
                    </Badge>
                    <span className="truncate flex-1">{r.title}</span>
                    {r.error && <span className="text-xs text-muted-foreground">{r.error}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FIX ARABIC ENCODING SECTION COMPONENT
// ============================================================================

export function FixEncodingSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<{ id: string; oldName: string; newName: string; fixed: boolean }[] | null>(null);

  const handleFixEncoding = async () => {
    setIsFixing(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/knowledge/documents/fix-encoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        toast({
          title: t('knowledge.adminSections.encodingFixed'),
          description: t('knowledge.adminSections.encodingFixedDesc', { count: data.fixed }),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
      } else {
        toast({
          variant: "destructive",
          title: t('knowledge.adminSections.error'),
          description: data.error || t('knowledge.adminSections.failedFixEncoding'),
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: t('knowledge.adminSections.error'),
        description: t('knowledge.adminSections.failedToConnect'),
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          {t('knowledge.adminSections.fixEncodingTitle')}
        </CardTitle>
        <CardDescription>
          {t('knowledge.adminSections.fixEncodingDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleFixEncoding}
            disabled={isFixing}
            data-testid="button-fix-encoding"
          >
            {isFixing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('knowledge.adminSections.processing')}
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                {t('knowledge.adminSections.fixEncoding')}
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('knowledge.adminSections.decodesCorrupted')}
          </p>
        </div>
        
        {results && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('knowledge.adminSections.fixedFilenames')}:</p>
            <ScrollArea className="h-40">
              <div className="space-y-1">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                    <Badge 
                      variant={r.fixed ? 'default' : 'destructive'}
                      className={r.fixed ? 'bg-emerald-500' : ''}
                    >
                      {r.fixed ? 'fixed' : 'failed'}
                    </Badge>
                    <span className="truncate flex-1" dir="auto">{r.newName}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// UNASSIGNED DOCUMENTS SECTION COMPONENT
// ============================================================================

export function UnassignedDocumentsSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [targetSubfolder, setTargetSubfolder] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [autoAssignResults, setAutoAssignResults] = useState<Array<{ id: string; filename: string; newPath: string; success: boolean }> | null>(null);
  
  const { data: unassignedData, isLoading, refetch } = useQuery<{ success: boolean; data: DocumentWithUploader[]; count: number }>({
    queryKey: ['/api/knowledge/documents/unassigned'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  const unassignedDocs = unassignedData?.data || [];
  
  const selectedClassification = targetFolder ? 
    KNOWLEDGE_CLASSIFICATION_LIST.find(c => c.id === targetFolder) : null;
  
  const handleAutoAssignAll = async () => {
    setIsAutoAssigning(true);
    setAutoAssignResults(null);
    
    try {
      const response = await fetch('/api/knowledge/documents/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAutoAssignResults(data.results);
        toast({
          title: t('knowledge.adminSections.docsAutoAssigned'),
          description: t('knowledge.adminSections.docsAutoAssignedDesc', { count: data.assigned }),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents/unassigned'] });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
        refetch();
      } else {
        toast({
          variant: "destructive",
          title: t('knowledge.adminSections.error'),
          description: data.error || t('knowledge.adminSections.failedAutoAssign'),
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: t('knowledge.adminSections.error'),
        description: t('knowledge.adminSections.failedToConnect'),
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedDocs.length === unassignedDocs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(unassignedDocs.map(d => d.id));
    }
  };
  
  const handleToggleDoc = (docId: string) => {
    if (selectedDocs.includes(docId)) {
      setSelectedDocs(selectedDocs.filter(id => id !== docId));
    } else {
      setSelectedDocs([...selectedDocs, docId]);
    }
  };
  
  const handleAssignFolder = async () => {
    if (!targetFolder || selectedDocs.length === 0) {
      toast({
        variant: "destructive",
        title: t('knowledge.adminSections.error'),
        description: t('knowledge.adminSections.selectDocsAndFolder'),
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const folderPath = targetSubfolder ? `${targetFolder}/${targetSubfolder}` : targetFolder;
      
      const response = await fetch('/api/knowledge/documents/batch-update-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedDocs,
          folderPath,
        }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: t('knowledge.adminSections.docsAssigned'),
          description: t('knowledge.adminSections.docsAssignedDesc', { count: data.updated, path: folderPath }),
        });
        setSelectedDocs([]);
        setTargetFolder("");
        setTargetSubfolder("");
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents/unassigned'] });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
      } else {
        toast({
          variant: "destructive",
          title: t('knowledge.adminSections.error'),
          description: data.error || t('knowledge.adminSections.failedAssign'),
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: t('knowledge.adminSections.error'),
        description: t('knowledge.adminSections.failedToConnect'),
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (unassignedDocs.length === 0) {
    return null; // Don't show section if no unassigned documents
  }
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5 text-amber-500" />
              {t('knowledge.adminSections.unassignedDocs', { count: unassignedDocs.length })}
            </CardTitle>
            <CardDescription>
              {t('knowledge.adminSections.unassignedDocsDesc')}
            </CardDescription>
          </div>
          <Button
            onClick={handleAutoAssignAll}
            disabled={isAutoAssigning || unassignedDocs.length === 0}
            variant="default"
            data-testid="button-auto-assign-all"
          >
            {isAutoAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('knowledge.adminSections.autoAssigning')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('knowledge.adminSections.autoAssignAll')}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-Assign Results */}
        {autoAssignResults && autoAssignResults.length > 0 && (
          <div className="space-y-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t('knowledge.adminSections.successfullyClassified', { count: autoAssignResults.filter(r => r.success).length })}:
            </p>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {autoAssignResults.filter(r => r.success).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="flex-shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200">
                      {r.newPath}
                    </Badge>
                    <span className="truncate text-muted-foreground" dir="auto">{r.filename}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Folder Selection */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>{t('knowledge.adminSections.classification')}</Label>
            <Select value={targetFolder} onValueChange={(v) => { setTargetFolder(v); setTargetSubfolder(""); }}>
              <SelectTrigger>
                <SelectValue placeholder={t('knowledge.adminSections.selectClassification')} />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_CLASSIFICATION_LIST.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedClassification && selectedClassification.subfolders.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <Label>{t('knowledge.adminSections.subfolder')}</Label>
              <Select value={targetSubfolder} onValueChange={(v) => setTargetSubfolder(v === "__root__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subfolder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">{t('knowledge.adminSections.rootFolder')}</SelectItem>
                  {selectedClassification.subfolders.map(sf => (
                    <SelectItem key={sf.slug} value={sf.slug}>{sf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Button
            onClick={handleAssignFolder}
            disabled={isUpdating || !targetFolder || selectedDocs.length === 0}
            data-testid="button-assign-folder"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('knowledge.adminSections.assigning')}
              </>
            ) : (
              <>
                <FolderInput className="h-4 w-4 mr-2" />
                {t('knowledge.adminSections.assignDocs', { count: selectedDocs.length })}
              </>
            )}
          </Button>
        </div>
        
        {/* Document List */}
        <div className="border rounded-md">
          <div className="flex items-center gap-2 p-2 bg-muted/30 border-b">
            <Checkbox
              checked={selectedDocs.length === unassignedDocs.length && unassignedDocs.length > 0}
              onCheckedChange={handleSelectAll}
              data-testid="checkbox-select-all-unassigned"
            />
            <span className="text-sm font-medium">
              {selectedDocs.length > 0 ? `${selectedDocs.length} ${t('knowledge.adminSections.selected')}` : t('knowledge.adminSections.selectAll')}
            </span>
          </div>
          <ScrollArea className="h-64">
            <div className="divide-y">
              {unassignedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 hover-elevate">
                  <Checkbox
                    checked={selectedDocs.includes(doc.id)}
                    onCheckedChange={() => handleToggleDoc(doc.id)}
                    data-testid={`checkbox-doc-${doc.id}`}
                  />
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" dir="auto">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Current path: {doc.folderPath || 'none'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {doc.category || 'uncategorized'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
