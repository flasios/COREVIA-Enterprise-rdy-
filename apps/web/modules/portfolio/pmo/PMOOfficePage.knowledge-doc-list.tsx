import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

/* ── Extracted: Knowledge doc card list (reduces nesting depth for SonarQube) ── */
export function PMOKnowledgeDocList({ docs, t }: Readonly<{ docs: Record<string, unknown>[]; t: (key: string) => string }>) {
  if (docs.length === 0) {
    return <div className="text-xs text-muted-foreground">{t('pmo.office.noDocumentsYet')}</div>;
  }
  return (
    <>
      {docs.slice(0, 4).map((doc) => {
        const document = doc;
        const filename = typeof document.filename === 'string' ? document.filename : "Untitled";
        const category = typeof document.category === 'string' ? document.category : "Unclassified";
        const status = typeof document.processingStatus === 'string' ? document.processingStatus : "pending";
        const uploadedAt = typeof document.uploadedAt === 'string' ? new Date(document.uploadedAt).toLocaleDateString() : "";
        const documentId = document.id;
        const hasDocumentId = typeof documentId === "string" || typeof documentId === "number";
        const documentIdValue = hasDocumentId ? String(documentId) : "";
        return (
          <div
            key={typeof document.id === 'string' || typeof document.id === 'number' ? String(document.id) : filename}
            className="grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{filename}</p>
                <p className="text-[11px] text-muted-foreground truncate">{category} • {uploadedAt}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
              <Badge variant={status === "completed" ? "default" : "secondary"} className="capitalize">
                {status.replaceAll('_', ' ')}
              </Badge>
              {hasDocumentId && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/api/knowledge/documents/${documentIdValue}/view`, "_blank")}
                    data-testid={`button-view-pmo-${documentIdValue}`}
                  >
                    {t('pmo.office.view')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = globalThis.document.createElement("a");
                      link.href = `/api/knowledge/documents/${documentIdValue}/download`;
                      link.download = filename;
                      link.click();
                    }}
                    data-testid={`button-download-pmo-${documentIdValue}`}
                  >
                    {t('pmo.office.download')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
