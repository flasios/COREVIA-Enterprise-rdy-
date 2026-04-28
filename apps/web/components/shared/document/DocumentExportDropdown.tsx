import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Presentation, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function isSafeBlobUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'blob:';
  } catch {
    return false;
  }
}

interface DocumentExportDropdownProps {
  reportId: string;
  versionId?: string;
  documentType: 'business_case' | 'requirements' | 'strategic_fit';
  disabled?: boolean;
  buttonClassName?: string;
}

export function DocumentExportDropdown({
  reportId,
  versionId,
  documentType,
  disabled = false,
  buttonClassName
}: Readonly<DocumentExportDropdownProps>) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (format: 'pdf' | 'pptx') => {
    setIsExporting(format);
    try {
      const params = new URLSearchParams();
      if (versionId) params.set('versionId', versionId);
      params.set('useAgent', 'true');
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/demand-reports/${reportId}/export/${documentType}/${format}${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `export.${format}`;
      if (contentDisposition) {
        const match = /filename="(.+)"/.exec(contentDisposition);
        if (match?.[1]) filename = match[1];
      }

      const url = globalThis.URL.createObjectURL(blob);
      if (!isSafeBlobUrl(url)) {
        throw new Error('Unsafe export URL generated');
      }

      // Check if on mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const link = document.createElement('a');
      link.href = url;

      if (isMobile) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        toast({
          title: t('notifications.openingDocument'),
          description: t('notifications.openingDocumentDesc', { format: format.toUpperCase() }),
        });
      } else {
        link.download = filename;
        link.click();
        toast({
          title: t('notifications.exportComplete'),
          description: t('notifications.exportCompleteDesc', { format: format.toUpperCase() }),
        });
      }

      // Clean up URL after a delay
      setTimeout(() => globalThis.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: t('notifications.exportFailed'),
        description: error instanceof Error ? error.message : t('notifications.exportFailedGenericDesc'),
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const typeLabels: Record<string, string> = {
    'business_case': t('export.types.businessCase'),
    'requirements': t('export.types.requirements'),
    'strategic_fit': t('export.types.strategicFit'),
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={buttonClassName}
          disabled={disabled || isExporting !== null}
          data-testid={`export-dropdown-${documentType}`}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t('app.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('app.export')} {typeLabels[documentType]}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting !== null}
          data-testid={`export-pdf-${documentType}`}
        >
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          {t('export.downloadPdf')}
          {isExporting === 'pdf' && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('pptx')}
          disabled={isExporting !== null}
          data-testid={`export-pptx-${documentType}`}
        >
          <Presentation className="h-4 w-4 mr-2 text-orange-500" />
          {t('export.downloadPptx')}
          {isExporting === 'pptx' && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
