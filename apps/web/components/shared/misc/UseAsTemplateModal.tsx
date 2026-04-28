import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Copy } from 'lucide-react';

interface UseAsTemplateModalProps {
  documentId: string;
  documentTitle: string;
  documentType: string;
  onConfirm: (sections: string[]) => void;
  onCancel: () => void;
}

interface DocumentSection {
  id: string;
  name: string;
  preview: string;
}

export function UseAsTemplateModal({
  documentId,
  documentTitle,
   
  documentType: _documentType,
  onConfirm,
  onCancel,
}: UseAsTemplateModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const fetchDocumentDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/knowledge/documents/${documentId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch document details');
      }

      const data = await response.json();
      
      if (data.success) {
        // Extract sections from document
        // For now, create default sections - in real implementation, parse document content
        const defaultSections: DocumentSection[] = [
          { id: 'title', name: 'Title & Description', preview: 'Document title and overview' },
          { id: 'objectives', name: 'Objectives', preview: 'Goals and objectives' },
          { id: 'requirements', name: 'Requirements', preview: 'Detailed requirements' },
          { id: 'timeline', name: 'Timeline', preview: 'Project timeline and milestones' },
          { id: 'budget', name: 'Budget', preview: 'Cost breakdown and budget' },
        ];

        setSections(defaultSections);
        // Select all by default
        setSelectedSections(new Set(defaultSections.map(s => s.id)));
      } else {
        throw new Error(data.error || 'Failed to load document');
      }
    } catch (err) {
      console.error('[Template Modal] Error fetching document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
      // Set default sections even on error
      const defaultSections: DocumentSection[] = [
        { id: 'all', name: 'All Content', preview: 'Complete document content' },
      ];
      setSections(defaultSections);
      setSelectedSections(new Set(defaultSections.map(s => s.id)));
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId);
    } else {
      newSelected.add(sectionId);
    }
    setSelectedSections(newSelected);
  };

  const selectAll = () => {
    setSelectedSections(new Set(sections.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSections(new Set());
  };

  const handleConfirm = () => {
    const selectedSectionIds = Array.from(selectedSections);
    
    // Log adoption event
    console.log('[Template Adoption]', {
      documentId,
      documentTitle,
      sections: selectedSectionIds,
      mergeMode,
    });

    onConfirm(selectedSectionIds);
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-2xl" data-testid="use-template-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('common.useAsTemplate.title')}
          </DialogTitle>
          <DialogDescription>
            {t('common.useAsTemplate.description', { title: documentTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3" data-testid="loading-skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" data-testid="error-alert">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {t('common.useAsTemplate.selectSections', { selected: selectedSections.size, total: sections.length })}
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    disabled={selectedSections.size === sections.length}
                    data-testid="button-select-all"
                  >
                    {t('common.useAsTemplate.selectAll')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAll}
                    disabled={selectedSections.size === 0}
                    data-testid="button-deselect-all"
                  >
                    {t('common.useAsTemplate.deselectAll')}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-64 border rounded-md p-4">
                <div className="space-y-3">
                  {sections.map((section) => (
                    <div 
                      key={section.id} 
                      className="flex items-start gap-3 p-2 rounded-md hover-elevate"
                      data-testid={`section-${section.id}`}
                    >
                      <Checkbox
                        id={section.id}
                        checked={selectedSections.has(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                        data-testid={`checkbox-section-${section.id}`}
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={section.id} 
                          className="font-medium cursor-pointer"
                        >
                          {section.name}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {section.preview}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('common.useAsTemplate.applyMode')}</Label>
                <RadioGroup 
                  value={mergeMode} 
                  onValueChange={(value) => setMergeMode(value as 'merge' | 'replace')}
                  data-testid="merge-mode-radio"
                >
                  <div className="flex items-start gap-3 p-2 rounded-md hover-elevate">
                    <RadioGroupItem value="merge" id="merge" />
                    <div className="flex-1">
                      <Label htmlFor="merge" className="font-medium cursor-pointer">
                        {t('common.useAsTemplate.mergeWithExisting')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('common.useAsTemplate.mergeDescription')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-md hover-elevate">
                    <RadioGroupItem value="replace" id="replace" />
                    <div className="flex-1">
                      <Label htmlFor="replace" className="font-medium cursor-pointer">
                        {t('common.useAsTemplate.replaceExisting')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('common.useAsTemplate.replaceDescription')}
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {mergeMode === 'replace' && (
                <Alert data-testid="warning-alert">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t('common.useAsTemplate.warning')}:</strong> {t('common.useAsTemplate.replaceWarning')}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            {t('common.useAsTemplate.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || selectedSections.size === 0}
            data-testid="button-confirm"
          >
            <Copy className="h-4 w-4 mr-2" />
            {t('common.useAsTemplate.applyTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
