import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Download, Eye, Calendar, User } from 'lucide-react';
import { DocumentData } from '../../types';

interface DocumentsTabProps {
  documents: DocumentData[];
  onUploadDocument?: () => void;
}

const documentTypeIcons: Record<string, string> = {
  charter: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  plan: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  report: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  specification: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  contract: 'bg-red-500/20 text-red-600 dark:text-red-400',
  other: 'bg-muted-foreground/20 text-muted-foreground',
};

export function DocumentsTab({ documents, onUploadDocument }: DocumentsTabProps) {
  const documentStats = {
    total: documents.length,
    charters: documents.filter(d => d.documentType === 'charter').length,
    plans: documents.filter(d => d.documentType === 'plan').length,
    reports: documents.filter(d => d.documentType === 'report').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border p-3">
          <div className="text-xl font-bold text-foreground">{documentStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Documents</div>
        </Card>
        <Card className="bg-purple-900/20 border-purple-800/30 p-3">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{documentStats.charters}</div>
          <div className="text-xs text-muted-foreground">Charters</div>
        </Card>
        <Card className="bg-blue-900/20 border-blue-800/30 p-3">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{documentStats.plans}</div>
          <div className="text-xs text-muted-foreground">Plans</div>
        </Card>
        <Card className="bg-emerald-900/20 border-emerald-800/30 p-3">
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{documentStats.reports}</div>
          <div className="text-xs text-muted-foreground">Reports</div>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Project Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Manage and organize all project documentation</p>
          </div>
          <Button size="sm" className="gap-2" onClick={onUploadDocument} data-testid="button-upload-document">
            <Plus className="w-4 h-4" />
            Upload Document
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="p-4 bg-muted/40 border border-border/50 rounded-lg hover-elevate cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${documentTypeIcons[doc.documentType] || documentTypeIcons.other}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{doc.documentName}</div>
                    <div className="text-xs text-muted-foreground capitalize">{doc.documentType?.replace(/_/g, ' ')}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        v{doc.version || '1.0'}
                      </Badge>
                      {doc.status && (
                        <Badge variant="secondary" className="text-xs">
                          {doc.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {(doc.createdAt || doc.author) && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
                    {doc.createdAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    {doc.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {doc.author}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" data-testid={`button-view-doc-${doc.id}`}>
                    <Eye className="w-3 h-3" />
                    View
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" data-testid={`button-download-doc-${doc.id}`}>
                    <Download className="w-3 h-3" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
            {!documents.length && (
              <div className="col-span-full text-center text-muted-foreground/70 py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No documents uploaded. Upload project documents to keep everything organized.</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-4"
                  onClick={onUploadDocument}
                  data-testid="button-upload-first-document"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload First Document
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
