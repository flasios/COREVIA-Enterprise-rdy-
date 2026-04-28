/**
 * Table row component for displaying a single compliance violation.
 * 
 * @component
 * @param {ComplianceViolation} violation - The violation data to display
 * @param {(id: number) => void} onApplyFix - Handler for applying the fix
 * @param {(violation: ComplianceViolation) => void} onPreview - Handler for previewing the violation
 * @param {number} [applyingViolationId] - ID of violation currently being fixed (for loading state)
 * 
 * @requires Section 508 / WCAG 2.1 AA compliant
 * @security Content is escaped by React - only trusted compliance engine data allowed
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { 
  Eye, 
  CheckCircle, 
  FileText, 
  AlertOctagon, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  XCircle
} from 'lucide-react';
import type { ComplianceViolation } from '@shared/complianceTypes';

interface ViolationRowProps {
  violation: ComplianceViolation;
  onApplyFix: (id: number) => void;
  onPreview: (violation: ComplianceViolation) => void;
  applyingViolationId?: number;
  isApplying?: boolean;
}

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

const getSeverityVariant = (severity: string | undefined): BadgeVariant => {
  if (!severity) return 'default';
  
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'outline';
    case 'low':
      return 'secondary';
    default:
      return 'default';
  }
};

const getSeverityColor = (severity: string | undefined): string => {
  if (!severity) return 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-300';
  
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800';
    case 'high':
      return 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800';
    case 'medium':
      return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    case 'low':
      return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    default:
      return 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-300';
  }
};

const getSeverityIcon = (severity: string | undefined) => {
  if (!severity) return <Info className="h-3 w-3" aria-hidden="true" />;
  
  switch (severity.toLowerCase()) {
    case 'critical':
      return <AlertOctagon className="h-3 w-3" aria-hidden="true" />;
    case 'high':
      return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
    case 'medium':
      return <AlertCircle className="h-3 w-3" aria-hidden="true" />;
    case 'low':
      return <Info className="h-3 w-3" aria-hidden="true" />;
    default:
      return <Info className="h-3 w-3" aria-hidden="true" />;
  }
};

const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export function ViolationRow({ 
  violation, 
  onApplyFix, 
  onPreview, 
  applyingViolationId,
  isApplying 
}: ViolationRowProps) {
  const { t } = useTranslation();

  if (!violation || !violation.id) {
    console.error('ViolationRow: Invalid violation data:', violation);
    return null;
  }

  const ruleName = violation.ruleName || t('compliance.violationRow.unknownRule');
  const violationMessage = violation.violationMessage || t('compliance.violationRow.noDescription');
  const severity = violation.severity || 'unknown';
  const severityDisplay = severity.toUpperCase();
  
  const fixCitations = violation.fixCitations || [];
  const hasCitations = Array.isArray(fixCitations) && fixCitations.length > 0;
  const citationCount = fixCitations.length;
  
  const isThisViolationApplying = applyingViolationId === violation.id || (isApplying && !applyingViolationId);
  const isAnyApplying = applyingViolationId !== undefined || isApplying;
  
  const isTruncated = violation.suggestedFix && violation.suggestedFix.length > 100;

  return (
    <tr 
      className="border-b hover-elevate" 
      data-testid={`row-violation-${violation.id}`}
      role="row"
      aria-label={t('compliance.violationRow.ariaViolation', { rule: ruleName, severity: severityDisplay })}
    >
      <td className="py-3 px-4" role="cell">
        <Badge 
          variant={getSeverityVariant(severity)}
          className={`flex items-center gap-1 ${getSeverityColor(severity)}`}
          data-testid={`badge-severity-${severity}`}
          aria-label={t('compliance.violationRow.ariaSeverity', { level: severityDisplay })}
        >
          {getSeverityIcon(severity)}
          <span>{severityDisplay}</span>
        </Badge>
      </td>
      <td className="py-3 px-4" role="cell">
        <div className="space-y-1">
          <p className="font-medium text-sm" id={`rule-name-${violation.id}`}>{ruleName}</p>
          {violation.ruleCategory && (
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs" aria-label={t('compliance.violationRow.ariaCategory', { category: violation.ruleCategory })}>
                {violation.ruleCategory}
              </Badge>
            </p>
          )}
        </div>
      </td>
      <td className="py-3 px-4" role="cell">
        {violation.section && (
          <Badge variant="outline" className="text-xs" aria-label={t('compliance.violationRow.ariaSection', { section: violation.section })}>
            {violation.section}
          </Badge>
        )}
      </td>
      <td className="py-3 px-4 max-w-md" role="cell">
        <p 
          className="text-sm"
          aria-labelledby={`rule-name-${violation.id}`}
        >
          {violationMessage}
        </p>
      </td>
      <td className="py-3 px-4 max-w-md" role="cell">
        {violation.suggestedFix ? (
          <div className="space-y-2" role="region" aria-label={t('compliance.violationRow.suggestedFix')}>
            <p 
              className="text-sm text-muted-foreground"
              title={isTruncated ? violation.suggestedFix : undefined}
            >
              {truncateText(violation.suggestedFix, 100)}
            </p>
            {hasCitations && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onPreview(violation)}
                data-testid={`button-view-citations-${violation.id}`}
                aria-label={t('compliance.violationRow.viewCitationsAria', { count: citationCount })}
              >
                <FileText className="h-3 w-3 mr-1" aria-hidden="true" />
                {t('compliance.violationRow.viewCitations', { count: citationCount })}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic" role="status">
            {t('compliance.violationRow.noSuggestedFix')}
          </p>
        )}
      </td>
      <td className="py-3 px-4" role="cell">
        <div className="flex items-center gap-2" role="group" aria-label={t('compliance.violationRow.actions')}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview(violation)}
            data-testid={`button-preview-${violation.id}`}
            aria-label={t('compliance.violationRow.previewAria', { rule: ruleName })}
          >
            <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
            {t('compliance.violationRow.preview')}
          </Button>
          
          {violation.suggestedFix && violation.status === 'open' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onApplyFix(violation.id)}
              disabled={isAnyApplying}
              data-testid={`button-apply-fix-${violation.id}`}
              aria-busy={isThisViolationApplying}
            >
              <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" />
              {isThisViolationApplying ? t('compliance.violationRow.applying') : t('compliance.violationRow.applyFix')}
            </Button>
          )}
          
          {violation.status === 'fixed' && (
            <Badge variant="default" className="bg-green-600 dark:bg-green-700">
              <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
              {t('compliance.violationRow.fixed')}
            </Badge>
          )}
          
          {violation.status === 'dismissed' && (
            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-950/30">
              <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
              {t('compliance.violationRow.dismissed')}
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}
