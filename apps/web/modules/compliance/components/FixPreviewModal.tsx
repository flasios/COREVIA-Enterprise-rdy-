/**
 * Modal for previewing and applying AI-suggested compliance fixes.
 * 
 * @component
 * @param {ComplianceViolation | null} violation - The violation to fix
 * @param {() => void} onClose - Handler for closing the modal
 * @param {(id: number) => void} onApply - Handler for applying the fix
 * @param {boolean} [isApplying] - Whether fix is currently being applied
 * 
 * @requires Section 508 / WCAG 2.1 AA compliant
 * @security suggestedFix content is escaped by React - only trusted AI output allowed
 */
import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AICitationsList } from '@/components/shared/ai/AICitationsList';
import { AIConfidenceBadge } from '@/components/shared/ai/AIConfidenceBadge';
import { CheckCircle, X, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ComplianceViolation } from '@shared/complianceTypes';

interface FixPreviewModalProps {
  violation: ComplianceViolation | null;
  onClose: () => void;
  onApply: (id: number) => void;
  isApplying?: boolean;
}

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.4,
} as const;

const getConfidenceTier = (confidence: number): 'high' | 'medium' | 'low' => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
};

const getSeverityColor = (severity: string | undefined): string => {
  if (!severity) return 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-300';
  
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300';
    case 'high':
      return 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300';
    case 'medium':
      return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300';
    case 'low':
      return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300';
    default:
      return 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-300';
  }
};

export function FixPreviewModal({ violation, onClose, onApply, isApplying = false }: FixPreviewModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const handleApply = useCallback(() => {
    if (!violation || !violation.id) return;
    onApply(violation.id);
  }, [violation, onApply]);

  const copyFixToClipboard = useCallback(async () => {
    if (!violation?.suggestedFix) return;
    
    try {
      await navigator.clipboard.writeText(violation.suggestedFix);
      toast({
        title: t('compliance.fixPreview.copied'),
        description: t('compliance.fixPreview.copiedDescription'),
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: t('compliance.fixPreview.copyFailed'),
        description: t('compliance.fixPreview.copyFailedDescription'),
        variant: 'destructive',
      });
    }
  }, [violation?.suggestedFix, toast, t]);

  useEffect(() => {
    if (!violation) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && violation.suggestedFix && !isApplying) {
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [violation, isApplying, onClose, handleApply]);

  if (!violation) return null;

  if (!violation.id || typeof violation.id !== 'number') {
    console.error('FixPreviewModal: Invalid violation ID:', violation);
    return null;
  }

  const severityDisplay = violation.severity?.toUpperCase() || 'UNKNOWN';
  const hasIncompleteData = !violation.ruleName || !violation.violationMessage;

  return (
    <Dialog open={!!violation} onOpenChange={onClose}>
      <DialogContent 
        className={`max-w-3xl max-h-[90vh] overflow-y-auto ${isApplying ? 'opacity-75' : ''}`}
        data-testid="dialog-fix-preview"
        aria-describedby="fix-preview-description"
        aria-busy={isApplying}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('compliance.fixPreview.title')}
            <Badge 
              className={getSeverityColor(violation.severity)}
              aria-label={`Severity: ${severityDisplay}`}
            >
              {severityDisplay}
            </Badge>
          </DialogTitle>
          <DialogDescription id="fix-preview-description">
            {t('compliance.fixPreview.description')}
          </DialogDescription>
        </DialogHeader>

        {hasIncompleteData && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('compliance.fixPreview.incompleteData')}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2" role="region" aria-label="Rule information">
            <h3 className="font-semibold text-sm" id="rule-heading">{t('compliance.fixPreview.rule')}</h3>
            <p className="text-sm">{violation.ruleName || t('compliance.fixPreview.unknownRule')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {violation.ruleCategory && (
                <Badge variant="outline" className="text-xs">
                  {violation.ruleCategory}
                </Badge>
              )}
              {violation.section && (
                <Badge variant="outline" className="text-xs">
                  {violation.section}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2" role="region" aria-label={t('compliance.fixPreview.issueDescription')}>
            <h3 className="font-semibold text-sm" id="issue-heading">{t('compliance.fixPreview.issue')}</h3>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm">{violation.violationMessage || t('compliance.fixPreview.noDescription')}</p>
            </div>
          </div>

          <Separator />

          {violation.suggestedFix ? (
            <div className="space-y-2" role="region" aria-labelledby="suggested-fix-heading">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-sm" id="suggested-fix-heading">{t('compliance.fixPreview.suggestedFix')}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyFixToClipboard}
                    aria-label="Copy suggested fix to clipboard"
                    title={t('common.copyToClipboard')}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {typeof violation.fixConfidence === 'number' && (
                    <AIConfidenceBadge 
                      confidence={{
                        score: violation.fixConfidence,
                        tier: getConfidenceTier(violation.fixConfidence),
                        percentage: violation.fixConfidence * 100
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-4 rounded-md">
                {/* 
                  Security Note: violation.suggestedFix is rendered as text content.
                  React automatically escapes this content, preventing XSS.
                  Source: Trusted AI service output only - never user input.
                */}
                <pre 
                  className="whitespace-pre-wrap text-sm font-mono"
                  tabIndex={0}
                  aria-label="Suggested fix content"
                >
                  {violation.suggestedFix}
                </pre>
              </div>
            </div>
          ) : (
            <div 
              className="bg-muted p-4 rounded-md"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm text-muted-foreground italic">
                {t('compliance.fixPreview.noSuggestedFix')}
              </p>
            </div>
          )}

          {Array.isArray(violation.fixCitations) && violation.fixCitations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2" role="region" aria-label="Source documents">
                <h3 className="font-semibold text-sm" id="citations-heading">{t('compliance.fixPreview.sourceDocuments')}</h3>
                <AICitationsList citations={violation.fixCitations} />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-fix"
            disabled={isApplying}
          >
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('compliance.fixPreview.cancel')}
          </Button>
          {violation.suggestedFix && violation.status === 'open' && (
            <Button
              variant="default"
              onClick={handleApply}
              disabled={isApplying}
              data-testid="button-apply-fix-modal"
              title={t('compliance.fixPreview.applyShortcut')}
            >
              <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              {isApplying ? t('compliance.fixPreview.applyingFix') : t('compliance.fixPreview.applyFix')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
