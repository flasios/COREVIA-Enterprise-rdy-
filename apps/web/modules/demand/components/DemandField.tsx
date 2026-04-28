import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { XCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface ContactFieldValue {
  primary?: string;
  secondary?: string;
}

type DemandFieldValue = string | number | ContactFieldValue | null | undefined;

interface DemandFieldProps {
  label: string;
  value: DemandFieldValue;
  testId: string;
  type?: 'text' | 'longText' | 'contact' | 'priority' | 'classification';
}

function DemandFieldContent({ value, type }: { value: DemandFieldValue; type: DemandFieldProps['type'] }) {
  const { t } = useTranslation();
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span className="text-sm italic">{t('demand.field.noDataAvailable')}</span>
      </div>
    );
  }

  try {
    switch (type) {
      case 'contact':
        if (typeof value !== 'object' || value === null) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-sm italic">{t('demand.field.invalidContactFormat')}</span>
            </div>
          );
        }

        const primaryContact = value.primary || '';
        const secondaryContact = value.secondary || '';
        
        if (!primaryContact && !secondaryContact) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-sm italic">{t('demand.field.contactNotProvided')}</span>
            </div>
          );
        }

        return (
          <>
            <p className="text-sm font-medium">
              {primaryContact || <span className="text-muted-foreground italic">{t('demand.field.nameNotProvided')}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {secondaryContact || <span className="italic">{t('demand.field.emailNotProvided')}</span>}
            </p>
          </>
        );

      case 'priority':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return (
            <Badge className="bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                <span>{t('demand.field.invalidPriority')}</span>
              </div>
            </Badge>
          );
        }

        const priorityValue = String(value).trim();
        const normalizedPriority = priorityValue.toLowerCase();
        let priorityDisplay = priorityValue;
        let priorityClass = '';

        if (['high', 'critical', 'urgent'].includes(normalizedPriority)) {
          priorityDisplay = t('demand.field.high');
          priorityClass = 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
        } else if (['medium', 'moderate', 'normal'].includes(normalizedPriority)) {
          priorityDisplay = t('demand.field.medium');
          priorityClass = 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400';
        } else if (['low', 'minor'].includes(normalizedPriority)) {
          priorityDisplay = t('demand.field.low');
          priorityClass = 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
        } else if (priorityValue) {
          priorityDisplay = priorityValue;
          priorityClass = 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400';
        } else {
          priorityDisplay = t('demand.field.notSpecified');
          priorityClass = 'bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400';
        }

        return <Badge className={priorityClass}>{priorityDisplay}</Badge>;

      case 'classification':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return (
            <Badge className="bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                <span>{t('demand.field.invalidClassification')}</span>
              </div>
            </Badge>
          );
        }

        const classificationValue = String(value).trim();
        const normalizedClassification = classificationValue.toLowerCase();
        let classificationDisplay = classificationValue;
        let classificationClass = '';

        if (normalizedClassification === 'public') {
          classificationDisplay = t('demand.field.public');
          classificationClass = 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400';
        } else if (normalizedClassification === 'internal') {
          classificationDisplay = t('demand.field.internal');
          classificationClass = 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400';
        } else if (normalizedClassification === 'confidential') {
          classificationDisplay = t('demand.field.confidential');
          classificationClass = 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400';
        } else if (normalizedClassification === 'secret') {
          classificationDisplay = t('demand.field.secret');
          classificationClass = 'bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400';
        } else if (normalizedClassification === 'top_secret') {
          classificationDisplay = t('demand.field.topSecret');
          classificationClass = 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
        } else if (classificationValue) {
          classificationDisplay = classificationValue;
          classificationClass = 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400';
        } else {
          classificationDisplay = t('demand.field.internal');
          classificationClass = 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400';
        }

        return <Badge className={classificationClass}>{classificationDisplay}</Badge>;

      case 'longText':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-sm italic">{t('demand.field.invalidTextData')}</span>
            </div>
          );
        }

        const textContent = String(value).trim();
        if (!textContent) {
          return (
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              {t('demand.field.noDescriptionProvided')}
            </p>
          );
        }

        return <p className="text-sm leading-relaxed">{textContent}</p>;

      default:
        if (typeof value !== 'string' && typeof value !== 'number') {
          return (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-sm italic">{t('demand.field.invalidDataFormat')}</span>
            </div>
          );
        }

        const defaultContent = String(value).trim();
        if (!defaultContent) {
          return (
            <p className="text-sm font-medium text-muted-foreground italic">
              {t('demand.field.notSpecified')}
            </p>
          );
        }

        return <p className="text-sm font-medium">{defaultContent}</p>;
    }
  } catch (error) {
    console.error('Error rendering field content:', error, { value, type });
    return (
      <div className="flex items-center gap-2 text-red-500">
        <XCircle className="h-4 w-4" />
        <span className="text-sm italic">{t('demand.field.errorDisplayingData')}</span>
      </div>
    );
  }
}

function DemandFieldComponent({ label, value, testId, type = 'text' }: DemandFieldProps) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-foreground">{label}</h5>
      <div className="p-3 rounded-lg bg-muted/50 border" data-testid={testId}>
        <DemandFieldContent value={value} type={type} />
      </div>
    </div>
  );
}

export const DemandField = memo(DemandFieldComponent);
export type { DemandFieldValue, ContactFieldValue };
